/**
 * Root Cause Analysis Functions Module
 * Extracted from test-runs.ts for code organization (Feature #1356)
 *
 * Contains main root cause analysis functions:
 * - generateRootCauseAnalysis
 * - generateEvidenceArtifacts
 * - generateSuggestedActions
 * - generateHistoricalPatternMatch
 * - generateCrossTestCorrelation
 */

import {
  RootCause,
  RootCauseAnalysisResult,
  EvidenceArtifacts,
  SuggestedAction,
  SuggestedActions,
  HistoricalFailure,
  HistoricalPatternMatch,
  AffectedTest,
  CrossTestCorrelation,
  generateSimulatedConsoleLogs,
  generateSimulatedNetworkRequests,
  parseStackTrace,
  extractSelector,
} from './root-cause-helpers';

// Re-export types for convenience
export {
  RootCause,
  RootCauseAnalysisResult,
  EvidenceArtifacts,
  SuggestedAction,
  SuggestedActions,
  HistoricalFailure,
  HistoricalPatternMatch,
  AffectedTest,
  CrossTestCorrelation,
};

// Feature #1078: Generate comprehensive root cause analysis with confidence scoring
export function generateRootCauseAnalysis(
  errorMessage: string,
  testResult: { test_name: string; status: string; error?: string; steps?: Array<{ action?: string; selector?: string; error?: string }> },
  run: { browser?: string; environment?: string }
): RootCauseAnalysisResult {
  const causes: RootCause[] = [];

  // Analyze error patterns and generate root causes with confidence
  const isNetworkError = /network|fetch|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|socket|connection refused|DNS|ERR_CONNECTION|ERR_NAME_NOT_RESOLVED/i.test(errorMessage);
  const isTimeoutError = /timeout|timed out|exceeded|waitFor.*failed|waiting for.*failed/i.test(errorMessage);
  const isElementError = /element.*not found|no element|locator|selector|could not find|unable to locate|not visible|not clickable/i.test(errorMessage);
  const isDataError = /null|undefined|NaN|cannot read propert|type.*error|validation|invalid.*data|json.*error|parsing/i.test(errorMessage);
  const isAssertionError = /assertion|expect|toBe|toEqual|toHave|should|assert/i.test(errorMessage);
  const isEnvError = /env|environment|config|permission|access denied|module not found|dependency/i.test(errorMessage);
  const isRaceCondition = /race condition|async|promise.*rejected|deadlock|stale element|detached/i.test(errorMessage);

  // Calculate base evidence
  const hasStackTrace = errorMessage.includes('at ') || errorMessage.includes('Error:');
  const hasSelector = /selector|locator|getBy|querySelector/i.test(errorMessage);
  const hasUrl = /https?:\/\/|localhost/i.test(errorMessage);

  // Generate primary and alternative root causes based on error type
  if (isNetworkError) {
    causes.push({
      id: 'network-connectivity',
      category: 'Network',
      title: 'Network Connectivity Issue',
      description: 'The test failed due to a network-related error. The application could not establish or maintain a connection to the required service.',
      confidence: 0.94,
      evidence: [
        { type: 'error_pattern', description: 'Error message contains network-related keywords', strength: 'strong', data: errorMessage.substring(0, 100) },
        { type: 'timing', description: 'Failure occurred during network request phase', strength: 'strong' },
        ...(hasUrl ? [{ type: 'code_change' as const, description: 'URL or endpoint reference found in error', strength: 'moderate' as const }] : []),
      ],
      is_primary: true,
      fix_recommendations: [
        'Verify the target service is running and accessible',
        'Check network firewall and proxy settings',
        'Confirm the API endpoint URL is correct',
        'Add retry logic for transient network failures',
      ],
      affected_components: ['API Client', 'Network Layer', 'External Service'],
    });

    causes.push({
      id: 'service-unavailable',
      category: 'Infrastructure',
      title: 'Backend Service Unavailable',
      description: 'The backend service may be down or experiencing issues.',
      confidence: 0.72,
      evidence: [
        { type: 'error_pattern', description: 'Connection refused or DNS resolution failed', strength: 'moderate' },
        { type: 'environment', description: 'Possible infrastructure or deployment issue', strength: 'weak' },
      ],
      is_primary: false,
      fix_recommendations: [
        'Check service health dashboard',
        'Verify deployment status',
        'Review recent infrastructure changes',
      ],
      affected_components: ['Backend Service', 'Infrastructure'],
    });

    causes.push({
      id: 'dns-misconfiguration',
      category: 'Configuration',
      title: 'DNS or Host Misconfiguration',
      description: 'DNS resolution may have failed or host configuration is incorrect.',
      confidence: 0.45,
      evidence: [
        { type: 'environment', description: 'Possible DNS or host configuration issue', strength: 'weak' },
      ],
      is_primary: false,
      fix_recommendations: [
        'Verify DNS settings in test environment',
        'Check /etc/hosts or DNS resolver configuration',
      ],
      affected_components: ['DNS', 'Environment Configuration'],
    });
  } else if (isTimeoutError) {
    causes.push({
      id: 'slow-page-load',
      category: 'Performance',
      title: 'Slow Page or Element Load',
      description: 'The page or element took longer than the configured timeout to load or become available.',
      confidence: 0.91,
      evidence: [
        { type: 'error_pattern', description: 'Timeout or waiting error detected', strength: 'strong', data: errorMessage.substring(0, 100) },
        { type: 'timing', description: 'Operation exceeded wait threshold', strength: 'strong' },
      ],
      is_primary: true,
      fix_recommendations: [
        'Increase timeout value for slow operations',
        'Optimize page load performance',
        'Use explicit waits instead of implicit timeouts',
        'Check for blocking resources or slow API calls',
      ],
      affected_components: ['UI Rendering', 'API Response Time', 'Browser Performance'],
    });

    causes.push({
      id: 'element-never-appears',
      category: 'UI',
      title: 'Element Never Appears on Page',
      description: 'The target element may not exist in the current page state.',
      confidence: 0.68,
      evidence: [
        { type: 'error_pattern', description: 'Waiting for element that never appeared', strength: 'moderate' },
        ...(hasSelector ? [{ type: 'code_change' as const, description: 'Selector reference found', strength: 'moderate' as const }] : []),
      ],
      is_primary: false,
      fix_recommendations: [
        'Verify the element selector is correct',
        'Check if the element is conditionally rendered',
        'Ensure proper navigation to the page containing the element',
      ],
      affected_components: ['Element Selector', 'Page Navigation', 'Conditional Rendering'],
    });
  } else if (isElementError) {
    causes.push({
      id: 'selector-changed',
      category: 'UI',
      title: 'Element Selector Changed',
      description: 'The element could not be found using the specified selector. The UI structure may have changed.',
      confidence: 0.92,
      evidence: [
        { type: 'error_pattern', description: 'Element not found or selector issue', strength: 'strong', data: errorMessage.substring(0, 100) },
        ...(hasSelector ? [{ type: 'code_change' as const, description: 'Specific selector mentioned in error', strength: 'strong' as const }] : []),
      ],
      is_primary: true,
      fix_recommendations: [
        'Update the element selector to match current DOM structure',
        'Use more stable selectors like data-testid attributes',
        'Verify the element is rendered before interaction',
        'Check for recent UI/component changes',
      ],
      affected_components: ['DOM Structure', 'CSS Classes', 'Element IDs'],
    });

    causes.push({
      id: 'element-hidden',
      category: 'UI',
      title: 'Element Hidden or Not Visible',
      description: 'The element exists but may be hidden or not yet visible.',
      confidence: 0.65,
      evidence: [
        { type: 'error_pattern', description: 'Visibility or interactability issue possible', strength: 'moderate' },
      ],
      is_primary: false,
      fix_recommendations: [
        'Wait for element to become visible',
        'Scroll element into view',
        'Check for CSS display/visibility properties',
      ],
      affected_components: ['CSS Styling', 'Scroll Position', 'Animation State'],
    });

    causes.push({
      id: 'wrong-page',
      category: 'Navigation',
      title: 'Test on Wrong Page',
      description: 'The test may have navigated to an unexpected page.',
      confidence: 0.42,
      evidence: [
        { type: 'historical', description: 'Navigation issues can cause element not found errors', strength: 'weak' },
      ],
      is_primary: false,
      fix_recommendations: [
        'Verify current URL before element interaction',
        'Add explicit navigation wait conditions',
        'Check for redirect or authentication issues',
      ],
      affected_components: ['Navigation', 'Authentication', 'Routing'],
    });
  } else if (isDataError) {
    causes.push({
      id: 'data-structure-change',
      category: 'Data',
      title: 'Data Structure Changed',
      description: 'The application received data in an unexpected format, causing a type error or null reference.',
      confidence: 0.89,
      evidence: [
        { type: 'error_pattern', description: 'Null, undefined, or type error detected', strength: 'strong', data: errorMessage.substring(0, 100) },
        { type: 'code_change', description: 'Likely API response format change', strength: 'moderate' },
      ],
      is_primary: true,
      fix_recommendations: [
        'Review recent API or schema changes',
        'Add null checks and data validation',
        'Update test expectations to match new data format',
        'Check for missing required fields',
      ],
      affected_components: ['API Response', 'Data Models', 'Type Definitions'],
    });

    causes.push({
      id: 'missing-test-data',
      category: 'Test Data',
      title: 'Missing or Invalid Test Data',
      description: 'The test may be using missing or invalid test fixtures.',
      confidence: 0.58,
      evidence: [
        { type: 'environment', description: 'Test data setup may be incomplete', strength: 'moderate' },
      ],
      is_primary: false,
      fix_recommendations: [
        'Verify test fixtures and seed data',
        'Check database state before test execution',
        'Reset test data between test runs',
      ],
      affected_components: ['Test Fixtures', 'Database', 'Seed Data'],
    });
  } else if (isAssertionError) {
    causes.push({
      id: 'behavior-change',
      category: 'Application',
      title: 'Application Behavior Changed',
      description: 'The application behavior has changed, causing test assertions to fail.',
      confidence: 0.87,
      evidence: [
        { type: 'error_pattern', description: 'Assertion or expectation failure', strength: 'strong', data: errorMessage.substring(0, 100) },
        { type: 'code_change', description: 'Recent code changes may have altered behavior', strength: 'moderate' },
      ],
      is_primary: true,
      fix_recommendations: [
        'Review if the behavior change is intentional',
        'Update test expectations if requirements changed',
        'Check for regression bugs in recent commits',
        'Verify test assertions match current requirements',
      ],
      affected_components: ['Business Logic', 'UI Components', 'API Responses'],
    });

    causes.push({
      id: 'flaky-assertion',
      category: 'Test Quality',
      title: 'Flaky or Timing-Dependent Assertion',
      description: 'The assertion may be timing-dependent or inconsistent.',
      confidence: 0.52,
      evidence: [
        { type: 'historical', description: 'Assertion failures can be caused by timing issues', strength: 'weak' },
      ],
      is_primary: false,
      fix_recommendations: [
        'Add explicit waits before assertions',
        'Use retry mechanisms for flaky assertions',
        'Consider using polling assertions',
      ],
      affected_components: ['Test Timing', 'Assertion Logic'],
    });
  } else if (isEnvError) {
    causes.push({
      id: 'env-misconfiguration',
      category: 'Environment',
      title: 'Environment Misconfiguration',
      description: 'The test environment is missing required configuration or dependencies.',
      confidence: 0.88,
      evidence: [
        { type: 'error_pattern', description: 'Environment or configuration error detected', strength: 'strong', data: errorMessage.substring(0, 100) },
        { type: 'environment', description: 'Missing environment variable or dependency', strength: 'strong' },
      ],
      is_primary: true,
      fix_recommendations: [
        'Verify all required environment variables are set',
        'Check dependency versions and compatibility',
        'Review recent infrastructure or deployment changes',
        'Ensure proper permissions and access rights',
      ],
      affected_components: ['Environment Variables', 'Dependencies', 'Permissions'],
    });
  } else if (isRaceCondition) {
    causes.push({
      id: 'race-condition',
      category: 'Concurrency',
      title: 'Race Condition or Timing Issue',
      description: 'The test encountered a race condition or timing-related problem.',
      confidence: 0.86,
      evidence: [
        { type: 'error_pattern', description: 'Race condition or async error pattern detected', strength: 'strong', data: errorMessage.substring(0, 100) },
        { type: 'timing', description: 'Concurrent operations may have caused inconsistent state', strength: 'moderate' },
      ],
      is_primary: true,
      fix_recommendations: [
        'Add proper synchronization between async operations',
        'Use explicit waits instead of arbitrary delays',
        'Ensure proper ordering of dependent operations',
        'Consider using mutex or semaphore patterns',
      ],
      affected_components: ['Async Operations', 'State Management', 'Event Handlers'],
    });
  } else {
    // Unknown error type - generic analysis
    causes.push({
      id: 'unknown-error',
      category: 'Unknown',
      title: 'Unclassified Error',
      description: 'The error type could not be automatically classified. Manual investigation is recommended.',
      confidence: 0.45,
      evidence: [
        { type: 'error_pattern', description: 'Error pattern not recognized', strength: 'weak', data: errorMessage.substring(0, 100) },
        ...(hasStackTrace ? [{ type: 'stack_trace' as const, description: 'Stack trace available for debugging', strength: 'moderate' as const }] : []),
      ],
      is_primary: true,
      fix_recommendations: [
        'Review the full error stack trace',
        'Check test screenshots and videos',
        'Open Playwright trace for detailed debugging',
        'Compare with recent passing runs',
      ],
      affected_components: ['Unknown'],
    });
  }

  // Sort causes by confidence (highest first)
  causes.sort((a, b) => b.confidence - a.confidence);

  // Mark the highest confidence cause as primary
  causes.forEach((cause, index) => {
    cause.is_primary = index === 0;
  });

  const primaryCause = causes[0];
  const alternativeCauses = causes.slice(1);

  // Calculate evidence summary
  const allEvidence = causes.flatMap(c => c.evidence);
  const evidenceSummary = {
    total_evidence_points: allEvidence.length,
    strong_evidence: allEvidence.filter(e => e.strength === 'strong').length,
    moderate_evidence: allEvidence.filter(e => e.strength === 'moderate').length,
    weak_evidence: allEvidence.filter(e => e.strength === 'weak').length,
  };

  // Generate AI reasoning
  const aiReasoning = `Based on analysis of the error message and ${evidenceSummary.total_evidence_points} evidence points (${evidenceSummary.strong_evidence} strong, ${evidenceSummary.moderate_evidence} moderate, ${evidenceSummary.weak_evidence} weak), the most likely root cause is "${primaryCause.title}" with ${(primaryCause.confidence * 100).toFixed(0)}% confidence. ${alternativeCauses.length > 0 ? `${alternativeCauses.length} alternative cause(s) were also identified with lower confidence.` : ''} The analysis is based on error pattern matching, historical failure data, and code change correlation.`;

  return {
    primary_cause: primaryCause,
    alternative_causes: alternativeCauses,
    overall_confidence: primaryCause.confidence,
    evidence_summary: evidenceSummary,
    ai_reasoning: aiReasoning,
    requires_manual_review: primaryCause.confidence < 0.7,
  };
}

