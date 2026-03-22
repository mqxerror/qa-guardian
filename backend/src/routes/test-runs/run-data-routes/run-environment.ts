/**
 * Run Data Routes - Environment Variables
 *
 * Endpoints for managing test run environment variables:
 * - POST /api/v1/runs/:runId/environment (set env vars)
 * - GET /api/v1/runs/:runId/environment (get env vars)
 * - DELETE /api/v1/runs/:runId/environment (delete env vars)
 *
 * Feature #1356: Code quality - extracted from run-data-routes.ts
 */

import { FastifyInstance } from 'fastify';
import { authenticate, getOrganizationId } from '../../../middleware/auth.js';
import { getTestSuite } from '../../test-suites.js';
import { getProjectEnvVars } from '../../projects.js';
import { EnvironmentVariable } from '../../projects/types.js';
import { setTestRun } from '../execution.js';
import { TestSuite } from '../../test-suites/types.js';
// Feature #484: Pino structured logging
import { createLogger } from '../../../services/logger.js';
import { sendError } from '../../../utils/errors.js';
// Feature #732: Zod validation for run data routes
import {
  validateBody,
  validateParams,
  runIdParamSchema,
  setRunEnvVarsBodySchema,
  deleteRunEnvVarsBodySchema,
} from '../../../validation/index.js';
import { getTestRunWithFallback, TestRunParams, SetRunEnvVarsBody, DeleteRunEnvVarsBody } from './helpers.js';

const log = createLogger('run-data-routes:environment');

