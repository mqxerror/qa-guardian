// Feature #1441: AnalyticsPage extracted from App.tsx (~5,650 lines)
// Lines 8740-14390: Analytics dashboard with failure clusters, trends, and AI analysis

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuthStore } from '../stores/authStore';
import { toast } from '../stores/toastStore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// Interface for failing tests
interface FailingTest {
  test_id: string;
  test_name: string;
  suite_id: string;
  suite_name: string;
  project_id: string;
  project_name: string;
  failure_count: number;
  total_runs: number;
  failure_percentage: number;
  last_failure?: string;
}

// Interface for browser statistics
interface BrowserStats {
  browser: string;
  total_runs: number;
  passed: number;
  failed: number;
  error: number;
  pass_rate: number;
}

// Interface for project comparison statistics
interface ProjectComparisonStats {
  project_id: string;
  project_name: string;
  project_slug: string;
  suite_count: number;
  test_count: number;
  total_runs: number;
  pass_rate: number;
  passed_runs: number;
  failed_runs: number;
}

interface TrendDataPoint {
  date: string;
  passed: number;
  failed: number;
  total: number;
  total_runs: number;
  pass_rate: number | null;
}

interface TrendSummary {
  period_days: number;
  total_runs: number;
  total_passed: number;
  total_failed: number;
  overall_pass_rate: number | null;
  start_date: string;
  end_date: string;
}

// Interface for accessibility trend data points
interface AccessibilityTrendDataPoint {
  date: string;
  total_violations: number;
  critical: number;
  serious: number;
  moderate: number;
  minor: number;
  runs_with_violations: number;
  total_runs: number;
}

interface AccessibilityTrendSummary {
  period_days: number;
  total_runs: number;
  runs_with_violations: number;
  total_violations: number;
  avg_violations_per_run: number;
  violation_trend: 'improving' | 'stable' | 'worsening';
  start_date: string;
  end_date: string;
}

// Interface for flaky tests
interface FlakyTest {
  test_id: string;
  test_name: string;
  suite_id: string;
  suite_name: string;
  project_id: string;
  project_name: string;
  pass_count: number;
  fail_count: number;
  total_runs: number;
  pass_rate: number;
  flakiness_percentage: number;
  flakiness_score: number;
  recommendation: string;
  last_run?: string;
  last_result?: 'passed' | 'failed';
  recent_runs?: Array<{ result: 'passed' | 'failed'; timestamp: string }>;
  retry_count?: number;
  passed_on_retry_count?: number;
  first_try_failure_count?: number;
  first_try_failure_rate?: number;
  retry_success_rate?: number;
  is_retry_flaky?: boolean;
  has_time_pattern?: boolean;
  peak_failure_hours?: Array<{ hour: number; hour_label: string; failure_rate: number; failures: number; total: number }>;
  peak_failure_days?: Array<{ day: number; day_name: string; failure_rate: number; failures: number; total: number }>;
  correlates_with_peak_load?: boolean;
  peak_load_failure_rate?: number;
  time_pattern_summary?: string;
  hourly_failure_rates?: number[];
  has_environment_pattern?: boolean;
  browser_stats?: Array<{ browser: string; pass: number; fail: number; total: number; failure_rate: number }>;
  environment_stats?: Array<{ environment: string; pass: number; fail: number; total: number; failure_rate: number }>;
  os_stats?: Array<{ os: string; pass: number; fail: number; total: number; failure_rate: number }>;
  is_browser_specific?: boolean;
  ci_vs_local_difference?: boolean;
  fails_more_on_ci?: boolean;
  is_os_specific?: boolean;
  environment_pattern_summary?: string;
}

// Feature #1075: Failure Clusters Component
interface FailureCluster {
  cluster_id: string;
  cluster_name: string;
  pattern_type: string;
  count: number;
  first_seen: string;
  last_seen: string;
  affected_tests: string[];
  failures: Array<{
    run_id: string;
    test_id: string;
    test_name: string;
    suite_name?: string;
    project_name?: string;
    error_message: string;
    timestamp: string;
  }>;
  has_more?: boolean;
}

// Feature #1077: Related Commits interface
interface RelatedCommit {
  sha: string;
  short_sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    avatar_url: string;
  };
  timestamp: string;
  files_changed: Array<{
    path: string;
    additions: number;
    deletions: number;
    status: 'added' | 'modified' | 'deleted';
  }>;
  likely_cause: boolean;
  relevance_score: number;
}

interface CommitDetails {
  sha: string;
  short_sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    avatar_url: string;
  };
  timestamp: string;
  files: Array<{
    path: string;
    status: string;
    additions: number;
    deletions: number;
    patch?: string;
  }>;
  stats: {
    total_additions: number;
    total_deletions: number;
    files_changed: number;
  };
  url: string;
}

// Feature #1078: Root Cause Analysis interfaces
interface RootCauseEvidence {
  type: 'error_pattern' | 'stack_trace' | 'historical' | 'code_change' | 'environment' | 'timing';
  description: string;
  strength: 'strong' | 'moderate' | 'weak';
  data?: string;
}

interface RootCause {
  id: string;
  category: string;
  title: string;
  description: string;
  confidence: number;
  evidence: RootCauseEvidence[];
  is_primary: boolean;
  fix_recommendations: string[];
  affected_components: string[];
}

// Feature #1079: Evidence Artifacts interfaces
interface ConsoleLogEntry {
  level: 'error' | 'warning' | 'info' | 'log';
  message: string;
  timestamp: string;
  source?: string;
}

interface NetworkRequest {
  method: string;
  url: string;
  status: number;
  status_text: string;
  duration_ms: number;
  failed: boolean;
  error?: string;
}

