/**
 * Quick Test Runner Service
 * Feature #424: Orchestrates 4 parallel test waves for instant URL analysis
 *
 * Wave 1 - Health Check (1-2s): DNS, HTTP, SSL, response time, redirects
 * Wave 2 - Visual + Performance (10-15s): Lighthouse, screenshots, Core Web Vitals
 * Wave 3 - Security Scan (15-30s): OWASP headers, mixed content, cookies, exposed paths
 * Wave 4 - AI Analysis (5-10s): Test suggestions, UX issues, accessibility recommendations
 */

import dns from 'dns';
import tls from 'tls';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import { chromium, Browser, Page } from 'playwright';
import { getWebSocketIO } from './websocket-events.js';
import { aiService } from './ai-service.js';
import { isPrivateIP, validateURLForSSRF } from '../utils/index.js';
import { createLogger } from './logger.js';

// Feature #433: SSRF protection - check if resolved IPs are private
function validateResolvedIPs(addresses: string[]): { safe: boolean; error?: string } {
  for (const ip of addresses) {
    const result = isPrivateIP(ip);
    if (result.isPrivate) {
      return {
        safe: false,
        error: `DNS resolved to private IP address (${ip}${result.details ? ': ' + result.details : ''})`
      };
    }
  }
  return { safe: true };
}

// Feature #433: SSRF protection - validate redirect URLs
function validateRedirectURL(redirectUrl: string, isProduction: boolean): { safe: boolean; error?: string } {
  const validation = validateURLForSSRF(redirectUrl, {
    requireHttps: false,
    allowLocalhost: !isProduction,
  });
  if (!validation.safe) {
    return { safe: false, error: `Redirect to blocked URL: ${validation.error}` };
  }
  return { safe: true };
}

// ============================================================
// Types
// ============================================================

export interface QuickTestRequest {
  url: string;
  runId: string;
  orgId: string;
  userId: string;
}

export interface WaveResult {
  wave: number;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  data?: Record<string, unknown>;
  error?: string;
}

export interface QuickTestResult {
  runId: string;
  url: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  waves: WaveResult[];
  summary?: {
    healthScore: number;
    performanceScore: number;
    securityScore: number;
    overallScore: number;
  };
}

// Health Check types
interface HealthCheckResult {
  dns: {
    resolved: boolean;
    addresses?: string[];
    error?: string;
    durationMs: number;
  };
  http: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    durationMs: number;
    error?: string;
  };
  ssl?: {
    valid: boolean;
    issuer?: string;
    validFrom?: string;
    validTo?: string;
    daysUntilExpiry?: number;
    error?: string;
    durationMs: number;
  };
  redirects: Array<{
    from: string;
    to: string;
    status: number;
  }>;
  totalDurationMs: number;
}

// Visual + Performance types
interface VisualPerformanceResult {
  lighthouse?: {
    performance: number;
    accessibility: number;
    seo: number;
    bestPractices: number;
  };
  coreWebVitals?: {
    lcp?: number; // Largest Contentful Paint
    fid?: number; // First Input Delay
    cls?: number; // Cumulative Layout Shift
    fcp?: number; // First Contentful Paint
    ttfb?: number; // Time to First Byte
  };
  screenshots: {
    desktop?: string; // Base64 encoded
    mobile?: string;
  };
  loadTime: number;
}

// Security Scan types
interface SecurityScanResult {
  headers: {
    score: number;
    missing: string[];
    present: Record<string, string>;
    recommendations: string[];
  };
  cookies: Array<{
    name: string;
    secure: boolean;
    httpOnly: boolean;
    sameSite: string;
    issues: string[];
  }>;
  mixedContent: {
    detected: boolean;
    resources: string[];
  };
  exposedPaths: Array<{
    path: string;
    accessible: boolean;
    status: number;
  }>;
  overallScore: number;
}

