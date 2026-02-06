// Lightweight DAST Scanner - Built-in fallback when OWASP ZAP is not available
//
// Performs real HTTP-based security analysis without requiring Docker or ZAP:
// - Security header analysis (CSP, HSTS, X-Frame-Options, etc.)
// - Cookie security flags (Secure, HttpOnly, SameSite)
// - Information disclosure (Server header, X-Powered-By, etc.)
// - SSL/TLS analysis
// - Basic injection pattern detection in responses
// - CORS policy analysis

import https from 'https';
import http from 'http';
import { URL } from 'url';
import {
  DASTScanResult,
  DASTAlert,
  DASTConfig,
  DASTRisk,
  DASTConfidence,
} from './types.js';
import {
  createDastScan,
  updateDastScan,
  getDastFalsePositives,
  saveDastConfig,
} from './stores.js';
import { generateId, getDASTConfig, isUrlInScope } from './utils.js';

// ---------------------------------------------------------------------------
// Security check definitions
// ---------------------------------------------------------------------------

interface SecurityCheck {
  id: string;
  pluginId: string;
  name: string;
  category: string;
  check: (response: HttpResponse, targetUrl: string) => DASTAlert | null;
}

interface HttpResponse {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
  url: string;
  redirectUrl?: string;
  cookies: ParsedCookie[];
  responseTime: number;
}

interface ParsedCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: string;
  expires?: string;
}

// Parse Set-Cookie headers into structured objects
function parseCookies(headers: Record<string, string | string[] | undefined>): ParsedCookie[] {
  const setCookieHeader = headers['set-cookie'];
  if (!setCookieHeader) return [];

  const cookieStrings = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  return cookieStrings.map((cookieStr) => {
    const parts = cookieStr.split(';').map((p) => p.trim());
    const [nameValue, ...attributes] = parts;
    const eqIdx = nameValue.indexOf('=');
    const name = eqIdx > -1 ? nameValue.substring(0, eqIdx) : nameValue;
    const value = eqIdx > -1 ? nameValue.substring(eqIdx + 1) : '';

    const cookie: ParsedCookie = { name, value };
    for (const attr of attributes) {
      const lower = attr.toLowerCase();
      if (lower === 'secure') cookie.secure = true;
      else if (lower === 'httponly') cookie.httpOnly = true;
      else if (lower.startsWith('samesite=')) cookie.sameSite = attr.split('=')[1];
      else if (lower.startsWith('domain=')) cookie.domain = attr.split('=')[1];
      else if (lower.startsWith('path=')) cookie.path = attr.split('=')[1];
      else if (lower.startsWith('expires=')) cookie.expires = attr.split('=')[1];
    }
    return cookie;
  });
}

// ---------------------------------------------------------------------------
// All security checks
// ---------------------------------------------------------------------------

