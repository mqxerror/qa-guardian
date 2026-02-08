/**
 * SASTScanResults - SAST scan results display with findings
 * Feature #102: Extracted from SecurityTab.tsx
 */
import { SASTScanResult, SASTFinding } from '../types';

export interface SASTScanResultsProps {
 sastScans: SASTScanResult[];
 selectedScan: SASTScanResult | null;
 expandedRemediations: Set<string>;
 setSelectedScan: (scan: SASTScanResult | null) => void;
 setShowFalsePositiveModal: (show: boolean) => void;
 setSelectedFinding: (finding: SASTFinding | null) => void;
 toggleRemediation: (id: string) => void;
}

export function SASTScanResults(props: SASTScanResultsProps) {
 const {
 sastScans,
 selectedScan,
 expandedRemediations,
 setSelectedScan,
 setShowFalsePositiveModal,
 setSelectedFinding,
 toggleRemediation,
 } = props;

 return (
 <div className="rounded-lg border border-border bg-card p-6">
 <h3 className="text-lg font-semibold text-foreground mb-4">Recent Scan Results</h3>
 <div className="space-y-4">
 {sastScans.map((scan) => (
 <div
 key={scan.id}
 className={`rounded-lg border p-4 cursor-pointer transition-colors ${
 selectedScan?.id === scan.id
 ? 'border-orange-500 bg-orange-50/50'
 : 'border-border hover:border-orange-300'
 }`}
 onClick={() => setSelectedScan(selectedScan?.id === scan.id ? null : scan)}
 >
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <ScanStatusIcon scan={scan} />
 <div>
 <p className="font-medium text-foreground">
 {scan.status === 'completed' ? `${scan.summary.total} findings` :
 scan.status === 'running' ? 'Scan in progress...' : 'Scan failed'}
 </p>
 <p className="text-xs text-muted-foreground">
 {new Date(scan.startedAt).toLocaleString()}
 {scan.branch && ` • Branch: ${scan.branch}`}
 </p>
 </div>
 </div>
 {scan.status === 'completed' && <SeveritySummary summary={scan.summary} />}
 </div>

 {/* Expanded findings view */}
 {selectedScan?.id === scan.id && scan.findings.length > 0 && (
 <div className="mt-4 border-t border-border pt-4">
 <h4 className="text-sm font-medium text-foreground mb-3">Findings</h4>
 <div className="space-y-3 max-h-96 overflow-y-auto">
 {scan.findings.map((finding) => (
 <FindingCard
 key={finding.id}
 finding={finding}
 expandedRemediations={expandedRemediations}
 toggleRemediation={toggleRemediation}
 setShowFalsePositiveModal={setShowFalsePositiveModal}
 setSelectedFinding={setSelectedFinding}
 />
 ))}
 </div>
 </div>
 )}
 </div>
 ))}
 </div>
 </div>
 );
}

// Helper component for scan status icon
function ScanStatusIcon({ scan }: { scan: SASTScanResult }) {
 const colorClasses = scan.status === 'completed' && scan.summary.bySeverity.critical > 0
 ? 'bg-destructive/10 text-destructive'
 : scan.status === 'completed' && scan.summary.bySeverity.high > 0
 ? 'bg-orange-100 text-orange-600'
 : scan.status === 'completed' && scan.summary.bySeverity.medium > 0
 ? 'bg-warning/10 text-warning'
 : scan.status === 'completed'
 ? 'bg-success/10 text-success'
 : scan.status === 'failed'
 ? 'bg-destructive/10 text-destructive'
 : 'bg-primary/10 text-primary';

 return (
 <div className={`flex h-10 w-10 items-center justify-center rounded-full ${colorClasses}`}>
 {scan.status === 'running' ? (
 <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
 </svg>
 ) : scan.status === 'completed' ? (
 <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
 </svg>
 ) : (
 <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 )}
 </div>
 );
}

// Helper component for severity summary
function SeveritySummary({ summary }: { summary: SASTScanResult['summary'] }) {
 return (
 <div className="flex items-center gap-4 text-sm">
 {summary.bySeverity.critical > 0 && (
 <span className="flex items-center gap-1 text-destructive">
 <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
 <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
 </svg>
 {summary.bySeverity.critical} critical
 </span>
 )}
 {summary.bySeverity.high > 0 && (
 <span className="flex items-center gap-1 text-orange-600">
 <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
 <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
 </svg>
 {summary.bySeverity.high} high
 </span>
 )}
 {summary.bySeverity.medium > 0 && (
 <span className="flex items-center gap-1 text-warning">
 {summary.bySeverity.medium} medium
 </span>
 )}
 {summary.bySeverity.low > 0 && (
 <span className="flex items-center gap-1 text-primary">
 {summary.bySeverity.low} low
 </span>
 )}
 </div>
 );
}

// Finding Card Component
interface FindingCardProps {
 finding: SASTFinding;
 expandedRemediations: Set<string>;
 toggleRemediation: (id: string) => void;
 setShowFalsePositiveModal: (show: boolean) => void;
 setSelectedFinding: (finding: SASTFinding | null) => void;
}