// AI Analysis types
interface AIAnalysisResult {
  testSuggestions: Array<{
    type: 'e2e' | 'visual' | 'accessibility' | 'performance';
    name: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  uxIssues: Array<{
    severity: 'critical' | 'major' | 'minor';
    issue: string;
    recommendation: string;
  }>;
  accessibilityRecommendations: string[];
  summary: string;
}

// In-memory storage for quick test results (24h TTL)
const quickTestResults = new Map<string, QuickTestResult>();
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Feature #446: Bound in-memory Map with max size to prevent memory exhaustion
const MAX_RESULTS = 1000;
const quickTestLogger = createLogger('quick-test-runner');

/**
 * Feature #446: Evict oldest entry from the quickTestResults Map
 * Maps maintain insertion order, so the first entry is the oldest
 */
function evictOldestResult(): void {
  const firstKey = quickTestResults.keys().next().value;
  if (firstKey !== undefined) {
    quickTestResults.delete(firstKey);
    quickTestLogger.info({ evictedRunId: firstKey, mapSize: quickTestResults.size }, 'Evicted oldest quick test result due to max size limit');
  }
}

/**
 * Feature #446: Safe set operation that enforces max size limit
 * Evicts oldest entries if the Map exceeds MAX_RESULTS
 */
function safeSetQuickTestResult(runId: string, result: QuickTestResult): void {
  // Check if we need to evict before inserting
  if (quickTestResults.size >= MAX_RESULTS && !quickTestResults.has(runId)) {
    evictOldestResult();
  }
  quickTestResults.set(runId, result);
}

// ============================================================
// Wave Emitters
// ============================================================

function emitWaveEvent(orgId: string, runId: string, event: string, data: Record<string, unknown>) {
  const io = getWebSocketIO();
  if (io) {
    const payload = { orgId, runId, ...data };
    io.to(`org:${orgId}`).emit(event, payload);
    io.to(`quick-test:${runId}`).emit(event, payload);
  }
}

function emitWaveStart(orgId: string, runId: string, wave: number, name: string) {
  emitWaveEvent(orgId, runId, 'wave:start', { wave, name, startedAt: new Date() });
}

function emitWaveProgress(orgId: string, runId: string, wave: number, progress: number, message?: string) {
  emitWaveEvent(orgId, runId, 'wave:progress', { wave, progress, message });
}

function emitWaveComplete(orgId: string, runId: string, wave: number, data: Record<string, unknown>) {
  emitWaveEvent(orgId, runId, 'wave:complete', { wave, completedAt: new Date(), data });
}

function emitWaveError(orgId: string, runId: string, wave: number, error: string) {
  emitWaveEvent(orgId, runId, 'wave:error', { wave, error });
}

// ============================================================
// Wave 1: Health Check
// ============================================================

async function runHealthCheck(url: string): Promise<HealthCheckResult> {
  const parsedUrl = new URL(url);
  const isHttps = parsedUrl.protocol === 'https:';
  const hostname = parsedUrl.hostname;
  const port = parsedUrl.port || (isHttps ? 443 : 80);

  const result: HealthCheckResult = {
    dns: { resolved: false, durationMs: 0 },
    http: { status: 0, statusText: '', headers: {}, durationMs: 0 },
    redirects: [],
    totalDurationMs: 0,
  };

  const totalStart = Date.now();

  // DNS Resolution with SSRF protection (Feature #433)
  const dnsStart = Date.now();
  const isProduction = process.env.NODE_ENV === 'production';
  try {
    const addresses = await dns.promises.resolve4(hostname);

    // Feature #433: Validate resolved IPs are not private/internal
    const ipValidation = validateResolvedIPs(addresses);
    if (!ipValidation.safe) {
      result.dns = {
        resolved: false,
        error: ipValidation.error || 'DNS resolved to private IP address',
        durationMs: Date.now() - dnsStart,
      };
      // Stop further processing - this is an SSRF attempt
      result.totalDurationMs = Date.now() - totalStart;
      throw new Error(ipValidation.error || 'SSRF protection: DNS resolved to private IP');
    }

    result.dns = {
      resolved: true,
      addresses,
      durationMs: Date.now() - dnsStart,
    };
  } catch (err) {
    result.dns = {
      resolved: false,
      error: err instanceof Error ? err.message : 'DNS resolution failed',
      durationMs: Date.now() - dnsStart,
    };
    // If DNS validation failed due to private IP, re-throw to stop processing
    if (err instanceof Error && err.message.includes('SSRF protection')) {
      throw err;
    }
  }

  // SSL Certificate Check (if HTTPS)
  if (isHttps) {
    const sslStart = Date.now();
    try {
      const sslResult = await new Promise<Omit<NonNullable<HealthCheckResult['ssl']>, 'durationMs'>>((resolve, reject) => {
        const socket = tls.connect(
          { host: hostname, port: Number(port), servername: hostname },
          () => {
            const cert = socket.getPeerCertificate();
            if (cert && cert.valid_to) {
              const validTo = new Date(cert.valid_to);
              const now = new Date();
              const daysUntilExpiry = Math.floor((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              resolve({
                valid: true,
                issuer: cert.issuer?.O || 'Unknown',
                validFrom: cert.valid_from,
                validTo: cert.valid_to,
                daysUntilExpiry,
              });
            } else {
              resolve({ valid: false, error: 'No certificate found' });
            }
            socket.end();
          }
        );
        socket.on('error', (err) => {
          reject(err);
        });
        socket.setTimeout(5000, () => {
          socket.destroy();
          reject(new Error('SSL connection timeout'));
        });
      });
      result.ssl = { ...sslResult, durationMs: Date.now() - sslStart };
    } catch (err) {
      result.ssl = {
        valid: false,
        error: err instanceof Error ? err.message : 'SSL check failed',
        durationMs: Date.now() - sslStart,
      };
    }
  }

  // HTTP Request with redirect tracking
  const httpStart = Date.now();
  try {
    const httpResult = await new Promise<{ status: number; statusText: string; headers: Record<string, string>; redirects: HealthCheckResult['redirects'] }>((resolve, reject) => {
      const client = isHttps ? https : http;
      const redirects: HealthCheckResult['redirects'] = [];
      let currentUrl = url;

      const makeRequest = (requestUrl: string, redirectCount: number) => {
        if (redirectCount > 5) {
          reject(new Error('Too many redirects'));
          return;
        }

        const req = client.request(requestUrl, { method: 'HEAD', timeout: 10000 }, (res) => {
          const statusCode = res.statusCode || 0;

          if (statusCode >= 300 && statusCode < 400 && res.headers.location) {
            const newUrl = new URL(res.headers.location, requestUrl).toString();

            // Feature #433: SSRF protection - validate redirect URLs
            const redirectValidation = validateRedirectURL(newUrl, isProduction);
            if (!redirectValidation.safe) {
              reject(new Error(redirectValidation.error || 'Redirect to blocked URL'));
              return;
            }

            redirects.push({
              from: currentUrl,
              to: newUrl,
              status: statusCode,
            });
            currentUrl = newUrl;
            makeRequest(newUrl, redirectCount + 1);
          } else {
            const headers: Record<string, string> = {};
            Object.entries(res.headers).forEach(([key, value]) => {
              if (typeof value === 'string') {
                headers[key] = value;
              } else if (Array.isArray(value)) {
                headers[key] = value.join(', ');
              }
            });
            resolve({
              status: statusCode,
              statusText: res.statusMessage || '',
              headers,
              redirects,
            });
          }
        });

        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('HTTP request timeout'));
        });
        req.end();
      };

      makeRequest(url, 0);
    });

    result.http = {
      status: httpResult.status,
      statusText: httpResult.statusText,
      headers: httpResult.headers,
      durationMs: Date.now() - httpStart,
    };
    result.redirects = httpResult.redirects;
  } catch (err) {
    result.http = {
      status: 0,
      statusText: '',
      headers: {},
      error: err instanceof Error ? err.message : 'HTTP request failed',
      durationMs: Date.now() - httpStart,
    };
  }

