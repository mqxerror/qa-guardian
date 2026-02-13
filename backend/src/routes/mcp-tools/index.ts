/**
 * MCP Tools Execution Module
 * Feature #730: Split mcp-tools/routes.ts into sub-modules
 *
 * Provides REST API endpoints to execute MCP tool handlers directly.
 * This enables the frontend (MCP Chat) to call real AI-powered tools
 * instead of using mock/template responses.
 *
 * @see ./helpers.ts - Shared helpers (error checking, AI init, context creation)
 * @see ./status-tools.ts - GET /status and GET /tools endpoints
 * @see ./execute.ts - POST /execute endpoint
 * @see ./chat.ts - POST /chat endpoint
 * @see ./chat-system-prompt.ts - System prompt for the chat endpoint
 * @see ./vision.ts - POST /chat/vision endpoint
 * @see ./types.ts - Type definitions
 */

import { FastifyInstance } from 'fastify';
import { registerStatusToolsRoutes } from './status-tools.js';
import { registerExecuteRoutes } from './execute.js';
import { registerChatRoutes } from './chat.js';
import { registerVisionRoutes } from './vision.js';

export async function mcpToolsRoutes(fastify: FastifyInstance) {
  await registerStatusToolsRoutes(fastify);
  await registerExecuteRoutes(fastify);
  await registerChatRoutes(fastify);
  await registerVisionRoutes(fastify);
}

export default mcpToolsRoutes;
export * from './types.js';
