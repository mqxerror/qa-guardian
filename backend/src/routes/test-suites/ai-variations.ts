// Test Suites Module - AI Test Variation Suggestions Routes
// Feature #1146: AI test variation suggestions

import { FastifyInstance } from 'fastify';
import { authenticate, getOrganizationId } from '../../middleware/auth';
import { getTestSuite, createTest } from './stores';
import { Test } from './types';
import { generatePlaywrightCode } from './utils';
import { logAuditEntry } from '../audit-logs';

// Feature #1146: Interface for test variation suggestion
interface TestVariationSuggestion {
  id: string;
  name: string;
  description: string;
  category: 'negative' | 'edge_case' | 'boundary' | 'alternative_flow' | 'security' | 'accessibility' | 'performance';
  difficulty: 'easy' | 'medium' | 'hard';
  priority: 'high' | 'medium' | 'low';
  estimated_steps: number;
  base_description_modification: string;
}

interface AISuggestVariationsBody {
  description: string;
  test_name?: string;
  test_type?: 'login' | 'form' | 'navigation' | 'search' | 'checkout' | 'crud' | 'general';
  include_negative?: boolean; // Include negative/error tests
  include_edge_cases?: boolean; // Include boundary/edge cases
  include_security?: boolean; // Include security-related tests
  max_suggestions?: number; // Max number of suggestions (default: 6)
}

// Feature #1146: Generate a specific variation
interface AIGenerateVariationBody {
  original_description: string;
  variation_id: string;
  variation_description: string;
  suite_id: string;
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
  modified_by_feedback?: boolean;
}

// Feature #1146: Detect test type from description
function detectTestType(description: string): string {
  const lower = description.toLowerCase();

  if (lower.match(/login|sign\s*in|authenticate|password|credential/i)) {
    return 'login';
  }
  if (lower.match(/form|fill|submit|input|field|validation/i)) {
    return 'form';
  }
  if (lower.match(/search|filter|find|query|result/i)) {
    return 'search';
  }
  if (lower.match(/checkout|cart|payment|purchase|order|buy/i)) {
    return 'checkout';
  }
  if (lower.match(/create|read|update|delete|edit|add|remove|crud/i)) {
    return 'crud';
  }
  if (lower.match(/navigate|page|link|menu|route|url/i)) {
    return 'navigation';
  }

  return 'general';
}

