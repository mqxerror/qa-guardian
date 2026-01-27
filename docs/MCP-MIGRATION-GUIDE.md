# MCP Tool Migration Guide (v2.0 → v2.1)

This guide documents the MCP tool changes in QA Guardian v2.1, which streamlines the tool set for better AI agent ergonomics and security.

## Summary of Changes

### Tool Consolidations

Several specialized tools have been consolidated into unified tools with type/include parameters:

#### `get_security_findings` replaces:
- `get_vulnerabilities` - Use `get_security_findings` with `finding_type: "vulnerability"`
- `get_vulnerability_details` - Use `get_security_findings` with `vulnerability_id` parameter
- `get_security_scan_status` - Use `get_security_findings` with `scan_id` parameter

#### `get_result` replaces:
- `get_test_results` - Use `get_result` with `run_id`
- `get_result_details` - Use `get_result` with `run_id` and `test_id`, plus `include: ["steps", "errors", "artifacts"]`
- `get_result_timeline` - Use `get_result` with `include: ["timeline"]`

#### `get_artifact` replaces:
- `get_visual_comparison_image` - Use `get_artifact` with `type: "diff"`
- `compare_screenshots` - Use `run_visual_comparison` or `get_artifact`

#### `export_data` replaces:
- `generate_report` - Use `export_data` with `type: "report"`
- `export_analytics_csv` - Use `export_data` with `type: "analytics"`
- `export_results` - Use `export_data` with `type: "results"`
- `export_accessibility_report` - Use `export_data` with `type: "accessibility"`

### Removed Tools (Human-Only via UI)

The following tools have been removed from MCP as they require human judgment or oversight:

#### Visual Approval Tools
These require human visual judgment:
- `approve_visual_diff` → Use web UI
- `reject_visual_diff` → Use web UI
- `batch_approve_visual_diffs` → Use web UI
- `set_baseline` → Use web UI
- `restore_baseline` → Use web UI
- `add_ignore_region` → Use web UI
- `approve_baseline` → Use web UI

#### Result Annotation Tools
These are collaboration features for humans:
- `mark_result_reviewed` → Use web UI
- `annotate_result` → Use web UI
- `share_result` → Use web UI

#### Organization Management Tools
These are security-sensitive operations:
- `invite_member` → Use REST API or web UI
- `update_member_role` → Use REST API or web UI
- `remove_member` → Use REST API or web UI
- `create_api_key` → Use REST API or web UI
- `revoke_api_key` → Use REST API or web UI

#### Monitoring CRUD Tools
These require human oversight for scheduling:
- `create_check` → Use REST API or web UI
- `update_check` → Use REST API or web UI
- `get_oncall_schedule` → Use REST API or web UI
- `create_maintenance_window` → Use REST API or web UI

#### Alert Management Tools
These are incident response workflows for humans:
- `acknowledge_alert` → Use web UI
- `resolve_alert` → Use web UI
- `snooze_alert` → Use web UI
- `unsnooze_alert` → Use web UI
- `test_alert_channel` → Use web UI

#### Workflow Tools
Use CI/CD pipelines instead:
- `create_workflow` → Use CI/CD (GitHub Actions, etc.)
- `execute_workflow` → Use CI/CD
- `schedule_workflow` → Use CI/CD

#### Other Removed Tools
- `schedule_report` → Use REST API (requires human oversight)
- `notify_team` → Use built-in alerting (rate limited)
- `get_deployment_context` → Use webhooks (push, not poll)
- `get_help` → AI agents have MCP manifest
- `list_all_tools` → AI agents have MCP manifest
- `validate_api_key` → AI agents are already authenticated

### Test Step Management

The following tools have been removed. Use `update_test` with a complete steps array instead:
- `add_test_step`
- `update_test_step`
- `delete_test_step`

**Rationale**: Atomic step operations were prone to race conditions. Updating the full steps array is more reliable for AI agents.

## Migration Examples

### Before: Get security vulnerabilities
```json
{
  "tool": "get_vulnerabilities",
  "arguments": {
    "project_id": "proj-123",
    "severity": "critical"
  }
}
```

### After: Get security findings
```json
{
  "tool": "get_security_findings",
  "arguments": {
    "project_id": "proj-123",
    "severity": "critical",
    "finding_type": "vulnerability"
  }
}
```

### Before: Get test results with timeline
```json
{
  "tool": "get_result_timeline",
  "arguments": {
    "run_id": "run-123",
    "test_id": "test-456"
  }
}
```

### After: Get result with timeline included
```json
{
  "tool": "get_result",
  "arguments": {
    "run_id": "run-123",
    "test_id": "test-456",
    "include": ["timeline", "steps", "artifacts"]
  }
}
```

### Before: Export results and analytics separately
```json
// Two separate calls
{ "tool": "export_results", "arguments": { "run_id": "run-123" } }
{ "tool": "export_analytics_csv", "arguments": { "project_id": "proj-123" } }
```

### After: Use unified export_data
```json
{ "tool": "export_data", "arguments": { "type": "results", "run_id": "run-123" } }
{ "tool": "export_data", "arguments": { "type": "analytics", "project_id": "proj-123", "format": "csv" } }
```

## Scope Mappings

All consolidated tools maintain appropriate scope mappings:
- `get_security_findings` → `read`
- `get_result` → `read`
- `get_artifact` → `read`
- `export_data` → `read`

## Questions?

If you have questions about migrating your AI agent integration, please contact support or refer to the MCP tool schema in your MCP client's manifest.
