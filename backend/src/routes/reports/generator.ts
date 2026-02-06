/**
 * Report Generator
 * Feature #1732: Generates comprehensive reports from real test data
 *
 * All report sections query actual data from the PostgreSQL database.
 * When no data exists for a section, the section returns zeroed-out
 * summaries with a descriptive message instead of fabricated numbers.
 */

import {
  ComprehensiveReport,
  E2EReportSection,
  VisualReportSection,
  AccessibilityReportSection,
  PerformanceReportSection,
  LoadReportSection,
  SecurityReportSection,
  GenerateReportRequest,
} from './types.js';
import { generateReportId, storeReport } from './stores.js';
import { query, isDatabaseConnected } from '../../services/database.js';
import { getProject } from '../../services/repositories/projects.js';

// ============================================================================
// Database-backed section generators
// ============================================================================

/**
 * Build the E2E report section from real test_runs data.
 * Queries test runs with test_type='e2e' for the given project within the period.
 */
async function generateE2ESection(
  projectId: string,
  periodStart: string,
  periodEnd: string,
): Promise<E2EReportSection> {
  const emptySection: E2EReportSection = {
    type: 'e2e',
    summary: { total: 0, passed: 0, failed: 0, skipped: 0, passRate: 0, avgDuration: 0 },
    tests: [],
  };

  if (!isDatabaseConnected()) return emptySection;

  try {
    // Aggregate pass/fail/skip counts from test run results within the period
    const runsResult = await query<any>(
      `SELECT id, status, duration_ms, results, error_message, started_at
       FROM test_runs
       WHERE project_id = $1
         AND test_type = 'e2e'
         AND created_at >= $2
         AND created_at <= $3
       ORDER BY created_at DESC`,
      [projectId, periodStart, periodEnd],
    );

    if (!runsResult || runsResult.rows.length === 0) return emptySection;

    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;
    let skippedTests = 0;
    let totalDuration = 0;
    let durationCount = 0;

    // Individual test entries for the report (latest runs)
    const testEntries: E2EReportSection['tests'] = [];

    for (const row of runsResult.rows) {
      const results: any[] = Array.isArray(row.results) ? row.results : [];

      if (results.length > 0) {
        // Each test run can contain multiple individual test results
        for (const result of results) {
          totalTests++;
          const status = result.status || result.state || 'passed';
          if (status === 'passed') passedTests++;
          else if (status === 'failed') failedTests++;
          else if (status === 'skipped') skippedTests++;

          // Only include up to 50 individual test entries to keep the report manageable
          if (testEntries.length < 50) {
            testEntries.push({
              id: result.id || result.test_id || row.id,
              name: result.name || result.test_name || `Test run ${row.id.slice(0, 8)}`,
              status: status as 'passed' | 'failed' | 'skipped',
              duration: result.duration_ms || result.duration || 0,
              error: result.error || result.error_message || undefined,
            });
          }
        }
      } else {
        // No granular results; treat the entire run as one test
        totalTests++;
        if (row.status === 'completed' || row.status === 'passed') passedTests++;
        else if (row.status === 'failed') failedTests++;
        else skippedTests++;

        if (testEntries.length < 50) {
          testEntries.push({
            id: row.id,
            name: `Test run ${row.id.slice(0, 8)}`,
            status: row.status === 'completed' || row.status === 'passed' ? 'passed'
              : row.status === 'failed' ? 'failed' : 'skipped',
            duration: row.duration_ms || 0,
            error: row.error_message || undefined,
          });
        }
      }

      if (row.duration_ms) {
        totalDuration += row.duration_ms;
        durationCount++;
      }
    }

    const passRate = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;
    const avgDuration = durationCount > 0 ? Math.round(totalDuration / durationCount) : 0;

    return {
      type: 'e2e',
      summary: {
        total: totalTests,
        passed: passedTests,
        failed: failedTests,
        skipped: skippedTests,
        passRate,
        avgDuration,
      },
      tests: testEntries,
    };
  } catch (error) {
    console.error('[ReportGenerator] Failed to generate E2E section:', error);
    return emptySection;
  }
}