// Feature #1146: Generate variations based on test type
function generateVariationsForType(description: string, testType: string, testName?: string): TestVariationSuggestion[] {
  const variations: TestVariationSuggestion[] = [];
  let variationCount = 0;

  // Login-specific variations
  if (testType === 'login') {
    variations.push(
      {
        id: `var-${++variationCount}`,
        name: 'Invalid Password Test',
        description: 'Test login with correct username but invalid password',
        category: 'negative',
        difficulty: 'easy',
        priority: 'high',
        estimated_steps: 5,
        base_description_modification: description.replace(/valid|correct/gi, 'invalid').replace(/success/gi, 'failure') + ' with wrong password, then verify error message appears',
      },
      {
        id: `var-${++variationCount}`,
        name: 'Empty Fields Test',
        description: 'Test login with empty username and password fields',
        category: 'negative',
        difficulty: 'easy',
        priority: 'high',
        estimated_steps: 4,
        base_description_modification: 'Navigate to login page, click login button without filling any fields, verify validation errors appear for empty fields',
      },
      {
        id: `var-${++variationCount}`,
        name: 'Remember Me Test',
        description: 'Test login with Remember Me checkbox enabled',
        category: 'alternative_flow',
        difficulty: 'medium',
        priority: 'medium',
        estimated_steps: 6,
        base_description_modification: description + ', check the remember me checkbox before submitting, then close browser and reopen to verify session persists',
      },
      {
        id: `var-${++variationCount}`,
        name: 'Invalid Email Format',
        description: 'Test login with malformed email address',
        category: 'edge_case',
        difficulty: 'easy',
        priority: 'medium',
        estimated_steps: 4,
        base_description_modification: 'Navigate to login page, enter "invalid-email" in email field, enter password, click login, verify email format validation error',
      },
      {
        id: `var-${++variationCount}`,
        name: 'SQL Injection Test',
        description: 'Test login fields for SQL injection vulnerability',
        category: 'security',
        difficulty: 'medium',
        priority: 'high',
        estimated_steps: 5,
        base_description_modification: 'Navigate to login page, enter "\' OR \'1\'=\'1" in email field, enter password, click login, verify no unauthorized access',
      },
      {
        id: `var-${++variationCount}`,
        name: 'XSS Prevention Test',
        description: 'Test login fields for XSS vulnerability',
        category: 'security',
        difficulty: 'medium',
        priority: 'high',
        estimated_steps: 5,
        base_description_modification: 'Navigate to login page, enter "<script>alert(1)</script>" in email field, submit form, verify script is not executed and input is sanitized',
      },
      {
        id: `var-${++variationCount}`,
        name: 'Account Lockout Test',
        description: 'Test account lockout after multiple failed attempts',
        category: 'boundary',
        difficulty: 'hard',
        priority: 'medium',
        estimated_steps: 12,
        base_description_modification: 'Attempt login 5 times with wrong password, verify account lockout message appears on 6th attempt',
      },
      {
        id: `var-${++variationCount}`,
        name: 'Case Sensitivity Test',
        description: 'Test if email/username is case-sensitive',
        category: 'edge_case',
        difficulty: 'easy',
        priority: 'low',
        estimated_steps: 5,
        base_description_modification: description.replace(/email|username/gi, 'EMAIL IN UPPERCASE') + ' with uppercase email/username, verify login behavior',
      }
    );
  }

  // Form-specific variations
  if (testType === 'form' || testType === 'general') {
    variations.push(
      {
        id: `var-${++variationCount}`,
        name: 'Required Field Validation',
        description: 'Test form submission with required fields empty',
        category: 'negative',
        difficulty: 'easy',
        priority: 'high',
        estimated_steps: 4,
        base_description_modification: 'Submit form without filling required fields, verify validation errors appear for each required field',
      },
      {
        id: `var-${++variationCount}`,
        name: 'Maximum Length Test',
        description: 'Test input fields with maximum length values',
        category: 'boundary',
        difficulty: 'medium',
        priority: 'medium',
        estimated_steps: 5,
        base_description_modification: 'Fill form fields with 256 character strings, verify proper handling (truncation or error message)',
      },
      {
        id: `var-${++variationCount}`,
        name: 'Special Characters Test',
        description: 'Test form with special characters in input',
        category: 'edge_case',
        difficulty: 'medium',
        priority: 'medium',
        estimated_steps: 5,
        base_description_modification: 'Fill form fields with special characters (!@#$%^&*), submit form, verify proper handling and display',
      }
    );
  }

  // Search-specific variations
  if (testType === 'search') {
    variations.push(
      {
        id: `var-${++variationCount}`,
        name: 'Empty Search Test',
        description: 'Test search with empty query',
        category: 'negative',
        difficulty: 'easy',
        priority: 'high',
        estimated_steps: 3,
        base_description_modification: 'Click search button without entering query, verify appropriate message or all results shown',
      },
      {
        id: `var-${++variationCount}`,
        name: 'No Results Test',
        description: 'Test search with query that returns no results',
        category: 'negative',
        difficulty: 'easy',
        priority: 'high',
        estimated_steps: 4,
        base_description_modification: 'Search for "xyznonexistent12345", verify "No results found" message appears',
      },
      {
        id: `var-${++variationCount}`,
        name: 'Search with Filters',
        description: 'Test search combined with filter options',
        category: 'alternative_flow',
        difficulty: 'medium',
        priority: 'medium',
        estimated_steps: 6,
        base_description_modification: 'Enter search query, apply filter options, verify filtered results match criteria',
      }
    );
  }

  // Checkout-specific variations
  if (testType === 'checkout') {
    variations.push(
      {
        id: `var-${++variationCount}`,
        name: 'Invalid Card Number',
        description: 'Test checkout with invalid credit card number',
        category: 'negative',
        difficulty: 'medium',
        priority: 'high',
        estimated_steps: 6,
        base_description_modification: 'Enter invalid credit card number 1234-1234-1234-1234, submit payment, verify card validation error',
      },
      {
        id: `var-${++variationCount}`,
        name: 'Expired Card Test',
        description: 'Test checkout with expired credit card',
        category: 'negative',
        difficulty: 'medium',
        priority: 'high',
        estimated_steps: 6,
        base_description_modification: 'Enter valid card number with past expiration date, submit payment, verify expiration error',
      },
      {
        id: `var-${++variationCount}`,
        name: 'Empty Cart Checkout',
        description: 'Test accessing checkout with empty cart',
        category: 'edge_case',
        difficulty: 'easy',
        priority: 'medium',
        estimated_steps: 3,
        base_description_modification: 'Navigate to checkout page with empty cart, verify redirect or appropriate message',
      }
    );
  }

  // CRUD-specific variations
  if (testType === 'crud') {
    variations.push(
      {
        id: `var-${++variationCount}`,
        name: 'Delete Confirmation',
        description: 'Test delete operation with confirmation dialog',
        category: 'alternative_flow',
        difficulty: 'easy',
        priority: 'high',
        estimated_steps: 5,
        base_description_modification: 'Click delete button, verify confirmation dialog appears, click cancel, verify item not deleted',
      },
      {
        id: `var-${++variationCount}`,
        name: 'Duplicate Entry Test',
        description: 'Test creating duplicate entries',
        category: 'negative',
        difficulty: 'medium',
        priority: 'medium',
        estimated_steps: 6,
        base_description_modification: 'Create item, try to create another with same unique identifier, verify duplicate error message',
      }
    );
  }

  // Navigation-specific variations
  if (testType === 'navigation') {
    variations.push(
      {
        id: `var-${++variationCount}`,
        name: 'Back Button Navigation',
        description: 'Test browser back button behavior',
        category: 'alternative_flow',
        difficulty: 'easy',
        priority: 'medium',
        estimated_steps: 4,
        base_description_modification: 'Navigate through multiple pages, click browser back button, verify correct page displayed',
      },
      {
        id: `var-${++variationCount}`,
        name: 'Invalid URL Test',
        description: 'Test accessing non-existent page',
        category: 'negative',
        difficulty: 'easy',
        priority: 'medium',
        estimated_steps: 3,
        base_description_modification: 'Navigate to /nonexistent-page-12345, verify 404 page or redirect displayed',
      }
    );
  }

  // Universal variations (applicable to all test types)
  variations.push(
    {
      id: `var-${++variationCount}`,
      name: 'Accessibility Test',
      description: 'Test keyboard navigation and screen reader support',
      category: 'accessibility',
      difficulty: 'medium',
      priority: 'medium',
      estimated_steps: 6,
      base_description_modification: description + ', then verify all interactive elements are keyboard accessible using Tab key, verify ARIA labels present',
    },
    {
      id: `var-${++variationCount}`,
      name: 'Mobile Viewport Test',
      description: 'Test functionality on mobile viewport',
      category: 'alternative_flow',
      difficulty: 'easy',
      priority: 'medium',
      estimated_steps: 5,
      base_description_modification: description + ' on mobile viewport (375x667)',
    },
    {
      id: `var-${++variationCount}`,
      name: 'Slow Network Test',
      description: 'Test behavior under slow network conditions',
      category: 'performance',
      difficulty: 'hard',
      priority: 'low',
      estimated_steps: 5,
      base_description_modification: description + ' with network throttled to 3G speed, verify loading indicators and timeouts work correctly',
    }
  );

  return variations;
}

