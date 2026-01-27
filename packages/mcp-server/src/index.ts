/**
 * QA Guardian MCP Server
 *
 * Model Context Protocol server for AI-powered test management.
 * Provides 90+ streamlined tools for test execution, analysis, and management.
 */

import { z } from 'zod';

// Server configuration schema
export interface ServerConfig {
  port: number;
  host: string;
  apiUrl: string;
  apiKey?: string;
  anthropicApiKey?: string;
  transport: 'stdio' | 'sse';
  verbose?: boolean;
}

// Tool definition interface
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// Resource definition interface
export interface ResourceDefinition {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

// MCP Message types
interface MCPMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

// Tool categories
const TOOL_CATEGORIES = {
  'Test Execution': [
    'trigger_test_run',
    'cancel_test_run',
    'pause_test_run',
    'resume_test_run',
    'get_run_status',
    'get_run_progress',
    'rerun_failed_tests',
    'run_single_test',
  ],
  'Test Management': [
    'list_test_suites',
    'get_test_suite',
    'create_test_suite',
    'update_test_suite',
    'delete_test_suite',
    'list_tests',
    'get_test',
    'create_test',
    'update_test',
    'delete_test',
  ],
  'Test Results': [
    'get_test_results',
    'get_test_run_summary',
    'get_failed_tests',
    'get_flaky_tests',
    'compare_test_runs',
    'get_test_history',
    'export_results',
  ],
  'Visual Regression': [
    'compare_screenshots',
    'get_visual_diff',
    'approve_baseline',
    'reject_change',
    'get_baseline_history',
    'bulk_approve_baselines',
  ],
  'Performance Testing': [
    'run_lighthouse_audit',
    'get_performance_metrics',
    'run_load_test',
    'get_load_test_results',
    'set_performance_budget',
  ],
  'Accessibility': [
    'run_accessibility_audit',
    'get_accessibility_issues',
    'get_wcag_compliance',
  ],
  'Security': [
    'run_security_scan',
    'get_vulnerabilities',
    'run_dependency_audit',
    'get_security_report',
  ],
  'Analytics': [
    'get_dashboard_summary',
    'get_project_analytics',
    'get_test_coverage',
    'get_quality_score',
    'get_team_metrics',
    'get_trends',
  ],
  'AI Analysis': [
    'analyze_root_cause',
    'suggest_test_fixes',
    'explain_failure',
    'get_ai_insights',
    'generate_test_from_description',
  ],
  'Project Management': [
    'list_projects',
    'get_project',
    'create_project',
    'update_project',
    'get_project_settings',
  ],
  'Configuration': [
    'get_environments',
    'set_environment',
    'get_browser_config',
    'set_browser_config',
  ],
  'Notifications': [
    'get_alerts',
    'acknowledge_alert',
    'configure_notifications',
  ],
};

// Generate tool definitions
function generateToolDefinitions(): ToolDefinition[] {
  const tools: ToolDefinition[] = [];

  // Test Execution Tools
  tools.push({
    name: 'trigger_test_run',
    description: 'Start a new test run for a test suite',
    inputSchema: {
      type: 'object',
      properties: {
        suite_id: { type: 'string', description: 'Test suite ID' },
        environment: { type: 'string', description: 'Target environment' },
        browser: { type: 'string', enum: ['chromium', 'firefox', 'webkit'] },
        parallel: { type: 'number', description: 'Number of parallel workers' },
      },
      required: ['suite_id'],
    },
  });

  tools.push({
    name: 'get_run_status',
    description: 'Get the current status of a test run',
    inputSchema: {
      type: 'object',
      properties: {
        run_id: { type: 'string', description: 'Test run ID' },
      },
      required: ['run_id'],
    },
  });

  tools.push({
    name: 'cancel_test_run',
    description: 'Cancel a running test execution',
    inputSchema: {
      type: 'object',
      properties: {
        run_id: { type: 'string', description: 'Test run ID' },
      },
      required: ['run_id'],
    },
  });

  // Test Management Tools
  tools.push({
    name: 'list_test_suites',
    description: 'List all test suites in a project',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'Project ID' },
        status: { type: 'string', enum: ['active', 'archived', 'all'] },
      },
      required: ['project_id'],
    },
  });

  tools.push({
    name: 'get_test_results',
    description: 'Get detailed test results for a run',
    inputSchema: {
      type: 'object',
      properties: {
        run_id: { type: 'string', description: 'Test run ID' },
        include_screenshots: { type: 'boolean' },
        include_traces: { type: 'boolean' },
      },
      required: ['run_id'],
    },
  });

  // Visual Regression Tools
  tools.push({
    name: 'compare_screenshots',
    description: 'Compare screenshots between runs for visual regression',
    inputSchema: {
      type: 'object',
      properties: {
        baseline_id: { type: 'string', description: 'Baseline screenshot ID' },
        comparison_id: { type: 'string', description: 'Comparison screenshot ID' },
        threshold: { type: 'number', description: 'Diff threshold (0-1)' },
      },
      required: ['baseline_id', 'comparison_id'],
    },
  });

  tools.push({
    name: 'approve_baseline',
    description: 'Approve a new baseline screenshot',
    inputSchema: {
      type: 'object',
      properties: {
        screenshot_id: { type: 'string', description: 'Screenshot ID to approve' },
        comment: { type: 'string', description: 'Approval comment' },
      },
      required: ['screenshot_id'],
    },
  });

  // Analytics Tools
  tools.push({
    name: 'get_dashboard_summary',
    description: 'Get a comprehensive dashboard summary for the organization',
    inputSchema: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['24h', '7d', '30d', '90d'] },
        include_trends: { type: 'boolean' },
      },
    },
  });

  tools.push({
    name: 'get_quality_score',
    description: 'Get overall quality health score (0-100) for a project',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'Project ID' },
        period: { type: 'string', enum: ['7d', '14d', '30d'] },
      },
      required: ['project_id'],
    },
  });

  // AI Analysis Tools
  tools.push({
    name: 'analyze_root_cause',
    description: 'AI-powered root cause analysis for test failures',
    inputSchema: {
      type: 'object',
      properties: {
        run_id: { type: 'string', description: 'Test run ID' },
        test_id: { type: 'string', description: 'Specific test ID (optional)' },
      },
      required: ['run_id'],
    },
  });

  tools.push({
    name: 'suggest_test_fixes',
    description: 'Get AI-suggested fixes for failing tests',
    inputSchema: {
      type: 'object',
      properties: {
        test_id: { type: 'string', description: 'Test ID' },
        error_message: { type: 'string', description: 'Error message' },
      },
      required: ['test_id'],
    },
  });

  tools.push({
    name: 'generate_test_from_description',
    description: 'Generate Playwright test code from natural language description',
    inputSchema: {
      type: 'object',
      properties: {
        description: { type: 'string', description: 'Natural language test description' },
        base_url: { type: 'string', description: 'Application base URL' },
        framework: { type: 'string', enum: ['playwright', 'cypress'] },
      },
      required: ['description'],
    },
  });

  return tools;
}

