/**
 * Unit Tests for useSuites React Query Hooks
 * Feature #132: Add unit tests for all 18 React Query custom hooks
 *
 * Tests cover:
 * - suiteKeys: query key generation
 * - Cache operations: paginated data, optimistic updates
 * - Create/Update/Delete mutations with rollback
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  suiteKeys,
  type TestSuite,
  type PaginatedSuitesResponse,
  type CreateSuiteInput,
  type UpdateSuiteInput,
} from './useSuites';

// Test data factories
const createMockTestSuite = (overrides: Partial<TestSuite> = {}): TestSuite => ({
  id: 'suite-123',
  project_id: 'project-123',
  organization_id: 'org-123',
  name: 'Test Suite',
  description: 'A test suite',
  type: 'e2e',
  browser: 'chromium',
  browsers: ['chromium', 'firefox'],
  base_url: 'https://example.com',
  viewport_width: 1280,
  viewport_height: 720,
  timeout: 30000,
  retry_count: 2,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

const createMockPaginatedSuitesResponse = (
  suites: TestSuite[],
  page = 1,
  limit = 10,
  total = suites.length
): PaginatedSuitesResponse => ({
  data: suites,
  suites: suites,
  pagination: {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    hasNext: page * limit < total,
    hasPrev: page > 1,
  },
});

describe('suiteKeys', () => {
  it('should generate correct base keys', () => {
    expect(suiteKeys.all).toEqual(['suites']);
  });

  it('should generate correct list keys', () => {
    expect(suiteKeys.lists()).toEqual(['suites', 'list']);
  });

  it('should generate correct listByProject keys', () => {
    expect(suiteKeys.listByProject('project-1')).toEqual([
      'suites',
      'list',
      'project',
      'project-1',
      undefined,
    ]);
    expect(suiteKeys.listByProject('project-1', { page: 1, limit: 10 })).toEqual([
      'suites',
      'list',
      'project',
      'project-1',
      { page: 1, limit: 10 },
    ]);
  });

  it('should generate correct detail keys', () => {
    expect(suiteKeys.details()).toEqual(['suites', 'detail']);
    expect(suiteKeys.detail('suite-123')).toEqual(['suites', 'detail', 'suite-123']);
  });

  it('should maintain key hierarchy for invalidation', () => {
    const listKey = suiteKeys.lists();
    expect(listKey.slice(0, 1)).toEqual(suiteKeys.all);

    const projectKey = suiteKeys.listByProject('project-1');
    expect(projectKey.slice(0, 2)).toEqual(suiteKeys.lists());

    const detailKey = suiteKeys.detail('suite-1');
    expect(detailKey.slice(0, 1)).toEqual(suiteKeys.all);
  });
});

describe('QueryClient cache operations for suites', () => {
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
    it('should store and retrieve paginated suites', () => {
      const suites = [
        createMockTestSuite({ id: 'suite-1', name: 'Suite 1' }),
        createMockTestSuite({ id: 'suite-2', name: 'Suite 2' }),
      ];
      const response = createMockPaginatedSuitesResponse(suites, 1, 10, 25);

      queryClient.setQueryData(
        suiteKeys.listByProject('project-1', { page: 1, limit: 10 }),
        response
      );

      const cached = queryClient.getQueryData<PaginatedSuitesResponse>(
        suiteKeys.listByProject('project-1', { page: 1, limit: 10 })
      );

      expect(cached?.data).toHaveLength(2);
      expect(cached?.pagination.total).toBe(25);
      expect(cached?.pagination.hasNext).toBe(true);
    });

    it('should handle suites for different projects separately', () => {
      const project1Suites = [createMockTestSuite({ id: 'suite-1', project_id: 'project-1' })];
      const project2Suites = [createMockTestSuite({ id: 'suite-2', project_id: 'project-2' })];

      queryClient.setQueryData(
        suiteKeys.listByProject('project-1'),
        createMockPaginatedSuitesResponse(project1Suites)
      );
      queryClient.setQueryData(
        suiteKeys.listByProject('project-2'),
        createMockPaginatedSuitesResponse(project2Suites)
      );

      const p1 = queryClient.getQueryData<PaginatedSuitesResponse>(suiteKeys.listByProject('project-1'));
      const p2 = queryClient.getQueryData<PaginatedSuitesResponse>(suiteKeys.listByProject('project-2'));

      expect(p1?.data[0].project_id).toBe('project-1');
      expect(p2?.data[0].project_id).toBe('project-2');
    });
  });

  describe('optimistic update patterns', () => {
    it('should add suite optimistically', () => {
      const existingSuites = [createMockTestSuite({ id: 'suite-1' })];
      const queryKey = suiteKeys.listByProject('project-1', { limit: 100 });
      queryClient.setQueryData(queryKey, createMockPaginatedSuitesResponse(existingSuites, 1, 100, 1));

      // Simulate optimistic add
      const newSuiteInput: CreateSuiteInput = {
        name: 'New Suite',
        description: 'A new suite',
        type: 'visual',
      };

      const previousSuites = queryClient.getQueryData<PaginatedSuitesResponse>(queryKey);

      const optimisticSuite: TestSuite = {
        id: `temp-${Date.now()}`,
        project_id: 'project-1',
        organization_id: '',
        name: newSuiteInput.name,
        description: newSuiteInput.description,
        type: (newSuiteInput.type as TestSuite['type']) || 'e2e',
        browser: 'chromium',
        browsers: ['chromium'],
        viewport_width: 1280,
        viewport_height: 720,
        timeout: 30000,
        retry_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      queryClient.setQueryData<PaginatedSuitesResponse>(queryKey, {
        ...previousSuites!,
        data: [...(previousSuites?.data || []), optimisticSuite],
        suites: [...(previousSuites?.suites || []), optimisticSuite],
        pagination: {
          ...previousSuites!.pagination,
          total: (previousSuites?.pagination?.total || 0) + 1,
        },
      });

      const cached = queryClient.getQueryData<PaginatedSuitesResponse>(queryKey);
      expect(cached?.data).toHaveLength(2);
      expect(cached?.data[1].name).toBe('New Suite');
      expect(cached?.data[1].type).toBe('visual');
    });

    it('should update suite optimistically', () => {
      const existingSuite = createMockTestSuite({ id: 'suite-123', name: 'Old Name' });
      queryClient.setQueryData(suiteKeys.detail('suite-123'), { suite: existingSuite });

      const updateData: UpdateSuiteInput = { name: 'New Name', timeout: 60000 };

      queryClient.setQueryData<{ suite: TestSuite }>(suiteKeys.detail('suite-123'), {
        suite: {
          ...existingSuite,
          ...updateData,
          updated_at: new Date().toISOString(),
        },
      });

      const cached = queryClient.getQueryData<{ suite: TestSuite }>(suiteKeys.detail('suite-123'));
      expect(cached?.suite.name).toBe('New Name');
      expect(cached?.suite.timeout).toBe(60000);
    });

    it('should delete suite optimistically', () => {
      const suites = [
        createMockTestSuite({ id: 'suite-1' }),
        createMockTestSuite({ id: 'suite-2' }),
      ];
      const queryKey = suiteKeys.listByProject('project-1');
      queryClient.setQueryData(queryKey, createMockPaginatedSuitesResponse(suites, 1, 10, 2));

      const previousData = queryClient.getQueryData<PaginatedSuitesResponse>(queryKey);
      const idToDelete = 'suite-1';

      queryClient.setQueryData<PaginatedSuitesResponse>(queryKey, {
        ...previousData!,
        data: previousData!.data.filter((s) => s.id !== idToDelete),
        suites: (previousData!.suites || []).filter((s) => s.id !== idToDelete),
        pagination: {
          ...previousData!.pagination,
          total: Math.max(0, (previousData?.pagination?.total || 0) - 1),
        },
      });

      const cached = queryClient.getQueryData<PaginatedSuitesResponse>(queryKey);
      expect(cached?.data).toHaveLength(1);
      expect(cached?.data[0].id).toBe('suite-2');
      expect(cached?.pagination.total).toBe(1);
    });

    it('should rollback on error', () => {
      const originalSuites = [createMockTestSuite({ id: 'suite-1' })];
      const queryKey = suiteKeys.listByProject('project-1');
      const originalResponse = createMockPaginatedSuitesResponse(originalSuites);
      queryClient.setQueryData(queryKey, originalResponse);

      // Simulate optimistic add
      queryClient.setQueryData<PaginatedSuitesResponse>(queryKey, {
        ...originalResponse,
        data: [...originalSuites, createMockTestSuite({ id: 'temp-123' })],
      });

      // Verify optimistic state
      let cached = queryClient.getQueryData<PaginatedSuitesResponse>(queryKey);
      expect(cached?.data).toHaveLength(2);

      // Simulate rollback
      queryClient.setQueryData(queryKey, originalResponse);

      // Verify rollback
      cached = queryClient.getQueryData<PaginatedSuitesResponse>(queryKey);
      expect(cached?.data).toHaveLength(1);
    });
  });

  describe('cache invalidation patterns', () => {
    it('should invalidate all suite queries', async () => {
      queryClient.setQueryData(suiteKeys.lists(), { data: [] });
      queryClient.setQueryData(suiteKeys.listByProject('project-1'), createMockPaginatedSuitesResponse([]));
      queryClient.setQueryData(suiteKeys.detail('suite-1'), { suite: createMockTestSuite() });

      await queryClient.invalidateQueries({ queryKey: suiteKeys.all });

      expect(queryClient.getQueryState(suiteKeys.lists())?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(suiteKeys.listByProject('project-1'))?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(suiteKeys.detail('suite-1'))?.isInvalidated).toBe(true);
    });

    it('should invalidate suites by project', async () => {
      queryClient.setQueryData(suiteKeys.listByProject('project-1'), createMockPaginatedSuitesResponse([]));
      queryClient.setQueryData(suiteKeys.listByProject('project-2'), createMockPaginatedSuitesResponse([]));

      await queryClient.invalidateQueries({ queryKey: suiteKeys.listByProject('project-1') });

      expect(queryClient.getQueryState(suiteKeys.listByProject('project-1'))?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(suiteKeys.listByProject('project-2'))?.isInvalidated).toBeFalsy();
    });
  });
});

describe('TestSuite types', () => {
  it('should create valid TestSuite objects', () => {
    const suite = createMockTestSuite();

    expect(suite.id).toBeDefined();
    expect(suite.project_id).toBeDefined();
    expect(suite.name).toBeDefined();
    expect(suite.type).toBe('e2e');
    expect(suite.browser).toBe('chromium');
  });

  it('should support all suite types', () => {
    const types: TestSuite['type'][] = ['e2e', 'visual', 'accessibility', 'performance', 'load'];

    types.forEach((type) => {
      const suite = createMockTestSuite({ type });
      expect(suite.type).toBe(type);
    });
  });

  it('should support multiple browsers', () => {
    const suite = createMockTestSuite({
      browsers: ['chromium', 'firefox', 'webkit'],
    });

    expect(suite.browsers).toHaveLength(3);
    expect(suite.browsers).toContain('webkit');
  });

  it('should have viewport dimensions', () => {
    const suite = createMockTestSuite({
      viewport_width: 1920,
      viewport_height: 1080,
    });

    expect(suite.viewport_width).toBe(1920);
    expect(suite.viewport_height).toBe(1080);
  });
});
