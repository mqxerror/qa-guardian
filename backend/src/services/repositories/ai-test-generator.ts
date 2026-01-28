/**
 * AI Test Generator Repository - PostgreSQL persistence
 *
 * Feature #2090: Migrate AI Test Generator Module to PostgreSQL
 * Feature #2109: Remove in-memory Map stores (DB-only migration)
 *
 * Provides CRUD operations for:
 * - AI-generated tests with version tracking
 * - Approval workflow (pending, approved, rejected)
 * - Version chains for regeneration history
 *
 * Secondary indexes (testsByUser, testsByOrganization, etc.) are replaced
 * with SQL WHERE clauses.
 *
 * All in-memory Map fallbacks have been removed. This module now requires
 * a PostgreSQL database connection to function.
 */

import { query, isDatabaseConnected } from '../database';
import { AIGeneratedTest, ApprovalStatus, ApprovalInfo } from '../../routes/ai-test-generator/types';

// ============================================
// Deprecated Memory Store Accessors
// These return empty Maps for backward compatibility.
// Callers should migrate to the async DB functions.
// ============================================

/** @deprecated Feature #2109 - memory stores removed. Returns empty Map. Use async DB functions instead. */
export function getMemoryAiGeneratedTests(): Map<string, AIGeneratedTest> {
  console.warn('DEPRECATED: getMemoryAiGeneratedTests() - in-memory stores removed in Feature #2109. Use async DB functions.');
  return new Map();
}

/** @deprecated Feature #2109 - memory stores removed. Returns empty Map. Use async DB functions instead. */
export function getMemoryTestsByUser(): Map<string, Set<string>> {
  console.warn('DEPRECATED: getMemoryTestsByUser() - in-memory stores removed in Feature #2109. Use async DB functions.');
  return new Map();
}

/** @deprecated Feature #2109 - memory stores removed. Returns empty Map. Use async DB functions instead. */
export function getMemoryTestsByOrganization(): Map<string, Set<string>> {
  console.warn('DEPRECATED: getMemoryTestsByOrganization() - in-memory stores removed in Feature #2109. Use async DB functions.');
  return new Map();
}

/** @deprecated Feature #2109 - memory stores removed. Returns empty Map. Use async DB functions instead. */
export function getMemoryTestsByProject(): Map<string, Set<string>> {
  console.warn('DEPRECATED: getMemoryTestsByProject() - in-memory stores removed in Feature #2109. Use async DB functions.');
  return new Map();
}

/** @deprecated Feature #2109 - memory stores removed. Returns empty Map. Use async DB functions instead. */
export function getMemoryVersionChains(): Map<string, string[]> {
  console.warn('DEPRECATED: getMemoryVersionChains() - in-memory stores removed in Feature #2109. Use async DB functions.');
  return new Map();
}

/** @deprecated Feature #2109 - memory stores removed. Returns empty Map. Use async DB functions instead. */
export function getMemoryTestsByApprovalStatus(): Map<ApprovalStatus, Set<string>> {
  console.warn('DEPRECATED: getMemoryTestsByApprovalStatus() - in-memory stores removed in Feature #2109. Use async DB functions.');
  return new Map();
}

// ============================================
// Helper Functions
// ============================================

/**
 * Generate a unique ID for a test
 */
