// Feature #48: UnsavedChangesConfirmModal - Simple confirm/cancel variant
// Extracted from TestDetailPage.tsx to reduce line count

interface UnsavedChangesConfirmModalProps {
  show: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function UnsavedChangesConfirmModal({
  show,
  onCancel,
  onConfirm,
}: UnsavedChangesConfirmModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="unsaved-changes-title"
        aria-describedby="unsaved-changes-desc"
        className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning/10">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h3 id="unsaved-changes-title" className="text-lg font-semibold text-foreground">Unsaved Changes</h3>
            <p id="unsaved-changes-desc" className="mt-2 text-sm text-muted-foreground">
              You have unsaved changes. Are you sure you want to leave? Your changes will be lost.
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-destructive"
          >
            Discard Changes
          </button>
        </div>
      </div>
    </div>
  );
}
