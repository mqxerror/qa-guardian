/**
 * QA Guardian MCP Insights Utilities
 *
 * Feature #1356: Extracted from server.ts to reduce file size.
 * Contains pure utility functions for generating insights from test data.
 */

/**
 * Input for visual trend insights generation
 */
export interface VisualTrendInput {
  totalTests: number;
  passedTests: number;
  testsWithDiffs: number;
  frequentDiffTests: Array<{ test_name: string; diff_rate: number }>;
}

/**
 * Feature #970: Generate insights from visual trend data
 *
 * Analyzes visual test results and generates human-readable insights about:
 * - Overall visual stability (pass rate)
 * - Diff frequency (how often visual differences occur)
 * - Specific problematic tests
 */
export function generateVisualTrendInsights(input: VisualTrendInput): string[] {
  const { totalTests, passedTests, testsWithDiffs, frequentDiffTests } = input;
  const insights: string[] = [];

  if (totalTests === 0) {
    insights.push('No visual tests have been run in this period. Consider adding visual regression tests to your test suite.');
    return insights;
  }

  const passRate = Math.round((passedTests / totalTests) * 100);
  const diffRate = Math.round((testsWithDiffs / totalTests) * 100);

  // Pass rate insights
  if (passRate >= 95) {
    insights.push(`Excellent visual stability! ${passRate}% of visual tests pass consistently.`);
  } else if (passRate >= 80) {
    insights.push(`Good visual stability with ${passRate}% pass rate. Some visual changes are occurring.`);
  } else if (passRate >= 60) {
    insights.push(`Moderate visual stability (${passRate}% pass rate). Consider reviewing failing tests.`);
  } else {
    insights.push(`Low visual stability (${passRate}% pass rate). Many visual changes detected that need attention.`);
  }

  // Diff frequency insights
  if (diffRate > 50) {
    insights.push(`High diff frequency (${diffRate}% of tests show differences). This may indicate rapidly changing UI or environment inconsistencies.`);
  } else if (diffRate > 20) {
    insights.push(`${diffRate}% of tests show visual differences. Review pending approvals regularly.`);
  }

  // Specific test insights
  if (frequentDiffTests.length > 0) {
    const worstTest = frequentDiffTests[0];
    if (worstTest.diff_rate > 50) {
      insights.push(`Test "${worstTest.test_name}" has ${worstTest.diff_rate}% diff rate. Consider adding ignore regions or adjusting thresholds.`);
    }
  }

  return insights;
}

/**
 * Calculate pass rate from total and passed counts
 */
export function calculatePassRate(total: number, passed: number): number {
  if (total === 0) return 0;
  return Math.round((passed / total) * 100);
}

/**
 * Get pass rate status category
 */
export function getPassRateStatus(passRate: number): 'excellent' | 'good' | 'moderate' | 'low' {
  if (passRate >= 95) return 'excellent';
  if (passRate >= 80) return 'good';
  if (passRate >= 60) return 'moderate';
  return 'low';
}

/**
 * Generate a summary message for pass rate
 */
export function getPassRateSummary(passRate: number): string {
  const status = getPassRateStatus(passRate);
  switch (status) {
    case 'excellent':
      return `Excellent visual stability! ${passRate}% of visual tests pass consistently.`;
    case 'good':
      return `Good visual stability with ${passRate}% pass rate. Some visual changes are occurring.`;
    case 'moderate':
      return `Moderate visual stability (${passRate}% pass rate). Consider reviewing failing tests.`;
    case 'low':
      return `Low visual stability (${passRate}% pass rate). Many visual changes detected that need attention.`;
  }
}
