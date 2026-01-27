/**
 * Test Runs - Webhook Events Module
 * Feature #1283-1315: Webhook event sending functions
 *
 * Extracted from test-runs.ts for code quality (#1356)
 *
 * This module contains functions for sending webhook events like:
 * - test.run.started
 * - test.run.completed
 * - test.run.failed
 * - test.run.passed
 * - visual.diff.detected
 * - performance.budget.exceeded
 * - baseline.approved
 * - schedule.triggered
 * - flaky.test.detected
 * - accessibility.issue.found
 */

import { projects } from '../projects';
import {
  WebhookSubscription,
  webhookSubscriptions,
  subscriptionMatchesProject,
  subscriptionMatchesAnyResultStatus,
  deliverOrBatchWebhook,
} from './webhooks';
import { webhookLog, WebhookLogEntry } from './alerts';

// ============================================================================
// Types
// ============================================================================

// Test Run interface (subset needed for webhook events)
export interface WebhookTestRun {
  id: string;
  suite_id: string;
  organization_id: string;
  browser: string;
  branch?: string;
  browser_version?: string;
  status: 'pending' | 'running' | 'paused' | 'passed' | 'failed' | 'error' | 'cancelled' | 'cancelling';
  started_at?: Date;
  completed_at?: Date;
  duration_ms?: number;
  created_at: Date;
  error?: string;
}

// Test Run Result interface (subset needed for webhook events)
export interface WebhookTestRunResult {
  test_id: string;
  test_name?: string;
  status: 'passed' | 'failed' | 'error' | 'skipped' | 'running';
  error?: string;
  duration_ms?: number;
  visual_comparison?: {
    diffPercentage?: number;
    mismatchedPixels?: number;
    comparisonStatus?: string;
    message?: string;
  };
  performance_metrics?: {
    fcp?: number;
    lcp?: number;
    tti?: number;
    cls?: number;
  };
  lighthouse_scores?: {
    performance?: number;
    accessibility?: number;
    bestPractices?: number;
    seo?: number;
  };
}

// Suite info for webhook events
export interface WebhookSuiteInfo {
  id: string;
  name: string;
  project_id: string;
}

// Trigger info for webhook events
export interface WebhookTriggerInfo {
  type: 'manual' | 'scheduled' | 'api' | 'github_pr';
  triggered_by?: string;
  schedule_id?: string;
  pr_number?: number;
}

// ============================================================================
// Feature #1295: Webhook Delivery Logging
// ============================================================================

/**
 * Log webhook delivery details to the webhookLog store
 * This is used for tracking individual webhook deliveries in the alert-style log
 */
export function logWebhookDeliveryToAlertLog(params: {
  deliveryId: string;
  subscription: WebhookSubscription;
  eventType: string;
  payload: Record<string, any>;
  headers: Record<string, string>;
  attempt: number;
  maxAttempts: number;
  startTime: number;
  success: boolean;
  responseStatus?: number;
  responseBody?: string;
  responseHeaders?: Record<string, string>;
  error?: string;
  context?: { runId?: string; projectId?: string };
}): void {
  const duration_ms = Date.now() - params.startTime;

  // Create sanitized headers (hide secret/signature values)
  const sanitizedHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(params.headers)) {
    if (key.toLowerCase().includes('secret') || key.toLowerCase().includes('signature')) {
      sanitizedHeaders[key] = '[REDACTED]';
    } else {
      sanitizedHeaders[key] = value;
    }
  }

  const logEntry: WebhookLogEntry = {
    id: `${params.deliveryId}_attempt_${params.attempt}`,
    timestamp: new Date(),
    url: params.subscription.url,
    method: 'POST',
    headers: sanitizedHeaders,
    payload: params.payload,
    event: params.eventType,
    runId: params.context?.runId || '',
    projectId: params.context?.projectId || '',
    subscriptionId: params.subscription.id,
    subscriptionName: params.subscription.name,
    success: params.success,
    responseStatus: params.responseStatus,
    responseBody: params.responseBody,
    responseHeaders: params.responseHeaders,
    duration_ms,
    attempt: params.attempt,
    max_attempts: params.maxAttempts,
    error: params.error,
  };

  webhookLog.unshift(logEntry);

  // Keep only last 500 webhook logs (increased for detailed logging)
  if (webhookLog.length > 500) {
    webhookLog.pop();
  }
}

