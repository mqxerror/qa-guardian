/**
 * AccessibilityTab - Accessibility audit results display
 * Extracted from TestRunResultPage.tsx for modularity (Feature #46)
 */

import React, { useState } from 'react';
import { TestResult, AccessibilityViolation, A11yViewMode } from './types';

interface AccessibilityTabProps {
 accessibilityResults: TestResult[];
 onAnalyzeAccessibility: (testName: string, a11y: any) => Promise<void>;
 aiLoading: boolean;
 aiAnalysisOpen: string | null;
 aiResult: Record<string, string>;
 aiError: string | null;
 setAiResult: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

// Calculate accessibility score based on violations and passes
const calculateA11yScore = (violations: AccessibilityViolation[], passes: number): number => {
 const criticalCount = violations.filter(v => v.impact === 'critical').length;
 const seriousCount = violations.filter(v => v.impact === 'serious').length;
 const moderateCount = violations.filter(v => v.impact === 'moderate').length;
 const minorCount = violations.filter(v => v.impact === 'minor').length;

 // Weight violations by severity
 const violationScore = (criticalCount * 40) + (seriousCount * 20) + (moderateCount * 10) + (minorCount * 5);
 const totalChecks = passes + violations.length;

 if (totalChecks === 0) return 100;

 // Calculate score (max 100)
 const score = Math.max(0, Math.round(100 - violationScore));
 return Math.min(100, score);
};

// Group violations by severity
const groupViolationsBySeverity = (violations: AccessibilityViolation[]): Record<string, AccessibilityViolation[]> => {
 return violations.reduce((groups, violation) => {
 const severity = violation.impact || 'minor';
 if (!groups[severity]) groups[severity] = [];
 groups[severity].push(violation);
 return groups;
 }, {} as Record<string, AccessibilityViolation[]>);
};

// Get fix suggestion for a violation
const getFixSuggestion = (violation: AccessibilityViolation): string => {
 const suggestions: Record<string, string> = {
 'color-contrast': 'Increase the contrast ratio between text and background colors. Use tools like WebAIM contrast checker.',
 'image-alt': 'Add descriptive alt text to images. For decorative images, use alt="".',
 'label': 'Add a visible label or aria-label to form elements.',
 'link-name': 'Add descriptive text inside links or use aria-label.',
 'button-name': 'Add text content inside buttons or use aria-label.',
 'heading-order': 'Ensure headings follow a logical order (h1 → h2 → h3).',
 'landmark-one-main': 'Add a main landmark element with role="main" or <main> tag.',
 'region': 'Wrap content in landmark regions like <nav>, <main>, <aside>.',
 'aria-hidden-focus': 'Remove focusable elements from aria-hidden containers.',
 'duplicate-id': 'Ensure each id attribute is unique on the page.',
 };

 return suggestions[violation.id] || violation.help || 'Review the WCAG documentation for guidance on fixing this issue.';
};

export default function AccessibilityTab({
 accessibilityResults,
 onAnalyzeAccessibility,
 aiLoading,
 aiAnalysisOpen,
 aiResult,
 aiError,
 setAiResult,
}: AccessibilityTabProps) {
 // Local state for this tab
 const [a11yViewMode, setA11yViewMode] = useState<A11yViewMode>('grouped');
 const [a11yExpandedSeverities, setA11yExpandedSeverities] = useState<Set<string>>(new Set(['critical', 'serious']));
 const [a11yExpandedViolations, setA11yExpandedViolations] = useState<Set<string>>(new Set());

 const toggleA11ySeverity = (severity: string) => {
 setA11yExpandedSeverities(prev => {
 const next = new Set(prev);
 if (next.has(severity)) {
 next.delete(severity);
 } else {
 next.add(severity);
 }
 return next;
 });
 };

 const toggleA11yViolation = (violationId: string) => {
 setA11yExpandedViolations(prev => {
 const next = new Set(prev);
 if (next.has(violationId)) {
 next.delete(violationId);
 } else {
 next.add(violationId);
 }
 return next;
 });
 };

 const severityOrder: ('critical' | 'serious' | 'moderate' | 'minor')[] = ['critical', 'serious', 'moderate', 'minor'];

 return (
 <div>
 {/* Header with view mode controls */}
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
 <div>
 <h2 className="text-lg font-semibold text-foreground">Accessibility Audit Report</h2>
 <p className="text-sm text-muted-foreground">
 {accessibilityResults.length} test{accessibilityResults.length !== 1 ? 's' : ''} with accessibility data
 </p>
 </div>
 <div className="flex items-center gap-2">
 {/* View mode toggle */}
 <div className="flex items-center bg-muted rounded-lg p-1">
 <button
 onClick={() => setA11yViewMode('grouped')}
 className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
 a11yViewMode === 'grouped'
 ? 'bg-background text-foreground shadow-sm'
 : 'text-muted-foreground hover:text-foreground'
 }`}
 >
 Grouped by Severity
 </button>
 <button
 onClick={() => setA11yViewMode('list')}
 className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
 a11yViewMode === 'list'
 ? 'bg-background text-foreground shadow-sm'
 : 'text-muted-foreground hover:text-foreground'
 }`}
 >
 Full List
 </button>
 </div>
 </div>
 </div>

