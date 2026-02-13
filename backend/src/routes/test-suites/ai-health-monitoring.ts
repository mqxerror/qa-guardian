// Test Suites Module - AI Health Monitoring Routes
// Feature #580: Proactive AI health monitoring for test suites
// Analyzes suite-level trends and generates recommendations

import { FastifyInstance } from 'fastify';
import { authenticate, getOrganizationId, type JwtPayload } from '../../middleware/auth.js';
import { logAuditEntry } from '../audit-logs.js';
import { listTests } from './stores.js';
import { getTestRunMetadataForSuite } from '../../services/repositories/test-runs.js';
import { createLogger } from '../../services/logger.js';

import { sendError } from '../../utils/errors.js';
const log = createLogger('ai-health-monitoring');

// ============================================================
// Types
// ============================================================

interface HealthCheckParams {
  suiteId: string;
}

interface HealthRecommendation {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  category: 'pass_rate' | 'flakiness' | 'duration' | 'coverage' | 'recency';
  title: string;
  description: string;
  suggested_action: string;
  affected_tests?: string[];
}

interface SuiteHealthReport {
  suite_id: string;
  generated_at: string;
  metrics: {
    total_tests: number;
    tests_with_results: number;
    pass_rate: number;
    avg_duration_ms: number;
    duration_cv: number;
    flaky_test_count: number;
    flakiness_rate: number;
    stale_test_count: number;
    failing_tests: string[];
  };
  health_score: number;
  trend: 'improving' | 'stable' | 'degrading';
  recommendations: HealthRecommendation[];
  ai_summary: string;
}

// ============================================================
// Helper Functions
// ============================================================

