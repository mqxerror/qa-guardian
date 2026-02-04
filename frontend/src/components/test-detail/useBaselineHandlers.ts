/**
 * Feature #48: useBaselineHandlers - Custom hook for baseline-related API handlers
 * Extracts baseline approval, restoration, rejection, and merge handlers from TestDetailPage.tsx
 */

import { useCallback } from 'react';

export interface BaselineData {
  hasBaseline: boolean;
  image?: string;
  createdAt?: string;
  size?: number;
  approvedBy?: string;
  approvedByUserId?: string;
  approvedAt?: string;
  sourceRunId?: string;
}

export interface BaselineHistoryEntry {
  id: string;
  testId: string;
  viewportId: string;
  version: number;
  approvedBy: string;
  approvedByUserId: string;
  approvedAt: string;
  sourceRunId?: string;
  filename: string;
}

export interface UseBaselineHandlersProps {
  testId: string | undefined;
  token: string | null;
  selectedBranch: string;
  activeTab: string;
  // State setters
  setApprovingBaseline: (value: boolean) => void;
  setApproveBaselineError: (value: string) => void;
  setShowApproveBaselineModal: (value: boolean) => void;
  setApproveBaselineRunId: (value: string | null) => void;
  setRestoringBaseline: (value: boolean) => void;
  setRestoreBaselineError: (value: string) => void;
  setShowRestoreBaselineModal: (value: boolean) => void;
  setRestoreHistoryEntry: (value: { id: string; version: number } | null) => void;
  setRejectingChanges: (value: boolean) => void;
  setRejectChangesError: (value: string) => void;
  setShowRejectChangesModal: (value: boolean) => void;
  setRejectChangesRunId: (value: string | null) => void;
  setIsMergingBaseline: (value: boolean) => void;
  setMergeBaselineError: (value: string) => void;
  setShowMergeBaselineModal: (value: boolean) => void;
  setSelectedMergeBranch: (value: string | null) => void;
  setBaselineData: (value: BaselineData | null) => void;
  setLoadingBaseline: (value: boolean) => void;
  setBaselineHistory: (value: BaselineHistoryEntry[]) => void;
  setLoadingBaselineHistory: (value: boolean) => void;
  addNotification: (notification: { type: string; title: string; message: string }) => void;
}

