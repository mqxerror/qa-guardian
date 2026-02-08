/**
 * EditSelectorModal Component
 * Feature #50: Extract modals from TestSuitePage.tsx
 * Feature #1065: Edit selector modal for TestSuitePage
 * Feature #127: Mobile responsive design audit and fixes
 */

import React from 'react';

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

 return (
 <div
 className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
 onMouseDown={(e) => {
 if (e.target === e.currentTarget && !isSubmitting) {
 onClose();
 }
 }}
 >
 <div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-lg bg-card p-4 sm:p-6 shadow-lg max-h-[90vh] overflow-y-auto">
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-2">
 <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
 <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
 </svg>
 </div>
 <div>
 <h3 className="text-lg font-semibold text-foreground">
 {modalState.wasHealed ? 'Edit Healed Selector' : 'Edit Selector'}
 </h3>
 <p className="text-xs text-muted-foreground">
 {modalState.wasHealed ? 'Modify or accept the AI-healed selector' : 'Manually update the selector'}
 </p>
 </div>
 </div>
 <button
 onClick={onClose}
 className="text-muted-foreground hover:text-foreground"
 disabled={isSubmitting}
 >
 <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 </div>

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
 <div className="mb-6">
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

 {/* Action Buttons */}
 <div className="flex justify-end gap-3">
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
 className="rounded-md bg-success px-4 py-2 text-sm font-medium text-white hover:bg-success disabled:opacity-50"
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
 <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
 </svg>
 Saving...
 </span>
 ) : (
 'Save Changes'
 )}
 </button>
 </div>
 </div>
 </div>
 );
}

export default EditSelectorModal;
