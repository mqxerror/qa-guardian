// Test Suites Module - AI Coverage Gap Analysis Routes
// Feature #1147: AI Coverage Gap Identification
// Feature #1148: AI Auto-Suggest Tests for Code Changes

import { FastifyInstance } from 'fastify';
import { authenticate, getOrganizationId } from '../../middleware/auth';
import { logAuditEntry } from '../audit-logs';
import { getTestSuite, createTest, listAllTests } from './stores';
import { Test, TestStep } from './types';
import { generatePlaywrightCode } from './utils';

// Feature #1147: Interface for coverage gap
interface CoverageGap {
  id: string;
  type: 'untested_page' | 'untested_flow' | 'missing_edge_case' | 'missing_negative_test' | 'incomplete_coverage';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  affected_area: string;
  suggestion: {
    test_name: string;
    test_description: string;
    estimated_steps: number;
  };
  related_tests?: string[]; // IDs of related existing tests
}

interface AICoverageGapsBody {
  project_id?: string;
  suite_id?: string;
  known_pages?: string[]; // URLs or page names in the application
  known_flows?: string[]; // User flow descriptions
  include_suggestions?: boolean;
}

// Feature #1147: Coverage analysis result interface
interface CoverageAnalysis {
  pagesCovered: Set<string>;
  flowsCovered: Set<string>;
  testTypesPresent: string[];
  negativeTestsCount: number;
  edgeCaseTestsCount: number;
  securityTestsCount: number;
  accessibilityTestsCount: number;
  testsPerPage: Map<string, number>;
  testsPerFlow: Map<string, number>;
}

// Feature #1148: Interface for code change analysis
interface CodeChange {
  file_path: string;
  change_type: 'added' | 'modified' | 'deleted';
  diff_summary?: string;
  detected_elements: {
    endpoints?: string[];
    components?: string[];
    functions?: string[];
    classes?: string[];
  };
}

interface TestSuggestionForChange {
  id: string;
  priority: 'high' | 'medium' | 'low';
  related_change: string; // File path or element name
  suggestion_type: 'new_endpoint' | 'new_component' | 'modified_logic' | 'new_function' | 'api_change';
  test_name: string;
  test_description: string;
  test_type: 'e2e' | 'api' | 'unit' | 'integration';
  estimated_steps: number;
  one_click_generate: boolean;
}

interface AIAnalyzeCodeChangesBody {
  changes: CodeChange[];
  commit_sha?: string;
  branch_name?: string;
  repository?: string;
  project_id?: string;
  auto_generate_priority_high?: boolean;
}

// Feature #1148: Bulk generate tests body
interface AIBulkGenerateTestsBody {
  suite_id: string;
  suggestions: Array<{
    test_name: string;
    test_description: string;
    test_type?: string;
  }>;
  base_url?: string;
}

// Internal interface for generated test steps
interface GeneratedTestStep {
  id: string;
  action: string;
  selector?: string;
  value?: string;
  description?: string;
  order: number;
}

