/**
 * AI Test Generator Repository - PostgreSQL persistence
 *
 * Feature #2090: Migrate AI Test Generator Module to PostgreSQL
 *
 * Provides CRUD operations for:
 * - AI-generated tests with version tracking
 * - Approval workflow (pending, approved, rejected)
 * - Version chains for regeneration history
 *
 * Secondary indexes (testsByUser, testsByOrganization, etc.) are replaced
 * with SQL WHERE clauses.
 */

import { query, isDatabaseConnected } from '../database';
import { AIGeneratedTest, ApprovalStatus, ApprovalInfo } from '../../routes/ai-test-generator/types';

// Memory fallback stores
const memoryAiGeneratedTests: Map<string, AIGeneratedTest> = new Map();
const memoryTestsByUser: Map<string, Set<string>> = new Map();
const memoryTestsByOrganization: Map<string, Set<string>> = new Map();
const memoryTestsByProject: Map<string, Set<string>> = new Map();
const memoryVersionChains: Map<string, string[]> = new Map();
const memoryTestsByApprovalStatus: Map<ApprovalStatus, Set<string>> = new Map([
  ['pending', new Set()],
  ['approved', new Set()],
  ['rejected', new Set()],
]);

// ============================================
// Memory Store Accessors (for backward compatibility)
// ============================================

export function getMemoryAiGeneratedTests(): Map<string, AIGeneratedTest> {
  return memoryAiGeneratedTests;
}

export function getMemoryTestsByUser(): Map<string, Set<string>> {
  return memoryTestsByUser;
}

export function getMemoryTestsByOrganization(): Map<string, Set<string>> {
  return memoryTestsByOrganization;
}

export function getMemoryTestsByProject(): Map<string, Set<string>> {
  return memoryTestsByProject;
}

export function getMemoryVersionChains(): Map<string, string[]> {
  return memoryVersionChains;
}

