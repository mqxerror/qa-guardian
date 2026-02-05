/**
 * React Query hooks for AI Agent Workspace API
 * Feature #79: Migrate AIAgentWorkspacePage to React Query with caching
 *
 * Note: Task state is managed locally (not persisted to backend).
 * These hooks provide React Query integration for:
 * - AI status caching (reuses useAIStatus from useMCPChat)
 * - Task execution mutations
 */

import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';

// Re-export useAIStatus from useMCPChat for consistent AI status across pages
export { useAIStatus, useInvalidateMCPChat } from './useMCPChat';

// API base URL
const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';

// Task status types for Kanban
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

// AI Agent Task
export interface AgentTask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  toolsUsed: string[];
  result?: string;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  aiMetadata?: {
    provider?: string;
    model?: string;
    tokens?: { input?: number; output?: number };
    execution_time_ms?: number;
  };
}

// MCP Chat response type
interface MCPChatResponse {
  success: boolean;
  result?: {
    response?: string;
    tools_executed?: Array<{
      tool: string;
      args: Record<string, unknown>;
      result: unknown;
      success: boolean;
    }>;
    ai_metadata?: {
      used_real_ai?: boolean;
      provider?: string;
      model?: string;
      tokens?: { input?: number; output?: number };
    };
  };
  tool_used?: string;
  metadata?: {
    used_real_ai: boolean;
    provider?: string;
    model?: string;
    execution_time_ms?: number;
    tools_called?: number;
  };
  error?: string;
}

// Query keys factory for cache management
export const aiWorkspaceKeys = {
  all: ['aiWorkspace'] as const,
  tasks: () => [...aiWorkspaceKeys.all, 'tasks'] as const,
};

/**
 * Hook to execute AI workspace tasks via MCP Chat API
 * Returns parsed result with tools used and AI metadata
 */
export function useExecuteWorkspaceTask() {
  const token = useAuthStore(state => state.token);

  return useMutation({
    mutationFn: async ({ prompt }: { prompt: string }): Promise<{
      success: boolean;
      result?: string;
      toolsUsed: string[];
      aiMetadata?: {
        provider?: string;
        model?: string;
        tokens?: { input?: number; output?: number };
        execution_time_ms?: number;
      };
      error?: string;
    }> => {
      const response = await fetch(`${API_BASE_URL}/api/v1/mcp/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: prompt,
          context: {
            workspace: 'ai-agent',
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data: MCPChatResponse = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Unknown error');
      }

      // Extract tools used
      const toolsUsed: string[] = [];
      if (data.tool_used) {
        toolsUsed.push(...data.tool_used.split(', '));
      }
      if (data.result?.tools_executed) {
        for (const exec of data.result.tools_executed) {
          if (!toolsUsed.includes(exec.tool)) {
            toolsUsed.push(exec.tool);
          }
        }
      }

      return {
        success: true,
        result: data.result?.response || JSON.stringify(data.result, null, 2),
        toolsUsed,
        aiMetadata: {
          provider: data.metadata?.provider,
          model: data.metadata?.model,
          execution_time_ms: data.metadata?.execution_time_ms,
          tokens: data.result?.ai_metadata?.tokens,
        },
      };
    },
  });
}
