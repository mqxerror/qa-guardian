/**
 * MCP Tools Index
 *
 * This file exports all tool definitions from their respective modules.
 * Tools are organized by category for maintainability.
 */

import { ToolDefinition } from '../types';
import { PROJECT_TOOLS, PROJECT_TOOL_NAMES } from './projects';
import { TEST_SUITE_TOOLS, TEST_SUITE_TOOL_NAMES } from './test-suites';
import { TEST_EXECUTION_TOOLS, TEST_EXECUTION_TOOL_NAMES } from './test-execution';
import { TEST_RESULTS_TOOLS, TEST_RESULTS_TOOL_NAMES } from './test-results';
import { ARTIFACT_TOOLS, ARTIFACT_TOOL_NAMES } from './artifacts';
import { SECURITY_TOOLS, SECURITY_TOOL_NAMES } from './security';
import { MONITORING_TOOLS, MONITORING_TOOL_NAMES } from './monitoring';
import { VISUAL_REGRESSION_TOOLS, VISUAL_REGRESSION_TOOL_NAMES } from './visual-regression';
import { PERFORMANCE_TOOLS, PERFORMANCE_TOOL_NAMES } from './performance';
import { TEST_AUTHORING_TOOLS, TEST_AUTHORING_TOOL_NAMES } from './test-authoring';
import { FLAKY_TESTS_TOOLS, FLAKY_TESTS_TOOL_NAMES } from './flaky-tests';
import { ANALYTICS_TOOLS, ANALYTICS_TOOL_NAMES } from './analytics';
import { ORGANIZATION_TOOLS, ORGANIZATION_TOOL_NAMES } from './organization';
import { INCIDENTS_TOOLS, INCIDENTS_TOOL_NAMES } from './incidents';
import { HEALING_TOOLS, HEALING_TOOL_NAMES } from './healing';
import { REPORTING_TOOLS, REPORTING_TOOL_NAMES } from './reporting';
import { WORKFLOW_TOOLS, WORKFLOW_TOOL_NAMES } from './workflow';
import { STREAMING_TOOLS, STREAMING_TOOL_NAMES } from './streaming';
import { INTEGRATIONS_TOOLS, INTEGRATIONS_TOOL_NAMES } from './integrations';
import { UTILITY_TOOLS, UTILITY_TOOL_NAMES } from './utility';
import { ACCESSIBILITY_TOOLS, ACCESSIBILITY_TOOL_NAMES } from './accessibility';
import { ALERTING_TOOLS, ALERTING_TOOL_NAMES } from './alerting';
import { LOAD_TESTING_TOOLS, LOAD_TESTING_TOOL_NAMES } from './load-testing';
import { ADDITIONAL_TOOLS, ADDITIONAL_TOOL_NAMES } from './additional-tools';

