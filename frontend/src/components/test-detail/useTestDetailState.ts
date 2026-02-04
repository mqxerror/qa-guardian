/**
 * Feature #48: useTestDetailState - Custom hook for TestDetailPage state management
 * Consolidates 122+ useState hooks from TestDetailPage.tsx into organized groups
 */

import { useState, useCallback } from 'react';
import { TestRunType, TestType, FlakinessTrend } from './types';
import { TestExplanation } from './modals/AIExplainModal';
import { K6CompareResults } from './K6CompareModal';

// ============================================================================
// Type Definitions (only for types not defined elsewhere)
// ============================================================================

export interface TestSuite {
  id: string;
  name: string;
  project_id: string;
  default_browser?: string;
}

export interface Project {
  id: string;
  name: string;
}

export interface LiveProgress {
  completedTests: number;
  totalTests: number;
  currentTest?: string;
  currentStep?: {
    index: number;
    total: number;
    action?: string;
  };
  k6Metrics?: {
    phase?: string;
    progress: number;
    currentVUs?: number;
    totalRequests?: number;
    requestsPerSecond?: number;
    avgResponseTime?: number;
    errorRate?: number;
    p50ResponseTime?: number;
    p95ResponseTime?: number;
    p99ResponseTime?: number;
  };
}

export interface ConsoleLogEntry {
  level: string;
  message: string;
  timestamp: number;
}

export interface BaselineData {
  hasBaseline: boolean;
  image?: string;
  createdAt?: string;
  size?: number;
  approvedBy?: string;
  approvedByUserId?: string;
  approvedAt?: string;
  sourceRunId?: string;
}

export interface BaselineHistoryEntry {
  id: string;
  testId: string;
  viewportId: string;
  version: number;
  approvedBy: string;
  approvedByUserId: string;
  approvedAt: string;
  sourceRunId?: string;
  filename: string;
}

export interface MergeableBranch {
  branch: string;
  hasBaseline: boolean;
  lastUpdated?: string;
  approvedBy?: string;
}

export interface RejectionStatus {
  hasRejection: boolean;
  rejectedBy?: string;
  rejectedAt?: string;
  reason?: string;
}

// Re-export imported types for convenience
export type { TestExplanation, FlakinessTrend, K6CompareResults };

// ============================================================================
// Core Test State Hook
// ============================================================================

export function useCoreTestState() {
  // Basic test data
  const [test, setTest] = useState<TestType | null>(null);
  const [suite, setSuite] = useState<TestSuite | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Run state
  const [currentRun, setCurrentRun] = useState<TestRunType | null>(null);
  const [runs, setRuns] = useState<TestRunType[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isCancellingRun, setIsCancellingRun] = useState(false);
  const [runError, setRunError] = useState('');

  // Live execution state
  const [liveProgress, setLiveProgress] = useState<LiveProgress | null>(null);
  const [liveScreenshot, setLiveScreenshot] = useState<string | null>(null);
  const [liveConsoleLogs, setLiveConsoleLogs] = useState<ConsoleLogEntry[]>([]);

  const resetLiveState = useCallback(() => {
    setLiveProgress(null);
    setLiveScreenshot(null);
    setLiveConsoleLogs([]);
  }, []);

  return {
    // Test data
    test, setTest,
    suite, setSuite,
    project, setProject,
    isLoading, setIsLoading,
    error, setError,
    // Run state
    currentRun, setCurrentRun,
    runs, setRuns,
    isRunning, setIsRunning,
    isCancellingRun, setIsCancellingRun,
    runError, setRunError,
    // Live execution
    liveProgress, setLiveProgress,
    liveScreenshot, setLiveScreenshot,
    liveConsoleLogs, setLiveConsoleLogs,
    resetLiveState,
  };
}

// ============================================================================
// Modal State Hook
// ============================================================================

