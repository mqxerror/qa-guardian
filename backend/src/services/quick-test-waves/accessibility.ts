/**
 * Quick Test Wave 5: Accessibility Scan
 * Feature #680: Extracted from quick-test-runner.ts
 *
 * axe-core WCAG 2.1 AA scan with violation breakdown (5-15s)
 * Feature #471: Accessibility scan using axe-core
 */

import type { Browser, BrowserContext, Page } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import { createLogger } from '../logger.js';
import type { AccessibilityScanResult } from './types.js';

const log = createLogger('quick-test-accessibility');

/**
 * Feature #471: Run accessibility scan using axe-core
 * Scans for WCAG 2.1 AA compliance and best practices
 */
export async function runAccessibilityScan(url: string, browser: Browser): Promise<AccessibilityScanResult> {
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    // Use browser.newContext() for proper isolation - AxeBuilder requires context-based pages
    context = await browser.newContext();
    page = await context.newPage();

    log.info({ url }, 'Starting accessibility scan');

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1000); // Allow content to settle

    // Run axe-core with WCAG 2.1 AA rules
    const axeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze();

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
    const score = Math.max(0, 100 - penalty);

    log.info({ url, score, violationCount: violationCounts.total }, 'Accessibility scan completed');

    return {
      score,
      violations,
      violationCounts,
      passesCount: axeResults.passes.length,
      wcagLevel: 'AA',
      axeVersion: axeResults.testEngine.version,
    };

  } catch (err) {
    log.error({ error: err, url }, 'Accessibility scan error');
    throw err;
  } finally {
    // Close context (which also closes the page)
    if (context) {
      await context.close().catch(() => {});
    }
  }
}
