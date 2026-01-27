/**
 * Natural Language Test Generation Routes
 *
 * Feature #1342: Natural Language Test Generation
 * Generate Playwright test code from plain English descriptions using Claude
 *
 * Extracted from github.ts for maintainability.
 */

import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth';

// =============================================================================
// Interfaces
// =============================================================================

interface NLTestGenerationRequest {
  description: string;
  base_url?: string;
  test_type?: 'e2e' | 'visual_regression' | 'accessibility' | 'load';
  include_assertions?: boolean;
  include_screenshot?: boolean;
}

interface GeneratedTest {
  code: string;
  test_name: string;
  description: string;
  steps: string[];
  selectors: string[];
  assertions: string[];
  syntax_valid: boolean;
  syntax_errors?: string[];
  estimated_duration_ms: number;
  complexity: 'simple' | 'medium' | 'complex';
  warnings?: string[];
}

interface UserStoryTestSuiteRequest {
  user_story: string;
  base_url?: string;
  include_edge_cases?: boolean;
  test_type?: 'e2e' | 'visual_regression' | 'accessibility';
}

interface GeneratedTestSuite {
  suite_name: string;
  user_story: string;
  tests: GeneratedTest[];
  edge_case_tests: GeneratedTest[];
  total_tests: number;
  estimated_total_duration_ms: number;
  generated_at: string;
}

interface GherkinToPlaywrightRequest {
  gherkin: string;
  base_url?: string;
  feature_name?: string;
}

interface GherkinStep {
  keyword: 'Given' | 'When' | 'Then' | 'And' | 'But';
  text: string;
  action: string;
  playwright_code: string;
}

interface ConvertedGherkinTest {
  code: string;
  test_name: string;
  feature_name: string;
  scenario_name: string;
  steps: GherkinStep[];
  syntax_valid: boolean;
  syntax_errors?: string[];
  complexity: 'simple' | 'medium' | 'complex';
}

interface ScreenshotToTestRequest {
  image_data: string;
  image_type?: string;
  base_url?: string;
  context?: string;
}

type AnnotationType = 'click' | 'type' | 'expect';

interface ScreenshotAnnotation {
  type: AnnotationType;
  x: number;
  y: number;
  label?: string;
  expectation?: string;
}

interface AnnotatedScreenshotRequest {
  image_data: string;
  image_type?: string;
  base_url?: string;
  context?: string;
  annotations: ScreenshotAnnotation[];
}

interface ExplainTestRequest {
  code: string;
  test_name?: string;
  test_type?: string;
}

interface HealWithVisionRequest {
  element_screenshot: string;
  page_screenshot: string;
  original_selector: string;
  selector_type?: string;
  element_context?: {
    tag_name?: string;
    text_content?: string;
    classes?: string[];
    attributes?: Record<string, string>;
    bounding_box?: { x: number; y: number; width: number; height: number };
  };
  page_url?: string;
  test_name?: string;
}

interface ExplainAnomalyRequest {
  anomaly_type: 'failure_spike' | 'performance_degradation' | 'flaky_test' | 'duration_anomaly' | 'coverage_drop';
  anomaly_data: {
    metric_name: string;
    current_value: number;
    baseline_value: number;
    deviation_percentage: number;
    timestamp: string;
    affected_tests?: string[];
    affected_suites?: string[];
  };
  context?: {
    project_name?: string;
    recent_changes?: string[];
    environment?: string;
  };
}

interface GenerateReleaseNotesRequest {
  from_version: string;
  to_version: string;
  project_name?: string;
  test_changes?: Array<{
    type: 'added' | 'modified' | 'removed';
    testName: string;
    suiteName: string;
    description?: string;
    category?: 'feature' | 'bugfix' | 'improvement' | 'refactor';
  }>;
  format?: 'markdown' | 'html' | 'json' | 'all';
}

interface AnalyzeTestImprovementsRequest {
  test_code: string;
  test_name?: string;
  test_type?: 'e2e' | 'unit' | 'integration' | 'visual' | 'api';
  framework?: 'playwright' | 'cypress' | 'selenium' | 'jest' | 'mocha';
  include_best_practices?: boolean;
  include_selector_analysis?: boolean;
  include_assertion_suggestions?: boolean;
  include_flakiness_analysis?: boolean;
}

// =============================================================================
// Helper Functions
// =============================================================================

