/**
 * K6 Load Test Executor
 * Extracted from test-executor.ts for Feature #1356 (Backend file size limit)
 * Updated for Feature #2076: Implement Real K6 Load Test Execution
 *
 * This module handles K6 load test execution:
 * - Script validation (imports, syntax, thresholds)
 * - Real K6 execution via child_process
 * - Virtual user simulation
 * - Response time tracking
 * - Threshold evaluation
 * - Custom metrics detection
 */

import { Page, Browser } from 'playwright';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

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
  CustomMetricDefinition,
} from './k6-helpers';

// Environment variable to control K6 execution mode
// Set USE_REAL_K6=false for CI/testing environments without K6 installed
const USE_REAL_K6 = process.env.USE_REAL_K6 !== 'false';

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
 * K6 JSON summary output structure
 */
interface K6Summary {
  metrics: {
    http_reqs?: { count: number; rate: number };
    http_req_duration?: { avg: number; min: number; med: number; max: number; 'p(90)': number; 'p(95)': number; 'p(99)': number };
    http_req_failed?: { value: number };
    vus?: { value: number; min: number; max: number };
    vus_max?: { value: number };
    iterations?: { count: number; rate: number };
    data_received?: { count: number; rate: number };
    data_sent?: { count: number; rate: number };
    [key: string]: any;
  };
  root_group?: {
    checks?: Record<string, { name: string; passes: number; fails: number }>;
  };
}

/**
 * Generate a K6 script from test configuration
 */
function generateK6Script(test: LoadTestConfig): string {
  const virtualUsers = test.virtual_users || 10;
  const duration = test.duration || 30;
  const rampUpTime = test.ramp_up_time || 5;

  // If user provided a custom script, use it
  if (test.k6_script) {
    return test.k6_script;
  }

  // Generate default K6 script
  const thresholdsConfig = test.k6_thresholds?.length
    ? JSON.stringify(
        test.k6_thresholds.reduce((acc, t) => {
          acc[t.metric] = [t.expression];
          return acc;
        }, {} as Record<string, string[]>),
        null,
        2
      )
    : `{
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  }`;

  return `
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '${rampUpTime}s', target: ${virtualUsers} },
    { duration: '${duration - rampUpTime * 2}s', target: ${virtualUsers} },
    { duration: '${rampUpTime}s', target: 0 },
  ],
  thresholds: ${thresholdsConfig},
};

export default function () {
  const res = http.get('${test.target_url}');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  sleep(1);
}
`;
}

/**
 * Execute K6 and parse results
 */