function generateRecommendationId(): string {
  return `rec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Analyze suite health from test data and generate recommendations
 */
function analyzeSuiteHealth(
  suiteId: string,
  tests: Array<{
    id: string;
    name: string;
    last_result?: string | null;
    avg_duration_ms?: number | null;
    run_count?: number | null;
    last_run_at?: string | null;
  }>
): SuiteHealthReport {
  const now = Date.now();
  const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

  // --- Metrics calculation ---
  const testsWithResults = tests.filter(t => t.last_result);
  const passedTests = tests.filter(t => t.last_result === 'passed');
  const failedTests = tests.filter(t => t.last_result === 'failed' || t.last_result === 'error');
  const passRate = testsWithResults.length > 0
    ? Math.round((passedTests.length / testsWithResults.length) * 100)
    : 0;

  // Duration analysis
  const durationsMs = tests
    .map(t => t.avg_duration_ms)
    .filter((d): d is number => d != null && d > 0);
  const avgDuration = durationsMs.length > 0
    ? Math.round(durationsMs.reduce((a, b) => a + b, 0) / durationsMs.length)
    : 0;

  // Coefficient of variation for duration stability
  let durationCv = 0;
  if (durationsMs.length >= 2 && avgDuration > 0) {
    const variance = durationsMs.reduce((sum, d) => sum + Math.pow(d - avgDuration, 2), 0) / durationsMs.length;
    durationCv = Math.sqrt(variance) / avgDuration;
  }

  // Flakiness detection: tests with runs > 1 that have failed/error status
  const testsWithMultipleRuns = tests.filter(t => (t.run_count || 0) > 1);
  const flakyTests = testsWithMultipleRuns.filter(
    t => t.last_result === 'failed' || t.last_result === 'error'
  );
  const flakinessRate = testsWithMultipleRuns.length > 0
    ? Math.round((flakyTests.length / testsWithMultipleRuns.length) * 100)
    : 0;

  // Stale tests: not run within 14 days
  const staleTests = tests.filter(t => {
    if (!t.last_run_at) return true;
    const lastRun = new Date(t.last_run_at).getTime();
    return (now - lastRun) > FOURTEEN_DAYS_MS;
  });

  // --- Health score (BMAD R24.1 weights) ---
  const passRateScore = passRate;
  const durationStabilityScore = Math.max(0, Math.min(100, Math.round((1 - durationCv) * 100)));
  const flakinessScore = 100 - flakinessRate;

  // Recency score
  const lastRunTimes = tests
    .map(t => t.last_run_at ? new Date(t.last_run_at).getTime() : 0)
    .filter(t => t > 0);
  let recencyScore = 0;
  if (lastRunTimes.length > 0) {
    const mostRecent = Math.max(...lastRunTimes);
    recencyScore = Math.max(0, Math.min(100, Math.round(100 * Math.exp(-(now - mostRecent) / FOURTEEN_DAYS_MS))));
  }

  const healthScore = Math.round(
    passRateScore * 0.50 +
    flakinessScore * 0.20 +
    recencyScore * 0.20 +
    durationStabilityScore * 0.10
  );

  // --- Trend determination ---
  let trend: 'improving' | 'stable' | 'degrading' = 'stable';
  if (passRate < 70 || flakinessRate > 30) trend = 'degrading';
  else if (passRate >= 90 && flakinessRate <= 10) trend = 'improving';

  // --- Generate recommendations ---
  const recommendations: HealthRecommendation[] = [];

  // Pass rate recommendations
  if (passRate < 50) {
    recommendations.push({
      id: generateRecommendationId(),
      severity: 'critical',
      category: 'pass_rate',
      title: 'Critical: Less than half of tests are passing',
      description: `Only ${passRate}% of tests are passing (${passedTests.length}/${testsWithResults.length}). This indicates systemic test failures that need immediate attention.`,
      suggested_action: 'Investigate the failing tests and fix the root causes. Consider prioritizing tests by business impact.',
      affected_tests: failedTests.slice(0, 10).map(t => t.name),
    });
  } else if (passRate < 80) {
    recommendations.push({
      id: generateRecommendationId(),
      severity: 'warning',
      category: 'pass_rate',
      title: 'Pass rate below 80%',
      description: `${passRate}% pass rate with ${failedTests.length} failing test${failedTests.length !== 1 ? 's' : ''}. Review failing tests for quick wins.`,
      suggested_action: 'Review failing tests and address common failure patterns. Look for environment issues or flaky selectors.',
      affected_tests: failedTests.slice(0, 5).map(t => t.name),
    });
  }

  // Flakiness recommendations
  if (flakinessRate > 30) {
    recommendations.push({
      id: generateRecommendationId(),
      severity: 'critical',
      category: 'flakiness',
      title: 'High flakiness detected',
      description: `${flakinessRate}% of multi-run tests are flaky (${flakyTests.length} tests). Flaky tests erode confidence in your test suite.`,
      suggested_action: 'Add explicit waits, stabilize selectors, and consider isolating test data. Use the Flakiness Trend panel to identify patterns.',
      affected_tests: flakyTests.slice(0, 5).map(t => t.name),
    });
  } else if (flakinessRate > 15) {
    recommendations.push({
      id: generateRecommendationId(),
      severity: 'warning',
      category: 'flakiness',
      title: 'Moderate flakiness in test suite',
      description: `${flakinessRate}% flakiness rate. This may indicate timing issues or unstable test environments.`,
      suggested_action: 'Review flaky tests for race conditions and add proper wait conditions.',
      affected_tests: flakyTests.slice(0, 3).map(t => t.name),
    });
  }

  // Duration recommendations
  if (durationCv > 0.8) {
    recommendations.push({
      id: generateRecommendationId(),
      severity: 'warning',
      category: 'duration',
      title: 'High duration variability',
      description: `Test durations vary significantly (CV: ${durationCv.toFixed(2)}). This may indicate performance regressions or environment instability.`,
      suggested_action: 'Profile slow tests and check for external dependencies causing variability.',
    });
  }

  if (avgDuration > 30000) {
    recommendations.push({
      id: generateRecommendationId(),
      severity: 'info',
      category: 'duration',
      title: 'Average test duration exceeds 30 seconds',
      description: `Average duration is ${(avgDuration / 1000).toFixed(1)}s. Consider optimizing slow tests for faster feedback.`,
      suggested_action: 'Identify the slowest tests and optimize with parallel execution, data mocking, or reduced scope.',
    });
  }

  // Stale test recommendations
  if (staleTests.length > 0 && tests.length > 0) {
    const stalePercent = Math.round((staleTests.length / tests.length) * 100);
    if (stalePercent > 50) {
      recommendations.push({
        id: generateRecommendationId(),
        severity: 'warning',
        category: 'recency',
        title: 'Majority of tests are stale',
        description: `${staleTests.length} of ${tests.length} tests (${stalePercent}%) haven't been run in the last 14 days.`,
        suggested_action: 'Schedule regular test runs or set up CI/CD integration to keep tests fresh.',
        affected_tests: staleTests.slice(0, 5).map(t => t.name),
      });
    } else if (stalePercent > 20) {
      recommendations.push({
        id: generateRecommendationId(),
        severity: 'info',
        category: 'recency',
        title: 'Some tests are stale',
        description: `${staleTests.length} test${staleTests.length !== 1 ? 's' : ''} haven't been run recently.`,
        suggested_action: 'Consider running stale tests to verify they still pass.',
        affected_tests: staleTests.slice(0, 3).map(t => t.name),
      });
    }
  }

  // Coverage recommendations
  if (tests.length < 3) {
    recommendations.push({
      id: generateRecommendationId(),
      severity: 'info',
      category: 'coverage',
      title: 'Low test count',
      description: `Suite has only ${tests.length} test${tests.length !== 1 ? 's' : ''}. Consider adding more tests for better coverage.`,
      suggested_action: 'Use the AI Test Generator to quickly create additional test cases.',
    });
  }

  // If everything looks good
  if (recommendations.length === 0) {
    recommendations.push({
      id: generateRecommendationId(),
      severity: 'info',
      category: 'pass_rate',
      title: 'Suite is healthy',
      description: `All metrics are within healthy ranges. ${passRate}% pass rate, ${flakinessRate}% flakiness, ${(avgDuration / 1000).toFixed(1)}s avg duration.`,
      suggested_action: 'Continue monitoring. Consider adding more edge case tests.',
    });
  }

  // --- AI Summary ---
  const criticalCount = recommendations.filter(r => r.severity === 'critical').length;
  const warningCount = recommendations.filter(r => r.severity === 'warning').length;

  let aiSummary: string;
  if (criticalCount > 0) {
    aiSummary = `⚠️ Suite needs attention: ${criticalCount} critical issue${criticalCount !== 1 ? 's' : ''} detected. ` +
      `Pass rate is ${passRate}% with ${failedTests.length} failing test${failedTests.length !== 1 ? 's' : ''}. ` +
      `Focus on fixing failures and reducing flakiness (${flakinessRate}%).`;
  } else if (warningCount > 0) {
    aiSummary = `Suite has ${warningCount} area${warningCount !== 1 ? 's' : ''} for improvement. ` +
      `Pass rate: ${passRate}%, Flakiness: ${flakinessRate}%, Avg duration: ${(avgDuration / 1000).toFixed(1)}s. ` +
      `Address warnings to improve overall health score from ${healthScore} to 80+.`;
  } else {
    aiSummary = `✅ Suite is in good health (score: ${healthScore}). ` +
      `${passRate}% pass rate across ${tests.length} tests. ` +
      `Keep monitoring and consider expanding test coverage.`;
  }

  return {
    suite_id: suiteId,
    generated_at: new Date().toISOString(),
    metrics: {
      total_tests: tests.length,
      tests_with_results: testsWithResults.length,
      pass_rate: passRate,
      avg_duration_ms: avgDuration,
      duration_cv: parseFloat(durationCv.toFixed(3)),
      flaky_test_count: flakyTests.length,
      flakiness_rate: flakinessRate,
      stale_test_count: staleTests.length,
      failing_tests: failedTests.map(t => t.name),
    },
    health_score: healthScore,
    trend,
    recommendations,
    ai_summary: aiSummary,
  };
}

