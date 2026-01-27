/**
 * Status Pages Routes Module
 *
 * Routes for status page management, public status page viewing,
 * and subscriptions.
 *
 * On-call schedules and escalation policies have been moved to:
 * ./on-call-escalation.ts (Feature #1376)
 *
 * Extracted from monitoring.ts (Feature #1375)
 */

import { FastifyInstance } from 'fastify';
import { authenticate, requireRoles, getOrganizationId, JwtPayload } from '../../middleware/auth';
import { logAuditEntry } from '../audit-logs';
import {
  StatusPage,
  StatusPageCheck,
  StatusPageIncident,
  StatusPageIncidentUpdate,
  StatusPageSubscription,
  UptimeCheck,
  CheckResult,
} from './types';
import {
  statusPages,
  statusPagesBySlug,
  statusPageIncidents,
  statusPageSubscriptions,
  uptimeChecks,
  checkResults,
  transactionChecks,
  transactionResults,
  performanceChecks,
  performanceResults,
  dnsChecks,
  dnsResults,
  tcpChecks,
  tcpResults,
  checkIncidents,
} from './stores';

// ================================
// HELPER FUNCTIONS
// ================================

/**
 * Generate a URL-friendly slug from a name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

/**
 * Get check name and status information
 */
function getCheckInfo(
  checkId: string,
  checkType: string
): { name: string; status: 'up' | 'down' | 'degraded' | 'unknown'; uptime?: number; avgResponseTime?: number } | null {
  let check: any = null;
  let results: any[] = [];

  switch (checkType) {
    case 'uptime':
      check = uptimeChecks.get(checkId);
      results = checkResults.get(checkId) || [];
      break;
    case 'transaction':
      check = transactionChecks.get(checkId);
      results = transactionResults.get(checkId) || [];
      break;
    case 'performance':
      check = performanceChecks.get(checkId);
      results = performanceResults.get(checkId) || [];
      break;
    case 'dns':
      check = dnsChecks.get(checkId);
      results = dnsResults.get(checkId) || [];
      break;
    case 'tcp':
      check = tcpChecks.get(checkId);
      results = tcpResults.get(checkId) || [];
      break;
  }

  if (!check) return null;

  // Calculate status from latest result
  const latestResult = results[results.length - 1];
  let status: 'up' | 'down' | 'degraded' | 'unknown' = 'unknown';
  if (latestResult) {
    if (checkType === 'transaction') {
      status = latestResult.status === 'passed' ? 'up' : latestResult.status === 'partial' ? 'degraded' : 'down';
    } else if (checkType === 'performance') {
      status = latestResult.status === 'good' ? 'up' : latestResult.status === 'needs_improvement' ? 'degraded' : 'down';
    } else if (checkType === 'tcp') {
      status = latestResult.port_open ? 'up' : 'down';
    } else {
      status = latestResult.status || 'unknown';
    }
  }

  // Calculate uptime percentage (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentResults = results.filter(r => {
    const date = new Date(r.checked_at || r.received_at);
    return date >= thirtyDaysAgo;
  });

  let uptime = 100;
  let avgResponseTime = 0;

  if (recentResults.length > 0) {
    const upCount = recentResults.filter(r => {
      if (checkType === 'transaction') return r.status === 'passed';
      if (checkType === 'performance') return r.status === 'good' || r.status === 'needs_improvement';
      if (checkType === 'tcp') return r.port_open;
      return r.status === 'up';
    }).length;
    uptime = Math.round((upCount / recentResults.length) * 100 * 10) / 10;

    const responseTimes = recentResults
      .filter(r => r.response_time || r.total_time)
      .map(r => r.response_time || r.total_time);
    if (responseTimes.length > 0) {
      avgResponseTime = Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length);
    }
  }

  return {
    name: check.name,
    status,
    uptime,
    avgResponseTime,
  };
}

/**
 * Notify status page subscribers about incidents
 */
