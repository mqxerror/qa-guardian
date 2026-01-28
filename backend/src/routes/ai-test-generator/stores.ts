/**
 * AI Test Generator Module - Data Stores
 * Feature #1499: Add test generation history and versioning
 * Feature #2090: PostgreSQL migration
 * Feature #2106: Map exports are DEPRECATED - use async functions instead.
 *
 * WARNING: Map exports may return empty data when database is unavailable.
 * Use async functions: createAiGeneratedTest(), getAiGeneratedTest(), etc.
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

// DEPRECATED Map exports (Feature #2106)
// WARNING: These Maps are DEPRECATED and may return empty data!
// Use async functions above instead.
export const aiGeneratedTests: Map<string, AIGeneratedTest> = aiTestGenRepo.getMemoryAiGeneratedTests();
export const testsByUser: Map<string, Set<string>> = aiTestGenRepo.getMemoryTestsByUser();
export const testsByOrganization: Map<string, Set<string>> = aiTestGenRepo.getMemoryTestsByOrganization();
export const testsByProject: Map<string, Set<string>> = aiTestGenRepo.getMemoryTestsByProject();
export const versionChains: Map<string, string[]> = aiTestGenRepo.getMemoryVersionChains();
export const testsByApprovalStatus: Map<ApprovalStatus, Set<string>> = aiTestGenRepo.getMemoryTestsByApprovalStatus();