interface StackTraceFrame {
  function_name: string;
  file: string;
  line: number;
  column: number;
}

interface EvidenceArtifacts {
  screenshot: {
    available: boolean;
    url?: string;
    timestamp?: string;
    description: string;
  };
  console_logs: {
    available: boolean;
    entries: ConsoleLogEntry[];
    total_errors: number;
    total_warnings: number;
  };
  network_requests: {
    available: boolean;
    requests: NetworkRequest[];
    total_requests: number;
    failed_requests: number;
  };
  stack_trace: {
    available: boolean;
    frames: StackTraceFrame[];
    raw_trace: string;
  };
  dom_snapshot: {
    available: boolean;
    selector_used?: string;
    element_found: boolean;
    element_visible?: boolean;
    element_html?: string;
  };
}

// Feature #1080: Suggested action interfaces
interface SuggestedAction {
  id: string;
  category: 'code_fix' | 'test_update' | 'environment' | 'configuration' | 'retry';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  estimated_effort: 'quick' | 'moderate' | 'significant';
  auto_applicable: boolean;
  code_snippet?: {
    language: string;
    before?: string;
    after: string;
    file_path?: string;
  };
  steps: string[];
  impact: string;
  related_cause_id: string;
}

interface SuggestedActions {
  actions: SuggestedAction[];
  quick_wins: SuggestedAction[];
  summary: {
    total_actions: number;
    auto_applicable: number;
    high_priority: number;
    estimated_time_savings: string;
  };
}

// Feature #1081: Historical pattern matching interfaces
interface HistoricalFailure {
  id: string;
  test_name: string;
  error_message: string;
  occurred_at: string;
  run_id: string;
  pattern_type: string;
  resolution?: {
    status: 'resolved' | 'unresolved' | 'auto_healed';
    method?: string;
    resolved_at?: string;
    resolved_by?: string;
    resolution_time_hours?: number;
    notes?: string;
  };
}

interface HistoricalPatternMatch {
  pattern_type: string;
  pattern_name: string;
  description: string;
  similar_failures: HistoricalFailure[];
  total_occurrences: number;
  resolution_stats: {
    resolved: number;
    unresolved: number;
    auto_healed: number;
    success_rate: number;
    average_resolution_time_hours: number;
  };
  common_resolutions: Array<{
    method: string;
    count: number;
    success_rate: number;
  }>;
  first_seen: string;
  last_seen: string;
  trend: 'increasing' | 'decreasing' | 'stable';
}

interface RootCauseAnalysis {
  run_id: string;
  test_id: string;
  test_name: string;
  status: string;
  error_message: string;
  analysis_timestamp: string;
  primary_cause: RootCause;
  alternative_causes: RootCause[];
  overall_confidence: number;
  evidence_summary: {
    total_evidence_points: number;
    strong_evidence: number;
    moderate_evidence: number;
    weak_evidence: number;
  };
  ai_reasoning: string;
  requires_manual_review: boolean;
  artifacts?: EvidenceArtifacts;
  suggested_actions?: SuggestedActions;
  historical_pattern?: HistoricalPatternMatch;
}

// Feature #1082: Cross-test failure correlation interfaces
interface AffectedTest {
  test_id: string;
  test_name: string;
  suite_id?: string;
  suite_name?: string;
  project_id?: string;
  project_name?: string;
  failure_count: number;
  last_failure: string;
  error_sample: string;
}

interface CrossTestCorrelation {
  cluster_id: string;
  cluster_name: string;
  pattern_type: string;
  common_root_cause: {
    type: string;
    description: string;
    confidence: number;
    affected_component: string;
  };
  unified_fix: {
    title: string;
    description: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    effort: 'quick' | 'moderate' | 'significant';
    estimated_time: string;
    steps: string[];
    code_example?: {
      language: string;
      before: string;
      after: string;
    };
    impact_statement: string;
  };
  impact_scope: {
    total_tests_affected: number;
    total_failures: number;
    affected_suites: string[];
    affected_projects: string[];
    first_seen: string;
    last_seen: string;
    trend: 'increasing' | 'decreasing' | 'stable';
  };
  affected_tests: AffectedTest[];
}

// Feature #1083: Human-readable failure explanation interfaces
interface HumanReadableExplanation {
  summary: string;
  what_happened: string;
  why_it_matters: string;
  key_points: Array<{
    icon: string;
    text: string;
    type: 'info' | 'warning' | 'error' | 'tip';
  }>;
  technical_details: {
    error_type: string;
    component: string;
    location: string;
  };
  suggested_action: string;
  confidence: number;
}

interface FailureExplanationResponse {
  test_name: string;
  original_error: string;
  explanation: HumanReadableExplanation;
}

// Feature #1084: Technical failure explanation interfaces
interface StackFrame {
  function_name: string;
  file_path: string;
  line_number: number;
  column_number?: number;
  code_context?: string;
  is_application_code: boolean;
  analysis?: string;
}

interface CodeChange {
  description: string;
  file_path: string;
  language: string;
  before: string;
  after: string;
  line_range: { start: number; end: number };
}

interface TechnicalExplanation {
  summary: string;
  error_classification: {
    type: string;
    category: 'runtime' | 'network' | 'assertion' | 'timeout' | 'security' | 'infrastructure';
    severity: 'critical' | 'high' | 'medium' | 'low';
  };
  stack_trace_analysis: {
    frames: StackFrame[];
    root_cause_frame?: StackFrame;
    total_frames: number;
    application_frames: number;
    entry_point: string;
    failure_point: string;
  };
  code_level_explanation: {
    what_failed: string;
    why_it_failed: string;
    execution_flow: string[];
    affected_variables?: string[];
    related_components: string[];
  };
  suggested_fixes: CodeChange[];
  debugging_tips: Array<{
    step: number;
    title: string;
    command?: string;
    description: string;
  }>;
  related_documentation: Array<{
    title: string;
    url: string;
    relevance: string;
  }>;
  confidence: number;
}