async function notifyStatusPageSubscribers(
  statusPageId: string,
  notification: {
    type: 'incident_created' | 'incident_updated' | 'incident_resolved';
    title: string;
    message: string;
    impact?: string;
    status?: string;
  }
) {
  const statusPage = statusPages.get(statusPageId);
  if (!statusPage) return;

  const subscriptions = statusPageSubscriptions.get(statusPageId) || [];
  const verifiedSubscribers = subscriptions.filter(s => s.verified);

  if (verifiedSubscribers.length === 0) return;

  // In development, log the notification instead of sending emails
  console.log(`[STATUS PAGE NOTIFICATION] Sending to ${verifiedSubscribers.length} subscribers:`);
  console.log(`  Status Page: ${statusPage.name}`);
  console.log(`  Type: ${notification.type}`);
  console.log(`  Title: ${notification.title}`);
  console.log(`  Message: ${notification.message}`);
  if (notification.impact) console.log(`  Impact: ${notification.impact}`);
  if (notification.status) console.log(`  Status: ${notification.status}`);
  console.log(`  Subscribers:`);
  verifiedSubscribers.forEach(s => {
    console.log(`    - ${s.email} (unsubscribe: /api/v1/status/${statusPage.slug}/unsubscribe?token=${s.unsubscribe_token})`);
  });
}

// ================================
// STATUS PAGE ROUTES
// ================================

