// AIAgentWorkspacePage - AI Agent Workspace with Kanban-style Task Board
// Feature #1560: AI Agent Workspace with Real MCP Tool Execution
// Uses real AI API keys (Kie.ai/Anthropic) - NO mock data

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { Layout } from '../components/Layout';

// API base URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://qa.pixelcraftedmedia.com';

// Task status types for Kanban
type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

// AI Agent Task
interface AgentTask {
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

// AI Status response type
interface AIStatusResponse {
  ready: boolean;
  providers: {
    available: boolean;
    primary: { name: string; available: boolean; model?: string };
    fallback: { name: string; available: boolean; model?: string };
  };
  message: string;
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

// Available MCP tool categories for quick actions
const TOOL_CATEGORIES = [
  {
    name: 'Project Management',
    icon: '\u{1F3E2}',
    tools: [
      { name: 'list_projects', label: 'List Projects', prompt: 'List all my projects' },
      { name: 'create_project', label: 'Create Project', prompt: 'Create a new project called "Test Project"' },
      { name: 'get_dashboard_summary', label: 'Dashboard Summary', prompt: 'Show me the dashboard summary for the last 7 days' },
    ]
  },
  {
    name: 'Test Suites',
    icon: '\u{1F4E6}',
    tools: [
      { name: 'list_test_suites', label: 'List Suites', prompt: 'List all test suites' },
      { name: 'create_test_suite', label: 'Create Suite', prompt: 'Create a test suite called "Smoke Tests"' },
    ]
  },
  {
    name: 'Test Execution',
    icon: '\u25B6\uFE0F',
    tools: [
      { name: 'run_test', label: 'Run Test', prompt: 'Run the most recent test' },
      { name: 'list_recent_runs', label: 'Recent Runs', prompt: 'Show me recent test runs' },
    ]
  },
  {
    name: 'Analytics',
    icon: '\u{1F4CA}',
    tools: [
      { name: 'get_quality_score', label: 'Quality Score', prompt: 'What is the quality score for my projects?' },
      { name: 'get_failing_tests', label: 'Failing Tests', prompt: 'Show me failing tests from the last 7 days' },
      { name: 'get_flaky_tests', label: 'Flaky Tests', prompt: 'What are my flaky tests?' },
    ]
  },
  {
    name: 'Visual Regression',
    icon: '\u{1F4F8}',
    tools: [
      { name: 'get_visual_diffs', label: 'Visual Diffs', prompt: 'Show me pending visual diffs' },
      { name: 'get_visual_review_queue', label: 'Review Queue', prompt: 'What visual tests need review?' },
    ]
  },
  {
    name: 'Security',
    icon: '\u{1F512}',
    tools: [
      { name: 'get_security_findings', label: 'Security Findings', prompt: 'Show me security findings' },
      { name: 'get_security_score', label: 'Security Score', prompt: 'What is my security score?' },
    ]
  },
  {
    name: 'AI Generation',
    icon: '\u{1F916}',
    tools: [
      { name: 'generate_test', label: 'Generate Test', prompt: 'Generate a test for user login functionality' },
      { name: 'suggest_test_improvements', label: 'Suggest Improvements', prompt: 'Suggest improvements for my test suite' },
    ]
  },
];

export function AIAgentWorkspacePage() {
  const { token } = useAuthStore();
  const [aiStatus, setAiStatus] = useState<AIStatusResponse | null>(null);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const taskIdCounter = useRef(1);

  // Check AI status on mount
  useEffect(() => {
    const checkAIStatus = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/mcp/status`);
        if (response.ok) {
          const status = await response.json();
          setAiStatus(status);
        }
      } catch (error) {
        console.error('Failed to check AI status:', error);
        setAiStatus({
          ready: false,
          providers: {
            available: false,
            primary: { name: 'Kie.ai', available: false },
            fallback: { name: 'Anthropic', available: false },
          },
          message: 'Failed to connect to AI service',
        });
      }
    };
    checkAIStatus();
    // Refresh status every 30 seconds
    const interval = setInterval(checkAIStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // Execute a task using the MCP Chat API
  const executeTask = useCallback(async (prompt: string, taskTitle: string) => {
    const taskId = `task_${Date.now()}_${taskIdCounter.current++}`;

    // Create the task
    const newTask: AgentTask = {
      id: taskId,
      title: taskTitle,
      description: prompt,
      status: 'pending',
      toolsUsed: [],
      createdAt: new Date(),
    };

    setTasks(prev => [newTask, ...prev]);

    // Update to in_progress
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, status: 'in_progress' as TaskStatus, startedAt: new Date() } : t
    ));

    setIsProcessing(true);

    try {
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

      // Update task as completed
      setTasks(prev => prev.map(t =>
        t.id === taskId ? {
          ...t,
          status: 'completed' as TaskStatus,
          completedAt: new Date(),
          toolsUsed,
          result: data.result?.response || JSON.stringify(data.result, null, 2),
          aiMetadata: {
            provider: data.metadata?.provider,
            model: data.metadata?.model,
            execution_time_ms: data.metadata?.execution_time_ms,
            tokens: data.result?.ai_metadata?.tokens,
          },
        } : t
      ));
    } catch (error) {
      // Update task as failed
      setTasks(prev => prev.map(t =>
        t.id === taskId ? {
          ...t,
          status: 'failed' as TaskStatus,
          completedAt: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error',
        } : t
      ));
    } finally {
      setIsProcessing(false);
    }
  }, [token]);

  // Handle custom prompt submission
  const handleCustomPrompt = () => {
    if (!customPrompt.trim() || isProcessing) return;
    executeTask(customPrompt.trim(), customPrompt.trim().slice(0, 50) + (customPrompt.length > 50 ? '...' : ''));
    setCustomPrompt('');
  };

  // Handle quick action
  const handleQuickAction = (tool: { name: string; label: string; prompt: string }) => {
    executeTask(tool.prompt, tool.label);
  };

  // Get tasks by status
  const getTasksByStatus = (status: TaskStatus) => tasks.filter(t => t.status === status);

  // Clear completed/failed tasks
  const clearFinishedTasks = () => {
    setTasks(prev => prev.filter(t => t.status === 'pending' || t.status === 'in_progress'));
  };

  // Retry a failed task
  const retryTask = (task: AgentTask) => {
    executeTask(task.description, task.title);
  };

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Header */}
        <div className="border-b border-border bg-card px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{'\u{1F916}'} AI Agent Workspace</h1>
              <p className="text-muted-foreground">Execute MCP tools with real AI - Kanban-style task management</p>
            </div>
            <div className="flex items-center gap-4">
              {/* AI Status Indicator */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted">
                <div className={`w-2.5 h-2.5 rounded-full ${
                  aiStatus?.ready ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                }`} />
                <span className="text-sm font-medium">
                  {aiStatus?.ready ? (
                    <span className="text-green-600 dark:text-green-400">
                      {aiStatus.providers.primary.available ? aiStatus.providers.primary.name : aiStatus.providers.fallback.name} Ready
                    </span>
                  ) : (
                    <span className="text-red-600 dark:text-red-400">AI Offline</span>
                  )}
                </span>
                {aiStatus?.providers.primary.model && (
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                    {aiStatus.providers.primary.model.split('-').slice(0, 2).join('-')}
                  </span>
                )}
              </div>
              {tasks.some(t => t.status === 'completed' || t.status === 'failed') && (
                <button
                  onClick={clearFinishedTasks}
                  className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted"
                >
                  Clear Finished
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {/* Left Panel - Quick Actions */}
          <div className="w-80 border-r border-border bg-muted/30 overflow-y-auto">
            <div className="p-4">
              <h2 className="text-lg font-semibold mb-4">{'\u26A1'} Quick Actions</h2>

              {/* Custom Prompt */}
              <div className="mb-6">
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Custom AI Command
                </label>
                <div className="flex flex-col gap-2">
                  <textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="Ask the AI agent anything... (e.g., 'Create a visual regression test for https://example.com')"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    rows={3}
                    disabled={isProcessing || !aiStatus?.ready}
                  />
                  <button
                    onClick={handleCustomPrompt}
                    disabled={!customPrompt.trim() || isProcessing || !aiStatus?.ready}
                    className="w-full px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? 'Processing...' : 'Execute with AI'}
                  </button>
                </div>
              </div>

              {/* Tool Categories */}
              <div className="space-y-3">
                {TOOL_CATEGORIES.map((category) => (
                  <div key={category.name} className="rounded-lg border border-border bg-card overflow-hidden">
                    <button
                      onClick={() => setSelectedCategory(
                        selectedCategory === category.name ? null : category.name
                      )}
                      className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-muted/50 transition-colors"
                    >
                      <span className="flex items-center gap-2 font-medium">
                        <span>{category.icon}</span>
                        <span>{category.name}</span>
                      </span>
                      <span className={`transform transition-transform ${
                        selectedCategory === category.name ? 'rotate-180' : ''
                      }`}>
                        {'\u25BC'}
                      </span>
                    </button>
                    {selectedCategory === category.name && (
                      <div className="px-3 pb-3 space-y-1.5">
                        {category.tools.map((tool) => (
                          <button
                            key={tool.name}
                            onClick={() => handleQuickAction(tool)}
                            disabled={isProcessing || !aiStatus?.ready}
                            className="w-full px-3 py-2 text-left text-sm rounded-md bg-muted/50 hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <span className="font-medium">{tool.label}</span>
                            <span className="block text-xs text-muted-foreground mt-0.5 truncate">
                              {tool.prompt}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel - Kanban Board */}
          <div className="flex-1 overflow-x-auto">
            <div className="flex h-full min-w-[800px] p-4 gap-4">
              {/* Pending Column */}
              <div className="flex-1 flex flex-col min-w-[250px]">
                <div className="flex items-center gap-2 mb-3 px-2">
                  <span className="w-3 h-3 rounded-full bg-gray-400"></span>
                  <h3 className="font-semibold">Pending</h3>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {getTasksByStatus('pending').length}
                  </span>
                </div>
                <div className="flex-1 rounded-lg bg-muted/30 p-2 space-y-2 overflow-y-auto">
                  {getTasksByStatus('pending').map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                  {getTasksByStatus('pending').length === 0 && (
                    <div className="text-center text-sm text-muted-foreground py-8">
                      No pending tasks
                    </div>
                  )}
                </div>
              </div>

              {/* In Progress Column */}
              <div className="flex-1 flex flex-col min-w-[250px]">
                <div className="flex items-center gap-2 mb-3 px-2">
                  <span className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></span>
                  <h3 className="font-semibold">In Progress</h3>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {getTasksByStatus('in_progress').length}
                  </span>
                </div>
                <div className="flex-1 rounded-lg bg-blue-50 dark:bg-blue-950/20 p-2 space-y-2 overflow-y-auto">
                  {getTasksByStatus('in_progress').map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                  {getTasksByStatus('in_progress').length === 0 && (
                    <div className="text-center text-sm text-muted-foreground py-8">
                      No tasks running
                    </div>
                  )}
                </div>
              </div>

              {/* Completed Column */}
              <div className="flex-1 flex flex-col min-w-[250px]">
                <div className="flex items-center gap-2 mb-3 px-2">
                  <span className="w-3 h-3 rounded-full bg-green-500"></span>
                  <h3 className="font-semibold">Completed</h3>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {getTasksByStatus('completed').length}
                  </span>
                </div>
                <div className="flex-1 rounded-lg bg-green-50 dark:bg-green-950/20 p-2 space-y-2 overflow-y-auto">
                  {getTasksByStatus('completed').map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                  {getTasksByStatus('completed').length === 0 && (
                    <div className="text-center text-sm text-muted-foreground py-8">
                      No completed tasks
                    </div>
                  )}
                </div>
              </div>

              {/* Failed Column */}
              <div className="flex-1 flex flex-col min-w-[250px]">
                <div className="flex items-center gap-2 mb-3 px-2">
                  <span className="w-3 h-3 rounded-full bg-red-500"></span>
                  <h3 className="font-semibold">Failed</h3>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {getTasksByStatus('failed').length}
                  </span>
                </div>
                <div className="flex-1 rounded-lg bg-red-50 dark:bg-red-950/20 p-2 space-y-2 overflow-y-auto">
                  {getTasksByStatus('failed').map((task) => (
                    <TaskCard key={task.id} task={task} onRetry={() => retryTask(task)} />
                  ))}
                  {getTasksByStatus('failed').length === 0 && (
                    <div className="text-center text-sm text-muted-foreground py-8">
                      No failed tasks
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

// Task Card Component
function TaskCard({ task, onRetry }: { task: AgentTask; onRetry?: () => void }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm truncate">{task.title}</h4>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{task.description}</p>
        </div>
        {task.status === 'in_progress' && (
          <div className="flex-shrink-0">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>

      {/* Tools Used */}
      {task.toolsUsed.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {task.toolsUsed.map((tool, idx) => (
            <span
              key={idx}
              className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
            >
              {tool}
            </span>
          ))}
        </div>
      )}

      {/* AI Metadata */}
      {task.aiMetadata?.provider && (
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <span className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
            {task.aiMetadata.provider}
          </span>
          {task.aiMetadata.execution_time_ms && (
            <span>{task.aiMetadata.execution_time_ms}ms</span>
          )}
        </div>
      )}

      {/* Error */}
      {task.error && (
        <div className="mt-2 p-2 rounded bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-xs">
          {task.error}
        </div>
      )}

      {/* Result (collapsible) */}
      {task.result && (
        <div className="mt-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-primary hover:underline"
          >
            {isExpanded ? 'Hide Result' : 'Show Result'}
          </button>
          {isExpanded && (
            <div className="mt-2 p-2 rounded bg-muted text-xs font-mono whitespace-pre-wrap max-h-60 overflow-y-auto">
              {task.result}
            </div>
          )}
        </div>
      )}

      {/* Retry Button */}
      {task.status === 'failed' && onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 w-full px-2 py-1 text-xs rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50"
        >
          Retry
        </button>
      )}

      {/* Timestamp */}
      <div className="mt-2 text-xs text-muted-foreground">
        {task.completedAt ? (
          <span>Completed: {task.completedAt.toLocaleTimeString()}</span>
        ) : task.startedAt ? (
          <span>Started: {task.startedAt.toLocaleTimeString()}</span>
        ) : (
          <span>Created: {task.createdAt.toLocaleTimeString()}</span>
        )}
      </div>
    </div>
  );
}

export default AIAgentWorkspacePage;
