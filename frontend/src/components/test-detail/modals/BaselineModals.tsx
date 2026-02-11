// Feature #48: Baseline modals extracted from TestDetailPage.tsx
// Feature #633: Migrated to Modal/ModalHeader/ModalBody/ModalFooter

import { Check, RotateCcw, GitMerge, AlertTriangle, Loader2 } from 'lucide-react';
import { Modal, ModalBody, ModalFooter } from '../../ui/Modal';

interface ApproveBaselineModalProps {
 testName: string;
 approvingBaseline: boolean;
 approveBaselineError: string;
 currentRun?: {
 results?: Array<{
 test_id: string;
 baseline_screenshot_base64?: string;
 screenshot_base64?: string;
 }>;
 };
 testId?: string;
 onClose: () => void;
 onApprove: (runId?: string) => void;
 runId: string | null;
}

export function ApproveBaselineModal({
 testName,
 approvingBaseline,
 approveBaselineError,
 currentRun,
 testId,
 onClose,
 onApprove,
 runId,
}: ApproveBaselineModalProps) {
 const runResult = currentRun?.results?.find((r) => String(r.test_id) === String(testId));
 const hasPreview =
 runResult?.baseline_screenshot_base64 && runResult?.screenshot_base64;

 return (
 <Modal isOpen onClose={onClose} title="Approve New Baseline" size="md" closeOnBackdrop={!approvingBaseline}>
 {/* Custom Header with icon */}
 <div className="flex items-center gap-3 p-4 sm:p-6 border-b border-border">
 <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10">
 <Check className="h-6 w-6 text-success" />
 </div>
 <h2 className="text-lg font-semibold text-foreground">
 Approve New Baseline
 </h2>
 </div>
 <ModalBody>
 <p className="text-muted-foreground">
 Are you sure you want to approve the current screenshot as the new
 baseline for{' '}
 <span className="font-medium text-foreground">"{testName}"</span>?
 </p>
 {hasPreview && (
 <div className="mt-4 space-y-2">
 <p className="text-xs font-medium text-muted-foreground">
 Preview: Old vs New Baseline
 </p>
 <div className="grid grid-cols-2 gap-3">
 <div className="space-y-1">
 <p className="text-xs text-center text-muted-foreground">
 Current Baseline
 </p>
 <div className="border border-destructive/20 rounded-md overflow-hidden bg-destructive/5">
 <img
 src={`data:image/png;base64,${runResult!.baseline_screenshot_base64}`}
 alt="Current baseline"
 className="w-full h-24 object-cover object-top"
 />
 </div>
 </div>
 <div className="space-y-1">
 <p className="text-xs text-center text-muted-foreground">
 New Baseline
 </p>
 <div className="border border-success/20 rounded-md overflow-hidden bg-success/5">
 <img
 src={`data:image/png;base64,${runResult!.screenshot_base64}`}
 alt="New baseline"
 className="w-full h-24 object-cover object-top"
 />
 </div>
 </div>
 </div>
 </div>
 )}
 <div className="mt-4 p-3 rounded-lg bg-warning/5 border border-warning/20">
 <p className="text-sm text-warning">
 <strong>⚠️ This will replace the existing baseline.</strong> All
 future test runs will compare against this new baseline screenshot.
 </p>
 </div>
 {approveBaselineError && (
 <div
 role="alert"
 className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
 >
 {approveBaselineError}
 </div>
 )}
 </ModalBody>
 <ModalFooter>
 <button
 onClick={onClose}
 className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
 disabled={approvingBaseline}
 >
 Cancel
 </button>
 <button
 onClick={() => onApprove(runId || undefined)}
 disabled={approvingBaseline}
 className="rounded-md bg-success px-4 py-2 text-sm font-medium text-success-foreground hover:bg-success disabled:opacity-50"
 >
 {approvingBaseline ? (
 <span className="flex items-center gap-2">
 <Loader2 className="animate-spin h-4 w-4" />
 Approving...
 </span>
 ) : (
 'Approve Baseline'
 )}
 </button>
 </ModalFooter>
 </Modal>
 );
}

interface RestoreBaselineModalProps {
 testName: string;
 restoringBaseline: boolean;
 restoreBaselineError: string;
 restoreHistoryEntry: { id: string; version: number } | null;
 onClose: () => void;
 onRestore: (id: string) => void;
}

export function RestoreBaselineModal({
 testName,
 restoringBaseline,
 restoreBaselineError,
 restoreHistoryEntry,
 onClose,
 onRestore,
}: RestoreBaselineModalProps) {
 if (!restoreHistoryEntry) return null;

 return (
 <Modal isOpen onClose={onClose} title="Restore Previous Baseline" size="md" closeOnBackdrop={!restoringBaseline}>
 {/* Custom Header with icon */}
 <div className="flex items-center gap-3 p-4 sm:p-6 border-b border-border">
 <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/10">
 <RotateCcw className="h-6 w-6 text-warning" />
 </div>
 <h2 className="text-lg font-semibold text-foreground">
 Restore Previous Baseline
 </h2>
 </div>
 <ModalBody>
 <p className="text-muted-foreground">
 Are you sure you want to restore{' '}
 <span className="font-medium text-foreground">
 version {restoreHistoryEntry.version}
 </span>{' '}
 as the current baseline for{' '}
 <span className="font-medium text-foreground">"{testName}"</span>?
 </p>
 <div className="mt-4 p-3 rounded-lg bg-warning/5 border border-warning/20">
 <p className="text-sm text-warning">
 <strong>⚠️ This will replace the current baseline.</strong> All
 future test runs will compare against this restored baseline. A new
 version will be created in the history for audit trail.
 </p>
 </div>
 {restoreBaselineError && (
 <div
 role="alert"
 className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
 >
 {restoreBaselineError}
 </div>
 )}
 </ModalBody>
 <ModalFooter>
 <button
 onClick={onClose}
 className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
 disabled={restoringBaseline}
 >
 Cancel
 </button>
 <button
 onClick={() => onRestore(restoreHistoryEntry.id)}
 disabled={restoringBaseline}
 className="rounded-md bg-warning px-4 py-2 text-sm font-medium text-warning-foreground hover:bg-warning disabled:opacity-50"
 >
 {restoringBaseline ? (
 <span className="flex items-center gap-2">
 <Loader2 className="animate-spin h-4 w-4" />
 Restoring...
 </span>
 ) : (
 'Restore Baseline'
 )}
 </button>
 </ModalFooter>
 </Modal>
 );
}

