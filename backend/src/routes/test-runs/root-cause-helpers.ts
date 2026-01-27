/**
 * Root Cause Analysis Helpers Module
 * Extracted from test-runs.ts for code organization (Feature #1356)
 *
 * Contains helper functions for generating:
 * - Simulated related commits
 * - Commit details
 * - Root cause analysis with confidence scoring
 * - Evidence artifacts
 * - Console log and network request simulations
 * - Stack trace parsing
 * - Suggested remediation actions
 * - Historical pattern matching
 * - Cross-test failure correlation
 * - Human-readable explanations
 * - Technical explanations
 * - Executive summaries
 */

// ============================================
// Types and Interfaces
// ============================================

// Feature #1077: Related commits types
export interface RelatedCommit {
  sha: string;
  short_sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    avatar_url: string;
  };
  timestamp: string;
  files_changed: Array<{
    path: string;
    additions: number;
    deletions: number;
    status: 'added' | 'modified' | 'deleted';
  }>;
  likely_cause: boolean;
  relevance_score: number;
}

export interface CommitDetails {
  sha: string;
  short_sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    avatar_url: string;
  };
  committer: {
    name: string;
    email: string;
  };
  timestamp: string;
  parent_shas: string[];
  files: Array<{
    path: string;
    status: 'added' | 'modified' | 'deleted' | 'renamed';
    additions: number;
    deletions: number;
    patch?: string;
  }>;
  stats: {
    total_additions: number;
    total_deletions: number;
    files_changed: number;
  };
  url: string;
}

// Feature #1078: Root cause analysis types
export interface RootCause {
  id: string;
  category: string;
  title: string;
  description: string;
  confidence: number;
  evidence: Array<{
    type: 'error_pattern' | 'stack_trace' | 'historical' | 'code_change' | 'environment' | 'timing';
    description: string;
    strength: 'strong' | 'moderate' | 'weak';
    data?: string;
  }>;
  is_primary: boolean;
  fix_recommendations: string[];
  affected_components: string[];
}

export interface RootCauseAnalysisResult {
  primary_cause: RootCause;
  alternative_causes: RootCause[];
  overall_confidence: number;
  evidence_summary: {
    total_evidence_points: number;
    strong_evidence: number;
    moderate_evidence: number;
    weak_evidence: number;
  };
  ai_reasoning: string;
  requires_manual_review: boolean;
}

// Feature #1079: Evidence artifacts types
export interface EvidenceArtifacts {
  screenshot: {
    available: boolean;
    url?: string;
    timestamp?: string;
    description: string;
  };
  console_logs: {
    available: boolean;
    entries: Array<{
      level: 'error' | 'warning' | 'info' | 'log';
      message: string;
      timestamp: string;
      source?: string;
    }>;
    total_errors: number;
    total_warnings: number;
  };
  network_requests: {
    available: boolean;
    requests: Array<{
      method: string;
      url: string;
      status: number;
      status_text: string;
      duration_ms: number;
      failed: boolean;
      error?: string;
    }>;
    total_requests: number;
    failed_requests: number;
  };
  stack_trace: {
    available: boolean;
    frames: Array<{
      function_name: string;
      file: string;
      line: number;
      column: number;
    }>;
    raw_trace: string;
  };
  dom_snapshot: {
    available: boolean;
    selector_used?: string;
    element_found: boolean;
    element_visible?: boolean;
    element_html?: string;
  };
}

// Feature #1080: Suggested actions types
export interface SuggestedAction {
  id: string;
  category: 'code_fix' | 'test_update' | 'environment' | 'configuration' | 'retry';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  estimated_effort: 'quick' | 'moderate' | 'significant';
  auto_applicable: boolean;
  code_snippet?: {
    language: string;
    before?: string;
    after: string;
    file_path?: string;
  };
  steps: string[];
  impact: string;
  related_cause_id: string;
}

