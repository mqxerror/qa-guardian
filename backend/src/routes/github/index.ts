/**
 * GitHub Module Index
 *
 * Central export point for all GitHub-related types, stores, and routes.
 * This allows other parts of the application to import from a single location.
 *
 * Feature #1375: Split github.ts into modules
 *
 * Structure:
 * - types.ts: All TypeScript interfaces and type definitions
 * - stores.ts: In-memory data stores and demo data
 * - core.ts: Core GitHub OAuth and repository routes
 * - dependency-scanning.ts: PR dependency scanning, alerts, policies
 * - dependency-management.ts: Allowlist/blocklist, health score, auto-PR, age tracking
 * - vulnerability-tracking.ts: Multi-language support, vulnerability history, exploitability
 * - ai-providers.ts: Kie.ai, Anthropic, AI provider router routes
 * - ai-test-generation.ts: AI test generation routes
 * - natural-language-tests.ts: Natural language test generation routes
 * - ai-analysis.ts: AI analysis, vision, and screenshot routes
 * - index.ts: This file - re-exports everything
 */

// Re-export all types
export * from './types.js';

// Re-export all stores
export * from './stores.js';

// Re-export route modules
export { coreGithubRoutes } from './core.js';
export { dependencyScanningRoutes } from './dependency-scanning.js';
export { dependencyManagementRoutes } from './dependency-management.js';
export { vulnerabilityTrackingRoutes } from './vulnerability-tracking.js';
export { aiProviderRoutes } from './ai-providers.js';
export { aiTestGenerationRoutes } from './ai-test-generation.js';
export { naturalLanguageTestRoutes } from './natural-language-tests.js';
export { aiAnalysisRoutes } from './ai-analysis.js';
export { aiCostAnalyticsRoutes } from './ai-cost-analytics.js';
export { aiBestPracticesRoutes } from './ai-best-practices.js';
