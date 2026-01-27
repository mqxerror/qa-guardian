/**
 * Report Page
 * Feature #1732: Comprehensive report view with sections for all test types
 */

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuthStore } from '../stores/authStore';

// Type definitions matching backend
interface E2EReportSection {
  type: 'e2e';
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    passRate: number;
    avgDuration: number;
  };
  tests: Array<{
    id: string;
    name: string;
    status: 'passed' | 'failed' | 'skipped';
    duration: number;
    error?: string;
  }>;
}

interface VisualReportSection {
  type: 'visual';
  summary: {
    total: number;
    noChange: number;
    diffsDetected: number;
    approved: number;
    pending: number;
  };
  comparisons: Array<{
    id: string;
    testName: string;
    viewport: string;
    diffPercentage: number;
    status: 'match' | 'diff' | 'approved' | 'pending';
  }>;
}

interface AccessibilityReportSection {
  type: 'accessibility';
  summary: {
    total: number;
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
    wcagCompliance: number;
  };
  violations: Array<{
    id: string;
    rule: string;
    impact: 'critical' | 'serious' | 'moderate' | 'minor';
    wcagLevel: string;
    description: string;
    nodes: number;
  }>;
}

interface PerformanceReportSection {
  type: 'performance';
  summary: {
    score: number;
    lcp: number;
    fid: number;
    cls: number;
    ttfb: number;
    fcp: number;
    tti: number;
    speedIndex: number;
  };
  coreWebVitals: {
    lcp: { value: number; rating: 'good' | 'needs-improvement' | 'poor' };
    fid: { value: number; rating: 'good' | 'needs-improvement' | 'poor' };
    cls: { value: number; rating: 'good' | 'needs-improvement' | 'poor' };
  };
}

interface LoadReportSection {
  type: 'load';
  summary: {
    vus: number;
    duration: number;
    requestsTotal: number;
    requestsFailed: number;
    rps: number;
  };
  latency: {
    p50: number;
    p95: number;
    p99: number;
    avg: number;
    min: number;
    max: number;
  };
  thresholds: Array<{
    name: string;
    passed: boolean;
    value: string;
    threshold: string;
  }>;
}

interface SecurityReportSection {
  type: 'security';
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    riskScore: number;
  };
  vulnerabilities: Array<{
    id: string;
    name: string;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    category: string;
    description: string;
  }>;
}

interface ComprehensiveReport {
  id: string;
  projectId: string;
  projectName: string;
  createdAt: string;
  createdBy: string;
  title: string;
  description?: string;
  period: {
    start: string;
    end: string;
  };
  executiveSummary: {
    overallScore: number;
    overallStatus: 'passing' | 'warning' | 'failing';
    highlights: string[];
    criticalIssues: string[];
    recommendations: string[];
  };
  sections: {
    e2e?: E2EReportSection;
    visual?: VisualReportSection;
    accessibility?: AccessibilityReportSection;
    performance?: PerformanceReportSection;
    load?: LoadReportSection;
    security?: SecurityReportSection;
  };
}

// Score badge component
function ScoreBadge({ score, size = 'large' }: { score: number; size?: 'small' | 'large' }) {
  const color = score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-500';
  const sizeClass = size === 'large' ? 'w-24 h-24 text-3xl' : 'w-12 h-12 text-lg';

  return (
    <div className={`${sizeClass} ${color} rounded-full flex items-center justify-center text-white font-bold shadow-lg`}>
      {score}
    </div>
  );
}

