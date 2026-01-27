/**
 * Alerts Module
 * Extracted from test-runs.ts for code organization (Feature #1370)
 *
 * Contains:
 * - Alert configuration types and interfaces
 * - Email, Slack, and Webhook alert sending functions
 * - Alert condition checking logic
 * - In-memory stores for alert channels and logs
 */

// ============================================
// Types and Interfaces
// ============================================

export type AlertCondition = 'any_failure' | 'all_failures' | 'threshold';
export type AlertChannelType = 'email' | 'slack' | 'webhook';

export interface AlertChannel {
  id: string;
  project_id: string;
  organization_id: string;
  type: AlertChannelType;
  name: string;
  enabled: boolean;
  condition: AlertCondition;
  threshold_percent?: number; // Only used when condition is 'threshold'
  suppress_on_retry_success?: boolean; // Suppress alert if test passes on retry

  // Email-specific config
  email_addresses?: string[]; // List of email recipients

  // Slack-specific config (future)
  slack_channel?: string;
  slack_webhook_url?: string;

  // Webhook-specific config (future)
  webhook_url?: string;
  webhook_headers?: Record<string, string>;

  created_at: Date;
  updated_at: Date;
}

// Interface for sent email log entry
export interface SentEmailLog {
  timestamp: Date;
  to: string[];
  subject: string;
  body: string;
  runId: string;
  projectId: string;
  channelId: string;
  channelName: string;
  success: boolean;
  error?: string;
}

// Slack workspace connection per organization
export interface SlackConnection {
  organization_id: string;
  workspace_id: string;
  workspace_name: string;
  bot_access_token: string;
  connected_at: Date;
  connected_by: string;
  channels: SlackChannel[];
}

export interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
}

// Slack message log for development mode
export interface SlackLogEntry {
  timestamp: Date;
  channel: string;
  channelName: string;
  message: string;
  runId: string;
  projectId: string;
  channelId: string;
  alertChannelName: string;
  success: boolean;
  error?: string;
}

// Feature #1295: Enhanced webhook delivery log entry
export interface WebhookLogEntry {
  // Request info
  id?: string; // Unique delivery ID (optional for backwards compatibility)
  timestamp: Date;
  url: string;
  method?: string;
  headers?: Record<string, string>; // Headers sent (without sensitive values like secret)
  payload: object;
  // Context
  event?: string;
  runId: string;
  projectId: string;
  subscriptionId?: string;
  subscriptionName?: string;
  channelId?: string;
  channelName?: string;
  // Response info
  success: boolean;
  responseStatus?: number;
  responseBody?: string; // First 1000 chars of response body
  responseHeaders?: Record<string, string>;
  // Timing
  duration_ms?: number;
  // Retry info
  attempt?: number;
  max_attempts?: number;
  // Error
  error?: string;
}

// ============================================
// In-Memory Stores
// ============================================

// In-memory alert channels store
export const alertChannels: Map<string, AlertChannel> = new Map();

// Email log for development mode (view recent emails)
export const emailLog: SentEmailLog[] = [];

// In-memory store for Slack connections (per organization)
export const slackConnections: Map<string, SlackConnection> = new Map();

// Slack message log for development mode
export const slackLog: SlackLogEntry[] = [];

// Webhook log for viewing via API
export const webhookLog: WebhookLogEntry[] = [];

// ============================================
// Simplified Types for Alert Functions
// ============================================

// Minimal interfaces for test run and result (to avoid circular imports)
export interface AlertTestRun {
  id: string;
  suite_id: string;
  browser?: string;
  status: string;
  duration_ms?: number;
  started_at?: Date;
  completed_at?: Date;
}

export interface AlertTestRunResult {
  test_id: string;
  test_name: string;
  status: string;
  error?: string;
  duration_ms?: number;
  passed_on_retry?: boolean;
}

// ============================================
// Alert Sending Functions
// ============================================

/**
 * Send Slack alert (logs to console in development)
 */
