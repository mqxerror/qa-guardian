/**
 * AI Test Generation Service
 *
 * Feature #1500: Bridge between REST API and MCP AI handlers
 *
 * This service wraps the MCP AI generation handlers to provide
 * a clean interface for REST API endpoints. It ensures that REST
 * endpoints use REAL AI instead of fake/template responses.
 *
 * Previously, REST endpoints returned hardcoded mock data claiming
 * to use "claude-sonnet-4" but never actually called the AI. This
 * service fixes that by delegating to the real MCP handlers.
 */

import { handlers as aiGenerationHandlers } from '../mcp/handlers/ai-generation';
import { handlers as aiAnalysisHandlers } from '../mcp/handlers/ai-analysis';
import { HandlerContext } from '../mcp/handlers/types';

// =============================================================================
// Types
// =============================================================================

export interface GenerateTestRequest {
  description: string;
  target_url?: string;
  test_type?: 'e2e' | 'visual_regression' | 'accessibility' | 'load';
  include_assertions?: boolean;
  include_comments?: boolean;
  include_screenshot?: boolean;
  language?: 'typescript' | 'javascript';
  use_real_ai?: boolean;
  // For regeneration
  feedback?: string;
  previous_code?: string;
  version?: number;
}

export interface GenerateTestSuiteRequest {
  user_story: string;
  target_url?: string;
  include_edge_cases?: boolean;
  include_negative_tests?: boolean;
  max_tests?: number;
  use_real_ai?: boolean;
}

export interface ConvertGherkinRequest {
  gherkin: string;
  target_url?: string;
  feature_name?: string;
  include_page_objects?: boolean;
  language?: 'typescript' | 'javascript';
  use_real_ai?: boolean;
}

export interface AnalyzeScreenshotRequest {
  image_base64: string;
  media_type?: string;
  target_url?: string;
  focus_area?: 'all' | 'forms' | 'navigation' | 'interactive';
  include_positions?: boolean;
  max_elements?: number;
  generate_code?: boolean;
}

export interface AnnotatedScreenshotRequest {
  image_base64: string;
  annotations?: Array<{
    marker_id: string;
    action: 'click' | 'fill' | 'select' | 'verify' | 'hover' | 'scroll' | 'wait' | 'navigate';
    value?: string;
    description?: string;
  }>;
  media_type?: string;
  target_url?: string;
  test_name?: string;
  include_comments?: boolean;
  include_assertions?: boolean;
  language?: 'typescript' | 'javascript';
}

export interface AssessConfidenceRequest {
  description: string;
  test_context?: string;
  target_url?: string;
  use_real_ai?: boolean;
}

export interface GenerateSelectorsRequest {
  element_description: string;
  element_type?: string;
  page_context?: string;
  html_snippet?: string;
  preferred_types?: string[];
  use_real_ai?: boolean;
}

export interface GenerateAssertionsRequest {
  test_purpose: string;
  test_context?: string;
  expected_outcomes?: string[];
  include_error_assertions?: boolean;
  include_accessibility_checks?: boolean;
  use_real_ai?: boolean;
}

export interface GenerateUserFlowRequest {
  flow_description: string;
  target_url?: string;
  flow_name?: string;
  include_setup?: boolean;
  include_teardown?: boolean;
  include_screenshots?: boolean;
  language?: 'typescript' | 'javascript';
  use_real_ai?: boolean;
}

export interface GetCoverageGapsRequest {
  project_id: string;
  include_suggestions?: boolean;
  min_priority?: number;
}

export interface ExplainTestRequest {
  test_code: string;
  test_name?: string;
  test_type?: string;
  error_message?: string;
  stack_trace?: string;
  screenshot_url?: string;
  browser?: string;
  environment?: string;
  include_code_fix?: boolean;
  include_root_cause?: boolean;
  verbosity?: 'brief' | 'standard' | 'detailed';
}

