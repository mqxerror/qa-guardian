/**
 * Test Runs - Alert Channels Routes Module
 * Feature #1356: Alert channel management routes for projects
 *
 * Extracted from test-runs.ts for code quality (#1356)
 */

import { FastifyInstance } from 'fastify';
import { authenticate, getOrganizationId, JwtPayload } from '../../middleware/auth';
import { projects } from '../projects';
import {
  AlertCondition,
  AlertChannelType,
  AlertChannel,
  alertChannels,
  emailLog,
  webhookLog,
  slackConnections,
} from './alerts';

// ============================================================================
// Route Registration
// ============================================================================

export async function alertChannelRoutes(app: FastifyInstance) {
  // ========== ALERT CHANNEL ENDPOINTS ==========

  // List alert channels for a project
  app.get<{ Params: { projectId: string } }>('/api/v1/projects/:projectId/alerts', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { projectId } = request.params;
    const orgId = getOrganizationId(request);

    // Verify project exists and belongs to user's organization
    const project = projects.get(projectId);
    if (!project || project.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Project not found',
      });
    }

    const channels = Array.from(alertChannels.values())
      .filter(ch => ch.project_id === projectId)
      .map(ch => ({
        id: ch.id,
        name: ch.name,
        type: ch.type,
        enabled: ch.enabled,
        condition: ch.condition,
        threshold_percent: ch.threshold_percent,
        suppress_on_retry_success: ch.suppress_on_retry_success,
        email_addresses: ch.email_addresses,
        webhook_url: ch.webhook_url,
        slack_channel: ch.slack_channel,
        created_at: ch.created_at.toISOString(),
        updated_at: ch.updated_at.toISOString(),
      }));

    return { channels };
  });

  // Create alert channel for a project
  app.post<{
    Params: { projectId: string };
    Body: {
      name: string;
      type: AlertChannelType;
      condition: AlertCondition;
      threshold_percent?: number;
      email_addresses?: string[];
      webhook_url?: string;
      slack_channel?: string;
      enabled?: boolean;
      suppress_on_retry_success?: boolean;
    };
  }>('/api/v1/projects/:projectId/alerts', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { projectId } = request.params;
    const { name, type, condition, threshold_percent, email_addresses, webhook_url, slack_channel, enabled = true, suppress_on_retry_success = false } = request.body;
    const orgId = getOrganizationId(request);
    const user = request.user as JwtPayload;

    // Only owner/admin/developer can create alert channels
    if (!['owner', 'admin', 'developer'].includes(user.role)) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Only owners, admins, and developers can create alert channels',
      });
    }

    // Verify project exists and belongs to user's organization
    const project = projects.get(projectId);
    if (!project || project.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Project not found',
      });
    }

    // Validate required fields
    if (!name || !type || !condition) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Name, type, and condition are required',
      });
    }

    // Validate email addresses for email type
    if (type === 'email' && (!email_addresses || email_addresses.length === 0)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'At least one email address is required for email alerts',
      });
    }

    // Validate webhook URL for webhook type
    if (type === 'webhook' && (!webhook_url || !webhook_url.startsWith('http'))) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'A valid webhook URL is required (must start with http:// or https://)',
      });
    }

    // Validate Slack channel for slack type
    if (type === 'slack') {
      // Check if Slack is connected
      const slackConnection = slackConnections.get(orgId);
      if (!slackConnection) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Slack workspace must be connected before creating Slack alerts',
        });
      }
      if (!slack_channel) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'A Slack channel is required for Slack alerts',
        });
      }
      // Verify channel exists
      const validChannel = slackConnection.channels.find(c => c.id === slack_channel);
      if (!validChannel) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid Slack channel selected',
        });
      }
    }

    // Validate threshold for threshold condition
    if (condition === 'threshold' && (threshold_percent === undefined || threshold_percent < 0 || threshold_percent > 100)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Threshold percent must be between 0 and 100',
      });
    }

    const id = crypto.randomUUID();
    const now = new Date();

    const channel: AlertChannel = {
      id,
      project_id: projectId,
      organization_id: orgId,
      name,
      type,
      enabled,
      condition,
      threshold_percent: condition === 'threshold' ? threshold_percent : undefined,
      suppress_on_retry_success,
      email_addresses: type === 'email' ? email_addresses : undefined,
      webhook_url: type === 'webhook' ? webhook_url : undefined,
      slack_channel: type === 'slack' ? slack_channel : undefined,
      created_at: now,
      updated_at: now,
    };

    alertChannels.set(id, channel);

    console.log(`[ALERT] Created ${type} alert channel "${name}" for project ${projectId} by ${user.email}`);

    return reply.status(201).send({
      channel: {
        id: channel.id,
        name: channel.name,
        type: channel.type,
        enabled: channel.enabled,
        condition: channel.condition,
        threshold_percent: channel.threshold_percent,
        suppress_on_retry_success: channel.suppress_on_retry_success,
        email_addresses: channel.email_addresses,
        webhook_url: channel.webhook_url,
        slack_channel: channel.slack_channel,
        created_at: channel.created_at.toISOString(),
        updated_at: channel.updated_at.toISOString(),
      },
      message: 'Alert channel created successfully',
    });
  });

  // Update alert channel
  app.put<{
    Params: { projectId: string; channelId: string };
    Body: {
      name?: string;
      condition?: AlertCondition;
      threshold_percent?: number;
      email_addresses?: string[];
      slack_channel?: string;
      enabled?: boolean;
      suppress_on_retry_success?: boolean;
    };
  }>('/api/v1/projects/:projectId/alerts/:channelId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { projectId, channelId } = request.params;
    const { name, condition, threshold_percent, email_addresses, slack_channel, enabled, suppress_on_retry_success } = request.body;
    const orgId = getOrganizationId(request);
    const user = request.user as JwtPayload;

    // Only owner/admin/developer can update alert channels
    if (!['owner', 'admin', 'developer'].includes(user.role)) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Only owners, admins, and developers can update alert channels',
      });
    }

    // Get channel
    const channel = alertChannels.get(channelId);
    if (!channel || channel.project_id !== projectId || channel.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Alert channel not found',
      });
    }

    // Update fields
    if (name !== undefined) channel.name = name;
    if (condition !== undefined) channel.condition = condition;
    if (enabled !== undefined) channel.enabled = enabled;
    if (suppress_on_retry_success !== undefined) channel.suppress_on_retry_success = suppress_on_retry_success;
    if (channel.type === 'email' && email_addresses !== undefined) {
      channel.email_addresses = email_addresses;
    }
    if (channel.type === 'slack' && slack_channel !== undefined) {
      channel.slack_channel = slack_channel;
    }
    if (channel.condition === 'threshold' && threshold_percent !== undefined) {
      channel.threshold_percent = threshold_percent;
    }

    channel.updated_at = new Date();
    alertChannels.set(channelId, channel);

    console.log(`[ALERT] Updated alert channel "${channel.name}" (${channelId}) by ${user.email}`);

    return {
      channel: {
        id: channel.id,
        name: channel.name,
        type: channel.type,
        enabled: channel.enabled,
        condition: channel.condition,
        threshold_percent: channel.threshold_percent,
        suppress_on_retry_success: channel.suppress_on_retry_success,
        email_addresses: channel.email_addresses,
        webhook_url: channel.webhook_url,
        slack_channel: channel.slack_channel,
        created_at: channel.created_at.toISOString(),
        updated_at: channel.updated_at.toISOString(),
      },
      message: 'Alert channel updated successfully',
    };
  });

  // Delete alert channel
  app.delete<{ Params: { projectId: string; channelId: string } }>(
    '/api/v1/projects/:projectId/alerts/:channelId',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const { projectId, channelId } = request.params;
      const orgId = getOrganizationId(request);
      const user = request.user as JwtPayload;

      // Only owner/admin/developer can delete alert channels
      if (!['owner', 'admin', 'developer'].includes(user.role)) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Only owners, admins, and developers can delete alert channels',
        });
      }

      // Get channel
      const channel = alertChannels.get(channelId);
      if (!channel || channel.project_id !== projectId || channel.organization_id !== orgId) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Alert channel not found',
        });
      }

      alertChannels.delete(channelId);

      console.log(`[ALERT] Deleted alert channel "${channel.name}" (${channelId}) by ${user.email}`);

      return {
        message: 'Alert channel deleted successfully',
      };
    }
  );

  // Get recent email logs (development only - for testing)
  app.get('/api/v1/email-logs', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const orgId = getOrganizationId(request);

    // Filter logs by organization (via project)
    const orgProjects = Array.from(projects.values())
      .filter(p => p.organization_id === orgId)
      .map(p => p.id);

    const logs = emailLog
      .filter(log => orgProjects.includes(log.projectId))
      .slice(0, 20)
      .map(log => ({
        timestamp: log.timestamp.toISOString(),
        to: log.to,
        subject: log.subject,
        runId: log.runId,
        projectId: log.projectId,
        // Truncate body for listing
        bodyPreview: log.body.substring(0, 200) + '...',
      }));

    return { logs };
  });

  // Get recent webhook logs (development only - for testing)
  app.get('/api/v1/webhook-logs', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const orgId = getOrganizationId(request);

    // Filter logs by organization (via project)
    const orgProjects = Array.from(projects.values())
      .filter(p => p.organization_id === orgId)
      .map(p => p.id);

    const logs = webhookLog
      .filter(log => orgProjects.includes(log.projectId))
      .slice(0, 20)
      .map(log => ({
        timestamp: log.timestamp.toISOString(),
        url: log.url,
        runId: log.runId,
        projectId: log.projectId,
        success: log.success,
        responseStatus: log.responseStatus,
        error: log.error,
        payloadPreview: JSON.stringify(log.payload).substring(0, 200) + '...',
      }));

    return { logs };
  });

  // Get unified alert history (combines email and webhook logs)
  app.get('/api/v1/alert-history', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const orgId = getOrganizationId(request);

    // Filter by organization
    const orgProjects = Array.from(projects.values())
      .filter(p => p.organization_id === orgId)
      .map(p => p.id);

    // Build unified alert history from both email and webhook logs
    interface AlertHistoryEntry {
      id: string;
      timestamp: string;
      type: 'email' | 'webhook';
      channelId: string;
      channelName: string;
      projectId: string;
      runId: string;
      success: boolean;
      error?: string;
      details: {
        recipients?: string[];
        subject?: string;
        webhookUrl?: string;
        responseStatus?: number;
      };
    }

    const history: AlertHistoryEntry[] = [];

    // Add email logs
    emailLog
      .filter(log => orgProjects.includes(log.projectId))
      .forEach((log, index) => {
        history.push({
          id: `email-${log.timestamp.getTime()}-${index}`,
          timestamp: log.timestamp.toISOString(),
          type: 'email',
          channelId: log.channelId,
          channelName: log.channelName,
          projectId: log.projectId,
          runId: log.runId,
          success: log.success,
          error: log.error,
          details: {
            recipients: log.to,
            subject: log.subject,
          },
        });
      });

    // Add webhook logs
    webhookLog
      .filter(log => orgProjects.includes(log.projectId))
      .forEach((log, index) => {
        history.push({
          id: `webhook-${log.timestamp.getTime()}-${index}`,
          timestamp: log.timestamp.toISOString(),
          type: 'webhook',
          channelId: log.channelId ?? '',
          channelName: log.channelName ?? '',
          projectId: log.projectId,
          runId: log.runId,
          success: log.success,
          error: log.error,
          details: {
            webhookUrl: log.url,
            responseStatus: log.responseStatus,
          },
        });
      });

    // Sort by timestamp descending (most recent first)
    history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Get project names for display
    const projectNames: Record<string, string> = {};
    orgProjects.forEach(projectId => {
      const project = projects.get(projectId);
      if (project) {
        projectNames[projectId] = project.name;
      }
    });

    return {
      history: history.slice(0, 50), // Return up to 50 entries
      projectNames,
      total: history.length,
    };
  });
}

// Re-export types for consumers
export {
  AlertCondition,
  AlertChannelType,
  AlertChannel,
  alertChannels,
} from './alerts';
