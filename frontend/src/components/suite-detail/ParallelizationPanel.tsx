/**
 * ParallelizationPanel Component
 * Feature #50: Extract from TestSuitePage.tsx
 * Feature #1257: AI Dynamic Test Parallelization
 */

import React from 'react';

// Worker type for parallelization plan
interface ParallelizationWorker {
 id: number;
 name: string;
 tests: Array<{ name: string; duration: number }>;
 totalDuration: number;
 utilizationPercent: number;
}

// Parallelization plan type
interface ParallelizationPlan {
 totalTests: number;
 workers: ParallelizationWorker[];
 optimization: {
 sequentialTime: number;
 parallelTime: number;
 timeSaved: number;
 speedup: string;
 };
 resourceBalance: {
 avgUtilization: number;
 maxDifference: number;
 balanceScore: string;
 };
}

interface ParallelizationPanelProps {
 isAnalyzing: boolean;
 plan: ParallelizationPlan | null;
 isRunningSuite: boolean;
 onClose: () => void;
 onRunSuite: () => void;
}

export function ParallelizationPanel({
 isAnalyzing,
 plan,
 isRunningSuite,
 onClose,
 onRunSuite,
}: ParallelizationPanelProps) {
 return (
 <div className="mb-6 rounded-lg border border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50 p-6">
 <div className="flex items-center justify-between mb-4">
 <div>
 <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
 🤖 AI Dynamic Test Parallelization
 </h2>
 <p className="text-sm text-muted-foreground mt-1">
 Optimal test distribution across workers
 </p>
 </div>
 <button
 onClick={onClose}
 className="p-1 rounded hover:bg-muted"
 >
 <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 </div>

 {isAnalyzing ? (
 <div className="flex items-center justify-center py-8">
 <div className="text-center">
 <svg aria-hidden="true" className="animate-spin h-8 w-8 text-purple-600 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
 </svg>
 <p className="text-muted-foreground">Analyzing test durations and optimizing distribution...</p>
 </div>
 </div>
 ) : plan && (
 <div className="space-y-6">
 {/* Optimization Summary */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 <div className="p-4 rounded-lg bg-card border border-border text-center">
 <p className="text-2xl font-bold text-foreground">{plan.totalTests}</p>
 <p className="text-sm text-muted-foreground">Total Tests</p>
 </div>
 <div className="p-4 rounded-lg bg-card border border-border text-center">
 <p className="text-2xl font-bold text-green-600">{plan.optimization.speedup}x</p>
 <p className="text-sm text-muted-foreground">Speedup</p>
 </div>
 <div className="p-4 rounded-lg bg-card border border-border text-center">
 <p className="text-2xl font-bold text-blue-600">{plan.optimization.timeSaved}s</p>
 <p className="text-sm text-muted-foreground">Time Saved</p>
 </div>
 <div className="p-4 rounded-lg bg-card border border-border text-center">
 <p className={`text-2xl font-bold ${
 plan.resourceBalance.balanceScore === 'Excellent' ? 'text-green-600' :
 plan.resourceBalance.balanceScore === 'Good' ? 'text-blue-600' :
 'text-yellow-600'
 }`}>{plan.resourceBalance.balanceScore}</p>
 <p className="text-sm text-muted-foreground">Balance Score</p>
 </div>
 </div>

 {/* Time Comparison */}
 <div className="p-4 rounded-lg bg-card border border-border">
 <h3 className="font-medium text-foreground mb-3">⏱️ Time Optimization</h3>
 <div className="space-y-2">
 <div className="flex items-center gap-3">
 <span className="text-sm text-muted-foreground w-24">Sequential:</span>
 <div className="flex-1 h-4 bg-red-100 rounded-full overflow-hidden">
 <div className="h-full bg-red-500 rounded-full" style={{ width: '100%' }} />
 </div>
 <span className="text-sm font-medium text-red-600 w-16">{plan.optimization.sequentialTime}s</span>
 </div>
 <div className="flex items-center gap-3">
 <span className="text-sm text-muted-foreground w-24">Parallel:</span>
 <div className="flex-1 h-4 bg-green-100 rounded-full overflow-hidden">
 <div className="h-full bg-green-500 rounded-full" style={{ width: `${(plan.optimization.parallelTime / plan.optimization.sequentialTime) * 100}%` }} />
 </div>
 <span className="text-sm font-medium text-green-600 w-16">{plan.optimization.parallelTime}s</span>
 </div>
 </div>
 </div>

 {/* Worker Distribution */}
 <div className="p-4 rounded-lg bg-card border border-border">
 <h3 className="font-medium text-foreground mb-3">🖥️ Worker Distribution</h3>
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
 {plan.workers.map((worker) => (
 <div key={worker.id} className="p-3 rounded-lg bg-muted/30 border border-border">
 <div className="flex items-center justify-between mb-2">
 <span className="font-medium text-foreground">{worker.name}</span>
 <span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary">
 {worker.utilizationPercent}%
 </span>
 </div>
 <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
 <div
 className="h-full bg-primary rounded-full"
 style={{ width: `${worker.utilizationPercent}%` }}
 />
 </div>
 <div className="text-xs text-muted-foreground">
 {worker.tests.length} tests • {worker.totalDuration}s total
 </div>
 <div className="mt-2 max-h-20 overflow-y-auto">
 {worker.tests.map((t, i) => (
 <div key={i} className="text-xs text-muted-foreground truncate">
 • {t.name} ({t.duration}s)
 </div>
 ))}
 </div>
 </div>
 ))}
 </div>
 </div>

 {/* Resource Balance */}
 <div className="p-4 rounded-lg bg-card border border-border">
 <h3 className="font-medium text-foreground mb-3">📊 Resource Balance</h3>
 <div className="grid grid-cols-3 gap-4 text-center">
 <div>
 <p className="text-lg font-semibold text-foreground">{plan.resourceBalance.avgUtilization}%</p>
 <p className="text-xs text-muted-foreground">Avg Utilization</p>
 </div>
 <div>
 <p className="text-lg font-semibold text-foreground">{plan.resourceBalance.maxDifference}s</p>
 <p className="text-xs text-muted-foreground">Max Diff Between Workers</p>
 </div>
 <div>
 <p className="text-lg font-semibold text-foreground">{plan.workers.length}</p>
 <p className="text-xs text-muted-foreground">Active Workers</p>
 </div>
 </div>
 </div>

 {/* Run Button */}
 <div className="flex justify-end">
 <button
 onClick={onRunSuite}
 disabled={isRunningSuite}
 className="px-6 py-2 rounded bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-50"
 >
 {isRunningSuite ? 'Running...' : '▶️ Execute Optimized Run'}
 </button>
 </div>
 </div>
 )}
 </div>
 );
}

export default ParallelizationPanel;