// ============================================================================
// Feature #1283: Webhook event: test.run.started
// ============================================================================

/**
 * Send test.run.started webhook to all subscribed endpoints
 */
export async function sendRunStartedWebhook(
  run: WebhookTestRun,
  suite: WebhookSuiteInfo,
  triggerInfo: WebhookTriggerInfo
): Promise<void> {
  const orgId = run.organization_id;

  // Find all enabled webhook subscriptions for this organization that include 'test.run.started'
  const subscriptions = Array.from(webhookSubscriptions.values()).filter(sub =>
    sub.organization_id === orgId &&
    sub.enabled &&
    sub.events.includes('test.run.started') &&
    subscriptionMatchesProject(sub, suite.project_id)
  );

  if (subscriptions.length === 0) {
    console.log('[WEBHOOK] No subscriptions for test.run.started event');
    return;
  }

  // Get project info
  const project = projects.get(suite.project_id);
  const projectName = project?.name || 'Unknown Project';

  // Build payload for test.run.started event
  const payload = {
    event: 'test.run.started',
    timestamp: new Date().toISOString(),
    run: {
      id: run.id,
      suite_id: run.suite_id,
      browser: run.browser,
      status: run.status,
      started_at: run.started_at?.toISOString(),
      created_at: run.created_at.toISOString(),
    },
    suite: {
      id: suite.id,
      name: suite.name,
    },
    project: {
      id: suite.project_id,
      name: projectName,
    },
    trigger: {
      type: triggerInfo.type,
      triggered_by: triggerInfo.triggered_by,
      schedule_id: triggerInfo.schedule_id,
      pr_number: triggerInfo.pr_number,
    },
    organization_id: orgId,
  };

  // Send to all matching subscriptions with retry support
  for (const subscription of subscriptions) {
    console.log('\n' + '='.repeat(80));
    console.log('[WEBHOOK] Sending test.run.started event');
    console.log('='.repeat(80));
    console.log(`Subscription: ${subscription.name} (${subscription.id})`);
    console.log(`URL: ${subscription.url}`);
    console.log(`Retry enabled: ${subscription.retry_enabled ?? true}, Max retries: ${subscription.max_retries ?? 5}`);
    console.log('Payload:');
    console.log(JSON.stringify(payload, null, 2));
    console.log('='.repeat(80) + '\n');

    await deliverOrBatchWebhook(subscription, payload, 'test.run.started', {
      runId: run.id,
      projectId: suite.project_id,
    });
  }
}

// ============================================================================
// Feature #1284: Webhook event: test.run.completed
// ============================================================================

/**
 * Send test.run.completed webhook to all subscribed endpoints
 */
