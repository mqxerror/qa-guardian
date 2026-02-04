/**
 * Utility functions for Test Run Results
 * Extracted from TestRunResultPage.tsx for modularity (Feature #46)
 */

import { SimpleErrorPattern, ErrorAnalysis } from './types';

// Format duration in human-readable form
export const formatDuration = (ms?: number): string => {
  if (ms === undefined || ms === null) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = ((ms % 60000) / 1000).toFixed(0);
  return `${mins}m ${secs}s`;
};

// Format timestamp to locale string
export const formatDateTime = (dateStr?: string): string => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString();
};

// Format step timestamp with milliseconds
export const formatStepTime = (timestamp?: number): string => {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }) + '.' + String(date.getMilliseconds()).padStart(3, '0');
};

// Format relative time from start
export const formatRelativeTime = (timestamp: number, startTime: number): string => {
  const diff = timestamp - startTime;
  if (diff < 1000) return `+${diff}ms`;
  if (diff < 60000) return `+${(diff / 1000).toFixed(2)}s`;
  const mins = Math.floor(diff / 60000);
  const secs = ((diff % 60000) / 1000).toFixed(0);
  return `+${mins}m ${secs}s`;
};

// Format bytes to human-readable
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// Simple error patterns for detection (Feature #1951)
export const SIMPLE_ERROR_PATTERNS: SimpleErrorPattern[] = [
  { pattern: /element\s*(not\s*found|does\s*not\s*exist|could\s*not\s*be\s*located)/i, tip: 'Check if the selector has changed or the element is inside an iframe/shadow DOM.', category: 'selector' },
  { pattern: /timeout\s*(exceeded|waiting|error)|timed?\s*out/i, tip: 'Increase wait time or check if the page loads slower than expected.', category: 'timeout' },
  { pattern: /navigation\s*(failed|error)|failed\s*to\s*navigate/i, tip: 'Verify the URL is correct and the page is accessible.', category: 'navigation' },
  { pattern: /assertion\s*(failed|error)|expect.*to\s*(be|equal|have|contain)/i, tip: 'Check if the expected value has changed or the comparison is correct.', category: 'assertion' },
  { pattern: /net::err_|network\s*error|connection\s*(refused|reset|failed)/i, tip: 'Check network connectivity and if the server is running.', category: 'network' },
  { pattern: /click\s*intercepted|element\s*is\s*not\s*clickable/i, tip: 'Wait for overlays to close or scroll the element into view.', category: 'interaction' },
  { pattern: /strict\s*mode\s*violation|locator\s*resolved\s*to\s*\d+\s*elements/i, tip: 'Make the selector more specific to match exactly one element.', category: 'selector' },
  { pattern: /frame\s*(detached|was\s*detached)/i, tip: 'The frame navigated away. Wait for navigation to complete.', category: 'frame' },
];

// Detect simple error pattern
export const detectSimpleError = (errorMessage?: string): ErrorAnalysis => {
  if (!errorMessage) return { isSimple: false };

  for (const { pattern, tip, category } of SIMPLE_ERROR_PATTERNS) {
    if (pattern.test(errorMessage)) {
      // Log for tuning (Feature #1951 Step 5)
      console.log('[AI Skip] Simple error detected:', { category, pattern: pattern.source, errorSnippet: errorMessage.slice(0, 100) });
      return { isSimple: true, tip, category };
    }
  }
  // Log complex errors that trigger AI
  console.log('[AI Triggered] Complex error:', { errorSnippet: errorMessage.slice(0, 100) });
  return { isSimple: false };
};

// Get status badge class
export const getStatusBadgeClass = (status: string): string => {
  switch (status) {
    case 'passed':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'failed':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    case 'running':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    case 'pending':
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
  }
};

// Get score color class for Lighthouse scores
export const getScoreColorClass = (score: number): string => {
  if (score >= 90) return 'text-green-600 dark:text-green-400';
  if (score >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
};

// Get score background class for Lighthouse scores
export const getScoreBgClass = (score: number): string => {
  if (score >= 90) return 'bg-green-500';
  if (score >= 50) return 'bg-amber-500';
  return 'bg-red-500';
};

// Get impact badge class for accessibility violations
export const getImpactBadgeClass = (impact: string): string => {
  switch (impact) {
    case 'critical':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    case 'serious':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
    case 'moderate':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    case 'minor':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
  }
};

// Get screenshot type badge color
export const getScreenshotTypeBadgeColor = (type: string): string => {
  switch (type) {
    case 'E2E':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    case 'Visual':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
    case 'Performance':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    case 'Load':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'Accessibility':
      return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
  }
};

// Calculate health score percentage
export const calculateHealthScore = (passed: number, total: number): number => {
  if (total === 0) return 0;
  return Math.round((passed / total) * 100);
};

// Get health score color class
export const getHealthScoreColorClass = (score: number): string => {
  if (score >= 85) return 'text-green-600 dark:text-green-400';
  if (score >= 70) return 'text-amber-600 dark:text-amber-400';
  if (score >= 50) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
};

// Get health score bar color class
export const getHealthScoreBarClass = (score: number): string => {
  if (score >= 85) return 'bg-green-500';
  if (score >= 70) return 'bg-amber-500';
  if (score >= 50) return 'bg-orange-500';
  return 'bg-red-500';
};
