/**
 * Search and Analysis Tool Handlers
 *
 * Handlers for search, analysis, and export MCP tools.
 * Extracted from server.ts to reduce file size (Feature #1356).
 */

import { ToolHandler, HandlerModule } from './types';

/**
 * Helper to parse result_id into run_id and test_id
 */
function parseResultId(args: Record<string, unknown>): { runId: string; testId: string } | { error: string } {
  const resultId = args.result_id as string | undefined;

  if (resultId) {
    const parts = resultId.split('-');
    if (parts.length < 2 || !parts[0]) {
      return { error: 'Invalid result_id format. Expected: runId-testId' };
    }
    return {
      runId: parts[0],
      testId: parts.slice(1).join('-'),
    };
  }

  const runId = args.run_id as string | undefined;
  const testId = args.test_id as string | undefined;
  if (!runId || !testId) {
    return { error: 'Either result_id or both run_id and test_id are required' };
  }

  return { runId, testId };
}

/**
 * Search across all test results (Feature #910)
 */
export const searchResults: ToolHandler = async (args, context) => {
  const params = new URLSearchParams();
  if (args.query) {
    params.append('query', args.query as string);
  }
  if (args.status) {
    params.append('status', args.status as string);
  }
  if (args.project_id) {
    params.append('project_id', args.project_id as string);
  }
  if (args.suite_id) {
    params.append('suite_id', args.suite_id as string);
  }
  if (args.from_date) {
    params.append('from_date', args.from_date as string);
  }
  if (args.to_date) {
    params.append('to_date', args.to_date as string);
  }
  if (args.limit !== undefined) {
    params.append('limit', String(args.limit));
  }
  const queryString = params.toString();
  return await context.callApi(`/api/v1/results/search${queryString ? `?${queryString}` : ''}`);
};

/**
 * Get common failure patterns (Feature #911)
 */
export const getFailurePatterns: ToolHandler = async (args, context) => {
  const params = new URLSearchParams();
  if (args.project_id) {
    params.append('project_id', args.project_id as string);
  }
  if (args.suite_id) {
    params.append('suite_id', args.suite_id as string);
  }
  if (args.days !== undefined) {
    params.append('days', String(args.days));
  }
  if (args.limit !== undefined) {
    params.append('limit', String(args.limit));
  }
  if (args.min_frequency !== undefined) {
    params.append('min_frequency', String(args.min_frequency));
  }
  const patternsQueryString = params.toString();
  return await context.callApi(`/api/v1/failure-patterns${patternsQueryString ? `?${patternsQueryString}` : ''}`);
};

/**
 * Get review status (Feature #912)
 */
export const getReviewStatus: ToolHandler = async (args, context) => {
  const parsed = parseResultId(args);
  if ('error' in parsed) {
    return parsed;
  }
  const { runId, testId } = parsed;

  return await context.callApi(`/api/v1/runs/${runId}/results/${testId}/review`);
};

/**
 * Create bug report from test failure (Feature #913)
 */
export const createBugReport: ToolHandler = async (args, context) => {
  const parsed = parseResultId(args);
  if ('error' in parsed) {
    return parsed;
  }
  const { runId, testId } = parsed;

  const params = new URLSearchParams();
  if (args.format) params.set('format', args.format as string);
  if (args.include_screenshots !== undefined) params.set('include_screenshots', String(args.include_screenshots));
  if (args.include_trace !== undefined) params.set('include_trace', String(args.include_trace));
  const queryString = params.toString() ? `?${params.toString()}` : '';

  return await context.callApi(`/api/v1/runs/${runId}/results/${testId}/bug-report${queryString}`, {
    method: 'POST',
    body: {
      additional_context: args.additional_context,
    },
  });
};

/**
 * Unified export_data handler (Feature #1435)
 * Replaces export_results, export_analytics_csv, export_accessibility_report, generate_report
 */
