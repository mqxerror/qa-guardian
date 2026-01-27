/**
 * Reports API Routes
 * Feature #1732: Comprehensive report generation and viewing
 */

import { FastifyInstance, FastifyRequest } from 'fastify';
import { getReport, listReports, deleteReport } from './stores';
import { generateReport } from './generator';
import { GenerateReportRequest } from './types';

export async function reportsRoutes(fastify: FastifyInstance) {
  // Generate a new comprehensive report
  fastify.post<{
    Body: GenerateReportRequest;
  }>('/api/v1/reports/generate', {
    preHandler: async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.status(401).send({ error: 'Unauthorized' });
      }
    },
  }, async (request, reply) => {
    const user = request.user as { email?: string; id?: string } | undefined;
    const createdBy = user?.email || user?.id || 'unknown';

    // Get the base URL for the viewUrl
    const protocol = request.headers['x-forwarded-proto'] || 'http';
    const host = request.headers['x-forwarded-host'] || request.headers.host || 'localhost:5173';
    const baseUrl = `${protocol}://${host}`;

    try {
      const report = await generateReport(request.body, createdBy, baseUrl);

      return reply.send({
        success: true,
        report: {
          id: report.id,
          title: report.title,
          overallScore: report.executiveSummary.overallScore,
          overallStatus: report.executiveSummary.overallStatus,
          viewUrl: report.viewUrl,
          createdAt: report.createdAt,
        },
        message: `Report generated successfully. View at: ${report.viewUrl}`,
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Failed to generate report',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get a specific report by ID
  fastify.get<{
    Params: { reportId: string };
  }>('/api/v1/reports/:reportId', {
    preHandler: async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.status(401).send({ error: 'Unauthorized' });
      }
    },
  }, async (request, reply) => {
    const { reportId } = request.params;
    const report = await getReport(reportId);

    if (!report) {
      return reply.status(404).send({
        error: 'Report not found',
        message: `No report found with ID: ${reportId}`,
      });
    }

    return reply.send({ report });
  });

  // List all reports (optionally filtered by project)
  fastify.get<{
    Querystring: { project_id?: string };
  }>('/api/v1/reports', {
    preHandler: async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.status(401).send({ error: 'Unauthorized' });
      }
    },
  }, async (request, reply) => {
    const { project_id } = request.query;
    const reports = await listReports(project_id);

    return reply.send({
      reports,
      count: reports.length,
    });
  });

  // Delete a report
  fastify.delete<{
    Params: { reportId: string };
  }>('/api/v1/reports/:reportId', {
    preHandler: async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.status(401).send({ error: 'Unauthorized' });
      }
    },
  }, async (request, reply) => {
    const { reportId } = request.params;
    const deleted = await deleteReport(reportId);

    if (!deleted) {
      return reply.status(404).send({
        error: 'Report not found',
        message: `No report found with ID: ${reportId}`,
      });
    }

    return reply.send({
      success: true,
      message: 'Report deleted successfully',
    });
  });
}

export default reportsRoutes;
