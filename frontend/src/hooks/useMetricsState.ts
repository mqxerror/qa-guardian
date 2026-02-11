/**
 * useMetricsState - Custom hook for metrics/performance-related state
 * Extracted from TestRunResultPage.tsx for better code organization
 *
 * Feature #46: Component modularization - Extract metrics state management
 */

import { useState, useCallback } from 'react';
import type { TestRunType } from '../components/test-detail/types';

// Types for K6 Load Test Dashboard
export type K6ActiveChart = 'vus' | 'rps' | 'response_times';
export type K6ExportFormat = 'json' | 'csv';
export type K6ActiveTab = 'overview' | 'response_times' | 'throughput' | 'errors' | 'endpoints';

// Types for Lighthouse
export type LighthouseActiveTab = 'overview' | 'performance' | 'accessibility' | 'best_practices' | 'seo';

// Types for endpoint sorting
export type EndpointSortBy = 'avg_time' | 'p95_time' | 'error_rate' | 'count';

// Return type for the hook
export interface UseMetricsStateReturn {
  // Lighthouse tab states
  lighthouseActiveTab: LighthouseActiveTab;
  setLighthouseActiveTab: React.Dispatch<React.SetStateAction<LighthouseActiveTab>>;

  // K6 Load Test Dashboard states
  k6ActiveChart: K6ActiveChart;
  setK6ActiveChart: React.Dispatch<React.SetStateAction<K6ActiveChart>>;
  k6ShowThresholds: boolean;
  setK6ShowThresholds: React.Dispatch<React.SetStateAction<boolean>>;
  k6ExportFormat: K6ExportFormat;
  setK6ExportFormat: React.Dispatch<React.SetStateAction<K6ExportFormat>>;
  k6ActiveTab: K6ActiveTab;
  setK6ActiveTab: React.Dispatch<React.SetStateAction<K6ActiveTab>>;
  expandedEndpoints: Set<string>;
  setExpandedEndpoints: React.Dispatch<React.SetStateAction<Set<string>>>;
  endpointSortBy: EndpointSortBy;
  setEndpointSortBy: React.Dispatch<React.SetStateAction<EndpointSortBy>>;
  endpointSortDesc: boolean;
  setEndpointSortDesc: React.Dispatch<React.SetStateAction<boolean>>;

  // Expanded opportunities/diagnostics states
  expandedOpportunities: Set<string>;
  setExpandedOpportunities: React.Dispatch<React.SetStateAction<Set<string>>>;
  expandedDiagnostics: Set<string>;
  setExpandedDiagnostics: React.Dispatch<React.SetStateAction<Set<string>>>;
  expandedPassedAudits: Set<string>;
  setExpandedPassedAudits: React.Dispatch<React.SetStateAction<Set<string>>>;
  passedAuditsCollapsed: boolean;
  setPassedAuditsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  securityInsightsCollapsed: boolean;
  setSecurityInsightsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  expandedMixedContentResources: boolean;
  setExpandedMixedContentResources: React.Dispatch<React.SetStateAction<boolean>>;

  // Previous comparison toggle state
  showPreviousComparison: boolean;
  setShowPreviousComparison: React.Dispatch<React.SetStateAction<boolean>>;
  previousRunData: TestRunType | null;
  setPreviousRunData: React.Dispatch<React.SetStateAction<TestRunType | null>>;

  // Performance AI analysis states
  perfAIAnalysisOpen: string | null;
  setPerfAIAnalysisOpen: React.Dispatch<React.SetStateAction<string | null>>;
  perfAILoading: boolean;
  setPerfAILoading: React.Dispatch<React.SetStateAction<boolean>>;
  perfAIResult: Record<string, string>;
  setPerfAIResult: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  perfAIError: string | null;
  setPerfAIError: React.Dispatch<React.SetStateAction<string | null>>;

  // Toggle handlers
  toggleOpportunity: (id: string) => void;
  toggleDiagnostic: (id: string) => void;
  togglePassedAudit: (id: string) => void;
  toggleEndpoint: (endpoint: string) => void;
}

/**
 * Custom hook for managing metrics/performance-related state
 * Consolidates all state related to Lighthouse, K6, and performance metrics
 */
