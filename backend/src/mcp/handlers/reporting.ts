/**
 * Reporting Tool Handlers
 * Feature #1732: MCP handlers for report generation
 */

import { ToolHandler, HandlerModule } from './types';

/**
 * Generate comprehensive report combining all test types (Feature #1732)
 */
export const generateComprehensiveReport: ToolHandler = async (args, context) => {
  const projectId = args.project_id as string;

  if (!projectId) {
    return { error: 'project_id is required' };
  }

  const requestBody = {
    projectId,
    title: args.title as string | undefined,
    description: args.description as string | undefined,
    period: args.period as { start?: string; end?: string } | undefined,
    includeSections: args.include_sections as string[] | undefined,
    format: args.format as string | undefined,
  };

  const response = await context.callApi('/api/v1/reports/generate', {
    method: 'POST',
    body: requestBody,
  }) as {
    success: boolean;
    report?: {
      id: string;
      title: string;
      overallScore: number;
      overallStatus: string;
      viewUrl: string;
      createdAt: string;
    };
    message?: string;
    error?: string;
  };

  if (!response.success || !response.report) {
    return {
      error: response.error || 'Failed to generate report',
      message: response.message,
    };
  }

  return {
    success: true,
    report_id: response.report.id,
    title: response.report.title,
    overall_score: response.report.overallScore,
    overall_status: response.report.overallStatus,
    view_url: response.report.viewUrl,
    created_at: response.report.createdAt,
    message: `Report generated successfully! View at: ${response.report.viewUrl}`,
  };
};

/**
 * Get a specific report by ID
 */
export const getReport: ToolHandler = async (args, context) => {
  const reportId = args.report_id as string;

  if (!reportId) {
    return { error: 'report_id is required' };
  }

  return await context.callApi(`/api/v1/reports/${reportId}`);
};

/**
 * List reports for a project
 */
export const listReports: ToolHandler = async (args, context) => {
  const projectId = args.project_id as string | undefined;
  const queryString = projectId ? `?project_id=${projectId}` : '';

  return await context.callApi(`/api/v1/reports${queryString}`);
};

// Handler registry for reporting tools
export const handlers: Record<string, ToolHandler> = {
  generate_comprehensive_report: generateComprehensiveReport,
  get_report: getReport,
  list_reports: listReports,
};

// List of tool names this module handles
export const toolNames = Object.keys(handlers);

// Export as a handler module
export const reportingHandlers: HandlerModule = {
  handlers,
  toolNames,
};

export default reportingHandlers;
