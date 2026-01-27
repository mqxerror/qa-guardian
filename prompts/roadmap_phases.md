# QA Guardian - Roadmap Phases

This document contains the detailed breakdown of all phases for easy retrieval during project expansion sessions.

---

## Phase 1: Foundation (Months 1-3) ✅ COMPLETED

**Status**: Documented in `app_spec.txt` with ~200 features

**Deliverables**:
- [x] User authentication (email + Google SSO)
- [x] Project and organization management
- [x] Playwright-based E2E test execution
- [x] Test results dashboard
- [x] Screenshot and trace artifacts
- [x] GitHub Actions integration
- [x] Basic alerting (email, Slack)
- [x] API for triggering tests
- [x] Test scheduling (cron-based)
- [x] Role-based access control (owner, admin, developer, viewer)

---

## Phase 2: Testing Expansion + MCP Foundation (Months 4-6)

**Goal**: Add visual regression, performance, accessibility + MCP server

### Visual Regression (pixelmatch + reg-cli)
- Pixel-by-pixel comparison using pixelmatch
- Perceptual diff (ignores anti-aliasing)
- Component-level screenshots
- Full-page screenshots
- Responsive breakpoint testing (desktop, tablet, mobile)
- Dynamic content masking (ignore regions)
- Baseline management UI
- Side-by-side comparison viewer
- Overlay slider for pixel diff
- Highlight changes with bounding boxes
- One-click approve/reject baselines
- Batch approval for multiple screenshots
- Baseline history preservation
- Diff percentage calculation and thresholds
- Visual test integration with E2E tests

### Performance Testing - Lighthouse
- Core Web Vitals capture (LCP, FID, CLS)
- Lighthouse CI integration
- Performance score tracking over time
- Performance budgets and thresholds
- Performance trend charts
- Recommendations display
- Compare metrics across releases
- Alerts when vitals degrade below threshold
- Desktop and mobile audits
- SEO auditing via Lighthouse SEO module

### Performance Testing - K6 Load Testing
- K6 script management UI
- Load test configuration (VUs, duration, stages)
- Test types: Load, Stress, Spike, Soak
- Ramp-up pattern configuration
- Geographic location selection for tests
- Real-time metrics during test execution
- Results: p50, p90, p95, p99 latencies
- Requests per second tracking
- Error rate monitoring
- Pass/fail thresholds
- Historical comparison
- Custom business metrics support
- K6 script editor with syntax highlighting
- Pre-built templates for common scenarios

### Accessibility Testing (axe-core)
- axe-core integration with test runs
- WCAG 2.1 AA/AAA compliance scanning
- Severity levels: Critical, Serious, Moderate, Minor
- Accessibility issues dashboard
- Issue categorization (color contrast, keyboard nav, ARIA, etc.)
- Remediation guidance per issue
- Trend tracking over time
- Per-page accessibility scores
- Bulk scanning across pages
- Integration with E2E test flows
- Export accessibility reports

### MCP Server v1.0 - Core Tools
- MCP server package (`@qa-guardian/mcp-server`)
- Transport support: stdio, SSE
- API key authentication with scopes (mcp:read, mcp:execute, mcp:write)
- Rate limiting per API key
- Core tools:
  - `trigger-test-run` - Start test suite execution
  - `cancel-test-run` - Cancel running test
  - `get-run-status` - Real-time status of test run
  - `list-test-suites` - List available test suites
  - `get-test-config` - Get test suite configuration
  - `get-test-results` - Get detailed test results
  - `get-test-artifacts` - Get screenshots, videos, traces
- MCP resources:
  - `qaguardian://projects`
  - `qaguardian://projects/{id}`
  - `qaguardian://projects/{id}/suites`
  - `qaguardian://test-runs/{id}`
  - `qaguardian://test-runs/{id}/results`
  - `qaguardian://test-runs/{id}/artifacts`
- Connection status in dashboard
- MCP usage analytics

### Additional Phase 2 Items
- Enhanced reporting with trends
- GitLab CI integration
- Webhook notifications expansion
- Test result comparison between runs

---

## Phase 3: Security, Monitoring + MCP Expansion (Months 7-9)

**Goal**: Add security scanning, synthetic monitoring, expand MCP

### SAST - Static Application Security Testing (Semgrep)
- Semgrep integration
- Language support (JavaScript, TypeScript, Python, Go, Java, etc.)
- Vulnerability categories:
  - SQL Injection
  - XSS (Cross-Site Scripting)
  - CSRF
  - Path Traversal
  - Insecure Deserialization
  - Hardcoded Secrets
  - Broken Authentication