export function useModalState() {
  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState('');

  // Approve baseline modal
  const [showApproveBaselineModal, setShowApproveBaselineModal] = useState(false);
  const [approvingBaseline, setApprovingBaseline] = useState(false);
  const [approveBaselineRunId, setApproveBaselineRunId] = useState<string | null>(null);
  const [approveBaselineError, setApproveBaselineError] = useState('');

  // Reject changes modal
  const [showRejectChangesModal, setShowRejectChangesModal] = useState(false);
  const [rejectingChanges, setRejectingChanges] = useState(false);
  const [rejectChangesRunId, setRejectChangesRunId] = useState<string | null>(null);
  const [rejectChangesError, setRejectChangesError] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  // Restore baseline modal
  const [showRestoreBaselineModal, setShowRestoreBaselineModal] = useState(false);
  const [restoreHistoryEntry, setRestoreHistoryEntry] = useState<{ id: string; version: number } | null>(null);
  const [restoringBaseline, setRestoringBaseline] = useState(false);
  const [restoreBaselineError, setRestoreBaselineError] = useState('');

  // Merge baseline modal
  const [showMergeBaselineModal, setShowMergeBaselineModal] = useState(false);
  const [selectedMergeBranch, setSelectedMergeBranch] = useState<string | null>(null);
  const [isMergingBaseline, setIsMergingBaseline] = useState(false);
  const [mergeBaselineError, setMergeBaselineError] = useState('');

  // Quick schedule modal
  const [showQuickScheduleModal, setShowQuickScheduleModal] = useState(false);
  const [isCreatingSchedule, setIsCreatingSchedule] = useState(false);
  const [quickScheduleError, setQuickScheduleError] = useState('');

  // Add step modal
  const [showAddStepModal, setShowAddStepModal] = useState(false);

  // Explain modal
  const [showExplainModal, setShowExplainModal] = useState(false);
  const [testExplanation, setTestExplanation] = useState<TestExplanation | null>(null);
  const [isExplainingTest, setIsExplainingTest] = useState(false);

  // Unsaved changes modal
  const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);

  // K6 compare modal
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [compareResults, setCompareResults] = useState<K6CompareResults | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  const resetDeleteModal = useCallback(() => {
    setShowDeleteModal(false);
    setIsDeleting(false);
    setDeleteError('');
  }, []);

  const resetEditModal = useCallback(() => {
    setShowEditModal(false);
    setEditName('');
    setEditDescription('');
    setIsEditing(false);
    setEditError('');
  }, []);

  return {
    // Delete
    showDeleteModal, setShowDeleteModal,
    isDeleting, setIsDeleting,
    deleteError, setDeleteError,
    resetDeleteModal,
    // Edit
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
    // K6 compare
    showCompareModal, setShowCompareModal,
    compareResults, setCompareResults,
    isComparing, setIsComparing,
  };
}

// ============================================================================
// Visual Testing State Hook
// ============================================================================