async function runK6(
  scriptPath: string,
  summaryPath: string,
  context: LoadTestContext,
  test: LoadTestConfig,
  totalDuration: number
): Promise<{ success: boolean; summary?: K6Summary; error?: string }> {
  const { runId, orgId, emitRunEvent } = context;

  return new Promise((resolve) => {
    const startTime = Date.now();
    let lastProgress = 0;

    console.log(`[K6] Starting real K6 execution: k6 run --summary-export=${summaryPath} ${scriptPath}`);

    const k6Process = spawn('k6', [
      'run',
      '--summary-export', summaryPath,
      scriptPath
    ], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    // Parse K6 stdout for progress updates
    k6Process.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      stdout += output;

      // Parse progress from K6 output (e.g., "running (0m30.0s), 10/10 VUs, 150 complete")
      const runningMatch = output.match(/running \((\d+)m(\d+(?:\.\d+)?)s\)/);
      const vusMatch = output.match(/(\d+)\/(\d+) VUs/);
      const iterationsMatch = output.match(/(\d+) complete/);

      if (runningMatch) {
        const minutes = parseInt(runningMatch[1]);
        const seconds = parseFloat(runningMatch[2]);
        const elapsedSeconds = minutes * 60 + seconds;
        const progress = Math.min(95, Math.floor((elapsedSeconds / totalDuration) * 100));

        if (progress > lastProgress) {
          lastProgress = progress;

          // Determine phase based on progress
          const phase = progress < 20 ? 'ramp_up' : progress > 80 ? 'ramp_down' : 'sustained';

          emitRunEvent(runId, orgId, 'step-progress', {
            testId: test.id,
            stepIndex: 0,
            stepId: 'load_test',
            phase,
            progress,
            currentVUs: vusMatch ? parseInt(vusMatch[1]) : test.virtual_users || 10,
            iterations: iterationsMatch ? parseInt(iterationsMatch[1]) : 0,
            elapsed_seconds: elapsedSeconds,
          });
        }
      }

      console.log(`[K6 stdout] ${output.trim()}`);
    });

    k6Process.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
      console.log(`[K6 stderr] ${data.toString().trim()}`);
    });

    k6Process.on('error', (err) => {
      console.error(`[K6] Process error: ${err.message}`);
      resolve({ success: false, error: `K6 process error: ${err.message}` });
    });

    k6Process.on('close', (code) => {
      const duration = Date.now() - startTime;
      console.log(`[K6] Process exited with code ${code} after ${duration}ms`);

      if (code !== 0 && code !== null) {
        // K6 returns non-zero when thresholds fail, which is still valid output
        console.log(`[K6] Non-zero exit code, checking for summary file...`);
      }

      // Try to read the summary file
      try {
        if (fs.existsSync(summaryPath)) {
          const summaryContent = fs.readFileSync(summaryPath, 'utf-8');
          const summary = JSON.parse(summaryContent) as K6Summary;
          resolve({ success: true, summary });
        } else {
          resolve({
            success: false,
            error: `K6 summary file not found. Exit code: ${code}. stderr: ${stderr}`
          });
        }
      } catch (parseError) {
        resolve({
          success: false,
          error: `Failed to parse K6 summary: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
        });
      }
    });

    // Set a timeout slightly longer than the test duration
    const timeout = (totalDuration + 60) * 1000; // Add 60s buffer
    setTimeout(() => {
      if (k6Process.exitCode === null) {
        console.log(`[K6] Timeout after ${timeout}ms, killing process`);
        k6Process.kill('SIGTERM');
        resolve({ success: false, error: `K6 process timed out after ${timeout}ms` });
      }
    }, timeout);
  });
}

/**
 * Convert K6 summary to our loadTestResults format
 */
function convertK6SummaryToResults(
  summary: K6Summary,
  test: LoadTestConfig,
  actualDuration: number
): any {
  const metrics = summary.metrics;
  const virtualUsers = test.virtual_users || 10;
  const configuredDuration = test.duration || 30;

  const totalRequests = metrics.http_reqs?.count || 0;
  const failedRate = metrics.http_req_failed?.value || 0;
  const failedRequests = Math.floor(totalRequests * failedRate);

  return {
    summary: {
      total_requests: totalRequests,
      failed_requests: failedRequests,
      success_rate: ((1 - failedRate) * 100).toFixed(2),
      requests_per_second: metrics.http_reqs?.rate?.toFixed(2) || '0',
      iterations: metrics.iterations?.count || 0,
      iterations_per_second: metrics.iterations?.rate?.toFixed(2) || '0',
    },
    response_times: {
      min: Math.floor(metrics.http_req_duration?.min || 0),
      avg: Math.floor(metrics.http_req_duration?.avg || 0),
      med: Math.floor(metrics.http_req_duration?.med || 0),
      p90: Math.floor(metrics.http_req_duration?.['p(90)'] || 0),
      p95: Math.floor(metrics.http_req_duration?.['p(95)'] || 0),
      p99: Math.floor(metrics.http_req_duration?.['p(99)'] || 0),
      max: Math.floor(metrics.http_req_duration?.max || 0),
    },
    virtual_users: {
      configured: virtualUsers,
      max_concurrent: metrics.vus_max?.value || metrics.vus?.max || virtualUsers,
    },
    duration: {
      configured: configuredDuration,
      actual: Math.floor(actualDuration / 1000),
      ramp_up: test.ramp_up_time || 5,
    },
    data_transfer: {
      received_bytes: metrics.data_received?.count || 0,
      sent_bytes: metrics.data_sent?.count || 0,
      received_rate: metrics.data_received?.rate || 0,
      sent_rate: metrics.data_sent?.rate || 0,
    },
    checks: Object.values(summary.root_group?.checks || {}).map((c: any) => ({
      name: c.name,
      passes: c.passes,
      fails: c.fails,
      success_rate: c.passes + c.fails > 0
        ? ((c.passes / (c.passes + c.fails)) * 100).toFixed(2)
        : '100.00',
    })),
    execution_mode: 'real_k6',
  };
}

/**
 * Generate simulated results (for CI/testing without K6 installed)
 */
function generateSimulatedResults(
  test: LoadTestConfig,
  customMetrics: CustomMetricDefinition[],
  serverError: any
): any {
  const virtualUsers = test.virtual_users || 10;
  const duration = test.duration || 30;
  const rampUpTime = test.ramp_up_time || 5;

  const totalRequests = virtualUsers * (duration / 10) * (50 + Math.floor(Math.random() * 50));
  const failureRate = serverError?.detected ? (serverError.failureRate / 100) : (Math.random() * 0.02);
  const failedRequests = Math.floor(totalRequests * failureRate);
  const avgResponseTime = Math.floor(Math.random() * 200 + 50);
  const p95ResponseTime = Math.floor(avgResponseTime * (1.5 + Math.random() * 0.5));
  const p99ResponseTime = Math.floor(p95ResponseTime * (1.2 + Math.random() * 0.3));

  const results: any = {
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
    execution_mode: 'simulated',
  };

  if (serverError?.detected) {
    results.server_unavailable = serverError;
  }

  return results;
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

  console.log(`[Load Test] Starting load test for ${test.name} (USE_REAL_K6=${USE_REAL_K6})`);

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
      execution_mode: USE_REAL_K6 ? 'real_k6' : 'simulated',
    });

    // Get test configuration
    const virtualUsers = test.virtual_users || 10;
    const duration = test.duration || 30;
    const rampUpTime = test.ramp_up_time || 5;
    const totalDuration = duration + rampUpTime; // Total expected runtime

    // Detect custom metrics
    const customMetrics = test.k6_script ? detectCustomMetrics(test.k6_script) : [];

    // Check for server unavailable simulation (for testing)
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

    // Execute K6 - either real or simulated
    if (USE_REAL_K6 && !serverError?.detected) {
      // Real K6 execution
      const tempDir = os.tmpdir();
      const scriptPath = path.join(tempDir, `k6-script-${runId}-${Date.now()}.js`);
      const summaryPath = path.join(tempDir, `k6-summary-${runId}-${Date.now()}.json`);

      try {
        // Generate and write K6 script
        const k6Script = generateK6Script(test);
        fs.writeFileSync(scriptPath, k6Script);
        console.log(`[K6] Script written to ${scriptPath}`);

        // Run K6
        const k6Result = await runK6(scriptPath, summaryPath, context, test, totalDuration);

        if (k6Result.success && k6Result.summary) {
          const actualDuration = Date.now() - loadTestStepStart;
          loadTestResults = convertK6SummaryToResults(k6Result.summary, test, actualDuration);

          // Determine pass/fail from actual metrics
          const successRate = parseFloat(loadTestResults.summary.success_rate);
          const p95 = loadTestResults.response_times.p95;

          if (successRate < 95) {
            testStatus = 'failed';
            testError = `Success rate ${successRate.toFixed(2)}% is below 95% threshold`;
          } else if (p95 > 1000) {
            testStatus = 'failed';
            testError = `P95 response time ${p95}ms exceeds 1000ms threshold`;
          }
        } else {
          // K6 execution failed, fall back to error state
          testStatus = 'error';
          testError = k6Result.error || 'K6 execution failed';
          loadTestResults = {
            error: testError,
            execution_mode: 'real_k6_failed',
          };
        }

        // Cleanup temp files
        try {
          if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);
          if (fs.existsSync(summaryPath)) fs.unlinkSync(summaryPath);
        } catch (cleanupError) {
          console.warn(`[K6] Failed to cleanup temp files: ${cleanupError}`);
        }

      } catch (k6Error) {
        console.error(`[K6] Execution error: ${k6Error}`);
        testStatus = 'error';
        testError = `K6 execution error: ${k6Error instanceof Error ? k6Error.message : 'Unknown error'}`;
        loadTestResults = {
          error: testError,
          execution_mode: 'real_k6_failed',
        };
      }

    } else {
      // Simulated K6 execution (for CI/testing or when server error is simulated)
      console.log(`[K6] Running in simulated mode`);

      // Simulate load test phases with progress updates
      const phases = [
        { name: 'ramp_up', duration: rampUpTime, progress: 20 },
        { name: 'sustained', duration: duration - rampUpTime * 2, progress: 70 },
        { name: 'ramp_down', duration: rampUpTime, progress: 95 },
      ];

      for (const phase of phases) {
        // In simulation mode, still wait a proportional amount (but capped for faster testing)
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
      loadTestResults = generateSimulatedResults(test, customMetrics, serverError);

      // Determine pass/fail
      const successRate = parseFloat(loadTestResults.summary.success_rate);
      if (successRate < 95) {
        testStatus = 'failed';
        testError = `Success rate ${successRate.toFixed(2)}% is below 95% threshold`;
      } else if (loadTestResults.response_times.p95 > 1000) {
        testStatus = 'failed';
        testError = `P95 response time ${loadTestResults.response_times.p95}ms exceeds 1000ms threshold`;
      }
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
