// DAST Route Handlers

import { FastifyInstance } from 'fastify';
import { authenticate, requireScopes, JwtPayload, getOrganizationId } from '../../middleware/auth';
import { getProject, listProjects } from '../../services/repositories/projects';
import { logAuditEntry } from '../audit-logs';

import {
  DASTConfig,
  DASTFalsePositive,
  DASTScanResult,
  OpenAPISpec,
  ReportFormat,
  GraphQLScanConfig,
} from './types';
import {
  getDastScansByProject,
  getDastScan,
  getDastFalsePositives,
  addDastFalsePositive,
  deleteDastFalsePositive,
  saveOpenApiSpec,
  getOpenApiSpec,
  getOpenApiSpecsByProject,
  deleteOpenApiSpec,
  ZAP_SCAN_PROFILES,
  SCHEDULE_FREQUENCIES,
} from './stores';
import {
  generateId,
  getDASTConfig,
  updateDASTConfig,
  generateCronExpression,
  calculateDASTNextRun,
} from './utils';
import { simulateZAPScan, parseOpenAPISpec, getOpenAPISpec } from './scanner';
import { generateHTMLReport, generateJSONReport, generatePDFReport } from './reports';
import {
  startGraphQLScan,
  getGraphQLScan,
  listGraphQLScans,
  performGraphQLIntrospection,
} from './graphql';

