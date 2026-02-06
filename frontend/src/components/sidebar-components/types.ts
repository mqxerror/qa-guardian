/**
 * Sidebar Types and Utility Functions
 *
 * Feature #1363: Role-based menu visibility configuration
 *
 * Menu items are organized by role:
 * - 'all': Visible to all authenticated users
 * - 'qa': QA-focused features (testing, visual review, analytics)
 * - 'developer': Developer tools (MCP, API keys)
 * - 'admin': Administrative features (team, settings, billing)
 * - 'owner': Owner-only features (billing)
 *
 * Extracted from Sidebar.tsx for Feature #104.
 */
import React from 'react';

export type UserRole = 'owner' | 'admin' | 'developer' | 'viewer';
export type MenuVisibility = 'all' | 'qa' | 'developer' | 'admin' | 'owner';

export interface MenuItemConfig {
  path: string;
  icon: React.ReactNode;
  label: string;
  visibility: MenuVisibility;
  // Some items should be shown if user has advanced features enabled
  advancedOnly?: boolean;
}

/**
 * Check if user role has access to menu visibility level
 */
export function hasAccess(userRole: UserRole | undefined, visibility: MenuVisibility): boolean {
  if (!userRole) return false;

  switch (visibility) {
    case 'all':
      return true;
    case 'qa':
      // QA features available to all roles
      return true;
    case 'developer':
      // Developer features for developers, admins, and owners
      return userRole === 'developer' || userRole === 'admin' || userRole === 'owner';
    case 'admin':
      // Admin features for admins and owners
      return userRole === 'admin' || userRole === 'owner';
    case 'owner':
      // Owner-only features
      return userRole === 'owner';
    default:
      return false;
  }
}
