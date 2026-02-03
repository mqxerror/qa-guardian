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
import { authenticate, getOrganizationId, JwtPayload } from '../../middleware/auth';
import { getTestSuite } from '../test-suites';
import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { Server as SocketIOServer, Socket } from 'socket.io';

// Recording session interface with Playwright browser references
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
    value?: string;
    url?: string;
    text?: string;
    tagName?: string;
    id?: string;
    name?: string;
    className?: string;
    timestamp: number;
  }>;
  created_at: Date;
  browser: Browser | null;
  context: BrowserContext | null;
  page: Page | null;
  screenshotInterval: ReturnType<typeof setInterval> | null;
  dirty: boolean; // Flag to track if page content changed
}

// Store active recording sessions
const recordingSessions: Map<string, RecordingSession> = new Map();

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
 * Generate a CSS selector for the element at given coordinates
 */
function generateSelectorScript(x: number, y: number): string {
  return `
    (() => {
      let el = document.elementFromPoint(${x}, ${y});
      if (!el) return null;

      // Walk up to find the nearest interactive element
      const interactive = el.closest('a, button, input, select, textarea, [role="button"], [role="link"], [onclick], label');
      if (interactive) el = interactive;

      const tagName = el.tagName || '';
      const text = el.innerText?.trim()?.slice(0, 50) || '';

      // Priority 1: id (skip if it looks auto-generated)
      if (el.id && !/^[:\\\\d]|--/.test(el.id) && el.id.length < 80) {
        return { selector: '#' + CSS.escape(el.id), tagName, text, id: el.id };
      }

      // Priority 2: data-testid
      const testId = el.getAttribute('data-testid');
      if (testId) return { selector: '[data-testid="' + testId.replace(/"/g, '\\\\"') + '"]', tagName, text };

      // Priority 3: aria-label
      const ariaLabel = el.getAttribute('aria-label');
      if (ariaLabel) return { selector: '[aria-label="' + ariaLabel.replace(/"/g, '\\\\"') + '"]', tagName, text };

      // Priority 4: name attribute (form elements)
      const name = el.getAttribute('name');
      if (name) return { selector: '[name="' + name.replace(/"/g, '\\\\"') + '"]', tagName, text, name };

      // Priority 5: role + name for buttons/links
      const role = el.getAttribute('role');
      if ((tagName === 'BUTTON' || tagName === 'A' || role === 'button' || role === 'link') && text) {
        const cleanText = text.replace(/"/g, '\\\\"');
        return { selector: (role || tagName.toLowerCase()) === 'button' ? 'button:has-text("' + cleanText + '")' : 'a:has-text("' + cleanText + '")', tagName, text };
      }

      // Priority 6: input by type + placeholder
      if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
        const type = el.getAttribute('type') || 'text';
        const placeholder = el.getAttribute('placeholder');
        if (placeholder) return { selector: tagName.toLowerCase() + '[placeholder="' + placeholder.replace(/"/g, '\\\\"') + '"]', tagName, text };
        return { selector: tagName.toLowerCase() + '[type="' + type + '"]', tagName, text };
      }

      // Priority 7: Build a specific CSS path (up to 3 levels)
      const parts = [];
      let current = el;
      for (let i = 0; i < 3 && current && current !== document.body; i++) {
        let seg = current.tagName.toLowerCase();
        if (current.id && !/^[:\\\\d]|--/.test(current.id) && current.id.length < 80) {
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
      const cssSelector = parts.join(' > ') || tagName.toLowerCase();
      return { selector: cssSelector, tagName, text, className: typeof el.className === 'string' ? el.className : '' };
    })()
  `;
}

/**
 * Setup Socket.IO event handlers for recording control
 */
