/**
 * Monitoring Helpers Module
 *
 * Helper functions for monitoring operations including:
 * - Assertion evaluation
 * - Maintenance window checks
 * - Check execution and scheduling
 * - Duration formatting
 * - String similarity calculations
 *
 * Extracted from monitoring.ts (Feature #1374)
 */

import {
  MonitoringLocation,
  UptimeCheck,
  UptimeAssertion,
  AssertionResult,
  CheckResult,
  MaintenanceWindow,
  Incident,
  AlertCorrelationConfig,
  CorrelatedAlert,
  AlertCorrelation,
  AlertRateLimitConfig,
  AlertRateLimitState,
  AlertRunbook,
} from './types';

import {
  // Async DB functions
  getUptimeCheck,
  getMaintenanceWindows,
  getConsecutiveFailures,
  setConsecutiveFailures,
  addCheckResult,
  getActiveIncident,
  setActiveIncident,
  clearActiveIncident,
  createIncident,
  resolveIncident,
  getCheckIncidentsAsync,
  // Runtime-only Map (cannot be serialized)
  checkIntervals,
  // Deprecated Maps (no DB functions yet)
  alertCorrelationConfigs,
  alertCorrelations,
  alertToCorrelation,
  alertRateLimitConfigs,
  alertRateLimitStates,
  alertRunbooks,
} from './stores';

// Global monitoring locations
export const MONITORING_LOCATIONS: { id: MonitoringLocation; name: string; region: string; city: string }[] = [
  { id: 'us-east', name: 'US East', region: 'North America', city: 'Virginia' },
  { id: 'us-west', name: 'US West', region: 'North America', city: 'Oregon' },
  { id: 'europe', name: 'Europe', region: 'Europe', city: 'Frankfurt' },
  { id: 'asia-pacific', name: 'Asia Pacific', region: 'Asia', city: 'Singapore' },
  { id: 'australia', name: 'Australia', region: 'Oceania', city: 'Sydney' },
];

/**
 * Evaluate a single assertion against check response
 */
export function evaluateAssertion(
  assertion: UptimeAssertion,
  responseTime: number,
  statusCode: number,
  responseBody?: string,
  responseHeaders?: Record<string, string>
): AssertionResult {
  let actual: string | number;

  switch (assertion.type) {
    case 'responseTime':
      actual = responseTime;
      break;
    case 'statusCode':
      actual = statusCode;
      break;
    case 'bodyContains':
      actual = responseBody || '';
      break;
    case 'headerContains':
      // For headers, format as "HeaderName: HeaderValue" pairs
      actual = responseHeaders ? Object.entries(responseHeaders).map(([k, v]) => `${k}: ${v}`).join(', ') : '';
      break;
    default:
      actual = 0;
  }

  let passed = false;
  switch (assertion.operator) {
    case 'lessThan':
      passed = Number(actual) < Number(assertion.value);
      break;
    case 'greaterThan':
      passed = Number(actual) > Number(assertion.value);
      break;
    case 'equals':
      passed = actual === assertion.value;
      break;
    case 'contains':
      passed = String(actual).includes(String(assertion.value));
      break;
  }

  return {
    type: assertion.type,
    operator: assertion.operator,
    expected: assertion.value,
    actual,
    passed,
  };
}

/**
 * Check if a check is currently in a maintenance window
 */
export async function isInMaintenanceWindow(checkId: string): Promise<{ inMaintenance: boolean; window?: MaintenanceWindow }> {
  const windows = await getMaintenanceWindows(checkId);
  const now = new Date();

  for (const window of windows) {
    if (now >= window.start_time && now <= window.end_time) {
      return { inMaintenance: true, window };
    }
  }

  return { inMaintenance: false };
}

/**
 * Simulate running a check from a specific location
 */
