/**
 * Flaky Tests - Shared Helpers
 *
 * Constants and utility functions used across flaky test query and mutation routes.
 *
 * Feature #1356: Code quality - extracted from flaky-tests.ts
 */

// Feature #142: Default to last 30 days for flaky test analysis
export const FLAKY_ANALYSIS_DAYS = 30;

export function getThirtyDaysAgo(): Date {
  return new Date(Date.now() - FLAKY_ANALYSIS_DAYS * 24 * 60 * 60 * 1000);
}
