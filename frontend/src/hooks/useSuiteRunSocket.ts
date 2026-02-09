/**
 * Feature #546: useSuiteRunSocket - WebSocket-based suite run tracking
 * Replaces HTTP polling with real-time WebSocket updates for suite runs.
 * Uses shared useSocketStore (NOT a separate Socket.IO connection).
 *
 * Events handled:
 * - run-start: Suite run started
 * - run-progress: Overall progress update
 * - test-start: Individual test started
 * - step-start: Step started within a test
 * - step-complete: Step completed
 * - step:screenshot: Live screenshot from step execution
 * - run-complete: Suite run finished
 */

import { useEffect, useCallback, useRef } from 'react';
import { useSocketStore } from '../stores/socketStore';
import { logger } from '../utils/logger';

/**
 * Per-test status for tracking which tests are running/completed
 */
export type TestRunStatus = 'waiting' | 'running' | 'passed' | 'failed' | 'error' | 'skipped';

/**
 * Live screenshot data from step execution
 */
export interface LiveScreenshot {
  base64: string;
  testId: string;
  testName: string;
  stepIndex: number;
  stepAction: string;
  stepSelector?: string;
  timestamp: number;
}

/**
 * Screenshot history entry (condensed for history display)
 */
export interface ScreenshotHistoryEntry {
  base64: string;
  stepIndex: number;
  stepAction: string;
  timestamp: number;
}

/**
 * Suite run result for individual tests
 */
export interface SuiteRunResult {
  test_id: string;
  test_name: string;
  test_type?: string;
  status: 'passed' | 'failed' | 'error' | 'running' | 'skipped';
  duration_ms: number;
  error?: string;
  diff_percentage?: number;
}

/**
 * Suite run state
 */
export interface SuiteRun {
  id: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'cancelled';
  started_at?: string;
  duration_ms?: number;
  results?: SuiteRunResult[];
}

/**
 * Progress state for current step
 */
export interface CurrentStepProgress {
  testId: string;
  testName: string;
  stepIndex: number;
  totalSteps: number;
  action: string;
}

/**
 * Props for useSuiteRunSocket hook
 */
export interface UseSuiteRunSocketProps {
  runId: string | null | undefined;
  token: string | null;
  onRunUpdate: (run: Partial<SuiteRun>) => void;
  onRunComplete: (run: SuiteRun) => void;
  onScreenshot: (screenshot: LiveScreenshot) => void;
  onScreenshotHistory: (entry: ScreenshotHistoryEntry) => void;
  enabled?: boolean;
}

/**
 * Return type for useSuiteRunSocket
 */
export interface UseSuiteRunSocketReturn {
  isConnected: boolean;
  perTestStatus: Map<string, TestRunStatus>;
  currentStep: CurrentStepProgress | null;
  completedTests: number;
  totalTests: number;
}

/**
 * Custom hook for WebSocket-based suite run tracking
 * Replaces HTTP polling with real-time Socket.IO events
 */
