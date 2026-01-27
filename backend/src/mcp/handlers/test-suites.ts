/**
 * Test Suite Tool Handlers
 *
 * Handlers for test suite management MCP tools.
 * Extracted from server.ts to reduce file size (Feature #1356).
 */

import { ToolHandler, HandlerModule } from './types';

/**
 * List all test suites in a project
 */
export const listTestSuites: ToolHandler = async (args, context) => {
  return await context.callApi(`/api/v1/projects/${args.project_id}/suites`, {
    type: args.type,
    name: args.name,
    status: args.status,
    limit: args.limit,
    offset: args.offset,
  });
};

/**
 * Create a new test suite (Feature #862)
 */
export const createTestSuite: ToolHandler = async (args, context) => {
  return await context.callApi(`/api/v1/projects/${args.project_id}/suites`, {
    method: 'POST',
    body: {
      name: args.name,
      type: args.type,
      description: args.description,
      base_url: args.base_url,
      browsers: args.browsers,
      timeout: args.timeout,
      retries: args.retries,
    },
  });
};

/**
 * Update a test suite (Feature #863)
 */
export const updateTestSuite: ToolHandler = async (args, context) => {
  return await context.callApi(`/api/v1/suites/${args.suite_id}`, {
    method: 'PATCH',
    body: {
      name: args.name,
      description: args.description,
      base_url: args.base_url,
      browsers: args.browsers,
      viewports: args.viewports,
      timeout: args.timeout,
      retries: args.retries,
      status: args.status,
    },
  });
};

/**
 * Delete a test suite (Feature #864)
 */
export const deleteTestSuite: ToolHandler = async (args, context) => {
  // Require confirmation to prevent accidental deletion
  if (args.confirm !== true) {
    return {
      error: 'Deletion requires confirm=true parameter',
      hint: 'This is a safety check. Set confirm: true to delete the test suite and all its tests.',
    };
  }
  await context.callApi(`/api/v1/suites/${args.suite_id}`, {
    method: 'DELETE',
  });
  return {
    deleted: true,
    suite_id: args.suite_id,
    message: 'Test suite and all its tests deleted successfully',
  };
};

// Handler registry for test suite tools
export const handlers: Record<string, ToolHandler> = {
  list_test_suites: listTestSuites,
  create_test_suite: createTestSuite,
  update_test_suite: updateTestSuite,
  delete_test_suite: deleteTestSuite,
};

// List of tool names this module handles
export const toolNames = Object.keys(handlers);

// Export as a handler module
export const testSuiteHandlers: HandlerModule = {
  handlers,
  toolNames,
};

export default testSuiteHandlers;
