/**
 * React Query hooks for Flaky Tests Dashboard API
 * Feature #76: Migrate FlakyTestsDashboardPage to React Query with caching
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
import { fetchWithAuth } from './fetchWithAuth'; // Feature #655: Shared auth fetch

// Types matching FlakyTestsDashboardPage interfaces
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
  quarantined?: boolean;
  released_from_quarantine_at?: string;
}

export interface FlakyImpactReport {
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
}

export interface AutoQuarantineSettings {
  enabled: boolean;
  threshold: number;
  min_runs: number;
  notify_on_quarantine: boolean;
  quarantine_reason_prefix: string;
}

export interface RetryStrategySettings {
  enabled: boolean;
  rules: Array<{ min_score: number; max_score: number; retries: number }>;
  default_retries: number;
  max_retries: number;
}

export interface RetryStrategyPreview {
  total_flaky_tests: number;
  by_rule: Array<{
    range: string;
    retries: number;
    test_count: number;
    tests: Array<{ test_id: string; test_name: string; flakiness_percentage: number }>;
  }>;
}

export interface RemediationSuggestion {
  test_id: string;
  test_name: string;
  flakiness_score: number;
  patterns: Array<{
    type: string;
    description: string;
    severity: string;
    evidence: string[];
  }>;
  suggestions: Array<{
    priority: number;
    category: string;
    title: string;
    description: string;
    code_example?: string;
    estimated_effort: string;
    expected_improvement: string;
  }>;
}

// Query keys factory for cache management
export const flakyTestKeys = {
  all: ['flakyTests'] as const,
  list: () => [...flakyTestKeys.all, 'list'] as const,
  impactReport: () => [...flakyTestKeys.all, 'impactReport'] as const,
  autoQuarantineSettings: () => [...flakyTestKeys.all, 'autoQuarantineSettings'] as const,
  retryStrategySettings: () => [...flakyTestKeys.all, 'retryStrategySettings'] as const,
  retryStrategyPreview: () => [...flakyTestKeys.all, 'retryStrategyPreview'] as const,
  suggestions: (testId: string) => [...flakyTestKeys.all, 'suggestions', testId] as const,
  analysis: (testId: string) => [...flakyTestKeys.all, 'analysis', testId] as const,
};

/**
 * Hook to fetch flaky tests list
 */
export function useFlakyTests() {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: flakyTestKeys.list(),
    queryFn: async () => {
      const data = await fetchWithAuth('/api/v1/analytics/flaky-tests', token) as { flaky_tests: FlakyTest[] };

      // Extract unique projects and suites
      const projectMap = new Map<string, string>();
      const suiteMap = new Map<string, { name: string; project_id: string }>();

      (data.flaky_tests || []).forEach((t: FlakyTest) => {
        projectMap.set(t.project_id, t.project_name);
        suiteMap.set(t.suite_id, { name: t.suite_name, project_id: t.project_id });
      });

      return {
        flakyTests: data.flaky_tests || [],
        projects: Array.from(projectMap.entries()).map(([id, name]) => ({ id, name })),
        suites: Array.from(suiteMap.entries()).map(([id, { name, project_id }]) => ({ id, name, project_id })),
      };
    },
    enabled: !!token,
    staleTime: 60 * 1000, // 1 minute - flaky test data doesn't change often
    gcTime: 2 * 60 * 1000, // Feature #106: 2x staleTime for garbage collection
  });
}

/**
 * Hook to fetch flaky test impact report
 */
export function useFlakyImpactReport() {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: flakyTestKeys.impactReport(),
    queryFn: () => fetchWithAuth('/api/v1/ai-insights/flaky-impact-report', token) as Promise<FlakyImpactReport>,
    enabled: !!token,
    staleTime: 5 * 60 * 1000, // 5 minutes - impact report is computed data
    gcTime: 2 * 5 * 60 * 1000, // Feature #106: 2x staleTime for garbage collection
  });
}

/**
 * Hook to fetch auto-quarantine settings
 */
export function useAutoQuarantineSettings() {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: flakyTestKeys.autoQuarantineSettings(),
    queryFn: async () => {
      const data = await fetchWithAuth('/api/v1/organization/auto-quarantine-settings', token) as { settings: AutoQuarantineSettings };
      return data.settings;
    },
    enabled: !!token,
    staleTime: 2 * 60 * 1000, // 2 minutes - settings change rarely
    gcTime: 2 * 2 * 60 * 1000, // Feature #106: 2x staleTime for garbage collection
  });
}

/**
 * Hook to fetch retry strategy settings
 */
