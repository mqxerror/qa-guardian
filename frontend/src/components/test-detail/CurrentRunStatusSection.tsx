// Feature #48: CurrentRunStatusSection - Extracted from TestDetailPage.tsx
// Feature #539: Integrated WaveProgressCard + ScoreCardGrid for richer run display
// Feature #552: Enhanced WaveProgressCard with live step execution and screenshot thumbnail
// Feature #573: Consolidated duplicate displays - WaveProgressCard collapsed shows summary, expanded shows full LiveExecutionPanel
// Displays current run header, status badge, live execution, and test results

import React, { useState, useMemo, RefObject, Dispatch, SetStateAction } from 'react';
import { Play, CheckCircle2, XCircle, Clock, AlertTriangle, Loader2, Download } from 'lucide-react';
import { LiveExecutionPanel } from './LiveExecutionPanel';
import { TestResultCard, TestResult } from './TestResultCard';
// Feature #566: Import canonical LiveProgress & ConsoleLogEntry from types.ts
import { TestRunType, TestType, LiveProgress, ConsoleLogEntry } from './types';
import { WaveProgressCard, type WaveProgressStatus, type WaveProgressStep } from '../ui/wave-progress-card';
import { ScoreCardGrid } from '../ui/score-card';

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

// Feature #574: Wrapped in React.memo to prevent re-renders from unrelated state changes
function CurrentRunStatusSectionInner({
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
  const isRunning = currentRun.status === 'running' || currentRun.status === 'pending';
  // Feature #573: Start collapsed when running (click to expand for full LiveExecutionPanel)
  const [waveExpanded, setWaveExpanded] = useState(!isRunning);

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

    // Feature #568: Access lighthouse from step results (not result directly)
    // Lighthouse data lives in individual steps, not at the TestRunResult level
    const lighthouseStep = result.steps?.find(s => s.lighthouse);
    if (lighthouseStep?.lighthouse) {
      const lh = lighthouseStep.lighthouse;
      if (typeof lh.performance === 'number') items.push({ score: lh.performance, label: 'Performance' });
      if (typeof lh.accessibility === 'number') items.push({ score: lh.accessibility, label: 'Accessibility' });
      if (typeof lh.bestPractices === 'number') items.push({ score: lh.bestPractices, label: 'Best Practices' });
      if (typeof lh.seo === 'number') items.push({ score: lh.seo, label: 'SEO' });
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
              <Loader2 className="animate-spin h-4 w-4" />
            ) : (
              <Download className="h-4 w-4" />
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
          subtitle={currentRun.duration_ms != null && currentRun.status !== 'pending' && currentRun.status !== 'running'
            ? `Completed in ${Math.round(currentRun.duration_ms / 1000)}s`
            : currentRun.status === 'pending' ? 'Waiting for worker...' : undefined}
          duration={currentRun.duration_ms}
          expanded={waveExpanded}
          onToggle={() => setWaveExpanded(!waveExpanded)}
          steps={waveSteps.length > 0 ? waveSteps : undefined}
          animate={currentRun.status === 'running'}
        >
          {/* Feature #573: Collapsed view — mini screenshot when not expanded and running */}
          {isRunning && !waveExpanded && liveScreenshot && (
            <div className="mt-3 pt-3 border-t border-border">
              <div className="flex items-center gap-3 mb-2">
                <div className="relative">
                  <div className="h-2 w-2 bg-primary rounded-full animate-ping absolute"></div>
                  <div className="h-2 w-2 bg-primary rounded-full relative"></div>
                </div>
                <span className="text-xs font-medium text-muted-foreground">Live Screenshot — click to expand</span>
              </div>
              <img
                src={liveScreenshot.startsWith('data:') ? liveScreenshot : `data:image/png;base64,${liveScreenshot}`}
                alt="Live screenshot"
                className="w-full max-h-32 object-contain bg-black/20 rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setWaveExpanded(true)}
              />
            </div>
          )}

          {/* Feature #573: Collapsed view — mini progress bar when not expanded and running */}
          {isRunning && !waveExpanded && liveProgress && (
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

          {/* Feature #573: Expanded view — full LiveExecutionPanel when expanded and running */}
          {isRunning && waveExpanded && (
            <div className="mt-3 pt-3 border-t border-border">
              <LiveExecutionPanel
                currentRun={currentRun}
                test={test}
                liveProgress={liveProgress}
                liveScreenshot={liveScreenshot}
                liveConsoleLogs={liveConsoleLogs}
                isCancellingRun={isCancellingRun}
                onCancelRun={onCancelRun}
              />
            </div>
          )}

          {/* Feature #539: ScoreCardGrid for run metrics when results available */}
          {scoreItems.length > 0 && isCompleted && (
            <div className="mt-3 pt-3 border-t border-border">
              <ScoreCardGrid items={scoreItems} size="sm" showIcon />
            </div>
          )}
        </WaveProgressCard>

        {/* Test Results */}
        {hasResults && (
          <div className="mt-4 space-y-4">
            {currentRun.results!.map((result) => (
              <TestResultCard
                key={result.test_id}
                // Feature #568: Kept single as-unknown-as (a11y_results shape differs between types.ts and test-result-card)
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
                setA11ySeverityFilter={setA11ySeverityFilter as React.Dispatch<React.SetStateAction<Record<string, string>>>}
                a11yCategoryFilter={a11yCategoryFilter as Record<string, string>}
                setA11yCategoryFilter={setA11yCategoryFilter as React.Dispatch<React.SetStateAction<Record<string, string>>>}
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

export const CurrentRunStatusSection = React.memo(CurrentRunStatusSectionInner);
export type { CurrentRunStatusSectionProps };
