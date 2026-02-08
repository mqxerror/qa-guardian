/**
 * PerformanceTab Component
 * Feature #47: Extracted from MonitoringPage.tsx for modularity
 *
 * Handles performance monitoring display - Core Web Vitals and Lighthouse scores
 */

import { PerformanceCheck, PerformanceResult, PerformanceTrends } from './types';

export interface PerformanceTabProps {
  // Data
  performanceChecks: PerformanceCheck[];
  selectedPerformance: PerformanceCheck | null;
  performanceResults: PerformanceResult[];
  performanceTrends: PerformanceTrends | null;
  // Loading states
  isLoading: boolean;
  isLoadingPerfResults: boolean;
  // Actions
  setSelectedPerformance: (check: PerformanceCheck | null) => void;
  setShowPerformanceModal: (show: boolean) => void;
  runPerformanceCheck: (id: string) => Promise<void>;
  deletePerformanceCheck: (id: string) => Promise<void>;
  // Utilities
  getPerfStatusBadge: (status: string | undefined) => React.ReactNode;
  getMetricColor: (metric: string, value: number) => string;
}

export function PerformanceTab({
  performanceChecks,
  selectedPerformance,
  performanceResults,
  performanceTrends,
  isLoading,
  isLoadingPerfResults,
  setSelectedPerformance,
  setShowPerformanceModal,
  runPerformanceCheck,
  deletePerformanceCheck,
  getPerfStatusBadge,
  getMetricColor,
}: PerformanceTabProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (performanceChecks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-12 text-center">
        <div className="text-4xl mb-4">⚡</div>
        <h3 className="text-lg font-medium text-foreground">No performance checks yet</h3>
        <p className="mt-2 text-muted-foreground">Monitor Core Web Vitals and page performance metrics.</p>
        <button
          onClick={() => setShowPerformanceModal(true)}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Create Performance Check
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Performance Checks List */}
      <div className="lg:col-span-2">
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Score</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">LCP</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {performanceChecks.map(check => (
                <tr
                  key={check.id}
                  className={`hover:bg-muted/30 cursor-pointer ${selectedPerformance?.id === check.id ? 'bg-primary/5' : ''}`}
                  onClick={() => setSelectedPerformance(check)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{check.name}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[200px]">{check.url}</div>
                  </td>
                  <td className="px-4 py-3">
                    {getPerfStatusBadge(check.latest_status)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-lg font-bold ${
                      (check.latest_score || 0) >= 90 ? 'text-success' :
                      (check.latest_score || 0) >= 50 ? 'text-warning' : 'text-destructive'
                    }`}>
                      {check.latest_score || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={getMetricColor('lcp', check.latest_lcp || 0)}>
                      {check.latest_lcp ? `${check.latest_lcp}ms` : '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => runPerformanceCheck(check.id)}
                        title="Run now"
                        className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        ▶️
                      </button>
                      <button
                        onClick={() => deletePerformanceCheck(check.id)}
                        title="Delete"
                        className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Performance Details Panel */}
      <div className="lg:col-span-1">
        {selectedPerformance ? (
          <div className="rounded-lg border border-border bg-card p-4 space-y-4">
            <div>
              <h3 className="font-semibold text-foreground">{selectedPerformance.name}</h3>
              <p className="text-xs text-muted-foreground truncate">{selectedPerformance.url}</p>
            </div>

            {isLoadingPerfResults ? (
              <div className="text-center py-4">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto"></div>
              </div>
            ) : performanceResults.length > 0 && (
              <>
                {/* Latest Lighthouse Score */}
                <div className="text-center py-4 border-b border-border">
                  <div className="text-4xl font-bold mb-1" style={{
                    color: performanceResults[0].lighthouse_score >= 90 ? '#16a34a' :
                           performanceResults[0].lighthouse_score >= 50 ? '#ca8a04' : '#dc2626'
                  }}>
                    {performanceResults[0].lighthouse_score}
                  </div>
                  <div className="text-xs text-muted-foreground">Lighthouse Score</div>
                </div>

                {/* Core Web Vitals */}
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2">Core Web Vitals</h4>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded bg-muted/30">
                      <div className={`text-lg font-bold ${getMetricColor('lcp', performanceResults[0].metrics?.lcp ?? 0)}`}>
                        {((performanceResults[0].metrics?.lcp ?? 0) / 1000).toFixed(1)}s
                      </div>
                      <div className="text-xs text-muted-foreground">LCP</div>
                    </div>
                    <div className="p-2 rounded bg-muted/30">
                      <div className={`text-lg font-bold ${getMetricColor('fid', performanceResults[0].metrics?.fid ?? 0)}`}>
                        {performanceResults[0].metrics?.fid ?? 0}ms
                      </div>
                      <div className="text-xs text-muted-foreground">FID</div>
                    </div>
                    <div className="p-2 rounded bg-muted/30">
                      <div className={`text-lg font-bold ${getMetricColor('cls', performanceResults[0].metrics?.cls ?? 0)}`}>
                        {(performanceResults[0].metrics?.cls ?? 0).toFixed(2)}
                      </div>
                      <div className="text-xs text-muted-foreground">CLS</div>
                    </div>
                  </div>
                </div>

                {/* Additional Metrics */}
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2">Other Metrics</h4>
                  <dl className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">TTFB</dt>
                      <dd className={getMetricColor('ttfb', performanceResults[0].metrics?.ttfb ?? 0)}>
                        {performanceResults[0].metrics?.ttfb ?? 0}ms
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">FCP</dt>
                      <dd className={getMetricColor('fcp', performanceResults[0].metrics?.fcp ?? 0)}>
                        {performanceResults[0].metrics?.fcp ?? 0}ms
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">TTI</dt>
                      <dd>{performanceResults[0].metrics?.tti ?? 0}ms</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">TBT</dt>
                      <dd>{performanceResults[0].metrics?.tbt ?? 0}ms</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Speed Index</dt>
                      <dd>{performanceResults[0].metrics?.si ?? 0}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Page Size</dt>
                      <dd>{((performanceResults[0].metrics?.total_size ?? 0) / 1024).toFixed(1)}MB</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Requests</dt>
                      <dd>{performanceResults[0].metrics?.request_count ?? 0}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">DOM Elements</dt>
                      <dd>{performanceResults[0].metrics?.dom_elements ?? 0}</dd>
                    </div>
                  </dl>
                </div>

                {/* Trends */}
                {performanceTrends && performanceTrends.trends.lcp.avg > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-foreground mb-2">Trends</h4>
                    <dl className="space-y-1 text-xs">
                      <div className="flex justify-between items-center">
                        <dt className="text-muted-foreground">LCP Avg</dt>
                        <dd className="flex items-center gap-1">
                          {performanceTrends.trends.lcp.avg}ms
                          <span className={
                            performanceTrends.trends.lcp.trend === 'improving' ? 'text-success' :
                            performanceTrends.trends.lcp.trend === 'degrading' ? 'text-destructive' : 'text-muted-foreground'
                          }>
                            {performanceTrends.trends.lcp.trend === 'improving' ? '↓' :
                             performanceTrends.trends.lcp.trend === 'degrading' ? '↑' : '→'}
                          </span>
                        </dd>
                      </div>
                      <div className="flex justify-between items-center">
                        <dt className="text-muted-foreground">Score Avg</dt>
                        <dd className="flex items-center gap-1">
                          {performanceTrends.trends.lighthouse_score.avg}
                          <span className={
                            performanceTrends.trends.lighthouse_score.trend === 'improving' ? 'text-success' :
                            performanceTrends.trends.lighthouse_score.trend === 'degrading' ? 'text-destructive' : 'text-muted-foreground'
                          }>
                            {performanceTrends.trends.lighthouse_score.trend === 'improving' ? '↑' :
                             performanceTrends.trends.lighthouse_score.trend === 'degrading' ? '↓' : '→'}
                          </span>
                        </dd>
                      </div>
                    </dl>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
            Select a performance check to view details
          </div>
        )}
      </div>
    </div>
  );
}
