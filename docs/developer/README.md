# QA Guardian Developer Guide

Technical documentation for contributors and developers.

## Architecture Overview

For detailed visual representations, see the diagrams below. Each diagram is available in both SVG (scalable) and PNG (universal compatibility) formats.

### Architecture Diagrams

| Diagram | Description | SVG | PNG |
|---------|-------------|-----|-----|
| Architecture Overview | System components and layers | [SVG](../images/diagrams/architecture-overview.svg) | [PNG](../images/diagrams/architecture-overview.png) |
| Data Flow | How data moves through the system | [SVG](../images/diagrams/data-flow.svg) | [PNG](../images/diagrams/data-flow.png) |
| Database Schema | Entity-relationship diagram | [SVG](../images/diagrams/database-schema.svg) | [PNG](../images/diagrams/database-schema.png) |
| Test Execution Pipeline | End-to-end test workflow | [SVG](../images/diagrams/test-execution-pipeline.svg) | [PNG](../images/diagrams/test-execution-pipeline.png) |
| MCP Protocol Flow | AI agent integration | [SVG](../images/diagrams/mcp-protocol-flow.svg) | [PNG](../images/diagrams/mcp-protocol-flow.png) |
| Visual Regression Workflow | Screenshot comparison flow | [SVG](../images/diagrams/visual-regression-workflow.svg) | [PNG](../images/diagrams/visual-regression-workflow.png) |
| Authentication Flow | JWT and OAuth flows | [SVG](../images/diagrams/auth-flow.svg) | [PNG](../images/diagrams/auth-flow.png) |
| Alerting System | Notification and alert delivery | [SVG](../images/diagrams/alerting-system.svg) | [PNG](../images/diagrams/alerting-system.png) |
| CI/CD Integration | GitHub webhook and status updates | [SVG](../images/diagrams/cicd-integration.svg) | [PNG](../images/diagrams/cicd-integration.png) |
| Deployment Topology | Production infrastructure | [SVG](../images/diagrams/deployment-topology.svg) | [PNG](../images/diagrams/deployment-topology.png) |

> **Note:** Use SVG for best quality in modern browsers. Use PNG as a fallback for environments that don't support SVG (email clients, older browsers, some markdown renderers).

### System Architecture

![Architecture Overview](../images/diagrams/architecture-overview.svg)

### Data Flow

![Data Flow](../images/diagrams/data-flow.svg)

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React 18+)                    │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │Dashboard│ │ Tests   │ │ Results │ │ Settings│           │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Layer (Node.js)                       │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │REST API │ │WebSocket│ │  MCP    │ │Webhooks │           │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
└─────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│ PostgreSQL  │      │    Redis    │      │    MinIO    │
│  (Data)     │      │  (Cache)    │      │ (Artifacts) │
└─────────────┘      └─────────────┘      └─────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Test Runners                              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │Playwright│ │   K6   │ │Lighthouse│ │ axe-core│           │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
└─────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18+, TypeScript, TailwindCSS |
| Backend | Node.js, Express/Fastify |
| Database | PostgreSQL 15+ |
| Cache | Redis 7+ |
| Storage | MinIO (S3-compatible) |
| E2E Testing | Playwright |
| Load Testing | K6 OSS |
| Performance | Lighthouse CI |
| Accessibility | axe-core |
| Visual Diff | pixelmatch, reg-cli |

## Project Structure

```
qa-guardian/
├── frontend/               # React application
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Route pages
│   │   ├── hooks/         # Custom React hooks
│   │   ├── stores/        # State management
│   │   └── utils/         # Helper functions
│   └── tests/             # Frontend tests
│
├── backend/               # API server
│   ├── src/
│   │   ├── routes/        # API endpoints
│   │   ├── services/      # Business logic
│   │   ├── models/        # Database models
│   │   ├── mcp/           # MCP protocol handlers
│   │   └── workers/       # Background jobs
│   └── tests/             # Backend tests
│
├── runners/               # Test execution engines
│   ├── playwright/        # E2E test runner
│   ├── k6/                # Load test runner
│   ├── lighthouse/        # Performance runner
│   └── axe/               # Accessibility runner
│
├── docs/                  # Documentation
│   ├── user-guide/        # End-user docs
│   ├── api/               # API reference
│   ├── developer/         # This guide
│   └── generated/         # Auto-generated feature docs
│
└── scripts/               # Build & utility scripts
```