export interface SuggestImprovementsRequest {
  test_code: string;
  test_name?: string;
  test_id?: string;
  suite_id?: string;
  test_type?: 'e2e' | 'unit' | 'integration' | 'visual' | 'api';
  framework?: 'playwright' | 'cypress' | 'selenium' | 'jest' | 'mocha';
  focus_area?: 'all' | 'selectors' | 'waits' | 'assertions' | 'performance';
  include_code_examples?: boolean;
  include_best_practices?: boolean;
  include_selector_analysis?: boolean;
  include_assertion_suggestions?: boolean;
  include_flakiness_analysis?: boolean;
  max_suggestions?: number;
  use_real_ai?: boolean;
}

export interface HealWithVisionRequest {
  element_screenshot?: string;
  page_screenshot: string;
  original_selector: string;
  selector_type?: string;
  element_context?: {
    tag_name?: string;
    text_content?: string;
    classes?: string[];
    attributes?: Record<string, string>;
    bounding_box?: { x: number; y: number; width: number; height: number };
  };
  page_url?: string;
  test_name?: string;
}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Create a handler context for MCP calls from REST API
 */
function createHandlerContext(apiKey?: string): HandlerContext {
  return {
    callApi: async (endpoint: string, options?: { method?: string; body?: Record<string, unknown> }) => {
      // For REST API usage, we don't need to call the API again
      // The handlers work directly with AI providers
      console.log(`[AI Service] API call to ${endpoint} (not needed for direct handler invocation)`);
      return {};
    },
    callApiPublic: async (endpoint: string) => {
      console.log(`[AI Service] Public API call to ${endpoint}`);
      return {};
    },
    log: (message: string) => {
      console.log(`[AI Service] ${message}`);
    },
    apiKey,
    apiUrl: process.env.API_URL || 'http://localhost:3001',
  };
}

/**
 * AI Test Generation Service
 *
 * Provides a clean interface for REST API endpoints to use real AI
 * through the MCP handler infrastructure.
 */
export class AITestGenerationService {
  private context: HandlerContext;

  constructor(apiKey?: string) {
    this.context = createHandlerContext(apiKey);
  }

  /**
   * Generate a Playwright test from natural language description
   * Uses REAL Claude AI via the MCP handler
   */
  async generateTest(request: GenerateTestRequest): Promise<unknown> {
    const handler = aiGenerationHandlers.generate_test_from_description;
    if (!handler) {
      throw new Error('generate_test_from_description handler not found');
    }

    return handler(
      {
        description: request.description,
        target_url: request.target_url,
        include_assertions: request.include_assertions ?? true,
        include_comments: request.include_comments ?? true,
        language: request.language ?? 'typescript',
        use_real_ai: request.use_real_ai ?? true,
        feedback: request.feedback,
        previous_code: request.previous_code,
        version: request.version,
      },
      this.context
    );
  }

  /**
   * Generate a simplified test (uses cheaper Haiku model)
   */
  async generateSimpleTest(request: GenerateTestRequest): Promise<unknown> {
    const handler = aiGenerationHandlers.generate_test;
    if (!handler) {
      throw new Error('generate_test handler not found');
    }

    return handler(
      {
        description: request.description,
        target_url: request.target_url,
        use_real_ai: request.use_real_ai ?? true,
      },
      this.context
    );
  }

  /**
   * Generate a test suite from user story
   * Uses REAL Claude AI via the MCP handler
   */
  async generateTestSuite(request: GenerateTestSuiteRequest): Promise<unknown> {
    const handler = aiGenerationHandlers.generate_test_suite;
    if (!handler) {
      throw new Error('generate_test_suite handler not found');
    }

    return handler(
      {
        user_story: request.user_story,
        target_url: request.target_url,
        include_edge_cases: request.include_edge_cases ?? true,
        include_negative_tests: request.include_negative_tests ?? true,
        max_tests: request.max_tests ?? 10,
        use_real_ai: request.use_real_ai ?? true,
      },
      this.context
    );
  }