function setupRecordingSocketHandlers(socketIO: SocketIOServer) {
  socketIO.on('connection', (socket: Socket) => {
    // Join recording room
    socket.on('recording:join', (data: { sessionId: string }) => {
      const { sessionId } = data;
      socket.join(`recording:${sessionId}`);
      console.log(`[RECORDER] Client ${socket.id} joined recording:${sessionId}`);
    });

    // Leave recording room
    socket.on('recording:leave', (data: { sessionId: string }) => {
      const { sessionId } = data;
      socket.leave(`recording:${sessionId}`);
      console.log(`[RECORDER] Client ${socket.id} left recording:${sessionId}`);
    });

    // Handle click events from frontend
    socket.on('recording:click', async (data: { sessionId: string; x: number; y: number }) => {
      const { sessionId, x, y } = data;
      const session = recordingSessions.get(sessionId);
      if (!session || !session.page || session.status !== 'recording') return;

      try {
        // Get element info before clicking
        const elementInfo = await session.page.evaluate(generateSelectorScript(x, y)) as { selector: string; tagName: string; text: string; id?: string; name?: string; className?: string } | null;

        // Click at coordinates
        await session.page.mouse.click(x, y);
        session.dirty = true;

        // Record the action
        const action: any = {
          action: 'click',
          selector: elementInfo?.selector || `click(${x}, ${y})`,
          tagName: elementInfo?.tagName || '',
          text: elementInfo?.text || '',
          id: elementInfo?.id || '',
          name: elementInfo?.name || '',
          className: elementInfo?.className || '',
          timestamp: Date.now(),
        };
        session.actions.push(action);

        // Emit action to frontend
        socketIO.to(`recording:${sessionId}`).emit('recording:action', action);
        console.log(`[RECORDER] Click at (${x}, ${y}) -> ${elementInfo?.selector || 'unknown'}`);
      } catch (err) {
        console.error(`[RECORDER] Click error:`, err);
      }
    });

    // Handle type events
    socket.on('recording:type', async (data: { sessionId: string; text: string }) => {
      const { sessionId, text } = data;
      const session = recordingSessions.get(sessionId);
      if (!session || !session.page || session.status !== 'recording') return;

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

        const action: any = {
          action: 'fill',
          selector: focusedInfo?.selector || '',
          value: text,
          tagName: focusedInfo?.tagName || '',
          timestamp: Date.now(),
        };
        session.actions.push(action);
        socketIO.to(`recording:${sessionId}`).emit('recording:action', action);
      } catch (err) {
        console.error(`[RECORDER] Type error:`, err);
      }
    });

    // Handle keypress events
    socket.on('recording:keypress', async (data: { sessionId: string; key: string }) => {
      const { sessionId, key } = data;
      const session = recordingSessions.get(sessionId);
      if (!session || !session.page || session.status !== 'recording') return;

      try {
        await session.page.keyboard.press(key);
        session.dirty = true;

        const action: any = {
          action: 'keypress',
          value: key,
          timestamp: Date.now(),
        };
        session.actions.push(action);
        socketIO.to(`recording:${sessionId}`).emit('recording:action', action);
      } catch (err) {
        console.error(`[RECORDER] Keypress error:`, err);
      }
    });

    // Handle scroll events
    socket.on('recording:scroll', async (data: { sessionId: string; deltaX: number; deltaY: number }) => {
      const { sessionId, deltaX, deltaY } = data;
      const session = recordingSessions.get(sessionId);
      if (!session || !session.page || session.status !== 'recording') return;

      try {
        await session.page.mouse.wheel(deltaX, deltaY);
        session.dirty = true;
      } catch (err) {
        console.error(`[RECORDER] Scroll error:`, err);
      }
    });

    // Handle navigate events
    socket.on('recording:navigate', async (data: { sessionId: string; url: string }) => {
      const { sessionId, url } = data;
      const session = recordingSessions.get(sessionId);
      if (!session || !session.page || session.status !== 'recording') return;

      try {
        await session.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        session.dirty = true;

        const action: any = {
          action: 'navigate',
          url,
          timestamp: Date.now(),
        };
        session.actions.push(action);
        socketIO.to(`recording:${sessionId}`).emit('recording:action', action);
        console.log(`[RECORDER] Navigated to: ${url}`);
      } catch (err) {
        console.error(`[RECORDER] Navigate error:`, err);
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
        clearInterval(session.screenshotInterval);
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

        io!.to(`recording:${session.id}`).emit('recording:frame', {
          base64,
          width: 1280,
          height: 720,
          timestamp: Date.now(),
        });
      }
    } catch (err) {
      // Page might be navigating, skip this frame
    }
  };

  // Take first screenshot immediately
  takeScreenshot();

  // Then every 250ms
  session.screenshotInterval = setInterval(takeScreenshot, 250);
}

/**
 * Clean up a recording session
 */
async function cleanupSession(session: RecordingSession) {
  if (session.screenshotInterval) {
    clearInterval(session.screenshotInterval);
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
    console.error(`[RECORDER] Cleanup error for session ${session.id}:`, err);
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
    Body: { target_url: string; suite_id: string };
  }>('/api/v1/recording/start', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { target_url, suite_id } = request.body;
    const user = request.user as JwtPayload;
    const orgId = getOrganizationId(request);

    // Validate suite exists
    const suite = await getTestSuite(suite_id);
    if (!suite) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test suite not found',
      });
    }

    // Validate URL
    try {
      new URL(target_url);
    } catch {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Invalid target URL',
      });
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
      browser: null,
      context: null,
      page: null,
      screenshotInterval: null,
      dirty: true,
    };

    recordingSessions.set(sessionId, session);

    // Launch Playwright browser asynchronously
    try {
      console.log(`[RECORDER] Launching Playwright browser for session ${sessionId}...`);

      const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });

      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });

      const page = await context.newPage();

      // Navigate to target URL
      await page.goto(target_url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      session.browser = browser;
      session.context = context;
      session.page = page;

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

      console.log(`[RECORDER] Started recording session ${sessionId} for URL: ${target_url}`);
    } catch (err) {
      console.error(`[RECORDER] Failed to launch browser for session ${sessionId}:`, err);
      session.status = 'error';
      await cleanupSession(session);

      return reply.status(500).send({
        error: 'Server Error',
        message: `Failed to launch browser: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
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
  }, async (request, reply) => {
    const { sessionId } = request.params;
    const orgId = getOrganizationId(request);

    const session = recordingSessions.get(sessionId);
    if (!session) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Recording session not found',
      });
    }

    // Verify organization ownership
    if (session.organization_id !== orgId) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You do not have access to this recording session',
      });
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
  }, async (request, reply) => {
    const { sessionId } = request.params;
    const orgId = getOrganizationId(request);

    const session = recordingSessions.get(sessionId);
    if (!session) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Recording session not found',
      });
    }

    // Verify organization ownership
    if (session.organization_id !== orgId) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You do not have access to this recording session',
      });
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

    console.log(`[RECORDER] Stopped recording session ${sessionId}. Actions: ${session.actions.length}`);

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
    return reply.status(410).send({
      error: 'Gone',
      message: 'Proxy-based recording has been replaced with live browser streaming. Please use the updated recording UI.',
    });
  });

  // Keep action endpoint for backwards compatibility
  app.post<{
    Params: { sessionId: string };
    Body: any;
  }>('/api/v1/recording/:sessionId/action', async (request, reply) => {
    const { sessionId } = request.params;
    const session = recordingSessions.get(sessionId);
    if (!session) {
      return reply.status(404).send({ error: 'Session not found' });
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
export { recordingSessions, RecordingSession };
