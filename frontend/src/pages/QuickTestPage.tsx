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

import { useEffect, useCallback, useRef } from 'react'; // Feature #608: useState replaced with useReducer
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useQuickTestSocket, WaveState, QuickTestSummary } from '../hooks/useQuickTestSocket';
import { useQuickTestPageState, type HistoryEntry as ReducerHistoryEntry } from '../hooks/useQuickTestPageState';
import { useAuthStore } from '../stores/authStore';
// Feature #712: React Query hooks for history and scheduling
import { useQuickTestHistory, useCreateQuickTestSchedule } from '../hooks/api/useQuickTest';
import {
  PageHeader,
  AnimatedCard,
  CardContent,
  ScoreTrendChart,
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
  Download,
  AlertCircle,
  BarChart2,
  Accessibility,
  Network,
  ArrowLeftRight,
  CalendarClock,
  Search,
  FileJson,
  FileText,
} from 'lucide-react';
// Feature #728: EmptyState adoption
import { EmptyState, EmptyStateIcons } from '../components/ui/EmptyState';
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
  // Feature #514: Extracted components
  WaveCard,
  ScreenshotModal,
  // Feature #537: Detailed report
  DetailedReport,
} from '../components/quick-test';
import { Button } from '@/components/ui/button';
import { getWaveDefinitionsWithStatus, WAVE_DEFINITIONS } from '../constants/waves';

// ============================================================
// Types - Feature #514: Moved to ../components/quick-test/types.ts
// WaveStep, WaveData, QuickTestResult, HistoryEntry now imported
// ============================================================