export function useSuiteRunSocket({
  runId,
  token,
  onRunUpdate,
  onRunComplete,
  onScreenshot,
  onScreenshotHistory,
  enabled = true,
}: UseSuiteRunSocketProps): UseSuiteRunSocketReturn {
  // Use shared socket store
  const { socket, isConnected, connect, joinRun, leaveRun } = useSocketStore();

  // Track per-test status
  const perTestStatusRef = useRef<Map<string, TestRunStatus>>(new Map());

  // Track current step progress
  const currentStepRef = useRef<CurrentStepProgress | null>(null);

  // Track overall progress
  const completedTestsRef = useRef(0);
  const totalTestsRef = useRef(0);

  // Ensure socket is connected when we have a run to track
  useEffect(() => {
    if (enabled && runId && token && !isConnected) {
      connect();
    }
  }, [enabled, runId, token, isConnected, connect]);

  // Fallback: poll every 10s when WebSocket is disconnected to prevent stuck UI
  useEffect(() => {
    if (!enabled || !runId || !token || isConnected) return;

    logger.websocket.debug('useSuiteRunSocket: WebSocket disconnected, starting fallback poll');
    const fallbackPoll = setInterval(async () => {
      try {
        const response = await fetch(`/api/v1/runs/${runId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          const run = data.run;
          if (run.status !== 'pending' && run.status !== 'running') {
            // Run completed while WebSocket was down
            onRunComplete({
              id: run.id,
              status: run.status,
              duration_ms: run.duration_ms,
              results: run.results,
            });
          }
        }
      } catch {
        // Silently ignore fallback poll errors
      }
    }, 10000);

    return () => clearInterval(fallbackPoll);
  }, [enabled, runId, token, isConnected, onRunComplete]);

  // Join/leave run room when runId changes
  useEffect(() => {
    if (!enabled || !runId || !socket || !isConnected) return;

    logger.websocket.debug('useSuiteRunSocket: Joining run room:', runId);
    joinRun(runId);

    // Reset state when joining a new run
    perTestStatusRef.current = new Map();
    currentStepRef.current = null;
    completedTestsRef.current = 0;
    totalTestsRef.current = 0;

    return () => {
      logger.websocket.debug('useSuiteRunSocket: Leaving run room:', runId);
      leaveRun(runId);
    };
  }, [enabled, runId, socket, isConnected, joinRun, leaveRun]);

  // Handle run-start event
  const handleRunStart = useCallback((data: { runId: string; status: string }) => {
    if (data.runId !== runId) return;
    logger.websocket.debug('useSuiteRunSocket: run-start', data);
    onRunUpdate({ status: 'running' });
  }, [runId, onRunUpdate]);

  // Handle run-progress event
  const handleRunProgress = useCallback((data: {
    runId: string;
    totalTests: number;
    completedTests: number;
    currentTest?: string;
  }) => {
    if (data.runId !== runId) return;
    logger.websocket.debug('useSuiteRunSocket: run-progress', data);

    totalTestsRef.current = data.totalTests;
    completedTestsRef.current = data.completedTests;

    // If we have a current test, mark it as running
    if (data.currentTest) {
      perTestStatusRef.current.set(data.currentTest, 'running');
    }
  }, [runId]);

  // Handle test-start event
  const handleTestStart = useCallback((data: {
    runId: string;
    testId: string;
    testName: string;
  }) => {
    if (data.runId !== runId) return;
    logger.websocket.debug('useSuiteRunSocket: test-start', data);

    perTestStatusRef.current.set(data.testId, 'running');
    currentStepRef.current = {
      testId: data.testId,
      testName: data.testName,
      stepIndex: 0,
      totalSteps: 0,
      action: 'Starting...',
    };
  }, [runId]);

  // Handle step-start event
  const handleStepStart = useCallback((data: {
    runId: string;
    testId?: string;
    stepIndex: number;
    action: string;
    totalSteps?: number;
  }) => {
    if (data.runId !== runId) return;
    logger.websocket.debug('useSuiteRunSocket: step-start', data);

    if (currentStepRef.current) {
      currentStepRef.current = {
        ...currentStepRef.current,
        stepIndex: data.stepIndex,
        action: data.action,
        totalSteps: data.totalSteps || currentStepRef.current.totalSteps,
      };
    }
  }, [runId]);

  // Handle step-complete event
  const handleStepComplete = useCallback((data: {
    runId: string;
    testId?: string;
    stepIndex: number;
    totalSteps: number;
    status: string;
  }) => {
    if (data.runId !== runId) return;
    logger.websocket.debug('useSuiteRunSocket: step-complete', data);

    if (currentStepRef.current) {
      currentStepRef.current = {
        ...currentStepRef.current,
        stepIndex: data.stepIndex + 1,
        totalSteps: data.totalSteps,
        action: '',
      };
    }
  }, [runId]);

  // Handle step:screenshot event
  const handleStepScreenshot = useCallback((data: {
    runId: string;
    testId: string;
    testName: string;
    stepIndex: number;
    stepAction: string;
    stepSelector?: string;
    base64: string;
    timestamp: number;
  }) => {
    if (data.runId !== runId) return;
    logger.websocket.debug('useSuiteRunSocket: step:screenshot', { runId: data.runId, stepIndex: data.stepIndex });

    // Notify parent of new screenshot
    onScreenshot({
      base64: data.base64,
      testId: data.testId,
      testName: data.testName,
      stepIndex: data.stepIndex,
      stepAction: data.stepAction,
      stepSelector: data.stepSelector,
      timestamp: data.timestamp,
    });

    // Add to history
    onScreenshotHistory({
      base64: data.base64,
      stepIndex: data.stepIndex,
      stepAction: data.stepAction,
      timestamp: data.timestamp,
    });
  }, [runId, onScreenshot, onScreenshotHistory]);

  // Handle test-complete event (not all backends emit this, but handle if present)
  const handleTestComplete = useCallback((data: {
    runId: string;
    testId: string;
    status: 'passed' | 'failed' | 'error' | 'skipped';
  }) => {
    if (data.runId !== runId) return;
    logger.websocket.debug('useSuiteRunSocket: test-complete', data);

    perTestStatusRef.current.set(data.testId, data.status);
    completedTestsRef.current += 1;
  }, [runId]);

  // Handle run-complete event
  const handleRunComplete = useCallback((data: {
    runId: string;
    status: string;
    duration_ms: number;
    results?: SuiteRunResult[];
  }) => {
    if (data.runId !== runId) return;
    logger.websocket.debug('useSuiteRunSocket: run-complete', data);

    // Update per-test status from results
    if (data.results) {
      for (const result of data.results) {
        perTestStatusRef.current.set(result.test_id, result.status as TestRunStatus);
      }
    }

    // Clear current step
    currentStepRef.current = null;

    // Notify parent of completion
    onRunComplete({
      id: data.runId,
      status: data.status as SuiteRun['status'],
      duration_ms: data.duration_ms,
      results: data.results,
    });
  }, [runId, onRunComplete]);

  // Subscribe to socket events
  useEffect(() => {
    if (!socket || !runId || !enabled) return;

    socket.on('run-start', handleRunStart);
    socket.on('run-progress', handleRunProgress);
    socket.on('test-start', handleTestStart);
    socket.on('step-start', handleStepStart);
    socket.on('step-complete', handleStepComplete);
    socket.on('step:screenshot', handleStepScreenshot);
    socket.on('test-complete', handleTestComplete);
    socket.on('run-complete', handleRunComplete);

    return () => {
      socket.off('run-start', handleRunStart);
      socket.off('run-progress', handleRunProgress);
      socket.off('test-start', handleTestStart);
      socket.off('step-start', handleStepStart);
      socket.off('step-complete', handleStepComplete);
      socket.off('step:screenshot', handleStepScreenshot);
      socket.off('test-complete', handleTestComplete);
      socket.off('run-complete', handleRunComplete);
    };
  }, [
    socket,
    runId,
    enabled,
    handleRunStart,
    handleRunProgress,
    handleTestStart,
    handleStepStart,
    handleStepComplete,
    handleStepScreenshot,
    handleTestComplete,
    handleRunComplete,
  ]);

  return {
    isConnected,
    perTestStatus: perTestStatusRef.current,
    currentStep: currentStepRef.current,
    completedTests: completedTestsRef.current,
    totalTests: totalTestsRef.current,
  };
}
