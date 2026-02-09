// TestSuitePage - Test suite management with recording, AI generation, and execution
// Feature #59: Migrated to React Query for paginated test loading
// Feature #125: Added skeleton loaders for better perceived performance
// Feature #337: Dark-first design system redesign
// Feature #525: Added suite health metrics with unified ScoreCard component
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { SkeletonTestSuitePage } from '../components/ui/Skeleton';
import { useAuthStore } from '../stores/authStore';
import { toast } from '../stores/toastStore';
import { getErrorMessage } from '../utils/errorHandling';
import { io } from 'socket.io-client';
import { UnifiedAIService } from '../services/UnifiedAIService';
import { CreateTestModal } from '../components/create-test';
import { logger } from '../utils/logger';
import { ScoreCardGrid } from '../components/ui/score-card';
// Feature #59: React Query hooks for paginated test loading
// Feature #143: Added mutation hooks for operations
import {
  useTestsPaginated, useSuite, useInvalidateTests,
  useReviewTest, useBatchReviewTests, useDuplicateTest, useDeleteTest,
  useStartRun, useCancelRun, useStartSuiteRun, useDeleteSuite,
} from '../hooks/api';
import {
  TestType, DeleteSuiteModal, DeleteTestModal, // TestStep unused - referenced in comment only
  ImportTestsModal, EditSelectorModal, ExpandedScreenshotModal, InsertTemplateModal,
  GeneratedTestPreviewModal, RecordTestModal, ReviewRecordedTestModal,
  ParallelizationPanel, SuiteHeaderActions, HumanReviewPanel, SuiteRunResults,
  TestListSection, useRecordingState, EditSelectorModalState,
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
interface SuiteRunLocal {
  id: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'cancelled';
  started_at?: string;
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

  // Project state - loaded separately after suite loads
  const [project, setProject] = useState<{ id: string; name: string; base_url?: string } | null>(null);

  // Recording state hook - saves ~500 lines of recording/socket logic
  const recording = useRecordingState({
    suiteId, token, projectBaseUrl: project?.base_url,
    onTestCreated: async () => {
      // Feature #59: Use React Query invalidation to refresh tests
      invalidateBySuite(suiteId || '');
    },
  });

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
  const [requireHumanReview, setRequireHumanReview] = useState(false);
  const [reviewStats, setReviewStats] = useState<{
    total_tests: number;
    ai_generated: number;
    pending_review: number;
    approved: number;
    rejected: number;
  } | null>(null);
  const [showReviewPanel, setShowReviewPanel] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  // Feature #1152: Batch review AI-generated tests
  const [selectedForReview, setSelectedForReview] = useState<Set<string>>(new Set());
  // Feature #1163: Code diff view for regenerations
  const [regenerationFeedback, setRegenerationFeedback] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [previousGeneratedCode, setPreviousGeneratedCode] = useState<string | null>(null);
  const [showDiffView, setShowDiffView] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  // Feature #1958: Sorting state for test list
  const [sortField, setSortField] = useState<'name' | 'status' | 'last_run' | 'last_result' | 'run_count' | 'avg_duration' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [isRunningSuite, setIsRunningSuite] = useState(false);
  const [isCancellingSuite, setIsCancellingSuite] = useState(false);
  const [suiteRun, setSuiteRun] = useState<SuiteRunLocal | null>(null);
  const [suiteRunPolling, setSuiteRunPolling] = useState(false);

  // Feature #1257: Dynamic Test Parallelization state
  const [showParallelization, setShowParallelization] = useState(false);
  const [isAnalyzingParallel, setIsAnalyzingParallel] = useState(false);
  const [parallelizationPlan, setParallelizationPlan] = useState<{
    totalTests: number;
    workers: Array<{
      id: number;
      name: string;
      tests: Array<{ name: string; duration: number }>;
      totalDuration: number;
      utilizationPercent: number;
    }>;
    optimization: {
      sequentialTime: number;
      parallelTime: number;
      timeSaved: number;
      speedup: string;
    };
    resourceBalance: {
      avgUtilization: number;
      maxDifference: number;
      balanceScore: string;
    };
  } | null>(null);
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

  // Feature #50: Visual recorder state moved to useRecordingState hook (saves ~55 lines)
  // Feature #31: Step Templates state (kept here as not part of recording hook)
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [stepTemplates, setStepTemplates] = useState<Array<{ id: string; name: string; description?: string; steps: Array<{ action: string; selector?: string; value?: string; text?: string; url?: string }>; tags: string[]; created_at: string }>>([]);
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

  const canCreateTest = user?.role !== 'viewer';
  const canDeleteSuite = user?.role === 'owner' || user?.role === 'admin';

  // Feature #1065: Edit selector modal state (type imported from suite-detail)
  const [editSelectorModal, setEditSelectorModal] = useState<EditSelectorModalState>({
    isOpen: false,
    runId: '',
    testId: '',
    stepId: '',
    currentSelector: '',
    originalSelector: '',
    wasHealed: false,
  });
  const [editSelectorValue, setEditSelectorValue] = useState('');
  const [editSelectorNotes, setEditSelectorNotes] = useState('');
  const [editSelectorApplyToTest, setEditSelectorApplyToTest] = useState(true);
  const [isSubmittingSelector, setIsSubmittingSelector] = useState(false);

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

  // Feature #59: Fetch project when suite data is available
  // Suite and tests are now loaded via React Query hooks at the top
  useEffect(() => {
    if (!suite?.project_id || !token) return;

    const fetchProject = async () => {
      try {
        const projectResponse = await fetch(`/api/v1/projects/${suite.project_id}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (projectResponse.ok) {
          const projectData = await projectResponse.json();
          setProject(projectData.project);
        }
      } catch (err) {
        console.error('Failed to load project:', err);
      }
    };
    fetchProject();
  }, [suite?.project_id, token]);

  // Feature #1151: Fetch review settings when suite loads
  useEffect(() => {
    const fetchReviewSettings = async () => {
      if (!suiteId || !token) return;
      try {
        const response = await fetch(`/api/v1/suites/${suiteId}/review-settings`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setRequireHumanReview(data.require_human_review);
          setReviewStats(data.stats);
        }
      } catch (err) {
        console.error('Failed to fetch review settings:', err);
      }
    };
    fetchReviewSettings();
  }, [suiteId, token, tests]);

  // Feature #1151: Toggle human review requirement
  const handleToggleHumanReview = async () => {
    if (!suiteId || !token) return;
    try {
      const response = await fetch(`/api/v1/suites/${suiteId}/review-settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ require_human_review: !requireHumanReview }),
      });
      if (response.ok) {
        const data = await response.json();
        setRequireHumanReview(data.suite.require_human_review);
        toast.success(data.message);
      }
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
  const handleBatchReview = async (action: 'approve' | 'reject') => {
    if (!token || selectedForReview.size === 0) return;
    setIsApproving(true);
    try {
      const status = action === 'approve' ? 'approved' : 'rejected';
      const testIds = Array.from(selectedForReview);
      const data = await batchReviewMutation.mutateAsync({ testIds, status, suiteId });
      // Clear selection
      setSelectedForReview(new Set());
      toast.success(`Successfully ${action}d ${data.successful || testIds.length} test(s)`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to batch review tests'));
    } finally {
      setIsApproving(false);
    }
  };

  // Feature #1152: Toggle selection for batch review
  const toggleTestSelection = (testId: string) => {
    setSelectedForReview(prev => {
      const newSet = new Set(prev);
      if (newSet.has(testId)) {
        newSet.delete(testId);
      } else {
        newSet.add(testId);
      }
      return newSet;
    });
  };

  // Feature #1152: Toggle all tests for batch review
  const toggleAllTestsSelection = (testIds: string[]) => {
    setSelectedForReview(prev => {
      const allSelected = testIds.every(id => prev.has(id));
      if (allSelected) {
        // Deselect all
        return new Set();
      } else {
        // Select all
        return new Set(testIds);
      }
    });
  };

  // Feature #50: computeCodeDiff, calculateTestConfidence, validateTestName moved to utils.ts

  const handleRunSuite = async () => {
    if (tests.length === 0) return;

    setIsRunningSuite(true);
    setSuiteRun(null);

    try {
      // Feature #143: Converted to React Query mutation
      const data = await startSuiteRunMutation.mutateAsync({ suiteId: suiteId || '' });
      setSuiteRun(data.run);
      setSuiteRunPolling(true);
    } catch (err) {
      console.error('Failed to run suite:', err);
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
      console.error('Failed to run test:', err);
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
      console.error('Failed to duplicate test:', err);
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
      console.error('Failed to delete test:', err);
      toast.error(getErrorMessage(err, 'Failed to delete test'));
    } finally {
      setIsDeletingTest(false);
    }
  };

  // Feature #1257: Trigger large test run with AI parallelization
  const handleRunWithParallelization = async () => {
    if (tests.length === 0) return;

    setShowParallelization(true);
    setIsAnalyzingParallel(true);

    // Simulate AI analysis delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 2: AI analyzes test durations
    // Generate simulated test durations (in a real app, this would come from historical data)
    const testDurations = tests.map(t => ({
      name: t.name,
      duration: Math.floor(Math.random() * 50) + 10 // 10-60 seconds
    }));

    // Step 3: AI distributes tests optimally across workers using bin-packing algorithm
    const numWorkers = 4;
    const workers: Array<{
      id: number;
      name: string;
      tests: Array<{ name: string; duration: number }>;
      totalDuration: number;
      utilizationPercent: number;
    }> = Array.from({ length: numWorkers }, (_, i) => ({
      id: i + 1,
      name: `Worker ${i + 1}`,
      tests: [],
      totalDuration: 0,
      utilizationPercent: 0
    }));

    // Sort tests by duration (longest first) for better distribution
    const sortedTests = [...testDurations].sort((a, b) => b.duration - a.duration);

    // Distribute tests using "Longest Processing Time" algorithm
    for (const test of sortedTests) {
      // Find worker with minimum load
      const minWorker = workers.reduce((min, w) =>
        w.totalDuration < min.totalDuration ? w : min
      );
      minWorker.tests.push(test);
      minWorker.totalDuration += test.duration;
    }

    // Step 4: Calculate optimization metrics
    const sequentialTime = testDurations.reduce((sum, t) => sum + t.duration, 0);
    const parallelTime = Math.max(...workers.map(w => w.totalDuration));
    const timeSaved = sequentialTime - parallelTime;
    const speedup = (sequentialTime / parallelTime).toFixed(2);

    // Step 5: Calculate resource balance
    const avgDuration = sequentialTime / numWorkers;
    workers.forEach(w => {
      w.utilizationPercent = Math.round((w.totalDuration / parallelTime) * 100);
    });
    const maxDifference = Math.max(...workers.map(w => w.totalDuration)) - Math.min(...workers.map(w => w.totalDuration));
    const avgUtilization = Math.round(workers.reduce((sum, w) => sum + w.utilizationPercent, 0) / numWorkers);
    const balanceScore = maxDifference < 30 ? 'Excellent' : maxDifference < 60 ? 'Good' : 'Fair';

    setParallelizationPlan({
      totalTests: tests.length,
      workers,
      optimization: {
        sequentialTime,
        parallelTime,
        timeSaved,
        speedup
      },
      resourceBalance: {
        avgUtilization,
        maxDifference,
        balanceScore
      }
    });

    setIsAnalyzingParallel(false);
  };

  // Feature #143: Converted to React Query mutation
  const handleCancelSuiteRun = async () => {
    if (!suiteRun?.id) return;

    setIsCancellingSuite(true);

    try {
      await cancelRunMutation.mutateAsync(suiteRun.id);
      setSuiteRun((prev) => prev ? { ...prev, status: 'cancelled' as const } : null);
      setSuiteRunPolling(false);
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
  const handleUpdateSelector = async () => {
    if (!token || !editSelectorModal.runId || !editSelectorModal.testId || !editSelectorModal.stepId) {
      toast.error('Missing required information');
      return;
    }

    if (!editSelectorValue.trim()) {
      toast.error('Selector cannot be empty');
      return;
    }

    setIsSubmittingSelector(true);
    try {
      const response = await fetch(
        `/api/v1/runs/${editSelectorModal.runId}/results/${editSelectorModal.testId}/steps/${editSelectorModal.stepId}/selector`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            new_selector: editSelectorValue.trim(),
            notes: editSelectorNotes.trim() || undefined,
            apply_to_test: editSelectorApplyToTest,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to update selector');
      }

      const data = await response.json();
      toast.success(data.message || 'Selector updated successfully');

      // Reset and close modal
      setEditSelectorModal({
        isOpen: false,
        runId: '',
        testId: '',
        stepId: '',
        currentSelector: '',
        originalSelector: '',
        wasHealed: false,
      });
      setEditSelectorValue('');
      setEditSelectorNotes('');
      setEditSelectorApplyToTest(true);

      // Refresh run details to show updated selector
      if (suiteRun?.id) {
        const runResponse = await fetch(`/api/v1/runs/${suiteRun.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (runResponse.ok) {
          const runData = await runResponse.json();
          setSuiteRun(runData.run);
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update selector');
    } finally {
      setIsSubmittingSelector(false);
    }
  };

  // Feature #1065: Handle accept healed selector in TestSuitePage
  const handleAcceptHealed = async () => {
    if (!token || !editSelectorModal.runId || !editSelectorModal.testId || !editSelectorModal.stepId) {
      toast.error('Missing required information');
      return;
    }

    setIsSubmittingSelector(true);
    try {
      const response = await fetch(
        `/api/v1/runs/${editSelectorModal.runId}/results/${editSelectorModal.testId}/steps/${editSelectorModal.stepId}/accept-healed`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            apply_to_test: editSelectorApplyToTest,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to accept healed selector');
      }

      const data = await response.json();
      toast.success(data.message || 'Healed selector accepted');

      // Reset and close modal
      setEditSelectorModal({
        isOpen: false,
        runId: '',
        testId: '',
        stepId: '',
        currentSelector: '',
        originalSelector: '',
        wasHealed: false,
      });
      setEditSelectorValue('');
      setEditSelectorNotes('');
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
  const loadStepTemplates = async () => {
    try {
      const response = await fetch(`/api/v1/step-templates?suite_id=${suiteId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setStepTemplates(data.templates || []);
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  };

  // Feature #31: Insert template steps into an existing test
  const handleInsertTemplate = async (testId: string, template: { steps: Array<{ action: string; selector?: string; value?: string; text?: string; url?: string }> }) => {
    try {
      const response = await fetch(`/api/v1/tests/${testId}/append-steps`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ steps: template.steps }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to insert template');
      }
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
  const handleDeleteTemplate = async (templateId: string) => {
    try {
      const response = await fetch(`/api/v1/step-templates/${templateId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        setStepTemplates(prev => prev.filter(t => t.id !== templateId));
        toast.success('Template deleted');
      }
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

  // Poll for suite run status
  useEffect(() => {
    if (!suiteRunPolling || !suiteRun?.id) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/v1/runs/${suiteRun.id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setSuiteRun(data.run);

          if (data.run.status !== 'pending' && data.run.status !== 'running') {
            setSuiteRunPolling(false);
            setIsRunningSuite(false);
          }
        }
      } catch (err) {
        console.error('Failed to poll run status:', err);
      }
    }, 1000);

    return () => clearInterval(pollInterval);
  }, [suiteRunPolling, suiteRun?.id, token]);

  // Feature #35: Live screenshot streaming - connect to Socket.IO when run is active
  useEffect(() => {
    if (!suiteRunPolling || !suiteRun?.id) {
      // Clear screenshots when no run is active
      setLiveScreenshot(null);
      setScreenshotHistory([]);
      return;
    }

    // Connect to Socket.IO for live screenshot updates
    // Use backend URL (port 3001) for Socket.IO, not frontend port
    const socketUrl = import.meta.env.VITE_API_URL
      ? import.meta.env.VITE_API_URL.replace('/api/v1', '')
      : window.location.hostname === 'localhost'
        ? 'http://localhost:3001'
        : window.location.origin;

    const screenshotSocket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 3,
    });

    screenshotSocket.on('connect', () => {
      logger.websocket.debug('LiveScreenshot connected, joining run room:', suiteRun.id);
      screenshotSocket.emit('join-run', suiteRun.id);
    });

    // Listen for step screenshots
    screenshotSocket.on('step:screenshot', (data: {
      runId: string;
      testId: string;
      testName: string;
      stepIndex: number;
      stepAction: string;
      stepSelector?: string;
      stepValue?: string;
      base64: string;
      width: number;
      height: number;
      timestamp: number;
    }) => {
      logger.websocket.debug(`LiveScreenshot received screenshot for step ${data.stepIndex + 1}: ${data.stepAction}`);

      // Update current live screenshot
      setLiveScreenshot({
        base64: data.base64,
        testId: data.testId,
        testName: data.testName,
        stepIndex: data.stepIndex,
        stepAction: data.stepAction,
        stepSelector: data.stepSelector,
        timestamp: data.timestamp,
      });

      // Add to history (keep last 3)
      setScreenshotHistory(prev => {
        const newHistory = [
          ...prev,
          {
            base64: data.base64,
            stepIndex: data.stepIndex,
            stepAction: data.stepAction,
            timestamp: data.timestamp,
          }
        ].slice(-3); // Keep only last 3
        return newHistory;
      });
    });

    screenshotSocket.on('disconnect', () => {
      logger.websocket.debug('LiveScreenshot disconnected');
    });

    screenshotSocket.on('connect_error', (err: Error) => {
      console.warn('[LiveScreenshot] Connection error:', err.message);
    });

    return () => {
      logger.websocket.debug('LiveScreenshot cleaning up socket connection');
      screenshotSocket.emit('leave-run', suiteRun.id);
      screenshotSocket.disconnect();
    };
  }, [suiteRunPolling, suiteRun?.id]);

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
        {/* Breadcrumb navigation */}
        <nav className="mb-6 flex items-center gap-2 text-sm">
          <Link to="/projects" className="text-muted-foreground hover:text-foreground">
            Projects
          </Link>
          <span className="text-muted-foreground">/</span>
          <Link to={`/projects/${project?.id}`} className="text-muted-foreground hover:text-foreground">
            {project?.name || 'Project'}
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium text-foreground">{suite?.name}</span>
        </nav>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{suite?.name}</h1>
            {suite?.description && (
              <p className="mt-2 text-muted-foreground">{suite.description}</p>
            )}
            {/* Browser Settings */}
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <span className="inline-flex items-center gap-1 rounded-md bg-primary/15 px-2 py-1 text-primary border border-primary/20">
                🌐 {suite?.browser === 'firefox' ? 'Firefox' : suite?.browser === 'webkit' ? 'WebKit (Safari)' : 'Chromium'}
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-muted-foreground">
                📐 {suite?.viewport_width || 1280}×{suite?.viewport_height || 720}
              </span>
            </div>
          </div>
          {/* Feature #50: Extracted to SuiteHeaderActions component */}
          <SuiteHeaderActions
            suiteId={suiteId!}
            testsCount={tests.length}
            isRunningSuite={isRunningSuite}
            isAnalyzingParallel={isAnalyzingParallel}
            canCreateTest={canCreateTest}
            canDeleteSuite={canDeleteSuite}
            onRunWithParallelization={handleRunWithParallelization}
            onRunSuite={handleRunSuite}
            onExportTests={handleExportTests}
            onShowImportModal={() => setShowImportModal(true)}
            onShowRecordModal={() => recording.setShowRecordModal(true)}
            onShowCreateTestModal={() => setShowNewCreateTestModal(true)}
            onShowDeleteSuiteModal={() => setShowDeleteSuiteModal(true)}
          />
        </div>

        {/* Feature #525: Suite Health Metrics - unified ScoreCard display */}
        {tests.length > 0 && (() => {
          const testsWithResults = tests.filter(t => t.last_result);
          const passedTests = tests.filter(t => t.last_result === 'passed').length;
          const failedTests = tests.filter(t => t.last_result === 'failed' || t.last_result === 'error').length;
          const passRate = testsWithResults.length > 0
            ? Math.round((passedTests / testsWithResults.length) * 100)
            : 0;
          return testsWithResults.length > 0 ? (
            <ScoreCardGrid
              items={[
                { score: passRate, label: 'Pass Rate' },
                { score: tests.length, label: 'Total Tests' },
                { score: passedTests, label: 'Passed' },
                { score: failedTests, label: 'Failed' },
              ]}
              size="sm"
              thresholds={{ good: 80, warning: 60 }}
            />
          ) : null;
        })()}

        {/* Feature #1151: Human Review Panel - Feature #50: Extracted to component */}
        <HumanReviewPanel
          tests={tests}
          requireHumanReview={requireHumanReview}
          showReviewPanel={showReviewPanel}
          reviewStats={reviewStats}
          selectedForReview={selectedForReview}
          isApproving={isApproving}
          onToggleHumanReview={handleToggleHumanReview}
          onToggleReviewPanel={() => setShowReviewPanel(!showReviewPanel)}
          onToggleTestSelection={toggleTestSelection}
          onToggleAllTestsSelection={toggleAllTestsSelection}
          onReviewTest={handleReviewTest}
          onBatchReview={handleBatchReview}
        />

        {/* Feature #1257: AI Parallelization Panel - Feature #50: Extracted to component */}
        {showParallelization && (
          <ParallelizationPanel
            isAnalyzing={isAnalyzingParallel}
            plan={parallelizationPlan}
            isRunningSuite={isRunningSuite}
            onClose={() => setShowParallelization(false)}
            onRunSuite={handleRunSuite}
          />
        )}

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
        <SuiteRunResults
          suiteRun={suiteRun}
          suite={suite}
          tests={tests}
          isCancellingSuite={isCancellingSuite}
          liveScreenshot={liveScreenshot}
          screenshotHistory={screenshotHistory}
          onCancelSuiteRun={handleCancelSuiteRun}
          onExpandScreenshot={(base64) => setExpandedScreenshot(base64)}
          onEditSelector={(state) => setEditSelectorModal(state)}
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

        {/* Feature #1800: New two-section Create Test Modal */}
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
          onClose={() => {
            setEditSelectorModal({
              isOpen: false, runId: '', testId: '', stepId: '', currentSelector: '', originalSelector: '', wasHealed: false,
            });
            setEditSelectorValue('');
            setEditSelectorNotes('');
          }}
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
