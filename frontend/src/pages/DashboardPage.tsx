import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { formatRelativeTime } from '../utils/format';
import { Layout } from '../components/Layout';
// Feature #70: Import React Query hooks for dashboard caching
import { useDashboardStats, useRecentRuns } from '../hooks/api/useDashboard';
// Feature #871: Import trend and flaky test hooks
import { usePassRateTrends } from '../hooks/api/useAnalytics';
import { useFlakyTests } from '../hooks/api/useFlakyTests';
// Feature #125: SkeletonCard removed - using custom pulse animations
// Feature #513: import { SkeletonCard } from '../components/ui/Skeleton';
// Feature #336: Design system components
import {
  PageHeader,
  StatCard,
  SectionHeader,
} from '../components/ui';
import { EmptyState, EmptyStateIcons } from '../components/ui/EmptyState';
// Feature #468: Quality Health summary card
import { QualityHealthCard } from '../components/dashboard';
import {
  FolderKanban,
  TestTube2,
  FlaskConical,
  PlayCircle,
  CheckCircle2,
  XCircle,
  Percent,
  AlertTriangle,
  Clock,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

export function DashboardPage() {
  const { user } = useAuthStore();

  // Feature #70: Use React Query for caching - dashboard loads instantly on revisit
  const { data: stats, isLoading, isError, error } = useDashboardStats();

  // Feature #871: Fetch pass rate trends (last 30 days) and recent failed runs
  const { data: trendsData, isLoading: trendsLoading } = usePassRateTrends(30);
  const { data: recentRunsData } = useRecentRuns(20);
  const { data: flakyData } = useFlakyTests();

  // Default stats when loading or no data
  const displayStats = stats || {
    projects: 0,
    test_suites: 0,
    tests: 0,
    test_runs: 0,
    passed_runs: 0,
    failed_runs: 0,
    pass_rate: 0,
  };

  // Feature #871: Extract recent failures (last 5 failed runs)
  const recentFailures = useMemo(() => {
    if (!recentRunsData) return [];
    const runs = Array.isArray(recentRunsData) ? recentRunsData : recentRunsData.runs || [];
    return runs
      .filter((r: { status: string }) => r.status === 'failed' || r.status === 'error')
      .slice(0, 5);
  }, [recentRunsData]);

  // Feature #871: Extract top flaky tests (top 3)
  const topFlakyTests = useMemo(() => {
    if (!flakyData) return [];
    const tests = Array.isArray(flakyData) ? flakyData : flakyData.flakyTests || [];
    return tests
      .sort((a: { flakiness_score?: number }, b: { flakiness_score?: number }) =>
        (b.flakiness_score || 0) - (a.flakiness_score || 0))
      .slice(0, 3);
  }, [flakyData]);

  // Feature #871: Extract trend data for chart
  const trendPoints = useMemo(() => {
    if (!trendsData) return [];
    const trends = trendsData.trends || [];
    // Show last 14 days for readability
    return trends.slice(-14);
  }, [trendsData]);

  // Feature #871: Calculate if attention is needed
  const needsAttention = recentFailures.length > 0 || topFlakyTests.length > 0;

  return (
    <Layout>
      <div className="p-6 lg:p-8 space-y-8">
        {/* Feature #336: PageHeader with welcome message */}
        <PageHeader
          title="Dashboard"
          description={`Welcome to your QA Guardian dashboard, ${user?.name || 'User'}!`}
          breadcrumbs={[{ label: 'Home' }, { label: 'Dashboard' }]}
        />

        {isError && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-6 text-center">
            <AlertTriangle className="h-8 w-8 mx-auto text-destructive mb-2" />
            <h3 className="text-lg font-semibold text-destructive">Failed to load dashboard</h3>
            <p className="text-sm text-muted-foreground mt-1">{error instanceof Error ? error.message : 'An unexpected error occurred'}</p>
          </div>
        )}

        {/* Phase 3: Compact stat bar - single row, clickable */}
        {isLoading ? (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            <StatCard
              icon={Percent}
              value={`${displayStats.pass_rate}%`}
              label="Pass Rate"
              compact
              href="/analytics"
              className={displayStats.pass_rate >= 80 ? '[&_.text-lg]:text-success' : displayStats.pass_rate >= 50 ? '[&_.text-lg]:text-warning' : '[&_.text-lg]:text-destructive'}
            />
            <StatCard icon={FolderKanban} value={displayStats.projects} label="Projects" compact href="/projects" />
            <StatCard icon={FlaskConical} value={displayStats.test_suites} label="Suites" compact href="/projects" />
            <StatCard icon={TestTube2} value={displayStats.tests} label="Tests" compact />
            <StatCard icon={PlayCircle} value={displayStats.test_runs} label="Runs" compact href="/run-history" />
            <StatCard
              icon={XCircle}
              value={displayStats.failed_runs}
              label="Failed"
              compact
              href="/run-history"
              className="[&_.text-lg]:text-destructive"
            />
          </div>
        )}

        {/* Phase 3: Needs Attention moved UP - most actionable content first */}
        <div className="space-y-4">
          <SectionHeader
            title="Needs Attention"
            description={needsAttention ? 'Issues requiring your review' : 'Everything looks good!'}
          />

          {!needsAttention ? (
            <EmptyState
              icon={EmptyStateIcons.run}
              title="All clear!"
              description="No recent test failures detected."
              size="sm"
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Recent Failures - Phase 7: colored left border for semantic meaning */}
              <div className="rounded-xl border border-border bg-card border-l-4 border-l-destructive">
                <div className="flex items-center justify-between p-4 border-b border-border">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-destructive" />
                    <h3 className="text-sm font-semibold text-foreground">Recent Failures</h3>
                    {recentFailures.length > 0 && (
                      <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">
                        {recentFailures.length}
                      </span>
                    )}
                  </div>
                  <Link
                    to="/run-history"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    View all <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="divide-y divide-border">
                  {recentFailures.length === 0 ? (
                    <EmptyState
                      icon={EmptyStateIcons.run}
                      title="All clear!"
                      description="No recent test failures detected."
                      size="sm"
                    />
                  ) : (
                    recentFailures.map((run: {
                      id: string;
                      suite_name?: string;
                      test_name?: string;
                      project_name?: string;
                      status: string;
                      created_at: string;
                      browser?: string;
                    }) => (
                      <Link
                        key={run.id}
                        to={`/run-history`}
                        className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10 flex-shrink-0">
                          <XCircle className="h-4 w-4 text-destructive" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">
                            {run.suite_name || run.test_name || 'Test Run'}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {run.project_name && <span>{run.project_name}</span>}
                            {run.browser && (
                              <span className="capitalize">{run.browser}</span>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatRelativeTime(run.created_at)}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium capitalize">
                          {run.status}
                        </span>
                      </Link>
                    ))
                  )}
                </div>
              </div>

              {/* Flaky Tests - Phase 7: colored left border for semantic meaning */}
              <div className="rounded-xl border border-border bg-card border-l-4 border-l-warning">
                <div className="flex items-center justify-between p-4 border-b border-border">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-5 w-5 text-warning" />
                    <h3 className="text-sm font-semibold text-foreground">Flaky Tests</h3>
                    {topFlakyTests.length > 0 && (
                      <span className="text-xs bg-warning/10 text-warning px-2 py-0.5 rounded-full">
                        {topFlakyTests.length}
                      </span>
                    )}
                  </div>
                  <Link
                    to="/ai-insights/flaky-tests"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    View all <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="divide-y divide-border">
                  {topFlakyTests.length === 0 ? (
                    <EmptyState
                      icon={EmptyStateIcons.test}
                      title="No flaky tests detected"
                      description="Great news! No tests are showing flaky behavior."
                      size="sm"
                    />
                  ) : (
                    topFlakyTests.map((test: {
                      test_id: string;
                      test_name: string;
                      suite_name?: string;
                      project_name?: string;
                      flakiness_score?: number;
                      flakiness_percentage?: number;
                      pass_rate?: number;
                      total_runs?: number;
                      recommendation?: string;
                    }) => (
                      <div
                        key={test.test_id}
                        className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-warning/10 flex-shrink-0">
                          <AlertTriangle className="h-4 w-4 text-warning" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">
                            {test.test_name}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {test.suite_name && <span>{test.suite_name}</span>}
                            {test.total_runs != null && (
                              <span>{test.total_runs} runs</span>
                            )}
                            {test.recommendation && (
                              <span className="truncate max-w-[120px]" title={test.recommendation}>
                                {test.recommendation}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`text-sm font-bold ${
                            (test.flakiness_score || 0) > 0.5 ? 'text-destructive' :
                            (test.flakiness_score || 0) > 0.2 ? 'text-warning' :
                            'text-muted-foreground'
                          }`}>
                            {test.flakiness_percentage != null
                              ? `${Math.round(test.flakiness_percentage)}%`
                              : test.flakiness_score != null
                                ? `${Math.round(test.flakiness_score * 100)}%`
                                : '-'}
                          </p>
                          <p className="text-[10px] text-muted-foreground">flaky</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Phase 3: Pass Rate Trends (moved below Needs Attention) */}
        <div className="space-y-4">
          <SectionHeader
            title="Pass Rate Trends"
            description="Daily pass rate over the last 30 days"
          />
          <div className="rounded-xl border border-border bg-card p-6">
            {trendsLoading ? (
              <div className="h-48 bg-muted/50 rounded-lg animate-pulse" />
            ) : trendPoints.length === 0 ? (
              <EmptyState
                icon={EmptyStateIcons.analytics}
                title="No trend data yet"
                description="Run tests to see pass rate trends here."
                size="sm"
              />
            ) : (
              <div className="space-y-3">
                {/* Summary bar */}
                {trendsData?.summary && (
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                    <span>{trendsData.summary.total_runs} runs in {trendsData.summary.period_days} days</span>
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-success" />
                      {trendsData.summary.total_passed} passed
                    </span>
                    <span className="flex items-center gap-1">
                      <XCircle className="h-3 w-3 text-destructive" />
                      {trendsData.summary.total_failed} failed
                    </span>
                    {trendsData.summary.overall_pass_rate !== null && (
                      <span className="font-medium text-foreground">
                        {trendsData.summary.overall_pass_rate}% overall
                      </span>
                    )}
                  </div>
                )}
                {/* CSS bar chart */}
                <div className="flex items-end gap-1 h-40">
                  {trendPoints.map((point: { date: string; passed: number; failed: number; total: number; pass_rate: number | null }, i: number) => {
                    const rate = point.pass_rate ?? 0;
                    const barHeight = point.total > 0 ? Math.max(rate, 4) : 2; // min 4% height for visibility, 2% for empty days
                    const dayLabel = point.date.slice(5); // MM-DD
                    const barColor = point.total === 0
                      ? 'bg-muted/40'
                      : rate >= 80
                        ? 'bg-success'
                        : rate >= 50
                          ? 'bg-warning'
                          : 'bg-destructive';

                    return (
                      <div
                        key={point.date}
                        className="flex-1 flex flex-col items-center gap-1 group relative"
                      >
                        {/* Tooltip */}
                        <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                          <div className="bg-popover border border-border rounded-lg shadow-lg px-3 py-2 text-xs whitespace-nowrap">
                            <p className="font-medium text-foreground">{point.date}</p>
                            <p className="text-muted-foreground">
                              {point.total} runs &middot; {point.passed} passed &middot; {point.failed} failed
                            </p>
                            {point.pass_rate !== null && (
                              <p className={`font-medium ${
                                rate >= 80 ? 'text-success' : rate >= 50 ? 'text-warning' : 'text-destructive'
                              }`}>
                                {point.pass_rate}% pass rate
                              </p>
                            )}
                          </div>
                        </div>
                        {/* Bar */}
                        <div
                          className={`w-full rounded-t-sm transition-all duration-300 ${barColor} ${
                            point.total === 0 ? 'opacity-30' : 'opacity-80 hover:opacity-100'
                          }`}
                          style={{ height: `${barHeight}%` }}
                        />
                        {/* Label - show every other day to avoid crowding */}
                        {(i % 2 === 0 || trendPoints.length <= 7) && (
                          <span className="text-[10px] text-muted-foreground truncate w-full text-center">
                            {dayLabel}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Legend */}
                <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-1">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-sm bg-success" /> &ge;80%
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-sm bg-warning" /> 50-79%
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-sm bg-destructive" /> &lt;50%
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-sm bg-muted/40" /> No runs
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Phase 3: Quality Health card moved below trends */}
        <QualityHealthCard
          data={{
            passRate: displayStats.pass_rate,
            totalRuns: displayStats.test_runs,
            passedRuns: displayStats.passed_runs,
            failedRuns: displayStats.failed_runs,
            totalTests: displayStats.tests,
          }}
          isLoading={isLoading}
        />
      </div>
    </Layout>
  );
}