export function generateTestId(): string {
  return `aigt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate a hash key for version chain lookup
 */
export function getVersionChainKey(userId: string, description: string): string {
  const normalized = description.trim().toLowerCase();
  return `${userId}:${normalized}`;
}

function parseAiGeneratedTestRow(row: any): AIGeneratedTest {
  return {
    id: row.id,
    user_id: row.user_id,
    organization_id: row.organization_id,
    project_id: row.project_id,
    description: row.description,
    generated_code: row.generated_code,
    test_name: row.test_name,
    language: row.language,
    confidence_score: row.confidence_score,
    confidence_level: row.confidence_level,
    version: row.version,
    parent_version_id: row.parent_version_id,
    feedback: row.feedback,
    ai_metadata: row.ai_metadata || {
      provider: 'unknown',
      model: 'unknown',
      used_real_ai: false,
    },
    options: row.options || {
      include_comments: true,
      include_assertions: true,
      test_framework: 'playwright',
    },
    suggested_variations: row.suggested_variations || [],
    improvement_suggestions: row.improvement_suggestions || [],
    approval: row.approval || { status: 'pending' },
    created_at: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
    updated_at: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at),
  };
}

// ============================================
// AI Generated Test CRUD Operations
// ============================================

export async function createAiGeneratedTest(test: AIGeneratedTest): Promise<AIGeneratedTest> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `INSERT INTO ai_generated_tests (
        id, user_id, organization_id, project_id, description, generated_code,
        test_name, language, confidence_score, confidence_level, version,
        parent_version_id, feedback, ai_metadata, options, suggested_variations,
        improvement_suggestions, approval, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *`,
      [
        test.id,
        test.user_id,
        test.organization_id || null,
        test.project_id || null,
        test.description,
        test.generated_code,
        test.test_name,
        test.language,
        test.confidence_score,
        test.confidence_level,
        test.version,
        test.parent_version_id || null,
        test.feedback || null,
        JSON.stringify(test.ai_metadata),
        JSON.stringify(test.options),
        JSON.stringify(test.suggested_variations || []),
        JSON.stringify(test.improvement_suggestions || []),
        JSON.stringify(test.approval),
        test.created_at,
        test.updated_at,
      ]
    );
    if (result && result.rows[0]) {
      return parseAiGeneratedTestRow(result.rows[0]);
    }
  }
  // No DB connection - return the test object as-is (no memory fallback)
  return test;
}

export async function getAiGeneratedTest(testId: string): Promise<AIGeneratedTest | null> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      'SELECT * FROM ai_generated_tests WHERE id = $1',
      [testId]
    );
    if (result && result.rows[0]) {
      return parseAiGeneratedTestRow(result.rows[0]);
    }
    return null;
  }
  return null;
}

export async function updateAiGeneratedTest(
  testId: string,
  updates: Partial<AIGeneratedTest>
): Promise<AIGeneratedTest | null> {
  if (isDatabaseConnected()) {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.description !== undefined) {
      setClauses.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }
    if (updates.generated_code !== undefined) {
      setClauses.push(`generated_code = $${paramIndex++}`);
      values.push(updates.generated_code);
    }
    if (updates.test_name !== undefined) {
      setClauses.push(`test_name = $${paramIndex++}`);
      values.push(updates.test_name);
    }
    if (updates.confidence_score !== undefined) {
      setClauses.push(`confidence_score = $${paramIndex++}`);
      values.push(updates.confidence_score);
    }
    if (updates.confidence_level !== undefined) {
      setClauses.push(`confidence_level = $${paramIndex++}`);
      values.push(updates.confidence_level);
    }
    if (updates.feedback !== undefined) {
      setClauses.push(`feedback = $${paramIndex++}`);
      values.push(updates.feedback);
    }
    if (updates.approval !== undefined) {
      setClauses.push(`approval = $${paramIndex++}`);
      values.push(JSON.stringify(updates.approval));
    }
    if (updates.suggested_variations !== undefined) {
      setClauses.push(`suggested_variations = $${paramIndex++}`);
      values.push(JSON.stringify(updates.suggested_variations));
    }
    if (updates.improvement_suggestions !== undefined) {
      setClauses.push(`improvement_suggestions = $${paramIndex++}`);
      values.push(JSON.stringify(updates.improvement_suggestions));
    }

    if (setClauses.length === 0) {
      return getAiGeneratedTest(testId);
    }

    values.push(testId);
    const result = await query<any>(
      `UPDATE ai_generated_tests SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    if (result && result.rows[0]) {
      return parseAiGeneratedTestRow(result.rows[0]);
    }
    return null;
  }

  // No DB connection - no memory fallback
  return null;
}

export async function deleteAiGeneratedTest(testId: string): Promise<boolean> {
  if (isDatabaseConnected()) {
    const result = await query(
      'DELETE FROM ai_generated_tests WHERE id = $1',
      [testId]
    );
    return (result?.rowCount ?? 0) > 0;
  }
  // No DB connection - no memory fallback
  return false;
}

// ============================================
// Query Functions (replace secondary indexes)
// ============================================

export async function getTestsByUser(userId: string): Promise<AIGeneratedTest[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      'SELECT * FROM ai_generated_tests WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    if (result) {
      return result.rows.map(parseAiGeneratedTestRow);
    }
    return [];
  }
  // No DB connection - no memory fallback
  return [];
}

export async function getTestsByOrganization(organizationId: string): Promise<AIGeneratedTest[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      'SELECT * FROM ai_generated_tests WHERE organization_id = $1 ORDER BY created_at DESC',
      [organizationId]
    );
    if (result) {
      return result.rows.map(parseAiGeneratedTestRow);
    }
    return [];
  }
  // No DB connection - no memory fallback
  return [];
}

export async function getTestsByProjectId(projectId: string): Promise<AIGeneratedTest[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      'SELECT * FROM ai_generated_tests WHERE project_id = $1 ORDER BY created_at DESC',
      [projectId]
    );
    if (result) {
      return result.rows.map(parseAiGeneratedTestRow);
    }
    return [];
  }
  // No DB connection - no memory fallback
  return [];
}

