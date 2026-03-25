/**
 * Recording Routes Module
 * Feature #26: Rewritten for Playwright + Socket.IO screenshot streaming
 *
 * Architecture:
 * - POST /api/v1/recording/start: Launch headless Playwright browser, start streaming screenshots via Socket.IO
 * - Socket.IO events control the browser (click, type, keypress, scroll, navigate)
 * - POST /api/v1/recording/:sessionId/stop: Stop screenshot loop, close browser, return recorded actions
 * - GET /api/v1/recording/:sessionId/actions: Return current recorded actions (polling fallback)
 */

import { FastifyInstance } from 'fastify';
import { authenticate, getOrganizationId, JwtPayload } from '../../middleware/auth.js';
import { getTestSuite } from '../test-suites.js';
import { chromium, Browser, Page, BrowserContext, type BrowserContextOptions } from 'playwright';
import { Server as SocketIOServer, Socket } from 'socket.io';
// Feature #36: Import device presets for mobile emulation
import { TestDeviceConfig, resolveDeviceConfig } from './device-presets.js';
import { createLogger } from '../../services/logger.js';
import { validateBody, validateParams, recordingIdParamsSchema, startRecordingBodySchema, stopRecordingBodySchema } from '../../validation/index.js';

import { sendError } from '../../utils/errors.js';
const logger = createLogger('route:test-runs:recording');

// Max concurrent recording sessions (configurable via env var)
const MAX_RECORDING_SESSIONS = parseInt(process.env.MAX_RECORDING_SESSIONS || '3', 10);

// Session inactivity timeout in ms (5 minutes)
const SESSION_INACTIVITY_TIMEOUT = 5 * 60 * 1000;

// Grace period for socket disconnect before cleanup (30 seconds)
const DISCONNECT_GRACE_PERIOD = 30 * 1000;

// Cleanup check interval (30 seconds)
const CLEANUP_CHECK_INTERVAL = 30 * 1000;

// Recording session interface with Playwright browser references
interface SelectorStrategy {
  strategy: string;
  selector: string;
  confidence: number;
}

// Feature #414: Interface for element info returned by generateSelectorScript
interface ElementInfo {
  selector: string;
  selectorStrategies?: SelectorStrategy[];
  tagName: string;
  text: string;
  id?: string;
  name?: string;
  className?: string;
}

interface RecordingSession {
  id: string;
  organization_id: string;
  user_id: string;
  suite_id: string;
  target_url: string;
  status: 'recording' | 'stopped' | 'error';
  actions: Array<{
    action: string;
    selector?: string;
    selectorStrategies?: SelectorStrategy[];
    value?: string;
    url?: string;
    text?: string;
    tagName?: string;
    id?: string;
    name?: string;
    className?: string;
    timestamp: number;
    // Feature #37: Optional step support for cookie consent handling
    optional?: boolean;
    optionalReason?: 'cookie_consent' | 'popup_dismiss' | 'notification_close' | 'user_marked';
  }>;
  created_at: Date;
  lastActivity: number; // Timestamp of last activity for timeout detection
  browser: Browser | null;
  context: BrowserContext | null;
  page: Page | null;
  screenshotInterval: ReturnType<typeof setInterval> | null;
  dirty: boolean; // Flag to track if page content changed
  // Feature #36: Device emulation config
  device_config?: TestDeviceConfig;
}

// Store active recording sessions
const recordingSessions: Map<string, RecordingSession> = new Map();

// Store grace period timers for disconnected sockets
const disconnectTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

// Track which socket is connected to which recording session
const socketSessionMap: Map<string, string> = new Map();

// Periodic cleanup interval reference
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Feature #37: Optional step patterns for cookie consent and popup handling
 * These patterns match common consent dialogs and popups that may not always appear
 */
const OPTIONAL_STEP_PATTERNS = {
  // Cookie consent patterns
  cookie_consent: [
    // Common cookie consent test IDs and classes
    'button-decline', 'button-accept', 'cookie-accept', 'cookie-decline', 'cookie-close',
    'gdpr-', 'consent-', 'onetrust-', 'cookiebot-', 'ccpa-', 'cookie-banner',
    'cookie-notice', 'cookie-policy', 'accept-cookies', 'reject-cookies',
    'cookie-settings', 'manage-cookies', 'cookie-preferences',
    // CMP (Consent Management Platform) patterns
    'cmp-', 'sp_choice', 'didomi', 'trustarc', 'quantcast',
  ],
  // Popup/modal dismiss patterns
  popup_dismiss: [
    'close-modal', 'dismiss', 'close-popup', 'modal-close', 'popup-close',
    'close-dialog', 'dialog-close', 'overlay-close', 'close-overlay',
    'close-btn', 'btn-close', 'dismiss-btn', 'btn-dismiss',
  ],
  // Notification dismiss patterns
  notification_close: [
    'notification-close', 'alert-dismiss', 'banner-close', 'toast-close',
    'snackbar-close', 'close-notification', 'dismiss-notification',
    'close-alert', 'dismiss-alert', 'close-banner', 'dismiss-banner',
  ],
};

