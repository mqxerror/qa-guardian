/**
 * GitHub Module Stores
 *
 * In-memory data stores for GitHub integration data.
 * Extracted from github.ts (Feature #1375)
 *
 * Updated for Feature #2087: PostgreSQL migration
 * Now uses repository functions with in-memory fallback
 */

import {
  GitHubConnection,
  PRStatusCheck,
  PRComment,
  PRDependencyScanResult,
  GitHubTestFile,
  DemoRepository,
  DemoPullRequest,
} from './types';

// Import repository functions
import * as githubRepo from '../../services/repositories/github';

// Re-export repository functions for database access
export const createGithubConnection = githubRepo.createGithubConnection;
export const getGithubConnection = githubRepo.getGithubConnection;
export const getGithubConnectionByRepo = githubRepo.getGithubConnectionByRepo;
export const updateGithubConnection = githubRepo.updateGithubConnection;
export const deleteGithubConnection = githubRepo.deleteGithubConnection;
export const listGithubConnections = githubRepo.listGithubConnections;

export const addPRStatusCheck = githubRepo.addPRStatusCheck;
export const updatePRStatusCheck = githubRepo.updatePRStatusCheck;
export const getPRStatusChecks = githubRepo.getPRStatusChecks;
export const getPRStatusChecksByPR = githubRepo.getPRStatusChecksByPR;
export const getPRStatusCheckBySha = githubRepo.getPRStatusCheckBySha;

export const addPRComment = githubRepo.addPRComment;
export const getPRComments = githubRepo.getPRComments;
export const getPRCommentsByPR = githubRepo.getPRCommentsByPR;

export const addPRDependencyScan = githubRepo.addPRDependencyScan;
export const updatePRDependencyScan = githubRepo.updatePRDependencyScan;
export const getPRDependencyScans = githubRepo.getPRDependencyScans;
export const getPRDependencyScansByPR = githubRepo.getPRDependencyScansByPR;

export const setUserGithubToken = githubRepo.setUserGithubToken;
export const getUserGithubToken = githubRepo.getUserGithubToken;
export const deleteUserGithubToken = githubRepo.deleteUserGithubToken;

// Backward compatible Map exports (from repository memory stores)
// These are kept for backward compatibility with existing code that uses Map operations
export const githubConnections: Map<string, GitHubConnection> = githubRepo.getMemoryGithubConnections();
export const prStatusChecks: Map<string, PRStatusCheck[]> = githubRepo.getMemoryPRStatusChecks();
export const prComments: Map<string, PRComment[]> = githubRepo.getMemoryPRComments();
export const prDependencyScans: Map<string, PRDependencyScanResult[]> = githubRepo.getMemoryPRDependencyScans();
export const userGithubTokens: Map<string, string> = githubRepo.getMemoryUserGithubTokens();

// Simulated open PRs for demo repos (static data, kept in-memory)
export const demoPullRequests: Record<string, DemoPullRequest[]> = {
  'my-org/frontend-app': [
    { number: 123, title: 'Add user profile page', head_sha: 'abc123def', branch: 'feature/user-profile' },
    { number: 124, title: 'Fix login validation', head_sha: 'def456ghi', branch: 'fix/login-validation' },
    { number: 125, title: 'Update dashboard layout', head_sha: 'ghi789jkl', branch: 'feature/dashboard-v2' },
  ],
  'my-org/backend-api': [
    { number: 45, title: 'Add payment endpoint', head_sha: 'pay123abc', branch: 'feature/payments' },
    { number: 46, title: 'Optimize database queries', head_sha: 'opt456def', branch: 'perf/db-optimization' },
  ],
  'my-org/e2e-tests': [
    { number: 12, title: 'Add smoke tests', head_sha: 'smoke789', branch: 'feature/smoke-tests' },
  ],
};

// Simulated list of repositories for demo purposes (static data, kept in-memory)
export const demoRepositories: DemoRepository[] = [
  { owner: 'my-org', name: 'frontend-app', full_name: 'my-org/frontend-app', default_branch: 'main', private: false, branches: ['main', 'develop', 'feature/auth', 'release/v2'] },
  { owner: 'my-org', name: 'backend-api', full_name: 'my-org/backend-api', default_branch: 'main', private: false, branches: ['main', 'develop', 'staging'] },
  { owner: 'my-org', name: 'e2e-tests', full_name: 'my-org/e2e-tests', default_branch: 'master', private: true, branches: ['master', 'develop'] },
  { owner: 'personal', name: 'playwright-demo', full_name: 'personal/playwright-demo', default_branch: 'main', private: false, branches: ['main'] },
];

