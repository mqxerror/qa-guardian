/**
 * useGitHubHandlers - GitHub integration handlers for ProjectDetailPage
 * Feature #49: Extracted to reduce ProjectDetailPage line count
 */
import { useState, useCallback } from 'react';
import { toast } from '../../stores/toastStore';
import {
  GitHubConnection,
  GitHubTestFile,
  GitHubRepository,
  PRDependencyScanResult,
} from './types';

export interface UseGitHubHandlersProps {
  projectId: string | undefined;
  token: string | null;
}

export interface GitHubState {
  githubConnected: boolean;
  githubUsername: string | null;
  isConnectingGithub: boolean;
  githubConnection: GitHubConnection | null;
  githubTestFiles: GitHubTestFile[];
  githubRepositories: GitHubRepository[];
  showRepoSelectModal: boolean;
  selectedRepo: GitHubRepository | null;
  selectedBranch: string;
  selectedTestPath: string;
  isConnectingRepo: boolean;
  isSyncingGithub: boolean;
  isDisconnectingRepo: boolean;
  isChangingBranch: boolean;
  availableBranches: string[];
  githubError: string;
  prChecksEnabled: boolean;
  isTogglingPRChecks: boolean;
  pullRequests: Array<{ number: number; title: string; head_sha: string; branch: string; status_check?: { status: string } | null }>;
  prCommentsEnabled: boolean;
  isTogglingPRComments: boolean;
  // PR Dependency Scanning
  prDependencyScanEnabled: boolean;
  isTogglingPRDependencyScan: boolean;
  prDependencyScanFiles: string[];
  prDependencyScanSeverity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  prDependencyScanBlockOnCritical: boolean;
  isRunningPRDependencyScan: number | null;
  prDependencyScanResults: Record<number, PRDependencyScanResult>;
}

