/**
 * Quick Test Page
 * Feature #425: Flagship instant QA feature - paste a URL and watch 5 waves of tests run live
 *
 * Features:
 * - URL input with validation
 * - 2x2 wave progress grid with real-time updates
 * - Animated step progression
 * - Overall score display
 * - History panel
 * - Export/save actions
 */

import { useState, useEffect, useCallback, useRef } from 'react'; // useMemo unused
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Layout } from '../components/Layout';
import { useQuickTestSocket, WaveState, QuickTestSummary } from '../hooks/useQuickTestSocket';
import { useAuthStore } from '../stores/authStore';
import {
  PageHeader,
  AnimatedCard,
  CardContent,
} from '../components/ui';
import { getScoreTextColor } from '../components/ui/score-card';
import {
  Zap,
  Globe,
  Shield,
  Gauge,
  Brain,
  Loader2,
  ExternalLink,
  History,
  Save,
  Download,
  AlertCircle,
  BarChart2,
  Accessibility,
  Network,
  ArrowLeftRight,
  CalendarClock,
  Search,
} from 'lucide-react';
// Feature #514: Import extracted quick-test components and utilities
import {
  // Types
  type WaveData,
  type QuickTestResult,
  type HistoryEntry,
  type AIAnalysisData,
  // Utilities
  isValidUrl,
  getScoreColor,
  RECENT_URLS_KEY,
  MAX_RECENT_URLS,
  HISTORY_KEY,
  MAX_HISTORY,
  // Modal components
  CreateTestSuiteModal,
  ScheduleModal,
  SaveAsSuiteModal, // Feature #532
  // Feature #514: Extracted components
  WaveCard,
  ScreenshotModal,
} from '../components/quick-test';

// ============================================================
// Types - Feature #514: Moved to ../components/quick-test/types.ts
// WaveStep, WaveData, QuickTestResult, HistoryEntry now imported
// ============================================================

// ============================================================
// Constants - Feature #514: Storage keys moved to ../components/quick-test/utils.ts
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
  // Feature #471: Wave 5 - Accessibility Scan
  {
    wave: 5,
    name: 'Accessibility',
    icon: Accessibility,
    steps: [
      { name: 'WCAG 2.1 AA Scan', status: 'pending' as const },
      { name: 'Critical Violations', status: 'pending' as const },
      { name: 'Serious Violations', status: 'pending' as const },
      { name: 'Minor Violations', status: 'pending' as const },
    ],
  },
  // Feature #472: Wave 6 - API Discovery
  {
    wave: 6,
    name: 'API Discovery',
    icon: Network,
    steps: [
      { name: 'OpenAPI Spec Detection', status: 'pending' as const },
      { name: 'Common API Paths', status: 'pending' as const },
      { name: 'Endpoint Health', status: 'pending' as const },
      { name: 'Auth Protection', status: 'pending' as const },
    ],
  },
  // Feature #527: Wave 7 - SEO Analysis (Smoke Test)
  {
    wave: 7,
    name: 'SEO Analysis',
    icon: Search,
    steps: [
      { name: 'Meta Tags', status: 'pending' as const },
      { name: 'Heading Structure', status: 'pending' as const },
      { name: 'Schema Markup', status: 'pending' as const },
      { name: 'Navigation', status: 'pending' as const },
      { name: 'Tracking Scripts', status: 'pending' as const },
      { name: 'Crawlability', status: 'pending' as const },
    ],
  },
];

// Feature #514: Constants and helpers moved to ../components/quick-test/utils.ts
// RECENT_URLS_KEY, MAX_RECENT_URLS, HISTORY_KEY, MAX_HISTORY - now imported
// isValidUrl, getScoreColor, getScoreBgColor - now imported

// Feature #514: WaveCard, ScreenshotModal, AIAnalysisDetails, AccessibilityDetails,
// APIDiscoveryDetails, ScheduleModal, CreateTestSuiteModal all extracted to
// ../components/quick-test/ and imported via barrel

// Feature #514: WaveCard, ScreenshotModal, ScheduleModal, CreateTestSuiteModal
// all extracted to ../components/quick-test/ and imported via barrel export

// ============================================================
// Score Display Component
// Feature #522: Uses ScoreCardGrid from ../components/ui/score-card
// ============================================================

interface ScoreDisplayProps {
  summary: QuickTestResult['summary'];
}

