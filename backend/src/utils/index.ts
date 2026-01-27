/**
 * Backend Utilities Module
 *
 * Shared utility functions to eliminate code duplication across the codebase.
 * Feature #1360: Code duplication detection and elimination
 */

// ============================================
// ID Generation Utilities
// ============================================

/**
 * Generates a unique ID with a prefix.
 * Replaces the common pattern: `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
 *
 * @param prefix - The prefix for the ID (e.g., 'test', 'run', 'result')
 * @param length - Length of the random suffix (default: 9)
 * @returns A unique ID string
 *
 * @example
 * generateId('test') // 'test_1705234567890_a1b2c3d4e'
 * generateId('run', 6) // 'run_1705234567890_a1b2c3'
 */
export function generateId(prefix: string, length: number = 9): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 2 + length);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Generates a simple unique ID without prefix.
 * Useful for generic IDs where prefix is not needed.
 *
 * @param length - Total length of random string (default: 12)
 * @returns A unique random string
 *
 * @example
 * generateSimpleId() // 'a1b2c3d4e5f6'
 */
export function generateSimpleId(length: number = 12): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 2 + Math.max(1, length - timestamp.length));
  return timestamp + random;
}

/**
 * Generates a request/session ID.
 * Common pattern: `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
 *
 * @returns A unique request ID
 */
export function generateRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================
// Timestamp Utilities
// ============================================

/**
 * Returns current timestamp in ISO format.
 * Replaces: `new Date().toISOString()`
 *
 * @returns ISO formatted timestamp string
 */
export function now(): string {
  return new Date().toISOString();
}

/**
 * Returns a timestamp from N seconds ago.
 *
 * @param seconds - Number of seconds ago
 * @returns ISO formatted timestamp string
 */
export function timeAgo(seconds: number): string {
  const date = new Date();
  date.setSeconds(date.getSeconds() - seconds);
  return date.toISOString();
}

/**
 * Returns a timestamp N seconds in the future.
 *
 * @param seconds - Number of seconds in the future
 * @returns ISO formatted timestamp string
 */
export function timeFromNow(seconds: number): string {
  const date = new Date();
  date.setSeconds(date.getSeconds() + seconds);
  return date.toISOString();
}

// ============================================
// Formatting Utilities
// ============================================

/**
 * Formats bytes to human-readable string.
 * Note: Also exported from test-runs/storage.ts for backwards compatibility.
 *
 * @param bytes - Number of bytes
 * @returns Human-readable string (e.g., '1.5 MB')
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Formats duration in milliseconds to human-readable string.
 *
 * @param ms - Duration in milliseconds
 * @returns Human-readable string (e.g., '2m 30s')
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  if (minutes < 60) return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Formats a percentage with optional decimal places.
 *
 * @param value - The decimal value (0-1) or percentage (0-100)
 * @param isDecimal - Whether the value is a decimal (0-1)
 * @param decimals - Number of decimal places
 * @returns Formatted percentage string
 */
export function formatPercent(value: number, isDecimal: boolean = false, decimals: number = 1): string {
  const percent = isDecimal ? value * 100 : value;
  return `${percent.toFixed(decimals)}%`;
}

// ============================================
// Array Utilities
// ============================================

/**
 * Safely gets a slice of an array with pagination.
 *
 * @param array - The source array
 * @param page - Page number (1-indexed)
 * @param pageSize - Items per page
 * @returns Sliced array for the page
 */
export function paginate<T>(array: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return array.slice(start, start + pageSize);
}

/**
 * Chunks an array into smaller arrays of specified size.
 *
 * @param array - The source array
 * @param size - Size of each chunk
 * @returns Array of chunks
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Groups an array by a key function.
 *
 * @param array - The source array
 * @param keyFn - Function to extract the grouping key
 * @returns Object with groups
 */
export function groupBy<T, K extends string | number>(
  array: T[],
  keyFn: (item: T) => K
): Record<K, T[]> {
  return array.reduce((groups, item) => {
    const key = keyFn(item);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
    return groups;
  }, {} as Record<K, T[]>);
}

// ============================================
// Validation Utilities
// ============================================

/**
 * Validates that a value is a non-empty string.
 *
 * @param value - The value to check
 * @returns Whether the value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validates that a value is a positive integer.
 *
 * @param value - The value to check
 * @returns Whether the value is a positive integer
 */
export function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/**
 * Validates an email format.
 *
 * @param email - The email to validate
 * @returns Whether the email format is valid
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates a URL format.
 *
 * @param url - The URL to validate
 * @returns Whether the URL format is valid
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// ============================================
// Object Utilities
// ============================================

/**
 * Picks specified keys from an object.
 *
 * @param obj - The source object
 * @param keys - Keys to pick
 * @returns New object with only the specified keys
 */
export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * Omits specified keys from an object.
 *
 * @param obj - The source object
 * @param keys - Keys to omit
 * @returns New object without the specified keys
 */
export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result as Omit<T, K>;
}