export async function runCheck(check: UptimeCheck, location: MonitoringLocation): Promise<CheckResult> {
  // Simulate location-based latency variations
  const locationLatency: Record<MonitoringLocation, number> = {
    'us-east': 0,
    'us-west': 50,
    'europe': 100,
    'asia-pacific': 150,
    'australia': 200,
  };

  const baseLatency = locationLatency[location] || 0;

  const result: CheckResult = {
    id: `result-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    check_id: check.id,
    location,
    status: 'up',
    response_time: Math.floor(Math.random() * 500) + 50 + baseLatency,
    status_code: check.expected_status,
    checked_at: new Date(),
  };

  // Simulate a response body
  const simulatedResponseBody = JSON.stringify({
    status: 'ok',
    message: 'Health check passed',
    timestamp: new Date().toISOString(),
    service: 'api-gateway',
    version: '1.0.0',
  });

  // Simulate response headers
  const simulatedResponseHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Request-Id': `req-${Date.now()}`,
    'X-Response-Time': `${result.response_time}ms`,
    'Cache-Control': 'no-cache',
    'Server': 'QA-Guardian/1.0',
  };

  // Simulate SSL certificate info for HTTPS URLs
  if (check.url.startsWith('https://')) {
    const daysUntilExpiry = Math.floor(Math.random() * 360) + 5;
    const validFrom = new Date();
    validFrom.setDate(validFrom.getDate() - 365);
    const validTo = new Date();
    validTo.setDate(validTo.getDate() + daysUntilExpiry);

    result.ssl_info = {
      valid: true,
      issuer: "Let's Encrypt Authority X3",
      subject: new URL(check.url).hostname,
      valid_from: validFrom,
      valid_to: validTo,
      days_until_expiry: daysUntilExpiry,
      fingerprint: `SHA256:${Math.random().toString(36).substring(2, 18).toUpperCase()}`,
    };

    const warningDays = check.ssl_expiry_warning_days || 30;
    if (daysUntilExpiry <= warningDays && result.status !== 'down') {
      result.status = 'degraded';
      result.error = `SSL certificate expires in ${daysUntilExpiry} days (warning threshold: ${warningDays} days)`;
    }
  }

  // Simulate occasional failures (10% chance)
  if (Math.random() < 0.1) {
    result.status = 'down';
    result.status_code = 500;
    result.error = 'Connection timeout';
    result.response_time = check.timeout;
  } else if (Math.random() < 0.15) {
    result.status = 'degraded';
    result.response_time = Math.floor(Math.random() * 2000) + 1000 + baseLatency;
  }

  // Evaluate assertions if configured
  if (check.assertions && check.assertions.length > 0) {
    const assertionResults: AssertionResult[] = [];
    let passed = 0;
    let failed = 0;

    for (const assertion of check.assertions) {
      const assertResult = evaluateAssertion(assertion, result.response_time, result.status_code, simulatedResponseBody, simulatedResponseHeaders);
      assertionResults.push(assertResult);
      if (assertResult.passed) {
        passed++;
      } else {
        failed++;
      }
    }

    result.assertion_results = assertionResults;
    result.assertions_passed = passed;
    result.assertions_failed = failed;

    if (failed > 0 && result.status !== 'down') {
      result.status = 'degraded';
      const failedAssertions = assertionResults.filter(a => !a.passed);
      result.error = `Assertion failed: ${failedAssertions[0].type} ${failedAssertions[0].operator} ${failedAssertions[0].expected} (actual: ${failedAssertions[0].actual})`;
    }
  }

  // Check for maintenance window
  const maintenanceStatus = await isInMaintenanceWindow(check.id);
  if (maintenanceStatus.inMaintenance) {
    console.log(`[MONITORING] Check ${check.name}: In maintenance window "${maintenanceStatus.window?.name}" - suppressing alerts`);
  } else {
    const threshold = check.consecutive_failures_threshold || 1;
    const currentFailures = await getConsecutiveFailures(check.id);

    if (result.status === 'down' || result.status === 'degraded') {
      const newFailures = currentFailures + 1;
      await setConsecutiveFailures(check.id, newFailures);

      if (newFailures < threshold) {
        result.status = 'up';
        result.error = undefined;
        console.log(`[MONITORING] Check ${check.name}: Failure ${newFailures}/${threshold} - suppressing alert`);
      } else {
        console.log(`[MONITORING] Check ${check.name}: Failure ${newFailures}/${threshold} - threshold reached, alerting`);
      }
    } else {
      if (currentFailures > 0) {
        console.log(`[MONITORING] Check ${check.name}: Reset consecutive failures (was ${currentFailures})`);
      }
      await setConsecutiveFailures(check.id, 0);
    }
  }

  // Store the result
  await addCheckResult(result);

  // Track incidents
  const activeIncident = await getActiveIncident(check.id);

  if (result.status === 'down' || result.status === 'degraded') {
    if (!activeIncident) {
      const newIncident: Incident = {
        id: `incident-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        check_id: check.id,
        status: result.status,
        started_at: new Date(),
        error: result.error,
        affected_locations: [location],
      };
      await setActiveIncident(check.id, newIncident);
      console.log(`[INCIDENT] Started incident for ${check.name}: ${result.status}`);
    } else {
      if (!activeIncident.affected_locations.includes(location)) {
        activeIncident.affected_locations.push(location);
      }
      if (activeIncident.status === 'degraded' && result.status === 'down') {
        activeIncident.status = 'down';
      }
      await setActiveIncident(check.id, activeIncident);
    }
  } else {
    if (activeIncident) {
      const endTime = new Date();
      activeIncident.ended_at = endTime;
      activeIncident.duration_seconds = Math.round((endTime.getTime() - activeIncident.started_at.getTime()) / 1000);

      await resolveIncident(activeIncident.id, endTime);
      await clearActiveIncident(check.id);
      console.log(`[INCIDENT] Resolved incident for ${check.name} after ${activeIncident.duration_seconds}s`);
    }
  }

  console.log(`[MONITORING] Check ${check.name} (${check.url}) from ${location}: ${result.status} - ${result.response_time}ms${result.assertions_failed ? ` (${result.assertions_failed} assertions failed)` : ''}`);

  return result;
}

