/**
 * Utility functions for Test Detail Page
 * Extracted from TestDetailPage.tsx for modularity (Feature #48)
 */

import { TestStatus, RunStatus, ResultStatus, StepStatus, TestCategory } from './types';

// Format duration in human-readable form
export const formatDuration = (ms?: number): string => {
 if (ms === undefined || ms === null) return '-';
 if (ms < 1000) return `${ms}ms`;
 if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
 const mins = Math.floor(ms / 60000);
 const secs = Math.floor((ms % 60000) / 1000);
 return `${mins}m ${secs}s`;
};

// Format date time
export const formatDateTime = (dateStr?: string): string => {
 if (!dateStr) return '-';
 return new Date(dateStr).toLocaleString();
};

// Format relative time
export const formatRelativeTime = (dateStr?: string): string => {
 if (!dateStr) return '-';
 const date = new Date(dateStr);
 const now = new Date();
 const diffMs = now.getTime() - date.getTime();
 const diffMins = Math.floor(diffMs / 60000);
 const diffHours = Math.floor(diffMins / 60);
 const diffDays = Math.floor(diffHours / 24);

 if (diffMins < 1) return 'Just now';
 if (diffMins < 60) return `${diffMins}m ago`;
 if (diffHours < 24) return `${diffHours}h ago`;
 if (diffDays < 7) return `${diffDays}d ago`;
 return date.toLocaleDateString();
};

// Get status color classes
export const getStatusColorClass = (status: TestStatus | RunStatus | ResultStatus | StepStatus | undefined): string => {
 switch (status) {
 case 'passed':
 return 'text-green-600';
 case 'failed':
 case 'error':
 return 'text-red-600';
 case 'warning':
 return 'text-amber-600';
 case 'running':
 case 'active':
 return 'text-blue-600';
 case 'pending':
 case 'draft':
 return 'text-gray-600';
 case 'skipped':
 case 'cancelled':
 return 'text-gray-500';
 default:
 return 'text-gray-500';
 }
};

// Get status badge classes
export const getStatusBadgeClass = (status: TestStatus | RunStatus | ResultStatus | StepStatus | undefined): string => {
 switch (status) {
 case 'passed':
 return 'bg-green-100 text-green-700';
 case 'failed':
 case 'error':
 return 'bg-red-100 text-red-700';
 case 'warning':
 return 'bg-amber-100 text-amber-700';
 case 'running':
 case 'active':
 return 'bg-blue-100 text-blue-700';
 case 'pending':
 case 'draft':
 return 'bg-gray-100 text-gray-700';
 case 'skipped':
 case 'cancelled':
 return 'bg-gray-100 text-gray-500';
 default:
 return 'bg-gray-100 text-gray-700';
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
 'e2e': 'text-blue-600',
 'visual_regression': 'text-purple-600',
 'lighthouse': 'text-amber-600',
 'load': 'text-green-600',
 'accessibility': 'text-indigo-600',
 'api': 'text-cyan-600',
 };
 return colors[type] || 'text-gray-600';
};

// Get test type badge classes
export const getTestTypeBadgeClass = (type: TestCategory): string => {
 const badges: Record<TestCategory, string> = {
 'e2e': 'bg-blue-100 text-blue-700',
 'visual_regression': 'bg-purple-100 text-purple-700',
 'lighthouse': 'bg-amber-100 text-amber-700',
 'load': 'bg-green-100 text-green-700',
 'accessibility': 'bg-indigo-100 text-indigo-700',
 'api': 'bg-cyan-100 text-cyan-700',
 };
 return badges[type] || 'bg-gray-100 text-gray-700';
};

// Get test type icon
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

// Format bytes
export const formatBytes = (bytes: number): string => {
 if (bytes === 0) return '0 B';
 const k = 1024;
 const sizes = ['B', 'KB', 'MB', 'GB'];
 const i = Math.floor(Math.log(bytes) / Math.log(k));
 return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// Get Lighthouse score color
export const getLighthouseScoreColorClass = (score: number): string => {
 if (score >= 90) return 'text-green-600';
 if (score >= 50) return 'text-amber-600';
 return 'text-red-600';
};

// Get Lighthouse score badge class
export const getLighthouseScoreBadgeClass = (score: number): string => {
 if (score >= 90) return 'bg-green-100 text-green-700';
 if (score >= 50) return 'bg-amber-100 text-amber-700';
 return 'bg-red-100 text-red-700';
};

// Get accessibility impact color
export const getImpactColorClass = (impact: string): string => {
 switch (impact) {
 case 'critical':
 return 'text-red-600';
 case 'serious':
 return 'text-orange-600';
 case 'moderate':
 return 'text-amber-600';
 case 'minor':
 return 'text-blue-600';
 default:
 return 'text-gray-600';
 }
};

// Get accessibility impact badge class
export const getImpactBadgeClass = (impact: string): string => {
 switch (impact) {
 case 'critical':
 return 'bg-red-100 text-red-700';
 case 'serious':
 return 'bg-orange-100 text-orange-700';
 case 'moderate':
 return 'bg-amber-100 text-amber-700';
 case 'minor':
 return 'bg-blue-100 text-blue-700';
 default:
 return 'bg-gray-100 text-gray-700';
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
