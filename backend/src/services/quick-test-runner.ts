/**
 * Quick Test Runner Service
 * Feature #424: Orchestrates 6 parallel test waves for instant URL analysis
 *
 * Wave 1 - Health Check (1-2s): DNS, HTTP, SSL, response time, redirects
 * Wave 2 - Visual + Performance (10-15s): Lighthouse, screenshots, Core Web Vitals
 * Wave 3 - Security Scan (15-30s): OWASP headers, mixed content, cookies, exposed paths
 * Wave 4 - AI Analysis (5-10s): Test suggestions, UX issues, accessibility recommendations
 * Wave 5 - Accessibility (5-15s): axe-core WCAG 2.1 AA scan with violation breakdown
 * Wave 6 - API Discovery (3-10s): OpenAPI spec detection, endpoint health, auth checks
 */

import dns from 'dns';
import tls from 'tls';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import { chromium, firefox, webkit, Browser, BrowserContext, Page, BrowserType } from 'playwright';

// Feature #579: Browser type for cross-browser Quick Test
export type QuickTestBrowser = 'chromium' | 'firefox' | 'webkit';

// Feature #579: Map browser string to Playwright launcher
function getBrowserLauncher(browser: QuickTestBrowser): BrowserType {
  switch (browser) {
    case 'firefox': return firefox;
    case 'webkit': return webkit;
    default: return chromium;
  }
}
import { AxeBuilder } from '@axe-core/playwright';
import { getWebSocketIO } from './websocket-events.js';
import { aiService } from './ai-service.js';
import { isPrivateIP, validateURLForSSRF } from '../utils/index.js';
import { createLogger } from './logger.js';
// Feature #465: PostgreSQL persistence for Quick Test results
import {
  createQuickTestResult,
  completeQuickTestResult,
  getQuickTestResultById,
  type QuickTestWaveResult as DbWaveResult,
  type QuickTestSummary as DbSummary,
} from './repositories/quick-test.js';
// Feature #466: Persist screenshots to filesystem
import { saveScreenshot } from './quick-test-screenshots.js';
// Feature #472: OpenAPI spec parsing for API discovery
import { parseOpenAPISpec } from './openapi-parser.js';

// Feature #449: Use structured logger instead of console.*
const log = createLogger('quick-test-runner');

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
  // Feature #579: Cross-browser Quick Test (default: chromium)
  browser?: QuickTestBrowser;
}

export interface WaveResult {
  wave: number;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  data?: Record<string, unknown>;
  error?: string;
}

