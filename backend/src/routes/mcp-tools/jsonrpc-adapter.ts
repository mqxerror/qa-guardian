/**
 * MCP JSON-RPC Adapter
 *
 * The MCP Hub frontend (MCPToolsPage, MCPPlaygroundPage, MCPAnalyticsPage)
 * talks JSON-RPC 2.0 to a path shaped like `/mcp/message`, which was
 * historically a standalone MCP server process. Since the backend and MCP
 * logic are now the same container, the UI pages broke silently — there
 * was no `/mcp/message` endpoint on the backend to respond.
 *
 * Rather than rewrite all four frontend pages (risky, three separate
 * polling patterns to keep consistent), this adapter exposes a single
 * `POST /mcp/message` that accepts the JSON-RPC envelope and dispatches
 * to the REST handlers that already exist. The MCP wire protocol is
 * preserved for any third-party MCP client that expects it.
 *
 * Supported methods:
 *   - tools/list               — returns { tools: [...] }
 *   - tools/call               — executes a tool by name
 *     · list_all_tools         — categorized listing (meta tool)
 *     · validate_api_key       — returns usage stats + rate limit (meta tool)
 *     · get_help               — returns help text for a tool (meta tool)
 *     · <any registered tool>  — delegates to the same executeHandler the
 *                                REST /api/v1/mcp/execute endpoint uses
 *
 * Responses always follow the JSON-RPC 2.0 shape:
 *   { jsonrpc, id, result: { content: [{ type: 'text', text: JSON-string }] } }
 * or { jsonrpc, id, error: { code, message } }
 */

import { FastifyInstance } from 'fastify';
import {
  executeHandler,
  getRegisteredToolNames,
  hasHandler,
  HANDLER_STATS,
} from '../../mcp/handlers/index.js';
import { AI_POWERED_TOOLS, createHandlerContext, logger } from './helpers.js';

// =============================================================================
// JSON-RPC types
// =============================================================================

interface JsonRpcRequest {
  jsonrpc?: '2.0';
  id: number | string | null;
  method: string;
  params?: {
    name?: string;
    arguments?: Record<string, unknown>;
  };
}

interface JsonRpcResult {
  jsonrpc: '2.0';
  id: number | string | null;
  result: {
    content: Array<{ type: 'text'; text: string }>;
  };
}

interface JsonRpcError {
  jsonrpc: '2.0';
  id: number | string | null;
  error: { code: number; message: string; data?: unknown };
}

function ok(id: JsonRpcRequest['id'], payload: unknown): JsonRpcResult {
  return {
    jsonrpc: '2.0',
    id,
    result: {
      content: [{ type: 'text', text: JSON.stringify(payload) }],
    },
  };
}

function err(id: JsonRpcRequest['id'], code: number, message: string, data?: unknown): JsonRpcError {
  return { jsonrpc: '2.0', id, error: { code, message, data } };
}

// =============================================================================
// Meta tools (handled inline — they describe the server itself)
// =============================================================================

function listAllTools(): unknown {
  const toolNames = getRegisteredToolNames();
  // We don't have per-tool description/category metadata in the registry, so
  // group by the handler-module stats we do have. This is imperfect but gives
  // the UI enough structure to render a usable list.
  const stats = HANDLER_STATS.handlersByModule as Record<string, number>;
  const categories: string[] = Object.keys(stats).filter(k => stats[k] > 0);

  // All tools land in a single "all" bucket since we don't carry category
  // metadata through the registry. The UI still renders them filterably.
  const tools_by_category: Record<string, Array<{ name: string; description: string; permission: string }>> = {
    all: toolNames.map(name => ({
      name,
      description: AI_POWERED_TOOLS.includes(name)
        ? 'AI-powered tool (uses Kie.ai or Anthropic)'
        : 'Registered MCP tool',
      permission: AI_POWERED_TOOLS.includes(name) ? 'write' : 'read',
    })),
  };

  return {
    success: true,
    total: toolNames.length,
    categories: ['all', ...categories],
    tools_by_category,
    ai_tools: AI_POWERED_TOOLS.filter(t => hasHandler(t)),
  };
}

function validateApiKey(): unknown {
  // The UI expects a usage-stats shape. Since we authenticate at the outer
  // Fastify layer (not per MCP tool), we return a "valid" response with
  // zeroed stats — the Analytics page can at least render without crashing.
  return {
    valid: true,
    usage_stats: {
      requests_today: 0,
      requests_this_week: 0,
      tools_used: getRegisteredToolNames().length,
      most_used_tools: [],
    },
    rate_limit: {
      requests_remaining: 1000,
      reset_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
  };
}

function getHelp(args: Record<string, unknown>): unknown {
  const name = (args.tool_name as string) || (args.name as string);
  if (!name) {
    return { success: false, error: 'Provide tool_name in arguments' };
  }
  const known = hasHandler(name);
  return {
    success: true,
    tool_name: name,
    registered: known,
    is_ai_tool: AI_POWERED_TOOLS.includes(name),
    description: known ? 'Tool is registered. See POST /api/v1/mcp/execute for invocation.' : 'Tool is not registered.',
  };
}

// =============================================================================
// Adapter route
// =============================================================================

export async function registerMcpJsonRpcAdapter(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: JsonRpcRequest }>('/mcp/message', async (request, reply) => {
    const body = request.body || ({} as JsonRpcRequest);
    const id = body.id ?? null;

    // Minimal JSON-RPC validation. We don't strictly require jsonrpc:'2.0'
    // because some clients omit it.
    if (!body.method || typeof body.method !== 'string') {
      return reply.send(err(id, -32600, 'Invalid Request: missing method'));
    }

    try {
      if (body.method === 'tools/list') {
        // Return the tool-list envelope the MCP spec expects.
        const toolNames = getRegisteredToolNames();
        return reply.send({
          jsonrpc: '2.0',
          id,
          result: {
            tools: toolNames.map(name => ({
              name,
              description: AI_POWERED_TOOLS.includes(name)
                ? 'AI-powered tool'
                : 'MCP tool',
            })),
          },
        });
      }

      if (body.method === 'tools/call') {
        const name = body.params?.name;
        if (!name) return reply.send(err(id, -32602, 'Invalid params: missing name'));

        // Meta tools handled inline
        if (name === 'list_all_tools') return reply.send(ok(id, listAllTools()));
        if (name === 'validate_api_key') return reply.send(ok(id, validateApiKey()));
        if (name === 'get_help') return reply.send(ok(id, getHelp(body.params?.arguments ?? {})));

        // Real tools — delegate to the same pipeline the REST /execute uses
        if (!hasHandler(name)) {
          return reply.send(err(id, -32601, `Unknown tool: ${name}`));
        }
        const context = createHandlerContext(request);
        const result = await executeHandler(name, body.params?.arguments ?? {}, context);
        return reply.send(ok(id, result));
      }

      return reply.send(err(id, -32601, `Method not supported: ${body.method}`));
    } catch (e) {
      logger.error('[mcp/message] handler threw', e);
      return reply.send(err(id, -32603, e instanceof Error ? e.message : 'Internal error'));
    }
  });
}