// Feature #1147: Analyze existing test coverage
function analyzeCoverage(existingTests: Test[], knownPages: string[], knownFlows: string[]): CoverageAnalysis {
  const pagesCovered = new Set<string>();
  const flowsCovered = new Set<string>();
  const testTypesPresent: string[] = [];
  let negativeTestsCount = 0;
  let edgeCaseTestsCount = 0;
  let securityTestsCount = 0;
  let accessibilityTestsCount = 0;
  const testsPerPage = new Map<string, number>();
  const testsPerFlow = new Map<string, number>();

  for (const test of existingTests) {
    const desc = (test.description || test.name).toLowerCase();

    // Detect covered pages
    for (const page of knownPages) {
      const pageLower = page.toLowerCase();
      if (desc.includes(pageLower) || (test.steps && test.steps.some((s: TestStep) => s.value?.toLowerCase().includes(pageLower)))) {
        pagesCovered.add(page);
        testsPerPage.set(page, (testsPerPage.get(page) || 0) + 1);
      }
    }

    // Detect covered flows
    for (const flow of knownFlows) {
      const flowLower = flow.toLowerCase();
      if (desc.includes(flowLower)) {
        flowsCovered.add(flow);
        testsPerFlow.set(flow, (testsPerFlow.get(flow) || 0) + 1);
      }
    }

    // Detect test types
    if (!testTypesPresent.includes(test.test_type)) {
      testTypesPresent.push(test.test_type);
    }

    // Count special test categories
    if (desc.match(/invalid|error|fail|wrong|negative|reject/)) {
      negativeTestsCount++;
    }
    if (desc.match(/edge|boundary|extreme|limit|max|min/)) {
      edgeCaseTestsCount++;
    }
    if (desc.match(/security|injection|xss|csrf|auth|permission/)) {
      securityTestsCount++;
    }
    if (desc.match(/accessibility|a11y|screen\s*reader|keyboard|aria/)) {
      accessibilityTestsCount++;
    }
  }

  // Auto-detect pages from test content if no known pages provided
  if (knownPages.length === 0) {
    for (const test of existingTests) {
      if (test.steps) {
        for (const step of test.steps) {
          if (step.action === 'navigate' && step.value) {
            try {
              const url = new URL(step.value);
              pagesCovered.add(url.pathname);
            } catch {
              // Not a valid URL, might be a path
              if (step.value.startsWith('/')) {
                pagesCovered.add(step.value);
              }
            }
          }
        }
      }
    }
  }

  // Auto-detect flows from test names
  if (knownFlows.length === 0) {
    const detectedFlows = new Set<string>();
    for (const test of existingTests) {
      const name = test.name.toLowerCase();
      if (name.includes('login')) detectedFlows.add('login');
      if (name.includes('register') || name.includes('signup')) detectedFlows.add('registration');
      if (name.includes('checkout') || name.includes('purchase')) detectedFlows.add('checkout');
      if (name.includes('search')) detectedFlows.add('search');
      if (name.includes('profile')) detectedFlows.add('profile management');
      if (name.includes('settings')) detectedFlows.add('settings');
    }
    for (const flow of detectedFlows) {
      flowsCovered.add(flow);
    }
  }

  return {
    pagesCovered,
    flowsCovered,
    testTypesPresent,
    negativeTestsCount,
    edgeCaseTestsCount,
    securityTestsCount,
    accessibilityTestsCount,
    testsPerPage,
    testsPerFlow,
  };
}

