/**
 * ImportTestsModal Component
 * Feature #50: Extract modals from TestSuitePage.tsx
 * Feature #127: Mobile responsive design audit and fixes
 * Feature #634: Migrated to Modal/ModalBody/ModalFooter
 */

import React, { useRef } from 'react';
import { Upload } from 'lucide-react';
import { Modal, ModalBody, ModalFooter } from '../../ui/Modal';

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
    <Modal isOpen onClose={onClose} title="Import Tests" size="md" closeOnBackdrop={!isImporting}>
      <ModalBody>
        <p className="text-sm text-muted-foreground">
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
            <Upload className="h-10 w-10 text-muted-foreground" strokeWidth={1.5} />
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
      </ModalBody>
      <ModalFooter>
        <button
          onClick={onClose}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
        >
          Cancel
        </button>
      </ModalFooter>
    </Modal>
  );
}

export default ImportTestsModal;
