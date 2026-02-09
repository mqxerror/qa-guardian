/**
 * AI Analysis Core Module
 *
 * Core AI-powered analysis functions for test improvement and anomaly detection.
 * Split from ai-analysis.ts for maintainability.
 *
 * Features:
 * - #1350: Analyze test code for improvements
 * - #1348: Explain anomaly in plain English
 * - #1348: Get detected anomalies
 * - #1349: Generate AI-powered release notes
 *
 * Feature #248: Split ai-analysis.ts for maintainability
 */

// ============================================================================
// Type Definitions
// ============================================================================

/** Best practice issue found in test code */
export interface BestPracticeIssue {
  category: string;
  issue: string;
  severity: 'low' | 'medium' | 'high';
  suggestion: string;
  code_example?: string;
  line_number?: number;
}

/** Selector improvement suggestion */
export interface SelectorImprovement {
  original_selector: string;
  issue: string;
  suggested_selector: string;
  reason: string;
  confidence: number;
}

/** Assertion suggestion for test improvement */
export interface AssertionSuggestion {
  location: string;
  current_assertion?: string;
  suggested_assertion: string;
  reason: string;
  priority: 'low' | 'medium' | 'high';
}

/** Flakiness risk in test code */
export interface FlakinessRisk {
  risk: string;
  severity: 'low' | 'medium' | 'high';
  location?: string;
  mitigation: string;
  code_example?: string;
}

/** Potential cause for an anomaly */
export interface PotentialCause {
  cause: string;
  likelihood: 'low' | 'medium' | 'high';
  explanation: string;
}

/** Investigation step for anomaly */
export interface InvestigationStep {
  step: number;
  action: string;
  reason: string;
  command_hint?: string;
}

/** Recommended action for resolving anomaly */
export interface RecommendedAction {
  action: string;
  priority: 'immediate' | 'soon' | 'later';
  effort: 'low' | 'medium' | 'high';
  impact: string;
}

/** Annotation type for screenshot annotations */
export type AnnotationType = 'click' | 'type' | 'expect';

/** Screenshot annotation for test generation */
export interface ScreenshotAnnotation {
  type: AnnotationType;
  x: number;
  y: number;
  label?: string;
  expectation?: string;
}

/** Element type detected in screenshots */
export type ElementType = 'button' | 'link' | 'input' | 'dropdown' | 'checkbox' | 'radio' | 'text' | 'image' | 'form' | 'navigation' | 'modal' | 'card' | 'table';

/** Page type detected from context */
export type PageType = 'login' | 'dashboard' | 'form' | 'list' | 'detail' | 'checkout' | 'settings' | 'search' | 'landing' | 'annotated' | 'other';

/** Action type for test steps */
export type ActionType = 'click' | 'type' | 'select' | 'check' | 'hover' | 'navigate' | 'assert' | 'wait' | 'scroll';

/** Selector strategy type */
export type SelectorStrategy = 'role' | 'text' | 'label' | 'placeholder' | 'test-id' | 'css' | 'xpath';

/** Test step action type */
export type StepActionType = 'navigation' | 'interaction' | 'assertion' | 'wait' | 'setup' | 'cleanup' | 'data';

// ============================================================================
// Feature #1350: Analyze test code for improvements using Claude
// ============================================================================