  result.totalDurationMs = Date.now() - totalStart;
  return result;
}

// ============================================================
// Wave 2: Visual + Performance
// ============================================================

async function runVisualPerformance(url: string, browser: Browser): Promise<VisualPerformanceResult> {
  const result: VisualPerformanceResult = {
    screenshots: {},
    loadTime: 0,
  };

  let page: Page | null = null;

  try {
    // Desktop screenshot and metrics
    page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
    });

    const loadStart = Date.now();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    result.loadTime = Date.now() - loadStart;

    // Get Core Web Vitals via Performance API
    const performanceMetrics = await page.evaluate(() => {
      const entries = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      const paintEntries = performance.getEntriesByType('paint');
      const fcpEntry = paintEntries.find(e => e.name === 'first-contentful-paint');

      return {
        ttfb: entries?.responseStart ? Math.round(entries.responseStart) : undefined,
        fcp: fcpEntry ? Math.round(fcpEntry.startTime) : undefined,
        domContentLoaded: entries?.domContentLoadedEventEnd ? Math.round(entries.domContentLoadedEventEnd) : undefined,
        load: entries?.loadEventEnd ? Math.round(entries.loadEventEnd) : undefined,
      };
    });

    result.coreWebVitals = {
      ttfb: performanceMetrics.ttfb,
      fcp: performanceMetrics.fcp,
    };

    // Get LCP via PerformanceObserver (if available)
    try {
      const lcp = await page.evaluate(() => {
        return new Promise<number | undefined>((resolve) => {
          let lcpValue: number | undefined;
          const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            if (lastEntry) {
              lcpValue = Math.round(lastEntry.startTime);
            }
          });
          observer.observe({ type: 'largest-contentful-paint', buffered: true });
          setTimeout(() => {
            observer.disconnect();
            resolve(lcpValue);
          }, 1000);
        });
      });
      if (lcp) {
        result.coreWebVitals.lcp = lcp;
      }
    } catch {
      // LCP observer not supported, skip
    }

    // Desktop screenshot
    const desktopScreenshot = await page.screenshot({ type: 'png', fullPage: false });
    result.screenshots.desktop = desktopScreenshot.toString('base64');

    await page.close();

    // Mobile screenshot
    page = await browser.newPage({
      viewport: { width: 375, height: 812 },
      isMobile: true,
    });
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    const mobileScreenshot = await page.screenshot({ type: 'png', fullPage: false });
    result.screenshots.mobile = mobileScreenshot.toString('base64');

    await page.close();
    page = null;

    // Simplified Lighthouse-like scores based on metrics
    const performanceScore = calculatePerformanceScore(result);
    result.lighthouse = {
      performance: performanceScore,
      accessibility: 0, // Would need axe-core for proper scoring
      seo: 0, // Would need additional checks
      bestPractices: 0, // Would need additional checks
    };

  } catch (err) {
    console.error('[Quick Test] Visual/Performance wave error:', err);
    if (page) {
      await page.close().catch(() => {});
    }
    throw err;
  }

  return result;
}

