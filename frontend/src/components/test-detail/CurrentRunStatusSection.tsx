// Feature #48: CurrentRunStatusSection - Extracted from TestDetailPage.tsx
// Displays current run header, status badge, live execution, and test results

import { RefObject, Dispatch, SetStateAction } from 'react';
import { LiveExecutionPanel } from './LiveExecutionPanel';
import { TestResultCard, TestResult } from './TestResultCard';
import { TestRunType, TestType } from './types';

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
        <div className="flex items-center gap-4">
          {/* Feature #1979: Added 'warning' status styling for accessibility tests */}
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${
            currentRun.status === 'passed' ? 'bg-green-100 text-green-700' :
            currentRun.status === 'failed' ? 'bg-red-100 text-red-700' :
            currentRun.status === 'warning' ? 'bg-amber-100 text-amber-700' :
            currentRun.status === 'running' ? 'bg-blue-100 text-blue-700' :
            currentRun.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
            'bg-gray-100 text-gray-700'
          }`}>
            {currentRun.status}
          </span>
          {currentRun.duration_ms !== undefined && (
            <span className="text-sm text-muted-foreground">
              Duration: {currentRun.duration_ms}ms
            </span>
          )}
        </div>

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
