/**
 * useTestRunData - Custom hook for test run data fetching
 * Feature #46: Extract data fetching logic from TestRunResultPage for better modularity
 * Feature #69: Added React Query caching for faster loading on second visit
 */

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
// Feature #69: Import React Query hooks for caching
import { useRun, useRunsBySuite } from './api/useRuns';
import { useTest } from './api/useTests';
import { useSuite } from './api/useSuites';
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
 * Feature #69: Uses React Query for caching - data loads instantly on second visit
 */
export function useTestRunData(): UseTestRunDataReturn {
  const { runId } = useParams<{ runId: string }>();
  const { token } = useAuthStore();

  // Feature #69: React Query hooks for caching
  const { data: runData, isLoading: runLoading, error: runError, refetch: refetchRun } = useRun(runId);

  // Derived IDs from run data for dependent queries
  const testId = runData?.run?.test_id;
  const suiteId = runData?.run?.suite_id;

  // Feature #69: Dependent queries - auto-fetch when IDs are available
  const { data: testData } = useTest(testId);
  const { data: suiteData } = useSuite(suiteId);
  const { data: suiteRunsData } = useRunsBySuite(suiteId);

  // Core state derived from React Query
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

  // Feature #69: Sync React Query data to local state
  useEffect(() => {
    if (runData?.run) {
      setRun(runData.run);
      setLoading(false);
    }
    if (runError) {
      setError(runError instanceof Error ? runError.message : 'Failed to load run data');
      setLoading(false);
    }
  }, [runData, runError]);

  useEffect(() => {
    if (testData?.test) {
      setTestInfo(testData.test);
    }
  }, [testData]);

  useEffect(() => {
    if (suiteData?.suite) {
      setSuiteInfo(suiteData.suite);
    }
  }, [suiteData]);

  // Feature #69: Handle retry trigger by refetching
  useEffect(() => {
    if (retryTrigger > 0) {
      refetchRun();
    }
  }, [retryTrigger, refetchRun]);

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

  // Feature #69: Derive previous runs from cached suite runs data
  useEffect(() => {
    if (!suiteRunsData?.runs || !run) return;

    const runs = (suiteRunsData.runs || [])
      .filter((r: { id: string }) => r.id !== runId)
      .slice(0, 10) // Limit to 10 runs
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
  }, [suiteRunsData, run, runId, resultSummary]);

  // Feature #69: Use React Query for comparison run (also cached)
  const { data: compareRunData, isLoading: compareRunLoading } = useRun(selectedCompareRunId || undefined);

  // Sync comparison run data to local state
  useEffect(() => {
    if (compareRunData?.run) {
      setCompareRun(compareRunData.run);
    } else if (!selectedCompareRunId) {
      setCompareRun(null);
    }
    setLoadingCompareRun(compareRunLoading);
  }, [compareRunData, selectedCompareRunId, compareRunLoading]);

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
