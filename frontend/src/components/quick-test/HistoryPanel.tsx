/**
 * HistoryPanel - Recent test history with re-view capability and trend chart
 * Extracted from QuickTestPage.tsx for component decomposition (Agent 7)
 * Feature #542: Enhanced History Panel
 */

import {
  AnimatedCard,
  CardContent,
  ScoreTrendChart,
} from '../ui';
import { EmptyState, EmptyStateIcons } from '../ui/EmptyState';
import { Button } from '@/components/ui/button';
import { Loader2, ExternalLink, BarChart2 } from 'lucide-react';
import { getScoreColor } from './utils';
import type { HistoryEntry } from './types';

interface HistoryPanelProps {
  history: HistoryEntry[];
  historyLoading: boolean;
  /** The URL currently being tested (for filtering trend chart) */
  testingUrl: string | null;
  onSelectEntry: (entry: HistoryEntry) => void;
}

export function HistoryPanel({ history, historyLoading, testingUrl, onSelectEntry }: HistoryPanelProps) {
  return (
    <AnimatedCard>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Recent Tests</h2>
          <span className="text-xs text-muted-foreground">{history.length} result{history.length !== 1 ? 's' : ''}</span>
        </div>
        {historyLoading && (
          <div className="flex items-center gap-2 mb-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="text-sm text-primary">Loading test results...</span>
          </div>
        )}
        {history.length === 0 ? (
          <EmptyState icon={EmptyStateIcons.test} title="No completed tests yet" description="Run a test to see it here." size="sm" />
        ) : (
        <>
        <div className="space-y-2">
          {history.map(entry => {
            let hostname = entry.url;
            try { hostname = new URL(entry.url).hostname; } catch { /* keep full url */ }
            return (
            <Button
              key={entry.runId}
              variant="ghost"
              onClick={() => onSelectEntry(entry)}
              disabled={historyLoading}
              className="w-full h-auto p-3 flex items-center justify-between text-left bg-muted/50 hover:bg-muted"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">
                    {hostname}
                  </div>
                  <div className="text-xs text-muted-foreground truncate max-w-[280px]">
                    {entry.url}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {new Date(entry.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
              {entry.score !== undefined && (
                <div className={`text-lg font-bold ${getScoreColor(entry.score)} flex-shrink-0 ml-3`}>
                  {entry.score}
                </div>
              )}
            </Button>
            );
          })}
        </div>

        {/* Score Timeline Chart - uses reusable ScoreTrendChart */}
        {(() => {
          // Filter history entries that have scores and match the current URL being tested
          const entriesWithScores = history
            .filter(e => e.score !== undefined && (testingUrl ? e.url === testingUrl : true))
            .slice(0, 10) // Last 10 runs
            .reverse(); // Oldest first for chart

          if (entriesWithScores.length < 3) return null;

          const chartData = entriesWithScores.map(e => ({
            label: new Date(e.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            value: e.score || 0,
          }));

          return (
            <div className="mt-6 pt-4 border-t border-border">
              <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <BarChart2 className="w-4 h-4" />
                Score Trend (Last {entriesWithScores.length} Runs)
              </h3>
              <ScoreTrendChart
                data={chartData}
                thresholds={{ good: 80, warning: 60 }}
                valueLabel="Score"
              />
            </div>
          );
        })()}
        </>
        )}
      </CardContent>
    </AnimatedCard>
  );
}
