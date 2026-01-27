/**
 * Test Runs Repository
 * Feature #2082: Migrate Test Runs module to PostgreSQL database
 *
 * This module provides database persistence for test runs, selector overrides,
 * and healed selectors with fallback to in-memory storage.
 *
 * NOTE: runningBrowsers stays in-memory as it contains runtime state (Browser instances)
 */

import { query, isDatabaseConnected } from '../database';
import type {
  TestRun,
  TestRunStatus,
  BrowserType,
  TestType,
  TriggerType,
  TestRunResult,
  SelectorOverride,
  HealedSelectorEntry,
} from '../../routes/test-runs/execution';

// ============================================================================
// In-Memory Fallback Stores
// ============================================================================

const memoryTestRuns: Map<string, TestRun> = new Map();
const memorySelectorOverrides: Map<string, SelectorOverride> = new Map();
const memoryHealedSelectorHistory: Map<string, HealedSelectorEntry> = new Map();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert a database row to a TestRun object
 */
function rowToTestRun(row: any): TestRun {
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
    results: row.results || [],
    error: row.error_message,
    accessibility_results: row.accessibility_results,
    run_env_vars: row.run_env_vars,
    priority: row.priority,
    triggered_by: row.triggered_by as TriggerType,
    user_id: row.user_id,
    pr_number: row.pr_number,
  };
}

/**
 * Convert a database row to a SelectorOverride object
 */
function rowToSelectorOverride(row: any): SelectorOverride {
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
function rowToHealedSelectorEntry(row: any): HealedSelectorEntry {
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
        // Also store in memory for fast access during execution
        memoryTestRuns.set(run.id, run);
        return rowToTestRun(result.rows[0]);
      }
    } catch (error) {
      console.error('[TestRunsRepo] Failed to create test run in database:', error);
    }
  }

  // Fallback to memory
  memoryTestRuns.set(run.id, run);
  return run;
}

/**
 * Get a test run by ID
 */
export async function getTestRun(id: string): Promise<TestRun | undefined> {
  // First check memory for running tests (they need fast access)
  const memoryRun = memoryTestRuns.get(id);
  if (memoryRun && (memoryRun.status === 'running' || memoryRun.status === 'pending')) {
    return memoryRun;
  }

  if (isDatabaseConnected()) {
    try {
      const result = await query<any>(
        'SELECT * FROM test_runs WHERE id = $1',
        [id]
      );
      if (result && result.rows[0]) {
        return rowToTestRun(result.rows[0]);
      }
    } catch (error) {
      console.error('[TestRunsRepo] Failed to get test run from database:', error);
    }
  }

  // Fallback to memory
  return memoryTestRuns.get(id);
}

/**
 * Update an existing test run
 */
export async function updateTestRun(id: string, updates: Partial<TestRun>): Promise<TestRun | undefined> {
  // Always update memory first for fast access during execution
  const existing = memoryTestRuns.get(id);
  if (existing) {
    const updated = { ...existing, ...updates };
    memoryTestRuns.set(id, updated);
  }

  if (isDatabaseConnected()) {
    try {
      const setClauses: string[] = [];
      const values: any[] = [];
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
          values.push((updates as any)[key]);
          paramIndex++;
        }
      }

      // Handle JSONB fields
      if ('results' in updates) {
        setClauses.push(`results = $${paramIndex}`);
        values.push(JSON.stringify(updates.results || []));
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
          const updated = rowToTestRun(result.rows[0]);
          memoryTestRuns.set(id, updated);
          return updated;
        }
      }
    } catch (error) {
      console.error('[TestRunsRepo] Failed to update test run in database:', error);
    }
  }

  // Return from memory
  return memoryTestRuns.get(id);
}

/**
 * Delete a test run
 */
export async function deleteTestRun(id: string): Promise<boolean> {
  memoryTestRuns.delete(id);

  if (isDatabaseConnected()) {
    try {
      const result = await query('DELETE FROM test_runs WHERE id = $1', [id]);
      return result !== null && result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      console.error('[TestRunsRepo] Failed to delete test run from database:', error);
    }
  }

  return true;
}

/**
 * List test runs for a suite
 */
