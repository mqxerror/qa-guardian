// Test Suites Module - AI Analyze and Refine Test Descriptions
// Feature #1141: AI-powered description analysis and test refinement

import { FastifyInstance } from 'fastify';
import { authenticate, getOrganizationId } from '../../middleware/auth';
import { logAuditEntry } from '../audit-logs';
import { testSuites, tests } from './stores';
import { Test, TestStep } from './types';
import { generatePlaywrightCode } from './utils';

// Feature #1141: Interface for clarifying question
export interface ClarifyingQuestion {
  id: string;
  question: string;
  category: 'credentials' | 'navigation' | 'validation' | 'expected_outcome' | 'element' | 'data' | 'scope';
  options?: string[]; // Pre-defined options if applicable
  required: boolean;
  default_answer?: string;
}

interface AmbiguityAnalysis {
  is_ambiguous: boolean;
  ambiguity_score: number; // 0-100 (higher = more ambiguous)
  detected_intent?: string;
  missing_information: string[];
  questions: ClarifyingQuestion[];
}

export interface AIAnalyzeDescriptionBody {
  description: string;
  context?: {
    application_type?: 'web' | 'mobile' | 'api';
    has_authentication?: boolean;
    known_pages?: string[];
  };
  auto_generate_if_clear?: boolean; // If description is clear, auto-generate test
  suite_id?: string; // Required if auto_generate_if_clear is true
}

export interface AIRefineTestBody {
  description: string;
  answers: Record<string, string>; // question_id -> answer
  suite_id: string;
  test_name?: string;
  base_url?: string;
}

// Generated test step interface for AI test generation
interface GeneratedTestStep {
  id: string;
  action: string;
  selector?: string;
  value?: string;
  description?: string;
  order: number;
  modified_by_feedback?: boolean;
}

