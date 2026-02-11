/**
 * DeleteSuiteModal Component
 * Feature #50: Extract modals from TestSuitePage.tsx
 * Feature #634: Migrated to Modal/ModalBody/ModalFooter
 */

import React from 'react';
import { Modal, ModalBody, ModalFooter } from '../../ui/Modal';

interface DeleteSuiteModalProps {
  suiteName: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteSuiteModal({
  suiteName,
  isDeleting,
  onConfirm,
  onCancel,
}: DeleteSuiteModalProps) {
  return (
    <Modal isOpen onClose={onCancel} title="Delete Test Suite" size="md" closeOnBackdrop={!isDeleting}>
      <ModalBody>
        <p className="text-muted-foreground">
          Are you sure you want to delete "{suiteName}"? This action cannot be undone and will delete all tests within this suite.
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
          {isDeleting ? 'Deleting...' : 'Delete Suite'}
        </button>
      </ModalFooter>
    </Modal>
  );
}

export default DeleteSuiteModal;
