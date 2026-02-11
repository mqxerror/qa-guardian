// Feature #48: CurrentRunPanel - Extracted from TestDetailPage.tsx
// Displays current run status, live execution progress, and test results

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { VideoPlayer } from './VideoPlayer';
// Feature #566: Import canonical LiveProgress & ConsoleLogEntry from types.ts
import { TestRunType, TestType, StepResult, LiveProgress, ConsoleLogEntry } from './types';

interface CurrentRunPanelProps {
 currentRun: TestRunType;
 test: TestType | null;
 liveProgress: LiveProgress | null;
 liveScreenshot: string | null;
 liveConsoleLogs: ConsoleLogEntry[];
 isCancellingRun: boolean;
 isDownloadingArtifacts: boolean;
 onCancelRun: () => void;
 onDownloadAllArtifacts: (runId: string) => void;
 onApproveBaseline: (runId: string, testId: string, viewport?: string) => void;
 formatDateTime: (date: string | Date) => string;
 // For lighthouse charts
 lighthouseHistory?: Array<{
 run_id: string;
 started_at: string;
 performance: number;
 accessibility: number;
 bestPractices: number;
 seo: number;
 lcp?: number;
 fcp?: number;
 cls?: number;
 inp?: number;
 tbt?: number;
 ttfb?: number;
 speedIndex?: number;
 }>;
 // Screenshot lightbox
 onOpenLightbox?: (imageUrl: string) => void;
}

