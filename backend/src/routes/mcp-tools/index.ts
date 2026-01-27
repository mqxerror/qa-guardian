/**
 * MCP Tools Execution Module
 *
 * Provides REST API endpoints to execute MCP tool handlers directly.
 * This enables the frontend (MCP Chat) to call real AI-powered tools
 * instead of using mock/template responses.
 */

export { default } from './routes';
export * from './types';
