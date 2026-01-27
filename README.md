# QA Guardian

[![Build and Deploy](https://github.com/mqxerror/qa-guardian/actions/workflows/deploy.yml/badge.svg)](https://github.com/mqxerror/qa-guardian/actions/workflows/deploy.yml)
[![Deploy Status](https://img.shields.io/badge/deploy-qa.pixelcraftedmedia.com-blue)](https://qa.pixelcraftedmedia.com)
[![Staging](https://img.shields.io/badge/staging-staging.qa.pixelcraftedmedia.com-green)](https://staging.qa.pixelcraftedmedia.com)

**Enterprise-Grade Quality Assurance Automation Platform**

QA Guardian is a comprehensive QA automation platform that unifies test authoring, execution, and monitoring into a single intelligent system. Built on Playwright, it supports both no-code visual test recording for QA engineers and GitHub-integrated test execution for developers.

## Features

### Test Authoring
- **Visual Test Recorder**: Browser-based recording for no-code test creation
- **Step-by-Step Editor**: Click, type, assert, wait, screenshot actions
- **GitHub Integration**: Auto-discover and run Playwright tests from repositories
- **Code View**: View and edit generated Playwright code

### Test Execution
- **Multi-Browser Support**: Chromium, Firefox, WebKit
- **Mobile Emulation**: iPhone, Android viewport testing
- **Parallel Execution**: Run tests across browsers simultaneously
- **Real-Time Progress**: WebSocket-based live updates
- **Retry Logic**: Configurable retry on failure

### Results & Artifacts
- **Comprehensive Dashboard**: Pass/fail summaries, trends, analytics
- **Screenshot Capture**: Automatic on failure, optional per-step
- **Video Recording**: Full test execution videos
- **Playwright Trace Viewer**: Integrated trace analysis
- **Console & Network Logs**: Complete execution context

### Scheduling & Automation
- **Cron Schedules**: Hourly, daily, weekly, custom
- **CI/CD Integration**: GitHub Actions, webhooks
- **PR Status Checks**: Automatic test runs on pull requests

### Alerting
- **Email Notifications**: Configurable failure alerts
- **Slack Integration**: Channel-based notifications
- **Webhooks**: Custom integrations

### Team & Access Control
- **Organizations**: Multi-tenant with team management
- **Role-Based Access**: Owner, Admin, Developer, Viewer roles
- **Audit Logging**: Track all user actions

## Tech Stack

### Frontend
- React 18+ with TypeScript
- Tailwind CSS + Radix UI
- TanStack Query + Zustand
- Recharts for analytics
- Socket.IO for real-time updates
- Vite build system

### Backend
- Node.js 20+ with TypeScript
- Express.js / Fastify
- PostgreSQL (primary database)
- Redis (cache/queue)
- BullMQ (job scheduling)
- MinIO/S3 (artifact storage)
- Socket.IO (WebSocket server)

### Testing Engine
- Playwright
- Docker containerized workers
- Multi-browser execution

## Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- Docker (for test execution workers)
- MinIO or S3-compatible storage

## Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd qa-guardian
   ```

2. **Run the setup script**
   ```bash
   ./init.sh
   ```

3. **Configure environment**
   - Edit `.env` with your database, Redis, and other settings

4. **Start development servers**
   ```bash
   ./init.sh --start
   ```

5. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - API Docs: http://localhost:3001/api/docs

## Project Structure

```
qa-guardian/
├── frontend/              # React frontend application
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── stores/        # Zustand state stores
│   │   ├── api/           # API client functions
│   │   └── utils/         # Utility functions
│   └── public/            # Static assets
│
├── backend/               # Node.js backend application
│   ├── src/
│   │   ├── routes/        # API route handlers
│   │   ├── services/      # Business logic
│   │   ├── models/        # Database models
│   │   ├── middleware/    # Express middleware
│   │   ├── jobs/          # BullMQ job processors
│   │   └── utils/         # Utility functions
│   └── migrations/        # Database migrations
│
├── shared/                # Shared types and utilities
│
├── docker/                # Docker configurations
│   ├── worker/            # Test execution worker
│   └── docker-compose.yml # Local development setup
│
├── prompts/               # AI agent prompts and specs
│
└── init.sh                # Development setup script
```

## Development

### Running Tests
```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test
```

### Database Migrations
```bash
cd backend
npm run migrate        # Run migrations
npm run migrate:create # Create new migration
npm run migrate:down   # Rollback last migration
```

### Code Style
```bash
npm run lint           # Run ESLint
npm run format         # Run Prettier
```

## API Documentation

API documentation is available via Swagger UI at `/api/docs` when the backend is running.

### Authentication

The API uses JWT tokens for authentication:

```bash
# Login
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'

# Use token in requests
curl http://localhost:3001/api/v1/projects \
  -H "Authorization: Bearer <token>"
```

### API Keys

For programmatic access, generate API keys via the UI or API:

```bash
curl http://localhost:3001/api/v1/projects \
  -H "X-API-Key: qg_xxxxxxxxxxxxx"
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

[License information here]

## Support

For questions or issues, please [open an issue](link-to-issues) or contact the team.