export interface QuickTestResult {
  runId: string;
  orgId: string; // Feature #461: Add orgId for IDOR protection
  url: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  waves: WaveResult[];
  summary?: {
    healthScore: number;
    performanceScore: number;
    securityScore: number;
    accessibilityScore: number; // Feature #471
    apiScore: number; // Feature #472
    seoScore: number; // Feature #527
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
  // Feature #563: Renamed from 'lighthouse' to 'performanceScores' to avoid misleading users.
  // These are custom heuristic scores derived from Core Web Vitals, NOT real Lighthouse audit results.
  performanceScores?: {
    performance: number;
    accessibility: number;
    seo: number;
    bestPractices: number;
  };
  coreWebVitals?: {
    lcp?: number; // Largest Contentful Paint
    fid?: number; // First Input Delay (deprecated, replaced by INP)
    cls?: number; // Cumulative Layout Shift
    fcp?: number; // First Contentful Paint
    ttfb?: number; // Time to First Byte
    inp?: number; // Feature #564: Interaction to Next Paint (replaced FID in March 2024)
  };
  screenshots: {
    desktop?: string; // Base64 encoded (temporary, before saving to disk)
    mobile?: string;
  };
  // Feature #466: URLs for saved screenshots (set after saving to disk)
  screenshotUrls?: {
    desktop?: string;
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
// Feature #467: Extended to include source field for vision vs metrics transparency
interface AIAnalysisResult {
  testSuggestions: Array<{
    type: 'e2e' | 'visual' | 'accessibility' | 'performance';
    name: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    source?: 'vision' | 'metrics'; // Feature #467: Track recommendation source
  }>;
  uxIssues: Array<{
    severity: 'critical' | 'major' | 'minor';
    issue: string;
    recommendation: string;
    source?: 'vision' | 'metrics'; // Feature #467: Track recommendation source
  }>;
  accessibilityRecommendations: Array<{
    recommendation: string;
    source?: 'vision' | 'metrics'; // Feature #467: Track recommendation source
  }> | string[]; // Support both formats for backward compatibility
  summary: string;
  visionAnalysisIncluded?: boolean; // Feature #467: Indicate if vision was used
}

// Feature #471: Accessibility scan result types
interface AccessibilityScanResult {
  score: number;
  violations: Array<{
    id: string;
    impact: 'critical' | 'serious' | 'moderate' | 'minor';
    description: string;
    help: string;
    helpUrl: string;
    wcagTags: string[];
    nodes: Array<{
      html: string;
      target: string[];
      failureSummary?: string;
    }>;
  }>;
  violationCounts: {
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
    total: number;
  };
  passesCount: number;
  wcagLevel: string;
  axeVersion: string;
}

// Feature #472: API Discovery scan result types
interface APIEndpoint {
  path: string;
  method: string;
  status: number;
  statusText: string;
  responseTimeMs: number;
  authRequired: boolean; // true if returns 401/403, false if returns 200 without auth
  isHealthy: boolean;
  contentType?: string;
  errorMessage?: string;
}

// Feature #527: SEO Analysis result types
interface SeoMetaTag {
  name: string;
  content: string | null;
  present: boolean;
  valid: boolean;
  issue?: string;
}

interface SeoAnalysisResult {
  score: number;
  metaTags: {
    title: SeoMetaTag;
    description: SeoMetaTag;
    canonical: SeoMetaTag;
    ogTitle: SeoMetaTag;
    ogDescription: SeoMetaTag;
    ogImage: SeoMetaTag;
    twitterCard: SeoMetaTag;
    twitterTitle: SeoMetaTag;
    twitterDescription: SeoMetaTag;
    viewport: SeoMetaTag;
    robots: SeoMetaTag;
  };
  headingStructure: {
    h1Count: number;
    h1Texts: string[];
    hasMultipleH1: boolean;
    headingHierarchy: Array<{ level: number; text: string }>;
    hierarchyValid: boolean;
    issues: string[];
  };
  crawlability: {
    robotsTxt: {
      present: boolean;
      url: string;
      content?: string;
      allowsCrawling: boolean;
    };
    sitemap: {
      present: boolean;
      url: string;
      urlCount?: number;
    };
  };
  // Feature #528: Schema Markup Detection
  schemaMarkup: {
    jsonLdScripts: Array<{
      type: string;
      raw: string;
      valid: boolean;
      error?: string;
    }>;
    microdataItems: Array<{
      type: string;
      itemCount: number;
    }>;
    detectedTypes: string[];
    hasStructuredData: boolean;
    issues: string[];
  };
  // Feature #529: Navigation Visibility Check
  navigation: {
    hasNavElement: boolean;
    hasHeader: boolean;
    hasFooter: boolean;
    hasBreadcrumbs: boolean;
    hasMobileMenuToggle: boolean;
    navElements: Array<{
      type: 'nav' | 'role-navigation' | 'header' | 'footer' | 'breadcrumb';
      visible: boolean;
      ariaLabel?: string;
    }>;
    issues: string[];
  };
  // Feature #530: Tracking Scripts Detection
  tracking: {
    scripts: Array<{
      name: string;
      type: 'gtm' | 'ga4' | 'fb_pixel' | 'hotjar' | 'linkedin' | 'other';
      id?: string;
      source: 'script_src' | 'window_global' | 'inline';
    }>;
    hasGTM: boolean;
    hasGA4: boolean;
    hasFBPixel: boolean;
    hasHotjar: boolean;
    hasLinkedIn: boolean;
    summary: string;
  };
  issues: string[];
  recommendations: string[];
}

interface APIDiscoveryResult {
  score: number;
  discoveredPaths: string[];
  openAPISpec?: {
    found: boolean;
    url?: string;
    title?: string;
    version?: string;
    endpointCount?: number;
  };
  endpoints: APIEndpoint[];
  summary: {
    total: number;
    healthy: number;
    unhealthy: number;
    protected: number; // endpoints requiring auth
    unprotected: number; // endpoints returning 200 without auth
    byMethod: Record<string, number>;
  };
  securityConcerns: Array<{
    type: 'unprotected_sensitive' | 'no_auth_check' | 'exposed_docs';
    path: string;
    description: string;
    severity: 'high' | 'medium' | 'low';
  }>;
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
  let context: BrowserContext | null = null;

  try {
    // Desktop screenshot and metrics
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    page = await context.newPage();

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

    // Feature #564: Measure CLS (Cumulative Layout Shift) via PerformanceObserver
    try {
      const cls = await page.evaluate(() => {
        return new Promise<number | undefined>((resolve) => {
          let clsValue = 0;
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              // Only count layout shifts that aren't triggered by user input
              if (!(entry as any).hadRecentInput) {
                clsValue += (entry as any).value;
              }
            }
          });
          observer.observe({ type: 'layout-shift', buffered: true });
          setTimeout(() => {
            observer.disconnect();
            resolve(clsValue > 0 ? Math.round(clsValue * 1000) / 1000 : undefined);
          }, 1000);
        });
      });
      if (cls !== undefined) {
        result.coreWebVitals!.cls = cls;
      }
    } catch {
      // layout-shift observer not supported, skip
    }

    // Feature #564: Measure INP (Interaction to Next Paint) via PerformanceObserver
    // INP replaced FID as a Core Web Vital in March 2024
    // For synthetic tests, we simulate a click interaction and measure processing time
    try {
      const inp = await page.evaluate(() => {
        return new Promise<number | undefined>((resolve) => {
          let maxDuration = 0;
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              // event entries have duration property representing interaction latency
              const duration = (entry as any).duration;
              if (duration && duration > maxDuration) {
                maxDuration = duration;
              }
            }
          });
          try {
            observer.observe({ type: 'event', buffered: true });
          } catch {
            // 'event' type not supported
            resolve(undefined);
            return;
          }
          // Trigger a click interaction to generate event timing entries
          document.body?.click();
          setTimeout(() => {
            observer.disconnect();
            resolve(maxDuration > 0 ? Math.round(maxDuration) : undefined);
          }, 500);
        });
      });
      if (inp !== undefined) {
        result.coreWebVitals!.inp = inp;
      }
    } catch {
      // event observer not supported, skip
    }

    // Desktop screenshot
    const desktopScreenshot = await page.screenshot({ type: 'png', fullPage: false });
    result.screenshots.desktop = desktopScreenshot.toString('base64');

    // Close desktop context (also closes page)
    await context.close();
    context = null;
    page = null;

    // Mobile screenshot
    context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true,
    });
    page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    const mobileScreenshot = await page.screenshot({ type: 'png', fullPage: false });
    result.screenshots.mobile = mobileScreenshot.toString('base64');

    // Close mobile context
    await context.close();
    context = null;
    page = null;

    // Feature #563: Custom heuristic scores based on Core Web Vitals metrics (NOT real Lighthouse)
    const performanceScore = calculatePerformanceScore(result);
    result.performanceScores = {
      performance: performanceScore,
      accessibility: 0, // Quick Test uses axe-core in Wave 5 instead
      seo: 0, // Quick Test uses dedicated SEO wave instead
      bestPractices: 0, // Not assessed in Quick Test
    };

  } catch (err) {
    log.error({ error: err }, 'Visual/Performance wave error');
    if (context) {
      await context.close().catch(() => {});
    } else if (page) {
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

  // Feature #564: CLS scoring (thresholds per Google: Good ≤0.1, Needs Improvement ≤0.25)
  if (cwv.cls !== undefined) {
    if (cwv.cls > 0.25) score -= 20;
    else if (cwv.cls > 0.1) score -= 10;
  }

  // Feature #564: INP scoring (thresholds per Google: Good ≤200ms, Needs Improvement ≤500ms)
  if (cwv.inp) {
    if (cwv.inp > 500) score -= 20;
    else if (cwv.inp > 200) score -= 10;
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
  let context: BrowserContext | null = null;

  try {
    context = await browser.newContext();
    page = await context.newPage();
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

    // Close page and its context before checking exposed paths
    if (context) {
      await context.close();
      context = null;
    } else {
      await page.close();
    }
    page = null;

    // Check exposed paths
    const exposedPaths = ['/admin', '/.env', '/.git/config', '/wp-admin', '/phpinfo.php', '/server-status'];
    const parsedUrl = new URL(url);

    for (const path of exposedPaths) {
      let checkContext: BrowserContext | null = null;
      try {
        const checkUrl = `${parsedUrl.origin}${path}`;
        checkContext = await browser.newContext();
        const checkPage = await checkContext.newPage();
        const resp = await checkPage.goto(checkUrl, { timeout: 5000, waitUntil: 'domcontentloaded' }).catch(() => null);
        const status = resp?.status() || 0;
        result.exposedPaths.push({
          path,
          accessible: status >= 200 && status < 400,
          status,
        });
        await checkContext.close();
        checkContext = null;
      } catch {
        result.exposedPaths.push({
          path,
          accessible: false,
          status: 0,
        });
        if (checkContext) {
          await checkContext.close().catch(() => {});
        }
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
    log.error({ error: err }, 'Security scan wave error');
    if (context) {
      await context.close().catch(() => {});
    } else if (page) {
      await page.close().catch(() => {});
    }
    throw err;
  }

  return result;
}

// ============================================================
// Wave 4: AI Analysis
// ============================================================

/**
 * Feature #467: Run AI analysis with optional vision capability
 * If desktop screenshot is available, passes it to Claude Vision for
 * dramatically better UX and visual analysis recommendations.
 */
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
    visionAnalysisIncluded: false,
  };

  try {
    // Feature #520: Graceful degradation when AI provider not configured
    if (!aiService.isConfigured()) {
      log.info('AI provider not configured - skipping AI analysis wave');
      result.summary = 'AI provider not configured. Add an AI API key in Settings → AI Configuration to enable AI-powered analysis.';
      (result as unknown as Record<string, unknown>).skipped = true;
      (result as unknown as Record<string, unknown>).skipReason = 'no_api_key';
      return result;
    }

    if (!aiService.isInitialized()) {
      log.warn('AI service not initialized despite having config - skipping AI analysis wave');
      result.summary = 'AI service could not initialize. Check your API key configuration in Settings → AI Configuration.';
      (result as unknown as Record<string, unknown>).skipped = true;
      (result as unknown as Record<string, unknown>).skipReason = 'initialization_failed';
      return result;
    }

    // Feature #467: Check if we have a desktop screenshot for vision analysis
    const hasScreenshot = !!visualResult.screenshots.desktop;

    // Build the metrics-based context (always included)
    const metricsContext = `## URL Analyzed
${url}

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
- Performance Score: ${visualResult.performanceScores?.performance ?? 'N/A'}

## Security Results
- Security Header Score: ${securityResult.headers.score}/100
- Missing Headers: ${securityResult.headers.missing.join(', ') || 'None'}
- Cookies with Issues: ${securityResult.cookies.filter(c => c.issues.length > 0).length}
- Mixed Content: ${securityResult.mixedContent.detected ? 'Detected' : 'None'}
- Exposed Paths: ${securityResult.exposedPaths.filter(p => p.accessible).map(p => p.path).join(', ') || 'None'}`;

    // Feature #467: Build prompt with vision-specific instructions if screenshot available
    const visionInstructions = hasScreenshot ? `
## IMPORTANT: Visual Analysis Instructions
I'm providing a screenshot of this webpage. Please analyze it visually and identify:
1. **Visual Hierarchy Issues**: Poor contrast, hard-to-read text, unclear CTAs, confusing layout
2. **UX Problems**: Cluttered interface, missing visual feedback, poor spacing, accessibility concerns
3. **Layout Anomalies**: Misaligned elements, broken layouts, overlapping content, responsive issues
4. **Design Recommendations**: Improvements for user experience based on what you see

When providing recommendations, include "source": "vision" for insights based on the screenshot visual analysis, and "source": "metrics" for insights based on the performance/security data above.` : '';

    const outputFormat = `
## Required JSON Response Format
Respond with ONLY valid JSON (no markdown, no explanation):
{
  "testSuggestions": [
    {"type": "e2e"|"visual"|"accessibility"|"performance", "name": "string", "description": "string", "priority": "high"|"medium"|"low", "source": "vision"|"metrics"}
  ],
  "uxIssues": [
    {"severity": "critical"|"major"|"minor", "issue": "string", "recommendation": "string", "source": "vision"|"metrics"}
  ],
  "accessibilityRecommendations": [
    {"recommendation": "string", "source": "vision"|"metrics"}
  ],
  "summary": "Brief summary of findings (1-2 sentences)"
}`;

    const prompt = `Analyze this website and provide test recommendations and UX insights.

${metricsContext}
${visionInstructions}
${outputFormat}`;

    // Feature #467: Build message content with optional vision
    let messageContent: string | Array<{ type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: 'image/png'; data: string } }>;

    if (hasScreenshot && visualResult.screenshots.desktop) {
      log.info({ url }, 'Including desktop screenshot in AI analysis (vision mode)');
      messageContent = [
        {
          type: 'text' as const,
          text: prompt,
        },
        {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: 'image/png' as const,
            data: visualResult.screenshots.desktop,
          },
        },
      ];
      result.visionAnalysisIncluded = true;
    } else {
      log.info({ url }, 'No screenshot available, using metrics-only AI analysis');
      messageContent = prompt;
    }

    const response = await aiService.sendMessage([
      { role: 'user', content: messageContent }
    ], {
      maxTokens: 2000, // Increased for vision analysis
    });

    if (response.content) {
      try {
        // Try to parse as JSON
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);

          // Process test suggestions with source tagging
          result.testSuggestions = (parsed.testSuggestions || []).map((s: {
            type: 'e2e' | 'visual' | 'accessibility' | 'performance';
            name: string;
            description: string;
            priority: 'high' | 'medium' | 'low';
            source?: 'vision' | 'metrics';
          }) => ({
            ...s,
            source: s.source || 'metrics', // Default to metrics if not specified
          }));

          // Process UX issues with source tagging
          result.uxIssues = (parsed.uxIssues || []).map((u: {
            severity: 'critical' | 'major' | 'minor';
            issue: string;
            recommendation: string;
            source?: 'vision' | 'metrics';
          }) => ({
            ...u,
            source: u.source || 'metrics',
          }));

          // Process accessibility recommendations (handle both array of strings and objects)
          const rawAccessibility = parsed.accessibilityRecommendations || [];
          result.accessibilityRecommendations = rawAccessibility.map((r: string | { recommendation: string; source?: 'vision' | 'metrics' }) => {
            if (typeof r === 'string') {
              return { recommendation: r, source: 'metrics' as const };
            }
            return { ...r, source: r.source || 'metrics' };
          });

          result.summary = parsed.summary || '';
        }
      } catch (parseError) {
        // If JSON parsing fails, use the response as summary
        log.warn({ error: parseError }, 'Failed to parse AI response as JSON');
        result.summary = response.content.substring(0, 200);
      }
    }

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error';
    log.error({ error: err }, 'AI analysis wave error');
    // Feature #520: User-friendly error messages
    if (errMsg.includes('401') || errMsg.includes('unauthorized') || errMsg.includes('invalid_api_key')) {
      result.summary = 'AI API key is invalid or expired. Update your key in Settings → AI Configuration.';
    } else if (errMsg.includes('429') || errMsg.includes('rate_limit')) {
      result.summary = 'AI provider rate limit reached. Please wait a moment and try again.';
    } else if (errMsg.includes('timeout') || errMsg.includes('ETIMEDOUT')) {
      result.summary = 'AI provider timed out. The service may be temporarily slow.';
    } else {
      result.summary = `AI analysis encountered an error: ${errMsg.substring(0, 100)}`;
    }
  }

  return result;
}