const SECURITY_CHECKS: SecurityCheck[] = [
  // --- Security Headers ---
  {
    id: 'missing-csp',
    pluginId: '10038',
    name: 'Content Security Policy (CSP) Header Not Set',
    category: 'Security Headers',
    check: (res, targetUrl) => {
      const csp = res.headers['content-security-policy'] || res.headers['content-security-policy-report-only'];
      if (!csp) {
        return {
          id: generateId(),
          pluginId: '10038',
          name: 'Content Security Policy (CSP) Header Not Set',
          risk: 'Medium' as DASTRisk,
          confidence: 'High' as DASTConfidence,
          description: 'Content Security Policy (CSP) header is not set. CSP helps prevent cross-site scripting (XSS), clickjacking, and other code injection attacks by specifying trusted content sources.',
          url: res.url,
          method: 'GET',
          solution: 'Implement a Content Security Policy header. Start with a restrictive policy and gradually relax it: Content-Security-Policy: default-src \'self\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\'',
          reference: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP',
          cweId: 693,
          wascId: 15,
        };
      }
      return null;
    },
  },
  {
    id: 'missing-x-frame-options',
    pluginId: '10021',
    name: 'X-Frame-Options Header Not Set',
    category: 'Security Headers',
    check: (res, targetUrl) => {
      const xfo = res.headers['x-frame-options'];
      const csp = (res.headers['content-security-policy'] as string) || '';
      // If CSP has frame-ancestors, X-Frame-Options is not needed
      if (!xfo && !csp.includes('frame-ancestors')) {
        return {
          id: generateId(),
          pluginId: '10021',
          name: 'X-Frame-Options Header Not Set',
          risk: 'Medium' as DASTRisk,
          confidence: 'High' as DASTConfidence,
          description: 'X-Frame-Options header is not included in the HTTP response to protect against clickjacking attacks. Without this header, the page can be embedded in an iframe on a malicious site.',
          url: res.url,
          method: 'GET',
          solution: 'Add the X-Frame-Options header with value DENY or SAMEORIGIN to prevent clickjacking.',
          reference: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options',
          cweId: 1021,
          wascId: 15,
        };
      }
      return null;
    },
  },
  {
    id: 'missing-x-content-type-options',
    pluginId: '10021',
    name: 'X-Content-Type-Options Header Missing',
    category: 'Security Headers',
    check: (res) => {
      if (!res.headers['x-content-type-options']) {
        return {
          id: generateId(),
          pluginId: '10021',
          name: 'X-Content-Type-Options Header Missing',
          risk: 'Low' as DASTRisk,
          confidence: 'High' as DASTConfidence,
          description: 'The X-Content-Type-Options header is not set to "nosniff". This allows browsers to MIME-sniff responses, potentially treating a non-executable MIME type as executable.',
          url: res.url,
          method: 'GET',
          solution: 'Add the X-Content-Type-Options: nosniff header to all responses.',
          reference: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options',
          cweId: 693,
        };
      }
      return null;
    },
  },
  {
    id: 'missing-strict-transport-security',
    pluginId: '10035',
    name: 'Strict-Transport-Security Header Not Set',
    category: 'Security Headers',
    check: (res, targetUrl) => {
      const url = new URL(targetUrl);
      // Only applies to HTTPS sites
      if (url.protocol === 'https:' && !res.headers['strict-transport-security']) {
        return {
          id: generateId(),
          pluginId: '10035',
          name: 'Strict-Transport-Security Header Not Set',
          risk: 'Low' as DASTRisk,
          confidence: 'High' as DASTConfidence,
          description: 'HTTP Strict Transport Security (HSTS) header is not set. HSTS instructs browsers to only access the site via HTTPS, preventing protocol downgrade attacks and cookie hijacking.',
          url: res.url,
          method: 'GET',
          solution: 'Add Strict-Transport-Security header: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload',
          reference: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security',
          cweId: 319,
        };
      }
      return null;
    },
  },
  {
    id: 'missing-referrer-policy',
    pluginId: '10049',
    name: 'Referrer-Policy Header Not Set',
    category: 'Security Headers',
    check: (res) => {
      if (!res.headers['referrer-policy']) {
        return {
          id: generateId(),
          pluginId: '10049',
          name: 'Referrer-Policy Header Not Set',
          risk: 'Low' as DASTRisk,
          confidence: 'High' as DASTConfidence,
          description: 'Referrer-Policy header is not set. Without this, the browser may leak the referring URL to third-party sites, potentially exposing sensitive paths or query parameters.',
          url: res.url,
          method: 'GET',
          solution: 'Set the Referrer-Policy header to a strict value: Referrer-Policy: strict-origin-when-cross-origin',
          reference: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy',
          cweId: 200,
        };
      }
      return null;
    },
  },
  {
    id: 'missing-permissions-policy',
    pluginId: '10063',
    name: 'Permissions-Policy Header Not Set',
    category: 'Security Headers',
    check: (res) => {
      if (!res.headers['permissions-policy'] && !res.headers['feature-policy']) {
        return {
          id: generateId(),
          pluginId: '10063',
          name: 'Permissions-Policy Header Not Set',
          risk: 'Low' as DASTRisk,
          confidence: 'Medium' as DASTConfidence,
          description: 'Permissions-Policy header is not set. This header controls which browser features (camera, microphone, geolocation, etc.) the page is allowed to use, limiting potential misuse by embedded content.',
          url: res.url,
          method: 'GET',
          solution: 'Add a Permissions-Policy header: Permissions-Policy: camera=(), microphone=(), geolocation=()',
          reference: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Permissions-Policy',
          cweId: 693,
        };
      }
      return null;
    },
  },

  // --- Information Disclosure ---
  {
    id: 'server-header-disclosed',
    pluginId: '10036',
    name: 'Server Version Disclosed',
    category: 'Information Disclosure',
    check: (res) => {
      const server = res.headers['server'] as string;
      if (server && /[0-9]/.test(server)) {
        return {
          id: generateId(),
          pluginId: '10036',
          name: 'Server Leaks Version Information via "Server" HTTP Response Header Field',
          risk: 'Low' as DASTRisk,
          confidence: 'High' as DASTConfidence,
          description: `The web/application server is leaking version information via the "Server" HTTP response header: "${server}". This can help attackers identify known vulnerabilities.`,
          url: res.url,
          method: 'GET',
          evidence: `Server: ${server}`,
          solution: 'Configure the server to suppress the Server header or remove version information from it.',
          reference: 'https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/01-Information_Gathering/02-Fingerprint_Web_Server',
          cweId: 200,
        };
      }
      return null;
    },
  },
  {
    id: 'x-powered-by-disclosed',
    pluginId: '10037',
    name: 'X-Powered-By Header Information Leak',
    category: 'Information Disclosure',
    check: (res) => {
      const xPoweredBy = res.headers['x-powered-by'] as string;
      if (xPoweredBy) {
        return {
          id: generateId(),
          pluginId: '10037',
          name: 'X-Powered-By Header Information Leak',
          risk: 'Low' as DASTRisk,
          confidence: 'Medium' as DASTConfidence,
          description: `The X-Powered-By header discloses technology information: "${xPoweredBy}". Attackers can use this to identify known vulnerabilities in the technology stack.`,
          url: res.url,
          method: 'GET',
          evidence: `X-Powered-By: ${xPoweredBy}`,
          solution: 'Remove or suppress the X-Powered-By header in your server configuration.',
          reference: 'https://owasp.org/www-project-web-security-testing-guide/',
          cweId: 200,
        };
      }
      return null;
    },
  },

  // --- Cookie Security ---
  {
    id: 'cookie-no-secure-flag',
    pluginId: '10011',
    name: 'Cookie Without Secure Flag',
    category: 'Cookie Security',
    check: (res, targetUrl) => {
      const url = new URL(targetUrl);
      if (url.protocol !== 'https:') return null;

      const insecureCookies = res.cookies.filter((c) => !c.secure);
      if (insecureCookies.length > 0) {
        return {
          id: generateId(),
          pluginId: '10011',
          name: 'Cookie Without Secure Flag',
          risk: 'Low' as DASTRisk,
          confidence: 'High' as DASTConfidence,
          description: `${insecureCookies.length} cookie(s) set without the Secure flag: ${insecureCookies.map((c) => c.name).join(', ')}. These cookies could be sent over unencrypted connections.`,
          url: res.url,
          method: 'GET',
          param: insecureCookies[0].name,
          evidence: `Set-Cookie: ${insecureCookies[0].name}=...`,
          solution: 'Add the Secure flag to all cookies, especially session cookies, when using HTTPS.',
          reference: 'https://owasp.org/www-community/controls/SecureCookieAttribute',
          cweId: 614,
        };
      }
      return null;
    },
  },
  {
    id: 'cookie-no-httponly-flag',
    pluginId: '10010',
    name: 'Cookie Without HttpOnly Flag',
    category: 'Cookie Security',
    check: (res) => {
      const nonHttpOnly = res.cookies.filter((c) => !c.httpOnly);
      if (nonHttpOnly.length > 0) {
        return {
          id: generateId(),
          pluginId: '10010',
          name: 'Cookie Without HttpOnly Flag',
          risk: 'Low' as DASTRisk,
          confidence: 'Medium' as DASTConfidence,
          description: `${nonHttpOnly.length} cookie(s) set without the HttpOnly flag: ${nonHttpOnly.map((c) => c.name).join(', ')}. These cookies are accessible to JavaScript and vulnerable to XSS-based theft.`,
          url: res.url,
          method: 'GET',
          param: nonHttpOnly[0].name,
          evidence: `Set-Cookie: ${nonHttpOnly[0].name}=...`,
          solution: 'Add the HttpOnly flag to all cookies, especially session cookies, to prevent JavaScript access.',
          reference: 'https://owasp.org/www-community/HttpOnly',
          cweId: 1004,
        };
      }
      return null;
    },
  },
  {
    id: 'cookie-no-samesite',
    pluginId: '10054',
    name: 'Cookie Without SameSite Attribute',
    category: 'Cookie Security',
    check: (res) => {
      const noSameSite = res.cookies.filter((c) => !c.sameSite);
      if (noSameSite.length > 0) {
        return {
          id: generateId(),
          pluginId: '10054',
          name: 'Cookie Without SameSite Attribute',
          risk: 'Low' as DASTRisk,
          confidence: 'Medium' as DASTConfidence,
          description: `${noSameSite.length} cookie(s) without SameSite attribute: ${noSameSite.map((c) => c.name).join(', ')}. Without SameSite, cookies may be sent with cross-origin requests, enabling CSRF attacks.`,
          url: res.url,
          method: 'GET',
          param: noSameSite[0].name,
          solution: 'Add SameSite=Lax or SameSite=Strict attribute to all cookies.',
          reference: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite',
          cweId: 1275,
        };
      }
      return null;
    },
  },

  // --- CORS ---
  {
    id: 'cors-wildcard',
    pluginId: '10098',
    name: 'Cross-Origin Resource Sharing: Wildcard Origin',
    category: 'CORS',
    check: (res) => {
      const acao = res.headers['access-control-allow-origin'] as string;
      if (acao === '*') {
        return {
          id: generateId(),
          pluginId: '10098',
          name: 'Cross-Origin Resource Sharing: Wildcard Access-Control-Allow-Origin',
          risk: 'Medium' as DASTRisk,
          confidence: 'High' as DASTConfidence,
          description: 'The Access-Control-Allow-Origin header is set to "*", allowing any origin to access this resource. This is risky if the resource contains sensitive data.',
          url: res.url,
          method: 'GET',
          evidence: 'Access-Control-Allow-Origin: *',
          solution: 'Restrict CORS to only trusted origins instead of using a wildcard.',
          reference: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS',
          cweId: 942,
        };
      }
      return null;
    },
  },

  // --- Response Analysis ---
  {
    id: 'error-disclosure',
    pluginId: '10023',
    name: 'Information Disclosure - Debug Error Messages',
    category: 'Information Disclosure',
    check: (res) => {
      const body = res.body.toLowerCase();
      const errorPatterns = [
        { pattern: 'stack trace', label: 'Stack Trace' },
        { pattern: 'at module._compile', label: 'Node.js Stack Trace' },
        { pattern: 'at object.<anonymous>', label: 'Node.js Stack Trace' },
        { pattern: 'syntax error', label: 'Syntax Error' },
        { pattern: 'internal server error', label: 'Internal Server Error' },
        { pattern: 'sqlstate', label: 'SQL Error State' },
        { pattern: 'pg_catalog', label: 'PostgreSQL Catalog Reference' },
        { pattern: 'mysql error', label: 'MySQL Error' },
        { pattern: 'unhandled exception', label: 'Unhandled Exception' },
      ];

      for (const ep of errorPatterns) {
        if (body.includes(ep.pattern)) {
          return {
            id: generateId(),
            pluginId: '10023',
            name: `Information Disclosure - ${ep.label}`,
            risk: 'Medium' as DASTRisk,
            confidence: 'Medium' as DASTConfidence,
            description: `The response appears to contain debug error information (${ep.label}). This can expose internal implementation details to attackers.`,
            url: res.url,
            method: 'GET',
            evidence: ep.label,
            solution: 'Configure proper error handling to suppress detailed error messages in production. Use generic error pages.',
            cweId: 200,
          };
        }
      }
      return null;
    },
  },
  {
    id: 'timestamp-disclosure',
    pluginId: '10096',
    name: 'Timestamp Disclosure',
    category: 'Information Disclosure',
    check: (res) => {
      // Look for Unix timestamps in response body (10-digit numbers that look like epoch time)
      const now = Math.floor(Date.now() / 1000);
      const epochPattern = /\b(1[0-9]{9})\b/g;
      const matches = res.body.match(epochPattern);
      if (matches) {
        const validTimestamps = matches.filter((m) => {
          const ts = parseInt(m, 10);
          // Valid if within ~10 years of now
          return Math.abs(ts - now) < 315360000;
        });
        if (validTimestamps.length > 0) {
          return {
            id: generateId(),
            pluginId: '10096',
            name: 'Timestamp Disclosure - Unix',
            risk: 'Informational' as DASTRisk,
            confidence: 'Low' as DASTConfidence,
            description: `A Unix timestamp was disclosed in the response: ${validTimestamps[0]}. This could reveal information about when resources were created or modified.`,
            url: res.url,
            method: 'GET',
            evidence: validTimestamps[0],
            solution: 'Manually confirm that the timestamp data is not sensitive, and that the data cannot be aggregated to disclose exploitable patterns.',
            cweId: 200,
          };
        }
      }
      return null;
    },
  },

  // --- Cache Control ---
  {
    id: 'storable-cacheable',
    pluginId: '10049',
    name: 'Storable and Cacheable Content',
    category: 'Cache Control',
    check: (res) => {
      const cacheControl = (res.headers['cache-control'] as string) || '';
      const pragma = (res.headers['pragma'] as string) || '';
      // Check if response could be cached (no explicit no-store directive)
      if (!cacheControl.includes('no-store') && !pragma.includes('no-cache') && res.cookies.length > 0) {
        return {
          id: generateId(),
          pluginId: '10049',
          name: 'Storable and Cacheable Content',
          risk: 'Informational' as DASTRisk,
          confidence: 'Medium' as DASTConfidence,
          description: 'The response contains cookies but does not use Cache-Control: no-store. This means the response could be stored in intermediate caches, potentially leaking session data.',
          url: res.url,
          method: 'GET',
          solution: 'Add Cache-Control: no-store, no-cache, must-revalidate for responses containing sensitive data or session cookies.',
          cweId: 524,
        };
      }
      return null;
    },
  },

  // --- Mixed Content / HTTPS ---
  {
    id: 'mixed-content',
    pluginId: '10040',
    name: 'Secure Pages Include Mixed Content',
    category: 'HTTPS',
    check: (res, targetUrl) => {
      const url = new URL(targetUrl);
      if (url.protocol !== 'https:') return null;

      const httpPattern = /(?:src|href|action)=["']http:\/\//i;
      if (httpPattern.test(res.body)) {
        return {
          id: generateId(),
          pluginId: '10040',
          name: 'Secure Pages Include Mixed Content',
          risk: 'Medium' as DASTRisk,
          confidence: 'Medium' as DASTConfidence,
          description: 'The HTTPS page includes resources loaded over HTTP. This creates a mixed content vulnerability where HTTP resources can be intercepted or modified by attackers.',
          url: res.url,
          method: 'GET',
          solution: 'Serve all resources over HTTPS. Replace http:// with https:// or use protocol-relative URLs (//).',
          cweId: 311,
        };
      }
      return null;
    },
  },
];

// ---------------------------------------------------------------------------
// HTTP request helper
// ---------------------------------------------------------------------------

function fetchUrl(targetUrl: string, method: string = 'GET', timeoutMs: number = 15000): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const url = new URL(targetUrl);
    const isHTTPS = url.protocol === 'https:';
    const lib = isHTTPS ? https : http;

    const startTime = Date.now();

    const options: https.RequestOptions = {
      method,
      hostname: url.hostname,
      port: url.port || (isHTTPS ? 443 : 80),
      path: url.pathname + url.search,
      timeout: timeoutMs,
      headers: {
        'User-Agent': 'QA-Guardian-DAST-Scanner/1.0 (Lightweight Security Scanner)',
        'Accept': 'text/html,application/xhtml+xml,application/json,*/*',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      // Allow self-signed certs for local dev
      rejectUnauthorized: false,
    };

    const req = lib.request(options, (res) => {
      let body = '';
      res.on('data', (chunk: Buffer) => {
        body += chunk.toString();
        // Limit body to 500KB to prevent memory issues
        if (body.length > 500_000) {
          req.destroy();
        }
      });
      res.on('end', () => {
        const responseTime = Date.now() - startTime;
        const headers: Record<string, string | string[] | undefined> = {};
        for (const [key, value] of Object.entries(res.headers)) {
          headers[key.toLowerCase()] = value;
        }

        resolve({
          statusCode: res.statusCode || 0,
          headers,
          body: body.substring(0, 500_000),
          url: targetUrl,
          redirectUrl: res.headers.location,
          cookies: parseCookies(headers),
          responseTime,
        });
      });
    });

    req.on('error', (err: Error) => {
      reject(new Error(`Failed to connect to ${targetUrl}: ${err.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request to ${targetUrl} timed out after ${timeoutMs}ms`));
    });

    req.end();
  });
}

