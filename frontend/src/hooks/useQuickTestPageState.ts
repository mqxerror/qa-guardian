/**
 * useQuickTestPageState - Consolidated state management for QuickTestPage
 * Feature #608: Replace 15 useState hooks with useReducer for cleaner state
 */
import { useReducer, useCallback } from 'react';
import type { AIAnalysisData } from '../components/quick-test/types';

// ============================================================
// State Types
// ============================================================

export interface UrlState {
  value: string;
  error: string | null;
  recentUrls: string[];
  showRecent: boolean;
}

export interface UIState {
  waveExpanded: Record<number, boolean>;
  showHistory: boolean;
  showExportMenu: boolean;
  selectedBrowser: 'chromium' | 'firefox' | 'webkit';
}

export interface HistoryEntry {
  runId: string;
  url: string;
  timestamp: Date;
  score?: number;
}

export interface HistoryState {
  entries: HistoryEntry[];
  isLoading: boolean;
}

export interface ScreenshotModalState {
  isOpen: boolean;
  url: string | null;
  type: 'desktop' | 'mobile' | null;
}

export interface ScheduleModalState {
  isOpen: boolean;
  frequency: '1h' | '6h' | '12h' | '24h' | 'weekly';
  notifyOnDrop: boolean;
  threshold: number;
  isSubmitting: boolean;
  error: string | null;
  success: boolean;
}

export interface CreateTestSuiteModalState {
  isOpen: boolean;
  testSuggestions: AIAnalysisData['testSuggestions'];
}

export interface QuickTestPageState {
  url: UrlState;
  ui: UIState;
  history: HistoryState;
  screenshotModal: ScreenshotModalState;
  scheduleModal: ScheduleModalState;
  createTestSuiteModal: CreateTestSuiteModalState;
}

// ============================================================
// Action Types (Discriminated Union)
// ============================================================

export type QuickTestPageAction =
  // URL Actions
  | { type: 'SET_URL'; payload: string }
  | { type: 'SET_URL_ERROR'; payload: string | null }
  | { type: 'SET_RECENT_URLS'; payload: string[] }
  | { type: 'TOGGLE_RECENT_URLS'; payload?: boolean }
  | { type: 'SET_BROWSER'; payload: 'chromium' | 'firefox' | 'webkit' }
  // UI Actions
  | { type: 'TOGGLE_WAVE_EXPANDED'; payload: number }
  | { type: 'SET_WAVE_EXPANDED'; payload: Record<number, boolean> }
  | { type: 'TOGGLE_HISTORY'; payload?: boolean }
  | { type: 'TOGGLE_EXPORT_MENU'; payload?: boolean }
  // History Actions
  | { type: 'SET_HISTORY'; payload: HistoryEntry[] }
  | { type: 'ADD_HISTORY_ENTRY'; payload: HistoryEntry }
  | { type: 'SET_HISTORY_LOADING'; payload: boolean }
  // Screenshot Modal Actions
  | { type: 'OPEN_SCREENSHOT_MODAL'; payload: { url: string; type: 'desktop' | 'mobile' } }
  | { type: 'CLOSE_SCREENSHOT_MODAL' }
  // Schedule Modal Actions
  | { type: 'OPEN_SCHEDULE_MODAL' }
  | { type: 'CLOSE_SCHEDULE_MODAL' }
  | { type: 'UPDATE_SCHEDULE_MODAL'; payload: Partial<Omit<ScheduleModalState, 'isOpen'>> }
  | { type: 'RESET_SCHEDULE_MODAL' }
  // Create Test Suite Modal Actions
  | { type: 'OPEN_CREATE_SUITE_MODAL'; payload: AIAnalysisData['testSuggestions'] }
  | { type: 'CLOSE_CREATE_SUITE_MODAL' };

// ============================================================
// Initial State
// ============================================================

