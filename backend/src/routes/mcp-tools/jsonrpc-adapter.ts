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

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  executeHandler,
  getRegisteredToolNames,
  hasHandler,
  HANDLER_STATS,
} from '../../mcp/handlers/index.js';
// T4.1: Rich tool metadata (descriptions + JSON input schemas for 150+ tools)
// already lives in tool-definitions.ts. Reuse it instead of synthesizing so
// Claude Code CLI and the MCP Hub both see real docs + schemas.
import { TOOLS } from '../../mcp/tool-definitions.js';
import { AI_POWERED_TOOLS, createHandlerContext, logger } from './helpers.js';

// Index tool definitions by name for O(1) lookup
const TOOL_METADATA_BY_NAME: Record<string, typeof TOOLS[number]> = Object.fromEntries(
  TOOLS.map(t => [t.name, t]),
);

function getToolMetadata(name: string): typeof TOOLS[number] | undefined {
  return TOOL_METADATA_BY_NAME[name];
}

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

/**
 * Infer a high-level category from the tool name. Tool names are dotted
 * (e.g., `project.create`) or underscore-prefixed by subject (e.g.,
 * `generate_test_from_description`). This lets the UI group by category
 * without us having to decorate every single tool.
 */
function categorize(name: string): string {
  if (name.startsWith('project')) return 'projects';
  if (name.startsWith('test_suite') || name.startsWith('suite')) return 'test-suites';
  if (name.startsWith('test_execution') || name.startsWith('run_')) return 'execution';
  if (name.startsWith('test_result') || name.includes('result')) return 'results';
  if (name.includes('security') || name.includes('sast') || name.includes('scan')) return 'security';
  if (name.includes('visual') || name.includes('screenshot') || name.includes('baseline')) return 'visual';
  if (name.includes('perf') || name.includes('lighthouse') || name.includes('web_vital')) return 'performance';
  if (name.includes('accessibility') || name.includes('a11y') || name.includes('wcag')) return 'accessibility';
  if (name.includes('load') || name.includes('k6')) return 'load-testing';
  if (name.includes('analytic') || name.includes('insight') || name.includes('flaky')) return 'analytics';
  if (name.includes('monitor')) return 'monitoring';
  if (name.includes('generate') || name.includes('ai_') || name.includes('suggest')) return 'ai-powered';
  if (name.includes('artifact') || name.includes('report')) return 'artifacts';
  if (name.includes('setting') || name.includes('config')) return 'settings';
  return 'misc';
}

function listAllTools(): unknown {
  const registered = new Set(getRegisteredToolNames());
  const stats = HANDLER_STATS.handlersByModule as Record<string, number>;

  // T4.1: Every documented tool ships with description + inputSchema from
  // tool-definitions.ts. We merge that with the runtime registry so the UI
  // knows which tools actually have handlers registered vs. documented-only.
  const docsWithHandlers = TOOLS.filter(t => registered.has(t.name));

  const tools_by_category: Record<string, Array<{ name: string; description: string; permission: string; inputSchema?: unknown }>> = {};
  for (const t of docsWithHandlers) {
    const category = categorize(t.name);
    if (!tools_by_category[category]) tools_by_category[category] = [];
    tools_by_category[category].push({
      name: t.name,
      description: t.description,
      permission: AI_POWERED_TOOLS.includes(t.name) ? 'write' : 'read',
      inputSchema: t.inputSchema,
    });
  }

  // Include any registered handlers that aren't in the docs file as a
  // fallback bucket — so nothing disappears if someone adds a tool without
  // documenting it yet.
  const undocumented: typeof tools_by_category[string] = [];
  for (const name of registered) {
    if (!TOOL_METADATA_BY_NAME[name]) {
      undocumented.push({
        name,
        description: 'Undocumented tool (add an entry in tool-definitions.ts)',
        permission: AI_POWERED_TOOLS.includes(name) ? 'write' : 'read',
      });
    }
  }
  if (undocumented.length) tools_by_category['undocumented'] = undocumented;

  return {
    success: true,
    total: docsWithHandlers.length + undocumented.length,
    documented: docsWithHandlers.length,
    undocumented: undocumented.length,
    categories: Object.keys(tools_by_category).sort(),
    tools_by_category,
    ai_tools: AI_POWERED_TOOLS.filter(t => hasHandler(t)),
    modules: stats,
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

async function jsonRpcHandler(
  request: FastifyRequest<{ Body: JsonRpcRequest }>,
  reply: FastifyReply,
): Promise<void> {
    const body = request.body || ({} as JsonRpcRequest);
    const id = body.id ?? null;

    // Minimal JSON-RPC validation. We don't strictly require jsonrpc:'2.0'
    // because some clients omit it.
    if (!body.method || typeof body.method !== 'string') {
      return reply.send(err(id, -32600, 'Invalid Request: missing method'));
    }

    try {
      if (body.method === 'tools/list') {
        // Return the tool-list envelope the MCP spec expects — with full
        // description + inputSchema so Claude Code CLI (and any MCP client)
        // sees actual parameter documentation, not synthesized placeholders.
        const registered = new Set(getRegisteredToolNames());
        const tools = TOOLS
          .filter(t => registered.has(t.name))
          .map(t => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          }));
        return reply.send({ jsonrpc: '2.0', id, result: { tools } });
      }

      // get_tool_info — richer metadata for a single tool
      if (body.method === 'tools/describe') {
        const name = body.params?.name;
        if (!name) return reply.send(err(id, -32602, 'Missing name'));
        const meta = getToolMetadata(name);
        if (!meta) return reply.send(err(id, -32601, `Unknown tool: ${name}`));
        return reply.send(ok(id, meta));
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
      logger.error('[mcp-rpc] handler threw', e);
      return reply.send(err(id, -32603, e instanceof Error ? e.message : 'Internal error'));
    }
}

export async function registerMcpJsonRpcAdapter(fastify: FastifyInstance): Promise<void> {
  // PRIMARY PATH: /api/v1/mcp-rpc
  // Mounted under /api/* which has an explicit Traefik PathPrefix(/api) rule
  // routing to this backend. Safe from Dokploy's service-name auto-discovery.
  fastify.post<{ Body: JsonRpcRequest }>('/api/v1/mcp-rpc', jsonRpcHandler);

  // LEGACY ALIAS: /mcp/message
  // Traefik service-name auto-discovery currently intercepts /mcp/* and routes
  // it to the mcp-server container in prod, so this alias is effectively dead
  // code there. Retained for local dev (where Traefik isn't in the path) and
  // in case the auto-discovery is fixed/removed later.
  fastify.post<{ Body: JsonRpcRequest }>('/mcp/message', jsonRpcHandler);
}
