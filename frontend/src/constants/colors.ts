/**
 * Feature #130: Centralized Color System
 * Provides consistent color definitions across the application
 *
 * Usage:
 * ```tsx
 * import { SEVERITY_COLORS, getSeverityColor, STATUS_COLORS, getStatusColor } from '../constants/colors';
 *
 * // Get CSS classes
 * const { bg, text, border } = SEVERITY_COLORS.critical;
 * <span className={`${bg} ${text} ${border}`}>Critical</span>
 *
 * // Or use the helper function
 * const colors = getSeverityColor('critical');
 * <span className={colors.badge}>Critical</span>
 * ```
 */

// =============================================================================
// SEVERITY COLORS
// =============================================================================

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';

interface ColorScheme {
 /** Background color class */
 bg: string;
 /** Text color class */
 text: string;
 /** Border color class */
 border: string;
 /** Hover background */
 hoverBg: string;
 /** Combined badge classes */
 badge: string;
 /** Combined card border classes */
 cardBorder: string;
 /** Hex color for charts */
 hex: string;
 /** Dark mode hex for charts */
 hexDark: string;
}

export const SEVERITY_COLORS: Record<SeverityLevel, ColorScheme> = {
 critical: {
 bg: 'bg-destructive/10',
 text: 'text-destructive',
 border: 'border-destructive/20',
 hoverBg: 'hover:bg-destructive/20',
 badge: 'bg-destructive/10 text-destructive',
 cardBorder: 'border-l-4 border-l-red-600',
 hex: '#dc2626', // red-600
 hexDark: '#f87171', // red-400
 },
 high: {
 bg: 'bg-orange-100',
 text: 'text-orange-700',
 border: 'border-orange-200',
 hoverBg: 'hover:bg-orange-200',
 badge: 'bg-orange-100 text-orange-700',
 cardBorder: 'border-l-4 border-l-orange-500',
 hex: '#f97316', // orange-500
 hexDark: '#fb923c', // orange-400
 },
 medium: {
 bg: 'bg-warning/10',
 text: 'text-warning',
 border: 'border-warning/20',
 hoverBg: 'hover:bg-warning/20',
 badge: 'bg-warning/10 text-warning',
 cardBorder: 'border-l-4 border-l-yellow-500',
 hex: '#eab308', // yellow-500
 hexDark: '#facc15', // yellow-400
 },
 low: {
 bg: 'bg-primary/10',
 text: 'text-primary',
 border: 'border-primary/20',
 hoverBg: 'hover:bg-primary/20',
 badge: 'bg-primary/10 text-primary',
 cardBorder: 'border-l-4 border-l-blue-500',
 hex: '#3b82f6', // blue-500
 hexDark: '#60a5fa', // blue-400
 },
 info: {
 bg: 'bg-muted',
 text: 'text-foreground',
 border: 'border-border',
 hoverBg: 'hover:bg-secondary',
 badge: 'bg-muted text-foreground',
 cardBorder: 'border-l-4 border-l-gray-500',
 hex: '#6b7280', // gray-500
 hexDark: '#9ca3af', // gray-400
 },
};

/**
 * Get severity colors by level (case-insensitive)
 */
export function getSeverityColor(level: string): ColorScheme {
 const normalized = level.toLowerCase() as SeverityLevel;
 return SEVERITY_COLORS[normalized] || SEVERITY_COLORS.info;
}

/**
 * Get severity badge class for quick inline use
 */
export function getSeverityBadgeClass(level: string): string {
 return getSeverityColor(level).badge;
}

// =============================================================================
// STATUS COLORS
// =============================================================================

export type StatusType = 'passed' | 'failed' | 'running' | 'pending' | 'cancelled' | 'skipped' | 'error';

