/**
 * SAST Core Routes
 *
 * Core SAST scanning and configuration routes including:
 * - Configuration management (GET/PUT /sast/config)
 * - Available rulesets (GET /sast/rulesets)
 * - Scan triggering (POST /sast/scan)
 * - Scan listing and details (GET /sast/scans, GET /sast/scans/:scanId)
 * - Organization dashboard (GET /sast/dashboard)
 * - Trending analytics (GET /sast/trends)
 *
 * Extracted from sast.ts (Feature #1376)
 */

import { FastifyInstance } from 'fastify';
import { authenticate, JwtPayload } from '../../middleware/auth';
import { getProject, listProjects } from '../../services/repositories/projects';
import { logAuditEntry } from '../audit-logs';

import {
  SASTSeverity,
  SASTConfig,
  SASTFinding,
  SASTScanResult,
} from './types';

import {
  getSASTConfig,
  updateSASTConfig,
  createSastScan,
  getSastScan,
  getSastScansByProject,
  getFalsePositives,
  generateId,
} from './stores';

/**
 * Simulate Semgrep scan (in production, would call actual Semgrep CLI)
 */
async function runSemgrepScan(
  projectId: string,
  repoPath: string,
  config: SASTConfig
): Promise<SASTFinding[]> {
  // In production, would execute:
  // semgrep --config=p/security-audit --json --output=results.json /path/to/repo

  // For development, simulate findings based on config
  const simulatedFindings: SASTFinding[] = [];

  // Simulate findings for demonstration
  if (config.ruleset === 'security' || config.ruleset === 'default' || config.ruleset === 'custom') {
    simulatedFindings.push(
      {
        id: generateId(),
        ruleId: 'javascript.express.security.audit.xss.mustache-escape',
        ruleName: 'Potential XSS via unescaped output',
        severity: 'CRITICAL',
        category: 'security',
        message: 'User input is rendered without proper escaping, potentially allowing XSS attacks.',
        filePath: 'src/components/UserInput.tsx',
        line: 42,
        column: 10,
        snippet: 'dangerouslySetInnerHTML={{ __html: userContent }}',
        cweId: 'CWE-79',
        owaspCategory: 'A7:2017-Cross-Site Scripting (XSS)',
        suggestion: 'Use a sanitization library like DOMPurify before rendering user content.',
        remediation: {
          summary: 'Sanitize user-supplied HTML content before rendering to prevent XSS attacks.',
          steps: [
            'Install DOMPurify: npm install dompurify @types/dompurify',
            'Import DOMPurify at the top of your file',
            'Wrap user content with DOMPurify.sanitize() before rendering',
            'Consider using a Content Security Policy (CSP) header as defense-in-depth',
            'Test sanitization with common XSS payloads'
          ],
          secureCodeExample: {
            before: 'dangerouslySetInnerHTML={{ __html: userContent }}',
            after: `import DOMPurify from 'dompurify';

// Sanitize before rendering
const sanitizedContent = DOMPurify.sanitize(userContent);
<div dangerouslySetInnerHTML={{ __html: sanitizedContent }} />`,
            language: 'typescript'
          },
          references: [
            { title: 'OWASP XSS Prevention Cheat Sheet', url: 'https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html' },
            { title: 'DOMPurify Documentation', url: 'https://github.com/cure53/DOMPurify' },
            { title: 'CWE-79: Improper Neutralization of Input', url: 'https://cwe.mitre.org/data/definitions/79.html' }
          ]
        }
      },
      {
        id: generateId(),
        ruleId: 'javascript.express.security.audit.sqli',
        ruleName: 'Potential SQL Injection',
        severity: 'CRITICAL',
        category: 'security',
        message: 'User-controlled data is used in SQL query without proper parameterization.',
        filePath: 'src/api/users.ts',
        line: 87,
        column: 5,
        snippet: 'db.query(`SELECT * FROM users WHERE id = ${userId}`)',
        cweId: 'CWE-89',
        owaspCategory: 'A1:2017-Injection',
        suggestion: 'Use parameterized queries: db.query("SELECT * FROM users WHERE id = $1", [userId])',
        remediation: {
          summary: 'Replace string interpolation with parameterized queries to prevent SQL injection attacks.',
          steps: [
            'Replace template literals with parameterized query syntax',
            'Use $1, $2, etc. as placeholders for user-supplied values',
            'Pass values as an array in the second argument',
            'Validate and sanitize user input before use',
            'Consider using an ORM like Prisma or TypeORM for safer queries'
          ],
          secureCodeExample: {
            before: 'db.query(`SELECT * FROM users WHERE id = ${userId}`)',
            after: `// Use parameterized queries
const result = await db.query(
  'SELECT * FROM users WHERE id = $1',
  [userId]
);

// Or use an ORM
const user = await prisma.user.findUnique({
  where: { id: userId }
});`,
            language: 'typescript'
          },
          references: [
            { title: 'OWASP SQL Injection Prevention Cheat Sheet', url: 'https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html' },
            { title: 'CWE-89: SQL Injection', url: 'https://cwe.mitre.org/data/definitions/89.html' },
            { title: 'Node-postgres Parameterized Queries', url: 'https://node-postgres.com/features/queries#parameterized-query' }
          ]
        }
      },
      {
        id: generateId(),
        ruleId: 'javascript.jwt.security.audit.jwt-hardcoded',
        ruleName: 'Hardcoded JWT Secret',
        severity: 'HIGH',
        category: 'security',
        message: 'JWT secret is hardcoded in the source code.',
        filePath: 'src/auth/jwt.ts',
        line: 15,
        column: 20,
        snippet: 'const JWT_SECRET = "my-secret-key-123"',
        cweId: 'CWE-798',
        owaspCategory: 'A3:2017-Sensitive Data Exposure',
        suggestion: 'Store secrets in environment variables or a secrets manager.',
        remediation: {
          summary: 'Move JWT secrets to environment variables and use a secrets manager in production.',
          steps: [
            'Add JWT_SECRET to your .env file (never commit this file)',
            'Update your code to read from process.env.JWT_SECRET',
            'Add JWT_SECRET to .env.example with a placeholder value',
            'Generate a strong random secret (at least 256 bits)',
            'In production, use a secrets manager like AWS Secrets Manager or HashiCorp Vault'
          ],
          secureCodeExample: {
            before: 'const JWT_SECRET = "my-secret-key-123"',
            after: `// Read from environment variable
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

// Use a strong random secret (generate with: openssl rand -base64 32)`,
            language: 'typescript'
          },
          references: [
            { title: 'OWASP Cryptographic Storage Cheat Sheet', url: 'https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html' },
            { title: 'CWE-798: Hard-coded Credentials', url: 'https://cwe.mitre.org/data/definitions/798.html' },
            { title: 'dotenv Documentation', url: 'https://github.com/motdotla/dotenv' }
          ]
        }
      }
    );
  }

  // Add broken authentication finding
  simulatedFindings.push({
    id: generateId(),
    ruleId: 'javascript.express.security.audit.broken-auth',
    ruleName: 'Broken Authentication',
    severity: 'HIGH',
    category: 'security',
    message: 'Authentication uses weak comparison that can be bypassed. Using == instead of secure comparison.',
    filePath: 'src/auth/login.ts',
    line: 25,
    column: 8,
    snippet: 'if (user.password == inputPassword) { /* vulnerable */ }',
    cweId: 'CWE-287',
    owaspCategory: 'A2:2017-Broken Authentication',
    suggestion: 'Use bcrypt.compare() or similar secure password comparison. Never compare passwords directly.',
  });

  // Add more warning-level findings
  simulatedFindings.push(
    {
      id: generateId(),
      ruleId: 'javascript.lang.security.audit.path-traversal',
      ruleName: 'Potential Path Traversal',
      severity: 'MEDIUM',
      category: 'security',
      message: 'User input used in file path without validation.',
      filePath: 'src/api/files.ts',
      line: 33,
      column: 15,
      snippet: 'const filePath = path.join(uploadDir, req.params.filename)',
      cweId: 'CWE-22',
      owaspCategory: 'A5:2017-Broken Access Control',
      suggestion: 'Validate and sanitize the filename to prevent directory traversal attacks.',
    },
    {
      id: generateId(),
      ruleId: 'javascript.express.security.insecure-cookie',
      ruleName: 'Insecure Cookie Configuration',
      severity: 'MEDIUM',
      category: 'security',
      message: 'Cookie is set without secure flag.',
      filePath: 'src/middleware/session.ts',
      line: 22,
      column: 5,
      snippet: 'res.cookie("session", token, { httpOnly: true })',
      cweId: 'CWE-614',
      suggestion: 'Add secure: true and sameSite: "strict" to cookie options.',
    }
  );

  // Add info-level finding
  simulatedFindings.push({
    id: generateId(),
    ruleId: 'javascript.lang.best-practice.no-console',
    ruleName: 'Console statement in production code',
    severity: 'LOW',
    category: 'best-practice',
    message: 'Console statements should be removed in production code.',
    filePath: 'src/utils/debug.ts',
    line: 5,
    column: 1,
    snippet: 'console.log("Debug:", data)',
    suggestion: 'Use a proper logging library with log levels.',
  });

  // Process custom rules and add simulated findings
  if (config.customRulesYaml && config.customRulesYaml.length > 0) {
    for (const customRule of config.customRulesYaml) {
      if (!customRule.enabled) continue;

      // Simulate finding from custom rule
      // In production, the YAML would be passed to Semgrep CLI
      simulatedFindings.push({
        id: generateId(),
        ruleId: `custom.${customRule.id}`,
        ruleName: customRule.name,
        severity: 'MEDIUM',  // Default severity for custom rules
        category: 'custom',
        message: `Custom rule "${customRule.name}" detected a potential issue.`,
        filePath: 'src/custom/detected.ts',
        line: Math.floor(Math.random() * 100) + 1,
        column: 1,
        snippet: '// Code matching custom pattern',
        suggestion: 'Review the code and apply organization-specific remediation.',
      });
    }
  }

  // Filter by severity threshold
  const severityOrder: Record<SASTSeverity, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  const threshold = severityOrder[config.severityThreshold];

  const filteredByThreshold = simulatedFindings.filter(f => severityOrder[f.severity] >= threshold);

  // Mark findings that are false positives
  const projectFPs = await getFalsePositives(projectId);
  return filteredByThreshold.map(finding => {
    const isFP = projectFPs.some(fp =>
      fp.ruleId === finding.ruleId &&
      fp.filePath === finding.filePath &&
      fp.line === finding.line
    );
    return { ...finding, isFalsePositive: isFP };
  });
}

