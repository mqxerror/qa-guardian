/**
 * Utility functions for Project Detail Page
 * Extracted from ProjectDetailPage.tsx for modularity (Feature #49)
 */

import { DEVICE_PRESETS, type SASTSeverity, type DASTRisk } from './types';

/**
 * Helper function to extract error messages from unknown error types
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === 'string') {
    return err;
  }
  return fallback;
}

/**
 * Get viewport dimensions for a device preset
 */
export function getDevicePresetDimensions(preset: string): { width: number; height: number } | null {
  const device = DEVICE_PRESETS[preset];
  if (device && preset !== 'custom') {
    return { width: device.width, height: device.height };
  }
  return null;
}

/**
 * Get CSS class for SAST severity badge
 */
export function getSASTSeverityClass(severity: SASTSeverity): string {
  switch (severity) {
    case 'CRITICAL':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    case 'HIGH':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
    case 'MEDIUM':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'LOW':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
  }
}

/**
 * Get CSS class for DAST risk level
 */
export function getDASTRiskClass(risk: DASTRisk): string {
  switch (risk) {
    case 'High':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    case 'Medium':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
    case 'Low':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'Informational':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
  }
}

/**
 * Get icon for alert channel type
 */
export function getAlertChannelIcon(type: 'email' | 'slack' | 'webhook'): string {
  switch (type) {
    case 'email':
      return '📧';
    case 'slack':
      return '💬';
    case 'webhook':
      return '🔗';
    default:
      return '📢';
  }
}

/**
 * Get human-readable label for alert condition
 */
export function getAlertConditionLabel(condition: 'any_failure' | 'all_failures' | 'threshold'): string {
  switch (condition) {
    case 'any_failure':
      return 'On any test failure';
    case 'all_failures':
      return 'When all tests fail';
    case 'threshold':
      return 'When failure threshold exceeded';
    default:
      return condition;
  }
}

/**
 * Get CSS class for scan status
 */
export function getScanStatusClass(status: 'pending' | 'running' | 'completed' | 'failed'): string {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'failed':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    case 'running':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'pending':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
  }
}

/**
 * Get icon for scan status
 */
export function getScanStatusIcon(status: 'pending' | 'running' | 'completed' | 'failed'): string {
  switch (status) {
    case 'completed':
      return '✓';
    case 'failed':
      return '✗';
    case 'running':
      return '⟳';
    case 'pending':
      return '○';
    default:
      return '?';
  }
}

/**
 * Get CSS class for healing strategy badge
 */
export function getHealingStrategyClass(strategy: string): string {
  switch (strategy) {
    case 'selector_fallback':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'visual_match':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
    case 'text_match':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'attribute_match':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
  }
}

/**
 * Get human-readable label for healing strategy
 */
export function getHealingStrategyLabel(strategy: string): string {
  switch (strategy) {
    case 'selector_fallback':
      return 'Selector Fallback';
    case 'visual_match':
      return 'Visual Match';
    case 'text_match':
      return 'Text Match';
    case 'attribute_match':
      return 'Attribute Match';
    default:
      return strategy;
  }
}

/**
 * Format file path for display (truncate long paths)
 */
export function formatFilePath(path: string, maxLength: number = 50): string {
  if (path.length <= maxLength) return path;
  const parts = path.split('/');
  if (parts.length <= 2) return path;
  return `.../${parts.slice(-2).join('/')}`;
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate webhook URL format
 */
export function isValidWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Get member role badge class
 */
export function getMemberRoleClass(role: 'developer' | 'viewer'): string {
  switch (role) {
    case 'developer':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'viewer':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
  }
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

/**
 * Get relative time string (e.g., "2 hours ago")
 */
export function getRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Parse comma-separated emails into array
 */
export function parseEmailList(emailString: string): string[] {
  return emailString
    .split(',')
    .map(e => e.trim())
    .filter(e => e.length > 0);
}

/**
 * Check if browser type is valid
 */
export function isValidBrowser(browser: string): browser is 'chromium' | 'firefox' | 'webkit' {
  return ['chromium', 'firefox', 'webkit'].includes(browser);
}
