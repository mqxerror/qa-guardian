/**
 * Feature #48: useTestDetailState - Custom hook for TestDetailPage state management
 * Consolidates 122+ useState hooks from TestDetailPage.tsx into organized groups
 */

import { useState, useCallback, useReducer } from 'react';
// Feature #566: Import canonical LiveProgress & ConsoleLogEntry from types.ts
import { TestRunType, TestType, FlakinessTrend, LiveProgress, ConsoleLogEntry } from './types';
export type { LiveProgress, ConsoleLogEntry };
import { TestExplanation } from './modals/AIExplainModal';
import { K6CompareResults } from './K6CompareModal';

// ============================================================================
// Type Definitions (only for types not defined elsewhere)
// ============================================================================

export interface TestSuite {
  id: string;
  name: string;
  project_id?: string;
  default_browser?: string;
}

export interface Project {
  id: string;
  name: string;
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
  updatedAt: string;
  approvedBy?: string;
  isNewer: boolean;
  hasBaseline: boolean;
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

/**
 * Feature #560: Modal visibility reducer
 * Consolidates 11 boolean useState(false) calls into a single useReducer
 */
type ModalVisibilityKey =
  | 'delete' | 'edit' | 'addStep' | 'unsavedChanges'
  | 'approveBaseline' | 'restoreBaseline' | 'rejectChanges'
  | 'mergeBaseline' | 'quickSchedule' | 'explain' | 'compare';

type ModalVisibilityState = Record<ModalVisibilityKey, boolean>;

type ModalVisibilityAction =
  | { type: 'OPEN'; key: ModalVisibilityKey }
  | { type: 'CLOSE'; key: ModalVisibilityKey }
  | { type: 'CLOSE_ALL' };

const initialModalVisibility: ModalVisibilityState = {
  delete: false, edit: false, addStep: false, unsavedChanges: false,
  approveBaseline: false, restoreBaseline: false, rejectChanges: false,
  mergeBaseline: false, quickSchedule: false, explain: false, compare: false,
};

function modalVisibilityReducer(
  state: ModalVisibilityState,
  action: ModalVisibilityAction,
): ModalVisibilityState {
  switch (action.type) {
    case 'OPEN':
      return { ...state, [action.key]: true };
    case 'CLOSE':
      return { ...state, [action.key]: false };
    case 'CLOSE_ALL':
      return { ...initialModalVisibility };
    default:
      return state;
  }
}

export function useModalState() {
  // Feature #560: Single reducer for all 11 modal visibility flags
  const [vis, dispatchModal] = useReducer(modalVisibilityReducer, initialModalVisibility);

  // Feature #565: Replaced makeModalSetter (had stale closure bug with [vis] dependency)
  // with direct dispatch calls. dispatchModal from useReducer is guaranteed stable by React,
  // so these callbacks have empty dependency arrays and never recreate.
  const setShowDeleteModal = useCallback((v: boolean) => dispatchModal({ type: v ? 'OPEN' : 'CLOSE', key: 'delete' }), []);
  const setShowEditModal = useCallback((v: boolean) => dispatchModal({ type: v ? 'OPEN' : 'CLOSE', key: 'edit' }), []);
  const setShowAddStepModal = useCallback((v: boolean) => dispatchModal({ type: v ? 'OPEN' : 'CLOSE', key: 'addStep' }), []);
  const setShowUnsavedChangesModal = useCallback((v: boolean) => dispatchModal({ type: v ? 'OPEN' : 'CLOSE', key: 'unsavedChanges' }), []);
  const setShowApproveBaselineModal = useCallback((v: boolean) => dispatchModal({ type: v ? 'OPEN' : 'CLOSE', key: 'approveBaseline' }), []);
  const setShowRestoreBaselineModal = useCallback((v: boolean) => dispatchModal({ type: v ? 'OPEN' : 'CLOSE', key: 'restoreBaseline' }), []);
  const setShowRejectChangesModal = useCallback((v: boolean) => dispatchModal({ type: v ? 'OPEN' : 'CLOSE', key: 'rejectChanges' }), []);
  const setShowMergeBaselineModal = useCallback((v: boolean) => dispatchModal({ type: v ? 'OPEN' : 'CLOSE', key: 'mergeBaseline' }), []);
  const setShowQuickScheduleModal = useCallback((v: boolean) => dispatchModal({ type: v ? 'OPEN' : 'CLOSE', key: 'quickSchedule' }), []);
  const setShowExplainModal = useCallback((v: boolean) => dispatchModal({ type: v ? 'OPEN' : 'CLOSE', key: 'explain' }), []);
  const setShowCompareModal = useCallback((v: boolean) => dispatchModal({ type: v ? 'OPEN' : 'CLOSE', key: 'compare' }), []);

  // Associated modal form/loading/error state (non-boolean, kept as individual useState)
  // Delete
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  // Edit
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState('');
  // Approve baseline
  const [approvingBaseline, setApprovingBaseline] = useState(false);
  const [approveBaselineRunId, setApproveBaselineRunId] = useState<string | null>(null);
  const [approveBaselineError, setApproveBaselineError] = useState('');
  // Reject changes
  const [rejectingChanges, setRejectingChanges] = useState(false);
  const [rejectChangesRunId, setRejectChangesRunId] = useState<string | null>(null);
  const [rejectChangesError, setRejectChangesError] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  // Restore baseline
  const [restoreHistoryEntry, setRestoreHistoryEntry] = useState<{ id: string; version: number } | null>(null);
  const [restoringBaseline, setRestoringBaseline] = useState(false);
  const [restoreBaselineError, setRestoreBaselineError] = useState('');
  // Merge baseline
  const [selectedMergeBranch, setSelectedMergeBranch] = useState<string | null>(null);
  const [isMergingBaseline, setIsMergingBaseline] = useState(false);
  const [mergeBaselineError, setMergeBaselineError] = useState('');
  // Quick schedule
  const [isCreatingSchedule, setIsCreatingSchedule] = useState(false);
  const [quickScheduleError, setQuickScheduleError] = useState('');
  // Explain
  const [testExplanation, setTestExplanation] = useState<TestExplanation | null>(null);
  const [isExplainingTest, setIsExplainingTest] = useState(false);
  // Unsaved changes
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  // K6 compare
  const [compareResults, setCompareResults] = useState<K6CompareResults | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  const resetDeleteModal = useCallback(() => {
    dispatchModal({ type: 'CLOSE', key: 'delete' });
    setIsDeleting(false);
    setDeleteError('');
  }, []);

  const resetEditModal = useCallback(() => {
    dispatchModal({ type: 'CLOSE', key: 'edit' });
    setEditName('');
    setEditDescription('');
    setIsEditing(false);
    setEditError('');
  }, []);

  // Feature #560: New convenience API for TestDetailPage (modals.*, openModal, closeModal)
  const openModal = useCallback(
    (key: ModalVisibilityKey) => dispatchModal({ type: 'OPEN', key }),
    [],
  );
  const closeModal = useCallback(
    (key: ModalVisibilityKey) => dispatchModal({ type: 'CLOSE', key }),
    [],
  );
  const closeAllModals = useCallback(
    () => dispatchModal({ type: 'CLOSE_ALL' }),
    [],
  );

  return {
    // Feature #560: New reducer-based API
    modals: vis,
    openModal,
    closeModal,
    closeAllModals,
    // Legacy compatible: individual boolean + setter pairs
    modalVisibility: vis,
    // Delete
    showDeleteModal: vis.delete, setShowDeleteModal,
    isDeleting, setIsDeleting,
    deleteError, setDeleteError,
    resetDeleteModal,
    // Edit
    showEditModal: vis.edit, setShowEditModal,
    editName, setEditName,
    editDescription, setEditDescription,
    isEditing, setIsEditing,
    editError, setEditError,
    resetEditModal,
    // Approve baseline
    showApproveBaselineModal: vis.approveBaseline, setShowApproveBaselineModal,
    approvingBaseline, setApprovingBaseline,
    approveBaselineRunId, setApproveBaselineRunId,
    approveBaselineError, setApproveBaselineError,
    // Reject changes
    showRejectChangesModal: vis.rejectChanges, setShowRejectChangesModal,
    rejectingChanges, setRejectingChanges,
    rejectChangesRunId, setRejectChangesRunId,
    rejectChangesError, setRejectChangesError,
    rejectionReason, setRejectionReason,
    // Restore baseline
    showRestoreBaselineModal: vis.restoreBaseline, setShowRestoreBaselineModal,
    restoreHistoryEntry, setRestoreHistoryEntry,
    restoringBaseline, setRestoringBaseline,
    restoreBaselineError, setRestoreBaselineError,
    // Merge baseline
    showMergeBaselineModal: vis.mergeBaseline, setShowMergeBaselineModal,
    selectedMergeBranch, setSelectedMergeBranch,
    isMergingBaseline, setIsMergingBaseline,
    mergeBaselineError, setMergeBaselineError,
    // Quick schedule
    showQuickScheduleModal: vis.quickSchedule, setShowQuickScheduleModal,
    isCreatingSchedule, setIsCreatingSchedule,
    quickScheduleError, setQuickScheduleError,
    // Add step
    showAddStepModal: vis.addStep, setShowAddStepModal,
    // Explain
    showExplainModal: vis.explain, setShowExplainModal,
    testExplanation, setTestExplanation,
    isExplainingTest, setIsExplainingTest,
    // Unsaved changes
    showUnsavedChangesModal: vis.unsavedChanges, setShowUnsavedChangesModal,
    pendingNavigation, setPendingNavigation,
    // K6 compare
    showCompareModal: vis.compare, setShowCompareModal,
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
