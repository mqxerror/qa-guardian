/**
 * SAST Module Index
 *
 * Central export point for all SAST-related types, stores, and helpers.
 * This allows other parts of the application to import from a single location.
 *
 * Feature #1376: Split sast.ts into modules
 * Feature #1558: Added secret-patterns.ts for custom Gitleaks rules
 * Feature #1565: Added secret-verification.ts for active secret verification
 * Feature #1566: Added secret-remediation.ts for remediation guidance
 *
 * Structure:
 * - types.ts: All TypeScript interfaces and type definitions
 * - stores.ts: In-memory data stores
 * - routes.ts: Core SAST routes (config, rulesets, scan, dashboard, trends)
 * - gitleaks.ts: Gitleaks secret detection routes (Feature #779)
 * - secret-patterns.ts: Custom Gitleaks secret pattern routes (Feature #1558)
 * - secret-verification.ts: Real secret verification routes (Feature #1565)
 * - index.ts: This file - re-exports everything
 */

// Re-export all types
export * from './types';

// Re-export all stores
export * from './stores';

// Re-export route modules
export { coreRoutes } from './routes';
export { customRulesRoutes } from './custom-rules';
export { falsePositivesRoutes } from './false-positives';
export { prIntegrationRoutes } from './pr-integration';
export { gitleaksRoutes } from './gitleaks';
export { secretPatternsRoutes } from './secret-patterns';  // Feature #1558
export { secretVerificationRoutes } from './secret-verification';  // Feature #1565
export { secretRemediationRoutes } from './secret-remediation';  // Feature #1566