export async function sendSlackAlert(
  channel: AlertChannel,
  run: AlertTestRun,
  results: AlertTestRunResult[],
  suiteName: string,
  projectName: string
): Promise<void> {
  if (!channel.slack_channel) {
    console.log('[SLACK ALERT] No Slack channel configured for alert channel:', channel.id);
    return;
  }

  // Get Slack connection for this organization
  const slackConnection = slackConnections.get(channel.organization_id);
  if (!slackConnection) {
    console.log('[SLACK ALERT] No Slack workspace connected for organization:', channel.organization_id);
    return;
  }

  const failedTests = results.filter(r => r.status === 'failed' || r.status === 'error');
  const passedTests = results.filter(r => r.status === 'passed');
  const totalTests = results.length;
  const passRate = totalTests > 0 ? Math.round((passedTests.length / totalTests) * 100) : 0;

  // Build Slack message (using Slack Block Kit format for console display)
  const failureDetails = failedTests.map(t => `• *${t.test_name}*: ${t.error || 'Unknown error'}`).join('\n');

  const message = `
🚨 *Test Failure Alert*

*Project:* ${projectName}
*Test Suite:* ${suiteName}
*Run ID:* ${run.id}
*Browser:* ${run.browser || 'chromium'}

📊 *Results Summary*
• Total Tests: ${totalTests}
• ✅ Passed: ${passedTests.length}
• ❌ Failed: ${failedTests.length}
• Pass Rate: ${passRate}%
• Duration: ${run.duration_ms ? Math.round(run.duration_ms / 1000) + 's' : 'N/A'}

❌ *Failed Tests*
${failureDetails}

<http://localhost:5173/runs/${run.id}|View Full Results>
`.trim();

  // Find channel name
  const slackChannel = slackConnection.channels.find(c => c.id === channel.slack_channel);
  const channelName = slackChannel?.name || channel.slack_channel;

  // Log Slack message to console (development mode)
  console.log('\n' + '='.repeat(80));
  console.log('[SLACK ALERT] Sending test failure notification to Slack');
  console.log('='.repeat(80));
  console.log(`Workspace: ${slackConnection.workspace_name}`);
  console.log(`Channel: #${channelName} (${channel.slack_channel})`);
  console.log('-'.repeat(80));
  console.log(message);
  console.log('='.repeat(80) + '\n');

  // Store in Slack log for viewing via API
  slackLog.unshift({
    timestamp: new Date(),
    channel: channel.slack_channel,
    channelName,
    message,
    runId: run.id,
    projectId: channel.project_id,
    channelId: channel.id,
    alertChannelName: channel.name,
    success: true, // In dev mode, console logging is always successful
  });

  // Keep only last 100 Slack logs
  if (slackLog.length > 100) {
    slackLog.pop();
  }
}

/**
 * Send email alert (logs to console in development)
 */