function calculatePerformanceScore(result: VisualPerformanceResult): number {
  const cwv = result.coreWebVitals;
  if (!cwv) return 50;

  let score = 100;

  // TTFB scoring
  if (cwv.ttfb) {
    if (cwv.ttfb > 800) score -= 20;
    else if (cwv.ttfb > 500) score -= 10;
  }

  // FCP scoring
  if (cwv.fcp) {
    if (cwv.fcp > 3000) score -= 25;
    else if (cwv.fcp > 1800) score -= 15;
    else if (cwv.fcp > 1000) score -= 5;
  }

  // LCP scoring
  if (cwv.lcp) {
    if (cwv.lcp > 4000) score -= 25;
    else if (cwv.lcp > 2500) score -= 15;
    else if (cwv.lcp > 1500) score -= 5;
  }

  // Load time scoring
  if (result.loadTime > 5000) score -= 15;
  else if (result.loadTime > 3000) score -= 10;

  return Math.max(0, Math.min(100, score));
}

// ============================================================
// Wave 3: Security Scan
// ============================================================

async function runSecurityScan(url: string, browser: Browser): Promise<SecurityScanResult> {
  const result: SecurityScanResult = {
    headers: {
      score: 0,
      missing: [],
      present: {},
      recommendations: [],
    },
    cookies: [],
    mixedContent: {
      detected: false,
      resources: [],
    },
    exposedPaths: [],
    overallScore: 0,
  };

  let page: Page | null = null;

  try {
    page = await browser.newPage();
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    if (response) {
      // Check security headers
      const headers = response.headers();
      const securityHeaders = [
        { name: 'content-security-policy', importance: 'critical' },
        { name: 'strict-transport-security', importance: 'critical' },
        { name: 'x-frame-options', importance: 'high' },
        { name: 'x-content-type-options', importance: 'high' },
        { name: 'referrer-policy', importance: 'medium' },
        { name: 'permissions-policy', importance: 'medium' },
        { name: 'x-xss-protection', importance: 'low' }, // Deprecated but still checked
      ];

      let headerScore = 100;
      for (const header of securityHeaders) {
        if (headers[header.name]) {
          result.headers.present[header.name] = headers[header.name];
        } else {
          result.headers.missing.push(header.name);
          if (header.importance === 'critical') headerScore -= 20;
          else if (header.importance === 'high') headerScore -= 15;
          else if (header.importance === 'medium') headerScore -= 10;
          else headerScore -= 5;
        }
      }
      result.headers.score = Math.max(0, headerScore);

      // Generate recommendations
      if (result.headers.missing.includes('content-security-policy')) {
        result.headers.recommendations.push('Add Content-Security-Policy header to prevent XSS attacks');
      }
      if (result.headers.missing.includes('strict-transport-security')) {
        result.headers.recommendations.push('Add Strict-Transport-Security header to enforce HTTPS');
      }
      if (result.headers.missing.includes('x-frame-options')) {
        result.headers.recommendations.push('Add X-Frame-Options header to prevent clickjacking');
      }
    }

    // Check cookies
    const cookies = await page.context().cookies();
    for (const cookie of cookies) {
      const issues: string[] = [];
      if (!cookie.secure) issues.push('Missing Secure flag');
      if (!cookie.httpOnly) issues.push('Missing HttpOnly flag');
      if (cookie.sameSite === 'None' && !cookie.secure) issues.push('SameSite=None requires Secure');

      result.cookies.push({
        name: cookie.name,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        sameSite: cookie.sameSite || 'Lax',
        issues,
      });
    }

    // Check for mixed content
    const mixedResources = await page.evaluate(() => {
      const resources: string[] = [];
      const elements = document.querySelectorAll('img, script, link, iframe');
      elements.forEach((el) => {
        const src = el.getAttribute('src') || el.getAttribute('href');
        if (src && src.startsWith('http://')) {
          resources.push(src);
        }
      });
      return resources;
    });

    if (mixedResources.length > 0) {
      result.mixedContent.detected = true;
      result.mixedContent.resources = mixedResources.slice(0, 10); // Limit to 10
    }

    await page.close();
    page = null;

    // Check exposed paths
    const exposedPaths = ['/admin', '/.env', '/.git/config', '/wp-admin', '/phpinfo.php', '/server-status'];
    const parsedUrl = new URL(url);

    for (const path of exposedPaths) {
      try {
        const checkUrl = `${parsedUrl.origin}${path}`;
        const checkPage = await browser.newPage();
        const resp = await checkPage.goto(checkUrl, { timeout: 5000, waitUntil: 'domcontentloaded' }).catch(() => null);
        const status = resp?.status() || 0;
        result.exposedPaths.push({
          path,
          accessible: status >= 200 && status < 400,
          status,
        });
        await checkPage.close();
      } catch {
        result.exposedPaths.push({
          path,
          accessible: false,
          status: 0,
        });
      }
    }

    // Calculate overall security score
    let securityScore = result.headers.score;

    // Deduct for cookie issues
    const cookiesWithIssues = result.cookies.filter(c => c.issues.length > 0);
    securityScore -= cookiesWithIssues.length * 5;

    // Deduct for mixed content
    if (result.mixedContent.detected) securityScore -= 15;

    // Deduct for exposed paths
    const exposedCount = result.exposedPaths.filter(p => p.accessible).length;
    securityScore -= exposedCount * 10;

    result.overallScore = Math.max(0, Math.min(100, securityScore));

  } catch (err) {
    console.error('[Quick Test] Security scan wave error:', err);
    if (page) {
      await page.close().catch(() => {});
    }
    throw err;
  }

  return result;
}