  /**
   * Convert Gherkin BDD scenarios to Playwright tests
   * Uses REAL Claude AI via the MCP handler
   */
  async convertGherkin(request: ConvertGherkinRequest): Promise<unknown> {
    const handler = aiGenerationHandlers.convert_gherkin;
    if (!handler) {
      throw new Error('convert_gherkin handler not found');
    }

    return handler(
      {
        gherkin: request.gherkin,
        target_url: request.target_url,
        include_page_objects: request.include_page_objects ?? false,
        language: request.language ?? 'typescript',
        use_real_ai: request.use_real_ai ?? true,
      },
      this.context
    );
  }

  /**
   * Analyze a screenshot using Claude Vision
   * Uses REAL Claude Vision API via the MCP handler
   */
  async analyzeScreenshot(request: AnalyzeScreenshotRequest): Promise<unknown> {
    const handler = aiGenerationHandlers.analyze_screenshot;
    if (!handler) {
      throw new Error('analyze_screenshot handler not found');
    }

    return handler(
      {
        image_base64: request.image_base64,
        media_type: request.media_type ?? 'image/png',
        target_url: request.target_url,
        focus_area: request.focus_area ?? 'all',
        include_positions: request.include_positions ?? true,
        max_elements: request.max_elements ?? 50,
        generate_code: request.generate_code ?? false,
      },
      this.context
    );
  }

  /**
   * Generate test from annotated screenshot using Claude Vision
   * Uses REAL Claude Vision API via the MCP handler
   */
  async generateTestFromAnnotatedScreenshot(request: AnnotatedScreenshotRequest): Promise<unknown> {
    const handler = aiGenerationHandlers.generate_test_from_annotated_screenshot;
    if (!handler) {
      throw new Error('generate_test_from_annotated_screenshot handler not found');
    }

    return handler(
      {
        image_base64: request.image_base64,
        annotations: request.annotations,
        media_type: request.media_type ?? 'image/png',
        target_url: request.target_url,
        test_name: request.test_name,
        include_comments: request.include_comments ?? true,
        include_assertions: request.include_assertions ?? true,
        language: request.language ?? 'typescript',
      },
      this.context
    );
  }

  /**
   * Assess the confidence/quality of a test description
   */
  async assessConfidence(request: AssessConfidenceRequest): Promise<unknown> {
    const handler = aiGenerationHandlers.assess_test_confidence;
    if (!handler) {
      throw new Error('assess_test_confidence handler not found');
    }

    return handler(
      {
        description: request.description,
        test_context: request.test_context,
        target_url: request.target_url,
        use_real_ai: request.use_real_ai ?? true,
      },
      this.context
    );
  }

  /**
   * Generate optimal selectors for a UI element
   */
  async generateSelectors(request: GenerateSelectorsRequest): Promise<unknown> {
    const handler = aiGenerationHandlers.generate_selectors;
    if (!handler) {
      throw new Error('generate_selectors handler not found');
    }

    return handler(
      {
        element_description: request.element_description,
        element_type: request.element_type,
        page_context: request.page_context,
        html_snippet: request.html_snippet,
        preferred_types: request.preferred_types,
        use_real_ai: request.use_real_ai ?? true,
      },
      this.context
    );
  }

  /**
   * Generate assertions for a test
   */
  async generateAssertions(request: GenerateAssertionsRequest): Promise<unknown> {
    const handler = aiGenerationHandlers.generate_assertions;
    if (!handler) {
      throw new Error('generate_assertions handler not found');
    }

    return handler(
      {
        test_purpose: request.test_purpose,
        test_context: request.test_context,
        expected_outcomes: request.expected_outcomes,
        include_error_assertions: request.include_error_assertions ?? true,
        include_accessibility_checks: request.include_accessibility_checks ?? false,
        use_real_ai: request.use_real_ai ?? true,
      },
      this.context
    );
  }

  /**
   * Generate a multi-step user flow test
   */
  async generateUserFlow(request: GenerateUserFlowRequest): Promise<unknown> {
    const handler = aiGenerationHandlers.generate_user_flow;
    if (!handler) {
      throw new Error('generate_user_flow handler not found');
    }

    return handler(
      {
        flow_description: request.flow_description,
        target_url: request.target_url,
        flow_name: request.flow_name,
        include_setup: request.include_setup ?? true,
        include_teardown: request.include_teardown ?? true,
        include_screenshots: request.include_screenshots ?? false,
        language: request.language ?? 'typescript',
        use_real_ai: request.use_real_ai ?? true,
      },
      this.context
    );
  }

