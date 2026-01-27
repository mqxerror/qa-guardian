// Projects Module - Project Settings Routes
// Handles visual settings and healing settings

import { FastifyInstance } from 'fastify';
import { authenticate, JwtPayload, getOrganizationId } from '../../middleware/auth';
import { ProjectVisualSettings, ProjectHealingSettings } from './types';
import { projects } from './stores';
import {
  getProjectVisualSettings,
  setProjectVisualSettings,
  getProjectHealingSettings,
  setProjectHealingSettings,
  hasProjectAccess,
  getProjectRole,
} from './utils';

// Settings routes use :projectId param
interface ProjectIdParams {
  projectId: string;
}

export async function settingsRoutes(app: FastifyInstance) {
  // Feature #454: Get project visual settings
  app.get<{ Params: ProjectIdParams }>('/api/v1/projects/:projectId/visual-settings', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { projectId } = request.params;
    const user = request.user as JwtPayload;
    const userOrgId = getOrganizationId(request);

    const project = projects.get(projectId);
    if (!project || project.organization_id !== userOrgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Project not found',
      });
    }

    // Check project access
    if (!hasProjectAccess(projectId, user.id, user.role)) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You do not have access to this project',
      });
    }

    const settings = getProjectVisualSettings(projectId);

    return {
      project_id: projectId,
      visual_settings: settings,
    };
  });

  // Feature #454: Update project visual settings
  app.put<{ Params: ProjectIdParams; Body: Partial<{
    default_diff_threshold: number;
    default_diff_threshold_mode: 'percentage' | 'pixel_count';
    default_diff_pixel_threshold: number;
    default_capture_mode: 'full_page' | 'viewport' | 'element';
    default_viewport_width: number;
    default_viewport_height: number;
  }> }>('/api/v1/projects/:projectId/visual-settings', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { projectId } = request.params;
    const updates = request.body;
    const user = request.user as JwtPayload;
    const userOrgId = getOrganizationId(request);

    const project = projects.get(projectId);
    if (!project || project.organization_id !== userOrgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Project not found',
      });
    }

    // Only owners, admins, and project admins can change settings
    const projectRole = getProjectRole(projectId, user.id, user.role);
    if (!['owner', 'admin'].includes(projectRole || '')) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Only project owners and admins can change visual settings',
      });
    }

    // Validate threshold
    if (updates.default_diff_threshold !== undefined) {
      if (typeof updates.default_diff_threshold !== 'number' ||
          updates.default_diff_threshold < 0 ||
          updates.default_diff_threshold > 100) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'default_diff_threshold must be a number between 0 and 100',
        });
      }
    }

    // Validate threshold mode
    if (updates.default_diff_threshold_mode !== undefined &&
        !['percentage', 'pixel_count'].includes(updates.default_diff_threshold_mode)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'default_diff_threshold_mode must be "percentage" or "pixel_count"',
      });
    }

    // Validate capture mode
    if (updates.default_capture_mode !== undefined &&
        !['full_page', 'viewport', 'element'].includes(updates.default_capture_mode)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'default_capture_mode must be "full_page", "viewport", or "element"',
      });
    }

    // Validate viewport dimensions
    if (updates.default_viewport_width !== undefined &&
        (typeof updates.default_viewport_width !== 'number' ||
         updates.default_viewport_width < 100 ||
         updates.default_viewport_width > 10000)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'default_viewport_width must be between 100 and 10000',
      });
    }

    if (updates.default_viewport_height !== undefined &&
        (typeof updates.default_viewport_height !== 'number' ||
         updates.default_viewport_height < 100 ||
         updates.default_viewport_height > 10000)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'default_viewport_height must be between 100 and 10000',
      });
    }

    const updatedSettings = setProjectVisualSettings(projectId, updates);

    console.log(`[PROJECT VISUAL SETTINGS] Project ${project.name} visual settings updated by ${user.email}`);

    return {
      project_id: projectId,
      visual_settings: updatedSettings,
      message: 'Visual settings updated successfully',
    };
  });

  // Feature #1064: Get project healing settings
  app.get<{ Params: ProjectIdParams }>('/api/v1/projects/:projectId/healing-settings', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { projectId } = request.params;
    const user = request.user as JwtPayload;
    const userOrgId = getOrganizationId(request);

    const project = projects.get(projectId);
    if (!project || project.organization_id !== userOrgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Project not found',
      });
    }

    // Check project access
    if (!hasProjectAccess(projectId, user.id, user.role)) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You do not have access to this project',
      });
    }

    const settings = getProjectHealingSettings(projectId);

    return {
      project_id: projectId,
      healing_settings: settings,
    };
  });

  // Feature #1064: Update project healing settings (Set healing timeout duration)
  // Feature #1062: Added auto_heal_confidence_threshold
  app.put<{ Params: ProjectIdParams; Body: Partial<{
    healing_enabled: boolean;
    healing_timeout: number;
    max_healing_attempts: number;
    healing_strategies: string[];
    notify_on_healing: boolean;
    auto_heal_confidence_threshold: number;
  }> }>('/api/v1/projects/:projectId/healing-settings', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { projectId } = request.params;
    const updates = request.body;
    const user = request.user as JwtPayload;
    const userOrgId = getOrganizationId(request);

    const project = projects.get(projectId);
    if (!project || project.organization_id !== userOrgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Project not found',
      });
    }

    // Only owners, admins, and project admins can change settings
    const projectRole = getProjectRole(projectId, user.id, user.role);
    if (!['owner', 'admin'].includes(projectRole || '')) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Only project owners and admins can change healing settings',
      });
    }

    // Validate healing_timeout (5-120 seconds)
    if (updates.healing_timeout !== undefined) {
      if (typeof updates.healing_timeout !== 'number' ||
          updates.healing_timeout < 5 ||
          updates.healing_timeout > 120) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'healing_timeout must be a number between 5 and 120 seconds',
        });
      }
    }

    // Validate max_healing_attempts (1-10)
    if (updates.max_healing_attempts !== undefined) {
      if (typeof updates.max_healing_attempts !== 'number' ||
          updates.max_healing_attempts < 1 ||
          updates.max_healing_attempts > 10) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'max_healing_attempts must be a number between 1 and 10',
        });
      }
    }

    // Feature #1062: Validate auto_heal_confidence_threshold (0.5-1.0)
    if (updates.auto_heal_confidence_threshold !== undefined) {
      if (typeof updates.auto_heal_confidence_threshold !== 'number' ||
          updates.auto_heal_confidence_threshold < 0.5 ||
          updates.auto_heal_confidence_threshold > 1.0) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'auto_heal_confidence_threshold must be a number between 0.5 and 1.0',
        });
      }
    }

    // Validate healing_strategies
    const validStrategies = ['selector_fallback', 'visual_match', 'text_match', 'attribute_match', 'css_selector', 'xpath'];
    if (updates.healing_strategies !== undefined) {
      if (!Array.isArray(updates.healing_strategies)) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'healing_strategies must be an array',
        });
      }
      for (const strategy of updates.healing_strategies) {
        if (!validStrategies.includes(strategy)) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: `Invalid healing strategy: ${strategy}. Valid strategies: ${validStrategies.join(', ')}`,
          });
        }
      }
    }

    const updatedSettings = setProjectHealingSettings(projectId, updates);

    console.log(`[PROJECT HEALING SETTINGS] Project ${project.name} healing settings updated by ${user.email}`);
    console.log(`[PROJECT HEALING SETTINGS] New timeout: ${updatedSettings.healing_timeout}s, Max attempts: ${updatedSettings.max_healing_attempts}, Threshold: ${updatedSettings.auto_heal_confidence_threshold}`);

    return {
      project_id: projectId,
      healing_settings: updatedSettings,
      message: 'Healing settings updated successfully',
    };
  });
}