export async function runEnvironmentRoutes(app: FastifyInstance): Promise<void> {
  // Feature #894: Set environment variables for a test run
  // Feature #732: Zod validation for run env vars
  app.post<{ Params: TestRunParams; Body: SetRunEnvVarsBody }>('/api/v1/runs/:runId/environment', {
    preHandler: [authenticate],
    preValidation: [validateParams(runIdParamSchema), validateBody(setRunEnvVarsBodySchema)],
  }, async (request, reply) => {
    const { runId } = request.params;
    const orgId = getOrganizationId(request);
    const { env_vars, merge = true } = request.body || {};

    const run = await getTestRunWithFallback(runId);
    if (!run || run.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test run not found');
    }

    // Can only set env vars on pending or paused runs
    if (run.status !== 'pending' && run.status !== 'paused') {
      return sendError(reply, 400, 'BAD_REQUEST', `Cannot set environment variables for run with status "${run.status}". Only pending or paused runs can have environment variables modified.`, { current_status: run.status });
    }

    // Validate env_vars is an object
    if (!env_vars || typeof env_vars !== 'object' || Array.isArray(env_vars)) {
      return sendError(reply, 400, 'BAD_REQUEST', 'env_vars must be an object with key-value pairs');
    }

    // Validate all values are strings
    for (const [key, value] of Object.entries(env_vars)) {
      if (typeof key !== 'string' || key.trim() === '') {
        return sendError(reply, 400, 'BAD_REQUEST', 'All environment variable keys must be non-empty strings');
      }
      if (typeof value !== 'string') {
        return sendError(reply, 400, 'BAD_REQUEST', `Environment variable "${key}" must have a string value`);
      }
    }

    // Set or merge environment variables
    if (merge && run.run_env_vars) {
      run.run_env_vars = { ...run.run_env_vars, ...env_vars };
    } else {
      run.run_env_vars = { ...env_vars };
    }

    setTestRun(runId, run);
    log.info({ runId, count: Object.keys(env_vars).length, merge, code: 'ENV_VARS_SET' }, 'Environment variables set for run');

    // Get the suite and project env vars for the response
    const suite = await getTestSuite(run.suite_id) as TestSuite | null;
    const projectId = suite?.project_id;
    const projectEnvVarsArray = projectId ? (await getProjectEnvVars(projectId)) || [] : [];

    const runEnvVars = run.run_env_vars || {};
    return {
      run_id: runId,
      status: run.status,
      environment: {
        run_env_vars: runEnvVars,
        run_env_var_count: Object.keys(runEnvVars).length,
        project_env_var_count: projectEnvVarsArray.length,
        total_env_var_count: Object.keys(runEnvVars).length + projectEnvVarsArray.filter(
          (pv: EnvironmentVariable) => !runEnvVars[pv.key] // Only count project vars not overridden by run vars
        ).length,
        merge_mode: merge,
      },
      message: `Successfully set ${Object.keys(env_vars).length} environment variables for run`,
    };
  });

  // Feature #894: Get environment variables for a test run
  app.get<{ Params: TestRunParams }>('/api/v1/runs/:runId/environment', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId } = request.params;
    const orgId = getOrganizationId(request);

    const run = await getTestRunWithFallback(runId);
    if (!run || run.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test run not found');
    }

    // Get the suite and project env vars
    const suiteEnv = await getTestSuite(run.suite_id) as TestSuite | null;
    const projectId = suiteEnv?.project_id;
    const projectEnvVarsArray = projectId ? (await getProjectEnvVars(projectId)) || [] : [];

    // Build merged view of env vars (with masking for sensitive project vars)
    const projectVars: Record<string, { value: string; masked: boolean; source: 'project' }> = {};
    for (const envVar of projectEnvVarsArray) {
      projectVars[envVar.key] = {
        value: envVar.is_secret ? '********' : envVar.value,
        masked: envVar.is_secret,
        source: 'project',
      };
    }

    const runEnvVarsGet = run.run_env_vars || {};
    const runVars: Record<string, { value: string; masked: boolean; source: 'run' }> = {};
    for (const [key, value] of Object.entries(runEnvVarsGet)) {
      runVars[key] = {
        value: value,
        masked: false,
        source: 'run',
      };
    }

    // Effective env vars (run vars override project vars)
    const effectiveVars: Record<string, { value: string; masked: boolean; source: 'project' | 'run'; overridden?: boolean }> = {};

    // First add project vars
    for (const [key, varInfo] of Object.entries(projectVars)) {
      effectiveVars[key] = {
        ...varInfo,
        overridden: key in runEnvVarsGet,
      };
    }

    // Then add run vars (overriding project vars)
    for (const [key, varInfo] of Object.entries(runVars)) {
      effectiveVars[key] = varInfo;
    }

    return {
      run_id: runId,
      status: run.status,
      environment: {
        project_vars: projectVars,
        run_vars: runVars,
        effective_vars: effectiveVars,
        summary: {
          project_var_count: Object.keys(projectVars).length,
          run_var_count: Object.keys(runVars).length,
          effective_var_count: Object.keys(effectiveVars).length,
          overridden_count: Object.values(effectiveVars).filter(v => v.overridden).length,
        },
      },
    };
  });

  // Feature #894: Delete environment variables from a test run
  // Feature #732: Zod validation for delete env vars
  app.delete<{ Params: TestRunParams; Body: DeleteRunEnvVarsBody }>('/api/v1/runs/:runId/environment', {
    preHandler: [authenticate],
    preValidation: [validateParams(runIdParamSchema), validateBody(deleteRunEnvVarsBodySchema)],
  }, async (request, reply) => {
    const { runId } = request.params;
    const orgId = getOrganizationId(request);
    const { keys } = request.body || {};

    const run = await getTestRunWithFallback(runId);
    if (!run || run.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test run not found');
    }

    // Can only modify env vars on pending or paused runs
    if (run.status !== 'pending' && run.status !== 'paused') {
      return sendError(reply, 400, 'BAD_REQUEST', `Cannot modify environment variables for run with status "${run.status}". Only pending or paused runs can have environment variables modified.`, { current_status: run.status });
    }

    if (!run.run_env_vars) {
      return {
        run_id: runId,
        status: run.status,
        deleted_count: 0,
        message: 'No environment variables to delete',
      };
    }

    let deletedCount = 0;

    if (keys && Array.isArray(keys) && keys.length > 0) {
      // Delete specific keys
      for (const key of keys) {
        if (run.run_env_vars[key] !== undefined) {
          delete run.run_env_vars[key];
          deletedCount++;
        }
      }
    } else {
      // Delete all env vars
      deletedCount = Object.keys(run.run_env_vars).length;
      run.run_env_vars = {};
    }

    setTestRun(runId, run);
    log.info({ runId, deletedCount, code: 'ENV_VARS_DELETED' }, 'Environment variables deleted from run');

    return {
      run_id: runId,
      status: run.status,
      deleted_count: deletedCount,
      remaining_env_vars: run.run_env_vars,
      message: deletedCount > 0
        ? `Successfully deleted ${deletedCount} environment variables`
        : 'No matching environment variables found to delete',
    };
  });
}