export async function sendRunCompletedWebhook(
  run: WebhookTestRun,
  suite: WebhookSuiteInfo,
  results: WebhookTestRunResult[]
): Promise<void> {
  const orgId = run.organization_id;

  // Find all enabled webhook subscriptions
  const subscriptions = Array.from(webhookSubscriptions.values()).filter(sub =>
    sub.organization_id === orgId &&
    sub.enabled &&
    sub.events.includes('test.run.completed') &&
    subscriptionMatchesProject(sub, suite.project_id) &&
    subscriptionMatchesAnyResultStatus(sub, results)
  );

  if (subscriptions.length === 0) {
    console.log('[WEBHOOK] No subscriptions for test.run.completed event');
    return;
  }

  // Get project info
  const project = projects.get(suite.project_id);
  const projectName = project?.name || 'Unknown Project';

  // Calculate summary statistics
  const passedTests = results.filter(r => r.status === 'passed');
  const failedTests = results.filter(r => r.status === 'failed');
  const errorTests = results.filter(r => r.status === 'error');
  const skippedTests = results.filter(r => r.status === 'skipped');
  const totalTests = results.length;
  const passRate = totalTests > 0 ? Math.round((passedTests.length / totalTests) * 100) : 0;

  // Build payload
  const payload = {
    event: 'test.run.completed',
    timestamp: new Date().toISOString(),
    run: {
      id: run.id,
      suite_id: run.suite_id,
      browser: run.browser,
      status: run.status,
      started_at: run.started_at?.toISOString(),
      completed_at: run.completed_at?.toISOString(),
      duration_ms: run.duration_ms,
      error: run.error,
    },
    suite: {
      id: suite.id,
      name: suite.name,
    },
    project: {
      id: suite.project_id,
      name: projectName,
    },
    summary: {
      total: totalTests,
      passed: passedTests.length,
      failed: failedTests.length,
      error: errorTests.length,
      skipped: skippedTests.length,
      pass_rate: passRate,
    },
    failed_tests: failedTests.map(t => ({
      id: t.test_id,
      name: t.test_name,
      error: t.error,
      duration_ms: t.duration_ms,
    })),
    organization_id: orgId,
  };

  // Send to all matching subscriptions
  for (const subscription of subscriptions) {
    console.log('\n' + '='.repeat(80));
    console.log('[WEBHOOK] Sending test.run.completed event');
    console.log('='.repeat(80));
    console.log(`Subscription: ${subscription.name} (${subscription.id})`);
    console.log(`URL: ${subscription.url}`);
    console.log(`Summary: ${passedTests.length}/${totalTests} passed (${passRate}%)`);
    console.log('='.repeat(80) + '\n');

    await deliverOrBatchWebhook(subscription, payload, 'test.run.completed', {
      runId: run.id,
      projectId: suite.project_id,
    });
  }
}

// ============================================================================
// Feature #1285: Webhook event: test.run.failed
// ============================================================================

/**
 * Send test.run.failed webhook to all subscribed endpoints
 */
export async function sendRunFailedWebhook(
  run: WebhookTestRun,
  suite: WebhookSuiteInfo,
  results: WebhookTestRunResult[]
): Promise<void> {
  const orgId = run.organization_id;

  // Find all enabled webhook subscriptions
  const subscriptions = Array.from(webhookSubscriptions.values()).filter(sub =>
    sub.organization_id === orgId &&
    sub.enabled &&
    sub.events.includes('test.run.failed') &&
    subscriptionMatchesProject(sub, suite.project_id)
  );

  if (subscriptions.length === 0) {
    console.log('[WEBHOOK] No subscriptions for test.run.failed event');
    return;
  }

  // Get project info
  const project = projects.get(suite.project_id);
  const projectName = project?.name || 'Unknown Project';

  // Get failed tests
  const failedTests = results.filter(r => r.status === 'failed' || r.status === 'error');
  const totalTests = results.length;

  // Build payload
  const payload = {
    event: 'test.run.failed',
    timestamp: new Date().toISOString(),
    run: {
      id: run.id,
      suite_id: run.suite_id,
      browser: run.browser,
      status: run.status,
      started_at: run.started_at?.toISOString(),
      completed_at: run.completed_at?.toISOString(),
      duration_ms: run.duration_ms,
      error: run.error,
    },
    suite: {
      id: suite.id,
      name: suite.name,
    },
    project: {
      id: suite.project_id,
      name: projectName,
    },
    summary: {
      total: totalTests,
      failed: failedTests.length,
      failure_rate: totalTests > 0 ? Math.round((failedTests.length / totalTests) * 100) : 0,
    },
    failed_tests: failedTests.map(t => ({
      id: t.test_id,
      name: t.test_name,
      status: t.status,
      error: t.error,
      duration_ms: t.duration_ms,
    })),
    organization_id: orgId,
  };

  // Send to all matching subscriptions
  for (const subscription of subscriptions) {
    console.log('\n' + '='.repeat(80));
    console.log('[WEBHOOK] Sending test.run.failed event');
    console.log('='.repeat(80));
    console.log(`Subscription: ${subscription.name} (${subscription.id})`);
    console.log(`URL: ${subscription.url}`);
    console.log(`Failed: ${failedTests.length}/${totalTests} tests`);
    console.log('='.repeat(80) + '\n');

    await deliverOrBatchWebhook(subscription, payload, 'test.run.failed', {
      runId: run.id,
      projectId: suite.project_id,
    });
  }
}

// ============================================================================
// Feature #1286: Webhook event: test.run.passed
// ============================================================================

/**
 * Send test.run.passed webhook to all subscribed endpoints
 */