export interface SuggestedActions {
  actions: SuggestedAction[];
  quick_wins: SuggestedAction[];
  summary: {
    total_actions: number;
    auto_applicable: number;
    high_priority: number;
    estimated_time_savings: string;
  };
}

// Feature #1081: Historical pattern types
export interface HistoricalFailure {
  id: string;
  test_name: string;
  error_message: string;
  occurred_at: string;
  run_id: string;
  pattern_type: string;
  resolution?: {
    status: 'resolved' | 'unresolved' | 'auto_healed';
    method?: string;
    resolved_at?: string;
    resolved_by?: string;
    resolution_time_hours?: number;
    notes?: string;
  };
}

export interface HistoricalPatternMatch {
  pattern_type: string;
  pattern_name: string;
  description: string;
  similar_failures: HistoricalFailure[];
  total_occurrences: number;
  resolution_stats: {
    resolved: number;
    unresolved: number;
    auto_healed: number;
    success_rate: number;
    average_resolution_time_hours: number;
  };
  common_resolutions: Array<{
    method: string;
    count: number;
    success_rate: number;
  }>;
  first_seen: string;
  last_seen: string;
  trend: 'increasing' | 'decreasing' | 'stable';
}

// Feature #1082: Cross-test correlation types
export interface AffectedTest {
  test_id: string;
  test_name: string;
  suite_id?: string;
  suite_name?: string;
  project_id?: string;
  project_name?: string;
  failure_count: number;
  last_failure: string;
  error_sample: string;
}

export interface CrossTestCorrelation {
  cluster_id: string;
  cluster_name: string;
  pattern_type: string;
  common_root_cause: {
    type: string;
    description: string;
    confidence: number;
    affected_component: string;
  };
  unified_fix: {
    title: string;
    description: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    effort: 'quick' | 'moderate' | 'significant';
    estimated_time: string;
    steps: string[];
    code_example?: {
      language: string;
      before: string;
      after: string;
    };
    impact_statement: string;
  };
  impact_scope: {
    total_tests_affected: number;
    total_failures: number;
    affected_suites: string[];
    affected_projects: string[];
    first_seen: string;
    last_seen: string;
    trend: 'increasing' | 'decreasing' | 'stable';
  };
  affected_tests: AffectedTest[];
}

// Feature #1083: Human-readable explanation types
export interface HumanReadableExplanation {
  summary: string;
  what_happened: string;
  why_it_matters: string;
  key_points: Array<{
    icon: string;
    text: string;
    type: 'info' | 'warning' | 'error' | 'tip';
  }>;
  technical_details: {
    error_type: string;
    component: string;
    location: string;
  };
  suggested_action: string;
  confidence: number;
}

// Feature #1084: Technical explanation types
export interface StackFrame {
  function_name: string;
  file_path: string;
  line_number: number;
  column_number?: number;
  code_context?: string;
  is_application_code: boolean;
  analysis?: string;
}

export interface CodeChange {
  description: string;
  file_path: string;
  language: string;
  before: string;
  after: string;
  line_range: { start: number; end: number };
}

export interface TechnicalExplanation {
  summary: string;
  error_classification: {
    type: string;
    category: 'runtime' | 'network' | 'assertion' | 'timeout' | 'security' | 'infrastructure';
    severity: 'critical' | 'high' | 'medium' | 'low';
  };
  stack_trace_analysis: {
    frames: StackFrame[];
    root_cause_frame?: StackFrame;
    total_frames: number;
    application_frames: number;
    entry_point: string;
    failure_point: string;
  };
  code_level_explanation: {
    what_failed: string;
    why_it_failed: string;
    execution_flow: string[];
    affected_variables?: string[];
    related_components: string[];
  };
  suggested_fixes: CodeChange[];
  debugging_tips: Array<{
    step: number;
    title: string;
    command?: string;
    description: string;
  }>;
  related_documentation: Array<{
    title: string;
    url: string;
    relevance: string;
  }>;
  confidence: number;
}