// ============================================================
// Wave 4: AI Analysis
// ============================================================

async function runAIAnalysis(
  url: string,
  healthResult: HealthCheckResult,
  visualResult: VisualPerformanceResult,
  securityResult: SecurityScanResult
): Promise<AIAnalysisResult> {
  const result: AIAnalysisResult = {
    testSuggestions: [],
    uxIssues: [],
    accessibilityRecommendations: [],
    summary: '',
  };

  try {
    if (!aiService.isInitialized()) {
      result.summary = 'AI analysis unavailable - no AI service configured';
      return result;
    }

    const prompt = `Analyze this website test results and provide recommendations.

URL: ${url}

## Health Check Results
- DNS Resolution: ${healthResult.dns.resolved ? 'Success' : 'Failed'}
- HTTP Status: ${healthResult.http.status} ${healthResult.http.statusText}
- SSL Valid: ${healthResult.ssl?.valid ?? 'N/A'}
- Response Time: ${healthResult.totalDurationMs}ms

## Performance Results
- Load Time: ${visualResult.loadTime}ms
- TTFB: ${visualResult.coreWebVitals?.ttfb ?? 'N/A'}ms
- FCP: ${visualResult.coreWebVitals?.fcp ?? 'N/A'}ms
- LCP: ${visualResult.coreWebVitals?.lcp ?? 'N/A'}ms
- Performance Score: ${visualResult.lighthouse?.performance ?? 'N/A'}

## Security Results
- Security Header Score: ${securityResult.headers.score}/100
- Missing Headers: ${securityResult.headers.missing.join(', ') || 'None'}
- Cookies with Issues: ${securityResult.cookies.filter(c => c.issues.length > 0).length}
- Mixed Content: ${securityResult.mixedContent.detected ? 'Detected' : 'None'}
- Exposed Paths: ${securityResult.exposedPaths.filter(p => p.accessible).map(p => p.path).join(', ') || 'None'}

Please provide a JSON response with:
1. testSuggestions: Array of {type: 'e2e'|'visual'|'accessibility'|'performance', name: string, description: string, priority: 'high'|'medium'|'low'}
2. uxIssues: Array of {severity: 'critical'|'major'|'minor', issue: string, recommendation: string}
3. accessibilityRecommendations: Array of strings
4. summary: A brief summary of findings (1-2 sentences)

Respond ONLY with valid JSON, no markdown or explanation.`;

    const response = await aiService.sendMessage([
      { role: 'user', content: prompt }
    ], {
      maxTokens: 1000,
    });

    if (response.content) {
      try {
        // Try to parse as JSON
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          result.testSuggestions = parsed.testSuggestions || [];
          result.uxIssues = parsed.uxIssues || [];
          result.accessibilityRecommendations = parsed.accessibilityRecommendations || [];
          result.summary = parsed.summary || '';
        }
      } catch {
        // If JSON parsing fails, use the response as summary
        result.summary = response.content.substring(0, 200);
      }
    }

  } catch (err) {
    console.error('[Quick Test] AI analysis wave error:', err);
    result.summary = 'AI analysis failed - see logs for details';
  }

  return result;
}

