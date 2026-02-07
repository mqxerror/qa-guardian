/**
 * AI Generation Handlers - Registry Module
 *
 * This module serves as the central registry for all AI generation handlers,
 * combining handlers from the split modules into a unified interface.
 *
 * Split modules:
 * - ai-gen-test-creation.ts: Test generation handlers (generateTestFromDescription, generateTest, generateTestSuite)
 * - ai-gen-analysis.ts: Analysis handlers (getCoverageGaps, generateSelectors, assessTestConfidence)
 * - ai-gen-conversion.ts: Conversion handlers (convertGherkin, parseTestDescription, generateAssertions, generateUserFlow)
 * - ai-gen-vision.ts: Vision handlers (analyzeScreenshot, generateTestFromAnnotatedScreenshot)
 *
 * @module ai-gen-registry
 */

import type { ToolHandler, HandlerModule } from './types.js';

// Import from split modules
import { testCreationHandlers, testCreationToolNames } from './ai-gen-test-creation.js';
import { analysisHandlers, analysisToolNames } from './ai-gen-analysis.js';
import { conversionHandlers, conversionToolNames } from './ai-gen-conversion.js';
import { visionHandlers, visionToolNames } from './ai-gen-vision.js';

// ============================================================================
// Combined Handler Registry
// ============================================================================

/**
 * Combined handlers from all AI generation modules
 *
 * Handler mapping:
 * - generate_test_from_description -> testCreationHandlers
 * - generate_test -> testCreationHandlers
 * - generate_test_suite -> testCreationHandlers
 * - get_coverage_gaps -> analysisHandlers
 * - generate_selectors -> analysisHandlers
 * - assess_test_confidence -> analysisHandlers
 * - convert_gherkin -> conversionHandlers
 * - parse_test_description -> conversionHandlers
 * - generate_assertions -> conversionHandlers
 * - generate_user_flow -> conversionHandlers
 * - analyze_screenshot -> visionHandlers
 * - generate_test_from_annotated_screenshot -> visionHandlers
 */
export const handlers: Record<string, ToolHandler> = {
  // Test creation handlers
  ...testCreationHandlers,
  // Analysis handlers
  ...analysisHandlers,
  // Conversion handlers
  ...conversionHandlers,
  // Vision handlers
  ...visionHandlers,
};

/**
 * Combined list of all tool names from all modules
 */
export const toolNames: string[] = [
  ...testCreationToolNames,
  ...analysisToolNames,
  ...conversionToolNames,
  ...visionToolNames,
];

/**
 * Combined handler module for registration with the MCP server
 */
export const aiGenerationHandlers: HandlerModule = {
  handlers,
  toolNames,
};

// ============================================================================
// Re-exports for backward compatibility and direct imports
// ============================================================================

// Re-export individual module handlers for granular imports
export {
  testCreationHandlers,
  testCreationToolNames,
} from './ai-gen-test-creation.js';

export {
  analysisHandlers,
  analysisToolNames,
} from './ai-gen-analysis.js';

export {
  conversionHandlers,
  conversionToolNames,
} from './ai-gen-conversion.js';

export {
  visionHandlers,
  visionToolNames,
} from './ai-gen-vision.js';

// ============================================================================
// Module Statistics (for documentation)
// ============================================================================

/**
 * Module statistics for the AI generation handlers
 * This is useful for documentation and debugging
 */
export const moduleStats = {
  totalHandlers: toolNames.length,
  modules: {
    testCreation: {
      handlerCount: testCreationToolNames.length,
      handlers: testCreationToolNames,
    },
    analysis: {
      handlerCount: analysisToolNames.length,
      handlers: analysisToolNames,
    },
    conversion: {
      handlerCount: conversionToolNames.length,
      handlers: conversionToolNames,
    },
    vision: {
      handlerCount: visionToolNames.length,
      handlers: visionToolNames,
    },
  },
};

// Default export for compatibility with existing imports
export default aiGenerationHandlers;
