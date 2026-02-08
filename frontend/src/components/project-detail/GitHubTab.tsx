/**
 * GitHubTab - GitHub integration tab for ProjectDetailPage
 * Feature #49: Extracted to reduce ProjectDetailPage line count
 */
import React from 'react';
import {
 GitHubConnection,
 GitHubTestFile,
 PullRequest,
 PRDependencyScanResult,
 SlackChannel,
} from './types';

export interface GitHubTabProps {
 // Project info
 projectId: string;
 token: string | null;
 user: { organization_id?: string } | null;
 formatDate: (date: string) => string;

 // Slack channels (for future integrations)
 slackChannels: SlackChannel[];
 setSlackChannels: (channels: SlackChannel[]) => void;

 // GitHub state
 githubConnected: boolean;
 githubUsername: string | null;
 isConnectingGithub: boolean;
 githubConnection: GitHubConnection | null;
 githubTestFiles: GitHubTestFile[];
 isSyncingGithub: boolean;
 isDisconnectingRepo: boolean;
 isChangingBranch: boolean;
 availableBranches: string[];
 githubError: string;
 prChecksEnabled: boolean;
 isTogglingPRChecks: boolean;
 pullRequests: PullRequest[];
 prCommentsEnabled: boolean;
 isTogglingPRComments: boolean;

 // PR Dependency Scanning state
 prDependencyScanEnabled: boolean;
 isTogglingPRDependencyScan: boolean;
 prDependencyScanFiles: string[];
 prDependencyScanSeverity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
 prDependencyScanBlockOnCritical: boolean;
 isRunningPRDependencyScan: number | null;
 prDependencyScanResults: Record<number, PRDependencyScanResult>;