export async function getTestsByApprovalStatus(status: ApprovalStatus): Promise<AIGeneratedTest[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT * FROM ai_generated_tests WHERE approval->>'status' = $1 ORDER BY created_at DESC`,
      [status]
    );
    if (result) {
      return result.rows.map(parseAiGeneratedTestRow);
    }
    return [];
  }
  // No DB connection - no memory fallback
  return [];
}

// ============================================
// Version Chain Operations
// ============================================

export async function getVersionChain(userId: string, description: string): Promise<AIGeneratedTest[]> {
  if (isDatabaseConnected()) {
    // Use LOWER() and TRIM() for case-insensitive matching like memory store
    const result = await query<any>(
      `SELECT * FROM ai_generated_tests
       WHERE user_id = $1 AND LOWER(TRIM(description)) = LOWER(TRIM($2))
       ORDER BY version ASC`,
      [userId, description]
    );
    if (result) {
      return result.rows.map(parseAiGeneratedTestRow);
    }
    return [];
  }
  // No DB connection - no memory fallback
  return [];
}

export async function getLatestVersion(userId: string, description: string): Promise<number> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT MAX(version) as max_version FROM ai_generated_tests
       WHERE user_id = $1 AND LOWER(TRIM(description)) = LOWER(TRIM($2))`,
      [userId, description]
    );
    if (result && result.rows[0]?.max_version !== null) {
      return result.rows[0].max_version;
    }
    return 0;
  }
  // No DB connection - no memory fallback
  return 0;
}

// ============================================
// History & Search Operations
// ============================================

export async function getGenerationHistory(
  userId: string,
  options: {
    project_id?: string;
    limit?: number;
    offset?: number;
    description_search?: string;
    approval_status?: ApprovalStatus;
  } = {}
): Promise<{ items: AIGeneratedTest[]; total: number }> {
  const { project_id, limit = 20, offset = 0, description_search, approval_status } = options;

  if (isDatabaseConnected()) {
    // Build dynamic WHERE clause
    const conditions: string[] = ['user_id = $1'];
    const params: any[] = [userId];
    let paramIndex = 2;

    if (project_id) {
      conditions.push(`project_id = $${paramIndex++}`);
      params.push(project_id);
    }
    if (description_search) {
      conditions.push(`description ILIKE $${paramIndex++}`);
      params.push(`%${description_search}%`);
    }
    if (approval_status) {
      conditions.push(`approval->>'status' = $${paramIndex++}`);
      params.push(approval_status);
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countResult = await query<any>(
      `SELECT COUNT(*) as total FROM ai_generated_tests WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult?.rows[0]?.total || '0', 10);

    // Get paginated results
    const dataParams = [...params, limit, offset];
    const result = await query<any>(
      `SELECT * FROM ai_generated_tests WHERE ${whereClause}
       ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      dataParams
    );

    const items = result ? result.rows.map(parseAiGeneratedTestRow) : [];
    return { items, total };
  }

  // No DB connection - no memory fallback
  return { items: [], total: 0 };
}

// ============================================
// Review Queue Operations
// ============================================

export async function getPendingReviewCount(): Promise<number> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT COUNT(*) as count FROM ai_generated_tests WHERE approval->>'status' = 'pending'`
    );
    return parseInt(result?.rows[0]?.count || '0', 10);
  }
  // No DB connection - no memory fallback
  return 0;
}

export async function getRecentlyReviewed(limit: number = 10): Promise<AIGeneratedTest[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT * FROM ai_generated_tests
       WHERE approval->>'status' IN ('approved', 'rejected')
       ORDER BY (approval->>'reviewed_at')::timestamp DESC NULLS LAST
       LIMIT $1`,
      [limit]
    );
    if (result) {
      return result.rows.map(parseAiGeneratedTestRow);
    }
    return [];
  }
  // No DB connection - no memory fallback
  return [];
}

// ============================================
// Approval Workflow Operations
// ============================================

export async function approveTest(
  testId: string,
  reviewerId: string,
  reviewerName: string,
  comment?: string,
  addToSuiteId?: string,
  addToSuiteName?: string
): Promise<AIGeneratedTest | null> {
  const approval: ApprovalInfo = {
    status: 'approved',
    reviewed_by: reviewerId,
    reviewed_by_name: reviewerName,
    reviewed_at: new Date(),
    review_comment: comment,
    added_to_suite_id: addToSuiteId,
    added_to_suite_name: addToSuiteName,
  };

  return updateAiGeneratedTest(testId, { approval });
}

export async function rejectTest(
  testId: string,
  reviewerId: string,
  reviewerName: string,
  comment?: string
): Promise<AIGeneratedTest | null> {
  const approval: ApprovalInfo = {
    status: 'rejected',
    reviewed_by: reviewerId,
    reviewed_by_name: reviewerName,
    reviewed_at: new Date(),
    review_comment: comment,
  };

  return updateAiGeneratedTest(testId, { approval });
}

// ============================================
// Index/Store Functions (backward compatible)
// ============================================

/**
 * Add a test to all relevant indexes (for backward compatibility)
 * This is a wrapper that creates the test in DB
 */
export async function indexTest(test: AIGeneratedTest): Promise<void> {
  await createAiGeneratedTest(test);
}

/**
 * Update approval status index when status changes (for backward compatibility)
 */
export async function updateApprovalStatusIndex(
  testId: string,
  oldStatus: ApprovalStatus,
  newStatus: ApprovalStatus
): Promise<void> {
  // In database mode, the approval status is stored in the JSONB column
  // and queries use WHERE approval->>'status' = $1
  // So we just need to update the test record
  const test = await getAiGeneratedTest(testId);
  if (test && test.approval) {
    test.approval.status = newStatus;
    await updateAiGeneratedTest(testId, { approval: test.approval });
  }
}
