/**
 * Feature #687: Canonical formatDuration utility
 *
 * Consolidates 11 duplicate implementations across the codebase.
 * Converts milliseconds to human-readable duration strings.
 *
 * Examples:
 * - 500 → "500ms"
 * - 1500 → "1.5s"
 * - 65000 → "1m 5s"
 * - null/undefined → "-"
 */

/**
 * Format milliseconds to a human-readable duration string
 *
 * @param ms - Duration in milliseconds (can be null/undefined)
 * @param options - Formatting options
 * @returns Formatted duration string (e.g., "500ms", "1.5s", "2m 30s")
 */
export function formatDuration(
  ms: number | null | undefined,
  options: {
    /** Number of decimal places for seconds (default: 1) */
    decimalPlaces?: number;
    /** String to return for null/undefined values (default: "-") */
    nullValue?: string;
    /** Whether to include minutes/hours for long durations (default: true) */
    expandMinutes?: boolean;
  } = {}
): string {
  const { decimalPlaces = 1, nullValue = '-', expandMinutes = true } = options;

  // Handle null/undefined
  if (ms === null || ms === undefined) {
    return nullValue;
  }

  // Handle milliseconds (< 1 second)
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }

  // Handle seconds (< 1 minute)
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(decimalPlaces)}s`;
  }

  // Handle minutes (and optionally hours)
  if (expandMinutes) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);

    if (ms >= 3600000) {
      // >= 1 hour
      const hours = Math.floor(ms / 3600000);
      const remainingMinutes = Math.floor((ms % 3600000) / 60000);
      return `${hours}h ${remainingMinutes}m`;
    }

    return `${minutes}m ${seconds}s`;
  }

  // Simple mode: just show minutes with decimal
  return `${(ms / 60000).toFixed(decimalPlaces)}m`;
}

/**
 * Format duration with 2 decimal places for seconds
 * Used in detailed/technical contexts
 */
export function formatDurationPrecise(ms: number | null | undefined): string {
  return formatDuration(ms, { decimalPlaces: 2 });
}

/**
 * Format duration with em-dash for null values
 * Used in table contexts where em-dash looks better
 */
export function formatDurationWithDash(ms: number | null | undefined): string {
  return formatDuration(ms, { nullValue: '—' });
}

export default formatDuration;
