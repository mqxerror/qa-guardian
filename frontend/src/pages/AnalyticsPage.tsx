// Feature #515: AnalyticsPage refactored - extracted components to frontend/src/components/analytics/
// Original file was 2,257 lines - now under 800 lines
// Feature #1441: AnalyticsPage extracted from App.tsx (~5,650 lines)
// Feature #72: Migrated to React Query for caching
// Feature #336: Dark-first design system redesign

import { useState } from 'react';
import { Layout } from '../components/Layout';
import { useAuthStore } from '../stores/authStore';
import { toast } from '../stores/toastStore';
import { PageHeader } from '../components/ui';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { EmptyStates } from '../components/ui/EmptyState';

// Feature #72: Import React Query hooks for caching
import {
  useFailingTests,
  useBrowserStats,
  useProjectComparison,
  useFlakyTests,
  usePassRateTrends,
  useAccessibilityTrends,
  useDurationTrends,
  useBranchComparison,
  useAIUsage,
} from '../hooks/api/useAnalytics';

// Feature #515: Import extracted components
import {
  PassRateTrendsChart,
  DurationTrendsChart,
  AccessibilityTrendsChart,
  FailingTestsTable,
  BrowserStatsCards,
  ProjectComparisonTable,
  BranchComparisonTable,
  AIUsageCards,
  FlakyTestsCards,
  FailureClustersSection,
  getBrowserDisplayName,
  // Types
  type FailingTest,
  type BrowserStats,
  type ProjectComparisonStats,
  type TrendDataPoint,
  type TrendSummary,
  type AccessibilityTrendDataPoint,
  type AccessibilityTrendSummary,
  type FlakyTest,
  type DurationTrendDataPoint,
  type DurationTrendSummary,
  type DurationRegression,
  type DurationFilters,
  type BranchComparisonData,
  type AIUsageData,
} from '../components/analytics';

