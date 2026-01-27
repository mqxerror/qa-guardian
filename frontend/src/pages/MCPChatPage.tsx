// MCPChatPage - Natural language interface to QA Guardian via MCP
// Feature #1295: Natural Language Chat Interface
// Extracted from App.tsx for code quality compliance (Feature #1357)
// Updated to use REAL AI via backend MCP tools API
// Feature #1701: Integrated modular SlashCommandSystem
// Feature #1769: Now uses UnifiedAIService for consistent behavior

import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';
import { Layout } from '../components/Layout';
import {
  slashCommandRegistry,
  getSlashCommandHelpText,
  SlashCommandSuggestion,
} from '../components/mcp-chat';
import { UnifiedAIService, AIStatusResponse } from '../services/UnifiedAIService';

// Helper functions that delegate to the modular system
function parseSlashCommand(message: string) {
  return slashCommandRegistry.parse(message);
}

function getSlashCommandHelp(): string {
  return getSlashCommandHelpText();
}

function getSlashCommandSuggestions(input: string): SlashCommandSuggestion[] {
  return slashCommandRegistry.getSuggestions(input);
}

// Feature #1729: Quick action button interface
interface QuickAction {
  label: string;
  command: string;
  icon?: string;
  variant?: 'default' | 'primary' | 'secondary';
}

