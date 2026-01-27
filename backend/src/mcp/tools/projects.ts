/**
 * Project Management Tools
 *
 * MCP tools for managing projects in QA Guardian.
 */

import { ToolDefinition } from '../types';

export const PROJECT_TOOLS: ToolDefinition[] = [
  {
    name: 'list_projects',
    description: 'List all projects in the organization',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of projects to return',
          default: 50,
        },
        offset: {
          type: 'number',
          description: 'Number of projects to skip',
          default: 0,
        },
      },
    },
  },
  {
    name: 'get_project',
    description: 'Get details of a specific project',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The ID of the project',
        },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'create_project',
    description: 'Create a new project in the organization. Returns the created project with its ID.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the project (required)',
        },
        description: {
          type: 'string',
          description: 'Description of the project',
        },
        repository_url: {
          type: 'string',
          description: 'Git repository URL for the project',
        },
        default_branch: {
          type: 'string',
          description: 'Default branch name (e.g., "main" or "master")',
          default: 'main',
        },
        test_types: {
          type: 'array',
          items: { type: 'string' },
          description: 'Types of tests to enable (e.g., ["e2e", "api", "visual"])',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'update_project',
    description: 'Update an existing project\'s settings. Returns the updated project.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The ID of the project to update (required)',
        },
        name: {
          type: 'string',
          description: 'New name for the project',
        },
        description: {
          type: 'string',
          description: 'New description for the project',
        },
        repository_url: {
          type: 'string',
          description: 'Git repository URL',
        },
        default_branch: {
          type: 'string',
          description: 'Default branch name',
        },
        default_browser: {
          type: 'string',
          enum: ['chromium', 'firefox', 'webkit'],
          description: 'Default browser for test execution',
        },
        default_timeout: {
          type: 'number',
          description: 'Default test timeout in milliseconds',
        },
        status: {
          type: 'string',
          enum: ['active', 'archived'],
          description: 'Project status',
        },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'delete_project',
    description: 'Delete a project. This action is irreversible. Returns confirmation of deletion.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The ID of the project to delete (required)',
        },
        confirm: {
          type: 'boolean',
          description: 'Must be true to confirm deletion (required)',
        },
      },
      required: ['project_id', 'confirm'],
    },
  },
];

// List of project tool names for handler mapping
export const PROJECT_TOOL_NAMES = PROJECT_TOOLS.map(t => t.name);
