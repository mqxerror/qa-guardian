// Feature #48: DeleteTestModal component extracted from TestDetailPage.tsx

interface DeleteTestModalProps {
  testName: string;
  isDeleting: boolean;
  deleteError: string;
  onClose: () => void;
  onDelete: () => void;
}

export function DeleteTestModal({
  testName,
  isDeleting,
  deleteError,
  onClose,
  onDelete,
}: DeleteTestModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-test-title"
        className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="delete-test-title" className="text-lg font-semibold text-foreground">
          Delete Test
        </h3>
        <p className="mt-2 text-muted-foreground">
          Are you sure you want to delete "{testName}"? This action cannot be undone.
        </p>
        {deleteError && (
          <div
            role="alert"
            className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          >
            {deleteError}
          </div>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
