/**
 * Incident Management Routes Module
 *
 * Split from alert-correlation-incidents.ts - contains:
 * - Managed incidents CRUD
 * - Incident notes, timeline, responders
 * - Incident statistics
 *
 * Feature #1375: Split incident management routes for maintainability
 */

import { FastifyInstance } from 'fastify';
import { authenticate, getOrganizationId, JwtPayload, ApiKeyPayload } from '../../middleware/auth';
import { logAuditEntry } from '../audit-logs';

import {
  IncidentNote,
  IncidentTimeline,
  IncidentResponder,
  ManagedIncident,
} from './types';

import {
  managedIncidents,
  incidentsByOrg,
} from './stores';

export async function incidentRoutes(app: FastifyInstance): Promise<void> {
  // ================================
  // INCIDENT MANAGEMENT WORKFLOW
  // ================================

  // Get all incidents for the organization
  app.get(
    '/api/v1/monitoring/incidents',
    {
      preHandler: [authenticate],
    },
    async (request) => {
      const orgId = getOrganizationId(request);
      const query = request.query as { status?: string; priority?: string; limit?: string };

      const incidentIds = incidentsByOrg.get(orgId) || [];
      let incidents = incidentIds
        .map(id => managedIncidents.get(id))
        .filter((i): i is ManagedIncident => i !== undefined);

      // Filter by status
      if (query.status) {
        const statuses = query.status.split(',');
        incidents = incidents.filter(i => statuses.includes(i.status));
      }

      // Filter by priority
      if (query.priority) {
        const priorities = query.priority.split(',');
        incidents = incidents.filter(i => i.priority && priorities.includes(i.priority));
      }

      // Sort by created_at descending (newest first)
      incidents.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Apply limit
      const limit = parseInt(query.limit || '50', 10);
      incidents = incidents.slice(0, limit);

      return {
        incidents: incidents.map(i => ({
          ...i,
          created_at: i.created_at.toISOString(),
          updated_at: i.updated_at.toISOString(),
          acknowledged_at: i.acknowledged_at?.toISOString(),
          resolved_at: i.resolved_at?.toISOString(),
          notes: i.notes.map(n => ({
            ...n,
            created_at: n.created_at.toISOString(),
          })),
          timeline: i.timeline.map(t => ({
            ...t,
            created_at: t.created_at.toISOString(),
          })),
          responders: i.responders.map(r => ({
            ...r,
            assigned_at: r.assigned_at.toISOString(),
            acknowledged_at: r.acknowledged_at?.toISOString(),
          })),
        })),
        total: incidentIds.length,
      };
    }
  );

  // Create a new incident (alert triggers incident or manual creation)
  app.post(
    '/api/v1/monitoring/incidents',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const orgId = getOrganizationId(request);
      const user = request.user as JwtPayload | ApiKeyPayload;
      const userId = 'id' in user ? user.id : 'api-key';
      const userName = 'email' in user ? user.email : 'API Key';
      const body = request.body as {
        title: string;
        description?: string;
        priority?: 'P1' | 'P2' | 'P3' | 'P4' | 'P5';
        severity?: 'critical' | 'high' | 'medium' | 'low' | 'info';
        source?: 'alert' | 'manual' | 'api' | 'integration';
        source_alert_id?: string;
        source_check_id?: string;
        source_check_type?: string;
        tags?: string[];
        affected_services?: string[];
        escalation_policy_id?: string;
        on_call_schedule_id?: string;
      };

      if (!body.title?.trim()) {
        reply.status(400);
        return { error: 'Incident title is required' };
      }

      const incidentId = `inc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date();

      const incident: ManagedIncident = {
        id: incidentId,
        organization_id: orgId,
        title: body.title.trim(),
        description: body.description?.trim(),
        status: 'triggered',
        priority: body.priority || 'P3',
        severity: body.severity || 'medium',
        source: body.source || 'manual',
        source_alert_id: body.source_alert_id,
        source_check_id: body.source_check_id,
        source_check_type: body.source_check_type,
        responders: [],
        notes: [],
        timeline: [{
          id: `tl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          event_type: 'created',
          description: `Incident created by ${userName}`,
          actor_id: userId,
          actor_name: userName,
          metadata: { source: body.source || 'manual' },
          created_at: now,
        }],
        tags: body.tags,
        affected_services: body.affected_services,
        postmortem_completed: false,
        escalation_policy_id: body.escalation_policy_id,
        on_call_schedule_id: body.on_call_schedule_id,
        created_by: userId,
        created_at: now,
        updated_at: now,
      };

      managedIncidents.set(incidentId, incident);
      const orgIncidents = incidentsByOrg.get(orgId) || [];
      orgIncidents.push(incidentId);
      incidentsByOrg.set(orgId, orgIncidents);

      // Log audit entry
      logAuditEntry(
        request,
        'create_incident',
        'managed_incident',
        incidentId,
        incident.title,
        { priority: incident.priority, source: incident.source }
      );

      reply.status(201);
      return {
        ...incident,
        created_at: incident.created_at.toISOString(),
        updated_at: incident.updated_at.toISOString(),
        timeline: incident.timeline.map(t => ({
          ...t,
          created_at: t.created_at.toISOString(),
        })),
      };
    }
  );

  // Get a specific incident
  app.get(
    '/api/v1/monitoring/incidents/:incidentId',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const { incidentId } = request.params as { incidentId: string };
      const orgId = getOrganizationId(request);

      const incident = managedIncidents.get(incidentId);
      if (!incident || incident.organization_id !== orgId) {
        reply.status(404);
        return { error: 'Incident not found' };
      }

      return {
        ...incident,
        created_at: incident.created_at.toISOString(),
        updated_at: incident.updated_at.toISOString(),
        acknowledged_at: incident.acknowledged_at?.toISOString(),
        resolved_at: incident.resolved_at?.toISOString(),
        notes: incident.notes.map(n => ({
          ...n,
          created_at: n.created_at.toISOString(),
        })),
        timeline: incident.timeline.map(t => ({
          ...t,
          created_at: t.created_at.toISOString(),
        })),
        responders: incident.responders.map(r => ({
          ...r,
          assigned_at: r.assigned_at.toISOString(),
          acknowledged_at: r.acknowledged_at?.toISOString(),
        })),
      };
    }
  );

  // Update incident status
  app.patch(
    '/api/v1/monitoring/incidents/:incidentId/status',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const { incidentId } = request.params as { incidentId: string };
      const orgId = getOrganizationId(request);
      const user = request.user as JwtPayload | ApiKeyPayload;
      const userId = 'id' in user ? user.id : 'api-key';
      const userName = 'email' in user ? user.email : 'API Key';
      const body = request.body as {
        status: 'triggered' | 'acknowledged' | 'investigating' | 'identified' | 'monitoring' | 'resolved';
        resolution_summary?: string;
        postmortem_url?: string;
      };

      const incident = managedIncidents.get(incidentId);
      if (!incident || incident.organization_id !== orgId) {
        reply.status(404);
        return { error: 'Incident not found' };
      }

      const validStatuses = ['triggered', 'acknowledged', 'investigating', 'identified', 'monitoring', 'resolved'];
      if (!validStatuses.includes(body.status)) {
        reply.status(400);
        return { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` };
      }

      const oldStatus = incident.status;
      const now = new Date();

      incident.status = body.status;
      incident.updated_at = now;

      // Track acknowledgment time
      if (body.status === 'acknowledged' && !incident.acknowledged_at) {
        incident.acknowledged_at = now;
        incident.time_to_acknowledge_seconds = Math.round((now.getTime() - incident.created_at.getTime()) / 1000);
      }

      // Track resolution time
      if (body.status === 'resolved' && !incident.resolved_at) {
        incident.resolved_at = now;
        incident.time_to_resolve_seconds = Math.round((now.getTime() - incident.created_at.getTime()) / 1000);
        if (body.resolution_summary) {
          incident.resolution_summary = body.resolution_summary.trim();
        }
        if (body.postmortem_url) {
          incident.postmortem_url = body.postmortem_url.trim();
        }
      }

      // Add timeline entry
      const timelineEvent: IncidentTimeline = {
        id: `tl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        event_type: body.status === 'resolved' ? 'resolved' : 'status_changed',
        description: `Status changed from ${oldStatus} to ${body.status}`,
        actor_id: userId,
        actor_name: userName,
        metadata: { old_status: oldStatus, new_status: body.status },
        created_at: now,
      };
      incident.timeline.push(timelineEvent);

      managedIncidents.set(incidentId, incident);

      // Log audit entry
      logAuditEntry(
        request,
        'update_incident_status',
        'managed_incident',
        incidentId,
        incident.title,
        { old_status: oldStatus, new_status: body.status }
      );

      return {
        ...incident,
        created_at: incident.created_at.toISOString(),
        updated_at: incident.updated_at.toISOString(),
        acknowledged_at: incident.acknowledged_at?.toISOString(),
        resolved_at: incident.resolved_at?.toISOString(),
        notes: incident.notes.map(n => ({
          ...n,
          created_at: n.created_at.toISOString(),
        })),
        timeline: incident.timeline.map(t => ({
          ...t,
          created_at: t.created_at.toISOString(),
        })),
        responders: incident.responders.map(r => ({
          ...r,
          assigned_at: r.assigned_at.toISOString(),
          acknowledged_at: r.acknowledged_at?.toISOString(),
        })),
      };
    }
  );

  // Assign responder to incident
  app.post(
    '/api/v1/monitoring/incidents/:incidentId/responders',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const { incidentId } = request.params as { incidentId: string };
      const orgId = getOrganizationId(request);
      const user = request.user as JwtPayload | ApiKeyPayload;
      const userId = 'id' in user ? user.id : 'api-key';
      const userName = 'email' in user ? user.email : 'API Key';
      const body = request.body as {
        user_id: string;
        user_name: string;
        user_email: string;
        role?: 'primary' | 'secondary' | 'observer';
      };

      const incident = managedIncidents.get(incidentId);
      if (!incident || incident.organization_id !== orgId) {
        reply.status(404);
        return { error: 'Incident not found' };
      }

      if (!body.user_id || !body.user_name || !body.user_email) {
        reply.status(400);
        return { error: 'user_id, user_name, and user_email are required' };
      }

      // Check if responder already exists
      const existingResponder = incident.responders.find(r => r.user_id === body.user_id);
      if (existingResponder) {
        reply.status(409);
        return { error: 'Responder is already assigned to this incident' };
      }

      const now = new Date();
      const responder: IncidentResponder = {
        id: `resp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        user_id: body.user_id,
        user_name: body.user_name,
        user_email: body.user_email,
        role: body.role || 'secondary',
        assigned_at: now,
      };

      incident.responders.push(responder);
      incident.updated_at = now;

      // Add timeline entry
      const timelineEvent: IncidentTimeline = {
        id: `tl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        event_type: 'assigned',
        description: `${body.user_name} assigned as ${responder.role} responder`,
        actor_id: userId,
        actor_name: userName,
        metadata: { responder_id: responder.id, responder_name: body.user_name, role: responder.role },
        created_at: now,
      };
      incident.timeline.push(timelineEvent);

      managedIncidents.set(incidentId, incident);

      // Log audit entry
      logAuditEntry(
        request,
        'assign_incident_responder',
        'managed_incident',
        incidentId,
        incident.title,
        { responder_name: body.user_name, role: responder.role }
      );

      reply.status(201);
      return {
        responder: {
          ...responder,
          assigned_at: responder.assigned_at.toISOString(),
        },
        incident: {
          ...incident,
          created_at: incident.created_at.toISOString(),
          updated_at: incident.updated_at.toISOString(),
          acknowledged_at: incident.acknowledged_at?.toISOString(),
          resolved_at: incident.resolved_at?.toISOString(),
          notes: incident.notes.map(n => ({
            ...n,
            created_at: n.created_at.toISOString(),
          })),
          timeline: incident.timeline.map(t => ({
            ...t,
            created_at: t.created_at.toISOString(),
          })),
          responders: incident.responders.map(r => ({
            ...r,
            assigned_at: r.assigned_at.toISOString(),
            acknowledged_at: r.acknowledged_at?.toISOString(),
          })),
        },
      };
    }
  );

  // Add note to incident
  app.post(
    '/api/v1/monitoring/incidents/:incidentId/notes',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const { incidentId } = request.params as { incidentId: string };
      const orgId = getOrganizationId(request);
      const user = request.user as JwtPayload | ApiKeyPayload;
      const userId = 'id' in user ? user.id : 'api-key';
      const userName = 'email' in user ? user.email : 'API Key';
      const body = request.body as {
        content: string;
        visibility?: 'internal' | 'public';
      };

      const incident = managedIncidents.get(incidentId);
      if (!incident || incident.organization_id !== orgId) {
        reply.status(404);
        return { error: 'Incident not found' };
      }

      if (!body.content?.trim()) {
        reply.status(400);
        return { error: 'Note content is required' };
      }

      const now = new Date();
      const note: IncidentNote = {
        id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        author_id: userId,
        author_name: userName,
        content: body.content.trim(),
        visibility: body.visibility || 'internal',
        created_at: now,
      };

      incident.notes.push(note);
      incident.updated_at = now;

      // Add timeline entry
      const timelineEvent: IncidentTimeline = {
        id: `tl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        event_type: 'note_added',
        description: `Note added by ${userName}`,
        actor_id: userId,
        actor_name: userName,
        metadata: { note_id: note.id, visibility: note.visibility },
        created_at: now,
      };
      incident.timeline.push(timelineEvent);

      managedIncidents.set(incidentId, incident);

      // Log audit entry
      logAuditEntry(
        request,
        'add_incident_note',
        'managed_incident',
        incidentId,
        incident.title,
        { note_preview: body.content.substring(0, 50) }
      );

      reply.status(201);
      return {
        note: {
          ...note,
          created_at: note.created_at.toISOString(),
        },
        incident: {
          ...incident,
          created_at: incident.created_at.toISOString(),
          updated_at: incident.updated_at.toISOString(),
          acknowledged_at: incident.acknowledged_at?.toISOString(),
          resolved_at: incident.resolved_at?.toISOString(),
          notes: incident.notes.map(n => ({
            ...n,
            created_at: n.created_at.toISOString(),
          })),
          timeline: incident.timeline.map(t => ({
            ...t,
            created_at: t.created_at.toISOString(),
          })),
          responders: incident.responders.map(r => ({
            ...r,
            assigned_at: r.assigned_at.toISOString(),
            acknowledged_at: r.acknowledged_at?.toISOString(),
          })),
        },
      };
    }
  );

  // Resolve incident with postmortem
  app.post(
    '/api/v1/monitoring/incidents/:incidentId/resolve',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const { incidentId } = request.params as { incidentId: string };
      const orgId = getOrganizationId(request);
      const user = request.user as JwtPayload | ApiKeyPayload;
      const userId = 'id' in user ? user.id : 'api-key';
      const userName = 'email' in user ? user.email : 'API Key';
      const body = request.body as {
        resolution_summary: string;
        postmortem_url?: string;
        postmortem_completed?: boolean;
      };

      const incident = managedIncidents.get(incidentId);
      if (!incident || incident.organization_id !== orgId) {
        reply.status(404);
        return { error: 'Incident not found' };
      }

      if (!body.resolution_summary?.trim()) {
        reply.status(400);
        return { error: 'Resolution summary is required' };
      }

      if (incident.status === 'resolved') {
        reply.status(400);
        return { error: 'Incident is already resolved' };
      }

      const now = new Date();
      const oldStatus = incident.status;

      incident.status = 'resolved';
      incident.resolved_at = now;
      incident.resolution_summary = body.resolution_summary.trim();
      incident.time_to_resolve_seconds = Math.round((now.getTime() - incident.created_at.getTime()) / 1000);
      incident.updated_at = now;

      if (body.postmortem_url) {
        incident.postmortem_url = body.postmortem_url.trim();
      }
      if (body.postmortem_completed !== undefined) {
        incident.postmortem_completed = body.postmortem_completed;
      }

      // Add timeline entry
      const timelineEvent: IncidentTimeline = {
        id: `tl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        event_type: 'resolved',
        description: `Incident resolved by ${userName}`,
        actor_id: userId,
        actor_name: userName,
        metadata: {
          old_status: oldStatus,
          resolution_summary: body.resolution_summary.substring(0, 100),
          postmortem_url: body.postmortem_url,
          postmortem_completed: body.postmortem_completed,
          time_to_resolve_seconds: incident.time_to_resolve_seconds,
        },
        created_at: now,
      };
      incident.timeline.push(timelineEvent);

      managedIncidents.set(incidentId, incident);

      // Log audit entry
      logAuditEntry(
        request,
        'resolve_incident',
        'managed_incident',
        incidentId,
        incident.title,
        {
          resolution_summary: body.resolution_summary.substring(0, 100),
          postmortem_url: body.postmortem_url,
          time_to_resolve_seconds: incident.time_to_resolve_seconds,
        }
      );

      return {
        ...incident,
        created_at: incident.created_at.toISOString(),
        updated_at: incident.updated_at.toISOString(),
        acknowledged_at: incident.acknowledged_at?.toISOString(),
        resolved_at: incident.resolved_at?.toISOString(),
        notes: incident.notes.map(n => ({
          ...n,
          created_at: n.created_at.toISOString(),
        })),
        timeline: incident.timeline.map(t => ({
          ...t,
          created_at: t.created_at.toISOString(),
        })),
        responders: incident.responders.map(r => ({
          ...r,
          assigned_at: r.assigned_at.toISOString(),
          acknowledged_at: r.acknowledged_at?.toISOString(),
        })),
      };
    }
  );

  // Get incident statistics
  app.get(
    '/api/v1/monitoring/incidents/stats',
    {
      preHandler: [authenticate],
    },
    async (request) => {
      const orgId = getOrganizationId(request);
      const query = request.query as { days?: string };
      const days = parseInt(query.days || '30', 10);
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const incidentIds = incidentsByOrg.get(orgId) || [];
      const incidents = incidentIds
        .map(id => managedIncidents.get(id))
        .filter((i): i is ManagedIncident => i !== undefined)
        .filter(i => i.created_at >= cutoff);

      const stats = {
        total: incidents.length,
        by_status: {
          triggered: 0,
          acknowledged: 0,
          investigating: 0,
          identified: 0,
          monitoring: 0,
          resolved: 0,
        },
        by_priority: {
          P1: 0,
          P2: 0,
          P3: 0,
          P4: 0,
          P5: 0,
        },
        by_severity: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          info: 0,
        },
        avg_time_to_acknowledge_seconds: 0,
        avg_time_to_resolve_seconds: 0,
        total_with_postmortem: 0,
      };

      let totalTTA = 0;
      let totalTTR = 0;
      let countTTA = 0;
      let countTTR = 0;

      for (const incident of incidents) {
        stats.by_status[incident.status]++;
        if (incident.priority) {
          stats.by_priority[incident.priority]++;
        }
        stats.by_severity[incident.severity]++;

        if (incident.time_to_acknowledge_seconds !== undefined) {
          totalTTA += incident.time_to_acknowledge_seconds;
          countTTA++;
        }
        if (incident.time_to_resolve_seconds !== undefined) {
          totalTTR += incident.time_to_resolve_seconds;
          countTTR++;
        }
        if (incident.postmortem_completed) {
          stats.total_with_postmortem++;
        }
      }

      stats.avg_time_to_acknowledge_seconds = countTTA > 0 ? Math.round(totalTTA / countTTA) : 0;
      stats.avg_time_to_resolve_seconds = countTTR > 0 ? Math.round(totalTTR / countTTR) : 0;

      return stats;
    }
  );
}