// Re-export individual tool modules
export { PROJECT_TOOLS, PROJECT_TOOL_NAMES } from './projects';
export { TEST_SUITE_TOOLS, TEST_SUITE_TOOL_NAMES } from './test-suites';
export { TEST_EXECUTION_TOOLS, TEST_EXECUTION_TOOL_NAMES } from './test-execution';
export { TEST_RESULTS_TOOLS, TEST_RESULTS_TOOL_NAMES } from './test-results';
export { ARTIFACT_TOOLS, ARTIFACT_TOOL_NAMES } from './artifacts';
export { SECURITY_TOOLS, SECURITY_TOOL_NAMES } from './security';
export { MONITORING_TOOLS, MONITORING_TOOL_NAMES } from './monitoring';
export { VISUAL_REGRESSION_TOOLS, VISUAL_REGRESSION_TOOL_NAMES } from './visual-regression';
export { PERFORMANCE_TOOLS, PERFORMANCE_TOOL_NAMES } from './performance';
export { TEST_AUTHORING_TOOLS, TEST_AUTHORING_TOOL_NAMES } from './test-authoring';
export { FLAKY_TESTS_TOOLS, FLAKY_TESTS_TOOL_NAMES } from './flaky-tests';
export { ANALYTICS_TOOLS, ANALYTICS_TOOL_NAMES } from './analytics';
export { ORGANIZATION_TOOLS, ORGANIZATION_TOOL_NAMES } from './organization';
export { INCIDENTS_TOOLS, INCIDENTS_TOOL_NAMES } from './incidents';
export { HEALING_TOOLS, HEALING_TOOL_NAMES } from './healing';
export { REPORTING_TOOLS, REPORTING_TOOL_NAMES } from './reporting';
export { WORKFLOW_TOOLS, WORKFLOW_TOOL_NAMES } from './workflow';
export { STREAMING_TOOLS, STREAMING_TOOL_NAMES } from './streaming';
export { INTEGRATIONS_TOOLS, INTEGRATIONS_TOOL_NAMES } from './integrations';
export { UTILITY_TOOLS, UTILITY_TOOL_NAMES } from './utility';
export { ACCESSIBILITY_TOOLS, ACCESSIBILITY_TOOL_NAMES } from './accessibility';
export { ALERTING_TOOLS, ALERTING_TOOL_NAMES } from './alerting';
export { LOAD_TESTING_TOOLS, LOAD_TESTING_TOOL_NAMES } from './load-testing';
export { ADDITIONAL_TOOLS, ADDITIONAL_TOOL_NAMES } from './additional-tools';

// Combined list of all tools
export const ALL_TOOLS: ToolDefinition[] = [
  ...PROJECT_TOOLS,
  ...TEST_SUITE_TOOLS,
  ...TEST_EXECUTION_TOOLS,
  ...TEST_RESULTS_TOOLS,
  ...ARTIFACT_TOOLS,
  ...SECURITY_TOOLS,
  ...MONITORING_TOOLS,
  ...VISUAL_REGRESSION_TOOLS,
  ...PERFORMANCE_TOOLS,
  ...TEST_AUTHORING_TOOLS,
  ...FLAKY_TESTS_TOOLS,
  ...ANALYTICS_TOOLS,
  ...ORGANIZATION_TOOLS,
  ...INCIDENTS_TOOLS,
  ...HEALING_TOOLS,
  ...REPORTING_TOOLS,
  ...WORKFLOW_TOOLS,
  ...STREAMING_TOOLS,
  ...INTEGRATIONS_TOOLS,
  ...UTILITY_TOOLS,
  ...ACCESSIBILITY_TOOLS,
  ...ALERTING_TOOLS,
  ...LOAD_TESTING_TOOLS,
  ...ADDITIONAL_TOOLS,
];

// Combined list of all tool names
export const ALL_TOOL_NAMES: string[] = [
  ...PROJECT_TOOL_NAMES,
  ...TEST_SUITE_TOOL_NAMES,
  ...TEST_EXECUTION_TOOL_NAMES,
  ...TEST_RESULTS_TOOL_NAMES,
  ...ARTIFACT_TOOL_NAMES,
  ...SECURITY_TOOL_NAMES,
  ...MONITORING_TOOL_NAMES,
  ...VISUAL_REGRESSION_TOOL_NAMES,
  ...PERFORMANCE_TOOL_NAMES,
  ...TEST_AUTHORING_TOOL_NAMES,
  ...FLAKY_TESTS_TOOL_NAMES,
  ...ANALYTICS_TOOL_NAMES,
  ...ORGANIZATION_TOOL_NAMES,
  ...INCIDENTS_TOOL_NAMES,
  ...HEALING_TOOL_NAMES,
  ...REPORTING_TOOL_NAMES,
  ...WORKFLOW_TOOL_NAMES,
  ...STREAMING_TOOL_NAMES,
  ...INTEGRATIONS_TOOL_NAMES,
  ...UTILITY_TOOL_NAMES,
  ...ACCESSIBILITY_TOOL_NAMES,
  ...ALERTING_TOOL_NAMES,
  ...LOAD_TESTING_TOOL_NAMES,
  ...ADDITIONAL_TOOL_NAMES,
];

