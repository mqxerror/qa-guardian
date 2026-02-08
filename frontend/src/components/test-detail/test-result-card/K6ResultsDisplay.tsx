// Feature #48: K6ResultsDisplay - Extracted from TestResultCard.tsx
// Displays K6 load test results including metrics, thresholds, checks, and response codes chart

import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { K6Results } from './types';

interface K6ResultsDisplayProps {
  results: K6Results;
}

export function K6ResultsDisplay({ results }: K6ResultsDisplayProps) {
  const COLORS = ['#22c55e', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6'];

  return (
    <div className="mt-4 p-4 border border-border rounded-lg bg-muted/30">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">📊</span>
        <h4 className="text-sm font-semibold text-foreground">Load Test Results</h4>
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          results.status === 'passed' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
        }`}>
          {results.status}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="p-2 rounded bg-background">
          <div className="text-xs text-muted-foreground">Duration</div>
          <div className="text-sm font-semibold">{results.duration_ms ? `${(results.duration_ms / 1000).toFixed(1)}s` : '-'}</div>
        </div>
        <div className="p-2 rounded bg-background">
          <div className="text-xs text-muted-foreground">Max VUs</div>
          <div className="text-sm font-semibold">{results.vus_max || '-'}</div>
        </div>
        <div className="p-2 rounded bg-background">
          <div className="text-xs text-muted-foreground">HTTP Requests</div>
          <div className="text-sm font-semibold">{results.http_reqs?.toLocaleString() || '-'}</div>
        </div>
        <div className="p-2 rounded bg-background">
          <div className="text-xs text-muted-foreground">Error Rate</div>
          <div className={`text-sm font-semibold ${(results.http_req_failed || 0) > 5 ? 'text-destructive' : 'text-success'}`}>
            {results.http_req_failed !== undefined ? `${results.http_req_failed.toFixed(2)}%` : '-'}
          </div>
        </div>
      </div>

      {/* Response Time Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="p-2 rounded bg-background">
          <div className="text-xs text-muted-foreground">Avg Response</div>
          <div className="text-sm font-semibold">{results.http_req_duration_avg ? `${results.http_req_duration_avg.toFixed(0)}ms` : '-'}</div>
        </div>
        <div className="p-2 rounded bg-background">
          <div className="text-xs text-muted-foreground">Median</div>
          <div className="text-sm font-semibold">{results.http_req_duration_med ? `${results.http_req_duration_med.toFixed(0)}ms` : '-'}</div>
        </div>
        <div className="p-2 rounded bg-background">
          <div className="text-xs text-muted-foreground">P90</div>
          <div className="text-sm font-semibold">{results.http_req_duration_p90 ? `${results.http_req_duration_p90.toFixed(0)}ms` : '-'}</div>
        </div>
        <div className="p-2 rounded bg-background">
          <div className="text-xs text-muted-foreground">P95</div>
          <div className="text-sm font-semibold">{results.http_req_duration_p95 ? `${results.http_req_duration_p95.toFixed(0)}ms` : '-'}</div>
        </div>
      </div>

      {/* Thresholds */}
      {results.thresholds && Object.keys(results.thresholds).length > 0 && (
        <div className="mt-3">
          <h5 className="text-xs font-medium text-muted-foreground mb-2">Thresholds</h5>
          <div className="space-y-1">
            {Object.entries(results.thresholds).map(([name, threshold]) => (
              <div key={name} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{name}</span>
                <span className={threshold.passed ? 'text-success' : 'text-destructive'}>
                  {threshold.passed ? '✓' : '✗'} {threshold.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Checks */}
      {results.checks && results.checks.length > 0 && (
        <div className="mt-3">
          <h5 className="text-xs font-medium text-muted-foreground mb-2">Checks</h5>
          <div className="space-y-1">
            {results.checks.map((check, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{check.name}</span>
                <span className={check.fails === 0 ? 'text-success' : 'text-destructive'}>
                  {check.passes}/{check.passes + check.fails} passed
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Response Codes Chart */}
      {results.response_codes && Object.keys(results.response_codes).length > 0 && (
        <div className="mt-4">
          <h5 id="response-codes-title" className="text-xs font-medium text-muted-foreground mb-2">Response Codes</h5>
          <div className="h-32" role="img" aria-labelledby="response-codes-title">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={Object.entries(results.response_codes).map(([code, count]) => ({
                    name: code,
                    value: count,
                  }))}
                  cx="50%"
                  cy="50%"
                  innerRadius={25}
                  outerRadius={45}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {Object.keys(results.response_codes).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