export async function sendEmailAlert(
  channel: AlertChannel,
  run: AlertTestRun,
  results: AlertTestRunResult[],
  suiteName: string,
  projectName: string
): Promise<void> {
  if (!channel.email_addresses || channel.email_addresses.length === 0) {
    console.log('[EMAIL ALERT] No email addresses configured for channel:', channel.id);
    return;
  }

  const failedTests = results.filter(r => r.status === 'failed' || r.status === 'error');
  const passedTests = results.filter(r => r.status === 'passed');
  const totalTests = results.length;
  const passRate = totalTests > 0 ? Math.round((passedTests.length / totalTests) * 100) : 0;

  // Build email subject
  const subject = `[QA Guardian] Test Failure Alert: ${suiteName} - ${failedTests.length} test(s) failed`;

  // Build email body
  const failureDetails = failedTests.map(t => {
    return `- ${t.test_name}: ${t.error || 'Unknown error'}`;
  }).join('\n');

  const body = `
================================================================================
                        QA GUARDIAN - TEST FAILURE ALERT
================================================================================

Project: ${projectName}
Test Suite: ${suiteName}
Run ID: ${run.id}
Browser: ${run.browser || 'chromium'}

--------------------------------------------------------------------------------
                               RESULTS SUMMARY
--------------------------------------------------------------------------------
Total Tests: ${totalTests}
Passed: ${passedTests.length}
Failed: ${failedTests.length}
Pass Rate: ${passRate}%
Duration: ${run.duration_ms ? Math.round(run.duration_ms / 1000) + 's' : 'N/A'}

--------------------------------------------------------------------------------
                              FAILED TESTS
--------------------------------------------------------------------------------
${failureDetails}

--------------------------------------------------------------------------------
                              VIEW RESULTS
--------------------------------------------------------------------------------
View full results: http://localhost:5173/runs/${run.id}

================================================================================
This email was sent by QA Guardian. Configure your alert preferences in Settings.
================================================================================
`;

  // Log email to console (development mode)
  console.log('\n' + '='.repeat(80));
  console.log('[EMAIL ALERT] Sending test failure notification');
  console.log('='.repeat(80));
  console.log(`To: ${channel.email_addresses.join(', ')}`);
  console.log(`Subject: ${subject}`);
  console.log('-'.repeat(80));
  console.log(body);
  console.log('='.repeat(80) + '\n');

  // Store in email log for viewing via API
  // In development, emails are "sent" successfully (logged to console)
  emailLog.unshift({
    timestamp: new Date(),
    to: channel.email_addresses,
    subject,
    body,
    runId: run.id,
    projectId: channel.project_id,
    channelId: channel.id,
    channelName: channel.name,
    success: true, // In dev mode, console logging is always successful
  });

  // Keep only last 100 emails in log
  if (emailLog.length > 100) {
    emailLog.pop();
  }
}

/**
 * Send webhook alert
 */
export async function sendWebhookAlert(
  channel: AlertChannel,
  run: AlertTestRun,
  results: AlertTestRunResult[],
  suiteName: string,
  projectName: string
): Promise<void> {
  if (!channel.webhook_url) {
    console.log('[WEBHOOK ALERT] No webhook URL configured for channel:', channel.id);
    return;
  }

  const failedTests = results.filter(r => r.status === 'failed' || r.status === 'error');
  const passedTests = results.filter(r => r.status === 'passed');
  const totalTests = results.length;
  const passRate = totalTests > 0 ? Math.round((passedTests.length / totalTests) * 100) : 0;

  // Build webhook payload
  const payload = {
    event: 'test_failure',
    timestamp: new Date().toISOString(),
    project: {
      id: channel.project_id,
      name: projectName,
    },
    suite: {
      id: run.suite_id,
      name: suiteName,
    },
    run: {
      id: run.id,
      browser: run.browser,
      status: run.status,
      duration_ms: run.duration_ms,
      started_at: run.started_at?.toISOString(),
      completed_at: run.completed_at?.toISOString(),
    },
    results: {
      total: totalTests,
      passed: passedTests.length,
      failed: failedTests.length,
      pass_rate: passRate,
    },
    failed_tests: failedTests.map(t => ({
      id: t.test_id,
      name: t.test_name,
      error: t.error,
      duration_ms: t.duration_ms,
    })),
    alert_channel: {
      id: channel.id,
      name: channel.name,
      condition: channel.condition,
    },
    results_url: `http://localhost:5173/runs/${run.id}`,
  };

  // Log webhook to console (development mode)
  console.log('\n' + '='.repeat(80));
  console.log('[WEBHOOK ALERT] Sending test failure webhook');
  console.log('='.repeat(80));
  console.log(`URL: ${channel.webhook_url}`);
  console.log('Payload:');
  console.log(JSON.stringify(payload, null, 2));
  console.log('='.repeat(80) + '\n');

  // Attempt to send the webhook
  let success = false;
  let responseStatus: number | undefined;
  let errorMsg: string | undefined;

  try {
    const response = await fetch(channel.webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...channel.webhook_headers,
      },
      body: JSON.stringify(payload),
    });

    responseStatus = response.status;
    success = response.ok;

    if (!response.ok) {
      errorMsg = `HTTP ${response.status}: ${response.statusText}`;
      console.log(`[WEBHOOK ALERT] Failed to deliver webhook: ${errorMsg}`);
    } else {
      console.log(`[WEBHOOK ALERT] Webhook delivered successfully (HTTP ${response.status})`);
    }
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.log(`[WEBHOOK ALERT] Failed to deliver webhook: ${errorMsg}`);
  }

  // Store in webhook log for viewing via API
  webhookLog.unshift({
    timestamp: new Date(),
    url: channel.webhook_url,
    payload,
    runId: run.id,
    projectId: channel.project_id,
    channelId: channel.id,
    channelName: channel.name,
    success,
    responseStatus,
    error: errorMsg,
  });

  // Keep only last 100 webhook logs
  if (webhookLog.length > 100) {
    webhookLog.pop();
  }
}

