/**
 * useSuiteState Hook
 * Feature #50: Extract state management from TestSuitePage.tsx
 *
 * This hook manages the core state for the test suite detail page.
 */

import { useState, useCallback } from 'react';
import { TestSuite, TestType, SortField, SortDirection } from './types';

// Recording step type
export interface RecordingStep {
  action: string;
  selector?: string;
  selectorStrategies?: Array<{ strategy: string; selector: string; confidence: number }>;
  value?: string;
  url?: string;
  text?: string;
  optional?: boolean;
  optionalReason?: 'cookie_consent' | 'popup_dismiss' | 'notification_close' | 'user_marked';
}

// Parallelization plan types
export interface ParallelizationWorker {
  id: number;
  name: string;
  tests: Array<{ name: string; duration: number }>;
  totalDuration: number;
  utilizationPercent: number;
}

export interface ParallelizationPlan {
  totalTests: number;
  workers: ParallelizationWorker[];
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
}

// Review stats type
export interface ReviewStats {
  total_tests: number;
  ai_generated: number;
  pending_review: number;
  approved: number;
  rejected: number;
}

// Step template type
export interface StepTemplate {
  id: string;
  name: string;
  description?: string;
  steps: RecordingStep[];
  tags: string[];
  created_at: string;
}

// Live screenshot type
export interface LiveScreenshot {
  base64: string;
  testId: string;
  testName: string;
  stepIndex: number;
  stepAction: string;
  stepSelector?: string;
  timestamp: number;
}

export interface ScreenshotHistoryItem {
  base64: string;
  stepIndex: number;
  stepAction: string;
  timestamp: number;
}

/**
 * Hook that provides core suite state management
 */
