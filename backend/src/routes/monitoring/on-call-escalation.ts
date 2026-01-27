/**
 * On-Call and Escalation Policy Routes Module
 *
 * Routes for on-call schedule management and escalation policies.
 *
 * Extracted from status-pages.ts (Feature #1376)
 */

import { FastifyInstance } from 'fastify';
import { authenticate, requireRoles, getOrganizationId, JwtPayload, ApiKeyPayload } from '../../middleware/auth';
import { logAuditEntry } from '../audit-logs';
import {
  OnCallSchedule,
  OnCallMember,
  EscalationLevel,
  EscalationTarget,
  EscalationPolicy,
} from './types';
import {
  onCallSchedules,
  escalationPolicies,
} from './stores';

// ================================
// ON-CALL AND ESCALATION ROUTES
// ================================

export async function onCallEscalationRoutes(app: FastifyInstance): Promise<void> {
  // ================================
  // ON-CALL SCHEDULE MANAGEMENT
  // ================================

  // List all on-call schedules for organization
  app.get(
    '/api/v1/monitoring/on-call',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer', 'viewer'])],
    },
    async (request, reply) => {
      const orgId = getOrganizationId(request);

      const schedules = Array.from(onCallSchedules.values())
        .filter(s => s.organization_id === orgId)
        .map(s => ({
          ...s,
          current_on_call: s.members[s.current_on_call_index] || null,
        }))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return { schedules };
    }
  );

  // Create a new on-call schedule
  app.post(
    '/api/v1/monitoring/on-call',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin'])],
    },
    async (request, reply) => {
      const orgId = getOrganizationId(request);
      const userId = (request.user as JwtPayload).userId;
      const body = request.body as {
        name: string;
        description?: string;
        timezone?: string;
        rotation_type: 'daily' | 'weekly' | 'custom';
        rotation_interval_days?: number;
        members: { user_id: string; user_name: string; user_email: string; phone?: string }[];
      };

      if (!body.name || !body.members || body.members.length === 0) {
        return reply.status(400).send({ error: 'Name and at least one member are required' });
      }

      const scheduleId = Date.now().toString();
      const schedule: OnCallSchedule = {
        id: scheduleId,
        organization_id: orgId,
        name: body.name.trim(),
        description: body.description?.trim(),
        timezone: body.timezone || 'UTC',
        rotation_type: body.rotation_type || 'weekly',
        rotation_interval_days: body.rotation_type === 'custom' ? (body.rotation_interval_days || 7) :
                                body.rotation_type === 'daily' ? 1 : 7,
        members: body.members.map((m, idx) => ({
          id: `${scheduleId}-member-${idx}`,
          user_id: m.user_id,
          user_name: m.user_name,
          user_email: m.user_email,
          phone: m.phone,
          order: idx,
        })),
        current_on_call_index: 0,
        is_active: true,
        created_by: userId,
        created_at: new Date(),
        updated_at: new Date(),
      };

      onCallSchedules.set(scheduleId, schedule);

      // Log audit entry
      await logAuditEntry(
        request,
        orgId,
        userId,
        'create_on_call_schedule',
        'on_call_schedule',
        scheduleId,
        { name: schedule.name }
      );

      return reply.status(201).send({
        schedule: {
          ...schedule,
          current_on_call: schedule.members[0] || null,
        }
      });
    }
  );

  // Get a specific on-call schedule
  app.get(
    '/api/v1/monitoring/on-call/:scheduleId',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer', 'viewer'])],
    },
    async (request, reply) => {
      const orgId = getOrganizationId(request);
      const { scheduleId } = request.params as { scheduleId: string };

      const schedule = onCallSchedules.get(scheduleId);
      if (!schedule || schedule.organization_id !== orgId) {
        return reply.status(404).send({ error: 'On-call schedule not found' });
      }

      return {
        schedule: {
          ...schedule,
          current_on_call: schedule.members[schedule.current_on_call_index] || null,
        }
      };
    }
  );

  // Update an on-call schedule
  app.patch(
    '/api/v1/monitoring/on-call/:scheduleId',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin'])],
    },
    async (request, reply) => {
      const orgId = getOrganizationId(request);
      const userId = (request.user as JwtPayload).userId;
      const { scheduleId } = request.params as { scheduleId: string };
      const body = request.body as Partial<{
        name: string;
        description: string;
        timezone: string;
        rotation_type: 'daily' | 'weekly' | 'custom';
        rotation_interval_days: number;
        members: { user_id: string; user_name: string; user_email: string; phone?: string }[];
        is_active: boolean;
      }>;

      const schedule = onCallSchedules.get(scheduleId);
      if (!schedule || schedule.organization_id !== orgId) {
        return reply.status(404).send({ error: 'On-call schedule not found' });
      }

      if (body.name !== undefined) schedule.name = body.name.trim();
      if (body.description !== undefined) schedule.description = body.description.trim();
      if (body.timezone !== undefined) schedule.timezone = body.timezone;
      if (body.rotation_type !== undefined) {
        schedule.rotation_type = body.rotation_type;
        schedule.rotation_interval_days = body.rotation_type === 'custom' ? (body.rotation_interval_days || 7) :
                                          body.rotation_type === 'daily' ? 1 : 7;
      }
      if (body.rotation_interval_days !== undefined && schedule.rotation_type === 'custom') {
        schedule.rotation_interval_days = body.rotation_interval_days;
      }
      if (body.members !== undefined) {
        schedule.members = body.members.map((m, idx) => ({
          id: `${scheduleId}-member-${idx}`,
          user_id: m.user_id,
          user_name: m.user_name,
          user_email: m.user_email,
          phone: m.phone,
          order: idx,
        }));
        // Reset index if it's out of bounds
        if (schedule.current_on_call_index >= schedule.members.length) {
          schedule.current_on_call_index = 0;
        }
      }
      if (body.is_active !== undefined) schedule.is_active = body.is_active;

      schedule.updated_at = new Date();
      onCallSchedules.set(scheduleId, schedule);

      // Log audit entry
      await logAuditEntry(
        request,
        orgId,
        userId,
        'update_on_call_schedule',
        'on_call_schedule',
        scheduleId,
        { name: schedule.name }
      );

      return {
        schedule: {
          ...schedule,
          current_on_call: schedule.members[schedule.current_on_call_index] || null,
        }
      };
    }
  );

  // Manually rotate on-call (advance to next person)
  app.post(
    '/api/v1/monitoring/on-call/:scheduleId/rotate',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin'])],
    },
    async (request, reply) => {
      const orgId = getOrganizationId(request);
      const userId = (request.user as JwtPayload).userId;
      const { scheduleId } = request.params as { scheduleId: string };

      const schedule = onCallSchedules.get(scheduleId);
      if (!schedule || schedule.organization_id !== orgId) {
        return reply.status(404).send({ error: 'On-call schedule not found' });
      }

      if (schedule.members.length === 0) {
        return reply.status(400).send({ error: 'Schedule has no members' });
      }

      const previousOnCall = schedule.members[schedule.current_on_call_index];
      schedule.current_on_call_index = (schedule.current_on_call_index + 1) % schedule.members.length;
      schedule.last_rotation_at = new Date();
      schedule.updated_at = new Date();

      const newOnCall = schedule.members[schedule.current_on_call_index];
      onCallSchedules.set(scheduleId, schedule);

      // Log audit entry
      await logAuditEntry(
        request,
        orgId,
        userId,
        'rotate_on_call',
        'on_call_schedule',
        scheduleId,
        {
          previous_on_call: previousOnCall?.user_name,
          new_on_call: newOnCall?.user_name
        }
      );

      console.log(`[ON-CALL] Rotation completed for schedule "${schedule.name}":`);
      console.log(`  Previous: ${previousOnCall?.user_name} (${previousOnCall?.user_email})`);
      console.log(`  Now: ${newOnCall?.user_name} (${newOnCall?.user_email})`);

      return {
        schedule: {
          ...schedule,
          current_on_call: newOnCall,
        },
        previous_on_call: previousOnCall,
      };
    }
  );

  // Delete an on-call schedule
  app.delete(
    '/api/v1/monitoring/on-call/:scheduleId',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin'])],
    },
    async (request, reply) => {
      const orgId = getOrganizationId(request);
      const userId = (request.user as JwtPayload).userId;
      const { scheduleId } = request.params as { scheduleId: string };

      const schedule = onCallSchedules.get(scheduleId);
      if (!schedule || schedule.organization_id !== orgId) {
        return reply.status(404).send({ error: 'On-call schedule not found' });
      }

      onCallSchedules.delete(scheduleId);

      // Log audit entry
      await logAuditEntry(
        request,
        orgId,
        userId,
        'delete_on_call_schedule',
        'on_call_schedule',
        scheduleId,
        { name: schedule.name }
      );

      return { success: true };
    }
  );

  // Get current on-call for an organization (useful for alerts)
  app.get(
    '/api/v1/monitoring/on-call/current',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer', 'viewer'])],
    },
    async (request, reply) => {
      const orgId = getOrganizationId(request);

      const activeSchedules = Array.from(onCallSchedules.values())
        .filter(s => s.organization_id === orgId && s.is_active && s.members.length > 0)
        .map(s => ({
          schedule_id: s.id,
          schedule_name: s.name,
          current_on_call: s.members[s.current_on_call_index],
          rotation_type: s.rotation_type,
          last_rotation_at: s.last_rotation_at,
        }));

      return { on_call: activeSchedules };
    }
  );

  // ================================
  // ESCALATION POLICY ENDPOINTS
  // ================================

  // List escalation policies
  app.get(
    '/api/v1/monitoring/escalation-policies',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer', 'viewer'])],
    },
    async (request, reply) => {
      const orgId = getOrganizationId(request);

      const policies = Array.from(escalationPolicies.values())
        .filter(p => p.organization_id === orgId)
        .map(p => ({
          ...p,
          created_at: p.created_at.toISOString(),
          updated_at: p.updated_at.toISOString(),
        }));

      return { policies };
    }
  );

  // Create escalation policy
  app.post(
    '/api/v1/monitoring/escalation-policies',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer'])],
    },
    async (request, reply) => {
      const user = request.user as JwtPayload | ApiKeyPayload;
      const orgId = getOrganizationId(request);

      const {
        name,
        description,
        levels,
        repeat_policy,
        repeat_interval_minutes,
        is_default,
      } = request.body as {
        name: string;
        description?: string;
        levels: { escalate_after_minutes: number; targets: Omit<EscalationTarget, 'id'>[] }[];
        repeat_policy?: 'once' | 'repeat_until_acknowledged';
        repeat_interval_minutes?: number;
        is_default?: boolean;
      };

      if (!name?.trim()) {
        return reply.status(400).send({ error: 'Name is required' });
      }

      if (!levels || levels.length === 0) {
        return reply.status(400).send({ error: 'At least one escalation level is required' });
      }

      const policyId = Date.now().toString();

      // If setting as default, clear other defaults
      if (is_default) {
        Array.from(escalationPolicies.values())
          .filter(p => p.organization_id === orgId && p.is_default)
          .forEach(p => {
            p.is_default = false;
            escalationPolicies.set(p.id, p);
          });
      }

      const policy: EscalationPolicy = {
        id: policyId,
        organization_id: orgId,
        name: name.trim(),
        description: description?.trim(),
        levels: levels.map((level, index) => ({
          id: `${policyId}-level-${index + 1}`,
          level: index + 1,
          escalate_after_minutes: level.escalate_after_minutes || (index === 0 ? 0 : 15),
          targets: level.targets.map((target, tIndex) => ({
            ...target,
            id: `${policyId}-level-${index + 1}-target-${tIndex}`,
          })),
        })),
        repeat_policy: repeat_policy || 'once',
        repeat_interval_minutes: repeat_interval_minutes || 30,
        is_default: is_default || false,
        is_active: true,
        created_by: 'userId' in user ? user.userId : (user as ApiKeyPayload).user_id,
        created_at: new Date(),
        updated_at: new Date(),
      };

      escalationPolicies.set(policyId, policy);

      // Log audit entry
      await logAuditEntry(
        request,
        orgId,
        policy.created_by,
        'create_escalation_policy',
        'escalation_policy',
        policyId,
        { name: policy.name, levels: policy.levels.length }
      );

      return reply.status(201).send({
        policy: {
          ...policy,
          created_at: policy.created_at.toISOString(),
          updated_at: policy.updated_at.toISOString(),
        },
      });
    }
  );

  // Get single escalation policy
  app.get(
    '/api/v1/monitoring/escalation-policies/:policyId',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer', 'viewer'])],
    },
    async (request, reply) => {
      const orgId = getOrganizationId(request);
      const { policyId } = request.params as { policyId: string };

      const policy = escalationPolicies.get(policyId);
      if (!policy || policy.organization_id !== orgId) {
        return reply.status(404).send({ error: 'Escalation policy not found' });
      }

      return {
        policy: {
          ...policy,
          created_at: policy.created_at.toISOString(),
          updated_at: policy.updated_at.toISOString(),
        },
      };
    }
  );

  // Update escalation policy
  app.patch(
    '/api/v1/monitoring/escalation-policies/:policyId',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer'])],
    },
    async (request, reply) => {
      const user = request.user as JwtPayload | ApiKeyPayload;
      const orgId = getOrganizationId(request);
      const { policyId } = request.params as { policyId: string };

      const policy = escalationPolicies.get(policyId);
      if (!policy || policy.organization_id !== orgId) {
        return reply.status(404).send({ error: 'Escalation policy not found' });
      }

      const {
        name,
        description,
        levels,
        repeat_policy,
        repeat_interval_minutes,
        is_default,
        is_active,
      } = request.body as {
        name?: string;
        description?: string;
        levels?: { escalate_after_minutes: number; targets: Omit<EscalationTarget, 'id'>[] }[];
        repeat_policy?: 'once' | 'repeat_until_acknowledged';
        repeat_interval_minutes?: number;
        is_default?: boolean;
        is_active?: boolean;
      };

      if (name !== undefined) policy.name = name.trim();
      if (description !== undefined) policy.description = description.trim();
      if (repeat_policy !== undefined) policy.repeat_policy = repeat_policy;
      if (repeat_interval_minutes !== undefined) policy.repeat_interval_minutes = repeat_interval_minutes;
      if (is_active !== undefined) policy.is_active = is_active;

      if (levels !== undefined) {
        policy.levels = levels.map((level, index) => ({
          id: `${policyId}-level-${index + 1}`,
          level: index + 1,
          escalate_after_minutes: level.escalate_after_minutes || (index === 0 ? 0 : 15),
          targets: level.targets.map((target, tIndex) => ({
            ...target,
            id: `${policyId}-level-${index + 1}-target-${tIndex}`,
          })),
        }));
      }

      // If setting as default, clear other defaults
      if (is_default && !policy.is_default) {
        Array.from(escalationPolicies.values())
          .filter(p => p.organization_id === orgId && p.is_default && p.id !== policyId)
          .forEach(p => {
            p.is_default = false;
            escalationPolicies.set(p.id, p);
          });
      }
      if (is_default !== undefined) policy.is_default = is_default;

      policy.updated_at = new Date();
      escalationPolicies.set(policyId, policy);

      // Log audit entry
      const userId = 'userId' in user ? user.userId : (user as ApiKeyPayload).user_id;
      await logAuditEntry(
        request,
        orgId,
        userId,
        'update_escalation_policy',
        'escalation_policy',
        policyId,
        { name: policy.name }
      );

      return {
        policy: {
          ...policy,
          created_at: policy.created_at.toISOString(),
          updated_at: policy.updated_at.toISOString(),
        },
      };
    }
  );

  // Delete escalation policy
  app.delete(
    '/api/v1/monitoring/escalation-policies/:policyId',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin'])],
    },
    async (request, reply) => {
      const orgId = getOrganizationId(request);
      const userId = (request.user as JwtPayload).userId;
      const { policyId } = request.params as { policyId: string };

      const policy = escalationPolicies.get(policyId);
      if (!policy || policy.organization_id !== orgId) {
        return reply.status(404).send({ error: 'Escalation policy not found' });
      }

      escalationPolicies.delete(policyId);

      // Log audit entry
      await logAuditEntry(
        request,
        orgId,
        userId,
        'delete_escalation_policy',
        'escalation_policy',
        policyId,
        { name: policy.name }
      );

      return { success: true };
    }
  );

  // Test escalation policy (simulate the escalation flow)
  app.post(
    '/api/v1/monitoring/escalation-policies/:policyId/test',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer'])],
    },
    async (request, reply) => {
      const orgId = getOrganizationId(request);
      const { policyId } = request.params as { policyId: string };

      const policy = escalationPolicies.get(policyId);
      if (!policy || policy.organization_id !== orgId) {
        return reply.status(404).send({ error: 'Escalation policy not found' });
      }

      // Simulate escalation flow
      const escalationFlow = policy.levels.map(level => {
        const notifications: string[] = [];
        level.targets.forEach(target => {
          switch (target.type) {
            case 'user':
              notifications.push(`Notify user: ${target.user_name} (${target.user_email})`);
              break;
            case 'on_call_schedule':
              const schedule = onCallSchedules.get(target.schedule_id || '');
              if (schedule && schedule.members.length > 0) {
                const currentOnCall = schedule.members[schedule.current_on_call_index];
                notifications.push(`Notify on-call: ${currentOnCall.user_name} from "${schedule.name}" schedule`);
              }
              break;
            case 'email':
              notifications.push(`Send email to: ${target.user_email}`);
              break;
            case 'webhook':
              notifications.push(`Call webhook: ${target.webhook_url}`);
              break;
          }
        });
        return {
          level: level.level,
          escalate_after_minutes: level.escalate_after_minutes,
          notifications,
        };
      });

      console.log(`[Escalation Test] Policy "${policy.name}" flow:`, JSON.stringify(escalationFlow, null, 2));

      return {
        success: true,
        policy_name: policy.name,
        escalation_flow: escalationFlow,
        repeat_policy: policy.repeat_policy,
        repeat_interval_minutes: policy.repeat_interval_minutes,
        message: 'Escalation test completed - check console for simulated notifications',
      };
    }
  );
}
