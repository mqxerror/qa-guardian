// TestSuitePage - Test suite management with recording, AI generation, and execution
// Feature #59: Migrated to React Query for paginated test loading
// Feature #125: Added skeleton loaders for better perceived performance
// Feature #337: Dark-first design system redesign
// Feature #525: Added suite health metrics with unified ScoreCard component
// Feature #546: Replaced HTTP polling with WebSocket live streaming via useSuiteRunSocket
import { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { SkeletonTestSuitePage } from '../components/ui/Skeleton';
import { useAuthStore } from '../stores/authStore';
import { toast } from '../stores/toastStore';
import { createLogger } from '../utils/logger';
import { UnifiedAIService } from '../services/UnifiedAIService';

const logger = createLogger('test-suite');
// Feature #673: Lazy-load CreateTestModal for better initial page load
const CreateTestModal = lazy(() => import('../components/create-test').then(m => ({ default: m.CreateTestModal })));
import { Button } from '../components/ui/button';
import { ScoreCard } from '../components/ui/score-card';
// Feature #580: Icons (AI health panel icons moved to AIHealthInsightsPanel; run history icons moved to RecentRunsSection)
import { AlertTriangle, Loader2 } from 'lucide-react';
// Feature #554: Standardized PageHeader with breadcrumbs
// Feature #556: ScoreTrendChart replaces inline recharts chart
import { PageHeader } from '../components/ui';
import { EmptyState, EmptyStateIcons } from '../components/ui/EmptyState';
// Feature #546: WebSocket-based suite run tracking (replaces HTTP polling + separate socket)
import { useSuiteRunSocket, type LiveScreenshot, type ScreenshotHistoryEntry, type SuiteRun as SuiteRunSocket } from '../hooks/useSuiteRunSocket';
// Feature #59: React Query hooks for paginated test loading
// Feature #143: Added mutation hooks for operations
// Feature #701: Added review settings, AI health check, step templates, and selector hooks
import {
  useTestsPaginated, useSuite, useInvalidateTests,
  useRunsBySuite,
  useProject,
  useReviewSettings,
  useStepTemplates,
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
  // Agent 7: Extracted sub-components
  AIHealthInsightsPanel, RecentRunsSection, PaginationControls,
  // Agent 7: Consolidated page-level handlers
  useSuitePageHandlers,
} from '../components/suite-detail';

import type { SuiteRunLocal } from '@/types/tests';

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

  // Feature #143: Mutation hooks moved to useSuitePageHandlers (Agent 7)

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

  // Feature #553: State for collapsible recent runs section - moved to RecentRunsSection

  // Feature #701: Project loaded via React Query instead of raw fetch
  const { data: projectData } = useProject(suite?.project_id);
  const project = projectData?.project || null;

  // Feature #701: Review settings via React Query
  const { data: reviewSettingsData } = useReviewSettings(suiteId);

  // Feature #701: Step templates via React Query
  const { data: stepTemplatesData, refetch: refetchStepTemplates } = useStepTemplates(suiteId);

  // Feature #701: Selector/template/health mutations moved to useSuitePageHandlers (Agent 7)

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
  const [, setShowAITestGenerator] = useState(false);
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
    showReviewPanel,
    isApproving,
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
  // aiHealth passed directly to AIHealthInsightsPanel - no destructuring needed

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
  const { perTestStatus, currentStep, completedTests, totalTests } = useSuiteRunSocket({
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
    isSubmittingSelector,
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

  // Agent 7: All mutation-based handlers consolidated into useSuitePageHandlers
  const handlers = useSuitePageHandlers({
    suiteId, suite, tests, suiteRun,
    setSuiteRun, setSuiteRunActive, setIsRunningSuite, setIsCancellingSuite,
    setRunningTestId, setIsDeletingSuite, setShowDeleteSuiteModal,
    setIsDeletingTest, setShowDeleteTestModal,
    setLiveScreenshot: () => setLiveScreenshot(null),
    setScreenshotHistory: () => setScreenshotHistory([]),
    setImportError, setIsImporting, setShowImportModal,
    setShowTemplateModal, setInsertTemplateForTest, fileInputRef,
    aiHealth, reviewState, selectorEdit,
    refetchStepTemplates,
  });
  const {
    handleToggleHumanReview, handleReviewTest, handleBatchReview,
    handleAIHealthCheck, handleRunSuite, handleRunSingleTest,
    handleDuplicateTest, handleDeleteTest, handleCancelSuiteRun,
    handleDeleteSuite, handleUpdateSelector, handleAcceptHealed,
    handleImportTests, handleInsertTemplate, handleDeleteTemplate,
    handleExportTests, handleExportRunJSON, handleExportRunPDF,
    loadStepTemplates,
  } = handlers;


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
          {suiteError && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-6 text-center">
              <AlertTriangle className="h-8 w-8 mx-auto text-destructive mb-2" />
              <h3 className="text-lg font-semibold text-destructive">Failed to load test suite</h3>
              <p className="text-sm text-muted-foreground mt-1">{suiteError instanceof Error ? suiteError.message : 'An unexpected error occurred'}</p>
            </div>
          )}
          {!suiteError && (
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground">Test Suite Not Found</h2>
              <p className="mt-2 text-muted-foreground">{error}</p>
            </div>
          )}
          <Button
            onClick={() => navigate('/projects')}
            className="mt-6"
          >
            Go to Projects
          </Button>
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

        {/* Feature #580: AI Health Monitoring - Extracted to AIHealthInsightsPanel */}
        {tests.length > 0 && (
          <AIHealthInsightsPanel aiHealth={aiHealth} onRunHealthCheck={handleAIHealthCheck} />
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
          wsCompletedTests={completedTests}
          wsTotalTests={totalTests}
          onCancelSuiteRun={handleCancelSuiteRun}
          onExpandScreenshot={(base64) => setExpandedScreenshot(base64)}
          onEditSelector={(state) => selectorEdit.openSelectorModal(state)}
          onNavigate={navigate}
        />

        {/* Tests List - Feature #50: Extracted to TestListSection component */}
        {tests.length === 0 && !testsLoading ? (
          <EmptyState
            icon={EmptyStateIcons.test}
            title="No tests in this suite"
            description="Create your first test using the test builder, recorder, or AI generator."
          />
        ) : (
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
        )}

        {/* Feature #59: Pagination controls - Extracted to PaginationControls */}
        {pagination && pagination.totalPages > 1 && (
          <PaginationControls
            pagination={pagination}
            currentPage={currentPage}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
            itemLabel="tests"
          />
        )}

        {/* Feature #553: Recent runs - Extracted to RecentRunsSection */}
        <RecentRunsSection suiteRunsData={suiteRunsData} />

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
