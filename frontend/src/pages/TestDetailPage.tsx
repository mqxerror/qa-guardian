// TestDetailPage - Extracted from App.tsx
// Feature #1441: Split App.tsx into logical modules
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuthStore } from '../stores/authStore';
import { useTimezoneStore } from '../stores/timezoneStore';
import { useSocketStore } from '../stores/socketStore';
import { useNotificationStore } from '../stores/notificationStore';
import { useToastStore, toast } from '../stores/toastStore';
import { useVisualReviewStore } from '../stores/visualReviewStore';
import { getErrorMessage, isNetworkError, isOffline } from '../utils/errorHandling';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
// Feature #48: Import modular types and utilities
import {
  TestSuite,
  TestType,
  TestRunType,
  ConsoleLog,
  NetworkRequest,
  TestRunResult,
  StepResult,
  TestStatus,
  RunStatus,
  ResultStatus,
  StepStatus,
  TestCategory,
  TestStatusBadge,
  formatDuration,
  formatDateTime,
  formatRelativeTime,
  getStatusColorClass,
  getStatusBadgeClass,
  getStatusIcon,
  getStatusLabel,
  getTestTypeLabel,
  getTestTypeColorClass,
  getTestTypeBadgeClass,
  getTestTypeIcon,
  formatPercentage,
  formatBytes,
  getLighthouseScoreColorClass,
  getLighthouseScoreBadgeClass,
  getImpactColorClass,
  getImpactBadgeClass,
  calculatePassRate,
  truncateText,
  // Feature #48: Import extracted components
  VideoPlayer,
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
  TestExplanation,
  QuickScheduleModal,
  ViewCodeTab,
  K6ScriptTab,
  TestDetailsCard,
  TestStepsTab,
  BaselineTab,
  LiveExecutionPanel,
  TestHeader,
  TestResultCard,
  exportAccessibilityPDF,
  exportAccessibilityCSV,
  // Feature #48: Code generation utilities
  generatePlaywrightCode,
  generateK6Script,
  getK6Templates,
  highlightJavaScriptLine,
  detectFoldableRegions,
  isLineHidden,
  getFoldIcon,
  selectorPatterns,
  getValuePatterns,
  findSelectorAutocomplete,
  findValueAutocomplete,
  type FoldableRegion,
  type K6Template,
  // Feature #48: Custom hooks for state management
  useTestDetailState,
  useTestDetailActions,
  useBaselineHandlers,
  useStepHandlers,
  useTestCrudHandlers,
  useRunHandlers,
  useBaselineDataFetching,
} from '../components/test-detail';

// Removed inline type definitions - now imported from test-detail module (Feature #48)
// Removed VideoPlayer - now imported from test-detail module (Feature #48)

