// Feature #48: Extracted code generation utilities from TestDetailPage.tsx
// This file contains:
// - generatePlaywrightCode: Generate Playwright test code from test steps
// - generateK6Script: Generate K6 load test scripts
// - k6Templates: Predefined K6 script templates
// - highlightJavaScript: Syntax highlighting for JavaScript/K6 code

import type { TestType, TestStep } from './types';

// Extended step type for accessibility checks (optional properties not in base TestStep)
interface A11yStep extends TestStep {
  a11y_wcag_level?: string;
  a11y_threshold?: number;
}

/**
 * Generate Playwright code from test steps
 */
export function generatePlaywrightCode(
  steps: TestType['steps'],
  testName: string = 'Untitled Test'
): string {
  if (!steps || steps.length === 0) return '// No steps defined yet';

  const lines: string[] = [
    `import { test, expect } from '@playwright/test';`,
    '',
    `test('${testName}', async ({ page }) => {`,
  ];

  steps.forEach((step, index) => {
    const indent = '  ';
    const comment = `// Step ${index + 1}: ${step.action}`;
    lines.push(`${indent}${comment}`);

    switch (step.action) {
      case 'navigate':
        lines.push(`${indent}await page.goto('${step.value || ''}');`);
        break;
      case 'click':
        lines.push(`${indent}await page.locator('${step.selector || ''}').click();`);
        break;
      case 'fill':
        lines.push(`${indent}await page.locator('${step.selector || ''}').fill('${step.value || ''}');`);
        break;
      case 'type':
        lines.push(`${indent}await page.locator('${step.selector || ''}').type('${step.value || ''}');`);
        break;
      case 'wait':
        lines.push(`${indent}await page.waitForTimeout(${step.value || 1000});`);
        break;
      case 'assert_text':
        lines.push(`${indent}await expect(page.getByText('${step.value || ''}')).toBeVisible();`);
        break;
      case 'screenshot': {
        const screenshotName = step.value || `step-${index + 1}`;
        lines.push(`${indent}await page.screenshot({ path: '${screenshotName}.png' });`);
        break;
      }
      case 'accessibility_check': {
        // Cast to A11yStep for accessibility-specific properties
        const a11yStep = step as A11yStep;
        const a11yLevel = a11yStep.a11y_wcag_level || 'AA';
        const a11yThreshold = a11yStep.a11y_threshold || 0;
        lines.push(`${indent}// Accessibility check - WCAG ${a11yLevel} (threshold: ${a11yThreshold})`);
        lines.push(`${indent}const a11yResults_${index} = await new AxeBuilder({ page })`);
        lines.push(`${indent}  .withTags(['wcag2a', 'wcag2aa'${a11yLevel === 'AAA' ? ", 'wcag2aaa'" : ''}])`);
        lines.push(`${indent}  .analyze();`);
        lines.push(`${indent}expect(a11yResults_${index}.violations.length).toBeLessThanOrEqual(${a11yThreshold});`);
        break;
      }
      default:
        lines.push(`${indent}// Unknown action: ${step.action}`);
    }
    lines.push('');
  });

  lines.push('});');
  return lines.join('\n');
}

/**
 * Generate K6 load test script from test configuration
 */
export function generateK6Script(test: TestType | null): string {
  const targetUrl = test?.target_url || 'https://example.com';
  const virtualUsers = test?.virtual_users || 10;
  const duration = test?.duration || 60;
  const rampUpTime = test?.ramp_up_time || 10;

  return `import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '${rampUpTime}s', target: ${virtualUsers} },  // Ramp up
    { duration: '${duration - rampUpTime}s', target: ${virtualUsers} }, // Steady state
    { duration: '10s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    errors: ['rate<0.1'],              // Error rate should be below 10%
  },
};

// Default function - runs for each virtual user iteration
export default function () {
  // GET request to target URL
  const response = http.get('${targetUrl}');

  // Check response status
  const checkResult = check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  // Track errors
  errorRate.add(!checkResult);

  // Think time between requests (1-3 seconds)
  sleep(Math.random() * 2 + 1);
}

// Setup function - runs once before the test
export function setup() {
  console.log('Starting load test against ${targetUrl}');
  console.log('Virtual Users: ${virtualUsers}');
  console.log('Duration: ${duration}s');
  return { startTime: new Date().toISOString() };
}

// Teardown function - runs once after the test
export function teardown(data) {
  console.log('Load test completed');
  console.log('Started at:', data.startTime);
  console.log('Ended at:', new Date().toISOString());
}
`;
}

