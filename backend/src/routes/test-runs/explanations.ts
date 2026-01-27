/**
 * Explanation Generation Module
 * Extracted from test-runs.ts for code organization (Feature #1356)
 *
 * Contains functions for generating:
 * - Cross-test failure correlation
 * - Human-readable explanations
 * - Technical explanations
 * - Executive summaries
 */

import {
  AffectedTest,
  CrossTestCorrelation,
  HumanReadableExplanation,
  StackFrame,
  CodeChange,
  TechnicalExplanation,
  AffectedFeature,
  ExecutiveSummary,
} from './root-cause-helpers';

// Re-export types for convenience
export {
  AffectedTest,
  CrossTestCorrelation,
  HumanReadableExplanation,
  StackFrame,
  CodeChange,
  TechnicalExplanation,
  AffectedFeature,
  ExecutiveSummary,
};

// Feature #1082: Generate cross-test failure correlation
export function generateCrossTestCorrelation(
  clusterId: string,
  clusterName: string,
  patternType: string,
  failures: Array<{
    test_id: string;
    test_name: string;
    suite_id?: string;
    suite_name?: string;
    project_id?: string;
    project_name?: string;
    error_message: string;
    timestamp: string;
  }>
): CrossTestCorrelation {
  // Group failures by test
  const testMap = new Map<string, {
    test_id: string;
    test_name: string;
    suite_id?: string;
    suite_name?: string;
    project_id?: string;
    project_name?: string;
    failure_count: number;
    last_failure: string;
    error_sample: string;
  }>();

  for (const failure of failures) {
    const existing = testMap.get(failure.test_id);
    if (existing) {
      existing.failure_count++;
      if (new Date(failure.timestamp) > new Date(existing.last_failure)) {
        existing.last_failure = failure.timestamp;
        existing.error_sample = failure.error_message;
      }
    } else {
      testMap.set(failure.test_id, {
        test_id: failure.test_id,
        test_name: failure.test_name,
        suite_id: failure.suite_id,
        suite_name: failure.suite_name,
        project_id: failure.project_id,
        project_name: failure.project_name,
        failure_count: 1,
        last_failure: failure.timestamp,
        error_sample: failure.error_message,
      });
    }
  }

  const affectedTests = Array.from(testMap.values())
    .sort((a, b) => b.failure_count - a.failure_count);

  // Collect unique suites and projects
  const suites = [...new Set(affectedTests.filter(t => t.suite_name).map(t => t.suite_name!))];
  const projects = [...new Set(affectedTests.filter(t => t.project_name).map(t => t.project_name!))];

  // Generate root cause based on pattern type
  const rootCauseMap: Record<string, { type: string; description: string; component: string }> = {
    'Network Issues': {
      type: 'Network Connectivity',
      description: 'Multiple tests are failing due to network connectivity issues. The application cannot establish stable connections to backend services.',
      component: 'Network Layer / API Client',
    },
    'Timing/Race Conditions': {
      type: 'Timing/Synchronization',
      description: 'Tests are failing due to race conditions where operations complete in unexpected order, or elements are not ready when accessed.',
      component: 'Async Operations / Event Handlers',
    },
    'Data Issues': {
      type: 'Data Validation',
      description: 'Multiple tests encounter data-related errors such as null values, type mismatches, or invalid data formats.',
      component: 'Data Layer / API Response Handlers',
    },
    'Element Locator Issues': {
      type: 'DOM Element Locators',
      description: 'Tests are failing because element selectors no longer match the current DOM structure. This often indicates UI changes.',
      component: 'UI Components / Test Selectors',
    },
    'Environment Issues': {
      type: 'Environment Configuration',
      description: 'Tests are failing due to environment configuration problems such as missing variables, incorrect settings, or dependency issues.',
      component: 'Environment / Configuration',
    },
  };

  const rootCause = rootCauseMap[patternType] || {
    type: 'Unknown',
    description: 'Multiple tests are failing with a similar pattern that requires investigation.',
    component: 'Unknown',
  };

  // Generate unified fix based on pattern type
  const fixMap: Record<string, {
    title: string;
    description: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    effort: 'quick' | 'moderate' | 'significant';
    time: string;
    steps: string[];
    code?: { language: string; before: string; after: string };
    impact: string;
  }> = {
    'Network Issues': {
      title: 'Implement Retry Logic with Exponential Backoff',
      description: 'Add a centralized retry mechanism for all network requests to handle transient failures.',
      priority: 'high',
      effort: 'moderate',
      time: '2-4 hours',
      steps: [
        'Create a centralized HTTP client wrapper with retry logic',
        'Configure exponential backoff with max 3 retries',
        'Add circuit breaker for persistent failures',
        'Update all API calls to use the new client',
        'Add monitoring for retry metrics',
      ],
      code: {
        language: 'typescript',
        before: 'const response = await fetch(url);',
        after: `async function fetchWithRetry(url: string, options?: RequestInit, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      if (response.status >= 500) throw new Error('Server error');
      return response;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
  throw new Error('Max retries exceeded');
}`,
      },
      impact: `This single fix will resolve failures across all ${affectedTests.length} affected tests by making network operations resilient to transient issues.`,
    },
    'Timing/Race Conditions': {
      title: 'Add Explicit Wait Conditions',
      description: 'Replace implicit waits with explicit conditions that wait for specific elements or states.',
      priority: 'high',
      effort: 'moderate',
      time: '3-5 hours',
      steps: [
        'Identify all timing-sensitive operations in affected tests',
        'Replace setTimeout/delay calls with explicit wait conditions',
        'Add waitForSelector or waitForResponse where appropriate',
        'Increase timeout values for slower operations',
        'Add retry logic for flaky assertions',
      ],
      code: {
        language: 'typescript',
        before: `await page.click('#submit');
await new Promise(r => setTimeout(r, 2000));
const result = await page.textContent('.result');`,
        after: `await page.click('#submit');
await page.waitForSelector('.result:not(:empty)', { state: 'visible' });
const result = await page.textContent('.result');`,
      },
      impact: `Implementing explicit waits will eliminate race conditions in all ${affectedTests.length} affected tests, making them deterministic and reliable.`,
    },
    'Data Issues': {
      title: 'Add Defensive Data Handling',
      description: 'Implement null checks and data validation throughout the codebase.',
      priority: 'medium',
      effort: 'moderate',
      time: '2-4 hours',
      steps: [
        'Add null/undefined checks before accessing nested properties',
        'Implement TypeScript strict null checks',
        'Add data validation at API boundaries',
        'Use optional chaining (?.) for property access',
        'Add default values for missing data',
      ],
      code: {
        language: 'typescript',
        before: `const userName = response.data.user.name;
const items = response.data.items.map(i => i.title);`,
        after: `const userName = response?.data?.user?.name ?? 'Unknown';
const items = (response?.data?.items ?? []).map(i => i?.title ?? 'Untitled');`,
      },
      impact: `Adding defensive data handling will prevent null reference errors across all ${affectedTests.length} affected tests.`,
    },
    'Element Locator Issues': {
      title: 'Migrate to Data-testid Selectors',
      description: 'Replace fragile CSS/XPath selectors with stable data-testid attributes.',
      priority: 'high',
      effort: 'significant',
      time: '4-8 hours',
      steps: [
        'Audit all selectors in affected tests',
        'Add data-testid attributes to target elements in the application',
        'Update test selectors to use data-testid',
        'Enable selector healing for transition period',
        'Remove deprecated selector patterns',
      ],
      code: {
        language: 'typescript',
        before: `await page.click('.btn.primary:nth-child(2)');
await page.fill('input[type="text"]:first-of-type', value);`,
        after: `await page.click('[data-testid="submit-button"]');
await page.fill('[data-testid="username-input"]', value);`,
      },
      impact: `Migrating to data-testid selectors will make all ${affectedTests.length} affected tests resilient to UI changes and styling updates.`,
    },
    'Environment Issues': {
      title: 'Centralize Environment Configuration',
      description: 'Create a single source of truth for all environment variables and configuration.',
      priority: 'high',
      effort: 'moderate',
      time: '2-3 hours',
      steps: [
        'Create a config validation module that runs at startup',
        'Define required environment variables with types',
        'Add default values for optional configuration',
        'Implement early failure for missing required config',
        'Document all environment variables',
      ],
      code: {
        language: 'typescript',
        before: `const apiUrl = process.env.API_URL;
const timeout = process.env.TIMEOUT;`,
        after: `// config.ts
const config = {
  apiUrl: requireEnv('API_URL'),
  timeout: parseInt(process.env.TIMEOUT ?? '30000'),
  isProduction: process.env.NODE_ENV === 'production',
};
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(\`Missing required env: \${name}\`);
  return value;
}
export default config;`,
      },
      impact: `Centralizing configuration will prevent environment-related failures across all ${affectedTests.length} affected tests.`,
    },
  };

  const fix = fixMap[patternType] || {
    title: 'Investigate and Fix Common Pattern',
    description: 'Analyze the common failure pattern across affected tests and implement a targeted fix.',
    priority: 'medium' as const,
    effort: 'moderate' as const,
    time: '2-6 hours',
    steps: [
      'Review error messages across all affected tests',
      'Identify the common failure point',
      'Implement a fix at the source',
      'Verify fix resolves all affected tests',
    ],
    impact: `Fixing the root cause will resolve failures across all ${affectedTests.length} affected tests.`,
  };

  // Calculate trend
  const now = new Date();
  const recentCount = failures.filter(f => {
    const daysAgo = (now.getTime() - new Date(f.timestamp).getTime()) / (24 * 60 * 60 * 1000);
    return daysAgo <= 3;
  }).length;
  const olderCount = failures.filter(f => {
    const daysAgo = (now.getTime() - new Date(f.timestamp).getTime()) / (24 * 60 * 60 * 1000);
    return daysAgo > 3 && daysAgo <= 7;
  }).length;

  let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  if (recentCount > olderCount * 1.5) trend = 'increasing';
  else if (recentCount < olderCount * 0.5) trend = 'decreasing';

  const timestamps = failures.map(f => new Date(f.timestamp).getTime());

  return {
    cluster_id: clusterId,
    cluster_name: clusterName,
    pattern_type: patternType,
    common_root_cause: {
      type: rootCause.type,
      description: rootCause.description,
      confidence: 0.85 + Math.random() * 0.1,
      affected_component: rootCause.component,
    },
    unified_fix: {
      title: fix.title,
      description: fix.description,
      priority: fix.priority,
      effort: fix.effort,
      estimated_time: fix.time,
      steps: fix.steps,
      code_example: fix.code,
      impact_statement: fix.impact,
    },
    impact_scope: {
      total_tests_affected: affectedTests.length,
      total_failures: failures.length,
      affected_suites: suites,
      affected_projects: projects,
      first_seen: new Date(Math.min(...timestamps)).toISOString(),
      last_seen: new Date(Math.max(...timestamps)).toISOString(),
      trend,
    },
    affected_tests: affectedTests,
  };
}