/**
 * Build the Visual Regression report section from real test_runs data.
 * Queries test runs with test_type='visual_regression' and aggregates diff results.
 */
async function generateVisualSection(
  projectId: string,
  periodStart: string,
  periodEnd: string,
): Promise<VisualReportSection> {
  const emptySection: VisualReportSection = {
    type: 'visual',
    summary: { total: 0, noChange: 0, diffsDetected: 0, approved: 0, pending: 0 },
    comparisons: [],
  };

  if (!isDatabaseConnected()) return emptySection;

  try {
    const runsResult = await query<any>(
      `SELECT id, status, results, metrics
       FROM test_runs
       WHERE project_id = $1
         AND test_type = 'visual_regression'
         AND created_at >= $2
         AND created_at <= $3
       ORDER BY created_at DESC`,
      [projectId, periodStart, periodEnd],
    );

    if (!runsResult || runsResult.rows.length === 0) return emptySection;

    let total = 0;
    let noChange = 0;
    let diffsDetected = 0;
    let approved = 0;
    let pending = 0;
    const comparisons: VisualReportSection['comparisons'] = [];

    for (const row of runsResult.rows) {
      const results: any[] = Array.isArray(row.results) ? row.results : [];

      if (results.length > 0) {
        for (const result of results) {
          total++;
          const diffPct = result.diffPercentage ?? result.diff_percentage ?? 0;
          const status = result.status || (diffPct === 0 ? 'match' : 'pending');

          if (status === 'match' || diffPct === 0) noChange++;
          else {
            diffsDetected++;
            if (status === 'approved') approved++;
            else pending++;
          }

          if (comparisons.length < 50) {
            comparisons.push({
              id: result.id || `${row.id}-${total}`,
              testName: result.name || result.test_name || `Comparison ${total}`,
              viewport: result.viewport || 'unknown',
              diffPercentage: diffPct,
              status: status as 'match' | 'diff' | 'approved' | 'pending',
            });
          }
        }
      } else {
        // Treat the whole run as a single comparison
        total++;
        if (row.status === 'completed' || row.status === 'passed') noChange++;
        else {
          diffsDetected++;
          pending++;
        }
      }
    }

    return {
      type: 'visual',
      summary: { total, noChange, diffsDetected, approved, pending },
      comparisons,
    };
  } catch (error) {
    console.error('[ReportGenerator] Failed to generate Visual section:', error);
    return emptySection;
  }
}

/**
 * Build the Accessibility report section from real test_runs data.
 * Uses the accessibility_results JSONB column to aggregate violations.
 */
async function generateAccessibilitySection(
  projectId: string,
  periodStart: string,
  periodEnd: string,
): Promise<AccessibilityReportSection> {
  const emptySection: AccessibilityReportSection = {
    type: 'accessibility',
    summary: { total: 0, critical: 0, serious: 0, moderate: 0, minor: 0, wcagCompliance: 0 },
    violations: [],
  };

  if (!isDatabaseConnected()) return emptySection;

  try {
    // Query the most recent accessibility test run to get up-to-date results
    const runsResult = await query<any>(
      `SELECT id, accessibility_results, results, status
       FROM test_runs
       WHERE project_id = $1
         AND test_type = 'accessibility'
         AND created_at >= $2
         AND created_at <= $3
       ORDER BY created_at DESC`,
      [projectId, periodStart, periodEnd],
    );

    if (!runsResult || runsResult.rows.length === 0) return emptySection;

    let critical = 0;
    let serious = 0;
    let moderate = 0;
    let minor = 0;
    const violations: AccessibilityReportSection['violations'] = [];
    // Track unique violations by rule to avoid duplicates across runs
    const seenRules = new Set<string>();

    for (const row of runsResult.rows) {
      const a11yResults = row.accessibility_results;
      if (!a11yResults) continue;

      // accessibility_results may contain a violations array
      const violationList: any[] = a11yResults.violations || a11yResults.results || [];

      for (const v of violationList) {
        const impact = v.impact || v.severity || 'minor';
        if (impact === 'critical') critical++;
        else if (impact === 'serious') serious++;
        else if (impact === 'moderate') moderate++;
        else minor++;

        const ruleKey = v.rule || v.id || v.ruleId;
        if (ruleKey && !seenRules.has(ruleKey) && violations.length < 100) {
          seenRules.add(ruleKey);
          violations.push({
            id: v.id || ruleKey,
            rule: ruleKey,
            impact: impact as 'critical' | 'serious' | 'moderate' | 'minor',
            wcagLevel: v.wcagLevel || v.wcag_level || 'A',
            description: v.description || v.message || v.help || '',
            nodes: v.nodes || v.node_count || 1,
            helpUrl: v.helpUrl || v.help_url || undefined,
          });
        }
      }
    }

    const total = critical + serious + moderate + minor;
    // WCAG compliance: penalize heavier violations more
    const wcagCompliance = total > 0
      ? Math.max(0, 100 - (critical * 20 + serious * 10 + moderate * 3 + minor * 1))
      : 0;

    return {
      type: 'accessibility',
      summary: { total, critical, serious, moderate, minor, wcagCompliance },
      violations,
    };
  } catch (error) {
    console.error('[ReportGenerator] Failed to generate Accessibility section:', error);
    return emptySection;
  }
}