export async function sendRunPassedWebhook(
  run: WebhookTestRun,
  suite: WebhookSuiteInfo,
  results: WebhookTestRunResult[]
): Promise<void> {
  const orgId = run.organization_id;

  // Find all enabled webhook subscriptions
  const subscriptions = Array.from(webhookSubscriptions.values()).filter(sub =>
    sub.organization_id === orgId &&
    sub.enabled &&
    sub.events.includes('test.run.passed') &&
    subscriptionMatchesProject(sub, suite.project_id)
  );

  if (subscriptions.length === 0) {
    console.log('[WEBHOOK] No subscriptions for test.run.passed event');
    return;
  }

  // Get project info
  const project = projects.get(suite.project_id);
  const projectName = project?.name || 'Unknown Project';

  const totalTests = results.length;
  const totalDuration = results.reduce((sum, r) => sum + (r.duration_ms || 0), 0);

  // Build payload
  const payload = {
    event: 'test.run.passed',
    timestamp: new Date().toISOString(),
    run: {
      id: run.id,
      suite_id: run.suite_id,
      browser: run.browser,
      status: run.status,
      started_at: run.started_at?.toISOString(),
      completed_at: run.completed_at?.toISOString(),
      duration_ms: run.duration_ms,
    },
    suite: {
      id: suite.id,
      name: suite.name,
    },
    project: {
      id: suite.project_id,
      name: projectName,
    },
    summary: {
      total: totalTests,
      passed: totalTests,
      pass_rate: 100,
      total_duration_ms: totalDuration,
      avg_test_duration_ms: totalTests > 0 ? Math.round(totalDuration / totalTests) : 0,
    },
    organization_id: orgId,
  };

  // Send to all matching subscriptions
  for (const subscription of subscriptions) {
    console.log('\n' + '='.repeat(80));
    console.log('[WEBHOOK] Sending test.run.passed event');
    console.log('='.repeat(80));
    console.log(`Subscription: ${subscription.name} (${subscription.id})`);
    console.log(`URL: ${subscription.url}`);
    console.log(`All ${totalTests} tests passed`);
    console.log('='.repeat(80) + '\n');

    await deliverOrBatchWebhook(subscription, payload, 'test.run.passed', {
      runId: run.id,
      projectId: suite.project_id,
    });
  }
}

// ============================================================================
// Feature #1306: Webhook event: visual.diff.detected
// ============================================================================

/**
 * Send visual.diff.detected webhook to all subscribed endpoints
 */
export async function sendVisualDiffWebhook(
  orgId: string,
  diffData: {
    test_id: string;
    test_name: string;
    suite_id: string;
    suite_name: string;
    project_id: string;
    run_id: string;
    viewport_id: string;
    branch: string;
    diff_percentage: number;
    mismatched_pixels: number;
    total_pixels: number;
    threshold: number;
    target_url?: string;
    screenshot_urls?: {
      baseline: string;
      actual: string;
      diff: string;
    };
  }
): Promise<void> {
  // Find all enabled webhook subscriptions
  const subscriptions = Array.from(webhookSubscriptions.values()).filter(sub =>
    sub.organization_id === orgId &&
    sub.enabled &&
    sub.events.includes('visual.diff.detected') &&
    subscriptionMatchesProject(sub, diffData.project_id)
  );

  if (subscriptions.length === 0) {
    console.log('[WEBHOOK] No subscriptions for visual.diff.detected event');
    return;
  }

  // Get project info
  const project = projects.get(diffData.project_id);
  const projectName = project?.name || 'Unknown Project';

  // Build payload
  const payload = {
    event: 'visual.diff.detected',
    timestamp: new Date().toISOString(),
    test: {
      id: diffData.test_id,
      name: diffData.test_name,
    },
    suite: {
      id: diffData.suite_id,
      name: diffData.suite_name,
    },
    project: {
      id: diffData.project_id,
      name: projectName,
    },
    run: {
      id: diffData.run_id,
    },
    visual_comparison: {
      viewport_id: diffData.viewport_id,
      branch: diffData.branch,
      diff_percentage: diffData.diff_percentage,
      mismatched_pixels: diffData.mismatched_pixels,
      total_pixels: diffData.total_pixels,
      threshold: diffData.threshold,
      exceeds_threshold: diffData.diff_percentage > diffData.threshold,
    },
    target_url: diffData.target_url,
    screenshot_urls: diffData.screenshot_urls,
    organization_id: orgId,
    review_url: `http://localhost:5173/visual-review?runId=${diffData.run_id}&testId=${diffData.test_id}`,
  };

  // Send to all matching subscriptions
  for (const sub of subscriptions) {
    console.log('\n' + '='.repeat(80));
    console.log('[WEBHOOK] Sending visual.diff.detected event');
    console.log('='.repeat(80));
    console.log(`Subscription: ${sub.name} (${sub.id})`);
    console.log(`Test: ${diffData.test_name}`);
    console.log(`Diff: ${diffData.diff_percentage.toFixed(2)}% (threshold: ${diffData.threshold}%)`);
    console.log('='.repeat(80) + '\n');

    await deliverOrBatchWebhook(sub, payload, 'visual.diff.detected', {
      runId: diffData.run_id,
      projectId: diffData.project_id,
    });
  }
}

