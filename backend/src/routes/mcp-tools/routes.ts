/**
 * MCP Tools Execution Routes
 *
 * Provides REST API endpoints for executing MCP tool handlers.
 * This enables the MCP Chat frontend to call real AI-powered tools.
 */

import { FastifyInstance, FastifyRequest } from 'fastify';
import { executeHandler, getRegisteredToolNames, hasHandler, HANDLER_STATS } from '../../mcp/handlers/index';
import { aiRouter } from '../../services/providers/ai-router.js';
import { HandlerContext } from '../../mcp/handlers/types';
import type {
  ExecuteToolRequest,
  ExecuteToolResponse,
  AIStatusResponse,
  AvailableToolsResponse,
} from './types';

// Simple logger that works consistently
const logger = {
  info: (msg: string) => console.log(`[MCP-REST] ${msg}`),
  error: (msg: string, err?: unknown) => console.error(`[MCP-REST] ${msg}`, err || ''),
};

/**
 * Error patterns to detect in tool results
 * These patterns indicate the tool execution failed even if no exception was thrown
 */
const ERROR_PATTERNS = [
  /not found/i,
  /error:/i,
  /failed/i,
  /invalid/i,
  /unauthorized/i,
  /forbidden/i,
  /does not exist/i,
  /cannot find/i,
  /no .* found/i,
  /route .* not found/i,
  /404/i,
  /500/i,
  /503/i,
  /timeout/i,
  /connection refused/i,
  /ECONNREFUSED/i,
  /ENOTFOUND/i,
];

/**
 * Check if a tool result contains error indicators
 * Returns { hasError: boolean, errorMessage: string }
 *
 * IMPORTANT: Check for explicit success indicators FIRST before pattern matching.
 * This prevents false positives where successful responses contain words like "not found"
 * in legitimate contexts (e.g., "no flaky tests found").
 */
function checkForErrorInResult(result: unknown): { hasError: boolean; errorMessage: string } {
  // Handle null/undefined
  if (result === null || result === undefined) {
    return { hasError: true, errorMessage: 'Tool returned empty result' };
  }

  // Check for explicit success/error properties in object results FIRST
  // This must happen before pattern matching to avoid false positives
  if (typeof result === 'object' && result !== null) {
    const obj = result as Record<string, unknown>;

    // If success is explicitly true, this is not an error regardless of content
    if (obj.success === true) {
      return { hasError: false, errorMessage: '' };
    }

    // Check for error property
    if (obj.error) {
      return { hasError: true, errorMessage: String(obj.error) };
    }

    // Check for success: false
    if (obj.success === false) {
      return {
        hasError: true,
        errorMessage: obj.message ? String(obj.message) : 'Operation returned success: false'
      };
    }

    // Check for status codes
    if (typeof obj.statusCode === 'number' && obj.statusCode >= 400) {
      return {
        hasError: true,
        errorMessage: `HTTP ${obj.statusCode}: ${obj.message || 'Request failed'}`
      };
    }

    // Check for empty arrays that might indicate "not found"
    if (Array.isArray(obj.data) && obj.data.length === 0 && obj.total === 0) {
      // This is OK - empty results are not errors
      return { hasError: false, errorMessage: '' };
    }

    // Check for common success data fields that indicate a successful response
    // When these fields exist without an error field, the response is successful
    const successDataFields = [
      'suite', 'suites', 'project', 'projects', 'test', 'tests', 'run', 'runs',
      'result', 'results', 'organization', 'data', 'items', 'artifacts',
      'findings', 'report', 'baseline', 'metrics', 'stats', 'summary',
      'flaky_tests', 'failing_tests', 'coverage', 'incidents', 'alerts',
    ];

    // If the response has any of these data fields and no error field, it's successful
    if (!obj.error && !obj.statusCode) {
      for (const field of successDataFields) {
        if (field in obj && obj[field] !== undefined) {
          return { hasError: false, errorMessage: '' };
        }
      }
    }
  }

  // Convert to string for pattern matching (only if we didn't find explicit success/error)
  const resultStr = typeof result === 'string' ? result : JSON.stringify(result);

  // Check for error patterns only when there's no explicit success indicator
  for (const pattern of ERROR_PATTERNS) {
    if (pattern.test(resultStr)) {
      // Extract more context for the error message
      const match = resultStr.match(pattern);
      return {
        hasError: true,
        errorMessage: match ? `Error detected: ${resultStr.substring(0, 200)}` : 'Unknown error in result'
      };
    }
  }

  return { hasError: false, errorMessage: '' };
}

/**
 * Ensure AI router is initialized with API keys from environment
 * This handles the case where the singleton was created before dotenv loaded
 */
function ensureAIInitialized(): boolean {
  if (aiRouter.isInitialized()) {
    return true;
  }

  // Try to reinitialize with current env vars
  logger.info('AI router not initialized, attempting to reinitialize with env vars...');

  // Use the new reinitializeFromEnv method
  const success = aiRouter.reinitializeFromEnv();

  if (success) {
    logger.info('AI router reinitialized successfully');
  } else {
    logger.error('AI router reinitialization failed - check API keys in .env');
  }

  return aiRouter.isInitialized();
}

/**
 * Create a handler context for REST API calls
 */
function createHandlerContext(request: FastifyRequest): HandlerContext {
  const apiUrl = process.env.QA_GUARDIAN_API_URL || 'http://localhost:3001';
  const apiKey = request.headers['x-api-key'] as string | undefined;
  // Also check for JWT token in Authorization header
  const authHeader = request.headers['authorization'] as string | undefined;

  return {
    callApi: async (endpoint: string, options?: { method?: string; body?: Record<string, unknown> }) => {
      // For REST API calls, we make internal HTTP requests
      const url = `${apiUrl}${endpoint}`;
      const method = options?.method || 'GET';

      const fetchOptions: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          // Forward authentication - prefer API key, fallback to JWT
          ...(apiKey ? { 'X-API-Key': apiKey } : {}),
          ...(authHeader && !apiKey ? { 'Authorization': authHeader } : {}),
        },
      };

      if (options?.body && method !== 'GET') {
        fetchOptions.body = JSON.stringify(options.body);
      }

      const response = await fetch(url, fetchOptions);
      return response.json();
    },
    callApiPublic: async (endpoint: string) => {
      const url = `${apiUrl}${endpoint}`;
      const response = await fetch(url);
      return response.json();
    },
    log: (message: string) => {
      logger.info(message);
    },
    apiKey,
    apiUrl,
  };
}

/**
 * List of tools that support real AI execution
 */
