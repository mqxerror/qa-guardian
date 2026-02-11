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
 * Extended Error type with HTTP status code
 */
export interface FetchError extends Error {
  status: number;
}

/**
 * Fetch helper that automatically adds auth headers and handles errors
 * @param url - The URL to fetch
 * @param token - JWT authentication token (or null if not authenticated)
 * @param options - Standard fetch options
 * @returns Parsed JSON response
 * @throws FetchError with status code on HTTP errors
 * @throws Error if not authenticated
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchWithAuth(
  url: string,
  token: string | null,
  options?: RequestInit
): Promise<any> {
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const err = new Error(`API error: ${response.status}`) as FetchError;
    err.status = response.status;
    throw err;
  }

  return response.json();
}

export default fetchWithAuth;
