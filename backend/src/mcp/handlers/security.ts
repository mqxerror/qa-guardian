/**
 * Security Tool Handlers
 *
 * Handlers for security scanning and vulnerability management MCP tools.
 * Extracted from server.ts to reduce file size (Feature #1356).
 */

import { ToolHandler, HandlerModule } from './types';

/**
 * Run a security scan (MCP v2.0)
 */
export const runSecurityScan: ToolHandler = async (args, context) => {
  const scanParams: Record<string, unknown> = {
    scan_type: args.scan_type || 'full',
  };
  if (args.target_url) scanParams.target_url = args.target_url;
  if (args.branch) scanParams.branch = args.branch;
  return await context.callApi(`/api/v1/security/scans/project/${args.project_id}`, {
    method: 'POST',
    body: scanParams,
  });
};

/**
 * Get security findings (Feature #1430)
 * Replaces get_security_scan_status, get_vulnerabilities, get_vulnerability_details
 */
export const getSecurityFindings: ToolHandler = async (args, context) => {
  const scanId = args.scan_id as string | undefined;
  const vulnerabilityId = args.vulnerability_id as string | undefined;
  const projectId = args.project_id as string | undefined;
  const severity = args.severity as string | undefined;
  const scanType = args.scan_type as string | undefined;
  const status = (args.status as string) || 'open';
  const includeData = (args.include as string[]) || ['scan_status', 'vulnerabilities'];
  const limit = (args.limit as number) || 50;

  // If vulnerability_id is provided, return detailed vulnerability info
  if (vulnerabilityId) {
    const scanIdParam = scanId ? `?scan_id=${encodeURIComponent(scanId)}` : '';
    return await context.callApi(`/api/v1/security/vulnerabilities/${encodeURIComponent(vulnerabilityId)}${scanIdParam}`);
  }

  const response: Record<string, unknown> = {};

  // Get scan status if scan_id provided
  if (scanId && includeData.includes('scan_status')) {
    response.scan_status = await context.callApi(`/api/v1/security/scans/${scanId}`);
  }

  // Get vulnerabilities
  if (includeData.includes('vulnerabilities')) {
    const vulnParams = new URLSearchParams();
    if (projectId) vulnParams.append('project_id', projectId);
    if (scanId) vulnParams.append('scan_id', scanId);
    if (severity && severity !== 'all') vulnParams.append('severity', severity);
    if (scanType && scanType !== 'all') vulnParams.append('scan_type', scanType);
    if (status && status !== 'all') vulnParams.append('status', status);
    vulnParams.append('limit', String(limit));
    const vulnQuery = vulnParams.toString();
    response.vulnerabilities = await context.callApi(`/api/v1/security/vulnerabilities${vulnQuery ? '?' + vulnQuery : ''}`);
  }

  // Get security trends
  if (includeData.includes('trends') && projectId) {
    response.trends = await context.callApi(`/api/v1/security/trends/${projectId}`);
  }

  return response;
};

/**
 * Dismiss vulnerability (Feature #923)
 */
export const dismissVulnerability: ToolHandler = async (args, context) => {
  const dismissVulnId = args.vulnerability_id as string;
  const dismissReason = args.reason as string;
  if (!dismissVulnId) {
    return { error: 'vulnerability_id is required' };
  }
  if (!dismissReason) {
    return { error: 'reason is required' };
  }
  const validReasons = ['false_positive', 'accepted_risk', 'not_applicable', 'will_not_fix', 'mitigated'];
  if (!validReasons.includes(dismissReason)) {
    return { error: `Invalid reason. Must be one of: ${validReasons.join(', ')}` };
  }
  return await context.callApi(`/api/v1/security/vulnerabilities/${encodeURIComponent(dismissVulnId)}/dismiss`, {
    method: 'POST',
    body: {
      reason: dismissReason,
      comment: args.comment || undefined,
      expires_at: args.expires_at || undefined,
    },
  });
};

