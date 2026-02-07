/**
 * AI Test Generation Handler Module - Re-export Facade
 *
 * REFACTORED: This file is now a thin re-export facade.
 * The actual handlers have been split into focused modules:
 *
 * - ai-gen-test-creation.ts: Test generation (generateTestFromDescription, generateTest, generateTestSuite)
 * - ai-gen-analysis.ts: Analysis (getCoverageGaps, generateSelectors, assessTestConfidence)
 * - ai-gen-conversion.ts: Conversion (convertGherkin, parseTestDescription, generateAssertions, generateUserFlow)
 * - ai-gen-vision.ts: Vision (analyzeScreenshot, generateTestFromAnnotatedScreenshot)
 * - ai-gen-registry.ts: Combined registry with all handlers
 *
 * This file exists for backward compatibility with existing imports.
 * New code should import directly from:
 * - './ai-gen-registry.js' for combined handlers
 * - Individual modules for specific functionality
 *
 * Feature #1356: Backend file size limit enforcement (split into modules under 1500 lines)
 * Feature #1487: Integrate Claude Vision for screenshot analysis
 * Feature #1497: Test regeneration with feedback
 *
 * Handles AI-powered test generation tools:
 * - generate_test_from_description: Generate Playwright test from natural language
 * - generate_test: Simplified test generation from description
 * - get_coverage_gaps: Analyze test coverage gaps
 * - generate_test_suite: Generate test suite from user story
 * - convert_gherkin: Convert Gherkin to Playwright
 * - parse_test_description: Parse test descriptions
 * - generate_selectors: Generate stable Playwright selectors
 * - generate_assertions: Generate test assertions
 * - generate_user_flow: Generate user flow test code
 * - assess_test_confidence: Assess test reliability
 * - analyze_screenshot: Use Claude Vision to analyze screenshots and identify UI elements
 * - generate_test_from_annotated_screenshot: Generate tests from annotated screenshots
 *
 * @module ai-generation
 */

// Re-export everything from the registry
export {
  handlers,
  toolNames,
  aiGenerationHandlers,
  // Individual module exports for granular imports
  testCreationHandlers,
  testCreationToolNames,
  analysisHandlers,
  analysisToolNames,
  conversionHandlers,
  conversionToolNames,
  visionHandlers,
  visionToolNames,
  moduleStats,
} from './ai-gen-registry.js';

// Default export for compatibility
export { default } from './ai-gen-registry.js';