export async function statusPageRoutes(app: FastifyInstance): Promise<void> {
  // ================================
  // STATUS PAGE CRUD
  // ================================

  // List all status pages for organization
  app.get(
    '/api/v1/monitoring/status-pages',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer'])],
    },
    async (request, reply) => {
      const orgId = getOrganizationId(request);

      const orgStatusPages = Array.from(statusPages.values())
        .filter(sp => sp.organization_id === orgId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return { status_pages: orgStatusPages };
    }
  );

  // Create a new status page
  app.post(
    '/api/v1/monitoring/status-pages',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin'])],
    },
    async (request, reply) => {
      const orgId = getOrganizationId(request);
      const userId = (request.user as JwtPayload).userId;
      const body = request.body as {
        name: string;
        description?: string;
        logo_url?: string;
        favicon_url?: string;
        primary_color?: string;
        show_history_days?: number;
        checks?: StatusPageCheck[];
        is_public?: boolean;
        show_uptime_percentage?: boolean;
        show_response_time?: boolean;
        show_incidents?: boolean;
        custom_slug?: string;
      };

      if (!body.name || body.name.trim().length === 0) {
        return reply.status(400).send({ error: 'Name is required' });
      }

      // Generate or validate slug
      let slug = body.custom_slug ? generateSlug(body.custom_slug) : generateSlug(body.name);

      // Check if slug is already taken
      if (statusPagesBySlug.has(slug)) {
        // Add a random suffix to make it unique
        slug = `${slug}-${Math.random().toString(36).substring(2, 7)}`;
      }

      const statusPage: StatusPage = {
        id: Date.now().toString(),
        organization_id: orgId,
        name: body.name.trim(),
        slug,
        description: body.description,
        logo_url: body.logo_url,
        favicon_url: body.favicon_url,
        primary_color: body.primary_color || '#2563EB',
        show_history_days: body.show_history_days || 30,
        checks: body.checks || [],
        is_public: body.is_public ?? true,
        show_uptime_percentage: body.show_uptime_percentage ?? true,
        show_response_time: body.show_response_time ?? true,
        show_incidents: body.show_incidents ?? true,
        created_by: userId,
        created_at: new Date(),
        updated_at: new Date(),
      };

      statusPages.set(statusPage.id, statusPage);
      statusPagesBySlug.set(slug, statusPage.id);

      // Log audit entry
      await logAuditEntry(
        request,
        orgId,
        userId,
        'create_status_page',
        'status_page',
        statusPage.id,
        { name: statusPage.name, slug: statusPage.slug }
      );

      return reply.status(201).send({ status_page: statusPage });
    }
  );

  // Get a specific status page (authenticated)
  app.get(
    '/api/v1/monitoring/status-pages/:pageId',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer', 'viewer'])],
    },
    async (request, reply) => {
      const orgId = getOrganizationId(request);
      const { pageId } = request.params as { pageId: string };

      const statusPage = statusPages.get(pageId);
      if (!statusPage || statusPage.organization_id !== orgId) {
        return reply.status(404).send({ error: 'Status page not found' });
      }

      return { status_page: statusPage };
    }
  );

  // Update a status page
  app.patch(
    '/api/v1/monitoring/status-pages/:pageId',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin'])],
    },
    async (request, reply) => {
      const orgId = getOrganizationId(request);
      const userId = (request.user as JwtPayload).userId;
      const { pageId } = request.params as { pageId: string };
      const body = request.body as Partial<StatusPage>;

      const statusPage = statusPages.get(pageId);
      if (!statusPage || statusPage.organization_id !== orgId) {
        return reply.status(404).send({ error: 'Status page not found' });
      }

      // If slug is being changed, validate it
      if (body.slug && body.slug !== statusPage.slug) {
        const newSlug = generateSlug(body.slug);
        if (statusPagesBySlug.has(newSlug) && statusPagesBySlug.get(newSlug) !== pageId) {
          return reply.status(400).send({ error: 'Slug is already taken' });
        }
        // Remove old slug mapping
        statusPagesBySlug.delete(statusPage.slug);
        // Add new slug mapping
        statusPagesBySlug.set(newSlug, pageId);
        statusPage.slug = newSlug;
      }

      // Update fields
      if (body.name !== undefined) statusPage.name = body.name;
      if (body.description !== undefined) statusPage.description = body.description;
      if (body.logo_url !== undefined) statusPage.logo_url = body.logo_url;
      if (body.favicon_url !== undefined) statusPage.favicon_url = body.favicon_url;
      if (body.primary_color !== undefined) statusPage.primary_color = body.primary_color;
      if (body.show_history_days !== undefined) statusPage.show_history_days = body.show_history_days;
      if (body.checks !== undefined) statusPage.checks = body.checks;
      if (body.is_public !== undefined) statusPage.is_public = body.is_public;
      if (body.show_uptime_percentage !== undefined) statusPage.show_uptime_percentage = body.show_uptime_percentage;
      if (body.show_response_time !== undefined) statusPage.show_response_time = body.show_response_time;
      if (body.show_incidents !== undefined) statusPage.show_incidents = body.show_incidents;
      if (body.custom_domain !== undefined) statusPage.custom_domain = body.custom_domain;

      statusPage.updated_at = new Date();
      statusPages.set(pageId, statusPage);

      // Log audit entry
      await logAuditEntry(
        request,
        orgId,
        userId,
        'update_status_page',
        'status_page',
        pageId,
        { name: statusPage.name }
      );

      return { status_page: statusPage };
    }
  );

  // Delete a status page
  app.delete(
    '/api/v1/monitoring/status-pages/:pageId',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin'])],
    },
    async (request, reply) => {
      const orgId = getOrganizationId(request);
      const userId = (request.user as JwtPayload).userId;
      const { pageId } = request.params as { pageId: string };

      const statusPage = statusPages.get(pageId);
      if (!statusPage || statusPage.organization_id !== orgId) {
        return reply.status(404).send({ error: 'Status page not found' });
      }

      // Remove slug mapping
      statusPagesBySlug.delete(statusPage.slug);
      // Remove status page
      statusPages.delete(pageId);

      // Log audit entry
      await logAuditEntry(
        request,
        orgId,
        userId,
        'delete_status_page',
        'status_page',
        pageId,
        { name: statusPage.name }
      );

      return { success: true };
    }
  );

  // Get available checks for status page configuration
  app.get(
    '/api/v1/monitoring/status-pages/available-checks',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer'])],
    },
    async (request, reply) => {
      const orgId = getOrganizationId(request);

      const availableChecks: { id: string; type: string; name: string; enabled: boolean }[] = [];

      // Uptime checks
      for (const [id, check] of uptimeChecks) {
        if (check.organization_id === orgId) {
          availableChecks.push({ id, type: 'uptime', name: check.name, enabled: check.enabled });
        }
      }

      // Transaction checks
      for (const [id, check] of transactionChecks) {
        if (check.organization_id === orgId) {
          availableChecks.push({ id, type: 'transaction', name: check.name, enabled: check.enabled });
        }
      }

      // Performance checks
      for (const [id, check] of performanceChecks) {
        if (check.organization_id === orgId) {
          availableChecks.push({ id, type: 'performance', name: check.name, enabled: check.enabled });
        }
      }

      // DNS checks
      for (const [id, check] of dnsChecks) {
        if (check.organization_id === orgId) {
          availableChecks.push({ id, type: 'dns', name: check.name, enabled: check.enabled });
        }
      }

      // TCP checks
      for (const [id, check] of tcpChecks) {
        if (check.organization_id === orgId) {
          availableChecks.push({ id, type: 'tcp', name: check.name, enabled: check.enabled });
        }
      }

      return { checks: availableChecks };
    }
  );

  // ================================
  // STATUS PAGE INCIDENTS
  // ================================

  // List incidents for a status page
  app.get(
    '/api/v1/monitoring/status-pages/:pageId/incidents',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer', 'viewer'])],
    },
    async (request, reply) => {
      const orgId = getOrganizationId(request);
      const { pageId } = request.params as { pageId: string };

      const statusPage = statusPages.get(pageId);
      if (!statusPage || statusPage.organization_id !== orgId) {
        return reply.status(404).send({ error: 'Status page not found' });
      }

      const incidents = statusPageIncidents.get(pageId) || [];
      // Sort by created_at descending
      const sortedIncidents = [...incidents].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return { incidents: sortedIncidents };
    }
  );

  // Create a new incident
  app.post(
    '/api/v1/monitoring/status-pages/:pageId/incidents',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin'])],
    },
    async (request, reply) => {
      const orgId = getOrganizationId(request);
      const userId = (request.user as JwtPayload).userId;
      const { pageId } = request.params as { pageId: string };
      const body = request.body as {
        title: string;
        status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
        impact: 'none' | 'minor' | 'major' | 'critical';
        message: string;
        affected_components?: string[];
      };

      const statusPage = statusPages.get(pageId);
      if (!statusPage || statusPage.organization_id !== orgId) {
        return reply.status(404).send({ error: 'Status page not found' });
      }

      if (!body.title || !body.message) {
        return reply.status(400).send({ error: 'Title and message are required' });
      }

      const incidentId = Date.now().toString();
      const updateId = `${incidentId}-1`;

      const incident: StatusPageIncident = {
        id: incidentId,
        status_page_id: pageId,
        title: body.title.trim(),
        status: body.status || 'investigating',
        impact: body.impact || 'minor',
        affected_components: body.affected_components,
        updates: [{
          id: updateId,
          status: body.status || 'investigating',
          message: body.message.trim(),
          created_by: userId,
          created_at: new Date(),
        }],
        created_by: userId,
        created_at: new Date(),
        updated_at: new Date(),
        resolved_at: body.status === 'resolved' ? new Date() : undefined,
      };

      const incidents = statusPageIncidents.get(pageId) || [];
      incidents.push(incident);
      statusPageIncidents.set(pageId, incidents);

      // Log audit entry
      await logAuditEntry(
        request,
        orgId,
        userId,
        'create_status_incident',
        'status_page_incident',
        incidentId,
        { title: incident.title, status: incident.status }
      );

      // Notify subscribers about the new incident
      await notifyStatusPageSubscribers(pageId, {
        type: 'incident_created',
        title: incident.title,
        message: body.message.trim(),
        impact: incident.impact,
        status: incident.status,
      });

      return reply.status(201).send({ incident });
    }
  );

  // Get a specific incident
  app.get(
    '/api/v1/monitoring/status-pages/:pageId/incidents/:incidentId',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer', 'viewer'])],
    },
    async (request, reply) => {
      const orgId = getOrganizationId(request);
      const { pageId, incidentId } = request.params as { pageId: string; incidentId: string };

      const statusPage = statusPages.get(pageId);
      if (!statusPage || statusPage.organization_id !== orgId) {
        return reply.status(404).send({ error: 'Status page not found' });
      }

      const incidents = statusPageIncidents.get(pageId) || [];
      const incident = incidents.find(i => i.id === incidentId);
      if (!incident) {
        return reply.status(404).send({ error: 'Incident not found' });
      }

      return { incident };
    }
  );

  // Add an update to an incident
  app.post(
    '/api/v1/monitoring/status-pages/:pageId/incidents/:incidentId/updates',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin'])],
    },
    async (request, reply) => {
      const orgId = getOrganizationId(request);
      const userId = (request.user as JwtPayload).userId;
      const { pageId, incidentId } = request.params as { pageId: string; incidentId: string };
      const body = request.body as {
        status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
        message: string;
      };

      const statusPage = statusPages.get(pageId);
      if (!statusPage || statusPage.organization_id !== orgId) {
        return reply.status(404).send({ error: 'Status page not found' });
      }

      if (!body.message) {
        return reply.status(400).send({ error: 'Message is required' });
      }

      const incidents = statusPageIncidents.get(pageId) || [];
      const incidentIndex = incidents.findIndex(i => i.id === incidentId);
      if (incidentIndex === -1) {
        return reply.status(404).send({ error: 'Incident not found' });
      }

      const incident = incidents[incidentIndex];
      const updateId = `${incidentId}-${incident.updates.length + 1}`;

      const update: StatusPageIncidentUpdate = {
        id: updateId,
        status: body.status || incident.status,
        message: body.message.trim(),
        created_by: userId,
        created_at: new Date(),
      };

      incident.updates.push(update);
      incident.status = body.status || incident.status;
      incident.updated_at = new Date();

      if (body.status === 'resolved' && !incident.resolved_at) {
        incident.resolved_at = new Date();
      }

      incidents[incidentIndex] = incident;
      statusPageIncidents.set(pageId, incidents);

      // Log audit entry
      await logAuditEntry(
        request,
        orgId,
        userId,
        'update_status_incident',
        'status_page_incident',
        incidentId,
        { status: incident.status, message: body.message.substring(0, 100) }
      );

      // Notify subscribers about the update
      const notificationType = body.status === 'resolved' ? 'incident_resolved' : 'incident_updated';
      await notifyStatusPageSubscribers(pageId, {
        type: notificationType,
        title: incident.title,
        message: body.message.trim(),
        impact: incident.impact,
        status: incident.status,
      });

      return { incident };
    }
  );

  // Delete an incident
  app.delete(
    '/api/v1/monitoring/status-pages/:pageId/incidents/:incidentId',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin'])],
    },
    async (request, reply) => {
      const orgId = getOrganizationId(request);
      const userId = (request.user as JwtPayload).userId;
      const { pageId, incidentId } = request.params as { pageId: string; incidentId: string };

      const statusPage = statusPages.get(pageId);
      if (!statusPage || statusPage.organization_id !== orgId) {
        return reply.status(404).send({ error: 'Status page not found' });
      }

      const incidents = statusPageIncidents.get(pageId) || [];
      const incidentIndex = incidents.findIndex(i => i.id === incidentId);
      if (incidentIndex === -1) {
        return reply.status(404).send({ error: 'Incident not found' });
      }

      const deletedIncident = incidents.splice(incidentIndex, 1)[0];
      statusPageIncidents.set(pageId, incidents);

      // Log audit entry
      await logAuditEntry(
        request,
        orgId,
        userId,
        'delete_status_incident',
        'status_page_incident',
        incidentId,
        { title: deletedIncident.title }
      );

      return { success: true };
    }
  );

  // ================================
  // PUBLIC STATUS PAGE (NO AUTH)
  // ================================

  // Public status page view by slug
  app.get(
    '/api/v1/status/:slug',
    async (request, reply) => {
      const { slug } = request.params as { slug: string };

      const pageId = statusPagesBySlug.get(slug);
      if (!pageId) {
        return reply.status(404).send({ error: 'Status page not found' });
      }

      const statusPage = statusPages.get(pageId);
      if (!statusPage) {
        return reply.status(404).send({ error: 'Status page not found' });
      }

      if (!statusPage.is_public) {
        return reply.status(403).send({ error: 'This status page is private' });
      }

      // Build status page data
      const checksData = statusPage.checks.map(spCheck => {
        const checkInfo = getCheckInfo(spCheck.check_id, spCheck.check_type);
        return {
          id: spCheck.check_id,
          type: spCheck.check_type,
          name: spCheck.display_name || (checkInfo?.name || 'Unknown'),
          status: checkInfo?.status || 'unknown',
          uptime: statusPage.show_uptime_percentage ? checkInfo?.uptime : undefined,
          avg_response_time: statusPage.show_response_time ? checkInfo?.avgResponseTime : undefined,
          order: spCheck.order,
        };
      }).sort((a, b) => a.order - b.order);

      // Get overall status
      const hasDown = checksData.some(c => c.status === 'down');
      const hasDegraded = checksData.some(c => c.status === 'degraded');
      const overallStatus = hasDown ? 'down' : hasDegraded ? 'degraded' : 'up';

      // Get incidents if enabled
      let incidents: any[] = [];
      let manualIncidents: StatusPageIncident[] = [];
      if (statusPage.show_incidents) {
        const historyStart = new Date(Date.now() - statusPage.show_history_days * 24 * 60 * 60 * 1000);

        // Get automatic incidents from checks
        for (const spCheck of statusPage.checks) {
          const checkIncidentsList = checkIncidents.get(spCheck.check_id) || [];
          const recentIncidents = checkIncidentsList
            .filter(i => new Date(i.started_at) >= historyStart)
            .map(i => ({
              ...i,
              check_name: getCheckInfo(spCheck.check_id, spCheck.check_type)?.name || 'Unknown',
              type: 'automatic',
            }));
          incidents.push(...recentIncidents);
        }

        // Get manual incidents from status page
        const pageManualIncidents = statusPageIncidents.get(pageId) || [];
        manualIncidents = pageManualIncidents.filter(i => new Date(i.created_at) >= historyStart);

        // Sort by started_at descending
        incidents.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
        incidents = incidents.slice(0, 20); // Limit to 20 most recent
      }

      return {
        name: statusPage.name,
        slug: statusPage.slug,
        description: statusPage.description,
        logo_url: statusPage.logo_url,
        primary_color: statusPage.primary_color,
        overall_status: overallStatus,
        checks: checksData,
        incidents: statusPage.show_incidents ? incidents : undefined,
        manual_incidents: statusPage.show_incidents ? manualIncidents.map(i => ({
          id: i.id,
          title: i.title,
          status: i.status,
          impact: i.impact,
          affected_components: i.affected_components,
          updates: i.updates,
          created_at: i.created_at,
          updated_at: i.updated_at,
          resolved_at: i.resolved_at,
        })) : undefined,
        last_updated: new Date().toISOString(),
      };
    }
  );

  // ================================
  // STATUS PAGE SUBSCRIPTIONS (NO AUTH)
  // ================================

  // Subscribe to status page notifications
  app.post(
    '/api/v1/status/:slug/subscribe',
    async (request, reply) => {
      const { slug } = request.params as { slug: string };
      const { email } = request.body as { email?: string };

      if (!email || typeof email !== 'string') {
        return reply.status(400).send({ error: 'Email is required' });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return reply.status(400).send({ error: 'Invalid email format' });
      }

      const pageId = statusPagesBySlug.get(slug);
      if (!pageId) {
        return reply.status(404).send({ error: 'Status page not found' });
      }

      const statusPage = statusPages.get(pageId);
      if (!statusPage || !statusPage.is_public) {
        return reply.status(404).send({ error: 'Status page not found' });
      }

      // Check if already subscribed
      const existingSubscriptions = statusPageSubscriptions.get(pageId) || [];
      const existingSub = existingSubscriptions.find(s => s.email.toLowerCase() === email.toLowerCase());

      if (existingSub) {
        if (existingSub.verified) {
          return reply.status(200).send({
            success: true,
            message: 'You are already subscribed to this status page',
            already_subscribed: true
          });
        } else {
          // Resend verification
          const verificationToken = `verify_${Date.now()}_${Math.random().toString(36).substring(7)}`;
          existingSub.verification_token = verificationToken;

          // Log verification link (in production, this would send an email)
          console.log(`[STATUS PAGE SUBSCRIPTION] Verification email resent:`);
          console.log(`  Email: ${email}`);
          console.log(`  Status Page: ${statusPage.name}`);
          console.log(`  Verify URL: /api/v1/status/${slug}/verify?token=${verificationToken}`);

          return reply.status(200).send({
            success: true,
            message: 'Verification email has been resent. Please check your inbox.',
            verification_required: true
          });
        }
      }

      // Create new subscription
      const verificationToken = `verify_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const unsubscribeToken = `unsub_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      const subscription: StatusPageSubscription = {
        id: Date.now().toString(),
        status_page_id: pageId,
        email: email.toLowerCase(),
        verification_token: verificationToken,
        verified: false,
        unsubscribe_token: unsubscribeToken,
        created_at: new Date(),
      };

      if (!statusPageSubscriptions.has(pageId)) {
        statusPageSubscriptions.set(pageId, []);
      }
      statusPageSubscriptions.get(pageId)!.push(subscription);

      // Log verification link (in production, this would send an email)
      console.log(`[STATUS PAGE SUBSCRIPTION] New subscription:`);
      console.log(`  Email: ${email}`);
      console.log(`  Status Page: ${statusPage.name}`);
      console.log(`  Verify URL: /api/v1/status/${slug}/verify?token=${verificationToken}`);

      return {
        success: true,
        message: 'Please check your email to verify your subscription.',
        verification_required: true,
        // For development, include verification URL in response
        dev_verify_url: `/api/v1/status/${slug}/verify?token=${verificationToken}`,
      };
    }
  );

  // Verify subscription
  app.get(
    '/api/v1/status/:slug/verify',
    async (request, reply) => {
      const { slug } = request.params as { slug: string };
      const { token } = request.query as { token?: string };

      if (!token) {
        return reply.status(400).send({ error: 'Verification token is required' });
      }

      const pageId = statusPagesBySlug.get(slug);
      if (!pageId) {
        return reply.status(404).send({ error: 'Status page not found' });
      }

      const subscriptions = statusPageSubscriptions.get(pageId) || [];
      const subscription = subscriptions.find(s => s.verification_token === token);

      if (!subscription) {
        return reply.status(404).send({ error: 'Invalid or expired verification token' });
      }

      if (subscription.verified) {
        return {
          success: true,
          message: 'Your subscription is already verified.',
          already_verified: true,
        };
      }

      // Verify the subscription
      subscription.verified = true;
      subscription.verified_at = new Date();
      subscription.verification_token = undefined;

      const statusPage = statusPages.get(pageId);
      console.log(`[STATUS PAGE SUBSCRIPTION] Subscription verified:`);
      console.log(`  Email: ${subscription.email}`);
      console.log(`  Status Page: ${statusPage?.name}`);

      return {
        success: true,
        message: 'Your subscription has been verified. You will now receive incident notifications.',
        status_page_name: statusPage?.name,
      };
    }
  );

  // Unsubscribe from status page
  app.get(
    '/api/v1/status/:slug/unsubscribe',
    async (request, reply) => {
      const { slug } = request.params as { slug: string };
      const { token } = request.query as { token?: string };

      if (!token) {
        return reply.status(400).send({ error: 'Unsubscribe token is required' });
      }

      const pageId = statusPagesBySlug.get(slug);
      if (!pageId) {
        return reply.status(404).send({ error: 'Status page not found' });
      }

      const subscriptions = statusPageSubscriptions.get(pageId) || [];
      const subscriptionIndex = subscriptions.findIndex(s => s.unsubscribe_token === token);

      if (subscriptionIndex === -1) {
        return reply.status(404).send({ error: 'Invalid unsubscribe token' });
      }

      const subscription = subscriptions[subscriptionIndex];
      subscriptions.splice(subscriptionIndex, 1);

      const statusPage = statusPages.get(pageId);
      console.log(`[STATUS PAGE SUBSCRIPTION] Unsubscribed:`);
      console.log(`  Email: ${subscription.email}`);
      console.log(`  Status Page: ${statusPage?.name}`);

      return {
        success: true,
        message: 'You have been unsubscribed from status page notifications.',
        status_page_name: statusPage?.name,
      };
    }
  );

  // Get subscription count for a status page (for display on public page)
  app.get(
    '/api/v1/status/:slug/subscribers/count',
    async (request, reply) => {
      const { slug } = request.params as { slug: string };

      const pageId = statusPagesBySlug.get(slug);
      if (!pageId) {
        return reply.status(404).send({ error: 'Status page not found' });
      }

      const statusPage = statusPages.get(pageId);
      if (!statusPage || !statusPage.is_public) {
        return reply.status(404).send({ error: 'Status page not found' });
      }

      const subscriptions = statusPageSubscriptions.get(pageId) || [];
      const verifiedCount = subscriptions.filter(s => s.verified).length;

      return {
        count: verifiedCount,
      };
    }
  );
}
