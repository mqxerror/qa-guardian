/**
 * SuiteRunResults Component
 * Feature #50: Extract suite run results display from TestSuitePage.tsx
 * Feature #35: Live screenshot panel during test execution
 * Feature #525: Added ScoreCard for suite pass rate metrics
 * Feature #547: WaveProgressCard grid for running tests with animated status borders
 * Feature #576: Hybrid scaling for large test suites (full cards ≤8, compact 9-20, virtualized 20+)
 * Feature #1065: Healed selector indicator
 * Feature #1072: Selector diff visualization
 * Feature #1073: Confidence meter visualization
 * Feature #1074: Quick link to healing options
 */

import React, { useState, useMemo } from 'react';
import { FlaskConical, CheckCircle2, XCircle, Clock, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import type { EditSelectorModalState } from './modals';
import { ScoreCard } from '../ui/score-card';
import { WaveProgressCard, type WaveProgressStatus, type StepStatus } from '../ui/wave-progress-card';
import type { TestRunStatus, CurrentStepProgress } from '../../hooks/useSuiteRunSocket';

export interface LiveScreenshot {
 base64: string;
 testName: string;
 stepIndex: number;
 stepAction: string;
 stepSelector?: string;
 timestamp: number;
}

export interface ScreenshotHistoryItem {
 base64: string;
 stepIndex: number;
 stepAction: string;
 timestamp: number;
}

interface SuiteRun {
 id: string;
 status: 'pending' | 'running' | 'passed' | 'failed' | 'cancelled';
 duration_ms?: number;
 results?: SuiteRunResult[];
}

interface SuiteRunResult {
 test_id: string;
 test_name: string;
 test_type?: string;
 status: 'passed' | 'failed' | 'skipped' | 'error' | 'running';
 duration_ms: number;
 error?: string;
 diff_percentage?: number;
 visual_comparison?: {
 hasBaseline: boolean;
 mismatchedPixels?: number;
 };
 steps?: SuiteRunStep[];
}

interface SuiteRunStep {
 id: string;
 action: string;
 status: 'passed' | 'failed' | 'skipped';
 duration_ms: number;
 selector?: string;
 original_selector?: string;
 healed_selector?: string;
 was_healed?: boolean;
 manual_override?: boolean;
 healing_strategy?: string;
 healing_confidence?: number;
 metadata?: {
 maskSelectorWarnings?: string[];
 warnings?: string[];
 errorType?: string;
 sslErrorCode?: string;
 sslErrorDescription?: string;
 securityImplication?: string;
 ignoreSSLEnabled?: boolean;
 };
}

// Feature #547: Test info for WaveProgressCard grid
interface TestInfo {
 id: string;
 name: string;
 steps?: { action: string; selector?: string }[];
}

interface SuiteRunResultsProps {
 suiteRun: SuiteRun | null;
 suite: { project_id: string } | null;
 tests: TestInfo[];
 isCancellingSuite: boolean;
 liveScreenshot: LiveScreenshot | null;
 screenshotHistory: ScreenshotHistoryItem[];
 // Feature #547: Per-test status from useSuiteRunSocket
 perTestStatus?: Map<string, TestRunStatus>;
 currentStep?: CurrentStepProgress | null;
 onCancelSuiteRun: () => void;
 onExpandScreenshot: (base64: string) => void;
 onEditSelector: (state: EditSelectorModalState) => void;
 onNavigate: (path: string) => void;
}

export function SuiteRunResults({
 suiteRun,
 suite,
 tests,
 isCancellingSuite,
 liveScreenshot,
 screenshotHistory,
 perTestStatus,
 currentStep,
 onCancelSuiteRun,
 onExpandScreenshot,
 onEditSelector,
 onNavigate,
}: SuiteRunResultsProps) {
 // Feature #547: Track which test cards are expanded
 const [expandedTestIds, setExpandedTestIds] = useState<Set<string>>(new Set());
 // Feature #576: Show all tests toggle for 20+ test suites
 const [showAllTests, setShowAllTests] = useState(false);

 if (!suiteRun) return null;

 const completedCount = suiteRun.results?.length || 0;
 const totalCount = tests.length;
 const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

 // Feature #547: Convert TestRunStatus to WaveProgressStatus
 const getWaveStatus = (testId: string): WaveProgressStatus => {
  const status = perTestStatus?.get(testId);
  if (!status || status === 'waiting') return 'waiting';
  if (status === 'running') return 'running';
  if (status === 'passed') return 'completed';
  if (status === 'failed' || status === 'error') return 'failed';
  if (status === 'skipped') return 'skipped';
  return 'waiting';
 };

 // Feature #547: Get step status based on current step progress
 const getStepProgress = (test: TestInfo): { name: string; status: StepStatus; duration?: number }[] => {
  if (!test.steps || test.steps.length === 0) return [];

  const isCurrentTest = currentStep?.testId === test.id;
  const currentStepIndex = isCurrentTest ? currentStep?.stepIndex || 0 : -1;
  const testStatus = perTestStatus?.get(test.id);

  return test.steps.map((step, idx) => {
   let status: StepStatus = 'pending';

   if (testStatus === 'passed') {
    status = 'completed';
   } else if (testStatus === 'failed' || testStatus === 'error') {
    // If failed, mark steps up to failure point as completed, failure step as failed
    status = idx < currentStepIndex ? 'completed' : idx === currentStepIndex ? 'failed' : 'pending';
   } else if (testStatus === 'running' && isCurrentTest) {
    status = idx < currentStepIndex ? 'completed' : idx === currentStepIndex ? 'running' : 'pending';
   } else if (testStatus === 'waiting' || !testStatus) {
    status = 'pending';
   }

   return {
    name: step.action + (step.selector ? ` ${step.selector.slice(0, 30)}...` : ''),
    status,
   };
  });
 };

 // Feature #547: Toggle test card expansion
 const toggleTestExpanded = (testId: string) => {
  setExpandedTestIds(prev => {
   const next = new Set(prev);
   if (next.has(testId)) {
    next.delete(testId);
   } else {
    next.add(testId);
   }
   return next;
  });
 };

 // Feature #576: Determine display mode based on test count
 const displayMode: 'full' | 'compact' | 'virtualized' = tests.length <= 8 ? 'full' : tests.length <= 20 ? 'compact' : 'virtualized';

 // Feature #576: Get status icon for compact rows
 const getCompactStatusIcon = (status: WaveProgressStatus) => {
  switch (status) {
   case 'completed': return <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />;
   case 'failed': return <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />;
   case 'running': return <Loader2 className="h-4 w-4 text-primary animate-spin flex-shrink-0" />;
   case 'skipped': return <Clock className="h-4 w-4 text-warning flex-shrink-0" />;
   default: return <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />;
  }
 };

 // Feature #576: Compute step progress for compact row bar
 const getCompactProgress = (test: TestInfo): number => {
  const steps = getStepProgress(test);
  if (steps.length === 0) return 0;
  const completed = steps.filter(s => s.status === 'completed' || s.status === 'running').length;
  return Math.round((completed / steps.length) * 100);
 };

 // Feature #576: Visible tests for 20+ virtualized mode
 const visibleTests = displayMode === 'virtualized' && !showAllTests ? tests.slice(0, 20) : tests;
 const hiddenCount = tests.length - visibleTests.length;

 return (
 <div className="mt-6 rounded-lg border border-border bg-card p-6">
 <h2 className="text-xl font-semibold text-foreground mb-4">Suite Run</h2>

 {/* Status and Duration */}
 <div className="flex items-center gap-4 mb-4">
 <span className={`rounded-full px-3 py-1 text-sm font-medium ${
 suiteRun.status === 'passed' ? 'bg-success/10 text-success' :
 suiteRun.status === 'failed' ? 'bg-destructive/10 text-destructive' :
 suiteRun.status === 'running' ? 'bg-primary/10 text-primary' :
 suiteRun.status === 'pending' ? 'bg-warning/10 text-warning' :
 suiteRun.status === 'cancelled' ? 'bg-warning/10 text-warning' :
 'bg-muted text-foreground'
 }`}>
 {suiteRun.status}
 </span>
 {suiteRun.duration_ms && (
 <span className="text-sm text-muted-foreground">
 Duration: {suiteRun.duration_ms}ms
 </span>
 )}
 </div>

 {/* Progress indicator for running suite */}
 {(suiteRun.status === 'running' || suiteRun.status === 'pending') && (
 <div className="mb-4">
 <div className="flex items-center justify-between mb-2">
 <span className="text-sm font-medium text-foreground">
 {suiteRun.status === 'pending' ? 'Preparing tests...' : 'Running tests...'}
 </span>
 <span className="text-sm text-muted-foreground">
 {completedCount} / {totalCount} tests completed
 {totalCount > 0 && ` (${progressPercent}%)`}
 </span>
 </div>
 <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
 <div
 className="h-full bg-primary transition-all duration-300 ease-out"
 style={{ width: `${progressPercent}%` }}
 />
 </div>
 {suiteRun.status === 'running' && (
 <div className="mt-2 flex items-center justify-between">
 <div className="flex items-center gap-2 text-sm text-muted-foreground">
 <svg aria-hidden="true" className="animate-spin h-4 w-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
 </svg>
 Running test {completedCount + 1}...
 </div>
 <button
 onClick={onCancelSuiteRun}
 disabled={isCancellingSuite}
 className="rounded-md bg-destructive px-3 py-1 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
 >
 {isCancellingSuite ? 'Cancelling...' : 'Cancel'}
 </button>
 </div>
 )}

 {/* Feature #547: WaveProgressCard grid for running tests */}
 {/* Feature #576: Hybrid scaling - full cards ≤8, compact rows 9-20, virtualized 20+ */}
 {tests.length > 0 && perTestStatus && (
 <div className="mt-4">
  <h4 className="text-sm font-medium text-foreground mb-3">
   Test Progress ({tests.length} tests)
  </h4>

  {/* Mode 1: Full WaveProgressCard grid for ≤8 tests */}
  {displayMode === 'full' && (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
   {tests.map((test) => {
    const waveStatus = getWaveStatus(test.id);
    const steps = getStepProgress(test);
    const isCurrentTest = currentStep?.testId === test.id;
    return (
     <WaveProgressCard
      key={test.id}
      status={waveStatus}
      icon={FlaskConical}
      title={test.name}
      subtitle={
       isCurrentTest && currentStep
        ? `Step ${currentStep.stepIndex + 1}/${currentStep.totalSteps}: ${currentStep.action}`
        : undefined
      }
      expanded={expandedTestIds.has(test.id)}
      onToggle={() => toggleTestExpanded(test.id)}
      steps={steps}
      animate={waveStatus === 'running'}
      className="min-h-[80px]"
     />
    );
   })}
  </div>
  )}

  {/* Mode 2 & 3: Compact single-line rows for 9+ tests */}
  {(displayMode === 'compact' || displayMode === 'virtualized') && (
  <div className="space-y-1">
   {visibleTests.map((test) => {
    const waveStatus = getWaveStatus(test.id);
    const progress = getCompactProgress(test);
    const isCurrentTest = currentStep?.testId === test.id;
    return (
     <div
      key={test.id}
      className={`flex items-center gap-3 rounded-md border px-3 py-2 transition-colors ${
       waveStatus === 'running' ? 'border-primary/50 bg-primary/5' :
       waveStatus === 'failed' ? 'border-destructive/30 bg-destructive/5' :
       waveStatus === 'completed' ? 'border-success/30' :
       'border-border'
      }`}
     >
      {getCompactStatusIcon(waveStatus)}
      <span className="text-sm font-medium text-foreground truncate flex-1 min-w-0">
       {test.name}
      </span>
      {/* Progress bar */}
      <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden flex-shrink-0">
       <div
        className={`h-full rounded-full transition-all duration-300 ${
         waveStatus === 'failed' ? 'bg-destructive' :
         waveStatus === 'completed' ? 'bg-success' :
         'bg-primary'
        }`}
        style={{ width: `${waveStatus === 'completed' ? 100 : progress}%` }}
       />
      </div>
      {/* Step info */}
      <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0 w-16 text-right">
       {isCurrentTest && currentStep
        ? `${currentStep.stepIndex + 1}/${currentStep.totalSteps}`
        : waveStatus === 'completed' ? 'Done' : waveStatus === 'failed' ? 'Failed' : '—'
       }
      </span>
     </div>
    );
   })}
   {/* Feature #576: Show all / show less toggle for 20+ tests */}
   {displayMode === 'virtualized' && tests.length > 20 && (
    <button
     onClick={() => setShowAllTests(!showAllTests)}
     className="w-full flex items-center justify-center gap-2 py-2 text-sm text-primary hover:text-primary/80 transition-colors"
    >
     {showAllTests ? (
      <><ChevronUp className="h-4 w-4" /> Show less</>
     ) : (
      <><ChevronDown className="h-4 w-4" /> Show all {tests.length} tests ({hiddenCount} more)</>
     )}
    </button>
   )}
  </div>
  )}
 </div>
 )}

 {/* Feature #35: Live Screenshot Panel */}
 {liveScreenshot && (
 <LiveScreenshotPanel
 liveScreenshot={liveScreenshot}
 screenshotHistory={screenshotHistory}
 onExpandScreenshot={onExpandScreenshot}
 />
 )}

 {/* Placeholder when no live screenshot yet */}
 {!liveScreenshot && !perTestStatus && (
 <div className="mt-4 rounded-lg border border-dashed border-border bg-muted p-4">
 <div className="flex items-center gap-2 text-sm text-muted-foreground">
 <svg className="h-5 w-5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
 </svg>
 <span>Screenshots will appear here as tests run...</span>
 </div>
 </div>
 )}
 </div>
 )}

 {/* Cancelled indicator */}
 {suiteRun.status === 'cancelled' && (
 <div className="mb-4 flex items-center gap-2 text-sm">
 <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-warning" viewBox="0 0 20 20" fill="currentColor">
 <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
 </svg>
 <span className="text-warning font-medium">Test run cancelled</span>
 </div>
 )}

 {/* Feature #525: Suite Pass Rate ScoreCard on completion */}
 {(suiteRun.status === 'passed' || suiteRun.status === 'failed') && suiteRun.results && (
 <div className="mb-4">
   <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
     <ScoreCard
       score={Math.round(
         (suiteRun.results.filter(r => r.status === 'passed').length / suiteRun.results.length) * 100
       )}
       label="Pass Rate"
       size="sm"
     />
     <div className="p-3 rounded-lg bg-success/20 text-center">
       <div className="text-xl font-bold text-success">
         {suiteRun.results.filter(r => r.status === 'passed').length}
       </div>
       <div className="text-xs text-muted-foreground mt-0.5">Passed</div>
     </div>
     <div className="p-3 rounded-lg bg-destructive/20 text-center">
       <div className="text-xl font-bold text-destructive">
         {suiteRun.results.filter(r => r.status === 'failed').length}
       </div>
       <div className="text-xs text-muted-foreground mt-0.5">Failed</div>
     </div>
     <div className="p-3 rounded-lg bg-muted text-center">
       <div className="text-xl font-bold text-foreground">
         {suiteRun.results.length}
       </div>
       <div className="text-xs text-muted-foreground mt-0.5">Total</div>
     </div>
   </div>
   <div className="flex items-center gap-2 text-sm">
     {suiteRun.status === 'passed' ? (
       <>
         <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-success" viewBox="0 0 20 20" fill="currentColor">
           <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
         </svg>
         <span className="text-success font-medium">All tests passed!</span>
       </>
     ) : (
       <>
         <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-destructive" viewBox="0 0 20 20" fill="currentColor">
           <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
         </svg>
         <span className="text-destructive font-medium">
           {suiteRun.results?.filter(r => r.status === 'failed').length || 0} test(s) failed
         </span>
       </>
     )}
   </div>
 </div>
 )}

 {/* Test Results */}
 {suiteRun.results && suiteRun.results.length > 0 && (
 <div className="space-y-3">
 <h3 className="text-lg font-medium text-foreground">Test Results ({suiteRun.results.length} tests)</h3>
 {suiteRun.results.map((result, idx) => (
 <TestResultItem
 key={idx}
 result={result}
 suiteRunId={suiteRun.id}
 projectId={suite?.project_id}
 onEditSelector={onEditSelector}
 onNavigate={onNavigate}
 />
 ))}
 </div>
 )}
 </div>
 );
}

// Sub-component for Live Screenshot Panel
function LiveScreenshotPanel({
 liveScreenshot,
 screenshotHistory,
 onExpandScreenshot,
}: {
 liveScreenshot: LiveScreenshot;
 screenshotHistory: ScreenshotHistoryItem[];
 onExpandScreenshot: (base64: string) => void;
}) {
 return (
 <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
 <div className="flex items-center justify-between mb-3">
 <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
 <svg className="h-4 w-4 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
 </svg>
 Live Screenshot
 </h3>
 <span className="text-xs text-primary">
 {liveScreenshot.testName}
 </span>
 </div>

 {/* Step label */}
 <div className="mb-2 text-xs text-primary flex items-center gap-2">
 <span className="font-medium">Step {liveScreenshot.stepIndex + 1}:</span>
 <span className="font-mono bg-primary/10 px-1.5 py-0.5 rounded">
 {liveScreenshot.stepAction}
 </span>
 {liveScreenshot.stepSelector && (
 <span className="text-primary truncate max-w-[200px]" title={liveScreenshot.stepSelector}>
 {liveScreenshot.stepSelector}
 </span>
 )}
 </div>

 {/* Main screenshot */}
 <div
 className="relative rounded-md overflow-hidden border border-primary/20 cursor-pointer"
 onClick={() => onExpandScreenshot(liveScreenshot.base64)}
 >
 <img
 src={`data:image/jpeg;base64,${liveScreenshot.base64}`}
 alt={`Live screenshot - Step ${liveScreenshot.stepIndex + 1}`}
 className="w-full max-h-[300px] object-contain bg-muted"
 />
 <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
 <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
 </svg>
 Click to expand
 </div>
 </div>

 {/* Thumbnail history */}
 {screenshotHistory.length > 1 && (
 <div className="mt-3">
 <div className="text-xs text-primary mb-2">Recent Screenshots</div>
 <div className="flex gap-2">
 {screenshotHistory.map((screenshot) => (
 <button
 key={screenshot.timestamp}
 onClick={() => onExpandScreenshot(screenshot.base64)}
 className={`relative rounded overflow-hidden border-2 transition-all hover:scale-105 ${
 screenshot.timestamp === liveScreenshot.timestamp
 ? 'border-primary ring-2 ring-primary/50'
 : 'border-border opacity-70 hover:opacity-100'
 }`}
 >
 <img
 src={`data:image/jpeg;base64,${screenshot.base64}`}
 alt={`Step ${screenshot.stepIndex + 1}`}
 className="w-16 h-12 object-cover"
 />
 <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[9px] px-1 py-0.5 truncate">
 {screenshot.stepAction}
 </div>
 </button>
 ))}
 </div>
 </div>
 )}
 </div>
 );
}

// Sub-component for individual test result
function TestResultItem({
 result,
 suiteRunId,
 projectId,
 onEditSelector,
 onNavigate,
}: {
 result: SuiteRunResult;
 suiteRunId: string;
 projectId?: string;
 onEditSelector: (state: EditSelectorModalState) => void;
 onNavigate: (path: string) => void;
}) {
 return (
 <div
 className="rounded-md border border-border p-4 hover:border-primary/50 hover:bg-muted/30 transition-colors cursor-pointer group"
 onClick={(e) => {
 // Feature #1825: Click on test row to view details
 if ((e.target as HTMLElement).closest('button, a')) return;
 if (result.test_id) {
 onNavigate(`/tests/${result.test_id}`);
 }
 }}
 >
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
 result.status === 'passed' ? 'bg-success/10 text-success' :
 result.status === 'failed' ? 'bg-destructive/10 text-destructive' :
 'bg-muted text-foreground'
 }`}>
 {result.status}
 </span>
 <span className="font-medium text-foreground group-hover:text-primary transition-colors">{result.test_name}</span>
 {/* Visual test indicator */}
 {result.test_type === 'visual_regression' && (
 <span className="inline-flex items-center gap-1 text-xs text-accent">
 <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
 </svg>
 Visual
 </span>
 )}
 {/* Visual test diff percentage badge */}
 {result.diff_percentage !== undefined && (
 <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
 result.diff_percentage === 0
 ? 'bg-success/10 text-success'
 : result.diff_percentage > 1
 ? 'bg-destructive/10 text-destructive'
 : 'bg-warning/10 text-warning'
 }`}>
 {result.diff_percentage === 0 ? '✓ Match' : `${result.diff_percentage.toFixed(2)}% diff`}
 </span>
 )}
 {/* Baseline created indicator */}
 {result.visual_comparison?.hasBaseline === false && (
 <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
 📸 New Baseline
 </span>
 )}
 </div>
 <div className="flex items-center gap-2">
 <span className="text-sm text-muted-foreground">{result.duration_ms}ms</span>
 {/* Feature #1825: Link to test/run details */}
 {result.test_id && (
 <button
 onClick={() => onNavigate(`/tests/${result.test_id}`)}
 className="text-xs text-primary hover:text-primary/80 underline"
 >
 View Test
 </button>
 )}
 {suiteRunId && (
 <button
 onClick={() => onNavigate(`/runs/${suiteRunId}`)}
 className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded border border-primary/20"
 >
 <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
 </svg>
 Run Details
 </button>
 )}
 </div>
 </div>

 {result.error && (
 <p className="mt-2 text-sm text-destructive">{result.error}</p>
 )}

 {/* Feature #1074: Quick link to healing options for failed tests */}
 {result.status === 'failed' && result.test_id && (
 <div className="mt-2 p-2 bg-accent/5 rounded border border-accent/20">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2 text-sm text-accent">
 <span>🔧</span>
 <span>AI healing may help fix selector issues automatically</span>
 </div>
 <button
 onClick={() => {
 if (projectId) {
 onNavigate(`/projects/${projectId}#healing-settings`);
 } else {
 onNavigate(`/tests/${result.test_id}`);
 }
 }}
 className="px-3 py-1 text-xs font-medium rounded bg-accent text-accent-foreground hover:bg-accent/90 transition-colors flex items-center gap-1"
 >
 <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <path d="M12 20h9"/>
 <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
 </svg>
 View Healing Options
 </button>
 </div>
 </div>
 )}

 {/* Visual comparison summary */}
 {result.visual_comparison?.hasBaseline && result.diff_percentage !== undefined && result.diff_percentage > 0 && (
 <div className="mt-2 p-2 bg-warning/5 rounded border border-warning/20">
 <div className="flex items-center gap-2 text-sm text-warning">
 <span>🔍</span>
 <span>
 Visual difference detected: {result.visual_comparison.mismatchedPixels?.toLocaleString()} pixels differ ({result.diff_percentage.toFixed(2)}%)
 </span>
 </div>
 </div>
 )}

 {/* Step results */}
 {result.steps && result.steps.length > 0 && (
 <div className="mt-2 space-y-1">
 {result.steps.map((step, stepIdx) => (
 <StepResultItem
 key={stepIdx}
 step={step}
 suiteRunId={suiteRunId}
 testId={result.test_id}
 onEditSelector={onEditSelector}
 />
 ))}
 </div>
 )}
 </div>
 );
}

