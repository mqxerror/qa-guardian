/**
 * Recording Routes Module
 * Feature #1356: Extracted from test-runs.ts for code quality
 *
 * Visual Test Recorder endpoints for capturing user interactions
 * and generating test scripts from browser sessions.
 */

import { FastifyInstance } from 'fastify';
import { authenticate, getOrganizationId, JwtPayload } from '../../middleware/auth';
import { testSuites } from '../test-suites';
import { chromium, Browser, Page, BrowserContext } from 'playwright';

// Recording session interface
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
  browser: Browser | null;
  context: BrowserContext | null;
  page: Page | null;
  created_at: Date;
}

// Store active recording sessions
const recordingSessions: Map<string, RecordingSession> = new Map();

// Generate unique CSS selector for an element
function generateSelector(element: any): string {
  // Try to use id first
  if (element.id) {
    return `#${element.id}`;
  }
  // Try to use data-testid
  if (element.dataset?.testid) {
    return `[data-testid="${element.dataset.testid}"]`;
  }
  // Try to use aria-label
  if (element.ariaLabel) {
    return `[aria-label="${element.ariaLabel}"]`;
  }
  // Try to use name attribute for form elements
  if (element.name) {
    return `[name="${element.name}"]`;
  }
  // Try to use text content for buttons/links
  if (element.tagName === 'BUTTON' || element.tagName === 'A') {
    const text = element.innerText?.trim().slice(0, 50);
    if (text) {
      return `${element.tagName.toLowerCase()}:has-text("${text}")`;
    }
  }
  // Fallback to tag with class
  const tag = element.tagName?.toLowerCase() || 'div';
  const className = element.className?.split(' ')[0];
  if (className) {
    return `${tag}.${className}`;
  }
  return tag;
}

/**
 * Register recording routes
 */
