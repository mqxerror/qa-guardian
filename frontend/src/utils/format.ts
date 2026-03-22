/**
 * Shared formatting utilities
 *
 * Consolidates duplicated formatting functions from across the frontend codebase.
 * Each function was previously defined inline in multiple components/pages.
 */

/**
 * Format a date (string or Date object) as a human-readable relative time.
 * Handles: "Just now", "Xm ago", "Xh ago", "Xd ago", or falls back to locale date.
 *
 * @param input - Date string, Date object, or null/undefined
 * @param options - Formatting options
 * @returns Human-readable relative time string (e.g., "5m ago", "2d ago")
 */
export function formatRelativeTime(
  input: string | Date | null | undefined,
  options: { nullValue?: string } = {}
): string {
  const { nullValue = '-' } = options;

  if (!input) return nullValue;

  const date = typeof input === 'string' ? new Date(input) : input;
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
 * Format bytes to a human-readable string.
 *
 * @param bytes - Number of bytes
 * @param decimals - Number of decimal places (default: 1)
 * @returns Human-readable string (e.g., "1.5 MB", "0 B")
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

/**
 * Escape HTML special characters to prevent XSS attacks.
 * Replaces &, <, >, ", and ' with their HTML entity equivalents.
 *
 * SECURITY: This MUST be called before any regex-based syntax highlighting
 * when the output will be used with dangerouslySetInnerHTML.
 *
 * @param str - The string to escape
 * @returns HTML-escaped string safe for embedding in HTML
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
