/**
 * Collapsible Navigation Group Component
 *
 * Feature #1501: A reusable component for creating collapsible sections in the sidebar.
 * Feature #1502: Added badge support for security alerts.
 *
 * Features:
 * - Expand/collapse with animated chevron icon
 * - Smooth height transition animation
 * - Shows active indicator dot when any child item is active (even when collapsed)
 * - State persisted via parent component (localStorage)
 * - Optional badge count for alerts/notifications
 *
 * Extracted from Sidebar.tsx for Feature #104.
 */
import React from 'react';
import { Archive, ChevronDown } from 'lucide-react';

interface CollapsibleNavGroupProps {
  label: string;
  collapsed: boolean;  // sidebar collapsed state
  isExpanded: boolean; // group expanded state
  onToggle: () => void;
  hasActiveChild: boolean;
  sectionId?: string; // Feature #1509: For scroll-to-section support
  children: React.ReactNode;
  icon?: React.ReactNode;
  badgeCount?: number; // Feature #1502: Optional badge for alerts
  badgeColor?: 'amber' | 'red' | 'primary'; // Feature #1502: Badge color variant
  shortcutKey?: string; // Feature #1505: Keyboard shortcut key hint
  showShortcutHint?: boolean; // Feature #1505: Whether to show shortcut hint
}

export function CollapsibleNavGroup({
  label,
  collapsed,
  isExpanded,
  onToggle,
  hasActiveChild,
  children,
  icon,
  badgeCount = 0,
  badgeColor = 'amber',
  shortcutKey,
  showShortcutHint = false,
  sectionId
}: CollapsibleNavGroupProps) {
  // Badge color class mapping
  const badgeColorClass = {
    amber: 'bg-warning',
    red: 'bg-destructive',
    primary: 'bg-primary'
  }[badgeColor];

  // When sidebar is collapsed, show just the icon or a small indicator
  if (collapsed) {
    return (
      <div className="relative" data-section={sectionId}>
        <button
          onClick={onToggle}
          title={`${label}${badgeCount > 0 ? ` (${badgeCount} alerts)` : ''}${shortcutKey ? ` (G+${shortcutKey})` : ''}`}
          className={`flex items-center justify-center w-full rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            hasActiveChild
              ? 'text-primary'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          {icon || (
            <Archive className="h-5 w-5" />
          )}
          {/* Feature #1505: Shortcut hint when G is pressed */}
          {showShortcutHint && shortcutKey && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded bg-primary text-[10px] text-white font-bold animate-pulse shadow-lg">
              {shortcutKey}
            </span>
          )}
          {/* Badge when collapsed - takes priority over active indicator (when not showing shortcut) */}
          {!showShortcutHint && badgeCount > 0 ? (
            <span className={`absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full ${badgeColorClass} text-[10px] text-white font-bold`}>
              {badgeCount > 9 ? '!' : badgeCount}
            </span>
          ) : !showShortcutHint && hasActiveChild && (
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1" data-section={sectionId}>
      {/* Group header */}
      <button
        onClick={onToggle}
        className={`flex items-center justify-between w-full rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          hasActiveChild
            ? 'text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <span className="flex items-center gap-2">
          {icon && <span className="text-muted-foreground">{icon}</span>}
          <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
          {/* Feature #1505: Shortcut hint when G is pressed */}
          {showShortcutHint && shortcutKey && (
            <span className="flex h-5 w-5 items-center justify-center rounded bg-primary text-[10px] text-white font-bold animate-pulse">
              {shortcutKey}
            </span>
          )}
          {/* Badge - takes priority over active indicator (when not showing shortcut) */}
          {!showShortcutHint && badgeCount > 0 ? (
            <span className={`flex h-5 min-w-[20px] items-center justify-center rounded-full ${badgeColorClass} text-xs text-white font-bold px-1`}>
              {badgeCount > 99 ? '99+' : badgeCount}
            </span>
          ) : !showShortcutHint && !isExpanded && hasActiveChild && (
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          )}
        </span>
        {/* Animated chevron */}
        <ChevronDown className={`h-4 w-4 transition-transform duration-200 ease-in-out ${isExpanded ? '' : '-rotate-90'}`} />
      </button>

      {/* Animated content container */}
      <div
        className={`overflow-hidden transition-all duration-200 ease-in-out ${
          isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="pl-2 space-y-1">
          {children}
        </div>
      </div>
    </div>
  );
}