/** Feature #536: Weight definitions for each score category */
const SCORE_WEIGHTS: Array<{
  key: keyof NonNullable<QuickTestResult['summary']>;
  label: string;
  weight: number;
  icon: React.ElementType;
}> = [
  { key: 'healthScore', label: 'Health', weight: 12, icon: Globe },
  { key: 'performanceScore', label: 'Performance', weight: 18, icon: Gauge },
  { key: 'securityScore', label: 'Security', weight: 18, icon: Shield },
  { key: 'accessibilityScore', label: 'Accessibility', weight: 22, icon: Accessibility },
  { key: 'apiScore', label: 'API', weight: 10, icon: Network },
  { key: 'seoScore', label: 'SEO', weight: 10, icon: Search },
];

/**
 * Feature #536: Redesigned score display with all 7 scores and weight breakdowns.
 * Shows the overall score prominently, followed by a grid of 6 category scores
 * with their weight contributions.
 */
function ScoreDisplay({ summary }: ScoreDisplayProps) {
  if (!summary) return null;

  const overallColor = getScoreTextColor(summary.overallScore);

  return (
    <div className="space-y-6">
      {/* Overall Score - Prominent Display */}
      <div className="flex items-center justify-center gap-4 py-4">
        <div className="text-center">
          <div className={`text-5xl font-bold ${overallColor}`}>
            {summary.overallScore}
          </div>
          <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5 justify-center">
            <BarChart2 className="w-4 h-4" />
            Overall Score
          </div>
        </div>
      </div>

      {/* Category Scores Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {SCORE_WEIGHTS.map(({ key, label, weight, icon: Icon }) => {
          const score = summary[key];
          if (score === undefined || score === null) return null;

          const scoreNum = typeof score === 'number' ? score : 0;
          const textColor = getScoreTextColor(scoreNum);
          const contribution = Math.round((scoreNum * weight) / 100);

          return (
            <div
              key={key}
              className="rounded-lg bg-muted/50 p-3 hover:bg-muted/70 transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{label}</span>
              </div>
              <div className={`text-2xl font-bold ${textColor}`}>{scoreNum}</div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-muted-foreground">{weight}% weight</span>
                <span className="text-xs text-muted-foreground">+{contribution} pts</span>
              </div>
              {/* Mini progress bar */}
              <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    scoreNum >= 80 ? 'bg-success' :
                    scoreNum >= 60 ? 'bg-warning' :
                    'bg-destructive'
                  }`}
                  style={{ width: `${Math.min(scoreNum, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

export function QuickTestPage() {
  // Feature #474: Get auth token for schedule API calls
  const { token } = useAuthStore();

  // Feature #441: Use the useQuickTestSocket hook for real-time updates
  const {
    runId: currentRunId,
    url: testingUrl,
    status: testStatus,
    waves: hookWaves,
    summary,
    isConnected,
    startTest: hookStartTest,
    reset: resetTest,
  } = useQuickTestSocket();

  // URL Input State
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [recentUrls, setRecentUrls] = useState<string[]>([]);
  const [showRecentUrls, setShowRecentUrls] = useState(false);

  // UI State for wave expansion (not managed by hook)
  const [waveExpanded, setWaveExpanded] = useState<Record<number, boolean>>({});

  // History State
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Feature #466: Screenshot modal state
  const [screenshotModal, setScreenshotModal] = useState<{
    isOpen: boolean;
    url: string | null;
    type: 'desktop' | 'mobile' | null;
  }>({ isOpen: false, url: null, type: null });

  // Feature #474: Schedule modal state
  const [scheduleModal, setScheduleModal] = useState<{
    isOpen: boolean;
    frequency: '1h' | '6h' | '12h' | '24h' | 'weekly';
    notifyOnDrop: boolean;
    threshold: number;
    isSubmitting: boolean;
    error: string | null;
    success: boolean;
  }>({
    isOpen: false,
    frequency: '24h',
    notifyOnDrop: true,
    threshold: 70,
    isSubmitting: false,
    error: null,
    success: false,
  });

  // Feature #475: Create Test Suite modal state
  const [createTestSuiteModal, setCreateTestSuiteModal] = useState<{
    isOpen: boolean;
    testSuggestions: AIAnalysisData['testSuggestions'];
  }>({
    isOpen: false,
    testSuggestions: undefined,
  });

  // Feature #532: Save as Suite modal state
  const [saveAsSuiteModal, setSaveAsSuiteModal] = useState(false);

  // Refs
  const urlInputRef = useRef<HTMLInputElement>(null);

  // Derive running state from hook
  const isRunning = testStatus === 'running';

  // Merge hook waves with local UI state (expanded) and icons
  const waves: WaveData[] = hookWaves.map((w, idx) => ({
    ...w,
    icon: WAVE_DEFINITIONS[idx]?.icon || Globe,
    expanded: waveExpanded[w.wave] || false,
  }));

  // Create result object from hook state
  const result: QuickTestResult | null = currentRunId ? {
    runId: currentRunId,
    url: testingUrl || '',
    timestamp: new Date(),
    status: testStatus === 'completed' ? 'completed' : testStatus === 'failed' ? 'failed' : 'running',
    summary: summary || undefined,
  } : null;

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

  // Update history when test completes
  useEffect(() => {
    if (testStatus === 'completed' && currentRunId && testingUrl && summary) {
      const newEntry: HistoryEntry = {
        runId: currentRunId,
        url: testingUrl,
        timestamp: new Date(),
        score: summary.overallScore,
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
    }
  }, [testStatus, currentRunId, testingUrl, summary]);

  // Start test using the hook
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
    setWaveExpanded({}); // Reset expansions

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

    // Use hook's startTest function
    const result = await hookStartTest(testUrl);
    if ('error' in result) {
      setUrlError(result.error);
    }
  }, [url, hookStartTest]);

  // Handle enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isRunning) {
      startTest();
    }
  };

  // Toggle wave expansion - uses local UI state since hook doesn't manage expansion
  const toggleWaveExpand = (waveIndex: number) => {
    const waveNum = waves[waveIndex]?.wave;
    if (waveNum) {
      setWaveExpanded(prev => ({
        ...prev,
        [waveNum]: !prev[waveNum],
      }));
    }
  };

  // Select from history
  const selectFromHistory = (entry: HistoryEntry) => {
    setUrl(entry.url);
    setShowHistory(false);
  };

  // Feature #474: Schedule Quick Test handlers
  const openScheduleModal = () => {
    setScheduleModal({
      isOpen: true,
      frequency: '24h',
      notifyOnDrop: true,
      threshold: 70,
      isSubmitting: false,
      error: null,
      success: false,
    });
  };

  const closeScheduleModal = () => {
    setScheduleModal(prev => ({ ...prev, isOpen: false }));
  };

  const handleScheduleSubmit = async () => {
    if (!testingUrl) return;

    setScheduleModal(prev => ({ ...prev, isSubmitting: true, error: null }));

    try {
      // Convert frequency to cron expression
      const cronMap: Record<string, string> = {
        '1h': '0 * * * *',      // Every hour at minute 0
        '6h': '0 */6 * * *',    // Every 6 hours
        '12h': '0 */12 * * *',  // Every 12 hours
        '24h': '0 9 * * *',     // Daily at 9 AM
        'weekly': '0 9 * * 1',  // Weekly on Monday at 9 AM
      };

      const response = await fetch('/api/v1/quick-test/schedules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          url: testingUrl,
          name: `Quick Test: ${new URL(testingUrl).hostname}`,
          cron_expression: cronMap[scheduleModal.frequency],
          notify_on_score_drop: scheduleModal.notifyOnDrop,
          score_threshold: scheduleModal.threshold,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create schedule');
      }

      setScheduleModal(prev => ({ ...prev, isSubmitting: false, success: true }));

      // Auto-close after success
      setTimeout(() => {
        closeScheduleModal();
      }, 2000);
    } catch (err) {
      setScheduleModal(prev => ({
        ...prev,
        isSubmitting: false,
        error: err instanceof Error ? err.message : 'Failed to create schedule',
      }));
    }
  };

  return (
    <Layout>
      <div className="p-6 lg:p-8 space-y-8 max-w-6xl mx-auto">
        {/* Header */}
        <PageHeader
          title="Quick Test"
          description="Instant URL analysis with 7 parallel test waves"
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

                {/* Feature #473: Compare button */}
                <Link
                  to="/quick-test/compare"
                  className="px-3 py-3 bg-muted text-muted-foreground rounded-lg
                    hover:bg-muted/80 transition-colors flex items-center"
                  title="Compare URLs"
                >
                  <ArrowLeftRight className="w-5 h-5" />
                </Link>
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
              onScreenshotClick={(url, type) => setScreenshotModal({ isOpen: true, url, type })}
              // Feature #475: Handle create test suite from AI suggestions
              onCreateTestSuite={(testSuggestions) =>
                setCreateTestSuiteModal({ isOpen: true, testSuggestions })
              }
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
                {/* Feature #532: Save as Suite button */}
                <button
                  onClick={() => setSaveAsSuiteModal(true)}
                  className="px-4 py-2 bg-muted text-muted-foreground rounded-lg
                    hover:bg-muted/80 transition-colors flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save as Suite
                </button>
                {/* Feature #474: Schedule Recurring Test button */}
                <button
                  onClick={openScheduleModal}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg
                    hover:bg-primary/90 transition-colors flex items-center gap-2"
                >
                  <CalendarClock className="w-4 h-4" />
                  Schedule Recurring
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

              {/* Feature #492: Score Timeline Chart - shows when 3+ entries with scores for same URL */}
              {(() => {
                // Filter history entries that have scores and match the current URL being tested
                const entriesWithScores = history
                  .filter(e => e.score !== undefined && (testingUrl ? e.url === testingUrl : true))
                  .slice(0, 10) // Last 10 runs
                  .reverse(); // Oldest first for chart

                if (entriesWithScores.length < 3) return null;

                // Prepare chart data
                const chartData = entriesWithScores.map(e => ({
                  time: new Date(e.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                  score: e.score,
                }));

                // Calculate average score for reference line
                const avgScore = Math.round(
                  entriesWithScores.reduce((sum, e) => sum + (e.score || 0), 0) / entriesWithScores.length
                );

                // Determine line color based on latest score
                const latestScore = entriesWithScores[entriesWithScores.length - 1]?.score || 0;
                const lineColor = latestScore >= 80 ? '#22c55e' : latestScore >= 60 ? '#f59e0b' : '#ef4444';

                return (
                  <div className="mt-6 pt-4 border-t border-border">
                    <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                      <BarChart2 className="w-4 h-4" />
                      Score Trend (Last {entriesWithScores.length} Runs)
                    </h3>
                    <div className="h-32 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                          <XAxis
                            dataKey="time"
                            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                            tickLine={false}
                            axisLine={{ stroke: 'var(--border)' }}
                          />
                          <YAxis
                            domain={[0, 100]}
                            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                            tickLine={false}
                            axisLine={{ stroke: 'var(--border)' }}
                            tickFormatter={(value) => `${value}`}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'var(--card)',
                              border: '1px solid var(--border)',
                              borderRadius: '0.375rem',
                              padding: '0.5rem',
                            }}
                            labelStyle={{ color: 'var(--foreground)', fontWeight: 500 }}
                            itemStyle={{ color: 'var(--foreground)' }}
                            formatter={(value: number) => [`${value}`, 'Score']}
                          />
                          <ReferenceLine
                            y={avgScore}
                            stroke="var(--muted-foreground)"
                            strokeDasharray="3 3"
                            label={{
                              value: `Avg: ${avgScore}`,
                              position: 'insideTopRight',
                              fontSize: 10,
                              fill: 'var(--muted-foreground)',
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="score"
                            stroke={lineColor}
                            strokeWidth={2}
                            dot={{ fill: lineColor, strokeWidth: 0, r: 3 }}
                            activeDot={{ r: 5, fill: lineColor }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-2 flex items-center justify-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-0.5 bg-success rounded"></span>
                        ≥80 Good
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-0.5 bg-warning rounded"></span>
                        60-79 Fair
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-0.5 bg-destructive rounded"></span>
                        &lt;60 Poor
                      </span>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </AnimatedCard>
        )}
      </div>

      {/* Feature #466: Screenshot Modal */}
      {/* Feature #466: Screenshot Modal */}
      <ScreenshotModal
        isOpen={screenshotModal.isOpen}
        url={screenshotModal.url}
        type={screenshotModal.type}
        onClose={() => setScreenshotModal({ isOpen: false, url: null, type: null })}
      />

      {/* Feature #474: Schedule Modal */}
      <ScheduleModal
        isOpen={scheduleModal.isOpen}
        url={testingUrl || ''}
        frequency={scheduleModal.frequency}
        notifyOnDrop={scheduleModal.notifyOnDrop}
        threshold={scheduleModal.threshold}
        isSubmitting={scheduleModal.isSubmitting}
        error={scheduleModal.error}
        success={scheduleModal.success}
        onFrequencyChange={(freq) => setScheduleModal(prev => ({ ...prev, frequency: freq }))}
        onNotifyChange={(notify) => setScheduleModal(prev => ({ ...prev, notifyOnDrop: notify }))}
        onThresholdChange={(thresh) => setScheduleModal(prev => ({ ...prev, threshold: thresh }))}
        onSubmit={handleScheduleSubmit}
        onClose={closeScheduleModal}
      />

      {/* Feature #475: Create Test Suite Modal */}
      <CreateTestSuiteModal
        isOpen={createTestSuiteModal.isOpen}
        testSuggestions={createTestSuiteModal.testSuggestions}
        targetUrl={testingUrl || ''}
        token={token}
        onClose={() => setCreateTestSuiteModal({ isOpen: false, testSuggestions: undefined })}
      />

      {/* Feature #532: Save as Suite Modal */}
      <SaveAsSuiteModal
        isOpen={saveAsSuiteModal}
        waves={waves.map(w => ({
          wave: w.wave,
          name: w.name,
          status: w.status,
          data: w.data,
          duration: w.duration,
        }))}
        targetUrl={testingUrl || ''}
        token={token || ''}
        onClose={() => setSaveAsSuiteModal(false)}
      />
    </Layout>
  );
}

export default QuickTestPage;
