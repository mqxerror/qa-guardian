// DAST Report Generation Functions

import { DASTScanResult, DASTAlert, ReportFormat } from './types';
import { escapeHTML } from './utils';

// Generate HTML report content
export function generateHTMLReport(scan: DASTScanResult, projectName: string): string {
  const riskColors = {
    High: '#ef4444',
    Medium: '#f59e0b',
    Low: '#3b82f6',
    Informational: '#6b7280',
  };

  const alertsByRisk = {
    High: scan.alerts.filter(a => a.risk === 'High' && !a.isFalsePositive),
    Medium: scan.alerts.filter(a => a.risk === 'Medium' && !a.isFalsePositive),
    Low: scan.alerts.filter(a => a.risk === 'Low' && !a.isFalsePositive),
    Informational: scan.alerts.filter(a => a.risk === 'Informational' && !a.isFalsePositive),
  };

  const generateAlertHTML = (alert: DASTAlert) => `
    <div class="alert" style="border-left: 4px solid ${riskColors[alert.risk]};">
      <h4 style="margin: 0 0 8px 0; color: ${riskColors[alert.risk]};">${escapeHTML(alert.name)}</h4>
      <div class="alert-meta">
        <span class="badge" style="background: ${riskColors[alert.risk]};">${alert.risk}</span>
        <span class="badge confidence">${alert.confidence} Confidence</span>
        ${alert.cweId ? `<span class="badge cwe">CWE-${alert.cweId}</span>` : ''}
      </div>
      <p><strong>URL:</strong> <code>${escapeHTML(alert.url)}</code></p>
      <p><strong>Method:</strong> ${alert.method}</p>
      ${alert.param ? `<p><strong>Parameter:</strong> <code>${escapeHTML(alert.param)}</code></p>` : ''}
      ${alert.attack ? `<p><strong>Attack:</strong> <code>${escapeHTML(alert.attack)}</code></p>` : ''}
      ${alert.evidence ? `<p><strong>Evidence:</strong> <pre>${escapeHTML(alert.evidence)}</pre></p>` : ''}
      <p><strong>Description:</strong> ${escapeHTML(alert.description)}</p>
      <p><strong>Solution:</strong> ${escapeHTML(alert.solution)}</p>
    </div>
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DAST Security Report - ${escapeHTML(projectName)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 20px;
      background: #f9fafb;
      color: #1f2937;
    }
    .header {
      background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
      color: white;
      padding: 40px;
      border-radius: 12px;
      margin-bottom: 30px;
    }
    .header h1 { margin: 0 0 10px 0; font-size: 28px; }
    .header p { margin: 5px 0; opacity: 0.9; }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .summary-card {
      background: white;
      padding: 24px;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      text-align: center;
    }
    .summary-card h3 { margin: 0; font-size: 14px; color: #6b7280; text-transform: uppercase; }
    .summary-card .value { font-size: 36px; font-weight: bold; margin: 10px 0; }
    .summary-card.high .value { color: #ef4444; }
    .summary-card.medium .value { color: #f59e0b; }
    .summary-card.low .value { color: #3b82f6; }
    .summary-card.info .value { color: #6b7280; }
    .section {
      background: white;
      padding: 30px;
      border-radius: 12px;
      margin-bottom: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .section h2 {
      margin: 0 0 20px 0;
      padding-bottom: 15px;
      border-bottom: 2px solid #e5e7eb;
    }
    .alert {
      background: #f9fafb;
      padding: 20px;
      margin-bottom: 20px;
      border-radius: 8px;
    }
    .alert:last-child { margin-bottom: 0; }
    .alert-meta { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      color: white;
    }
    .badge.confidence { background: #6366f1; }
    .badge.cwe { background: #8b5cf6; }
    code {
      background: #e5e7eb;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 13px;
      word-break: break-all;
    }
    pre {
      background: #1f2937;
      color: #e5e7eb;
      padding: 15px;
      border-radius: 6px;
      overflow-x: auto;
      font-size: 13px;
    }
    .statistics {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
    }
    .stat-item { text-align: center; }
    .stat-item .label { color: #6b7280; font-size: 14px; }
    .stat-item .value { font-size: 24px; font-weight: bold; color: #1f2937; }
    .footer {
      text-align: center;
      padding: 30px;
      color: #6b7280;
      font-size: 14px;
    }
    .no-alerts { color: #10b981; font-style: italic; }
    @media print {
      body { background: white; }
      .header { break-after: avoid; }
      .alert { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>DAST Security Report</h1>
    <p><strong>Project:</strong> ${escapeHTML(projectName)}</p>
    <p><strong>Target URL:</strong> ${escapeHTML(scan.targetUrl)}</p>
    <p><strong>Scan Profile:</strong> ${scan.scanProfile.charAt(0).toUpperCase() + scan.scanProfile.slice(1)} Scan</p>
    <p><strong>Scan Date:</strong> ${new Date(scan.startedAt).toLocaleString()}</p>
    <p><strong>Status:</strong> ${scan.status}</p>
  </div>

  <div class="summary">
    <div class="summary-card high">
      <h3>High Risk</h3>
      <div class="value">${scan.summary.byRisk.high}</div>
    </div>
    <div class="summary-card medium">
      <h3>Medium Risk</h3>
      <div class="value">${scan.summary.byRisk.medium}</div>
    </div>
    <div class="summary-card low">
      <h3>Low Risk</h3>
      <div class="value">${scan.summary.byRisk.low}</div>
    </div>
    <div class="summary-card info">
      <h3>Informational</h3>
      <div class="value">${scan.summary.byRisk.informational}</div>
    </div>
  </div>

  ${scan.statistics ? `
  <div class="section">
    <h2>Scan Statistics</h2>
    <div class="statistics">
      <div class="stat-item">
        <div class="value">${scan.statistics.urlsScanned}</div>
        <div class="label">URLs Scanned</div>
      </div>
      <div class="stat-item">
        <div class="value">${scan.statistics.requestsSent}</div>
        <div class="label">Requests Sent</div>
      </div>
      <div class="stat-item">
        <div class="value">${Math.round(scan.statistics.duration / 60)} min</div>
        <div class="label">Duration</div>
      </div>
    </div>
  </div>
  ` : ''}

  <div class="section">
    <h2 style="color: ${riskColors.High};">High Risk Vulnerabilities (${alertsByRisk.High.length})</h2>
    ${alertsByRisk.High.length > 0
      ? alertsByRisk.High.map(generateAlertHTML).join('')
      : '<p class="no-alerts">No high risk vulnerabilities found.</p>'
    }
  </div>

  <div class="section">
    <h2 style="color: ${riskColors.Medium};">Medium Risk Vulnerabilities (${alertsByRisk.Medium.length})</h2>
    ${alertsByRisk.Medium.length > 0
      ? alertsByRisk.Medium.map(generateAlertHTML).join('')
      : '<p class="no-alerts">No medium risk vulnerabilities found.</p>'
    }
  </div>

  <div class="section">
    <h2 style="color: ${riskColors.Low};">Low Risk Vulnerabilities (${alertsByRisk.Low.length})</h2>
    ${alertsByRisk.Low.length > 0
      ? alertsByRisk.Low.map(generateAlertHTML).join('')
      : '<p class="no-alerts">No low risk vulnerabilities found.</p>'
    }
  </div>

  <div class="section">
    <h2 style="color: ${riskColors.Informational};">Informational (${alertsByRisk.Informational.length})</h2>
    ${alertsByRisk.Informational.length > 0
      ? alertsByRisk.Informational.map(generateAlertHTML).join('')
      : '<p class="no-alerts">No informational alerts.</p>'
    }
  </div>

  <div class="footer">
    <p>Generated by QA Guardian DAST Scanner</p>
    <p>Report generated on ${new Date().toLocaleString()}</p>
  </div>
</body>
</html>`;
}

