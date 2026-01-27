/**
 * Test Suites Repository - Database CRUD operations for test suites and tests
 *
 * This module provides database persistence for test suites and tests when PostgreSQL is available,
 * with transparent fallback to in-memory storage when database is not connected.
 */

import { query, isDatabaseConnected } from '../database';
import { TestSuite, Test } from '../../routes/test-suites/types';

// In-memory stores (used as fallback when database is not available)
const memoryTestSuites: Map<string, TestSuite> = new Map();
const memoryTests: Map<string, Test> = new Map();

// ===== TEST SUITES =====

export async function createTestSuite(suite: TestSuite): Promise<TestSuite> {
  if (isDatabaseConnected()) {
    const result = await query<TestSuite>(
      `INSERT INTO test_suites (id, project_id, name, description, type, config, tags, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        suite.id,
        suite.project_id,
        suite.name,
        suite.description || null,
        suite.type || 'e2e',
        JSON.stringify({
          organization_id: suite.organization_id,
          base_url: suite.base_url,
          browser: suite.browser,
          browsers: suite.browsers,
          viewport_width: suite.viewport_width,
          viewport_height: suite.viewport_height,
          timeout: suite.timeout,
          retry_count: suite.retry_count,
          require_human_review: suite.require_human_review,
        }),
        suite.type ? [suite.type] : [],
        suite.created_at,
        suite.updated_at,
      ]
    );
    if (result && result.rows[0]) {
      // Convert DB row back to TestSuite type
      return rowToTestSuite(result.rows[0]);
    }
  }
  // Fallback to memory
  memoryTestSuites.set(suite.id, suite);
  return suite;
}

export async function getTestSuite(id: string): Promise<TestSuite | undefined> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT * FROM test_suites WHERE id = $1`,
      [id]
    );
    if (result && result.rows[0]) {
      return rowToTestSuite(result.rows[0]);
    }
    return undefined;
  }
  return memoryTestSuites.get(id);
}

export async function updateTestSuite(id: string, updates: Partial<TestSuite>): Promise<TestSuite | undefined> {
  if (isDatabaseConnected()) {
    const existing = await getTestSuite(id);
    if (!existing) return undefined;

    const updatedSuite = {
      ...existing,
      ...updates,
      updated_at: new Date(),
    };

    const result = await query<any>(
      `UPDATE test_suites SET
        name = $2, description = $3, type = $4, config = $5, tags = $6, updated_at = $7
       WHERE id = $1
       RETURNING *`,
      [
        id,
        updatedSuite.name,
        updatedSuite.description || null,
        updatedSuite.type || 'e2e',
        JSON.stringify({
          organization_id: updatedSuite.organization_id,
          base_url: updatedSuite.base_url,
          browser: updatedSuite.browser,
          browsers: updatedSuite.browsers,
          viewport_width: updatedSuite.viewport_width,
          viewport_height: updatedSuite.viewport_height,
          timeout: updatedSuite.timeout,
          retry_count: updatedSuite.retry_count,
          require_human_review: updatedSuite.require_human_review,
        }),
        updatedSuite.type ? [updatedSuite.type] : [],
        updatedSuite.updated_at,
      ]
    );
    if (result && result.rows[0]) {
      return rowToTestSuite(result.rows[0]);
    }
    return undefined;
  }
  // Fallback to memory
  const suite = memoryTestSuites.get(id);
  if (!suite) return undefined;
  const updatedSuite = { ...suite, ...updates, updated_at: new Date() };
  memoryTestSuites.set(id, updatedSuite);
  return updatedSuite;
}

export async function deleteTestSuite(id: string): Promise<boolean> {
  if (isDatabaseConnected()) {
    // Delete all tests in this suite first (CASCADE should handle this, but being explicit)
    await query(`DELETE FROM tests WHERE suite_id = $1`, [id]);
    const result = await query(
      `DELETE FROM test_suites WHERE id = $1`,
      [id]
    );
    return result !== null && (result.rowCount ?? 0) > 0;
  }
  // Also delete tests in memory
  for (const [testId, test] of memoryTests) {
    if (test.suite_id === id) {
      memoryTests.delete(testId);
    }
  }
  return memoryTestSuites.delete(id);
}

export async function listTestSuites(projectId: string, organizationId: string): Promise<TestSuite[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT * FROM test_suites WHERE project_id = $1 ORDER BY created_at DESC`,
      [projectId]
    );
    if (result) {
      // Filter by organization_id from the config JSONB
      return result.rows
        .map(row => rowToTestSuite(row))
        .filter(suite => suite.organization_id === organizationId);
    }
    return [];
  }
  return Array.from(memoryTestSuites.values()).filter(
    s => s.project_id === projectId && s.organization_id === organizationId
  );
}

export async function listAllTestSuites(organizationId: string): Promise<TestSuite[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT * FROM test_suites ORDER BY created_at DESC`
    );
    if (result) {
      return result.rows
        .map(row => rowToTestSuite(row))
        .filter(suite => suite.organization_id === organizationId);
    }
    return [];
  }
  return Array.from(memoryTestSuites.values()).filter(s => s.organization_id === organizationId);
}

