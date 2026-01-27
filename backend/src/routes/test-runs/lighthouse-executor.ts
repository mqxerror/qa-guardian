/**
 * Lighthouse Test Executor Module
 * Extracted from test-runs.ts for code organization (Feature #1356)
 *
 * This module handles Lighthouse performance audit execution.
 */

// Import types from execution module
import { NetworkRequest, StepResult } from './execution';
import { Page } from 'playwright';

// ============================================================================
// Types
// ============================================================================

/**
 * Lighthouse test configuration
 */
export interface LighthouseTestConfig {
  id: string;
  name: string;
  test_type: 'lighthouse';
  target_url: string;
  device_preset?: 'mobile' | 'desktop';
  performance_threshold?: number;
  lcp_threshold?: number;
  cls_threshold?: number;
  bypass_csp?: boolean;
  ignore_ssl_errors?: boolean;
  audit_timeout?: number;
  suite_id: string;
}

/**
 * Lighthouse execution context - all dependencies needed for execution
 */
export interface LighthouseExecutionContext {
  page: Page;
  runId: string;
  orgId: string;
  test: LighthouseTestConfig;
  networkRequests: NetworkRequest[];
  emitRunEvent: (runId: string, orgId: string, event: string, data: any) => void;
  testSuites: Map<string, { id: string; name: string; project_id: string }>;
  // Simulation state getters
  getSimulatedLighthouseError: () => { enabled: boolean; errorType?: string; sslErrorCode?: string };
  setSimulatedLighthouseError: (value: { enabled: boolean }) => void;
  getSimulatedAuditTimeout: () => { enabled: boolean; partialMetrics?: any };
  setSimulatedAuditTimeout: (value: { enabled: boolean }) => void;
  getSimulatedLighthouseBrowserCrash: () => { enabled: boolean };
  setSimulatedLighthouseBrowserCrash: (value: { enabled: boolean }) => void;
  getSimulatedAuthRedirect: () => { enabled: boolean; redirectUrl?: string };
  setSimulatedAuthRedirect: (value: { enabled: boolean }) => void;
  getSimulatedLighthouseNonHtmlResponse: () => { enabled: boolean; contentType?: string };
  setSimulatedLighthouseNonHtmlResponse: (value: { enabled: boolean }) => void;
  getCrashDumpsDir: () => string;
}

/**
 * Lighthouse execution result
 */
export interface LighthouseExecutionResult {
  status: 'passed' | 'failed' | 'error';
  error?: string;
  screenshot_base64?: string;
  stepResults: StepResult[];
}

/**
 * Lighthouse metrics
 */
export interface LighthouseMetrics {
  firstContentfulPaint: number;
  speedIndex: number;
  largestContentfulPaint: number;
  timeToInteractive: number;
  totalBlockingTime: number;
  cumulativeLayoutShift: number;
  interactionToNextPaint: number;
  timeToFirstByte: number;
}

/**
 * Lighthouse audit opportunity
 */
export interface LighthouseOpportunity {
  id: string;
  title: string;
  savings: number;
  description: string;
}

/**
 * Lighthouse diagnostic
 */
export interface LighthouseDiagnostic {
  id: string;
  title: string;
  description: string;
}

/**
 * Lighthouse passed audit
 */
export interface LighthousePassedAudit {
  id: string;
  title: string;
  description: string;
}

/**
 * CSP detection result
 */
export interface CspDetectionResult {
  detected: boolean;
  header?: string;
  blocksLighthouse: boolean;
  warning?: string;
  partialResults: boolean;
  bypassEnabled: boolean;
  suggestion?: string;
}

/**
 * Authentication detection result
 */
export interface AuthDetectionResult {
  required: boolean;
  warning?: string;
  suggestion?: string;
  redirectedToLogin: boolean;
  originalUrl?: string;
  actualUrl?: string;
  loginIndicators?: string[];
  resultsReflectLoginPage: boolean;
}