- Custom rule support
- Scan on every commit/PR
- Severity classification (Critical, High, Medium, Low)
- False positive management
- Remediation guidance
- Security findings dashboard
- Trend tracking over time
- Integration with GitHub PR checks

### DAST - Dynamic Application Security Testing (OWASP ZAP)
- OWASP ZAP integration
- Scan types:
  - Baseline scan (1-5 min) - every commit
  - API scan (5-15 min) - API changes
  - Full scan (30-120 min) - nightly/weekly
- Target URL configuration
- Authentication handling for scans
- Vulnerability reporting
- DAST scheduling
- Integration with CI/CD pipelines

### Dependency Scanning (Trivy + Grype)
- Trivy integration for dependency scanning
- Grype as secondary scanner
- npm audit integration
- Known vulnerability detection (CVE database)
- License compliance checking
- Upgrade recommendations
- Container image scanning
- SBOM generation
- CI/CD integration with exit codes
- Dependency tree visualization
- Automated PR creation for updates (optional)

### Secret Detection (Gitleaks)
- Gitleaks integration
- Pre-commit hook support
- CI pipeline scanning
- Historical scan of repository
- Custom pattern rules
- Allowlisting for false positives
- Alert on detected secrets
- Remediation workflow

### Synthetic Monitoring
- Uptime monitoring checks
- Check types:
  - Uptime (30s-5min interval)
  - API Health (1-5min interval)
  - Transaction/Multi-step (5-15min interval)
  - Performance (15-60min interval)
- Global locations:
  - North America: US-East, US-West, Canada
  - Europe: UK, Germany, Netherlands
  - Asia Pacific: Singapore, Tokyo, Sydney
  - South America: Brazil
- Assertion configuration:
  - Response time thresholds
  - Status code validation
  - Body content checks
  - Header validation
- Consecutive failure alerting
- Uptime SLA reporting
- Incident timeline view
- Check history and trends
- Multi-step transaction recording

### Alerting Expansion
- Grafana OnCall integration
- Alertmanager integration
- On-call schedule management
- Escalation policies
- Alert grouping and deduplication
- Alert routing rules
- Incident management workflow
- Acknowledge/Resolve actions
- Alert history and analytics
- Telegram integration via n8n
- Custom webhook templates

### MCP Server v2.0 - Security & Monitoring Tools
- New tools:
  - `run-security-scan` - Trigger SAST/DAST scan
  - `get-vulnerabilities` - List detected vulnerabilities
  - `get-dependency-audit` - Dependency vulnerability report
  - `get-security-trends` - Security metrics over time
  - `get-uptime-status` - Current uptime for all checks
  - `get-check-results` - Synthetic check results
  - `acknowledge-alert` - Acknowledge active alert
  - `get-incidents` - List active incidents
  - `create-incident` - Create new incident
- New resources:
  - `qaguardian://security/vulnerabilities`
  - `qaguardian://checks/{id}/status`
  - `qaguardian://alerts/active`

### Additional Phase 3 Items
- Jira integration (auto-create issues)
- Linear integration
- Custom Grafana dashboard embedding
- Integration marketplace foundation

---

## Phase 4: AI & Intelligence + MCP AI Tools (Months 10-12)

**Goal**: Introduce AI-powered features with MCP AI tools

### Self-Healing Tests
- Multi-attribute element recording (id, class, text, position, ARIA)
- ML model for element location when selectors fail
- Healing strategies with weights:
  - id (1.0)
  - data-testid (0.95)
  - aria-label (0.9)
  - text-content (0.8)
  - css-path (0.7)
  - visual-match (0.6)
- Auto-apply fixes with confidence threshold
- Selector update suggestions
- Healing history and analytics
- Manual override option
- Confidence score display
- DOM change adaptation

### Intelligent Root Cause Analysis
- Cluster similar failures across runs
- Pattern identification (network, timing, data issues)
- Code change correlation
- Root cause confidence scoring
- Evidence gathering and display
- Suggested actions
- Historical pattern matching
- Cross-test correlation

### Flaky Test Detection
- Flakiness score calculation (0-1)
- Based on:
  - Pass/fail consistency
  - Retry success rate
  - Time-based patterns
  - Environment correlation
- Flaky tests dashboard
- Trend tracking
- Quarantine recommendations
- Auto-retry configuration per flakiness level

### Failure Prediction
- ML model for failure probability
- Input: Code changes, historical data, time patterns
- Output: Per-test failure probability
- High-risk test prioritization
- Release risk scoring
- Prediction accuracy tracking
- Model retraining pipeline