// ============================================================
// Routes
// ============================================================

export async function aiHealthMonitoringRoutes(app: FastifyInstance) {
  /**
   * POST /api/v1/suites/:suiteId/ai-health-check
   * Feature #580: Run proactive AI health analysis on a test suite
   */
  app.post<{ Params: HealthCheckParams }>(
    '/api/v1/suites/:suiteId/ai-health-check',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['AI', 'Test Suites'],
        summary: 'Run AI health check on a test suite',
        description: 'Analyzes suite-wide trends (pass rate, flakiness, duration regressions, score drift) and generates proactive recommendations.',
        params: {
          type: 'object',
          required: ['suiteId'],
          properties: {
            suiteId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              report: {
                type: 'object',
                properties: {
                  suite_id: { type: 'string' },
                  generated_at: { type: 'string' },
                  health_score: { type: 'number' },
                  trend: { type: 'string' },
                  ai_summary: { type: 'string' },
                  metrics: { type: 'object' },
                  recommendations: { type: 'array' },
                },
              },
            },
          },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { suiteId } = request.params;
      const user = request.user as JwtPayload;
      const orgId = getOrganizationId(request);

      log.info({ suiteId, userId: user.id }, 'AI health check requested');

      // Get all tests in the suite
      const suiteTests = await listTests(suiteId);

      if (suiteTests.length === 0) {
        return sendError(reply, 404, 'NOT_FOUND', 'No tests found for this suite');
      }

      // Get run metadata (last_result, run_count, avg_duration, last_run_at) for each test
      const testIds = suiteTests.map(t => t.id);
      const runMetadataMap = await getTestRunMetadataForSuite(suiteId, testIds, orgId);

      // Generate the health report
      const report = analyzeSuiteHealth(suiteId, suiteTests.map(t => {
        const metadata = runMetadataMap.get(t.id);
        return {
          id: t.id,
          name: t.name,
          last_result: metadata?.last_result as string || null,
          avg_duration_ms: metadata?.avg_duration_ms || null,
          run_count: metadata?.run_count || null,
          last_run_at: metadata?.last_run_at ? (metadata.last_run_at instanceof Date ? metadata.last_run_at.toISOString() : String(metadata.last_run_at)) : null,
        };
      }));

      // Audit log
      logAuditEntry(request, 'read', 'suite_health_check', suiteId, `AI health check: score=${report.health_score}, trend=${report.trend}`, {
        health_score: report.health_score,
        recommendations_count: report.recommendations.length,
        user_id: user.id,
      });

      return {
        success: true,
        report,
      };
    }
  );
}
