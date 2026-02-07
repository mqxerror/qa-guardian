/**
 * MCP Batch Operations Module
 *
 * Handles batch tool call execution for the MCP server.
 * Extracted from server.ts to reduce file size (Feature #252).
 *
 * @module mcp-batch
 */

import {
  MCPRequest,
  MCPResponse,
  BatchOperationItem,
  BatchOperationResult,
  BatchResponse,
} from './mcp-types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Logger function type
 */
export type LogFunction = (message: string) => void;

/**
 * Tool call handler function type
 */
export type ToolCallHandler = (request: MCPRequest) => Promise<MCPResponse>;

/**
 * Tool permission checker function type
 */
export type ToolPermissionChecker = (toolName: string) => boolean;

/**
 * Tool existence checker function type
 */
export type ToolExistenceChecker = (toolName: string) => boolean;

/**
 * Context for batch operations
 */
export interface BatchContext {
  handleToolsCall: ToolCallHandler;
  isKnownTool: ToolExistenceChecker;
  hasToolPermission: ToolPermissionChecker;
  log: LogFunction;
  addApiVersionWarnings: (response: MCPResponse, version: string) => MCPResponse;
  requestApiVersion: string;
}

/**
 * Batch request params
 */
export interface BatchRequestParams {
  operations: BatchOperationItem[];
  parallel?: boolean;
  stopOnError?: boolean;
}

// ============================================================================
// Batch Execution
// ============================================================================

/**
 * Handle batch tool calls.
 */
export async function handleToolsCallBatch(
  request: MCPRequest,
  context: BatchContext
): Promise<MCPResponse> {
  const params = request.params as unknown as BatchRequestParams;

  const operations = params?.operations;
  const parallel = params?.parallel ?? false;
  const stopOnError = params?.stopOnError ?? false;

  // Validate batch request
  if (!operations || !Array.isArray(operations)) {
    return {
      jsonrpc: '2.0',
      id: request.id,
      error: {
        code: -32602,
        message: 'Invalid params: operations array is required',
        data: {
          expected: 'operations: BatchOperationItem[]',
          received: typeof operations,
        },
      },
    };
  }

  if (operations.length === 0) {
    return {
      jsonrpc: '2.0',
      id: request.id,
      error: {
        code: -32602,
        message: 'Invalid params: operations array cannot be empty',
      },
    };
  }

  if (operations.length > 50) {
    return {
      jsonrpc: '2.0',
      id: request.id,
      error: {
        code: -32602,
        message: 'Invalid params: maximum 50 operations per batch',
        data: {
          maxOperations: 50,
          received: operations.length,
        },
      },
    };
  }

  const batchId = `batch-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const batchStartTime = Date.now();
  const results: BatchOperationResult[] = [];
  let succeeded = 0;
  let failed = 0;

  context.log(`[BATCH] Starting batch ${batchId} with ${operations.length} operations (parallel: ${parallel})`);

  // Execute operations
  const executeOperation = async (op: BatchOperationItem): Promise<BatchOperationResult> => {
    const opStartTime = Date.now();
    const operationId = op.id ?? `op-${Math.random().toString(36).substring(2, 9)}`;

    // Validate operation
    if (!op.name || typeof op.name !== 'string') {
      return {
        id: operationId,
        status: 'error',
        error: { code: -32602, message: 'Invalid operation: name is required' },
        duration_ms: Date.now() - opStartTime,
      };
    }

    // Check if tool exists
    if (!context.isKnownTool(op.name)) {
      return {
        id: operationId,
        status: 'error',
        error: { code: -32601, message: `Unknown tool: ${op.name}` },
        duration_ms: Date.now() - opStartTime,
      };
    }

    // Check tool permission
    if (!context.hasToolPermission(op.name)) {
      return {
        id: operationId,
        status: 'error',
        error: { code: -32003, message: `Permission denied for tool: ${op.name}` },
        duration_ms: Date.now() - opStartTime,
      };
    }

    try {
      // Create a synthetic request for the tool call
      const toolRequest: MCPRequest = {
        jsonrpc: '2.0',
        id: `${batchId}-${operationId}`,
        method: 'tools/call',
        params: {
          name: op.name,
          arguments: op.arguments || {},
        },
      };

      // Call the tool
      const response = await context.handleToolsCall(toolRequest);
      const duration = Date.now() - opStartTime;

      if (response.error) {
        return {
          id: operationId,
          status: 'error',
          error: {
            code: response.error.code,
            message: response.error.message,
          },
          duration_ms: duration,
        };
      }

      return {
        id: operationId,
        status: 'success',
        result: response.result,
        duration_ms: duration,
      };
    } catch (error) {
      return {
        id: operationId,
        status: 'error',
        error: {
          code: -32000,
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        duration_ms: Date.now() - opStartTime,
      };
    }
  };

  if (parallel) {
    // Execute all operations in parallel
    const operationPromises = operations.map(executeOperation);
    const operationResults = await Promise.all(operationPromises);

    for (const result of operationResults) {
      results.push(result);
      if (result.status === 'success') {
        succeeded++;
      } else {
        failed++;
      }
    }
  } else {
    // Execute operations sequentially
    for (const op of operations) {
      const result = await executeOperation(op);
      results.push(result);

      if (result.status === 'success') {
        succeeded++;
      } else {
        failed++;
        if (stopOnError) {
          context.log(`[BATCH] Stopping batch ${batchId} due to error on operation ${result.id}`);
          break;
        }
      }
    }
  }

  const batchDuration = Date.now() - batchStartTime;
  context.log(`[BATCH] Completed batch ${batchId}: ${succeeded} succeeded, ${failed} failed in ${batchDuration}ms`);

  const batchResponse: BatchResponse = {
    batchId,
    totalOperations: operations.length,
    succeeded,
    failed,
    results,
    duration_ms: batchDuration,
  };

  const batchMcpResponse: MCPResponse = {
    jsonrpc: '2.0',
    id: request.id,
    result: {
      content: [
        {
          type: 'text',
          text: JSON.stringify(batchResponse, null, 2),
        },
      ],
      _batch: batchResponse,
    },
  };

  // Add version warnings to batch response
  return context.addApiVersionWarnings(batchMcpResponse, context.requestApiVersion);
}
