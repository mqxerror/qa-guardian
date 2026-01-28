// Projects Module - Map Declarations
// Feature #2100: Extracted Map instances to separate file to break circular dependencies.
// index.ts → route files → index.ts circular import is broken by having Maps here.
//
// DEPRECATED: These Maps are empty stubs for backward compatibility.
// All data access should use async DB functions from ./stores instead.

import {
  Project,
  ProjectMember,
  EnvironmentVariable,
  ProjectVisualSettings,
  ProjectHealingSettings,
} from './types';

// DEPRECATED: Empty Map exports for backward compatibility until route migration (#2116)
// These return empty Maps - consumers must migrate to async DB functions
export const projects = new Map<string, Project>();
export const projectMembers = new Map<string, ProjectMember[]>();
export const projectEnvVars = new Map<string, EnvironmentVariable[]>();
export const projectVisualSettings = new Map<string, ProjectVisualSettings>();
export const projectHealingSettings = new Map<string, ProjectHealingSettings>();