/**
 * Mixed content detection result
 */
export interface MixedContentResult {
  detected: boolean;
  warning?: string;
  count: number;
  activeCount: number;
  passiveCount: number;
  resources: Array<{
    url: string;
    resourceType: string;
    severity: 'passive' | 'active';
  }>;
  hasMore: boolean;
  remediation: string[];
  securityImpact: 'high' | 'medium';
  scorePenalty: number;
}

/**
 * Full Lighthouse results
 */
export interface LighthouseResults {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  device: string;
  url: string;
  metrics: LighthouseMetrics;
  opportunities: LighthouseOpportunity[];
  diagnostics: LighthouseDiagnostic[];
  passedAudits: LighthousePassedAudit[];
  csp?: CspDetectionResult;
  authentication?: AuthDetectionResult;
  mixedContent?: MixedContentResult;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * SSL error messages for simulation
 */
export const SSL_ERROR_MESSAGES: Record<string, string> = {
  'CERT_HAS_EXPIRED': 'net::ERR_CERT_DATE_INVALID: CERT_HAS_EXPIRED',
  'CERT_AUTHORITY_INVALID': 'net::ERR_CERT_AUTHORITY_INVALID: self-signed certificate',
  'CERT_COMMON_NAME_INVALID': 'net::ERR_CERT_COMMON_NAME_INVALID: hostname mismatch',
  'CERT_REVOKED': 'net::ERR_CERT_REVOKED: certificate has been revoked',
  'SSL_VERSION_OR_CIPHER_MISMATCH': 'net::ERR_SSL_VERSION_OR_CIPHER_MISMATCH',
  'CERT_WEAK_KEY': 'net::ERR_CERT_WEAK_KEY: certificate uses weak key',
};

/**
 * Network error messages for simulation
 */
export const NETWORK_ERROR_MESSAGES: Record<string, string> = {
  dns_resolution: 'net::ERR_NAME_NOT_RESOLVED',
  connection_timeout: 'net::ERR_CONNECTION_TIMED_OUT',
  connection_refused: 'net::ERR_CONNECTION_REFUSED',
  unreachable: 'net::ERR_NETWORK_CHANGED',
};

/**
 * Login URL patterns for authentication detection
 */
export const LOGIN_URL_PATTERNS = [
  '/login', '/signin', '/sign-in', '/sign_in',
  '/auth', '/authenticate', '/authentication',
  '/sso', '/oauth', '/saml',
  '/account/login', '/accounts/login',
  '/user/login', '/users/login',
  '/session/new', '/sessions/new',
  '/cas/login', '/adfs/login',
  '/idp/', '/identity/',
];

/**
 * CSP restrictive patterns that may block Lighthouse
 */
export const CSP_RESTRICTIVE_PATTERNS = [
  { pattern: "script-src 'self'", issue: 'script-src restricts to self only' },
  { pattern: "script-src 'none'", issue: 'script-src blocks all scripts' },
  { pattern: "connect-src 'self'", issue: 'connect-src restricts to self only' },
  { pattern: "connect-src 'none'", issue: 'connect-src blocks all connections' },
  { pattern: "default-src 'self'", issue: 'default-src restricts to self only' },
  { pattern: "default-src 'none'", issue: 'default-src blocks all resources' },
];

/**
 * Content indicators for login page detection
 */
export const LOGIN_CONTENT_INDICATORS = [
  { pattern: /<input[^>]*type\s*=\s*["']password["'][^>]*>/i, indicator: 'password input field' },
  { pattern: /<form[^>]*(?:login|signin|auth)[^>]*>/i, indicator: 'login form' },
  { pattern: /(?:sign\s*in|log\s*in|authenticate)/i, indicator: 'login text in content' },
  { pattern: /<input[^>]*name\s*=\s*["'](?:username|email|user)[^>]*>/i, indicator: 'username/email input' },
  { pattern: /forgot\s*(?:your\s*)?password/i, indicator: 'forgot password link' },
  { pattern: /remember\s*me/i, indicator: 'remember me checkbox' },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Detect CSP issues that may block Lighthouse
 */
export function detectCspIssues(cspHeader: string): { blocksLighthouse: boolean; issues: string[] } {
  const cspDirectives = cspHeader.toLowerCase();
  const detectedIssues: string[] = [];

  for (const { pattern, issue } of CSP_RESTRICTIVE_PATTERNS) {
    if (cspDirectives.includes(pattern) &&
        !cspDirectives.includes("'unsafe-inline'") &&
        !cspDirectives.includes("'unsafe-eval'")) {
      detectedIssues.push(issue);
    }
  }

  // Check for nonce requirements which block dynamic scripts
  if (cspDirectives.includes("'nonce-") || cspDirectives.includes("'strict-dynamic'")) {
    detectedIssues.push('CSP requires nonce or strict-dynamic for scripts');
  }

  return {
    blocksLighthouse: detectedIssues.length > 0,
    issues: detectedIssues,
  };
}

/**
 * Detect non-HTML content type and provide suggestions
 */
export function detectNonHtmlContent(contentType: string): {
  isHtml: boolean;
  contentDescription?: string;
  suggestedAuditType?: string;
} {
  const isHtmlContent = contentType.includes('text/html') || contentType.includes('application/xhtml');

  if (isHtmlContent || !contentType) {
    return { isHtml: true };
  }

  let contentDescription = 'unknown content';
  let suggestedAuditType = 'appropriate audit type';

  if (contentType.includes('application/json') || contentType.includes('+json')) {
    contentDescription = 'JSON API response';
    suggestedAuditType = 'API/Load testing instead of Lighthouse performance audit';
  } else if (contentType.includes('application/xml') || contentType.includes('text/xml') || contentType.includes('+xml')) {
    contentDescription = 'XML document';
    suggestedAuditType = 'API testing instead of Lighthouse performance audit';
  } else if (contentType.includes('image/')) {
    const imageType = contentType.split('image/')[1]?.split(';')[0] || 'image';
    contentDescription = `image (${imageType.toUpperCase()})`;
    suggestedAuditType = 'an HTML page that embeds this image, or use asset validation tools';
  } else if (contentType.includes('application/pdf')) {
    contentDescription = 'PDF document';
    suggestedAuditType = 'an HTML page or PDF-specific analysis tools';
  } else if (contentType.includes('application/octet-stream') || contentType.includes('application/zip')) {
    contentDescription = 'binary file download';
    suggestedAuditType = 'an HTML page that links to this download';
  } else if (contentType.includes('text/plain')) {
    contentDescription = 'plain text file';
    suggestedAuditType = 'an HTML page for Lighthouse audit';
  } else if (contentType.includes('text/css')) {
    contentDescription = 'CSS stylesheet';
    suggestedAuditType = 'an HTML page that uses this stylesheet';
  } else if (contentType.includes('application/javascript') || contentType.includes('text/javascript')) {
    contentDescription = 'JavaScript file';
    suggestedAuditType = 'an HTML page that uses this script';
  } else {
    contentDescription = `non-HTML content (${contentType.split(';')[0]})`;
  }

  return { isHtml: false, contentDescription, suggestedAuditType };
}

/**
 * Detect login page indicators in URL and content
 */
export function detectLoginPage(
  targetUrl: string,
  actualUrl: string,
  pageContent: string,
  pageTitle: string
): {
  wasRedirected: boolean;
  urlIndicatesLogin: boolean;
  contentIndicators: string[];
  authRequired: boolean;
} {
  const targetUrlObj = new URL(targetUrl);
  const actualUrlObj = new URL(actualUrl);

  const wasRedirected = actualUrl !== targetUrl &&
    (actualUrlObj.pathname !== targetUrlObj.pathname ||
     actualUrlObj.hostname !== targetUrlObj.hostname);

  const urlIndicatesLogin = LOGIN_URL_PATTERNS.some(pattern =>
    actualUrlObj.pathname.toLowerCase().includes(pattern)
  );

  const contentIndicators: string[] = [];
  const pageTitleLower = pageTitle.toLowerCase();

  // Check title for login indicators
  if (pageTitleLower.includes('login') || pageTitleLower.includes('sign in') ||
      pageTitleLower.includes('authenticate') || pageTitleLower.includes('sso')) {
    contentIndicators.push('page title contains login-related text');
  }

  // Check content for login indicators
  for (const { pattern, indicator } of LOGIN_CONTENT_INDICATORS) {
    if (pattern instanceof RegExp ? pattern.test(pageContent) : pageContent.includes(pattern as string)) {
      contentIndicators.push(indicator);
    }
  }

  const hasLoginIndicators = contentIndicators.length >= 2;
  const authRequired = wasRedirected && (urlIndicatesLogin || hasLoginIndicators);

  return { wasRedirected, urlIndicatesLogin, contentIndicators, authRequired };
}

/**
 * Detect mixed content on HTTPS pages
 */
export function detectMixedContent(
  targetUrl: string,
  networkRequests: NetworkRequest[]
): MixedContentResult | undefined {
  const isHttpsPage = targetUrl.startsWith('https://');

  if (!isHttpsPage || networkRequests.length === 0) {
    return undefined;
  }

  const httpResources: Array<{
    url: string;
    resourceType: string;
    severity: 'passive' | 'active';
  }> = [];

  const activeTypes = ['script', 'document', 'xhr', 'fetch', 'websocket', 'stylesheet'];

  for (const request of networkRequests) {
    if (request.url.startsWith('http://') && !request.url.startsWith('http://localhost')) {
      const resourceType = request.resourceType || 'other';
      const severity = activeTypes.includes(resourceType) ? 'active' : 'passive';

      httpResources.push({
        url: request.url,
        resourceType,
        severity,
      });
    }
  }

  if (httpResources.length === 0) {
    return undefined;
  }

  const activeCount = httpResources.filter(r => r.severity === 'active').length;
  const passiveCount = httpResources.filter(r => r.severity === 'passive').length;

  let mixedContentWarning = `Mixed content detected: ${httpResources.length} HTTP resource(s) found on HTTPS page`;
  if (activeCount > 0) {
    mixedContentWarning += ` (${activeCount} active, ${passiveCount} passive)`;
  }

  const remediation = [
    'Update all resource URLs to use HTTPS instead of HTTP',
    'Use protocol-relative URLs (//example.com/resource) where appropriate',
    'Configure your server to redirect HTTP requests to HTTPS',
    'Check third-party resources and ensure they support HTTPS',
  ];

  if (activeCount > 0) {
    remediation.unshift(
      '⚠️ Active mixed content (scripts, stylesheets) may be blocked by browsers - fix immediately'
    );
  }

  return {
    detected: true,
    warning: mixedContentWarning,
    count: httpResources.length,
    activeCount,
    passiveCount,
    resources: httpResources.slice(0, 20),
    hasMore: httpResources.length > 20,
    remediation,
    securityImpact: activeCount > 0 ? 'high' : 'medium',
    scorePenalty: Math.min(15, httpResources.length * 3 + activeCount * 5),
  };
}

/**
 * Generate simulated Lighthouse metrics
 */
export function generateLighthouseMetrics(devicePreset: 'mobile' | 'desktop'): LighthouseMetrics {
  return {
    firstContentfulPaint: devicePreset === 'mobile' ? 2400 + Math.floor(Math.random() * 800) : 1200 + Math.floor(Math.random() * 400),
    speedIndex: devicePreset === 'mobile' ? 3500 + Math.floor(Math.random() * 1000) : 2000 + Math.floor(Math.random() * 500),
    largestContentfulPaint: devicePreset === 'mobile' ? 3000 + Math.floor(Math.random() * 1200) : 1800 + Math.floor(Math.random() * 600),
    timeToInteractive: devicePreset === 'mobile' ? 4500 + Math.floor(Math.random() * 1500) : 2500 + Math.floor(Math.random() * 700),
    totalBlockingTime: devicePreset === 'mobile' ? 250 + Math.floor(Math.random() * 150) : 100 + Math.floor(Math.random() * 80),
    cumulativeLayoutShift: Math.random() * 0.15,
    interactionToNextPaint: devicePreset === 'mobile' ? 300 + Math.floor(Math.random() * 200) : 150 + Math.floor(Math.random() * 100),
    timeToFirstByte: devicePreset === 'mobile' ? 600 + Math.floor(Math.random() * 300) : 200 + Math.floor(Math.random() * 150),
  };
}

/**
 * Generate Lighthouse opportunities (simulated)
 */
export function generateLighthouseOpportunities(): LighthouseOpportunity[] {
  const allOpportunities: LighthouseOpportunity[] = [
    { id: 'render-blocking-resources', title: 'Eliminate render-blocking resources', savings: 1200 + Math.floor(Math.random() * 800), description: 'Resources are blocking the first paint of your page. Consider delivering critical JS/CSS inline and deferring all non-critical JS/styles.' },
    { id: 'unused-css-rules', title: 'Remove unused CSS', savings: 300 + Math.floor(Math.random() * 400), description: 'Reduce unused rules from stylesheets and defer CSS not used for above-the-fold content to decrease bytes consumed by network activity.' },
    { id: 'unused-javascript', title: 'Reduce unused JavaScript', savings: 500 + Math.floor(Math.random() * 600), description: 'Reduce unused JavaScript and defer loading scripts until they are required to decrease bytes consumed by network activity.' },
    { id: 'modern-image-formats', title: 'Serve images in next-gen formats', savings: 800 + Math.floor(Math.random() * 700), description: 'Image formats like WebP and AVIF often provide better compression than PNG or JPEG, which means faster downloads and less data consumption.' },
    { id: 'efficiently-encode-images', title: 'Efficiently encode images', savings: 400 + Math.floor(Math.random() * 500), description: 'Optimized images load faster and consume less cellular data.' },
  ];

  return allOpportunities.filter(() => Math.random() > 0.3);
}

/**
 * Generate Lighthouse diagnostics (simulated)
 */
export function generateLighthouseDiagnostics(): LighthouseDiagnostic[] {
  const allDiagnostics: LighthouseDiagnostic[] = [
    { id: 'largest-contentful-paint-element', title: 'Largest Contentful Paint element', description: 'This is the largest contentful element painted within the viewport. Learn more about the LCP element.' },
    { id: 'dom-size', title: 'Avoid an excessive DOM size', description: 'A large DOM will increase memory usage, cause longer style calculations, and produce costly layout reflows.' },
    { id: 'third-party-facades', title: 'Lazy load third-party resources with facades', description: 'Some third-party embeds can be lazy loaded. Consider replacing them with a facade until they are required.' },
    { id: 'font-display', title: 'Ensure text remains visible during webfont load', description: 'Leverage the font-display CSS feature to ensure text is user-visible while webfonts are loading.' },
  ];

  return allDiagnostics.filter(() => Math.random() > 0.4);
}

/**
 * Generate Lighthouse passed audits (simulated)
 */
export function generateLighthousePassedAudits(): LighthousePassedAudit[] {
  const allPassedAudits: LighthousePassedAudit[] = [
    { id: 'viewport', title: 'Has a <meta name="viewport"> tag with width or initial-scale', description: 'A <meta name="viewport"> tag optimizes your app for mobile screen sizes.' },
    { id: 'document-title', title: 'Document has a <title> element', description: 'The title gives screen reader users an overview of the page, and search engine users rely on it heavily to determine if a page is relevant to their search.' },
    { id: 'html-has-lang', title: '<html> element has a [lang] attribute', description: 'If a page doesn\'t specify a lang attribute, a screen reader assumes that the page is in the default language that the user chose when setting up the screen reader.' },
    { id: 'meta-description', title: 'Document has a meta description', description: 'Meta descriptions may be included in search results to concisely summarize page content.' },
    { id: 'http-status-code', title: 'Page has successful HTTP status code', description: 'Pages with unsuccessful HTTP status codes may not be indexed properly.' },
    { id: 'link-text', title: 'Links have descriptive text', description: 'Descriptive link text helps search engines understand your content.' },
    { id: 'crawlable-anchors', title: 'Links are crawlable', description: 'Search engines may use href attributes on links to crawl websites.' },
    { id: 'is-on-https', title: 'Uses HTTPS', description: 'HTTPS encrypts data sent between the browser and the server.' },
    { id: 'charset', title: 'Properly defines charset', description: 'A character encoding declaration is required. It can be done with a <meta> tag in the first 1024 bytes of the HTML or in the Content-Type HTTP response header.' },
    { id: 'doctype', title: 'Page has the HTML doctype', description: 'Specifying a doctype prevents the browser from switching to quirks-mode.' },
    { id: 'no-document-write', title: 'Avoids document.write()', description: 'For users on slow connections, external scripts dynamically injected via document.write() can delay page load by tens of seconds.' },
    { id: 'js-libraries', title: 'Detected JavaScript libraries', description: 'All front-end JavaScript libraries detected on the page.' },
    { id: 'deprecations', title: 'Avoids deprecated APIs', description: 'Deprecated APIs will eventually be removed from the browser.' },
    { id: 'errors-in-console', title: 'No browser errors logged to the console', description: 'Errors logged to the console indicate unresolved problems.' },
  ];

  return allPassedAudits.filter(() => Math.random() > 0.3);
}

/**
 * Classify error type from error message
 */
export function classifyLighthouseError(
  rawError: string,
  err: any
): {
  errorType: 'dns_resolution' | 'connection_timeout' | 'connection_refused' | 'ssl_error' | 'unreachable' | 'audit_timeout' | 'browser_crash' | 'non_html' | 'unknown';
  sslErrorCode?: string;
  sslErrorDescription?: string;
  securityImplication?: string;
} {
  // Check for audit timeout
  const isAuditTimeoutError = err?.isAuditTimeout === true ||
                              rawError === 'LIGHTHOUSE_AUDIT_TIMEOUT' ||
                              rawError.includes('Navigation timeout') ||
                              rawError.includes('Timeout');

  if (isAuditTimeoutError) {
    return { errorType: 'audit_timeout' };
  }

  // Check for browser crash
  const isBrowserCrashError = err?.isBrowserCrash === true ||
                              rawError.includes('Target closed') ||
                              rawError.includes('Target page, context or browser has been closed') ||
                              rawError.includes('Browser closed') ||
                              rawError.includes('Browser process terminated') ||
                              rawError.includes('crashed') ||
                              rawError.includes('disconnected') ||
                              rawError.includes('Navigation failed because page was closed') ||
                              rawError.includes('Protocol error') ||
                              rawError.includes('Connection closed');

  if (isBrowserCrashError) {
    return { errorType: 'browser_crash' };
  }

  // Check for non-HTML response
  if (err?.isNonHtmlResponse === true || rawError === 'NON_HTML_RESPONSE') {
    return { errorType: 'non_html' };
  }

  // Check for DNS resolution failures
  if (rawError.includes('ERR_NAME_NOT_RESOLVED') ||
      rawError.includes('getaddrinfo ENOTFOUND') ||
      rawError.includes('DNS lookup failed') ||
      rawError.includes('net::ERR_NAME_NOT_RESOLVED')) {
    return { errorType: 'dns_resolution' };
  }

  // Check for connection timeout
  if ((rawError.includes('ERR_CONNECTION_TIMED_OUT') ||
       rawError.includes('ETIMEDOUT') ||
       rawError.includes('net::ERR_CONNECTION_TIMED_OUT')) &&
       !isAuditTimeoutError) {
    return { errorType: 'connection_timeout' };
  }

  // Check for connection refused
  if (rawError.includes('ERR_CONNECTION_REFUSED') ||
      rawError.includes('ECONNREFUSED') ||
      rawError.includes('net::ERR_CONNECTION_REFUSED')) {
    return { errorType: 'connection_refused' };
  }

  // Check for SSL/TLS errors
  if (rawError.includes('ERR_CERT_') ||
      rawError.includes('ERR_SSL_') ||
      rawError.includes('CERT_') ||
      rawError.includes('SSL_') ||
      rawError.includes('certificate')) {

    let sslErrorCode = 'CERTIFICATE_ERROR';
    let sslErrorDescription = 'certificate validation failed';
    let securityImplication = 'The connection may not be secure.';

    if (rawError.includes('ERR_CERT_DATE_INVALID') || rawError.includes('CERT_HAS_EXPIRED') || rawError.includes('EXPIRED')) {
      sslErrorCode = 'CERT_HAS_EXPIRED';
      sslErrorDescription = 'the SSL certificate has expired';
      securityImplication = 'Expired certificates indicate the site\'s security credentials are outdated and may have been compromised.';
    } else if (rawError.includes('ERR_CERT_AUTHORITY_INVALID') || rawError.includes('CERT_AUTHORITY_INVALID') || rawError.includes('self-signed') || rawError.includes('SELF_SIGNED')) {
      sslErrorCode = 'CERT_AUTHORITY_INVALID';
      sslErrorDescription = 'the certificate authority is not trusted (self-signed or unknown CA)';
      securityImplication = 'Self-signed certificates are not verified by a trusted authority. This is common in development environments but should not be used in production.';
    } else if (rawError.includes('ERR_CERT_COMMON_NAME_INVALID') || rawError.includes('COMMON_NAME_INVALID') || rawError.includes('hostname mismatch')) {
      sslErrorCode = 'CERT_COMMON_NAME_INVALID';
      sslErrorDescription = 'the certificate is for a different domain';
      securityImplication = 'The certificate was issued for a different website. This could indicate a man-in-the-middle attack or misconfiguration.';
    } else if (rawError.includes('ERR_CERT_REVOKED') || rawError.includes('CERT_REVOKED')) {
      sslErrorCode = 'CERT_REVOKED';
      sslErrorDescription = 'the certificate has been revoked';
      securityImplication = 'Revoked certificates have been invalidated by their issuing authority, often due to security concerns.';
    } else if (rawError.includes('ERR_SSL_VERSION_OR_CIPHER_MISMATCH') || rawError.includes('SSL_VERSION')) {
      sslErrorCode = 'SSL_VERSION_OR_CIPHER_MISMATCH';
      sslErrorDescription = 'the server uses an outdated or insecure SSL/TLS version';
      securityImplication = 'Outdated SSL/TLS versions have known vulnerabilities and should be upgraded.';
    } else if (rawError.includes('ERR_CERT_WEAK_KEY') || rawError.includes('WEAK_KEY')) {
      sslErrorCode = 'CERT_WEAK_KEY';
      sslErrorDescription = 'the certificate uses a weak cryptographic key';
      securityImplication = 'Weak keys can be cracked by attackers, compromising the security of the connection.';
    }

    return { errorType: 'ssl_error', sslErrorCode, sslErrorDescription, securityImplication };
  }

  // Check for generic unreachable errors
  if (rawError.includes('ERR_INTERNET_DISCONNECTED') ||
      rawError.includes('ERR_NETWORK_CHANGED') ||
      rawError.includes('ERR_NETWORK_') ||
      rawError.includes('ERR_FAILED') ||
      rawError.includes('net::ERR_FAILED') ||
      rawError.includes('ENETUNREACH') ||
      rawError.includes('EHOSTUNREACH')) {
    return { errorType: 'unreachable' };
  }

  return { errorType: 'unknown' };
}

/**
 * Generate user-friendly error message for Lighthouse errors
 */
export function generateLighthouseErrorMessage(
  errorType: string,
  targetUrl: string,
  test: LighthouseTestConfig,
  context: {
    configuredTimeoutSecs?: number;
    sslErrorCode?: string;
    sslErrorDescription?: string;
    securityImplication?: string;
    nonHtmlContentDescription?: string;
    nonHtmlSuggestedAuditType?: string;
  }
): { userFriendlyError: string; suggestion?: string } {
  const hostname = new URL(targetUrl).hostname;

  switch (errorType) {
    case 'browser_crash':
      return {
        userFriendlyError: `Lighthouse audit failed: Browser terminated unexpectedly. The browser process crashed during the performance analysis of '${targetUrl}'.`,
        suggestion: 'Try running the audit again. If the crash persists, the target page may be causing excessive memory usage or triggering a browser bug. Consider reducing page complexity or testing in smaller segments.',
      };

    case 'non_html':
      return {
        userFriendlyError: `Target is not an HTML page. The URL '${targetUrl}' returned ${context.nonHtmlContentDescription || 'non-HTML content'}.`,
        suggestion: context.nonHtmlSuggestedAuditType
          ? `Lighthouse performance audits are designed for HTML web pages. For ${context.nonHtmlContentDescription || 'this content type'}, consider using ${context.nonHtmlSuggestedAuditType}.`
          : 'Lighthouse audits require an HTML page. Please verify the target URL points to a web page.',
      };

    case 'audit_timeout':
      return {
        userFriendlyError: `Lighthouse audit timed out after ${context.configuredTimeoutSecs} seconds. The page at '${targetUrl}' took too long to stabilize for performance analysis.`,
        suggestion: `Try increasing the audit timeout (currently ${context.configuredTimeoutSecs}s) in test settings, or check if the target page has performance issues that prevent it from reaching network idle state.`,
      };

    case 'dns_resolution':
      return {
        userFriendlyError: `Unable to connect to target URL: DNS resolution failed. The domain '${hostname}' could not be resolved.`,
        suggestion: 'Check that the URL is spelled correctly and the domain exists. If testing a local service, ensure it is running and accessible.',
      };

    case 'connection_timeout':
      return {
        userFriendlyError: `Unable to connect to target URL: Connection timed out. The server at '${hostname}' did not respond within the timeout period.`,
        suggestion: 'The server may be down, overloaded, or there may be network issues. Check if the target is accessible from your network.',
      };

    case 'connection_refused':
      return {
        userFriendlyError: `Unable to connect to target URL: Connection refused. No service is listening at '${targetUrl}'.`,
        suggestion: 'Ensure the server is running and listening on the correct port. If testing locally, verify the application is started.',
      };

    case 'ssl_error':
      return {
        userFriendlyError: `SSL certificate error: ${context.sslErrorCode}. The connection to '${hostname}' failed because ${context.sslErrorDescription}.`,
        suggestion: test.ignore_ssl_errors
          ? `SSL errors are being ignored for this test (not recommended for production). Security implication: ${context.securityImplication}`
          : `Enable "Ignore SSL errors" option to bypass certificate validation for testing environments (use with caution). Security implication: ${context.securityImplication}`,
      };

    case 'unreachable':
      return {
        userFriendlyError: `Unable to connect to target URL: Network unreachable. Cannot establish a connection to '${hostname}'.`,
        suggestion: 'Check your network connection and ensure the target URL is accessible from this environment.',
      };

    default:
      return { userFriendlyError: 'Unknown error during Lighthouse audit' };
  }
}
