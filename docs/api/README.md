# QA Guardian API Reference

## Authentication

All API requests require authentication via API key.

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.qaguardian.com/v1/projects
```

### API Key Scopes

| Scope | Description |
|-------|-------------|
| `read` | Read projects, suites, results |
| `write` | Create/update projects, suites |
| `execute` | Trigger test runs |
| `admin` | Manage users, organization |
| `mcp:read` | MCP read operations |
| `mcp:execute` | MCP trigger operations |
| `mcp:write` | MCP write operations |

---

## REST API Endpoints

### Projects

```
GET    /v1/projects              # List all projects
POST   /v1/projects              # Create project
GET    /v1/projects/:id          # Get project
PATCH  /v1/projects/:id          # Update project
DELETE /v1/projects/:id          # Delete project
```

### Test Suites

```
GET    /v1/projects/:id/suites   # List suites
POST   /v1/projects/:id/suites   # Create suite
GET    /v1/suites/:id            # Get suite
PATCH  /v1/suites/:id            # Update suite
DELETE /v1/suites/:id            # Delete suite
```

### Test Runs

```
POST   /v1/suites/:id/run        # Trigger test run
GET    /v1/runs/:id              # Get run status
POST   /v1/runs/:id/cancel       # Cancel run
GET    /v1/runs/:id/results      # Get results
GET    /v1/runs/:id/artifacts    # Get artifacts
```

---

## MCP Protocol

QA Guardian supports Model Context Protocol for AI agent integration.

### Transport Options

- **stdio:** Standard input/output
- **SSE:** Server-Sent Events

### Available Tools

#### trigger-test-run

Start a test suite execution.

```json
{
  "name": "trigger-test-run",
  "arguments": {
    "suiteId": "suite_abc123",
    "environment": "staging",
    "browsers": ["chromium", "firefox"]
  }
}
```

#### get-run-status

Get real-time status of a test run.

```json
{
  "name": "get-run-status",
  "arguments": {
    "runId": "run_xyz789"
  }
}
```

**Response:**
```json
{
  "status": "running",
  "progress": 45,
  "passed": 12,
  "failed": 2,
  "pending": 16
}
```

#### get-test-results

Get detailed test results.

```json
{
  "name": "get-test-results",
  "arguments": {
    "runId": "run_xyz789",
    "status": "failed"
  }
}
```

#### cancel-test-run

Cancel a running test.

```json
{
  "name": "cancel-test-run",
  "arguments": {
    "runId": "run_xyz789"
  }
}
```

#### list-test-suites

List available test suites.

```json
{
  "name": "list-test-suites",
  "arguments": {
    "projectId": "proj_abc123"
  }
}
```

#### get-test-artifacts

Get screenshots, videos, traces.

```json
{
  "name": "get-test-artifacts",
  "arguments": {
    "runId": "run_xyz789",
    "type": "screenshot"
  }
}
```

### MCP Resources

```
qaguardian://projects                    # All projects
qaguardian://projects/{id}               # Single project
qaguardian://projects/{id}/suites        # Project's test suites
qaguardian://test-runs/{id}              # Test run details
qaguardian://test-runs/{id}/results      # Test results
qaguardian://test-runs/{id}/artifacts    # Test artifacts
```

---

## Rate Limits

| Tier | Requests/min | Concurrent |
|------|--------------|------------|
| Free | 60 | 5 |
| Pro | 300 | 20 |
| Enterprise | Custom | Custom |

---

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Invalid/expired API key |
| 403 | Forbidden - Insufficient scope |
| 404 | Not Found - Resource doesn't exist |
| 429 | Too Many Requests - Rate limited |
| 500 | Internal Error - Server issue |

---

## Webhooks

Configure webhooks to receive events:

```json
{
  "event": "test.run.completed",
  "payload": {
    "runId": "run_xyz789",
    "status": "passed",
    "passed": 30,
    "failed": 0,
    "duration": 125000
  }
}
```

### Event Types

- `test.run.started`
- `test.run.completed`
- `test.run.failed`
- `visual.diff.detected`
- `performance.budget.exceeded`
- `accessibility.issue.critical`