// Feature #1147: Identify coverage gaps
function identifyCoverageGaps(
  analysis: CoverageAnalysis,
  knownPages: string[],
  knownFlows: string[],
  includeSuggestions: boolean
): CoverageGap[] {
  const gaps: CoverageGap[] = [];
  let gapCount = 0;

  // Check for untested pages
  for (const page of knownPages) {
    if (!analysis.pagesCovered.has(page)) {
      gaps.push({
        id: `gap-${++gapCount}`,
        type: 'untested_page',
        severity: page.includes('login') || page.includes('checkout') || page.includes('payment') ? 'critical' : 'high',
        title: `Untested Page: ${page}`,
        description: `The page "${page}" has no test coverage`,
        affected_area: page,
        suggestion: includeSuggestions ? {
          test_name: `Test ${page} page functionality`,
          test_description: `Navigate to ${page}, verify page loads correctly, check key elements are visible`,
          estimated_steps: 5,
        } : { test_name: '', test_description: '', estimated_steps: 0 },
      });
    }
  }

  // Check for untested flows
  for (const flow of knownFlows) {
    if (!analysis.flowsCovered.has(flow)) {
      gaps.push({
        id: `gap-${++gapCount}`,
        type: 'untested_flow',
        severity: flow.includes('checkout') || flow.includes('payment') || flow.includes('authentication') ? 'critical' : 'high',
        title: `Untested User Flow: ${flow}`,
        description: `The user flow "${flow}" has no test coverage`,
        affected_area: flow,
        suggestion: includeSuggestions ? {
          test_name: `Test ${flow} flow`,
          test_description: `Complete the ${flow} flow from start to finish, verify all steps work correctly`,
          estimated_steps: 8,
        } : { test_name: '', test_description: '', estimated_steps: 0 },
      });
    }
  }

  // Check for missing negative tests
  if (analysis.negativeTestsCount === 0) {
    gaps.push({
      id: `gap-${++gapCount}`,
      type: 'missing_negative_test',
      severity: 'high',
      title: 'No Negative Test Cases',
      description: 'No tests for error conditions, invalid inputs, or failure scenarios',
      affected_area: 'Error handling',
      suggestion: includeSuggestions ? {
        test_name: 'Invalid input validation test',
        test_description: 'Submit forms with invalid data, verify appropriate error messages are displayed',
        estimated_steps: 6,
      } : { test_name: '', test_description: '', estimated_steps: 0 },
    });
  }

  // Check for missing edge case tests
  if (analysis.edgeCaseTestsCount === 0) {
    gaps.push({
      id: `gap-${++gapCount}`,
      type: 'missing_edge_case',
      severity: 'medium',
      title: 'No Edge Case Tests',
      description: 'No tests for boundary conditions, extreme values, or edge cases',
      affected_area: 'Boundary conditions',
      suggestion: includeSuggestions ? {
        test_name: 'Boundary condition test',
        test_description: 'Test with maximum/minimum values, empty inputs, and special characters',
        estimated_steps: 5,
      } : { test_name: '', test_description: '', estimated_steps: 0 },
    });
  }

  // Check for missing security tests
  if (analysis.securityTestsCount === 0) {
    gaps.push({
      id: `gap-${++gapCount}`,
      type: 'missing_negative_test',
      severity: 'critical',
      title: 'No Security Tests',
      description: 'No tests for security vulnerabilities like XSS, SQL injection, or authorization',
      affected_area: 'Security',
      suggestion: includeSuggestions ? {
        test_name: 'Security vulnerability test',
        test_description: 'Test input fields for XSS and injection attacks, verify proper sanitization',
        estimated_steps: 7,
      } : { test_name: '', test_description: '', estimated_steps: 0 },
    });
  }

  // Check for missing accessibility tests
  if (analysis.accessibilityTestsCount === 0) {
    gaps.push({
      id: `gap-${++gapCount}`,
      type: 'incomplete_coverage',
      severity: 'medium',
      title: 'No Accessibility Tests',
      description: 'No tests for keyboard navigation, screen readers, or ARIA compliance',
      affected_area: 'Accessibility',
      suggestion: includeSuggestions ? {
        test_name: 'Accessibility compliance test',
        test_description: 'Verify keyboard navigation, check ARIA labels, test with screen reader simulation',
        estimated_steps: 6,
      } : { test_name: '', test_description: '', estimated_steps: 0 },
    });
  }

  // Check for pages with low test coverage
  for (const [page, count] of analysis.testsPerPage) {
    if (count === 1) {
      gaps.push({
        id: `gap-${++gapCount}`,
        type: 'incomplete_coverage',
        severity: 'low',
        title: `Low Coverage: ${page}`,
        description: `The page "${page}" has only 1 test. Consider adding more test scenarios.`,
        affected_area: page,
        suggestion: includeSuggestions ? {
          test_name: `Additional tests for ${page}`,
          test_description: `Add negative tests, edge cases, and alternative flows for ${page}`,
          estimated_steps: 5,
        } : { test_name: '', test_description: '', estimated_steps: 0 },
      });
    }
  }

  // Check for common pages that might be missing
  const commonPages = ['/', '/login', '/register', '/dashboard', '/settings', '/profile', '/search'];
  for (const commonPage of commonPages) {
    if (knownPages.length === 0 && !analysis.pagesCovered.has(commonPage)) {
      // Only suggest if we detected other pages
      if (analysis.pagesCovered.size > 0) {
        gaps.push({
          id: `gap-${++gapCount}`,
          type: 'untested_page',
          severity: commonPage === '/login' || commonPage === '/' ? 'high' : 'medium',
          title: `Potentially Missing: ${commonPage}`,
          description: `Common page "${commonPage}" might need test coverage`,
          affected_area: commonPage,
          suggestion: includeSuggestions ? {
            test_name: `Test ${commonPage} page`,
            test_description: `Navigate to ${commonPage}, verify page loads and key functionality works`,
            estimated_steps: 4,
          } : { test_name: '', test_description: '', estimated_steps: 0 },
        });
      }
    }
  }

  return gaps;
}

