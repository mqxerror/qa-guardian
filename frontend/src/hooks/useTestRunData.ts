/**
 * useTestRunData - Custom hook for test run data fetching
 * Feature #46: Extract data fetching logic from TestRunResultPage for better modularity
 * Feature #69: Added React Query caching for faster loading on second visit
 */

import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
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
  retry: () => void;

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
 * Feature #676: Removed useState sync layer - use React Query data directly
 */
export function useTestRunData(): UseTestRunDataReturn {
  const { runId } = useParams<{ runId: string }>();

  // Feature #69: React Query hooks for caching
  // Feature #676: Use data directly instead of syncing to useState
  const { data: runData, isLoading: runLoading, error: runError, refetch: refetchRun } = useRun(runId);

  // Derived IDs from run data for dependent queries
  const testId = runData?.run?.test_id;
  const suiteId = runData?.run?.suite_id;

  // Feature #69: Dependent queries - auto-fetch when IDs are available
  const { data: testData } = useTest(testId);
  const { data: suiteData } = useSuite(suiteId);
  const { data: suiteRunsData } = useRunsBySuite(suiteId);

  // Feature #676: Use React Query data directly
  const run = runData?.run ?? null;
  const testInfo = testData?.test ?? null;
  const suiteInfo = suiteData?.suite ?? null;
  const loading = runLoading;
  const error = runError ? (runError instanceof Error ? runError.message : 'Failed to load run data') : null;

  // Feature #1842: Run comparison state (these need useState since they're user-controlled)
  const [selectedCompareRunId, setSelectedCompareRunId] = useState<string | null>(null);

  // Feature #69: Use React Query for comparison run (also cached)
  // Feature #676: Use data directly
  const { data: compareRunData, isLoading: loadingCompareRun } = useRun(selectedCompareRunId || undefined);
  const compareRun = compareRunData?.run ?? null;

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

  // Feature #676: Derive previous runs using useMemo instead of useEffect + useState
  const { previousRuns, runHistory } = useMemo(() => {
    if (!suiteRunsData?.runs || !run) {
      return { previousRuns: [], runHistory: [] };
    }

    const runs: RunHistoryEntry[] = (suiteRunsData.runs || [])
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

    const history: RunHistoryEntry[] = [
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
    ];

    return { previousRuns: runs, runHistory: history };
  }, [suiteRunsData, run, runId, resultSummary]);

  // Feature #676: Expose refetch directly for retry functionality
  const retry = () => {
    refetchRun();
  };

  return {
    // Core state
    run,
    testInfo,
    suiteInfo,
    loading,
    error,

    // Retry mechanism - Feature #676: simplified to just a retry function
    retry,

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