/**
 * Deep clones an object (simple implementation for JSON-serializable objects).
 *
 * @param obj - The object to clone
 * @returns A deep clone of the object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// ============================================
// Async Utilities
// ============================================

/**
 * Delays execution for a specified time.
 *
 * @param ms - Milliseconds to delay
 * @returns Promise that resolves after the delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retries an async operation with exponential backoff.
 *
 * @param fn - The async function to retry
 * @param maxRetries - Maximum number of retries
 * @param baseDelay - Base delay in milliseconds
 * @returns The result of the function
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        await delay(baseDelay * Math.pow(2, attempt));
      }
    }
  }

  throw lastError;
}

// ============================================
// Hash Utilities
// ============================================

/**
 * Creates a simple hash from a string (for caching, not security).
 *
 * @param str - The string to hash
 * @returns A numeric hash
 */
export function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Creates a string hash suitable for cache keys.
 *
 * @param str - The string to hash
 * @returns A hex string hash
 */
export function hashString(str: string): string {
  return simpleHash(str).toString(16);
}

// ============================================
// Shared Type Definitions
// Feature #1360: Code duplication detection
// ============================================

/**
 * Severity levels used across the codebase for:
 * - Security vulnerabilities
 * - Test failures
 * - Accessibility issues
 * - Performance issues
 */
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Severity with optional NONE for cases where severity is not applicable.
 */
export type SeverityWithNone = Severity | 'NONE';

/**
 * Severity order for sorting (higher number = more severe).
 * Used for sorting vulnerabilities, issues, etc. by severity.
 */
export const SEVERITY_ORDER: Record<SeverityWithNone, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
  NONE: 0,
};

/**
 * Array of severities in descending order (most severe first).
 */
export const SEVERITIES_DESC: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

/**
 * Sorts items by severity using the standard severity order.
 *
 * @param items - Array of items with a severity property
 * @param direction - Sort direction ('asc' or 'desc')
 * @returns Sorted array
 */
export function sortBySeverity<T extends { severity: SeverityWithNone }>(
  items: T[],
  direction: 'asc' | 'desc' = 'desc'
): T[] {
  return [...items].sort((a, b) => {
    const diff = SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
    return direction === 'desc' ? diff : -diff;
  });
}

/**
 * Common scan/job status values.
 * Used for security scans, test runs, batch operations, etc.
 */
export type ScanStatus = 'pending' | 'running' | 'completed' | 'failed';

/**
 * Extended scan status with additional states.
 */
export type ExtendedScanStatus = ScanStatus | 'cancelled' | 'queued' | 'timeout';

/**
 * Test result status values.
 */
export type TestStatus = 'passed' | 'failed' | 'skipped' | 'pending' | 'running';

/**
 * Summary by severity - common pattern for scan results.
 */
export interface SeveritySummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

/**
 * Full scan summary interface - used by SAST, DAST, dependency scanning.
 */
export interface ScanSummary {
  total: number;
  bySeverity: SeveritySummary;
  fixable?: number;
  unfixable?: number;
}

/**
 * Creates an empty severity summary.
 */
export function createEmptySeveritySummary(): SeveritySummary {
  return { critical: 0, high: 0, medium: 0, low: 0 };
}

/**
 * Creates an empty scan summary.
 */
export function createEmptyScanSummary(): ScanSummary {
  return {
    total: 0,
    bySeverity: createEmptySeveritySummary(),
  };
}

/**
 * Calculates severity summary from an array of items with severity.
 *
 * @param items - Array of items with a severity property
 * @returns Summary counts by severity
 */
export function calculateSeveritySummary<T extends { severity: Severity }>(
  items: T[]
): SeveritySummary {
  const summary = createEmptySeveritySummary();
  for (const item of items) {
    const key = item.severity.toLowerCase() as keyof SeveritySummary;
    if (key in summary) {
      summary[key]++;
    }
  }
  return summary;
}

// ============================================
// MCP Tool Utilities
// Feature #1360: Eliminate tool handler duplication
// ============================================

/**
 * Tool definition interface (matches MCP protocol).
 */
export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * Extracts tool names from an array of tool definitions.
 * Replaces the common pattern: TOOLS.map(t => t.name)
 *
 * @param tools - Array of tool definitions
 * @returns Array of tool names
 */
export function getToolNames(tools: MCPToolDefinition[]): string[] {
  return tools.map(t => t.name);
}

/**
 * Creates a tool name set for fast lookups.
 *
 * @param tools - Array of tool definitions
 * @returns Set of tool names
 */
export function createToolNameSet(tools: MCPToolDefinition[]): Set<string> {
  return new Set(tools.map(t => t.name));
}

// ============================================
// Error Handling Utilities
// Feature #1360: Consistent error handling
// ============================================

/**
 * Standard API error response interface.
 */
export interface APIError {
  error: string;
  message: string;
  code?: string;
  details?: unknown;
}

/**
 * Creates a standard API error object.
 *
 * @param message - Error message
 * @param code - Optional error code
 * @param details - Optional additional details
 * @returns API error object
 */
export function createAPIError(
  message: string,
  code?: string,
  details?: unknown
): APIError {
  const result: APIError = {
    error: code || 'ERROR',
    message,
  };
  if (code) {
    result.code = code;
  }
  if (details !== undefined) {
    result.details = details;
  }
  return result;
}

/**
 * Logs an error with consistent formatting.
 *
 * @param context - The context/module name
 * @param message - Error message
 * @param error - The error object (optional)
 */
export function logError(context: string, message: string, error?: unknown): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error(`[${context}] ${message}${error ? `: ${errorMessage}` : ''}`);
}
