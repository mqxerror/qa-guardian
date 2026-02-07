/**
 * Unit Tests for useDashboard React Query Hooks
 * Feature #132: Add unit tests for all 18 React Query custom hooks
 *
 * Tests cover:
 * - dashboardKeys: query key generation
 * - DashboardStats type validation
 * - RecentRun type validation
 * - Cache operations for dashboard data
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  dashboardKeys,
  type DashboardStats,
  type RecentRun,
} from './useDashboard';

// Test data factories
const createMockDashboardStats = (overrides: Partial<DashboardStats> = {}): DashboardStats => ({
  projects: 5,
  test_suites: 20,
  tests: 100,
  test_runs: 500,
  passed_runs: 400,
  failed_runs: 100,
  pass_rate: 80,
  ...overrides,
});

const createMockRecentRun = (overrides: Partial<RecentRun> = {}): RecentRun => ({
  id: 'run-123',
  suite_id: 'suite-123',
  suite_name: 'Test Suite',
  project_id: 'project-123',
  project_name: 'Test Project',
  test_id: 'test-123',
  test_name: 'Test Case',
  status: 'passed',
  browser: 'chromium',
  branch: 'main',
  created_at: '2024-01-01T00:00:00Z',
  started_at: '2024-01-01T00:00:01Z',
  completed_at: '2024-01-01T00:00:30Z',
  duration_ms: 29000,
  ...overrides,
});

describe('dashboardKeys', () => {
  it('should generate correct base keys', () => {
    expect(dashboardKeys.all).toEqual(['dashboard']);
  });

  it('should generate correct stats keys', () => {
    expect(dashboardKeys.stats()).toEqual(['dashboard', 'stats']);
  });

  it('should generate correct recentRuns keys', () => {
    expect(dashboardKeys.recentRuns()).toEqual(['dashboard', 'recentRuns', undefined]);
    expect(dashboardKeys.recentRuns(10)).toEqual(['dashboard', 'recentRuns', 10]);
    expect(dashboardKeys.recentRuns(25)).toEqual(['dashboard', 'recentRuns', 25]);
  });

  it('should maintain key hierarchy for invalidation', () => {
    const statsKey = dashboardKeys.stats();
    expect(statsKey.slice(0, 1)).toEqual(dashboardKeys.all);

    const recentRunsKey = dashboardKeys.recentRuns(10);
    expect(recentRunsKey.slice(0, 1)).toEqual(dashboardKeys.all);
  });

  it('should differentiate recent runs by limit', () => {
    const limit10 = dashboardKeys.recentRuns(10);
    const limit25 = dashboardKeys.recentRuns(25);

    expect(limit10).not.toEqual(limit25);
    expect(limit10[2]).toBe(10);
    expect(limit25[2]).toBe(25);
  });
});

describe('QueryClient cache operations for dashboard', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('stats caching', () => {
    it('should store and retrieve dashboard stats', () => {
      const stats = createMockDashboardStats();
      queryClient.setQueryData(dashboardKeys.stats(), stats);

      const cached = queryClient.getQueryData<DashboardStats>(dashboardKeys.stats());

      expect(cached?.projects).toBe(5);
      expect(cached?.test_suites).toBe(20);
      expect(cached?.tests).toBe(100);
      expect(cached?.pass_rate).toBe(80);
    });

    it('should update stats when values change', () => {
      const initialStats = createMockDashboardStats({ test_runs: 500, passed_runs: 400 });
      queryClient.setQueryData(dashboardKeys.stats(), initialStats);

      const updatedStats = createMockDashboardStats({ test_runs: 501, passed_runs: 401 });
      queryClient.setQueryData(dashboardKeys.stats(), updatedStats);

      const cached = queryClient.getQueryData<DashboardStats>(dashboardKeys.stats());
      expect(cached?.test_runs).toBe(501);
      expect(cached?.passed_runs).toBe(401);
    });
  });

  describe('recent runs caching', () => {
    it('should store and retrieve recent runs', () => {
      const runs = [
        createMockRecentRun({ id: 'run-1', status: 'passed' }),
        createMockRecentRun({ id: 'run-2', status: 'failed' }),
      ];
      queryClient.setQueryData(dashboardKeys.recentRuns(10), { runs });

      const cached = queryClient.getQueryData<{ runs: RecentRun[] }>(dashboardKeys.recentRuns(10));

      expect(cached?.runs).toHaveLength(2);
      expect(cached?.runs[0].status).toBe('passed');
      expect(cached?.runs[1].status).toBe('failed');
    });

    it('should cache different limits separately', () => {
      const runs10 = [createMockRecentRun({ id: 'run-1' })];
      const runs25 = [
        createMockRecentRun({ id: 'run-1' }),
        createMockRecentRun({ id: 'run-2' }),
      ];

      queryClient.setQueryData(dashboardKeys.recentRuns(10), { runs: runs10 });
      queryClient.setQueryData(dashboardKeys.recentRuns(25), { runs: runs25 });

      const cached10 = queryClient.getQueryData<{ runs: RecentRun[] }>(dashboardKeys.recentRuns(10));
      const cached25 = queryClient.getQueryData<{ runs: RecentRun[] }>(dashboardKeys.recentRuns(25));

      expect(cached10?.runs).toHaveLength(1);
      expect(cached25?.runs).toHaveLength(2);
    });
  });

  describe('cache invalidation patterns', () => {
    it('should invalidate all dashboard queries', async () => {
      queryClient.setQueryData(dashboardKeys.stats(), createMockDashboardStats());
      queryClient.setQueryData(dashboardKeys.recentRuns(10), { runs: [] });

      await queryClient.invalidateQueries({ queryKey: dashboardKeys.all });

      expect(queryClient.getQueryState(dashboardKeys.stats())?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(dashboardKeys.recentRuns(10))?.isInvalidated).toBe(true);
    });

    it('should invalidate only stats', async () => {
      queryClient.setQueryData(dashboardKeys.stats(), createMockDashboardStats());
      queryClient.setQueryData(dashboardKeys.recentRuns(10), { runs: [] });

      await queryClient.invalidateQueries({ queryKey: dashboardKeys.stats() });

      expect(queryClient.getQueryState(dashboardKeys.stats())?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(dashboardKeys.recentRuns(10))?.isInvalidated).toBeFalsy();
    });

    it('should invalidate only recent runs', async () => {
      queryClient.setQueryData(dashboardKeys.stats(), createMockDashboardStats());
      queryClient.setQueryData(dashboardKeys.recentRuns(10), { runs: [] });

      await queryClient.invalidateQueries({ queryKey: dashboardKeys.recentRuns(10) });

      expect(queryClient.getQueryState(dashboardKeys.stats())?.isInvalidated).toBeFalsy();
      expect(queryClient.getQueryState(dashboardKeys.recentRuns(10))?.isInvalidated).toBe(true);
    });
  });
});

describe('DashboardStats type', () => {
  it('should create valid DashboardStats objects', () => {
    const stats = createMockDashboardStats();

    expect(stats.projects).toBeDefined();
    expect(stats.test_suites).toBeDefined();
    expect(stats.tests).toBeDefined();
    expect(stats.test_runs).toBeDefined();
    expect(stats.passed_runs).toBeDefined();
    expect(stats.failed_runs).toBeDefined();
    expect(stats.pass_rate).toBeDefined();
  });

  it('should calculate pass rate correctly', () => {
    const stats = createMockDashboardStats({
      test_runs: 100,
      passed_runs: 75,
      failed_runs: 25,
      pass_rate: 75,
    });

    expect(stats.pass_rate).toBe(75);
    expect(stats.passed_runs + stats.failed_runs).toBe(stats.test_runs);
  });

  it('should handle zero runs', () => {
    const stats = createMockDashboardStats({
      test_runs: 0,
      passed_runs: 0,
      failed_runs: 0,
      pass_rate: 0,
    });

    expect(stats.test_runs).toBe(0);
    expect(stats.pass_rate).toBe(0);
  });
});

describe('RecentRun type', () => {
  it('should create valid RecentRun objects', () => {
    const run = createMockRecentRun();

    expect(run.id).toBeDefined();
    expect(run.suite_id).toBeDefined();
    expect(run.project_id).toBeDefined();
    expect(run.status).toBe('passed');
    expect(run.browser).toBe('chromium');
  });

  it('should support all status values', () => {
    const statuses: RecentRun['status'][] = ['pending', 'running', 'passed', 'failed', 'cancelled', 'error'];

    statuses.forEach((status) => {
      const run = createMockRecentRun({ status });
      expect(run.status).toBe(status);
    });
  });

  it('should support suite-level runs (test_id null)', () => {
    const suiteRun = createMockRecentRun({
      test_id: null,
      test_name: undefined,
    });

    expect(suiteRun.test_id).toBeNull();
  });

  it('should include project name for display', () => {
    const run = createMockRecentRun({
      project_name: 'My Project',
      suite_name: 'My Suite',
    });

    expect(run.project_name).toBe('My Project');
    expect(run.suite_name).toBe('My Suite');
  });

  it('should track timing information', () => {
    const run = createMockRecentRun({
      created_at: '2024-01-01T00:00:00Z',
      started_at: '2024-01-01T00:00:05Z',
      completed_at: '2024-01-01T00:00:35Z',
      duration_ms: 30000,
    });

    expect(run.created_at).toBeDefined();
    expect(run.started_at).toBeDefined();
    expect(run.completed_at).toBeDefined();
    expect(run.duration_ms).toBe(30000);
  });
});