// Sub-component for individual step result
function StepResultItem({
 step,
 suiteRunId,
 testId,
 onEditSelector,
}: {
 step: SuiteRunStep;
 suiteRunId: string;
 testId: string;
 onEditSelector: (state: EditSelectorModalState) => void;
}) {
 return (
 <div className="space-y-1">
 <div className="flex items-center gap-2 text-sm">
 <span className={step.status === 'passed' ? 'text-success' : step.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}>
 {step.status === 'passed' ? '✓' : step.status === 'failed' ? '✗' : '○'}
 </span>
 <span className="text-muted-foreground">{step.action}</span>
 <span className="text-muted-foreground">{step.duration_ms}ms</span>
 {/* Feature #1065: Healed selector indicator */}
 {step.was_healed && (
 <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-accent/10 text-accent" title="This selector was auto-healed by AI">
 🔧 Healed
 </span>
 )}
 {step.manual_override && (
 <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-primary/10 text-primary" title="This selector was manually overridden">
 ✏️ Manual
 </span>
 )}
 </div>

 {/* Feature #1065 & #1072: Healed selector details with diff visualization */}
 {step.was_healed && (
 <HealedSelectorDetails
 step={step}
 suiteRunId={suiteRunId}
 testId={testId}
 onEditSelector={onEditSelector}
 />
 )}

 {/* Feature #1065: Show selector for non-healed steps */}
 {!step.was_healed && step.selector && (
 <div className="ml-6 flex items-center gap-2 text-xs">
 <span className="text-muted-foreground">Selector:</span>
 <code className="px-1 py-0.5 bg-muted rounded font-mono text-xs">
 {step.selector}
 </code>
 <button
 onClick={() => {
 onEditSelector({
 isOpen: true,
 runId: suiteRunId,
 testId: testId,
 stepId: step.id,
 currentSelector: step.selector || '',
 originalSelector: step.original_selector || step.selector || '',
 wasHealed: false,
 });
 }}
 className="px-1.5 py-0.5 text-xs font-medium rounded bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
 title="Edit selector"
 >
 <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
 </svg>
 </button>
 </div>
 )}

 {/* Feature #603: Display mask selector warnings */}
 {step.metadata?.maskSelectorWarnings && step.metadata.maskSelectorWarnings.length > 0 && (
 <div className="ml-6 p-2 bg-warning/5 rounded border border-warning/20">
 <div className="flex items-start gap-2 text-xs text-warning">
 <span className="mt-0.5">⚠️</span>
 <div className="space-y-1">
 {step.metadata.maskSelectorWarnings.map((warning, wIdx) => (
 <div key={wIdx}>{warning}</div>
 ))}
 </div>
 </div>
 </div>
 )}

 {/* Warnings from hide_elements and remove_elements steps */}
 {step.metadata?.warnings && step.metadata.warnings.length > 0 && (
 <div className="ml-6 p-2 bg-warning/5 rounded border border-warning/20">
 <div className="flex items-start gap-2 text-xs text-warning">
 <span className="mt-0.5">⚠️</span>
 <div className="space-y-1">
 {step.metadata.warnings.map((warning, wIdx) => (
 <div key={wIdx}>{warning}</div>
 ))}
 </div>
 </div>
 </div>
 )}

 {/* Feature #609: SSL Certificate Error Details */}
 {step.metadata?.errorType === 'ssl_error' && step.metadata?.sslErrorCode && (
 <SSLErrorDetails metadata={step.metadata} />
 )}
 </div>
 );
}