// ============================================================================
// Feature #1307: Webhook event: performance.budget.exceeded
// ============================================================================

/**
 * Send performance.budget.exceeded webhook to all subscribed endpoints
 */
export async function sendPerformanceBudgetExceededWebhook(
  orgId: string,
  perfData: {
    test_id: string;
    test_name: string;
    suite_id: string;
    suite_name: string;
    project_id: string;
    run_id: string;
    target_url: string;
    violations: Array<{
      metric: string;
      actual: number;
      budget: number;
      unit: string;
      severity: 'warning' | 'error';
    }>;
    lighthouse_scores?: {
      performance: number;
      accessibility: number;
      bestPractices: number;
      seo: number;
    };
    core_web_vitals?: {
      fcp: number;
      lcp: number;
      cls: number;
      tti: number;
    };
  }
): Promise<void> {
  // Find all enabled webhook subscriptions
  const subscriptions = Array.from(webhookSubscriptions.values()).filter(sub =>
    sub.organization_id === orgId &&
    sub.enabled &&
    sub.events.includes('performance.budget.exceeded') &&
    subscriptionMatchesProject(sub, perfData.project_id)
  );

  if (subscriptions.length === 0) {
    console.log('[WEBHOOK] No subscriptions for performance.budget.exceeded event');
    return;
  }

  // Get project info
  const project = projects.get(perfData.project_id);
  const projectName = project?.name || 'Unknown Project';

  // Build payload
  const payload = {
    event: 'performance.budget.exceeded',
    timestamp: new Date().toISOString(),
    test: {
      id: perfData.test_id,
      name: perfData.test_name,
    },
    suite: {
      id: perfData.suite_id,
      name: perfData.suite_name,
    },
    project: {
      id: perfData.project_id,
      name: projectName,
    },
    run: {
      id: perfData.run_id,
    },
    target_url: perfData.target_url,
    violations: perfData.violations,
    violation_summary: {
      total: perfData.violations.length,
      errors: perfData.violations.filter(v => v.severity === 'error').length,
      warnings: perfData.violations.filter(v => v.severity === 'warning').length,
    },
    lighthouse_scores: perfData.lighthouse_scores,
    core_web_vitals: perfData.core_web_vitals,
    organization_id: orgId,
    details_url: `http://localhost:5173/runs/${perfData.run_id}?tab=performance`,
  };

  // Send to all matching subscriptions
  for (const sub of subscriptions) {
    console.log('\n' + '='.repeat(80));
    console.log('[WEBHOOK] Sending performance.budget.exceeded event');
    console.log('='.repeat(80));
    console.log(`Subscription: ${sub.name} (${sub.id})`);
    console.log(`Test: ${perfData.test_name}`);
    console.log(`Violations: ${perfData.violations.length}`);
    console.log('='.repeat(80) + '\n');

    await deliverOrBatchWebhook(sub, payload, 'performance.budget.exceeded', {
      runId: perfData.run_id,
      projectId: perfData.project_id,
    });
  }
}

// ============================================================================
// Feature #1310: Webhook event: baseline.approved
// ============================================================================

