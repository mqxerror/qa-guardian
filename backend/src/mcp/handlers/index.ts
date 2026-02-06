/**
 * MCP Tool Handlers Registry
 *
 * Central registry of all tool handlers, organized by category.
 * This replaces the massive switch statement in server.ts (Feature #1356).
 *
 * Each handler module exports:
 * - handlers: Record<string, ToolHandler> - map of tool names to handler functions
 * - toolNames: string[] - list of tool names the module handles
 */

import { ToolHandler, HandlerContext, HandlerRegistry } from './types.js';
import { projectHandlers } from './projects.js';
import { testSuiteHandlers } from './test-suites.js';
import { testExecutionHandlers } from './test-execution.js';
import { testResultsHandlers } from './test-results.js';
import { artifactsHandlers } from './artifacts.js';
import { searchAnalysisHandlers } from './search-analysis.js';
import { testManagementHandlers } from './test-management.js';
import { securityHandlers } from './security.js';
import { monitoringHandlers } from './monitoring.js';
import { visualRegressionHandlers } from './visual-regression.js';
import { performanceHandlers } from './performance.js';
import { lighthouseHandlers } from './lighthouse.js';
import { accessibilityHandlers } from './accessibility.js';
import { loadTestingHandlers } from './load-testing.js';
import { k6ScriptsHandlers } from './k6-scripts.js';
import { aiProviderHandlers } from './ai-provider.js';
import { aiAnalysisHandlers } from './ai-analysis.js';
import { analyticsHandlers } from './analytics.js';
import { flakyTestsHandlers } from './flaky-tests.js';
import { organizationHandlers } from './organization.js';
import { analyticsExtendedHandlers } from './analytics-extended.js';
import { settingsHandlers } from './settings.js';
import { aiGenerationHandlers } from './ai-generation.js';
import { aiChatHandlers } from './ai-chat.js';
import { coreWebVitalsHandlers } from './core-web-vitals.js';
import { additionalToolsHandlers } from './additional-tools.js';
import { siteAnalysisHandlers } from './site-analysis.js';
import { reportingHandlers } from './reporting.js'; // Feature #1732

// Re-export types
export * from './types.js';

// Re-export handler modules
export { projectHandlers } from './projects.js';
export { testSuiteHandlers } from './test-suites.js';
export { testExecutionHandlers } from './test-execution.js';
export { testResultsHandlers } from './test-results.js';
export { artifactsHandlers } from './artifacts.js';
export { searchAnalysisHandlers } from './search-analysis.js';
export { testManagementHandlers } from './test-management.js';
export { securityHandlers } from './security.js';
export { monitoringHandlers } from './monitoring.js';
export { visualRegressionHandlers } from './visual-regression.js';
export { performanceHandlers } from './performance.js';
export { lighthouseHandlers } from './lighthouse.js';
export { accessibilityHandlers } from './accessibility.js';
export { loadTestingHandlers } from './load-testing.js';
export { k6ScriptsHandlers } from './k6-scripts.js';
export { aiProviderHandlers } from './ai-provider.js';
export { aiAnalysisHandlers } from './ai-analysis.js';
export { analyticsHandlers } from './analytics.js';
export { flakyTestsHandlers } from './flaky-tests.js';
export { organizationHandlers } from './organization.js';
export { analyticsExtendedHandlers } from './analytics-extended.js';
export { settingsHandlers } from './settings.js';
export { aiGenerationHandlers } from './ai-generation.js';
export { aiChatHandlers } from './ai-chat.js';
export { coreWebVitalsHandlers } from './core-web-vitals.js';
export { additionalToolsHandlers } from './additional-tools.js';
export { siteAnalysisHandlers } from './site-analysis.js';
export { reportingHandlers } from './reporting.js'; // Feature #1732

/**
 * Build the complete handler registry from all handler modules
 */
