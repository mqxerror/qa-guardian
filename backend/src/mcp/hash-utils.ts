/**
 * QA Guardian MCP Hash Utilities
 *
 * Feature #1356: Extracted from server.ts to reduce file size.
 * Contains pure utility functions for hashing and request signatures.
 */

/**
 * Internal parameters that should be excluded from idempotency hashing
 * These are control parameters that don't affect the actual operation
 */
const IDEMPOTENCY_EXCLUDED_PARAMS = [
  '_idempotencyKey',
  '_stream',
  '_callback',
  '_priority',
];

/**
 * Generate a simple hash from a string using bitwise operations
 * This is a fast, non-cryptographic hash suitable for request deduplication
 */
export function simpleHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

/**
 * Generate request hash for idempotency comparison
 * Removes internal control parameters before hashing
 */
export function generateRequestHash(toolName: string, args: Record<string, unknown>): string {
  // Remove internal parameters that shouldn't affect idempotency
  const cleanArgs: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (!IDEMPOTENCY_EXCLUDED_PARAMS.includes(key)) {
      cleanArgs[key] = value;
    }
  }

  const content = JSON.stringify({ tool: toolName, args: cleanArgs });
  return simpleHash(content);
}

/**
 * Clean arguments by removing internal control parameters
 */
export function cleanArgsForHashing(args: Record<string, unknown>): Record<string, unknown> {
  const cleanArgs: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (!IDEMPOTENCY_EXCLUDED_PARAMS.includes(key)) {
      cleanArgs[key] = value;
    }
  }
  return cleanArgs;
}

/**
 * Generate a unique stream ID
 */
export function generateStreamId(): string {
  return `stream-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate a unique operation ID for tracking
 */
export function generateOperationId(requestId: string | number | undefined, toolName: string): string {
  return `${requestId || Date.now()}-${toolName}`;
}
