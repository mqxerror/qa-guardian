/**
 * Test Setup for React Query Hooks
 * Feature #132: Unit tests for all 18 React Query custom hooks
 *
 * This file provides:
 * - Global fetch mocking
 * - QueryClient wrapper for testing hooks
 * - Helper utilities for testing React Query hooks
 */

import { beforeAll, afterAll, afterEach, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// Mock the logger to prevent console noise during tests
vi.mock('../utils/logger', () => ({
  logger: {
    auth: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    cache: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    api: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    socket: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  },
}));

// Global fetch mock
const originalFetch = global.fetch;

beforeAll(() => {
  // Install global fetch mock
  global.fetch = vi.fn();
});

afterAll(() => {
  // Restore original fetch
  global.fetch = originalFetch;
});

afterEach(() => {
  // Clear all mocks after each test
  vi.clearAllMocks();
});

/**
 * Create a fresh QueryClient for testing with sensible defaults
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Disable retries for faster test execution
        retry: false,
        // Prevent auto-refetching during tests
        refetchOnWindowFocus: false,
        // Set staleTime to 0 so data is always considered stale
        staleTime: 0,
        // Set gcTime to 0 to immediately garbage collect
        gcTime: 0,
      },
      mutations: {
        // Disable retries for mutations
        retry: false,
      },
    },
  });
}

/**
 * Mock fetch response helper
 */
export function mockFetchResponse<T>(data: T, status = 200) {
  return vi.mocked(global.fetch).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  } as Response);
}

/**
 * Mock fetch error helper
 */
export function mockFetchError(status = 500, message = 'Server error') {
  return vi.mocked(global.fetch).mockResolvedValueOnce({
    ok: false,
    status,
    json: () => Promise.resolve({ error: message }),
  } as Response);
}

/**
 * Mock fetch to reject (network error)
 */
export function mockFetchNetworkError() {
  return vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));
}

/**
 * Create a mock auth token
 */
export const TEST_TOKEN = 'test-jwt-token-12345';

/**
 * Create a mock user
 */
export const TEST_USER = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'admin' as const,
  organization_id: 'org-123',
};

/**
 * Create mock auth store state
 */
export const createMockAuthStore = (overrides = {}) => ({
  user: TEST_USER,
  token: TEST_TOKEN,
  isAuthenticated: true,
  isLoading: false,
  organizations: [],
  login: vi.fn(),
  logout: vi.fn(),
  setUser: vi.fn(),
  setToken: vi.fn(),
  checkAuth: vi.fn(),
  fetchOrganizations: vi.fn(),
  switchOrganization: vi.fn(),
  ...overrides,
});

/**
 * Type for wrapper component props
 */
export interface WrapperProps {
  children: ReactNode;
}