// Sub-component for healed selector details
function HealedSelectorDetails({
 step,
 suiteRunId,
 testId,
 onEditSelector,
}: {
 step: SuiteRunStep;
 suiteRunId: string;
 testId: string;
 onEditSelector: (state: EditSelectorModalState) => void;
}) {
 return (
 <div className="ml-6 p-3 bg-accent/5 rounded border border-accent/20">
 {/* Header with strategy and confidence meter */}
 <div className="flex items-center justify-between mb-3">
 <div className="flex items-center gap-2 text-xs">
 <span className="text-accent font-semibold">🔧 AI-Healed Selector</span>
 {step.healing_strategy && (
 <span className="px-1.5 py-0.5 rounded bg-accent/10 text-accent">
 {step.healing_strategy.replace(/_/g, ' ')}
 </span>
 )}
 {/* Feature #1073: Confidence meter visualization */}
 {step.healing_confidence !== undefined && (
 <div className="flex items-center gap-2" title={`Healing confidence: ${step.healing_confidence}%`}>
 <div className="w-20 h-2 bg-secondary rounded-full overflow-hidden">
 <div
 className={`h-full rounded-full transition-all duration-300 ${
 step.healing_confidence >= 85 ? 'bg-success' :
 step.healing_confidence >= 70 ? 'bg-warning' :
 'bg-destructive'
 }`}
 style={{ width: `${step.healing_confidence}%` }}
 />
 </div>
 <span className={`text-xs font-semibold ${
 step.healing_confidence >= 85 ? 'text-success' :
 step.healing_confidence >= 70 ? 'text-warning' :
 'text-destructive'
 }`}>
 {step.healing_confidence}%
 </span>
 </div>
 )}
 </div>
 <button
 onClick={() => {
 onEditSelector({
 isOpen: true,
 runId: suiteRunId,
 testId: testId,
 stepId: step.id,
 currentSelector: step.selector || step.healed_selector || '',
 originalSelector: step.original_selector || '',
 wasHealed: true,
 });
 }}
 className="px-2 py-1 text-xs font-medium rounded bg-accent text-accent-foreground hover:bg-accent/90 transition-colors flex items-center gap-1"
 >
 <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
 <path d="m15 5 4 4"/>
 </svg>
 Edit
 </button>
 </div>

 {/* Feature #1072: Side-by-side diff visualization */}
 <div className="grid grid-cols-2 gap-3">
 {/* Old selector (left side - red) */}
 <div className="bg-destructive/5 rounded-lg border border-destructive/20 overflow-hidden">
 <div className="px-2 py-1 bg-destructive/10 border-b border-destructive/20">
 <span className="text-xs font-semibold text-destructive flex items-center gap-1">
 <span>−</span> Original (Failed)
 </span>
 </div>
 <div className="p-2">
 <code className="text-xs font-mono text-destructive break-all leading-relaxed block line-through">
 {step.original_selector}
 </code>
 </div>
 </div>

 {/* New selector (right side - green) */}
 <div className="bg-success/5 rounded-lg border border-success/20 overflow-hidden">
 <div className="px-2 py-1 bg-success/10 border-b border-success/20">
 <span className="text-xs font-semibold text-success flex items-center gap-1">
 <span>+</span> Healed (Working)
 </span>
 </div>
 <div className="p-2">
 <code className="text-xs font-mono text-success break-all leading-relaxed block">
 {step.healed_selector || step.selector}
 </code>
 </div>
 </div>
 </div>

 {/* DOM context hint */}
 {step.healing_strategy && (
 <div className="mt-2 px-2 py-1.5 bg-muted/50 rounded border border-border text-xs text-muted-foreground">
 <span className="font-medium">Strategy used: </span>
 {step.healing_strategy === 'visual_match' && 'Visual element matching - identified element by appearance'}
 {step.healing_strategy === 'text_match' && 'Text content matching - found element with similar text'}
 {step.healing_strategy === 'attribute_match' && 'Attribute matching - matched by similar attributes'}
 {step.healing_strategy === 'selector_fallback' && 'Selector fallback - tried alternative selector patterns'}
 {!['visual_match', 'text_match', 'attribute_match', 'selector_fallback'].includes(step.healing_strategy) && step.healing_strategy.replace(/_/g, ' ')}
 </div>
 )}
 </div>
 );
}