const initialState: QuickTestPageState = {
  url: {
    value: '',
    error: null,
    recentUrls: [],
    showRecent: false,
  },
  ui: {
    waveExpanded: {},
    showHistory: false,
    showExportMenu: false,
    selectedBrowser: 'chromium',
  },
  history: {
    entries: [],
    isLoading: false,
  },
  screenshotModal: {
    isOpen: false,
    url: null,
    type: null,
  },
  scheduleModal: {
    isOpen: false,
    frequency: '24h',
    notifyOnDrop: true,
    threshold: 70,
    isSubmitting: false,
    error: null,
    success: false,
  },
  createTestSuiteModal: {
    isOpen: false,
    testSuggestions: undefined,
  },
};

// ============================================================
// Reducer
// ============================================================

function quickTestPageReducer(
  state: QuickTestPageState,
  action: QuickTestPageAction
): QuickTestPageState {
  switch (action.type) {
    // URL Actions
    case 'SET_URL':
      return { ...state, url: { ...state.url, value: action.payload, error: null } };
    case 'SET_URL_ERROR':
      return { ...state, url: { ...state.url, error: action.payload } };
    case 'SET_RECENT_URLS':
      return { ...state, url: { ...state.url, recentUrls: action.payload } };
    case 'TOGGLE_RECENT_URLS':
      return {
        ...state,
        url: { ...state.url, showRecent: action.payload ?? !state.url.showRecent },
      };
    case 'SET_BROWSER':
      return { ...state, ui: { ...state.ui, selectedBrowser: action.payload } };

    // UI Actions
    case 'TOGGLE_WAVE_EXPANDED':
      return {
        ...state,
        ui: {
          ...state.ui,
          waveExpanded: {
            ...state.ui.waveExpanded,
            [action.payload]: !state.ui.waveExpanded[action.payload],
          },
        },
      };
    case 'SET_WAVE_EXPANDED':
      return { ...state, ui: { ...state.ui, waveExpanded: action.payload } };
    case 'TOGGLE_HISTORY':
      return {
        ...state,
        ui: { ...state.ui, showHistory: action.payload ?? !state.ui.showHistory },
      };
    case 'TOGGLE_EXPORT_MENU':
      return {
        ...state,
        ui: { ...state.ui, showExportMenu: action.payload ?? !state.ui.showExportMenu },
      };

    // History Actions
    case 'SET_HISTORY':
      return { ...state, history: { ...state.history, entries: action.payload } };
    case 'ADD_HISTORY_ENTRY': {
      const newEntries = [
        action.payload,
        ...state.history.entries.filter(h => h.runId !== action.payload.runId),
      ].slice(0, 20); // MAX_HISTORY
      return { ...state, history: { ...state.history, entries: newEntries } };
    }
    case 'SET_HISTORY_LOADING':
      return { ...state, history: { ...state.history, isLoading: action.payload } };

    // Screenshot Modal Actions
    case 'OPEN_SCREENSHOT_MODAL':
      return {
        ...state,
        screenshotModal: { isOpen: true, url: action.payload.url, type: action.payload.type },
      };
    case 'CLOSE_SCREENSHOT_MODAL':
      return { ...state, screenshotModal: { isOpen: false, url: null, type: null } };

    // Schedule Modal Actions
    case 'OPEN_SCHEDULE_MODAL':
      return { ...state, scheduleModal: { ...state.scheduleModal, isOpen: true } };
    case 'CLOSE_SCHEDULE_MODAL':
      return { ...state, scheduleModal: { ...state.scheduleModal, isOpen: false } };
    case 'UPDATE_SCHEDULE_MODAL':
      return { ...state, scheduleModal: { ...state.scheduleModal, ...action.payload } };
    case 'RESET_SCHEDULE_MODAL':
      return {
        ...state,
        scheduleModal: {
          isOpen: false,
          frequency: '24h',
          notifyOnDrop: true,
          threshold: 70,
          isSubmitting: false,
          error: null,
          success: false,
        },
      };

    // Create Test Suite Modal Actions
    case 'OPEN_CREATE_SUITE_MODAL':
      return {
        ...state,
        createTestSuiteModal: { isOpen: true, testSuggestions: action.payload },
      };
    case 'CLOSE_CREATE_SUITE_MODAL':
      return {
        ...state,
        createTestSuiteModal: { isOpen: false, testSuggestions: undefined },
      };

    default:
      return state;
  }
}

