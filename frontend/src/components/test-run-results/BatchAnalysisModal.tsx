/**
 * BatchAnalysisModal - AI batch analysis modal for multiple test failures
 * Feature #46: Extracted from TestRunResultPage.tsx for modularity
 * Feature #1954: Batch failure analysis with common pattern detection
 * Feature #127: Mobile responsive design - p-4 backdrop, max-h-[90vh] overflow, responsive padding
 * Feature #691: Migrated to shared Modal component
 */

import React, { useState, useCallback } from 'react';
import { TestRun, ResultSummary } from './types';
import { logger } from '../../utils/logger';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../ui/Modal';

export interface BatchAnalysisModalProps {
 isOpen: boolean;
 onClose: () => void;
 run: TestRun | null;
 resultSummary: ResultSummary;
 token: string | null;
}

export default function BatchAnalysisModal({
 isOpen,
 onClose,
 run,
 resultSummary,
 token,
}: BatchAnalysisModalProps) {
 const [batchAnalysisLoading, setBatchAnalysisLoading] = useState(false);
 const [batchAnalysisResult, setBatchAnalysisResult] = useState<string | null>(null);
 const [batchAnalysisCached, setBatchAnalysisCached] = useState(false);

 // Run batch analysis
 const handleBatchAnalysis = useCallback(async () => {
 if (!run || !token) return;

 // Get all failed tests
 const failedTests = run.results.filter(r => r.status === 'failed' || r.status === 'error');
 if (failedTests.length < 2) return;

 // Check cache using run ID as key
 const cacheKey = `batch_${run.id}`;
 try {
 const cachedStr = localStorage.getItem(`ai_batch_${cacheKey}`);
 if (cachedStr) {
 const cached = JSON.parse(cachedStr);
 if (Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
 setBatchAnalysisResult(cached.analysis);
 setBatchAnalysisCached(true);
 logger.ai.debug('Using cached batch analysis');
 return;
 }
 }
 } catch (e) {
 // Ignore cache errors
 }

 setBatchAnalysisLoading(true);
 setBatchAnalysisResult(null);
 setBatchAnalysisCached(false);

 // Collect error summaries (not full data)
 const errorSummaries = failedTests.map(t => {
 const failedStep = t.steps.find(s => s.status === 'failed');
 return {
 test_name: t.test_name,
 error: (t.error || failedStep?.error || 'Unknown error').slice(0, 200),
 selector: failedStep?.selector,
 action: failedStep?.action,
 duration_ms: t.duration_ms,
 };
 });

 try {
 const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/v1/mcp-tools/chat`, {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 Authorization: `Bearer ${token}`,
 },
 body: JSON.stringify({
 message: `Analyze these ${failedTests.length} test failures and find the COMMON ROOT CAUSE.

Failed Tests:
${JSON.stringify(errorSummaries, null, 2)}

Please identify:
1. **Most Likely Root Cause**: What single issue is causing multiple tests to fail?
2. **Common Patterns**: Shared selectors, pages, timing issues, or error types
3. **Priority Fix**: What ONE thing should be fixed to resolve multiple failures?
4. **Individual vs Systemic**: Are these independent failures or related to the same underlying issue?`,
 complexity: 'simple', // Use Haiku for cost efficiency
 }),
 });

 if (response.ok) {
 const data = await response.json();
 const analysis = data.response || data.content || 'No analysis available';
 setBatchAnalysisResult(analysis);
 // Cache the result
 try {
 localStorage.setItem(`ai_batch_${cacheKey}`, JSON.stringify({
 analysis,
 timestamp: Date.now(),
 }));
 } catch (e) {
 // Storage full
 }
 logger.ai.debug('Batch failure analysis triggered for', failedTests.length, 'tests');
 } else {
 setBatchAnalysisResult('Failed to analyze failures. Please try again.');
 }
 } catch (error) {
 console.error('Batch analysis failed:', error);
 setBatchAnalysisResult('Error connecting to AI service. Please try again.');
 } finally {
 setBatchAnalysisLoading(false);
 }
 }, [run, token]);

 // Trigger analysis when modal opens
 React.useEffect(() => {
 if (isOpen && run && !batchAnalysisResult && !batchAnalysisLoading) {
 handleBatchAnalysis();
 }
 }, [isOpen, run, batchAnalysisResult, batchAnalysisLoading, handleBatchAnalysis]);

 if (!run) return null;

 const failedTests = run.results.filter(r => r.status === 'failed' || r.status === 'error');

 return (
 <Modal isOpen={isOpen} onClose={onClose} title="Batch Failure Analysis" size="lg">
 <ModalHeader onClose={onClose}>
 <div className="flex items-center gap-3">
 <div className="h-10 w-10 rounded-full bg-gradient-to-r from-accent to-accent/80 flex items-center justify-center" aria-hidden="true">
 <span className="text-white text-lg">🤖</span>
 </div>
 <div>
 <span className="font-semibold text-foreground">Batch Failure Analysis</span>
 <p className="text-sm text-muted-foreground font-normal">
 Analyzing {resultSummary.failed} failed tests for common patterns
 </p>
 </div>
 </div>
 </ModalHeader>

 <ModalBody>
 {/* Failed Tests Summary */}
 <div className="mb-4 p-3 bg-destructive/5 rounded-lg border border-destructive/20">
 <div className="text-sm font-medium text-destructive mb-2">Failed Tests:</div>
 <div className="flex flex-wrap gap-2">
 {failedTests.slice(0, 8).map(t => (
 <span key={t.test_id} className="px-2 py-1 text-xs bg-destructive/10 text-destructive rounded">
 {t.test_name.length > 30 ? t.test_name.slice(0, 27) + '...' : t.test_name}
 </span>
 ))}
 {failedTests.length > 8 && (
 <span className="px-2 py-1 text-xs bg-destructive/10 text-destructive rounded">
 +{failedTests.length - 8} more
 </span>
 )}
 </div>
 </div>

 {/* Analysis Content */}
 {batchAnalysisLoading ? (
 <div className="flex flex-col items-center justify-center py-8">
 <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent mb-3" />
 <p className="text-sm text-muted-foreground">Finding common patterns across failures...</p>
 </div>
 ) : batchAnalysisResult ? (
 <div className="bg-gradient-to-r from-accent/5 to-accent/10 rounded-lg p-4 border border-accent/20">
 <div className="whitespace-pre-wrap text-sm text-foreground">{batchAnalysisResult}</div>
 </div>
 ) : null}

 {/* Cached indicator */}
 {batchAnalysisCached && !batchAnalysisLoading && (
 <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
 <span className="flex items-center gap-1">
 <span>💾</span> Cached analysis (24hr)
 </span>
 <button
 onClick={() => {
 // Clear cache and re-analyze
 if (run) {
 try {
 localStorage.removeItem(`ai_batch_batch_${run.id}`);
 } catch (e) { /* storage unavailable */ }
 }
 setBatchAnalysisCached(false);
 setBatchAnalysisResult(null);
 handleBatchAnalysis();
 }}
 className="text-accent hover:text-accent/80"
 >
 🔄 Refresh
 </button>
 </div>
 )}
 </ModalBody>

 <ModalFooter>
 <button
 onClick={onClose}
 className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
 >
 Close
 </button>
 </ModalFooter>
 </Modal>
 );
}