/**
 * Feature #37: Detect if a selector/action should be marked as optional
 * Returns the optional reason if detected, undefined otherwise
 */
function detectOptionalStep(
  selector?: string,
  text?: string,
  id?: string,
  className?: string
): { optional: boolean; reason: 'cookie_consent' | 'popup_dismiss' | 'notification_close' } | undefined {
  // Combine all available identifiers for matching
  const identifiers = [selector, text, id, className].filter(Boolean).map(s => s!.toLowerCase());

  for (const identifier of identifiers) {
    // Check cookie consent patterns
    for (const pattern of OPTIONAL_STEP_PATTERNS.cookie_consent) {
      if (identifier.includes(pattern.toLowerCase())) {
        logger.info(`[RECORDER] Auto-marked optional (cookie_consent): "${identifier}" matched pattern "${pattern}"`);
        return { optional: true, reason: 'cookie_consent' };
      }
    }

    // Check popup dismiss patterns
    for (const pattern of OPTIONAL_STEP_PATTERNS.popup_dismiss) {
      if (identifier.includes(pattern.toLowerCase())) {
        logger.info(`[RECORDER] Auto-marked optional (popup_dismiss): "${identifier}" matched pattern "${pattern}"`);
        return { optional: true, reason: 'popup_dismiss' };
      }
    }

    // Check notification close patterns
    for (const pattern of OPTIONAL_STEP_PATTERNS.notification_close) {
      if (identifier.includes(pattern.toLowerCase())) {
        logger.info(`[RECORDER] Auto-marked optional (notification_close): "${identifier}" matched pattern "${pattern}"`);
        return { optional: true, reason: 'notification_close' };
      }
    }
  }

  return undefined;
}

/**
 * Touch session lastActivity timestamp
 */
function touchSession(session: RecordingSession) {
  session.lastActivity = Date.now();
}

/**
 * Start periodic cleanup interval for orphaned sessions
 */
function startCleanupInterval() {
  if (cleanupInterval) return; // Already running

  cleanupInterval = setInterval(async () => {
    const now = Date.now();
    for (const [sessionId, session] of recordingSessions.entries()) {
      if (session.status !== 'recording') continue;

      const inactiveFor = now - session.lastActivity;
      if (inactiveFor > SESSION_INACTIVITY_TIMEOUT) {
        logger.info(`[RECORDER] Auto-cleaning orphaned session ${sessionId} (inactive for ${Math.round(inactiveFor / 1000)}s)`);
        session.status = 'stopped';
        await cleanupSession(session);
        recordingSessions.delete(sessionId);

        // Also clean up any disconnect timer
        const timer = disconnectTimers.get(sessionId);
        if (timer) {
          clearTimeout(timer);
          disconnectTimers.delete(sessionId);
        }
      }
    }
  }, CLEANUP_CHECK_INTERVAL);

  // Don't prevent process exit
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  logger.info('[RECORDER] Started periodic cleanup interval (every 30s, timeout 5min)');
}

/**
 * Cleanup ALL active recording sessions (for server shutdown)
 */
async function cleanupAllSessions() {
  logger.info(`[RECORDER] Cleaning up all ${recordingSessions.size} active recording sessions...`);

  const cleanupPromises: Promise<void>[] = [];
  for (const [sessionId, session] of recordingSessions.entries()) {
    if (session.status === 'recording') {
      session.status = 'stopped';
      cleanupPromises.push(cleanupSession(session).then(() => {
        logger.info(`[RECORDER] Cleaned up session ${sessionId} on shutdown`);
      }));
    }
  }

  await Promise.allSettled(cleanupPromises);
  recordingSessions.clear();
  disconnectTimers.clear();
  socketSessionMap.clear();

  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }

  logger.info('[RECORDER] All sessions cleaned up');
}

// Register process signal handlers for graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('[RECORDER] SIGTERM received, cleaning up sessions...');
  await cleanupAllSessions();
});

process.on('SIGINT', async () => {
  logger.info('[RECORDER] SIGINT received, cleaning up sessions...');
  await cleanupAllSessions();
});

// Socket.IO instance (set from index.ts)
let io: SocketIOServer | null = null;

/**
 * Set Socket.IO instance for recording module
 */
export function setRecordingSocketIO(socketIO: SocketIOServer) {
  io = socketIO;
  setupRecordingSocketHandlers(socketIO);
}

/**
 * Check if an element ID looks auto-generated/unstable
 * Returns true if the ID should be SKIPPED (not used as selector)
 */
