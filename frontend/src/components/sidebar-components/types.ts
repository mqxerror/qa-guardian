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

// Feature #260: Added 'qa' role for QA team members
export type UserRole = 'owner' | 'admin' | 'developer' | 'qa' | 'viewer';
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
 *
 * Feature #260: Role-based navigation visibility
 * - Viewer: Dashboard, Projects, Testing group only (visibility='all')
 * - QA: + Security group + AI Chat (visibility='qa')
 * - Developer: + AI Insights Hub + MCP Hub + Developer Tools (visibility='developer')
 * - Admin/Owner: all items visible (visibility='admin' or 'owner')
 */
export function hasAccess(userRole: UserRole | undefined, visibility: MenuVisibility): boolean {
  if (!userRole) return false;

  // Map roles to hierarchy levels for comparison
  // Feature #260: viewer < qa < developer < admin < owner
  const roleHierarchy: Record<UserRole, number> = {
    viewer: 1,
    qa: 2,        // QA team has access to security, AI chat
    developer: 3, // Developers have access to dev tools, MCP hub
    admin: 4,
    owner: 5,
  };

  const visibilityRequirement: Record<MenuVisibility, number> = {
    all: 1,      // All authenticated users (viewer+)
    qa: 2,       // QA level - NOT viewers (viewer excluded)
    developer: 3, // Developer level
    admin: 4,    // Admin level
    owner: 5,    // Owner only
  };

  // Special case: QA visibility means NOT viewer (viewers are excluded)
  if (visibility === 'qa' && userRole === 'viewer') {
    return false;
  }

  const userLevel = roleHierarchy[userRole] || 0;
  const requiredLevel = visibilityRequirement[visibility] || 0;

  return userLevel >= requiredLevel;
}
