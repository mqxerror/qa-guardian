/**
 * Test Simulation Routes Module (Feature #1356)
 *
 * This module contains routes for simulating various error conditions
 * in development mode. These routes are ONLY available in non-production environments.
 *
 * Features covered:
 * - Feature #604: Storage quota exceeded simulation
 * - Feature #606: Browser crash simulation (visual)
 * - Feature #607: Oversized page simulation
 * - Feature #608: Lighthouse unreachable URL simulation
 * - Feature #609: SSL error simulation
 * - Feature #610: Auth redirect simulation
 * - Feature #611: Audit timeout simulation
 * - Feature #612: Lighthouse browser crash simulation
 * - Feature #613: Non-HTML response simulation
 * - Feature #615: K6 runtime error simulation
 * - Feature #616: K6 server unavailable simulation
 * - Feature #617: K6 resource exhaustion simulation
 */

import { FastifyInstance } from 'fastify';
import fs from 'fs';
import path from 'path';
import { authenticate, getOrganizationId } from '../../middleware/auth';
import {
  setSimulatedStorageQuotaExceeded,
  getSimulatedStorageQuotaExceeded,
} from './storage';
import { getBaselinePath } from './visual-regression';
import { failedUploads } from './baseline-routes';

// ============================================
// Simulation State Variables
// ============================================
// These are exported as mutable objects so they can be accessed/modified from test-runs.ts

// Feature #606: Allow simulating browser crash for testing
export const simulatedBrowserCrashState = { enabled: false };

// Feature #607: Allow simulating oversized page for testing memory protection
export const simulatedOversizedPageState = {
  enabled: false,
  dimensions: {
    width: 1920,
    height: 50000, // Exceeds MAX_PAGE_HEIGHT_FOR_FULL_CAPTURE (32000)
    scrollWidth: 1920,
    scrollHeight: 50000,
  },
};

// Feature #608: Allow simulating unreachable URL for testing Lighthouse error handling
export let simulatedLighthouseError: {
  enabled: boolean;
  errorType?: 'dns_resolution' | 'connection_timeout' | 'connection_refused' | 'ssl_error' | 'unreachable';
  sslErrorCode?: 'CERT_HAS_EXPIRED' | 'CERT_AUTHORITY_INVALID' | 'CERT_COMMON_NAME_INVALID' | 'CERT_REVOKED' | 'SSL_VERSION_OR_CIPHER_MISMATCH' | 'CERT_WEAK_KEY';
} = { enabled: false };

// Feature #610: Allow simulating authentication redirect for testing
export let simulatedAuthRedirect: {
  enabled: boolean;
  redirectUrl?: string;
} = { enabled: false };

// Feature #611: Allow simulating audit timeout for testing
export let simulatedAuditTimeout: {
  enabled: boolean;
  partialMetrics?: {
    performance?: number;
    accessibility?: number;
    firstContentfulPaint?: number;
  };
} = { enabled: false };

// Feature #612: Allow simulating browser crash during Lighthouse audit for testing
export let simulatedLighthouseBrowserCrash: {
  enabled: boolean;
  retryCount?: number; // Track retries to simulate recovery or persistent failure
} = { enabled: false };

// Feature #613: Allow simulating non-HTML response for Lighthouse audit testing
export let simulatedLighthouseNonHtmlResponse: {
  enabled: boolean;
  contentType?: string; // e.g., 'application/json', 'image/png'
} = { enabled: false };

// Feature #615: Allow simulating K6 script runtime errors for testing
export let simulatedK6RuntimeError: {
  enabled: boolean;
  errorType?: 'null_reference' | 'type_error' | 'undefined_access' | 'custom';
  errorMessage?: string;
  scriptLocation?: {
    line: number;
    column?: number;
    functionName?: string;
  };
} = { enabled: false };

// Feature #616: Allow simulating target server unavailable for K6 testing
export let simulatedK6ServerUnavailable: {
  enabled: boolean;
  errorType?: 'connection_refused' | 'host_unreachable' | 'network_error' | 'timeout';
  failureRate?: number; // 0-100 percentage of requests that fail
} = { enabled: false };

// Feature #617: Allow simulating resource exhaustion during K6 test
export let simulatedK6ResourceExhaustion: {
  enabled: boolean;
  resourceType?: 'memory' | 'cpu' | 'file_descriptors' | 'threads';
  abortAfterPercent?: number; // 0-100 percentage of test completion before abort
  peakUsage?: {
    memory_mb?: number;
    cpu_percent?: number;
    open_files?: number;
    threads?: number;
  };
} = { enabled: false };