/**
 * Run check from all configured locations
 */
export async function runCheckFromAllLocations(check: UptimeCheck): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  for (const location of check.locations) {
    const result = await runCheck(check, location);
    results.push(result);
  }
  return results;
}

/**
 * Start running checks for a specific check
 */
export function startCheckInterval(check: UptimeCheck) {
  const existingInterval = checkIntervals.get(check.id);
  if (existingInterval) {
    clearInterval(existingInterval);
  }

  if (!check.enabled) {
    return;
  }

  runCheckFromAllLocations(check);

  const intervalId = setInterval(async () => {
    const currentCheck = await getUptimeCheck(check.id);
    if (currentCheck && currentCheck.enabled) {
      runCheckFromAllLocations(currentCheck);
    } else {
      clearInterval(intervalId);
      checkIntervals.delete(check.id);
    }
  }, check.interval * 1000);

  checkIntervals.set(check.id, intervalId);
}

/**
 * Stop check interval
 */
export function stopCheckInterval(checkId: string) {
  const interval = checkIntervals.get(checkId);
  if (interval) {
    clearInterval(interval);
    checkIntervals.delete(checkId);
  }
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  } else if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
}

/**
 * Calculate string similarity using word overlap
 */
export function calculateStringSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 100;

  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  const words1 = new Set(s1.split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(s2.split(/\s+/).filter(w => w.length > 2));

  if (words1.size === 0 || words2.size === 0) return 0;

  let commonWords = 0;
  for (const word of words1) {
    if (words2.has(word)) commonWords++;
  }

  const similarity = (commonWords * 2) / (words1.size + words2.size) * 100;
  return Math.round(similarity);
}

/**
 * Find or create correlation for an alert
 */