interface TechnicalAnalysisResponse {
  test_name: string;
  original_error: string;
  analysis: TechnicalExplanation;
}

// Feature #1085: Executive summary interfaces
interface AffectedFeature {
  name: string;
  description: string;
  criticality: 'critical' | 'high' | 'medium' | 'low';
  user_impact: string;
}

interface ExecutiveSummary {
  headline: string;
  status_emoji: string;
  overall_status: 'critical' | 'warning' | 'attention_needed' | 'good';
  business_impact: {
    summary: string;
    severity: 'severe' | 'moderate' | 'minor';
    affected_users: string;
    revenue_risk: string;
    reputation_risk: string;
  };
  affected_features: AffectedFeature[];
  fix_effort: {
    estimated_time: string;
    team_resources: string;
    complexity: 'simple' | 'moderate' | 'complex';
    priority_recommendation: 'immediate' | 'high' | 'medium' | 'low';
  };
  risk_assessment: {
    current_risk_level: 'critical' | 'high' | 'medium' | 'low';
    trend: 'increasing' | 'stable' | 'decreasing';
    key_risks: string[];
    mitigation_steps: string[];
  };
  key_metrics: {
    total_failures: number;
    pass_rate: string;
    affected_tests: number;
    time_to_fix_estimate: string;
  };
  recommendations: Array<{
    priority: number;
    action: string;
    rationale: string;
  }>;
  next_steps: string[];
}

interface ExecutiveSummaryResponse {
  run_id: string;
  run_name: string;
  generated_at: string;
  summary: ExecutiveSummary;
}

// Feature #1341: LLM-powered root cause analysis interfaces
interface LLMRootCauseAnalysis {
  request_id: string;
  model_used: string;
  provider: 'kie' | 'anthropic' | 'cached';

  explanation: {
    summary: string;
    what_happened: string;
    why_it_matters: string;
    technical_details: string;
    for_developers: string;
    for_stakeholders: string;
  };

  root_cause: {
    category: 'network' | 'timing' | 'data' | 'element' | 'environment' | 'assertion' | 'authentication' | 'configuration' | 'unknown';
    primary_cause: string;
    contributing_factors: string[];
    chain_of_events: string[];
  };

  remediation: {
    immediate_actions: Array<{
      priority: number;
      action: string;
      rationale: string;
      estimated_time: string;
      complexity: 'low' | 'medium' | 'high';
    }>;
    long_term_fixes: Array<{
      action: string;
      benefit: string;
      effort: string;
    }>;
    code_changes: Array<{
      file_pattern: string;
      change_type: 'add' | 'modify' | 'delete';
      description: string;
      code_snippet?: string;
    }>;
  };

  confidence: {
    overall_score: number;
    explanation_confidence: number;
    root_cause_confidence: number;
    remediation_confidence: number;
    reasoning: string;
    uncertainty_factors: string[];
  };

  metadata: {
    processing_time_ms: number;
    tokens_used: number;
    cost_cents: number;
    cached: boolean;
    cache_key?: string;
  };

  similar_failures: Array<{
    test_name: string;
    error_similarity: number;
    resolution?: string;
    resolved_at?: string;
  }>;
}

interface LLMRootCauseResponse {
  success: boolean;
  run_id: string;
  test_id: string;
  test_name: string;
  analysis: LLMRootCauseAnalysis;
}

// Feature #1537: Anomaly Detection interfaces removed - enterprise monitoring ML not needed for SMB

