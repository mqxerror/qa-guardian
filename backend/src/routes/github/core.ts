/**
 * Core GitHub Routes
 *
 * Core GitHub functionality including:
 * - GitHub OAuth status/connect/disconnect
 * - Repository listing and branches
 * - Project GitHub connection management
 * - PR status checks
 * - PR comments
 *
 * Extracted from github.ts (Feature #1375)
 */

import { FastifyInstance } from 'fastify';
import { authenticate, JwtPayload } from '../../middleware/auth';
import { getProject as dbGetProject } from '../projects/stores';
import { createTestSuite as dbCreateTestSuite, createTest as dbCreateTest } from '../test-suites/stores';

import {
  GitHubConnection,
  PRStatusCheck,
  PRComment,
  ProjectParams,
  ConnectRepoBody,
} from './types';

import {
  githubConnections,
  prStatusChecks,
  prComments,
  userGithubTokens,
  demoPullRequests,
  demoRepositories,
  demoTestFiles,
  getTestFilesForBranch,
} from './stores';

export async function coreGithubRoutes(app: FastifyInstance): Promise<void> {
  // Check if user has GitHub connected (simulated OAuth)
  app.get('/api/v1/github/status', {
    preHandler: [authenticate],
  }, async (request) => {
    const user = request.user as JwtPayload;
    const hasToken = userGithubTokens.has(user.id);

    return {
      connected: hasToken,
      username: hasToken ? 'github-user' : null,
    };
  });

  // Simulate GitHub OAuth - in production this would redirect to GitHub
  app.post('/api/v1/github/connect', {
    preHandler: [authenticate],
  }, async (request) => {
    const user = request.user as JwtPayload;

    // Simulate successful OAuth connection
    userGithubTokens.set(user.id, `ghp_simulated_token_${Date.now()}`);

    console.log(`
====================================
  GitHub OAuth Connected (Simulated)
====================================
  User: ${user.email}
  Note: In production, this would redirect to GitHub OAuth
====================================
    `);

    return {
      success: true,
      message: 'GitHub account connected successfully',
      username: 'github-user',
    };
  });

  // Disconnect GitHub OAuth
  app.post('/api/v1/github/disconnect', {
    preHandler: [authenticate],
  }, async (request) => {
    const user = request.user as JwtPayload;
    userGithubTokens.delete(user.id);

    return {
      success: true,
      message: 'GitHub account disconnected',
    };
  });

  // List available repositories
  app.get('/api/v1/github/repositories', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const user = request.user as JwtPayload;

    if (!userGithubTokens.has(user.id)) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'GitHub account not connected. Please connect your GitHub account first.',
      });
    }

    return {
      repositories: demoRepositories,
    };
  });

  // Get branches for a repository
  app.get<{ Params: { owner: string; repo: string } }>('/api/v1/github/repositories/:owner/:repo/branches', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { owner, repo } = request.params;

    if (!userGithubTokens.has(user.id)) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'GitHub account not connected',
      });
    }

    const fullName = `${owner}/${repo}`;
    const repoInfo = demoRepositories.find(r => r.full_name === fullName);

    if (!repoInfo) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Repository not found',
      });
    }

    return {
      repository: fullName,
      default_branch: repoInfo.default_branch,
      branches: repoInfo.branches,
    };
  });

  // Get test files in a repository (with optional branch)
  app.get<{ Params: { owner: string; repo: string }; Querystring: { branch?: string } }>('/api/v1/github/repositories/:owner/:repo/tests', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { owner, repo } = request.params;
    const { branch } = request.query;

    if (!userGithubTokens.has(user.id)) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'GitHub account not connected',
      });
    }

    const fullName = `${owner}/${repo}`;
    const testFiles = branch ? getTestFilesForBranch(fullName, branch) : (demoTestFiles[fullName] || []);

    return {
      repository: fullName,
      branch: branch || 'default',
      test_files: testFiles,
      total: testFiles.length,
    };
  });

  // Connect a repository to a project
  app.post<{ Params: ProjectParams; Body: ConnectRepoBody }>('/api/v1/projects/:projectId/github/connect', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { projectId } = request.params;
    const { owner, repo, branch = 'main', test_path = 'tests' } = request.body;

    // Check if user has GitHub connected
    if (!userGithubTokens.has(user.id)) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'GitHub account not connected. Please connect your GitHub account first.',
      });
    }

    // Verify project exists and belongs to user's organization
    const project = await dbGetProject(projectId);
    if (!project) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Project not found',
      });
    }

    if (project.organization_id !== user.organization_id) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You do not have access to this project',
      });
    }

    // Check if already connected
    if (githubConnections.has(projectId)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'This project already has a GitHub repository connected. Disconnect first to connect a different repository.',
      });
    }

    // Validate repository exists in our demo list
    const fullName = `${owner}/${repo}`;
    const repoInfo = demoRepositories.find(r => r.full_name === fullName);
    if (!repoInfo) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Repository not found or you do not have access to it',
      });
    }

    // Create connection
    const connectionId = crypto.randomUUID();
    const connection: GitHubConnection = {
      id: connectionId,
      project_id: projectId,
      organization_id: user.organization_id,
      github_owner: owner,
      github_repo: repo,
      github_branch: branch || repoInfo.default_branch,
      test_path,
      connected_at: new Date(),
      connected_by: user.id,
    };

    githubConnections.set(projectId, connection);

    // Discover and import test files based on branch
    const selectedBranch = connection.github_branch;
    const testFiles = getTestFilesForBranch(fullName, selectedBranch);
    let importedCount = 0;

    if (testFiles.length > 0) {
      // Create a test suite for GitHub tests
      const suiteId = `github-${connectionId}`;
      await dbCreateTestSuite({
        id: suiteId,
        project_id: projectId,
        organization_id: user.organization_id,
        name: `GitHub: ${repo}`,
        description: `Imported from ${fullName}`,
        created_at: new Date(),
        updated_at: new Date(),
      });

      // Import test files as tests
      for (const testFile of testFiles) {
        const testId = `gh-${connectionId}-${importedCount}`;
        await dbCreateTest({
          id: testId,
          suite_id: suiteId,
          organization_id: user.organization_id,
          name: testFile.name.replace(/\.(spec|test)\.ts$/, ''),
          description: `Imported from ${testFile.path}`,
          test_type: 'e2e',
          status: 'active',
          steps: [
            {
              id: `step-${testId}-0`,
              action: 'run',
              selector: testFile.path,
              value: fullName,
              order: 0,
            }
          ],
          created_at: new Date(),
          updated_at: new Date(),
        });
        importedCount++;
      }
    }

    console.log(`
====================================
  GitHub Repository Connected
====================================
  Project: ${project.name}
  Repository: ${fullName}
  Branch: ${connection.github_branch}
  Test Path: ${test_path}
  Tests Imported: ${importedCount}
====================================
    `);

    return reply.status(201).send({
      connection: {
        id: connection.id,
        github_owner: connection.github_owner,
        github_repo: connection.github_repo,
        github_branch: connection.github_branch,
        test_path: connection.test_path,
        connected_at: connection.connected_at,
      },
      imported_tests: importedCount,
      message: `Repository connected successfully. ${importedCount} test file(s) discovered and imported.`,
    });
  });

  // Get GitHub connection for a project
  app.get<{ Params: ProjectParams }>('/api/v1/projects/:projectId/github', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { projectId } = request.params;

    // Verify project exists and user has access
    const project = await dbGetProject(projectId);
    if (!project) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Project not found',
      });
    }

    if (project.organization_id !== user.organization_id) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You do not have access to this project',
      });
    }

    const connection = githubConnections.get(projectId);
    if (!connection) {
      return {
        connected: false,
        connection: null,
      };
    }

    // Get test files for this connection based on branch
    const fullName = `${connection.github_owner}/${connection.github_repo}`;
    const testFiles = getTestFilesForBranch(fullName, connection.github_branch);

    // Get available branches for this repo
    const repoInfo = demoRepositories.find(r => r.full_name === fullName);
    const branches = repoInfo?.branches || [connection.github_branch];

    return {
      connected: true,
      connection: {
        id: connection.id,
        github_owner: connection.github_owner,
        github_repo: connection.github_repo,
        github_branch: connection.github_branch,
        test_path: connection.test_path,
        connected_at: connection.connected_at,
        last_synced_at: connection.last_synced_at,
      },
      branches: branches,
      test_files: testFiles,
    };
  });

  // Disconnect GitHub repository from project
  app.delete<{ Params: ProjectParams }>('/api/v1/projects/:projectId/github', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { projectId } = request.params;

    // Verify project exists and user has access
    const project = await dbGetProject(projectId);
    if (!project) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Project not found',
      });
    }

    if (project.organization_id !== user.organization_id) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You do not have access to this project',
      });
    }

    const connection = githubConnections.get(projectId);
    if (!connection) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'No GitHub repository connected to this project',
      });
    }

    // Remove the connection
    githubConnections.delete(projectId);

    console.log(`
====================================
  GitHub Repository Disconnected
====================================
  Project: ${project.name}
  Repository: ${connection.github_owner}/${connection.github_repo}
====================================
    `);

    return {
      message: 'GitHub repository disconnected successfully',
    };
  });

  // Sync/refresh test files from GitHub
  app.post<{ Params: ProjectParams }>('/api/v1/projects/:projectId/github/sync', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { projectId } = request.params;

    // Verify project exists and user has access
    const project = await dbGetProject(projectId);
    if (!project) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Project not found',
      });
    }

    if (project.organization_id !== user.organization_id) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You do not have access to this project',
      });
    }

    const connection = githubConnections.get(projectId);
    if (!connection) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'No GitHub repository connected to this project',
      });
    }

    // Update last synced timestamp
    connection.last_synced_at = new Date();
    githubConnections.set(projectId, connection);

    // Get test files (simulated refresh) based on branch
    const fullName = `${connection.github_owner}/${connection.github_repo}`;
    const testFiles = getTestFilesForBranch(fullName, connection.github_branch);

    console.log(`
====================================
  GitHub Repository Synced
====================================
  Project: ${project.name}
  Repository: ${fullName}
  Test Files Found: ${testFiles.length}
====================================
    `);

    return {
      message: 'Repository synced successfully',
      last_synced_at: connection.last_synced_at,
      test_files: testFiles,
      total: testFiles.length,
    };
  });

  // Change branch for GitHub connection
  app.patch<{ Params: ProjectParams; Body: { branch: string } }>('/api/v1/projects/:projectId/github/branch', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { projectId } = request.params;
    const { branch } = request.body;

    if (!branch) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Branch is required',
      });
    }

    // Verify project exists and user has access
    const project = await dbGetProject(projectId);
    if (!project) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Project not found',
      });
    }

    if (project.organization_id !== user.organization_id) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You do not have access to this project',
      });
    }

    const connection = githubConnections.get(projectId);
    if (!connection) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'No GitHub repository connected to this project',
      });
    }

    // Verify branch exists for this repo
    const fullName = `${connection.github_owner}/${connection.github_repo}`;
    const repoInfo = demoRepositories.find(r => r.full_name === fullName);
    if (!repoInfo || !repoInfo.branches.includes(branch)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: `Branch '${branch}' not found in repository`,
      });
    }

    const oldBranch = connection.github_branch;
    connection.github_branch = branch;
    connection.last_synced_at = new Date();
    githubConnections.set(projectId, connection);

    // Get test files for new branch
    const testFiles = getTestFilesForBranch(fullName, branch);

    console.log(`
====================================
  GitHub Branch Changed
====================================
  Project: ${project.name}
  Repository: ${fullName}
  Old Branch: ${oldBranch}
  New Branch: ${branch}
  Test Files Found: ${testFiles.length}
====================================
    `);

    return {
      message: `Branch changed from '${oldBranch}' to '${branch}' successfully`,
      connection: {
        id: connection.id,
        github_owner: connection.github_owner,
        github_repo: connection.github_repo,
        github_branch: connection.github_branch,
        test_path: connection.test_path,
        last_synced_at: connection.last_synced_at,
      },
      test_files: testFiles,
      total: testFiles.length,
    };
  });

  // Enable/disable PR status checks for a project
  app.patch<{ Params: ProjectParams; Body: { pr_checks_enabled: boolean } }>('/api/v1/projects/:projectId/github/pr-checks', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { projectId } = request.params;
    const { pr_checks_enabled } = request.body;

    const project = await dbGetProject(projectId);
    if (!project) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Project not found',
      });
    }

    if (project.organization_id !== user.organization_id) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You do not have access to this project',
      });
    }

    const connection = githubConnections.get(projectId);
    if (!connection) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'No GitHub repository connected to this project',
      });
    }

    connection.pr_checks_enabled = pr_checks_enabled;
    githubConnections.set(projectId, connection);

    console.log(`
====================================
  PR Status Checks ${pr_checks_enabled ? 'Enabled' : 'Disabled'}
====================================
  Project: ${project.name}
  Repository: ${connection.github_owner}/${connection.github_repo}
====================================
    `);

    return {
      message: `PR status checks ${pr_checks_enabled ? 'enabled' : 'disabled'} successfully`,
      pr_checks_enabled: connection.pr_checks_enabled,
    };
  });

  // Get open PRs for connected repository
  app.get<{ Params: ProjectParams }>('/api/v1/projects/:projectId/github/pull-requests', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { projectId } = request.params;

    const project = await dbGetProject(projectId);
    if (!project) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Project not found',
      });
    }

    if (project.organization_id !== user.organization_id) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You do not have access to this project',
      });
    }

    const connection = githubConnections.get(projectId);
    if (!connection) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'No GitHub repository connected to this project',
      });
    }

    const fullName = `${connection.github_owner}/${connection.github_repo}`;
    const pullRequests = demoPullRequests[fullName] || [];

    // Get status checks for each PR
    const projectChecks = prStatusChecks.get(projectId) || [];
    const prsWithStatus = pullRequests.map(pr => {
      const latestCheck = projectChecks
        .filter(c => c.pr_number === pr.number)
        .sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime())[0];

      return {
        ...pr,
        status_check: latestCheck || null,
      };
    });

    return {
      pull_requests: prsWithStatus,
      total: prsWithStatus.length,
      pr_checks_enabled: connection.pr_checks_enabled || false,
      pr_comments_enabled: connection.pr_comments_enabled || false,
    };
  });

  // Post a PR status check (simulated - in production this would call GitHub API)
  app.post<{ Params: ProjectParams & { prNumber: string }; Body: { status: PRStatusCheck['status']; description?: string; test_run_id?: string } }>('/api/v1/projects/:projectId/github/pull-requests/:prNumber/status', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { projectId, prNumber } = request.params;
    const { status, description, test_run_id } = request.body;

    const project = await dbGetProject(projectId);
    if (!project) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Project not found',
      });
    }

    if (project.organization_id !== user.organization_id) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You do not have access to this project',
      });
    }

    const connection = githubConnections.get(projectId);
    if (!connection) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'No GitHub repository connected to this project',
      });
    }

    if (!connection.pr_checks_enabled) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'PR status checks are not enabled for this project',
      });
    }

    const fullName = `${connection.github_owner}/${connection.github_repo}`;
    const pullRequests = demoPullRequests[fullName] || [];
    const pr = pullRequests.find(p => p.number === parseInt(prNumber));

    if (!pr) {
      return reply.status(404).send({
        error: 'Not Found',
        message: `Pull request #${prNumber} not found`,
      });
    }

    // Create or update status check
    const statusDescriptions: Record<PRStatusCheck['status'], string> = {
      pending: 'E2E & Visual tests queued',
      running: 'Running E2E & Visual tests...',
      success: 'All E2E & Visual tests passed',
      failure: 'E2E or Visual tests failed - merge blocked',
      error: 'Test execution error',
    };

    const statusCheck: PRStatusCheck = {
      id: `check-${Date.now()}`,
      project_id: projectId,
      pr_number: pr.number,
      pr_title: pr.title,
      head_sha: pr.head_sha,
      status,
      context: 'QA Guardian / E2E & Visual Tests',
      description: description || statusDescriptions[status],
      target_url: `http://localhost:5173/projects/${projectId}/runs/${test_run_id || 'latest'}`,
      created_at: new Date(),
      updated_at: new Date(),
      test_run_id,
    };

    // Store the status check
    if (!prStatusChecks.has(projectId)) {
      prStatusChecks.set(projectId, []);
    }
    prStatusChecks.get(projectId)!.push(statusCheck);

    console.log(`
====================================
  PR Status Check Posted
====================================
  Repository: ${fullName}
  PR #${pr.number}: ${pr.title}
  Status: ${status}
  Description: ${statusCheck.description}
  SHA: ${pr.head_sha}
====================================
    `);

    return reply.status(201).send({
      message: 'Status check posted successfully',
      status_check: statusCheck,
    });
  });

  // Get status check history for a PR
  app.get<{ Params: ProjectParams & { prNumber: string } }>('/api/v1/projects/:projectId/github/pull-requests/:prNumber/status', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { projectId, prNumber } = request.params;

    const project = await dbGetProject(projectId);
    if (!project) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Project not found',
      });
    }

    if (project.organization_id !== user.organization_id) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You do not have access to this project',
      });
    }

    const connection = githubConnections.get(projectId);
    if (!connection) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'No GitHub repository connected to this project',
      });
    }

    const projectChecks = prStatusChecks.get(projectId) || [];
    const prChecks = projectChecks
      .filter(c => c.pr_number === parseInt(prNumber))
      .sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime());

    return {
      pr_number: parseInt(prNumber),
      status_checks: prChecks,
      total: prChecks.length,
    };
  });

  // Enable/disable PR comments for a project
  app.patch<{ Params: ProjectParams; Body: { pr_comments_enabled: boolean } }>('/api/v1/projects/:projectId/github/pr-comments', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { projectId } = request.params;
    const { pr_comments_enabled } = request.body;

    const project = await dbGetProject(projectId);
    if (!project) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Project not found',
      });
    }

    if (project.organization_id !== user.organization_id) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You do not have access to this project',
      });
    }

    const connection = githubConnections.get(projectId);
    if (!connection) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'No GitHub repository connected to this project',
      });
    }

    connection.pr_comments_enabled = pr_comments_enabled;
    githubConnections.set(projectId, connection);

    console.log(`
====================================
  PR Comments ${pr_comments_enabled ? 'Enabled' : 'Disabled'}
====================================
  Project: ${project.name}
  Repository: ${connection.github_owner}/${connection.github_repo}
====================================
    `);

    return {
      message: `PR comments ${pr_comments_enabled ? 'enabled' : 'disabled'} successfully`,
      pr_comments_enabled: connection.pr_comments_enabled,
    };
  });

  // Post a PR comment with test results (simulated - in production this would call GitHub API)
  app.post<{ Params: ProjectParams & { prNumber: string }; Body: { passed: number; failed: number; skipped: number; test_run_id?: string } }>('/api/v1/projects/:projectId/github/pull-requests/:prNumber/comment', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { projectId, prNumber } = request.params;
    const { passed, failed, skipped, test_run_id } = request.body;

    const project = await dbGetProject(projectId);
    if (!project) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Project not found',
      });
    }

    if (project.organization_id !== user.organization_id) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You do not have access to this project',
      });
    }

    const connection = githubConnections.get(projectId);
    if (!connection) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'No GitHub repository connected to this project',
      });
    }

    if (!connection.pr_comments_enabled) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'PR comments are not enabled for this project',
      });
    }

    const fullName = `${connection.github_owner}/${connection.github_repo}`;
    const pullRequests = demoPullRequests[fullName] || [];
    const pr = pullRequests.find(p => p.number === parseInt(prNumber));

    if (!pr) {
      return reply.status(404).send({
        error: 'Not Found',
        message: `Pull request #${prNumber} not found`,
      });
    }

    const total = passed + failed + skipped;
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
    const status = failed === 0 ? 'All tests passed!' : `${failed} test(s) failed`;
    const resultsUrl = `http://localhost:5173/projects/${projectId}/runs/${test_run_id || 'latest'}`;

    // Generate comment body
    const commentBody = `## QA Guardian Test Results

${status}

| Metric | Count |
|--------|-------|
| Passed | ${passed} |
| Failed | ${failed} |
| Skipped | ${skipped} |
| **Total** | **${total}** |

**Pass Rate:** ${passRate}%

[View detailed results](${resultsUrl})

---
*Posted by [QA Guardian](http://localhost:5173)*`;

    const comment: PRComment = {
      id: `comment-${Date.now()}`,
      project_id: projectId,
      pr_number: pr.number,
      body: commentBody,
      results_url: resultsUrl,
      passed,
      failed,
      skipped,
      total,
      created_at: new Date(),
    };

    // Store the comment
    if (!prComments.has(projectId)) {
      prComments.set(projectId, []);
    }
    prComments.get(projectId)!.push(comment);

    console.log(`
====================================
  PR Comment Posted
====================================
  Repository: ${fullName}
  PR #${pr.number}: ${pr.title}
  Results: ${passed} passed, ${failed} failed, ${skipped} skipped
  Pass Rate: ${passRate}%
====================================
    `);

    return reply.status(201).send({
      message: 'Comment posted to PR successfully',
      comment: {
        id: comment.id,
        pr_number: comment.pr_number,
        passed: comment.passed,
        failed: comment.failed,
        skipped: comment.skipped,
        total: comment.total,
        results_url: comment.results_url,
        created_at: comment.created_at,
      },
    });
  });

  // Get PR comments for a project
  app.get<{ Params: ProjectParams & { prNumber: string } }>('/api/v1/projects/:projectId/github/pull-requests/:prNumber/comments', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { projectId, prNumber } = request.params;

    const project = await dbGetProject(projectId);
    if (!project) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Project not found',
      });
    }

    if (project.organization_id !== user.organization_id) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You do not have access to this project',
      });
    }

    const connection = githubConnections.get(projectId);
    if (!connection) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'No GitHub repository connected to this project',
      });
    }

    const projectComments = prComments.get(projectId) || [];
    const prCommentsForPR = projectComments
      .filter(c => c.pr_number === parseInt(prNumber))
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

    return {
      pr_number: parseInt(prNumber),
      comments: prCommentsForPR,
      total: prCommentsForPR.length,
    };
  });
}
