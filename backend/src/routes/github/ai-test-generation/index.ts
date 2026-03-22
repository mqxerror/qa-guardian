/**
 * AI Test Generation Routes - Index
 *
 * Thin orchestrator that registers all AI test generation sub-route modules.
 * Split from monolithic ai-test-generation.ts for maintainability.
 *
 * Sub-modules:
 * - generation.ts: Generate tests from NL, user stories, Gherkin, validation
 * - screenshot-analysis.ts: Generate tests from screenshots (plain & annotated)
 * - explanation.ts: Explain test code, anomalies
 * - healing.ts: Vision-based selector healing
 * - improvement.ts: Release notes, test improvement analysis
 *
 * Feature #1375: Extracted from github.ts for modularity
 * Feature #1500: Updated to use REAL AI via MCP handlers
 */

import { FastifyInstance } from 'fastify';
import { generationRoutes } from './generation.js';
import { screenshotAnalysisRoutes } from './screenshot-analysis.js';
import { explanationRoutes } from './explanation.js';
import { healingRoutes } from './healing.js';
import { improvementRoutes } from './improvement.js';

export async function aiTestGenerationRoutes(app: FastifyInstance): Promise<void> {
  await generationRoutes(app);
  await screenshotAnalysisRoutes(app);
  await explanationRoutes(app);
  await healingRoutes(app);
  await improvementRoutes(app);
}
