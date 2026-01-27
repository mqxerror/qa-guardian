/**
 * UnifiedAIService - Singleton service for all AI interactions
 * Feature #1765: Single service that handles all AI requests across the app
 *
 * This service provides a unified interface for:
 * - MCP Chat natural language queries
 * - AI Test Generation
 * - Form filling assistance
 * - Test intent parsing
 * - AI Copilot features
 */

// API base URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://qa.pixelcraftedmedia.com';

// Types for AI responses
export interface AIMetadata {
  used_real_ai: boolean;
  provider?: string;
  model?: string;
  execution_time_ms?: number;
  tokens?: {
    input?: number;
    output?: number;
  };
}

export interface AIStatusResponse {
  ready: boolean;
  providers: {
    available: boolean;
    primary: { name: string; available: boolean; model?: string };
    fallback: { name: string; available: boolean; model?: string };
  };
  message: string;
}

export interface ChatResponse {
  success: boolean;
  content: string;
  toolCalled?: string;
  toolResult?: unknown;
  isCommand?: boolean;
  aiMetadata?: AIMetadata;
  error?: string;
}

export interface GeneratedTest {
  test_name: string;
  test_code: string;
  language: string;
  confidence_score?: number;
  suggested_variations?: string[];
  improvement_suggestions?: string[];
  ai_metadata?: AIMetadata;
}

export interface TestGenerationOptions {
  description: string;
  target_url?: string;
  language?: 'typescript' | 'javascript';
  include_comments?: boolean;
  include_assertions?: boolean;
  test_framework?: string;
}

export interface ParsedTestIntent {
  action: 'create' | 'run' | 'analyze' | 'generate' | 'unknown';
  testType?: 'e2e' | 'visual' | 'accessibility' | 'performance' | 'load' | 'security';
  targetUrl?: string;
  testName?: string;
  parameters?: Record<string, unknown>;
  confidence: number;
}

export interface FormFillSuggestion {
  field: string;
  value: string;
  confidence: number;
  reasoning?: string;
}

export interface FormContext {
  formType: 'test' | 'project' | 'suite' | 'schedule' | 'other';
  existingData?: Record<string, unknown>;
  fieldLabels?: Record<string, string>;
}

/**
 * UnifiedAIService Singleton
 * Provides centralized AI functionality for the entire application
 */
