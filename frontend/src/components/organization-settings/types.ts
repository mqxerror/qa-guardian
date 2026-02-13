/**
 * Types for OrganizationSettingsPage components
 * Feature #709: Extract inline interfaces from OrganizationSettingsPage god component
 */

// Session Management Types
export interface SessionInfo {
  id: string;
  device: string;
  browser: string;
  ip_address: string;
  last_active: string;
  created_at: string;
  is_current: boolean;
}

// Slack Integration Types
export interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
}

export interface SlackConnectionData {
  connected: boolean;
  workspace_id?: string;
  workspace_name?: string;
  connected_at?: string;
  connected_by?: string;
  channels?: SlackChannel[];
}

// MCP Connection interface (Feature #594)
export interface MCPConnection {
  id: string;
  api_key_id: string;
  api_key_name: string;
  connected_at: string;
  last_activity_at: string;
  connected_duration_formatted: string;
  client_info?: {
    transport?: string;
    user_agent?: string;
  };
  ip_address?: string;
}

// Feature #846: MCP Audit Log interface
export interface McpAuditLogEntry {
  id: string;
  timestamp: string;
  api_key_id: string;
  api_key_name: string;
  connection_id?: string;
  client_name?: string;
  client_version?: string;
  method: string;
  tool_name?: string;
  resource_uri?: string;
  request_params?: Record<string, unknown>;
  response_type: 'success' | 'error';
  response_error_code?: number;
  response_error_message?: string;
  response_data_preview?: string;
  duration_ms?: number;
  ip_address?: string;
  user_agent?: string;
}

// Feature #848: MCP Analytics Dashboard interface
export interface McpAnalytics {
  total_calls: number;
  successful_calls: number;
  failed_calls: number;
  by_tool: Record<string, { count: number; avg_duration_ms?: number; success_rate: number }>;
  by_api_key: Record<string, { name: string; count: number }>;
  by_day: Array<{ date: string; total: number; success: number; failed: number }>;
  avg_response_time_ms: number;
}

// Feature #1232: MCP Tools Catalog interface
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

// Artifact Retention Types
export interface CleanupPreview {
  runs_to_delete: number;
  runs_preserved: number;
  trace_files_to_delete: number;
  estimated_space_freed_mb: number;
}

export interface CleanupResult {
  runs_deleted: number;
  trace_files_deleted: number;
  mb_freed: number;
}

// Storage Usage Types
export interface StorageProjectBreakdown {
  project_id: string;
  project_name: string;
  bytes: number;
  mb: number;
  trace_count: number;
}

export interface StorageUsageData {
  total_bytes: number;
  total_mb: number;
  total_trace_files: number;
  storage_limit_mb: number;
  usage_percent: number;
  is_warning: boolean;
  warning_threshold_percent: number;
  project_breakdown: StorageProjectBreakdown[];
}

// Organization Members (for transfer ownership)
export interface OrgMember {
  user_id: string;
  name: string;
  email: string;
  role: string;
}
