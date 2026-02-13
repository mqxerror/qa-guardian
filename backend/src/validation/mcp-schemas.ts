/**
 * MCP (Model Context Protocol) Validation Schemas
 * Extracted from schemas.ts - MCP tool execution, chat, vision, connections
 */

import { z } from 'zod';

// ============================================================================
// Feature #715: MCP Tools Schemas
// ============================================================================

/**
 * MCP tool execute request body
 */
export const mcpExecuteBodySchema = z.object({
  tool_name: z.string().min(1, 'Tool name is required').max(100),
  args: z.record(z.unknown()).default({}),
  use_real_ai: z.boolean().default(true),
});

/**
 * MCP chat request body
 */
export const mcpChatBodySchema = z.object({
  message: z.string().min(1, 'Message is required').max(10000),
  context: z.object({
    project_id: z.string().optional(),
    project_name: z.string().optional(),
    test_id: z.string().optional(),
    current_page: z.string().optional(),
    conversation_history: z.array(z.object({
      role: z.string(),
      content: z.string(),
    })).optional(),
  }).optional(),
  complexity: z.enum(['simple', 'complex']).default('complex'),
  provider: z.enum(['kie', 'anthropic', 'auto']).optional(),
  model: z.string().max(100).optional(),
});

/**
 * MCP chat vision request body
 */
export const mcpChatVisionBodySchema = z.object({
  message: z.string().min(1, 'Message is required').max(10000),
  image: z.object({
    data: z.string().min(1, 'Image data is required'),
    media_type: z.enum(['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
  }),
  context: z.object({
    test_type: z.string().optional(),
    diff_percentage: z.number().min(0).max(100).optional(),
    viewport: z.object({
      width: z.number().int().min(1),
      height: z.number().int().min(1),
    }).optional(),
  }).optional(),
  complexity: z.enum(['simple', 'complex']).default('complex'),
});

// ============================================================================
// MCP Routes (api-keys/mcp-routes)
// ============================================================================

/**
 * MCP connect body
 */
export const mcpConnectBodySchema = z.object({
  api_key: z.string().min(1, 'API key is required'),
  client_name: z.string().max(255).optional(),
  client_version: z.string().max(50).optional(),
});

/**
 * MCP heartbeat body
 */
export const mcpHeartbeatBodySchema = z.object({
  connection_id: z.string().min(1, 'Connection ID is required'),
});

/**
 * MCP disconnect body
 */
export const mcpDisconnectBodySchema = z.object({
  connection_id: z.string().min(1, 'Connection ID is required'),
});

/**
 * MCP track tool body
 */
export const mcpTrackToolBodySchema = z.object({
  connection_id: z.string().min(1),
  tool_name: z.string().min(1),
  duration_ms: z.number().int().min(0).optional(),
  success: z.boolean().optional(),
  error: z.string().optional(),
});

/**
 * MCP audit log body
 */
export const mcpAuditLogBodySchema = z.object({
  api_key: z.string().min(1, 'API key is required'),
  connection_id: z.string().optional(),
  client_name: z.string().optional(),
  client_version: z.string().optional(),
  method: z.string().min(1, 'Method is required'),
  tool_name: z.string().optional(),
  resource_uri: z.string().optional(),
  request_params: z.record(z.unknown()).optional(),
  response_type: z.enum(['success', 'error']),
  response_error_code: z.number().int().optional(),
  response_error_message: z.string().optional(),
  response_data_preview: z.string().optional(),
  duration_ms: z.number().int().min(0).optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type McpExecuteBodyInput = z.infer<typeof mcpExecuteBodySchema>;
export type McpChatBodyInput = z.infer<typeof mcpChatBodySchema>;
export type McpChatVisionBodyInput = z.infer<typeof mcpChatVisionBodySchema>;
