/**
 * Feature #48: useTestDetailActions - Custom hook for TestDetailPage action handlers
 * Extracts API-related action handlers from TestDetailPage.tsx
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../stores/toastStore';
import { getErrorMessage } from '../../utils/errorHandling';
import { TestType, TestRunType } from './types';

/** Notification type for test detail actions */
export interface TestDetailNotification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  timestamp?: number;
}

export interface UseTestDetailActionsProps {
  testId: string | undefined;
  token: string | null;
  setIsDeleting: (value: boolean) => void;
  setDeleteError: (value: string) => void;
  setIsEditing: (value: boolean) => void;
  setEditError: (value: string) => void;
  setShowEditModal: (value: boolean) => void;
  setTest: (test: TestType) => void;
  setIsDuplicating: (value: boolean) => void;
  setDuplicateError: (value: string) => void;
  setIsRunning: (value: boolean) => void;
  setRunError: (value: string) => void;
  setCurrentRun: (run: TestRunType | null) => void;
  setIsCancellingRun: (value: boolean) => void;
  setIsDownloadingArtifacts: (value: boolean) => void;
  suite: { id: string } | null;
  test: TestType | null;
  selectedBranch: string;
  runs: TestRunType[];
  setRuns: (runs: TestRunType[]) => void;
  addNotification: (notification: TestDetailNotification) => void;
}

export function useTestDetailActions({
  testId,
  token,
  setIsDeleting,
  setDeleteError,
  setIsEditing,
  setEditError,
  setShowEditModal,
  setTest,
  setIsDuplicating,
  setDuplicateError,
  setIsRunning,
  setRunError,
  setCurrentRun,
  setIsCancellingRun,
  setIsDownloadingArtifacts,
  suite,
  test,
  selectedBranch,
  runs,
  setRuns,
}: UseTestDetailActionsProps) {
  const navigate = useNavigate();

  // Delete test
  const handleDelete = useCallback(async () => {
    if (!testId || !token) return;

    setIsDeleting(true);
    setDeleteError('');

    try {
      const res = await fetch(`/api/v1/tests/${testId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete test');
      }

      toast.success('Test deleted successfully');
      navigate(suite?.id ? `/suites/${suite.id}` : '/projects');
    } catch (err) {
      const message = getErrorMessage(err);
      setDeleteError(message);
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  }, [testId, token, suite, navigate, setIsDeleting, setDeleteError]);

  // Edit test
  const handleEdit = useCallback(async (name: string, description: string) => {
    if (!testId || !token) return;

    setIsEditing(true);
    setEditError('');

    try {
      const res = await fetch(`/api/v1/tests/${testId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: name.trim(), description: description.trim() })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update test');
      }

      const updatedTest = await res.json();
      setTest(updatedTest);
      setShowEditModal(false);
      toast.success('Test updated successfully');
    } catch (err) {
      const message = getErrorMessage(err);
      setEditError(message);
      toast.error(message);
    } finally {
      setIsEditing(false);
    }
  }, [testId, token, setIsEditing, setEditError, setTest, setShowEditModal]);

  // Duplicate test
  const handleDuplicate = useCallback(async () => {
    if (!testId || !token || !test) return;

    setIsDuplicating(true);
    setDuplicateError('');

    try {
      const res = await fetch(`/api/v1/tests/${testId}/duplicate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to duplicate test');
      }

      const duplicatedTest = await res.json();
      toast.success('Test duplicated successfully');
      navigate(`/tests/${duplicatedTest.id}`);
    } catch (err) {
      const message = getErrorMessage(err);
      setDuplicateError(message);
      toast.error(message);
    } finally {
      setIsDuplicating(false);
    }
  }, [testId, token, test, navigate, setIsDuplicating, setDuplicateError]);

  // Run test
  const handleRunTest = useCallback(async () => {
    if (!testId || !token) return;

    setIsRunning(true);
    setRunError('');

    try {
      const res = await fetch(`/api/v1/tests/${testId}/run`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          branch: selectedBranch
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to run test');
      }

      const run = await res.json();
      setCurrentRun(run);

      // Add to runs list
      setRuns([run, ...runs]);

      toast.success('Test run started');
    } catch (err) {
      const message = getErrorMessage(err);
      setRunError(message);
      toast.error(message);
      setIsRunning(false);
    }
  }, [testId, token, selectedBranch, runs, setIsRunning, setRunError, setCurrentRun, setRuns]);

  // Cancel run
  const handleCancelRun = useCallback(async () => {
    if (!token) return;

    setIsCancellingRun(true);

    try {
      // Get current run ID from state
      const currentRunId = runs.find(r => r.status === 'running')?.id;
      if (!currentRunId) {
        throw new Error('No running test found');
      }

      const res = await fetch(`/api/v1/runs/${currentRunId}/cancel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to cancel run');
      }

      setIsRunning(false);
      setCurrentRun(null);
      toast.info('Test run cancelled');
    } catch (err) {
      const message = getErrorMessage(err);
      toast.error(message);
    } finally {
      setIsCancellingRun(false);
    }
  }, [token, runs, setIsCancellingRun, setIsRunning, setCurrentRun]);

  // Download all artifacts
  const handleDownloadAllArtifacts = useCallback(async (runId: string) => {
    if (!token) return;

    setIsDownloadingArtifacts(true);

    try {
      const res = await fetch(`/api/v1/runs/${runId}/artifacts/download`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error('Failed to download artifacts');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `test-run-${runId}-artifacts.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Artifacts downloaded');
    } catch (err) {
      const message = getErrorMessage(err);
      toast.error(message);
    } finally {
      setIsDownloadingArtifacts(false);
    }
  }, [token, setIsDownloadingArtifacts]);

  return {
    handleDelete,
    handleEdit,
    handleDuplicate,
    handleRunTest,
    handleCancelRun,
    handleDownloadAllArtifacts,
  };
}