// Sub-component for SSL error details
function SSLErrorDetails({ metadata }: { metadata: SuiteRunStep['metadata'] }) {
 if (!metadata) return null;

 return (
 <div className="ml-6 mt-2 p-3 bg-warning/5 rounded-lg border border-warning/20">
 <div className="flex items-start gap-2 mb-2">
 <span className="text-base">🔐</span>
 <div className="flex-1">
 <span className="text-sm font-semibold text-warning">
 SSL Certificate Error: {metadata.sslErrorCode}
 </span>
 <span className="ml-2 text-xs px-2 py-0.5 rounded font-medium bg-warning/10 text-warning">
 🔒 SSL/TLS Error
 </span>
 </div>
 </div>
 {metadata.sslErrorDescription && (
 <p className="text-xs text-warning mb-2">
 {metadata.sslErrorDescription}
 </p>
 )}
 {/* Security Implications Warning */}
 {metadata.securityImplication && (
 <div className="p-2 bg-destructive/5 rounded border border-destructive/20 mb-2">
 <div className="flex items-start gap-2">
 <span className="text-sm">⚠️</span>
 <div>
 <p className="text-xs font-medium text-destructive">Security Implications:</p>
 <p className="text-xs text-destructive mt-1">{metadata.securityImplication}</p>
 </div>
 </div>
 </div>
 )}
 {/* Ignore SSL Option Status */}
 <div className="text-xs">
 {metadata.ignoreSSLEnabled ? (
 <span className="text-warning">
 ⚡ "Ignore SSL errors" is enabled - certificate validation was bypassed
 </span>
 ) : (
 <span className="text-primary">
 💡 Enable "Ignore SSL errors" option in test settings to bypass certificate validation (for testing only)
 </span>
 )}
 </div>
 </div>
 );
}

export default SuiteRunResults;
