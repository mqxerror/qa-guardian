/**
 * Navigation Item Components
 *
 * NavItem and NavItemWithBadge components for sidebar navigation links.
 * Includes PinIcon for the pin functionality.
 * Extracted from Sidebar.tsx for Feature #104.
 */
import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';

// Feature #1364: Pin icon for menu items
export const PinIcon = ({ filled }: { filled?: boolean }) => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill={filled ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
  </svg>
);

export interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  collapsed: boolean;
  isActive: boolean;
  // Feature #1364: Pin functionality
  isPinned?: boolean;
  onTogglePin?: (path: string) => void;
  showPinIcon?: boolean;
  // Feature #134: Route prefetching
  onPrefetch?: () => void;
}

export function NavItem({ to, icon, label, collapsed, isActive, isPinned, onTogglePin, showPinIcon = true, onPrefetch }: NavItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    // Feature #134: Prefetch route data on hover
    onPrefetch?.();
  }, [onPrefetch]);

  return (
    <div
      className="relative group"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link
        to={to}
        title={collapsed ? label : undefined}
        className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        } ${collapsed ? 'justify-center' : ''}`}
      >
        {icon}
        {!collapsed && <span className="flex-1">{label}</span>}
        {/* Feature #1364: Pin indicator when pinned (always visible) */}
        {!collapsed && isPinned && !isHovered && (
          <span className="text-primary/60">
            <PinIcon filled />
          </span>
        )}
      </Link>
      {/* Feature #1364: Pin button on hover */}
      {!collapsed && showPinIcon && onTogglePin && isHovered && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onTogglePin(to);
          }}
          title={isPinned ? 'Unpin from sidebar' : 'Pin to top of sidebar'}
          aria-label={isPinned ? `Unpin ${label} from sidebar` : `Pin ${label} to top of sidebar`}
          className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted-foreground/20 transition-colors ${
            isPinned ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <PinIcon filled={isPinned} />
        </button>
      )}
    </div>
  );
}

// NavItem with badge support for counts
export interface NavItemWithBadgeProps extends NavItemProps {
  badgeCount: number;
}

export function NavItemWithBadge({ to, icon, label, collapsed, isActive, badgeCount, isPinned, onTogglePin, showPinIcon = true }: NavItemWithBadgeProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="relative group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link
        to={to}
        title={collapsed ? `${label}${badgeCount > 0 ? ` (${badgeCount} pending)` : ''}` : undefined}
        className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors relative ${
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        } ${collapsed ? 'justify-center' : ''}`}
      >
        {icon}
        {!collapsed && <span className="flex-1">{label}</span>}
        {badgeCount > 0 && (
          <span className={`flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 text-xs text-white font-bold px-1 ${
            collapsed ? 'absolute top-1 right-1' : ''
          }`}>
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}
        {/* Feature #1364: Pin indicator when pinned (always visible) */}
        {!collapsed && isPinned && !isHovered && badgeCount === 0 && (
          <span className="text-primary/60">
            <PinIcon filled />
          </span>
        )}
      </Link>
      {/* Feature #1364: Pin button on hover */}
      {!collapsed && showPinIcon && onTogglePin && isHovered && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onTogglePin(to);
          }}
          title={isPinned ? 'Unpin from sidebar' : 'Pin to top of sidebar'}
          className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted-foreground/20 transition-colors ${
            isPinned ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          } ${badgeCount > 0 ? 'right-10' : ''}`}
        >
          <PinIcon filled={isPinned} />
        </button>
      )}
    </div>
  );
}
