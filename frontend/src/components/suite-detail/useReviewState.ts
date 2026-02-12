/**
 * useReviewState Hook
 * Feature #702: Extract review workflow state from TestSuitePage
 *
 * Manages state for human review workflow including:
 * - Review panel visibility
 * - Approval/rejection loading state
 * - Batch selection for multi-test review
 * - Code regeneration with diff view
 */

import { useState, useCallback } from 'react';

// State shape consolidated from multiple useState calls
interface ReviewState {
  showReviewPanel: boolean;
  isApproving: boolean;
  selectedForReview: Set<string>;
  regenerationFeedback: string;
  isRegenerating: boolean;
  previousGeneratedCode: string | null;
  showDiffView: boolean;
}

// Initial state
const initialState: ReviewState = {
  showReviewPanel: false,
  isApproving: false,
  selectedForReview: new Set(),
  regenerationFeedback: '',
  isRegenerating: false,
  previousGeneratedCode: null,
  showDiffView: false,
};

export interface UseReviewStateReturn {
  // Panel visibility
  showReviewPanel: boolean;
  setShowReviewPanel: (show: boolean) => void;
  toggleReviewPanel: () => void;

  // Approval state
  isApproving: boolean;
  setIsApproving: (approving: boolean) => void;

  // Batch selection
  selectedForReview: Set<string>;
  toggleTestSelection: (testId: string) => void;
  toggleAllTestsSelection: (testIds: string[]) => void;
  clearSelection: () => void;
  selectTests: (testIds: string[]) => void;

  // Regeneration state
  regenerationFeedback: string;
  setRegenerationFeedback: (feedback: string) => void;
  isRegenerating: boolean;
  setIsRegenerating: (regenerating: boolean) => void;

  // Diff view
  previousGeneratedCode: string | null;
  setPreviousGeneratedCode: (code: string | null) => void;
  showDiffView: boolean;
  setShowDiffView: (show: boolean) => void;
  toggleDiffView: () => void;

  // Reset all state
  resetReviewState: () => void;
}

/**
 * Hook for managing review workflow state
 *
 * Consolidates 7 useState declarations into a single hook with
 * a clean API for batch review operations.
 */
export function useReviewState(): UseReviewStateReturn {
  const [state, setState] = useState<ReviewState>(initialState);

  // Panel visibility
  const setShowReviewPanel = useCallback((show: boolean) => {
    setState(prev => ({ ...prev, showReviewPanel: show }));
  }, []);

  const toggleReviewPanel = useCallback(() => {
    setState(prev => ({ ...prev, showReviewPanel: !prev.showReviewPanel }));
  }, []);

  // Approval state
  const setIsApproving = useCallback((approving: boolean) => {
    setState(prev => ({ ...prev, isApproving: approving }));
  }, []);

  // Batch selection
  const toggleTestSelection = useCallback((testId: string) => {
    setState(prev => {
      const newSet = new Set(prev.selectedForReview);
      if (newSet.has(testId)) {
        newSet.delete(testId);
      } else {
        newSet.add(testId);
      }
      return { ...prev, selectedForReview: newSet };
    });
  }, []);

  const toggleAllTestsSelection = useCallback((testIds: string[]) => {
    setState(prev => {
      const allSelected = testIds.every(id => prev.selectedForReview.has(id));
      return {
        ...prev,
        selectedForReview: allSelected ? new Set() : new Set(testIds),
      };
    });
  }, []);

  const clearSelection = useCallback(() => {
    setState(prev => ({ ...prev, selectedForReview: new Set() }));
  }, []);

  const selectTests = useCallback((testIds: string[]) => {
    setState(prev => ({ ...prev, selectedForReview: new Set(testIds) }));
  }, []);

  // Regeneration state
  const setRegenerationFeedback = useCallback((feedback: string) => {
    setState(prev => ({ ...prev, regenerationFeedback: feedback }));
  }, []);

  const setIsRegenerating = useCallback((regenerating: boolean) => {
    setState(prev => ({ ...prev, isRegenerating: regenerating }));
  }, []);

  // Diff view
  const setPreviousGeneratedCode = useCallback((code: string | null) => {
    setState(prev => ({ ...prev, previousGeneratedCode: code }));
  }, []);

  const setShowDiffView = useCallback((show: boolean) => {
    setState(prev => ({ ...prev, showDiffView: show }));
  }, []);

  const toggleDiffView = useCallback(() => {
    setState(prev => ({ ...prev, showDiffView: !prev.showDiffView }));
  }, []);

  // Reset all state
  const resetReviewState = useCallback(() => {
    setState(initialState);
  }, []);

  return {
    // Panel visibility
    showReviewPanel: state.showReviewPanel,
    setShowReviewPanel,
    toggleReviewPanel,

    // Approval state
    isApproving: state.isApproving,
    setIsApproving,

    // Batch selection
    selectedForReview: state.selectedForReview,
    toggleTestSelection,
    toggleAllTestsSelection,
    clearSelection,
    selectTests,

    // Regeneration state
    regenerationFeedback: state.regenerationFeedback,
    setRegenerationFeedback,
    isRegenerating: state.isRegenerating,
    setIsRegenerating,

    // Diff view
    previousGeneratedCode: state.previousGeneratedCode,
    setPreviousGeneratedCode,
    showDiffView: state.showDiffView,
    setShowDiffView,
    toggleDiffView,

    // Reset
    resetReviewState,
  };
}