function isAutoGeneratedIdCheck(): string {
  return `
    function isAutoGeneratedId(id) {
      if (!id || id.length > 120) return true;
      // Skip React-generated IDs like :r1:, :r2:, :ra:
      if (/^:r[0-9a-z]+:$/i.test(id)) return true;
      // Skip IDs that start with colon (React internal)
      if (id.startsWith(':')) return true;
      // Skip pure numeric IDs
      if (/^\\d+$/.test(id)) return true;
      // Skip pure UUIDs: 8-4-4-4-12 hex pattern
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return true;
      // Skip long random hex strings (16+ chars of only hex)
      if (/^[0-9a-f]{16,}$/i.test(id)) return true;
      // Keep everything else - including IDs with '--' (framework IDs like Shopify)
      return false;
    }
  `;
}

/**
 * Escape text for use in Playwright :has-text() selectors
 */
function escapeTextForSelector(): string {
  return `
    function escapeTextForSelector(text) {
      if (!text) return '';
      // Truncate long text
      let t = text.trim().slice(0, 50);
      // Escape backslashes first, then quotes
      t = t.replace(/\\\\/g, '\\\\\\\\').replace(/"/g, '\\\\"');
      return t;
    }
  `;
}

/**
 * Build a CSS path selector for an element (up to 3 levels)
 */
function buildCssPathScript(): string {
  return `
    function buildCssPath(el) {
      const parts = [];
      let current = el;
      for (let i = 0; i < 3 && current && current !== document.body; i++) {
        let seg = current.tagName.toLowerCase();
        if (current.id && !isAutoGeneratedId(current.id)) {
          seg = '#' + CSS.escape(current.id);
          parts.unshift(seg);
          break;
        }
        const parent = current.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter(c => c.tagName === current.tagName);
          if (siblings.length > 1) {
            const idx = siblings.indexOf(current) + 1;
            seg += ':nth-of-type(' + idx + ')';
          }
        }
        parts.unshift(seg);
        current = parent;
      }
      return parts.join(' > ') || el.tagName.toLowerCase();
    }
  `;
}

/**
 * Generate a CSS selector for the element at given coordinates
 * Returns primary selector + multiple fallback strategies for healing
 */
function generateSelectorScript(x: number, y: number): string {
  return `
    (() => {
      ${isAutoGeneratedIdCheck()}
      ${escapeTextForSelector()}
      ${buildCssPathScript()}

      let el = document.elementFromPoint(${x}, ${y});
      if (!el) return null;

      // Walk up to find the nearest interactive element
      const interactive = el.closest('a, button, input, select, textarea, [role="button"], [role="link"], [onclick], label');
      if (interactive) el = interactive;

      const tagName = el.tagName || '';
      const text = el.innerText?.trim()?.slice(0, 50) || '';
      const hasImage = !!el.querySelector('img');

      // Collect ALL selector strategies with confidence scores
      const strategies = [];

      // Strategy: ID selector
      if (el.id && !isAutoGeneratedId(el.id)) {
        strategies.push({ strategy: 'id', selector: '#' + CSS.escape(el.id), confidence: 1.0 });
      }

      // Strategy: data-testid
      const testId = el.getAttribute('data-testid');
      if (testId) {
        strategies.push({ strategy: 'data-testid', selector: '[data-testid="' + testId.replace(/"/g, '\\\\"') + '"]', confidence: 0.95 });
      }

      // Strategy: aria-label
      const ariaLabel = el.getAttribute('aria-label');
      if (ariaLabel) {
        strategies.push({ strategy: 'aria-label', selector: '[aria-label="' + ariaLabel.replace(/"/g, '\\\\"') + '"]', confidence: 0.9 });
      }

      // Strategy: name attribute (form elements)
      const nameAttr = el.getAttribute('name');
      if (nameAttr) {
        strategies.push({ strategy: 'name', selector: '[name="' + nameAttr.replace(/"/g, '\\\\"') + '"]', confidence: 0.9 });
      }

      // Strategy: text-based selector for buttons/links (with disambiguation)
      const role = el.getAttribute('role');
      if ((tagName === 'BUTTON' || tagName === 'A' || role === 'button' || role === 'link') && text) {
        const escapedText = escapeTextForSelector(text);
        const baseTag = (role || tagName.toLowerCase()) === 'button' ? 'button' : 'a';
        let textSelector = baseTag + ':has-text("' + escapedText + '")';

        // Disambiguation: count how many elements match this text selector
        try {
          const matchCount = document.querySelectorAll(baseTag).length;
          const sameTextElements = Array.from(document.querySelectorAll(baseTag)).filter(
            e => e.innerText?.trim()?.slice(0, 50) === text
          );
          if (sameTextElements.length > 1) {
            // Multiple matches - add nth=0 for disambiguation
            // Also try to detect if this is an image link vs text link
            if (hasImage) {
              textSelector = baseTag + ':has(img):has-text("' + escapedText + '") >> nth=0';
            } else {
              textSelector = baseTag + ':has-text("' + escapedText + '"):not(:has(img)) >> nth=0';
            }
          }
        } catch(e) {
          // Fallback: always add >> nth=0 for safety
          textSelector += ' >> nth=0';
        }

        strategies.push({ strategy: 'text-content', selector: textSelector, confidence: 0.75 });
      }

      // Strategy: input by type + placeholder
      if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
        const type = el.getAttribute('type') || 'text';
        const placeholder = el.getAttribute('placeholder');
        if (placeholder) {
          strategies.push({ strategy: 'placeholder', selector: tagName.toLowerCase() + '[placeholder="' + placeholder.replace(/"/g, '\\\\"') + '"]', confidence: 0.85 });
        }
        strategies.push({ strategy: 'input-type', selector: tagName.toLowerCase() + '[type="' + type + '"]', confidence: 0.5 });
      }

      // Strategy: CSS path (always available as fallback)
      const cssPath = buildCssPath(el);
      strategies.push({ strategy: 'css-path', selector: cssPath, confidence: 0.6 });

      // Pick the best selector (highest confidence)
      strategies.sort((a, b) => b.confidence - a.confidence);
      const best = strategies[0];

      return {
        selector: best.selector,
        selectorStrategies: strategies.slice(0, 3), // Top 3 strategies
        tagName,
        text,
        id: el.id || '',
        name: nameAttr || '',
        className: typeof el.className === 'string' ? el.className : ''
      };
    })()
  `;
}

