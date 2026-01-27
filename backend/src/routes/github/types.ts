/**
 * GitHub Module Types
 *
 * Type definitions for GitHub integration including:
 * - OAuth connection
 * - PR status checks and comments
 * - Dependency scanning
 * - Test file discovery
 *
 * Extracted from github.ts (Feature #1375)
 */

// GitHub connection interface
export interface GitHubConnection {
  id: string;
  project_id: string;
  organization_id: string;
  github_owner: string;  // e.g., 'facebook'
  github_repo: string;   // e.g., 'react'
  github_branch: string; // e.g., 'main'
  test_path: string;     // e.g., 'tests' or 'e2e'
  connected_at: Date;
  connected_by: string;  // user_id
  last_synced_at?: Date;
  pr_checks_enabled?: boolean; // Whether to post PR status checks
  pr_comments_enabled?: boolean; // Whether to post PR comments with results
  // Feature #768: PR Dependency Scanning
  pr_dependency_scan_enabled?: boolean; // Whether to scan dependencies on PR
  pr_dependency_scan_files?: string[]; // Files to watch (e.g., 'package.json', 'package-lock.json')
  pr_dependency_scan_severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'; // Minimum severity to report
  pr_dependency_scan_block_on_critical?: boolean; // Block PR merge on critical vulnerabilities
}

// PR status check interface
export interface PRStatusCheck {
  id: string;
  project_id: string;
  pr_number: number;
  pr_title: string;
  head_sha: string;
  status: 'pending' | 'running' | 'success' | 'failure' | 'error';
  context: string; // e.g., 'QA Guardian / E2E Tests'
  description: string;
  target_url?: string;
  created_at: Date;
  updated_at: Date;
  test_run_id?: string;
}

// PR comment interface
export interface PRComment {
  id: string;
  project_id: string;
  pr_number: number;
  body: string;
  results_url: string;
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  created_at: Date;
}

// Discovered test file from GitHub
export interface GitHubTestFile {
  path: string;
  name: string;
  type: 'spec' | 'test';
}

// Feature #768: PR Dependency Scan Result
export interface PRDependencyScanResult {
  id: string;
  project_id: string;
  pr_number: number;
  head_sha: string;
  status: 'pending' | 'scanning' | 'completed' | 'failed';
  started_at: Date;
  completed_at?: Date;
  changed_files: string[]; // e.g., ['package.json', 'package-lock.json']
  vulnerabilities: PRDependencyVulnerability[];
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    new_in_pr: number; // Vulnerabilities introduced by this PR
    fixed_in_pr: number; // Vulnerabilities fixed by this PR
  };
}

export interface PRDependencyVulnerability {
  id: string;
  cve_id: string;
  package_name: string;
  installed_version: string;
  fixed_version?: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  is_new: boolean; // True if introduced by this PR
  is_fixed: boolean; // True if fixed by this PR
}

// Route parameter interfaces
export interface ProjectParams {
  projectId: string;
}

export interface ConnectRepoBody {
  owner: string;
  repo: string;
  branch?: string;
  test_path?: string;
}

// Demo repository info
export interface DemoRepository {
  owner: string;
  name: string;
  full_name: string;
  default_branch: string;
  private: boolean;
  branches: string[];
}

// Pull request info
export interface DemoPullRequest {
  number: number;
  title: string;
  head_sha: string;
  branch: string;
}
