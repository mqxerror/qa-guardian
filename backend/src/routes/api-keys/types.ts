// API Key Types and Interfaces

// In-memory API key store for development
export interface ApiKey {
  id: string;
  organization_id: string;
  name: string;
  key_hash: string;
  key_prefix: string;  // e.g., "qg_abc1..."
  scopes: string[];    // ['read', 'execute', 'write', 'admin']
  last_used_at: Date | null;
  expires_at: Date | null;
  created_by: string;
  created_at: Date;
  revoked_at: Date | null;
  // Rate limiting configuration (per API key)
  rate_limit?: number;           // Max requests per window (default: 100)
  rate_limit_window?: number;    // Window size in seconds (default: 60)
  burst_limit?: number;          // Max burst requests allowed above rate_limit (default: 20)
  burst_window?: number;         // Burst window in seconds (default: 10)
}

export interface CreateApiKeyBody {
  name: string;
  scopes?: string[];
  expires_in_days?: number;
  // Rate limiting configuration (optional, defaults apply)
  rate_limit?: number;           // Max requests per window (default: 100)
  rate_limit_window?: number;    // Window size in seconds (default: 60)
  burst_limit?: number;          // Max burst requests allowed above rate_limit (default: 20)
  burst_window?: number;         // Burst window in seconds (default: 10)
}

export interface OrgParams {
  orgId: string;
}

export interface KeyParams {
  id: string;
}

// Feature #405: Track active MCP connections
export interface McpConnection {
  id: string;
  api_key_id: string;
  api_key_name: string;
  organization_id: string;
  connected_at: Date;
  last_activity_at: Date;
  client_info?: {
    name?: string;
    version?: string;
    user_agent?: string;
  };
  ip_address?: string;
}

// Feature #406: Track MCP tool usage
export interface McpToolCall {
  id: string;
  connection_id: string;
  organization_id: string;
  api_key_id: string;
  tool_name: string;
  timestamp: Date;
  duration_ms?: number;
  success: boolean;
  error?: string;
}

// Feature #846: MCP Audit Log Entry interface
export interface McpAuditLogEntry {
  id: string;
  timestamp: Date;
  organization_id: string;
  api_key_id: string;
  api_key_name: string;
  connection_id?: string;
  client_name?: string;
  client_version?: string;
  method: string; // tools/call, resources/read, etc.
  tool_name?: string; // for tool calls
  resource_uri?: string; // for resource reads
  request_params?: Record<string, unknown>;
  response_type: 'success' | 'error';
  response_error_code?: number;
  response_error_message?: string;
  response_data_preview?: string; // First 500 chars of response
  duration_ms?: number;
  ip_address?: string;
  user_agent?: string;
}
