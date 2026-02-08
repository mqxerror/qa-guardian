/**
 * InsertTemplateModal Component
 * Feature #50: Extract modals from TestSuitePage.tsx
 * Feature #31: Step Templates for test recording
 * Feature #127: Mobile responsive design audit and fixes
 */

import React from 'react';

export interface StepTemplate {
 id: string;
 name: string;
 description?: string;
 steps: Array<{
 action: string;
 selector?: string;
 value?: string;
 text?: string;
 url?: string;
 }>;
 tags: string[];
 created_at: string;
}

interface InsertTemplateModalProps {
 isOpen: boolean;
 testId: string | null;
 templates: StepTemplate[];
 onClose: () => void;
 onInsertTemplate: (testId: string, template: StepTemplate) => void;
 onDeleteTemplate: (templateId: string) => void;
}

export function InsertTemplateModal({
 isOpen,
 testId,
 templates,
 onClose,
 onInsertTemplate,
 onDeleteTemplate,
}: InsertTemplateModalProps) {
 if (!isOpen || !testId) return null;

 return (
 <div
 className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
 onMouseDown={(e) => {
 if (e.target === e.currentTarget) {
 onClose();
 }
 }}
 >
 <div
 role="dialog"
 aria-modal="true"
 aria-labelledby="insert-template-modal-title"
 className="w-full max-w-lg rounded-xl border border-border bg-card p-4 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
 onClick={(e) => e.stopPropagation()}
 >
 <div className="flex items-center gap-3 mb-4">
 <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
 <span className="text-xl">📋</span>
 </div>
 <div>
 <h3 id="insert-template-modal-title" className="text-lg font-semibold text-foreground">Insert Template</h3>
 <p className="text-sm text-muted-foreground">
 Choose a step template to append to this test.
 </p>
 </div>
 </div>

 {templates.length === 0 ? (
 <div className="text-center py-8 text-muted-foreground">
 <p className="text-lg mb-1">No templates yet</p>
 <p className="text-sm">Save steps as a template during recording to see them here.</p>
 </div>
 ) : (
 <div className="space-y-2">
 {templates.map((tpl) => (
 <div
 key={tpl.id}
 className="rounded-lg border border-border p-3 hover:bg-muted/40 transition-colors"
 >
 <div className="flex items-center justify-between mb-1">
 <h4 className="font-medium text-sm text-foreground">{tpl.name}</h4>
 <span className="text-xs text-muted-foreground">{tpl.steps.length} steps</span>
 </div>
 {tpl.description && (
 <p className="text-xs text-muted-foreground mb-2">{tpl.description}</p>
 )}
 <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
 {tpl.steps.slice(0, 3).map((s, i) => (
 <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-xs">
 {s.action}
 </span>
 ))}
 {tpl.steps.length > 3 && <span>+{tpl.steps.length - 3} more</span>}
 </div>
 <div className="flex gap-2">
 <button
 onClick={() => onInsertTemplate(testId, tpl)}
 className="rounded-md bg-purple-500 px-3 py-1 text-xs font-medium text-white hover:bg-purple-600 transition-colors"
 >
 Insert Steps
 </button>
 <button
 onClick={() => onDeleteTemplate(tpl.id)}
 className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
 >
 Delete
 </button>
 </div>
 </div>
 ))}
 </div>
 )}

 <div className="flex justify-end pt-4 mt-4 border-t border-border">
 <button
 onClick={onClose}
 className="rounded-lg border border-border px-4 py-2 font-medium text-foreground hover:bg-muted transition-colors"
 >
 Close
 </button>
 </div>
 </div>
 </div>
 );
}

export default InsertTemplateModal;
