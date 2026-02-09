/**
 * Type definitions for AI Generation Handler Results
 *
 * These types define the structure of responses returned by AI generation handlers.
 * Used in test files to provide proper typing instead of `as any` casts.
 *
 * Feature #488: Eliminate as any casts in backend services and MCP handlers
 */

/**
 * Common AI metadata included in all AI-powered handler responses
 */
export interface AIMetadata {
  used_real_ai?: boolean;
  provider?: string;
  model?: string;
  confidence_score?: number;
  tokens?: {
    input?: number;
    output?: number;
  };
  vision_used?: boolean;
  analysis_time_ms?: number;
  generation_time_ms?: number;
}

/**
 * Base result type for all handlers
 */
export interface BaseHandlerResult {
  success: boolean;
  error?: string;
  message?: string;
  data_source?: string;
  ai_metadata?: AIMetadata;
}

/**
 * Result from generate_test_from_description and generate_test handlers
 */
export interface GenerateTestResult extends BaseHandlerResult {
  test_name?: string;
  generated_code?: string;
  ai_provider?: string;
  confidence_score?: number;
  suggested_variations?: string[];
}

/**
 * Result from generate_test_suite handler
 */
export interface GenerateTestSuiteResult extends BaseHandlerResult {
  suite_name?: string;
  tests?: Array<{
    name: string;
    code: string;
    type?: string;
  }>;
  test_summary?: {
    positive_tests?: number;
    negative_tests?: number;
    edge_case_tests?: number;
    total?: number;
  };
}

/**
 * Result from convert_gherkin handler
 */
export interface ConvertGherkinResult extends BaseHandlerResult {
  feature_name?: string;
  scenario_name?: string;
  scenario_type?: string;
  is_parameterized?: boolean;
  has_background?: boolean;
  parsed_steps?: {
    given?: string[];
    when?: string[];
    then?: string[];
    background?: string[];
  };
  page_object_code?: string;
  generated_code?: string;
  examples?: {
    headers?: string[];
    row_count?: number;
    rows?: Record<string, string>[];
  };
}

/**
 * Result from get_coverage_gaps handler
 */
export interface GetCoverageGapsResult extends BaseHandlerResult {
  overall_coverage?: number;
  untested_areas?: string[];
  suggested_tests?: Array<{
    name: string;
    priority: number;
    description: string;
  }>;
  summary?: {
    critical_gaps?: number;
    high_priority_gaps?: number;
    medium_priority_gaps?: number;
  };
}

/**
 * Result from parse_test_description handler
 */
export interface ParseTestDescriptionResult extends BaseHandlerResult {
  parsed_structure?: {
    test_name?: string;
    steps?: string[];
    assertions?: string[];
    test_data?: string[];
    ambiguities?: Array<{
      description: string;
      severity: string;
    }>;
  };
  summary?: {
    step_count?: number;
    assertion_count?: number;
    ambiguity_count?: number;
    high_severity_ambiguities?: number;
  };
}

/**
 * Selector type for generate_selectors results
 */
export interface SelectorInfo {
  type: string;
  value?: string;
  playwright_code?: string;
  stability_score?: number;
  confidence_score?: number;
  reasoning?: string;
}

/**
 * Result from generate_selectors handler
 */
export interface GenerateSelectorsResult extends BaseHandlerResult {
  selector_count?: number;
  primary_selector?: SelectorInfo;
  alternative_selectors?: SelectorInfo[];
  summary?: {
    recommended_type?: string;
    stability_rating?: string;
    has_high_stability_option?: boolean;
  };
}

/**
 * Result from generate_assertions handler
 */
export interface GenerateAssertionsResult extends BaseHandlerResult {
  assertion_count?: number;
  assertions?: Array<{
    type: string;
    category: string;
    playwright_code?: string;
    description?: string;
    priority?: string;
  }>;
  by_category?: {
    positive?: number;
    negative?: number;
    error_handling?: number;
    accessibility?: number;
  };
  by_priority?: {
    high?: number;
    medium?: number;
    low?: number;
  };
  code_snippet?: string;
}

/**
 * Result from generate_user_flow handler
 */
export interface GenerateUserFlowResult extends BaseHandlerResult {
  test_name?: string;
  step_count?: number;
  steps?: Array<{
    name: string;
    action: string;
    code?: string;
  }>;
  flow_summary?: {
    total_steps?: number;
    navigation_steps?: number;
    screenshot_steps?: number;
    has_setup?: boolean;
    has_teardown?: boolean;
  };
  complete_test_code?: string;
}

/**
 * Result from assess_test_confidence handler
 */
export interface AssessTestConfidenceResult extends BaseHandlerResult {
  confidence_score?: number;
  confidence_level?: string;
  scores?: {
    clarity?: number;
    specificity?: number;
    completeness?: number;
    testability?: number;
  };
  ambiguity_count?: number;
  high_severity_issues?: number;
  strengths?: string[];
  weaknesses?: string[];
  clarifying_questions?: string[];
  generation_recommendation?: string;
}

/**
 * Result from analyze_screenshot handler
 */
export interface AnalyzeScreenshotResult extends BaseHandlerResult {
  page_type?: string;
  page_description?: string;
  elements?: Array<{
    type: string;
    description: string;
    selector?: string;
    position?: { x: number; y: number; width: number; height: number };
  }>;
  element_count?: number;
  interactive_count?: number;
  overall_confidence?: number;
  element_summary?: {
    buttons?: number;
    links?: number;
    inputs?: number;
    forms?: number;
    images?: number;
  };
  suggested_test_flow?: string[];
  code_snippets?: Record<string, string>;
  analyzed_at?: string;
}

