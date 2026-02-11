/**
 * React Query hooks for AI-related pages
 * Feature #82: Migrate all AI-related pages to React Query with caching
 *
 * This file provides hooks for:
 * - AITestGeneratorPage: generation history
 * - AITestReviewPage: review queue, approval stats
 * - AIUsageAnalyticsDashboard: usage analytics
 * - AICostTrackingPage: cost tracking
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
import { fetchWithAuth } from './fetchWithAuth'; // Feature #655: Shared auth fetch

// API base URL
const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';

// Types for AI Test Generator
export interface GenerationHistoryItem {
  id: string;
  test_name: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  generated_code?: string;
}

// Types for AI Test Review
export interface ReviewQueueItem {
  id: string;
  test_name: string;
  description: string;
  confidence: number;
  generated_code: string;
  created_at: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface ApprovalStats {
  total_generated: number;
  pending_review: number;
  approved: number;
  rejected: number;
  approval_rate: number;
}

// Types for AI Usage Analytics
export interface AIUsageAnalytics {
  total_requests: number;
  total_tokens: number;
  estimated_cost: number;
  requests_by_feature: Record<string, number>;
  top_users: Array<{ user: string; requests: number }>;
}

// Types for AI Cost Tracking
export interface CostSummary {
  total_cost: number;
  budget: number;
  budget_used_percentage: number;
  cost_by_provider: Record<string, number>;
}

// Query keys factory for cache management
export const aiKeys = {
  all: ['ai'] as const,
  // Generation history
  generationHistory: (params?: { status?: string }) => [...aiKeys.all, 'generationHistory', params] as const,
  // Review queue
  reviewQueue: () => [...aiKeys.all, 'reviewQueue'] as const,
  approvalStats: () => [...aiKeys.all, 'approvalStats'] as const,
  // Usage analytics
  analytics: (period: string) => [...aiKeys.all, 'analytics', period] as const,
  comparison: (period: string) => [...aiKeys.all, 'comparison', period] as const,
  trends: (period: string) => [...aiKeys.all, 'trends', period] as const,
  exports: () => [...aiKeys.all, 'exports'] as const,
  // Cost tracking
  costSummary: (period: string) => [...aiKeys.all, 'costSummary', period] as const,
  budget: () => [...aiKeys.all, 'budget'] as const,
  costHistory: () => [...aiKeys.all, 'costHistory'] as const,
  pricing: () => [...aiKeys.all, 'pricing'] as const,
  costByUser: (period: string) => [...aiKeys.all, 'costByUser', period] as const,
  costByProject: (period: string) => [...aiKeys.all, 'costByProject', period] as const,
};

// ============== AI Test Generator Hooks ==============

/**
 * Hook to fetch generation history
 */
export function useGenerationHistory(params?: { status?: string }) {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: aiKeys.generationHistory(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.status) searchParams.set('status', params.status);
      const queryString = searchParams.toString();
      const url = `/api/v1/ai/generation-history${queryString ? `?${queryString}` : ''}`;
      const data = await fetchWithAuth(url, token);
      return (data.history || []) as GenerationHistoryItem[];
    },
    enabled: !!token,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 30 * 1000, // Feature #106: 2x staleTime for garbage collection
  });
}

/**
 * Hook to save generation to history
 */
export function useSaveGenerationHistory() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { test_name: string; description: string; generated_code: string }) =>
      fetchWithAuth('/api/v1/ai/generation-history', token, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aiKeys.generationHistory() });
    },
  });
}

// ============== AI Test Review Hooks ==============

/**
 * Hook to fetch review queue
 */
export function useReviewQueue() {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: aiKeys.reviewQueue(),
    queryFn: async () => {
      const data = await fetchWithAuth('/api/v1/ai/review-queue', token);
      return (data.queue || []) as ReviewQueueItem[];
    },
    enabled: !!token,
    staleTime: 30 * 1000, // 30 seconds - queue changes often
    gcTime: 2 * 30 * 1000, // Feature #106: 2x staleTime for garbage collection
  });
}

/**
 * Hook to fetch approval stats
 */
export function useApprovalStats() {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: aiKeys.approvalStats(),
    queryFn: () => fetchWithAuth('/api/v1/ai/approval-stats', token) as Promise<ApprovalStats>,
    enabled: !!token,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 2 * 60 * 1000, // Feature #106: 2x staleTime for garbage collection
  });
}

/**
 * Hook to approve/reject a test
 */
export function useApproveTest() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ testId, approved }: { testId: string; approved: boolean }) =>
      fetchWithAuth(`/api/v1/ai/generation-history/${testId}/approve`, token, {
        method: 'POST',
        body: JSON.stringify({ approved }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aiKeys.reviewQueue() });
      queryClient.invalidateQueries({ queryKey: aiKeys.approvalStats() });
      queryClient.invalidateQueries({ queryKey: aiKeys.generationHistory() });
    },
  });
}

