/**
 * EditSelectorModal Component
 * Feature #50: Extract modals from TestSuitePage.tsx
 * Feature #1065: Edit selector modal for TestSuitePage
 * Feature #127: Mobile responsive design audit and fixes
 * Feature #634: Migrated to Modal/ModalBody/ModalFooter
 */

import React from 'react';
import { Pencil, Loader2 } from 'lucide-react';
import { Modal, ModalBody, ModalFooter } from '../../ui/Modal';

export interface EditSelectorModalState {
 isOpen: boolean;
 runId: string;
 testId: string;
 stepId: string;
 currentSelector: string;
 originalSelector: string;
 wasHealed: boolean;
}

interface EditSelectorModalProps {
 modalState: EditSelectorModalState;
 selectorValue: string;
 selectorNotes: string;
 applyToTest: boolean;
 isSubmitting: boolean;
 onSelectorValueChange: (value: string) => void;
 onNotesChange: (notes: string) => void;
 onApplyToTestChange: (apply: boolean) => void;
 onClose: () => void;
 onUpdateSelector: () => void;
 onAcceptHealed: () => void;
}

export function EditSelectorModal({
 modalState,
 selectorValue,
 selectorNotes,
 applyToTest,
 isSubmitting,
 onSelectorValueChange,
 onNotesChange,
 onApplyToTestChange,
 onClose,
 onUpdateSelector,
 onAcceptHealed,
}: EditSelectorModalProps) {
 if (!modalState.isOpen) return null;

 const title = modalState.wasHealed ? 'Edit Healed Selector' : 'Edit Selector';

 return (
 <Modal isOpen onClose={onClose} title={title} size="lg" closeOnBackdrop={!isSubmitting}>
 {/* Custom Header with icon */}
 <div className="flex items-center gap-3 p-4 sm:p-6 border-b border-border">
 <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
 <Pencil className="h-5 w-5 text-accent" />
 </div>
 <div>
 <h3 className="text-lg font-semibold text-foreground">{title}</h3>
 <p className="text-xs text-muted-foreground">
 {modalState.wasHealed ? 'Modify or accept the AI-healed selector' : 'Manually update the selector'}
 </p>
 </div>
 </div>
 <ModalBody>
 {/* Original Selector */}
 <div className="mb-4 p-3 bg-muted/50 rounded-md">
 <div className="text-xs font-medium text-muted-foreground mb-1">Original Selector</div>
 <code className="text-sm font-mono text-foreground break-all">
 {modalState.originalSelector || 'N/A'}
 </code>
 </div>

 {/* Current Selector (if healed) */}
 {modalState.wasHealed && modalState.currentSelector !== modalState.originalSelector && (
 <div className="mb-4 p-3 bg-success/5 rounded-md border border-success/20">
 <div className="text-xs font-medium text-success mb-1 flex items-center gap-1">
 <span>🔧</span> AI-Healed Selector
 </div>
 <code className="text-sm font-mono text-success break-all">
 {modalState.currentSelector}
 </code>
 </div>
 )}

 {/* New Selector Input */}
 <div className="mb-4">
 <label className="block text-sm font-medium text-foreground mb-1">
 {modalState.wasHealed ? 'New Selector (or keep healed)' : 'New Selector'}
 </label>
 <input
 type="text"
 value={selectorValue}
 onChange={(e) => onSelectorValueChange(e.target.value)}
 placeholder={modalState.currentSelector || 'Enter selector...'}
 className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
 />
 <p className="mt-1 text-xs text-muted-foreground">
 Supports CSS selectors, XPath, or data-testid attributes
 </p>
 </div>

 {/* Notes */}
 <div className="mb-4">
 <label className="block text-sm font-medium text-foreground mb-1">Notes (optional)</label>
 <textarea
 value={selectorNotes}
 onChange={(e) => onNotesChange(e.target.value)}
 placeholder="Why are you changing this selector?"
 rows={2}
 className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
 />
 </div>

 {/* Apply to Test Definition Checkbox */}
 <div>
 <label className="flex items-center gap-2 cursor-pointer">
 <input
 type="checkbox"
 checked={applyToTest}
 onChange={(e) => onApplyToTestChange(e.target.checked)}
 className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
 />
 <span className="text-sm text-foreground">Apply to test definition</span>
 </label>
 <p className="ml-6 text-xs text-muted-foreground">
 If checked, the new selector will be saved to the test so future runs use it
 </p>
 </div>
 </ModalBody>
 <ModalFooter>
 <button
 onClick={onClose}
 className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
 disabled={isSubmitting}
 >
 Cancel
 </button>
 {modalState.wasHealed && (
 <button
 onClick={onAcceptHealed}
 disabled={isSubmitting}
 className="rounded-md bg-success px-4 py-2 text-sm font-medium text-success-foreground hover:bg-success disabled:opacity-50"
 >
 {isSubmitting ? 'Accepting...' : '✓ Accept Healed'}
 </button>
 )}
 <button
 onClick={onUpdateSelector}
 disabled={isSubmitting || !selectorValue.trim()}
 className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
 >
 {isSubmitting ? (
 <span className="flex items-center gap-2">
 <Loader2 className="animate-spin h-4 w-4" />
 Saving...
 </span>
 ) : (
 'Save Changes'
 )}
 </button>
 </ModalFooter>
 </Modal>
 );
}

export default EditSelectorModal;
