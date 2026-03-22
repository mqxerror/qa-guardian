/**
 * Feature #546: useSuiteRunSocket - WebSocket-based suite run tracking
 * Replaces HTTP polling with real-time WebSocket updates for suite runs.
 * Uses shared useSocketStore (NOT a separate Socket.IO connection).
 *
 * === Socket.IO Event Contract ===
 *
 * Events emitted by the client (via socketStore):
 *   join-run(runId: string)   - Subscribe to a run room for real-time events
 *   leave-run(runId: string)  - Unsubscribe from a run room
 *
 * Events received from the server:
 *   run-start        { runId, status }
 *     Fired when the suite run begins execution. Updates run status to 'running'.
 *
 *   run-progress     { runId, totalTests, completedTests, currentTest? }
 *     Periodic progress update. This is the SOLE source of truth for completedTests
 *     and totalTests counters — do NOT increment counters from other events.
 *
 *   test-start       { runId, testId, testName }
 *     Fired when an individual test begins. Updates per-test status to 'running'.
 *
 *   test-complete    { runId, testId, status: 'passed'|'failed'|'error'|'skipped' }
 *     Fired when an individual test finishes. Updates per-test result data ONLY
 *     (does not touch the completedTests counter — that comes from run-progress).
 *
 *   step-start       { runId, testId?, stepIndex, action, totalSteps? }
 *     Fired when a step within a test begins execution.
 *
 *   step-complete    { runId, testId?, stepIndex, totalSteps, status }
 *     Fired when a step within a test finishes.
 *
 *   step:screenshot  { runId, testId, testName, stepIndex, stepAction, stepSelector?, base64, timestamp }
 *     Fired when a live screenshot is captured during step execution.
 *
 *   run-complete     { runId, status, duration_ms, results?: SuiteRunResult[] }
 *     Fired when the entire suite run finishes (pass, fail, or error).
 *     Contains final results for all tests.
 */

import { useEffect, useCallback, useRef, useState } from 'react';
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
  status: 'pending' | 'running' | 'passed' | 'failed' | 'cancelled' | 'error';
  started_at?: string;
  duration_ms?: number;
  error_message?: string;
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