export function getMemoryTestsByApprovalStatus(): Map<ApprovalStatus, Set<string>> {
  return memoryTestsByApprovalStatus;
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
// Memory Index Functions (for fallback)
// ============================================

function indexTestInMemory(test: AIGeneratedTest): void {
  // Add to main store
  memoryAiGeneratedTests.set(test.id, test);

  // Add to user index
  if (!memoryTestsByUser.has(test.user_id)) {
    memoryTestsByUser.set(test.user_id, new Set());
  }
  memoryTestsByUser.get(test.user_id)!.add(test.id);

  // Add to organization index
  if (test.organization_id) {
    if (!memoryTestsByOrganization.has(test.organization_id)) {
      memoryTestsByOrganization.set(test.organization_id, new Set());
    }
    memoryTestsByOrganization.get(test.organization_id)!.add(test.id);
  }

  // Add to project index
  if (test.project_id) {
    if (!memoryTestsByProject.has(test.project_id)) {
      memoryTestsByProject.set(test.project_id, new Set());
    }
    memoryTestsByProject.get(test.project_id)!.add(test.id);
  }

  // Add to version chain
  const chainKey = getVersionChainKey(test.user_id, test.description);
  if (!memoryVersionChains.has(chainKey)) {
    memoryVersionChains.set(chainKey, []);
  }
  memoryVersionChains.get(chainKey)!.push(test.id);

  // Add to approval status index
  const status = test.approval?.status || 'pending';
  memoryTestsByApprovalStatus.get(status)!.add(test.id);
}

function updateApprovalStatusIndexInMemory(testId: string, oldStatus: ApprovalStatus, newStatus: ApprovalStatus): void {
  memoryTestsByApprovalStatus.get(oldStatus)?.delete(testId);
  memoryTestsByApprovalStatus.get(newStatus)!.add(testId);
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
  // Memory fallback
  indexTestInMemory(test);
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
  return memoryAiGeneratedTests.get(testId) || null;
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

  // Memory fallback
  const existing = memoryAiGeneratedTests.get(testId);
  if (!existing) return null;

  // Track approval status change for index update
  const oldStatus = existing.approval?.status || 'pending';
  const newStatus = updates.approval?.status || oldStatus;

  const updated: AIGeneratedTest = {
    ...existing,
    ...updates,
    updated_at: new Date(),
  };
  memoryAiGeneratedTests.set(testId, updated);

  if (oldStatus !== newStatus) {
    updateApprovalStatusIndexInMemory(testId, oldStatus, newStatus);
  }

  return updated;
}

export async function deleteAiGeneratedTest(testId: string): Promise<boolean> {
  if (isDatabaseConnected()) {
    const result = await query(
      'DELETE FROM ai_generated_tests WHERE id = $1',
      [testId]
    );
    return (result?.rowCount ?? 0) > 0;
  }
  // Memory fallback - need to remove from all indexes
  const test = memoryAiGeneratedTests.get(testId);
  if (!test) return false;

  memoryAiGeneratedTests.delete(testId);
  memoryTestsByUser.get(test.user_id)?.delete(testId);
  if (test.organization_id) {
    memoryTestsByOrganization.get(test.organization_id)?.delete(testId);
  }
  if (test.project_id) {
    memoryTestsByProject.get(test.project_id)?.delete(testId);
  }
  const status = test.approval?.status || 'pending';
  memoryTestsByApprovalStatus.get(status)?.delete(testId);

  return true;
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
  // Memory fallback
  const testIds = memoryTestsByUser.get(userId);
  if (!testIds) return [];

  return Array.from(testIds)
    .map(id => memoryAiGeneratedTests.get(id)!)
    .filter(Boolean)
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
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
  // Memory fallback
  const testIds = memoryTestsByOrganization.get(organizationId);
  if (!testIds) return [];

  return Array.from(testIds)
    .map(id => memoryAiGeneratedTests.get(id)!)
    .filter(Boolean)
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
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
  // Memory fallback
  const testIds = memoryTestsByProject.get(projectId);
  if (!testIds) return [];

  return Array.from(testIds)
    .map(id => memoryAiGeneratedTests.get(id)!)
    .filter(Boolean)
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
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
  // Memory fallback
  const testIds = memoryTestsByApprovalStatus.get(status);
  if (!testIds) return [];

  return Array.from(testIds)
    .map(id => memoryAiGeneratedTests.get(id)!)
    .filter(Boolean)
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
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
  // Memory fallback
  const chainKey = getVersionChainKey(userId, description);
  const testIds = memoryVersionChains.get(chainKey);
  if (!testIds) return [];

  return testIds
    .map(id => memoryAiGeneratedTests.get(id)!)
    .filter(Boolean)
    .sort((a, b) => a.version - b.version);
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
  // Memory fallback
  const chain = await getVersionChain(userId, description);
  if (chain.length === 0) return 0;
  return Math.max(...chain.map(t => t.version));
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

  // Memory fallback
  let tests = Array.from(memoryAiGeneratedTests.values())
    .filter(t => t.user_id === userId);

  if (project_id) {
    tests = tests.filter(t => t.project_id === project_id);
  }
  if (description_search) {
    const search = description_search.toLowerCase();
    tests = tests.filter(t => t.description.toLowerCase().includes(search));
  }
  if (approval_status) {
    tests = tests.filter(t => t.approval?.status === approval_status);
  }

  tests.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
  const total = tests.length;
  const items = tests.slice(offset, offset + limit);

  return { items, total };
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
  return memoryTestsByApprovalStatus.get('pending')?.size || 0;
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
  // Memory fallback
  const approved = Array.from(memoryTestsByApprovalStatus.get('approved') || []);
  const rejected = Array.from(memoryTestsByApprovalStatus.get('rejected') || []);
  const allReviewed = [...approved, ...rejected]
    .map(id => memoryAiGeneratedTests.get(id)!)
    .filter(Boolean)
    .sort((a, b) => {
      const aTime = a.approval?.reviewed_at ? new Date(a.approval.reviewed_at).getTime() : 0;
      const bTime = b.approval?.reviewed_at ? new Date(b.approval.reviewed_at).getTime() : 0;
      return bTime - aTime;
    });

  return allReviewed.slice(0, limit);
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
 * This is a wrapper that creates the test in DB or memory
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