/**
 * K6 script templates for various load test scenarios
 */
export interface K6Template {
  name: string;
  description: string;
  script: string;
}

export function getK6Templates(targetUrl: string = 'https://example.com'): Record<string, K6Template> {
  return {
    'load-test': {
      name: '📈 Load Test',
      description: 'Standard load test with VU ramp-up',
      script: `import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '10s', target: 10 },  // Ramp up
    { duration: '50s', target: 10 }, // Steady state
    { duration: '10s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    errors: ['rate<0.1'],
  },
};

export default function () {
  const response = http.get('${targetUrl}');

  const checkResult = check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  errorRate.add(!checkResult);
  sleep(Math.random() * 2 + 1);
}
`,
    },
    'stress-test': {
      name: '💥 Stress Test',
      description: 'High load to find breaking points',
      script: `import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp to 100 users
    { duration: '5m', target: 100 },   // Stay at 100
    { duration: '2m', target: 200 },   // Ramp to 200
    { duration: '5m', target: 200 },   // Stay at 200
    { duration: '2m', target: 300 },   // Ramp to 300
    { duration: '5m', target: 300 },   // Stay at 300
    { duration: '2m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(99)<1500'], // 99% under 1.5s
    errors: ['rate<0.1'],
  },
};

export default function () {
  const response = http.get('${targetUrl}');

  const checkResult = check(response, {
    'status is 200': (r) => r.status === 200,
    'response time OK': (r) => r.timings.duration < 1500,
  });

  errorRate.add(!checkResult);
  sleep(1);
}
`,
    },
    'spike-test': {
      name: '⚡ Spike Test',
      description: 'Sudden traffic surge simulation',
      script: `import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 10 },    // Normal load
    { duration: '1m', target: 10 },     // Normal load
    { duration: '10s', target: 1000 },  // Spike!
    { duration: '3m', target: 1000 },   // Stay at spike
    { duration: '10s', target: 10 },    // Scale down
    { duration: '3m', target: 10 },     // Recovery
    { duration: '10s', target: 0 },     // End
  ],
};

export default function () {
  const response = http.get('${targetUrl}');

  check(response, {
    'status is 200': (r) => r.status === 200,
  });

  sleep(1);
}
`,
    },
    'soak-test': {
      name: '🕐 Soak Test',
      description: 'Extended duration for reliability',
      script: `import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '5m', target: 50 },   // Ramp up
    { duration: '4h', target: 50 },   // Soak at 50 VUs for 4 hours
    { duration: '5m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],   // Less than 1% failures
  },
};

export default function () {
  const response = http.get('${targetUrl}');

  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(Math.random() * 3 + 2); // 2-5 second think time
}
`,
    },
    'api-test': {
      name: '🔌 API Test',
      description: 'REST API endpoint testing',
      script: `import http from 'k6/http';
import { check, group, sleep } from 'k6';

const BASE_URL = '${targetUrl}';

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<200'],
    'http_req_duration{name:GET}': ['p(95)<100'],
    'http_req_duration{name:POST}': ['p(95)<300'],
  },
};

export default function () {
  group('API Endpoints', function () {
    // GET request
    let getRes = http.get(\`\${BASE_URL}/api/items\`, {
      tags: { name: 'GET' },
    });
    check(getRes, {
      'GET status is 200': (r) => r.status === 200,
      'GET response has data': (r) => r.json().length > 0,
    });

    // POST request
    let postRes = http.post(\`\${BASE_URL}/api/items\`, JSON.stringify({
      name: 'Test Item',
      value: 123,
    }), {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'POST' },
    });
    check(postRes, {
      'POST status is 201': (r) => r.status === 201,
    });
  });

  sleep(1);
}
`,
    },
  };
}

