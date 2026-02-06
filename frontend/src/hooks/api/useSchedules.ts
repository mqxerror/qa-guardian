/**
 * React Query hooks for Schedules API
 * Feature #74: Migrate SchedulesPage to React Query with caching
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';

// Types matching SchedulesPage interfaces
export interface Schedule {
  id: string;
  suite_id: string;
  name: string;
  description?: string;
  cron_expression?: string;
  run_at?: string;
  timezone: string;
  enabled: boolean;
  browsers: string[];
  notify_on_failure: boolean;
  created_at: string;
  next_run_at?: string;
  run_count?: number;
  last_run_id?: string;
}

export interface TestSuiteOption {
  id: string;
  name: string;
  project_id: string;
}

export interface SchedulesResponse {
  schedules: Schedule[];
}

export interface CreateScheduleInput {
  name: string;
  description?: string;
  suite_id: string;
  timezone: string;
  enabled: boolean;
  browsers: string[];
  notify_on_failure: boolean;
  cron_expression?: string;
  run_at?: string;
}

export interface UpdateScheduleInput {
  enabled?: boolean;
  name?: string;
  description?: string;
  cron_expression?: string;
  run_at?: string;
  timezone?: string;
  browsers?: string[];
  notify_on_failure?: boolean;
}

// API helper
const fetchWithAuth = async (url: string, token: string | null, options?: RequestInit) => {
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
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || `API error: ${response.status}`);
  }

  return response.json();
};

// Query keys factory for cache management
export const scheduleKeys = {
  all: ['schedules'] as const,
  lists: () => [...scheduleKeys.all, 'list'] as const,
  list: () => [...scheduleKeys.lists()] as const,
  detail: (id: string) => [...scheduleKeys.all, 'detail', id] as const,
  testSuites: () => [...scheduleKeys.all, 'testSuites'] as const,
};

/**
 * Hook to fetch all schedules
 */
export function useSchedules() {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: scheduleKeys.list(),
    queryFn: async () => {
      const data = await fetchWithAuth('/api/v1/schedules', token) as SchedulesResponse;
      return data.schedules;
    },
    enabled: !!token,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 60 * 1000, // Feature #106: 2x staleTime for garbage collection
  });
}

/**
 * Hook to fetch all test suites across all projects for schedule dropdown
 */
export function useTestSuitesForSchedule() {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: scheduleKeys.testSuites(),
    queryFn: async () => {
      // Fetch all projects
      const projectsData = await fetchWithAuth('/api/v1/projects', token) as { projects: Array<{ id: string; name: string }> };

      // Fetch suites for each project
      const allSuites: TestSuiteOption[] = [];

      for (const project of projectsData.projects) {
        try {
          const suitesData = await fetchWithAuth(`/api/v1/projects/${project.id}/suites`, token) as { suites: Array<{ id: string; name: string }> };
          allSuites.push(...suitesData.suites.map((s) => ({
            id: s.id,
            name: `${project.name} / ${s.name}`,
            project_id: project.id,
          })));
        } catch {
          // Skip projects where suites can't be fetched
          console.warn(`Could not fetch suites for project ${project.id}`);
        }
      }

      return allSuites;
    },
    enabled: !!token,
    staleTime: 60 * 1000, // 1 minute - suites don't change often
    gcTime: 2 * 60 * 1000, // Feature #106: 2x staleTime for garbage collection
  });
}

/**
 * Hook to create a new schedule
 */
export function useCreateSchedule() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateScheduleInput) =>
      fetchWithAuth('/api/v1/schedules', token, {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<{ schedule: Schedule }>,
    onSuccess: (data) => {
      // Optimistically add the new schedule to the cache
      queryClient.setQueryData<Schedule[]>(scheduleKeys.list(), (old) => {
        if (!old) return [data.schedule];
        return [...old, data.schedule];
      });
      // Also invalidate to ensure fresh data
      queryClient.invalidateQueries({ queryKey: scheduleKeys.lists() });
    },
  });
}

/**
 * Hook to toggle schedule enabled/disabled status
 */
export function useToggleSchedule() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      fetchWithAuth(`/api/v1/schedules/${id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      }) as Promise<{ schedule: Schedule }>,
    // Optimistic update
    onMutate: async ({ id, enabled }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: scheduleKeys.list() });

      // Snapshot the previous value
      const previousSchedules = queryClient.getQueryData<Schedule[]>(scheduleKeys.list());

      // Optimistically update to the new value
      if (previousSchedules) {
        queryClient.setQueryData<Schedule[]>(
          scheduleKeys.list(),
          previousSchedules.map(s =>
            s.id === id ? { ...s, enabled } : s
          )
        );
      }

      // Return context with the snapshotted value
      return { previousSchedules };
    },
    // If the mutation fails, use the context returned from onMutate to roll back
    onError: (_err, _vars, context) => {
      if (context?.previousSchedules) {
        queryClient.setQueryData(scheduleKeys.list(), context.previousSchedules);
      }
    },
    // Always refetch after error or success
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.lists() });
    },
  });
}

/**
 * Hook to update a schedule
 */
export function useUpdateSchedule() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateScheduleInput }) =>
      fetchWithAuth(`/api/v1/schedules/${id}`, token, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }) as Promise<{ schedule: Schedule }>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.lists() });
    },
  });
}

/**
 * Hook to delete a schedule
 */
export function useDeleteSchedule() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      fetchWithAuth(`/api/v1/schedules/${id}`, token, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.lists() });
    },
  });
}

/**
 * Hook to invalidate schedule queries
 */
export function useInvalidateSchedules() {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: scheduleKeys.all }),
    invalidateList: () => queryClient.invalidateQueries({ queryKey: scheduleKeys.lists() }),
    invalidateTestSuites: () => queryClient.invalidateQueries({ queryKey: scheduleKeys.testSuites() }),
    refetchList: () => queryClient.refetchQueries({ queryKey: scheduleKeys.list() }),
  };
}