/**
 * Build the Performance report section from real data.
 * First checks performance_results table, then falls back to test_runs with
 * test_type='performance' or test_type='lighthouse'.
 */
async function generatePerformanceSection(
  projectId: string,
  periodStart: string,
  periodEnd: string,
): Promise<PerformanceReportSection> {
  const emptySection: PerformanceReportSection = {
    type: 'performance',
    summary: { score: 0, lcp: 0, fid: 0, cls: 0, ttfb: 0, fcp: 0, tti: 0, speedIndex: 0 },
    audits: [],
    coreWebVitals: {
      lcp: { value: 0, rating: 'poor' },
      fid: { value: 0, rating: 'poor' },
      cls: { value: 0, rating: 'poor' },
    },
  };

  if (!isDatabaseConnected()) return emptySection;

  try {
    // Try performance_results table first (linked via performance_checks for this project)
    const perfResult = await query<any>(
      `SELECT pr.metrics, pr.lighthouse_score, pr.status, pr.checked_at
       FROM performance_results pr
       INNER JOIN performance_checks pc ON pr.check_id = pc.id
       WHERE pc.organization_id IN (SELECT organization_id FROM projects WHERE id = $1)
         AND pr.checked_at >= $2
         AND pr.checked_at <= $3
       ORDER BY pr.checked_at DESC
       LIMIT 1`,
      [projectId, periodStart, periodEnd],
    );

    let metrics: any = null;
    let lighthouseScore: number | null = null;

    if (perfResult && perfResult.rows.length > 0) {
      metrics = perfResult.rows[0].metrics;
      lighthouseScore = perfResult.rows[0].lighthouse_score;
    } else {
      // Fall back to test_runs with performance/lighthouse type
      const runResult = await query<any>(
        `SELECT metrics, results, status
         FROM test_runs
         WHERE project_id = $1
           AND (test_type = 'performance' OR test_type = 'lighthouse')
           AND created_at >= $2
           AND created_at <= $3
         ORDER BY created_at DESC
         LIMIT 1`,
        [projectId, periodStart, periodEnd],
      );

      if (runResult && runResult.rows.length > 0) {
        metrics = runResult.rows[0].metrics;
      }
    }

    if (!metrics && lighthouseScore === null) return emptySection;

    // Extract metrics from the JSONB structure
    const m = metrics || {};
    const score = lighthouseScore ?? m.score ?? m.lighthouse_score ?? 0;
    const lcp = m.lcp ?? m.largest_contentful_paint ?? 0;
    const fid = m.fid ?? m.first_input_delay ?? 0;
    const cls = m.cls ?? m.cumulative_layout_shift ?? 0;
    const ttfb = m.ttfb ?? m.time_to_first_byte ?? 0;
    const fcp = m.fcp ?? m.first_contentful_paint ?? 0;
    const tti = m.tti ?? m.time_to_interactive ?? 0;
    const speedIndex = m.speedIndex ?? m.speed_index ?? 0;

    const rateMetric = (value: number, good: number, poor: number): 'good' | 'needs-improvement' | 'poor' => {
      if (value <= 0) return 'poor';
      return value < good ? 'good' : value < poor ? 'needs-improvement' : 'poor';
    };

    const audits: PerformanceReportSection['audits'] = [];

    if (lcp > 0) {
      audits.push({
        id: 'lcp', title: 'Largest Contentful Paint',
        score: lcp < 2500 ? 100 : lcp < 4000 ? 50 : 0,
        category: 'performance', displayValue: `${(lcp / 1000).toFixed(1)}s`,
      });
    }
    if (fid > 0) {
      audits.push({
        id: 'fid', title: 'First Input Delay',
        score: fid < 100 ? 100 : fid < 300 ? 50 : 0,
        category: 'performance', displayValue: `${fid}ms`,
      });
    }
    if (cls > 0) {
      audits.push({
        id: 'cls', title: 'Cumulative Layout Shift',
        score: cls < 0.1 ? 100 : cls < 0.25 ? 50 : 0,
        category: 'performance', displayValue: cls.toFixed(3),
      });
    }

    // Include any extra audits stored in metrics
    const extraAudits: any[] = m.audits || [];
    for (const a of extraAudits) {
      audits.push({
        id: a.id || `audit-${audits.length}`,
        title: a.title || a.name || '',
        score: a.score ?? 0,
        category: a.category || 'performance',
        displayValue: a.displayValue || a.display_value || undefined,
        description: a.description || undefined,
      });
    }

    return {
      type: 'performance',
      summary: {
        score: Math.round(score),
        lcp: Math.round(lcp),
        fid: Math.round(fid),
        cls: Math.round(cls * 100) / 100,
        ttfb: Math.round(ttfb),
        fcp: Math.round(fcp),
        tti: Math.round(tti),
        speedIndex: Math.round(speedIndex),
      },
      audits,
      coreWebVitals: {
        lcp: { value: lcp, rating: rateMetric(lcp, 2500, 4000) },
        fid: { value: fid, rating: rateMetric(fid, 100, 300) },
        cls: { value: cls, rating: rateMetric(cls, 0.1, 0.25) },
      },
    };
  } catch (error) {
    console.error('[ReportGenerator] Failed to generate Performance section:', error);
    return emptySection;
  }
}

