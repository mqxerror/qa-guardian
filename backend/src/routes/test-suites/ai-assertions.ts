// Test Suites Module - AI Assertion Generation Routes
// Feature #1140: AI Assertion Generation for test suites

import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth';

// Feature #1140: Interface for generated assertion
interface GeneratedAssertion {
  description: string;
  assertion_type: 'visibility' | 'text' | 'value' | 'enabled' | 'disabled' | 'count' | 'url' | 'title' | 'timeout' | 'attribute' | 'screenshot';
  playwright_code: string;
  explanation: string;
  confidence: number; // 0-100
  alternatives?: string[]; // Alternative assertion approaches
}

interface AIGenerateAssertionsBody {
  expected_outcomes: string[]; // Array of expected outcome descriptions
  context?: {
    page_url?: string;
    element_context?: string; // What element we're testing
    previous_action?: string; // What action preceded this assertion
  };
  include_soft_assertions?: boolean; // Include expect.soft() versions
  include_wait_variants?: boolean; // Include waitFor versions
}

// Feature #1140: Infer element role from description
function inferRoleFromDescription(desc: string): string {
  const lowerDesc = desc.toLowerCase();
  if (lowerDesc.includes('button')) return 'button';
  if (lowerDesc.includes('link')) return 'link';
  if (lowerDesc.includes('heading') || lowerDesc.includes('title')) return 'heading';
  if (lowerDesc.includes('input') || lowerDesc.includes('field') || lowerDesc.includes('textbox')) return 'textbox';
  if (lowerDesc.includes('checkbox')) return 'checkbox';
  if (lowerDesc.includes('radio')) return 'radio';
  if (lowerDesc.includes('select') || lowerDesc.includes('dropdown')) return 'combobox';
  if (lowerDesc.includes('menu')) return 'menu';
  if (lowerDesc.includes('dialog') || lowerDesc.includes('modal')) return 'dialog';
  if (lowerDesc.includes('tab')) return 'tab';
  if (lowerDesc.includes('list')) return 'list';
  if (lowerDesc.includes('table')) return 'table';
  if (lowerDesc.includes('image') || lowerDesc.includes('img')) return 'img';
  return 'generic'; // Fallback
}

