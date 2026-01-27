// Test Suites Module - AI Regenerate with Feedback Routes
// Feature #1144: AI regenerate test with feedback

import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth';
import { generatePlaywrightCode } from './utils';

// Feature #1144: Interface for regeneration with feedback
interface AIRegenerateWithFeedbackBody {
  description: string;
  original_code?: string; // Previous generated code to improve
  feedback: string[]; // User feedback points
  base_url?: string;
  test_name?: string;
  format?: 'typescript' | 'javascript';
}

// Feature #1144: Feedback rule interface
interface FeedbackRule {
  original: string;
  type: 'action_replace' | 'selector_replace' | 'add_step' | 'remove_step' | 'code_replace' | 'style_change';
  pattern?: RegExp;
  replacement?: string;
  stepAction?: string;
  newAction?: string;
  newSelector?: string;
  applied: boolean;
}

// Generated test step interface (local copy for AI generation)
interface GeneratedTestStep {
  id: string;
  action: string;
  selector?: string;
  value?: string;
  description?: string;
  order: number;
  modified_by_feedback?: boolean; // Feature #1144: Track if step was modified by feedback
}

// Feature #1144: Helper to escape regex special characters
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Feature #1144: Parse feedback strings to actionable rules
function parseFeedbackToRules(feedback: string[]): FeedbackRule[] {
  const rules: FeedbackRule[] = [];

  for (const item of feedback) {
    const lower = item.toLowerCase();

    // Pattern: "Use X instead of Y"
    const useInsteadMatch = item.match(/use\s+(['"]?[a-z_.]+['"]?)\s+instead\s+of\s+(['"]?[a-z_.]+['"]?)/i);
    if (useInsteadMatch && useInsteadMatch[1] && useInsteadMatch[2]) {
      const replacement = useInsteadMatch[1].replace(/['"]/g, '');
      const original = useInsteadMatch[2].replace(/['"]/g, '');

      // Check if it's an action replacement
      if (original.includes('.') || replacement.includes('.')) {
        rules.push({
          original: item,
          type: 'code_replace',
          pattern: new RegExp(escapeRegex(original), 'g'),
          replacement: replacement,
          applied: false,
        });
      } else {
        rules.push({
          original: item,
          type: 'action_replace',
          stepAction: original,
          newAction: replacement,
          applied: false,
        });
      }
      continue;
    }

    // Pattern: "Replace X with Y"
    const replaceMatch = item.match(/replace\s+(['"]?[^'"]+['"]?)\s+with\s+(['"]?[^'"]+['"]?)/i);
    if (replaceMatch && replaceMatch[1] && replaceMatch[2]) {
      rules.push({
        original: item,
        type: 'code_replace',
        pattern: new RegExp(escapeRegex(replaceMatch[1].replace(/['"]/g, '')), 'g'),
        replacement: replaceMatch[2].replace(/['"]/g, ''),
        applied: false,
      });
      continue;
    }

    // Pattern: "Add X step" or "Include X"
    if (lower.match(/add\s+(?:a\s+)?(\w+)\s+step|include\s+(\w+)/i)) {
      const addMatch = lower.match(/add\s+(?:a\s+)?(\w+)|include\s+(\w+)/i);
      if (addMatch) {
        const action = (addMatch[1] || addMatch[2] || '').toLowerCase();
        rules.push({
          original: item,
          type: 'add_step',
          stepAction: action,
          applied: false,
        });
      }
      continue;
    }

    // Pattern: "Remove X" or "Don't include X"
    if (lower.match(/remove\s+(\w+)|don'?t\s+include\s+(\w+)|no\s+(\w+)/i)) {
      const removeMatch = lower.match(/remove\s+(\w+)|don'?t\s+include\s+(\w+)|no\s+(\w+)/i);
      if (removeMatch) {
        const action = (removeMatch[1] || removeMatch[2] || removeMatch[3] || '').toLowerCase();
        rules.push({
          original: item,
          type: 'remove_step',
          stepAction: action,
          applied: false,
        });
      }
      continue;
    }

    // Pattern: "Use data-testid selectors" or selector preferences
    if (lower.includes('data-testid') || lower.includes('aria-label') || lower.includes('selector')) {
      rules.push({
        original: item,
        type: 'style_change',
        pattern: /selector/i,
        applied: false,
      });
      continue;
    }

    // Pattern: "Add assertion for X" or "Verify X"
    if (lower.match(/add\s+(?:an?\s+)?assertion|verify\s+/i)) {
      rules.push({
        original: item,
        type: 'add_step',
        stepAction: 'assert',
        applied: false,
      });
      continue;
    }

    // Generic text replacement
    const genericMatch = item.match(/['"]([^'"]+)['"]\s*(?:->|to|=>)\s*['"]([^'"]+)['"]/);
    if (genericMatch && genericMatch[1] && genericMatch[2]) {
      rules.push({
        original: item,
        type: 'code_replace',
        pattern: new RegExp(escapeRegex(genericMatch[1]), 'g'),
        replacement: genericMatch[2],
        applied: false,
      });
      continue;
    }
  }

  return rules;
}

// Feature #1144: Apply feedback rules to steps
function applyFeedbackRulesToSteps(steps: GeneratedTestStep[], rules: FeedbackRule[]): GeneratedTestStep[] {
  let modifiedSteps = [...steps];

  for (const rule of rules) {
    switch (rule.type) {
      case 'action_replace':
        if (rule.stepAction && rule.newAction) {
          for (const step of modifiedSteps) {
            if (step.action === rule.stepAction || step.action.includes(rule.stepAction)) {
              step.action = rule.newAction;
              (step as GeneratedTestStep & { modified_by_feedback?: boolean }).modified_by_feedback = true;
              rule.applied = true;
            }
          }
        }
        break;

      case 'remove_step':
        if (rule.stepAction) {
          const originalLength = modifiedSteps.length;
          modifiedSteps = modifiedSteps.filter(s => !s.action.includes(rule.stepAction!));
          if (modifiedSteps.length < originalLength) {
            rule.applied = true;
          }
        }
        break;

      case 'add_step':
        if (rule.stepAction === 'screenshot') {
          const hasScreenshot = modifiedSteps.some(s => s.action === 'screenshot');
          if (!hasScreenshot) {
            modifiedSteps.push({
              id: `step-${modifiedSteps.length + 1}`,
              action: 'screenshot',
              description: 'Take screenshot (added by feedback)',
              order: modifiedSteps.length + 1,
            });
            rule.applied = true;
          }
        } else if (rule.stepAction === 'assert' || rule.stepAction === 'assertion') {
          const hasAssert = modifiedSteps.some(s => s.action.includes('assert'));
          if (!hasAssert) {
            modifiedSteps.push({
              id: `step-${modifiedSteps.length + 1}`,
              action: 'assert_text',
              value: 'Expected content',
              description: 'Verify expected content (added by feedback)',
              order: modifiedSteps.length + 1,
            });
            rule.applied = true;
          }
        } else if (rule.stepAction === 'wait') {
          modifiedSteps.push({
            id: `step-${modifiedSteps.length + 1}`,
            action: 'wait',
            value: '1000',
            description: 'Wait for page stability (added by feedback)',
            order: modifiedSteps.length + 1,
          });
          rule.applied = true;
        }
        break;
    }
  }

  // Renumber steps
  modifiedSteps.forEach((step, index) => {
    step.order = index + 1;
    step.id = `step-${index + 1}`;
  });

  return modifiedSteps;
}

// Feature #1144: Apply feedback rules to generated code
function applyFeedbackToCode(code: string, rules: FeedbackRule[]): string {
  let modifiedCode = code;

  for (const rule of rules) {
    if (rule.type === 'code_replace' && rule.pattern && rule.replacement) {
      const originalCode = modifiedCode;
      modifiedCode = modifiedCode.replace(rule.pattern, rule.replacement);
      if (modifiedCode !== originalCode) {
        rule.applied = true;
      }
    }
  }

  return modifiedCode;
}

// Feature #1144: Generate improvement notes based on applied rules
function generateImprovementNotes(rules: FeedbackRule[]): string[] {
  const notes: string[] = [];
  const appliedRules = rules.filter(r => r.applied);
  const unappliedRules = rules.filter(r => !r.applied);

  if (appliedRules.length > 0) {
    notes.push(`Applied ${appliedRules.length} feedback items to improve the test`);
  }

  for (const rule of appliedRules) {
    switch (rule.type) {
      case 'action_replace':
        notes.push(`Changed ${rule.stepAction} actions to ${rule.newAction}`);
        break;
      case 'code_replace':
        notes.push(`Replaced code patterns as requested`);
        break;
      case 'add_step':
        notes.push(`Added ${rule.stepAction} step as requested`);
        break;
      case 'remove_step':
        notes.push(`Removed ${rule.stepAction} steps as requested`);
        break;
    }
  }

  if (unappliedRules.length > 0) {
    notes.push(`${unappliedRules.length} feedback items could not be applied automatically`);
    for (const rule of unappliedRules.slice(0, 3)) {
      notes.push(`  - Could not apply: "${rule.original}"`);
    }
  }

  return notes;
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

// Convert a generated step to Playwright code line
function stepToPlaywrightCodeLine(step: GeneratedTestStep): string {
  const { action, selector, value } = step;

  switch (action) {
    case 'navigate':
      return `await page.goto('${value || ''}');`;
    case 'click':
      return selector ? `await page.locator('${selector}').click();` : `// click: specify selector`;
    case 'fill':
      return selector ? `await page.locator('${selector}').fill('${value || ''}');` : `// fill: specify selector`;
    case 'type':
      return selector ? `await page.locator('${selector}').pressSequentially('${value || ''}');` : `// type: specify selector`;
    case 'wait':
      return `await page.waitForTimeout(${value || '1000'});`;
    case 'assert_text':
      return `await expect(page.getByText('${value || ''}')).toBeVisible();`;
    case 'assert':
      return selector ? `await expect(page.locator('${selector}')).toBeVisible();` : `// assert: specify selector`;
    case 'screenshot':
      return value ? `await page.screenshot({ path: '${value}' });` : `await page.screenshot();`;
    case 'select':
      return selector ? `await page.locator('${selector}').selectOption('${value || ''}');` : `// select: specify selector`;
    case 'hover':
      return selector ? `await page.locator('${selector}').hover();` : `// hover: specify selector`;
    case 'check':
      return selector ? `await page.locator('${selector}').check();` : `// check: specify selector`;
    case 'uncheck':
      return selector ? `await page.locator('${selector}').uncheck();` : `// uncheck: specify selector`;
    default:
      return `// ${action}: ${value || ''}`;
  }
}

// Feature #1142: Estimate test duration in seconds
function estimateTestDuration(steps: GeneratedTestStep[]): number {
  let duration = 0;

  for (const step of steps) {
    switch (step.action) {
      case 'navigate':
        duration += 3; // Page load
        break;
      case 'click':
        duration += 0.5;
        break;
      case 'fill':
      case 'type':
        duration += 1;
        break;
      case 'wait':
        duration += Math.ceil(parseInt(step.value || '1000', 10) / 1000);
        break;
      case 'assert':
      case 'assert_text':
        duration += 0.5;
        break;
      case 'screenshot':
        duration += 1;
        break;
      case 'select':
        duration += 0.5;
        break;
      case 'hover':
        duration += 0.3;
        break;
      default:
        duration += 0.5;
    }
  }

  // Add buffer for network latency and browser rendering
  duration *= 1.5;

  return Math.ceil(duration);
}

// Feature #1144: AI Feedback Routes
export async function aiFeedbackRoutes(app: FastifyInstance) {
  // Feature #1144: Regenerate Test with Feedback Endpoint
  // Regenerates test incorporating user feedback
  app.post<{ Body: AIRegenerateWithFeedbackBody }>('/api/v1/ai/regenerate-with-feedback', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const {
      description,
      original_code,
      feedback,
      base_url = '',
      test_name,
      format = 'typescript',
    } = request.body;

    if (!description || description.trim().length < 10) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Description must be at least 10 characters long',
      });
    }

    if (!feedback || feedback.length === 0) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'At least one feedback item is required',
      });
    }

    console.log(`[AI REGENERATE] Regenerating with ${feedback.length} feedback items`);

    // Apply feedback rules to modify generation
    const feedbackRules = parseFeedbackToRules(feedback);

    // Parse natural language into steps
    let generatedSteps = parseNaturalLanguageToSteps(description, base_url);

    // Apply feedback rules to modify steps
    generatedSteps = applyFeedbackRulesToSteps(generatedSteps, feedbackRules);

    // Calculate confidence score
    const confidenceScore = calculateConfidenceScore(description, generatedSteps);

    // Generate test name
    const finalTestName = test_name || generateTestNameFromDescription(description);

    // Generate Playwright code with feedback applied
    let playwrightCode = generatePlaywrightCode(finalTestName, generatedSteps, base_url, format);

    // Apply direct code modifications from feedback
    playwrightCode = applyFeedbackToCode(playwrightCode, feedbackRules);

    // Generate step breakdown
    const stepBreakdown = generatedSteps.map(step => {
      const playwrightLine = stepToPlaywrightCodeLine(step);
      return {
        id: step.id,
        order: step.order,
        action: step.action,
        selector: step.selector,
        value: step.value,
        description: step.description || `${step.action} action`,
        playwright_line: playwrightLine,
        modified_by_feedback: step.modified_by_feedback || false,
      };
    });

    console.log(`[AI REGENERATE] Regenerated with ${stepBreakdown.length} steps, ${feedbackRules.length} rules applied`);

    return {
      success: true,
      preview: {
        name: finalTestName,
        description,
        steps: stepBreakdown,
        playwright_code: playwrightCode,
        confidence_score: confidenceScore + Math.min(feedback.length * 2, 10), // Boost for feedback
        estimated_duration_seconds: estimateTestDuration(generatedSteps),
      },
      feedback_applied: {
        total_feedback_items: feedback.length,
        rules_generated: feedbackRules.length,
        rules_applied: feedbackRules.filter(r => r.applied).length,
        feedback_summary: feedbackRules.map(r => ({
          original: r.original,
          type: r.type,
          applied: r.applied,
        })),
      },
      improvement_notes: generateImprovementNotes(feedbackRules),
    };
  });
}
