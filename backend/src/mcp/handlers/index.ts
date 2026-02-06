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

import { ToolHandler, HandlerContext, HandlerRegistry } from './types';
import { projectHandlers } from './projects';
import { testSuiteHandlers } from './test-suites';
import { testExecutionHandlers } from './test-execution';
import { testResultsHandlers } from './test-results';
import { artifactsHandlers } from './artifacts';
import { searchAnalysisHandlers } from './search-analysis';
import { testManagementHandlers } from './test-management';
import { securityHandlers } from './security';
import { monitoringHandlers } from './monitoring';
import { visualRegressionHandlers } from './visual-regression';
import { performanceHandlers } from './performance';
import { lighthouseHandlers } from './lighthouse';
import { accessibilityHandlers } from './accessibility';
import { loadTestingHandlers } from './load-testing';
import { k6ScriptsHandlers } from './k6-scripts';
import { aiProviderHandlers } from './ai-provider';
import { aiAnalysisHandlers } from './ai-analysis';
import { analyticsHandlers } from './analytics';
import { flakyTestsHandlers } from './flaky-tests';
import { organizationHandlers } from './organization';
import { analyticsExtendedHandlers } from './analytics-extended';
import { settingsHandlers } from './settings';
import { aiGenerationHandlers } from './ai-generation';
import { aiChatHandlers } from './ai-chat';
import { coreWebVitalsHandlers } from './core-web-vitals';
import { additionalToolsHandlers } from './additional-tools';
import { siteAnalysisHandlers } from './site-analysis';
import { reportingHandlers } from './reporting'; // Feature #1732

// Re-export types
export * from './types';

// Re-export handler modules
export { projectHandlers } from './projects';
export { testSuiteHandlers } from './test-suites';
export { testExecutionHandlers } from './test-execution';
export { testResultsHandlers } from './test-results';
export { artifactsHandlers } from './artifacts';
export { searchAnalysisHandlers } from './search-analysis';
export { testManagementHandlers } from './test-management';
export { securityHandlers } from './security';
export { monitoringHandlers } from './monitoring';
export { visualRegressionHandlers } from './visual-regression';
export { performanceHandlers } from './performance';
export { lighthouseHandlers } from './lighthouse';
export { accessibilityHandlers } from './accessibility';
export { loadTestingHandlers } from './load-testing';
export { k6ScriptsHandlers } from './k6-scripts';
export { aiProviderHandlers } from './ai-provider';
export { aiAnalysisHandlers } from './ai-analysis';
export { analyticsHandlers } from './analytics';
export { flakyTestsHandlers } from './flaky-tests';
export { organizationHandlers } from './organization';
export { analyticsExtendedHandlers } from './analytics-extended';
export { settingsHandlers } from './settings';
export { aiGenerationHandlers } from './ai-generation';
export { aiChatHandlers } from './ai-chat';
export { coreWebVitalsHandlers } from './core-web-vitals';
export { additionalToolsHandlers } from './additional-tools';
export { siteAnalysisHandlers } from './site-analysis';
export { reportingHandlers } from './reporting'; // Feature #1732

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
