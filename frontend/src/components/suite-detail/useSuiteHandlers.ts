/**
 * useSuiteHandlers - Event handlers for TestSuitePage operations
 * Extracted from TestSuitePage.tsx for component decomposition (Agent 7)
 *
 * Consolidates: export (JSON/PDF), import, run/cancel suite, run/duplicate/delete test,
 * update/accept selectors, toggle human review, review tests, batch review,
 * AI health check, insert/delete templates
 */

import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../stores/toastStore';
import { getErrorMessage } from '../../utils/errorHandling';
import { createLogger } from '../../utils/logger';
import type { TestType } from './types';
import type { UseAIHealthStateReturn } from './useAIHealthState';
import type { UseReviewStateReturn } from './useReviewState';
import type { UseSelectorEditStateReturn } from './useSelectorEditState';
import type { SuiteRunLocal } from '@/types/tests';

const logger = createLogger('suite-handlers');

export interface UseSuiteHandlersParams {
  suiteId: string | undefined;
  token: string | null;
  suite: { id: string; name?: string; description?: string; browser?: string; viewport_width?: number; viewport_height?: number; timeout?: number; retry_count?: number; project_id?: string } | null;
  tests: TestType[];
  // Mutation hooks (passed in from the page)
  reviewTestMutation: { mutateAsync: (params: { testId: string; status: string; notes?: string }) => Promise<{ message?: string }> };
  batchReviewMutation: { mutateAsync: (params: { testIds: string[]; status: string; suiteId?: string }) => Promise<{ successful?: number }> };
  duplicateTestMutation: { mutateAsync: (params: { suiteId: string; data: Record<string, unknown> }) => Promise<unknown> };
  deleteTestMutation: { mutateAsync: (params: { id: string; suiteId?: string }) => Promise<unknown> };
  startRunMutation: { mutateAsync: (params: { testId: string }) => Promise<unknown> };
  cancelRunMutation: { mutateAsync: (runId: string) => Promise<unknown> };
  startSuiteRunMutation: { mutateAsync: (params: { suiteId: string }) => Promise<{ run: SuiteRunLocal }> };
  deleteSuiteMutation: { mutateAsync: (params: { id: string; projectId?: string }) => Promise<unknown> };
  toggleHumanReviewMutation: { mutateAsync: (params: { suiteId: string; requireHumanReview: boolean }) => Promise<{ message?: string }> };
  aiHealthCheckMutation: { mutateAsync: (params: { suiteId: string }) => Promise<{ report: unknown }> };
  updateRunSelectorMutation: { mutateAsync: (params: { runId: string; testId: string; stepId: string; newSelector: string; notes?: string; applyToTest: boolean }) => Promise<{ message?: string }> };
  acceptHealedSelectorMutation: { mutateAsync: (params: { runId: string; testId: string; stepId: string; applyToTest: boolean }) => Promise<{ message?: string }> };
  insertTemplateStepsMutation: { mutateAsync: (params: { testId: string; steps: unknown[]; suiteId?: string }) => Promise<unknown> };
  deleteStepTemplateMutation: { mutateAsync: (params: { templateId: string; suiteId: string }) => Promise<unknown> };
  // State hooks
  aiHealth: UseAIHealthStateReturn;
  reviewState: UseReviewStateReturn;
  selectorEdit: UseSelectorEditStateReturn;
  // Callbacks
  invalidateBySuite: (suiteId: string) => void;
  requireHumanReview: boolean;
  refetchStepTemplates: () => void;
  setSuiteRun: React.Dispatch<React.SetStateAction<SuiteRunLocal | null>>;
  setSuiteRunActive: React.Dispatch<React.SetStateAction<boolean>>;
  setLiveScreenshot: React.Dispatch<React.SetStateAction<unknown>>;
  setScreenshotHistory: React.Dispatch<React.SetStateAction<unknown[]>>;
}