// ============================================================
// Hook
// ============================================================

export function useQuickTestPageState() {
  const [state, dispatch] = useReducer(quickTestPageReducer, initialState);

  // Convenience action creators
  const actions = {
    // URL actions
    setUrl: useCallback((value: string) => dispatch({ type: 'SET_URL', payload: value }), []),
    setUrlError: useCallback((error: string | null) => dispatch({ type: 'SET_URL_ERROR', payload: error }), []),
    setRecentUrls: useCallback((urls: string[]) => dispatch({ type: 'SET_RECENT_URLS', payload: urls }), []),
    toggleRecentUrls: useCallback((show?: boolean) => dispatch({ type: 'TOGGLE_RECENT_URLS', payload: show }), []),
    setBrowser: useCallback((browser: 'chromium' | 'firefox' | 'webkit') => dispatch({ type: 'SET_BROWSER', payload: browser }), []),

    // UI actions
    toggleWaveExpanded: useCallback((waveIndex: number) => dispatch({ type: 'TOGGLE_WAVE_EXPANDED', payload: waveIndex }), []),
    setWaveExpanded: useCallback((expanded: Record<number, boolean>) => dispatch({ type: 'SET_WAVE_EXPANDED', payload: expanded }), []),
    toggleHistory: useCallback((show?: boolean) => dispatch({ type: 'TOGGLE_HISTORY', payload: show }), []),
    toggleExportMenu: useCallback((show?: boolean) => dispatch({ type: 'TOGGLE_EXPORT_MENU', payload: show }), []),

    // History actions
    setHistory: useCallback((entries: HistoryEntry[]) => dispatch({ type: 'SET_HISTORY', payload: entries }), []),
    addHistoryEntry: useCallback((entry: HistoryEntry) => dispatch({ type: 'ADD_HISTORY_ENTRY', payload: entry }), []),
    setHistoryLoading: useCallback((loading: boolean) => dispatch({ type: 'SET_HISTORY_LOADING', payload: loading }), []),

    // Screenshot modal actions
    openScreenshotModal: useCallback((url: string, type: 'desktop' | 'mobile') =>
      dispatch({ type: 'OPEN_SCREENSHOT_MODAL', payload: { url, type } }), []),
    closeScreenshotModal: useCallback(() => dispatch({ type: 'CLOSE_SCREENSHOT_MODAL' }), []),

    // Schedule modal actions
    openScheduleModal: useCallback(() => dispatch({ type: 'OPEN_SCHEDULE_MODAL' }), []),
    closeScheduleModal: useCallback(() => dispatch({ type: 'CLOSE_SCHEDULE_MODAL' }), []),
    updateScheduleModal: useCallback((updates: Partial<Omit<ScheduleModalState, 'isOpen'>>) =>
      dispatch({ type: 'UPDATE_SCHEDULE_MODAL', payload: updates }), []),
    resetScheduleModal: useCallback(() => dispatch({ type: 'RESET_SCHEDULE_MODAL' }), []),

    // Create test suite modal actions
    openCreateSuiteModal: useCallback((suggestions: AIAnalysisData['testSuggestions']) =>
      dispatch({ type: 'OPEN_CREATE_SUITE_MODAL', payload: suggestions }), []),
    closeCreateSuiteModal: useCallback(() => dispatch({ type: 'CLOSE_CREATE_SUITE_MODAL' }), []),
  };

  return { state, dispatch, actions };
}

// Re-export types for convenience
export type { AIAnalysisData };