// Parse natural language description into test steps
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

  // Pattern: Login/Sign in
  const loginMatch = desc.match(/(?:login|log\s*in|sign\s*in|authenticate)\s+(?:with\s+)?(?:(?:valid|correct|test)\s+)?(?:credentials?)?/i);
  if (loginMatch) {
    // Look for username/email
    const emailMatch = desc.match(/(?:email|username|user)(?:\s+(?:is|of|:))?\s*['"]?([^\s'"]+@[^\s'"]+|[^\s'"]+)['"]?/i);
    const passwordMatch = desc.match(/password(?:\s+(?:is|of|:))?\s*['"]?([^\s'"]+)['"]?/i);

    steps.push({
      id: `step-${++stepOrder}`,
      action: 'fill',
      selector: '[data-testid="email"], [name="email"], [type="email"], #email, input[placeholder*="email" i]',
      value: emailMatch ? emailMatch[1] : 'test@example.com',
      description: 'Enter email/username',
      order: stepOrder,
    });

    steps.push({
      id: `step-${++stepOrder}`,
      action: 'fill',
      selector: '[data-testid="password"], [name="password"], [type="password"], #password',
      value: passwordMatch ? passwordMatch[1] : 'password123',
      description: 'Enter password',
      order: stepOrder,
    });

    steps.push({
      id: `step-${++stepOrder}`,
      action: 'click',
      selector: '[data-testid="login-button"], [data-testid="submit"], button[type="submit"], button:has-text("Login"), button:has-text("Sign in")',
      description: 'Click login button',
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

  // Pattern: Verify page/dashboard/element loads
  const pageLoadMatch = desc.match(/(?:verify|check|assert|confirm|ensure|expect)\s+(?:that\s+)?(?:the\s+)?(\w+)\s+(?:page\s+)?loads?/i);
  if (pageLoadMatch && pageLoadMatch[1]) {
    const pageName = pageLoadMatch[1].trim();
    steps.push({
      id: `step-${++stepOrder}`,
      action: 'wait',
      value: '1000',
      description: `Wait for ${pageName} to load`,
      order: stepOrder,
    });
    steps.push({
      id: `step-${++stepOrder}`,
      action: 'screenshot',
      description: `Take screenshot of ${pageName}`,
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

  // Pattern: Select dropdown option
  const selectMatch = desc.match(/select\s+['"]?([^'"]+?)['"]?\s+(?:from|in)\s+(?:the\s+)?['"]?([^'"]+?)['"]?\s*(?:dropdown|select|menu)?/i);
  if (selectMatch && selectMatch[1] && selectMatch[2]) {
    steps.push({
      id: `step-${++stepOrder}`,
      action: 'select',
      selector: `select[name="${selectMatch[2]}"], [data-testid="${selectMatch[2]}"]`,
      value: selectMatch[1],
      description: `Select "${selectMatch[1]}" from ${selectMatch[2]}`,
      order: stepOrder,
    });
  }

  // Pattern: Take screenshot
  if (desc.includes('screenshot') || desc.includes('capture')) {
    steps.push({
      id: `step-${++stepOrder}`,
      action: 'screenshot',
      description: 'Take screenshot',
      order: stepOrder,
    });
  }

  // If we only have navigation, add a screenshot step
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

// Generate test name from description
function generateTestNameFromDescription(description: string): string {
  // Take first 50 chars, clean up
  let name = description.substring(0, 50).trim();

  // Remove common starting phrases
  name = name.replace(/^(?:test\s+)?(?:that\s+)?(?:it\s+)?(?:should\s+)?/i, '');

  // Capitalize first letter
  name = name.charAt(0).toUpperCase() + name.slice(1);

  // Remove trailing incomplete words
  if (!name.endsWith('.') && !name.endsWith('!') && !name.endsWith('?')) {
    const lastSpace = name.lastIndexOf(' ');
    if (lastSpace > 20) {
      name = name.substring(0, lastSpace);
    }
  }

  // Add ellipsis if truncated
  if (description.length > 50 && !name.endsWith('...')) {
    name = name.replace(/[.,!?]$/, '') + '...';
  }

  return name || 'AI Generated Test';
}

export async function aiVariationsRoutes(app: FastifyInstance) {
  // Feature #1146: Suggest Test Variations Endpoint
  // Analyzes a test description and suggests variations
  app.post<{ Body: AISuggestVariationsBody }>('/api/v1/ai/suggest-variations', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const {
      description,
      test_name,
      test_type,
      include_negative = true,
      include_edge_cases = true,
      include_security = true,
      max_suggestions = 6,
    } = request.body;

    if (!description || description.trim().length < 10) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Description must be at least 10 characters long',
      });
    }

    console.log(`[AI SUGGEST VARIATIONS] Generating variations for: "${description.substring(0, 50)}..."`);

    // Detect the test type from description
    const detectedType = test_type || detectTestType(description);

    // Generate variations based on test type
    const allVariations = generateVariationsForType(description, detectedType, test_name);

    // Filter variations based on options
    let filteredVariations = allVariations;
    if (!include_negative) {
      filteredVariations = filteredVariations.filter(v => v.category !== 'negative');
    }
    if (!include_edge_cases) {
      filteredVariations = filteredVariations.filter(v => !['edge_case', 'boundary'].includes(v.category));
    }
    if (!include_security) {
      filteredVariations = filteredVariations.filter(v => v.category !== 'security');
    }

    // Sort by priority and limit
    filteredVariations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
    filteredVariations = filteredVariations.slice(0, max_suggestions);

    console.log(`[AI SUGGEST VARIATIONS] Generated ${filteredVariations.length} variations for ${detectedType} test`);

    return {
      success: true,
      original_test: {
        description,
        test_name: test_name || 'Original Test',
        detected_type: detectedType,
      },
      variations: filteredVariations,
      total_suggestions: filteredVariations.length,
      categories_included: [...new Set(filteredVariations.map(v => v.category))],
      generate_variation_endpoint: 'POST /api/v1/ai/generate-variation',
      tips: [
        'Negative tests help catch error handling issues',
        'Edge cases reveal boundary condition bugs',
        'Security variations help identify vulnerabilities',
        'Alternative flows ensure complete coverage',
      ],
    };
  });

  // Feature #1146: Generate a specific variation
  app.post<{ Body: AIGenerateVariationBody }>('/api/v1/ai/generate-variation', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { original_description, variation_id, variation_description, suite_id, base_url } = request.body;
    const orgId = getOrganizationId(request);

    if (!variation_description || !suite_id) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'variation_description and suite_id are required',
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

    console.log(`[AI GENERATE VARIATION] Generating variation ${variation_id}`);

    // Generate the variation test
    const generatedSteps = parseNaturalLanguageToSteps(variation_description, base_url || suite.base_url || '');
    const confidenceScore = calculateConfidenceScore(variation_description, generatedSteps);
    const testName = generateTestNameFromDescription(variation_description);

    // Create the test
    const testId = `test-variation-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date();

    const newTest: Test = {
      id: testId,
      suite_id: suite_id,
      organization_id: orgId,
      name: testName,
      description: variation_description,
      test_type: 'e2e',
      steps: generatedSteps,
      status: suite.require_human_review ? 'draft' : 'active',
      ai_generated: true,
      ai_confidence_score: confidenceScore,
      review_status: suite.require_human_review ? 'pending_review' : null,
      created_at: now,
      updated_at: now,
    };

    // Generate Playwright code
    const playwrightCode = generatePlaywrightCode(testName, generatedSteps, base_url || suite.base_url || '', 'typescript');
    newTest.playwright_code = playwrightCode;

    // Store the test
    await createTest(newTest);

    // Log audit entry
    logAuditEntry(
      request,
      'ai_variation_generated',
      'test',
      testId,
      testName,
      {
        original_description: original_description?.substring(0, 100),
        variation_id,
        steps_generated: generatedSteps.length,
      }
    );

    return {
      success: true,
      test: {
        id: newTest.id,
        name: newTest.name,
        description: newTest.description,
        suite_id: newTest.suite_id,
        steps: generatedSteps.map(s => ({
          id: s.id,
          action: s.action,
          selector: s.selector,
          value: s.value,
          description: s.description,
          order: s.order,
        })),
        playwright_code: playwrightCode,
        ai_confidence_score: confidenceScore,
        created_at: newTest.created_at.toISOString(),
      },
      variation_info: {
        variation_id,
        based_on: original_description,
      },
    };
  });
}
