/**
 * SASTScanResults - SAST scan results display with findings
 * Feature #102: Extracted from SecurityTab.tsx
 */
import { Loader2, ShieldCheck, X, XCircle, AlertTriangle, Lightbulb, ChevronDown, ExternalLink } from 'lucide-react';
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
 ? 'border-warning bg-warning/5'
 : 'border-border hover:border-warning/50'
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
 ? 'bg-warning/10 text-warning'
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
 <Loader2 className="h-5 w-5 animate-spin" />
 ) : scan.status === 'completed' ? (
 <ShieldCheck className="h-5 w-5" />
 ) : (
 <X className="h-5 w-5" />
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
 <XCircle className="h-4 w-4" />
 {summary.bySeverity.critical} critical
 </span>
 )}
 {summary.bySeverity.high > 0 && (
 <span className="flex items-center gap-1 text-warning">
 <AlertTriangle className="h-4 w-4" />
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
 ? 'border-warning/20 bg-warning/5'
 : finding.severity === 'MEDIUM'
 ? 'border-warning/20 bg-warning/5/50'
 : 'border-primary/20 bg-primary/5/50';

 const severityColorClass = finding.isFalsePositive
 ? 'bg-muted text-foreground'
 : finding.severity === 'CRITICAL'
 ? 'bg-destructive/10 text-destructive'
 : finding.severity === 'HIGH'
 ? 'bg-warning/10 text-warning'
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
 <span className="inline-flex items-center rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
 {finding.cweId}
 </span>
 )}
 {finding.owaspCategory && (
 <span className="inline-flex items-center rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
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
 <Lightbulb className="h-4 w-4" />
 Remediation Guidance
 </span>
 <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
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
 <ExternalLink className="h-3 w-3" />
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
