// TestDetailPage - Extracted from App.tsx
// Feature #1441: Split App.tsx into logical modules
// Feature #68: Added React Query caching for faster loading
// Feature #337: Dark-first design system redesign
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuthStore } from '../stores/authStore';
import { useTimezoneStore } from '../stores/timezoneStore';
import { useSocketStore } from '../stores/socketStore';
import { useNotificationStore } from '../stores/notificationStore';
import { toast } from '../stores/toastStore';
import { logger } from '../utils/logger';
// Feature #551: Health score and skeleton loading
import { ScoreCard } from '../components/ui/score-card';
import { SkeletonTestDetailPage } from '../components/ui/Skeleton';
import { computeTestHealthScore } from '../components/suite-detail/utils';
// Feature #337: Design system components - Feature #513: Removed unused imports
// AnimatedCard, StatusPill, MetadataRow, SectionHeader, CardContent, Tabs, TabsList, TabsTrigger, TabsContent, useReducedMotion - moved to test-detail components
// lucide-react icons: Play, Clock, Calendar, Tag - moved to test-detail components
// Feature #68: Import React Query hooks for caching
import { useTest, useInvalidateTests } from '../hooks/api/useTests';
import { useRunsByTest, useInvalidateRuns } from '../hooks/api/useRuns';
import { useSuite } from '../hooks/api/useSuites';
import { useProject } from '../hooks/api/useProjects';
// Feature #48: Import modular types and utilities
import {
  // Feature #513: Removed unused type imports - now used only in test-detail components
  // TestSuite, ConsoleLog, NetworkRequest, TestRunResult, StepResult, TestStatus,
  // RunStatus, ResultStatus, StepStatus, TestCategory - used in sub-components
  TestType,
  TestRunType,
  // Feature #48: Import extracted components
  DeleteTestModal,
  ApproveBaselineModal,
  RestoreBaselineModal,
  MergeBaselineModal,
  RejectChangesModal,
  FlakinessPanel,
  FlakinessTrend,
  ImageLightbox,
  K6CompareModal,
  K6CompareResults,
  RunHistorySection,
  EditTestModal,
  AddStepModal,
  AIExplainModal,
  UnsavedChangesConfirmModal,
  TestExplanation,
  QuickScheduleModal,
  ViewCodeTab,
  K6ScriptTab,
  TestDetailsCard,
  TestStepsTab,
  BaselineTab,
  TestHeader,
  CurrentRunStatusSection,
  TestAISummary,
  // Feature #48: Code generation utilities
  generatePlaywrightCode,
  generateK6Script,
  getK6Templates,
  highlightJavaScriptLine,
  isLineHidden,
  getFoldIcon,
  findSelectorAutocomplete,
  findValueAutocomplete,
  type FoldableRegion,
  type K6Template,
  // Feature #48: Custom hooks for state management
  useBaselineHandlers,
  useStepHandlers,
  useTestCrudHandlers,
  useRunHandlers,
  useBaselineDataFetching,
  useTestPageUtilities,
  // Feature #560: Consolidated modal state management
  useModalState,
} from '../components/test-detail';

