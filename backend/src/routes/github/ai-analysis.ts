/**
 * AI Analysis Routes
 *
 * AI-powered analysis and vision routes for test improvement,
 * anomaly detection, release notes generation, and screenshot analysis.
 *
 * Features:
 * - #1350: Analyze test code for improvements
 * - #1348: Explain anomaly in plain English
 * - #1349: Generate AI-powered release notes
 * - #1347: Analyze element with vision for selector healing
 * - #1346: Explain Playwright test code
 * - #1155: Generate test from annotated screenshot
 * - #1343: Screenshot analysis function
 */

import { FastifyInstance } from 'fastify';

// ============================================================================
// Type Definitions
// ============================================================================

/** Best practice issue found in test code */
interface BestPracticeIssue {
  category: string;
  issue: string;
  severity: 'low' | 'medium' | 'high';
  suggestion: string;
  code_example?: string;
  line_number?: number;
}

/** Selector improvement suggestion */
interface SelectorImprovement {
  original_selector: string;
  issue: string;
  suggested_selector: string;
  reason: string;
  confidence: number;
}

/** Assertion suggestion for test improvement */
interface AssertionSuggestion {
  location: string;
  current_assertion?: string;
  suggested_assertion: string;
  reason: string;
  priority: 'low' | 'medium' | 'high';
}

/** Flakiness risk in test code */
interface FlakinessRisk {
  risk: string;
  severity: 'low' | 'medium' | 'high';
  location?: string;
  mitigation: string;
  code_example?: string;
}

/** Potential cause for an anomaly */
interface PotentialCause {
  cause: string;
  likelihood: 'low' | 'medium' | 'high';
  explanation: string;
}

/** Investigation step for anomaly */
interface InvestigationStep {
  step: number;
  action: string;
  reason: string;
  command_hint?: string;
}

/** Recommended action for resolving anomaly */
interface RecommendedAction {
  action: string;
  priority: 'immediate' | 'soon' | 'later';
  effort: 'low' | 'medium' | 'high';
  impact: string;
}

/** Annotation type for screenshot annotations */
type AnnotationType = 'click' | 'type' | 'expect';

/** Screenshot annotation for test generation */
interface ScreenshotAnnotation {
  type: AnnotationType;
  x: number;
  y: number;
  label?: string;
  expectation?: string;
}

/** Element type detected in screenshots */
type ElementType = 'button' | 'link' | 'input' | 'dropdown' | 'checkbox' | 'radio' | 'text' | 'image' | 'form' | 'navigation' | 'modal' | 'card' | 'table';

/** Page type detected from context */
type PageType = 'login' | 'dashboard' | 'form' | 'list' | 'detail' | 'checkout' | 'settings' | 'search' | 'landing' | 'annotated' | 'other';

/** Action type for test steps */
type ActionType = 'click' | 'type' | 'select' | 'check' | 'hover' | 'navigate' | 'assert' | 'wait' | 'scroll';

/** Selector strategy type */
type SelectorStrategy = 'role' | 'text' | 'label' | 'placeholder' | 'test-id' | 'css' | 'xpath';

/** Test step action type */
type StepActionType = 'navigation' | 'interaction' | 'assertion' | 'wait' | 'setup' | 'cleanup' | 'data';

// ============================================================================
// Feature #1350: Analyze test code for improvements using Claude
// ============================================================================