// Simulated test files discovered in repos (key format: 'owner/repo' or 'owner/repo:branch')
export const demoTestFiles: Record<string, GitHubTestFile[]> = {
  // Default (main branch) test files for frontend-app
  'my-org/frontend-app': [
    { path: 'tests/auth.spec.ts', name: 'auth.spec.ts', type: 'spec' },
    { path: 'tests/dashboard.spec.ts', name: 'dashboard.spec.ts', type: 'spec' },
    { path: 'tests/profile.spec.ts', name: 'profile.spec.ts', type: 'spec' },
    { path: 'e2e/checkout.test.ts', name: 'checkout.test.ts', type: 'test' },
  ],
  'my-org/frontend-app:main': [
    { path: 'tests/auth.spec.ts', name: 'auth.spec.ts', type: 'spec' },
    { path: 'tests/dashboard.spec.ts', name: 'dashboard.spec.ts', type: 'spec' },
    { path: 'tests/profile.spec.ts', name: 'profile.spec.ts', type: 'spec' },
    { path: 'e2e/checkout.test.ts', name: 'checkout.test.ts', type: 'test' },
  ],
  // Develop branch has more WIP tests
  'my-org/frontend-app:develop': [
    { path: 'tests/auth.spec.ts', name: 'auth.spec.ts', type: 'spec' },
    { path: 'tests/dashboard.spec.ts', name: 'dashboard.spec.ts', type: 'spec' },
    { path: 'tests/profile.spec.ts', name: 'profile.spec.ts', type: 'spec' },
    { path: 'tests/settings.spec.ts', name: 'settings.spec.ts', type: 'spec' },
    { path: 'tests/notifications.spec.ts', name: 'notifications.spec.ts', type: 'spec' },
    { path: 'e2e/checkout.test.ts', name: 'checkout.test.ts', type: 'test' },
    { path: 'e2e/payment.test.ts', name: 'payment.test.ts', type: 'test' },
  ],
  // Feature branch with specific auth tests
  'my-org/frontend-app:feature/auth': [
    { path: 'tests/auth.spec.ts', name: 'auth.spec.ts', type: 'spec' },
    { path: 'tests/auth-oauth.spec.ts', name: 'auth-oauth.spec.ts', type: 'spec' },
    { path: 'tests/auth-mfa.spec.ts', name: 'auth-mfa.spec.ts', type: 'spec' },
  ],
  'my-org/backend-api': [
    { path: 'tests/api/users.spec.ts', name: 'users.spec.ts', type: 'spec' },
    { path: 'tests/api/products.spec.ts', name: 'products.spec.ts', type: 'spec' },
  ],
  'my-org/backend-api:develop': [
    { path: 'tests/api/users.spec.ts', name: 'users.spec.ts', type: 'spec' },
    { path: 'tests/api/products.spec.ts', name: 'products.spec.ts', type: 'spec' },
    { path: 'tests/api/orders.spec.ts', name: 'orders.spec.ts', type: 'spec' },
    { path: 'tests/api/payments.spec.ts', name: 'payments.spec.ts', type: 'spec' },
  ],
  'my-org/e2e-tests': [
    { path: 'specs/smoke.spec.ts', name: 'smoke.spec.ts', type: 'spec' },
    { path: 'specs/regression.spec.ts', name: 'regression.spec.ts', type: 'spec' },
    { path: 'specs/performance.spec.ts', name: 'performance.spec.ts', type: 'spec' },
  ],
  'personal/playwright-demo': [
    { path: 'tests/example.spec.ts', name: 'example.spec.ts', type: 'spec' },
  ],
};

/**
 * Helper function to get test files for a repo + branch
 */
export function getTestFilesForBranch(fullName: string, branch: string): GitHubTestFile[] {
  // First try branch-specific key
  const branchKey = `${fullName}:${branch}`;
  if (demoTestFiles[branchKey]) {
    return demoTestFiles[branchKey];
  }
  // Fall back to default (no branch specified)
  return demoTestFiles[fullName] || [];
}