// ============================================================
// Main Runner
// ============================================================

export async function runQuickTest(request: QuickTestRequest): Promise<void> {
  const { url, runId, orgId } = request;

  // Initialize result
  const testResult: QuickTestResult = {
    runId,
    url,
    status: 'running',
    startedAt: new Date(),
    waves: [
      { wave: 1, name: 'Health Check', status: 'pending' },
      { wave: 2, name: 'Visual + Performance', status: 'pending' },
      { wave: 3, name: 'Security Scan', status: 'pending' },
      { wave: 4, name: 'AI Analysis', status: 'pending' },
    ],
  };

  // Feature #446: Use safe setter that enforces max size limit
  safeSetQuickTestResult(runId, testResult);

  // Schedule cleanup after TTL
  setTimeout(() => {
    quickTestResults.delete(runId);
  }, TTL_MS);

  let browser: Browser | null = null;
  let healthResult: HealthCheckResult | undefined;
  let visualResult: VisualPerformanceResult | undefined;
  let securityResult: SecurityScanResult | undefined;

  try {
    // Launch browser once for waves 2 and 3
    browser = await chromium.launch({ headless: true });

    // Wave 1: Health Check
    emitWaveStart(orgId, runId, 1, 'Health Check');
    testResult.waves[0].status = 'running';
    testResult.waves[0].startedAt = new Date();

    try {
      healthResult = await runHealthCheck(url);
      testResult.waves[0].status = 'completed';
      testResult.waves[0].completedAt = new Date();
      testResult.waves[0].duration = healthResult.totalDurationMs;
      testResult.waves[0].data = healthResult as unknown as Record<string, unknown>;
      emitWaveComplete(orgId, runId, 1, healthResult as unknown as Record<string, unknown>);
    } catch (err) {
      testResult.waves[0].status = 'failed';
      testResult.waves[0].error = err instanceof Error ? err.message : 'Health check failed';
      emitWaveError(orgId, runId, 1, testResult.waves[0].error);
    }

    // Wave 2: Visual + Performance
    emitWaveStart(orgId, runId, 2, 'Visual + Performance');
    testResult.waves[1].status = 'running';
    testResult.waves[1].startedAt = new Date();

    try {
      const wave2Start = Date.now();
      visualResult = await runVisualPerformance(url, browser);
      testResult.waves[1].status = 'completed';
      testResult.waves[1].completedAt = new Date();
      testResult.waves[1].duration = Date.now() - wave2Start;
      // Don't include base64 screenshots in wave data to reduce payload
      const visualDataForEmit = {
        lighthouse: visualResult.lighthouse,
        coreWebVitals: visualResult.coreWebVitals,
        loadTime: visualResult.loadTime,
        hasDesktopScreenshot: !!visualResult.screenshots.desktop,
        hasMobileScreenshot: !!visualResult.screenshots.mobile,
      };
      testResult.waves[1].data = visualDataForEmit;
      emitWaveComplete(orgId, runId, 2, visualDataForEmit);
    } catch (err) {
      testResult.waves[1].status = 'failed';
      testResult.waves[1].error = err instanceof Error ? err.message : 'Visual/Performance check failed';
      emitWaveError(orgId, runId, 2, testResult.waves[1].error);
    }

    // Wave 3: Security Scan
    emitWaveStart(orgId, runId, 3, 'Security Scan');
    testResult.waves[2].status = 'running';
    testResult.waves[2].startedAt = new Date();

    try {
      const wave3Start = Date.now();
      securityResult = await runSecurityScan(url, browser);
      testResult.waves[2].status = 'completed';
      testResult.waves[2].completedAt = new Date();
      testResult.waves[2].duration = Date.now() - wave3Start;
      testResult.waves[2].data = securityResult as unknown as Record<string, unknown>;
      emitWaveComplete(orgId, runId, 3, securityResult as unknown as Record<string, unknown>);
    } catch (err) {
      testResult.waves[2].status = 'failed';
      testResult.waves[2].error = err instanceof Error ? err.message : 'Security scan failed';
      emitWaveError(orgId, runId, 3, testResult.waves[2].error);
    }

    // Close browser before AI analysis (not needed)
    await browser.close();
    browser = null;

    // Wave 4: AI Analysis
    emitWaveStart(orgId, runId, 4, 'AI Analysis');
    testResult.waves[3].status = 'running';
    testResult.waves[3].startedAt = new Date();

    try {
      const wave4Start = Date.now();
      const aiResult = await runAIAnalysis(
        url,
        healthResult || { dns: { resolved: false, durationMs: 0 }, http: { status: 0, statusText: '', headers: {}, durationMs: 0 }, redirects: [], totalDurationMs: 0 },
        visualResult || { screenshots: {}, loadTime: 0 },
        securityResult || { headers: { score: 0, missing: [], present: {}, recommendations: [] }, cookies: [], mixedContent: { detected: false, resources: [] }, exposedPaths: [], overallScore: 0 }
      );
      testResult.waves[3].status = 'completed';
      testResult.waves[3].completedAt = new Date();
      testResult.waves[3].duration = Date.now() - wave4Start;
      testResult.waves[3].data = aiResult as unknown as Record<string, unknown>;
      emitWaveComplete(orgId, runId, 4, aiResult as unknown as Record<string, unknown>);
    } catch (err) {
      testResult.waves[3].status = 'failed';
      testResult.waves[3].error = err instanceof Error ? err.message : 'AI analysis failed';
      emitWaveError(orgId, runId, 4, testResult.waves[3].error);
    }

    // Calculate summary scores
    const healthScore = healthResult?.dns.resolved && healthResult?.http.status >= 200 && healthResult?.http.status < 400 ? 100 : 50;
    const performanceScore = visualResult?.lighthouse?.performance || 50;
    const securityScore = securityResult?.overallScore || 50;

    testResult.summary = {
      healthScore,
      performanceScore,
      securityScore,
      overallScore: Math.round((healthScore + performanceScore + securityScore) / 3),
    };

    testResult.status = 'completed';
    testResult.completedAt = new Date();

    // Emit final completion event
    emitWaveEvent(orgId, runId, 'quick-test:complete', {
      status: 'completed',
      summary: testResult.summary,
      completedAt: testResult.completedAt,
    });

  } catch (err) {
    console.error('[Quick Test] Fatal error:', err);
    testResult.status = 'failed';
    testResult.completedAt = new Date();

    emitWaveEvent(orgId, runId, 'quick-test:error', {
      error: err instanceof Error ? err.message : 'Quick test failed',
    });

  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    // Feature #446: Use safe setter that enforces max size limit
    safeSetQuickTestResult(runId, testResult);
  }
}

// ============================================================
// Result Retrieval
// ============================================================

export function getQuickTestResult(runId: string): QuickTestResult | undefined {
  return quickTestResults.get(runId);
}

export function getQuickTestScreenshots(runId: string): { desktop?: string; mobile?: string } | undefined {
  const result = quickTestResults.get(runId);
  if (!result) return undefined;

  const visualWave = result.waves.find(w => w.wave === 2);
  if (!visualWave || visualWave.status !== 'completed') return undefined;

  // Get the full visual result (we stored partial data in wave.data)
  // Note: Screenshots are stored separately in the result object
  return undefined; // Screenshots aren't persisted in the simplified data
}
