/**
 * MCP Tools Execution Types
 *
 * Type definitions for the MCP tools REST API endpoints.
 */

/**
 * Request body for executing an MCP tool
 */
export interface ExecuteToolRequest {
  /** Name of the MCP tool to execute */
  tool_name: string;
  /** Arguments to pass to the tool */
  args: Record<string, unknown>;
  /** Whether to force using real AI (not template fallback) */
  use_real_ai?: boolean;
}

/**
 * Response from executing an MCP tool
 */
export interface ExecuteToolResponse {
  /** Whether the tool executed successfully */
  success: boolean;
  /** Result from the tool handler */
  result?: unknown;
  /** Error message if failed */
  error?: string;
  /** Metadata about the execution */
  metadata: {
    /** Which tool was executed */
    tool_name: string;
    /** Whether real AI was used */
    used_real_ai: boolean;
    /** Which AI provider was used (if any) */
    provider?: string;
    /** Which model was used (if any) */
    model?: string;
    /** Execution time in milliseconds */
    execution_time_ms: number;
    /** Token usage (if AI was used) */
    tokens?: {
      input: number;
      output: number;
    };
  };
}

/**
 * AI provider status
 */
export interface AIProviderStatus {
  /** Whether any AI provider is available */
  available: boolean;
  /** Primary provider status */
  primary: {
    name: string;
    available: boolean;
    model?: string;
  };
  /** Fallback provider status */
  fallback: {
    name: string;
    available: boolean;
    model?: string;
  };
}

/**
 * Response from AI status endpoint
 */
export interface AIStatusResponse {
  /** Whether AI is ready to use */
  ready: boolean;
  /** Provider status details */
  providers: AIProviderStatus;
  /** Message about current status */
  message: string;
}

/**
 * List of available MCP tools
 */
export interface AvailableToolsResponse {
  /** Total number of available tools */
  total: number;
  /** List of tool names by category */
  categories: Record<string, string[]>;
  /** AI-powered tools specifically */
  ai_tools: string[];
}