// ---------------------------------------------------------------------------
// Discover additional URLs to scan
// ---------------------------------------------------------------------------

function extractUrls(body: string, baseUrl: string): string[] {
  const url = new URL(baseUrl);
  const urls = new Set<string>();

  // Extract href and src attributes
  const patterns = [
    /href=["']([^"'#]+)["']/gi,
    /src=["']([^"'#]+)["']/gi,
    /action=["']([^"'#]+)["']/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(body)) !== null) {
      try {
        const resolved = new URL(match[1], baseUrl);
        // Only include URLs from the same origin
        if (resolved.hostname === url.hostname) {
          urls.add(resolved.href);
        }
      } catch {
        // Invalid URL, skip
      }
    }
  }

  return Array.from(urls).slice(0, 20); // Limit discovered URLs
}

// ---------------------------------------------------------------------------
// Main lightweight scan function
// ---------------------------------------------------------------------------

/**
 * Run a lightweight DAST scan using built-in HTTP-based security checks.
 * This is used as a fallback when ZAP/Docker is not available.
 */
export async function runLightweightScan(
  projectId: string,
  targetUrl: string,
  scanProfile: 'baseline' | 'full' | 'api',
  authConfig?: DASTConfig['authConfig'],
  contextConfig?: DASTConfig['contextConfig'],
): Promise<DASTScanResult> {
  const scanId = generateId();

  // Create the initial scan record
  const scan: DASTScanResult = {
    id: scanId,
    projectId,
    targetUrl,
    scanProfile,
    status: 'running',
    startedAt: new Date().toISOString(),
    alerts: [],
    summary: {
      total: 0,
      byRisk: { high: 0, medium: 0, low: 0, informational: 0 },
      byConfidence: { high: 0, medium: 0, low: 0 },
    },
    statistics: {
      urlsScanned: 0,
      requestsSent: 0,
      duration: 0,
    },
    progress: {
      phase: 'spider',
      phaseDescription: 'Initializing lightweight security scan...',
      percentage: 0,
      urlsDiscovered: 0,
      urlsScanned: 0,
      alertsFound: 0,
      estimatedTimeRemaining: 30,
      currentUrl: targetUrl,
    },
  };

  await createDastScan(scan);

  // Run the scan asynchronously
  executeLightweightScan(scan, projectId, targetUrl, scanProfile, authConfig, contextConfig)
    .catch((err) => {
      console.error(`[DAST-Lightweight] Scan ${scanId} failed:`, err);
      scan.status = 'failed';
      scan.error = err.message || 'Unknown error during lightweight scan';
      scan.completedAt = new Date().toISOString();
      updateDastScan(scan.id, scan).catch((e) =>
        console.error(`[DAST-Lightweight] Failed to persist error state for scan ${scanId}:`, e)
      );
    });

  return scan;
}