### Natural Language Test Generation (Beta)
- Plain English test descriptions
- AI-generated Playwright tests
- Test step suggestions
- Coverage gap identification
- Test refinement workflow
- Human review and approval
- Learning from corrections

### Smart Test Prioritization
- Risk-based test ordering
- Changed code path analysis
- Historical failure correlation
- Time-to-feedback optimization
- CI/CD time budget respect

### Anomaly Detection
- Performance anomaly detection
- Error rate spike detection
- Unusual patterns alerting
- Baseline learning
- Seasonal adjustment

### MCP Server v3.0 - AI Tools
- New tools:
  - `analyze-root-cause` - AI root cause analysis
  - `suggest-test-fixes` - AI-suggested test fixes
  - `get-quality-score` - Overall quality health score
  - `analyze-failures` - Structured failure analysis
  - `explain-failure` - Human-readable explanation
  - `get-flaky-tests` - List with flakiness scores
  - `compare-runs` - Compare two test runs
- WebSocket transport for real-time streaming
- Enhanced AI agent workflows

### Additional Phase 4 Items
- Quality health score algorithm
- AI-powered test coverage analysis
- Smart maintenance suggestions
- Performance drift detection
- Deprecated API detection

---

## Phase 5: Enterprise (Year 2)

**Goal**: Enterprise-ready features and scale

### SSO/Identity (Keycloak)
- SAML 2.0 support
- OpenID Connect (OIDC) support
- LDAP/Active Directory integration
- Google Workspace SSO
- Microsoft Azure AD SSO
- Okta integration
- Multi-factor authentication (MFA)
- Session management
- JIT (Just-In-Time) provisioning

### Advanced RBAC
- Custom role creation
- Granular permission system
- Resource-level permissions
- Project-level role assignment
- Permission inheritance
- Role templates
- Permission audit view

### Audit Logging
- Comprehensive event capture:
  - User authentication (login, logout, failed)
  - Resource access
  - Configuration changes
  - API key usage
  - Data exports
- Structured log format (JSON)
- Log retention policies (configurable, default 2 years)
- Log search and filtering
- Export capabilities
- Compliance report generation
- Integration with SIEM systems

### SOC 2 Type II Certification
- Security controls implementation
- Availability controls
- Processing integrity
- Confidentiality measures
- Privacy compliance
- Annual audit process

### Self-Hosted Deployment
- Docker Compose setup
- Kubernetes Helm charts
- Air-gapped installation support
- Offline documentation
- Self-update mechanism
- Health monitoring
- Backup/restore procedures
- Configuration management

### Hybrid Deployment
- Control plane SaaS
- On-premise test execution agents
- Secure agent communication
- Agent management UI
- Agent health monitoring

### Mobile App Testing
- OpenSTF (DeviceFarmer) integration
- Real device farm management
- Docker Android emulators
- Appium integration
- Mobile test recording
- Device reservation system
- Parallel mobile execution
- iOS Simulator support (macOS agents)

### Contract Testing
- Pact integration
- Consumer-driven contracts
- Provider verification
- Contract versioning
- Breaking change detection

### Chaos Engineering
- Litmus Chaos integration
- Chaos Mesh support
- Experiment templates
- Failure injection:
  - Network latency
  - Service failure
  - Resource exhaustion
- Gameday scheduling
- Blast radius control
- Rollback mechanisms

### Additional Enterprise Features
- Custom branding (white-label)
- Dedicated support tiers
- Custom SLAs
- Training and onboarding programs
- Professional services
- Data residency options (US, EU, UK, APAC)
- Custom integrations
- API rate limit customization
- Cost allocation and chargeback
- Cross-organization dashboards

---

## Quick Reference: Feature Counts by Phase

| Phase | Estimated Features | Cumulative |
|-------|-------------------|------------|
| Phase 1 (Foundation) | ~200 | 200 |
| Phase 2 (Testing Expansion + MCP) | ~80-100 | 280-300 |
| Phase 3 (Security + Monitoring) | ~70-90 | 350-390 |
| Phase 4 (AI & Intelligence) | ~50-70 | 400-460 |
| Phase 5 (Enterprise) | ~60-80 | 460-540 |

---

## How to Use This Document

When running `/expand-project`, reference this document to:

1. **Start a phase**: "I want to start Phase X"
2. **Add specific features**: "Add the Visual Regression features from Phase 2"
3. **Partial expansion**: "Just add the MCP v2.0 tools from Phase 3"

The assistant will use this breakdown to create detailed, testable features for the kanban board.

---

*Last Updated: 2026-01-13*
*Source: QA Guardian PRD v1.4.0*
