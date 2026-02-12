/**
 * Quick Test Wave 6: API Discovery
 * Feature #681: Extracted from quick-test-runner.ts
 *
 * OpenAPI spec detection, endpoint health, auth checks (3-10s)
 * Feature #472: API endpoint discovery and basic health testing
 * Feature #480: SSRF re-validation and body size limits
 */

import https from 'https';
import http from 'http';
import { URL } from 'url';
import { createLogger } from '../logger.js';
import { validateURLForSSRF } from '../../utils/index.js';
import { parseOpenAPISpec } from '../openapi-parser.js';
import type { APIEndpoint, APIDiscoveryResult } from './types.js';

const log = createLogger('quick-test-api-discovery');

// Feature #480: Body size limit for API Discovery responses (prevent memory exhaustion)
const API_DISCOVERY_BODY_LIMIT = 10240; // 10KB

// Common API paths to probe
const commonApiPaths = [
  '/api',
  '/api/v1',
  '/api/v2',
  '/v1',
  '/v2',
  '/graphql',
  '/rest',
];

// OpenAPI/Swagger spec paths
const openApiPaths = [
  '/swagger.json',
  '/openapi.json',
  '/api-docs',
  '/api/docs',
  '/swagger',
  '/docs/api',
  '/.well-known/openapi.yaml',
  '/openapi.yaml',
  '/swagger.yaml',
];

// Sensitive/admin paths that should require auth
const sensitivePaths = [
  '/api/admin',
  '/api/users',
  '/api/config',
  '/api/settings',
  '/api/internal',
  '/admin/api',
  '/management',
  '/actuator',
  '/metrics',
  '/health',
  '/api/health',
];

/**
 * Helper: Make HTTP request and return response info
 * Feature #480: Added SSRF re-validation before each request
 */
