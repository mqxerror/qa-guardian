/**
 * usePerformanceHandlers Hook
 * Feature #47: Extracted from MonitoringPage.tsx for modularity
 *
 * Handles all performance monitoring state and operations
 */

import React, { useState, useCallback } from 'react';
import { toast } from '../../../stores/toastStore';
import type { PerformanceCheck, PerformanceResult, PerformanceTrends } from '../types';

export interface UsePerformanceHandlersReturn {
  // State
  performanceChecks: PerformanceCheck[];
  selectedPerformance: PerformanceCheck | null;
  performanceResults: PerformanceResult[];
  performanceTrends: PerformanceTrends | null;
  showPerformanceModal: boolean;
  isLoadingPerfResults: boolean;

  // Setters
  setSelectedPerformance: (check: PerformanceCheck | null) => void;
  setShowPerformanceModal: (show: boolean) => void;
  setPerformanceChecks: React.Dispatch<React.SetStateAction<PerformanceCheck[]>>;

  // Actions
  fetchPerformanceChecks: () => Promise<void>;
  fetchPerformanceResults: (checkId: string) => Promise<void>;
  runPerformanceCheck: (checkId: string) => Promise<void>;
  deletePerformanceCheck: (checkId: string) => Promise<void>;

  // Utilities
  getPerfStatusBadge: (status: string | undefined) => React.ReactNode;
  getMetricColor: (metric: string, value: number) => string;
}

export function usePerformanceHandlers(token: string | null): UsePerformanceHandlersReturn {
  const [performanceChecks, setPerformanceChecks] = useState<PerformanceCheck[]>([]);
  const [showPerformanceModal, setShowPerformanceModal] = useState(false);
  const [selectedPerformance, setSelectedPerformance] = useState<PerformanceCheck | null>(null);
  const [performanceResults, setPerformanceResults] = useState<PerformanceResult[]>([]);
  const [performanceTrends, setPerformanceTrends] = useState<PerformanceTrends | null>(null);
  const [isLoadingPerfResults, setIsLoadingPerfResults] = useState(false);

  // Fetch performance checks
  const fetchPerformanceChecks = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch('/api/v1/monitoring/performance', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setPerformanceChecks(data.checks || []);
      }
    } catch (error) {
      console.error('Failed to fetch performance checks:', error);
    }
  }, [token]);

  // Fetch performance results
  const fetchPerformanceResults = useCallback(async (checkId: string) => {
    if (!token) return;
    setIsLoadingPerfResults(true);
    try {
      const [resultsRes, trendsRes] = await Promise.all([
        fetch(`/api/v1/monitoring/performance/${checkId}/results?limit=10`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/v1/monitoring/performance/${checkId}/trends`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (resultsRes.ok) {
        const data = await resultsRes.json();
        setPerformanceResults(data.results || []);
      }
      if (trendsRes.ok) {
        const data = await trendsRes.json();
        setPerformanceTrends(data);
      }
    } catch (error) {
      console.error('Failed to fetch performance results:', error);
    } finally {
      setIsLoadingPerfResults(false);
    }
  }, [token]);

  // Run performance check manually
  const runPerformanceCheck = useCallback(async (checkId: string) => {
    if (!token) return;
    try {
      const response = await fetch(`/api/v1/monitoring/performance/${checkId}/run`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        toast.success('Performance check executed');
        fetchPerformanceChecks();
        if (selectedPerformance?.id === checkId) {
          fetchPerformanceResults(checkId);
        }
      }
    } catch (error) {
      toast.error('Failed to run performance check');
    }
  }, [token, selectedPerformance, fetchPerformanceChecks, fetchPerformanceResults]);

  // Delete performance check
  const deletePerformanceCheck = useCallback(async (checkId: string) => {
    if (!token) return;
    if (!confirm('Are you sure you want to delete this performance check?')) return;
    try {
      const response = await fetch(`/api/v1/monitoring/performance/${checkId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        toast.success('Performance check deleted');
        if (selectedPerformance?.id === checkId) {
          setSelectedPerformance(null);
        }
        fetchPerformanceChecks();
      }
    } catch (error) {
      toast.error('Failed to delete performance check');
    }
  }, [token, selectedPerformance, fetchPerformanceChecks]);

  // Get performance status badge
  const getPerfStatusBadge = useCallback((status: string | undefined) => {
    switch (status) {
      case 'good':
        return <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">🟢 Good</span>;
      case 'needs_improvement':
        return <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-700">🟡 Needs Work</span>;
      case 'poor':
        return <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">🔴 Poor</span>;
      default:
        return <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">⚪ Unknown</span>;
    }
  }, []);

  // Get Core Web Vitals rating color
  const getMetricColor = useCallback((metric: string, value: number) => {
    const thresholds: Record<string, { good: number; poor: number }> = {
      lcp: { good: 2500, poor: 4000 },
      fid: { good: 100, poor: 300 },
      cls: { good: 0.1, poor: 0.25 },
      fcp: { good: 1800, poor: 3000 },
      ttfb: { good: 800, poor: 1800 },
    };
    const t = thresholds[metric];
    if (!t) return 'text-foreground';
    if (value <= t.good) return 'text-green-600';
    if (value >= t.poor) return 'text-red-600';
    return 'text-yellow-600';
  }, []);

  return {
    // State
    performanceChecks,
    selectedPerformance,
    performanceResults,
    performanceTrends,
    showPerformanceModal,
    isLoadingPerfResults,

    // Setters
    setSelectedPerformance,
    setShowPerformanceModal,
    setPerformanceChecks,

    // Actions
    fetchPerformanceChecks,
    fetchPerformanceResults,
    runPerformanceCheck,
    deletePerformanceCheck,

    // Utilities
    getPerfStatusBadge,
    getMetricColor,
  };
}

export default usePerformanceHandlers;