export async function listTestRunsBySuite(suiteId: string, orgId?: string): Promise<TestRun[]> {
  if (isDatabaseConnected()) {
    try {
      let queryText = 'SELECT * FROM test_runs WHERE suite_id = $1';
      const params: any[] = [suiteId];

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
      console.error('[TestRunsRepo] Failed to list test runs from database:', error);
    }
  }

  // Fallback to memory
  return Array.from(memoryTestRuns.values())
    .filter(r => r.suite_id === suiteId && (!orgId || r.organization_id === orgId))
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
}

/**
 * List test runs for a project
 */
export async function listTestRunsByProject(projectId: string, orgId?: string): Promise<TestRun[]> {
  if (isDatabaseConnected()) {
    try {
      let queryText = 'SELECT * FROM test_runs WHERE project_id = $1';
      const params: any[] = [projectId];

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
      console.error('[TestRunsRepo] Failed to list test runs from database:', error);
    }
  }

  // Fallback to memory
  return Array.from(memoryTestRuns.values())
    .filter(r => r.project_id === projectId && (!orgId || r.organization_id === orgId))
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
}

/**
 * List all test runs for an organization
 */
export async function listTestRunsByOrg(orgId: string, limit?: number): Promise<TestRun[]> {
  if (isDatabaseConnected()) {
    try {
      let queryText = 'SELECT * FROM test_runs WHERE organization_id = $1 ORDER BY created_at DESC';
      const params: any[] = [orgId];

      if (limit) {
        queryText += ' LIMIT $2';
        params.push(limit);
      }

      const result = await query<any>(queryText, params);
      if (result && result.rows) {
        return result.rows.map(rowToTestRun);
      }
    } catch (error) {
      console.error('[TestRunsRepo] Failed to list test runs from database:', error);
    }
  }

  // Fallback to memory
  let runs = Array.from(memoryTestRuns.values())
    .filter(r => r.organization_id === orgId)
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

  if (limit) {
    runs = runs.slice(0, limit);
  }

  return runs;
}

/**
 * Get recent test runs with pagination
 */
export async function getRecentTestRuns(
  orgId: string,
  options: { limit?: number; offset?: number; status?: TestRunStatus }
): Promise<{ runs: TestRun[]; total: number }> {
  const limit = options.limit || 50;
  const offset = options.offset || 0;

  if (isDatabaseConnected()) {
    try {
      let countQuery = 'SELECT COUNT(*) FROM test_runs WHERE organization_id = $1';
      let selectQuery = 'SELECT * FROM test_runs WHERE organization_id = $1';
      const params: any[] = [orgId];

      if (options.status) {
        countQuery += ' AND status = $2';
        selectQuery += ' AND status = $2';
        params.push(options.status);
      }

      selectQuery += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);

      const countResult = await query<any>(countQuery, params.slice(0, options.status ? 2 : 1));
      const total = countResult?.rows[0]?.count ? parseInt(countResult.rows[0].count, 10) : 0;

      const result = await query<any>(selectQuery, [...params, limit, offset]);
      const runs = result?.rows ? result.rows.map(rowToTestRun) : [];

      return { runs, total };
    } catch (error) {
      console.error('[TestRunsRepo] Failed to get recent test runs from database:', error);
    }
  }

  // Fallback to memory
  let runs = Array.from(memoryTestRuns.values())
    .filter(r => r.organization_id === orgId && (!options.status || r.status === options.status))
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

  const total = runs.length;
  runs = runs.slice(offset, offset + limit);

  return { runs, total };
}

// ============================================================================
// Selector Overrides CRUD Functions
// ============================================================================

/**
 * Create or update a selector override
 */
export async function upsertSelectorOverride(override: SelectorOverride): Promise<SelectorOverride> {
  const key = `${override.test_id}-${override.step_id}`;

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
        memorySelectorOverrides.set(key, override);
        return rowToSelectorOverride(result.rows[0]);
      }
    } catch (error) {
      console.error('[TestRunsRepo] Failed to upsert selector override in database:', error);
    }
  }

  // Fallback to memory
  memorySelectorOverrides.set(key, override);
  return override;
}

/**
 * Get a selector override by test and step ID
 */
export async function getSelectorOverride(testId: string, stepId: string): Promise<SelectorOverride | undefined> {
  const key = `${testId}-${stepId}`;

  if (isDatabaseConnected()) {
    try {
      const result = await query<any>(
        'SELECT * FROM selector_overrides WHERE test_id = $1 AND step_id = $2',
        [testId, stepId]
      );
      if (result && result.rows[0]) {
        return rowToSelectorOverride(result.rows[0]);
      }
    } catch (error) {
      console.error('[TestRunsRepo] Failed to get selector override from database:', error);
    }
  }

  // Fallback to memory
  return memorySelectorOverrides.get(key);
}