// Feature #1729: Generate quick action buttons based on context
function generateQuickActions(toolUsed?: string, result?: Record<string, unknown>, content?: string): QuickAction[] {
  const actions: QuickAction[] = [];

  // Parse IDs from the response content or result
  const testIdMatch = content?.match(/test[_\s]?id[:\s]+['"]?([a-zA-Z0-9_-]+)/i);
  const suiteIdMatch = content?.match(/suite[_\s]?id[:\s]+['"]?([a-zA-Z0-9_-]+)/i);
  const projectIdMatch = content?.match(/project[_\s]?id[:\s]+['"]?([a-zA-Z0-9_-]+)/i);
  const runIdMatch = content?.match(/run[_\s]?id[:\s]+['"]?([a-zA-Z0-9_-]+)/i);

  const testId = testIdMatch?.[1] || (result?.test_id as string) || (result?.id as string);
  const suiteId = suiteIdMatch?.[1] || (result?.suite_id as string);
  const projectId = projectIdMatch?.[1] || (result?.project_id as string);
  const runId = runIdMatch?.[1] || (result?.run_id as string);

  // Generate actions based on the tool used
  switch (toolUsed) {
    case 'create_test':
      if (testId) {
        actions.push({ label: '▶️ Run Now', command: `/run-test ${testId}`, variant: 'primary' });
        actions.push({ label: '✏️ Edit', command: `Show me test ${testId} details` });
      }
      actions.push({ label: '📋 List Tests', command: '/list-tests' });
      break;

    case 'run_test':
    case 'run_test_suite':
    case 'trigger_run':
      if (runId) {
        actions.push({ label: '📊 View Results', command: `/run-status ${runId}`, variant: 'primary' });
        actions.push({ label: '🔄 Run Again', command: toolUsed === 'run_test_suite' ? `/run-suite ${suiteId}` : `/run-test ${testId}` });
      }
      break;

    case 'create_project':
      if (projectId) {
        actions.push({ label: '📁 Open Project', command: `Show project ${projectId}`, variant: 'primary' });
        actions.push({ label: '➕ Create Suite', command: `/create-suite ${projectId}` });
      }
      break;

    case 'create_test_suite':
      if (suiteId) {
        actions.push({ label: '📋 View Suite', command: `Show suite ${suiteId}`, variant: 'primary' });
        actions.push({ label: '➕ Add Test', command: `/create-test ${suiteId}` });
      }
      break;

    case 'run_dast_scan':
    case 'run_security_scan':
      actions.push({ label: '📝 View Report', command: '/security-report', variant: 'primary' });
      actions.push({ label: '🔄 Rescan', command: content?.match(/https?:\/\/[^\s]+/)?.[0] ? `/security-scan ${content.match(/https?:\/\/[^\s]+/)?.[0]}` : '' });
      break;

    case 'run_accessibility_scan':
      actions.push({ label: '📝 View Report', command: '/accessibility-report', variant: 'primary' });
      break;

    case 'run_k6_test':
      actions.push({ label: '📊 Performance Metrics', command: '/performance-report', variant: 'primary' });
      break;

    case 'list_projects':
      actions.push({ label: '➕ New Project', command: '/create-project', variant: 'primary' });
      break;

    case 'list_test_suites':
      actions.push({ label: '➕ New Suite', command: '/create-suite', variant: 'primary' });
      break;

    case 'list_tests':
      actions.push({ label: '➕ New Test', command: '/create-test', variant: 'primary' });
      actions.push({ label: '▶️ Run All', command: '/run-suite' });
      break;
  }

  // Filter out empty commands
  return actions.filter(a => a.command.length > 0);
}

// Types for MCP Chat
interface MCPChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  toolCalled?: string;
  toolResult?: string;
  isCommand?: boolean;
  aiMetadata?: {
    used_real_ai: boolean;
    provider?: string;
    model?: string;
    execution_time_ms?: number;
  };
  // Feature #1729: Quick action buttons
  actions?: QuickAction[];
}

// Note: AIStatusResponse is imported from UnifiedAIService

// Note: Response types are now handled by UnifiedAIService

export function MCPChatPage() {
  const { user, token } = useAuthStore();
  const [messages, setMessages] = useState<MCPChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string>(`conv_${Date.now()}`);
  const [aiStatus, setAiStatus] = useState<AIStatusResponse | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Feature #1694: Slash command autocomplete state
  const [showCommandSuggestions, setShowCommandSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [commandSuggestions, setCommandSuggestions] = useState<Array<{ command: string; description: string; params: string[] }>>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Feature #1769: Set token on UnifiedAIService when auth changes
  useEffect(() => {
    UnifiedAIService.setToken(token || null);
  }, [token]);

  // Check AI status on mount using UnifiedAIService
  useEffect(() => {
    const checkAIStatus = async () => {
      const status = await UnifiedAIService.checkStatus();
      setAiStatus(status);
    };
    checkAIStatus();
  }, []);

  // Add welcome message on mount
  useEffect(() => {
    setMessages([{
      id: 'welcome',
      role: 'system',
      content: `Welcome to MCP Chat! I can help you with:

\u2022 **Run tests**: "Run the auth test suite"
\u2022 **Check status**: "What's the status of my last test run?"
\u2022 **Analyze failures**: "Why did test login_flow fail?"
\u2022 **Get reports**: "Generate a summary of today's tests"
\u2022 **Execute commands**: "Create a new test for user registration"

Just type naturally and I'll help you manage your QA workflows!`,
      timestamp: new Date()
    }]);
  }, []);

  // Feature #1769: Call AI via UnifiedAIService for consistent behavior
  const callMCPChatAPI = async (userMessage: string): Promise<{
    content: string;
    toolCalled?: string;
    toolResult?: string;
    isCommand?: boolean;
    aiMetadata?: {
      used_real_ai: boolean;
      provider?: string;
      model?: string;
      execution_time_ms?: number;
    };
    // Feature #1729: Quick action buttons
    actions?: QuickAction[];
  }> => {
    // Use UnifiedAIService.chat() for consistent behavior
    const response = await UnifiedAIService.chat(userMessage, conversationId);

    // Generate quick action buttons based on the tool and result
    const actions = generateQuickActions(
      response.toolCalled,
      response.toolResult as Record<string, unknown>,
      response.content
    );

    return {
      content: response.content,
      toolCalled: response.toolCalled,
      toolResult: response.toolResult ? JSON.stringify(response.toolResult) : undefined,
      isCommand: response.isCommand,
      aiMetadata: response.aiMetadata,
      actions: actions.length > 0 ? actions : undefined,
    };
  };

  // Legacy local responses for non-AI queries (status checks, help, etc.)
  const getLocalResponse = (userMessage: string): { content: string; toolCalled?: string; toolResult?: string; isCommand?: boolean } | null => {
    const lowerMessage = userMessage.toLowerCase();

    // Feature #1692: Handle /help slash command locally
    if (lowerMessage.trim() === '/help') {
      return {
        content: getSlashCommandHelp()
      };
    }

    // Only handle simple queries locally that don't need AI
    if (lowerMessage.includes('help') || lowerMessage.includes('what can you')) {
      return {
        content: `Here's what I can help you with:\n\n**\u{1F9EA} Testing**\n- Run tests: "Run the auth suite"\n- Check status: "What's the status of run 12345?"\n- Create tests: "Create a test for login"\n\n**\u{1F4CA} Analysis**\n- Failure analysis: "Why did test X fail?"\n- Flaky tests: "Show me flaky tests"\n- Reports: "Generate daily summary"\n\n**\u26A1 AI-Powered**\n- Generate tests: "Create a test for user registration"\n- Explain failures: "Why did this test fail?"\n- Improve tests: "How can I make this test better?"\n\n**\u{1F527} Slash Commands**\nType \`/help\` to see all available slash commands for quick actions!\n\nJust ask naturally!`
      };
    }

    // For everything else, use the API
    return null;
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: MCPChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // First check for local responses (help, etc.)
      const localResponse = getLocalResponse(userMessage.content);

      let response;
      if (localResponse) {
        response = localResponse;
      } else {
        // Feature #1692/#1701: Check for slash commands and format them for the AI
        const slashCommand = parseSlashCommand(userMessage.content);
        let messageToSend = userMessage.content;

        if (slashCommand && slashCommand.isValid && slashCommand.formattedPrompt) {
          // Format the slash command as a structured prompt for the AI
          messageToSend = `[SLASH COMMAND: ${slashCommand.command}]\n\nIMPORTANT: The user used a slash command. Execute this action using the specified tools.\n\n${slashCommand.formattedPrompt}\n\nOriginal command: ${userMessage.content}`;
        }

        // Call the real AI API
        response = await callMCPChatAPI(messageToSend);
      }

      const assistantMessage: MCPChatMessage = {
        id: `msg_${Date.now()}_response`,
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
        toolCalled: response.toolCalled,
        toolResult: response.toolResult,
        isCommand: response.isCommand,
        aiMetadata: response.aiMetadata,
        // Feature #1729: Include quick action buttons
        actions: response.actions,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      setMessages(prev => [...prev, {
        id: `msg_${Date.now()}_error`,
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Feature #1694: Handle input changes and update slash command suggestions
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);

    // Check for slash command suggestions
    if (value.startsWith('/') && !value.includes(' ')) {
      const suggestions = getSlashCommandSuggestions(value);
      setCommandSuggestions(suggestions);
      setShowCommandSuggestions(suggestions.length > 0);
      setSelectedSuggestionIndex(0);
    } else {
      setShowCommandSuggestions(false);
      setCommandSuggestions([]);
    }
  };

  // Feature #1694: Select a command suggestion
  const selectCommandSuggestion = (suggestion: { command: string; params: string[] }) => {
    const paramHint = suggestion.params.length > 0 ? ` [${suggestion.params.join('] [')}]` : '';
    setInput(suggestion.command + (suggestion.params.length > 0 ? ' ' : ''));
    setShowCommandSuggestions(false);
    inputRef.current?.focus();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    // Feature #1694: Handle keyboard navigation in suggestions
    if (showCommandSuggestions && commandSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestionIndex(prev =>
          prev < commandSuggestions.length - 1 ? prev + 1 : prev
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : prev);
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && commandSuggestions.length > 0)) {
        e.preventDefault();
        selectCommandSuggestion(commandSuggestions[selectedSuggestionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setShowCommandSuggestions(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearConversation = () => {
    setConversationId(`conv_${Date.now()}`);
    setMessages([{
      id: 'welcome_new',
      role: 'system',
      content: 'Conversation cleared. How can I help you today?',
      timestamp: new Date()
    }]);
  };

  const exampleQueries = [
    'Create a test for user login',
    '/list-projects',
    '/security-scan https://example.com',
    '/help',
    'What coverage gaps exist?'
  ];

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Header */}
        <div className="border-b border-border bg-card px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{'\u{1F4AC}'} MCP Chat</h1>
              <p className="text-muted-foreground">Natural language interface to QA Guardian via MCP</p>
            </div>
            <div className="flex items-center gap-4">
              {/* AI Status Indicator */}
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  aiStatus?.ready ? 'bg-green-500' : 'bg-red-500'
                }`} />
                <span className="text-xs text-muted-foreground">
                  {aiStatus?.ready ? (
                    <span className="text-green-600 dark:text-green-400">
                      AI: {aiStatus.providers.primary.available ? aiStatus.providers.primary.name : aiStatus.providers.fallback.name}
                    </span>
                  ) : (
                    <span className="text-red-600 dark:text-red-400">AI Offline</span>
                  )}
                </span>
                {aiStatus?.providers.primary.model && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                    {aiStatus.providers.primary.model.split('-').slice(0, 2).join('-')}
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">|</span>
              <span className="text-xs text-muted-foreground">Conv: {conversationId.slice(-8)}</span>
              <button
                onClick={clearConversation}
                className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map(message => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-4 ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : message.role === 'system'
                    ? 'bg-muted/50 border border-border'
                    : 'bg-card border border-border'
                }`}
              >
                {message.role === 'assistant' && (message.toolCalled || message.aiMetadata?.used_real_ai) && (
                  <div className="mb-2 pb-2 border-b border-border/50 flex flex-wrap items-center gap-2">
                    {message.toolCalled && (
                      <span className="text-xs font-mono px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                        {'\u{1F527}'} {message.toolCalled}
                      </span>
                    )}
                    {message.isCommand && (
                      <span className="text-xs font-mono px-2 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                        {'\u26A1'} Executed
                      </span>
                    )}
                    {message.aiMetadata?.used_real_ai && (
                      <span className="text-xs font-mono px-2 py-1 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                        {'\u{1F916}'} {message.aiMetadata.provider || 'AI'}
                        {message.aiMetadata.execution_time_ms && ` (${message.aiMetadata.execution_time_ms}ms)`}
                      </span>
                    )}
                  </div>
                )}
                <div className="whitespace-pre-wrap text-sm">
                  {message.content.split('**').map((part, idx) =>
                    idx % 2 === 1 ? <strong key={idx}>{part}</strong> : part
                  )}
                </div>
                <div className="mt-2 text-xs opacity-60">
                  {message.timestamp.toLocaleTimeString()}
                  {message.aiMetadata?.model && (
                    <span className="ml-2">via {message.aiMetadata.model}</span>
                  )}
                </div>
                {/* Feature #1729: Quick action buttons */}
                {message.actions && message.actions.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-border/50 flex flex-wrap gap-2">
                    {message.actions.map((action, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          // Execute the command when button is clicked
                          setInput(action.command);
                          // Trigger form submission after a short delay
                          setTimeout(() => {
                            const form = document.querySelector('form');
                            if (form) form.dispatchEvent(new Event('submit', { bubbles: true }));
                          }, 100);
                        }}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                          action.variant === 'primary'
                            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                            : action.variant === 'secondary'
                            ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                            : 'bg-muted hover:bg-muted/80 text-foreground'
                        }`}
                      >
                        {action.icon && <span className="mr-1">{action.icon}</span>}
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  <span className="text-sm text-muted-foreground ml-2">Thinking...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Example Queries */}
        {messages.length <= 1 && (
          <div className="px-6 pb-2">
            <p className="text-xs text-muted-foreground mb-2">Try asking:</p>
            <div className="flex flex-wrap gap-2">
              {exampleQueries.map((query, idx) => (
                <button
                  key={idx}
                  onClick={() => setInput(query)}
                  className="px-3 py-1.5 text-sm rounded-full bg-muted hover:bg-muted/80 text-foreground"
                >
                  {query}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="border-t border-border bg-card px-6 py-4">
          <div className="relative">
            {/* Feature #1694: Slash Command Autocomplete Dropdown */}
            {showCommandSuggestions && commandSuggestions.length > 0 && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-card border border-border rounded-lg shadow-lg overflow-hidden z-10">
                <div className="px-3 py-2 border-b border-border bg-muted/30">
                  <span className="text-xs text-muted-foreground">Slash Commands</span>
                  <span className="text-xs text-muted-foreground ml-2">(↑↓ to navigate, Tab/Enter to select)</span>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {commandSuggestions.map((suggestion, idx) => (
                    <button
                      key={suggestion.command}
                      onClick={() => selectCommandSuggestion(suggestion)}
                      className={`w-full px-4 py-3 text-left flex items-center justify-between hover:bg-muted/50 ${
                        idx === selectedSuggestionIndex ? 'bg-muted' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <code className="px-2 py-1 rounded bg-primary/10 text-primary font-mono text-sm">
                          {suggestion.command}
                        </code>
                        {suggestion.params.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            [{suggestion.params.join('] [')}]
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {suggestion.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyPress}
                onBlur={() => setTimeout(() => setShowCommandSuggestions(false), 150)}
                onFocus={() => {
                  if (input.startsWith('/') && !input.includes(' ')) {
                    const suggestions = getSlashCommandSuggestions(input);
                    setCommandSuggestions(suggestions);
                    setShowCommandSuggestions(suggestions.length > 0);
                  }
                }}
                placeholder="Type your message... (e.g., 'Run the auth tests' or '/' for commands)"
                className="flex-1 px-4 py-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Press Enter to send. Type <code className="px-1 rounded bg-muted">/</code> for slash commands. This uses the MCP <code className="px-1 rounded bg-muted">chat</code> tool.
          </p>
        </div>
      </div>
    </Layout>
  );
}
