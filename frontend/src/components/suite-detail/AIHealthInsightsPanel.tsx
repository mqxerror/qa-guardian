/**
 * AIHealthInsightsPanel - Collapsible AI health monitoring panel for test suites
 * Extracted from TestSuitePage.tsx for component decomposition (Agent 7)
 * Feature #580: AI Health Monitoring - Proactive insights panel
 */

import { Sparkles, AlertTriangle, AlertCircle, Info, ChevronDown, ChevronUp, Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Button } from '../ui/button';
import type { UseAIHealthStateReturn, AIHealthReport } from './useAIHealthState';

export interface AIHealthInsightsPanelProps {
  aiHealth: UseAIHealthStateReturn;
  onRunHealthCheck: () => void;
}

export function AIHealthInsightsPanel({ aiHealth, onRunHealthCheck }: AIHealthInsightsPanelProps) {
  const { aiHealthReport, isLoadingHealthCheck, showHealthInsights } = aiHealth;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <Button
        variant="ghost"
        onClick={() => {
          if (!showHealthInsights && !aiHealthReport && !isLoadingHealthCheck) {
            onRunHealthCheck();
          } else {
            aiHealth.toggleInsights();
          }
        }}
        className="w-full flex items-center justify-between p-4 h-auto rounded-none"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10">
            <Sparkles className="h-4 w-4 text-accent" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-foreground">AI Health Insights</h3>
            <p className="text-xs text-muted-foreground">
              {aiHealthReport
                ? `Score: ${aiHealthReport.health_score} · ${aiHealthReport.recommendations.length} recommendation${aiHealthReport.recommendations.length !== 1 ? 's' : ''}`
                : 'Click to analyze suite health'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isLoadingHealthCheck && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {aiHealthReport && (
            <span className={`text-sm font-bold ${
              aiHealthReport.health_score >= 80 ? 'text-success' :
              aiHealthReport.health_score >= 60 ? 'text-warning' :
              'text-destructive'
            }`}>
              {aiHealthReport.health_score}
            </span>
          )}
          {showHealthInsights ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </Button>

      {showHealthInsights && aiHealthReport && (
        <AIHealthInsightsContent
          report={aiHealthReport}
          isLoading={isLoadingHealthCheck}
          onRefresh={onRunHealthCheck}
        />
      )}
    </div>
  );
}

/** Expanded content showing AI summary, trend, and recommendations */
function AIHealthInsightsContent({
  report,
  isLoading,
  onRefresh,
}: {
  report: AIHealthReport;
  isLoading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="px-4 pb-4 border-t border-border pt-4 space-y-4">
      {/* AI Summary + Trend */}
      <div className="flex items-start gap-3 p-3 rounded-md bg-muted/50">
        <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
          {report.trend === 'improving' && <TrendingUp className="h-4 w-4 text-success" />}
          {report.trend === 'degrading' && <TrendingDown className="h-4 w-4 text-destructive" />}
          {report.trend === 'stable' && <Minus className="h-4 w-4 text-muted-foreground" />}
        </div>
        <div>
          <p className="text-sm text-foreground">{report.ai_summary}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Generated {new Date(report.generated_at).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Recommendations */}
      <div className="space-y-2">
        {report.recommendations.map((rec) => (
          <RecommendationCard key={rec.id} rec={rec} />
        ))}
      </div>

      {/* Refresh button */}
      <div className="flex justify-end">
        <Button
          variant="secondary"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-1 text-xs"
        >
          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Sparkles className="h-3 w-3" />
          )}
          Refresh Analysis
        </Button>
      </div>
    </div>
  );
}

/** Single recommendation card with severity-based styling */
function RecommendationCard({ rec }: { rec: AIHealthReport['recommendations'][number] }) {
  return (
    <div
      className={`rounded-md p-3 border ${
        rec.severity === 'critical'
          ? 'bg-destructive/5 border-destructive/20'
          : rec.severity === 'warning'
          ? 'bg-warning/5 border-warning/20'
          : 'bg-muted/30 border-border'
      }`}
    >
      <div className="flex items-start gap-2">
        {rec.severity === 'critical' && <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />}
        {rec.severity === 'warning' && <AlertCircle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />}
        {rec.severity === 'info' && <Info className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{rec.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{rec.description}</p>
          <p className="text-xs text-accent mt-1">
            <span className="font-medium">Action:</span> {rec.suggested_action}
          </p>
          {rec.affected_tests && rec.affected_tests.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {rec.affected_tests.map((test, idx) => (
                <span key={idx} className="px-1.5 py-0.5 text-xs bg-muted rounded text-muted-foreground">
                  {test}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AIHealthInsightsPanel;