function FindingCard({
 finding,
 expandedRemediations,
 toggleRemediation,
 setShowFalsePositiveModal,
 setSelectedFinding,
}: FindingCardProps) {
 const borderColorClass = finding.isFalsePositive
 ? 'border-border bg-muted/50 opacity-60'
 : finding.severity === 'CRITICAL'
 ? 'border-destructive/20 bg-destructive/5/50'
 : finding.severity === 'HIGH'
 ? 'border-orange-200 bg-orange-50/50'
 : finding.severity === 'MEDIUM'
 ? 'border-warning/20 bg-warning/5/50'
 : 'border-primary/20 bg-primary/5/50';

 const severityColorClass = finding.isFalsePositive
 ? 'bg-muted text-foreground'
 : finding.severity === 'CRITICAL'
 ? 'bg-destructive/10 text-destructive'
 : finding.severity === 'HIGH'
 ? 'bg-orange-100 text-orange-800'
 : finding.severity === 'MEDIUM'
 ? 'bg-warning/10 text-warning'
 : 'bg-primary/10 text-primary';

 return (
 <div className={`rounded-md border p-3 ${borderColorClass}`}>
 <div className="flex items-start gap-3">
 <div className="flex flex-col gap-1">
 <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${severityColorClass}`}>
 {finding.severity}
 </span>
 {finding.isFalsePositive && (
 <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs text-foreground">
 False Positive
 </span>
 )}
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-start justify-between gap-2">
 <p className={`font-medium text-foreground ${finding.isFalsePositive ? 'line-through' : ''}`}>
 {finding.ruleName}
 </p>
 {!finding.isFalsePositive && (
 <button
 onClick={(e) => {
 e.stopPropagation();
 setSelectedFinding(finding);
 setShowFalsePositiveModal(true);
 }}
 className="shrink-0 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
 >
 Mark False Positive
 </button>
 )}
 </div>
 <p className={`text-sm text-muted-foreground mt-1 ${finding.isFalsePositive ? 'line-through' : ''}`}>
 {finding.message}
 </p>
 <p className="text-xs text-muted-foreground mt-2 font-mono">
 {finding.filePath}:{finding.line}
 {finding.column && `:${finding.column}`}
 </p>
 {finding.snippet && (
 <pre className="mt-2 p-2 bg-muted/50 rounded text-xs font-mono overflow-x-auto">
 {finding.snippet}
 </pre>
 )}
 <div className="mt-2 flex flex-wrap gap-2">
 {finding.cweId && (
 <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700">
 {finding.cweId}
 </span>
 )}
 {finding.owaspCategory && (
 <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700">
 {finding.owaspCategory}
 </span>
 )}
 </div>
 {finding.suggestion && !finding.isFalsePositive && (
 <div className="mt-2 p-2 rounded bg-success/5 border border-success/20">
 <p className="text-xs text-success">
 <strong>Suggestion:</strong> {finding.suggestion}
 </p>
 </div>
 )}

 {/* Remediation Guidance (expandable) */}
 {finding.remediation && !finding.isFalsePositive && (
 <RemediationGuidance
 finding={finding}
 expanded={expandedRemediations.has(finding.id)}
 onToggle={() => toggleRemediation(finding.id)}
 />
 )}
 </div>
 </div>
 </div>
 );
}

// Remediation Guidance Component
interface RemediationGuidanceProps {
 finding: SASTFinding;
 expanded: boolean;
 onToggle: () => void;
}

function RemediationGuidance({ finding, expanded, onToggle }: RemediationGuidanceProps) {
 if (!finding.remediation) return null;

 return (
 <div className="mt-3 border border-primary/20 rounded-lg overflow-hidden">
 <button
 onClick={(e) => {
 e.stopPropagation();
 onToggle();
 }}
 className="w-full flex items-center justify-between px-3 py-2 bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
 >
 <span className="flex items-center gap-2 text-sm font-medium">
 <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
 </svg>
 Remediation Guidance
 </span>
 <svg
 className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
 fill="none"
 viewBox="0 0 24 24"
 stroke="currentColor"
 >
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
 </svg>
 </button>

 {expanded && (
 <div className="p-4 bg-card space-y-4">
 <p className="text-sm text-foreground font-medium">{finding.remediation.summary}</p>

 <div>
 <h5 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Fix Steps</h5>
 <ol className="list-decimal list-inside space-y-1">
 {finding.remediation.steps.map((step, idx) => (
 <li key={idx} className="text-sm text-muted-foreground">{step}</li>
 ))}
 </ol>
 </div>

 {finding.remediation.secureCodeExample && (
 <div>
 <h5 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Secure Code Pattern</h5>
 <div className="grid md:grid-cols-2 gap-3">
 <div>
 <p className="text-xs text-destructive font-medium mb-1">❌ Before (Vulnerable)</p>
 <pre className="p-2 bg-destructive/5 rounded text-xs font-mono overflow-x-auto whitespace-pre-wrap border border-destructive/20">
 {finding.remediation.secureCodeExample.before}
 </pre>
 </div>
 <div>
 <p className="text-xs text-success font-medium mb-1">✅ After (Secure)</p>
 <pre className="p-2 bg-success/5 rounded text-xs font-mono overflow-x-auto whitespace-pre-wrap border border-success/20">
 {finding.remediation.secureCodeExample.after}
 </pre>
 </div>
 </div>
 </div>
 )}

 {finding.remediation.references.length > 0 && (
 <div>
 <h5 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Documentation & References</h5>
 <ul className="space-y-1">
 {finding.remediation.references.map((ref, idx) => (
 <li key={idx}>
 <a
 href={ref.url}
 target="_blank"
 rel="noopener noreferrer"
 className="text-sm text-primary hover:underline flex items-center gap-1"
 >
 {ref.title}
 <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
 </svg>
 </a>
 </li>
 ))}
 </ul>
 </div>
 )}
 </div>
 )}
 </div>
 );
}
