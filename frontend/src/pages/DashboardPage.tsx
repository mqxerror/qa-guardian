import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Layout } from '../components/Layout';
// Feature #70: Import React Query hooks for dashboard caching
import { useDashboardStats } from '../hooks/api/useDashboard';
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
  Sparkles,
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
} from 'lucide-react';

export function DashboardPage() {
  const { user } = useAuthStore();

  // Feature #70: Use React Query for caching - dashboard loads instantly on revisit
  const { data: stats, isLoading } = useDashboardStats();

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

  // Calculate trend based on pass rate
  const passRateTrend = displayStats.pass_rate >= 80 ? 'up' as const :
    displayStats.pass_rate >= 50 ? 'neutral' as const : 'down' as const;

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
              // Note: Vulnerability and flaky test data would come from additional API calls
              // For now, we focus on the core pass rate metrics
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