/**
 * Send baseline.approved webhook to all subscribed endpoints
 */
export async function sendBaselineApprovedWebhook(
  orgId: string,
  baselineData: {
    test_id: string;
    test_name: string;
    suite_id: string;
    suite_name: string;
    project_id: string;
    run_id: string;
    viewport_id: string;
    branch: string;
    approved_by: string;
    approved_by_user_id: string;
    approved_at: string;
    version: number;
    viewport?: {
      width: number;
      height: number;
      preset?: string;
    };
    browser?: {
      name: string;
      version?: string;
    };
  }
): Promise<void> {
  // Find all enabled webhook subscriptions
  const subscriptions = Array.from(webhookSubscriptions.values()).filter(sub =>
    sub.organization_id === orgId &&
    sub.enabled &&
    sub.events.includes('baseline.approved') &&
    subscriptionMatchesProject(sub, baselineData.project_id)
  );

  if (subscriptions.length === 0) {
    console.log('[WEBHOOK] No subscriptions for baseline.approved event');
    return;
  }

  // Get project info
  const project = projects.get(baselineData.project_id);
  const projectName = project?.name || 'Unknown Project';

  // Build payload
  const payload = {
    event: 'baseline.approved',
    timestamp: new Date().toISOString(),
    baseline: {
      test_id: baselineData.test_id,
      viewport_id: baselineData.viewport_id,
      branch: baselineData.branch,
      version: baselineData.version,
    },
    test: {
      id: baselineData.test_id,
      name: baselineData.test_name,
    },
    suite: {
      id: baselineData.suite_id,
      name: baselineData.suite_name,
    },
    project: {
      id: baselineData.project_id,
      name: projectName,
    },
    run: {
      id: baselineData.run_id,
    },
    approver: {
      email: baselineData.approved_by,
      user_id: baselineData.approved_by_user_id,
    },
    approved_at: baselineData.approved_at,
    viewport: baselineData.viewport,
    browser: baselineData.browser,
    organization_id: orgId,
    screenshot_urls: {
      baseline: `http://localhost:5173/api/v1/tests/${baselineData.test_id}/baseline?viewport=${baselineData.viewport_id}&branch=${baselineData.branch}`,
      test_details: `http://localhost:5173/tests/${baselineData.test_id}`,
    },
  };

  // Send to each subscription
  for (const subscription of subscriptions) {
    await deliverOrBatchWebhook(subscription, payload, 'baseline.approved', {
      runId: baselineData.run_id,
      projectId: baselineData.project_id,
    });
  }
}

// ============================================================================
// Feature #1312: Webhook event: schedule.triggered
// ============================================================================

/**
 * Send schedule.triggered webhook to all subscribed endpoints
 */
export async function sendScheduleTriggeredWebhook(
  orgId: string,
  scheduleData: {
    schedule_id: string;
    schedule_name: string;
    suite_id: string;
    suite_name: string;
    project_id: string;
    run_id: string;
    trigger_type: 'manual' | 'cron' | 'one_time';
    cron_expression?: string;
    next_run_at?: string;
    run_count: number;
    triggered_by?: string;
  }
): Promise<void> {
  // Find all enabled webhook subscriptions
  const subscriptions = Array.from(webhookSubscriptions.values()).filter(sub =>
    sub.organization_id === orgId &&
    sub.enabled &&
    sub.events.includes('schedule.triggered') &&
    subscriptionMatchesProject(sub, scheduleData.project_id)
  );

  if (subscriptions.length === 0) {
    console.log('[WEBHOOK] No subscriptions for schedule.triggered event');
    return;
  }

  // Get project info
  const project = projects.get(scheduleData.project_id);
  const projectName = project?.name || 'Unknown Project';

  // Build payload
  const payload = {
    event: 'schedule.triggered',
    timestamp: new Date().toISOString(),
    schedule: {
      id: scheduleData.schedule_id,
      name: scheduleData.schedule_name,
      trigger_type: scheduleData.trigger_type,
      cron_expression: scheduleData.cron_expression,
      run_count: scheduleData.run_count,
    },
    suite: {
      id: scheduleData.suite_id,
      name: scheduleData.suite_name,
    },
    project: {
      id: scheduleData.project_id,
      name: projectName,
    },
    run: {
      id: scheduleData.run_id,
    },
    next_run_at: scheduleData.next_run_at,
    triggered_by: scheduleData.triggered_by,
    organization_id: orgId,
  };

  // Send to each subscription
  for (const sub of subscriptions) {
    await deliverOrBatchWebhook(sub, payload, 'schedule.triggered', {
      runId: scheduleData.run_id,
      projectId: scheduleData.project_id,
    });
  }
}

