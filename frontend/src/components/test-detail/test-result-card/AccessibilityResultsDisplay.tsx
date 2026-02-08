// Feature #48: AccessibilityResultsDisplay - Extracted from TestResultCard.tsx
// Displays accessibility audit results with violation filtering and export options

import React from 'react';
import { AccessibilityResults, getScoreColor, getScoreBgColor } from './types';

interface AccessibilityResultsDisplayProps {
 a11y: AccessibilityResults;
 filterKey: string;
 currentSeverityFilter: string;
 currentCategoryFilter: string;
 currentSearchQuery: string;
 expandedViolations: Set<string>;
 onToggleViolation: (id: string) => void;
 onSetSeverityFilter: (filter: string) => void;
 onSetCategoryFilter: (filter: string) => void;
 onSetSearchQuery: (query: string) => void;
 onExportPDF?: (a11yData: any, testName: string, runDate: string) => void;
 onExportCSV?: (a11yData: any, testName: string, runDate: string) => void;
 testName: string;
 formatDateTime: (date: string | Date) => string;
}

export function AccessibilityResultsDisplay({
 a11y,
 filterKey,
 currentSeverityFilter,
 currentCategoryFilter,
 currentSearchQuery,
 expandedViolations,
 onToggleViolation,
 onSetSeverityFilter,
 onSetCategoryFilter,
 onSetSearchQuery,
 onExportPDF,
 onExportCSV,
 testName,
 formatDateTime,
}: AccessibilityResultsDisplayProps) {
 return (
 <div className="mt-4 p-4 border border-border rounded-lg bg-muted/30">
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-2">
 <span className="text-lg">♿</span>
 <h4 className="text-sm font-semibold text-foreground">Accessibility Audit</h4>
 <span className={`text-xs px-2 py-0.5 rounded-full ${getScoreBgColor(a11y.score)} ${getScoreColor(a11y.score)}`}>
 {a11y.score}/100
 </span>
 </div>
 <div className="flex gap-2">
 {onExportPDF && (
 <button
 onClick={() => onExportPDF(a11y, testName, formatDateTime(new Date()))}
 className="text-xs px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20"
 >
 📄 PDF
 </button>
 )}
 {onExportCSV && (
 <button
 onClick={() => onExportCSV(a11y, testName, formatDateTime(new Date()))}
 className="text-xs px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20"
 >
 📊 CSV
 </button>
 )}
 </div>
 </div>

 {/* Summary Stats */}
 <div className="grid grid-cols-4 gap-3 mb-4">
 <div className="p-2 rounded bg-red-100 text-center">
 <div className="text-xs text-red-700">Violations</div>
 <div className="text-lg font-bold text-red-700">{a11y.violations.count}</div>
 </div>
 <div className="p-2 rounded bg-green-100 text-center">
 <div className="text-xs text-green-700">Passes</div>
 <div className="text-lg font-bold text-green-700">{a11y.passes?.count || 0}</div>
 </div>
 <div className="p-2 rounded bg-amber-100 text-center">
 <div className="text-xs text-amber-700">Incomplete</div>
 <div className="text-lg font-bold text-amber-700">{a11y.incomplete?.count || 0}</div>
 </div>
 <div className="p-2 rounded bg-gray-100 text-center">
 <div className="text-xs text-gray-600">N/A</div>
 <div className="text-lg font-bold text-gray-600">{a11y.inapplicable?.count || 0}</div>
 </div>
 </div>

 {/* Severity Breakdown */}
 {a11y.violations.count > 0 && (
 <div className="mb-4">
 <h5 className="text-xs font-medium text-muted-foreground mb-2">Violations by Severity</h5>
 <div className="flex flex-wrap gap-2">
 <button
 onClick={() => onSetSeverityFilter('all')}
 className={`px-2 py-1 text-xs rounded-full ${
 currentSeverityFilter === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100'
 }`}
 >
 All: {a11y.violations.count}
 </button>
 {a11y.violations.critical !== undefined && a11y.violations.critical > 0 && (
 <button
 onClick={() => onSetSeverityFilter('critical')}
 className={`px-2 py-1 text-xs rounded-full ${
 currentSeverityFilter === 'critical' ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700'
 }`}
 >
 Critical: {a11y.violations.critical}
 </button>
 )}
 {a11y.violations.serious !== undefined && a11y.violations.serious > 0 && (
 <button
 onClick={() => onSetSeverityFilter('serious')}
 className={`px-2 py-1 text-xs rounded-full ${
 currentSeverityFilter === 'serious' ? 'bg-orange-600 text-white' : 'bg-orange-100 text-orange-700'
 }`}
 >
 Serious: {a11y.violations.serious}
 </button>
 )}
 {a11y.violations.moderate !== undefined && a11y.violations.moderate > 0 && (
 <button
 onClick={() => onSetSeverityFilter('moderate')}
 className={`px-2 py-1 text-xs rounded-full ${
 currentSeverityFilter === 'moderate' ? 'bg-yellow-600 text-white' : 'bg-yellow-100 text-yellow-700'
 }`}
 >
 Moderate: {a11y.violations.moderate}
 </button>
 )}
 {a11y.violations.minor !== undefined && a11y.violations.minor > 0 && (
 <button
 onClick={() => onSetSeverityFilter('minor')}
 className={`px-2 py-1 text-xs rounded-full ${
 currentSeverityFilter === 'minor' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700'
 }`}
 >
 Minor: {a11y.violations.minor}
 </button>
 )}
 </div>
 </div>
 )}

 {/* Violation Items */}
 {a11y.violations.items && a11y.violations.items.length > 0 && (
 <div className="space-y-2">
 {a11y.violations.items
 .filter(v => currentSeverityFilter === 'all' || v.impact === currentSeverityFilter)
 .filter(v => !currentSearchQuery || v.description.toLowerCase().includes(currentSearchQuery.toLowerCase()))
 .map((violation, idx) => (
 <div key={violation.id || idx} className="p-3 rounded border border-border bg-background">
 <div
 className="flex items-center justify-between cursor-pointer"
 onClick={() => onToggleViolation(violation.id)}
 >
 <div className="flex items-center gap-2">
 <span className={`px-2 py-0.5 text-xs rounded-full ${
 violation.impact === 'critical' ? 'bg-red-100 text-red-700' :
 violation.impact === 'serious' ? 'bg-orange-100 text-orange-700' :
 violation.impact === 'moderate' ? 'bg-yellow-100 text-yellow-700' :
 'bg-blue-100 text-blue-700'
 }`}>
 {violation.impact}
 </span>
 <span className="text-sm font-medium">{violation.help}</span>
 </div>
 <span className="text-xs text-muted-foreground">
 {expandedViolations.has(violation.id) ? '▼' : '▶'}
 </span>
 </div>
 {expandedViolations.has(violation.id) && (
 <div className="mt-2 pt-2 border-t border-border">
 <p className="text-sm text-muted-foreground">{violation.description}</p>
 {violation.helpUrl && (
 <a
 href={violation.helpUrl}
 target="_blank"
 rel="noopener noreferrer"
 className="text-xs text-primary hover:underline mt-1 inline-block"
 >
 Learn more →
 </a>
 )}
 {violation.nodes && violation.nodes.length > 0 && (
 <div className="mt-2">
 <p className="text-xs font-medium text-muted-foreground mb-1">
 Affected Elements ({violation.nodes.length}):
 </p>
 <div className="space-y-1 max-h-40 overflow-y-auto">
 {violation.nodes.slice(0, 5).map((node, nodeIdx) => (
 <code key={nodeIdx} className="block text-xs bg-muted p-1 rounded overflow-x-auto">
 {node.html}
 </code>
 ))}
 {violation.nodes.length > 5 && (
 <p className="text-xs text-muted-foreground">
 +{violation.nodes.length - 5} more elements
 </p>
 )}
 </div>
 </div>
 )}
 </div>
 )}
 </div>
 ))}
 </div>
 )}
 </div>
 );
}
