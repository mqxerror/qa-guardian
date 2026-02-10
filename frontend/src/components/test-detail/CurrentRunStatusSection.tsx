// Feature #48: CurrentRunStatusSection - Extracted from TestDetailPage.tsx
// Feature #539: Integrated WaveProgressCard + ScoreCardGrid for richer run display
// Feature #552: Enhanced WaveProgressCard with live step execution and screenshot thumbnail
// Displays current run header, status badge, live execution, and test results

import { useState, useMemo, RefObject, Dispatch, SetStateAction } from 'react';
import { Play, CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { LiveExecutionPanel } from './LiveExecutionPanel';
import { TestResultCard, TestResult } from './TestResultCard';
import { TestRunType, TestType } from './types';
import { WaveProgressCard, type WaveProgressStatus, type WaveProgressStep } from '../ui/wave-progress-card';
import { ScoreCardGrid } from '../ui/score-card';

interface LiveProgress {
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

interface ConsoleLogEntry {
  level: string;
  message: string;
  timestamp: number;
}

interface CurrentRunStatusSectionProps {
  currentRun: TestRunType;
  test: TestType | null;
  liveProgress: LiveProgress | null;
  liveScreenshot: string | null;
  liveConsoleLogs: ConsoleLogEntry[];
  isCancellingRun: boolean;
  isDownloadingArtifacts: boolean;
  onCancelRun: () => void;
  onDownloadAllArtifacts: (runId: string) => void;
  // Visual comparison props for TestResultCard
  comparisonViewMode: 'side-by-side' | 'slider' | 'onion-skin' | 'diff' | 'diff-overlay';
  setComparisonViewMode: (mode: 'side-by-side' | 'slider' | 'onion-skin' | 'diff' | 'diff-overlay') => void;
  sliderPosition: number;
  setSliderPosition: (pos: number) => void;
  onionSkinOpacity: number;
  setOnionSkinOpacity: (opacity: number) => void;
  diffOverlayOpacity: number;
  setDiffOverlayOpacity: (opacity: number) => void;
  imageZoomLevel: 'fit' | '100' | '50' | '200';
  setImageZoomLevel: (level: 'fit' | '100' | '50' | '200') => void;
  baselineContainerRef: RefObject<HTMLDivElement>;
  currentContainerRef: RefObject<HTMLDivElement>;
  diffContainerRef: RefObject<HTMLDivElement>;
  handleSyncScroll: (source: 'baseline' | 'current' | 'diff') => void;
  onOpenLightbox: (url: string) => void;
  onApproveBaseline: (runId: string) => void;
  onRejectChanges: (runId: string) => void;
  // Accessibility filters - use specific types and React state setters
  a11ySeverityFilter: { [key: string]: 'all' | 'critical' | 'serious' | 'moderate' | 'minor' };
  setA11ySeverityFilter: Dispatch<SetStateAction<{ [key: string]: 'all' | 'critical' | 'serious' | 'moderate' | 'minor' }>>;
  a11yCategoryFilter: { [key: string]: 'all' | 'color' | 'images' | 'forms' | 'navigation' | 'structure' | 'aria' };
  setA11yCategoryFilter: Dispatch<SetStateAction<{ [key: string]: 'all' | 'color' | 'images' | 'forms' | 'navigation' | 'structure' | 'aria' }>>;
  a11ySearchQuery: { [key: string]: string };
  setA11ySearchQuery: Dispatch<SetStateAction<{ [key: string]: string }>>;
  token: string;
  formatDateTime: (date: string | Date) => string;
}

export function CurrentRunStatusSection({
  currentRun,
  test,
  liveProgress,
  liveScreenshot,
  liveConsoleLogs,
  isCancellingRun,
  isDownloadingArtifacts,
  onCancelRun,
  onDownloadAllArtifacts,
  comparisonViewMode,
  setComparisonViewMode,
  sliderPosition,
  setSliderPosition,
  onionSkinOpacity,
  setOnionSkinOpacity,
  diffOverlayOpacity,
  setDiffOverlayOpacity,
  imageZoomLevel,
  setImageZoomLevel,
  baselineContainerRef,
  currentContainerRef,
  diffContainerRef,
  handleSyncScroll,
  onOpenLightbox,
  onApproveBaseline,
  onRejectChanges,
  a11ySeverityFilter,
  setA11ySeverityFilter,
  a11yCategoryFilter,
  setA11yCategoryFilter,
  a11ySearchQuery,
  setA11ySearchQuery,
  token,
  formatDateTime,
}: CurrentRunStatusSectionProps) {
  const hasResults = currentRun.results && currentRun.results.length > 0;
  const isCompleted = currentRun.status === 'passed' || currentRun.status === 'failed' || currentRun.status === 'error';
  const [waveExpanded, setWaveExpanded] = useState(true);

  // Feature #539: Map run status to WaveProgressCard status
  const waveStatus: WaveProgressStatus = useMemo(() => {
    switch (currentRun.status) {
      case 'passed': return 'completed';
      case 'failed':
      case 'error': return 'failed';
      case 'running': return 'running';
      case 'pending': return 'waiting';
      case 'warning': return 'completed'; // warning is a completed state
      default: return 'waiting';
    }
  }, [currentRun.status]);

  // Feature #539 + #552: Build steps from test results or live progress for WaveProgressCard
  const waveSteps: WaveProgressStep[] = useMemo(() => {
    // If running, build steps from liveProgress for real-time feedback
    if (currentRun.status === 'running' && liveProgress?.currentStep) {
      const totalSteps = liveProgress.currentStep.total || 1;
      const currentStepIndex = liveProgress.currentStep.index || 0;
      const steps: WaveProgressStep[] = [];

      for (let i = 0; i < totalSteps; i++) {
        let status: 'completed' | 'running' | 'pending' | 'failed';
        if (i < currentStepIndex) {
          status = 'completed';
        } else if (i === currentStepIndex) {
          status = 'running';
        } else {
          status = 'pending';
        }

        steps.push({
          name: i === currentStepIndex && liveProgress.currentStep.action
            ? liveProgress.currentStep.action
            : `Step ${i + 1}`,
          status,
        });
      }
      return steps;
    }

    // If completed, use results
    if (!hasResults || !currentRun.results) return [];
    // Flatten all result steps into WaveProgressStep format
    const steps: WaveProgressStep[] = [];
    for (const result of currentRun.results) {
      if (result.steps && result.steps.length > 0) {
        for (const step of result.steps) {
          steps.push({
            name: step.action || `Step ${steps.length + 1}`,
            status: step.status === 'passed' ? 'completed' :
                    step.status === 'failed' ? 'failed' : 'pending',
            duration: step.duration_ms,
          });
        }
      }
    }
    return steps;
  }, [hasResults, currentRun.results, currentRun.status, liveProgress]);

  // Feature #539: Build score items from result data for ScoreCardGrid
  const scoreItems = useMemo(() => {
    if (!hasResults || !currentRun.results) return [];
    const items: Array<{ score: number; label: string }> = [];
    const result = currentRun.results[0];
    if (!result) return items;

    // Calculate step pass rate
    if (result.steps && result.steps.length > 0) {
      const passedSteps = result.steps.filter(s => s.status === 'passed').length;
      const passRate = Math.round((passedSteps / result.steps.length) * 100);
      items.push({ score: passRate, label: 'Steps Passed' });
    }

    // Lighthouse scores if available
    const lighthouse = (result as unknown as Record<string, unknown>).lighthouse as Record<string, unknown> | undefined;
    if (lighthouse) {
      if (typeof lighthouse.performance === 'number') items.push({ score: lighthouse.performance, label: 'Performance' });
      if (typeof lighthouse.accessibility === 'number') items.push({ score: lighthouse.accessibility, label: 'Accessibility' });
      if (typeof lighthouse.bestPractices === 'number') items.push({ score: lighthouse.bestPractices, label: 'Best Practices' });
      if (typeof lighthouse.seo === 'number') items.push({ score: lighthouse.seo, label: 'SEO' });
    }

    return items;
  }, [hasResults, currentRun.results]);

  // Feature #539: Determine wave icon based on status
  const waveIcon = useMemo(() => {
    switch (currentRun.status) {
      case 'passed': return CheckCircle2;
      case 'failed':
      case 'error': return XCircle;
      case 'running': return Play;
      case 'warning': return AlertTriangle;
      default: return Clock;
    }
  }, [currentRun.status]);

  return (
    <div className="mt-8 rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Current Run</h2>
        {/* Download All Artifacts Button */}
        {hasResults && isCompleted && (
          <button
            onClick={() => onDownloadAllArtifacts(currentRun.id)}
            disabled={isDownloadingArtifacts}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
          >
            {isDownloadingArtifacts ? (
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            )}
            {isDownloadingArtifacts ? 'Downloading...' : 'Download All Artifacts'}
          </button>
        )}
      </div>
      <div>
        {/* Feature #539: WaveProgressCard replaces plain status badge */}
        <WaveProgressCard
          status={waveStatus}
          icon={waveIcon}
          title={currentRun.status === 'running' && liveProgress?.currentStep?.action
            ? liveProgress.currentStep.action
            : `Test Run: ${currentRun.status.charAt(0).toUpperCase() + currentRun.status.slice(1)}`}
          subtitle={currentRun.duration_ms !== undefined ? `Completed in ${currentRun.duration_ms}ms` : undefined}
          duration={currentRun.duration_ms}
          expanded={waveExpanded}
          onToggle={() => setWaveExpanded(!waveExpanded)}
          steps={waveSteps.length > 0 ? waveSteps : undefined}
          animate={currentRun.status === 'running'}
        >
          {/* Feature #552: Live screenshot thumbnail when running */}
          {currentRun.status === 'running' && liveScreenshot && (
            <div className="mt-3 pt-3 border-t border-border">
              <div className="flex items-center gap-3 mb-2">
                <div className="relative">
                  <div className="h-2 w-2 bg-primary rounded-full animate-ping absolute"></div>
                  <div className="h-2 w-2 bg-primary rounded-full relative"></div>
                </div>
                <span className="text-xs font-medium text-muted-foreground">Live Screenshot</span>
              </div>
              <img
                src={liveScreenshot.startsWith('data:') ? liveScreenshot : `data:image/png;base64,${liveScreenshot}`}
                alt="Live screenshot"
                className="w-full max-h-32 object-contain bg-black/20 rounded-lg"
              />
            </div>
          )}

          {/* Feature #552: Live progress info when running */}
          {currentRun.status === 'running' && liveProgress && (
            <div className="mt-3 pt-3 border-t border-border">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {test?.test_type === 'load' && liveProgress.k6Metrics
                    ? `${liveProgress.k6Metrics.phase || 'Running'} - ${liveProgress.k6Metrics.progress}%`
                    : `Step ${(liveProgress.currentStep?.index || 0) + 1} of ${liveProgress.currentStep?.total || '?'}`
                  }
                </span>
                <span>
                  {test?.test_type === 'load' && liveProgress.k6Metrics
                    ? `${liveProgress.k6Metrics.currentVUs || 0} VUs`
                    : `${liveProgress.completedTests || 0}/${liveProgress.totalTests || 1} tests`
                  }
                </span>
              </div>
              {/* Mini progress bar */}
              <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{
                    width: `${
                      test?.test_type === 'load' && liveProgress.k6Metrics
                        ? liveProgress.k6Metrics.progress
                        : liveProgress.currentStep
                          ? Math.round(((liveProgress.currentStep.index + 1) / Math.max(liveProgress.currentStep.total, 1)) * 100)
                          : 0
                    }%`
                  }}
                />
              </div>
            </div>
          )}

          {/* Feature #539: ScoreCardGrid for run metrics when results available */}
          {scoreItems.length > 0 && isCompleted && (
            <div className="mt-3 pt-3 border-t border-border">
              <ScoreCardGrid items={scoreItems} size="sm" showIcon />
            </div>
          )}
        </WaveProgressCard>

        {/* Live Execution Panel */}
        <LiveExecutionPanel
          currentRun={currentRun}
          test={test}
          liveProgress={liveProgress}
          liveScreenshot={liveScreenshot}
          liveConsoleLogs={liveConsoleLogs}
          isCancellingRun={isCancellingRun}
          onCancelRun={onCancelRun}
        />

        {/* Test Results */}
        {hasResults && (
          <div className="mt-4 space-y-4">
            {currentRun.results!.map((result) => (
              <TestResultCard
                key={result.test_id}
                // Type cast needed: TestRunResult.steps differs from TestResult.steps (step_id field)
                result={result as unknown as TestResult}
                testType={test?.test_type}
                token={token}
                comparisonViewMode={comparisonViewMode}
                setComparisonViewMode={setComparisonViewMode}
                sliderPosition={sliderPosition}
                setSliderPosition={setSliderPosition}
                onionSkinOpacity={onionSkinOpacity}
                setOnionSkinOpacity={setOnionSkinOpacity}
                diffOverlayOpacity={diffOverlayOpacity}
                setDiffOverlayOpacity={setDiffOverlayOpacity}
                imageZoomLevel={imageZoomLevel}
                setImageZoomLevel={setImageZoomLevel}
                baselineContainerRef={baselineContainerRef}
                currentContainerRef={currentContainerRef}
                diffContainerRef={diffContainerRef}
                handleSyncScroll={handleSyncScroll}
                onOpenLightbox={onOpenLightbox}
                onApproveBaseline={onApproveBaseline}
                onRejectChanges={onRejectChanges}
                a11ySeverityFilter={a11ySeverityFilter as Record<string, string>}
                // Type cast needed: SetStateAction union types incompatible with string record setter
                setA11ySeverityFilter={setA11ySeverityFilter as unknown as (filters: Record<string, string>) => void}
                a11yCategoryFilter={a11yCategoryFilter as Record<string, string>}
                // Type cast needed: SetStateAction union types incompatible with string record setter
                setA11yCategoryFilter={setA11yCategoryFilter as unknown as (filters: Record<string, string>) => void}
                a11ySearchQuery={a11ySearchQuery}
                setA11ySearchQuery={setA11ySearchQuery}
                formatDateTime={formatDateTime}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export type { CurrentRunStatusSectionProps };
