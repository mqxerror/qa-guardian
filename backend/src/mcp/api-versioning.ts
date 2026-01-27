/**
 * API Versioning Utilities for MCP Server
 * Extracted from server.ts for code organization (Feature #1356)
 *
 * This module handles API version parsing, validation, and deprecation warnings.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Status of an API version
 */
export type APIVersionStatus = 'current' | 'deprecated' | 'sunset';

/**
 * Information about an API version
 */
export interface APIVersionInfo {
  version: string;
  status: APIVersionStatus;
  deprecationDate?: string; // ISO date when deprecated
  sunsetDate?: string; // ISO date when it will be removed
  deprecationMessage?: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * API version definitions
 * Defines all supported versions and their lifecycle status
 */
export const API_VERSIONS: Record<string, APIVersionInfo> = {
  'v1': {
    version: 'v1',
    status: 'deprecated',
    deprecationDate: '2025-06-01',
    sunsetDate: '2026-06-01',
    deprecationMessage: 'API v1 is deprecated and will be removed on 2026-06-01. Please migrate to v2.',
  },
  'v2': {
    version: 'v2',
    status: 'current',
  },
};

/**
 * Default API version if not specified
 */
export const DEFAULT_API_VERSION = 'v2';

/**
 * Current (latest) API version
 */
export const CURRENT_API_VERSION = 'v2';

// ============================================================================
// Functions
// ============================================================================

/**
 * Parse API version from request params
 * Normalizes version strings (accepts "v1", "1", "v2", "2", etc.)
 *
 * @param params - Request parameters that may contain _apiVersion
 * @param defaultVersion - Fallback version if not specified
 * @param logFn - Optional logging function for warnings
 * @returns The normalized API version string
 */
export function parseApiVersion(
  params?: Record<string, unknown>,
  defaultVersion: string = DEFAULT_API_VERSION,
  logFn?: (msg: string) => void
): string {
  if (!params) return defaultVersion;

  // Check for explicit _apiVersion parameter
  const version = params._apiVersion;
  if (typeof version === 'string') {
    // Normalize version string (accept "v1", "1", "v2", "2", etc.)
    const normalizedVersion = version.toLowerCase().startsWith('v')
      ? version.toLowerCase()
      : `v${version}`;

    // Check if version is supported
    if (API_VERSIONS[normalizedVersion]) {
      return normalizedVersion;
    }

    // Unknown version - log warning and use default
    if (logFn) {
      logFn(`[VERSION] Unknown API version requested: ${version}, using default: ${defaultVersion}`);
    }
  }

  return defaultVersion;
}

/**
 * Get version info with deprecation status
 *
 * @param version - The API version to get info for
 * @returns The version info object
 */
export function getVersionInfo(version: string): APIVersionInfo {
  return API_VERSIONS[version] ?? API_VERSIONS[DEFAULT_API_VERSION] ?? {
    version: DEFAULT_API_VERSION,
    status: 'stable' as const,
    released: new Date().toISOString().split('T')[0]!,
    features: []
  };
}

/**
 * Check if a version is deprecated or sunset
 *
 * @param version - The API version to check
 * @returns true if the version is deprecated or sunset
 */
export function isVersionDeprecated(version: string): boolean {
  const info = getVersionInfo(version);
  return info.status === 'deprecated' || info.status === 'sunset';
}

/**
 * Check if a version is valid (exists in API_VERSIONS)
 *
 * @param version - The API version to check
 * @returns true if the version is valid
 */
export function isValidVersion(version: string): boolean {
  return version in API_VERSIONS;
}

/**
 * Get all supported API versions
 *
 * @returns Array of all supported API version info
 */
export function getSupportedVersions(): APIVersionInfo[] {
  return Object.values(API_VERSIONS);
}

/**
 * Get the current (latest) API version
 *
 * @returns The current API version string
 */
export function getCurrentApiVersion(): string {
  return CURRENT_API_VERSION;
}

/**
 * MCP Response type (minimal definition for this module)
 */
interface MCPResponse {
  jsonrpc: '2.0';
  id?: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * Add version warnings to response if API version is deprecated
 *
 * @param response - The MCP response to modify
 * @param version - The API version used for the request
 * @param logFn - Optional logging function for deprecation warnings
 * @returns The response with version warnings added if applicable
 */
export function addVersionWarnings(
  response: MCPResponse,
  version: string,
  logFn?: (msg: string) => void
): MCPResponse {
  const versionInfo = getVersionInfo(version);

  if (versionInfo.status === 'deprecated' || versionInfo.status === 'sunset') {
    // Add deprecation warning to response
    const result = response.result as Record<string, unknown> | undefined;
    if (result) {
      response.result = {
        ...result,
        _apiVersion: {
          version: versionInfo.version,
          status: versionInfo.status,
          deprecationWarning: versionInfo.deprecationMessage,
          deprecationDate: versionInfo.deprecationDate,
          sunsetDate: versionInfo.sunsetDate,
          recommendedVersion: CURRENT_API_VERSION,
        },
      };

      // Log deprecation warning
      if (logFn) {
        logFn(`[VERSION] Deprecation warning: ${versionInfo.deprecationMessage}`);
      }
    }
  }

  return response;
}

/**
 * Create a versioned error response for unsupported versions
 *
 * @param requestedVersion - The unsupported version that was requested
 * @param requestId - The request ID for the error response
 * @returns An MCP error response for the unsupported version
 */
export function createUnsupportedVersionError(
  requestedVersion: string,
  requestId?: string | number
): MCPResponse {
  const supportedVersions = getSupportedVersions().map(v => v.version).join(', ');

  return {
    jsonrpc: '2.0',
    id: requestId,
    error: {
      code: -32602,
      message: `Unsupported API version: ${requestedVersion}`,
      data: {
        requestedVersion,
        supportedVersions: getSupportedVersions(),
        currentVersion: CURRENT_API_VERSION,
        suggestion: `Please use one of the supported versions: ${supportedVersions}`,
      },
    },
  };
}