/**
 * Get dependency audit
 */
export const getDependencyAudit: ToolHandler = async (args, context) => {
  return await context.callApi(
    `/api/v1/security/dependencies/${args.project_id}?include_dev=${args.include_dev !== false}`
  );
};

/**
 * Get security trends
 */
export const getSecurityTrends: ToolHandler = async (args, context) => {
  const trendParams = new URLSearchParams();
  if (args.project_id) trendParams.append('project_id', args.project_id as string);
  if (args.period) trendParams.append('period', args.period as string);
  if (args.metric) trendParams.append('metric', args.metric as string);
  const trendQuery = trendParams.toString();
  return await context.callApi(`/api/v1/security/trends${trendQuery ? '?' + trendQuery : ''}`);
};

/**
 * Get security score (Feature #926)
 */
export const getSecurityScore: ToolHandler = async (args, context) => {
  const projectIdForScore = args.project_id as string;
  if (!projectIdForScore) {
    return { error: 'project_id is required' };
  }
  const includeHistory = args.include_history === true ? 'true' : 'false';
  return await context.callApi(`/api/v1/security/score/${encodeURIComponent(projectIdForScore)}?include_history=${includeHistory}`);
};

/**
 * Get exposed secrets (Feature #927)
 */
export const getExposedSecrets: ToolHandler = async (args, context) => {
  const projectIdForSecrets = args.project_id as string;
  if (!projectIdForSecrets) {
    return { error: 'project_id is required' };
  }
  const secretParams = new URLSearchParams();
  if (args.scan_id) secretParams.append('scan_id', args.scan_id as string);
  if (args.severity) secretParams.append('severity', args.severity as string);
  if (args.secret_type) secretParams.append('secret_type', args.secret_type as string);
  const secretQuery = secretParams.toString();
  return await context.callApi(`/api/v1/security/secrets/${encodeURIComponent(projectIdForSecrets)}${secretQuery ? '?' + secretQuery : ''}`);
};

/**
 * Verify secret status (Feature #928)
 */
export const verifySecretStatus: ToolHandler = async (args, context) => {
  const secretIdToVerify = args.secret_id as string;
  if (!secretIdToVerify) {
    return { error: 'secret_id is required' };
  }
  const forceRecheck = args.force_recheck === true ? 'true' : 'false';
  return await context.callApi(`/api/v1/security/secrets/${encodeURIComponent(secretIdToVerify)}/verify?force_recheck=${forceRecheck}`, {
    method: 'POST',
    body: {},
  });
};

/**
 * Generate SBOM (Feature #929)
 */
export const generateSbom: ToolHandler = async (args, context) => {
  const projectIdForSbom = args.project_id as string;
  if (!projectIdForSbom) {
    return { error: 'project_id is required' };
  }
  const sbomFormat = (args.format as string) || 'cyclonedx';
  const includeDevDeps = args.include_dev_dependencies === true ? 'true' : 'false';
  return await context.callApi(`/api/v1/security/sbom/${encodeURIComponent(projectIdForSbom)}?format=${sbomFormat}&include_dev=${includeDevDeps}`, {
    method: 'POST',
    body: {},
  });
};

/**
 * Run DAST scan (Feature #931)
 */
export const runDastScan: ToolHandler = async (args, context) => {
  const targetUrl = args.target_url as string;
  if (!targetUrl) {
    return { error: 'target_url is required' };
  }
  const scanBody: Record<string, unknown> = {
    target_url: targetUrl,
    scan_type: args.scan_type || 'baseline',
  };
  if (args.project_id) scanBody.project_id = args.project_id;
  if (args.auth_config) scanBody.auth_config = args.auth_config;
  if (args.scan_options) scanBody.scan_options = args.scan_options;
  return await context.callApi('/api/v1/security/dast/scan', {
    method: 'POST',
    body: scanBody,
  });
};

/**
 * Get DAST findings (Feature #932)
 */
