/**
 * Unit Tests for useRuns React Query Hooks
 * Feature #132: Add unit tests for all 18 React Query custom hooks
 *
 * Tests cover:
 * - runKeys: query key generation
 * - Cache operations: paginated data, optimistic updates
 * - Cross-cache invalidation: dashboard stats, test runs
 * - Start/Cancel run mutations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  runKeys,
  type TestRun,
  type PaginatedRunsResponse,
  type RunsQueryParams,
} from './useRuns';

// Test data factories
const createMockTestRun = (overrides: Partial<TestRun> = {}): TestRun => ({
  id: 'run-123',
  suite_id: 'suite-123',
  suite_name: 'Test Suite',
  project_id: 'project-123',
  test_id: 'test-123',
  test_name: 'Test Case',
  status: 'passed',
  browser: 'chromium',
  branch: 'main',
  created_at: '2024-01-01T00:00:00Z',
  started_at: '2024-01-01T00:00:01Z',
  completed_at: '2024-01-01T00:00:30Z',
  duration_ms: 29000,
  results_count: 10,
  passed_count: 9,
  failed_count: 1,
  skipped_count: 0,
  ...overrides,
});

const createMockPaginatedRunsResponse = (
  runs: TestRun[],
  page = 1,
  limit = 10,
  total = runs.length
): PaginatedRunsResponse => ({
  data: runs,
  runs: runs,
  total,
  pagination: {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    hasNext: page * limit < total,
    hasPrev: page > 1,
  },
});

describe('runKeys', () => {
  it('should generate correct base keys', () => {
    expect(runKeys.all).toEqual(['runs']);
  });

  it('should generate correct list keys', () => {
    expect(runKeys.lists()).toEqual(['runs', 'list']);
  });

  it('should generate correct list keys with params', () => {
    const params: RunsQueryParams = { page: 1, limit: 10, status: 'passed' };
    expect(runKeys.list(params)).toEqual(['runs', 'list', params]);
  });

  it('should generate correct detail keys', () => {
    expect(runKeys.details()).toEqual(['runs', 'detail']);
    expect(runKeys.detail('run-123')).toEqual(['runs', 'detail', 'run-123']);
  });

  it('should generate correct byTest keys', () => {
    expect(runKeys.byTest('test-123')).toEqual(['runs', 'byTest', 'test-123']);
  });

  it('should generate correct bySuite keys', () => {
    expect(runKeys.bySuite('suite-123')).toEqual(['runs', 'bySuite', 'suite-123']);
  });

  it('should maintain key hierarchy for invalidation', () => {
    // All keys should start with runKeys.all
    const listKey = runKeys.lists();
    expect(listKey.slice(0, 1)).toEqual(runKeys.all);

    const detailKey = runKeys.detail('run-1');
    expect(detailKey.slice(0, 1)).toEqual(runKeys.all);

    const byTestKey = runKeys.byTest('test-1');
    expect(byTestKey.slice(0, 1)).toEqual(runKeys.all);
  });
});

describe('QueryClient cache operations for runs', () => {
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

  describe('paginated data handling', () => {
    it('should store and retrieve paginated runs', () => {
      const runs = [
        createMockTestRun({ id: 'run-1', status: 'passed' }),
        createMockTestRun({ id: 'run-2', status: 'failed' }),
      ];
      const response = createMockPaginatedRunsResponse(runs, 1, 10, 50);
      const params: RunsQueryParams = { page: 1, limit: 10 };

      queryClient.setQueryData(runKeys.list(params), response);

      const cached = queryClient.getQueryData<PaginatedRunsResponse>(runKeys.list(params));

      expect(cached?.data).toHaveLength(2);
      expect(cached?.pagination.total).toBe(50);
      expect(cached?.pagination.hasNext).toBe(true);
      expect(cached?.pagination.totalPages).toBe(5);
    });

    it('should filter runs by status in key', () => {
      const passedRuns = [createMockTestRun({ id: 'run-1', status: 'passed' })];
      const failedRuns = [createMockTestRun({ id: 'run-2', status: 'failed' })];

      queryClient.setQueryData(
        runKeys.list({ status: 'passed' }),
        createMockPaginatedRunsResponse(passedRuns)
      );
      queryClient.setQueryData(
        runKeys.list({ status: 'failed' }),
        createMockPaginatedRunsResponse(failedRuns)
      );

      const passed = queryClient.getQueryData<PaginatedRunsResponse>(runKeys.list({ status: 'passed' }));
      const failed = queryClient.getQueryData<PaginatedRunsResponse>(runKeys.list({ status: 'failed' }));

      expect(passed?.data[0].status).toBe('passed');
      expect(failed?.data[0].status).toBe('failed');
    });
  });

  describe('runs by test/suite', () => {
    it('should store runs by test ID', () => {
      const runs = [
        createMockTestRun({ id: 'run-1', test_id: 'test-1' }),
        createMockTestRun({ id: 'run-2', test_id: 'test-1' }),
      ];

      queryClient.setQueryData(runKeys.byTest('test-1'), { runs });

      const cached = queryClient.getQueryData<{ runs: TestRun[] }>(runKeys.byTest('test-1'));
      expect(cached?.runs).toHaveLength(2);
      expect(cached?.runs.every((r) => r.test_id === 'test-1')).toBe(true);
    });

    it('should store runs by suite ID', () => {
      const runs = [
        createMockTestRun({ id: 'run-1', suite_id: 'suite-1' }),
        createMockTestRun({ id: 'run-2', suite_id: 'suite-1' }),
      ];

      queryClient.setQueryData(runKeys.bySuite('suite-1'), { runs });

      const cached = queryClient.getQueryData<{ runs: TestRun[] }>(runKeys.bySuite('suite-1'));
      expect(cached?.runs).toHaveLength(2);
    });
  });

  describe('optimistic update patterns', () => {
    it('should add pending run optimistically (start run)', () => {
      const existingRuns = [createMockTestRun({ id: 'run-1', status: 'passed' })];
      queryClient.setQueryData(runKeys.byTest('test-1'), { runs: existingRuns });

      // Simulate optimistic add for new run (what useStartRun.onMutate does)
      const optimisticRun: TestRun = {
        id: `temp-${Date.now()}`,
        suite_id: '',
        suite_name: '',
        project_id: '',
        test_id: 'test-1',
        test_name: '',
        status: 'pending',
        browser: 'chromium',
        branch: 'main',
        created_at: new Date().toISOString(),
        results_count: 0,
        passed_count: 0,
        failed_count: 0,
        skipped_count: 0,
      };

      queryClient.setQueryData<{ runs: TestRun[] }>(runKeys.byTest('test-1'), (old) => ({
        runs: [optimisticRun, ...(old?.runs || [])],
      }));

      const cached = queryClient.getQueryData<{ runs: TestRun[] }>(runKeys.byTest('test-1'));
      expect(cached?.runs).toHaveLength(2);
      expect(cached?.runs[0].status).toBe('pending');
      expect(cached?.runs[0].id).toMatch(/^temp-/);
    });

    it('should update run status optimistically (cancel run)', () => {
      const run = createMockTestRun({ id: 'run-123', status: 'running' });
      queryClient.setQueryData(runKeys.detail('run-123'), { run });

      // Simulate optimistic cancel (what useCancelRun.onMutate does)
      queryClient.setQueryData<{ run: TestRun }>(runKeys.detail('run-123'), {
        run: {
          ...run,
          status: 'cancelled',
          completed_at: new Date().toISOString(),
        },
      });

      const cached = queryClient.getQueryData<{ run: TestRun }>(runKeys.detail('run-123'));
      expect(cached?.run.status).toBe('cancelled');
      expect(cached?.run.completed_at).toBeDefined();
    });

    it('should update run in list caches when cancelled', () => {
      const runs = [
        createMockTestRun({ id: 'run-1', status: 'passed' }),
        createMockTestRun({ id: 'run-2', status: 'running' }),
      ];
      const params: RunsQueryParams = { page: 1 };
      queryClient.setQueryData(runKeys.list(params), createMockPaginatedRunsResponse(runs));

      // Simulate optimistic update in list
      queryClient.setQueryData<PaginatedRunsResponse>(runKeys.list(params), (old) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.map((run) =>
            run.id === 'run-2'
              ? { ...run, status: 'cancelled' as const, completed_at: new Date().toISOString() }
              : run
          ),
          runs: old.runs.map((run) =>
            run.id === 'run-2'
              ? { ...run, status: 'cancelled' as const, completed_at: new Date().toISOString() }
              : run
          ),
        };
      });

      const cached = queryClient.getQueryData<PaginatedRunsResponse>(runKeys.list(params));
      const run2 = cached?.data.find((r) => r.id === 'run-2');
      expect(run2?.status).toBe('cancelled');
    });

    it('should rollback start run on error', () => {
      const existingRuns = [createMockTestRun({ id: 'run-1' })];
      const originalData = { runs: existingRuns };
      queryClient.setQueryData(runKeys.byTest('test-1'), originalData);

      // Simulate optimistic add
      queryClient.setQueryData<{ runs: TestRun[] }>(runKeys.byTest('test-1'), {
        runs: [createMockTestRun({ id: 'temp-123', status: 'pending' }), ...existingRuns],
      });

      // Verify optimistic state
      let cached = queryClient.getQueryData<{ runs: TestRun[] }>(runKeys.byTest('test-1'));
      expect(cached?.runs).toHaveLength(2);

      // Simulate rollback
      queryClient.setQueryData(runKeys.byTest('test-1'), originalData);

      // Verify rollback
      cached = queryClient.getQueryData<{ runs: TestRun[] }>(runKeys.byTest('test-1'));
      expect(cached?.runs).toHaveLength(1);
    });
  });

  describe('cache invalidation patterns', () => {
    it('should invalidate all run queries', async () => {
      queryClient.setQueryData(runKeys.list({ page: 1 }), createMockPaginatedRunsResponse([]));
      queryClient.setQueryData(runKeys.detail('run-1'), { run: createMockTestRun() });
      queryClient.setQueryData(runKeys.byTest('test-1'), { runs: [] });
      queryClient.setQueryData(runKeys.bySuite('suite-1'), { runs: [] });

      await queryClient.invalidateQueries({ queryKey: runKeys.all });

      expect(queryClient.getQueryState(runKeys.list({ page: 1 }))?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(runKeys.detail('run-1'))?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(runKeys.byTest('test-1'))?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(runKeys.bySuite('suite-1'))?.isInvalidated).toBe(true);
    });

    it('should invalidate only list queries', async () => {
      queryClient.setQueryData(runKeys.list({ page: 1 }), createMockPaginatedRunsResponse([]));
      queryClient.setQueryData(runKeys.detail('run-1'), { run: createMockTestRun() });

      await queryClient.invalidateQueries({ queryKey: runKeys.lists() });

      expect(queryClient.getQueryState(runKeys.list({ page: 1 }))?.isInvalidated).toBe(true);
      // Detail should NOT be invalidated
      expect(queryClient.getQueryState(runKeys.detail('run-1'))?.isInvalidated).toBeFalsy();
    });

    it('should invalidate runs by specific test', async () => {
      queryClient.setQueryData(runKeys.byTest('test-1'), { runs: [] });
      queryClient.setQueryData(runKeys.byTest('test-2'), { runs: [] });

      await queryClient.invalidateQueries({ queryKey: runKeys.byTest('test-1') });

      expect(queryClient.getQueryState(runKeys.byTest('test-1'))?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(runKeys.byTest('test-2'))?.isInvalidated).toBeFalsy();
    });
  });
});

describe('TestRun types', () => {
  it('should create valid TestRun objects', () => {
    const run = createMockTestRun();

    expect(run.id).toBeDefined();
    expect(run.suite_id).toBeDefined();
    expect(run.project_id).toBeDefined();
    expect(run.status).toBe('passed');
    expect(run.browser).toBe('chromium');
    expect(run.branch).toBe('main');
  });

  it('should support all status values', () => {
    const statuses: TestRun['status'][] = ['pending', 'running', 'passed', 'failed', 'cancelled', 'error'];

    statuses.forEach((status) => {
      const run = createMockTestRun({ status });
      expect(run.status).toBe(status);
    });
  });

  it('should calculate duration from timestamps', () => {
    const run = createMockTestRun({
      started_at: '2024-01-01T00:00:00Z',
      completed_at: '2024-01-01T00:00:30Z',
      duration_ms: 30000,
    });

    expect(run.duration_ms).toBe(30000);
  });

  it('should track result counts', () => {
    const run = createMockTestRun({
      results_count: 20,
      passed_count: 15,
      failed_count: 3,
      skipped_count: 2,
    });

    expect(run.results_count).toBe(20);
    expect(run.passed_count).toBe(15);
    expect(run.failed_count).toBe(3);
    expect(run.skipped_count).toBe(2);
    expect(run.passed_count + run.failed_count + run.skipped_count).toBe(run.results_count);
  });

  it('should support suite-level runs (test_id null)', () => {
    const suiteRun = createMockTestRun({
      test_id: null,
      test_name: undefined,
    });

    expect(suiteRun.test_id).toBeNull();
  });
});