// Feature #606: Crash dumps directory
const CRASH_DUMPS_DIR = path.join(process.cwd(), 'crash-dumps');
if (!fs.existsSync(CRASH_DUMPS_DIR)) {
  fs.mkdirSync(CRASH_DUMPS_DIR, { recursive: true });
}

// ============================================
// Getters for simulation state (used by other modules)
// ============================================

export function getSimulatedBrowserCrash(): boolean {
  return simulatedBrowserCrashState.enabled;
}

export function setSimulatedBrowserCrash(value: boolean): void {
  simulatedBrowserCrashState.enabled = value;
}

export function getSimulatedOversizedPage(): { enabled: boolean; dimensions: typeof simulatedOversizedPageState.dimensions } {
  return { enabled: simulatedOversizedPageState.enabled, dimensions: simulatedOversizedPageState.dimensions };
}

export function setSimulatedOversizedPage(enabled: boolean, dimensions?: Partial<typeof simulatedOversizedPageState.dimensions>): void {
  simulatedOversizedPageState.enabled = enabled;
  if (dimensions) {
    simulatedOversizedPageState.dimensions = { ...simulatedOversizedPageState.dimensions, ...dimensions };
  }
}

export function getSimulatedLighthouseError() {
  return simulatedLighthouseError;
}

export function setSimulatedLighthouseError(error: typeof simulatedLighthouseError): void {
  simulatedLighthouseError = error;
}

export function getSimulatedAuthRedirect() {
  return simulatedAuthRedirect;
}

export function setSimulatedAuthRedirect(redirect: typeof simulatedAuthRedirect): void {
  simulatedAuthRedirect = redirect;
}

export function getSimulatedAuditTimeout() {
  return simulatedAuditTimeout;
}

export function setSimulatedAuditTimeout(timeout: typeof simulatedAuditTimeout): void {
  simulatedAuditTimeout = timeout;
}

export function getSimulatedLighthouseBrowserCrash() {
  return simulatedLighthouseBrowserCrash;
}

export function setSimulatedLighthouseBrowserCrash(crash: typeof simulatedLighthouseBrowserCrash): void {
  simulatedLighthouseBrowserCrash = crash;
}

export function getSimulatedLighthouseNonHtmlResponse() {
  return simulatedLighthouseNonHtmlResponse;
}

export function setSimulatedLighthouseNonHtmlResponse(response: typeof simulatedLighthouseNonHtmlResponse): void {
  simulatedLighthouseNonHtmlResponse = response;
}

export function getSimulatedK6RuntimeError() {
  return simulatedK6RuntimeError;
}

export function setSimulatedK6RuntimeError(error: typeof simulatedK6RuntimeError): void {
  simulatedK6RuntimeError = error;
}

export function getSimulatedK6ServerUnavailable() {
  return simulatedK6ServerUnavailable;
}

export function setSimulatedK6ServerUnavailable(unavailable: typeof simulatedK6ServerUnavailable): void {
  simulatedK6ServerUnavailable = unavailable;
}

export function getSimulatedK6ResourceExhaustion() {
  return simulatedK6ResourceExhaustion;
}

export function setSimulatedK6ResourceExhaustion(exhaustion: typeof simulatedK6ResourceExhaustion): void {
  simulatedK6ResourceExhaustion = exhaustion;
}

export function getCrashDumpsDir(): string {
  return CRASH_DUMPS_DIR;
}

// ============================================
// Route Registration
// ============================================

/**
 * Register test simulation routes (development only)
 * These routes are used for testing error handling scenarios
 */