/**
 * Build the Load Test report section from real test_runs data.
 * Queries test runs with test_type='load_test' and extracts metrics.
 */
async function generateLoadSection(
  projectId: string,
  periodStart: string,
  periodEnd: string,
): Promise<LoadReportSection> {
  const emptySection: LoadReportSection = {
    type: 'load',
    summary: { vus: 0, duration: 0, requestsTotal: 0, requestsFailed: 0, rps: 0 },
    latency: { p50: 0, p95: 0, p99: 0, avg: 0, min: 0, max: 0 },
    thresholds: [],
    scenarios: [],
  };

  if (!isDatabaseConnected()) return emptySection;

  try {
    const runsResult = await query<any>(
      `SELECT metrics, results, duration_ms, status
       FROM test_runs
       WHERE project_id = $1
         AND test_type = 'load_test'
         AND created_at >= $2
         AND created_at <= $3
       ORDER BY created_at DESC
       LIMIT 1`,
      [projectId, periodStart, periodEnd],
    );

    if (!runsResult || runsResult.rows.length === 0) return emptySection;

    const row = runsResult.rows[0];
    const m = row.metrics || {};

    const vus = m.vus ?? m.virtual_users ?? 0;
    const duration = m.duration ?? (row.duration_ms ? Math.round(row.duration_ms / 1000) : 0);
    const requestsTotal = m.requestsTotal ?? m.requests_total ?? m.http_reqs ?? 0;
    const requestsFailed = m.requestsFailed ?? m.requests_failed ?? m.http_req_failed ?? 0;
    const rps = m.rps ?? m.requests_per_second ?? (duration > 0 ? Math.round(requestsTotal / duration) : 0);

    const latency = {
      p50: m.p50 ?? m.latency_p50 ?? m.http_req_duration_p50 ?? 0,
      p95: m.p95 ?? m.latency_p95 ?? m.http_req_duration_p95 ?? 0,
      p99: m.p99 ?? m.latency_p99 ?? m.http_req_duration_p99 ?? 0,
      avg: m.avg ?? m.latency_avg ?? m.http_req_duration_avg ?? 0,
      min: m.min ?? m.latency_min ?? m.http_req_duration_min ?? 0,
      max: m.max ?? m.latency_max ?? m.http_req_duration_max ?? 0,
    };

    // Extract thresholds if stored in metrics
    const thresholds: LoadReportSection['thresholds'] = [];
    const storedThresholds: any[] = m.thresholds || [];
    for (const t of storedThresholds) {
      thresholds.push({
        name: t.name || '',
        passed: !!t.passed,
        value: String(t.value || ''),
        threshold: String(t.threshold || ''),
      });
    }

    // Extract scenarios if stored in metrics
    const scenarios: LoadReportSection['scenarios'] = [];
    const storedScenarios: any[] = m.scenarios || [];
    for (const s of storedScenarios) {
      scenarios.push({
        name: s.name || '',
        vus: s.vus ?? 0,
        duration: String(s.duration || ''),
        rps: s.rps ?? 0,
        errorRate: s.errorRate ?? s.error_rate ?? 0,
      });
    }

    return {
      type: 'load',
      summary: { vus, duration, requestsTotal, requestsFailed, rps },
      latency,
      thresholds,
      scenarios,
    };
  } catch (error) {
    console.error('[ReportGenerator] Failed to generate Load section:', error);
    return emptySection;
  }
}

