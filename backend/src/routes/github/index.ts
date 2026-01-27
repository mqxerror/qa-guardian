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
export * from './types';

// Re-export all stores
export * from './stores';

// Re-export route modules
export { coreGithubRoutes } from './core';
export { dependencyScanningRoutes } from './dependency-scanning';
export { dependencyManagementRoutes } from './dependency-management';
export { vulnerabilityTrackingRoutes } from './vulnerability-tracking';
export { aiProviderRoutes } from './ai-providers';
export { aiTestGenerationRoutes } from './ai-test-generation';
export { naturalLanguageTestRoutes } from './natural-language-tests';
export { aiAnalysisRoutes } from './ai-analysis';
export { aiCostAnalyticsRoutes } from './ai-cost-analytics';
export { aiBestPracticesRoutes } from './ai-best-practices';
