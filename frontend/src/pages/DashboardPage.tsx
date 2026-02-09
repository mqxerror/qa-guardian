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
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-foreground group-hover:text-accent transition-colors">
                      AI Insights
                    </h4>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                      </svg>
                      AI-Powered
                    </span>
                  </div>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  Analyze flaky tests, improve test quality, generate documentation, and track release notes.
                </p>
                <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Flaky Tests
                  </span>
                  <span className="flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Documentation
                  </span>
                  <span className="flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Release Notes
                  </span>
                </div>
                <div className="mt-4 flex items-center text-sm font-medium text-accent group-hover:translate-x-1 transition-transform">
                  Explore Insights
                  <svg xmlns="http://www.w3.org/2000/svg" className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
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
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                      MCP Hub
                    </h4>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      170+ Tools
                    </span>
                  </div>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  Access 170+ Model Context Protocol tools for AI agent integration, interactive playground, and analytics.
                </p>
                <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Playground
                  </span>
                  <span className="flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Analytics
                  </span>
                  <span className="flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    AI Chat
                  </span>
                </div>
                <div className="mt-4 flex items-center text-sm font-medium text-primary group-hover:translate-x-1 transition-transform">
                  Explore MCP Tools
                  <svg xmlns="http://www.w3.org/2000/svg" className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}
