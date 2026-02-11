/**
 * Quick Test Wave 3: Security Scan
 * Feature #672: Extracted from quick-test-runner.ts
 *
 * OWASP headers, mixed content, cookies, exposed paths (15-30s)
 */

import type { Browser, Page, BrowserContext } from 'playwright';
import { URL } from 'url';
import { createLogger } from '../logger.js';
import type { SecurityScanResult } from './types.js';

const log = createLogger('quick-test-security');

/**
 * Run security scan wave
 * Checks security headers, cookie security, mixed content, and exposed paths
 */
export async function runSecurityScan(url: string, browser: Browser): Promise<SecurityScanResult> {
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
