/**
 * MCP API Client Module
 *
 * Handles authenticated and public API calls for the MCP server.
 * Extracted from server.ts to reduce file size (Feature #252).
 *
 * @module mcp-api-client
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for the API client
 */
export interface ApiClientConfig {
  apiUrl: string;
  apiKey?: string;
}

/**
 * Options for API calls
 */
export interface ApiCallOptions {
  method?: string;
  body?: unknown;
  [key: string]: unknown;
}

/**
 * Logger function type
 */
export type LogFunction = (message: string) => void;

// ============================================================================
// API Client Class
// ============================================================================

/**
 * Client for making authenticated API calls to the QA Guardian backend.
 */
export class ApiClient {
  private readonly config: ApiClientConfig;
  private readonly log: LogFunction;

  constructor(config: ApiClientConfig, log: LogFunction = () => {}) {
    this.config = config;
    this.log = log;
  }

  /**
   * Make an authenticated API call.
   *
   * @param endpoint - The API endpoint path
   * @param options - Request options (method, body, query params)
   * @returns The JSON response data
   * @throws Error if the request fails
   */
  async callApi(
    endpoint: string,
    options: ApiCallOptions = {}
  ): Promise<unknown> {
    const apiUrl = this.config.apiUrl || 'http://localhost:3001';
    const url = new URL(endpoint, apiUrl);

    // Add query parameters for GET requests
    if (!options.method || options.method === 'GET') {
      Object.entries(options).forEach(([key, value]) => {
        if (key !== 'method' && key !== 'body' && value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Check for internal service token first (for container-to-container communication)
    const internalServiceToken = process.env.INTERNAL_SERVICE_TOKEN;
    if (internalServiceToken) {
      headers['X-Internal-Service-Token'] = internalServiceToken;
    } else if (this.config.apiKey) {
      // Check if apiKey looks like a JWT (starts with 'eyJ') - if so, use Bearer auth
      if (this.config.apiKey.startsWith('eyJ')) {
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      } else {
        headers['X-API-Key'] = this.config.apiKey;
      }
    }

    const fetchOptions: RequestInit = {
      method: options.method || 'GET',
      headers,
    };

    if (options.body) {
      fetchOptions.body = JSON.stringify(options.body);
    }

    const response = await fetch(url.toString(), fetchOptions);

    if (!response.ok) {
      // Try to get the error body for more helpful error messages
      let errorDetail = '';
      let suggestion = '';
      try {
        const errorBody = await response.json() as { error?: string; message?: string };
        errorDetail = errorBody.message || errorBody.error || '';

        // Add helpful suggestions based on error type
        if (response.status === 404) {
          suggestion = ' Verify the ID exists and you have access to it.';
        } else if (response.status === 401) {
          suggestion = ' Check that your API key is valid and has the required scopes.';
        } else if (response.status === 403) {
          suggestion = ' Your API key may not have permission for this operation.';
        } else if (response.status === 400) {
          suggestion = ' Check that all required parameters are provided and valid.';
        }
      } catch {
        // Ignore JSON parse errors
      }

      const baseMessage = `API error: ${response.status} ${response.statusText}`;
      const fullMessage = errorDetail
        ? `${baseMessage} - ${errorDetail}${suggestion}`
        : `${baseMessage}${suggestion}`;

      throw new Error(fullMessage);
    }

    return response.json();
  }

  /**
   * Make a public (unauthenticated) API call.
   *
   * @param endpoint - The API endpoint path
   * @returns The JSON response data
   * @throws Error if the request fails
   */
  async callApiPublic(endpoint: string): Promise<unknown> {
    const apiUrl = this.config.apiUrl || 'http://localhost:3001';
    const url = new URL(endpoint, apiUrl);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      let errorDetail = '';
      try {
        const errorBody = await response.json() as { error?: string; message?: string };
        errorDetail = errorBody.message || errorBody.error || '';
      } catch {
        // Ignore JSON parse errors
      }
      throw new Error(`${response.status} ${response.statusText}${errorDetail ? ` - ${errorDetail}` : ''}`);
    }

    return response.json();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create an API client instance.
 */
export function createApiClient(
  config: ApiClientConfig,
  log?: LogFunction
): ApiClient {
  return new ApiClient(config, log);
}