/**
 * Build the Security report section from real DAST and SAST scan data.
 * Aggregates findings from both dast_scans and sast_scans tables.
 */
async function generateSecuritySection(
  projectId: string,
  periodStart: string,
  periodEnd: string,
): Promise<SecurityReportSection> {
  const emptySection: SecurityReportSection = {
    type: 'security',
    summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0, riskScore: 0 },
    vulnerabilities: [],
    headers: { present: [], missing: [], misconfigured: [] },
  };

  if (!isDatabaseConnected()) return emptySection;

  try {
    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;
    let info = 0;
    const vulnerabilities: SecurityReportSection['vulnerabilities'] = [];
    let headersPresent: string[] = [];
    let headersMissing: string[] = [];
    let headersMisconfigured: string[] = [];

    // Query DAST scans for this project within the period
    const dastResult = await query<any>(
      `SELECT alerts, summary, statistics
       FROM dast_scans
       WHERE project_id = $1
         AND created_at >= $2
         AND created_at <= $3
       ORDER BY created_at DESC`,
      [projectId, periodStart, periodEnd],
    );

    if (dastResult && dastResult.rows.length > 0) {
      for (const row of dastResult.rows) {
        const alerts: any[] = row.alerts || [];
        for (const alert of alerts) {
          const severity = (alert.risk || alert.severity || 'info').toLowerCase();
          if (severity === 'critical') critical++;
          else if (severity === 'high') high++;
          else if (severity === 'medium') medium++;
          else if (severity === 'low') low++;
          else info++;

          if (vulnerabilities.length < 100) {
            vulnerabilities.push({
              id: alert.id || alert.pluginId || `dast-${vulnerabilities.length}`,
              name: alert.name || alert.alert || 'Unknown vulnerability',
              severity: severity as 'critical' | 'high' | 'medium' | 'low' | 'info',
              category: alert.category || alert.cweid ? `CWE-${alert.cweid}` : 'DAST Finding',
              description: alert.description || alert.desc || '',
              location: alert.url || alert.uri || undefined,
              cwe: alert.cweid ? `CWE-${alert.cweid}` : alert.cwe || undefined,
              remediation: alert.solution || alert.remediation || undefined,
            });
          }
        }

        // Extract header info from DAST summary if available
        const summary = row.summary || {};
        if (summary.headers) {
          headersPresent = summary.headers.present || headersPresent;
          headersMissing = summary.headers.missing || headersMissing;
          headersMisconfigured = summary.headers.misconfigured || headersMisconfigured;
        }
      }
    }

    // Query SAST scans for this project within the period
    const sastResult = await query<any>(
      `SELECT findings, summary
       FROM sast_scans
       WHERE project_id = $1
         AND created_at >= $2
         AND created_at <= $3
       ORDER BY created_at DESC`,
      [projectId, periodStart, periodEnd],
    );

    if (sastResult && sastResult.rows.length > 0) {
      for (const row of sastResult.rows) {
        const findings: any[] = row.findings || [];
        for (const finding of findings) {
          const severity = (finding.severity || 'info').toLowerCase();
          if (severity === 'critical') critical++;
          else if (severity === 'high') high++;
          else if (severity === 'medium') medium++;
          else if (severity === 'low') low++;
          else info++;

          if (vulnerabilities.length < 100) {
            vulnerabilities.push({
              id: finding.id || finding.ruleId || `sast-${vulnerabilities.length}`,
              name: finding.name || finding.rule || finding.ruleId || 'Unknown finding',
              severity: severity as 'critical' | 'high' | 'medium' | 'low' | 'info',
              category: finding.category || 'SAST Finding',
              description: finding.description || finding.message || '',
              location: finding.file ? `${finding.file}:${finding.line || ''}` : undefined,
              cwe: finding.cwe || (finding.cweid ? `CWE-${finding.cweid}` : undefined),
              remediation: finding.remediation || finding.fix || undefined,
            });
          }
        }
      }
    }

    const total = critical + high + medium + low + info;
    // Risk score: 0 = safest, 100 = most risky
    const riskScore = total > 0
      ? Math.min(100, Math.round(critical * 30 + high * 15 + medium * 5 + low * 2 + info * 0.5))
      : 0;

    return {
      type: 'security',
      summary: { total, critical, high, medium, low, info, riskScore },
      vulnerabilities,
      headers: {
        present: headersPresent,
        missing: headersMissing,
        misconfigured: headersMisconfigured,
      },
    };
  } catch (error) {
    console.error('[ReportGenerator] Failed to generate Security section:', error);
    return emptySection;
  }
}

