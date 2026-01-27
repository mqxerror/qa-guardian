/**
 * Visual Regression Tool Handlers
 *
 * Handlers for visual regression testing MCP tools.
 * Extracted from server.ts to reduce file size (Feature #1356).
 */

import { ToolHandler, HandlerModule } from './types';

/**
 * Get visual diffs (Feature #959)
 */
export const getVisualDiffs: ToolHandler = async (args, context) => {
  const projectId = args.project_id as string | undefined;
  const limit = (args.limit as number) || 20;

  // Build query params
  const diffParams = new URLSearchParams();
  if (projectId) diffParams.append('project_id', projectId);
  const diffQuery = diffParams.toString();

  // Call the visual pending endpoint
  const diffsResult = await context.callApi(`/api/v1/visual/pending${diffQuery ? '?' + diffQuery : ''}`) as {
    pending: Array<{
      runId: string;
      testId: string;
      testName: string;
      projectId?: string;
      projectName?: string;
      suiteId: string;
      suiteName?: string;
      diffPercentage?: number;
      screenshot?: string;
      baselineScreenshot?: string;
      diffImage?: string;
      startedAt?: string;
      viewport?: string;
    }>;
    total: number;
  };

  // Apply limit
  const limitedDiffs = diffsResult.pending.slice(0, limit);

  // Build response
  const diffs = limitedDiffs.map(diff => ({
    run_id: diff.runId,
    test_id: diff.testId,
    test_name: diff.testName,
    project_id: diff.projectId,
    project_name: diff.projectName,
    suite_id: diff.suiteId,
    suite_name: diff.suiteName,
    diff_percentage: diff.diffPercentage !== undefined ? `${diff.diffPercentage.toFixed(2)}%` : 'Unknown',
    diff_percentage_value: diff.diffPercentage,
    started_at: diff.startedAt,
    status: 'pending',
    has_screenshot: !!diff.screenshot,
    has_baseline: !!diff.baselineScreenshot,
    has_diff_image: !!diff.diffImage,
  }));

  // Summary
  const byProject: Record<string, number> = {};
  for (const diff of diffsResult.pending) {
    const pName = diff.projectName || 'Unknown';
    byProject[pName] = (byProject[pName] || 0) + 1;
  }

  return {
    diffs,
    summary: {
      total_pending: diffsResult.total,
      showing: limitedDiffs.length,
      by_project: Object.entries(byProject).map(([name, count]) => ({ project: name, count })),
    },
    filter: {
      project_id: projectId || 'all',
      status: 'pending',
    },
    message: diffsResult.total > 0
      ? `Found ${diffsResult.total} pending visual diff(s) requiring review.`
      : 'No pending visual diffs found.',
  };
};

/**
 * Get visual diff details (Feature #960)
 */
