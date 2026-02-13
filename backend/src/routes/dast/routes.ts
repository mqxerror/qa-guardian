// DAST Route Handlers

import { FastifyInstance } from 'fastify';
import { authenticate, requireScopes, JwtPayload, getOrganizationId } from '../../middleware/auth.js';
import { validateURLForSSRF } from '../../utils/index.js';
import { getProject, listProjects } from '../../services/repositories/projects.js';
import { logAuditEntry } from '../audit-logs.js';

import {
  DASTConfig,
  DASTFalsePositive,
  DASTScanResult,
  OpenAPISpec,
  ReportFormat,
  GraphQLScanConfig,
} from './types.js';
import {
  getDastScansByProject,
  getDastScan, // Feature #124: Use direct scan lookup to avoid N+1 queries
  getDastScansByOrg, // Feature #124: Org-wide scans without N+1
  getDastFalsePositives,
  addDastFalsePositive,
  deleteDastFalsePositive,
  saveOpenApiSpec,
  getOpenApiSpec,
  deleteOpenApiSpec,
  ZAP_SCAN_PROFILES,
  SCHEDULE_FREQUENCIES,
} from './stores.js';
import {
  generateId,
  getDASTConfig,
  updateDASTConfig,
} from './utils.js';
import { runZAPScan, parseOpenAPISpec } from './scanner.js';
import { runLightweightScan, isZAPAvailable } from './lightweight-scanner.js';
import { generateHTMLReport, generateJSONReport, generatePDFReport } from './reports.js';
import {
  startGraphQLScan,
  getGraphQLScan,
  listGraphQLScans,
  performGraphQLIntrospection,
} from './graphql.js';
import { createLogger } from '../../services/logger.js';
import { sendError } from '../../utils/errors.js';
// Feature #715: Zod validation middleware and schemas
import {
  validateParams,
  validateBody,
  validateQuery,
  dastProjectIdParamsSchema,
  dastScanIdParamsSchema,
  dastAlertIdParamsSchema,
  dastFalsePositiveIdParamsSchema,
  dastTriggerScanBodySchema,
  dastFalsePositiveBodySchema,
  dastAlertsQuerySchema,
  dastReportQuerySchema,
  dastStatsQuerySchema,
  dastOpenApiUploadBodySchema,
  dastConfigUpdateBodySchema,
  dastGraphqlScanBodySchema,
  dastGraphqlIntrospectBodySchema,
  dastGraphqlScanIdParamsSchema,
  dastGraphqlScansQuerySchema,
} from '../../validation/index.js';

const logger = createLogger('dast');

