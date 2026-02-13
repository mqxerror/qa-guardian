// Feature #48: UnsavedChangesConfirmModal - Simple confirm/cancel variant
// Extracted from TestDetailPage.tsx to reduce line count
// Feature #633: Migrated to Modal/ModalHeader/ModalBody/ModalFooter

import { Modal, ModalBody, ModalFooter } from '../../ui/Modal';
import { AlertTriangle } from 'lucide-react';

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
    <Modal isOpen onClose={onCancel} title="Unsaved Changes" size="md">
      <ModalBody>
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning/10">
            <AlertTriangle className="h-6 w-6 text-warning" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Unsaved Changes</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              You have unsaved changes. Are you sure you want to leave? Your changes will be lost.
            </p>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
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
          className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
        >
          Discard Changes
        </button>
      </ModalFooter>
    </Modal>
  );
}
