/**
 * AI Test Generation Routes - Test Generation
 *
 * Endpoints for generating Playwright tests from various inputs:
 * - Natural language descriptions
 * - User stories (suite generation)
 * - Gherkin scenarios
 * - Test validation
 *
 * Feature #1375: Extracted from github.ts for modularity
 * Feature #1500: Updated to use REAL AI via MCP handlers
 * Feature #244: Types and utilities in separate modules
 */

import { FastifyInstance } from 'fastify';
import { authenticate } from '../../../middleware/auth.js';
import { AITestGenerationService } from '../../../services/ai-test-generation-service.js';

import type {
  NLTestGenerationRequest,
  UserStoryTestSuiteRequest,
  GherkinToPlaywrightRequest,
  GherkinStep,
} from '../ai-test-gen-types.js';

import {
  validatePlaywrightSyntax,
  extractSelectors,
  extractAssertions,
  estimateComplexity,
  generatePlaywrightTest,
} from '../ai-test-gen-utils.js';
import { createLogger } from '../../../services/logger.js';
import { sendError } from '../../../utils/errors.js';

const logger = createLogger('ai-test-generation:generation');

export async function generationRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/v1/ai/generate-playwright-test - Generate Playwright test from natural language
  // Feature #1500: Now uses REAL AI via MCP handlers
  app.post<{ Body: NLTestGenerationRequest }>('/api/v1/ai/generate-playwright-test', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { description, base_url, test_type, include_assertions, include_screenshot } = request.body;

    if (!description || description.trim().length < 10) {
      return sendError(reply, 400, 'BAD_REQUEST', 'Please provide a more detailed description of the test you want to generate.');
    }

    if (description.length > 2000) {
      return sendError(reply, 400, 'BAD_REQUEST', 'Description must be less than 2000 characters.');
    }

    try {
      // Use REAL AI via the service layer (Feature #1500)
      const aiService = new AITestGenerationService();
      const result = await aiService.generateTest({
        description: description.trim(),
        target_url: base_url,
        test_type: test_type || 'e2e',
        include_assertions: include_assertions !== false,
        include_screenshot: include_screenshot === true,
        use_real_ai: true,
      });

      // Type assertion for the result
      const aiResult = result as {
        success: boolean;
        generated_code?: string;
        test_name?: string;
        test_steps?: string[];
        confidence_score?: number;
        ai_metadata?: {
          provider?: string;
          model?: string;
          tokens_used?: { input: number; output: number };
          used_real_ai?: boolean;
        };
        selectors?: string[];
        assertions?: string[];
        syntax_valid?: boolean;
        complexity?: string;
        error?: string;
      };

      if (!aiResult.success) {
        // Fall back to template generation if AI fails
        logger.warn({ error: aiResult.error }, 'Real AI failed, falling back to template');
        const generatedTest = generatePlaywrightTest(
          description.trim(), base_url, test_type || 'e2e',
          include_assertions !== false, include_screenshot === true
        );

        return reply.send({
          success: true,
          test: generatedTest,
          metadata: {
            generated_at: new Date().toISOString(),
            model: 'template-fallback',
            used_real_ai: false,
            fallback_reason: aiResult.error,
            prompt_tokens: Math.ceil(description.length / 4),
            completion_tokens: Math.ceil(generatedTest.code.length / 4),
          },
        });
      }

      // Return real AI result
      return reply.send({
        success: true,
        test: {
          code: aiResult.generated_code || '',
          test_name: aiResult.test_name || 'Generated Test',
          description: description.trim(),
          steps: aiResult.test_steps || [],
          selectors: aiResult.selectors || [],
          assertions: aiResult.assertions || [],
          syntax_valid: aiResult.syntax_valid ?? true,
          estimated_duration_ms: aiResult.complexity === 'simple' ? 5000 : aiResult.complexity === 'medium' ? 15000 : 30000,
          complexity: aiResult.complexity || 'medium',
          confidence_score: aiResult.confidence_score,
        },
        metadata: {
          generated_at: new Date().toISOString(),
          model: aiResult.ai_metadata?.model || 'claude-sonnet-4',
          provider: aiResult.ai_metadata?.provider || 'unknown',
          used_real_ai: aiResult.ai_metadata?.used_real_ai ?? true,
          prompt_tokens: aiResult.ai_metadata?.tokens_used?.input || 0,
          completion_tokens: aiResult.ai_metadata?.tokens_used?.output || 0,
          confidence_score: aiResult.confidence_score,
        },
      });
    } catch (error) {
      logger.error({ err: error }, 'Error generating test');

      // Final fallback to template on error
      try {
        const generatedTest = generatePlaywrightTest(
          description.trim(), base_url, test_type || 'e2e',
          include_assertions !== false, include_screenshot === true
        );

        return reply.send({
          success: true,
          test: generatedTest,
          metadata: {
            generated_at: new Date().toISOString(),
            model: 'template-fallback',
            used_real_ai: false,
            fallback_reason: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      } catch (fallbackError) {
        return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to generate test. Please try again.');
      }
    }
  });

  // POST /api/v1/ai/generate-test-suite - Generate test suite from user story
  // Feature #1500: Now uses REAL AI via MCP handlers
  app.post<{ Body: UserStoryTestSuiteRequest }>('/api/v1/ai/generate-test-suite', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { user_story, base_url, include_edge_cases = true, test_type = 'e2e' } = request.body;

    if (!user_story || user_story.trim().length < 10) {
      return sendError(reply, 400, 'BAD_REQUEST', 'Please provide a user story with at least 10 characters.');
    }

    if (user_story.length > 1000) {
      return sendError(reply, 400, 'BAD_REQUEST', 'User story must be less than 1000 characters.');
    }

    try {
      // Use REAL AI via the service layer (Feature #1500)
      const aiService = new AITestGenerationService();
      const result = await aiService.generateTestSuite({
        user_story: user_story.trim(),
        target_url: base_url,
        include_edge_cases,
        include_negative_tests: true,
        max_tests: 10,
        use_real_ai: true,
      });

      const aiResult = result as {
        success: boolean;
        suite_name?: string;
        suite_description?: string;
        tests?: Array<{ name: string; type: string; description: string; steps: string[]; priority: string; generated_code?: string }>;
        test_summary?: { positive: number; negative: number; edge_case: number };
        confidence_score?: number;
        ai_metadata?: {
          provider?: string;
          model?: string;
          tokens_used?: { input: number; output: number };
          used_real_ai?: boolean;
        };
        error?: string;
      };

      if (!aiResult.success) {
        // Fall back to template generation
        logger.warn({ error: aiResult.error }, 'Real AI failed for suite, falling back to template');
        const entityMatch = user_story.match(/(?:create|edit|delete|view|manage)\s+(?:a\s+)?(\w+)/i);
        const entity = entityMatch ? entityMatch[1].replace(/s$/, '') : 'item';
        const coreTests = [generatePlaywrightTest(`Create a new ${entity}`, base_url, test_type)];
        const edgeCaseTests = include_edge_cases ? [generatePlaywrightTest(`Create ${entity} with empty fields`, base_url, test_type)] : [];
        const suiteName = user_story.replace(/^as a \w+,?\s*/i, '').replace(/i (can|should|want to)\s*/i, '')
          .replace(/[^a-zA-Z0-9\s]/g, '').trim().split(' ').slice(0, 4)
          .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('') + 'Suite';

        return reply.send({
          success: true,
          suite: { suite_name: suiteName, user_story, tests: coreTests, edge_case_tests: edgeCaseTests, total_tests: coreTests.length + edgeCaseTests.length, estimated_total_duration_ms: 20000, generated_at: new Date().toISOString() },
          metadata: { model: 'template-fallback', used_real_ai: false, fallback_reason: aiResult.error },
        });
      }

      // Map AI tests to expected format
      const tests = (aiResult.tests || []).filter(t => t.type === 'positive').map(t => ({
        code: t.generated_code || `// Test: ${t.name}`,
        test_name: t.name,
        description: t.description,
        steps: t.steps,
        selectors: [],
        assertions: [],
        syntax_valid: true,
        estimated_duration_ms: 10000,
        complexity: 'medium' as const,
      }));

      const edgeCaseTests = (aiResult.tests || []).filter(t => t.type === 'edge_case' || t.type === 'negative').map(t => ({
        code: t.generated_code || `// Test: ${t.name}`,
        test_name: t.name,
        description: t.description,
        steps: t.steps,
        selectors: [],
        assertions: [],
        syntax_valid: true,
        estimated_duration_ms: 10000,
        complexity: 'medium' as const,
      }));

      return reply.send({
        success: true,
        suite: {
          suite_name: aiResult.suite_name || 'Generated Suite',
          user_story,
          tests,
          edge_case_tests: edgeCaseTests,
          total_tests: tests.length + edgeCaseTests.length,
          estimated_total_duration_ms: (tests.length + edgeCaseTests.length) * 10000,
          generated_at: new Date().toISOString(),
        },
        metadata: {
          model: aiResult.ai_metadata?.model || 'claude-sonnet-4',
          provider: aiResult.ai_metadata?.provider,
          used_real_ai: aiResult.ai_metadata?.used_real_ai ?? true,
          core_tests_count: tests.length,
          edge_case_tests_count: edgeCaseTests.length,
          confidence_score: aiResult.confidence_score,
        },
      });
    } catch (error) {
      logger.error({ err: error }, 'Error generating test suite');
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to generate test suite. Please try again.');
    }
  });

  // POST /api/v1/ai/gherkin-to-playwright - Convert Gherkin to Playwright
  // Feature #1500: Now uses REAL AI via MCP handlers
  app.post<{ Body: GherkinToPlaywrightRequest }>('/api/v1/ai/gherkin-to-playwright', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { gherkin, base_url, feature_name } = request.body;

    if (!gherkin || gherkin.trim().length < 10) {
      return sendError(reply, 400, 'BAD_REQUEST', 'Please provide a valid Gherkin scenario with at least 10 characters.');
    }

    if (!/\b(given|when|then|and|but)\b/i.test(gherkin)) {
      return sendError(reply, 400, 'BAD_REQUEST', 'Gherkin scenario must contain Given/When/Then keywords.');
    }

    try {
      // Use REAL AI via the service layer (Feature #1500)
      const aiService = new AITestGenerationService();
      const result = await aiService.convertGherkin({
        gherkin: gherkin.trim(),
        target_url: base_url,
        feature_name,
        use_real_ai: true,
      });

      const aiResult = result as {
        success: boolean;
        feature_name?: string;
        scenario_name?: string;
        generated_code?: string;
        steps?: { given: string[]; when: string[]; then: string[]; background?: string[] };
        scenario_type?: string;
        complexity?: string;
        ai_metadata?: {
          provider?: string;
          model?: string;
          used_real_ai?: boolean;
        };
        error?: string;
      };

      if (!aiResult.success) {
        // Fall back to simple rule-based conversion
        logger.warn({ error: aiResult.error }, 'Real AI failed for Gherkin, falling back to rule-based');
        const lines = gherkin.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        let feature = feature_name || 'Test Feature';
        let scenario = 'Test Scenario';
        const steps: GherkinStep[] = [];

        for (const line of lines) {
          if (line.toLowerCase().startsWith('feature:')) feature = line.substring(8).trim();
          else if (line.toLowerCase().startsWith('scenario:')) scenario = line.substring(9).trim();
          else if (/^(given|when|then|and|but)\s+/i.test(line)) {
            const match = line.match(/^(given|when|then|and|but)\s+(.+)/i);
            if (match) {
              steps.push({
                keyword: match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase() as GherkinStep['keyword'],
                text: match[2].trim(),
                action: match[2].trim(),
                playwright_code: `  // ${match[1]}: ${match[2]}\n  await page.waitForTimeout(1000);`,
              });
            }
          }
        }

        const testName = scenario.replace(/[^a-zA-Z0-9\s]/g, '').split(' ')
          .map((word, i) => i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join('');

        const code = `import { test, expect } from '@playwright/test';

test.describe('${feature}', () => {
  test('${scenario}', async ({ page }) => {
    await page.goto('${base_url || 'https://example.com'}');
${steps.map(s => s.playwright_code).join('\n\n')}
  });
});
`;

        return reply.send({
          success: true,
          test: { code, test_name: testName, feature_name: feature, scenario_name: scenario, steps, syntax_valid: true, complexity: steps.length <= 3 ? 'simple' : steps.length <= 6 ? 'medium' : 'complex' },
          metadata: { converted_at: new Date().toISOString(), model: 'rule-based-fallback', used_real_ai: false, steps_count: steps.length },
        });
      }

      // Convert AI steps to expected format
      const allSteps: GherkinStep[] = [];
      if (aiResult.steps?.given) {
        aiResult.steps.given.forEach(s => allSteps.push({ keyword: 'Given', text: s, action: s, playwright_code: `  // Given: ${s}` }));
      }
      if (aiResult.steps?.when) {
        aiResult.steps.when.forEach(s => allSteps.push({ keyword: 'When', text: s, action: s, playwright_code: `  // When: ${s}` }));
      }
      if (aiResult.steps?.then) {
        aiResult.steps.then.forEach(s => allSteps.push({ keyword: 'Then', text: s, action: s, playwright_code: `  // Then: ${s}` }));
      }

      return reply.send({
        success: true,
        test: {
          code: aiResult.generated_code || '',
          test_name: (aiResult.scenario_name || 'Test').replace(/[^a-zA-Z0-9\s]/g, '').split(' ').map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(''),
          feature_name: aiResult.feature_name || feature_name || 'Test Feature',
          scenario_name: aiResult.scenario_name || 'Test Scenario',
          steps: allSteps,
          syntax_valid: true,
          complexity: aiResult.complexity || 'medium',
        },
        metadata: {
          converted_at: new Date().toISOString(),
          model: aiResult.ai_metadata?.model || 'claude-sonnet-4',
          provider: aiResult.ai_metadata?.provider,
          used_real_ai: aiResult.ai_metadata?.used_real_ai ?? true,
          steps_count: allSteps.length,
        },
      });
    } catch (error) {
      logger.error({ err: error }, 'Error converting Gherkin');
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to convert Gherkin scenario. Please try again.');
    }
  });

  // POST /api/v1/ai/validate-test - Validate Playwright test code syntax
  app.post<{ Body: { code: string } }>('/api/v1/ai/validate-test', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { code } = request.body;
    if (!code) return sendError(reply, 400, 'BAD_REQUEST', 'Code is required');

    const validation = validatePlaywrightSyntax(code);
    return reply.send({
      valid: validation.valid, errors: validation.errors,
      analysis: {
        selectors: extractSelectors(code), assertions: extractAssertions(code),
        complexity: estimateComplexity(code), line_count: code.split('\n').filter(l => l.trim()).length,
      },
    });
  });
}