  /**
   * Get coverage gaps for a project
   */
  async getCoverageGaps(request: GetCoverageGapsRequest): Promise<unknown> {
    const handler = aiGenerationHandlers.get_coverage_gaps;
    if (!handler) {
      throw new Error('get_coverage_gaps handler not found');
    }

    return handler(
      {
        project_id: request.project_id,
        include_suggestions: request.include_suggestions ?? true,
        min_priority: request.min_priority ?? 0,
      },
      this.context
    );
  }

  /**
   * Parse a test description to extract structured information
   */
  async parseTestDescription(description: string, targetUrl?: string): Promise<unknown> {
    const handler = aiGenerationHandlers.parse_test_description;
    if (!handler) {
      throw new Error('parse_test_description handler not found');
    }

    return handler(
      {
        description,
        target_url: targetUrl,
        use_real_ai: true,
      },
      this.context
    );
  }

  // =============================================================================
  // AI Analysis Methods (from ai-analysis handlers)
  // =============================================================================

  /**
   * Explain test code in plain English
   * Uses REAL Claude AI via the MCP handler
   */
  async explainTestCode(request: ExplainTestRequest): Promise<unknown> {
    const handler = aiAnalysisHandlers.explain_test_failure_ai;
    if (!handler) {
      throw new Error('explain_test_failure_ai handler not found');
    }

    return handler(
      {
        error_message: request.error_message || 'Test code analysis requested',
        test_code: request.test_code,
        test_name: request.test_name,
        stack_trace: request.stack_trace,
        screenshot_url: request.screenshot_url,
        browser: request.browser,
        environment: request.environment,
        include_code_fix: request.include_code_fix ?? false,
        include_root_cause: request.include_root_cause ?? true,
        verbosity: request.verbosity ?? 'standard',
      },
      this.context
    );
  }

  /**
   * Suggest test improvements using AI
   * Uses REAL Claude AI via the MCP handler
   */
  async suggestTestImprovements(request: SuggestImprovementsRequest): Promise<unknown> {
    const handler = aiAnalysisHandlers.suggest_test_improvements;
    if (!handler) {
      throw new Error('suggest_test_improvements handler not found');
    }

    return handler(
      {
        test_id: request.test_id,
        suite_id: request.suite_id,
        test_code: request.test_code,
        focus_area: request.focus_area ?? 'all',
        include_code_examples: request.include_code_examples ?? true,
        max_suggestions: request.max_suggestions ?? 5,
        use_real_ai: request.use_real_ai ?? true,
      },
      this.context
    );
  }

  /**
   * Heal selector with vision analysis
   * Uses Claude Vision API to find the new selector
   */
  async healWithVision(request: HealWithVisionRequest): Promise<unknown> {
    const handler = aiGenerationHandlers.analyze_screenshot;
    if (!handler) {
      throw new Error('analyze_screenshot handler not found');
    }

    // Use screenshot analysis to find the element
    const analysisResult = await handler(
      {
        image_base64: request.page_screenshot,
        media_type: 'image/png',
        target_url: request.page_url,
        focus_area: 'interactive',
        include_positions: true,
        max_elements: 100,
        generate_code: true,
      },
      this.context
    );

    // Add healing-specific context to the result
    const result = analysisResult && typeof analysisResult === 'object' && !Array.isArray(analysisResult)
      ? analysisResult as Record<string, unknown>
      : {};
    return {
      ...result,
      healing_context: {
        original_selector: request.original_selector,
        selector_type: request.selector_type,
        element_context: request.element_context,
        test_name: request.test_name,
      },
    };
  }
}

// Singleton instance for easy import
export const aiTestGenerationService = new AITestGenerationService();

export default aiTestGenerationService;
