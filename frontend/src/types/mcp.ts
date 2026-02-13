/**
 * MCP (Model Context Protocol) domain type definitions
 *
 * Types for MCP tools, playground, chat, and analytics.
 */

// ============================================================================
// MCP Tools (Feature #1232, #1233)
// ============================================================================

export interface MCPToolInfo {
  name: string;
  description: string;
  category: string;
  permission: 'read' | 'write' | 'execute' | 'admin';
  inputSchema?: {
    type: string;
    properties?: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
      default?: unknown;
    }>;
    required?: string[];
  };
}

// ============================================================================
// MCP Analytics (Feature #1234)
// ============================================================================

export interface MCPUsageStats {
  tool_name: string;
  call_count: number;
  success_count: number;
  error_count: number;
  avg_duration_ms: number;
  last_used: string;
}

export interface MCPTimeSeriesData {
  date: string;
  calls: number;
  errors: number;
}

// ============================================================================
// MCP Chat (Feature #1295)
// ============================================================================

/** Feature #1729: Quick action button interface */
export interface QuickAction {
  label: string;
  command: string;
  icon?: string;
  variant?: 'default' | 'primary' | 'secondary';
}

export interface MCPChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  toolCalled?: string;
  toolResult?: string;
  isCommand?: boolean;
  aiMetadata?: {
    used_real_ai: boolean;
    provider?: string;
    model?: string;
    execution_time_ms?: number;
  };
  /** Feature #1729: Quick action buttons */
  actions?: QuickAction[];
}
