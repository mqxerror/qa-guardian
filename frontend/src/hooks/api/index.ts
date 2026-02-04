/**
 * API Hooks - Re-exports all React Query hooks for API data fetching
 * Feature #56: Create React Query hooks for API data fetching
 *
 * Usage:
 *   import { useRunsPaginated, useProjects, useSuite } from '@/hooks/api';
 *
 * These hooks provide:
 * - Automatic caching via React Query
 * - Automatic refetching on window focus
 * - Loading and error states
 * - Optimistic updates for mutations
 * - Cache invalidation helpers
 */

// Runs hooks
export {
  useRuns,
  useRunsPaginated,
  useRunsInfinite,
  useRun,
  useRunsByTest,
  useRunsBySuite,
  useInvalidateRuns,
  runKeys,
  type TestRun,
  type PaginatedRunsResponse,
  type RunsQueryParams,
} from './useRuns';

// Projects hooks
export {
  useProjects,
  useProject,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  useInvalidateProjects,
  projectKeys,
  type Project,
  type ProjectsResponse,
  type CreateProjectInput,
  type UpdateProjectInput,
} from './useProjects';

// Suites hooks
export {
  useSuites,
  useSuitesPaginated,
  useSuite,
  useCreateSuite,
  useUpdateSuite,
  useDeleteSuite,
  useInvalidateSuites,
  suiteKeys,
  type TestSuite,
  type PaginatedSuitesResponse,
  type SuitesQueryParams,
  type CreateSuiteInput,
  type UpdateSuiteInput,
} from './useSuites';

// Tests hooks
export {
  useTests,
  useTestsPaginated,
  useTest,
  useTestCode,
  useCreateTest,
  useUpdateTest,
  useDeleteTest,
  useInvalidateTests,
  testKeys,
  type Test,
  type TestStep,
  type PaginatedTestsResponse,
  type TestsQueryParams,
  type CreateTestInput,
  type UpdateTestInput,
} from './useTests';
