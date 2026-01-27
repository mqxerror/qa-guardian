# QA Guardian MCP Server

Model Context Protocol (MCP) server for QA Guardian - enabling AI agents to interact with your test management platform.

## Installation

### Via npx (recommended)

```bash
npx @qa-guardian/mcp-server
```

### Via npm (global install)

```bash
npm install -g @qa-guardian/mcp-server
qa-guardian-mcp
```

## Usage

### Command Line Options

```bash
npx @qa-guardian/mcp-server [options]

Options:
  -p, --port <port>       Port to listen on (default: 3100)
  -h, --host <host>       Host to bind to (default: localhost)
  --api-url <url>         QA Guardian API URL (default: http://localhost:3000)
  --api-key <key>         API key for authentication
  -t, --transport <type>  Transport type: stdio or sse (default: stdio)
  -v, --verbose           Enable verbose logging
  --help                  Show help message
  --version               Show version number
```

### Environment Variables

```bash
QA_GUARDIAN_API_URL=http://localhost:3000
QA_GUARDIAN_API_KEY=your-api-key
MCP_TRANSPORT=stdio
MCP_PORT=3100
MCP_HOST=localhost
```

## Claude Desktop Configuration

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "qa-guardian": {
      "command": "npx",
      "args": ["@qa-guardian/mcp-server"],
      "env": {
        "QA_GUARDIAN_API_URL": "http://localhost:3000",
        "QA_GUARDIAN_API_KEY": "your-api-key"
      }
    }
  }
}
```

## Available Tools

The MCP server provides 90+ streamlined tools across these categories:

### Test Execution
- `trigger_test_run` - Start a new test run
- `cancel_test_run` - Cancel a running test
- `get_run_status` - Get test run status
- `rerun_failed_tests` - Rerun only failed tests

### Test Management
- `list_test_suites` - List all test suites
- `create_test_suite` - Create a new test suite
- `list_tests` - List tests in a suite
- `create_test` - Create a new test

### Test Results
- `get_test_results` - Get detailed results
- `get_failed_tests` - Get list of failures
- `get_flaky_tests` - Get flaky test analysis
- `compare_test_runs` - Compare two runs

### Visual Regression
- `compare_screenshots` - Compare screenshots
- `approve_baseline` - Approve new baseline
- `get_visual_diff` - Get visual diff details

### Performance Testing
- `run_lighthouse_audit` - Run Lighthouse audit
- `run_load_test` - Execute K6 load test
- `get_performance_metrics` - Get Core Web Vitals

### Accessibility
- `run_accessibility_audit` - Run axe-core scan
- `get_accessibility_issues` - Get issues list
- `get_wcag_compliance` - Get WCAG report

### Security
- `run_security_scan` - Run SAST/DAST scan
- `get_vulnerabilities` - Get vulnerability list
- `run_dependency_audit` - Check dependencies

### AI Analysis
- `analyze_root_cause` - AI root cause analysis
- `suggest_test_fixes` - Get AI fix suggestions
- `generate_test_from_description` - NL to test code

### Analytics
- `get_dashboard_summary` - Dashboard overview
- `get_quality_score` - Quality health score
- `get_team_metrics` - Team productivity

## Available Resources

The server exposes these MCP resources:

- `qaguardian://projects` - List of projects
- `qaguardian://projects/{id}` - Project details
- `qaguardian://projects/{id}/suites` - Test suites
- `qaguardian://test-runs/{id}` - Test run details
- `qaguardian://test-runs/{id}/results` - Test results
- `qaguardian://test-runs/{id}/artifacts` - Artifacts
- `qaguardian://analytics/dashboard` - Dashboard data
- `qaguardian://security/vulnerabilities` - Security issues

## Examples

### Start with stdio transport (for Claude Desktop)

```bash
npx @qa-guardian/mcp-server
```

### Start with SSE transport

```bash
npx @qa-guardian/mcp-server --transport sse --port 3100
```

### Connect to production API

```bash
npx @qa-guardian/mcp-server \
  --api-url https://api.qaguardian.com \
  --api-key your-production-key
```

## License

MIT License - see LICENSE file for details.