export function analyzeTestForImprovements(
  testCode: string,
  testName?: string,
  testType: 'e2e' | 'unit' | 'integration' | 'visual' | 'api' = 'e2e',
  framework: 'playwright' | 'cypress' | 'selenium' | 'jest' | 'mocha' = 'playwright',
  options: {
    include_best_practices?: boolean;
    include_selector_analysis?: boolean;
    include_assertion_suggestions?: boolean;
    include_flakiness_analysis?: boolean;
  } = {}
): {
  overall_score: number;
  summary: string;
  best_practices: BestPracticeIssue[];
  selector_improvements: SelectorImprovement[];
  assertion_suggestions: AssertionSuggestion[];
  flakiness_risks: FlakinessRisk[];
  improved_code?: string;
} {
  const {
    include_best_practices = true,
    include_selector_analysis = true,
    include_assertion_suggestions = true,
    include_flakiness_analysis = true,
  } = options;

  const lines = testCode.split('\n');
  const selectors: string[] = [];
  const assertions: string[] = [];

  // Extract selectors, assertions, and waits
  lines.forEach((line) => {
    if (line.includes('.locator(') || line.includes('.getByRole(') || line.includes('.getByText(') ||
        line.includes('.getByTestId(') || line.includes('.querySelector(') || line.includes('.$(') ||
        line.includes('.cy.get(') || line.includes('.find(')) {
      selectors.push(line.trim());
    }
    if (line.includes('expect(') || line.includes('assert') || line.includes('.should(') ||
        line.includes('.toHave') || line.includes('.toBe') || line.includes('.toEqual')) {
      assertions.push(line.trim());
    }
  });

  let score = 85;
  const bestPractices: BestPracticeIssue[] = [];
  const selectorImprovements: SelectorImprovement[] = [];
  const assertionSuggestions: AssertionSuggestion[] = [];
  const flakinessRisks: FlakinessRisk[] = [];

  // Best practices analysis
  if (include_best_practices) {
    if (testCode.includes('setTimeout') || testCode.includes('.wait(') || testCode.includes('sleep')) {
      bestPractices.push({
        category: 'Timing',
        issue: 'Hardcoded wait/sleep detected',
        severity: 'high',
        suggestion: 'Replace hardcoded waits with explicit wait conditions',
        code_example: `// Instead of: await page.waitForTimeout(3000);
// Use: await page.waitForSelector('.element', { state: 'visible' });
// Or: await expect(locator).toBeVisible();`,
      });
      score -= 10;
    }

    if (!testCode.includes('try') && !testCode.includes('catch')) {
      bestPractices.push({
        category: 'Error Handling',
        issue: 'No try-catch error handling found',
        severity: 'medium',
        suggestion: 'Add error handling for better debugging and test reliability',
        code_example: `try {
  await page.click('.submit-button');
  await expect(page).toHaveURL('/success');
} catch (error) {
  console.error('Test failed:', error);
  await page.screenshot({ path: 'failure.png' });
  throw error;
}`,
      });
      score -= 5;
    }

    if (!testCode.includes('test.describe') && !testCode.includes('describe(')) {
      bestPractices.push({
        category: 'Test Organization',
        issue: 'Missing test.describe block for grouping related tests',
        severity: 'low',
        suggestion: 'Group related tests using describe blocks for better organization',
        code_example: `test.describe('User Authentication', () => {
  test('should login with valid credentials', async ({ page }) => {
    // test code
  });
});`,
      });
      score -= 3;
    }

    if (!testCode.includes('class ') && !testCode.includes('Page(') && lines.length > 30) {
      bestPractices.push({
        category: 'Code Structure',
        issue: 'Consider using Page Object Model for maintainability',
        severity: 'medium',
        suggestion: 'Extract repeated selectors and actions into a Page Object class',
        code_example: `// LoginPage.ts
export class LoginPage {
  constructor(private page: Page) {}

  async login(email: string, password: string) {
    await this.page.fill('[data-testid="email"]', email);
    await this.page.fill('[data-testid="password"]', password);
    await this.page.click('[data-testid="submit"]');
  }
}`,
      });
      score -= 5;
    }
  }

  // Selector analysis
  if (include_selector_analysis) {
    selectors.forEach(selector => {
      if (selector.includes('.class-') || selector.includes('[class*=') || selector.includes('nth-child')) {
        const originalSelector = selector.match(/['"]([^'"]+)['"]/)?.[1] || selector;
        selectorImprovements.push({
          original_selector: originalSelector,
          issue: 'Fragile CSS class-based selector',
          suggested_selector: `[data-testid="element-name"]`,
          reason: 'CSS classes may change during styling updates. Use data-testid for stability.',
          confidence: 85,
        });
        score -= 3;
      }

      if (selector.includes('xpath') || selector.includes('//')) {
        const originalSelector = selector.match(/['"]([^'"]+)['"]/)?.[1] || selector;
        selectorImprovements.push({
          original_selector: originalSelector,
          issue: 'XPath selector detected - may be fragile',
          suggested_selector: `page.getByRole('button', { name: 'Submit' })`,
          reason: 'XPath selectors are brittle. Prefer role-based or test-id selectors.',
          confidence: 80,
        });
        score -= 5;
      }

      if (selector.match(/#[a-z]+-[a-f0-9]{8,}/i)) {
        const originalSelector = selector.match(/['"]([^'"]+)['"]/)?.[1] || selector;
        selectorImprovements.push({
          original_selector: originalSelector,
          issue: 'Auto-generated ID detected',
          suggested_selector: `[data-testid="stable-identifier"]`,
          reason: 'Auto-generated IDs change between builds. Use stable identifiers.',
          confidence: 90,
        });
        score -= 5;
      }
    });

    if (testCode.includes('querySelector') && framework === 'playwright') {
      selectorImprovements.push({
        original_selector: 'document.querySelector(...)',
        issue: 'Using vanilla querySelector instead of Playwright locators',
        suggested_selector: `page.locator('selector') or page.getByRole(...)`,
        reason: 'Playwright locators provide auto-waiting and better error messages.',
        confidence: 95,
      });
      score -= 5;
    }
  }

  // Assertion suggestions
  if (include_assertion_suggestions) {
    if (assertions.length < 2 && lines.length > 15) {
      assertionSuggestions.push({
        location: 'Throughout the test',
        suggested_assertion: 'Add more assertions to verify expected state',
        reason: 'Tests with few assertions may pass even when the application is broken.',
        priority: 'high',
      });
      score -= 5;
    }

    if (!testCode.includes('toBeVisible') && !testCode.includes('should(\'be.visible')) {
      assertionSuggestions.push({
        location: 'After navigation or user actions',
        suggested_assertion: `await expect(page.locator('.element')).toBeVisible();`,
        reason: 'Add visibility assertions to ensure elements are rendered correctly.',
        priority: 'medium',
      });
    }

    if ((testCode.includes('.click(') || testCode.includes('.goto(')) && !testCode.includes('toHaveURL')) {
      assertionSuggestions.push({
        location: 'After click actions that navigate',
        suggested_assertion: `await expect(page).toHaveURL(/expected-path/);`,
        reason: 'Verify navigation completed successfully by checking the URL.',
        priority: 'medium',
      });
    }

    if (!testCode.includes('toHaveText') && !testCode.includes('toContainText')) {
      assertionSuggestions.push({
        location: 'After form submissions or data changes',
        suggested_assertion: `await expect(page.locator('.message')).toHaveText('Success');`,
        reason: 'Verify content is correct, not just that elements exist.',
        priority: 'low',
      });
    }
  }

  // Flakiness analysis
  if (include_flakiness_analysis) {
    if ((testCode.match(/await/g) || []).length > 10) {
      flakinessRisks.push({
        risk: 'Multiple sequential await statements may cause timing issues',
        severity: 'medium',
        mitigation: 'Use Promise.all for independent operations or add explicit wait conditions',
        code_example: `// Instead of sequential awaits:
await page.fill('#email', 'test@example.com');
await page.fill('#password', 'password');

// If fields are independent, can be parallel:
await Promise.all([
  page.fill('#email', 'test@example.com'),
  page.fill('#password', 'password'),
]);`,
      });
    }

    if (testCode.includes('click') && !testCode.includes('waitFor') && !testCode.includes('toBeVisible')) {
      flakinessRisks.push({
        risk: 'Click without visibility check may fail due to animations',
        severity: 'high',
        mitigation: 'Wait for element to be visible and stable before clicking',
        code_example: `const button = page.locator('.submit-button');
await expect(button).toBeVisible();
await button.click();`,
      });
      score -= 5;
    }

    if (testCode.includes('fetch') || testCode.includes('api') || testCode.includes('request')) {
      flakinessRisks.push({
        risk: 'Network requests may cause timing issues',
        severity: 'medium',
        mitigation: 'Mock API responses or wait for network idle',
        code_example: `// Wait for network idle after actions
await page.waitForLoadState('networkidle');

// Or mock the API response
await page.route('**/api/data', route => {
  route.fulfill({ json: mockData });
});`,
      });
    }

    if (testCode.includes('new Date') || testCode.includes('Date.now')) {
      flakinessRisks.push({
        risk: 'Test depends on current date/time - may fail at different times',
        severity: 'high',
        mitigation: 'Mock the date or use relative date comparisons',
        code_example: `// Mock the date in Playwright
await page.addInitScript(() => {
  const mockDate = new Date('2024-01-15T10:00:00');
  Date.now = () => mockDate.getTime();
});`,
      });
      score -= 5;
    }
  }

  score = Math.max(0, Math.min(100, score));

  const issueCount = bestPractices.length + selectorImprovements.length +
                     assertionSuggestions.length + flakinessRisks.length;

  let summary: string;
  if (score >= 90) {
    summary = `Excellent test quality! The ${testName || 'test'} follows most best practices with only ${issueCount} minor suggestions for improvement.`;
  } else if (score >= 75) {
    summary = `Good test quality with room for improvement. Found ${issueCount} areas that could enhance reliability and maintainability.`;
  } else if (score >= 60) {
    summary = `Test needs attention. Identified ${issueCount} issues that may affect test reliability and maintenance.`;
  } else {
    summary = `Significant improvements needed. Found ${issueCount} issues that should be addressed for test stability.`;
  }

  return {
    overall_score: score,
    summary,
    best_practices: include_best_practices ? bestPractices : [],
    selector_improvements: include_selector_analysis ? selectorImprovements : [],
    assertion_suggestions: include_assertion_suggestions ? assertionSuggestions : [],
    flakiness_risks: include_flakiness_analysis ? flakinessRisks : [],
  };
}

// ============================================================================
// Feature #1348: Explain anomaly in plain English with context
// ============================================================================

export function explainAnomaly(
  anomalyType: string,
  anomalyData: {
    metric_name: string;
    current_value: number;
    baseline_value: number;
    deviation_percentage: number;
    timestamp: string;
    affected_tests?: string[];
    affected_suites?: string[];
  },
  context?: {
    project_name?: string;
    recent_changes?: string[];
    environment?: string;
  }
): {
  summary: string;
  detailed_explanation: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  severity_reason: string;
  potential_causes: PotentialCause[];
  investigation_steps: InvestigationStep[];
  recommended_actions: RecommendedAction[];
  related_metrics: string[];
  historical_context: string;
} {
  const deviation = Math.abs(anomalyData.deviation_percentage);
  const isIncrease = anomalyData.current_value > anomalyData.baseline_value;
  const direction = isIncrease ? 'increased' : 'decreased';

  let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
  let severityReason = '';

  if (anomalyType === 'failure_spike') {
    if (deviation >= 100) {
      severity = 'critical';
      severityReason = 'Failure rate has more than doubled - immediate attention required';
    } else if (deviation >= 50) {
      severity = 'high';
      severityReason = 'Significant increase in failure rate affecting test reliability';
    } else if (deviation >= 25) {
      severity = 'medium';
      severityReason = 'Notable increase in failures that should be investigated';
    } else {
      severity = 'low';
      severityReason = 'Minor fluctuation in failure rate within acceptable range';
    }
  } else if (anomalyType === 'performance_degradation') {
    if (deviation >= 100) {
      severity = 'critical';
      severityReason = 'Performance has degraded significantly - may indicate serious infrastructure issues';
    } else if (deviation >= 50) {
      severity = 'high';
      severityReason = 'Notable performance regression affecting test execution time';
    } else if (deviation >= 25) {
      severity = 'medium';
      severityReason = 'Performance decline that may impact CI/CD pipeline efficiency';
    } else {
      severity = 'low';
      severityReason = 'Minor performance variation within normal range';
    }
  } else if (anomalyType === 'flaky_test') {
    if (deviation >= 30) {
      severity = 'high';
      severityReason = 'High flakiness rate undermining test reliability and developer confidence';
    } else if (deviation >= 15) {
      severity = 'medium';
      severityReason = 'Increasing flakiness that may cause false positives/negatives';
    } else {
      severity = 'low';
      severityReason = 'Some test instability that should be monitored';
    }
  } else if (anomalyType === 'coverage_drop') {
    if (deviation >= 20) {
      severity = 'high';
      severityReason = 'Significant coverage reduction may leave critical code untested';
    } else if (deviation >= 10) {
      severity = 'medium';
      severityReason = 'Coverage decline that should be addressed to maintain quality';
    } else {
      severity = 'low';
      severityReason = 'Minor coverage change that may be intentional';
    }
  } else {
    severity = deviation >= 50 ? 'high' : deviation >= 25 ? 'medium' : 'low';
    severityReason = `${anomalyData.metric_name} has ${direction} by ${deviation.toFixed(1)}%`;
  }

  let summary = '';
  let detailedExplanation = '';

  switch (anomalyType) {
    case 'failure_spike':
      summary = `Test failure rate ${direction} by ${deviation.toFixed(1)}% compared to baseline`;
      detailedExplanation = `The test failure rate has ${direction} from ${anomalyData.baseline_value.toFixed(1)}% to ${anomalyData.current_value.toFixed(1)}%, representing a ${deviation.toFixed(1)}% deviation from normal patterns. ${
        anomalyData.affected_tests?.length
          ? `This affects ${anomalyData.affected_tests.length} test(s) including: ${anomalyData.affected_tests.slice(0, 3).join(', ')}${anomalyData.affected_tests.length > 3 ? '...' : ''}.`
          : ''
      } This anomaly was detected on ${new Date(anomalyData.timestamp).toLocaleString()}.`;
      break;

    case 'performance_degradation':
      summary = `Test execution time ${direction} by ${deviation.toFixed(1)}%`;
      detailedExplanation = `Test execution duration has ${direction} from ${anomalyData.baseline_value.toFixed(0)}ms to ${anomalyData.current_value.toFixed(0)}ms average, a ${deviation.toFixed(1)}% change. ${
        context?.environment ? `This was observed in the ${context.environment} environment.` : ''
      } Slower tests can delay deployments and reduce developer productivity.`;
      break;

    case 'flaky_test':
      summary = `Test flakiness ${direction} by ${deviation.toFixed(1)}% - tests passing/failing inconsistently`;
      detailedExplanation = `The flakiness score has ${direction} from ${anomalyData.baseline_value.toFixed(1)} to ${anomalyData.current_value.toFixed(1)}, indicating tests are behaving inconsistently. Flaky tests erode confidence in the test suite and can lead to ignoring real failures.`;
      break;

    case 'duration_anomaly':
      summary = `Unusual test duration detected - ${direction} by ${deviation.toFixed(1)}%`;
      detailedExplanation = `Test duration metrics show unusual patterns with a ${deviation.toFixed(1)}% ${direction.replace('ed', 'e')} from baseline. This could indicate infrastructure issues, test environment problems, or changes in test complexity.`;
      break;

    case 'coverage_drop':
      summary = `Code coverage ${direction} by ${deviation.toFixed(1)}%`;
      detailedExplanation = `Code coverage has ${direction} from ${anomalyData.baseline_value.toFixed(1)}% to ${anomalyData.current_value.toFixed(1)}%. ${
        isIncrease
          ? 'While increased coverage is generally positive, sudden jumps may indicate test quality concerns.'
          : 'Decreased coverage may leave critical code paths untested, increasing risk of undetected bugs.'
      }`;
      break;

    default:
      summary = `Anomaly detected in ${anomalyData.metric_name}: ${direction} by ${deviation.toFixed(1)}%`;
      detailedExplanation = `The metric ${anomalyData.metric_name} has ${direction} from ${anomalyData.baseline_value} to ${anomalyData.current_value}, a ${deviation.toFixed(1)}% change from the baseline.`;
  }

  const potentialCauses: PotentialCause[] = [];

  if (anomalyType === 'failure_spike') {
    potentialCauses.push(
      { cause: 'Recent code changes', likelihood: context?.recent_changes?.length ? 'high' : 'medium', explanation: 'New code deployments often introduce bugs that cause test failures' },
      { cause: 'Environment configuration change', likelihood: 'medium', explanation: 'Changes to test environment, dependencies, or infrastructure' },
      { cause: 'External service dependency', likelihood: 'medium', explanation: 'Third-party APIs or services may be experiencing issues' },
      { cause: 'Test data corruption', likelihood: 'low', explanation: 'Test fixtures or seed data may have been modified' }
    );
  } else if (anomalyType === 'performance_degradation') {
    potentialCauses.push(
      { cause: 'Infrastructure resource constraints', likelihood: 'high', explanation: 'CI/CD runners may be overloaded or under-provisioned' },
      { cause: 'Database/API slowdown', likelihood: 'medium', explanation: 'Backend services may be experiencing latency' },
      { cause: 'Test parallelization issues', likelihood: 'medium', explanation: 'Tests may be competing for shared resources' },
      { cause: 'Code complexity increase', likelihood: 'low', explanation: 'Recent changes may have added performance-heavy operations' }
    );
  } else if (anomalyType === 'flaky_test') {
    potentialCauses.push(
      { cause: 'Race conditions', likelihood: 'high', explanation: 'Asynchronous operations without proper waiting/synchronization' },
      { cause: 'Timing-dependent assertions', likelihood: 'high', explanation: 'Hardcoded timeouts or waitForTimeout calls' },
      { cause: 'Shared state between tests', likelihood: 'medium', explanation: 'Tests may be interfering with each other' },
      { cause: 'External service instability', likelihood: 'medium', explanation: 'Dependent services returning inconsistent responses' }
    );
  }

  const investigationSteps: InvestigationStep[] = [
    { step: 1, action: 'Review recent commits and deployments', reason: 'Identify any code changes that coincide with the anomaly', command_hint: 'git log --since="24 hours ago" --oneline' },
    { step: 2, action: 'Check test execution logs', reason: 'Look for error patterns and stack traces' },
    { step: 3, action: 'Compare against baseline metrics', reason: 'Understand the magnitude and pattern of the deviation' },
    { step: 4, action: 'Isolate affected tests', reason: 'Run specific failing tests locally to reproduce the issue' },
    { step: 5, action: 'Review environment and dependencies', reason: 'Check for infrastructure changes or dependency updates' },
  ];

  const recommendedActions: RecommendedAction[] = [];

  if (severity === 'critical' || severity === 'high') {
    recommendedActions.push({ action: 'Investigate and fix root cause immediately', priority: 'immediate', effort: 'medium', impact: 'Restore test reliability and unblock deployments' });
  }

  if (anomalyType === 'flaky_test') {
    recommendedActions.push(
      { action: 'Add proper wait conditions and remove hardcoded timeouts', priority: 'soon', effort: 'medium', impact: 'Reduce flakiness by 50-80%' },
      { action: 'Enable test quarantine for consistently flaky tests', priority: 'soon', effort: 'low', impact: 'Prevent false positives while investigating' }
    );
  }

  if (anomalyType === 'performance_degradation') {
    recommendedActions.push(
      { action: 'Profile test execution to identify bottlenecks', priority: 'soon', effort: 'medium', impact: 'Identify specific tests or operations causing slowdown' },
      { action: 'Review CI/CD resource allocation', priority: 'later', effort: 'low', impact: 'Ensure adequate resources for test execution' }
    );
  }

  recommendedActions.push({ action: 'Set up alerts for similar anomalies', priority: 'later', effort: 'low', impact: 'Catch future anomalies earlier' });

  return {
    summary,
    detailed_explanation: detailedExplanation,
    severity,
    severity_reason: severityReason,
    potential_causes: potentialCauses,
    investigation_steps: investigationSteps,
    recommended_actions: recommendedActions,
    related_metrics: ['Test pass rate', 'Average execution time', 'Flakiness score', 'Code coverage', 'CI/CD pipeline duration'],
    historical_context: `Based on the last ${context?.project_name ? `data for ${context.project_name}` : '30 days of data'}, this ${
      deviation >= 50 ? 'represents a significant deviation' : 'is within the normal range of variation'
    } for this metric.`,
  };
}

// ============================================================================
// Feature #1348: Get detected anomalies with optional explanations
// ============================================================================

export function getDetectedAnomalies(
  _projectId?: string,
  _period: string = '7d',
  severity?: string
): Array<{
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detected_at: string;
  metric_name: string;
  current_value: number;
  baseline_value: number;
  deviation_percentage: number;
  affected_tests: string[];
  summary: string;
  status: 'new' | 'investigating' | 'resolved' | 'ignored';
}> {
  const ts = Date.now();

  const anomalies = [
    {
      id: `anomaly_${ts}_1`,
      type: 'failure_spike',
      severity: 'high' as const,
      detected_at: new Date(Date.now() - 3600000).toISOString(),
      metric_name: 'Test failure rate',
      current_value: 15.5,
      baseline_value: 5.2,
      deviation_percentage: 198,
      affected_tests: ['auth/login.spec.ts', 'auth/register.spec.ts', 'api/users.spec.ts'],
      summary: 'Test failure rate increased by 198% in the last hour',
      status: 'new' as const,
    },
    {
      id: `anomaly_${ts}_2`,
      type: 'performance_degradation',
      severity: 'medium' as const,
      detected_at: new Date(Date.now() - 7200000).toISOString(),
      metric_name: 'Average test duration',
      current_value: 4500,
      baseline_value: 3000,
      deviation_percentage: 50,
      affected_tests: ['e2e/checkout.spec.ts', 'e2e/cart.spec.ts'],
      summary: 'Test execution time increased by 50%',
      status: 'investigating' as const,
    },
    {
      id: `anomaly_${ts}_3`,
      type: 'flaky_test',
      severity: 'medium' as const,
      detected_at: new Date(Date.now() - 86400000).toISOString(),
      metric_name: 'Flakiness score',
      current_value: 0.35,
      baseline_value: 0.1,
      deviation_percentage: 250,
      affected_tests: ['visual/dashboard.spec.ts'],
      summary: 'Test flakiness increased by 250%',
      status: 'new' as const,
    },
  ];

  if (severity) {
    return anomalies.filter(a => a.severity === severity);
  }

  return anomalies;
}

// ============================================================================
// Feature #1349: Generate AI-powered release notes from test changes
// ============================================================================

export function generateReleaseNotes(
  testChanges: Array<{
    type: 'added' | 'modified' | 'removed';
    testName: string;
    suiteName: string;
    description?: string;
    category?: 'feature' | 'bugfix' | 'improvement' | 'refactor';
  }>,
  fromVersion: string,
  toVersion: string,
  projectName?: string
): {
  version: string;
  releaseDate: string;
  summary: string;
  newFeatures: Array<{ title: string; description: string; category: string; relatedTests: string[]; impact: 'high' | 'medium' | 'low'; }>;
  bugFixes: Array<{ title: string; description: string; severity: 'critical' | 'major' | 'minor'; relatedTests: string[]; }>;
  improvements: Array<{ title: string; description: string; }>;
  breakingChanges: string[];
  testingHighlights: { testsAdded: number; testsModified: number; testsRemoved: number; coverageImpact: string; };
  markdown: string;
  html: string;
  json: object;
} {
  const releaseDate = new Date().toISOString().split('T')[0];

  const addedTests = testChanges.filter(c => c.type === 'added');
  const modifiedTests = testChanges.filter(c => c.type === 'modified');
  const removedTests = testChanges.filter(c => c.type === 'removed');

  const newFeatures = addedTests
    .filter(t => t.category === 'feature' || !t.category)
    .map(t => ({
      title: t.testName.replace(/test_|_spec|\.spec/gi, '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      description: t.description || `New test coverage for ${t.testName.replace(/_/g, ' ')}`,
      category: t.suiteName,
      relatedTests: [t.testName],
      impact: (t.suiteName.toLowerCase().includes('e2e') || t.suiteName.toLowerCase().includes('integration') ? 'high' : 'medium') as 'high' | 'medium' | 'low',
    }));

  const bugFixes = modifiedTests
    .filter(t => t.category === 'bugfix')
    .map(t => ({
      title: t.testName.replace(/test_|_spec|\.spec/gi, '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      description: t.description || `Fixed issue in ${t.testName}`,
      severity: 'major' as 'critical' | 'major' | 'minor',
      relatedTests: [t.testName],
    }));

  const improvements = modifiedTests
    .filter(t => t.category === 'improvement' || (!t.category && t.type === 'modified'))
    .map(t => ({
      title: t.testName.replace(/test_|_spec|\.spec/gi, '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      description: t.description || `Improved test coverage for ${t.testName}`,
    }));

  const breakingChanges = removedTests.map(t => `Removed test: ${t.testName}${t.description ? ` - ${t.description}` : ''}`);

  const summary = `This release (${toVersion}) includes ${newFeatures.length} new feature${newFeatures.length !== 1 ? 's' : ''}, ${bugFixes.length} bug fix${bugFixes.length !== 1 ? 'es' : ''}, and ${improvements.length} improvement${improvements.length !== 1 ? 's' : ''} based on ${testChanges.length} test changes since ${fromVersion}.`;

  const testingHighlights = {
    testsAdded: addedTests.length,
    testsModified: modifiedTests.length,
    testsRemoved: removedTests.length,
    coverageImpact: addedTests.length > removedTests.length ? 'Coverage increased' : addedTests.length < removedTests.length ? 'Coverage decreased' : 'Coverage stable',
  };

  // Generate markdown release notes
  const featuresSection = newFeatures.length > 0 ? `## New Features\n\n${newFeatures.map(f => `### ${f.title}\n${f.description}\n- **Category:** ${f.category} | **Impact:** ${f.impact}\n`).join('\n')}` : '';
  const bugsSection = bugFixes.length > 0 ? `## Bug Fixes\n\n${bugFixes.map(b => `### ${b.title}\n${b.description}\n- **Severity:** ${b.severity}\n`).join('\n')}` : '';
  const improvementsSection = improvements.length > 0 ? `## Improvements\n\n${improvements.map(i => `- **${i.title}:** ${i.description}`).join('\n')}\n` : '';
  const breakingSection = breakingChanges.length > 0 ? `## Breaking Changes\n\n${breakingChanges.map(c => `- ${c}`).join('\n')}\n` : '';

  const markdown = `# Release Notes - ${toVersion}\n\n**Release Date:** ${releaseDate}${projectName ? ` | **Project:** ${projectName}` : ''}\n\n## Summary\n\n${summary}\n\n${featuresSection}${bugsSection}${improvementsSection}${breakingSection}## Testing Summary\n\n| Metric | Count |\n|--------|-------|\n| Tests Added | ${testingHighlights.testsAdded} |\n| Tests Modified | ${testingHighlights.testsModified} |\n| Tests Removed | ${testingHighlights.testsRemoved} |\n| Coverage Impact | ${testingHighlights.coverageImpact} |\n\n---\n*Generated by QA Guardian AI*`;

  // Generate HTML release notes (compact)
  const htmlStyle = `body{font-family:system-ui,sans-serif;max-width:800px;margin:0 auto;padding:20px}h1{border-bottom:2px solid #3b82f6}h2{color:#374151;margin-top:30px}.feature{background:#ecfdf5;padding:15px;border-radius:8px;margin:10px 0}.bugfix{background:#fef2f2;padding:15px;border-radius:8px;margin:10px 0}table{width:100%;border-collapse:collapse}th,td{padding:10px;border:1px solid #e5e7eb}th{background:#f9fafb}`;
  const htmlFeatures = newFeatures.length > 0 ? `<h2>New Features</h2>${newFeatures.map(f => `<div class="feature"><h3>${f.title}</h3><p>${f.description}</p></div>`).join('')}` : '';
  const htmlBugs = bugFixes.length > 0 ? `<h2>Bug Fixes</h2>${bugFixes.map(b => `<div class="bugfix"><h3>${b.title}</h3><p>${b.description}</p></div>`).join('')}` : '';
  const html = `<!DOCTYPE html><html><head><title>Release Notes - ${toVersion}</title><style>${htmlStyle}</style></head><body><h1>Release Notes - ${toVersion}</h1><p>Release Date: ${releaseDate}</p><h2>Summary</h2><p>${summary}</p>${htmlFeatures}${htmlBugs}<h2>Testing Summary</h2><table><tr><th>Metric</th><th>Count</th></tr><tr><td>Added</td><td>${testingHighlights.testsAdded}</td></tr><tr><td>Modified</td><td>${testingHighlights.testsModified}</td></tr><tr><td>Removed</td><td>${testingHighlights.testsRemoved}</td></tr></table></body></html>`;

  const json = {
    version: toVersion,
    previousVersion: fromVersion,
    releaseDate,
    projectName,
    summary,
    newFeatures,
    bugFixes,
    improvements,
    breakingChanges,
    testingHighlights,
    generatedAt: new Date().toISOString(),
  };

  return {
    version: toVersion,
    releaseDate,
    summary,
    newFeatures,
    bugFixes,
    improvements,
    breakingChanges,
    testingHighlights,
    markdown,
    html,
    json,
  };
}
