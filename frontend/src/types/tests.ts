/**
 * Tests domain type definitions
 *
 * Types for test runs, suites, test documentation, shared test runs,
 * visual review, and comprehensive reports.
 */

// ============================================================================
// Test Runs (Feature #1852)
// ============================================================================

export interface TestRun {
  id: string;
  suite_id: string;
  suite_name: string;
  project_id?: string;
  test_id?: string;
  test_name?: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'cancelled';
  browser?: string;
  branch?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  results_count: number;
  passed_count: number;
  failed_count: number;
  skipped_count?: number;
}

// ============================================================================
// Suite Runs (TestSuitePage)
// ============================================================================

/** Suite run result for test status tracking (compatible with both SuiteRunResults and TestListSection) */
export interface SuiteRunResultLocal {
  test_id: string;
  test_name: string;
  test_type?: string;
  status: 'passed' | 'failed' | 'error' | 'running' | 'skipped';
  duration_ms: number;
  error?: string;
  diff_percentage?: number;
}

/**
 * Suite run state - matches component expectations
 * Feature #555: Added completed_at for export functionality
 */
export interface SuiteRunLocal {
  id: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'cancelled';
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  results?: SuiteRunResultLocal[];
}

// ============================================================================
// Shared Test Runs (Feature #2002)
// ============================================================================

export interface StepResult {
  id: string;
  action: string;
  selector?: string;
  value?: string;
  status: 'passed' | 'failed' | 'skipped' | 'warning';
  duration_ms: number;
  error?: string;
}

export interface TestRunResult {
  test_id: string;
  test_name: string;
  test_type?: string;
  status: 'passed' | 'failed' | 'error' | 'skipped';
  duration_ms: number;
  steps: StepResult[];
  error?: string;
  screenshot_base64?: string;
}

/** Feature #2006: Screenshot gallery item interface */
export interface GalleryScreenshot {
  id: string;
  url: string;
  title: string;
  testName: string;
  testType: 'E2E' | 'Visual' | 'Accessibility' | 'Performance' | 'Load';
  status: 'passed' | 'failed';
  type: 'final' | 'baseline' | 'diff' | 'step';
  timestamp?: number;
}

// ============================================================================
// Test Documentation (Feature #1253, #1254)
// ============================================================================

/** Feature #1253: Test Documentation Page interfaces */
export interface TestSuiteForDocs {
  id: string;
  name: string;
  testCount: number;
  description: string;
  projectId: string;
  projectName: string;
}

/** API response type for suite data */
export interface SuiteApiResponse {
  id: string;
  name: string;
  test_count?: number;
  description?: string;
  project_id: string;
  project_name?: string;
}

export interface GeneratedDocumentation {
  featureDocumentation: {
    title: string;
    description: string;
    features: Array<{
      name: string;
      description: string;
      relatedTests: string[];
      coverage: string;
    }>;
  };
  userFlowDiagrams: Array<{
    flowName: string;
    steps: Array<{
      stepNumber: number;
      action: string;
      expectedResult: string;
      testCoverage: string;
    }>;
    mermaidDiagram: string;
  }>;
  coverageSummary: {
    totalTests: number;
    coveredFeatures: number;
    uncoveredFeatures: number;
    coveragePercentage: number;
    byCategory: Array<{
      category: string;
      tests: number;
      coverage: number;
    }>;
    recommendations: string[];
  };
}

/** Feature #1254: Living documentation - Version history interfaces */
export interface DocumentVersion {
  id: string;
  version: number;
  timestamp: Date;
  changeType: 'initial' | 'test_modified' | 'test_added' | 'test_removed' | 'auto_update';
  changedTests: string[];
  summary: string;
}

export interface TestModification {
  testId: string;
  testName: string;
  originalCode: string;
  currentCode: string;
  lastModified: Date;
}

// ============================================================================
// Visual Review (Feature #77, #1251)
// ============================================================================

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

/** Feature #1251: Visual Change Impact Analysis */
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

// ============================================================================
// Test Improvement Analysis (Feature #1350)
// ============================================================================

export interface TestImprovementAnalysis {
  overall_score: number;
  summary: string;
  best_practices: Array<{
    category: string;
    issue: string;
    severity: 'low' | 'medium' | 'high';
    suggestion: string;
    code_example?: string;
    line_number?: number;
  }>;
  selector_improvements: Array<{
    original_selector: string;
    issue: string;
    suggested_selector: string;
    reason: string;
    confidence: number;
  }>;
  assertion_suggestions: Array<{
    location: string;
    current_assertion?: string;
    suggested_assertion: string;
    reason: string;
    priority: 'low' | 'medium' | 'high';
  }>;
  flakiness_risks: Array<{
    risk: string;
    severity: 'low' | 'medium' | 'high';
    location?: string;
    mitigation: string;
    code_example?: string;
  }>;
}

