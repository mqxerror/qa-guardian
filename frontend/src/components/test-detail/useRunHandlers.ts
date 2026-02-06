/**
 * Feature #48: useRunHandlers - Custom hook for test run handlers
 * Extracts handleRunTest, handleCancelRun, pollRunStatus, and WebSocket handlers from TestDetailPage.tsx
 */

import { useCallback, useEffect } from 'react';
import { toast } from '../../stores/toastStore';
import { getErrorMessage } from '../../utils/errorHandling';
import { logger } from '../../utils/logger';
import type { Socket } from 'socket.io-client';
import type { TestRunType } from './types';

export interface LiveProgress {
  totalTests: number;
  completedTests: number;
  currentTest?: string;
  currentStep?: { index: number; total: number; action: string };
  k6Metrics?: {
    phase: string;
    progress: number;
    currentVUs?: number;
    totalRequests?: number;
    requestsPerSecond?: number;
    avgResponseTime?: number;
    errorRate?: number;
    p50ResponseTime?: number;
    p95ResponseTime?: number;
    p99ResponseTime?: number;
  };
}

export interface UseRunHandlersProps {
  testId: string | undefined;
  token: string | null;
  selectedBranch: string;
  testType?: string;
  currentRun: TestRunType | null;
  socket: Socket | null;
  // Socket functions
  connect: () => void;
  joinRun: (runId: string) => void;
  leaveRun: (runId: string) => void;
  // State setters
  setIsRunning: (value: boolean) => void;
  setRunError: (value: string) => void;
  setCurrentRun: (run: TestRunType | null | ((prev: TestRunType | null) => TestRunType | null)) => void;
  setLiveProgress: (progress: LiveProgress | null | ((prev: LiveProgress | null) => LiveProgress | null)) => void;
  setIsCancellingRun: (value: boolean) => void;
  // Data refresh function
  fetchRuns: () => Promise<void>;
}

export interface RunHandlers {
  handleRunTest: () => Promise<void>;
  handleCancelRun: () => Promise<void>;
  pollRunStatus: (runId: string) => void;
}

