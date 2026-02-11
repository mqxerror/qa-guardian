// Feature #48: AccessibilityResultsDisplay - Extracted from TestResultCard.tsx
// Feature #571: Replace emoji with Lucide icons for cross-browser consistency
// Displays accessibility audit results with violation filtering and export options

import React from 'react';
import { FileSpreadsheet } from 'lucide-react';
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
 onExportPDF?: (a11yData: AccessibilityResults, testName: string, runDate: string) => void;
 onExportCSV?: (a11yData: AccessibilityResults, testName: string, runDate: string) => void;
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
 <FileSpreadsheet className="h-3 w-3 inline mr-1" />CSV
 </button>
 )}
 </div>
 </div>

 {/* Summary Stats */}
 <div className="grid grid-cols-4 gap-3 mb-4">
 <div className="p-2 rounded bg-destructive/10 text-center">
 <div className="text-xs text-destructive">Violations</div>
 <div className="text-lg font-bold text-destructive">{a11y.violations.count}</div>
 </div>
 <div className="p-2 rounded bg-success/10 text-center">
 <div className="text-xs text-success">Passes</div>
 <div className="text-lg font-bold text-success">{a11y.passes?.count || 0}</div>
 </div>
 <div className="p-2 rounded bg-warning/10 text-center">
 <div className="text-xs text-warning">Incomplete</div>
 <div className="text-lg font-bold text-warning">{a11y.incomplete?.count || 0}</div>
 </div>
 <div className="p-2 rounded bg-muted text-center">
 <div className="text-xs text-foreground">N/A</div>
 <div className="text-lg font-bold text-foreground">{a11y.inapplicable?.count || 0}</div>
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
 currentSeverityFilter === 'all' ? 'bg-card text-primary-foreground' : 'bg-muted'
 }`}
 >
 All: {a11y.violations.count}
 </button>
 {a11y.violations.critical !== undefined && a11y.violations.critical > 0 && (
 <button
 onClick={() => onSetSeverityFilter('critical')}
 className={`px-2 py-1 text-xs rounded-full ${
 currentSeverityFilter === 'critical' ? 'bg-destructive text-primary-foreground' : 'bg-destructive/10 text-destructive'
 }`}
 >
 Critical: {a11y.violations.critical}
 </button>
 )}
 {a11y.violations.serious !== undefined && a11y.violations.serious > 0 && (
 <button
 onClick={() => onSetSeverityFilter('serious')}
 className={`px-2 py-1 text-xs rounded-full ${
 currentSeverityFilter === 'serious' ? 'bg-warning text-primary-foreground' : 'bg-warning/10 text-warning'
 }`}
 >
 Serious: {a11y.violations.serious}
 </button>
 )}
 {a11y.violations.moderate !== undefined && a11y.violations.moderate > 0 && (
 <button
 onClick={() => onSetSeverityFilter('moderate')}
 className={`px-2 py-1 text-xs rounded-full ${
 currentSeverityFilter === 'moderate' ? 'bg-warning text-primary-foreground' : 'bg-warning/10 text-warning'
 }`}
 >
 Moderate: {a11y.violations.moderate}
 </button>
 )}
 {a11y.violations.minor !== undefined && a11y.violations.minor > 0 && (
 <button
 onClick={() => onSetSeverityFilter('minor')}
 className={`px-2 py-1 text-xs rounded-full ${
 currentSeverityFilter === 'minor' ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'
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
 violation.impact === 'critical' ? 'bg-destructive/10 text-destructive' :
 violation.impact === 'serious' ? 'bg-warning/10 text-warning' :
 violation.impact === 'moderate' ? 'bg-info/10 text-info' :
 'bg-primary/10 text-primary'
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
