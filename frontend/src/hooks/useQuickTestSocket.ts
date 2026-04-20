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
// Merge helpers
// ============================================================

// Status ordering for monotonic transitions. A wave can only advance in this
// order; a late/retransmitted event or stale poll response must never regress
// it. Shared by polling paths and socket handlers.
const STATUS_RANK: Record<string, number> = {
  pending: 0,
  waiting: 0,
  running: 1,
  completed: 2,
  failed: 2,
  skipped: 2,
};

type ApiWave = {
  wave?: number;
  status?: string;
  startedAt?: string | Date;
  completedAt?: string | Date;
  duration?: number;
  data?: Record<string, unknown>;
  error?: string;
  steps?: WaveStep[];
};

// Layer API response onto the 7-wave scaffold, preserving any in-memory wave
// that is already ahead (e.g., socket event already advanced it to 'completed').
// This is the single source of truth for reconciling poll data with socket state.
function mergeApiWavesOntoState(prevWaves: WaveState[], apiWaves: ApiWave[] | undefined): WaveState[] {
  const scaffold = getInitialWaveStates();
  return scaffold.map((initial, idx) => {
    const apiWave = apiWaves?.[idx];
    const prevWave = prevWaves[idx] as WaveState | undefined;

    if (!apiWave) {
      return prevWave ?? ({ ...initial, steps: initial.steps.map(s => ({ ...s })) } as WaveState);
    }

    const apiRank = STATUS_RANK[apiWave.status ?? ''] ?? 0;
    const prevRank = STATUS_RANK[prevWave?.status ?? ''] ?? 0;
    // Monotonic guard: if socket already advanced this wave, keep the newer state
    if (prevWave && prevRank > apiRank) return prevWave;

    return {
      ...initial,
      status: (apiWave.status as WaveState['status']) || initial.status,
      startedAt: apiWave.startedAt ? new Date(apiWave.startedAt) : prevWave?.startedAt,
      completedAt: apiWave.completedAt ? new Date(apiWave.completedAt) : prevWave?.completedAt,
      duration: apiWave.duration ?? prevWave?.duration,
      data: apiWave.data ?? prevWave?.data,
      error: apiWave.error ?? prevWave?.error,
      steps: apiWave.steps || prevWave?.steps || initial.steps.map((s: BaseWaveStep) => ({
        ...s,
        status: apiWave.status === 'completed' ? ('completed' as const) :
                apiWave.status === 'failed' ? ('failed' as const) :
                apiWave.status === 'skipped' ? ('skipped' as const) : s.status,
      })),
    } as WaveState;
  });
}

// ============================================================
// Hook
// ============================================================