// ============== AI Usage Analytics Hooks ==============

/**
 * Hook to fetch AI analytics
 */
export function useAIAnalytics(period: string = '7d') {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: aiKeys.analytics(period),
    queryFn: () => fetchWithAuth(`${API_BASE_URL}/api/v1/ai/analytics?period=${period}`, token) as Promise<AIUsageAnalytics>,
    enabled: !!token,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 2 * 2 * 60 * 1000, // Feature #106: 2x staleTime for garbage collection
  });
}

/**
 * Hook to fetch AI analytics comparison
 */
export function useAIAnalyticsComparison(period: string = '7d') {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: aiKeys.comparison(period),
    queryFn: () => fetchWithAuth(`${API_BASE_URL}/api/v1/ai/analytics/comparison?period=${period}`, token),
    enabled: !!token,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 2 * 2 * 60 * 1000, // Feature #106: 2x staleTime for garbage collection
  });
}

/**
 * Hook to fetch AI analytics trends
 */
export function useAIAnalyticsTrends(period: string = '7d') {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: aiKeys.trends(period),
    queryFn: () => fetchWithAuth(`${API_BASE_URL}/api/v1/ai/analytics/trends?period=${period}`, token),
    enabled: !!token,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 2 * 2 * 60 * 1000, // Feature #106: 2x staleTime for garbage collection
  });
}

/**
 * Hook to fetch AI export history
 */
export function useAIExports() {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: aiKeys.exports(),
    queryFn: () => fetchWithAuth(`${API_BASE_URL}/api/v1/ai/analytics/exports`, token),
    enabled: !!token,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 2 * 60 * 1000, // Feature #106: 2x staleTime for garbage collection
  });
}

/**
 * Hook to export AI analytics
 */
export function useExportAIAnalytics() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ period, format }: { period: string; format: string }) =>
      fetchWithAuth(`${API_BASE_URL}/api/v1/ai/analytics/export`, token, {
        method: 'POST',
        body: JSON.stringify({ period, format }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aiKeys.exports() });
    },
  });
}

// ============== AI Cost Tracking Hooks ==============

/**
 * Hook to fetch cost summary
 * Feature #313: Updated to use correct cost-analytics endpoint
 */
export function useCostSummary(period: string = '7d') {
  const token = useAuthStore(state => state.token);
  const days = period === '1d' ? '1' : period === '7d' ? '7' : '30';

  return useQuery({
    queryKey: aiKeys.costSummary(period),
    queryFn: () => fetchWithAuth(`${API_BASE_URL}/api/v1/ai/cost-analytics/summary?days=${days}`, token) as Promise<CostSummary>,
    enabled: !!token,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 2 * 60 * 1000, // Feature #106: 2x staleTime for garbage collection
  });
}

/**
 * Hook to fetch budget
 * Feature #313: Updated to use correct cost-analytics endpoint
 */
export function useBudget() {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: aiKeys.budget(),
    queryFn: () => fetchWithAuth(`${API_BASE_URL}/api/v1/ai/cost-analytics/budget`, token),
    enabled: !!token,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 2 * 60 * 1000, // Feature #106: 2x staleTime for garbage collection
  });
}

/**
 * Hook to fetch cost history (full analytics)
 * Feature #313: Updated to use correct cost-analytics endpoint
 */
export function useCostHistory() {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: aiKeys.costHistory(),
    queryFn: () => fetchWithAuth(`${API_BASE_URL}/api/v1/ai/cost-analytics?days=30`, token),
    enabled: !!token,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 2 * 60 * 1000, // Feature #106: 2x staleTime for garbage collection
  });
}

/**
 * Hook to update budget
 * Feature #313: Updated to use correct cost-analytics endpoint
 */
export function useUpdateBudget() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (budget: { monthly_limit: number; alert_threshold: number }) =>
      fetchWithAuth(`${API_BASE_URL}/api/v1/ai/cost-analytics/budget`, token, {
        method: 'PATCH',
        body: JSON.stringify({ monthlyLimitUsd: budget.monthly_limit }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aiKeys.budget() });
    },
  });
}

// ============== Invalidation Hooks ==============

/**
 * Hook to invalidate AI queries
 */
export function useInvalidateAI() {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: aiKeys.all }),
    invalidateGenerationHistory: () => queryClient.invalidateQueries({ queryKey: aiKeys.generationHistory() }),
    invalidateReviewQueue: () => queryClient.invalidateQueries({ queryKey: aiKeys.reviewQueue() }),
    invalidateAnalytics: () => queryClient.invalidateQueries({ queryKey: aiKeys.analytics('7d') }),
    invalidateCosts: () => {
      queryClient.invalidateQueries({ queryKey: aiKeys.costSummary('7d') });
      queryClient.invalidateQueries({ queryKey: aiKeys.budget() });
      queryClient.invalidateQueries({ queryKey: aiKeys.costHistory() });
    },
  };
}
