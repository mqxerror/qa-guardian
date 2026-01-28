/**
 * AI Test Generator Module - Data Stores
 * Feature #2114: Proxy/getMemory Map exports REMOVED. Only async DB functions exported.
 * Empty Maps kept for backward compatibility until route migration.
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

// DEPRECATED: Empty Map exports for backward compatibility until route migration (#2119)
export const aiGeneratedTests = new Map<string, AIGeneratedTest>();
export const testsByUser = new Map<string, Set<string>>();
export const testsByOrganization = new Map<string, Set<string>>();
export const testsByProject = new Map<string, Set<string>>();
export const versionChains = new Map<string, string[]>();
export const testsByApprovalStatus = new Map<ApprovalStatus, Set<string>>();
