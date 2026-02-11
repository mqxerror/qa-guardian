// EditTestModal.tsx
// Feature #48: Extracted from TestDetailPage.tsx
// Feature #127: Mobile responsive design audit and fixes
// Feature #633: Migrated to Modal/ModalHeader/ModalBody/ModalFooter
import { FormEvent } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../../ui/Modal';

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
    <Modal isOpen onClose={handleCancel} title="Edit Test" size="md">
      <ModalHeader onClose={handleCancel}>Edit Test</ModalHeader>
      <ModalBody>
        <form onSubmit={onSubmit} id="edit-test-form" className="space-y-4">
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
        </form>
      </ModalBody>
      <ModalFooter>
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
          form="edit-test-form"
          disabled={isEditing || !editName.trim()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isEditing ? 'Saving...' : 'Save Changes'}
        </button>
      </ModalFooter>
    </Modal>
  );
}