class UnifiedAIServiceClass {
  private static instance: UnifiedAIServiceClass;
  private token: string | null = null;
  private aiStatus: AIStatusResponse | null = null;
  private statusCheckPromise: Promise<AIStatusResponse> | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): UnifiedAIServiceClass {
    if (!UnifiedAIServiceClass.instance) {
      UnifiedAIServiceClass.instance = new UnifiedAIServiceClass();
    }
    return UnifiedAIServiceClass.instance;
  }

  /**
   * Set the authentication token for API calls
   */
  public setToken(token: string | null): void {
    this.token = token;
  }

  /**
   * Get common headers for API requests
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  /**
   * Check AI service status
   */
  public async checkStatus(): Promise<AIStatusResponse> {
    // Return cached status if available and recent
    if (this.aiStatus) {
      return this.aiStatus;
    }

    // Avoid multiple concurrent status checks
    if (this.statusCheckPromise) {
      return this.statusCheckPromise;
    }

    this.statusCheckPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/mcp/status`);
        if (response.ok) {
          this.aiStatus = await response.json();
          return this.aiStatus!;
        }
        throw new Error(`Status check failed: ${response.status}`);
      } catch (error) {
        console.error('Failed to check AI status:', error);
        this.aiStatus = {
          ready: false,
          providers: {
            available: false,
            primary: { name: 'Kie.ai', available: false },
            fallback: { name: 'Anthropic', available: false },
          },
          message: 'Failed to connect to AI service',
        };
        return this.aiStatus;
      } finally {
        this.statusCheckPromise = null;
      }
    })();

    return this.statusCheckPromise;
  }

  /**
   * Clear cached AI status (useful when token changes)
   */
  public clearStatusCache(): void {
    this.aiStatus = null;
  }

  /**
   * Send a chat message to the AI
   * Used by MCP Chat and other natural language interfaces
   */
  public async chat(
    message: string,
    conversationId?: string
  ): Promise<ChatResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/mcp/chat`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          message,
          context: {
            conversation_id: conversationId || `conv_${Date.now()}`,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        return {
          success: false,
          content: data.error || 'Unknown error occurred',
          error: data.error,
        };
      }

      // Format the response
      const result = data.result;
      let content: string;
      let isCommand = false;

      if (result?.response) {
        content = result.response;
        isCommand = content.includes('```');
      } else if (result?.generated_code) {
        content = `**Generated Test: ${result.test_name || 'New Test'}**\n\n\`\`\`typescript\n${result.generated_code}\n\`\`\``;
        isCommand = true;
      } else if (result?.explanation) {
        content = result.explanation;
      } else if (result?.suggestions && Array.isArray(result.suggestions)) {
        content = `**Suggestions:**\n\n${result.suggestions.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')}`;
      } else if (result?.error) {
        content = `**Error:** ${result.error}`;
      } else if (typeof result === 'string') {
        content = result;
      } else {
        content = JSON.stringify(result, null, 2);
      }

      return {
        success: true,
        content,
        toolCalled: data.tool_used,
        toolResult: result,
        isCommand,
        aiMetadata: {
          used_real_ai: data.metadata?.used_real_ai || false,
          provider: data.metadata?.provider,
          model: data.metadata?.model,
          execution_time_ms: data.metadata?.execution_time_ms,
        },
      };
    } catch (error) {
      console.error('UnifiedAIService chat error:', error);
      return {
        success: false,
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate a test from a natural language description
   * Used by AI Test Generator and Create Test modal
   */
  public async generateTest(options: TestGenerationOptions): Promise<{
    success: boolean;
    test?: GeneratedTest;
    error?: string;
  }> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/mcp/execute`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          tool_name: 'generate_test',
          args: {
            description: options.description.trim(),
            target_url: options.target_url,
            language: options.language || 'typescript',
            include_comments: options.include_comments ?? true,
            include_assertions: options.include_assertions ?? true,
            test_framework: options.test_framework || 'playwright-test',
          },
          use_real_ai: true,
        }),
      });

      const data = await response.json();

      if (data.success && data.result) {
        const result = data.result;
        return {
          success: true,
          test: {
            test_name: result.test_name,
            test_code: result.generated_code,
            language: result.language || options.language || 'typescript',
            confidence_score: result.confidence_score,
            suggested_variations: result.suggested_variations,
            improvement_suggestions: result.improvement_suggestions,
            ai_metadata: result.ai_metadata || data.metadata,
          },
        };
      }

      return {
        success: false,
        error: data.error || 'Failed to generate test',
      };
    } catch (error) {
      console.error('UnifiedAIService generateTest error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Parse user intent from natural language for test creation
   * Used by Create Test modal to understand what the user wants
   */
  public async parseTestIntent(userInput: string): Promise<ParsedTestIntent> {
    const input = userInput.toLowerCase().trim();

    // Determine action
    let action: ParsedTestIntent['action'] = 'unknown';
    if (input.includes('create') || input.includes('new') || input.includes('add')) {
      action = 'create';
    } else if (input.includes('run') || input.includes('execute') || input.includes('start')) {
      action = 'run';
    } else if (input.includes('analyze') || input.includes('check') || input.includes('review')) {
      action = 'analyze';
    } else if (input.includes('generate') || input.includes('write')) {
      action = 'generate';
    }

    // Determine test type
    let testType: ParsedTestIntent['testType'];
    if (input.includes('visual') || input.includes('screenshot') || input.includes('ui')) {
      testType = 'visual';
    } else if (input.includes('accessibility') || input.includes('a11y') || input.includes('wcag')) {
      testType = 'accessibility';
    } else if (input.includes('performance') || input.includes('lighthouse') || input.includes('speed')) {
      testType = 'performance';
    } else if (input.includes('load') || input.includes('stress') || input.includes('k6')) {
      testType = 'load';
    } else if (input.includes('security') || input.includes('dast') || input.includes('scan')) {
      testType = 'security';
    } else if (input.includes('e2e') || input.includes('end-to-end') || input.includes('functional')) {
      testType = 'e2e';
    }

    // Extract URL if present
    const urlMatch = input.match(/https?:\/\/[^\s]+/);
    const targetUrl = urlMatch ? urlMatch[0] : undefined;

    // Extract test name if present
    const nameMatch = input.match(/(?:called|named|test)\s+["']?([^"'\n]+)["']?/i);
    const testName = nameMatch ? nameMatch[1].trim() : undefined;

    // Calculate confidence
    let confidence = 0.3; // Base confidence
    if (action !== 'unknown') confidence += 0.2;
    if (testType) confidence += 0.2;
    if (targetUrl) confidence += 0.15;
    if (testName) confidence += 0.15;

    return {
      action,
      testType,
      targetUrl,
      testName,
      confidence: Math.min(confidence, 1),
    };
  }

  /**
   * Get AI suggestions for filling form fields
   * Used by Create Test modal and other forms
   */
  public async fillForm(
    context: FormContext,
    userInput: string
  ): Promise<FormFillSuggestion[]> {
    const suggestions: FormFillSuggestion[] = [];
    const input = userInput.toLowerCase();

    // Parse intent to get structured data
    const intent = await this.parseTestIntent(userInput);

    if (context.formType === 'test') {
      // Test form suggestions
      if (intent.testName) {
        suggestions.push({
          field: 'name',
          value: intent.testName,
          confidence: 0.8,
          reasoning: 'Extracted from user description',
        });
      }

      if (intent.testType) {
        suggestions.push({
          field: 'type',
          value: intent.testType,
          confidence: 0.85,
          reasoning: `Detected ${intent.testType} test type from keywords`,
        });
      }

      if (intent.targetUrl) {
        suggestions.push({
          field: 'url',
          value: intent.targetUrl,
          confidence: 0.95,
          reasoning: 'URL found in user input',
        });
      }

      // Generate default name if not found
      if (!intent.testName && intent.testType) {
        const typeNames: Record<string, string> = {
          e2e: 'E2E Test',
          visual: 'Visual Regression Test',
          accessibility: 'Accessibility Audit',
          performance: 'Performance Test',
          load: 'Load Test',
          security: 'Security Scan',
        };
        suggestions.push({
          field: 'name',
          value: `New ${typeNames[intent.testType] || 'Test'}`,
          confidence: 0.5,
          reasoning: 'Generated from test type',
        });
      }

      // Add description based on user input
      if (userInput.trim().length > 10) {
        suggestions.push({
          field: 'description',
          value: userInput.trim(),
          confidence: 0.7,
          reasoning: 'Using original user input as description',
        });
      }
    } else if (context.formType === 'project') {
      // Project form suggestions
      const projectNameMatch = input.match(/(?:project|called|named)\s+["']?([^"'\n]+)["']?/i);
      if (projectNameMatch) {
        suggestions.push({
          field: 'name',
          value: projectNameMatch[1].trim(),
          confidence: 0.8,
          reasoning: 'Extracted project name from input',
        });
      }
    } else if (context.formType === 'suite') {
      // Suite form suggestions
      const suiteNameMatch = input.match(/(?:suite|called|named)\s+["']?([^"'\n]+)["']?/i);
      if (suiteNameMatch) {
        suggestions.push({
          field: 'name',
          value: suiteNameMatch[1].trim(),
          confidence: 0.8,
          reasoning: 'Extracted suite name from input',
        });
      }
    }

    return suggestions;
  }

  /**
   * Execute an MCP tool directly
   * Used for advanced AI operations
   */
  public async executeTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<{
    success: boolean;
    result?: unknown;
    error?: string;
    metadata?: AIMetadata;
  }> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/mcp/execute`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          tool_name: toolName,
          args,
          use_real_ai: true,
        }),
      });

      const data = await response.json();

      return {
        success: data.success,
        result: data.result,
        error: data.error,
        metadata: data.metadata,
      };
    } catch (error) {
      console.error(`UnifiedAIService executeTool(${toolName}) error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get AI-powered suggestions for test improvements
   */
  public async suggestTestImprovements(
    testCode: string,
    testType: string
  ): Promise<{
    success: boolean;
    suggestions?: string[];
    error?: string;
  }> {
    return this.executeTool('suggest_fix', {
      test_code: testCode,
      test_type: testType,
    }).then((response) => ({
      success: response.success,
      suggestions: (response.result as { suggestions?: string[] } | undefined)?.suggestions,
      error: response.error,
    }));
  }

  /**
   * Get AI explanation for a test failure
   */
  public async explainFailure(
    runId: string,
    testId?: string
  ): Promise<{
    success: boolean;
    explanation?: string;
    suggestions?: string[];
    error?: string;
  }> {
    return this.executeTool('explain_test_failure_ai', {
      run_id: runId,
      test_id: testId,
    }).then((response) => ({
      success: response.success,
      explanation: (response.result as { explanation?: string })?.explanation,
      suggestions: (response.result as { suggestions?: string[] })?.suggestions,
      error: response.error,
    }));
  }
}

// Export singleton instance
export const UnifiedAIService = UnifiedAIServiceClass.getInstance();

// Export types for consumers
export type { UnifiedAIServiceClass };
