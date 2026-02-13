/**
 * Organization domain type definitions
 *
 * Types for API keys, projects, and organization settings.
 */

// ============================================================================
// API Keys
// ============================================================================

export interface ApiKey {
  id: string;
  name: string;
  key?: string;  // Only present at creation time
  key_prefix: string;
  scopes: string[];
  expires_at: string | null;
  created_at: string;
}

// ============================================================================
// Projects
// ============================================================================

export interface Project {
  id: string;
  name: string;
  description?: string;
  slug?: string;
  created_at?: string;
  archived?: boolean;
  archived_at?: string;
}

/** Minimal project option used in dropdowns and selectors */
export interface ProjectOption {
  id: string;
  name: string;
}