/**
 * Result from generate_test_from_annotated_screenshot handler
 */
export interface GenerateAnnotatedTestResult extends BaseHandlerResult {
  test_name?: string;
  steps?: Array<{
    marker_id: string;
    action: string;
    description: string;
    code?: string;
  }>;
  step_count?: number;
  step_summary?: {
    click_actions?: number;
    fill_actions?: number;
    verify_actions?: number;
    hover_actions?: number;
    other_actions?: number;
  };
  test_code?: string;
  generated_at?: string;
}

/**
 * Union type for all handler results - use for generic handler typing
 */
export type AnyHandlerResult =
  | GenerateTestResult
  | GenerateTestSuiteResult
  | ConvertGherkinResult
  | GetCoverageGapsResult
  | ParseTestDescriptionResult
  | GenerateSelectorsResult
  | GenerateAssertionsResult
  | GenerateUserFlowResult
  | AssessTestConfidenceResult
  | AnalyzeScreenshotResult
  | GenerateAnnotatedTestResult;

/**
 * Type-safe handler function with specific result type
 */
export type TypedHandler<TResult extends BaseHandlerResult> = (
  args: Record<string, unknown>,
  ctx: import('./types.js').HandlerContext
) => Promise<TResult>;

// =====================================================
// AI Provider Handler Types
// =====================================================

/**
 * Provider info in status response
 */
export interface ProviderInfo {
  name: string;
  status: string;
  is_configured?: boolean;
  circuit_breaker_state?: string;
  failure_count?: number;
  failover_enabled?: boolean;
}

/**
 * Circuit breaker info
 */
export interface CircuitBreakerInfo {
  provider: string;
  state: string;
  failure_count: number;
}

/**
 * Router config info
 */
export interface RouterConfigInfo {
  enabled: boolean;
  timeout_ms: number;
  fallback_on_timeout: boolean;
  cost_tracking: boolean;
}

/**
 * Health metrics info
 */
export interface HealthMetricsInfo {
  avg_latency_ms: number;
  p95_latency_ms: number;
  requests_total: number;
  requests_success: number;
  requests_failed: number;
  primary_success_rate: number;
  fallback_success_rate: number;
  failover_count: number;
}

/**
 * Result from get_ai_provider_status handler
 */
export interface AiProviderStatusResult extends BaseHandlerResult {
  overall_status?: string;
  router_enabled?: boolean;
  ai_service_initialized?: boolean;
  primary_provider?: ProviderInfo;
  fallback_provider?: ProviderInfo;
  circuit_breakers?: CircuitBreakerInfo[];
  router_config?: RouterConfigInfo;
  health_metrics?: HealthMetricsInfo;
}

/**
 * Provider cost breakdown
 */
export interface ProviderCostBreakdown {
  provider: string;
  cost_usd: number;
  requests: number;
  tokens: number;
}

/**
 * Savings info
 */
export interface SavingsInfo {
  total_savings_usd: number;
  savings_percentage: number;
  kie_cost_usd: number;
  anthropic_baseline_usd: number;
  actual_cost_usd: number;
  by_provider?: {
    kie: { requests: number; cost_usd: number };
    anthropic: { requests: number; cost_usd: number };
  };
}

/**
 * Budget status info
 */
export interface BudgetStatusInfo {
  current_month: string;
  monthly_budget_usd: number;
  spent_usd: number;
  remaining_usd: number;
  percentage_used: number;
  threshold_alert_triggered: boolean;
  requests_blocked: number;
}

/**
 * Result from get_ai_cost_report handler
 */
export interface AiCostReportResult extends BaseHandlerResult {
  total_cost_usd?: number;
  total_requests?: number;
  total_tokens?: number;
  by_provider?: ProviderCostBreakdown[];
  savings?: SavingsInfo;
  budget_status?: BudgetStatusInfo;
}

/**
 * Result from switch_ai_provider handler
 */
export interface SwitchAiProviderResult extends BaseHandlerResult {
  previous_provider?: string;
  new_provider?: string;
  new_fallback?: string;
  in_flight_requests?: number;
  circuit_breaker_reset?: boolean;
}

// =====================================================
// AI Analysis Handler Types
// =====================================================

/**
 * Result from explain_test_failure_ai handler
 */
export interface ExplainTestFailureResult extends BaseHandlerResult {
  explanation?: string;
  root_cause?: string;
  suggested_fixes?: string[];
  related_failures?: string[];
  confidence?: number;
}

/**
 * Result from suggest_test_improvements handler
 */
export interface SuggestImprovementsResult extends BaseHandlerResult {
  improvements?: Array<{
    type: string;
    description: string;
    priority: string;
    code_snippet?: string;
  }>;
  improvement_count?: number;
  categories?: {
    performance?: number;
    reliability?: number;
    maintainability?: number;
    coverage?: number;
  };
}

/**
 * Result from analyze_test_failure handler
 */
export interface AnalyzeTestFailureResult extends BaseHandlerResult {
  failure_type?: string;
  failure_category?: string;
  stack_trace_analysis?: string;
  possible_causes?: string[];
  recommended_actions?: string[];
  similar_failures?: Array<{
    test_id: string;
    similarity: number;
  }>;
}

/**
 * Result from get_ai_recommendations handler
 */
export interface GetAiRecommendationsResult extends BaseHandlerResult {
  recommendations?: Array<{
    category: string;
    title: string;
    description: string;
    priority: string;
    effort: string;
    impact: string;
  }>;
  recommendation_count?: number;
  by_priority?: {
    high?: number;
    medium?: number;
    low?: number;
  };
}
