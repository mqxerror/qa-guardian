/**
 * Report Generator
 * Feature #1732: Generates comprehensive reports from test data
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
} from './types';
import { generateReportId, storeReport } from './stores';

// Mock data generators for demonstration
// In production, these would fetch from actual test results

function generateE2ESection(projectId: string): E2EReportSection {
  const total = Math.floor(Math.random() * 50) + 20;
  const failed = Math.floor(Math.random() * 5);
  const skipped = Math.floor(Math.random() * 3);
  const passed = total - failed - skipped;

  return {
    type: 'e2e',
    summary: {
      total,
      passed,
      failed,
      skipped,
      passRate: Math.round((passed / total) * 100),
      avgDuration: Math.floor(Math.random() * 5000) + 1000,
    },
    tests: [
      { id: 't1', name: 'Login flow', status: 'passed', duration: 2340 },
      { id: 't2', name: 'User registration', status: 'passed', duration: 3120 },
      { id: 't3', name: 'Checkout process', status: failed > 0 ? 'failed' : 'passed', duration: 4560, error: failed > 0 ? 'Element not found: .checkout-btn' : undefined },
      { id: 't4', name: 'Search functionality', status: 'passed', duration: 1890 },
      { id: 't5', name: 'Navigation menu', status: 'passed', duration: 980 },
    ],
  };
}

function generateVisualSection(projectId: string): VisualReportSection {
  const total = Math.floor(Math.random() * 20) + 10;
  const diffs = Math.floor(Math.random() * 5);
  const pending = Math.floor(Math.random() * diffs);
  const approved = diffs - pending;

  return {
    type: 'visual',
    summary: {
      total,
      noChange: total - diffs,
      diffsDetected: diffs,
      approved,
      pending,
    },
    comparisons: [
      { id: 'v1', testName: 'Homepage - Desktop', viewport: '1920x1080', diffPercentage: 0, status: 'match' },
      { id: 'v2', testName: 'Homepage - Mobile', viewport: '375x812', diffPercentage: 2.3, status: pending > 0 ? 'pending' : 'approved' },
      { id: 'v3', testName: 'Product Page', viewport: '1920x1080', diffPercentage: 0, status: 'match' },
      { id: 'v4', testName: 'Checkout Page', viewport: '1440x900', diffPercentage: 0.5, status: 'approved' },
    ],
  };
}

function generateAccessibilitySection(projectId: string): AccessibilityReportSection {
  const critical = Math.floor(Math.random() * 2);
  const serious = Math.floor(Math.random() * 5);
  const moderate = Math.floor(Math.random() * 10);
  const minor = Math.floor(Math.random() * 15);
  const total = critical + serious + moderate + minor;

  // Calculate WCAG compliance (higher is better, fewer violations)
  const wcagCompliance = Math.max(0, 100 - (critical * 20 + serious * 10 + moderate * 3 + minor * 1));

  return {
    type: 'accessibility',
    summary: {
      total,
      critical,
      serious,
      moderate,
      minor,
      wcagCompliance,
    },
    violations: [
      ...(critical > 0 ? [{
        id: 'a1',
        rule: 'image-alt',
        impact: 'critical' as const,
        wcagLevel: 'A',
        description: 'Images must have alternate text',
        nodes: 3,
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/image-alt',
      }] : []),
      ...(serious > 0 ? [{
        id: 'a2',
        rule: 'color-contrast',
        impact: 'serious' as const,
        wcagLevel: 'AA',
        description: 'Elements must have sufficient color contrast',
        nodes: 5,
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/color-contrast',
      }] : []),
      {
        id: 'a3',
        rule: 'label',
        impact: 'moderate' as const,
        wcagLevel: 'A',
        description: 'Form elements must have labels',
        nodes: 2,
      },
    ],
  };
}

function generatePerformanceSection(projectId: string): PerformanceReportSection {
  const score = Math.floor(Math.random() * 30) + 70;
  const lcp = Math.floor(Math.random() * 2000) + 1500;
  const fid = Math.floor(Math.random() * 50) + 50;
  const cls = Math.random() * 0.15;

  return {
    type: 'performance',
    summary: {
      score,
      lcp,
      fid,
      cls: Math.round(cls * 100) / 100,
      ttfb: Math.floor(Math.random() * 500) + 200,
      fcp: Math.floor(Math.random() * 1500) + 800,
      tti: Math.floor(Math.random() * 3000) + 2500,
      speedIndex: Math.floor(Math.random() * 2000) + 2000,
    },
    audits: [
      { id: 'lcp', title: 'Largest Contentful Paint', score: lcp < 2500 ? 100 : lcp < 4000 ? 50 : 0, category: 'performance', displayValue: `${(lcp / 1000).toFixed(1)}s` },
      { id: 'fid', title: 'First Input Delay', score: fid < 100 ? 100 : fid < 300 ? 50 : 0, category: 'performance', displayValue: `${fid}ms` },
      { id: 'cls', title: 'Cumulative Layout Shift', score: cls < 0.1 ? 100 : cls < 0.25 ? 50 : 0, category: 'performance', displayValue: cls.toFixed(3) },
      { id: 'render-blocking', title: 'Eliminate render-blocking resources', score: 80, category: 'performance', description: '2 resources blocking first paint' },
    ],
    coreWebVitals: {
      lcp: { value: lcp, rating: lcp < 2500 ? 'good' : lcp < 4000 ? 'needs-improvement' : 'poor' },
      fid: { value: fid, rating: fid < 100 ? 'good' : fid < 300 ? 'needs-improvement' : 'poor' },
      cls: { value: cls, rating: cls < 0.1 ? 'good' : cls < 0.25 ? 'needs-improvement' : 'poor' },
    },
  };
}

function generateLoadSection(projectId: string): LoadReportSection {
  const vus = Math.floor(Math.random() * 50) + 10;
  const duration = Math.floor(Math.random() * 300) + 60;
  const rps = Math.floor(Math.random() * 500) + 100;
  const requestsTotal = rps * duration;
  const errorRate = Math.random() * 2;

  return {
    type: 'load',
    summary: {
      vus,
      duration,
      requestsTotal,
      requestsFailed: Math.floor(requestsTotal * (errorRate / 100)),
      rps,
    },
    latency: {
      p50: Math.floor(Math.random() * 100) + 50,
      p95: Math.floor(Math.random() * 300) + 200,
      p99: Math.floor(Math.random() * 500) + 400,
      avg: Math.floor(Math.random() * 150) + 80,
      min: Math.floor(Math.random() * 30) + 20,
      max: Math.floor(Math.random() * 2000) + 1000,
    },
    thresholds: [
      { name: 'http_req_duration p(95)', passed: true, value: '245ms', threshold: '<500ms' },
      { name: 'http_req_failed', passed: errorRate < 1, value: `${errorRate.toFixed(2)}%`, threshold: '<1%' },
      { name: 'http_reqs', passed: true, value: `${rps}/s`, threshold: '>50/s' },
    ],
    scenarios: [
      { name: 'baseline', vus: 10, duration: '60s', rps: 150, errorRate: 0.1 },
      { name: 'stress', vus: 50, duration: '120s', rps: 450, errorRate: 0.5 },
      { name: 'spike', vus: 100, duration: '30s', rps: 800, errorRate: 1.2 },
    ],
  };
}

function generateSecuritySection(projectId: string): SecurityReportSection {
  const critical = Math.floor(Math.random() * 2);
  const high = Math.floor(Math.random() * 3);
  const medium = Math.floor(Math.random() * 5);
  const low = Math.floor(Math.random() * 8);
  const info = Math.floor(Math.random() * 10);
  const total = critical + high + medium + low + info;

  // Risk score (0 = safest, 100 = most risky)
  const riskScore = Math.min(100, critical * 30 + high * 15 + medium * 5 + low * 2 + info * 0.5);

  return {
    type: 'security',
    summary: {
      total,
      critical,
      high,
      medium,
      low,
      info,
      riskScore: Math.round(riskScore),
    },
    vulnerabilities: [
      ...(critical > 0 ? [{
        id: 's1',
        name: 'SQL Injection',
        severity: 'critical' as const,
        category: 'Injection',
        description: 'SQL injection vulnerability in user search endpoint',
        location: '/api/users/search?q=',
        cwe: 'CWE-89',
        remediation: 'Use parameterized queries instead of string concatenation',
      }] : []),
      ...(high > 0 ? [{
        id: 's2',
        name: 'Missing Security Headers',
        severity: 'high' as const,
        category: 'Configuration',
        description: 'Content-Security-Policy header is missing',
        remediation: 'Add Content-Security-Policy header with appropriate directives',
      }] : []),
      {
        id: 's3',
        name: 'Cookie without HttpOnly flag',
        severity: 'medium' as const,
        category: 'Session Management',
        description: 'Session cookie is accessible via JavaScript',
        cwe: 'CWE-1004',
        remediation: 'Set HttpOnly flag on all sensitive cookies',
      },
    ],
    headers: {
      present: ['X-Frame-Options', 'X-Content-Type-Options', 'Strict-Transport-Security'],
      missing: critical > 0 ? ['Content-Security-Policy', 'Permissions-Policy'] : [],
      misconfigured: high > 0 ? ['X-XSS-Protection'] : [],
    },
  };
}

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
    const visualScore = ((sections.visual.summary.noChange + sections.visual.summary.approved) / sections.visual.summary.total) * 100;
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
    const loadScore = (thresholdsPassed / sections.load.thresholds.length) * 100;
    scores.push(loadScore);
    if (loadScore === 100) {
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

export async function generateReport(
  request: GenerateReportRequest,
  createdBy: string,
  baseUrl: string
): Promise<ComprehensiveReport> {
  const reportId = generateReportId();

  // Determine which sections to include
  const includeSections = request.includeSections || ['e2e', 'visual', 'accessibility', 'performance', 'load', 'security'];

  const sections: ComprehensiveReport['sections'] = {};

  if (includeSections.includes('e2e')) {
    sections.e2e = generateE2ESection(request.projectId);
  }
  if (includeSections.includes('visual')) {
    sections.visual = generateVisualSection(request.projectId);
  }
  if (includeSections.includes('accessibility')) {
    sections.accessibility = generateAccessibilitySection(request.projectId);
  }
  if (includeSections.includes('performance')) {
    sections.performance = generatePerformanceSection(request.projectId);
  }
  if (includeSections.includes('load')) {
    sections.load = generateLoadSection(request.projectId);
  }
  if (includeSections.includes('security')) {
    sections.security = generateSecuritySection(request.projectId);
  }

  const now = new Date();
  const periodStart = request.period?.start || new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const periodEnd = request.period?.end || now.toISOString();

  const report: ComprehensiveReport = {
    id: reportId,
    projectId: request.projectId,
    projectName: `Project ${request.projectId}`, // Would be fetched from project data
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
  storeReport(report);

  return report;
}