export const getVisualDiffDetails: ToolHandler = async (args, context) => {
  const runId = args.run_id as string;
  const testId = args.test_id as string;

  if (!runId?.trim()) {
    return { error: 'run_id is required' };
  }
  if (!testId?.trim()) {
    return { error: 'test_id is required' };
  }

  const apiBase = (context as { apiUrl?: string }).apiUrl || 'http://localhost:3001';

  // First, try to get data from the visual pending endpoint
  const pendingResult = await context.callApi('/api/v1/visual/pending') as {
    pending: Array<{
      runId: string;
      testId: string;
      testName?: string;
      projectId?: string;
      projectName?: string;
      suiteId: string;
      suiteName?: string;
      diffPercentage?: number;
      screenshot?: string;
      baselineScreenshot?: string;
      diffImage?: string;
      startedAt?: string;
      viewport?: string;
    }>;
    total: number;
  };

  // Find the matching diff from pending list
  const pendingDiff = pendingResult.pending?.find(
    p => p.runId === runId && p.testId === testId
  );

  if (pendingDiff) {
    // Build image URLs
    const imageUrls = {
      current_screenshot_url: pendingDiff.screenshot
        ? `${apiBase}/api/v1/runs/${runId}/results/${testId}/screenshot`
        : null,
      baseline_image_url: pendingDiff.baselineScreenshot
        ? `${apiBase}/api/v1/runs/${runId}/results/${testId}/baseline`
        : null,
      diff_overlay_url: pendingDiff.diffImage
        ? `${apiBase}/api/v1/runs/${runId}/results/${testId}/diff`
        : null,
    };

    return {
      run_id: runId,
      test_id: testId,
      test_name: pendingDiff.testName,
      project_id: pendingDiff.projectId,
      project_name: pendingDiff.projectName,
      suite_id: pendingDiff.suiteId,
      suite_name: pendingDiff.suiteName,
      started_at: pendingDiff.startedAt,
      viewport: pendingDiff.viewport,
      images: imageUrls,
      has_current_screenshot: !!pendingDiff.screenshot,
      has_baseline_image: !!pendingDiff.baselineScreenshot,
      has_diff_overlay: !!pendingDiff.diffImage,
      visual_comparison: pendingDiff.diffPercentage !== undefined ? {
        diff_percentage: `${pendingDiff.diffPercentage.toFixed(2)}%`,
        diff_percentage_value: pendingDiff.diffPercentage,
      } : null,
      status: 'pending_review',
      message: pendingDiff.diffPercentage !== undefined
        ? `Visual diff: ${pendingDiff.diffPercentage.toFixed(2)}% difference detected. Awaiting review.`
        : 'Visual diff detected. Awaiting review.',
    };
  }

  // Fallback: try to get the test run directly
  try {
    const runResult = await context.callApi(`/api/v1/runs/${encodeURIComponent(runId)}`) as {
      id: string;
      suite_id: string;
      status: string;
      browser?: string;
      started_at?: string;
      completed_at?: string;
      results?: Array<{
        test_id: string;
        test_name?: string;
        status: string;
        duration_ms?: number;
        screenshot_base64?: string;
        baseline_screenshot_base64?: string;
        diff_image_base64?: string;
        visual_comparison?: {
          diffPercentage?: number;
          mismatchedPixels?: number;
          comparisonStatus?: string;
          message?: string;
        };
        error?: string | { message: string };
      }>;
    };

    const testResult = runResult.results?.find(r => r.test_id === testId);
    if (!testResult) {
      return {
        error: `Visual diff not found for run_id "${runId}" and test_id "${testId}"`,
        hint: 'Use get_visual_diffs first to find valid run_id and test_id combinations.',
      };
    }

    const imageUrls = {
      current_screenshot_url: testResult.screenshot_base64
        ? `${apiBase}/api/v1/runs/${runId}/results/${testId}/screenshot`
        : null,
      baseline_image_url: testResult.baseline_screenshot_base64
        ? `${apiBase}/api/v1/runs/${runId}/results/${testId}/baseline`
        : null,
      diff_overlay_url: testResult.diff_image_base64
        ? `${apiBase}/api/v1/runs/${runId}/results/${testId}/diff`
        : null,
    };

    const visualComparison = testResult.visual_comparison ? {
      diff_percentage: testResult.visual_comparison.diffPercentage !== undefined
        ? `${testResult.visual_comparison.diffPercentage.toFixed(2)}%`
        : 'Unknown',
      diff_percentage_value: testResult.visual_comparison.diffPercentage,
      mismatched_pixels: testResult.visual_comparison.mismatchedPixels,
      comparison_status: testResult.visual_comparison.comparisonStatus,
      message: testResult.visual_comparison.message,
    } : null;

    return {
      run_id: runId,
      test_id: testId,
      test_name: testResult.test_name,
      suite_id: runResult.suite_id,
      run_status: runResult.status,
      test_status: testResult.status,
      browser: runResult.browser,
      started_at: runResult.started_at,
      completed_at: runResult.completed_at,
      duration_ms: testResult.duration_ms,
      images: imageUrls,
      has_current_screenshot: !!testResult.screenshot_base64,
      has_baseline_image: !!testResult.baseline_screenshot_base64,
      has_diff_overlay: !!testResult.diff_image_base64,
      visual_comparison: visualComparison,
      error: testResult.error
        ? (typeof testResult.error === 'string' ? testResult.error : testResult.error.message)
        : null,
      message: visualComparison
        ? `Visual diff: ${visualComparison.diff_percentage} difference detected.`
        : 'No visual comparison data available.',
    };
  } catch {
    return {
      error: `Visual diff not found for run_id "${runId}" and test_id "${testId}"`,
      hint: 'Use get_visual_diffs first to find valid run_id and test_id combinations.',
    };
  }
};