// Feature #1147: Calculate overall coverage score
function calculateCoverageScore(analysis: CoverageAnalysis, knownPages: string[], knownFlows: string[]): number {
  let score = 50; // Base score

  // Page coverage
  if (knownPages.length > 0) {
    const pageCoverageRatio = analysis.pagesCovered.size / knownPages.length;
    score += pageCoverageRatio * 20;
  } else if (analysis.pagesCovered.size > 0) {
    score += 10; // Some pages covered
  }

  // Flow coverage
  if (knownFlows.length > 0) {
    const flowCoverageRatio = analysis.flowsCovered.size / knownFlows.length;
    score += flowCoverageRatio * 15;
  } else if (analysis.flowsCovered.size > 0) {
    score += 8; // Some flows covered
  }

  // Test type diversity
  score += Math.min(analysis.testTypesPresent.length * 2, 10);

  // Special test categories
  if (analysis.negativeTestsCount > 0) score += 5;
  if (analysis.edgeCaseTestsCount > 0) score += 5;
  if (analysis.securityTestsCount > 0) score += 5;
  if (analysis.accessibilityTestsCount > 0) score += 5;

  return Math.min(Math.round(score), 100);
}

// Feature #1147: Generate coverage improvement recommendations
function generateCoverageRecommendations(gaps: CoverageGap[]): string[] {
  const recommendations: string[] = [];

  const criticalGaps = gaps.filter(g => g.severity === 'critical').length;
  const highGaps = gaps.filter(g => g.severity === 'high').length;

  if (criticalGaps > 0) {
    recommendations.push(`Urgent: Address ${criticalGaps} critical coverage gaps first`);
  }
  if (highGaps > 0) {
    recommendations.push(`High priority: ${highGaps} high-severity gaps need attention`);
  }

  const untestedPages = gaps.filter(g => g.type === 'untested_page').length;
  if (untestedPages > 0) {
    recommendations.push(`Add tests for ${untestedPages} untested pages`);
  }

  const untestedFlows = gaps.filter(g => g.type === 'untested_flow').length;
  if (untestedFlows > 0) {
    recommendations.push(`Create end-to-end tests for ${untestedFlows} user flows`);
  }

  const missingNegative = gaps.some(g => g.title.includes('No Negative'));
  if (missingNegative) {
    recommendations.push('Add negative test cases to verify error handling');
  }

  const missingSecurity = gaps.some(g => g.title.includes('No Security'));
  if (missingSecurity) {
    recommendations.push('Add security tests for XSS, injection, and authorization vulnerabilities');
  }

  const missingA11y = gaps.some(g => g.title.includes('No Accessibility'));
  if (missingA11y) {
    recommendations.push('Add accessibility tests for WCAG compliance');
  }

  if (recommendations.length === 0) {
    recommendations.push('Coverage looks good! Consider adding more edge case tests for robustness.');
  }

  return recommendations;
}

