---
name: bmad-devops-analyze
description: Run a comprehensive DevOps analysis of the project
---

# DevOps Analysis Workflow

You are performing a comprehensive DevOps analysis. Follow each section systematically.

## Instructions

1. Load and read {project-root}/_bmad/bmm/config.yaml for project settings
2. Analyze the following areas and produce a structured report

## Analysis Areas

### 1. Docker & Container Architecture
- Review all Dockerfiles (backend, frontend, worker)
- Review docker-compose*.yml files
- Check image sizes, multi-stage builds, layer optimization
- Evaluate health checks and restart policies
- Check resource limits and reservations

### 2. CI/CD Pipeline
- Review .github/workflows/*.yml
- Check build efficiency (caching, parallelism)
- Evaluate deployment strategy (zero-downtime, rollback)
- Review secret management
- Check test coverage in pipeline

### 3. Infrastructure & Networking
- Review Traefik configuration and routing
- Check network isolation (internal vs external)
- Evaluate SSL/TLS setup
- Review DNS configuration
- Check firewall rules and port exposure

### 4. Monitoring & Observability
- Review health check endpoints
- Check logging configuration
- Evaluate alerting setup
- Review error tracking (Sentry, webhooks)
- Check resource monitoring

### 5. Security
- Review secret management (.env, GitHub Secrets)
- Check container security (non-root, capabilities)
- Evaluate network security (exposed ports, CORS)
- Review authentication and authorization
- Check dependency vulnerability management

### 6. Reliability & Disaster Recovery
- Review backup strategy and automation
- Check failover procedures
- Evaluate data persistence (volumes, backups)
- Review incident response documentation
- Check SLO/SLA definitions

## Output

Save the analysis report to: {project-root}/_bmad-output/planning-artifacts/devops-analysis-report.md

Format as a structured markdown document with:
- Executive summary
- Findings by area (with severity: Critical/High/Medium/Low)
- Recommendations prioritized by impact
- Quick wins (can be done immediately)
- Strategic improvements (require planning)
