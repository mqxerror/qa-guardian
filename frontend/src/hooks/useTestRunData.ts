/**
 * useTestRunData - Custom hook for test run data fetching
 * Feature #46: Extract data fetching logic from TestRunResultPage for better modularity
 */

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import {
  TestRun,
  TestInfo,
  SuiteInfo,
  TestResult,
  RunHistoryEntry,
  ResultSummary,
} from '../components/test-run-results';

export interface UseTestRunDataReturn {
  // Core state
  run: TestRun | null;
  testInfo: TestInfo | null;
  suiteInfo: SuiteInfo | null;
  loading: boolean;
  error: string | null;

  // Retry mechanism (Feature #1929)
  retryTrigger: number;
  setRetryTrigger: React.Dispatch<React.SetStateAction<number>>;

  // Run history (Feature #1842)
  previousRuns: RunHistoryEntry[];
  runHistory: RunHistoryEntry[];

  // Comparison run state
  selectedCompareRunId: string | null;
  setSelectedCompareRunId: React.Dispatch<React.SetStateAction<string | null>>;
  compareRun: TestRun | null;
  loadingCompareRun: boolean;

  // Derived data
  resultSummary: ResultSummary;
  runId: string | undefined;
}

/**
 * Hook to manage test run data fetching and core state
 * Extracts data fetching logic from TestRunResultPage for cleaner separation of concerns
 */
export function useTestRunData(): UseTestRunDataReturn {
  const { runId } = useParams<{ runId: string }>();
  const { token } = useAuthStore();

  // Core state
  const [run, setRun] = useState<TestRun | null>(null);
  const [testInfo, setTestInfo] = useState<TestInfo | null>(null);
  const [suiteInfo, setSuiteInfo] = useState<SuiteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Feature #1929: Retry trigger for error recovery
  const [retryTrigger, setRetryTrigger] = useState(0);

  // Feature #1842: Run comparison state
  const [previousRuns, setPreviousRuns] = useState<RunHistoryEntry[]>([]);
  const [selectedCompareRunId, setSelectedCompareRunId] = useState<string | null>(null);
  const [compareRun, setCompareRun] = useState<TestRun | null>(null);
  const [loadingCompareRun, setLoadingCompareRun] = useState(false);
  const [runHistory, setRunHistory] = useState<RunHistoryEntry[]>([]);

  // Get result summary - computed from run data
  const resultSummary = useMemo<ResultSummary>(() => {
    if (!run?.results) return { passed: 0, failed: 0, skipped: 0, total: 0 };
    return {
      passed: run.results.filter(r => r.status === 'passed').length,
      failed: run.results.filter(r => r.status === 'failed' || r.status === 'error').length,
      skipped: run.results.filter(r => r.status === 'skipped').length,
      total: run.results.length,
    };
  }, [run]);

  // Fetch run data
  useEffect(() => {
    const fetchRunData = async () => {
      if (!runId || !token) return;

      // Only show loading spinner on initial load, not background refreshes
      if (!run) {
        setLoading(true);
      }
      setError(null);

      try {
        // Fetch run details
        const runResponse = await fetch(`/api/v1/runs/${runId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!runResponse.ok) {
          // Feature #1929: Provide specific error messages based on HTTP status
          if (runResponse.status === 404) {
            throw new Error('Run not found. It may have been deleted or the ID is invalid.');
          } else if (runResponse.status === 401 || runResponse.status === 403) {
            throw new Error('You do not have permission to view this run.');
          } else if (runResponse.status >= 500) {
            throw new Error('Server error. Please try again later.');
          } else {
            throw new Error(`Failed to fetch run details (${runResponse.status})`);
          }
        }

        const runData = await runResponse.json();
        setRun(runData.run);

        // If we have a test_id, fetch test info
        if (runData.run.test_id) {
          try {
            const testResponse = await fetch(`/api/v1/tests/${runData.run.test_id}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (testResponse.ok) {
              const testData = await testResponse.json();
              // Feature #1970: Extract test from response object (API returns { test: {...} } or direct object)
              setTestInfo(testData.test || testData);
            }
          } catch {
            // Test info is optional
          }
        }

        // If we have a suite_id, fetch suite info
        if (runData.run.suite_id) {
          try {
            const suiteResponse = await fetch(`/api/v1/suites/${runData.run.suite_id}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (suiteResponse.ok) {
              const suiteData = await suiteResponse.json();
              // Feature #1970: Extract suite from response object (API returns { suite: {...} })
              setSuiteInfo(suiteData.suite || suiteData);
            }
          } catch {
            // Suite info is optional
          }
        }

      } catch (err) {
        // Feature #1929: Provide specific error messages for network errors
        if (err instanceof TypeError && err.message.includes('fetch')) {
          setError('Network error. Please check your internet connection and try again.');
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load run data');
        }
        console.error('Error loading run data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRunData();
  }, [runId, token, retryTrigger]); // Feature #1929: Added retryTrigger to dependency array

  // Feature #1842: Fetch previous runs for comparison
  useEffect(() => {
    const fetchPreviousRuns = async () => {
      if (!run?.suite_id || !token) return;

      try {
        const response = await fetch(`/api/v1/suites/${run.suite_id}/runs?limit=10`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          const runs = (data.runs || [])
            .filter((r: { id: string }) => r.id !== runId)
            .map((r: { id: string; status: string; created_at: string; duration_ms?: number; results?: TestResult[] }) => ({
              id: r.id,
              status: r.status,
              created_at: r.created_at,
              duration_ms: r.duration_ms,
              passed: r.results?.filter((res: TestResult) => res.status === 'passed').length || 0,
              failed: r.results?.filter((res: TestResult) => res.status === 'failed' || res.status === 'error').length || 0,
              total: r.results?.length || 0,
            }));
          setPreviousRuns(runs);
          setRunHistory([
            {
              id: run.id,
              status: run.status,
              created_at: run.created_at,
              duration_ms: run.duration_ms,
              passed: resultSummary.passed,
              failed: resultSummary.failed,
              total: resultSummary.total,
            },
            ...runs,
          ]);
        }
      } catch {
        // Silent fail - comparison is optional
      }
    };

    fetchPreviousRuns();
  }, [run, runId, token, resultSummary]);

  // Feature #1842: Fetch comparison run data
  useEffect(() => {
    const fetchCompareRun = async () => {
      if (!selectedCompareRunId || !token) {
        setCompareRun(null);
        return;
      }

      setLoadingCompareRun(true);
      try {
        const response = await fetch(`/api/v1/runs/${selectedCompareRunId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          setCompareRun(data.run);
        }
      } catch {
        setCompareRun(null);
      } finally {
        setLoadingCompareRun(false);
      }
    };

    fetchCompareRun();
  }, [selectedCompareRunId, token]);

  return {
    // Core state
    run,
    testInfo,
    suiteInfo,
    loading,
    error,

    // Retry mechanism
    retryTrigger,
    setRetryTrigger,

    // Run history
    previousRuns,
    runHistory,

    // Comparison run state
    selectedCompareRunId,
    setSelectedCompareRunId,
    compareRun,
    loadingCompareRun,

    // Derived data
    resultSummary,
    runId,
  };
}

export default useTestRunData;