export function useRunHandlers({
  testId,
  token,
  selectedBranch,
  testType,
  currentRun,
  socket,
  connect,
  joinRun,
  leaveRun,
  setIsRunning,
  setRunError,
  setCurrentRun,
  setLiveProgress,
  setIsCancellingRun,
  fetchRuns,
}: UseRunHandlersProps): RunHandlers {

  // Poll run status as fallback for WebSocket
  const pollRunStatus = useCallback((runId: string) => {
    const poll = async () => {
      try {
        const response = await fetch(`/api/v1/runs/${runId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setCurrentRun(data.run);

          if (data.run.status === 'pending' || data.run.status === 'running') {
            // Continue polling
            setTimeout(poll, 1000);
          } else {
            // Run completed
            setIsRunning(false);
            setLiveProgress(null);
            // Refresh runs list
            fetchRuns();
          }
        }
      } catch {
        setIsRunning(false);
      }
    };

    poll();
  }, [token, setCurrentRun, setIsRunning, setLiveProgress, fetchRuns]);

  // Run test handler
  const handleRunTest = useCallback(async () => {
    setRunError('');
    setIsRunning(true);
    setLiveProgress(null);

    // Connect to socket if not already connected
    connect();

    try {
      const response = await fetch(`/api/v1/tests/${testId}/runs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          branch: selectedBranch,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to start test run');
      }

      const data = await response.json();
      setCurrentRun(data.run);

      // Join the run's WebSocket room for real-time updates
      joinRun(data.run.id);
      logger.websocket.debug('Joined run room:', data.run.id);

      // Also poll for completion as fallback
      pollRunStatus(data.run.id);
    } catch (err) {
      setRunError(getErrorMessage(err, 'Failed to start test run'));
      setIsRunning(false);
    }
  }, [testId, token, selectedBranch, connect, joinRun, pollRunStatus, setRunError, setIsRunning, setLiveProgress, setCurrentRun]);

  // Cancel run handler
  const handleCancelRun = useCallback(async () => {
    if (!currentRun?.id) return;

    setIsCancellingRun(true);

    try {
      const response = await fetch(`/api/v1/runs/${currentRun.id}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to cancel run');
      }

      setCurrentRun(prev => prev ? { ...prev, status: 'cancelled' } : null);
      setIsRunning(false);
      setLiveProgress(null);
      // Leave the run room
      if (currentRun.id) {
        leaveRun(currentRun.id);
      }
      toast.success('Test run cancelled');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel run');
    } finally {
      setIsCancellingRun(false);
    }
  }, [currentRun, token, leaveRun, setIsCancellingRun, setCurrentRun, setIsRunning, setLiveProgress]);

  // Handle WebSocket events for real-time updates
  useEffect(() => {
    if (!socket || !currentRun) return;

    const handleRunStart = (data: { runId: string; status: string }) => {
      logger.websocket.debug('run-start event:', data);
      if (data.runId === currentRun.id) {
        setCurrentRun(prev => prev ? { ...prev, status: 'running' } : null);
      }
    };

    const handleRunProgress = (data: { runId: string; totalTests: number; completedTests: number; currentTest?: string }) => {
      logger.websocket.debug('run-progress event:', data);
      if (data.runId === currentRun.id) {
        setLiveProgress({
          totalTests: data.totalTests,
          completedTests: data.completedTests,
          currentTest: data.currentTest,
        });
      }
    };

    const handleStepStart = (data: { runId: string; stepIndex: number; action: string }) => {
      logger.websocket.debug('step-start event:', data);
      if (data.runId === currentRun.id) {
        setLiveProgress(prev => prev ? {
          ...prev,
          currentStep: { index: data.stepIndex, total: prev.currentStep?.total || 0, action: data.action }
        } : null);
      }
    };

    const handleStepComplete = (data: { runId: string; stepIndex: number; totalSteps: number; status: string }) => {
      logger.websocket.debug('step-complete event:', data);
      if (data.runId === currentRun.id) {
        setLiveProgress(prev => prev ? {
          ...prev,
          currentStep: { index: data.stepIndex + 1, total: data.totalSteps, action: '' }
        } : null);
      }
    };

    const handleRunComplete = (data: { runId: string; status: string; duration_ms: number }) => {
      logger.websocket.debug('run-complete event:', data);
      if (data.runId === currentRun.id) {
        setIsRunning(false);
        setLiveProgress(null);
        // Leave the room
        leaveRun(data.runId);
        // Refresh runs list
        fetchRuns();
      }
    };

    // K6 load test progress handler
    const handleStepProgress = (data: {
      runId: string;
      stepId?: string;
      phase: string;
      progress: number;
      currentVUs?: number;
      totalRequests?: number;
      requestsPerSecond?: number;
      avgResponseTime?: number;
      errorRate?: number;
      p50ResponseTime?: number;
      p95ResponseTime?: number;
      p99ResponseTime?: number;
    }) => {
      logger.websocket.debug('step-progress event:', data);
      if (data.runId === currentRun.id) {
        // Only show k6 metrics panel for actual load tests
        if (testType === 'load' || data.stepId === 'load_test') {
          setLiveProgress(prev => prev ? {
            ...prev,
            k6Metrics: {
              phase: data.phase,
              progress: data.progress,
              currentVUs: data.currentVUs,
              totalRequests: data.totalRequests,
              requestsPerSecond: data.requestsPerSecond,
              avgResponseTime: data.avgResponseTime,
              errorRate: data.errorRate,
              p50ResponseTime: data.p50ResponseTime,
              p95ResponseTime: data.p95ResponseTime,
              p99ResponseTime: data.p99ResponseTime,
            }
          } : null);
        } else {
          // For non-load tests, just update the progress bar
          setLiveProgress(prev => prev ? {
            ...prev,
            currentStep: { ...prev.currentStep, action: data.phase } as { index: number; total: number; action: string },
          } : null);
        }
      }
    };

    socket.on('run-start', handleRunStart);
    socket.on('run-progress', handleRunProgress);
    socket.on('step-start', handleStepStart);
    socket.on('step-complete', handleStepComplete);
    socket.on('step-progress', handleStepProgress);
    socket.on('run-complete', handleRunComplete);

    return () => {
      socket.off('run-start', handleRunStart);
      socket.off('run-progress', handleRunProgress);
      socket.off('step-start', handleStepStart);
      socket.off('step-complete', handleStepComplete);
      socket.off('step-progress', handleStepProgress);
      socket.off('run-complete', handleRunComplete);
    };
  }, [socket, currentRun, testType, leaveRun, fetchRuns, setIsRunning, setLiveProgress, setCurrentRun]);

  return {
    handleRunTest,
    handleCancelRun,
    pollRunStatus,
  };
}