export async function recordingRoutes(app: FastifyInstance) {
  // Start recording session
  app.post<{
    Body: { target_url: string; suite_id: string };
  }>('/api/v1/recording/start', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { target_url, suite_id } = request.body;
    const user = request.user as JwtPayload;
    const orgId = getOrganizationId(request);

    // Validate suite exists
    const suite = testSuites.get(suite_id);
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

    try {
      // Launch browser in headful mode so user can interact
      const browser = await chromium.launch({
        headless: false,
        args: ['--start-maximized'],
      });

      const context = await browser.newContext({
        viewport: null, // Use full window
      });

      const page = await context.newPage();

      // Create recording session
      const session: RecordingSession = {
        id: sessionId,
        organization_id: orgId,
        user_id: user.userId,
        suite_id,
        target_url,
        status: 'recording',
        actions: [{ action: 'navigate', url: target_url, timestamp: Date.now() }],
        browser,
        context,
        page,
        created_at: new Date(),
      };

      recordingSessions.set(sessionId, session);

      // Navigate to target URL
      await page.goto(target_url);

      // Inject recording script to capture user actions
      await page.addInitScript(() => {
        // Create a channel to send actions back to the server
        (window as any).__recordedActions = [];

        // Capture click events
        document.addEventListener('click', (e) => {
          const target = e.target as HTMLElement;
          const rect = target.getBoundingClientRect();
          const action = {
            type: 'click',
            selector: generateElementSelector(target),
            tagName: target.tagName,
            id: target.id,
            className: target.className,
            text: target.innerText?.trim().slice(0, 50),
            ariaLabel: target.getAttribute('aria-label'),
            dataTestId: target.getAttribute('data-testid'),
            xpath: generateXPath(target),
            cssSelector: generateCssSelector(target),
            position: { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) },
            timestamp: Date.now(),
          };
          (window as any).__recordedActions.push(action);
          console.log('[RECORDER] Click:', action);
        }, true);

        // Capture input events (debounced)
        let inputTimer: any = null;
        document.addEventListener('input', (e) => {
          const target = e.target as HTMLInputElement;
          clearTimeout(inputTimer);
          inputTimer = setTimeout(() => {
            const rect = target.getBoundingClientRect();
            const action = {
              type: 'fill',
              selector: generateElementSelector(target),
              value: target.value,
              tagName: target.tagName,
              id: target.id,
              name: target.name,
              className: target.className,
              ariaLabel: target.getAttribute('aria-label'),
              dataTestId: target.getAttribute('data-testid'),
              xpath: generateXPath(target),
              cssSelector: generateCssSelector(target),
              position: { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) },
              timestamp: Date.now(),
            };
            (window as any).__recordedActions.push(action);
            console.log('[RECORDER] Fill:', action);
          }, 500);
        }, true);

        // Helper function to generate selector
        function generateElementSelector(el: HTMLElement): string {
          if (el.id) return `#${el.id}`;
          if (el.getAttribute('data-testid')) return `[data-testid="${el.getAttribute('data-testid')}"]`;
          if (el.getAttribute('aria-label')) return `[aria-label="${el.getAttribute('aria-label')}"]`;
          if ((el as HTMLInputElement).name) return `[name="${(el as HTMLInputElement).name}"]`;
          if ((el.tagName === 'BUTTON' || el.tagName === 'A') && el.innerText?.trim()) {
            return `${el.tagName.toLowerCase()}:has-text("${el.innerText.trim().slice(0, 50)}")`;
          }
          const tag = el.tagName.toLowerCase();
          const cls = el.className?.split(' ')[0];
          return cls ? `${tag}.${cls}` : tag;
        }

        // Feature #1049: Generate XPath for element
        function generateXPath(el: HTMLElement): string {
          const parts: string[] = [];
          let current: HTMLElement | null = el;
          while (current && current.nodeType === Node.ELEMENT_NODE) {
            let index = 1;
            let sibling = current.previousElementSibling;
            while (sibling) {
              if (sibling.tagName === current.tagName) index++;
              sibling = sibling.previousElementSibling;
            }
            const tag = current.tagName.toLowerCase();
            parts.unshift(index > 1 ? `${tag}[${index}]` : tag);
            current = current.parentElement;
          }
          return '/' + parts.join('/');
        }

        // Feature #1049: Generate CSS selector for element
        function generateCssSelector(el: HTMLElement): string {
          if (el.id) return `#${el.id}`;
          const parts: string[] = [];
          let current: HTMLElement | null = el;
          while (current && current.nodeType === Node.ELEMENT_NODE && current.tagName !== 'HTML') {
            let selector = current.tagName.toLowerCase();
            if (current.id) {
              selector = `#${current.id}`;
              parts.unshift(selector);
              break;
            }
            if (current.className) {
              const classes = current.className.split(' ').filter(c => c.trim()).slice(0, 2);
              if (classes.length) selector += '.' + classes.join('.');
            }
            let index = 1;
            let sibling = current.previousElementSibling;
            while (sibling) {
              if (sibling.tagName === current.tagName) index++;
              sibling = sibling.previousElementSibling;
            }
            if (index > 1) selector += `:nth-of-type(${index})`;
            parts.unshift(selector);
            current = current.parentElement;
          }
          return parts.join(' > ');
        }
      });

      // Setup listeners to collect recorded actions
      page.on('framenavigated', async (frame) => {
        if (frame === page.mainFrame()) {
          const url = frame.url();
          const session = recordingSessions.get(sessionId);
          if (session && session.status === 'recording') {
            // Don't add duplicate navigate events
            const lastAction = session.actions[session.actions.length - 1];
            if (lastAction?.action !== 'navigate' || lastAction.url !== url) {
              session.actions.push({ action: 'navigate', url, timestamp: Date.now() });
            }
          }
        }
      });

      // Handle browser disconnect
      browser.on('disconnected', () => {
        console.log(`[RECORDER] Browser disconnected for session ${sessionId}`);
        const session = recordingSessions.get(sessionId);
        if (session) {
          session.status = 'stopped';
        }
      });

      console.log(`[RECORDER] Started recording session ${sessionId} for URL: ${target_url}`);

      return {
        session_id: sessionId,
        message: 'Recording started. Interact with the browser to record actions.',
      };
    } catch (err) {
      console.error('[RECORDER] Failed to start recording:', err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to start recording session',
      });
    }
  });

  // Get recording session actions
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

    try {
      // Collect any remaining actions from the page before closing
      if (session.page) {
        try {
          const pageActions = await session.page.evaluate(() => {
            const actions = (window as any).__recordedActions || [];
            (window as any).__recordedActions = [];
            return actions;
          });

          for (const action of pageActions) {
            session.actions.push({
              action: action.type,
              selector: action.selector,
              value: action.value,
              text: action.text,
              timestamp: action.timestamp,
            });
          }
        } catch (err) {
          // Page may have closed
        }
      }

      // Close browser
      if (session.browser) {
        await session.browser.close();
      }

      session.status = 'stopped';
      session.browser = null;
      session.context = null;
      session.page = null;

      console.log(`[RECORDER] Stopped recording session ${sessionId}. Actions: ${session.actions.length}`);

      return {
        session_id: sessionId,
        status: 'stopped',
        actions: session.actions,
        message: `Recording stopped. Captured ${session.actions.length} action(s).`,
      };
    } catch (err) {
      console.error('[RECORDER] Error stopping session:', err);
      session.status = 'error';
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to stop recording session',
      });
    }
  });

  // Perform a click action in the recording session (for testing/automation)
  app.post<{
    Params: { sessionId: string };
    Body: { selector: string };
  }>('/api/v1/recording/:sessionId/perform-click', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { sessionId } = request.params;
    const { selector } = request.body;
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

    if (session.status !== 'recording' || !session.page) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Recording session is not active',
      });
    }

    try {
      // Get element info before clicking
      const elementInfo = await session.page.evaluate((sel: string) => {
        const el = document.querySelector(sel) as HTMLElement;
        if (!el) return null;
        return {
          tagName: el.tagName.toLowerCase(),
          id: el.id || undefined,
          className: el.className || undefined,
          text: el.innerText?.trim().slice(0, 50) || undefined,
        };
      }, selector);

      // Perform the click on the page
      await session.page.click(selector, { timeout: 5000 });

      // Manually add the click action to the session's actions array
      session.actions.push({
        action: 'click',
        selector: selector,
        tagName: elementInfo?.tagName,
        id: elementInfo?.id,
        className: elementInfo?.className,
        text: elementInfo?.text,
        timestamp: Date.now(),
      });

      console.log(`[RECORDER] Performed click on "${selector}" in session ${sessionId}`);

      return {
        success: true,
        message: `Clicked element: ${selector}`,
      };
    } catch (err) {
      console.error('[RECORDER] Failed to perform click:', err);
      return reply.status(400).send({
        error: 'Bad Request',
        message: `Failed to click element: ${(err as Error).message}`,
      });
    }
  });

  // Perform a fill/type action in the recording session (for testing/automation)
  app.post<{
    Params: { sessionId: string };
    Body: { selector: string; text: string };
  }>('/api/v1/recording/:sessionId/perform-fill', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { sessionId } = request.params;
    const { selector, text } = request.body;
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

    if (session.status !== 'recording' || !session.page) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Recording session is not active',
      });
    }

    try {
      // Get element info before filling
      const elementInfo = await session.page.evaluate((sel: string) => {
        const el = document.querySelector(sel) as HTMLInputElement;
        if (!el) return null;
        return {
          tagName: el.tagName.toLowerCase(),
          id: el.id || undefined,
          name: el.name || undefined,
          type: el.type || undefined,
          placeholder: el.placeholder || undefined,
        };
      }, selector);

      // Perform the fill on the page
      await session.page.fill(selector, text, { timeout: 5000 });

      // Manually add the fill action to the session's actions array
      session.actions.push({
        action: 'fill',
        selector: selector,
        value: text,
        tagName: elementInfo?.tagName,
        id: elementInfo?.id,
        name: elementInfo?.name,
        timestamp: Date.now(),
      });

      console.log(`[RECORDER] Performed fill on "${selector}" with text "${text}" in session ${sessionId}`);

      return {
        success: true,
        message: `Filled element: ${selector} with text: ${text}`,
      };
    } catch (err) {
      console.error('[RECORDER] Failed to perform fill:', err);
      return reply.status(400).send({
        error: 'Bad Request',
        message: `Failed to fill element: ${(err as Error).message}`,
      });
    }
  });
}

// Export the recording sessions map for testing/debugging
export { recordingSessions, RecordingSession };
