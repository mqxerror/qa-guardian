/**
 * React Query hooks for MCP Chat API
 * Feature #78: Migrate MCPChatPage to React Query with caching
 *
 * Note: MCP Chat uses UnifiedAIService which already has internal caching.
 * These hooks provide React Query integration for:
 * - AI status caching with automatic refresh
 * - Chat mutations with optimistic updates
 * - Tool execution caching
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UnifiedAIService, AIStatusResponse, ChatResponse } from '../../services/UnifiedAIService';
import { useAuthStore } from '../../stores/authStore';

// Query keys factory for cache management
export const mcpChatKeys = {
  all: ['mcpChat'] as const,
  status: () => [...mcpChatKeys.all, 'status'] as const,
  conversations: () => [...mcpChatKeys.all, 'conversations'] as const,
  conversation: (id: string) => [...mcpChatKeys.conversations(), id] as const,
};

/**
 * Hook to fetch and cache AI status
 * Uses short staleTime for real-time status updates
 */
export function useAIStatus() {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: mcpChatKeys.status(),
    queryFn: async () => {
      // Clear cached status to get fresh data
      UnifiedAIService.clearStatusCache();
      return UnifiedAIService.checkStatus();
    },
    enabled: true, // Always fetch status, even without token
    staleTime: 30 * 1000, // 30 seconds - status should be relatively fresh
    refetchInterval: 60 * 1000, // Auto-refetch every minute
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });
}

/**
 * Hook to send chat messages via UnifiedAIService
 * Returns a mutation for sending messages
 */
export function useChatMutation() {
  const token = useAuthStore(state => state.token);

  return useMutation({
    mutationFn: async ({
      message,
      conversationId,
      modelPreferences,
    }: {
      message: string;
      conversationId?: string;
      modelPreferences?: { provider?: string; model?: string };
    }): Promise<ChatResponse> => {
      // Ensure token is set on UnifiedAIService
      UnifiedAIService.setToken(token);
      return UnifiedAIService.chat(message, conversationId, modelPreferences);
    },
  });
}

/**
 * Hook to execute MCP tools directly
 */
export function useExecuteToolMutation() {
  const token = useAuthStore(state => state.token);

  return useMutation({
    mutationFn: async ({
      toolName,
      args,
    }: {
      toolName: string;
      args: Record<string, unknown>;
    }) => {
      UnifiedAIService.setToken(token);
      return UnifiedAIService.executeTool(toolName, args);
    },
  });
}

/**
 * Hook to generate tests via AI
 */
export function useGenerateTestMutation() {
  const token = useAuthStore(state => state.token);

  return useMutation({
    mutationFn: async (options: {
      description: string;
      target_url?: string;
      language?: 'typescript' | 'javascript';
      include_comments?: boolean;
      include_assertions?: boolean;
      test_framework?: string;
    }) => {
      UnifiedAIService.setToken(token);
      return UnifiedAIService.generateTest(options);
    },
  });
}

/**
 * Hook to explain test failures via AI
 */
export function useExplainFailureMutation() {
  const token = useAuthStore(state => state.token);

  return useMutation({
    mutationFn: async ({
      runId,
      testId,
    }: {
      runId: string;
      testId?: string;
    }) => {
      UnifiedAIService.setToken(token);
      return UnifiedAIService.explainFailure(runId, testId);
    },
  });
}

/**
 * Hook to get AI-powered test improvement suggestions
 */
export function useSuggestImprovementsMutation() {
  const token = useAuthStore(state => state.token);

  return useMutation({
    mutationFn: async ({
      testCode,
      testType,
    }: {
      testCode: string;
      testType: string;
    }) => {
      UnifiedAIService.setToken(token);
      return UnifiedAIService.suggestTestImprovements(testCode, testType);
    },
  });
}

/**
 * Hook to invalidate MCP chat queries
 */
export function useInvalidateMCPChat() {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: mcpChatKeys.all }),
    invalidateStatus: () => queryClient.invalidateQueries({ queryKey: mcpChatKeys.status() }),
    refetchStatus: () => queryClient.refetchQueries({ queryKey: mcpChatKeys.status() }),
  };
}