 {accessibilityResults.length === 0 ? (
 <div className="text-center py-12 border border-dashed border-border rounded-lg">
 <svg className="w-12 h-12 mx-auto text-success mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
 </svg>
 <p className="text-foreground font-medium">No accessibility violations found!</p>
 <p className="text-sm text-muted-foreground mt-1">Your tests passed all accessibility checks. Great job!</p>
 </div>
 ) : (
 <div className="space-y-6">
 {accessibilityResults.map((result, idx) => {
 const a11y = result.steps.find(s => s.accessibility)?.accessibility;
 if (!a11y) return null;

 const score = calculateA11yScore(a11y.violations, a11y.passes);
 const violationGroups = groupViolationsBySeverity(a11y.violations);

 return (
 <div key={idx} className="border border-border rounded-lg overflow-hidden">
 {/* Header */}
 <div className="p-4 bg-muted/30 border-b border-border">
 <div className="flex items-center justify-between mb-4">
 <div>
 <h3 className="font-medium text-foreground">{result.test_name}</h3>
 {a11y.axeVersion && (
 <p className="text-xs text-muted-foreground mt-1">
 Tested with axe-core {a11y.axeVersion}
 </p>
 )}
 </div>
 <div className="flex items-center gap-3">
 {a11y.wcagLevel && (
 <span className="px-3 py-1 text-sm rounded-lg bg-primary/10 text-primary font-medium">
 {a11y.wcagLevel}
 </span>
 )}
 {/* AI Analysis button */}
 <button
 onClick={() => onAnalyzeAccessibility(result.test_name, a11y)}
 disabled={aiLoading && aiAnalysisOpen === result.test_name}
 className="px-3 py-1.5 text-sm bg-gradient-to-r from-accent to-accent/80 text-accent-foreground rounded-lg hover:from-accent/90 hover:to-accent/70 transition-colors flex items-center gap-1.5 disabled:opacity-50"
 title="AI Accessibility Analysis"
 >
 {aiLoading && aiAnalysisOpen === result.test_name ? (
 <>
 <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
 </svg>
 Analyzing...
 </>
 ) : (
 <>
 <span>🤖</span>
 AI Fix Help
 </>
 )}
 </button>
 </div>
 </div>

 {/* AI Analysis Results Panel */}
 {aiResult[result.test_name] && (
 <div className="mt-4 p-4 bg-gradient-to-r from-accent/10 to-accent/5 border border-accent/20 rounded-xl">
 <div className="flex items-center justify-between mb-3">
 <div className="flex items-center gap-2">
 <span className="text-xl">🤖</span>
 <h4 className="font-semibold text-accent">AI Accessibility Analysis</h4>
 </div>
 <button
 onClick={() => setAiResult(prev => {
 const newResult = { ...prev };
 delete newResult[result.test_name];
 return newResult;
 })}
 className="text-muted-foreground hover:text-foreground p-1"
 title="Close analysis"
 >
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 </div>
 <div className="prose prose-sm max-w-none">
 <div className="whitespace-pre-wrap text-sm text-foreground">
 {aiResult[result.test_name]}
 </div>
 </div>
 </div>
 )}

 {/* AI Analysis Error */}
 {aiError && aiAnalysisOpen === result.test_name && (
 <div className="mt-4 p-4 bg-destructive/5 border border-destructive/20 rounded-xl">
 <div className="flex items-center gap-2 text-destructive">
 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
 </svg>
 <span className="text-sm">{aiError}</span>
 </div>
 </div>
 )}

 {/* Score and summary stats */}
 <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
 {/* A11y Score Gauge */}
 <div className="col-span-2 md:col-span-1 flex justify-center">
 <div className="relative w-20 h-20">
 <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 80 80">
 <circle
 cx="40" cy="40" r="35"
 fill="none" stroke="currentColor" strokeWidth="8"
 className="text-muted/30"
 />
 <circle
 cx="40" cy="40" r="35"
 fill="none" strokeWidth="8" strokeLinecap="round"
 stroke={score >= 90 ? '#22c55e' : score >= 50 ? '#eab308' : '#ef4444'}
 strokeDasharray={`${(score / 100) * 220} 220`}
 />
 </svg>
 <div className="absolute inset-0 flex items-center justify-center">
 <span className={`text-lg font-bold ${score >= 90 ? 'text-success' : score >= 50 ? 'text-warning' : 'text-destructive'}`}>
 {score}
 </span>
 </div>
 </div>
 </div>

 {/* Severity badges */}
 {severityOrder.map(severity => {
 const count = violationGroups[severity]?.length || 0;
 const colors = {
 critical: { bg: 'bg-destructive/10', text: 'text-destructive', badge: 'bg-destructive' },
 serious: { bg: 'bg-warning/10', text: 'text-warning', badge: 'bg-warning' },
 moderate: { bg: 'bg-warning/10', text: 'text-warning', badge: 'bg-warning' },
 minor: { bg: 'bg-primary/10', text: 'text-primary', badge: 'bg-primary' },
 };
 return (
 <div key={severity} className={`p-3 rounded-lg text-center ${colors[severity].bg}`}>
 <div className={`text-xl font-bold ${colors[severity].text}`}>{count}</div>
 <div className="text-xs text-muted-foreground capitalize">{severity}</div>
 </div>
 );
 })}

 {/* Pass rate */}
 <div className="p-3 bg-success/10 rounded-lg text-center">
 <div className="text-xl font-bold text-success">{a11y.passes}</div>
 <div className="text-xs text-muted-foreground">Passed</div>
 </div>
 </div>
 </div>

 {/* Violations content */}
 <div className="p-4">
 {a11yViewMode === 'grouped' ? (
 /* Grouped view by severity */
 <div className="space-y-4">
 {severityOrder.map(severity => {
 const violations = violationGroups[severity];
 if (!violations || violations.length === 0) return null;

 const isExpanded = a11yExpandedSeverities.has(severity);
 const colors = {
 critical: { border: 'border-destructive', header: 'bg-destructive/5', badge: 'bg-destructive text-white' },
 serious: { border: 'border-warning', header: 'bg-warning/10', badge: 'bg-warning text-white' },
 moderate: { border: 'border-warning', header: 'bg-warning/5', badge: 'bg-warning text-white' },
 minor: { border: 'border-primary', header: 'bg-primary/5', badge: 'bg-primary text-white' },
 };

 return (
 <div key={severity} className={`border ${colors[severity].border} rounded-lg overflow-hidden`}>
 <button
 onClick={() => toggleA11ySeverity(severity)}
 className={`w-full p-3 ${colors[severity].header} flex items-center justify-between hover:opacity-80 transition-opacity`}
 >
 <div className="flex items-center gap-3">
 <svg
 className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
 fill="none" viewBox="0 0 24 24" stroke="currentColor"
 >
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
 </svg>
 <span className={`px-2 py-0.5 text-xs font-medium rounded ${colors[severity].badge}`}>
 {severity.toUpperCase()}
 </span>
 <span className="font-medium text-foreground">
 {violations.length} violation{violations.length !== 1 ? 's' : ''}
 </span>
 </div>
 <span className="text-sm text-muted-foreground">
 {isExpanded ? 'Click to collapse' : 'Click to expand'}
 </span>
 </button>

 {isExpanded && (
 <div className="divide-y divide-border">
 {violations.map((violation, vIdx) => {
 const violationKey = `${idx}-${severity}-${vIdx}`;
 const isViolationExpanded = a11yExpandedViolations.has(violationKey);

 return (
 <div key={vIdx} className="bg-background">
 <button
 onClick={() => toggleA11yViolation(violationKey)}
 className="w-full p-4 text-left hover:bg-muted/30 transition-colors"
 >
 <div className="flex items-start justify-between">
 <div className="flex-1">
 <div className="flex items-center gap-2 mb-1">
 <svg
 className={`w-4 h-4 transition-transform flex-shrink-0 ${isViolationExpanded ? 'rotate-90' : ''}`}
 fill="none" viewBox="0 0 24 24" stroke="currentColor"
 >
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
 </svg>
 <code className="text-sm font-mono text-foreground">{violation.id}</code>
 {violation.nodes && (
 <span className="px-1.5 py-0.5 text-xs bg-muted rounded text-muted-foreground">
 {violation.nodes.length} element{violation.nodes.length !== 1 ? 's' : ''}
 </span>
 )}
 </div>
 <p className="text-sm text-foreground ml-6">{violation.description}</p>
 </div>
 {violation.helpUrl && (
 <a
 href={violation.helpUrl}
 target="_blank"
 rel="noopener noreferrer"
 onClick={(e) => e.stopPropagation()}
 className="text-primary hover:underline text-sm whitespace-nowrap ml-4"
 >
 WCAG Docs →
 </a>
 )}
 </div>
 </button>

 {isViolationExpanded && (
 <div className="px-4 pb-4 ml-6 space-y-4">
 {/* Fix suggestion */}
 <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
 <h5 className="font-medium text-primary mb-1 flex items-center gap-2">
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
 </svg>
 How to Fix
 </h5>
 <p className="text-sm text-primary">
 {getFixSuggestion(violation)}
 </p>
 </div>

 {/* WCAG tags */}
 {violation.wcagTags && violation.wcagTags.length > 0 && (
 <div>
 <h5 className="text-sm font-medium text-foreground mb-2">WCAG Criteria</h5>
 <div className="flex gap-1 flex-wrap">
 {violation.wcagTags.map(tag => (
 <a
 key={tag}
 href={`https://www.w3.org/WAI/WCAG21/Understanding/${tag.toLowerCase().replace(/\./g, '')}`}
 target="_blank"
 rel="noopener noreferrer"
 className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded font-mono hover:bg-primary/20 transition-colors"
 >
 {tag}
 </a>
 ))}
 </div>
 </div>
 )}

 {/* Affected elements */}
 {violation.nodes && violation.nodes.length > 0 && (
 <div>
 <h5 className="text-sm font-medium text-foreground mb-2">
 Affected Elements ({violation.nodes.length})
 </h5>
 <div className="space-y-2 max-h-60 overflow-auto">
 {violation.nodes.map((node, nIdx) => (
 <div key={nIdx} className="p-3 bg-muted/30 rounded-lg">
 <div className="mb-2">
 <span className="text-xs text-muted-foreground">CSS Selector:</span>
 <code className="text-xs block font-mono text-foreground mt-0.5 bg-muted px-2 py-1 rounded">
 {node.target.join(' > ')}
 </code>
 </div>
 <div className="mb-2">
 <span className="text-xs text-muted-foreground">HTML:</span>
 <code className="text-xs block font-mono text-foreground mt-0.5 bg-muted px-2 py-1 rounded overflow-auto max-h-20">
 {node.html}
 </code>
 </div>
 {node.failureSummary && (
 <div>
 <span className="text-xs text-muted-foreground">Issue:</span>
 <p className="text-xs text-destructive mt-0.5">
 {node.failureSummary}
 </p>
 </div>
 )}
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 )}
 </div>
 );
 })}
 </div>
 )}
 </div>
 );
 })}
 </div>
 ) : (
 /* List view - all violations */
 <div className="space-y-3">
 {a11y.violations.map((violation, vIdx) => (
 <div
 key={vIdx}
 className={`p-4 rounded-lg border ${
 violation.impact === 'critical' ? 'border-destructive bg-destructive/5' :
 violation.impact === 'serious' ? 'border-warning bg-warning/10' :
 violation.impact === 'moderate' ? 'border-warning bg-warning/5' :
 'border-primary bg-primary/5'
 }`}
 >
 <div className="flex items-start justify-between mb-2">
 <div className="flex items-center gap-2">
 <span className={`px-2 py-0.5 text-xs font-medium rounded text-white ${
 violation.impact === 'critical' ? 'bg-destructive' :
 violation.impact === 'serious' ? 'bg-warning' :
 violation.impact === 'moderate' ? 'bg-warning' :
 'bg-primary'
 }`}>
 {violation.impact}
 </span>
 <code className="text-sm font-mono text-foreground">{violation.id}</code>
 </div>
 {violation.helpUrl && (
 <a
 href={violation.helpUrl}
 target="_blank"
 rel="noopener noreferrer"
 className="text-primary hover:underline text-sm"
 >
 Learn more →
 </a>
 )}
 </div>
 <p className="text-foreground mb-2">{violation.description}</p>
 <p className="text-sm text-muted-foreground mb-3">{violation.help}</p>

 {violation.wcagTags && violation.wcagTags.length > 0 && (
 <div className="flex gap-1 flex-wrap mb-3">
 {violation.wcagTags.map(tag => (
 <span key={tag} className="px-2 py-0.5 text-xs bg-muted rounded font-mono">
 {tag}
 </span>
 ))}
 </div>
 )}

 {violation.nodes && violation.nodes.length > 0 && (
 <div className="pt-3 border-t border-border/50">
 <p className="text-sm font-medium text-foreground mb-2">
 Affected elements ({violation.nodes.length}):
 </p>
 <div className="space-y-2 max-h-48 overflow-auto">
 {violation.nodes.slice(0, 5).map((node, nIdx) => (
 <div key={nIdx} className="p-2 bg-muted/50 rounded text-sm">
 <code className="text-xs block font-mono text-muted-foreground overflow-auto">
 {node.html}
 </code>
 <p className="text-xs text-muted-foreground mt-1">
 Target: {node.target.join(' > ')}
 </p>
 </div>
 ))}
 {violation.nodes.length > 5 && (
 <p className="text-xs text-muted-foreground">
 ... and {violation.nodes.length - 5} more elements
 </p>
 )}
 </div>
 </div>
 )}
 </div>
 ))}
 </div>
 )}
 </div>
 </div>
 );
 })}
 </div>
 )}
 </div>
 );
}
