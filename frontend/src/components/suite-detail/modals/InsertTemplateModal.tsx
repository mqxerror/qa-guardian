/**
 * InsertTemplateModal Component
 * Feature #50: Extract modals from TestSuitePage.tsx
 * Feature #31: Step Templates for test recording
 * Feature #127: Mobile responsive design audit and fixes
 * Feature #634: Migrated to Modal/ModalBody/ModalFooter
 */

import React from 'react';
import { Modal, ModalBody, ModalFooter } from '../../ui/Modal';

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
 <Modal isOpen onClose={onClose} title="Insert Template" size="lg">
 {/* Custom Header with icon */}
 <div className="flex items-center gap-3 p-4 sm:p-6 border-b border-border">
 <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
 <span className="text-xl">📋</span>
 </div>
 <div>
 <h3 className="text-lg font-semibold text-foreground">Insert Template</h3>
 <p className="text-sm text-muted-foreground">
 Choose a step template to append to this test.
 </p>
 </div>
 </div>
 <ModalBody>
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
 className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-accent-foreground hover:bg-accent/90 transition-colors"
 >
 Insert Steps
 </button>
 <button
 onClick={() => onDeleteTemplate(tpl.id)}
 className="rounded-md border border-destructive/20 px-3 py-1 text-xs font-medium text-destructive hover:bg-destructive/5 transition-colors"
 >
 Delete
 </button>
 </div>
 </div>
 ))}
 </div>
 )}
 </ModalBody>
 <ModalFooter>
 <button
 onClick={onClose}
 className="rounded-lg border border-border px-4 py-2 font-medium text-foreground hover:bg-muted transition-colors"
 >
 Close
 </button>
 </ModalFooter>
 </Modal>
 );
}

export default InsertTemplateModal;