// ============================================================================
// Executive Summary (unchanged logic, operates on real data from sections)
// ============================================================================

function generateExecutiveSummary(sections: ComprehensiveReport['sections']): ComprehensiveReport['executiveSummary'] {
  const scores: number[] = [];
  const highlights: string[] = [];
  const criticalIssues: string[] = [];
  const recommendations: string[] = [];

  if (sections.e2e) {
    scores.push(sections.e2e.summary.passRate);
    if (sections.e2e.summary.passRate >= 95) {
      highlights.push(`E2E tests passing at ${sections.e2e.summary.passRate}%`);
    }
    if (sections.e2e.summary.failed > 0) {
      criticalIssues.push(`${sections.e2e.summary.failed} E2E tests failing`);
      recommendations.push('Review and fix failing E2E tests before deployment');
    }
  }

  if (sections.visual) {
    const visualScore = sections.visual.summary.total > 0
      ? ((sections.visual.summary.noChange + sections.visual.summary.approved) / sections.visual.summary.total) * 100
      : 0;
    scores.push(visualScore);
    if (sections.visual.summary.pending > 0) {
      criticalIssues.push(`${sections.visual.summary.pending} visual changes pending review`);
      recommendations.push('Review pending visual changes in Visual Review dashboard');
    }
  }

  if (sections.accessibility) {
    scores.push(sections.accessibility.summary.wcagCompliance);
    if (sections.accessibility.summary.critical > 0) {
      criticalIssues.push(`${sections.accessibility.summary.critical} critical accessibility violations`);
      recommendations.push('Fix critical accessibility issues for WCAG compliance');
    }
    if (sections.accessibility.summary.wcagCompliance >= 90) {
      highlights.push(`WCAG compliance at ${sections.accessibility.summary.wcagCompliance}%`);
    }
  }

  if (sections.performance) {
    scores.push(sections.performance.summary.score);
    const cwv = sections.performance.coreWebVitals;
    const goodCWV = [cwv.lcp.rating, cwv.fid.rating, cwv.cls.rating].filter(r => r === 'good').length;
    if (goodCWV === 3) {
      highlights.push('All Core Web Vitals passing');
    } else if (goodCWV < 2) {
      recommendations.push('Improve Core Web Vitals for better user experience');
    }
  }

  if (sections.load) {
    const thresholdsPassed = sections.load.thresholds.filter(t => t.passed).length;
    const loadScore = sections.load.thresholds.length > 0
      ? (thresholdsPassed / sections.load.thresholds.length) * 100
      : 0;
    scores.push(loadScore);
    if (loadScore === 100 && sections.load.thresholds.length > 0) {
      highlights.push(`Load test passing all ${sections.load.thresholds.length} thresholds`);
    }
  }

  if (sections.security) {
    const securityScore = 100 - sections.security.summary.riskScore;
    scores.push(securityScore);
    if (sections.security.summary.critical > 0) {
      criticalIssues.push(`${sections.security.summary.critical} critical security vulnerabilities`);
      recommendations.push('Address critical security vulnerabilities immediately');
    }
    if (securityScore >= 90) {
      highlights.push('Security scan shows low risk');
    }
  }

  const overallScore = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;

  return {
    overallScore,
    overallStatus: overallScore >= 80 ? 'passing' : overallScore >= 60 ? 'warning' : 'failing',
    highlights: highlights.slice(0, 5),
    criticalIssues: criticalIssues.slice(0, 5),
    recommendations: recommendations.slice(0, 5),
  };
}

