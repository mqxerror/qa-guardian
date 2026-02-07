/**
 * AI Test Generation Types
 *
 * Type definitions for AI test generation routes.
 *
 * Feature #1375: Extracted from ai-test-generation.ts for modularity
 *
 * @module ai-test-gen-types
 */

// =============================================================================
// Request Interfaces
// =============================================================================

export interface NLTestGenerationRequest {
  description: string;
  base_url?: string;
  test_type?: 'e2e' | 'visual_regression' | 'accessibility' | 'load';
  include_assertions?: boolean;
  include_screenshot?: boolean;
}

export interface UserStoryTestSuiteRequest {
  user_story: string;
  base_url?: string;
  include_edge_cases?: boolean;
  test_type?: 'e2e' | 'visual_regression' | 'accessibility';
}

export interface GherkinToPlaywrightRequest {
  gherkin: string;
  base_url?: string;
  feature_name?: string;
}

export interface ScreenshotToTestRequest {
  image_data: string;
  image_type?: string;
  base_url?: string;
  context?: string;
}

export interface AnnotatedScreenshotRequest {
  image_data: string;
  image_type?: string;
  base_url?: string;
  context?: string;
  annotations: Array<{
    type: 'click' | 'type' | 'expect';
    x: number;
    y: number;
    label?: string;
    expectation?: string;
  }>;
}

export interface ExplainTestRequest {
  code: string;
  test_name?: string;
  test_type?: string;
}

export interface HealWithVisionRequest {
  element_screenshot: string;
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

export interface ExplainAnomalyRequest {
  anomaly_type: 'failure_spike' | 'performance_degradation' | 'flaky_test' | 'duration_anomaly' | 'coverage_drop';
  anomaly_data: {
    metric_name: string;
    current_value: number;
    baseline_value: number;
    deviation_percentage: number;
    timestamp: string;
    affected_tests?: string[];
    affected_suites?: string[];
  };
  context?: {
    project_name?: string;
    recent_changes?: string[];
    environment?: string;
  };
}

export interface GenerateReleaseNotesRequest {
  from_version: string;
  to_version: string;
  project_name?: string;
  test_changes?: Array<{
    type: 'added' | 'modified' | 'removed';
    testName: string;
    suiteName: string;
    description?: string;
    category?: 'feature' | 'bugfix' | 'improvement' | 'refactor';
  }>;
  format?: 'markdown' | 'html' | 'json' | 'all';
}

export interface AnalyzeTestImprovementsRequest {
  test_code: string;
  test_name?: string;
  test_type?: 'e2e' | 'unit' | 'integration' | 'visual' | 'api';
  framework?: 'playwright' | 'cypress' | 'selenium' | 'jest' | 'mocha';
  include_best_practices?: boolean;
  include_selector_analysis?: boolean;
  include_assertion_suggestions?: boolean;
  include_flakiness_analysis?: boolean;
}

// =============================================================================
// Response Interfaces
// =============================================================================

export interface GeneratedTest {
  code: string;
  test_name: string;
  description: string;
  steps: string[];
  selectors: string[];
  assertions: string[];
  syntax_valid: boolean;
  syntax_errors?: string[];
  estimated_duration_ms: number;
  complexity: 'simple' | 'medium' | 'complex';
  warnings?: string[];
}

export interface GeneratedTestSuite {
  suite_name: string;
  user_story: string;
  tests: GeneratedTest[];
  edge_case_tests: GeneratedTest[];
  total_tests: number;
  estimated_total_duration_ms: number;
  generated_at: string;
}

export interface GherkinStep {
  keyword: 'Given' | 'When' | 'Then' | 'And' | 'But';
  text: string;
  action: string;
  playwright_code: string;
}

export interface ConvertedGherkinTest {
  code: string;
  test_name: string;
  feature_name: string;
  scenario_name: string;
  steps: GherkinStep[];
  syntax_valid: boolean;
  syntax_errors?: string[];
  complexity: 'simple' | 'medium' | 'complex';
}
