/**
 * E2E Test Suite Template
 * Feature #1731: Generates E2E tests from site analysis
 *
 * Creates tests for:
 * - Navigation and menu links
 * - Forms (login, signup, contact, etc.)
 * - User flows and interactions
 * - Button clicks and actions
 */

import { TestSuiteTemplate, TemplateGeneratorOptions, GeneratedTest, TestStep } from './types';
import type { SiteAnalysis } from '../../services/crawl4ai';

export function generateE2ETemplate(options: TemplateGeneratorOptions): TestSuiteTemplate {
  const { baseUrl, siteAnalysis, projectName } = options;
  const tests: GeneratedTest[] = [];

  // 1. Page load test
  tests.push({
    name: `Homepage loads correctly`,
    description: `Verify that ${baseUrl} loads successfully and displays expected content`,
    type: 'e2e',
    target_url: baseUrl,
    steps: [
      { action: 'navigate', value: baseUrl, description: 'Navigate to homepage' },
      { action: 'wait', value: '2000', description: 'Wait for page load' },
      { action: 'assert', selector: 'title', value: siteAnalysis.title || 'Page Title', description: 'Verify page title' },
    ],
  });

  // 2. Navigation tests
  if (siteAnalysis.navigation.menuItems.length > 0) {
    const navTests = generateNavigationTests(siteAnalysis, baseUrl);
    tests.push(...navTests);
  }

  // 3. Form tests
  if (siteAnalysis.forms.length > 0) {
    const formTests = generateFormTests(siteAnalysis, baseUrl);
    tests.push(...formTests);
  }

  // 4. Login flow test
  if (siteAnalysis.hasLogin) {
    tests.push(generateLoginTest(siteAnalysis, baseUrl));
  }

  // 5. Search functionality test
  if (siteAnalysis.hasSearch) {
    tests.push(generateSearchTest(siteAnalysis, baseUrl));
  }

  // 6. Cart/checkout test
  if (siteAnalysis.hasCart) {
    tests.push(generateCartTest(siteAnalysis, baseUrl));
  }

  // 7. Link verification tests
  const linkTests = generateLinkTests(siteAnalysis, baseUrl);
  tests.push(...linkTests);

  return {
    name: `${projectName || 'Site'} E2E Tests`,
    description: `End-to-end functional tests for ${baseUrl}`,
    type: 'e2e',
    tests,
  };
}

function generateNavigationTests(analysis: SiteAnalysis, baseUrl: string): GeneratedTest[] {
  const tests: GeneratedTest[] = [];

  // Test main navigation items (limit to 5)
  const navItems = analysis.navigation.menuItems.slice(0, 5);

  if (navItems.length > 0) {
    tests.push({
      name: 'Navigation menu displays correctly',
      description: 'Verify all main navigation items are visible',
      type: 'e2e',
      target_url: baseUrl,
      steps: [
        { action: 'navigate', value: baseUrl },
        { action: 'wait', value: '1000' },
        ...navItems.map(item => ({
          action: 'assert' as const,
          selector: `nav`,
          value: item,
          description: `Verify "${item}" is visible in navigation`,
        })),
      ],
    });
  }

  return tests;
}

function generateFormTests(analysis: SiteAnalysis, baseUrl: string): GeneratedTest[] {
  const tests: GeneratedTest[] = [];

  // Test each form (limit to 3)
  analysis.forms.slice(0, 3).forEach((form, index) => {
    if (form.fields.length > 0) {
      const steps: TestStep[] = [
        { action: 'navigate', value: baseUrl },
        { action: 'wait', value: '1000' },
      ];

      // Add field interactions
      form.fields.slice(0, 5).forEach(field => {
        steps.push({
          action: 'fill',
          selector: `input[name="${field}"]`,
          value: getPlaceholderValue(field),
          description: `Fill ${field} field`,
        });
      });

      tests.push({
        name: `Form ${index + 1} - Field validation`,
        description: `Test form with fields: ${form.fields.slice(0, 3).join(', ')}`,
        type: 'e2e',
        target_url: baseUrl,
        steps,
      });
    }
  });

  return tests;
}

function generateLoginTest(analysis: SiteAnalysis, baseUrl: string): GeneratedTest {
  return {
    name: 'Login form interaction',
    description: 'Test login form fields and submission',
    type: 'e2e',
    target_url: baseUrl,
    steps: [
      { action: 'navigate', value: baseUrl },
      { action: 'wait', value: '1000' },
      { action: 'click', selector: 'a[href*="login"], button:has-text("Login"), a:has-text("Sign in")', description: 'Click login link' },
      { action: 'wait', value: '1000' },
      { action: 'fill', selector: 'input[type="email"], input[name="email"], input[name="username"]', value: 'test@example.com', description: 'Enter email' },
      { action: 'fill', selector: 'input[type="password"]', value: 'TestPassword123', description: 'Enter password' },
    ],
  };
}

function generateSearchTest(analysis: SiteAnalysis, baseUrl: string): GeneratedTest {
  return {
    name: 'Search functionality',
    description: 'Test search input and results',
    type: 'e2e',
    target_url: baseUrl,
    steps: [
      { action: 'navigate', value: baseUrl },
      { action: 'wait', value: '1000' },
      { action: 'fill', selector: 'input[type="search"], input[name="q"], input[name="search"]', value: 'test query', description: 'Enter search term' },
      { action: 'press', value: 'Enter', description: 'Submit search' },
      { action: 'wait', value: '2000', description: 'Wait for results' },
    ],
  };
}

function generateCartTest(analysis: SiteAnalysis, baseUrl: string): GeneratedTest {
  return {
    name: 'Cart functionality',
    description: 'Test add to cart and cart display',
    type: 'e2e',
    target_url: baseUrl,
    steps: [
      { action: 'navigate', value: baseUrl },
      { action: 'wait', value: '1000' },
      { action: 'click', selector: 'button:has-text("Add to Cart"), button:has-text("Add to Bag")', description: 'Click add to cart' },
      { action: 'wait', value: '1000' },
      { action: 'click', selector: 'a[href*="cart"], button:has-text("Cart")', description: 'Open cart' },
    ],
  };
}

function generateLinkTests(analysis: SiteAnalysis, baseUrl: string): GeneratedTest[] {
  const tests: GeneratedTest[] = [];

  // Test internal links (limit to 5)
  const internalLinks = analysis.links.filter(l => !l.isExternal && l.href).slice(0, 5);

  if (internalLinks.length > 0) {
    tests.push({
      name: 'Internal links are accessible',
      description: 'Verify key internal links lead to valid pages',
      type: 'e2e',
      target_url: baseUrl,
      steps: [
        { action: 'navigate', value: baseUrl },
        { action: 'wait', value: '1000' },
        ...internalLinks.map(link => ({
          action: 'assert' as const,
          selector: `a[href="${link.href}"]`,
          description: `Verify link "${link.text || link.href}" exists`,
        })),
      ],
    });
  }

  return tests;
}

function getPlaceholderValue(fieldName: string): string {
  const fieldLower = fieldName.toLowerCase();
  if (fieldLower.includes('email')) return 'test@example.com';
  if (fieldLower.includes('phone') || fieldLower.includes('tel')) return '555-123-4567';
  if (fieldLower.includes('name')) return 'Test User';
  if (fieldLower.includes('password')) return 'TestPass123';
  if (fieldLower.includes('address')) return '123 Test Street';
  if (fieldLower.includes('city')) return 'Test City';
  if (fieldLower.includes('zip') || fieldLower.includes('postal')) return '12345';
  return 'Test value';
}

export default generateE2ETemplate;
