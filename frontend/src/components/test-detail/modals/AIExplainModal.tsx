// AIExplainModal - Extracted from TestDetailPage.tsx
// Feature #48: Split TestDetailPage.tsx into modular components

import React from 'react';

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
 <div
 className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
 onClick={(e) => e.target === e.currentTarget && !isLoading && onClose()}
 >
 <div role="dialog" aria-modal="true" aria-labelledby="explain-test-title" className="w-full max-w-4xl max-h-[85vh] rounded-lg bg-card shadow-lg flex flex-col" onClick={(e) => e.stopPropagation()}>
 {/* Header */}
 <div className="flex items-center justify-between p-6 border-b border-border">
 <div className="flex items-center gap-3">
 <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100">
 <svg className="h-6 w-6 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
 </svg>
 </div>
 <div>
 <h3 id="explain-test-title" className="text-lg font-semibold text-foreground">AI Test Explanation</h3>
 <p className="text-sm text-muted-foreground">{testName}</p>
 </div>
 </div>
 <button
 onClick={onClose}
 disabled={isLoading}
 className="text-muted-foreground hover:text-foreground disabled:opacity-50"
 >
 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <line x1="18" y1="6" x2="6" y2="18"/>
 <line x1="6" y1="6" x2="18" y2="18"/>
 </svg>
 </button>
 </div>

 {/* Body */}
 <div className="flex-1 overflow-y-auto p-6">
 {isLoading ? (
 <div className="flex flex-col items-center justify-center py-12">
 <svg className="animate-spin h-10 w-10 text-violet-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
 </svg>
 <p className="text-muted-foreground">Analyzing test code with AI...</p>
 </div>
 ) : explanation ? (
 <div className="space-y-6">
 {/* Summary Section */}
 <div className="rounded-lg border border-violet-200 bg-violet-50 p-4">
 <h4 className="font-semibold text-violet-900 mb-2">Summary</h4>
 <p className="text-violet-800">{explanation.summary}</p>
 <p className="text-sm text-violet-600 mt-2"><strong>Purpose:</strong> {explanation.purpose}</p>
 </div>

 {/* Complexity Badge */}
 <div className="flex items-center gap-4">
 <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
 explanation.complexity.level === 'simple' ? 'bg-green-100 text-green-800' :
 explanation.complexity.level === 'moderate' ? 'bg-yellow-100 text-yellow-800' :
 'bg-red-100 text-red-800'
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
 <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
 <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
 </svg>
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
 <code className="block text-xs bg-gray-800 text-gray-200 p-2 rounded mb-2 overflow-x-auto">{step.code}</code>
 <p className="text-sm text-foreground">{step.explanation}</p>
 <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded ${
 step.type === 'navigation' ? 'bg-blue-100 text-blue-700' :
 step.type === 'interaction' ? 'bg-green-100 text-green-700' :
 step.type === 'assertion' ? 'bg-purple-100 text-purple-700' :
 step.type === 'wait' ? 'bg-yellow-100 text-yellow-700' :
 'bg-gray-100 text-gray-700'
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
 <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
 <polyline points="22 4 12 14.01 9 11.01"/>
 </svg>
 Assertions ({explanation.assertions.length})
 </h4>
 <div className="space-y-2">
 {explanation.assertions.map((assertion, idx) => (
 <div key={idx} className="rounded-md border border-border p-3 bg-muted/30">
 <code className="block text-xs bg-gray-800 text-gray-200 p-2 rounded mb-2 overflow-x-auto">{assertion.code}</code>
 <p className="text-sm text-foreground">{assertion.what_it_checks}</p>
 <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded ${
 assertion.importance === 'critical' ? 'bg-red-100 text-red-700' :
 assertion.importance === 'high' ? 'bg-orange-100 text-orange-700' :
 'bg-blue-100 text-blue-700'
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
 <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
 </svg>
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
 sel.reliability === 'high' ? 'bg-green-100 text-green-700' :
 sel.reliability === 'medium' ? 'bg-yellow-100 text-yellow-700' :
 'bg-red-100 text-red-700'
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
 <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
 </svg>
 Suggested Improvements
 </h4>
 <div className="space-y-2">
 {explanation.improvements.map((imp, idx) => (
 <div key={idx} className="flex items-start gap-3 rounded-md border border-border p-3 bg-muted/30">
 <span className={`flex-shrink-0 inline-block text-xs px-2 py-0.5 rounded ${
 imp.priority === 'high' ? 'bg-red-100 text-red-700' :
 imp.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
 'bg-blue-100 text-blue-700'
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
 </div>

 {/* Footer */}
 <div className="flex justify-end gap-3 p-6 border-t border-border">
 <button
 onClick={onClose}
 className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
 >
 Close
 </button>
 </div>
 </div>
 </div>
 );
}
