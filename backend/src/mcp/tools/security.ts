/**
 * Security Scanning Tools
 *
 * MCP tools for security scanning (SAST, DAST, dependency scanning, secrets detection).
 */

import { ToolDefinition } from '../types';

export const SECURITY_TOOLS: ToolDefinition[] = [
  {
    name: 'run_security_scan',
    description: 'Trigger a security scan (SAST/DAST) for a project',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The ID of the project to scan',
        },
        scan_type: {
          type: 'string',
          enum: ['sast', 'dast', 'dependency', 'secrets', 'full'],
          description: 'Type of security scan to run (default: full)',
          default: 'full',
        },
        target_url: {
          type: 'string',
          description: 'Target URL for DAST scans',
        },
        branch: {
          type: 'string',
          description: 'Git branch to scan (for SAST)',
        },
      },
      required: ['project_id'],
    },
  },
  // Feature #1430: Unified get_security_findings tool replaces get_security_scan_status, get_vulnerabilities, get_vulnerability_details
  {
    name: 'get_security_findings',
    description: 'Get security findings from scans. Can return scan status, list vulnerabilities, or get details for a specific vulnerability.',
    inputSchema: {
      type: 'object',
      properties: {
        scan_id: {
          type: 'string',
          description: 'Security scan ID - for scan status or findings from a specific scan',
        },
        vulnerability_id: {
          type: 'string',
          description: 'Specific vulnerability ID - returns detailed info including remediation steps',
        },
        project_id: {
          type: 'string',
          description: 'Filter vulnerabilities by project ID',
        },
        severity: {
          type: 'string',
          enum: ['critical', 'high', 'medium', 'low', 'info', 'all'],
          description: 'Filter by severity level (default: all)',
        },
        scan_type: {
          type: 'string',
          enum: ['sast', 'dast', 'dependency', 'secrets', 'all'],
          description: 'Filter by scan type (default: all)',
        },
        status: {
          type: 'string',
          enum: ['open', 'resolved', 'false_positive', 'accepted', 'all'],
          description: 'Filter by status (default: open)',
        },
        include: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['scan_status', 'vulnerabilities', 'trends', 'remediation'],
          },
          description: 'Data to include: scan_status, vulnerabilities, trends, remediation (default: scan_status + vulnerabilities)',
        },
        limit: {
          type: 'number',
          description: 'Maximum vulnerabilities to return (default: 50)',
        },
      },
    },
  },
  // Feature #1430: Removed get_security_scan_status, get_vulnerabilities, get_vulnerability_details - use get_security_findings
  {
    name: 'dismiss_vulnerability',
    description: 'Dismiss a vulnerability as a false positive or accepted risk. The dismissal is persisted and the vulnerability will be excluded from future reports.',
    inputSchema: {
      type: 'object',
      properties: {
        vulnerability_id: {
          type: 'string',
          description: 'The ID of the vulnerability to dismiss',
        },
        reason: {
          type: 'string',
          enum: ['false_positive', 'accepted_risk', 'not_applicable', 'will_not_fix', 'mitigated'],
          description: 'The reason for dismissing the vulnerability',
        },
        comment: {
          type: 'string',
          description: 'Additional context or justification for the dismissal',
        },
        expires_at: {
          type: 'string',
          description: 'Optional ISO date when the dismissal expires and vulnerability should be re-evaluated (format: YYYY-MM-DD)',
        },
      },
      required: ['vulnerability_id', 'reason'],
    },
  },
  {
    name: 'get_dependency_audit',
    description: 'Get dependency vulnerability audit report for a project',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The ID of the project',
        },
        include_dev: {
          type: 'boolean',
          description: 'Include dev dependencies (default: true)',
          default: true,
        },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'get_security_trends',
    description: 'Get security metrics and trends over time',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'Filter by project ID',
        },
        period: {
          type: 'string',
          enum: ['7d', '30d', '90d', '1y'],
          description: 'Time period for trends (default: 30d)',
          default: '30d',
        },
        metric: {
          type: 'string',
          enum: ['vulnerabilities', 'scan_coverage', 'fix_rate', 'mttr'],
          description: 'Specific metric to retrieve',
        },
      },
    },
  },
  {
    name: 'get_security_score',
    description: 'Get overall security health score for a project (0-100)',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID to get the security score for',
        },
        include_history: {
          type: 'boolean',
          description: 'Include historical scores (default: false)',
          default: false,
        },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'get_exposed_secrets',
    description: 'Get list of detected exposed secrets in the codebase',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID to scan for exposed secrets',
        },
        scan_id: {
          type: 'string',
          description: 'Optional specific scan ID to get secrets from',
        },
        severity: {
          type: 'string',
          enum: ['critical', 'high', 'medium', 'low'],
          description: 'Filter by severity level',
        },
        secret_type: {
          type: 'string',
          description: 'Filter by secret type (e.g., api_key, password, token)',
        },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'verify_secret_status',
    description: 'Check if a detected secret is still active or has been revoked',
    inputSchema: {
      type: 'object',
      properties: {
        secret_id: {
          type: 'string',
          description: 'The ID of the secret to verify',
        },
        force_recheck: {
          type: 'boolean',
          description: 'Force a fresh verification check (bypass cache)',
          default: false,
        },
      },
      required: ['secret_id'],
    },
  },
  {
    name: 'generate_sbom',
    description: 'Generate a Software Bill of Materials (SBOM) for a project',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID to generate SBOM for',
        },
        format: {
          type: 'string',
          enum: ['cyclonedx', 'spdx'],
          description: 'SBOM format (default: cyclonedx)',
          default: 'cyclonedx',
        },
        include_dev_dependencies: {
          type: 'boolean',
          description: 'Include development dependencies (default: false)',
          default: false,
        },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'run_dast_scan',
    description: 'Trigger a DAST (Dynamic Application Security Testing) scan on a running application',
    inputSchema: {
      type: 'object',
      properties: {
        target_url: {
          type: 'string',
          description: 'The target URL of the running application to scan',
        },
        scan_type: {
          type: 'string',
          enum: ['baseline', 'full', 'api', 'ajax'],
          description: 'Type of scan to run: baseline (quick passive), full (comprehensive), api (API-focused), ajax (Ajax spider)',
          default: 'baseline',
        },
        project_id: {
          type: 'string',
          description: 'Project ID to associate the scan results with',
        },
        auth_config: {
          type: 'object',
          description: 'Authentication configuration for scanning protected endpoints',
        },
        scan_options: {
          type: 'object',
          description: 'Additional scan options',
        },
      },
      required: ['target_url'],
    },
  },
  {
    name: 'get_dast_findings',
    description: 'Get DAST scan findings with evidence and remediation guidance',
    inputSchema: {
      type: 'object',
      properties: {
        scan_id: {
          type: 'string',
          description: 'The DAST scan ID to get findings for',
        },
        severity: {
          type: 'string',
          enum: ['critical', 'high', 'medium', 'low', 'info'],
          description: 'Filter findings by severity',
        },
        category: {
          type: 'string',
          description: 'Filter findings by category (e.g., injection, xss, authentication)',
        },
        include_evidence: {
          type: 'boolean',
          description: 'Include detailed evidence for each finding (default: true)',
          default: true,
        },
        include_remediation: {
          type: 'boolean',
          description: 'Include remediation guidance for each finding (default: true)',
          default: true,
        },
        limit: {
          type: 'number',
          description: 'Maximum number of findings to return',
          default: 50,
        },
        offset: {
          type: 'number',
          description: 'Number of findings to skip (for pagination)',
          default: 0,
        },
      },
      required: ['scan_id'],
    },
  },
  {
    name: 'generate_security_report',
    description: 'Generate a comprehensive security report for a project including all scan types',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID to generate the report for',
        },
        format: {
          type: 'string',
          enum: ['pdf', 'html', 'json', 'markdown'],
          description: 'Report output format (default: pdf)',
          default: 'pdf',
        },
        include_sections: {
          type: 'array',
          items: { type: 'string' },
          description: 'Report sections to include: vulnerabilities, dependencies, secrets, dast, compliance, sbom',
        },
        time_range: {
          type: 'string',
          enum: ['24h', '7d', '30d', '90d', 'all'],
          description: 'Time range for scan data to include',
          default: '30d',
        },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'configure_security_policy',
    description: 'Configure security policy settings for a project',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID to configure',
        },
        policy: {
          type: 'object',
          description: 'Security policy configuration',
        },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'get_container_vulnerabilities',
    description: 'Get vulnerabilities found in container images',
    inputSchema: {
      type: 'object',
      properties: {
        image_id: {
          type: 'string',
          description: 'The container image ID to check',
        },
        project_id: {
          type: 'string',
          description: 'Filter by project ID',
        },
        severity: {
          type: 'string',
          enum: ['critical', 'high', 'medium', 'low'],
          description: 'Filter by severity',
        },
      },
    },
  },
  {
    name: 'compare_security_scans',
    description: 'Compare two security scans to identify new and fixed vulnerabilities',
    inputSchema: {
      type: 'object',
      properties: {
        base_scan_id: {
          type: 'string',
          description: 'The base scan ID to compare from',
        },
        compare_scan_id: {
          type: 'string',
          description: 'The scan ID to compare against',
        },
      },
      required: ['base_scan_id', 'compare_scan_id'],
    },
  },
  {
    name: 'schedule_security_scan',
    description: 'Schedule recurring security scans for a project',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID to schedule scans for',
        },
        schedule: {
          type: 'string',
          description: 'Cron expression for the schedule',
        },
        scan_types: {
          type: 'array',
          items: { type: 'string' },
          description: 'Types of scans to run',
        },
        enabled: {
          type: 'boolean',
          description: 'Whether the schedule is enabled',
          default: true,
        },
      },
      required: ['project_id', 'schedule'],
    },
  },
  {
    name: 'get_fix_suggestions',
    description: 'Get AI-powered fix suggestions for a vulnerability',
    inputSchema: {
      type: 'object',
      properties: {
        vulnerability_id: {
          type: 'string',
          description: 'The vulnerability ID to get fix suggestions for',
        },
        include_code_snippets: {
          type: 'boolean',
          description: 'Include code snippets in suggestions (default: true)',
          default: true,
        },
      },
      required: ['vulnerability_id'],
    },
  },
];

// List of security tool names for handler mapping
export const SECURITY_TOOL_NAMES = SECURITY_TOOLS.map(t => t.name);
