// Feature #515: Extracted from AnalyticsPage.tsx
// AI Usage & Cost Tracking Cards Component (Feature #477)

import type { AIUsageData } from './types';

interface AIUsageCardsProps {
  aiUsageData: AIUsageData | undefined;
  isLoading: boolean;
}

export function AIUsageCards({ aiUsageData, isLoading }: AIUsageCardsProps) {
  return (
    <div className="mt-8">
      <h3 className="text-xl font-semibold text-foreground mb-4">AI Usage & Cost Tracking</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Monitor AI API usage, costs, and trends. Helps track spending and optimize AI feature usage.
      </p>

      {isLoading ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">Loading AI usage data...</p>
        </div>
      ) : !aiUsageData?.aggregations || aiUsageData.aggregations.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground font-medium">No AI usage data yet</p>
          <p className="text-sm text-muted-foreground mt-2">
            AI usage will appear here once AI features are used (test generation, root cause analysis, etc.)
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
            {/* Total Requests Card */}
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Total Requests</p>
              <p className="text-2xl font-bold text-foreground">
                {aiUsageData.aggregations.reduce((sum, a) => sum + a.total_requests, 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Today: {aiUsageData.aggregations[0]?.total_requests || 0}
              </p>
            </div>

            {/* Total Cost Card */}
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Total Cost</p>
              <p className="text-2xl font-bold text-foreground">
                ${aiUsageData.aggregations.reduce((sum, a) => sum + a.total_cost_usd, 0).toFixed(4)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Today: ${(aiUsageData.aggregations[0]?.total_cost_usd || 0).toFixed(4)}
              </p>
            </div>

            {/* Total Tokens Card */}
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Total Tokens</p>
              <p className="text-2xl font-bold text-foreground">
                {aiUsageData.aggregations.reduce((sum, a) =>
                  sum + a.total_input_tokens + a.total_output_tokens, 0).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                In: {aiUsageData.aggregations.reduce((sum, a) => sum + a.total_input_tokens, 0).toLocaleString()} /
                Out: {aiUsageData.aggregations.reduce((sum, a) => sum + a.total_output_tokens, 0).toLocaleString()}
              </p>
            </div>

            {/* Success Rate Card */}
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Success Rate</p>
              {(() => {
                const totalReqs = aiUsageData.aggregations.reduce((sum, a) => sum + a.total_requests, 0);
                const successfulReqs = aiUsageData.aggregations.reduce((sum, a) => sum + a.successful_requests, 0);
                const rate = totalReqs > 0 ? ((successfulReqs / totalReqs) * 100).toFixed(1) : '0';
                return (
                  <>
                    <p className="text-2xl font-bold text-success">{rate}%</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {successfulReqs} / {totalReqs} requests
                    </p>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Usage by Model/Feature breakdown */}
          {aiUsageData.aggregations[0]?.by_model && (
            <div className="grid gap-4 md:grid-cols-2">
              {/* By Model */}
              <div className="rounded-lg border border-border bg-card p-4">
                <h4 className="text-sm font-medium text-foreground mb-3">Usage by Model</h4>
                <div className="space-y-2">
                  {Object.entries(aiUsageData.aggregations[0].by_model).map(([model, stats]) => (
                    <div key={model} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{model}</span>
                      <span className="font-medium text-foreground">{stats.requests} calls (${stats.cost_usd.toFixed(4)})</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* By Feature */}
              {aiUsageData.aggregations[0]?.by_feature && (
                <div className="rounded-lg border border-border bg-card p-4">
                  <h4 className="text-sm font-medium text-foreground mb-3">Usage by Feature</h4>
                  <div className="space-y-2">
                    {Object.entries(aiUsageData.aggregations[0].by_feature).map(([feature, stats]) => (
                      <div key={feature} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{feature}</span>
                        <span className="font-medium text-foreground">{stats.requests} calls (${stats.cost_usd.toFixed(4)})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
