/**
 * Shared authenticated fetch helper
 * Feature #655: Extracted from 14 duplicate implementations across API hooks
 *
 * Usage:
 * ```ts
 * import { fetchWithAuth } from './fetchWithAuth';
 * const data = await fetchWithAuth('/api/endpoint', token, { method: 'POST', body: JSON.stringify(data) });
 * ```
 */

/**
 * Feature #722: Standardized API error response shape.
 * All backend error responses conform to this envelope.
 */
export interface StandardErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Extended Error type with HTTP status code and structured error data.
 * Feature #722: Now includes the parsed error code, message, and optional details
 * from the standardized API error response.
 */
export interface FetchError extends Error {
  status: number;
  /** Machine-readable error code (e.g. 'NOT_FOUND', 'UNAUTHORIZED') */
  code: string;
  /** Optional additional context from the API */
  details?: Record<string, unknown>;
}

/**
 * Fetch helper that automatically adds auth headers and handles errors.
 * Feature #686: Generic return type for type-safe API responses.
 * Feature #722: Parses standardized error response format.
 *
 * @param url - The URL to fetch
 * @param token - JWT authentication token (or null if not authenticated)
 * @param options - Standard fetch options
 * @returns Parsed JSON response of type T
 * @throws FetchError with status code, error code, and message on HTTP errors
 * @throws Error if not authenticated
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchWithAuth<T = any>(
  url: string,
  token: string | null,
  options?: RequestInit
): Promise<T> {
  if (!token) throw new Error('Not authenticated');

  // Feature #780: Only set Content-Type for requests with a body to avoid
  // Fastify FST_ERR_CTP_EMPTY_JSON_BODY error on DELETE requests
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
    ...options?.headers as Record<string, string>,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    // Feature #722: Parse the standardized error body for structured error info
    let errorMessage = `API error: ${response.status}`;
    let errorCode = 'UNKNOWN_ERROR';
    let errorDetails: Record<string, unknown> | undefined;

    try {
      const body = await response.json();
      // Parse the standardized { error: { code, message, details? } } shape
      if (body?.error?.code && body?.error?.message) {
        errorCode = body.error.code;
        errorMessage = body.error.message;
        errorDetails = body.error.details;
      } else if (typeof body?.error === 'string') {
        // Fallback for legacy error responses that might not be migrated
        errorMessage = body.error;
      } else if (typeof body?.message === 'string') {
        errorMessage = body.message;
      }
    } catch {
      // Response body is not JSON or not parseable - use default message
    }

    const err = new Error(errorMessage) as FetchError;
    err.status = response.status;
    err.code = errorCode;
    err.details = errorDetails;
    throw err;
  }

  return response.json() as Promise<T>;
}

export default fetchWithAuth;
