/**
 * AI Test Generation Routes - Screenshot Analysis
 *
 * Endpoints for generating tests from screenshots:
 * - Analyze screenshots to detect UI elements and generate test steps
 * - Generate tests from annotated screenshots with user-defined markers
 *
 * Feature #1500: Uses REAL Claude Vision API via MCP handlers
 */

import { FastifyInstance } from 'fastify';
import { authenticate } from '../../../middleware/auth.js';
import { AITestGenerationService } from '../../../services/ai-test-generation-service.js';

import type {
  ScreenshotToTestRequest,
  AnnotatedScreenshotRequest,
} from '../ai-test-gen-types.js';

import { createLogger } from '../../../services/logger.js';
import { sendError } from '../../../utils/errors.js';

const logger = createLogger('ai-test-generation:screenshot');

export async function screenshotAnalysisRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/v1/ai/screenshot-to-test - Analyze screenshot to generate test steps
  // Feature #1500: Now uses REAL Claude Vision API via MCP handlers
  app.post<{ Body: ScreenshotToTestRequest }>('/api/v1/ai/screenshot-to-test', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { image_data, image_type = 'png', base_url, context } = request.body;

    if (!image_data) {
      return sendError(reply, 400, 'BAD_REQUEST', 'Please upload a screenshot to analyze.');
    }

    if (!image_data.match(/^[A-Za-z0-9+/=]+$/)) {
      return sendError(reply, 400, 'BAD_REQUEST', 'Image data must be valid base64 encoded.');
    }

    try {
      // Use REAL Claude Vision API via the service layer (Feature #1500)
      const aiService = new AITestGenerationService();
      const result = await aiService.analyzeScreenshot({
        image_base64: image_data,
        media_type: `image/${image_type}`,
        target_url: base_url,
        focus_area: 'all',
        include_positions: true,
        max_elements: 50,
        generate_code: true,
      });

      const aiResult = result as {
        success: boolean;
        page_type?: string;
        page_description?: string;
        elements?: Array<{
          type: string;
          label?: string;
          position?: { x: number; y: number; width: number; height: number };
          selectors?: { getByRole?: string; getByLabel?: string; getByText?: string; getByTestId?: string; css?: string };
          interactive?: boolean;
          confidence?: number;
          suggested_action?: string;
        }>;
        suggested_test_flow?: string[];
        accessibility_issues?: string[];
        overall_confidence?: number;
        code_snippets?: Record<string, string>;
        element_summary?: { buttons: number; links: number; inputs: number; forms: number; other: number };
        ai_metadata?: {
          provider?: string;
          model?: string;
          vision_used?: boolean;
          tokens_used?: { input: number; output: number };
        };
        error?: string;
      };

      if (!aiResult.success) {
        // Fall back to basic response if Vision AI fails
        logger.warn({ error: aiResult.error }, 'Real Vision AI failed, returning placeholder');
        const pageType = context?.toLowerCase().includes('login') ? 'login' : 'other';
        const testName = context ? context.split(' ').slice(0, 5).join(' ').replace(/[^a-zA-Z0-9\s]/g, '') : 'Screenshot Test';

        return reply.send({
          success: true,
          analysis: {
            elements: [],
            suggested_test_steps: [{ step_number: 1, action: 'navigate', element_id: '', description: 'Navigate to page', playwright_code: `await page.goto('${base_url || 'https://example.com'}');` }],
            page_context: { page_type: pageType, main_functionality: 'Unable to analyze - Vision AI unavailable', responsive_design: true },
            generated_test: { name: testName, code: `test('${testName}', async ({ page }) => {\n  await page.goto('${base_url || 'https://example.com'}');\n  // Vision AI was unavailable - add your test steps manually\n});`, complexity: 'simple' },
          },
          metadata: { analyzed_at: new Date().toISOString(), model: 'fallback', used_real_ai: false, vision_used: false, fallback_reason: aiResult.error, image_type },
        });
      }

      // Map AI elements to expected format
      const elements = (aiResult.elements || []).map((elem, idx) => ({
        id: `elem_${idx + 1}`,
        type: elem.type,
        description: elem.label || `${elem.type} element`,
        suggested_selector: elem.selectors?.getByRole || elem.selectors?.getByLabel || elem.selectors?.getByText || elem.selectors?.css || `[data-testid="${elem.type}-${idx}"]`,
        suggested_action: elem.suggested_action || (elem.type === 'button' || elem.type === 'link' ? 'click' : elem.type === 'input' ? 'fill' : 'none'),
        confidence: elem.confidence || 0.8,
        location: elem.position || { x: 0, y: 0, width: 100, height: 40 },
        selectors: elem.selectors,
      }));

      // Generate test steps from suggested flow
      const testSteps = (aiResult.suggested_test_flow || []).map((step, idx) => ({
        step_number: idx + 1,
        action: step.toLowerCase().includes('click') ? 'click' : step.toLowerCase().includes('fill') || step.toLowerCase().includes('enter') ? 'fill' : step.toLowerCase().includes('verify') || step.toLowerCase().includes('expect') ? 'assert' : 'navigate',
        element_id: '',
        description: step,
        playwright_code: `  // Step ${idx + 1}: ${step}`,
      }));

      // Generate test code from elements
      const testName = context ? context.split(' ').slice(0, 5).join(' ').replace(/[^a-zA-Z0-9\s]/g, '') : 'Screenshot Test';
      const testCode = `import { test, expect } from '@playwright/test';

/**
 * Test generated from screenshot analysis using Claude Vision
 * Page type: ${aiResult.page_type || 'unknown'}
 * Elements detected: ${elements.length}
 */
test('${testName}', async ({ page }) => {
  await page.goto('${base_url || 'https://example.com'}');

${elements.filter(e => e.suggested_action !== 'none').slice(0, 10).map(e => {
  const selector = e.selectors?.getByRole || e.selectors?.getByLabel || `'${e.suggested_selector}'`;
  if (e.suggested_action === 'click') {
    return `  // Click ${e.description}\n  await page.locator(${selector}).click();`;
  } else if (e.suggested_action === 'fill') {
    return `  // Fill ${e.description}\n  await page.locator(${selector}).fill('test value');`;
  }
  return `  // Interact with ${e.description}`;
}).join('\n\n')}
});
`;

      return reply.send({
        success: true,
        analysis: {
          elements,
          suggested_test_steps: testSteps.length > 0 ? testSteps : [{ step_number: 1, action: 'navigate', element_id: '', description: 'Navigate to page', playwright_code: `await page.goto('${base_url || 'https://example.com'}');` }],
          page_context: {
            page_type: aiResult.page_type || 'other',
            main_functionality: aiResult.page_description || 'Page functionality',
            responsive_design: true,
            element_summary: aiResult.element_summary,
            accessibility_issues: aiResult.accessibility_issues,
          },
          generated_test: {
            name: testName,
            code: testCode,
            complexity: elements.length <= 5 ? 'simple' : elements.length <= 15 ? 'medium' : 'complex',
          },
        },
        metadata: {
          analyzed_at: new Date().toISOString(),
          model: aiResult.ai_metadata?.model || 'claude-sonnet-4-vision',
          provider: aiResult.ai_metadata?.provider || 'anthropic',
          used_real_ai: true,
          vision_used: aiResult.ai_metadata?.vision_used ?? true,
          elements_detected: elements.length,
          overall_confidence: aiResult.overall_confidence,
          image_type,
        },
      });
    } catch (error) {
      logger.error({ err: error }, 'Error analyzing screenshot');
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to analyze screenshot. Please try again.');
    }
  });

  // POST /api/v1/ai/annotated-screenshot-to-test - Generate test from annotated screenshot
  // Feature #1500: Now uses REAL Claude Vision API via MCP handlers
  app.post<{ Body: AnnotatedScreenshotRequest }>('/api/v1/ai/annotated-screenshot-to-test', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { image_data, image_type = 'png', base_url, context, annotations } = request.body;

    if (!image_data) {
      return sendError(reply, 400, 'BAD_REQUEST', 'Please upload a screenshot to analyze.');
    }

    if (!annotations || annotations.length === 0) {
      return sendError(reply, 400, 'BAD_REQUEST', 'Please add at least one annotation to the screenshot.');
    }

    try {
      // Use REAL Claude Vision API via the service layer (Feature #1500)
      const aiService = new AITestGenerationService();

      // Convert annotations to MCP format
      const mcpAnnotations = annotations.map((ann, idx) => ({
        marker_id: String(idx + 1),
        action: ann.type === 'type' ? 'fill' : ann.type === 'expect' ? 'verify' : ann.type,
        value: ann.type === 'type' ? ann.label : ann.expectation,
        description: ann.type === 'click' ? 'Click element' : ann.type === 'type' ? `Type "${ann.label}"` : `Verify: ${ann.expectation}`,
      }));

      const result = await aiService.generateTestFromAnnotatedScreenshot({
        image_base64: image_data,
        annotations: mcpAnnotations as Array<{ marker_id: string; action: 'click' | 'fill' | 'select' | 'verify' | 'hover' | 'scroll' | 'wait' | 'navigate'; value?: string; description?: string }>,
        media_type: `image/${image_type}`,
        target_url: base_url,
        test_name: context || 'Annotated Test',
        include_comments: true,
        include_assertions: true,
      });

      const aiResult = result as {
        success: boolean;
        test_name?: string;
        page_context?: string;
        steps?: Array<{
          step_number: number;
          marker_id: string;
          action: string;
          element_type?: string;
          element_label?: string;
          selector?: string;
          playwright_code?: string;
          confidence?: number;
        }>;
        assertions?: Array<{ step_after: number; playwright_code: string }>;
        generated_code?: string;
        overall_confidence?: number;
        ai_metadata?: {
          provider?: string;
          model?: string;
          vision_used?: boolean;
        };
        error?: string;
      };

      if (!aiResult.success) {
        // Fall back to simple generation
        logger.warn({ error: aiResult.error }, 'Real Vision AI failed for annotations, falling back');
        const testSteps = annotations.map((ann, idx) => ({
          step_number: idx + 1,
          action: ann.type,
          element_id: `elem_${idx}`,
          description: ann.type === 'click' ? 'Click element' : ann.type === 'type' ? `Type "${ann.label}"` : `Verify: ${ann.expectation}`,
          playwright_code: ann.type === 'click' ? `await page.click('button');` : ann.type === 'type' ? `await page.fill('input', '${ann.label}');` : `await expect(page.getByText('${ann.expectation}')).toBeVisible();`,
        }));

        return reply.send({
          success: true,
          analysis: {
            elements: annotations.map((ann, idx) => ({ id: `elem_${idx}`, type: ann.type === 'type' ? 'input' : 'button', description: `Element ${idx + 1}`, suggested_selector: 'button', suggested_action: ann.type, confidence: 0.7, location: { x: ann.x, y: ann.y, width: 100, height: 40 } })),
            suggested_test_steps: testSteps,
            page_context: { page_type: 'annotated', main_functionality: context || 'Annotated test flow', responsive_design: true },
            generated_test: { name: 'Annotated Test', code: `test('annotated test', async ({ page }) => {\n  await page.goto('${base_url || 'https://example.com'}');\n${testSteps.map(s => `  ${s.playwright_code}`).join('\n')}\n});`, complexity: testSteps.length <= 3 ? 'simple' : 'medium' },
          },
          metadata: { analyzed_at: new Date().toISOString(), model: 'fallback', used_real_ai: false, vision_used: false, fallback_reason: aiResult.error, annotation_count: annotations.length },
        });
      }

      // Map AI steps to expected format
      const testSteps = (aiResult.steps || []).map(s => ({
        step_number: s.step_number,
        action: s.action,
        element_id: `elem_${s.step_number - 1}`,
        description: `${s.action} ${s.element_label || s.element_type || 'element'}`,
        playwright_code: s.playwright_code || `// Step ${s.step_number}`,
        confidence: s.confidence,
      }));

      const elements = annotations.map((ann, idx) => {
        const step = aiResult.steps?.find(s => s.marker_id === String(idx + 1));
        return {
          id: `elem_${idx}`,
          type: step?.element_type || (ann.type === 'type' ? 'input' : 'button'),
          description: step?.element_label || `Element ${idx + 1}`,
          suggested_selector: step?.selector || 'button',
          suggested_action: ann.type,
          confidence: step?.confidence || 0.8,
          location: { x: ann.x, y: ann.y, width: 100, height: 40 },
        };
      });

      return reply.send({
        success: true,
        analysis: {
          elements,
          suggested_test_steps: testSteps,
          page_context: {
            page_type: 'annotated',
            main_functionality: aiResult.page_context || context || 'Annotated test flow',
            responsive_design: true,
          },
          generated_test: {
            name: aiResult.test_name || 'Annotated Test',
            code: aiResult.generated_code || `test('${aiResult.test_name || 'annotated test'}', async ({ page }) => {\n  await page.goto('${base_url || 'https://example.com'}');\n${testSteps.map(s => `  ${s.playwright_code}`).join('\n')}\n});`,
            complexity: testSteps.length <= 3 ? 'simple' : testSteps.length <= 7 ? 'medium' : 'complex',
          },
        },
        metadata: {
          analyzed_at: new Date().toISOString(),
          model: aiResult.ai_metadata?.model || 'claude-sonnet-4-vision',
          provider: aiResult.ai_metadata?.provider || 'anthropic',
          used_real_ai: true,
          vision_used: aiResult.ai_metadata?.vision_used ?? true,
          overall_confidence: aiResult.overall_confidence,
          annotation_count: annotations.length,
        },
      });
    } catch (error) {
      logger.error({ err: error }, 'Error processing annotated screenshot');
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to process annotated screenshot. Please try again.');
    }
  });
}
