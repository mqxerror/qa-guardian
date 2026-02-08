/**
 * FlakinessPanel - Feature #48: Extracted from TestDetailPage.tsx
 * Displays flakiness trend data and analysis for a test
 */
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { FlakinessTrend, TestRunType } from './types';

export interface FlakinessPanelProps {
 isLoading: boolean;
 flakinessTrend: FlakinessTrend | null;
 runs: TestRunType[];
 showSection: boolean;
 onHideSection: () => void;
 onRefresh: () => void;
}

export function FlakinessPanel({
 isLoading,
 flakinessTrend,
 runs,
 showSection,
 onHideSection,
 onRefresh,
}: FlakinessPanelProps) {
 if (!showSection) return null;

 return (
 <div className="mt-8 rounded-lg border border-border bg-card p-6">
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
 <span className="text-xl">📊</span> Flakiness Trend
 </h2>
 <button
 onClick={onHideSection}
 className="text-muted-foreground hover:text-foreground"
 title="Hide section"
 >
 ×
 </button>
 </div>

 {isLoading ? (
 <div className="flex items-center justify-center py-8">
 <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
 <span className="ml-2 text-muted-foreground">Loading trend data...</span>
 </div>
 ) : !flakinessTrend ? (
 <div className="text-center py-8 text-muted-foreground">
 <p>No trend data available yet</p>
 <button
 onClick={onRefresh}
 className="mt-2 text-sm text-primary hover:underline"
 >
 Refresh
 </button>
 </div>
 ) : (
 <div className="space-y-6">
 {/* Summary Stats */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 <div className="rounded-lg border border-border bg-muted/30 p-3">
 <div className="text-2xl font-bold text-foreground">{flakinessTrend.summary.total_runs}</div>
 <div className="text-xs text-muted-foreground">Total Runs</div>
 </div>
 <div className="rounded-lg border border-border bg-muted/30 p-3">
 <div className={`text-2xl font-bold ${
 flakinessTrend.summary.overall_flakiness_score >= 0.7 ? 'text-red-600' :
 flakinessTrend.summary.overall_flakiness_score >= 0.4 ? 'text-orange-600' :
 flakinessTrend.summary.overall_flakiness_score > 0 ? 'text-yellow-600' :
 'text-emerald-600'
 }`}>
 {flakinessTrend.summary.overall_flakiness_score.toFixed(2)}
 </div>
 <div className="text-xs text-muted-foreground">Flakiness Score</div>
 </div>
 <div className="rounded-lg border border-border bg-muted/30 p-3">
 <div className="text-2xl font-bold text-emerald-600">{flakinessTrend.summary.overall_pass_rate}%</div>
 <div className="text-xs text-muted-foreground">Pass Rate</div>
 </div>
 <div className="rounded-lg border border-border bg-muted/30 p-3">
 <div className="text-sm font-medium text-foreground">
 {flakinessTrend.summary.flakiness_started
 ? new Date(flakinessTrend.summary.flakiness_started).toLocaleDateString()
 : 'N/A'}
 </div>
 <div className="text-xs text-muted-foreground">Flakiness Started</div>
 </div>
 </div>

 {/* Daily Trend Chart */}
 {flakinessTrend.daily_trend.length > 0 && (
 <div>
 <h3 id="flakiness-trend-title" className="text-sm font-medium text-foreground mb-2">Daily Flakiness Trend</h3>
 <div className="h-40 relative" role="img" aria-labelledby="flakiness-trend-title">
 <ResponsiveContainer width="100%" height="100%">
 <LineChart data={flakinessTrend.daily_trend}>
 <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
 <XAxis
 dataKey="date"
 tick={{ fontSize: 10 }}
 tickFormatter={(value) => new Date(value).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
 className="text-muted-foreground"
 />
 <YAxis
 domain={[0, 1]}
 tick={{ fontSize: 10 }}
 tickFormatter={(value) => value.toFixed(1)}
 className="text-muted-foreground"
 />
 <Tooltip
 content={({ active, payload }) => {
 if (!active || !payload?.[0]) return null;
 const data = payload[0].payload;
 return (
 <div className="rounded-md border border-border bg-card p-2 shadow-sm text-xs">
 <div className="font-medium">{new Date(data.date).toLocaleDateString()}</div>
 <div className="text-emerald-600">Passes: {data.passes}</div>
 <div className="text-red-600">Failures: {data.failures}</div>
 <div className="text-orange-600">Flakiness: {data.flakiness_score.toFixed(2)}</div>
 </div>
 );
 }}
 />
 <Line
 type="monotone"
 dataKey="flakiness_score"
 stroke="#f97316"
 strokeWidth={2}
 dot={{ fill: '#f97316', r: 3 }}
 name="Flakiness"
 />
 </LineChart>
 </ResponsiveContainer>
 </div>
 <p className="text-xs text-muted-foreground mt-1">
 Higher values indicate more flaky behavior (0 = stable, 1 = highly flaky)
 </p>
 </div>
 )}

 {/* Code Changes Correlation */}
 {flakinessTrend.code_changes.length > 0 && flakinessTrend.summary.flakiness_started ? (
 <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-200">
 <h3 className="text-sm font-medium text-yellow-800 mb-2 flex items-center gap-2">
 <span>⚠️</span> Potential Related Code Changes
 </h3>
 <p className="text-xs text-yellow-700 mb-2">
 Flakiness started on {new Date(flakinessTrend.summary.flakiness_started).toLocaleDateString()}.
 The following commits may be related:
 </p>
 {flakinessTrend.code_changes.map((change) => (
 <div key={change.commit_id} className="mt-2 p-2 bg-card rounded border border-yellow-300">
 <div className="flex items-center gap-2">
 <code className="text-xs font-mono text-primary">{change.commit_id.substring(0, 8)}</code>
 <span className="text-xs text-muted-foreground">{new Date(change.date).toLocaleDateString()}</span>
 </div>
 <div className="text-sm text-foreground mt-1">{change.message}</div>
 <div className="text-xs text-muted-foreground mt-1">by {change.author}</div>
 <div className="flex flex-wrap gap-1 mt-1">
 {change.files_changed.map((file, idx) => (
 <span key={idx} className="px-1.5 py-0.5 text-xs bg-muted rounded">
 {file}
 </span>
 ))}
 </div>
 </div>
 ))}
 </div>
 ) : (
 <div className="p-3 rounded-lg bg-muted border border-border">
 <h3 className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-2">
 <span>🔗</span> Code Changes Correlation
 </h3>
 <p className="text-xs text-muted-foreground">
 Git integration not configured. Connect your repository to see commits correlated with flakiness.
 </p>
 </div>
 )}

 {/* Run History Sparkline */}
 <div>
 <h3 className="text-sm font-medium text-foreground mb-2">Recent Run Results</h3>
 <div className="flex gap-0.5 h-8">
 {runs.slice(0, 30).reverse().map((run, idx) => (
 <div
 key={run.id || idx}
 className={`flex-1 rounded-sm ${
 run.status === 'passed' ? 'bg-emerald-500' :
 run.status === 'failed' ? 'bg-red-500' :
 run.status === 'warning' ? 'bg-amber-500' :
 run.status === 'running' ? 'bg-blue-500 animate-pulse' :
 'bg-gray-300'
 }`}
 title={`${run.status} - ${run.created_at ? new Date(run.created_at).toLocaleString() : 'Unknown'}`}
 />
 ))}
 </div>
 <div className="flex justify-between mt-1 text-xs text-muted-foreground">
 <span>Oldest</span>
 <span>Newest</span>
 </div>
 </div>
 </div>
 )}
 </div>
 );
}

export default FlakinessPanel;
