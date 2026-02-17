/**
 * useQuickTestSocket Hook
 * Feature #426: Subscribe to quick-test:{runId} room for real-time wave updates
 *
 * Handles:
 * - Room joining/leaving for quick-test runs
 * - Wave event subscriptions (start, progress, complete, error)
 * - Reconnection with state catch-up from GET /api/v1/quick-test/{runId}
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocketStore } from '../stores/socketStore';
import { useAuthStore } from '../stores/authStore';
import { getInitialWaveStates, type WaveState as BaseWaveState, type WaveStep as BaseWaveStep } from '../constants/waves';

// ============================================================
// Types
// Feature #612: Base types imported from constants/waves.ts
// ============================================================

export interface WaveStep extends Omit<BaseWaveStep, 'status'> {
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  duration?: number;
  result?: string;
}

export interface WaveState extends Omit<BaseWaveState, 'status' | 'steps'> {
  status: 'waiting' | 'running' | 'completed' | 'failed' | 'skipped';
  steps: WaveStep[];
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  data?: Record<string, unknown>;
  error?: string;
}

export interface QuickTestSummary {
  healthScore: number;
  performanceScore: number;
  securityScore: number;
  accessibilityScore?: number; // Feature #471
  apiScore?: number; // Feature #472
  seoScore?: number; // Feature #527
  overallScore: number;
}

export interface QuickTestState {
  runId: string | null;
  url: string | null;
  status: 'idle' | 'running' | 'completed' | 'failed';
  waves: WaveState[];
  summary: QuickTestSummary | null;
  startedAt: Date | null;
  completedAt: Date | null;
}

// Feature #612: Wave definitions centralized to constants/waves.ts
// getInitialWaveStates() imported from constants/waves

// ============================================================
// Hook
// ============================================================

export function useQuickTestSocket() {
  const { socket, isConnected } = useSocketStore();
  const { token } = useAuthStore();

  // Track the current run ID
  const currentRunIdRef = useRef<string | null>(null);

  // State - Feature #612: Use centralized getInitialWaveStates()
  const [state, setState] = useState<QuickTestState>({
    runId: null,
    url: null,
    status: 'idle',
    waves: getInitialWaveStates() as WaveState[],
    summary: null,
    startedAt: null,
    completedAt: null,
  });

  // Reset state to initial
  const reset = useCallback(() => {
    setState({
      runId: null,
      url: null,
      status: 'idle',
      waves: getInitialWaveStates() as WaveState[],
      summary: null,
      startedAt: null,
      completedAt: null,
    });
    currentRunIdRef.current = null;
  }, []);

  // Join quick-test room
  const joinRoom = useCallback((runId: string) => {
    if (socket && isConnected) {
      socket.emit('join-quick-test', runId);
      currentRunIdRef.current = runId;
    }
  }, [socket, isConnected]);

  // Leave quick-test room
  const leaveRoom = useCallback((runId: string) => {
    if (socket && isConnected) {
      socket.emit('leave-quick-test', runId);
    }
    if (currentRunIdRef.current === runId) {
      currentRunIdRef.current = null;
    }
  }, [socket, isConnected]);

  // Start a new quick test
  // Feature #579: Added browser parameter for cross-browser testing
  const startTest = useCallback(async (url: string, browser: 'chromium' | 'firefox' | 'webkit' = 'chromium'): Promise<{ runId: string } | { error: string }> => {
    // Reset state
    reset();

    try {
      const response = await fetch('/api/v1/quick-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url, browser }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return { error: errorData.message || 'Failed to start test' };
      }

      const data = await response.json();
      const runId = data.runId;

      // Update state
      setState(prev => ({
        ...prev,
        runId,
        url,
        status: 'running',
        startedAt: new Date(),
      }));

      // Join the room for real-time updates
      joinRoom(runId);

      return { runId };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start test';
      return { error: message };
    }
  }, [token, reset, joinRoom]);

  // Fetch current state (for reconnection catch-up)
  const fetchState = useCallback(async (runId: string) => {
    try {
      const response = await fetch(`/api/v1/quick-test/${runId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data;
    } catch {
      return null;
    }
  }, [token]);

  // Feature #542: Load a completed test result for re-viewing history
  const loadResult = useCallback(async (runId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/v1/quick-test/${runId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) return false;

      const data = await response.json();

      // Map the API waves into our WaveState format
      // Feature #612: Use centralized getInitialWaveStates()
      const initialWaves = getInitialWaveStates();
      const apiWaves: WaveState[] = initialWaves.map((initialWave, idx) => {
        const apiWave = data.waves?.[idx];
        if (!apiWave) return { ...initialWave, steps: initialWave.steps.map(s => ({ ...s })) } as WaveState;
        return {
          ...initialWave,
          status: apiWave.status || initialWave.status,
          startedAt: apiWave.startedAt ? new Date(apiWave.startedAt) : undefined,
          completedAt: apiWave.completedAt ? new Date(apiWave.completedAt) : undefined,
          duration: apiWave.duration,
          data: apiWave.data,
          error: apiWave.error,
          steps: apiWave.steps || initialWave.steps.map((s) => ({
            ...s,
            status: apiWave.status === 'completed' ? 'completed' as const :
                    apiWave.status === 'failed' ? 'failed' as const :
                    apiWave.status === 'skipped' ? 'skipped' as const : s.status,
          })),
        } as WaveState;
      });

      setState({
        runId: data.runId,
        url: data.url,
        status: data.status || 'completed',
        waves: apiWaves,
        summary: data.summary || null,
        startedAt: data.startedAt ? new Date(data.startedAt) : null,
        completedAt: data.completedAt ? new Date(data.completedAt) : null,
      });

      currentRunIdRef.current = null; // Don't join socket room for historical result

      return true;
    } catch {
      return false;
    }
  }, [token]);

  // Handle reconnection
  useEffect(() => {
    if (!isConnected || !currentRunIdRef.current) return;

    // Re-join room on reconnect
    const runId = currentRunIdRef.current;
    socket?.emit('join-quick-test', runId);

    // Fetch current state to catch up on missed events
    fetchState(runId).then(data => {
      if (data) {
        setState(prev => ({
          ...prev,
          status: data.status,
          waves: data.waves || prev.waves,
          summary: data.summary || prev.summary,
          completedAt: data.completedAt ? new Date(data.completedAt) : prev.completedAt,
        }));
      }
    });
  }, [isConnected, socket, fetchState]);

  // Feature #fix: Fallback polling when WebSocket is disconnected during a running test
  // Fetches wave states every 5s so the UI stays updated even without WS
  useEffect(() => {
    if (isConnected || !currentRunIdRef.current) return;
    if (state.status !== 'running') return;

    const runId = currentRunIdRef.current;
    const fallbackPoll = setInterval(async () => {
      const data = await fetchState(runId);
      if (data) {
        // Update wave states from API
        const initialWaves = getInitialWaveStates();
        const apiWaves: WaveState[] = initialWaves.map((initialWave, idx) => {
          const apiWave = data.waves?.[idx];
          if (!apiWave) return { ...initialWave, steps: initialWave.steps.map((s: BaseWaveStep) => ({ ...s })) } as WaveState;
          return {
            ...initialWave,
            status: apiWave.status || initialWave.status,
            startedAt: apiWave.startedAt ? new Date(apiWave.startedAt) : undefined,
            completedAt: apiWave.completedAt ? new Date(apiWave.completedAt) : undefined,
            duration: apiWave.duration,
            data: apiWave.data,
            error: apiWave.error,
            steps: apiWave.steps || initialWave.steps.map((s: BaseWaveStep) => ({
              ...s,
              status: apiWave.status === 'completed' ? 'completed' as const :
                      apiWave.status === 'failed' ? 'failed' as const :
                      apiWave.status === 'skipped' ? 'skipped' as const : s.status,
            })),
          } as WaveState;
        });

        setState(prev => ({
          ...prev,
          status: data.status || prev.status,
          waves: apiWaves,
          summary: data.summary || prev.summary,
          completedAt: data.completedAt ? new Date(data.completedAt) : prev.completedAt,
        }));
      }
    }, 5000);

    return () => clearInterval(fallbackPoll);
  }, [isConnected, state.status, fetchState]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    // Wave started
    const handleWaveStart = (data: { runId: string; wave: number; name: string }) => {
      if (data.runId !== currentRunIdRef.current) return;

      setState(prev => ({
        ...prev,
        waves: prev.waves.map(w =>
          w.wave === data.wave
            ? { ...w, status: 'running', startedAt: new Date() }
            : w
        ),
      }));
    };

    // Wave progress
    const handleWaveProgress = (data: { runId: string; wave: number; step?: string; status?: string; progress?: number }) => {
      if (data.runId !== currentRunIdRef.current) return;

      setState(prev => ({
        ...prev,
        waves: prev.waves.map(w => {
          if (w.wave !== data.wave) return w;

          // If step is provided, update that specific step
          if (data.step) {
            return {
              ...w,
              steps: w.steps.map(s =>
                s.name === data.step
                  ? { ...s, status: (data.status as WaveStep['status']) || 'running' }
                  : s
              ),
            };
          }

          return w;
        }),
      }));
    };

    // Wave completed (or skipped)
    const handleWaveComplete = (data: { runId: string; wave: number; data?: Record<string, unknown>; completedAt?: string }) => {
      if (data.runId !== currentRunIdRef.current) return;

      // Feature #520: Check if wave was skipped (e.g., AI provider not configured)
      const isSkipped = data.data?.skipped === true;
      const waveStatus = isSkipped ? 'skipped' as const : 'completed' as const;

      setState(prev => ({
        ...prev,
        waves: prev.waves.map(w =>
          w.wave === data.wave
            ? {
                ...w,
                status: waveStatus,
                completedAt: data.completedAt ? new Date(data.completedAt) : new Date(),
                duration: w.startedAt ? Date.now() - w.startedAt.getTime() : undefined,
                data: data.data,
                error: isSkipped ? (data.data?.summary as string) || 'Skipped' : w.error,
                steps: (w.steps || []).map(s => ({ ...s, status: waveStatus })),
              }
            : w
        ),
      }));
    };

    // Wave error
    const handleWaveError = (data: { runId: string; wave: number; error: string }) => {
      if (data.runId !== currentRunIdRef.current) return;

      setState(prev => ({
        ...prev,
        waves: prev.waves.map(w =>
          w.wave === data.wave
            ? { ...w, status: 'failed', error: data.error }
            : w
        ),
      }));
    };

    // Quick test completed
    const handleComplete = (data: { runId: string; summary?: QuickTestSummary; completedAt?: string }) => {
      if (data.runId !== currentRunIdRef.current) return;

      setState(prev => ({
        ...prev,
        status: 'completed',
        summary: data.summary || prev.summary,
        completedAt: data.completedAt ? new Date(data.completedAt) : new Date(),
      }));
    };

    // Quick test error
    const handleError = (data: { runId: string; error: string }) => {
      if (data.runId !== currentRunIdRef.current) return;

      setState(prev => ({
        ...prev,
        status: 'failed',
      }));
    };

    // Subscribe to events
    socket.on('wave:start', handleWaveStart);
    socket.on('wave:progress', handleWaveProgress);
    socket.on('wave:complete', handleWaveComplete);
    socket.on('wave:error', handleWaveError);
    socket.on('quick-test:complete', handleComplete);
    socket.on('quick-test:error', handleError);

    return () => {
      socket.off('wave:start', handleWaveStart);
      socket.off('wave:progress', handleWaveProgress);
      socket.off('wave:complete', handleWaveComplete);
      socket.off('wave:error', handleWaveError);
      socket.off('quick-test:complete', handleComplete);
      socket.off('quick-test:error', handleError);
    };
  }, [socket]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (currentRunIdRef.current && socket) {
        socket.emit('leave-quick-test', currentRunIdRef.current);
      }
    };
  }, [socket]);

  return {
    ...state,
    isConnected,
    startTest,
    reset,
    joinRoom,
    leaveRoom,
    fetchState,
    loadResult, // Feature #542: Load historical result for re-viewing
  };
}

export default useQuickTestSocket;
