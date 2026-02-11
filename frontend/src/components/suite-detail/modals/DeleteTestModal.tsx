/**
 * DeleteTestModal Component
 * Feature #50: Extract modals from TestSuitePage.tsx
 * Feature #634: Migrated to Modal/ModalBody/ModalFooter
 */

import React from 'react';
import { Modal, ModalBody, ModalFooter } from '../../ui/Modal';

interface DeleteTestModalProps {
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteTestModal({
  isDeleting,
  onConfirm,
  onCancel,
}: DeleteTestModalProps) {
  return (
    <Modal isOpen onClose={onCancel} title="Delete Test" size="md" closeOnBackdrop={!isDeleting}>
      <ModalBody>
        <p className="text-muted-foreground">
          Are you sure you want to delete this test? This action cannot be undone.
        </p>
      </ModalBody>
      <ModalFooter>
        <button
          onClick={onCancel}
          className="rounded-md border border-border px-4 py-2 font-medium text-foreground hover:bg-muted"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={isDeleting}
          className="rounded-md bg-destructive px-4 py-2 font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
        >
          {isDeleting ? 'Deleting...' : 'Delete Test'}
        </button>
      </ModalFooter>
    </Modal>
  );
}

export default DeleteTestModal;