export const getDastFindings: ToolHandler = async (args, context) => {
  const dastScanId = args.scan_id as string;
  if (!dastScanId) {
    return { error: 'scan_id is required' };
  }
  const findingsParams = new URLSearchParams();
  if (args.severity) findingsParams.append('severity', args.severity as string);
  if (args.category) findingsParams.append('category', args.category as string);
  if (args.include_evidence !== undefined) findingsParams.append('include_evidence', String(args.include_evidence !== false));
  if (args.include_remediation !== undefined) findingsParams.append('include_remediation', String(args.include_remediation !== false));
  if (args.limit) findingsParams.append('limit', String(args.limit));
  if (args.offset) findingsParams.append('offset', String(args.offset));
  const findingsQuery = findingsParams.toString();
  return await context.callApi(`/api/v1/security/dast/scan/${encodeURIComponent(dastScanId)}/findings${findingsQuery ? '?' + findingsQuery : ''}`);
};

/**
 * Generate security report (Feature #933)
 */
export const generateSecurityReport: ToolHandler = async (args, context) => {
  const reportProjectId = args.project_id as string;
  if (!reportProjectId) {
    return { error: 'project_id is required' };
  }
  const reportBody: Record<string, unknown> = {
    format: args.format || 'pdf',
  };
  if (args.include_sections) reportBody.include_sections = args.include_sections;
  if (args.time_range) reportBody.time_range = args.time_range;
  if (args.severity_threshold) reportBody.severity_threshold = args.severity_threshold;
  if (args.executive_summary !== undefined) reportBody.executive_summary = args.executive_summary;
  return await context.callApi(`/api/v1/security/report/${encodeURIComponent(reportProjectId)}`, {
    method: 'POST',
    body: reportBody,
  });
};

/**
 * Configure security policy (Feature #934)
 */
export const configureSecurityPolicy: ToolHandler = async (args, context) => {
  const policyProjectId = args.project_id as string;
  if (!policyProjectId) {
    return { error: 'project_id is required' };
  }
  const policyBody: Record<string, unknown> = {};
  if (args.severity_threshold) policyBody.severity_threshold = args.severity_threshold;
  if (args.blocked_licenses) policyBody.blocked_licenses = args.blocked_licenses;
  if (args.approved_licenses) policyBody.approved_licenses = args.approved_licenses;
  if (args.require_license_review !== undefined) policyBody.require_license_review = args.require_license_review;
  if (args.secret_detection) policyBody.secret_detection = args.secret_detection;
  if (args.dast_policy) policyBody.dast_policy = args.dast_policy;
  if (args.sbom_policy) policyBody.sbom_policy = args.sbom_policy;
  return await context.callApi(`/api/v1/security/policy/${encodeURIComponent(policyProjectId)}`, {
    method: 'PUT',
    body: policyBody,
  });
};

/**
 * Get container vulnerabilities (Feature #935)
 */
export const getContainerVulnerabilities: ToolHandler = async (args, context) => {
  const containerImage = args.image as string;
  if (!containerImage) {
    return { error: 'image is required' };
  }
  const containerParams = new URLSearchParams();
  containerParams.append('image', containerImage);
  if (args.project_id) containerParams.append('project_id', args.project_id as string);
  if (args.severity_filter) containerParams.append('severity', args.severity_filter as string);
  if (args.include_layer_analysis !== undefined) containerParams.append('include_layers', String(args.include_layer_analysis !== false));
  if (args.include_base_image !== undefined) containerParams.append('include_base', String(args.include_base_image !== false));
  return await context.callApi(`/api/v1/security/container/scan?${containerParams.toString()}`, {
    method: 'POST',
    body: {},
  });
};

/**
 * Compare security scans (Feature #936)
 */
