/**
 * FalsePositiveModal - Modal for marking SAST findings as false positives
 * Feature #102: Extracted from SecurityTab.tsx
 */
import { SASTFinding } from '../types';

export interface FalsePositiveModalProps {
  selectedFinding: SASTFinding;
  fpReason: string;
  isMarkingFP: boolean;
  setFpReason: (reason: string) => void;
  setShowFalsePositiveModal: (show: boolean) => void;
  handleMarkFalsePositive: () => Promise<void>;
}

export function FalsePositiveModal({
  selectedFinding,
  fpReason,
  isMarkingFP,
  setFpReason,
  setShowFalsePositiveModal,
  handleMarkFalsePositive,
}: FalsePositiveModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => e.target === e.currentTarget && !isMarkingFP && setShowFalsePositiveModal(false)}
    >
      <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/30">
            <svg className="h-6 w-6 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Mark as False Positive</h3>
            <p className="text-sm text-muted-foreground">This finding will be excluded from future scans</p>
          </div>
        </div>

        <div className="bg-muted/50 rounded-md p-3 mb-4">
          <p className="text-sm font-medium text-foreground">{selectedFinding.ruleName}</p>
          <p className="text-xs text-muted-foreground mt-1 font-mono">
            {selectedFinding.filePath}:{selectedFinding.line}
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-foreground mb-2">
            Reason for marking as false positive
          </label>
          <textarea
            value={fpReason}
            onChange={(e) => setFpReason(e.target.value)}
            placeholder="e.g., This is a test file, the secret is not real..."
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground resize-none"
          />
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={() => setShowFalsePositiveModal(false)}
            disabled={isMarkingFP}
            className="px-4 py-2 rounded-md border border-input bg-background text-foreground hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleMarkFalsePositive}
            disabled={isMarkingFP || !fpReason.trim()}
            className="px-4 py-2 rounded-md bg-yellow-600 text-white hover:bg-yellow-700 disabled:opacity-50"
          >
            {isMarkingFP ? 'Marking...' : 'Mark as False Positive'}
          </button>
        </div>
      </div>
    </div>
  );
}