function TestDetailPage() {
  const { testId } = useParams<{ testId: string }>();
  const { token, user } = useAuthStore();
  const { formatDate, formatDateTime } = useTimezoneStore();
  const { socket, connect, joinRun, leaveRun, joinOrg } = useSocketStore();
  const { addNotification } = useNotificationStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Feature #68: React Query hooks for caching - data loads instantly on second visit
  // Feature #513: Removed unused refetchTest, runsLoading
  const { data: testData, isLoading: testLoading, error: testError } = useTest(testId);
  const { data: runsData, refetch: refetchRuns } = useRunsByTest(testId);

  // Feature #137: Eliminated 3-level waterfall by using enriched test data
  // OLD: useTest(id) -> wait -> useSuite(suiteId) -> wait -> useProject(projectId)
  // NEW: Single useTest call returns suite_name, project_id, project_name via SQL JOIN
  const suiteId = testData?.test?.suite_id;
  const projectId = testData?.test?.project_id;

  // Keep useSuite/useProject for cache warming (prefetches data for suite/project pages)
  // but don't wait on them for rendering - use enriched test data instead
  const { data: suiteData } = useSuite(suiteId);
  const { data: projectData } = useProject(projectId);
  // Feature #513: Removed unused suiteLoading, projectLoading - no longer needed

  // Feature #68: Invalidation helpers for cache updates
  const { invalidateTest } = useInvalidateTests();
  const { invalidateAll: invalidateRuns } = useInvalidateRuns();

  // Local state derived from React Query data
  const [test, setTest] = useState<TestType | null>(null);
  // Feature #137: Simplified suite type - only need id/name for breadcrumb, not full TestSuite
  const [suite, setSuite] = useState<{ id: string; name: string } | null>(null);
  const [project, setProject] = useState<{ id: string; name: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Feature #560: Consolidated modal state management
  // 11 boolean visibility flags use a single useReducer; associated form/loading/error state
  // remains as individual useState within the hook. Both new API (modals.*, openModal, closeModal)
  // and legacy API (showDeleteModal, setShowDeleteModal, etc.) are available.
  const {
    modals, openModal, closeModal, closeAllModals,
    // Delete modal
    showDeleteModal, setShowDeleteModal,
    isDeleting, setIsDeleting,
    deleteError, setDeleteError,
    resetDeleteModal,
    // Edit modal
    showEditModal, setShowEditModal,
    editName, setEditName,
    editDescription, setEditDescription,
    isEditing, setIsEditing,
    editError, setEditError,
    resetEditModal,
    // Approve baseline
    showApproveBaselineModal, setShowApproveBaselineModal,
    approvingBaseline, setApprovingBaseline,
    approveBaselineRunId, setApproveBaselineRunId,
    approveBaselineError, setApproveBaselineError,
    // Reject changes
    showRejectChangesModal, setShowRejectChangesModal,
    rejectingChanges, setRejectingChanges,
    rejectChangesRunId, setRejectChangesRunId,
    rejectChangesError, setRejectChangesError,
    rejectionReason, setRejectionReason,
    // Restore baseline
    showRestoreBaselineModal, setShowRestoreBaselineModal,
    restoreHistoryEntry, setRestoreHistoryEntry,
    restoringBaseline, setRestoringBaseline,
    restoreBaselineError, setRestoreBaselineError,
    // Merge baseline
    showMergeBaselineModal, setShowMergeBaselineModal,
    selectedMergeBranch, setSelectedMergeBranch,
    isMergingBaseline, setIsMergingBaseline,
    mergeBaselineError, setMergeBaselineError,
    // Quick schedule
    showQuickScheduleModal, setShowQuickScheduleModal,
    isCreatingSchedule, setIsCreatingSchedule,
    quickScheduleError, setQuickScheduleError,
    // Add step
    showAddStepModal, setShowAddStepModal,
    // Explain
    showExplainModal, setShowExplainModal,
    testExplanation, setTestExplanation,
    isExplainingTest, setIsExplainingTest,
    // Unsaved changes
    showUnsavedChangesModal, setShowUnsavedChangesModal,
    pendingNavigation, setPendingNavigation,
    // Compare
    showCompareModal, setShowCompareModal,
    compareResults, setCompareResults,
    isComparing, setIsComparing,
  } = useModalState();

  const [isRunning, setIsRunning] = useState(false);
  const [isCancellingRun, setIsCancellingRun] = useState(false);
  const [runError, setRunError] = useState('');
  const [currentRun, setCurrentRun] = useState<TestRunType | null>(null);
  const [runs, setRuns] = useState<TestRunType[]>([]);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [duplicateError, setDuplicateError] = useState('');
  // Real-time progress state
  const [liveProgress, setLiveProgress] = useState<{
    totalTests: number;
    completedTests: number;
    currentTest?: string;
    currentStep?: { index: number; total: number; action: string };
    // K6 load test specific metrics
    k6Metrics?: {
      phase: string;
      progress: number;
      currentVUs?: number;
      totalRequests?: number;
      requestsPerSecond?: number;
      avgResponseTime?: number;
      errorRate?: number;
      // Response time percentiles
      p50ResponseTime?: number;
      p95ResponseTime?: number;
      p99ResponseTime?: number;
    };
  } | null>(null);
  const [liveScreenshot, setLiveScreenshot] = useState<string | null>(null);
  const [liveConsoleLogs, setLiveConsoleLogs] = useState<Array<{ level: string; message: string; timestamp: number }>>([]);

  // Read filter state from URL search params (persists across navigation)
  const statusFilter = (searchParams.get('status') as 'all' | 'passed' | 'failed' | 'running') || 'all';
  const dateFilter = (searchParams.get('date') as 'all' | 'today' | '7days' | '30days') || 'all';
  const runPage = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
  // Feature #560: showAddStepModal moved to useModalState
  const [isAddingStep, setIsAddingStep] = useState(false);
  const [addStepError, setAddStepError] = useState('');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [lightboxZoom, setLightboxZoom] = useState(1);
  const [lightboxPan, setLightboxPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Visual comparison view mode state
  const [comparisonViewMode, setComparisonViewMode] = useState<'side-by-side' | 'slider' | 'onion-skin' | 'diff' | 'diff-overlay'>('side-by-side');
  const [sliderPosition, setSliderPosition] = useState(50); // Percentage position 0-100 for slider
  const [onionSkinOpacity, setOnionSkinOpacity] = useState(50); // Percentage opacity 0-100 for onion skin
  const [diffOverlayOpacity, setDiffOverlayOpacity] = useState(50); // Percentage opacity 0-100 for diff overlay
  const [imageZoomLevel, setImageZoomLevel] = useState<'fit' | '100' | '50' | '200'>('fit'); // Zoom level for images

  // Feature #1101: Flakiness trend tracking state - Feature #48: Use imported type
  const [flakinessTrend, setFlakinessTrend] = useState<FlakinessTrend | null>(null);
  const [isLoadingFlakinessTrend, setIsLoadingFlakinessTrend] = useState(false);
  const [showFlakinessTrendSection, setShowFlakinessTrendSection] = useState(true);

  // Refs for synchronized scrolling in side-by-side view
  const baselineContainerRef = useRef<HTMLDivElement>(null);
  const currentContainerRef = useRef<HTMLDivElement>(null);
  const diffContainerRef = useRef<HTMLDivElement>(null);
  const isSyncScrolling = useRef(false);

  // Synchronized scroll handler for side-by-side view
  const handleSyncScroll = useCallback((source: 'baseline' | 'current' | 'diff') => {
    if (isSyncScrolling.current) return;
    isSyncScrolling.current = true;

    const sourceRef = source === 'baseline' ? baselineContainerRef : source === 'current' ? currentContainerRef : diffContainerRef;
    const sourceEl = sourceRef.current;
    if (!sourceEl) {
      isSyncScrolling.current = false;
      return;
    }

    const scrollTop = sourceEl.scrollTop;
    const scrollLeft = sourceEl.scrollLeft;

    // Sync all other containers
    [baselineContainerRef, currentContainerRef, diffContainerRef].forEach(ref => {
      if (ref !== sourceRef && ref.current) {
        ref.current.scrollTop = scrollTop;
        ref.current.scrollLeft = scrollLeft;
      }
    });

    // Use requestAnimationFrame to avoid scroll event loops
    requestAnimationFrame(() => {
      isSyncScrolling.current = false;
    });
  }, []);

  // Track dirty state for unsaved changes warning
  const [isDirty, setIsDirty] = useState(false);
  // Feature #560: showUnsavedChangesModal & pendingNavigation moved to useModalState
  const [isDownloadingArtifacts, setIsDownloadingArtifacts] = useState(false);

  // Drag and drop step reordering
  const [draggedStepIndex, setDraggedStepIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isSavingStepOrder, setIsSavingStepOrder] = useState(false);
  const [hasReorderedSteps, setHasReorderedSteps] = useState(false);

  // View Code tab state
  const [activeTab, setActiveTab] = useState<'steps' | 'code' | 'baseline' | 'k6script'>('steps');
  // K6 script editor state
  const [k6Script, setK6Script] = useState('');
  const [isEditingK6Script, setIsEditingK6Script] = useState(false);
  const [isSavingK6Script, setIsSavingK6Script] = useState(false);
  const [showK6Templates, setShowK6Templates] = useState(false);
  // K6 script code folding state
  const [foldedRegions, setFoldedRegions] = useState<Set<number>>(new Set());

  const toggleFold = useCallback((lineNumber: number) => {
    setFoldedRegions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(lineNumber)) {
        newSet.delete(lineNumber);
      } else {
        newSet.add(lineNumber);
      }
      return newSet;
    });
  }, []);

  const getFoldIconForLine = useCallback((lineNumber: number, regions: FoldableRegion[]) => {
    return getFoldIcon(lineNumber, regions, foldedRegions);
  }, [foldedRegions]);

  const isLineHiddenForLine = useCallback((lineNumber: number, regions: FoldableRegion[]) => {
    return isLineHidden(lineNumber, regions, foldedRegions);
  }, [foldedRegions]);
  const [baselineData, setBaselineData] = useState<{hasBaseline: boolean; image?: string; createdAt?: string; size?: number; approvedBy?: string; approvedByUserId?: string; approvedAt?: string; sourceRunId?: string} | null>(null);
  const [loadingBaseline, setLoadingBaseline] = useState(false);

  // Baseline approval state - Feature #560: moved to useModalState

  // Baseline history state
  const [baselineHistory, setBaselineHistory] = useState<Array<{
    id: string;
    testId: string;
    viewportId: string;
    version: number;
    approvedBy: string;
    approvedByUserId: string;
    approvedAt: string;
    sourceRunId?: string;
    filename: string;
  }>>([]);
  const [loadingBaselineHistory, setLoadingBaselineHistory] = useState(false);
  const [selectedHistoryVersion, setSelectedHistoryVersion] = useState<string | null>(null);
  const [historyVersionImage, setHistoryVersionImage] = useState<string | null>(null);
  const [loadingHistoryImage, setLoadingHistoryImage] = useState(false);
  // Feature #560: restoreBaseline, rejectChanges state moved to useModalState
  const [rejectionStatus, setRejectionStatus] = useState<{hasRejection: boolean; rejectedBy?: string; rejectedAt?: string; reason?: string} | null>(null);

  // Branch selection state for visual regression tests
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [availableBranches, setAvailableBranches] = useState<string[]>(['main']);
  const [loadingBranches, setLoadingBranches] = useState(false);

  // Baseline merge state (for merging baselines from feature branches)
  const [mergeableBranches, setMergeableBranches] = useState<Array<{
    branch: string;
    updatedAt: string;
    approvedBy?: string;
    isNewer: boolean;
    hasBaseline: boolean;
  }>>([]);
  const [loadingMergeableBranches, setLoadingMergeableBranches] = useState(false);
  // Feature #560: mergeBaseline, quickSchedule state moved to useModalState

  // Accessibility results filter state
  const [a11ySeverityFilter, setA11ySeverityFilter] = useState<{ [key: string]: 'all' | 'critical' | 'serious' | 'moderate' | 'minor' }>({});
  const [a11yCategoryFilter, setA11yCategoryFilter] = useState<{ [key: string]: 'all' | 'color' | 'images' | 'forms' | 'navigation' | 'structure' | 'aria' }>({});
  const [a11ySearchQuery, setA11ySearchQuery] = useState<{ [key: string]: string }>({});

  // Export accessibility report as PDF

  // Code editor state for advanced users
  const [isEditingCode, setIsEditingCode] = useState(false);
  const [editedCode, setEditedCode] = useState('');
  const [isSavingCode, setIsSavingCode] = useState(false);
  const [codeError, setCodeError] = useState('');

  // Feature #560: explain/testExplanation state moved to useModalState

  const generatePlaywrightCodeForTest = useCallback((steps: TestType['steps'] | undefined) => {
    return generatePlaywrightCode(steps || [], test?.name || 'Untitled Test');
  }, [test?.name]);

  const generateK6ScriptForTest = useCallback(() => {
    return generateK6Script(test);
  }, [test]);

  const highlightJavaScript = useCallback((code: string): JSX.Element[] => {
    const lines = code.split('\n');
    return lines.map((line, lineIndex) => {
      const highlighted = highlightJavaScriptLine(line);
      return (
        <div key={lineIndex} className="leading-6 flex">
          <span className="select-none text-muted-foreground pr-4 text-right" style={{ minWidth: '3rem' }}>
            {lineIndex + 1}
          </span>
          <span dangerouslySetInnerHTML={{ __html: highlighted || '&nbsp;' }} />
        </div>
      );
    });
  }, []);

  const k6Templates = useMemo(() => getK6Templates(test?.target_url || ''), [test?.target_url]);

  // Initialize K6 script when tab is opened
  useEffect(() => {
    if (test?.test_type === 'load' && activeTab === 'k6script' && !k6Script) {
      setK6Script(test?.k6_script || generateK6ScriptForTest());
    }
  }, [test?.test_type, activeTab, test?.k6_script, generateK6ScriptForTest]);

  const {
    handleStepDragStart,
    handleStepDragEnd,
    handleStepDragOver,
    handleStepDrop,
    handleSaveStepOrder,
    handleSaveCode,
    handleRevertToSteps,
    handleStartEditCode,
    handleCancelEditCode,
    handleExplainTest,
    handleAddStep,
  } = useStepHandlers({
    testId,
    token,
    test,
    setTest,
    draggedStepIndex,
    setDraggedStepIndex,
    setDragOverIndex,
    setHasReorderedSteps,
    hasReorderedSteps,
    setIsSavingStepOrder,
    editedCode,
    setEditedCode,
    setIsSavingCode,
    setCodeError,
    setIsEditingCode,
    setIsExplainingTest,
    setShowExplainModal,
    setTestExplanation,
    setIsAddingStep,
    setAddStepError,
    setShowAddStepModal,
  });

  // Reset zoom and pan when lightbox image changes
  useEffect(() => {
    if (lightboxImage) {
      setLightboxZoom(1);
      setLightboxPan({ x: 0, y: 0 });
    }
  }, [lightboxImage]);

  // Handle Escape key to close modals
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showUnsavedChangesModal) setShowUnsavedChangesModal(false);
        if (showDeleteModal) setShowDeleteModal(false);
        if (showAddStepModal) setShowAddStepModal(false);
        if (lightboxImage) setLightboxImage(null);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showDeleteModal, showAddStepModal, lightboxImage, showUnsavedChangesModal]);

  // Handle browser tab close/refresh with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && showEditModal) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, showEditModal]);

  // Handle confirming navigation (discard changes)
  const handleConfirmNavigation = () => {
    setShowUnsavedChangesModal(false);
    setShowEditModal(false);
    setIsDirty(false);
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    }
  };

  // Handle cancelling navigation (stay on page)
  const handleCancelNavigation = () => {
    setShowUnsavedChangesModal(false);
    setPendingNavigation(null);
  };

  // Check if any filters are active (not default)
  const hasActiveFilters = statusFilter !== 'all' || dateFilter !== 'all';

  // Helper to update URL search params while preserving other params
  const updateSearchParams = (updates: Record<string, string | null>) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === 'all' || value === '1') {
          newParams.delete(key);
        } else {
          newParams.set(key, value);
        }
      });
      return newParams;
    }, { replace: true });
  };

  // Wrapper functions that reset pagination when filters change (persisted in URL)
  const setStatusFilter = (value: 'all' | 'passed' | 'failed' | 'running') => {
    updateSearchParams({ status: value, page: '1' }); // Reset to page 1 when filter changes
  };

  const setDateFilter = (value: 'all' | 'today' | '7days' | '30days') => {
    updateSearchParams({ date: value, page: '1' }); // Reset to page 1 when filter changes
  };

  const setRunPage = (page: number) => {
    updateSearchParams({ page: page.toString() });
  };

  const setPageSize = (size: number) => {
    updateSearchParams({ pageSize: size.toString(), page: '1' }); // Reset to page 1 when changing page size
  };

  // Clear all filters to defaults
  const clearFilters = () => {
    updateSearchParams({ status: null, date: null, page: null });
  };

  // Export filtered runs to JSON file
  const handleExportRuns = () => {
    if (filteredRuns.length === 0) {
      toast.error('No runs to export');
      return;
    }

    // Prepare export data with filter info
    const exportData = {
      test: {
        name: test?.name,
        id: test?.id,
      },
      filters: {
        status: statusFilter,
        date: dateFilter,
      },
      runs: filteredRuns.map(run => ({
        id: run.id,
        status: run.status,
        duration_ms: run.duration_ms,
        started_at: run.started_at,
        completed_at: run.completed_at,
        created_at: run.created_at,
        results: run.results?.map(result => ({
          test_id: result.test_id,
          test_name: result.test_name,
          status: result.status,
          duration_ms: result.duration_ms,
          error: result.error,
        })),
      })),
      total_runs: filteredRuns.length,
      exported_at: new Date().toISOString(),
      version: '1.0',
    };

    // Create and download JSON file
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const filterSuffix = statusFilter !== 'all' ? `-${statusFilter}` : '';
    link.download = `${test?.name?.toLowerCase().replace(/\s+/g, '-') || 'runs'}${filterSuffix}-runs-export.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${filteredRuns.length} run(s) to file`);
  };

  // Filter runs by status and date
  const filteredRuns = runs.filter(run => {
    // Status filter
    if (statusFilter !== 'all' && run.status !== statusFilter) {
      return false;
    }
    // Date filter
    if (dateFilter !== 'all') {
      const runDate = new Date(run.created_at);
      const now = new Date();
      if (dateFilter === 'today') {
        // Check if run date is today (same calendar day)
        if (runDate.toDateString() !== now.toDateString()) {
          return false;
        }
      } else {
        const diffDays = Math.floor((now.getTime() - runDate.getTime()) / (1000 * 60 * 60 * 24));
        if (dateFilter === '7days' && diffDays > 7) {
          return false;
        }
        if (dateFilter === '30days' && diffDays > 30) {
          return false;
        }
      }
    }
    return true;
  });

  // Count runs by status
  const runCounts = {
    all: runs.length,
    passed: runs.filter(r => r.status === 'passed').length,
    failed: runs.filter(r => r.status === 'failed').length,
    running: runs.filter(r => r.status === 'running').length,
  };

  // Sort state
  const [sortBy, setSortBy] = useState<'date' | 'duration'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // K6 run comparison state (Feature #564) - Feature #560: compare state moved to useModalState
  const [selectedRunsForCompare, setSelectedRunsForCompare] = useState<string[]>([]);

  // Check if current test is a load test (for comparison feature)
  const isLoadTest = test?.test_type === 'load';

  // Sort filtered runs
  const sortedRuns = [...filteredRuns].sort((a, b) => {
    if (sortBy === 'date') {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    } else {
      const durationA = a.duration_ms || 0;
      const durationB = b.duration_ms || 0;
      return sortOrder === 'asc' ? durationA - durationB : durationB - durationA;
    }
  });

  // Paginate sorted runs
  const totalPages = Math.ceil(sortedRuns.length / pageSize);
  const paginatedRuns = sortedRuns.slice(
    (runPage - 1) * pageSize,
    runPage * pageSize
  );

  const handleSort = (field: 'date' | 'duration') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  // Toggle run selection for comparison (Feature #564)
  const toggleRunSelection = (runId: string) => {
    setSelectedRunsForCompare(prev => {
      if (prev.includes(runId)) {
        return prev.filter(id => id !== runId);
      }
      if (prev.length >= 2) {
        // Replace oldest selection
        return [prev[1], runId];
      }
      return [...prev, runId];
    });
  };

  const [newStepAction, setNewStepAction] = useState('navigate');
  const [newStepSelector, setNewStepSelector] = useState('');
  const [newStepValue, setNewStepValue] = useState('');
  const [newStepCheckpointName, setNewStepCheckpointName] = useState('');
  const [newStepCheckpointThreshold, setNewStepCheckpointThreshold] = useState('0.1');
  // Accessibility check step configuration
  const [newStepA11yWcagLevel, setNewStepA11yWcagLevel] = useState<'A' | 'AA' | 'AAA'>('AA');
  const [newStepA11yFailOnAny, setNewStepA11yFailOnAny] = useState(false);
  const [newStepA11yFailOnCritical, setNewStepA11yFailOnCritical] = useState(true);
  const [newStepA11yThreshold, setNewStepA11yThreshold] = useState('0'); // 0 = any violation fails

  // AI Copilot autocomplete state
  const [selectorAutocomplete, setSelectorAutocomplete] = useState<string | null>(null);
  const [valueAutocomplete, setValueAutocomplete] = useState<string | null>(null);
  const [showSelectorAutocomplete, setShowSelectorAutocomplete] = useState(false);
  const [showValueAutocomplete, setShowValueAutocomplete] = useState(false);

  const baseUrl = test?.target_url || '';

  // Autocomplete suggestion for selector
  useEffect(() => {
    if (!newStepSelector || !showAddStepModal) {
      setSelectorAutocomplete(null);
      setShowSelectorAutocomplete(false);
      return;
    }
    const match = findSelectorAutocomplete(newStepSelector);
    if (match) {
      setSelectorAutocomplete(match);
      setShowSelectorAutocomplete(true);
    } else {
      setSelectorAutocomplete(null);
      setShowSelectorAutocomplete(false);
    }
  }, [newStepSelector, showAddStepModal]);

  // Autocomplete suggestion for value
  useEffect(() => {
    if (!newStepValue || !showAddStepModal) {
      setValueAutocomplete(null);
      setShowValueAutocomplete(false);
      return;
    }
    const match = findValueAutocomplete(newStepValue, newStepAction, baseUrl);
    if (match) {
      setValueAutocomplete(match);
      setShowValueAutocomplete(true);
    } else {
      setValueAutocomplete(null);
      setShowValueAutocomplete(false);
    }
  }, [newStepValue, newStepAction, showAddStepModal, baseUrl]);

  // Handle Tab key to accept autocomplete
  const handleSelectorKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab' && selectorAutocomplete && showSelectorAutocomplete) {
      e.preventDefault();
      setNewStepSelector(selectorAutocomplete);
      setSelectorAutocomplete(null);
      setShowSelectorAutocomplete(false);
    }
  };

  const handleValueKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab' && valueAutocomplete && showValueAutocomplete) {
      e.preventDefault();
      setNewStepValue(valueAutocomplete);
      setValueAutocomplete(null);
      setShowValueAutocomplete(false);
    }
  };

  const canEdit = user?.role !== 'viewer';
  const canDelete = user?.role !== 'viewer';
  const canRun = user?.role !== 'viewer';

  const {
    handleDelete,
    handleEdit: handleEditFromHook,
    handleDuplicate,
  } = useTestCrudHandlers({
    testId,
    token,
    suite,
    test,
    setIsDeleting,
    setDeleteError,
    setIsEditing,
    setEditError,
    setShowEditModal,
    setTest,
    setIsDirty,
    setIsDuplicating,
    setDuplicateError,
  });

  const {
    handleApproveBaseline,
    handleRestoreBaseline,
    handleRejectChanges: handleRejectChangesFromHook,
    handleMergeBaseline,
  } = useBaselineHandlers({
    testId,
    token,
    selectedBranch,
    activeTab,
    setApprovingBaseline,
    setApproveBaselineError,
    setShowApproveBaselineModal,
    setApproveBaselineRunId,
    setRestoringBaseline,
    setRestoreBaselineError,
    setShowRestoreBaselineModal,
    setRestoreHistoryEntry,
    setRejectingChanges,
    setRejectChangesError,
    setShowRejectChangesModal,
    setRejectChangesRunId,
    setRejectionReason,
    setRejectionStatus,
    setIsMergingBaseline,
    setMergeBaselineError,
    setShowMergeBaselineModal,
    setSelectedMergeBranch,
    setBaselineData,
    setLoadingBaseline,
    setBaselineHistory,
    setLoadingBaselineHistory,
    addNotification,
  });

  // Wrapper for handleRejectChanges to pass state values
  const handleRejectChanges = (runId?: string) => {
    handleRejectChangesFromHook(runId || rejectChangesRunId || undefined, rejectionReason);
  };

  // Feature #68: Fetch runs helper uses React Query refetch for caching
  const fetchRuns = async () => {
    try {
      // Use React Query refetch - data is cached and updates local state via useEffect
      await refetchRuns();
    } catch {
      // Ignore errors for runs fetch
    }
  };

  const {
    handleRunTest,
    handleCancelRun,
  } = useRunHandlers({
    testId,
    token,
    selectedBranch,
    testType: test?.test_type,
    currentRun,
    socket,
    connect,
    joinRun,
    leaveRun,
    setIsRunning,
    setRunError,
    setCurrentRun,
    setLiveProgress,
    setIsCancellingRun,
    setLiveScreenshot, // Feature #204: Pass live screenshot setter for step:screenshot events
    fetchRuns,
  });

  const {
    handleDownloadAllArtifacts,
    handleCompareRuns,
    fetchFlakinessTrend,
    handleCreateQuickSchedule,
  } = useTestPageUtilities({
    testId,
    token,
    test,
    suite,
    selectedRunsForCompare,
    setIsDownloadingArtifacts,
    setIsComparing,
    setCompareResults,
    setShowCompareModal,
    setIsLoadingFlakinessTrend,
    setFlakinessTrend,
    setIsCreatingSchedule,
    setQuickScheduleError,
    setShowQuickScheduleModal,
    addNotification,
  });

  const handleOpenEditModal = () => {
    if (test) {
      setEditName(test.name);
      setEditDescription(test.description || '');
      setEditError('');
      setIsDirty(false);
      setShowEditModal(true);
    }
  };

  // Track dirty state when edit modal form values change
  useEffect(() => {
    if (showEditModal && test) {
      const nameChanged = editName !== test.name;
      const descChanged = editDescription !== (test.description || '');
      setIsDirty(nameChanged || descChanged);
    }
  }, [editName, editDescription, showEditModal, test]);

  // Wrapper for form submission that calls hook handler
  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleEditFromHook(editName, editDescription);
  };

  // Check rejection status when test result changes
  useEffect(() => {
    const checkRejectionStatus = async () => {
      if (!currentRun?.id || !testId || !token) return;

      try {
        const response = await fetch(`/api/v1/tests/${testId}/visual/rejection?runId=${currentRun.id}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          setRejectionStatus(data);
        }
      } catch (error) {
        console.error('Failed to check rejection status:', error);
      }
    };

    checkRejectionStatus();
  }, [currentRun?.id, testId, token]);

  // Fetch flakiness trend when test ID changes
  useEffect(() => {
    if (testId && token) {
      fetchFlakinessTrend();
    }
  }, [testId, token, fetchFlakinessTrend]);

  // Wrapper to reset form fields after adding step
  const handleAddStepWithReset = async (e: React.FormEvent) => {
    await handleAddStep(e, {
      action: newStepAction,
      selector: newStepSelector,
      value: newStepValue,
      checkpointName: newStepCheckpointName,
      checkpointThreshold: newStepCheckpointThreshold,
      a11yWcagLevel: newStepA11yWcagLevel,
      a11yFailOnAny: newStepA11yFailOnAny,
      a11yFailOnCritical: newStepA11yFailOnCritical,
      a11yThreshold: newStepA11yThreshold,
    });
    // Reset form fields after successful add
    setNewStepAction('navigate');
    setNewStepSelector('');
    setNewStepValue('');
    setNewStepCheckpointName('');
    setNewStepCheckpointThreshold('0.1');
    setNewStepA11yWcagLevel('AA');
    setNewStepA11yFailOnAny(false);
    setNewStepA11yFailOnCritical(true);
    setNewStepA11yThreshold('0');
  };

  // Feature #68: Sync React Query data to local state (enables React Query caching)
  // Data loads instantly on second visit due to React Query's built-in caching
  useEffect(() => {
    if (testData?.test) {
      setTest(testData.test);
    }
    if (testError) {
      setError('Test not found');
    }
  }, [testData, testError]);

  useEffect(() => {
    if (runsData?.runs) {
      setRuns(runsData.runs);
    }
  }, [runsData]);

  // Feature #137: Use enriched test data for suite/project info (eliminates waterfall)
  // Primary source: testData.test.suite_name, project_id, project_name from SQL JOIN
  // Fallback: suiteData/projectData if enriched fields not available
  useEffect(() => {
    const testObj = testData?.test;
    if (testObj) {
      // Use enriched fields if available, otherwise fall back to separate API calls
      const suiteName = testObj.suite_name || suiteData?.suite?.name;
      if (testObj.suite_id && suiteName) {
        setSuite({ id: testObj.suite_id, name: suiteName });
      } else if (suiteData?.suite) {
        setSuite(suiteData.suite);
      }

      const projectName = testObj.project_name || projectData?.project?.name;
      const projId = testObj.project_id || projectData?.project?.id;
      if (projId && projectName) {
        setProject({ id: projId, name: projectName });
      } else if (projectData?.project) {
        setProject(projectData.project);
      }
    }
  }, [testData, suiteData, projectData]);

  // Feature #68: Update loading state based on React Query
  useEffect(() => {
    // Only set loading to false when test data is loaded (or errored)
    if (!testLoading && (testData || testError)) {
      setIsLoading(false);
    }
  }, [testLoading, testData, testError]);

  useBaselineDataFetching({
    testId,
    token,
    testType: test?.test_type,
    activeTab,
    selectedBranch,
    baselineData,
    selectedHistoryVersion,
    setLoadingBaseline,
    setBaselineData,
    setLoadingBranches,
    setAvailableBranches,
    setLoadingMergeableBranches,
    setMergeableBranches,
    setLoadingBaselineHistory,
    setBaselineHistory,
    setLoadingHistoryImage,
    setHistoryVersionImage,
  });

  // Connect to Socket.IO and join organization room for cross-tab sync
  useEffect(() => {
    if (user?.organization_id) {
      connect();
      // Small delay to ensure socket is connected before joining room
      const timer = setTimeout(() => {
        joinOrg(user.organization_id);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [user?.organization_id, connect, joinOrg]);

  // Listen for run events from other tabs (via org room) - track processed runs to avoid duplicates
  const processedRunsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!socket || !testId) return;

    const handleOrgRunComplete = (data: { runId: string; orgId: string; status: string; duration_ms: number; testName?: string }) => {
      logger.websocket.debug('Received run-complete from org room:', data);

      // Avoid processing the same run twice (we receive from both run room and org room)
      if (processedRunsRef.current.has(data.runId)) {
        logger.websocket.debug('Skipping duplicate notification for run:', data.runId);
        return;
      }
      processedRunsRef.current.add(data.runId);

      // Add notification for completed test
      const isSuccess = data.status === 'passed';
      addNotification({
        type: isSuccess ? 'test_complete' : 'test_failed',
        title: isSuccess ? 'Test Passed' : 'Test Failed',
        message: `${data.testName || 'Test'} ${isSuccess ? 'completed successfully' : 'failed'} (${(data.duration_ms / 1000).toFixed(1)}s)`,
        runId: data.runId,
        testId: testId,
      });

      // Feature #68: Refresh runs list using React Query (caches the result)
      refetchRuns().catch(err => console.error('Failed to refresh runs:', err));
    };

    socket.on('run-complete', handleOrgRunComplete);

    return () => {
      socket.off('run-complete', handleOrgRunComplete);
    };
  }, [socket, testId, token, addNotification, refetchRuns]);

  // Feature #551: Skeleton loading state for better perceived performance
  if (isLoading) {
    return (
      <Layout>
        <div className="p-8">
          <SkeletonTestDetailPage />
        </div>
      </Layout>
    );
  }

  if (error || !test) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center p-8 min-h-[60vh]">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground">Test Not Found</h2>
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
        {/* Feature #48: Extracted TestHeader component */}
        <TestHeader
          test={test}
          project={project}
          suite={suite}
          selectedBranch={selectedBranch}
          availableBranches={availableBranches}
          onBranchChange={setSelectedBranch}
          onAddBranch={(newBranch) => {
            if (!availableBranches.includes(newBranch)) {
              setAvailableBranches([...availableBranches, newBranch]);
            }
            setSelectedBranch(newBranch);
          }}
          isRunning={isRunning}
          canRun={canRun}
          canEdit={canEdit}
          canDelete={canDelete}
          isDuplicating={isDuplicating}
          isCancellingRun={isCancellingRun}
          onRunTest={handleRunTest}
          onCancelRun={handleCancelRun}
          onSchedule={() => setShowQuickScheduleModal(true)}
          onEditTest={handleOpenEditModal}
          onDuplicate={handleDuplicate}
          onDelete={() => setShowDeleteModal(true)}
          runError={runError}
          duplicateError={duplicateError}
        />

        {/* Feature #551: Test Health Score with weighted breakdown */}
        {runs.length > 0 && (() => {
          const healthScore = computeTestHealthScore(runs);
          return (
            <div className="mt-6 mb-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <ScoreCard
                  score={healthScore.overall}
                  label="Health"
                  size="md"
                  showIcon
                />
                <ScoreCard
                  score={healthScore.passRate}
                  label="Pass Rate (40%)"
                  size="sm"
                  thresholds={{ good: 90, warning: 70 }}
                />
                <ScoreCard
                  score={healthScore.durationStability}
                  label="Stability (20%)"
                  size="sm"
                  thresholds={{ good: 80, warning: 50 }}
                />
                <ScoreCard
                  score={healthScore.flakiness}
                  label="Flakiness (20%)"
                  size="sm"
                  thresholds={{ good: 80, warning: 50 }}
                />
                <ScoreCard
                  score={healthScore.recency}
                  label="Recency (20%)"
                  size="sm"
                  thresholds={{ good: 80, warning: 40 }}
                />
              </div>
            </div>
          );
        })()}

        {/* Feature #489: AI Summary Card for instant failure diagnosis */}
        {test && (
          <TestAISummary
            testId={test.id}
            testName={test.name}
            runs={runs}
            token={token}
            formatDateTime={formatDateTime}
          />
        )}

        {/* Delete Confirmation Modal - Feature #48: Extracted to component */}
        {showDeleteModal && (
          <DeleteTestModal
            testName={test?.name || ''}
            isDeleting={isDeleting}
            deleteError={deleteError}
            onClose={() => setShowDeleteModal(false)}
            onDelete={handleDelete}
          />
        )}

        {/* AI Explain Test Modal - Feature #48: Extracted to component */}
        <AIExplainModal
          show={showExplainModal}
          testName={test?.name || ''}
          isLoading={isExplainingTest}
          explanation={testExplanation}
          onClose={() => setShowExplainModal(false)}
        />

        {/* Quick Schedule Modal - Feature #48: Extracted to component */}
        <QuickScheduleModal
          show={showQuickScheduleModal}
          testName={test?.name || ''}
          isCreating={isCreatingSchedule}
          error={quickScheduleError}
          onClose={() => setShowQuickScheduleModal(false)}
          onSubmit={handleCreateQuickSchedule}
        />

        {/* Approve Baseline Confirmation Modal - Feature #48: Using extracted component */}
        {showApproveBaselineModal && (
          <ApproveBaselineModal
            testName={test?.name || ''}
            approvingBaseline={approvingBaseline}
            approveBaselineError={approveBaselineError}
            currentRun={currentRun ?? undefined}
            testId={test?.id}
            runId={approveBaselineRunId}
            onClose={() => {
              setShowApproveBaselineModal(false);
              setApproveBaselineRunId(null);
              setApproveBaselineError('');
            }}
            onApprove={handleApproveBaseline}
          />
        )}

        {/* Restore Baseline Confirmation Modal - Feature #48: Using extracted component */}
        {showRestoreBaselineModal && (
          <RestoreBaselineModal
            testName={test?.name || ''}
            restoringBaseline={restoringBaseline}
            restoreBaselineError={restoreBaselineError}
            restoreHistoryEntry={restoreHistoryEntry}
            onClose={() => {
              setShowRestoreBaselineModal(false);
              setRestoreHistoryEntry(null);
              setRestoreBaselineError('');
            }}
            onRestore={handleRestoreBaseline}
          />
        )}

        {/* Merge Baseline Modal - Feature #48: Using extracted component */}
        {showMergeBaselineModal && (
          <MergeBaselineModal
            selectedBranch={selectedBranch}
            selectedMergeBranch={selectedMergeBranch}
            isMergingBaseline={isMergingBaseline}
            mergeBaselineError={mergeBaselineError}
            onClose={() => {
              setShowMergeBaselineModal(false);
              setSelectedMergeBranch(null);
              setMergeBaselineError('');
            }}
            onMerge={handleMergeBaseline}
          />
        )}

        {/* Reject Changes Confirmation Modal - Feature #48: Using extracted component */}
        {showRejectChangesModal && (
          <RejectChangesModal
            testName={test?.name || ''}
            rejectingChanges={rejectingChanges}
            rejectChangesError={rejectChangesError}
            rejectionReason={rejectionReason}
            onReasonChange={setRejectionReason}
            runId={rejectChangesRunId}
            onClose={() => {
              setShowRejectChangesModal(false);
              setRejectChangesRunId(null);
              setRejectChangesError('');
              setRejectionReason('');
            }}
            onReject={handleRejectChanges}
          />
        )}

        {/* Edit Modal - Feature #48: Extracted to component */}
        <EditTestModal
          show={showEditModal}
          editName={editName}
          editDescription={editDescription}
          editError={editError}
          isEditing={isEditing}
          isDirty={isDirty}
          onNameChange={setEditName}
          onDescriptionChange={setEditDescription}
          onSubmit={handleEdit}
          onClose={() => setShowEditModal(false)}
          onShowUnsavedChanges={() => {
            setShowUnsavedChangesModal(true);
            setPendingNavigation(() => () => {
              setShowEditModal(false);
              setIsDirty(false);
            });
          }}
        />

        {/* Unsaved Changes Warning Modal - Feature #48: Extracted to component */}
        <UnsavedChangesConfirmModal
          show={showUnsavedChangesModal}
          onCancel={handleCancelNavigation}
          onConfirm={handleConfirmNavigation}
        />

        {/* Test Details - Feature #48: Using extracted TestDetailsCard component */}
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <TestDetailsCard
            // Feature #568: Removed as-unknown-as cast (fixed TestDetailsCard to accept string | string[])
            test={test}
            suiteName={suite?.name}
            formatDate={formatDate}
          />

          <div className="rounded-lg border border-border bg-card p-6">
            {/* Tab Header */}
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex gap-4">
                <button
                  onClick={() => setActiveTab('steps')}
                  className={`text-lg font-semibold pb-2 border-b-2 transition-colors ${
                    activeTab === 'steps'
                      ? 'text-foreground border-primary'
                      : 'text-muted-foreground border-transparent hover:text-foreground'
                  }`}
                >
                  Test Steps
                </button>
                <button
                  onClick={() => setActiveTab('code')}
                  className={`text-lg font-semibold pb-2 border-b-2 transition-colors ${
                    activeTab === 'code'
                      ? 'text-foreground border-primary'
                      : 'text-muted-foreground border-transparent hover:text-foreground'
                  }`}
                >
                  View Code
                </button>
                {test?.test_type === 'visual_regression' && (
                  <button
                    onClick={() => setActiveTab('baseline')}
                    className={`text-lg font-semibold pb-2 border-b-2 transition-colors ${
                      activeTab === 'baseline'
                        ? 'text-foreground border-primary'
                        : 'text-muted-foreground border-transparent hover:text-foreground'
                    }`}
                  >
                    📸 Baseline
                  </button>
                )}
                {test?.test_type === 'load' && (
                  <button
                    onClick={() => setActiveTab('k6script')}
                    className={`text-lg font-semibold pb-2 border-b-2 transition-colors ${
                      activeTab === 'k6script'
                        ? 'text-foreground border-primary'
                        : 'text-muted-foreground border-transparent hover:text-foreground'
                    }`}
                  >
                    🚀 K6 Script
                  </button>
                )}
              </div>
              {/* Feature #1963: Only show Add Step for E2E tests (visual/lighthouse/accessibility don't use steps) */}
              {canEdit && activeTab === 'steps' && !['visual_regression', 'lighthouse', 'accessibility'].includes(test?.test_type || '') && (
                <button
                  onClick={() => setShowAddStepModal(true)}
                  className="text-sm text-primary hover:underline"
                >
                  + Add Step
                </button>
              )}
            </div>

            {/* Steps Tab Content - Feature #48: Extracted to TestStepsTab component */}
            {activeTab === 'steps' && (
              <TestStepsTab
                test={test}
                hasReorderedSteps={hasReorderedSteps}
                isSavingStepOrder={isSavingStepOrder}
                draggedStepIndex={draggedStepIndex}
                dragOverIndex={dragOverIndex}
                onSaveStepOrder={handleSaveStepOrder}
                onStepDragStart={handleStepDragStart}
                onStepDragEnd={handleStepDragEnd}
                onStepDragOver={handleStepDragOver}
                onStepDrop={handleStepDrop}
              />
            )}

            {/* View Code Tab Content - Feature #48: Extracted to ViewCodeTab component */}
            {activeTab === 'code' && (
              <ViewCodeTab
                test={test}
                canEdit={canEdit}
                isEditingCode={isEditingCode}
                editedCode={editedCode}
                codeError={codeError}
                isSavingCode={isSavingCode}
                isExplainingTest={isExplainingTest}
                onSetEditedCode={setEditedCode}
                onStartEditCode={handleStartEditCode}
                onCancelEditCode={handleCancelEditCode}
                onSaveCode={handleSaveCode}
                onRevertToSteps={handleRevertToSteps}
                onExplainTest={handleExplainTest}
                generatePlaywrightCode={generatePlaywrightCodeForTest}
              />
            )}

            {/* K6 Script Tab Content - Feature #48: Use extracted K6ScriptTab component */}
            {activeTab === 'k6script' && test?.test_type === 'load' && (
              <K6ScriptTab
                test={test}
                canEdit={canEdit}
                isEditingK6Script={isEditingK6Script}
                k6Script={k6Script}
                isSavingK6Script={isSavingK6Script}
                token={token}
                k6Templates={k6Templates}
                showK6Templates={showK6Templates}
                onSetK6Script={setK6Script}
                onSetIsEditingK6Script={setIsEditingK6Script}
                onSetShowK6Templates={setShowK6Templates}
                generateK6Script={generateK6ScriptForTest}
              />
            )}

            {/* Baseline Tab Content - Feature #48: Extracted to BaselineTab component */}
            {activeTab === 'baseline' && test?.test_type === 'visual_regression' && (
              <BaselineTab
                testId={testId!}
                selectedBranch={selectedBranch}
                availableBranches={availableBranches}
                loadingBaseline={loadingBaseline}
                baselineData={baselineData}
                isRunning={isRunning}
                mergeableBranches={mergeableBranches}
                baselineHistory={baselineHistory}
                loadingBaselineHistory={loadingBaselineHistory}
                selectedHistoryVersion={selectedHistoryVersion}
                historyVersionImage={historyVersionImage}
                loadingHistoryImage={loadingHistoryImage}
                onRunTest={handleRunTest}
                onSetSelectedMergeBranch={setSelectedMergeBranch}
                onSetShowMergeBaselineModal={setShowMergeBaselineModal}
                onSetLightboxImage={setLightboxImage}
                onSetSelectedHistoryVersion={setSelectedHistoryVersion}
                onSetHistoryVersionImage={setHistoryVersionImage}
                onSetRestoreHistoryEntry={setRestoreHistoryEntry}
                onSetShowRestoreBaselineModal={setShowRestoreBaselineModal}
                onSetRestoreBaselineError={setRestoreBaselineError}
              />
            )}
          </div>
        </div>

        {/* Add Step Modal - Feature #48: Extracted to component */}
        <AddStepModal
          show={showAddStepModal}
          newStepAction={newStepAction}
          newStepSelector={newStepSelector}
          newStepValue={newStepValue}
          newStepCheckpointName={newStepCheckpointName}
          newStepCheckpointThreshold={newStepCheckpointThreshold}
          newStepA11yWcagLevel={newStepA11yWcagLevel}
          newStepA11yThreshold={newStepA11yThreshold}
          newStepA11yFailOnCritical={newStepA11yFailOnCritical}
          newStepA11yFailOnAny={newStepA11yFailOnAny}
          showSelectorAutocomplete={showSelectorAutocomplete}
          selectorAutocomplete={selectorAutocomplete}
          showValueAutocomplete={showValueAutocomplete}
          valueAutocomplete={valueAutocomplete}
          addStepError={addStepError}
          isAddingStep={isAddingStep}
          targetUrl={test?.target_url}
          onActionChange={setNewStepAction}
          onSelectorChange={setNewStepSelector}
          onValueChange={setNewStepValue}
          onCheckpointNameChange={setNewStepCheckpointName}
          onCheckpointThresholdChange={setNewStepCheckpointThreshold}
          onA11yWcagLevelChange={setNewStepA11yWcagLevel}
          onA11yThresholdChange={setNewStepA11yThreshold}
          onA11yFailOnCriticalChange={setNewStepA11yFailOnCritical}
          onA11yFailOnAnyChange={setNewStepA11yFailOnAny}
          onSelectorKeyDown={handleSelectorKeyDown}
          onValueKeyDown={handleValueKeyDown}
          onSubmit={handleAddStepWithReset}
          onClose={() => setShowAddStepModal(false)}
        />

        {/* Current Run Status - Feature #48: Extracted to component */}
        {currentRun && (
          <CurrentRunStatusSection
            currentRun={currentRun}
            test={test}
            liveProgress={liveProgress}
            liveScreenshot={liveScreenshot}
            liveConsoleLogs={liveConsoleLogs}
            isCancellingRun={isCancellingRun}
            isDownloadingArtifacts={isDownloadingArtifacts}
            onCancelRun={handleCancelRun}
            onDownloadAllArtifacts={handleDownloadAllArtifacts}
            comparisonViewMode={comparisonViewMode}
            setComparisonViewMode={setComparisonViewMode}
            sliderPosition={sliderPosition}
            setSliderPosition={setSliderPosition}
            onionSkinOpacity={onionSkinOpacity}
            setOnionSkinOpacity={setOnionSkinOpacity}
            diffOverlayOpacity={diffOverlayOpacity}
            setDiffOverlayOpacity={setDiffOverlayOpacity}
            imageZoomLevel={imageZoomLevel}
            setImageZoomLevel={setImageZoomLevel}
            baselineContainerRef={baselineContainerRef}
            currentContainerRef={currentContainerRef}
            diffContainerRef={diffContainerRef}
            handleSyncScroll={handleSyncScroll}
            onOpenLightbox={setLightboxImage}
            onApproveBaseline={handleApproveBaseline}
            onRejectChanges={handleRejectChanges}
            a11ySeverityFilter={a11ySeverityFilter}
            setA11ySeverityFilter={setA11ySeverityFilter}
            a11yCategoryFilter={a11yCategoryFilter}
            setA11yCategoryFilter={setA11yCategoryFilter}
            a11ySearchQuery={a11ySearchQuery}
            setA11ySearchQuery={setA11ySearchQuery}
            token={token || ''}
            formatDateTime={formatDateTime}
          />
        )}

        {/* Feature #1101: Flakiness Trend - Feature #48: Extracted to component */}
        <FlakinessPanel
          isLoading={isLoadingFlakinessTrend}
          flakinessTrend={flakinessTrend}
          runs={runs}
          showSection={showFlakinessTrendSection}
          onHideSection={() => setShowFlakinessTrendSection(false)}
          onRefresh={fetchFlakinessTrend}
        />

        {/* Run History - Feature #48: Extracted to component */}
        <RunHistorySection
          runs={runs}
          filteredRuns={filteredRuns}
          sortedRuns={sortedRuns}
          paginatedRuns={paginatedRuns}
          runCounts={runCounts}
          statusFilter={statusFilter}
          dateFilter={dateFilter}
          sortBy={sortBy}
          sortOrder={sortOrder}
          runPage={runPage}
          pageSize={pageSize}
          totalPages={totalPages}
          hasActiveFilters={hasActiveFilters}
          isLoadTest={isLoadTest}
          selectedRunsForCompare={selectedRunsForCompare}
          isComparing={isComparing}
          isDownloadingArtifacts={isDownloadingArtifacts}
          formatDateTime={formatDateTime}
          onSetStatusFilter={setStatusFilter}
          onSetDateFilter={setDateFilter}
          onSort={handleSort}
          onSetRunPage={setRunPage}
          onSetPageSize={setPageSize}
          onClearFilters={clearFilters}
          onExportRuns={handleExportRuns}
          onToggleRunSelection={toggleRunSelection}
          onCompareRuns={handleCompareRuns}
          onDownloadAllArtifacts={handleDownloadAllArtifacts}
        />

        {/* K6 Run Comparison Modal - Feature #48: Extracted to component */}
        <K6CompareModal
          show={showCompareModal}
          results={compareResults}
          onClose={() => setShowCompareModal(false)}
          formatDateTime={formatDateTime}
        />

        {/* Screenshot Lightbox Modal - Feature #48: Extracted to component */}
        <ImageLightbox
          image={lightboxImage}
          onClose={() => setLightboxImage(null)}
          zoom={lightboxZoom}
          setZoom={setLightboxZoom}
          pan={lightboxPan}
          setPan={setLightboxPan}
          isDragging={isDragging}
          setIsDragging={setIsDragging}
          dragStart={dragStart}
          setDragStart={setDragStart}
        />
      </div>
    </Layout>
  );
}

export { TestDetailPage };