// Helper to check if a tool name exists
export function isValidTool(name: string): boolean {
  return ALL_TOOL_NAMES.includes(name);
}

// Helper to get tool definition by name
export function getToolByName(name: string): ToolDefinition | undefined {
  return ALL_TOOLS.find(t => t.name === name);
}

// Tool category mapping for organization
export const TOOL_CATEGORIES: Record<string, string[]> = {
  projects: PROJECT_TOOL_NAMES,
  testSuites: TEST_SUITE_TOOL_NAMES,
  testExecution: TEST_EXECUTION_TOOL_NAMES,
  testResults: TEST_RESULTS_TOOL_NAMES,
  artifacts: ARTIFACT_TOOL_NAMES,
  security: SECURITY_TOOL_NAMES,
  monitoring: MONITORING_TOOL_NAMES,
  visualRegression: VISUAL_REGRESSION_TOOL_NAMES,
  performance: PERFORMANCE_TOOL_NAMES,
  testAuthoring: TEST_AUTHORING_TOOL_NAMES,
  flakyTests: FLAKY_TESTS_TOOL_NAMES,
  analytics: ANALYTICS_TOOL_NAMES,
  organization: ORGANIZATION_TOOL_NAMES,
  incidents: INCIDENTS_TOOL_NAMES,
  healing: HEALING_TOOL_NAMES,
  reporting: REPORTING_TOOL_NAMES,
  workflow: WORKFLOW_TOOL_NAMES,
  streaming: STREAMING_TOOL_NAMES,
  integrations: INTEGRATIONS_TOOL_NAMES,
  utility: UTILITY_TOOL_NAMES,
  accessibility: ACCESSIBILITY_TOOL_NAMES,
  alerting: ALERTING_TOOL_NAMES,
  loadTesting: LOAD_TESTING_TOOL_NAMES,
  additional: ADDITIONAL_TOOL_NAMES,
};

// Get the category for a tool
export function getToolCategory(name: string): string | undefined {
  for (const [category, tools] of Object.entries(TOOL_CATEGORIES)) {
    if (tools.includes(name)) {
      return category;
    }
  }
  return undefined;
}

// Summary of tool counts per module
export const TOOL_COUNTS: Record<string, number> = {
  projects: PROJECT_TOOLS.length,
  testSuites: TEST_SUITE_TOOLS.length,
  testExecution: TEST_EXECUTION_TOOLS.length,
  testResults: TEST_RESULTS_TOOLS.length,
  artifacts: ARTIFACT_TOOLS.length,
  security: SECURITY_TOOLS.length,
  monitoring: MONITORING_TOOLS.length,
  visualRegression: VISUAL_REGRESSION_TOOLS.length,
  performance: PERFORMANCE_TOOLS.length,
  testAuthoring: TEST_AUTHORING_TOOLS.length,
  flakyTests: FLAKY_TESTS_TOOLS.length,
  analytics: ANALYTICS_TOOLS.length,
  organization: ORGANIZATION_TOOLS.length,
  incidents: INCIDENTS_TOOLS.length,
  healing: HEALING_TOOLS.length,
  reporting: REPORTING_TOOLS.length,
  workflow: WORKFLOW_TOOLS.length,
  streaming: STREAMING_TOOLS.length,
  integrations: INTEGRATIONS_TOOLS.length,
  utility: UTILITY_TOOLS.length,
  accessibility: ACCESSIBILITY_TOOLS.length,
  alerting: ALERTING_TOOLS.length,
  loadTesting: LOAD_TESTING_TOOLS.length,
  additional: ADDITIONAL_TOOLS.length,
};

// Total tools extracted
export const TOTAL_EXTRACTED_TOOLS = ALL_TOOLS.length;
