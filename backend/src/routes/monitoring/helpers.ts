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
 * Feature #2118: Migrated correlateAlert, findRunbookForAlert, checkAlertRateLimit
 *   from in-memory Maps to async DB functions
 */

import {
  MonitoringLocation,
  UptimeCheck,
  UptimeAssertion,
  AssertionResult,
  CheckResult,
  MaintenanceWindow,
  Incident,
  CorrelatedAlert,
  AlertCorrelation,
  // AlertRateLimitState - available from types if needed
  AlertRunbook,
} from './types.js';

import { createLogger } from '../../services/logger.js';

const logger = createLogger('monitoring');

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
  // Async DB functions for alert correlation, rate limiting, runbooks
  getAlertCorrelationConfig,
  listAlertCorrelations,
  createAlertCorrelation,
  updateAlertCorrelation,
  getAlertRateLimitConfig,
  getAlertRateLimitState,
  setAlertRateLimitState,
  listAlertRunbooks,
} from './stores.js';

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
 * Run a real HTTP check against the monitored URL
 */
export async function runCheck(check: UptimeCheck, location: MonitoringLocation): Promise<CheckResult> {
  const result: CheckResult = {
    id: `result-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    check_id: check.id,
    location,
    status: 'up',
    response_time: 0,
    status_code: 0,
    checked_at: new Date(),
  };

  let responseBody = '';
  const responseHeaders: Record<string, string> = {};

  try {
    const startTime = performance.now();
    const response = await fetch(check.url, {
      method: check.method || 'GET',
      headers: check.headers || {},
      signal: AbortSignal.timeout(check.timeout || 30000),
      redirect: 'follow',
    });
    result.response_time = Math.round(performance.now() - startTime);
    result.status_code = response.status;

    // Collect response headers
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    // Read response body (limited to 10KB for assertions)
    responseBody = await response.text().then(t => t.slice(0, 10240)).catch(() => '');

    // Determine status based on actual response
    if (response.status === check.expected_status) {
      result.status = 'up';
    } else if (response.status >= 500) {
      result.status = 'down';
      result.error = `Server error: HTTP ${response.status}`;
    } else if (response.status >= 400) {
      result.status = 'degraded';
      result.error = `Client error: HTTP ${response.status}`;
    } else {
      result.status = 'up';
    }

    // Check if response time exceeds threshold (degraded if > 2x expected)
    if (result.response_time > (check.timeout || 30000) * 0.5 && result.status === 'up') {
      result.status = 'degraded';
      result.error = `Slow response: ${result.response_time}ms`;
    }

  } catch (err: unknown) {
    result.response_time = check.timeout || 30000;
    result.status = 'down';
    result.status_code = 0;
    const errObj = err as { name?: string; message?: string };
    if (errObj.name === 'TimeoutError' || errObj.name === 'AbortError') {
      result.error = `Connection timeout after ${check.timeout || 30000}ms`;
    } else {
      result.error = `Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
    }
  }

  // SSL info not available from fetch API - mark as unavailable for HTTPS
  // Real SSL checks would need a TLS library (tls.connect)
  if (check.url.startsWith('https://') && result.status !== 'down') {
    // SSL is implicitly valid if fetch succeeded over HTTPS
    result.ssl_info = {
      valid: true,
      issuer: 'Unknown (fetch API does not expose certificate details)',
      subject: new URL(check.url).hostname,
      valid_from: new Date(),
      valid_to: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // placeholder
      days_until_expiry: 365, // placeholder - real check needs tls.connect
      fingerprint: 'N/A',
    };
  }

  // Evaluate assertions if configured
  if (check.assertions && check.assertions.length > 0) {
    const assertionResults: AssertionResult[] = [];
    let passed = 0;
    let failed = 0;

    for (const assertion of check.assertions) {
      const assertResult = evaluateAssertion(assertion, result.response_time, result.status_code, responseBody, responseHeaders);
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
    logger.info({ checkId: check.id, checkName: check.name, window: maintenanceStatus.window?.name }, 'Check in maintenance window - suppressing alerts');
  } else {
    const threshold = check.consecutive_failures_threshold || 1;
    const currentFailures = await getConsecutiveFailures(check.id);

    if (result.status === 'down' || result.status === 'degraded') {
      const newFailures = currentFailures + 1;
      await setConsecutiveFailures(check.id, newFailures);

      if (newFailures < threshold) {
        result.status = 'up';
        result.error = undefined;
        logger.info({ checkId: check.id, checkName: check.name, failures: newFailures, threshold }, 'Failure below threshold - suppressing alert');
      } else {
        logger.warn({ checkId: check.id, checkName: check.name, failures: newFailures, threshold }, 'Threshold reached - alerting');
      }
    } else {
      if (currentFailures > 0) {
        logger.info({ checkId: check.id, checkName: check.name, previousFailures: currentFailures }, 'Reset consecutive failures');
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
      logger.warn({ checkId: check.id, checkName: check.name, incidentId: newIncident.id, status: result.status }, 'Incident started');
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
      logger.info({ checkId: check.id, checkName: check.name, incidentId: activeIncident.id, durationSeconds: activeIncident.duration_seconds }, 'Incident resolved');
    }
  }

  logger.info({ checkId: check.id, checkName: check.name, url: check.url, location, status: result.status, responseTimeMs: result.response_time, assertionsFailed: result.assertions_failed }, 'Check completed');

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
 * Find or create correlation for an alert.
 * Now async -- queries the DB instead of in-memory Maps.
 */
export async function correlateAlert(
  orgId: string,
  alertInfo: CorrelatedAlert
): Promise<{ correlated: boolean; correlation_id?: string; correlation_reason?: string }> {
  const config = await getAlertCorrelationConfig(orgId);

  if (!config || !config.enabled) {
    return { correlated: false };
  }

  const now = new Date();
  const timeWindowMs = config.time_window_seconds * 1000;

  // Fetch active/acknowledged correlations for this org
  const existingCorrelations = await listAlertCorrelations(orgId, { status: 'active', limit: 200 });
  // Also include acknowledged correlations that are still within the time window
  const acknowledgedCorrelations = await listAlertCorrelations(orgId, { status: 'acknowledged', limit: 200 });
  const allCorrelations = [...existingCorrelations, ...acknowledgedCorrelations];

  for (const correlation of allCorrelations) {
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
      // Add the alert to the existing correlation's alerts array
      const updatedAlerts = [...correlation.alerts, alertInfo];
      const uniqueReasons = [...new Set(reasons)];

      let newReason = correlation.correlation_reason;
      let newDetails = correlation.correlation_details;

      if (uniqueReasons.length > 1) {
        newReason = 'multiple';
        newDetails = `Correlated by: ${uniqueReasons.join(', ')}`;
      } else if (uniqueReasons[0] !== correlation.correlation_reason) {
        newReason = 'multiple';
        newDetails = `Correlated by: ${correlation.correlation_reason}, ${uniqueReasons[0]}`;
      }

      await updateAlertCorrelation(correlation.id, {
        alerts: updatedAlerts,
        correlation_reason: newReason as AlertCorrelation['correlation_reason'],
        correlation_details: newDetails,
      });

      return { correlated: true, correlation_id: correlation.id, correlation_reason: uniqueReasons.join(', ') };
    }
  }

  // No existing correlation matched -- create a new one
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

  await createAlertCorrelation(newCorrelation);

  return { correlated: true, correlation_id: correlationId, correlation_reason: 'new_correlation' };
}

/**
 * Find matching runbook for an alert.
 * Now async -- queries the DB instead of iterating in-memory Map.
 */
export async function findRunbookForAlert(
  orgId: string,
  checkType: string,
  severity: string
): Promise<AlertRunbook | null> {
  const runbooks = await listAlertRunbooks(orgId);

  let bestMatch: AlertRunbook | null = null;
  let matchScore = 0;

  for (const runbook of runbooks) {
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
 * Check rate limit and update state.
 * Now async -- reads/writes rate limit state from/to the DB.
 */
export async function checkAlertRateLimit(
  orgId: string,
  alertInfo: { alert_id: string; check_name: string; severity: string }
): Promise<{ allowed: boolean; suppressed_count: number; summary_needed: boolean }> {
  const config = await getAlertRateLimitConfig(orgId);

  if (!config || !config.enabled) {
    return { allowed: true, suppressed_count: 0, summary_needed: false };
  }

  let state = await getAlertRateLimitState(orgId);
  const now = new Date();

  // Reset window if expired or state doesn't exist
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
  }

  state.total_alerts++;

  if (state.alerts_in_window < config.max_alerts_per_minute) {
    state.alerts_in_window++;
    state.sent_alerts++;
    await setAlertRateLimitState(state);
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

    await setAlertRateLimitState(state);
    return { allowed: false, suppressed_count: state.suppressed_count, summary_needed };
  }

  await setAlertRateLimitState(state);
  return { allowed: false, suppressed_count: state.suppressed_count, summary_needed: false };
}
