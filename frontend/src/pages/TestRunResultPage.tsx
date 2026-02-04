/**
 * TestRunResultPage - Detailed test run results with full report
 * Feature #1823: Test results detail page with full report
 */

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useOrganizationBrandingStore } from '../stores/organizationBrandingStore';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ComposedChart, Cell, ReferenceLine, ReferenceArea, ReferenceDot } from 'recharts';
import { jsPDF } from 'jspdf';
import { io, Socket } from 'socket.io-client';
import { toast } from '../stores/toastStore';
import { useMetricsState } from '../hooks/useMetricsState';
import { useNetworkAnalysisState } from '../hooks/useNetworkAnalysisState';
import { useAccessibilityState } from '../hooks/useAccessibilityState';
import { useComputedResults } from '../hooks/useComputedResults';
import { useTestRunHandlers } from '../hooks/useTestRunHandlers';
import { useVisualTestState } from '../hooks/useVisualTestState';
import { useTestRunData } from '../hooks/useTestRunData';

// Feature #46: Import modular components and types for performance optimization
import {
  ExecutiveSummary,
  SummaryCards,
  TabNavigation,
  AccessibilityTab,
  TimelineTab,
  VisualTab,
  ResultsTab,
  LogsTab,
  ScreenshotsTab,
  CircularGauge,
  NetworkTab,
  MetricsTab,
  exportK6ResultsPDF,
  exportLighthousePDF,
  formatDuration,
  formatDateTime,
  formatStepTime,
  formatRelativeTime,
  formatBytes,
  getScoreColorClass,
  getScoreBgClass,
  getScreenshotTypeBadgeColor,
  ActiveTab,
  // Import types from modular components - eliminates ~380 lines of duplicate type definitions
  StepResult,
  TestResult,
  TestRun,
  TestInfo,
  SuiteInfo,
  ConsoleLog,
  NetworkRequest,
  AccessibilityViolation,
  ResultSummary,
  // Feature #46: Network tab types
  WaterfallRequest,
  NetworkStats,
  WaterfallBounds,
  NetworkSortBy,
  // Feature #46: Screenshot tab types
  ScreenshotItem,
  // Feature #46: Timeline tab types
  ComputedStep,
  SelectedScreenshot,
  // Feature #46: Report generation utilities (extracted from this file)
  generatePdfReport,
  generateHtmlReport,
} from '../components/test-run-results';