// DAST Routes
export async function dastRoutes(app: FastifyInstance) {
  // Get DAST scan profiles
  app.get('/api/v1/dast/profiles', async (request, reply) => {
    return reply.send({
      profiles: Object.entries(ZAP_SCAN_PROFILES).map(([id, profile]) => ({
        id,
        ...profile,
      })),
    });
  });

  // Get DAST config for a project
  app.get<{
    Params: { projectId: string };
  }>('/api/v1/projects/:projectId/dast/config', {
    preHandler: [authenticate, requireScopes(['read'])],
  }, async (request, reply) => {
    const { projectId } = request.params;
    const orgId = getOrganizationId(request);

    const project = await getProject(projectId);
    if (!project || project.organization_id !== orgId) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    const config = await getDASTConfig(projectId);
    return reply.send({ config });
  });

  // Update DAST config for a project
  app.put<{
    Params: { projectId: string };
    Body: Partial<DASTConfig>;
  }>('/api/v1/projects/:projectId/dast/config', {
    preHandler: [authenticate, requireScopes(['write'])],
  }, async (request, reply) => {
    const { projectId } = request.params;
    const orgId = getOrganizationId(request);

    const project = await getProject(projectId);
    if (!project || project.organization_id !== orgId) {
      return reply.status(404).send({ error: 'Project not found' });
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
  app.get<{
    Params: { projectId: string };
    Querystring: { limit?: string };
  }>('/api/v1/projects/:projectId/dast/scans', {
    preHandler: [authenticate, requireScopes(['read'])],
  }, async (request, reply) => {
    const { projectId } = request.params;
    const { limit = '10' } = request.query;
    const orgId = getOrganizationId(request);

    const project = await getProject(projectId);
    if (!project || project.organization_id !== orgId) {
      return reply.status(404).send({ error: 'Project not found' });
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
  app.post<{
    Params: { projectId: string };
    Body: {
      targetUrl?: string;
      scanProfile?: 'baseline' | 'full' | 'api';
    };
  }>('/api/v1/projects/:projectId/dast/scans', {
    preHandler: [authenticate, requireScopes(['execute'])],
  }, async (request, reply) => {
    const { projectId } = request.params;
    const orgId = getOrganizationId(request);

    const project = await getProject(projectId);
    if (!project || project.organization_id !== orgId) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    const config = await getDASTConfig(projectId);
    const targetUrl = request.body.targetUrl || config.targetUrl;
    const scanProfile = request.body.scanProfile || config.scanProfile;

    if (!targetUrl) {
      return reply.status(400).send({
        error: 'Target URL required',
        message: 'Please configure a target URL in DAST settings or provide one in the request.',
      });
    }

    try {
      new URL(targetUrl);
    } catch {
      return reply.status(400).send({
        error: 'Invalid URL',
        message: 'Please provide a valid target URL (e.g., https://example.com)',
      });
    }

    const scan = await simulateZAPScan(projectId, targetUrl, scanProfile, config.authConfig, config.contextConfig);

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
  app.get<{
    Params: { projectId: string; scanId: string };
  }>('/api/v1/projects/:projectId/dast/scans/:scanId', {
    preHandler: [authenticate, requireScopes(['read'])],
  }, async (request, reply) => {
    const { projectId, scanId } = request.params;
    const orgId = getOrganizationId(request);

    const project = await getProject(projectId);
    if (!project || project.organization_id !== orgId) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    const scans = await getDastScansByProject(projectId);
    const scan = scans.find(s => s.id === scanId);

    if (!scan) {
      return reply.status(404).send({ error: 'Scan not found' });
    }

    return reply.send({ scan });
  });

  // Get alerts from a specific scan
  app.get<{
    Params: { projectId: string; scanId: string };
    Querystring: { risk?: string; confidence?: string; includeFalsePositives?: string };
  }>('/api/v1/projects/:projectId/dast/scans/:scanId/alerts', {
    preHandler: [authenticate, requireScopes(['read'])],
  }, async (request, reply) => {
    const { projectId, scanId } = request.params;
    const { risk, confidence, includeFalsePositives = 'false' } = request.query;
    const orgId = getOrganizationId(request);

    const project = await getProject(projectId);
    if (!project || project.organization_id !== orgId) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    const scans = await getDastScansByProject(projectId);
    const scan = scans.find(s => s.id === scanId);

    if (!scan) {
      return reply.status(404).send({ error: 'Scan not found' });
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
  app.get<{
    Params: { projectId: string; scanId: string };
    Querystring: { format?: string };
  }>('/api/v1/projects/:projectId/dast/scans/:scanId/report', {
    preHandler: [authenticate, requireScopes(['read'])],
  }, async (request, reply) => {
    const { projectId, scanId } = request.params;
    const { format = 'html' } = request.query;
    const orgId = getOrganizationId(request);

    const project = await getProject(projectId);
    if (!project || project.organization_id !== orgId) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    const scans = await getDastScansByProject(projectId);
    const scan = scans.find(s => s.id === scanId);

    if (!scan) {
      return reply.status(404).send({ error: 'Scan not found' });
    }

    if (scan.status !== 'completed') {
      return reply.status(400).send({
        error: 'Scan not completed',
        message: 'Reports can only be generated for completed scans.',
      });
    }

    const validFormats: ReportFormat[] = ['pdf', 'html', 'json'];
    const reportFormat = format.toLowerCase() as ReportFormat;
    if (!validFormats.includes(reportFormat)) {
      return reply.status(400).send({
        error: 'Invalid format',
        message: `Supported formats: ${validFormats.join(', ')}`,
      });
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
  app.get('/api/v1/dast/report-formats', async (request, reply) => {
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
  app.post<{
    Params: { projectId: string; scanId: string; alertId: string };
    Body: { reason: string };
  }>('/api/v1/projects/:projectId/dast/scans/:scanId/alerts/:alertId/false-positive', {
    preHandler: [authenticate, requireScopes(['write'])],
  }, async (request, reply) => {
    const { projectId, scanId, alertId } = request.params;
    const { reason } = request.body;
    const user = request.user as JwtPayload;
    const orgId = getOrganizationId(request);

    const project = await getProject(projectId);
    if (!project || project.organization_id !== orgId) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    if (!reason || reason.trim().length < 10) {
      return reply.status(400).send({
        error: 'Reason required',
        message: 'Please provide a reason of at least 10 characters.',
      });
    }

    const scans = await getDastScansByProject(projectId);
    const scan = scans.find(s => s.id === scanId);

    if (!scan) {
      return reply.status(404).send({ error: 'Scan not found' });
    }

    const alert = scan.alerts.find(a => a.id === alertId);
    if (!alert) {
      return reply.status(404).send({ error: 'Alert not found' });
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
  app.get<{
    Params: { projectId: string };
  }>('/api/v1/projects/:projectId/dast/false-positives', {
    preHandler: [authenticate, requireScopes(['read'])],
  }, async (request, reply) => {
    const { projectId } = request.params;
    const orgId = getOrganizationId(request);

    const project = await getProject(projectId);
    if (!project || project.organization_id !== orgId) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    const fps = await getDastFalsePositives(projectId);

    return reply.send({
      falsePositives: fps,
      total: fps.length,
    });
  });

  // Remove a false positive
  app.delete<{
    Params: { projectId: string; falsePositiveId: string };
  }>('/api/v1/projects/:projectId/dast/false-positives/:falsePositiveId', {
    preHandler: [authenticate, requireScopes(['write'])],
  }, async (request, reply) => {
    const { projectId, falsePositiveId } = request.params;
    const orgId = getOrganizationId(request);

    const project = await getProject(projectId);
    if (!project || project.organization_id !== orgId) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    const fps = await getDastFalsePositives(projectId);
    const fp = fps.find(f => f.id === falsePositiveId);

    if (!fp) {
      return reply.status(404).send({ error: 'False positive record not found' });
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
  app.get<{
    Querystring: { days?: string };
  }>('/api/v1/organizations/current/dast/stats', {
    preHandler: [authenticate, requireScopes(['read'])],
  }, async (request, reply) => {
    const { days = '30' } = request.query;
    const orgId = getOrganizationId(request);
    const daysNum = parseInt(days) || 30;
    const cutoff = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000);

    const orgProjects = await listProjects(orgId);

    let totalScans = 0;
    let totalAlerts = 0;
    const alertsByRisk = { high: 0, medium: 0, low: 0, informational: 0 };
    const recentScans: DASTScanResult[] = [];

    for (const project of orgProjects) {
      const scans = await getDastScansByProject(project.id);

      for (const scan of scans) {
        if (new Date(scan.startedAt) >= cutoff) {
          totalScans++;
          if (scan.status === 'completed') {
            totalAlerts += scan.summary.total;
            alertsByRisk.high += scan.summary.byRisk.high;
            alertsByRisk.medium += scan.summary.byRisk.medium;
            alertsByRisk.low += scan.summary.byRisk.low;
            alertsByRisk.informational += scan.summary.byRisk.informational;
            recentScans.push(scan);
          }
        }
      }
    }

    recentScans.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

    return reply.send({
      period: { days: daysNum, start: cutoff.toISOString(), end: new Date().toISOString() },
      stats: {
        totalScans,
        totalAlerts,
        alertsByRisk,
        projectsWithDAST: (await Promise.all(orgProjects.map(async p => (await getDASTConfig(p.id)).enabled))).filter(Boolean).length,
        totalProjects: orgProjects.length,
      },
      recentScans: recentScans.slice(0, 5).map(s => ({
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
  app.post<{
    Params: { projectId: string };
    Body: { content: string; name?: string };
  }>('/api/v1/projects/:projectId/dast/openapi-spec', {
    preHandler: [authenticate, requireScopes(['write'])],
  }, async (request, reply) => {
    const { projectId } = request.params;
    const { content, name = 'API Specification' } = request.body;
    const user = request.user as JwtPayload;
    const orgId = getOrganizationId(request);

    const project = await getProject(projectId);
    if (!project || project.organization_id !== orgId) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    if (!content || typeof content !== 'string') {
      return reply.status(400).send({
        error: 'Invalid OpenAPI specification',
        message: 'Please provide the OpenAPI specification content as a JSON or YAML string.',
      });
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
      return reply.status(400).send({
        error: 'Invalid OpenAPI specification',
        message: error instanceof Error ? error.message : 'Failed to parse OpenAPI specification',
      });
    }
  });

  // Get OpenAPI specification for a project
  app.get<{
    Params: { projectId: string };
  }>('/api/v1/projects/:projectId/dast/openapi-spec', {
    preHandler: [authenticate, requireScopes(['read'])],
  }, async (request, reply) => {
    const { projectId } = request.params;
    const orgId = getOrganizationId(request);

    const project = await getProject(projectId);
    if (!project || project.organization_id !== orgId) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    const config = await getDASTConfig(projectId);
    if (!config.openApiSpecId) {
      return reply.status(404).send({
        error: 'No OpenAPI specification found',
        message: 'Upload an OpenAPI specification to enable API scanning.',
      });
    }

    const spec = await getOpenApiSpec(config.openApiSpecId);
    if (!spec) {
      return reply.status(404).send({ error: 'OpenAPI specification not found' });
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
  app.delete<{
    Params: { projectId: string };
  }>('/api/v1/projects/:projectId/dast/openapi-spec', {
    preHandler: [authenticate, requireScopes(['write'])],
  }, async (request, reply) => {
    const { projectId } = request.params;
    const orgId = getOrganizationId(request);

    const project = await getProject(projectId);
    if (!project || project.organization_id !== orgId) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    const config = await getDASTConfig(projectId);
    if (!config.openApiSpecId) {
      return reply.status(404).send({ error: 'No OpenAPI specification to delete' });
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
  app.get('/api/v1/dast/schedule-frequencies', async (request, reply) => {
    return reply.send({
      frequencies: Object.entries(SCHEDULE_FREQUENCIES).map(([id, info]) => ({
        id,
        ...info,
      })),
    });
  });

  // GraphQL scan routes
  app.post<{
    Body: GraphQLScanConfig;
  }>('/api/v1/dast/graphql/scan', {
    preHandler: [authenticate, requireScopes(['write'])],
  }, async (request, reply) => {
    const config = request.body;

    if (!config.endpoint) {
      return reply.status(400).send({ error: 'GraphQL endpoint URL is required' });
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
  app.get<{
    Params: { scanId: string };
  }>('/api/v1/dast/graphql/scan/:scanId', {
    preHandler: [authenticate, requireScopes(['read'])],
  }, async (request, reply) => {
    const { scanId } = request.params;
    const scan = await getGraphQLScan(scanId);

    if (!scan) {
      return reply.status(404).send({ error: 'GraphQL scan not found' });
    }

    return reply.send({ scan });
  });

  // List all GraphQL scans
  app.get<{
    Querystring: { limit?: string; status?: string };
  }>('/api/v1/dast/graphql/scans', {
    preHandler: [authenticate, requireScopes(['read'])],
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
  app.post<{
    Body: { endpoint: string; authHeader?: string };
  }>('/api/v1/dast/graphql/introspect', {
    preHandler: [authenticate, requireScopes(['read'])],
  }, async (request, reply) => {
    const { endpoint, authHeader } = request.body;

    if (!endpoint) {
      return reply.status(400).send({ error: 'GraphQL endpoint URL is required' });
    }

    try {
      const schema = performGraphQLIntrospection(endpoint, authHeader);
      return reply.send({ schema });
    } catch (error: any) {
      return reply.status(500).send({
        error: 'Failed to introspect GraphQL schema',
        details: error.message,
      });
    }
  });
}
