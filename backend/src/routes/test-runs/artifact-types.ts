/**
 * Artifact Routes - Types and Helpers Module
 *
 * Type definitions and helper functions for artifact-routes.ts
 *
 * Feature #245: Extracted to reduce file size
 *
 * @module artifact-types
 */

import { testRuns, TestRun } from './execution.js';
import { getTestRun as dbGetTestRun } from '../../services/repositories/test-runs.js';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get test run from in-memory Map first, then fall back to database
 */
export async function getTestRunWithFallback(runId: string): Promise<TestRun | undefined> {
  const fromMap = testRuns.get(runId);
  if (fromMap) return fromMap;
  return await dbGetTestRun(runId) as TestRun | undefined;
}

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Artifact information for list endpoints
 */
export interface ArtifactInfo {
  id: string;
  type: 'screenshot' | 'video' | 'trace' | 'log';
  name: string;
  test_id: string;
  test_name: string;
  url: string;
  size_bytes?: number;
  mime_type: string;
  created_at?: string;
}

/**
 * Screenshot information for MCP get_screenshots tool
 */
export interface ScreenshotInfo {
  id: string;
  test_id: string;
  test_name: string;
  screenshot_type: 'current' | 'baseline' | 'diff' | 'failure' | 'step';
  step_index?: number;
  step_action?: string;
  url: string;
  size_bytes?: number;
  viewport?: { width: number; height: number };
  is_failure_screenshot: boolean;
  // Feature #2053: Added 'warning' status for accessibility tests
  test_status: 'passed' | 'failed' | 'error' | 'skipped' | 'warning';
  created_at?: string;
}

/**
 * Artifact to delete for cleanup operations
 */
export interface ArtifactToDelete {
  name: string;
  type: 'screenshot' | 'video' | 'trace';
  path: string;
  size_bytes: number;
  test_id: string;
  test_name: string;
  created_at?: Date;
}

/**
 * Artifact for bulk download
 */
export interface DownloadArtifactInfo {
  name: string;
  type: 'trace' | 'video' | 'screenshot';
  path?: string;
  data?: string;
  size_bytes: number;
  test_id: string;
  test_name: string;
}
