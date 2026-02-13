/**
 * Quick Test Waves Module Index
 * Feature #672: Re-exports wave modules for orchestration
 *
 * Wave modules extracted from quick-test-runner.ts:
 * - health.ts: Wave 1 - DNS, HTTP, SSL checks
 * - visual.ts: Wave 2 - Screenshots, Core Web Vitals
 * - security.ts: Wave 3 - Headers, cookies, mixed content
 * - ai-analysis.ts: Wave 4 - AI-powered test suggestions (Feature #679)
 * - accessibility.ts: Wave 5 - axe-core WCAG scan (Feature #680)
 * - api-discovery.ts: Wave 6 - OpenAPI detection (Feature #681)
 * - seo.ts: Wave 7 - Meta tags, crawlability (Feature #682)
 */

// Types
export * from './types.js';

// Feature #698: Shared SSRF validation utilities
export { validateResolvedIPs, validateRedirectURL } from './ssrf-utils.js';

// Wave modules
export { runHealthCheck } from './health.js';
export { runVisualPerformance } from './visual.js';
export { runSecurityScan } from './security.js';
export { runAIAnalysis } from './ai-analysis.js';
export { runAccessibilityScan } from './accessibility.js';
export { runAPIDiscovery } from './api-discovery.js';
export { runSeoAnalysis } from './seo.js';

// All 7 waves extracted! Module split complete.
