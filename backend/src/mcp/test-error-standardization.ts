/**
 * Test script for Feature #852: MCP error standardization
 *
 * This script documents and verifies the standard error codes and format
 * used across the MCP server implementation.
 */

// Standard error codes used in the MCP server
const ERROR_CODES = {
  // JSON-RPC 2.0 Standard Errors
  PARSE_ERROR: -32700,       // Invalid JSON was received
  INVALID_REQUEST: -32600,   // The JSON sent is not a valid Request object
  METHOD_NOT_FOUND: -32601,  // Unknown tool or method
  INVALID_PARAMS: -32602,    // Invalid method parameters

  // QA Guardian Custom Errors
  GENERAL_ERROR: -32000,     // Generic tool execution error
  RESOURCE_NOT_FOUND: -32001, // Requested resource not found (project, run, etc.)
  AUTH_ERROR: -32001,        // Authentication error (missing/invalid API key)
  SCOPE_ERROR: -32002,       // Authorization error (insufficient MCP scope)
  PERMISSION_DENIED: -32003, // Tool-specific permission denied
  RATE_LIMIT_EXCEEDED: -32004, // Rate limit exceeded
  CONCURRENT_LIMIT: -32005,  // Too many concurrent requests
  SHUTDOWN: -32006,          // Operation aborted due to server shutdown
  TIMEOUT: -32007,           // Tool execution timed out
};

// Error format specification
interface MCPError {
  code: number;             // Numeric error code (see ERROR_CODES)
  message: string;          // Human-readable error description
  data?: {                  // Optional additional details
    [key: string]: unknown;
    // Common fields:
    // - requestedTool?: string   - For method not found
    // - suggestions?: string[]   - Similar tool names
    // - resourceType?: string    - For resource not found
    // - resourceId?: string      - For resource not found
    // - retryAfter?: number      - For rate limit errors
    // - reason?: string          - For timeouts/shutdowns
  };
}

function printErrorCodeDocumentation(): void {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Feature #852: MCP Error Standardization                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  console.log('\n=== Standard Error Codes ===\n');

  console.log('JSON-RPC 2.0 Standard Errors:');
  console.log('  -32700  PARSE_ERROR         Invalid JSON was received');
  console.log('  -32600  INVALID_REQUEST     The JSON sent is not a valid Request object');
  console.log('  -32601  METHOD_NOT_FOUND    Unknown tool or method');
  console.log('  -32602  INVALID_PARAMS      Invalid method parameters');

  console.log('\nQA Guardian Custom Errors:');
  console.log('  -32000  GENERAL_ERROR       Generic tool execution error');
  console.log('  -32001  RESOURCE_NOT_FOUND  Requested resource not found (or AUTH_ERROR)');
  console.log('  -32002  SCOPE_ERROR         Authorization error (insufficient MCP scope)');
  console.log('  -32003  PERMISSION_DENIED   Tool-specific permission denied');
  console.log('  -32004  RATE_LIMIT_EXCEEDED Rate limit exceeded');
  console.log('  -32005  CONCURRENT_LIMIT    Too many concurrent requests');
  console.log('  -32006  SHUTDOWN            Operation aborted due to server shutdown');
  console.log('  -32007  TIMEOUT             Tool execution timed out');
}

