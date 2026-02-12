// TestSuitePage - Test suite management with recording, AI generation, and execution
// Feature #59: Migrated to React Query for paginated test loading
// Feature #125: Added skeleton loaders for better perceived performance
// Feature #337: Dark-first design system redesign
// Feature #525: Added suite health metrics with unified ScoreCard component
// Feature #546: Replaced HTTP polling with WebSocket live streaming via useSuiteRunSocket
import { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { SkeletonTestSuitePage } from '../components/ui/Skeleton';
import { useAuthStore } from '../stores/authStore';
import { toast } from '../stores/toastStore';
import { getErrorMessage } from '../utils/errorHandling';
import { createLogger } from '../utils/logger';
import { UnifiedAIService } from '../services/UnifiedAIService';

const logger = createLogger('test-suite');
// Feature #673: Lazy-load CreateTestModal for better initial page load
const CreateTestModal = lazy(() => import('../components/create-test').then(m => ({ default: m.CreateTestModal })));
import { ScoreCard } from '../components/ui/score-card';
// Feature #580: Icons for AI health monitoring panel
import { Sparkles, AlertTriangle, AlertCircle, Info, ChevronDown, ChevronUp, Loader2, TrendingUp, TrendingDown, Minus, Clock, ChevronRight } from 'lucide-react';
// Feature #554: Standardized PageHeader with breadcrumbs
// Feature #556: ScoreTrendChart replaces inline recharts chart
import { PageHeader, ScoreTrendChart } from '../components/ui';
// Feature #546: WebSocket-based suite run tracking (replaces HTTP polling + separate socket)
import { useSuiteRunSocket, type LiveScreenshot, type ScreenshotHistoryEntry, type SuiteRun as SuiteRunSocket } from '../hooks/useSuiteRunSocket';
// Feature #59: React Query hooks for paginated test loading
// Feature #143: Added mutation hooks for operations
// Feature #701: Added review settings, AI health check, step templates, and selector hooks
import {
  useTestsPaginated, useSuite, useInvalidateTests,
  useReviewTest, useBatchReviewTests, useDuplicateTest, useDeleteTest,
  useStartRun, useCancelRun, useStartSuiteRun, useDeleteSuite,
  useRunsBySuite,
  useProject,
  useReviewSettings, useToggleHumanReview, useAIHealthCheck,
  useStepTemplates, useInsertTemplateSteps, useDeleteStepTemplate,
  useUpdateRunSelector, useAcceptHealedSelector,
  useRun,
} from '../hooks/api';
// Feature #553: Pass rate trend chart (Feature #556: now uses ScoreTrendChart component)
import {
  TestType, DeleteSuiteModal, DeleteTestModal, // TestStep unused - referenced in comment only
  ImportTestsModal, EditSelectorModal, ExpandedScreenshotModal, InsertTemplateModal,
  GeneratedTestPreviewModal, RecordTestModal, ReviewRecordedTestModal,
  SuiteHeaderActions, HumanReviewPanel, SuiteRunResults,
  TestListSection, useRecordingState,
  FullEditTestModal,
  computeSuiteHealthScore,
  // Feature #702: State consolidation hooks
  useAIHealthState, useReviewState, useSelectorEditState,
} from '../components/suite-detail';

// Suite run result for test status tracking (compatible with both SuiteRunResults and TestListSection)
interface SuiteRunResultLocal {
  test_id: string;
  test_name: string;
  test_type?: string;
  status: 'passed' | 'failed' | 'error' | 'running' | 'skipped';
  duration_ms: number;
  error?: string;
  diff_percentage?: number;
}

// Suite run state - matches component expectations
// Feature #555: Added completed_at for export functionality
interface SuiteRunLocal {
  id: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'cancelled';
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  results?: SuiteRunResultLocal[];
}

function TestSuitePage() {
  const { suiteId } = useParams<{ suiteId: string }>();
  const { token, user } = useAuthStore();
  const navigate = useNavigate();

  // Feature #59: Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Feature #59: React Query hooks for suite and tests (parallel loading)
  const { data: suiteData, isLoading: suiteLoading, error: suiteError } = useSuite(suiteId);
  const { data: testsData, isLoading: testsLoading } = useTestsPaginated(suiteId, {
    page: currentPage,
    limit: itemsPerPage,
  });
  const { invalidateBySuite } = useInvalidateTests();
  // Feature #553: Fetch last runs for suite run history + trend chart
  const { data: suiteRunsData } = useRunsBySuite(suiteId);

  // Feature #143: Mutation hooks for operations (replace raw fetch calls)
  const reviewTestMutation = useReviewTest();
  const batchReviewMutation = useBatchReviewTests();
  const duplicateTestMutation = useDuplicateTest();
  const deleteTestMutation = useDeleteTest();
  const startRunMutation = useStartRun();
  const cancelRunMutation = useCancelRun();
  const startSuiteRunMutation = useStartSuiteRun();
  const deleteSuiteMutation = useDeleteSuite();

  // Extract data from React Query responses
  const suite = suiteData?.suite || null;
  // Feature #59: Map API response to TestType format (API returns test_type, component expects type)
  const tests: TestType[] = (testsData?.tests || testsData?.data || []).map((t) => ({
    ...t,
    type: (t.test_type || 'e2e') as TestType['type'], // Ensure type field exists
    test_type: t.test_type || 'e2e',
    status: t.status as TestType['status'], // Cast status to compatible type
    review_status: t.review_status as TestType['review_status'], // Cast review_status
  })) as TestType[];
  const pagination = testsData?.pagination;

  // Feature #553: State for collapsible recent runs section
  const [showRecentRuns, setShowRecentRuns] = useState(false);

  // Feature #701: Project loaded via React Query instead of raw fetch
  const { data: projectData } = useProject(suite?.project_id);
  const project = projectData?.project || null;

  // Feature #701: Review settings via React Query
  const { data: reviewSettingsData } = useReviewSettings(suiteId);
  const toggleHumanReviewMutation = useToggleHumanReview();

  // Feature #701: AI health check mutation
  const aiHealthCheckMutation = useAIHealthCheck();

  // Feature #701: Step templates via React Query
  const { data: stepTemplatesData, refetch: refetchStepTemplates } = useStepTemplates(suiteId);

  // Feature #701: Selector update mutations
  const updateRunSelectorMutation = useUpdateRunSelector();
  const acceptHealedSelectorMutation = useAcceptHealedSelector();
  const insertTemplateStepsMutation = useInsertTemplateSteps();
  const deleteStepTemplateMutation = useDeleteStepTemplate();

  // Recording state hook - saves ~500 lines of recording/socket logic
  const recording = useRecordingState({
    suiteId, token, projectBaseUrl: project?.base_url,
    onTestCreated: async () => {
      // Feature #59: Use React Query invalidation to refresh tests
      invalidateBySuite(suiteId || '');
    },
  });

  // Feature #702: State consolidation hooks - reduce 40+ useState to grouped hooks
  const aiHealth = useAIHealthState();
  const reviewState = useReviewState();
  const selectorEdit = useSelectorEditState();

  useEffect(() => { UnifiedAIService.setToken(token || null); }, [token]);
  // Feature #59: Derive loading/error state from React Query
  const isLoading = suiteLoading || testsLoading;
  const error = suiteError ? (suiteError instanceof Error ? suiteError.message : 'Failed to load test suite') : null;
  // Feature #1800: New two-section modal toggle (use new modal by default)
  const [showNewCreateTestModal, setShowNewCreateTestModal] = useState(false);
  // Feature #1342: Natural Language Test Generation state
  const [showAITestGenerator, setShowAITestGenerator] = useState(false);
  const [aiTestDescription, setAITestDescription] = useState('');
  const [generatedTestCode, setGeneratedTestCode] = useState('');
  const [generatedTestPreview, setGeneratedTestPreview] = useState<{
    test_name: string;
    steps: string[];
    selectors: string[];
    assertions: string[];
    syntax_valid: boolean;
    syntax_errors?: string[];
    complexity: 'simple' | 'medium' | 'complex';
    warnings?: string[];
    // Feature #1153: Test generation confidence score
    confidence_score?: number;
    confidence_factors?: {
      factor: string;
      score: number;
      max_score: number;
      description: string;
    }[];
  } | null>(null);
  const [showGeneratedCodeModal, setShowGeneratedCodeModal] = useState(false);
  // Feature #50: AI generation modes moved to CreateTestModal which is self-contained
  // Feature #1151: Human review workflow for AI tests
  // Feature #701: Review settings now from React Query (reviewSettingsData)
  const requireHumanReview = reviewSettingsData?.require_human_review ?? false;
  // Map API stats to component-expected shape (ensure required fields have defaults)
  const reviewStats = reviewSettingsData?.stats ? {
    total_tests: reviewSettingsData.stats.total_tests ?? 0,
    ai_generated: reviewSettingsData.stats.ai_generated ?? 0,
    pending_review: reviewSettingsData.stats.pending_review,
    approved: reviewSettingsData.stats.approved,
    rejected: reviewSettingsData.stats.rejected,
  } : null;
  // Feature #1151-1163: Review workflow state - Feature #702: Now using useReviewState hook
  const {
    showReviewPanel, setShowReviewPanel,
    isApproving, setIsApproving,
    selectedForReview,
    regenerationFeedback, setRegenerationFeedback,
    isRegenerating, setIsRegenerating,
    previousGeneratedCode, setPreviousGeneratedCode,
    showDiffView, setShowDiffView,
    toggleTestSelection, toggleAllTestsSelection,
  } = reviewState;

  const [searchQuery, setSearchQuery] = useState('');
  // Feature #1958: Sorting state for test list
  const [sortField, setSortField] = useState<'name' | 'status' | 'last_run' | 'last_result' | 'run_count' | 'avg_duration' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [isRunningSuite, setIsRunningSuite] = useState(false);
  const [isCancellingSuite, setIsCancellingSuite] = useState(false);
  const [suiteRun, setSuiteRun] = useState<SuiteRunLocal | null>(null);
  // Feature #546: suiteRunPolling replaced by WebSocket - kept for backwards compat with run start
  const [suiteRunActive, setSuiteRunActive] = useState(false);

  const [showDeleteSuiteModal, setShowDeleteSuiteModal] = useState(false);
  const [isDeletingSuite, setIsDeletingSuite] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importError, setImportError] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Feature #1961: Quick actions dropdown state
  const [openActionsDropdown, setOpenActionsDropdown] = useState<string | null>(null);
  const [runningTestId, setRunningTestId] = useState<string | null>(null);
  const [showDeleteTestModal, setShowDeleteTestModal] = useState<string | null>(null);
  const [isDeletingTest, setIsDeletingTest] = useState(false);
  // Feature #595: Full edit test modal state
  const [editingTest, setEditingTest] = useState<TestType | null>(null);

  // Feature #580: AI Health Monitoring state - Feature #702: Now using useAIHealthState hook
  const { aiHealthReport, isLoadingHealthCheck, showHealthInsights } = aiHealth;

  // Feature #50: Visual recorder state moved to useRecordingState hook (saves ~55 lines)
  // Feature #31: Step Templates state
  // Feature #701: Step templates now from React Query (stepTemplatesData)
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const stepTemplates = stepTemplatesData?.templates ?? [];
  const [insertTemplateForTest, setInsertTemplateForTest] = useState<string | null>(null);

  // Feature #35: Live screenshot streaming during test execution
  const [liveScreenshot, setLiveScreenshot] = useState<{
    base64: string;
    testId: string;
    testName: string;
    stepIndex: number;
    stepAction: string;
    stepSelector?: string;
    timestamp: number;
  } | null>(null);
  const [screenshotHistory, setScreenshotHistory] = useState<Array<{
    base64: string;
    stepIndex: number;
    stepAction: string;
    timestamp: number;
  }>>([]);
  const [expandedScreenshot, setExpandedScreenshot] = useState<string | null>(null);

  // Feature #546: WebSocket callbacks for suite run tracking (replaces HTTP polling + separate socket)
  const handleSuiteRunUpdate = useCallback((update: Partial<SuiteRunSocket>) => {
    setSuiteRun(prev => prev ? { ...prev, ...update } as SuiteRunLocal : null);
  }, []);

  const handleSuiteRunComplete = useCallback(async (completedRun: SuiteRunSocket) => {
    // Set status immediately from WebSocket event
    setSuiteRun(prev => prev ? {
      ...prev,
      status: completedRun.status,
      duration_ms: completedRun.duration_ms,
    } : null);
    setSuiteRunActive(false);
    setIsRunningSuite(false);

    // Fetch full run results from API (WebSocket event doesn't include per-test results)
    // Feature #701: Using fetchWithAuth helper instead of raw fetch
    if (completedRun.id && token) {
      try {
        const { fetchWithAuth } = await import('../hooks/api/fetchWithAuth');
        const data = await fetchWithAuth(`/api/v1/runs/${completedRun.id}`, token);
        setSuiteRun(data.run);
      } catch (err) {
        logger.error('Failed to fetch final run results:', err);
      }
    }
  }, [token]);

  const handleSuiteRunScreenshot = useCallback((screenshot: LiveScreenshot) => {
    setLiveScreenshot(screenshot);
  }, []);

  const handleSuiteRunScreenshotHistory = useCallback((entry: ScreenshotHistoryEntry) => {
    setScreenshotHistory(prev => [...prev, entry].slice(-3)); // Keep last 3
  }, []);

  // Feature #546: Use WebSocket for live suite run updates (replaces polling + separate socket)
  // Feature #547: Capture perTestStatus and currentStep for WaveProgressCard grid
  const { perTestStatus, currentStep } = useSuiteRunSocket({
    runId: suiteRun?.id,
    token,
    onRunUpdate: handleSuiteRunUpdate,
    onRunComplete: handleSuiteRunComplete,
    onScreenshot: handleSuiteRunScreenshot,
    onScreenshotHistory: handleSuiteRunScreenshotHistory,
    enabled: suiteRunActive,
  });

  const canCreateTest = user?.role !== 'viewer';
  const canDeleteSuite = user?.role === 'owner' || user?.role === 'admin';

  // Feature #1065: Edit selector modal state - Feature #702: Now using useSelectorEditState hook
  const {
    editSelectorModal,
    editSelectorValue, setEditSelectorValue,
    editSelectorNotes, setEditSelectorNotes,
    editSelectorApplyToTest, setEditSelectorApplyToTest,
    isSubmittingSelector, setIsSubmittingSelector,
    closeSelectorModal,
  } = selectorEdit;

  // Handle Escape key to close modals and dropdowns
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showDeleteSuiteModal) setShowDeleteSuiteModal(false);
        if (showDeleteTestModal) setShowDeleteTestModal(null);
        if (openActionsDropdown) setOpenActionsDropdown(null);
      }
    };
    // Feature #1961: Close dropdown when clicking outside
    const handleClickOutside = () => {
      if (openActionsDropdown) setOpenActionsDropdown(null);
    };
    document.addEventListener('keydown', handleEscape);
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showDeleteSuiteModal, showDeleteTestModal, openActionsDropdown]);

  // Filter tests based on search query
  const trimmedSearchQuery = searchQuery.trim();
  const filteredTests = tests.filter(test =>
    trimmedSearchQuery === '' ||
    test.name.toLowerCase().includes(trimmedSearchQuery.toLowerCase()) ||
    (test.description && test.description.toLowerCase().includes(trimmedSearchQuery.toLowerCase()))
  );

  // Sort handler for test list columns
  const handleSort = (field: 'name' | 'status' | 'last_run' | 'last_result' | 'run_count' | 'avg_duration') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Feature #1958: Sort filtered tests
  const sortedTests = [...filteredTests].sort((a, b) => {
    if (!sortField) return 0;

    let comparison = 0;
    switch (sortField) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'status':
        comparison = (a.status || '').localeCompare(b.status || '');
        break;
      case 'last_run': {
        const aTime = a.last_run_at ? new Date(a.last_run_at).getTime() : 0;
        const bTime = b.last_run_at ? new Date(b.last_run_at).getTime() : 0;
        comparison = aTime - bTime;
        break;
      }
      case 'last_result': {
        // Order: passed > running > failed > error > null
        const resultOrder: Record<string, number> = { passed: 4, running: 3, failed: 2, error: 1 };
        const aOrder = a.last_result ? resultOrder[a.last_result] || 0 : 0;
        const bOrder = b.last_result ? resultOrder[b.last_result] || 0 : 0;
        comparison = aOrder - bOrder;
        break;
      }
      case 'run_count':
        comparison = (a.run_count || 0) - (b.run_count || 0);
        break;
      case 'avg_duration':
        comparison = (a.avg_duration_ms || 0) - (b.avg_duration_ms || 0);
        break;
    }

    return sortDirection === 'desc' ? -comparison : comparison;
  });

  // Feature #701: Project and review settings now loaded via React Query hooks at the top
  // Removed useEffect for project fetch - now using useProject hook
  // Removed useEffect for review settings fetch - now using useReviewSettings hook

  // Feature #1151: Toggle human review requirement
  // Feature #701: Converted to React Query mutation
  const handleToggleHumanReview = async () => {
    if (!suiteId) return;
    try {
      const data = await toggleHumanReviewMutation.mutateAsync({
        suiteId,
        requireHumanReview: !requireHumanReview,
      });
      toast.success(data.message || 'Review settings updated');
    } catch (err) {
      toast.error('Failed to update review settings');
    }
  };

  // Feature #1151: Approve or reject a test
  // Feature #143: Converted to React Query mutation
  const handleReviewTest = async (testId: string, action: 'approve' | 'reject', notes?: string) => {
    if (!token) return;
    setIsApproving(true);
    try {
      const status = action === 'approve' ? 'approved' : 'rejected';
      const data = await reviewTestMutation.mutateAsync({ testId, status, notes });
      toast.success(data.message || `Test ${action}d successfully`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to review test'));
    } finally {
      setIsApproving(false);
    }
  };

  // Feature #1152: Batch review multiple AI-generated tests
  // Feature #143: Converted to React Query mutation
  // Feature #702: Now using useReviewState hook methods
  const handleBatchReview = async (action: 'approve' | 'reject') => {
    if (!token || selectedForReview.size === 0) return;
    setIsApproving(true);
    try {
      const status = action === 'approve' ? 'approved' : 'rejected';
      const testIds = Array.from(selectedForReview);
      const data = await batchReviewMutation.mutateAsync({ testIds, status, suiteId });
      // Clear selection using hook method
      reviewState.clearSelection();
      toast.success(`Successfully ${action}d ${data.successful || testIds.length} test(s)`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to batch review tests'));
    } finally {
      setIsApproving(false);
    }
  };

  // Feature #1152: Toggle selection for batch review - Feature #702: Now provided by useReviewState hook
  // toggleTestSelection and toggleAllTestsSelection are destructured from reviewState above

  // Feature #50: computeCodeDiff, calculateTestConfidence, validateTestName moved to utils.ts

  // Feature #580: Run AI health check
  // Feature #701: Converted to React Query mutation
  // Feature #702: Now using useAIHealthState hook methods
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

  const handleRunSuite = async () => {
    if (tests.length === 0) return;

    setIsRunningSuite(true);
    setSuiteRun(null);
    // Feature #546: Clear screenshot state for new run
    setLiveScreenshot(null);
    setScreenshotHistory([]);

    try {
      // Feature #143: Converted to React Query mutation
      const data = await startSuiteRunMutation.mutateAsync({ suiteId: suiteId || '' });
      setSuiteRun(data.run);
      // Feature #546: Enable WebSocket tracking instead of polling
      setSuiteRunActive(true);
    } catch (err) {
      logger.error('Failed to run suite:', err);
      toast.error(getErrorMessage(err, 'Failed to start test run'));
      setIsRunningSuite(false);
    }
  };

  // Feature #1961: Quick actions - Run single test
  // Feature #143: Converted to React Query mutation
  const handleRunSingleTest = async (testId: string) => {
    setRunningTestId(testId);
    try {
      await startRunMutation.mutateAsync({ testId });
      toast.success('Test run started');
      navigate(`/tests/${testId}`);
    } catch (err) {
      logger.error('Failed to run test:', err);
      toast.error(getErrorMessage(err, 'Failed to start test run'));
    } finally {
      setRunningTestId(null);
    }
  };

  // Feature #1961: Quick actions - Duplicate test
  // Feature #143: Converted to React Query mutation
  const handleDuplicateTest = async (test: TestType) => {
    try {
      await duplicateTestMutation.mutateAsync({
        suiteId: suiteId || '',
        data: {
          name: `${test.name} (Copy)`,
          description: test.description,
          test_type: test.test_type || test.type,
          // Type cast needed: suite-detail/types.ts TestStep lacks 'order' field required by useTests.ts
          steps: test.steps as Parameters<typeof duplicateTestMutation.mutateAsync>[0]['data']['steps'],
          target_url: test.target_url,
        },
      });
      toast.success('Test duplicated successfully');
    } catch (err) {
      logger.error('Failed to duplicate test:', err);
      toast.error(getErrorMessage(err, 'Failed to duplicate test'));
    }
  };

  // Feature #1961: Quick actions - Delete test
  // Feature #143: Converted to React Query mutation
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

  // Feature #143: Converted to React Query mutation
  const handleCancelSuiteRun = async () => {
    if (!suiteRun?.id) return;

    setIsCancellingSuite(true);

    try {
      await cancelRunMutation.mutateAsync(suiteRun.id);
      setSuiteRun((prev) => prev ? { ...prev, status: 'cancelled' as const } : null);
      // Feature #546: Disable WebSocket tracking on cancel
      setSuiteRunActive(false);
      setIsRunningSuite(false);
      toast.success('Test run cancelled');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to cancel run'));
    } finally {
      setIsCancellingSuite(false);
    }
  };

  // Feature #143: Converted to React Query mutation
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

  // Feature #1065: Handle selector update in TestSuitePage
  // Feature #701: Converted to React Query mutation
  // Feature #702: Now using useSelectorEditState hook methods
  const handleUpdateSelector = async () => {
    if (!editSelectorModal.runId || !editSelectorModal.testId || !editSelectorModal.stepId) {
      toast.error('Missing required information');
      return;
    }

    if (!editSelectorValue.trim()) {
      toast.error('Selector cannot be empty');
      return;
    }

    setIsSubmittingSelector(true);
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
      closeSelectorModal();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update selector');
    } finally {
      setIsSubmittingSelector(false);
    }
  };

  // Feature #1065: Handle accept healed selector in TestSuitePage
  // Feature #701: Converted to React Query mutation
  // Feature #702: Now using useSelectorEditState hook methods
  const handleAcceptHealed = async () => {
    if (!editSelectorModal.runId || !editSelectorModal.testId || !editSelectorModal.stepId) {
      toast.error('Missing required information');
      return;
    }

    setIsSubmittingSelector(true);
    try {
      const data = await acceptHealedSelectorMutation.mutateAsync({
        runId: editSelectorModal.runId,
        testId: editSelectorModal.testId,
        stepId: editSelectorModal.stepId,
        applyToTest: editSelectorApplyToTest,
      });

      toast.success(data.message || 'Healed selector accepted');
      closeSelectorModal();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to accept healed selector');
    } finally {
      setIsSubmittingSelector(false);
    }
  };

  // Handle test file import with validation
  const handleImportTests = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError('');

    // Validate file type - only JSON and Playwright test files
    const allowedTypes = ['application/json'];
    const allowedExtensions = ['.json', '.spec.ts', '.spec.js', '.test.ts', '.test.js'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
      setImportError(`Invalid file type: "${file.name}". Please upload a JSON file or Playwright test file (.spec.ts, .spec.js, .test.ts, .test.js).`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      setImportError(`File too large: ${fileSizeMB}MB. Maximum allowed size is 5MB.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // For JSON files, try to parse and validate structure
    if (file.type === 'application/json' || fileExtension === '.json') {
      setIsImporting(true);
      try {
        const text = await file.text();
        const data = JSON.parse(text);

        // Validate JSON structure - expect array of tests or single test object
        if (!Array.isArray(data) && typeof data !== 'object') {
          setImportError('Invalid JSON structure. Expected an array of tests or a test object.');
          setIsImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        const testsToImport = Array.isArray(data) ? data : [data];

        // Validate each test has required fields
        for (let i = 0; i < testsToImport.length; i++) {
          const test = testsToImport[i];
          if (!test.name || typeof test.name !== 'string') {
            setImportError(`Invalid test at index ${i}: missing or invalid "name" field.`);
            setIsImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
          }
        }

        // Import tests (simulated - in production would call API)
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
      // For Playwright test files, just acknowledge receipt
      toast.info(`Playwright test file "${file.name}" received. Import processing would happen here.`);
      setShowImportModal(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Feature #50: Recording handlers (handleStartRecording, handleStopRecording, handleSaveRecordedTest,
  // handleSaveAsTemplate, handleCancelRecording, handleRetryConnection, handleStopAndSave)
  // moved to useRecordingState hook - saving ~370 lines

  // Feature #31: Load templates list
  // Feature #701: Now using useStepTemplates hook, refetch available via refetchStepTemplates
  const loadStepTemplates = () => {
    refetchStepTemplates();
  };

  // Feature #31: Insert template steps into an existing test
  // Feature #701: Converted to React Query mutation
  const handleInsertTemplate = async (testId: string, template: { steps: Array<{ action: string; selector?: string; value?: string; text?: string; url?: string }> }) => {
    try {
      await insertTemplateStepsMutation.mutateAsync({
        testId,
        steps: template.steps as Parameters<typeof insertTemplateStepsMutation.mutateAsync>[0]['steps'],
        suiteId,
      });
      toast.success('Template steps inserted into test');
      setShowTemplateModal(false);
      setInsertTemplateForTest(null);
      // Feature #59: Use React Query invalidation to refresh tests
      invalidateBySuite(suiteId || '');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to insert template');
    }
  };

  // Feature #31: Delete a step template
  // Feature #701: Converted to React Query mutation
  const handleDeleteTemplate = async (templateId: string) => {
    try {
      await deleteStepTemplateMutation.mutateAsync({ templateId, suiteId: suiteId || '' });
      toast.success('Template deleted');
    } catch (err) {
      toast.error('Failed to delete template');
    }
  };

  // Export tests to JSON file
  const handleExportTests = () => {
    if (tests.length === 0) {
      toast.error('No tests to export');
      return;
    }

    // Prepare export data with suite metadata
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

    // Create and download JSON file
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

  // Feature #555: Export completed run results as JSON
  const handleExportRunJSON = useCallback(() => {
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
  }, [suiteRun, suiteId, suite?.name]);

  // Feature #555: Export completed run results as PDF
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
    <div class="summary-card">
      <div class="summary-value" style="color: ${statusColor};">${passRate}%</div>
      <div style="font-size: 12px; color: #6b7280;">Pass Rate</div>
    </div>
    <div class="summary-card">
      <div class="summary-value" style="color: #22c55e;">${passed}</div>
      <div style="font-size: 12px; color: #6b7280;">Passed</div>
    </div>
    <div class="summary-card">
      <div class="summary-value" style="color: #ef4444;">${failed}</div>
      <div style="font-size: 12px; color: #6b7280;">Failed</div>
    </div>
    <div class="summary-card">
      <div class="summary-value">${total}</div>
      <div style="font-size: 12px; color: #6b7280;">Total Tests</div>
    </div>
  </div>

  <h3 style="font-size: 16px; color: #374151; margin-top: 24px;">Test Results</h3>
  <table>
    <thead><tr>
      <th>Test Name</th>
      <th style="text-align: center;">Type</th>
      <th style="text-align: center;">Status</th>
      <th style="text-align: right;">Duration</th>
      <th>Error</th>
    </tr></thead>
    <tbody>${resultRows}</tbody>
  </table>

  <div class="footer">
    Generated by QA Guardian &middot; ${new Date().toISOString()} &middot; Run ID: ${suiteRun.id}
  </div>
</body>
</html>`;

    // Feature #578: Use Blob URL + hidden iframe instead of window.open (avoids popup blockers)
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
        // Fallback: download as HTML file
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `suite-run-report-${suite?.name || 'suite'}.html`;
        a.click();
      }
      // Cleanup after a delay to allow print dialog to open
      setTimeout(() => {
        document.body.removeChild(iframe);
        URL.revokeObjectURL(blobUrl);
      }, 60000);
    };

    toast.success('Opening PDF print dialog...');
  }, [suiteRun, suite?.name]);

  // Feature #546: Polling and separate Socket.IO connection replaced by useSuiteRunSocket hook
  // The hook handles: run-start, run-progress, step-start, step-complete, step:screenshot, run-complete
  // See useSuiteRunSocket initialization above (after screenshot state declarations)

  // Feature #125: Skeleton loader for better perceived performance
  if (isLoading) {
    return (
      <Layout>
        <div className="p-8">
          <SkeletonTestSuitePage />
        </div>
      </Layout>
    );
  }

  if (error || !suite) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center p-8 min-h-[60vh]">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground">Test Suite Not Found</h2>
            <p className="mt-2 text-muted-foreground">{error}</p>
            <button
              onClick={() => navigate('/projects')}
              className="mt-6 rounded-md bg-primary px-6 py-2 font-medium text-primary-foreground hover:bg-primary/90"
            >
              Go to Projects
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-8">
        {/* Feature #554: Standardized PageHeader with breadcrumbs */}
        <PageHeader
          title={suite?.name || 'Test Suite'}
          description={suite?.description}
          breadcrumbs={[
            { label: 'Projects', href: '/projects' },
            { label: project?.name || 'Project', href: `/projects/${project?.id}` },
            { label: suite?.name || 'Suite' },
          ]}
          actions={
            <SuiteHeaderActions
              suiteId={suiteId!}
              testsCount={tests.length}
              isRunningSuite={isRunningSuite}
              canCreateTest={canCreateTest}
              canDeleteSuite={canDeleteSuite}
              onRunSuite={handleRunSuite}
              onExportTests={handleExportTests}
              onShowImportModal={() => setShowImportModal(true)}
              onShowRecordModal={() => recording.setShowRecordModal(true)}
              onShowCreateTestModal={() => setShowNewCreateTestModal(true)}
              onShowDeleteSuiteModal={() => setShowDeleteSuiteModal(true)}
              hasCompletedRun={!!(suiteRun && (suiteRun.status === 'passed' || suiteRun.status === 'failed') && suiteRun.results)}
              onExportRunJSON={handleExportRunJSON}
              onExportRunPDF={handleExportRunPDF}
            />
          }
        />
        {/* Browser settings badges */}
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          <span className="inline-flex items-center gap-1 rounded-md bg-primary/15 px-2 py-1 text-primary border border-primary/20">
            🌐 {suite?.browser === 'firefox' ? 'Firefox' : suite?.browser === 'webkit' ? 'WebKit (Safari)' : 'Chromium'}
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-muted-foreground">
            📐 {suite?.viewport_width || 1280}×{suite?.viewport_height || 720}
          </span>
        </div>

        {/* Feature #548: Suite Health Score with weighted breakdown */}
        {tests.length > 0 && (() => {
          const health = computeSuiteHealthScore(tests);
          const testsWithResults = tests.filter(t => t.last_result);
          if (testsWithResults.length === 0) return null;
          return (
            <div className="flex flex-col sm:flex-row gap-4 items-stretch">
              {/* Prominent overall health score */}
              <div className="flex-shrink-0">
                <ScoreCard score={health.overall} label="Suite Health" size="lg" showIcon thresholds={{ good: 80, warning: 60 }} />
              </div>
              {/* Category breakdown grid */}
              <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-3">
                <ScoreCard score={health.passRate} label="Pass Rate (40%)" size="sm" thresholds={{ good: 80, warning: 60 }} />
                <ScoreCard score={health.durationStability} label="Duration Stability (20%)" size="sm" thresholds={{ good: 70, warning: 50 }} />
                <ScoreCard score={health.flakiness} label="Flakiness (20%)" size="sm" thresholds={{ good: 80, warning: 60 }} />
                <ScoreCard score={health.recency} label="Recency (20%)" size="sm" thresholds={{ good: 70, warning: 40 }} />
              </div>
            </div>
          );
        })()}

        {/* Feature #580: AI Health Monitoring - Proactive insights panel */}
        {tests.length > 0 && (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <button
              onClick={() => {
                if (!showHealthInsights && !aiHealthReport && !isLoadingHealthCheck) {
                  handleAIHealthCheck();
                } else {
                  aiHealth.toggleInsights();
                }
              }}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10">
                  <Sparkles className="h-4 w-4 text-accent" />
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-semibold text-foreground">AI Health Insights</h3>
                  <p className="text-xs text-muted-foreground">
                    {aiHealthReport
                      ? `Score: ${aiHealthReport.health_score} · ${aiHealthReport.recommendations.length} recommendation${aiHealthReport.recommendations.length !== 1 ? 's' : ''}`
                      : 'Click to analyze suite health'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isLoadingHealthCheck && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                {aiHealthReport && (
                  <span className={`text-sm font-bold ${
                    aiHealthReport.health_score >= 80 ? 'text-success' :
                    aiHealthReport.health_score >= 60 ? 'text-warning' :
                    'text-destructive'
                  }`}>
                    {aiHealthReport.health_score}
                  </span>
                )}
                {showHealthInsights ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </button>

            {showHealthInsights && aiHealthReport && (
              <div className="px-4 pb-4 border-t border-border pt-4 space-y-4">
                {/* AI Summary + Trend */}
                <div className="flex items-start gap-3 p-3 rounded-md bg-muted/50">
                  <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                    {aiHealthReport.trend === 'improving' && <TrendingUp className="h-4 w-4 text-success" />}
                    {aiHealthReport.trend === 'degrading' && <TrendingDown className="h-4 w-4 text-destructive" />}
                    {aiHealthReport.trend === 'stable' && <Minus className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div>
                    <p className="text-sm text-foreground">{aiHealthReport.ai_summary}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Generated {new Date(aiHealthReport.generated_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Recommendations */}
                <div className="space-y-2">
                  {aiHealthReport.recommendations.map((rec) => (
                    <div
                      key={rec.id}
                      className={`rounded-md p-3 border ${
                        rec.severity === 'critical'
                          ? 'bg-destructive/5 border-destructive/20'
                          : rec.severity === 'warning'
                          ? 'bg-warning/5 border-warning/20'
                          : 'bg-muted/30 border-border'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {rec.severity === 'critical' && <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />}
                        {rec.severity === 'warning' && <AlertCircle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />}
                        {rec.severity === 'info' && <Info className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{rec.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{rec.description}</p>
                          <p className="text-xs text-accent mt-1">
                            <span className="font-medium">Action:</span> {rec.suggested_action}
                          </p>
                          {rec.affected_tests && rec.affected_tests.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {rec.affected_tests.map((test, idx) => (
                                <span key={idx} className="px-1.5 py-0.5 text-xs bg-muted rounded text-muted-foreground">
                                  {test}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Refresh button */}
                <div className="flex justify-end">
                  <button
                    onClick={handleAIHealthCheck}
                    disabled={isLoadingHealthCheck}
                    className="px-3 py-1.5 text-xs bg-muted text-muted-foreground rounded-md
                      hover:bg-muted/80 transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    {isLoadingHealthCheck ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    Refresh Analysis
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Feature #1151: Human Review Panel - Feature #50: Extracted to component */}
        <HumanReviewPanel
          tests={tests}
          requireHumanReview={requireHumanReview}
          showReviewPanel={showReviewPanel}
          reviewStats={reviewStats}
          selectedForReview={selectedForReview}
          isApproving={isApproving}
          onToggleHumanReview={handleToggleHumanReview}
          onToggleReviewPanel={reviewState.toggleReviewPanel}
          onToggleTestSelection={toggleTestSelection}
          onToggleAllTestsSelection={toggleAllTestsSelection}
          onReviewTest={handleReviewTest}
          onBatchReview={handleBatchReview}
        />

        {/* Delete Suite Confirmation Modal - Feature #50: Extracted to component */}
        {showDeleteSuiteModal && (
          <DeleteSuiteModal
            suiteName={suite?.name || ''}
            isDeleting={isDeletingSuite}
            onConfirm={handleDeleteSuite}
            onCancel={() => setShowDeleteSuiteModal(false)}
          />
        )}

        {/* Feature #1961: Delete Test Confirmation Modal - Feature #50: Extracted to component */}
        {showDeleteTestModal && (
          <DeleteTestModal
            isDeleting={isDeletingTest}
            onConfirm={() => handleDeleteTest(showDeleteTestModal)}
            onCancel={() => setShowDeleteTestModal(null)}
          />
        )}

        {/* Feature #595: Full Edit Test Modal */}
        {editingTest && (
          <FullEditTestModal
            test={editingTest}
            onClose={() => setEditingTest(null)}
            onSaved={() => {
              setEditingTest(null);
              invalidateBySuite(suiteId || '');
            }}
            suiteId={suiteId}
          />
        )}

        {/* Import Tests Modal - Feature #50: Extracted to component */}
        {showImportModal && (
          <ImportTestsModal
            importError={importError}
            isImporting={isImporting}
            onImport={handleImportTests}
            onClose={() => {
              setShowImportModal(false);
              setImportError('');
            }}
          />
        )}

        {/* Suite Run Results - Feature #50: Extracted to SuiteRunResults component */}
        {/* Feature #547: Added perTestStatus and currentStep for WaveProgressCard grid */}
        <SuiteRunResults
          suiteRun={suiteRun}
          suite={suite}
          tests={tests}
          isCancellingSuite={isCancellingSuite}
          liveScreenshot={liveScreenshot}
          screenshotHistory={screenshotHistory}
          perTestStatus={perTestStatus}
          currentStep={currentStep}
          onCancelSuiteRun={handleCancelSuiteRun}
          onExpandScreenshot={(base64) => setExpandedScreenshot(base64)}
          onEditSelector={(state) => selectorEdit.openSelectorModal(state)}
          onNavigate={navigate}
        />

        {/* Tests List - Feature #50: Extracted to TestListSection component */}
        <TestListSection
          tests={tests}
          filteredTests={filteredTests}
          sortedTests={sortedTests}
          searchQuery={searchQuery}
          sortField={sortField}
          sortDirection={sortDirection}
          suiteRun={suiteRun}
          openActionsDropdown={openActionsDropdown}
          runningTestId={runningTestId}
          canCreateTest={canCreateTest}
          onSearchChange={setSearchQuery}
          onSort={handleSort}
          onOpenCreateTestModal={() => setShowNewCreateTestModal(true)}
          onSetActionsDropdown={setOpenActionsDropdown}
          onRunSingleTest={handleRunSingleTest}
          onDuplicateTest={handleDuplicateTest}
          onShowTemplateModal={(testId) => {
            setInsertTemplateForTest(testId);
            setShowTemplateModal(true);
          }}
          onShowDeleteTestModal={setShowDeleteTestModal}
          loadStepTemplates={loadStepTemplates}
          onEditTest={(test) => setEditingTest(test)}
        />

        {/* Feature #59: Pagination controls for tests */}
        {pagination && pagination.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-card p-4">
            <div className="text-sm text-muted-foreground">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, pagination.total)} of {pagination.total} tests
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Per page:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="rounded border border-input bg-background px-2 py-1 text-sm"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={!pagination.hasPrev}
                  className="rounded px-2 py-1 text-sm hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  title="First page"
                >
                  ««
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={!pagination.hasPrev}
                  className="rounded px-2 py-1 text-sm hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Previous page"
                >
                  «
                </button>
                <span className="px-3 text-sm">
                  {currentPage} / {pagination.totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={!pagination.hasNext}
                  className="rounded px-2 py-1 text-sm hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Next page"
                >
                  »
                </button>
                <button
                  onClick={() => setCurrentPage(pagination.totalPages)}
                  disabled={!pagination.hasNext}
                  className="rounded px-2 py-1 text-sm hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Last page"
                >
                  »»
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Feature #553: Inline run history with pass rate trend chart */}
        {(() => {
          const suiteRuns = suiteRunsData?.runs || suiteRunsData?.data || [];
          // Only show if there are completed runs
          const completedRuns = suiteRuns
            .filter((r: { status: string }) => r.status === 'passed' || r.status === 'failed' || r.status === 'error')
            .slice(0, 10);

          if (completedRuns.length === 0) return null;

          // Feature #556: Prepare chart data for ScoreTrendChart (oldest first)
          const chartRuns = [...completedRuns].reverse();
          const chartData = chartRuns.map((r: { passed_count?: number; results_count?: number; created_at: string }) => {
            const total = r.results_count || 1;
            const passed = r.passed_count || 0;
            const passRate = Math.round((passed / total) * 100);
            return {
              label: new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              value: passRate,
            };
          });

          return (
            <div className="mt-6 rounded-lg border border-border bg-card">
              <button
                onClick={() => setShowRecentRuns(!showRecentRuns)}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-muted/50 rounded-lg transition-colors"
              >
                <span className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Recent Runs ({completedRuns.length})
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-muted-foreground transition-transform ${showRecentRuns ? 'rotate-180' : ''}`}
                />
              </button>

              {showRecentRuns && (
                <div className="px-4 pb-4 space-y-4">
                  {/* Feature #556: Pass Rate Trend Chart - uses ScoreTrendChart */}
                  {chartData.length >= 3 && (
                    <ScoreTrendChart
                      data={chartData}
                      title="Pass Rate Trend"
                      thresholds={{ good: 90, warning: 70 }}
                      valueLabel="Pass Rate"
                      showPercent
                      legend={[
                        { label: '≥90% Good', colorClass: 'bg-success' },
                        { label: '70-89% Fair', colorClass: 'bg-warning' },
                        { label: '<70% Poor', colorClass: 'bg-destructive' },
                      ]}
                    />
                  )}

                  {/* Compact Run Rows */}
                  <div className="space-y-1">
                    {completedRuns.map((run: { id: string; status: string; created_at: string; duration_ms?: number; passed_count?: number; results_count?: number }) => (
                      <button
                        key={run.id}
                        onClick={() => navigate(`/runs/${run.id}`)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-muted/50 transition-colors text-left"
                      >
                        {/* Status dot */}
                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                          run.status === 'passed' ? 'bg-success' :
                          run.status === 'failed' ? 'bg-destructive' :
                          'bg-warning'
                        }`} />
                        {/* Date */}
                        <span className="text-muted-foreground w-28 flex-shrink-0">
                          {new Date(run.created_at).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                        {/* Duration */}
                        <span className="text-muted-foreground w-16 flex-shrink-0">
                          {run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : '-'}
                        </span>
                        {/* Pass count */}
                        <span className="text-foreground flex-1">
                          {run.passed_count || 0}/{run.results_count || 0} passed
                        </span>
                        {/* Arrow */}
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Feature #1800: New two-section Create Test Modal */}
        {/* Feature #673: Lazy-loaded for better initial page performance */}
        {showNewCreateTestModal && (
          <Suspense fallback={<div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
            <CreateTestModal
              isOpen={showNewCreateTestModal}
              onClose={() => setShowNewCreateTestModal(false)}
              onTestCreated={async (test) => {
                // Feature #59: Use React Query invalidation to refresh tests
                invalidateBySuite(suiteId || '');
                // Feature #1985: Handle Create & Run flow
                if (test.runId) {
                  // Navigate to run details page after Create & Run
                  toast.success(`Test "${test.name}" created and running!`);
                  navigate(`/runs/${test.runId}`);
                } else {
                  toast.success(`Test "${test.name}" created successfully!`);
                }
              }}
              suiteId={suiteId || ''}
              project={project ? {
                id: project.id,
                name: project.name,
                baseUrl: project.base_url,
              } : undefined}
              suite={suite ? {
                id: suite.id,
                name: suite.name,
                projectId: suite.project_id,
              } : undefined}
              token={token || undefined}
            />
          </Suspense>
        )}


        {/* Legacy Create Test Modal removed - Feature #1816 */}

        {/* Feature #1342: Generated Test Code Preview Modal - Extracted to component */}
        <GeneratedTestPreviewModal
          isOpen={showGeneratedCodeModal}
          onClose={() => setShowGeneratedCodeModal(false)}
          preview={generatedTestPreview!}
          generatedCode={generatedTestCode}
          previousCode={previousGeneratedCode}
          showDiffView={showDiffView}
          regenerationFeedback={regenerationFeedback}
          isRegenerating={isRegenerating}
          aiTestDescription={aiTestDescription}
          newTestTargetUrl=""
          suiteId={suiteId || ''}
          token={token || ''}
          onSetGeneratedCode={setGeneratedTestCode}
          onSetPreview={setGeneratedTestPreview}
          onSetPreviousCode={setPreviousGeneratedCode}
          onSetShowDiffView={setShowDiffView}
          onSetRegenerationFeedback={setRegenerationFeedback}
          onSetIsRegenerating={setIsRegenerating}
          onUseTest={() => {
            // Close the preview modal and open the new CreateTestModal
            setShowGeneratedCodeModal(false);
            setShowAITestGenerator(false);
            setGeneratedTestCode('');
            setGeneratedTestPreview(null);
            setAITestDescription('');
            setPreviousGeneratedCode(null);
            setShowDiffView(false);
            setRegenerationFeedback('');
            // Feature #1816: Open new two-section CreateTestModal for manual completion
            setShowNewCreateTestModal(true);
          }}
        />

        {/* Record New Test Modal - Feature #26, #50: Uses useRecordingState hook */}
        <RecordTestModal
          isOpen={recording.showRecordModal}
          isRecording={recording.isRecording}
          onClose={() => recording.setShowRecordModal(false)}
          recordTargetUrl={recording.recordTargetUrl}
          onRecordTargetUrlChange={recording.setRecordTargetUrl}
          recordedSteps={recording.recordedSteps}
          onRecordedStepsChange={recording.setRecordedSteps}
          recordingDeviceEnabled={recording.recordingDeviceEnabled}
          onRecordingDeviceEnabledChange={recording.setRecordingDeviceEnabled}
          recordingDeviceConfig={recording.recordingDeviceConfig}
          onRecordingDeviceConfigChange={recording.setRecordingDeviceConfig}
          recordingSessionId={recording.recordingSessionId}
          onRecordingSessionIdChange={() => {}}
          recordingElapsed={recording.recordingElapsed}
          recordingFrame={recording.recordingFrame}
          onRecordingFrameChange={() => {}}
          recordingConnected={recording.recordingConnected}
          onRecordingConnectedChange={() => {}}
          recordingCurrentUrl={recording.recordingCurrentUrl}
          onRecordingCurrentUrlChange={recording.setRecordingCurrentUrl}
          reconnectAttempt={recording.reconnectAttempt}
          onReconnectAttemptChange={() => {}}
          reconnectFailed={recording.reconnectFailed}
          onReconnectFailedChange={() => {}}
          staleFrameWarning={recording.staleFrameWarning}
          onStaleFrameWarningChange={() => {}}
          showDebugOverlay={recording.showDebugOverlay}
          onShowDebugOverlayChange={recording.setShowDebugOverlay}
          clickRipple={recording.clickRipple}
          onClickRippleChange={recording.setClickRipple}
          recordingSocketRef={recording.recordingSocketRef}
          browserViewRef={recording.browserViewRef}
          browserImgRef={recording.browserImgRef}
          frameScaleRef={recording.frameScaleRef}
          lastFrameTimeRef={recording.lastFrameTimeRef}
          staleFrameTimerRef={recording.staleFrameTimerRef}
          frameRequestRef={recording.frameRequestRef}
          pendingFrameRef={recording.pendingFrameRef}
          onStartRecording={recording.handleStartRecording}
          onStopRecording={recording.handleStopRecording}
          onCancelRecording={recording.handleCancelRecording}
          onRetryConnection={recording.handleRetryConnection}
          onStopAndSave={recording.handleStopAndSave}
          projectBaseUrl={project?.base_url}
          token={token || ''}
          formatElapsed={recording.formatElapsed}
          getActionIcon={recording.getActionIcon}
        />

        {/* Review Recorded Test Modal - Feature #31, #37, #50: Uses useRecordingState hook */}
        <ReviewRecordedTestModal
          isOpen={recording.showReviewModal}
          onClose={() => recording.setShowReviewModal(false)}
          recordedSteps={recording.recordedSteps}
          onRecordedStepsChange={recording.setRecordedSteps}
          recordingDuration={recording.recordingDuration}
          recordedTestName={recording.recordedTestName}
          onRecordedTestNameChange={recording.setRecordedTestName}
          recordedTestDescription={recording.recordedTestDescription}
          onRecordedTestDescriptionChange={recording.setRecordedTestDescription}
          isSavingRecordedTest={recording.isSavingRecordedTest}
          onSaveRecordedTest={recording.handleSaveRecordedTest}
          templateName={recording.templateName}
          onTemplateNameChange={recording.setTemplateName}
          isSavingTemplate={recording.isSavingTemplate}
          onSaveAsTemplate={recording.handleSaveAsTemplate}
          formatElapsed={recording.formatElapsed}
          getActionIcon={recording.getActionIcon}
        />

        {/* Feature #31: Insert Template Modal - Feature #50: Extracted to component */}
        {/* Feature #31: Insert Template Modal - Feature #50: Extracted to component */}
        <InsertTemplateModal
          isOpen={showTemplateModal}
          testId={insertTemplateForTest}
          templates={stepTemplates}
          onClose={() => {
            setShowTemplateModal(false);
            setInsertTemplateForTest(null);
          }}
          onInsertTemplate={handleInsertTemplate}
          onDeleteTemplate={handleDeleteTemplate}
        />

        {/* Feature #1065: Edit Selector Modal - Feature #50: Extracted to component */}
        <EditSelectorModal
          modalState={editSelectorModal}
          selectorValue={editSelectorValue}
          selectorNotes={editSelectorNotes}
          applyToTest={editSelectorApplyToTest}
          isSubmitting={isSubmittingSelector}
          onSelectorValueChange={setEditSelectorValue}
          onNotesChange={setEditSelectorNotes}
          onApplyToTestChange={setEditSelectorApplyToTest}
          onClose={closeSelectorModal}
          onUpdateSelector={handleUpdateSelector}
          onAcceptHealed={handleAcceptHealed}
        />

        {/* Feature #35: Expanded Screenshot Modal - Feature #50: Extracted to component */}
        <ExpandedScreenshotModal
          screenshotBase64={expandedScreenshot}
          onClose={() => setExpandedScreenshot(null)}
        />
      </div>
    </Layout>
  );
}

export { TestSuitePage };