/**
 * Setup Socket.IO event handlers for recording control
 */
function setupRecordingSocketHandlers(socketIO: SocketIOServer) {
  // Start the periodic cleanup interval
  startCleanupInterval();

  socketIO.on('connection', (socket: Socket) => {
    // Join recording room
    socket.on('recording:join', (data: { sessionId: string }) => {
      const { sessionId } = data;
      socket.join(`recording:${sessionId}`);
      socketSessionMap.set(socket.id, sessionId);
      logger.info(`[RECORDER] Client ${socket.id} joined recording:${sessionId}`);

      // Cancel any pending disconnect cleanup timer for this session
      const existingTimer = disconnectTimers.get(sessionId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        disconnectTimers.delete(sessionId);
        logger.info(`[RECORDER] Cancelled disconnect cleanup timer for session ${sessionId} (client reconnected)`);
      }

      // Touch session activity
      const session = recordingSessions.get(sessionId);
      if (session) {
        touchSession(session);
      }
    });

    // Leave recording room
    socket.on('recording:leave', (data: { sessionId: string }) => {
      const { sessionId } = data;
      socket.leave(`recording:${sessionId}`);
      socketSessionMap.delete(socket.id);
      logger.info(`[RECORDER] Client ${socket.id} left recording:${sessionId}`);
    });

    // Handle socket disconnect - start grace period
    socket.on('disconnect', () => {
      const sessionId = socketSessionMap.get(socket.id);
      socketSessionMap.delete(socket.id);

      if (!sessionId) return;

      const session = recordingSessions.get(sessionId);
      if (!session || session.status !== 'recording') return;

      // Check if any other sockets are still connected to this session's room
      const room = socketIO.sockets.adapter.rooms.get(`recording:${sessionId}`);
      if (room && room.size > 0) {
        logger.info(`[RECORDER] Socket ${socket.id} disconnected, but ${room.size} other client(s) still connected to session ${sessionId}`);
        return;
      }

      logger.info(`[RECORDER] All clients disconnected from session ${sessionId}. Starting ${DISCONNECT_GRACE_PERIOD / 1000}s grace period...`);

      // Start grace period timer
      const timer = setTimeout(async () => {
        disconnectTimers.delete(sessionId);
        const sess = recordingSessions.get(sessionId);
        if (!sess || sess.status !== 'recording') return;

        // Check once more if any clients reconnected
        const currentRoom = socketIO.sockets.adapter.rooms.get(`recording:${sessionId}`);
        if (currentRoom && currentRoom.size > 0) {
          logger.info(`[RECORDER] Client reconnected to session ${sessionId} during grace period, skipping cleanup`);
          return;
        }

        logger.info(`[RECORDER] Grace period expired for session ${sessionId}. Auto-cleaning orphaned session.`);
        sess.status = 'stopped';
        await cleanupSession(sess);
        recordingSessions.delete(sessionId);
        logger.info(`[RECORDER] Orphaned session ${sessionId} cleaned up after disconnect`);
      }, DISCONNECT_GRACE_PERIOD);

      disconnectTimers.set(sessionId, timer);
    });

    // Handle click events from frontend
    socket.on('recording:click', async (data: { sessionId: string; x: number; y: number }) => {
      const { sessionId, x, y } = data;
      const session = recordingSessions.get(sessionId);
      if (!session || !session.page || session.status !== 'recording') return;
      touchSession(session);

      try {
        // Get element info before clicking
        const elementInfo = await session.page.evaluate(generateSelectorScript(x, y)) as ElementInfo | null;

        // Click at coordinates
        await session.page.mouse.click(x, y);
        session.dirty = true;

        // Record the action with multiple selector strategies
        const action: RecordingSession['actions'][number] = {
          action: 'click',
          selector: elementInfo?.selector || `click(${x}, ${y})`,
          selectorStrategies: elementInfo?.selectorStrategies || [],
          tagName: elementInfo?.tagName || '',
          text: elementInfo?.text || '',
          id: elementInfo?.id || '',
          name: elementInfo?.name || '',
          className: elementInfo?.className || '',
          timestamp: Date.now(),
        };

        // Feature #37: Auto-detect if this is a cookie consent or popup dismiss element
        const optionalResult = detectOptionalStep(
          elementInfo?.selector,
          elementInfo?.text,
          elementInfo?.id,
          elementInfo?.className
        );
        if (optionalResult) {
          action.optional = true;
          action.optionalReason = optionalResult.reason;
        }

        session.actions.push(action);

        // Emit action to frontend
        socketIO.to(`recording:${sessionId}`).emit('recording:action', action);
        logger.info(`[RECORDER] Click at (${x}, ${y}) -> ${elementInfo?.selector || 'unknown'}`);

        // Feature #34: Verify actual clicked element after click (may differ due to navigation/animations)
        try {
          const actualElement = await session.page!.evaluate(`
            (() => {
              const el = document.elementFromPoint(${x}, ${y});
              if (!el) return null;
              return {
                tagName: el.tagName,
                text: (el.innerText || '').trim().slice(0, 50),
                id: el.id || '',
              };
            })()
          `) as { tagName: string; text: string; id: string } | null;
          socketIO.to(`recording:${sessionId}`).emit('recording:click-result', {
            x, y,
            selector: elementInfo?.selector || '',
            actualElement: actualElement || { tagName: 'unknown', text: '', id: '' },
          });
        } catch { /* page may have navigated, skip verification */ }
      } catch (err) {
        logger.error({ err }, '[RECORDER] Click error');
      }
    });

    // Handle type events
    socket.on('recording:type', async (data: { sessionId: string; text: string }) => {
      const { sessionId, text } = data;
      const session = recordingSessions.get(sessionId);
      if (!session || !session.page || session.status !== 'recording') return;
      touchSession(session);

      try {
        // Get currently focused element's selector before typing
        const focusedInfo = await session.page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return null;
          const tagName = el.tagName || '';
          if (el.id) return { selector: '#' + CSS.escape(el.id), tagName };
          const testId = el.getAttribute('data-testid');
          if (testId) return { selector: '[data-testid="' + testId + '"]', tagName };
          const name = el.getAttribute('name');
          if (name) return { selector: '[name="' + name + '"]', tagName };
          const placeholder = (el as HTMLInputElement).placeholder;
          if (placeholder) return { selector: tagName.toLowerCase() + '[placeholder="' + placeholder.replace(/"/g, '\\"') + '"]', tagName };
          const type = el.getAttribute('type');
          if (type) return { selector: tagName.toLowerCase() + '[type="' + type + '"]', tagName };
          return { selector: tagName.toLowerCase(), tagName };
        });

        await session.page.keyboard.type(text);
        session.dirty = true;

        const action: RecordingSession['actions'][number] = {
          action: 'fill',
          selector: focusedInfo?.selector || '',
          value: text,
          tagName: focusedInfo?.tagName || '',
          timestamp: Date.now(),
        };
        session.actions.push(action);
        socketIO.to(`recording:${sessionId}`).emit('recording:action', action);
      } catch (err) {
        logger.error({ err }, '[RECORDER] Type error');
      }
    });

    // Handle keypress events (with modifier key support)
    socket.on('recording:keypress', async (data: { sessionId: string; key: string; code?: string; ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean; metaKey?: boolean }) => {
      const { sessionId } = data;
      const session = recordingSessions.get(sessionId);
      if (!session || !session.page || session.status !== 'recording') return;
      touchSession(session);

      try {
        // Build Playwright key descriptor with modifiers
        let keyCombo = '';
        if (data.ctrlKey || data.metaKey) keyCombo += 'Control+';
        if (data.shiftKey) keyCombo += 'Shift+';
        if (data.altKey) keyCombo += 'Alt+';
        keyCombo += data.key;

        await session.page.keyboard.press(keyCombo);
        session.dirty = true;

        const action: RecordingSession['actions'][number] = {
          action: 'keypress',
          value: keyCombo,
          timestamp: Date.now(),
        };
        session.actions.push(action);
        socketIO.to(`recording:${sessionId}`).emit('recording:action', action);
      } catch (err) {
        logger.error({ err }, '[RECORDER] Keypress error');
      }
    });

    // Handle scroll events - now records the action
    socket.on('recording:scroll', async (data: { sessionId: string; deltaX: number; deltaY: number }) => {
      const { sessionId, deltaX, deltaY } = data;
      const session = recordingSessions.get(sessionId);
      if (!session || !session.page || session.status !== 'recording') return;
      touchSession(session);

      try {
        await session.page.mouse.wheel(deltaX, deltaY);
        session.dirty = true;

        // Record significant scrolls (debounce small movements)
        if (Math.abs(deltaY) > 50 || Math.abs(deltaX) > 50) {
          const action: RecordingSession['actions'][number] = {
            action: 'scroll',
            value: JSON.stringify({ x: deltaX, y: deltaY }),
            timestamp: Date.now(),
          };
          session.actions.push(action);
          socketIO.to(`recording:${sessionId}`).emit('recording:action', action);
          logger.info(`[RECORDER] Scroll delta (${deltaX}, ${deltaY})`);
        }
      } catch (err) {
        logger.error({ err }, '[RECORDER] Scroll error');
      }
    });

    // Handle hover events for dropdown menus and hover states
    socket.on('recording:hover', async (data: { sessionId: string; x: number; y: number }) => {
      const { sessionId, x, y } = data;
      const session = recordingSessions.get(sessionId);
      if (!session || !session.page || session.status !== 'recording') return;
      touchSession(session);

      try {
        const elementInfo = await session.page.evaluate(generateSelectorScript(x, y)) as ElementInfo | null;
        await session.page.mouse.move(x, y);
        session.dirty = true;

        const action: RecordingSession['actions'][number] = {
          action: 'hover',
          selector: elementInfo?.selector || `hover(${x}, ${y})`,
          selectorStrategies: elementInfo?.selectorStrategies || [],
          tagName: elementInfo?.tagName || '',
          text: elementInfo?.text || '',
          timestamp: Date.now(),
        };
        session.actions.push(action);
        socketIO.to(`recording:${sessionId}`).emit('recording:action', action);
        logger.info(`[RECORDER] Hover at (${x}, ${y}) -> ${elementInfo?.selector || 'unknown'}`);
      } catch (err) {
        logger.error({ err }, '[RECORDER] Hover error');
      }
    });

    // Handle select/dropdown events
    socket.on('recording:select', async (data: { sessionId: string; x: number; y: number; value: string }) => {
      const { sessionId, x, y, value } = data;
      const session = recordingSessions.get(sessionId);
      if (!session || !session.page || session.status !== 'recording') return;
      touchSession(session);

      try {
        const elementInfo = await session.page.evaluate(generateSelectorScript(x, y)) as ElementInfo | null;

        const action: RecordingSession['actions'][number] = {
          action: 'select',
          selector: elementInfo?.selector || '',
          value,
          tagName: 'SELECT',
          timestamp: Date.now(),
        };
        session.actions.push(action);
        socketIO.to(`recording:${sessionId}`).emit('recording:action', action);
        logger.info(`[RECORDER] Select at (${x}, ${y}) -> ${value}`);
      } catch (err) {
        logger.error({ err }, '[RECORDER] Select error');
      }
    });

    // Handle navigate events
    socket.on('recording:navigate', async (data: { sessionId: string; url: string }) => {
      const { sessionId, url } = data;
      const session = recordingSessions.get(sessionId);
      if (!session || !session.page || session.status !== 'recording') return;
      touchSession(session);

      try {
        await session.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        session.dirty = true;

        const action: RecordingSession['actions'][number] = {
          action: 'navigate',
          url,
          timestamp: Date.now(),
        };
        session.actions.push(action);
        socketIO.to(`recording:${sessionId}`).emit('recording:action', action);
        logger.info(`[RECORDER] Navigated to: ${url}`);
      } catch (err) {
        logger.error({ err }, '[RECORDER] Navigate error');
      }
    });
  });
}