const AI_POWERED_TOOLS = [
  // AI Generation tools
  'generate_test',
  'generate_test_from_description',
  'generate_test_suite',
  'convert_gherkin',
  'analyze_screenshot',
  'get_coverage_gaps',
  // AI Analysis tools
  'explain_test_failure_ai',
  'suggest_test_improvements',
  'analyze_test_failure',
  'get_ai_recommendations',
  // AI Chat tools
  'chat_with_ai',
  'get_ai_help',
];

export default async function mcpToolsRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/mcp/status
   * Check AI provider status and availability
   */
  fastify.get('/status', async (request, reply) => {
    try {
      // Ensure AI is initialized (handles late env var loading)
      ensureAIInitialized();

      const isInitialized = aiRouter.isInitialized();
      const kieAvailable = aiRouter.isProviderAvailable('kie');
      const anthropicAvailable = aiRouter.isProviderAvailable('anthropic');

      const response: AIStatusResponse = {
        ready: isInitialized,
        providers: {
          available: isInitialized,
          primary: {
            name: 'Kie.ai',
            available: kieAvailable,
            model: kieAvailable ? (process.env.KIE_DEFAULT_MODEL || 'claude-3-haiku-20240307') : undefined,
          },
          fallback: {
            name: 'Anthropic',
            available: anthropicAvailable,
            model: anthropicAvailable ? (process.env.ANTHROPIC_DEFAULT_MODEL || 'claude-3-haiku-20240307') : undefined,
          },
        },
        message: isInitialized
          ? `AI ready: ${kieAvailable ? 'Kie.ai (primary)' : ''}${kieAvailable && anthropicAvailable ? ' + ' : ''}${anthropicAvailable ? 'Anthropic (fallback)' : ''}`
          : 'No AI providers available. Check your API keys in .env',
      };

      return reply.send(response);
    } catch (error) {
      logger.error('Failed to get AI status', error);
      return reply.status(500).send({
        ready: false,
        providers: {
          available: false,
          primary: { name: 'Kie.ai', available: false },
          fallback: { name: 'Anthropic', available: false },
        },
        message: 'Failed to check AI status',
      });
    }
  });

  /**
   * GET /api/v1/mcp/tools
   * List all available MCP tools
   */
  fastify.get('/tools', async (request, reply) => {
    try {
      const toolNames = getRegisteredToolNames();
      const stats = HANDLER_STATS.handlersByModule;

      // Group tools by module
      const categories: Record<string, string[]> = {};
      for (const [moduleName, count] of Object.entries(stats)) {
        if (typeof count === 'number' && count > 0) {
          // We don't have direct access to which tools belong to which module
          // So we'll include the stats as-is
          categories[moduleName] = [];
        }
      }

      const response: AvailableToolsResponse = {
        total: toolNames.length,
        categories: {
          // Simplified - just list AI tools separately
          all: toolNames,
        },
        ai_tools: AI_POWERED_TOOLS.filter(tool => hasHandler(tool)),
      };

      return reply.send(response);
    } catch (error) {
      logger.error('Failed to get available tools', error);
      return reply.status(500).send({
        total: 0,
        categories: {},
        ai_tools: [],
      });
    }
  });

  /**
   * POST /api/v1/mcp/execute
   * Execute an MCP tool handler
   */
  fastify.post<{
    Body: ExecuteToolRequest;
  }>('/execute', async (request, reply) => {
    const startTime = Date.now();

    try {
      const { tool_name, args, use_real_ai = true } = request.body;

      if (!tool_name) {
        return reply.status(400).send({
          success: false,
          error: 'Missing required parameter: tool_name',
          metadata: {
            tool_name: '',
            used_real_ai: false,
            execution_time_ms: Date.now() - startTime,
          },
        });
      }

      // Check if tool exists
      if (!hasHandler(tool_name)) {
        return reply.status(404).send({
          success: false,
          error: `Unknown tool: ${tool_name}. Use GET /api/v1/mcp/tools to see available tools.`,
          metadata: {
            tool_name,
            used_real_ai: false,
            execution_time_ms: Date.now() - startTime,
          },
        });
      }

      // Create handler context
      const context = createHandlerContext(request);

      // Ensure AI is initialized for AI-powered tools
      const isAiTool = AI_POWERED_TOOLS.includes(tool_name);
      if (isAiTool && use_real_ai) {
        ensureAIInitialized();
      }

      // Add use_real_ai flag to args if this is an AI tool
      const enhancedArgs = isAiTool ? { ...args, use_real_ai } : args;

      logger.info(`Executing tool: ${tool_name} (real_ai: ${use_real_ai}, is_ai_tool: ${isAiTool})`);

      // Execute the handler
      const result = await executeHandler(tool_name, enhancedArgs, context);

      const executionTime = Date.now() - startTime;

      // Extract AI metadata if available
      const resultObj = result as Record<string, unknown> | undefined;
      const aiMetadata = resultObj?.ai_metadata as Record<string, unknown> | undefined;

      const response: ExecuteToolResponse = {
        success: true,
        result,
        metadata: {
          tool_name,
          used_real_ai: aiMetadata?.used_real_ai === true || aiMetadata?.provider !== undefined,
          provider: aiMetadata?.provider as string | undefined,
          model: aiMetadata?.model as string | undefined,
          execution_time_ms: executionTime,
          tokens: aiMetadata?.tokens ? {
            input: (aiMetadata.tokens as Record<string, number>).input || 0,
            output: (aiMetadata.tokens as Record<string, number>).output || 0,
          } : undefined,
        },
      };

      logger.info(`Tool ${tool_name} completed in ${executionTime}ms (real_ai: ${response.metadata.used_real_ai})`);

      return reply.send(response);
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error(`Tool execution failed: ${errorMessage}`, error);

      return reply.status(500).send({
        success: false,
        error: errorMessage,
        metadata: {
          tool_name: request.body?.tool_name || 'unknown',
          used_real_ai: false,
          execution_time_ms: executionTime,
        },
      });
    }
  });

  /**
   * POST /api/v1/mcp/chat
   * AI-powered chat endpoint with tool execution capability
   * Claude can request tool execution by including TOOL_CALL blocks in its response
   */
  fastify.post<{
    Body: {
      message: string;
      context?: {
        project_id?: string;
        project_name?: string;
        test_id?: string;
        current_page?: string;
        conversation_history?: Array<{ role: string; content: string }>;
      };
      // Feature #1941: Complexity-based model routing
      complexity?: 'simple' | 'complex';
    };
  }>('/chat', async (request, reply) => {
    const startTime = Date.now();

    try {
      const { message, context = {}, complexity = 'complex' } = request.body;

      // Feature #1941: Select model based on complexity
      // Simple: Haiku ($0.075/M) - for passed tests, minor diffs
      // Complex: Sonnet ($0.90/M) - for failed tests, errors, detailed analysis
      const modelByComplexity = {
        simple: 'claude-3-haiku-20240307',
        complex: 'claude-sonnet-4-20250514',  // Claude Sonnet 4 for complex analysis
      };
      const selectedModel = modelByComplexity[complexity];
      logger.info(`Complexity: ${complexity}, Selected model: ${selectedModel}`);

      if (!message) {
        return reply.status(400).send({
          success: false,
          error: 'Missing required parameter: message',
        });
      }

      // Ensure AI is initialized (handles late env var loading)
      ensureAIInitialized();

      // Check if AI is available
      if (!aiRouter.isInitialized()) {
        return reply.status(503).send({
          success: false,
          error: 'AI service is not available. Please check your API keys in .env',
          metadata: {
            used_real_ai: false,
            execution_time_ms: Date.now() - startTime,
          },
        });
      }

      logger.info(`Processing chat: "${message.substring(0, 80)}..."`);

      // Create handler context for tool execution
      const handlerContext = createHandlerContext(request);

      // Build the system prompt that tells Claude about available tools
      const systemPrompt = `You are QA Guardian's AI assistant with full access to the QA Guardian testing platform.

## YOUR CAPABILITIES
You can both provide advice AND take real actions by calling tools. When a user asks you to CREATE, UPDATE, DELETE, RUN, or GET something, you should USE THE TOOLS to actually do it.

## AVAILABLE TOOLS (170+ tools organized by category)

### 🏢 PROJECT MANAGEMENT
- \`list_projects\`: List all projects
- \`get_project\`: Get project details { "project_id": "string" }
- \`create_project\`: Create a new project { "name": "string", "description": "string (optional)" }
- \`update_project\`: Update a project { "project_id": "string", ...fields }
- \`delete_project\`: Delete a project { "project_id": "string", "confirm": true }

### 📦 TEST SUITE MANAGEMENT
- \`list_test_suites\`: List test suites { "project_id": "string" }
- \`create_test_suite\`: Create a test suite { "project_id": "string", "name": "string" }
- \`update_test_suite\`: Update a test suite { "suite_id": "string", ...fields }
- \`delete_test_suite\`: Delete a test suite { "suite_id": "string", "confirm": true }

### 🧪 TEST MANAGEMENT
- \`create_test\`: Create a test { "suite_id": "string", "name": "string", "steps": [...] }
- \`update_test\`: Update a test { "test_id": "string", ...fields }
- \`delete_test\`: Delete a test { "test_id": "string", "confirm": true }
- \`duplicate_test\`: Duplicate a test { "test_id": "string", "new_name": "string (optional)" }
- \`import_tests\`: Import multiple tests { "suite_id": "string", "tests": [...] }
- \`export_tests\`: Export tests from suite { "suite_id": "string" }
- \`reorder_tests\`: Reorder tests { "suite_id": "string", "test_ids": [...] }
- \`get_test_code\`: Get Playwright code { "test_id": "string" }
- \`update_test_code\`: Update test code { "test_id": "string", "code": "string" }

### ▶️ TEST EXECUTION
- \`run_test\`: Run a test { "test_id": "string" } or { "suite_id": "string" }
- \`trigger_test_run\`: Trigger test run with options { "suite_id": "string", "browser": "string" }
- \`cancel_test\`: Cancel a running test { "run_id": "string" }
- \`cancel_run\`: Cancel a run { "run_id": "string" }
- \`get_test_config\`: Get test configuration { "suite_id": "string" }
- \`list_recent_runs\`: List recent test runs
- \`get_test_artifacts\`: Get artifacts for a run { "run_id": "string" }

### 📊 TEST RESULTS
- \`get_result\`: Get test result { "run_id": "string", "test_id": "string (optional)" }
- \`get_run\`: Get run details { "run_id": "string", "include": ["status", "progress", "logs"] }
- \`compare_runs\`: Compare two runs { "base_run_id": "string", "compare_run_id": "string" }
- \`get_run_metrics\`: Get run metrics { "run_id": "string" }

### 🔍 SEARCH & ANALYSIS
- \`search_results\`: Search test results { "query": "string", "status": "string" }
- \`get_failure_patterns\`: Get common failure patterns { "project_id": "string" }
- \`get_review_status\`: Get review status { "run_id": "string", "test_id": "string" }
- \`create_bug_report\`: Create bug report from failure { "run_id": "string", "test_id": "string" }
- \`export_data\`: Export data { "type": "results|analytics|accessibility|security|report" }
- \`get_result_diff\`: Compare results { "base_result_id": "string", "compare_result_id": "string" }
- \`get_annotations\`: Get result annotations { "run_id": "string", "test_id": "string" }

### 📈 ANALYTICS & DASHBOARD
- \`get_dashboard_summary\`: Get dashboard summary { "period": "7d" }
- \`get_failing_tests\`: Get failing tests { "project_id": "string", "period": "7d" }
- \`get_test_coverage\`: Get test coverage { "project_id": "string" }
- \`get_quality_score\`: Get quality score { "project_id": "string" }
- \`get_team_metrics\`: Get team metrics { "period": "30d" }
- \`get_project_analytics\`: Get project analytics { "project_id": "string" }
- \`get_browser_analytics\`: Get browser analytics { "project_id": "string" }
- \`get_execution_time_analytics\`: Get execution time stats { "project_id": "string" }
- \`get_failure_categories\`: Get failure categories { "project_id": "string" }
- \`get_release_quality\`: Get release quality { "project_id": "string", "release": "string" }
- \`compare_releases\`: Compare releases { "base_release": "string", "compare_release": "string" }

### 📸 VISUAL REGRESSION
- \`get_visual_diffs\`: Get pending visual diffs { "project_id": "string (optional)" }
- \`get_visual_diff_details\`: Get diff details { "run_id": "string", "test_id": "string" }
- \`get_baseline_history\`: Get baseline history { "test_id": "string" }
- \`configure_visual_threshold\`: Configure threshold { "test_id": "string", "threshold": number }
- \`get_visual_review_queue\`: Get visual review queue { "project_id": "string" }
- \`get_visual_trends\`: Get visual trends { "project_id": "string" }
- \`run_visual_comparison\`: Run visual comparison { "test_id": "string" }

### 🔒 SECURITY
- \`run_security_scan\`: Run security scan { "project_id": "string" }
- \`get_security_findings\`: Get security findings { "project_id": "string" }
- \`dismiss_vulnerability\`: Dismiss vulnerability { "vulnerability_id": "string", "reason": "string" }
- \`get_dependency_audit\`: Get dependency audit { "project_id": "string" }
- \`get_security_trends\`: Get security trends { "project_id": "string" }
- \`get_security_score\`: Get security score { "project_id": "string" }
- \`get_exposed_secrets\`: Get exposed secrets { "project_id": "string" }
- \`verify_secret_status\`: Verify secret status { "secret_id": "string" }
- \`generate_sbom\`: Generate SBOM { "project_id": "string" }
- \`run_dast_scan\`: Run DAST scan { "target_url": "string" }
- \`get_dast_findings\`: Get DAST findings { "scan_id": "string" }
- \`generate_security_report\`: Generate security report { "project_id": "string" }
- \`configure_security_policy\`: Configure security policy { "project_id": "string", ...config }
- \`get_container_vulnerabilities\`: Get container vulns { "image": "string" }
- \`compare_security_scans\`: Compare scans { "baseline_scan_id": "string", "current_scan_id": "string" }
- \`schedule_security_scan\`: Schedule scan { "project_id": "string", "frequency": "string" }
- \`get_fix_suggestions\`: Get fix suggestions { "vulnerability_id": "string" }

### ♿ ACCESSIBILITY
- \`run_accessibility_scan\`: Run accessibility scan { "url": "string", "wcag_level": "AA" }
- \`get_accessibility_results\`: Get accessibility results { "run_id": "string" }
- \`get_accessibility_trends\`: Get accessibility trends { "project_id": "string" }

### ⚡ PERFORMANCE & LIGHTHOUSE
- \`run_lighthouse_audit\`: Run Lighthouse audit { "test_id": "string" }
- \`get_lighthouse_results\`: Get Lighthouse results { "run_id": "string" }
- \`get_performance_trends\`: Get performance trends { "project_id": "string" }
- \`set_performance_budget\`: Set performance budget { "project_id": "string", "budget": {...} }
- \`get_budget_violations\`: Get budget violations { "project_id": "string" }
- \`get_core_web_vitals\`: Get Core Web Vitals { "project_id": "string" }
- \`schedule_performance_audit\`: Schedule audit { "project_id": "string", "frequency": "string" }

### 📦 LOAD TESTING (k6)
- \`run_k6_test\`: Run k6 load test { "project_id": "string", "script": "string" }
- \`get_k6_results\`: Get k6 results { "run_id": "string" }
- \`get_k6_progress\`: Get k6 progress { "run_id": "string" }
- \`stop_k6_test\`: Stop k6 test { "run_id": "string" }
- \`get_load_test_trends\`: Get load test trends { "project_id": "string" }
- \`compare_load_tests\`: Compare load tests { "base_run_id": "string", "compare_run_id": "string" }
- \`create_k6_script\`: Create k6 script { "name": "string", "target_url": "string" }

### 📡 MONITORING
- \`get_uptime_status\`: Get uptime status { "check_id": "string (optional)" }
- \`get_check_results\`: Get check results { "check_id": "string" }
- \`get_alert_history\`: Get alert history { "start_date": "string", "end_date": "string" }
- \`get_oncall_schedule\`: Get on-call schedule { "schedule_id": "string (optional)" }
- \`get_uptime_report\`: Get uptime report { "check_ids": "string", "sla_target": number }
- \`create_maintenance_window\`: Create maintenance window { "name": "string", "start_time": "string", "end_time": "string" }
- \`get_maintenance_windows\`: Get maintenance windows { "active_only": boolean }
- \`get_status_page_status\`: Get status page status { "slug": "string" }

### 🔀 FLAKY TESTS
- \`get_flaky_tests\`: Get flaky tests { "project_id": "string" }
- \`quarantine_test\`: Quarantine a test { "test_id": "string", "reason": "string" }
- \`unquarantine_test\`: Unquarantine a test { "test_id": "string" }
- \`get_flakiness_trends\`: Get flakiness trends { "project_id": "string" }
- \`suggest_flaky_fixes\`: Get fix suggestions { "test_id": "string" }

### 📂 ARTIFACTS
- \`get_artifact\`: Get artifact { "run_id": "string", "test_id": "string", "type": "string" }
- \`get_video\`: Get video { "run_id": "string", "test_id": "string" }
- \`get_trace\`: Get trace { "run_id": "string", "test_id": "string" }
- \`analyze_failure\`: Analyze failure { "run_id": "string", "test_id": "string" }
- \`get_error_stacktrace\`: Get error stacktrace { "run_id": "string", "test_id": "string" }
- \`download_artifacts\`: Download artifacts { "run_id": "string" }
- \`delete_artifacts\`: Delete artifacts { "run_id": "string", "confirm": true }
- \`get_artifact_storage\`: Get storage info

### 🤖 AI-POWERED TOOLS
- \`analyze_site\`: **CALL THIS FIRST** before creating tests { "url": "string" } - Returns site structure: hasLoginForm, hasSearchForm, forms, navigation, suggestedTests
- \`generate_test\`: Generate test from description { "description": "string" }
- \`generate_test_from_description\`: Generate detailed test { "description": "string", "target_url": "string" }
- \`generate_test_suite\`: Generate test suite { "user_story": "string" }
- \`convert_gherkin\`: Convert Gherkin to Playwright { "gherkin": "string" }
- \`get_coverage_gaps\`: Analyze coverage gaps { "project_id": "string" }
- \`parse_test_description\`: Parse test description { "description": "string" }
- \`generate_selectors\`: Generate selectors { "html": "string" }
- \`generate_assertions\`: Generate assertions { "test_id": "string" }
- \`generate_user_flow\`: Generate user flow { "description": "string" }
- \`assess_test_confidence\`: Assess test confidence { "test_id": "string" }
- \`analyze_screenshot\`: Analyze screenshot { "screenshot_url": "string" }
- \`explain_test_failure_ai\`: Explain failure with AI { "run_id": "string", "test_id": "string" }
- \`suggest_test_improvements\`: Suggest improvements { "test_id": "string" }
- \`ask_qa_guardian\`: Ask QA question { "question": "string" }
- \`summarize_test_results\`: Summarize results { "run_id": "string" }
- \`suggest_test_strategy\`: Suggest test strategy { "project_id": "string" }
- \`analyze_test_maintenance\`: Analyze maintenance { "project_id": "string" }

### ⚙️ SETTINGS & ORGANIZATION
- \`get_usage_statistics\`: Get usage statistics
- \`update_settings\`: Update settings { ...settings }
- \`get_integrations\`: Get integrations
- \`get_audit_log\`: Get audit log { "start_date": "string", "end_date": "string" }
- \`get_organization_info\`: Get organization info
- \`get_team_members\`: Get team members
- \`get_api_keys\`: Get API keys
- \`get_ai_provider_status\`: Get AI provider status
- \`get_ai_cost_report\`: Get AI cost report
- \`switch_ai_provider\`: Switch AI provider { "provider": "kie|anthropic" }
- \`get_notification_settings\`: Get notification settings
- \`configure_webhook\`: Configure webhook { "url": "string", "events": ["test_failure", "suite_completed"] }
- \`get_data_retention_policy\`: Get data retention policy

### 🏷️ BATCH & TAGGING TOOLS
- \`bulk_update_tests\`: Update multiple tests at once { "test_ids": ["id1", "id2"], "updates": { "tags": ["tag1"], "status": "active" } }
- \`tag_test_cases\`: Add or remove tags from tests { "test_ids": ["id1", "id2"], "add_tags": ["tag1"], "remove_tags": ["tag2"] }

### 📸 VISUAL BASELINE TOOLS
- \`approve_visual_baseline\`: Approve a visual baseline { "test_id": "string", "diff_id": "string (optional)", "comment": "string" }

### 🔌 API VALIDATION & MOCKING TOOLS
- \`validate_api_response\`: Validate API response { "url": "string", "expected_status": 200, "expected_values": {...} }
- \`get_mock_server_status\`: Get mock server status
- \`create_mock_endpoint\`: Create mock endpoint { "path": "/api/users", "method": "GET", "response_status": 200, "response_body": {...} }

## HOW TO USE TOOLS
When you need to execute an action, include this exact format in your response:

\`\`\`tool_call
{
  "tool": "tool_name",
  "args": { "param1": "value1", "param2": "value2" }
}
\`\`\`

You can include multiple tool calls. Each will be executed in order.

## EXAMPLE INTERACTIONS

**User: "Create a project called My App"**
I'll create the project "My App" for you.

\`\`\`tool_call
{
  "tool": "create_project",
  "args": { "name": "My App", "description": "Created via MCP Chat" }
}
\`\`\`

**User: "Show me the dashboard summary"**
I'll get the dashboard summary for you.

\`\`\`tool_call
{
  "tool": "get_dashboard_summary",
  "args": { "period": "7d" }
}
\`\`\`

**User: "What are my flaky tests?"**
Let me check for flaky tests in your projects.

\`\`\`tool_call
{
  "tool": "get_flaky_tests",
  "args": {}
}
\`\`\`

## CURRENT CONTEXT
- Project: ${context.project_name || context.project_id || 'Not specified'}
- Current page: ${context.current_page || 'MCP Chat'}

## GUIDELINES
1. When asked to CREATE, UPDATE, DELETE, or GET something, USE THE TOOL
2. When asked for information (like "list projects"), USE THE TOOL to get real data
3. You can chain multiple tool calls if needed
4. Always explain what you're doing before/after tool calls
5. For complex questions about QA strategy, you can provide advice along with relevant tool calls

## CRITICAL: INCLUDE CLICKABLE LINKS IN ALL RESPONSES (Feature #1728)
**ALWAYS include markdown links to created/affected resources in your responses:**
- After creating a test: Include \`[View Test](/projects/{projectId}/suites/{suiteId}/tests/{testId})\`
- After running a test/suite: Include \`[View Results](/runs/{runId})\`
- After creating a project: Include \`[Open Project](/projects/{projectId})\`
- After creating a suite: Include \`[View Suite](/projects/{projectId}/suites/{suiteId})\`
- After generating a report: Include \`[View Full Report](/reports/{reportId})\`

Example response after creating a test:
"✅ Created test 'Login Test' in suite 'Auth Tests'. [View Test](/projects/abc123/suites/def456/tests/ghi789) | [Run Test](/projects/abc123/suites/def456/tests/ghi789?action=run)"

## CRITICAL: TEST CREATION WORKFLOW
**When creating a test for a URL, ALWAYS follow this workflow:**
1. **FIRST** call \`analyze_site\` with the target URL to understand the site structure
2. **THEN** create test steps based on what the site ACTUALLY has:
   - If \`hasLoginForm=true\`: Include login tests
   - If \`hasLoginForm=false\`: **DO NOT** create login tests - create navigation/visual tests instead
   - If \`hasSearchForm=true\`: Include search tests
   - If \`hasForms=true\`: Include form submission tests
   - Use the \`suggestedTests\` array from analyze_site as guidance
3. **NEVER assume** a site has login/search/forms - always verify with analyze_site first
4. Propose tests based on the ACTUAL site features found, not generic assumptions

## CRITICAL: TOOL SELECTION GUIDE (Intent → Tool Mapping)

### 📁 PROJECT MANAGEMENT
| Intent | Tool |
|--------|------|
| "create project", "new project", "add project" | \`create_project\` |
| "update project", "rename project", "change project" | \`update_project\` |
| "delete project", "remove project" | \`delete_project\` |
| "list projects", "show projects", "my projects" | \`list_projects\` |
| "get project", "project details", "project info" | \`get_project\` |

### 📋 TEST SUITE MANAGEMENT
| Intent | Tool |
|--------|------|
| "create suite", "new suite", "add suite" | \`create_test_suite\` |
| "update suite", "rename suite", "modify suite" | \`update_test_suite\` |
| "delete suite", "remove suite" | \`delete_test_suite\` |
| "list suites", "show suites", "my suites" | \`list_test_suites\` |
| "get suite", "suite details" | \`get_test_suite\` |

### 🧪 TEST CASE MANAGEMENT
| Intent | Tool |
|--------|------|
| "create test", "new test", "add test" | \`create_test\` ⚠️ NOT update_test_suite! |
| "update test", "edit test", "modify test steps" | \`update_test\` |
| "delete test", "remove test" | \`delete_test\` |
| "list tests", "show tests" | \`list_tests\` |
| "get test", "test details" | \`get_test\` |

### ▶️ EXECUTION
| Intent | Tool |
|--------|------|
| "run test", "execute test" | \`run_test\` |
| "run suite", "execute suite" | \`run_test_suite\` |
| "cancel run", "stop execution" | \`cancel_run\` |
| "run status", "check run" | \`get_run_status\` |
| "list runs", "recent runs" | \`list_recent_runs\` |

### 📊 ANALYTICS & REPORTS
| Intent | Tool |
|--------|------|
| "dashboard", "summary", "overview" | \`get_dashboard_summary\` |
| "analytics", "metrics", "stats" | \`get_test_analytics\` |
| "flaky tests", "unstable tests" | \`get_flaky_tests\` |
| "test results", "run results" | \`get_result\` |
| "export", "download results" | \`export_data\` |

### 🔍 SCANNING & TESTING
| Intent | Tool |
|--------|------|
| "create test for URL", "test this site" | **FIRST** \`analyze_site\` → **THEN** \`create_test\` based on results |
| "security scan", "DAST scan", "vulnerability scan" | \`run_dast_scan\` or \`run_security_scan\` |
| "accessibility scan", "a11y check", "WCAG audit" | \`run_accessibility_scan\` |
| "load test", "performance test", "k6 test" | \`run_k6_test\` |
| "visual test", "screenshot comparison" | \`create_visual_test\` or use \`create_test\` with type="visual" |

### ⚠️ CRITICAL RULES
1. **"create" = create_* tools**: "create a test" → \`create_test\` (NEVER \`update_test_suite\`)
2. **"update/modify/rename" = update_* tools**: "rename suite" → \`update_test_suite\`
3. **"delete/remove" = delete_* tools**: Always confirm before deleting
4. **Unknown ID**: Use list_* to find the correct ID first, then the action tool
5. **ALWAYS CHECK BEFORE CREATING (Feature #1736)**: Before creating a project or suite:
   - Call \`list_projects\` first - if a project with the same/similar name exists, USE IT instead of creating a duplicate
   - Call \`list_test_suites\` for that project - if a suite with the same/similar name exists, USE IT instead of creating a duplicate
   - Only create new resources when no suitable existing resource is found
   - This prevents duplicate projects and suites cluttering the workspace
6. **VISUAL TESTS MUST INCLUDE VIEWPORT (Feature #1744)**: When creating visual/visual_regression tests:
   - **ALWAYS** include \`viewport_width\` and \`viewport_height\` parameters
   - Default viewports: desktop=1920x1080, tablet=768x1024, mobile=375x667
   - **ALWAYS** include \`diff_threshold\` (use 0.1 for 10% tolerance unless user wants exact match)
   - Example: \`create_test\` with \`{ "type": "visual", "viewport_width": 1920, "viewport_height": 1080, "diff_threshold": 0.1, ... }\`

## CRITICAL RULE #7: NEVER USE EXAMPLE/DEMO URLs (Feature #1757)
**ABSOLUTELY FORBIDDEN URLs - NEVER USE THESE:**
- ❌ example.com, www.example.com, *.example.com
- ❌ demo.playwright.dev, *.playwright.dev/demo
- ❌ todomvc.com, *.todomvc.com
- ❌ jsonplaceholder.typicode.com (unless explicitly testing APIs)
- ❌ Any URL containing "example", "demo", "test", "sample", "placeholder" in the domain
- ❌ httpbin.org, reqres.in (unless explicitly testing APIs)

**REQUIRED BEHAVIOR:**
1. **ALWAYS use the EXACT URL the user provided** - If user says "mercan.pa", use "https://mercan.pa"
2. **If no URL provided, ASK the user** - Do NOT substitute with example.com
3. **Normalize URLs properly**: Add "https://" prefix if missing, but NEVER change the domain
4. **When creating tests**: The target_url MUST be the user's URL, not an example site

**Example of CORRECT behavior:**
User: "Create a test for mercan.pa"
You: Use target_url: "https://mercan.pa" ✅

**Example of WRONG behavior (NEVER DO THIS):**
User: "Create a test for mercan.pa"
You: Use target_url: "https://example.com" ❌ FORBIDDEN!

**If you EVER find yourself about to use example.com, STOP and use the user's actual URL instead.**

## CRITICAL: ERROR HANDLING - YOU MUST FIX FAILURES
**When a tool fails, you MUST:**
1. **STOP** - Do not continue to the next operation
2. **ANALYZE** - Read the error message carefully to understand what went wrong
3. **FIX** - Determine the correct parameters or approach
4. **RETRY** - Call the tool again with the corrected parameters
5. **Only continue** to the next step after the current tool succeeds

**Common error patterns and how to fix them:**
- "At least one setting must be provided" → You need to include actual setting values in args
- "not found" → The ID doesn't exist, list available items first
- "required parameter missing" → Check the tool signature and include all required args
- "invalid" → Check the format/type of your arguments

**NEVER:**
- Continue to the next step if the current tool failed
- Report success when a tool returned an error
- Ignore error messages

**Example of CORRECT error handling:**
User: "Update my settings"
You try: update_settings with {}
Error: "At least one setting must be provided"
CORRECT: "The update failed because I didn't specify which settings to change. Let me ask: What settings would you like to update? Options include: name, timezone, default_browser, default_timeout, notifications_enabled, slack_webhook_url"

**Example of WRONG behavior (never do this):**
Tool fails → Continue anyway → Report "completed successfully" ❌`;

      // Multi-turn tool execution loop
      // Claude can make tool calls, we execute them, send results back, and Claude can continue
      const MAX_TOOL_TURNS = 5; // Prevent infinite loops
      const MAX_EXECUTION_TIME_MS = 55000; // Feature #1930: Maximum 55 seconds for entire chat request (allows for complex AI analysis)
      let turnCount = 0;
      const allToolsExecuted: Array<{ tool: string; args: Record<string, unknown>; result: unknown; success: boolean }> = [];
      const conversationMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [
        { role: 'user', content: message }
      ];

      let finalResponse = '';
      let lastAiResponse: { actualProvider?: string; model?: string; inputTokens?: number; outputTokens?: number } = {};

      while (turnCount < MAX_TOOL_TURNS) {
        // Feature #1924: Check if we've exceeded maximum execution time
        const elapsedTime = Date.now() - startTime;
        if (elapsedTime > MAX_EXECUTION_TIME_MS) {
          logger.warn(`Chat request exceeded maximum execution time (${elapsedTime}ms > ${MAX_EXECUTION_TIME_MS}ms)`);
          return reply.status(504).send({
            success: false,
            error: 'AI analysis timed out. The request took too long to process. Please try again.',
            metadata: {
              used_real_ai: true,
              execution_time_ms: elapsedTime,
              turns_completed: turnCount,
              tools_executed: allToolsExecuted.length,
            },
          });
        }

        turnCount++;
        logger.info(`Tool execution turn ${turnCount}/${MAX_TOOL_TURNS}`);

        // Call the AI router with complexity-based model selection (Feature #1941)
        const aiResponse = await aiRouter.sendMessage(
          conversationMessages,
          {
            systemPrompt,
            temperature: 0.7,
            maxTokens: 4000,
            model: selectedModel,  // Feature #1941: Use complexity-based model
          }
        );

        // Store the last AI response metadata
        lastAiResponse = {
          actualProvider: aiResponse.actualProvider,
          model: aiResponse.model,
          inputTokens: aiResponse.inputTokens,
          outputTokens: aiResponse.outputTokens,
        };

        const responseContent = aiResponse.content || 'No response generated';

        // Parse tool calls from the response
        const toolCallRegex = /```tool_call\s*\n([\s\S]*?)\n```/g;
        const toolCallsInResponse: Array<{ tool: string; args: Record<string, unknown> }> = [];
        let match;

        while ((match = toolCallRegex.exec(responseContent)) !== null) {
          try {
            const toolCallJson = match[1].trim();
            const toolCall = JSON.parse(toolCallJson);
            if (toolCall.tool) {
              toolCallsInResponse.push({
                tool: toolCall.tool,
                args: toolCall.args || {},
              });
            }
          } catch (parseError) {
            logger.error('Failed to parse tool call', parseError);
          }
        }

        // If no tool calls, we're done - this is the final response
        if (toolCallsInResponse.length === 0) {
          finalResponse = responseContent;
          break;
        }

        // Execute all tool calls in this turn
        const turnResults: Array<{ tool: string; args: Record<string, unknown>; result: unknown; success: boolean }> = [];

        for (const toolCall of toolCallsInResponse) {
          if (hasHandler(toolCall.tool)) {
            logger.info(`Executing tool: ${toolCall.tool}`);
            try {
              const result = await executeHandler(toolCall.tool, toolCall.args, handlerContext);

              // Check if the result indicates an error (even if no exception was thrown)
              const isErrorResult = checkForErrorInResult(result);

              if (isErrorResult.hasError) {
                turnResults.push({
                  tool: toolCall.tool,
                  args: toolCall.args,
                  result: { error: isErrorResult.errorMessage, originalResult: result },
                  success: false,
                });
                logger.error(`Tool ${toolCall.tool} returned error: ${isErrorResult.errorMessage}`);
              } else {
                turnResults.push({
                  tool: toolCall.tool,
                  args: toolCall.args,
                  result,
                  success: true,
                });
                logger.info(`Tool ${toolCall.tool} executed successfully`);
              }
            } catch (toolError) {
              const errorMsg = toolError instanceof Error ? toolError.message : 'Unknown error';
              turnResults.push({
                tool: toolCall.tool,
                args: toolCall.args,
                result: { error: errorMsg },
                success: false,
              });
              logger.error(`Tool ${toolCall.tool} failed: ${errorMsg}`);
            }
          } else {
            logger.info(`[WARN] Unknown tool requested: ${toolCall.tool}`);
            turnResults.push({
              tool: toolCall.tool,
              args: toolCall.args,
              result: { error: `Unknown tool: ${toolCall.tool}` },
              success: false,
            });
          }
        }

        allToolsExecuted.push(...turnResults);

        // Build result message to send back to Claude
        const hasFailures = turnResults.some(r => !r.success);
        const hasSuccesses = turnResults.some(r => r.success);

        let toolResultMessage = 'Tool execution results:\n\n';
        for (const exec of turnResults) {
          if (exec.success) {
            toolResultMessage += `✅ ${exec.tool} completed successfully:\n`;
            toolResultMessage += '```json\n' + JSON.stringify(exec.result, null, 2) + '\n```\n\n';
          } else {
            const errorResult = exec.result as { error?: string; originalResult?: unknown };
            toolResultMessage += `❌ ${exec.tool} FAILED: ${errorResult.error || 'Unknown error'}\n`;
            if (errorResult.originalResult) {
              toolResultMessage += 'Original response: ' + JSON.stringify(errorResult.originalResult) + '\n\n';
            }
          }
        }

        // CRITICAL: Different instructions based on success/failure
        if (hasFailures) {
          toolResultMessage += '\n⚠️ **CRITICAL: One or more tools FAILED. You MUST:**\n';
          toolResultMessage += '1. STOP - Do NOT continue to the next operation\n';
          toolResultMessage += '2. ANALYZE the error message above\n';
          toolResultMessage += '3. FIX the issue (correct parameters, get required IDs first, etc.)\n';
          toolResultMessage += '4. RETRY the failed tool with corrected arguments\n';
          toolResultMessage += '5. Only proceed after the tool succeeds\n\n';
          toolResultMessage += 'DO NOT report success or continue if a tool failed. Fix it first!';
        } else {
          toolResultMessage += '\nAll tools completed successfully. You may continue with the next steps or provide a summary.';
        }

        // Add assistant response and tool results to conversation
        conversationMessages.push({ role: 'assistant', content: responseContent });
        conversationMessages.push({ role: 'user', content: toolResultMessage });

        // Store the response content (with tool calls) for the final output
        finalResponse = responseContent;
      }

      // Format the final response
      let responseContent = finalResponse;

      // If tools were executed, append a summary
      if (allToolsExecuted.length > 0) {
        // Remove tool_call blocks from the response
        responseContent = responseContent.replace(/```tool_call\s*\n[\s\S]*?\n```/g, '');

        responseContent += '\n\n---\n**Tool Execution Results:**\n';
        for (const exec of allToolsExecuted) {
          if (exec.success) {
            responseContent += `\n✅ **${exec.tool}** completed successfully\n`;
            // Show relevant result info
            if (exec.result && typeof exec.result === 'object') {
              const r = exec.result as Record<string, unknown>;
              if (r.id) responseContent += `   - ID: \`${r.id}\`\n`;
              if (r.name) responseContent += `   - Name: ${r.name}\n`;
              if (r.message) responseContent += `   - ${r.message}\n`;
              // Show project details
              if (r.project && typeof r.project === 'object') {
                const p = r.project as Record<string, unknown>;
                if (p.id) responseContent += `   - Project ID: \`${p.id}\`\n`;
                if (p.name) responseContent += `   - Project Name: ${p.name}\n`;
              }
              // Show suite details
              if (r.suite && typeof r.suite === 'object') {
                const s = r.suite as Record<string, unknown>;
                if (s.id) responseContent += `   - Suite ID: \`${s.id}\`\n`;
                if (s.name) responseContent += `   - Suite Name: ${s.name}\n`;
              }
              // Show test details
              if (r.test && typeof r.test === 'object') {
                const t = r.test as Record<string, unknown>;
                if (t.id) responseContent += `   - Test ID: \`${t.id}\`\n`;
                if (t.name) responseContent += `   - Test Name: ${t.name}\n`;
              }
            }
          } else {
            const errorResult = exec.result as { error?: string };
            responseContent += `\n❌ **${exec.tool}** failed: ${errorResult.error || 'Unknown error'}\n`;
          }
        }
      }

      const toolsExecuted = allToolsExecuted;

      const executionTime = Date.now() - startTime;

      // Feature #1941: Calculate estimated cost based on model used
      const inputTokens = lastAiResponse.inputTokens || 0;
      const outputTokens = lastAiResponse.outputTokens || 0;
      const modelUsed = lastAiResponse.model || selectedModel;

      // Cost rates per million tokens (approximate)
      const isHaiku = modelUsed.includes('haiku');
      const inputCostPerM = isHaiku ? 0.075 : 0.90;  // Haiku vs Sonnet
      const outputCostPerM = isHaiku ? 0.375 : 4.50;  // Haiku vs Sonnet

      const estimatedCostUsd = (
        (inputTokens / 1_000_000) * inputCostPerM +
        (outputTokens / 1_000_000) * outputCostPerM
      );

      // Calculate savings: what it would cost on Sonnet vs what was actually paid
      const sonnetCostUsd = (
        (inputTokens / 1_000_000) * 0.90 +
        (outputTokens / 1_000_000) * 4.50
      );
      const savingsUsd = sonnetCostUsd - estimatedCostUsd;
      const savingsPercent = sonnetCostUsd > 0 ? (savingsUsd / sonnetCostUsd) * 100 : 0;

      logger.info(`Chat completed in ${executionTime}ms using ${lastAiResponse.actualProvider || 'AI'} (${toolsExecuted.length} tools executed, model: ${modelUsed}, complexity: ${complexity})`);

      return reply.send({
        success: true,
        result: {
          response: responseContent.trim(),
          tools_executed: toolsExecuted.length > 0 ? toolsExecuted : undefined,
          ai_metadata: {
            used_real_ai: true,
            provider: lastAiResponse.actualProvider,
            model: lastAiResponse.model,
            complexity,  // Feature #1941: Include complexity level
            tokens: {
              input: lastAiResponse.inputTokens,
              output: lastAiResponse.outputTokens,
            },
            // Feature #1941: Cost tracking
            cost: {
              estimated_usd: Number(estimatedCostUsd.toFixed(6)),
              savings_usd: Number(savingsUsd.toFixed(6)),
              savings_percent: Number(savingsPercent.toFixed(1)),
            },
          },
        },
        tool_used: toolsExecuted.length > 0 ? toolsExecuted.map(t => t.tool).join(', ') : 'ai_chat',
        metadata: {
          used_real_ai: true,
          provider: lastAiResponse.actualProvider,
          model: lastAiResponse.model,
          complexity,  // Feature #1941
          execution_time_ms: executionTime,
          tools_called: toolsExecuted.length,
        },
      });
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error(`Chat failed: ${errorMessage}`, error);

      return reply.status(500).send({
        success: false,
        error: errorMessage,
        execution_time_ms: executionTime,
      });
    }
  });

  /**
   * POST /api/v1/mcp/chat/vision
   * AI-powered chat endpoint with Claude Vision for visual regression analysis
   * Feature #1947: Smart image handling - use Vision API only for visual regression tests
   */
  fastify.post<{
    Body: {
      message: string;
      image: {
        data: string;  // Base64 encoded image (JPEG)
        media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
      };
      context?: {
        test_type?: string;
        diff_percentage?: number;
        viewport?: { width: number; height: number };
      };
      complexity?: 'simple' | 'complex';
    };
  }>('/chat/vision', async (request, reply) => {
    const startTime = Date.now();

    try {
      const { message, image, context = {}, complexity = 'complex' } = request.body;

      if (!message) {
        return reply.status(400).send({
          success: false,
          error: 'Missing required parameter: message',
        });
      }

      if (!image?.data) {
        return reply.status(400).send({
          success: false,
          error: 'Missing required parameter: image.data',
        });
      }

      // Ensure AI is initialized
      ensureAIInitialized();

      // Check if vision is available (requires Anthropic)
      if (!aiRouter.isVisionAvailable()) {
        return reply.status(503).send({
          success: false,
          error: 'Vision API requires Anthropic provider which is not initialized. Check ANTHROPIC_API_KEY in .env',
          metadata: {
            used_real_ai: false,
            execution_time_ms: Date.now() - startTime,
          },
        });
      }

      logger.info(`[Vision] Processing visual analysis: ${context.diff_percentage?.toFixed(2) || 0}% diff, ${context.viewport?.width || 0}x${context.viewport?.height || 0}`);

      // Build the vision message with image content
      // Claude Vision API format: content array with text and image blocks
      const visionMessage = {
        role: 'user' as const,
        content: [
          {
            type: 'image' as const,
            source: {
              type: 'base64' as const,
              media_type: image.media_type,
              data: image.data,
            },
          },
          {
            type: 'text' as const,
            text: message,
          },
        ],
      };

      // Use Claude Sonnet 4 for vision analysis (best for visual understanding)
      const visionModel = 'claude-sonnet-4-20250514';

      const aiResponse = await aiRouter.sendVisionMessage(
        [visionMessage],
        {
          model: visionModel,
          maxTokens: 2000,
          temperature: 0.3,
          systemPrompt: `You are a visual QA expert analyzing visual regression test results.
Your job is to describe UI changes shown in diff images and help QA engineers understand what changed.

When analyzing a diff image:
1. Focus on the highlighted regions (usually shown in magenta/pink)
2. Describe what UI elements appear to have changed
3. Assess the severity of the changes (critical, moderate, minor)
4. Recommend whether to approve as new baseline or investigate

Be specific and actionable in your recommendations.`,
        }
      );

      const executionTime = Date.now() - startTime;

      logger.info(`[Vision] Analysis completed in ${executionTime}ms using ${aiResponse.actualProvider}`);

      return reply.send({
        success: true,
        result: {
          response: aiResponse.content,
          ai_metadata: {
            used_real_ai: true,
            provider: aiResponse.actualProvider,
            model: aiResponse.model,
            complexity,
            tokens: {
              input: aiResponse.inputTokens,
              output: aiResponse.outputTokens,
            },
            vision: true,
            context: {
              test_type: context.test_type || 'visual',
              diff_percentage: context.diff_percentage,
              viewport: context.viewport,
            },
          },
        },
        metadata: {
          used_real_ai: true,
          provider: aiResponse.actualProvider,
          model: aiResponse.model,
          vision: true,
          execution_time_ms: executionTime,
        },
      });
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error(`[Vision] Analysis failed: ${errorMessage}`, error);

      return reply.status(500).send({
        success: false,
        error: errorMessage,
        metadata: {
          used_real_ai: false,
          vision: true,
          execution_time_ms: executionTime,
        },
      });
    }
  });
}