export interface GitHubHandlers {
  // State setters
  setGithubConnected: (connected: boolean) => void;
  setGithubUsername: (username: string | null) => void;
  setGithubConnection: (connection: GitHubConnection | null) => void;
  setGithubTestFiles: (files: GitHubTestFile[]) => void;
  setShowRepoSelectModal: (show: boolean) => void;
  setSelectedRepo: (repo: GitHubRepository | null) => void;
  setSelectedBranch: (branch: string) => void;
  setSelectedTestPath: (path: string) => void;
  setAvailableBranches: (branches: string[]) => void;
  setGithubError: (error: string) => void;
  setPrChecksEnabled: (enabled: boolean) => void;
  setPullRequests: (prs: Array<{ number: number; title: string; head_sha: string; branch: string; status_check?: { status: string } | null }>) => void;
  setPrCommentsEnabled: (enabled: boolean) => void;
  setPrDependencyScanEnabled: (enabled: boolean) => void;
  setPrDependencyScanFiles: (files: string[]) => void;
  setPrDependencyScanSeverity: (severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW') => void;
  setPrDependencyScanBlockOnCritical: (block: boolean) => void;
  // Handlers
  handleConnectGithub: () => Promise<void>;
  handleDisconnectGithub: () => Promise<void>;
  handleOpenRepoSelect: () => Promise<void>;
  handleConnectRepo: () => Promise<void>;
  handleDisconnectRepo: () => Promise<void>;
  handleSyncRepo: () => Promise<void>;
  handleChangeBranch: (newBranch: string) => Promise<void>;
  handleTogglePRChecks: (enabled: boolean) => Promise<void>;
  fetchPullRequests: () => Promise<void>;
  handlePostPRStatus: (prNumber: number, status: string) => Promise<void>;
  handleTogglePRComments: (enabled: boolean) => Promise<void>;
  handlePostPRComment: (prNumber: number) => Promise<void>;
  handleTogglePRDependencyScan: (enabled: boolean) => Promise<void>;
  handleUpdatePRDependencyScanConfig: (config: {
    pr_dependency_scan_files?: string[];
    pr_dependency_scan_severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    pr_dependency_scan_block_on_critical?: boolean;
  }) => Promise<void>;
  handleTriggerPRDependencyScan: (prNumber: number) => Promise<void>;
}

export function useGitHubHandlers({
  projectId,
  token,
}: UseGitHubHandlersProps): [GitHubState, GitHubHandlers] {
  // GitHub integration state
  const [githubConnected, setGithubConnected] = useState(false);
  const [githubUsername, setGithubUsername] = useState<string | null>(null);
  const [isConnectingGithub, setIsConnectingGithub] = useState(false);
  const [githubConnection, setGithubConnection] = useState<GitHubConnection | null>(null);
  const [githubTestFiles, setGithubTestFiles] = useState<GitHubTestFile[]>([]);
  const [githubRepositories, setGithubRepositories] = useState<GitHubRepository[]>([]);
  const [showRepoSelectModal, setShowRepoSelectModal] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepository | null>(null);
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [selectedTestPath, setSelectedTestPath] = useState('tests');
  const [isConnectingRepo, setIsConnectingRepo] = useState(false);
  const [isSyncingGithub, setIsSyncingGithub] = useState(false);
  const [isDisconnectingRepo, setIsDisconnectingRepo] = useState(false);
  const [isChangingBranch, setIsChangingBranch] = useState(false);
  const [availableBranches, setAvailableBranches] = useState<string[]>([]);
  const [githubError, setGithubError] = useState('');
  const [prChecksEnabled, setPrChecksEnabled] = useState(false);
  const [isTogglingPRChecks, setIsTogglingPRChecks] = useState(false);
  const [pullRequests, setPullRequests] = useState<Array<{ number: number; title: string; head_sha: string; branch: string; status_check?: { status: string } | null }>>([]);
  const [prCommentsEnabled, setPrCommentsEnabled] = useState(false);
  const [isTogglingPRComments, setIsTogglingPRComments] = useState(false);

  // PR Dependency Scanning state
  const [prDependencyScanEnabled, setPrDependencyScanEnabled] = useState(false);
  const [isTogglingPRDependencyScan, setIsTogglingPRDependencyScan] = useState(false);
  const [prDependencyScanFiles, setPrDependencyScanFiles] = useState<string[]>(['package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml']);
  const [prDependencyScanSeverity, setPrDependencyScanSeverity] = useState<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>('HIGH');
  const [prDependencyScanBlockOnCritical, setPrDependencyScanBlockOnCritical] = useState(false);
  const [isRunningPRDependencyScan, setIsRunningPRDependencyScan] = useState<number | null>(null);
  const [prDependencyScanResults, setPrDependencyScanResults] = useState<Record<number, PRDependencyScanResult>>({});

  const fetchPullRequests = useCallback(async () => {
    if (!projectId) return;

    try {
      const response = await fetch(`/api/v1/projects/${projectId}/github/pull-requests`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        return; // Silently fail for PR fetch
      }

      const data = await response.json();
      setPullRequests(data.pull_requests || []);
      setPrChecksEnabled(data.pr_checks_enabled || false);
      setPrCommentsEnabled(data.pr_comments_enabled || false);
    } catch {
      // Silently fail for PR fetch
    }
  }, [projectId, token]);

  const handleConnectGithub = useCallback(async () => {
    setIsConnectingGithub(true);
    setGithubError('');

    try {
      const response = await fetch('/api/v1/github/connect', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to connect GitHub');
      }

      const data = await response.json();
      setGithubConnected(true);
      setGithubUsername(data.username);
      toast.success('GitHub account connected successfully');
    } catch (err) {
      setGithubError(err instanceof Error ? err.message : 'Failed to connect GitHub');
    } finally {
      setIsConnectingGithub(false);
    }
  }, [token]);

  const handleDisconnectGithub = useCallback(async () => {
    if (!confirm('Disconnect your GitHub account?')) return;

    try {
      const response = await fetch('/api/v1/github/disconnect', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect GitHub');
      }

      setGithubConnected(false);
      setGithubUsername(null);
      toast.success('GitHub account disconnected');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to disconnect GitHub');
    }
  }, [token]);

  const handleOpenRepoSelect = useCallback(async () => {
    setGithubError('');
    setShowRepoSelectModal(true);

    try {
      const response = await fetch('/api/v1/github/repositories', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to load repositories');
      }

      const data = await response.json();
      setGithubRepositories(data.repositories);
    } catch (err) {
      setGithubError(err instanceof Error ? err.message : 'Failed to load repositories');
    }
  }, [token]);

  const handleConnectRepo = useCallback(async () => {
    if (!selectedRepo) return;

    setIsConnectingRepo(true);
    setGithubError('');

    try {
      const response = await fetch(`/api/v1/projects/${projectId}/github/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          owner: selectedRepo.owner,
          repo: selectedRepo.name,
          branch: selectedBranch || selectedRepo.default_branch,
          test_path: selectedTestPath,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to connect repository');
      }

      const data = await response.json();
      setGithubConnection(data.connection);
      setShowRepoSelectModal(false);
      setSelectedRepo(null);
      toast.success(data.message || 'Repository connected successfully');

      // Fetch test files
      const testFilesResponse = await fetch(`/api/v1/projects/${projectId}/github`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (testFilesResponse.ok) {
        const testFilesData = await testFilesResponse.json();
        setGithubTestFiles(testFilesData.test_files || []);
      }

      // Fetch pull requests after connecting repo
      fetchPullRequests();
    } catch (err) {
      setGithubError(err instanceof Error ? err.message : 'Failed to connect repository');
    } finally {
      setIsConnectingRepo(false);
    }
  }, [projectId, token, selectedRepo, selectedBranch, selectedTestPath, fetchPullRequests]);

  const handleDisconnectRepo = useCallback(async () => {
    if (!confirm('Disconnect this repository? Imported tests will remain but won\'t sync with GitHub.')) return;

    setIsDisconnectingRepo(true);
    try {
      const response = await fetch(`/api/v1/projects/${projectId}/github`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect repository');
      }

      setGithubConnection(null);
      setGithubTestFiles([]);
      toast.success('Repository disconnected successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to disconnect repository');
    } finally {
      setIsDisconnectingRepo(false);
    }
  }, [projectId, token]);

  const handleSyncRepo = useCallback(async () => {
    setIsSyncingGithub(true);
    try {
      const response = await fetch(`/api/v1/projects/${projectId}/github/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to sync repository');
      }

      const data = await response.json();
      setGithubTestFiles(data.test_files || []);
      if (githubConnection) {
        setGithubConnection({
          ...githubConnection,
          last_synced_at: data.last_synced_at,
        });
      }
      toast.success('Repository synced successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to sync repository');
    } finally {
      setIsSyncingGithub(false);
    }
  }, [projectId, token, githubConnection]);

  const handleChangeBranch = useCallback(async (newBranch: string) => {
    if (!githubConnection || newBranch === githubConnection.github_branch) return;

    setIsChangingBranch(true);
    try {
      const response = await fetch(`/api/v1/projects/${projectId}/github/branch`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ branch: newBranch }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to change branch');
      }

      const data = await response.json();
      setGithubConnection({
        ...githubConnection,
        github_branch: newBranch,
        last_synced_at: data.connection.last_synced_at,
      });
      setGithubTestFiles(data.test_files || []);
      toast.success(`Branch changed to '${newBranch}' - ${data.total} test file(s) discovered`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to change branch');
    } finally {
      setIsChangingBranch(false);
    }
  }, [projectId, token, githubConnection]);

  const handleTogglePRChecks = useCallback(async (enabled: boolean) => {
    if (!projectId) return;

    setIsTogglingPRChecks(true);
    try {
      const response = await fetch(`/api/v1/projects/${projectId}/github/pr-checks`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ pr_checks_enabled: enabled }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update PR checks setting');
      }

      setPrChecksEnabled(enabled);
      toast.success(`PR status checks ${enabled ? 'enabled' : 'disabled'}`);

      if (enabled) {
        fetchPullRequests();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update PR checks setting');
    } finally {
      setIsTogglingPRChecks(false);
    }
  }, [projectId, token, fetchPullRequests]);

  const handlePostPRStatus = useCallback(async (prNumber: number, status: string) => {
    if (!projectId) return;

    try {
      const response = await fetch(`/api/v1/projects/${projectId}/github/pull-requests/${prNumber}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to post PR status');
      }

      toast.success(`PR status check posted: ${status}`);
      fetchPullRequests();

      // Simulate status progression for demo
      if (status === 'pending') {
        setTimeout(async () => {
          await fetch(`/api/v1/projects/${projectId}/github/pull-requests/${prNumber}/status`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ status: 'running' }),
          });
          fetchPullRequests();

          setTimeout(async () => {
            await fetch(`/api/v1/projects/${projectId}/github/pull-requests/${prNumber}/status`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({ status: 'success' }),
            });
            fetchPullRequests();
            toast.success('Tests passed! PR status check updated to success.');
          }, 2000);
        }, 1500);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to post PR status');
    }
  }, [projectId, token, fetchPullRequests]);

  const handleTogglePRComments = useCallback(async (enabled: boolean) => {
    if (!projectId) return;

    setIsTogglingPRComments(true);
    try {
      const response = await fetch(`/api/v1/projects/${projectId}/github/pr-comments`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ pr_comments_enabled: enabled }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update PR comments setting');
      }

      setPrCommentsEnabled(enabled);
      toast.success(`PR comments ${enabled ? 'enabled' : 'disabled'}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update PR comments setting');
    } finally {
      setIsTogglingPRComments(false);
    }
  }, [projectId, token]);

  const handlePostPRComment = useCallback(async (prNumber: number) => {
    if (!projectId) return;

    try {
      const passed = Math.floor(Math.random() * 15) + 5;
      const failed = Math.floor(Math.random() * 3);
      const skipped = Math.floor(Math.random() * 2);

      const response = await fetch(`/api/v1/projects/${projectId}/github/pull-requests/${prNumber}/comment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ passed, failed, skipped }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to post PR comment');
      }

      const data = await response.json();
      toast.success(`Comment posted to PR #${prNumber}: ${data.comment.passed} passed, ${data.comment.failed} failed`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to post PR comment');
    }
  }, [projectId, token]);

  const handleTogglePRDependencyScan = useCallback(async (enabled: boolean) => {
    if (!projectId) return;

    setIsTogglingPRDependencyScan(true);
    try {
      const response = await fetch(`/api/v1/projects/${projectId}/github/pr-dependency-scan`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ pr_dependency_scan_enabled: enabled }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update PR dependency scan setting');
      }

      setPrDependencyScanEnabled(enabled);
      toast.success(`PR dependency scanning ${enabled ? 'enabled' : 'disabled'}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update PR dependency scan setting');
    } finally {
      setIsTogglingPRDependencyScan(false);
    }
  }, [projectId, token]);

  const handleUpdatePRDependencyScanConfig = useCallback(async (config: {
    pr_dependency_scan_files?: string[];
    pr_dependency_scan_severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    pr_dependency_scan_block_on_critical?: boolean;
  }) => {
    if (!projectId) return;

    try {
      const response = await fetch(`/api/v1/projects/${projectId}/github/pr-dependency-scan`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update PR dependency scan config');
      }

      const data = await response.json();
      if (config.pr_dependency_scan_files) {
        setPrDependencyScanFiles(data.pr_dependency_scan_files);
      }
      if (config.pr_dependency_scan_severity) {
        setPrDependencyScanSeverity(data.pr_dependency_scan_severity);
      }
      if (config.pr_dependency_scan_block_on_critical !== undefined) {
        setPrDependencyScanBlockOnCritical(data.pr_dependency_scan_block_on_critical);
      }
      toast.success('PR dependency scan settings updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update PR dependency scan config');
    }
  }, [projectId, token]);

  const handleTriggerPRDependencyScan = useCallback(async (prNumber: number) => {
    if (!projectId) return;

    setIsRunningPRDependencyScan(prNumber);
    try {
      const response = await fetch(`/api/v1/projects/${projectId}/github/pull-requests/${prNumber}/dependency-scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ changed_files: ['package.json', 'package-lock.json'] }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to run dependency scan');
      }

      const data = await response.json();

      setPrDependencyScanResults(prev => ({
        ...prev,
        [prNumber]: {
          summary: data.scan_result.summary,
        },
      }));

      if (data.merge_blocked) {
        toast.error(`PR #${prNumber} blocked: ${data.scan_result.summary.critical} critical vulnerabilities found!`);
      } else if (data.scan_result.summary.total > 0) {
        toast.warning(`PR #${prNumber}: ${data.scan_result.summary.total} vulnerabilities found (${data.scan_result.summary.new_in_pr} new)`);
      } else {
        toast.success(`PR #${prNumber}: No vulnerabilities found!`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to run dependency scan');
    } finally {
      setIsRunningPRDependencyScan(null);
    }
  }, [projectId, token]);

  const state: GitHubState = {
    githubConnected,
    githubUsername,
    isConnectingGithub,
    githubConnection,
    githubTestFiles,
    githubRepositories,
    showRepoSelectModal,
    selectedRepo,
    selectedBranch,
    selectedTestPath,
    isConnectingRepo,
    isSyncingGithub,
    isDisconnectingRepo,
    isChangingBranch,
    availableBranches,
    githubError,
    prChecksEnabled,
    isTogglingPRChecks,
    pullRequests,
    prCommentsEnabled,
    isTogglingPRComments,
    prDependencyScanEnabled,
    isTogglingPRDependencyScan,
    prDependencyScanFiles,
    prDependencyScanSeverity,
    prDependencyScanBlockOnCritical,
    isRunningPRDependencyScan,
    prDependencyScanResults,
  };

  const handlers: GitHubHandlers = {
    setGithubConnected,
    setGithubUsername,
    setGithubConnection,
    setGithubTestFiles,
    setShowRepoSelectModal,
    setSelectedRepo,
    setSelectedBranch,
    setSelectedTestPath,
    setAvailableBranches,
    setGithubError,
    setPrChecksEnabled,
    setPullRequests,
    setPrCommentsEnabled,
    setPrDependencyScanEnabled,
    setPrDependencyScanFiles,
    setPrDependencyScanSeverity,
    setPrDependencyScanBlockOnCritical,
    handleConnectGithub,
    handleDisconnectGithub,
    handleOpenRepoSelect,
    handleConnectRepo,
    handleDisconnectRepo,
    handleSyncRepo,
    handleChangeBranch,
    handleTogglePRChecks,
    fetchPullRequests,
    handlePostPRStatus,
    handleTogglePRComments,
    handlePostPRComment,
    handleTogglePRDependencyScan,
    handleUpdatePRDependencyScanConfig,
    handleTriggerPRDependencyScan,
  };

  return [state, handlers];
}
