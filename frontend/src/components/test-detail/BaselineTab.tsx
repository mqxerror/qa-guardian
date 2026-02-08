// Feature #48: Extracted BaselineTab component from TestDetailPage.tsx
// Displays visual regression baseline management, history, and merge options
import React from 'react';

interface BaselineData {
 hasBaseline: boolean;
 image?: string;
 createdAt?: string;
 size?: number;
 approvedBy?: string;
 approvedByUserId?: string;
 approvedAt?: string;
 sourceRunId?: string;
}

interface BaselineHistoryEntry {
 id: string;
 testId: string;
 viewportId: string;
 version: number;
 approvedBy: string;
 approvedByUserId: string;
 approvedAt: string;
 sourceRunId?: string;
 filename: string;
}

interface MergeableBranch {
 branch: string;
 updatedAt: string;
 approvedBy?: string;
 isNewer?: boolean;
}

interface BaselineTabProps {
 testId: string;
 selectedBranch: string;
 availableBranches: string[];
 loadingBaseline: boolean;
 baselineData: BaselineData | null;
 isRunning: boolean;
 mergeableBranches: MergeableBranch[];
 baselineHistory: BaselineHistoryEntry[];
 loadingBaselineHistory: boolean;
 selectedHistoryVersion: string | null;
 historyVersionImage: string | null;
 loadingHistoryImage: boolean;
 onRunTest: () => void;
 onSetSelectedMergeBranch: (branch: string) => void;
 onSetShowMergeBaselineModal: (show: boolean) => void;
 onSetLightboxImage: (image: string) => void;
 onSetSelectedHistoryVersion: (id: string | null) => void;
 onSetHistoryVersionImage: (image: string | null) => void;
 onSetRestoreHistoryEntry: (entry: { id: string; version: number } | null) => void;
 onSetShowRestoreBaselineModal: (show: boolean) => void;
 onSetRestoreBaselineError: (error: string) => void;
}

