/**
 * K6CompareModal - Feature #48: Extracted from TestDetailPage.tsx
 * K6 Load Test comparison modal (Feature #564)
 * Feature #127: Mobile responsive design - p-4 backdrop, max-h-[90vh] overflow, responsive padding
 * Feature #571: Replace emoji with Lucide icons for cross-browser consistency
 * Feature #637: Migrated to use Modal component from ui/Modal
 */

import { BarChart3 } from 'lucide-react';
import { Modal, ModalHeader, ModalBody } from '../ui/Modal';

// K6 Compare Results type
export interface K6CompareResults {
 base_run?: {
 test_name?: string;
 completed_at?: string;
 };
 compare_run?: {
 test_name?: string;
 completed_at?: string;
 };
 overall?: {
 performance: 'improved' | 'regressed' | 'unchanged';
 highlights?: string[];
 };
 summary?: Record<string, {
 status: 'improved' | 'regressed' | 'unchanged';
 delta_percent: number;
 base: number | string;
 compare: number | string;
 }>;
 response_times?: Record<string, {
 status: 'improved' | 'regressed' | 'unchanged';
 delta_percent: number;
 base: number;
 compare: number;
 }>;
}

export interface K6CompareModalProps {
 show: boolean;
 results: K6CompareResults | null;
 onClose: () => void;
 formatDateTime: (date: string | undefined) => string;
}

export function K6CompareModal({
 show,
 results,
 onClose,
 formatDateTime,
}: K6CompareModalProps) {
 if (!results) return null;

 return (
 <Modal isOpen={show} onClose={onClose} title="K6 Load Test Comparison" size="full">
 <ModalHeader onClose={onClose}>
 <div className="flex items-center gap-2">
 <BarChart3 className="h-5 w-5" />
 <span>K6 Load Test Comparison</span>
 </div>
 </ModalHeader>

 <ModalBody className="space-y-6">
 {/* Run Info */}
 <div className="grid grid-cols-2 gap-4">
 <div className="p-3 rounded-lg border border-border bg-muted/30">
 <div className="text-xs text-muted-foreground mb-1">Base Run</div>
 <div className="text-sm font-medium">{results.base_run?.test_name || 'Unknown'}</div>
 <div className="text-xs text-muted-foreground">
 {results.base_run?.completed_at ? formatDateTime(results.base_run.completed_at) : 'N/A'}
 </div>
 </div>
 <div className="p-3 rounded-lg border border-border bg-muted/30">
 <div className="text-xs text-muted-foreground mb-1">Compare Run</div>
 <div className="text-sm font-medium">{results.compare_run?.test_name || 'Unknown'}</div>
 <div className="text-xs text-muted-foreground">
 {results.compare_run?.completed_at ? formatDateTime(results.compare_run.completed_at) : 'N/A'}
 </div>
 </div>
 </div>

 {/* Overall Status */}
 {results.overall && (
 <div className={`p-4 rounded-lg border ${
 results.overall.performance === 'improved' ? 'border-success bg-success/5' :
 results.overall.performance === 'regressed' ? 'border-destructive bg-destructive/5' :
 'border-border bg-muted/30'
 }`}>
 <div className="flex items-center gap-2 mb-2">
 <span className={`text-lg ${
 results.overall.performance === 'improved' ? 'text-success' :
 results.overall.performance === 'regressed' ? 'text-destructive' :
 'text-foreground'
 }`}>
 {results.overall.performance === 'improved' ? '📈' : results.overall.performance === 'regressed' ? '📉' : '➡️'}
 </span>
 <span className={`font-semibold ${
 results.overall.performance === 'improved' ? 'text-success' :
 results.overall.performance === 'regressed' ? 'text-destructive' :
 'text-foreground'
 }`}>
 {results.overall.performance === 'improved' ? 'Performance Improved' :
 results.overall.performance === 'regressed' ? 'Performance Regressed' :
 'No Significant Change'}
 </span>
 </div>
 {results.overall.highlights && results.overall.highlights.length > 0 && (
 <ul className="text-sm space-y-1">
 {results.overall.highlights.map((h: string, i: number) => (
 <li key={i} className="text-muted-foreground">• {h}</li>
 ))}
 </ul>
 )}
 </div>
 )}

 {/* Summary Metrics Comparison */}
 {results.summary && (
 <div>
 <h4 className="text-sm font-semibold text-foreground mb-3">Summary Metrics</h4>
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
 {Object.entries(results.summary).map(([key, value]) => (
 <div key={key} className="p-3 rounded-lg border border-border bg-muted/20 text-center">
 <div className="text-xs text-muted-foreground mb-1 capitalize">{key.replace(/_/g, ' ')}</div>
 <div className={`text-sm font-bold ${
 value.status === 'improved' ? 'text-success' :
 value.status === 'regressed' ? 'text-destructive' :
 'text-foreground'
 }`}>
 {value.delta_percent > 0 ? '+' : ''}{value.delta_percent?.toFixed(1)}%
 </div>
 <div className="text-xs text-muted-foreground mt-1">
 {typeof value.base === 'number' ? value.base.toLocaleString() : value.base} → {typeof value.compare === 'number' ? value.compare.toLocaleString() : value.compare}
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Response Time Comparison */}
 {results.response_times && (
 <div>
 <h4 className="text-sm font-semibold text-foreground mb-3">Response Time Percentiles</h4>
 <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
 {Object.entries(results.response_times).map(([key, value]) => (
 <div key={key} className={`p-2 rounded-lg border text-center ${
 key === 'median' ? 'border-success/20 bg-success/5/50' :
 key === 'p95' ? 'border-warning/20 bg-warning/5/50' :
 key === 'p99' ? 'border-warning/20 bg-warning/5' :
 'border-border bg-muted/20'
 }`}>
 <div className={`text-xs mb-1 ${
 key === 'median' ? 'text-success' :
 key === 'p95' ? 'text-warning' :
 key === 'p99' ? 'text-warning' :
 'text-muted-foreground'
 }`}>{key}</div>
 <div className={`text-sm font-bold ${
 value.status === 'improved' ? 'text-success' :
 value.status === 'regressed' ? 'text-destructive' :
 'text-foreground'
 }`}>
 {value.delta_percent > 0 ? '+' : ''}{value.delta_percent?.toFixed(1)}%
 </div>
 <div className="text-xs text-muted-foreground">
 {value.base}ms → {value.compare}ms
 </div>
 </div>
 ))}
 </div>
 </div>
 )}
 </ModalBody>
 </Modal>
 );
}

export default K6CompareModal;