export default function TestRunResultPage() {
  // Feature #46: runId now comes from useTestRunData hook
  const navigate = useNavigate();
  const { token } = useAuthStore();
  // Feature #1995: Get organization branding for PDF exports
  const { logoBase64, organizationName } = useOrganizationBrandingStore();

  // Feature #46: Extract metrics/performance-related state to custom hook
  const {
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
  } = useMetricsState();

  // Feature #46: Accessibility state extracted to useAccessibilityState hook
  const {
    a11yViewMode,
    setA11yViewMode,
    a11yExpandedSeverities,
    setA11yExpandedSeverities,
    toggleA11ySeverity,
    a11yExpandedViolations,
    setA11yExpandedViolations,
    toggleA11yViolation,
    a11yAIAnalysisOpen,
    setA11yAIAnalysisOpen,
    a11yAILoading,
    setA11yAILoading,
    a11yAIResult,
    setA11yAIResult,
    a11yAIError,
    setA11yAIError,
    analyzeAccessibilityResults: analyzeA11y,
  } = useAccessibilityState();

  // Feature #46: Use useTestRunData hook for core data fetching state
  // Note: resultSummary comes from useComputedResults (which uses this run data)
  const {
    run,
    testInfo,
    suiteInfo,
    loading,
    error,
    retryTrigger,
    setRetryTrigger,
    previousRuns,
    runHistory,
    selectedCompareRunId,
    setSelectedCompareRunId,
    compareRun,
    loadingCompareRun,
    runId,
  } = useTestRunData();

  // Feature #46: Extract network analysis state to custom hook
  const {
    networkRequests,
    waterfallData,
    filteredNetworkRequests,
    waterfallBounds,
    networkStats,
    networkTypeFilter,
    networkSearch,
    networkSortBy,
    selectedNetworkRequest,
    setNetworkTypeFilter,
    setNetworkSearch,
    setNetworkSortBy,
    setSelectedNetworkRequest,
    toggleNetworkType,
    getWaterfallPosition,
    exportHAR,
  } = useNetworkAnalysisState({ run, runId });

  // Feature #46: Extract computed/derived data to custom hook
  const {
    resultSummary,
    performanceResults,
    loadTestResults,
    visualResults,
    accessibilityResults,
    consoleLogs,
    videoFile,
    runDurationMs,
    visualMarkers,
    allSteps,
    screenshots,
    allScreenshots,
    primaryError,
  } = useComputedResults(run, testInfo);

  // Active sections
  const [activeTab, setActiveTab] = useState<ActiveTab>('results');
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [expandedLogs, setExpandedLogs] = useState(false);

  // Feature #1833: Timeline view options
  const [showNetworkPerStep, setShowNetworkPerStep] = useState(true);
  const [showConsolePerStep, setShowConsolePerStep] = useState(true);
  // Feature #46: Using SelectedScreenshot type from TimelineTab
  const [selectedScreenshot, setSelectedScreenshot] = useState<SelectedScreenshot | null>(null);

  // Feature #1834: Enhanced screenshots gallery state
  const [galleryViewMode, setGalleryViewMode] = useState<'grid' | 'carousel'>('grid');
  const [comparisonMode, setComparisonMode] = useState(false);
  const [selectedForComparison, setSelectedForComparison] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  // Feature #1996: Collapsible screenshot groups by test type
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  // Feature #1997: Filter screenshots by test type
  const [screenshotTypeFilter, setScreenshotTypeFilter] = useState<'All' | 'E2E' | 'Visual' | 'Performance' | 'Load' | 'Accessibility'>('All');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);

  // Feature #46: Metrics state (expandedOpportunities, expandedDiagnostics, k6*, lighthouse*, etc.)
  // moved to useMetricsState hook

  // Feature #46: Visual testing state extracted to useVisualTestState hook
  const {
    visualViewMode, setVisualViewMode,
    sliderPosition, setSliderPosition,
    onionOpacity, setOnionOpacity,
    expandedVisualResults, setExpandedVisualResults,
    visualZoom, setVisualZoom,
    visualPan, setVisualPan,
    isPanning, setIsPanning,
    panStart, setPanStart,
    visualContainerRefs,
    visualVideoRef,
    visualVideoCurrentTime, setVisualVideoCurrentTime,
    isVisualVideoPlaying, setIsVisualVideoPlaying,
    visualVideoExpanded, setVisualVideoExpanded,
    approvalLoading, setApprovalLoading,
    toggleVisualResult,
    handleSliderChange, handleOnionOpacityChange,
    handleZoomIn, handleZoomOut, handleZoomReset, handleZoomFit,
    handlePanStart, handlePanMove, handlePanEnd, handleWheelZoom,
    handleApproveBaseline, handleRejectBaseline,
    seekVisualVideoToMarker, handleVisualVideoTimeUpdate,
  } = useVisualTestState({ runId, token, setRetryTrigger });

  // Feature #1838: Accessibility tab enhanced state - moved to useAccessibilityState hook

  // Feature #1839: Logs tab enhanced state
  const [logsViewMode, setLogsViewMode] = useState<'unified' | 'console' | 'network'>('unified');
  const [logsFilter, setLogsFilter] = useState<{
    errors: boolean;
    warnings: boolean;
    info: boolean;
    debug: boolean;
    network: boolean;
    failedRequests: boolean;
  }>({ errors: true, warnings: true, info: true, debug: true, network: true, failedRequests: true });
  const [logsSearch, setLogsSearch] = useState('');
  const [expandedNetworkItems, setExpandedNetworkItems] = useState<Set<number>>(new Set());
  const [logsExportFormat, setLogsExportFormat] = useState<'json' | 'txt'>('json');

  // Feature #1840: Network tab - HAR viewer and waterfall state extracted to useNetworkAnalysisState hook

  // Feature #1841: Individual test result cards state
  const [expandedResultCards, setExpandedResultCards] = useState<Set<string>>(new Set());
  const [selectedResultsFilter, setSelectedResultsFilter] = useState<'all' | 'passed' | 'failed' | 'skipped'>('all');
  const [rerunningTests, setRerunningTests] = useState<Set<string>>(new Set());

  // Feature #1842: Run comparison state (previousRuns, selectedCompareRunId, compareRun, loadingCompareRun, runHistory from useTestRunData)
  const [compareMode, setCompareMode] = useState(false);

  // Feature #1843: Export state
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [generatingShare, setGeneratingShare] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [shareLinkExpiry, setShareLinkExpiry] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [shareLinkPassword, setShareLinkPassword] = useState('');
  // Feature #1992: PDF section selection state
  const [pdfSections, setPdfSections] = useState({
    summary: true,
    typeBreakdown: true,
    testResults: true,
    failures: true,
    screenshots: true,
  });
  // Feature #1993: HTML export state
  const [generatingHtml, setGeneratingHtml] = useState(false);

  // Feature #1844: Live execution state
  const socketRef = useRef<Socket | null>(null);
  const [liveMode, setLiveMode] = useState(false);
  const [currentStep, setCurrentStep] = useState<{ action: string; selector?: string; progress: number } | null>(null);
  const [liveScreenshot, setLiveScreenshot] = useState<string | null>(null);
  const [liveConsoleLogs, setLiveConsoleLogs] = useState<Array<{ level: string; message: string; timestamp: number }>>([]);
  const [liveMetrics, setLiveMetrics] = useState<{ rps?: number; responseTime?: number; vus?: number } | null>(null);
  const [executionProgress, setExecutionProgress] = useState<{ current: number; total: number; eta?: number }>({ current: 0, total: 0 });
  const [cancellingTest, setCancellingTest] = useState(false);

  // Feature #1962: AI state removed - AI analysis now only on Visual Review page
  // Feature #1951: Simple error pattern detection - provides tips without AI cost
  const SIMPLE_ERROR_PATTERNS: Array<{ pattern: RegExp; tip: string; category: string }> = [
    { pattern: /element\s*(not\s*found|does\s*not\s*exist|could\s*not\s*be\s*located)/i, tip: 'Check if the selector has changed or the element is inside an iframe/shadow DOM.', category: 'selector' },
    { pattern: /timeout\s*(exceeded|waiting|error)|timed?\s*out/i, tip: 'Increase wait time or check if the page loads slower than expected.', category: 'timeout' },
    { pattern: /navigation\s*(failed|error)|failed\s*to\s*navigate/i, tip: 'Verify the URL is correct and the page is accessible.', category: 'navigation' },
    { pattern: /assertion\s*(failed|error)|expect.*to\s*(be|equal|have|contain)/i, tip: 'Check if the expected value has changed or the comparison is correct.', category: 'assertion' },
    { pattern: /net::err_|network\s*error|connection\s*(refused|reset|failed)/i, tip: 'Check network connectivity and if the server is running.', category: 'network' },
    { pattern: /click\s*intercepted|element\s*is\s*not\s*clickable/i, tip: 'Wait for overlays to close or scroll the element into view.', category: 'interaction' },
    { pattern: /strict\s*mode\s*violation|locator\s*resolved\s*to\s*\d+\s*elements/i, tip: 'Make the selector more specific to match exactly one element.', category: 'selector' },
    { pattern: /frame\s*(detached|was\s*detached)/i, tip: 'The frame navigated away. Wait for navigation to complete.', category: 'frame' },
  ];

  const detectSimpleError = useCallback((errorMessage?: string): { isSimple: boolean; tip?: string; category?: string } => {
    if (!errorMessage) return { isSimple: false };

    for (const { pattern, tip, category } of SIMPLE_ERROR_PATTERNS) {
      if (pattern.test(errorMessage)) {
        // Log for tuning (Feature #1951 Step 5)
        console.log('[AI Skip] Simple error detected:', { category, pattern: pattern.source, errorSnippet: errorMessage.slice(0, 100) });
        return { isSimple: true, tip, category };
      }
    }
    // Log complex errors that trigger AI
    console.log('[AI Triggered] Complex error:', { errorSnippet: errorMessage.slice(0, 100) });
    return { isSimple: false };
  }, []);

  // Get the primary error from the run results - extracted to useComputedResults hook

  // Detect if the primary error is simple
  const errorAnalysis = useMemo(() => detectSimpleError(primaryError || undefined), [primaryError, detectSimpleError]);

  // Feature #46: Performance AI analysis state (perfAI*) moved to useMetricsState hook

  // Feature #1936: Accessibility AI analysis state - moved to useAccessibilityState hook

  // Feature #1954: Batch failure analysis state
  const [batchAnalysisLoading, setBatchAnalysisLoading] = useState(false);
  const [batchAnalysisResult, setBatchAnalysisResult] = useState<string | null>(null);
  const [batchAnalysisOpen, setBatchAnalysisOpen] = useState(false);
  const [batchAnalysisCached, setBatchAnalysisCached] = useState(false);

  // Feature #1865: Video playback synchronized with timeline
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [currentVideoTime, setCurrentVideoTime] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  // Feature #1880: Visual video state extracted to useVisualTestState hook

  // Feature #46: resultSummary and consoleLogs extracted to useComputedResults hook

  // Get network requests - extracted to useNetworkAnalysisState hook
  // performanceResults, accessibilityResults, loadTestResults, visualResults,
  // videoFile, and runDurationMs extracted to useComputedResults hook

  // Feature #1880: visualMarkers extracted to useComputedResults hook
  // Feature #46: seekVisualVideoToMarker and handleVisualVideoTimeUpdate moved to useTestRunHandlers hook

  // Feature #1865: Fetch video when available
  useEffect(() => {
    let objectUrl: string | null = null;

    const fetchVideo = async () => {
      if (!videoFile || !token) return;

      setVideoLoading(true);
      setVideoError(null);

      try {
        const response = await fetch(`/api/v1/videos/${videoFile}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          throw new Error(`Failed to load video: ${response.status}`);
        }

        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        setVideoUrl(objectUrl);
      } catch (err) {
        setVideoError(err instanceof Error ? err.message : 'Failed to load video');
      } finally {
        setVideoLoading(false);
      }
    };

    fetchVideo();

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [videoFile, token]);

  // Feature #46: seekVideoToTime, handleVideoTimeUpdate, handleVideoDownload moved to useTestRunHandlers hook

  // Feature #46: Data fetching useEffects (fetchRunData, fetchPreviousRuns, fetchCompareRun)
  // moved to useTestRunData hook

  // Feature #1844: WebSocket connection for live updates + polling fallback
  useEffect(() => {
    if (!runId || !token) return;

    // Only connect WebSocket if run is in progress
    if (run?.status !== 'running' && run?.status !== 'pending') {
      setLiveMode(false);
      return;
    }

    setLiveMode(true);

    // Create WebSocket connection
    const socket = io(window.location.origin, {
      auth: { token },
      query: { runId },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    // Handle connection events
    socket.on('connect', () => {
      console.log('Live updates connected');
      socket.emit('subscribe:run', { runId });
    });

    // Handle live step updates
    socket.on('run:step', (data: { action: string; selector?: string; stepIndex: number; totalSteps: number }) => {
      setCurrentStep({
        action: data.action,
        selector: data.selector,
        progress: ((data.stepIndex + 1) / data.totalSteps) * 100,
      });
      setExecutionProgress({
        current: data.stepIndex + 1,
        total: data.totalSteps,
        eta: undefined, // Could calculate based on average step time
      });
    });

    // Handle live screenshots
    socket.on('run:screenshot', (data: { screenshot: string }) => {
      setLiveScreenshot(data.screenshot);
    });

    // Handle live console logs
    socket.on('run:console', (data: { level: string; message: string; timestamp: number }) => {
      setLiveConsoleLogs(prev => [...prev.slice(-50), data]); // Keep last 50 logs
    });

    // Handle live metrics (for load tests)
    socket.on('run:metrics', (data: { rps?: number; responseTime?: number; vus?: number }) => {
      setLiveMetrics(data);
    });

    // Handle run completion
    socket.on('run:complete', (data: { status: string }) => {
      setLiveMode(false);
      // Refresh the run data by incrementing retryTrigger
      setRetryTrigger(prev => prev + 1);
    });

    // Handle run error
    socket.on('run:error', (data: { error: string }) => {
      setLiveMode(false);
      // Refresh the run data to show error state
      setRetryTrigger(prev => prev + 1);
    });

    // Feature #18: Polling fallback - poll every 3 seconds to detect run completion
    // This handles cases where WebSocket events are missed (e.g., run completes before socket connects)
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/v1/runs/${runId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          const status = data.run?.status;
          if (status !== 'running' && status !== 'pending') {
            // Run has completed - refresh data via hook and exit live mode
            setLiveMode(false);
            setRetryTrigger(prev => prev + 1); // Trigger data refresh in useTestRunData hook
            clearInterval(pollInterval);
          }
        }
      } catch {
        // Ignore polling errors - WebSocket is primary
      }
    }, 3000);

    // Cleanup
    return () => {
      socket.disconnect();
      socketRef.current = null;
      clearInterval(pollInterval);
    };
  }, [runId, token, run?.status]);

  // Feature #46: cancelTest, toggleStep, handleStepVideoSeek moved to useTestRunHandlers hook

  // Feature #46: formatDuration, formatDateTime, formatStepTime, formatRelativeTime, formatBytes imported from components/test-run-results

  // Feature #1834: Open lightbox at specific index
  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  // Feature #1834: Navigate lightbox
  const navigateLightbox = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setLightboxIndex(prev => (prev > 0 ? prev - 1 : allScreenshots.length - 1));
    } else {
      setLightboxIndex(prev => (prev < allScreenshots.length - 1 ? prev + 1 : 0));
    }
  };

  // Feature #46: toggleComparisonSelect, downloadScreenshot, downloadAllAsZip, downloadGroupAsZip moved to useTestRunHandlers hook

  // Feature #1834: Get screenshot type badge color
  const getScreenshotTypeBadge = (type: ScreenshotItem['type']) => {
    switch (type) {
      case 'final': return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
      case 'baseline': return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
      case 'diff': return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
      case 'step_before': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300';
      case 'step_after': return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  // Feature #46: CircularGauge imported from components/test-run-results
  // Feature #46: Toggle handlers (toggleOpportunity, toggleDiagnostic, togglePassedAudit, toggleEndpoint) moved to useMetricsState hook
  // Feature #46: getScoreColorClass and getScoreBgClass imported from components/test-run-results/utils

  // Feature #46: exportK6Results moved to useTestRunHandlers hook

  // Feature #46: exportK6ResultsPDF imported from components/test-run-results/pdfExport

  // Feature #46: exportLighthousePDF imported from components/test-run-results/pdfExport

  // Feature #1836: Generate mock time series data if not available
  const generateK6TimeSeries = (loadTestData: any): Array<{ time: string; vus: number; rps: number; avg_response_time: number; p95_response_time: number }> => {
    // If actual time series data exists, use it
    if (loadTestData?.time_series && loadTestData.time_series.length > 0) {
      return loadTestData.time_series;
    }

    // Generate simulated data based on duration and summary
    const duration = loadTestData?.duration?.actual || loadTestData?.duration?.configured || 60;
    const maxVUs = loadTestData?.virtual_users?.max_concurrent || loadTestData?.virtual_users?.configured || 10;
    const avgRPS = parseFloat(loadTestData?.summary?.requests_per_second) || 100;
    const avgResponseTime = loadTestData?.response_times?.avg || 200;
    const p95ResponseTime = loadTestData?.response_times?.p95 || 500;

    const points: Array<{ time: string; vus: number; rps: number; avg_response_time: number; p95_response_time: number }> = [];
    const interval = Math.max(1, Math.floor(duration / 30)); // ~30 data points

    for (let t = 0; t <= duration; t += interval) {
      // Simulate ramp-up in first 10%, plateau, then ramp-down in last 10%
      const progress = t / duration;
      let vuMultiplier: number;
      if (progress < 0.1) {
        vuMultiplier = progress / 0.1; // Ramp up
      } else if (progress > 0.9) {
        vuMultiplier = (1 - progress) / 0.1; // Ramp down
      } else {
        vuMultiplier = 1; // Plateau
      }

      // Add some variance
      const variance = 0.9 + Math.random() * 0.2;

      points.push({
        time: `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`,
        vus: Math.round(maxVUs * vuMultiplier),
        rps: Math.round(avgRPS * vuMultiplier * variance),
        avg_response_time: Math.round(avgResponseTime * variance),
        p95_response_time: Math.round(p95ResponseTime * variance),
      });
    }

    return points;
  };

  // Feature #1836: Generate response time distribution histogram
  const generateResponseTimeHistogram = (loadTestData: any): Array<{ range: string; count: number; percentage: number }> => {
    // If actual histogram data exists, use it
    if (loadTestData?.response_time_distribution && loadTestData.response_time_distribution.length > 0) {
      return loadTestData.response_time_distribution;
    }

    // Generate simulated distribution based on percentiles
    const rt = loadTestData?.response_times || {};
    const min = rt.min || 50;
    const median = rt.median || 200;
    const p95 = rt.p95 || 500;
    const max = rt.max || 2000;

    // Create histogram buckets
    const buckets = [
      { range: `0-${Math.round(min * 1.5)}ms`, percentage: 15 },
      { range: `${Math.round(min * 1.5)}-${Math.round(median * 0.8)}ms`, percentage: 25 },
      { range: `${Math.round(median * 0.8)}-${Math.round(median * 1.2)}ms`, percentage: 30 },
      { range: `${Math.round(median * 1.2)}-${Math.round(p95 * 0.8)}ms`, percentage: 18 },
      { range: `${Math.round(p95 * 0.8)}-${Math.round(p95)}ms`, percentage: 8 },
      { range: `${Math.round(p95)}-${Math.round(max)}ms`, percentage: 4 },
    ];

    const totalRequests = loadTestData?.summary?.total_requests || 10000;
    return buckets.map(b => ({
      range: b.range,
      count: Math.round(totalRequests * b.percentage / 100),
      percentage: b.percentage,
    }));
  };

  // Feature #46: Visual test handlers (toggleVisualResult, handleSliderChange, handleOnionOpacityChange,
  // handleZoomIn/Out/Reset/Fit, handlePanStart/Move/End, handleWheelZoom, handleApproveBaseline,
  // handleRejectBaseline) are provided by useVisualTestState hook
  // Feature #1838: Accessibility state functions moved to useAccessibilityState hook

  // Feature #1839: Toggle network request expansion to show request/response details
  const toggleNetworkItem = (index: number) => {
    setExpandedNetworkItems(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  // Feature #1839: Create unified log entries from console logs and network requests
  interface UnifiedLogEntry {
    type: 'console' | 'network';
    timestamp: number;
    level?: 'log' | 'info' | 'warn' | 'error' | 'debug';
    message: string;
    location?: string;
    // Network-specific
    method?: string;
    url?: string;
    status?: number;
    duration_ms?: number;
    requestSize?: number;
    responseSize?: number;
    failed?: boolean;
    failureText?: string;
    resourceType?: string;
    requestBody?: string;
    responseBody?: string;
    originalIndex?: number;
  }

  const getUnifiedLogs = useMemo((): UnifiedLogEntry[] => {
    if (!run?.results) return [];

    const entries: UnifiedLogEntry[] = [];

    // Add console logs
    run.results.forEach(result => {
      (result.console_logs || []).forEach(log => {
        entries.push({
          type: 'console',
          timestamp: log.timestamp,
          level: log.level,
          message: log.message,
          location: log.location,
        });
      });
    });

    // Add network requests
    run.results.forEach(result => {
      (result.network_requests || []).forEach((req, idx) => {
        const statusLevel = !req.status ? 'warn' :
          req.status >= 400 ? 'error' :
          req.status >= 300 ? 'warn' : 'info';

        entries.push({
          type: 'network',
          timestamp: req.timestamp,
          level: statusLevel as 'info' | 'warn' | 'error',
          message: `${req.method} ${req.url}`,
          method: req.method,
          url: req.url,
          status: req.status,
          duration_ms: req.duration_ms,
          requestSize: req.requestSize,
          responseSize: req.responseSize,
          failed: req.failed,
          failureText: req.failureText,
          resourceType: req.resourceType,
          originalIndex: idx,
        });
      });
    });

    // Sort by timestamp
    return entries.sort((a, b) => a.timestamp - b.timestamp);
  }, [run]);

  // Feature #1839: Filter logs based on current filter state
  const filteredLogs = useMemo(() => {
    return getUnifiedLogs.filter(log => {
      // Apply type filter
      if (log.type === 'console') {
        if (log.level === 'error' && !logsFilter.errors) return false;
        if (log.level === 'warn' && !logsFilter.warnings) return false;
        if (log.level === 'info' && !logsFilter.info) return false;
        if ((log.level === 'log' || log.level === 'debug') && !logsFilter.debug) return false;
      } else if (log.type === 'network') {
        if (!logsFilter.network) return false;
        if (log.failed && !logsFilter.failedRequests) return false;
      }

      // Apply search filter
      if (logsSearch.trim()) {
        const searchLower = logsSearch.toLowerCase();
        const matchMessage = log.message.toLowerCase().includes(searchLower);
        const matchUrl = log.url?.toLowerCase().includes(searchLower);
        const matchLocation = log.location?.toLowerCase().includes(searchLower);
        if (!matchMessage && !matchUrl && !matchLocation) return false;
      }

      return true;
    });
  }, [getUnifiedLogs, logsFilter, logsSearch]);

  // Feature #1839: Export logs
  const exportLogs = (format: 'json' | 'txt') => {
    const dataToExport = filteredLogs.map(log => ({
      type: log.type,
      timestamp: new Date(log.timestamp).toISOString(),
      level: log.level,
      message: log.message,
      ...(log.type === 'network' && {
        method: log.method,
        url: log.url,
        status: log.status,
        duration_ms: log.duration_ms,
        resourceType: log.resourceType,
        failed: log.failed,
        failureText: log.failureText,
      }),
      ...(log.type === 'console' && log.location && { location: log.location }),
    }));

    let content: string;
    let filename: string;
    let mimeType: string;

    if (format === 'json') {
      content = JSON.stringify(dataToExport, null, 2);
      filename = `logs-${runId}-${Date.now()}.json`;
      mimeType = 'application/json';
    } else {
      content = dataToExport.map(log => {
        const timestamp = log.timestamp;
        const level = (log.level || 'info').toUpperCase().padEnd(5);
        const type = log.type.toUpperCase().padEnd(7);
        let line = `[${timestamp}] [${type}] [${level}] ${log.message}`;
        if (log.type === 'network') {
          line += ` | Status: ${log.status || 'N/A'} | Duration: ${log.duration_ms || '-'}ms`;
        }
        if (log.location) {
          line += ` @ ${log.location}`;
        }
        return line;
      }).join('\n');
      filename = `logs-${runId}-${Date.now()}.txt`;
      mimeType = 'text/plain';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Feature #1839: Get log counts by type
  const logCounts = useMemo(() => {
    const counts = {
      total: getUnifiedLogs.length,
      errors: 0,
      warnings: 0,
      info: 0,
      debug: 0,
      network: 0,
      failedRequests: 0,
    };

    getUnifiedLogs.forEach(log => {
      if (log.type === 'console') {
        if (log.level === 'error') counts.errors++;
        else if (log.level === 'warn') counts.warnings++;
        else if (log.level === 'info') counts.info++;
        else counts.debug++;
      } else if (log.type === 'network') {
        counts.network++;
        if (log.failed || (log.status && log.status >= 400)) counts.failedRequests++;
      }
    });

    return counts;
  }, [getUnifiedLogs]);

  // Feature #46: Network waterfall data (waterfallData, filteredNetworkRequests, waterfallBounds,
  // networkStats, getWaterfallPosition, exportHAR, toggleNetworkType) provided by useNetworkAnalysisState hook

  // Feature #1841: Toggle result card expansion
  const toggleResultCard = (testId: string) => {
    setExpandedResultCards(prev => {
      const next = new Set(prev);
      if (next.has(testId)) {
        next.delete(testId);
      } else {
        next.add(testId);
      }
      return next;
    });
  };

  // Feature #1841: Get key metric for a test result based on type
  // Feature #1980: Show correct test type badge - check visual indicators and use testInfo fallback
  const getKeyMetric = (result: TestResult) => {
    // Check for performance metrics
    const perfStep = result.steps.find(s => s.lighthouse);
    if (perfStep?.lighthouse) {
      return {
        label: 'LCP',
        value: perfStep.lighthouse.metrics?.lcp
          ? `${(perfStep.lighthouse.metrics.lcp / 1000).toFixed(2)}s`
          : `${perfStep.lighthouse.performance}%`,
        type: 'performance',
      };
    }

    // Check for accessibility metrics
    const a11yStep = result.steps.find(s => s.accessibility);
    if (a11yStep?.accessibility) {
      return {
        label: 'Violations',
        value: a11yStep.accessibility.violations.length.toString(),
        type: 'accessibility',
      };
    }

    // Check for load test metrics
    if (result.load_test) {
      return {
        label: 'RPS',
        value: result.load_test?.summary?.requests_per_second ?? 'N/A',
        type: 'load',
      };
    }

    // Feature #1980: Check for visual regression - also check for baseline/diff images
    // Visual tests may not have visual_comparison if it's first run (no baseline yet)
    if (result.visual_comparison || result.baseline_screenshot_base64 || result.diff_image_base64) {
      return {
        label: 'Diff',
        value: result.diff_percentage !== undefined ? `${result.diff_percentage.toFixed(2)}%` : 'N/A',
        type: 'visual',
      };
    }

    // Feature #1980: Use testInfo.type as fallback for correct badge display
    // This handles cases where test type-specific data isn't in the result
    if (testInfo?.type) {
      const typeMapping: Record<string, string> = {
        'visual_regression': 'visual',
        'lighthouse': 'performance',
        'load': 'load',
        'accessibility': 'accessibility',
        'e2e': 'e2e',
      };
      const mappedType = typeMapping[testInfo.type] || 'e2e';
      return {
        label: mappedType === 'visual' ? 'Visual' : 'Steps',
        value: mappedType === 'visual' ? 'First Run' : result.steps.length.toString(),
        type: mappedType,
      };
    }

    // Default: show step count
    return {
      label: 'Steps',
      value: result.steps.length.toString(),
      type: 'e2e',
    };
  };

  // Feature #1841: Filter results based on selected filter
  const filteredResults = useMemo(() => {
    if (!run?.results) return [];
    return run.results.filter(r => {
      if (selectedResultsFilter === 'all') return true;
      if (selectedResultsFilter === 'passed') return r.status === 'passed';
      if (selectedResultsFilter === 'failed') return r.status === 'failed' || r.status === 'error';
      if (selectedResultsFilter === 'skipped') return r.status === 'skipped';
      return true;
    });
  }, [run, selectedResultsFilter]);

  // Feature #1841: Rerun failed tests
  const rerunFailedTests = async () => {
    const failedTestIds = run?.results
      .filter(r => r.status === 'failed' || r.status === 'error')
      .map(r => r.test_id) || [];

    if (failedTestIds.length === 0) return;

    try {
      setRerunningTests(new Set(failedTestIds));

      const response = await fetch('/api/v1/runs/rerun', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          suite_id: run?.suite_id,
          test_ids: failedTestIds,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Navigate to new run
        navigate(`/runs/${data.run_id}`);
      }
    } catch (err) {
      console.error('Failed to rerun tests:', err);
    } finally {
      setRerunningTests(new Set());
    }
  };

  // Feature #1841: Export results
  // Feature #1994: Enhanced with Type, Browser, Timestamp columns
  const exportResults = (format: 'json' | 'csv') => {
    if (!run?.results) return;

    // Helper to infer test type
    const getTestType = (r: typeof run.results[0]): string => {
      if (r.test_type) {
        const typeMap: Record<string, string> = {
          'visual_regression': 'Visual',
          'lighthouse': 'Performance',
          'load': 'Load',
          'accessibility': 'Accessibility',
          'e2e': 'E2E',
        };
        return typeMap[r.test_type] || r.test_type;
      }
      if (r.steps.some(s => s.lighthouse)) return 'Performance';
      if (r.steps.some(s => s.accessibility)) return 'Accessibility';
      if (r.visual_comparison || r.baseline_screenshot_base64) return 'Visual';
      if (r.steps.some(s => s.load_test)) return 'Load';
      return 'E2E';
    };

    const data = run.results.map(r => ({
      test_id: r.test_id,
      test_name: r.test_name,
      test_type: getTestType(r),
      status: r.status,
      duration_ms: r.duration_ms,
      duration_formatted: formatDuration(r.duration_ms),
      error: r.error || null,
      browser: run.browser || 'chromium',
      timestamp: run.started_at ? new Date(run.started_at).toISOString() : new Date(run.created_at).toISOString(),
      steps_count: r.steps.length,
      failed_steps: r.steps.filter(s => s.status === 'failed').length,
    }));

    let content: string;
    let filename: string;
    let mimeType: string;

    if (format === 'json') {
      content = JSON.stringify(data, null, 2);
      filename = `test-results-${runId}-${Date.now()}.json`;
      mimeType = 'application/json';
    } else {
      // Feature #1994: CSV headers include Type, Browser, Timestamp
      const headers = ['test_name', 'test_type', 'status', 'duration_formatted', 'error', 'browser', 'timestamp', 'steps_count', 'failed_steps'];
      const csvRows = [headers.join(',')];
      data.forEach(row => {
        csvRows.push(headers.map(h => {
          const value = row[h as keyof typeof row];
          if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value ?? '';
        }).join(','));
      });
      content = csvRows.join('\n');
      filename = `test-results-${runId}-${Date.now()}.csv`;
      mimeType = 'text/csv';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Feature #1842: Compare run summary
  const compareRunSummary = useMemo(() => {
    if (!compareRun?.results) return { passed: 0, failed: 0, skipped: 0, total: 0 };
    return {
      passed: compareRun.results.filter(r => r.status === 'passed').length,
      failed: compareRun.results.filter(r => r.status === 'failed' || r.status === 'error').length,
      skipped: compareRun.results.filter(r => r.status === 'skipped').length,
      total: compareRun.results.length,
    };
  }, [compareRun]);

  // Feature #1842: Calculate delta between current and compare run
  const calculateDelta = (current: number, baseline: number): { value: number; direction: 'up' | 'down' | 'same' } => {
    const delta = current - baseline;
    return {
      value: Math.abs(delta),
      direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'same',
    };
  };

  // Feature #1842: Get comparison metrics
  const comparisonMetrics = useMemo(() => {
    if (!run || !compareRun) return null;

    const durationDelta = calculateDelta(run.duration_ms || 0, compareRun.duration_ms || 0);
    const passedDelta = calculateDelta(resultSummary.passed, compareRunSummary.passed);
    const failedDelta = calculateDelta(resultSummary.failed, compareRunSummary.failed);

    return {
      duration: {
        current: run.duration_ms || 0,
        baseline: compareRun.duration_ms || 0,
        delta: durationDelta,
        improved: durationDelta.direction === 'down', // faster is better
      },
      passed: {
        current: resultSummary.passed,
        baseline: compareRunSummary.passed,
        delta: passedDelta,
        improved: passedDelta.direction === 'up', // more passed is better
      },
      failed: {
        current: resultSummary.failed,
        baseline: compareRunSummary.failed,
        delta: failedDelta,
        improved: failedDelta.direction === 'down', // fewer failed is better
      },
      total: {
        current: resultSummary.total,
        baseline: compareRunSummary.total,
      },
    };
  }, [run, compareRun, resultSummary, compareRunSummary]);

  // Feature #1843 + #1988 + #46: Generate PDF report (extracted to reportGenerators.ts)
  const handleGeneratePdfReport = async () => {
    if (!run) return;
    await generatePdfReport({
      run,
      resultSummary,
      pdfSections,
      logoBase64,
      organizationName,
      setGeneratingPdf,
    });
  };


  // Feature #1843: Export full JSON
  const exportFullJson = () => {
    if (!run) return;

    const fullData = {
      run: {
        id: run.id,
        suite_id: run.suite_id,
        status: run.status,
        started_at: run.started_at,
        completed_at: run.completed_at,
        duration_ms: run.duration_ms,
        created_at: run.created_at,
      },
      summary: resultSummary,
      results: run.results.map(r => ({
        test_id: r.test_id,
        test_name: r.test_name,
        status: r.status,
        duration_ms: r.duration_ms,
        error: r.error,
        steps: r.steps.map(s => ({
          id: s.id,
          action: s.action,
          selector: s.selector,
          status: s.status,
          duration_ms: s.duration_ms,
          error: s.error,
        })),
        console_logs_count: r.console_logs?.length || 0,
        network_requests_count: r.network_requests?.length || 0,
      })),
      console_logs: consoleLogs,
      network_requests: networkRequests.map(r => ({
        method: r.method,
        url: r.url,
        status: r.status,
        duration_ms: r.duration_ms,
        resourceType: r.resourceType,
      })),
      generated_at: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(fullData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test-report-${run.id}-full.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Feature #1993 + #46: Generate HTML report (extracted to reportGenerators.ts)
  const handleGenerateHtmlReport = () => {
    if (!run) return;
    generateHtmlReport({
      run,
      resultSummary,
      setGeneratingHtml,
    });
  };

  // Feature #1843: Generate shareable link
  const generateShareLink = async () => {
    if (!run || !token) return;

    setGeneratingShare(true);
    try {
      const response = await fetch('/api/v1/runs/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          run_id: run.id,
          expiry: shareLinkExpiry,
          password: shareLinkPassword || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setShareLink(data.share_url || `${window.location.origin}/shared/${data.share_id}`);
      } else {
        // Fallback: generate a mock share link for demo
        const mockShareId = btoa(`${run.id}-${Date.now()}`).replace(/=/g, '');
        setShareLink(`${window.location.origin}/shared/run/${mockShareId}`);
      }
    } catch {
      // Fallback for demo
      const mockShareId = btoa(`${run.id}-${Date.now()}`).replace(/=/g, '');
      setShareLink(`${window.location.origin}/shared/run/${mockShareId}`);
    } finally {
      setGeneratingShare(false);
    }
  };

  // Feature #1843: Copy share link to clipboard
  const copyShareLink = async () => {
    if (shareLink) {
      await navigator.clipboard.writeText(shareLink);
    }
  };

  // Feature #46: allSteps, screenshots, allScreenshots extracted to useComputedResults hook

  // Feature #1834: Keyboard navigation for lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!lightboxOpen) return;

      switch (e.key) {
        case 'Escape':
          setLightboxOpen(false);
          break;
        case 'ArrowLeft':
          navigateLightbox('prev');
          break;
        case 'ArrowRight':
          navigateLightbox('next');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, allScreenshots.length]);

  // Feature #46: Extract event handlers to useTestRunHandlers hook
  // Note: toggleOpportunity, toggleDiagnostic, togglePassedAudit, toggleEndpoint come from useMetricsState
  // Note: handleZoomIn/Out/Reset/Fit, handlePanStart/Move/End, handleWheelZoom, handleApproveBaseline,
  //       handleRejectBaseline, seekVisualVideoToMarker, handleVisualVideoTimeUpdate come from useVisualTestState
  const {
    toggleStep,
    toggleViolation,
    toggleComparisonSelect,
    analyzePerformanceResults,
    exportK6Results,
    downloadAllAsZip,
    downloadGroupAsZip,
    downloadScreenshot,
    seekVideoToTime,
    handleVideoTimeUpdate,
    handleVideoDownload,
    handleStepVideoSeek,
    cancelTest,
  } = useTestRunHandlers({
    videoRef,
    visualVideoRef,
    token,
    runId,
    run,
    videoUrl,
    runDurationMs,
    allScreenshots,
    visualZoom,
    visualPan,
    isPanning,
    panStart,
    setExpandedSteps,
    setExpandedOpportunities,
    setExpandedDiagnostics,
    setExpandedPassedAudits,
    setExpandedEndpoints,
    setA11yExpandedViolations,
    setSelectedForComparison,
    setApprovalLoading,
    setRetryTrigger,
    setVisualZoom,
    setVisualPan,
    setIsPanning,
    setPanStart,
    setIsVideoPlaying,
    setCurrentVideoTime,
    setIsVisualVideoPlaying,
    setVisualVideoCurrentTime,
    setDownloadingZip,
    setCancellingTest,
    setLiveMode,
    setPerfAILoading,
    setPerfAIError,
    setPerfAIAnalysisOpen,
    setPerfAIResult,
  });

  // Feature #1954: Batch analysis for multiple failures
  const handleBatchAnalysis = async () => {
    if (!run || !token) return;

    // Get all failed tests
    const failedTests = run.results.filter(r => r.status === 'failed' || r.status === 'error');
    if (failedTests.length < 2) return;

    // Check cache using run ID as key
    const cacheKey = `batch_${run.id}`;
    try {
      const cachedStr = localStorage.getItem(`ai_batch_${cacheKey}`);
      if (cachedStr) {
        const cached = JSON.parse(cachedStr);
        if (Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
          setBatchAnalysisResult(cached.analysis);
          setBatchAnalysisCached(true);
          setBatchAnalysisOpen(true);
          console.log('[AI Cache] Using cached batch analysis');
          return;
        }
      }
    } catch (e) {
      // Ignore cache errors
    }

    setBatchAnalysisOpen(true);
    setBatchAnalysisLoading(true);
    setBatchAnalysisResult(null);
    setBatchAnalysisCached(false);

    // Step 2: Collect error summaries (not full data)
    const errorSummaries = failedTests.map(t => {
      const failedStep = t.steps.find(s => s.status === 'failed');
      return {
        test_name: t.test_name,
        error: (t.error || failedStep?.error || 'Unknown error').slice(0, 200),
        selector: failedStep?.selector,
        action: failedStep?.action,
        duration_ms: t.duration_ms,
      };
    });

    try {
      const response = await fetch('https://qa.pixelcraftedmedia.com/api/v1/mcp-tools/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: `Analyze these ${failedTests.length} test failures and find the COMMON ROOT CAUSE.

Failed Tests:
${JSON.stringify(errorSummaries, null, 2)}

Please identify:
1. **Most Likely Root Cause**: What single issue is causing multiple tests to fail?
2. **Common Patterns**: Shared selectors, pages, timing issues, or error types
3. **Priority Fix**: What ONE thing should be fixed to resolve multiple failures?
4. **Individual vs Systemic**: Are these independent failures or related to the same underlying issue?`,
          complexity: 'simple', // Use Haiku for cost efficiency
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const analysis = data.response || data.content || 'No analysis available';
        setBatchAnalysisResult(analysis);
        // Cache the result
        try {
          localStorage.setItem(`ai_batch_${cacheKey}`, JSON.stringify({
            analysis,
            timestamp: Date.now(),
          }));
        } catch (e) {
          // Storage full
        }
        console.log('[AI Triggered] Batch failure analysis for', failedTests.length, 'tests');
      } else {
        setBatchAnalysisResult('Failed to analyze failures. Please try again.');
      }
    } catch (error) {
      console.error('Batch analysis failed:', error);
      setBatchAnalysisResult('Error connecting to AI service. Please try again.');
    } finally {
      setBatchAnalysisLoading(false);
    }
  };

  // Feature #1971: Ask AI button and related functions DELETED
  // AI analysis is now ONLY available on the Visual Review page for diff analysis

  // Feature #46: analyzePerformanceResults moved to useTestRunHandlers hook

  // Feature #1936: AI analysis for accessibility violations - wrapper that passes token to hook function
  const analyzeAccessibilityResults = useCallback(async (testName: string, a11y: any) => {
    if (!token) return;
    await analyzeA11y(testName, a11y, token);
  }, [token, analyzeA11y]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <svg className="animate-spin h-8 w-8 mx-auto text-primary mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-muted-foreground">Loading run details...</p>
        </div>
      </div>
    );
  }

  if (error || !run) {
    // Feature #1929: Enhanced error UI with retry button and specific error icons
    const isNotFound = error?.includes('not found') || error?.includes('404');
    const isPermission = error?.includes('permission') || error?.includes('401') || error?.includes('403');
    const isServer = error?.includes('Server error') || error?.includes('500');
    const isNetwork = error?.includes('Network error') || error?.includes('internet');

    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-center">
          {/* Error Icon */}
          <div className="mb-4">
            {isNotFound ? (
              <svg className="w-16 h-16 mx-auto text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : isPermission ? (
              <svg className="w-16 h-16 mx-auto text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            ) : isServer ? (
              <svg className="w-16 h-16 mx-auto text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
              </svg>
            ) : isNetwork ? (
              <svg className="w-16 h-16 mx-auto text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
              </svg>
            ) : (
              <svg className="w-16 h-16 mx-auto text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
          </div>

          {/* Error Title */}
          <h2 className="text-xl font-semibold text-destructive mb-2">
            {isNotFound ? 'Run Not Found' :
             isPermission ? 'Access Denied' :
             isServer ? 'Server Error' :
             isNetwork ? 'Connection Error' :
             'Error Loading Run'}
          </h2>

          {/* Error Message */}
          <p className="text-muted-foreground mb-6">
            {error || 'The test run could not be loaded. Please try again.'}
          </p>

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-3">
            {/* Feature #1929: Retry button for recoverable errors */}
            {!isNotFound && !isPermission && (
              <button
                onClick={() => setRetryTrigger(prev => prev + 1)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Try Again
              </button>
            )}
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 px-4 py-2 border border-border rounded-md text-foreground hover:bg-muted transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Go Back
            </button>
          </div>

          {/* Run ID info for debugging */}
          <p className="text-xs text-muted-foreground mt-6">
            Run ID: {runId}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Breadcrumb Navigation - Feature #1970: Fixed to never show undefined */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link to="/projects" className="hover:text-primary">Projects</Link>
        <span>/</span>
        {suiteInfo?.project_id && suiteInfo?.id && suiteInfo?.name && (
          <>
            <Link to={`/projects/${suiteInfo.project_id}`} className="hover:text-primary">Project</Link>
            <span>/</span>
            <Link to={`/suites/${suiteInfo.id}`} className="hover:text-primary">{suiteInfo.name}</Link>
            <span>/</span>
          </>
        )}
        {testInfo?.id && testInfo?.name && (
          <>
            <Link to={`/tests/${testInfo.id}`} className="hover:text-primary">{testInfo.name}</Link>
            <span>/</span>
          </>
        )}
        <span className="text-foreground font-medium">Run Results</span>
      </nav>

      {/* Header with Run Overview */}
      <div className="bg-card border border-border rounded-lg p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Test Run Results
            </h1>
            <p className="text-muted-foreground">
              Run ID: {run.id}{testInfo?.name ? ` | ${testInfo.name}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
              run.status === 'passed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
              run.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
              run.status === 'running' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
              run.status === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
              'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
            }`}>
              {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
            </span>
            {/* Feature #1842: Compare button */}
            {previousRuns.length > 0 && (
              <button
                onClick={() => setCompareMode(!compareMode)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
                  compareMode
                    ? 'bg-blue-600 text-white'
                    : 'border border-border text-foreground hover:bg-muted'
                }`}
                title="Compare with previous runs"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Compare
              </button>
            )}
            {/* Feature #1843: Export button */}
            <button
              onClick={() => setExportModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 border border-border rounded-md text-foreground hover:bg-muted transition-all"
              title="Export test results"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export
            </button>
            {/* Feature #1962: AI button removed - AI analysis now only on Visual Review page */}
            {/* Feature #1951: Show tip for simple known errors (no AI cost) */}
            {run.status !== 'passed' && errorAnalysis.isSimple && (
              <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md text-sm">
                <svg className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-amber-800 dark:text-amber-200">
                  <strong>Tip:</strong> {errorAnalysis.tip}
                </span>
              </div>
            )}
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 border border-border rounded-md text-foreground hover:bg-muted"
            >
              Back
            </button>
          </div>
        </div>

        {/* Feature #1858: Executive Summary Card - Using modular component (Feature #46) */}
        <ExecutiveSummary
          resultSummary={resultSummary}
          runId={run?.id || runId}
          onViewFailures={() => setActiveTab('results')}
        />

        {/* Summary Cards - Using modular component (Feature #46) */}
        <SummaryCards
          resultSummary={resultSummary}
          durationMs={run.duration_ms}
          startedAt={run.started_at}
          completedAt={run.completed_at}
        />

        {/* Feature #1842: Comparison Panel */}
        {compareMode && (
          <div className="mt-6 pt-6 border-t border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-foreground">Compare with Previous Run</h3>
              <select
                value={selectedCompareRunId || ''}
                onChange={(e) => setSelectedCompareRunId(e.target.value || null)}
                className="px-3 py-1.5 border border-border rounded-md bg-background text-foreground"
              >
                <option value="">Select a run to compare...</option>
                {previousRuns.map(prevRun => (
                  <option key={prevRun.id} value={prevRun.id}>
                    {new Date(prevRun.created_at).toLocaleString()} - {prevRun.status}
                  </option>
                ))}
              </select>
            </div>

            {loadingCompareRun && (
              <div className="text-center py-4">
                <svg className="animate-spin h-6 w-6 mx-auto text-primary" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            )}

            {comparisonMetrics && (
              <div className="space-y-4">
                {/* Comparison Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Duration */}
                  <div className={`p-4 rounded-lg border ${
                    comparisonMetrics.duration.improved
                      ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                      : comparisonMetrics.duration.delta.direction !== 'same'
                      ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                      : 'bg-muted/50 border-border'
                  }`}>
                    <div className="text-sm text-muted-foreground mb-1">Duration</div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-foreground">
                        {formatDuration(comparisonMetrics.duration.current)}
                      </span>
                      {comparisonMetrics.duration.delta.direction !== 'same' && (
                        <span className={`flex items-center text-sm ${
                          comparisonMetrics.duration.improved ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {comparisonMetrics.duration.delta.direction === 'down' ? (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                            </svg>
                          )}
                          {formatDuration(comparisonMetrics.duration.delta.value)}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      vs {formatDuration(comparisonMetrics.duration.baseline)}
                    </div>
                  </div>

                  {/* Passed */}
                  <div className={`p-4 rounded-lg border ${
                    comparisonMetrics.passed.improved
                      ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                      : comparisonMetrics.passed.delta.direction !== 'same'
                      ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                      : 'bg-muted/50 border-border'
                  }`}>
                    <div className="text-sm text-muted-foreground mb-1">Passed</div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-green-600 dark:text-green-400">
                        {comparisonMetrics.passed.current}
                      </span>
                      {comparisonMetrics.passed.delta.direction !== 'same' && (
                        <span className={`flex items-center text-sm ${
                          comparisonMetrics.passed.improved ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {comparisonMetrics.passed.delta.direction === 'up' ? '+' : '-'}
                          {comparisonMetrics.passed.delta.value}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      vs {comparisonMetrics.passed.baseline}
                    </div>
                  </div>

                  {/* Failed */}
                  <div className={`p-4 rounded-lg border ${
                    comparisonMetrics.failed.improved
                      ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                      : comparisonMetrics.failed.delta.direction !== 'same'
                      ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                      : 'bg-muted/50 border-border'
                  }`}>
                    <div className="text-sm text-muted-foreground mb-1">Failed</div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-red-600 dark:text-red-400">
                        {comparisonMetrics.failed.current}
                      </span>
                      {comparisonMetrics.failed.delta.direction !== 'same' && (
                        <span className={`flex items-center text-sm ${
                          comparisonMetrics.failed.improved ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {comparisonMetrics.failed.delta.direction === 'up' ? '+' : '-'}
                          {comparisonMetrics.failed.delta.value}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      vs {comparisonMetrics.failed.baseline}
                    </div>
                  </div>

                  {/* Total */}
                  <div className="p-4 rounded-lg border bg-muted/50 border-border">
                    <div className="text-sm text-muted-foreground mb-1">Total Tests</div>
                    <div className="text-lg font-bold text-foreground">
                      {comparisonMetrics.total.current}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      vs {comparisonMetrics.total.baseline}
                    </div>
                  </div>
                </div>

                {/* Trend Chart */}
                {runHistory.length > 1 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-foreground mb-3">Trend (Last {runHistory.length} runs)</h4>
                    <div className="h-32 bg-muted/30 rounded-lg p-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={runHistory.slice().reverse()}>
                          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                          <XAxis
                            dataKey="created_at"
                            tickFormatter={(v) => new Date(v).toLocaleDateString()}
                            tick={{ fontSize: 10 }}
                            stroke="currentColor"
                            opacity={0.5}
                          />
                          <YAxis tick={{ fontSize: 10 }} stroke="currentColor" opacity={0.5} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'var(--background)',
                              border: '1px solid var(--border)',
                              borderRadius: '8px',
                            }}
                            labelFormatter={(v) => new Date(v).toLocaleString()}
                          />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="passed"
                            name="Passed"
                            stroke="#22c55e"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="failed"
                            name="Failed"
                            stroke="#ef4444"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Feature #1844: Live Execution View */}
      {liveMode && (run?.status === 'running' || run?.status === 'pending') && (
        <div className="bg-card border-2 border-blue-500 dark:border-blue-600 rounded-lg p-6 mb-6 shadow-lg shadow-blue-500/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="h-4 w-4 bg-blue-500 rounded-full animate-ping absolute"></div>
                <div className="h-4 w-4 bg-blue-500 rounded-full relative"></div>
              </div>
              <h2 className="text-lg font-semibold text-foreground">Live Execution</h2>
              <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full">
                {run?.status === 'pending' ? 'Starting...' : 'Running'}
              </span>
            </div>
            <button
              onClick={cancelTest}
              disabled={cancellingTest}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {cancellingTest ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              Cancel Test
            </button>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">
                Step {executionProgress.current} of {executionProgress.total || '?'}
              </span>
              {executionProgress.eta && (
                <span className="text-sm text-muted-foreground">
                  ETA: {formatDuration(executionProgress.eta)}
                </span>
              )}
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
                style={{ width: `${currentStep?.progress || 0}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Current Step */}
            <div className="p-4 bg-muted/30 rounded-lg">
              <h3 className="font-medium text-foreground mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-500 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Current Step
              </h3>
              {currentStep ? (
                <div className="space-y-2">
                  <div className="font-mono text-foreground bg-muted rounded px-3 py-2">
                    {currentStep.action}
                  </div>
                  {currentStep.selector && (
                    <div className="text-sm text-muted-foreground font-mono truncate">
                      Selector: {currentStep.selector}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-muted-foreground">Waiting for first step...</div>
              )}

              {/* Live Metrics (for load tests) */}
              {liveMetrics && (
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {liveMetrics.vus !== undefined && (
                    <div className="text-center p-2 bg-muted rounded">
                      <div className="text-lg font-bold text-foreground">{liveMetrics.vus}</div>
                      <div className="text-xs text-muted-foreground">VUs</div>
                    </div>
                  )}
                  {liveMetrics.rps !== undefined && (
                    <div className="text-center p-2 bg-muted rounded">
                      <div className="text-lg font-bold text-foreground">{liveMetrics.rps.toFixed(1)}</div>
                      <div className="text-xs text-muted-foreground">RPS</div>
                    </div>
                  )}
                  {liveMetrics.responseTime !== undefined && (
                    <div className="text-center p-2 bg-muted rounded">
                      <div className="text-lg font-bold text-foreground">{liveMetrics.responseTime}ms</div>
                      <div className="text-xs text-muted-foreground">Latency</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Live Screenshot */}
            <div className="p-4 bg-muted/30 rounded-lg">
              <h3 className="font-medium text-foreground mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Live Screenshot
              </h3>
              {liveScreenshot ? (
                <img
                  src={liveScreenshot.startsWith('data:') ? liveScreenshot : `data:image/png;base64,${liveScreenshot}`}
                  alt="Live screenshot"
                  className="w-full h-48 object-contain bg-black/50 rounded-lg"
                />
              ) : (
                <div className="w-full h-48 bg-muted rounded-lg flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm">Waiting for screenshot...</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Live Console Logs */}
          {liveConsoleLogs.length > 0 && (
            <div className="mt-6">
              <h3 className="font-medium text-foreground mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Live Console ({liveConsoleLogs.length})
              </h3>
              <div className="bg-gray-900 rounded-lg p-3 max-h-40 overflow-auto font-mono text-xs">
                {liveConsoleLogs.slice(-20).map((log, idx) => (
                  <div
                    key={idx}
                    className={`py-0.5 ${
                      log.level === 'error' ? 'text-red-400' :
                      log.level === 'warn' ? 'text-yellow-400' :
                      log.level === 'info' ? 'text-blue-400' :
                      'text-gray-300'
                    }`}
                  >
                    <span className="text-gray-500">[{new Date(log.timestamp).toISOString().split('T')[1].slice(0, 12)}]</span>
                    <span className="ml-1">{log.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab Navigation - Using modular component (Feature #46) */}
      <TabNavigation
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        tabs={[
          { id: 'results', label: 'Results', icon: '🧪', count: run.results?.length || 0 },
          { id: 'timeline', label: 'Timeline', icon: '📋', count: allSteps.length },
          { id: 'screenshots', label: 'Screenshots', icon: '📸', count: screenshots.length },
          { id: 'metrics', label: 'Metrics', icon: '📊', count: performanceResults.length + loadTestResults.length },
          { id: 'network', label: 'Network', icon: '🌐', count: networkRequests.length },
          { id: 'visual', label: 'Visual Diff', icon: '🎨', count: visualResults.length },
          { id: 'accessibility', label: 'Accessibility', icon: '♿', count: accessibilityResults.length },
          { id: 'logs', label: 'Logs', icon: '📝', count: consoleLogs.length },
        ]}
      />

      {/* Tab Content */}
      <div className="bg-card border border-border rounded-lg p-6">
        {/* Feature #46: Results Tab - Extracted to ResultsTab component */}
        {activeTab === 'results' && (
          <ResultsTab
            run={run}
            filteredResults={filteredResults}
            resultSummary={resultSummary}
            selectedResultsFilter={selectedResultsFilter}
            setSelectedResultsFilter={setSelectedResultsFilter}
            expandedResultCards={expandedResultCards}
            toggleResultCard={toggleResultCard}
            rerunningTests={rerunningTests}
            rerunFailedTests={rerunFailedTests}
            exportResults={exportResults}
            getKeyMetric={getKeyMetric}
            setActiveTab={setActiveTab}
          />
        )}
        {/* Timeline Tab - Feature #46: Extracted to TimelineTab component */}
        {activeTab === 'timeline' && (
          <TimelineTab
            run={run}
            allSteps={allSteps}
            expandedSteps={expandedSteps}
            toggleStep={toggleStep}
            showNetworkPerStep={showNetworkPerStep}
            setShowNetworkPerStep={setShowNetworkPerStep}
            showConsolePerStep={showConsolePerStep}
            setShowConsolePerStep={setShowConsolePerStep}
            selectedScreenshot={selectedScreenshot}
            setSelectedScreenshot={setSelectedScreenshot}
            videoFile={videoFile}
            videoUrl={videoUrl}
            videoRef={videoRef}
            videoLoading={videoLoading}
            videoError={videoError}
            isVideoPlaying={isVideoPlaying}
            setIsVideoPlaying={setIsVideoPlaying}
            currentVideoTime={currentVideoTime}
            runDurationMs={runDurationMs}
            handleVideoDownload={handleVideoDownload}
            handleVideoTimeUpdate={handleVideoTimeUpdate}
            handleStepVideoSeek={handleStepVideoSeek}
          />
        )}

        {/* Screenshots Tab - Feature #1834: Full screenshot gallery with comparison */}
        {/* Feature #46: Extracted to ScreenshotsTab component */}
        {activeTab === 'screenshots' && (
          <ScreenshotsTab
            allScreenshots={allScreenshots}
            browser={run?.browser}
            galleryViewMode={galleryViewMode}
            setGalleryViewMode={setGalleryViewMode}
            comparisonMode={comparisonMode}
            setComparisonMode={setComparisonMode}
            selectedForComparison={selectedForComparison}
            setSelectedForComparison={setSelectedForComparison}
            lightboxIndex={lightboxIndex}
            lightboxOpen={lightboxOpen}
            setLightboxIndex={setLightboxIndex}
            setLightboxOpen={setLightboxOpen}
            collapsedGroups={collapsedGroups}
            setCollapsedGroups={setCollapsedGroups}
            screenshotTypeFilter={screenshotTypeFilter}
            setScreenshotTypeFilter={setScreenshotTypeFilter}
            downloadingZip={downloadingZip}
            downloadAllAsZip={downloadAllAsZip}
            downloadGroupAsZip={downloadGroupAsZip}
            downloadScreenshot={downloadScreenshot}
            getScreenshotTypeBadge={getScreenshotTypeBadge}
            openLightbox={openLightbox}
            navigateLightbox={navigateLightbox}
            toggleComparisonSelect={toggleComparisonSelect}
            setActiveTab={setActiveTab}
          />
        )}

        {/* Metrics Tab - Feature #46: Extracted to MetricsTab component */}
        {/* Feature #1835: Enhanced Lighthouse performance dashboard */}
        {/* Feature #1907: Professional styling with consistent spacing and typography */}
        {activeTab === 'metrics' && (
          <MetricsTab
            performanceResults={performanceResults}
            loadTestResults={loadTestResults}
            lighthouseActiveTab={lighthouseActiveTab}
            setLighthouseActiveTab={setLighthouseActiveTab}
            k6ActiveTab={k6ActiveTab}
            setK6ActiveTab={setK6ActiveTab}
            k6ActiveChart={k6ActiveChart}
            setK6ActiveChart={setK6ActiveChart}
            k6ShowThresholds={k6ShowThresholds}
            setK6ShowThresholds={setK6ShowThresholds}
            k6ExportFormat={k6ExportFormat}
            setK6ExportFormat={setK6ExportFormat}
            expandedOpportunities={expandedOpportunities}
            toggleOpportunity={toggleOpportunity}
            expandedDiagnostics={expandedDiagnostics}
            toggleDiagnostic={toggleDiagnostic}
            expandedPassedAudits={expandedPassedAudits}
            togglePassedAudit={togglePassedAudit}
            passedAuditsCollapsed={passedAuditsCollapsed}
            setPassedAuditsCollapsed={setPassedAuditsCollapsed}
            expandedEndpoints={expandedEndpoints}
            toggleEndpoint={toggleEndpoint}
            endpointSortBy={endpointSortBy}
            setEndpointSortBy={setEndpointSortBy}
            endpointSortDesc={endpointSortDesc}
            setEndpointSortDesc={setEndpointSortDesc}
            securityInsightsCollapsed={securityInsightsCollapsed}
            setSecurityInsightsCollapsed={setSecurityInsightsCollapsed}
            expandedMixedContentResources={expandedMixedContentResources}
            setExpandedMixedContentResources={setExpandedMixedContentResources}
            perfAILoading={perfAILoading}
            perfAIResult={perfAIResult}
            setPerfAIResult={setPerfAIResult}
            perfAIError={perfAIError}
            perfAIAnalysisOpen={perfAIAnalysisOpen}
            analyzePerformanceResults={analyzePerformanceResults}
            exportK6Results={exportK6Results}
            exportK6ResultsPDF={exportK6ResultsPDF}
            exportLighthousePDF={exportLighthousePDF}
            generateK6TimeSeries={generateK6TimeSeries}
            generateResponseTimeHistogram={generateResponseTimeHistogram}
            showPreviousComparison={showPreviousComparison}
            setShowPreviousComparison={setShowPreviousComparison}
          />
        )}


        {/* Feature #46: Old metrics tab inline code removed - now using MetricsTab component */}
        {/* See /components/test-run-results/MetricsTab.tsx for the extracted implementation */}

        {/* Feature #1837: Enhanced Visual Diff Tab - Extracted to VisualTab component (Feature #46) */}
        {activeTab === 'visual' && (
          <VisualTab
            visualResults={visualResults}
            videoUrl={videoUrl}
            videoLoading={videoLoading}
            videoError={videoError}
            visualVideoRef={visualVideoRef}
            visualMarkers={visualMarkers}
            runDurationMs={runDurationMs}
            onApproveBaseline={handleApproveBaseline}
            onRejectBaseline={handleRejectBaseline}
            approvalLoading={approvalLoading}
          />
        )}


        {/* Feature #1838: Enhanced Accessibility Tab - Extracted to AccessibilityTab component */}
        {activeTab === 'accessibility' && (
          <AccessibilityTab
            accessibilityResults={accessibilityResults}
            onAnalyzeAccessibility={analyzeAccessibilityResults}
            aiLoading={a11yAILoading}
            aiAnalysisOpen={a11yAIAnalysisOpen}
            aiResult={a11yAIResult}
            aiError={a11yAIError}
            setAiResult={setA11yAIResult}
          />
        )}

        {/* Feature #46: LogsTab component - Enhanced Logs Tab */}
        {activeTab === 'logs' && (
          <LogsTab
            consoleLogs={consoleLogs}
            networkRequests={networkRequests}
            runId={runId || ''}
            logsViewMode={logsViewMode}
            setLogsViewMode={setLogsViewMode}
            logsFilter={logsFilter}
            setLogsFilter={setLogsFilter}
            logsSearch={logsSearch}
            setLogsSearch={setLogsSearch}
            expandedNetworkItems={expandedNetworkItems}
            toggleNetworkItem={toggleNetworkItem}
            expandedLogs={expandedLogs}
            setExpandedLogs={setExpandedLogs}
            logsExportFormat={logsExportFormat}
            setLogsExportFormat={setLogsExportFormat}
          />
        )}

        {/* Feature #1840: Network Tab - HAR Viewer and Waterfall Chart */}
        {/* Feature #46: Extracted to NetworkTab component for modularity */}
        {activeTab === 'network' && (
          <NetworkTab
            networkRequests={networkRequests}
            waterfallData={waterfallData}
            filteredNetworkRequests={filteredNetworkRequests}
            networkStats={networkStats}
            waterfallBounds={waterfallBounds}
            networkTypeFilter={networkTypeFilter}
            networkSearch={networkSearch}
            networkSortBy={networkSortBy}
            selectedNetworkRequest={selectedNetworkRequest}
            onToggleNetworkType={toggleNetworkType}
            onNetworkSearchChange={setNetworkSearch}
            onNetworkSortChange={setNetworkSortBy}
            onSelectNetworkRequest={setSelectedNetworkRequest}
            onExportHAR={exportHAR}
            getWaterfallPosition={getWaterfallPosition}
          />
        )}
      </div>

      {/* Run Error */}
      {run.error && (
        <div className="mt-6 bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <h3 className="font-medium text-destructive mb-2">Run Error</h3>
          <pre className="text-sm text-destructive whitespace-pre-wrap font-mono bg-destructive/5 p-3 rounded">
            {run.error}
          </pre>
        </div>
      )}

      {/* Feature #1843: Export Modal */}
      {exportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 transition-opacity"
            onClick={() => {
              setExportModalOpen(false);
              setShareLink(null);
            }}
          />

          {/* Modal */}
          <div className="relative bg-card border border-border rounded-lg shadow-xl w-full max-w-lg p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-foreground">Export Test Results</h2>
              <button
                onClick={() => {
                  setExportModalOpen(false);
                  setShareLink(null);
                }}
                className="p-2 rounded-full hover:bg-muted transition-colors"
              >
                <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* PDF Export */}
              <div className="p-4 border border-border rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                      <svg className="h-5 w-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground">PDF Report</h3>
                      <p className="text-sm text-muted-foreground">Professional report with summary and metrics</p>
                    </div>
                  </div>
                </div>

                {/* Feature #1992: Section Selection Checkboxes */}
                <div className="mb-3 p-3 bg-muted/50 rounded-md">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Include sections:</p>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pdfSections.summary}
                        onChange={(e) => setPdfSections(prev => ({ ...prev, summary: e.target.checked }))}
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                      />
                      Summary
                    </label>
                    <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pdfSections.typeBreakdown}
                        onChange={(e) => setPdfSections(prev => ({ ...prev, typeBreakdown: e.target.checked }))}
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                      />
                      Type Breakdown
                    </label>
                    <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pdfSections.testResults}
                        onChange={(e) => setPdfSections(prev => ({ ...prev, testResults: e.target.checked }))}
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                      />
                      Test Results
                    </label>
                    <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pdfSections.failures}
                        onChange={(e) => setPdfSections(prev => ({ ...prev, failures: e.target.checked }))}
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                      />
                      Failure Details
                    </label>
                    <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pdfSections.screenshots}
                        onChange={(e) => setPdfSections(prev => ({ ...prev, screenshots: e.target.checked }))}
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                      />
                      Screenshots
                    </label>
                  </div>
                </div>

                <button
                  onClick={handleGeneratePdfReport}
                  disabled={generatingPdf}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {generatingPdf ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Generating PDF...
                    </span>
                  ) : 'Download PDF'}
                </button>
              </div>

              {/* Feature #1993: HTML Export */}
              <div className="p-4 border border-border rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                      <svg className="h-5 w-5 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground">HTML Report</h3>
                      <p className="text-sm text-muted-foreground">Interactive report viewable in any browser</p>
                    </div>
                  </div>
                  <button
                    onClick={handleGenerateHtmlReport}
                    disabled={generatingHtml}
                    className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 transition-colors"
                  >
                    {generatingHtml ? (
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : 'Download'}
                  </button>
                </div>
              </div>

              {/* JSON Export */}
              <div className="p-4 border border-border rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground">JSON Data</h3>
                      <p className="text-sm text-muted-foreground">Full raw data for CI integration</p>
                    </div>
                  </div>
                  <button
                    onClick={exportFullJson}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Download
                  </button>
                </div>
              </div>

              {/* Share Link */}
              <div className="p-4 border border-border rounded-lg">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <svg className="h-5 w-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground">Shareable Link</h3>
                    <p className="text-sm text-muted-foreground">Generate a link to share results</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <select
                      value={shareLinkExpiry}
                      onChange={(e) => setShareLinkExpiry(e.target.value as typeof shareLinkExpiry)}
                      className="flex-1 px-3 py-2 border border-border rounded-md bg-background text-foreground"
                    >
                      <option value="1h">Expires in 1 hour</option>
                      <option value="24h">Expires in 24 hours</option>
                      <option value="7d">Expires in 7 days</option>
                      <option value="30d">Expires in 30 days</option>
                    </select>
                  </div>

                  <div>
                    <input
                      type="password"
                      placeholder="Optional password (leave empty for public)"
                      value={shareLinkPassword}
                      onChange={(e) => setShareLinkPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground"
                    />
                  </div>

                  {shareLink ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={shareLink}
                        readOnly
                        className="flex-1 px-3 py-2 border border-border rounded-md bg-muted text-foreground text-sm"
                      />
                      <button
                        onClick={copyShareLink}
                        className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                      >
                        Copy
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={generateShareLink}
                      disabled={generatingShare}
                      className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {generatingShare ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Generating...
                        </span>
                      ) : 'Generate Share Link'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feature #1954: Batch Failure Analysis Modal */}
      {batchAnalysisOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-border bg-gradient-to-r from-purple-600/10 to-indigo-600/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 flex items-center justify-center">
                    <span className="text-white text-lg">🤖</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Batch Failure Analysis</h3>
                    <p className="text-sm text-muted-foreground">
                      Analyzing {resultSummary.failed} failed tests for common patterns
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setBatchAnalysisOpen(false)}
                  className="p-2 rounded-full hover:bg-muted transition-colors"
                >
                  <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {/* Failed Tests Summary */}
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <div className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">Failed Tests:</div>
                <div className="flex flex-wrap gap-2">
                  {run?.results.filter(r => r.status === 'failed' || r.status === 'error').slice(0, 8).map(t => (
                    <span key={t.test_id} className="px-2 py-1 text-xs bg-red-100 dark:bg-red-800/30 text-red-700 dark:text-red-300 rounded">
                      {t.test_name.length > 30 ? t.test_name.slice(0, 27) + '...' : t.test_name}
                    </span>
                  ))}
                  {(run?.results.filter(r => r.status === 'failed' || r.status === 'error').length || 0) > 8 && (
                    <span className="px-2 py-1 text-xs bg-red-100 dark:bg-red-800/30 text-red-700 dark:text-red-300 rounded">
                      +{(run?.results.filter(r => r.status === 'failed' || r.status === 'error').length || 0) - 8} more
                    </span>
                  )}
                </div>
              </div>

              {/* Analysis Content */}
              {batchAnalysisLoading ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-600 border-t-transparent mb-3" />
                  <p className="text-sm text-muted-foreground">Finding common patterns across failures...</p>
                </div>
              ) : batchAnalysisResult ? (
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                  <div className="whitespace-pre-wrap text-sm text-foreground">{batchAnalysisResult}</div>
                </div>
              ) : null}

              {/* Cached indicator */}
              {batchAnalysisCached && !batchAnalysisLoading && (
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span>💾</span> Cached analysis (24hr)
                  </span>
                  <button
                    onClick={() => {
                      // Clear cache and re-analyze
                      if (run) {
                        try {
                          localStorage.removeItem(`ai_batch_batch_${run.id}`);
                        } catch (e) {}
                      }
                      setBatchAnalysisCached(false);
                      handleBatchAnalysis();
                    }}
                    className="text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
                  >
                    🔄 Refresh
                  </button>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border bg-muted/30 flex justify-end">
              <button
                onClick={() => setBatchAnalysisOpen(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feature #1962: AI Side Panel removed - AI analysis now only on Visual Review page */}
    </div>
  );
}