// Feature #1141: AI Analyze and Refine Routes
export async function aiRefineRoutes(app: FastifyInstance) {
  // Feature #1141: AI Analyze Description Endpoint
  // Detects ambiguous descriptions and returns clarifying questions
  app.post<{ Body: AIAnalyzeDescriptionBody }>('/api/v1/ai/analyze-description', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { description, context, auto_generate_if_clear = false, suite_id } = request.body;

    if (!description || description.trim().length < 5) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Description must be at least 5 characters long',
      });
    }

    console.log(`[AI ANALYZE DESCRIPTION] Analyzing: "${description.substring(0, 50)}..."`);

    // Analyze the description for ambiguity
    const analysis = analyzeDescriptionForAmbiguity(description, context);

    console.log(`[AI ANALYZE DESCRIPTION] Ambiguity score: ${analysis.ambiguity_score}, Questions: ${analysis.questions.length}`);

    // If not ambiguous and auto_generate is enabled, generate the test
    if (!analysis.is_ambiguous && auto_generate_if_clear && suite_id) {
      const orgId = getOrganizationId(request);
      const suite = testSuites.get(suite_id);

      if (!suite || suite.organization_id !== orgId) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Test suite not found',
        });
      }

      // Generate the test directly since description is clear
      const generatedSteps = parseNaturalLanguageToSteps(description, suite.base_url || '');
      const confidenceScore = calculateConfidenceScore(description, generatedSteps);
      const testName = generateTestNameFromDescription(description);

      return {
        analysis,
        auto_generated: true,
        test_preview: {
          name: testName,
          steps: generatedSteps.length,
          confidence_score: confidenceScore,
        },
        message: 'Description is clear enough to generate a test automatically',
      };
    }

    return {
      analysis,
      auto_generated: false,
      message: analysis.is_ambiguous
        ? 'Please answer the clarifying questions to generate a more accurate test'
        : 'Description is clear. You can proceed with test generation.',
      next_step: analysis.is_ambiguous
        ? 'POST /api/v1/ai/refine-test with answers to generate the test'
        : 'POST /api/v1/ai/generate-test to generate the test',
    };
  });

  // Feature #1141: AI Refine Test Endpoint
  // Generates test after receiving answers to clarifying questions
  app.post<{ Body: AIRefineTestBody }>('/api/v1/ai/refine-test', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { description, answers, suite_id, test_name, base_url } = request.body;
    const orgId = getOrganizationId(request);

    if (!description || !answers || Object.keys(answers).length === 0) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Description and answers are required',
      });
    }

    // Verify suite exists
    const suite = testSuites.get(suite_id);
    if (!suite || suite.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test suite not found',
      });
    }

    console.log(`[AI REFINE TEST] Refining test with ${Object.keys(answers).length} answers`);

    // Enhance the description with answers
    const enhancedDescription = enhanceDescriptionWithAnswers(description, answers);

    // Generate test from enhanced description
    const generatedSteps = parseNaturalLanguageToSteps(enhancedDescription, base_url || suite.base_url || '');
    const confidenceScore = calculateConfidenceScore(enhancedDescription, generatedSteps);
    const finalTestName = test_name || generateTestNameFromDescription(description);

    // Create the test
    const testId = `test-ai-refined-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date();

    const newTest: Test = {
      id: testId,
      suite_id: suite_id,
      organization_id: orgId,
      name: finalTestName,
      description: enhancedDescription,
      test_type: 'e2e',
      steps: generatedSteps as TestStep[],
      status: suite.require_human_review ? 'draft' : 'active',
      ai_generated: true,
      ai_confidence_score: confidenceScore,
      review_status: suite.require_human_review ? 'pending_review' : null,
      created_at: now,
      updated_at: now,
    };

    // Generate Playwright code
    const playwrightCode = generatePlaywrightCode(
      finalTestName,
      generatedSteps as TestStep[],
      base_url || suite.base_url || '',
      'typescript'
    );
    newTest.playwright_code = playwrightCode;

    // Store the test
    tests.set(testId, newTest);

    console.log(`[AI REFINE TEST] Created refined test ${testId} with ${generatedSteps.length} steps`);

    // Log audit entry
    logAuditEntry(
      request,
      'ai_test_refined',
      'test',
      testId,
      finalTestName,
      {
        original_description: description.substring(0, 100),
        answers_count: Object.keys(answers).length,
        steps_generated: generatedSteps.length,
        confidence_score: confidenceScore,
      }
    );

    return {
      success: true,
      test: {
        id: newTest.id,
        name: newTest.name,
        description: newTest.description,
        original_description: description,
        suite_id: newTest.suite_id,
        test_type: newTest.test_type,
        status: newTest.status,
        ai_generated: newTest.ai_generated,
        ai_confidence_score: newTest.ai_confidence_score,
        steps: generatedSteps.map(s => ({
          id: s.id,
          action: s.action,
          selector: s.selector,
          value: s.value,
          description: s.description,
          order: s.order,
        })),
        playwright_code: playwrightCode,
        created_at: newTest.created_at.toISOString(),
      },
      refinement_info: {
        questions_answered: Object.keys(answers).length,
        original_description: description,
        enhanced_description: enhancedDescription,
        confidence_improvement: `Enhanced from ambiguous to ${confidenceScore}% confidence`,
      },
    };
  });
}

// Feature #1141: Analyze description for ambiguity
function analyzeDescriptionForAmbiguity(
  description: string,
  context?: { application_type?: string; has_authentication?: boolean; known_pages?: string[] }
): AmbiguityAnalysis {
  const desc = description.toLowerCase().trim();
  const questions: ClarifyingQuestion[] = [];
  const missingInfo: string[] = [];
  let ambiguityScore = 0;
  let detectedIntent = '';

  // Detect the general intent
  if (desc.match(/login|sign\s*in|authenticate/i)) {
    detectedIntent = 'authentication';
  } else if (desc.match(/register|sign\s*up|create\s+account/i)) {
    detectedIntent = 'registration';
  } else if (desc.match(/search|find|filter/i)) {
    detectedIntent = 'search';
  } else if (desc.match(/checkout|purchase|buy|order/i)) {
    detectedIntent = 'checkout';
  } else if (desc.match(/form|submit|fill/i)) {
    detectedIntent = 'form_submission';
  } else if (desc.match(/navigate|go\s+to|visit/i)) {
    detectedIntent = 'navigation';
  } else {
    detectedIntent = 'general';
    ambiguityScore += 20;
  }

  // Check for vague/ambiguous patterns
  const vaguePatterns = [
    { pattern: /^test\s+(?:the\s+)?(\w+)$/i, type: 'too_short', score: 40 },
    { pattern: /^check\s+(?:if\s+)?(\w+)/i, type: 'vague_check', score: 30 },
    { pattern: /^verify\s+(\w+)$/i, type: 'vague_verify', score: 30 },
    { pattern: /^(?:make\s+sure|ensure)\s+/i, type: 'vague_ensure', score: 25 },
    { pattern: /works?(?:\s+correctly)?$/i, type: 'vague_works', score: 35 },
    { pattern: /^(?:it\s+)?should\s+\w+$/i, type: 'incomplete_should', score: 30 },
  ];

  for (const { pattern, type, score } of vaguePatterns) {
    if (pattern.test(desc)) {
      ambiguityScore += score;
    }
  }

  // Check for missing credentials in auth-related tests
  if (detectedIntent === 'authentication') {
    if (!desc.match(/email|username|user/i) && !desc.match(/password|pass/i)) {
      missingInfo.push('credentials');
      ambiguityScore += 15;
      questions.push({
        id: 'credentials',
        question: 'What credentials should be used for login?',
        category: 'credentials',
        options: ['Valid test user (test@example.com / password123)', 'Invalid credentials', 'Custom credentials'],
        required: true,
        default_answer: 'Valid test user (test@example.com / password123)',
      });
    }

    if (!desc.match(/success|dashboard|redirect|welcome|home/i)) {
      missingInfo.push('expected_outcome');
      ambiguityScore += 15;
      questions.push({
        id: 'login_success',
        question: 'What indicates a successful login?',
        category: 'expected_outcome',
        options: ['Redirect to dashboard', 'Welcome message appears', 'User profile visible', 'Custom indicator'],
        required: true,
        default_answer: 'Redirect to dashboard',
      });
    }
  }

  // Check for missing navigation target
  if (!desc.match(/(?:to|at)\s+(?:the\s+)?(?:https?:\/\/|\/|\w+\s+page)/i) && !desc.match(/url|page|screen/i)) {
    missingInfo.push('target_url');
    ambiguityScore += 10;
    questions.push({
      id: 'target_url',
      question: 'Which page or URL should this test start from?',
      category: 'navigation',
      options: ['Home page (/)', 'Login page (/login)', 'Dashboard (/dashboard)', 'Custom URL'],
      required: false,
      default_answer: 'Home page (/)',
    });
  }

  // Check for missing element specifics in interaction tests
  if (desc.match(/click|fill|enter|type|select/i) && !desc.match(/button|input|field|dropdown|link|['"].*['"]/i)) {
    missingInfo.push('element_details');
    ambiguityScore += 20;
    questions.push({
      id: 'element_target',
      question: 'Which specific element should be interacted with?',
      category: 'element',
      required: true,
    });
  }

  // Check for missing validation criteria
  if (desc.match(/verify|check|assert|validate/i) && !desc.match(/text|message|visible|present|contains|value|count/i)) {
    missingInfo.push('validation_criteria');
    ambiguityScore += 15;
    questions.push({
      id: 'validation_type',
      question: 'What should be verified?',
      category: 'validation',
      options: ['Text is visible', 'Element is present', 'Value matches expected', 'Page title/URL changed', 'Custom validation'],
      required: true,
    });
  }

  // Check for scope ambiguity (single action vs flow)
  if (desc.split(/\s+/).length < 8 && !desc.match(/and|then|after|before|first|next|finally/i)) {
    if (detectedIntent !== 'navigation') {
      missingInfo.push('test_scope');
      ambiguityScore += 10;
      questions.push({
        id: 'test_scope',
        question: 'Should this test cover a single action or a complete flow?',
        category: 'scope',
        options: ['Single action only', 'Complete flow with setup and verification', 'Part of a larger test'],
        required: false,
        default_answer: 'Complete flow with setup and verification',
      });
    }
  }

  // Cap ambiguity score
  ambiguityScore = Math.min(ambiguityScore, 100);

  // Determine if description is ambiguous (threshold: 30)
  const isAmbiguous = ambiguityScore >= 30 || questions.length >= 2;

  return {
    is_ambiguous: isAmbiguous,
    ambiguity_score: ambiguityScore,
    detected_intent: detectedIntent,
    missing_information: missingInfo,
    questions: questions.sort((a, b) => (b.required ? 1 : 0) - (a.required ? 1 : 0)),
  };
}

// Feature #1141: Enhance description with clarifying answers
function enhanceDescriptionWithAnswers(description: string, answers: Record<string, string>): string {
  let enhanced = description;

  // Add credentials info
  if (answers.credentials) {
    if (answers.credentials.includes('test@example.com')) {
      enhanced += ' with email test@example.com and password password123';
    } else if (answers.credentials.includes('Invalid')) {
      enhanced += ' with invalid email invalid@test.com and wrong password wrongpass';
    } else {
      enhanced += ` with credentials: ${answers.credentials}`;
    }
  }

  // Add expected outcome
  if (answers.login_success) {
    if (answers.login_success.includes('dashboard')) {
      enhanced += ', then verify redirect to dashboard page';
    } else if (answers.login_success.includes('Welcome')) {
      enhanced += ', then verify "Welcome" message is visible';
    } else if (answers.login_success.includes('profile')) {
      enhanced += ', then verify user profile is visible';
    } else {
      enhanced += `, then verify ${answers.login_success}`;
    }
  }

  // Add target URL
  if (answers.target_url) {
    if (!enhanced.toLowerCase().includes('navigate') && !enhanced.toLowerCase().includes('go to')) {
      const url = answers.target_url.match(/\(([^)]+)\)/)?.[1] || answers.target_url;
      enhanced = `Navigate to ${url}, then ` + enhanced;
    }
  }

  // Add element target
  if (answers.element_target) {
    enhanced += ` on the ${answers.element_target}`;
  }

  // Add validation type
  if (answers.validation_type) {
    if (answers.validation_type.includes('Text')) {
      enhanced += ' and verify text is visible';
    } else if (answers.validation_type.includes('Element')) {
      enhanced += ' and verify element is present';
    } else if (answers.validation_type.includes('Value')) {
      enhanced += ' and verify value matches expected';
    } else if (answers.validation_type.includes('title')) {
      enhanced += ' and verify page title changed';
    }
  }

  // Add scope info
  if (answers.test_scope) {
    if (answers.test_scope.includes('Complete flow')) {
      enhanced += '. Include setup and final verification steps.';
    }
  }

  return enhanced;
}

// Feature #1137: Parse natural language to test steps
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
