/**
 * Utility functions for Project Detail Page
 * Extracted from ProjectDetailPage.tsx for modularity (Feature #49)
 * Feature #130: Now uses centralized color system from constants/colors.ts
 */

import { DEVICE_PRESETS, type SASTSeverity, type DASTRisk } from './types';
import { getSeverityColor, getStatusColor } from '../../constants/colors';

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
 * Uses centralized color system (Feature #130)
 */
export function getSASTSeverityClass(severity: SASTSeverity): string {
 // Map SAST severity to our standard severity levels
 switch (severity) {
 case 'CRITICAL':
 return getSeverityColor('critical').badge;
 case 'HIGH':
 return getSeverityColor('high').badge;
 case 'MEDIUM':
 return getSeverityColor('medium').badge;
 case 'LOW':
 return getSeverityColor('low').badge;
 default:
 return getSeverityColor('info').badge;
 }
}

/**
 * Get CSS class for DAST risk level
 * Uses centralized color system (Feature #130)
 */
export function getDASTRiskClass(risk: DASTRisk): string {
 // Map DAST risk to our standard severity levels
 switch (risk) {
 case 'High':
 return getSeverityColor('critical').badge;
 case 'Medium':
 return getSeverityColor('high').badge;
 case 'Low':
 return getSeverityColor('medium').badge;
 case 'Informational':
 return getSeverityColor('low').badge;
 default:
 return getSeverityColor('info').badge;
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
 * Uses centralized color system (Feature #130)
 */
export function getScanStatusClass(status: 'pending' | 'running' | 'completed' | 'failed'): string {
 // Map scan status to our standard status colors
 switch (status) {
 case 'completed':
 return getStatusColor('passed').badge;
 case 'failed':
 return getStatusColor('failed').badge;
 case 'running':
 return getStatusColor('running').badge;
 case 'pending':
 return getStatusColor('pending').badge;
 default:
 return getStatusColor('pending').badge;
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
 * Uses centralized color system (Feature #130)
 */
export function getHealingStrategyClass(strategy: string): string {
 switch (strategy) {
 case 'selector_fallback':
 return getSeverityColor('low').badge; // blue
 case 'visual_match':
 return 'bg-purple-100 text-purple-800'; // purple not in standard
 case 'text_match':
 return getStatusColor('passed').badge; // green
 case 'attribute_match':
 return getSeverityColor('high').badge; // orange
 default:
 return getSeverityColor('info').badge;
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
 * Uses centralized color system (Feature #130)
 */
export function getMemberRoleClass(role: 'developer' | 'viewer'): string {
 switch (role) {
 case 'developer':
 return getSeverityColor('low').badge; // blue
 case 'viewer':
 return getSeverityColor('info').badge; // gray
 default:
 return getSeverityColor('info').badge;
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