/**
 * Delete a selector override
 */
export async function deleteSelectorOverride(testId: string, stepId: string): Promise<boolean> {
  const key = `${testId}-${stepId}`;
  memorySelectorOverrides.delete(key);

  if (isDatabaseConnected()) {
    try {
      const result = await query(
        'DELETE FROM selector_overrides WHERE test_id = $1 AND step_id = $2',
        [testId, stepId]
      );
      return result !== null && result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      console.error('[TestRunsRepo] Failed to delete selector override from database:', error);
    }
  }

  return true;
}

/**
 * List all selector overrides for a test
 */
export async function listSelectorOverrides(testId: string): Promise<SelectorOverride[]> {
  if (isDatabaseConnected()) {
    try {
      const result = await query<any>(
        'SELECT * FROM selector_overrides WHERE test_id = $1',
        [testId]
      );
      if (result && result.rows) {
        return result.rows.map(rowToSelectorOverride);
      }
    } catch (error) {
      console.error('[TestRunsRepo] Failed to list selector overrides from database:', error);
    }
  }

  // Fallback to memory
  return Array.from(memorySelectorOverrides.values())
    .filter(o => o.test_id === testId);
}

// ============================================================================
// Healed Selector History CRUD Functions
// ============================================================================

/**
 * Create or update a healed selector entry
 */
export async function upsertHealedSelectorEntry(entry: HealedSelectorEntry): Promise<HealedSelectorEntry> {
  const key = `${entry.test_id}-${entry.step_id}`;

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
        memoryHealedSelectorHistory.set(key, entry);
        return rowToHealedSelectorEntry(result.rows[0]);
      }
    } catch (error) {
      console.error('[TestRunsRepo] Failed to upsert healed selector entry in database:', error);
    }
  }

  // Fallback to memory
  memoryHealedSelectorHistory.set(key, entry);
  return entry;
}

/**
 * Get a healed selector entry by test and step ID
 */
export async function getHealedSelectorEntry(testId: string, stepId: string): Promise<HealedSelectorEntry | undefined> {
  const key = `${testId}-${stepId}`;

  if (isDatabaseConnected()) {
    try {
      const result = await query<any>(
        'SELECT * FROM healed_selector_history WHERE test_id = $1 AND step_id = $2',
        [testId, stepId]
      );
      if (result && result.rows[0]) {
        return rowToHealedSelectorEntry(result.rows[0]);
      }
    } catch (error) {
      console.error('[TestRunsRepo] Failed to get healed selector entry from database:', error);
    }
  }

  // Fallback to memory
  return memoryHealedSelectorHistory.get(key);
}

/**
 * List all healed selector entries for a test
 */
export async function listHealedSelectorHistory(testId: string): Promise<HealedSelectorEntry[]> {
  if (isDatabaseConnected()) {
    try {
      const result = await query<any>(
        'SELECT * FROM healed_selector_history WHERE test_id = $1 ORDER BY healed_at DESC',
        [testId]
      );
      if (result && result.rows) {
        return result.rows.map(rowToHealedSelectorEntry);
      }
    } catch (error) {
      console.error('[TestRunsRepo] Failed to list healed selector history from database:', error);
    }
  }

  // Fallback to memory
  return Array.from(memoryHealedSelectorHistory.values())
    .filter(e => e.test_id === testId)
    .sort((a, b) => new Date(b.healed_at).getTime() - new Date(a.healed_at).getTime());
}

// ============================================================================
// Memory Store Accessors (for backward compatibility)
// ============================================================================

/**
 * Get the in-memory test runs Map
 * Used for backward compatibility with code that needs synchronous access
 */
export function getMemoryTestRuns(): Map<string, TestRun> {
  return memoryTestRuns;
}

/**
 * Get the in-memory selector overrides Map
 */
export function getMemorySelectorOverrides(): Map<string, SelectorOverride> {
  return memorySelectorOverrides;
}

/**
 * Get the in-memory healed selector history Map
 */
export function getMemoryHealedSelectorHistory(): Map<string, HealedSelectorEntry> {
  return memoryHealedSelectorHistory;
}
