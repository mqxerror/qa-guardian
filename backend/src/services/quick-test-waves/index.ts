/**
 * Quick Test Waves Module Index
 * Feature #672: Re-exports wave modules for orchestration
 *
 * Wave modules extracted from quick-test-runner.ts:
 * - health.ts: Wave 1 - DNS, HTTP, SSL checks
 * - visual.ts: Wave 2 - Screenshots, Core Web Vitals
 * - security.ts: Wave 3 - Headers, cookies, mixed content
 * - ai-analysis.ts: Wave 4 - AI-powered test suggestions (Feature #679)
 * - accessibility.ts: Wave 5 - axe-core WCAG scan (TODO)
 * - api-discovery.ts: Wave 6 - OpenAPI detection (TODO)
 * - seo.ts: Wave 7 - Meta tags, crawlability (TODO)
 */

// Types
export * from './types.js';

// Wave modules
export { runHealthCheck } from './health.js';
export { runVisualPerformance } from './visual.js';
export { runSecurityScan } from './security.js';
export { runAIAnalysis } from './ai-analysis.js';

// TODO: Export remaining waves after extraction
// export { runAccessibilityCheck } from './accessibility.js';
// export { runAPIDiscovery } from './api-discovery.js';
// export { runSeoAnalysis } from './seo.js';
