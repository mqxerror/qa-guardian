// Feature #48: DeleteTestModal component extracted from TestDetailPage.tsx
// Feature #119: Added focus trap for keyboard navigation
// Feature #127: Mobile responsive design audit and fixes
// Feature #633: Migrated to Modal/ModalHeader/ModalBody/ModalFooter

import { Modal, ModalHeader, ModalBody, ModalFooter } from '../../ui/Modal';

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
    <Modal isOpen onClose={onClose} title="Delete Test" size="md">
      <ModalHeader onClose={onClose}>Delete Test</ModalHeader>
      <ModalBody>
        <p className="text-muted-foreground">
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
      </ModalBody>
      <ModalFooter>
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
          className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
      </ModalFooter>
    </Modal>
  );
}