export function correlateAlert(
  orgId: string,
  alertInfo: CorrelatedAlert
): { correlated: boolean; correlation_id?: string; correlation_reason?: string } {
  const config = alertCorrelationConfigs.get(orgId);

  if (!config || !config.enabled) {
    return { correlated: false };
  }

  const now = new Date();
  const timeWindowMs = config.time_window_seconds * 1000;

  for (const [corrId, correlation] of alertCorrelations) {
    if (correlation.organization_id !== orgId) continue;
    if (correlation.status === 'resolved') continue;

    const timeSinceCreation = now.getTime() - correlation.created_at.getTime();
    if (config.correlate_by_time_window && timeSinceCreation > timeWindowMs) continue;

    const reasons: string[] = [];

    for (const existingAlert of correlation.alerts) {
      if (config.correlate_by_check && existingAlert.check_id === alertInfo.check_id) {
        reasons.push('same_check');
      }

      if (config.correlate_by_location && existingAlert.location && alertInfo.location &&
          existingAlert.location === alertInfo.location) {
        reasons.push('same_location');
      }

      if (config.correlate_by_error_type && existingAlert.error_message && alertInfo.error_message) {
        const similarity = calculateStringSimilarity(existingAlert.error_message, alertInfo.error_message);
        if (similarity >= config.similarity_threshold) {
          reasons.push('similar_error');
        }
      }
    }

    if (reasons.length > 0) {
      correlation.alerts.push(alertInfo);
      correlation.updated_at = now;

      const uniqueReasons = [...new Set(reasons)];
      if (uniqueReasons.length > 1) {
        correlation.correlation_reason = 'multiple';
        correlation.correlation_details = `Correlated by: ${uniqueReasons.join(', ')}`;
      } else if (uniqueReasons[0] !== correlation.correlation_reason) {
        correlation.correlation_reason = 'multiple';
        correlation.correlation_details = `Correlated by: ${correlation.correlation_reason}, ${uniqueReasons[0]}`;
      }

      alertToCorrelation.set(alertInfo.id, corrId);
      return { correlated: true, correlation_id: corrId, correlation_reason: uniqueReasons.join(', ') };
    }
  }

  const correlationId = `corr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const newCorrelation: AlertCorrelation = {
    id: correlationId,
    organization_id: orgId,
    correlation_reason: 'time_proximity',
    correlation_details: 'Initial alert - pending correlation with future alerts',
    alerts: [alertInfo],
    primary_alert_id: alertInfo.id,
    status: 'active',
    created_at: now,
    updated_at: now,
  };

  alertCorrelations.set(correlationId, newCorrelation);
  alertToCorrelation.set(alertInfo.id, correlationId);

  return { correlated: true, correlation_id: correlationId, correlation_reason: 'new_correlation' };
}

/**
 * Find matching runbook for an alert
 */
export function findRunbookForAlert(
  orgId: string,
  checkType: string,
  severity: string
): AlertRunbook | null {
  let bestMatch: AlertRunbook | null = null;
  let matchScore = 0;

  for (const [_, runbook] of alertRunbooks) {
    if (runbook.organization_id !== orgId) continue;

    let score = 0;

    if (runbook.check_type === checkType) {
      score += 2;
    } else if (runbook.check_type === 'all') {
      score += 1;
    } else {
      continue;
    }

    if (runbook.severity === severity) {
      score += 2;
    } else if (runbook.severity === 'all' || !runbook.severity) {
      score += 1;
    } else {
      continue;
    }

    if (score > matchScore) {
      matchScore = score;
      bestMatch = runbook;
    }
  }

  return bestMatch;
}

/**
 * Check rate limit and update state
 */
export function checkAlertRateLimit(
  orgId: string,
  alertInfo: { alert_id: string; check_name: string; severity: string }
): { allowed: boolean; suppressed_count: number; summary_needed: boolean } {
  const config = alertRateLimitConfigs.get(orgId);

  if (!config || !config.enabled) {
    return { allowed: true, suppressed_count: 0, summary_needed: false };
  }

  let state = alertRateLimitStates.get(orgId);
  const now = new Date();

  if (!state || (now.getTime() - state.window_start.getTime()) > config.time_window_seconds * 1000) {
    state = {
      organization_id: orgId,
      alerts_in_window: 0,
      window_start: now,
      suppressed_alerts: [],
      total_alerts: 0,
      sent_alerts: 0,
      suppressed_count: 0,
    };
    alertRateLimitStates.set(orgId, state);
  }

  state.total_alerts++;

  if (state.alerts_in_window < config.max_alerts_per_minute) {
    state.alerts_in_window++;
    state.sent_alerts++;
    return { allowed: true, suppressed_count: state.suppressed_count, summary_needed: false };
  }

  state.suppressed_count++;

  if (config.suppression_mode === 'aggregate') {
    state.suppressed_alerts.push({
      alert_id: alertInfo.alert_id,
      check_name: alertInfo.check_name,
      severity: alertInfo.severity,
      triggered_at: now,
    });

    const summary_needed = state.suppressed_alerts.length >= config.aggregate_threshold;
    if (summary_needed) {
      state.suppressed_alerts = [];
    }

    return { allowed: false, suppressed_count: state.suppressed_count, summary_needed };
  }

  return { allowed: false, suppressed_count: state.suppressed_count, summary_needed: false };
}
