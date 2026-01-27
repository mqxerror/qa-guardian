// Projects Module In-memory Stores and Constants

import {
  Project,
  ProjectMember,
  EnvironmentVariable,
  ProjectVisualSettings,
  ProjectHealingSettings,
} from './types';

// In-memory stores
export const projects: Map<string, Project> = new Map();

// Project-level permissions store: Map<project_id, ProjectMember[]>
export const projectMembers: Map<string, ProjectMember[]> = new Map();

// Environment variables store: Map<project_id, EnvironmentVariable[]>
export const projectEnvVars: Map<string, EnvironmentVariable[]> = new Map();

// In-memory store for project visual settings
export const projectVisualSettings: Map<string, ProjectVisualSettings> = new Map();

// In-memory store for project healing settings
export const projectHealingSettings: Map<string, ProjectHealingSettings> = new Map();

// Default project visual settings
export const DEFAULT_PROJECT_VISUAL_SETTINGS: ProjectVisualSettings = {
  default_diff_threshold: 0, // 0% by default (pixel-perfect match)
  default_diff_threshold_mode: 'percentage',
  default_capture_mode: 'full_page',
  default_viewport_width: 1280,
  default_viewport_height: 720,
};

// Default project healing settings
export const DEFAULT_PROJECT_HEALING_SETTINGS: ProjectHealingSettings = {
  healing_enabled: true,
  healing_timeout: 30,                   // 30 seconds default
  max_healing_attempts: 3,
  healing_strategies: ['selector_fallback', 'visual_match', 'text_match', 'attribute_match'],
  notify_on_healing: false,
  auto_heal_confidence_threshold: 0.85,  // Feature #1062: 85% default threshold
};