// Feature #1148: Generate test suggestions for a single code change
function generateTestSuggestionsForChange(change: CodeChange): TestSuggestionForChange[] {
  const suggestions: TestSuggestionForChange[] = [];
  let suggestionCount = 0;
  const filePath = change.file_path.toLowerCase();

  // Skip deleted files
  if (change.change_type === 'deleted') {
    return suggestions;
  }

  // Detect file type and generate appropriate suggestions
  const isApiFile = filePath.includes('/api/') || filePath.includes('/routes/') || filePath.includes('controller');
  const isComponentFile = filePath.includes('/components/') || filePath.includes('.tsx') || filePath.includes('.jsx');
  const isPageFile = filePath.includes('/pages/') || filePath.includes('/views/');
  const isServiceFile = filePath.includes('/services/') || filePath.includes('/utils/');
  const isModelFile = filePath.includes('/models/') || filePath.includes('/entities/');

  // Extract file name for suggestions
  const fileName = change.file_path.split('/').pop() || change.file_path;
  const baseName = fileName.replace(/\.(tsx?|jsx?|ts|js)$/, '');

  // API/Route files
  if (isApiFile) {
    for (const endpoint of change.detected_elements?.endpoints || []) {
      suggestions.push({
        id: `suggestion-${++suggestionCount}`,
        priority: change.change_type === 'added' ? 'high' : 'medium',
        related_change: change.file_path,
        suggestion_type: 'new_endpoint',
        test_name: `Test ${endpoint} endpoint`,
        test_description: `Test the ${endpoint} API endpoint: verify request/response, error handling, and authentication`,
        test_type: 'api',
        estimated_steps: 6,
        one_click_generate: true,
      });
    }

    // Generic API test if no specific endpoints detected
    if (!change.detected_elements?.endpoints?.length) {
      suggestions.push({
        id: `suggestion-${++suggestionCount}`,
        priority: change.change_type === 'added' ? 'high' : 'medium',
        related_change: change.file_path,
        suggestion_type: 'api_change',
        test_name: `Test ${baseName} API`,
        test_description: `Test the API changes in ${fileName}: verify endpoints, responses, and error cases`,
        test_type: 'api',
        estimated_steps: 5,
        one_click_generate: true,
      });
    }
  }

  // Component files
  if (isComponentFile) {
    for (const component of change.detected_elements?.components || []) {
      suggestions.push({
        id: `suggestion-${++suggestionCount}`,
        priority: change.change_type === 'added' ? 'high' : 'medium',
        related_change: change.file_path,
        suggestion_type: 'new_component',
        test_name: `Test ${component} component`,
        test_description: `Test the ${component} component: verify rendering, user interactions, and state changes`,
        test_type: 'e2e',
        estimated_steps: 5,
        one_click_generate: true,
      });
    }

    // Generic component test
    if (!change.detected_elements?.components?.length) {
      suggestions.push({
        id: `suggestion-${++suggestionCount}`,
        priority: change.change_type === 'added' ? 'high' : 'medium',
        related_change: change.file_path,
        suggestion_type: 'new_component',
        test_name: `Test ${baseName} component`,
        test_description: `Test the ${baseName} component UI: verify it renders correctly and handles user interactions`,
        test_type: 'e2e',
        estimated_steps: 4,
        one_click_generate: true,
      });
    }
  }

  // Page files
  if (isPageFile) {
    suggestions.push({
      id: `suggestion-${++suggestionCount}`,
      priority: 'high',
      related_change: change.file_path,
      suggestion_type: 'new_component',
      test_name: `Test ${baseName} page`,
      test_description: `Navigate to ${baseName} page, verify page loads correctly, check key elements and functionality`,
      test_type: 'e2e',
      estimated_steps: 6,
      one_click_generate: true,
    });

    // Accessibility test for new pages
    suggestions.push({
      id: `suggestion-${++suggestionCount}`,
      priority: 'medium',
      related_change: change.file_path,
      suggestion_type: 'new_component',
      test_name: `${baseName} page accessibility`,
      test_description: `Test ${baseName} page accessibility: keyboard navigation, ARIA labels, color contrast`,
      test_type: 'e2e',
      estimated_steps: 5,
      one_click_generate: true,
    });
  }

  // Service/utility files
  if (isServiceFile) {
    for (const func of change.detected_elements?.functions || []) {
      suggestions.push({
        id: `suggestion-${++suggestionCount}`,
        priority: 'medium',
        related_change: change.file_path,
        suggestion_type: 'new_function',
        test_name: `Test ${func} function`,
        test_description: `Test the ${func} function: verify correct behavior with valid inputs, edge cases, and error handling`,
        test_type: 'unit',
        estimated_steps: 4,
        one_click_generate: true,
      });
    }

    // Generic service test
    if (!change.detected_elements?.functions?.length) {
      suggestions.push({
        id: `suggestion-${++suggestionCount}`,
        priority: 'medium',
        related_change: change.file_path,
        suggestion_type: 'modified_logic',
        test_name: `Test ${baseName} service`,
        test_description: `Test the ${baseName} service logic: verify functions work correctly with various inputs`,
        test_type: 'unit',
        estimated_steps: 4,
        one_click_generate: true,
      });
    }
  }

  // Model files - suggest integration tests
  if (isModelFile) {
    suggestions.push({
      id: `suggestion-${++suggestionCount}`,
      priority: 'medium',
      related_change: change.file_path,
      suggestion_type: 'modified_logic',
      test_name: `Test ${baseName} model integration`,
      test_description: `Test ${baseName} model: verify CRUD operations, validation, and relationships work correctly`,
      test_type: 'integration',
      estimated_steps: 6,
      one_click_generate: true,
    });
  }

  // For modified files, add regression test suggestion
  if (change.change_type === 'modified') {
    suggestions.push({
      id: `suggestion-${++suggestionCount}`,
      priority: 'low',
      related_change: change.file_path,
      suggestion_type: 'modified_logic',
      test_name: `Regression test for ${baseName}`,
      test_description: `Verify existing functionality in ${fileName} still works after modifications`,
      test_type: isApiFile ? 'api' : 'e2e',
      estimated_steps: 4,
      one_click_generate: true,
    });
  }

  return suggestions;
}

