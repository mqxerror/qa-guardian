/**
 * React Query hooks for Quick Test API
 * Feature #712: Create React Query hook to eliminate raw fetch() in QuickTestPage
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
import { fetchWithAuth } from './fetchWithAuth';

// Types
export interface QuickTestHistoryItem {
  id: string;
  url: string;
  startedAt: string;
  overallScore: number | null;
}

export interface QuickTestHistoryResponse {
  results: QuickTestHistoryItem[];
  total: number;
}

export interface CreateScheduleInput {
  url: string;
  name: string;
  cron_expression: string;
  notify_on_score_drop: boolean;
  score_threshold: number;
}

// Query keys factory
export const quickTestKeys = {
  all: ['quickTest'] as const,
  history: (limit?: number, status?: string) => [...quickTestKeys.all, 'history', { limit, status }] as const,
  schedules: () => [...quickTestKeys.all, 'schedules'] as const,
};

/**
 * Hook to fetch quick test history
 * Feature #712: React Query hook for quick-test history endpoint
 */
export function useQuickTestHistory(limit: number = 20, status: string = 'completed') {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: quickTestKeys.history(limit, status),
    queryFn: () =>
      fetchWithAuth(`/api/v1/quick-test/history?limit=${limit}&status=${status}`, token) as Promise<QuickTestHistoryResponse>,
    enabled: !!token,
    staleTime: 30 * 1000, // 30 seconds - history updates when tests complete
    gcTime: 60 * 1000,
  });
}

/**
 * Hook to create a quick test schedule
 * Feature #712: React Query mutation for quick-test schedule creation
 */
export function useCreateQuickTestSchedule() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateScheduleInput) =>
      fetchWithAuth('/api/v1/quick-test/schedules', token, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      // Invalidate schedules if we ever add a schedules list query
      queryClient.invalidateQueries({ queryKey: quickTestKeys.schedules() });
    },
  });
}