 // GitHub handlers
 handleConnectGithub: () => Promise<void>;
 handleDisconnectGithub: () => Promise<void>;
 handleOpenRepoSelect: () => Promise<void>;
 handleDisconnectRepo: () => Promise<void>;
 handleSyncRepo: () => Promise<void>;
 handleChangeBranch: (newBranch: string) => Promise<void>;
 handleTogglePRChecks: (enabled: boolean) => Promise<void>;
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

export const GitHubTab: React.FC<GitHubTabProps> = ({
 formatDate,
 githubConnected,
 githubUsername,
 isConnectingGithub,
 githubConnection,
 githubTestFiles,
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
 handleConnectGithub,
 handleDisconnectGithub,
 handleOpenRepoSelect,
 handleDisconnectRepo,
 handleSyncRepo,
 handleChangeBranch,
 handleTogglePRChecks,
 handlePostPRStatus,
 handleTogglePRComments,
 handlePostPRComment,
 handleTogglePRDependencyScan,
 handleUpdatePRDependencyScanConfig,
 handleTriggerPRDependencyScan,
}) => {
 return (
 <div className="mt-8 space-y-6">
 {/* GitHub Account Status */}
 <div className="rounded-lg border border-border bg-card p-6">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-4">
 <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
 <svg className="h-6 w-6 text-foreground" viewBox="0 0 24 24" fill="currentColor">
 <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
 </svg>
 </div>
 <div>
 <h2 className="text-lg font-semibold text-foreground">GitHub Account</h2>
 {githubConnected ? (
 <p className="text-sm text-green-600 flex items-center gap-1">
 <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
 <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
 </svg>
 Connected as {githubUsername}
 </p>
 ) : (
 <p className="text-sm text-muted-foreground">Connect your GitHub account to access repositories</p>
 )}
 </div>
 </div>
 {githubConnected ? (
 <button
 onClick={handleDisconnectGithub}
 className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
 >
 Disconnect
 </button>
 ) : (
 <button
 onClick={handleConnectGithub}
 disabled={isConnectingGithub}
 className="rounded-md bg-[#24292e] px-4 py-2 text-sm font-medium text-white hover:bg-[#24292e]/90 disabled:opacity-50"
 >
 {isConnectingGithub ? 'Connecting...' : 'Connect GitHub'}
 </button>
 )}
 </div>
 </div>

 {/* Repository Connection */}
 <div className="rounded-lg border border-border bg-card p-6">
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-lg font-semibold text-foreground">Repository</h2>
 {githubConnection && (
 <div className="flex items-center gap-2">
 <button
 onClick={handleSyncRepo}
 disabled={isSyncingGithub}
 className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
 >
 {isSyncingGithub ? 'Syncing...' : 'Sync'}
 </button>
 <button
 onClick={handleDisconnectRepo}
 disabled={isDisconnectingRepo}
 className="rounded-md border border-destructive/50 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
 >
 {isDisconnectingRepo ? 'Disconnecting...' : 'Disconnect'}
 </button>
 </div>
 )}
 </div>

 {githubError && (
 <div role="alert" className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
 {githubError}
 </div>
 )}

 {githubConnection ? (
 <div>
 {/* Connected Repository Info */}
 <div className="rounded-lg bg-muted/50 p-4">
 <div className="flex items-center gap-3">
 <svg className="h-8 w-8 text-foreground" viewBox="0 0 24 24" fill="currentColor">
 <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
 </svg>
 <div>
 <p className="font-semibold text-foreground">
 {githubConnection.github_owner}/{githubConnection.github_repo}
 </p>
 <p className="text-sm text-muted-foreground">
 Path: {githubConnection.test_path}
 </p>
 </div>
 </div>

 {/* Branch Selector */}
 <div className="mt-3 flex items-center gap-2">
 <label className="text-sm font-medium text-foreground">Branch:</label>
 <select
 value={githubConnection.github_branch}
 onChange={(e) => handleChangeBranch(e.target.value)}
 disabled={isChangingBranch}
 className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
 >
 {availableBranches.map((branch) => (
 <option key={branch} value={branch}>{branch}</option>
 ))}
 </select>
 {isChangingBranch && (
 <svg className="h-4 w-4 animate-spin text-muted-foreground" fill="none" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
 </svg>
 )}
 </div>

 {githubConnection.last_synced_at && (
 <p className="mt-2 text-xs text-muted-foreground">
 Last synced: {formatDate(githubConnection.last_synced_at)}
 </p>
 )}
 </div>

 {/* Test Files */}
 <div className="mt-4">
 <h3 className="text-sm font-semibold text-foreground mb-2">
 Discovered Test Files ({githubTestFiles.length})
 </h3>
 {githubTestFiles.length > 0 ? (
 <div className="space-y-1 max-h-64 overflow-y-auto">
 {githubTestFiles.map((file, index) => (
 <div key={index} className="flex items-center gap-2 rounded-md bg-muted/30 px-3 py-2 text-sm">
 <svg className="h-4 w-4 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
 </svg>
 <span className="text-foreground font-mono text-xs truncate">{file.path}</span>
 <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
 {file.type}
 </span>
 </div>
 ))}
 </div>
 ) : (
 <p className="text-sm text-muted-foreground">No test files found in this repository.</p>
 )}
 </div>

 {/* PR Status Checks */}
 <div className="mt-6 pt-4 border-t border-border">
 <div className="flex items-center justify-between mb-3">
 <h3 className="text-sm font-semibold text-foreground">PR Status Checks</h3>
 <label className="flex items-center gap-2 cursor-pointer">
 <input
 type="checkbox"
 checked={prChecksEnabled}
 onChange={(e) => handleTogglePRChecks(e.target.checked)}
 disabled={isTogglingPRChecks}
 className="h-4 w-4 rounded border-border text-primary focus:ring-primary disabled:opacity-50"
 />
 <span className="text-sm text-muted-foreground">
 {isTogglingPRChecks ? 'Updating...' : 'Enabled'}
 </span>
 </label>
 </div>

 {prChecksEnabled && (
 <div className="space-y-2">
 <p className="text-xs text-muted-foreground mb-2">
 QA Guardian will post status checks to pull requests including E2E and Visual test results.
 Visual test failures will block PR merging until regressions are fixed or baselines are approved.
 </p>

 {pullRequests.length > 0 ? (
 <div className="space-y-2 max-h-48 overflow-y-auto">
 {pullRequests.map((pr) => (
 <div key={pr.number} className="flex items-center gap-3 rounded-md bg-muted/30 px-3 py-2">
 <div className="flex-1 min-w-0">
 <p className="text-sm font-medium text-foreground truncate">
 #{pr.number}: {pr.title}
 </p>
 <p className="text-xs text-muted-foreground truncate">
 {pr.branch} - {pr.head_sha.substring(0, 7)}
 </p>
 </div>
 {pr.status_check ? (
 <span className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
 pr.status_check.status === 'success' ? 'bg-green-500/10 text-green-600' :
 pr.status_check.status === 'failure' ? 'bg-red-500/10 text-red-600' :
 pr.status_check.status === 'running' ? 'bg-blue-500/10 text-blue-600' :
 pr.status_check.status === 'pending' ? 'bg-yellow-500/10 text-yellow-600' :
 'bg-gray-500/10 text-foreground'
 }`}>
 {pr.status_check.status === 'running' && (
 <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
 </svg>
 )}
 {pr.status_check.status === 'success' && (
 <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
 <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
 </svg>
 )}
 {pr.status_check.status === 'failure' && (
 <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
 <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
 </svg>
 )}
 {pr.status_check.status}
 </span>
 ) : (
 <button
 onClick={() => handlePostPRStatus(pr.number, 'pending')}
 className="rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
 >
 Run Tests
 </button>
 )}
 </div>
 ))}
 </div>
 ) : (
 <p className="text-sm text-muted-foreground">No open pull requests found.</p>
 )}
 </div>
 )}
 </div>

 {/* PR Comments */}
 <div className="mt-6 pt-4 border-t border-border">
 <div className="flex items-center justify-between mb-3">
 <h3 className="text-sm font-semibold text-foreground">PR Comments</h3>
 <label className="flex items-center gap-2 cursor-pointer">
 <input
 type="checkbox"
 checked={prCommentsEnabled}
 onChange={(e) => handleTogglePRComments(e.target.checked)}
 disabled={isTogglingPRComments}
 className="h-4 w-4 rounded border-border text-primary focus:ring-primary disabled:opacity-50"
 />
 <span className="text-sm text-muted-foreground">
 {isTogglingPRComments ? 'Updating...' : 'Enabled'}
 </span>
 </label>
 </div>

 {prCommentsEnabled && (
 <div className="space-y-2">
 <p className="text-xs text-muted-foreground mb-2">
 QA Guardian will post test result comments to pull requests in this repository.
 </p>

 {pullRequests.length > 0 ? (
 <div className="space-y-2 max-h-48 overflow-y-auto">
 {pullRequests.map((pr) => (
 <div key={`comment-${pr.number}`} className="flex items-center gap-3 rounded-md bg-muted/30 px-3 py-2">
 <div className="flex-1 min-w-0">
 <p className="text-sm font-medium text-foreground truncate">
 #{pr.number}: {pr.title}
 </p>
 </div>
 <button
 onClick={() => handlePostPRComment(pr.number)}
 className="rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
 >
 Post Comment
 </button>
 </div>
 ))}
 </div>
 ) : (
 <p className="text-sm text-muted-foreground">No open pull requests found.</p>
 )}
 </div>
 )}
 </div>

 {/* Feature #768: PR Dependency Scanning */}
 <div className="mt-6 pt-4 border-t border-border">
 <div className="flex items-center justify-between mb-3">
 <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
 <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
 </svg>
 PR Dependency Scanning
 </h3>
 <label className="flex items-center gap-2 cursor-pointer">
 <input
 type="checkbox"
 checked={prDependencyScanEnabled}
 onChange={(e) => handleTogglePRDependencyScan(e.target.checked)}
 disabled={isTogglingPRDependencyScan}
 className="h-4 w-4 rounded border-border text-emerald-600 focus:ring-emerald-500 disabled:opacity-50"
 />
 <span className="text-sm text-muted-foreground">
 {isTogglingPRDependencyScan ? 'Updating...' : 'Enabled'}
 </span>
 </label>
 </div>

 {prDependencyScanEnabled && (
 <div className="space-y-4">
 <p className="text-xs text-muted-foreground mb-2">
 Automatically scan dependencies when package files change in a PR. Vulnerabilities will be flagged before merge.
 </p>

 {/* Watched Files */}
 <div>
 <label className="block text-xs font-medium text-foreground mb-1">Watch Files</label>
 <div className="flex flex-wrap gap-2">
 {['package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'].map((file) => (
 <label key={file} className="flex items-center gap-1.5 text-xs">
 <input
 type="checkbox"
 checked={prDependencyScanFiles.includes(file)}
 onChange={(e) => {
 const newFiles = e.target.checked
 ? [...prDependencyScanFiles, file]
 : prDependencyScanFiles.filter(f => f !== file);
 handleUpdatePRDependencyScanConfig({ pr_dependency_scan_files: newFiles });
 }}
 className="h-3 w-3 rounded border-border text-emerald-600 focus:ring-emerald-500"
 />
 <span className="text-muted-foreground font-mono">{file}</span>
 </label>
 ))}
 </div>
 </div>

 {/* Severity Threshold */}
 <div>
 <label className="block text-xs font-medium text-foreground mb-1">Minimum Severity to Report</label>
 <select
 value={prDependencyScanSeverity}
 onChange={(e) => handleUpdatePRDependencyScanConfig({ pr_dependency_scan_severity: e.target.value as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' })}
 className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground"
 >
 <option value="CRITICAL">Critical only</option>
 <option value="HIGH">High and above</option>
 <option value="MEDIUM">Medium and above</option>
 <option value="LOW">All vulnerabilities</option>
 </select>
 </div>

 {/* Block on Critical */}
 <div className="flex items-center gap-2">
 <input
 type="checkbox"
 id="block-on-critical"
 checked={prDependencyScanBlockOnCritical}
 onChange={(e) => handleUpdatePRDependencyScanConfig({ pr_dependency_scan_block_on_critical: e.target.checked })}
 className="h-4 w-4 rounded border-border text-red-600 focus:ring-red-500"
 />
 <label htmlFor="block-on-critical" className="text-sm text-foreground">
 Block PR merge on critical vulnerabilities
 </label>
 </div>

 {/* PR List with Scan Button */}
 {pullRequests.length > 0 && (
 <div className="mt-4">
 <label className="block text-xs font-medium text-foreground mb-2">Scan PRs for Dependencies</label>
 <div className="space-y-2 max-h-48 overflow-y-auto">
 {pullRequests.map((pr) => (
 <div key={`dep-${pr.number}`} className="flex items-center gap-3 rounded-md bg-muted/30 px-3 py-2">
 <div className="flex-1 min-w-0">
 <p className="text-sm font-medium text-foreground truncate">
 #{pr.number}: {pr.title}
 </p>
 <p className="text-xs text-muted-foreground">
 {pr.branch}
 </p>
 </div>
 {prDependencyScanResults[pr.number] ? (
 <div className="flex items-center gap-2">
 <span className={`text-xs font-medium px-2 py-1 rounded-full ${
 prDependencyScanResults[pr.number].summary.critical > 0
 ? 'bg-red-500/10 text-red-600'
 : prDependencyScanResults[pr.number].summary.high > 0
 ? 'bg-orange-500/10 text-orange-600'
 : prDependencyScanResults[pr.number].summary.total > 0
 ? 'bg-yellow-500/10 text-yellow-600'
 : 'bg-green-500/10 text-green-600'
 }`}>
 {prDependencyScanResults[pr.number].summary.total === 0
 ? 'Clean'
 : `${prDependencyScanResults[pr.number].summary.total} vuln${prDependencyScanResults[pr.number].summary.total !== 1 ? 's' : ''}`}
 </span>
 {prDependencyScanResults[pr.number].summary.new_in_pr > 0 && (
 <span className="text-xs text-red-500">
 +{prDependencyScanResults[pr.number].summary.new_in_pr} new
 </span>
 )}
 {prDependencyScanResults[pr.number].summary.fixed_in_pr > 0 && (
 <span className="text-xs text-green-500">
 -{prDependencyScanResults[pr.number].summary.fixed_in_pr} fixed
 </span>
 )}
 </div>
 ) : (
 <button
 onClick={() => handleTriggerPRDependencyScan(pr.number)}
 disabled={isRunningPRDependencyScan === pr.number}
 className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1"
 >
 {isRunningPRDependencyScan === pr.number ? (
 <>
 <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
 </svg>
 Scanning...
 </>
 ) : (
 <>
 <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
 </svg>
 Scan Dependencies
 </>
 )}
 </button>
 )}
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 )}
 </div>
 </div>
 ) : (
 <div className="rounded-lg border border-dashed border-border p-8 text-center">
 {githubConnected ? (
 <>
 <svg className="mx-auto h-12 w-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
 </svg>
 <h3 className="mt-4 text-lg font-semibold text-foreground">No Repository Connected</h3>
 <p className="mt-2 text-muted-foreground">
 Connect a GitHub repository to import and run Playwright tests.
 </p>
 <button
 onClick={handleOpenRepoSelect}
 className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
 >
 Connect Repository
 </button>
 </>
 ) : (
 <>
 <svg className="mx-auto h-12 w-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
 </svg>
 <h3 className="mt-4 text-lg font-semibold text-foreground">Connect GitHub First</h3>
 <p className="mt-2 text-muted-foreground">
 Connect your GitHub account above to access your repositories.
 </p>
 </>
 )}
 </div>
 )}
 </div>
 </div>
 );
};

export default GitHubTab;
