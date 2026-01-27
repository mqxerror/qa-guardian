// MCP Connection and Analytics routes

import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { authenticate, requireRoles, JwtPayload } from '../../middleware/auth';
import { ApiKey, OrgParams } from './types';
import { apiKeys, mcpConnections } from './stores';
import { formatDuration } from './utils';
import {
  registerMcpConnection,
  updateMcpActivity,
  unregisterMcpConnection,
} from './mcp-connections';
import { trackMcpToolCall, getMcpAnalytics } from './mcp-analytics';
import { logMcpAuditEntry, getMcpAuditLogs } from './mcp-audit';

export async function registerMcpRoutes(app: FastifyInstance) {
  // Feature #405: Register MCP connection
  app.post<{ Body: { api_key: string; client_name?: string; client_version?: string } }>('/api/v1/mcp/connect', async (request, reply) => {
    const { api_key, client_name, client_version } = request.body;
    const ip_address = request.ip;

    if (!api_key) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'API key is required',
      });
    }

    const keyHash = crypto.createHash('sha256').update(api_key).digest('hex');

    let foundKey: ApiKey | undefined;
    for (const [, key] of apiKeys) {
      if (key.key_hash === keyHash && !key.revoked_at) {
        foundKey = key;
        break;
      }
    }

    if (!foundKey) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid or revoked API key',
      });
    }

    if (foundKey.expires_at && new Date() > foundKey.expires_at) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'API key has expired',
      });
    }

    const connectionId = registerMcpConnection(
      foundKey.id,
      foundKey.name,
      foundKey.organization_id,
      { name: client_name, version: client_version },
      ip_address
    );

    foundKey.last_used_at = new Date();
    apiKeys.set(foundKey.id, foundKey);

    return {
      connection_id: connectionId,
      organization_id: foundKey.organization_id,
      message: 'MCP connection registered successfully',
    };
  });

  // Feature #405: Update MCP connection activity (heartbeat)
  app.post<{ Body: { connection_id: string } }>('/api/v1/mcp/heartbeat', async (request, reply) => {
    const { connection_id } = request.body;

    if (!connection_id) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Connection ID is required',
      });
    }

    const connection = mcpConnections.get(connection_id);
    if (!connection) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'MCP connection not found or expired',
      });
    }

    updateMcpActivity(connection_id);

    return {
      status: 'ok',
      last_activity_at: connection.last_activity_at,
    };
  });

  // Feature #405: Disconnect MCP connection
  app.post<{ Body: { connection_id: string } }>('/api/v1/mcp/disconnect', async (request, reply) => {
    const { connection_id } = request.body;

    if (!connection_id) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Connection ID is required',
      });
    }

    if (!mcpConnections.has(connection_id)) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'MCP connection not found',
      });
    }

    unregisterMcpConnection(connection_id);

    return {
      status: 'ok',
      message: 'MCP connection disconnected successfully',
    };
  });

  // Feature #405: List active MCP connections for organization
  app.get<{ Params: OrgParams }>('/api/v1/organizations/:orgId/mcp-connections', {
    preHandler: [authenticate, requireRoles(['owner', 'admin'])],
  }, async (request, reply) => {
    const { orgId } = request.params;
    const user = request.user as JwtPayload;

    if (user.organization_id !== orgId) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You can only view MCP connections for your organization',
      });
    }

    const connections = Array.from(mcpConnections.values())
      .filter(conn => conn.organization_id === orgId)
      .map(conn => ({
        id: conn.id,
        api_key_id: conn.api_key_id,
        api_key_name: conn.api_key_name,
        connected_at: conn.connected_at,
        last_activity_at: conn.last_activity_at,
        connected_duration_ms: Date.now() - conn.connected_at.getTime(),
        connected_duration_formatted: formatDuration(Date.now() - conn.connected_at.getTime()),
        idle_time_ms: Date.now() - conn.last_activity_at.getTime(),
        client_info: conn.client_info,
        ip_address: conn.ip_address,
      }));

    connections.sort((a, b) => new Date(b.connected_at).getTime() - new Date(a.connected_at).getTime());

    return {
      mcp_connections: connections,
      total_count: connections.length,
    };
  });

  // Feature #406: Track MCP tool call
  app.post<{ Body: { connection_id: string; tool_name: string; duration_ms?: number; success?: boolean; error?: string } }>('/api/v1/mcp/track-tool', async (request, reply) => {
    const { connection_id, tool_name, duration_ms, success = true, error } = request.body;

    if (!connection_id || !tool_name) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'connection_id and tool_name are required',
      });
    }

    const connection = mcpConnections.get(connection_id);
    if (!connection) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'MCP connection not found',
      });
    }

    trackMcpToolCall(connection_id, tool_name, duration_ms, success, error);
    updateMcpActivity(connection_id);

    return {
      status: 'ok',
      message: 'Tool call tracked successfully',
    };
  });

  // Feature #406: Get MCP usage analytics for organization
  app.get<{ Params: OrgParams; Querystring: { since?: string } }>('/api/v1/organizations/:orgId/mcp-analytics', {
    preHandler: [authenticate, requireRoles(['owner', 'admin'])],
  }, async (request, reply) => {
    const { orgId } = request.params;
    const { since } = request.query;
    const user = request.user as JwtPayload;

    if (user.organization_id !== orgId) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You can only view MCP analytics for your organization',
      });
    }

    let sinceDate: Date | undefined;
    if (since) {
      sinceDate = new Date(since);
      if (isNaN(sinceDate.getTime())) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid since date format',
        });
      }
    }

    const analytics = getMcpAnalytics(orgId, sinceDate);

    return {
      analytics,
      period: sinceDate ? { since: sinceDate } : { since: 'all-time' },
    };
  });

  // Feature #848: Export MCP analytics as CSV
  app.get<{ Params: OrgParams; Querystring: { since?: string; format?: string } }>('/api/v1/organizations/:orgId/mcp-analytics/export', {
    preHandler: [authenticate, requireRoles(['owner', 'admin'])],
  }, async (request, reply) => {
    const { orgId } = request.params;
    const { since, format = 'csv' } = request.query;
    const user = request.user as JwtPayload;

    if (user.organization_id !== orgId) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You can only export MCP analytics for your organization',
      });
    }

    let sinceDate: Date | undefined;
    if (since) {
      sinceDate = new Date(since);
      if (isNaN(sinceDate.getTime())) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid since date format',
        });
      }
    }

    const analytics = getMcpAnalytics(orgId, sinceDate);

    if (format === 'json') {
      reply.header('Content-Type', 'application/json');
      reply.header('Content-Disposition', `attachment; filename="mcp-analytics-${orgId}.json"`);
      return JSON.stringify(analytics, null, 2);
    }

    const csvLines: string[] = [];
    csvLines.push('# MCP Analytics Export');
    csvLines.push(`# Organization: ${orgId}`);
    csvLines.push(`# Period: ${sinceDate ? sinceDate.toISOString() : 'All Time'} - ${new Date().toISOString()}`);
    csvLines.push('');
    csvLines.push('## Summary');
    csvLines.push('Metric,Value');
    csvLines.push(`Total Calls,${analytics.total_calls}`);
    csvLines.push(`Successful Calls,${analytics.successful_calls}`);
    csvLines.push(`Failed Calls,${analytics.failed_calls}`);
    csvLines.push(`Success Rate,${analytics.total_calls > 0 ? ((analytics.successful_calls / analytics.total_calls) * 100).toFixed(1) : 0}%`);
    csvLines.push(`Avg Response Time (ms),${analytics.avg_response_time_ms}`);
    csvLines.push('');
    csvLines.push('## Requests by Tool');
    csvLines.push('Tool Name,Total Calls,Avg Duration (ms),Success Rate');
    for (const [toolName, stats] of Object.entries(analytics.by_tool)) {
      csvLines.push(`${toolName},${stats.count},${stats.avg_duration_ms || 'N/A'},${(stats.success_rate * 100).toFixed(1)}%`);
    }
    csvLines.push('');
    csvLines.push('## Requests by API Key');
    csvLines.push('API Key ID,API Key Name,Total Calls');
    for (const [keyId, stats] of Object.entries(analytics.by_api_key)) {
      csvLines.push(`${keyId},${stats.name},${stats.count}`);
    }
    csvLines.push('');
    csvLines.push('## Requests by Day');
    csvLines.push('Date,Total,Success,Failed');
    for (const day of analytics.by_day) {
      csvLines.push(`${day.date},${day.total},${day.success},${day.failed}`);
    }

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="mcp-analytics-${orgId}.csv"`);
    return csvLines.join('\n');
  });

  // Feature #846: Get MCP audit logs for organization
  app.get<{
    Params: OrgParams;
    Querystring: {
      limit?: string;
      offset?: string;
      method?: string;
      api_key_id?: string;
      response_type?: 'success' | 'error';
      since?: string;
      until?: string;
    };
  }>('/api/v1/organizations/:orgId/mcp-audit-logs', {
    preHandler: [authenticate, requireRoles(['owner', 'admin'])],
  }, async (request, reply) => {
    const { orgId } = request.params;
    const { limit, offset, method, api_key_id, response_type, since, until } = request.query;
    const user = request.user as JwtPayload;

    if (user.organization_id !== orgId) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You can only view MCP audit logs for your organization',
      });
    }

    let sinceDate: Date | undefined;
    let untilDate: Date | undefined;

    if (since) {
      sinceDate = new Date(since);
      if (isNaN(sinceDate.getTime())) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid since date format',
        });
      }
    }

    if (until) {
      untilDate = new Date(until);
      if (isNaN(untilDate.getTime())) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid until date format',
        });
      }
    }

    const result = getMcpAuditLogs(orgId, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      method,
      api_key_id,
      response_type,
      since: sinceDate,
      until: untilDate,
    });

    return {
      logs: result.logs.map(log => ({
        id: log.id,
        timestamp: log.timestamp.toISOString(),
        api_key_id: log.api_key_id,
        api_key_name: log.api_key_name,
        connection_id: log.connection_id,
        client_name: log.client_name,
        client_version: log.client_version,
        method: log.method,
        tool_name: log.tool_name,
        resource_uri: log.resource_uri,
        request_params: log.request_params,
        response_type: log.response_type,
        response_error_code: log.response_error_code,
        response_error_message: log.response_error_message,
        response_data_preview: log.response_data_preview,
        duration_ms: log.duration_ms,
        ip_address: log.ip_address,
        user_agent: log.user_agent,
      })),
      total: result.total,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    };
  });

  // Feature #846: Log an MCP request (called by MCP server)
  app.post<{
    Body: {
      api_key: string;
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
    };
  }>('/api/v1/mcp/audit-log', async (request, reply) => {
    const {
      api_key,
      connection_id,
      client_name,
      client_version,
      method,
      tool_name,
      resource_uri,
      request_params,
      response_type,
      response_error_code,
      response_error_message,
      response_data_preview,
      duration_ms,
    } = request.body;

    if (!api_key || !method || !response_type) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'api_key, method, and response_type are required',
      });
    }

    const keyHash = crypto.createHash('sha256').update(api_key).digest('hex');

    let foundApiKey: ApiKey | undefined;
    for (const [, key] of apiKeys) {
      if (key.key_hash === keyHash && !key.revoked_at) {
        foundApiKey = key;
        break;
      }
    }

    if (!foundApiKey) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'API key not found',
      });
    }

    const ipAddress = (request.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || request.ip || '127.0.0.1';
    const userAgent = (request.headers['user-agent'] as string) || 'MCP Client';

    logMcpAuditEntry({
      organization_id: foundApiKey.organization_id,
      api_key_id: foundApiKey.id,
      api_key_name: foundApiKey.name,
      connection_id,
      client_name,
      client_version,
      method,
      tool_name,
      resource_uri,
      request_params,
      response_type,
      response_error_code,
      response_error_message,
      response_data_preview,
      duration_ms,
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    return {
      status: 'ok',
      message: 'Audit log entry created',
    };
  });

  // Feature #846: Get audit log methods (for filtering)
  app.get<{ Params: OrgParams }>('/api/v1/organizations/:orgId/mcp-audit-logs/methods', {
    preHandler: [authenticate, requireRoles(['owner', 'admin'])],
  }, async (request, reply) => {
    const { orgId } = request.params;
    const user = request.user as JwtPayload;

    if (user.organization_id !== orgId) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You can only view MCP audit logs for your organization',
      });
    }

    return {
      methods: [
        'initialize',
        'tools/list',
        'tools/call',
        'resources/list',
        'resources/read',
      ],
    };
  });
}