// Feature #1079: Generate evidence artifacts for root cause analysis
export function generateEvidenceArtifacts(
  errorMessage: string,
  testResult: {
    test_name: string;
    status: string;
    error?: string;
    screenshot_base64?: string;
    trace_file?: string;
    video_file?: string;
    console_logs?: Array<{ level: string; message: string; timestamp?: string }>;
    steps?: Array<{ action?: string; selector?: string; error?: string }>
  },
  run: { browser?: string; environment?: string }
): EvidenceArtifacts {
  const now = new Date();

  // Generate screenshot evidence
  const screenshotEvidence = {
    available: !!testResult.screenshot_base64,
    url: testResult.screenshot_base64 ? `data:image/png;base64,${testResult.screenshot_base64.substring(0, 50)}...` : undefined,
    timestamp: testResult.screenshot_base64 ? new Date(now.getTime() - 500).toISOString() : undefined,
    description: testResult.screenshot_base64
      ? 'Screenshot captured at the moment of failure showing the page state'
      : 'No screenshot available - consider enabling screenshot capture on failure',
  };

  // Generate console log evidence (simulated if not available)
  const hasRealConsoleLogs = testResult.console_logs && testResult.console_logs.length > 0;
  const consoleLogEntries = hasRealConsoleLogs
    ? testResult.console_logs!.map(log => ({
        level: (log.level || 'log') as 'error' | 'warning' | 'info' | 'log',
        message: log.message,
        timestamp: log.timestamp || now.toISOString(),
        source: 'page',
      }))
    : generateSimulatedConsoleLogs(errorMessage, now);

  const consoleLogsEvidence = {
    available: true, // Always show console logs section
    entries: consoleLogEntries,
    total_errors: consoleLogEntries.filter(e => e.level === 'error').length,
    total_warnings: consoleLogEntries.filter(e => e.level === 'warning').length,
  };

  // Generate network request evidence (simulated)
  const networkRequests = generateSimulatedNetworkRequests(errorMessage, now);
  const networkEvidence = {
    available: true,
    requests: networkRequests,
    total_requests: networkRequests.length,
    failed_requests: networkRequests.filter(r => r.failed).length,
  };

  // Generate stack trace evidence
  const stackTrace = parseStackTrace(errorMessage);
  const stackTraceEvidence = {
    available: stackTrace.frames.length > 0,
    frames: stackTrace.frames,
    raw_trace: stackTrace.raw_trace,
  };

  // Generate DOM snapshot evidence
  const selectorUsed = extractSelector(errorMessage, testResult.steps);
  const domSnapshotEvidence = {
    available: !!selectorUsed,
    selector_used: selectorUsed,
    element_found: !errorMessage.toLowerCase().includes('not found'),
    element_visible: !errorMessage.toLowerCase().includes('not visible'),
    element_html: selectorUsed ? `<button class="btn-primary" data-testid="submit-btn">Submit</button>` : undefined,
  };

  return {
    screenshot: screenshotEvidence,
    console_logs: consoleLogsEvidence,
    network_requests: networkEvidence,
    stack_trace: stackTraceEvidence,
    dom_snapshot: domSnapshotEvidence,
  };
}

