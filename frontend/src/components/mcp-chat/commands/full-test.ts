// Feature #1745: /full-test command for comprehensive site testing
import { SlashCommand } from '../types';

// Helper to ensure URL has protocol
function normalizeUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `https://${url}`;
}

// Helper to extract domain from URL
function getDomain(url: string): string {
  try {
    const normalized = normalizeUrl(url);
    const urlObj = new URL(normalized);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return url;
  }
}

export const fullTestCommand: SlashCommand = {
  name: '/full-test',
  description: 'Run comprehensive tests on a website (E2E, Visual, A11y, Perf, Load, Security)',
  usage: '/full-test [url]',
  parameters: [
    { name: 'url', description: 'Target URL to test comprehensively', required: true, type: 'url' },
  ],
  toolMapping: 'analyze_site',
  category: 'testing',
  generatePrompt: (args) => {
    const rawUrl = args[0];
    if (!rawUrl) {
      return `Please provide a URL to run comprehensive tests. Example: /full-test example.com`;
    }

    const targetUrl = normalizeUrl(rawUrl);
    const domain = getDomain(rawUrl);

    return `COMPREHENSIVE SITE TESTING for "${targetUrl}"

You will run a FULL TEST SUITE covering all test types. Follow these steps IN ORDER:

## Step 1: Site Analysis
First, use \`analyze_site\` with url="${targetUrl}" to understand the site structure and get test recommendations.

## Step 2: Project Setup
- Call \`list_projects\` to check if a project for "${domain}" already exists
- If not, call \`create_project\` with name="${domain} Full Tests" and description="Comprehensive testing for ${targetUrl}"
- Note the project_id for later

## Step 3: Create Test Suites (create ALL of these)
For each suite, use \`create_test_suite\` with the project_id:

1. **E2E Tests Suite**: name="${domain} E2E Tests", description="End-to-end functional tests"
2. **Visual Regression Suite**: name="${domain} Visual Tests", description="Visual regression testing"
3. **Accessibility Suite**: name="${domain} A11y Tests", description="WCAG 2.1 accessibility tests"
4. **Performance Suite**: name="${domain} Performance", description="Lighthouse performance testing"
5. **Load Testing Suite**: name="${domain} Load Tests", description="K6 load testing"
6. **Security Suite**: name="${domain} Security", description="DAST security scanning"

## Step 4: Create Tests with CORRECT parameters
For each suite, create relevant tests based on the site analysis:

### Visual Tests (CRITICAL - include viewport!)
\`create_test\` with:
- type: "visual"
- viewport_width: 1920
- viewport_height: 1080
- diff_threshold: 0.1
- target_url: "${targetUrl}"

### E2E Tests
\`create_test\` with:
- type: "e2e"
- target_url: "${targetUrl}"
- steps based on site analysis (navigation, forms, etc.)

### Accessibility Tests
Use \`run_accessibility_scan\` with target_url="${targetUrl}"

### Performance Tests
Use \`run_lighthouse_audit\` with url="${targetUrl}"

### Load Tests
Use \`run_k6_test\` with target_url="${targetUrl}", virtual_users=10, duration="30s"

### Security Tests
Use \`run_dast_scan\` with target_url="${targetUrl}"

## Step 5: Run All Test Suites
For each suite created, use \`trigger_test_run\` with the suite_id

## Step 6: Report
After all tests are triggered, provide a summary with links:
- [View Project](/projects/{project_id})
- [View All Results](/analytics)
- List each suite with its status

IMPORTANT:
- Execute ALL steps sequentially
- Do NOT skip any test type
- Use exact URL "${targetUrl}" for all tests
- Include viewport dimensions for visual tests`;
  },
};