// Loading spinner component
function LoadingSpinner({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
 const sizeClasses = {
 sm: 'h-4 w-4',
 md: 'h-6 w-6',
 lg: 'h-8 w-8',
 };
 return (
 <svg className={`animate-spin ${sizeClasses[size]} text-primary ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
 </svg>
 );
}

// Branch icon SVG
function BranchIcon({ className = '' }: { className?: string }) {
 return (
 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
 <line x1="6" y1="3" x2="6" y2="15"/>
 <circle cx="18" cy="6" r="3"/>
 <circle cx="6" cy="18" r="3"/>
 <path d="M18 9a9 9 0 0 1-9 9"/>
 </svg>
 );
}

// Merge icon SVG
function MergeIcon({ className = '' }: { className?: string }) {
 return (
 <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
 <circle cx="18" cy="18" r="3"/>
 <circle cx="6" cy="6" r="3"/>
 <path d="M6 21V9a9 9 0 0 0 9 9"/>
 </svg>
 );
}

// No baseline state component
function NoBaselineState({
 selectedBranch,
 isRunning,
 mergeableBranches,
 onRunTest,
 onSetSelectedMergeBranch,
 onSetShowMergeBaselineModal,
}: {
 selectedBranch: string;
 isRunning: boolean;
 mergeableBranches: MergeableBranch[];
 onRunTest: () => void;
 onSetSelectedMergeBranch: (branch: string) => void;
 onSetShowMergeBaselineModal: (show: boolean) => void;
}) {
 return (
 <div className="text-center py-12">
 <div className="text-4xl mb-4">📷</div>
 <h3 className="text-lg font-semibold text-foreground mb-2">No Baseline on Branch '{selectedBranch}'</h3>
 <p className="text-muted-foreground max-w-md mx-auto">
 Run this visual regression test once on branch '{selectedBranch}' to capture the initial baseline screenshot.
 Each branch can have its own independent baseline.
 </p>
 <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
 <button
 onClick={onRunTest}
 disabled={isRunning}
 className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
 >
 {isRunning ? (
 <>
 <LoadingSpinner size="sm" />
 Running...
 </>
 ) : (
 <>▶ Run Test to Create Baseline</>
 )}
 </button>
 </div>

 {/* Show merge option if there are mergeable baselines from other branches */}
 {mergeableBranches.length > 0 && (
 <div className="mt-8 p-4 border border-primary/30 bg-primary/5 rounded-lg max-w-lg mx-auto">
 <div className="flex items-center gap-2 text-primary mb-2">
 <MergeIcon />
 <span className="font-medium">Baselines Available from Other Branches</span>
 </div>
 <p className="text-sm text-muted-foreground mb-3">
 You can merge a baseline from another branch instead of creating a new one:
 </p>
 <div className="space-y-2">
 {mergeableBranches.slice(0, 3).map((branch) => (
 <button
 key={branch.branch}
 onClick={() => {
 onSetSelectedMergeBranch(branch.branch);
 onSetShowMergeBaselineModal(true);
 }}
 className="w-full flex items-center justify-between gap-2 p-2 rounded border border-border bg-background hover:bg-muted/50 transition-colors text-sm"
 >
 <span className="flex items-center gap-2">
 <BranchIcon />
 <span className="font-medium text-foreground">{branch.branch}</span>
 </span>
 <span className="text-xs text-muted-foreground">
 {branch.approvedBy && `by ${branch.approvedBy} • `}
 {new Date(branch.updatedAt).toLocaleDateString()}
 </span>
 </button>
 ))}
 </div>
 {mergeableBranches.length > 3 && (
 <p className="text-xs text-muted-foreground mt-2 text-center">
 +{mergeableBranches.length - 3} more branch(es) available
 </p>
 )}
 </div>
 )}
 </div>
 );
}

// Baseline history table component
function BaselineHistoryTable({
 baselineHistory,
 loadingBaselineHistory,
 selectedHistoryVersion,
 historyVersionImage,
 loadingHistoryImage,
 onSetSelectedHistoryVersion,
 onSetHistoryVersionImage,
 onSetRestoreHistoryEntry,
 onSetShowRestoreBaselineModal,
 onSetRestoreBaselineError,
 onSetLightboxImage,
}: {
 baselineHistory: BaselineHistoryEntry[];
 loadingBaselineHistory: boolean;
 selectedHistoryVersion: string | null;
 historyVersionImage: string | null;
 loadingHistoryImage: boolean;
 onSetSelectedHistoryVersion: (id: string | null) => void;
 onSetHistoryVersionImage: (image: string | null) => void;
 onSetRestoreHistoryEntry: (entry: { id: string; version: number } | null) => void;
 onSetShowRestoreBaselineModal: (show: boolean) => void;
 onSetRestoreBaselineError: (error: string) => void;
 onSetLightboxImage: (image: string) => void;
}) {
 if (loadingBaselineHistory) {
 return (
 <div className="flex items-center justify-center py-8">
 <LoadingSpinner size="md" />
 <span className="ml-2 text-muted-foreground">Loading history...</span>
 </div>
 );
 }

 if (baselineHistory.length === 0) {
 return (
 <div className="text-center py-8 text-muted-foreground">
 <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2 opacity-50">
 <circle cx="12" cy="12" r="10"/>
 <polyline points="12 6 12 12 16 14"/>
 </svg>
 <p>No baseline history yet.</p>
 <p className="text-sm">Approve baselines to build version history.</p>
 </div>
 );
 }

 return (
 <div className="space-y-4">
 <div className="border border-border rounded-lg overflow-hidden">
 <table className="w-full text-sm">
 <thead className="bg-muted/50">
 <tr>
 <th className="text-left px-4 py-2 font-medium text-foreground">Version</th>
 <th className="text-left px-4 py-2 font-medium text-foreground">Approved By</th>
 <th className="text-left px-4 py-2 font-medium text-foreground">Date</th>
 <th className="text-left px-4 py-2 font-medium text-foreground">Actions</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-border">
 {baselineHistory.map((entry, index) => (
 <tr key={entry.id} className={`hover:bg-muted/30 ${index === 0 ? 'bg-success/5' : ''}`}>
 <td className="px-4 py-3">
 <span className={`inline-flex items-center gap-1.5 ${index === 0 ? 'text-success font-medium' : 'text-foreground'}`}>
 {index === 0 && (
 <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-success text-white text-xs">✓</span>
 )}
 v{entry.version}
 {index === 0 && <span className="text-xs text-success">(Current)</span>}
 </span>
 </td>
 <td className="px-4 py-3">
 <span className="inline-flex items-center gap-1.5 text-muted-foreground">
 <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
 <circle cx="12" cy="7" r="4"/>
 </svg>
 {entry.approvedBy}
 </span>
 </td>
 <td className="px-4 py-3 text-muted-foreground">
 {new Date(entry.approvedAt).toLocaleString()}
 </td>
 <td className="px-4 py-3">
 <div className="flex items-center gap-2">
 <button
 onClick={() => {
 if (selectedHistoryVersion === entry.id) {
 onSetSelectedHistoryVersion(null);
 onSetHistoryVersionImage(null);
 } else {
 onSetSelectedHistoryVersion(entry.id);
 }
 }}
 className={`inline-flex items-center gap-1 text-sm ${
 selectedHistoryVersion === entry.id
 ? 'text-primary font-medium'
 : 'text-muted-foreground hover:text-foreground'
 }`}
 >
 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
 <circle cx="12" cy="12" r="3"/>
 </svg>
 {selectedHistoryVersion === entry.id ? 'Hide' : 'View'}
 </button>
 {/* Only show Restore button for non-current versions */}
 {index > 0 && (
 <button
 onClick={() => {
 onSetRestoreHistoryEntry({ id: entry.id, version: entry.version });
 onSetShowRestoreBaselineModal(true);
 onSetRestoreBaselineError('');
 }}
 className="inline-flex items-center gap-1 text-sm text-warning hover:text-warning"
 title="Restore this version as the current baseline"
 >
 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
 <path d="M3 3v5h5"/>
 </svg>
 Restore
 </button>
 )}
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>

 {/* Selected History Version Preview */}
 {selectedHistoryVersion && (
 <div className="border border-border rounded-lg p-4 bg-muted/20">
 <div className="flex items-center justify-between mb-3">
 <h4 className="font-medium text-foreground">
 Version {baselineHistory.find(h => h.id === selectedHistoryVersion)?.version} Preview
 </h4>
 <button
 onClick={() => {
 onSetSelectedHistoryVersion(null);
 onSetHistoryVersionImage(null);
 }}
 className="text-muted-foreground hover:text-foreground"
 >
 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <line x1="18" y1="6" x2="6" y2="18"/>
 <line x1="6" y1="6" x2="18" y2="18"/>
 </svg>
 </button>
 </div>
 {loadingHistoryImage ? (
 <div className="flex items-center justify-center py-12">
 <LoadingSpinner size="md" />
 <span className="ml-2 text-muted-foreground">Loading image...</span>
 </div>
 ) : historyVersionImage ? (
 <div className="border border-border rounded overflow-hidden">
 <img
 src={`data:image/png;base64,${historyVersionImage}`}
 alt={`Baseline version ${baselineHistory.find(h => h.id === selectedHistoryVersion)?.version}`}
 className="w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
 onClick={() => onSetLightboxImage(`data:image/png;base64,${historyVersionImage}`)}
 />
 </div>
 ) : (
 <div className="text-center py-8 text-muted-foreground">
 <p>Failed to load image</p>
 </div>
 )}
 </div>
 )}
 </div>
 );
}

// Current baseline display component
function CurrentBaselineDisplay({
 testId,
 baselineData,
 mergeableBranches,
 baselineHistory,
 loadingBaselineHistory,
 selectedHistoryVersion,
 historyVersionImage,
 loadingHistoryImage,
 onSetSelectedMergeBranch,
 onSetShowMergeBaselineModal,
 onSetLightboxImage,
 onSetSelectedHistoryVersion,
 onSetHistoryVersionImage,
 onSetRestoreHistoryEntry,
 onSetShowRestoreBaselineModal,
 onSetRestoreBaselineError,
}: {
 testId: string;
 baselineData: BaselineData;
 mergeableBranches: MergeableBranch[];
 baselineHistory: BaselineHistoryEntry[];
 loadingBaselineHistory: boolean;
 selectedHistoryVersion: string | null;
 historyVersionImage: string | null;
 loadingHistoryImage: boolean;
 onSetSelectedMergeBranch: (branch: string) => void;
 onSetShowMergeBaselineModal: (show: boolean) => void;
 onSetLightboxImage: (image: string) => void;
 onSetSelectedHistoryVersion: (id: string | null) => void;
 onSetHistoryVersionImage: (image: string | null) => void;
 onSetRestoreHistoryEntry: (entry: { id: string; version: number } | null) => void;
 onSetShowRestoreBaselineModal: (show: boolean) => void;
 onSetRestoreBaselineError: (error: string) => void;
}) {
 return (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <div>
 <h3 className="text-lg font-semibold text-foreground">Current Baseline</h3>
 <p className="text-sm text-muted-foreground">
 Created: {baselineData.createdAt ? new Date(baselineData.createdAt).toLocaleString() : 'Unknown'}
 {baselineData.size && <span className="ml-2">• Size: {(baselineData.size / 1024).toFixed(1)} KB</span>}
 </p>
 {baselineData.approvedBy && (
 <p className="text-sm text-muted-foreground mt-1">
 <span className="inline-flex items-center gap-1">
 <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
 <circle cx="12" cy="7" r="4"/>
 </svg>
 Approved by: {baselineData.approvedBy}
 </span>
 {baselineData.approvedAt && (
 <span className="ml-2">• {new Date(baselineData.approvedAt).toLocaleString()}</span>
 )}
 </p>
 )}
 </div>
 <div className="flex items-center gap-2">
 <a
 href={`/api/v1/tests/${testId}/baseline`}
 download={`baseline-${testId}.png`}
 className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
 >
 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
 <polyline points="7 10 12 15 17 10"/>
 <line x1="12" y1="15" x2="12" y2="3"/>
 </svg>
 Download
 </a>
 </div>
 </div>

 {baselineData.image && (
 <div className="border border-border rounded-lg overflow-hidden bg-muted/30">
 <img
 src={`data:image/png;base64,${baselineData.image}`}
 alt="Baseline screenshot"
 className="w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
 onClick={() => onSetLightboxImage(`data:image/png;base64,${baselineData.image}`)}
 />
 </div>
 )}

 <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
 <p className="font-medium text-foreground mb-1">💡 About Visual Baselines</p>
 <ul className="list-disc list-inside space-y-1">
 <li>This screenshot is used as the reference for visual comparisons</li>
 <li>Click the image to view at full resolution</li>
 <li>To update the baseline, approve a new screenshot in the test results</li>
 </ul>
 </div>

 {/* Merge Baseline from Branch Section - shown when there are newer baselines */}
 {mergeableBranches.some(b => b.isNewer) && (
 <div className="mt-4 p-4 border border-primary/30 bg-primary/5 rounded-lg">
 <div className="flex items-start gap-3">
 <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
 <MergeIcon className="text-primary" />
 </div>
 <div className="flex-1">
 <h4 className="text-sm font-semibold text-primary mb-1">
 Newer Baselines Available from Feature Branches
 </h4>
 <p className="text-sm text-muted-foreground mb-3">
 The following branches have baselines that are newer than this branch's baseline.
 This typically happens after merging a feature branch.
 </p>
 <div className="space-y-2">
 {mergeableBranches.filter(b => b.isNewer).map((branch) => (
 <div key={branch.branch} className="flex items-center justify-between gap-2 p-2 rounded border border-border bg-background">
 <span className="flex items-center gap-2 text-sm">
 <BranchIcon className="text-muted-foreground" />
 <span className="font-medium text-foreground">{branch.branch}</span>
 <span className="text-xs text-muted-foreground">
 • Updated {new Date(branch.updatedAt).toLocaleDateString()}
 {branch.approvedBy && ` by ${branch.approvedBy}`}
 </span>
 </span>
 <button
 onClick={() => {
 onSetSelectedMergeBranch(branch.branch);
 onSetShowMergeBaselineModal(true);
 }}
 className="px-3 py-1 text-xs font-medium rounded bg-primary text-white hover:bg-primary transition-colors"
 >
 Adopt Baseline
 </button>
 </div>
 ))}
 </div>
 </div>
 </div>
 </div>
 )}

 {/* Baseline History Section */}
 <div className="mt-6 pt-6 border-t border-border">
 <div className="flex items-center justify-between mb-4">
 <div>
 <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
 <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <circle cx="12" cy="12" r="10"/>
 <polyline points="12 6 12 12 16 14"/>
 </svg>
 Baseline History
 </h3>
 <p className="text-sm text-muted-foreground">
 All baseline versions for audit trail ({baselineHistory.length} versions)
 </p>
 </div>
 </div>

 <BaselineHistoryTable
 baselineHistory={baselineHistory}
 loadingBaselineHistory={loadingBaselineHistory}
 selectedHistoryVersion={selectedHistoryVersion}
 historyVersionImage={historyVersionImage}
 loadingHistoryImage={loadingHistoryImage}
 onSetSelectedHistoryVersion={onSetSelectedHistoryVersion}
 onSetHistoryVersionImage={onSetHistoryVersionImage}
 onSetRestoreHistoryEntry={onSetRestoreHistoryEntry}
 onSetShowRestoreBaselineModal={onSetShowRestoreBaselineModal}
 onSetRestoreBaselineError={onSetRestoreBaselineError}
 onSetLightboxImage={onSetLightboxImage}
 />
 </div>
 </div>
 );
}

// Main BaselineTab component
export function BaselineTab({
 testId,
 selectedBranch,
 availableBranches,
 loadingBaseline,
 baselineData,
 isRunning,
 mergeableBranches,
 baselineHistory,
 loadingBaselineHistory,
 selectedHistoryVersion,
 historyVersionImage,
 loadingHistoryImage,
 onRunTest,
 onSetSelectedMergeBranch,
 onSetShowMergeBaselineModal,
 onSetLightboxImage,
 onSetSelectedHistoryVersion,
 onSetHistoryVersionImage,
 onSetRestoreHistoryEntry,
 onSetShowRestoreBaselineModal,
 onSetRestoreBaselineError,
}: BaselineTabProps) {
 return (
 <div className="mt-4">
 {/* Branch indicator */}
 <div className="mb-4 flex items-center gap-2 text-sm">
 <span className="text-muted-foreground">Viewing baseline for branch:</span>
 <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 font-medium text-primary">
 <BranchIcon />
 {selectedBranch}
 </span>
 {availableBranches.length > 1 && (
 <span className="text-xs text-muted-foreground">
 ({availableBranches.length} branches have baselines)
 </span>
 )}
 </div>

 {loadingBaseline ? (
 <div className="flex items-center justify-center py-12">
 <LoadingSpinner size="lg" />
 <span className="ml-3 text-muted-foreground">Loading baseline...</span>
 </div>
 ) : !baselineData?.hasBaseline ? (
 <NoBaselineState
 selectedBranch={selectedBranch}
 isRunning={isRunning}
 mergeableBranches={mergeableBranches}
 onRunTest={onRunTest}
 onSetSelectedMergeBranch={onSetSelectedMergeBranch}
 onSetShowMergeBaselineModal={onSetShowMergeBaselineModal}
 />
 ) : (
 <CurrentBaselineDisplay
 testId={testId}
 baselineData={baselineData}
 mergeableBranches={mergeableBranches}
 baselineHistory={baselineHistory}
 loadingBaselineHistory={loadingBaselineHistory}
 selectedHistoryVersion={selectedHistoryVersion}
 historyVersionImage={historyVersionImage}
 loadingHistoryImage={loadingHistoryImage}
 onSetSelectedMergeBranch={onSetSelectedMergeBranch}
 onSetShowMergeBaselineModal={onSetShowMergeBaselineModal}
 onSetLightboxImage={onSetLightboxImage}
 onSetSelectedHistoryVersion={onSetSelectedHistoryVersion}
 onSetHistoryVersionImage={onSetHistoryVersionImage}
 onSetRestoreHistoryEntry={onSetRestoreHistoryEntry}
 onSetShowRestoreBaselineModal={onSetShowRestoreBaselineModal}
 onSetRestoreBaselineError={onSetRestoreBaselineError}
 />
 )}
 </div>
 );
}
