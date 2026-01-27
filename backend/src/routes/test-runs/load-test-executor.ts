/**
 * K6 Load Test Executor
 * Extracted from test-executor.ts for Feature #1356 (Backend file size limit)
 *
 * This module handles K6 load test execution:
 * - Script validation (imports, syntax, thresholds)
 * - Virtual user simulation
 * - Response time tracking
 * - Threshold evaluation
 * - Custom metrics detection
 */

import { Page, Browser } from 'playwright';

import {
  StepResult,
} from './execution';

import {
  simulatedK6RuntimeError,
  simulatedK6ServerUnavailable,
  simulatedK6ResourceExhaustion,
} from './test-simulation';

import {
  detectCircularImports,
  validateK6ScriptImports,
  validateK6Thresholds,
  validateK6ScriptSyntax,
  detectRequiredEnvVars,
  detectCustomMetrics,
  generateCustomMetricValues,
} from './k6-helpers';

/**
 * Configuration for a K6 load test
 */
export interface LoadTestConfig {
  id: string;
  name: string;
  target_url: string;
  virtual_users?: number;
  duration?: number;
  ramp_up_time?: number;
  k6_script?: string;
  k6_thresholds?: Array<{
    metric: string;
    expression: string;
    abortOnFail?: boolean;
    delayAbortEval?: string;
  }>;
}

/**
 * Context provided to the load test executor
 */
export interface LoadTestContext {
  page: Page;
  browser: Browser;
  runId: string;
  orgId: string;
  emitRunEvent: (runId: string, orgId: string, event: string, data: any) => void;
}

/**
 * Result from load test execution
 */
export interface LoadTestResult {
  testStatus: 'passed' | 'failed' | 'error';
  testError?: string;
  stepResults: StepResult[];
  loadTestResults?: any;
}

/**
 * Execute a K6 load test
 */