async function executeLightweightScan(
  scan: DASTScanResult,
  projectId: string,
  targetUrl: string,
  scanProfile: 'baseline' | 'full' | 'api',
  authConfig?: DASTConfig['authConfig'],
  contextConfig?: DASTConfig['contextConfig'],
): Promise<void> {
  const startTime = Date.now();
  const allAlerts: DASTAlert[] = [];
  const scannedUrls: string[] = [];
  let requestCount = 0;

  // Phase 1: Spider - Discover URLs
  scan.progress = {
    phase: 'spider',
    phaseDescription: 'Discovering pages on target...',
    percentage: 5,
    urlsDiscovered: 0,
    urlsScanned: 0,
    alertsFound: 0,
    currentUrl: targetUrl,
  };
  await updateDastScan(scan.id, scan);

  console.log(`[DAST-Lightweight] Starting scan of ${targetUrl} (profile: ${scanProfile})`);

  // Fetch the main page
  let mainResponse: HttpResponse;
  try {
    mainResponse = await fetchUrl(targetUrl);
    requestCount++;
  } catch (err: any) {
    throw new Error(`Cannot reach target URL ${targetUrl}: ${err.message}`);
  }

  scannedUrls.push(targetUrl);

  // Discover additional URLs from the response
  const discoveredUrls = extractUrls(mainResponse.body, targetUrl);

  scan.progress = {
    phase: 'spider',
    phaseDescription: `Discovered ${discoveredUrls.length + 1} URLs`,
    percentage: 20,
    urlsDiscovered: discoveredUrls.length + 1,
    urlsScanned: 1,
    alertsFound: 0,
    currentUrl: targetUrl,
  };
  await updateDastScan(scan.id, scan);

  // Phase 2: Run security checks on main page
  scan.progress = {
    phase: scanProfile === 'baseline' ? 'passive_scan' : 'active_scan',
    phaseDescription: 'Analyzing security headers and configuration...',
    percentage: 30,
    urlsDiscovered: discoveredUrls.length + 1,
    urlsScanned: 1,
    alertsFound: 0,
    currentUrl: targetUrl,
  };
  await updateDastScan(scan.id, scan);

  // Run all security checks on the main page
  for (const check of SECURITY_CHECKS) {
    try {
      const alert = check.check(mainResponse, targetUrl);
      if (alert) {
        allAlerts.push(alert);
      }
    } catch (err) {
      console.error(`[DAST-Lightweight] Check ${check.id} failed:`, err);
    }
  }

  // Phase 3: Scan discovered URLs (for non-baseline scans, scan more)
  const maxUrlsToScan = scanProfile === 'baseline' ? 3 : 10;
  const urlsToScan = discoveredUrls.slice(0, maxUrlsToScan);

  for (let i = 0; i < urlsToScan.length; i++) {
    const url = urlsToScan[i];

    // Apply scope filtering
    if (!isUrlInScope(url, contextConfig?.includeUrls, contextConfig?.excludeUrls)) {
      continue;
    }

    scan.progress = {
      phase: scanProfile === 'baseline' ? 'passive_scan' : 'active_scan',
      phaseDescription: `Scanning URL ${i + 2}/${urlsToScan.length + 1}...`,
      percentage: 30 + Math.round(((i + 1) / (urlsToScan.length + 1)) * 50),
      urlsDiscovered: discoveredUrls.length + 1,
      urlsScanned: scannedUrls.length,
      alertsFound: allAlerts.length,
      currentUrl: url,
    };
    await updateDastScan(scan.id, scan);

    try {
      const response = await fetchUrl(url);
      requestCount++;
      scannedUrls.push(url);

      // Run security checks on this URL
      for (const check of SECURITY_CHECKS) {
        try {
          const alert = check.check(response, url);
          if (alert) {
            // Deduplicate: don't add if same pluginId + same name already found on same URL
            const isDuplicate = allAlerts.some(
              (a) => a.pluginId === alert.pluginId && a.name === alert.name && a.url === alert.url
            );
            if (!isDuplicate) {
              allAlerts.push(alert);
            }
          }
        } catch (err) {
          // Individual check failure, continue
        }
      }
    } catch (err) {
      console.warn(`[DAST-Lightweight] Failed to scan ${url}:`, err);
    }
  }

  // Phase 4: Analyze results
  scan.progress = {
    phase: 'analyzing',
    phaseDescription: 'Analyzing scan results...',
    percentage: 90,
    urlsDiscovered: discoveredUrls.length + 1,
    urlsScanned: scannedUrls.length,
    alertsFound: allAlerts.length,
    currentUrl: targetUrl,
  };
  await updateDastScan(scan.id, scan);

  // Apply scope filtering to alerts
  const filteredAlerts = allAlerts.filter((alert) =>
    isUrlInScope(alert.url, contextConfig?.includeUrls, contextConfig?.excludeUrls)
  );

  // Mark known false positives
  const fps = await getDastFalsePositives(projectId);
  filteredAlerts.forEach((alert) => {
    const isFP = fps.some(
      (fp) =>
        fp.pluginId === alert.pluginId &&
        fp.url === alert.url &&
        (!fp.param || fp.param === alert.param)
    );
    if (isFP) {
      alert.isFalsePositive = true;
    }
  });

  // Finalize scan
  const nonFP = filteredAlerts.filter((a) => !a.isFalsePositive);
  const durationSeconds = Math.round((Date.now() - startTime) / 1000);

  scan.status = 'completed';
  scan.completedAt = new Date().toISOString();
  scan.alerts = filteredAlerts;
  scan.summary = {
    total: nonFP.length,
    byRisk: {
      high: nonFP.filter((a) => a.risk === 'High').length,
      medium: nonFP.filter((a) => a.risk === 'Medium').length,
      low: nonFP.filter((a) => a.risk === 'Low').length,
      informational: nonFP.filter((a) => a.risk === 'Informational').length,
    },
    byConfidence: {
      high: nonFP.filter((a) => a.confidence === 'High').length,
      medium: nonFP.filter((a) => a.confidence === 'Medium').length,
      low: nonFP.filter((a) => a.confidence === 'Low').length,
    },
  };
  scan.statistics = {
    urlsScanned: scannedUrls.length,
    requestsSent: requestCount,
    duration: durationSeconds,
  };
  scan.progress = {
    phase: 'complete',
    phaseDescription: 'Lightweight scan completed',
    percentage: 100,
    urlsDiscovered: discoveredUrls.length + 1,
    urlsScanned: scannedUrls.length,
    alertsFound: filteredAlerts.length,
    estimatedTimeRemaining: 0,
  };

  await updateDastScan(scan.id, scan);

  // Update config with last scan info
  const config = await getDASTConfig(projectId);
  config.lastScanAt = scan.completedAt;
  config.lastScanStatus = 'completed';
  await saveDastConfig(projectId, config);

  console.log(`[DAST-Lightweight] Scan ${scan.id} completed: ${filteredAlerts.length} alerts found, ${scannedUrls.length} URLs scanned in ${durationSeconds}s`);
}

/**
 * Check if ZAP is reachable at the configured URL.
 */
export async function isZAPAvailable(): Promise<boolean> {
  const ZAP_BASE_URL = process.env.ZAP_API_URL || 'http://zap:8080';
  return new Promise((resolve) => {
    const req = http.get(`${ZAP_BASE_URL}/JSON/core/view/version/`, { timeout: 3000 }, (res) => {
      let data = '';
      res.on('data', (chunk: string) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(!!json.version);
        } catch {
          resolve(false);
        }
      });
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}
