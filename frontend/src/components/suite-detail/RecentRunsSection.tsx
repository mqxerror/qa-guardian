/**
 * RecentRunsSection - Collapsible run history with pass rate trend chart
 * Extracted from TestSuitePage.tsx for component decomposition (Agent 7)
 * Feature #553: Inline run history with pass rate trend chart
 * Feature #556: Pass Rate Trend Chart - uses ScoreTrendChart
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { ScoreTrendChart } from '../ui';

/** Minimal run type covering the fields used in this component */
interface SuiteRunSummary {
  id: string;
  status: string;
  created_at: string;
  duration_ms?: number;
  passed_count?: number;
  results_count?: number;
}

export interface RecentRunsSectionProps {
  /** Raw runs data from the useRunsBySuite hook (may have .runs or .data) */
  suiteRunsData: { runs?: SuiteRunSummary[]; data?: SuiteRunSummary[] } | undefined;
}

export function RecentRunsSection({ suiteRunsData }: RecentRunsSectionProps) {
  const navigate = useNavigate();
  const [showRecentRuns, setShowRecentRuns] = useState(false);

  const suiteRuns = suiteRunsData?.runs || suiteRunsData?.data || [];
  // Only show if there are completed runs
  const completedRuns = suiteRuns
    .filter((r) => r.status === 'passed' || r.status === 'failed' || r.status === 'error')
    .slice(0, 10);

  if (completedRuns.length === 0) return null;

  // Feature #556: Prepare chart data for ScoreTrendChart (oldest first)
  const chartRuns = [...completedRuns].reverse();
  const chartData = chartRuns.map((r) => {
    const total = r.results_count || 1;
    const passed = r.passed_count || 0;
    const passRate = Math.round((passed / total) * 100);
    return {
      label: new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: passRate,
    };
  });

  return (
    <div className="mt-6 rounded-lg border border-border bg-card">
      <Button
        variant="ghost"
        onClick={() => setShowRecentRuns(!showRecentRuns)}
        className="w-full flex items-center justify-between text-left h-auto px-4 py-3"
      >
        <span className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Recent Runs ({completedRuns.length})
        </span>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform ${showRecentRuns ? 'rotate-180' : ''}`}
        />
      </Button>

      {showRecentRuns && (
        <div className="px-4 pb-4 space-y-4">
          {/* Feature #556: Pass Rate Trend Chart - uses ScoreTrendChart */}
          {chartData.length >= 3 && (
            <ScoreTrendChart
              data={chartData}
              title="Pass Rate Trend"
              thresholds={{ good: 90, warning: 70 }}
              valueLabel="Pass Rate"
              showPercent
              legend={[
                { label: '\u226590% Good', colorClass: 'bg-success' },
                { label: '70-89% Fair', colorClass: 'bg-warning' },
                { label: '<70% Poor', colorClass: 'bg-destructive' },
              ]}
            />
          )}

          {/* Compact Run Rows */}
          <div className="space-y-1">
            {completedRuns.map((run) => (
              <Button
                key={run.id}
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/runs/${run.id}`)}
                className="w-full flex items-center gap-3 h-auto px-3 py-2 text-left justify-start"
              >
                {/* Status dot */}
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                  run.status === 'passed' ? 'bg-success' :
                  run.status === 'failed' ? 'bg-destructive' :
                  'bg-warning'
                }`} />
                {/* Date */}
                <span className="text-muted-foreground w-28 flex-shrink-0">
                  {new Date(run.created_at).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </span>
                {/* Duration */}
                <span className="text-muted-foreground w-16 flex-shrink-0">
                  {run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : '-'}
                </span>
                {/* Pass count */}
                <span className="text-foreground flex-1">
                  {run.passed_count || 0}/{run.results_count || 0} passed
                </span>
                {/* Arrow */}
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default RecentRunsSection;
