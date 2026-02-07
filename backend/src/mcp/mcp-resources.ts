/**
 * MCP Resources Module
 *
 * Handles resource read operations for the MCP server.
 * Extracted from server.ts to reduce file size (Feature #252).
 *
 * @module mcp-resources
 */

import { MCPRequest, MCPResponse } from './mcp-types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Logger function type
 */
export type LogFunction = (message: string) => void;

/**
 * API caller function type - makes authenticated API calls
 */
export type ApiCaller = (endpoint: string, options?: { method?: string; body?: unknown } & Record<string, unknown>) => Promise<unknown>;

/**
 * Audit log entry type
 */
export interface AuditLogEntry {
  method: string;
  resource_uri?: string;
  response_type: 'success' | 'error';
  response_data_preview?: string;
  response_error_code?: number;
  response_error_message?: string;
}

/**
 * Audit log sender function type
 */
export type AuditLogSender = (entry: AuditLogEntry) => void;

/**
 * Context for resource handler operations
 */
export interface ResourceHandlerContext {
  callApi: ApiCaller;
  log: LogFunction;
  sendAuditLog: AuditLogSender;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Available resource patterns for error messages
 */
export const RESOURCE_PATTERNS = [
  'qa-guardian://projects - List all projects',
  'qa-guardian://projects/{id} - Get a specific project',
  'qa-guardian://projects/{id}/suites - Get suites for a project',
  'qa-guardian://recent-runs - List recent test runs',
  'qa-guardian://dashboard-stats - Get dashboard statistics',
  'qa-guardian://test-runs/{id} - Get a specific test run',
  'qa-guardian://test-runs/{id}/results - Get results for a test run',
  'qa-guardian://test-runs/{id}/artifacts - Get artifacts for a test run',
  'qa-guardian://checks/{id}/status - Get status of a monitoring check',
  'qa-guardian://security/vulnerabilities - Get security vulnerabilities',
  'qa-guardian://security/trends - Get security trends',
  'qa-guardian://alerts/active - Get active alerts',
  'qa-guardian://incidents - Get incidents',
  'qa-guardian://analytics/dashboard - Get analytics dashboard data',
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a resource not found error response.
 */
export function resourceNotFoundError(
  resourceType: string,
  resourceId: string,
  requestId?: string | number,
  log?: LogFunction
): MCPResponse {
  log?.(`[ERROR] Resource not found: ${resourceType} with ID '${resourceId}'`);

  return {
    jsonrpc: '2.0',
    id: requestId,
    error: {
      code: -32001, // Resource not found (404 equivalent)
      message: `${resourceType} not found: ${resourceId}`,
      data: {
        resourceType,
        resourceId,
        availablePatterns: RESOURCE_PATTERNS,
      },
    },
  };
}

/**
 * Generate an unknown resource pattern error response.
 */
export function unknownResourceError(
  uri: string,
  requestId?: string | number,
  log?: LogFunction
): MCPResponse {
  log?.(`[ERROR] Unknown resource pattern: ${uri}`);

  return {
    jsonrpc: '2.0',
    id: requestId,
    error: {
      code: -32602, // Invalid params
      message: `Unknown resource pattern: ${uri}`,
      data: {
        requestedUri: uri,
        availablePatterns: RESOURCE_PATTERNS,
      },
    },
  };
}

/**
 * Validate resource URI format.
 */
export function validateResourceUri(
  uri: string | undefined,
  log?: LogFunction
): { valid: boolean; error?: MCPResponse } {
  if (!uri) {
    return {
      valid: false,
      error: {
        jsonrpc: '2.0',
        error: {
          code: -32602, // Invalid params (400 Bad Request)
          message: 'Invalid resource URI format: URI is required',
          data: {
            expectedFormat: 'qa-guardian://{resource-type}[/{resource-id}]',
            examples: RESOURCE_PATTERNS,
          },
        },
      },
    };
  }

  // Check for common URI format issues
  const validationErrors: string[] = [];

  // Check for wrong protocol prefix (e.g., qaguardian:// instead of qa-guardian://)
  if (!uri.startsWith('qa-guardian://')) {
    if (uri.match(/^[a-z-]+:\/\//i)) {
      const protocol = uri.match(/^([a-z-]+):\/\//i)?.[1];
      validationErrors.push(`Invalid protocol '${protocol}'. Expected 'qa-guardian'`);
    } else {
      validationErrors.push("URI must start with 'qa-guardian://'");
    }
  }

  // Check for double slashes in path (after protocol)
  const pathPart = uri.replace(/^qa-guardian:\/\//, '');
  if (pathPart.includes('//')) {
    validationErrors.push('URI contains invalid double slashes in path');
  }

  // Check for empty path segments
  if (pathPart.split('/').some(segment => segment === '')) {
    validationErrors.push('URI contains empty path segments');
  }

  // Check for invalid characters
  if (uri.match(/[<>{}|\\^`[\]\s]/)) {
    validationErrors.push('URI contains invalid characters');
  }

  if (validationErrors.length > 0) {
    log?.(`[ERROR] Invalid resource URI format: ${uri} - ${validationErrors.join(', ')}`);

    return {
      valid: false,
      error: {
        jsonrpc: '2.0',
        error: {
          code: -32602, // Invalid params (400 Bad Request)
          message: `Invalid resource URI format: ${validationErrors[0]}`,
          data: {
            requestedUri: uri,
            issues: validationErrors,
            expectedFormat: 'qa-guardian://{resource-type}[/{resource-id}]',
            examples: RESOURCE_PATTERNS,
          },
        },
      },
    };
  }

  return { valid: true };
}

// ============================================================================
// Resource Handler
// ============================================================================

/**
 * Handle resources/read request.
 *
 * Processes resource URIs and fetches data from the appropriate API endpoints.
 */
export async function handleResourcesRead(
  request: MCPRequest,
  context: ResourceHandlerContext
): Promise<MCPResponse> {
  const { callApi, log, sendAuditLog } = context;
  const params = request.params as { uri: string };
  const uri = params?.uri;

  // Validate URI format first
  const uriValidation = validateResourceUri(uri, log);
  if (!uriValidation.valid) {
    return { ...uriValidation.error!, id: request.id };
  }

  try {
    let data: unknown;
    let resourceType: string | null = null;
    let resourceId: string | null = null;

    // Check for dynamic resources first
    // Match test-runs/{id}/results
    const testRunResultsMatch = uri?.match(/^qa-guardian:\/\/test-runs\/([^/]+)\/results$/);
    if (testRunResultsMatch) {
      resourceType = 'Test run results';
      resourceId = testRunResultsMatch[1];
      // Get test run and extract just the results
      const runData = await callApi(`/api/v1/runs/${resourceId}`) as { run?: { results?: unknown[] } };
      data = { results: runData?.run?.results || [] };
    }
    // Match test-runs/{id}/artifacts
    else {
      const testRunArtifactsMatch = uri?.match(/^qa-guardian:\/\/test-runs\/([^/]+)\/artifacts$/);
      if (testRunArtifactsMatch) {
        resourceType = 'Test run artifacts';
        resourceId = testRunArtifactsMatch[1];
        // Get artifacts from the artifacts endpoint
        data = await callApi(`/api/v1/runs/${resourceId}/artifacts`);
      }
      // Match checks/{id}/status
      else {
        const checkStatusMatch = uri?.match(/^qa-guardian:\/\/checks\/([^/]+)\/status$/);
        if (checkStatusMatch) {
          resourceType = 'Check status';
          resourceId = checkStatusMatch[1];
          data = await callApi(`/api/v1/monitoring/checks/${resourceId}`);
        }
        // Match test-runs/{id}
        else {
          const testRunMatch = uri?.match(/^qa-guardian:\/\/test-runs\/([^/]+)$/);
          if (testRunMatch) {
            resourceType = 'Test run';
            resourceId = testRunMatch[1];
            data = await callApi(`/api/v1/runs/${resourceId}`);
          }
          // Match projects/{id}/suites
          else {
            const projectSuitesMatch = uri?.match(/^qa-guardian:\/\/projects\/([^/]+)\/suites$/);
            if (projectSuitesMatch) {
              resourceType = 'Project suites';
              resourceId = projectSuitesMatch[1];
              data = await callApi(`/api/v1/projects/${resourceId}/suites`);
            }
            // Match projects/{id}
            else {
              const projectMatch = uri?.match(/^qa-guardian:\/\/projects\/([^/]+)$/);
              if (projectMatch) {
                resourceType = 'Project';
                resourceId = projectMatch[1];
                data = await callApi(`/api/v1/projects/${resourceId}`);
              } else {
                // Handle static resources
                data = await handleStaticResource(uri!, callApi);
                if (data === null) {
                  return unknownResourceError(uri!, request.id, log);
                }
              }
            }
          }
        }
      }
    }

    // Audit log successful resource read
    const dataStr = JSON.stringify(data, null, 2);
    sendAuditLog({
      method: 'resources/read',
      resource_uri: uri,
      response_type: 'success',
      response_data_preview: dataStr.length > 500 ? dataStr.slice(0, 500) + '...' : dataStr,
    });

    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: dataStr,
          },
        ],
      },
    };
  } catch (error) {
    // Check for 404 errors and return proper MCP error
    const errorMessage = error instanceof Error ? error.message : 'Resource read failed';
    const is404 = errorMessage.includes('404') || errorMessage.includes('Not Found');

    // Extract resource type and ID from the URI for better error messages
    const projectMatch = uri?.match(/^qa-guardian:\/\/projects\/([^/]+)$/);
    const testRunMatch = uri?.match(/^qa-guardian:\/\/test-runs\/([^/]+)/);

    if (is404) {
      // Provide specific "not found" error with resource context
      if (projectMatch) {
        return resourceNotFoundError('Project', projectMatch[1], request.id, log);
      } else if (testRunMatch) {
        return resourceNotFoundError('Test run', testRunMatch[1], request.id, log);
      } else {
        // Generic 404
        return {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32001, // Resource not found
            message: 'Resource not found',
            data: {
              requestedUri: uri,
              availablePatterns: RESOURCE_PATTERNS,
            },
          },
        };
      }
    }

    // Audit log failed resource read
    sendAuditLog({
      method: 'resources/read',
      resource_uri: uri,
      response_type: 'error',
      response_error_code: is404 ? -32001 : -32000,
      response_error_message: errorMessage,
    });

    // Non-404 error
    return {
      jsonrpc: '2.0',
      id: request.id,
      error: {
        code: -32000,
        message: errorMessage,
      },
    };
  }
}

/**
 * Handle static resource URIs.
 * Returns null if the URI is not recognized.
 */
async function handleStaticResource(
  uri: string,
  callApi: ApiCaller
): Promise<unknown | null> {
  switch (uri) {
    case 'qa-guardian://projects':
      return await callApi('/api/v1/projects');

    case 'qa-guardian://recent-runs':
      return await callApi('/api/v1/runs?limit=20');

    case 'qa-guardian://dashboard-stats':
      return await callApi('/api/v1/dashboard/stats');

    case 'qa-guardian://security/vulnerabilities':
      return await callApi('/api/v1/security/vulnerabilities');

    case 'qa-guardian://security/trends':
      return await callApi('/api/v1/security/trends');

    case 'qa-guardian://alerts/active':
      try {
        return await callApi('/api/v1/monitoring/alerts?status=active');
      } catch {
        // Return simulated empty alerts if endpoint not available
        return {
          alerts: [],
          total: 0,
          message: 'No active alerts',
        };
      }

    case 'qa-guardian://incidents':
      try {
        return await callApi('/api/v1/incidents');
      } catch {
        // Return simulated empty incidents if endpoint not available
        return {
          incidents: [],
          total: 0,
          message: 'No active incidents',
        };
      }

    case 'qa-guardian://analytics/dashboard':
      try {
        // Aggregate data from multiple analytics endpoints
        const [failingTests, browserStats, passRateTrends] = await Promise.all([
          callApi('/api/v1/analytics/failing-tests').catch(() => ({ tests: [] })),
          callApi('/api/v1/analytics/browser-stats').catch(() => ({ browsers: [] })),
          callApi('/api/v1/analytics/pass-rate-trends').catch(() => ({ trends: [] })),
        ]);
        return {
          summary: {
            total_tests: 0,
            passing_tests: 0,
            failing_tests: (failingTests as { tests: unknown[] }).tests?.length || 0,
            pass_rate: 0,
          },
          browser_stats: browserStats,
          pass_rate_trends: passRateTrends,
          failing_tests: failingTests,
        };
      } catch {
        return {
          summary: { total_tests: 0, passing_tests: 0, failing_tests: 0, pass_rate: 0 },
          browser_stats: { browsers: [] },
          pass_rate_trends: { trends: [] },
          failing_tests: { tests: [] },
        };
      }

    default:
      return null;
  }
}