// Feature #1085: Executive summary types
export interface AffectedFeature {
  name: string;
  description: string;
  criticality: 'critical' | 'high' | 'medium' | 'low';
  user_impact: string;
}

export interface ExecutiveSummary {
  headline: string;
  status_emoji: string;
  overall_status: 'critical' | 'warning' | 'attention_needed' | 'good';
  business_impact: {
    summary: string;
    severity: 'severe' | 'moderate' | 'minor';
    affected_users: string;
    revenue_risk: string;
    reputation_risk: string;
  };
  affected_features: AffectedFeature[];
  fix_effort: {
    estimated_time: string;
    team_resources: string;
    complexity: 'simple' | 'moderate' | 'complex';
    priority_recommendation: 'immediate' | 'high' | 'medium' | 'low';
  };
  risk_assessment: {
    current_risk_level: 'critical' | 'high' | 'medium' | 'low';
    trend: 'increasing' | 'stable' | 'decreasing';
    key_risks: string[];
    mitigation_steps: string[];
  };
  key_metrics: {
    total_failures: number;
    pass_rate: string;
    affected_tests: number;
    time_to_fix_estimate: string;
  };
  recommendations: Array<{
    priority: number;
    action: string;
    rationale: string;
  }>;
  next_steps: string[];
}

// ============================================
// Helper Functions
// ============================================

