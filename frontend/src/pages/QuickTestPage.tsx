/**
 * Quick Test Page
 * Feature #425: Flagship instant QA feature - paste a URL and watch 4 waves of tests run live
 *
 * Features:
 * - URL input with validation
 * - 2x2 wave progress grid with real-time updates
 * - Animated step progression
 * - Overall score display
 * - History panel
 * - Export/save actions
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Layout } from '../components/Layout';
import { useAuthStore } from '../stores/authStore';
import { useSocketStore } from '../stores/socketStore';
import {
  PageHeader,
  AnimatedCard,
  CardContent,
} from '../components/ui';
import {
  Zap,
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
  ExternalLink,
  History,
  Save,
  Download,
  AlertCircle,
} from 'lucide-react';

// ============================================================
// Types
// ============================================================

interface WaveStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  duration?: number;
  result?: string;
}

interface WaveData {
  wave: number;
  name: string;
  icon: React.ElementType;
  status: 'waiting' | 'running' | 'completed' | 'failed';
  steps: WaveStep[];
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  data?: Record<string, unknown>;
  error?: string;
  expanded: boolean;
}

interface QuickTestResult {
  runId: string;
  url: string;
  timestamp: Date;
  status: 'running' | 'completed' | 'failed';
  summary?: {
    healthScore: number;
    performanceScore: number;
    securityScore: number;
    overallScore: number;
  };
}

interface HistoryEntry {
  runId: string;
  url: string;
  timestamp: Date;
  score?: number;
}

// ============================================================
// Constants
// ============================================================

const WAVE_DEFINITIONS = [
  {
    wave: 1,
    name: 'Health Check',
    icon: Globe,
    steps: [
      { name: 'DNS Resolution', status: 'pending' as const },
      { name: 'HTTP Request', status: 'pending' as const },
      { name: 'SSL Certificate', status: 'pending' as const },
      { name: 'Response Time', status: 'pending' as const },
    ],
  },
  {
    wave: 2,
    name: 'Visual + Performance',
    icon: Gauge,
    steps: [
      { name: 'Desktop Screenshot', status: 'pending' as const },
      { name: 'Mobile Screenshot', status: 'pending' as const },
      { name: 'Core Web Vitals', status: 'pending' as const },
      { name: 'Performance Score', status: 'pending' as const },
    ],
  },
  {
    wave: 3,
    name: 'Security Scan',
    icon: Shield,
    steps: [
      { name: 'Security Headers', status: 'pending' as const },
      { name: 'Cookie Audit', status: 'pending' as const },
      { name: 'Mixed Content', status: 'pending' as const },
      { name: 'Exposed Paths', status: 'pending' as const },
    ],
  },
  {
    wave: 4,
    name: 'AI Analysis',
    icon: Brain,
    steps: [
      { name: 'Test Suggestions', status: 'pending' as const },
      { name: 'UX Issues', status: 'pending' as const },
      { name: 'Accessibility', status: 'pending' as const },
      { name: 'Summary', status: 'pending' as const },
    ],
  },
];

const RECENT_URLS_KEY = 'qa-guardian-quick-test-urls';
const MAX_RECENT_URLS = 5;
const HISTORY_KEY = 'qa-guardian-quick-test-history';
const MAX_HISTORY = 10;

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

function getScoreBgColor(score: number): string {
  if (score >= 80) return 'bg-success/20';
  if (score >= 60) return 'bg-warning/20';
  return 'bg-destructive/20';
}

// ============================================================
// Wave Card Component
// ============================================================

interface WaveCardProps {
  wave: WaveData;
  onToggleExpand: () => void;
}

function WaveCard({ wave, onToggleExpand }: WaveCardProps) {
  const Icon = wave.icon;

  const getStatusStyles = () => {
    switch (wave.status) {
      case 'waiting':
        return 'border-muted bg-muted/10';
      case 'running':
        return 'border-primary bg-primary/10 animate-pulse';
      case 'completed':
        return 'border-success bg-success/10';
      case 'failed':
        return 'border-destructive bg-destructive/10';
      default:
        return 'border-muted bg-muted/10';
    }
  };

  const getStatusIcon = () => {
    switch (wave.status) {
      case 'waiting':
        return <Clock className="w-4 h-4 text-muted-foreground" />;
      case 'running':
        return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-success" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-destructive" />;
      default:
        return null;
    }
  };

  return (
    <div
      className={`rounded-lg border-2 transition-all duration-300 ${getStatusStyles()}`}
    >
      {/* Header */}
      <button
        onClick={onToggleExpand}
        className="w-full p-4 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${wave.status === 'running' ? 'bg-primary/20' : 'bg-muted'}`}>
            <Icon className={`w-5 h-5 ${wave.status === 'running' ? 'text-primary' : 'text-muted-foreground'}`} />
          </div>
          <div>
            <h3 className="font-medium text-foreground">{wave.name}</h3>
            <p className="text-xs text-muted-foreground">
              {wave.status === 'waiting' && 'Waiting...'}
              {wave.status === 'running' && 'In progress...'}
              {wave.status === 'completed' && `Completed in ${wave.duration || 0}ms`}
              {wave.status === 'failed' && 'Failed'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          {wave.expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {wave.expanded && (
        <div className="px-4 pb-4 space-y-2">
          {wave.steps.map((step, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between py-1.5 px-2 rounded bg-background/50"
            >
              <span className="text-sm text-foreground">{step.name}</span>
              <div className="flex items-center gap-2">
                {step.duration && (
                  <span className="text-xs text-muted-foreground">{step.duration}ms</span>
                )}
                {step.status === 'pending' && (
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                )}
                {step.status === 'running' && (
                  <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                )}
                {step.status === 'completed' && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                )}
                {step.status === 'failed' && (
                  <XCircle className="w-3.5 h-3.5 text-destructive" />
                )}
              </div>
            </div>
          ))}
          {wave.error && (
            <div className="mt-2 p-2 rounded bg-destructive/10 text-destructive text-sm">
              {wave.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Score Display Component
// ============================================================

interface ScoreDisplayProps {
  summary: QuickTestResult['summary'];
}

function ScoreDisplay({ summary }: ScoreDisplayProps) {
  if (!summary) return null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[
        { label: 'Health', score: summary.healthScore },
        { label: 'Performance', score: summary.performanceScore },
        { label: 'Security', score: summary.securityScore },
        { label: 'Overall', score: summary.overallScore },
      ].map((item, idx) => (
        <div
          key={idx}
          className={`p-4 rounded-lg ${getScoreBgColor(item.score)} text-center`}
        >
          <div className={`text-3xl font-bold ${getScoreColor(item.score)}`}>
            {item.score}
          </div>
          <div className="text-sm text-muted-foreground mt-1">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

export function QuickTestPage() {
  const { token } = useAuthStore();
  const { socket, isConnected } = useSocketStore();

  // URL Input State
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [recentUrls, setRecentUrls] = useState<string[]>([]);
  const [showRecentUrls, setShowRecentUrls] = useState(false);

  // Test State
  const [isRunning, setIsRunning] = useState(false);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [waves, setWaves] = useState<WaveData[]>(() =>
    WAVE_DEFINITIONS.map(def => ({
      ...def,
      status: 'waiting' as const,
      steps: def.steps.map(s => ({ ...s })),
      expanded: false,
    }))
  );
  const [result, setResult] = useState<QuickTestResult | null>(null);

  // History State
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Refs
  const urlInputRef = useRef<HTMLInputElement>(null);

  // Load recent URLs and history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(RECENT_URLS_KEY);
      if (saved) {
        setRecentUrls(JSON.parse(saved));
      }
      const savedHistory = localStorage.getItem(HISTORY_KEY);
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory).map((h: HistoryEntry) => ({
          ...h,
          timestamp: new Date(h.timestamp),
        })));
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Socket event handlers
  useEffect(() => {
    if (!socket || !currentRunId) return;

    const handleWaveStart = (data: { wave: number; name: string }) => {
      setWaves(prev =>
        prev.map(w =>
          w.wave === data.wave
            ? { ...w, status: 'running', startedAt: new Date() }
            : w
        )
      );
    };

    const handleWaveComplete = (data: { wave: number; data: Record<string, unknown>; completedAt: Date }) => {
      setWaves(prev =>
        prev.map(w =>
          w.wave === data.wave
            ? {
                ...w,
                status: 'completed',
                completedAt: new Date(data.completedAt),
                duration: w.startedAt ? Date.now() - w.startedAt.getTime() : undefined,
                data: data.data,
                steps: w.steps.map(s => ({ ...s, status: 'completed' as const })),
              }
            : w
        )
      );
    };

    const handleWaveError = (data: { wave: number; error: string }) => {
      setWaves(prev =>
        prev.map(w =>
          w.wave === data.wave
            ? { ...w, status: 'failed', error: data.error }
            : w
        )
      );
    };

    const handleTestComplete = (data: { summary: QuickTestResult['summary'] }) => {
      setIsRunning(false);
      // Feature #442: Use functional update to avoid stale closure on 'result'
      setResult(prev => {
        if (!prev) return null;
        const updatedResult = { ...prev, status: 'completed' as const, summary: data.summary };

        // Update history using the fresh result from functional update
        const newEntry: HistoryEntry = {
          runId: prev.runId,
          url: prev.url,
          timestamp: prev.timestamp,
          score: data.summary?.overallScore,
        };
        setHistory(prevHistory => {
          const updated = [newEntry, ...prevHistory.filter(h => h.runId !== newEntry.runId)].slice(0, MAX_HISTORY);
          try {
            localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
          } catch {
            // Ignore localStorage errors
          }
          return updated;
        });

        return updatedResult;
      });
    };

    const handleTestError = (data: { error: string }) => {
      setIsRunning(false);
      setResult(prev =>
        prev ? { ...prev, status: 'failed' } : null
      );
      console.error('[Quick Test] Error:', data.error);
    };

    // Subscribe to events
    socket.on('wave:start', handleWaveStart);
    socket.on('wave:complete', handleWaveComplete);
    socket.on('wave:error', handleWaveError);
    socket.on('quick-test:complete', handleTestComplete);
    socket.on('quick-test:error', handleTestError);

    return () => {
      socket.off('wave:start', handleWaveStart);
      socket.off('wave:complete', handleWaveComplete);
      socket.off('wave:error', handleWaveError);
      socket.off('quick-test:complete', handleTestComplete);
      socket.off('quick-test:error', handleTestError);
    };
  }, [socket, currentRunId, result]);

  // Start test
  const startTest = useCallback(async () => {
    // Validate URL
    if (!url.trim()) {
      setUrlError('Please enter a URL');
      return;
    }

    let testUrl = url.trim();
    // Add https:// if no protocol
    if (!testUrl.startsWith('http://') && !testUrl.startsWith('https://')) {
      testUrl = `https://${testUrl}`;
      setUrl(testUrl);
    }

    if (!isValidUrl(testUrl)) {
      setUrlError('Please enter a valid URL (e.g., https://example.com)');
      return;
    }

    setUrlError(null);
    setIsRunning(true);

    // Reset waves
    setWaves(
      WAVE_DEFINITIONS.map(def => ({
        ...def,
        status: 'waiting' as const,
        steps: def.steps.map(s => ({ ...s, status: 'pending' as const })),
        expanded: false,
        data: undefined,
        error: undefined,
        startedAt: undefined,
        completedAt: undefined,
        duration: undefined,
      }))
    );
    setResult(null);

    // Save to recent URLs
    setRecentUrls(prev => {
      const updated = [testUrl, ...prev.filter(u => u !== testUrl)].slice(0, MAX_RECENT_URLS);
      try {
        localStorage.setItem(RECENT_URLS_KEY, JSON.stringify(updated));
      } catch {
        // Ignore
      }
      return updated;
    });

    try {
      const response = await fetch('/api/v1/quick-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url: testUrl }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to start test');
      }

      const data = await response.json();
      setCurrentRunId(data.runId);
      setResult({
        runId: data.runId,
        url: testUrl,
        timestamp: new Date(),
        status: 'running',
      });
    } catch (err) {
      setIsRunning(false);
      setUrlError(err instanceof Error ? err.message : 'Failed to start test');
    }
  }, [url, token]);

  // Handle enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isRunning) {
      startTest();
    }
  };

  // Toggle wave expansion
  const toggleWaveExpand = (waveIndex: number) => {
    setWaves(prev =>
      prev.map((w, idx) =>
        idx === waveIndex ? { ...w, expanded: !w.expanded } : w
      )
    );
  };

  // Select from history
  const selectFromHistory = (entry: HistoryEntry) => {
    setUrl(entry.url);
    setShowHistory(false);
  };

  return (
    <Layout>
      <div className="p-6 lg:p-8 space-y-8 max-w-6xl mx-auto">
        {/* Header */}
        <PageHeader
          title="Quick Test"
          description="Instant URL analysis with 4 parallel test waves"
          breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Quick Test' }]}
        />

        {/* URL Input Section */}
        <AnimatedCard>
          <CardContent className="p-6">
            <div className="flex flex-col gap-4">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <input
                    ref={urlInputRef}
                    type="text"
                    value={url}
                    onChange={e => {
                      setUrl(e.target.value);
                      setUrlError(null);
                    }}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setShowRecentUrls(true)}
                    onBlur={() => setTimeout(() => setShowRecentUrls(false), 200)}
                    placeholder="https://example.com"
                    className={`w-full px-4 py-3 rounded-lg bg-muted border text-lg font-mono
                      ${urlError ? 'border-destructive' : 'border-border'}
                      focus:outline-none focus:ring-2 focus:ring-primary
                      placeholder:text-muted-foreground`}
                    disabled={isRunning}
                  />

                  {/* Recent URLs Dropdown */}
                  {showRecentUrls && recentUrls.length > 0 && !isRunning && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-lg shadow-lg z-10">
                      <div className="p-2 text-xs text-muted-foreground border-b border-border">
                        Recent URLs
                      </div>
                      {recentUrls.map((recentUrl, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setUrl(recentUrl);
                            setShowRecentUrls(false);
                          }}
                          className="w-full px-3 py-2 text-left text-sm font-mono hover:bg-muted transition-colors"
                        >
                          {recentUrl}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={startTest}
                  disabled={isRunning || !isConnected}
                  className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium
                    hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed
                    flex items-center gap-2 transition-colors"
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5" />
                      Test
                    </>
                  )}
                </button>

                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="px-3 py-3 bg-muted text-muted-foreground rounded-lg
                    hover:bg-muted/80 transition-colors"
                  title="History"
                >
                  <History className="w-5 h-5" />
                </button>
              </div>

              {urlError && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {urlError}
                </div>
              )}

              {!isConnected && (
                <div className="flex items-center gap-2 text-warning text-sm">
                  <AlertCircle className="w-4 h-4" />
                  WebSocket disconnected - reconnecting...
                </div>
              )}
            </div>
          </CardContent>
        </AnimatedCard>

        {/* 4-Wave Progress Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {waves.map((wave, idx) => (
            <WaveCard
              key={wave.wave}
              wave={wave}
              onToggleExpand={() => toggleWaveExpand(idx)}
            />
          ))}
        </div>

        {/* Results Section */}
        {result?.summary && (
          <AnimatedCard>
            <CardContent className="p-6 space-y-6">
              <h2 className="text-xl font-semibold text-foreground">Results</h2>
              <ScoreDisplay summary={result.summary} />

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end">
                <button
                  className="px-4 py-2 bg-muted text-muted-foreground rounded-lg
                    hover:bg-muted/80 transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
                <button
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg
                    hover:bg-primary/90 transition-colors flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save to Project
                </button>
              </div>
            </CardContent>
          </AnimatedCard>
        )}

        {/* History Panel */}
        {showHistory && history.length > 0 && (
          <AnimatedCard>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Recent Tests</h2>
              <div className="space-y-2">
                {history.map(entry => (
                  <button
                    key={entry.runId}
                    onClick={() => selectFromHistory(entry)}
                    className="w-full p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors
                      flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-3">
                      <ExternalLink className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-mono text-foreground truncate max-w-[300px]">
                          {entry.url}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(entry.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    {entry.score !== undefined && (
                      <div className={`text-lg font-bold ${getScoreColor(entry.score)}`}>
                        {entry.score}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </AnimatedCard>
        )}
      </div>
    </Layout>
  );
}

export default QuickTestPage;