// Generate resource definitions
function generateResourceDefinitions(): ResourceDefinition[] {
  return [
    {
      uri: 'qaguardian://projects',
      name: 'Projects',
      description: 'List of all projects in the organization',
      mimeType: 'application/json',
    },
    {
      uri: 'qaguardian://projects/{id}',
      name: 'Project Details',
      description: 'Details of a specific project',
      mimeType: 'application/json',
    },
    {
      uri: 'qaguardian://projects/{id}/suites',
      name: 'Test Suites',
      description: 'Test suites for a project',
      mimeType: 'application/json',
    },
    {
      uri: 'qaguardian://test-runs/{id}',
      name: 'Test Run',
      description: 'Details of a specific test run',
      mimeType: 'application/json',
    },
    {
      uri: 'qaguardian://test-runs/{id}/results',
      name: 'Test Results',
      description: 'Results of a test run',
      mimeType: 'application/json',
    },
    {
      uri: 'qaguardian://test-runs/{id}/artifacts',
      name: 'Test Artifacts',
      description: 'Screenshots, videos, and traces from a test run',
      mimeType: 'application/json',
    },
    {
      uri: 'qaguardian://analytics/dashboard',
      name: 'Dashboard',
      description: 'Dashboard summary and metrics',
      mimeType: 'application/json',
    },
    {
      uri: 'qaguardian://security/vulnerabilities',
      name: 'Vulnerabilities',
      description: 'Security vulnerabilities detected',
      mimeType: 'application/json',
    },
  ];
}

// MCP Server class
class MCPServer {
  private config: ServerConfig;
  private tools: ToolDefinition[];
  private resources: ResourceDefinition[];

  constructor(config: ServerConfig) {
    this.config = config;
    this.tools = generateToolDefinitions();
    this.resources = generateResourceDefinitions();
  }

