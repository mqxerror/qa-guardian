/**
 * AI Test Generator Module - Data Stores
 * Feature #1499: Add test generation history and versioning
 *
 * In-memory store for AI-generated test history.
 * In production, this would be replaced with a database.
 */

import { AIGeneratedTest, ApprovalStatus } from './types';

// In-memory store for AI-generated tests
// Key: test ID
export const aiGeneratedTests: Map<string, AIGeneratedTest> = new Map();

// Index by user_id for fast lookup
// Key: user_id, Value: Set of test IDs
export const testsByUser: Map<string, Set<string>> = new Map();

// Index by organization_id for fast lookup
// Key: organization_id, Value: Set of test IDs
export const testsByOrganization: Map<string, Set<string>> = new Map();

// Index by project_id for fast lookup
// Key: project_id, Value: Set of test IDs
export const testsByProject: Map<string, Set<string>> = new Map();

// Version chains - group tests by description for version tracking
// Key: hash of (user_id + description), Value: array of version IDs
export const versionChains: Map<string, string[]> = new Map();

// Feature #1500: Index by approval status
// Key: approval status, Value: Set of test IDs
export const testsByApprovalStatus: Map<ApprovalStatus, Set<string>> = new Map([
  ['pending', new Set()],
  ['approved', new Set()],
  ['rejected', new Set()],
]);

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
  // Simple hash using the description normalized
  const normalized = description.trim().toLowerCase();
  return `${userId}:${normalized}`;
}

/**
 * Add a test to all relevant indexes
 */
export function indexTest(test: AIGeneratedTest): void {
  // Add to main store
  aiGeneratedTests.set(test.id, test);

  // Add to user index
  if (!testsByUser.has(test.user_id)) {
    testsByUser.set(test.user_id, new Set());
  }
  testsByUser.get(test.user_id)!.add(test.id);

  // Add to organization index
  if (test.organization_id) {
    if (!testsByOrganization.has(test.organization_id)) {
      testsByOrganization.set(test.organization_id, new Set());
    }
    testsByOrganization.get(test.organization_id)!.add(test.id);
  }

  // Add to project index
  if (test.project_id) {
    if (!testsByProject.has(test.project_id)) {
      testsByProject.set(test.project_id, new Set());
    }
    testsByProject.get(test.project_id)!.add(test.id);
  }

  // Add to version chain
  const chainKey = getVersionChainKey(test.user_id, test.description);
  if (!versionChains.has(chainKey)) {
    versionChains.set(chainKey, []);
  }
  versionChains.get(chainKey)!.push(test.id);

  // Feature #1500: Add to approval status index
  const status = test.approval?.status || 'pending';
  testsByApprovalStatus.get(status)!.add(test.id);
}

/**
 * Update approval status index when status changes
 */
export function updateApprovalStatusIndex(testId: string, oldStatus: ApprovalStatus, newStatus: ApprovalStatus): void {
  testsByApprovalStatus.get(oldStatus)?.delete(testId);
  testsByApprovalStatus.get(newStatus)!.add(testId);
}

/**
 * Get all tests with a specific approval status
 */
export function getTestsByApprovalStatus(status: ApprovalStatus): AIGeneratedTest[] {
  const testIds = testsByApprovalStatus.get(status);
  if (!testIds) return [];

  return Array.from(testIds)
    .map(id => aiGeneratedTests.get(id)!)
    .filter(Boolean)
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
}

/**
 * Get all tests for a user, sorted by created_at descending
 */
export function getTestsByUser(userId: string): AIGeneratedTest[] {
  const testIds = testsByUser.get(userId);
  if (!testIds) return [];

  return Array.from(testIds)
    .map(id => aiGeneratedTests.get(id)!)
    .filter(Boolean)
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
}

/**
 * Get all tests for a project, sorted by created_at descending
 */
export function getTestsByProjectId(projectId: string): AIGeneratedTest[] {
  const testIds = testsByProject.get(projectId);
  if (!testIds) return [];

  return Array.from(testIds)
    .map(id => aiGeneratedTests.get(id)!)
    .filter(Boolean)
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
}

/**
 * Get version chain for a specific description
 */
export function getVersionChain(userId: string, description: string): AIGeneratedTest[] {
  const chainKey = getVersionChainKey(userId, description);
  const testIds = versionChains.get(chainKey);
  if (!testIds) return [];

  return testIds
    .map(id => aiGeneratedTests.get(id)!)
    .filter(Boolean)
    .sort((a, b) => a.version - b.version);
}

/**
 * Get the latest version number for a description
 */
export function getLatestVersion(userId: string, description: string): number {
  const chain = getVersionChain(userId, description);
  if (chain.length === 0) return 0;
  return Math.max(...chain.map(t => t.version));
}
