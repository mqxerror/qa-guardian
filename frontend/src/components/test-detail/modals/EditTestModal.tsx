// EditTestModal.tsx
// Feature #48: Extracted from TestDetailPage.tsx
import { FormEvent } from 'react';

interface EditTestModalProps {
  show: boolean;
  editName: string;
  editDescription: string;
  editError: string;
  isEditing: boolean;
  isDirty: boolean;
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
  onShowUnsavedChanges: () => void;
}

export function EditTestModal({
  show,
  editName,
  editDescription,
  editError,
  isEditing,
  isDirty,
  onNameChange,
  onDescriptionChange,
  onSubmit,
  onClose,
  onShowUnsavedChanges,
}: EditTestModalProps) {
  if (!show) {
    return null;
  }

  const handleCancel = () => {
    if (isDirty) {
      onShowUnsavedChanges();
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-test-title"
        className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg"
      >
        <h3 id="edit-test-title" className="text-lg font-semibold text-foreground">Edit Test</h3>
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="edit-test-name" className="block text-sm font-medium text-foreground">Test Name</label>
            <input
              type="text"
              id="edit-test-name"
              aria-describedby={editError ? 'edit-test-error' : undefined}
              value={editName}
              onChange={(e) => onNameChange(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Enter test name"
            />
          </div>
          <div>
            <label htmlFor="edit-test-description" className="block text-sm font-medium text-foreground">Description (optional)</label>
            <textarea
              id="edit-test-description"
              value={editDescription}
              onChange={(e) => onDescriptionChange(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Describe the test..."
              rows={3}
            />
          </div>
          {editError && (
            <div id="edit-test-error" role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {editError}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
              disabled={isEditing}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isEditing || !editName.trim()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isEditing ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
