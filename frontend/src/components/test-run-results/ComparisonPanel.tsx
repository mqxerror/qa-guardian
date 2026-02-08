/**
 * ComparisonPanel - Run comparison panel with trend charts
 * Feature #46: Extracted from TestRunResultPage.tsx for modularity
 * Feature #1842: Run comparison with previous runs
 */

import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatDuration } from './utils';
import { ResultSummary, TestRun } from './types';

interface PreviousRun {
 id: string;
 status: string;
 created_at: string;
}

interface RunHistoryItem {
 id: string;
 created_at: string;
 passed?: number;
 failed?: number;
}

interface CompareRun {
 id: string;
 duration_ms?: number;
 results: Array<{
 status: string;
 }>;
}

export interface ComparisonPanelProps {
 compareMode: boolean;
 previousRuns: PreviousRun[];
 selectedCompareRunId: string | null;
 setSelectedCompareRunId: (id: string | null) => void;
 loadingCompareRun: boolean;
 run: TestRun | null;
 compareRun: CompareRun | null;
 resultSummary: ResultSummary;
 runHistory: RunHistoryItem[];
}

export default function ComparisonPanel({
 compareMode,
 previousRuns,
 selectedCompareRunId,
 setSelectedCompareRunId,
 loadingCompareRun,
 run,
 compareRun,
 resultSummary,
 runHistory,
}: ComparisonPanelProps) {
 // Calculate compare run summary
 // Hooks must be called unconditionally (before any early returns)
 const compareRunSummary = useMemo(() => {
 if (!compareRun?.results) return { passed: 0, failed: 0, skipped: 0, total: 0 };
 return {
 passed: compareRun.results.filter(r => r.status === 'passed').length,
 failed: compareRun.results.filter(r => r.status === 'failed' || r.status === 'error').length,
 skipped: compareRun.results.filter(r => r.status === 'skipped').length,
 total: compareRun.results.length,
 };
 }, [compareRun]);

 // Calculate delta between current and compare run
 const calculateDelta = (current: number, baseline: number): { value: number; direction: 'up' | 'down' | 'same' } => {
 const delta = current - baseline;
 return {
 value: Math.abs(delta),
 direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'same',
 };
 };

 // Get comparison metrics
 const comparisonMetrics = useMemo(() => {
 if (!run || !compareRun) return null;

 const durationDelta = calculateDelta(run.duration_ms || 0, compareRun.duration_ms || 0);
 const passedDelta = calculateDelta(resultSummary.passed, compareRunSummary.passed);
 const failedDelta = calculateDelta(resultSummary.failed, compareRunSummary.failed);

 return {
 duration: {
 current: run.duration_ms || 0,
 baseline: compareRun.duration_ms || 0,
 delta: durationDelta,
 improved: durationDelta.direction === 'down', // faster is better
 },
 passed: {
 current: resultSummary.passed,
 baseline: compareRunSummary.passed,
 delta: passedDelta,
 improved: passedDelta.direction === 'up', // more passed is better
 },
 failed: {
 current: resultSummary.failed,
 baseline: compareRunSummary.failed,
 delta: failedDelta,
 improved: failedDelta.direction === 'down', // fewer failed is better
 },
 total: {
 current: resultSummary.total,
 baseline: compareRunSummary.total,
 },
 };
 }, [run, compareRun, resultSummary, compareRunSummary]);

 if (!compareMode) return null;

 return (
 <div className="mt-6 pt-6 border-t border-border">
 <div className="flex items-center justify-between mb-4">
 <h3 className="font-medium text-foreground">Compare with Previous Run</h3>
 <select
 value={selectedCompareRunId || ''}
 onChange={(e) => setSelectedCompareRunId(e.target.value || null)}
 className="px-3 py-1.5 border border-border rounded-md bg-background text-foreground"
 >
 <option value="">Select a run to compare...</option>
 {previousRuns.map(prevRun => (
 <option key={prevRun.id} value={prevRun.id}>
 {new Date(prevRun.created_at).toLocaleString()} - {prevRun.status}
 </option>
 ))}
 </select>
 </div>

 {loadingCompareRun && (
 <div className="text-center py-4">
 <svg className="animate-spin h-6 w-6 mx-auto text-primary" fill="none" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
 </svg>
 </div>
 )}

 {comparisonMetrics && (
 <div className="space-y-4">
 {/* Comparison Cards */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 {/* Duration */}
 <div className={`p-4 rounded-lg border ${
 comparisonMetrics.duration.improved
 ? 'bg-green-50 border-green-200'
 : comparisonMetrics.duration.delta.direction !== 'same'
 ? 'bg-red-50 border-red-200'
 : 'bg-muted/50 border-border'
 }`}>
 <div className="text-sm text-muted-foreground mb-1">Duration</div>
 <div className="flex items-center gap-2">
 <span className="text-lg font-bold text-foreground">
 {formatDuration(comparisonMetrics.duration.current)}
 </span>
 {comparisonMetrics.duration.delta.direction !== 'same' && (
 <span className={`flex items-center text-sm ${
 comparisonMetrics.duration.improved ? 'text-green-600' : 'text-red-600'
 }`}>
 {comparisonMetrics.duration.delta.direction === 'down' ? (
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
 </svg>
 ) : (
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
 </svg>
 )}
 {formatDuration(comparisonMetrics.duration.delta.value)}
 </span>
 )}
 </div>
 <div className="text-xs text-muted-foreground mt-1">
 vs {formatDuration(comparisonMetrics.duration.baseline)}
 </div>
 </div>

 {/* Passed */}
 <div className={`p-4 rounded-lg border ${
 comparisonMetrics.passed.improved
 ? 'bg-green-50 border-green-200'
 : comparisonMetrics.passed.delta.direction !== 'same'
 ? 'bg-red-50 border-red-200'
 : 'bg-muted/50 border-border'
 }`}>
 <div className="text-sm text-muted-foreground mb-1">Passed</div>
 <div className="flex items-center gap-2">
 <span className="text-lg font-bold text-green-600">
 {comparisonMetrics.passed.current}
 </span>
 {comparisonMetrics.passed.delta.direction !== 'same' && (
 <span className={`flex items-center text-sm ${
 comparisonMetrics.passed.improved ? 'text-green-600' : 'text-red-600'
 }`}>
 {comparisonMetrics.passed.delta.direction === 'up' ? '+' : '-'}
 {comparisonMetrics.passed.delta.value}
 </span>
 )}
 </div>
 <div className="text-xs text-muted-foreground mt-1">
 vs {comparisonMetrics.passed.baseline}
 </div>
 </div>

 {/* Failed */}
 <div className={`p-4 rounded-lg border ${
 comparisonMetrics.failed.improved
 ? 'bg-green-50 border-green-200'
 : comparisonMetrics.failed.delta.direction !== 'same'
 ? 'bg-red-50 border-red-200'
 : 'bg-muted/50 border-border'
 }`}>
 <div className="text-sm text-muted-foreground mb-1">Failed</div>
 <div className="flex items-center gap-2">
 <span className="text-lg font-bold text-red-600">
 {comparisonMetrics.failed.current}
 </span>
 {comparisonMetrics.failed.delta.direction !== 'same' && (
 <span className={`flex items-center text-sm ${
 comparisonMetrics.failed.improved ? 'text-green-600' : 'text-red-600'
 }`}>
 {comparisonMetrics.failed.delta.direction === 'up' ? '+' : '-'}
 {comparisonMetrics.failed.delta.value}
 </span>
 )}
 </div>
 <div className="text-xs text-muted-foreground mt-1">
 vs {comparisonMetrics.failed.baseline}
 </div>
 </div>

 {/* Total */}
 <div className="p-4 rounded-lg border bg-muted/50 border-border">
 <div className="text-sm text-muted-foreground mb-1">Total Tests</div>
 <div className="text-lg font-bold text-foreground">
 {comparisonMetrics.total.current}
 </div>
 <div className="text-xs text-muted-foreground mt-1">
 vs {comparisonMetrics.total.baseline}
 </div>
 </div>
 </div>

 {/* Trend Chart */}
 {runHistory.length > 1 && (
 <div className="mt-4">
 <h4 className="text-sm font-medium text-foreground mb-3">Trend (Last {runHistory.length} runs)</h4>
 <div className="h-32 bg-muted/30 rounded-lg p-4">
 <ResponsiveContainer width="100%" height="100%">
 <LineChart data={runHistory.slice().reverse()}>
 <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
 <XAxis
 dataKey="created_at"
 tickFormatter={(v) => new Date(v).toLocaleDateString()}
 tick={{ fontSize: 10 }}
 stroke="currentColor"
 opacity={0.5}
 />
 <YAxis tick={{ fontSize: 10 }} stroke="currentColor" opacity={0.5} />
 <Tooltip
 contentStyle={{
 backgroundColor: 'var(--background)',
 border: '1px solid var(--border)',
 borderRadius: '8px',
 }}
 labelFormatter={(v) => new Date(v).toLocaleString()}
 />
 <Legend />
 <Line
 type="monotone"
 dataKey="passed"
 name="Passed"
 stroke="#22c55e"
 strokeWidth={2}
 dot={{ r: 3 }}
 />
 <Line
 type="monotone"
 dataKey="failed"
 name="Failed"
 stroke="#ef4444"
 strokeWidth={2}
 dot={{ r: 3 }}
 />
 </LineChart>
 </ResponsiveContainer>
 </div>
 </div>
 )}
 </div>
 )}
 </div>
 );
}
