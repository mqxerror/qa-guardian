// Feature #48: LiveExecutionPanel - Extracted from TestDetailPage.tsx
// Displays real-time test execution progress with live metrics and screenshots

import React from 'react';
// Feature #566: Import canonical LiveProgress & ConsoleLogEntry from types.ts
import type { LiveProgress, ConsoleLogEntry } from './types';

interface TestType {
 test_type?: string;
 target_url?: string;
 virtual_users?: number;
}

interface CurrentRun {
 status: string;
}

interface LiveExecutionPanelProps {
 currentRun: CurrentRun;
 test: TestType | null;
 liveProgress: LiveProgress | null;
 liveScreenshot: string | null;
 liveConsoleLogs: ConsoleLogEntry[];
 isCancellingRun: boolean;
 onCancelRun: () => void;
}

export function LiveExecutionPanel({
 currentRun,
 test,
 liveProgress,
 liveScreenshot,
 liveConsoleLogs,
 isCancellingRun,
 onCancelRun,
}: LiveExecutionPanelProps) {
 // Don't render if no live progress or not in running/pending state
 if (!liveProgress || (currentRun.status !== 'running' && currentRun.status !== 'pending')) {
 return null;
 }

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
 {currentRun.status === 'pending' ? 'Starting...' : 'Running'}
 </span>
 </div>
 <button
 onClick={onCancelRun}
 disabled={isCancellingRun}
 className="flex items-center gap-2 px-4 py-2 bg-destructive text-white rounded-md hover:bg-destructive disabled:opacity-50 transition-colors"
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

 {/* Gradient Progress Bar */}
 <div className="mb-6">
 <div className="flex items-center justify-between mb-2">
 <span className="text-sm text-muted-foreground">
 {liveProgress.k6Metrics && test?.test_type === 'load'
 ? `Load Test: ${liveProgress.k6Metrics.phase === 'ramp_up' ? 'Ramping Up' : liveProgress.k6Metrics.phase === 'steady' ? 'Steady State' : liveProgress.k6Metrics.phase === 'ramp_down' ? 'Ramping Down' : liveProgress.k6Metrics.phase || 'Running'}`
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

 {/* K6 Load Test Real-Time Metrics -- only for load tests */}
 {liveProgress.k6Metrics && test?.test_type === 'load' && (
 <K6LiveMetrics
 k6Metrics={liveProgress.k6Metrics}
 virtualUsers={test?.virtual_users}
 />
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
 {/* Error Rate - Real-time (Feature #550) */}
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

 {/* Response Time Percentiles - Real-time */}
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

export type { LiveExecutionPanelProps, LiveProgress, ConsoleLogEntry };