export async function testSimulationRoutes(app: FastifyInstance): Promise<void> {
  // Only register routes in non-production environments
  if (process.env.NODE_ENV === 'production') {
    console.log('[Test Simulation] Routes disabled in production');
    return;
  }

  console.log('[Test Simulation] Registering development-only test simulation routes');

  // ============================================
  // Visual Test Simulation Routes
  // ============================================

  // Simulate network failure for testing upload failures
  app.post<{ Body: { testId: string; viewportId?: string; branch?: string; simulatedError?: string } }>(
    '/api/v1/visual/test-upload-failure',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { testId, viewportId = 'default', branch = 'main', simulatedError } = request.body;
      const orgId = getOrganizationId(request);

      // Create a test screenshot buffer
      const testBuffer = Buffer.from('test-screenshot-data-for-failure-simulation');

      // Store as failed upload
      const failedUploadId = `${testId}-${viewportId}-${branch}-${Date.now()}`;
      failedUploads.set(failedUploadId, {
        id: failedUploadId,
        testId,
        viewportId,
        branch,
        screenshotBuffer: testBuffer,
        targetPath: getBaselinePath(testId, viewportId, branch),
        error: simulatedError || 'Failed to upload screenshot - network error: Simulated network failure',
        attemptCount: 3,
        createdAt: new Date(),
        organizationId: orgId,
      });

      return {
        success: true,
        message: 'Simulated upload failure created',
        failedUploadId,
        error: simulatedError || 'Failed to upload screenshot - network error: Simulated network failure',
      };
    }
  );

  // Feature #604: Simulate storage quota exceeded
  app.post('/api/v1/visual/test-storage-quota-exceeded', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    setSimulatedStorageQuotaExceeded(true);
    return {
      success: true,
      message: 'Storage quota exceeded simulation enabled',
      simulatedQuotaExceeded: true,
    };
  });

  app.delete('/api/v1/visual/test-storage-quota-exceeded', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    setSimulatedStorageQuotaExceeded(false);
    return {
      success: true,
      message: 'Storage quota exceeded simulation disabled',
      simulatedQuotaExceeded: false,
    };
  });

  app.get('/api/v1/visual/test-storage-quota-exceeded', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    return {
      simulatedQuotaExceeded: getSimulatedStorageQuotaExceeded(),
    };
  });

  // Feature #606: Simulate browser crash during visual test
  app.post('/api/v1/visual/test-browser-crash', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    simulatedBrowserCrashState.enabled = true;
    console.log('[Visual] Browser crash simulation ENABLED');
    return {
      success: true,
      message: 'Browser crash simulation enabled - next visual test will simulate a browser crash',
      simulatedBrowserCrash: true,
    };
  });

  app.delete('/api/v1/visual/test-browser-crash', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    simulatedBrowserCrashState.enabled = false;
    console.log('[Visual] Browser crash simulation DISABLED');
    return {
      success: true,
      message: 'Browser crash simulation disabled',
      simulatedBrowserCrash: false,
    };
  });

  app.get('/api/v1/visual/test-browser-crash', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    return { simulatedBrowserCrash: simulatedBrowserCrashState.enabled };
  });

  // Feature #606: Get crash dumps list
  app.get('/api/v1/visual/crash-dumps', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const files = fs.readdirSync(CRASH_DUMPS_DIR)
        .filter(f => f.endsWith('.json'))
        .sort((a, b) => b.localeCompare(a)); // Most recent first

      const crashDumps = files.slice(0, 20).map(filename => {
        const filepath = path.join(CRASH_DUMPS_DIR, filename);
        const stat = fs.statSync(filepath);
        try {
          const content = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
          return {
            filename,
            created_at: stat.mtime.toISOString(),
            size_bytes: stat.size,
            test_id: content.testId,
            test_name: content.testName,
            run_id: content.runId,
            browser_type: content.browserType,
          };
        } catch {
          return {
            filename,
            created_at: stat.mtime.toISOString(),
            size_bytes: stat.size,
          };
        }
      });

      return {
        crash_dumps: crashDumps,
        count: crashDumps.length,
        total: files.length,
      };
    } catch {
      return {
        crash_dumps: [],
        count: 0,
        total: 0,
      };
    }
  });

  // Feature #606: Get crash dump content
  app.get<{ Params: { filename: string } }>('/api/v1/visual/crash-dumps/:filename', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { filename } = request.params;

    // Security check - only allow .json files from the crash-dumps directory
    if (!filename.endsWith('.json') || filename.includes('..')) {
      reply.status(400);
      return { error: 'Invalid filename' };
    }

    const filepath = path.join(CRASH_DUMPS_DIR, filename);

    if (!fs.existsSync(filepath)) {
      reply.status(404);
      return { error: 'Crash dump not found' };
    }

    try {
      const content = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
      return content;
    } catch {
      reply.status(500);
      return { error: 'Failed to read crash dump' };
    }
  });

  // Feature #607: Simulate oversized page during visual test
  app.post('/api/v1/visual/test-oversized-page', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const body = request.body as { height?: number; width?: number } || {};
    simulatedOversizedPageState.enabled = true;
    simulatedOversizedPageState.dimensions = {
      width: body.width || 1920,
      height: body.height || 50000,
      scrollWidth: body.width || 1920,
      scrollHeight: body.height || 50000,
    };
    console.log(`[Visual] Oversized page simulation ENABLED (${simulatedOversizedPageState.dimensions.width}x${simulatedOversizedPageState.dimensions.height})`);
    return {
      success: true,
      message: 'Oversized page simulation enabled - next visual test will simulate an oversized page',
      simulatedOversizedPage: true,
      dimensions: simulatedOversizedPageState.dimensions,
    };
  });

  app.delete('/api/v1/visual/test-oversized-page', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    simulatedOversizedPageState.enabled = false;
    console.log('[Visual] Oversized page simulation DISABLED');
    return {
      success: true,
      message: 'Oversized page simulation disabled',
      simulatedOversizedPage: false,
    };
  });

  app.get('/api/v1/visual/test-oversized-page', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    return {
      simulatedOversizedPage: simulatedOversizedPageState.enabled,
      dimensions: simulatedOversizedPageState.enabled ? simulatedOversizedPageState.dimensions : null,
    };
  });

  // ============================================
  // Lighthouse Simulation Routes
  // ============================================

  // Feature #608: Simulate unreachable URL during Lighthouse audit
  app.post('/api/v1/lighthouse/test-unreachable-url', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const body = request.body as { errorType?: string; sslErrorCode?: string } || {};
    const validErrorTypes = ['dns_resolution', 'connection_timeout', 'connection_refused', 'ssl_error', 'unreachable'];
    const validSslErrorCodes = ['CERT_HAS_EXPIRED', 'CERT_AUTHORITY_INVALID', 'CERT_COMMON_NAME_INVALID', 'CERT_REVOKED', 'SSL_VERSION_OR_CIPHER_MISMATCH', 'CERT_WEAK_KEY'];
    const errorType = validErrorTypes.includes(body.errorType || '') ? body.errorType : 'dns_resolution';
    const sslErrorCode = validSslErrorCodes.includes(body.sslErrorCode || '') ? body.sslErrorCode : 'CERT_AUTHORITY_INVALID';

    simulatedLighthouseError = {
      enabled: true,
      errorType: errorType as 'dns_resolution' | 'connection_timeout' | 'connection_refused' | 'ssl_error' | 'unreachable',
      ...(errorType === 'ssl_error' ? { sslErrorCode: sslErrorCode as any } : {}),
    };
    console.log(`[Lighthouse] Unreachable URL simulation ENABLED (errorType: ${errorType}${errorType === 'ssl_error' ? `, sslErrorCode: ${sslErrorCode}` : ''})`);

    return {
      success: true,
      message: `Unreachable URL simulation enabled - next Lighthouse audit will simulate ${errorType}${errorType === 'ssl_error' ? ` (${sslErrorCode})` : ''} error`,
      simulatedError: simulatedLighthouseError,
      availableErrorTypes: validErrorTypes,
      availableSslErrorCodes: validSslErrorCodes,
    };
  });

  app.delete('/api/v1/lighthouse/test-unreachable-url', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    simulatedLighthouseError = { enabled: false };
    console.log('[Lighthouse] Unreachable URL simulation DISABLED');
    return {
      success: true,
      message: 'Unreachable URL simulation disabled',
      simulatedError: simulatedLighthouseError,
    };
  });

  app.get('/api/v1/lighthouse/test-unreachable-url', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    return {
      simulatedError: simulatedLighthouseError,
      availableErrorTypes: ['dns_resolution', 'connection_timeout', 'connection_refused', 'ssl_error', 'unreachable'],
    };
  });

  // Feature #610: Enable authentication redirect simulation
  app.post<{ Body: { redirectUrl?: string } }>('/api/v1/lighthouse/test-auth-redirect', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { redirectUrl } = request.body || {};
    simulatedAuthRedirect = {
      enabled: true,
      redirectUrl: redirectUrl || 'http://localhost:5173/login',
    };
    console.log(`[Lighthouse] Auth redirect simulation ENABLED, will redirect to: ${simulatedAuthRedirect.redirectUrl}`);
    return {
      success: true,
      message: 'Auth redirect simulation enabled',
      simulatedRedirect: simulatedAuthRedirect,
    };
  });

  app.delete('/api/v1/lighthouse/test-auth-redirect', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    simulatedAuthRedirect = { enabled: false };
    console.log('[Lighthouse] Auth redirect simulation DISABLED');
    return {
      success: true,
      message: 'Auth redirect simulation disabled',
      simulatedRedirect: simulatedAuthRedirect,
    };
  });

  app.get('/api/v1/lighthouse/test-auth-redirect', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    return { simulatedRedirect: simulatedAuthRedirect };
  });

  // Feature #611: Enable audit timeout simulation
  app.post<{ Body: { partialMetrics?: { performance?: number; accessibility?: number; firstContentfulPaint?: number } } }>(
    '/api/v1/lighthouse/test-audit-timeout',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { partialMetrics } = request.body || {};
      simulatedAuditTimeout = {
        enabled: true,
        partialMetrics: partialMetrics || undefined,
      };
      console.log('[Lighthouse] Audit timeout simulation ENABLED', { partialMetrics });
      return {
        success: true,
        message: 'Audit timeout simulation enabled',
        simulatedTimeout: simulatedAuditTimeout,
      };
    }
  );

  app.delete('/api/v1/lighthouse/test-audit-timeout', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    simulatedAuditTimeout = { enabled: false };
    console.log('[Lighthouse] Audit timeout simulation DISABLED');
    return {
      success: true,
      message: 'Audit timeout simulation disabled',
      simulatedTimeout: simulatedAuditTimeout,
    };
  });

  app.get('/api/v1/lighthouse/test-audit-timeout', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    return { simulatedTimeout: simulatedAuditTimeout };
  });

  // Feature #612: Enable browser crash simulation for Lighthouse
  app.post('/api/v1/lighthouse/test-browser-crash', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    simulatedLighthouseBrowserCrash = {
      enabled: true,
      retryCount: 0,
    };
    console.log('[Lighthouse] Browser crash simulation ENABLED');
    return {
      success: true,
      message: 'Browser crash simulation enabled - next Lighthouse audit will simulate a browser crash',
      simulatedCrash: simulatedLighthouseBrowserCrash,
    };
  });

  app.delete('/api/v1/lighthouse/test-browser-crash', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    simulatedLighthouseBrowserCrash = { enabled: false };
    console.log('[Lighthouse] Browser crash simulation DISABLED');
    return {
      success: true,
      message: 'Browser crash simulation disabled',
      simulatedCrash: simulatedLighthouseBrowserCrash,
    };
  });

  app.get('/api/v1/lighthouse/test-browser-crash', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    return { simulatedCrash: simulatedLighthouseBrowserCrash };
  });

  // Feature #613: Enable non-HTML response simulation for Lighthouse
  app.post<{ Body: { contentType?: string } }>('/api/v1/lighthouse/test-non-html-response', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { contentType } = request.body || {};
    simulatedLighthouseNonHtmlResponse = {
      enabled: true,
      contentType: contentType || 'application/json',
    };
    console.log(`[Lighthouse] Non-HTML response simulation ENABLED with content type: ${simulatedLighthouseNonHtmlResponse.contentType}`);
    return {
      success: true,
      message: `Non-HTML response simulation enabled - next Lighthouse audit will simulate a ${simulatedLighthouseNonHtmlResponse.contentType} response`,
      simulatedNonHtml: simulatedLighthouseNonHtmlResponse,
    };
  });

  app.delete('/api/v1/lighthouse/test-non-html-response', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    simulatedLighthouseNonHtmlResponse = { enabled: false };
    console.log('[Lighthouse] Non-HTML response simulation DISABLED');
    return {
      success: true,
      message: 'Non-HTML response simulation disabled',
      simulatedNonHtml: simulatedLighthouseNonHtmlResponse,
    };
  });

  app.get('/api/v1/lighthouse/test-non-html-response', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    return { simulatedNonHtml: simulatedLighthouseNonHtmlResponse };
  });

  // Feature #612: Get Lighthouse crash dumps list
  app.get('/api/v1/lighthouse/crash-dumps', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const files = fs.readdirSync(CRASH_DUMPS_DIR)
        .filter(f => f.startsWith('lighthouse-crash-') && f.endsWith('.json'))
        .map(filename => {
          const filePath = path.join(CRASH_DUMPS_DIR, filename);
          const stats = fs.statSync(filePath);
          return {
            filename,
            created: stats.birthtime.toISOString(),
            size_bytes: stats.size,
          };
        })
        .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

      return { count: files.length, files };
    } catch (err) {
      return { count: 0, files: [] };
    }
  });

  // Feature #612: Get specific Lighthouse crash dump content
  app.get<{ Params: { filename: string } }>('/api/v1/lighthouse/crash-dumps/:filename', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { filename } = request.params;

    // Validate filename to prevent directory traversal
    if (!filename.startsWith('lighthouse-crash-') || !filename.endsWith('.json') || filename.includes('..')) {
      reply.code(400);
      return { error: 'Invalid crash dump filename' };
    }

    const filePath = path.join(CRASH_DUMPS_DIR, filename);

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (err) {
      reply.code(404);
      return { error: 'Crash dump not found' };
    }
  });

  // ============================================
  // K6 Simulation Routes
  // ============================================

  // Feature #615: Enable K6 runtime error simulation
  app.post<{ Body: { errorType?: 'null_reference' | 'type_error' | 'undefined_access' | 'custom'; errorMessage?: string; line?: number; column?: number; functionName?: string } }>(
    '/api/v1/k6/test-runtime-error',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { errorType, errorMessage, line, column, functionName } = request.body || {};
      simulatedK6RuntimeError = {
        enabled: true,
        errorType: errorType || 'null_reference',
        errorMessage: errorMessage,
        scriptLocation: {
          line: line || 15,
          column: column,
          functionName: functionName,
        },
      };
      console.log(`[K6] Enabled runtime error simulation: ${simulatedK6RuntimeError.errorType}`);
      return {
        message: 'K6 runtime error simulation enabled',
        errorType: simulatedK6RuntimeError.errorType,
        scriptLocation: simulatedK6RuntimeError.scriptLocation,
      };
    }
  );

  app.delete('/api/v1/k6/test-runtime-error', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    simulatedK6RuntimeError = { enabled: false };
    console.log(`[K6] Disabled runtime error simulation`);
    return { message: 'K6 runtime error simulation disabled' };
  });

  app.get('/api/v1/k6/test-runtime-error', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    return { simulatedRuntimeError: simulatedK6RuntimeError };
  });

  // Feature #616: Enable K6 server unavailable simulation
  app.post<{ Body: { errorType?: 'connection_refused' | 'host_unreachable' | 'network_error' | 'timeout'; failureRate?: number } }>(
    '/api/v1/k6/test-server-unavailable',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { errorType, failureRate } = request.body || {};
      simulatedK6ServerUnavailable = {
        enabled: true,
        errorType: errorType || 'connection_refused',
        failureRate: failureRate ?? 95, // Default 95% failure rate
      };
      console.log(`[K6] Enabled server unavailable simulation: ${simulatedK6ServerUnavailable.errorType} with ${simulatedK6ServerUnavailable.failureRate}% failure rate`);
      return {
        message: 'K6 server unavailable simulation enabled',
        errorType: simulatedK6ServerUnavailable.errorType,
        failureRate: simulatedK6ServerUnavailable.failureRate,
      };
    }
  );

  app.delete('/api/v1/k6/test-server-unavailable', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    simulatedK6ServerUnavailable = { enabled: false };
    console.log(`[K6] Disabled server unavailable simulation`);
    return { message: 'K6 server unavailable simulation disabled' };
  });

  app.get('/api/v1/k6/test-server-unavailable', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    return { simulatedServerUnavailable: simulatedK6ServerUnavailable };
  });

  // Feature #617: Enable K6 resource exhaustion simulation
  app.post<{ Body: { resourceType?: 'memory' | 'cpu' | 'file_descriptors' | 'threads'; abortAfterPercent?: number; peakUsage?: { memory_mb?: number; cpu_percent?: number; open_files?: number; threads?: number } } }>(
    '/api/v1/k6/test-resource-exhaustion',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { resourceType, abortAfterPercent, peakUsage } = request.body || {};
      simulatedK6ResourceExhaustion = {
        enabled: true,
        resourceType: resourceType || 'memory',
        abortAfterPercent: abortAfterPercent ?? 65,
        peakUsage: peakUsage,
      };
      console.log(`[K6] Enabled resource exhaustion simulation: ${simulatedK6ResourceExhaustion.resourceType} at ${simulatedK6ResourceExhaustion.abortAfterPercent}%`);
      return {
        message: 'K6 resource exhaustion simulation enabled',
        resourceType: simulatedK6ResourceExhaustion.resourceType,
        abortAfterPercent: simulatedK6ResourceExhaustion.abortAfterPercent,
      };
    }
  );

  app.delete('/api/v1/k6/test-resource-exhaustion', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    simulatedK6ResourceExhaustion = { enabled: false };
    console.log(`[K6] Disabled resource exhaustion simulation`);
    return { message: 'K6 resource exhaustion simulation disabled' };
  });

  app.get('/api/v1/k6/test-resource-exhaustion', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    return { simulatedResourceExhaustion: simulatedK6ResourceExhaustion };
  });

  console.log('[Test Simulation] Registered all development-only test simulation routes');
}
