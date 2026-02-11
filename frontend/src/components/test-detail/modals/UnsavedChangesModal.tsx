// Feature #48: UnsavedChangesModal component extracted from TestDetailPage.tsx
// Feature #633: Migrated to Modal/ModalHeader/ModalBody/ModalFooter

import { Modal, ModalHeader, ModalBody, ModalFooter } from '../../ui/Modal';

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
    <Modal isOpen onClose={onClose} title="Unsaved Changes" size="md">
      <ModalHeader onClose={onClose}>Unsaved Changes</ModalHeader>
      <ModalBody>
        <p className="text-muted-foreground">
          You have unsaved changes. Do you want to save them before closing?
        </p>
      </ModalBody>
      <ModalFooter>
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
      </ModalFooter>
    </Modal>
  );
}
