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
      className={`inline-flex items-center rounded-full bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 text-purple-600 dark:text-purple-400 font-medium ${sizeClasses[size]} ${className}`}
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
      className={`inline-flex items-center rounded-full bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-medium ${sizeClasses[size]} ${className}`}
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
      className={`inline-flex items-center rounded-full bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-red-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-medium ${sizeClasses[size]} ${className}`}
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
      className={`inline-block w-1.5 h-1.5 rounded-full bg-purple-500 ${className}`}
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
      className={`inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 ${className}`}
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