// Feature #1148: Generate notification message for code changes
function generateChangeNotification(suggestions: TestSuggestionForChange[], changes: CodeChange[]): {
  title: string;
  message: string;
  priority: 'urgent' | 'normal' | 'low';
  action_url: string;
} {
  const highPriority = suggestions.filter(s => s.priority === 'high').length;
  const newFiles = changes.filter(c => c.change_type === 'added').length;

  let title: string;
  let message: string;
  let priority: 'urgent' | 'normal' | 'low';

  if (highPriority >= 3) {
    title = `${highPriority} high-priority tests suggested`;
    message = `New code changes require ${highPriority} high-priority tests. ${newFiles} new files were added.`;
    priority = 'urgent';
  } else if (highPriority > 0) {
    title = 'New test suggestions available';
    message = `${suggestions.length} tests suggested for your code changes, including ${highPriority} high-priority.`;
    priority = 'normal';
  } else {
    title = 'Test coverage suggestions';
    message = `${suggestions.length} optional tests suggested to improve coverage for recent changes.`;
    priority = 'low';
  }

  return {
    title,
    message,
    priority,
    action_url: '/ai/test-suggestions',
  };
}

// Parse natural language description into test steps (simplified version for bulk generation)
function parseNaturalLanguageToSteps(description: string, baseUrl: string): GeneratedTestStep[] {
  const steps: GeneratedTestStep[] = [];
  let stepOrder = 0;

  // Normalize description
  const desc = description.toLowerCase().trim();

  // Pattern: Navigate/Go to URL
  const navigateMatch = desc.match(/(?:navigate|go|visit|open|browse)\s+(?:to\s+)?(?:the\s+)?(?:page\s+)?(?:at\s+)?['"]?([^\s'"]+)['"]?/i);
  if (navigateMatch && navigateMatch[1]) {
    const matchedUrl = navigateMatch[1];
    const url = matchedUrl.startsWith('http') ? matchedUrl : (baseUrl + (matchedUrl.startsWith('/') ? '' : '/') + matchedUrl);
    steps.push({
      id: `step-${++stepOrder}`,
      action: 'navigate',
      value: url,
      description: `Navigate to ${url}`,
      order: stepOrder,
    });
  } else if (baseUrl) {
    // Add base URL navigation as first step
    steps.push({
      id: `step-${++stepOrder}`,
      action: 'navigate',
      value: baseUrl,
      description: `Navigate to ${baseUrl}`,
      order: stepOrder,
    });
  }

  // Pattern: Click on element
  const clickMatches = desc.matchAll(/click\s+(?:on\s+)?(?:the\s+)?['"]?([^'"]+?)['"]?\s*(?:button|link|element)?/gi);
  for (const match of clickMatches) {
    if (!match[1]) continue;
    const elementText = match[1].trim();
    steps.push({
      id: `step-${++stepOrder}`,
      action: 'click',
      selector: `button:has-text("${elementText}"), a:has-text("${elementText}"), [role="button"]:has-text("${elementText}"), text="${elementText}"`,
      description: `Click on "${elementText}"`,
      order: stepOrder,
    });
  }

  // Pattern: Fill/Enter/Type in field
  const fillMatches = desc.matchAll(/(?:fill|enter|type|input)\s+['"]?([^'"]+?)['"]?\s+(?:in(?:to)?|on)\s+(?:the\s+)?['"]?([^'"]+?)['"]?\s*(?:field|input|textbox)?/gi);
  for (const match of fillMatches) {
    if (!match[1] || !match[2]) continue;
    const value = match[1].trim();
    const fieldName = match[2].trim();
    steps.push({
      id: `step-${++stepOrder}`,
      action: 'fill',
      selector: `[data-testid="${fieldName}"], [name="${fieldName}"], [placeholder*="${fieldName}" i], #${fieldName}`,
      value: value,
      description: `Enter "${value}" in ${fieldName} field`,
      order: stepOrder,
    });
  }

  // Pattern: Verify/Check/Assert text appears/visible
  const verifyTextMatches = desc.matchAll(/(?:verify|check|assert|confirm|ensure|expect)\s+(?:that\s+)?(?:the\s+)?['"]?([^'"]+?)['"]?\s+(?:appears?|(?:is\s+)?visible|loads?|shows?|displays?)/gi);
  for (const match of verifyTextMatches) {
    if (!match[1]) continue;
    const text = match[1].trim();
    steps.push({
      id: `step-${++stepOrder}`,
      action: 'assert_text',
      value: text,
      description: `Verify "${text}" is visible`,
      order: stepOrder,
    });
  }

  // Pattern: Wait for seconds
  const waitMatch = desc.match(/wait\s+(?:for\s+)?(\d+)\s*(?:seconds?|sec|s|milliseconds?|ms)?/i);
  if (waitMatch && waitMatch[1]) {
    const waitTime = waitMatch[1];
    const isMs = desc.includes('ms') || desc.includes('millisecond');
    steps.push({
      id: `step-${++stepOrder}`,
      action: 'wait',
      value: isMs ? waitTime : String(parseInt(waitTime, 10) * 1000),
      description: `Wait for ${waitTime}${isMs ? 'ms' : ' seconds'}`,
      order: stepOrder,
    });
  }

  // If we only have navigation, add a wait and screenshot step
  if (steps.length === 1 && steps[0]?.action === 'navigate') {
    steps.push({
      id: `step-${++stepOrder}`,
      action: 'wait',
      value: '2000',
      description: 'Wait for page to fully load',
      order: stepOrder,
    });
    steps.push({
      id: `step-${++stepOrder}`,
      action: 'screenshot',
      description: 'Take screenshot of page',
      order: stepOrder,
    });
  }

  return steps;
}

