/**
 * Utility functions for Test Suite Detail Page
 * Extracted from TestSuitePage.tsx for modularity (Feature #50)
 */

import type { TestTypeEnum, TestStatus, SortField, SortDirection, TestType } from './types';

/**
 * Extract URL from user description text
 * Matches URLs like: mercan.pa, https://mercan.pa, www.example.org, sub.domain.com/path
 */
export function extractUrlFromText(text: string): string | null {
  if (!text) return null;

  // Match full URLs first (with protocol)
  const fullUrlMatch = text.match(/https?:\/\/[^\s<>"']+/i);
  if (fullUrlMatch) {
    return fullUrlMatch[0].replace(/[.,;:!?)]+$/, '');
  }

  // Match domain-like patterns (domain.tld, www.domain.tld)
  const domainMatch = text.match(
    /(?:^|\s)((?:www\.)?[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.(?:com|org|net|io|co|pa|dev|app|ai|me|us|uk|de|fr|es|it|nl|be|ch|at|au|nz|jp|kr|cn|in|br|mx|ar|cl|ru|pl|se|no|dk|fi|pt|gr|cz|hu|ro|bg|hr|sk|si|lt|lv|ee|is|ie|lu|mt|cy)[^\s<>"']*)(?:\s|$)/i
  );
  if (domainMatch) {
    const domain = domainMatch[1].replace(/[.,;:!?)]+$/, '');
    return `https://${domain}`;
  }

  return null;
}

/**
 * Extract test type from natural language description
 * Detects: visual, e2e, performance, load, accessibility
 */
export function extractTestTypeFromText(text: string): TestTypeEnum | null {
  if (!text) return null;
  const lower = text.toLowerCase();

  // Visual regression patterns
  if (/visual|screenshot|baseline|pixel|appearance|look|design|ui\s*check/i.test(lower)) {
    return 'visual_regression';
  }

  // Performance/Lighthouse patterns
  if (/performance|lighthouse|speed|lcp|cls|fcp|core\s*web\s*vitals|page\s*speed/i.test(lower)) {
    return 'lighthouse';
  }

  // Load test patterns
  if (/load\s*test|stress|k6|concurrent|virtual\s*users|throughput|scalability/i.test(lower)) {
    return 'load';
  }

  // Accessibility patterns
  if (/accessibility|a11y|wcag|screen\s*reader|aria|accessible/i.test(lower)) {
    return 'accessibility';
  }

  // E2E patterns (default for action-based descriptions)
  if (/click|fill|type|login|submit|navigate|form|button|input|test\s+that|verify|check\s+if/i.test(lower)) {
    return 'e2e';
  }

  return null;
}

/**
 * Extract viewport from natural language description
 * Detects: mobile, tablet, desktop
 */
export function extractViewportFromText(text: string): { width: number; height: number; preset: string } | null {
  if (!text) return null;
  const lower = text.toLowerCase();

  // Mobile patterns
  if (/mobile|phone|iphone|android|small\s*screen/i.test(lower)) {
    return { width: 375, height: 812, preset: 'Mobile (375x812)' };
  }

  // Tablet patterns
  if (/tablet|ipad|medium\s*screen/i.test(lower)) {
    return { width: 768, height: 1024, preset: 'Tablet (768x1024)' };
  }

  // Desktop patterns (explicit)
  if (/desktop|large\s*screen|full\s*screen|1920|1080/i.test(lower)) {
    return { width: 1920, height: 1080, preset: 'Desktop (1920x1080)' };
  }

  return null;
}

/**
 * Format date as relative time (e.g., "2m ago", "1h ago")
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

/**
 * Get icon for test type
 */
export function getTestTypeIcon(type: TestTypeEnum): string {
  switch (type) {
    case 'e2e':
      return '🎭';
    case 'visual_regression':
      return '📸';
    case 'lighthouse':
      return '⚡';
    case 'load':
      return '📊';
    case 'accessibility':
      return '♿';
    case 'api':
      return '🔌';
    default:
      return '🧪';
  }
}

/**
 * Get human-readable label for test type
 */
export function getTestTypeLabel(type: TestTypeEnum): string {
  switch (type) {
    case 'e2e':
      return 'E2E Test';
    case 'visual_regression':
      return 'Visual';
    case 'lighthouse':
      return 'Performance';
    case 'load':
      return 'Load Test';
    case 'accessibility':
      return 'A11y';
    case 'api':
      return 'API';
    default:
      return type;
  }
}

/**
 * Get CSS class for test status badge
 */
export function getTestStatusClass(status: TestStatus | string | null): string {
  switch (status) {
    case 'passed':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'failed':
    case 'error':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    case 'running':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'pending':
    case 'active':
    case 'draft':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
  }
}

/**
 * Get icon for test status
 */
export function getTestStatusIcon(status: TestStatus | string | null): string {
  switch (status) {
    case 'passed':
      return '✓';
    case 'failed':
    case 'error':
      return '✗';
    case 'running':
      return '⟳';
    case 'pending':
    case 'active':
    case 'draft':
      return '○';
    default:
      return '—';
  }
}

/**
 * Get CSS class for action type badge
 */
export function getActionTypeClass(action: string): string {
  switch (action) {
    case 'click':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'type':
    case 'fill':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
    case 'navigate':
    case 'goto':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'expect':
    case 'assert':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
    case 'wait':
    case 'screenshot':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
  }
}

/**
 * Get icon for action type
 */
export function getActionTypeIcon(action: string): string {
  switch (action) {
    case 'click':
      return '👆';
    case 'type':
    case 'fill':
      return '⌨️';
    case 'navigate':
    case 'goto':
      return '🔗';
    case 'expect':
    case 'assert':
      return '✓';
    case 'wait':
      return '⏱️';
    case 'screenshot':
      return '📷';
    default:
      return '📝';
  }
}

/**
 * Sort tests by the specified field and direction
 */
export function sortTests(tests: TestType[], field: SortField, direction: SortDirection): TestType[] {
  return [...tests].sort((a, b) => {
    let comparison = 0;

    switch (field) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'type':
        comparison = (a.type || '').localeCompare(b.type || '');
        break;
      case 'status':
        comparison = (a.last_result || '').localeCompare(b.last_result || '');
        break;
      case 'last_run_at':
        const dateA = a.last_run_at ? new Date(a.last_run_at).getTime() : 0;
        const dateB = b.last_run_at ? new Date(b.last_run_at).getTime() : 0;
        comparison = dateA - dateB;
        break;
      case 'run_count':
        comparison = (a.run_count || 0) - (b.run_count || 0);
        break;
      case 'avg_duration_ms':
        comparison = (a.avg_duration_ms || 0) - (b.avg_duration_ms || 0);
        break;
      default:
        comparison = 0;
    }

    return direction === 'asc' ? comparison : -comparison;
  });
}

/**
 * Format duration in milliseconds to human-readable string
 */
export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Auto-complete URL with https:// if missing
 */
export function autoCompleteUrl(url: string): string {
  if (!url) return url;
  const trimmed = url.trim();
  if (trimmed && !trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

/**
 * Get CSS class for AI confidence score
 */
export function getConfidenceClass(score: number): string {
  if (score >= 0.8) {
    return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
  }
  if (score >= 0.5) {
    return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
  }
  return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
}

/**
 * Format confidence score as percentage
 */
export function formatConfidence(score: number | undefined): string {
  if (score === undefined) return '—';
  return `${Math.round(score * 100)}%`;
}

/**
 * Get browser icon
 */
export function getBrowserIcon(browser?: string): string {
  switch (browser) {
    case 'chromium':
      return '🌐';
    case 'firefox':
      return '🦊';
    case 'webkit':
      return '🧭';
    default:
      return '🌐';
  }
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}
