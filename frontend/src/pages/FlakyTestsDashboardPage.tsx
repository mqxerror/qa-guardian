// Feature #1441: FlakyTestsDashboardPage extracted from App.tsx (~1,575 lines)
// Features #1102-1107: Flaky test management, quarantine, suggestions, impact report

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuthStore } from '../stores/authStore';
import { toast } from '../stores/toastStore';

// FlakyTest interface
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
  quarantined?: boolean;
  released_from_quarantine_at?: string;
}

export function FlakyTestsDashboardPage() {
  const { token } = useAuthStore();
  const navigate = useNavigate();
  const [flakyTests, setFlakyTests] = useState<FlakyTest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [suiteFilter, setSuiteFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [sortBy, setSortBy] = useState<'score' | 'name' | 'runs'>('score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [suites, setSuites] = useState<Array<{ id: string; name: string; project_id: string }>>([]);

  // Feature #1102: Flaky Test Impact Report state
  const [impactReport, setImpactReport] = useState<{
    report_period: { start: string; end: string; days: number };
    summary: { total_flaky_tests: number; total_test_runs: number; average_flakiness_score: number };
    impact: {
      ci_time_wasted: { minutes: number; hours: number; cost_usd: number };
      developer_time_investigating: { minutes: number; hours: number; cost_usd: number };
      false_failure_alerts: { count: number; estimated_noise_percentage: number };
      total_cost_impact: { usd: number; monthly_projection_usd: number; annual_projection_usd: number };
    };
    top_offenders: Array<{
      test_id: string;
      test_name: string;
      flakiness_score: number;
      total_runs: number;
      failures: number;
      retries: number;
      ci_time_wasted_minutes: number;
      investigation_incidents: number;
      estimated_dev_time_minutes: number;
      estimated_cost: number;
    }>;
    weekly_trend: Array<{
      week_start: string;
      retries: number;
      investigation_incidents: number;
      ci_time_minutes: number;
      estimated_cost: number;
    }>;
    recommendations: Array<{
      priority: string;
      action: string;
      description: string;
      estimated_savings_usd: number;
    }>;
  } | null>(null);
  const [isLoadingImpact, setIsLoadingImpact] = useState(true);
  const [showImpactReport, setShowImpactReport] = useState(true);

  // Feature #1104: Auto-quarantine settings state
  const [autoQuarantineSettings, setAutoQuarantineSettings] = useState<{
    enabled: boolean;
    threshold: number;
    min_runs: number;
    notify_on_quarantine: boolean;
    quarantine_reason_prefix: string;
  } | null>(null);
  const [showAutoQuarantineSettings, setShowAutoQuarantineSettings] = useState(false);
  const [isLoadingAutoQuarantine, setIsLoadingAutoQuarantine] = useState(false);
  const [autoQuarantineResult, setAutoQuarantineResult] = useState<{
    tests_quarantined: number;
    quarantined_tests: Array<{
      test_id: string;
      test_name: string;
      flakiness_score: number;
      quarantined_at: string;
    }>;
  } | null>(null);

  // Feature #1105: Retry strategy settings state
  const [retryStrategySettings, setRetryStrategySettings] = useState<{
    enabled: boolean;
    rules: Array<{ min_score: number; max_score: number; retries: number }>;
    default_retries: number;
    max_retries: number;
  } | null>(null);
  const [showRetryStrategySettings, setShowRetryStrategySettings] = useState(false);
  const [retryStrategyPreview, setRetryStrategyPreview] = useState<{
    total_flaky_tests: number;
    by_rule: Array<{
      range: string;
      retries: number;
      test_count: number;
      tests: Array<{ test_id: string; test_name: string; flakiness_percentage: number }>;
    }>;
  } | null>(null);

  // Feature #1106: Flakiness remediation suggestions state
  const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);
  const [selectedTestForSuggestions, setSelectedTestForSuggestions] = useState<string | null>(null);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<{
    test_id: string;
    test_name: string;
    suite_name: string;
    project_name: string;
    analysis: {
      total_runs: number;
      pass_count: number;
      fail_count: number;
      flakiness_score: number;
      flakiness_percentage: number;
      is_retry_flaky: boolean;
      retry_success_rate: number;
      patterns_detected: string[];
    };
    suggestions: Array<{
      id: string;
      category: string;
      priority: 'high' | 'medium' | 'low';
      title: string;
      description: string;
      pattern_matched: string;
      confidence: number;
      code_example?: {
        before: string;
        after: string;
        language: string;
        explanation: string;
      };
      impact: string;
      implementation_steps: string[];
    }>;
    suggestions_count: number;
    high_priority_count: number;
    generated_at: string;
  } | null>(null);

  // Feature #1953: AI flakiness pattern analysis state
  const [showFlakinessAnalysisModal, setShowFlakinessAnalysisModal] = useState(false);
  const [selectedTestForAnalysis, setSelectedTestForAnalysis] = useState<FlakyTest | null>(null);
  const [isLoadingFlakinessAnalysis, setIsLoadingFlakinessAnalysis] = useState(false);
  const [flakinessAnalysis, setFlakinessAnalysis] = useState<string | null>(null);
  const [flakinessAnalysisCache, setFlakinessAnalysisCache] = useState<Record<string, { analysis: string; timestamp: number }>>({});

  // Fetch flaky tests
  useEffect(() => {
    const fetchFlakyTests = async () => {
      if (!token) return;
      try {
        const response = await fetch('https://qa.pixelcraftedmedia.com/api/v1/analytics/flaky-tests', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setFlakyTests(data.flaky_tests || []);
          // Extract unique projects and suites
          const projectMap = new Map<string, string>();
          const suiteMap = new Map<string, { name: string; project_id: string }>();
          (data.flaky_tests || []).forEach((t: FlakyTest) => {
            projectMap.set(t.project_id, t.project_name);
            suiteMap.set(t.suite_id, { name: t.suite_name, project_id: t.project_id });
          });
          setProjects(Array.from(projectMap.entries()).map(([id, name]) => ({ id, name })));
          setSuites(Array.from(suiteMap.entries()).map(([id, { name, project_id }]) => ({ id, name, project_id })));
        }
      } catch (error) {
        console.error('Failed to fetch flaky tests:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchFlakyTests();
  }, [token]);

  // Feature #1102: Fetch flaky test impact report
  useEffect(() => {
    const fetchImpactReport = async () => {
      if (!token) return;
      try {
        const response = await fetch('/api/v1/ai-insights/flaky-impact-report', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setImpactReport(data);
        }
      } catch (error) {
        console.error('Failed to fetch impact report:', error);
      } finally {
        setIsLoadingImpact(false);
      }
    };
    fetchImpactReport();
  }, [token]);

  // Feature #1104: Fetch auto-quarantine settings
  useEffect(() => {
    const fetchAutoQuarantineSettings = async () => {
      if (!token) return;
      try {
        const response = await fetch('/api/v1/organization/auto-quarantine-settings', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setAutoQuarantineSettings(data.settings);
        }
      } catch (error) {
        console.error('Failed to fetch auto-quarantine settings:', error);
      }
    };
    fetchAutoQuarantineSettings();
  }, [token]);

  // Feature #1105: Fetch retry strategy settings
  useEffect(() => {
    const fetchRetryStrategySettings = async () => {
      if (!token) return;
      try {
        const response = await fetch('/api/v1/organization/retry-strategy-settings', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setRetryStrategySettings(data.settings);
        }
      } catch (error) {
        console.error('Failed to fetch retry strategy settings:', error);
      }
    };
    fetchRetryStrategySettings();
  }, [token]);

  // Feature #1105: Fetch retry strategy preview
  const fetchRetryStrategyPreview = async () => {
    if (!token) return;
    try {
      const response = await fetch('/api/v1/organization/retry-strategy-preview', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setRetryStrategyPreview(data.preview);
      }
    } catch (error) {
      console.error('Failed to fetch retry strategy preview:', error);
    }
  };

  // Feature #1105: Update retry strategy settings
  const handleUpdateRetryStrategySettings = async (updates: Partial<typeof retryStrategySettings>) => {
    if (!token) return;
    try {
      const response = await fetch('/api/v1/organization/retry-strategy-settings', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      if (response.ok) {
        const data = await response.json();
        setRetryStrategySettings(data.settings);
        toast.success('Retry strategy settings updated');
        // Refresh preview
        fetchRetryStrategyPreview();
      } else {
        toast.error('Failed to update retry strategy settings');
      }
    } catch (error) {
      console.error('Failed to update retry strategy settings:', error);
      toast.error('Failed to update retry strategy settings');
    }
  };

  // Feature #1105: Update a specific rule's retry count
  const handleUpdateRuleRetries = (ruleIndex: number, newRetries: number) => {
    if (!retryStrategySettings) return;
    const updatedRules = [...retryStrategySettings.rules];
    updatedRules[ruleIndex] = { ...updatedRules[ruleIndex], retries: newRetries };
    handleUpdateRetryStrategySettings({ rules: updatedRules });
  };

  // Feature #1104: Run auto-quarantine check
  const handleRunAutoQuarantine = async () => {
    if (!token) return;
    setIsLoadingAutoQuarantine(true);
    try {
      const response = await fetch('/api/v1/ai-insights/check-auto-quarantine', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setAutoQuarantineResult(data);
        if (data.tests_quarantined > 0) {
          toast.success(`Auto-quarantined ${data.tests_quarantined} test(s) exceeding threshold`);
          // Refresh flaky tests list to update quarantine status
          const flakyResponse = await fetch('https://qa.pixelcraftedmedia.com/api/v1/analytics/flaky-tests', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (flakyResponse.ok) {
            const flakyData = await flakyResponse.json();
            setFlakyTests(flakyData.flaky_tests || []);
          }
        } else {
          toast.info('No tests exceeded the auto-quarantine threshold');
        }
      } else {
        toast.error('Failed to run auto-quarantine check');
      }
    } catch (error) {
      console.error('Failed to run auto-quarantine:', error);
      toast.error('Failed to run auto-quarantine check');
    } finally {
      setIsLoadingAutoQuarantine(false);
    }
  };

  // Feature #1104: Update auto-quarantine settings
  const handleUpdateAutoQuarantineSettings = async (updates: Partial<typeof autoQuarantineSettings>) => {
    if (!token) return;
    try {
      const response = await fetch('/api/v1/organization/auto-quarantine-settings', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      if (response.ok) {
        const data = await response.json();
        setAutoQuarantineSettings(data.settings);
        toast.success('Auto-quarantine settings updated');
      } else {
        toast.error('Failed to update settings');
      }
    } catch (error) {
      console.error('Failed to update auto-quarantine settings:', error);
      toast.error('Failed to update settings');
    }
  };

  // Filter and sort tests
  const filteredTests = flakyTests
    .filter((t) => {
      if (projectFilter !== 'all' && t.project_id !== projectFilter) return false;
      if (suiteFilter !== 'all' && t.suite_id !== suiteFilter) return false;
      if (severityFilter !== 'all') {
        const score = t.flakiness_score || t.flakiness_percentage / 100;
        if (severityFilter === 'high' && score < 0.7) return false;
        if (severityFilter === 'medium' && (score < 0.4 || score >= 0.7)) return false;
        if (severityFilter === 'low' && score >= 0.4) return false;
      }
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'score') {
        comparison = (a.flakiness_score || a.flakiness_percentage / 100) - (b.flakiness_score || b.flakiness_percentage / 100);
      } else if (sortBy === 'name') {
        comparison = a.test_name.localeCompare(b.test_name);
      } else if (sortBy === 'runs') {
        comparison = a.total_runs - b.total_runs;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  // Available suites based on project filter
  const availableSuites = projectFilter === 'all' ? suites : suites.filter(s => s.project_id === projectFilter);

  // Handle quick actions
  // Feature #1103: Quarantine a flaky test
  const handleQuarantine = async (testId: string) => {
    if (!token) return;
    try {
      const response = await fetch(`/api/v1/tests/${testId}/quarantine`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: 'Flaky test - investigating' }),
      });
      if (response.ok) {
        const data = await response.json();
        toast.success(`Test "${data.test_name}" quarantined successfully`);
        // Update local state to show quarantine status
        setFlakyTests(prev => prev.map(t =>
          t.test_id === testId ? { ...t, quarantined: true } : t
        ));
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to quarantine test');
      }
    } catch (error) {
      console.error('Failed to quarantine test:', error);
      toast.error('Failed to quarantine test');
    }
  };

  // Feature #1103: Unquarantine a test
  const handleUnquarantine = async (testId: string) => {
    if (!token) return;
    try {
      const response = await fetch(`/api/v1/tests/${testId}/unquarantine`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        toast.success(`Test "${data.test_name}" removed from quarantine`);
        // Update local state
        setFlakyTests(prev => prev.map(t =>
          t.test_id === testId ? { ...t, quarantined: false } : t
        ));
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to unquarantine test');
      }
    } catch (error) {
      console.error('Failed to unquarantine test:', error);
      toast.error('Failed to unquarantine test');
    }
  };

  // ===========================================
  // Feature #1107: Release test from quarantine with confirmation
  // ===========================================
  const [showReleaseConfirmModal, setShowReleaseConfirmModal] = useState(false);
  const [testToRelease, setTestToRelease] = useState<{ test_id: string; test_name: string } | null>(null);
  const [isReleasingFromQuarantine, setIsReleasingFromQuarantine] = useState(false);

  const handleReleaseFromQuarantine = (testId: string, testName: string) => {
    setTestToRelease({ test_id: testId, test_name: testName });
    setShowReleaseConfirmModal(true);
  };

  const confirmReleaseFromQuarantine = async () => {
    if (!token || !testToRelease) return;
    setIsReleasingFromQuarantine(true);

    try {
      const response = await fetch(`/api/v1/tests/${testToRelease.test_id}/unquarantine`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        toast.success(`Test "${data.test_name}" released from quarantine and is now running normally`, 5000);
        // Update local state
        setFlakyTests(prev => prev.map(t =>
          t.test_id === testToRelease.test_id
            ? { ...t, quarantined: false, released_from_quarantine_at: new Date().toISOString() }
            : t
        ));
        setShowReleaseConfirmModal(false);
        setTestToRelease(null);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to release test from quarantine');
      }
    } catch (error) {
      console.error('Failed to release test from quarantine:', error);
      toast.error('Failed to release test from quarantine');
    } finally {
      setIsReleasingFromQuarantine(false);
    }
  };

  const handleInvestigate = (testId: string) => {
    navigate(`/tests/${testId}`);
  };

  const handleIgnore = async (testId: string) => {
    toast.info(`Ignoring test ${testId}... (Feature coming soon)`);
  };

  // Feature #1106: Get AI suggestions for a flaky test
  const handleGetSuggestions = async (testId: string) => {
    if (!token) return;
    setSelectedTestForSuggestions(testId);
    setShowSuggestionsModal(true);
    setIsLoadingSuggestions(true);
    setSuggestions(null);

    try {
      const response = await fetch(`/api/v1/ai-insights/flaky-tests/${testId}/suggestions?include_code_examples=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data);
      } else {
        toast.error('Failed to load AI suggestions');
      }
    } catch (error) {
      console.error('Failed to get suggestions:', error);
      toast.error('Failed to load AI suggestions');
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  // Feature #1953: AI flakiness pattern analysis
  const handleAnalyzeFlakiness = async (test: FlakyTest) => {
    if (!token) return;

    // Check cache first (24hr TTL)
    const cached = flakinessAnalysisCache[test.test_id];
    if (cached && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
      setSelectedTestForAnalysis(test);
      setFlakinessAnalysis(cached.analysis);
      setShowFlakinessAnalysisModal(true);
      console.log('[AI Cache] Using cached flakiness analysis for:', test.test_name);
      return;
    }

    setSelectedTestForAnalysis(test);
    setShowFlakinessAnalysisModal(true);
    setIsLoadingFlakinessAnalysis(true);
    setFlakinessAnalysis(null);

    // Build summarized history for AI (Feature #1953 Step 2 & 3)
    const historySummary = {
      test_name: test.test_name,
      suite_name: test.suite_name,
      project_name: test.project_name,
      total_runs: test.total_runs,
      pass_count: test.pass_count,
      fail_count: test.fail_count,
      pass_rate: test.pass_rate,
      flakiness_score: test.flakiness_score,
      is_retry_flaky: test.is_retry_flaky,
      retry_success_rate: test.retry_success_rate,
      has_time_pattern: test.has_time_pattern,
      time_pattern_summary: test.time_pattern_summary,
      peak_failure_hours: test.peak_failure_hours?.slice(0, 3), // Top 3 only
      has_environment_pattern: test.has_environment_pattern,
      environment_pattern_summary: test.environment_pattern_summary,
      is_browser_specific: test.is_browser_specific,
      is_os_specific: test.is_os_specific,
      fails_more_on_ci: test.fails_more_on_ci,
      recent_runs: test.recent_runs?.slice(-10).map(r => r.result), // Last 10 results only
    };

    try {
      const response = await fetch('https://qa.pixelcraftedmedia.com/api/v1/mcp-tools/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: `Analyze why this test is flaky. Identify patterns (time-based, environment-based, data-based) and provide actionable fix suggestions.

Test Data:
${JSON.stringify(historySummary, null, 2)}

Please provide:
1. What patterns indicate this test is flaky
2. Most likely root cause(s)
3. Specific actionable recommendations to fix it
4. Priority: should this be quarantined, fixed, or monitored?`,
          complexity: 'simple', // Use Haiku for cost efficiency
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const analysis = data.response || data.content || 'No analysis available';
        setFlakinessAnalysis(analysis);
        // Cache the result
        setFlakinessAnalysisCache(prev => ({
          ...prev,
          [test.test_id]: { analysis, timestamp: Date.now() },
        }));
        console.log('[AI Triggered] Flakiness analysis for:', test.test_name);
      } else {
        toast.error('Failed to analyze flakiness');
        setFlakinessAnalysis('Failed to get AI analysis. Please try again.');
      }
    } catch (error) {
      console.error('Failed to analyze flakiness:', error);
      toast.error('Failed to analyze flakiness');
      setFlakinessAnalysis('Error connecting to AI service. Please try again.');
    } finally {
      setIsLoadingFlakinessAnalysis(false);
    }
  };

  // Sparkline component for trend visualization
  const Sparkline = ({ runs }: { runs?: Array<{ result: 'passed' | 'failed'; timestamp: string }> }) => {
    if (!runs || runs.length === 0) {
      return <span className="text-xs text-muted-foreground">No data</span>;
    }
    return (
      <div className="flex gap-px h-4 w-24">
        {runs.slice(-10).map((run, idx) => (
          <div
            key={idx}
            className={`flex-1 rounded-sm ${
              run.result === 'passed' ? 'bg-emerald-500' : 'bg-red-500'
            }`}
            title={`${run.result === 'passed' ? '✓ Passed' : '✗ Failed'}`}
          />
        ))}
      </div>
    );
  };

  // Get severity badge
  const getSeverityBadge = (score: number) => {
    if (score >= 0.7) return { label: 'High', class: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' };
    if (score >= 0.4) return { label: 'Medium', class: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' };
    return { label: 'Low', class: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' };
  };

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <span className="text-2xl">🔮</span> AI Insights - Flaky Tests
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage and investigate tests with inconsistent results
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Feature #1105: Retry Strategy button */}
            <button
              onClick={() => {
                setShowRetryStrategySettings(!showRetryStrategySettings);
                if (!showRetryStrategySettings) {
                  fetchRetryStrategyPreview();
                }
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 transition-colors"
              title="Configure retry strategy based on flakiness level"
            >
              <span>🔄</span> Retry Strategy
              {retryStrategySettings?.enabled && (
                <span className="px-1.5 py-0.5 rounded text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  ON
                </span>
              )}
            </button>
            {/* Feature #1104: Auto-quarantine button */}
            <button
              onClick={() => setShowAutoQuarantineSettings(!showAutoQuarantineSettings)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50 transition-colors"
              title="Configure auto-quarantine settings"
            >
              <span>⚙️</span> Auto-Quarantine
              {autoQuarantineSettings?.enabled && (
                <span className="px-1.5 py-0.5 rounded text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  ON
                </span>
              )}
            </button>
            <div className="text-right">
              <span className="text-3xl font-bold text-orange-600">{filteredTests.length}</span>
              <p className="text-sm text-muted-foreground">Flaky Tests</p>
            </div>
          </div>
        </div>

        {/* Feature #1104: Auto-Quarantine Settings Panel */}
        {showAutoQuarantineSettings && autoQuarantineSettings && (
          <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-2">
                <span>🤖</span> Auto-Quarantine Settings
              </h2>
              <button
                onClick={() => setShowAutoQuarantineSettings(false)}
                className="text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              {/* Enable/Disable Toggle */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-700">
                <label className="flex items-center gap-2 cursor-pointer flex-1">
                  <input
                    type="checkbox"
                    checked={autoQuarantineSettings.enabled}
                    onChange={(e) => handleUpdateAutoQuarantineSettings({ enabled: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-sm font-medium text-foreground">Enabled</span>
                </label>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  autoQuarantineSettings.enabled
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                }`}>
                  {autoQuarantineSettings.enabled ? 'Active' : 'Disabled'}
                </span>
              </div>

              {/* Threshold Setting */}
              <div className="p-3 rounded-lg bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-700">
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  Flakiness Threshold
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0.3"
                    max="1.0"
                    step="0.05"
                    value={autoQuarantineSettings.threshold}
                    onChange={(e) => handleUpdateAutoQuarantineSettings({ threshold: parseFloat(e.target.value) })}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
                  />
                  <span className="text-sm font-bold text-amber-600 min-w-[3rem] text-right">
                    {(autoQuarantineSettings.threshold * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              {/* Minimum Runs Setting */}
              <div className="p-3 rounded-lg bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-700">
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  Min Runs Required
                </label>
                <select
                  value={autoQuarantineSettings.min_runs}
                  onChange={(e) => handleUpdateAutoQuarantineSettings({ min_runs: parseInt(e.target.value) })}
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                >
                  {[2, 3, 5, 10, 15, 20].map((n) => (
                    <option key={n} value={n}>{n} runs</option>
                  ))}
                </select>
              </div>

              {/* Notifications Toggle */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-700">
                <label className="flex items-center gap-2 cursor-pointer flex-1">
                  <input
                    type="checkbox"
                    checked={autoQuarantineSettings.notify_on_quarantine}
                    onChange={(e) => handleUpdateAutoQuarantineSettings({ notify_on_quarantine: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-sm font-medium text-foreground">🔔 Notify on Quarantine</span>
                </label>
              </div>
            </div>

            {/* Run Auto-Quarantine Button */}
            <div className="flex items-center gap-4">
              <button
                onClick={handleRunAutoQuarantine}
                disabled={!autoQuarantineSettings.enabled || isLoadingAutoQuarantine}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  autoQuarantineSettings.enabled && !isLoadingAutoQuarantine
                    ? 'bg-amber-600 text-white hover:bg-amber-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isLoadingAutoQuarantine ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    Running...
                  </>
                ) : (
                  <>
                    <span>🚀</span> Run Auto-Quarantine Now
                  </>
                )}
              </button>

              <p className="text-xs text-muted-foreground">
                Tests with flakiness score ≥ {(autoQuarantineSettings.threshold * 100).toFixed(0)}% and at least {autoQuarantineSettings.min_runs} runs will be automatically quarantined
              </p>
            </div>

            {/* Auto-Quarantine Result */}
            {autoQuarantineResult && autoQuarantineResult.tests_quarantined > 0 && (
              <div className="mt-4 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700">
                <h3 className="text-sm font-semibold text-green-700 dark:text-green-400 mb-2">
                  ✅ Auto-Quarantined {autoQuarantineResult.tests_quarantined} Test(s)
                </h3>
                <ul className="text-sm text-green-600 dark:text-green-400 space-y-1">
                  {autoQuarantineResult.quarantined_tests.map((t) => (
                    <li key={t.test_id} className="flex items-center gap-2">
                      <span className="font-medium">{t.test_name}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30">
                        {(t.flakiness_score * 100).toFixed(0)}% flaky
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Feature #1105: Retry Strategy Settings Panel */}
        {showRetryStrategySettings && retryStrategySettings && (
          <div className="rounded-lg border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 p-4 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-2">
                <span>🔄</span> Retry Strategy Settings
              </h2>
              <button
                onClick={() => setShowRetryStrategySettings(false)}
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                ×
              </button>
            </div>

            <p className="text-sm text-blue-600 dark:text-blue-400 mb-4">
              Configure how many retries to apply to tests based on their flakiness score. Tests with higher flakiness get more retries automatically.
            </p>

            {/* Enable/Disable Toggle */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 mb-4 w-fit">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={retryStrategySettings.enabled}
                  onChange={(e) => handleUpdateRetryStrategySettings({ enabled: e.target.checked })}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-foreground">Enable Dynamic Retry Strategy</span>
              </label>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                retryStrategySettings.enabled
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
              }`}>
                {retryStrategySettings.enabled ? 'Active' : 'Disabled'}
              </span>
            </div>

            {/* Retry Rules Configuration */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {retryStrategySettings.rules.map((rule, index) => {
                const severityLabel = rule.max_score <= 0.3 ? 'Low' : rule.max_score <= 0.6 ? 'Medium' : 'High';
                const severityColor = severityLabel === 'Low'
                  ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20'
                  : severityLabel === 'Medium'
                    ? 'border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-900/20'
                    : 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20';
                const textColor = severityLabel === 'Low'
                  ? 'text-green-700 dark:text-green-400'
                  : severityLabel === 'Medium'
                    ? 'text-yellow-700 dark:text-yellow-400'
                    : 'text-red-700 dark:text-red-400';

                return (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border ${severityColor}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-sm font-semibold ${textColor}`}>
                        {severityLabel} Flakiness
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        severityLabel === 'Low' ? 'bg-green-100 text-green-700 dark:bg-green-900/30' :
                        severityLabel === 'Medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30' :
                        'bg-red-100 text-red-700 dark:bg-red-900/30'
                      }`}>
                        {(rule.min_score * 100).toFixed(0)}% - {rule.max_score >= 1 ? '100' : (rule.max_score * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted-foreground">Retries:</label>
                      <select
                        value={rule.retries}
                        onChange={(e) => handleUpdateRuleRetries(index, parseInt(e.target.value))}
                        disabled={!retryStrategySettings.enabled}
                        className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm disabled:opacity-50"
                      >
                        {[0, 1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>{n} {n === 1 ? 'retry' : 'retries'}</option>
                        ))}
                      </select>
                    </div>
                    {retryStrategyPreview && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        {retryStrategyPreview.by_rule[index]?.test_count || 0} tests in this range
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Additional Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="p-3 rounded-lg bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700">
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  Default Retries (for tests without flakiness data)
                </label>
                <select
                  value={retryStrategySettings.default_retries}
                  onChange={(e) => handleUpdateRetryStrategySettings({ default_retries: parseInt(e.target.value) })}
                  disabled={!retryStrategySettings.enabled}
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  {[0, 1, 2, 3].map((n) => (
                    <option key={n} value={n}>{n} {n === 1 ? 'retry' : 'retries'}</option>
                  ))}
                </select>
              </div>

              <div className="p-3 rounded-lg bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700">
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  Maximum Retries Allowed
                </label>
                <select
                  value={retryStrategySettings.max_retries}
                  onChange={(e) => handleUpdateRetryStrategySettings({ max_retries: parseInt(e.target.value) })}
                  disabled={!retryStrategySettings.enabled}
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  {[1, 2, 3, 4, 5, 7, 10].map((n) => (
                    <option key={n} value={n}>{n} {n === 1 ? 'retry' : 'retries'}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Preview Summary */}
            {retryStrategyPreview && retryStrategyPreview.total_flaky_tests > 0 && (
              <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700">
                <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-400 mb-2">
                  📊 Current Retry Distribution
                </h3>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {retryStrategyPreview.by_rule.map((rule, idx) => (
                    <div key={idx} className="p-2 rounded bg-white dark:bg-gray-800">
                      <div className="text-lg font-bold text-blue-600">{rule.test_count}</div>
                      <div className="text-xs text-muted-foreground">{rule.range}</div>
                      <div className="text-xs text-blue-500">{rule.retries} {rule.retries === 1 ? 'retry' : 'retries'}</div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 text-center">
                  Total: {retryStrategyPreview.total_flaky_tests} flaky tests configured for dynamic retries
                </p>
              </div>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="rounded-lg border border-border bg-card p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-foreground">Project:</label>
              <select
                value={projectFilter}
                onChange={(e) => {
                  setProjectFilter(e.target.value);
                  setSuiteFilter('all'); // Reset suite when project changes
                }}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              >
                <option value="all">All Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-foreground">Suite:</label>
              <select
                value={suiteFilter}
                onChange={(e) => setSuiteFilter(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              >
                <option value="all">All Suites</option>
                {availableSuites.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-foreground">Severity:</label>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value as typeof severityFilter)}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              >
                <option value="all">All Severities</option>
                <option value="high">🔴 High (≥0.7)</option>
                <option value="medium">🟠 Medium (0.4-0.7)</option>
                <option value="low">🟡 Low (&lt;0.4)</option>
              </select>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <label className="text-sm font-medium text-foreground">Sort by:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              >
                <option value="score">Flakiness Score</option>
                <option value="name">Test Name</option>
                <option value="runs">Total Runs</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="px-2 py-1.5 rounded-md border border-input bg-background hover:bg-muted transition-colors"
                title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
        </div>

        {/* Tests List */}
        {isLoading ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-muted-foreground">Loading flaky tests...</p>
          </div>
        ) : filteredTests.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <div className="text-4xl mb-3">✅</div>
            <p className="text-foreground font-medium">No flaky tests found!</p>
            <p className="text-sm text-muted-foreground mt-2">
              {flakyTests.length > 0 ? 'Try adjusting your filters.' : 'Your tests are running consistently. Keep up the good work!'}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 p-4 bg-muted/50 border-b border-border text-sm font-medium text-muted-foreground">
              <div className="col-span-4">Test</div>
              <div className="col-span-2 text-center">Flakiness Score</div>
              <div className="col-span-2 text-center">Trend</div>
              <div className="col-span-1 text-center">Runs</div>
              <div className="col-span-3 text-right">Actions</div>
            </div>

            {/* Table Body */}
            {filteredTests.map((test) => {
              const score = test.flakiness_score || test.flakiness_percentage / 100;
              const severity = getSeverityBadge(score);

              return (
                <div
                  key={test.test_id}
                  className="grid grid-cols-12 gap-4 p-4 border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors items-center"
                >
                  {/* Test Info */}
                  <div className="col-span-4">
                    <button
                      onClick={() => navigate(`/tests/${test.test_id}`)}
                      className="font-medium text-foreground hover:text-primary text-left"
                    >
                      {test.test_name}
                    </button>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {test.suite_name} / {test.project_name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${severity.class}`}>
                        {severity.label}
                      </span>
                      {test.is_retry_flaky && (
                        <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                          🔄 Retry
                        </span>
                      )}
                      {test.has_time_pattern && (
                        <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                          ⏰ Time
                        </span>
                      )}
                      {test.has_environment_pattern && (
                        <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400">
                          🖥️ Env
                        </span>
                      )}
                      {/* Feature #1103: Quarantine badge */}
                      {test.quarantined && (
                        <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-300 dark:border-amber-700">
                          🏥 Quarantined
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Flakiness Score */}
                  <div className="col-span-2 text-center">
                    <div className="inline-flex flex-col items-center">
                      <span className={`text-lg font-bold ${
                        score >= 0.7 ? 'text-red-600' :
                        score >= 0.4 ? 'text-orange-600' :
                        'text-yellow-600'
                      }`}>
                        {score.toFixed(2)}
                      </span>
                      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                        <div
                          className={`h-full ${
                            score >= 0.7 ? 'bg-red-500' :
                            score >= 0.4 ? 'bg-orange-500' :
                            'bg-yellow-500'
                          }`}
                          style={{ width: `${score * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Trend Sparkline */}
                  <div className="col-span-2 flex justify-center">
                    <Sparkline runs={test.recent_runs} />
                  </div>

                  {/* Runs */}
                  <div className="col-span-1 text-center">
                    <span className="text-sm text-foreground">{test.total_runs}</span>
                    <p className="text-xs text-muted-foreground">
                      {test.pass_rate}% pass
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="col-span-3 flex justify-end gap-2">
                    {/* Feature #1103/#1107: Quarantine/Release buttons */}
                    {test.quarantined ? (
                      <button
                        onClick={() => handleReleaseFromQuarantine(test.test_id, test.test_name)}
                        className="px-2 py-1 text-xs font-medium rounded border border-green-300 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-700 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50 transition-colors"
                        title="Release from quarantine - test will run normally but be monitored"
                      >
                        🔓 Release
                      </button>
                    ) : (
                      <button
                        onClick={() => handleQuarantine(test.test_id)}
                        className="px-2 py-1 text-xs font-medium rounded border border-yellow-300 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 dark:border-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 dark:hover:bg-yellow-900/50 transition-colors"
                        title="Quarantine this test - exclude from CI failures"
                      >
                        🏥 Quarantine
                      </button>
                    )}
                    {/* Feature #1953: AI Flakiness Analysis button */}
                    <button
                      onClick={() => handleAnalyzeFlakiness(test)}
                      className="px-2 py-1 text-xs font-medium rounded border border-indigo-300 bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 hover:from-indigo-100 hover:to-purple-100 dark:border-indigo-700 dark:from-indigo-900/30 dark:to-purple-900/30 dark:text-indigo-400 dark:hover:from-indigo-900/50 dark:hover:to-purple-900/50 transition-colors"
                      title="AI analysis: why is this test flaky?"
                    >
                      🤖 Why Flaky?
                    </button>
                    <button
                      onClick={() => handleGetSuggestions(test.test_id)}
                      className="px-2 py-1 text-xs font-medium rounded border border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100 dark:border-purple-700 dark:bg-purple-900/30 dark:text-purple-400 dark:hover:bg-purple-900/50 transition-colors"
                      title="Get AI suggestions to fix this flaky test"
                    >
                      💡 Suggestions
                    </button>
                    <button
                      onClick={() => handleInvestigate(test.test_id)}
                      className="px-2 py-1 text-xs font-medium rounded border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 transition-colors"
                      title="Investigate test details"
                    >
                      🔍 Investigate
                    </button>
                    <button
                      onClick={() => handleIgnore(test.test_id)}
                      className="px-2 py-1 text-xs font-medium rounded border border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
                      title="Ignore this test from flaky reports"
                    >
                      🙈 Ignore
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Summary Stats */}
        {!isLoading && flakyTests.length > 0 && (
          <div className="grid grid-cols-5 gap-4 mt-6">
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="text-3xl font-bold text-red-600">
                {flakyTests.filter(t => (t.flakiness_score || t.flakiness_percentage / 100) >= 0.7).length}
              </div>
              <div className="text-sm text-muted-foreground">High Severity</div>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="text-3xl font-bold text-orange-600">
                {flakyTests.filter(t => {
                  const s = t.flakiness_score || t.flakiness_percentage / 100;
                  return s >= 0.4 && s < 0.7;
                }).length}
              </div>
              <div className="text-sm text-muted-foreground">Medium Severity</div>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="text-3xl font-bold text-yellow-600">
                {flakyTests.filter(t => (t.flakiness_score || t.flakiness_percentage / 100) < 0.4).length}
              </div>
              <div className="text-sm text-muted-foreground">Low Severity</div>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="text-3xl font-bold text-foreground">
                {flakyTests.filter(t => t.is_retry_flaky).length}
              </div>
              <div className="text-sm text-muted-foreground">Retry Flaky</div>
            </div>
            {/* Feature #1103: Quarantined count */}
            <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4">
              <div className="text-3xl font-bold text-amber-600">
                {flakyTests.filter(t => t.quarantined).length}
              </div>
              <div className="text-sm text-amber-700 dark:text-amber-400">Quarantined</div>
            </div>
          </div>
        )}

        {/* Feature #1102: Flaky Test Impact Report */}
        {showImpactReport && (
          <div className="mt-8 rounded-lg border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <span className="text-xl">💰</span> Flaky Test Impact Report
              </h2>
              <button
                onClick={() => setShowImpactReport(false)}
                className="text-muted-foreground hover:text-foreground"
                title="Hide section"
              >
                ×
              </button>
            </div>

            {isLoadingImpact ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                <span className="ml-2 text-muted-foreground">Loading impact data...</span>
              </div>
            ) : !impactReport ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No impact data available</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Report Period */}
                <div className="text-sm text-muted-foreground">
                  📅 Report period: {new Date(impactReport.report_period.start).toLocaleDateString()} - {new Date(impactReport.report_period.end).toLocaleDateString()} ({impactReport.report_period.days} days)
                </div>

                {/* Impact Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* CI Time Wasted */}
                  <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">⏱️</span>
                      <span className="text-sm font-medium text-amber-800 dark:text-amber-200">CI Time Wasted</span>
                    </div>
                    <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                      {impactReport.impact.ci_time_wasted.hours}h
                    </div>
                    <div className="text-sm text-amber-700 dark:text-amber-300">
                      ({impactReport.impact.ci_time_wasted.minutes} minutes)
                    </div>
                    <div className="text-sm font-medium text-amber-800 dark:text-amber-200 mt-1">
                      ${impactReport.impact.ci_time_wasted.cost_usd.toFixed(2)} cost
                    </div>
                  </div>

                  {/* Developer Time */}
                  <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">👩‍💻</span>
                      <span className="text-sm font-medium text-blue-800 dark:text-blue-200">Developer Time</span>
                    </div>
                    <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                      {impactReport.impact.developer_time_investigating.hours}h
                    </div>
                    <div className="text-sm text-blue-700 dark:text-blue-300">
                      investigating issues
                    </div>
                    <div className="text-sm font-medium text-blue-800 dark:text-blue-200 mt-1">
                      ${impactReport.impact.developer_time_investigating.cost_usd.toFixed(2)} cost
                    </div>
                  </div>

                  {/* False Alerts */}
                  <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">🚨</span>
                      <span className="text-sm font-medium text-red-800 dark:text-red-200">False Alerts</span>
                    </div>
                    <div className="text-2xl font-bold text-red-900 dark:text-red-100">
                      {impactReport.impact.false_failure_alerts.count}
                    </div>
                    <div className="text-sm text-red-700 dark:text-red-300">
                      false positives
                    </div>
                    <div className="text-sm font-medium text-red-800 dark:text-red-200 mt-1">
                      {impactReport.impact.false_failure_alerts.estimated_noise_percentage}% noise
                    </div>
                  </div>

                  {/* Total Cost */}
                  <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">💵</span>
                      <span className="text-sm font-medium text-green-800 dark:text-green-200">Total Cost Impact</span>
                    </div>
                    <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                      ${impactReport.impact.total_cost_impact.usd.toFixed(2)}
                    </div>
                    <div className="text-sm text-green-700 dark:text-green-300">
                      this month
                    </div>
                    <div className="text-sm font-medium text-green-800 dark:text-green-200 mt-1">
                      ${impactReport.impact.total_cost_impact.annual_projection_usd.toFixed(2)}/year projected
                    </div>
                  </div>
                </div>

                {/* Top Offenders */}
                {impactReport.top_offenders.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-foreground mb-3">🏆 Top Cost Contributors</h3>
                    <div className="rounded-lg border border-border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left px-4 py-2 font-medium">Test</th>
                            <th className="text-center px-4 py-2 font-medium">Flakiness</th>
                            <th className="text-center px-4 py-2 font-medium">Retries</th>
                            <th className="text-center px-4 py-2 font-medium">CI Time</th>
                            <th className="text-center px-4 py-2 font-medium">Dev Time</th>
                            <th className="text-right px-4 py-2 font-medium">Est. Cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {impactReport.top_offenders.slice(0, 5).map((test, idx) => (
                            <tr
                              key={test.test_id}
                              className="border-t border-border hover:bg-muted/30 cursor-pointer"
                              onClick={() => navigate(`/tests/${test.test_id}`)}
                            >
                              <td className="px-4 py-2">
                                <span className="text-muted-foreground mr-2">#{idx + 1}</span>
                                {test.test_name}
                              </td>
                              <td className="text-center px-4 py-2">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  test.flakiness_score >= 0.7 ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                  test.flakiness_score >= 0.4 ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                                  'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                }`}>
                                  {(test.flakiness_score * 100).toFixed(0)}%
                                </span>
                              </td>
                              <td className="text-center px-4 py-2">{test.retries}</td>
                              <td className="text-center px-4 py-2">{test.ci_time_wasted_minutes}m</td>
                              <td className="text-center px-4 py-2">{test.estimated_dev_time_minutes}m</td>
                              <td className="text-right px-4 py-2 font-medium text-red-600 dark:text-red-400">
                                ${test.estimated_cost.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {impactReport.recommendations.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-foreground mb-3">💡 Recommendations</h3>
                    <div className="space-y-2">
                      {impactReport.recommendations.map((rec, idx) => (
                        <div
                          key={idx}
                          className={`rounded-lg border p-3 ${
                            rec.priority === 'high' ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950' :
                            rec.priority === 'medium' ? 'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950' :
                            'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${
                                rec.priority === 'high' ? 'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200' :
                                rec.priority === 'medium' ? 'bg-orange-200 text-orange-800 dark:bg-orange-800 dark:text-orange-200' :
                                'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                              }`}>
                                {rec.priority}
                              </span>
                              <span className="font-medium">{rec.action}</span>
                            </div>
                            <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                              Save ~${rec.estimated_savings_usd.toFixed(2)}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{rec.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Feature #1106: AI Suggestions Modal */}
        {showSuggestionsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-4xl max-h-[90vh] overflow-auto rounded-lg border border-border bg-background shadow-xl m-4">
              <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-border bg-background">
                <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                  <span>💡</span> AI Suggestions for {suggestions?.test_name || 'Test'}
                </h2>
                <button
                  onClick={() => setShowSuggestionsModal(false)}
                  className="p-2 rounded-lg hover:bg-muted transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="p-6">
                {isLoadingSuggestions ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="animate-spin h-8 w-8 border-4 border-purple-500 border-t-transparent rounded-full mb-4" />
                    <p className="text-muted-foreground">Analyzing failure patterns...</p>
                  </div>
                ) : suggestions ? (
                  <div className="space-y-6">
                    {/* Analysis Summary */}
                    <div className="p-4 rounded-lg border border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-950/30">
                      <h3 className="text-sm font-semibold text-purple-700 dark:text-purple-400 mb-3">📊 Analysis Summary</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                        <div>
                          <div className="text-2xl font-bold text-foreground">{suggestions.analysis.total_runs}</div>
                          <div className="text-xs text-muted-foreground">Total Runs</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-red-600">{suggestions.analysis.flakiness_percentage}%</div>
                          <div className="text-xs text-muted-foreground">Flakiness Score</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-green-600">{suggestions.analysis.pass_count}</div>
                          <div className="text-xs text-muted-foreground">Passes</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-red-500">{suggestions.analysis.fail_count}</div>
                          <div className="text-xs text-muted-foreground">Failures</div>
                        </div>
                      </div>
                      {suggestions.analysis.patterns_detected.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          <span className="text-xs text-muted-foreground">Patterns detected:</span>
                          {suggestions.analysis.patterns_detected.map((p, i) => (
                            <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                              {p}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Suggestions List */}
                    <div>
                      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                        🔧 Remediation Suggestions ({suggestions.suggestions_count})
                        <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          {suggestions.high_priority_count} high priority
                        </span>
                      </h3>
                      <div className="space-y-4">
                        {suggestions.suggestions.map((s) => (
                          <div
                            key={s.id}
                            className={`rounded-lg border p-4 ${
                              s.priority === 'high' ? 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/30' :
                              s.priority === 'medium' ? 'border-orange-200 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-950/30' :
                              'border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-900/30'
                            }`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${
                                  s.priority === 'high' ? 'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200' :
                                  s.priority === 'medium' ? 'bg-orange-200 text-orange-800 dark:bg-orange-800 dark:text-orange-200' :
                                  'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                                }`}>
                                  {s.priority}
                                </span>
                                <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                  {s.category.replace(/_/g, ' ')}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {Math.round(s.confidence * 100)}% confidence
                                </span>
                              </div>
                            </div>

                            <h4 className="font-semibold text-foreground mb-1">{s.title}</h4>
                            <p className="text-sm text-muted-foreground mb-2">{s.description}</p>

                            <div className="text-xs text-purple-600 dark:text-purple-400 mb-3">
                              <strong>Pattern matched:</strong> {s.pattern_matched}
                            </div>

                            {s.code_example && (
                              <div className="mb-3 rounded-lg bg-gray-900 dark:bg-black p-4 overflow-x-auto">
                                <div className="flex gap-4 mb-3">
                                  <div className="flex-1">
                                    <div className="text-xs text-red-400 mb-2 font-semibold">❌ Before</div>
                                    <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap">{s.code_example.before}</pre>
                                  </div>
                                  <div className="w-px bg-gray-700" />
                                  <div className="flex-1">
                                    <div className="text-xs text-green-400 mb-2 font-semibold">✅ After</div>
                                    <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap">{s.code_example.after}</pre>
                                  </div>
                                </div>
                                <p className="text-xs text-gray-400 border-t border-gray-700 pt-2 mt-2">
                                  💡 {s.code_example.explanation}
                                </p>
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <div className="text-xs font-medium text-green-600 dark:text-green-400 mb-1">Impact</div>
                                <p className="text-muted-foreground">{s.impact}</p>
                              </div>
                              <div>
                                <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">Implementation Steps</div>
                                <ol className="text-muted-foreground list-decimal list-inside text-xs space-y-0.5">
                                  {s.implementation_steps.map((step, i) => (
                                    <li key={i}>{step}</li>
                                  ))}
                                </ol>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {suggestions.suggestions.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <p className="text-lg mb-2">✅ No specific suggestions at this time</p>
                        <p className="text-sm">The test failure patterns don't match known flakiness issues.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Failed to load suggestions. Please try again.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Feature #1107: Release from Quarantine Confirmation Modal */}
        {showReleaseConfirmModal && testToRelease && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-lg border border-border bg-background shadow-xl m-4">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <span>🔓</span> Release from Quarantine
                </h2>
                <button
                  onClick={() => {
                    setShowReleaseConfirmModal(false);
                    setTestToRelease(null);
                  }}
                  className="p-2 rounded-lg hover:bg-muted transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="p-4 rounded-lg bg-green-50 border border-green-200 dark:bg-green-950/30 dark:border-green-800">
                  <div className="font-semibold text-green-700 dark:text-green-400 mb-1">
                    {testToRelease.test_name}
                  </div>
                  <p className="text-sm text-green-600 dark:text-green-500">
                    This test will be released from quarantine and will:
                  </p>
                </div>

                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Return to <strong className="text-foreground">normal execution</strong> in CI/CD pipelines</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Test failures will <strong className="text-foreground">block builds</strong> again</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">🔍</span>
                    <span><strong className="text-foreground">Monitoring continues</strong> - if flakiness returns above threshold, the test may be auto-quarantined again</span>
                  </li>
                </ul>

                {autoQuarantineSettings?.enabled && (
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-800 text-sm">
                    <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                      <span>🤖</span>
                      <span className="font-medium">Auto-Quarantine Active</span>
                    </div>
                    <p className="text-blue-600 dark:text-blue-500 mt-1">
                      If this test exceeds {(autoQuarantineSettings.threshold * 100).toFixed(0)}% flakiness
                      after {autoQuarantineSettings.min_runs} runs, it will be automatically re-quarantined.
                    </p>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => {
                      setShowReleaseConfirmModal(false);
                      setTestToRelease(null);
                    }}
                    className="flex-1 px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted transition-colors"
                    disabled={isReleasingFromQuarantine}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmReleaseFromQuarantine}
                    disabled={isReleasingFromQuarantine}
                    className="flex-1 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isReleasingFromQuarantine ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                        Releasing...
                      </>
                    ) : (
                      <>
                        <span>🔓</span> Confirm Release
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Feature #1953: AI Flakiness Analysis Modal */}
        {showFlakinessAnalysisModal && selectedTestForAnalysis && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-card rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
              <div className="p-4 border-b border-border bg-gradient-to-r from-indigo-600/10 to-purple-600/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-center">
                      <span className="text-white text-lg">🤖</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">AI Flakiness Analysis</h3>
                      <p className="text-sm text-muted-foreground truncate max-w-md" title={selectedTestForAnalysis.test_name}>
                        {selectedTestForAnalysis.test_name}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowFlakinessAnalysisModal(false)}
                    className="p-2 rounded-full hover:bg-muted transition-colors"
                  >
                    <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-4 overflow-y-auto max-h-[60vh]">
                {/* Test Stats Summary */}
                <div className="grid grid-cols-4 gap-3 mb-4">
                  <div className="bg-muted/50 rounded-lg p-2 text-center">
                    <div className="text-lg font-bold text-foreground">{selectedTestForAnalysis.total_runs}</div>
                    <div className="text-xs text-muted-foreground">Total Runs</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2 text-center">
                    <div className="text-lg font-bold text-red-600">{(selectedTestForAnalysis.flakiness_score * 100).toFixed(0)}%</div>
                    <div className="text-xs text-muted-foreground">Flaky</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2 text-center">
                    <div className="text-lg font-bold text-green-600">{selectedTestForAnalysis.pass_rate}%</div>
                    <div className="text-xs text-muted-foreground">Pass Rate</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2 text-center">
                    <div className="text-lg font-bold text-foreground flex items-center justify-center gap-1">
                      {selectedTestForAnalysis.has_time_pattern && <span title="Time pattern">⏰</span>}
                      {selectedTestForAnalysis.has_environment_pattern && <span title="Env pattern">🖥️</span>}
                      {selectedTestForAnalysis.is_retry_flaky && <span title="Retry flaky">🔄</span>}
                      {!selectedTestForAnalysis.has_time_pattern && !selectedTestForAnalysis.has_environment_pattern && !selectedTestForAnalysis.is_retry_flaky && '—'}
                    </div>
                    <div className="text-xs text-muted-foreground">Patterns</div>
                  </div>
                </div>

                {/* AI Analysis Content */}
                {isLoadingFlakinessAnalysis ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent mb-3" />
                    <p className="text-sm text-muted-foreground">Analyzing flakiness patterns...</p>
                  </div>
                ) : flakinessAnalysis ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg p-4 border border-indigo-200 dark:border-indigo-800">
                      <div className="whitespace-pre-wrap text-sm text-foreground">{flakinessAnalysis}</div>
                    </div>
                  </div>
                ) : null}

                {/* Cached indicator */}
                {flakinessAnalysisCache[selectedTestForAnalysis.test_id] && !isLoadingFlakinessAnalysis && (
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span>💾</span> Cached analysis (24hr)
                    </span>
                    <button
                      onClick={() => {
                        // Clear cache and re-analyze
                        setFlakinessAnalysisCache(prev => {
                          const { [selectedTestForAnalysis.test_id]: _, ...rest } = prev;
                          return rest;
                        });
                        handleAnalyzeFlakiness(selectedTestForAnalysis);
                      }}
                      className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                    >
                      🔄 Refresh
                    </button>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-border bg-muted/30 flex justify-between">
                <button
                  onClick={() => handleGetSuggestions(selectedTestForAnalysis.test_id)}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100 dark:border-purple-700 dark:bg-purple-900/30 dark:text-purple-400 transition-colors"
                >
                  💡 Get Fix Suggestions
                </button>
                <button
                  onClick={() => setShowFlakinessAnalysisModal(false)}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
