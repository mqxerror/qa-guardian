/**
 * Utility functions for Monitoring Page
 * Extracted from MonitoringPage.tsx for modularity (Feature #47)
 */

import { CheckStatus, PerformanceStatus, MonitoringLocation } from './types';
import { formatDurationPrecise } from '../../utils/formatDuration';
import { formatRelativeTime as sharedFormatRelativeTime } from '../../utils/format';

// Re-export formatDuration for backward compatibility
export { formatDurationPrecise as formatDuration };

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
 return 'text-success';
 case 'down':
 return 'text-destructive';
 case 'degraded':
 return 'text-warning';
 default:
 return 'text-muted-foreground';
 }
};

// Get status background classes
export const getStatusBgClass = (status: CheckStatus | undefined): string => {
 switch (status) {
 case 'up':
 return 'bg-success/10';
 case 'down':
 return 'bg-destructive/10';
 case 'degraded':
 return 'bg-warning/10';
 default:
 return 'bg-muted';
 }
};

// Get status badge classes
export const getStatusBadgeClass = (status: CheckStatus | undefined): string => {
 switch (status) {
 case 'up':
 return 'bg-success/10 text-success';
 case 'down':
 return 'bg-destructive/10 text-destructive';
 case 'degraded':
 return 'bg-warning/10 text-warning';
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
 return 'text-success';
 case 'needs_improvement':
 return 'text-warning';
 case 'poor':
 return 'text-destructive';
 default:
 return 'text-muted-foreground';
 }
};

// Get performance status badge classes
export const getPerformanceStatusBadgeClass = (status: PerformanceStatus | undefined): string => {
 switch (status) {
 case 'good':
 return 'bg-success/10 text-success';
 case 'needs_improvement':
 return 'bg-warning/10 text-warning';
 case 'poor':
 return 'bg-destructive/10 text-destructive';
 default:
 return 'bg-muted text-foreground';
 }
};

// Format date time
export const formatDateTime = (dateStr?: string): string => {
 if (!dateStr) return '-';
 return new Date(dateStr).toLocaleString();
};

// Re-export shared formatRelativeTime for backward compatibility
export const formatRelativeTime = (dateStr?: string): string => sharedFormatRelativeTime(dateStr);

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
 if (ms <= goodThreshold) return 'text-success';
 if (ms <= warnThreshold) return 'text-warning';
 return 'text-destructive';
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