// ============================================
// Alert Condition Checking
// ============================================

// TestSuites and projects types for checkAndSendAlerts (simplified)
export interface AlertSuiteInfo {
  name: string;
  project_id: string;
}

export interface AlertProjectInfo {
  name: string;
}

/**
 * Check alert conditions and send alerts
 * Note: This requires testSuites and projects maps to be passed in to avoid circular imports
 */
export async function checkAndSendAlerts(
  run: AlertTestRun,
  results: AlertTestRunResult[],
  getSuite: (suiteId: string) => AlertSuiteInfo | undefined,
  getProject: (projectId: string) => AlertProjectInfo | undefined
): Promise<void> {
  if (run.status !== 'failed' && run.status !== 'error') {
    return; // No alerts needed for passing runs
  }

  // Get suite info
  const suite = getSuite(run.suite_id);
  if (!suite) return;

  // Get project info
  const project = getProject(suite.project_id);
  if (!project) return;

  // Find enabled alert channels for this project
  const projectChannels = Array.from(alertChannels.values())
    .filter(ch => ch.project_id === suite.project_id && ch.enabled);

  for (const channel of projectChannels) {
    // Check if condition is met
    const failedCount = results.filter(r => r.status === 'failed' || r.status === 'error').length;
    const totalCount = results.length;

    // Check for suppress_on_retry_success - if any test passed on retry, we might suppress the alert
    const testsPassedOnRetry = results.filter(r => r.passed_on_retry === true);
    const actualFailures = results.filter(r => (r.status === 'failed' || r.status === 'error') && !r.passed_on_retry);

    // If suppress_on_retry_success is enabled and ALL failures recovered on retry, suppress the alert
    if (channel.suppress_on_retry_success && testsPassedOnRetry.length > 0 && actualFailures.length === 0) {
      console.log(`[ALERT] Suppressed alert for channel ${channel.name} - all tests passed on retry`);
      continue;
    }

    let shouldAlert = false;

    // Use actual failures count if suppress_on_retry_success is enabled
    const effectiveFailedCount = channel.suppress_on_retry_success ? actualFailures.length : failedCount;
    const effectiveFailurePercent = totalCount > 0 ? (effectiveFailedCount / totalCount) * 100 : 0;

    switch (channel.condition) {
      case 'any_failure':
        shouldAlert = effectiveFailedCount > 0;
        break;
      case 'all_failures':
        shouldAlert = effectiveFailedCount === totalCount;
        break;
      case 'threshold':
        shouldAlert = effectiveFailurePercent >= (channel.threshold_percent || 50);
        break;
    }

    if (!shouldAlert) {
      console.log(`[ALERT] Condition not met for channel ${channel.name} (${channel.condition})`);
      continue;
    }

    // Log retry suppression info if relevant
    if (channel.suppress_on_retry_success && testsPassedOnRetry.length > 0) {
      console.log(`[ALERT] ${testsPassedOnRetry.length} test(s) passed on retry, but ${actualFailures.length} still failed - sending alert`);
    }

    // Send alert based on channel type
    try {
      switch (channel.type) {
        case 'email':
          await sendEmailAlert(channel, run, results, suite.name, project.name);
          break;
        case 'slack':
          await sendSlackAlert(channel, run, results, suite.name, project.name);
          break;
        case 'webhook':
          await sendWebhookAlert(channel, run, results, suite.name, project.name);
          break;
      }
    } catch (err) {
      console.error(`[ALERT] Failed to send alert via channel ${channel.name}:`, err);
    }
  }
}