function analyzeTestForImprovements(
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

function explainAnomaly(
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

function getDetectedAnomalies(
  projectId?: string,
  period: string = '7d',
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

function generateReleaseNotes(
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

// ============================================================================
// Feature #1347: Analyze element with vision for selector healing
// ============================================================================

function analyzeElementWithVision(
  elementScreenshot: string | undefined,
  pageScreenshot: string | undefined,
  originalSelector: string,
  selectorType?: string,
  elementContext?: {
    tag_name?: string;
    text_content?: string;
    classes?: string[];
    attributes?: Record<string, string>;
    bounding_box?: { x: number; y: number; width: number; height: number };
  },
  pageUrl?: string,
  testName?: string
): {
  found: boolean;
  confidence: number;
  matched_element: {
    location: { x: number; y: number; width: number; height: number };
    visual_similarity: number;
    text_match?: string;
    attributes_match: Record<string, string>;
  } | null;
  suggested_selectors: Array<{
    selector: string;
    type: 'css' | 'xpath' | 'role' | 'text' | 'test-id' | 'label';
    confidence: number;
    reason: string;
    best_practice: boolean;
  }>;
  healing_strategy: string;
  analysis: {
    element_type: string;
    visual_characteristics: string[];
    text_content?: string;
    nearby_elements: string[];
    page_context: string;
  };
  approval_required: boolean;
  auto_heal_recommended: boolean;
} {
  const hasElementScreenshot = !!elementScreenshot;
  const hasPageScreenshot = !!pageScreenshot;
  const context = elementContext || {};

  let elementType = 'unknown';
  if (originalSelector.includes('button') || context.tag_name === 'button') {
    elementType = 'button';
  } else if (originalSelector.includes('input') || context.tag_name === 'input') {
    elementType = 'input';
  } else if (originalSelector.includes('a[') || originalSelector.includes('link') || context.tag_name === 'a') {
    elementType = 'link';
  } else if (originalSelector.includes('select') || context.tag_name === 'select') {
    elementType = 'dropdown';
  } else if (originalSelector.includes('checkbox') || (context.attributes && context.attributes['type'] === 'checkbox')) {
    elementType = 'checkbox';
  } else if (context.tag_name) {
    elementType = context.tag_name;
  }

  const visualCharacteristics: string[] = [];
  if (elementType === 'button') {
    visualCharacteristics.push('rectangular shape', 'prominent background color', 'centered text', 'hover effect expected');
  } else if (elementType === 'input') {
    visualCharacteristics.push('text field', 'border outline', 'placeholder text visible', 'focus ring on interaction');
  } else if (elementType === 'link') {
    visualCharacteristics.push('underlined or colored text', 'cursor pointer on hover', 'inline element');
  } else {
    visualCharacteristics.push('interactive element', 'clickable area');
  }

  let baseConfidence = 0.5;
  if (hasElementScreenshot) baseConfidence += 0.2;
  if (hasPageScreenshot) baseConfidence += 0.15;
  if (context.text_content) baseConfidence += 0.1;
  if (context.bounding_box) baseConfidence += 0.05;

  const suggestedSelectors: Array<{
    selector: string;
    type: 'css' | 'xpath' | 'role' | 'text' | 'test-id' | 'label';
    confidence: number;
    reason: string;
    best_practice: boolean;
  }> = [];

  if (elementType === 'button') {
    const textContent = context.text_content || 'Submit';
    suggestedSelectors.push({
      selector: `getByRole('button', { name: '${textContent}' })`,
      type: 'role',
      confidence: baseConfidence + 0.15,
      reason: 'Role-based selector with accessible name - most resilient to DOM changes',
      best_practice: true,
    });
  } else if (elementType === 'input') {
    const label = context.attributes?.['aria-label'] || context.attributes?.['placeholder'] || 'input';
    suggestedSelectors.push({
      selector: `getByRole('textbox', { name: '${label}' })`,
      type: 'role',
      confidence: baseConfidence + 0.12,
      reason: 'Role-based selector targeting input field by label',
      best_practice: true,
    });
  } else if (elementType === 'link') {
    const linkText = context.text_content || 'link';
    suggestedSelectors.push({
      selector: `getByRole('link', { name: '${linkText}' })`,
      type: 'role',
      confidence: baseConfidence + 0.15,
      reason: 'Role-based selector for link element',
      best_practice: true,
    });
  }

  if (context.text_content) {
    suggestedSelectors.push({
      selector: `getByText('${context.text_content}')`,
      type: 'text',
      confidence: baseConfidence + 0.08,
      reason: 'Text content selector - works well when text is unique',
      best_practice: false,
    });
  }

  if (context.attributes?.['data-testid']) {
    suggestedSelectors.push({
      selector: `getByTestId('${context.attributes['data-testid']}')`,
      type: 'test-id',
      confidence: baseConfidence + 0.2,
      reason: 'Test ID selector - stable identifier for testing',
      best_practice: true,
    });
  }

  if (context.classes && context.classes.length > 0) {
    const uniqueClass = context.classes.find(c => !c.includes('_') && c.length > 3) || context.classes[0];
    suggestedSelectors.push({
      selector: `.${uniqueClass}`,
      type: 'css',
      confidence: baseConfidence - 0.1,
      reason: 'CSS class selector - may break if classes are dynamically generated',
      best_practice: false,
    });
  }

  if (context.tag_name) {
    const attrs = context.attributes || {};
    const attrConditions = Object.entries(attrs)
      .filter(([k]) => ['id', 'name', 'type'].includes(k))
      .map(([k, v]) => `@${k}='${v}'`)
      .join(' and ');

    suggestedSelectors.push({
      selector: `//${context.tag_name}${attrConditions ? `[${attrConditions}]` : ''}`,
      type: 'xpath',
      confidence: baseConfidence - 0.2,
      reason: 'XPath selector - fragile, use only when other options fail',
      best_practice: false,
    });
  }

  suggestedSelectors.sort((a, b) => b.confidence - a.confidence);

  const topSuggestion = suggestedSelectors[0];
  const autoHealRecommended = topSuggestion && topSuggestion.confidence >= 0.75 && topSuggestion.best_practice;
  const approvalRequired = !autoHealRecommended || (topSuggestion && topSuggestion.confidence < 0.85);

  return {
    found: suggestedSelectors.length > 0,
    confidence: topSuggestion ? Math.min(topSuggestion.confidence, 0.99) : 0,
    matched_element: hasPageScreenshot || hasElementScreenshot ? {
      location: context.bounding_box || { x: 100, y: 100, width: 100, height: 40 },
      visual_similarity: hasElementScreenshot ? 0.85 : 0.6,
      text_match: context.text_content,
      attributes_match: context.attributes || {},
    } : null,
    suggested_selectors: suggestedSelectors.slice(0, 5),
    healing_strategy: 'visual_match',
    analysis: {
      element_type: elementType,
      visual_characteristics: visualCharacteristics,
      text_content: context.text_content,
      nearby_elements: ['parent container', 'sibling elements', 'form context'],
      page_context: pageUrl || 'Unknown page',
    },
    approval_required: approvalRequired,
    auto_heal_recommended: autoHealRecommended,
  };
}

// ============================================================================
// Feature #1347: Get healing suggestions for a test's fragile selectors
// ============================================================================

function getHealingSuggestions(testId: string): Array<{
  step_index: number;
  current_selector: string;
  selector_type: string;
  fragility_score: number;
  fragility_reasons: string[];
  suggested_alternatives: Array<{
    selector: string;
    type: string;
    confidence: number;
    improvement: string;
  }>;
}> {
  const ts = Date.now();

  return [
    {
      step_index: 2,
      current_selector: '#submit-btn',
      selector_type: 'css',
      fragility_score: 0.7,
      fragility_reasons: [
        'ID selectors can change with build systems',
        'No semantic meaning - relies on implementation detail',
        'Single point of failure if ID is renamed',
      ],
      suggested_alternatives: [
        { selector: "getByRole('button', { name: 'Submit' })", type: 'role', confidence: 0.92, improvement: 'Role-based selector is more resilient to DOM changes' },
        { selector: "getByText('Submit')", type: 'text', confidence: 0.78, improvement: 'Text selector works if button text is stable' },
      ],
    },
    {
      step_index: 4,
      current_selector: '.form-input-email',
      selector_type: 'css',
      fragility_score: 0.65,
      fragility_reasons: [
        'Class names may be auto-generated or minified',
        'No accessibility context',
        'May conflict with similar elements',
      ],
      suggested_alternatives: [
        { selector: "getByRole('textbox', { name: 'Email' })", type: 'role', confidence: 0.88, improvement: 'Semantic selector based on accessible name' },
        { selector: "getByLabel('Email')", type: 'label', confidence: 0.85, improvement: 'Label-based selector is accessible and stable' },
      ],
    },
  ];
}

// ============================================================================
// Feature #1346: Explain Playwright test code in plain English
// ============================================================================

function explainPlaywrightTest(
  code: string,
  testName?: string,
  testType?: string
): {
  summary: string;
  purpose: string;
  steps: Array<{ step_number: number; code_line: string; explanation: string; action_type: StepActionType; }>;
  assertions: Array<{ assertion: string; explanation: string; importance: 'critical' | 'important' | 'helpful'; }>;
  selectors: Array<{ selector: string; strategy: SelectorStrategy; explanation: string; best_practice: boolean; }>;
  improvements: Array<{ suggestion: string; reason: string; priority: 'high' | 'medium' | 'low'; code_example?: string; }>;
  complexity: { level: 'simple' | 'medium' | 'complex'; factors: string[]; };
} {
  const lines = code.split('\n');
  const steps: Array<{ step_number: number; code_line: string; explanation: string; action_type: StepActionType; }> = [];
  const assertions: Array<{ assertion: string; explanation: string; importance: 'critical' | 'important' | 'helpful'; }> = [];
  const selectors: Array<{ selector: string; strategy: SelectorStrategy; explanation: string; best_practice: boolean; }> = [];
  const improvements: Array<{ suggestion: string; reason: string; priority: 'high' | 'medium' | 'low'; code_example?: string; }> = [];

  let stepNumber = 0;
  let hasTestId = false;
  let hasRoleSelector = false;
  let hasTimeout = false;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('//') || trimmedLine.startsWith('/*') || trimmedLine.startsWith('*')) {
      continue;
    }

    if (trimmedLine.includes('.goto(') || trimmedLine.includes('page.goto')) {
      stepNumber++;
      const urlMatch = trimmedLine.match(/goto\(['"`]([^'"`]+)['"`]\)/);
      steps.push({ step_number: stepNumber, code_line: trimmedLine, explanation: `Navigate to ${urlMatch ? urlMatch[1] : 'the specified URL'}`, action_type: 'navigation' });
    } else if (trimmedLine.includes('.click(')) {
      stepNumber++;
      steps.push({ step_number: stepNumber, code_line: trimmedLine, explanation: 'Click on an element on the page', action_type: 'interaction' });
    } else if (trimmedLine.includes('.fill(') || trimmedLine.includes('.type(')) {
      stepNumber++;
      const valueMatch = trimmedLine.match(/(?:fill|type)\([^,]+,\s*['"`]([^'"`]*)['"`]\)/);
      steps.push({ step_number: stepNumber, code_line: trimmedLine, explanation: `Enter text ${valueMatch ? `"${valueMatch[1]}"` : ''} into an input field`, action_type: 'interaction' });
    } else if (trimmedLine.includes('expect(') || trimmedLine.includes('.toHave') || trimmedLine.includes('.toBe')) {
      stepNumber++;
      let assertionExplanation = 'Verify an expected condition';
      let importance: 'critical' | 'important' | 'helpful' = 'important';

      if (trimmedLine.includes('toBeVisible')) {
        assertionExplanation = 'Verify that an element is visible on the page';
        importance = 'critical';
      } else if (trimmedLine.includes('toHaveText')) {
        assertionExplanation = 'Verify that an element contains specific text';
        importance = 'critical';
      } else if (trimmedLine.includes('toHaveURL')) {
        assertionExplanation = 'Verify that the page URL matches expected value';
        importance = 'critical';
      } else if (trimmedLine.includes('toHaveTitle')) {
        assertionExplanation = 'Verify that the page title matches expected value';
        importance = 'important';
      } else if (trimmedLine.includes('toHaveCount')) {
        assertionExplanation = 'Verify the count of matched elements';
        importance = 'important';
      } else if (trimmedLine.includes('toBeEnabled')) {
        assertionExplanation = 'Verify that an element is enabled and interactive';
        importance = 'helpful';
      } else if (trimmedLine.includes('toBeDisabled')) {
        assertionExplanation = 'Verify that an element is disabled';
        importance = 'helpful';
      }

      steps.push({ step_number: stepNumber, code_line: trimmedLine, explanation: assertionExplanation, action_type: 'assertion' });
      assertions.push({ assertion: trimmedLine, explanation: assertionExplanation, importance });
    } else if (trimmedLine.includes('.waitFor') || trimmedLine.includes('waitForSelector') || trimmedLine.includes('waitForTimeout')) {
      stepNumber++;
      steps.push({ step_number: stepNumber, code_line: trimmedLine, explanation: 'Wait for a condition or element before proceeding', action_type: 'wait' });
    }

    if (trimmedLine.includes('getByRole(')) {
      hasRoleSelector = true;
      const roleMatch = trimmedLine.match(/getByRole\(['"`]([^'"`]+)['"`]/);
      selectors.push({ selector: trimmedLine, strategy: 'role', explanation: `Selects element by ARIA role "${roleMatch?.[1] || 'unknown'}" - recommended for accessibility`, best_practice: true });
    } else if (trimmedLine.includes('getByText(')) {
      selectors.push({ selector: trimmedLine, strategy: 'text', explanation: 'Selects element by visible text content', best_practice: true });
    } else if (trimmedLine.includes('getByLabel(')) {
      selectors.push({ selector: trimmedLine, strategy: 'label', explanation: 'Selects input element by associated label text', best_practice: true });
    } else if (trimmedLine.includes('getByPlaceholder(')) {
      selectors.push({ selector: trimmedLine, strategy: 'placeholder', explanation: 'Selects input element by placeholder text', best_practice: true });
    } else if (trimmedLine.includes('getByTestId(') || trimmedLine.includes('data-testid')) {
      hasTestId = true;
      selectors.push({ selector: trimmedLine, strategy: 'test-id', explanation: 'Selects element by data-testid attribute - stable for testing', best_practice: true });
    } else if (trimmedLine.includes('locator(') && (trimmedLine.includes('#') || trimmedLine.includes('.'))) {
      selectors.push({ selector: trimmedLine, strategy: 'css', explanation: 'Selects element by CSS selector - may be fragile if structure changes', best_practice: false });
    }

    if (trimmedLine.includes('timeout:')) {
      hasTimeout = true;
    }
  }

  if (!hasRoleSelector && selectors.length > 0) {
    improvements.push({ suggestion: 'Use getByRole() selectors for better accessibility', reason: 'Role-based selectors are more resilient to changes and follow accessibility best practices', priority: 'high', code_example: `page.getByRole('button', { name: 'Submit' })` });
  }

  if (!hasTestId && selectors.some(s => s.strategy === 'css')) {
    improvements.push({ suggestion: 'Add data-testid attributes for stable selectors', reason: 'Test IDs are not affected by styling or structural changes', priority: 'medium', code_example: `page.getByTestId('submit-button')` });
  }

  if (assertions.length === 0) {
    improvements.push({ suggestion: 'Add assertions to verify expected behavior', reason: 'Tests should verify outcomes, not just perform actions', priority: 'high', code_example: `await expect(page.getByText('Success')).toBeVisible();` });
  }

  if (!hasTimeout && steps.length > 3) {
    improvements.push({ suggestion: 'Consider adding explicit timeouts for slow operations', reason: 'Prevents tests from hanging indefinitely on network issues', priority: 'low', code_example: `await page.click('button', { timeout: 10000 });` });
  }

  const complexityFactors: string[] = [];
  let complexityLevel: 'simple' | 'medium' | 'complex' = 'simple';

  if (steps.length > 10) {
    complexityFactors.push('Large number of test steps');
    complexityLevel = 'complex';
  } else if (steps.length > 5) {
    complexityFactors.push('Multiple test steps');
    complexityLevel = 'medium';
  }

  if (assertions.length > 5) {
    complexityFactors.push('Multiple assertions');
    if (complexityLevel === 'simple') complexityLevel = 'medium';
  }

  if (selectors.some(s => s.strategy === 'xpath')) {
    complexityFactors.push('XPath selectors used');
    if (complexityLevel === 'simple') complexityLevel = 'medium';
  }

  const actionCount = steps.filter(s => s.action_type === 'interaction').length;
  const assertionCount = assertions.length;
  const testTypeName = testType === 'visual_regression' ? 'visual regression' :
                       testType === 'lighthouse' ? 'performance' :
                       testType === 'load' ? 'load' :
                       testType === 'accessibility' ? 'accessibility' : 'E2E';

  const summary = testName
    ? `This ${testTypeName} test "${testName}" performs ${actionCount} action${actionCount !== 1 ? 's' : ''} and ${assertionCount} assertion${assertionCount !== 1 ? 's' : ''}.`
    : `This ${testTypeName} test performs ${actionCount} action${actionCount !== 1 ? 's' : ''} and ${assertionCount} assertion${assertionCount !== 1 ? 's' : ''}.`;

  const purpose = steps.length > 0
    ? `The test ${steps[0].action_type === 'navigation' ? 'starts by navigating to a page' : 'begins with'} ${steps[0].explanation.toLowerCase()}.${assertions.length > 0 ? ` It verifies ${assertions[0].explanation.toLowerCase()}.` : ''}`
    : 'This test appears to be a configuration or setup file rather than an executable test.';

  return {
    summary,
    purpose,
    steps,
    assertions,
    selectors,
    improvements,
    complexity: { level: complexityLevel, factors: complexityFactors.length > 0 ? complexityFactors : ['Simple test structure'] },
  };
}

// ============================================================================
// Feature #1155: Generate test from annotated screenshot
// ============================================================================

function generateTestFromAnnotations(
  imageData: string,
  imageType: string,
  baseUrl?: string,
  context?: string,
  annotations?: ScreenshotAnnotation[]
): {
  elements: Array<{ id: string; type: string; description: string; suggested_selector: string; suggested_action: string; confidence: number; location: { x: number; y: number; width: number; height: number }; attributes?: { label?: string; placeholder?: string; role?: string }; }>;
  suggested_test_steps: Array<{ step_number: number; action: string; element_id: string; description: string; playwright_code: string; assertion?: string; }>;
  page_context: { page_type: string; main_functionality: string; detected_framework?: string; responsive_design: boolean; };
  generated_test: { name: string; code: string; complexity: string; };
} {
  const ts = Date.now();
  const elements: Array<{ id: string; type: string; description: string; suggested_selector: string; suggested_action: string; confidence: number; location: { x: number; y: number; width: number; height: number }; attributes?: { label?: string; placeholder?: string; role?: string }; }> = [];
  const testSteps: Array<{ step_number: number; action: string; element_id: string; description: string; playwright_code: string; assertion?: string; }> = [];

  const contextLower = (context || '').toLowerCase();
  let pageType = 'annotated';
  let mainFunctionality = 'Annotated test flow';

  if (contextLower.includes('login')) {
    pageType = 'login';
    mainFunctionality = 'User authentication flow';
  } else if (contextLower.includes('form') || contextLower.includes('contact')) {
    pageType = 'form';
    mainFunctionality = 'Form submission workflow';
  } else if (contextLower.includes('checkout') || contextLower.includes('cart')) {
    pageType = 'checkout';
    mainFunctionality = 'Checkout flow';
  } else if (contextLower.includes('dashboard')) {
    pageType = 'dashboard';
    mainFunctionality = 'Dashboard interaction';
  } else if (contextLower.includes('search')) {
    pageType = 'search';
    mainFunctionality = 'Search functionality';
  }

  testSteps.push({ step_number: 1, action: 'navigate', element_id: '', description: 'Navigate to the page', playwright_code: `await page.goto('${baseUrl || 'https://example.com'}');` });

  if (annotations && annotations.length > 0) {
    annotations.forEach((ann, idx) => {
      const stepNumber = idx + 2;
      const elementId = `ann_elem_${ts}_${idx + 1}`;
      let playwrightCode = '';

      switch (ann.type) {
        case 'click':
          elements.push({ id: elementId, type: 'button', description: `Click target #${idx + 1}`, suggested_selector: `page.locator('button, a, [role="button"]').locator('visible=true').nth(${idx})`, suggested_action: 'click', confidence: 0.85, location: { x: ann.x, y: ann.y, width: 100, height: 40 } });
          playwrightCode = `await page.locator('button, a, [role="button"]').locator('visible=true').nth(${idx}).click();`;
          testSteps.push({ step_number: stepNumber, action: 'click', element_id: elementId, description: `Click on element #${idx + 1}`, playwright_code: playwrightCode });
          break;

        case 'type':
          const typeText = ann.label || 'test input';
          let inputSelector = 'input, textarea';
          if (ann.label?.includes('@')) {
            inputSelector = 'input[type="email"], input[name*="email"]';
          } else if (ann.label && /^[a-zA-Z0-9!@#$%^&*]+$/.test(ann.label) && ann.label.length > 6) {
            inputSelector = 'input[type="password"], input[name*="password"]';
          }
          elements.push({ id: elementId, type: 'input', description: `Input for: ${typeText}`, suggested_selector: `page.locator('${inputSelector}').locator('visible=true').nth(${idx})`, suggested_action: 'fill', confidence: 0.88, location: { x: ann.x, y: ann.y, width: 200, height: 40 }, attributes: { placeholder: typeText } });
          playwrightCode = `await page.locator('${inputSelector}').locator('visible=true').nth(${idx}).fill('${typeText.replace(/'/g, "\\'")}');`;
          testSteps.push({ step_number: stepNumber, action: 'type', element_id: elementId, description: `Type "${typeText}" in input field`, playwright_code: playwrightCode });
          break;

        case 'expect':
          const expectText = ann.expectation || 'element is visible';
          const expectLower = expectText.toLowerCase();
          let assertionCode = '';

          if (expectLower.includes('visible') || expectLower.includes('appear') || expectLower.includes('show')) {
            assertionCode = `await expect(page.locator('text=${expectText.split(' ').slice(0, 3).join(' ')}')).toBeVisible();`;
          } else if (expectLower.includes('text') || expectLower.includes('message') || expectLower.includes('contains')) {
            assertionCode = `await expect(page.locator('body')).toContainText('${expectText.split(':').pop()?.trim() || expectText}');`;
          } else if (expectLower.includes('url') || expectLower.includes('redirect') || expectLower.includes('navigate')) {
            assertionCode = `await expect(page).toHaveURL(/${expectText.replace(/[^a-zA-Z0-9]/g, '.*')}/);`;
          } else if (expectLower.includes('title')) {
            assertionCode = `await expect(page).toHaveTitle(/${expectText.replace(/[^a-zA-Z0-9]/g, '.*')}/);`;
          } else {
            assertionCode = `await expect(page.getByText('${expectText.slice(0, 30)}', { exact: false })).toBeVisible();`;
          }

          elements.push({ id: elementId, type: 'text', description: `Assertion: ${expectText}`, suggested_selector: 'body', suggested_action: 'assert', confidence: 0.80, location: { x: ann.x, y: ann.y, width: 150, height: 30 } });
          testSteps.push({ step_number: stepNumber, action: 'assert', element_id: elementId, description: `Verify: ${expectText}`, playwright_code: assertionCode, assertion: expectText });
          break;
      }
    });
  }

  const testName = context ? context.split(' ').slice(0, 5).join(' ').replace(/[^a-zA-Z0-9\s]/g, '') : `Annotated Screenshot Test`;

  const testCode = `import { test, expect } from '@playwright/test';

/**
 * Test generated from annotated screenshot
 * Annotations: ${annotations?.length || 0} steps
 * Context: ${context || 'None provided'}
 */
test.describe('${testName}', () => {
  test('should ${mainFunctionality.toLowerCase()}', async ({ page }) => {
${testSteps.map(step => {
    const comment = step.assertion ? `    // Step ${step.step_number}: ${step.description}\n    // Assert: ${step.assertion}` : `    // Step ${step.step_number}: ${step.description}`;
    return `${comment}
    ${step.playwright_code}`;
  }).join('\n\n')}
  });
});
`;

  return {
    elements,
    suggested_test_steps: testSteps,
    page_context: { page_type: pageType, main_functionality: mainFunctionality, detected_framework: 'React', responsive_design: true },
    generated_test: { name: testName, code: testCode, complexity: testSteps.length <= 3 ? 'simple' : testSteps.length <= 6 ? 'medium' : 'complex' },
  };
}

// ============================================================================
// Feature #1343: Screenshot analysis function
// ============================================================================

// Page templates for screenshot analysis - reduces code duplication
const PAGE_TEMPLATES: Record<string, { func: string; elements: (ts: number) => any[]; steps: (ts: number, baseUrl: string) => any[] }> = {
  login: {
    func: 'User authentication',
    elements: (ts) => [
      { id: `elem_${ts}_1`, type: 'input', description: 'Email/Username input', suggested_selector: 'input[type="email"], [data-testid="email-input"]', suggested_action: 'fill', confidence: 0.95, location: { x: 200, y: 150, width: 300, height: 40 }, attributes: { placeholder: 'Enter email', role: 'textbox' } },
      { id: `elem_${ts}_2`, type: 'input', description: 'Password input', suggested_selector: 'input[type="password"], [data-testid="password-input"]', suggested_action: 'fill', confidence: 0.95, location: { x: 200, y: 210, width: 300, height: 40 }, attributes: { placeholder: 'Enter password', role: 'textbox' } },
      { id: `elem_${ts}_3`, type: 'button', description: 'Login button', suggested_selector: 'button[type="submit"], [data-testid="login-button"]', suggested_action: 'click', confidence: 0.92, location: { x: 200, y: 280, width: 300, height: 45 }, attributes: { label: 'Login', role: 'button' } },
    ],
    steps: (ts, baseUrl) => [
      { step_number: 1, action: 'navigate', element_id: '', description: 'Navigate to login', playwright_code: `await page.goto('${baseUrl}/login');` },
      { step_number: 2, action: 'type', element_id: `elem_${ts}_1`, description: 'Enter email', playwright_code: `await page.getByRole('textbox', { name: /email/i }).fill('test@example.com');` },
      { step_number: 3, action: 'type', element_id: `elem_${ts}_2`, description: 'Enter password', playwright_code: `await page.getByRole('textbox', { name: /password/i }).fill('password123');` },
      { step_number: 4, action: 'click', element_id: `elem_${ts}_3`, description: 'Click login', playwright_code: `await page.getByRole('button', { name: /login|sign in/i }).click();` },
      { step_number: 5, action: 'assert', element_id: '', description: 'Verify login', playwright_code: `await expect(page).toHaveURL(/dashboard|home/);`, assertion: 'Redirected to dashboard' },
    ],
  },
  form: {
    func: 'Form submission and validation',
    elements: (ts) => [
      { id: `elem_${ts}_1`, type: 'input', description: 'Name input', suggested_selector: 'input[name="name"], [data-testid="name-input"]', suggested_action: 'fill', confidence: 0.90, location: { x: 150, y: 100, width: 350, height: 40 }, attributes: { placeholder: 'Your name', role: 'textbox' } },
      { id: `elem_${ts}_2`, type: 'input', description: 'Email input', suggested_selector: 'input[type="email"], [data-testid="email-input"]', suggested_action: 'fill', confidence: 0.92, location: { x: 150, y: 160, width: 350, height: 40 }, attributes: { placeholder: 'Your email', role: 'textbox' } },
      { id: `elem_${ts}_3`, type: 'button', description: 'Submit button', suggested_selector: 'button[type="submit"], [data-testid="submit-button"]', suggested_action: 'click', confidence: 0.94, location: { x: 150, y: 420, width: 150, height: 45 }, attributes: { label: 'Submit', role: 'button' } },
    ],
    steps: (ts, baseUrl) => [
      { step_number: 1, action: 'navigate', element_id: '', description: 'Navigate to form', playwright_code: `await page.goto('${baseUrl}/contact');` },
      { step_number: 2, action: 'type', element_id: `elem_${ts}_1`, description: 'Fill name', playwright_code: `await page.getByRole('textbox', { name: /name/i }).fill('John Doe');` },
      { step_number: 3, action: 'type', element_id: `elem_${ts}_2`, description: 'Fill email', playwright_code: `await page.getByRole('textbox', { name: /email/i }).fill('john@example.com');` },
      { step_number: 4, action: 'click', element_id: `elem_${ts}_3`, description: 'Submit form', playwright_code: `await page.getByRole('button', { name: /submit|send/i }).click();` },
      { step_number: 5, action: 'assert', element_id: '', description: 'Verify success', playwright_code: `await expect(page.getByText(/thank you|success/i)).toBeVisible();`, assertion: 'Success displayed' },
    ],
  },
  checkout: {
    func: 'E-commerce checkout flow',
    elements: (ts) => [
      { id: `elem_${ts}_1`, type: 'card', description: 'Cart item', suggested_selector: '[data-testid="cart-item"]', suggested_action: 'assert', confidence: 0.85, location: { x: 50, y: 100, width: 500, height: 100 } },
      { id: `elem_${ts}_2`, type: 'text', description: 'Total price', suggested_selector: '[data-testid="total"]', suggested_action: 'assert', confidence: 0.88, location: { x: 400, y: 250, width: 150, height: 30 } },
      { id: `elem_${ts}_3`, type: 'button', description: 'Checkout button', suggested_selector: 'button:has-text("Checkout"), [data-testid="checkout-button"]', suggested_action: 'click', confidence: 0.95, location: { x: 400, y: 300, width: 150, height: 50 }, attributes: { label: 'Checkout', role: 'button' } },
    ],
    steps: (ts, baseUrl) => [
      { step_number: 1, action: 'navigate', element_id: '', description: 'Navigate to cart', playwright_code: `await page.goto('${baseUrl}/cart');` },
      { step_number: 2, action: 'assert', element_id: `elem_${ts}_1`, description: 'Verify cart items', playwright_code: `await expect(page.locator('[data-testid="cart-item"]').first()).toBeVisible();`, assertion: 'Cart has items' },
      { step_number: 3, action: 'click', element_id: `elem_${ts}_3`, description: 'Click checkout', playwright_code: `await page.getByRole('button', { name: /checkout|proceed/i }).click();` },
      { step_number: 4, action: 'assert', element_id: '', description: 'Verify checkout', playwright_code: `await expect(page).toHaveURL(/checkout|payment/);`, assertion: 'On checkout page' },
    ],
  },
  search: {
    func: 'Search functionality',
    elements: (ts) => [
      { id: `elem_${ts}_1`, type: 'input', description: 'Search input', suggested_selector: 'input[type="search"], [data-testid="search-input"]', suggested_action: 'fill', confidence: 0.96, location: { x: 200, y: 50, width: 400, height: 45 }, attributes: { placeholder: 'Search...', role: 'searchbox' } },
      { id: `elem_${ts}_2`, type: 'button', description: 'Search button', suggested_selector: 'button[type="submit"], [data-testid="search-button"]', suggested_action: 'click', confidence: 0.90, location: { x: 610, y: 50, width: 100, height: 45 }, attributes: { label: 'Search', role: 'button' } },
    ],
    steps: (ts, baseUrl) => [
      { step_number: 1, action: 'navigate', element_id: '', description: 'Navigate to search', playwright_code: `await page.goto('${baseUrl}/search');` },
      { step_number: 2, action: 'type', element_id: `elem_${ts}_1`, description: 'Enter query', playwright_code: `await page.getByRole('searchbox').fill('test query');` },
      { step_number: 3, action: 'click', element_id: `elem_${ts}_2`, description: 'Click search', playwright_code: `await page.getByRole('button', { name: /search/i }).click();` },
      { step_number: 4, action: 'assert', element_id: '', description: 'Verify results', playwright_code: `await expect(page.locator('[data-testid="search-result"]').first()).toBeVisible();`, assertion: 'Results visible' },
    ],
  },
  dashboard: {
    func: 'Dashboard overview and navigation',
    elements: (ts) => [
      { id: `elem_${ts}_1`, type: 'navigation', description: 'Navigation menu', suggested_selector: 'nav, [role="navigation"]', suggested_action: 'assert', confidence: 0.90, location: { x: 0, y: 0, width: 200, height: 600 } },
      { id: `elem_${ts}_2`, type: 'card', description: 'Stats card', suggested_selector: '[data-testid="stat-card"]', suggested_action: 'assert', confidence: 0.85, location: { x: 220, y: 50, width: 250, height: 100 } },
      { id: `elem_${ts}_3`, type: 'button', description: 'Create button', suggested_selector: 'button:has-text("Create")', suggested_action: 'click', confidence: 0.82, location: { x: 650, y: 50, width: 120, height: 40 }, attributes: { label: 'Create', role: 'button' } },
    ],
    steps: (ts, baseUrl) => [
      { step_number: 1, action: 'navigate', element_id: '', description: 'Navigate to dashboard', playwright_code: `await page.goto('${baseUrl}/dashboard');` },
      { step_number: 2, action: 'assert', element_id: `elem_${ts}_1`, description: 'Verify navigation', playwright_code: `await expect(page.getByRole('navigation')).toBeVisible();`, assertion: 'Navigation visible' },
      { step_number: 3, action: 'assert', element_id: `elem_${ts}_2`, description: 'Verify cards', playwright_code: `await expect(page.locator('[data-testid="stat-card"]').first()).toBeVisible();`, assertion: 'Cards visible' },
    ],
  },
  other: {
    func: 'General page interaction',
    elements: (ts) => [
      { id: `elem_${ts}_1`, type: 'navigation', description: 'Page header', suggested_selector: 'header, nav', suggested_action: 'assert', confidence: 0.85, location: { x: 0, y: 0, width: 800, height: 60 } },
      { id: `elem_${ts}_2`, type: 'button', description: 'Primary button', suggested_selector: 'button.primary, button[type="submit"]', suggested_action: 'click', confidence: 0.75, location: { x: 300, y: 200, width: 150, height: 45 }, attributes: { role: 'button' } },
    ],
    steps: (ts, baseUrl) => [
      { step_number: 1, action: 'navigate', element_id: '', description: 'Navigate to page', playwright_code: `await page.goto('${baseUrl}');` },
      { step_number: 2, action: 'assert', element_id: `elem_${ts}_1`, description: 'Verify loaded', playwright_code: `await expect(page).toHaveTitle(/.+/);`, assertion: 'Page has title' },
    ],
  },
};

function analyzeScreenshotForTest(imageData: string, imageType: string, baseUrl?: string, context?: string): {
  elements: Array<{ id: string; type: ElementType; description: string; suggested_selector: string; suggested_action: string; confidence: number; location: { x: number; y: number; width: number; height: number }; attributes?: { label?: string; placeholder?: string; role?: string }; }>;
  suggested_test_steps: Array<{ step_number: number; action: ActionType; element_id: string; description: string; playwright_code: string; assertion?: string; }>;
  page_context: { page_type: PageType; main_functionality: string; detected_framework?: string; responsive_design: boolean; };
  generated_test: { name: string; code: string; complexity: 'simple' | 'medium' | 'complex'; };
} {
  const contextLower = (context || '').toLowerCase();
  let pageType: PageType = 'other';

  if (contextLower.includes('login') || contextLower.includes('sign in')) pageType = 'login';
  else if (contextLower.includes('dashboard')) pageType = 'dashboard';
  else if (contextLower.includes('form') || contextLower.includes('contact') || contextLower.includes('signup')) pageType = 'form';
  else if (contextLower.includes('checkout') || contextLower.includes('cart')) pageType = 'checkout';
  else if (contextLower.includes('search')) pageType = 'search';

  const ts = Date.now();
  const url = baseUrl || 'https://example.com';
  const template = PAGE_TEMPLATES[pageType] || PAGE_TEMPLATES.other;
  const elements = template.elements(ts);
  const testSteps = template.steps(ts, url);
  const mainFunctionality = template.func;

  const testName = context ? context.split(' ').slice(0, 5).join(' ').replace(/[^a-zA-Z0-9\s]/g, '') : `${pageType.charAt(0).toUpperCase() + pageType.slice(1)} Page Test`;
  const testCode = `import { test, expect } from '@playwright/test';

test.describe('${testName}', () => {
  test('should ${mainFunctionality.toLowerCase()}', async ({ page }) => {
${testSteps.map(step => `    // Step ${step.step_number}: ${step.description}\n    ${step.playwright_code}`).join('\n\n')}
  });
});
`;

  return {
    elements,
    suggested_test_steps: testSteps,
    page_context: { page_type: pageType, main_functionality: mainFunctionality, detected_framework: 'React', responsive_design: true },
    generated_test: { name: testName, code: testCode, complexity: testSteps.length <= 3 ? 'simple' : testSteps.length <= 6 ? 'medium' : 'complex' },
  };
}

// ============================================================================
// Route Registration
// ============================================================================

export async function aiAnalysisRoutes(app: FastifyInstance): Promise<void> {
  // Export the helper functions for use by other modules
  (app as any).aiAnalysis = {
    analyzeTestForImprovements,
    explainAnomaly,
    getDetectedAnomalies,
    generateReleaseNotes,
    analyzeElementWithVision,
    getHealingSuggestions,
    explainPlaywrightTest,
    generateTestFromAnnotations,
    analyzeScreenshotForTest,
  };
}

// Export functions for direct use
export {
  analyzeTestForImprovements,
  explainAnomaly,
  getDetectedAnomalies,
  generateReleaseNotes,
  analyzeElementWithVision,
  getHealingSuggestions,
  explainPlaywrightTest,
  generateTestFromAnnotations,
  analyzeScreenshotForTest,
};