export function AnalyticsPage() {
  const { token } = useAuthStore();
  const navigate = useNavigate();
  const [failingTests, setFailingTests] = useState<FailingTest[]>([]);
  const [browserStats, setBrowserStats] = useState<BrowserStats[]>([]);
  const [projectStats, setProjectStats] = useState<ProjectComparisonStats[]>([]);
  const [flakyTests, setFlakyTests] = useState<FlakyTest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBrowserStatsLoading, setIsBrowserStatsLoading] = useState(true);
  const [isProjectStatsLoading, setIsProjectStatsLoading] = useState(true);
  const [isFlakyTestsLoading, setIsFlakyTestsLoading] = useState(true);

  // Pass rate trends state
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const [trendSummary, setTrendSummary] = useState<TrendSummary | null>(null);
  const [trendDays, setTrendDays] = useState<7 | 30>(7);
  const [isTrendsLoading, setIsTrendsLoading] = useState(true);

  // Accessibility trends state
  const [a11yTrendData, setA11yTrendData] = useState<AccessibilityTrendDataPoint[]>([]);
  const [a11yTrendSummary, setA11yTrendSummary] = useState<AccessibilityTrendSummary | null>(null);
  const [a11yTrendDays, setA11yTrendDays] = useState<7 | 30>(7);
  const [isA11yTrendsLoading, setIsA11yTrendsLoading] = useState(true);

  // Feature #1537: Anomaly Detection state removed - enterprise monitoring ML not needed for SMB

  useEffect(() => {
    const fetchFailingTests = async () => {
      try {
        const response = await fetch('/api/v1/analytics/failing-tests', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setFailingTests(data.failing_tests || []);
        }
      } catch (error) {
        console.error('Failed to fetch failing tests:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const fetchBrowserStats = async () => {
      try {
        const response = await fetch('/api/v1/analytics/browser-stats', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setBrowserStats(data.browser_stats || []);
        }
      } catch (error) {
        console.error('Failed to fetch browser stats:', error);
      } finally {
        setIsBrowserStatsLoading(false);
      }
    };

    const fetchProjectStats = async () => {
      try {
        const response = await fetch('/api/v1/analytics/project-comparison', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setProjectStats(data.projects || []);
        }
      } catch (error) {
        console.error('Failed to fetch project stats:', error);
      } finally {
        setIsProjectStatsLoading(false);
      }
    };

    const fetchFlakyTests = async () => {
      try {
        const response = await fetch('/api/v1/analytics/flaky-tests', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setFlakyTests(data.flaky_tests || []);
        }
      } catch (error) {
        console.error('Failed to fetch flaky tests:', error);
      } finally {
        setIsFlakyTestsLoading(false);
      }
    };

    fetchFailingTests();
    fetchBrowserStats();
    fetchProjectStats();
    fetchFlakyTests();
  }, [token]);

  // Fetch pass rate trends (separate effect to handle trendDays changes)
  useEffect(() => {
    const fetchTrends = async () => {
      setIsTrendsLoading(true);
      try {
        const response = await fetch(`/api/v1/analytics/pass-rate-trends?days=${trendDays}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setTrendData(data.trends || []);
          setTrendSummary(data.summary || null);
        }
      } catch (error) {
        console.error('Failed to fetch pass rate trends:', error);
      } finally {
        setIsTrendsLoading(false);
      }
    };

    fetchTrends();
  }, [token, trendDays]);

  // Fetch accessibility trends (separate effect to handle a11yTrendDays changes)
  useEffect(() => {
    const fetchA11yTrends = async () => {
      setIsA11yTrendsLoading(true);
      try {
        const response = await fetch(`/api/v1/analytics/accessibility-trends?days=${a11yTrendDays}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setA11yTrendData(data.trends || []);
          setA11yTrendSummary(data.summary || null);
        }
      } catch (error) {
        console.error('Failed to fetch accessibility trends:', error);
      } finally {
        setIsA11yTrendsLoading(false);
      }
    };

    fetchA11yTrends();
  }, [token, a11yTrendDays]);

  // Feature #1537: Anomaly fetch and handlers removed - enterprise monitoring ML not needed for SMB

  // Get browser display name
  const getBrowserDisplayName = (browser: string) => {
    switch (browser) {
      case 'chromium': return 'Chrome';
      case 'firefox': return 'Firefox';
      case 'webkit': return 'Safari';
      default: return browser;
    }
  };

  // Get browser icon
  const getBrowserIcon = (browser: string) => {
    switch (browser) {
      case 'chromium': return '🌐';
      case 'firefox': return '🦊';
      case 'webkit': return '🧭';
      default: return '📱';
    }
  };

  // Export analytics data to CSV
  const handleExportCSV = () => {
    const csvSections: string[] = [];

    // Summary section
    if (trendSummary) {
      csvSections.push('=== ANALYTICS SUMMARY ===');
      csvSections.push('Metric,Value');
      csvSections.push(`Overall Pass Rate,${trendSummary.overall_pass_rate ?? 'N/A'}%`);
      csvSections.push(`Total Runs,${trendSummary.total_runs}`);
      csvSections.push(`Total Passed,${trendSummary.total_passed}`);
      csvSections.push(`Total Failed,${trendSummary.total_failed}`);
      csvSections.push(`Date Range,${trendSummary.start_date} to ${trendSummary.end_date}`);
      csvSections.push('');
    }

    // Pass Rate Trends section
    if (trendData.length > 0) {
      csvSections.push('=== PASS RATE TRENDS ===');
      csvSections.push('Date,Pass Rate,Total Runs,Passed,Failed');
      trendData.forEach(day => {
        csvSections.push(`${day.date},${day.pass_rate ?? 'N/A'}%,${day.total_runs},${day.passed},${day.failed}`);
      });
      csvSections.push('');
    }

    // Most Failing Tests section
    if (failingTests.length > 0) {
      csvSections.push('=== MOST FAILING TESTS ===');
      csvSections.push('Test Name,Suite,Project,Failures,Total Runs,Failure Rate,Last Failure');
      failingTests.forEach(test => {
        const lastFailure = test.last_failure ? new Date(test.last_failure).toISOString() : '';
        csvSections.push(`"${test.test_name}","${test.suite_name}","${test.project_name}",${test.failure_count},${test.total_runs},${test.failure_percentage}%,${lastFailure}`);
      });
      csvSections.push('');
    }

    // Browser Stats section
    if (browserStats.length > 0) {
      csvSections.push('=== BROWSER STATISTICS ===');
      csvSections.push('Browser,Total Runs,Passed,Failed,Error,Pass Rate');
      browserStats.forEach(stat => {
        csvSections.push(`${getBrowserDisplayName(stat.browser)},${stat.total_runs},${stat.passed},${stat.failed},${stat.error},${stat.pass_rate}%`);
      });
      csvSections.push('');
    }

    // Project Comparison section
    if (projectStats.length > 0) {
      csvSections.push('=== PROJECT COMPARISON ===');
      csvSections.push('Project,Slug,Suites,Tests,Total Runs,Pass Rate,Passed,Failed');
      projectStats.forEach(project => {
        csvSections.push(`"${project.project_name}",${project.project_slug},${project.suite_count},${project.test_count},${project.total_runs},${project.pass_rate}%,${project.passed_runs},${project.failed_runs}`);
      });
    }

    const csvContent = csvSections.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analytics-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('Analytics exported to CSV');
  };

  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-foreground">Analytics</h2>
            <p className="mt-2 text-muted-foreground">
              View test analytics and insights for your organization.
            </p>
          </div>
          <button
            onClick={handleExportCSV}
            disabled={isLoading || isTrendsLoading || isBrowserStatsLoading || isProjectStatsLoading}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Export CSV
          </button>
        </div>

        {/* Pass Rate Trends Section */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-semibold text-foreground">Pass Rate Trends</h3>
              <p className="text-sm text-muted-foreground">
                Daily pass rate over the selected time period.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTrendDays(7)}
                className={`px-3 py-1.5 text-sm rounded-md ${
                  trendDays === 7
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                7 Days
              </button>
              <button
                onClick={() => setTrendDays(30)}
                className={`px-3 py-1.5 text-sm rounded-md ${
                  trendDays === 30
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                30 Days
              </button>
            </div>
          </div>

          {isTrendsLoading ? (
            <div className="rounded-lg border border-border bg-card p-8 text-center">
              <p className="text-muted-foreground">Loading trend data...</p>
            </div>
          ) : trendData.length === 0 || !trendSummary || trendSummary.total_runs === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-gradient-to-br from-card to-muted/30 p-12 text-center animate-in fade-in duration-500">
              {/* Illustrated empty state with chart icon */}
              <div className="relative mx-auto w-24 h-24 mb-6">
                <svg className="w-full h-full text-primary/20" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="10" y="20" width="80" height="60" rx="4" />
                  <line x1="20" y1="60" x2="35" y2="45" strokeLinecap="round" />
                  <line x1="35" y1="45" x2="50" y2="55" strokeLinecap="round" />
                  <line x1="50" y1="55" x2="65" y2="35" strokeLinecap="round" />
                  <line x1="65" y1="35" x2="80" y2="40" strokeLinecap="round" />
                  <circle cx="20" cy="60" r="3" fill="currentColor" />
                  <circle cx="35" cy="45" r="3" fill="currentColor" />
                  <circle cx="50" cy="55" r="3" fill="currentColor" />
                  <circle cx="65" cy="35" r="3" fill="currentColor" />
                  <circle cx="80" cy="40" r="3" fill="currentColor" />
                </svg>
                <div className="absolute -bottom-1 -right-1 text-2xl">📊</div>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No Test Data Yet</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Run your first tests to see beautiful trend analytics and track your pass rate over time.
              </p>
              <button
                onClick={() => navigate('/projects')}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-all hover:scale-105"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Run Your First Test
              </button>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card p-4">
              {/* Summary stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <div className="text-2xl font-bold text-foreground">
                    {trendSummary.overall_pass_rate !== null ? `${trendSummary.overall_pass_rate}%` : 'N/A'}
                  </div>
                  <div className="text-xs text-muted-foreground">Overall Pass Rate</div>
                </div>
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <div className="text-2xl font-bold text-foreground">{trendSummary.total_runs}</div>
                  <div className="text-xs text-muted-foreground">Total Runs</div>
                </div>
                <div className="text-center p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <div className="text-2xl font-bold text-green-700 dark:text-green-400">{trendSummary.total_passed}</div>
                  <div className="text-xs text-green-600 dark:text-green-400">Passed</div>
                </div>
                <div className="text-center p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <div className="text-2xl font-bold text-red-700 dark:text-red-400">{trendSummary.total_failed}</div>
                  <div className="text-xs text-red-600 dark:text-red-400">Failed</div>
                </div>
              </div>

              {/* Line chart */}
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={trendData.map(d => ({
                      ...d,
                      displayDate: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    }))}
                    margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis
                      dataKey="displayDate"
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => `${value}%`}
                      className="text-muted-foreground"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value, name) => {
                        if (name === 'Pass Rate') {
                          return [value !== null ? `${value}%` : 'N/A', 'Pass Rate'];
                        }
                        return [value, name];
                      }}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="pass_rate"
                      name="Pass Rate"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6 }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Date range info */}
              <div className="mt-4 text-xs text-center text-muted-foreground">
                Showing data from {trendSummary.start_date} to {trendSummary.end_date}
              </div>
            </div>
          )}
        </div>

        {/* Accessibility Trends Section */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-semibold text-foreground">Accessibility Trends</h3>
              <p className="text-sm text-muted-foreground">
                Track accessibility violations over time.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setA11yTrendDays(7)}
                className={`px-3 py-1.5 text-sm rounded-md ${
                  a11yTrendDays === 7
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                7 Days
              </button>
              <button
                onClick={() => setA11yTrendDays(30)}
                className={`px-3 py-1.5 text-sm rounded-md ${
                  a11yTrendDays === 30
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                30 Days
              </button>
            </div>
          </div>

          {isA11yTrendsLoading ? (
            <div className="rounded-lg border border-border bg-card p-8 text-center">
              <p className="text-muted-foreground">Loading accessibility trend data...</p>
            </div>
          ) : a11yTrendData.length === 0 || !a11yTrendSummary || a11yTrendSummary.total_runs === 0 ? (
            <div className="rounded-lg border border-border bg-card p-8 text-center">
              <p className="text-muted-foreground">No accessibility test data available for this period.</p>
              <p className="text-sm text-muted-foreground mt-2">
                Run some accessibility tests to see violation trends here.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card p-4">
              {/* Summary stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <div className="text-2xl font-bold text-foreground">{a11yTrendSummary.total_runs}</div>
                  <div className="text-xs text-muted-foreground">Total A11y Runs</div>
                </div>
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <div className="text-2xl font-bold text-foreground">{a11yTrendSummary.total_violations}</div>
                  <div className="text-xs text-muted-foreground">Total Violations</div>
                </div>
                <div className="text-center p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                  <div className="text-2xl font-bold text-orange-700 dark:text-orange-400">
                    {a11yTrendSummary.avg_violations_per_run.toFixed(1)}
                  </div>
                  <div className="text-xs text-orange-600 dark:text-orange-400">Avg Violations/Run</div>
                </div>
                <div className={`text-center p-3 rounded-lg ${
                  a11yTrendSummary.violation_trend === 'improving'
                    ? 'bg-green-100 dark:bg-green-900/30'
                    : a11yTrendSummary.violation_trend === 'worsening'
                    ? 'bg-red-100 dark:bg-red-900/30'
                    : 'bg-muted/30'
                }`}>
                  <div className={`text-2xl font-bold ${
                    a11yTrendSummary.violation_trend === 'improving'
                      ? 'text-green-700 dark:text-green-400'
                      : a11yTrendSummary.violation_trend === 'worsening'
                      ? 'text-red-700 dark:text-red-400'
                      : 'text-foreground'
                  }`}>
                    {a11yTrendSummary.violation_trend === 'improving' ? 'Improving' :
                     a11yTrendSummary.violation_trend === 'worsening' ? 'Worsening' : 'Stable'}
                  </div>
                  <div className="text-xs text-muted-foreground">Trend</div>
                </div>
              </div>

              {/* Line chart - stacked area chart for violation severity */}
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={a11yTrendData.map(d => ({
                      ...d,
                      displayDate: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    }))}
                    margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis
                      dataKey="displayDate"
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value, name) => [value, name]}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="total_violations"
                      name="Total Violations"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="critical"
                      name="Critical"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={{ fill: '#ef4444', strokeWidth: 2, r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="serious"
                      name="Serious"
                      stroke="#f97316"
                      strokeWidth={2}
                      dot={{ fill: '#f97316', strokeWidth: 2, r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="moderate"
                      name="Moderate"
                      stroke="#eab308"
                      strokeWidth={2}
                      dot={{ fill: '#eab308', strokeWidth: 2, r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="minor"
                      name="Minor"
                      stroke="#22c55e"
                      strokeWidth={2}
                      dot={{ fill: '#22c55e', strokeWidth: 2, r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Date range info */}
              <div className="mt-4 text-xs text-center text-muted-foreground">
                Showing data from {a11yTrendSummary.start_date} to {a11yTrendSummary.end_date}
              </div>
            </div>
          )}
        </div>

        {/* Most Failing Tests Section */}
        <div className="mt-8">
          <h3 className="text-xl font-semibold text-foreground mb-4">Most Failing Tests</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Tests with the highest failure counts, sorted by number of failures.
          </p>

          {isLoading ? (
            <div className="rounded-lg border border-border bg-card p-8 text-center">
              <p className="text-muted-foreground">Loading failing tests...</p>
            </div>
          ) : failingTests.length === 0 ? (
            <div className="rounded-lg border border-dashed border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 p-12 text-center animate-in fade-in duration-500 relative overflow-hidden">
              {/* Confetti animation */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {[...Array(12)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute animate-bounce"
                    style={{
                      left: `${10 + (i * 7)}%`,
                      top: `${Math.random() * 30 + 10}%`,
                      animationDelay: `${i * 0.1}s`,
                      animationDuration: `${1.5 + Math.random()}s`,
                    }}
                  >
                    <span className="text-lg opacity-60">{['🎉', '✨', '⭐', '🌟'][i % 4]}</span>
                  </div>
                ))}
              </div>
              {/* Happy checkmark character */}
              <div className="relative mx-auto w-20 h-20 mb-6">
                <div className="w-full h-full rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                  <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="absolute -bottom-1 -right-1 text-2xl">😊</div>
              </div>
              <h3 className="text-xl font-semibold text-green-700 dark:text-green-400 mb-2">All Tests Passing!</h3>
              <p className="text-green-600 dark:text-green-500 max-w-md mx-auto">
                Your code is looking great. No failing tests found in the selected time period.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Test Name</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Suite / Project</th>
                    <th className="text-center px-4 py-3 text-sm font-medium text-foreground">Failures</th>
                    <th className="text-center px-4 py-3 text-sm font-medium text-foreground">Total Runs</th>
                    <th className="text-center px-4 py-3 text-sm font-medium text-foreground">Failure Rate</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Last Failure</th>
                  </tr>
                </thead>
                <tbody>
                  {failingTests.map((test, index) => (
                    <tr
                      key={test.test_id}
                      className={`border-t border-border hover:bg-muted/30 cursor-pointer ${
                        index % 2 === 0 ? 'bg-background' : 'bg-muted/10'
                      }`}
                      onClick={() => navigate(`/tests/${test.test_id}`)}
                    >
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-foreground hover:text-primary">
                          {test.test_name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          <span className="text-foreground">{test.suite_name}</span>
                          <span className="text-muted-foreground"> / </span>
                          <span className="text-muted-foreground">{test.project_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 text-sm font-bold text-red-600 bg-red-100 dark:bg-red-900/30 rounded">
                          {test.failure_count}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm text-muted-foreground">{test.total_runs}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-sm font-medium ${
                          test.failure_percentage >= 80 ? 'text-red-600' :
                          test.failure_percentage >= 50 ? 'text-orange-500' :
                          'text-yellow-600'
                        }`}>
                          {test.failure_percentage}%
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-muted-foreground">
                          {test.last_failure
                            ? new Date(test.last_failure).toLocaleString()
                            : '-'
                          }
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Browser-Specific Pass Rates Section */}
        <div className="mt-8">
          <h3 className="text-xl font-semibold text-foreground mb-4">Browser-Specific Pass Rates</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Test results broken down by browser to identify browser-specific issues.
          </p>

          {isBrowserStatsLoading ? (
            <div className="rounded-lg border border-border bg-card p-8 text-center">
              <p className="text-muted-foreground">Loading browser statistics...</p>
            </div>
          ) : browserStats.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-8 text-center">
              <p className="text-muted-foreground">No browser data available.</p>
              <p className="text-sm text-muted-foreground mt-2">
                Run some tests to see browser-specific analytics.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {browserStats.map((stat) => (
                <div
                  key={stat.browser}
                  className="rounded-lg border border-border bg-card p-6"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-2xl">{getBrowserIcon(stat.browser)}</span>
                    <h4 className="text-lg font-semibold text-foreground">
                      {getBrowserDisplayName(stat.browser)}
                    </h4>
                  </div>

                  {/* Pass Rate Progress Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Pass Rate</span>
                      <span className={`font-medium ${
                        stat.pass_rate >= 80 ? 'text-emerald-600' :
                        stat.pass_rate >= 50 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {stat.pass_rate}%
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          stat.pass_rate >= 80 ? 'bg-emerald-500' :
                          stat.pass_rate >= 50 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${stat.pass_rate}%` }}
                      />
                    </div>
                  </div>

                  {/* Stats breakdown */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 bg-muted/30 rounded">
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="text-sm font-semibold text-foreground">{stat.total_runs}</p>
                    </div>
                    <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded">
                      <p className="text-xs text-emerald-600">Passed</p>
                      <p className="text-sm font-semibold text-emerald-600">{stat.passed}</p>
                    </div>
                    <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded">
                      <p className="text-xs text-red-600">Failed</p>
                      <p className="text-sm font-semibold text-red-600">{stat.failed + stat.error}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Project Comparison Section */}
        <div className="mt-8">
          <h3 className="text-xl font-semibold text-foreground mb-4">Project Comparison</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Compare test statistics across all projects in your organization.
          </p>

          {isProjectStatsLoading ? (
            <div className="rounded-lg border border-border bg-card p-8 text-center">
              <p className="text-muted-foreground">Loading project statistics...</p>
            </div>
          ) : projectStats.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-8 text-center">
              <p className="text-muted-foreground">No projects found.</p>
              <p className="text-sm text-muted-foreground mt-2">
                Create projects and run tests to see comparison analytics.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Project</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Suites</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Tests</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Runs</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Pass Rate</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Passed</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Failed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {projectStats.map((project) => (
                    <tr
                      key={project.project_id}
                      className="hover:bg-muted/30 cursor-pointer"
                      onClick={() => navigate(`/projects/${project.project_id}`)}
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-foreground">{project.project_name}</p>
                          <p className="text-xs text-muted-foreground">{project.project_slug}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-foreground">{project.suite_count}</td>
                      <td className="px-4 py-3 text-center text-foreground">{project.test_count}</td>
                      <td className="px-4 py-3 text-center text-foreground">{project.total_runs}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                project.pass_rate >= 80 ? 'bg-emerald-500' :
                                project.pass_rate >= 50 ? 'bg-yellow-500' :
                                project.total_runs === 0 ? 'bg-muted' :
                                'bg-red-500'
                              }`}
                              style={{ width: `${project.pass_rate}%` }}
                            />
                          </div>
                          <span className={`text-sm font-medium ${
                            project.pass_rate >= 80 ? 'text-emerald-600' :
                            project.pass_rate >= 50 ? 'text-yellow-600' :
                            project.total_runs === 0 ? 'text-muted-foreground' :
                            'text-red-600'
                          }`}>
                            {project.total_runs === 0 ? '-' : `${project.pass_rate}%`}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center min-w-[24px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-sm font-medium">
                          {project.passed_runs}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center justify-center min-w-[24px] px-2 py-0.5 rounded-full text-sm font-medium ${
                          project.failed_runs > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {project.failed_runs}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Flaky Tests Section */}
        <div className="mt-8">
          <h3 className="text-xl font-semibold text-foreground mb-4">Flaky Tests</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Tests with inconsistent results (sometimes pass, sometimes fail). These tests need attention to improve reliability.
          </p>

          {isFlakyTestsLoading ? (
            <div className="rounded-lg border border-border bg-card p-8 text-center">
              <p className="text-muted-foreground">Loading flaky tests...</p>
            </div>
          ) : flakyTests.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-8 text-center">
              <p className="text-muted-foreground font-medium">No flaky tests detected!</p>
              <p className="text-sm text-muted-foreground mt-2">
                Your tests are running consistently. Keep up the good work!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {flakyTests.slice(0, 5).map((test) => (
                <div
                  key={test.test_id}
                  className="rounded-lg border border-border bg-card p-4 hover:border-primary/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/tests/${test.test_id}`)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-medium text-foreground">{test.test_name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {test.suite_name} / {test.project_name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                        Flaky
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        test.flakiness_percentage >= 70 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                        test.flakiness_percentage >= 40 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                        'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      }`}>
                        {test.flakiness_percentage}% flaky
                      </span>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-6 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Runs:</span>
                      <span className="text-sm font-medium text-foreground">{test.total_runs}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Pass Rate:</span>
                      <span className={`text-sm font-medium ${
                        test.pass_rate >= 70 ? 'text-emerald-600' :
                        test.pass_rate >= 40 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>{test.pass_rate}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-emerald-600">{test.pass_count} passed</span>
                      <span className="text-sm text-red-600">{test.fail_count} failed</span>
                    </div>
                  </div>

                  {/* Recommendation */}
                  <div className="bg-muted/30 rounded-md p-3">
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">Recommendation:</span>{' '}
                      {test.recommendation}
                    </p>
                  </div>
                </div>
              ))}
              {flakyTests.length > 5 && (
                <div className="text-center">
                  <button
                    onClick={() => navigate('/flaky-tests')}
                    className="text-sm text-primary hover:underline"
                  >
                    View all {flakyTests.length} flaky tests
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Feature #1537: Anomaly Detection Section & Modal removed - enterprise monitoring ML not needed for SMB */}

        {/* Feature #1075: AI Failure Clusters Section */}
        <FailureClustersSection token={token} navigate={navigate} />
      </div>
    </Layout>
  );
}

// FailureClustersSection component
function FailureClustersSection({ token, navigate }: { token: string | null; navigate: (path: string) => void }) {
  const [clusters, setClusters] = useState<FailureCluster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null);
  const [days, setDays] = useState<7 | 14 | 30>(7);

  useEffect(() => {
    const fetchClusters = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/v1/ai/failure-clusters?days=${days}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setClusters(data.clusters || []);
        }
      } catch (error) {
        console.error('Failed to fetch failure clusters:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (token) {
      fetchClusters();
    }
  }, [token, days]);

  // Get cluster icon based on pattern type
  const getClusterIcon = (patternType: string): string => {
    const icons: Record<string, string> = {
      'Network Issues': '🌐',
      'Timing/Race Conditions': '⏱️',
      'Data Issues': '📊',
      'Element Locator Issues': '🔍',
      'Environment Issues': '⚙️',
      'Timeout': '⏱️',
      'Element Not Found': '🔍',
      'Network': '🌐',
      'Navigation': '🧭',
      'Assertion': '❌',
      'Click': '👆',
      'Selector': '🎯',
      'Authentication': '🔐',
      'Server': '🖥️',
      'Rate Limit': '🚫',
      'Other': '❓',
    };
    return icons[patternType] || '❓';
  };

  const getClusterColor = (patternType: string): string => {
    const colors: Record<string, string> = {
      'Network Issues': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800',
      'Timing/Race Conditions': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800',
      'Data Issues': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800',
      'Element Locator Issues': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800',
      'Environment Issues': 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300 border-slate-200 dark:border-slate-800',
      'Timeout': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800',
      'Element Not Found': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800',
      'Network': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    };
    return colors[patternType] || 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300 border-gray-200 dark:border-gray-800';
  };

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
            AI Failure Clusters
          </h3>
          <p className="text-sm text-muted-foreground">
            AI-grouped failures with similar patterns across your test runs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value) as 7 | 14 | 30)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">Analyzing failure patterns...</p>
        </div>
      ) : clusters.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground font-medium">No failure clusters found!</p>
          <p className="text-sm text-muted-foreground mt-2">
            Either your tests are all passing, or failures are too few to cluster. Great job!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Cluster Overview */}
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-foreground flex items-center gap-2">
                <span>📊</span>
                Cluster Overview
              </h4>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-4 gap-4 text-center">
              <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                <div className="text-2xl font-bold text-foreground">{clusters.length}</div>
                <div className="text-xs text-muted-foreground">Clusters</div>
              </div>
              <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {clusters.reduce((sum, c) => sum + c.count, 0)}
                </div>
                <div className="text-xs text-muted-foreground">Total Failures</div>
              </div>
              <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {new Set(clusters.flatMap(c => c.affected_tests)).size}
                </div>
                <div className="text-xs text-muted-foreground">Tests Affected</div>
              </div>
              <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                <div className="text-2xl font-bold text-foreground">
                  {Math.max(...clusters.map(c => c.count))}
                </div>
                <div className="text-xs text-muted-foreground">Largest Cluster</div>
              </div>
            </div>
          </div>

          {/* Cluster List */}
          {clusters.map((cluster) => (
            <div
              key={cluster.cluster_id}
              className={`rounded-lg border bg-card overflow-hidden transition-all ${getClusterColor(cluster.pattern_type).split(' ').slice(0, 3).join(' ')}`}
            >
              {/* Cluster Header */}
              <div
                className="p-4 cursor-pointer hover:bg-muted/50"
                onClick={() => setExpandedCluster(expandedCluster === cluster.cluster_id ? null : cluster.cluster_id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getClusterIcon(cluster.pattern_type)}</span>
                    <div>
                      <h4 className="font-semibold text-foreground">{cluster.cluster_name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {cluster.affected_tests.length} affected test{cluster.affected_tests.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-2xl font-bold text-foreground">{cluster.count}</span>
                      <span className="text-sm text-muted-foreground ml-1">failure{cluster.count !== 1 ? 's' : ''}</span>
                    </div>
                    <svg
                      className={`w-5 h-5 text-muted-foreground transition-transform ${expandedCluster === cluster.cluster_id ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                  <span>First seen: {new Date(cluster.first_seen).toLocaleString()}</span>
                  <span>|</span>
                  <span>Last seen: {new Date(cluster.last_seen).toLocaleString()}</span>
                </div>
              </div>

              {/* Expanded Content */}
              {expandedCluster === cluster.cluster_id && (
                <div className="border-t border-border bg-background/50 p-4">
                  <h5 className="text-sm font-medium text-foreground mb-3">Recent Failures</h5>
                  <div className="space-y-2">
                    {cluster.failures.slice(0, 5).map((failure, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-md bg-card border border-border hover:border-primary/50 transition-colors cursor-pointer"
                        onClick={() => navigate(`/tests/${failure.test_id}`)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground truncate">{failure.test_name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {failure.suite_name} / {failure.project_name}
                            </p>
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1 truncate" title={failure.error_message}>
                              {failure.error_message.slice(0, 100)}{failure.error_message.length > 100 ? '...' : ''}
                            </p>
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                            {new Date(failure.timestamp).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                    {cluster.failures.length > 5 && (
                      <p className="text-xs text-muted-foreground text-center pt-2">
                        + {cluster.failures.length - 5} more failures
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
