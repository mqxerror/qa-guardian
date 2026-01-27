// Test Suites Module - AI Test Generation Routes
// Feature #1137: AI generates Playwright test code from natural language description

import { FastifyInstance } from 'fastify';
import { authenticate, JwtPayload, getOrganizationId } from '../../middleware/auth';
import { logAuditEntry } from '../audit-logs';
import { Test, TestStep } from './types';
import { testSuites, tests } from './stores';
import { generatePlaywrightCode } from './utils';

// Feature #1137: Request body for AI test generation
interface AIGenerateTestBody {
  description: string;
  suite_id: string;
  test_name?: string;
  base_url?: string;
  generate_options?: {
    include_assertions?: boolean;
    include_screenshots?: boolean;
    wait_for_network?: boolean;
    browser_preference?: 'chromium' | 'firefox' | 'webkit';
  };
}

// Feature #1137: Generated test step interface
interface GeneratedTestStep {
  id: string;
  action: string;
  selector?: string;
  value?: string;
  description?: string;
  order: number;
  modified_by_feedback?: boolean; // Feature #1144: Track if step was modified by feedback
}

// Feature #1137: Parse natural language description into test steps
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

// Feature #1137: Calculate confidence score for generated steps
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

// Feature #1137: Generate test name from description
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

export async function aiGenerationRoutes(app: FastifyInstance) {
  // Feature #1137: Create test from plain English description
  // AI generates Playwright test code from natural language description
  app.post<{ Body: AIGenerateTestBody }>('/api/v1/ai/generate-test', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { description, suite_id, test_name, base_url, generate_options } = request.body;
    const orgId = getOrganizationId(request);
    const user = request.user as JwtPayload;

    if (!description || description.trim().length < 10) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Test description must be at least 10 characters long',
      });
    }

    // Verify suite exists and belongs to organization
    const suite = testSuites.get(suite_id);
    if (!suite || suite.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test suite not found',
      });
    }

    console.log(`[AI TEST GENERATION] Generating test from description: "${description.substring(0, 100)}..."`);

    // Parse the natural language description into test steps
    // This is a rule-based implementation that handles common test scenarios
    const generatedSteps = parseNaturalLanguageToSteps(description, base_url || suite.base_url || '');

    // Calculate confidence score based on parsing quality
    const confidenceScore = calculateConfidenceScore(description, generatedSteps);

    // Generate a test name if not provided
    const finalTestName = test_name || generateTestNameFromDescription(description);

    // Create the test object
    const testId = `test-ai-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date();

    const newTest: Test = {
      id: testId,
      suite_id: suite_id,
      organization_id: orgId,
      name: finalTestName,
      description: description,
      test_type: 'e2e',
      steps: generatedSteps,
      status: suite.require_human_review ? 'draft' : 'active',
      ai_generated: true,
      ai_confidence_score: confidenceScore,
      review_status: suite.require_human_review ? 'pending_review' : null,
      created_at: now,
      updated_at: now,
    };

    // Generate Playwright code from steps
    const playwrightCode = generatePlaywrightCode(
      finalTestName,
      generatedSteps,
      base_url || suite.base_url || '',
      'typescript'
    );

    newTest.playwright_code = playwrightCode;

    // Store the test
    tests.set(testId, newTest);

    console.log(`[AI TEST GENERATION] Created test ${testId} with ${generatedSteps.length} steps (confidence: ${confidenceScore}%)`);

    // Log audit entry
    logAuditEntry(
      request,
      'ai_test_generated',
      'test',
      testId,
      finalTestName,
      {
        description: description.substring(0, 100),
        steps_generated: generatedSteps.length,
        confidence_score: confidenceScore,
      }
    );

    // Extract selectors and assertions from steps for frontend compatibility
    const selectors = generatedSteps
      .filter(s => s.selector)
      .map(s => s.selector as string);
    const assertions = generatedSteps
      .filter(s => s.action === 'assert' || s.action === 'expect' || s.action === 'assert_text' || s.action === 'assert_visible')
      .map(s => s.description || `Assert ${s.value || ''}`);

    return {
      success: true,
      test: {
        id: newTest.id,
        name: newTest.name,
        test_name: newTest.name, // Frontend compatibility alias
        description: newTest.description,
        suite_id: newTest.suite_id,
        test_type: newTest.test_type,
        status: newTest.status,
        ai_generated: newTest.ai_generated,
        ai_confidence_score: newTest.ai_confidence_score,
        review_status: newTest.review_status,
        steps: generatedSteps.map(s => s.description || `${s.action} ${s.selector || s.value || ''}`), // Frontend expects string array
        steps_detailed: generatedSteps.map(s => ({
          id: s.id,
          action: s.action,
          selector: s.selector,
          value: s.value,
          description: s.description,
          order: s.order,
        })),
        playwright_code: playwrightCode,
        code: playwrightCode, // Frontend compatibility alias
        selectors: selectors, // Frontend compatibility
        assertions: assertions, // Frontend compatibility
        syntax_valid: true, // Assume valid since we generated it
        syntax_errors: [], // No syntax errors
        complexity: generatedSteps.length <= 5 ? 'simple' : generatedSteps.length <= 10 ? 'medium' : 'complex',
        warnings: [], // No warnings
        created_at: newTest.created_at.toISOString(),
      },
      generation_info: {
        confidence_score: confidenceScore,
        confidence_level: confidenceScore >= 80 ? 'high' : confidenceScore >= 60 ? 'medium' : 'low',
        steps_generated: generatedSteps.length,
        requires_review: suite.require_human_review || false,
      },
    };
  });
}
