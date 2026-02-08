/**
 * LiveExecutionView - Real-time test execution monitoring view
 * Feature #46: Extracted from TestRunResultPage.tsx for modularity
 * Feature #1844: Live execution with WebSocket updates
 */

import React from 'react';
import { formatDuration } from './utils';

export interface LiveExecutionViewProps {
 runStatus: 'running' | 'pending' | string;
 currentStep: { action: string; selector?: string; progress: number } | null;
 executionProgress: { current: number; total: number; eta?: number };
 liveScreenshot: string | null;
 liveConsoleLogs: Array<{ level: string; message: string; timestamp: number }>;
 liveMetrics: { rps?: number; responseTime?: number; vus?: number } | null;
 cancellingTest: boolean;
 onCancelTest: () => void;
}

export default function LiveExecutionView({
 runStatus,
 currentStep,
 executionProgress,
 liveScreenshot,
 liveConsoleLogs,
 liveMetrics,
 cancellingTest,
 onCancelTest,
}: LiveExecutionViewProps) {
 // Only show for running/pending status
 if (runStatus !== 'running' && runStatus !== 'pending') {
 return null;
 }

 return (
 <div className="bg-card border-2 border-primary rounded-lg p-6 mb-6 shadow-lg shadow-blue-500/20">
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-3">
 <div className="relative">
 <div className="h-4 w-4 bg-primary rounded-full animate-ping absolute"></div>
 <div className="h-4 w-4 bg-primary rounded-full relative"></div>
 </div>
 <h2 className="text-lg font-semibold text-foreground">Live Execution</h2>
 <span className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-full">
 {runStatus === 'pending' ? 'Starting...' : 'Running'}
 </span>
 </div>
 <button
 onClick={onCancelTest}
 disabled={cancellingTest}
 className="flex items-center gap-2 px-4 py-2 bg-destructive text-white rounded-md hover:bg-destructive disabled:opacity-50 transition-colors"
 >
 {cancellingTest ? (
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
 Step {executionProgress.current} of {executionProgress.total || '?'}
 </span>
 {executionProgress.eta && (
 <span className="text-sm text-muted-foreground">
 ETA: {formatDuration(executionProgress.eta)}
 </span>
 )}
 </div>
 <div className="h-3 bg-muted rounded-full overflow-hidden">
 <div
 className="h-full bg-gradient-to-r from-primary to-primary rounded-full transition-all duration-500"
 style={{ width: `${currentStep?.progress || 0}%` }}
 />
 </div>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 {/* Current Step */}
 <div className="p-4 bg-muted/30 rounded-lg">
 <h3 className="font-medium text-foreground mb-3 flex items-center gap-2">
 <svg className="w-5 h-5 text-primary animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
 </svg>
 Current Step
 </h3>
 {currentStep ? (
 <div className="space-y-2">
 <div className="font-mono text-foreground bg-muted rounded px-3 py-2">
 {currentStep.action}
 </div>
 {currentStep.selector && (
 <div className="text-sm text-muted-foreground font-mono truncate">
 Selector: {currentStep.selector}
 </div>
 )}
 </div>
 ) : (
 <div className="text-muted-foreground">Waiting for first step...</div>
 )}

 {/* Live Metrics (for load tests) */}
 {liveMetrics && (
 <div className="mt-4 grid grid-cols-3 gap-3">
 {liveMetrics.vus !== undefined && (
 <div className="text-center p-2 bg-muted rounded">
 <div className="text-lg font-bold text-foreground">{liveMetrics.vus}</div>
 <div className="text-xs text-muted-foreground">VUs</div>
 </div>
 )}
 {liveMetrics.rps !== undefined && (
 <div className="text-center p-2 bg-muted rounded">
 <div className="text-lg font-bold text-foreground">{liveMetrics.rps.toFixed(1)}</div>
 <div className="text-xs text-muted-foreground">RPS</div>
 </div>
 )}
 {liveMetrics.responseTime !== undefined && (
 <div className="text-center p-2 bg-muted rounded">
 <div className="text-lg font-bold text-foreground">{liveMetrics.responseTime}ms</div>
 <div className="text-xs text-muted-foreground">Latency</div>
 </div>
 )}
 </div>
 )}
 </div>

 {/* Live Screenshot */}
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
 <span className="text-sm">Waiting for screenshot...</span>
 </div>
 </div>
 )}
 </div>
 </div>

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
