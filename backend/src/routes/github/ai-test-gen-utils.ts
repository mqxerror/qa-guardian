/**
 * AI Test Generation Utilities
 *
 * Helper functions for generating Playwright tests from descriptions.
 *
 * Feature #1375: Extracted from ai-test-generation.ts for modularity
 *
 * @module ai-test-gen-utils
 */

import type { GeneratedTest } from './ai-test-gen-types.js';

// =============================================================================
// Validation Functions
// =============================================================================

export function validatePlaywrightSyntax(code: string): { valid: boolean; errors: string[] } {
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
  if (singleQuotes % 2 !== 0) errors.push('Unclosed single-quoted string');
  if (doubleQuotes % 2 !== 0) errors.push('Unclosed double-quoted string');
  if (backticks % 2 !== 0) errors.push('Unclosed template literal');

  return { valid: errors.length === 0, errors };
}

// =============================================================================
// Extraction Functions
// =============================================================================

export function extractSelectors(code: string): string[] {
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
      if (!selectors.includes(match[1])) selectors.push(match[1]);
    }
  }
  return selectors;
}

export function extractAssertions(code: string): string[] {
  const assertions: string[] = [];
  const expectRegex = /expect\([^)]+\)\.[^;]+/g;
  let match;
  while ((match = expectRegex.exec(code)) !== null) {
    assertions.push(match[0].trim());
  }
  return assertions;
}