export function AnalyticsPage() {
  const { token } = useAuthStore();

  // Pass rate trends state
  const [trendDays, setTrendDays] = useState<7 | 30>(7);
  // Accessibility trends state
  const [a11yTrendDays, setA11yTrendDays] = useState<7 | 30>(7);
  // Feature #470: Duration trends state
  const [durationTrendDays, setDurationTrendDays] = useState<7 | 30>(7);
  const [durationBrowserFilter, setDurationBrowserFilter] = useState<string | undefined>(undefined);
  const [durationTestTypeFilter, setDurationTestTypeFilter] = useState<string | undefined>(undefined);
  // Feature #476: Branch comparison state
  const [branchA, setBranchA] = useState<string | undefined>(undefined);
  const [branchB, setBranchB] = useState<string | undefined>(undefined);

  // Feature #72: React Query hooks for caching
  const { data: failingTestsData, isLoading } = useFailingTests();
  const { data: browserStatsData, isLoading: isBrowserStatsLoading } = useBrowserStats();
  const { data: projectStatsData, isLoading: isProjectStatsLoading } = useProjectComparison();
  const { data: flakyTestsData, isLoading: isFlakyTestsLoading } = useFlakyTests();
  const { data: trendsData, isLoading: isTrendsLoading } = usePassRateTrends(trendDays);
  const { data: a11yTrendsData, isLoading: isA11yTrendsLoading } = useAccessibilityTrends(a11yTrendDays);
  const { data: durationTrendsData, isLoading: isDurationTrendsLoading } = useDurationTrends(
    durationTrendDays,
    durationBrowserFilter,
    durationTestTypeFilter
  );
  const { data: branchComparisonData, isLoading: isBranchComparisonLoading } = useBranchComparison(branchA, branchB);
  const { data: aiUsageData, isLoading: isAIUsageLoading } = useAIUsage('day');

  // Derive data from React Query responses
  const failingTests = (failingTestsData?.failing_tests || []) as FailingTest[];
  const browserStats = (browserStatsData?.browser_stats || []) as BrowserStats[];
  const projectStats = (projectStatsData?.projects || []) as ProjectComparisonStats[];
  const flakyTests = (flakyTestsData?.flaky_tests || []) as FlakyTest[];
  const trendData = (trendsData?.trends || []) as TrendDataPoint[];
  const trendSummary = (trendsData?.summary || null) as TrendSummary | null;
  const a11yTrendData = (a11yTrendsData?.trends || []) as AccessibilityTrendDataPoint[];
  const a11yTrendSummary = (a11yTrendsData?.summary || null) as AccessibilityTrendSummary | null;

  // Feature #470: Duration trends data
  const durationTrendData = (durationTrendsData?.trends || []) as DurationTrendDataPoint[];
  const durationTrendSummary = (durationTrendsData?.summary || null) as DurationTrendSummary | null;
  const durationRegression = (durationTrendsData?.regression || null) as DurationRegression | null;
  const durationFilters = (durationTrendsData?.filters || null) as DurationFilters | null;

  // Check if all data has loaded and there is no analytics data to display
  const isAllLoading = isLoading || isBrowserStatsLoading || isProjectStatsLoading ||
    isFlakyTestsLoading || isTrendsLoading || isA11yTrendsLoading ||
    isDurationTrendsLoading || isBranchComparisonLoading || isAIUsageLoading;

  const hasNoData = !isAllLoading &&
    failingTests.length === 0 &&
    browserStats.length === 0 &&
    projectStats.length === 0 &&
    flakyTests.length === 0 &&
    trendData.length === 0 &&
    a11yTrendData.length === 0 &&
    durationTrendData.length === 0 &&
    !branchComparisonData &&
    !aiUsageData;

  // Export analytics data to CSV
  const handleExportCSV = () => {
    const csvSections: string[] = [];

    // Summary section
    if (trendSummary) {
      csvSections.push('=== ANALYTICS SUMMARY ===');
      csvSections.push('Metric,Value');
      csvSections.push(`Overall Pass Rate,${trendSummary.overall_pass_rate ?? 'N/A'}%`);
      csvSections.push(`Total Runs,${trendSummary.total_runs}`);
      csvSections.push(`Total Passed,${trendSummary.total_passed}`);
      csvSections.push(`Total Failed,${trendSummary.total_failed}`);
      csvSections.push(`Date Range,${trendSummary.start_date} to ${trendSummary.end_date}`);
      csvSections.push('');
    }

    // Pass Rate Trends section
    if (trendData.length > 0) {
      csvSections.push('=== PASS RATE TRENDS ===');
      csvSections.push('Date,Pass Rate,Total Runs,Passed,Failed');
      trendData.forEach(day => {
        csvSections.push(`${day.date},${day.pass_rate ?? 'N/A'}%,${day.total_runs},${day.passed},${day.failed}`);
      });
      csvSections.push('');
    }

    // Most Failing Tests section
    if (failingTests.length > 0) {
      csvSections.push('=== MOST FAILING TESTS ===');
      csvSections.push('Test Name,Suite,Project,Failures,Total Runs,Failure Rate,Last Failure');
      failingTests.forEach(test => {
        const lastFailure = test.last_failure ? new Date(test.last_failure).toISOString() : '';
        csvSections.push(`"${test.test_name}","${test.suite_name}","${test.project_name}",${test.failure_count},${test.total_runs},${test.failure_percentage}%,${lastFailure}`);
      });
      csvSections.push('');
    }

    // Browser Stats section
    if (browserStats.length > 0) {
      csvSections.push('=== BROWSER STATISTICS ===');
      csvSections.push('Browser,Total Runs,Passed,Failed,Error,Pass Rate');
      browserStats.forEach(stat => {
        csvSections.push(`${getBrowserDisplayName(stat.browser)},${stat.total_runs},${stat.passed},${stat.failed},${stat.error},${stat.pass_rate}%`);
      });
      csvSections.push('');
    }

    // Project Comparison section
    if (projectStats.length > 0) {
      csvSections.push('=== PROJECT COMPARISON ===');
      csvSections.push('Project,Slug,Suites,Tests,Total Runs,Pass Rate,Passed,Failed');
      projectStats.forEach(project => {
        csvSections.push(`"${project.project_name}",${project.project_slug},${project.suite_count},${project.test_count},${project.total_runs},${project.pass_rate}%,${project.passed_runs},${project.failed_runs}`);
      });
    }

    const csvContent = csvSections.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analytics-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('Analytics exported to CSV');
  };

  return (
    <Layout>
      <div className="p-6 lg:p-8 space-y-8">
        {/* Feature #336: PageHeader with action button */}
        <PageHeader
          title="Analytics"
          description="View test analytics and insights for your organization."
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Analytics' }]}
          actions={
            <Button
              onClick={handleExportCSV}
              disabled={isLoading || isTrendsLoading || isBrowserStatsLoading || isProjectStatsLoading}
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          }
        />

        {/* Empty state when no analytics data is available */}
        {hasNoData ? (
          EmptyStates.noAnalytics()
        ) : (
          <>
            {/* Pass Rate Trends Section */}
            <PassRateTrendsChart
              trendData={trendData}
              trendSummary={trendSummary}
              trendDays={trendDays}
              setTrendDays={setTrendDays}
              isLoading={isTrendsLoading}
            />

            {/* Feature #470: Duration Trends Section */}
            <DurationTrendsChart
              durationTrendData={durationTrendData}
              durationTrendSummary={durationTrendSummary}
              durationRegression={durationRegression}
              durationFilters={durationFilters}
              durationTrendDays={durationTrendDays}
              setDurationTrendDays={setDurationTrendDays}
              durationBrowserFilter={durationBrowserFilter}
              setDurationBrowserFilter={setDurationBrowserFilter}
              durationTestTypeFilter={durationTestTypeFilter}
              setDurationTestTypeFilter={setDurationTestTypeFilter}
              isLoading={isDurationTrendsLoading}
            />

            {/* Accessibility Trends Section */}
            <AccessibilityTrendsChart
              a11yTrendData={a11yTrendData}
              a11yTrendSummary={a11yTrendSummary}
              a11yTrendDays={a11yTrendDays}
              setA11yTrendDays={setA11yTrendDays}
              isLoading={isA11yTrendsLoading}
            />

            {/* Most Failing Tests Section */}
            <FailingTestsTable
              failingTests={failingTests}
              isLoading={isLoading}
            />

            {/* Browser-Specific Pass Rates Section */}
            <BrowserStatsCards
              browserStats={browserStats}
              isLoading={isBrowserStatsLoading}
            />

            {/* Project Comparison Section */}
            <ProjectComparisonTable
              projectStats={projectStats}
              isLoading={isProjectStatsLoading}
            />

            {/* Feature #476: Branch Comparison Section */}
            <BranchComparisonTable
              branchComparisonData={branchComparisonData as BranchComparisonData | undefined}
              branchA={branchA}
              setBranchA={setBranchA}
              branchB={branchB}
              setBranchB={setBranchB}
              isLoading={isBranchComparisonLoading}
            />

            {/* Feature #477: AI Usage Section */}
            <AIUsageCards
              aiUsageData={aiUsageData as AIUsageData | undefined}
              isLoading={isAIUsageLoading}
            />

            {/* Flaky Tests Section */}
            <FlakyTestsCards
              flakyTests={flakyTests}
              isLoading={isFlakyTestsLoading}
            />

            {/* Feature #1075: AI Failure Clusters Section */}
            <FailureClustersSection token={token} />
          </>
        )}
      </div>
    </Layout>
  );
}
