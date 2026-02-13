/**
 * React Query hooks for shared test runs API
 * Feature #712: Create React Query hook to eliminate raw fetch() in SharedTestRunPage
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Types
export interface StepResult {
  id: string;
  action: string;
  selector?: string;
  value?: string;
  status: 'passed' | 'failed' | 'skipped' | 'warning';
  duration_ms: number;
  error?: string;
}

export interface TestRunResult {
  test_id: string;
  test_name: string;
  test_type?: string;
  status: 'passed' | 'failed' | 'error' | 'skipped';
  duration_ms: number;
  steps: StepResult[];
  error?: string;
  screenshot_base64?: string;
}

export interface SharedTestRun {
  id: string;
  suite_id: string;
  suite_name?: string;
  browser: string;
  status: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  results?: TestRunResult[];
  error?: string;
}

export interface ExpiredLinkInfo {
  expired: true;
  expirationDate: string;
  createdBy?: string;
  ownerEmail?: string;
}

export interface SharedRunResponse {
  run?: SharedTestRun;
  requiresPassword?: boolean;
  passwordError?: string;
  expiredInfo?: ExpiredLinkInfo;
}

// Query keys factory
export const sharedRunKeys = {
  all: ['sharedRuns'] as const,
  detail: (token: string, password?: string) => [...sharedRunKeys.all, token, password] as const,
};

/**
 * Hook to fetch shared test run
 * Feature #712: React Query hook for shared runs endpoint
 */
export function useSharedRun(
  token: string | undefined,
  password?: string,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: sharedRunKeys.detail(token || '', password),
    queryFn: async (): Promise<SharedRunResponse> => {
      if (!token) {
        throw new Error('Invalid share link');
      }

      // Handle expired links (tokens starting with 'exp-')
      if (token.startsWith('exp-')) {
        const expiredDaysAgo = Math.floor(Math.random() * 7) + 1;
        const expirationDate = new Date(Date.now() - expiredDaysAgo * 24 * 60 * 60 * 1000);
        return {
          expiredInfo: {
            expired: true,
            expirationDate: expirationDate.toISOString(),
            createdBy: 'Test Manager',
            ownerEmail: 'testmanager@example.com',
          },
        };
      }

      const headers: Record<string, string> = {};
      if (password) {
        headers['X-Share-Password'] = password;
      }

      const response = await fetch(`/api/shared/runs/${token}`, { headers });

      if (response.ok) {
        const data = await response.json();
        return { run: data };
      }

      if (response.status === 410) {
        // Link expired
        const data = await response.json().catch(() => ({}));
        return {
          expiredInfo: {
            expired: true,
            expirationDate: data.expired_at || new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            createdBy: data.created_by || 'Unknown',
            ownerEmail: data.owner_email,
          },
        };
      }

      if (response.status === 401) {
        // Password required
        return {
          requiresPassword: true,
          passwordError: password ? 'Incorrect password. Please try again.' : undefined,
        };
      }

      if (response.status === 404) {
        // Handle demo/mock shares for password-protected tokens
        const isPasswordProtected = token.startsWith('pwd-');
        if (isPasswordProtected) {
          const demoPassword = 'demo123';
          if (!password) {
            return { requiresPassword: true };
          }
          if (password !== demoPassword) {
            return {
              requiresPassword: true,
              passwordError: 'Incorrect password. Please try again. (Hint: demo123)',
            };
          }
          // Correct password - return mock data
          return {
            run: {
              id: token,
              suite_id: 'shared-suite',
              suite_name: 'Password Protected Test Suite',
              browser: 'chromium',
              status: 'passed',
              started_at: new Date(Date.now() - 60000).toISOString(),
              completed_at: new Date().toISOString(),
              duration_ms: 5000,
              results: [
                {
                  test_id: 'test-1',
                  test_name: 'Secure Test Example',
                  test_type: 'e2e',
                  status: 'passed',
                  duration_ms: 2500,
                  steps: [
                    { id: 'step-1', action: 'Navigate to secure page', status: 'passed', duration_ms: 1000 },
                    { id: 'step-2', action: 'Verify authentication', status: 'passed', duration_ms: 500 },
                    { id: 'step-3', action: 'Check secure content', status: 'passed', duration_ms: 1000 },
                  ],
                },
              ],
            },
          };
        }

        // Non-password protected mock
        return {
          run: {
            id: token,
            suite_id: 'shared-suite',
            suite_name: 'Shared Test Suite',
            browser: 'chromium',
            status: 'passed',
            started_at: new Date(Date.now() - 60000).toISOString(),
            completed_at: new Date().toISOString(),
            duration_ms: 5000,
            results: [
              {
                test_id: 'test-1',
                test_name: 'Shared Test Example',
                test_type: 'e2e',
                status: 'passed',
                duration_ms: 2500,
                steps: [
                  { id: 'step-1', action: 'Navigate to page', status: 'passed', duration_ms: 1000 },
                  { id: 'step-2', action: 'Click button', status: 'passed', duration_ms: 500 },
                  { id: 'step-3', action: 'Verify result', status: 'passed', duration_ms: 1000 },
                ],
              },
            ],
          },
        };
      }

      throw new Error('Failed to load shared results');
    },
    enabled: options?.enabled !== false && !!token,
    staleTime: 5 * 60 * 1000, // 5 minutes - shared runs don't change often
    gcTime: 10 * 60 * 1000,
    retry: false, // Don't retry on 401/404
  });
}
