import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
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
  AnimatedCard,
  SectionHeader,
  useReducedMotion,
  CardContent,
} from '../components/ui';
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
  Settings2,
  Lightbulb,
  Zap,
  FileText,
  ClipboardList,
  ChevronRight,
  Code,
  Terminal,
  BarChart3,
  MessageCircle,
  AlertTriangle,
  TrendingUp,
  Clock,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

export function DashboardPage() {
  const { user } = useAuthStore();

  // Feature #70: Use React Query for caching - dashboard loads instantly on revisit
  const { data: stats, isLoading } = useDashboardStats();

  // Feature #871: Fetch pass rate trends (last 30 days) and recent failed runs
  const { data: trendsData, isLoading: trendsLoading } = usePassRateTrends(30);
  const { data: recentRunsData } = useRecentRuns(20);
  const { data: flakyData } = useFlakyTests();

  // Feature #336: Check for reduced motion preference
  const prefersReducedMotion = useReducedMotion();

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

  // Calculate trend based on pass rate
  const _passRateTrend = displayStats.pass_rate >= 80 ? 'up' as const :
    displayStats.pass_rate >= 50 ? 'neutral' as const : 'down' as const;

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

        {/* Feature #468: Quality Health summary card - prominent first card */}
        <div className="grid gap-4 lg:grid-cols-3">
          <QualityHealthCard
            data={{
              passRate: displayStats.pass_rate,
              totalRuns: displayStats.test_runs,
              passedRuns: displayStats.passed_runs,
              failedRuns: displayStats.failed_runs,
              totalTests: displayStats.tests,
            }}
            isLoading={isLoading}
            className="lg:col-span-1"
          />
          {/* Placeholder for future expansion or additional summary cards */}
          <div className="lg:col-span-2 grid gap-4 sm:grid-cols-2">
            <StatCard
              icon={FolderKanban}
              value={displayStats.projects}
              label="Projects"
              className={!prefersReducedMotion ? 'delay-0' : ''}
            />
            <StatCard
              icon={PlayCircle}
              value={displayStats.test_runs}
              label="Test Runs"
              className={!prefersReducedMotion ? 'delay-1' : ''}
            />
          </div>
        </div>

        {/* Feature #336: Stats grid with StatCard components - remaining metrics */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
          {isLoading ? (
            <>
              <div className="h-32 bg-muted/50 rounded-lg animate-pulse" />
              <div className="h-32 bg-muted/50 rounded-lg animate-pulse" />
            </>
          ) : (
            <>
              <StatCard
                icon={FlaskConical}
                value={displayStats.test_suites}
                label="Test Suites"
                className={!prefersReducedMotion ? 'delay-2' : ''}
              />
              <StatCard
                icon={TestTube2}
                value={displayStats.tests}
                label="Total Tests"
                className={!prefersReducedMotion ? 'delay-3' : ''}
              />
            </>
          )}
        </div>

        {/* Feature #336: Test Results section with SectionHeader */}
        <div className="space-y-4">
          <SectionHeader title="Test Results" description="Overall test execution metrics" />
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="h-32 bg-muted/50 rounded-lg animate-pulse" />
              <div className="h-32 bg-muted/50 rounded-lg animate-pulse" />
              <div className="h-32 bg-muted/50 rounded-lg animate-pulse" />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Hero card for pass rate */}
              <AnimatedCard variant="hero" staggerIndex={4}>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/20">
                      <Percent className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Pass Rate</p>
                      <p className={`text-3xl font-bold ${
                        displayStats.pass_rate >= 80 ? 'text-success' :
                        displayStats.pass_rate >= 50 ? 'text-warning' :
                        'text-destructive'
                      }`}>
                        {displayStats.pass_rate}%
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {displayStats.passed_runs + displayStats.failed_runs} completed runs
                  </p>
                </CardContent>
              </AnimatedCard>

              <StatCard
                icon={CheckCircle2}
                value={displayStats.passed_runs}
                label="Passed Runs"
                trend="up"
                trendValue="successful"
                className="[&_svg]:text-success [&_.text-3xl]:text-success"
              />

              <StatCard
                icon={XCircle}
                value={displayStats.failed_runs}
                label="Failed Runs"
                trend="down"
                trendValue="need attention"
                className="[&_svg]:text-destructive [&_.text-3xl]:text-destructive"
              />
            </div>
          )}
        </div>

        {/* Feature #871: Pass Rate Trend Chart (30 days) */}
        <div className="space-y-4">
          <SectionHeader
            title="Pass Rate Trends"
            description="Daily pass rate over the last 30 days"
          />
          <div className="rounded-xl border border-border bg-card p-6">
            {trendsLoading ? (
              <div className="h-48 bg-muted/50 rounded-lg animate-pulse" />
            ) : trendPoints.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <TrendingUp className="h-10 w-10 mb-2 opacity-40" />
                <p className="text-sm">No trend data available yet</p>
                <p className="text-xs mt-1">Run some tests to start seeing trends</p>
              </div>
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

        {/* Feature #871: Needs Attention Section */}
        <div className="space-y-4">
          <SectionHeader
            title="Needs Attention"
            description={needsAttention ? 'Issues requiring your review' : 'Everything looks good!'}
          />

          {!needsAttention ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <CheckCircle2 className="h-12 w-12 mx-auto text-success mb-3" />
              <p className="text-foreground font-medium">All clear!</p>
              <p className="text-sm text-muted-foreground mt-1">No recent failures or flaky tests detected.</p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Recent Failures */}
              <div className="rounded-xl border border-border bg-card">
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
                    <div className="p-6 text-center text-sm text-muted-foreground">
                      <CheckCircle2 className="h-8 w-8 mx-auto text-success mb-2 opacity-60" />
                      No recent failures
                    </div>
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
                              {formatTimeAgo(run.created_at)}
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

              {/* Flaky Tests */}
              <div className="rounded-xl border border-border bg-card">
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
                    <div className="p-6 text-center text-sm text-muted-foreground">
                      <CheckCircle2 className="h-8 w-8 mx-auto text-success mb-2 opacity-60" />
                      No flaky tests detected
                    </div>
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

        {/* Feature #1510: Quick Access Hub Cards - Feature #336: Updated styling */}
        <div className="space-y-4">
          <SectionHeader title="Quick Access" description="Navigate to key features" />
          <div className="grid gap-6 md:grid-cols-2">
            {/* Feature #456: Updated to match current AI features (removed deleted pages) */}
            {/* AI Insights Card */}
            <Link
              to="/ai-insights"
              className="group relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-accent/10 via-card to-card p-6 transition-all hover:border-accent/50 hover:shadow-lg hover:shadow-accent/10"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="relative">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent/20 text-accent">
                    <Lightbulb className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-foreground group-hover:text-accent transition-colors">
                      AI Insights
                    </h4>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                      <Zap className="h-3 w-3" />
                      AI-Powered
                    </span>
                  </div>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  Analyze flaky tests, improve test quality, generate documentation, and track release notes.
                </p>
                <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Zap className="h-4 w-4" />
                    Flaky Tests
                  </span>
                  <span className="flex items-center gap-1">
                    <FileText className="h-4 w-4" />
                    Documentation
                  </span>
                  <span className="flex items-center gap-1">
                    <ClipboardList className="h-4 w-4" />
                    Release Notes
                  </span>
                </div>
                <div className="mt-4 flex items-center text-sm font-medium text-accent group-hover:translate-x-1 transition-transform">
                  Explore Insights
                  <ChevronRight className="ml-1 h-4 w-4" />
                </div>
              </div>
            </Link>

            {/* MCP Hub Card */}
            <Link
              to="/mcp"
              className="group relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-6 transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-blue-500/10"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="relative">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/20 text-primary">
                    <Settings2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                      MCP Hub
                    </h4>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      <Code className="h-3 w-3" />
                      170+ Tools
                    </span>
                  </div>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  Access 170+ Model Context Protocol tools for AI agent integration, interactive playground, and analytics.
                </p>
                <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Terminal className="h-4 w-4" />
                    Playground
                  </span>
                  <span className="flex items-center gap-1">
                    <BarChart3 className="h-4 w-4" />
                    Analytics
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageCircle className="h-4 w-4" />
                    AI Chat
                  </span>
                </div>
                <div className="mt-4 flex items-center text-sm font-medium text-primary group-hover:translate-x-1 transition-transform">
                  Explore MCP Tools
                  <ChevronRight className="ml-1 h-4 w-4" />
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}

// Feature #871: Helper to format relative time
function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
