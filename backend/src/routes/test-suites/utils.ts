// Test Suites Module - Utility Functions
// Helper functions for test suite operations

import { TestStep } from './types';

// Feature #875: Generate Playwright code from test steps
export function generatePlaywrightCode(
  testName: string,
  steps: TestStep[],
  baseUrl: string,
  format: 'typescript' | 'javascript'
): string {
  const lines: string[] = [];
  const isTs = format === 'typescript';

  // Import statement
  lines.push(`import { test, expect } from '@playwright/test';`);
  lines.push('');

  // Test function
  lines.push(`test('${testName.replace(/'/g, "\\'")}', async ({ page }) => {`);

  // Navigate to base URL as the first step if no navigate action
  const hasNavigate = steps.some(s => s.action === 'navigate');
  if (!hasNavigate && baseUrl) {
    lines.push(`  // Navigate to base URL`);
    lines.push(`  await page.goto('${baseUrl}');`);
    lines.push('');
  }

  // Convert each step to Playwright code
  for (const step of steps.sort((a, b) => a.order - b.order)) {
    const code = stepToPlaywrightCode(step);
    if (code) {
      lines.push(`  ${code}`);
    }
  }

  lines.push('});');
  lines.push('');

  return lines.join('\n');
}

// Convert a single test step to Playwright code
export function stepToPlaywrightCode(step: TestStep): string {
  const { action, selector, value } = step;

  switch (action) {
    case 'navigate':
      return `await page.goto('${value || ''}');`;

    case 'click':
      if (!selector) return `// click: no selector provided`;
      return `await page.locator('${selector}').click();`;

    case 'dblclick':
      if (!selector) return `// dblclick: no selector provided`;
      return `await page.locator('${selector}').dblclick();`;

    case 'fill':
      if (!selector) return `// fill: no selector provided`;
      return `await page.locator('${selector}').fill('${value || ''}');`;

    case 'type':
      if (!selector) return `// type: no selector provided`;
      return `await page.locator('${selector}').pressSequentially('${value || ''}');`;

    case 'clear':
      if (!selector) return `// clear: no selector provided`;
      return `await page.locator('${selector}').clear();`;

    case 'check':
      if (!selector) return `// check: no selector provided`;
      return `await page.locator('${selector}').check();`;

    case 'uncheck':
      if (!selector) return `// uncheck: no selector provided`;
      return `await page.locator('${selector}').uncheck();`;

    case 'select':
      if (!selector) return `// select: no selector provided`;
      return `await page.locator('${selector}').selectOption('${value || ''}');`;

    case 'hover':
      if (!selector) return `// hover: no selector provided`;
      return `await page.locator('${selector}').hover();`;

    case 'focus':
      if (!selector) return `// focus: no selector provided`;
      return `await page.locator('${selector}').focus();`;

    case 'blur':
      if (!selector) return `// blur: no selector provided`;
      return `await page.locator('${selector}').blur();`;

    case 'press':
      if (!selector) return `await page.keyboard.press('${value || 'Enter'}');`;
      return `await page.locator('${selector}').press('${value || 'Enter'}');`;

    case 'scroll':
      if (selector) {
        return `await page.locator('${selector}').scrollIntoViewIfNeeded();`;
      }
      return `await page.evaluate(() => window.scrollBy(0, ${value || 500}));`;

    case 'wait':
      const ms = parseInt(value || '1000', 10);
      return `await page.waitForTimeout(${ms});`;

    case 'assert':
      if (!selector) return `// assert: no selector provided`;
      if (value) {
        return `await expect(page.locator('${selector}')).toHaveText('${value}');`;
      }
      return `await expect(page.locator('${selector}')).toBeVisible();`;

    case 'assert_text':
      // Assert text is visible on the page
      if (value) {
        return `await expect(page.getByText('${value}')).toBeVisible();`;
      }
      return `// assert_text: no value provided`;

    case 'assert_visible':
      if (selector) {
        return `await expect(page.locator('${selector}')).toBeVisible();`;
      }
      return `// assert_visible: no selector provided`;

    case 'screenshot':
      if (value) {
        return `await page.screenshot({ path: '${value}' });`;
      }
      return `await page.screenshot();`;

    case 'upload':
      if (!selector) return `// upload: no selector provided`;
      return `await page.locator('${selector}').setInputFiles('${value || ''}');`;

    case 'download':
      return `// download: Start waiting for download before clicking\nconst downloadPromise = page.waitForEvent('download');\n// Then trigger the download action`;

    case 'evaluate':
      return `await page.evaluate(() => { ${value || ''} });`;

    default:
      return `// Unknown action: ${action}`;
  }
}