// ============================================================================
// Compare Quick Test (Feature #473)
// ============================================================================

export interface WaveStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  duration?: number;
}

export interface WaveState {
  wave: number;
  name: string;
  status: 'waiting' | 'running' | 'completed' | 'failed';
  steps: WaveStep[];
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  data?: Record<string, unknown>;
  error?: string;
}

export interface QuickTestSummary {
  healthScore: number;
  performanceScore: number;
  securityScore: number;
  accessibilityScore?: number;
  apiScore?: number;
  overallScore: number;
}

export interface CompareState {
  compareId: string | null;
  runIdA: string | null;
  runIdB: string | null;
  urlA: string;
  urlB: string;
  statusA: 'idle' | 'running' | 'completed' | 'failed';
  statusB: 'idle' | 'running' | 'completed' | 'failed';
  wavesA: WaveState[];
  wavesB: WaveState[];
  summaryA: QuickTestSummary | null;
  summaryB: QuickTestSummary | null;
  startedAt: Date | null;
}

export interface ScoreDelta {
  health: number;
  performance: number;
  security: number;
  accessibility: number;
  api: number;
  overall: number;
}

// ============================================================================
// Comprehensive Report (Feature #1732)
// ============================================================================

export interface E2EReportSection {
  type: 'e2e';
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    passRate: number;
    avgDuration: number;
  };
  tests: Array<{
    id: string;
    name: string;
    status: 'passed' | 'failed' | 'skipped';
    duration: number;
    error?: string;
  }>;
}

export interface VisualReportSection {
  type: 'visual';
  summary: {
    total: number;
    noChange: number;
    diffsDetected: number;
    approved: number;
    pending: number;
  };
  comparisons: Array<{
    id: string;
    testName: string;
    viewport: string;
    diffPercentage: number;
    status: 'match' | 'diff' | 'approved' | 'pending';
  }>;
}

export interface AccessibilityReportSection {
  type: 'accessibility';
  summary: {
    total: number;
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
    wcagCompliance: number;
  };
  violations: Array<{
    id: string;
    rule: string;
    impact: 'critical' | 'serious' | 'moderate' | 'minor';
    wcagLevel: string;
    description: string;
    nodes: number;
  }>;
}

export interface PerformanceReportSection {
  type: 'performance';
  summary: {
    score: number;
    lcp: number;
    fid: number;
    cls: number;
    ttfb: number;
    fcp: number;
    tti: number;
    speedIndex: number;
  };
  coreWebVitals: {
    lcp: { value: number; rating: 'good' | 'needs-improvement' | 'poor' };
    fid: { value: number; rating: 'good' | 'needs-improvement' | 'poor' };
    cls: { value: number; rating: 'good' | 'needs-improvement' | 'poor' };
  };
}

export interface LoadReportSection {
  type: 'load';
  summary: {
    vus: number;
    duration: number;
    requestsTotal: number;
    requestsFailed: number;
    rps: number;
  };
  latency: {
    p50: number;
    p95: number;
    p99: number;
    avg: number;
    min: number;
    max: number;
  };
  thresholds: Array<{
    name: string;
    passed: boolean;
    value: string;
    threshold: string;
  }>;
}

export interface ComprehensiveReport {
  id: string;
  projectId: string;
  projectName: string;
  createdAt: string;
  createdBy: string;
  title: string;
  description?: string;
  period: {
    start: string;
    end: string;
  };
  executiveSummary: {
    overallScore: number;
    overallStatus: 'passing' | 'warning' | 'failing';
    highlights: string[];
    criticalIssues: string[];
    recommendations: string[];
  };
  sections: {
    e2e?: E2EReportSection;
    visual?: VisualReportSection;
    accessibility?: AccessibilityReportSection;
    performance?: PerformanceReportSection;
    load?: LoadReportSection;
    security?: import('./security').SecurityReportSection;
  };
}

// ============================================================================
// Schedules (Feature #1256)
// ============================================================================

/** Feature #1256: AI Schedule Recommendation interfaces */
export interface AIScheduleRecommendation {
  id: string;
  type: 'heavy' | 'quick' | 'balanced' | 'resource_optimal';
  suiteName: string;
  suiteId: string;
  currentSchedule?: string;
  recommendedSchedule: string;
  recommendedTime: string;
  reasoning: string;
  metrics: {
    avgDuration: number;
    resourceUsage: 'high' | 'medium' | 'low';
    teamActivity: 'peak' | 'off-peak' | 'quiet';
  };
  impact: {
    ciTimeSaved: number;
    costReduction: number;
    failureReduction: number;
  };
}