export const STATUS_COLORS: Record<StatusType, ColorScheme> = {
 passed: {
 bg: 'bg-success/10',
 text: 'text-success',
 border: 'border-success/20',
 hoverBg: 'hover:bg-success/20',
 badge: 'bg-success/10 text-success',
 cardBorder: 'border-l-4 border-l-green-500',
 hex: '#22c55e', // green-500
 hexDark: '#4ade80', // green-400
 },
 failed: {
 bg: 'bg-destructive/10',
 text: 'text-destructive',
 border: 'border-destructive/20',
 hoverBg: 'hover:bg-destructive/20',
 badge: 'bg-destructive/10 text-destructive',
 cardBorder: 'border-l-4 border-l-red-500',
 hex: '#ef4444', // red-500
 hexDark: '#f87171', // red-400
 },
 running: {
 bg: 'bg-primary/10',
 text: 'text-primary',
 border: 'border-primary/20',
 hoverBg: 'hover:bg-primary/20',
 badge: 'bg-primary/10 text-primary',
 cardBorder: 'border-l-4 border-l-blue-500',
 hex: '#3b82f6', // blue-500
 hexDark: '#60a5fa', // blue-400
 },
 pending: {
 bg: 'bg-warning/10',
 text: 'text-warning',
 border: 'border-warning/20',
 hoverBg: 'hover:bg-warning/20',
 badge: 'bg-warning/10 text-warning',
 cardBorder: 'border-l-4 border-l-yellow-500',
 hex: '#eab308', // yellow-500
 hexDark: '#facc15', // yellow-400
 },
 cancelled: {
 bg: 'bg-muted',
 text: 'text-foreground',
 border: 'border-border',
 hoverBg: 'hover:bg-secondary',
 badge: 'bg-muted text-foreground',
 cardBorder: 'border-l-4 border-l-gray-400',
 hex: '#9ca3af', // gray-400
 hexDark: '#d1d5db', // gray-300
 },
 skipped: {
 bg: 'bg-muted',
 text: 'text-muted-foreground',
 border: 'border-border',
 hoverBg: 'hover:bg-secondary',
 badge: 'bg-muted text-muted-foreground',
 cardBorder: 'border-l-4 border-l-gray-300',
 hex: '#6b7280', // gray-500
 hexDark: '#9ca3af', // gray-400
 },
 error: {
 bg: 'bg-orange-100',
 text: 'text-orange-700',
 border: 'border-orange-200',
 hoverBg: 'hover:bg-orange-200',
 badge: 'bg-orange-100 text-orange-700',
 cardBorder: 'border-l-4 border-l-orange-500',
 hex: '#f97316', // orange-500
 hexDark: '#fb923c', // orange-400
 },
};

/**
 * Get status colors by type (case-insensitive)
 */
export function getStatusColor(status: string): ColorScheme {
 const normalized = status.toLowerCase() as StatusType;
 return STATUS_COLORS[normalized] || STATUS_COLORS.pending;
}

/**
 * Get status badge class for quick inline use
 */
export function getStatusBadgeClass(status: string): string {
 return getStatusColor(status).badge;
}

/**
 * Get status icon by type
 */
export function getStatusIcon(status: string): string {
 const normalized = status.toLowerCase();
 switch (normalized) {
 case 'passed': return '✓';
 case 'failed': return '✗';
 case 'running': return '▶';
 case 'pending': return '⏳';
 case 'cancelled': return '✕';
 case 'skipped': return '⏭';
 case 'error': return '⚠';
 default: return '○';
 }
}

// =============================================================================
// CHART COLORS
// =============================================================================

/**
 * Chart color palette for data visualization
 */
export const CHART_COLORS = {
 primary: {
 light: '#6366f1', // indigo-500
 dark: '#818cf8', // indigo-400
 },
 secondary: {
 light: '#8b5cf6', // violet-500
 dark: '#a78bfa', // violet-400
 },
 success: {
 light: '#22c55e', // green-500
 dark: '#4ade80', // green-400
 },
 danger: {
 light: '#ef4444', // red-500
 dark: '#f87171', // red-400
 },
 warning: {
 light: '#f59e0b', // amber-500
 dark: '#fbbf24', // amber-400
 },
 info: {
 light: '#3b82f6', // blue-500
 dark: '#60a5fa', // blue-400
 },
 muted: {
 light: '#6b7280', // gray-500
 dark: '#9ca3af', // gray-400
 },
};

/**
 * Predefined chart color sequences for multi-series charts
 */
export const CHART_PALETTE = {
 light: [
 '#6366f1', // indigo
 '#22c55e', // green
 '#f59e0b', // amber
 '#ef4444', // red
 '#8b5cf6', // violet
 '#3b82f6', // blue
 '#14b8a6', // teal
 '#f97316', // orange
 ],
 dark: [
 '#818cf8', // indigo
 '#4ade80', // green
 '#fbbf24', // amber
 '#f87171', // red
 '#a78bfa', // violet
 '#60a5fa', // blue
 '#2dd4bf', // teal
 '#fb923c', // orange
 ],
};

/**
 * Get chart colors array for current theme
 */
export function getChartColors(isDark: boolean): string[] {
 return isDark ? CHART_PALETTE.dark : CHART_PALETTE.light;
}

// =============================================================================
// UTILITY EXPORTS
// =============================================================================

/**
 * All color exports for convenience
 */
export const Colors = {
 severity: SEVERITY_COLORS,
 status: STATUS_COLORS,
 chart: CHART_COLORS,
 chartPalette: CHART_PALETTE,
 getSeverity: getSeverityColor,
 getStatus: getStatusColor,
 getChartColors,
};

export default Colors;
