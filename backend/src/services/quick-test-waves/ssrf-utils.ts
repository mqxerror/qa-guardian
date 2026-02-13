/**
 * SSRF Protection Utilities for Quick Test Waves
 * Feature #698: Deduplicated from health.ts - shared by all wave modules
 */

import { isPrivateIP, validateURLForSSRF } from '../../utils/index.js';

/**
 * Feature #433: SSRF protection - check if resolved IPs are private
 * Used by health check to validate DNS resolution results
 */
export function validateResolvedIPs(addresses: string[]): { safe: boolean; error?: string } {
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

/**
 * Feature #433: SSRF protection - validate redirect URLs
 * Used by health check to validate HTTP redirect targets
 */
export function validateRedirectURL(redirectUrl: string, isProduction: boolean): { safe: boolean; error?: string } {
  const validation = validateURLForSSRF(redirectUrl, {
    requireHttps: false,
    allowLocalhost: !isProduction,
  });
  if (!validation.safe) {
    return { safe: false, error: `Redirect to blocked URL: ${validation.error}` };
  }
  return { safe: true };
}
