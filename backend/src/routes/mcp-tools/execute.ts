/**
 * MCP Tools Module - Tool Execution Route
 * Feature #730: Split mcp-tools/routes.ts into sub-modules
 *
 * Provides POST /execute endpoint for executing MCP tool handlers.
 */

import { FastifyInstance } from 'fastify';
import { executeHandler, hasHandler } from '../../mcp/handlers/index.js';
import type { ExecuteToolRequest, ExecuteToolResponse } from './types.js';
import { sendError } from '../../utils/errors.js';
import { validateBody, mcpExecuteBodySchema } from '../../validation/index.js';
import { ensureAIInitialized, createHandlerContext, logger, AI_POWERED_TOOLS } from './helpers.js';

export async function registerExecuteRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/v1/mcp/execute
   * Execute an MCP tool handler
   */
  // Feature #715: Zod validation for MCP tool execution body
  fastify.post<{
    Body: ExecuteToolRequest;
  }>('/execute', {
    preValidation: [validateBody(mcpExecuteBodySchema)],
  }, async (request, reply) => {
    const startTime = Date.now();

    try {
      const { tool_name, args, use_real_ai = true } = request.body;

      if (!tool_name) {
        return sendError(reply, 400, 'BAD_REQUEST', 'Missing required parameter: tool_name', { metadata: {
            tool_name: '',
            used_real_ai: false,
            execution_time_ms: Date.now() - startTime,
          } });
      }

      // Check if tool exists
      if (!hasHandler(tool_name)) {
        return sendError(reply, 404, 'NOT_FOUND', `Unknown tool: ${tool_name}. Use GET /api/v1/mcp/tools to see available tools.`, { metadata: {
            tool_name,
            used_real_ai: false,
            execution_time_ms: Date.now() - startTime,
          } });
      }

      // Create handler context
      const context = createHandlerContext(request);

      // Ensure AI is initialized for AI-powered tools
      const isAiTool = AI_POWERED_TOOLS.includes(tool_name);
      if (isAiTool && use_real_ai) {
        ensureAIInitialized();
      }

      // Add use_real_ai flag to args if this is an AI tool
      const enhancedArgs = isAiTool ? { ...args, use_real_ai } : args;

      logger.info(`Executing tool: ${tool_name} (real_ai: ${use_real_ai}, is_ai_tool: ${isAiTool})`);

      // Execute the handler
      const result = await executeHandler(tool_name, enhancedArgs, context);

      const executionTime = Date.now() - startTime;

      // Extract AI metadata if available
      const resultObj = result as Record<string, unknown> | undefined;
      const aiMetadata = resultObj?.ai_metadata as Record<string, unknown> | undefined;

      const response: ExecuteToolResponse = {
        success: true,
        result,
        metadata: {
          tool_name,
          used_real_ai: aiMetadata?.used_real_ai === true || aiMetadata?.provider !== undefined,
          provider: aiMetadata?.provider as string | undefined,
          model: aiMetadata?.model as string | undefined,
          execution_time_ms: executionTime,
          tokens: aiMetadata?.tokens ? {
            input: (aiMetadata.tokens as Record<string, number>).input || 0,
            output: (aiMetadata.tokens as Record<string, number>).output || 0,
          } : undefined,
        },
      };

      logger.info(`Tool ${tool_name} completed in ${executionTime}ms (real_ai: ${response.metadata.used_real_ai})`);

      return reply.send(response);
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error(`Tool execution failed: ${errorMessage}`, error);

      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', errorMessage, { metadata: {
          tool_name: request.body?.tool_name || 'unknown',
          used_real_ai: false,
          execution_time_ms: executionTime,
        } });
    }
  });
}