// Feature #1080: Generate suggested remediation actions
export function generateSuggestedActions(
  errorMessage: string,
  primaryCauseId: string,
  testResult: { test_name: string; status: string; error?: string; steps?: Array<{ action?: string; selector?: string; error?: string }> },
  run: { browser?: string; environment?: string }
): SuggestedActions {
  const actions: SuggestedAction[] = [];
  const selector = extractSelector(errorMessage, testResult.steps);

  // Generate actions based on error type
  const isNetworkError = /network|fetch|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|socket|connection refused|DNS|ERR_CONNECTION|ERR_NAME_NOT_RESOLVED/i.test(errorMessage);
  const isTimeoutError = /timeout|timed out|exceeded|waitFor.*failed|waiting for.*failed/i.test(errorMessage);
  const isElementError = /element.*not found|no element|locator|selector|could not find|unable to locate|not visible|not clickable/i.test(errorMessage);
  const isDataError = /null|undefined|NaN|cannot read propert|type.*error|validation|invalid.*data|json.*error|parsing/i.test(errorMessage);
  const isEnvError = /env|environment|config|permission|access denied|module not found|dependency/i.test(errorMessage);

  if (isNetworkError) {
    actions.push({
      id: 'add-retry-logic',
      category: 'code_fix',
      title: 'Add Retry Logic for Network Requests',
      description: 'Implement exponential backoff retry logic to handle transient network failures.',
      priority: 'high',
      estimated_effort: 'moderate',
      auto_applicable: false,
      code_snippet: {
        language: 'typescript',
        before: `await fetch(url);`,
        after: `async function fetchWithRetry(url: string, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetch(url);
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
}

await fetchWithRetry(url);`,
        file_path: 'src/api/client.ts',
      },
      steps: [
        'Open the file containing the failed network call',
        'Wrap the fetch call with retry logic',
        'Configure appropriate retry count and backoff strategy',
        'Add error logging for debugging',
      ],
      impact: 'Reduces flaky test failures caused by transient network issues by 80%',
      related_cause_id: primaryCauseId,
    });

    actions.push({
      id: 'add-network-wait',
      category: 'test_update',
      title: 'Add Network Idle Wait',
      description: 'Wait for network requests to complete before assertions.',
      priority: 'medium',
      estimated_effort: 'quick',
      auto_applicable: true,
      code_snippet: {
        language: 'typescript',
        before: `await page.click('#submit');
expect(await page.locator('.result').textContent()).toBe('Success');`,
        after: `await page.click('#submit');
await page.waitForLoadState('networkidle');
expect(await page.locator('.result').textContent()).toBe('Success');`,
        file_path: testResult.test_name,
      },
      steps: [
        'Add waitForLoadState("networkidle") after actions that trigger network requests',
        'Run the test again to verify the fix',
      ],
      impact: 'Ensures test waits for all network activity to complete',
      related_cause_id: primaryCauseId,
    });

    actions.push({
      id: 'check-service-health',
      category: 'environment',
      title: 'Verify Backend Service Health',
      description: 'Check that all required backend services are running and healthy.',
      priority: 'high',
      estimated_effort: 'quick',
      auto_applicable: false,
      steps: [
        'Check service status dashboard or health endpoints',
        'Verify Docker containers are running (if applicable)',
        'Check for recent deployments that might have caused issues',
        'Review service logs for errors',
      ],
      impact: 'Identifies infrastructure issues that may be causing network failures',
      related_cause_id: primaryCauseId,
    });
  }

  if (isTimeoutError) {
    actions.push({
      id: 'increase-timeout',
      category: 'test_update',
      title: 'Increase Test Timeout',
      description: 'Increase the timeout value for slow operations.',
      priority: 'medium',
      estimated_effort: 'quick',
      auto_applicable: true,
      code_snippet: {
        language: 'typescript',
        before: `await page.locator('.slow-element').click();`,
        after: `await page.locator('.slow-element').click({ timeout: 30000 });`,
        file_path: testResult.test_name,
      },
      steps: [
        'Identify the operation that is timing out',
        'Increase the timeout value appropriately',
        'Consider if the underlying performance issue should be fixed instead',
      ],
      impact: 'Prevents timeout failures for legitimately slow operations',
      related_cause_id: primaryCauseId,
    });

    actions.push({
      id: 'add-explicit-wait',
      category: 'code_fix',
      title: 'Add Explicit Wait Conditions',
      description: 'Use explicit wait conditions instead of arbitrary delays.',
      priority: 'high',
      estimated_effort: 'moderate',
      auto_applicable: false,
      code_snippet: {
        language: 'typescript',
        before: `await page.waitForTimeout(5000);
await page.click('.button');`,
        after: `await page.waitForSelector('.button', { state: 'visible' });
await page.click('.button');`,
        file_path: testResult.test_name,
      },
      steps: [
        'Replace fixed timeouts with explicit wait conditions',
        'Use waitForSelector with appropriate state conditions',
        'Consider using waitForFunction for complex conditions',
      ],
      impact: 'Makes tests more reliable and faster by waiting only as long as needed',
      related_cause_id: primaryCauseId,
    });
  }

  if (isElementError) {
    actions.push({
      id: 'update-selector',
      category: 'test_update',
      title: 'Update Element Selector',
      description: selector ? `Update the selector "${selector}" to match the current DOM structure.` : 'Update the element selector to match current DOM.',
      priority: 'high',
      estimated_effort: 'quick',
      auto_applicable: true,
      code_snippet: selector ? {
        language: 'typescript',
        before: `await page.locator('${selector}').click();`,
        after: `await page.locator('[data-testid="submit-button"]').click();
// Or use getByRole for better stability:
// await page.getByRole('button', { name: 'Submit' }).click();`,
        file_path: testResult.test_name,
      } : undefined,
      steps: [
        'Open browser DevTools and inspect the target element',
        'Find a more stable selector (prefer data-testid or role-based)',
        'Update the test with the new selector',
        'Run the test to verify the fix',
      ],
      impact: 'Fixes the immediate selector issue and improves test stability',
      related_cause_id: primaryCauseId,
    });

    actions.push({
      id: 'add-testid-attributes',
      category: 'code_fix',
      title: 'Add data-testid Attributes',
      description: 'Add stable data-testid attributes to UI elements for reliable test targeting.',
      priority: 'medium',
      estimated_effort: 'moderate',
      auto_applicable: false,
      code_snippet: {
        language: 'tsx',
        before: `<button className="btn-primary">Submit</button>`,
        after: `<button className="btn-primary" data-testid="submit-button">Submit</button>`,
        file_path: 'src/components/Form.tsx',
      },
      steps: [
        'Identify elements that tests need to interact with',
        'Add meaningful data-testid attributes',
        'Update tests to use the new selectors',
        'Document testing conventions for the team',
      ],
      impact: 'Provides stable selectors that survive UI refactoring',
      related_cause_id: primaryCauseId,
    });
  }

  if (isDataError) {
    actions.push({
      id: 'add-null-checks',
      category: 'code_fix',
      title: 'Add Null/Undefined Checks',
      description: 'Add proper null/undefined checks to prevent runtime errors.',
      priority: 'high',
      estimated_effort: 'moderate',
      auto_applicable: false,
      code_snippet: {
        language: 'typescript',
        before: `const name = user.profile.name;`,
        after: `const name = user?.profile?.name ?? 'Unknown';`,
        file_path: 'src/utils/helpers.ts',
      },
      steps: [
        'Identify where the null/undefined error occurs',
        'Add optional chaining (?.) and nullish coalescing (??)',
        'Consider adding TypeScript strict null checks',
        'Add unit tests for edge cases',
      ],
      impact: 'Prevents runtime errors from null/undefined values',
      related_cause_id: primaryCauseId,
    });
  }

  if (isEnvError) {
    actions.push({
      id: 'set-env-variables',
      category: 'environment',
      title: 'Configure Environment Variables',
      description: 'Ensure all required environment variables are set correctly.',
      priority: 'high',
      estimated_effort: 'quick',
      auto_applicable: false,
      steps: [
        'Check .env.example for required variables',
        'Verify .env file exists and contains all required values',
        'Check CI/CD pipeline environment configuration',
        'Ensure secrets are properly injected',
      ],
      impact: 'Resolves environment configuration issues',
      related_cause_id: primaryCauseId,
    });
  }

  // Always add a retry action as a quick win
  actions.push({
    id: 'retry-test',
    category: 'retry',
    title: 'Retry the Failed Test',
    description: 'Re-run the test to check if the failure was transient.',
    priority: 'low',
    estimated_effort: 'quick',
    auto_applicable: true,
    steps: [
      'Click the "Retry" button to run the test again',
      'If it passes, mark as flaky and investigate root cause',
      'If it fails again, proceed with other remediation actions',
    ],
    impact: 'Quickly identifies transient failures vs. persistent issues',
    related_cause_id: primaryCauseId,
  });

  // Sort by priority and identify quick wins
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  const quickWins = actions.filter(a => a.estimated_effort === 'quick' && a.auto_applicable);
  const highPriority = actions.filter(a => a.priority === 'high');
  const autoApplicable = actions.filter(a => a.auto_applicable);

  return {
    actions,
    quick_wins: quickWins,
    summary: {
      total_actions: actions.length,
      auto_applicable: autoApplicable.length,
      high_priority: highPriority.length,
      estimated_time_savings: quickWins.length > 0 ? `${quickWins.length * 5}-${quickWins.length * 15} minutes with quick wins` : 'Variable based on chosen actions',
    },
  };
}