export function useSuiteState() {
  // Core suite and test data
  const [suite, setSuite] = useState<(TestSuite & { project_id: string }) | null>(null);
  const [tests, setTests] = useState<TestType[]>([]);
  const [project, setProject] = useState<{ id: string; name: string; base_url?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Suite run state
  const [isRunningSuite, setIsRunningSuite] = useState(false);
  const [isCancellingSuite, setIsCancellingSuite] = useState(false);
  const [suiteRun, setSuiteRun] = useState<any>(null);
  const [suiteRunPolling, setSuiteRunPolling] = useState(false);

  // Search and sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Review state
  const [requireHumanReview, setRequireHumanReview] = useState(false);
  const [reviewStats, setReviewStats] = useState<ReviewStats | null>(null);
  const [showReviewPanel, setShowReviewPanel] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [selectedForReview, setSelectedForReview] = useState<Set<string>>(new Set());

  // Parallelization state
  const [showParallelization, setShowParallelization] = useState(false);
  const [isAnalyzingParallel, setIsAnalyzingParallel] = useState(false);
  const [parallelizationPlan, setParallelizationPlan] = useState<ParallelizationPlan | null>(null);

  // Accessibility filter state
  const [a11ySeverityFilter, setA11ySeverityFilter] = useState<Record<string, 'all' | 'critical' | 'serious' | 'moderate' | 'minor'>>({});
  const [a11yCategoryFilter, setA11yCategoryFilter] = useState<Record<string, 'all' | 'color' | 'images' | 'forms' | 'navigation' | 'structure' | 'aria'>>({});
  const [a11ySearchQuery, setA11ySearchQuery] = useState<Record<string, string>>({});

  // Quick actions state
  const [openActionsDropdown, setOpenActionsDropdown] = useState<string | null>(null);
  const [runningTestId, setRunningTestId] = useState<string | null>(null);

  // Live screenshot state
  const [liveScreenshot, setLiveScreenshot] = useState<LiveScreenshot | null>(null);
  const [screenshotHistory, setScreenshotHistory] = useState<ScreenshotHistoryItem[]>([]);
  const [expandedScreenshot, setExpandedScreenshot] = useState<string | null>(null);

  // Recording state
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [recordTargetUrl, setRecordTargetUrl] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSessionId, setRecordingSessionId] = useState<string | null>(null);
  const [recordedSteps, setRecordedSteps] = useState<RecordingStep[]>([]);
  const [recordingStatus, setRecordingStatus] = useState('');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [recordedTestName, setRecordedTestName] = useState('');
  const [recordedTestDescription, setRecordedTestDescription] = useState('');
  const [isSavingRecordedTest, setIsSavingRecordedTest] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingPopup, setRecordingPopup] = useState<Window | null>(null);
  const [recordingFrame, setRecordingFrame] = useState<string | null>(null);
  const [recordingCurrentUrl, setRecordingCurrentUrl] = useState('');
  const [recordingConnected, setRecordingConnected] = useState(false);
  const [clickRipple, setClickRipple] = useState<{ x: number; y: number; id: number } | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [reconnectFailed, setReconnectFailed] = useState(false);
  const [staleFrameWarning, setStaleFrameWarning] = useState<'none' | 'waiting' | 'unresponsive'>('none');
  const [showDebugOverlay, setShowDebugOverlay] = useState(false);
  const [debugCoords, setDebugCoords] = useState<{ cssX: number; cssY: number; vpX: number; vpY: number } | null>(null);

  // Template state
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [stepTemplates, setStepTemplates] = useState<StepTemplate[]>([]);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [insertTemplateForTest, setInsertTemplateForTest] = useState<string | null>(null);

  // Sort handler
  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  }, [sortField]);

  // Toggle test selection for batch review
  const toggleTestSelection = useCallback((testId: string) => {
    setSelectedForReview(prev => {
      const newSet = new Set(prev);
      if (newSet.has(testId)) {
        newSet.delete(testId);
      } else {
        newSet.add(testId);
      }
      return newSet;
    });
  }, []);

  // Toggle all tests selection
  const toggleAllTestsSelection = useCallback((testIds: string[]) => {
    setSelectedForReview(prev => {
      const allSelected = testIds.every(id => prev.has(id));
      if (allSelected) {
        return new Set();
      } else {
        return new Set(testIds);
      }
    });
  }, []);

  // Filter and sort tests
  const getFilteredAndSortedTests = useCallback(() => {
    const trimmedQuery = searchQuery.trim().toLowerCase();

    // Filter
    const filtered = tests.filter(test =>
      trimmedQuery === '' ||
      test.name.toLowerCase().includes(trimmedQuery) ||
      (test.description && test.description.toLowerCase().includes(trimmedQuery))
    );

    // Sort
    if (!sortField) return filtered;

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '');
          break;
        case 'last_run_at': {
          const aTime = a.last_run_at ? new Date(a.last_run_at).getTime() : 0;
          const bTime = b.last_run_at ? new Date(b.last_run_at).getTime() : 0;
          comparison = aTime - bTime;
          break;
        }
        case 'run_count':
          comparison = (a.run_count || 0) - (b.run_count || 0);
          break;
        case 'avg_duration_ms':
          comparison = (a.avg_duration_ms || 0) - (b.avg_duration_ms || 0);
          break;
      }
      return sortDirection === 'desc' ? -comparison : comparison;
    });
  }, [tests, searchQuery, sortField, sortDirection]);

  return {
    // Core data
    suite, setSuite,
    tests, setTests,
    project, setProject,
    isLoading, setIsLoading,
    error, setError,

    // Suite run
    isRunningSuite, setIsRunningSuite,
    isCancellingSuite, setIsCancellingSuite,
    suiteRun, setSuiteRun,
    suiteRunPolling, setSuiteRunPolling,

    // Search and sort
    searchQuery, setSearchQuery,
    sortField, setSortField,
    sortDirection, setSortDirection,
    handleSort,
    getFilteredAndSortedTests,

    // Review
    requireHumanReview, setRequireHumanReview,
    reviewStats, setReviewStats,
    showReviewPanel, setShowReviewPanel,
    isApproving, setIsApproving,
    selectedForReview, setSelectedForReview,
    toggleTestSelection,
    toggleAllTestsSelection,

    // Parallelization
    showParallelization, setShowParallelization,
    isAnalyzingParallel, setIsAnalyzingParallel,
    parallelizationPlan, setParallelizationPlan,

    // Accessibility filters
    a11ySeverityFilter, setA11ySeverityFilter,
    a11yCategoryFilter, setA11yCategoryFilter,
    a11ySearchQuery, setA11ySearchQuery,

    // Quick actions
    openActionsDropdown, setOpenActionsDropdown,
    runningTestId, setRunningTestId,

    // Live screenshots
    liveScreenshot, setLiveScreenshot,
    screenshotHistory, setScreenshotHistory,
    expandedScreenshot, setExpandedScreenshot,

    // Recording
    showRecordModal, setShowRecordModal,
    recordTargetUrl, setRecordTargetUrl,
    isRecording, setIsRecording,
    recordingSessionId, setRecordingSessionId,
    recordedSteps, setRecordedSteps,
    recordingStatus, setRecordingStatus,
    showReviewModal, setShowReviewModal,
    recordedTestName, setRecordedTestName,
    recordedTestDescription, setRecordedTestDescription,
    isSavingRecordedTest, setIsSavingRecordedTest,
    recordingStartTime, setRecordingStartTime,
    recordingElapsed, setRecordingElapsed,
    recordingDuration, setRecordingDuration,
    recordingPopup, setRecordingPopup,
    recordingFrame, setRecordingFrame,
    recordingCurrentUrl, setRecordingCurrentUrl,
    recordingConnected, setRecordingConnected,
    clickRipple, setClickRipple,
    reconnectAttempt, setReconnectAttempt,
    reconnectFailed, setReconnectFailed,
    staleFrameWarning, setStaleFrameWarning,
    showDebugOverlay, setShowDebugOverlay,
    debugCoords, setDebugCoords,

    // Templates
    showTemplateModal, setShowTemplateModal,
    stepTemplates, setStepTemplates,
    isSavingTemplate, setIsSavingTemplate,
    templateName, setTemplateName,
    insertTemplateForTest, setInsertTemplateForTest,
  };
}

export type SuiteState = ReturnType<typeof useSuiteState>;
