/**
 * Services Status Routes - Feature #2127
 *
 * GET /api/v1/services/status - Health check all platform services
 * Returns status, latency, version, capability matrix per service.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate, JwtPayload, getOrganizationId } from '../middleware/auth';
import { isDatabaseConnected, healthCheck as dbHealthCheck } from '../services/database';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Module-level Socket.IO reference (set from index.ts after server starts)
let socketIORef: any = null;

export function setServicesSocketIO(io: any) {
  socketIORef = io;
}

type ServiceStatus = 'healthy' | 'degraded' | 'unavailable' | 'not_configured';

interface ServiceCapability {
  name: string;
  status: 'implemented' | 'simulated' | 'planned' | 'not_available';
}

interface ServiceInfo {
  name: string;
  category: string;
  status: ServiceStatus;
  latency_ms: number | null;
  version: string | null;
  last_checked: string;
  error?: string;
  capabilities: ServiceCapability[];
  config_hints?: string[];
}

// Helper: time an async operation
async function timedCheck<T>(fn: () => Promise<T>): Promise<{ result: T; latency_ms: number }> {
  const start = Date.now();
  const result = await fn();
  return { result, latency_ms: Date.now() - start };
}

// Helper: run a command with timeout
async function runCommand(cmd: string, timeoutMs = 5000): Promise<{ stdout: string; stderr: string }> {
  return execAsync(cmd, { timeout: timeoutMs });
}

// ---------- Individual service checks ----------

async function checkPostgres(): Promise<ServiceInfo> {
  const last_checked = new Date().toISOString();
  try {
    const { result: dbCheck, latency_ms } = await timedCheck(() => dbHealthCheck());
    const connected = isDatabaseConnected();
    return {
      name: 'PostgreSQL',
      category: 'Infrastructure',
      status: connected && dbCheck.status === 'ok' ? 'healthy' : connected ? 'degraded' : 'unavailable',
      latency_ms,
      version: null,
      last_checked,
      error: dbCheck.error || undefined,
      capabilities: [
        { name: 'Data Persistence', status: connected ? 'implemented' : 'not_available' },
        { name: 'Query Execution', status: connected ? 'implemented' : 'not_available' },
        { name: 'Connection Pooling', status: connected ? 'implemented' : 'not_available' },
        { name: 'Migrations', status: 'implemented' },
      ],
      config_hints: ['DATABASE_URL'],
    };
  } catch (err: any) {
    return {
      name: 'PostgreSQL',
      category: 'Infrastructure',
      status: 'unavailable',
      latency_ms: null,
      version: null,
      last_checked,
      error: err.message,
      capabilities: [
        { name: 'Data Persistence', status: 'not_available' },
        { name: 'Query Execution', status: 'not_available' },
        { name: 'Connection Pooling', status: 'not_available' },
        { name: 'Migrations', status: 'implemented' },
      ],
      config_hints: ['DATABASE_URL'],
    };
  }
}

async function checkRedis(): Promise<ServiceInfo> {
  const last_checked = new Date().toISOString();
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return {
      name: 'Redis',
      category: 'Infrastructure',
      status: 'not_configured',
      latency_ms: null,
      version: null,
      last_checked,
      capabilities: [
        { name: 'Caching', status: 'planned' },
        { name: 'Queue Management', status: 'planned' },
        { name: 'Session Store', status: 'planned' },
        { name: 'Pub/Sub', status: 'planned' },
      ],
      config_hints: ['REDIS_URL'],
    };
  }
  // Try a simple TCP connect to Redis port
  try {
    const url = new URL(redisUrl);
    const net = require('net');
    const start = Date.now();
    const connected = await new Promise<boolean>((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(3000);
      socket.on('connect', () => { socket.destroy(); resolve(true); });
      socket.on('timeout', () => { socket.destroy(); resolve(false); });
      socket.on('error', () => { socket.destroy(); resolve(false); });
      socket.connect(parseInt(url.port || '6379'), url.hostname || 'localhost');
    });
    const latency_ms = Date.now() - start;
    return {
      name: 'Redis',
      category: 'Infrastructure',
      status: connected ? 'healthy' : 'unavailable',
      latency_ms: connected ? latency_ms : null,
      version: null,
      last_checked,
      capabilities: [
        { name: 'Caching', status: connected ? 'implemented' : 'planned' },
        { name: 'Queue Management', status: 'planned' },
        { name: 'Session Store', status: 'planned' },
        { name: 'Pub/Sub', status: 'planned' },
      ],
      config_hints: ['REDIS_URL'],
    };
  } catch (err: any) {
    return {
      name: 'Redis',
      category: 'Infrastructure',
      status: 'unavailable',
      latency_ms: null,
      version: null,
      last_checked,
      error: err.message,
      capabilities: [
        { name: 'Caching', status: 'planned' },
        { name: 'Queue Management', status: 'planned' },
        { name: 'Session Store', status: 'planned' },
        { name: 'Pub/Sub', status: 'planned' },
      ],
      config_hints: ['REDIS_URL'],
    };
  }
}

async function checkMinIO(): Promise<ServiceInfo> {
  const last_checked = new Date().toISOString();
  const endpoint = process.env.STORAGE_ENDPOINT;
  const port = process.env.STORAGE_PORT;
  if (!endpoint) {
    return {
      name: 'MinIO / S3',
      category: 'Infrastructure',
      status: 'not_configured',
      latency_ms: null,
      version: null,
      last_checked,
      capabilities: [
        { name: 'Artifact Storage', status: 'implemented' },
        { name: 'Screenshot Storage', status: 'implemented' },
        { name: 'Visual Baselines', status: 'implemented' },
        { name: 'Report Export', status: 'implemented' },
      ],
      config_hints: ['STORAGE_ENDPOINT', 'STORAGE_PORT', 'STORAGE_ACCESS_KEY', 'STORAGE_SECRET_KEY'],
    };
  }
  try {
    const http = require('http');
    const start = Date.now();
    const reachable = await new Promise<boolean>((resolve) => {
      const req = http.get(`http://${endpoint}:${port || 9000}/minio/health/live`, { timeout: 3000 }, (res: any) => {
        resolve(res.statusCode < 500);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
    });
    const latency_ms = Date.now() - start;
    return {
      name: 'MinIO / S3',
      category: 'Infrastructure',
      status: reachable ? 'healthy' : 'unavailable',
      latency_ms: reachable ? latency_ms : null,
      version: null,
      last_checked,
      capabilities: [
        { name: 'Artifact Storage', status: 'implemented' },
        { name: 'Screenshot Storage', status: 'implemented' },
        { name: 'Visual Baselines', status: 'implemented' },
        { name: 'Report Export', status: 'implemented' },
      ],
      config_hints: ['STORAGE_ENDPOINT', 'STORAGE_PORT', 'STORAGE_ACCESS_KEY', 'STORAGE_SECRET_KEY'],
    };
  } catch (err: any) {
    return {
      name: 'MinIO / S3',
      category: 'Infrastructure',
      status: 'unavailable',
      latency_ms: null,
      version: null,
      last_checked,
      error: err.message,
      capabilities: [
        { name: 'Artifact Storage', status: 'implemented' },
        { name: 'Screenshot Storage', status: 'implemented' },
        { name: 'Visual Baselines', status: 'implemented' },
        { name: 'Report Export', status: 'implemented' },
      ],
      config_hints: ['STORAGE_ENDPOINT', 'STORAGE_PORT', 'STORAGE_ACCESS_KEY', 'STORAGE_SECRET_KEY'],
    };
  }
}

async function checkPlaywright(): Promise<ServiceInfo> {
  const last_checked = new Date().toISOString();
  try {
    const { stdout } = await runCommand('npx playwright --version 2>/dev/null || echo "not_found"');
    const version = stdout.trim();
    const available = version !== 'not_found' && version.length > 0;
    return {
      name: 'Playwright',
      category: 'Testing Tools',
      status: available ? 'healthy' : 'unavailable',
      latency_ms: null,
      version: available ? version : null,
      last_checked,
      capabilities: [
        { name: 'E2E Testing', status: 'implemented' },
        { name: 'Visual Regression', status: 'implemented' },
        { name: 'Cross-Browser Testing', status: 'implemented' },
        { name: 'Screenshot Capture', status: 'implemented' },
        { name: 'Video Recording', status: 'implemented' },
        { name: 'Network Interception', status: 'implemented' },
        { name: 'Test Recording', status: 'implemented' },
      ],
    };
  } catch {
    return {
      name: 'Playwright',
      category: 'Testing Tools',
      status: 'unavailable',
      latency_ms: null,
      version: null,
      last_checked,
      capabilities: [
        { name: 'E2E Testing', status: 'implemented' },
        { name: 'Visual Regression', status: 'implemented' },
        { name: 'Cross-Browser Testing', status: 'implemented' },
        { name: 'Screenshot Capture', status: 'implemented' },
        { name: 'Video Recording', status: 'implemented' },
        { name: 'Network Interception', status: 'implemented' },
        { name: 'Test Recording', status: 'implemented' },
      ],
    };
  }
}

async function checkK6(): Promise<ServiceInfo> {
  const last_checked = new Date().toISOString();
  try {
    const { stdout } = await runCommand('k6 version 2>/dev/null || echo "not_found"');
    const version = stdout.trim();
    const available = version !== 'not_found' && version.length > 0 && version.includes('k6');
    return {
      name: 'k6',
      category: 'Testing Tools',
      status: available ? 'healthy' : 'unavailable',
      latency_ms: null,
      version: available ? version.replace('k6 ', '') : null,
      last_checked,
      capabilities: [
        { name: 'Load Testing', status: 'implemented' },
        { name: 'Stress Testing', status: 'implemented' },
        { name: 'Spike Testing', status: 'implemented' },
        { name: 'Soak Testing', status: 'implemented' },
        { name: 'Custom Scenarios', status: 'implemented' },
        { name: 'Thresholds', status: 'implemented' },
      ],
    };
  } catch {
    return {
      name: 'k6',
      category: 'Testing Tools',
      status: 'unavailable',
      latency_ms: null,
      version: null,
      last_checked,
      capabilities: [
        { name: 'Load Testing', status: 'implemented' },
        { name: 'Stress Testing', status: 'implemented' },
        { name: 'Spike Testing', status: 'implemented' },
        { name: 'Soak Testing', status: 'implemented' },
        { name: 'Custom Scenarios', status: 'implemented' },
        { name: 'Thresholds', status: 'implemented' },
      ],
    };
  }
}

async function checkLighthouse(): Promise<ServiceInfo> {
  const last_checked = new Date().toISOString();
  try {
    const { stdout } = await runCommand('npx lighthouse --version 2>/dev/null || echo "not_found"');
    const version = stdout.trim();
    const available = version !== 'not_found' && version.length > 0 && /^\d/.test(version);
    return {
      name: 'Lighthouse',
      category: 'Testing Tools',
      status: available ? 'healthy' : 'unavailable',
      latency_ms: null,
      version: available ? version : null,
      last_checked,
      capabilities: [
        { name: 'Performance Audits', status: 'implemented' },
        { name: 'Accessibility Audits', status: 'implemented' },
        { name: 'SEO Audits', status: 'implemented' },
        { name: 'Best Practices', status: 'implemented' },
        { name: 'PWA Checks', status: 'implemented' },
        { name: 'Core Web Vitals', status: 'implemented' },
      ],
    };
  } catch {
    return {
      name: 'Lighthouse',
      category: 'Testing Tools',
      status: 'unavailable',
      latency_ms: null,
      version: null,
      last_checked,
      capabilities: [
        { name: 'Performance Audits', status: 'implemented' },
        { name: 'Accessibility Audits', status: 'implemented' },
        { name: 'SEO Audits', status: 'implemented' },
        { name: 'Best Practices', status: 'implemented' },
        { name: 'PWA Checks', status: 'implemented' },
        { name: 'Core Web Vitals', status: 'implemented' },
      ],
    };
  }
}

async function checkGitleaks(): Promise<ServiceInfo> {
  const last_checked = new Date().toISOString();
  try {
    const { stdout } = await runCommand('gitleaks version 2>/dev/null || echo "not_found"');
    const version = stdout.trim();
    const available = version !== 'not_found' && version.length > 0;
    return {
      name: 'Gitleaks',
      category: 'Security Scanners',
      status: available ? 'healthy' : 'unavailable',
      latency_ms: null,
      version: available ? version : null,
      last_checked,
      capabilities: [
        { name: 'Secret Detection', status: 'implemented' },
        { name: 'Custom Rules', status: 'implemented' },
        { name: 'Git History Scan', status: 'implemented' },
        { name: 'Pre-commit Hook', status: 'planned' },
      ],
    };
  } catch {
    return {
      name: 'Gitleaks',
      category: 'Security Scanners',
      status: 'unavailable',
      latency_ms: null,
      version: null,
      last_checked,
      capabilities: [
        { name: 'Secret Detection', status: 'implemented' },
        { name: 'Custom Rules', status: 'implemented' },
        { name: 'Git History Scan', status: 'implemented' },
        { name: 'Pre-commit Hook', status: 'planned' },
      ],
    };
  }
}

async function checkSemgrep(): Promise<ServiceInfo> {
  const last_checked = new Date().toISOString();
  try {
    const { stdout } = await runCommand('semgrep --version 2>/dev/null || echo "not_found"');
    const version = stdout.trim();
    const available = version !== 'not_found' && version.length > 0 && /^\d/.test(version);
    return {
      name: 'Semgrep',
      category: 'Security Scanners',
      status: available ? 'healthy' : 'unavailable',
      latency_ms: null,
      version: available ? version : null,
      last_checked,
      capabilities: [
        { name: 'SAST Scanning', status: 'implemented' },
        { name: 'Custom Rules', status: 'implemented' },
        { name: 'Multi-Language Support', status: 'implemented' },
        { name: 'CI Integration', status: 'planned' },
      ],
    };
  } catch {
    return {
      name: 'Semgrep',
      category: 'Security Scanners',
      status: 'unavailable',
      latency_ms: null,
      version: null,
      last_checked,
      capabilities: [
        { name: 'SAST Scanning', status: 'implemented' },
        { name: 'Custom Rules', status: 'implemented' },
        { name: 'Multi-Language Support', status: 'implemented' },
        { name: 'CI Integration', status: 'planned' },
      ],
    };
  }
}

async function checkZAP(): Promise<ServiceInfo> {
  const last_checked = new Date().toISOString();
  // ZAP is typically run via Docker
  try {
    const { stdout } = await runCommand('docker ps --filter "name=zap" --format "{{.Status}}" 2>/dev/null || echo "not_found"');
    const status = stdout.trim();
    const running = status !== 'not_found' && status.length > 0 && status.includes('Up');
    return {
      name: 'OWASP ZAP',
      category: 'Security Scanners',
      status: running ? 'healthy' : 'unavailable',
      latency_ms: null,
      version: null,
      last_checked,
      capabilities: [
        { name: 'DAST Scanning', status: 'implemented' },
        { name: 'Active Scan', status: 'implemented' },
        { name: 'Passive Scan', status: 'implemented' },
        { name: 'Spider/Crawler', status: 'implemented' },
        { name: 'API Scanning', status: 'implemented' },
        { name: 'Authentication Testing', status: 'implemented' },
      ],
    };
  } catch {
    return {
      name: 'OWASP ZAP',
      category: 'Security Scanners',
      status: 'unavailable',
      latency_ms: null,
      version: null,
      last_checked,
      capabilities: [
        { name: 'DAST Scanning', status: 'implemented' },
        { name: 'Active Scan', status: 'implemented' },
        { name: 'Passive Scan', status: 'implemented' },
        { name: 'Spider/Crawler', status: 'implemented' },
        { name: 'API Scanning', status: 'implemented' },
        { name: 'Authentication Testing', status: 'implemented' },
      ],
    };
  }
}

async function checkAIProviders(): Promise<ServiceInfo[]> {
  const last_checked = new Date().toISOString();
  const services: ServiceInfo[] = [];

  // Kie.ai
  const kieKey = process.env.KIE_API_KEY;
  services.push({
    name: 'Kie.ai',
    category: 'AI & Integration',
    status: kieKey && kieKey.length > 0 ? 'healthy' : 'not_configured',
    latency_ms: null,
    version: null,
    last_checked,
    capabilities: [
      { name: 'Test Generation', status: kieKey ? 'implemented' : 'not_available' },
      { name: 'Root Cause Analysis', status: kieKey ? 'implemented' : 'not_available' },
      { name: 'Test Healing', status: kieKey ? 'implemented' : 'not_available' },
      { name: 'MCP Chat', status: kieKey ? 'implemented' : 'not_available' },
      { name: 'Code Analysis', status: kieKey ? 'implemented' : 'not_available' },
    ],
    config_hints: ['KIE_API_KEY'],
  });

  // Anthropic
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  services.push({
    name: 'Anthropic (Claude)',
    category: 'AI & Integration',
    status: anthropicKey && anthropicKey.length > 0 ? 'healthy' : 'not_configured',
    latency_ms: null,
    version: null,
    last_checked,
    capabilities: [
      { name: 'Test Generation', status: anthropicKey ? 'implemented' : 'not_available' },
      { name: 'Root Cause Analysis', status: anthropicKey ? 'implemented' : 'not_available' },
      { name: 'Test Healing', status: anthropicKey ? 'implemented' : 'not_available' },
      { name: 'MCP Chat', status: anthropicKey ? 'implemented' : 'not_available' },
      { name: 'Code Analysis', status: anthropicKey ? 'implemented' : 'not_available' },
    ],
    config_hints: ['ANTHROPIC_API_KEY'],
  });

  return services;
}

function checkGitHubOAuth(): ServiceInfo {
  const last_checked = new Date().toISOString();
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const configured = !!(clientId && clientId.length > 0 && clientSecret && clientSecret.length > 0);
  return {
    name: 'GitHub OAuth',
    category: 'AI & Integration',
    status: configured ? 'healthy' : 'not_configured',
    latency_ms: null,
    version: null,
    last_checked,
    capabilities: [
      { name: 'OAuth Sign-In', status: configured ? 'implemented' : 'not_available' },
      { name: 'Repository Access', status: configured ? 'implemented' : 'not_available' },
      { name: 'Webhook Integration', status: configured ? 'implemented' : 'not_available' },
      { name: 'PR Integration', status: configured ? 'implemented' : 'not_available' },
    ],
    config_hints: ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'],
  };
}

function checkMCPServer(): ServiceInfo {
  const last_checked = new Date().toISOString();
  // MCP server runs as part of this backend
  return {
    name: 'MCP Server',
    category: 'AI & Integration',
    status: 'healthy',
    latency_ms: 0,
    version: '1.0.0',
    last_checked,
    capabilities: [
      { name: 'Tool Execution', status: 'implemented' },
      { name: 'AI Chat Interface', status: 'implemented' },
      { name: 'Tool Discovery', status: 'implemented' },
      { name: 'Multi-turn Conversations', status: 'implemented' },
      { name: '170+ MCP Tools', status: 'implemented' },
    ],
  };
}

function checkSocketIO(io: any): ServiceInfo {
  const last_checked = new Date().toISOString();
  const active = !!io;
  return {
    name: 'Socket.IO',
    category: 'Real-Time',
    status: active ? 'healthy' : 'unavailable',
    latency_ms: null,
    version: null,
    last_checked,
    capabilities: [
      { name: 'Real-Time Test Updates', status: 'implemented' },
      { name: 'Live Run Monitoring', status: 'implemented' },
      { name: 'Organization Rooms', status: 'implemented' },
      { name: 'Run-Specific Rooms', status: 'implemented' },
    ],
  };
}

// ========== Route Registration ==========

export async function servicesStatusRoutes(fastify: FastifyInstance) {
  // GET /api/v1/services/status
  fastify.get('/api/v1/services/status', {
    preHandler: [authenticate],
    schema: {
      description: 'Get health status and capabilities of all platform services',
      tags: ['Services'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            overall_status: { type: 'string' },
            total_services: { type: 'number' },
            healthy_count: { type: 'number' },
            degraded_count: { type: 'number' },
            unavailable_count: { type: 'number' },
            not_configured_count: { type: 'number' },
            checked_at: { type: 'string' },
            services: { type: 'array' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    // Run all health checks concurrently for speed
    const [
      postgres,
      redis,
      minio,
      playwright,
      k6,
      lighthouse,
      gitleaks,
      semgrep,
      zap,
      aiProviders,
      socketIO,
    ] = await Promise.all([
      checkPostgres(),
      checkRedis(),
      checkMinIO(),
      checkPlaywright(),
      checkK6(),
      checkLighthouse(),
      checkGitleaks(),
      checkSemgrep(),
      checkZAP(),
      checkAIProviders(),
      Promise.resolve(checkSocketIO(socketIORef)),
    ]);

    const github = checkGitHubOAuth();
    const mcp = checkMCPServer();

    const allServices: ServiceInfo[] = [
      postgres,
      redis,
      minio,
      playwright,
      k6,
      lighthouse,
      gitleaks,
      semgrep,
      zap,
      ...aiProviders,
      github,
      mcp,
      socketIO,
    ];

    const healthy_count = allServices.filter(s => s.status === 'healthy').length;
    const degraded_count = allServices.filter(s => s.status === 'degraded').length;
    const unavailable_count = allServices.filter(s => s.status === 'unavailable').length;
    const not_configured_count = allServices.filter(s => s.status === 'not_configured').length;

    let overall_status: string;
    if (degraded_count > 0) {
      overall_status = 'degraded';
    } else if (unavailable_count > allServices.length / 2) {
      overall_status = 'critical';
    } else {
      overall_status = 'operational';
    }

    return {
      overall_status,
      total_services: allServices.length,
      healthy_count,
      degraded_count,
      unavailable_count,
      not_configured_count,
      checked_at: new Date().toISOString(),
      services: allServices,
    };
  });
}