// ============================================================================
// Main entry point
// ============================================================================

export async function generateReport(
  request: GenerateReportRequest,
  createdBy: string,
  baseUrl: string
): Promise<ComprehensiveReport> {
  const reportId = generateReportId();

  // Determine which sections to include
  const includeSections = request.includeSections || ['e2e', 'visual', 'accessibility', 'performance', 'load', 'security'];

  const now = new Date();
  const periodStart = request.period?.start || new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const periodEnd = request.period?.end || now.toISOString();

  // Fetch project name from the database
  let projectName = `Project ${request.projectId}`;
  try {
    const project = await getProject(request.projectId);
    if (project) {
      projectName = project.name;
    }
  } catch {
    // Fall back to default name if project lookup fails
  }

  // Build all requested sections in parallel from real database data
  const sections: ComprehensiveReport['sections'] = {};

  const sectionPromises: Promise<void>[] = [];

  if (includeSections.includes('e2e')) {
    sectionPromises.push(
      generateE2ESection(request.projectId, periodStart, periodEnd)
        .then(s => { sections.e2e = s; }),
    );
  }
  if (includeSections.includes('visual')) {
    sectionPromises.push(
      generateVisualSection(request.projectId, periodStart, periodEnd)
        .then(s => { sections.visual = s; }),
    );
  }
  if (includeSections.includes('accessibility')) {
    sectionPromises.push(
      generateAccessibilitySection(request.projectId, periodStart, periodEnd)
        .then(s => { sections.accessibility = s; }),
    );
  }
  if (includeSections.includes('performance')) {
    sectionPromises.push(
      generatePerformanceSection(request.projectId, periodStart, periodEnd)
        .then(s => { sections.performance = s; }),
    );
  }
  if (includeSections.includes('load')) {
    sectionPromises.push(
      generateLoadSection(request.projectId, periodStart, periodEnd)
        .then(s => { sections.load = s; }),
    );
  }
  if (includeSections.includes('security')) {
    sectionPromises.push(
      generateSecuritySection(request.projectId, periodStart, periodEnd)
        .then(s => { sections.security = s; }),
    );
  }

  await Promise.all(sectionPromises);

  const report: ComprehensiveReport = {
    id: reportId,
    projectId: request.projectId,
    projectName,
    createdAt: now.toISOString(),
    createdBy,

    title: request.title || `Comprehensive Test Report - ${now.toLocaleDateString()}`,
    description: request.description,
    period: {
      start: periodStart,
      end: periodEnd,
    },

    executiveSummary: generateExecutiveSummary(sections),
    sections,

    generatedBy: 'mcp',
    format: request.format || 'html',
    viewUrl: `${baseUrl}/reports/${reportId}`,
  };

  // Store the report
  await storeReport(report);

  return report;
}
