// Feature #515: Analytics components barrel export
// Extracted from AnalyticsPage.tsx to reduce file size

export * from './types';
export { PassRateTrendsChart } from './PassRateTrendsChart';
export { DurationTrendsChart } from './DurationTrendsChart';
export { AccessibilityTrendsChart } from './AccessibilityTrendsChart';
export { FailingTestsTable } from './FailingTestsTable';
export { BrowserStatsCards, getBrowserDisplayName, getBrowserIcon } from './BrowserStatsCards';
export { ProjectComparisonTable } from './ProjectComparisonTable';
export { BranchComparisonTable } from './BranchComparisonTable';
export { AIUsageCards } from './AIUsageCards';
export { FlakyTestsCards } from './FlakyTestsCards';
export { FailureClustersSection } from './FailureClustersSection';