export function CurrentRunPanel({
 currentRun,
 test,
 liveProgress,
 liveScreenshot,
 liveConsoleLogs,
 isCancellingRun,
 isDownloadingArtifacts,
 onCancelRun,
 onDownloadAllArtifacts,
 onApproveBaseline,
 formatDateTime,
 lighthouseHistory = [],
 onOpenLightbox,
}: CurrentRunPanelProps) {
 const [expandedViolations, setExpandedViolations] = useState<Set<string>>(new Set());
 const [violationImpactFilter, setViolationImpactFilter] = useState<string>('all');
 const [violationCategoryFilter, setViolationCategoryFilter] = useState<string>('all');
 const [violationSearchQuery, setViolationSearchQuery] = useState('');

 // Toggle violation expansion
 const toggleViolation = (violationId: string) => {
 setExpandedViolations(prev => {
 const next = new Set(prev);
 if (next.has(violationId)) {
 next.delete(violationId);
 } else {
 next.add(violationId);
 }
 return next;
 });
 };

 /** Accessibility violation shape for filtering */
 interface AccessibilityViolationItem {
  id?: string;
  impact?: string;
  description?: string;
  help?: string;
  tags?: string[];
  helpUrl?: string;
  nodes?: Array<{ html: string; target: string[] }>;
 }

 // Filter violations based on impact and category
 const filterViolations = (violations: AccessibilityViolationItem[]) => {
 return violations.filter(v => {
 const matchesImpact = violationImpactFilter === 'all' || v.impact === violationImpactFilter;
 const matchesCategory = violationCategoryFilter === 'all' ||
 (v.tags && v.tags.some((tag: string) => tag.toLowerCase().includes(violationCategoryFilter.toLowerCase())));
 const matchesSearch = !violationSearchQuery ||
 v.id?.toLowerCase().includes(violationSearchQuery.toLowerCase()) ||
 v.description?.toLowerCase().includes(violationSearchQuery.toLowerCase()) ||
 v.help?.toLowerCase().includes(violationSearchQuery.toLowerCase());
 return matchesImpact && matchesCategory && matchesSearch;
 });
 };

 // Get unique categories from violations
 const getViolationCategories = (violations: AccessibilityViolationItem[]) => {
 const categories = new Set<string>();
 violations.forEach(v => {
 if (v.tags) {
 v.tags.forEach((tag: string) => {
 if (tag.startsWith('cat.')) {
 categories.add(tag.replace('cat.', ''));
 }
 });
 }
 });
 return Array.from(categories);
 };

 // Get impact color
 const getImpactColor = (impact: string) => {
 switch (impact?.toLowerCase()) {
 case 'critical': return 'text-destructive bg-destructive/10';
 case 'serious': return 'text-warning bg-warning/10';
 case 'moderate': return 'text-warning bg-warning/10';
 case 'minor': return 'text-primary bg-primary/10';
 default: return 'text-foreground bg-muted';
 }
 };

 // Get lighthouse score color
 const getLighthouseScoreColor = (score: number) => {
 if (score >= 90) return 'text-success bg-success/10';
 if (score >= 50) return 'text-warning bg-warning/10';
 return 'text-destructive bg-destructive/10';
 };

 return (
 <div className="mt-8 rounded-lg border border-border bg-card p-6">
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-lg font-semibold text-foreground">Current Run</h2>
 {/* Download All Artifacts Button */}
 {currentRun.results && currentRun.results.length > 0 &&
 (currentRun.status === 'passed' || currentRun.status === 'failed' || currentRun.status === 'error') && (
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
 {/* Status badge with warning support */}
 <span className={`rounded-full px-3 py-1 text-sm font-medium ${
 currentRun.status === 'passed' ? 'bg-success/10 text-success' :
 currentRun.status === 'failed' ? 'bg-destructive/10 text-destructive' :
 currentRun.status === 'warning' ? 'bg-warning/10 text-warning' :
 currentRun.status === 'running' ? 'bg-primary/10 text-primary' :
 currentRun.status === 'pending' ? 'bg-warning/10 text-warning' :
 'bg-muted text-foreground'
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
 {liveProgress && (currentRun.status === 'running' || currentRun.status === 'pending') && (
 <LiveExecutionPanel
 liveProgress={liveProgress}
 liveScreenshot={liveScreenshot}
 liveConsoleLogs={liveConsoleLogs}
 test={test}
 isCancellingRun={isCancellingRun}
 onCancelRun={onCancelRun}
 />
 )}

 {/* Test Results */}
 {currentRun.results && currentRun.results.length > 0 && (
 <div className="mt-4 space-y-4">
 {currentRun.results.map((result) => (
 <TestResultItem
 key={result.test_id}
 result={result}
 test={test}
 currentRun={currentRun}
 formatDateTime={formatDateTime}
 lighthouseHistory={lighthouseHistory}
 expandedViolations={expandedViolations}
 violationImpactFilter={violationImpactFilter}
 violationCategoryFilter={violationCategoryFilter}
 violationSearchQuery={violationSearchQuery}
 onToggleViolation={toggleViolation}
 onSetViolationImpactFilter={setViolationImpactFilter}
 onSetViolationCategoryFilter={setViolationCategoryFilter}
 onSetViolationSearchQuery={setViolationSearchQuery}
 filterViolations={filterViolations}
 getViolationCategories={getViolationCategories}
 getImpactColor={getImpactColor}
 getLighthouseScoreColor={getLighthouseScoreColor}
 onApproveBaseline={onApproveBaseline}
 onOpenLightbox={onOpenLightbox}
 />
 ))}
 </div>
 )}
 </div>
 </div>
 );
}

// Sub-component for Live Execution Panel
interface LiveExecutionPanelProps {
 liveProgress: LiveProgress;
 liveScreenshot: string | null;
 liveConsoleLogs: ConsoleLogEntry[];
 test: TestType | null;
 isCancellingRun: boolean;
 onCancelRun: () => void;
}

function LiveExecutionPanel({
 liveProgress,
 liveScreenshot,
 liveConsoleLogs,
 test,
 isCancellingRun,
 onCancelRun,
}: LiveExecutionPanelProps) {
 return (
 <div className="mt-4 bg-card border-2 border-primary rounded-lg p-6 shadow-lg shadow-blue-500/20">
 {/* Header */}
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-3">
 <div className="relative">
 <div className="h-4 w-4 bg-primary rounded-full animate-ping absolute"></div>
 <div className="h-4 w-4 bg-primary rounded-full relative"></div>
 </div>
 <h2 className="text-lg font-semibold text-foreground">Live Execution</h2>
 <span className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-full">
 Running
 </span>
 </div>
 <button
 onClick={onCancelRun}
 disabled={isCancellingRun}
 className="flex items-center gap-2 px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 disabled:opacity-50 transition-colors"
 >
 {isCancellingRun ? (
 <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
 </svg>
 ) : (
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 )}
 Cancel Test
 </button>
 </div>

 {/* Progress Bar */}
 <div className="mb-6">
 <div className="flex items-center justify-between mb-2">
 <span className="text-sm text-muted-foreground">
 {liveProgress.k6Metrics && test?.test_type === 'load'
 ? `Load Test: ${liveProgress.k6Metrics.phase || 'Running'}`
 : `Step ${liveProgress.currentStep ? liveProgress.currentStep.index + 1 : 1} of ${liveProgress.currentStep?.total || '?'}`
 }
 </span>
 <span className="text-sm text-muted-foreground">
 {liveProgress.k6Metrics && test?.test_type === 'load'
 ? `${liveProgress.k6Metrics.progress}% complete`
 : `${liveProgress.completedTests} / ${liveProgress.totalTests} tests`
 }
 </span>
 </div>
 <div className="h-3 bg-muted rounded-full overflow-hidden">
 <div
 className="h-full bg-gradient-to-r from-primary to-primary rounded-full transition-all duration-500"
 style={{ width: `${liveProgress.k6Metrics && test?.test_type === 'load'
 ? liveProgress.k6Metrics.progress
 : (liveProgress.totalTests > 0
 ? Math.round((liveProgress.completedTests / liveProgress.totalTests) * 100)
 : (liveProgress.currentStep ? Math.round(((liveProgress.currentStep.index + 1) / Math.max(liveProgress.currentStep.total, 1)) * 100) : 0)
 )}%` }}
 />
 </div>
 </div>

 {/* Two-Column Grid */}
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 {/* Left: Current Step */}
 <div className="p-4 bg-muted/30 rounded-lg">
 <h3 className="font-medium text-foreground mb-3 flex items-center gap-2">
 <svg className="w-5 h-5 text-primary animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
 </svg>
 Current Step
 </h3>
 <div className="space-y-2">
 <div className={`${test?.test_type === 'load' ? 'text-foreground' : 'font-mono text-foreground'} bg-muted rounded px-3 py-2`}>
 {test?.test_type === 'load'
 ? `Load Testing ${test?.target_url || 'target'}`
 : (liveProgress.currentStep?.action || liveProgress.currentTest || 'Initializing...')
 }
 </div>
 {liveProgress.currentStep && test?.test_type !== 'load' && (
 <div className="text-sm text-muted-foreground">
 Step {liveProgress.currentStep.index + 1} of {liveProgress.currentStep.total}
 </div>
 )}
 </div>
 </div>

 {/* Right: Live Screenshot */}
 <div className="p-4 bg-muted/30 rounded-lg">
 <h3 className="font-medium text-foreground mb-3 flex items-center gap-2">
 <svg className="w-5 h-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
 </svg>
 Live Screenshot
 </h3>
 {liveScreenshot ? (
 <img
 src={liveScreenshot.startsWith('data:') ? liveScreenshot : `data:image/png;base64,${liveScreenshot}`}
 alt="Live screenshot"
 className="w-full h-48 object-contain bg-black/50 rounded-lg"
 />
 ) : (
 <div className="w-full h-48 bg-muted rounded-lg flex items-center justify-center">
 <div className="text-center text-muted-foreground">
 <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
 </svg>
 <span className="text-sm">Screenshots captured on completion</span>
 </div>
 </div>
 )}
 </div>
 </div>

 {/* K6 Load Test Real-Time Metrics */}
 {liveProgress.k6Metrics && test?.test_type === 'load' && (
 <K6LiveMetrics k6Metrics={liveProgress.k6Metrics} virtualUsers={test?.virtual_users} />
 )}

 {/* Live Console Logs */}
 {liveConsoleLogs.length > 0 && (
 <div className="mt-6">
 <h3 className="font-medium text-foreground mb-3 flex items-center gap-2">
 <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
 </svg>
 Live Console ({liveConsoleLogs.length})
 </h3>
 <div className="bg-background rounded-lg p-3 max-h-40 overflow-auto font-mono text-xs">
 {liveConsoleLogs.slice(-20).map((log, idx) => (
 <div
 key={idx}
 className={`py-0.5 ${
 log.level === 'error' ? 'text-destructive' :
 log.level === 'warn' ? 'text-warning' :
 log.level === 'info' ? 'text-primary' :
 'text-muted-foreground'
 }`}
 >
 <span className="text-muted-foreground">[{new Date(log.timestamp).toISOString().split('T')[1].slice(0, 12)}]</span>
 <span className="ml-1">{log.message}</span>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 );
}

// Sub-component for K6 Live Metrics
interface K6LiveMetricsProps {
 k6Metrics: NonNullable<LiveProgress['k6Metrics']>;
 virtualUsers?: number;
}

function K6LiveMetrics({ k6Metrics, virtualUsers }: K6LiveMetricsProps) {
 return (
 <div className="mt-6 p-3 rounded-lg bg-primary/10/50 border border-primary/20">
 <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
 <div className="p-2 rounded bg-muted/50">
 <div className="text-lg font-bold text-primary">
 {k6Metrics.currentVUs ?? virtualUsers ?? 0}
 </div>
 <div className="text-xs text-primary">Virtual Users</div>
 </div>
 <div className="p-2 rounded bg-muted/50">
 <div className="text-lg font-bold text-primary">
 {k6Metrics.totalRequests ?? 0}
 </div>
 <div className="text-xs text-primary">Total Requests</div>
 </div>
 <div className="p-2 rounded bg-muted/50">
 <div className="text-lg font-bold text-primary">
 {k6Metrics.requestsPerSecond?.toFixed(1) ?? '0.0'}
 </div>
 <div className="text-xs text-primary">Req/sec</div>
 </div>
 <div className="p-2 rounded bg-muted/50">
 <div className="text-lg font-bold text-primary">
 {k6Metrics.avgResponseTime ?? 0}ms
 </div>
 <div className="text-xs text-primary">Avg Response</div>
 </div>
 {/* Error Rate */}
 <div className={`p-2 rounded border ${
 (k6Metrics.errorRate ?? 0) > 5
 ? 'bg-destructive/10/50 border-destructive/20'
 : (k6Metrics.errorRate ?? 0) > 1
 ? 'bg-warning/10/50 border-warning/20'
 : 'bg-success/10/50 border-success/20'
 }`}>
 <div className={`text-lg font-bold ${
 (k6Metrics.errorRate ?? 0) > 5
 ? 'text-destructive'
 : (k6Metrics.errorRate ?? 0) > 1
 ? 'text-warning'
 : 'text-success'
 }`}>
 {(k6Metrics.errorRate ?? 0).toFixed(1)}%
 </div>
 <div className={`text-xs ${
 (k6Metrics.errorRate ?? 0) > 5
 ? 'text-destructive'
 : (k6Metrics.errorRate ?? 0) > 1
 ? 'text-warning'
 : 'text-success'
 }`}>Error Rate</div>
 </div>
 </div>

 {/* Response Time Percentiles */}
 <div className="mt-3 pt-3 border-t border-primary/20">
 <div className="text-xs font-medium text-primary mb-2">Response Time Percentiles</div>
 <div className="grid grid-cols-3 gap-2 text-center">
 <div className="p-2 rounded bg-success/10/50 border border-success/20">
 <div className="text-base font-bold text-success">
 {k6Metrics.p50ResponseTime ?? 0}ms
 </div>
 <div className="text-xs text-success">p50 (median)</div>
 </div>
 <div className="p-2 rounded bg-warning/10/50 border border-warning/20">
 <div className="text-base font-bold text-warning">
 {k6Metrics.p95ResponseTime ?? 0}ms
 </div>
 <div className="text-xs text-warning">p95</div>
 </div>
 <div className="p-2 rounded bg-warning/10 border border-warning/20">
 <div className="text-base font-bold text-warning">
 {k6Metrics.p99ResponseTime ?? 0}ms
 </div>
 <div className="text-xs text-warning">p99</div>
 </div>
 </div>
 </div>
 </div>
 );
}

// Placeholder for TestResultItem - This component handles individual test results
// Due to its complexity (Lighthouse, Accessibility, E2E, K6 results), it will be
// implemented in a separate file: TestResultItem.tsx

/** Lighthouse history entry for trend charts */
interface LighthouseHistoryEntry {
 run_id: string;
 started_at: string;
 performance: number;
 accessibility: number;
 bestPractices: number;
 seo: number;
 lcp?: number;
 fcp?: number;
 cls?: number;
 inp?: number;
 tbt?: number;
 ttfb?: number;
 speedIndex?: number;
}

/** Accessibility violation for filtering */
interface ViolationItem {
 id?: string;
 impact?: string;
 description?: string;
 help?: string;
 tags?: string[];
 helpUrl?: string;
 nodes?: Array<{ html: string; target: string[] }>;
}

/** Test result for a single test within a run */
interface TestResultData {
 test_id: string;
 test_name?: string;
 status: 'passed' | 'failed' | 'running' | 'pending' | 'error' | 'warning' | 'skipped';
 duration_ms?: number;
 error?: string;
 steps?: StepResult[];
 screenshot_base64?: string;
}

interface TestResultItemProps {
 result: TestResultData;
 test: TestType | null;
 currentRun: TestRunType;
 formatDateTime: (date: string | Date) => string;
 lighthouseHistory: LighthouseHistoryEntry[];
 expandedViolations: Set<string>;
 violationImpactFilter: string;
 violationCategoryFilter: string;
 violationSearchQuery: string;
 onToggleViolation: (id: string) => void;
 onSetViolationImpactFilter: (filter: string) => void;
 onSetViolationCategoryFilter: (filter: string) => void;
 onSetViolationSearchQuery: (query: string) => void;
 filterViolations: (violations: ViolationItem[]) => ViolationItem[];
 getViolationCategories: (violations: ViolationItem[]) => string[];
 getImpactColor: (impact: string) => string;
 getLighthouseScoreColor: (score: number) => string;
 onApproveBaseline: (runId: string, testId: string, viewport?: string) => void;
 onOpenLightbox?: (imageUrl: string) => void;
}

function TestResultItem({
 result,
 test,
 currentRun,
 formatDateTime,
 lighthouseHistory,
 expandedViolations,
 violationImpactFilter,
 violationCategoryFilter,
 violationSearchQuery,
 onToggleViolation,
 onSetViolationImpactFilter,
 onSetViolationCategoryFilter,
 onSetViolationSearchQuery,
 filterViolations,
 getViolationCategories,
 getImpactColor,
 getLighthouseScoreColor,
 onApproveBaseline,
 onOpenLightbox,
}: TestResultItemProps) {
 // This is a simplified version - the full implementation handles all the complex
 // result display logic from the original TestDetailPage
 return (
 <div className="rounded-md border border-border p-4">
 <div className="flex items-center gap-3">
 <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
 result.status === 'passed' ? 'bg-success/10 text-success' :
 result.status === 'failed' ? 'bg-destructive/10 text-destructive' :
 result.status === 'warning' ? 'bg-warning/10 text-warning' :
 'bg-muted text-foreground'
 }`}>
 {result.status}
 </span>
 <span className="font-medium text-foreground">{result.test_name}</span>
 <span className="text-sm text-muted-foreground">{result.duration_ms}ms</span>
 </div>

 {result.error && (
 <div role="alert" className="mt-2 rounded-md bg-destructive/10 p-2 text-sm text-destructive">
 {result.error}
 </div>
 )}

 {/* Step results */}
 {result.steps && result.steps.length > 0 && (
 <div className="mt-3 space-y-1">
 {result.steps.map((step: StepResult, idx: number) => (
 <div key={step.id || idx} className="flex items-center gap-2 text-sm">
 <span className={`h-4 w-4 rounded-full flex items-center justify-center text-xs ${
 step.status === 'passed' ? 'bg-success text-primary-foreground' :
 step.status === 'failed' ? 'bg-destructive text-primary-foreground' :
 step.status === 'warning' ? 'bg-warning text-primary-foreground' :
 'bg-muted-foreground text-primary-foreground'
 }`}>
 {step.status === 'passed' ? '✓' : step.status === 'failed' ? '✗' : step.status === 'warning' ? '⚠' : '-'}
 </span>
 <span className="text-foreground">{step.action}</span>
 <span className="text-muted-foreground">{step.duration_ms}ms</span>
 {step.error && (
 <span className="text-destructive text-xs">({step.error})</span>
 )}
 </div>
 ))}
 </div>
 )}

 {/* Note: Full implementation includes:
 - Screenshot display with lightbox
 - Video player
 - Console logs
 - Network requests
 - Lighthouse results with charts
 - Accessibility violations with filters
 - K6 load test results
 - Visual regression diffs
 - Error handling for various failure types

 These will be fully implemented when integrating this component
 into TestDetailPage.tsx
 */}
 </div>
 );
}

export type { CurrentRunPanelProps, LiveProgress, ConsoleLogEntry };
