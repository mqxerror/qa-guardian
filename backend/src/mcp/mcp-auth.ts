/**
 * MCP Authentication and Authorization Module
 *
 * Handles API key validation, scope checking, and permission enforcement.
 * Extracted from server.ts to reduce file size (Feature #252).
 *
 * @module mcp-auth
 */

import { MCPResponse, PerKeyRateLimitConfig } from './mcp-types.js';
import { TOOL_SCOPE_MAP } from './tool-permissions.js';
import { TOOLS } from './tool-definitions.js';
import { findSimilarStrings } from './string-utils.js';
import { RateLimiter } from './mcp-rate-limiter.js';
// Feature #449: Use structured logger instead of console.*
import { createLogger } from '../services/logger.js';
const logger = createLogger('mcp:auth');

// ============================================================================
// Types
// ============================================================================

/**
 * Logger function type
 */
export type LogFunction = (message: string) => void;

/**
 * Server configuration for auth
 */
export interface AuthConfig {
  requireAuth: boolean;
  apiKey?: string;
  apiUrl?: string;
}

/**
 * Auth validation result
 */
export interface AuthResult {
  valid: boolean;
  error?: MCPResponse;
}

/**
 * MCP scope validation result
 */
export interface ScopeValidationResult {
  valid: boolean;
  error?: MCPResponse;
  scopes?: string[];
}

// ============================================================================
// Auth Helper Functions
// ============================================================================

/**
 * Check if authentication is valid.
 */
export function checkAuth(config: AuthConfig): AuthResult {
  if (config.requireAuth && !config.apiKey) {
    return {
      valid: false,
      error: {
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: 'Authentication required. Please provide a valid API key.',
        },
      },
    };
  }
  return { valid: true };
}

/**
 * Validate API key has MCP scope via backend API.
 */
export async function validateMcpScope(
  config: AuthConfig,
  log: LogFunction,
  rateLimiter?: RateLimiter
): Promise<ScopeValidationResult> {
  // Skip validation if auth not required
  if (!config.requireAuth || !config.apiKey) {
    return { valid: true, scopes: ['admin'] }; // No auth required = full access
  }

  // Skip scope validation if no API URL configured (local mode)
  if (!config.apiUrl) {
    return { valid: true, scopes: ['admin'] }; // Local mode = full access
  }

  try {
    const url = new URL('/api/v1/mcp/validate-key', config.apiUrl);

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: config.apiKey,
        required_scope: 'mcp',
      }),
    });

    const data = await response.json() as {
      valid: boolean;
      error?: string;
      scopes?: string[];
      rate_limit?: PerKeyRateLimitConfig;
    };

    if (!data.valid) {
      const isAuthenticationError = response.status === 401;
      const isAuthorizationError = response.status === 403;

      // Mask the API key for logging
      const maskedKey = config.apiKey
        ? `${config.apiKey.substring(0, 7)}...${config.apiKey.substring(config.apiKey.length - 4)}`
        : 'unknown';

      if (isAuthenticationError) {
        log(`[SECURITY] Failed authentication attempt with API key: ${maskedKey}`);
        log(`[SECURITY] Error: ${data.error || 'Invalid or expired API key'}`);

        return {
          valid: false,
          error: {
            jsonrpc: '2.0',
            error: {
              code: -32001, // Authentication error code
              message: 'Invalid or expired API key',
            },
          },
        };
      } else if (isAuthorizationError) {
        log(`[SECURITY] Insufficient scope for API key: ${maskedKey}. Scopes: ${data.scopes?.join(', ') || 'none'}`);

        return {
          valid: false,
          error: {
            jsonrpc: '2.0',
            error: {
              code: -32002, // Authorization error code
              message: data.error || 'API key does not have MCP access. Required scope: mcp or mcp:*',
            },
          },
        };
      } else {
        log(`[SECURITY] API key validation failed for key: ${maskedKey}`);

        return {
          valid: false,
          error: {
            jsonrpc: '2.0',
            error: {
              code: -32002,
              message: data.error || 'API key validation failed',
            },
          },
        };
      }
    }

    // Store per-key rate limits if provided
    if (data.rate_limit && config.apiKey && rateLimiter) {
      rateLimiter.setPerKeyConfig(config.apiKey, data.rate_limit);
      log(`Loaded per-key rate limits: ${data.rate_limit.max_requests}/${data.rate_limit.window_seconds}s (burst: ${data.rate_limit.burst_limit}/${data.rate_limit.burst_window_seconds}s)`);
    }

    return { valid: true, scopes: data.scopes || [] };
  } catch (error) {
    // Feature #434: SECURITY FIX - fail CLOSED, not open
    // If auth service is unavailable, DENY access rather than grant admin access
    logger.error({ error }, 'SECURITY: Auth service unavailable, denying access');
    log(`MCP scope validation failed (access DENIED): ${error}`);
    return {
      valid: false,
      scopes: [],
      error: {
        jsonrpc: '2.0',
        error: {
          code: -32001,  // Unauthorized
          message: 'Auth service unavailable - access denied for security',
        },
      },
    };
  }
}

