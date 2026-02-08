/**
 * Utility functions for Monitoring Page
 * Extracted from MonitoringPage.tsx for modularity (Feature #47)
 */

import { CheckStatus, PerformanceStatus, MonitoringLocation } from './types';

// Format duration in human-readable form
export const formatDuration = (ms: number): string => {
 if (ms < 1000) return `${ms}ms`;
 if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
 const mins = Math.floor(ms / 60000);
 const secs = Math.floor((ms % 60000) / 1000);
 return `${mins}m ${secs}s`;
};

// Format response time
export const formatResponseTime = (ms?: number): string => {
 if (ms === undefined || ms === null) return '-';
 if (ms < 1000) return `${ms}ms`;
 return `${(ms / 1000).toFixed(2)}s`;
};

// Format uptime percentage
export const formatUptime = (percentage: number): string => {
 return `${percentage.toFixed(2)}%`;
};

// Format interval for display
export const formatInterval = (seconds: number): string => {
 if (seconds < 60) return `${seconds}s`;
 if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
 return `${Math.floor(seconds / 3600)}h`;
};

// Get status color classes
export const getStatusColorClass = (status: CheckStatus | undefined): string => {
 switch (status) {
 case 'up':
 return 'text-green-600';
 case 'down':
 return 'text-red-600';
 case 'degraded':
 return 'text-amber-600';
 default:
 return 'text-muted-foreground';
 }
};

// Get status background classes
export const getStatusBgClass = (status: CheckStatus | undefined): string => {
 switch (status) {
 case 'up':
 return 'bg-green-100';
 case 'down':
 return 'bg-red-100';
 case 'degraded':
 return 'bg-amber-100';
 default:
 return 'bg-muted';
 }
};

// Get status badge classes
export const getStatusBadgeClass = (status: CheckStatus | undefined): string => {
 switch (status) {
 case 'up':
 return 'bg-green-100 text-green-700';
 case 'down':
 return 'bg-red-100 text-red-700';
 case 'degraded':
 return 'bg-amber-100 text-amber-700';
 default:
 return 'bg-muted text-foreground';
 }
};

// Get status icon
export const getStatusIcon = (status: CheckStatus | undefined): string => {
 switch (status) {
 case 'up':
 return '✓';
 case 'down':
 return '✗';
 case 'degraded':
 return '!';
 default:
 return '?';
 }
};

// Get status label
export const getStatusLabel = (status: CheckStatus | undefined): string => {
 switch (status) {
 case 'up':
 return 'Up';
 case 'down':
 return 'Down';
 case 'degraded':
 return 'Degraded';
 default:
 return 'Unknown';
 }
};

// Get performance status color classes
export const getPerformanceStatusColorClass = (status: PerformanceStatus | undefined): string => {
 switch (status) {
 case 'good':
 return 'text-green-600';
 case 'needs_improvement':
 return 'text-amber-600';
 case 'poor':
 return 'text-red-600';
 default:
 return 'text-muted-foreground';
 }
};

// Get performance status badge classes
export const getPerformanceStatusBadgeClass = (status: PerformanceStatus | undefined): string => {
 switch (status) {
 case 'good':
 return 'bg-green-100 text-green-700';
 case 'needs_improvement':
 return 'bg-amber-100 text-amber-700';
 case 'poor':
 return 'bg-red-100 text-red-700';
 default:
 return 'bg-muted text-foreground';
 }
};

// Format date time
export const formatDateTime = (dateStr?: string): string => {
 if (!dateStr) return '-';
 return new Date(dateStr).toLocaleString();
};

// Format relative time (e.g., "2 minutes ago")
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

// Get location display name
export const getLocationName = (location: MonitoringLocation): string => {
 const names: Record<MonitoringLocation, string> = {
 'us-east': 'US East',
 'us-west': 'US West',
 'europe': 'Europe',
 'asia-pacific': 'Asia Pacific',
 'australia': 'Australia',
 };
 return names[location] || location;
};

// Get location region
export const getLocationRegion = (location: MonitoringLocation): string => {
 const regions: Record<MonitoringLocation, string> = {
 'us-east': 'North America',
 'us-west': 'North America',
 'europe': 'Europe',
 'asia-pacific': 'Asia',
 'australia': 'Oceania',
 };
 return regions[location] || 'Unknown';
};

// Get location city
export const getLocationCity = (location: MonitoringLocation): string => {
 const cities: Record<MonitoringLocation, string> = {
 'us-east': 'Virginia',
 'us-west': 'Oregon',
 'europe': 'Frankfurt',
 'asia-pacific': 'Tokyo',
 'australia': 'Sydney',
 };
 return cities[location] || 'Unknown';
};

// Calculate uptime percentage from results
export const calculateUptime = (successful: number, total: number): number => {
 if (total === 0) return 0;
 return (successful / total) * 100;
};

// Get response time color based on threshold
export const getResponseTimeColorClass = (ms: number, goodThreshold = 500, warnThreshold = 1000): string => {
 if (ms <= goodThreshold) return 'text-green-600';
 if (ms <= warnThreshold) return 'text-amber-600';
 return 'text-red-600';
};

// Parse headers string to Record
export const parseHeaders = (headersStr?: string): Record<string, string> => {
 if (!headersStr) return {};
 try {
 return JSON.parse(headersStr);
 } catch {
 return {};
 }
};

// Stringify headers Record to string
export const stringifyHeaders = (headers?: Record<string, string>): string => {
 if (!headers || Object.keys(headers).length === 0) return '';
 return JSON.stringify(headers, null, 2);
};