// ============================================================================
// Feature #1313: Webhook event: flaky.test.detected
// ============================================================================

/**
 * Send flaky.test.detected webhook to all subscribed endpoints
 */
export async function sendFlakyTestWebhook(
  orgId: string,
  flakyData: {
    test_id: string;
    test_name: string;
    suite_id: string;
    suite_name: string;
    project_id: string;
    run_id: string;
    flakiness_score: number;
    failed_runs: number;
    total_runs: number;
    recent_failures: Array<{
      run_id: string;
      date: string;
      error?: string;
    }>;
    first_detected_at: string;
    quarantine_recommended: boolean;
  }
): Promise<void> {
  // Find all enabled webhook subscriptions
  const subscriptions = Array.from(webhookSubscriptions.values()).filter(sub =>
    sub.organization_id === orgId &&
    sub.enabled &&
    sub.events.includes('flaky.test.detected') &&
    subscriptionMatchesProject(sub, flakyData.project_id)
  );

  if (subscriptions.length === 0) {
    console.log('[WEBHOOK] No subscriptions for flaky.test.detected event');
    return;
  }

  // Get project info
  const project = projects.get(flakyData.project_id);
  const projectName = project?.name || 'Unknown Project';

  // Build payload
  const payload = {
    event: 'flaky.test.detected',
    timestamp: new Date().toISOString(),
    test: {
      id: flakyData.test_id,
      name: flakyData.test_name,
    },
    suite: {
      id: flakyData.suite_id,
      name: flakyData.suite_name,
    },
    project: {
      id: flakyData.project_id,
      name: projectName,
    },
    run: {
      id: flakyData.run_id,
    },
    flakiness: {
      score: flakyData.flakiness_score,
      failed_runs: flakyData.failed_runs,
      total_runs: flakyData.total_runs,
      failure_rate: flakyData.total_runs > 0
        ? Math.round((flakyData.failed_runs / flakyData.total_runs) * 100)
        : 0,
    },
    recent_failures: flakyData.recent_failures.slice(0, 5), // Last 5 failures
    first_detected_at: flakyData.first_detected_at,
    quarantine_recommended: flakyData.quarantine_recommended,
    organization_id: orgId,
    details_url: `http://localhost:5173/tests/${flakyData.test_id}?tab=flakiness`,
  };

  // Send to each subscription
  for (const sub of subscriptions) {
    await deliverOrBatchWebhook(sub, payload, 'flaky.test.detected', {
      runId: flakyData.run_id,
      projectId: flakyData.project_id,
    });
  }
}

// ============================================================================
// Feature #1315: Webhook event: accessibility.issue.found
// ============================================================================

/**
 * Send accessibility.issue.found webhook to all subscribed endpoints
 */
