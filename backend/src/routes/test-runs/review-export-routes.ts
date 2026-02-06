/**
 * Review and Export Routes Module
 * Feature #1356: Backend file size limit enforcement (1500 lines)
 *
 * This module contains routes for test result review and export:
 * - POST /api/v1/runs/:runId/results/:testId/review - Mark as reviewed
 * - GET /api/v1/runs/:runId/results/:testId/review - Get review status
 * - DELETE /api/v1/runs/:runId/results/:testId/review - Clear review status
 * - POST /api/v1/runs/:runId/results/:testId/bug-report - Generate bug report
 * - GET /api/v1/runs/:runId/export - Export results in various formats
 *
 * Extracted from test-runs.ts to reduce file size.
 */

import { FastifyInstance } from 'fastify';
import { authenticate, getOrganizationId } from '../../middleware/auth';
import { testRuns, TestRun } from './execution';
import { getTestRun } from '../../services/repositories/test-runs';
import { getTestSuite } from '../test-suites';

/**
 * Get a test run with fallback: check in-memory Map first (for in-flight runs), then DB.
 */
async function getTestRunWithFallback(runId: string): Promise<TestRun | undefined> {
  const memRun = testRuns.get(runId);
  if (memRun) return memRun;
  return await getTestRun(runId);
}

/**
 * Register review and export routes
 */