/**
 * Check if a tool exists.
 */
export function isKnownTool(toolName: string): boolean {
  return TOOL_SCOPE_MAP[toolName] !== undefined;
}

/**
 * Check if the validated scopes allow a specific tool action.
 */
export function hasToolPermission(toolName: string, validatedScopes: string[]): boolean {
  // Admin scope has access to everything
  if (validatedScopes.includes('admin')) {
    return true;
  }

  // Get required scope for this tool
  const requiredScope = TOOL_SCOPE_MAP[toolName];
  if (!requiredScope) {
    return false; // Unknown tool
  }

  // Check if user has the required scope
  // Support both specific scopes (mcp:execute) and wildcard (mcp)
  for (const scope of validatedScopes) {
    // Exact match
    if (scope === requiredScope) {
      return true;
    }

    // Wildcard match (mcp covers mcp:execute, mcp:read, mcp:write)
    if (scope === 'mcp' && requiredScope.startsWith('mcp:')) {
      return true;
    }

    // Check for scope hierarchy (mcp:execute covers mcp:execute:*)
    if (requiredScope.startsWith(scope + ':')) {
      return true;
    }
  }

  return false;
}

/**
 * Generate a permission denied error for a tool.
 */
export function toolPermissionDeniedError(
  toolName: string,
  validatedScopes: string[],
  requestId?: string | number,
  log?: LogFunction
): MCPResponse {
  const requiredScope = TOOL_SCOPE_MAP[toolName] || 'mcp:execute';
  const currentScopes = validatedScopes.join(', ') || 'none';

  log?.(`[ERROR] Permission denied for tool '${toolName}'. Required: '${requiredScope}', Has: [${currentScopes}]`);

  return {
    jsonrpc: '2.0',
    id: requestId,
    error: {
      code: -32003, // Permission denied (403 equivalent)
      message: `Permission denied for tool '${toolName}'. Required scope: '${requiredScope}'`,
      data: {
        tool: toolName,
        requiredScope,
        currentScopes: validatedScopes,
      },
    },
  };
}

/**
 * Generate an unknown tool error.
 */
export function unknownToolError(
  toolName: string,
  requestId?: string | number,
  log?: LogFunction
): MCPResponse {
  // Get list of available tools
  const availableTools = TOOLS.map(t => t.name);

  // Find similar tool names using simple string matching
  const suggestions = findSimilarStrings(toolName, availableTools);

  // Build helpful error message
  let errorMessage = `Unknown tool: ${toolName}.`;
  if (suggestions.length > 0) {
    errorMessage += ` Did you mean: ${suggestions.join(', ')}?`;
  }

  log?.(`[ERROR] Unknown tool: ${toolName}`);

  return {
    jsonrpc: '2.0',
    id: requestId,
    error: {
      code: -32601, // Method not found (404 equivalent)
      message: errorMessage,
      data: {
        requestedTool: toolName,
        availableTools,
        suggestions: suggestions.length > 0 ? suggestions : undefined,
      },
    },
  };
}
