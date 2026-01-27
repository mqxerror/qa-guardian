/**
 * AI Test Generator Module - Data Stores
 * Feature #1499: Add test generation history and versioning
 * Feature #2090: PostgreSQL migration
 *
 * In-memory store for AI-generated test history.
 * Now uses repository functions with in-memory fallback.
 */

import { AIGeneratedTest, ApprovalStatus } from './types';

// Import repository functions
import * as aiTestGenRepo from '../../services/repositories/ai-test-generator';

// Re-export repository functions for database access
export const createAiGeneratedTest = aiTestGenRepo.createAiGeneratedTest;
export const getAiGeneratedTest = aiTestGenRepo.getAiGeneratedTest;
export const updateAiGeneratedTest = aiTestGenRepo.updateAiGeneratedTest;
export const deleteAiGeneratedTest = aiTestGenRepo.deleteAiGeneratedTest;

export const getTestsByUser = aiTestGenRepo.getTestsByUser;
export const getTestsByOrganization = aiTestGenRepo.getTestsByOrganization;
export const getTestsByProjectId = aiTestGenRepo.getTestsByProjectId;
export const getTestsByApprovalStatus = aiTestGenRepo.getTestsByApprovalStatus;

export const getVersionChain = aiTestGenRepo.getVersionChain;
export const getLatestVersion = aiTestGenRepo.getLatestVersion;

export const getGenerationHistory = aiTestGenRepo.getGenerationHistory;
export const getPendingReviewCount = aiTestGenRepo.getPendingReviewCount;
export const getRecentlyReviewed = aiTestGenRepo.getRecentlyReviewed;

export const approveTest = aiTestGenRepo.approveTest;
export const rejectTest = aiTestGenRepo.rejectTest;

// Re-export helper functions
export const generateTestId = aiTestGenRepo.generateTestId;
export const getVersionChainKey = aiTestGenRepo.getVersionChainKey;
export const indexTest = aiTestGenRepo.indexTest;
export const updateApprovalStatusIndex = aiTestGenRepo.updateApprovalStatusIndex;

// Backward compatible Map exports (from repository memory stores)
// These are kept for backward compatibility with existing code that uses Map operations
export const aiGeneratedTests: Map<string, AIGeneratedTest> = aiTestGenRepo.getMemoryAiGeneratedTests();
export const testsByUser: Map<string, Set<string>> = aiTestGenRepo.getMemoryTestsByUser();
export const testsByOrganization: Map<string, Set<string>> = aiTestGenRepo.getMemoryTestsByOrganization();
export const testsByProject: Map<string, Set<string>> = aiTestGenRepo.getMemoryTestsByProject();
export const versionChains: Map<string, string[]> = aiTestGenRepo.getMemoryVersionChains();
export const testsByApprovalStatus: Map<ApprovalStatus, Set<string>> = aiTestGenRepo.getMemoryTestsByApprovalStatus();