/**
 * Syntax highlighting for JavaScript/K6 code
 * Returns an array of JSX elements with syntax highlighting
 */
export function highlightJavaScriptLine(line: string): string {
  // Handle comments first (preserve them)
  const commentIndex = line.indexOf('//');
  let beforeComment = line;
  let comment = '';
  if (commentIndex !== -1) {
    beforeComment = line.substring(0, commentIndex);
    comment = line.substring(commentIndex);
  }

  // Keywords (blue)
  const keywords = ['import', 'export', 'from', 'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'default', 'async', 'await', 'new', 'true', 'false', 'null', 'undefined'];
  keywords.forEach(keyword => {
    const regex = new RegExp(`\\b(${keyword})\\b`, 'g');
    beforeComment = beforeComment.replace(regex, `<span class="text-blue-400">$1</span>`);
  });

  // Strings (green) - single and double quotes
  beforeComment = beforeComment.replace(/'([^'\\]*(\\.[^'\\]*)*)'/g, '<span class="text-green-400">\'$1\'</span>');
  beforeComment = beforeComment.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, '<span class="text-green-400">"$1"</span>');
  beforeComment = beforeComment.replace(/`([^`\\]*(\\.[^`\\]*)*)`/g, '<span class="text-green-400">`$1`</span>');

  // Numbers (orange)
  beforeComment = beforeComment.replace(/\b(\d+\.?\d*)\b/g, '<span class="text-orange-400">$1</span>');

  // Function names (yellow)
  beforeComment = beforeComment.replace(/(\w+)\s*\(/g, '<span class="text-yellow-300">$1</span>(');

  // Properties after dot (cyan)
  beforeComment = beforeComment.replace(/\.(\w+)/g, '.<span class="text-cyan-300">$1</span>');

  // Reassemble with comment (gray)
  if (comment) {
    return beforeComment + `<span class="text-gray-500">${comment}</span>`;
  }
  return beforeComment;
}

/**
 * Interface for foldable code regions
 */
export interface FoldableRegion {
  startLine: number;
  endLine: number;
  type: 'function' | 'object' | 'block' | 'import';
}

/**
 * Detect foldable regions in code (functions, objects, blocks)
 */
export function detectFoldableRegions(code: string): FoldableRegion[] {
  const lines = code.split('\n');
  const regions: FoldableRegion[] = [];
  const openBraces: Array<{ line: number; type: FoldableRegion['type'] }> = [];

  lines.forEach((line, index) => {
    const trimmedLine = line.trim();

    // Detect function/method/export definitions
    if (trimmedLine.match(/^(export\s+)?(default\s+)?(function|const|let|var)\s+\w+.*\{$/)) {
      openBraces.push({ line: index, type: 'function' });
    }
    // Detect arrow functions with blocks
    else if (trimmedLine.match(/^(export\s+)?(const|let|var)\s+\w+\s*=.*=>\s*\{$/)) {
      openBraces.push({ line: index, type: 'function' });
    }
    // Detect object literals
    else if (trimmedLine.match(/^(export\s+)?(const|let|var)\s+\w+\s*=\s*\{$/)) {
      openBraces.push({ line: index, type: 'object' });
    }
    // Detect group() blocks from K6
    else if (trimmedLine.match(/^group\s*\(.*,\s*(?:function\s*\(\)|\(\)\s*=>)\s*\{$/)) {
      openBraces.push({ line: index, type: 'block' });
    }
    // Detect check() blocks
    else if (trimmedLine.match(/^check\s*\(.*\{$/)) {
      openBraces.push({ line: index, type: 'block' });
    }
    // Detect import blocks (multiple lines)
    else if (trimmedLine.match(/^import\s*\{$/)) {
      openBraces.push({ line: index, type: 'import' });
    }
    // Detect standalone opening brace with content before
    else if (trimmedLine.endsWith('{') && trimmedLine.length > 1) {
      openBraces.push({ line: index, type: 'block' });
    }

    // Check for closing braces
    if (trimmedLine.match(/^\}[);,]*$/) || trimmedLine === '}') {
      const lastOpen = openBraces.pop();
      if (lastOpen && index > lastOpen.line) {
        regions.push({
          startLine: lastOpen.line,
          endLine: index,
          type: lastOpen.type,
        });
      }
    }
  });

  return regions;
}

/**
 * Check if a line should be hidden due to code folding
 */
export function isLineHidden(
  lineNumber: number,
  foldableRegions: FoldableRegion[],
  foldedRegions: Set<number>
): boolean {
  for (const region of foldableRegions) {
    if (foldedRegions.has(region.startLine) && lineNumber > region.startLine && lineNumber <= region.endLine) {
      return true;
    }
  }
  return false;
}

/**
 * Get the fold icon type for a line
 */
export function getFoldIcon(
  lineNumber: number,
  foldableRegions: FoldableRegion[],
  foldedRegions: Set<number>
): 'fold' | 'unfold' | null {
  const region = foldableRegions.find(r => r.startLine === lineNumber);
  if (!region) return null;
  return foldedRegions.has(lineNumber) ? 'unfold' : 'fold';
}

/**
 * Autocomplete patterns for selectors
 */
export const selectorPatterns: Record<string, string[]> = {
  'button': ['button.submit', 'button[type="submit"]', 'button.btn-primary', 'button#submit'],
  'input': ['input[type="email"]', 'input[type="password"]', 'input#username', 'input.form-control'],
  '#': ['#login-form', '#submit-button', '#email', '#password', '#search'],
  '.': ['.btn', '.form-control', '.nav-link', '.card', '.modal'],
  '[data': ['[data-testid="submit"]', '[data-testid="login"]', '[data-testid="search"]'],
  'form': ['form#login', 'form.auth-form', 'form[action="/login"]'],
  'a': ['a.nav-link', 'a[href="/dashboard"]', 'a.btn'],
};

/**
 * Get value patterns based on action type and target URL
 */
export function getValuePatterns(action: string, baseUrl: string = ''): string[] {
  const patterns: Record<string, string[]> = {
    navigate: baseUrl ? [`${baseUrl}`, `${baseUrl}/login`, `${baseUrl}/dashboard`, '/api/health'] : ['/home', '/login', '/dashboard', '/api/health'],
    fill: ['your-email@domain.com', 'password123', 'John Doe', 'Search query'],
    type: ['Hello World', 'your-text', 'password', 'Search term'],
    wait: ['1000', '2000', '500', '3000'],
    assert_text: ['Welcome', 'Login successful', 'Dashboard', 'Submit'],
  };
  return patterns[action] || [];
}

/**
 * Find autocomplete suggestion for selector input
 */
export function findSelectorAutocomplete(input: string): string | null {
  if (!input) return null;

  const lowerInput = input.toLowerCase();
  for (const [prefix, suggestions] of Object.entries(selectorPatterns)) {
    if (lowerInput.startsWith(prefix.toLowerCase())) {
      const match = suggestions.find(s => s.toLowerCase().startsWith(lowerInput) && s.toLowerCase() !== lowerInput);
      if (match) return match;
    }
  }
  return null;
}

/**
 * Find autocomplete suggestion for value input
 */
export function findValueAutocomplete(input: string, action: string, baseUrl: string = ''): string | null {
  if (!input) return null;

  const patterns = getValuePatterns(action, baseUrl);
  const lowerInput = input.toLowerCase();
  const match = patterns.find(p => p.toLowerCase().startsWith(lowerInput) && p.toLowerCase() !== lowerInput);
  return match || null;
}
