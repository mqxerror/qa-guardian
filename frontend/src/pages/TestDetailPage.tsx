// TestDetailPage - Extracted from App.tsx
// Feature #1441: Split App.tsx into logical modules
// Feature #68: Added React Query caching for faster loading
// Feature #337: Dark-first design system redesign
// Feature #569: Removed useState - all state now managed by useTestDetailState hook
import { useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
// Feature #571: Lucide icons for page-level tab navigation (replaces emoji)
import { LayoutDashboard, Play, Settings, History } from 'lucide-react';
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
// Feature #581: Browser notifications for long-running test completion
import { useTestNotifications } from '../hooks/useTestNotifications';
// Feature #48: Import modular types and utilities
import {
  // Feature #513: Removed unused type imports - now used only in test-detail components
  // TestSuite, ConsoleLog, NetworkRequest, TestRunResult, StepResult, TestStatus,
  // RunStatus, ResultStatus, StepStatus, TestCategory - used in sub-components
  TestType,
  // Feature #569: Removed TestRunType, FlakinessTrend, K6CompareResults, TestExplanation
  // (no longer used directly - state types now managed by useTestDetailState hook)
  // Feature #48: Import extracted components
  DeleteTestModal,
  ApproveBaselineModal,
  RestoreBaselineModal,
  MergeBaselineModal,
  RejectChangesModal,
  FlakinessPanel,
  ImageLightbox,
  K6CompareModal,
  RunHistorySection,
  EditTestModal,
  AddStepModal,
  AIExplainModal,
  UnsavedChangesConfirmModal,
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
  // Feature #569: Combined state hook replaces ~78 useState + useModalState
  useTestDetailState,
} from '../components/test-detail';

function TestDetailPage() {
  const { testId } = useParams<{ testId: string }>();
  const { token, user } = useAuthStore();
  const { formatDate, formatDateTime } = useTimezoneStore();
  const { socket, connect, joinRun, leaveRun, joinOrg } = useSocketStore();
  const { addNotification } = useNotificationStore();
  // Feature #581: Browser notifications for long-running test completion
  const { notificationsEnabled, notificationsSupported, toggleNotifications, notifyTestComplete } = useTestNotifications();
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

  // Feature #569: Combined state hook replaces ~78 useState + useModalState
  // All state is managed by useTestDetailState() which calls useCoreTestState,
  // useModalState, useVisualTestingState, useUIState, useStepManagementState internally.
  const {
    // Core test state
    test, setTest, suite, setSuite, project, setProject,
    isLoading, setIsLoading, error, setError,
    currentRun, setCurrentRun, runs, setRuns,
    isRunning, setIsRunning, isCancellingRun, setIsCancellingRun,
    runError, setRunError,
    liveProgress, setLiveProgress, liveScreenshot, setLiveScreenshot,
    liveConsoleLogs, setLiveConsoleLogs,
    // Modal state (visibility + associated form/loading/error)
    showDeleteModal, setShowDeleteModal, isDeleting, setIsDeleting,
    deleteError, setDeleteError,
    showEditModal, setShowEditModal, editName, setEditName,
    editDescription, setEditDescription, isEditing, setIsEditing,
    editError, setEditError,
    showApproveBaselineModal, setShowApproveBaselineModal,
    approvingBaseline, setApprovingBaseline,
    approveBaselineRunId, setApproveBaselineRunId,
    approveBaselineError, setApproveBaselineError,
    showRejectChangesModal, setShowRejectChangesModal,
    rejectingChanges, setRejectingChanges,
    rejectChangesRunId, setRejectChangesRunId,
    rejectChangesError, setRejectChangesError,
    rejectionReason, setRejectionReason,
    showRestoreBaselineModal, setShowRestoreBaselineModal,
    restoreHistoryEntry, setRestoreHistoryEntry,
    restoringBaseline, setRestoringBaseline,
    restoreBaselineError, setRestoreBaselineError,
    showMergeBaselineModal, setShowMergeBaselineModal,
    selectedMergeBranch, setSelectedMergeBranch,
    isMergingBaseline, setIsMergingBaseline,
    mergeBaselineError, setMergeBaselineError,
    showQuickScheduleModal, setShowQuickScheduleModal,
    isCreatingSchedule, setIsCreatingSchedule,
    quickScheduleError, setQuickScheduleError,
    showAddStepModal, setShowAddStepModal,
    showExplainModal, setShowExplainModal,
    testExplanation, setTestExplanation,
    isExplainingTest, setIsExplainingTest,
    showUnsavedChangesModal, setShowUnsavedChangesModal,
    pendingNavigation, setPendingNavigation,
    showCompareModal, setShowCompareModal,
    compareResults, setCompareResults,
    isComparing, setIsComparing,
    // Visual testing state
    baselineData, setBaselineData, loadingBaseline, setLoadingBaseline,
    baselineHistory, setBaselineHistory, loadingBaselineHistory, setLoadingBaselineHistory,
    selectedHistoryVersion, setSelectedHistoryVersion,
    historyVersionImage, setHistoryVersionImage,
    loadingHistoryImage, setLoadingHistoryImage,
    selectedBranch, setSelectedBranch,
    availableBranches, setAvailableBranches, loadingBranches, setLoadingBranches,
    mergeableBranches, setMergeableBranches,
    loadingMergeableBranches, setLoadingMergeableBranches,
    rejectionStatus, setRejectionStatus,
    comparisonViewMode, setComparisonViewMode,
    sliderPosition, setSliderPosition,
    onionSkinOpacity, setOnionSkinOpacity,
    diffOverlayOpacity, setDiffOverlayOpacity,
    imageZoomLevel, setImageZoomLevel,
    lightboxImage, setLightboxImage,
    lightboxZoom, setLightboxZoom,
    lightboxPan, setLightboxPan,
    isDragging, setIsDragging, dragStart, setDragStart,
    // UI state
    activeTab, setActiveTab,
    flakinessTrend, setFlakinessTrend,
    isLoadingFlakinessTrend, setIsLoadingFlakinessTrend,
    showFlakinessTrendSection, setShowFlakinessTrendSection,
    isDirty, setIsDirty,
    isDownloadingArtifacts, setIsDownloadingArtifacts,
    isDuplicating, setIsDuplicating, duplicateError, setDuplicateError,
    k6Script, setK6Script,
    isEditingK6Script, setIsEditingK6Script,
    isSavingK6Script, setIsSavingK6Script,
    showK6Templates, setShowK6Templates,
    foldedRegions, setFoldedRegions,
    isEditingCode, setIsEditingCode, editedCode, setEditedCode,
    isSavingCode, setIsSavingCode, codeError, setCodeError,
    sortBy, setSortBy, sortOrder, setSortOrder,
    selectedRunsForCompare, setSelectedRunsForCompare,
    a11ySeverityFilter, setA11ySeverityFilter,
    a11yCategoryFilter, setA11yCategoryFilter,
    a11ySearchQuery, setA11ySearchQuery,
    // Step management state
    draggedStepIndex, setDraggedStepIndex,
    dragOverIndex, setDragOverIndex,
    isSavingStepOrder, setIsSavingStepOrder,
    hasReorderedSteps, setHasReorderedSteps,
    newStepAction, setNewStepAction,
    newStepSelector, setNewStepSelector,
    newStepValue, setNewStepValue,
    isAddingStep, setIsAddingStep, addStepError, setAddStepError,
    newStepCheckpointName, setNewStepCheckpointName,
    newStepCheckpointThreshold, setNewStepCheckpointThreshold,
    newStepA11yWcagLevel, setNewStepA11yWcagLevel,
    newStepA11yFailOnAny, setNewStepA11yFailOnAny,
    newStepA11yFailOnCritical, setNewStepA11yFailOnCritical,
    newStepA11yThreshold, setNewStepA11yThreshold,
    selectorAutocomplete, setSelectorAutocomplete,
    valueAutocomplete, setValueAutocomplete,
    showSelectorAutocomplete, setShowSelectorAutocomplete,
    showValueAutocomplete, setShowValueAutocomplete,
  } = useTestDetailState();

  // Feature #570: Page-level section navigation (deep-linked via URL)
  type PageSection = 'overview' | 'execution' | 'configuration' | 'history';
  const validSections: PageSection[] = ['overview', 'execution', 'configuration', 'history'];
  const rawSection = searchParams.get('section');
  const pageSection: PageSection = validSections.includes(rawSection as PageSection)
    ? (rawSection as PageSection) : 'overview';
  const setPageSection = (section: PageSection) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (section === 'overview') {
        newParams.delete('section');
      } else {
        newParams.set('section', section);
      }
      return newParams;
    }, { replace: true });
  };

  // Read filter state from URL search params (persists across navigation)
  const statusFilter = (searchParams.get('status') as 'all' | 'passed' | 'failed' | 'running') || 'all';
  const dateFilter = (searchParams.get('date') as 'all' | 'today' | '7days' | '30days') || 'all';
  const runPage = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
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

      // Feature #581: Browser notification for long-running tests (> 30s)
      notifyTestComplete({
        testName: data.testName || 'Test',
        status: data.status,
        durationMs: data.duration_ms,
        runId: data.runId,
      });

      // Feature #68: Refresh runs list using React Query (caches the result)
      refetchRuns().catch(err => console.error('Failed to refresh runs:', err));
    };

    socket.on('run-complete', handleOrgRunComplete);

    return () => {
      socket.off('run-complete', handleOrgRunComplete);
    };
  }, [socket, testId, token, addNotification, refetchRuns, notifyTestComplete]);

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
          // Feature #581: Browser notification toggle
          notificationsEnabled={notificationsEnabled}
          notificationsSupported={notificationsSupported}
          onToggleNotifications={toggleNotifications}
        />

        {/* Feature #570: Page-level tab navigation */}
        <div className="border-b border-border mb-6 mt-4">
          <nav className="flex gap-1 overflow-x-auto">
            {([
              { id: 'overview' as PageSection, label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
              { id: 'execution' as PageSection, label: 'Execution', icon: <Play className="h-4 w-4" />, badge: currentRun ? 1 : 0 },
              { id: 'configuration' as PageSection, label: 'Configuration', icon: <Settings className="h-4 w-4" /> },
              { id: 'history' as PageSection, label: 'History', icon: <History className="h-4 w-4" />, badge: runs.length },
            ]).map(tab => (
              <button
                key={tab.id}
                onClick={() => setPageSection(tab.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
                  pageSection === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-muted">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Feature #570: Overview Section */}
        {pageSection === 'overview' && (
          <>
            {/* Feature #551: Test Health Score with weighted breakdown */}
            {runs.length > 0 && (() => {
              const healthScore = computeTestHealthScore(runs);
              return (
                <div className="mb-4">
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

            {/* Test Details Card */}
            <div className="mt-6">
              <TestDetailsCard
                test={test}
                suiteName={suite?.name}
                formatDate={formatDate}
              />
            </div>
          </>
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

        {/* Feature #570: Configuration Section */}
        {pageSection === 'configuration' && (
          <>
            <div className="grid gap-6 lg:grid-cols-2">
              <TestDetailsCard
                test={test}
                suiteName={suite?.name}
                formatDate={formatDate}
              />

              <div className="rounded-lg border border-border bg-card p-6">
                {/* Sub-tab Header for steps/code/baseline/k6script */}
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
                        Baseline
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
                        K6 Script
                      </button>
                    )}
                  </div>
                  {canEdit && activeTab === 'steps' && !['visual_regression', 'lighthouse', 'accessibility'].includes(test?.test_type || '') && (
                    <button
                      onClick={() => setShowAddStepModal(true)}
                      className="text-sm text-primary hover:underline"
                    >
                      + Add Step
                    </button>
                  )}
                </div>

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
          </>
        )}

        {/* Add Step Modal - always available from any section */}
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

        {/* Feature #570: Execution Section */}
        {pageSection === 'execution' && currentRun && (
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
        {pageSection === 'execution' && !currentRun && (
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <p className="text-muted-foreground">No active run. Click &ldquo;Run Test&rdquo; to start a new execution.</p>
          </div>
        )}

        {/* Feature #570: History Section */}
        {pageSection === 'history' && (
          <>
            <FlakinessPanel
              isLoading={isLoadingFlakinessTrend}
              flakinessTrend={flakinessTrend}
              runs={runs}
              showSection={showFlakinessTrendSection}
              onHideSection={() => setShowFlakinessTrendSection(false)}
              onRefresh={fetchFlakinessTrend}
            />

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
          </>
        )}

        {/* K6 Run Comparison Modal - always available */}
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