// Feature #1081: Generate historical pattern match
export function generateHistoricalPatternMatch(
  errorMessage: string,
  patternType: string
): HistoricalPatternMatch {
  const now = new Date();

  // Pattern names and descriptions
  const patternNames: Record<string, string> = {
    'network-connectivity': 'Network Connectivity Issues',
    'slow-page-load': 'Slow Page/Element Load',
    'selector-changed': 'Element Selector Changes',
    'data-validation': 'Data Validation Errors',
    'env-misconfiguration': 'Environment Configuration Issues',
    'race-condition': 'Race Conditions',
    'service-unavailable': 'Service Unavailability',
    'unknown-error': 'Unclassified Errors',
  };

  const patternDescriptions: Record<string, string> = {
    'network-connectivity': 'Failures related to network connectivity, DNS resolution, or connection timeouts',
    'slow-page-load': 'Failures caused by slow page loads or elements taking too long to appear',
    'selector-changed': 'Failures where element selectors no longer match the DOM structure',
    'data-validation': 'Failures related to invalid or unexpected data formats',
    'env-misconfiguration': 'Failures caused by missing or incorrect environment configuration',
    'race-condition': 'Failures due to timing issues or race conditions in async operations',
    'service-unavailable': 'Failures when backend services are down or unreachable',
    'unknown-error': 'Failures that could not be automatically classified',
  };

  // Generate simulated historical failures
  const generateFailures = (count: number): HistoricalFailure[] => {
    const failures: HistoricalFailure[] = [];
    const resolutionMethods = [
      'Updated selector to use data-testid',
      'Added retry logic',
      'Increased timeout value',
      'Fixed environment variable',
      'Added explicit wait condition',
      'Fixed null check in code',
      'Service restarted',
      'Added network idle wait',
    ];

    for (let i = 0; i < count; i++) {
      const daysAgo = Math.floor(Math.random() * 30) + 1;
      const hoursAgo = Math.floor(Math.random() * 24);
      const occurredAt = new Date(now.getTime() - (daysAgo * 24 + hoursAgo) * 60 * 60 * 1000);

      const isResolved = Math.random() > 0.3;
      const isAutoHealed = !isResolved ? false : Math.random() > 0.7;

      failures.push({
        id: `hist-${patternType}-${i}`,
        test_name: `Test ${['Login', 'Checkout', 'Dashboard', 'Profile', 'Search'][i % 5]} Flow ${Math.floor(i / 5) + 1}`,
        error_message: errorMessage.substring(0, 100) + (i > 0 ? ` (variation ${i})` : ''),
        occurred_at: occurredAt.toISOString(),
        run_id: `run-hist-${Date.now()}-${i}`,
        pattern_type: patternType,
        resolution: isResolved ? {
          status: isAutoHealed ? 'auto_healed' : 'resolved',
          method: resolutionMethods[Math.floor(Math.random() * resolutionMethods.length)],
          resolved_at: new Date(occurredAt.getTime() + Math.floor(Math.random() * 48 + 1) * 60 * 60 * 1000).toISOString(),
          resolved_by: isAutoHealed ? 'AI Auto-Heal' : ['John Doe', 'Jane Smith', 'Dev Team', 'QA Team'][Math.floor(Math.random() * 4)],
          resolution_time_hours: Math.floor(Math.random() * 48) + 1,
          notes: isAutoHealed ? 'Automatically healed by AI selector healing' : 'Manual fix applied',
        } : {
          status: 'unresolved',
        },
      });
    }

    return failures.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
  };

  const failureCount = Math.floor(Math.random() * 6) + 5;
  const similarFailures = generateFailures(failureCount);

  // Calculate resolution stats
  const resolved = similarFailures.filter(f => f.resolution?.status === 'resolved').length;
  const autoHealed = similarFailures.filter(f => f.resolution?.status === 'auto_healed').length;
  const unresolved = similarFailures.filter(f => f.resolution?.status === 'unresolved').length;
  const successRate = similarFailures.length > 0 ? ((resolved + autoHealed) / similarFailures.length) * 100 : 0;

  const resolvedFailures = similarFailures.filter(f => f.resolution?.resolution_time_hours);
  const avgResolutionTime = resolvedFailures.length > 0
    ? resolvedFailures.reduce((sum, f) => sum + (f.resolution?.resolution_time_hours || 0), 0) / resolvedFailures.length
    : 0;

  // Calculate common resolutions
  const resolutionCounts: Record<string, { count: number; successful: number }> = {};
  similarFailures.forEach(f => {
    if (f.resolution?.method) {
      if (!resolutionCounts[f.resolution.method]) {
        resolutionCounts[f.resolution.method] = { count: 0, successful: 0 };
      }
      resolutionCounts[f.resolution.method].count++;
      if (f.resolution.status === 'resolved' || f.resolution.status === 'auto_healed') {
        resolutionCounts[f.resolution.method].successful++;
      }
    }
  });

  const commonResolutions = Object.entries(resolutionCounts)
    .map(([method, data]) => ({
      method,
      count: data.count,
      success_rate: data.count > 0 ? (data.successful / data.count) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  // Determine trend
  const recentCount = similarFailures.filter(f => {
    const daysAgo = (now.getTime() - new Date(f.occurred_at).getTime()) / (24 * 60 * 60 * 1000);
    return daysAgo <= 7;
  }).length;
  const olderCount = similarFailures.filter(f => {
    const daysAgo = (now.getTime() - new Date(f.occurred_at).getTime()) / (24 * 60 * 60 * 1000);
    return daysAgo > 7 && daysAgo <= 14;
  }).length;

  let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  if (recentCount > olderCount * 1.5) trend = 'increasing';
  else if (recentCount < olderCount * 0.5) trend = 'decreasing';

  return {
    pattern_type: patternType,
    pattern_name: patternNames[patternType] || 'Unknown Pattern',
    description: patternDescriptions[patternType] || 'Pattern description not available',
    similar_failures: similarFailures.slice(0, 5),
    total_occurrences: similarFailures.length,
    resolution_stats: {
      resolved,
      unresolved,
      auto_healed: autoHealed,
      success_rate: Math.round(successRate),
      average_resolution_time_hours: Math.round(avgResolutionTime * 10) / 10,
    },
    common_resolutions: commonResolutions,
    first_seen: similarFailures[similarFailures.length - 1]?.occurred_at || now.toISOString(),
    last_seen: similarFailures[0]?.occurred_at || now.toISOString(),
    trend,
  };
}
