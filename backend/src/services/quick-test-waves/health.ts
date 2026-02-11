/**
 * Quick Test Wave 1: Health Check
 * Feature #672: Extracted from quick-test-runner.ts
 *
 * DNS, HTTP, SSL, response time, redirects (1-2s)
 */

import dns from 'dns';
import tls from 'tls';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import { isPrivateIP, validateURLForSSRF } from '../../utils/index.js';
import type { HealthCheckResult } from './types.js';

// Feature #433: SSRF protection - check if resolved IPs are private
function validateResolvedIPs(addresses: string[]): { safe: boolean; error?: string } {
  for (const ip of addresses) {
    const result = isPrivateIP(ip);
    if (result.isPrivate) {
      return {
        safe: false,
        error: `DNS resolved to private IP address (${ip}${result.details ? ': ' + result.details : ''})`
      };
    }
  }
  return { safe: true };
}

// Feature #433: SSRF protection - validate redirect URLs
function validateRedirectURL(redirectUrl: string, isProduction: boolean): { safe: boolean; error?: string } {
  const validation = validateURLForSSRF(redirectUrl, {
    requireHttps: false,
    allowLocalhost: !isProduction,
  });
  if (!validation.safe) {
    return { safe: false, error: `Redirect to blocked URL: ${validation.error}` };
  }
  return { safe: true };
}

/**
 * Run health check wave
 * Checks DNS resolution, SSL certificate, HTTP status, and follows redirects
 */
export async function runHealthCheck(url: string): Promise<HealthCheckResult> {
  const parsedUrl = new URL(url);
  const isHttps = parsedUrl.protocol === 'https:';
  const hostname = parsedUrl.hostname;
  const port = parsedUrl.port || (isHttps ? 443 : 80);

  const result: HealthCheckResult = {
    dns: { resolved: false, durationMs: 0 },
    http: { status: 0, statusText: '', headers: {}, durationMs: 0 },
    redirects: [],
    totalDurationMs: 0,
  };

  const totalStart = Date.now();

  // DNS Resolution with SSRF protection (Feature #433)
  const dnsStart = Date.now();
  const isProduction = process.env.NODE_ENV === 'production';
  try {
    const addresses = await dns.promises.resolve4(hostname);

    // Feature #433: Validate resolved IPs are not private/internal
    const ipValidation = validateResolvedIPs(addresses);
    if (!ipValidation.safe) {
      result.dns = {
        resolved: false,
        error: ipValidation.error || 'DNS resolved to private IP address',
        durationMs: Date.now() - dnsStart,
      };
      // Stop further processing - this is an SSRF attempt
      result.totalDurationMs = Date.now() - totalStart;
      throw new Error(ipValidation.error || 'SSRF protection: DNS resolved to private IP');
    }

    result.dns = {
      resolved: true,
      addresses,
      durationMs: Date.now() - dnsStart,
    };
  } catch (err) {
    result.dns = {
      resolved: false,
      error: err instanceof Error ? err.message : 'DNS resolution failed',
      durationMs: Date.now() - dnsStart,
    };
    // If DNS validation failed due to private IP, re-throw to stop processing
    if (err instanceof Error && err.message.includes('SSRF protection')) {
      throw err;
    }
  }

  // SSL Certificate Check (if HTTPS)
  if (isHttps) {
    const sslStart = Date.now();
    try {
      const sslResult = await new Promise<Omit<NonNullable<HealthCheckResult['ssl']>, 'durationMs'>>((resolve, reject) => {
        const socket = tls.connect(
          { host: hostname, port: Number(port), servername: hostname },
          () => {
            const cert = socket.getPeerCertificate();
            if (cert && cert.valid_to) {
              const validTo = new Date(cert.valid_to);
              const now = new Date();
              const daysUntilExpiry = Math.floor((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              resolve({
                valid: true,
                issuer: cert.issuer?.O || 'Unknown',
                validFrom: cert.valid_from,
                validTo: cert.valid_to,
                daysUntilExpiry,
              });
            } else {
              resolve({ valid: false, error: 'No certificate found' });
            }
            socket.end();
          }
        );
        socket.on('error', (err) => {
          reject(err);
        });
        socket.setTimeout(5000, () => {
          socket.destroy();
          reject(new Error('SSL connection timeout'));
        });
      });
      result.ssl = { ...sslResult, durationMs: Date.now() - sslStart };
    } catch (err) {
      result.ssl = {
        valid: false,
        error: err instanceof Error ? err.message : 'SSL check failed',
        durationMs: Date.now() - sslStart,
      };
    }
  }

  // HTTP Request with redirect tracking
  const httpStart = Date.now();
  try {
    const httpResult = await new Promise<{ status: number; statusText: string; headers: Record<string, string>; redirects: HealthCheckResult['redirects'] }>((resolve, reject) => {
      const client = isHttps ? https : http;
      const redirects: HealthCheckResult['redirects'] = [];
      let currentUrl = url;

      const makeRequest = (requestUrl: string, redirectCount: number) => {
        if (redirectCount > 5) {
          reject(new Error('Too many redirects'));
          return;
        }

        const req = client.request(requestUrl, { method: 'HEAD', timeout: 10000 }, (res) => {
          const statusCode = res.statusCode || 0;

          if (statusCode >= 300 && statusCode < 400 && res.headers.location) {
            const newUrl = new URL(res.headers.location, requestUrl).toString();

            // Feature #433: SSRF protection - validate redirect URLs
            const redirectValidation = validateRedirectURL(newUrl, isProduction);
            if (!redirectValidation.safe) {
              reject(new Error(redirectValidation.error || 'Redirect to blocked URL'));
              return;
            }

            redirects.push({
              from: currentUrl,
              to: newUrl,
              status: statusCode,
            });
            currentUrl = newUrl;
            makeRequest(newUrl, redirectCount + 1);
          } else {
            const headers: Record<string, string> = {};
            Object.entries(res.headers).forEach(([key, value]) => {
              if (typeof value === 'string') {
                headers[key] = value;
              } else if (Array.isArray(value)) {
                headers[key] = value.join(', ');
              }
            });
            resolve({
              status: statusCode,
              statusText: res.statusMessage || '',
              headers,
              redirects,
            });
          }
        });

        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('HTTP request timeout'));
        });
        req.end();
      };

      makeRequest(url, 0);
    });

    result.http = {
      status: httpResult.status,
      statusText: httpResult.statusText,
      headers: httpResult.headers,
      durationMs: Date.now() - httpStart,
    };
    result.redirects = httpResult.redirects;
  } catch (err) {
    result.http = {
      status: 0,
      statusText: '',
      headers: {},
      error: err instanceof Error ? err.message : 'HTTP request failed',
      durationMs: Date.now() - httpStart,
    };
  }

  result.totalDurationMs = Date.now() - totalStart;
  return result;
}