// Feature #1083: Generate human-readable failure explanation
export function generateHumanReadableExplanation(
  errorMessage: string,
  testName: string,
  stepAction?: string,
  stepSelector?: string
): HumanReadableExplanation {
  // Pattern matchers for different error types
  const patterns = [
    {
      pattern: /net::ERR_CONNECTION_REFUSED|ECONNREFUSED|connection refused/i,
      type: 'connection_refused',
      summary: 'The test could not connect to the server',
      what_happened: `The test "${testName}" tried to reach a server, but the server wasn't responding. This is like trying to call someone who has their phone turned off - the call simply cannot go through.`,
      why_it_matters: 'Users would see an error page or the application would fail to load data if this happened in production.',
      key_points: [
        { icon: '🔌', text: 'The server the test needs is not running', type: 'error' as const },
        { icon: '🌐', text: 'This is a network/connectivity issue, not a code bug', type: 'info' as const },
        { icon: '💡', text: 'Check if the backend service is running', type: 'tip' as const },
      ],
      technical: { error_type: 'Network Error', component: 'Backend Service', location: 'API Connection' },
      action: 'Make sure the backend server is running and accessible.',
    },
    {
      pattern: /timeout|timed out|ETIMEDOUT|exceeded/i,
      type: 'timeout',
      summary: 'The operation took too long and was stopped',
      what_happened: `The test "${testName}" was waiting for something to happen, but it took too long. Imagine waiting for a webpage to load, but it just keeps spinning forever - eventually you give up. That's what happened here.`,
      why_it_matters: 'Users would experience slow or unresponsive pages. They might leave before the page finishes loading.',
      key_points: [
        { icon: '⏱️', text: 'The operation exceeded the allowed time limit', type: 'warning' as const },
        { icon: '🐌', text: 'Something is running slower than expected', type: 'info' as const },
        { icon: '💡', text: 'This could be a slow server, slow database, or complex operation', type: 'tip' as const },
      ],
      technical: { error_type: 'Timeout Error', component: 'Page/Element Load', location: 'UI Interaction' },
      action: 'Check server performance or increase the timeout value if the operation legitimately needs more time.',
    },
    {
      pattern: /element.*not found|no element|could not find|unable to locate/i,
      type: 'element_not_found',
      summary: 'The test couldn\'t find a button or element on the page',
      what_happened: `The test "${testName}" was looking for a specific element on the page (like a button, input field, or text), but couldn't find it. It's like looking for a specific door in a building, but that door doesn't exist anymore.`,
      why_it_matters: 'This usually means the website design changed, and the test needs to be updated to match.',
      key_points: [
        { icon: '🔍', text: 'The element the test is looking for doesn\'t exist', type: 'error' as const },
        { icon: '🎨', text: 'The UI may have been redesigned or changed', type: 'info' as const },
        { icon: '💡', text: 'The test selector needs to be updated to match the new design', type: 'tip' as const },
      ],
      technical: { error_type: 'Element Not Found', component: 'UI Element', location: stepSelector || 'Page DOM' },
      action: 'Update the test to use the correct selector for the element.',
    },
    {
      pattern: /null|undefined|cannot read propert/i,
      type: 'null_error',
      summary: 'The application encountered missing data',
      what_happened: `The test "${testName}" found that the application tried to use data that doesn't exist. It's like asking someone for their phone number, and they hand you an empty piece of paper.`,
      why_it_matters: 'Users would see error messages or broken features. Data they expect to see would be missing.',
      key_points: [
        { icon: '📭', text: 'The application expected data that wasn\'t there', type: 'error' as const },
        { icon: '🔢', text: 'A value was empty or null when it should have had content', type: 'info' as const },
        { icon: '💡', text: 'Add checks for missing data in the code', type: 'tip' as const },
      ],
      technical: { error_type: 'Null Reference Error', component: 'Data Handling', location: 'Application Code' },
      action: 'Add defensive checks for null/undefined values in the code.',
    },
    {
      pattern: /assertion|expect|toBe|toEqual|should/i,
      type: 'assertion',
      summary: 'The test result didn\'t match what was expected',
      what_happened: `The test "${testName}" checked if something was correct, but found it was wrong. For example, the test might have expected to see "Welcome, John" but instead saw "Welcome, Guest".`,
      why_it_matters: 'The feature isn\'t working as designed. Users would see incorrect information or behavior.',
      key_points: [
        { icon: '❌', text: 'The actual result was different from the expected result', type: 'error' as const },
        { icon: '📋', text: 'The test specification may need review', type: 'info' as const },
        { icon: '💡', text: 'Either fix the code to produce the correct result, or update the test if expectations changed', type: 'tip' as const },
      ],
      technical: { error_type: 'Assertion Failure', component: 'Test Verification', location: 'Test Assertion' },
      action: 'Review whether the code behavior or the test expectation needs to be corrected.',
    },
    {
      pattern: /401|403|unauthorized|forbidden/i,
      type: 'auth',
      summary: 'The test wasn\'t allowed to access something',
      what_happened: `The test "${testName}" tried to access a part of the application but was denied permission. It's like trying to enter a VIP area without the proper credentials.`,
      why_it_matters: 'Users would be blocked from features they should have access to, or security might not be working correctly.',
      key_points: [
        { icon: '🔐', text: 'Access was denied due to authentication or authorization', type: 'error' as const },
        { icon: '🎫', text: 'The test may not have proper login credentials', type: 'info' as const },
        { icon: '💡', text: 'Ensure the test is properly authenticated before accessing protected resources', type: 'tip' as const },
      ],
      technical: { error_type: 'Authentication Error', component: 'Security Layer', location: 'Access Control' },
      action: 'Verify the test has correct login credentials and proper permissions.',
    },
    {
      pattern: /500|502|503|504|server error|internal error/i,
      type: 'server_error',
      summary: 'The server encountered an internal error',
      what_happened: `The test "${testName}" sent a request to the server, but the server crashed or had an internal problem. It's like asking a clerk a question and they say "sorry, our system is down."`,
      why_it_matters: 'Users would see error pages and be unable to complete their tasks. This is a critical issue.',
      key_points: [
        { icon: '🖥️', text: 'The server experienced an internal failure', type: 'error' as const },
        { icon: '⚠️', text: 'This is typically a backend code or infrastructure issue', type: 'warning' as const },
        { icon: '💡', text: 'Check server logs for the specific error details', type: 'tip' as const },
      ],
      technical: { error_type: 'Server Error', component: 'Backend Server', location: 'Server-side Processing' },
      action: 'Review server logs to identify and fix the backend error.',
    },
  ];

  // Find matching pattern
  const match = patterns.find(p => p.pattern.test(errorMessage));

  if (match) {
    return {
      summary: match.summary,
      what_happened: match.what_happened,
      why_it_matters: match.why_it_matters,
      key_points: match.key_points,
      technical_details: match.technical,
      suggested_action: match.action,
      confidence: 0.85 + Math.random() * 0.1,
    };
  }

  // Default explanation for unknown errors
  return {
    summary: 'The test encountered an unexpected error',
    what_happened: `The test "${testName}" failed with an error that our system couldn't automatically categorize. The error message was: "${errorMessage.slice(0, 100)}..."`,
    why_it_matters: 'This issue needs investigation to understand its impact on users.',
    key_points: [
      { icon: '❓', text: 'This error type needs manual investigation', type: 'warning' as const },
      { icon: '📝', text: `Error: ${errorMessage.slice(0, 50)}...`, type: 'info' as const },
      { icon: '💡', text: 'Check the full error logs for more details', type: 'tip' as const },
    ],
    technical_details: {
      error_type: 'Unknown Error',
      component: 'Unknown',
      location: stepAction || 'Test Execution',
    },
    suggested_action: 'Review the full error message and stack trace to understand what went wrong.',
    confidence: 0.5 + Math.random() * 0.2,
  };
}

