/**
 * Feature #48: useTestPageUtilities - Custom hook for utility functions
 * Extracts handleDownloadAllArtifacts, handleCompareRuns, fetchFlakinessTrend, handleCreateQuickSchedule
 */

import { useCallback } from 'react';
import { toast } from '../../stores/toastStore';
import type { K6CompareResults } from './K6CompareModal';
import type { FlakinessTrend, TestType, TestSuite } from './types';

// Re-export for convenience (original type is from ./types)
export type { FlakinessTrend };

export interface UseTestPageUtilitiesProps {
  testId: string | undefined;
  token: string | null;
  test: TestType | null;
  suite: TestSuite | null;
  selectedRunsForCompare: string[];
  // State setters
  setIsDownloadingArtifacts: (value: boolean) => void;
  setIsComparing: (value: boolean) => void;
  setCompareResults: (value: K6CompareResults | null) => void;
  setShowCompareModal: (value: boolean) => void;
  setIsLoadingFlakinessTrend: (value: boolean) => void;
  setFlakinessTrend: (value: FlakinessTrend | null) => void;
  setIsCreatingSchedule: (value: boolean) => void;
  setQuickScheduleError: (value: string) => void;
  setShowQuickScheduleModal: (value: boolean) => void;
  addNotification: (notification: { type: string; title: string; message: string }) => void;
}

export interface TestPageUtilities {
  handleDownloadAllArtifacts: (runId: string) => Promise<void>;
  handleCompareRuns: () => Promise<void>;
  fetchFlakinessTrend: () => Promise<void>;
  handleCreateQuickSchedule: (data: {
    name: string;
    type: 'recurring' | 'one-time';
    cron: string;
    runAt: string;
    timezone: string;
  }) => Promise<void>;
}

export function useTestPageUtilities({
  testId,
  token,
  test,
  suite,
  selectedRunsForCompare,
  setIsDownloadingArtifacts,
  setIsComparing,
  setCompareResults,
  setShowCompareModal,
  setIsLoadingFlakinessTrend,
  setFlakinessTrend,
  setIsCreatingSchedule,
  setQuickScheduleError,
  setShowQuickScheduleModal,
  addNotification,
}: UseTestPageUtilitiesProps): TestPageUtilities {

  // Download all artifacts for a test run (with authentication)
  const handleDownloadAllArtifacts = useCallback(async (runId: string) => {
    setIsDownloadingArtifacts(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || ''}/api/v1/runs/${runId}/artifacts/download`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Download failed' }));
        throw new Error(errorData.message || 'Failed to download artifacts');
      }

      // Get the filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="?([^"]+)"?/);
      const filename = filenameMatch ? filenameMatch[1] : `run-${runId}-artifacts.zip`;

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Artifacts downloaded successfully!');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to download artifacts';
      toast.error(message);
    } finally {
      setIsDownloadingArtifacts(false);
    }
  }, [token, setIsDownloadingArtifacts]);

  // Compare two K6 runs (Feature #564)
  const handleCompareRuns = useCallback(async () => {
    if (selectedRunsForCompare.length !== 2) return;

    setIsComparing(true);
    setCompareResults(null);

    try {
      const [baseRunId, compareRunId] = selectedRunsForCompare;
      const response = await fetch(
        `/api/v1/runs/compare?baseRunId=${baseRunId}&compareRunId=${compareRunId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to compare runs');
      }

      const data = await response.json();
      // API returns { comparison: { ... } }, so we extract the comparison object
      setCompareResults(data.comparison || data);
      setShowCompareModal(true);
    } catch (error) {
      console.error('Error comparing runs:', error);
      toast.error('Failed to compare runs. Make sure both runs have K6 load test results.');
    } finally {
      setIsComparing(false);
    }
  }, [selectedRunsForCompare, token, setIsComparing, setCompareResults, setShowCompareModal]);

  // Feature #1101: Fetch flakiness trend data
  const fetchFlakinessTrend = useCallback(async () => {
    if (!testId || !token) return;
    setIsLoadingFlakinessTrend(true);
    try {
      const response = await fetch(`/api/v1/tests/${testId}/flakiness-trend`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setFlakinessTrend(data);
      }
    } catch (error) {
      console.error('Failed to fetch flakiness trend:', error);
    } finally {
      setIsLoadingFlakinessTrend(false);
    }
  }, [testId, token, setIsLoadingFlakinessTrend, setFlakinessTrend]);

  // Handle creating a quick schedule for this test
  const handleCreateQuickSchedule = useCallback(async (data: {
    name: string;
    type: 'recurring' | 'one-time';
    cron: string;
    runAt: string;
    timezone: string;
  }) => {
    if (!test || !suite) return;

    setIsCreatingSchedule(true);
    setQuickScheduleError('');

    try {
      const scheduleData: Record<string, unknown> = {
        name: data.name || `${test.name} Schedule`,
        description: `Automated schedule for test: ${test.name}`,
        suite_id: suite.id,
        browsers: [suite.default_browser || 'chromium'],
        enabled: true,
        timezone: data.timezone,
        notify_on_failure: true,
      };

      if (data.type === 'one-time') {
        scheduleData.run_at = data.runAt;
      } else {
        scheduleData.cron_expression = data.cron;
      }

      const response = await fetch('/api/v1/schedules', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(scheduleData),
      });

      if (!response.ok) {
        const responseData = await response.json();
        throw new Error(responseData.message || 'Failed to create schedule');
      }

      // Success - close modal and show notification
      setShowQuickScheduleModal(false);
      addNotification({
        type: 'success',
        title: 'Schedule Created',
        message: `Schedule "${data.name || test.name + ' Schedule'}" created successfully`,
      });
    } catch (err) {
      setQuickScheduleError(err instanceof Error ? err.message : 'Failed to create schedule');
    } finally {
      setIsCreatingSchedule(false);
    }
  }, [test, suite, token, setIsCreatingSchedule, setQuickScheduleError, setShowQuickScheduleModal, addNotification]);

  return {
    handleDownloadAllArtifacts,
    handleCompareRuns,
    fetchFlakinessTrend,
    handleCreateQuickSchedule,
  };
}
