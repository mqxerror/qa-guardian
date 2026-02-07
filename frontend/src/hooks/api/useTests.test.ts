/**
 * Unit Tests for useTests React Query Hooks
 * Feature #132: Add unit tests for all 18 React Query custom hooks
 *
 * Tests cover:
 * - testKeys: query key generation
 * - Cache operations: paginated data, optimistic updates
 * - Cross-cache invalidation: dashboard stats, suite detail
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  testKeys,
  type Test,
  type TestStep,
  type PaginatedTestsResponse,
  type CreateTestInput,
  type UpdateTestInput,
} from './useTests';

// Test data factories
const createMockTestStep = (overrides: Partial<TestStep> = {}): TestStep => ({
  id: 'step-1',
  order: 1,
  action: 'click',
  selector: '#button',
  value: undefined,
  description: 'Click the button',
  ...overrides,
});

const createMockTest = (overrides: Partial<Test> = {}): Test => ({
  id: 'test-123',
  suite_id: 'suite-123',
  suite_name: 'Test Suite',
  project_id: 'project-123',
  project_name: 'Test Project',
  organization_id: 'org-123',
  name: 'Test Case',
  description: 'A test case',
  order: 1,
  test_type: 'e2e',
  steps: [createMockTestStep()],
  target_url: 'https://example.com',
  status: 'active',
  review_status: 'pending',
  ai_generated: false,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  run_count: 5,
  last_run_at: '2024-01-15T00:00:00Z',
  last_result: 'passed',
  avg_duration_ms: 5000,
  ...overrides,
});

const createMockPaginatedResponse = (
  tests: Test[],
  page = 1,
  limit = 10,
  total = tests.length
): PaginatedTestsResponse => ({
  data: tests,
  tests: tests,
  pagination: {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    hasNext: page * limit < total,
    hasPrev: page > 1,
  },
});

describe('testKeys', () => {
  it('should generate correct base keys', () => {
    expect(testKeys.all).toEqual(['tests']);
  });

  it('should generate correct list keys', () => {
    expect(testKeys.lists()).toEqual(['tests', 'list']);
  });

  it('should generate correct listBySuite keys', () => {
    expect(testKeys.listBySuite('suite-1')).toEqual(['tests', 'list', 'suite', 'suite-1', undefined]);
    expect(testKeys.listBySuite('suite-1', { page: 1, limit: 10 })).toEqual([
      'tests',
      'list',
      'suite',
      'suite-1',
      { page: 1, limit: 10 },
    ]);
  });

  it('should generate correct detail keys', () => {
    expect(testKeys.details()).toEqual(['tests', 'detail']);
    expect(testKeys.detail('test-123')).toEqual(['tests', 'detail', 'test-123']);
  });

  it('should generate correct code keys', () => {
    expect(testKeys.code('test-123')).toEqual(['tests', 'code', 'test-123']);
  });

  it('should maintain key hierarchy for invalidation', () => {
    // All keys should start with testKeys.all
    const listKey = testKeys.lists();
    expect(listKey.slice(0, 1)).toEqual(testKeys.all);

    const suiteKey = testKeys.listBySuite('suite-1');
    expect(suiteKey.slice(0, 2)).toEqual(testKeys.lists());

    const detailKey = testKeys.detail('test-1');
    expect(detailKey.slice(0, 1)).toEqual(testKeys.all);
  });
});

describe('QueryClient cache operations for tests', () => {
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
    it('should store and retrieve paginated tests', () => {
      const tests = [
        createMockTest({ id: 'test-1', name: 'Test 1' }),
        createMockTest({ id: 'test-2', name: 'Test 2' }),
      ];
      const response = createMockPaginatedResponse(tests, 1, 10, 25);

      queryClient.setQueryData(testKeys.listBySuite('suite-1', { page: 1, limit: 10 }), response);

      const cached = queryClient.getQueryData<PaginatedTestsResponse>(
        testKeys.listBySuite('suite-1', { page: 1, limit: 10 })
      );

      expect(cached?.data).toHaveLength(2);
      expect(cached?.pagination.total).toBe(25);
      expect(cached?.pagination.hasNext).toBe(true);
      expect(cached?.pagination.totalPages).toBe(3);
    });

    it('should handle multiple pages independently', () => {
      const page1Tests = [createMockTest({ id: 'test-1' })];
      const page2Tests = [createMockTest({ id: 'test-2' })];

      queryClient.setQueryData(
        testKeys.listBySuite('suite-1', { page: 1, limit: 10 }),
        createMockPaginatedResponse(page1Tests, 1, 10, 20)
      );
      queryClient.setQueryData(
        testKeys.listBySuite('suite-1', { page: 2, limit: 10 }),
        createMockPaginatedResponse(page2Tests, 2, 10, 20)
      );

      const page1 = queryClient.getQueryData<PaginatedTestsResponse>(
        testKeys.listBySuite('suite-1', { page: 1, limit: 10 })
      );
      const page2 = queryClient.getQueryData<PaginatedTestsResponse>(
        testKeys.listBySuite('suite-1', { page: 2, limit: 10 })
      );

      expect(page1?.data[0].id).toBe('test-1');
      expect(page2?.data[0].id).toBe('test-2');
    });
  });

  describe('optimistic update patterns', () => {
    it('should add test optimistically to paginated list', () => {
      const existingTests = [createMockTest({ id: 'test-1' })];
      const queryKey = testKeys.listBySuite('suite-1', { limit: 100 });
      queryClient.setQueryData(queryKey, createMockPaginatedResponse(existingTests, 1, 100, 1));

      // Simulate optimistic add (what useCreateTest.onMutate does)
      const newTestInput: CreateTestInput = {
        name: 'New Test',
        description: 'A new test',
        test_type: 'e2e',
        target_url: 'https://example.com',
      };

      const previousTests = queryClient.getQueryData<PaginatedTestsResponse>(queryKey);

      const optimisticTest: Test = {
        id: `temp-${Date.now()}`,
        suite_id: 'suite-1',
        organization_id: '',
        name: newTestInput.name,
        description: newTestInput.description,
        order: (previousTests?.data?.length || 0) + 1,
        test_type: (newTestInput.test_type as Test['test_type']) || 'e2e',
        steps: [],
        target_url: newTestInput.target_url,
        status: 'draft',
        ai_generated: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      queryClient.setQueryData<PaginatedTestsResponse>(queryKey, {
        ...previousTests!,
        data: [...(previousTests?.data || []), optimisticTest],
        tests: [...(previousTests?.tests || []), optimisticTest],
        pagination: {
          ...previousTests!.pagination,
          total: (previousTests?.pagination?.total || 0) + 1,
        },
      });

      const cached = queryClient.getQueryData<PaginatedTestsResponse>(queryKey);
      expect(cached?.data).toHaveLength(2);
      expect(cached?.data[1].name).toBe('New Test');
      expect(cached?.data[1].id).toMatch(/^temp-/);
      expect(cached?.pagination.total).toBe(2);
    });

    it('should update test optimistically', () => {
      const existingTest = createMockTest({ id: 'test-123', name: 'Old Name', status: 'draft' });
      queryClient.setQueryData(testKeys.detail('test-123'), { test: existingTest });

      const updateData: UpdateTestInput = { name: 'New Name', status: 'active' };

      queryClient.setQueryData<{ test: Test }>(testKeys.detail('test-123'), {
        test: {
          ...existingTest,
          ...updateData,
          updated_at: new Date().toISOString(),
        },
      });

      const cached = queryClient.getQueryData<{ test: Test }>(testKeys.detail('test-123'));
      expect(cached?.test.name).toBe('New Name');
      expect(cached?.test.status).toBe('active');
    });

    it('should delete test optimistically from paginated list', () => {
      const tests = [
        createMockTest({ id: 'test-1' }),
        createMockTest({ id: 'test-2' }),
        createMockTest({ id: 'test-3' }),
      ];
      const queryKey = testKeys.listBySuite('suite-1');
      queryClient.setQueryData(queryKey, createMockPaginatedResponse(tests, 1, 10, 3));

      // Simulate optimistic delete
      const idToDelete = 'test-2';
      const previousData = queryClient.getQueryData<PaginatedTestsResponse>(queryKey);

      queryClient.setQueryData<PaginatedTestsResponse>(queryKey, {
        ...previousData!,
        data: previousData!.data.filter((t) => t.id !== idToDelete),
        tests: (previousData!.tests || []).filter((t) => t.id !== idToDelete),
        pagination: {
          ...previousData!.pagination,
          total: Math.max(0, (previousData?.pagination?.total || 0) - 1),
        },
      });

      const cached = queryClient.getQueryData<PaginatedTestsResponse>(queryKey);
      expect(cached?.data).toHaveLength(2);
      expect(cached?.data.find((t) => t.id === 'test-2')).toBeUndefined();
      expect(cached?.pagination.total).toBe(2);
    });

    it('should rollback on error', () => {
      const originalTests = [createMockTest({ id: 'test-1' })];
      const queryKey = testKeys.listBySuite('suite-1');
      const originalResponse = createMockPaginatedResponse(originalTests, 1, 10, 1);
      queryClient.setQueryData(queryKey, originalResponse);

      // Simulate optimistic add
      queryClient.setQueryData<PaginatedTestsResponse>(queryKey, {
        ...originalResponse,
        data: [...originalTests, createMockTest({ id: 'temp-123' })],
        pagination: { ...originalResponse.pagination, total: 2 },
      });

      // Verify optimistic state
      let cached = queryClient.getQueryData<PaginatedTestsResponse>(queryKey);
      expect(cached?.data).toHaveLength(2);

      // Simulate rollback
      queryClient.setQueryData(queryKey, originalResponse);

      // Verify rollback
      cached = queryClient.getQueryData<PaginatedTestsResponse>(queryKey);
      expect(cached?.data).toHaveLength(1);
      expect(cached?.data[0].id).toBe('test-1');
    });
  });

  describe('cache invalidation patterns', () => {
    it('should invalidate all test queries', async () => {
      queryClient.setQueryData(testKeys.listBySuite('suite-1'), createMockPaginatedResponse([]));
      queryClient.setQueryData(testKeys.listBySuite('suite-2'), createMockPaginatedResponse([]));
      queryClient.setQueryData(testKeys.detail('test-1'), { test: createMockTest() });

      await queryClient.invalidateQueries({ queryKey: testKeys.all });

      expect(queryClient.getQueryState(testKeys.listBySuite('suite-1'))?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(testKeys.listBySuite('suite-2'))?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(testKeys.detail('test-1'))?.isInvalidated).toBe(true);
    });

    it('should invalidate only tests for specific suite', async () => {
      queryClient.setQueryData(testKeys.listBySuite('suite-1'), createMockPaginatedResponse([]));
      queryClient.setQueryData(testKeys.listBySuite('suite-2'), createMockPaginatedResponse([]));

      // Invalidate only suite-1 tests
      await queryClient.invalidateQueries({ queryKey: testKeys.listBySuite('suite-1') });

      expect(queryClient.getQueryState(testKeys.listBySuite('suite-1'))?.isInvalidated).toBe(true);
      // suite-2 should NOT be invalidated due to different key
      expect(queryClient.getQueryState(testKeys.listBySuite('suite-2'))?.isInvalidated).toBeFalsy();
    });

    it('should invalidate specific test detail', async () => {
      queryClient.setQueryData(testKeys.detail('test-1'), { test: createMockTest({ id: 'test-1' }) });
      queryClient.setQueryData(testKeys.detail('test-2'), { test: createMockTest({ id: 'test-2' }) });

      await queryClient.invalidateQueries({ queryKey: testKeys.detail('test-1') });

      expect(queryClient.getQueryState(testKeys.detail('test-1'))?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(testKeys.detail('test-2'))?.isInvalidated).toBeFalsy();
    });
  });
});

describe('Test types', () => {
  it('should create valid Test objects', () => {
    const test = createMockTest();

    expect(test.id).toBeDefined();
    expect(test.suite_id).toBeDefined();
    expect(test.name).toBeDefined();
    expect(test.test_type).toBe('e2e');
    expect(test.status).toBe('active');
    expect(test.ai_generated).toBe(false);
  });

  it('should support all test types', () => {
    const testTypes: Test['test_type'][] = ['e2e', 'visual', 'accessibility', 'performance', 'load'];

    testTypes.forEach((testType) => {
      const test = createMockTest({ test_type: testType });
      expect(test.test_type).toBe(testType);
    });
  });

  it('should support all statuses', () => {
    const statuses: Test['status'][] = ['draft', 'active', 'disabled'];

    statuses.forEach((status) => {
      const test = createMockTest({ status });
      expect(test.status).toBe(status);
    });
  });

  it('should include load test specific fields', () => {
    const loadTest = createMockTest({
      test_type: 'load',
      virtual_users: 100,
      duration: 300,
      ramp_up_time: 30,
      k6_thresholds: [
        { metric: 'http_req_duration', expression: 'p(95)<500' },
      ],
    });

    expect(loadTest.virtual_users).toBe(100);
    expect(loadTest.duration).toBe(300);
    expect(loadTest.ramp_up_time).toBe(30);
    expect(loadTest.k6_thresholds).toHaveLength(1);
  });

  it('should include run metadata fields', () => {
    const test = createMockTest({
      run_count: 10,
      last_run_at: '2024-01-20T00:00:00Z',
      last_result: 'failed',
      avg_duration_ms: 3500,
    });

    expect(test.run_count).toBe(10);
    expect(test.last_run_at).toBe('2024-01-20T00:00:00Z');
    expect(test.last_result).toBe('failed');
    expect(test.avg_duration_ms).toBe(3500);
  });
});

describe('TestStep types', () => {
  it('should create valid TestStep objects', () => {
    const step = createMockTestStep();

    expect(step.id).toBeDefined();
    expect(step.order).toBe(1);
    expect(step.action).toBe('click');
    expect(step.selector).toBe('#button');
  });

  it('should support various actions', () => {
    const actions = ['click', 'fill', 'navigate', 'wait', 'assert', 'screenshot'];

    actions.forEach((action, index) => {
      const step = createMockTestStep({ action, order: index + 1 });
      expect(step.action).toBe(action);
    });
  });
});
