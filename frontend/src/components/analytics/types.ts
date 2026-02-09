// Analytics component types
// Feature #515: Extracted from AnalyticsPage.tsx

// Interface for failing tests
export interface FailingTest {
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
export interface BrowserStats {
  browser: string;
  total_runs: number;
  passed: number;
  failed: number;
  error: number;
  pass_rate: number;
}

// Interface for project comparison statistics
export interface ProjectComparisonStats {
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

export interface TrendDataPoint {
  date: string;
  passed: number;
  failed: number;
  total: number;
  total_runs: number;
  pass_rate: number | null;
}

export interface TrendSummary {
  period_days: number;
  total_runs: number;
  total_passed: number;
  total_failed: number;
  overall_pass_rate: number | null;
  start_date: string;
  end_date: string;
}

// Interface for accessibility trend data points
export interface AccessibilityTrendDataPoint {
  date: string;
  total_violations: number;
  critical: number;
  serious: number;
  moderate: number;
  minor: number;
  runs_with_violations: number;
  total_runs: number;
}

export interface AccessibilityTrendSummary {
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
export interface FlakyTest {
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
export interface FailureCluster {
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

// Duration trend types
export interface DurationTrendDataPoint {
  date: string;
  run_count: number;
  p50_ms: number | null;
  p95_ms: number | null;
  p99_ms: number | null;
  avg_ms: number | null;
  min_ms: number | null;
  max_ms: number | null;
}

export interface DurationTrendSummary {
  period_days: number;
  total_runs: number;
  overall_p50_ms: number | null;
  overall_p95_ms: number | null;
  overall_p99_ms: number | null;
  overall_avg_ms: number | null;
  start_date: string;
  end_date: string;
}

export interface DurationRegression {
  detected: boolean;
  change_percent: number | null;
  message: string;
}

export interface DurationFilters {
  available_browsers: string[];
  available_test_types: string[];
}

// Branch comparison types
export interface BranchComparisonData {
  available_branches: string[];
  comparison?: {
    branchA: {
      pass_rate: number;
      avg_duration_ms: number | null;
      failed_runs: number;
      flaky_count: number;
      total_runs: number;
    };
    branchB: {
      pass_rate: number;
      avg_duration_ms: number | null;
      failed_runs: number;
      flaky_count: number;
      total_runs: number;
    };
    deltas: {
      pass_rate: { formatted: string; trend: 'improved' | 'regressed' | 'same' };
      avg_duration_ms: { formatted: string; trend: 'improved' | 'regressed' | 'same' | 'unknown' };
      failed_runs: { formatted: string; trend: 'improved' | 'regressed' | 'same' };
      flaky_count: { formatted: string; trend: 'improved' | 'regressed' | 'same' };
    };
  };
}

// AI Usage types
export interface AIUsageAggregation {
  total_requests: number;
  successful_requests: number;
  total_cost_usd: number;
  total_input_tokens: number;
  total_output_tokens: number;
  by_model?: Record<string, { requests: number; cost_usd: number; tokens: number }>;
  by_feature?: Record<string, { requests: number; cost_usd: number; tokens: number }>;
}

export interface AIUsageData {
  aggregations: AIUsageAggregation[];
}