// Status badge component
function StatusBadge({ status }: { status: 'passing' | 'warning' | 'failing' | 'passed' | 'failed' | 'skipped' | 'match' | 'diff' | 'approved' | 'pending' }) {
  const colors: Record<string, string> = {
    passing: 'bg-green-100 text-green-800',
    passed: 'bg-green-100 text-green-800',
    match: 'bg-green-100 text-green-800',
    approved: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    pending: 'bg-yellow-100 text-yellow-800',
    failing: 'bg-red-100 text-red-800',
    failed: 'bg-red-100 text-red-800',
    diff: 'bg-orange-100 text-orange-800',
    skipped: 'bg-gray-100 text-gray-800',
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// Impact badge for severity
function ImpactBadge({ impact }: { impact: string }) {
  const colors: Record<string, string> = {
    critical: 'bg-red-600 text-white',
    high: 'bg-red-500 text-white',
    serious: 'bg-orange-500 text-white',
    medium: 'bg-yellow-500 text-white',
    moderate: 'bg-yellow-500 text-white',
    low: 'bg-blue-500 text-white',
    minor: 'bg-blue-400 text-white',
    info: 'bg-gray-500 text-white',
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${colors[impact] || 'bg-gray-500 text-white'}`}>
      {impact.charAt(0).toUpperCase() + impact.slice(1)}
    </span>
  );
}

// Core Web Vitals rating badge
function CWVRatingBadge({ rating }: { rating: 'good' | 'needs-improvement' | 'poor' }) {
  const colors = {
    good: 'bg-green-100 text-green-800',
    'needs-improvement': 'bg-yellow-100 text-yellow-800',
    poor: 'bg-red-100 text-red-800',
  };

  const labels = {
    good: 'Good',
    'needs-improvement': 'Needs Work',
    poor: 'Poor',
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${colors[rating]}`}>
      {labels[rating]}
    </span>
  );
}

export function ReportPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const { token } = useAuthStore();
  const [report, setReport] = useState<ComprehensiveReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>('summary');

  useEffect(() => {
    if (!reportId || !token) return;

    const fetchReport = async () => {
      try {
        setLoading(true);
        const response = await fetch(`https://qa.pixelcraftedmedia.com/api/v1/reports/${reportId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch report');
        }

        const data = await response.json();
        setReport(data.report);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [reportId, token]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  if (error || !report) {
    return (
      <Layout>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h2 className="text-xl font-semibold text-red-800 mb-2">Report Not Found</h2>
          <p className="text-red-600">{error || 'The requested report could not be found.'}</p>
          <Link to="/dashboard" className="mt-4 inline-block text-primary hover:underline">
            Return to Dashboard
          </Link>
        </div>
      </Layout>
    );
  }

  const sectionTabs = [
    { id: 'summary', label: 'Executive Summary', icon: '📊' },
    ...(report.sections.e2e ? [{ id: 'e2e', label: 'E2E Tests', icon: '🧪' }] : []),
    ...(report.sections.visual ? [{ id: 'visual', label: 'Visual', icon: '👁️' }] : []),
    ...(report.sections.accessibility ? [{ id: 'accessibility', label: 'Accessibility', icon: '♿' }] : []),
    ...(report.sections.performance ? [{ id: 'performance', label: 'Performance', icon: '⚡' }] : []),
    ...(report.sections.load ? [{ id: 'load', label: 'Load Testing', icon: '📈' }] : []),
    ...(report.sections.security ? [{ id: 'security', label: 'Security', icon: '🔒' }] : []),
  ];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-card rounded-lg border border-border p-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{report.title}</h1>
              <p className="text-muted-foreground mt-1">
                Project: {report.projectName} | Generated: {new Date(report.createdAt).toLocaleString()}
              </p>
              {report.description && (
                <p className="text-muted-foreground mt-2">{report.description}</p>
              )}
              <p className="text-sm text-muted-foreground mt-2">
                Period: {new Date(report.period.start).toLocaleDateString()} - {new Date(report.period.end).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <ScoreBadge score={report.executiveSummary.overallScore} />
              <StatusBadge status={report.executiveSummary.overallStatus} />
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="flex overflow-x-auto border-b border-border">
            {sectionTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeSection === tab.id
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* Executive Summary */}
            {activeSection === 'summary' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Highlights */}
                  <div className="bg-green-50 rounded-lg p-4">
                    <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                      <span>✅</span> Highlights
                    </h3>
                    <ul className="space-y-2">
                      {report.executiveSummary.highlights.length > 0 ? (
                        report.executiveSummary.highlights.map((h, i) => (
                          <li key={i} className="text-sm text-green-700">{h}</li>
                        ))
                      ) : (
                        <li className="text-sm text-green-600 italic">No highlights</li>
                      )}
                    </ul>
                  </div>

                  {/* Critical Issues */}
                  <div className="bg-red-50 rounded-lg p-4">
                    <h3 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
                      <span>⚠️</span> Critical Issues
                    </h3>
                    <ul className="space-y-2">
                      {report.executiveSummary.criticalIssues.length > 0 ? (
                        report.executiveSummary.criticalIssues.map((issue, i) => (
                          <li key={i} className="text-sm text-red-700">{issue}</li>
                        ))
                      ) : (
                        <li className="text-sm text-green-600 italic">No critical issues</li>
                      )}
                    </ul>
                  </div>

                  {/* Recommendations */}
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                      <span>💡</span> Recommendations
                    </h3>
                    <ul className="space-y-2">
                      {report.executiveSummary.recommendations.length > 0 ? (
                        report.executiveSummary.recommendations.map((rec, i) => (
                          <li key={i} className="text-sm text-blue-700">{rec}</li>
                        ))
                      ) : (
                        <li className="text-sm text-blue-600 italic">No recommendations</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* E2E Section */}
            {activeSection === 'e2e' && report.sections.e2e && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="bg-muted rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-foreground">{report.sections.e2e.summary.total}</div>
                    <div className="text-sm text-muted-foreground">Total Tests</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-green-700">{report.sections.e2e.summary.passed}</div>
                    <div className="text-sm text-green-600">Passed</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-red-700">{report.sections.e2e.summary.failed}</div>
                    <div className="text-sm text-red-600">Failed</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-gray-700">{report.sections.e2e.summary.skipped}</div>
                    <div className="text-sm text-gray-600">Skipped</div>
                  </div>
                  <div className="bg-primary/10 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-primary">{report.sections.e2e.summary.passRate}%</div>
                    <div className="text-sm text-primary/80">Pass Rate</div>
                  </div>
                </div>

                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-3 font-medium">Test Name</th>
                        <th className="text-left p-3 font-medium">Status</th>
                        <th className="text-left p-3 font-medium">Duration</th>
                        <th className="text-left p-3 font-medium">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.sections.e2e.tests.map((test) => (
                        <tr key={test.id} className="border-t border-border">
                          <td className="p-3">{test.name}</td>
                          <td className="p-3"><StatusBadge status={test.status} /></td>
                          <td className="p-3">{(test.duration / 1000).toFixed(2)}s</td>
                          <td className="p-3 text-red-600 text-sm">{test.error || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Visual Section */}
            {activeSection === 'visual' && report.sections.visual && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="bg-muted rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold">{report.sections.visual.summary.total}</div>
                    <div className="text-sm text-muted-foreground">Total Comparisons</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-green-700">{report.sections.visual.summary.noChange}</div>
                    <div className="text-sm text-green-600">No Change</div>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-orange-700">{report.sections.visual.summary.diffsDetected}</div>
                    <div className="text-sm text-orange-600">Diffs Detected</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-blue-700">{report.sections.visual.summary.approved}</div>
                    <div className="text-sm text-blue-600">Approved</div>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-yellow-700">{report.sections.visual.summary.pending}</div>
                    <div className="text-sm text-yellow-600">Pending Review</div>
                  </div>
                </div>

                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-3 font-medium">Test</th>
                        <th className="text-left p-3 font-medium">Viewport</th>
                        <th className="text-left p-3 font-medium">Diff %</th>
                        <th className="text-left p-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.sections.visual.comparisons.map((comp) => (
                        <tr key={comp.id} className="border-t border-border">
                          <td className="p-3">{comp.testName}</td>
                          <td className="p-3">{comp.viewport}</td>
                          <td className="p-3">{comp.diffPercentage.toFixed(1)}%</td>
                          <td className="p-3"><StatusBadge status={comp.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Accessibility Section */}
            {activeSection === 'accessibility' && report.sections.accessibility && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                  <div className="bg-muted rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold">{report.sections.accessibility.summary.total}</div>
                    <div className="text-sm text-muted-foreground">Total Violations</div>
                  </div>
                  <div className="bg-red-100 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-red-700">{report.sections.accessibility.summary.critical}</div>
                    <div className="text-sm text-red-600">Critical</div>
                  </div>
                  <div className="bg-orange-100 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-orange-700">{report.sections.accessibility.summary.serious}</div>
                    <div className="text-sm text-orange-600">Serious</div>
                  </div>
                  <div className="bg-yellow-100 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-yellow-700">{report.sections.accessibility.summary.moderate}</div>
                    <div className="text-sm text-yellow-600">Moderate</div>
                  </div>
                  <div className="bg-blue-100 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-blue-700">{report.sections.accessibility.summary.minor}</div>
                    <div className="text-sm text-blue-600">Minor</div>
                  </div>
                  <div className="bg-primary/10 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-primary">{report.sections.accessibility.summary.wcagCompliance}%</div>
                    <div className="text-sm text-primary/80">WCAG Compliance</div>
                  </div>
                </div>

                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-3 font-medium">Rule</th>
                        <th className="text-left p-3 font-medium">Impact</th>
                        <th className="text-left p-3 font-medium">WCAG</th>
                        <th className="text-left p-3 font-medium">Description</th>
                        <th className="text-left p-3 font-medium">Nodes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.sections.accessibility.violations.map((v) => (
                        <tr key={v.id} className="border-t border-border">
                          <td className="p-3 font-mono text-sm">{v.rule}</td>
                          <td className="p-3"><ImpactBadge impact={v.impact} /></td>
                          <td className="p-3">{v.wcagLevel}</td>
                          <td className="p-3 text-sm">{v.description}</td>
                          <td className="p-3">{v.nodes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Performance Section */}
            {activeSection === 'performance' && report.sections.performance && (
              <div className="space-y-6">
                <div className="flex items-center justify-center gap-8 mb-6">
                  <div className="text-center">
                    <ScoreBadge score={report.sections.performance.summary.score} />
                    <p className="mt-2 text-muted-foreground">Performance Score</p>
                  </div>
                </div>

                <h4 className="font-semibold text-lg">Core Web Vitals</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-card border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">LCP</span>
                      <CWVRatingBadge rating={report.sections.performance.coreWebVitals.lcp.rating} />
                    </div>
                    <div className="text-3xl font-bold">
                      {(report.sections.performance.coreWebVitals.lcp.value / 1000).toFixed(1)}s
                    </div>
                    <p className="text-sm text-muted-foreground">Largest Contentful Paint</p>
                  </div>

                  <div className="bg-card border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">FID</span>
                      <CWVRatingBadge rating={report.sections.performance.coreWebVitals.fid.rating} />
                    </div>
                    <div className="text-3xl font-bold">
                      {report.sections.performance.coreWebVitals.fid.value}ms
                    </div>
                    <p className="text-sm text-muted-foreground">First Input Delay</p>
                  </div>

                  <div className="bg-card border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">CLS</span>
                      <CWVRatingBadge rating={report.sections.performance.coreWebVitals.cls.rating} />
                    </div>
                    <div className="text-3xl font-bold">
                      {report.sections.performance.coreWebVitals.cls.value.toFixed(3)}
                    </div>
                    <p className="text-sm text-muted-foreground">Cumulative Layout Shift</p>
                  </div>
                </div>

                <h4 className="font-semibold text-lg mt-6">Other Metrics</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-muted rounded-lg p-4 text-center">
                    <div className="text-xl font-bold">{report.sections.performance.summary.ttfb}ms</div>
                    <div className="text-sm text-muted-foreground">TTFB</div>
                  </div>
                  <div className="bg-muted rounded-lg p-4 text-center">
                    <div className="text-xl font-bold">{(report.sections.performance.summary.fcp / 1000).toFixed(1)}s</div>
                    <div className="text-sm text-muted-foreground">FCP</div>
                  </div>
                  <div className="bg-muted rounded-lg p-4 text-center">
                    <div className="text-xl font-bold">{(report.sections.performance.summary.tti / 1000).toFixed(1)}s</div>
                    <div className="text-sm text-muted-foreground">TTI</div>
                  </div>
                  <div className="bg-muted rounded-lg p-4 text-center">
                    <div className="text-xl font-bold">{report.sections.performance.summary.speedIndex}</div>
                    <div className="text-sm text-muted-foreground">Speed Index</div>
                  </div>
                </div>
              </div>
            )}

            {/* Load Testing Section */}
            {activeSection === 'load' && report.sections.load && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="bg-muted rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold">{report.sections.load.summary.vus}</div>
                    <div className="text-sm text-muted-foreground">Virtual Users</div>
                  </div>
                  <div className="bg-muted rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold">{report.sections.load.summary.duration}s</div>
                    <div className="text-sm text-muted-foreground">Duration</div>
                  </div>
                  <div className="bg-muted rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold">{report.sections.load.summary.requestsTotal.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">Total Requests</div>
                  </div>
                  <div className="bg-muted rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold">{report.sections.load.summary.rps}</div>
                    <div className="text-sm text-muted-foreground">Requests/sec</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-red-700">{report.sections.load.summary.requestsFailed}</div>
                    <div className="text-sm text-red-600">Failed</div>
                  </div>
                </div>

                <h4 className="font-semibold text-lg">Latency</h4>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                  <div className="bg-primary/10 rounded-lg p-4 text-center">
                    <div className="text-xl font-bold">{report.sections.load.latency.p50}ms</div>
                    <div className="text-sm text-muted-foreground">P50</div>
                  </div>
                  <div className="bg-primary/10 rounded-lg p-4 text-center">
                    <div className="text-xl font-bold">{report.sections.load.latency.p95}ms</div>
                    <div className="text-sm text-muted-foreground">P95</div>
                  </div>
                  <div className="bg-primary/10 rounded-lg p-4 text-center">
                    <div className="text-xl font-bold">{report.sections.load.latency.p99}ms</div>
                    <div className="text-sm text-muted-foreground">P99</div>
                  </div>
                  <div className="bg-muted rounded-lg p-4 text-center">
                    <div className="text-xl font-bold">{report.sections.load.latency.avg}ms</div>
                    <div className="text-sm text-muted-foreground">Average</div>
                  </div>
                  <div className="bg-muted rounded-lg p-4 text-center">
                    <div className="text-xl font-bold">{report.sections.load.latency.min}ms</div>
                    <div className="text-sm text-muted-foreground">Min</div>
                  </div>
                  <div className="bg-muted rounded-lg p-4 text-center">
                    <div className="text-xl font-bold">{report.sections.load.latency.max}ms</div>
                    <div className="text-sm text-muted-foreground">Max</div>
                  </div>
                </div>

                <h4 className="font-semibold text-lg">Thresholds</h4>
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-3 font-medium">Threshold</th>
                        <th className="text-left p-3 font-medium">Value</th>
                        <th className="text-left p-3 font-medium">Target</th>
                        <th className="text-left p-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.sections.load.thresholds.map((t, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="p-3">{t.name}</td>
                          <td className="p-3">{t.value}</td>
                          <td className="p-3">{t.threshold}</td>
                          <td className="p-3">
                            <StatusBadge status={t.passed ? 'passed' : 'failed'} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Security Section */}
            {activeSection === 'security' && report.sections.security && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
                  <div className="bg-muted rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold">{report.sections.security.summary.total}</div>
                    <div className="text-sm text-muted-foreground">Total</div>
                  </div>
                  <div className="bg-red-200 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-red-800">{report.sections.security.summary.critical}</div>
                    <div className="text-sm text-red-700">Critical</div>
                  </div>
                  <div className="bg-red-100 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-red-700">{report.sections.security.summary.high}</div>
                    <div className="text-sm text-red-600">High</div>
                  </div>
                  <div className="bg-yellow-100 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-yellow-700">{report.sections.security.summary.medium}</div>
                    <div className="text-sm text-yellow-600">Medium</div>
                  </div>
                  <div className="bg-blue-100 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-blue-700">{report.sections.security.summary.low}</div>
                    <div className="text-sm text-blue-600">Low</div>
                  </div>
                  <div className="bg-gray-100 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-gray-700">{report.sections.security.summary.info}</div>
                    <div className="text-sm text-gray-600">Info</div>
                  </div>
                  <div className={`rounded-lg p-4 text-center ${
                    report.sections.security.summary.riskScore > 50 ? 'bg-red-100' : 'bg-green-100'
                  }`}>
                    <div className={`text-2xl font-bold ${
                      report.sections.security.summary.riskScore > 50 ? 'text-red-700' : 'text-green-700'
                    }`}>
                      {report.sections.security.summary.riskScore}
                    </div>
                    <div className="text-sm text-muted-foreground">Risk Score</div>
                  </div>
                </div>

                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-3 font-medium">Vulnerability</th>
                        <th className="text-left p-3 font-medium">Severity</th>
                        <th className="text-left p-3 font-medium">Category</th>
                        <th className="text-left p-3 font-medium">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.sections.security.vulnerabilities.map((v) => (
                        <tr key={v.id} className="border-t border-border">
                          <td className="p-3 font-medium">{v.name}</td>
                          <td className="p-3"><ImpactBadge impact={v.severity} /></td>
                          <td className="p-3">{v.category}</td>
                          <td className="p-3 text-sm">{v.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default ReportPage;