async function probeEndpoint(endpointUrl: string, method: 'GET' | 'HEAD' = 'HEAD'): Promise<{
  status: number;
  statusText: string;
  responseTimeMs: number;
  contentType?: string;
  error?: string;
  body?: string;
}> {
  const start = Date.now();
  try {
    // Feature #480: Re-validate constructed URL against SSRF rules
    // This is critical because the URL may be constructed from user input + paths
    const ssrfValidation = validateURLForSSRF(endpointUrl, {
      requireHttps: false,
      allowLocalhost: process.env.NODE_ENV !== 'production',
    });

    if (!ssrfValidation.safe) {
      log.warn({ url: endpointUrl, error: ssrfValidation.error }, 'SSRF validation failed for probe URL');
      return {
        status: 0,
        statusText: '',
        responseTimeMs: Date.now() - start,
        error: `SSRF protection: ${ssrfValidation.error}`,
      };
    }

    const probeUrl = new URL(endpointUrl);
    const isHttps = probeUrl.protocol === 'https:';
    const client = isHttps ? https : http;

    return await new Promise((resolve) => {
      const req = client.request(endpointUrl, {
        method,
        timeout: 5000, // 5 second timeout
        headers: {
          'User-Agent': 'QA-Guardian-API-Discovery/1.0',
          'Accept': 'application/json, application/yaml, */*',
        },
      }, (res) => {
        let body = '';
        let bodySize = 0;

        res.on('data', (chunk) => {
          // Feature #480: Enforce body size limit to prevent memory exhaustion
          bodySize += chunk.length;
          if (bodySize <= API_DISCOVERY_BODY_LIMIT) {
            body += chunk;
          }
        });

        res.on('end', () => {
          resolve({
            status: res.statusCode || 0,
            statusText: res.statusMessage || '',
            responseTimeMs: Date.now() - start,
            contentType: res.headers['content-type'],
            body: method === 'GET' ? body.slice(0, API_DISCOVERY_BODY_LIMIT) : undefined,
          });
        });
      });

      req.on('error', (err) => {
        resolve({
          status: 0,
          statusText: '',
          responseTimeMs: Date.now() - start,
          error: err.message,
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          status: 0,
          statusText: '',
          responseTimeMs: Date.now() - start,
          error: 'Request timeout',
        });
      });

      req.end();
    });
  } catch (err) {
    return {
      status: 0,
      statusText: '',
      responseTimeMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Feature #472: API endpoint discovery and basic health testing
 * Probes common API paths, looks for OpenAPI specs, and tests endpoint health
 */
export async function runAPIDiscovery(url: string): Promise<APIDiscoveryResult> {
  const result: APIDiscoveryResult = {
    score: 0,
    discoveredPaths: [],
    endpoints: [],
    summary: {
      total: 0,
      healthy: 0,
      unhealthy: 0,
      protected: 0,
      unprotected: 0,
      byMethod: {},
    },
    securityConcerns: [],
  };

  const parsedUrl = new URL(url);
  const baseUrl = parsedUrl.origin;

  // Step 1: Probe for OpenAPI/Swagger specs
  log.info({ url }, 'Probing for OpenAPI specs...');
  for (const specPath of openApiPaths) {
    const specUrl = `${baseUrl}${specPath}`;
    const probe = await probeEndpoint(specUrl, 'GET');

    if (probe.status === 200 && probe.body) {
      // Try to parse as OpenAPI spec
      const parseResult = parseOpenAPISpec(probe.body);
      if (parseResult.success && parseResult.spec) {
        result.openAPISpec = {
          found: true,
          url: specUrl,
          title: parseResult.title,
          version: parseResult.version,
          endpointCount: parseResult.endpoints,
        };
        result.discoveredPaths.push(specPath);
        log.info({ specUrl, title: parseResult.title, endpoints: parseResult.endpoints }, 'Found OpenAPI spec');

        // Extract endpoints from spec
        for (const [path, pathItem] of Object.entries(parseResult.spec.paths)) {
          const methods = ['get', 'post', 'put', 'patch', 'delete'] as const;
          for (const method of methods) {
            if (pathItem[method]) {
              result.endpoints.push({
                path,
                method: method.toUpperCase(),
                status: 0, // Will be tested below
                statusText: 'Pending',
                responseTimeMs: 0,
                authRequired: false,
                isHealthy: false,
              });
            }
          }
        }
        break; // Stop after finding first valid spec
      }
    }
  }

  // Step 2: Probe common API paths
  log.info({ url }, 'Probing common API paths...');
  for (const apiPath of commonApiPaths) {
    const apiUrl = `${baseUrl}${apiPath}`;
    const probe = await probeEndpoint(apiUrl);

    if (probe.status > 0 && probe.status !== 404) {
      result.discoveredPaths.push(apiPath);

      const endpoint: APIEndpoint = {
        path: apiPath,
        method: 'HEAD',
        status: probe.status,
        statusText: probe.statusText,
        responseTimeMs: probe.responseTimeMs,
        authRequired: probe.status === 401 || probe.status === 403,
        isHealthy: probe.status >= 200 && probe.status < 400,
        contentType: probe.contentType,
        errorMessage: probe.error,
      };

      // Check if this is in our endpoints list from OpenAPI
      const existingIdx = result.endpoints.findIndex(e => e.path === apiPath);
      if (existingIdx >= 0) {
        result.endpoints[existingIdx] = { ...result.endpoints[existingIdx], ...endpoint };
      } else {
        result.endpoints.push(endpoint);
      }
    }
  }

  // Step 3: Check sensitive paths for auth
  log.info({ url }, 'Checking sensitive paths for auth protection...');
  for (const sensitivePath of sensitivePaths) {
    const sensitiveUrl = `${baseUrl}${sensitivePath}`;
    const probe = await probeEndpoint(sensitiveUrl);

    if (probe.status > 0 && probe.status !== 404) {
      result.discoveredPaths.push(sensitivePath);

      const authRequired = probe.status === 401 || probe.status === 403;
      const isHealthy = probe.status >= 200 && probe.status < 400;

      const endpoint: APIEndpoint = {
        path: sensitivePath,
        method: 'HEAD',
        status: probe.status,
        statusText: probe.statusText,
        responseTimeMs: probe.responseTimeMs,
        authRequired,
        isHealthy,
        contentType: probe.contentType,
        errorMessage: probe.error,
      };

      result.endpoints.push(endpoint);

      // Flag security concern if sensitive endpoint returns 200 without auth
      if (isHealthy && !authRequired) {
        result.securityConcerns.push({
          type: 'unprotected_sensitive',
          path: sensitivePath,
          description: `Sensitive endpoint ${sensitivePath} returns ${probe.status} without authentication`,
          severity: sensitivePath.includes('admin') || sensitivePath.includes('config') ? 'high' : 'medium',
        });
      }
    }
  }

  // Step 4: Test a sample of discovered endpoints for health
  if (result.endpoints.length > 0) {
    log.info({ count: result.endpoints.length }, 'Testing endpoint health...');
    const endpointsToTest = result.endpoints.slice(0, 20); // Limit to 20 endpoints

    for (const endpoint of endpointsToTest) {
      if (endpoint.status === 0 || endpoint.statusText === 'Pending') {
        const testUrl = `${baseUrl}${endpoint.path}`;
        const probe = await probeEndpoint(testUrl);

        endpoint.status = probe.status;
        endpoint.statusText = probe.statusText;
        endpoint.responseTimeMs = probe.responseTimeMs;
        endpoint.authRequired = probe.status === 401 || probe.status === 403;
        endpoint.isHealthy = probe.status >= 200 && probe.status < 400;
        endpoint.contentType = probe.contentType;
        endpoint.errorMessage = probe.error;
      }
    }
  }

  // Calculate summary
  result.summary.total = result.endpoints.length;
  result.summary.healthy = result.endpoints.filter(e => e.isHealthy).length;
  result.summary.unhealthy = result.endpoints.filter(e => !e.isHealthy && e.status > 0).length;
  result.summary.protected = result.endpoints.filter(e => e.authRequired).length;
  result.summary.unprotected = result.endpoints.filter(e => e.isHealthy && !e.authRequired).length;

  // Count by method
  for (const endpoint of result.endpoints) {
    result.summary.byMethod[endpoint.method] = (result.summary.byMethod[endpoint.method] || 0) + 1;
  }

  // Calculate API Discovery score
  // Base score: 50 (neutral)
  // +20 if OpenAPI spec found
  // +15 if all sensitive endpoints are protected
  // +15 if endpoints respond healthy
  // -10 for each high severity security concern
  // -5 for each medium severity security concern
  let score = 50;

  if (result.openAPISpec?.found) {
    score += 20; // Good API documentation
  }

  const sensitiveEndpoints = result.endpoints.filter(e =>
    sensitivePaths.some(sp => e.path.includes(sp.replace('/api', '')))
  );
  const protectedSensitive = sensitiveEndpoints.filter(e => e.authRequired);
  if (sensitiveEndpoints.length > 0 && protectedSensitive.length === sensitiveEndpoints.length) {
    score += 15; // All sensitive endpoints protected
  } else if (sensitiveEndpoints.length > 0) {
    const protectionRatio = protectedSensitive.length / sensitiveEndpoints.length;
    score += Math.round(15 * protectionRatio);
  }

  if (result.summary.total > 0) {
    const healthRatio = result.summary.healthy / result.summary.total;
    score += Math.round(15 * healthRatio);
  }

  // Deduct for security concerns
  for (const concern of result.securityConcerns) {
    if (concern.severity === 'high') score -= 10;
    else if (concern.severity === 'medium') score -= 5;
    else score -= 2;
  }

  result.score = Math.max(0, Math.min(100, score));

  log.info({
    score: result.score,
    discoveredPaths: result.discoveredPaths.length,
    endpoints: result.summary.total,
    openAPIFound: result.openAPISpec?.found || false,
    securityConcerns: result.securityConcerns.length,
  }, 'API Discovery complete');

  return result;
}