/**
 * Register core SAST routes
 */
export async function coreRoutes(app: FastifyInstance) {
  // Get SAST configuration for a project
  app.get<{ Params: { projectId: string } }>('/api/v1/projects/:projectId/sast/config', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { projectId } = request.params;
    const user = request.user as JwtPayload;

    // Check project exists and user has access
    const project = await getProject(projectId);
    if (!project) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
    }

    if (project.organization_id !== user.organization_id) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
    }

    const config = await getSASTConfig(projectId);
    return { config };
  });

  // Update SAST configuration for a project
  app.put<{ Params: { projectId: string }; Body: Partial<SASTConfig> }>('/api/v1/projects/:projectId/sast/config', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { projectId } = request.params;
    const user = request.user as JwtPayload;
    const updates = request.body;

    // Check permissions (only developers or higher can modify)
    if (user.role === 'viewer') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Viewers cannot modify SAST configuration' });
    }

    // Check project exists and user has access
    const project = await getProject(projectId);
    if (!project) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
    }

    if (project.organization_id !== user.organization_id) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
    }

    const config = await updateSASTConfig(projectId, updates);

    // Log audit entry
    logAuditEntry(
      request,
      'sast_config_update',
      'project',
      projectId,
      project.name,
      {
        enabled: config.enabled,
        ruleset: config.ruleset,
        severityThreshold: config.severityThreshold,
      }
    );

    return { config };
  });

  // Get available Semgrep rulesets
  app.get('/api/v1/sast/rulesets', {
    preHandler: [authenticate],
  }, async () => {
    return {
      rulesets: [
        { id: 'default', name: 'Default', description: 'General security and code quality rules' },
        { id: 'security', name: 'Security Audit', description: 'Comprehensive security vulnerability detection' },
        { id: 'owasp', name: 'OWASP Top 10', description: 'Rules targeting OWASP Top 10 vulnerabilities' },
        { id: 'secrets', name: 'Secrets Detection', description: 'Detect hardcoded secrets and credentials' },
        { id: 'ci', name: 'CI/CD', description: 'Optimized ruleset for CI/CD pipelines' },
      ],
    };
  });

  // Trigger a SAST scan for a project
  app.post<{ Params: { projectId: string }; Body: { branch?: string } }>('/api/v1/projects/:projectId/sast/scan', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { projectId } = request.params;
    const { branch = 'main' } = request.body || {};
    const user = request.user as JwtPayload;

    // Check permissions
    if (user.role === 'viewer') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Viewers cannot trigger SAST scans' });
    }

    // Check project exists and user has access
    const project = await getProject(projectId);
    if (!project) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
    }

    if (project.organization_id !== user.organization_id) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
    }

    const config = await getSASTConfig(projectId);

    // Create scan record
    const scanId = generateId();
    const scan: SASTScanResult = {
      id: scanId,
      projectId,
      branch,
      status: 'running',
      startedAt: new Date().toISOString(),
      findings: [],
      summary: {
        total: 0,
        bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
        byCategory: {},
      },
    };

    // Store scan via async DB
    await createSastScan(scan);

    // Update config with scan status
    await updateSASTConfig(projectId, { lastScanAt: scan.startedAt, lastScanStatus: 'running' });

    // Run scan asynchronously
    (async () => {
      try {
        const findings = await runSemgrepScan(projectId, '/tmp/repo', config);

        // Calculate summary
        const summary = {
          total: findings.length,
          bySeverity: {
            critical: findings.filter(f => f.severity === 'CRITICAL').length,
            high: findings.filter(f => f.severity === 'HIGH').length,
            medium: findings.filter(f => f.severity === 'MEDIUM').length,
            low: findings.filter(f => f.severity === 'LOW').length,
          },
          byCategory: findings.reduce((acc, f) => {
            acc[f.category] = (acc[f.category] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
        };

        // Update scan result
        scan.status = 'completed';
        scan.completedAt = new Date().toISOString();
        scan.findings = findings;
        scan.summary = summary;

        await updateSASTConfig(projectId, { lastScanStatus: 'completed' });
      } catch (error) {
        scan.status = 'failed';
        scan.completedAt = new Date().toISOString();
        scan.error = error instanceof Error ? error.message : 'Unknown error';

        await updateSASTConfig(projectId, { lastScanStatus: 'failed' });
      }
    })();

    // Log audit entry
    logAuditEntry(
      request,
      'sast_scan_triggered',
      'project',
      projectId,
      project.name,
      { scanId, branch }
    );

    return {
      message: 'SAST scan started',
      scanId,
      status: 'running',
    };
  });

  // ========== Organization-wide Security Dashboard ==========

  // Get all SAST findings across all projects in the organization
  app.get<{
    Querystring: {
      severity?: string;
      category?: string;
      sortBy?: 'date' | 'severity' | 'project';
      sortOrder?: 'asc' | 'desc';
      limit?: string;
      offset?: string;
    };
  }>('/api/v1/sast/dashboard', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const {
      severity,
      category,
      sortBy = 'date',
      sortOrder = 'desc',
      limit = '50',
      offset = '0',
    } = request.query;

    const limitNum = parseInt(limit, 10);
    const offsetNum = parseInt(offset, 10);

    // Get all projects in the user's organization
    const orgProjectsList = await listProjects(user.organization_id);
    const orgProjects = orgProjectsList.map(p => ({ id: p.id, name: p.name, slug: p.slug }));

    // Collect all findings from all projects
    interface DashboardFinding {
      id: string;
      projectId: string;
      projectName: string;
      projectSlug: string;
      scanId: string;
      scanDate: string;
      ruleId: string;
      ruleName: string;
      severity: SASTSeverity;
      category: string;
      message: string;
      filePath: string;
      line: number;
      column?: number;
      snippet?: string;
      cweId?: string;
      owaspCategory?: string;
      suggestion?: string;
      isFalsePositive?: boolean;
    }

    const allFindings: DashboardFinding[] = [];

    for (const project of orgProjects) {
      const projectScans = await getSastScansByProject(project.id);
      // Get the most recent completed scan for each project
      const latestScan = projectScans.find(s => s.status === 'completed');
      if (latestScan) {
        for (const finding of latestScan.findings) {
          allFindings.push({
            ...finding,
            projectId: project.id,
            projectName: project.name,
            projectSlug: project.slug,
            scanId: latestScan.id,
            scanDate: latestScan.completedAt || latestScan.startedAt,
          });
        }
      }
    }

    // Apply filters
    let filteredFindings = allFindings;

    if (severity) {
      const severities = severity.toUpperCase().split(',');
      filteredFindings = filteredFindings.filter(f => severities.includes(f.severity));
    }

    if (category) {
      const categories = category.toLowerCase().split(',');
      filteredFindings = filteredFindings.filter(f => categories.includes(f.category.toLowerCase()));
    }

    // Apply sorting
    const severityOrder: Record<SASTSeverity, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

    filteredFindings.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'severity':
          comparison = severityOrder[b.severity] - severityOrder[a.severity];
          break;
        case 'project':
          comparison = a.projectName.localeCompare(b.projectName);
          break;
        case 'date':
        default:
          comparison = new Date(b.scanDate).getTime() - new Date(a.scanDate).getTime();
          break;
      }
      return sortOrder === 'asc' ? -comparison : comparison;
    });

    // Calculate summary stats
    const summary = {
      total: filteredFindings.length,
      bySeverity: {
        critical: filteredFindings.filter(f => f.severity === 'CRITICAL').length,
        high: filteredFindings.filter(f => f.severity === 'HIGH').length,
        medium: filteredFindings.filter(f => f.severity === 'MEDIUM').length,
        low: filteredFindings.filter(f => f.severity === 'LOW').length,
      },
      byCategory: filteredFindings.reduce((acc, f) => {
        acc[f.category] = (acc[f.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      projectsScanned: (await Promise.all(orgProjects.map(async p => (await getSastScansByProject(p.id)).some(s => s.status === 'completed')))).filter(Boolean).length,
      totalProjects: orgProjects.length,
      falsePositives: filteredFindings.filter(f => f.isFalsePositive).length,
    };

    // Apply pagination
    const paginatedFindings = filteredFindings.slice(offsetNum, offsetNum + limitNum);

    return {
      findings: paginatedFindings,
      summary,
      pagination: {
        total: filteredFindings.length,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < filteredFindings.length,
      },
    };
  });

  // Get SAST trend data over time
  app.get<{
    Querystring: {
      days?: string;
    };
  }>('/api/v1/sast/trends', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const days = parseInt(request.query.days || '30', 10);

    // Get all projects in the user's organization
    const orgProjectsList2 = await listProjects(user.organization_id);
    const orgProjects = orgProjectsList2.map(p => ({ id: p.id, name: p.name }));

    // Collect all completed scans from all projects
    interface ScanDataPoint {
      date: string;
      scanId: string;
      projectId: string;
      projectName: string;
      total: number;
      critical: number;
      high: number;
      medium: number;
      low: number;
    }

    const allScans: ScanDataPoint[] = [];

    for (const project of orgProjects) {
      const projectScans = await getSastScansByProject(project.id);
      for (const scan of projectScans) {
        if (scan.status === 'completed' && scan.completedAt) {
          allScans.push({
            date: scan.completedAt,
            scanId: scan.id,
            projectId: project.id,
            projectName: project.name,
            total: scan.summary.total,
            critical: scan.summary.bySeverity.critical,
            high: scan.summary.bySeverity.high,
            medium: scan.summary.bySeverity.medium,
            low: scan.summary.bySeverity.low,
          });
        }
      }
    }

    // Sort by date ascending
    allScans.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Filter to requested time range
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const filteredScans = allScans.filter(s => new Date(s.date) >= cutoffDate);

    // Aggregate by day for the chart
    const dailyTrends: Record<string, {
      date: string;
      total: number;
      critical: number;
      high: number;
      medium: number;
      low: number;
      scanCount: number;
    }> = {};

    for (const scan of filteredScans) {
      const dateKey = new Date(scan.date).toISOString().split('T')[0] ?? ''; // YYYY-MM-DD
      if (!dailyTrends[dateKey]) {
        dailyTrends[dateKey] = {
          date: dateKey,
          total: 0,
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          scanCount: 0,
        };
      }
      // Use the latest scan values for the day (cumulative view)
      const dayTrend = dailyTrends[dateKey]!;
      dayTrend.total = scan.total;
      dayTrend.critical = scan.critical;
      dayTrend.high = scan.high;
      dayTrend.medium = scan.medium;
      dayTrend.low = scan.low;
      dayTrend.scanCount++;
    }

    // Convert to array and sort by date
    const trendData = Object.values(dailyTrends).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Calculate overall stats
    const lastScan = filteredScans[filteredScans.length - 1];
    const latestTotals = lastScan
      ? {
          total: lastScan.total,
          critical: lastScan.critical,
          high: lastScan.high,
          medium: lastScan.medium,
          low: lastScan.low,
        }
      : { total: 0, critical: 0, high: 0, medium: 0, low: 0 };

    const firstScan = filteredScans[0];
    const firstTotals = firstScan
      ? {
          total: firstScan.total,
          critical: firstScan.critical,
          high: firstScan.high,
          medium: firstScan.medium,
          low: firstScan.low,
        }
      : { total: 0, critical: 0, high: 0, medium: 0, low: 0 };

    // Calculate change percentages
    const calculateChange = (latest: number, first: number) => {
      if (first === 0) return latest > 0 ? 100 : 0;
      return Math.round(((latest - first) / first) * 100);
    };

    return {
      trends: trendData,
      summary: {
        totalScans: filteredScans.length,
        latestFindings: latestTotals,
        changes: {
          total: calculateChange(latestTotals.total, firstTotals.total),
          critical: calculateChange(latestTotals.critical, firstTotals.critical),
          high: calculateChange(latestTotals.high, firstTotals.high),
          medium: calculateChange(latestTotals.medium, firstTotals.medium),
          low: calculateChange(latestTotals.low, firstTotals.low),
        },
      },
      scans: filteredScans,
    };
  });

  // Get scan results for a project
  app.get<{ Params: { projectId: string }; Querystring: { limit?: string } }>('/api/v1/projects/:projectId/sast/scans', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { projectId } = request.params;
    const limit = parseInt(request.query.limit || '10', 10);
    const user = request.user as JwtPayload;

    // Check project exists and user has access
    const project = await getProject(projectId);
    if (!project) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
    }

    if (project.organization_id !== user.organization_id) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
    }

    const allScans = await getSastScansByProject(projectId);
    const scans = allScans.slice(0, limit);
    return { scans };
  });

  // Get a specific scan result
  app.get<{ Params: { projectId: string; scanId: string } }>('/api/v1/projects/:projectId/sast/scans/:scanId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { projectId, scanId } = request.params;
    const user = request.user as JwtPayload;

    // Check project exists and user has access
    const project = await getProject(projectId);
    if (!project) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
    }

    if (project.organization_id !== user.organization_id) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
    }

    const scan = await getSastScan(scanId);

    if (!scan) {
      return reply.status(404).send({ error: 'Not Found', message: 'Scan not found' });
    }

    return { scan };
  });
}