// ===== TESTS =====

export async function createTest(test: Test): Promise<Test> {
  if (isDatabaseConnected()) {
    // Get the suite to find the project_id
    const suite = await getTestSuite(test.suite_id);
    const projectId = suite?.project_id || null;

    const result = await query<Test>(
      `INSERT INTO tests (id, suite_id, project_id, name, description, type, config, code, enabled, priority, tags, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        test.id,
        test.suite_id,
        projectId,
        test.name,
        test.description || null,
        test.test_type,
        JSON.stringify(testToConfig(test)),
        test.playwright_code || null,
        test.status === 'active',
        test.order || 0,
        test.test_type ? [test.test_type] : [],
        test.created_at,
        test.updated_at,
      ]
    );
    if (result && result.rows[0]) {
      return rowToTest(result.rows[0], test.organization_id);
    }
  }
  // Fallback to memory
  memoryTests.set(test.id, test);
  return test;
}

export async function getTest(id: string): Promise<Test | undefined> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT t.*, ts.config as suite_config FROM tests t
       LEFT JOIN test_suites ts ON t.suite_id = ts.id
       WHERE t.id = $1`,
      [id]
    );
    if (result && result.rows[0]) {
      // Extract organization_id from suite config
      const suiteConfig = result.rows[0].suite_config;
      const orgId = suiteConfig?.organization_id || '';
      return rowToTest(result.rows[0], orgId);
    }
    return undefined;
  }
  return memoryTests.get(id);
}

export async function updateTest(id: string, updates: Partial<Test>): Promise<Test | undefined> {
  if (isDatabaseConnected()) {
    const existing = await getTest(id);
    if (!existing) return undefined;

    const updatedTest = {
      ...existing,
      ...updates,
      updated_at: new Date(),
    };

    const result = await query<any>(
      `UPDATE tests SET
        name = $2, description = $3, type = $4, config = $5, code = $6,
        enabled = $7, priority = $8, tags = $9, updated_at = $10
       WHERE id = $1
       RETURNING *`,
      [
        id,
        updatedTest.name,
        updatedTest.description || null,
        updatedTest.test_type,
        JSON.stringify(testToConfig(updatedTest)),
        updatedTest.playwright_code || null,
        updatedTest.status === 'active',
        updatedTest.order || 0,
        updatedTest.test_type ? [updatedTest.test_type] : [],
        updatedTest.updated_at,
      ]
    );
    if (result && result.rows[0]) {
      return rowToTest(result.rows[0], existing.organization_id);
    }
    return undefined;
  }
  // Fallback to memory
  const test = memoryTests.get(id);
  if (!test) return undefined;
  const updatedTest = { ...test, ...updates, updated_at: new Date() };
  memoryTests.set(id, updatedTest);
  return updatedTest;
}

export async function deleteTest(id: string): Promise<boolean> {
  if (isDatabaseConnected()) {
    const result = await query(
      `DELETE FROM tests WHERE id = $1`,
      [id]
    );
    return result !== null && (result.rowCount ?? 0) > 0;
  }
  return memoryTests.delete(id);
}

export async function listTests(suiteId: string): Promise<Test[]> {
  if (isDatabaseConnected()) {
    // Get the suite to find the organization_id
    const suite = await getTestSuite(suiteId);
    const orgId = suite?.organization_id || '';

    const result = await query<any>(
      `SELECT * FROM tests WHERE suite_id = $1 ORDER BY priority ASC, created_at ASC`,
      [suiteId]
    );
    if (result) {
      return result.rows.map(row => rowToTest(row, orgId));
    }
    return [];
  }
  return Array.from(memoryTests.values())
    .filter(t => t.suite_id === suiteId)
    .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
}