export function estimateComplexity(code: string): 'simple' | 'medium' | 'complex' {
  const lineCount = code.split('\n').filter(l => l.trim()).length;
  const assertionCount = (code.match(/expect\(/g) || []).length;
  const interactionCount = (code.match(/page\.(click|fill|type|press|select)/g) || []).length;
  const score = lineCount * 0.5 + assertionCount * 2 + interactionCount * 1.5;
  if (score < 15) return 'simple';
  if (score < 40) return 'medium';
  return 'complex';
}

// =============================================================================
// Step Generation Functions
// =============================================================================

export function parseDescriptionToSteps(description: string, category: string): string[] {
  const steps: string[] = ['Navigate to the page'];
  const lowerDesc = description.toLowerCase();

  switch (category) {
    case 'authentication':
      if (lowerDesc.includes('email') || lowerDesc.includes('username')) steps.push('Enter username/email');
      if (lowerDesc.includes('password')) steps.push('Enter password');
      if (lowerDesc.includes('submit') || lowerDesc.includes('click') || lowerDesc.includes('login')) steps.push('Click submit button');
      if (lowerDesc.includes('success') || lowerDesc.includes('redirect')) steps.push('Verify successful login');
      if (lowerDesc.includes('error') || lowerDesc.includes('invalid')) steps.push('Verify error message displayed');
      break;
    case 'form':
      steps.push('Fill in form fields');
      if (lowerDesc.includes('submit')) steps.push('Submit the form');
      if (lowerDesc.includes('valid')) steps.push('Verify form submission success');
      if (lowerDesc.includes('error')) steps.push('Verify validation error messages');
      break;
    case 'navigation':
      if (lowerDesc.includes('menu') || lowerDesc.includes('nav')) steps.push('Locate navigation element');
      steps.push('Click on the target link/button', 'Verify navigation to expected page');
      break;
    case 'search':
      steps.push('Enter search query');
      if (lowerDesc.includes('submit') || lowerDesc.includes('enter')) steps.push('Submit search');
      steps.push('Verify search results displayed');
      break;
    case 'ecommerce':
      if (lowerDesc.includes('add') && lowerDesc.includes('cart')) steps.push('Add item to cart');
      if (lowerDesc.includes('checkout')) steps.push('Proceed to checkout');
      if (lowerDesc.includes('payment')) steps.push('Enter payment details');
      steps.push('Verify expected result');
      break;
    default:
      steps.push('Interact with page elements', 'Verify expected behavior');
  }
  return steps;
}

// =============================================================================
// Test Body Generation Functions
// =============================================================================

export function generateAuthTest(desc: string, url: string, includeAssertions: boolean): string {
  let code = `  // Navigate to login page\n  await page.goto('${url}/login');\n\n`;
  if (desc.includes('email') || desc.includes('username')) {
    code += `  // Enter username/email\n  await page.getByLabel('Email').fill('user@example.com');\n\n`;
  }
  if (desc.includes('password')) {
    code += `  // Enter password\n  await page.getByLabel('Password').fill('SecurePassword123!');\n\n`;
  }
  code += `  // Click login button\n  await page.getByRole('button', { name: /log\\s*in|sign\\s*in|submit/i }).click();\n\n`;
  if (includeAssertions) {
    if (desc.includes('success') || desc.includes('dashboard') || (!desc.includes('error') && !desc.includes('fail'))) {
      code += `  // Verify successful login\n  await expect(page).toHaveURL(/dashboard|home|profile/i);\n`;
      code += `  await expect(page.getByText(/welcome|logged in/i)).toBeVisible();\n`;
    } else {
      code += `  // Verify error message displayed\n  await expect(page.getByRole('alert')).toBeVisible();\n`;
      code += `  await expect(page.getByText(/invalid|incorrect|error/i)).toBeVisible();\n`;
    }
  }
  return code;
}

export function generateFormTest(desc: string, url: string, includeAssertions: boolean): string {
  let code = `  // Navigate to the form page\n  await page.goto('${url}');\n\n  // Fill in form fields\n`;
  if (desc.includes('name')) code += `  await page.getByLabel('Name').fill('John Doe');\n`;
  if (desc.includes('email')) code += `  await page.getByLabel('Email').fill('john@example.com');\n`;
  if (desc.includes('phone')) code += `  await page.getByLabel('Phone').fill('+1234567890');\n`;
  if (desc.includes('message')) code += `  await page.getByLabel('Message').fill('Test message content');\n`;
  code += `\n  // Submit the form\n  await page.getByRole('button', { name: /submit|send|save/i }).click();\n\n`;
  if (includeAssertions) {
    if (desc.includes('error') || desc.includes('invalid')) {
      code += `  // Verify validation errors\n  await expect(page.getByRole('alert')).toBeVisible();\n`;
    } else {
      code += `  // Verify form submission success\n  await expect(page.getByText(/success|thank you|submitted/i)).toBeVisible();\n`;
    }
  }
  return code;
}

export function generateNavigationTest(desc: string, url: string, includeAssertions: boolean): string {
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

export function generateSearchTest(desc: string, url: string, includeAssertions: boolean): string {
  let code = `  // Navigate to the page with search\n  await page.goto('${url}');\n\n`;
  const termMatch = desc.match(/(?:search|find|look)\s+(?:for\s+)?["']?([^"']+?)["']?(?:\s+(?:and|then)|$)/i);
  const searchTerm = termMatch ? termMatch[1].trim() : 'test query';
  code += `  // Enter search query\n  await page.getByRole('searchbox').fill('${searchTerm}');\n\n`;
  code += `  // Submit search\n  await page.getByRole('searchbox').press('Enter');\n\n`;
  if (includeAssertions) {
    code += `  // Verify search results are displayed\n  await expect(page.getByRole('list')).toBeVisible();\n`;
  }
  return code;
}

export function generateEcommerceTest(desc: string, url: string, includeAssertions: boolean): string {
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

export function generateGenericTest(desc: string, url: string, includeAssertions: boolean): string {
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

// =============================================================================
// Full Test Generation Functions
// =============================================================================

export function generateE2ETest(testName: string, description: string, url: string, steps: string[], category: string, includeAssertions: boolean, includeScreenshot: boolean): string {
  const lowerDesc = description.toLowerCase();
  let testBody = '';

  switch (category) {
    case 'authentication': testBody = generateAuthTest(lowerDesc, url, includeAssertions); break;
    case 'form': testBody = generateFormTest(lowerDesc, url, includeAssertions); break;
    case 'navigation': testBody = generateNavigationTest(lowerDesc, url, includeAssertions); break;
    case 'search': testBody = generateSearchTest(lowerDesc, url, includeAssertions); break;
    case 'ecommerce': testBody = generateEcommerceTest(lowerDesc, url, includeAssertions); break;
    default: testBody = generateGenericTest(lowerDesc, url, includeAssertions);
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

export function generateVisualRegressionTest(testName: string, description: string, url: string, steps: string[]): string {
  return `import { test, expect } from '@playwright/test';

/**
 * Visual Regression Test: ${description}
 *
 * Steps:
 * ${steps.map((s, i) => `${i + 1}. ${s}`).join('\n * ')}
 */
test('${testName}', async ({ page }) => {
  await page.goto('${url}');
  await page.waitForLoadState('networkidle');

  await page.evaluate(() => {
    document.querySelectorAll('[data-dynamic], .timestamp, .date').forEach(el => {
      (el as HTMLElement).style.visibility = 'hidden';
    });
  });

  await expect(page).toHaveScreenshot('${testName}.png', {
    fullPage: true,
    threshold: 0.1,
    maxDiffPixelRatio: 0.02,
  });
});
`;
}

export function generateAccessibilityTest(testName: string, description: string, url: string, steps: string[]): string {
  return `import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility Test: ${description}
 *
 * Steps:
 * ${steps.map((s, i) => `${i + 1}. ${s}`).join('\n * ')}
 */
test('${testName}', async ({ page }) => {
  await page.goto('${url}');
  await page.waitForLoadState('networkidle');

  const accessibilityScanResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();

  expect(accessibilityScanResults.violations).toEqual([]);
});
`;
}

export function generateLoadTestK6(testName: string, description: string, url: string): string {
  return `import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * Load Test: ${description}
 */

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 10 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
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
`;
}

// =============================================================================
// Main Test Generation Function
// =============================================================================

export function generatePlaywrightTest(description: string, baseUrl?: string, testType: string = 'e2e', includeAssertions: boolean = true, includeScreenshot: boolean = false): GeneratedTest {
  const lowerDesc = description.toLowerCase();
  const warnings: string[] = [];

  let testCategory = 'general';
  if (lowerDesc.includes('login') || lowerDesc.includes('sign in') || lowerDesc.includes('authenticate')) testCategory = 'authentication';
  else if (lowerDesc.includes('form') || lowerDesc.includes('submit') || lowerDesc.includes('input')) testCategory = 'form';
  else if (lowerDesc.includes('navigate') || lowerDesc.includes('click') || lowerDesc.includes('link')) testCategory = 'navigation';
  else if (lowerDesc.includes('search') || lowerDesc.includes('filter')) testCategory = 'search';
  else if (lowerDesc.includes('cart') || lowerDesc.includes('checkout') || lowerDesc.includes('buy')) testCategory = 'ecommerce';

  const testName = description.replace(/[^a-zA-Z0-9\s]/g, '').split(' ').slice(0, 6)
    .map((word, i) => i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join('');

  const steps = parseDescriptionToSteps(description, testCategory);
  const url = baseUrl || 'https://example.com';
  let code = '';

  if (testType === 'visual_regression') code = generateVisualRegressionTest(testName, description, url, steps);
  else if (testType === 'accessibility') code = generateAccessibilityTest(testName, description, url, steps);
  else if (testType === 'load') code = generateLoadTestK6(testName, description, url);
  else code = generateE2ETest(testName, description, url, steps, testCategory, includeAssertions, includeScreenshot);

  const validation = validatePlaywrightSyntax(code);
  const selectors = extractSelectors(code);
  const assertions = extractAssertions(code);
  const complexity = estimateComplexity(code);
  const estimatedDuration = complexity === 'simple' ? 5000 : complexity === 'medium' ? 15000 : 30000;

  if (selectors.length === 0) warnings.push('No selectors were generated. You may need to add specific element selectors.');
  if (includeAssertions && assertions.length === 0) warnings.push('No assertions were generated. Consider adding expect() statements.');
  if (!baseUrl) warnings.push('No base URL provided. Using placeholder URL.');

  return {
    code, test_name: testName, description, steps, selectors, assertions,
    syntax_valid: validation.valid, syntax_errors: validation.errors.length > 0 ? validation.errors : undefined,
    estimated_duration_ms: estimatedDuration, complexity, warnings: warnings.length > 0 ? warnings : undefined,
  };
}
