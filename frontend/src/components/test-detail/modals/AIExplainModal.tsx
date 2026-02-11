// AIExplainModal - Extracted from TestDetailPage.tsx
// Feature #48: Split TestDetailPage.tsx into modular components
// Feature #633: Migrated to Modal/ModalHeader/ModalBody/ModalFooter

import React from 'react';
import { Lightbulb, X, Loader2, List, CheckCircle, Search, Star } from 'lucide-react';
import { Modal, ModalBody, ModalFooter } from '../../ui/Modal';

// Types for test explanation
export interface TestExplanation {
 summary: string;
 purpose: string;
 steps: Array<{ line: number; code: string; explanation: string; type: string }>;
 assertions: Array<{ line: number; code: string; what_it_checks: string; importance: string }>;
 selectors: Array<{ selector: string; strategy: string; reliability: string; suggestion?: string }>;
 improvements: Array<{ category: string; suggestion: string; priority: string }>;
 complexity: { level: string; lines_of_code: number; num_assertions: number; num_steps: number };
}

interface AIExplainModalProps {
 show: boolean;
 testName: string;
 isLoading: boolean;
 explanation: TestExplanation | null;
 onClose: () => void;
}

export function AIExplainModal({
 show,
 testName,
 isLoading,
 explanation,
 onClose,
}: AIExplainModalProps) {
 if (!show) return null;

 return (
 <Modal isOpen onClose={onClose} title="AI Test Explanation" size="full" closeOnBackdrop={!isLoading}>
 {/* Custom Header with icon */}
 <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border">
 <div className="flex items-center gap-3">
 <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
 <Lightbulb className="h-6 w-6 text-accent" />
 </div>
 <div>
 <h2 className="text-lg font-semibold text-foreground">AI Test Explanation</h2>
 <p className="text-sm text-muted-foreground">{testName}</p>
 </div>
 </div>
 <button
 onClick={onClose}
 disabled={isLoading}
 className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
 aria-label="Close modal"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 {/* Body */}
 <ModalBody className="flex-1 overflow-y-auto">
 {isLoading ? (
 <div className="flex flex-col items-center justify-center py-12">
 <Loader2 className="animate-spin h-10 w-10 text-accent mb-4" />
 <p className="text-muted-foreground">Analyzing test code with AI...</p>
 </div>
 ) : explanation ? (
 <div className="space-y-6">
 {/* Summary Section */}
 <div className="rounded-lg border border-accent/20 bg-accent/5 p-4">
 <h4 className="font-semibold text-accent mb-2">Summary</h4>
 <p className="text-accent/90">{explanation.summary}</p>
 <p className="text-sm text-accent/80 mt-2"><strong>Purpose:</strong> {explanation.purpose}</p>
 </div>

 {/* Complexity Badge */}
 <div className="flex items-center gap-4">
 <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
 explanation.complexity.level === 'simple' ? 'bg-success/10 text-success' :
 explanation.complexity.level === 'moderate' ? 'bg-warning/10 text-warning' :
 'bg-destructive/10 text-destructive'
 }`}>
 {explanation.complexity.level.charAt(0).toUpperCase() + explanation.complexity.level.slice(1)} Complexity
 </span>
 <span className="text-sm text-muted-foreground">
 {explanation.complexity.lines_of_code} lines • {explanation.complexity.num_steps} steps • {explanation.complexity.num_assertions} assertions
 </span>
 </div>

 {/* Steps Section */}
 {explanation.steps.length > 0 && (
 <div>
 <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
 <List size={18} />
 Step-by-Step Breakdown
 </h4>
 <div className="space-y-3">
 {explanation.steps.map((step, idx) => (
 <div key={idx} className="rounded-md border border-border p-3 bg-muted/30">
 <div className="flex items-start gap-3">
 <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
 {idx + 1}
 </span>
 <div className="flex-1 min-w-0">
 <code className="block text-xs bg-card text-foreground p-2 rounded mb-2 overflow-x-auto">{step.code}</code>
 <p className="text-sm text-foreground">{step.explanation}</p>
 <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded ${
 step.type === 'navigation' ? 'bg-primary/10 text-primary' :
 step.type === 'interaction' ? 'bg-success/10 text-success' :
 step.type === 'assertion' ? 'bg-accent/10 text-accent' :
 step.type === 'wait' ? 'bg-warning/10 text-warning' :
 'bg-muted text-foreground'
 }`}>{step.type}</span>
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Assertions Section */}
 {explanation.assertions.length > 0 && (
 <div>
 <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
 <CheckCircle size={18} />
 Assertions ({explanation.assertions.length})
 </h4>
 <div className="space-y-2">
 {explanation.assertions.map((assertion, idx) => (
 <div key={idx} className="rounded-md border border-border p-3 bg-muted/30">
 <code className="block text-xs bg-card text-foreground p-2 rounded mb-2 overflow-x-auto">{assertion.code}</code>
 <p className="text-sm text-foreground">{assertion.what_it_checks}</p>
 <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded ${
 assertion.importance === 'critical' ? 'bg-destructive/10 text-destructive' :
 assertion.importance === 'high' ? 'bg-warning/10 text-warning' :
 'bg-primary/10 text-primary'
 }`}>{assertion.importance} importance</span>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Selectors Section */}
 {explanation.selectors.length > 0 && (
 <div>
 <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
 <Search size={18} />
 Selectors ({explanation.selectors.length})
 </h4>
 <div className="overflow-x-auto">
 <table className="min-w-full text-sm">
 <thead>
 <tr className="border-b border-border">
 <th className="text-left py-2 px-3 font-medium text-muted-foreground">Selector</th>
 <th className="text-left py-2 px-3 font-medium text-muted-foreground">Strategy</th>
 <th className="text-left py-2 px-3 font-medium text-muted-foreground">Reliability</th>
 <th className="text-left py-2 px-3 font-medium text-muted-foreground">Suggestion</th>
 </tr>
 </thead>
 <tbody>
 {explanation.selectors.map((sel, idx) => (
 <tr key={idx} className="border-b border-border/50">
 <td className="py-2 px-3"><code className="text-xs bg-muted px-1 py-0.5 rounded">{sel.selector}</code></td>
 <td className="py-2 px-3 text-foreground">{sel.strategy}</td>
 <td className="py-2 px-3">
 <span className={`inline-block text-xs px-2 py-0.5 rounded ${
 sel.reliability === 'high' ? 'bg-success/10 text-success' :
 sel.reliability === 'medium' ? 'bg-warning/10 text-warning' :
 'bg-destructive/10 text-destructive'
 }`}>{sel.reliability}</span>
 </td>
 <td className="py-2 px-3 text-muted-foreground text-xs">{sel.suggestion || '-'}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 )}

 {/* Improvements Section */}
 {explanation.improvements.length > 0 && (
 <div>
 <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
 <Star size={18} />
 Suggested Improvements
 </h4>
 <div className="space-y-2">
 {explanation.improvements.map((imp, idx) => (
 <div key={idx} className="flex items-start gap-3 rounded-md border border-border p-3 bg-muted/30">
 <span className={`flex-shrink-0 inline-block text-xs px-2 py-0.5 rounded ${
 imp.priority === 'high' ? 'bg-destructive/10 text-destructive' :
 imp.priority === 'medium' ? 'bg-warning/10 text-warning' :
 'bg-primary/10 text-primary'
 }`}>{imp.priority}</span>
 <div>
 <span className="text-xs text-muted-foreground uppercase tracking-wide">{imp.category}</span>
 <p className="text-sm text-foreground">{imp.suggestion}</p>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 ) : (
 <div className="text-center py-12 text-muted-foreground">
 No explanation available.
 </div>
 )}
 </ModalBody>

 {/* Footer */}
 <ModalFooter className="border-t border-border">
 <button
 onClick={onClose}
 className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
 >
 Close
 </button>
 </ModalFooter>
 </Modal>
 );
}
