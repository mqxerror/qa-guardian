/**
 * React Query hooks for Visual Review API
 * Feature #77: Migrate VisualReviewPage to React Query with caching
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';

// Types matching VisualReviewPage interfaces
export interface PendingVisualChange {
  runId: string;
  testId: string;
  testName: string;
  projectId?: string;
  projectName?: string;
  suiteId: string;
  suiteName?: string;
  diffPercentage?: number;
  screenshot?: string;
  baselineScreenshot?: string;
  diffImage?: string;
  startedAt?: string;
  viewport?: string;
}

export interface VisualChangeImpactAnalysis {
  severity: 'minor' | 'moderate' | 'major' | 'critical';
  confidence: number;
  change_type: {
    category: string;
    description: string;
  };
  affected_areas: Array<{
    element: string;
    change_description: string;
    location: string;
  }>;
  user_impact: {
    severity: 'low' | 'medium' | 'high';
    description: string;
    affected_users: string;
    accessibility_impact: string;
  };
  recommendation: {
    action: 'approve' | 'investigate' | 'reject';
    reasoning: string;
    suggested_tests?: string[];
  };
  ai_summary: string;
}

export interface PendingChangesResponse {
  pending: PendingVisualChange[];
}

export interface BatchApproveInput {
  changes: Array<{
    runId: string;
    testId: string;
  }>;
}

export interface BatchRejectInput {
  changes: Array<{
    runId: string;
    testId: string;
  }>;
  reason?: string;
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
    throw new Error(data.message || data.error || `API error: ${response.status}`);
  }

  return response.json();
};

// Query keys factory for cache management
export const visualReviewKeys = {
  all: ['visualReview'] as const,
  pending: () => [...visualReviewKeys.all, 'pending'] as const,
  analysis: (runId: string, testId: string) => [...visualReviewKeys.all, 'analysis', runId, testId] as const,
};

// Demo data for when no pending changes exist
const demoData: PendingVisualChange[] = [
  {
    runId: 'demo-run-1',
    testId: 'demo-test-1',
    testName: 'Homepage Layout - Desktop',
    projectId: 'demo-project',
    projectName: 'E-Commerce App',
    suiteId: 'demo-suite-1',
    suiteName: 'Visual Regression Suite',
    diffPercentage: 12.45,
    startedAt: new Date().toISOString(),
    viewport: '1920x1080'
  },
  {
    runId: 'demo-run-2',
    testId: 'demo-test-2',
    testName: 'Button Theme Colors',
    projectId: 'demo-project',
    projectName: 'E-Commerce App',
    suiteId: 'demo-suite-1',
    suiteName: 'Visual Regression Suite',
    diffPercentage: 1.8,
    startedAt: new Date(Date.now() - 3600000).toISOString(),
    viewport: '1280x720'
  },
  {
    runId: 'demo-run-3',
    testId: 'demo-test-3',
    testName: 'Login Form Layout',
    projectId: 'demo-project',
    projectName: 'Auth Portal',
    suiteId: 'demo-suite-2',
    suiteName: 'Login Flow Tests',
    diffPercentage: 5.7,
    startedAt: new Date(Date.now() - 7200000).toISOString(),
    viewport: '375x667'
  }
];

/**
 * Hook to fetch pending visual changes
 */
export function usePendingVisualChanges() {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: visualReviewKeys.pending(),
    queryFn: async () => {
      const data = await fetchWithAuth('/api/v1/visual/pending', token) as PendingChangesResponse;
      let pending = data.pending || [];

      // Feature #1251: Add demo data for AI Impact Analysis if no pending changes
      if (pending.length === 0) {
        pending = demoData;
      }

      return pending;
    },
    enabled: !!token,
    staleTime: 30 * 1000, // 30 seconds - visual changes need to be fresh
  });
}

/**
 * Hook to batch approve visual changes
 */
export function useBatchApproveChanges() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BatchApproveInput) =>
      fetchWithAuth('/api/v1/visual/batch-approve', token, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      // Invalidate pending changes to refresh the list
      queryClient.invalidateQueries({ queryKey: visualReviewKeys.pending() });
    },
  });
}

/**
 * Hook to batch reject visual changes
 */
export function useBatchRejectChanges() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BatchRejectInput) =>
      fetchWithAuth('/api/v1/visual/batch-reject', token, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      // Invalidate pending changes to refresh the list
      queryClient.invalidateQueries({ queryKey: visualReviewKeys.pending() });
    },
  });
}

/**
 * Hook to invalidate visual review queries
 */
export function useInvalidateVisualReview() {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: visualReviewKeys.all }),
    invalidatePending: () => queryClient.invalidateQueries({ queryKey: visualReviewKeys.pending() }),
    refetchPending: () => queryClient.refetchQueries({ queryKey: visualReviewKeys.pending() }),
  };
}
