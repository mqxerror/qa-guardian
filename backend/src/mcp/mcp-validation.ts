/**
 * MCP Validation Module
 *
 * Handles parameter validation for tool calls.
 * Extracted from server.ts to reduce file size (Feature #252).
 *
 * @module mcp-validation
 */

import { MCPResponse } from './mcp-types.js';
import { TOOLS } from './tool-definitions.js';
import {
  findMissingRequiredParams,
  validateParameterTypes,
} from './validation-utils.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Logger function type
 */
export type LogFunction = (message: string) => void;

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  error?: MCPResponse;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate required parameters for a tool call.
 */
export function validateRequiredParams(
  toolName: string,
  toolArgs: Record<string, unknown>,
  log?: LogFunction
): ValidationResult {
  // Find the tool definition
  const tool = TOOLS.find(t => t.name === toolName);
  if (!tool) {
    return { valid: true }; // Unknown tool handled elsewhere
  }

  const schema = tool.inputSchema;
  const requiredParams = schema?.required as string[] | undefined;
  if (!requiredParams || requiredParams.length === 0) {
    return { valid: true }; // No required params
  }

  // Use extracted utility to find missing params
  const properties = schema?.properties as Record<string, { description?: string }> | undefined;
  const missingParams = findMissingRequiredParams(toolArgs, requiredParams, properties);

  if (missingParams.length === 0) {
    return { valid: true };
  }

  // Build error message
  const paramNames = missingParams.map(p => p.name);
  const errorMessage = missingParams.length === 1
    ? `Missing required parameter: ${paramNames[0]}`
    : `Missing required parameters: ${paramNames.join(', ')}`;

  // Build detailed data with descriptions
  const missingDetails = missingParams.map(p => ({
    parameter: p.name,
    description: p.description || 'No description available',
  }));

  log?.(`[ERROR] Missing required parameters for tool '${toolName}': ${paramNames.join(', ')}`);

  return {
    valid: false,
    error: {
      jsonrpc: '2.0',
      error: {
        code: -32602, // Invalid params (400 Bad Request equivalent)
        message: errorMessage,
        data: {
          tool: toolName,
          missingParameters: missingDetails,
        },
      },
    },
  };
}

/**
 * Validate parameter types for a tool call.
 */
export function validateParamTypes(
  toolName: string,
  toolArgs: Record<string, unknown>,
  log?: LogFunction
): ValidationResult {
  // Find the tool definition
  const tool = TOOLS.find(t => t.name === toolName);
  if (!tool) {
    return { valid: true }; // Unknown tool handled elsewhere
  }

  const schema = tool.inputSchema;
  const properties = schema?.properties as Record<string, { type?: string; enum?: unknown[]; description?: string }> | undefined;
  if (!properties) {
    return { valid: true }; // No properties defined
  }

  // Use extracted utility to validate parameter types
  const typeErrors = validateParameterTypes(toolArgs, properties);

  if (typeErrors.length === 0) {
    return { valid: true };
  }

  // Build error message
  const errorMessage = typeErrors.length === 1
    ? `Invalid type for ${typeErrors[0].parameter}: expected ${typeErrors[0].expectedType}, got ${typeErrors[0].actualType}`
    : `Invalid types for parameters: ${typeErrors.map(e => e.parameter).join(', ')}`;

  log?.(`[ERROR] Invalid parameter types for tool '${toolName}': ${typeErrors.map(e => `${e.parameter} (expected ${e.expectedType}, got ${e.actualType})`).join(', ')}`);

  return {
    valid: false,
    error: {
      jsonrpc: '2.0',
      error: {
        code: -32602, // Invalid params (400 Bad Request equivalent)
        message: errorMessage,
        data: {
          tool: toolName,
          invalidParameters: typeErrors,
        },
      },
    },
  };
}