export async function sendAccessibilityIssueWebhook(
  orgId: string,
  issueData: {
    test_id: string;
    test_name: string;
    suite_id: string;
    suite_name: string;
    project_id: string;
    project_name?: string;
    run_id: string;
    target_url: string;
    wcag_level: 'A' | 'AA' | 'AAA';
    score: number;
    summary: {
      total: number;
      critical: number;
      serious: number;
      moderate: number;
      minor: number;
    };
    violations: Array<{
      id: string;
      impact: 'critical' | 'serious' | 'moderate' | 'minor';
      description: string;
      help: string;
      helpUrl: string;
      wcagTags: string[];
      nodes: Array<{
        html: string;
        target: string[];
      }>;
    }>;
  }
): Promise<void> {
  // Find all enabled webhook subscriptions
  const subscriptions = Array.from(webhookSubscriptions.values()).filter(sub =>
    sub.organization_id === orgId &&
    sub.enabled &&
    sub.events.includes('accessibility.issue.found') &&
    subscriptionMatchesProject(sub, issueData.project_id)
  );

  if (subscriptions.length === 0) {
    console.log('[WEBHOOK] No subscriptions for accessibility.issue.found event');
    return;
  }

  // Get project info
  const project = projects.get(issueData.project_id);
  const projectName = issueData.project_name || project?.name || 'Unknown Project';

  // Build payload
  const payload = {
    event: 'accessibility.issue.found',
    timestamp: new Date().toISOString(),
    test: {
      id: issueData.test_id,
      name: issueData.test_name,
    },
    suite: {
      id: issueData.suite_id,
      name: issueData.suite_name,
    },
    project: {
      id: issueData.project_id,
      name: projectName,
    },
    run: {
      id: issueData.run_id,
    },
    target_url: issueData.target_url,
    accessibility: {
      wcag_level: issueData.wcag_level,
      score: issueData.score,
      summary: issueData.summary,
      violations: issueData.violations.map(v => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        help: v.help,
        helpUrl: v.helpUrl,
        wcagTags: v.wcagTags,
        element: v.nodes[0] ? {
          html: v.nodes[0].html,
          selector: v.nodes[0].target.join(' > '),
        } : null,
        affected_nodes: v.nodes.length,
      })),
    },
  };

  // Log the webhook emission
  console.log('');
  console.log('================================================================================');
  console.log('[WEBHOOK] Emitting accessibility.issue.found event');
  console.log('================================================================================');
  console.log(`Test: ${issueData.test_name} (${issueData.test_id})`);
  console.log(`Run ID: ${issueData.run_id}`);
  console.log(`URL: ${issueData.target_url}`);
  console.log(`WCAG Level: ${issueData.wcag_level}`);
  console.log(`Score: ${issueData.score}`);
  console.log(`Violations: ${issueData.summary.total} (${issueData.summary.critical} critical, ${issueData.summary.serious} serious)`);
  console.log('================================================================================');
  console.log('');

  // Send to each subscription
  for (const sub of subscriptions) {
    await deliverOrBatchWebhook(sub, payload, 'accessibility.issue.found', {
      runId: issueData.run_id,
      projectId: issueData.project_id,
    });
  }
}

// ============================================================================
// Feature #1305: Webhook event: test.created
// ============================================================================

/**
 * Send test.created webhook to all subscribed endpoints
 */
export async function sendTestCreatedWebhook(
  orgId: string,
  testData: {
    test_id: string;
    test_name: string;
    test_type: string;
    description?: string;
    suite_id: string;
    suite_name: string;
    project_id: string;
    created_by?: string;
  }
): Promise<void> {
  // Find all enabled webhook subscriptions
  const subscriptions = Array.from(webhookSubscriptions.values()).filter(sub =>
    sub.organization_id === orgId &&
    sub.enabled &&
    sub.events.includes('test.created') &&
    subscriptionMatchesProject(sub, testData.project_id)
  );

  if (subscriptions.length === 0) {
    console.log('[WEBHOOK] No subscriptions for test.created event');
    return;
  }

  // Get project info
  const project = projects.get(testData.project_id);
  const projectName = project?.name || 'Unknown Project';

  // Build payload
  const payload = {
    event: 'test.created',
    timestamp: new Date().toISOString(),
    test: {
      id: testData.test_id,
      name: testData.test_name,
      type: testData.test_type,
      description: testData.description,
    },
    suite: {
      id: testData.suite_id,
      name: testData.suite_name,
    },
    project: {
      id: testData.project_id,
      name: projectName,
    },
    created_by: testData.created_by,
    organization_id: orgId,
  };

  // Log test.created event
  console.log('');
  console.log('📝 TEST CREATED EVENT:');
  console.log('================================================================================');
  console.log(`Test: ${testData.test_name} (${testData.test_id})`);
  console.log(`Type: ${testData.test_type}`);
  console.log(`Suite: ${testData.suite_name}`);
  console.log(`Project: ${projectName}`);
  console.log(`Created by: ${testData.created_by || 'Unknown'}`);
  console.log('================================================================================');
  console.log('');

  // Send to each subscription
  for (const sub of subscriptions) {
    await deliverOrBatchWebhook(sub, payload, 'test.created', {
      projectId: testData.project_id,
    });
  }
}