// Helper function to generate simulated related commits for Feature #1077
export function generateRelatedCommits(errorMessage: string, branch: string, now: Date): RelatedCommit[] {
  // Determine what type of error this is to generate relevant commits
  const isNetworkError = /network|fetch|ECONNREFUSED|DNS/i.test(errorMessage);
  const isElementError = /element|selector|locator|click|not found/i.test(errorMessage);
  const isDataError = /null|undefined|validation|data|parse/i.test(errorMessage);
  const isConfigError = /config|env|environment|permission/i.test(errorMessage);

  const commits: RelatedCommit[] = [];
  const authors = [
    { name: 'Alice Developer', email: 'alice@example.com', avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4' },
    { name: 'Bob Engineer', email: 'bob@example.com', avatar_url: 'https://avatars.githubusercontent.com/u/2?v=4' },
    { name: 'Carol QA', email: 'carol@example.com', avatar_url: 'https://avatars.githubusercontent.com/u/3?v=4' },
    { name: 'Dave DevOps', email: 'dave@example.com', avatar_url: 'https://avatars.githubusercontent.com/u/4?v=4' },
  ];

  // Generate commits based on error type
  if (isElementError) {
    commits.push({
      sha: 'abc123def456789012345678901234567890abcd',
      short_sha: 'abc123d',
      message: 'refactor: Update button component class names',
      author: authors[0],
      timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      files_changed: [
        { path: 'src/components/Button.tsx', additions: 15, deletions: 10, status: 'modified' as const },
        { path: 'src/styles/components.css', additions: 20, deletions: 5, status: 'modified' as const },
      ],
      likely_cause: true,
      relevance_score: 0.92,
    });
    commits.push({
      sha: 'def456abc789012345678901234567890defgh',
      short_sha: 'def456a',
      message: 'feat: Add new login form layout',
      author: authors[1],
      timestamp: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(),
      files_changed: [
        { path: 'src/pages/Login.tsx', additions: 45, deletions: 30, status: 'modified' as const },
        { path: 'src/components/FormInput.tsx', additions: 25, deletions: 0, status: 'added' as const },
      ],
      likely_cause: false,
      relevance_score: 0.75,
    });
  } else if (isNetworkError) {
    commits.push({
      sha: 'net789abc123456789012345678901234567890',
      short_sha: 'net789a',
      message: 'fix: Update API endpoint URLs for v2',
      author: authors[1],
      timestamp: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(),
      files_changed: [
        { path: 'src/api/client.ts', additions: 8, deletions: 8, status: 'modified' as const },
        { path: 'src/config/api.ts', additions: 3, deletions: 3, status: 'modified' as const },
      ],
      likely_cause: true,
      relevance_score: 0.88,
    });
    commits.push({
      sha: 'api456def789012345678901234567890abcde',
      short_sha: 'api456d',
      message: 'chore: Add request timeout configuration',
      author: authors[3],
      timestamp: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(),
      files_changed: [
        { path: 'src/api/config.ts', additions: 12, deletions: 2, status: 'modified' as const },
      ],
      likely_cause: false,
      relevance_score: 0.65,
    });
  } else if (isDataError) {
    commits.push({
      sha: 'data123xyz456789012345678901234567890ab',
      short_sha: 'data123',
      message: 'refactor: Change user data structure',
      author: authors[0],
      timestamp: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
      files_changed: [
        { path: 'src/types/user.ts', additions: 20, deletions: 15, status: 'modified' as const },
        { path: 'src/api/users.ts', additions: 35, deletions: 25, status: 'modified' as const },
        { path: 'src/utils/validation.ts', additions: 10, deletions: 5, status: 'modified' as const },
      ],
      likely_cause: true,
      relevance_score: 0.95,
    });
  } else if (isConfigError) {
    commits.push({
      sha: 'cfg789env123456789012345678901234567890',
      short_sha: 'cfg789e',
      message: 'chore: Update environment configuration',
      author: authors[3],
      timestamp: new Date(now.getTime() - 45 * 60 * 1000).toISOString(),
      files_changed: [
        { path: '.env.example', additions: 5, deletions: 2, status: 'modified' as const },
        { path: 'src/config/index.ts', additions: 15, deletions: 10, status: 'modified' as const },
        { path: 'docker-compose.yml', additions: 8, deletions: 3, status: 'modified' as const },
      ],
      likely_cause: true,
      relevance_score: 0.90,
    });
  }

  // Add some general commits that might be related
  commits.push({
    sha: 'gen001abc456789012345678901234567890xyz',
    short_sha: 'gen001a',
    message: 'test: Update test fixtures',
    author: authors[2],
    timestamp: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
    files_changed: [
      { path: 'tests/fixtures/users.json', additions: 10, deletions: 5, status: 'modified' as const },
    ],
    likely_cause: false,
    relevance_score: 0.40,
  });

  commits.push({
    sha: 'gen002def789012345678901234567890abcde',
    short_sha: 'gen002d',
    message: 'docs: Update README',
    author: authors[0],
    timestamp: new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString(),
    files_changed: [
      { path: 'README.md', additions: 25, deletions: 10, status: 'modified' as const },
    ],
    likely_cause: false,
    relevance_score: 0.10,
  });

  // Sort by relevance score (descending)
  return commits.sort((a, b) => b.relevance_score - a.relevance_score);
}

// Helper function to generate commit details for Feature #1077
export function generateCommitDetails(commitSha: string): CommitDetails | null {
  // Simulated commit details based on SHA prefix
  const commitDb: Record<string, CommitDetails> = {
    'abc123d': {
      sha: 'abc123def456789012345678901234567890abcd',
      short_sha: 'abc123d',
      message: 'refactor: Update button component class names\n\nChanged .btn-primary to .button-primary for consistency',
      author: { name: 'Alice Developer', email: 'alice@example.com', avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4' },
      committer: { name: 'Alice Developer', email: 'alice@example.com' },
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      parent_shas: ['parent123abc'],
      files: [
        {
          path: 'src/components/Button.tsx',
          status: 'modified',
          additions: 15,
          deletions: 10,
          patch: `@@ -10,7 +10,7 @@
 export const Button = ({ children, variant = 'primary' }) => {
   return (
-    <button className={\`btn-\${variant}\`}>
+    <button className={\`button-\${variant}\`}>
       {children}
     </button>
   );`,
        },
        {
          path: 'src/styles/components.css',
          status: 'modified',
          additions: 20,
          deletions: 5,
          patch: `@@ -1,5 +1,5 @@
-.btn-primary {
+.button-primary {
   background: #2563eb;
   color: white;
   padding: 8px 16px;`,
        },
      ],
      stats: { total_additions: 35, total_deletions: 15, files_changed: 2 },
      url: 'https://github.com/my-org/frontend-app/commit/abc123def456789012345678901234567890abcd',
    },
    'net789a': {
      sha: 'net789abc123456789012345678901234567890',
      short_sha: 'net789a',
      message: 'fix: Update API endpoint URLs for v2\n\nMigrate from /api/v1 to /api/v2 endpoints',
      author: { name: 'Bob Engineer', email: 'bob@example.com', avatar_url: 'https://avatars.githubusercontent.com/u/2?v=4' },
      committer: { name: 'Bob Engineer', email: 'bob@example.com' },
      timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      parent_shas: ['parent456def'],
      files: [
        {
          path: 'src/api/client.ts',
          status: 'modified',
          additions: 8,
          deletions: 8,
          patch: `@@ -5,7 +5,7 @@
 const apiClient = axios.create({
-  baseURL: '/api/v1',
+  baseURL: '/api/v2',
   timeout: 5000,
 });`,
        },
      ],
      stats: { total_additions: 8, total_deletions: 8, files_changed: 1 },
      url: 'https://github.com/my-org/frontend-app/commit/net789abc123456789012345678901234567890',
    },
    'data123': {
      sha: 'data123xyz456789012345678901234567890ab',
      short_sha: 'data123',
      message: 'refactor: Change user data structure\n\nRename user.fullName to user.name for API consistency',
      author: { name: 'Alice Developer', email: 'alice@example.com', avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4' },
      committer: { name: 'Alice Developer', email: 'alice@example.com' },
      timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      parent_shas: ['parent789ghi'],
      files: [
        {
          path: 'src/types/user.ts',
          status: 'modified',
          additions: 20,
          deletions: 15,
          patch: `@@ -1,7 +1,7 @@
 export interface User {
   id: string;
-  fullName: string;
+  name: string;
   email: string;
 }`,
        },
      ],
      stats: { total_additions: 20, total_deletions: 15, files_changed: 1 },
      url: 'https://github.com/my-org/frontend-app/commit/data123xyz456789012345678901234567890ab',
    },
    'cfg789e': {
      sha: 'cfg789env123456789012345678901234567890',
      short_sha: 'cfg789e',
      message: 'chore: Update environment configuration\n\nAdd new DATABASE_URL env var requirement',
      author: { name: 'Dave DevOps', email: 'dave@example.com', avatar_url: 'https://avatars.githubusercontent.com/u/4?v=4' },
      committer: { name: 'Dave DevOps', email: 'dave@example.com' },
      timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      parent_shas: ['parentabc123'],
      files: [
        {
          path: '.env.example',
          status: 'modified',
          additions: 5,
          deletions: 2,
          patch: `@@ -1,4 +1,7 @@
 PORT=3000
 NODE_ENV=development
+DATABASE_URL=postgres://localhost:5432/app
+REDIS_URL=redis://localhost:6379
+SECRET_KEY=your-secret-key`,
        },
      ],
      stats: { total_additions: 5, total_deletions: 2, files_changed: 1 },
      url: 'https://github.com/my-org/frontend-app/commit/cfg789env123456789012345678901234567890',
    },
  };

  // Try to find by short SHA first
  if (commitDb[commitSha]) {
    return commitDb[commitSha];
  }

  // Try to find by full SHA (check if any short SHA matches the start)
  for (const [shortSha, details] of Object.entries(commitDb)) {
    if (commitSha.startsWith(shortSha) || details.sha === commitSha) {
      return details;
    }
  }

  return null;
}

// Helper to parse stack trace from error message
export function parseStackTrace(errorMessage: string): { frames: Array<{ function_name: string; file: string; line: number; column: number }>; raw_trace: string } {
  const frames: Array<{ function_name: string; file: string; line: number; column: number }> = [];
  let rawTrace = '';

  // Try to extract stack trace from error message
  const stackMatch = errorMessage.match(/at\s+[\s\S]+/);
  if (stackMatch) {
    rawTrace = stackMatch[0];

    // Parse individual frames
    const frameRegex = /at\s+(?:(\S+)\s+)?\(?([^:]+):(\d+):(\d+)\)?/g;
    let match;
    while ((match = frameRegex.exec(rawTrace)) !== null) {
      frames.push({
        function_name: match[1] || '<anonymous>',
        file: match[2],
        line: parseInt(match[3], 10),
        column: parseInt(match[4], 10),
      });
    }
  }

  // If no real stack trace, generate a simulated one
  if (frames.length === 0) {
    rawTrace = `Error: ${errorMessage.substring(0, 100)}
    at TestRunner.execute (src/test-runner.ts:245:15)
    at async runTest (src/executor.ts:89:5)
    at async Page.click (node_modules/playwright/lib/page.js:1234:22)
    at async locator.click (node_modules/playwright/lib/locator.js:456:11)`;

    frames.push(
      { function_name: 'TestRunner.execute', file: 'src/test-runner.ts', line: 245, column: 15 },
      { function_name: 'runTest', file: 'src/executor.ts', line: 89, column: 5 },
      { function_name: 'Page.click', file: 'node_modules/playwright/lib/page.js', line: 1234, column: 22 },
      { function_name: 'locator.click', file: 'node_modules/playwright/lib/locator.js', line: 456, column: 11 },
    );
  }

  return { frames, raw_trace: rawTrace };
}

// Helper to extract selector from error message or test steps
export function extractSelector(
  errorMessage: string,
  steps?: Array<{ action?: string; selector?: string; error?: string }>
): string | undefined {
  // Try to find selector in error message
  const selectorPatterns = [
    /locator\(['"]([^'"]+)['"]\)/i,
    /selector\s*['"]([^'"]+)['"]/i,
    /getByRole\(['"]([^'"]+)['"]/i,
    /getByText\(['"]([^'"]+)['"]/i,
    /getByTestId\(['"]([^'"]+)['"]/i,
    /#[\w-]+/,
    /\.[\w-]+/,
    /\[data-testid=['"]([^'"]+)['"]\]/,
  ];

  for (const pattern of selectorPatterns) {
    const match = errorMessage.match(pattern);
    if (match) {
      return match[1] || match[0];
    }
  }

  // Try to find selector in failed steps
  if (steps) {
    const failedStep = steps.find(s => s.error);
    if (failedStep?.selector) {
      return failedStep.selector;
    }
  }

  return undefined;
}

// Helper to generate simulated console logs based on error type
export function generateSimulatedConsoleLogs(
  errorMessage: string,
  now: Date
): Array<{ level: 'error' | 'warning' | 'info' | 'log'; message: string; timestamp: string; source?: string }> {
  const logs: Array<{ level: 'error' | 'warning' | 'info' | 'log'; message: string; timestamp: string; source?: string }> = [];

  // Always add the error that caused the failure
  logs.push({
    level: 'error',
    message: errorMessage,
    timestamp: new Date(now.getTime() - 100).toISOString(),
    source: 'test',
  });

  // Add contextual logs based on error type
  if (/network|fetch|ECONNREFUSED|connection/i.test(errorMessage)) {
    logs.unshift({
      level: 'warning',
      message: 'Slow network detected, request taking longer than expected',
      timestamp: new Date(now.getTime() - 3000).toISOString(),
      source: 'network',
    });
    logs.unshift({
      level: 'info',
      message: 'Initiating API request to /api/v1/users',
      timestamp: new Date(now.getTime() - 3500).toISOString(),
      source: 'app',
    });
    logs.push({
      level: 'error',
      message: 'Failed to fetch: Network request failed',
      timestamp: new Date(now.getTime() - 50).toISOString(),
      source: 'network',
    });
  } else if (/timeout|timed out/i.test(errorMessage)) {
    logs.unshift({
      level: 'warning',
      message: 'Operation taking longer than expected',
      timestamp: new Date(now.getTime() - 5000).toISOString(),
      source: 'test',
    });
    logs.unshift({
      level: 'info',
      message: 'Waiting for element to be visible',
      timestamp: new Date(now.getTime() - 30000).toISOString(),
      source: 'playwright',
    });
  } else if (/element|selector|locator/i.test(errorMessage)) {
    logs.unshift({
      level: 'warning',
      message: 'Element selector may be incorrect or element not rendered',
      timestamp: new Date(now.getTime() - 500).toISOString(),
      source: 'test',
    });
    logs.unshift({
      level: 'info',
      message: 'Page loaded successfully',
      timestamp: new Date(now.getTime() - 2000).toISOString(),
      source: 'navigation',
    });
  } else if (/null|undefined|TypeError/i.test(errorMessage)) {
    logs.unshift({
      level: 'warning',
      message: 'Received unexpected data format from API',
      timestamp: new Date(now.getTime() - 200).toISOString(),
      source: 'api',
    });
    logs.push({
      level: 'error',
      message: 'Cannot read property of undefined',
      timestamp: new Date(now.getTime() - 50).toISOString(),
      source: 'app',
    });
  }

  // Add some general context logs
  logs.unshift({
    level: 'info',
    message: 'Test started: ' + now.toISOString(),
    timestamp: new Date(now.getTime() - 60000).toISOString(),
    source: 'test-runner',
  });

  return logs;
}

// Helper to generate simulated network requests
export function generateSimulatedNetworkRequests(
  errorMessage: string,
  now: Date
): Array<{ method: string; url: string; status: number; status_text: string; duration_ms: number; failed: boolean; error?: string }> {
  const requests = [];

  // Add initial page load request
  requests.push({
    method: 'GET',
    url: 'https://app.example.com/dashboard',
    status: 200,
    status_text: 'OK',
    duration_ms: 245,
    failed: false,
  });

  // Add static assets
  requests.push({
    method: 'GET',
    url: 'https://app.example.com/static/app.js',
    status: 200,
    status_text: 'OK',
    duration_ms: 89,
    failed: false,
  });

  // Add API calls based on error type
  if (/network|fetch|ECONNREFUSED|connection/i.test(errorMessage)) {
    requests.push({
      method: 'GET',
      url: 'https://api.example.com/v1/users',
      status: 0,
      status_text: 'Connection Refused',
      duration_ms: 5023,
      failed: true,
      error: 'net::ERR_CONNECTION_REFUSED',
    });
    requests.push({
      method: 'POST',
      url: 'https://api.example.com/v1/data',
      status: 0,
      status_text: 'Network Error',
      duration_ms: 30000,
      failed: true,
      error: 'Request timed out',
    });
  } else if (/timeout/i.test(errorMessage)) {
    requests.push({
      method: 'GET',
      url: 'https://api.example.com/v1/slow-endpoint',
      status: 0,
      status_text: 'Timeout',
      duration_ms: 30000,
      failed: true,
      error: 'Request exceeded timeout of 30000ms',
    });
  } else {
    // Normal successful API calls
    requests.push({
      method: 'GET',
      url: 'https://api.example.com/v1/config',
      status: 200,
      status_text: 'OK',
      duration_ms: 156,
      failed: false,
    });
    requests.push({
      method: 'GET',
      url: 'https://api.example.com/v1/users/me',
      status: 200,
      status_text: 'OK',
      duration_ms: 203,
      failed: false,
    });
  }

  return requests;
}
