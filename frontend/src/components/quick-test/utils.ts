/**
 * Quick Test Utilities
 * Feature #514: Extracted from QuickTestPage.tsx
 * Shared helper functions for quick-test components
 */

import { isValidUrl as sharedIsValidUrl } from '../../utils/url';

// Re-export for backward compatibility
export const isValidUrl = sharedIsValidUrl;

/**
 * Get text color class based on score
 */
export function getScoreColor(score: number): string {
  if (score >= 80) return 'text-success';
  if (score >= 60) return 'text-warning';
  return 'text-destructive';
}

/**
 * Get background color class based on score
 */
export function getScoreBgColor(score: number): string {
  if (score >= 80) return 'bg-success/20';
  if (score >= 60) return 'bg-warning/20';
  return 'bg-destructive/20';
}

/**
 * Local storage keys
 */
export const RECENT_URLS_KEY = 'qa-guardian-quick-test-urls';
export const MAX_RECENT_URLS = 5;
export const HISTORY_KEY = 'qa-guardian-quick-test-history';
export const MAX_HISTORY = 10;