export function useRetryStrategySettings() {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: flakyTestKeys.retryStrategySettings(),
    queryFn: async () => {
      const data = await fetchWithAuth('/api/v1/organization/retry-strategy-settings', token) as { settings: RetryStrategySettings };
      return data.settings;
    },
    enabled: !!token,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 2 * 2 * 60 * 1000, // Feature #106: 2x staleTime for garbage collection
  });
}

/**
 * Hook to fetch retry strategy preview
 */
export function useRetryStrategyPreview() {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: flakyTestKeys.retryStrategyPreview(),
    queryFn: () => fetchWithAuth('/api/v1/organization/retry-strategy-preview', token) as Promise<RetryStrategyPreview>,
    enabled: !!token,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 2 * 60 * 1000, // Feature #106: 2x staleTime for garbage collection
  });
}

/**
 * Hook to fetch remediation suggestions for a test
 */
export function useRemediationSuggestions(testId: string | null) {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: flakyTestKeys.suggestions(testId || ''),
    queryFn: () => fetchWithAuth(`/api/v1/ai-insights/flaky-suggestions/${testId}`, token) as Promise<RemediationSuggestion>,
    enabled: !!token && !!testId,
    staleTime: 10 * 60 * 1000, // 10 minutes - suggestions are AI-generated
    gcTime: 2 * 10 * 60 * 1000, // Feature #106: 2x staleTime for garbage collection
  });
}

/**
 * Hook to fetch AI suggestions with code examples (Feature #711)
 * Used by FlakyTestsDashboardPage for expanded suggestions modal
 */
export function useFlakySuggestions(testId: string | null, enabled: boolean = false) {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: [...flakyTestKeys.suggestions(testId || ''), 'expanded'],
    queryFn: () => fetchWithAuth(`/api/v1/ai-insights/flaky-tests/${testId}/suggestions?include_code_examples=true`, token),
    enabled: !!token && !!testId && enabled,
    staleTime: 10 * 60 * 1000, // 10 minutes - AI-generated content
    gcTime: 20 * 60 * 1000,
  });
}

/**
 * Hook for AI chat analysis of flaky tests (Feature #711)
 * Used by FlakyTestsDashboardPage for Claude AI analysis
 */
export function useFlakyTestAIAnalysis() {
  const token = useAuthStore(state => state.token);

  return useMutation({
    mutationFn: async (payload: { message: string }) => {
      const response = await fetchWithAuth(
        `${import.meta.env.VITE_API_BASE_URL || ''}/api/v1/mcp-tools/chat`,
        token,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );
      return response;
    },
  });
}

/**
 * Hook to run auto-quarantine
 */
export function useRunAutoQuarantine() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      fetchWithAuth('/api/v1/organization/run-auto-quarantine', token, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: flakyTestKeys.list() });
    },
  });
}

/**
 * Hook to update auto-quarantine settings
 */
export function useUpdateAutoQuarantineSettings() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings: Partial<AutoQuarantineSettings>) =>
      fetchWithAuth('/api/v1/organization/auto-quarantine-settings', token, {
        method: 'PUT',
        body: JSON.stringify(settings),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: flakyTestKeys.autoQuarantineSettings() });
    },
  });
}

/**
 * Hook to update retry strategy settings
 */
export function useUpdateRetryStrategySettings() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings: Partial<RetryStrategySettings>) =>
      fetchWithAuth('/api/v1/organization/retry-strategy-settings', token, {
        method: 'PUT',
        body: JSON.stringify(settings),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: flakyTestKeys.retryStrategySettings() });
      queryClient.invalidateQueries({ queryKey: flakyTestKeys.retryStrategyPreview() });
    },
  });
}

/**
 * Hook to quarantine a test
 */
export function useQuarantineTest() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ testId, reason }: { testId: string; reason?: string }) =>
      fetchWithAuth(`/api/v1/tests/${testId}/quarantine`, token, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: flakyTestKeys.list() });
    },
  });
}

/**
 * Hook to release a test from quarantine
 */
export function useReleaseFromQuarantine() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (testId: string) =>
      fetchWithAuth(`/api/v1/tests/${testId}/release-quarantine`, token, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: flakyTestKeys.list() });
    },
  });
}

/**
 * Hook to invalidate flaky test queries
 */
export function useInvalidateFlakyTests() {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: flakyTestKeys.all }),
    invalidateList: () => queryClient.invalidateQueries({ queryKey: flakyTestKeys.list() }),
    invalidateImpactReport: () => queryClient.invalidateQueries({ queryKey: flakyTestKeys.impactReport() }),
    refetchAll: () => {
      queryClient.refetchQueries({ queryKey: flakyTestKeys.list() });
      queryClient.refetchQueries({ queryKey: flakyTestKeys.impactReport() });
    },
  };
}