export const exportData: ToolHandler = async (args, context) => {
  const exportType = args.type as string;
  if (!exportType) {
    return { error: 'type is required. Options: results, analytics, accessibility, security, report' };
  }

  const format = (args.format as string) || 'json';
  const projectId = args.project_id as string | undefined;
  const runId = args.run_id as string | undefined;
  const startDate = args.start_date as string | undefined;
  const endDate = args.end_date as string | undefined;
  const includeDetails = args.include_details !== false;

  const params = new URLSearchParams();
  params.set('format', format);
  if (projectId) params.set('project_id', projectId);
  if (runId) params.set('run_id', runId);
  if (startDate) params.set('start_date', startDate);
  if (endDate) params.set('end_date', endDate);
  if (includeDetails) params.set('include_details', 'true');

  // Route to appropriate endpoint based on type
  let endpoint: string;
  switch (exportType) {
    case 'results':
      if (!runId) return { error: 'run_id is required for results export' };
      endpoint = `/api/v1/runs/${runId}/export`;
      break;
    case 'analytics':
      if (!projectId) return { error: 'project_id is required for analytics export' };
      endpoint = `/api/v1/projects/${projectId}/analytics/export`;
      break;
    case 'accessibility':
      if (runId) {
        endpoint = `/api/v1/runs/${runId}/accessibility/export`;
      } else if (projectId) {
        endpoint = `/api/v1/projects/${projectId}/accessibility/export`;
      } else {
        return { error: 'run_id or project_id is required for accessibility export' };
      }
      break;
    case 'security':
      if (!projectId) return { error: 'project_id is required for security export' };
      endpoint = `/api/v1/projects/${projectId}/security/export`;
      break;
    case 'report':
      if (!projectId) return { error: 'project_id is required for report export' };
      endpoint = `/api/v1/projects/${projectId}/report`;
      break;
    default:
      return { error: `Unknown export type: ${exportType}. Options: results, analytics, accessibility, security, report` };
  }

  return await context.callApi(`${endpoint}?${params.toString()}`);
};

/**
 * Compare two test results (Feature #915)
 */
export const getResultDiff: ToolHandler = async (args, context) => {
  const baseResultId = args.base_result_id as string;
  const compareResultId = args.compare_result_id as string;
  if (!baseResultId || !compareResultId) {
    return { error: 'base_result_id and compare_result_id are required' };
  }

  const params = new URLSearchParams();
  params.set('base_result_id', baseResultId);
  params.set('compare_result_id', compareResultId);
  if (args.include_steps !== undefined) params.set('include_steps', String(args.include_steps));

  return await context.callApi(`/api/v1/results/diff?${params.toString()}`);
};

/**
 * Get annotations for a test result (Feature #916)
 */
export const getAnnotations: ToolHandler = async (args, context) => {
  let runId = args.run_id as string | undefined;
  let testId = args.test_id as string | undefined;
  const resultId = args.result_id as string | undefined;

  if (resultId) {
    const parts = resultId.split('-');
    if (parts.length >= 2 && parts[0]) {
      runId = parts[0];
      testId = parts.slice(1).join('-');
    }
  }

  if (!runId || !testId) {
    return { error: 'Either result_id or both run_id and test_id are required' };
  }

  return await context.callApi(`/api/v1/runs/${runId}/results/${testId}/annotations`);
};

// Handler registry for search and analysis tools
export const handlers: Record<string, ToolHandler> = {
  search_results: searchResults,
  get_failure_patterns: getFailurePatterns,
  get_review_status: getReviewStatus,
  create_bug_report: createBugReport,
  export_data: exportData,
  get_result_diff: getResultDiff,
  get_annotations: getAnnotations,
};

// List of tool names this module handles
export const toolNames = Object.keys(handlers);

// Export as a handler module
export const searchAnalysisHandlers: HandlerModule = {
  handlers,
  toolNames,
};

export default searchAnalysisHandlers;
