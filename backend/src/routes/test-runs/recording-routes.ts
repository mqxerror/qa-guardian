/**
 * Recording Routes Module
 * Feature #1356: Extracted from test-runs.ts for code quality
 *
 * Proxy-based Visual Test Recorder:
 * Instead of launching a headless browser (which users can't interact with),
 * this uses a reverse proxy approach. The target site is proxied through the
 * backend with a recording script injected into HTML responses. Users interact
 * with the site in their own browser via a new tab.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate, getOrganizationId, JwtPayload } from '../../middleware/auth';
import { getTestSuite } from '../test-suites';

// Recording session interface - no browser references needed
interface RecordingSession {
  id: string;
  organization_id: string;
  user_id: string;
  suite_id: string;
  target_url: string;
  target_origin: string;
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
  // Store cookies from proxied responses for session continuity
  cookies: Record<string, string>;
}

// Store active recording sessions
const recordingSessions: Map<string, RecordingSession> = new Map();

/**
 * Generate the recording script to inject into proxied HTML pages.
 * This script captures user interactions and sends them to the backend.
 */
function generateRecordingScript(sessionId: string, apiBase: string, proxyBase: string, targetOrigin: string): string {
  return `
<script data-qa-recorder="true">
(function() {
  'use strict';
  var SESSION_ID = ${JSON.stringify(sessionId)};
  var API_BASE = ${JSON.stringify(apiBase)};
  var PROXY_BASE = ${JSON.stringify(proxyBase)};
  var TARGET_ORIGIN = ${JSON.stringify(targetOrigin)};

  // Debounce helper
  var inputTimers = {};

  // Send action to backend
  function sendAction(action) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', API_BASE + '/api/v1/recording/' + SESSION_ID + '/action', true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(JSON.stringify(action));
    } catch(e) { console.error('[QA Recorder] Failed to send action:', e); }
  }

  // Generate a CSS selector for an element
  function generateSelector(el) {
    if (!el || !el.tagName) return '';
    if (el.id) return '#' + el.id;
    if (el.getAttribute && el.getAttribute('data-testid')) return '[data-testid="' + el.getAttribute('data-testid') + '"]';
    if (el.getAttribute && el.getAttribute('aria-label')) return '[aria-label="' + el.getAttribute('aria-label') + '"]';
    if (el.name) return '[name="' + el.name + '"]';
    if ((el.tagName === 'BUTTON' || el.tagName === 'A') && el.innerText) {
      var text = el.innerText.trim().slice(0, 50);
      if (text) return el.tagName.toLowerCase() + ':has-text("' + text + '")';
    }
    var tag = el.tagName.toLowerCase();
    var cls = el.className && typeof el.className === 'string' ? el.className.split(' ')[0] : '';
    return cls ? tag + '.' + cls : tag;
  }

  // Resolve a URL to absolute
  function resolveUrl(href) {
    if (!href) return '';
    try {
      return new URL(href, window.location.href).href;
    } catch(e) { return href; }
  }

  // Convert an absolute URL to the proxy URL
  function toProxyUrl(absoluteUrl) {
    return PROXY_BASE + '?url=' + encodeURIComponent(absoluteUrl);
  }

  // Capture click events
  document.addEventListener('click', function(e) {
    var target = e.target;
    // Walk up to find the actual clickable element
    var clickable = target.closest ? target.closest('a, button, [role="button"], input[type="submit"], input[type="button"]') : target;
    var el = clickable || target;

    var rect = el.getBoundingClientRect ? el.getBoundingClientRect() : {};
    sendAction({
      type: 'click',
      selector: generateSelector(el),
      tagName: el.tagName,
      id: el.id || undefined,
      className: (typeof el.className === 'string' ? el.className : '') || undefined,
      text: el.innerText ? el.innerText.trim().slice(0, 50) : undefined,
      position: { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) },
      timestamp: Date.now()
    });

    // Intercept link navigation to route through proxy
    var link = target.closest ? target.closest('a[href]') : null;
    if (link && link.href) {
      var href = resolveUrl(link.getAttribute('href'));
      // Only proxy same-origin or target-origin links
      if (href && (href.startsWith(TARGET_ORIGIN) || href.startsWith(window.location.origin))) {
        // Convert back to target URL if it's a proxy URL
        var targetUrl = href;
        if (href.indexOf(PROXY_BASE) === 0) {
          var params = new URL(href).searchParams;
          targetUrl = params.get('url') || href;
        }
        e.preventDefault();
        e.stopPropagation();
        sendAction({ type: 'navigate', url: targetUrl, timestamp: Date.now() });
        window.location.href = toProxyUrl(targetUrl);
        return;
      }
      // External links - record but allow default behavior
      if (href.startsWith('http')) {
        e.preventDefault();
        e.stopPropagation();
        sendAction({ type: 'navigate', url: href, timestamp: Date.now() });
        window.location.href = toProxyUrl(href);
      }
    }
  }, true);

  // Capture input/fill events (debounced)
  document.addEventListener('input', function(e) {
    var target = e.target;
    var id = target.id || target.name || 'anon';
    clearTimeout(inputTimers[id]);
    inputTimers[id] = setTimeout(function() {
      sendAction({
        type: 'fill',
        selector: generateSelector(target),
        value: target.value,
        tagName: target.tagName,
        id: target.id || undefined,
        name: target.name || undefined,
        timestamp: Date.now()
      });
    }, 500);
  }, true);

  // Capture form submissions
  document.addEventListener('submit', function(e) {
    var form = e.target;
    var action = form.action ? resolveUrl(form.action) : window.location.href;
    sendAction({
      type: 'submit',
      selector: generateSelector(form),
      url: action,
      tagName: 'FORM',
      timestamp: Date.now()
    });
    // For GET forms, intercept and proxy
    if (!form.method || form.method.toUpperCase() === 'GET') {
      e.preventDefault();
      var formData = new FormData(form);
      var params = new URLSearchParams(formData).toString();
      var targetUrl = action + (action.includes('?') ? '&' : '?') + params;
      sendAction({ type: 'navigate', url: targetUrl, timestamp: Date.now() });
      window.location.href = toProxyUrl(targetUrl);
    }
    // POST forms - let them submit naturally (they'll break out of proxy, but that's acceptable for MVP)
  }, true);

  // Show recording indicator overlay
  var indicator = document.createElement('div');
  indicator.id = 'qa-recorder-indicator';
  indicator.innerHTML = '<div style="display:flex;align-items:center;gap:8px;"><span style="display:inline-block;width:12px;height:12px;background:red;border-radius:50%;animation:qa-rec-pulse 1s ease-in-out infinite;"></span><span>QA Guardian Recording</span></div>';
  indicator.style.cssText = 'position:fixed;top:12px;right:12px;z-index:2147483647;background:rgba(0,0,0,0.85);color:white;padding:8px 16px;border-radius:8px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,0.3);cursor:default;user-select:none;';
  var style = document.createElement('style');
  style.textContent = '@keyframes qa-rec-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }';
  document.head.appendChild(style);
  document.body.appendChild(indicator);

  console.log('[QA Recorder] Recording active for session: ' + SESSION_ID);
})();
</script>`;
}

