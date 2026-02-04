/**
 * DeleteTestModal Component
 * Feature #50: Extract modals from TestSuitePage.tsx
 */

import React from 'react';

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-test-title"
        className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="delete-test-title" className="text-lg font-semibold text-foreground">
          Delete Test
        </h3>
        <p className="mt-2 text-muted-foreground">
          Are you sure you want to delete this test? This action cannot be undone.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border border-border px-4 py-2 font-medium text-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="rounded-md bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isDeleting ? 'Deleting...' : 'Delete Test'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeleteTestModal;
