/**
 * FalsePositiveModal - Modal for marking SAST findings as false positives
 * Feature #102: Extracted from SecurityTab.tsx
 * Feature #637: Migrated to use Modal component from ui/Modal
 */
import { AlertTriangle } from 'lucide-react';
import { Modal, ModalBody, ModalFooter } from '../../ui/Modal';
import { SASTFinding } from '../types';

export interface FalsePositiveModalProps {
 isOpen: boolean;
 selectedFinding: SASTFinding;
 fpReason: string;
 isMarkingFP: boolean;
 setFpReason: (reason: string) => void;
 setShowFalsePositiveModal: (show: boolean) => void;
 handleMarkFalsePositive: () => Promise<void>;
}

export function FalsePositiveModal({
 isOpen,
 selectedFinding,
 fpReason,
 isMarkingFP,
 setFpReason,
 setShowFalsePositiveModal,
 handleMarkFalsePositive,
}: FalsePositiveModalProps) {
 return (
 <Modal
 isOpen={isOpen}
 onClose={() => !isMarkingFP && setShowFalsePositiveModal(false)}
 title="Mark as False Positive"
 size="md"
 closeOnBackdrop={!isMarkingFP}
 >
 <div className="flex items-center gap-3 p-4 sm:p-6 border-b border-border">
 <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/10">
 <AlertTriangle className="h-6 w-6 text-warning" />
 </div>
 <div>
 <h3 className="text-lg font-semibold text-foreground">Mark as False Positive</h3>
 <p className="text-sm text-muted-foreground">This finding will be excluded from future scans</p>
 </div>
 </div>

 <ModalBody>
 <div className="bg-muted/50 rounded-md p-3 mb-4">
 <p className="text-sm font-medium text-foreground">{selectedFinding.ruleName}</p>
 <p className="text-xs text-muted-foreground mt-1 font-mono">
 {selectedFinding.filePath}:{selectedFinding.line}
 </p>
 </div>

 <div>
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
 </ModalBody>

 <ModalFooter>
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
 className="px-4 py-2 rounded-md bg-warning text-warning-foreground hover:bg-warning disabled:opacity-50"
 >
 {isMarkingFP ? 'Marking...' : 'Mark as False Positive'}
 </button>
 </ModalFooter>
 </Modal>
 );
}
