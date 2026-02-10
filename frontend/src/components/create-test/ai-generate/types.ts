/**
 * Types for AI Generate sub-components
 * Feature #610: Extracted from AIGenerateStep.tsx for decomposition
 */
import type { DetectedTestType, ViewportPreset } from '../hooks';

/** AI Generation mode - text (natural language) or openapi */
export type AIGenInputMode = 'text' | 'openapi';

/** OpenAPI input method */
export type OpenAPIInputMethod = 'paste' | 'upload' | 'url';

/** Generated test from OpenAPI spec */
export interface OpenAPIGeneratedTest {
  path: string;
  method: string;
  operationId: string;
  summary: string;
  tags: string[];
  testName: string;
  testCode: string;
  selected: boolean;
}

/** OpenAPI parse result */
export interface OpenAPIParseResult {
  title: string;
  version: string;
  baseUrl: string;
  endpointCount: number;
  tags: Array<{ name: string; description?: string }>;
}

/**
 * Test type display config — Feature #614: Use semantic tokens
 */
export const TEST_TYPE_CONFIG: Record<Exclude<DetectedTestType, null>, { label: string; icon: string; iconBg: string }> = {
  e2e: { label: 'E2E Test', icon: '🔄', iconBg: 'bg-method-manual/10' },
  visual: { label: 'Visual Regression', icon: '📸', iconBg: 'bg-method-ai/10' },
  accessibility: { label: 'Accessibility', icon: '♿', iconBg: 'bg-success/10' },
  performance: { label: 'Performance', icon: '⚡', iconBg: 'bg-warning/10' },
  load: { label: 'Load Test', icon: '📊', iconBg: 'bg-destructive/10' },
};

/**
 * Viewport preset display config
 */
export const VIEWPORT_CONFIG: Record<ViewportPreset, { label: string; icon: string }> = {
  desktop: { label: 'Desktop', icon: '🖥️' },
  tablet: { label: 'Tablet', icon: '📱' },
  mobile: { label: 'Mobile', icon: '📲' },
  custom: { label: 'Custom', icon: '⚙️' },
};

/** HTTP method color mapping */
export const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-success/10 text-success',
  POST: 'bg-primary/10 text-primary',
  PUT: 'bg-warning/10 text-warning',
  PATCH: 'bg-accent/10 text-accent',
  DELETE: 'bg-destructive/10 text-destructive',
};

/**
 * Confidence level indicator
 */
export const getConfidenceLevel = (confidence: number): { label: string; color: string } => {
  if (confidence >= 0.8) return { label: 'High', color: 'green' };
  if (confidence >= 0.5) return { label: 'Medium', color: 'yellow' };
  if (confidence >= 0.3) return { label: 'Low', color: 'orange' };
  return { label: 'Very Low', color: 'red' };
};

/** Viewport preset dimensions */
export const VIEWPORT_DIMENSIONS: Record<ViewportPreset, { width: number; height: number }> = {
  desktop: { width: 1920, height: 1080 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 667 },
  custom: { width: 1280, height: 720 },
};

// Re-export types from hooks for convenience
export type { DetectedTestType, ViewportPreset };
