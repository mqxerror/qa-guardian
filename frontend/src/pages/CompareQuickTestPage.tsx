/**
 * Compare Quick Test Page
 * Feature #473: Side-by-side URL comparison (staging vs production)
 *
 * Features:
 * - Dual URL inputs for A/B comparison
 * - Parallel test execution with real-time updates
 * - Side-by-side wave cards with score deltas
 * - Color-coded differences (green = A is better, red = B is better)
 * - Screenshot comparison with visual diff overlay option
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useSocketStore } from '../stores/socketStore';
import { useAuthStore } from '../stores/authStore';
import { getInitialWaveStates, WAVE_DEFINITIONS } from '../constants/waves';
import {
  PageHeader,
  AnimatedCard,
  CardContent,
} from '../components/ui';
import {
  // Zap, // Unused
  Globe,
  Shield,
  Gauge,
  Brain,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  ChevronDown,
  ChevronUp,
  ArrowLeftRight,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  Accessibility,
  Network,
  ArrowLeft,
} from 'lucide-react';

// ============================================================
// Types
// ============================================================

interface WaveStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  duration?: number;
}

interface WaveState {
  wave: number;
  name: string;
  status: 'waiting' | 'running' | 'completed' | 'failed';
  steps: WaveStep[];
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  data?: Record<string, unknown>;
  error?: string;
}

interface QuickTestSummary {
  healthScore: number;
  performanceScore: number;
  securityScore: number;
  accessibilityScore?: number;
  apiScore?: number;
  overallScore: number;
}

interface CompareState {
  compareId: string | null;
  runIdA: string | null;
  runIdB: string | null;
  urlA: string;
  urlB: string;
  statusA: 'idle' | 'running' | 'completed' | 'failed';
  statusB: 'idle' | 'running' | 'completed' | 'failed';
  wavesA: WaveState[];
  wavesB: WaveState[];
  summaryA: QuickTestSummary | null;
  summaryB: QuickTestSummary | null;
  startedAt: Date | null;
}

interface ScoreDelta {
  health: number;
  performance: number;
  security: number;
  accessibility: number;
  api: number;
  overall: number;
}

// ============================================================
// Constants - Feature #612: Centralized to constants/waves.ts
// ============================================================

// Build WAVE_ICONS from centralized WAVE_DEFINITIONS
const WAVE_ICONS: Record<number, React.ElementType> = Object.fromEntries(
  WAVE_DEFINITIONS.map(def => [def.wave, def.icon])
);

// ============================================================
// Helper Functions
// ============================================================

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-success';
  if (score >= 60) return 'text-warning';
  return 'text-destructive';
}

function getDeltaColor(delta: number): string {
  if (delta > 0) return 'text-success';
  if (delta < 0) return 'text-destructive';
  return 'text-muted-foreground';
}

function getDeltaIcon(delta: number) {
  if (delta > 0) return <TrendingUp className="w-4 h-4" />;
  if (delta < 0) return <TrendingDown className="w-4 h-4" />;
  return <Minus className="w-4 h-4" />;
}

// Feature #612: Use centralized getInitialWaveStates() for fresh wave array
function cloneWaves(): WaveState[] {
  return getInitialWaveStates() as WaveState[];
}

// ============================================================
// Wave Comparison Card Component
// ============================================================

interface WaveCompareCardProps {
  waveA: WaveState;
  waveB: WaveState;
  waveNumber: number;
}

function WaveCompareCard({ waveA, waveB, waveNumber }: WaveCompareCardProps) {
  const [expanded, setExpanded] = useState(false);
  const Icon = WAVE_ICONS[waveNumber] || Globe;

  const getStatusIcon = (status: WaveState['status']) => {
    switch (status) {
      case 'waiting':
        return <Clock className="w-4 h-4 text-muted-foreground" />;
      case 'running':
        return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-success" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-destructive" />;
    }
  };

  const getStatusBorder = (status: WaveState['status']) => {
    switch (status) {
      case 'waiting':
        return 'border-muted';
      case 'running':
        return 'border-primary';
      case 'completed':
        return 'border-success';
      case 'failed':
        return 'border-destructive';
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 flex items-center justify-between bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-primary" />
          <span className="font-medium">{waveA.name}</span>
        </div>
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Side-by-side comparison */}
      <div className="grid grid-cols-2 divide-x divide-border">
        {/* URL A Side */}
        <div className={`p-3 border-l-4 ${getStatusBorder(waveA.status)}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">URL A</span>
            {getStatusIcon(waveA.status)}
          </div>
          <div className="text-sm">
            {waveA.status === 'completed' && waveA.duration && (
              <span className="text-muted-foreground">{waveA.duration}ms</span>
            )}
            {waveA.status === 'running' && <span className="text-primary">Running...</span>}
            {waveA.status === 'waiting' && <span className="text-muted-foreground">Waiting</span>}
            {waveA.status === 'failed' && <span className="text-destructive">Failed</span>}
          </div>
        </div>

        {/* URL B Side */}
        <div className={`p-3 border-l-4 ${getStatusBorder(waveB.status)}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">URL B</span>
            {getStatusIcon(waveB.status)}
          </div>
          <div className="text-sm">
            {waveB.status === 'completed' && waveB.duration && (
              <span className="text-muted-foreground">{waveB.duration}ms</span>
            )}
            {waveB.status === 'running' && <span className="text-primary">Running...</span>}
            {waveB.status === 'waiting' && <span className="text-muted-foreground">Waiting</span>}
            {waveB.status === 'failed' && <span className="text-destructive">Failed</span>}
          </div>
        </div>
      </div>

      {/* Expanded Steps */}
      {expanded && (
        <div className="border-t border-border p-3 bg-background/50">
          <div className="grid grid-cols-2 gap-4">
            {/* URL A Steps */}
            <div className="space-y-1">
              {waveA.steps.map((step, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm py-1">
                  <span className="text-muted-foreground">{step.name}</span>
                  {step.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 text-success" />}
                  {step.status === 'running' && <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />}
                  {step.status === 'pending' && <Clock className="w-3.5 h-3.5 text-muted-foreground" />}
                  {step.status === 'failed' && <XCircle className="w-3.5 h-3.5 text-destructive" />}
                </div>
              ))}
            </div>
            {/* URL B Steps */}
            <div className="space-y-1">
              {waveB.steps.map((step, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm py-1">
                  <span className="text-muted-foreground">{step.name}</span>
                  {step.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 text-success" />}
                  {step.status === 'running' && <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />}
                  {step.status === 'pending' && <Clock className="w-3.5 h-3.5 text-muted-foreground" />}
                  {step.status === 'failed' && <XCircle className="w-3.5 h-3.5 text-destructive" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Score Comparison Panel
// ============================================================

interface ScoreComparisonProps {
  summaryA: QuickTestSummary | null;
  summaryB: QuickTestSummary | null;
  labelA: string;
  labelB: string;
}

function ScoreComparison({ summaryA, summaryB, labelA, labelB }: ScoreComparisonProps) {
  if (!summaryA || !summaryB) return null;

  const metrics = [
    { key: 'health', label: 'Health', scoreA: summaryA.healthScore, scoreB: summaryB.healthScore },
    { key: 'performance', label: 'Performance', scoreA: summaryA.performanceScore, scoreB: summaryB.performanceScore },
    { key: 'security', label: 'Security', scoreA: summaryA.securityScore, scoreB: summaryB.securityScore },
    { key: 'accessibility', label: 'Accessibility', scoreA: summaryA.accessibilityScore ?? 0, scoreB: summaryB.accessibilityScore ?? 0 },
    { key: 'api', label: 'API', scoreA: summaryA.apiScore ?? 0, scoreB: summaryB.apiScore ?? 0 },
    { key: 'overall', label: 'Overall', scoreA: summaryA.overallScore, scoreB: summaryB.overallScore },
  ];

  return (
    <AnimatedCard>
      <CardContent className="p-4">
        <h3 className="font-medium mb-4 flex items-center gap-2">
          <ArrowLeftRight className="w-4 h-4" />
          Score Comparison
        </h3>
        <div className="space-y-3">
          {/* Header */}
          <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground font-medium border-b border-border pb-2">
            <div>Metric</div>
            <div className="text-center">{labelA}</div>
            <div className="text-center">{labelB}</div>
            <div className="text-center">Delta</div>
          </div>
          {/* Rows */}
          {metrics.map(({ key, label, scoreA, scoreB }) => {
            const delta = scoreA - scoreB;
            return (
              <div key={key} className="grid grid-cols-4 gap-2 items-center">
                <div className="text-sm font-medium">{label}</div>
                <div className={`text-center text-lg font-bold ${getScoreColor(scoreA)}`}>
                  {scoreA}
                </div>
                <div className={`text-center text-lg font-bold ${getScoreColor(scoreB)}`}>
                  {scoreB}
                </div>
                <div className={`flex items-center justify-center gap-1 ${getDeltaColor(delta)}`}>
                  {getDeltaIcon(delta)}
                  <span className="font-medium">{delta > 0 ? '+' : ''}{delta}</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </AnimatedCard>
  );
}

// ============================================================
// Main Page Component
// ============================================================

export function CompareQuickTestPage() {
  const { socket, isConnected } = useSocketStore();
  const { token } = useAuthStore();

  // Form state
  const [urlA, setUrlA] = useState('');
  const [urlB, setUrlB] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  // Comparison state
  const [state, setState] = useState<CompareState>({
    compareId: null,
    runIdA: null,
    runIdB: null,
    urlA: '',
    urlB: '',
    statusA: 'idle',
    statusB: 'idle',
    wavesA: cloneWaves(),
    wavesB: cloneWaves(),
    summaryA: null,
    summaryB: null,
    startedAt: null,
  });

  // Refs for tracking run IDs
  const runIdARef = useRef<string | null>(null);
  const runIdBRef = useRef<string | null>(null);

  // Start comparison
  const startComparison = useCallback(async () => {
    // Validate
    if (!urlA || !urlB) {
      setError('Both URLs are required');
      return;
    }
    if (!isValidUrl(urlA)) {
      setError('URL A is invalid. Include http:// or https://');
      return;
    }
    if (!isValidUrl(urlB)) {
      setError('URL B is invalid. Include http:// or https://');
      return;
    }

    setError(null);
    setIsStarting(true);

    try {
      const response = await fetch('/api/v1/quick-test/compare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ urlA, urlB }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to start comparison');
        setIsStarting(false);
        return;
      }

      const data = await response.json();

      // Update refs
      runIdARef.current = data.runIdA;
      runIdBRef.current = data.runIdB;

      // Join both rooms
      if (socket && isConnected) {
        socket.emit('join-quick-test', data.runIdA);
        socket.emit('join-quick-test', data.runIdB);
      }

      // Update state
      setState({
        compareId: data.compareId,
        runIdA: data.runIdA,
        runIdB: data.runIdB,
        urlA,
        urlB,
        statusA: 'running',
        statusB: 'running',
        wavesA: cloneWaves(),
        wavesB: cloneWaves(),
        summaryA: null,
        summaryB: null,
        startedAt: new Date(),
      });

      setIsStarting(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start comparison');
      setIsStarting(false);
    }
  }, [urlA, urlB, token, socket, isConnected]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    // Wave started
    const handleWaveStart = (data: { runId: string; wave: number }) => {
      const isA = data.runId === runIdARef.current;
      const isB = data.runId === runIdBRef.current;
      if (!isA && !isB) return;

      setState(prev => ({
        ...prev,
        [isA ? 'wavesA' : 'wavesB']: (isA ? prev.wavesA : prev.wavesB).map(w =>
          w.wave === data.wave
            ? { ...w, status: 'running', startedAt: new Date() }
            : w
        ),
      }));
    };

    // Wave progress
    const handleWaveProgress = (data: { runId: string; wave: number; step?: string; status?: string }) => {
      const isA = data.runId === runIdARef.current;
      const isB = data.runId === runIdBRef.current;
      if (!isA && !isB) return;

      setState(prev => ({
        ...prev,
        [isA ? 'wavesA' : 'wavesB']: (isA ? prev.wavesA : prev.wavesB).map(w => {
          if (w.wave !== data.wave) return w;
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

    // Wave completed
    const handleWaveComplete = (data: { runId: string; wave: number; data?: Record<string, unknown> }) => {
      const isA = data.runId === runIdARef.current;
      const isB = data.runId === runIdBRef.current;
      if (!isA && !isB) return;

      setState(prev => ({
        ...prev,
        [isA ? 'wavesA' : 'wavesB']: (isA ? prev.wavesA : prev.wavesB).map(w =>
          w.wave === data.wave
            ? {
                ...w,
                status: 'completed',
                completedAt: new Date(),
                duration: w.startedAt ? Date.now() - w.startedAt.getTime() : undefined,
                data: data.data,
                steps: w.steps.map(s => ({ ...s, status: 'completed' as const })),
              }
            : w
        ),
      }));
    };

    // Wave error
    const handleWaveError = (data: { runId: string; wave: number; error: string }) => {
      const isA = data.runId === runIdARef.current;
      const isB = data.runId === runIdBRef.current;
      if (!isA && !isB) return;

      setState(prev => ({
        ...prev,
        [isA ? 'wavesA' : 'wavesB']: (isA ? prev.wavesA : prev.wavesB).map(w =>
          w.wave === data.wave
            ? { ...w, status: 'failed', error: data.error }
            : w
        ),
      }));
    };

    // Quick test completed
    const handleComplete = (data: { runId: string; summary?: QuickTestSummary }) => {
      const isA = data.runId === runIdARef.current;
      const isB = data.runId === runIdBRef.current;
      if (!isA && !isB) return;

      setState(prev => ({
        ...prev,
        [isA ? 'statusA' : 'statusB']: 'completed',
        [isA ? 'summaryA' : 'summaryB']: data.summary || null,
      }));
    };

    // Quick test error
    const handleError = (data: { runId: string }) => {
      const isA = data.runId === runIdARef.current;
      const isB = data.runId === runIdBRef.current;
      if (!isA && !isB) return;

      setState(prev => ({
        ...prev,
        [isA ? 'statusA' : 'statusB']: 'failed',
      }));
    };

    // Subscribe
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
      if (socket) {
        if (runIdARef.current) socket.emit('leave-quick-test', runIdARef.current);
        if (runIdBRef.current) socket.emit('leave-quick-test', runIdBRef.current);
      }
    };
  }, [socket]);

  const isRunning = state.statusA === 'running' || state.statusB === 'running';
  const isComplete = state.statusA === 'completed' && state.statusB === 'completed';

  return (
    <Layout>
      <div className="p-6 lg:p-8 space-y-8 max-w-6xl mx-auto">
        {/* Header */}
        <PageHeader
          title="Compare Quick Test"
          description="Side-by-side URL comparison (e.g., staging vs production)"
          breadcrumbs={[
            { label: 'Home', href: '/dashboard' },
            { label: 'Quick Test', href: '/quick-test' },
            { label: 'Compare' },
          ]}
        />

        {/* Back to Quick Test Link */}
        <Link
          to="/quick-test"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Quick Test
        </Link>

        {/* URL Inputs */}
        <AnimatedCard>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* URL A Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">A</span>
                  URL A (e.g., Staging)
                </label>
                <input
                  type="url"
                  value={urlA}
                  onChange={(e) => setUrlA(e.target.value)}
                  placeholder="https://staging.example.com"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={isRunning}
                />
              </div>

              {/* URL B Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-xs font-bold">B</span>
                  URL B (e.g., Production)
                </label>
                <input
                  type="url"
                  value={urlB}
                  onChange={(e) => setUrlB(e.target.value)}
                  placeholder="https://www.example.com"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={isRunning}
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mt-4 flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            {/* Compare Button */}
            <div className="mt-4 flex justify-center">
              <button
                onClick={startComparison}
                disabled={isStarting || isRunning || !urlA || !urlB}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isStarting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Starting...
                  </>
                ) : isRunning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <ArrowLeftRight className="w-4 h-4" />
                    Compare
                  </>
                )}
              </button>
            </div>
          </CardContent>
        </AnimatedCard>

        {/* URL Labels when running */}
        {state.compareId && (
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
              <div className="text-xs text-muted-foreground mb-1">URL A</div>
              <div className="text-sm font-medium truncate" title={state.urlA}>{state.urlA}</div>
            </div>
            <div className="p-2 rounded-lg bg-secondary/50 border border-border">
              <div className="text-xs text-muted-foreground mb-1">URL B</div>
              <div className="text-sm font-medium truncate" title={state.urlB}>{state.urlB}</div>
            </div>
          </div>
        )}

        {/* Wave Comparison Cards */}
        {state.compareId && (
          <div className="space-y-4">
            {state.wavesA.map((waveA, idx) => (
              <WaveCompareCard
                key={waveA.wave}
                waveA={waveA}
                waveB={state.wavesB[idx]}
                waveNumber={waveA.wave}
              />
            ))}
          </div>
        )}

        {/* Score Comparison (when both complete) */}
        {isComplete && (
          <ScoreComparison
            summaryA={state.summaryA}
            summaryB={state.summaryB}
            labelA="URL A"
            labelB="URL B"
          />
        )}
      </div>
    </Layout>
  );
}

export default CompareQuickTestPage;