function TestDetailPage() {
  const { testId } = useParams<{ testId: string }>();
  const { token, user } = useAuthStore();
  const { formatDate, formatDateTime } = useTimezoneStore();
  const { socket, connect, joinRun, leaveRun, joinOrg } = useSocketStore();
  const { addNotification } = useNotificationStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [test, setTest] = useState<TestType | null>(null);
  const [suite, setSuite] = useState<TestSuite | null>(null);
  const [project, setProject] = useState<{ id: string; name: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState('');
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
  const [showAddStepModal, setShowAddStepModal] = useState(false);
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
  const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
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
  // Feature #323: K6 script code folding state
  const [foldedRegions, setFoldedRegions] = useState<Set<number>>(new Set());

  // Feature #48: Toggle fold state for a line (uses state)
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

  // Feature #48: Wrappers for code folding functions that use state
  const getFoldIconForLine = useCallback((lineNumber: number, regions: FoldableRegion[]) => {
    return getFoldIcon(lineNumber, regions, foldedRegions);
  }, [foldedRegions]);

  const isLineHiddenForLine = useCallback((lineNumber: number, regions: FoldableRegion[]) => {
    return isLineHidden(lineNumber, regions, foldedRegions);
  }, [foldedRegions]);
  const [baselineData, setBaselineData] = useState<{hasBaseline: boolean; image?: string; createdAt?: string; size?: number; approvedBy?: string; approvedByUserId?: string; approvedAt?: string; sourceRunId?: string} | null>(null);
  const [loadingBaseline, setLoadingBaseline] = useState(false);

  // Baseline approval state
  const [showApproveBaselineModal, setShowApproveBaselineModal] = useState(false);
  const [approvingBaseline, setApprovingBaseline] = useState(false);
  const [approveBaselineRunId, setApproveBaselineRunId] = useState<string | null>(null);
  const [approveBaselineError, setApproveBaselineError] = useState('');

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
  // Baseline restore state
  const [showRestoreBaselineModal, setShowRestoreBaselineModal] = useState(false);
  const [restoreHistoryEntry, setRestoreHistoryEntry] = useState<{id: string; version: number} | null>(null);
  const [restoringBaseline, setRestoringBaseline] = useState(false);
  const [restoreBaselineError, setRestoreBaselineError] = useState('');

  // Visual regression rejection state
  const [showRejectChangesModal, setShowRejectChangesModal] = useState(false);
  const [rejectingChanges, setRejectingChanges] = useState(false);
  const [rejectChangesRunId, setRejectChangesRunId] = useState<string | null>(null);
  const [rejectChangesError, setRejectChangesError] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
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
  const [showMergeBaselineModal, setShowMergeBaselineModal] = useState(false);
  const [selectedMergeBranch, setSelectedMergeBranch] = useState<string | null>(null);
  const [isMergingBaseline, setIsMergingBaseline] = useState(false);
  const [mergeBaselineError, setMergeBaselineError] = useState('');

  // Quick schedule modal state - Feature #48: State moved to QuickScheduleModal component
  const [showQuickScheduleModal, setShowQuickScheduleModal] = useState(false);
  const [isCreatingSchedule, setIsCreatingSchedule] = useState(false);
  const [quickScheduleError, setQuickScheduleError] = useState('');

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

  // AI Explanation state - Feature #48: Use imported TestExplanation type
  const [showExplainModal, setShowExplainModal] = useState(false);
  const [testExplanation, setTestExplanation] = useState<TestExplanation | null>(null);
  const [isExplainingTest, setIsExplainingTest] = useState(false);

  // Feature #48: Wrapper for generatePlaywrightCode that uses test name from state
  const generatePlaywrightCodeForTest = useCallback((steps: TestType['steps'] | undefined) => {
    return generatePlaywrightCode(steps || [], test?.name || 'Untitled Test');
  }, [test?.name]);

  // Feature #48: Wrapper for generateK6Script that uses test from state
  const generateK6ScriptForTest = useCallback(() => {
    return generateK6Script(test);
  }, [test]);

  // Feature #48: Syntax highlighting wrapper using imported utility
  const highlightJavaScript = useCallback((code: string): JSX.Element[] => {
    const lines = code.split('\n');
    return lines.map((line, lineIndex) => {
      const highlighted = highlightJavaScriptLine(line);
      return (
        <div key={lineIndex} className="leading-6 flex">
          <span className="select-none text-gray-500 pr-4 text-right" style={{ minWidth: '3rem' }}>
            {lineIndex + 1}
          </span>
          <span dangerouslySetInnerHTML={{ __html: highlighted || '&nbsp;' }} />
        </div>
      );
    });
  }, []);

  // Feature #48: K6 script templates from utility
  const k6Templates = useMemo(() => getK6Templates(test?.target_url || ''), [test?.target_url]);

  // Initialize K6 script when tab is opened for load tests
  useEffect(() => {
    if (test?.test_type === 'load' && activeTab === 'k6script' && !k6Script) {
      setK6Script(test?.k6_script || generateK6ScriptForTest());
    }
  }, [test?.test_type, activeTab, test?.k6_script, generateK6ScriptForTest]);

  // Feature #48: Use extracted step handlers hook
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

  // Inline step handlers removed - now using useStepHandlers hook (Feature #48)
  // Handlers: handleStepDragStart, handleStepDragEnd, handleStepDragOver, handleStepDrop,
  //           handleSaveStepOrder, handleSaveCode, handleRevertToSteps, handleStartEditCode,
  //           handleCancelEditCode, handleExplainTest

  // Download all artifacts for a test run (with authentication)
  const handleDownloadAllArtifacts = async (runId: string) => {
    if (isDownloadingArtifacts) return;
    setIsDownloadingArtifacts(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || 'https://qa.pixelcraftedmedia.com'}/api/v1/runs/${runId}/artifacts/download`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Download failed' }));
        throw new Error(errorData.message || 'Failed to download artifacts');
      }

      // Get the filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="?([^"]+)"?/);
      const filename = filenameMatch ? filenameMatch[1] : `run-${runId}-artifacts.zip`;

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Artifacts downloaded successfully!');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to download artifacts';
      toast.error(message);
    } finally {
      setIsDownloadingArtifacts(false);
    }
  };

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

  // K6 run comparison state (Feature #564) - Feature #48: Use imported type
  const [selectedRunsForCompare, setSelectedRunsForCompare] = useState<string[]>([]);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [compareResults, setCompareResults] = useState<K6CompareResults | null>(null);
  const [isComparing, setIsComparing] = useState(false);

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

  // Compare two K6 runs (Feature #564)
  const handleCompareRuns = async () => {
    if (selectedRunsForCompare.length !== 2) return;

    setIsComparing(true);
    setCompareResults(null);

    try {
      const [baseRunId, compareRunId] = selectedRunsForCompare;
      const response = await fetch(
        `/api/v1/runs/compare?baseRunId=${baseRunId}&compareRunId=${compareRunId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to compare runs');
      }

      const data = await response.json();
      // API returns { comparison: { ... } }, so we extract the comparison object
      setCompareResults(data.comparison || data);
      setShowCompareModal(true);
    } catch (error) {
      console.error('Error comparing runs:', error);
      alert('Failed to compare runs. Make sure both runs have K6 load test results.');
    } finally {
      setIsComparing(false);
    }
  };

  const [newStepAction, setNewStepAction] = useState('navigate');
  const [newStepSelector, setNewStepSelector] = useState('');
  const [newStepValue, setNewStepValue] = useState('');
  // Feature #48: isAddingStep, addStepError moved earlier (before useStepHandlers hook)
  const [newStepCheckpointName, setNewStepCheckpointName] = useState('');
  const [newStepCheckpointThreshold, setNewStepCheckpointThreshold] = useState('0.1');
  // Accessibility check step configuration
  const [newStepA11yWcagLevel, setNewStepA11yWcagLevel] = useState<'A' | 'AA' | 'AAA'>('AA');
  const [newStepA11yFailOnAny, setNewStepA11yFailOnAny] = useState(false);
  const [newStepA11yFailOnCritical, setNewStepA11yFailOnCritical] = useState(true);
  const [newStepA11yThreshold, setNewStepA11yThreshold] = useState('0'); // 0 = any violation fails

  // Feature #1236: AI Copilot autocomplete state for test steps
  const [selectorAutocomplete, setSelectorAutocomplete] = useState<string | null>(null);
  const [valueAutocomplete, setValueAutocomplete] = useState<string | null>(null);
  const [showSelectorAutocomplete, setShowSelectorAutocomplete] = useState(false);
  const [showValueAutocomplete, setShowValueAutocomplete] = useState(false);

  // Feature #48: Autocomplete using imported utilities
  const baseUrl = test?.target_url || '';

  // Feature #1236: Generate autocomplete suggestion for selector using imported utility
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

  // Feature #1236: Generate autocomplete suggestion for value using imported utility
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

  // Feature #1236: Handle Tab key to accept autocomplete
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

  // Feature #48: Use extracted CRUD handlers hook
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

  // Feature #48: Use extracted baseline handlers hook
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

  // Fetch runs helper (needed by run handlers)
  const fetchRuns = async () => {
    try {
      const response = await fetch(`/api/v1/tests/${testId}/runs`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setRuns(data.runs);
      }
    } catch {
      // Ignore errors for runs fetch
    }
  };

  // Feature #48: Use extracted run handlers hook
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
    fetchRuns,
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

  // Handle creating a quick schedule for this test
  // Feature #48: Updated to accept data from QuickScheduleModal component
  const handleCreateQuickScheduleFromModal = async (data: {
    name: string;
    type: 'recurring' | 'one-time';
    cron: string;
    runAt: string;
    timezone: string;
  }) => {
    if (!test || !suite) return;

    setIsCreatingSchedule(true);
    setQuickScheduleError('');

    try {
      const scheduleData: Record<string, unknown> = {
        name: data.name || `${test.name} Schedule`,
        description: `Automated schedule for test: ${test.name}`,
        test_suite_id: suite.id,
        tests: [test.id],
        browsers: [suite.default_browser || 'chromium'],
        enabled: true,
        timezone: data.timezone,
        notify_on_failure: true,
      };

      if (data.type === 'one-time') {
        scheduleData.run_at = data.runAt;
      } else {
        scheduleData.cron_expression = data.cron;
      }

      const response = await fetch('/api/v1/schedules', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(scheduleData),
      });

      if (!response.ok) {
        const responseData = await response.json();
        throw new Error(responseData.message || 'Failed to create schedule');
      }

      // Success - close modal and show notification
      setShowQuickScheduleModal(false);
      addNotification({
        type: 'success',
        title: 'Schedule Created',
        message: `Schedule "${data.name || test.name + ' Schedule'}" created successfully`,
      });
    } catch (err) {
      setQuickScheduleError(err instanceof Error ? err.message : 'Failed to create schedule');
    } finally {
      setIsCreatingSchedule(false);
    }
  };

  // Feature #48: Inline baseline handlers removed - now using useBaselineHandlers hook
  // Handlers: handleApproveBaseline, handleRestoreBaseline, handleRejectChanges, handleMergeBaseline

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

  // Feature #48: handleRunTest removed - now using useRunHandlers hook

  // Feature #48: handleCancelRun removed - now using useRunHandlers hook

  // Feature #48: pollRunStatus and duplicate fetchRuns removed - now in useRunHandlers hook

  // Feature #1101: Fetch flakiness trend data
  const fetchFlakinessTrend = async () => {
    if (!testId || !token) return;
    setIsLoadingFlakinessTrend(true);
    try {
      const response = await fetch(`/api/v1/tests/${testId}/flakiness-trend`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setFlakinessTrend(data);
      }
    } catch (error) {
      console.error('Failed to fetch flakiness trend:', error);
    } finally {
      setIsLoadingFlakinessTrend(false);
    }
  };

  // Feature #1101: Fetch flakiness trend when test ID changes
  useEffect(() => {
    if (testId && token) {
      fetchFlakinessTrend();
    }
  }, [testId, token]);

  // Feature #48: handleAddStep moved to useStepHandlers hook
  // The hook now handles step creation, the component just needs to pass step data

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

  useEffect(() => {
    const fetchTest = async () => {
      try {
        const headers = { 'Authorization': `Bearer ${token}` };

        // Fetch test and runs in parallel (both only need testId)
        const [testResponse, runsResponse] = await Promise.all([
          fetch(`/api/v1/tests/${testId}`, { headers }),
          fetch(`/api/v1/tests/${testId}/runs`, { headers }),
        ]);

        if (!testResponse.ok) {
          setError('Test not found');
          return;
        }

        const [testData, runsData] = await Promise.all([
          testResponse.json(),
          runsResponse.ok ? runsResponse.json() : { runs: [] },
        ]);

        setTest(testData.test);
        if (runsData.runs) setRuns(runsData.runs);

        // Fetch suite and project in parallel (suite needs suite_id from test)
        if (testData.test.suite_id) {
          const suiteResponse = await fetch(`/api/v1/suites/${testData.test.suite_id}`, { headers });
          if (suiteResponse.ok) {
            const suiteData = await suiteResponse.json();
            setSuite(suiteData.suite);

            if (suiteData.suite.project_id) {
              const projectResponse = await fetch(`/api/v1/projects/${suiteData.suite.project_id}`, { headers });
              if (projectResponse.ok) {
                const projectData = await projectResponse.json();
                setProject(projectData.project);
              }
            }
          }
        }
      } catch (err) {
        setError('Failed to load test');
      } finally {
        setIsLoading(false);
      }
    };
    fetchTest();
  }, [testId, token]);

  // Feature #48: Baseline data fetching moved to useBaselineDataFetching hook
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
      console.log('[WebSocket] Received run-complete from org room:', data);

      // Avoid processing the same run twice (we receive from both run room and org room)
      if (processedRunsRef.current.has(data.runId)) {
        console.log('[WebSocket] Skipping duplicate notification for run:', data.runId);
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

      // Refresh runs list when a run completes (could be from another tab)
      fetch(`/api/v1/tests/${testId}/runs`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
        .then(res => res.json())
        .then(runsData => {
          if (runsData.runs) {
            setRuns(runsData.runs);
          }
        })
        .catch(err => console.error('Failed to refresh runs:', err));
    };

    socket.on('run-complete', handleOrgRunComplete);

    return () => {
      socket.off('run-complete', handleOrgRunComplete);
    };
  }, [socket, testId, token, addNotification]);

  if (isLoading) {
    return (
      <Layout>
        <div className="p-8">
          <p className="text-muted-foreground">Loading test...</p>
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
          onSubmit={handleCreateQuickScheduleFromModal}
        />

        {/* Approve Baseline Confirmation Modal - Feature #48: Using extracted component */}
        {showApproveBaselineModal && (
          <ApproveBaselineModal
            testName={test?.name || ''}
            approvingBaseline={approvingBaseline}
            approveBaselineError={approveBaselineError}
            currentRun={currentRun as any}
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

        {/* Unsaved Changes Warning Modal */}
        {showUnsavedChangesModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
            <div role="alertdialog" aria-modal="true" aria-labelledby="unsaved-changes-title" aria-describedby="unsaved-changes-desc" className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-100">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 id="unsaved-changes-title" className="text-lg font-semibold text-foreground">Unsaved Changes</h3>
                  <p id="unsaved-changes-desc" className="mt-2 text-sm text-muted-foreground">
                    You have unsaved changes. Are you sure you want to leave? Your changes will be lost.
                  </p>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCancelNavigation}
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmNavigation}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  Discard Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Test Details - Feature #48: Using extracted TestDetailsCard component */}
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <TestDetailsCard
            test={test as any}
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

        {/* Current Run Status */}
        {currentRun && (
          <div className="mt-8 rounded-lg border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Current Run</h2>
              {/* Download All Artifacts Button */}
              {currentRun.results && currentRun.results.length > 0 &&
               (currentRun.status === 'passed' || currentRun.status === 'failed' || currentRun.status === 'error') && (
                <button
                  onClick={() => handleDownloadAllArtifacts(currentRun.id)}
                  disabled={isDownloadingArtifacts}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                >
                  {isDownloadingArtifacts ? (
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  )}
                  {isDownloadingArtifacts ? 'Downloading...' : 'Download All Artifacts'}
                </button>
              )}
            </div>
            <div>
              <div className="flex items-center gap-4">
                {/* Feature #1979: Added 'warning' status styling for accessibility tests */}
                <span className={`rounded-full px-3 py-1 text-sm font-medium ${
                  currentRun.status === 'passed' ? 'bg-green-100 text-green-700' :
                  currentRun.status === 'failed' ? 'bg-red-100 text-red-700' :
                  currentRun.status === 'warning' ? 'bg-amber-100 text-amber-700' :
                  currentRun.status === 'running' ? 'bg-blue-100 text-blue-700' :
                  currentRun.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {currentRun.status}
                </span>
                {currentRun.duration_ms !== undefined && (
                  <span className="text-sm text-muted-foreground">
                    Duration: {currentRun.duration_ms}ms
                  </span>
                )}
              </div>

              {/* Live Execution Panel - Feature #48: Extracted to component */}
              <LiveExecutionPanel
                currentRun={currentRun as any}
                test={test}
                liveProgress={liveProgress}
                liveScreenshot={liveScreenshot}
                liveConsoleLogs={liveConsoleLogs}
                isCancellingRun={isCancellingRun}
                onCancelRun={handleCancelRun}
              />

              {/* Test Results - Feature #48: Extracted to TestResultCard component */}
              {currentRun.results && currentRun.results.length > 0 && (
                <div className="mt-4 space-y-4">
                  {currentRun.results.map((result) => (
                    <TestResultCard
                      key={result.test_id}
                      result={result as any}
                      testType={test?.test_type}
                      token={token || ''}
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
                      onApproveBaseline={(runId) => handleApproveBaseline(runId)}
                      onRejectChanges={(runId) => handleRejectChanges(runId)}
                      a11ySeverityFilter={a11ySeverityFilter as any}
                      setA11ySeverityFilter={setA11ySeverityFilter as any}
                      a11yCategoryFilter={a11yCategoryFilter as any}
                      setA11yCategoryFilter={setA11yCategoryFilter as any}
                      a11ySearchQuery={a11ySearchQuery as any}
                      setA11ySearchQuery={setA11ySearchQuery as any}
                      formatDateTime={formatDateTime}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
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
