/**
 * MCP Workflow Module
 *
 * Handles workflow step execution for the MCP server.
 * Extracted from server.ts to reduce file size (Feature #252).
 *
 * @module mcp-workflow
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Logger function type
 */
export type LogFunction = (message: string) => void;

/**
 * API call function type
 */
export type ApiCallFunction = (
  endpoint: string,
  options?: { method?: string; body?: unknown } & Record<string, unknown>
) => Promise<unknown>;

/**
 * Tool API mapping entry
 */
export interface ToolApiMapping {
  method: string;
  path: string | ((args: Record<string, unknown>) => string);
  bodyKeys?: string[];
}

/**
 * Context for workflow execution
 */
export interface WorkflowContext {
  callApi: ApiCallFunction;
  log: LogFunction;
}

// ============================================================================
// Tool API Mappings
// ============================================================================

/**
 * Map common tools to their API endpoints.
 */
export const TOOL_API_MAP: Record<string, ToolApiMapping> = {
  'batch_trigger_tests': {
    method: 'POST',
    path: '/api/v1/suites/batch-run',
    bodyKeys: ['suite_ids', 'browser', 'branch', 'env', 'parallel', 'retries'],
  },
  // Feature #1428: get_run_status replaced by get_run
  'get_run': {
    method: 'GET',
    path: (a) => `/api/v1/runs/${a.run_id}/status`,
  },
  'subscribe_to_alerts': {
    method: 'GET',
    path: '/api/v1/monitoring/alert-grouping/groups?status=active',
  },
  // Feature #1429: get_test_results replaced by get_result
  'get_result': {
    method: 'GET',
    path: (a) => `/api/v1/runs/${a.run_id}/results`,
  },
  'trigger_test_run': {
    method: 'POST',
    path: (a) => `/api/v1/suites/${a.suite_id}/runs`,
    bodyKeys: ['browser', 'branch', 'env', 'parallel', 'retries'],
  },
  'get_flaky_tests': {
    method: 'GET',
    path: '/api/v1/tests/flaky',
  },
  'list_projects': {
    method: 'GET',
    path: '/api/v1/projects',
  },
};

// ============================================================================
// Workflow Execution
// ============================================================================

/**
 * Execute a single workflow step by calling the appropriate API.
 */
export async function executeWorkflowStep(
  tool: string,
  args: Record<string, unknown>,
  context: WorkflowContext
): Promise<unknown> {
  const mapping = TOOL_API_MAP[tool];
  if (!mapping) {
    // For unmapped tools, return a simulated result
    context.log(`[WORKFLOW] Tool "${tool}" not mapped for workflow execution, returning simulated result`);
    return {
      success: true,
      tool,
      simulated: true,
      args,
      message: `Tool ${tool} executed (simulated)`,
    };
  }

  // Build path
  const path = typeof mapping.path === 'function' ? mapping.path(args) : mapping.path;

  // Build body if needed
  let body: Record<string, unknown> | undefined;
  if (mapping.method === 'POST' && mapping.bodyKeys) {
    body = {};
    for (const key of mapping.bodyKeys) {
      if (args[key] !== undefined) {
        body[key] = args[key];
      }
    }
  }

  // Call the API
  return await context.callApi(path, mapping.method !== 'GET' ? { method: mapping.method, body } : undefined);
}
