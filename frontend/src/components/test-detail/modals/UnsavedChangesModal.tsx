// Feature #48: UnsavedChangesModal component extracted from TestDetailPage.tsx

interface UnsavedChangesModalProps {
  onClose: () => void;
  onDiscard: () => void;
  onSave: () => void;
  isSaving?: boolean;
}

export function UnsavedChangesModal({
  onClose,
  onDiscard,
  onSave,
  isSaving = false,
}: UnsavedChangesModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-changes-title"
        className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="unsaved-changes-title" className="text-lg font-semibold text-foreground">
          Unsaved Changes
        </h3>
        <p className="mt-2 text-muted-foreground">
          You have unsaved changes. Do you want to save them before closing?
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onDiscard}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            Discard
          </button>
          <button
            onClick={onSave}
            disabled={isSaving}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
