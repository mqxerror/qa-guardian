// Feature #48: Baseline modals extracted from TestDetailPage.tsx

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
 <div
 className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
 onClick={(e) =>
 e.target === e.currentTarget && !approvingBaseline && onClose()
 }
 >
 <div
 role="dialog"
 aria-modal="true"
 aria-labelledby="approve-baseline-title"
 className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg"
 onClick={(e) => e.stopPropagation()}
 >
 <div className="flex items-center gap-3 mb-4">
 <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
 <svg
 className="h-6 w-6 text-green-600"
 fill="none"
 viewBox="0 0 24 24"
 stroke="currentColor"
 >
 <path
 strokeLinecap="round"
 strokeLinejoin="round"
 strokeWidth={2}
 d="M5 13l4 4L19 7"
 />
 </svg>
 </div>
 <h3
 id="approve-baseline-title"
 className="text-lg font-semibold text-foreground"
 >
 Approve New Baseline
 </h3>
 </div>
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
 <div className="border border-red-200 rounded-md overflow-hidden bg-red-50">
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
 <div className="border border-green-200 rounded-md overflow-hidden bg-green-50">
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
 <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
 <p className="text-sm text-amber-800">
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
 <div className="mt-6 flex justify-end gap-3">
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
 className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
 >
 {approvingBaseline ? (
 <span className="flex items-center gap-2">
 <svg
 className="animate-spin h-4 w-4"
 xmlns="http://www.w3.org/2000/svg"
 fill="none"
 viewBox="0 0 24 24"
 >
 <circle
 className="opacity-25"
 cx="12"
 cy="12"
 r="10"
 stroke="currentColor"
 strokeWidth="4"
 ></circle>
 <path
 className="opacity-75"
 fill="currentColor"
 d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
 ></path>
 </svg>
 Approving...
 </span>
 ) : (
 'Approve Baseline'
 )}
 </button>
 </div>
 </div>
 </div>
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
 <div
 className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
 onClick={(e) =>
 e.target === e.currentTarget && !restoringBaseline && onClose()
 }
 >
 <div
 role="dialog"
 aria-modal="true"
 aria-labelledby="restore-baseline-title"
 className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg"
 onClick={(e) => e.stopPropagation()}
 >
 <div className="flex items-center gap-3 mb-4">
 <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
 <svg
 className="h-6 w-6 text-amber-600"
 fill="none"
 viewBox="0 0 24 24"
 stroke="currentColor"
 >
 <path
 strokeLinecap="round"
 strokeLinejoin="round"
 strokeWidth={2}
 d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5"
 />
 </svg>
 </div>
 <h3
 id="restore-baseline-title"
 className="text-lg font-semibold text-foreground"
 >
 Restore Previous Baseline
 </h3>
 </div>
 <p className="text-muted-foreground">
 Are you sure you want to restore{' '}
 <span className="font-medium text-foreground">
 version {restoreHistoryEntry.version}
 </span>{' '}
 as the current baseline for{' '}
 <span className="font-medium text-foreground">"{testName}"</span>?
 </p>
 <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
 <p className="text-sm text-amber-800">
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
 <div className="mt-6 flex justify-end gap-3">
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
 className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
 >
 {restoringBaseline ? (
 <span className="flex items-center gap-2">
 <svg
 className="animate-spin h-4 w-4"
 xmlns="http://www.w3.org/2000/svg"
 fill="none"
 viewBox="0 0 24 24"
 >
 <circle
 className="opacity-25"
 cx="12"
 cy="12"
 r="10"
 stroke="currentColor"
 strokeWidth="4"
 ></circle>
 <path
 className="opacity-75"
 fill="currentColor"
 d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
 ></path>
 </svg>
 Restoring...
 </span>
 ) : (
 'Restore Baseline'
 )}
 </button>
 </div>
 </div>
 </div>
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
 <div
 className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
 onClick={(e) =>
 e.target === e.currentTarget && !isMergingBaseline && onClose()
 }
 >
 <div
 role="dialog"
 aria-modal="true"
 aria-labelledby="merge-baseline-title"
 className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg"
 onClick={(e) => e.stopPropagation()}
 >
 <div className="flex items-center gap-3 mb-4">
 <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
 <svg
 className="h-6 w-6 text-blue-600"
 fill="none"
 viewBox="0 0 24 24"
 stroke="currentColor"
 >
 <circle cx="18" cy="18" r="3" />
 <circle cx="6" cy="6" r="3" />
 <path d="M6 21V9a9 9 0 0 0 9 9" />
 </svg>
 </div>
 <h3
 id="merge-baseline-title"
 className="text-lg font-semibold text-foreground"
 >
 Merge Baseline from Branch
 </h3>
 </div>
 <p className="text-muted-foreground">
 Merge the baseline from branch{' '}
 <span className="font-semibold text-blue-600">
 '{selectedMergeBranch}'
 </span>{' '}
 to{' '}
 <span className="font-semibold text-foreground">
 '{selectedBranch}'
 </span>
 ?
 </p>
 <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
 <p className="text-sm text-blue-800">
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
 <div className="mt-6 flex justify-end gap-3">
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
 className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
 >
 {isMergingBaseline ? (
 <span className="flex items-center gap-2">
 <svg
 className="animate-spin h-4 w-4"
 xmlns="http://www.w3.org/2000/svg"
 fill="none"
 viewBox="0 0 24 24"
 >
 <circle
 className="opacity-25"
 cx="12"
 cy="12"
 r="10"
 stroke="currentColor"
 strokeWidth="4"
 ></circle>
 <path
 className="opacity-75"
 fill="currentColor"
 d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
 ></path>
 </svg>
 Merging...
 </span>
 ) : (
 'Merge Baseline'
 )}
 </button>
 </div>
 </div>
 </div>
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
 <div
 className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
 onClick={(e) =>
 e.target === e.currentTarget && !rejectingChanges && onClose()
 }
 >
 <div
 role="dialog"
 aria-modal="true"
 aria-labelledby="reject-changes-title"
 className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg"
 onClick={(e) => e.stopPropagation()}
 >
 <div className="flex items-center gap-3 mb-4">
 <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
 <svg
 className="h-6 w-6 text-red-600"
 fill="none"
 viewBox="0 0 24 24"
 stroke="currentColor"
 >
 <path
 strokeLinecap="round"
 strokeLinejoin="round"
 strokeWidth={2}
 d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
 />
 </svg>
 </div>
 <h3
 id="reject-changes-title"
 className="text-lg font-semibold text-foreground"
 >
 Reject Visual Changes
 </h3>
 </div>
 <p className="text-muted-foreground">
 Mark this visual difference as a{' '}
 <span className="font-semibold text-red-600">
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
 <div className="mt-6 flex justify-end gap-3">
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
 className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
 >
 {rejectingChanges ? (
 <span className="flex items-center gap-2">
 <svg
 className="animate-spin h-4 w-4"
 xmlns="http://www.w3.org/2000/svg"
 fill="none"
 viewBox="0 0 24 24"
 >
 <circle
 className="opacity-25"
 cx="12"
 cy="12"
 r="10"
 stroke="currentColor"
 strokeWidth="4"
 ></circle>
 <path
 className="opacity-75"
 fill="currentColor"
 d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
 ></path>
 </svg>
 Rejecting...
 </span>
 ) : (
 'Reject Changes'
 )}
 </button>
 </div>
 </div>
 </div>
 );
}