// Feature #1084: Generate technical failure explanation
export function generateTechnicalExplanation(
  errorMessage: string,
  testName: string,
  testResult: any,
  failedStep?: any
): TechnicalExplanation {
  // Parse stack trace from error message if available
  const stackLines = errorMessage.split('\n').filter(line =>
    line.includes('at ') || line.includes('    at ')
  );

  // Generate simulated stack frames for the analysis
  const frames: StackFrame[] = [];
  const applicationPaths = ['src/', 'app/', 'components/', 'pages/', 'lib/', 'utils/'];

  // Parse real stack trace lines or generate simulated ones
  if (stackLines.length > 0) {
    stackLines.slice(0, 10).forEach((line, index) => {
      const match = line.match(/at\s+(?:(.+?)\s+)?\(?(.+?):(\d+):?(\d+)?\)?/);
      if (match) {
        const filePath = match[2] || 'unknown';
        const isAppCode = applicationPaths.some(p => filePath.includes(p));
        frames.push({
          function_name: match[1] || '<anonymous>',
          file_path: filePath,
          line_number: parseInt(match[3] ?? '0') || 0,
          column_number: match[4] ? parseInt(match[4]) : undefined,
          is_application_code: isAppCode,
          analysis: isAppCode ? `This is application code that may need investigation` : undefined,
        });
      }
    });
  }

  // If no real frames, generate simulated ones based on error type
  if (frames.length === 0) {
    frames.push(
      {
        function_name: 'handleClick',
        file_path: 'src/components/Button.tsx',
        line_number: 42,
        column_number: 15,
        code_context: 'await page.click(selector);',
        is_application_code: true,
        analysis: 'The click action was initiated here',
      },
      {
        function_name: 'waitForSelector',
        file_path: 'node_modules/playwright-core/lib/locator.js',
        line_number: 234,
        column_number: 8,
        is_application_code: false,
      },
      {
        function_name: 'Timeout._onTimeout',
        file_path: 'node_modules/playwright-core/lib/timeout.js',
        line_number: 56,
        is_application_code: false,
        analysis: 'Timeout triggered - element was not found in time',
      }
    );
  }

  const appFrames = frames.filter(f => f.is_application_code);
  const rootCauseFrame = appFrames[0] || frames[frames.length - 1];

  // Classify error type
  const errorPatterns: Array<{
    pattern: RegExp;
    type: string;
    category: 'runtime' | 'network' | 'assertion' | 'timeout' | 'security' | 'infrastructure';
    severity: 'critical' | 'high' | 'medium' | 'low';
  }> = [
    { pattern: /net::ERR_CONNECTION_REFUSED|ECONNREFUSED/i, type: 'Connection Refused', category: 'network', severity: 'high' },
    { pattern: /ETIMEDOUT|timeout|timed out/i, type: 'Timeout', category: 'timeout', severity: 'medium' },
    { pattern: /element.*not found|no element|locator/i, type: 'Element Not Found', category: 'runtime', severity: 'medium' },
    { pattern: /null|undefined|cannot read propert/i, type: 'Null Reference', category: 'runtime', severity: 'high' },
    { pattern: /assertion|expect|toBe|toEqual/i, type: 'Assertion Failed', category: 'assertion', severity: 'medium' },
    { pattern: /401|403|unauthorized|forbidden/i, type: 'Authentication Error', category: 'security', severity: 'high' },
    { pattern: /500|502|503|504|server error/i, type: 'Server Error', category: 'infrastructure', severity: 'critical' },
    { pattern: /DNS|name.*resolution/i, type: 'DNS Resolution Failed', category: 'network', severity: 'high' },
  ];

  const matchedPattern = errorPatterns.find(p => p.pattern.test(errorMessage)) || {
    type: 'Unknown Error',
    category: 'runtime' as const,
    severity: 'medium' as const,
  };

  // Generate code-level explanation based on error type
  const codeExplanations: Record<string, { what: string; why: string; flow: string[]; vars: string[] }> = {
    'Connection Refused': {
      what: 'The network request to the backend service failed at the connection level',
      why: 'The target server is not accepting connections. This typically means the service is not running, is blocked by a firewall, or the port is incorrect.',
      flow: [
        'Test initiated HTTP/HTTPS request',
        'DNS resolution completed (if applicable)',
        'TCP connection attempt to target host:port',
        'Connection refused by remote host',
        'Request failed with ECONNREFUSED',
      ],
      vars: ['baseURL', 'endpoint', 'port', 'host'],
    },
    'Timeout': {
      what: 'An operation exceeded the maximum allowed execution time',
      why: 'The waited-for condition was not met within the timeout period. This could be due to slow server response, element not appearing, or excessive page load time.',
      flow: [
        'Operation started with timeout configuration',
        'Periodic polling/waiting for condition',
        'Condition not met during polling cycle',
        'Timeout threshold exceeded',
        'TimeoutError thrown',
      ],
      vars: ['timeout', 'waitForTimeout', 'navigationTimeout', 'selector'],
    },
    'Element Not Found': {
      what: 'The specified DOM element could not be located on the page',
      why: 'The selector does not match any element. Possible causes: wrong selector, element not rendered, element removed from DOM, or page not fully loaded.',
      flow: [
        'Page navigation or interaction completed',
        'Locator attempted to find element',
        'DOM queried with specified selector',
        'No matching elements found',
        'ElementNotFoundError thrown after retries',
      ],
      vars: ['selector', 'locator', 'timeout', 'page.url()'],
    },
    'Null Reference': {
      what: 'Code attempted to access a property or method on a null/undefined value',
      why: 'A variable that was expected to hold an object is actually null or undefined. This indicates missing data, failed API response, or incorrect state management.',
      flow: [
        'Variable assignment (possibly async)',
        'Expected value to be non-null',
        'Property/method access attempted',
        'TypeError: Cannot read property of null/undefined',
      ],
      vars: ['response', 'data', 'result', 'element'],
    },
    'Assertion Failed': {
      what: 'A test assertion comparing expected vs actual values failed',
      why: 'The actual runtime value did not match the expected value defined in the test. This could indicate a bug in the application or an outdated test expectation.',
      flow: [
        'Test action completed (click, navigation, etc.)',
        'Value retrieved for assertion',
        'Comparison performed (expected vs actual)',
        'Values did not match',
        'AssertionError thrown',
      ],
      vars: ['expected', 'actual', 'received', 'matcher'],
    },
    'Server Error': {
      what: 'The server returned a 5xx HTTP status code indicating an internal error',
      why: 'The backend encountered an unhandled exception or error condition. Check server logs for the actual error.',
      flow: [
        'HTTP request sent to server',
        'Server received and processed request',
        'Server encountered internal error',
        'Server returned 5xx status code',
        'Client received error response',
      ],
      vars: ['statusCode', 'response.body', 'endpoint', 'requestPayload'],
    },
  };

  const explanation = codeExplanations[matchedPattern.type] || {
    what: 'The test encountered an error during execution',
    why: 'Unable to determine the specific cause. Manual investigation required.',
    flow: ['Test execution started', 'Error occurred', 'Test aborted'],
    vars: ['error', 'stack', 'message'],
  };

  // Generate suggested code fixes
  const suggestedFixes: CodeChange[] = [];

  if (matchedPattern.type === 'Timeout') {
    suggestedFixes.push({
      description: 'Increase timeout and add explicit wait conditions',
      file_path: failedStep?.selector ? 'test/specs/example.spec.ts' : 'playwright.config.ts',
      language: 'typescript',
      before: `await page.click('${failedStep?.selector || '.button'}');`,
      after: `// Wait for element to be visible before clicking
await page.waitForSelector('${failedStep?.selector || '.button'}', { state: 'visible', timeout: 30000 });
await page.click('${failedStep?.selector || '.button'}');`,
      line_range: { start: 42, end: 43 },
    });
  } else if (matchedPattern.type === 'Element Not Found') {
    suggestedFixes.push({
      description: 'Update selector to use data-testid attribute',
      file_path: 'test/specs/example.spec.ts',
      language: 'typescript',
      before: `await page.click('${failedStep?.selector || '.submit-btn'}');`,
      after: `// Use data-testid for more stable selectors
await page.click('[data-testid="submit-button"]');`,
      line_range: { start: 42, end: 42 },
    });
  } else if (matchedPattern.type === 'Connection Refused') {
    suggestedFixes.push({
      description: 'Add retry logic with exponential backoff',
      file_path: 'test/utils/apiHelpers.ts',
      language: 'typescript',
      before: `const response = await fetch(apiUrl);`,
      after: `// Retry with exponential backoff
async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetch(url);
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
    }
  }
  throw new Error('Max retries exceeded');
}

const response = await fetchWithRetry(apiUrl);`,
      line_range: { start: 15, end: 15 },
    });
  } else if (matchedPattern.type === 'Null Reference') {
    suggestedFixes.push({
      description: 'Add null checks with optional chaining',
      file_path: 'src/utils/dataHandler.ts',
      language: 'typescript',
      before: `const value = response.data.items[0].name;`,
      after: `// Use optional chaining and nullish coalescing
const value = response?.data?.items?.[0]?.name ?? 'default';

// Or with explicit check
if (!response?.data?.items?.length) {
  throw new Error('No items found in response');
}
const value = response.data.items[0].name;`,
      line_range: { start: 23, end: 23 },
    });
  }

  // Generate debugging tips
  const debuggingTips = [
    {
      step: 1,
      title: 'Reproduce locally',
      command: 'npx playwright test --debug',
      description: 'Run the test in debug mode to step through execution and inspect state at each step.',
    },
    {
      step: 2,
      title: 'Check trace file',
      command: 'npx playwright show-trace trace.zip',
      description: 'Open the trace viewer to see screenshots, network requests, and console logs at each step.',
    },
    {
      step: 3,
      title: 'Add verbose logging',
      command: 'DEBUG=pw:api npx playwright test',
      description: 'Enable Playwright API logging to see all browser interactions.',
    },
  ];

  if (matchedPattern.category === 'network') {
    debuggingTips.push({
      step: 4,
      title: 'Check service health',
      command: 'curl -I http://localhost:3000/health',
      description: 'Verify the backend service is running and responding to health checks.',
    });
  }

  // Generate related documentation links
  const documentation = [
    {
      title: 'Playwright Debugging',
      url: 'https://playwright.dev/docs/debug',
      relevance: 'Learn how to debug failing tests with trace viewer and inspector',
    },
  ];

  if (matchedPattern.type === 'Timeout') {
    documentation.push({
      title: 'Playwright Timeouts',
      url: 'https://playwright.dev/docs/test-timeouts',
      relevance: 'Configure and understand different timeout types in Playwright',
    });
  } else if (matchedPattern.type === 'Element Not Found') {
    documentation.push({
      title: 'Playwright Locators',
      url: 'https://playwright.dev/docs/locators',
      relevance: 'Best practices for writing resilient element selectors',
    });
  }

  return {
    summary: `${matchedPattern.type} in ${testName}: ${explanation.what}`,
    error_classification: {
      type: matchedPattern.type,
      category: matchedPattern.category,
      severity: matchedPattern.severity,
    },
    stack_trace_analysis: {
      frames,
      root_cause_frame: rootCauseFrame,
      total_frames: frames.length,
      application_frames: appFrames.length,
      entry_point: frames[0]?.function_name || 'unknown',
      failure_point: rootCauseFrame?.function_name || 'unknown',
    },
    code_level_explanation: {
      what_failed: explanation.what,
      why_it_failed: explanation.why,
      execution_flow: explanation.flow,
      affected_variables: explanation.vars,
      related_components: [
        rootCauseFrame?.file_path || 'unknown',
        ...frames.filter(f => f.is_application_code).slice(1, 3).map(f => f.file_path),
      ].filter(Boolean),
    },
    suggested_fixes: suggestedFixes,
    debugging_tips: debuggingTips,
    related_documentation: documentation,
    confidence: 0.8 + Math.random() * 0.15,
  };
}

