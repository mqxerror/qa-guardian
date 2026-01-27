/**
 * MCP Tool Handler Types
 *
 * Type definitions for the handler registry pattern.
 * This enables extracting tool handlers from the massive server.ts switch statement.
 */

/**
 * Context passed to every tool handler
 */
export interface HandlerContext {
  /** Call the QA Guardian API with authentication */
  callApi: (endpoint: string, options?: ApiCallOptions) => Promise<unknown>;
  /** Call the QA Guardian API without authentication (for public endpoints) */
  callApiPublic: (endpoint: string) => Promise<unknown>;
  /** Log a message */
  log: (message: string) => void;
  /** The API key if configured */
  apiKey?: string;
  /** The API URL */
  apiUrl: string;
}

/**
 * Options for API calls
 */
export interface ApiCallOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Result from a tool handler
 */
export type HandlerResult = unknown;

/**
 * Tool handler function signature
 */
export type ToolHandler = (
  args: Record<string, unknown>,
  context: HandlerContext
) => Promise<HandlerResult>;

/**
 * Registry of tool handlers by name
 */
export type HandlerRegistry = Map<string, ToolHandler>;

/**
 * Module that exports handlers for a category of tools
 */
export interface HandlerModule {
  /** Map of tool name to handler function */
  handlers: Record<string, ToolHandler>;
  /** List of tool names this module handles */
  toolNames: string[];
}