export function useBaselineHandlers({
  testId,
  token,
  selectedBranch,
  activeTab,
  setApprovingBaseline,
  setApproveBaselineError,
  setShowApproveBaselineModal,
  setApproveBaselineRunId,
  setRestoringBaseline,
  setRestoreBaselineError,
  setShowRestoreBaselineModal,
  setRestoreHistoryEntry,
  setRejectingChanges,
  setRejectChangesError,
  setShowRejectChangesModal,
  setRejectChangesRunId,
  setIsMergingBaseline,
  setMergeBaselineError,
  setShowMergeBaselineModal,
  setSelectedMergeBranch,
  setBaselineData,
  setLoadingBaseline,
  setBaselineHistory,
  setLoadingBaselineHistory,
  addNotification,
}: UseBaselineHandlersProps) {

  // Helper to refresh baseline data
  const refreshBaselineData = useCallback(async () => {
    if (!testId || !token) return;

    setLoadingBaseline(true);
    try {
      const baselineResponse = await fetch(`/api/v1/tests/${testId}/baseline`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });
      if (baselineResponse.ok) {
        const baselineJson = await baselineResponse.json();
        setBaselineData(baselineJson);
      }
    } catch (err) {
      console.error('Failed to fetch baseline:', err);
    } finally {
      setLoadingBaseline(false);
    }
  }, [testId, token, setBaselineData, setLoadingBaseline]);

  // Helper to refresh baseline history
  const refreshBaselineHistory = useCallback(async () => {
    if (!testId || !token) return;

    setLoadingBaselineHistory(true);
    try {
      const historyResponse = await fetch(`/api/v1/tests/${testId}/baseline/history`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (historyResponse.ok) {
        const historyJson = await historyResponse.json();
        setBaselineHistory(historyJson.history || []);
      }
    } catch (err) {
      console.error('Failed to fetch baseline history:', err);
    } finally {
      setLoadingBaselineHistory(false);
    }
  }, [testId, token, setBaselineHistory, setLoadingBaselineHistory]);

  // Approve baseline handler
  const handleApproveBaseline = useCallback(async (runId?: string) => {
    if (!testId || !token) return;

    setApprovingBaseline(true);
    setApproveBaselineError('');

    try {
      const response = await fetch(`/api/v1/tests/${testId}/baseline/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ runId, branch: selectedBranch }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to approve baseline');
      }

      // Close the modal
      setShowApproveBaselineModal(false);
      setApproveBaselineRunId(null);

      // Show success notification
      addNotification({
        type: 'success',
        title: 'Baseline Approved',
        message: 'New baseline approved successfully! Future test runs will compare against this baseline.',
      });

      // Refresh baseline data if on baseline tab
      setBaselineData(null);
      if (activeTab === 'baseline') {
        await refreshBaselineData();
        await refreshBaselineHistory();
      }
    } catch (error) {
      setApproveBaselineError(error instanceof Error ? error.message : 'Failed to approve baseline');
    } finally {
      setApprovingBaseline(false);
    }
  }, [testId, token, selectedBranch, activeTab, setApprovingBaseline, setApproveBaselineError,
      setShowApproveBaselineModal, setApproveBaselineRunId, setBaselineData, addNotification,
      refreshBaselineData, refreshBaselineHistory]);

  // Restore baseline handler
  const handleRestoreBaseline = useCallback(async (historyId: string) => {
    if (!testId || !token) return;

    setRestoringBaseline(true);
    setRestoreBaselineError('');

    try {
      const response = await fetch(`/api/v1/tests/${testId}/baseline/history/${historyId}/restore`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ branch: selectedBranch }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to restore baseline');
      }

      const data = await response.json();

      // Close the modal
      setShowRestoreBaselineModal(false);
      setRestoreHistoryEntry(null);

      // Show success notification
      addNotification({
        type: 'success',
        title: 'Baseline Restored',
        message: `Baseline restored from version ${data.restoredFromVersion}! Future test runs will compare against this baseline.`,
      });

      // Refresh baseline data
      setBaselineData(null);
      await refreshBaselineData();
      await refreshBaselineHistory();
    } catch (error) {
      setRestoreBaselineError(error instanceof Error ? error.message : 'Failed to restore baseline');
    } finally {
      setRestoringBaseline(false);
    }
  }, [testId, token, selectedBranch, setRestoringBaseline, setRestoreBaselineError,
      setShowRestoreBaselineModal, setRestoreHistoryEntry, setBaselineData, addNotification,
      refreshBaselineData, refreshBaselineHistory]);

  // Reject changes handler
  const handleRejectChanges = useCallback(async (runId?: string, reason?: string) => {
    if (!testId || !token) return;

    setRejectingChanges(true);
    setRejectChangesError('');

    try {
      const response = await fetch(`/api/v1/tests/${testId}/baseline/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ runId, reason, branch: selectedBranch }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to reject changes');
      }

      // Close the modal
      setShowRejectChangesModal(false);
      setRejectChangesRunId(null);

      // Show success notification
      addNotification({
        type: 'success',
        title: 'Changes Rejected',
        message: 'Visual changes rejected successfully. The test run has been marked as intentionally failed.',
      });

      // Refresh baseline data if on baseline tab
      if (activeTab === 'baseline') {
        await refreshBaselineData();
      }
    } catch (error) {
      setRejectChangesError(error instanceof Error ? error.message : 'Failed to reject changes');
    } finally {
      setRejectingChanges(false);
    }
  }, [testId, token, selectedBranch, activeTab, setRejectingChanges, setRejectChangesError,
      setShowRejectChangesModal, setRejectChangesRunId, addNotification, refreshBaselineData]);

  // Merge baseline handler
  const handleMergeBaseline = useCallback(async (sourceBranch: string) => {
    if (!testId || !token) return;

    setIsMergingBaseline(true);
    setMergeBaselineError('');

    try {
      const response = await fetch(`/api/v1/tests/${testId}/baseline/merge`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceBranch,
          targetBranch: selectedBranch,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to merge baseline');
      }

      // Close the modal
      setShowMergeBaselineModal(false);
      setSelectedMergeBranch(null);

      // Show success notification
      addNotification({
        type: 'success',
        title: 'Baseline Merged',
        message: `Baseline merged from ${sourceBranch} to ${selectedBranch}! Future test runs on ${selectedBranch} will use the merged baseline.`,
      });

      // Refresh baseline data
      setBaselineData(null);
      await refreshBaselineData();
      await refreshBaselineHistory();
    } catch (error) {
      setMergeBaselineError(error instanceof Error ? error.message : 'Failed to merge baseline');
    } finally {
      setIsMergingBaseline(false);
    }
  }, [testId, token, selectedBranch, setIsMergingBaseline, setMergeBaselineError,
      setShowMergeBaselineModal, setSelectedMergeBranch, setBaselineData, addNotification,
      refreshBaselineData, refreshBaselineHistory]);

  return {
    handleApproveBaseline,
    handleRestoreBaseline,
    handleRejectChanges,
    handleMergeBaseline,
    refreshBaselineData,
    refreshBaselineHistory,
  };
}

export type BaselineHandlers = ReturnType<typeof useBaselineHandlers>;
