/**
 * useAIHealthState Hook
 * Feature #702: Extract AI health monitoring state from TestSuitePage
 *
 * Manages state for AI-powered health insights panel including:
 * - Health report data (score, trend, recommendations)
 * - Loading state for health check requests
 * - Panel visibility toggle
 */

import { useState, useCallback } from 'react';

// AI Health Report recommendation structure
export interface AIHealthRecommendation {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  category: string;
  title: string;
  description: string;
  suggested_action: string;
  affected_tests?: string[];
}

// Full AI Health Report structure
export interface AIHealthReport {
  health_score: number;
  trend: 'improving' | 'stable' | 'degrading';
  ai_summary: string;
  recommendations: AIHealthRecommendation[];
  generated_at: string;
}

// State shape for useReducer
interface AIHealthState {
  report: AIHealthReport | null;
  isLoading: boolean;
  showInsights: boolean;
}

// Initial state
const initialState: AIHealthState = {
  report: null,
  isLoading: false,
  showInsights: false,
};

export interface UseAIHealthStateReturn {
  // State
  aiHealthReport: AIHealthReport | null;
  isLoadingHealthCheck: boolean;
  showHealthInsights: boolean;

  // Actions
  startLoading: () => void;
  setReport: (report: AIHealthReport) => void;
  setError: () => void;
  toggleInsights: () => void;
  showInsights: () => void;
  hideInsights: () => void;
}

/**
 * Hook for managing AI health monitoring state
 *
 * Uses useReducer internally to consolidate related state updates
 * and provide a clean API for the consuming component.
 */
export function useAIHealthState(): UseAIHealthStateReturn {
  const [state, setState] = useState<AIHealthState>(initialState);

  const startLoading = useCallback(() => {
    setState(prev => ({ ...prev, isLoading: true }));
  }, []);

  const setReport = useCallback((report: AIHealthReport) => {
    setState({
      report,
      isLoading: false,
      showInsights: true,
    });
  }, []);

  const setError = useCallback(() => {
    setState(prev => ({ ...prev, isLoading: false }));
  }, []);

  const toggleInsights = useCallback(() => {
    setState(prev => ({ ...prev, showInsights: !prev.showInsights }));
  }, []);

  const showInsightsAction = useCallback(() => {
    setState(prev => ({ ...prev, showInsights: true }));
  }, []);

  const hideInsights = useCallback(() => {
    setState(prev => ({ ...prev, showInsights: false }));
  }, []);

  return {
    // State
    aiHealthReport: state.report,
    isLoadingHealthCheck: state.isLoading,
    showHealthInsights: state.showInsights,

    // Actions
    startLoading,
    setReport,
    setError,
    toggleInsights,
    showInsights: showInsightsAction,
    hideInsights,
  };
}
