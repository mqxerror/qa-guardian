/**
 * Quick Test Module - Shared Types and Helpers
 * Feature #730: Split quick-test/routes.ts into sub-modules
 *
 * Contains type definitions and utility functions shared across quick test routes.
 */

import { generateSignedScreenshotUrl } from '../../services/quick-test-screenshots.js';
import { createLogger } from '../../services/logger.js';

// Feature #481: Structured Pino logging
export const log = createLogger('quick-test-routes');

// Request body type
// Feature #579: Added browser option for cross-browser Quick Test
export interface QuickTestBody {
  url: string;
  browser?: 'chromium' | 'firefox' | 'webkit';
}

// Feature #473: Comparative Quick Test request body
export interface QuickTestCompareBody {
  urlA: string;
  urlB: string;
}

// Route params for getting results
export interface QuickTestParams {
  runId: string;
}

// Feature #473: Route params for compare results
export interface QuickTestCompareParams {
  compareId: string;
}

// Feature #474: Quick Test schedule request body
export interface QuickTestScheduleBody {
  url: string;
  name: string;
  cron_expression: string;
  notify_on_score_drop?: boolean;
  score_threshold?: number;
}

// Feature #466: Route params for screenshots
export interface ScreenshotParams {
  runId: string;
  type: 'desktop' | 'mobile';
}

// Feature #478: Query params for signed screenshot URLs
export interface ScreenshotQuerystring {
  token?: string;
}

/**
 * Feature #535: Refresh signed screenshot URLs in a quick test result
 * Signed tokens expire after 1 hour, so regenerate on every serve
 */
export function refreshScreenshotUrls(result: { runId: string; orgId?: string; waves?: Array<{ data?: unknown }> }): void {
  if (!result.waves || !result.orgId) return;
  for (const wave of result.waves) {
    if (wave.data && typeof wave.data === 'object') {
      const data = wave.data as Record<string, unknown>;
      if (data.desktopScreenshotUrl && typeof data.desktopScreenshotUrl === 'string') {
        data.desktopScreenshotUrl = generateSignedScreenshotUrl(result.runId, 'desktop', result.orgId);
      }
      if (data.mobileScreenshotUrl && typeof data.mobileScreenshotUrl === 'string') {
        data.mobileScreenshotUrl = generateSignedScreenshotUrl(result.runId, 'mobile', result.orgId);
      }
    }
  }
}
