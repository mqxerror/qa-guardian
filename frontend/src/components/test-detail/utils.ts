/**
 * Utility functions for Test Detail Page
 * Extracted from TestDetailPage.tsx for modularity (Feature #48)
 */

import { TestStatus, RunStatus, ResultStatus, StepStatus, TestCategory } from './types';
import { formatDurationPrecise } from '../../utils/formatDuration';
import { formatRelativeTime as sharedFormatRelativeTime, formatBytes as sharedFormatBytes } from '../../utils/format';

// Re-export formatDuration for backward compatibility
export { formatDurationPrecise as formatDuration };

// Format date time
export const formatDateTime = (dateStr?: string): string => {
 if (!dateStr) return '-';
 return new Date(dateStr).toLocaleString();
};

// Re-export shared formatRelativeTime for backward compatibility
export const formatRelativeTime = (dateStr?: string): string => sharedFormatRelativeTime(dateStr);

// Get status color classes
export const getStatusColorClass = (status: TestStatus | RunStatus | ResultStatus | StepStatus | undefined): string => {
 switch (status) {
 case 'passed':
 return 'text-success';
 case 'failed':
 case 'error':
 return 'text-destructive';
 case 'warning':
 return 'text-warning';
 case 'running':
 case 'active':
 return 'text-primary';
 case 'pending':
 case 'draft':
 return 'text-foreground';
 case 'skipped':
 case 'cancelled':
 return 'text-muted-foreground';
 default:
 return 'text-muted-foreground';
 }
};

// Get status badge classes
export const getStatusBadgeClass = (status: TestStatus | RunStatus | ResultStatus | StepStatus | undefined): string => {
 switch (status) {
 case 'passed':
 return 'bg-success/10 text-success';
 case 'failed':
 case 'error':
 return 'bg-destructive/10 text-destructive';
 case 'warning':
 return 'bg-warning/10 text-warning';
 case 'running':
 case 'active':
 return 'bg-primary/10 text-primary';
 case 'pending':
 case 'draft':
 return 'bg-muted text-foreground';
 case 'skipped':
 case 'cancelled':
 return 'bg-muted text-muted-foreground';
 default:
 return 'bg-muted text-foreground';
 }
};

// Get status icon
export const getStatusIcon = (status: TestStatus | RunStatus | ResultStatus | StepStatus | undefined): string => {
 switch (status) {
 case 'passed':
 return '✓';
 case 'failed':
 case 'error':
 return '✗';
 case 'warning':
 return '!';
 case 'running':
 case 'active':
 return '●';
 case 'pending':
 case 'draft':
 return '○';
 case 'skipped':
 case 'cancelled':
 return '—';
 default:
 return '?';
 }
};

// Get status label
export const getStatusLabel = (status: TestStatus | RunStatus | ResultStatus | StepStatus | undefined): string => {
 switch (status) {
 case 'passed':
 return 'Passed';
 case 'failed':
 return 'Failed';
 case 'error':
 return 'Error';
 case 'warning':
 return 'Warning';
 case 'running':
 return 'Running';
 case 'active':
 return 'Active';
 case 'pending':
 return 'Pending';
 case 'draft':
 return 'Draft';
 case 'skipped':
 return 'Skipped';
 case 'cancelled':
 return 'Cancelled';
 default:
 return 'Unknown';
 }
};

// Get test type label
export const getTestTypeLabel = (type: TestCategory): string => {
 const labels: Record<TestCategory, string> = {
 'e2e': 'E2E',
 'visual_regression': 'Visual',
 'lighthouse': 'Performance',
 'load': 'Load',
 'accessibility': 'A11y',
 'api': 'API',
 };
 return labels[type] || type;
};

// Get test type color classes
export const getTestTypeColorClass = (type: TestCategory): string => {
 const colors: Record<TestCategory, string> = {
 'e2e': 'text-primary',
 'visual_regression': 'text-accent',
 'lighthouse': 'text-warning',
 'load': 'text-success',
 'accessibility': 'text-accent',
 'api': 'text-info',
 };
 return colors[type] || 'text-foreground';
};

// Get test type badge classes
export const getTestTypeBadgeClass = (type: TestCategory): string => {
 const badges: Record<TestCategory, string> = {
 'e2e': 'bg-primary/10 text-primary',
 'visual_regression': 'bg-accent/10 text-accent',
 'lighthouse': 'bg-warning/10 text-warning',
 'load': 'bg-success/10 text-success',
 'accessibility': 'bg-accent/10 text-accent',
 'api': 'bg-info/10 text-info',
 };
 return badges[type] || 'bg-muted text-foreground';
};

// Get test type icon - NOTE: Currently unused, kept for backward compatibility
// Feature #571: For Lucide icons, use suite-detail/TestTypeBadge component instead
export const getTestTypeIcon = (type: TestCategory): string => {
 const icons: Record<TestCategory, string> = {
 'e2e': '🧪',
 'visual_regression': '🎨',
 'lighthouse': '⚡',
 'load': '📊',
 'accessibility': '♿',
 'api': '🔌',
 };
 return icons[type] || '📝';
};

// Format percentage
export const formatPercentage = (value?: number): string => {
 if (value === undefined || value === null) return '-';
 return `${value.toFixed(1)}%`;
};

// Re-export shared formatBytes for backward compatibility
export const formatBytes = sharedFormatBytes;

// Get Lighthouse score color
export const getLighthouseScoreColorClass = (score: number): string => {
 if (score >= 90) return 'text-success';
 if (score >= 50) return 'text-warning';
 return 'text-destructive';
};

// Get Lighthouse score badge class
export const getLighthouseScoreBadgeClass = (score: number): string => {
 if (score >= 90) return 'bg-success/10 text-success';
 if (score >= 50) return 'bg-warning/10 text-warning';
 return 'bg-destructive/10 text-destructive';
};

// Get accessibility impact color
export const getImpactColorClass = (impact: string): string => {
 switch (impact) {
 case 'critical':
 return 'text-destructive';
 case 'serious':
 return 'text-warning';
 case 'moderate':
 return 'text-warning';
 case 'minor':
 return 'text-primary';
 default:
 return 'text-foreground';
 }
};

// Get accessibility impact badge class
export const getImpactBadgeClass = (impact: string): string => {
 switch (impact) {
 case 'critical':
 return 'bg-destructive/10 text-destructive';
 case 'serious':
 return 'bg-warning/10 text-warning';
 case 'moderate':
 return 'bg-warning/10 text-warning';
 case 'minor':
 return 'bg-primary/10 text-primary';
 default:
 return 'bg-muted text-foreground';
 }
};

// Calculate pass rate
export const calculatePassRate = (passed: number, total: number): number => {
 if (total === 0) return 0;
 return (passed / total) * 100;
};

// Truncate text with ellipsis
export const truncateText = (text: string, maxLength: number): string => {
 if (text.length <= maxLength) return text;
 return text.slice(0, maxLength - 3) + '...';
};

