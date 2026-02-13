/**
 * MCP Tools Module - Vision Route
 * Feature #730: Split mcp-tools/routes.ts into sub-modules
 *
 * Provides POST /chat/vision endpoint for visual regression analysis using Claude Vision.
 * Feature #1947: Smart image handling - use Vision API only for visual regression tests
 */

import { FastifyInstance } from 'fastify';
import { aiRouter } from '../../services/providers/ai-router.js';
import { sendError } from '../../utils/errors.js';
import { validateBody, mcpChatVisionBodySchema } from '../../validation/index.js';
import { ensureAIInitialized, logger } from './helpers.js';

export async function registerVisionRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/v1/mcp/chat/vision
   * AI-powered chat endpoint with Claude Vision for visual regression analysis
   * Feature #1947: Smart image handling - use Vision API only for visual regression tests
   */
  // Feature #715: Zod validation for MCP chat vision body
  fastify.post<{
    Body: {
      message: string;
      image: {
        data: string;  // Base64 encoded image (JPEG)
        media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
      };
      context?: {
        test_type?: string;
        diff_percentage?: number;
        viewport?: { width: number; height: number };
      };
      complexity?: 'simple' | 'complex';
    };
  }>('/chat/vision', {
    preValidation: [validateBody(mcpChatVisionBodySchema)],
  }, async (request, reply) => {
    const startTime = Date.now();

    try {
      const { message, image, context = {}, complexity = 'complex' } = request.body;

      if (!message) {
        return sendError(reply, 400, 'BAD_REQUEST', 'Missing required parameter: message');
      }

      if (!image?.data) {
        return sendError(reply, 400, 'BAD_REQUEST', 'Missing required parameter: image.data');
      }

      // Ensure AI is initialized
      ensureAIInitialized();

      // Check if vision is available (requires Anthropic)
      if (!aiRouter.isVisionAvailable()) {
        return sendError(reply, 503, 'SERVICE_UNAVAILABLE', 'Vision API requires Anthropic provider which is not initialized. Check ANTHROPIC_API_KEY in .env', { metadata: {
            used_real_ai: false,
            execution_time_ms: Date.now() - startTime,
          } });
      }

      logger.info(`[Vision] Processing visual analysis: ${context.diff_percentage?.toFixed(2) || 0}% diff, ${context.viewport?.width || 0}x${context.viewport?.height || 0}`);

      // Build the vision message with image content
      // Claude Vision API format: content array with text and image blocks
      const visionMessage = {
        role: 'user' as const,
        content: [
          {
            type: 'image' as const,
            source: {
              type: 'base64' as const,
              media_type: image.media_type,
              data: image.data,
            },
          },
          {
            type: 'text' as const,
            text: message,
          },
        ],
      };

      // Use Claude Sonnet 4 for vision analysis (best for visual understanding)
      const visionModel = 'claude-sonnet-4-20250514';

      const aiResponse = await aiRouter.sendVisionMessage(
        [visionMessage],
        {
          model: visionModel,
          maxTokens: 2000,
          temperature: 0.3,
          systemPrompt: `You are a visual QA expert analyzing visual regression test results.
Your job is to describe UI changes shown in diff images and help QA engineers understand what changed.

When analyzing a diff image:
1. Focus on the highlighted regions (usually shown in magenta/pink)
2. Describe what UI elements appear to have changed
3. Assess the severity of the changes (critical, moderate, minor)
4. Recommend whether to approve as new baseline or investigate

Be specific and actionable in your recommendations.`,
        }
      );

      const executionTime = Date.now() - startTime;

      logger.info(`[Vision] Analysis completed in ${executionTime}ms using ${aiResponse.actualProvider}`);

      return reply.send({
        success: true,
        result: {
          response: aiResponse.content,
          ai_metadata: {
            used_real_ai: true,
            provider: aiResponse.actualProvider,
            model: aiResponse.model,
            complexity,
            tokens: {
              input: aiResponse.inputTokens,
              output: aiResponse.outputTokens,
            },
            vision: true,
            context: {
              test_type: context.test_type || 'visual',
              diff_percentage: context.diff_percentage,
              viewport: context.viewport,
            },
          },
        },
        metadata: {
          used_real_ai: true,
          provider: aiResponse.actualProvider,
          model: aiResponse.model,
          vision: true,
          execution_time_ms: executionTime,
        },
      });
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error(`[Vision] Analysis failed: ${errorMessage}`, error);

      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', errorMessage, { metadata: {
          used_real_ai: false,
          vision: true,
          execution_time_ms: executionTime,
        } });
    }
  });
}
