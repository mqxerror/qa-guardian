// Feature #515: Extracted from AnalyticsPage.tsx
// Accessibility Trends Chart Component

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { AccessibilityTrendDataPoint, AccessibilityTrendSummary } from './types';

interface AccessibilityTrendsChartProps {
  a11yTrendData: AccessibilityTrendDataPoint[];
  a11yTrendSummary: AccessibilityTrendSummary | null;
  a11yTrendDays: 7 | 30;
  setA11yTrendDays: (days: 7 | 30) => void;
  isLoading: boolean;
}

export function AccessibilityTrendsChart({
  a11yTrendData,
  a11yTrendSummary,
  a11yTrendDays,
  setA11yTrendDays,
  isLoading,
}: AccessibilityTrendsChartProps) {
  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-semibold text-foreground">Accessibility Trends</h3>
          <p className="text-sm text-muted-foreground">
            Track accessibility violations over time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setA11yTrendDays(7)}
            className={`px-3 py-1.5 text-sm rounded-md ${
              a11yTrendDays === 7
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            7 Days
          </button>
          <button
            onClick={() => setA11yTrendDays(30)}
            className={`px-3 py-1.5 text-sm rounded-md ${
              a11yTrendDays === 30
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
          <p className="text-muted-foreground">Loading accessibility trend data...</p>
        </div>
      ) : a11yTrendData.length === 0 || !a11yTrendSummary || a11yTrendSummary.total_runs === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">No accessibility test data available for this period.</p>
          <p className="text-sm text-muted-foreground mt-2">
            Run some accessibility tests to see violation trends here.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card p-4">
          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <div className="text-2xl font-bold text-foreground">{a11yTrendSummary.total_runs}</div>
              <div className="text-xs text-muted-foreground">Total A11y Runs</div>
            </div>
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <div className="text-2xl font-bold text-foreground">{a11yTrendSummary.total_violations}</div>
              <div className="text-xs text-muted-foreground">Total Violations</div>
            </div>
            <div className="text-center p-3 bg-warning/15 rounded-lg">
              <div className="text-2xl font-bold text-warning">
                {a11yTrendSummary.avg_violations_per_run.toFixed(1)}
              </div>
              <div className="text-xs text-warning">Avg Violations/Run</div>
            </div>
            <div className={`text-center p-3 rounded-lg ${
              a11yTrendSummary.violation_trend === 'improving'
                ? 'bg-success/15'
                : a11yTrendSummary.violation_trend === 'worsening'
                ? 'bg-destructive/15'
                : 'bg-muted/30'
            }`}>
              <div className={`text-2xl font-bold ${
                a11yTrendSummary.violation_trend === 'improving'
                  ? 'text-success'
                  : a11yTrendSummary.violation_trend === 'worsening'
                  ? 'text-destructive'
                  : 'text-foreground'
              }`}>
                {a11yTrendSummary.violation_trend === 'improving' ? 'Improving' :
                 a11yTrendSummary.violation_trend === 'worsening' ? 'Worsening' : 'Stable'}
              </div>
              <div className="text-xs text-muted-foreground">Trend</div>
            </div>
          </div>

          {/* Line chart - stacked area chart for violation severity */}
          <div className="h-72" role="img" aria-label="Accessibility violations trend chart showing critical, serious, moderate, and minor violations over time">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={a11yTrendData.map(d => ({
                  ...d,
                  displayDate: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
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
                  className="text-muted-foreground"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  itemStyle={{ color: 'hsl(var(--muted-foreground))' }}
                  formatter={(value, name) => [value, name]}
                  labelFormatter={(label) => `Date: ${label}`}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="total_violations"
                  name="Total Violations"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="critical"
                  name="Critical"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={{ fill: '#ef4444', strokeWidth: 2, r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="serious"
                  name="Serious"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={{ fill: '#f97316', strokeWidth: 2, r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="moderate"
                  name="Moderate"
                  stroke="#eab308"
                  strokeWidth={2}
                  dot={{ fill: '#eab308', strokeWidth: 2, r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="minor"
                  name="Minor"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={{ fill: '#22c55e', strokeWidth: 2, r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Date range info */}
          <div className="mt-4 text-xs text-center text-muted-foreground">
            Showing data from {a11yTrendSummary.start_date} to {a11yTrendSummary.end_date}
          </div>
        </div>
      )}
    </div>
  );
}
