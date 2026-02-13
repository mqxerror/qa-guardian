/**
 * MCP Tools Module - Status and Tools Listing Routes
 * Feature #730: Split mcp-tools/routes.ts into sub-modules
 *
 * Provides GET /status and GET /tools endpoints.
 */

import { FastifyInstance } from 'fastify';
import { aiRouter } from '../../services/providers/ai-router.js';
import { getRegisteredToolNames, hasHandler, HANDLER_STATS } from '../../mcp/handlers/index.js';
import type { AIStatusResponse, AvailableToolsResponse } from './types.js';
import { sendError } from '../../utils/errors.js';
import { ensureAIInitialized, logger, AI_POWERED_TOOLS } from './helpers.js';

export async function registerStatusToolsRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/mcp/status
   * Check AI provider status and availability
   */
  fastify.get('/status', async (request, reply) => {
    try {
      // Ensure AI is initialized (handles late env var loading)
      ensureAIInitialized();

      const isInitialized = aiRouter.isInitialized();
      const kieAvailable = aiRouter.isProviderAvailable('kie');
      const anthropicAvailable = aiRouter.isProviderAvailable('anthropic');

      const response: AIStatusResponse = {
        ready: isInitialized,
        providers: {
          available: isInitialized,
          primary: {
            name: 'Kie.ai',
            available: kieAvailable,
            model: kieAvailable ? (process.env.KIE_DEFAULT_MODEL || 'claude-3-haiku-20240307') : undefined,
          },
          fallback: {
            name: 'Anthropic',
            available: anthropicAvailable,
            model: anthropicAvailable ? (process.env.ANTHROPIC_DEFAULT_MODEL || 'claude-3-haiku-20240307') : undefined,
          },
        },
        message: isInitialized
          ? `AI ready: ${kieAvailable ? 'Kie.ai (primary)' : ''}${kieAvailable && anthropicAvailable ? ' + ' : ''}${anthropicAvailable ? 'Anthropic (fallback)' : ''}`
          : 'No AI providers available. Check your API keys in .env',
      };

      return reply.send(response);
    } catch (error) {
      logger.error('Failed to get AI status', error);
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to check AI status', { ready: false, providers: {
          available: false,
          primary: { name: 'Kie.ai', available: false },
          fallback: { name: 'Anthropic', available: false },
        } });
    }
  });

  /**
   * GET /api/v1/mcp/tools
   * List all available MCP tools
   */
  fastify.get('/tools', async (request, reply) => {
    try {
      const toolNames = getRegisteredToolNames();
      const stats = HANDLER_STATS.handlersByModule;

      // Group tools by module
      const categories: Record<string, string[]> = {};
      for (const [moduleName, count] of Object.entries(stats)) {
        if (typeof count === 'number' && count > 0) {
          // We don't have direct access to which tools belong to which module
          // So we'll include the stats as-is
          categories[moduleName] = [];
        }
      }

      const response: AvailableToolsResponse = {
        total: toolNames.length,
        categories: {
          // Simplified - just list AI tools separately
          all: toolNames,
        },
        ai_tools: AI_POWERED_TOOLS.filter(tool => hasHandler(tool)),
      };

      return reply.send(response);
    } catch (error) {
      logger.error('Failed to get available tools', error);
      return reply.status(500).send({
        total: 0,
        categories: {},
        ai_tools: [],
      });
    }
  });
}