// ============================================================
// Wave 6: API Discovery
// ============================================================

/**
 * Feature #472: API endpoint discovery and basic health testing
 * Probes common API paths, looks for OpenAPI specs, and tests endpoint health
 */
async function runAPIDiscovery(url: string): Promise<APIDiscoveryResult> {
  const result: APIDiscoveryResult = {
    score: 0,
    discoveredPaths: [],
    endpoints: [],
    summary: {
      total: 0,
      healthy: 0,
      unhealthy: 0,
      protected: 0,
      unprotected: 0,
      byMethod: {},
    },
    securityConcerns: [],
  };

  const parsedUrl = new URL(url);
  const baseUrl = parsedUrl.origin;

  // Common API paths to probe
  const commonApiPaths = [
    '/api',
    '/api/v1',
    '/api/v2',
    '/v1',
    '/v2',
    '/graphql',
    '/rest',
  ];

  // OpenAPI/Swagger spec paths
  const openApiPaths = [
    '/swagger.json',
    '/openapi.json',
    '/api-docs',
    '/api/docs',
    '/swagger',
    '/docs/api',
    '/.well-known/openapi.yaml',
    '/openapi.yaml',
    '/swagger.yaml',
  ];

  // Sensitive/admin paths that should require auth
  const sensitivePaths = [
    '/api/admin',
    '/api/users',
    '/api/config',
    '/api/settings',
    '/api/internal',
    '/admin/api',
    '/management',
    '/actuator',
    '/metrics',
    '/health',
    '/api/health',
  ];

  // Feature #480: Body size limit for API Discovery responses (prevent memory exhaustion)
  const API_DISCOVERY_BODY_LIMIT = 10240; // 10KB

  // Helper: Make HTTP request and return response info
  // Feature #480: Added SSRF re-validation before each request
  async function probeEndpoint(endpointUrl: string, method: 'GET' | 'HEAD' = 'HEAD'): Promise<{
    status: number;
    statusText: string;
    responseTimeMs: number;
    contentType?: string;
    error?: string;
    body?: string;
  }> {
    const start = Date.now();
    try {
      // Feature #480: Re-validate constructed URL against SSRF rules
      // This is critical because the URL may be constructed from user input + paths
      const ssrfValidation = validateURLForSSRF(endpointUrl, {
        requireHttps: false,
        allowLocalhost: process.env.NODE_ENV !== 'production',
      });

      if (!ssrfValidation.safe) {
        log.warn({ url: endpointUrl, error: ssrfValidation.error }, 'SSRF validation failed for probe URL');
        return {
          status: 0,
          statusText: '',
          responseTimeMs: Date.now() - start,
          error: `SSRF protection: ${ssrfValidation.error}`,
        };
      }

      const probeUrl = new URL(endpointUrl);
      const isHttps = probeUrl.protocol === 'https:';
      const client = isHttps ? https : http;

      return await new Promise((resolve) => {
        const req = client.request(endpointUrl, {
          method,
          timeout: 5000, // 5 second timeout
          headers: {
            'User-Agent': 'QA-Guardian-API-Discovery/1.0',
            'Accept': 'application/json, application/yaml, */*',
          },
        }, (res) => {
          let body = '';
          let bodySize = 0;

          res.on('data', (chunk) => {
            // Feature #480: Enforce body size limit to prevent memory exhaustion
            bodySize += chunk.length;
            if (bodySize <= API_DISCOVERY_BODY_LIMIT) {
              body += chunk;
            }
          });

          res.on('end', () => {
            resolve({
              status: res.statusCode || 0,
              statusText: res.statusMessage || '',
              responseTimeMs: Date.now() - start,
              contentType: res.headers['content-type'],
              body: method === 'GET' ? body.slice(0, API_DISCOVERY_BODY_LIMIT) : undefined,
            });
          });
        });

        req.on('error', (err) => {
          resolve({
            status: 0,
            statusText: '',
            responseTimeMs: Date.now() - start,
            error: err.message,
          });
        });

        req.on('timeout', () => {
          req.destroy();
          resolve({
            status: 0,
            statusText: '',
            responseTimeMs: Date.now() - start,
            error: 'Request timeout',
          });
        });

        req.end();
      });
    } catch (err) {
      return {
        status: 0,
        statusText: '',
        responseTimeMs: Date.now() - start,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  // Step 1: Probe for OpenAPI/Swagger specs
  log.info({ url }, 'Probing for OpenAPI specs...');
  for (const specPath of openApiPaths) {
    const specUrl = `${baseUrl}${specPath}`;
    const probe = await probeEndpoint(specUrl, 'GET');

    if (probe.status === 200 && probe.body) {
      // Try to parse as OpenAPI spec
      const parseResult = parseOpenAPISpec(probe.body);
      if (parseResult.success && parseResult.spec) {
        result.openAPISpec = {
          found: true,
          url: specUrl,
          title: parseResult.title,
          version: parseResult.version,
          endpointCount: parseResult.endpoints,
        };
        result.discoveredPaths.push(specPath);
        log.info({ specUrl, title: parseResult.title, endpoints: parseResult.endpoints }, 'Found OpenAPI spec');

        // Extract endpoints from spec
        for (const [path, pathItem] of Object.entries(parseResult.spec.paths)) {
          const methods = ['get', 'post', 'put', 'patch', 'delete'] as const;
          for (const method of methods) {
            if (pathItem[method]) {
              result.endpoints.push({
                path,
                method: method.toUpperCase(),
                status: 0, // Will be tested below
                statusText: 'Pending',
                responseTimeMs: 0,
                authRequired: false,
                isHealthy: false,
              });
            }
          }
        }
        break; // Stop after finding first valid spec
      }
    }
  }

  // Step 2: Probe common API paths
  log.info({ url }, 'Probing common API paths...');
  for (const apiPath of commonApiPaths) {
    const apiUrl = `${baseUrl}${apiPath}`;
    const probe = await probeEndpoint(apiUrl);

    if (probe.status > 0 && probe.status !== 404) {
      result.discoveredPaths.push(apiPath);

      const endpoint: APIEndpoint = {
        path: apiPath,
        method: 'HEAD',
        status: probe.status,
        statusText: probe.statusText,
        responseTimeMs: probe.responseTimeMs,
        authRequired: probe.status === 401 || probe.status === 403,
        isHealthy: probe.status >= 200 && probe.status < 400,
        contentType: probe.contentType,
        errorMessage: probe.error,
      };

      // Check if this is in our endpoints list from OpenAPI
      const existingIdx = result.endpoints.findIndex(e => e.path === apiPath);
      if (existingIdx >= 0) {
        result.endpoints[existingIdx] = { ...result.endpoints[existingIdx], ...endpoint };
      } else {
        result.endpoints.push(endpoint);
      }
    }
  }

  // Step 3: Check sensitive paths for auth
  log.info({ url }, 'Checking sensitive paths for auth protection...');
  for (const sensitivePath of sensitivePaths) {
    const sensitiveUrl = `${baseUrl}${sensitivePath}`;
    const probe = await probeEndpoint(sensitiveUrl);

    if (probe.status > 0 && probe.status !== 404) {
      result.discoveredPaths.push(sensitivePath);

      const authRequired = probe.status === 401 || probe.status === 403;
      const isHealthy = probe.status >= 200 && probe.status < 400;

      const endpoint: APIEndpoint = {
        path: sensitivePath,
        method: 'HEAD',
        status: probe.status,
        statusText: probe.statusText,
        responseTimeMs: probe.responseTimeMs,
        authRequired,
        isHealthy,
        contentType: probe.contentType,
        errorMessage: probe.error,
      };

      result.endpoints.push(endpoint);

      // Flag security concern if sensitive endpoint returns 200 without auth
      if (isHealthy && !authRequired) {
        result.securityConcerns.push({
          type: 'unprotected_sensitive',
          path: sensitivePath,
          description: `Sensitive endpoint ${sensitivePath} returns ${probe.status} without authentication`,
          severity: sensitivePath.includes('admin') || sensitivePath.includes('config') ? 'high' : 'medium',
        });
      }
    }
  }

  // Step 4: Test a sample of discovered endpoints for health
  if (result.endpoints.length > 0) {
    log.info({ count: result.endpoints.length }, 'Testing endpoint health...');
    const endpointsToTest = result.endpoints.slice(0, 20); // Limit to 20 endpoints

    for (const endpoint of endpointsToTest) {
      if (endpoint.status === 0 || endpoint.statusText === 'Pending') {
        const testUrl = `${baseUrl}${endpoint.path}`;
        const probe = await probeEndpoint(testUrl);

        endpoint.status = probe.status;
        endpoint.statusText = probe.statusText;
        endpoint.responseTimeMs = probe.responseTimeMs;
        endpoint.authRequired = probe.status === 401 || probe.status === 403;
        endpoint.isHealthy = probe.status >= 200 && probe.status < 400;
        endpoint.contentType = probe.contentType;
        endpoint.errorMessage = probe.error;
      }
    }
  }

  // Calculate summary
  result.summary.total = result.endpoints.length;
  result.summary.healthy = result.endpoints.filter(e => e.isHealthy).length;
  result.summary.unhealthy = result.endpoints.filter(e => !e.isHealthy && e.status > 0).length;
  result.summary.protected = result.endpoints.filter(e => e.authRequired).length;
  result.summary.unprotected = result.endpoints.filter(e => e.isHealthy && !e.authRequired).length;

  // Count by method
  for (const endpoint of result.endpoints) {
    result.summary.byMethod[endpoint.method] = (result.summary.byMethod[endpoint.method] || 0) + 1;
  }

  // Calculate API Discovery score
  // Base score: 50 (neutral)
  // +20 if OpenAPI spec found
  // +15 if all sensitive endpoints are protected
  // +15 if endpoints respond healthy
  // -10 for each high severity security concern
  // -5 for each medium severity security concern
  let score = 50;

  if (result.openAPISpec?.found) {
    score += 20; // Good API documentation
  }

  const sensitiveEndpoints = result.endpoints.filter(e =>
    sensitivePaths.some(sp => e.path.includes(sp.replace('/api', '')))
  );
  const protectedSensitive = sensitiveEndpoints.filter(e => e.authRequired);
  if (sensitiveEndpoints.length > 0 && protectedSensitive.length === sensitiveEndpoints.length) {
    score += 15; // All sensitive endpoints protected
  } else if (sensitiveEndpoints.length > 0) {
    const protectionRatio = protectedSensitive.length / sensitiveEndpoints.length;
    score += Math.round(15 * protectionRatio);
  }

  if (result.summary.total > 0) {
    const healthRatio = result.summary.healthy / result.summary.total;
    score += Math.round(15 * healthRatio);
  }

  // Deduct for security concerns
  for (const concern of result.securityConcerns) {
    if (concern.severity === 'high') score -= 10;
    else if (concern.severity === 'medium') score -= 5;
    else score -= 2;
  }

  result.score = Math.max(0, Math.min(100, score));

  log.info({
    score: result.score,
    discoveredPaths: result.discoveredPaths.length,
    endpoints: result.summary.total,
    openAPIFound: result.openAPISpec?.found || false,
    securityConcerns: result.securityConcerns.length,
  }, 'API Discovery complete');

  return result;
}

// ============================================================
// Wave 7: SEO Analysis
// ============================================================

/**
 * Feature #527: SEO Analysis check
 * Checks meta tags, heading hierarchy, robots.txt, sitemap.xml
 */
async function runSeoAnalysis(url: string, browser: Browser): Promise<SeoAnalysisResult> {
  const result: SeoAnalysisResult = {
    score: 0,
    metaTags: {
      title: { name: 'title', content: null, present: false, valid: false },
      description: { name: 'meta description', content: null, present: false, valid: false },
      canonical: { name: 'canonical', content: null, present: false, valid: false },
      ogTitle: { name: 'og:title', content: null, present: false, valid: false },
      ogDescription: { name: 'og:description', content: null, present: false, valid: false },
      ogImage: { name: 'og:image', content: null, present: false, valid: false },
      twitterCard: { name: 'twitter:card', content: null, present: false, valid: false },
      twitterTitle: { name: 'twitter:title', content: null, present: false, valid: false },
      twitterDescription: { name: 'twitter:description', content: null, present: false, valid: false },
      viewport: { name: 'viewport', content: null, present: false, valid: false },
      robots: { name: 'robots', content: null, present: false, valid: false },
    },
    headingStructure: {
      h1Count: 0,
      h1Texts: [],
      hasMultipleH1: false,
      headingHierarchy: [],
      hierarchyValid: true,
      issues: [],
    },
    crawlability: {
      robotsTxt: { present: false, url: '', allowsCrawling: true },
      sitemap: { present: false, url: '' },
    },
    // Feature #528: Schema Markup Detection
    schemaMarkup: {
      jsonLdScripts: [],
      microdataItems: [],
      detectedTypes: [],
      hasStructuredData: false,
      issues: [],
    },
    // Feature #529: Navigation Visibility Check
    navigation: {
      hasNavElement: false,
      hasHeader: false,
      hasFooter: false,
      hasBreadcrumbs: false,
      hasMobileMenuToggle: false,
      navElements: [],
      issues: [],
    },
    // Feature #530: Tracking Scripts Detection
    tracking: {
      scripts: [],
      hasGTM: false,
      hasGA4: false,
      hasFBPixel: false,
      hasHotjar: false,
      hasLinkedIn: false,
      summary: 'No tracking scripts detected',
    },
    issues: [],
    recommendations: [],
  };

  const parsedUrl = new URL(url);
  const baseUrl = parsedUrl.origin;

  let page: Page | null = null;
  let context: BrowserContext | null = null;

  try {
    // Step 1: Navigate to page and extract meta tags
    // Feature #541: Optimized page load timing for dynamic/SPA sites
    const pageLoadStart = Date.now();
    context = await browser.newContext();
    page = await context.newPage();

    // Feature #541: Try networkidle first with 30s timeout.
    // If it times out (slow sites), fall back to domcontentloaded so we at least get the DOM.
    let loadWarning: string | undefined;
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    } catch (navError) {
      const isTimeout = navError instanceof Error && navError.message.includes('Timeout');
      if (isTimeout) {
        loadWarning = 'Page load timed out waiting for networkidle; used domcontentloaded fallback';
        log.warn({ url, elapsed: Date.now() - pageLoadStart }, 'SEO: networkidle timeout, falling back to domcontentloaded');
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        } catch {
          // If even domcontentloaded fails, proceed with whatever DOM we have
          log.warn({ url }, 'SEO: domcontentloaded fallback also failed, proceeding with current DOM state');
          loadWarning = 'Page load failed; analysis based on partial DOM state';
        }
      } else {
        throw navError; // Re-throw non-timeout errors
      }
    }

    // Feature #541: Post-load delay (2s) for SPA hydration - allows
    // frameworks like React/Vue/Angular to finish client-side rendering
    await page.waitForTimeout(2000);
    const pageLoadMs = Date.now() - pageLoadStart;
    log.info({ url, pageLoadMs, loadWarning }, 'SEO: Page loaded for analysis');

    if (loadWarning) {
      result.issues.push(loadWarning);
    }

    // Feature #541: Time the DOM extraction sub-check
    const domExtractStart = Date.now();

    // Extract all SEO-relevant data from the DOM
    // NOTE: page.evaluate runs in browser context. Avoid named function declarations
    // inside the callback because tsx/esbuild adds __name() wrappers that don't exist
    // in the browser. Use inline expressions instead.
    const seoData = await page.evaluate(() => {
      // Get title
      const titleEl = document.querySelector('title');
      const title = titleEl?.textContent?.trim() || null;

      // Get canonical
      const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || null;

      // Sort headings by their position in DOM
      const allHeadingEls = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      const orderedHeadings: Array<{ level: number; text: string }> = [];
      allHeadingEls.forEach(h => {
        const level = parseInt(h.tagName.substring(1));
        const text = h.textContent?.trim() || '';
        if (text) {
          orderedHeadings.push({ level, text: text.substring(0, 100) });
        }
      });

      // Count H1s
      const h1Elements = document.querySelectorAll('h1');
      const h1Texts: string[] = [];
      h1Elements.forEach(h => {
        const text = h.textContent?.trim();
        if (text) h1Texts.push(text.substring(0, 100));
      });

      // Feature #528: Schema Markup Detection
      // Find all JSON-LD scripts
      const jsonLdScripts: Array<{ raw: string }> = [];
      document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
        const content = script.textContent?.trim();
        if (content) {
          jsonLdScripts.push({ raw: content.substring(0, 5000) });
        }
      });

      // Find Microdata items
      const microdataItems: Array<{ type: string; count: number }> = [];
      const itemscopeElements = document.querySelectorAll('[itemscope]');
      const typeCount: Record<string, number> = {};
      itemscopeElements.forEach(el => {
        const itemtype = el.getAttribute('itemtype');
        if (itemtype) {
          const typeName = itemtype.split('/').pop() || itemtype;
          typeCount[typeName] = (typeCount[typeName] || 0) + 1;
        }
      });
      for (const [type, count] of Object.entries(typeCount)) {
        microdataItems.push({ type, count });
      }

      // Feature #529: Navigation Visibility Check
      // All visibility checks inlined to avoid tsx __name issue in page.evaluate
      const navElements: Array<{ type: string; visible: boolean; ariaLabel?: string }> = [];

      document.querySelectorAll('nav').forEach(nav => {
        const cs = window.getComputedStyle(nav);
        navElements.push({
          type: 'nav',
          visible: cs.display !== 'none' && cs.visibility !== 'hidden' && (nav as HTMLElement).offsetParent !== null,
          ariaLabel: nav.getAttribute('aria-label') || undefined,
        });
      });

      document.querySelectorAll('[role="navigation"]').forEach(el => {
        if (el.tagName.toLowerCase() !== 'nav') {
          const cs = window.getComputedStyle(el);
          navElements.push({
            type: 'role-navigation',
            visible: cs.display !== 'none' && cs.visibility !== 'hidden' && (el as HTMLElement).offsetParent !== null,
            ariaLabel: el.getAttribute('aria-label') || undefined,
          });
        }
      });

      // Check for header/footer
      const hasHeader = document.querySelector('header') !== null;
      const hasFooter = document.querySelector('footer') !== null;

      if (hasHeader) {
        const header = document.querySelector('header')!;
        const cs = window.getComputedStyle(header);
        navElements.push({
          type: 'header',
          visible: cs.display !== 'none' && cs.visibility !== 'hidden' && (header as HTMLElement).offsetParent !== null,
        });
      }
      if (hasFooter) {
        const footer = document.querySelector('footer')!;
        const cs = window.getComputedStyle(footer);
        navElements.push({
          type: 'footer',
          visible: cs.display !== 'none' && cs.visibility !== 'hidden' && (footer as HTMLElement).offsetParent !== null,
        });
      }

      // Check for breadcrumbs
      const hasBreadcrumbs = document.querySelector('[aria-label*="breadcrumb" i], [aria-label*="Breadcrumb" i], nav.breadcrumb, .breadcrumbs, .breadcrumb') !== null ||
        jsonLdScripts.some(s => s.raw.includes('BreadcrumbList'));

      // Check for mobile menu toggle (hamburger button)
      const mobileMenuSelectors = [
        'button[aria-label*="menu" i]',
        'button[aria-label*="Menu" i]',
        'button.hamburger',
        'button.mobile-menu',
        '.menu-toggle',
        '[class*="hamburger"]',
        '[class*="mobile-nav"]',
      ];
      const hasMobileMenuToggle = mobileMenuSelectors.some(sel => document.querySelector(sel) !== null);

      // Feature #530: Tracking Scripts Detection
      const trackingScripts: Array<{ name: string; type: string; id?: string; source: string }> = [];

      // Check script src attributes for tracking scripts
      document.querySelectorAll('script[src]').forEach(script => {
        const src = script.getAttribute('src') || '';

        // Google Tag Manager
        const gtmMatch = src.match(/gtm\.js\?id=(GTM-[A-Z0-9]+)/);
        if (gtmMatch) {
          trackingScripts.push({ name: 'Google Tag Manager', type: 'gtm', id: gtmMatch[1], source: 'script_src' });
        }

        // Google Analytics GA4
        const ga4Match = src.match(/gtag\/js\?id=(G-[A-Z0-9]+)/);
        if (ga4Match) {
          trackingScripts.push({ name: 'Google Analytics 4', type: 'ga4', id: ga4Match[1], source: 'script_src' });
        }

        // Facebook Pixel
        if (src.includes('connect.facebook.net') && src.includes('fbevents.js')) {
          trackingScripts.push({ name: 'Facebook Pixel', type: 'fb_pixel', source: 'script_src' });
        }

        // Hotjar
        const hotjarMatch = src.match(/static\.hotjar\.com\/c\/hotjar-(\d+)\.js/);
        if (hotjarMatch) {
          trackingScripts.push({ name: 'Hotjar', type: 'hotjar', id: hotjarMatch[1], source: 'script_src' });
        }

        // LinkedIn Insight Tag
        if (src.includes('snap.licdn.com') || src.includes('linkedin.com/insight')) {
          trackingScripts.push({ name: 'LinkedIn Insight Tag', type: 'linkedin', source: 'script_src' });
        }
      });

      // Feature #534: Check inline script content for tracking patterns
      document.querySelectorAll('script:not([src])').forEach(script => {
        const content = script.textContent || '';
        if (!content.trim()) return;

        // GTM bootstrap pattern: (window,document,'script','dataLayer','GTM-XXXXXX')
        const gtmInlineMatch = content.match(/['"]GTM-([A-Z0-9]+)['"]/);
        if (gtmInlineMatch && !trackingScripts.some(s => s.type === 'gtm')) {
          trackingScripts.push({ name: 'Google Tag Manager', type: 'gtm', id: 'GTM-' + gtmInlineMatch[1], source: 'inline' });
        }

        // GA4 gtag inline: gtag('config', 'G-XXXXXX')
        const ga4InlineMatch = content.match(/gtag\s*\(\s*['"]config['"]\s*,\s*['"](G-[A-Z0-9]+)['"]/);
        if (ga4InlineMatch && !trackingScripts.some(s => s.type === 'ga4')) {
          trackingScripts.push({ name: 'Google Analytics 4', type: 'ga4', id: ga4InlineMatch[1], source: 'inline' });
        }
        // Also check for GoogleAnalyticsObject or ga() calls (Universal Analytics)
        if ((content.includes('GoogleAnalyticsObject') || content.match(/\bga\s*\(\s*['"]create['"]/)) && !trackingScripts.some(s => s.type === 'ga4')) {
          trackingScripts.push({ name: 'Google Analytics', type: 'ga4', source: 'inline' });
        }

        // Facebook Pixel: fbq('init', ...) or fbevents.js reference
        if ((content.includes('fbq(') || content.includes('fbevents.js')) && !trackingScripts.some(s => s.type === 'fb_pixel')) {
          const fbIdMatch = content.match(/fbq\s*\(\s*['"]init['"]\s*,\s*['"](\d+)['"]/);
          trackingScripts.push({ name: 'Facebook Pixel', type: 'fb_pixel', id: fbIdMatch ? fbIdMatch[1] : undefined, source: 'inline' });
        }

        // Hotjar inline: (function(h,o,t,j,a,r){ h.hj=...
        if (content.includes('hotjar') || content.match(/h\.hj\s*=/) || content.match(/hj\s*\(\s*['"]/)) {
          if (!trackingScripts.some(s => s.type === 'hotjar')) {
            const hjIdMatch = content.match(/hjid\s*:\s*(\d+)/i) || content.match(/hotjar-(\d+)/);
            trackingScripts.push({ name: 'Hotjar', type: 'hotjar', id: hjIdMatch ? hjIdMatch[1] : undefined, source: 'inline' });
          }
        }

        // LinkedIn Insight: _linkedin_partner_id or snap.licdn.com
        if ((content.includes('_linkedin_partner_id') || content.includes('snap.licdn.com')) && !trackingScripts.some(s => s.type === 'linkedin')) {
          const liIdMatch = content.match(/_linkedin_partner_id\s*=\s*["']?(\d+)["']?/);
          trackingScripts.push({ name: 'LinkedIn Insight Tag', type: 'linkedin', id: liIdMatch ? liIdMatch[1] : undefined, source: 'inline' });
        }
      });

      // Feature #534: Check noscript iframes for GTM
      document.querySelectorAll('noscript').forEach(noscript => {
        const html = noscript.innerHTML || '';
        if (html.includes('googletagmanager.com/ns.html')) {
          const gtmNoscriptMatch = html.match(/id=(GTM-[A-Z0-9]+)/);
          if (gtmNoscriptMatch && !trackingScripts.some(s => s.type === 'gtm')) {
            trackingScripts.push({ name: 'Google Tag Manager', type: 'gtm', id: gtmNoscriptMatch[1], source: 'inline' });
          }
        }
      });

      // Check window globals for tracking scripts (cast window to any for tracking globals)
      const win = window as unknown as Record<string, unknown>;

      // GTM dataLayer check
      if (Array.isArray(win.dataLayer)) {
        const hasGtmEntry = (win.dataLayer as Array<Record<string, unknown>>).some(
          (entry: Record<string, unknown>) => entry['gtm.start'] !== undefined
        );
        if (hasGtmEntry && !trackingScripts.some(s => s.type === 'gtm')) {
          trackingScripts.push({ name: 'Google Tag Manager', type: 'gtm', source: 'window_global' });
        }
      }

      // GA4 gtag check
      if (typeof win.gtag === 'function') {
        if (!trackingScripts.some(s => s.type === 'ga4')) {
          trackingScripts.push({ name: 'Google Analytics 4', type: 'ga4', source: 'window_global' });
        }
      }

      // Facebook Pixel fbq check
      if (typeof win.fbq === 'function') {
        if (!trackingScripts.some(s => s.type === 'fb_pixel')) {
          trackingScripts.push({ name: 'Facebook Pixel', type: 'fb_pixel', source: 'window_global' });
        }
      }

      // Hotjar hj check
      if (typeof win.hj === 'function') {
        if (!trackingScripts.some(s => s.type === 'hotjar')) {
          trackingScripts.push({ name: 'Hotjar', type: 'hotjar', source: 'window_global' });
        }
      }

      // LinkedIn _linkedin_partner_id check
      if (win._linkedin_partner_id) {
        if (!trackingScripts.some(s => s.type === 'linkedin')) {
          trackingScripts.push({ name: 'LinkedIn Insight Tag', type: 'linkedin', id: String(win._linkedin_partner_id), source: 'window_global' });
        }
      }

      return {
        title,
        description: document.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || null,
        canonical,
        ogTitle: document.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim() || null,
        ogDescription: document.querySelector('meta[property="og:description"]')?.getAttribute('content')?.trim() || null,
        ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute('content')?.trim() || null,
        twitterCard: document.querySelector('meta[name="twitter:card"]')?.getAttribute('content')?.trim() || null,
        twitterTitle: document.querySelector('meta[name="twitter:title"]')?.getAttribute('content')?.trim() || null,
        twitterDescription: document.querySelector('meta[name="twitter:description"]')?.getAttribute('content')?.trim() || null,
        viewport: document.querySelector('meta[name="viewport"]')?.getAttribute('content')?.trim() || null,
        robots: document.querySelector('meta[name="robots"]')?.getAttribute('content')?.trim() || null,
        h1Count: document.querySelectorAll('h1').length,
        h1Texts,
        headingHierarchy: orderedHeadings,
        // Feature #528: Schema data
        jsonLdScripts,
        microdataItems,
        // Feature #529: Navigation data
        navElements,
        hasHeader,
        hasFooter,
        hasBreadcrumbs,
        hasMobileMenuToggle,
        // Feature #530: Tracking scripts data
        trackingScripts,
      };
    });

    // Close page context
    await context.close();
    context = null;
    page = null;

    const domExtractMs = Date.now() - domExtractStart;
    log.info({ url, domExtractMs }, 'SEO: DOM extraction completed');

    // Feature #541: Time the meta tags + headings + schema + nav + tracking processing
    const processingStart = Date.now();

    // Process title
    if (seoData.title) {
      result.metaTags.title = {
        name: 'title',
        content: seoData.title,
        present: true,
        valid: seoData.title.length >= 10 && seoData.title.length <= 70,
        issue: seoData.title.length < 10 ? 'Title too short (min 10 chars)' :
               seoData.title.length > 70 ? 'Title too long (max 70 chars)' : undefined,
      };
    } else {
      result.issues.push('Missing page title');
      result.recommendations.push('Add a descriptive <title> tag (10-70 characters)');
    }

    // Process meta description
    if (seoData.description) {
      result.metaTags.description = {
        name: 'meta description',
        content: seoData.description,
        present: true,
        valid: seoData.description.length >= 50 && seoData.description.length <= 160,
        issue: seoData.description.length < 50 ? 'Description too short (min 50 chars)' :
               seoData.description.length > 160 ? 'Description too long (max 160 chars)' : undefined,
      };
    } else {
      result.issues.push('Missing meta description');
      result.recommendations.push('Add a meta description (50-160 characters)');
    }

    // Process canonical
    if (seoData.canonical) {
      result.metaTags.canonical = {
        name: 'canonical',
        content: seoData.canonical,
        present: true,
        valid: seoData.canonical.startsWith('http'),
      };
    } else {
      result.issues.push('Missing canonical URL');
      result.recommendations.push('Add a canonical link to prevent duplicate content issues');
    }

    // Process Open Graph tags
    if (seoData.ogTitle) {
      result.metaTags.ogTitle = { name: 'og:title', content: seoData.ogTitle, present: true, valid: true };
    } else {
      result.issues.push('Missing og:title');
    }

    if (seoData.ogDescription) {
      result.metaTags.ogDescription = { name: 'og:description', content: seoData.ogDescription, present: true, valid: true };
    } else {
      result.issues.push('Missing og:description');
    }

    if (seoData.ogImage) {
      result.metaTags.ogImage = { name: 'og:image', content: seoData.ogImage, present: true, valid: true };
    } else {
      result.issues.push('Missing og:image for social sharing');
      result.recommendations.push('Add og:image for better social media sharing previews');
    }

    // Process Twitter Card tags
    if (seoData.twitterCard) {
      result.metaTags.twitterCard = { name: 'twitter:card', content: seoData.twitterCard, present: true, valid: true };
    }
    if (seoData.twitterTitle) {
      result.metaTags.twitterTitle = { name: 'twitter:title', content: seoData.twitterTitle, present: true, valid: true };
    }
    if (seoData.twitterDescription) {
      result.metaTags.twitterDescription = { name: 'twitter:description', content: seoData.twitterDescription, present: true, valid: true };
    }

    // Process viewport
    if (seoData.viewport) {
      result.metaTags.viewport = { name: 'viewport', content: seoData.viewport, present: true, valid: true };
    } else {
      result.issues.push('Missing viewport meta tag');
      result.recommendations.push('Add viewport meta tag for mobile responsiveness');
    }

    // Process robots
    if (seoData.robots) {
      result.metaTags.robots = { name: 'robots', content: seoData.robots, present: true, valid: true };
    }

    // Process heading structure
    result.headingStructure.h1Count = seoData.h1Count;
    result.headingStructure.h1Texts = seoData.h1Texts;
    result.headingStructure.hasMultipleH1 = seoData.h1Count > 1;
    result.headingStructure.headingHierarchy = seoData.headingHierarchy;

    if (seoData.h1Count === 0) {
      result.headingStructure.issues.push('No H1 tag found');
      result.issues.push('Missing H1 tag');
      result.recommendations.push('Add exactly one H1 tag for the main page heading');
    } else if (seoData.h1Count > 1) {
      result.headingStructure.issues.push(`Multiple H1 tags found (${seoData.h1Count})`);
      result.issues.push(`Multiple H1 tags (${seoData.h1Count} found, should be 1)`);
      result.recommendations.push('Use only one H1 tag per page');
    }

    // Check heading hierarchy (H1 should come before H2, etc.)
    let lastLevel = 0;
    for (const heading of seoData.headingHierarchy) {
      if (heading.level > lastLevel + 1 && lastLevel > 0) {
        result.headingStructure.hierarchyValid = false;
        result.headingStructure.issues.push(`Heading level skipped: H${lastLevel} → H${heading.level}`);
      }
      lastLevel = heading.level;
    }

    if (!result.headingStructure.hierarchyValid) {
      result.issues.push('Heading hierarchy has skipped levels');
      result.recommendations.push('Use heading levels in order (H1 → H2 → H3)');
    }

    // Feature #528: Process Schema Markup
    const detectedTypes: string[] = [];
    const commonSchemaTypes = ['Organization', 'LocalBusiness', 'Product', 'BreadcrumbList', 'FAQ', 'Article', 'WebSite', 'WebPage', 'Person', 'Event', 'Recipe'];

    // Process JSON-LD scripts
    for (const script of seoData.jsonLdScripts) {
      try {
        const parsed = JSON.parse(script.raw);
        // Extract @type from JSON-LD
        // Feature #545: Added depth limit (max 10) to prevent stack overflow on malicious nested @graph
        const MAX_JSONLD_DEPTH = 10;
        const extractTypes = (obj: unknown, depth = 0): string[] => {
          if (depth > MAX_JSONLD_DEPTH) return [];
          const types: string[] = [];
          if (typeof obj === 'object' && obj !== null) {
            const o = obj as Record<string, unknown>;
            if (o['@type']) {
              const t = Array.isArray(o['@type']) ? o['@type'] : [o['@type']];
              types.push(...t.map(String));
            }
            // Check for @graph array
            if (Array.isArray(o['@graph'])) {
              for (const item of o['@graph']) {
                types.push(...extractTypes(item, depth + 1));
              }
            }
          }
          return types;
        };
        const types = extractTypes(parsed);
        result.schemaMarkup.jsonLdScripts.push({
          type: types[0] || 'Unknown',
          raw: script.raw.substring(0, 500), // Truncate for storage
          valid: true,
        });
        detectedTypes.push(...types);
      } catch (parseError) {
        result.schemaMarkup.jsonLdScripts.push({
          type: 'Invalid',
          raw: script.raw.substring(0, 200),
          valid: false,
          error: 'Invalid JSON syntax',
        });
        result.schemaMarkup.issues.push('Invalid JSON-LD syntax detected');
      }
    }

    // Process Microdata
    for (const item of seoData.microdataItems) {
      result.schemaMarkup.microdataItems.push({
        type: item.type,
        itemCount: item.count,
      });
      detectedTypes.push(item.type);
    }

    // Deduplicate and store detected types
    result.schemaMarkup.detectedTypes = [...new Set(detectedTypes)];
    result.schemaMarkup.hasStructuredData = detectedTypes.length > 0;

    // Check for common schema types
    if (!result.schemaMarkup.hasStructuredData) {
      result.recommendations.push('Add structured data (JSON-LD or Microdata) for better search engine visibility');
    } else {
      // Check if important types are present
      const hasOrg = detectedTypes.some(t => t === 'Organization' || t === 'LocalBusiness');
      const hasBreadcrumbs = detectedTypes.includes('BreadcrumbList');
      if (!hasOrg) {
        result.recommendations.push('Consider adding Organization or LocalBusiness schema');
      }
      if (!hasBreadcrumbs) {
        result.recommendations.push('Consider adding BreadcrumbList schema for navigation');
      }
    }

    // Feature #529: Process Navigation data
    result.navigation.hasNavElement = seoData.navElements.some(n => n.type === 'nav' || n.type === 'role-navigation');
    result.navigation.hasHeader = seoData.hasHeader;
    result.navigation.hasFooter = seoData.hasFooter;
    result.navigation.hasBreadcrumbs = seoData.hasBreadcrumbs;
    result.navigation.hasMobileMenuToggle = seoData.hasMobileMenuToggle;
    result.navigation.navElements = seoData.navElements.map(n => ({
      type: n.type as 'nav' | 'role-navigation' | 'header' | 'footer' | 'breadcrumb',
      visible: n.visible,
      ariaLabel: n.ariaLabel,
    }));

    // Check navigation issues
    if (!result.navigation.hasNavElement) {
      result.navigation.issues.push('No <nav> or role="navigation" element found');
      result.recommendations.push('Add semantic <nav> elements for better accessibility');
    }
    if (!result.navigation.hasHeader) {
      result.navigation.issues.push('No <header> element found');
    }
    if (!result.navigation.hasFooter) {
      result.navigation.issues.push('No <footer> element found');
    }
    if (!result.navigation.hasBreadcrumbs) {
      result.recommendations.push('Consider adding breadcrumb navigation for better UX');
    }

    // Check for hidden nav elements
    const hiddenNavs = seoData.navElements.filter(n => !n.visible && (n.type === 'nav' || n.type === 'role-navigation'));
    if (hiddenNavs.length > 0) {
      result.navigation.issues.push(`${hiddenNavs.length} navigation element(s) are hidden from view`);
    }

    // Feature #530: Process Tracking Scripts data
    result.tracking.scripts = seoData.trackingScripts.map(s => ({
      name: s.name,
      type: s.type as 'gtm' | 'ga4' | 'fb_pixel' | 'hotjar' | 'linkedin' | 'other',
      id: s.id,
      source: s.source as 'script_src' | 'window_global' | 'inline',
    }));
    result.tracking.hasGTM = seoData.trackingScripts.some(s => s.type === 'gtm');
    result.tracking.hasGA4 = seoData.trackingScripts.some(s => s.type === 'ga4');
    result.tracking.hasFBPixel = seoData.trackingScripts.some(s => s.type === 'fb_pixel');
    result.tracking.hasHotjar = seoData.trackingScripts.some(s => s.type === 'hotjar');
    result.tracking.hasLinkedIn = seoData.trackingScripts.some(s => s.type === 'linkedin');

    // Generate tracking summary
    if (seoData.trackingScripts.length === 0) {
      result.tracking.summary = 'No tracking scripts detected';
    } else {
      const trackerNames = [...new Set(seoData.trackingScripts.map(s => s.name))];
      result.tracking.summary = `${trackerNames.length} tracker${trackerNames.length !== 1 ? 's' : ''}: ${trackerNames.join(', ')}`;
    }

    const processingMs = Date.now() - processingStart;
    log.info({ url, processingMs }, 'SEO: Meta/heading/schema/nav/tracking processing completed');

    // Feature #541: Time crawlability checks (robots.txt + sitemap.xml)
    const crawlCheckStart = Date.now();

    // Step 2: Check robots.txt
    try {
      const robotsUrl = `${baseUrl}/robots.txt`;
      result.crawlability.robotsTxt.url = robotsUrl;

      const robotsResponse = await new Promise<{ status: number; body: string }>((resolve) => {
        const client = parsedUrl.protocol === 'https:' ? https : http;
        const req = client.request(robotsUrl, { method: 'GET', timeout: 5000 }, (res) => {
          let body = '';
          res.on('data', chunk => { body += chunk; });
          res.on('end', () => resolve({ status: res.statusCode || 0, body }));
        });
        req.on('error', () => resolve({ status: 0, body: '' }));
        req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: '' }); });
        req.end();
      });

      if (robotsResponse.status === 200) {
        result.crawlability.robotsTxt.present = true;
        result.crawlability.robotsTxt.content = robotsResponse.body.substring(0, 1000);
        // Check if it blocks crawling
        const lowerBody = robotsResponse.body.toLowerCase();
        if (lowerBody.includes('disallow: /') && !lowerBody.includes('disallow: /\n')) {
          result.crawlability.robotsTxt.allowsCrawling = false;
          result.issues.push('robots.txt may block crawling');
        }
      } else {
        result.recommendations.push('Consider adding a robots.txt file');
      }
    } catch {
      // robots.txt check failed, non-critical
    }

    // Step 3: Check sitemap.xml
    try {
      const sitemapUrl = `${baseUrl}/sitemap.xml`;
      result.crawlability.sitemap.url = sitemapUrl;

      const sitemapResponse = await new Promise<{ status: number; body: string }>((resolve) => {
        const client = parsedUrl.protocol === 'https:' ? https : http;
        const req = client.request(sitemapUrl, { method: 'GET', timeout: 5000 }, (res) => {
          let body = '';
          res.on('data', chunk => { body += chunk.toString().substring(0, 5000); }); // Limit body size
          res.on('end', () => resolve({ status: res.statusCode || 0, body }));
        });
        req.on('error', () => resolve({ status: 0, body: '' }));
        req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: '' }); });
        req.end();
      });

      if (sitemapResponse.status === 200 && sitemapResponse.body.includes('<urlset')) {
        result.crawlability.sitemap.present = true;
        // Count URLs in sitemap (rough estimate)
        const urlMatches = sitemapResponse.body.match(/<loc>/g);
        result.crawlability.sitemap.urlCount = urlMatches?.length || 0;
      } else {
        result.recommendations.push('Consider adding a sitemap.xml for better indexing');
      }
    } catch {
      // sitemap check failed, non-critical
    }

    const crawlCheckMs = Date.now() - crawlCheckStart;
    log.info({ url, crawlCheckMs, robotsTxt: result.crawlability.robotsTxt.present, sitemap: result.crawlability.sitemap.present }, 'SEO: Crawlability checks completed');

    // Calculate SEO score
    let score = 100;

    // Essential tags (high impact)
    if (!result.metaTags.title.present) score -= 15;
    else if (!result.metaTags.title.valid) score -= 5;

    if (!result.metaTags.description.present) score -= 12;
    else if (!result.metaTags.description.valid) score -= 4;

    if (!result.metaTags.canonical.present) score -= 8;
    if (!result.metaTags.viewport.present) score -= 10;

    // Heading structure
    if (result.headingStructure.h1Count === 0) score -= 10;
    else if (result.headingStructure.h1Count > 1) score -= 5;
    if (!result.headingStructure.hierarchyValid) score -= 5;

    // Social tags (moderate impact)
    if (!result.metaTags.ogTitle.present) score -= 4;
    if (!result.metaTags.ogDescription.present) score -= 4;
    if (!result.metaTags.ogImage.present) score -= 5;

    // Crawlability (moderate impact)
    if (!result.crawlability.robotsTxt.present) score -= 3;
    if (!result.crawlability.sitemap.present) score -= 5;
    if (!result.crawlability.robotsTxt.allowsCrawling) score -= 10;

    // Feature #528: Schema markup (moderate impact)
    if (!result.schemaMarkup.hasStructuredData) score -= 5;
    if (result.schemaMarkup.issues.length > 0) score -= 3; // Invalid JSON-LD penalty

    // Feature #529: Navigation (moderate impact)
    if (!result.navigation.hasNavElement) score -= 4;
    if (!result.navigation.hasHeader) score -= 2;
    if (!result.navigation.hasFooter) score -= 2;

    result.score = Math.max(0, Math.min(100, score));

    const totalMs = Date.now() - pageLoadStart;
    log.info({
      url,
      score: result.score,
      h1Count: result.headingStructure.h1Count,
      issueCount: result.issues.length,
      robotsTxt: result.crawlability.robotsTxt.present,
      sitemap: result.crawlability.sitemap.present,
      schemaTypes: result.schemaMarkup.detectedTypes.length,
      hasNav: result.navigation.hasNavElement,
      trackingScriptsCount: result.tracking.scripts.length,
      // Feature #541: Timing breakdown for debugging
      timing: { pageLoadMs, domExtractMs, processingMs, crawlCheckMs, totalMs },
    }, 'SEO Analysis complete');

  } catch (err) {
    log.error({ error: err }, 'SEO Analysis wave error');
    if (context) {
      await context.close().catch(() => {});
    }
    throw err;
  }

  return result;
}

// ============================================================
// Main Runner
// ============================================================

export async function runQuickTest(request: QuickTestRequest): Promise<void> {
  const { url, runId, orgId, userId, browser: browserType = 'chromium' } = request;
  const browserLauncher = getBrowserLauncher(browserType);

  // Initialize result
  // Feature #461: Include orgId for IDOR protection
  const testResult: QuickTestResult = {
    runId,
    orgId,
    url,
    status: 'running',
    startedAt: new Date(),
    waves: [
      { wave: 1, name: 'Health Check', status: 'pending' },
      { wave: 2, name: 'Visual + Performance', status: 'pending' },
      { wave: 3, name: 'Security Scan', status: 'pending' },
      { wave: 4, name: 'AI Analysis', status: 'pending' },
      { wave: 5, name: 'Accessibility', status: 'pending' }, // Feature #471
      { wave: 6, name: 'API Discovery', status: 'pending' }, // Feature #472
      { wave: 7, name: 'SEO Analysis', status: 'pending' }, // Feature #527
    ],
  };

  // Feature #446: Use safe setter that enforces max size limit (in-memory cache)
  safeSetQuickTestResult(runId, testResult);

  // Feature #465: Create initial record in PostgreSQL for persistence
  await createQuickTestResult(runId, orgId, userId, url, testResult.waves as unknown as DbWaveResult[]);

  // Schedule cleanup after TTL (only for in-memory cache, DB records persist)
  setTimeout(() => {
    quickTestResults.delete(runId);
  }, TTL_MS);

  let browser: Browser | null = null;
  let healthResult: HealthCheckResult | undefined;
  let visualResult: VisualPerformanceResult | undefined;
  let securityResult: SecurityScanResult | undefined;

  try {
    // Feature #579: Launch selected browser once for waves 2 and 3
    browser = await browserLauncher.launch({ headless: true });

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

      // Feature #466: Save screenshots to disk and get URLs
      // Feature #478: Pass orgId to generate signed URLs for security
      const screenshotUrls: { desktop?: string; mobile?: string } = {};
      if (visualResult.screenshots.desktop) {
        try {
          screenshotUrls.desktop = await saveScreenshot(runId, 'desktop', visualResult.screenshots.desktop, orgId);
          log.info({ runId, type: 'desktop' }, 'Saved desktop screenshot');
        } catch (saveErr) {
          log.error({ runId, error: saveErr }, 'Failed to save desktop screenshot');
        }
      }
      if (visualResult.screenshots.mobile) {
        try {
          screenshotUrls.mobile = await saveScreenshot(runId, 'mobile', visualResult.screenshots.mobile, orgId);
          log.info({ runId, type: 'mobile' }, 'Saved mobile screenshot');
        } catch (saveErr) {
          log.error({ runId, error: saveErr }, 'Failed to save mobile screenshot');
        }
      }

      // Store URLs in visualResult for later use
      visualResult.screenshotUrls = screenshotUrls;

      // Include screenshot URLs instead of boolean flags
      const visualDataForEmit = {
        performanceScores: visualResult.performanceScores,
        coreWebVitals: visualResult.coreWebVitals,
        loadTime: visualResult.loadTime,
        // Feature #466: Include URLs instead of boolean flags
        desktopScreenshotUrl: screenshotUrls.desktop || null,
        mobileScreenshotUrl: screenshotUrls.mobile || null,
        // Keep legacy flags for backward compatibility
        hasDesktopScreenshot: !!screenshotUrls.desktop,
        hasMobileScreenshot: !!screenshotUrls.mobile,
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

    // Wave 4: AI Analysis (runs without browser)
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

      // Feature #520: Show "skipped" status when AI provider not configured
      const aiResultData = aiResult as unknown as Record<string, unknown>;
      if (aiResultData.skipped) {
        testResult.waves[3].status = 'skipped';
        testResult.waves[3].completedAt = new Date();
        testResult.waves[3].duration = Date.now() - wave4Start;
        testResult.waves[3].data = aiResultData;
        testResult.waves[3].error = aiResult.summary;
        emitWaveComplete(orgId, runId, 4, aiResultData);
        log.info({ reason: aiResultData.skipReason }, 'AI Analysis wave skipped');
      } else {
        testResult.waves[3].status = 'completed';
        testResult.waves[3].completedAt = new Date();
        testResult.waves[3].duration = Date.now() - wave4Start;
        testResult.waves[3].data = aiResultData;
        emitWaveComplete(orgId, runId, 4, aiResultData);
      }
    } catch (err) {
      testResult.waves[3].status = 'failed';
      testResult.waves[3].error = err instanceof Error ? err.message : 'AI analysis failed';
      emitWaveError(orgId, runId, 4, testResult.waves[3].error);
    }

    // Feature #471: Wave 5 - Accessibility Scan using axe-core
    let accessibilityResult: AccessibilityScanResult | undefined;
    emitWaveStart(orgId, runId, 5, 'Accessibility');
    testResult.waves[4].status = 'running';
    testResult.waves[4].startedAt = new Date();

    try {
      const wave5Start = Date.now();

      // Reuse existing browser/page if still open, otherwise launch new one
      let a11yBrowser: Browser | null = browser;
      let a11yPage: Page | null = null;
      let ownsBrowser = false;

      if (!a11yBrowser) {
        // Feature #579: Use selected browser for a11y scan
        a11yBrowser = await browserLauncher.launch({ headless: true });
        ownsBrowser = true;
      }

      // Use browser.newContext() for proper isolation - AxeBuilder requires context-based pages
      let a11yContext: BrowserContext | null = null;
      try {
        a11yContext = await a11yBrowser.newContext();
        a11yPage = await a11yContext.newPage();
        emitWaveProgress(orgId, runId, 5, 10, 'Loading page for accessibility scan...');

        await a11yPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await a11yPage.waitForTimeout(1000); // Allow content to settle

        emitWaveProgress(orgId, runId, 5, 30, 'Running axe-core WCAG 2.1 AA scan...');

        // Run axe-core with WCAG 2.1 AA rules
        const axeResults = await new AxeBuilder({ page: a11yPage })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
          .analyze();

        emitWaveProgress(orgId, runId, 5, 80, 'Processing accessibility results...');

        // Map violations
        const violations = axeResults.violations.map(v => ({
          id: v.id,
          impact: (v.impact || 'minor') as 'critical' | 'serious' | 'moderate' | 'minor',
          description: v.description,
          help: v.help,
          helpUrl: v.helpUrl,
          wcagTags: v.tags,
          nodes: v.nodes.map(n => ({
            html: n.html,
            target: n.target as string[],
            failureSummary: n.failureSummary,
          })),
        }));

        // Count by impact
        const violationCounts = {
          critical: violations.filter(v => v.impact === 'critical').length,
          serious: violations.filter(v => v.impact === 'serious').length,
          moderate: violations.filter(v => v.impact === 'moderate').length,
          minor: violations.filter(v => v.impact === 'minor').length,
          total: violations.length,
        };

        // Calculate accessibility score: 100 - (critical * 15 + serious * 8 + moderate * 3 + minor * 1), min 0
        const penalty =
          (violationCounts.critical * 15) +
          (violationCounts.serious * 8) +
          (violationCounts.moderate * 3) +
          (violationCounts.minor * 1);
        const a11yScore = Math.max(0, 100 - penalty);

        accessibilityResult = {
          score: a11yScore,
          violations,
          violationCounts,
          passesCount: axeResults.passes.length,
          wcagLevel: 'AA',
          axeVersion: axeResults.testEngine.version,
        };

        testResult.waves[4].status = 'completed';
        testResult.waves[4].completedAt = new Date();
        testResult.waves[4].duration = Date.now() - wave5Start;
        testResult.waves[4].data = accessibilityResult as unknown as Record<string, unknown>;
        emitWaveComplete(orgId, runId, 5, accessibilityResult as unknown as Record<string, unknown>);

      } finally {
        // Close context (which also closes the page)
        if (a11yContext) {
          await a11yContext.close().catch(() => {});
        }
        // Only close browser if we created it
        if (ownsBrowser && a11yBrowser) {
          await a11yBrowser.close().catch(() => {});
        }
      }

    } catch (err) {
      testResult.waves[4].status = 'failed';
      testResult.waves[4].error = err instanceof Error ? err.message : 'Accessibility scan failed';
      emitWaveError(orgId, runId, 5, testResult.waves[4].error);
    }

    // Feature #472: Wave 6 - API Discovery (runs without browser)
    let apiDiscoveryResult: APIDiscoveryResult | undefined;
    emitWaveStart(orgId, runId, 6, 'API Discovery');
    testResult.waves[5].status = 'running';
    testResult.waves[5].startedAt = new Date();

    try {
      const wave6Start = Date.now();
      emitWaveProgress(orgId, runId, 6, 10, 'Probing for OpenAPI specs...');

      apiDiscoveryResult = await runAPIDiscovery(url);

      emitWaveProgress(orgId, runId, 6, 90, 'Finalizing API discovery results...');

      testResult.waves[5].status = 'completed';
      testResult.waves[5].completedAt = new Date();
      testResult.waves[5].duration = Date.now() - wave6Start;
      testResult.waves[5].data = apiDiscoveryResult as unknown as Record<string, unknown>;
      emitWaveComplete(orgId, runId, 6, apiDiscoveryResult as unknown as Record<string, unknown>);
    } catch (err) {
      testResult.waves[5].status = 'failed';
      testResult.waves[5].error = err instanceof Error ? err.message : 'API Discovery failed';
      emitWaveError(orgId, runId, 6, testResult.waves[5].error);
    }

    // Feature #527: Wave 7 - SEO Analysis (Smoke Test with sub-checks)
    // Feature #531: Unified smoke test wave with all SEO sub-checks
    let seoResult: SeoAnalysisResult | undefined;
    emitWaveStart(orgId, runId, 7, 'SEO Analysis');
    testResult.waves[6].status = 'running';
    testResult.waves[6].startedAt = new Date();

    try {
      const wave7Start = Date.now();
      emitWaveProgress(orgId, runId, 7, 5, 'Analyzing meta tags...');

      // Reuse or create browser for SEO analysis
      let seoBrowser: Browser | null = browser;
      let ownsBrowser = false;
      if (!seoBrowser) {
        // Feature #579: Use selected browser for SEO analysis
        seoBrowser = await browserLauncher.launch({ headless: true });
        ownsBrowser = true;
      }

      try {
        emitWaveProgress(orgId, runId, 7, 15, 'Checking heading structure...');
        emitWaveProgress(orgId, runId, 7, 30, 'Detecting schema markup...');
        emitWaveProgress(orgId, runId, 7, 45, 'Checking navigation elements...');
        emitWaveProgress(orgId, runId, 7, 60, 'Detecting tracking scripts...');
        seoResult = await runSeoAnalysis(url, seoBrowser);
        emitWaveProgress(orgId, runId, 7, 85, 'Checking crawlability (robots.txt, sitemap)...');

        testResult.waves[6].status = 'completed';
        testResult.waves[6].completedAt = new Date();
        testResult.waves[6].duration = Date.now() - wave7Start;
        testResult.waves[6].data = seoResult as unknown as Record<string, unknown>;
        emitWaveComplete(orgId, runId, 7, seoResult as unknown as Record<string, unknown>);
      } finally {
        // Only close browser if we created it
        if (ownsBrowser && seoBrowser) {
          await seoBrowser.close().catch(() => {});
        }
      }
    } catch (err) {
      testResult.waves[6].status = 'failed';
      testResult.waves[6].error = err instanceof Error ? err.message : 'SEO Analysis failed';
      emitWaveError(orgId, runId, 7, testResult.waves[6].error);
    }

    // Close any remaining browser from earlier waves
    if (browser) {
      await browser.close();
      browser = null;
    }

    // Feature #538: Calculate summary scores - use 0 for failed/missing waves (no fake fallbacks)
    const healthScore = healthResult?.dns.resolved && healthResult?.http.status >= 200 && healthResult?.http.status < 400 ? 100 : 0;
    const performanceScore = visualResult?.performanceScores?.performance || 0;
    const securityScore = securityResult?.overallScore || 0;
    const accessibilityScore = accessibilityResult?.score ?? 0;
    const apiScore = apiDiscoveryResult?.score ?? 0;
    const seoScore = seoResult?.score ?? 0;

    // Feature #538: When AI is skipped/not configured, redistribute its 10% weight
    // proportionally across the other 6 scores instead of using a hardcoded placeholder.
    // Base weights: 12% health, 18% perf, 18% security, 22% a11y, 10% API, 10% SEO, 10% AI
    const aiWave = testResult.waves[3];
    const aiSkipped = aiWave.status === 'skipped' || aiWave.status === 'failed';
    const aiWeight = aiSkipped ? 0 : 0.10;
    const aiScore = aiSkipped ? 0 : 50; // AI wave has no numeric score; neutral when it runs
    // Redistribute AI's 10% proportionally when skipped
    const redistributionFactor = aiSkipped ? (1 / 0.90) : 1; // scale remaining 90% up to 100%
    const hw = 0.12 * redistributionFactor;
    const pw = 0.18 * redistributionFactor;
    const sw = 0.18 * redistributionFactor;
    const aw = 0.22 * redistributionFactor;
    const apw = 0.10 * redistributionFactor;
    const seow = 0.10 * redistributionFactor;

    testResult.summary = {
      healthScore,
      performanceScore,
      securityScore,
      accessibilityScore,
      apiScore,
      seoScore,
      overallScore: Math.round(
        (healthScore * hw) +
        (performanceScore * pw) +
        (securityScore * sw) +
        (accessibilityScore * aw) +
        (apiScore * apw) +
        (seoScore * seow) +
        (aiScore * aiWeight)
      ),
    };

    testResult.status = 'completed';
    testResult.completedAt = new Date();

    // Feature #465: Persist final result to PostgreSQL
    await completeQuickTestResult(
      runId,
      'completed',
      testResult.waves as unknown as DbWaveResult[],
      testResult.summary as DbSummary
    );

    // Emit final completion event
    emitWaveEvent(orgId, runId, 'quick-test:complete', {
      status: 'completed',
      summary: testResult.summary,
      completedAt: testResult.completedAt,
    });

  } catch (err) {
    log.error({ error: err }, 'Fatal error');
    testResult.status = 'failed';
    testResult.completedAt = new Date();

    // Feature #465: Persist failed result to PostgreSQL
    await completeQuickTestResult(
      runId,
      'failed',
      testResult.waves as unknown as DbWaveResult[],
      null
    );

    emitWaveEvent(orgId, runId, 'quick-test:error', {
      error: err instanceof Error ? err.message : 'Quick test failed',
    });

  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    // Feature #446: Use safe setter that enforces max size limit (in-memory cache)
    safeSetQuickTestResult(runId, testResult);
  }
}

// ============================================================
// Result Retrieval
// ============================================================

/**
 * Get Quick Test result from in-memory cache.
 * For persistent lookup including historical results, use getQuickTestResultAsync.
 */
export function getQuickTestResult(runId: string): QuickTestResult | undefined {
  return quickTestResults.get(runId);
}

/**
 * Feature #465: Get Quick Test result with database fallback.
 * First checks in-memory cache, then falls back to PostgreSQL.
 * This allows retrieval of results after server restart.
 */
export async function getQuickTestResultAsync(runId: string): Promise<QuickTestResult | undefined> {
  // First check in-memory cache (hot path)
  const cached = quickTestResults.get(runId);
  if (cached) {
    return cached;
  }

  // Fall back to database for historical/persisted results
  const dbResult = await getQuickTestResultById(runId);
  if (dbResult) {
    // Convert DB format back to QuickTestResult format
    // Feature #461: Include orgId for IDOR protection
    return {
      runId: dbResult.id,
      orgId: dbResult.organizationId,
      url: dbResult.url,
      status: dbResult.status,
      startedAt: dbResult.startedAt,
      completedAt: dbResult.completedAt ?? undefined,
      waves: dbResult.waveResults,
      summary: dbResult.waveScores ?? undefined,
    };
  }

  return undefined;
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