function buildHandlerRegistry(): HandlerRegistry {
  const registry = new Map<string, ToolHandler>();

  // Add all handler modules here
  const modules = [
    projectHandlers,
    testSuiteHandlers,
    testExecutionHandlers,
    testResultsHandlers,
    artifactsHandlers,
    searchAnalysisHandlers,
    testManagementHandlers,
    securityHandlers,
    monitoringHandlers,
    visualRegressionHandlers,
    performanceHandlers,
    lighthouseHandlers,
    accessibilityHandlers,
    loadTestingHandlers,
    k6ScriptsHandlers,
    aiProviderHandlers,
    aiAnalysisHandlers,
    analyticsHandlers,
    flakyTestsHandlers,
    organizationHandlers,
    analyticsExtendedHandlers,
    settingsHandlers,
    aiGenerationHandlers,
    aiChatHandlers,
    coreWebVitalsHandlers,
    additionalToolsHandlers,
    siteAnalysisHandlers,
    reportingHandlers, // Feature #1732
  ];

  for (const module of modules) {
    for (const [name, handler] of Object.entries(module.handlers)) {
      if (registry.has(name)) {
        console.warn(`[Handlers] Duplicate handler for tool '${name}', overwriting`);
      }
      registry.set(name, handler);
    }
  }

  return registry;
}

// Build the registry once at module load
export const HANDLER_REGISTRY: HandlerRegistry = buildHandlerRegistry();

/**
 * Get handler for a specific tool
 */
export function getHandler(toolName: string): ToolHandler | undefined {
  return HANDLER_REGISTRY.get(toolName);
}

/**
 * Check if a handler exists for a tool
 */
export function hasHandler(toolName: string): boolean {
  return HANDLER_REGISTRY.has(toolName);
}

/**
 * Get all registered tool names
 */
export function getRegisteredToolNames(): string[] {
  return Array.from(HANDLER_REGISTRY.keys());
}

/**
 * Execute a tool handler with the given context
 */
export async function executeHandler(
  toolName: string,
  args: Record<string, unknown>,
  context: HandlerContext
): Promise<unknown> {
  const handler = getHandler(toolName);
  if (!handler) {
    throw new Error(`No handler registered for tool: ${toolName}`);
  }
  return await handler(args, context);
}

// Summary statistics
export const HANDLER_STATS = {
  get totalHandlers() {
    return HANDLER_REGISTRY.size;
  },
  get handlersByModule() {
    return {
      projects: projectHandlers.toolNames.length,
      testSuites: testSuiteHandlers.toolNames.length,
      testExecution: testExecutionHandlers.toolNames.length,
      testResults: testResultsHandlers.toolNames.length,
      artifacts: artifactsHandlers.toolNames.length,
      searchAnalysis: searchAnalysisHandlers.toolNames.length,
      testManagement: testManagementHandlers.toolNames.length,
      security: securityHandlers.toolNames.length,
      monitoring: monitoringHandlers.toolNames.length,
      visualRegression: visualRegressionHandlers.toolNames.length,
      performance: performanceHandlers.toolNames.length,
      lighthouse: lighthouseHandlers.toolNames.length,
      accessibility: accessibilityHandlers.toolNames.length,
      loadTesting: loadTestingHandlers.toolNames.length,
      k6Scripts: k6ScriptsHandlers.toolNames.length,
      aiProvider: aiProviderHandlers.toolNames.length,
      aiAnalysis: aiAnalysisHandlers.toolNames.length,
      analytics: analyticsHandlers.toolNames.length,
      flakyTests: flakyTestsHandlers.toolNames.length,
      organization: organizationHandlers.toolNames.length,
      analyticsExtended: analyticsExtendedHandlers.toolNames.length,
      settings: settingsHandlers.toolNames.length,
      aiGeneration: aiGenerationHandlers.toolNames.length,
      aiChat: aiChatHandlers.toolNames.length,
      coreWebVitals: coreWebVitalsHandlers.toolNames.length,
      additionalTools: additionalToolsHandlers.toolNames.length,
      siteAnalysis: siteAnalysisHandlers.toolNames.length,
    };
  },
};

console.log(`[Handlers] Loaded ${HANDLER_REGISTRY.size} tool handlers`);
