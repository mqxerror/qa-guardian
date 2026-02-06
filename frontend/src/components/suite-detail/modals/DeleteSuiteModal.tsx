/**
 * DeleteSuiteModal Component
 * Feature #50: Extract modals from TestSuitePage.tsx
 */

import React from 'react';

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-suite-title"
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-lg border border-border bg-card p-4 sm:p-6 shadow-lg mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="delete-suite-title" className="text-lg font-semibold text-foreground">
          Delete Test Suite
        </h3>
        <p className="mt-2 text-muted-foreground">
          Are you sure you want to delete "{suiteName}"? This action cannot be undone and will delete all tests within this suite.
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
            {isDeleting ? 'Deleting...' : 'Delete Suite'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeleteSuiteModal;
