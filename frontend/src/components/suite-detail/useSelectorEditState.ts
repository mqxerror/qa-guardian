/**
 * useSelectorEditState Hook
 * Feature #702: Extract selector editing state from TestSuitePage
 *
 * Manages state for the edit selector modal including:
 * - Modal visibility and context (run, test, step IDs)
 * - Current/original selector values
 * - Edit form state (value, notes, apply to test)
 * - Submission loading state
 */

import { useState, useCallback } from 'react';

// Modal state structure (matches EditSelectorModalState from modals)
export interface SelectorModalState {
  isOpen: boolean;
  runId: string;
  testId: string;
  stepId: string;
  currentSelector: string;
  originalSelector: string;
  wasHealed: boolean;
}

// Full state shape
interface SelectorEditState {
  modal: SelectorModalState;
  value: string;
  notes: string;
  applyToTest: boolean;
  isSubmitting: boolean;
}

// Initial modal state
const initialModalState: SelectorModalState = {
  isOpen: false,
  runId: '',
  testId: '',
  stepId: '',
  currentSelector: '',
  originalSelector: '',
  wasHealed: false,
};

// Initial full state
const initialState: SelectorEditState = {
  modal: initialModalState,
  value: '',
  notes: '',
  applyToTest: true,
  isSubmitting: false,
};

export interface UseSelectorEditStateReturn {
  // Modal state
  editSelectorModal: SelectorModalState;
  openSelectorModal: (state: SelectorModalState) => void;
  closeSelectorModal: () => void;

  // Form state
  editSelectorValue: string;
  setEditSelectorValue: (value: string) => void;
  editSelectorNotes: string;
  setEditSelectorNotes: (notes: string) => void;
  editSelectorApplyToTest: boolean;
  setEditSelectorApplyToTest: (apply: boolean) => void;

  // Submission state
  isSubmittingSelector: boolean;
  setIsSubmittingSelector: (submitting: boolean) => void;

  // Reset
  resetSelectorState: () => void;
}

/**
 * Hook for managing selector edit modal state
 *
 * Consolidates 5 useState declarations into a single hook with
 * a clean API for modal operations.
 */
export function useSelectorEditState(): UseSelectorEditStateReturn {
  const [state, setState] = useState<SelectorEditState>(initialState);

  // Modal operations
  const openSelectorModal = useCallback((modalState: SelectorModalState) => {
    setState(prev => ({
      ...prev,
      modal: modalState,
      value: modalState.currentSelector,
      notes: '',
      applyToTest: true,
    }));
  }, []);

  const closeSelectorModal = useCallback(() => {
    setState(initialState);
  }, []);

  // Form state setters
  const setEditSelectorValue = useCallback((value: string) => {
    setState(prev => ({ ...prev, value }));
  }, []);

  const setEditSelectorNotes = useCallback((notes: string) => {
    setState(prev => ({ ...prev, notes }));
  }, []);

  const setEditSelectorApplyToTest = useCallback((applyToTest: boolean) => {
    setState(prev => ({ ...prev, applyToTest }));
  }, []);

  // Submission state
  const setIsSubmittingSelector = useCallback((isSubmitting: boolean) => {
    setState(prev => ({ ...prev, isSubmitting }));
  }, []);

  // Reset
  const resetSelectorState = useCallback(() => {
    setState(initialState);
  }, []);

  return {
    // Modal state
    editSelectorModal: state.modal,
    openSelectorModal,
    closeSelectorModal,

    // Form state
    editSelectorValue: state.value,
    setEditSelectorValue,
    editSelectorNotes: state.notes,
    setEditSelectorNotes,
    editSelectorApplyToTest: state.applyToTest,
    setEditSelectorApplyToTest,

    // Submission state
    isSubmittingSelector: state.isSubmitting,
    setIsSubmittingSelector,

    // Reset
    resetSelectorState,
  };
}