export function useQuickTestSocket() {
  const { socket, isConnected } = useSocketStore();
  const { token } = useAuthStore();

  // Track the current run ID
  const currentRunIdRef = useRef<string | null>(null);

  // Track whether we've already joined the room to avoid redundant re-fetches
  // on brief disconnect/reconnect cycles
  const hasJoinedRef = useRef(false);

  // Track when the socket last disconnected, so we can distinguish brief blips
  // from extended outages that require a state catch-up fetch
  const disconnectedAtRef = useRef<number | null>(null);
  const EXTENDED_DISCONNECT_THRESHOLD_MS = 30_000;

  // Track the last applied poll signature so we can skip setState when nothing
  // has changed. Without this, polling every 3-5s causes React re-renders that
  // make wave cards visually "blink" even when data is identical.
  const lastPolledSignatureRef = useRef<string>('');

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
    hasJoinedRef.current = false;
    disconnectedAtRef.current = null;
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

  // Fetch current state (for reconnection catch-up and race condition recovery)
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

      // Fix: Catch up on any events missed during the race window between
      // POST response and room join. The worker starts emitting events
      // immediately, but the room may not be joined yet.
      setTimeout(() => {
        fetchState(runId).then(data => {
          if (data) {
            setState(prev => ({
              ...prev,
              status: data.status || prev.status,
              waves: mergeApiWavesOntoState(prev.waves, data.waves),
              summary: data.summary || prev.summary,
              completedAt: data.completedAt ? new Date(data.completedAt) : prev.completedAt,
            }));
          }
        });
      }, 500);

      return { runId };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start test';
      return { error: message };
    }
  }, [token, reset, joinRoom, fetchState]);

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

  // Track disconnection timestamp for extended-disconnect detection
  useEffect(() => {
    if (!isConnected) {
      // Record when we disconnected (only if not already recorded)
      if (disconnectedAtRef.current === null) {
        disconnectedAtRef.current = Date.now();
      }
    }
  }, [isConnected]);

  // Handle reconnection: re-join room and optionally catch up on missed events
  useEffect(() => {
    if (!isConnected || !currentRunIdRef.current) return;

    const runId = currentRunIdRef.current;

    // Always re-join the room on reconnect (server may have dropped the subscription)
    socket?.emit('join-quick-test', runId);

    // Only fetch state for catch-up if this is the initial join or after an
    // extended disconnection (>30s). Brief reconnects don't need a full re-fetch
    // because the socket events will fill in any small gaps.
    const wasExtendedDisconnect =
      disconnectedAtRef.current !== null &&
      (Date.now() - disconnectedAtRef.current) > EXTENDED_DISCONNECT_THRESHOLD_MS;

    if (!hasJoinedRef.current || wasExtendedDisconnect) {
      hasJoinedRef.current = true;

      fetchState(runId).then(data => {
        if (data) {
          setState(prev => ({
            ...prev,
            status: data.status,
            waves: mergeApiWavesOntoState(prev.waves, data.waves),
            summary: data.summary || prev.summary,
            completedAt: data.completedAt ? new Date(data.completedAt) : prev.completedAt,
          }));
        }
      });
    }

    // Clear disconnection timestamp now that we're reconnected
    disconnectedAtRef.current = null;
  }, [isConnected, socket, fetchState]);

  // Feature #fix: Fallback polling when WebSocket is disconnected during a running test
  // Fetches wave states every 5s so the UI stays updated even without WS
  useEffect(() => {
    if (isConnected || !currentRunIdRef.current) return;
    if (state.status !== 'running') return;

    const runId = currentRunIdRef.current;
    const fallbackPoll = setInterval(async () => {
      const data = await fetchState(runId);
      if (!data) return;

      setState(prev => {
        const merged = mergeApiWavesOntoState(prev.waves, data.waves);

        // Skip setState when nothing meaningful has changed — avoids unnecessary
        // re-renders that make wave cards flicker on every poll interval.
        const sig = `${data.status}|${merged.map(w => `${w.wave}:${w.status}`).join(',')}`;
        if (sig === lastPolledSignatureRef.current) return prev;
        lastPolledSignatureRef.current = sig;

        return {
          ...prev,
          status: data.status || prev.status,
          waves: merged,
          summary: data.summary || prev.summary,
          completedAt: data.completedAt ? new Date(data.completedAt) : prev.completedAt,
        };
      });
    }, 5000);

    return () => clearInterval(fallbackPoll);
  }, [isConnected, state.status, fetchState]);

  // Fix: Belt-and-suspenders polling while WebSocket IS connected during a running test.
  // Socket.IO events provide instant updates; this catches any events silently dropped
  // by Redis Pub/Sub or missed during brief reconnection windows.
  useEffect(() => {
    if (!isConnected || !currentRunIdRef.current) return;
    if (state.status !== 'running') return;

    const runId = currentRunIdRef.current;
    const interval = setInterval(() => {
      fetchState(runId).then(data => {
        if (!data) return;

        // CRITICAL: merge onto scaffold, do NOT replace. Socket events may have
        // already advanced waves locally while the DB hasn't persisted yet —
        // replacing with DB state would regress the UI (prior "only SEO" bug).
        setState(prev => {
          const merged = mergeApiWavesOntoState(prev.waves, data.waves);

          // Build signature from the merged 7-wave array (not data.waves, which
          // may be shorter/partial). This prevents signature churn when DB
          // responses grow between polls, which otherwise triggers identical-data
          // re-renders that look like blinking.
          const sig = `${data.status}|${merged.map(w => `${w.wave}:${w.status}`).join(',')}`;
          if (sig === lastPolledSignatureRef.current) return prev;
          lastPolledSignatureRef.current = sig;

          return {
            ...prev,
            status: data.status || prev.status,
            waves: merged,
            summary: data.summary || prev.summary,
            completedAt: data.completedAt ? new Date(data.completedAt) : prev.completedAt,
          };
        });
      });
    }, 10000);  // A4: 10s is a safety net; socket events are the primary path

    return () => clearInterval(interval);
  }, [isConnected, state.status, fetchState]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    // Wave started
    const handleWaveStart = (data: { runId: string; wave: number; name: string }) => {
      if (data.runId !== currentRunIdRef.current) return;

      setState(prev => ({
        ...prev,
        waves: prev.waves.map(w => {
          if (w.wave !== data.wave) return w;
          // A5: monotonic guard — don't regress a wave that's already completed/failed/skipped
          if ((STATUS_RANK[w.status] ?? 0) > (STATUS_RANK['running'] ?? 0)) return w;
          return { ...w, status: 'running', startedAt: w.startedAt ?? new Date() };
        }),
      }));
    };

    // Wave progress
    const handleWaveProgress = (data: { runId: string; wave: number; step?: string; status?: string; progress?: number }) => {
      if (data.runId !== currentRunIdRef.current) return;

      setState(prev => ({
        ...prev,
        waves: prev.waves.map(w => {
          if (w.wave !== data.wave) return w;
          // A5: don't accept progress for a wave already completed/failed/skipped
          if ((STATUS_RANK[w.status] ?? 0) > (STATUS_RANK['running'] ?? 0)) return w;

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
    const handleWaveComplete = (data: { runId: string; wave: number; duration?: number; data?: Record<string, unknown>; completedAt?: string }) => {
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
                // Prefer server-provided duration (authoritative); fall back to client calc if startedAt exists
                duration: data.duration ?? (w.startedAt ? Date.now() - w.startedAt.getTime() : undefined),
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
