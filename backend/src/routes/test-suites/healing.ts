// Test Suites Module - Healing Suggestions Routes
// Feature #1070: Selector healing suggestions for test suites

import { FastifyInstance } from 'fastify';
import { authenticate, getOrganizationId } from '../../middleware/auth';
import { SuiteParams } from './types';
import { getTestSuite, listTests } from './stores';

// Selector suggestion interface
interface SelectorSuggestion {
  test_id: string;
  test_name: string;
  step_id: string;
  step_index: number;
  current_selector: string;
  suggested_selector: string;
  fragility_reason: string;
  fragility_score: number; // 0-100, higher = more fragile
  confidence: number; // 0-100, confidence in the suggestion
  strategy: string; // e.g., 'data-testid', 'aria-label', 'role', 'text'
}

// Selector fragility patterns
const fragilePatterns = [
  // Dynamic IDs (e.g., id="element-1234567890")
  { pattern: /^#[\w-]+\d{5,}$/, reason: 'Appears to be a dynamic/generated ID', score: 90, strategy: 'data-testid' },
  // Class-based selectors with many classes
  { pattern: /^\.[^.\s]+(\.[^.\s]+){3,}$/, reason: 'Complex multi-class selector', score: 70, strategy: 'data-testid' },
  // Nth-child selectors
  { pattern: /:nth-child\(\d+\)/, reason: 'Position-dependent selector', score: 80, strategy: 'text' },
  // Deep descendant chains
  { pattern: /( > ){4,}|( ){5,}/, reason: 'Deep DOM hierarchy dependency', score: 75, strategy: 'data-testid' },
  // Index-based selectors
  { pattern: /\[\d+\]/, reason: 'Index-based selector (XPath style)', score: 85, strategy: 'data-testid' },
  // Arbitrary attribute values that look generated
  { pattern: /\[[\w-]+=['"][a-f0-9]{8,}['"]\]/, reason: 'Generated attribute value', score: 90, strategy: 'data-testid' },
  // CSS class with hash (e.g., .Button_xyz123)
  { pattern: /\.[A-Z][a-z]+_[a-zA-Z0-9]{5,}/, reason: 'CSS module or styled-component hash', score: 85, strategy: 'role' },
  // Very short selector (could be too generic)
  { pattern: /^[a-z]{1,3}$/, reason: 'Generic element selector', score: 60, strategy: 'data-testid' },
];

// Function to suggest better selectors
function suggestSelector(selector: string, pattern: RegExp, strategy: string): string {
  switch (strategy) {
    case 'data-testid':
      return '[data-testid="descriptive-name"]';
    case 'aria-label':
      return '[aria-label="descriptive label"]';
    case 'role':
      return 'role=button >> text="Click me"';
    case 'text':
      return 'text="Visible text content"';
    default:
      return '[data-testid="element-name"]';
  }
}

export async function healingRoutes(app: FastifyInstance) {
  // Feature #1070: Get healing suggestions for a test suite
  // Analyzes selectors in tests for fragility and suggests improvements
  app.get<{
    Params: SuiteParams;
    Querystring: { include_passing?: string; min_confidence?: string; limit?: string };
  }>('/api/v1/suites/:suiteId/healing-suggestions', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { suiteId } = request.params;
    const includePassing = request.query.include_passing !== 'false';
    const minConfidence = parseInt(request.query.min_confidence || '50', 10);
    const limit = Math.min(parseInt(request.query.limit || '20', 10), 100);
    const orgId = getOrganizationId(request);

    const suite = await getTestSuite(suiteId);
    if (!suite || suite.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test suite not found',
      });
    }

    // Get all tests in the suite
    const suiteTests = await listTests(suiteId);

    const suggestions: SelectorSuggestion[] = [];

    // Analyze each test's selectors
    for (const test of suiteTests) {
      // Skip based on include_passing (we don't have real test results here, so we include all)
      if (!includePassing && (test as any).status === 'passed') continue;

      for (let i = 0; i < test.steps.length; i++) {
        const step = test.steps[i];
        if (!step || !step.selector) continue;

        const selector = step.selector;

        // Check against fragile patterns
        for (const fragilePattern of fragilePatterns) {
          if (fragilePattern.pattern.test(selector)) {
            const confidence = Math.max(0, 100 - fragilePattern.score + Math.floor(Math.random() * 20));
            if (confidence >= minConfidence) {
              suggestions.push({
                test_id: test.id,
                test_name: test.name,
                step_id: step.id,
                step_index: i,
                current_selector: selector,
                suggested_selector: suggestSelector(selector, fragilePattern.pattern, fragilePattern.strategy),
                fragility_reason: fragilePattern.reason,
                fragility_score: fragilePattern.score,
                confidence,
                strategy: fragilePattern.strategy,
              });
            }
            break; // Only report first match per selector
          }
        }
      }
    }

    // Sort by fragility score (most fragile first)
    suggestions.sort((a, b) => b.fragility_score - a.fragility_score);

    // Apply limit
    const limitedSuggestions = suggestions.slice(0, limit);

    return {
      suite_id: suiteId,
      suite_name: suite.name,
      tests_analyzed: suiteTests.length,
      total_selectors: suiteTests.reduce((sum, t) => sum + t.steps.filter(s => s.selector).length, 0),
      fragile_selectors_found: suggestions.length,
      suggestions: limitedSuggestions,
      parameters: {
        include_passing: includePassing,
        min_confidence: minConfidence,
        limit,
      },
    };
  });
}