/**
 * Start screenshot streaming for a session
 */
function startScreenshotStreaming(session: RecordingSession) {
  if (!session.page || !io) return;

  // Take an initial screenshot immediately
  let lastScreenshotHash = '';

  const takeScreenshot = async () => {
    if (!session.page || session.status !== 'recording') {
      if (session.screenshotInterval) {
        clearTimeout(session.screenshotInterval);
        session.screenshotInterval = null;
      }
      return;
    }

    try {
      // Only send if dirty or first frame
      const screenshot = await session.page.screenshot({
        type: 'jpeg',
        quality: 60,
      });

      const base64 = screenshot.toString('base64');

      // Simple dirty check - compare first few bytes
      const quickHash = base64.slice(0, 100);
      if (quickHash !== lastScreenshotHash || session.dirty) {
        lastScreenshotHash = quickHash;
        session.dirty = false;

        const viewport = session.page?.viewportSize() || { width: 1280, height: 720 };
        io!.to(`recording:${session.id}`).emit('recording:frame', {
          base64,
          width: viewport.width,
          height: viewport.height,
          timestamp: Date.now(),
        });
      }
    } catch (err) {
      // Page might be navigating, skip this frame
    }
  };

  // Take first screenshot immediately
  takeScreenshot();

  // Self-scheduling loop: wait 250ms after each screenshot completes to prevent pileup
  const scheduleNext = () => {
    session.screenshotInterval = setTimeout(async () => {
      await takeScreenshot();
      if (session.status === 'recording' && session.page) {
        scheduleNext();
      }
    }, 250) as unknown as ReturnType<typeof setInterval>;
  };
  scheduleNext();
}