// Feature #1140: Generate assertion from natural language outcome
function generateAssertionFromOutcome(
  outcome: string,
  context?: { page_url?: string; element_context?: string; previous_action?: string },
  includeSoft = false,
  includeWait = true
): GeneratedAssertion | null {
  const desc = outcome.toLowerCase().trim();
  let assertionType: GeneratedAssertion['assertion_type'] = 'visibility';
  let playwrightCode = '';
  let explanation = '';
  let confidence = 70;
  const alternatives: string[] = [];

  // Pattern: User/element sees/shows/displays text or message
  const seesTextMatch = desc.match(/(?:user\s+)?(?:sees?|shows?|displays?|appears?|view)\s+(?:a?\s*)?(?:the\s+)?['"]?([^'"]+?)['"]?\s*(?:message|text|notification|alert|toast|banner)?/i);
  if (seesTextMatch && seesTextMatch[1]) {
    const textContent = seesTextMatch[1].trim();
    assertionType = 'visibility';

    // Check if it's a success/error/warning message
    if (textContent.match(/success|complete|saved|created|updated|deleted|submitted/i)) {
      playwrightCode = `await expect(page.locator('[role="alert"], [data-testid="success-message"], .success-message, .toast-success')).toContainText('${textContent}');`;
      explanation = `Asserts that a success message containing "${textContent}" is visible`;
      confidence = 85;
      alternatives.push(`await expect(page.getByText('${textContent}')).toBeVisible();`);
    } else if (textContent.match(/error|fail|invalid|wrong|incorrect/i)) {
      playwrightCode = `await expect(page.locator('[role="alert"], [data-testid="error-message"], .error-message, .toast-error')).toContainText('${textContent}');`;
      explanation = `Asserts that an error message containing "${textContent}" is visible`;
      confidence = 85;
      alternatives.push(`await expect(page.getByRole('alert')).toContainText('${textContent}');`);
    } else {
      playwrightCode = `await expect(page.getByText('${textContent}')).toBeVisible();`;
      explanation = `Asserts that text "${textContent}" is visible on the page`;
      confidence = 80;
      alternatives.push(`await expect(page.locator('text="${textContent}"')).toBeVisible();`);
    }
  }

  // Pattern: Page/form loads within X seconds
  const loadsWithinMatch = desc.match(/(?:page|form|element|content|data)\s+loads?\s+(?:within|in|under)\s+(\d+)\s*(?:seconds?|sec|s|milliseconds?|ms)?/i);
  if (loadsWithinMatch && loadsWithinMatch[1]) {
    const timeValue = parseInt(loadsWithinMatch[1], 10);
    const timeMs = desc.includes('ms') || desc.includes('millisecond') ? timeValue : timeValue * 1000;
    assertionType = 'timeout';
    playwrightCode = `await expect(page.locator('[data-testid="content"], main, .content')).toBeVisible({ timeout: ${timeMs} });`;
    explanation = `Asserts that content loads within ${timeMs}ms`;
    confidence = 75;
    alternatives.push(`await page.waitForLoadState('domcontentloaded', { timeout: ${timeMs} });`);
    alternatives.push(`await expect(page).toHaveURL(/.+/, { timeout: ${timeMs} });`);
  }

  // Pattern: Element is visible/present/displayed
  const visibleMatch = desc.match(/(?:the\s+)?['"]?([^'"]+?)['"]?\s+(?:element\s+)?(?:is\s+)?(?:visible|present|displayed|shown|appears)/i);
  if (visibleMatch && visibleMatch[1] && !seesTextMatch) {
    const elementDesc = visibleMatch[1].trim();
    assertionType = 'visibility';
    playwrightCode = `await expect(page.getByRole('${inferRoleFromDescription(elementDesc)}', { name: '${elementDesc}' })).toBeVisible();`;
    explanation = `Asserts that "${elementDesc}" element is visible`;
    confidence = 75;
    alternatives.push(`await expect(page.getByText('${elementDesc}')).toBeVisible();`);
    alternatives.push(`await expect(page.locator('[data-testid="${elementDesc.toLowerCase().replace(/\s+/g, '-')}"]')).toBeVisible();`);
  }

  // Pattern: Element is hidden/not visible/disappears
  const hiddenMatch = desc.match(/(?:the\s+)?['"]?([^'"]+?)['"]?\s+(?:element\s+)?(?:is\s+)?(?:hidden|not\s+visible|disappears?|removed|gone)/i);
  if (hiddenMatch && hiddenMatch[1]) {
    const elementDesc = hiddenMatch[1].trim();
    assertionType = 'visibility';
    playwrightCode = `await expect(page.getByText('${elementDesc}')).toBeHidden();`;
    explanation = `Asserts that "${elementDesc}" is no longer visible`;
    confidence = 80;
    alternatives.push(`await expect(page.getByText('${elementDesc}')).not.toBeVisible();`);
    alternatives.push(`await expect(page.locator('text="${elementDesc}"')).toHaveCount(0);`);
  }

  // Pattern: Input/field contains/has value
  const hasValueMatch = desc.match(/(?:the\s+)?['"]?([^'"]+?)['"]?\s+(?:field|input|textbox)\s+(?:contains?|has|shows?)\s+(?:value\s+)?['"]?([^'"]+?)['"]?/i);
  if (hasValueMatch && hasValueMatch[1] && hasValueMatch[2]) {
    const fieldName = hasValueMatch[1].trim();
    const value = hasValueMatch[2].trim();
    assertionType = 'value';
    playwrightCode = `await expect(page.locator('[name="${fieldName}"], [data-testid="${fieldName}-input"]')).toHaveValue('${value}');`;
    explanation = `Asserts that the "${fieldName}" field contains value "${value}"`;
    confidence = 85;
    alternatives.push(`await expect(page.getByRole('textbox', { name: '${fieldName}' })).toHaveValue('${value}');`);
  }

  // Pattern: Button/element is enabled/disabled
  const enabledMatch = desc.match(/(?:the\s+)?['"]?([^'"]+?)['"]?\s+(?:button|element)\s+(?:is\s+)?(enabled|disabled)/i);
  if (enabledMatch && enabledMatch[1] && enabledMatch[2]) {
    const buttonName = enabledMatch[1].trim();
    const state = enabledMatch[2].toLowerCase();
    assertionType = state === 'enabled' ? 'enabled' : 'disabled';
    playwrightCode = `await expect(page.getByRole('button', { name: '${buttonName}' })).toBe${state.charAt(0).toUpperCase() + state.slice(1)}();`;
    explanation = `Asserts that the "${buttonName}" button is ${state}`;
    confidence = 90;
  }

  // Pattern: URL contains/matches/is
  const urlMatch = desc.match(/(?:page\s+)?url\s+(?:contains?|matches?|is|equals?|includes?)\s+['"]?([^'"]+?)['"]?/i);
  if (urlMatch && urlMatch[1]) {
    const urlPart = urlMatch[1].trim();
    assertionType = 'url';
    if (urlPart.startsWith('http')) {
      playwrightCode = `await expect(page).toHaveURL('${urlPart}');`;
      explanation = `Asserts that the page URL exactly matches "${urlPart}"`;
    } else {
      playwrightCode = `await expect(page).toHaveURL(/${urlPart}/);`;
      explanation = `Asserts that the page URL contains "${urlPart}"`;
    }
    confidence = 90;
    alternatives.push(`await expect(page.url()).toContain('${urlPart}');`);
  }

  // Pattern: Page title contains/is
  const titleMatch = desc.match(/(?:page\s+)?title\s+(?:contains?|matches?|is|equals?|includes?)\s+['"]?([^'"]+?)['"]?/i);
  if (titleMatch && titleMatch[1]) {
    const titleText = titleMatch[1].trim();
    assertionType = 'title';
    playwrightCode = `await expect(page).toHaveTitle(/${titleText}/i);`;
    explanation = `Asserts that the page title contains "${titleText}"`;
    confidence = 90;
    alternatives.push(`await expect(page).toHaveTitle('${titleText}');`);
  }

  // Pattern: N items/elements exist/are shown
  const countMatch = desc.match(/(\d+)\s+(?:items?|elements?|rows?|cards?|results?)\s+(?:are\s+)?(?:shown|displayed|visible|exist|present)/i);
  if (countMatch && countMatch[1]) {
    const count = parseInt(countMatch[1], 10);
    assertionType = 'count';
    playwrightCode = `await expect(page.locator('[data-testid="list-item"], .list-item, tr, .card')).toHaveCount(${count});`;
    explanation = `Asserts that exactly ${count} items are visible`;
    confidence = 70;
    alternatives.push(`await expect(page.getByRole('listitem')).toHaveCount(${count});`);
    alternatives.push(`await expect(page.locator('.result-item')).toHaveCount(${count});`);
  }

  // Pattern: Element has attribute/class
  const attrMatch = desc.match(/(?:the\s+)?['"]?([^'"]+?)['"]?\s+(?:element\s+)?has\s+(?:attribute\s+)?['"]?([^'"=]+?)['"]?\s*(?:=|equals?|of|:)\s*['"]?([^'"]+?)['"]?/i);
  if (attrMatch && attrMatch[1] && attrMatch[2] && attrMatch[3]) {
    const elementDesc = attrMatch[1].trim();
    const attrName = attrMatch[2].trim();
    const attrValue = attrMatch[3].trim();
    assertionType = 'attribute';
    playwrightCode = `await expect(page.getByText('${elementDesc}')).toHaveAttribute('${attrName}', '${attrValue}');`;
    explanation = `Asserts that "${elementDesc}" has ${attrName}="${attrValue}"`;
    confidence = 80;
  }

  // Pattern: Screenshot comparison / Visual match
  if (desc.match(/(?:screenshot|visual|looks?\s+like|matches?\s+(?:the\s+)?(?:baseline|snapshot|design))/i)) {
    assertionType = 'screenshot';
    playwrightCode = `await expect(page).toHaveScreenshot('expected-screenshot.png');`;
    explanation = 'Performs visual regression comparison against baseline screenshot';
    confidence = 85;
    alternatives.push(`await expect(page.locator('main')).toHaveScreenshot('content-screenshot.png');`);
  }

  // If no pattern matched, create a generic visibility assertion
  if (!playwrightCode) {
    // Try to extract any quoted text as the target
    const quotedMatch = desc.match(/['"]([^'"]+)['"]/);
    if (quotedMatch && quotedMatch[1]) {
      assertionType = 'visibility';
      playwrightCode = `await expect(page.getByText('${quotedMatch[1]}')).toBeVisible();`;
      explanation = `Asserts that "${quotedMatch[1]}" is visible (generic pattern)`;
      confidence = 50;
    } else {
      // Last resort - create assertion from the whole description
      assertionType = 'visibility';
      const cleanDesc = desc.replace(/[^a-zA-Z0-9\s]/g, '').substring(0, 50);
      playwrightCode = `// TODO: Manual assertion needed for: ${outcome}\nawait expect(page.locator('[data-testid="TODO"]')).toBeVisible();`;
      explanation = `Could not parse expected outcome - manual implementation needed`;
      confidence = 20;
    }
  }

  // Add soft assertion variant if requested
  if (includeSoft && !playwrightCode.includes('TODO')) {
    const softCode = playwrightCode.replace('await expect(', 'await expect.soft(');
    alternatives.push(softCode);
  }

  // Add waitFor variant if requested
  if (includeWait && !playwrightCode.includes('TODO') && !playwrightCode.includes('toHaveURL') && !playwrightCode.includes('toHaveTitle')) {
    const waitCode = playwrightCode.replace('await expect(page', 'await expect.poll(async () => page');
    if (waitCode !== playwrightCode) {
      alternatives.push(waitCode + ' // poll version for dynamic content');
    }
  }

  return {
    description: outcome,
    assertion_type: assertionType,
    playwright_code: playwrightCode,
    explanation,
    confidence,
    alternatives: alternatives.length > 0 ? alternatives.slice(0, 3) : undefined,
  };
}

