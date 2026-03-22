/**
 * Reports API Routes
 * Feature #1732: Comprehensive report generation and viewing
 * Feature #469: PDF/CSV/HTML export functionality
 */

import { FastifyInstance } from 'fastify';
import { getReport, listReports, deleteReport } from './stores.js';
import { generateReport } from './generator.js';
import { GenerateReportRequest, ComprehensiveReport } from './types.js';

import { sendError } from '../../utils/errors.js';
import { escapeHTML } from '../../utils/index.js';
/**
 * Generate CSV content from report data
 */
function generateCSV(report: ComprehensiveReport): string {
  const rows: string[][] = [];

  // Header
  rows.push(['Report: ' + report.title]);
  rows.push(['Project: ' + report.projectName]);
  rows.push(['Generated: ' + new Date(report.createdAt).toLocaleString()]);
  rows.push(['Period: ' + new Date(report.period.start).toLocaleDateString() + ' - ' + new Date(report.period.end).toLocaleDateString()]);
  rows.push([]);

  // Executive Summary
  rows.push(['EXECUTIVE SUMMARY']);
  rows.push(['Overall Score', String(report.executiveSummary.overallScore)]);
  rows.push(['Status', report.executiveSummary.overallStatus]);
  rows.push([]);

  if (report.executiveSummary.highlights.length > 0) {
    rows.push(['Highlights']);
    report.executiveSummary.highlights.forEach(h => rows.push(['', h]));
    rows.push([]);
  }

  if (report.executiveSummary.criticalIssues.length > 0) {
    rows.push(['Critical Issues']);
    report.executiveSummary.criticalIssues.forEach(i => rows.push(['', i]));
    rows.push([]);
  }

  // E2E Section
  if (report.sections.e2e) {
    rows.push(['E2E TESTS']);
    rows.push(['Total', 'Passed', 'Failed', 'Skipped', 'Pass Rate', 'Avg Duration (ms)']);
    rows.push([
      String(report.sections.e2e.summary.total),
      String(report.sections.e2e.summary.passed),
      String(report.sections.e2e.summary.failed),
      String(report.sections.e2e.summary.skipped),
      report.sections.e2e.summary.passRate + '%',
      String(report.sections.e2e.summary.avgDuration),
    ]);
    rows.push([]);

    if (report.sections.e2e.tests.length > 0) {
      rows.push(['Test Name', 'Status', 'Duration (ms)', 'Error']);
      report.sections.e2e.tests.forEach(t => {
        rows.push([t.name, t.status, String(t.duration), t.error || '']);
      });
      rows.push([]);
    }
  }

  // Visual Section
  if (report.sections.visual) {
    rows.push(['VISUAL REGRESSION']);
    rows.push(['Total', 'No Change', 'Diffs Detected', 'Approved', 'Pending']);
    rows.push([
      String(report.sections.visual.summary.total),
      String(report.sections.visual.summary.noChange),
      String(report.sections.visual.summary.diffsDetected),
      String(report.sections.visual.summary.approved),
      String(report.sections.visual.summary.pending),
    ]);
    rows.push([]);
  }

  // Accessibility Section
  if (report.sections.accessibility) {
    rows.push(['ACCESSIBILITY']);
    rows.push(['Total Violations', 'Critical', 'Serious', 'Moderate', 'Minor', 'WCAG Compliance']);
    rows.push([
      String(report.sections.accessibility.summary.total),
      String(report.sections.accessibility.summary.critical),
      String(report.sections.accessibility.summary.serious),
      String(report.sections.accessibility.summary.moderate),
      String(report.sections.accessibility.summary.minor),
      report.sections.accessibility.summary.wcagCompliance + '%',
    ]);
    rows.push([]);

    if (report.sections.accessibility.violations.length > 0) {
      rows.push(['Rule', 'Impact', 'WCAG Level', 'Description', 'Nodes Affected']);
      report.sections.accessibility.violations.forEach(v => {
        rows.push([v.rule, v.impact, v.wcagLevel, v.description, String(v.nodes)]);
      });
      rows.push([]);
    }
  }

  // Performance Section
  if (report.sections.performance) {
    rows.push(['PERFORMANCE']);
    rows.push(['Score', 'LCP (ms)', 'FID (ms)', 'CLS', 'TTFB (ms)', 'FCP (ms)', 'TTI (ms)', 'Speed Index']);
    rows.push([
      String(report.sections.performance.summary.score),
      String(report.sections.performance.summary.lcp),
      String(report.sections.performance.summary.fid),
      String(report.sections.performance.summary.cls),
      String(report.sections.performance.summary.ttfb),
      String(report.sections.performance.summary.fcp),
      String(report.sections.performance.summary.tti),
      String(report.sections.performance.summary.speedIndex),
    ]);
    rows.push([]);
  }

  // Load Section
  if (report.sections.load) {
    rows.push(['LOAD TESTING']);
    rows.push(['Virtual Users', 'Duration (s)', 'Total Requests', 'Failed Requests', 'RPS']);
    rows.push([
      String(report.sections.load.summary.vus),
      String(report.sections.load.summary.duration),
      String(report.sections.load.summary.requestsTotal),
      String(report.sections.load.summary.requestsFailed),
      String(report.sections.load.summary.rps),
    ]);
    rows.push([]);
    rows.push(['Latency P50 (ms)', 'P95 (ms)', 'P99 (ms)', 'Avg (ms)', 'Min (ms)', 'Max (ms)']);
    rows.push([
      String(report.sections.load.latency.p50),
      String(report.sections.load.latency.p95),
      String(report.sections.load.latency.p99),
      String(report.sections.load.latency.avg),
      String(report.sections.load.latency.min),
      String(report.sections.load.latency.max),
    ]);
    rows.push([]);
  }

  // Security Section
  if (report.sections.security) {
    rows.push(['SECURITY']);
    rows.push(['Total', 'Critical', 'High', 'Medium', 'Low', 'Info', 'Risk Score']);
    rows.push([
      String(report.sections.security.summary.total),
      String(report.sections.security.summary.critical),
      String(report.sections.security.summary.high),
      String(report.sections.security.summary.medium),
      String(report.sections.security.summary.low),
      String(report.sections.security.summary.info),
      String(report.sections.security.summary.riskScore),
    ]);
    rows.push([]);

    if (report.sections.security.vulnerabilities.length > 0) {
      rows.push(['Vulnerability', 'Severity', 'Category', 'Description']);
      report.sections.security.vulnerabilities.forEach(v => {
        rows.push([v.name, v.severity, v.category, v.description]);
      });
    }
  }

  // Convert to CSV string
  return rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
}