// DAST Routes
export async function dastRoutes(app: FastifyInstance) {
  // Get DAST scan profiles
  // Feature #389: Add authentication to protect endpoint
  app.get('/api/v1/dast/profiles', {
    preHandler: [authenticate, requireScopes(['read'])],
  }, async (request, reply) => {
    return reply.send({
      profiles: Object.entries(ZAP_SCAN_PROFILES).map(([id, profile]) => ({
        id,
        ...profile,
      })),
    });
  });

  // Get DAST config for a project
  // Feature #715: Zod validation for projectId param
  app.get<{
    Params: { projectId: string };
  }>('/api/v1/projects/:projectId/dast/config', {
    preHandler: [authenticate, requireScopes(['read'])],
    preValidation: [validateParams(dastProjectIdParamsSchema)],
  }, async (request, reply) => {
    const { projectId } = request.params;
    const orgId = getOrganizationId(request);

    const project = await getProject(projectId);
    if (!project || project.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Project not found');
    }

    const config = await getDASTConfig(projectId);
    return reply.send({ config });
  });

  // Update DAST config for a project
  // Feature #715: Zod validation for projectId param and config body
  app.put<{
    Params: { projectId: string };
    Body: Partial<DASTConfig>;
  }>('/api/v1/projects/:projectId/dast/config', {
    preHandler: [authenticate, requireScopes(['write'])],
    preValidation: [validateParams(dastProjectIdParamsSchema), validateBody(dastConfigUpdateBodySchema)],
  }, async (request, reply) => {
    const { projectId } = request.params;
    const orgId = getOrganizationId(request);

    const project = await getProject(projectId);
    if (!project || project.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Project not found');
    }

    const updatedConfig = await updateDASTConfig(projectId, request.body);

    logAuditEntry(
      request,
      'dast_config_update',
      'project',
      projectId,
      project.name,
      { config: request.body }
    );

    return reply.send({ config: updatedConfig });
  });

  // Get DAST scans for a project
  // Feature #715: Zod validation for projectId param
  app.get<{
    Params: { projectId: string };
    Querystring: { limit?: string };
  }>('/api/v1/projects/:projectId/dast/scans', {
    preHandler: [authenticate, requireScopes(['read'])],
    preValidation: [validateParams(dastProjectIdParamsSchema)],
  }, async (request, reply) => {
    const { projectId } = request.params;
    const { limit = '10' } = request.query;
    const orgId = getOrganizationId(request);

    const project = await getProject(projectId);
    if (!project || project.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Project not found');
    }

    const scans = await getDastScansByProject(projectId);
    const limitNum = Math.min(parseInt(limit) || 10, 100);
    const recentScans = [...scans].reverse().slice(0, limitNum);

    return reply.send({
      scans: recentScans,
      total: scans.length,
    });
  });

  // Trigger a new DAST scan
  // Feature #715: Zod validation for projectId param and scan body
  app.post<{
    Params: { projectId: string };
    Body: {
      targetUrl?: string;
      scanProfile?: 'baseline' | 'full' | 'api';
    };
  }>('/api/v1/projects/:projectId/dast/scans', {
    preHandler: [authenticate, requireScopes(['execute'])],
    preValidation: [validateParams(dastProjectIdParamsSchema), validateBody(dastTriggerScanBodySchema)],
  }, async (request, reply) => {
    const { projectId } = request.params;
    const orgId = getOrganizationId(request);

    const project = await getProject(projectId);
    if (!project || project.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Project not found');
    }

    const config = await getDASTConfig(projectId);
    const targetUrl = request.body.targetUrl || config.targetUrl;
    const scanProfile = request.body.scanProfile || config.scanProfile;

    if (!targetUrl) {
      return sendError(reply, 400, 'BAD_REQUEST', 'Please configure a target URL in DAST settings or provide one in the request.');
    }

    try {
      new URL(targetUrl);
    } catch {
      return sendError(reply, 400, 'BAD_REQUEST', 'Please provide a valid target URL (e.g., https://example.com)');
    }

    // SSRF protection: prevent scans against internal/private networks
    const ssrfValidation = validateURLForSSRF(targetUrl, {
      allowLocalhost: false,
      requireHttps: false,
    });
    if (!ssrfValidation.safe) {
      return sendError(reply, 400, 'BAD_REQUEST', ssrfValidation.error || 'Internal or private network URLs are not allowed for DAST scans.');
    }

    // Try ZAP first; fallback to lightweight scanner if ZAP is unavailable
    let scan: DASTScanResult;
    const zapAvailable = await isZAPAvailable();
    if (zapAvailable) {
      logger.info({ targetUrl }, 'ZAP available - using ZAP scanner');
      scan = await runZAPScan(projectId, targetUrl, scanProfile, config.authConfig, config.contextConfig);
    } else {
      logger.info({ targetUrl }, 'ZAP not available - using lightweight scanner');
      scan = await runLightweightScan(projectId, targetUrl, scanProfile, config.authConfig, config.contextConfig);
    }

    logAuditEntry(
      request,
      'dast_scan_start',
      'project',
      projectId,
      project.name,
      { scanId: scan.id, targetUrl, scanProfile }
    );

    return reply.status(202).send({
      message: 'DAST scan started',
      scan: {
        id: scan.id,
        status: scan.status,
        targetUrl: scan.targetUrl,
        scanProfile: scan.scanProfile,
        startedAt: scan.startedAt,
      },
    });
  });

  // Get a specific DAST scan
  // Feature #124: Use direct scan lookup instead of fetching all + filter
  // Feature #715: Zod validation for projectId + scanId params
  app.get<{
    Params: { projectId: string; scanId: string };
  }>('/api/v1/projects/:projectId/dast/scans/:scanId', {
    preHandler: [authenticate, requireScopes(['read'])],
    preValidation: [validateParams(dastScanIdParamsSchema)],
  }, async (request, reply) => {
    const { projectId, scanId } = request.params;
    const orgId = getOrganizationId(request);

    const project = await getProject(projectId);
    if (!project || project.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Project not found');
    }

    // Feature #124: Direct lookup instead of getDastScansByProject + filter
    const scan = await getDastScan(scanId);

    if (!scan || scan.projectId !== projectId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Scan not found');
    }

    return reply.send({ scan });
  });

  // Get alerts from a specific scan
  // Feature #124: Use direct scan lookup instead of fetching all + filter
  // Feature #715: Zod validation for params and query
  app.get<{
    Params: { projectId: string; scanId: string };
    Querystring: { risk?: string; confidence?: string; includeFalsePositives?: string };
  }>('/api/v1/projects/:projectId/dast/scans/:scanId/alerts', {
    preHandler: [authenticate, requireScopes(['read'])],
    preValidation: [validateParams(dastScanIdParamsSchema), validateQuery(dastAlertsQuerySchema)],
  }, async (request, reply) => {
    const { projectId, scanId } = request.params;
    const { risk, confidence, includeFalsePositives = 'false' } = request.query;
    const orgId = getOrganizationId(request);

    const project = await getProject(projectId);
    if (!project || project.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Project not found');
    }

    // Feature #124: Direct lookup instead of getDastScansByProject + filter
    const scan = await getDastScan(scanId);

    if (!scan || scan.projectId !== projectId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Scan not found');
    }

    let alerts = [...scan.alerts];

    if (risk) {
      const riskLevels = risk.split(',').map(r => r.trim());
      alerts = alerts.filter(a => riskLevels.includes(a.risk));
    }

    if (confidence) {
      const confidenceLevels = confidence.split(',').map(c => c.trim());
      alerts = alerts.filter(a => confidenceLevels.includes(a.confidence));
    }

    if (includeFalsePositives !== 'true') {
      alerts = alerts.filter(a => !a.isFalsePositive);
    }

    return reply.send({
      alerts,
      total: alerts.length,
      scan: {
        id: scan.id,
        status: scan.status,
        targetUrl: scan.targetUrl,
      },
    });
  });

  // Generate and download DAST scan report
  // Feature #124: Use direct scan lookup instead of fetching all + filter
  // Feature #715: Zod validation for params and query
  app.get<{
    Params: { projectId: string; scanId: string };
    Querystring: { format?: string };
  }>('/api/v1/projects/:projectId/dast/scans/:scanId/report', {
    preHandler: [authenticate, requireScopes(['read'])],
    preValidation: [validateParams(dastScanIdParamsSchema), validateQuery(dastReportQuerySchema)],
  }, async (request, reply) => {
    const { projectId, scanId } = request.params;
    const { format = 'html' } = request.query;
    const orgId = getOrganizationId(request);

    const project = await getProject(projectId);
    if (!project || project.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Project not found');
    }

    // Feature #124: Direct lookup instead of getDastScansByProject + filter
    const scan = await getDastScan(scanId);

    if (!scan || scan.projectId !== projectId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Scan not found');
    }

    if (scan.status !== 'completed') {
      return sendError(reply, 400, 'BAD_REQUEST', 'Reports can only be generated for completed scans.');
    }

    const validFormats: ReportFormat[] = ['pdf', 'html', 'json'];
    const reportFormat = format.toLowerCase() as ReportFormat;
    if (!validFormats.includes(reportFormat)) {
      return sendError(reply, 400, 'BAD_REQUEST', `Supported formats: ${validFormats.join(', ')}`);
    }

    const projectName = project.name;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    let content: string | object;
    let contentType: string;
    let fileName: string;

    switch (reportFormat) {
      case 'json':
        content = generateJSONReport(scan, projectName);
        contentType = 'application/json';
        fileName = `dast-report-${projectName}-${timestamp}.json`;
        break;
      case 'pdf':
        content = generatePDFReport(scan, projectName);
        contentType = 'text/html';
        fileName = `dast-report-${projectName}-${timestamp}.html`;
        break;
      case 'html':
      default:
        content = generateHTMLReport(scan, projectName);
        contentType = 'text/html';
        fileName = `dast-report-${projectName}-${timestamp}.html`;
        break;
    }

    logAuditEntry(
      request,
      'dast_report_generated',
      'project',
      projectId,
      projectName,
      { scanId, format: reportFormat, alertCount: scan.summary.total }
    );

    reply
      .header('Content-Type', contentType)
      .header('Content-Disposition', `attachment; filename="${fileName}"`);

    if (reportFormat === 'json') {
      return reply.send(content);
    } else {
      return reply.send(content as string);
    }
  });

  // Get available report formats
  // Feature #389: Add authentication to protect endpoint
  app.get('/api/v1/dast/report-formats', {
    preHandler: [authenticate, requireScopes(['read'])],
  }, async (request, reply) => {
    return reply.send({
      formats: [
        {
          id: 'html',
          name: 'HTML Report',
          description: 'Interactive HTML report viewable in any browser',
          contentType: 'text/html',
          extension: '.html',
        },
        {
          id: 'pdf',
          name: 'PDF Report',
          description: 'Print-optimized HTML for saving as PDF',
          contentType: 'text/html',
          extension: '.html',
        },
        {
          id: 'json',
          name: 'JSON Report',
          description: 'Machine-readable JSON format for integrations',
          contentType: 'application/json',
          extension: '.json',
        },
      ],
    });
  });

  // Mark an alert as false positive
  // Feature #124: Use direct scan lookup instead of fetching all + filter
  // Feature #715: Zod validation for params and body
  app.post<{
    Params: { projectId: string; scanId: string; alertId: string };
    Body: { reason: string };
  }>('/api/v1/projects/:projectId/dast/scans/:scanId/alerts/:alertId/false-positive', {
    preHandler: [authenticate, requireScopes(['write'])],
    preValidation: [validateParams(dastAlertIdParamsSchema), validateBody(dastFalsePositiveBodySchema)],
  }, async (request, reply) => {
    const { projectId, scanId, alertId } = request.params;
    const { reason } = request.body;
    const user = request.user as JwtPayload;
    const orgId = getOrganizationId(request);

    const project = await getProject(projectId);
    if (!project || project.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Project not found');
    }

    if (!reason || reason.trim().length < 10) {
      return sendError(reply, 400, 'BAD_REQUEST', 'Please provide a reason of at least 10 characters.');
    }

    // Feature #124: Direct lookup instead of getDastScansByProject + filter
    const scan = await getDastScan(scanId);

    if (!scan || scan.projectId !== projectId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Scan not found');
    }

    const alert = scan.alerts.find(a => a.id === alertId);
    if (!alert) {
      return sendError(reply, 404, 'NOT_FOUND', 'Alert not found');
    }

    const fp: DASTFalsePositive = {
      id: generateId(),
      projectId,
      pluginId: alert.pluginId,
      url: alert.url,
      param: alert.param,
      reason: reason.trim(),
      markedBy: user.email,
      markedAt: new Date().toISOString(),
    };

    await addDastFalsePositive(fp);

    alert.isFalsePositive = true;

    scan.summary.total = scan.alerts.filter(a => !a.isFalsePositive).length;
    scan.summary.byRisk = {
      high: scan.alerts.filter(a => !a.isFalsePositive && a.risk === 'High').length,
      medium: scan.alerts.filter(a => !a.isFalsePositive && a.risk === 'Medium').length,
      low: scan.alerts.filter(a => !a.isFalsePositive && a.risk === 'Low').length,
      informational: scan.alerts.filter(a => !a.isFalsePositive && a.risk === 'Informational').length,
    };

    logAuditEntry(
      request,
      'dast_alert_false_positive',
      'project',
      projectId,
      project.name,
      { scanId, alertId, pluginId: alert.pluginId, url: alert.url, reason }
    );

    return reply.send({
      message: 'Alert marked as false positive',
      falsePositive: fp,
    });
  });

  // Get false positives for a project
  // Feature #715: Zod validation for projectId param
  app.get<{
    Params: { projectId: string };
  }>('/api/v1/projects/:projectId/dast/false-positives', {
    preHandler: [authenticate, requireScopes(['read'])],
    preValidation: [validateParams(dastProjectIdParamsSchema)],
  }, async (request, reply) => {
    const { projectId } = request.params;
    const orgId = getOrganizationId(request);

    const project = await getProject(projectId);
    if (!project || project.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Project not found');
    }

    const fps = await getDastFalsePositives(projectId);

    return reply.send({
      falsePositives: fps,
      total: fps.length,
    });
  });

  // Remove a false positive
  // Feature #715: Zod validation for false positive params
  app.delete<{
    Params: { projectId: string; falsePositiveId: string };
  }>('/api/v1/projects/:projectId/dast/false-positives/:falsePositiveId', {
    preHandler: [authenticate, requireScopes(['write'])],
    preValidation: [validateParams(dastFalsePositiveIdParamsSchema)],
  }, async (request, reply) => {
    const { projectId, falsePositiveId } = request.params;
    const orgId = getOrganizationId(request);

    const project = await getProject(projectId);
    if (!project || project.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Project not found');
    }

    const fps = await getDastFalsePositives(projectId);
    const fp = fps.find(f => f.id === falsePositiveId);

    if (!fp) {
      return sendError(reply, 404, 'NOT_FOUND', 'False positive record not found');
    }

    await deleteDastFalsePositive(falsePositiveId);

    logAuditEntry(
      request,
      'dast_false_positive_remove',
      'project',
      projectId,
      project.name,
      { falsePositiveId, pluginId: fp.pluginId, url: fp.url }
    );

    return reply.send({ message: 'False positive removed', falsePositive: fp });
  });

  // Get organization-wide DAST statistics
  // Feature #124: Optimized to use single JOIN query instead of N+1 queries
  // Feature #715: Zod validation for stats query
  app.get<{
    Querystring: { days?: string };
  }>('/api/v1/organizations/current/dast/stats', {
    preHandler: [authenticate, requireScopes(['read'])],
    preValidation: [validateQuery(dastStatsQuerySchema)],
  }, async (request, reply) => {
    const { days = '30' } = request.query;
    const orgId = getOrganizationId(request);
    const daysNum = parseInt(days) || 30;
    const cutoff = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000);

    // Feature #124: Single query to get all scans for org instead of N+1
    const [orgProjects, allScans] = await Promise.all([
      listProjects(orgId),
      getDastScansByOrg(orgId, { since: cutoff }),
    ]);

    let totalAlerts = 0;
    const alertsByRisk = { high: 0, medium: 0, low: 0, informational: 0 };
    const completedScans: DASTScanResult[] = [];

    for (const scan of allScans) {
      if (scan.status === 'completed') {
        totalAlerts += scan.summary.total;
        alertsByRisk.high += scan.summary.byRisk.high;
        alertsByRisk.medium += scan.summary.byRisk.medium;
        alertsByRisk.low += scan.summary.byRisk.low;
        alertsByRisk.informational += scan.summary.byRisk.informational;
        completedScans.push(scan);
      }
    }

    // Get DAST config status for all projects in parallel
    const configPromises = orgProjects.map(p => getDASTConfig(p.id));
    const configs = await Promise.all(configPromises);
    const projectsWithDAST = configs.filter(c => c?.enabled).length;

    return reply.send({
      period: { days: daysNum, start: cutoff.toISOString(), end: new Date().toISOString() },
      stats: {
        totalScans: allScans.length,
        totalAlerts,
        alertsByRisk,
        projectsWithDAST,
        totalProjects: orgProjects.length,
      },
      recentScans: completedScans.slice(0, 5).map(s => ({
        id: s.id,
        projectId: s.projectId,
        targetUrl: s.targetUrl,
        status: s.status,
        startedAt: s.startedAt,
        completedAt: s.completedAt,
        summary: s.summary,
      })),
    });
  });

  // Upload OpenAPI specification
  // Feature #715: Zod validation for params and body
  app.post<{
    Params: { projectId: string };
    Body: { content: string; name?: string };
  }>('/api/v1/projects/:projectId/dast/openapi-spec', {
    preHandler: [authenticate, requireScopes(['write'])],
    preValidation: [validateParams(dastProjectIdParamsSchema), validateBody(dastOpenApiUploadBodySchema)],
  }, async (request, reply) => {
    const { projectId } = request.params;
    const { content, name = 'API Specification' } = request.body;
    const user = request.user as JwtPayload;
    const orgId = getOrganizationId(request);

    const project = await getProject(projectId);
    if (!project || project.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Project not found');
    }

    if (!content || typeof content !== 'string') {
      return sendError(reply, 400, 'BAD_REQUEST', 'Please provide the OpenAPI specification content as a JSON or YAML string.');
    }

    try {
      const parsedSpec = parseOpenAPISpec(content);

      const specId = generateId();
      const spec: OpenAPISpec = {
        id: specId,
        projectId,
        name: parsedSpec.info?.title || name,
        version: parsedSpec.info?.version || '1.0.0',
        content,
        endpoints: parsedSpec.endpoints,
        uploadedAt: new Date().toISOString(),
        uploadedBy: user.email,
      };

      await saveOpenApiSpec(spec);
      await updateDASTConfig(projectId, { openApiSpecId: specId });

      logAuditEntry(
        request,
        'openapi_spec_upload',
        'project',
        projectId,
        project.name,
        { specId, name: spec.name, endpointCount: spec.endpoints.length }
      );

      return reply.status(201).send({
        message: 'OpenAPI specification uploaded successfully',
        spec: {
          id: spec.id,
          name: spec.name,
          version: spec.version,
          endpointCount: spec.endpoints.length,
          uploadedAt: spec.uploadedAt,
        },
      });
    } catch (error) {
      return sendError(reply, 400, 'BAD_REQUEST', error instanceof Error ? error.message : 'Failed to parse OpenAPI specification');
    }
  });

  // Get OpenAPI specification for a project
  // Feature #715: Zod validation for projectId param
  app.get<{
    Params: { projectId: string };
  }>('/api/v1/projects/:projectId/dast/openapi-spec', {
    preHandler: [authenticate, requireScopes(['read'])],
    preValidation: [validateParams(dastProjectIdParamsSchema)],
  }, async (request, reply) => {
    const { projectId } = request.params;
    const orgId = getOrganizationId(request);

    const project = await getProject(projectId);
    if (!project || project.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Project not found');
    }

    const config = await getDASTConfig(projectId);
    if (!config.openApiSpecId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Upload an OpenAPI specification to enable API scanning.');
    }

    const spec = await getOpenApiSpec(config.openApiSpecId);
    if (!spec) {
      return sendError(reply, 404, 'NOT_FOUND', 'OpenAPI specification not found');
    }

    return reply.send({
      spec: {
        id: spec.id,
        name: spec.name,
        version: spec.version,
        endpoints: spec.endpoints,
        endpointCount: spec.endpoints.length,
        uploadedAt: spec.uploadedAt,
        uploadedBy: spec.uploadedBy,
      },
    });
  });

  // Delete OpenAPI specification
  // Feature #715: Zod validation for projectId param
  app.delete<{
    Params: { projectId: string };
  }>('/api/v1/projects/:projectId/dast/openapi-spec', {
    preHandler: [authenticate, requireScopes(['write'])],
    preValidation: [validateParams(dastProjectIdParamsSchema)],
  }, async (request, reply) => {
    const { projectId } = request.params;
    const orgId = getOrganizationId(request);

    const project = await getProject(projectId);
    if (!project || project.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Project not found');
    }

    const config = await getDASTConfig(projectId);
    if (!config.openApiSpecId) {
      return sendError(reply, 404, 'NOT_FOUND', 'No OpenAPI specification to delete');
    }

    const spec = await getOpenApiSpec(config.openApiSpecId);
    await deleteOpenApiSpec(config.openApiSpecId);
    await updateDASTConfig(projectId, { openApiSpecId: undefined });

    logAuditEntry(
      request,
      'openapi_spec_delete',
      'project',
      projectId,
      project.name,
      { specId: config.openApiSpecId }
    );

    return reply.send({
      message: 'OpenAPI specification deleted',
      spec: spec ? { id: spec.id, name: spec.name } : null,
    });
  });

  // Get available schedule frequencies
  app.get('/api/v1/dast/schedule-frequencies', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    return reply.send({
      frequencies: Object.entries(SCHEDULE_FREQUENCIES).map(([id, info]) => ({
        id,
        ...info,
      })),
    });
  });

  // GraphQL scan routes
  // Feature #715: Zod validation for GraphQL scan body
  app.post<{
    Body: GraphQLScanConfig;
  }>('/api/v1/dast/graphql/scan', {
    preHandler: [authenticate, requireScopes(['write'])],
    preValidation: [validateBody(dastGraphqlScanBodySchema)],
  }, async (request, reply) => {
    const config = request.body;

    if (!config.endpoint) {
      return sendError(reply, 400, 'BAD_REQUEST', 'GraphQL endpoint URL is required');
    }

    // SSRF protection: prevent scans against internal/private networks
    const ssrfCheck = validateURLForSSRF(config.endpoint, {
      allowLocalhost: false,
      requireHttps: false,
    });
    if (!ssrfCheck.safe) {
      return sendError(reply, 400, 'BAD_REQUEST', ssrfCheck.error || 'Internal or private network URLs are not allowed for GraphQL scans.');
    }

    const scan = await startGraphQLScan(config);

    logAuditEntry(
      request,
      'graphql_scan_started',
      'dast',
      scan.id,
      config.endpoint,
      { config }
    );

    return reply.status(202).send({
      scanId: scan.id,
      message: 'GraphQL security scan started',
      status: 'introspecting',
    });
  });

  // Get GraphQL scan status/result
  // Feature #715: Zod validation for scanId param
  app.get<{
    Params: { scanId: string };
  }>('/api/v1/dast/graphql/scan/:scanId', {
    preHandler: [authenticate, requireScopes(['read'])],
    preValidation: [validateParams(dastGraphqlScanIdParamsSchema)],
  }, async (request, reply) => {
    const { scanId } = request.params;
    const scan = await getGraphQLScan(scanId);

    if (!scan) {
      return sendError(reply, 404, 'NOT_FOUND', 'GraphQL scan not found');
    }

    return reply.send({ scan });
  });

  // List all GraphQL scans
  // Feature #715: Zod validation for GraphQL scans query
  app.get<{
    Querystring: { limit?: string; status?: string };
  }>('/api/v1/dast/graphql/scans', {
    preHandler: [authenticate, requireScopes(['read'])],
    preValidation: [validateQuery(dastGraphqlScansQuerySchema)],
  }, async (request, reply) => {
    const { limit = '10', status } = request.query;
    const limitNum = Math.min(parseInt(limit) || 10, 100);

    const scans = await listGraphQLScans(limitNum, status);

    return reply.send({
      scans,
      total: scans.length,
    });
  });

  // Perform introspection only
  // Feature #715: Zod validation for introspection body
  app.post<{
    Body: { endpoint: string; authHeader?: string };
  }>('/api/v1/dast/graphql/introspect', {
    preHandler: [authenticate, requireScopes(['read'])],
    preValidation: [validateBody(dastGraphqlIntrospectBodySchema)],
  }, async (request, reply) => {
    const { endpoint, authHeader } = request.body;

    if (!endpoint) {
      return sendError(reply, 400, 'BAD_REQUEST', 'GraphQL endpoint URL is required');
    }

    // SSRF protection: prevent introspection against internal/private networks
    const ssrfCheck = validateURLForSSRF(endpoint, {
      allowLocalhost: false,
      requireHttps: false,
    });
    if (!ssrfCheck.safe) {
      return sendError(reply, 400, 'BAD_REQUEST', ssrfCheck.error || 'Internal or private network URLs are not allowed for GraphQL introspection.');
    }

    try {
      const schema = performGraphQLIntrospection(endpoint, authHeader);
      return reply.send({ schema });
    } catch (error: unknown) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to introspect GraphQL schema', { details: error instanceof Error ? error.message : String(error) });
    }
  });
}