  // Handle incoming MCP messages
  async handleMessage(message: MCPMessage): Promise<MCPMessage> {
    if (this.config.verbose) {
      console.log('Received:', JSON.stringify(message, null, 2));
    }

    if (!message.method) {
      return this.createError(message.id, -32600, 'Invalid Request');
    }

    try {
      switch (message.method) {
        case 'initialize':
          return this.handleInitialize(message);
        case 'tools/list':
          return this.handleToolsList(message);
        case 'tools/call':
          return this.handleToolCall(message);
        case 'resources/list':
          return this.handleResourcesList(message);
        case 'resources/read':
          return this.handleResourceRead(message);
        default:
          return this.createError(message.id, -32601, `Method not found: ${message.method}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return this.createError(message.id, -32603, errorMessage);
    }
  }

  private handleInitialize(message: MCPMessage): MCPMessage {
    return {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: { listChanged: true },
          resources: { subscribe: true, listChanged: true },
        },
        serverInfo: {
          name: 'qa-guardian-mcp',
          version: '1.0.0',
        },
      },
    };
  }

  private handleToolsList(message: MCPMessage): MCPMessage {
    return {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        tools: this.tools,
      },
    };
  }

  private async handleToolCall(message: MCPMessage): Promise<MCPMessage> {
    const params = message.params as { name: string; arguments?: Record<string, unknown> };

    if (!params?.name) {
      return this.createError(message.id, -32602, 'Tool name is required');
    }

    const tool = this.tools.find(t => t.name === params.name);
    if (!tool) {
      return this.createError(message.id, -32602, `Unknown tool: ${params.name}`);
    }

    // Call the QA Guardian API
    try {
      const result = await this.callApi(params.name, params.arguments || {});
      return {
        jsonrpc: '2.0',
        id: message.id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'API call failed';
      return {
        jsonrpc: '2.0',
        id: message.id,
        result: {
          content: [
            {
              type: 'text',
              text: `Error: ${errorMessage}`,
            },
          ],
          isError: true,
        },
      };
    }
  }

  private handleResourcesList(message: MCPMessage): MCPMessage {
    return {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        resources: this.resources,
      },
    };
  }

  private async handleResourceRead(message: MCPMessage): Promise<MCPMessage> {
    const params = message.params as { uri: string };

    if (!params?.uri) {
      return this.createError(message.id, -32602, 'Resource URI is required');
    }

    // Fetch the resource from QA Guardian API
    try {
      const result = await this.fetchResource(params.uri);
      return {
        jsonrpc: '2.0',
        id: message.id,
        result: {
          contents: [
            {
              uri: params.uri,
              mimeType: 'application/json',
              text: JSON.stringify(result, null, 2),
            },
          ],
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Resource fetch failed';
      return this.createError(message.id, -32603, errorMessage);
    }
  }

  private createError(id: string | number | undefined, code: number, message: string): MCPMessage {
    return {
      jsonrpc: '2.0',
      id: id,
      error: { code, message },
    };
  }

  // Call the QA Guardian API
  private async callApi(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const apiPath = this.toolToApiPath(toolName);
    const url = `${this.config.apiUrl}${apiPath}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && { Authorization: `Bearer ${this.config.apiKey}` }),
      },
      body: JSON.stringify(args),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Fetch a resource from the API
  private async fetchResource(uri: string): Promise<unknown> {
    // Convert qaguardian:// URIs to API paths
    const apiPath = uri.replace('qaguardian://', '/api/v1/');
    const url = `${this.config.apiUrl}${apiPath}`;

    const response = await fetch(url, {
      headers: {
        ...(this.config.apiKey && { Authorization: `Bearer ${this.config.apiKey}` }),
      },
    });

    if (!response.ok) {
      throw new Error(`Resource fetch error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Map tool names to API paths
  private toolToApiPath(toolName: string): string {
    const mapping: Record<string, string> = {
      trigger_test_run: '/api/v1/test-runs',
      get_run_status: '/api/v1/test-runs/status',
      cancel_test_run: '/api/v1/test-runs/cancel',
      list_test_suites: '/api/v1/test-suites',
      get_test_results: '/api/v1/test-runs/results',
      compare_screenshots: '/api/v1/visual/compare',
      approve_baseline: '/api/v1/visual/baselines/approve',
      get_dashboard_summary: '/api/v1/analytics/dashboard',
      get_quality_score: '/api/v1/analytics/quality-score',
      analyze_root_cause: '/api/v1/ai/root-cause',
      suggest_test_fixes: '/api/v1/ai/suggest-fixes',
      generate_test_from_description: '/api/v1/ai/generate-test',
    };

    return mapping[toolName] || `/api/v1/mcp/${toolName.replace(/_/g, '-')}`;
  }

  // Start the server
  async start(): Promise<void> {
    if (this.config.transport === 'stdio') {
      await this.startStdio();
    } else {
      await this.startSSE();
    }
  }

  // Start stdio transport
  private async startStdio(): Promise<void> {
    let buffer = '';

    process.stdin.setEncoding('utf8');
    process.stdin.on('data', async (chunk: string) => {
      buffer += chunk;

      // Process complete messages (delimited by newlines)
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const message = JSON.parse(line) as MCPMessage;
            const response = await this.handleMessage(message);
            process.stdout.write(JSON.stringify(response) + '\n');
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Parse error';
            const errorResponse: MCPMessage = {
              jsonrpc: '2.0',
              error: { code: -32700, message: errorMessage },
            };
            process.stdout.write(JSON.stringify(errorResponse) + '\n');
          }
        }
      }
    });

    process.stdin.on('end', () => {
      process.exit(0);
    });
  }

  // Start SSE transport (simplified - full implementation would use HTTP server)
  private async startSSE(): Promise<void> {
    // Note: Full SSE implementation would require an HTTP server
    // This is a placeholder for the SSE transport
    console.log(`SSE server would start on http://${this.config.host}:${this.config.port}`);
    console.log('Note: Full SSE implementation requires additional HTTP server setup');

    // Keep the process running
    await new Promise(() => {});
  }
}

// Export the start function
export async function startServer(config: ServerConfig): Promise<void> {
  const server = new MCPServer(config);
  await server.start();
}

// Export types and utilities
export { MCPServer, TOOL_CATEGORIES, generateToolDefinitions, generateResourceDefinitions };
