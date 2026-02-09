// Feature #515: Extracted from AnalyticsPage.tsx
// Pass Rate Trends Chart Component

import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { SectionHeader } from '../ui';
import type { TrendDataPoint, TrendSummary } from './types';

interface PassRateTrendsChartProps {
  trendData: TrendDataPoint[];
  trendSummary: TrendSummary | null;
  trendDays: 7 | 30;
  setTrendDays: (days: 7 | 30) => void;
  isLoading: boolean;
}

export function PassRateTrendsChart({
  trendData,
  trendSummary,
  trendDays,
  setTrendDays,
  isLoading,
}: PassRateTrendsChartProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionHeader
          title="Pass Rate Trends"
          description="Daily pass rate over the selected time period."
        />
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTrendDays(7)}
            className={`px-3 py-1.5 text-sm rounded-md ${
              trendDays === 7
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            7 Days
          </button>
          <button
            onClick={() => setTrendDays(30)}
            className={`px-3 py-1.5 text-sm rounded-md ${
              trendDays === 30
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
          <p className="text-muted-foreground">Loading trend data...</p>
        </div>
      ) : trendData.length === 0 || !trendSummary || trendSummary.total_runs === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-gradient-to-br from-card to-muted/30 p-12 text-center animate-in fade-in duration-300">
          {/* Illustrated empty state with chart icon */}
          <div className="relative mx-auto w-24 h-24 mb-6">
            <svg className="w-full h-full text-primary/20" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="10" y="20" width="80" height="60" rx="4" />
              <line x1="20" y1="60" x2="35" y2="45" strokeLinecap="round" />
              <line x1="35" y1="45" x2="50" y2="55" strokeLinecap="round" />
              <line x1="50" y1="55" x2="65" y2="35" strokeLinecap="round" />
              <line x1="65" y1="35" x2="80" y2="40" strokeLinecap="round" />
              <circle cx="20" cy="60" r="3" fill="currentColor" />
              <circle cx="35" cy="45" r="3" fill="currentColor" />
              <circle cx="50" cy="55" r="3" fill="currentColor" />
              <circle cx="65" cy="35" r="3" fill="currentColor" />
              <circle cx="80" cy="40" r="3" fill="currentColor" />
            </svg>
            <div className="absolute -bottom-1 -right-1 text-2xl">📊</div>
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">No Test Data Yet</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Run your first tests to see beautiful trend analytics and track your pass rate over time.
          </p>
          <button
            onClick={() => navigate('/projects')}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-all hover:scale-105"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Run Your First Test
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card p-4">
          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <div className="text-2xl font-bold text-foreground">
                {trendSummary.overall_pass_rate !== null ? `${trendSummary.overall_pass_rate}%` : 'N/A'}
              </div>
              <div className="text-xs text-muted-foreground">Overall Pass Rate</div>
            </div>
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <div className="text-2xl font-bold text-foreground">{trendSummary.total_runs}</div>
              <div className="text-xs text-muted-foreground">Total Runs</div>
            </div>
            <div className="text-center p-3 bg-success/15 rounded-lg">
              <div className="text-2xl font-bold text-success">{trendSummary.total_passed}</div>
              <div className="text-xs text-success">Passed</div>
            </div>
            <div className="text-center p-3 bg-destructive/15 rounded-lg">
              <div className="text-2xl font-bold text-destructive">{trendSummary.total_failed}</div>
              <div className="text-xs text-destructive">Failed</div>
            </div>
          </div>

          {/* Line chart */}
          <div className="h-72" role="img" aria-label="Test trend line chart showing passed and failed tests over time">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={trendData.map(d => ({
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
                  domain={[0, 100]}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => `${value}%`}
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
                  formatter={(value, name) => {
                    if (name === 'Pass Rate') {
                      return [value !== null ? `${value}%` : 'N/A', 'Pass Rate'];
                    }
                    return [value, name];
                  }}
                  labelFormatter={(label) => `Date: ${label}`}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="pass_rate"
                  name="Pass Rate"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Date range info */}
          <div className="mt-4 text-xs text-center text-muted-foreground">
            Showing data from {trendSummary.start_date} to {trendSummary.end_date}
          </div>
        </div>
      )}
    </div>
  );
}
