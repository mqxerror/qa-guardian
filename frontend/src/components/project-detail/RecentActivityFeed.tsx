/**
 * RecentActivityFeed - Last N runs across all suites
 * Extracted from ProjectDetailPage.tsx for component decomposition (Agent 7)
 * Feature #558: Recent activity feed
 */

import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Zap } from 'lucide-react';
import { getRelativeTime } from './utils';

interface RecentRun {
  id: string;
  suite_name?: string;
  test_name?: string;
  status: string;
  created_at: string;
  duration_ms?: number;
}

interface RecentActivityFeedProps {
  /** Raw data from useRunsByProject -- may have .runs or .data */
  recentRunsData: { runs?: RecentRun[]; data?: RecentRun[] } | undefined;
  /** Maximum number of runs to show */
  maxRuns?: number;
}

export function RecentActivityFeed({ recentRunsData, maxRuns = 5 }: RecentActivityFeedProps) {
  const navigate = useNavigate();
  const recentRuns = (recentRunsData?.runs || recentRunsData?.data || []).slice(0, maxRuns);

  if (recentRuns.length === 0) return null;

  return (
    <div className="mt-4 rounded-lg border border-border bg-card border-l-4 border-l-primary">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Zap className="w-4 h-4" />
          Recent Activity
        </h3>
      </div>
      <div className="divide-y divide-border">
        {recentRuns.map((run) => (
          <Button
            key={run.id}
            variant="ghost"
            onClick={() => navigate(`/runs/${run.id}`)}
            className="w-full h-auto flex items-center gap-3 px-4 py-2.5 text-sm text-left rounded-none"
          >
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
              run.status === 'passed' ? 'bg-success' :
              run.status === 'failed' ? 'bg-destructive' :
              run.status === 'running' ? 'bg-warning animate-pulse' :
              'bg-muted-foreground'
            }`} />
            <span className="flex-1 truncate text-foreground">
              {run.suite_name || 'Suite'}{run.test_name ? ` \u203A ${run.test_name}` : ''}
            </span>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {getRelativeTime(run.created_at)}
            </span>
            {run.duration_ms != null && run.duration_ms > 0 && (
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {run.duration_ms < 1000 ? `${run.duration_ms}ms` : `${(run.duration_ms / 1000).toFixed(1)}s`}
              </span>
            )}
          </Button>
        ))}
      </div>
    </div>
  );
}