/**
 * Generate HTML content from report data (for PDF printing)
 */
function generateHTML(report: ComprehensiveReport): string {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passing':
      case 'passed':
      case 'match':
      case 'approved':
        return '#22c55e';
      case 'warning':
      case 'pending':
        return '#f59e0b';
      case 'failing':
      case 'failed':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical':
        return '#dc2626';
      case 'high':
      case 'serious':
        return '#ef4444';
      case 'medium':
      case 'moderate':
        return '#f59e0b';
      case 'low':
      case 'minor':
        return '#3b82f6';
      default:
        return '#6b7280';
    }
  };

  let html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHTML(report.title)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; max-width: 1200px; margin: 0 auto; padding: 40px 20px; }
    h1 { font-size: 2rem; margin-bottom: 0.5rem; color: #111827; }
    h2 { font-size: 1.5rem; margin: 2rem 0 1rem; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.5rem; }
    h3 { font-size: 1.25rem; margin: 1.5rem 0 0.75rem; color: #4b5563; }
    .meta { color: #6b7280; margin-bottom: 2rem; }
    .score-badge { display: inline-flex; align-items: center; justify-content: center; width: 80px; height: 80px; border-radius: 50%; color: white; font-size: 1.75rem; font-weight: bold; margin-right: 1rem; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 0.875rem; font-weight: 500; color: white; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin: 1rem 0; }
    .summary-card { background: #f9fafb; border-radius: 8px; padding: 1rem; text-align: center; }
    .summary-card .value { font-size: 1.5rem; font-weight: bold; color: #111827; }
    .summary-card .label { font-size: 0.875rem; color: #6b7280; }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
    th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 600; color: #374151; }
    tr:hover { background: #f9fafb; }
    .highlight-list { list-style: none; }
    .highlight-list li { padding: 0.5rem 0; padding-left: 1.5rem; position: relative; }
    .highlight-list li::before { content: ''; position: absolute; left: 0; top: 0.75rem; width: 8px; height: 8px; border-radius: 50%; }
    .highlight-list.success li::before { background: #22c55e; }
    .highlight-list.warning li::before { background: #ef4444; }
    .highlight-list.info li::before { background: #3b82f6; }
    @media print {
      body { padding: 20px; }
      h2 { page-break-before: auto; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHTML(report.title)}</h1>
    <p class="meta">
      Project: ${escapeHTML(report.projectName)} |
      Generated: ${new Date(report.createdAt).toLocaleString()} |
      Period: ${new Date(report.period.start).toLocaleDateString()} - ${new Date(report.period.end).toLocaleDateString()}
    </p>
    <div style="display: flex; align-items: center; margin-top: 1rem;">
      <div class="score-badge" style="background: ${report.executiveSummary.overallScore >= 80 ? '#22c55e' : report.executiveSummary.overallScore >= 60 ? '#f59e0b' : '#ef4444'}">
        ${report.executiveSummary.overallScore}
      </div>
      <span class="status-badge" style="background: ${getStatusColor(report.executiveSummary.overallStatus)}">
        ${report.executiveSummary.overallStatus.charAt(0).toUpperCase() + report.executiveSummary.overallStatus.slice(1)}
      </span>
    </div>
  </header>

  <h2>Executive Summary</h2>
  <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
    <div>
      <h3 style="color: #22c55e;">Highlights</h3>
      <ul class="highlight-list success">
        ${report.executiveSummary.highlights.length > 0
          ? report.executiveSummary.highlights.map(h => `<li>${escapeHTML(h)}</li>`).join('')
          : '<li><em>No highlights</em></li>'}
      </ul>
    </div>
    <div>
      <h3 style="color: #ef4444;">Critical Issues</h3>
      <ul class="highlight-list warning">
        ${report.executiveSummary.criticalIssues.length > 0
          ? report.executiveSummary.criticalIssues.map(i => `<li>${escapeHTML(i)}</li>`).join('')
          : '<li style="color: #22c55e;"><em>No critical issues</em></li>'}
      </ul>
    </div>
    <div>
      <h3 style="color: #3b82f6;">Recommendations</h3>
      <ul class="highlight-list info">
        ${report.executiveSummary.recommendations.length > 0
          ? report.executiveSummary.recommendations.map(r => `<li>${escapeHTML(r)}</li>`).join('')
          : '<li><em>No recommendations</em></li>'}
      </ul>
    </div>
  </div>`;

  // E2E Section
  if (report.sections.e2e && report.sections.e2e.summary.total > 0) {
    html += `
  <h2>E2E Tests</h2>
  <div class="summary-grid">
    <div class="summary-card"><div class="value">${report.sections.e2e.summary.total}</div><div class="label">Total Tests</div></div>
    <div class="summary-card" style="background: #dcfce7;"><div class="value" style="color: #22c55e;">${report.sections.e2e.summary.passed}</div><div class="label">Passed</div></div>
    <div class="summary-card" style="background: #fef2f2;"><div class="value" style="color: #ef4444;">${report.sections.e2e.summary.failed}</div><div class="label">Failed</div></div>
    <div class="summary-card"><div class="value">${report.sections.e2e.summary.skipped}</div><div class="label">Skipped</div></div>
    <div class="summary-card" style="background: #eff6ff;"><div class="value" style="color: #3b82f6;">${report.sections.e2e.summary.passRate}%</div><div class="label">Pass Rate</div></div>
  </div>`;

    if (report.sections.e2e.tests.length > 0) {
      html += `
  <table>
    <thead><tr><th>Test Name</th><th>Status</th><th>Duration</th><th>Error</th></tr></thead>
    <tbody>
      ${report.sections.e2e.tests.slice(0, 20).map(t => `
        <tr>
          <td>${escapeHTML(t.name)}</td>
          <td><span class="status-badge" style="background: ${getStatusColor(t.status)}">${t.status}</span></td>
          <td>${(t.duration / 1000).toFixed(2)}s</td>
          <td style="color: #ef4444; font-size: 0.875rem;">${t.error ? escapeHTML(t.error) : '-'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>`;
    }
  }

  // Accessibility Section
  if (report.sections.accessibility && report.sections.accessibility.summary.total > 0) {
    html += `
  <h2>Accessibility</h2>
  <div class="summary-grid">
    <div class="summary-card"><div class="value">${report.sections.accessibility.summary.total}</div><div class="label">Total Violations</div></div>
    <div class="summary-card" style="background: #fef2f2;"><div class="value" style="color: #dc2626;">${report.sections.accessibility.summary.critical}</div><div class="label">Critical</div></div>
    <div class="summary-card" style="background: #fef2f2;"><div class="value" style="color: #ef4444;">${report.sections.accessibility.summary.serious}</div><div class="label">Serious</div></div>
    <div class="summary-card" style="background: #fffbeb;"><div class="value" style="color: #f59e0b;">${report.sections.accessibility.summary.moderate}</div><div class="label">Moderate</div></div>
    <div class="summary-card" style="background: #eff6ff;"><div class="value" style="color: #3b82f6;">${report.sections.accessibility.summary.minor}</div><div class="label">Minor</div></div>
    <div class="summary-card"><div class="value">${report.sections.accessibility.summary.wcagCompliance}%</div><div class="label">WCAG Compliance</div></div>
  </div>`;

    if (report.sections.accessibility.violations.length > 0) {
      html += `
  <table>
    <thead><tr><th>Rule</th><th>Impact</th><th>WCAG</th><th>Description</th><th>Nodes</th></tr></thead>
    <tbody>
      ${report.sections.accessibility.violations.slice(0, 20).map(v => `
        <tr>
          <td><code>${escapeHTML(v.rule)}</code></td>
          <td><span class="status-badge" style="background: ${getSeverityColor(v.impact)}">${v.impact}</span></td>
          <td>${escapeHTML(v.wcagLevel)}</td>
          <td style="font-size: 0.875rem;">${escapeHTML(v.description)}</td>
          <td>${v.nodes}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>`;
    }
  }

  // Performance Section
  if (report.sections.performance && report.sections.performance.summary.score > 0) {
    html += `
  <h2>Performance</h2>
  <div style="text-align: center; margin: 1rem 0;">
    <div class="score-badge" style="width: 100px; height: 100px; font-size: 2rem; background: ${report.sections.performance.summary.score >= 90 ? '#22c55e' : report.sections.performance.summary.score >= 50 ? '#f59e0b' : '#ef4444'}; display: inline-flex;">
      ${report.sections.performance.summary.score}
    </div>
    <p style="margin-top: 0.5rem; color: #6b7280;">Performance Score</p>
  </div>
  <h3>Core Web Vitals</h3>
  <div class="summary-grid">
    <div class="summary-card">
      <div class="value">${(report.sections.performance.coreWebVitals.lcp.value / 1000).toFixed(1)}s</div>
      <div class="label">LCP (${report.sections.performance.coreWebVitals.lcp.rating})</div>
    </div>
    <div class="summary-card">
      <div class="value">${report.sections.performance.coreWebVitals.fid.value}ms</div>
      <div class="label">FID (${report.sections.performance.coreWebVitals.fid.rating})</div>
    </div>
    <div class="summary-card">
      <div class="value">${report.sections.performance.coreWebVitals.cls.value.toFixed(3)}</div>
      <div class="label">CLS (${report.sections.performance.coreWebVitals.cls.rating})</div>
    </div>
  </div>`;
  }

  // Security Section
  if (report.sections.security && report.sections.security.summary.total > 0) {
    html += `
  <h2>Security</h2>
  <div class="summary-grid">
    <div class="summary-card"><div class="value">${report.sections.security.summary.total}</div><div class="label">Total Findings</div></div>
    <div class="summary-card" style="background: #fef2f2;"><div class="value" style="color: #dc2626;">${report.sections.security.summary.critical}</div><div class="label">Critical</div></div>
    <div class="summary-card" style="background: #fef2f2;"><div class="value" style="color: #ef4444;">${report.sections.security.summary.high}</div><div class="label">High</div></div>
    <div class="summary-card" style="background: #fffbeb;"><div class="value" style="color: #f59e0b;">${report.sections.security.summary.medium}</div><div class="label">Medium</div></div>
    <div class="summary-card" style="background: #eff6ff;"><div class="value" style="color: #3b82f6;">${report.sections.security.summary.low}</div><div class="label">Low</div></div>
    <div class="summary-card"><div class="value">${report.sections.security.summary.riskScore}</div><div class="label">Risk Score</div></div>
  </div>`;

    if (report.sections.security.vulnerabilities.length > 0) {
      html += `
  <table>
    <thead><tr><th>Vulnerability</th><th>Severity</th><th>Category</th><th>Description</th></tr></thead>
    <tbody>
      ${report.sections.security.vulnerabilities.slice(0, 20).map(v => `
        <tr>
          <td>${escapeHTML(v.name)}</td>
          <td><span class="status-badge" style="background: ${getSeverityColor(v.severity)}">${v.severity}</span></td>
          <td>${escapeHTML(v.category)}</td>
          <td style="font-size: 0.875rem;">${escapeHTML(v.description)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>`;
    }
  }

  html += `
  <footer style="margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 0.875rem;">
    <p>Generated by QA Guardian | ${new Date().toISOString()}</p>
  </footer>
</body>
</html>`;

  return html;
}

export async function reportsRoutes(fastify: FastifyInstance) {
  // Generate a new comprehensive report
  fastify.post<{
    Body: GenerateReportRequest;
  }>('/api/v1/reports/generate', {
    preHandler: async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        sendError(reply, 401, 'UNAUTHORIZED', 'Unauthorized');
      }
    },
  }, async (request, reply) => {
    const user = request.user as { email?: string; id?: string } | undefined;
    const createdBy = user?.email || user?.id || 'unknown';

    // Get the base URL for the viewUrl
    const protocol = request.headers['x-forwarded-proto'] || 'http';
    const host = request.headers['x-forwarded-host'] || request.headers.host || 'localhost:5173';
    const baseUrl = `${protocol}://${host}`;

    try {
      const report = await generateReport(request.body, createdBy, baseUrl);

      return reply.send({
        success: true,
        report: {
          id: report.id,
          title: report.title,
          overallScore: report.executiveSummary.overallScore,
          overallStatus: report.executiveSummary.overallStatus,
          viewUrl: report.viewUrl,
          createdAt: report.createdAt,
        },
        message: `Report generated successfully. View at: ${report.viewUrl}`,
      });
    } catch (error) {
      fastify.log.error(error);
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error instanceof Error ? error.message : 'Unknown error');
    }
  });

  // Get a specific report by ID
  fastify.get<{
    Params: { reportId: string };
  }>('/api/v1/reports/:reportId', {
    preHandler: async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        sendError(reply, 401, 'UNAUTHORIZED', 'Unauthorized');
      }
    },
  }, async (request, reply) => {
    const { reportId } = request.params;
    const report = await getReport(reportId);

    if (!report) {
      return sendError(reply, 404, 'NOT_FOUND', `No report found with ID: ${reportId}`);
    }

    return reply.send({ report });
  });

  // List all reports (optionally filtered by project)
  fastify.get<{
    Querystring: { project_id?: string };
  }>('/api/v1/reports', {
    preHandler: async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        sendError(reply, 401, 'UNAUTHORIZED', 'Unauthorized');
      }
    },
  }, async (request, reply) => {
    const { project_id } = request.query;
    const reports = await listReports(project_id);

    return reply.send({
      reports,
      count: reports.length,
    });
  });

  // Delete a report
  fastify.delete<{
    Params: { reportId: string };
  }>('/api/v1/reports/:reportId', {
    preHandler: async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        sendError(reply, 401, 'UNAUTHORIZED', 'Unauthorized');
      }
    },
  }, async (request, reply) => {
    const { reportId } = request.params;
    const deleted = await deleteReport(reportId);

    if (!deleted) {
      return sendError(reply, 404, 'NOT_FOUND', `No report found with ID: ${reportId}`);
    }

    return reply.send({
      success: true,
      message: 'Report deleted successfully',
    });
  });

  // Feature #469: Export report in various formats (PDF, CSV, HTML)
  fastify.get<{
    Params: { reportId: string };
    Querystring: { format?: 'pdf' | 'csv' | 'html' | 'json' };
  }>('/api/v1/reports/:reportId/export', {
    preHandler: async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        sendError(reply, 401, 'UNAUTHORIZED', 'Unauthorized');
      }
    },
  }, async (request, reply) => {
    const { reportId } = request.params;
    const format = request.query.format || 'html';

    const report = await getReport(reportId);

    if (!report) {
      return sendError(reply, 404, 'NOT_FOUND', `No report found with ID: ${reportId}`);
    }

    // Generate filename with date
    const dateStr = new Date().toISOString().split('T')[0];
    const safeTitle = report.title.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 50);
    const filename = `report-${safeTitle}-${dateStr}`;

    switch (format) {
      case 'csv': {
        const csvContent = generateCSV(report);
        reply.header('Content-Type', 'text/csv; charset=utf-8');
        reply.header('Content-Disposition', `attachment; filename="${filename}.csv"`);
        return reply.send(csvContent);
      }

      case 'html':
      case 'pdf': {
        // For PDF, we serve HTML that can be printed to PDF by the browser
        const htmlContent = generateHTML(report);
        reply.header('Content-Type', 'text/html; charset=utf-8');
        if (format === 'pdf') {
          // Suggest printing - browser will handle the PDF generation
          reply.header('Content-Disposition', `inline; filename="${filename}.html"`);
        } else {
          reply.header('Content-Disposition', `attachment; filename="${filename}.html"`);
        }
        return reply.send(htmlContent);
      }

      case 'json':
      default: {
        reply.header('Content-Type', 'application/json; charset=utf-8');
        reply.header('Content-Disposition', `attachment; filename="${filename}.json"`);
        return reply.send(JSON.stringify(report, null, 2));
      }
    }
  });
}

export default reportsRoutes;
