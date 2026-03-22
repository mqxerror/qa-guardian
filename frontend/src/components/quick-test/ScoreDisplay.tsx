/**
 * ScoreDisplay - Compact score summary header for Quick Test results
 * Extracted from QuickTestPage.tsx for component decomposition (Agent 7)
 * Phase 6: Compact single-row score bar
 */

import {
  Globe,
  Shield,
  Gauge,
  Accessibility,
  Network,
  Search,
  BarChart2,
} from 'lucide-react';
import { getScoreTextColor } from '../ui/score-card';
import type { QuickTestResult } from './types';

interface ScoreDisplayProps {
  summary: QuickTestResult['summary'];
}

/** Weight definitions for each score category (Feature #536) */
const SCORE_WEIGHTS: Array<{
  key: keyof NonNullable<QuickTestResult['summary']>;
  label: string;
  weight: number;
  icon: React.ElementType;
}> = [
  { key: 'healthScore', label: 'Health', weight: 12, icon: Globe },
  { key: 'performanceScore', label: 'Performance', weight: 18, icon: Gauge },
  { key: 'securityScore', label: 'Security', weight: 18, icon: Shield },
  { key: 'accessibilityScore', label: 'Accessibility', weight: 22, icon: Accessibility },
  { key: 'apiScore', label: 'API', weight: 10, icon: Network },
  { key: 'seoScore', label: 'SEO', weight: 10, icon: Search },
];

export function ScoreDisplay({ summary }: ScoreDisplayProps) {
  if (!summary) return null;

  const overallColor = getScoreTextColor(summary.overallScore);

  return (
    <div className="space-y-3">
      {/* Compact single-row score bar */}
      <div className="flex items-center gap-3 overflow-x-auto pb-1">
        {/* Overall score - slightly larger */}
        <div className="flex items-center gap-2 rounded-lg border-2 border-primary/30 bg-primary/5 px-4 py-2.5 flex-shrink-0">
          <BarChart2 className="w-4 h-4 text-primary" />
          <div>
            <div className={`text-2xl font-bold leading-none ${overallColor}`}>
              {summary.overallScore}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Overall</div>
          </div>
        </div>

        {/* Category scores - compact pills */}
        {SCORE_WEIGHTS.map(({ key, label, icon: Icon }) => {
          const score = summary[key];
          if (score === undefined || score === null) return null;

          const scoreNum = typeof score === 'number' ? score : 0;
          const textColor = getScoreTextColor(scoreNum);
          const barColor = scoreNum >= 80 ? 'bg-success' : scoreNum >= 60 ? 'bg-warning' : 'bg-destructive';

          return (
            <div
              key={key}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 flex-shrink-0 min-w-0"
            >
              <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <div className={`text-lg font-bold leading-none ${textColor}`}>{scoreNum}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
                <div className="mt-1 h-1 w-12 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(scoreNum, 100)}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