/**
 * Register recording routes
 */
export async function recordingRoutes(app: FastifyInstance) {
  // Start recording session - creates session and returns proxy URL
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
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(target_url);
    } catch {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Invalid target URL',
      });
    }

    const sessionId = `rec-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    // Pre-flight URL check: verify target URL is reachable
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      await fetch(target_url, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'follow',
      }).catch((fetchErr: any) => {
        throw new Error(`Target URL is not reachable: ${target_url} (${fetchErr.message})`);
      });
      clearTimeout(timeout);
    } catch (preflightErr: any) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: preflightErr.message?.includes('Target URL is not reachable')
          ? preflightErr.message
          : `Target URL is not reachable: ${target_url}`,
      });
    }

    // Create recording session (no browser launch!)
    const session: RecordingSession = {
      id: sessionId,
      organization_id: orgId,
      user_id: user.id,
      suite_id,
      target_url,
      target_origin: parsedUrl.origin,
      status: 'recording',
      actions: [{ action: 'navigate', url: target_url, timestamp: Date.now() }],
      created_at: new Date(),
      cookies: {},
    };

    recordingSessions.set(sessionId, session);

    // Build the proxy URL that the frontend will open in a new tab
    const protocol = request.headers['x-forwarded-proto'] || request.protocol || 'http';
    const host = request.headers['x-forwarded-host'] || request.headers.host || 'localhost';
    const proxyUrl = `${protocol}://${host}/api/v1/recording/${sessionId}/browse?url=${encodeURIComponent(target_url)}`;

    console.log(`[RECORDER] Started proxy recording session ${sessionId} for URL: ${target_url}`);

    return {
      session_id: sessionId,
      proxy_url: proxyUrl,
      message: 'Recording started. Open the proxy URL in a new tab to interact with the site.',
    };
  });

  // Proxy browse endpoint - serves the target site with recording script injected
  app.get<{
    Params: { sessionId: string };
    Querystring: { url: string };
  }>('/api/v1/recording/:sessionId/browse', async (request, reply) => {
    const { sessionId } = request.params;
    const targetUrl = request.query.url;

    const session = recordingSessions.get(sessionId);
    if (!session) {
      return reply.status(404).send('<html><body><h1>Recording session not found</h1><p>This recording session has expired or does not exist.</p></body></html>');
    }

    if (session.status !== 'recording') {
      return reply.status(400).send('<html><body><h1>Recording stopped</h1><p>This recording session has ended. You can close this tab.</p></body></html>');
    }

    if (!targetUrl) {
      return reply.status(400).send('<html><body><h1>Missing URL</h1><p>No target URL specified.</p></body></html>');
    }

    try {
      // Build cookie header from stored cookies
      const cookieHeader = Object.entries(session.cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');

      // Fetch the target URL
      const fetchHeaders: Record<string, string> = {
        'User-Agent': request.headers['user-agent'] || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': request.headers.accept as string || 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': request.headers['accept-language'] as string || 'en-US,en;q=0.9',
      };
      if (cookieHeader) {
        fetchHeaders['Cookie'] = cookieHeader;
      }

      const response = await fetch(targetUrl, {
        headers: fetchHeaders,
        redirect: 'follow',
      });

      // Store any Set-Cookie headers
      const setCookies = response.headers.getSetCookie?.() || [];
      for (const cookie of setCookies) {
        const [nameVal] = cookie.split(';');
        const [name, ...valParts] = nameVal.split('=');
        if (name && valParts.length > 0) {
          session.cookies[name.trim()] = valParts.join('=').trim();
        }
      }

      const contentType = response.headers.get('content-type') || '';

      // For non-HTML content, pipe through directly
      if (!contentType.includes('text/html')) {
        // Set appropriate headers
        reply.header('Content-Type', contentType);
        const cacheControl = response.headers.get('cache-control');
        if (cacheControl) reply.header('Cache-Control', cacheControl);

        const buffer = Buffer.from(await response.arrayBuffer());
        return reply.send(buffer);
      }

      // For HTML content: inject recording script
      let html = await response.text();

      // Determine the base URL for resolving relative resources
      const parsedTarget = new URL(targetUrl);
      const baseUrl = parsedTarget.origin + parsedTarget.pathname.replace(/\/[^/]*$/, '/');

      // Build the proxy base for the recording script
      const protocol = request.headers['x-forwarded-proto'] || request.protocol || 'http';
      const host = request.headers['x-forwarded-host'] || request.headers.host || 'localhost';
      const apiBase = `${protocol}://${host}`;
      const proxyBase = `${apiBase}/api/v1/recording/${sessionId}/browse`;

      // Add <base> tag for resolving relative resource URLs (CSS, JS, images)
      // This makes relative URLs load directly from the target site
      if (!html.includes('<base')) {
        html = html.replace(/<head([^>]*)>/i, `<head$1><base href="${baseUrl}">`);
      }

      // Strip Content-Security-Policy so our recording script can execute
      // (we'll set relaxed headers on the response)

      // Inject the recording script before </body> or at end of HTML
      const recordingScript = generateRecordingScript(sessionId, apiBase, proxyBase, parsedTarget.origin);
      if (html.includes('</body>')) {
        html = html.replace('</body>', recordingScript + '</body>');
      } else {
        html += recordingScript;
      }

      // Send modified HTML with relaxed security headers
      reply.header('Content-Type', 'text/html; charset=utf-8');
      // Remove CSP and frame restrictions so recording script works
      reply.header('Content-Security-Policy', "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;");
      reply.header('X-Frame-Options', 'ALLOWALL');
      reply.removeHeader('X-Content-Type-Options');

      return reply.send(html);
    } catch (err) {
      console.error(`[RECORDER] Proxy error for session ${sessionId}:`, err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      return reply.status(502).send(
        `<html><body>
          <h1>Failed to load page</h1>
          <p>Could not fetch the target URL: ${targetUrl}</p>
          <p>Error: ${errorMessage}</p>
          <p><a href="javascript:history.back()">Go back</a></p>
        </body></html>`
      );
    }
  });

  // Receive actions from injected recording script (no auth - sessionId is the token)
  app.post<{
    Params: { sessionId: string };
    Body: {
      type: string;
      selector?: string;
      value?: string;
      url?: string;
      text?: string;
      tagName?: string;
      id?: string;
      name?: string;
      className?: string;
      position?: { x: number; y: number };
      timestamp: number;
    };
  }>('/api/v1/recording/:sessionId/action', async (request, reply) => {
    const { sessionId } = request.params;
    const actionData = request.body;

    const session = recordingSessions.get(sessionId);
    if (!session) {
      return reply.status(404).send({ error: 'Session not found' });
    }

    if (session.status !== 'recording') {
      return reply.status(400).send({ error: 'Session is not recording' });
    }

    // Add action to session
    session.actions.push({
      action: actionData.type,
      selector: actionData.selector,
      value: actionData.value,
      url: actionData.url,
      text: actionData.text,
      tagName: actionData.tagName,
      id: actionData.id,
      name: actionData.name,
      className: actionData.className,
      timestamp: actionData.timestamp || Date.now(),
    });

    // Allow CORS from the proxy page
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type');

    return { ok: true, count: session.actions.length };
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

  // Get recording session actions (polled by frontend)
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

    console.log(`[RECORDER] Stopped recording session ${sessionId}. Actions: ${session.actions.length}`);

    return {
      session_id: sessionId,
      status: 'stopped',
      actions: session.actions,
      message: `Recording stopped. Captured ${session.actions.length} action(s).`,
    };
  });
}

// Export the recording sessions map for testing/debugging
export { recordingSessions, RecordingSession };
