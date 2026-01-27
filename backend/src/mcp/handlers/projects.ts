/**
 * Project Tool Handlers
 *
 * Handlers for project management MCP tools.
 * Extracted from server.ts to reduce file size (Feature #1356).
 */

import { ToolHandler, HandlerModule } from './types';

/**
 * List all projects in the organization
 */
export const listProjects: ToolHandler = async (args, context) => {
  return await context.callApi('/api/v1/projects', args);
};

/**
 * Get details of a specific project
 */
export const getProject: ToolHandler = async (args, context) => {
  return await context.callApi(`/api/v1/projects/${args.project_id}`);
};

/**
 * Create a new project (Feature #859)
 */
export const createProject: ToolHandler = async (args, context) => {
  return await context.callApi('/api/v1/projects', {
    method: 'POST',
    body: {
      name: args.name,
      description: args.description,
      repository_url: args.repository_url,
      default_branch: args.default_branch || 'main',
      test_types: args.test_types,
    },
  });
};

/**
 * Update an existing project (Feature #860)
 */
export const updateProject: ToolHandler = async (args, context) => {
  return await context.callApi(`/api/v1/projects/${args.project_id}`, {
    method: 'PATCH',
    body: {
      name: args.name,
      description: args.description,
      repository_url: args.repository_url,
      default_branch: args.default_branch,
      default_browser: args.default_browser,
      default_timeout: args.default_timeout,
      status: args.status,
    },
  });
};

/**
 * Delete a project (Feature #861)
 */
export const deleteProject: ToolHandler = async (args, context) => {
  // Require confirmation to prevent accidental deletion
  if (args.confirm !== true) {
    return {
      error: 'Deletion requires confirm=true parameter',
      hint: 'This is a safety check. Set confirm: true to delete the project.',
    };
  }
  await context.callApi(`/api/v1/projects/${args.project_id}`, {
    method: 'DELETE',
  });
  return {
    deleted: true,
    project_id: args.project_id,
    message: 'Project deleted successfully',
  };
};

// Handler registry for project tools
export const handlers: Record<string, ToolHandler> = {
  list_projects: listProjects,
  get_project: getProject,
  create_project: createProject,
  update_project: updateProject,
  delete_project: deleteProject,
};

// List of tool names this module handles
export const toolNames = Object.keys(handlers);

// Export as a handler module
export const projectHandlers: HandlerModule = {
  handlers,
  toolNames,
};

export default projectHandlers;
