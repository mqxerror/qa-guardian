// Feature #515: Extracted from AnalyticsPage.tsx
// Branch Comparison Table Component (Feature #476)

import type { BranchComparisonData } from './types';

interface BranchComparisonTableProps {
  branchComparisonData: BranchComparisonData | undefined;
  branchA: string | undefined;
  setBranchA: (branch: string | undefined) => void;
  branchB: string | undefined;
  setBranchB: (branch: string | undefined) => void;
  isLoading: boolean;
}

export function BranchComparisonTable({
  branchComparisonData,
  branchA,
  setBranchA,
  branchB,
  setBranchB,
  isLoading,
}: BranchComparisonTableProps) {
  return (
    <div className="mt-8">
      <h3 className="text-xl font-semibold text-foreground mb-4">Branch Comparison</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Compare test metrics between different branches to identify regressions and improvements.
      </p>

      {/* Branch Selectors */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <label className="block text-sm font-medium text-foreground mb-2">Branch A (Baseline)</label>
          <select
            value={branchA || ''}
            onChange={(e) => setBranchA(e.target.value || undefined)}
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Select branch...</option>
            {(branchComparisonData?.available_branches || []).map((branch: string) => (
              <option key={branch} value={branch}>{branch}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-foreground mb-2">Branch B (Compare)</label>
          <select
            value={branchB || ''}
            onChange={(e) => setBranchB(e.target.value || undefined)}
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Select branch...</option>
            {(branchComparisonData?.available_branches || []).map((branch: string) => (
              <option key={branch} value={branch}>{branch}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">Loading branch comparison...</p>
        </div>
      ) : !branchComparisonData?.comparison ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">
            {(branchComparisonData?.available_branches || []).length === 0
              ? 'No branches found. Run tests with branch information to see comparison.'
              : 'Select two branches above to compare test metrics.'}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Metric</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">{branchA || 'Branch A'}</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">{branchB || 'Branch B'}</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Delta</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {/* Pass Rate Row */}
              <tr className="hover:bg-muted/30">
                <td className="px-4 py-3 font-medium text-foreground">Pass Rate</td>
                <td className="px-4 py-3 text-center text-foreground">{branchComparisonData.comparison.branchA.pass_rate}%</td>
                <td className="px-4 py-3 text-center text-foreground">{branchComparisonData.comparison.branchB.pass_rate}%</td>
                <td className="px-4 py-3 text-center">
                  <span className={`font-medium ${
                    branchComparisonData.comparison.deltas.pass_rate.trend === 'improved' ? 'text-success' :
                    branchComparisonData.comparison.deltas.pass_rate.trend === 'regressed' ? 'text-destructive' :
                    'text-muted-foreground'
                  }`}>
                    {branchComparisonData.comparison.deltas.pass_rate.formatted}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    branchComparisonData.comparison.deltas.pass_rate.trend === 'improved' ? 'bg-success/15 text-success' :
                    branchComparisonData.comparison.deltas.pass_rate.trend === 'regressed' ? 'bg-destructive/15 text-destructive' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {branchComparisonData.comparison.deltas.pass_rate.trend === 'improved' ? '↑ Better' :
                     branchComparisonData.comparison.deltas.pass_rate.trend === 'regressed' ? '↓ Worse' : '— Same'}
                  </span>
                </td>
              </tr>

              {/* Duration Row */}
              <tr className="hover:bg-muted/30">
                <td className="px-4 py-3 font-medium text-foreground">Avg Duration</td>
                <td className="px-4 py-3 text-center text-foreground">
                  {branchComparisonData.comparison.branchA.avg_duration_ms !== null
                    ? `${branchComparisonData.comparison.branchA.avg_duration_ms}ms`
                    : 'N/A'}
                </td>
                <td className="px-4 py-3 text-center text-foreground">
                  {branchComparisonData.comparison.branchB.avg_duration_ms !== null
                    ? `${branchComparisonData.comparison.branchB.avg_duration_ms}ms`
                    : 'N/A'}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`font-medium ${
                    branchComparisonData.comparison.deltas.avg_duration_ms.trend === 'improved' ? 'text-success' :
                    branchComparisonData.comparison.deltas.avg_duration_ms.trend === 'regressed' ? 'text-destructive' :
                    'text-muted-foreground'
                  }`}>
                    {branchComparisonData.comparison.deltas.avg_duration_ms.formatted}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    branchComparisonData.comparison.deltas.avg_duration_ms.trend === 'improved' ? 'bg-success/15 text-success' :
                    branchComparisonData.comparison.deltas.avg_duration_ms.trend === 'regressed' ? 'bg-destructive/15 text-destructive' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {branchComparisonData.comparison.deltas.avg_duration_ms.trend === 'improved' ? '↑ Faster' :
                     branchComparisonData.comparison.deltas.avg_duration_ms.trend === 'regressed' ? '↓ Slower' :
                     branchComparisonData.comparison.deltas.avg_duration_ms.trend === 'unknown' ? '? Unknown' : '— Same'}
                  </span>
                </td>
              </tr>

              {/* Failures Row */}
              <tr className="hover:bg-muted/30">
                <td className="px-4 py-3 font-medium text-foreground">Failed Runs</td>
                <td className="px-4 py-3 text-center text-foreground">{branchComparisonData.comparison.branchA.failed_runs}</td>
                <td className="px-4 py-3 text-center text-foreground">{branchComparisonData.comparison.branchB.failed_runs}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`font-medium ${
                    branchComparisonData.comparison.deltas.failed_runs.trend === 'improved' ? 'text-success' :
                    branchComparisonData.comparison.deltas.failed_runs.trend === 'regressed' ? 'text-destructive' :
                    'text-muted-foreground'
                  }`}>
                    {branchComparisonData.comparison.deltas.failed_runs.formatted}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    branchComparisonData.comparison.deltas.failed_runs.trend === 'improved' ? 'bg-success/15 text-success' :
                    branchComparisonData.comparison.deltas.failed_runs.trend === 'regressed' ? 'bg-destructive/15 text-destructive' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {branchComparisonData.comparison.deltas.failed_runs.trend === 'improved' ? '↑ Fewer' :
                     branchComparisonData.comparison.deltas.failed_runs.trend === 'regressed' ? '↓ More' : '— Same'}
                  </span>
                </td>
              </tr>

              {/* Flaky Count Row */}
              <tr className="hover:bg-muted/30">
                <td className="px-4 py-3 font-medium text-foreground">Flaky Tests</td>
                <td className="px-4 py-3 text-center text-foreground">{branchComparisonData.comparison.branchA.flaky_count}</td>
                <td className="px-4 py-3 text-center text-foreground">{branchComparisonData.comparison.branchB.flaky_count}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`font-medium ${
                    branchComparisonData.comparison.deltas.flaky_count.trend === 'improved' ? 'text-success' :
                    branchComparisonData.comparison.deltas.flaky_count.trend === 'regressed' ? 'text-destructive' :
                    'text-muted-foreground'
                  }`}>
                    {branchComparisonData.comparison.deltas.flaky_count.formatted}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    branchComparisonData.comparison.deltas.flaky_count.trend === 'improved' ? 'bg-success/15 text-success' :
                    branchComparisonData.comparison.deltas.flaky_count.trend === 'regressed' ? 'bg-destructive/15 text-destructive' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {branchComparisonData.comparison.deltas.flaky_count.trend === 'improved' ? '↑ Fewer' :
                     branchComparisonData.comparison.deltas.flaky_count.trend === 'regressed' ? '↓ More' : '— Same'}
                  </span>
                </td>
              </tr>

              {/* Total Runs Row */}
              <tr className="hover:bg-muted/30">
                <td className="px-4 py-3 font-medium text-foreground">Total Runs</td>
                <td className="px-4 py-3 text-center text-foreground">{branchComparisonData.comparison.branchA.total_runs}</td>
                <td className="px-4 py-3 text-center text-foreground">{branchComparisonData.comparison.branchB.total_runs}</td>
                <td className="px-4 py-3 text-center text-muted-foreground">—</td>
                <td className="px-4 py-3 text-center text-muted-foreground">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