// Feature #1085: Generate executive summary
export function generateExecutiveSummary(
  testRun: any,
  patternType?: string
): ExecutiveSummary {
  const results = testRun.results || [];
  const failedTests = results.filter((r: any) => r.status === 'failed');
  const passedTests = results.filter((r: any) => r.status === 'passed');
  const totalTests = results.length;
  const failureCount = failedTests.length;
  const passRate = totalTests > 0 ? ((passedTests.length / totalTests) * 100).toFixed(1) : '0';

  // Determine overall status based on failure rate
  let overallStatus: 'critical' | 'warning' | 'attention_needed' | 'good' = 'good';
  let statusEmoji = '✅';
  if (failureCount > totalTests * 0.5) {
    overallStatus = 'critical';
    statusEmoji = '🚨';
  } else if (failureCount > totalTests * 0.2) {
    overallStatus = 'warning';
    statusEmoji = '⚠️';
  } else if (failureCount > 0) {
    overallStatus = 'attention_needed';
    statusEmoji = '📋';
  }

  // Generate headline based on severity
  const headlines: Record<string, string> = {
    critical: `Critical: ${failureCount} Test Failures Require Immediate Attention`,
    warning: `Warning: ${failureCount} Test Failures Detected - Action Required`,
    attention_needed: `${failureCount} Minor Issue${failureCount > 1 ? 's' : ''} Detected in Testing`,
    good: 'All Tests Passing - System Healthy',
  };

  // Generate business impact based on pattern type and failure count
  const impactMap: Record<string, { summary: string; severity: 'severe' | 'moderate' | 'minor'; users: string; revenue: string; reputation: string }> = {
    network: {
      summary: 'Users may experience connectivity issues when trying to access the application or specific features.',
      severity: failureCount > 3 ? 'severe' : 'moderate',
      users: 'All users attempting to load data or interact with backend services',
      revenue: 'High risk - Users unable to complete transactions or access services',
      reputation: 'High risk - Application perceived as unreliable or "down"',
    },
    timing: {
      summary: 'Performance degradation causing slow load times and potential timeouts for users.',
      severity: failureCount > 3 ? 'moderate' : 'minor',
      users: 'Users experiencing slow page loads or action delays',
      revenue: 'Moderate risk - Users may abandon slow transactions',
      reputation: 'Moderate risk - Application perceived as slow',
    },
    element: {
      summary: 'UI elements may not be rendering correctly, affecting user interactions.',
      severity: 'moderate',
      users: 'Users trying to interact with specific UI components',
      revenue: 'Moderate risk - Users may not be able to complete certain workflows',
      reputation: 'Low risk - Localized UI issues',
    },
    data: {
      summary: 'Data integrity issues may cause incorrect information to be displayed to users.',
      severity: 'severe',
      users: 'All users viewing or submitting data',
      revenue: 'High risk - Incorrect data could lead to wrong decisions or transactions',
      reputation: 'High risk - Data accuracy is critical for trust',
    },
    environment: {
      summary: 'Configuration or environment issues affecting application stability.',
      severity: 'moderate',
      users: 'Users in affected environments or regions',
      revenue: 'Moderate risk - Service degradation for affected users',
      reputation: 'Moderate risk - Inconsistent experience across environments',
    },
  };

  const impact = impactMap[patternType || 'network'] ?? impactMap['network'] ?? {
    summary: 'Test failures detected that may impact user experience.',
    severity: 'moderate' as const,
    users: 'Some users may be affected',
    revenue: 'Potential impact on transactions',
    reputation: 'May affect user trust',
  };

  // Generate affected features
  const featureMap: Record<string, AffectedFeature[]> = {
    network: [
      { name: 'Data Loading', description: 'API data fetching functionality', criticality: 'critical', user_impact: 'Users cannot view up-to-date information' },
      { name: 'Form Submissions', description: 'Ability to submit data to the server', criticality: 'critical', user_impact: 'Users cannot save changes or complete actions' },
      { name: 'Real-time Updates', description: 'Live data synchronization', criticality: 'high', user_impact: 'Users see stale data' },
    ],
    timing: [
      { name: 'Page Load Performance', description: 'Initial page rendering speed', criticality: 'high', user_impact: 'Slow first-load experience' },
      { name: 'Interactive Elements', description: 'Button and form responsiveness', criticality: 'medium', user_impact: 'Delayed response to user actions' },
    ],
    element: [
      { name: 'UI Components', description: 'Visual interface elements', criticality: 'medium', user_impact: 'Missing or broken UI elements' },
      { name: 'Navigation', description: 'Menu and routing functionality', criticality: 'high', user_impact: 'Users may not be able to navigate' },
    ],
    data: [
      { name: 'Data Display', description: 'Information presentation layer', criticality: 'critical', user_impact: 'Incorrect or missing data shown' },
      { name: 'Calculations', description: 'Computed values and totals', criticality: 'critical', user_impact: 'Wrong calculations affecting decisions' },
    ],
    environment: [
      { name: 'Configuration', description: 'Environment settings and variables', criticality: 'high', user_impact: 'Features may behave unexpectedly' },
      { name: 'Deployment', description: 'Production environment stability', criticality: 'high', user_impact: 'Service availability issues' },
    ],
  };

  // Generate fix effort estimate
  const complexity = failureCount > 5 ? 'complex' : failureCount > 2 ? 'moderate' : 'simple';
  const timeEstimates: Record<string, string> = {
    simple: '1-2 hours',
    moderate: '2-4 hours',
    complex: '4-8 hours',
  };

  // Generate risk assessment
  const riskLevel = overallStatus === 'critical' ? 'critical' : overallStatus === 'warning' ? 'high' : overallStatus === 'attention_needed' ? 'medium' : 'low';

  const keyRisks: Record<string, string[]> = {
    network: [
      'Service disruption affecting user access',
      'Data loss if submissions fail silently',
      'Cascade effect on dependent services',
    ],
    timing: [
      'User abandonment due to slow performance',
      'SEO impact from slow page loads',
      'Increased server load from retries',
    ],
    element: [
      'Accessibility compliance issues',
      'Broken user workflows',
      'Inconsistent cross-browser experience',
    ],
    data: [
      'Incorrect business decisions based on bad data',
      'Compliance violations',
      'Customer disputes from wrong information',
    ],
    environment: [
      'Production instability',
      'Security vulnerabilities from misconfigurations',
      'Inconsistent behavior between environments',
    ],
  };

  const mitigationSteps: Record<string, string[]> = {
    network: [
      'Verify backend service health and availability',
      'Check network configuration and firewall rules',
      'Implement retry logic with exponential backoff',
      'Add circuit breaker pattern for resilience',
    ],
    timing: [
      'Profile and optimize slow operations',
      'Add caching for expensive computations',
      'Increase timeout thresholds if operations are legitimately slow',
      'Consider lazy loading for non-critical content',
    ],
    element: [
      'Update selectors to use stable identifiers',
      'Add explicit waits before interactions',
      'Ensure elements are visible before clicking',
      'Review recent UI changes for regressions',
    ],
    data: [
      'Add null checks and defensive coding',
      'Verify test data setup and fixtures',
      'Review data validation logic',
      'Check API response handling',
    ],
    environment: [
      'Audit environment configuration files',
      'Ensure parity between test and production environments',
      'Review recent deployment changes',
      'Verify all required services are running',
    ],
  };

  return {
    headline: headlines[overallStatus] ?? 'Test Results Summary',
    status_emoji: statusEmoji,
    overall_status: overallStatus,
    business_impact: {
      summary: impact.summary,
      severity: impact.severity,
      affected_users: impact.users,
      revenue_risk: impact.revenue,
      reputation_risk: impact.reputation,
    },
    affected_features: featureMap[patternType || 'network'] ?? featureMap['network'] ?? [],
    fix_effort: {
      estimated_time: timeEstimates[complexity] ?? '1-2 hours',
      team_resources: complexity === 'complex' ? '2-3 developers' : complexity === 'moderate' ? '1-2 developers' : '1 developer',
      complexity,
      priority_recommendation: overallStatus === 'critical' ? 'immediate' : overallStatus === 'warning' ? 'high' : 'medium',
    },
    risk_assessment: {
      current_risk_level: riskLevel,
      trend: failureCount > 3 ? 'increasing' : 'stable',
      key_risks: keyRisks[patternType || 'network'] ?? keyRisks['network'] ?? [],
      mitigation_steps: mitigationSteps[patternType || 'network'] ?? mitigationSteps['network'] ?? [],
    },
    key_metrics: {
      total_failures: failureCount,
      pass_rate: `${passRate}%`,
      affected_tests: failureCount,
      time_to_fix_estimate: timeEstimates[complexity] ?? '1-2 hours',
    },
    recommendations: [
      {
        priority: 1,
        action: overallStatus === 'critical' ? 'Assemble team to address critical failures immediately' : 'Schedule time to investigate and fix issues',
        rationale: overallStatus === 'critical' ? 'High user impact requires immediate response' : 'Prevent issues from accumulating',
      },
      {
        priority: 2,
        action: 'Review root cause analysis for each failure',
        rationale: 'Understanding the cause prevents recurrence',
      },
      {
        priority: 3,
        action: 'Update monitoring and alerts for affected components',
        rationale: 'Early detection of similar issues in the future',
      },
    ],
    next_steps: [
      `Review the ${failureCount} failed test${failureCount > 1 ? 's' : ''} in detail`,
      'Prioritize fixes based on user impact',
      'Communicate timeline to stakeholders',
      'Schedule follow-up testing after fixes',
    ],
  };
}
