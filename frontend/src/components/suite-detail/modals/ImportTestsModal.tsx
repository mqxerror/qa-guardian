/**
 * ImportTestsModal Component
 * Feature #50: Extract modals from TestSuitePage.tsx
 */

import React, { useRef } from 'react';

interface ImportTestsModalProps {
  importError: string;
  isImporting: boolean;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClose: () => void;
}

export function ImportTestsModal({
  importError,
  isImporting,
  onImport,
  onClose,
}: ImportTestsModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-tests-title"
        className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="import-tests-title" className="text-lg font-semibold text-foreground">Import Tests</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Upload a JSON file with test definitions or Playwright test files.
        </p>

        {importError && (
          <div role="alert" className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {importError}
          </div>
        )}

        <div className="mt-4">
          <label
            htmlFor="import-file"
            className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-8 transition-colors hover:border-primary/50 hover:bg-muted/30 ${isImporting ? 'pointer-events-none opacity-50' : ''}`}
          >
            <svg className="h-10 w-10 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <span className="mt-2 text-sm font-medium text-foreground">
              {isImporting ? 'Importing...' : 'Click to upload or drag and drop'}
            </span>
            <span className="mt-1 text-xs text-muted-foreground">
              JSON, .spec.ts, .spec.js, .test.ts, .test.js (Max 5MB)
            </span>
          </label>
          <input
            ref={fileInputRef}
            id="import-file"
            type="file"
            accept=".json,.spec.ts,.spec.js,.test.ts,.test.js"
            onChange={onImport}
            className="hidden"
            disabled={isImporting}
          />
        </div>

        <div className="mt-4 rounded-md bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">
            <strong>JSON Format:</strong> Array of objects with "name" and optional "description", "steps" fields.
          </p>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default ImportTestsModal;