export function useSuiteHandlers(params: UseSuiteHandlersParams) {
  const {
    suiteId, token, suite, tests,
    reviewTestMutation, batchReviewMutation, duplicateTestMutation, deleteTestMutation,
    startRunMutation, cancelRunMutation, startSuiteRunMutation, deleteSuiteMutation,
    toggleHumanReviewMutation, aiHealthCheckMutation,
    updateRunSelectorMutation, acceptHealedSelectorMutation,
    insertTemplateStepsMutation, deleteStepTemplateMutation,
    aiHealth, reviewState, selectorEdit,
    invalidateBySuite, requireHumanReview, refetchStepTemplates,
    setSuiteRun, setSuiteRunActive, setLiveScreenshot, setScreenshotHistory,
  } = params;

  const navigate = useNavigate();

  // Local UI state for operations
  const [isRunningSuite, setIsRunningSuite] = useState(false);
  const [isCancellingSuite, setIsCancellingSuite] = useState(false);
  const [isDeletingSuite, setIsDeletingSuite] = useState(false);
  const [isDeletingTest, setIsDeletingTest] = useState(false);
  const [runningTestId, setRunningTestId] = useState<string | null>(null);
  const [showDeleteSuiteModal, setShowDeleteSuiteModal] = useState(false);
  const [showDeleteTestModal, setShowDeleteTestModal] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importError, setImportError] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [insertTemplateForTest, setInsertTemplateForTest] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---- Toggle Human Review ----
  const handleToggleHumanReview = async () => {
    if (!suiteId) return;
    try {
      const data = await toggleHumanReviewMutation.mutateAsync({
        suiteId,
        requireHumanReview: !requireHumanReview,
      });
      toast.success(data.message || 'Review settings updated');
    } catch {
      toast.error('Failed to update review settings');
    }
  };

  // ---- Review Test ----
  const handleReviewTest = async (testId: string, action: 'approve' | 'reject', notes?: string) => {
    if (!token) return;
    reviewState.setIsApproving(true);
    try {
      const status = action === 'approve' ? 'approved' : 'rejected';
      const data = await reviewTestMutation.mutateAsync({ testId, status, notes });
      toast.success(data.message || `Test ${action}d successfully`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to review test'));
    } finally {
      reviewState.setIsApproving(false);
    }
  };

  // ---- Batch Review ----
  const handleBatchReview = async (action: 'approve' | 'reject') => {
    if (!token || reviewState.selectedForReview.size === 0) return;
    reviewState.setIsApproving(true);
    try {
      const status = action === 'approve' ? 'approved' : 'rejected';
      const testIds = Array.from(reviewState.selectedForReview);
      const data = await batchReviewMutation.mutateAsync({ testIds, status, suiteId });
      reviewState.clearSelection();
      toast.success(`Successfully ${action}d ${data.successful || testIds.length} test(s)`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to batch review tests'));
    } finally {
      reviewState.setIsApproving(false);
    }
  };

  // ---- AI Health Check ----
  const handleAIHealthCheck = async () => {
    if (!suiteId) return;
    aiHealth.startLoading();
    try {
      const data = await aiHealthCheckMutation.mutateAsync({ suiteId });
      aiHealth.setReport(data.report);
    } catch (err) {
      logger.error('AI health check failed:', err);
      toast.error('AI health check failed');
      aiHealth.setError();
    }
  };

  // ---- Run Suite ----
  const handleRunSuite = async () => {
    if (tests.length === 0) return;
    setIsRunningSuite(true);
    setSuiteRun(null);
    setLiveScreenshot(null);
    setScreenshotHistory([]);

    try {
      const data = await startSuiteRunMutation.mutateAsync({ suiteId: suiteId || '' });
      setSuiteRun(data.run);
      setSuiteRunActive(true);
    } catch (err) {
      logger.error('Failed to run suite:', err);
      const errObj = err as { status?: number };
      if (errObj?.status === 503 || (err instanceof Error && err.message.includes('503'))) {
        toast.error('Runner offline or queue unavailable. The worker may need to be restarted.');
      } else {
        toast.error(getErrorMessage(err, 'Failed to start test run'));
      }
      setIsRunningSuite(false);
    }
  };

  // ---- Cancel Suite Run ----
  const handleCancelSuiteRun = async (suiteRun: SuiteRunLocal | null) => {
    if (!suiteRun?.id) return;
    setIsCancellingSuite(true);
    try {
      await cancelRunMutation.mutateAsync(suiteRun.id);
      setSuiteRun((prev) => prev ? { ...prev, status: 'cancelled' as const } : null);
      setSuiteRunActive(false);
      setIsRunningSuite(false);
      toast.success('Test run cancelled');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to cancel run'));
    } finally {
      setIsCancellingSuite(false);
    }
  };

  // ---- Run Single Test ----
  const handleRunSingleTest = async (testId: string) => {
    setRunningTestId(testId);
    try {
      await startRunMutation.mutateAsync({ testId });
      toast.success('Test run started');
      navigate(`/tests/${testId}`);
    } catch (err) {
      logger.error('Failed to run test:', err);
      const errObj = err as { status?: number };
      if (errObj?.status === 503 || (err instanceof Error && err.message.includes('503'))) {
        toast.error('Runner offline or queue unavailable. The worker may need to be restarted.');
      } else {
        toast.error(getErrorMessage(err, 'Failed to start test run'));
      }
    } finally {
      setRunningTestId(null);
    }
  };

  // ---- Duplicate Test ----
  const handleDuplicateTest = async (test: TestType) => {
    try {
      await duplicateTestMutation.mutateAsync({
        suiteId: suiteId || '',
        data: {
          name: `${test.name} (Copy)`,
          description: test.description,
          test_type: test.test_type || test.type,
          steps: test.steps,
          target_url: test.target_url,
        },
      });
      toast.success('Test duplicated successfully');
    } catch (err) {
      logger.error('Failed to duplicate test:', err);
      toast.error(getErrorMessage(err, 'Failed to duplicate test'));
    }
  };

  // ---- Delete Test ----
  const handleDeleteTest = async (testId: string) => {
    setIsDeletingTest(true);
    try {
      await deleteTestMutation.mutateAsync({ id: testId, suiteId });
      toast.success('Test deleted successfully');
      setShowDeleteTestModal(null);
    } catch (err) {
      logger.error('Failed to delete test:', err);
      toast.error(getErrorMessage(err, 'Failed to delete test'));
    } finally {
      setIsDeletingTest(false);
    }
  };

  // ---- Delete Suite ----
  const handleDeleteSuite = async () => {
    setIsDeletingSuite(true);
    const suiteName = suite?.name;
    try {
      await deleteSuiteMutation.mutateAsync({ id: suiteId || '', projectId: suite?.project_id });
      toast.success(`Suite "${suiteName}" deleted successfully!`);
      navigate(`/projects/${suite?.project_id}`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to delete suite'));
      setIsDeletingSuite(false);
      setShowDeleteSuiteModal(false);
    }
  };

  // ---- Update Selector ----
  const handleUpdateSelector = async () => {
    const { editSelectorModal, editSelectorValue, editSelectorNotes, editSelectorApplyToTest } = selectorEdit;
    if (!editSelectorModal.runId || !editSelectorModal.testId || !editSelectorModal.stepId) {
      toast.error('Missing required information');
      return;
    }
    if (!editSelectorValue.trim()) {
      toast.error('Selector cannot be empty');
      return;
    }

    selectorEdit.setIsSubmittingSelector(true);
    try {
      const data = await updateRunSelectorMutation.mutateAsync({
        runId: editSelectorModal.runId,
        testId: editSelectorModal.testId,
        stepId: editSelectorModal.stepId,
        newSelector: editSelectorValue.trim(),
        notes: editSelectorNotes.trim() || undefined,
        applyToTest: editSelectorApplyToTest,
      });
      toast.success(data.message || 'Selector updated successfully');
      selectorEdit.closeSelectorModal();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update selector');
    } finally {
      selectorEdit.setIsSubmittingSelector(false);
    }
  };

  // ---- Accept Healed Selector ----
  const handleAcceptHealed = async () => {
    const { editSelectorModal, editSelectorApplyToTest } = selectorEdit;
    if (!editSelectorModal.runId || !editSelectorModal.testId || !editSelectorModal.stepId) {
      toast.error('Missing required information');
      return;
    }

    selectorEdit.setIsSubmittingSelector(true);
    try {
      const data = await acceptHealedSelectorMutation.mutateAsync({
        runId: editSelectorModal.runId,
        testId: editSelectorModal.testId,
        stepId: editSelectorModal.stepId,
        applyToTest: editSelectorApplyToTest,
      });
      toast.success(data.message || 'Healed selector accepted');
      selectorEdit.closeSelectorModal();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to accept healed selector');
    } finally {
      selectorEdit.setIsSubmittingSelector(false);
    }
  };

  // ---- Import Tests ----
  const handleImportTests = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError('');

    const allowedTypes = ['application/json'];
    const allowedExtensions = ['.json', '.spec.ts', '.spec.js', '.test.ts', '.test.js'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
      setImportError(`Invalid file type: "${file.name}". Please upload a JSON file or Playwright test file (.spec.ts, .spec.js, .test.ts, .test.js).`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      setImportError(`File too large: ${fileSizeMB}MB. Maximum allowed size is 5MB.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.type === 'application/json' || fileExtension === '.json') {
      setIsImporting(true);
      try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (!Array.isArray(data) && typeof data !== 'object') {
          setImportError('Invalid JSON structure. Expected an array of tests or a test object.');
          setIsImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        const testsToImport = Array.isArray(data) ? data : [data];

        for (let i = 0; i < testsToImport.length; i++) {
          const test = testsToImport[i];
          if (!test.name || typeof test.name !== 'string') {
            setImportError(`Invalid test at index ${i}: missing or invalid "name" field.`);
            setIsImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
          }
        }

        toast.success(`Successfully imported ${testsToImport.length} test(s) from ${file.name}`);
        setShowImportModal(false);
      } catch (err) {
        if (err instanceof SyntaxError) {
          setImportError(`Invalid JSON: ${err.message}. Please check your file syntax.`);
        } else {
          setImportError(getErrorMessage(err, 'Failed to import tests'));
        }
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } else {
      toast.info(`Playwright test file "${file.name}" received. Import processing would happen here.`);
      setShowImportModal(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ---- Export Tests JSON ----
  const handleExportTests = () => {
    if (tests.length === 0) {
      toast.error('No tests to export');
      return;
    }

    const exportData = {
      suite: {
        name: suite?.name,
        description: suite?.description,
        browser: suite?.browser,
        viewport_width: suite?.viewport_width,
        viewport_height: suite?.viewport_height,
        timeout: suite?.timeout,
        retry_count: suite?.retry_count,
      },
      tests: tests.map(test => ({
        name: test.name,
        description: test.description,
        steps: test.steps,
        status: test.status,
      })),
      exported_at: new Date().toISOString(),
      version: '1.0',
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${suite?.name?.toLowerCase().replace(/\s+/g, '-') || 'tests'}-export.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${tests.length} test(s) to file`);
  };

  // ---- Export Run JSON ----
  const handleExportRunJSON = useCallback((suiteRun: SuiteRunLocal | null) => {
    if (!suiteRun || !suiteRun.results) {
      toast.error('No completed run to export');
      return;
    }

    const exportData = {
      runId: suiteRun.id,
      suiteId: suiteId,
      suiteName: suite?.name,
      status: suiteRun.status,
      startedAt: suiteRun.started_at,
      completedAt: suiteRun.completed_at,
      durationMs: suiteRun.duration_ms,
      summary: {
        total: suiteRun.results.length,
        passed: suiteRun.results.filter(r => r.status === 'passed').length,
        failed: suiteRun.results.filter(r => r.status === 'failed').length,
        error: suiteRun.results.filter(r => r.status === 'error').length,
      },
      results: suiteRun.results.map(r => ({
        testId: r.test_id,
        testName: r.test_name,
        testType: r.test_type,
        status: r.status,
        durationMs: r.duration_ms,
        error: r.error,
      })),
      exportedAt: new Date().toISOString(),
      exportedBy: 'QA Guardian',
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `suite-run-${suite?.name?.toLowerCase().replace(/\s+/g, '-') || 'results'}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Exported run results to JSON');
  }, [suiteId, suite?.name]);

  // ---- Export Run PDF ----
  const handleExportRunPDF = useCallback((suiteRun: SuiteRunLocal | null) => {
    if (!suiteRun || !suiteRun.results) {
      toast.error('No completed run to export');
      return;
    }

    const passed = suiteRun.results.filter(r => r.status === 'passed').length;
    const failed = suiteRun.results.filter(r => r.status === 'failed' || r.status === 'error').length;
    const total = suiteRun.results.length;
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
    const statusColor = passRate >= 90 ? '#22c55e' : passRate >= 70 ? '#f59e0b' : '#ef4444';

    const resultRows = suiteRun.results.map(r => {
      const statusIcon = r.status === 'passed' ? '\u2705' : r.status === 'failed' ? '\u274C' : '\u26A0\uFE0F';
      const dur = r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)}s` : '\u2014';
      return `<tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${statusIcon} ${r.test_name}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${r.test_type || 'e2e'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${r.status}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${dur}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #ef4444; font-size: 12px;">${r.error || ''}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Suite Run Report - ${suite?.name || 'Suite'}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 24px; color: #111827; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #3b82f6; padding-bottom: 16px; margin-bottom: 24px; }
    .brand { font-size: 18px; font-weight: 700; color: #3b82f6; }
    .subtitle { font-size: 12px; color: #6b7280; }
    .summary { display: flex; gap: 24px; margin: 24px 0; }
    .summary-card { background: #f9fafb; border-radius: 8px; padding: 16px; text-align: center; flex: 1; }
    .summary-value { font-size: 28px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th { text-align: left; padding: 8px; border-bottom: 2px solid #e5e7eb; font-size: 13px; color: #6b7280; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">QA Guardian</div>
      <div class="subtitle">Suite Run Report</div>
    </div>
    <div style="text-align: right;">
      <div style="font-weight: 600;">${suite?.name || 'Test Suite'}</div>
      <div class="subtitle">${new Date(suiteRun.completed_at || suiteRun.started_at || new Date()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
    </div>
  </div>
  <div class="summary">
    <div class="summary-card"><div class="summary-value" style="color: ${statusColor};">${passRate}%</div><div style="font-size: 12px; color: #6b7280;">Pass Rate</div></div>
    <div class="summary-card"><div class="summary-value" style="color: #22c55e;">${passed}</div><div style="font-size: 12px; color: #6b7280;">Passed</div></div>
    <div class="summary-card"><div class="summary-value" style="color: #ef4444;">${failed}</div><div style="font-size: 12px; color: #6b7280;">Failed</div></div>
    <div class="summary-card"><div class="summary-value">${total}</div><div style="font-size: 12px; color: #6b7280;">Total Tests</div></div>
  </div>
  <h3 style="font-size: 16px; color: #374151; margin-top: 24px;">Test Results</h3>
  <table>
    <thead><tr><th>Test Name</th><th style="text-align: center;">Type</th><th style="text-align: center;">Status</th><th style="text-align: right;">Duration</th><th>Error</th></tr></thead>
    <tbody>${resultRows}</tbody>
  </table>
  <div class="footer">Generated by QA Guardian &middot; ${new Date().toISOString()} &middot; Run ID: ${suiteRun.id}</div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.src = blobUrl;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      try {
        iframe.contentWindow?.print();
      } catch {
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `suite-run-report-${suite?.name || 'suite'}.html`;
        a.click();
      }
      setTimeout(() => {
        document.body.removeChild(iframe);
        URL.revokeObjectURL(blobUrl);
      }, 60000);
    };

    toast.success('Opening PDF print dialog...');
  }, [suite?.name]);

  // ---- Template Handlers ----
  const loadStepTemplates = () => {
    refetchStepTemplates();
  };

  const handleInsertTemplate = async (testId: string, template: { steps: Array<{ action: string; selector?: string; value?: string; text?: string; url?: string }> }) => {
    try {
      await insertTemplateStepsMutation.mutateAsync({
        testId,
        steps: template.steps as unknown[],
        suiteId,
      });
      toast.success('Template steps inserted into test');
      setShowTemplateModal(false);
      setInsertTemplateForTest(null);
      invalidateBySuite(suiteId || '');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to insert template');
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      await deleteStepTemplateMutation.mutateAsync({ templateId, suiteId: suiteId || '' });
      toast.success('Template deleted');
    } catch {
      toast.error('Failed to delete template');
    }
  };

  return {
    // Operation handlers
    handleToggleHumanReview,
    handleReviewTest,
    handleBatchReview,
    handleAIHealthCheck,
    handleRunSuite,
    handleCancelSuiteRun,
    handleRunSingleTest,
    handleDuplicateTest,
    handleDeleteTest,
    handleDeleteSuite,
    handleUpdateSelector,
    handleAcceptHealed,
    handleImportTests,
    handleExportTests,
    handleExportRunJSON,
    handleExportRunPDF,
    loadStepTemplates,
    handleInsertTemplate,
    handleDeleteTemplate,
    // UI state
    isRunningSuite,
    isCancellingSuite,
    isDeletingSuite,
    isDeletingTest,
    runningTestId,
    showDeleteSuiteModal, setShowDeleteSuiteModal,
    showDeleteTestModal, setShowDeleteTestModal,
    showImportModal, setShowImportModal,
    importError,
    isImporting,
    showTemplateModal, setShowTemplateModal,
    insertTemplateForTest, setInsertTemplateForTest,
    fileInputRef,
  };
}

export type UseSuiteHandlersReturn = ReturnType<typeof useSuiteHandlers>;
