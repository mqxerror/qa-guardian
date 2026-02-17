/**
 * Quick Test Wave 2: Visual + Performance
 * Feature #672: Extracted from quick-test-runner.ts
 *
 * Lighthouse-like scoring, screenshots, Core Web Vitals (10-15s)
 */

import type { Browser, Page, BrowserContext } from 'playwright';
import { createLogger } from '../logger.js';
import type { VisualPerformanceResult } from './types.js';

const log = createLogger('quick-test-visual');

/**
 * Run visual and performance wave
 * Takes screenshots, measures Core Web Vitals, calculates performance scores
 */
export async function runVisualPerformance(url: string, browser: Browser, browserType?: string): Promise<VisualPerformanceResult> {
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
    // Feature #699: Use proper LayoutShift type instead of as any
    try {
      const cls = await page.evaluate(() => {
        // Type definition for LayoutShift entry (browser API)
        interface LayoutShiftEntry extends PerformanceEntry {
          hadRecentInput: boolean;
          value: number;
        }
        return new Promise<number | undefined>((resolve) => {
          let clsValue = 0;
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              const layoutShift = entry as LayoutShiftEntry;
              // Only count layout shifts that aren't triggered by user input
              if (!layoutShift.hadRecentInput) {
                clsValue += layoutShift.value;
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
    // Feature #699: Use proper PerformanceEventTiming type instead of as any
    try {
      const inp = await page.evaluate(() => {
        // Type definition for PerformanceEventTiming entry (browser API)
        interface EventTimingEntry extends PerformanceEntry {
          duration: number;
        }
        return new Promise<number | undefined>((resolve) => {
          let maxDuration = 0;
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              // event entries have duration property representing interaction latency
              const eventTiming = entry as EventTimingEntry;
              if (eventTiming.duration && eventTiming.duration > maxDuration) {
                maxDuration = eventTiming.duration;
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
    // Feature #fix: Skip isMobile for Firefox — Playwright's Firefox doesn't support it
    const mobileContextOptions: Record<string, unknown> = {
      viewport: { width: 375, height: 812 },
    };
    if (browserType !== 'firefox') {
      mobileContextOptions.isMobile = true;
    }
    context = await browser.newContext(mobileContextOptions as Parameters<typeof browser.newContext>[0]);
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

/**
 * Calculate performance score from Core Web Vitals
 * Feature #563: Custom heuristic scores (NOT real Lighthouse)
 */
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