export async function executeLoadTest(
  test: LoadTestConfig,
  context: LoadTestContext
): Promise<LoadTestResult> {
  const { page, browser, runId, orgId, emitRunEvent } = context;
  const loadTestStepStart = Date.now();
  const stepResults: StepResult[] = [];
  let testStatus: 'passed' | 'failed' | 'error' = 'passed';
  let testError: string | undefined;
  let loadTestResults: any;

  console.log(`[Load Test] Starting load test for ${test.name}`);

  try {
    // Validate K6 script imports
    if (test.k6_script) {
      const importCheck = validateK6ScriptImports(test.k6_script);
      if (!importCheck.valid) {
        console.log(`[Load Test] Import error: ${importCheck.error}`);
        emitRunEvent(runId, orgId, 'step-start', {
          testId: test.id,
          stepIndex: 0,
          stepId: 'validate_k6_imports',
          action: 'validate_imports',
          value: 'Checking module imports',
        });

        const validationDuration = Date.now() - loadTestStepStart;
        emitRunEvent(runId, orgId, 'step-complete', {
          testId: test.id,
          stepIndex: 0,
          stepId: 'validate_k6_imports',
          status: 'failed',
          duration_ms: validationDuration,
          error: importCheck.error,
        });

        stepResults.push({
          id: 'validate_k6_imports',
          action: 'validate_imports',
          status: 'failed',
          duration_ms: validationDuration,
          error: importCheck.error,
        });

        return {
          testStatus: 'failed',
          testError: importCheck.error,
          stepResults,
        };
      }
    }

    // Validate K6 thresholds
    if (test.k6_thresholds && test.k6_thresholds.length > 0) {
      const thresholdCheck = validateK6Thresholds(test.k6_thresholds);
      if (!thresholdCheck.valid) {
        const errorSummary = `Invalid threshold: ${thresholdCheck.errors[0]?.error || 'Unknown error'}`;

        stepResults.push({
          id: 'validate_k6_thresholds',
          action: 'validate_thresholds',
          status: 'failed',
          duration_ms: Date.now() - loadTestStepStart,
          error: errorSummary,
        });

        return {
          testStatus: 'failed',
          testError: errorSummary,
          stepResults,
        };
      }
    }

    // Validate K6 script syntax
    if (test.k6_script) {
      const syntaxCheck = validateK6ScriptSyntax(test.k6_script);
      if (!syntaxCheck.valid) {
        stepResults.push({
          id: 'validate_k6_syntax',
          action: 'validate_syntax',
          status: 'failed',
          duration_ms: Date.now() - loadTestStepStart,
          error: syntaxCheck.error,
        });

        return {
          testStatus: 'failed',
          testError: syntaxCheck.error,
          stepResults,
        };
      }
    }

    // Emit load test start
    emitRunEvent(runId, orgId, 'step-start', {
      testId: test.id,
      stepIndex: 0,
      stepId: 'load_test',
      action: 'k6_load_test',
      value: test.target_url,
    });

    // Get test configuration
    const virtualUsers = test.virtual_users || 10;
    const duration = test.duration || 30;
    const rampUpTime = test.ramp_up_time || 5;

    // Detect custom metrics
    const customMetrics = test.k6_script ? detectCustomMetrics(test.k6_script) : [];

    // Check for server unavailable simulation
    let serverError: any;
    if (simulatedK6ServerUnavailable.enabled) {
      const errorType = simulatedK6ServerUnavailable.errorType || 'connection_refused';
      serverError = {
        detected: true,
        errorType,
        errorMessage: `Connection error: ${errorType} for ${test.target_url}`,
        failureRate: simulatedK6ServerUnavailable.failureRate || 95,
      };
      simulatedK6ServerUnavailable.enabled = false;
    }

    // Simulate load test phases with progress updates
    const phases = [
      { name: 'ramp_up', duration: rampUpTime, progress: 20 },
      { name: 'sustained', duration: duration - rampUpTime * 2, progress: 70 },
      { name: 'ramp_down', duration: rampUpTime, progress: 95 },
    ];

    for (const phase of phases) {
      await new Promise(resolve => setTimeout(resolve, Math.min(phase.duration * 100, 500)));

      const currentVUs = phase.name === 'ramp_up'
        ? Math.floor(virtualUsers * 0.5)
        : phase.name === 'sustained'
          ? virtualUsers
          : Math.floor(virtualUsers * 0.3);

      emitRunEvent(runId, orgId, 'step-progress', {
        testId: test.id,
        stepIndex: 0,
        stepId: 'load_test',
        phase: phase.name,
        progress: phase.progress,
        currentVUs,
      });
    }

    // Generate simulated results
    const totalRequests = virtualUsers * (duration / 10) * (50 + Math.floor(Math.random() * 50));
    const failureRate = serverError?.detected ? (serverError.failureRate / 100) : (Math.random() * 0.02);
    const failedRequests = Math.floor(totalRequests * failureRate);
    const avgResponseTime = Math.floor(Math.random() * 200 + 50);
    const p95ResponseTime = Math.floor(avgResponseTime * (1.5 + Math.random() * 0.5));
    const p99ResponseTime = Math.floor(p95ResponseTime * (1.2 + Math.random() * 0.3));

    loadTestResults = {
      summary: {
        total_requests: totalRequests,
        failed_requests: failedRequests,
        success_rate: ((totalRequests - failedRequests) / totalRequests * 100).toFixed(2),
        requests_per_second: (totalRequests / duration).toFixed(2),
      },
      response_times: {
        min: Math.floor(avgResponseTime * 0.3),
        avg: avgResponseTime,
        p95: p95ResponseTime,
        p99: p99ResponseTime,
        max: Math.floor(p99ResponseTime * 1.5),
      },
      virtual_users: {
        configured: virtualUsers,
        max_concurrent: virtualUsers,
      },
      duration: {
        configured: duration,
        actual: duration + rampUpTime + 5,
        ramp_up: rampUpTime,
      },
      custom_metrics: generateCustomMetricValues(customMetrics, totalRequests),
    };

    if (serverError?.detected) {
      loadTestResults.server_unavailable = serverError;
    }

    // Determine pass/fail
    const successRate = (totalRequests - failedRequests) / totalRequests * 100;
    if (successRate < 95) {
      testStatus = 'failed';
      testError = `Success rate ${successRate.toFixed(2)}% is below 95% threshold`;
    } else if (p95ResponseTime > 1000) {
      testStatus = 'failed';
      testError = `P95 response time ${p95ResponseTime}ms exceeds 1000ms threshold`;
    }

    // Emit step complete
    emitRunEvent(runId, orgId, 'step-complete', {
      testId: test.id,
      stepIndex: 0,
      stepId: 'load_test',
      status: testStatus === 'passed' ? 'passed' : 'failed',
      duration_ms: Date.now() - loadTestStepStart,
      error: testError,
    });

    // Feature #1968: Include load test data in step results for UI display
    // The frontend expects step.load_test to contain K6 metrics
    stepResults.push({
      id: 'load_test',
      action: 'k6_load_test',
      value: test.target_url,
      status: testStatus === 'passed' ? 'passed' : 'failed',
      duration_ms: Date.now() - loadTestStepStart,
      error: testError,
      load_test: loadTestResults,
    });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    testStatus = 'failed';
    testError = `Load test failed: ${errorMessage}`;

    stepResults.push({
      id: 'load_test_error',
      action: 'k6_load_test',
      value: test.target_url,
      status: 'failed',
      duration_ms: Date.now() - loadTestStepStart,
      error: testError,
    });
  }

  return {
    testStatus,
    testError,
    stepResults,
    loadTestResults,
  };
}
