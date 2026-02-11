// Feature #515: Extracted from AnalyticsPage.tsx
// Duration Trends Chart Component (Feature #470)

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { DurationTrendDataPoint, DurationTrendSummary, DurationRegression, DurationFilters } from './types';

interface DurationTrendsChartProps {
  durationTrendData: DurationTrendDataPoint[];
  durationTrendSummary: DurationTrendSummary | null;
  durationRegression: DurationRegression | null;
  durationFilters: DurationFilters | null;
  durationTrendDays: 7 | 30;
  setDurationTrendDays: (days: 7 | 30) => void;
  durationBrowserFilter: string | undefined;
  setDurationBrowserFilter: (browser: string | undefined) => void;
  durationTestTypeFilter: string | undefined;
  setDurationTestTypeFilter: (testType: string | undefined) => void;
  isLoading: boolean;
}

export function DurationTrendsChart({
  durationTrendData,
  durationTrendSummary,
  durationRegression,
  durationFilters,
  durationTrendDays,
  setDurationTrendDays,
  durationBrowserFilter,
  setDurationBrowserFilter,
  durationTestTypeFilter,
  setDurationTestTypeFilter,
  isLoading,
}: DurationTrendsChartProps) {
  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-semibold text-foreground">Duration Trends</h3>
          <p className="text-sm text-muted-foreground">
            Test execution duration percentiles (p50, p95, p99) over time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Browser filter */}
          {durationFilters && durationFilters.available_browsers.length > 0 && (
            <select
              value={durationBrowserFilter || ''}
              onChange={(e) => setDurationBrowserFilter(e.target.value || undefined)}
              className="px-2 py-1.5 text-sm rounded-md bg-muted text-foreground border border-border"
            >
              <option value="">All Browsers</option>
              {durationFilters.available_browsers.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          )}
          {/* Test type filter */}
          {durationFilters && durationFilters.available_test_types.length > 0 && (
            <select
              value={durationTestTypeFilter || ''}
              onChange={(e) => setDurationTestTypeFilter(e.target.value || undefined)}
              className="px-2 py-1.5 text-sm rounded-md bg-muted text-foreground border border-border"
            >
              <option value="">All Types</option>
              {durationFilters.available_test_types.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => setDurationTrendDays(7)}
            className={`px-3 py-1.5 text-sm rounded-md ${
              durationTrendDays === 7
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            7 Days
          </button>
          <button
            onClick={() => setDurationTrendDays(30)}
            className={`px-3 py-1.5 text-sm rounded-md ${
              durationTrendDays === 30
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            30 Days
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">Loading duration trend data...</p>
        </div>
      ) : durationTrendData.length === 0 || !durationTrendSummary || durationTrendSummary.total_runs === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">No duration data available for this period.</p>
          <p className="text-sm text-muted-foreground mt-2">
            Run some tests to see duration trends here.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card p-4">
          {/* Regression warning */}
          {durationRegression?.detected && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive font-medium">
                {durationRegression.message}
              </p>
            </div>
          )}

          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <div className="text-2xl font-bold text-foreground">
                {durationTrendSummary.total_runs}
              </div>
              <div className="text-xs text-muted-foreground">Total Runs</div>
            </div>
            <div className="text-center p-3 bg-info/15 rounded-lg">
              <div className="text-2xl font-bold text-info">
                {durationTrendSummary.overall_p50_ms !== null
                  ? `${(durationTrendSummary.overall_p50_ms / 1000).toFixed(1)}s`
                  : 'N/A'}
              </div>
              <div className="text-xs text-info">p50</div>
            </div>
            <div className="text-center p-3 bg-warning/15 rounded-lg">
              <div className="text-2xl font-bold text-warning">
                {durationTrendSummary.overall_p95_ms !== null
                  ? `${(durationTrendSummary.overall_p95_ms / 1000).toFixed(1)}s`
                  : 'N/A'}
              </div>
              <div className="text-xs text-warning">p95</div>
            </div>
            <div className="text-center p-3 bg-warning/15 rounded-lg">
              <div className="text-2xl font-bold text-warning">
                {durationTrendSummary.overall_p99_ms !== null
                  ? `${(durationTrendSummary.overall_p99_ms / 1000).toFixed(1)}s`
                  : 'N/A'}
              </div>
              <div className="text-xs text-warning">p99</div>
            </div>
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <div className="text-2xl font-bold text-foreground">
                {durationTrendSummary.overall_avg_ms !== null
                  ? `${(durationTrendSummary.overall_avg_ms / 1000).toFixed(1)}s`
                  : 'N/A'}
              </div>
              <div className="text-xs text-muted-foreground">Average</div>
            </div>
          </div>

          {/* Line chart */}
          <div className="h-72" role="img" aria-label="Duration trend line chart showing p50, p95, p99 percentiles over time">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={durationTrendData.map(d => ({
                  ...d,
                  displayDate: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                  // Convert ms to seconds for display
                  p50_s: d.p50_ms !== null ? d.p50_ms / 1000 : null,
                  p95_s: d.p95_ms !== null ? d.p95_ms / 1000 : null,
                  p99_s: d.p99_ms !== null ? d.p99_ms / 1000 : null,
                }))}
                margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis
                  dataKey="displayDate"
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => `${value}s`}
                  className="text-muted-foreground"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  formatter={(value, name: string) => {
                    if (value === null || value === undefined || typeof value !== 'number') return ['N/A', name];
                    return [`${value.toFixed(2)}s`, name];
                  }}
                  labelFormatter={(label) => `Date: ${label}`}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="p50_s"
                  name="p50"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 3 }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="p95_s"
                  name="p95"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ fill: '#f59e0b', strokeWidth: 2, r: 3 }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="p99_s"
                  name="p99"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={{ fill: '#f97316', strokeWidth: 2, r: 3 }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Date range info */}
          <div className="mt-4 text-xs text-center text-muted-foreground">
            Showing data from {durationTrendSummary.start_date} to {durationTrendSummary.end_date}
          </div>
        </div>
      )}
    </div>
  );
}