export async function reviewExportRoutes(app: FastifyInstance): Promise<void> {
  // Feature #912: Mark a test result as reviewed
  // AI agent can mark results as reviewed with optional notes
  app.post<{ Params: { runId: string; testId: string }; Body: { notes?: string } }>('/api/v1/runs/:runId/results/:testId/review', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId, testId } = request.params;
    const { notes } = request.body || {};
    const orgId = getOrganizationId(request);
    const userId = (request as any).user?.id;

    // Verify run exists and belongs to user's organization
    const run = await getTestRunWithFallback(runId);
    if (!run || run.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test run not found',
      });
    }

    // Find the test result
    const result = run.results?.find(r => r.test_id === testId);
    if (!result) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test result not found',
      });
    }

    // Check if already reviewed
    const wasAlreadyReviewed = result.reviewed === true;

    // Mark as reviewed
    result.reviewed = true;
    result.reviewed_at = new Date();
    result.reviewed_by = userId;
    if (notes) {
      result.review_notes = notes;
    }

    return {
      success: true,
      run_id: runId,
      test_id: testId,
      test_name: result.test_name,
      test_status: result.status,
      review: {
        reviewed: true,
        reviewed_at: result.reviewed_at.toISOString(),
        reviewed_by: result.reviewed_by,
        notes: result.review_notes || null,
        was_already_reviewed: wasAlreadyReviewed,
      },
      message: wasAlreadyReviewed
        ? 'Test result was already reviewed. Review notes have been updated.'
        : 'Test result has been marked as reviewed.',
    };
  });

  // Feature #912: Get review status for a test result
  app.get<{ Params: { runId: string; testId: string } }>('/api/v1/runs/:runId/results/:testId/review', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId, testId } = request.params;
    const orgId = getOrganizationId(request);

    // Verify run exists and belongs to user's organization
    const run = await getTestRunWithFallback(runId);
    if (!run || run.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test run not found',
      });
    }

    // Find the test result
    const result = run.results?.find(r => r.test_id === testId);
    if (!result) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test result not found',
      });
    }

    return {
      run_id: runId,
      test_id: testId,
      test_name: result.test_name,
      test_status: result.status,
      review: {
        reviewed: result.reviewed === true,
        reviewed_at: result.reviewed_at?.toISOString() || null,
        reviewed_by: result.reviewed_by || null,
        notes: result.review_notes || null,
      },
    };
  });

  // Feature #912: Clear review status for a test result
  app.delete<{ Params: { runId: string; testId: string } }>('/api/v1/runs/:runId/results/:testId/review', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId, testId } = request.params;
    const orgId = getOrganizationId(request);

    // Verify run exists and belongs to user's organization
    const run = await getTestRunWithFallback(runId);
    if (!run || run.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test run not found',
      });
    }

    // Find the test result
    const result = run.results?.find(r => r.test_id === testId);
    if (!result) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test result not found',
      });
    }

    // Check if was reviewed
    const wasReviewed = result.reviewed === true;

    // Clear review status
    result.reviewed = false;
    result.reviewed_at = undefined;
    result.reviewed_by = undefined;
    result.review_notes = undefined;

    return {
      success: true,
      run_id: runId,
      test_id: testId,
      test_name: result.test_name,
      was_reviewed: wasReviewed,
      message: wasReviewed
        ? 'Review status has been cleared.'
        : 'Test result was not reviewed.',
    };
  });

  // Feature #913: Generate bug report from a test failure
  // AI agent can create structured bug report from test result
  app.post<{ Params: { runId: string; testId: string }; Body: { format?: string; include_screenshots?: boolean; include_trace?: boolean; additional_context?: string } }>('/api/v1/runs/:runId/results/:testId/bug-report', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId, testId } = request.params;
    const {
      format = 'markdown',
      include_screenshots = true,
      include_trace = true,
      additional_context,
    } = request.body || {};
    const orgId = getOrganizationId(request);

    // Verify run exists and belongs to user's organization
    const run = await getTestRunWithFallback(runId);
    if (!run || run.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test run not found',
      });
    }

    // Find the test result
    const result = run.results?.find(r => r.test_id === testId);
    if (!result) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test result not found',
      });
    }

    // Check if test failed
    if (result.status !== 'failed' && result.status !== 'error') {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Bug reports can only be generated for failed or error tests.',
        test_status: result.status,
      });
    }

    // Get test and suite info
    const suite = await getTestSuite(run.suite_id);
    const suiteAny = suite as any;
    const test = suiteAny?.tests?.find((t: any) => t.id === testId);

    // Extract error information
    const errorMessage = result.error || 'Unknown error';
    const failedSteps = result.steps?.filter(s => s.status === 'failed') || [];
    const consoleErrors = result.console_logs?.filter(l => l.level === 'error') || [];
    const networkErrors = result.network_requests?.filter(r => r.failed || (r.status && r.status >= 400)) || [];

    // Categorize error
    let errorCategory = 'Unknown';
    if (errorMessage.includes('net::ERR_') || errorMessage.includes('ERR_CONNECTION')) {
      errorCategory = 'Network Error';
    } else if (errorMessage.includes('Timeout') || errorMessage.includes('timeout')) {
      errorCategory = 'Timeout';
    } else if (errorMessage.includes('selector') || errorMessage.includes('locator')) {
      errorCategory = 'Element Not Found';
    } else if (errorMessage.includes('assertion') || errorMessage.includes('expect')) {
      errorCategory = 'Assertion Failed';
    } else if (errorMessage.includes('click') || errorMessage.includes('fill')) {
      errorCategory = 'Interaction Failed';
    }

    // Generate steps to reproduce
    const stepsToReproduce: string[] = [];
    if (result.steps && result.steps.length > 0) {
      for (let i = 0; i < result.steps.length; i++) {
        const step = result.steps[i];
        if (!step) continue;
        let stepDesc = `${i + 1}. ${step.action}`;
        if (step.selector) {
          stepDesc += ` on element "${step.selector}"`;
        }
        if (step.value) {
          stepDesc += ` with value "${step.value}"`;
        }
        if (step.status === 'failed') {
          stepDesc += ' ❌ (FAILED)';
        }
        stepsToReproduce.push(stepDesc);
      }
    }

    // Build screenshot info
    const screenshots: { type: string; url: string; description: string }[] = [];
    if (include_screenshots && result.screenshot_base64) {
      screenshots.push({
        type: 'failure',
        url: `/api/v1/runs/${runId}/results/${testId}/screenshot/base64`,
        description: 'Screenshot at point of failure',
      });
    }
    if (include_screenshots && result.baseline_screenshot_base64) {
      screenshots.push({
        type: 'baseline',
        url: `/api/v1/runs/${runId}/results/${testId}/baseline/base64`,
        description: 'Expected baseline screenshot',
      });
    }
    if (include_screenshots && result.diff_image_base64) {
      screenshots.push({
        type: 'diff',
        url: `/api/v1/runs/${runId}/results/${testId}/diff/base64`,
        description: 'Visual diff highlighting differences',
      });
    }

    // Build trace info
    let traceInfo = null;
    if (include_trace && result.trace_file) {
      traceInfo = {
        available: true,
        url: `/api/v1/traces/${result.trace_file.split('/').pop()}`,
        viewer_url: `https://trace.playwright.dev/`,
        description: 'Playwright trace file for detailed step-by-step debugging',
      };
    }

    // Build the bug report content
    const bugReport = {
      title: `[Test Failure] ${result.test_name} - ${errorCategory}`,
      summary: `Test "${result.test_name}" failed with error: ${errorCategory}`,
      severity: networkErrors.length > 0 || errorCategory === 'Network Error' ? 'high' : 'medium',
      environment: {
        browser: run.browser,
        viewport: result.viewport_width && result.viewport_height
          ? `${result.viewport_width}x${result.viewport_height}`
          : 'Unknown',
        test_suite: suite?.name || 'Unknown',
        run_id: runId,
        test_id: testId,
      },
      error_details: {
        category: errorCategory,
        message: errorMessage.substring(0, 500),
        failed_step: failedSteps.length > 0 && failedSteps[0] ? {
          action: failedSteps[0].action,
          selector: failedSteps[0].selector,
          error: failedSteps[0].error,
        } : null,
      },
      steps_to_reproduce: stepsToReproduce,
      console_errors: consoleErrors.map(e => e.message).slice(0, 5),
      network_errors: networkErrors.map(r => ({
        url: r.url,
        status: r.status,
        error: r.failureText,
      })).slice(0, 5),
      screenshots: screenshots.length > 0 ? screenshots : null,
      trace: traceInfo,
      additional_context: additional_context || null,
      timestamps: {
        test_started: result.steps?.[0] ? new Date(Date.now() - result.duration_ms).toISOString() : null,
        test_ended: new Date().toISOString(),
        duration_ms: result.duration_ms,
      },
    };

    // Generate markdown format if requested
    let markdownReport = null;
    if (format === 'markdown') {
      const lines: string[] = [
        `# ${bugReport.title}`,
        '',
        `## Summary`,
        bugReport.summary,
        '',
        `**Severity:** ${bugReport.severity}`,
        '',
        `## Environment`,
        `- **Browser:** ${bugReport.environment.browser}`,
        `- **Viewport:** ${bugReport.environment.viewport}`,
        `- **Test Suite:** ${bugReport.environment.test_suite}`,
        `- **Run ID:** ${bugReport.environment.run_id}`,
        `- **Test ID:** ${bugReport.environment.test_id}`,
        '',
        `## Error Details`,
        `- **Category:** ${bugReport.error_details.category}`,
        `- **Message:** \`${bugReport.error_details.message}\``,
        '',
      ];

      if (stepsToReproduce.length > 0) {
        lines.push('## Steps to Reproduce');
        stepsToReproduce.forEach(step => lines.push(step));
        lines.push('');
      }

      if (consoleErrors.length > 0) {
        lines.push('## Console Errors');
        consoleErrors.slice(0, 5).forEach(e => lines.push(`- ${e.message}`));
        lines.push('');
      }

      if (networkErrors.length > 0) {
        lines.push('## Network Errors');
        networkErrors.slice(0, 5).forEach(r => {
          lines.push(`- ${r.method} ${r.url} - Status: ${r.status || 'Failed'}`);
        });
        lines.push('');
      }

      if (screenshots.length > 0) {
        lines.push('## Screenshots');
        screenshots.forEach(s => {
          lines.push(`### ${s.type.charAt(0).toUpperCase() + s.type.slice(1)}`);
          lines.push(`${s.description}`);
          lines.push(`URL: ${s.url}`);
          lines.push('');
        });
      }

      if (traceInfo) {
        lines.push('## Trace File');
        lines.push(`Download trace from: ${traceInfo.url}`);
        lines.push(`View in Playwright Trace Viewer: ${traceInfo.viewer_url}`);
        lines.push('');
      }

      if (additional_context) {
        lines.push('## Additional Context');
        lines.push(additional_context);
        lines.push('');
      }

      markdownReport = lines.join('\n');
    }

    return {
      success: true,
      bug_report: bugReport,
      markdown: markdownReport,
      format,
      generated_at: new Date().toISOString(),
    };
  });

  // Feature #914: Export test results in various formats (JSON, CSV, JUnit XML)
  app.get<{ Params: { runId: string }; Querystring: { format?: string; include_steps?: string; include_artifacts?: string } }>('/api/v1/runs/:runId/export', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId } = request.params;
    const format = (request.query.format || 'json').toLowerCase();
    const includeSteps = request.query.include_steps !== 'false';
    const includeArtifacts = request.query.include_artifacts !== 'false';

    const run = await getTestRunWithFallback(runId);
    if (!run) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test run not found',
      });
    }

    // Validate format
    const validFormats = ['json', 'csv', 'junit', 'junit-xml'];
    if (!validFormats.includes(format)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: `Invalid format. Must be one of: ${validFormats.join(', ')}`,
      });
    }

    // Get test suite info
    const suite = await getTestSuite(run.suite_id);

    // Build export data - cast run to any for optional properties that may exist at runtime
    const runAny = run as any;
    const results = run.results || [];
    const exportData = {
      run_id: run.id,
      suite_id: run.suite_id,
      suite_name: suite?.name || 'Unknown Suite',
      status: run.status,
      started_at: run.started_at,
      completed_at: run.completed_at,
      duration_ms: run.duration_ms,
      browser: run.browser,
      viewport: runAny.viewport || null,
      total_tests: results.length,
      passed: results.filter(r => r.status === 'passed').length,
      failed: results.filter(r => r.status === 'failed').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      error: results.filter(r => r.status === 'error').length,
      results: results.map(result => {
        // Cast result to any for optional properties that may exist at runtime
        const resultAny = result as any;
        const resultData: any = {
          test_id: result.test_id,
          test_name: result.test_name,
          status: result.status,
          duration_ms: result.duration_ms,
          started_at: resultAny.started_at || null,
          completed_at: resultAny.completed_at || null,
          error_message: resultAny.error_message || result.error || null,
        };

        if (includeSteps && result.steps) {
          resultData.steps = result.steps.map(step => ({
            action: step.action,
            selector: step.selector,
            value: step.value,
            status: step.status,
            duration_ms: step.duration_ms,
            error: step.error || null,
          }));
        }

        if (includeArtifacts) {
          // Cast to any to access optional URL properties that may exist at runtime
          const resultAny = result as any;
          resultData.artifacts = {
            screenshot_url: resultAny.screenshot_url || null,
            video_url: resultAny.video_url || null,
            trace_url: resultAny.trace_url || null,
          };
        }

        return resultData;
      }),
    };

    // Format-specific output
    if (format === 'json') {
      return {
        success: true,
        format: 'json',
        data: exportData,
        exported_at: new Date().toISOString(),
      };
    }

    if (format === 'csv') {
      // Generate CSV
      const csvLines: string[] = [];

      // Header
      const headers = ['test_id', 'test_name', 'status', 'duration_ms', 'started_at', 'completed_at', 'error_message'];
      if (includeArtifacts) {
        headers.push('screenshot_url', 'video_url', 'trace_url');
      }
      csvLines.push(headers.join(','));

      // Data rows
      for (const result of exportData.results) {
        const row = [
          `"${result.test_id}"`,
          `"${result.test_name.replace(/"/g, '""')}"`,
          result.status,
          result.duration_ms || '',
          result.started_at ? new Date(result.started_at).toISOString() : '',
          result.completed_at ? new Date(result.completed_at).toISOString() : '',
          result.error_message ? `"${result.error_message.replace(/"/g, '""').replace(/\n/g, ' ')}"` : '',
        ];
        if (includeArtifacts) {
          row.push(
            result.artifacts?.screenshot_url || '',
            result.artifacts?.video_url || '',
            result.artifacts?.trace_url || ''
          );
        }
        csvLines.push(row.join(','));
      }

      const csvContent = csvLines.join('\n');

      return {
        success: true,
        format: 'csv',
        data: csvContent,
        filename: `test-run-${runId}-${Date.now()}.csv`,
        content_type: 'text/csv',
        exported_at: new Date().toISOString(),
      };
    }

    if (format === 'junit' || format === 'junit-xml') {
      // Generate JUnit XML format
      const escapeXml = (str: string | null | undefined): string => {
        if (!str) return '';
        return str
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;')
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // Remove control characters
      };

      const testsCount = exportData.results.length;
      const failures = exportData.failed;
      const errors = exportData.error;
      const skipped = exportData.skipped;
      const totalTime = (exportData.duration_ms || 0) / 1000;

      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += `<testsuites name="${escapeXml(exportData.suite_name)}" tests="${testsCount}" failures="${failures}" errors="${errors}" skipped="${skipped}" time="${totalTime.toFixed(3)}">\n`;
      xml += `  <testsuite name="${escapeXml(exportData.suite_name)}" tests="${testsCount}" failures="${failures}" errors="${errors}" skipped="${skipped}" time="${totalTime.toFixed(3)}" timestamp="${exportData.started_at || new Date().toISOString()}">\n`;
      xml += `    <properties>\n`;
      xml += `      <property name="browser" value="${escapeXml(exportData.browser)}"/>\n`;
      xml += `      <property name="viewport" value="${escapeXml(exportData.viewport)}"/>\n`;
      xml += `      <property name="run_id" value="${escapeXml(exportData.run_id)}"/>\n`;
      xml += `    </properties>\n`;

      for (const result of exportData.results) {
        const testTime = (result.duration_ms || 0) / 1000;
        const className = escapeXml(exportData.suite_name);
        const testName = escapeXml(result.test_name);

        xml += `    <testcase classname="${className}" name="${testName}" time="${testTime.toFixed(3)}">\n`;

        if (result.status === 'failed') {
          xml += `      <failure message="${escapeXml(result.error_message)}" type="AssertionError">\n`;
          xml += `        ${escapeXml(result.error_message)}\n`;
          xml += `      </failure>\n`;
        } else if (result.status === 'error') {
          xml += `      <error message="${escapeXml(result.error_message)}" type="Error">\n`;
          xml += `        ${escapeXml(result.error_message)}\n`;
          xml += `      </error>\n`;
        } else if (result.status === 'skipped') {
          xml += `      <skipped/>\n`;
        }

        // Add system-out for artifacts if available
        if (includeArtifacts && result.artifacts) {
          xml += `      <system-out>\n`;
          if (result.artifacts.screenshot_url) {
            xml += `Screenshot: ${escapeXml(result.artifacts.screenshot_url)}\n`;
          }
          if (result.artifacts.video_url) {
            xml += `Video: ${escapeXml(result.artifacts.video_url)}\n`;
          }
          if (result.artifacts.trace_url) {
            xml += `Trace: ${escapeXml(result.artifacts.trace_url)}\n`;
          }
          xml += `      </system-out>\n`;
        }

        xml += `    </testcase>\n`;
      }

      xml += `  </testsuite>\n`;
      xml += `</testsuites>\n`;

      return {
        success: true,
        format: 'junit-xml',
        data: xml,
        filename: `test-run-${runId}-${Date.now()}.xml`,
        content_type: 'application/xml',
        exported_at: new Date().toISOString(),
      };
    }

    // Should not reach here
    return reply.status(400).send({
      error: 'Bad Request',
      message: 'Unsupported format',
    });
  });
}