## Development Setup

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 15+ (or use Docker)
- Redis 7+ (or use Docker)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/your-org/qa-guardian.git
cd qa-guardian

# Install dependencies
npm install

# Start infrastructure
docker-compose up -d postgres redis minio

# Run database migrations
npm run db:migrate

# Start development servers
npm run dev
```

### Environment Variables

```bash
# .env.local
DATABASE_URL=postgresql://user:pass@localhost:5432/qaguardian
REDIS_URL=redis://localhost:6379
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
JWT_SECRET=your-secret-key
```

## Feature Development Workflow

### 1. Pick a Feature

Features are tracked in `features.db`. Check pending features:

```bash
python scripts/generate-docs.py --pending
```

### 2. Create Branch

```bash
git checkout -b feature/visual-regression-baseline-ui
```

### 3. Implement the Feature

Follow existing patterns in the codebase.

### 4. Add Documentation

Update the feature in the database with:
- `user_docs`: How end-users use this feature
- `api_docs`: API endpoints/parameters (if applicable)
- `dev_notes`: Implementation notes for developers

```sql
UPDATE features
SET user_docs = 'Click the "Set as Baseline" button to save the current screenshot as the reference for future comparisons.',
    dev_notes = 'Uses MinIO for storage. Baseline key format: baselines/{projectId}/{suiteId}/{testId}/{hash}.png'
WHERE name = 'Set screenshot as new baseline';
```

### 5. Regenerate Docs

```bash
python scripts/generate-docs.py
```

### 6. Mark Feature Complete

```sql
UPDATE features SET passes = 1 WHERE id = <feature_id>;
```

## Database Schema

For the complete entity-relationship diagram, see [Database Schema Diagram](../images/diagrams/database-schema.svg) (or [PNG version](../images/diagrams/database-schema.png) for compatibility).

![Database Schema](../images/diagrams/database-schema.svg)

### Core Tables

```sql
-- Organizations
CREATE TABLE organizations (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY,
  org_id UUID REFERENCES organizations(id),
  name VARCHAR(255) NOT NULL,
  settings JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Test Suites
CREATE TABLE test_suites (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  name VARCHAR(255) NOT NULL,
  config JSONB
);

-- Test Runs
CREATE TABLE test_runs (
  id UUID PRIMARY KEY,
  suite_id UUID REFERENCES test_suites(id),
  status VARCHAR(50),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  results JSONB
);
```

## MCP Implementation

### Adding a New Tool

1. Define tool in `backend/src/mcp/tools/`

```typescript
// backend/src/mcp/tools/get-flaky-tests.ts
export const getFlakyTests: MCPTool = {
  name: 'get-flaky-tests',
  description: 'List tests with high flakiness scores',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: { type: 'string' },
      threshold: { type: 'number', default: 0.3 }
    },
    required: ['projectId']
  },
  handler: async (args) => {
    // Implementation
  }
};
```

2. Register in tool index

```typescript
// backend/src/mcp/tools/index.ts
export const tools = [
  triggerTestRun,
  getRunStatus,
  getFlakyTests,  // Add new tool
  // ...
];
```

3. Add MCP resource (if needed)

```typescript
// backend/src/mcp/resources/index.ts
export const resources = [
  'qaguardian://flaky-tests/{projectId}',
  // ...
];
```

## Testing

### Running Tests

```bash
# All tests
npm test

# Frontend only
npm run test:frontend

# Backend only
npm run test:backend

# E2E tests
npm run test:e2e
```

### Writing Tests

Follow the feature's test steps as your guide:

```typescript
// tests/visual-regression.spec.ts
test('User can set screenshot as new baseline', async ({ page }) => {
  // Step 1: Navigate to visual comparison with diff detected
  await page.goto('/projects/123/visual/comparison/456');

  // Step 2: Click "Set as Baseline" button
  await page.click('[data-testid="set-baseline-btn"]');

  // Step 3: Verify confirmation message appears
  await expect(page.locator('.toast-success')).toContainText('Baseline updated');

  // Step 4: Verify new baseline is used on next comparison
  // ...
});
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add/update documentation
5. Submit a pull request

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for detailed guidelines.