// Export the routes plugin
export async function aiAssertionsRoutes(app: FastifyInstance): Promise<void> {
  // Feature #1140: AI Assertion Generation Endpoint
  // Generates Playwright assertions from natural language descriptions
  app.post<{ Body: AIGenerateAssertionsBody }>('/api/v1/ai/generate-assertions', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { expected_outcomes, context, include_soft_assertions = false, include_wait_variants = true } = request.body;

    if (!expected_outcomes || expected_outcomes.length === 0) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'At least one expected outcome must be provided',
      });
    }

    console.log(`[AI ASSERTION GENERATION] Generating assertions for ${expected_outcomes.length} outcomes`);

    const assertions: GeneratedAssertion[] = [];

    for (const outcome of expected_outcomes) {
      const assertion = generateAssertionFromOutcome(outcome, context, include_soft_assertions, include_wait_variants);
      if (assertion) {
        assertions.push(assertion);
      }
    }

    console.log(`[AI ASSERTION GENERATION] Generated ${assertions.length} assertions`);

    return {
      success: true,
      assertions,
      total_generated: assertions.length,
      context_used: context || null,
      tips: [
        'Use toBeVisible() for UI element presence checks',
        'Use toHaveText() for exact text matching, toContainText() for partial',
        'Use toBeEnabled()/toBeDisabled() for form elements',
        'Use toHaveURL() and toHaveTitle() for navigation assertions',
        'Wrap time-sensitive assertions with expect.poll() or waitFor',
      ],
    };
  });
}
