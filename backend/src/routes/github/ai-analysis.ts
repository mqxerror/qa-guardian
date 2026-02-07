/**
 * AI Analysis Routes Module
 *
 * This file has been split into:
 * - ai-analysis-core.ts: Types, test improvements, anomaly detection, release notes
 * - ai-analysis-helpers.ts: Vision analysis, healing suggestions, test explanation
 *
 * This module re-exports everything for backwards compatibility.
 *
 * Feature #248: Split ai-analysis.ts for maintainability
 */

import { FastifyInstance } from 'fastify';

// Re-export all types from core
export * from './ai-analysis-core.js';

// Re-export all helper functions
export * from './ai-analysis-helpers.js';

// Import functions for route registration
import {
  analyzeTestForImprovements,
  explainAnomaly,
  getDetectedAnomalies,
  generateReleaseNotes,
} from './ai-analysis-core.js';

import {
  analyzeElementWithVision,
  getHealingSuggestions,
  explainPlaywrightTest,
  generateTestFromAnnotations,
  analyzeScreenshotForTest,
} from './ai-analysis-helpers.js';

// ============================================================================
// Route Registration
// ============================================================================

export async function aiAnalysisRoutes(app: FastifyInstance): Promise<void> {
  // Export the helper functions for use by other modules
  (app as any).aiAnalysis = {
    analyzeTestForImprovements,
    explainAnomaly,
    getDetectedAnomalies,
    generateReleaseNotes,
    analyzeElementWithVision,
    getHealingSuggestions,
    explainPlaywrightTest,
    generateTestFromAnnotations,
    analyzeScreenshotForTest,
  };
}