/**
 * Get baseline history (Feature #965)
 */
export const getBaselineHistory: ToolHandler = async (args, context) => {
  const testId = args.test_id as string;
  if (!testId) {
    return { error: 'test_id is required' };
  }

  const viewport = (args.viewport as string) || 'single';
  const branch = (args.branch as string) || 'main';
  const limit = (args.limit as number) || 20;

  // Build query string
  const params = new URLSearchParams();
  params.append('viewport', viewport);
  params.append('branch', branch);

  try {
    const result = await context.callApi(`/api/v1/tests/${testId}/baseline/history?${params.toString()}`) as {
      test_id: string;
      viewport: string;
      branch: string;
      history: Array<{
        id: string;
        version: number;
        created_at: string;
        approved_by: string;
        source: string;
        note?: string;
        filename: string;
      }>;
      total: number;
    };

    // Limit the results
    const limitedHistory = result.history.slice(0, limit);

    // Transform for better readability
    const historyEntries = limitedHistory.map((entry, index) => ({
      version: entry.version,
      created_at: entry.created_at,
      approved_by: entry.approved_by,
      source: entry.source,
      note: entry.note || null,
      is_current: index === 0,
      history_id: entry.id,
    }));

    return {
      test_id: testId,
      viewport,
      branch,
      total_entries: result.total,
      entries_returned: historyEntries.length,
      history: historyEntries,
      current_version: historyEntries.length > 0 ? historyEntries[0]?.version : null,
      note: historyEntries.length === 0
        ? 'No baseline history found for this test. Run a visual test and approve it to create the first baseline.'
        : `Found ${result.total} baseline version(s). Use history_id to compare or restore previous versions.`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get baseline history',
      test_id: testId,
      viewport,
      branch,
    };
  }
};

/**
 * Configure visual threshold (Feature #969)
 */
export const configureVisualThreshold: ToolHandler = async (args, context) => {
  const testId = args.test_id as string;
  if (!testId) {
    return { error: 'test_id is required' };
  }

  const threshold = args.threshold as number;
  if (typeof threshold !== 'number' || threshold < 0) {
    return { error: 'threshold must be a non-negative number' };
  }

  const mode = (args.mode as string) || 'percentage';
  if (mode !== 'percentage' && mode !== 'pixel_count') {
    return { error: 'mode must be "percentage" or "pixel_count"' };
  }

  // Validate threshold based on mode
  if (mode === 'percentage' && threshold > 100) {
    return { error: 'For percentage mode, threshold must be between 0 and 100' };
  }

  const antiAliasingTolerance = args.anti_aliasing_tolerance as string | undefined;
  const colorThreshold = args.color_threshold as number | undefined;

  if (antiAliasingTolerance && !['off', 'low', 'medium', 'high'].includes(antiAliasingTolerance)) {
    return { error: 'anti_aliasing_tolerance must be one of: off, low, medium, high' };
  }

  if (colorThreshold !== undefined && (colorThreshold < 0 || colorThreshold > 1)) {
    return { error: 'color_threshold must be between 0.0 and 1.0' };
  }

  try {
    // Build the update body
    const updateBody: Record<string, unknown> = {
      diff_threshold_mode: mode,
    };

    if (mode === 'percentage') {
      updateBody.diff_threshold = threshold;
    } else {
      updateBody.diff_pixel_threshold = threshold;
    }

    if (antiAliasingTolerance) {
      updateBody.anti_aliasing_tolerance = antiAliasingTolerance;
    }

    if (colorThreshold !== undefined) {
      updateBody.color_threshold = colorThreshold;
    }

    // Update the test
    const result = await context.callApi(`/api/v1/tests/${testId}`, {
      method: 'PATCH',
      body: updateBody,
    }) as {
      id: string;
      name: string;
      diff_threshold?: number;
      diff_threshold_mode?: string;
      diff_pixel_threshold?: number;
      anti_aliasing_tolerance?: string;
      color_threshold?: number;
      error?: string;
    };

    if (result.error) {
      return {
        success: false,
        error: result.error,
        test_id: testId,
      };
    }

    return {
      success: true,
      test_id: testId,
      test_name: result.name,
      configuration: {
        threshold_mode: mode,
        threshold_value: threshold,
        anti_aliasing_tolerance: result.anti_aliasing_tolerance || 'off',
        color_threshold: result.color_threshold,
      },
      note: mode === 'percentage'
        ? `Visual tests will pass if up to ${threshold}% of pixels differ from baseline.`
        : `Visual tests will pass if up to ${threshold} pixels differ from baseline.`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to configure visual threshold',
      test_id: testId,
    };
  }
};

