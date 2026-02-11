/**
 * Test Runs Repository
 * Feature #2082: Migrate Test Runs module to PostgreSQL database
 * Feature #2110: Remove in-memory Map stores (DB-only migration)
 *
 * This module provides database persistence for test runs, selector overrides,
 * and healed selectors.
 *
 * NOTE: runningBrowsers stays in-memory as it contains runtime state (Browser instances)
 */

import { query, isDatabaseConnected } from '../database.js';
// Feature #439: Use structured logger instead of console.*
import { logger } from '../logger.js';
import type {
  TestRun,
  TestRunStatus,
  BrowserType,
  TestType,
  TriggerType,
  TestRunResult,
  SelectorOverride,
  HealedSelectorEntry,
} from '../../routes/test-runs/execution.js';

// In-memory fallback: import the testRuns Map from execution module
// This allows reads to work even when PostgreSQL is not connected
let _testRunsMap: Map<string, TestRun> | null = null;
async function getTestRunsMap(): Promise<Map<string, TestRun>> {
  if (!_testRunsMap) {
    try {
      // Dynamic import to avoid circular dependency at module load time
      const execution = await import('../../routes/test-runs/execution.js');
      _testRunsMap = execution.testRuns;
    } catch {
      _testRunsMap = new Map();
    }
  }
  return _testRunsMap!;
}

// ============================================================================
// Column Constants (Feature #100: Replace SELECT * with explicit columns)
// ============================================================================

/**
 * Explicit column list for test_runs table.
 * Using explicit columns reduces memory/bandwidth by ~20% compared to SELECT *.
 */
const TEST_RUN_COLUMNS = [
  'id', 'suite_id', 'suite_name', 'project_id', 'project_name', 'test_id',
  'schedule_id', 'organization_id', 'browser', 'branch', 'test_type', 'status',
  'started_at', 'completed_at', 'duration_ms', 'created_at', 'results',
  'error_message', 'accessibility_results', 'run_env_vars', 'priority',
  'triggered_by', 'user_id', 'pr_number'
].join(', ');

/**
 * Feature #197: Lightweight column list excluding heavy JSONB columns.
 * Excludes 'results' (up to 114 MB), 'accessibility_results', and 'run_env_vars'
 * to prevent 504 timeouts on listing endpoints that don't need full result data.
 * Use this for dashboard/listing queries; use TEST_RUN_COLUMNS for individual run detail views.
 *
 * Feature #203: Added denormalized count columns (results_count, passed_count, failed_count, skipped_count)
 * so listing endpoints can show pass/fail counts without loading full results JSONB.
 */
const TEST_RUN_COLUMNS_LIGHT = [
  'id', 'suite_id', 'suite_name', 'project_id', 'project_name', 'test_id',
  'schedule_id', 'organization_id', 'browser', 'branch', 'test_type', 'status',
  'started_at', 'completed_at', 'duration_ms', 'created_at',
  'error_message', 'priority', 'triggered_by', 'user_id', 'pr_number',
  'results_count', 'passed_count', 'failed_count', 'skipped_count'
].join(', ');

/**
 * Explicit column list for selector_overrides table.
 */
const SELECTOR_OVERRIDE_COLUMNS = [
  'test_id', 'step_id', 'original_selector', 'new_selector',
  'override_by', 'override_by_email', 'override_at', 'notes'
].join(', ');

/**
 * Explicit column list for healed_selector_history table.
 */
const HEALED_SELECTOR_COLUMNS = [
  'run_id', 'test_id', 'step_id', 'original_selector', 'healed_selector',
  'strategy', 'confidence', 'healed_at', 'approved', 'approved_by', 'approved_at'
].join(', ');

// ============================================================================
// Feature #458: Row interfaces to eliminate : any types
// ============================================================================

/** Database row type for test_runs table */
interface TestRunRow {
  id: string;
  suite_id: string;
  suite_name?: string;
  project_id?: string;
  project_name?: string;
  test_id?: string;
  schedule_id?: string;
  organization_id: string;
  browser: string;
  branch?: string;
  test_type?: string;
  status: string;
  started_at?: string | Date;
  completed_at?: string | Date;
  duration_ms?: number;
  created_at: string | Date;
  results?: TestRunResult[];
  error_message?: string;
  accessibility_results?: Record<string, unknown>;
  run_env_vars?: Record<string, string>;
  priority?: number;
  triggered_by?: string;
  user_id?: string;
  pr_number?: number;
  results_count?: number;
  passed_count?: number;
  failed_count?: number;
  skipped_count?: number;
}

/** Database row type for selector_overrides table */
interface SelectorOverrideRow {
  test_id: string;
  step_id: string;
  original_selector: string;
  new_selector: string;
  override_by: string;
  override_by_email: string;
  override_at: string;
  notes?: string;
}