interface MergeBaselineModalProps {
 selectedBranch: string;
 selectedMergeBranch: string | null;
 isMergingBaseline: boolean;
 mergeBaselineError: string;
 onClose: () => void;
 onMerge: (branch: string) => void;
}

export function MergeBaselineModal({
 selectedBranch,
 selectedMergeBranch,
 isMergingBaseline,
 mergeBaselineError,
 onClose,
 onMerge,
}: MergeBaselineModalProps) {
 if (!selectedMergeBranch) return null;

 return (
 <Modal isOpen onClose={onClose} title="Merge Baseline from Branch" size="md" closeOnBackdrop={!isMergingBaseline}>
 {/* Custom Header with icon */}
 <div className="flex items-center gap-3 p-4 sm:p-6 border-b border-border">
 <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
 <GitMerge className="h-6 w-6 text-primary" />
 </div>
 <h2 className="text-lg font-semibold text-foreground">
 Merge Baseline from Branch
 </h2>
 </div>
 <ModalBody>
 <p className="text-muted-foreground">
 Merge the baseline from branch{' '}
 <span className="font-semibold text-primary">
 '{selectedMergeBranch}'
 </span>{' '}
 to{' '}
 <span className="font-semibold text-foreground">
 '{selectedBranch}'
 </span>
 ?
 </p>
 <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
 <p className="text-sm text-primary">
 <strong>ℹ️ This will copy the baseline.</strong> The baseline from '
 {selectedMergeBranch}' will be used as the new baseline for branch '
 {selectedBranch}'. All future test runs on '{selectedBranch}' will
 compare against this baseline.
 </p>
 </div>
 <p className="text-sm text-muted-foreground mt-3">
 This is typically done after merging a feature branch to main, so the
 visual baseline matches the merged code.
 </p>
 {mergeBaselineError && (
 <div
 role="alert"
 className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
 >
 {mergeBaselineError}
 </div>
 )}
 </ModalBody>
 <ModalFooter>
 <button
 onClick={onClose}
 className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
 disabled={isMergingBaseline}
 >
 Cancel
 </button>
 <button
 onClick={() => onMerge(selectedMergeBranch)}
 disabled={isMergingBaseline}
 className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
 >
 {isMergingBaseline ? (
 <span className="flex items-center gap-2">
 <Loader2 className="animate-spin h-4 w-4" />
 Merging...
 </span>
 ) : (
 'Merge Baseline'
 )}
 </button>
 </ModalFooter>
 </Modal>
 );
}

interface RejectChangesModalProps {
 testName: string;
 rejectingChanges: boolean;
 rejectChangesError: string;
 rejectionReason: string;
 onReasonChange: (reason: string) => void;
 onClose: () => void;
 onReject: (runId?: string) => void;
 runId: string | null;
}

export function RejectChangesModal({
 testName,
 rejectingChanges,
 rejectChangesError,
 rejectionReason,
 onReasonChange,
 onClose,
 onReject,
 runId,
}: RejectChangesModalProps) {
 return (
 <Modal isOpen onClose={onClose} title="Reject Visual Changes" size="md" closeOnBackdrop={!rejectingChanges}>
 {/* Custom Header with icon */}
 <div className="flex items-center gap-3 p-4 sm:p-6 border-b border-border">
 <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
 <AlertTriangle className="h-6 w-6 text-destructive" />
 </div>
 <h2 className="text-lg font-semibold text-foreground">
 Reject Visual Changes
 </h2>
 </div>
 <ModalBody>
 <p className="text-muted-foreground">
 Mark this visual difference as a{' '}
 <span className="font-semibold text-destructive">
 regression
 </span>{' '}
 for{' '}
 <span className="font-medium text-foreground">"{testName}"</span>?
 </p>
 <p className="text-sm text-muted-foreground mt-2">
 This indicates that the visual changes are unintended and should be
 fixed. The baseline will remain unchanged.
 </p>

 <div className="mt-4">
 <label className="block text-sm font-medium text-foreground mb-1">
 Rejection Reason{' '}
 <span className="text-muted-foreground font-normal">(optional)</span>
 </label>
 <textarea
 value={rejectionReason}
 onChange={(e) => onReasonChange(e.target.value)}
 placeholder="Describe why this change is a regression..."
 className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
 rows={3}
 />
 </div>

 {rejectChangesError && (
 <div
 role="alert"
 className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
 >
 {rejectChangesError}
 </div>
 )}
 </ModalBody>
 <ModalFooter>
 <button
 onClick={onClose}
 className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
 disabled={rejectingChanges}
 >
 Cancel
 </button>
 <button
 onClick={() => onReject(runId || undefined)}
 disabled={rejectingChanges}
 className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
 >
 {rejectingChanges ? (
 <span className="flex items-center gap-2">
 <Loader2 className="animate-spin h-4 w-4" />
 Rejecting...
 </span>
 ) : (
 'Reject Changes'
 )}
 </button>
 </ModalFooter>
 </Modal>
 );
}
