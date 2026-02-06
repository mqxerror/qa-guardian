/**
 * Reporting Tools Module
 *
 * Tools for generating, scheduling, and exporting reports.
 * Includes SLA reports, cost analytics, audit logs, and scheduled reporting.
 */

import { ToolDefinition } from '../types';

export const REPORTING_TOOLS: ToolDefinition[] = [
  // Feature #1435: Unified export_data tool replaces generate_report, export_analytics_csv, export_results, export_accessibility_report
  {
    name: 'export_data',
    description: 'Export data in various formats. Replaces generate_report, export_analytics_csv, export_results, and export_accessibility_report.',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['results', 'analytics', 'accessibility', 'security', 'report'],
          description: 'Type of data to export (required)',
        },
        format: {
          type: 'string',
          enum: ['json', 'csv', 'html', 'pdf', 'junit'],
          description: 'Export format (default: json)',
        },
        project_id: {
          type: 'string',
          description: 'Project ID to export data for',
        },
        run_id: {
          type: 'string',
          description: 'Run ID for results export',
        },
        start_date: {
          type: 'string',
          description: 'Start date for export period (ISO format)',
        },
        end_date: {
          type: 'string',
          description: 'End date for export period (ISO format)',
        },
        include_details: {
          type: 'boolean',
          description: 'Include detailed data (default: true)',
        },
      },
      required: ['type'],
    },
  },
  // Feature #1435: Removed generate_report, export_analytics_csv, schedule_report
  // Use export_data with type=report/analytics for report generation
  // Schedule reports via REST API for human oversight
  // Feature #1008: Get SLA report MCP tool
  {
    name: 'get_sla_report',
    description: 'Generate SLA compliance report showing uptime, response time metrics, and incident impact. Tracks adherence to service level agreements.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID to generate SLA report for (optional, defaults to all projects)',
        },
        period: {
          type: 'string',
          enum: ['7d', '30d', '90d', 'mtd', 'ytd'],
          description: 'Report period (default: 30d). mtd=month-to-date, ytd=year-to-date',
        },
        sla_targets: {
          type: 'object',
          properties: {
            uptime_percent: {
              type: 'number',
              description: 'Target uptime percentage (default: 99.9)',
            },
            response_time_ms: {
              type: 'number',
              description: 'Target response time in milliseconds (default: 200)',
            },
            p99_response_time_ms: {
              type: 'number',
              description: 'Target P99 response time in milliseconds (default: 500)',
            },
          },
          description: 'Custom SLA targets (optional)',
        },
        include_incidents: {
          type: 'boolean',
          description: 'Include incident impact analysis (default: true)',
        },
        include_breakdown: {
          type: 'boolean',
          description: 'Include daily/weekly breakdown (default: true)',
        },
      },
    },
  },
  // Feature #1435: Removed schedule_report - scheduling via REST API for human oversight
  // Feature #1011: Get audit log MCP tool
  {
    name: 'get_audit_log',
    description: 'Retrieve audit log entries for the organization. Supports filtering by action type, user, and date range.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['create', 'update', 'delete', 'run', 'login', 'logout', 'invite', 'remove', 'all'],
          description: 'Filter by action type (default: all)',
        },
        user_id: {
          type: 'string',
          description: 'Filter by user ID',
        },
        user_email: {
          type: 'string',
          description: 'Filter by user email',
        },
        resource_type: {
          type: 'string',
          enum: ['project', 'suite', 'test', 'run', 'user', 'organization', 'api_key', 'schedule', 'all'],
          description: 'Filter by resource type (default: all)',
        },
        start_date: {
          type: 'string',
          description: 'Start date for log entries (ISO format)',
        },
        end_date: {
          type: 'string',
          description: 'End date for log entries (ISO format)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of entries to return (default: 100, max: 1000)',
        },
        offset: {
          type: 'number',
          description: 'Number of entries to skip for pagination (default: 0)',
        },
      },
    },
  },
  // Feature #1012: Get usage statistics MCP tool
  {
    name: 'get_usage_statistics',
    description: 'Get platform usage statistics including API calls, storage usage, execution minutes, and resource consumption.',
    inputSchema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['today', '7d', '30d', '90d', 'mtd', 'ytd'],
          description: 'Time period for statistics (default: 30d)',
        },
        include_breakdown: {
          type: 'boolean',
          description: 'Include detailed breakdown by category (default: true)',
        },
        include_trends: {
          type: 'boolean',
          description: 'Include usage trends over time (default: true)',
        },
        include_quotas: {
          type: 'boolean',
          description: 'Include quota/limit information (default: true)',
        },
      },
    },
  },
  // Feature #1222: MCP tool generate-executive-report - Generate executive summary report
  {
    name: 'generate_executive_report',
    description: 'Generate an executive summary report for stakeholders. Includes high-level metrics, trends, quality scores, and strategic recommendations in PDF or HTML format.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID to generate report for (required)',
        },
        date_range: {
          type: 'object',
          properties: {
            start: { type: 'string', description: 'Start date (ISO format)' },
            end: { type: 'string', description: 'End date (ISO format)' },
            preset: {
              type: 'string',
              enum: ['last_7_days', 'last_30_days', 'last_90_days', 'this_month', 'last_month', 'this_quarter'],
              description: 'Use a preset date range instead of start/end',
            },
          },
          description: 'Date range for the report (default: last 30 days)',
        },
        format: {
          type: 'string',
          enum: ['pdf', 'html', 'json'],
          description: 'Output format (default: pdf)',
        },
        include_sections: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['summary', 'key_metrics', 'trends', 'quality_score', 'risk_assessment', 'recommendations', 'team_performance', 'release_readiness'],
          },
          description: 'Sections to include (default: all)',
        },
        comparison_period: {
          type: 'boolean',
          description: 'Include comparison with previous period (default: true)',
        },
      },
      required: ['project_id'],
    },
  },
  // Feature #1223: MCP tool generate-compliance-report - Generate compliance/audit report
  {
    name: 'generate_compliance_report',
    description: 'Generate a compliance and audit report for regulatory frameworks. Includes test evidence, coverage metrics, and compliance status for SOC2, ISO27001, HIPAA, GDPR, and other frameworks.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID to generate report for (required)',
        },
        framework: {
          type: 'string',
          enum: ['soc2', 'iso27001', 'hipaa', 'gdpr', 'pci_dss', 'nist', 'custom'],
          description: 'Compliance framework to report against (required)',
        },
        audit_period: {
          type: 'object',
          properties: {
            start: { type: 'string', description: 'Audit period start date (ISO format)' },
            end: { type: 'string', description: 'Audit period end date (ISO format)' },
          },
          description: 'Audit period (default: last 90 days)',
        },
        format: {
          type: 'string',
          enum: ['pdf', 'html', 'json', 'csv'],
          description: 'Output format (default: pdf)',
        },
        include_evidence: {
          type: 'boolean',
          description: 'Include detailed test evidence and screenshots (default: true)',
        },
        include_coverage: {
          type: 'boolean',
          description: 'Include test coverage metrics (default: true)',
        },
      },
      required: ['project_id', 'framework'],
    },
  },
  // Feature #1732: Generate comprehensive report combining all test types
  {
    name: 'generate_comprehensive_report',
    description: 'Generate a unified report combining E2E, Visual, Accessibility, Performance, Load, and Security test results. Returns a viewable report URL with drill-down sections for each test type.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID to generate report for (required)',
        },
        title: {
          type: 'string',
          description: 'Custom title for the report (optional)',
        },
        description: {
          type: 'string',
          description: 'Description or notes for the report (optional)',
        },
        period: {
          type: 'object',
          properties: {
            start: { type: 'string', description: 'Start date (ISO format)' },
            end: { type: 'string', description: 'End date (ISO format)' },
          },
          description: 'Time period for the report (default: last 7 days)',
        },
        include_sections: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['e2e', 'visual', 'accessibility', 'performance', 'load', 'security'],
          },
          description: 'Which test type sections to include (default: all)',
        },
        format: {
          type: 'string',
          enum: ['html', 'json', 'pdf'],
          description: 'Output format (default: html)',
        },
      },
      required: ['project_id'],
    },
  },
  // Feature #1224: MCP tool get-trend-analysis - Get AI analysis of trends over time
  {
    name: 'get_trend_analysis',
    description: 'Get AI-powered analysis of test metrics trends over time. Includes trend data, pattern interpretation, anomaly detection, and predictions.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID to analyze (required)',
        },
        metrics: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['pass_rate', 'test_count', 'duration', 'flakiness', 'failures', 'coverage'],
          },
          description: 'Metrics to analyze (default: all)',
        },
        time_range: {
          type: 'object',
          properties: {
            start: { type: 'string', description: 'Start date (ISO format)' },
            end: { type: 'string', description: 'End date (ISO format)' },
            preset: {
              type: 'string',
              enum: ['last_7_days', 'last_30_days', 'last_90_days', 'last_180_days', 'last_year'],
              description: 'Use a preset time range',
            },
          },
          description: 'Time range for analysis (default: last 30 days)',
        },
        granularity: {
          type: 'string',
          enum: ['hourly', 'daily', 'weekly', 'monthly'],
          description: 'Data point granularity (default: daily)',
        },
        include_predictions: {
          type: 'boolean',
          description: 'Include AI predictions for future trends (default: true)',
        },
        include_anomalies: {
          type: 'boolean',
          description: 'Detect and highlight anomalies (default: true)',
        },
      },
      required: ['project_id'],
    },
  },
];

export const REPORTING_TOOL_NAMES = REPORTING_TOOLS.map(t => t.name);
