/**
 * Test Runs - Slack Integration Routes Module
 * Feature #1356: Slack workspace connection and alert delivery routes
 *
 * Extracted from test-runs.ts for code quality (#1356)
 */

import { FastifyInstance } from 'fastify';
import { authenticate, getOrganizationId, JwtPayload } from '../../middleware/auth';
import { projects } from '../projects';
import {
  SlackConnection,
  SlackChannel,
  slackConnections,
  slackLog,
} from './alerts';

// ============================================================================
// Route Registration
// ============================================================================

export async function slackIntegrationRoutes(app: FastifyInstance) {
  // ========== SLACK INTEGRATION ENDPOINTS ==========

  // Get Slack connection status for organization
  app.get<{ Params: { orgId: string } }>('/api/v1/organizations/:orgId/slack', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { orgId } = request.params;
    const userOrgId = getOrganizationId(request);

    if (orgId !== userOrgId) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You do not have access to this organization',
      });
    }

    const connection = slackConnections.get(orgId);
    if (!connection) {
      return {
        connected: false,
      };
    }

    return {
      connected: true,
      workspace_id: connection.workspace_id,
      workspace_name: connection.workspace_name,
      connected_at: connection.connected_at.toISOString(),
      connected_by: connection.connected_by,
      channels: connection.channels,
    };
  });

  // Connect Slack workspace (simulated OAuth flow for development)
  // In production, this would redirect to Slack OAuth and handle the callback
  app.post<{ Params: { orgId: string }; Body: { workspace_name?: string } }>(
    '/api/v1/organizations/:orgId/slack/connect',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const { orgId } = request.params;
      const { workspace_name } = request.body || {};
      const userOrgId = getOrganizationId(request);
      const user = request.user as JwtPayload;

      if (orgId !== userOrgId) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'You do not have access to this organization',
        });
      }

      // Only owners and admins can connect Slack
      if (!['owner', 'admin'].includes(user.role)) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Only owners and admins can connect Slack',
        });
      }

      // Check if already connected
      if (slackConnections.has(orgId)) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Slack is already connected for this organization',
        });
      }

      // Simulate Slack OAuth - in production this would be a real OAuth flow
      const workspaceName = workspace_name || 'Dev Workspace';
      const workspaceId = `W${Date.now()}`;

      // Create simulated Slack channels (in production, these would come from the Slack API)
      const mockChannels: SlackChannel[] = [
        { id: 'C001', name: 'general', is_private: false },
        { id: 'C002', name: 'qa-alerts', is_private: false },
        { id: 'C003', name: 'test-failures', is_private: false },
        { id: 'C004', name: 'engineering', is_private: false },
        { id: 'C005', name: 'dev-team', is_private: true },
      ];

      const connection: SlackConnection = {
        organization_id: orgId,
        workspace_id: workspaceId,
        workspace_name: workspaceName,
        bot_access_token: `xoxb-dev-${Date.now()}`, // Simulated bot token
        connected_at: new Date(),
        connected_by: user.email,
        channels: mockChannels,
      };

      slackConnections.set(orgId, connection);

      console.log(`[SLACK] Connected workspace "${workspaceName}" (${workspaceId}) for organization ${orgId} by ${user.email}`);

      return reply.status(201).send({
        connected: true,
        workspace_id: connection.workspace_id,
        workspace_name: connection.workspace_name,
        connected_at: connection.connected_at.toISOString(),
        connected_by: connection.connected_by,
        channels: connection.channels,
        message: 'Slack workspace connected successfully',
      });
    }
  );

  // Disconnect Slack workspace
  app.delete<{ Params: { orgId: string } }>('/api/v1/organizations/:orgId/slack', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { orgId } = request.params;
    const userOrgId = getOrganizationId(request);
    const user = request.user as JwtPayload;

    if (orgId !== userOrgId) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You do not have access to this organization',
      });
    }

    // Only owners and admins can disconnect Slack
    if (!['owner', 'admin'].includes(user.role)) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Only owners and admins can disconnect Slack',
      });
    }

    const connection = slackConnections.get(orgId);
    if (!connection) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'No Slack workspace connected',
      });
    }

    slackConnections.delete(orgId);

    console.log(`[SLACK] Disconnected workspace "${connection.workspace_name}" from organization ${orgId} by ${user.email}`);

    return {
      message: 'Slack workspace disconnected successfully',
    };
  });

  // Get Slack channels for organization (for alert configuration)
  app.get<{ Params: { orgId: string } }>('/api/v1/organizations/:orgId/slack/channels', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { orgId } = request.params;
    const userOrgId = getOrganizationId(request);

    if (orgId !== userOrgId) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You do not have access to this organization',
      });
    }

    const connection = slackConnections.get(orgId);
    if (!connection) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'No Slack workspace connected',
      });
    }

    return {
      channels: connection.channels,
    };
  });

  // Get recent Slack alert logs (development only)
  app.get('/api/v1/slack-logs', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const orgId = getOrganizationId(request);

    // Filter logs by organization (via project)
    const orgProjects = Array.from(projects.values())
      .filter(p => p.organization_id === orgId)
      .map(p => p.id);

    const logs = slackLog
      .filter(log => orgProjects.includes(log.projectId))
      .slice(0, 20)
      .map(log => ({
        timestamp: log.timestamp.toISOString(),
        channel: log.channel,
        channelName: log.channelName,
        runId: log.runId,
        projectId: log.projectId,
        alertChannelName: log.alertChannelName,
        success: log.success,
        error: log.error,
        messagePreview: log.message.substring(0, 200) + '...',
      }));

    return { logs };
  });
}

// Re-export types for consumers
export { SlackConnection, SlackChannel, slackConnections, slackLog } from './alerts';