// Generate JSON report content
export function generateJSONReport(scan: DASTScanResult, projectName: string): object {
  return {
    metadata: {
      reportType: 'DAST Security Scan',
      generator: 'QA Guardian',
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
    },
    project: {
      name: projectName,
    },
    scan: {
      id: scan.id,
      targetUrl: scan.targetUrl,
      scanProfile: scan.scanProfile,
      status: scan.status,
      startedAt: scan.startedAt,
      completedAt: scan.completedAt,
      statistics: scan.statistics,
    },
    summary: scan.summary,
    alerts: scan.alerts.filter(a => !a.isFalsePositive).map(alert => ({
      id: alert.id,
      pluginId: alert.pluginId,
      name: alert.name,
      risk: alert.risk,
      confidence: alert.confidence,
      url: alert.url,
      method: alert.method,
      param: alert.param,
      attack: alert.attack,
      evidence: alert.evidence,
      description: alert.description,
      solution: alert.solution,
      cweId: alert.cweId,
      wascId: alert.wascId,
    })),
    falsePositives: scan.alerts.filter(a => a.isFalsePositive).map(alert => ({
      id: alert.id,
      name: alert.name,
      url: alert.url,
    })),
  };
}

// Generate PDF report (simplified HTML-based approach)
export function generatePDFReport(scan: DASTScanResult, projectName: string): string {
  const html = generateHTMLReport(scan, projectName);

  // Add PDF-specific styles and instructions
  return html.replace('</style>', `
    @page { margin: 1cm; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .section { page-break-inside: avoid; }
    }
  </style>`);
}