// ============================================================
// Constants - Feature #612: Wave definitions centralized to ../constants/waves.ts
// Feature #514: Storage keys moved to ../components/quick-test/utils.ts
// ============================================================

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
    loadResult, // Feature #542: Load historical result for re-viewing
  } = useQuickTestSocket();

  // Feature #608: Consolidated state management with useReducer
  const { state: pageState, actions } = useQuickTestPageState();

  // Destructure for convenience (backwards-compatible variable names)
  const url = pageState.url.value;
  const urlError = pageState.url.error;
  const recentUrls = pageState.url.recentUrls;
  const showRecentUrls = pageState.url.showRecent;
  const selectedBrowser = pageState.ui.selectedBrowser;
  const waveExpanded = pageState.ui.waveExpanded;
  const history = pageState.history.entries;
  const showHistory = pageState.ui.showHistory;
  const historyLoading = pageState.history.isLoading;
  const screenshotModal = pageState.screenshotModal;
  const scheduleModal = pageState.scheduleModal;
  const createTestSuiteModal = pageState.createTestSuiteModal;
  const showExportMenu = pageState.ui.showExportMenu;

  // Action aliases for backwards compatibility
  const setUrl = actions.setUrl;
  const setUrlError = actions.setUrlError;
  const setRecentUrls = actions.setRecentUrls;
  const setShowRecentUrls = actions.toggleRecentUrls;
  const setSelectedBrowser = actions.setBrowser;
  const setWaveExpanded = actions.setWaveExpanded;
  const setShowHistory = actions.toggleHistory;
  const setHistoryLoading = actions.setHistoryLoading;
  const setShowExportMenu = actions.toggleExportMenu;

  // Refs
  const urlInputRef = useRef<HTMLInputElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null); // Feature #543

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

  // Feature #712: Use React Query hook for history
  const { data: historyData } = useQuickTestHistory(20, 'completed');

  // Load recent URLs from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(RECENT_URLS_KEY);
      if (saved) {
        setRecentUrls(JSON.parse(saved));
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Feature #712: Sync React Query history data to reducer state
  useEffect(() => {
    if (historyData?.results) {
      const apiHistory: HistoryEntry[] = historyData.results.map((r) => ({
        runId: r.id,
        url: r.url,
        timestamp: new Date(r.startedAt),
        score: r.overallScore ?? undefined,
      }));
      actions.setHistory(apiHistory);
      // Sync back to localStorage for offline access
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(apiHistory.slice(0, MAX_HISTORY)));
      } catch { /* ignore */ }
    }
  }, [historyData]);

  // Update history when test completes
  useEffect(() => {
    if (testStatus === 'completed' && currentRunId && testingUrl && summary) {
      const newEntry: ReducerHistoryEntry = {
        runId: currentRunId,
        url: testingUrl,
        timestamp: new Date(),
        score: summary.overallScore,
      };
      // Feature #608: Use reducer action instead of functional setState
      actions.addHistoryEntry(newEntry);
      // Also sync to localStorage
      try {
        const updated = [newEntry, ...history.filter(h => h.runId !== newEntry.runId)].slice(0, MAX_HISTORY);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      } catch {
        // Ignore localStorage errors
      }
    }
  }, [testStatus, currentRunId, testingUrl, summary, actions, history]);

  // Feature #543: Close export menu when clicking outside
  useEffect(() => {
    if (!showExportMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showExportMenu]);

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
    const updatedRecent = [testUrl, ...recentUrls.filter(u => u !== testUrl)].slice(0, MAX_RECENT_URLS);
    try {
      localStorage.setItem(RECENT_URLS_KEY, JSON.stringify(updatedRecent));
    } catch {
      // Ignore
    }
    setRecentUrls(updatedRecent);

    // Use hook's startTest function
    // Feature #579: Pass selected browser for cross-browser testing
    const result = await hookStartTest(testUrl, selectedBrowser);
    if ('error' in result) {
      setUrlError(result.error);
    }
  }, [url, hookStartTest, selectedBrowser]);

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
      actions.toggleWaveExpanded(waveNum);
    }
  };

  // Feature #542: Select from history - loads full results into the UI
  const selectFromHistory = useCallback(async (entry: HistoryEntry) => {
    setShowHistory(false);
    setHistoryLoading(true);
    setUrl(entry.url);

    const loaded = await loadResult(entry.runId);
    setHistoryLoading(false);

    if (!loaded) {
      // Fallback: just set URL so user can re-run
      setUrlError('Could not load historical results. Try running the test again.');
    }
  }, [loadResult]);

  // Feature #543: Export as JSON
  const handleExportJSON = useCallback(() => {
    if (!result || !summary) return;
    setShowExportMenu(false);

    const exportData = {
      runId: result.runId,
      url: result.url,
      timestamp: result.timestamp,
      status: result.status,
      summary: result.summary,
      waves: waves.map(w => ({
        wave: w.wave,
        name: w.name,
        status: w.status,
        duration: w.duration,
        data: w.data,
        error: w.error,
      })),
      exportedAt: new Date().toISOString(),
      exportedBy: 'QA Guardian',
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    let hostname = 'unknown';
    try { hostname = new URL(result.url).hostname; } catch { /* keep default */ }
    a.download = `quick-test-${hostname}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [result, summary, waves]);

  // Feature #543: Export as PDF via window.print() with print-specific CSS
  const handleExportPDF = useCallback(() => {
    if (!result || !summary) return;
    setShowExportMenu(false);

    // Create a print-friendly window with the report
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    let hostname = 'unknown';
    try { hostname = new URL(result.url).hostname; } catch { /* keep default */ }

    const scoreColor = (s: number) => s >= 80 ? '#22c55e' : s >= 60 ? '#f59e0b' : '#ef4444';
    const overall = summary.overallScore;

    // Build wave results HTML
    const waveRows = waves
      .filter(w => w.status === 'completed' || w.status === 'failed' || w.status === 'skipped')
      .map(w => {
        const statusIcon = w.status === 'completed' ? '✅' : w.status === 'failed' ? '❌' : '⏭️';
        const dur = w.duration ? `${(w.duration / 1000).toFixed(1)}s` : '—';
        return `<tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${statusIcon} ${w.name}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${w.status}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${dur}</td>
        </tr>`;
      }).join('');

    // Build scores section
    const scores = [
      { label: 'Health', score: summary.healthScore, weight: '12%' },
      { label: 'Performance', score: summary.performanceScore, weight: '18%' },
      { label: 'Security', score: summary.securityScore, weight: '18%' },
      { label: 'Accessibility', score: summary.accessibilityScore ?? 0, weight: '22%' },
      { label: 'API', score: summary.apiScore ?? 0, weight: '10%' },
      { label: 'SEO', score: summary.seoScore ?? 0, weight: '10%' },
    ];
    const scoreCards = scores.map(s =>
      `<div style="background: #f9fafb; border-radius: 8px; padding: 12px; text-align: center;">
        <div style="font-size: 24px; font-weight: bold; color: ${scoreColor(s.score)};">${s.score}</div>
        <div style="font-size: 12px; color: #6b7280;">${s.label} (${s.weight})</div>
      </div>`
    ).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>QA Guardian Report - ${hostname}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 24px; color: #111827; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #3b82f6; padding-bottom: 16px; margin-bottom: 24px; }
    .brand { font-size: 18px; font-weight: 700; color: #3b82f6; }
    .subtitle { font-size: 12px; color: #6b7280; }
    .overall { text-align: center; margin: 24px 0; }
    .overall-score { font-size: 48px; font-weight: bold; }
    .score-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 24px 0; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th { text-align: left; padding: 8px; border-bottom: 2px solid #e5e7eb; font-size: 13px; color: #6b7280; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">QA Guardian</div>
      <div class="subtitle">Quick Test Report</div>
    </div>
    <div style="text-align: right;">
      <div style="font-weight: 600;">${hostname}</div>
      <div class="subtitle">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
    </div>
  </div>

  <div class="overall">
    <div style="font-size: 13px; color: #6b7280; margin-bottom: 4px;">Overall Score</div>
    <div class="overall-score" style="color: ${scoreColor(overall)};">${overall}</div>
    <div style="font-size: 13px; color: #6b7280;">${result.url}</div>
  </div>

  <h3 style="font-size: 16px; color: #374151; margin-top: 24px;">Category Scores</h3>
  <div class="score-grid">${scoreCards}</div>

  <h3 style="font-size: 16px; color: #374151; margin-top: 24px;">Wave Results</h3>
  <table>
    <thead><tr>
      <th>Wave</th>
      <th style="text-align: center;">Status</th>
      <th style="text-align: right;">Duration</th>
    </tr></thead>
    <tbody>${waveRows}</tbody>
  </table>

  <div class="footer">
    Generated by QA Guardian &middot; ${new Date().toISOString()} &middot; ${result.url}
  </div>
</body>
</html>`;

    printWindow.document.write(html);
    printWindow.document.close();
    // Wait for content to render then trigger print
    printWindow.onload = () => {
      printWindow.print();
    };
  }, [result, summary, waves]);

  // Feature #712: Use React Query mutation for schedule creation
  const createScheduleMutation = useCreateQuickTestSchedule();

  // Feature #474: Schedule Quick Test handlers - Feature #608: Using reducer actions
  const openScheduleModal = () => {
    actions.resetScheduleModal();
    actions.openScheduleModal();
  };

  const closeScheduleModal = () => {
    actions.closeScheduleModal();
  };

  const handleScheduleSubmit = async () => {
    if (!testingUrl) return;

    actions.updateScheduleModal({ isSubmitting: true, error: null });

    // Convert frequency to cron expression
    const cronMap: Record<string, string> = {
      '1h': '0 * * * *',      // Every hour at minute 0
      '6h': '0 */6 * * *',    // Every 6 hours
      '12h': '0 */12 * * *',  // Every 12 hours
      '24h': '0 9 * * *',     // Daily at 9 AM
      'weekly': '0 9 * * 1',  // Weekly on Monday at 9 AM
    };

    createScheduleMutation.mutate(
      {
        url: testingUrl,
        name: `Quick Test: ${new URL(testingUrl).hostname}`,
        cron_expression: cronMap[scheduleModal.frequency],
        notify_on_score_drop: scheduleModal.notifyOnDrop,
        score_threshold: scheduleModal.threshold,
      },
      {
        onSuccess: () => {
          actions.updateScheduleModal({ isSubmitting: false, success: true });
          // Auto-close after success
          setTimeout(() => {
            closeScheduleModal();
          }, 2000);
        },
        onError: (err) => {
          actions.updateScheduleModal({
            isSubmitting: false,
            error: err instanceof Error ? err.message : 'Failed to create schedule',
          });
        },
      }
    );
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
                        <Button
                          key={idx}
                          variant="ghost"
                          onClick={() => {
                            setUrl(recentUrl);
                            setShowRecentUrls(false);
                          }}
                          className="w-full px-3 py-2 justify-start text-sm font-mono rounded-none h-auto"
                        >
                          {recentUrl}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Feature #579: Browser selector for cross-browser testing */}
                <select
                  value={selectedBrowser}
                  onChange={(e) => setSelectedBrowser(e.target.value as 'chromium' | 'firefox' | 'webkit')}
                  disabled={isRunning}
                  className="px-3 py-3 bg-muted border border-border rounded-lg text-foreground
                    focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  title="Select browser"
                >
                  <option value="chromium">🌐 Chromium</option>
                  <option value="firefox">🦊 Firefox</option>
                  <option value="webkit">🧭 WebKit</option>
                </select>

                <Button
                  onClick={startTest}
                  disabled={isRunning || !isConnected}
                  className="px-6 py-3"
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
                </Button>

                <Button
                  variant="secondary"
                  size="icon"
                  onClick={() => setShowHistory(!showHistory)}
                  className="h-12 w-12"
                  title="History"
                >
                  <History className="w-5 h-5" />
                </Button>

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
              onScreenshotClick={(url, type) => actions.openScreenshotModal(url, type)}
              // Feature #475: Handle create test suite from AI suggestions - Feature #608: Using reducer
              onCreateTestSuite={(testSuggestions) =>
                actions.openCreateSuiteModal(testSuggestions)
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

              {/* Feature #537: Detailed Report Section */}
              <DetailedReport waves={waves} />

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end">
                {/* Feature #543: Export dropdown with JSON and PDF options */}
                <div className="relative" ref={exportMenuRef}>
                  <Button
                    variant="secondary"
                    onClick={() => setShowExportMenu(!showExportMenu)}
                  >
                    <Download className="w-4 h-4" />
                    Export
                  </Button>
                  {showExportMenu && (
                    <div className="absolute right-0 top-full mt-1 w-48 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden">
                      <Button
                        variant="ghost"
                        onClick={handleExportJSON}
                        className="w-full justify-start rounded-none"
                      >
                        <FileJson className="w-4 h-4 text-info" />
                        Export as JSON
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={handleExportPDF}
                        className="w-full justify-start rounded-none"
                      >
                        <FileText className="w-4 h-4 text-destructive" />
                        Export as PDF
                      </Button>
                    </div>
                  )}
                </div>
                {/* Feature #474: Schedule Recurring Test button */}
                <Button
                  onClick={openScheduleModal}
                >
                  <CalendarClock className="w-4 h-4" />
                  Schedule Recurring
                </Button>
              </div>
            </CardContent>
          </AnimatedCard>
        )}

        {/* Feature #542: Enhanced History Panel with re-view capability */}
        {showHistory && (
          <AnimatedCard>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">Recent Tests</h2>
                <span className="text-xs text-muted-foreground">{history.length} result{history.length !== 1 ? 's' : ''}</span>
              </div>
              {historyLoading && (
                <div className="flex items-center gap-2 mb-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-sm text-primary">Loading test results...</span>
                </div>
              )}
              {/* Feature #728: EmptyState adoption */}
              {history.length === 0 ? (
                <EmptyState icon={EmptyStateIcons.test} title="No completed tests yet" description="Run a test to see it here." size="sm" />
              ) : (
              <>
              <div className="space-y-2">
                {history.map(entry => {
                  let hostname = entry.url;
                  try { hostname = new URL(entry.url).hostname; } catch { /* keep full url */ }
                  return (
                  <Button
                    key={entry.runId}
                    variant="ghost"
                    onClick={() => selectFromHistory(entry)}
                    disabled={historyLoading}
                    className="w-full h-auto p-3 flex items-center justify-between text-left bg-muted/50 hover:bg-muted"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">
                          {hostname}
                        </div>
                        <div className="text-xs text-muted-foreground truncate max-w-[280px]">
                          {entry.url}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {new Date(entry.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    {entry.score !== undefined && (
                      <div className={`text-lg font-bold ${getScoreColor(entry.score)} flex-shrink-0 ml-3`}>
                        {entry.score}
                      </div>
                    )}
                  </Button>
                  );
                })}
              </div>

              {/* Feature #492 / #556: Score Timeline Chart - uses reusable ScoreTrendChart */}
              {(() => {
                // Filter history entries that have scores and match the current URL being tested
                const entriesWithScores = history
                  .filter(e => e.score !== undefined && (testingUrl ? e.url === testingUrl : true))
                  .slice(0, 10) // Last 10 runs
                  .reverse(); // Oldest first for chart

                if (entriesWithScores.length < 3) return null;

                const chartData = entriesWithScores.map(e => ({
                  label: new Date(e.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                  value: e.score || 0,
                }));

                return (
                  <div className="mt-6 pt-4 border-t border-border">
                    <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                      <BarChart2 className="w-4 h-4" />
                      Score Trend (Last {entriesWithScores.length} Runs)
                    </h3>
                    <ScoreTrendChart
                      data={chartData}
                      thresholds={{ good: 80, warning: 60 }}
                      valueLabel="Score"
                    />
                  </div>
                );
              })()}
              </>
              )}
            </CardContent>
          </AnimatedCard>
        )}
      </div>

      {/* Feature #466: Screenshot Modal - Feature #608: Using reducer actions */}
      <ScreenshotModal
        isOpen={screenshotModal.isOpen}
        url={screenshotModal.url}
        type={screenshotModal.type}
        onClose={actions.closeScreenshotModal}
      />

      {/* Feature #474: Schedule Modal - Feature #608: Using reducer actions */}
      <ScheduleModal
        isOpen={scheduleModal.isOpen}
        url={testingUrl || ''}
        frequency={scheduleModal.frequency}
        notifyOnDrop={scheduleModal.notifyOnDrop}
        threshold={scheduleModal.threshold}
        isSubmitting={scheduleModal.isSubmitting}
        error={scheduleModal.error}
        success={scheduleModal.success}
        onFrequencyChange={(freq) => actions.updateScheduleModal({ frequency: freq })}
        onNotifyChange={(notify) => actions.updateScheduleModal({ notifyOnDrop: notify })}
        onThresholdChange={(thresh) => actions.updateScheduleModal({ threshold: thresh })}
        onSubmit={handleScheduleSubmit}
        onClose={closeScheduleModal}
      />

      {/* Feature #475: Create Test Suite Modal - Feature #608: Using reducer actions */}
      <CreateTestSuiteModal
        isOpen={createTestSuiteModal.isOpen}
        testSuggestions={createTestSuiteModal.testSuggestions}
        targetUrl={testingUrl || ''}
        onClose={actions.closeCreateSuiteModal}
      />

    </Layout>
  );
}

export default QuickTestPage;