export async function listAllTests(organizationId: string): Promise<Test[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT t.*, ts.config as suite_config FROM tests t
       LEFT JOIN test_suites ts ON t.suite_id = ts.id
       ORDER BY t.created_at DESC`
    );
    if (result) {
      return result.rows
        .map(row => {
          const suiteConfig = row.suite_config;
          const orgId = suiteConfig?.organization_id || '';
          return rowToTest(row, orgId);
        })
        .filter(test => test.organization_id === organizationId);
    }
    return [];
  }
  return Array.from(memoryTests.values()).filter(t => t.organization_id === organizationId);
}

// ===== HELPER FUNCTIONS =====

/**
 * Convert a database row to a TestSuite object
 */
function rowToTestSuite(row: any): TestSuite {
  const config = typeof row.config === 'string' ? JSON.parse(row.config) : (row.config || {});
  return {
    id: row.id,
    project_id: row.project_id,
    organization_id: config.organization_id || '',
    name: row.name,
    description: row.description || undefined,
    type: row.type as TestSuite['type'],
    base_url: config.base_url,
    browser: config.browser,
    browsers: config.browsers,
    viewport_width: config.viewport_width,
    viewport_height: config.viewport_height,
    timeout: config.timeout,
    retry_count: config.retry_count,
    require_human_review: config.require_human_review,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

/**
 * Convert a database row to a Test object
 */
function rowToTest(row: any, organizationId: string): Test {
  const config = typeof row.config === 'string' ? JSON.parse(row.config) : (row.config || {});
  return {
    id: row.id,
    suite_id: row.suite_id,
    organization_id: organizationId,
    name: row.name,
    description: row.description || undefined,
    order: row.priority || 0,
    test_type: row.type as Test['test_type'],
    steps: config.steps || [],
    playwright_code: row.code || undefined,
    use_custom_code: config.use_custom_code,
    // Accessibility fields
    wcag_level: config.wcag_level,
    accessibility_rules: config.accessibility_rules,
    include_best_practices: config.include_best_practices,
    include_experimental: config.include_experimental,
    include_pa11y: config.include_pa11y,
    disable_javascript: config.disable_javascript,
    a11y_fail_on_any: config.a11y_fail_on_any,
    a11y_fail_on_critical: config.a11y_fail_on_critical,
    a11y_fail_on_serious: config.a11y_fail_on_serious,
    a11y_fail_on_moderate: config.a11y_fail_on_moderate,
    a11y_fail_on_minor: config.a11y_fail_on_minor,
    a11y_timeout: config.a11y_timeout,
    a11y_wait_for: config.a11y_wait_for,
    a11y_wait_selector: config.a11y_wait_selector,
    a11y_wait_time: config.a11y_wait_time,
    a11y_scroll_page: config.a11y_scroll_page,
    a11y_scroll_behavior: config.a11y_scroll_behavior,
    // Lighthouse fields
    device_preset: config.device_preset,
    performance_threshold: config.performance_threshold,
    lcp_threshold: config.lcp_threshold,
    cls_threshold: config.cls_threshold,
    bypass_csp: config.bypass_csp,
    ignore_ssl_errors: config.ignore_ssl_errors,
    audit_timeout: config.audit_timeout,
    // Visual regression fields
    target_url: config.target_url,
    viewport_width: config.viewport_width,
    viewport_height: config.viewport_height,
    viewport_preset: config.viewport_preset,
    capture_mode: config.capture_mode,
    element_selector: config.element_selector,
    wait_for_selector: config.wait_for_selector,
    wait_time: config.wait_time,
    hide_selectors: config.hide_selectors,
    remove_selectors: config.remove_selectors,
    multi_viewport: config.multi_viewport,
    viewports: config.viewports,
    diff_threshold: config.diff_threshold,
    diff_threshold_mode: config.diff_threshold_mode,
    diff_pixel_threshold: config.diff_pixel_threshold,
    ignore_regions: config.ignore_regions,
    ignore_selectors: config.ignore_selectors,
    mask_datetime_selectors: config.mask_datetime_selectors,
    mask_dynamic_content: config.mask_dynamic_content,
    anti_aliasing_tolerance: config.anti_aliasing_tolerance,
    color_threshold: config.color_threshold,
    // Load test fields
    virtual_users: config.virtual_users,
    duration: config.duration,
    ramp_up_time: config.ramp_up_time,
    k6_script: config.k6_script,
    k6_thresholds: config.k6_thresholds,
    // Status and AI fields
    status: row.enabled ? 'active' : 'draft',
    review_status: config.review_status,
    ai_generated: config.ai_generated,
    ai_confidence_score: config.ai_confidence_score,
    reviewed_by: config.reviewed_by,
    reviewed_at: config.reviewed_at ? new Date(config.reviewed_at) : undefined,
    review_notes: config.review_notes,
    // Quarantine fields
    quarantined: config.quarantined,
    quarantine_reason: config.quarantine_reason,
    quarantined_at: config.quarantined_at ? new Date(config.quarantined_at) : undefined,
    quarantined_by: config.quarantined_by,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

/**
 * Convert a Test object to a config object for database storage
 */
function testToConfig(test: Test): Record<string, any> {
  return {
    steps: test.steps,
    use_custom_code: test.use_custom_code,
    // Accessibility fields
    wcag_level: test.wcag_level,
    accessibility_rules: test.accessibility_rules,
    include_best_practices: test.include_best_practices,
    include_experimental: test.include_experimental,
    include_pa11y: test.include_pa11y,
    disable_javascript: test.disable_javascript,
    a11y_fail_on_any: test.a11y_fail_on_any,
    a11y_fail_on_critical: test.a11y_fail_on_critical,
    a11y_fail_on_serious: test.a11y_fail_on_serious,
    a11y_fail_on_moderate: test.a11y_fail_on_moderate,
    a11y_fail_on_minor: test.a11y_fail_on_minor,
    a11y_timeout: test.a11y_timeout,
    a11y_wait_for: test.a11y_wait_for,
    a11y_wait_selector: test.a11y_wait_selector,
    a11y_wait_time: test.a11y_wait_time,
    a11y_scroll_page: test.a11y_scroll_page,
    a11y_scroll_behavior: test.a11y_scroll_behavior,
    // Lighthouse fields
    device_preset: test.device_preset,
    performance_threshold: test.performance_threshold,
    lcp_threshold: test.lcp_threshold,
    cls_threshold: test.cls_threshold,
    bypass_csp: test.bypass_csp,
    ignore_ssl_errors: test.ignore_ssl_errors,
    audit_timeout: test.audit_timeout,
    // Visual regression fields
    target_url: test.target_url,
    viewport_width: test.viewport_width,
    viewport_height: test.viewport_height,
    viewport_preset: test.viewport_preset,
    capture_mode: test.capture_mode,
    element_selector: test.element_selector,
    wait_for_selector: test.wait_for_selector,
    wait_time: test.wait_time,
    hide_selectors: test.hide_selectors,
    remove_selectors: test.remove_selectors,
    multi_viewport: test.multi_viewport,
    viewports: test.viewports,
    diff_threshold: test.diff_threshold,
    diff_threshold_mode: test.diff_threshold_mode,
    diff_pixel_threshold: test.diff_pixel_threshold,
    ignore_regions: test.ignore_regions,
    ignore_selectors: test.ignore_selectors,
    mask_datetime_selectors: test.mask_datetime_selectors,
    mask_dynamic_content: test.mask_dynamic_content,
    anti_aliasing_tolerance: test.anti_aliasing_tolerance,
    color_threshold: test.color_threshold,
    // Load test fields
    virtual_users: test.virtual_users,
    duration: test.duration,
    ramp_up_time: test.ramp_up_time,
    k6_script: test.k6_script,
    k6_thresholds: test.k6_thresholds,
    // AI fields
    review_status: test.review_status,
    ai_generated: test.ai_generated,
    ai_confidence_score: test.ai_confidence_score,
    reviewed_by: test.reviewed_by,
    reviewed_at: test.reviewed_at?.toISOString(),
    review_notes: test.review_notes,
    // Quarantine fields
    quarantined: test.quarantined,
    quarantine_reason: test.quarantine_reason,
    quarantined_at: test.quarantined_at?.toISOString(),
    quarantined_by: test.quarantined_by,
  };
}

// ===== COMPATIBILITY EXPORTS =====

/**
 * Synchronous access to in-memory test suites store
 * Use this only when async access is not possible
 */
export function getMemoryTestSuites(): Map<string, TestSuite> {
  return memoryTestSuites;
}

export function getMemoryTests(): Map<string, Test> {
  return memoryTests;
}

/**
 * Get all test suites as a Map (for compatibility with existing code)
 */
export async function getTestSuitesMap(): Promise<Map<string, TestSuite>> {
  if (isDatabaseConnected()) {
    const result = await query<any>(`SELECT * FROM test_suites ORDER BY created_at DESC`);
    const map = new Map<string, TestSuite>();
    if (result) {
      for (const row of result.rows) {
        const suite = rowToTestSuite(row);
        map.set(row.id, suite);
      }
    }
    return map;
  }
  return memoryTestSuites;
}

/**
 * Get all tests as a Map (for compatibility with existing code)
 */
export async function getTestsMap(): Promise<Map<string, Test>> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT t.*, ts.config as suite_config FROM tests t
       LEFT JOIN test_suites ts ON t.suite_id = ts.id
       ORDER BY t.created_at DESC`
    );
    const map = new Map<string, Test>();
    if (result) {
      for (const row of result.rows) {
        const suiteConfig = row.suite_config;
        const orgId = suiteConfig?.organization_id || '';
        const test = rowToTest(row, orgId);
        map.set(row.id, test);
      }
    }
    return map;
  }
  return memoryTests;
}