// Phase 2D: Stale detection constants (module-level to satisfy exhaustive-deps)
const STALE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes without WS events triggers a poll
const STALE_CHECK_INTERVAL_MS = 30 * 1000; // Check staleness every 30 seconds

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

  // Phase 2D: Track last WebSocket event timestamp to detect stale connections.
  // When connected but no events arrive for 2 minutes during an active run,
  // the hook polls the API to check if the run completed/errored server-side.
  const lastEventTimestampRef = useRef<number>(Date.now());
  const isRunActiveRef = useRef(false);

  // State-based render trigger: refs store the data, this counter forces re-renders
  // when WebSocket events arrive (refs alone don't trigger re-renders)
  const [, setRenderTrigger] = useState(0);
  const triggerRender = useCallback(() => setRenderTrigger(v => v + 1), []);

  // Ensure socket is connected when we have a run to track
  useEffect(() => {
    if (enabled && runId && token && !isConnected) {
      connect();
    }
  }, [enabled, runId, token, isConnected, connect]);

  // Fallback: poll every 10s when WebSocket is disconnected to prevent stuck UI
  // Feature #fix: Enhanced to also update per-test progress, not just completion status
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

          // Update per-test progress from results (keeps UI alive during WS outage)
          if (run.results && Array.isArray(run.results)) {
            let completed = 0;
            for (const result of run.results) {
              const status = result.status as TestRunStatus;
              perTestStatusRef.current.set(result.test_id, status);
              if (status !== 'running' && status !== 'waiting') {
                completed++;
              }
            }
            completedTestsRef.current = completed;
            totalTestsRef.current = run.results.length;
            triggerRender();

            // Notify parent of progress update
            onRunUpdate({
              status: run.status,
              results: run.results,
            });
          }

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
  }, [enabled, runId, token, isConnected, onRunComplete, onRunUpdate, triggerRender]);

  // Phase 2D: Stale connection detection - poll API when connected but no WS events
  // arrive for 2 minutes during an active run. This catches cases where the WebSocket
  // connection appears alive but the server-side run has completed or errored
  // (e.g., due to timeout, crash, or missed run-complete event).
  useEffect(() => {
    if (!enabled || !runId || !token || !isConnected || !isRunActiveRef.current) return;

    const staleChecker = setInterval(async () => {
      const timeSinceLastEvent = Date.now() - lastEventTimestampRef.current;
      if (timeSinceLastEvent < STALE_THRESHOLD_MS) return;

      logger.websocket.debug(
        'useSuiteRunSocket: No WS events for 2+ minutes during active run, polling API',
        { runId, timeSinceLastEventMs: timeSinceLastEvent }
      );

      try {
        const response = await fetch(`/api/v1/runs/${runId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!response.ok) return;

        const data = await response.json();
        const run = data.run;

        // If the server says the run is in a terminal state, update UI
        if (run.status !== 'pending' && run.status !== 'running') {
          logger.websocket.debug(
            'useSuiteRunSocket: Stale detection found terminal status via poll',
            { runId, status: run.status }
          );

          // Update per-test status from results
          if (run.results && Array.isArray(run.results)) {
            for (const result of run.results) {
              perTestStatusRef.current.set(result.test_id, result.status as TestRunStatus);
            }
          }

          isRunActiveRef.current = false;
          currentStepRef.current = null;
          triggerRender();

          onRunComplete({
            id: run.id,
            status: run.status,
            duration_ms: run.duration_ms,
            results: run.results,
          });
        }
      } catch {
        // Silently ignore stale check poll errors
      }
    }, STALE_CHECK_INTERVAL_MS);

    return () => clearInterval(staleChecker);
  }, [enabled, runId, token, isConnected, onRunComplete, triggerRender]);

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
    lastEventTimestampRef.current = Date.now();
    // Assume run is active when we join — the run-complete handler will clear this
    isRunActiveRef.current = true;

    // Fix: Catch up on any events missed during the race window between
    // room join and worker start. The worker may have already emitted
    // run-start and run-progress (with totalTests) to an empty room.
    setTimeout(async () => {
      try {
        const response = await fetch(`/api/v1/runs/${runId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          const run = data.run;

          // Update counters from server state
          if (run.results && Array.isArray(run.results)) {
            let completed = 0;
            totalTestsRef.current = run.results.length;
            for (const result of run.results) {
              const status = result.status as TestRunStatus;
              perTestStatusRef.current.set(result.test_id, status);
              if (status !== 'running' && status !== 'waiting') {
                completed++;
              }
            }
            completedTestsRef.current = completed;
          }

          // Check if run already completed while we were joining
          if (run.status !== 'pending' && run.status !== 'running') {
            isRunActiveRef.current = false;
            currentStepRef.current = null;
            onRunComplete({
              id: run.id,
              status: run.status,
              duration_ms: run.duration_ms,
              results: run.results,
            });
          }
          triggerRender();
        }
      } catch {
        // Stale check interval will catch it
      }
    }, 500);

    return () => {
      logger.websocket.debug('useSuiteRunSocket: Leaving run room:', runId);
      leaveRun(runId);
    };
  }, [enabled, runId, socket, isConnected, joinRun, leaveRun]);

  // Handle run-start event
  const handleRunStart = useCallback((data: { runId: string; status: string }) => {
    if (data.runId !== runId) return;
    lastEventTimestampRef.current = Date.now();
    isRunActiveRef.current = true;
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
    lastEventTimestampRef.current = Date.now();
    logger.websocket.debug('useSuiteRunSocket: run-progress', data);

    totalTestsRef.current = data.totalTests;
    completedTestsRef.current = data.completedTests;

    // If we have a current test, mark it as running
    if (data.currentTest) {
      perTestStatusRef.current.set(data.currentTest, 'running');
    }
    triggerRender();
  }, [runId, triggerRender]);

  // Handle test-start event
  const handleTestStart = useCallback((data: {
    runId: string;
    testId: string;
    testName: string;
  }) => {
    if (data.runId !== runId) return;
    lastEventTimestampRef.current = Date.now();
    logger.websocket.debug('useSuiteRunSocket: test-start', data);

    perTestStatusRef.current.set(data.testId, 'running');
    currentStepRef.current = {
      testId: data.testId,
      testName: data.testName,
      stepIndex: 0,
      totalSteps: 0,
      action: 'Starting...',
    };
    triggerRender();
  }, [runId, triggerRender]);

  // Handle step-start event
  const handleStepStart = useCallback((data: {
    runId: string;
    testId?: string;
    stepIndex: number;
    action: string;
    totalSteps?: number;
  }) => {
    if (data.runId !== runId) return;
    lastEventTimestampRef.current = Date.now();
    logger.websocket.debug('useSuiteRunSocket: step-start', data);

    if (currentStepRef.current) {
      currentStepRef.current = {
        ...currentStepRef.current,
        stepIndex: data.stepIndex,
        action: data.action,
        totalSteps: data.totalSteps || currentStepRef.current.totalSteps,
      };
      triggerRender();
    }
  }, [runId, triggerRender]);

  // Handle step-complete event
  const handleStepComplete = useCallback((data: {
    runId: string;
    testId?: string;
    stepIndex: number;
    totalSteps: number;
    status: string;
  }) => {
    if (data.runId !== runId) return;
    lastEventTimestampRef.current = Date.now();
    logger.websocket.debug('useSuiteRunSocket: step-complete', data);

    if (currentStepRef.current) {
      currentStepRef.current = {
        ...currentStepRef.current,
        // Keep the raw stepIndex — the display template already adds +1 for 1-based display
        stepIndex: data.stepIndex,
        totalSteps: data.totalSteps,
        action: '',
      };
      triggerRender();
    }
  }, [runId, triggerRender]);

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
    lastEventTimestampRef.current = Date.now();
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
  // NOTE: This handler updates per-test result data only. The completedTests counter
  // is managed exclusively by the run-progress event to avoid double-counting drift.
  const handleTestComplete = useCallback((data: {
    runId: string;
    testId: string;
    status: 'passed' | 'failed' | 'error' | 'skipped';
  }) => {
    if (data.runId !== runId) return;
    lastEventTimestampRef.current = Date.now();
    logger.websocket.debug('useSuiteRunSocket: test-complete', data);

    perTestStatusRef.current.set(data.testId, data.status);
    triggerRender();
  }, [runId, triggerRender]);

  // Handle run-complete event
  const handleRunComplete = useCallback((data: {
    runId: string;
    status: string;
    duration_ms: number;
    results?: SuiteRunResult[];
  }) => {
    if (data.runId !== runId) return;
    lastEventTimestampRef.current = Date.now();
    isRunActiveRef.current = false;
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
