/**
 * Artifacts Tool Handlers
 *
 * Handlers for artifact management MCP tools.
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
 * Unified get_artifact handler (Feature #1427)
 * Replaces get_screenshots, get_screenshot_base64, get_visual_comparison_image, compare_screenshots
 */
export const getArtifact: ToolHandler = async (args, context) => {
  const runId = args.run_id as string;
  const testId = args.test_id as string | undefined;
  const artifactType = (args.type as string) || 'screenshot';
  const format = (args.format as string) || 'url';
  const stepIndex = args.step_index as number | undefined;
  const includeAll = args.include_all as boolean || false;

  if (!runId) {
    return { error: 'run_id is required' };
  }

  // Build endpoint based on artifact type and format
  let endpoint: string;
  const params: Record<string, string> = {};

  if (artifactType === 'video') {
    if (!testId) {
      return { error: 'test_id is required for video artifacts' };
    }
    endpoint = `/api/v1/runs/${runId}/results/${testId}/video`;
    if (format === 'metadata') params.metadata_only = 'true';
  } else if (artifactType === 'trace') {
    if (!testId) {
      return { error: 'test_id is required for trace artifacts' };
    }
    endpoint = `/api/v1/runs/${runId}/results/${testId}/trace`;
    if (format === 'metadata') params.metadata_only = 'true';
  } else if (artifactType === 'diff') {
    if (!testId) {
      return { error: 'test_id is required for diff artifacts' };
    }
    if (format === 'base64') {
      endpoint = `/api/v1/runs/${runId}/results/${testId}/diff/base64`;
    } else {
      endpoint = `/api/v1/runs/${runId}/results/${testId}/diff`;
    }
  } else if (artifactType === 'baseline') {
    if (!testId) {
      return { error: 'test_id is required for baseline artifacts' };
    }
    if (format === 'base64') {
      endpoint = `/api/v1/runs/${runId}/results/${testId}/baseline/base64`;
    } else {
      endpoint = `/api/v1/runs/${runId}/results/${testId}/baseline`;
    }
  } else {
    // screenshot (default)
    if (testId) {
      if (stepIndex !== undefined) {
        if (format === 'base64') {
          endpoint = `/api/v1/runs/${runId}/results/${testId}/steps/${stepIndex}/screenshot/base64`;
        } else {
          endpoint = `/api/v1/runs/${runId}/results/${testId}/steps/${stepIndex}/screenshot`;
        }
      } else if (format === 'base64') {
        endpoint = `/api/v1/runs/${runId}/results/${testId}/screenshot/base64`;
      } else {
        endpoint = `/api/v1/runs/${runId}/results/${testId}/screenshot`;
      }
    } else {
      // List all screenshots for the run
      endpoint = `/api/v1/runs/${runId}/screenshots`;
      if (includeAll) {
        params.include_baseline = 'true';
        params.include_diff = 'true';
      }
    }
  }

  return await context.callApi(endpoint, Object.keys(params).length > 0 ? params : undefined);
};

/**
 * Get video recording (Feature #903)
 */
export const getVideo: ToolHandler = async (args, context) => {
  const parsed = parseResultId(args);
  if ('error' in parsed) {
    return parsed;
  }
  const { runId, testId } = parsed;

  const format = (args.format as string) || 'webm';
  return await context.callApi(`/api/v1/runs/${runId}/results/${testId}/video?format=${format}`);
};

/**
 * Get Playwright trace (Feature #904)
 */
export const getTrace: ToolHandler = async (args, context) => {
  const parsed = parseResultId(args);
  if ('error' in parsed) {
    return parsed;
  }
  const { runId, testId } = parsed;

  return await context.callApi(`/api/v1/runs/${runId}/results/${testId}/trace`);
};

/**
 * Analyze test failure with AI (Feature #905)
 */
export const analyzeFailure: ToolHandler = async (args, context) => {
  const parsed = parseResultId(args);
  if ('error' in parsed) {
    return parsed;
  }
  const { runId, testId } = parsed;

  const includeHistory = args.include_history !== false;
  return await context.callApi(`/api/v1/runs/${runId}/results/${testId}/analyze-failure?include_history=${includeHistory}`);
};

/**
 * Get formatted error stack trace (Feature #906)
 */
export const getErrorStacktrace: ToolHandler = async (args, context) => {
  const parsed = parseResultId(args);
  if ('error' in parsed) {
    return parsed;
  }
  const { runId, testId } = parsed;

  const includeSourceContext = args.include_source_context !== false;
  const contextLines = (args.context_lines as number) || 3;
  return await context.callApi(`/api/v1/runs/${runId}/results/${testId}/stacktrace?include_source_context=${includeSourceContext}&context_lines=${contextLines}`);
};

/**
 * Download all artifacts as zip (Feature #907)
 */
export const downloadArtifacts: ToolHandler = async (args, context) => {
  const runId = args.run_id as string;
  if (!runId) {
    return { error: 'run_id is required' };
  }

  const params = new URLSearchParams();
  // Always request metadata_only for MCP - we return URL, not binary stream
  params.append('metadata_only', 'true');
  if (args.test_id) {
    params.append('test_id', args.test_id as string);
  }
  if (args.include_screenshots !== undefined) {
    params.append('include_screenshots', String(args.include_screenshots));
  }
  if (args.include_videos !== undefined) {
    params.append('include_videos', String(args.include_videos));
  }
  if (args.include_traces !== undefined) {
    params.append('include_traces', String(args.include_traces));
  }

  const queryString = params.toString();
  const url = `/api/v1/runs/${runId}/artifacts/download?${queryString}`;
  return await context.callApi(url);
};

/**
 * Delete old artifacts (Feature #908)
 */
export const deleteArtifacts: ToolHandler = async (args, context) => {
  const runId = args.run_id as string;
  if (!runId) {
    return { error: 'run_id is required' };
  }

  const body: Record<string, unknown> = {};
  if (args.test_id) {
    body.test_id = args.test_id as string;
  }
  if (args.artifact_types) {
    body.artifact_types = args.artifact_types as string[];
  }
  if (args.older_than_days !== undefined) {
    body.older_than_days = args.older_than_days as number;
  }
  if (args.dry_run !== undefined) {
    body.dry_run = args.dry_run as boolean;
  }

  return await context.callApi(`/api/v1/runs/${runId}/artifacts`, {
    method: 'DELETE',
    body,
  });
};

/**
 * Check artifact storage usage (Feature #909)
 */
export const getArtifactStorage: ToolHandler = async (args, context) => {
  const params = new URLSearchParams();
  if (args.project_id) {
    params.append('project_id', args.project_id as string);
  }
  if (args.include_runs !== undefined) {
    params.append('include_runs', String(args.include_runs));
  }
  const queryString = params.toString();
  return await context.callApi(`/api/v1/artifacts/storage${queryString ? `?${queryString}` : ''}`);
};

// Handler registry for artifact tools
export const handlers: Record<string, ToolHandler> = {
  get_artifact: getArtifact,
  get_video: getVideo,
  get_trace: getTrace,
  analyze_failure: analyzeFailure,
  get_error_stacktrace: getErrorStacktrace,
  download_artifacts: downloadArtifacts,
  delete_artifacts: deleteArtifacts,
  get_artifact_storage: getArtifactStorage,
};

// List of tool names this module handles
export const toolNames = Object.keys(handlers);

// Export as a handler module
export const artifactsHandlers: HandlerModule = {
  handlers,
  toolNames,
};

export default artifactsHandlers;
