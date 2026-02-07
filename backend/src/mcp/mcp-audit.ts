/**
 * MCP Audit Logging Module
 *
 * Handles audit log entries for the MCP server.
 * Extracted from server.ts to reduce file size (Feature #252).
 *
 * @module mcp-audit
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Logger function type
 */
export type LogFunction = (message: string) => void;

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  method: string;
  tool_name?: string;
  resource_uri?: string;
  request_params?: Record<string, unknown>;
  response_type: 'success' | 'error';
  response_error_code?: number;
  response_error_message?: string;
  response_data_preview?: string;
  duration_ms?: number;
  streaming?: boolean;
  stream_id?: string;
}

/**
 * Configuration for audit logging
 */
export interface AuditConfig {
  apiKey?: string;
  apiUrl: string;
  connectionId?: string;
  clientName?: string;
  clientVersion?: string;
}

// ============================================================================
// Audit Logger Class
// ============================================================================

/**
 * Manages audit logging for MCP operations.
 */
export class AuditLogger {
  private readonly config: AuditConfig;
  private readonly log: LogFunction;

  constructor(config: AuditConfig, log: LogFunction = () => {}) {
    this.config = config;
    this.log = log;
  }

  /**
   * Send an audit log entry to the backend.
   */
  async sendAuditLog(entry: AuditLogEntry): Promise<void> {
    // Don't log if no API key configured
    if (!this.config.apiKey) {
      return;
    }

    try {
      await fetch(`${this.config.apiUrl}/api/v1/mcp/audit-log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: this.config.apiKey,
          connection_id: this.config.connectionId,
          client_name: this.config.clientName,
          client_version: this.config.clientVersion,
          ...entry,
        }),
      });
    } catch (error) {
      // Don't fail the main request if audit logging fails
      this.log(`[AUDIT] Failed to send audit log: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update connection info for audit logging.
   */
  updateConnectionInfo(connectionId: string, clientName?: string, clientVersion?: string): void {
    (this.config as AuditConfig).connectionId = connectionId;
    (this.config as AuditConfig).clientName = clientName;
    (this.config as AuditConfig).clientVersion = clientVersion;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create an audit logger instance.
 */
export function createAuditLogger(
  config: AuditConfig,
  log?: LogFunction
): AuditLogger {
  return new AuditLogger(config, log);
}
