/**
 * useSuitePageHandlers - Consolidates all mutation-based handler functions
 * for TestSuitePage. Extracted to keep the page component focused on layout. (Agent 7)
 *
 * Handles: review, health check, run/cancel suite, run/duplicate/delete test,
 * selector edit/accept, import tests, templates, export tests/run JSON/PDF.
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../../stores/toastStore';
import { getErrorMessage } from '../../utils/errorHandling';
import { createLogger } from '../../utils/logger';
import {
  useReviewTest, useBatchReviewTests, useDuplicateTest, useDeleteTest,
  useStartRun, useCancelRun, useStartSuiteRun, useDeleteSuite,
  useToggleHumanReview, useAIHealthCheck,
  useInsertTemplateSteps, useDeleteStepTemplate,
  useUpdateRunSelector, useAcceptHealedSelector,
  useInvalidateTests,
} from '../../hooks/api';
import type { TestType } from './types';
import type { useAIHealthState } from './useAIHealthState';
import type { useReviewState } from './useReviewState';
import type { useSelectorEditState } from './useSelectorEditState';
import type { SuiteRunLocal } from '@/types/tests';

interface UseSuitePageHandlersOptions {
  suiteId: string | undefined;
  suite: { id: string; name: string; project_id: string; browser?: string; description?: string; viewport_width?: number; viewport_height?: number; timeout?: number; retry_count?: number } | null;
  tests: TestType[];
  suiteRun: SuiteRunLocal | null;
  setSuiteRun: React.Dispatch<React.SetStateAction<SuiteRunLocal | null>>;
  setSuiteRunActive: (active: boolean) => void;
  setIsRunningSuite: (running: boolean) => void;
  setIsCancellingSuite: (cancelling: boolean) => void;
  setRunningTestId: (testId: string | null) => void;
  setIsDeletingSuite: (deleting: boolean) => void;
  setShowDeleteSuiteModal: (show: boolean) => void;
  setIsDeletingTest: (deleting: boolean) => void;
  setShowDeleteTestModal: (testId: string | null) => void;
  setLiveScreenshot: (screenshot: null) => void;
  setScreenshotHistory: (history: never[]) => void;
  setImportError: (error: string) => void;
  setIsImporting: (importing: boolean) => void;
  setShowImportModal: (show: boolean) => void;
  setShowTemplateModal: (show: boolean) => void;
  setInsertTemplateForTest: (testId: string | null) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  aiHealth: ReturnType<typeof useAIHealthState>;
  reviewState: ReturnType<typeof useReviewState>;
  selectorEdit: ReturnType<typeof useSelectorEditState>;
  refetchStepTemplates: () => void;
}

export function useSuitePageHandlers(opts: UseSuitePageHandlersOptions) {
  const {
    suiteId, suite, tests, suiteRun,
    setSuiteRun, setSuiteRunActive, setIsRunningSuite, setIsCancellingSuite,
    setRunningTestId, setIsDeletingSuite, setShowDeleteSuiteModal,
    setIsDeletingTest, setShowDeleteTestModal,
    setLiveScreenshot, setScreenshotHistory,
    setImportError, setIsImporting, setShowImportModal,
    setShowTemplateModal, setInsertTemplateForTest, fileInputRef,
    aiHealth, reviewState, selectorEdit,
    refetchStepTemplates,
  } = opts;

  const { token } = useAuthStore();
  const navigate = useNavigate();
  const logger = createLogger('suite-handlers');
  const { invalidateBySuite } = useInvalidateTests();

  // Mutation hooks
  const reviewTestMutation = useReviewTest();
  const batchReviewMutation = useBatchReviewTests();
  const duplicateTestMutation = useDuplicateTest();
  const deleteTestMutation = useDeleteTest();
  const startRunMutation = useStartRun();
  const cancelRunMutation = useCancelRun();
  const startSuiteRunMutation = useStartSuiteRun();
  const deleteSuiteMutation = useDeleteSuite();
  const toggleHumanReviewMutation = useToggleHumanReview();
  const aiHealthCheckMutation = useAIHealthCheck();
  const updateRunSelectorMutation = useUpdateRunSelector();
  const acceptHealedSelectorMutation = useAcceptHealedSelector();
  const insertTemplateStepsMutation = useInsertTemplateSteps();
  const deleteStepTemplateMutation = useDeleteStepTemplate();

  // Feature #1151: Toggle human review requirement
  const handleToggleHumanReview = useCallback(async () => {
    if (!suiteId) return;
    try {
      const data = await toggleHumanReviewMutation.mutateAsync({
        suiteId,
        requireHumanReview: !(opts as { requireHumanReview?: boolean }).requireHumanReview,
      });
      toast.success(data.message || 'Review settings updated');
    } catch {
      toast.error('Failed to update review settings');
    }
  }, [suiteId, toggleHumanReviewMutation]);

  // Feature #1151: Approve or reject a test
  const handleReviewTest = useCallback(async (testId: string, action: 'approve' | 'reject', notes?: string) => {
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
  }, [token, reviewTestMutation, reviewState]);

  // Feature #1152: Batch review multiple AI-generated tests
  const handleBatchReview = useCallback(async (action: 'approve' | 'reject') => {
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
  }, [token, suiteId, batchReviewMutation, reviewState]);

  // Feature #580: Run AI health check
  const handleAIHealthCheck = useCallback(async () => {
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
  }, [suiteId, aiHealthCheckMutation, aiHealth]);

  const handleRunSuite = useCallback(async () => {
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
  }, [tests.length, suiteId, startSuiteRunMutation, setSuiteRun, setSuiteRunActive, setIsRunningSuite, setLiveScreenshot, setScreenshotHistory]);

  const handleRunSingleTest = useCallback(async (testId: string) => {
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
  }, [startRunMutation, navigate, setRunningTestId]);

  const handleDuplicateTest = useCallback(async (test: TestType) => {
    try {
      await duplicateTestMutation.mutateAsync({
        suiteId: suiteId || '',
        data: {
          name: `${test.name} (Copy)`,
          description: test.description,
          test_type: test.test_type || test.type,
          steps: test.steps as Parameters<typeof duplicateTestMutation.mutateAsync>[0]['data']['steps'],
          target_url: test.target_url,
        },
      });
      toast.success('Test duplicated successfully');
    } catch (err) {
      logger.error('Failed to duplicate test:', err);
      toast.error(getErrorMessage(err, 'Failed to duplicate test'));
    }
  }, [suiteId, duplicateTestMutation]);

  const handleDeleteTest = useCallback(async (testId: string) => {
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
  }, [suiteId, deleteTestMutation, setIsDeletingTest, setShowDeleteTestModal]);

  const handleCancelSuiteRun = useCallback(async () => {
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
  }, [suiteRun?.id, cancelRunMutation, setSuiteRun, setSuiteRunActive, setIsRunningSuite, setIsCancellingSuite]);

  const handleDeleteSuite = useCallback(async () => {
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
  }, [suiteId, suite, deleteSuiteMutation, navigate, setIsDeletingSuite, setShowDeleteSuiteModal]);

  // Feature #1065: Handle selector update
  const handleUpdateSelector = useCallback(async () => {
    const modal = selectorEdit.editSelectorModal;
    if (!modal.runId || !modal.testId || !modal.stepId) {
      toast.error('Missing required information');
      return;
    }
    if (!selectorEdit.editSelectorValue.trim()) {
      toast.error('Selector cannot be empty');
      return;
    }
    selectorEdit.setIsSubmittingSelector(true);
    try {
      const data = await updateRunSelectorMutation.mutateAsync({
        runId: modal.runId,
        testId: modal.testId,
        stepId: modal.stepId,
        newSelector: selectorEdit.editSelectorValue.trim(),
        notes: selectorEdit.editSelectorNotes.trim() || undefined,
        applyToTest: selectorEdit.editSelectorApplyToTest,
      });
      toast.success(data.message || 'Selector updated successfully');
      selectorEdit.closeSelectorModal();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update selector');
    } finally {
      selectorEdit.setIsSubmittingSelector(false);
    }
  }, [selectorEdit, updateRunSelectorMutation]);

  // Feature #1065: Handle accept healed selector
  const handleAcceptHealed = useCallback(async () => {
    const modal = selectorEdit.editSelectorModal;
    if (!modal.runId || !modal.testId || !modal.stepId) {
      toast.error('Missing required information');
      return;
    }
    selectorEdit.setIsSubmittingSelector(true);
    try {
      const data = await acceptHealedSelectorMutation.mutateAsync({
        runId: modal.runId,
        testId: modal.testId,
        stepId: modal.stepId,
        applyToTest: selectorEdit.editSelectorApplyToTest,
      });
      toast.success(data.message || 'Healed selector accepted');
      selectorEdit.closeSelectorModal();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to accept healed selector');
    } finally {
      selectorEdit.setIsSubmittingSelector(false);
    }
  }, [selectorEdit, acceptHealedSelectorMutation]);

  // Handle test file import with validation
  const handleImportTests = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
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
  }, [setImportError, setIsImporting, setShowImportModal, fileInputRef]);

  const loadStepTemplates = useCallback(() => {
    refetchStepTemplates();
  }, [refetchStepTemplates]);

  const handleInsertTemplate = useCallback(async (testId: string, template: { steps: Array<{ action: string; selector?: string; value?: string; text?: string; url?: string }> }) => {
    try {
      await insertTemplateStepsMutation.mutateAsync({
        testId,
        steps: template.steps as Parameters<typeof insertTemplateStepsMutation.mutateAsync>[0]['steps'],
        suiteId,
      });
      toast.success('Template steps inserted into test');
      setShowTemplateModal(false);
      setInsertTemplateForTest(null);
      invalidateBySuite(suiteId || '');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to insert template');
    }
  }, [suiteId, insertTemplateStepsMutation, invalidateBySuite, setShowTemplateModal, setInsertTemplateForTest]);

  const handleDeleteTemplate = useCallback(async (templateId: string) => {
    try {
      await deleteStepTemplateMutation.mutateAsync({ templateId, suiteId: suiteId || '' });
      toast.success('Template deleted');
    } catch {
      toast.error('Failed to delete template');
    }
  }, [suiteId, deleteStepTemplateMutation]);

  // Export tests to JSON file
  const handleExportTests = useCallback(() => {
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
  }, [tests, suite]);

  // Export completed run results as JSON
  const handleExportRunJSON = useCallback(() => {
    if (!suiteRun || !suiteRun.results) {
      toast.error('No completed run to export');
      return;
    }
    const exportData = {
      runId: suiteRun.id,
      suiteId,
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
  }, [suiteRun, suiteId, suite?.name]);

  // Export completed run results as PDF (HTML print)
  const handleExportRunPDF = useCallback(() => {
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
      const statusIcon = r.status === 'passed' ? '✅' : r.status === 'failed' ? '❌' : '⚠️';
      const dur = r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)}s` : '—';
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
  }, [suiteRun, suite?.name]);

  return {
    // Mutation hooks needed by the page for direct access
    reviewTestMutation,
    batchReviewMutation,
    duplicateTestMutation,
    deleteTestMutation,
    startRunMutation,
    cancelRunMutation,
    startSuiteRunMutation,
    deleteSuiteMutation,
    // Handler functions
    handleToggleHumanReview,
    handleReviewTest,
    handleBatchReview,
    handleAIHealthCheck,
    handleRunSuite,
    handleRunSingleTest,
    handleDuplicateTest,
    handleDeleteTest,
    handleCancelSuiteRun,
    handleDeleteSuite,
    handleUpdateSelector,
    handleAcceptHealed,
    handleImportTests,
    handleInsertTemplate,
    handleDeleteTemplate,
    handleExportTests,
    handleExportRunJSON,
    handleExportRunPDF,
    loadStepTemplates,
  };
}
