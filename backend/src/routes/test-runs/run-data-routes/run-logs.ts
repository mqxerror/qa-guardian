/**
 * Run Data Routes - Logs
 *
 * Endpoints for accessing test run log data:
 * - GET /api/v1/runs/:runId/logs (console logs for entire run)
 * - GET /api/v1/runs/:runId/results/:testId/console (console output per test)
 * - GET /api/v1/runs/:runId/results/:testId/network (network logs per test)
 *
 * Feature #1356: Code quality - extracted from run-data-routes.ts
 */

import { FastifyInstance } from 'fastify';
import { authenticate, getOrganizationId } from '../../../middleware/auth.js';
import { getTest } from '../../test-suites.js';
import { ConsoleLog, NetworkRequest } from '../execution.js';
import { sendError } from '../../../utils/errors.js';
import { getTestRunWithFallback, TestRunParams, GetRunLogsQuery } from './helpers.js';

export async function runLogRoutes(app: FastifyInstance): Promise<void> {
  // Feature #889: Get console logs for a test run
  app.get<{ Params: TestRunParams; Querystring: GetRunLogsQuery }>('/api/v1/runs/:runId/logs', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId } = request.params;
    const orgId = getOrganizationId(request);
    const { level = 'all', limit = 100, offset = 0 } = request.query;

    const run = await getTestRunWithFallback(runId);
    if (!run || run.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test run not found');
    }

    // Collect all console logs from all test results
    const allLogs: Array<{
      timestamp: string;
      level: string;
      message: string;
      location?: string;
      test_id?: string;
      test_name?: string;
    }> = [];

    const results = run.results || [];
    for (const result of results) {
      const testInfo = await getTest(result.test_id);
      const testName = testInfo?.name || 'Unknown Test';

      if (result.console_logs && Array.isArray(result.console_logs)) {
        for (const log of result.console_logs) {
          // Filter by level if not 'all'
          if (level !== 'all' && log.level !== level) {
            continue;
          }

          allLogs.push({
            timestamp: new Date(log.timestamp).toISOString(),
            level: log.level,
            message: log.message,
            location: log.location,
            test_id: result.test_id,
            test_name: testName,
          });
        }
      }
    }

    // Sort by timestamp
    allLogs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Apply pagination
    const paginatedLogs = allLogs.slice(offset, offset + limit);

    // Calculate log level counts
    const levelCounts = {
      error: allLogs.filter(l => l.level === 'error').length,
      warn: allLogs.filter(l => l.level === 'warn').length,
      info: allLogs.filter(l => l.level === 'info').length,
      debug: allLogs.filter(l => l.level === 'debug').length,
      log: allLogs.filter(l => l.level === 'log').length,
    };

    return {
      run_id: runId,
      status: run.status,
      logs: paginatedLogs,
      pagination: {
        total: allLogs.length,
        limit,
        offset,
        has_more: offset + limit < allLogs.length,
      },
      level_counts: levelCounts,
      filter: {
        level: level,
      },
    };
  });

  // Feature #890: Get console output for a specific test result
  app.get<{ Params: { runId: string; testId: string } }>('/api/v1/runs/:runId/results/:testId/console', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId, testId } = request.params;
    const orgId = getOrganizationId(request);

    const run = await getTestRunWithFallback(runId);
    if (!run || run.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test run not found');
    }

    const result = run.results?.find(r => r.test_id === testId);
    if (!result) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test result not found');
    }

    const testInfo = await getTest(testId);
    const consoleLogs = result.console_logs || [];

    // Categorize logs by level with highlighting info
    const categorizedLogs = {
      errors: consoleLogs.filter((l: ConsoleLog) => l.level === 'error').map((l: ConsoleLog) => ({
        ...l,
        timestamp: new Date(l.timestamp).toISOString(),
        highlighted: true,
        severity: 'high',
      })),
      warnings: consoleLogs.filter((l: ConsoleLog) => l.level === 'warn').map((l: ConsoleLog) => ({
        ...l,
        timestamp: new Date(l.timestamp).toISOString(),
        highlighted: true,
        severity: 'medium',
      })),
      info: consoleLogs.filter((l: ConsoleLog) => l.level === 'info' || l.level === 'log').map((l: ConsoleLog) => ({
        ...l,
        timestamp: new Date(l.timestamp).toISOString(),
        highlighted: false,
        severity: 'low',
      })),
      debug: consoleLogs.filter((l: ConsoleLog) => l.level === 'debug').map((l: ConsoleLog) => ({
        ...l,
        timestamp: new Date(l.timestamp).toISOString(),
        highlighted: false,
        severity: 'none',
      })),
    };

    // All logs in chronological order with highlighting
    const allLogs = consoleLogs.map((l: ConsoleLog) => ({
      timestamp: new Date(l.timestamp).toISOString(),
      level: l.level,
      message: l.message,
      location: l.location,
      highlighted: l.level === 'error' || l.level === 'warn',
      severity: l.level === 'error' ? 'high' : l.level === 'warn' ? 'medium' : 'low',
    })).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return {
      run_id: runId,
      test_id: testId,
      test_name: testInfo?.name || 'Unknown Test',
      test_status: result.status,
      console_output: {
        total: consoleLogs.length,
        by_level: {
          error: categorizedLogs.errors.length,
          warn: categorizedLogs.warnings.length,
          info: categorizedLogs.info.length,
          debug: categorizedLogs.debug.length,
        },
        has_errors: categorizedLogs.errors.length > 0,
        has_warnings: categorizedLogs.warnings.length > 0,
      },
      logs: allLogs,
      categorized: categorizedLogs,
    };
  });

  // Feature #891: Get network logs for a specific test result
  app.get<{ Params: { runId: string; testId: string } }>('/api/v1/runs/:runId/results/:testId/network', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId, testId } = request.params;
    const orgId = getOrganizationId(request);

    const run = await getTestRunWithFallback(runId);
    if (!run || run.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test run not found');
    }

    const result = run.results?.find(r => r.test_id === testId);
    if (!result) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test result not found');
    }

    const testInfo = await getTest(testId);
    const networkRequests = result.network_requests || [];

    // Calculate statistics
    const totalRequests = networkRequests.length;
    const failedRequests = networkRequests.filter((r: NetworkRequest) => r.failed || (r.status && r.status >= 400));
    const successfulRequests = networkRequests.filter((r: NetworkRequest) => !r.failed && (!r.status || r.status < 400));

    // Calculate response times
    const responseTimes = networkRequests
      .filter((r: NetworkRequest) => r.duration_ms !== undefined)
      .map((r: NetworkRequest) => r.duration_ms!);
    const avgResponseTime = responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a: number, b: number) => a + b, 0) / responseTimes.length)
      : null;
    const maxResponseTime = responseTimes.length > 0 ? Math.max(...responseTimes) : null;
    const minResponseTime = responseTimes.length > 0 ? Math.min(...responseTimes) : null;

    // Group by resource type
    const byResourceType: Record<string, number> = {};
    for (const req of networkRequests) {
      const type = req.resourceType || 'other';
      byResourceType[type] = (byResourceType[type] || 0) + 1;
    }

    // Format requests for response with flagging failed ones
    const formattedRequests = networkRequests.map((req: NetworkRequest) => ({
      timestamp: new Date(req.timestamp).toISOString(),
      method: req.method,
      url: req.url,
      resource_type: req.resourceType,
      status: req.status,
      status_text: req.statusText,
      duration_ms: req.duration_ms,
      request_size: req.requestSize,
      response_size: req.responseSize,
      failed: req.failed || (req.status && req.status >= 400),
      failure_reason: req.failureText || (req.status && req.status >= 400 ? `HTTP ${req.status}` : null),
      is_slow: req.duration_ms && req.duration_ms > 1000, // Flag requests over 1 second
    })).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return {
      run_id: runId,
      test_id: testId,
      test_name: testInfo?.name || 'Unknown Test',
      test_status: result.status,
      network_summary: {
        total_requests: totalRequests,
        successful_requests: successfulRequests.length,
        failed_requests: failedRequests.length,
        has_failures: failedRequests.length > 0,
        by_resource_type: byResourceType,
      },
      response_times: {
        avg_ms: avgResponseTime,
        max_ms: maxResponseTime,
        min_ms: minResponseTime,
      },
      requests: formattedRequests,
      failed_requests: formattedRequests.filter(r => r.failed),
    };
  });
}