/**
 * Clean up a recording session
 */
async function cleanupSession(session: RecordingSession) {
  if (session.screenshotInterval) {
    clearTimeout(session.screenshotInterval);
    session.screenshotInterval = null;
  }

  try {
    if (session.page) {
      await session.page.close().catch(() => {});
    }
    if (session.context) {
      await session.context.close().catch(() => {});
    }
    if (session.browser) {
      await session.browser.close().catch(() => {});
    }
  } catch (err) {
    logger.error({ err, sessionId: session.id }, '[RECORDER] Cleanup error for session');
  }

  session.page = null;
  session.context = null;
  session.browser = null;
}

/**
 * Register recording routes
 */
export async function recordingRoutes(app: FastifyInstance) {
  // Start recording session - launches Playwright browser and starts streaming
  app.post<{
    Body: { target_url: string; suite_id: string; device_config?: TestDeviceConfig };
  }>('/api/v1/recording/start', {
    preHandler: [authenticate],
    preValidation: [validateBody(startRecordingBodySchema)],
  }, async (request, reply) => {
    const { target_url, suite_id, device_config } = request.body;
    const user = request.user as JwtPayload;
    const orgId = getOrganizationId(request);

    // Validate suite exists
    const suite = await getTestSuite(suite_id);
    if (!suite) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test suite not found');
    }

    // Validate URL
    try {
      new URL(target_url);
    } catch {
      return sendError(reply, 400, 'BAD_REQUEST', 'Invalid target URL');
    }

    // Check max concurrent recording sessions limit
    const activeSessionCount = Array.from(recordingSessions.values()).filter(s => s.status === 'recording').length;
    if (activeSessionCount >= MAX_RECORDING_SESSIONS) {
      return sendError(reply, 429, 'RATE_LIMITED', `Maximum concurrent recording sessions (${MAX_RECORDING_SESSIONS}) reached. Please stop an existing recording first.`);
    }

    const sessionId = `rec-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    // Create recording session
    const session: RecordingSession = {
      id: sessionId,
      organization_id: orgId,
      user_id: user.id,
      suite_id,
      target_url,
      status: 'recording',
      actions: [{ action: 'navigate', url: target_url, timestamp: Date.now() }],
      created_at: new Date(),
      lastActivity: Date.now(),
      browser: null,
      context: null,
      page: null,
      screenshotInterval: null,
      dirty: true,
      // Feature #36: Store device config for later reference
      device_config,
    };

    recordingSessions.set(sessionId, session);

    // Launch Playwright browser asynchronously
    try {
      logger.info(`[RECORDER] Launching Playwright browser for session ${sessionId}...`);

      const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });

      // Feature #36: Resolve device config for mobile/tablet emulation
      const resolvedDevice = device_config ? resolveDeviceConfig(device_config) : null;

      // Build context options with optional device emulation
      const contextOptions: BrowserContextOptions = {
        viewport: resolvedDevice
          ? { width: resolvedDevice.viewport.width, height: resolvedDevice.viewport.height }
          : { width: 1280, height: 720 },
        userAgent: resolvedDevice
          ? resolvedDevice.userAgent
          : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      };

      // Apply device emulation settings if configured
      // Feature #fix: Skip isMobile for Firefox — Playwright's Firefox doesn't support it
      if (resolvedDevice) {
        contextOptions.deviceScaleFactor = resolvedDevice.deviceScaleFactor;
        if (browser.browserType().name() !== 'firefox') {
          contextOptions.isMobile = resolvedDevice.isMobile;
        }
        contextOptions.hasTouch = resolvedDevice.hasTouch;
        logger.info(`[RECORDER] Device emulation enabled: ${resolvedDevice.displayName} (${resolvedDevice.viewport.width}x${resolvedDevice.viewport.height}, mobile=${resolvedDevice.isMobile}, touch=${resolvedDevice.hasTouch}, firefox-safe=${browser.browserType().name() === 'firefox'})`);
      }

      const context = await browser.newContext(contextOptions);

      const page = await context.newPage();

      // Navigate to target URL
      await page.goto(target_url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      session.browser = browser;
      session.context = context;
      session.page = page;

      // Detect browser crashes and disconnects
      page.on('crash', () => {
        logger.error({ sessionId }, '[RECORDER] Page crashed during recording');
        session.status = 'error';
        if (io) {
          io.to(`recording:${sessionId}`).emit('recording:error', {
            sessionId,
            error: 'Browser page crashed. Please start a new recording.',
          });
        }
        cleanupSession(session);
        recordingSessions.delete(sessionId);
      });

      browser.on('disconnected', () => {
        logger.error({ sessionId }, '[RECORDER] Browser disconnected during recording');
        session.status = 'error';
        if (io) {
          io.to(`recording:${sessionId}`).emit('recording:error', {
            sessionId,
            error: 'Browser disconnected. Please start a new recording.',
          });
        }
        // Don't call cleanupSession — browser is already gone
        if (session.screenshotInterval) {
          clearTimeout(session.screenshotInterval);
          session.screenshotInterval = null;
        }
        session.page = null;
        session.context = null;
        session.browser = null;
        recordingSessions.delete(sessionId);
      });

      // Listen for page navigation events to auto-record
      page.on('framenavigated', (frame) => {
        if (frame === page.mainFrame()) {
          session.dirty = true;
          const url = frame.url();
          // Only record if different from last navigate action
          const lastNav = session.actions.filter(a => a.action === 'navigate').pop();
          if (!lastNav || lastNav.url !== url) {
            const action = { action: 'navigate', url, timestamp: Date.now() };
            session.actions.push(action);
            if (io) {
              io.to(`recording:${sessionId}`).emit('recording:action', action);
            }
          }
          // Feature #28: Always emit current URL for URL bar sync
          if (io) {
            io.to(`recording:${sessionId}`).emit('recording:url', { sessionId, url });
          }
        }
      });

      // Start screenshot streaming
      startScreenshotStreaming(session);

      logger.info(`[RECORDER] Started recording session ${sessionId} for URL: ${target_url}`);
    } catch (err) {
      logger.error({ err, sessionId }, '[RECORDER] Failed to launch browser for session');
      session.status = 'error';
      await cleanupSession(session);

      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', `Failed to launch browser: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    return {
      session_id: sessionId,
      message: 'Recording started. Live browser view streaming via Socket.IO.',
    };
  });

  // Get recording session actions (polled by frontend as fallback)
  app.get<{
    Params: { sessionId: string };
  }>('/api/v1/recording/:sessionId/actions', {
    preHandler: [authenticate],
    preValidation: [validateParams(recordingIdParamsSchema)],
  }, async (request, reply) => {
    const { sessionId } = request.params;
    const orgId = getOrganizationId(request);

    const session = recordingSessions.get(sessionId);
    if (!session) {
      return sendError(reply, 404, 'NOT_FOUND', 'Recording session not found');
    }

    // Verify organization ownership
    if (session.organization_id !== orgId) {
      return sendError(reply, 403, 'FORBIDDEN', 'You do not have access to this recording session');
    }

    return {
      session_id: sessionId,
      status: session.status,
      actions: session.actions,
    };
  });

  // Stop recording session
  app.post<{
    Params: { sessionId: string };
  }>('/api/v1/recording/:sessionId/stop', {
    preHandler: [authenticate],
    preValidation: [validateParams(recordingIdParamsSchema), validateBody(stopRecordingBodySchema)],
  }, async (request, reply) => {
    const { sessionId } = request.params;
    const orgId = getOrganizationId(request);

    const session = recordingSessions.get(sessionId);
    if (!session) {
      return sendError(reply, 404, 'NOT_FOUND', 'Recording session not found');
    }

    // Verify organization ownership
    if (session.organization_id !== orgId) {
      return sendError(reply, 403, 'FORBIDDEN', 'You do not have access to this recording session');
    }

    session.status = 'stopped';

    // Notify connected clients
    if (io) {
      io.to(`recording:${sessionId}`).emit('recording:stopped', {
        sessionId,
        actions: session.actions,
      });
    }

    // Cleanup browser resources
    await cleanupSession(session);

    logger.info(`[RECORDER] Stopped recording session ${sessionId}. Actions: ${session.actions.length}`);

    return {
      session_id: sessionId,
      status: 'stopped',
      actions: session.actions,
      message: `Recording stopped. Captured ${session.actions.length} action(s).`,
    };
  });

  // Keep the proxy browse endpoint for backwards compatibility but redirect to new approach
  app.get<{
    Params: { sessionId: string };
    Querystring: { url: string };
  }>('/api/v1/recording/:sessionId/browse', async (request, reply) => {
    return sendError(reply, 410, 'ERROR', 'Proxy-based recording has been replaced with live browser streaming. Please use the updated recording UI.');
  });

  // Keep action endpoint for backwards compatibility
  app.post<{
    Params: { sessionId: string };
    Body: Record<string, unknown>;
  }>('/api/v1/recording/:sessionId/action', async (request, reply) => {
    const { sessionId } = request.params;
    const session = recordingSessions.get(sessionId);
    if (!session) {
      return sendError(reply, 404, 'NOT_FOUND', 'Session not found');
    }
    // Allow CORS
    reply.header('Access-Control-Allow-Origin', '*');
    return { ok: true, message: 'Use Socket.IO events for recording control' };
  });

  // CORS preflight for action endpoint
  app.options<{
    Params: { sessionId: string };
  }>('/api/v1/recording/:sessionId/action', async (request, reply) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type');
    return reply.status(204).send();
  });
}

// Export the recording sessions map for testing/debugging
export { recordingSessions, RecordingSession, cleanupAllSessions, disconnectTimers, socketSessionMap };
