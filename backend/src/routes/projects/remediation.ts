// Projects Module - Flakiness Remediation Suggestions Routes
// Feature #1106: AI suggests fixes for flaky tests based on patterns

import { FastifyInstance } from 'fastify';
import { authenticate, JwtPayload, getOrganizationId } from '../../middleware/auth';
import { getProject } from './stores';
import { getTest, getTestSuite } from '../test-suites/stores';
import { listTestRunsByOrg } from '../../services/repositories/test-runs';

// Remediation suggestion interface
interface RemediationSuggestion {
  id: string;
  category: 'wait_strategy' | 'selector_improvement' | 'test_isolation' | 'mock_data' | 'retry_logic' | 'environment' | 'timing' | 'assertion';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  pattern_matched: string;
  confidence: number;
  code_example?: {
    before: string;
    after: string;
    language: string;
    explanation: string;
  };
  impact: string;
  implementation_steps: string[];
}

export async function remediationRoutes(app: FastifyInstance) {
  // Get AI-generated remediation suggestions for a flaky test
  app.get<{
    Params: { testId: string };
    Querystring: { include_code_examples?: string };
  }>('/api/v1/ai-insights/flaky-tests/:testId/suggestions', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { testId } = request.params;
    const { include_code_examples = 'true' } = request.query;
    const orgId = getOrganizationId(request);
    const includeCodeExamples = include_code_examples === 'true';

    // Verify test exists and belongs to org (async DB calls)
    const test = await getTest(testId);
    if (!test) {
      return reply.status(404).send({ error: 'Not Found', message: 'Test not found' });
    }

    const suite = await getTestSuite(test.suite_id);
    if (!suite) {
      return reply.status(404).send({ error: 'Not Found', message: 'Test suite not found' });
    }

    const project = await getProject(suite.project_id);
    if (!project || project.organization_id !== orgId) {
      return reply.status(404).send({ error: 'Not Found', message: 'Test not found in your organization' });
    }

    // Get flakiness data for this test (async DB call)
    const allOrgRuns = await listTestRunsByOrg(orgId);
    const orgRuns = allOrgRuns.filter(r => r.results);

    // Analyze test runs for this specific test
    let passCount = 0;
    let failCount = 0;
    let retryCount = 0;
    let passedOnRetryCount = 0;
    const failuresByHour: number[] = new Array(24).fill(0);
    const failuresByBrowser: Map<string, number> = new Map();
    const failuresByEnv: Map<string, number> = new Map();
    const failureMessages: string[] = [];

    for (const run of orgRuns) {
      if (!run.results) continue;

      for (const result of run.results) {
        if (result.test_id !== testId) continue;

        if (result.status === 'passed') {
          passCount++;
        } else if (result.status === 'failed' || result.status === 'error') {
          failCount++;
          const hour = (run.completed_at || run.created_at).getHours();
          failuresByHour[hour] = (failuresByHour[hour] || 0) + 1;

          const browser = run.browser || 'unknown';
          failuresByBrowser.set(browser, (failuresByBrowser.get(browser) || 0) + 1);

          const env = (run as any).environment || 'unknown';
          failuresByEnv.set(env, (failuresByEnv.get(env) || 0) + 1);

          const errorMsg = (result as any).error_message;
          if (errorMsg) {
            failureMessages.push(errorMsg);
          }
        }

        if ((result as any).retry_count && (result as any).retry_count > 0) {
          retryCount += (result as any).retry_count;
          if ((result as any).passed_on_retry) {
            passedOnRetryCount++;
          }
        }
      }
    }

    const totalRuns = passCount + failCount;
    if (totalRuns === 0) {
      return {
        test_id: testId,
        test_name: test.name,
        message: 'No test runs found for analysis',
        suggestions: [],
      };
    }

    // Calculate flakiness patterns
    const passRate = passCount / totalRuns;
    const flakinessScore = Math.min(passRate, 1 - passRate) * 2;
    const isRetryFlaky = passedOnRetryCount > 0;
    const retrySuccessRate = retryCount > 0 ? passedOnRetryCount / retryCount : 0;

    // Detect patterns
    const peakFailureHours = failuresByHour
      .map((count: number, hour: number) => ({ hour, count }))
      .filter(h => h.count >= 2)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    const hasTimePattern = peakFailureHours.length > 0;
    const hasBrowserPattern = failuresByBrowser.size > 1;
    const hasEnvPattern = failuresByEnv.size > 1;

    // Detect common error patterns
    const hasTimeoutErrors = failureMessages.some(m => /timeout|timed? out/i.test(m));
    const hasSelectorErrors = failureMessages.some(m => /not found|no such element|locator|selector/i.test(m));
    const hasNetworkErrors = failureMessages.some(m => /network|fetch|api|http|connection/i.test(m));
    const hasAssertionErrors = failureMessages.some(m => /assert|expect|toBe|toEqual|toMatch/i.test(m));
    const hasRaceConditions = failureMessages.some(m => /stale|detached|disappeared|race/i.test(m));

    // Generate AI suggestions based on patterns
    const suggestions: RemediationSuggestion[] = [];

    // Suggestion 1: Add explicit waits for timeout issues
    if (hasTimeoutErrors || isRetryFlaky) {
      suggestions.push({
        id: 'wait-strategy-1',
        category: 'wait_strategy',
        priority: 'high',
        title: 'Add explicit waits for elements',
        description: 'Replace hardcoded timeouts with explicit waits that wait for specific conditions.',
        pattern_matched: hasTimeoutErrors ? 'Timeout errors detected in failure messages' : 'Test passes on retry, indicating timing issues',
        confidence: hasTimeoutErrors ? 0.9 : 0.75,
        code_example: includeCodeExamples ? {
          language: 'typescript',
          before: `// Bad: Fixed timeout
await page.waitForTimeout(3000);
await page.click('#submit-button');`,
          after: `// Good: Explicit wait for element
await page.waitForSelector('#submit-button', { state: 'visible' });
await page.click('#submit-button');

// Or use Playwright's auto-waiting
await page.locator('#submit-button').click(); // Auto-waits for element`,
          explanation: 'Explicit waits dynamically wait for conditions, eliminating flakiness from arbitrary timeouts.',
        } : undefined,
        impact: 'Reduces timing-related flakiness by up to 80%',
        implementation_steps: [
          'Identify all hardcoded setTimeout/waitForTimeout calls',
          'Replace with waitForSelector, waitForFunction, or locator auto-waiting',
          'Set appropriate timeout limits (e.g., 30s for slow operations)',
          'Add custom wait conditions for dynamic content',
        ],
      });
    }

    // Suggestion 2: Improve selectors for element not found issues
    if (hasSelectorErrors || hasRaceConditions) {
      suggestions.push({
        id: 'selector-improvement-1',
        category: 'selector_improvement',
        priority: 'high',
        title: 'Use resilient selectors with test IDs',
        description: 'Replace fragile CSS selectors with data-testid attributes that are more stable.',
        pattern_matched: hasSelectorErrors ? 'Element not found errors detected' : 'Stale element or race condition errors detected',
        confidence: 0.85,
        code_example: includeCodeExamples ? {
          language: 'typescript',
          before: `// Fragile: CSS path depends on DOM structure
await page.click('div.container > button.submit-btn');
await page.fill('div:nth-child(2) > input', 'test');`,
          after: `// Resilient: Test IDs are stable
await page.click('[data-testid="submit-button"]');
await page.fill('[data-testid="email-input"]', 'test');

// Or use role-based selectors
await page.getByRole('button', { name: 'Submit' }).click();`,
          explanation: 'Test IDs and role selectors are resilient to style and structure changes.',
        } : undefined,
        impact: 'Eliminates selector-related failures from UI refactoring',
        implementation_steps: [
          'Add data-testid attributes to key interactive elements',
          'Replace CSS path selectors with data-testid or role selectors',
          'Use getByRole, getByText, getByLabel for accessible elements',
          'Document selector conventions in test guidelines',
        ],
      });
    }

    // Suggestion 3: Mock external data for consistency
    if (hasNetworkErrors || hasAssertionErrors) {
      suggestions.push({
        id: 'mock-data-1',
        category: 'mock_data',
        priority: 'medium',
        title: 'Mock external API responses',
        description: 'Mock network requests to ensure consistent test data regardless of backend state.',
        pattern_matched: hasNetworkErrors ? 'Network-related errors detected' : 'Assertion failures may be due to dynamic data',
        confidence: 0.75,
        code_example: includeCodeExamples ? {
          language: 'typescript',
          before: `// Flaky: Depends on live API
test('displays user profile', async () => {
  await page.goto('/profile');
  // Fails if API is slow or returns different data
  await expect(page.locator('.user-name')).toHaveText('John');
});`,
          after: `// Stable: Mocked API response
test('displays user profile', async () => {
  await page.route('**/api/user', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ name: 'John' }),
  }));
  await page.goto('/profile');
  await expect(page.locator('.user-name')).toHaveText('John');
});`,
          explanation: 'Mocking ensures deterministic test data, isolating tests from backend variability.',
        } : undefined,
        impact: 'Eliminates flakiness from API latency and data changes',
        implementation_steps: [
          'Identify external API calls in flaky tests',
          'Create mock response fixtures with expected data',
          'Use page.route() to intercept and mock requests',
          'Test both success and error scenarios with mocks',
        ],
      });
    }

    // Suggestion 4: Time-based pattern mitigation
    if (hasTimePattern) {
      const peakHours = peakFailureHours.map(h => `${h.hour}:00`).join(', ');
      suggestions.push({
        id: 'timing-1',
        category: 'timing',
        priority: 'medium',
        title: 'Address time-based failure patterns',
        description: `Test fails more frequently at specific times (${peakHours}). This may indicate resource contention or scheduled processes.`,
        pattern_matched: `Peak failure times: ${peakHours}`,
        confidence: 0.7,
        code_example: includeCodeExamples ? {
          language: 'typescript',
          before: `// Test may fail during high-load times
test('checkout process', async () => {
  await page.goto('/checkout');
  await page.click('#complete-purchase');
  // May timeout during peak hours
});`,
          after: `// Add retry and longer timeouts for load-sensitive tests
test('checkout process', { retries: 2, timeout: 60000 }, async () => {
  // Increase individual step timeouts
  await page.goto('/checkout', { timeout: 30000 });
  await page.click('#complete-purchase', { timeout: 15000 });

  // Or use waitForResponse for API calls
  const [response] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/purchase')),
    page.click('#complete-purchase'),
  ]);
  expect(response.status()).toBe(200);
});`,
          explanation: 'Extended timeouts and retries help tests succeed during high-load periods.',
        } : undefined,
        impact: 'Reduces time-correlated failures during peak load',
        implementation_steps: [
          'Review what processes run at failure peak times (deployments, backups)',
          'Consider running tests at off-peak hours if possible',
          'Add retry configuration for load-sensitive tests',
          'Increase timeouts for operations affected by load',
        ],
      });
    }

    // Suggestion 5: Browser/Environment specific issues
    if (hasBrowserPattern || hasEnvPattern) {
      suggestions.push({
        id: 'environment-1',
        category: 'environment',
        priority: 'medium',
        title: 'Handle cross-browser/environment differences',
        description: 'Test behaves differently across browsers or environments. Add browser-specific handling.',
        pattern_matched: hasBrowserPattern ? 'Different failure rates across browsers' : 'Different failure rates in CI vs local',
        confidence: 0.65,
        code_example: includeCodeExamples ? {
          language: 'typescript',
          before: `// Assumes same behavior across all browsers
await page.keyboard.press('Enter');
await page.click('.dropdown-option');`,
          after: `// Handle browser differences
const browserName = page.context().browser()?.browserType().name();

// Use consistent interactions
await page.locator('.dropdown-trigger').click();
await page.locator('.dropdown-option').click();

// Or skip browser-specific tests
test.skip(browserName === 'webkit', 'WebKit has known animation issues');

// Ensure CI environment matches local
test.beforeAll(async () => {
  // Set consistent viewport
  await page.setViewportSize({ width: 1280, height: 720 });
});`,
          explanation: 'Consistent setup and browser-aware code reduces cross-environment flakiness.',
        } : undefined,
        impact: 'Improves test stability across different execution environments',
        implementation_steps: [
          'Review browser-specific test results in CI logs',
          'Identify browser-specific behaviors (animations, events)',
          'Add browser detection and conditional logic where needed',
          'Ensure CI uses same browser versions as local development',
        ],
      });
    }

    // Suggestion 6: Test isolation for race conditions
    if (hasRaceConditions || (flakinessScore > 0.5 && !isRetryFlaky)) {
      suggestions.push({
        id: 'test-isolation-1',
        category: 'test_isolation',
        priority: 'high',
        title: 'Improve test isolation and cleanup',
        description: 'Ensure each test starts with a clean state to prevent cross-test interference.',
        pattern_matched: hasRaceConditions ? 'Stale element or race condition errors' : 'High flakiness without clear pattern suggests state pollution',
        confidence: 0.7,
        code_example: includeCodeExamples ? {
          language: 'typescript',
          before: `// Tests share state
let sharedData;
test('create item', async () => {
  sharedData = await createItem();
});
test('use item', async () => {
  // Fails if tests run in different order
  await useItem(sharedData);
});`,
          after: `// Each test is isolated
test.beforeEach(async ({ page }) => {
  // Start fresh session
  await page.context().clearCookies();
  await page.context().clearPermissions();
});

test('create and use item', async ({ page }) => {
  // Create item within test
  const item = await createItem(page);
  await useItem(page, item);
});

// Or use fixtures for shared setup
test.describe('item tests', () => {
  let item;
  test.beforeAll(async () => {
    item = await createTestItem(); // Created once for suite
  });
  test.afterAll(async () => {
    await deleteTestItem(item); // Cleanup after suite
  });
});`,
          explanation: 'Isolated tests run reliably regardless of execution order or parallel execution.',
        } : undefined,
        impact: 'Eliminates test order dependencies and shared state bugs',
        implementation_steps: [
          'Review test for shared variables or global state',
          'Add beforeEach hooks to reset state',
          'Use fixtures for common setup/teardown',
          'Run tests in random order to detect isolation issues',
        ],
      });
    }

    // Suggestion 7: Add retry logic for inherently flaky operations
    if (retryCount > 0 && retrySuccessRate > 0.5) {
      suggestions.push({
        id: 'retry-logic-1',
        category: 'retry_logic',
        priority: 'low',
        title: 'Configure appropriate retry strategy',
        description: `Test passes ${Math.round(retrySuccessRate * 100)}% of the time on retry. Configure retry to handle intermittent failures while investigating root cause.`,
        pattern_matched: `Test passes on retry ${Math.round(retrySuccessRate * 100)}% of the time`,
        confidence: 0.6,
        code_example: includeCodeExamples ? {
          language: 'typescript',
          before: `// No retry configured
export default defineConfig({
  retries: 0,
});`,
          after: `// Configure retries in playwright.config.ts
export default defineConfig({
  retries: process.env.CI ? 2 : 0, // Retry in CI only

  // Or per-test retry
  use: {
    retry: 2,
  },
});

// Per-test retry annotation
test('flaky operation', { retries: 3 }, async () => {
  // Test code
});`,
          explanation: 'Retries provide stability while you investigate and fix the underlying issue.',
        } : undefined,
        impact: 'Improves test suite stability while root cause is being fixed',
        implementation_steps: [
          'Configure global retries in playwright.config.ts (2 for CI)',
          'Use per-test retries for known flaky tests',
          'Add retry annotations with comments explaining why',
          'Track flaky tests and work on permanent fixes',
        ],
      });
    }

    // Sort suggestions by priority and confidence
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    suggestions.sort((a, b) => {
      const priorityDiff = (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
      if (priorityDiff !== 0) return priorityDiff;
      return b.confidence - a.confidence;
    });

    // Calculate analysis summary
    const patternsSummary: string[] = [];
    if (hasTimeoutErrors) patternsSummary.push('timeout errors');
    if (hasSelectorErrors) patternsSummary.push('selector failures');
    if (hasNetworkErrors) patternsSummary.push('network issues');
    if (hasRaceConditions) patternsSummary.push('race conditions');
    if (isRetryFlaky) patternsSummary.push('retry-dependent');
    if (hasTimePattern) patternsSummary.push('time-based patterns');
    if (hasBrowserPattern) patternsSummary.push('browser-specific');
    if (hasEnvPattern) patternsSummary.push('environment-specific');

    return {
      test_id: testId,
      test_name: test.name,
      suite_name: suite.name,
      project_name: project.name,
      analysis: {
        total_runs: totalRuns,
        pass_count: passCount,
        fail_count: failCount,
        flakiness_score: Math.round(flakinessScore * 100) / 100,
        flakiness_percentage: Math.round(flakinessScore * 100),
        is_retry_flaky: isRetryFlaky,
        retry_success_rate: Math.round(retrySuccessRate * 100),
        patterns_detected: patternsSummary,
      },
      suggestions,
      suggestions_count: suggestions.length,
      high_priority_count: suggestions.filter(s => s.priority === 'high').length,
      generated_at: new Date().toISOString(),
    };
  });
}