export function useVisualTestingState() {
  // Baseline data
  const [baselineData, setBaselineData] = useState<BaselineData | null>(null);
  const [loadingBaseline, setLoadingBaseline] = useState(false);

  // Baseline history
  const [baselineHistory, setBaselineHistory] = useState<BaselineHistoryEntry[]>([]);
  const [loadingBaselineHistory, setLoadingBaselineHistory] = useState(false);
  const [selectedHistoryVersion, setSelectedHistoryVersion] = useState<string | null>(null);
  const [historyVersionImage, setHistoryVersionImage] = useState<string | null>(null);
  const [loadingHistoryImage, setLoadingHistoryImage] = useState(false);

  // Branch management
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [availableBranches, setAvailableBranches] = useState<string[]>(['main']);
  const [loadingBranches, setLoadingBranches] = useState(false);

  // Mergeable branches
  const [mergeableBranches, setMergeableBranches] = useState<MergeableBranch[]>([]);
  const [loadingMergeableBranches, setLoadingMergeableBranches] = useState(false);

  // Rejection status
  const [rejectionStatus, setRejectionStatus] = useState<RejectionStatus | null>(null);

  // Comparison view
  const [comparisonViewMode, setComparisonViewMode] = useState<'side-by-side' | 'slider' | 'onion-skin' | 'diff' | 'diff-overlay'>('side-by-side');
  const [sliderPosition, setSliderPosition] = useState(50);
  const [onionSkinOpacity, setOnionSkinOpacity] = useState(50);
  const [diffOverlayOpacity, setDiffOverlayOpacity] = useState(50);
  const [imageZoomLevel, setImageZoomLevel] = useState<'fit' | '100' | '50' | '200'>('fit');

  // Lightbox
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [lightboxZoom, setLightboxZoom] = useState(1);
  const [lightboxPan, setLightboxPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const resetLightbox = useCallback(() => {
    setLightboxImage(null);
    setLightboxZoom(1);
    setLightboxPan({ x: 0, y: 0 });
    setIsDragging(false);
  }, []);

  return {
    // Baseline data
    baselineData, setBaselineData,
    loadingBaseline, setLoadingBaseline,
    // Baseline history
    baselineHistory, setBaselineHistory,
    loadingBaselineHistory, setLoadingBaselineHistory,
    selectedHistoryVersion, setSelectedHistoryVersion,
    historyVersionImage, setHistoryVersionImage,
    loadingHistoryImage, setLoadingHistoryImage,
    // Branch management
    selectedBranch, setSelectedBranch,
    availableBranches, setAvailableBranches,
    loadingBranches, setLoadingBranches,
    // Mergeable branches
    mergeableBranches, setMergeableBranches,
    loadingMergeableBranches, setLoadingMergeableBranches,
    // Rejection status
    rejectionStatus, setRejectionStatus,
    // Comparison view
    comparisonViewMode, setComparisonViewMode,
    sliderPosition, setSliderPosition,
    onionSkinOpacity, setOnionSkinOpacity,
    diffOverlayOpacity, setDiffOverlayOpacity,
    imageZoomLevel, setImageZoomLevel,
    // Lightbox
    lightboxImage, setLightboxImage,
    lightboxZoom, setLightboxZoom,
    lightboxPan, setLightboxPan,
    isDragging, setIsDragging,
    dragStart, setDragStart,
    resetLightbox,
  };
}

// ============================================================================
// UI State Hook
// ============================================================================

export function useUIState() {
  // Tab state
  const [activeTab, setActiveTab] = useState<'steps' | 'code' | 'baseline' | 'k6script'>('steps');

  // Flakiness trend
  const [flakinessTrend, setFlakinessTrend] = useState<FlakinessTrend | null>(null);
  const [isLoadingFlakinessTrend, setIsLoadingFlakinessTrend] = useState(false);
  const [showFlakinessTrendSection, setShowFlakinessTrendSection] = useState(true);

  // Dirty state / unsaved changes
  const [isDirty, setIsDirty] = useState(false);

  // Artifacts download
  const [isDownloadingArtifacts, setIsDownloadingArtifacts] = useState(false);

  // Duplicate
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [duplicateError, setDuplicateError] = useState('');

  // K6 script editing
  const [k6Script, setK6Script] = useState('');
  const [isEditingK6Script, setIsEditingK6Script] = useState(false);
  const [isSavingK6Script, setIsSavingK6Script] = useState(false);
  const [showK6Templates, setShowK6Templates] = useState(false);
  const [foldedRegions, setFoldedRegions] = useState<Set<number>>(new Set());

  // Code editing
  const [isEditingCode, setIsEditingCode] = useState(false);
  const [editedCode, setEditedCode] = useState('');
  const [isSavingCode, setIsSavingCode] = useState(false);
  const [codeError, setCodeError] = useState('');

  // Run filtering/sorting
  const [sortBy, setSortBy] = useState<'date' | 'duration'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedRunsForCompare, setSelectedRunsForCompare] = useState<string[]>([]);

  // Accessibility filter state
  const [a11ySeverityFilter, setA11ySeverityFilter] = useState<{ [key: string]: 'all' | 'critical' | 'serious' | 'moderate' | 'minor' }>({});
  const [a11yCategoryFilter, setA11yCategoryFilter] = useState<{ [key: string]: 'all' | 'color' | 'images' | 'forms' | 'navigation' | 'structure' | 'aria' }>({});
  const [a11ySearchQuery, setA11ySearchQuery] = useState<{ [key: string]: string }>({});

  return {
    // Tab state
    activeTab, setActiveTab,
    // Flakiness trend
    flakinessTrend, setFlakinessTrend,
    isLoadingFlakinessTrend, setIsLoadingFlakinessTrend,
    showFlakinessTrendSection, setShowFlakinessTrendSection,
    // Dirty state
    isDirty, setIsDirty,
    // Artifacts
    isDownloadingArtifacts, setIsDownloadingArtifacts,
    // Duplicate
    isDuplicating, setIsDuplicating,
    duplicateError, setDuplicateError,
    // K6 script
    k6Script, setK6Script,
    isEditingK6Script, setIsEditingK6Script,
    isSavingK6Script, setIsSavingK6Script,
    showK6Templates, setShowK6Templates,
    foldedRegions, setFoldedRegions,
    // Code editing
    isEditingCode, setIsEditingCode,
    editedCode, setEditedCode,
    isSavingCode, setIsSavingCode,
    codeError, setCodeError,
    // Run filtering/sorting
    sortBy, setSortBy,
    sortOrder, setSortOrder,
    selectedRunsForCompare, setSelectedRunsForCompare,
    // Accessibility filters
    a11ySeverityFilter, setA11ySeverityFilter,
    a11yCategoryFilter, setA11yCategoryFilter,
    a11ySearchQuery, setA11ySearchQuery,
  };
}

