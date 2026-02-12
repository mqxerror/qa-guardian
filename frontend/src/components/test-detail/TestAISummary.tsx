/**
 * TestAISummary - AI Summary card for Test Detail page
 * Feature #489: Add AI summary card for instant failure diagnosis
 *
 * Displays:
 * - Last 3 run results with pass/fail status
 * - Average duration with trend indicator
 * - AI-generated diagnosis for failed tests
 * - Collapsible card with chevron toggle
 */

import React, { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Sparkles, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { TestRunType, RunStatus } from './types';
import { formatDuration } from '../../utils/formatDuration';

export interface TestAISummaryProps {
  testId: string;
  testName: string;
  runs: TestRunType[];
  token: string | null;
  formatDateTime?: (date: string) => string;
}

interface AIDiagnosis {
  summary: string;
  likely_cause: string;
  suggested_fix?: string;
}

// Feature #574: Wrapped in React.memo to prevent re-renders from unrelated state changes
function TestAISummaryInner({
  testId,
  testName,
  runs,
  token,
  formatDateTime,
}: TestAISummaryProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [diagnosis, setDiagnosis] = useState<AIDiagnosis | null>(null);
  const [isLoadingDiagnosis, setIsLoadingDiagnosis] = useState(false);
  const [diagnosisError, setDiagnosisError] = useState<string | null>(null);

  // Get last 3 runs sorted by date (most recent first)
  const recentRuns = useMemo(() => {
    return [...runs]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 3);
  }, [runs]);

  // Calculate average duration from recent runs
  const avgDuration = useMemo(() => {
    const runsWithDuration = recentRuns.filter(r => r.duration_ms && r.duration_ms > 0);
    if (runsWithDuration.length === 0) return null;
    const total = runsWithDuration.reduce((sum, r) => sum + (r.duration_ms || 0), 0);
    return Math.round(total / runsWithDuration.length);
  }, [recentRuns]);

  // Calculate trend (improving, degrading, or stable)
  const trend = useMemo(() => {
    if (recentRuns.length < 2) return 'stable';

    // If more recent runs are passing, improving
    // If more recent runs are failing, degrading
    const recentPassCount = recentRuns.slice(0, 2).filter(r => r.status === 'passed').length;
    const olderPassCount = recentRuns.slice(1).filter(r => r.status === 'passed').length;

    if (recentPassCount > olderPassCount) return 'improving';
    if (recentPassCount < olderPassCount) return 'degrading';
    return 'stable';
  }, [recentRuns]);

  // Check if last run failed
  const lastRunFailed = useMemo(() => {
    if (recentRuns.length === 0) return false;
    const lastRun = recentRuns[0];
    return lastRun.status === 'failed' || lastRun.status === 'error';
  }, [recentRuns]);

  // Feature #575: Detect degrading-but-passing conditions for proactive AI analysis
  const isDegrading = useMemo(() => {
    if (lastRunFailed || runs.length < 3) return false;
    // Check 1: trend is degrading (more recent failures than older)
    if (trend === 'degrading') return true;
    // Check 2: Duration regression — last run > 2× average of previous runs
    const runsWithDuration = runs.filter(r => r.duration_ms && r.duration_ms > 0);
    if (runsWithDuration.length >= 3) {
      const allDurations = runsWithDuration.map(r => r.duration_ms!);
      const olderAvg = allDurations.slice(1).reduce((a, b) => a + b, 0) / (allDurations.length - 1);
      if (olderAvg > 0 && allDurations[0] > olderAvg * 2) return true;
    }
    // Check 3: Flakiness rate > 20% in recent runs
    const last10 = runs.slice(0, 10);
    const failCount = last10.filter(r => r.status === 'failed' || r.status === 'error').length;
    if (last10.length >= 5 && (failCount / last10.length) > 0.2) return true;
    return false;
  }, [lastRunFailed, runs, trend]);

  // Feature #575: Determine diagnosis mode — 'failure' | 'degrading' | null
  const diagnosisMode = useMemo(() => {
    if (lastRunFailed) return 'failure' as const;
    if (isDegrading) return 'degrading' as const;
    return null;
  }, [lastRunFailed, isDegrading]);

  // Fetch AI diagnosis when last run failed OR test is degrading (Feature #575)
  useEffect(() => {
    if (!diagnosisMode || !token || !recentRuns[0]) {
      setDiagnosis(null);
      return;
    }

    const fetchDiagnosis = async () => {
      setIsLoadingDiagnosis(true);
      setDiagnosisError(null);

      try {
        const lastRun = recentRuns[0];

        if (diagnosisMode === 'failure') {
          const errorMessage = lastRun.error || 'Test failed';

          // Call the AI failure analysis endpoint
          const response = await fetch(
            `${import.meta.env.VITE_API_BASE_URL || ''}/api/v1/ai/explain-failure`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({
                test_id: testId,
                test_name: testName,
                run_id: lastRun.id,
                error_message: errorMessage,
                format: 'brief',
              }),
            }
          );

          if (!response.ok) {
            setDiagnosis({
              summary: `Test "${testName}" failed in the last run`,
              likely_cause: lastRun.error || 'Unknown error - check test results for details',
            });
            return;
          }

          const data = await response.json();
          setDiagnosis(data.diagnosis || {
            summary: data.summary || `Test failed: ${errorMessage.substring(0, 100)}`,
            likely_cause: data.likely_cause || data.root_cause || 'See full results for details',
            suggested_fix: data.suggested_fix || data.suggested_fixes?.[0],
          });
        } else {
          // Feature #575: Degrading-but-passing — send trend data for proactive analysis
          const runsWithDuration = runs.filter(r => r.duration_ms && r.duration_ms > 0);
          const durations = runsWithDuration.slice(0, 10).map(r => r.duration_ms!);
          const avgDur = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
          const last10 = runs.slice(0, 10);
          const failRate = last10.length > 0 ? Math.round((last10.filter(r => r.status === 'failed' || r.status === 'error').length / last10.length) * 100) : 0;

          const response = await fetch(
            `${import.meta.env.VITE_API_BASE_URL || ''}/api/v1/ai/explain-failure`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({
                test_id: testId,
                test_name: testName,
                run_id: lastRun.id,
                error_message: `Test is passing but showing degradation: avg duration ${avgDur}ms, last run ${lastRun.duration_ms}ms, fail rate ${failRate}%, trend: ${trend}`,
                format: 'brief',
                analysis_type: 'degradation',
              }),
            }
          );

          if (!response.ok) {
            setDiagnosis({
              summary: `Test "${testName}" is passing but showing signs of degradation`,
              likely_cause: `Duration trend or flakiness rate suggests the test may start failing soon (fail rate: ${failRate}%)`,
              suggested_fix: 'Review recent changes to test environment or application code',
            });
            return;
          }

          const data = await response.json();
          setDiagnosis(data.diagnosis || {
            summary: data.summary || `Test passing but degrading: ${failRate}% fail rate`,
            likely_cause: data.likely_cause || data.root_cause || 'Duration regression or increasing flakiness detected',
            suggested_fix: data.suggested_fix || data.suggested_fixes?.[0] || 'Monitor closely and investigate root cause',
          });
        }
      } catch (err) {
        setDiagnosisError('Could not load AI diagnosis');
        setDiagnosis({
          summary: diagnosisMode === 'failure' ? `Test "${testName}" failed` : `Test "${testName}" is degrading`,
          likely_cause: diagnosisMode === 'failure'
            ? (recentRuns[0]?.error || 'Check test results for details')
            : 'Duration regression or flakiness increase detected',
        });
      } finally {
        setIsLoadingDiagnosis(false);
      }
    };

    fetchDiagnosis();
  }, [diagnosisMode, token, testId, testName, recentRuns, runs, trend]);

  // Don't render if no runs
  if (runs.length === 0) {
    return null;
  }

  const getStatusIcon = (status: RunStatus) => {
    if (status === 'passed') {
      return <CheckCircle className="h-4 w-4 text-success" />;
    }
    if (status === 'failed' || status === 'error') {
      return <XCircle className="h-4 w-4 text-destructive" />;
    }
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  const getTrendIcon = () => {
    if (trend === 'improving') {
      return <TrendingUp className="h-4 w-4 text-success" />;
    }
    if (trend === 'degrading') {
      return <TrendingDown className="h-4 w-4 text-destructive" />;
    }
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getTrendLabel = () => {
    if (trend === 'improving') return 'Improving';
    if (trend === 'degrading') return 'Degrading';
    return 'Stable';
  };

  return (
    <div className="mb-6 rounded-lg border border-border bg-card overflow-hidden">
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10">
            <Sparkles className="h-4 w-4 text-accent" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-foreground">AI Summary</h3>
            <p className="text-xs text-muted-foreground">
              {recentRuns.length} recent run{recentRuns.length !== 1 ? 's' : ''} analyzed
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Quick status indicators when collapsed */}
          {!isExpanded && (
            <div className="flex items-center gap-2">
              {recentRuns.slice(0, 3).map((run, idx) => (
                <div key={run.id} className="flex items-center">
                  {getStatusIcon(run.status)}
                </div>
              ))}
              {lastRunFailed && (
                <span className="text-xs text-destructive font-medium ml-2">
                  Last run failed
                </span>
              )}
              {/* Feature #575: Show degrading warning in collapsed header */}
              {isDegrading && !lastRunFailed && (
                <span className="text-xs text-warning font-medium ml-2">
                  Degrading
                </span>
              )}
            </div>
          )}
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-border pt-4">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Last 3 runs */}
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Recent Runs
              </h4>
              <div className="space-y-1">
                {recentRuns.map((run, idx) => (
                  <div
                    key={run.id}
                    className="flex items-center justify-between text-sm py-1"
                  >
                    <div className="flex items-center gap-2">
                      {getStatusIcon(run.status)}
                      <span className="text-foreground capitalize">
                        {run.status}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {run.duration_ms ? formatDuration(run.duration_ms) : '-'}
                    </span>
                  </div>
                ))}
                {recentRuns.length === 0 && (
                  <p className="text-sm text-muted-foreground">No runs yet</p>
                )}
              </div>
            </div>

            {/* Average duration & trend */}
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Performance
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Avg Duration</span>
                  <span className="font-medium text-foreground">
                    {avgDuration ? formatDuration(avgDuration) : '-'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Trend</span>
                  <div className="flex items-center gap-1">
                    {getTrendIcon()}
                    <span className={`font-medium ${
                      trend === 'improving' ? 'text-success' :
                      trend === 'degrading' ? 'text-destructive' :
                      'text-foreground'
                    }`}>
                      {getTrendLabel()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Diagnosis - Feature #575: Extended to cover failure, degrading, and healthy states */}
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                AI Diagnosis
              </h4>
              {diagnosisMode ? (
                <div className={`rounded-md p-3 ${
                  diagnosisMode === 'failure'
                    ? 'bg-destructive/5 border border-destructive/20'
                    : 'bg-warning/5 border border-warning/20'
                }`}>
                  {isLoadingDiagnosis ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {diagnosisMode === 'failure' ? 'Analyzing failure...' : 'Analyzing degradation...'}
                    </div>
                  ) : diagnosis ? (
                    <div className="space-y-1">
                      <p className="text-sm text-foreground font-medium">
                        {diagnosis.summary}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {diagnosis.likely_cause}
                      </p>
                      {diagnosis.suggested_fix && (
                        <p className={`text-xs mt-2 ${diagnosisMode === 'failure' ? 'text-accent' : 'text-warning'}`}>
                          <span className="font-medium">Suggested fix:</span> {diagnosis.suggested_fix}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {diagnosisError || 'Unable to analyze'}
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-md bg-success/5 border border-success/20 p-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-success" />
                    <p className="text-sm text-foreground">
                      Last run passed - no issues detected
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const TestAISummary = React.memo(TestAISummaryInner);