/**
 * Get visual review queue (Feature #972)
 */
export const getVisualReviewQueue: ToolHandler = async (args, context) => {
  const projectId = args.project_id as string | undefined;
  const sortBy = (args.sort_by as string) || 'diff_percentage';
  const limit = (args.limit as number) || 20;

  try {
    // Get pending visual diffs
    const queryParams = new URLSearchParams();
    if (projectId) queryParams.append('project_id', projectId);

    const pendingResult = await context.callApi(`/api/v1/visual/pending${queryParams.toString() ? '?' + queryParams.toString() : ''}`) as {
      pending: Array<{
        runId: string;
        testId: string;
        projectId: string;
        projectName: string;
        suiteId: string;
        suiteName: string;
        diffPercentage: number;
        startedAt: string;
        viewport: string;
      }>;
      total: number;
      error?: string;
    };

    if (pendingResult.error) {
      return {
        success: false,
        error: pendingResult.error,
      };
    }

    let items = pendingResult.pending || [];

    // Sort based on sort_by parameter
    if (sortBy === 'diff_percentage') {
      items.sort((a, b) => b.diffPercentage - a.diffPercentage);
    } else if (sortBy === 'created_at') {
      items.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    } else if (sortBy === 'project') {
      items.sort((a, b) => a.projectName.localeCompare(b.projectName));
    }

    // Apply limit
    items = items.slice(0, limit);

    // Transform for better readability
    const queue = items.map((item, index) => ({
      priority: index + 1,
      test_id: item.testId,
      run_id: item.runId,
      project: {
        id: item.projectId,
        name: item.projectName,
      },
      suite_name: item.suiteName,
      diff_percentage: Math.round(item.diffPercentage * 100) / 100,
      viewport: item.viewport,
      created_at: item.startedAt,
      urgency: item.diffPercentage > 20 ? 'high' : item.diffPercentage > 5 ? 'medium' : 'low',
      actions: ['get_artifact', 'get_visual_diff_details'],
    }));

    // Group by project for summary
    const projectSummary: Record<string, number> = {};
    for (const item of items) {
      projectSummary[item.projectName] = (projectSummary[item.projectName] || 0) + 1;
    }

    return {
      success: true,
      total_pending: pendingResult.total,
      items_returned: queue.length,
      sorted_by: sortBy,
      queue,
      by_project: Object.entries(projectSummary).map(([name, count]) => ({ project: name, pending: count })),
      note: queue.length > 0
        ? `${queue.length} visual changes need review. Use the UI to approve or reject them.`
        : 'No visual changes pending review.',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get visual review queue',
    };
  }
};

// Handler registry for visual regression tools
export const handlers: Record<string, ToolHandler> = {
  get_visual_diffs: getVisualDiffs,
  get_visual_diff_details: getVisualDiffDetails,
  get_baseline_history: getBaselineHistory,
  configure_visual_threshold: configureVisualThreshold,
  get_visual_review_queue: getVisualReviewQueue,
};

// List of tool names this module handles
export const toolNames = Object.keys(handlers);

// Export as a handler module
export const visualRegressionHandlers: HandlerModule = {
  handlers,
  toolNames,
};

export default visualRegressionHandlers;