// ============================================================================
// Step Management State Hook
// ============================================================================

export function useStepManagementState() {
  // Drag and drop
  const [draggedStepIndex, setDraggedStepIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isSavingStepOrder, setIsSavingStepOrder] = useState(false);
  const [hasReorderedSteps, setHasReorderedSteps] = useState(false);

  // Add step form
  const [newStepAction, setNewStepAction] = useState('navigate');
  const [newStepSelector, setNewStepSelector] = useState('');
  const [newStepValue, setNewStepValue] = useState('');
  const [isAddingStep, setIsAddingStep] = useState(false);
  const [addStepError, setAddStepError] = useState('');

  // Visual checkpoint options
  const [newStepCheckpointName, setNewStepCheckpointName] = useState('');
  const [newStepCheckpointThreshold, setNewStepCheckpointThreshold] = useState('0.1');

  // Accessibility check options
  const [newStepA11yWcagLevel, setNewStepA11yWcagLevel] = useState<'A' | 'AA' | 'AAA'>('AA');
  const [newStepA11yFailOnAny, setNewStepA11yFailOnAny] = useState(false);
  const [newStepA11yFailOnCritical, setNewStepA11yFailOnCritical] = useState(true);
  const [newStepA11yThreshold, setNewStepA11yThreshold] = useState('0');

  // Autocomplete
  const [selectorAutocomplete, setSelectorAutocomplete] = useState<string | null>(null);
  const [valueAutocomplete, setValueAutocomplete] = useState<string | null>(null);
  const [showSelectorAutocomplete, setShowSelectorAutocomplete] = useState(false);
  const [showValueAutocomplete, setShowValueAutocomplete] = useState(false);

  const resetAddStepForm = useCallback(() => {
    setNewStepAction('navigate');
    setNewStepSelector('');
    setNewStepValue('');
    setIsAddingStep(false);
    setAddStepError('');
    setNewStepCheckpointName('');
    setNewStepCheckpointThreshold('0.1');
    setNewStepA11yWcagLevel('AA');
    setNewStepA11yFailOnAny(false);
    setNewStepA11yFailOnCritical(true);
    setNewStepA11yThreshold('0');
  }, []);

  return {
    // Drag and drop
    draggedStepIndex, setDraggedStepIndex,
    dragOverIndex, setDragOverIndex,
    isSavingStepOrder, setIsSavingStepOrder,
    hasReorderedSteps, setHasReorderedSteps,
    // Add step form
    newStepAction, setNewStepAction,
    newStepSelector, setNewStepSelector,
    newStepValue, setNewStepValue,
    isAddingStep, setIsAddingStep,
    addStepError, setAddStepError,
    // Visual checkpoint
    newStepCheckpointName, setNewStepCheckpointName,
    newStepCheckpointThreshold, setNewStepCheckpointThreshold,
    // Accessibility check
    newStepA11yWcagLevel, setNewStepA11yWcagLevel,
    newStepA11yFailOnAny, setNewStepA11yFailOnAny,
    newStepA11yFailOnCritical, setNewStepA11yFailOnCritical,
    newStepA11yThreshold, setNewStepA11yThreshold,
    // Autocomplete
    selectorAutocomplete, setSelectorAutocomplete,
    valueAutocomplete, setValueAutocomplete,
    showSelectorAutocomplete, setShowSelectorAutocomplete,
    showValueAutocomplete, setShowValueAutocomplete,
    // Reset
    resetAddStepForm,
  };
}

// ============================================================================
// Combined State Hook (for gradual migration)
// ============================================================================

/**
 * Combined hook that returns all state from the individual hooks.
 * Use this for gradual migration from the monolithic TestDetailPage.
 */
export function useTestDetailState() {
  const coreState = useCoreTestState();
  const modalState = useModalState();
  const visualState = useVisualTestingState();
  const uiState = useUIState();
  const stepState = useStepManagementState();

  return {
    ...coreState,
    ...modalState,
    ...visualState,
    ...uiState,
    ...stepState,
  };
}

export type TestDetailState = ReturnType<typeof useTestDetailState>;
