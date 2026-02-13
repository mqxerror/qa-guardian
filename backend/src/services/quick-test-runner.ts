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

import { chromium, firefox, webkit, Browser, BrowserType } from 'playwright';
import { getWebSocketIO } from './websocket-events.js';
import { createLogger } from './logger.js';

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
// Feature #681: parseOpenAPISpec moved to quick-test-waves/api-discovery.ts
// Feature #672: Wave modules extracted from this file
// All 7 wave functions and types now imported from dedicated modules
import {
  runHealthCheck,
  runVisualPerformance,
  runSecurityScan,
  runAIAnalysis,
  runAccessibilityScan,
  runAPIDiscovery,
  runSeoAnalysis,
  // Types re-exported from types.ts
  type HealthCheckResult,
  type VisualPerformanceResult,
  type SecurityScanResult,
  type AIAnalysisResult,
  type AccessibilityScanResult,
  type APIDiscoveryResult,
  type SeoAnalysisResult,
} from './quick-test-waves/index.js';

// Feature #449: Use structured logger instead of console.*
const log = createLogger('quick-test-runner');

// ============================================================
// Types - Most types imported from quick-test-waves/types.ts
// Only keep types needed for external consumers
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
// Wave Functions: All 7 waves now imported from quick-test-waves/
// See quick-test-waves/index.ts for the full module list:
// - Wave 1: runHealthCheck (health.ts)
// - Wave 2: runVisualPerformance (visual.ts)
// - Wave 3: runSecurityScan (security.ts)
// - Wave 4: runAIAnalysis (ai-analysis.ts)
// - Wave 5: runAccessibilityScan (accessibility.ts)
// - Wave 6: runAPIDiscovery (api-discovery.ts)
// - Wave 7: runSeoAnalysis (seo.ts)
// ============================================================

// ============================================================
// Main Runner
// ============================================================

export async function runQuickTest(request: QuickTestRequest): Promise<void> {
  const { url, runId, orgId, userId, browser: browserType = 'chromium' } = request;
  const browserLauncher = getBrowserLauncher(browserType);
  // Docker requires --no-sandbox and --disable-dev-shm-usage for Chromium
  const launchOptions = browserType === 'chromium'
    ? { headless: true as const, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] }
    : { headless: true as const };

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
    browser = await browserLauncher.launch(launchOptions);

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
    // Feature #680: Extracted to quick-test-waves/accessibility.ts
    let accessibilityResult: AccessibilityScanResult | undefined;
    emitWaveStart(orgId, runId, 5, 'Accessibility');
    testResult.waves[4].status = 'running';
    testResult.waves[4].startedAt = new Date();

    try {
      const wave5Start = Date.now();

      // Reuse existing browser/page if still open, otherwise launch new one
      let a11yBrowser: Browser | null = browser;
      let ownsBrowser = false;

      if (!a11yBrowser) {
        // Feature #579: Use selected browser for a11y scan
        a11yBrowser = await browserLauncher.launch(launchOptions);
        ownsBrowser = true;
      }

      try {
        emitWaveProgress(orgId, runId, 5, 10, 'Loading page for accessibility scan...');
        emitWaveProgress(orgId, runId, 5, 30, 'Running axe-core WCAG 2.1 AA scan...');

        // Feature #680: Call extracted module
        accessibilityResult = await runAccessibilityScan(url, a11yBrowser);

        emitWaveProgress(orgId, runId, 5, 80, 'Processing accessibility results...');

        testResult.waves[4].status = 'completed';
        testResult.waves[4].completedAt = new Date();
        testResult.waves[4].duration = Date.now() - wave5Start;
        testResult.waves[4].data = accessibilityResult as unknown as Record<string, unknown>;
        emitWaveComplete(orgId, runId, 5, accessibilityResult as unknown as Record<string, unknown>);

      } finally {
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
        seoBrowser = await browserLauncher.launch(launchOptions);
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
