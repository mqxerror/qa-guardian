/**
 * AI domain type definitions
 *
 * Types for AI test generation, analytics, review, release notes,
 * and test improvement analysis.
 */

// ============================================================================
// AI Analytics (Feature #412)
// ============================================================================

export interface UsageAnalytics {
  period: string;
  start_date: string;
  end_date: string;
  total_requests: number;
  total_cost: number;
  total_tokens: number;
  requests_by_provider: {
    kie: { requests: number; cost: number; tokens: number; avg_latency_ms: number };
    anthropic: { requests: number; cost: number; tokens: number; avg_latency_ms: number };
  };
  savings: {
    total_saved: number;
    percentage: number;
    if_all_anthropic_cost: number;
    actual_cost: number;
  };
  usage_by_day: Array<{
    date: string;
    kie_requests: number;
    anthropic_requests: number;
    kie_cost: number;
    anthropic_cost: number;
  }>;
  usage_by_model: Record<string, { requests: number; cost: number; tokens: number; percentage: number }>;
  usage_by_feature: Record<string, { requests: number; cost: number }>;
  peak_usage: { hour: number; requests: number; day_of_week: string };
}

export interface ProviderComparison {
  period: string;
  comparison: {
    kie: {
      total_requests: number;
      total_cost: number;
      total_tokens: number;
      avg_tokens_per_request: number;
      avg_cost_per_request: number;
      avg_latency_ms: number;
      cost_per_1k_tokens: number;
    };
    anthropic: {
      total_requests: number;
      total_cost: number;
      total_tokens: number;
      avg_tokens_per_request: number;
      avg_cost_per_request: number;
      avg_latency_ms: number;
      cost_per_1k_tokens: number;
    };
  };
  recommendation: string;
  cost_difference_percent: number;
}

export interface UsageTrends {
  period: string;
  trends: {
    cost: { current: number; previous: number; change_percent: number; trend: string };
    requests: { current: number; previous: number; change_percent: number; trend: string };
    tokens: { current: number; previous: number; change_percent: number; trend: string };
  };
}

export interface CostBudget {
  org_id: string;
  monthly_budget: number;
  warning_threshold_percent: number;
  critical_threshold_percent: number;
  auto_disable_on_limit: boolean;
  current_month_spend: number;
  budget_remaining: number;
  percentage_used: number;
  projected_month_end: number;
}

// ============================================================================
// AI Test Generator (Feature #1495, #1497, #1499)
// ============================================================================

export interface ConfidenceDetails {
  level: 'high' | 'medium' | 'low';
  score: number;
  reasons?: string[];
  suggestions?: string[];
}

export interface GeneratedTest {
  test_name: string;
  test_code: string;
  language: string;
  confidence_score?: number;
  confidence_details?: ConfidenceDetails;
  suggested_variations?: string[];
  improvement_suggestions?: string[];
  ai_metadata?: {
    provider: string;
    model: string;
    used_real_ai: boolean;
  };
  data_source: string;
  version?: number;
}

export interface VersionHistory {
  version: number;
  code: string;
  feedback?: string;
  timestamp: Date;
}

export interface GenerationOptions {
  language: 'typescript' | 'javascript';
  includeComments: boolean;
  includeAssertions: boolean;
  targetUrl: string;
  testFramework: string;
}

/** Feature #1499: Saved generation from history API */
/** Feature #1500: Approval workflow */
export interface ApprovalInfo {
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by?: string;
  reviewed_by_name?: string;
  reviewed_at?: string;
  review_comment?: string;
  added_to_suite_id?: string;
}

export interface SavedGeneration {
  id: string;
  description: string;
  test_name: string;
  generated_code: string;
  language: string;
  confidence_score: number;
  confidence_level: 'high' | 'medium' | 'low';
  version: number;
  feedback?: string;
  ai_metadata?: {
    provider: string;
    model: string;
    used_real_ai: boolean;
  };
  approval?: ApprovalInfo;
  created_at: string;
}

// ============================================================================
// AI Test Review (Feature #1500)
// ============================================================================

export interface PendingTest {
  id: string;
  description: string;
  test_name: string;
  generated_code: string;
  language: string;
  confidence_score: number;
  confidence_level: 'high' | 'medium' | 'low';
  version: number;
  ai_metadata?: {
    provider: string;
    model: string;
    used_real_ai: boolean;
  };
  approval: ApprovalInfo;
  created_at: string;
}

export interface ReviewQueueData {
  pending: PendingTest[];
  total_pending: number;
  recently_reviewed: PendingTest[];
}

export interface ApprovalStats {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
  approval_rate: string;
}

// ============================================================================
// AI Release Notes (Feature #1255)
// ============================================================================

export interface Release {
  id: string;
  version: string;
  name: string;
  date: Date;
  testsAdded: number;
  testsModified: number;
  testsRemoved: number;
}

export interface TestDelta {
  type: 'added' | 'modified' | 'removed';
  testName: string;
  suiteName: string;
  category: 'feature' | 'bugfix' | 'improvement' | 'refactor';
  description: string;
}

export interface GeneratedReleaseNotes {
  version: string;
  releaseDate: string;
  summary: string;
  newFeatures: Array<{
    title: string;
    description: string;
    category?: string;
    relatedTests: string[];
    impact?: 'high' | 'medium' | 'low';
  }>;
  bugFixes: Array<{
    title: string;
    description: string;
    severity: 'critical' | 'major' | 'minor';
    relatedTests: string[];
  }>;
  improvements: Array<{
    title: string;
    description: string;
  }>;
  breakingChanges: string[];
  testingHighlights?: {
    testsAdded: number;
    testsModified: number;
    testsRemoved: number;
    coverageImpact: string;
  };
  markdownContent: string;
  htmlContent?: string;
  jsonContent?: object;
}

/** API response types for release data */
export interface APIRelease {
  id: string;
  version: string;
  name: string;
  date: string;
  testsAdded: number;
  testsModified: number;
  testsRemoved: number;
}

export interface APINewFeature {
  title: string;
  description: string;
  category?: string;
  relatedTests?: string[];
  related_tests?: string[];
  impact?: 'high' | 'medium' | 'low';
}

export interface APIBugFix {
  title: string;
  description: string;
  severity: 'critical' | 'major' | 'minor';
  relatedTests?: string[];
  related_tests?: string[];
}

export interface APIImprovement {
  title: string;
  description: string;
}

// ============================================================================
// OpenAPI Test Generator (Feature #324)
// ============================================================================

export interface OpenAPIGeneratedTest {
  path: string;
  method: string;
  operationId: string;
  summary: string;
  tags: string[];
  testName: string;
  testCode: string;
}

export interface ParseResult {
  title: string;
  version: string;
  baseUrl: string;
  endpointCount: number;
  tags: Array<{ name: string; description?: string }>;
  paths: Array<{ path: string; methods: string[] }>;
}

export interface GenerationResult {
  apiTitle: string;
  baseUrl: string;
  specVersion: string;
  summary: {
    total: number;
    byMethod: Record<string, number>;
    byTag: Record<string, number>;
  };
  tests: OpenAPIGeneratedTest[];
}
