/**
 * AI-Ready Badges
 *
 * Visual indicators for AI-powered and MCP-ready features.
 * Reinforces the "All tests. One platform. AI-ready." positioning.
 *
 * Feature #1399: Add AI-ready badges to MCP and AI features
 */

import React from 'react';

interface BadgeProps {
 size?: 'sm' | 'md' | 'lg';
 className?: string;
}

/**
 * AI Powered badge - indicates features using Claude AI
 */
export function AIPoweredBadge({ size = 'md', className = '' }: BadgeProps) {
 const sizeClasses = {
 sm: 'text-xs px-1.5 py-0.5 gap-0.5',
 md: 'text-xs px-2 py-1 gap-1',
 lg: 'text-sm px-2.5 py-1 gap-1.5',
 };

 const iconSizes = {
 sm: 'w-3 h-3',
 md: 'w-3.5 h-3.5',
 lg: 'w-4 h-4',
 };

 return (
 <span
 className={`inline-flex items-center rounded-full bg-gradient-to-r from-accent/10 to-primary/10 border border-accent/30 text-accent font-medium ${sizeClasses[size]} ${className}`}
 title="Powered by Claude AI"
 >
 <svg
 className={iconSizes[size]}
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="2"
 strokeLinecap="round"
 strokeLinejoin="round"
 >
 <path d="M12 2L2 7l10 5 10-5-10-5z" />
 <path d="M2 17l10 5 10-5" />
 <path d="M2 12l10 5 10-5" />
 </svg>
 <span>AI Powered</span>
 </span>
 );
}

/**
 * MCP Ready badge - indicates MCP-callable tools/features
 */
export function MCPReadyBadge({ size = 'md', className = '' }: BadgeProps) {
 const sizeClasses = {
 sm: 'text-xs px-1.5 py-0.5 gap-0.5',
 md: 'text-xs px-2 py-1 gap-1',
 lg: 'text-sm px-2.5 py-1 gap-1.5',
 };

 const iconSizes = {
 sm: 'w-3 h-3',
 md: 'w-3.5 h-3.5',
 lg: 'w-4 h-4',
 };

 return (
 <span
 className={`inline-flex items-center rounded-full bg-gradient-to-r from-success/10 to-info/10 border border-success/30 text-success font-medium ${sizeClasses[size]} ${className}`}
 title="Available via Model Context Protocol (MCP)"
 >
 <svg
 className={iconSizes[size]}
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="2"
 strokeLinecap="round"
 strokeLinejoin="round"
 >
 <path d="M18 20V10" />
 <path d="M12 20V4" />
 <path d="M6 20v-6" />
 </svg>
 <span>MCP Ready</span>
 </span>
 );
}

/**
 * Combined AI + MCP badge for features that support both
 */
export function AIReadyBadge({ size = 'md', className = '' }: BadgeProps) {
 const sizeClasses = {
 sm: 'text-xs px-1.5 py-0.5 gap-0.5',
 md: 'text-xs px-2 py-1 gap-1',
 lg: 'text-sm px-2.5 py-1 gap-1.5',
 };

 const iconSizes = {
 sm: 'w-3 h-3',
 md: 'w-3.5 h-3.5',
 lg: 'w-4 h-4',
 };

 return (
 <span
 className={`inline-flex items-center rounded-full bg-gradient-to-r from-warning/10 via-warning/10 to-destructive/10 border border-warning/30 text-warning font-medium ${sizeClasses[size]} ${className}`}
 title="AI-ready: Powered by Claude AI and available via MCP"
 >
 <svg
 className={iconSizes[size]}
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="2"
 strokeLinecap="round"
 strokeLinejoin="round"
 >
 <circle cx="12" cy="12" r="10" />
 <path d="M12 16v-4" />
 <path d="M12 8h.01" />
 </svg>
 <span>AI Ready</span>
 </span>
 );
}

/**
 * Sidebar dot indicator for AI-powered features (subtle)
 */
export function AIDot({ className = '' }: { className?: string }) {
 return (
 <span
 className={`inline-block w-1.5 h-1.5 rounded-full bg-accent ${className}`}
 title="AI Powered"
 />
 );
}

/**
 * Sidebar dot indicator for MCP-ready features (subtle)
 */
export function MCPDot({ className = '' }: { className?: string }) {
 return (
 <span
 className={`inline-block w-1.5 h-1.5 rounded-full bg-success ${className}`}
 title="MCP Ready"
 />
 );
}

export default {
 AIPoweredBadge,
 MCPReadyBadge,
 AIReadyBadge,
 AIDot,
 MCPDot,
};