// Calculate confidence score for generated steps
function calculateConfidenceScore(description: string, steps: GeneratedTestStep[]): number {
  let score = 50; // Base score

  // More steps = more understanding
  score += Math.min(steps.length * 5, 20);

  // Specific action keywords increase confidence
  const actionKeywords = ['click', 'fill', 'enter', 'type', 'verify', 'assert', 'check', 'login', 'navigate'];
  const keywordCount = actionKeywords.filter(kw => description.toLowerCase().includes(kw)).length;
  score += keywordCount * 5;

  // Having selectors/values increases confidence
  const stepsWithSelectors = steps.filter(s => s.selector).length;
  const stepsWithValues = steps.filter(s => s.value).length;
  score += stepsWithSelectors * 2;
  score += stepsWithValues * 2;

  // Penalty for very short descriptions
  if (description.length < 30) score -= 10;
  if (description.length < 50) score -= 5;

  // Bonus for clear structure (numbered steps, "then", "and")
  if (description.match(/\d\.\s|step\s*\d|then|and\s+then|after\s+that/gi)) {
    score += 10;
  }

  // Cap at 100
  return Math.min(Math.max(score, 20), 100);
}

// AI Coverage Routes
export async function aiCoverageRoutes(app: FastifyInstance) {
  // Feature #1147: AI Coverage Gap Identification Endpoint
  // Analyzes existing tests and identifies coverage gaps
  app.post<{ Body: AICoverageGapsBody }>('/api/v1/ai/coverage-gaps', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const {
      project_id,
      suite_id,
      known_pages = [],
      known_flows = [],
      include_suggestions = true,
    } = request.body;
    const orgId = getOrganizationId(request);

    console.log(`[AI COVERAGE GAPS] Analyzing coverage for org ${orgId}`);

    // Get existing tests for the organization
    const allTests = await listAllTests(orgId);
    const existingTests = allTests.filter(t => !suite_id || t.suite_id === suite_id);

    // Analyze test coverage
    const analysis = analyzeCoverage(existingTests, known_pages, known_flows);

    // Identify gaps
    const gaps = identifyCoverageGaps(analysis, known_pages, known_flows, include_suggestions);

    // Sort by severity
    gaps.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    console.log(`[AI COVERAGE GAPS] Found ${gaps.length} coverage gaps`);

    return {
      success: true,
      analysis_summary: {
        total_tests_analyzed: existingTests.length,
        pages_covered: analysis.pagesCovered.size,
        flows_covered: analysis.flowsCovered.size,
        test_types_present: analysis.testTypesPresent,
        coverage_score: calculateCoverageScore(analysis, known_pages, known_flows),
      },
      coverage_gaps: gaps,
      recommendations: generateCoverageRecommendations(gaps),
      generate_test_endpoint: 'POST /api/v1/ai/generate-test',
    };
  });

  // Feature #1148: AI Auto-Suggest Tests for Code Changes Endpoint
  // Analyzes code changes and suggests relevant tests
  app.post<{ Body: AIAnalyzeCodeChangesBody }>('/api/v1/ai/analyze-code-changes', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const {
      changes,
      commit_sha,
      branch_name,
      repository,
      project_id,
      auto_generate_priority_high = false,
    } = request.body;
    const orgId = getOrganizationId(request);

    if (!changes || changes.length === 0) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'At least one code change must be provided',
      });
    }

    console.log(`[AI ANALYZE CHANGES] Analyzing ${changes.length} code changes`);

    // Analyze each change and generate test suggestions
    const allSuggestions: TestSuggestionForChange[] = [];
    const analyzedChanges: Array<CodeChange & { suggestions_count: number }> = [];

    for (const change of changes) {
      const suggestions = generateTestSuggestionsForChange(change);
      allSuggestions.push(...suggestions);
      analyzedChanges.push({
        ...change,
        suggestions_count: suggestions.length,
      });
    }

    // Sort by priority
    allSuggestions.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    // Count by priority
    const highPriority = allSuggestions.filter(s => s.priority === 'high').length;
    const mediumPriority = allSuggestions.filter(s => s.priority === 'medium').length;
    const lowPriority = allSuggestions.filter(s => s.priority === 'low').length;

    console.log(`[AI ANALYZE CHANGES] Generated ${allSuggestions.length} test suggestions (${highPriority} high, ${mediumPriority} medium, ${lowPriority} low)`);

    // Generate a notification message
    const notification = generateChangeNotification(allSuggestions, changes);

    return {
      success: true,
      commit_info: {
        sha: commit_sha,
        branch: branch_name,
        repository,
      },
      analysis: {
        total_changes: changes.length,
        changes_analyzed: analyzedChanges,
        total_suggestions: allSuggestions.length,
        by_priority: {
          high: highPriority,
          medium: mediumPriority,
          low: lowPriority,
        },
      },
      suggestions: allSuggestions,
      notification,
      generate_endpoint: 'POST /api/v1/ai/generate-test',
      bulk_generate_endpoint: 'POST /api/v1/ai/bulk-generate-tests',
    };
  });

  // Feature #1148: Bulk generate tests endpoint
  app.post<{ Body: AIBulkGenerateTestsBody }>('/api/v1/ai/bulk-generate-tests', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { suite_id, suggestions, base_url } = request.body;
    const orgId = getOrganizationId(request);

    if (!suite_id || !suggestions || suggestions.length === 0) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'suite_id and at least one suggestion are required',
      });
    }

    // Verify suite exists
    const suite = await getTestSuite(suite_id);
    if (!suite || suite.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test suite not found',
      });
    }

    console.log(`[AI BULK GENERATE] Generating ${suggestions.length} tests`);

    const generatedTests: Array<{ id: string; name: string; steps_count: number; confidence: number }> = [];
    const errors: Array<{ name: string; error: string }> = [];

    for (const suggestion of suggestions) {
      try {
        const generatedSteps = parseNaturalLanguageToSteps(suggestion.test_description, base_url || suite.base_url || '');
        const confidenceScore = calculateConfidenceScore(suggestion.test_description, generatedSteps);

        const testId = `test-bulk-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        const now = new Date();

        const newTest: Test = {
          id: testId,
          suite_id: suite_id,
          organization_id: orgId,
          name: suggestion.test_name,
          description: suggestion.test_description,
          test_type: 'e2e',
          steps: generatedSteps,
          status: 'draft',
          ai_generated: true,
          ai_confidence_score: confidenceScore,
          review_status: 'pending_review',
          created_at: now,
          updated_at: now,
        };

        // Generate Playwright code
        const playwrightCode = generatePlaywrightCode(suggestion.test_name, generatedSteps, base_url || suite.base_url || '', 'typescript');
        newTest.playwright_code = playwrightCode;

        await createTest(newTest);

        generatedTests.push({
          id: testId,
          name: suggestion.test_name,
          steps_count: generatedSteps.length,
          confidence: confidenceScore,
        });
      } catch (err) {
        errors.push({
          name: suggestion.test_name,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    // Log audit entry
    logAuditEntry(
      request,
      'ai_bulk_tests_generated',
      'test_suite',
      suite_id,
      suite.name,
      {
        tests_requested: suggestions.length,
        tests_created: generatedTests.length,
        errors: errors.length,
      }
    );

    return {
      success: true,
      generated: generatedTests,
      errors: errors.length > 0 ? errors : undefined,
      summary: {
        total_requested: suggestions.length,
        successfully_generated: generatedTests.length,
        failed: errors.length,
      },
    };
  });
}
