// Projects Module Types and Interfaces

// In-memory project store for development
export interface Project {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  description?: string;
  base_url?: string;
  archived: boolean;
  archived_at?: Date;
  created_at: Date;
  updated_at: Date;
}

// Project member for project-level permissions
export interface ProjectMember {
  project_id: string;
  user_id: string;
  role: 'admin' | 'developer' | 'viewer';
  added_at: Date;
  added_by: string;
}

// Environment variable for project
export interface EnvironmentVariable {
  id: string;
  project_id: string;
  key: string;
  value: string;  // Stored encrypted in production
  is_secret: boolean;  // If true, value is masked in responses
  created_at: Date;
  updated_at: Date;
}

// Feature #454: Project-level visual test settings
export interface ProjectVisualSettings {
  default_diff_threshold: number; // Default diff threshold (0-100%) for new visual tests
  default_diff_threshold_mode: 'percentage' | 'pixel_count';
  default_diff_pixel_threshold?: number; // Max pixels when using pixel_count mode
  default_capture_mode: 'full_page' | 'viewport' | 'element';
  default_viewport_width: number;
  default_viewport_height: number;
}

// Feature #1064: Project-level AI healing settings
// Feature #1062: Added auto_heal_confidence_threshold
export interface ProjectHealingSettings {
  healing_enabled: boolean;              // Whether AI healing is enabled for this project
  healing_timeout: number;               // Max seconds for healing attempts (5-120)
  max_healing_attempts: number;          // Max healing attempts per test (1-10)
  healing_strategies: string[];          // Enabled healing strategies
  notify_on_healing: boolean;            // Send notification when healing is applied
  auto_heal_confidence_threshold: number; // Feature #1062: Min confidence for auto-healing (0.5-1.0)
}

// Request body types
export interface CreateProjectBody {
  name: string;
  description?: string;
  base_url?: string;
}

export interface ProjectParams {
  id: string;
}