export function useMetricsState(): UseMetricsStateReturn {
  // Feature #1909: Lighthouse results tabbed interface
  const [lighthouseActiveTab, setLighthouseActiveTab] = useState<LighthouseActiveTab>('overview');

  // Feature #1836: K6 Load Test Dashboard state
  const [k6ActiveChart, setK6ActiveChart] = useState<K6ActiveChart>('vus');
  const [k6ShowThresholds, setK6ShowThresholds] = useState(true);
  const [k6ExportFormat, setK6ExportFormat] = useState<K6ExportFormat>('json');
  // Feature #1908: K6 results tabbed interface
  const [k6ActiveTab, setK6ActiveTab] = useState<K6ActiveTab>('overview');
  const [expandedEndpoints, setExpandedEndpoints] = useState<Set<string>>(new Set());
  // Feature #1899: Endpoint performance ranking sort state
  const [endpointSortBy, setEndpointSortBy] = useState<EndpointSortBy>('avg_time');
  const [endpointSortDesc, setEndpointSortDesc] = useState(true);

  // Feature #1835: Enhanced metrics tab state - expanded opportunities/diagnostics
  const [expandedOpportunities, setExpandedOpportunities] = useState<Set<string>>(new Set());
  const [expandedDiagnostics, setExpandedDiagnostics] = useState<Set<string>>(new Set());
  // Feature #1889: Passed audits state
  const [expandedPassedAudits, setExpandedPassedAudits] = useState<Set<string>>(new Set());
  const [passedAuditsCollapsed, setPassedAuditsCollapsed] = useState(true);
  // Feature #1890: Security insights state
  const [securityInsightsCollapsed, setSecurityInsightsCollapsed] = useState(false);
  const [expandedMixedContentResources, setExpandedMixedContentResources] = useState(false);

  // Previous comparison toggle state
  const [showPreviousComparison, setShowPreviousComparison] = useState(false);
  const [previousRunData, setPreviousRunData] = useState<TestRunType | null>(null);

  // Feature #1935: Performance AI analysis state
  const [perfAIAnalysisOpen, setPerfAIAnalysisOpen] = useState<string | null>(null);
  const [perfAILoading, setPerfAILoading] = useState(false);
  const [perfAIResult, setPerfAIResult] = useState<Record<string, string>>({});
  const [perfAIError, setPerfAIError] = useState<string | null>(null);

  // Feature #1835: Toggle opportunity expansion
  const toggleOpportunity = useCallback((id: string) => {
    setExpandedOpportunities(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Feature #1835: Toggle diagnostic expansion
  const toggleDiagnostic = useCallback((id: string) => {
    setExpandedDiagnostics(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Feature #1889: Toggle passed audit expansion
  const togglePassedAudit = useCallback((id: string) => {
    setExpandedPassedAudits(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Feature #1836: Toggle endpoint expansion
  const toggleEndpoint = useCallback((endpoint: string) => {
    setExpandedEndpoints(prev => {
      const next = new Set(prev);
      if (next.has(endpoint)) {
        next.delete(endpoint);
      } else {
        next.add(endpoint);
      }
      return next;
    });
  }, []);

  return {
    // Lighthouse tab states
    lighthouseActiveTab,
    setLighthouseActiveTab,

    // K6 Load Test Dashboard states
    k6ActiveChart,
    setK6ActiveChart,
    k6ShowThresholds,
    setK6ShowThresholds,
    k6ExportFormat,
    setK6ExportFormat,
    k6ActiveTab,
    setK6ActiveTab,
    expandedEndpoints,
    setExpandedEndpoints,
    endpointSortBy,
    setEndpointSortBy,
    endpointSortDesc,
    setEndpointSortDesc,

    // Expanded opportunities/diagnostics states
    expandedOpportunities,
    setExpandedOpportunities,
    expandedDiagnostics,
    setExpandedDiagnostics,
    expandedPassedAudits,
    setExpandedPassedAudits,
    passedAuditsCollapsed,
    setPassedAuditsCollapsed,
    securityInsightsCollapsed,
    setSecurityInsightsCollapsed,
    expandedMixedContentResources,
    setExpandedMixedContentResources,

    // Previous comparison toggle state
    showPreviousComparison,
    setShowPreviousComparison,
    previousRunData,
    setPreviousRunData,

    // Performance AI analysis states
    perfAIAnalysisOpen,
    setPerfAIAnalysisOpen,
    perfAILoading,
    setPerfAILoading,
    perfAIResult,
    setPerfAIResult,
    perfAIError,
    setPerfAIError,

    // Toggle handlers
    toggleOpportunity,
    toggleDiagnostic,
    togglePassedAudit,
    toggleEndpoint,
  };
}

export default useMetricsState;