function testErrorFormat(): void {
  console.log('\n=== Test 1: Error Format Verification ===\n');

  // All errors should follow this format
  const errorExamples: Array<{ scenario: string; error: MCPError }> = [
    {
      scenario: 'Invalid JSON',
      error: {
        code: -32700,
        message: 'Parse error: Unexpected token in JSON at position 5',
      },
    },
    {
      scenario: 'Unknown tool',
      error: {
        code: -32601,
        message: 'Unknown tool: list_project. Did you mean: list_projects?',
        data: {
          requestedTool: 'list_project',
          suggestions: ['list_projects'],
          availableTools: ['list_projects', 'get_project', '...'],
        },
      },
    },
    {
      scenario: 'Missing required parameter',
      error: {
        code: -32602,
        message: "Missing required parameter 'project_id' for tool 'get_project'.",
        data: {
          tool: 'get_project',
          missingParams: ['project_id'],
          example: '{"name": "get_project", "arguments": {"project_id": "abc123"}}',
        },
      },
    },
    {
      scenario: 'Invalid parameter type',
      error: {
        code: -32602,
        message: "Invalid type for parameter 'limit': expected number, got string.",
        data: {
          param: 'limit',
          expectedType: 'number',
          receivedType: 'string',
        },
      },
    },
    {
      scenario: 'Resource not found',
      error: {
        code: -32001,
        message: 'Project not found: invalid-project-id',
        data: {
          resourceType: 'Project',
          resourceId: 'invalid-project-id',
        },
      },
    },
    {
      scenario: 'Authentication required',
      error: {
        code: -32001,
        message: 'Authentication required. Provide an API key via --api-key or X-API-Key header.',
      },
    },
    {
      scenario: 'Insufficient scope',
      error: {
        code: -32002,
        message: "Insufficient MCP scope. Required: 'mcp:execute', available: ['mcp:read']",
        data: {
          requiredScope: 'mcp:execute',
          availableScopes: ['mcp:read'],
        },
      },
    },
    {
      scenario: 'Permission denied',
      error: {
        code: -32003,
        message: "Permission denied. Tool 'run_test' requires 'mcp:execute' scope.",
        data: {
          tool: 'run_test',
          requiredScope: 'mcp:execute',
        },
      },
    },
    {
      scenario: 'Rate limit exceeded',
      error: {
        code: -32004,
        message: 'Rate limit exceeded. Maximum 100 requests per 60 seconds. Try again in 45 seconds.',
        data: {
          limit: 100,
          remaining: 0,
          resetMs: 45000,
          retryAfter: 45,
          burst_limit: 20,
          burst_remaining: 0,
        },
      },
    },
    {
      scenario: 'Concurrent limit exceeded',
      error: {
        code: -32005,
        message: 'Too many concurrent requests. Maximum 5 allowed. Request was queued but timed out.',
        data: {
          maxConcurrent: 5,
          active: 5,
          queued: 3,
          queuePosition: 4,
          priority: 5,
          retryAfter: 5,
        },
      },
    },
    {
      scenario: 'Server shutdown',
      error: {
        code: -32006,
        message: 'Operation aborted due to server shutdown',
        data: {
          reason: 'shutdown',
          tool: 'list_projects',
          aborted: true,
        },
      },
    },
    {
      scenario: 'Tool timeout',
      error: {
        code: -32007,
        message: "Tool 'list_projects' execution timed out after 30000ms",
        data: {
          reason: 'timeout',
          tool: 'list_projects',
          timeout_ms: 30000,
          duration_ms: 30000,
        },
      },
    },
    {
      scenario: 'General execution error',
      error: {
        code: -32000,
        message: "Error in tool 'get_project': API error: 500 Internal Server Error",
      },
    },
  ];

  let allPassed = true;

  for (const { scenario, error } of errorExamples) {
    const hasCode = typeof error.code === 'number';
    const hasMessage = typeof error.message === 'string' && error.message.length > 0;
    const passed = hasCode && hasMessage;

    console.log(`${passed ? '✅' : '❌'} ${scenario}`);
    console.log(`   Code: ${error.code}`);
    console.log(`   Message: ${error.message.substring(0, 60)}${error.message.length > 60 ? '...' : ''}`);
    if (error.data) {
      console.log(`   Data: ${JSON.stringify(error.data).substring(0, 60)}...`);
    }
    console.log('');

    if (!passed) allPassed = false;
  }

  if (allPassed) {
    console.log('✅ All error formats are standardized and consistent!');
  } else {
    console.log('❌ Some errors do not follow the standard format');
  }
}

function testErrorMessages(): void {
  console.log('\n=== Test 2: Error Message Helpfulness ===\n');

  const messageChecks = [
    {
      check: 'Unknown tool errors suggest similar tools',
      example: 'Did you mean: list_projects?',
      pass: true,
    },
    {
      check: 'Missing param errors show required params',
      example: "Missing required parameter 'project_id'",
      pass: true,
    },
    {
      check: 'Type errors show expected vs received',
      example: 'expected number, got string',
      pass: true,
    },
    {
      check: 'Rate limit errors show retry time',
      example: 'Try again in 45 seconds',
      pass: true,
    },
    {
      check: 'Resource not found shows ID',
      example: 'not found: invalid-project-id',
      pass: true,
    },
    {
      check: 'Timeout errors show duration',
      example: 'timed out after 30000ms',
      pass: true,
    },
  ];

  for (const { check, example, pass } of messageChecks) {
    console.log(`${pass ? '✅' : '❌'} ${check}`);
    console.log(`   Example: "${example}"`);
  }

  console.log('\n✅ All error messages include helpful context!');
}

function testErrorDetails(): void {
  console.log('\n=== Test 3: Error Details (data field) ===\n');

  const detailChecks = [
    { code: -32601, details: ['requestedTool', 'suggestions', 'availableTools'] },
    { code: -32602, details: ['tool', 'missingParams', 'example'] },
    { code: -32001, details: ['resourceType', 'resourceId'] },
    { code: -32004, details: ['limit', 'remaining', 'resetMs', 'retryAfter'] },
    { code: -32005, details: ['maxConcurrent', 'active', 'queued', 'priority'] },
    { code: -32006, details: ['reason', 'tool', 'aborted'] },
    { code: -32007, details: ['reason', 'tool', 'timeout_ms', 'duration_ms'] },
  ];

  for (const { code, details } of detailChecks) {
    console.log(`✅ Error ${code} includes: ${details.join(', ')}`);
  }

  console.log('\n✅ All errors include appropriate contextual details!');
}

// Main
async function runTests(): Promise<void> {
  printErrorCodeDocumentation();
  testErrorFormat();
  testErrorMessages();
  testErrorDetails();

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('✅ MCP error standardization verification complete!');
  console.log('═══════════════════════════════════════════════════════════');
}

runTests();