/** Database row type for healed_selector_history table */
interface HealedSelectorRow {
  run_id: string;
  test_id: string;
  step_id: string;
  original_selector: string;
  healed_selector: string;
  strategy: string;
  healing_strategy?: string;
  confidence: number;
  healing_confidence?: number;
  healed_at: string;
  approved?: boolean;
  approved_by?: string;
  approved_at?: string;
  was_successful?: boolean;
  was_accepted?: boolean;
  accepted_by?: string;
  accepted_at?: string;
  was_rejected?: boolean;
  rejection_reason?: string;
  rejected_by?: string;
  rejected_at?: string;
  suggested_alternative?: string;
  suggested_selector?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert a database row to a TestRun object.
 * Gracefully handles missing heavy columns (results, accessibility_results, run_env_vars)
 * which may be absent when using TEST_RUN_COLUMNS_LIGHT for lightweight queries.
 */
function rowToTestRun(row: TestRunRow): TestRun {
  return {
    id: row.id,
    suite_id: row.suite_id,
    suite_name: row.suite_name,
    project_id: row.project_id,
    project_name: row.project_name,
    test_id: row.test_id,
    schedule_id: row.schedule_id,
    organization_id: row.organization_id,
    browser: row.browser as BrowserType,
    branch: row.branch || 'main',
    test_type: row.test_type as TestType,
    status: row.status as TestRunStatus,
    started_at: row.started_at ? new Date(row.started_at) : undefined,
    completed_at: row.completed_at ? new Date(row.completed_at) : undefined,
    duration_ms: row.duration_ms,
    created_at: new Date(row.created_at),
    // Feature #197: Handle missing heavy columns from lightweight queries.
    // 'results' defaults to undefined (not []) when column is absent, so callers
    // that check `run.results` with truthiness or optional chaining work correctly.
    results: 'results' in row ? (row.results || []) : undefined,
    error: row.error_message,
    accessibility_results: 'accessibility_results' in row ? row.accessibility_results : undefined,
    run_env_vars: 'run_env_vars' in row ? row.run_env_vars : undefined,
    priority: row.priority,
    triggered_by: row.triggered_by as TriggerType,
    user_id: row.user_id,
    pr_number: row.pr_number,
    // Feature #203: Denormalized count columns for fast listing queries
    results_count: row.results_count ?? 0,
    passed_count: row.passed_count ?? 0,
    failed_count: row.failed_count ?? 0,
    skipped_count: row.skipped_count ?? 0,
  };
}

/**
 * Convert a database row to a SelectorOverride object
 */
function rowToSelectorOverride(row: SelectorOverrideRow): SelectorOverride {
  return {
    test_id: row.test_id,
    step_id: row.step_id,
    original_selector: row.original_selector,
    new_selector: row.new_selector,
    override_by: row.override_by,
    override_by_email: row.override_by_email,
    override_at: row.override_at,
    notes: row.notes,
  };
}

/**
 * Convert a database row to a HealedSelectorEntry object
 */
function rowToHealedSelectorEntry(row: HealedSelectorRow): HealedSelectorEntry {
  return {
    run_id: row.run_id,
    test_id: row.test_id,
    step_id: row.step_id,
    original_selector: row.original_selector,
    healed_selector: row.healed_selector,
    strategy: row.strategy,
    healing_strategy: row.healing_strategy,
    confidence: row.confidence,
    healing_confidence: row.healing_confidence,
    healed_at: row.healed_at,
    was_successful: row.was_successful,
    was_accepted: row.was_accepted,
    accepted_by: row.accepted_by,
    accepted_at: row.accepted_at,
    was_rejected: row.was_rejected,
    rejection_reason: row.rejection_reason,
    rejected_by: row.rejected_by,
    rejected_at: row.rejected_at,
    suggested_alternative: row.suggested_alternative,
    suggested_selector: row.suggested_selector,
  };
}

// ============================================================================
// Test Runs CRUD Functions
// ============================================================================

/**
 * Create a new test run
 */
export async function createTestRun(run: TestRun): Promise<TestRun> {
  if (isDatabaseConnected()) {
    try {
      const result = await query<any>(
        `INSERT INTO test_runs (
          id, suite_id, suite_name, project_id, project_name, test_id, schedule_id,
          organization_id, browser, branch, test_type, status, started_at, completed_at,
          duration_ms, results, error_message, accessibility_results, run_env_vars,
          priority, triggered_by, user_id, pr_number, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
        ) RETURNING *`,
        [
          run.id,
          run.suite_id,
          run.suite_name,
          run.project_id,
          run.project_name,
          run.test_id,
          run.schedule_id,
          run.organization_id,
          run.browser,
          run.branch || 'main',
          run.test_type,
          run.status,
          run.started_at,
          run.completed_at,
          run.duration_ms,
          JSON.stringify(run.results || []),
          run.error,
          run.accessibility_results ? JSON.stringify(run.accessibility_results) : null,
          run.run_env_vars ? JSON.stringify(run.run_env_vars) : null,
          run.priority,
          run.triggered_by,
          run.user_id,
          run.pr_number,
          run.created_at,
        ]
      );
      if (result && result.rows[0]) {
        return rowToTestRun(result.rows[0]);
      }
    } catch (error) {
      logger.error({ error }, '[TestRunsRepo] Failed to create test run in database:');
    }
  }

  // Fallback: store in in-memory Map when DB unavailable
  const map = await getTestRunsMap();
  map.set(run.id, run);
  return run;
}

/**
 * Get a test run by ID
 */
export async function getTestRun(id: string): Promise<TestRun | undefined> {
  if (isDatabaseConnected()) {
    try {
      const result = await query<any>(
        `SELECT ${TEST_RUN_COLUMNS} FROM test_runs WHERE id = $1`,
        [id]
      );
      if (result && result.rows[0]) {
        return rowToTestRun(result.rows[0]);
      }
    } catch (error) {
      logger.error({ error }, '[TestRunsRepo] Failed to get test run from database:');
    }
  }

  // Fallback: read from in-memory Map when DB unavailable
  const map = await getTestRunsMap();
  return map.get(id);
}

/**
 * Update an existing test run
 */
export async function updateTestRun(id: string, updates: Partial<TestRun>): Promise<TestRun | undefined> {
  if (isDatabaseConnected()) {
    try {
      const setClauses: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      // Build dynamic SET clause
      const fieldMappings: Record<string, string> = {
        suite_id: 'suite_id',
        suite_name: 'suite_name',
        project_id: 'project_id',
        project_name: 'project_name',
        test_id: 'test_id',
        schedule_id: 'schedule_id',
        browser: 'browser',
        branch: 'branch',
        test_type: 'test_type',
        status: 'status',
        started_at: 'started_at',
        completed_at: 'completed_at',
        duration_ms: 'duration_ms',
        error: 'error_message',
        priority: 'priority',
        triggered_by: 'triggered_by',
        user_id: 'user_id',
        pr_number: 'pr_number',
      };

      for (const [key, dbField] of Object.entries(fieldMappings)) {
        if (key in updates) {
          setClauses.push(`${dbField} = $${paramIndex}`);
          values.push(updates[key as keyof TestRun]);
          paramIndex++;
        }
      }

      // Handle JSONB fields
      // Feature #203: Compute denormalized counts when results are provided
      if ('results' in updates) {
        setClauses.push(`results = $${paramIndex}`);
        values.push(JSON.stringify(updates.results || []));
        paramIndex++;

        // Compute and store count columns
        const results = updates.results || [];
        const resultsCount = results.length;
        const passedCount = results.filter((r: TestRunResult) => r.status === 'passed').length;
        const failedCount = results.filter((r: TestRunResult) => r.status === 'failed').length;
        const skippedCount = results.filter((r: TestRunResult) => r.status === 'skipped').length;

        setClauses.push(`results_count = $${paramIndex}`);
        values.push(resultsCount);
        paramIndex++;

        setClauses.push(`passed_count = $${paramIndex}`);
        values.push(passedCount);
        paramIndex++;

        setClauses.push(`failed_count = $${paramIndex}`);
        values.push(failedCount);
        paramIndex++;

        setClauses.push(`skipped_count = $${paramIndex}`);
        values.push(skippedCount);
        paramIndex++;
      }
      if ('accessibility_results' in updates) {
        setClauses.push(`accessibility_results = $${paramIndex}`);
        values.push(updates.accessibility_results ? JSON.stringify(updates.accessibility_results) : null);
        paramIndex++;
      }
      if ('run_env_vars' in updates) {
        setClauses.push(`run_env_vars = $${paramIndex}`);
        values.push(updates.run_env_vars ? JSON.stringify(updates.run_env_vars) : null);
        paramIndex++;
      }

      if (setClauses.length > 0) {
        values.push(id);
        const result = await query<any>(
          `UPDATE test_runs SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
          values
        );
        if (result && result.rows[0]) {
          return rowToTestRun(result.rows[0]);
        }
      }
    } catch (error) {
      logger.error({ error }, '[TestRunsRepo] Failed to update test run in database:');
    }
  }

  // Fallback: update in-memory Map when DB unavailable
  const map = await getTestRunsMap();
  const existing = map.get(id);
  if (existing) {
    const updated = { ...existing, ...updates };
    map.set(id, updated);
    return updated;
  }
  return undefined;
}

/**
 * Delete a test run
 */
export async function deleteTestRun(id: string): Promise<boolean> {
  if (isDatabaseConnected()) {
    try {
      const result = await query('DELETE FROM test_runs WHERE id = $1', [id]);
      return result !== null && result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      logger.error({ error }, '[TestRunsRepo] Failed to delete test run from database:');
    }
  }

  return false;
}

/**
 * List test runs for a suite
 */
export async function listTestRunsBySuite(suiteId: string, orgId?: string): Promise<TestRun[]> {
  if (isDatabaseConnected()) {
    try {
      // Feature #197: Use lightweight columns -- callers only need metadata and counts
      let queryText = `SELECT ${TEST_RUN_COLUMNS_LIGHT} FROM test_runs WHERE suite_id = $1`;
      const params: unknown[] = [suiteId];

      if (orgId) {
        queryText += ' AND organization_id = $2';
        params.push(orgId);
      }

      queryText += ' ORDER BY created_at DESC';

      const result = await query<any>(queryText, params);
      if (result && result.rows) {
        return result.rows.map(rowToTestRun);
      }
    } catch (error) {
      logger.error({ error }, '[TestRunsRepo] Failed to list test runs from database:');
    }
  }

  // Fallback: filter from in-memory Map when DB unavailable
  const map = await getTestRunsMap();
  const runs: TestRun[] = [];
  for (const run of map.values()) {
    if (run.suite_id === suiteId && (!orgId || run.organization_id === orgId)) {
      runs.push(run);
    }
  }
  return runs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

/**
 * List test runs for a project
 */
export async function listTestRunsByProject(projectId: string, orgId?: string): Promise<TestRun[]> {
  if (isDatabaseConnected()) {
    try {
      // Feature #197: Use lightweight columns -- callers only need metadata and counts
      let queryText = `SELECT ${TEST_RUN_COLUMNS_LIGHT} FROM test_runs WHERE project_id = $1`;
      const params: unknown[] = [projectId];

      if (orgId) {
        queryText += ' AND organization_id = $2';
        params.push(orgId);
      }

      queryText += ' ORDER BY created_at DESC';

      const result = await query<any>(queryText, params);
      if (result && result.rows) {
        return result.rows.map(rowToTestRun);
      }
    } catch (error) {
      logger.error({ error }, '[TestRunsRepo] Failed to list test runs from database:');
    }
  }

  // Fallback: filter from in-memory Map when DB unavailable
  const map = await getTestRunsMap();
  const runs: TestRun[] = [];
  for (const run of map.values()) {
    if (run.project_id === projectId && (!orgId || run.organization_id === orgId)) {
      runs.push(run);
    }
  }
  return runs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

/**
 * List all test runs for an organization
 * Feature #142: Added optional 'since' date filter to prevent loading years of historical data
 */
export interface ListTestRunsByOrgOptions {
  limit?: number;
  since?: Date;
  /**
   * Feature #198: When true, includes heavy JSONB columns (results, accessibility_results,
   * run_env_vars) in the query. Defaults to false for lightweight listing queries.
   * Only set to true when callers need to iterate over individual test results.
   * Prefer getFlakinessTrendData() for targeted single-test result extraction.
   */
  includeResults?: boolean;
}

export async function listTestRunsByOrg(
  orgId: string,
  optionsOrLimit?: number | ListTestRunsByOrgOptions
): Promise<TestRun[]> {
  // Handle both old signature (limit: number) and new signature (options object)
  const options: ListTestRunsByOrgOptions = typeof optionsOrLimit === 'number'
    ? { limit: optionsOrLimit }
    : optionsOrLimit || {};

  if (isDatabaseConnected()) {
    try {
      // Feature #198: Use lightweight columns by default to avoid loading massive JSONB data
      // (up to 114 MB/row). Callers that need full results can pass includeResults: true,
      // or use getFlakinessTrendData() for targeted single-test extraction.
      const columns = options.includeResults ? TEST_RUN_COLUMNS : TEST_RUN_COLUMNS_LIGHT;
      let queryText = `SELECT ${columns} FROM test_runs WHERE organization_id = $1`;
      const params: unknown[] = [orgId];
      let paramIndex = 2;

      // Feature #142: Add date filter to prevent loading years of data
      if (options.since) {
        queryText += ` AND created_at >= $${paramIndex}`;
        params.push(options.since);
        paramIndex++;
      }

      queryText += ' ORDER BY created_at DESC';

      if (options.limit) {
        queryText += ` LIMIT $${paramIndex}`;
        params.push(options.limit);
      }

      const result = await query<any>(queryText, params);
      if (result && result.rows) {
        return result.rows.map(rowToTestRun);
      }
    } catch (error) {
      logger.error({ error }, '[TestRunsRepo] Failed to list test runs from database:');
    }
  }

  // Fallback: filter from in-memory Map when DB unavailable
  const map = await getTestRunsMap();
  let runs: TestRun[] = [];
  for (const run of map.values()) {
    if (run.organization_id !== orgId) continue;
    // Feature #142: Apply date filter in memory fallback
    if (options.since && new Date(run.created_at) < options.since) continue;
    runs.push(run);
  }
  runs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  if (options.limit) runs = runs.slice(0, options.limit);
  return runs;
}

/**
 * Feature #141: List test runs for a specific schedule
 * Queries directly by schedule_id instead of loading all org runs and filtering
 */
export async function listTestRunsBySchedule(scheduleId: string, orgId: string, limit: number = 50): Promise<TestRun[]> {
  if (isDatabaseConnected()) {
    try {
      // Feature #203: Use TEST_RUN_COLUMNS_LIGHT to avoid loading heavy results JSONB
      const result = await query<any>(
        `SELECT ${TEST_RUN_COLUMNS_LIGHT} FROM test_runs
         WHERE schedule_id = $1 AND organization_id = $2
         ORDER BY created_at DESC
         LIMIT $3`,
        [scheduleId, orgId, limit]
      );
      if (result && result.rows) {
        return result.rows.map(rowToTestRun);
      }
    } catch (error) {
      logger.error({ error }, '[TestRunsRepo] Failed to list test runs by schedule from database:');
    }
  }

  // Fallback: filter from in-memory Map when DB unavailable
  const map = await getTestRunsMap();
  const runs: TestRun[] = [];
  for (const run of map.values()) {
    if (run.schedule_id === scheduleId && run.organization_id === orgId) {
      runs.push(run);
    }
  }
  runs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return runs.slice(0, limit);
}

/**
 * Feature #135: List test runs for a specific test
 * Queries directly by test_id instead of loading all org runs
 * Also handles batch/suite runs that include this test in their results
 */
export async function listTestRunsByTestId(testId: string, orgId: string, limit: number = 20): Promise<TestRun[]> {
  if (isDatabaseConnected()) {
    try {
      // Feature #199: Extract only the matching test's result from JSONB instead of
      // loading the entire results array (which can be 20-114 MB for suite runs).
      // For direct test runs (test_id matches), return full results (small, single test).
      // For suite runs, use jsonb_array_elements to extract only the matching entry.
      // Fix: Explicit type casts needed because $2 is used in both UUID context
      // (test_id = $2::uuid) and text context (elem->>'test_id' = $2::text).
      // Without casts, PostgreSQL infers $2 as uuid and fails on text comparison
      // with error 42883: "No operator matches the given name and argument types."
      const result = await query<any>(
        `SELECT id, suite_id, suite_name, project_id, project_name, test_id,
          schedule_id, organization_id, browser, branch, test_type, status,
          started_at, completed_at, duration_ms, created_at,
          error_message, priority, triggered_by, user_id, pr_number,
          CASE
            WHEN test_id = $2::uuid THEN results
            ELSE (
              SELECT jsonb_agg(elem)
              FROM jsonb_array_elements(COALESCE(results, '[]'::jsonb)) elem
              WHERE elem->>'test_id' = $2::text
            )
          END as results
        FROM test_runs
        WHERE organization_id = $1::uuid
        AND (
          test_id = $2::uuid
          OR (test_id IS NULL AND results @> $3::jsonb)
        )
        ORDER BY created_at DESC
        LIMIT $4`,
        [orgId, testId, JSON.stringify([{ test_id: testId }]), limit]
      );
      if (result && result.rows) {
        return result.rows.map(rowToTestRun);
      }
    } catch (error) {
      logger.error({ error }, '[TestRunsRepo] Failed to list test runs by test ID from database:');
    }
  }

  // Fallback: filter from in-memory Map when DB unavailable
  const map = await getTestRunsMap();
  const runs: TestRun[] = [];
  for (const run of map.values()) {
    if (run.organization_id !== orgId) continue;
    // Direct single-test run
    if (run.test_id === testId) {
      runs.push(run);
      continue;
    }
    // Suite/batch run that includes this test in results
    if (run.results && run.results.some(result => result.test_id === testId)) {
      runs.push(run);
    }
  }
  runs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return runs.slice(0, limit);
}

/**
 * Get recent test runs with pagination
 * Feature #124: Use window function COUNT(*) OVER() for single query instead of separate COUNT + SELECT
 */
export async function getRecentTestRuns(
  orgId: string,
  options: { limit?: number; offset?: number; status?: TestRunStatus }
): Promise<{ runs: TestRun[]; total: number }> {
  const limit = options.limit || 50;
  const offset = options.offset || 0;

  if (isDatabaseConnected()) {
    try {
      // Feature #124: Single query with window function instead of separate COUNT + SELECT
      let whereClause = 'organization_id = $1';
      const params: unknown[] = [orgId];

      if (options.status) {
        whereClause += ' AND status = $2';
        params.push(options.status);
      }

      // Use COUNT(*) OVER() window function to get total in same query as data
      // Feature #203: Use TEST_RUN_COLUMNS_LIGHT to avoid loading heavy results JSONB
      const combinedQuery = `
        SELECT ${TEST_RUN_COLUMNS_LIGHT}, COUNT(*) OVER() as total_count
        FROM test_runs
        WHERE ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;

      const result = await query<any>(combinedQuery, [...params, limit, offset]);
      const runs = result?.rows ? result.rows.map(rowToTestRun) : [];
      const total = result?.rows[0]?.total_count ? parseInt(result.rows[0].total_count, 10) : 0;

      return { runs, total };
    } catch (error) {
      logger.error({ error }, '[TestRunsRepo] Failed to get recent test runs from database:');
    }
  }

  // Fallback: filter from in-memory Map when DB unavailable
  const map = await getTestRunsMap();
  let runs: TestRun[] = [];
  for (const run of map.values()) {
    if (run.organization_id === orgId) {
      if (!options.status || run.status === options.status) {
        runs.push(run);
      }
    }
  }
  runs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const total = runs.length;
  runs = runs.slice(offset, offset + limit);
  return { runs, total };
}

/**
 * Feature #53: List test runs with full pagination and filters
 * Returns paginated response with full metadata
 */
export interface ListTestRunsOptions {
  page?: number;
  limit?: number;
  offset?: number;
  status?: TestRunStatus;
  suite_id?: string;
  project_id?: string;
}

export interface PaginatedTestRunsResult {
  data: TestRun[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Feature #124: Use window function COUNT(*) OVER() for single query instead of separate COUNT + SELECT
 */
export async function listTestRunsPaginated(
  orgId: string,
  options: ListTestRunsOptions = {}
): Promise<PaginatedTestRunsResult> {
  const limit = Math.min(options.limit || 50, 100); // Max 100 per page
  const page = options.page || 1;
  const offset = options.offset !== undefined ? options.offset : (page - 1) * limit;

  if (isDatabaseConnected()) {
    try {
      // Build WHERE clause
      let whereClause = 'WHERE organization_id = $1';
      const params: unknown[] = [orgId];
      let paramIndex = 2;

      if (options.status) {
        whereClause += ` AND status = $${paramIndex}`;
        params.push(options.status);
        paramIndex++;
      }

      if (options.suite_id) {
        whereClause += ` AND suite_id = $${paramIndex}`;
        params.push(options.suite_id);
        paramIndex++;
      }

      if (options.project_id) {
        whereClause += ` AND project_id = $${paramIndex}`;
        params.push(options.project_id);
        paramIndex++;
      }

      // Feature #124: Single query with window function instead of separate COUNT + SELECT
      // Feature #203: Use TEST_RUN_COLUMNS_LIGHT to avoid loading heavy results JSONB
      const combinedQuery = `
        SELECT ${TEST_RUN_COLUMNS_LIGHT}, COUNT(*) OVER() as total_count
        FROM test_runs
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      const result = await query<any>(combinedQuery, [...params, limit, offset]);
      const runs = result?.rows ? result.rows.map(rowToTestRun) : [];
      const total = result?.rows[0]?.total_count ? parseInt(result.rows[0].total_count, 10) : 0;

      const totalPages = Math.ceil(total / limit);
      return {
        data: runs,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      logger.error({ error }, '[TestRunsRepo] Failed to list test runs paginated from database:');
    }
  }

  // Fallback: filter from in-memory Map when DB unavailable
  const map = await getTestRunsMap();
  let runs: TestRun[] = [];
  for (const run of map.values()) {
    if (run.organization_id !== orgId) continue;
    if (options.status && run.status !== options.status) continue;
    if (options.suite_id && run.suite_id !== options.suite_id) continue;
    if (options.project_id && run.project_id !== options.project_id) continue;
    runs.push(run);
  }
  runs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const total = runs.length;
  runs = runs.slice(offset, offset + limit);

  const totalPages = Math.ceil(total / limit);
  return {
    data: runs,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

// ============================================================================
// Selector Overrides CRUD Functions
// ============================================================================

/**
 * Create or update a selector override
 */
export async function upsertSelectorOverride(override: SelectorOverride): Promise<SelectorOverride> {
  if (isDatabaseConnected()) {
    try {
      const result = await query<any>(
        `INSERT INTO selector_overrides (
          test_id, step_id, original_selector, new_selector, override_by, override_by_email, override_at, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (test_id, step_id) DO UPDATE SET
          original_selector = $3, new_selector = $4, override_by = $5, override_by_email = $6, override_at = $7, notes = $8
        RETURNING *`,
        [
          override.test_id,
          override.step_id,
          override.original_selector,
          override.new_selector,
          override.override_by,
          override.override_by_email,
          override.override_at,
          override.notes,
        ]
      );
      if (result && result.rows[0]) {
        return rowToSelectorOverride(result.rows[0]);
      }
    } catch (error) {
      logger.error({ error }, '[TestRunsRepo] Failed to upsert selector override in database:');
    }
  }

  // DB-only: return override as-is if DB unavailable
  return override;
}

/**
 * Get a selector override by test and step ID
 */
export async function getSelectorOverride(testId: string, stepId: string): Promise<SelectorOverride | undefined> {
  if (isDatabaseConnected()) {
    try {
      const result = await query<any>(
        `SELECT ${SELECTOR_OVERRIDE_COLUMNS} FROM selector_overrides WHERE test_id = $1 AND step_id = $2`,
        [testId, stepId]
      );
      if (result && result.rows[0]) {
        return rowToSelectorOverride(result.rows[0]);
      }
    } catch (error) {
      logger.error({ error }, '[TestRunsRepo] Failed to get selector override from database:');
    }
  }

  // DB-only: return undefined when DB unavailable
  return undefined;
}

/**
 * Delete a selector override
 */
export async function deleteSelectorOverride(testId: string, stepId: string): Promise<boolean> {
  if (isDatabaseConnected()) {
    try {
      const result = await query(
        'DELETE FROM selector_overrides WHERE test_id = $1 AND step_id = $2',
        [testId, stepId]
      );
      return result !== null && result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      logger.error({ error }, '[TestRunsRepo] Failed to delete selector override from database:');
    }
  }

  return false;
}

/**
 * List all selector overrides for a test
 */
export async function listSelectorOverrides(testId: string): Promise<SelectorOverride[]> {
  if (isDatabaseConnected()) {
    try {
      const result = await query<any>(
        `SELECT ${SELECTOR_OVERRIDE_COLUMNS} FROM selector_overrides WHERE test_id = $1`,
        [testId]
      );
      if (result && result.rows) {
        return result.rows.map(rowToSelectorOverride);
      }
    } catch (error) {
      logger.error({ error }, '[TestRunsRepo] Failed to list selector overrides from database:');
    }
  }

  // DB-only: return empty when DB unavailable
  return [];
}

// ============================================================================
// Healed Selector History CRUD Functions
// ============================================================================

/**
 * Create or update a healed selector entry
 */
export async function upsertHealedSelectorEntry(entry: HealedSelectorEntry): Promise<HealedSelectorEntry> {
  if (isDatabaseConnected()) {
    try {
      const result = await query<any>(
        `INSERT INTO healed_selector_history (
          run_id, test_id, step_id, original_selector, healed_selector, strategy, healing_strategy,
          confidence, healing_confidence, healed_at, was_successful, was_accepted, accepted_by,
          accepted_at, was_rejected, rejection_reason, rejected_by, rejected_at, suggested_alternative, suggested_selector
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        ON CONFLICT (test_id, step_id) DO UPDATE SET
          run_id = $1, original_selector = $4, healed_selector = $5, strategy = $6, healing_strategy = $7,
          confidence = $8, healing_confidence = $9, healed_at = $10, was_successful = $11, was_accepted = $12,
          accepted_by = $13, accepted_at = $14, was_rejected = $15, rejection_reason = $16, rejected_by = $17,
          rejected_at = $18, suggested_alternative = $19, suggested_selector = $20
        RETURNING *`,
        [
          entry.run_id,
          entry.test_id,
          entry.step_id,
          entry.original_selector,
          entry.healed_selector,
          entry.strategy,
          entry.healing_strategy,
          entry.confidence,
          entry.healing_confidence,
          entry.healed_at,
          entry.was_successful,
          entry.was_accepted,
          entry.accepted_by,
          entry.accepted_at,
          entry.was_rejected,
          entry.rejection_reason,
          entry.rejected_by,
          entry.rejected_at,
          entry.suggested_alternative,
          entry.suggested_selector,
        ]
      );
      if (result && result.rows[0]) {
        return rowToHealedSelectorEntry(result.rows[0]);
      }
    } catch (error) {
      logger.error({ error }, '[TestRunsRepo] Failed to upsert healed selector entry in database:');
    }
  }

  // DB-only: return entry as-is if DB unavailable
  return entry;
}

/**
 * Get a healed selector entry by test and step ID
 */
export async function getHealedSelectorEntry(testId: string, stepId: string): Promise<HealedSelectorEntry | undefined> {
  if (isDatabaseConnected()) {
    try {
      const result = await query<any>(
        `SELECT ${HEALED_SELECTOR_COLUMNS} FROM healed_selector_history WHERE test_id = $1 AND step_id = $2`,
        [testId, stepId]
      );
      if (result && result.rows[0]) {
        return rowToHealedSelectorEntry(result.rows[0]);
      }
    } catch (error) {
      logger.error({ error }, '[TestRunsRepo] Failed to get healed selector entry from database:');
    }
  }

  // DB-only: return undefined when DB unavailable
  return undefined;
}

/**
 * List all healed selector entries for a test
 */
export async function listHealedSelectorHistory(testId: string): Promise<HealedSelectorEntry[]> {
  if (isDatabaseConnected()) {
    try {
      const result = await query<any>(
        `SELECT ${HEALED_SELECTOR_COLUMNS} FROM healed_selector_history WHERE test_id = $1 ORDER BY healed_at DESC`,
        [testId]
      );
      if (result && result.rows) {
        return result.rows.map(rowToHealedSelectorEntry);
      }
    } catch (error) {
      logger.error({ error }, '[TestRunsRepo] Failed to list healed selector history from database:');
    }
  }

  // DB-only: return empty when DB unavailable
  return [];
}

// Memory store accessors removed in Feature #2121
// All data access is now through async DB functions above

// ============================================================================
// Feature #197: Flakiness Trend Data (targeted JSONB extraction)
// ============================================================================

/**
 * Row shape returned by the flakiness-trend SQL query.
 * Each row represents one test result entry extracted from a run's JSONB results.
 */
export interface FlakinessTrendRow {
  run_id: string;
  created_at: Date;
  completed_at: Date | null;
  result_test_id: string;
  result_status: string;
  result_duration_ms: number | null;
}

/** Database row type for flakiness trend query (before conversion to FlakinessTrendRow) */
interface FlakinessTrendDBRow {
  run_id: string;
  created_at: string | Date;
  completed_at: string | Date | null;
  result_test_id: string;
  result_status: string;
  result_duration_ms: number | null;
}

/**
 * Feature #197: Get flakiness trend data for a specific test without loading
 * the entire results JSONB column. Uses jsonb_array_elements to extract only
 * the matching test's status and duration directly in SQL, avoiding transfer
 * of up to 114 MB per row over the wire.
 *
 * Returns flat rows (one per run that contains the test) instead of full TestRun objects.
 */
export async function getFlakinessTrendData(
  orgId: string,
  testId: string,
  since: Date,
  limit: number = 1000
): Promise<FlakinessTrendRow[]> {
  if (isDatabaseConnected()) {
    try {
      const result = await query<any>(
        `SELECT
          tr.id as run_id,
          tr.created_at,
          tr.completed_at,
          elem->>'test_id' as result_test_id,
          elem->>'status' as result_status,
          (elem->>'duration_ms')::int as result_duration_ms
        FROM test_runs tr,
          jsonb_array_elements(COALESCE(tr.results, '[]'::jsonb)) elem
        WHERE tr.organization_id = $1
          AND tr.created_at >= $2
          AND elem->>'test_id' = $3
        ORDER BY tr.created_at DESC
        LIMIT $4`,
        [orgId, since, testId, limit]
      );
      if (result && result.rows) {
        return result.rows.map((row: FlakinessTrendDBRow) => ({
          run_id: row.run_id,
          created_at: new Date(row.created_at),
          completed_at: row.completed_at ? new Date(row.completed_at) : null,
          result_test_id: row.result_test_id,
          result_status: row.result_status,
          result_duration_ms: row.result_duration_ms,
        }));
      }
    } catch (error) {
      logger.error({ error }, '[TestRunsRepo] Failed to get flakiness trend data from database:');
    }
  }

  // Fallback: scan in-memory map (less efficient but preserves functionality when DB unavailable)
  const map = await getTestRunsMap();
  const rows: FlakinessTrendRow[] = [];
  for (const run of map.values()) {
    if (run.organization_id !== orgId) continue;
    if (new Date(run.created_at) < since) continue;
    if (!run.results) continue;

    for (const result of run.results) {
      if (result.test_id !== testId) continue;
      rows.push({
        run_id: run.id,
        created_at: new Date(run.created_at),
        completed_at: run.completed_at ? new Date(run.completed_at) : null,
        result_test_id: result.test_id,
        result_status: result.status,
        result_duration_ms: result.duration_ms ?? null,
      });
    }
  }
  rows.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
  return rows.slice(0, limit);
}

// ============================================================================
// Feature #87: Optimized Test Run Metadata Functions
// ============================================================================

/**
 * Interface for aggregated test run metadata (used by suite tests endpoint)
 */
export interface TestRunMetadata {
  test_id: string;
  run_count: number;
  last_run_at: Date | null;
  last_result: TestRunStatus | null;
  avg_duration_ms: number | null;
}

/**
 * Feature #87: Get aggregated run metadata for tests in a suite
 * This replaces loading ALL runs into memory with a single efficient SQL query
 * that computes: run_count, last_run_at, last_result, avg_duration per test
 */
export async function getTestRunMetadataForSuite(
  suiteId: string,
  testIds: string[],
  orgId?: string
): Promise<Map<string, TestRunMetadata>> {
  const metadataMap = new Map<string, TestRunMetadata>();

  // Initialize empty metadata for all tests
  for (const testId of testIds) {
    metadataMap.set(testId, {
      test_id: testId,
      run_count: 0,
      last_run_at: null,
      last_result: null,
      avg_duration_ms: null,
    });
  }

  if (testIds.length === 0) {
    return metadataMap;
  }

  if (isDatabaseConnected()) {
    try {
      // Single aggregated query that computes all metadata at database level
      // Uses window functions and aggregations to avoid loading all runs into memory
      let queryText = `
        WITH run_stats AS (
          SELECT
            test_id,
            COUNT(*) as run_count,
            MAX(COALESCE(completed_at, started_at, created_at)) as last_run_at,
            AVG(CASE WHEN duration_ms > 0 THEN duration_ms END) as avg_duration_ms
          FROM test_runs
          WHERE suite_id = $1 AND test_id = ANY($2)
      `;
      const params: unknown[] = [suiteId, testIds];
      let paramIndex = 3;

      if (orgId) {
        queryText += ` AND organization_id = $${paramIndex}`;
        params.push(orgId);
        paramIndex++;
      }

      queryText += `
          GROUP BY test_id
        ),
        latest_runs AS (
          SELECT DISTINCT ON (test_id)
            test_id,
            status as last_result
          FROM test_runs
          WHERE suite_id = $1 AND test_id = ANY($2)
      `;

      if (orgId) {
        queryText += ` AND organization_id = $${paramIndex - 1}`;
      }

      queryText += `
          ORDER BY test_id, created_at DESC
        )
        SELECT
          rs.test_id,
          rs.run_count,
          rs.last_run_at,
          lr.last_result,
          rs.avg_duration_ms
        FROM run_stats rs
        LEFT JOIN latest_runs lr ON rs.test_id = lr.test_id
      `;

      const result = await query<any>(queryText, params);

      if (result && result.rows) {
        for (const row of result.rows) {
          metadataMap.set(row.test_id, {
            test_id: row.test_id,
            run_count: parseInt(row.run_count, 10) || 0,
            last_run_at: row.last_run_at ? new Date(row.last_run_at) : null,
            last_result: row.last_result as TestRunStatus | null,
            avg_duration_ms: row.avg_duration_ms ? Math.round(parseFloat(row.avg_duration_ms)) : null,
          });
        }
      }
    } catch (error) {
      logger.error({ error }, '[TestRunsRepo] Failed to get test run metadata from database:');
      // Fall through to fallback
    }
  }

  // Fallback: compute from in-memory map (less efficient but still works)
  // Only used when DB is unavailable
  if (!isDatabaseConnected()) {
    const map = await getTestRunsMap();
    const testRunsByTest = new Map<string, TestRun[]>();

    // Group runs by test_id
    for (const run of map.values()) {
      if (run.suite_id !== suiteId) continue;
      if (orgId && run.organization_id !== orgId) continue;
      if (!testIds.includes(run.test_id || '')) continue;

      const testId = run.test_id || '';
      if (!testRunsByTest.has(testId)) {
        testRunsByTest.set(testId, []);
      }
      testRunsByTest.get(testId)!.push(run);
    }

    // Compute metadata for each test
    for (const [testId, runs] of testRunsByTest) {
      runs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const lastRun = runs[0];
      const completedRuns = runs.filter(r => r.duration_ms && r.duration_ms > 0);
      const avgDuration = completedRuns.length > 0
        ? Math.round(completedRuns.reduce((sum, r) => sum + (r.duration_ms || 0), 0) / completedRuns.length)
        : null;

      metadataMap.set(testId, {
        test_id: testId,
        run_count: runs.length,
        last_run_at: lastRun?.completed_at || lastRun?.started_at || null,
        last_result: lastRun?.status || null,
        avg_duration_ms: avgDuration,
      });
    }
  }

  return metadataMap;
}
