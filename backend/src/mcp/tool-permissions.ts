/**
 * QA Guardian MCP Tool Permissions
 *
 * Centralized mapping of tool names to their required permission scope.
 * Extracted from server.ts for better organization (Feature #1356).
 *
 * Permission levels:
 * - 'read': Read-only operations, only requires mcp:read scope
 * - 'write': Modify operations, requires mcp:write scope
 * - 'execute': Execution operations (running tests, scans), requires mcp:execute scope
 */

export type ToolPermissionScope = 'read' | 'write' | 'execute';

/**
 * Tool scope requirements - categorize each tool by its permission level
 */
export const TOOL_SCOPE_MAP: Record<string, ToolPermissionScope> = {
  // ===== Read-only tools - only require mcp:read =====
  'list_projects': 'read',
  'get_project': 'read',
  'list_test_suites': 'read',
  'get_result': 'read',  // Feature #1429: Unified result retrieval is read-only
  // Feature #1429: Removed get_test_results, get_result_details, get_result_timeline - use get_result
  'get_run': 'read',  // Feature #1428: Unified run info retrieval is read-only
  // Feature #1428: Removed get_run_status, get_run_progress, get_run_logs, get_console_output, get_network_logs - use get_run
  'compare_runs': 'read',  // Feature #1204: Comparing runs is read-only
  'get_test_config': 'read',
  'list_recent_runs': 'read',
  'get_test_artifacts': 'read',
  'get_artifact': 'read',  // Feature #1427: Unified artifact retrieval is read-only
  // Feature #1427: Removed get_screenshots, get_screenshot_base64 - use get_artifact
  'get_video': 'read',  // Feature #903: Reading video data is read-only
  'get_trace': 'read',  // Feature #904: Reading trace data is read-only
  'analyze_failure': 'read',  // Feature #905: Analyzing failures is read-only
  'get_error_stacktrace': 'read',  // Feature #906: Reading error stack traces is read-only
  'download_artifacts': 'read',  // Feature #907: Downloading artifacts is read-only
  'get_artifact_storage': 'read',  // Feature #909: Reading storage usage is read-only
  'search_results': 'read',  // Feature #910: Searching results is read-only
  'get_failure_patterns': 'read',  // Feature #911: Getting failure patterns is read-only
  'get_review_status': 'read',  // Feature #912: Reading review status is read-only
  'create_bug_report': 'read',  // Feature #913: Generating bug report is read-only
  'export_data': 'read',  // Feature #1435: Unified export tool is read-only
  // Feature #1435: Removed export_results - use export_data with type=results
  'get_result_diff': 'read',  // Feature #915: Comparing results is read-only
  'get_annotations': 'read',  // Feature #916: Reading annotations is read-only
  // Feature #1429: Removed get_result_timeline - use get_result with include=["timeline"]
  // Feature #1433: Removed share_result, annotate_result, mark_result_reviewed - collaboration features for humans via UI

  // ===== Write tools - require mcp:write =====
  'delete_artifacts': 'write',  // Feature #908: Deleting artifacts is a write operation
  'create_project': 'write',  // Feature #859: Creating projects is a write operation
  'update_project': 'write',  // Feature #860: Updating projects is a write operation
  'delete_project': 'write',  // Feature #861: Deleting projects is a write operation
  'create_test_suite': 'write',  // Feature #862: Creating test suites is a write operation
  'update_test_suite': 'write',  // Feature #863: Updating test suites is a write operation
  'delete_test_suite': 'write',  // Feature #864: Deleting test suites is a write operation
  'create_test': 'write',
  // Feature #1432: Removed approve_baseline - visual approval requires human judgment
  'update_test': 'write',
  'delete_test': 'write',  // Feature #867: Deleting tests is a write operation
  'duplicate_test': 'write',  // Feature #868: Duplicating tests is a write operation
  'import_tests': 'write',  // Feature #869: Importing tests is a write operation
  'export_tests': 'read',  // Feature #870: Exporting tests is a read operation
  'reorder_tests': 'write',  // Feature #871: Reordering tests is a write operation
  // Feature #1422: Removed add_test_step, update_test_step, delete_test_step scope mappings
  // AI agents should use update_test with complete steps array instead
  'get_test_code': 'read',  // Feature #875: Getting test code is a read operation
  'update_test_code': 'write',  // Feature #876: Updating test code is a write operation
  'validate_test': 'read',  // Feature #877: Validating test is a read operation (no modifications)
  'get_test_history': 'read',  // Feature #878: Getting test history is a read operation
  'get_test': 'read',  // Feature #1730: Getting a single test is read-only
  'list_tests': 'read',  // Feature #1730: Listing tests is read-only

  // ===== Execute tools - require mcp:execute =====
  'run_suite': 'execute',  // Feature #880: Running suites requires execute permission
  'run_selected_tests': 'execute',  // Feature #881: Running selected tests requires execute permission
  'run_failed_tests': 'execute',  // Feature #882: Retrying failed tests requires execute permission
  'run_flaky_tests': 'execute',  // Feature #883: Running flaky tests requires execute permission
  'schedule_run': 'write',  // Feature #884: Scheduling runs requires write permission
  'run_test': 'execute',
  'cancel_test': 'execute',
  'trigger_test_run': 'execute',

  // ===== MCP v2.0 Security Tools =====
  'get_security_findings': 'read',  // Feature #1430: Unified security findings tool is read-only
  // Feature #1430: Removed get_vulnerabilities, get_vulnerability_details - use get_security_findings
  'dismiss_vulnerability': 'write',  // Feature #923: Dismissing vulnerabilities modifies state
  'get_dependency_audit': 'read',
  'get_security_trends': 'read',
  'get_security_score': 'read',  // Feature #926: Reading security score is read-only
  'get_exposed_secrets': 'read',  // Feature #927: Reading exposed secrets is read-only
  'verify_secret_status': 'execute',  // Feature #928: Verifying secret status may make external calls
  'generate_sbom': 'execute',  // Feature #929: Generating SBOM creates files
  'run_dast_scan': 'execute',  // Feature #931: Running DAST scans requires execute permission
  'get_dast_findings': 'read',  // Feature #932: Reading DAST findings is read-only
  'generate_security_report': 'execute',  // Feature #933: Generating reports creates files
  'configure_security_policy': 'write',  // Feature #934: Configuring policies modifies settings
  'get_container_vulnerabilities': 'execute',  // Feature #935: Scanning containers requires execute permission
  'compare_security_scans': 'read',  // Feature #936: Comparing scans is read-only
  'schedule_security_scan': 'write',  // Feature #937: Scheduling scans creates schedules
  'get_fix_suggestions': 'read',  // Feature #938: Getting fix suggestions is read-only
  // Feature #1431: Removed create_check, update_check - monitoring CRUD via REST API
  // Feature #1430: Removed get_security_scan_status - use get_security_findings with scan_id
  'run_security_scan': 'execute',  // Running scans requires execute permission

  // ===== MCP v2.0 Monitoring Tools =====
  'get_uptime_status': 'read',
  'get_check_results': 'read',
  'get_incidents': 'read',
  'get_incident_details': 'read',  // Feature #947: Read-only operation
  'update_incident': 'write',      // Feature #949: Updating incidents is a write operation
  // Feature #1425: Removed acknowledge_alert, resolve_alert, snooze_alert, unsnooze_alert, test_alert_channel
  // Alert management is an incident response workflow for humans, not AI automation
  'get_alert_history': 'read',     // Feature #953: Reading alert history is read-only
  // Feature #1431: Removed get_oncall_schedule, create_maintenance_window - scheduling via REST API
  'get_uptime_report': 'read',     // Feature #955: Reading uptime reports is read-only
  'get_maintenance_windows': 'read',    // Feature #957: Listing maintenance windows is read-only
  'get_status_page_status': 'read',     // Feature #958: Reading public status page is read-only

  // ===== Visual Regression Tools =====
  'get_visual_diffs': 'read',           // Feature #959: Reading visual diffs is read-only
  'get_visual_diff_details': 'read',    // Feature #960: Reading visual diff details is read-only
  // Feature #1432: Removed approve_visual_diff, reject_visual_diff, batch_approve_visual_diffs, set_baseline
  // Visual approval requires human judgment and should be done via UI
  'get_baseline_history': 'read',       // Feature #965: Reading baseline history is read-only
  // Feature #1432: Removed restore_baseline, add_ignore_region - baseline management is a human decision
  // Feature #1427: Removed get_visual_comparison_image - use get_artifact with type="diff"
  'configure_visual_threshold': 'write', // Feature #969: Configuring thresholds modifies test settings
  'get_visual_trends': 'read',           // Feature #970: Reading visual trends is read-only
  'run_visual_comparison': 'execute',    // Feature #971: Running comparisons executes tests
  'get_visual_review_queue': 'read',     // Feature #972: Reading review queue is read-only
  // Feature #1427: Removed compare_screenshots - use run_visual_comparison or get_artifact

  // ===== Performance Tools =====
  'run_lighthouse_audit': 'execute',     // Feature #974: Running audits executes tests
  'get_lighthouse_results': 'read',       // Feature #975: Getting audit results is read-only
  'get_performance_trends': 'read',       // Feature #976: Getting performance trends is read-only
  'set_performance_budget': 'write',      // Feature #977: Setting budgets modifies project configuration
  'get_budget_violations': 'read',        // Feature #978: Getting budget violations is read-only

  // ===== K6 Load Testing Tools =====
  'run_k6_test': 'execute',               // Feature #979: Running K6 tests requires execute permission
  'get_k6_results': 'read',               // Feature #980: Getting K6 results is read-only
  'get_k6_progress': 'read',              // Feature #981: Monitoring K6 progress is read-only
  'stop_k6_test': 'execute',              // Feature #982: Stopping K6 tests requires execute permission
  'create_k6_script': 'write',            // Feature #983: Creating K6 scripts is a write operation
  'update_k6_script': 'write',            // Feature #984: Modifying K6 scripts is a write operation
  'get_k6_templates': 'read',             // Feature #985: Listing K6 templates is read-only
  'get_load_test_trends': 'read',         // Feature #986: Viewing load test trends is read-only
  'compare_load_tests': 'read',           // Feature #987: Comparing load tests is read-only

  // ===== Accessibility Tools =====
  'run_accessibility_scan': 'execute',    // Feature #988: Running accessibility scan is an execute operation
  'get_accessibility_results': 'read',    // Feature #989: Getting accessibility results is read-only
  'get_accessibility_trends': 'read',     // Feature #990: Viewing accessibility trends is read-only
  // Feature #1435: Removed export_accessibility_report - use export_data with type=accessibility
  'get_core_web_vitals': 'read',          // Feature #992: Getting CWV is read-only (may execute audit)
  'schedule_performance_audit': 'write',  // Feature #993: Creating schedules is a write operation

  // ===== Analytics Tools =====
  'get_dashboard_summary': 'read',        // Feature #994: Getting dashboard data is read-only
  'get_project_analytics': 'read',        // Feature #995: Getting project analytics is read-only
  'get_flaky_tests': 'read',              // Feature #996: Listing flaky tests is read-only
  'quarantine_test': 'write',             // Feature #1109: Quarantining test requires write permission
  'unquarantine_test': 'write',           // Feature #1110: Unquarantining test requires write permission
  'get_flakiness_trends': 'read',         // Feature #1110: Getting flakiness trends is read-only
  'suggest_flaky_fixes': 'read',          // Feature #1111: Getting fix suggestions is read-only
  'get_failing_tests': 'read',            // Feature #997: Listing failing tests is read-only
  'get_test_coverage': 'read',            // Feature #998: Getting test coverage is read-only
  'get_quality_score': 'read',            // Feature #999: Getting quality score is read-only
  // Feature #1435: Removed generate_report - use export_data with type=report
  // Feature #1435: Removed export_analytics_csv - use export_data with type=analytics
  'get_team_metrics': 'read',              // Feature #1002: Getting team metrics is read-only
  'get_browser_analytics': 'read',         // Feature #1003: Getting browser analytics is read-only
  'get_execution_time_analytics': 'read',  // Feature #1004: Getting execution time analytics is read-only
  'get_failure_categories': 'read',        // Feature #1005: Getting failure categories is read-only
  'get_release_quality': 'read',           // Feature #1006: Getting release quality is read-only
  'compare_releases': 'read',              // Feature #1007: Comparing releases is read-only
  // Feature #1407: get_sla_report removed
  // Feature #1435: Removed schedule_report - scheduling via REST API for human oversight
  'get_audit_log': 'read',                 // Feature #1011: Getting audit log is read-only
  'get_usage_statistics': 'read',          // Feature #1012: Getting usage statistics is read-only
  // get_anomalies: REMOVED (Feature #1416)

  // ===== Organization Tools =====
  'get_organization_info': 'read',         // Feature #1014: Getting organization info is read-only
  'get_team_members': 'read',              // Feature #1015: Getting team members is read-only
  // Feature #1424: Removed invite_member, update_member_role, remove_member (security-sensitive)
  'get_api_keys': 'read',                  // Feature #1019: Getting API keys is read-only
  // Feature #1424: Removed create_api_key, revoke_api_key (security-sensitive)
  'update_settings': 'write',              // Feature #1022: Updating organization settings is a write operation
  'get_integrations': 'read',              // Feature #1023: Getting integrations is read-only
  'create_incident': 'write',      // Creating incidents is a write operation

  // ===== Advanced/AI Tools =====
  'stream_test_run': 'read',               // Feature #1216: Streaming test run updates is read-only
  'subscribe_to_alerts': 'read',           // Feature #1217: Subscribing to alerts is read-only
  'unsubscribe_from_alerts': 'write',      // Feature #1217: Unsubscribing modifies subscription state
  'batch_trigger_tests': 'execute',        // Feature #1218: Batch triggering tests is an execution operation
  // Feature #1426: Removed create_workflow, execute_workflow, schedule_workflow (use CI/CD)
  // Feature #1405: generate_executive_report removed
  // Feature #1406: generate_compliance_report removed
  'generate_comprehensive_report': 'write', // Feature #1732: Generate comprehensive report creates new report
  'get_report': 'read',                     // Feature #1732: Get report by ID is read-only
  'list_reports': 'read',                   // Feature #1732: List reports is read-only
  'get_trend_analysis': 'read',            // Feature #1224: Trend analysis is a read operation
  'get_related_prs': 'read',               // Feature #1226: Getting related PRs is a read operation
  // Feature #1437: Removed get_deployment_context - deployment info should come via webhooks
  // Feature #1436: Removed notify_team - AI should not send arbitrary notifications that bypass alerting
  // Feature #1434: Removed get_help, list_all_tools, validate_api_key - AI agents have MCP manifest

  // ===== AI Provider Tools =====
  'get_ai_provider_status': 'read',        // Feature #1351: Getting AI provider status is a read operation
  'get_ai_cost_report': 'read',            // Feature #1352: Getting AI cost report is a read operation
  'switch_ai_provider': 'write',           // Feature #1353: Switching AI provider requires write (admin only)
  'generate_test_from_description': 'execute', // Feature #1354: Generating tests uses AI execution
  'generate_test': 'execute',              // Feature #1157: Generate test from description via MCP
  'get_coverage_gaps': 'read',             // Feature #1158: Get coverage gaps is read-only analysis
  'generate_test_suite': 'execute',        // Feature #1159: Generating test suite uses AI execution
  'convert_gherkin': 'execute',            // Feature #1160: Converting Gherkin uses AI execution
  'explain_test_failure_ai': 'read',       // Feature #1355: Explaining failures is read-only AI analysis
  'suggest_test_improvements': 'read',     // Feature #1161: Suggesting test improvements is read-only AI analysis
  'ask_qa_guardian': 'read',               // Feature #1202: Natural language interface to platform is read-only
  'summarize_test_results': 'read',        // Feature #1206: Summarizing test results is read-only
  'suggest_test_strategy': 'read',         // Feature #1212: Suggesting test strategy is read-only
  'analyze_test_maintenance': 'read',      // Feature #1213: Analyzing test maintenance is read-only
};

/**
 * Get the required permission scope for a tool
 */
export function getToolScope(toolName: string): ToolPermissionScope | undefined {
  return TOOL_SCOPE_MAP[toolName];
}

/**
 * Check if a tool requires a specific permission level
 */
export function toolRequiresScope(toolName: string, scope: ToolPermissionScope): boolean {
  const required = TOOL_SCOPE_MAP[toolName];
  if (!required) return false;
  return required === scope;
}

/**
 * Get all tools by permission level
 */
export function getToolsByScope(scope: ToolPermissionScope): string[] {
  return Object.entries(TOOL_SCOPE_MAP)
    .filter(([_, s]) => s === scope)
    .map(([name, _]) => name);
}