function validatePlaywrightSyntax(code: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!code.includes('test(') && !code.includes('test.describe(')) {
    errors.push('Missing test() or test.describe() block');
  }

  const openBraces = (code.match(/\{/g) || []).length;
  const closeBraces = (code.match(/\}/g) || []).length;
  if (openBraces !== closeBraces) {
    errors.push(`Mismatched braces: ${openBraces} open, ${closeBraces} close`);
  }

  const openParens = (code.match(/\(/g) || []).length;
  const closeParens = (code.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    errors.push(`Mismatched parentheses: ${openParens} open, ${closeParens} close`);
  }

  if (!code.includes('page.') && !code.includes('expect(')) {
    errors.push('No Playwright page interactions or assertions found');
  }

  const singleQuotes = (code.match(/'/g) || []).length;
  const doubleQuotes = (code.match(/"/g) || []).length;
  const backticks = (code.match(/`/g) || []).length;
  if (singleQuotes % 2 !== 0) {
    errors.push('Unclosed single-quoted string');
  }
  if (doubleQuotes % 2 !== 0) {
    errors.push('Unclosed double-quoted string');
  }
  if (backticks % 2 !== 0) {
    errors.push('Unclosed template literal');
  }

  return { valid: errors.length === 0, errors };
}

function extractSelectors(code: string): string[] {
  const selectors: string[] = [];
  const patterns = [
    /getByRole\(['"`]([^'"`]+)['"`]/g,
    /getByText\(['"`]([^'"`]+)['"`]/g,
    /getByLabel\(['"`]([^'"`]+)['"`]/g,
    /getByPlaceholder\(['"`]([^'"`]+)['"`]/g,
    /getByTestId\(['"`]([^'"`]+)['"`]/g,
    /locator\(['"`]([^'"`]+)['"`]/g,
    /\$\(['"`]([^'"`]+)['"`]/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(code)) !== null) {
      if (!selectors.includes(match[1])) {
        selectors.push(match[1]);
      }
    }
  }

  return selectors;
}

function extractAssertions(code: string): string[] {
  const assertions: string[] = [];
  const expectRegex = /expect\([^)]+\)\.[^;]+/g;
  let match;
  while ((match = expectRegex.exec(code)) !== null) {
    assertions.push(match[0].trim());
  }
  return assertions;
}

function estimateComplexity(code: string): 'simple' | 'medium' | 'complex' {
  const lineCount = code.split('\n').filter(l => l.trim()).length;
  const assertionCount = (code.match(/expect\(/g) || []).length;
  const interactionCount = (code.match(/page\.(click|fill|type|press|select)/g) || []).length;
  const score = lineCount * 0.5 + assertionCount * 2 + interactionCount * 1.5;
  if (score < 15) return 'simple';
  if (score < 40) return 'medium';
  return 'complex';
}

function parseDescriptionToSteps(description: string, category: string): string[] {
  const steps: string[] = [];
  const lowerDesc = description.toLowerCase();
  steps.push('Navigate to the page');

  switch (category) {
    case 'authentication':
      if (lowerDesc.includes('email') || lowerDesc.includes('username')) {
        steps.push('Enter username/email');
      }
      if (lowerDesc.includes('password')) {
        steps.push('Enter password');
      }
      if (lowerDesc.includes('submit') || lowerDesc.includes('click') || lowerDesc.includes('login') || lowerDesc.includes('sign in')) {
        steps.push('Click submit button');
      }
      if (lowerDesc.includes('success') || lowerDesc.includes('redirect') || lowerDesc.includes('dashboard')) {
        steps.push('Verify successful login');
      }
      if (lowerDesc.includes('error') || lowerDesc.includes('invalid') || lowerDesc.includes('fail')) {
        steps.push('Verify error message displayed');
      }
      break;
    case 'form':
      steps.push('Fill in form fields');
      if (lowerDesc.includes('submit')) {
        steps.push('Submit the form');
      }
      if (lowerDesc.includes('valid')) {
        steps.push('Verify form submission success');
      }
      if (lowerDesc.includes('error') || lowerDesc.includes('invalid')) {
        steps.push('Verify validation error messages');
      }
      break;
    case 'navigation':
      if (lowerDesc.includes('menu') || lowerDesc.includes('nav')) {
        steps.push('Locate navigation element');
      }
      steps.push('Click on the target link/button');
      steps.push('Verify navigation to expected page');
      break;
    case 'search':
      steps.push('Enter search query');
      if (lowerDesc.includes('submit') || lowerDesc.includes('enter') || lowerDesc.includes('click')) {
        steps.push('Submit search');
      }
      steps.push('Verify search results displayed');
      break;
    case 'ecommerce':
      if (lowerDesc.includes('add') && lowerDesc.includes('cart')) {
        steps.push('Add item to cart');
      }
      if (lowerDesc.includes('checkout')) {
        steps.push('Proceed to checkout');
      }
      if (lowerDesc.includes('payment') || lowerDesc.includes('pay')) {
        steps.push('Enter payment details');
      }
      steps.push('Verify expected result');
      break;
    default:
      steps.push('Interact with page elements');
      steps.push('Verify expected behavior');
  }

  return steps;
}

function generateAuthTest(desc: string, url: string, includeAssertions: boolean): string {
  let code = `  // Navigate to login page\n  await page.goto('${url}/login');\n\n`;

  if (desc.includes('email') || desc.includes('username')) {
    code += `  // Enter username/email\n  await page.getByLabel('Email').fill('user@example.com');\n\n`;
  }
  if (desc.includes('password')) {
    code += `  // Enter password\n  await page.getByLabel('Password').fill('SecurePassword123!');\n\n`;
  }
  code += `  // Click login button\n  await page.getByRole('button', { name: /log\\s*in|sign\\s*in|submit/i }).click();\n\n`;

  if (includeAssertions) {
    if (desc.includes('success') || desc.includes('dashboard') || (!desc.includes('error') && !desc.includes('fail') && !desc.includes('invalid'))) {
      code += `  // Verify successful login\n  await expect(page).toHaveURL(/dashboard|home|profile/i);\n`;
      code += `  await expect(page.getByText(/welcome|logged in/i)).toBeVisible();\n`;
    } else {
      code += `  // Verify error message displayed\n  await expect(page.getByRole('alert')).toBeVisible();\n`;
      code += `  await expect(page.getByText(/invalid|incorrect|error/i)).toBeVisible();\n`;
    }
  }
  return code;
}

function generateFormTest(desc: string, url: string, includeAssertions: boolean): string {
  let code = `  // Navigate to the form page\n  await page.goto('${url}');\n\n`;
  code += `  // Fill in form fields\n`;

  if (desc.includes('name')) {
    code += `  await page.getByLabel('Name').fill('John Doe');\n`;
  }
  if (desc.includes('email')) {
    code += `  await page.getByLabel('Email').fill('john@example.com');\n`;
  }
  if (desc.includes('phone')) {
    code += `  await page.getByLabel('Phone').fill('+1234567890');\n`;
  }
  if (desc.includes('message') || desc.includes('comment')) {
    code += `  await page.getByLabel('Message').fill('Test message content');\n`;
  }
  code += `\n  // Submit the form\n  await page.getByRole('button', { name: /submit|send|save/i }).click();\n\n`;

  if (includeAssertions) {
    if (desc.includes('error') || desc.includes('invalid') || desc.includes('fail')) {
      code += `  // Verify validation errors\n  await expect(page.getByRole('alert')).toBeVisible();\n`;
    } else {
      code += `  // Verify form submission success\n  await expect(page.getByText(/success|thank you|submitted/i)).toBeVisible();\n`;
    }
  }
  return code;
}

function generateNavigationTest(desc: string, url: string, includeAssertions: boolean): string {
  let code = `  // Navigate to the starting page\n  await page.goto('${url}');\n\n`;
  const targetMatch = desc.match(/(?:navigate|go|click)(?:\s+(?:to|on))?\s+(?:the\s+)?["']?(\w+)["']?/i);
  const target = targetMatch ? targetMatch[1] : 'Link';
  code += `  // Click on navigation element\n  await page.getByRole('link', { name: /${target}/i }).click();\n\n`;

  if (includeAssertions) {
    code += `  // Verify navigation was successful\n  await expect(page).not.toHaveURL('${url}');\n`;
    code += `  await expect(page.getByRole('heading')).toBeVisible();\n`;
  }
  return code;
}

function generateSearchTest(desc: string, url: string, includeAssertions: boolean): string {
  let code = `  // Navigate to the page with search\n  await page.goto('${url}');\n\n`;
  const termMatch = desc.match(/(?:search|find|look)\s+(?:for\s+)?["']?([^"']+?)["']?(?:\s+(?:and|then)|$)/i);
  const searchTerm = termMatch ? termMatch[1].trim() : 'test query';
  code += `  // Enter search query\n  await page.getByRole('searchbox').fill('${searchTerm}');\n\n`;
  code += `  // Submit search\n  await page.getByRole('searchbox').press('Enter');\n\n`;

  if (includeAssertions) {
    code += `  // Verify search results are displayed\n  await expect(page.getByRole('list')).toBeVisible();\n`;
    code += `  // Or check for results container\n  await expect(page.locator('[data-testid="search-results"]')).toBeVisible();\n`;
  }
  return code;
}

function generateEcommerceTest(desc: string, url: string, includeAssertions: boolean): string {
  let code = `  // Navigate to the product page\n  await page.goto('${url}');\n\n`;

  if (desc.includes('add') && desc.includes('cart')) {
    code += `  // Add item to cart\n  await page.getByRole('button', { name: /add to cart|buy/i }).click();\n\n`;
    if (includeAssertions) {
      code += `  // Verify item was added\n  await expect(page.getByText(/added|cart\\s*\\(1\\)/i)).toBeVisible();\n\n`;
    }
  }
  if (desc.includes('checkout')) {
    code += `  // Proceed to checkout\n  await page.getByRole('link', { name: /checkout|proceed/i }).click();\n\n`;
    if (includeAssertions) {
      code += `  // Verify checkout page\n  await expect(page).toHaveURL(/checkout/i);\n\n`;
    }
  }
  if (desc.includes('payment') || desc.includes('pay')) {
    code += `  // Enter payment details\n`;
    code += `  await page.getByLabel('Card Number').fill('4242424242424242');\n`;
    code += `  await page.getByLabel('Expiry').fill('12/25');\n`;
    code += `  await page.getByLabel('CVC').fill('123');\n\n`;
  }
  return code;
}

function generateGenericTest(desc: string, url: string, includeAssertions: boolean): string {
  let code = `  // Navigate to the page\n  await page.goto('${url}');\n\n`;

  if (desc.includes('click')) {
    const targetMatch = desc.match(/click\s+(?:on\s+)?(?:the\s+)?["']?([^"']+?)["']?(?:\s+button|\s+link)?/i);
    const target = targetMatch ? targetMatch[1].trim() : 'button';
    code += `  // Click the target element\n  await page.getByRole('button', { name: /${target}/i }).click();\n\n`;
  }
  if (desc.includes('type') || desc.includes('enter') || desc.includes('fill')) {
    code += `  // Fill in the input\n  await page.getByRole('textbox').fill('test input');\n\n`;
  }
  if (includeAssertions) {
    code += `  // Verify expected result\n  await expect(page).toHaveTitle(/.+/);\n`;
  }
  return code;
}

function generateVisualRegressionTest(testName: string, description: string, url: string, steps: string[]): string {
  return `import { test, expect } from '@playwright/test';

/**
 * Visual Regression Test: ${description}
 *
 * Steps:
 * ${steps.map((s, i) => `${i + 1}. ${s}`).join('\n * ')}
 */
test('${testName}', async ({ page }) => {
  // Navigate to the page
  await page.goto('${url}');

  // Wait for page to be fully loaded
  await page.waitForLoadState('networkidle');

  // Hide dynamic content that may cause flaky comparisons
  await page.evaluate(() => {
    // Hide timestamps, dates, or other dynamic elements
    document.querySelectorAll('[data-dynamic], .timestamp, .date').forEach(el => {
      (el as HTMLElement).style.visibility = 'hidden';
    });
  });

  // Take full page screenshot and compare with baseline
  await expect(page).toHaveScreenshot('${testName}.png', {
    fullPage: true,
    threshold: 0.1, // Allow 10% pixel difference
    maxDiffPixelRatio: 0.02, // Max 2% of pixels can differ
  });
});
`;
}

function generateAccessibilityTest(testName: string, description: string, url: string, steps: string[]): string {
  return `import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility Test: ${description}
 *
 * Steps:
 * ${steps.map((s, i) => `${i + 1}. ${s}`).join('\n * ')}
 */
test('${testName}', async ({ page }) => {
  // Navigate to the page
  await page.goto('${url}');

  // Wait for page to be fully loaded
  await page.waitForLoadState('networkidle');

  // Run accessibility scan using axe-core
  const accessibilityScanResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();

  // Assert no accessibility violations
  expect(accessibilityScanResults.violations).toEqual([]);

  // Log any violations for debugging (optional)
  if (accessibilityScanResults.violations.length > 0) {
    console.log('Accessibility violations found:');
    accessibilityScanResults.violations.forEach(violation => {
      console.log(\`  - \${violation.id}: \${violation.description}\`);
      console.log(\`    Impact: \${violation.impact}\`);
      console.log(\`    Nodes: \${violation.nodes.length}\`);
    });
  }
});
`;
}

function generateLoadTestK6(testName: string, description: string, url: string): string {
  return `import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * Load Test: ${description}
 *
 * This K6 script simulates load on the target endpoint.
 */

export const options = {
  stages: [
    { duration: '30s', target: 10 }, // Ramp up to 10 users
    { duration: '1m', target: 10 },  // Stay at 10 users
    { duration: '30s', target: 0 },  // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be < 500ms
    http_req_failed: ['rate<0.01'],   // Less than 1% of requests should fail
  },
};

export default function() {
  const res = http.get('${url}');

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    'summary.json': JSON.stringify(data),
  };
}
`;
}

function generateE2ETest(
  testName: string,
  description: string,
  url: string,
  steps: string[],
  category: string,
  includeAssertions: boolean,
  includeScreenshot: boolean
): string {
  const lowerDesc = description.toLowerCase();
  let testBody = '';

  switch (category) {
    case 'authentication':
      testBody = generateAuthTest(lowerDesc, url, includeAssertions);
      break;
    case 'form':
      testBody = generateFormTest(lowerDesc, url, includeAssertions);
      break;
    case 'navigation':
      testBody = generateNavigationTest(lowerDesc, url, includeAssertions);
      break;
    case 'search':
      testBody = generateSearchTest(lowerDesc, url, includeAssertions);
      break;
    case 'ecommerce':
      testBody = generateEcommerceTest(lowerDesc, url, includeAssertions);
      break;
    default:
      testBody = generateGenericTest(lowerDesc, url, includeAssertions);
  }

  if (includeScreenshot) {
    testBody += `\n  // Capture screenshot for visual verification\n  await page.screenshot({ path: 'screenshots/${testName}.png', fullPage: true });\n`;
  }

  return `import { test, expect } from '@playwright/test';

/**
 * ${description}
 *
 * Steps:
 * ${steps.map((s, i) => `${i + 1}. ${s}`).join('\n * ')}
 */
test('${testName}', async ({ page }) => {
${testBody}});
`;
}

function generatePlaywrightTest(
  description: string,
  baseUrl?: string,
  testType: string = 'e2e',
  includeAssertions: boolean = true,
  includeScreenshot: boolean = false
): GeneratedTest {
  const lowerDesc = description.toLowerCase();
  const warnings: string[] = [];

  let testCategory = 'general';
  if (lowerDesc.includes('login') || lowerDesc.includes('sign in') || lowerDesc.includes('authenticate')) {
    testCategory = 'authentication';
  } else if (lowerDesc.includes('form') || lowerDesc.includes('submit') || lowerDesc.includes('input')) {
    testCategory = 'form';
  } else if (lowerDesc.includes('navigate') || lowerDesc.includes('click') || lowerDesc.includes('link')) {
    testCategory = 'navigation';
  } else if (lowerDesc.includes('search') || lowerDesc.includes('filter')) {
    testCategory = 'search';
  } else if (lowerDesc.includes('cart') || lowerDesc.includes('checkout') || lowerDesc.includes('buy') || lowerDesc.includes('purchase')) {
    testCategory = 'ecommerce';
  } else if (lowerDesc.includes('api') || lowerDesc.includes('request') || lowerDesc.includes('response')) {
    testCategory = 'api';
  }

  const testName = description
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(' ')
    .slice(0, 6)
    .map((word, i) => i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');

  const steps = parseDescriptionToSteps(description, testCategory);
  let code = '';
  const url = baseUrl || 'https://example.com';

  if (testType === 'visual_regression') {
    code = generateVisualRegressionTest(testName, description, url, steps);
  } else if (testType === 'accessibility') {
    code = generateAccessibilityTest(testName, description, url, steps);
  } else if (testType === 'load') {
    code = generateLoadTestK6(testName, description, url);
  } else {
    code = generateE2ETest(testName, description, url, steps, testCategory, includeAssertions, includeScreenshot);
  }

  const validation = validatePlaywrightSyntax(code);
  const selectors = extractSelectors(code);
  const assertions = extractAssertions(code);
  const complexity = estimateComplexity(code);
  const estimatedDuration = complexity === 'simple' ? 5000 : complexity === 'medium' ? 15000 : 30000;

  if (selectors.length === 0) {
    warnings.push('No selectors were generated. You may need to add specific element selectors.');
  }
  if (includeAssertions && assertions.length === 0) {
    warnings.push('No assertions were generated. Consider adding expect() statements.');
  }
  if (!baseUrl) {
    warnings.push('No base URL provided. Using placeholder URL.');
  }

  return {
    code,
    test_name: testName,
    description,
    steps,
    selectors,
    assertions,
    syntax_valid: validation.valid,
    syntax_errors: validation.errors.length > 0 ? validation.errors : undefined,
    estimated_duration_ms: estimatedDuration,
    complexity,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

function parseUserStoryToScenarios(userStory: string): { action: string; scenario: string; isEdgeCase: boolean }[] {
  const scenarios: { action: string; scenario: string; isEdgeCase: boolean }[] = [];
  const lowerStory = userStory.toLowerCase();

  const entityMatch = userStory.match(/(?:create|edit|delete|view|manage|update|add|remove|modify)\s+(?:a\s+)?(\w+)/i);
  const entity = entityMatch ? entityMatch[1].replace(/s$/, '') : 'item';
  const entityPlural = entity.endsWith('s') ? entity : entity + 's';

  const crudPatterns = [
    { pattern: /create|add|new|make/i, action: 'create', scenario: `create a new ${entity}` },
    { pattern: /edit|update|modify|change/i, action: 'edit', scenario: `edit an existing ${entity}` },
    { pattern: /delete|remove|destroy/i, action: 'delete', scenario: `delete a ${entity}` },
    { pattern: /view|see|display|show|list/i, action: 'view', scenario: `view ${entityPlural}` },
    { pattern: /search|find|filter/i, action: 'search', scenario: `search for ${entityPlural}` },
    { pattern: /sort|order/i, action: 'sort', scenario: `sort ${entityPlural}` },
    { pattern: /export|download/i, action: 'export', scenario: `export ${entityPlural}` },
    { pattern: /import|upload/i, action: 'import', scenario: `import ${entityPlural}` },
    { pattern: /share|invite/i, action: 'share', scenario: `share a ${entity}` },
    { pattern: /archive/i, action: 'archive', scenario: `archive a ${entity}` },
    { pattern: /duplicate|copy|clone/i, action: 'duplicate', scenario: `duplicate a ${entity}` },
  ];

  for (const pattern of crudPatterns) {
    if (pattern.pattern.test(lowerStory)) {
      scenarios.push({ action: pattern.action, scenario: pattern.scenario, isEdgeCase: false });
    }
  }

  if (scenarios.length === 0) {
    const actionWords = lowerStory.match(/(?:can|should|want to|able to)\s+(.+)/i);
    if (actionWords) {
      const actions = actionWords[1].split(/,\s*|\s+and\s+/).filter(a => a.trim());
      for (const action of actions) {
        const trimmedAction = action.trim().replace(/\.$/, '');
        if (trimmedAction.length > 2) {
          scenarios.push({ action: trimmedAction.split(' ')[0], scenario: trimmedAction, isEdgeCase: false });
        }
      }
    }
  }

  const edgeCases: { action: string; scenario: string; isEdgeCase: boolean }[] = [];
  for (const scenario of scenarios) {
    switch (scenario.action) {
      case 'create':
        edgeCases.push(
          { action: 'create_empty', scenario: `create ${entity} with empty required fields`, isEdgeCase: true },
          { action: 'create_duplicate', scenario: `create ${entity} with duplicate name`, isEdgeCase: true },
          { action: 'create_special_chars', scenario: `create ${entity} with special characters`, isEdgeCase: true },
        );
        break;
      case 'edit':
        edgeCases.push(
          { action: 'edit_cancel', scenario: `cancel ${entity} edit without saving`, isEdgeCase: true },
          { action: 'edit_invalid', scenario: `edit ${entity} with invalid data`, isEdgeCase: true },
        );
        break;
      case 'delete':
        edgeCases.push(
          { action: 'delete_cancel', scenario: `cancel ${entity} deletion`, isEdgeCase: true },
          { action: 'delete_confirm', scenario: `confirm ${entity} deletion dialog`, isEdgeCase: true },
        );
        break;
      case 'search':
        edgeCases.push(
          { action: 'search_empty', scenario: `search with no results`, isEdgeCase: true },
          { action: 'search_special', scenario: `search with special characters`, isEdgeCase: true },
        );
        break;
    }
  }

  return [...scenarios, ...edgeCases];
}

function generateTestForScenario(
  scenario: { action: string; scenario: string; isEdgeCase: boolean },
  entity: string,
  baseUrl: string,
  testType: string
): GeneratedTest {
  const testName = scenario.scenario
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(' ')
    .map((word, i) => i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');

  const steps: string[] = [];
  let testBody = '';
  const url = baseUrl || 'https://example.com';

  switch (scenario.action) {
    case 'create':
      steps.push(`Navigate to ${entity} page`, `Click Create New button`, `Fill in ${entity} details`, `Click Save`, `Verify ${entity} appears in list`);
      testBody = `  // Navigate to ${entity} page
  await page.goto('${url}/${entity}s');

  // Click Create New button
  await page.getByRole('button', { name: /create|new|add/i }).click();

  // Fill in ${entity} details
  await page.getByLabel(/name|title/i).fill('Test ${entity} ' + Date.now());

  // Click Save
  await page.getByRole('button', { name: /save|create|submit/i }).click();

  // Verify ${entity} appears in list
  await expect(page.getByText(/test ${entity}/i)).toBeVisible();
`;
      break;
    case 'edit':
      steps.push(`Navigate to ${entity} page`, `Select existing ${entity}`, `Click Edit`, `Modify ${entity} details`, `Save changes`, `Verify changes saved`);
      testBody = `  // Navigate to ${entity} page
  await page.goto('${url}/${entity}s');

  // Select existing ${entity}
  await page.getByRole('row').first().click();

  // Click Edit
  await page.getByRole('button', { name: /edit/i }).click();

  // Modify ${entity} details
  await page.getByLabel(/name|title/i).fill('Updated ${entity} ' + Date.now());

  // Save changes
  await page.getByRole('button', { name: /save|update|submit/i }).click();

  // Verify changes saved
  await expect(page.getByText(/updated|saved|success/i)).toBeVisible();
`;
      break;
    case 'delete':
      steps.push(`Navigate to ${entity} page`, `Select ${entity} to delete`, `Click Delete`, `Confirm deletion`, `Verify ${entity} removed`);
      testBody = `  // Navigate to ${entity} page
  await page.goto('${url}/${entity}s');

  // Select ${entity} to delete
  await page.getByRole('row').first().click();

  // Click Delete
  await page.getByRole('button', { name: /delete|remove/i }).click();

  // Confirm deletion
  await page.getByRole('button', { name: /confirm|yes|delete/i }).click();

  // Verify ${entity} removed
  await expect(page.getByText(/deleted|removed|success/i)).toBeVisible();
`;
      break;
    case 'view':
      steps.push(`Navigate to ${entity} page`, `Verify ${entity} list loads`, `Verify ${entity} details visible`);
      testBody = `  // Navigate to ${entity} page
  await page.goto('${url}/${entity}s');

  // Verify ${entity} list loads
  await expect(page.getByRole('heading', { name: /${entity}s/i })).toBeVisible();

  // Verify ${entity} items visible
  await expect(page.getByRole('row')).toHaveCount({ minimum: 1 });
`;
      break;
    case 'search':
      steps.push(`Navigate to ${entity} page`, `Enter search query`, `Submit search`, `Verify filtered results`);
      testBody = `  // Navigate to ${entity} page
  await page.goto('${url}/${entity}s');

  // Enter search query
  await page.getByRole('searchbox').fill('test search');

  // Submit search
  await page.getByRole('button', { name: /search/i }).click();

  // Verify filtered results
  await expect(page.getByText(/results|found/i)).toBeVisible();
`;
      break;
    case 'create_empty':
      steps.push(`Navigate to ${entity} creation`, `Leave required fields empty`, `Click Save`, `Verify validation error`);
      testBody = `  // Navigate to ${entity} creation
  await page.goto('${url}/${entity}s/new');

  // Leave required fields empty and click Save
  await page.getByRole('button', { name: /save|create|submit/i }).click();

  // Verify validation error
  await expect(page.getByText(/required|cannot be empty|please fill/i)).toBeVisible();
`;
      break;
    case 'create_duplicate':
      steps.push(`Create ${entity} with existing name`, `Verify duplicate error`);
      testBody = `  // Navigate to ${entity} creation
  await page.goto('${url}/${entity}s/new');

  // Try to create with duplicate name
  await page.getByLabel(/name|title/i).fill('Existing ${entity}');
  await page.getByRole('button', { name: /save|create/i }).click();

  // Verify duplicate error
  await expect(page.getByText(/already exists|duplicate|unique/i)).toBeVisible();
`;
      break;
    case 'delete_cancel':
      steps.push(`Navigate to ${entity}`, `Click Delete`, `Cancel deletion`, `Verify ${entity} still exists`);
      testBody = `  // Navigate to ${entity} page
  await page.goto('${url}/${entity}s');

  // Get initial count
  const initialCount = await page.getByRole('row').count();

  // Click Delete
  await page.getByRole('button', { name: /delete|remove/i }).first().click();

  // Cancel deletion
  await page.getByRole('button', { name: /cancel|no/i }).click();

  // Verify ${entity} still exists
  await expect(page.getByRole('row')).toHaveCount(initialCount);
`;
      break;
    default:
      steps.push(`Navigate to ${entity} page`, `Perform ${scenario.action}`, `Verify result`);
      testBody = `  // Navigate to ${entity} page
  await page.goto('${url}/${entity}s');

  // Perform action: ${scenario.scenario}
  // TODO: Implement specific test steps

  // Verify result
  await expect(page).toHaveURL(/${entity}s/i);
`;
  }

  const code = `import { test, expect } from '@playwright/test';

/**
 * ${scenario.scenario}
 * ${scenario.isEdgeCase ? '[Edge Case]' : '[Core Scenario]'}
 *
 * Steps:
 * ${steps.map((s, i) => `${i + 1}. ${s}`).join('\n * ')}
 */
test('${testName}', async ({ page }) => {
${testBody}});
`;

  const validation = validatePlaywrightSyntax(code);
  const selectors = extractSelectors(code);
  const assertions = extractAssertions(code);
  const complexity = estimateComplexity(code);

  return {
    code,
    test_name: testName,
    description: scenario.scenario,
    steps,
    selectors,
    assertions,
    syntax_valid: validation.valid,
    syntax_errors: validation.errors.length > 0 ? validation.errors : undefined,
    estimated_duration_ms: scenario.isEdgeCase ? 8000 : 15000,
    complexity,
    warnings: scenario.isEdgeCase ? ['Edge case test - may need specific test data setup'] : undefined,
  };
}

function parseGherkinScenario(gherkin: string): { feature: string; scenario: string; steps: { keyword: string; text: string }[] } {
  const lines = gherkin.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  let feature = 'Test Feature';
  let scenario = 'Test Scenario';
  const steps: { keyword: string; text: string }[] = [];

  for (const line of lines) {
    if (line.toLowerCase().startsWith('feature:')) {
      feature = line.substring(8).trim();
    } else if (line.toLowerCase().startsWith('scenario:')) {
      scenario = line.substring(9).trim();
    } else if (/^(given|when|then|and|but)\s+/i.test(line)) {
      const match = line.match(/^(given|when|then|and|but)\s+(.+)/i);
      if (match) {
        steps.push({
          keyword: match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase(),
          text: match[2].trim(),
        });
      }
    }
  }

  return { feature, scenario, steps };
}

function convertGherkinStepToPlaywright(keyword: string, text: string, baseUrl: string): { action: string; code: string } {
  const lowerText = text.toLowerCase();

  if (lowerText.includes('on') && (lowerText.includes('page') || lowerText.includes('url'))) {
    const pageMatch = text.match(/(?:on\s+(?:the\s+)?)?(.+?)\s*page/i);
    const pageName = pageMatch ? pageMatch[1].toLowerCase().replace(/\s+/g, '-') : 'home';
    return {
      action: `Navigate to ${pageName} page`,
      code: `  // ${keyword}: ${text}\n  await page.goto('${baseUrl}/${pageName}');`,
    };
  }

  if (lowerText.includes('enter') && (lowerText.includes('credential') || lowerText.includes('email') || lowerText.includes('password'))) {
    if (lowerText.includes('valid')) {
      return {
        action: 'Enter valid credentials',
        code: `  // ${keyword}: ${text}\n  await page.getByLabel(/email|username/i).fill('user@example.com');\n  await page.getByLabel(/password/i).fill('SecurePassword123!');`,
      };
    } else if (lowerText.includes('invalid')) {
      return {
        action: 'Enter invalid credentials',
        code: `  // ${keyword}: ${text}\n  await page.getByLabel(/email|username/i).fill('invalid@example.com');\n  await page.getByLabel(/password/i).fill('wrongpassword');`,
      };
    }
  }

  if (lowerText.includes('click') || lowerText.includes('press') || lowerText.includes('submit')) {
    const buttonMatch = text.match(/(?:click|press|submit)(?:\s+(?:the|a|on))?\s+["']?(.+?)["']?\s*(?:button|link)?$/i);
    const buttonName = buttonMatch ? buttonMatch[1] : 'submit';
    return {
      action: `Click ${buttonName} button`,
      code: `  // ${keyword}: ${text}\n  await page.getByRole('button', { name: /${buttonName.replace(/[^a-zA-Z0-9\s]/g, '')}/i }).click();`,
    };
  }

  if (lowerText.includes('enter') || lowerText.includes('fill') || lowerText.includes('type')) {
    const inputMatch = text.match(/(?:enter|fill|type)\s+["']?(.+?)["']?\s+(?:in|into)?\s+(?:the\s+)?["']?(.+?)["']?\s*(?:field|input)?$/i);
    if (inputMatch) {
      return {
        action: `Fill ${inputMatch[2]} field`,
        code: `  // ${keyword}: ${text}\n  await page.getByLabel(/${inputMatch[2]}/i).fill('${inputMatch[1]}');`,
      };
    }
  }

  if (lowerText.includes('see') || lowerText.includes('visible') || lowerText.includes('displayed') || lowerText.includes('shown')) {
    const elementMatch = text.match(/(?:see|visible|displayed|shown)(?:\s+(?:the|a))?\s+["']?(.+?)["']?$/i);
    const element = elementMatch ? elementMatch[1] : 'expected content';
    return {
      action: `Verify ${element} is visible`,
      code: `  // ${keyword}: ${text}\n  await expect(page.getByText(/${element.replace(/[^a-zA-Z0-9\s]/g, '')}/i)).toBeVisible();`,
    };
  }

  if (lowerText.includes('redirect') || lowerText.includes('url') || lowerText.includes('navigate')) {
    const urlMatch = text.match(/(?:redirect|navigate)(?:d)?\s+(?:to\s+)?(?:the\s+)?["']?(.+?)["']?$/i);
    const targetPage = urlMatch ? urlMatch[1].toLowerCase().replace(/\s+/g, '-').replace(/page$/, '') : 'home';
    return {
      action: `Verify redirect to ${targetPage}`,
      code: `  // ${keyword}: ${text}\n  await expect(page).toHaveURL(/${targetPage}/i);`,
    };
  }

  if (lowerText.includes('error') || lowerText.includes('message')) {
    return {
      action: 'Verify error message displayed',
      code: `  // ${keyword}: ${text}\n  await expect(page.getByRole('alert')).toBeVisible();\n  await expect(page.getByText(/error|invalid/i)).toBeVisible();`,
    };
  }

  if (lowerText.includes('logged in') || lowerText.includes('authenticated') || lowerText.includes('signed in')) {
    return {
      action: 'Verify user is logged in',
      code: `  // ${keyword}: ${text}\n  await expect(page.getByText(/welcome|dashboard|profile/i)).toBeVisible();`,
    };
  }

  return {
    action: text,
    code: `  // ${keyword}: ${text}\n  // TODO: Implement step\n  await page.waitForTimeout(1000);`,
  };
}

function convertGherkinToPlaywright(gherkin: string, baseUrl: string, featureName?: string): ConvertedGherkinTest {
  const parsed = parseGherkinScenario(gherkin);
  const feature = featureName || parsed.feature;
  const scenario = parsed.scenario;

  const testName = scenario
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(' ')
    .map((word, i) => i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');

  const url = baseUrl || 'https://example.com';

  const convertedSteps: GherkinStep[] = parsed.steps.map(step => {
    const converted = convertGherkinStepToPlaywright(step.keyword, step.text, url);
    return {
      keyword: step.keyword as GherkinStep['keyword'],
      text: step.text,
      action: converted.action,
      playwright_code: converted.code,
    };
  });

  const stepsCode = convertedSteps.map(s => s.playwright_code).join('\n\n');

  const code = `import { test, expect } from '@playwright/test';

/**
 * Feature: ${feature}
 * Scenario: ${scenario}
 *
 * BDD Steps:
 * ${parsed.steps.map(s => `${s.keyword} ${s.text}`).join('\n * ')}
 */
test.describe('${feature}', () => {
  test('${scenario}', async ({ page }) => {
${stepsCode}
  });
});
`;

  const validation = validatePlaywrightSyntax(code);
  const complexity = convertedSteps.length <= 3 ? 'simple' : convertedSteps.length <= 6 ? 'medium' : 'complex';

  return {
    code,
    test_name: testName,
    feature_name: feature,
    scenario_name: scenario,
    steps: convertedSteps,
    syntax_valid: validation.valid,
    syntax_errors: validation.errors.length > 0 ? validation.errors : undefined,
    complexity,
  };
}

// =============================================================================
// Main Route Registration
// =============================================================================

export async function naturalLanguageTestRoutes(app: FastifyInstance): Promise<void> {
  // NOTE: All routes have been moved to ai-test-generation.ts to avoid duplicate registration:
  // - /api/v1/ai/generate-playwright-test
  // - /api/v1/ai/generate-test-suite
  // - /api/v1/ai/gherkin-to-playwright
  // - /api/v1/ai/validate-test
  //
  // This file retains the helper functions (parseUserStoryToScenarios, generateTestForScenario,
  // convertGherkinToPlaywright, etc.) which are re-exported and used by ai-test-generation.ts.
  //
  // This function is kept for backward compatibility but registers no routes.
}