export const compareSecurityScans: ToolHandler = async (args, context) => {
  const baselineScanId = args.baseline_scan_id as string;
  const currentScanId = args.current_scan_id as string;
  if (!baselineScanId || !currentScanId) {
    return { error: 'baseline_scan_id and current_scan_id are required' };
  }
  const compareParams = new URLSearchParams();
  compareParams.append('baseline', baselineScanId);
  compareParams.append('current', currentScanId);
  if (args.include_details !== undefined) compareParams.append('include_details', String(args.include_details !== false));
  if (args.severity_filter) compareParams.append('severity', args.severity_filter as string);
  return await context.callApi(`/api/v1/security/scans/compare?${compareParams.toString()}`);
};

/**
 * Schedule security scan (Feature #937)
 */
export const scheduleSecurityScan: ToolHandler = async (args, context) => {
  const projectId = args.project_id as string;
  const scanType = args.scan_type as string;
  const frequency = args.frequency as string;
  if (!projectId || !scanType || !frequency) {
    return { error: 'project_id, scan_type, and frequency are required' };
  }
  const scheduleBody: Record<string, unknown> = {
    project_id: projectId,
    scan_type: scanType,
    frequency: frequency,
  };
  if (args.day_of_week !== undefined) scheduleBody.day_of_week = args.day_of_week;
  if (args.time_of_day) scheduleBody.time_of_day = args.time_of_day;
  if (args.target_url) scheduleBody.target_url = args.target_url;
  if (args.image) scheduleBody.image = args.image;
  if (args.notify_on_failure !== undefined) scheduleBody.notify_on_failure = args.notify_on_failure;
  if (args.notify_on_vulnerabilities !== undefined) scheduleBody.notify_on_vulnerabilities = args.notify_on_vulnerabilities;
  if (args.severity_threshold) scheduleBody.severity_threshold = args.severity_threshold;
  return await context.callApi('/api/v1/security/scan-schedules', {
    method: 'POST',
    body: scheduleBody,
  });
};

/**
 * Get fix suggestions (Feature #938)
 */
export const getFixSuggestions: ToolHandler = async (args, context) => {
  const vulnId = args.vulnerability_id as string;
  if (!vulnId) {
    return { error: 'vulnerability_id is required' };
  }
  const fixParams = new URLSearchParams();
  if (args.package_name) fixParams.append('package', args.package_name as string);
  if (args.current_version) fixParams.append('version', args.current_version as string);
  if (args.ecosystem) fixParams.append('ecosystem', args.ecosystem as string);
  if (args.include_breaking_changes !== undefined) fixParams.append('breaking_changes', String(args.include_breaking_changes !== false));
  if (args.include_code_examples !== undefined) fixParams.append('code_examples', String(args.include_code_examples !== false));
  if (args.max_suggestions) fixParams.append('max_suggestions', String(args.max_suggestions));
  const query = fixParams.toString();
  return await context.callApi(`/api/v1/security/vulnerabilities/${vulnId}/fix-suggestions${query ? '?' + query : ''}`);
};

// Handler registry for security tools
export const handlers: Record<string, ToolHandler> = {
  run_security_scan: runSecurityScan,
  get_security_findings: getSecurityFindings,
  dismiss_vulnerability: dismissVulnerability,
  get_dependency_audit: getDependencyAudit,
  get_security_trends: getSecurityTrends,
  get_security_score: getSecurityScore,
  get_exposed_secrets: getExposedSecrets,
  verify_secret_status: verifySecretStatus,
  generate_sbom: generateSbom,
  run_dast_scan: runDastScan,
  get_dast_findings: getDastFindings,
  generate_security_report: generateSecurityReport,
  configure_security_policy: configureSecurityPolicy,
  get_container_vulnerabilities: getContainerVulnerabilities,
  compare_security_scans: compareSecurityScans,
  schedule_security_scan: scheduleSecurityScan,
  get_fix_suggestions: getFixSuggestions,
};

// List of tool names this module handles
export const toolNames = Object.keys(handlers);

// Export as a handler module
export const securityHandlers: HandlerModule = {
  handlers,
  toolNames,
};

export default securityHandlers;
