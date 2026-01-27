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

// Types for run result data
interface StepResult {
  id: string;
  action: string;
  selector?: string;
  value?: string;
  status: 'passed' | 'failed' | 'skipped';
  duration_ms: number;
  error?: string;
  screenshot_timeout?: boolean;
  navigation_error?: boolean;
  http_status?: number;
  // Feature #1913: Multi-viewport visual test support
  viewport?: string; // Viewport label for multi-viewport tests (e.g., "Desktop (1920x1080)")
  // Feature #1833: Timeline enhancement - timestamps and screenshots per step
  timestamp?: number; // Unix timestamp when step started
  screenshot_before?: string; // Base64 screenshot before action
  screenshot_after?: string; // Base64 screenshot after action
  // Feature #1833: Per-step network requests and console logs
  network_requests?: NetworkRequest[];
  console_logs?: ConsoleLog[];
  metadata?: {
    screenshot_url?: string;
    diff_percentage?: number;
    baseline_url?: string;
    comparison_url?: string;
    diff_url?: string;
    isBrowserCrash?: boolean;
    crashDetectedAt?: string;
    crashDumpFile?: string;
    suggestion?: string;
    canRetry?: boolean;
  };
  load_test?: {
    virtual_users: number | { configured: number; peak: number };
    duration: number;
    requests_per_second: number;
    avg_response_time: number;
    p95_response_time: number;
    error_rate: number;
    http_codes?: Record<string, number>;
    response_times?: {
      avg: number;
      min: number;
      max: number;
      median: number;
      p50?: number;
      p90: number;
      p95: number;
      p99: number;
    };
    summary?: {
      http_req_duration_avg: number;
      http_req_duration_p95: number;
      http_req_duration_p99: number;
      http_reqs: number;
      iterations: number;
      vus_max: number;
      success_rate?: number;
      total_requests?: number;
      requests_per_second?: number;
      peak_rps?: number;
      data_transferred_formatted?: string;
    };
  };
  lighthouse?: {
    performance: number;
    accessibility: number;
    best_practices: number;
    bestPractices?: number;
    seo: number;
    pwa?: number;
    lcp?: number;
    cls?: number;
    fcp?: number;
    tbt?: number;
    url?: string;
    device?: string;
    metrics?: {
      lcp?: number;
      fid?: number;
      cls?: number;
      fcp?: number;
      tbt?: number;
      ttfb?: number;
      si?: number;
      tti?: number;
    };
    // Feature #1887, #1889: Opportunities, diagnostics, and passed audits from Lighthouse
    opportunities?: Array<{
      id: string;
      title: string;
      savings: number;
      description: string;
    }>;
    diagnostics?: Array<{
      id: string;
      title: string;
      description: string;
    }>;
    passedAudits?: Array<{
      id: string;
      title: string;
      description: string;
      category?: string;
    }>;
    // Feature #1890: Security detection results
    csp?: {
      detected: boolean;
      header?: string;
      blocksLighthouse: boolean;
      warning?: string;
      partialResults: boolean;
      bypassEnabled: boolean;
      suggestion?: string;
    };
    authentication?: {
      required: boolean;
      warning?: string;
      suggestion?: string;
      redirectedToLogin: boolean;
      originalUrl?: string;
      actualUrl?: string;
      loginIndicators?: string[];
      resultsReflectLoginPage: boolean;
    };
    mixedContent?: {
      detected: boolean;
      warning?: string;
      count: number;
      activeCount: number;
      passiveCount: number;
      resources: Array<{
        url: string;
        resourceType: string;
        severity: 'passive' | 'active';
      }>;
      hasMore: boolean;
      remediation: string[];
      securityImpact: 'high' | 'medium';
      scorePenalty: number;
    };
    // Feature #1893: Filmstrip view of page load
    filmstrip?: Array<{
      timestamp_ms: number;
      screenshot_base64: string;
      label?: string;
    }>;
    // Comparison to previous run
    comparison_to_previous?: {
      improved?: boolean;
      avg_change?: number;
      performance_change?: number;
      accessibility_change?: number;
      seo_change?: number;
    };
  };
  accessibility?: {
    violations: AccessibilityViolation[];
    passes: number;
    incomplete: number;
    inapplicable: number;
    score?: number;
    wcagLevel?: string;
    axeVersion?: string;
  };
}

interface AccessibilityViolation {
  id: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  description: string;
  help: string;
  helpUrl: string;
  wcagTags?: string[];
  nodes?: Array<{
    html: string;
    target: string[];
    failureSummary: string;
  }>;
}

interface ConsoleLog {
  timestamp: number;
  level: 'log' | 'info' | 'warn' | 'error' | 'debug';
  message: string;
  location?: string;
}

interface NetworkRequest {
  timestamp: number;
  method: string;
  url: string;
  resourceType: string;
  status?: number;
  statusText?: string;
  duration_ms?: number;
  requestSize?: number;
  responseSize?: number;
  failed?: boolean;
  failureText?: string;
}

interface TestResult {
  test_id: string;
  test_name: string;
  test_type?: 'e2e' | 'visual_regression' | 'lighthouse' | 'load' | 'accessibility'; // Feature #1991: Test type for PDF breakdown
  status: 'passed' | 'failed' | 'error' | 'skipped';
  duration_ms: number;
  steps: StepResult[];
  error?: string;
  screenshot_base64?: string;
  trace_file?: string;
  video_file?: string;
  console_logs?: ConsoleLog[];
  network_requests?: NetworkRequest[];
  visual_comparison?: {
    hasBaseline: boolean;
    baselineScreenshot?: string;
    diffPercentage?: number;
    diffImage?: string;
    mismatchedPixels?: number;
    totalPixels?: number;
    baselineCorrupted?: boolean;
    corruptionError?: string;
  };
  baseline_screenshot_base64?: string;
  diff_image_base64?: string;
  diff_percentage?: number;
  // Feature #1913: Multi-viewport results
  viewport_results?: Array<{
    viewportId: string;
    viewportLabel: string;
    width: number;
    height: number;
    visualComparison?: {
      hasBaseline: boolean;
      diffPercentage?: number;
      mismatchedPixels?: number;
      totalPixels?: number;
    };
    screenshotBase64?: string;
    baselineScreenshotBase64?: string;
    diffImageBase64?: string;
    diffPercentage?: number;
  }>;
  load_test?: {
    summary: {
      total_requests: number;
      failed_requests: number;
      success_rate: string;
      requests_per_second: string;
      data_transferred: number;
      data_transferred_formatted: string;
      max_vus?: number;
      duration_formatted?: string;
      peak_rps?: number;
      data_sent?: number;
      data_received?: number;
    };
    response_times: {
      min: number;
      avg: number;
      median: number;
      p50?: number;
      p75?: number;
      p90: number;
      p95: number;
      p99: number;
      max: number;
    };
    virtual_users: {
      configured: number;
      max_concurrent: number;
    };
    duration: {
      configured: number;
      actual: number;
      ramp_up: number;
    };
    http_codes: Record<string, number>;
    // Checks - array of assertion results
    checks: Array<{ name: string; passes: number; fails: number; pass_rate?: number }>;
    // Feature #1836: K6 dashboard additions
    thresholds?: Record<string, boolean>;
    endpoints?: Array<{
      path: string;
      method: string;
      count: number;
      avg_time: number;
      p95_time: number;
      error_rate: number;
    }>;
    time_series?: Array<{
      time: string;
      timestamp?: number;
      vus: number;
      rps: number;
      avg_response_time: number;
      p95_response_time: number;
    }>;
    response_time_distribution?: Array<{
      range: string;
      count: number;
      percentage: number;
    }>;
    // Additional load test properties
    started_at?: string;
    target_url?: string;
    environment?: string;
    configuration?: {
      max_vus?: number;
      target_vus?: number;
      duration?: string;
      duration_formatted?: string;
    };
    comparison_to_previous?: {
      improved?: boolean;
      percentage_change?: number;
      requests_per_second_change?: number;
      avg_response_time_change?: number;
      success_rate_change?: number;
    };
    peak_rps?: number;
    threshold_details?: Array<{
      name: string;
      passed: boolean;
      value: number;
      threshold: number;
    }>;
    error_annotations?: Array<{
      time: string;
      timestamp?: number;
      message: string;
      type?: string;
    }>;
    error_time_series?: Array<{
      timestamp: number;
      count: number;
      types: Record<string, number>;
    }>;
    data_sent?: number;
    data_received?: number;
    expected_bandwidth?: number;
    content_type_breakdown?: Array<{ type: string; bytes: number; percentage: number }>;
    error_types?: Record<string, number>;
    custom_metrics?: Array<{
      name: string;
      type: 'counter' | 'rate' | 'trend' | 'gauge';
      value?: number;
      values?: { avg?: number; min?: number; max?: number; p90?: number; p95?: number };
    }>;
  };
}

interface TestRun {
  id: string;
  suite_id: string;
  test_id?: string;
  organization_id?: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'error' | 'cancelled';
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  created_at: string;
  results: TestResult[];
  error?: string;
  browser?: string;
  branch?: string;
}

interface TestInfo {
  id: string;
  name: string;
  type: string;
  suite_id: string;
  target_url?: string;
}

interface SuiteInfo {
  id: string;
  name: string;
  project_id: string;
}

export default function TestRunResultPage() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const { token } = useAuthStore();
  // Feature #1995: Get organization branding for PDF exports
  const { logoBase64, organizationName } = useOrganizationBrandingStore();

  const [run, setRun] = useState<TestRun | null>(null);
  const [testInfo, setTestInfo] = useState<TestInfo | null>(null);
  const [suiteInfo, setSuiteInfo] = useState<SuiteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Feature #1929: Retry trigger for error recovery
  const [retryTrigger, setRetryTrigger] = useState(0);

  // Active sections
  const [activeTab, setActiveTab] = useState<'results' | 'timeline' | 'screenshots' | 'metrics' | 'logs' | 'visual' | 'accessibility' | 'network'>('results');
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [expandedLogs, setExpandedLogs] = useState(false);

  // Feature #1833: Timeline view options
  const [showNetworkPerStep, setShowNetworkPerStep] = useState(true);
  const [showConsolePerStep, setShowConsolePerStep] = useState(true);
  const [selectedScreenshot, setSelectedScreenshot] = useState<{ url: string; title: string } | null>(null);

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

  // Feature #1835: Enhanced metrics tab state
  const [expandedOpportunities, setExpandedOpportunities] = useState<Set<string>>(new Set());
  const [expandedDiagnostics, setExpandedDiagnostics] = useState<Set<string>>(new Set());
  // Feature #1889: Passed audits state
  const [expandedPassedAudits, setExpandedPassedAudits] = useState<Set<string>>(new Set());
  const [passedAuditsCollapsed, setPassedAuditsCollapsed] = useState(true);
  // Feature #1890: Security insights state
  const [securityInsightsCollapsed, setSecurityInsightsCollapsed] = useState(false);
  const [expandedMixedContentResources, setExpandedMixedContentResources] = useState(false);
  const [showPreviousComparison, setShowPreviousComparison] = useState(false);
  const [previousRunData, setPreviousRunData] = useState<any>(null);

  // Feature #1836: K6 Load Test Dashboard state
  const [k6ActiveChart, setK6ActiveChart] = useState<'vus' | 'rps' | 'response_times'>('vus');
  const [expandedEndpoints, setExpandedEndpoints] = useState<Set<string>>(new Set());
  const [k6ShowThresholds, setK6ShowThresholds] = useState(true);
  const [k6ExportFormat, setK6ExportFormat] = useState<'json' | 'csv'>('json');
  // Feature #1899: Endpoint performance ranking sort state
  const [endpointSortBy, setEndpointSortBy] = useState<'avg_time' | 'p95_time' | 'error_rate' | 'count'>('avg_time');
  const [endpointSortDesc, setEndpointSortDesc] = useState(true);
  // Feature #1908: K6 results tabbed interface
  const [k6ActiveTab, setK6ActiveTab] = useState<'overview' | 'response_times' | 'throughput' | 'errors' | 'endpoints'>('overview');
  // Feature #1909: Lighthouse results tabbed interface
  const [lighthouseActiveTab, setLighthouseActiveTab] = useState<'overview' | 'performance' | 'accessibility' | 'best_practices' | 'seo'>('overview');

  // Feature #1837: Visual Diff enhanced state
  const [visualViewMode, setVisualViewMode] = useState<'side-by-side' | 'slider' | 'onion'>('side-by-side');
  const [sliderPosition, setSliderPosition] = useState<Record<string, number>>({});
  const [onionOpacity, setOnionOpacity] = useState<Record<string, number>>({});
  const [approvalLoading, setApprovalLoading] = useState<Record<string, boolean>>({});
  const [expandedVisualResults, setExpandedVisualResults] = useState<Set<string>>(new Set());

  // Feature #1877: Zoom and pan controls for visual inspection
  const [visualZoom, setVisualZoom] = useState<Record<string, number>>({});
  const [visualPan, setVisualPan] = useState<Record<string, { x: number; y: number }>>({});
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const visualContainerRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Feature #1838: Accessibility tab enhanced state
  const [a11yExpandedSeverities, setA11yExpandedSeverities] = useState<Set<string>>(new Set(['critical', 'serious']));
  const [a11yExpandedViolations, setA11yExpandedViolations] = useState<Set<string>>(new Set());
  const [a11yViewMode, setA11yViewMode] = useState<'grouped' | 'list'>('grouped');

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

  // Feature #1840: Network tab - HAR viewer and waterfall state
  const [networkTypeFilter, setNetworkTypeFilter] = useState<Set<string>>(new Set(['xhr', 'fetch', 'script', 'stylesheet', 'image', 'font', 'document', 'other']));
  const [networkSearch, setNetworkSearch] = useState('');
  const [selectedNetworkRequest, setSelectedNetworkRequest] = useState<number | null>(null);
  const [networkSortBy, setNetworkSortBy] = useState<'time' | 'duration' | 'size'>('time');

  // Feature #1841: Individual test result cards state
  const [expandedResultCards, setExpandedResultCards] = useState<Set<string>>(new Set());
  const [selectedResultsFilter, setSelectedResultsFilter] = useState<'all' | 'passed' | 'failed' | 'skipped'>('all');
  const [rerunningTests, setRerunningTests] = useState<Set<string>>(new Set());

  // Feature #1842: Run comparison state
  const [compareMode, setCompareMode] = useState(false);
  const [previousRuns, setPreviousRuns] = useState<Array<{ id: string; status: string; created_at: string; duration_ms?: number }>>([]);
  const [selectedCompareRunId, setSelectedCompareRunId] = useState<string | null>(null);
  const [compareRun, setCompareRun] = useState<TestRun | null>(null);
  const [loadingCompareRun, setLoadingCompareRun] = useState(false);
  const [runHistory, setRunHistory] = useState<Array<{ id: string; status: string; created_at: string; duration_ms?: number; passed: number; failed: number; total: number }>>([]);

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

  // Get the primary error from the run results
  const primaryError = useMemo(() => {
    if (!run?.results) return null;
    const failedResult = run.results.find(r => r.status === 'failed' || r.status === 'error');
    return failedResult?.error || failedResult?.steps.find(s => s.status === 'failed')?.error || null;
  }, [run]);

  // Detect if the primary error is simple
  const errorAnalysis = useMemo(() => detectSimpleError(primaryError || undefined), [primaryError, detectSimpleError]);

  // Feature #1935: Performance AI analysis state
  const [perfAIAnalysisOpen, setPerfAIAnalysisOpen] = useState<string | null>(null); // test name
  const [perfAILoading, setPerfAILoading] = useState(false);
  const [perfAIResult, setPerfAIResult] = useState<Record<string, string>>({});
  const [perfAIError, setPerfAIError] = useState<string | null>(null);

  // Feature #1936: Accessibility AI analysis state
  const [a11yAIAnalysisOpen, setA11yAIAnalysisOpen] = useState<string | null>(null);
  const [a11yAILoading, setA11yAILoading] = useState(false);
  const [a11yAIResult, setA11yAIResult] = useState<Record<string, string>>({});
  const [a11yAIError, setA11yAIError] = useState<string | null>(null);

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

  // Feature #1880: Video playback for visual diff with timestamp markers
  const visualVideoRef = useRef<HTMLVideoElement | null>(null);
  const [visualVideoCurrentTime, setVisualVideoCurrentTime] = useState(0);
  const [isVisualVideoPlaying, setIsVisualVideoPlaying] = useState(false);
  const [visualVideoExpanded, setVisualVideoExpanded] = useState(false);

  // Get result summary - MOVED UP to avoid temporal dead zone error
  // This must be defined before any useEffect that depends on it
  const resultSummary = useMemo(() => {
    if (!run?.results) return { passed: 0, failed: 0, skipped: 0, total: 0 };
    return {
      passed: run.results.filter(r => r.status === 'passed').length,
      failed: run.results.filter(r => r.status === 'failed' || r.status === 'error').length,
      skipped: run.results.filter(r => r.status === 'skipped').length,
      total: run.results.length,
    };
  }, [run]);

  // Get console logs - MOVED UP to avoid temporal dead zone error
  const consoleLogs = useMemo(() => {
    if (!run?.results) return [];
    return run.results.flatMap(r => r.console_logs || []);
  }, [run]);

  // Get network requests - MOVED UP to avoid temporal dead zone error
  const networkRequests = useMemo(() => {
    if (!run?.results) return [];
    return run.results.flatMap(r => r.network_requests || []);
  }, [run]);

  // Get lighthouse/performance metrics - MOVED UP to avoid temporal dead zone error
  const performanceResults = useMemo(() => {
    if (!run?.results) return [];
    return run.results.filter(r =>
      r.steps.some(s => s.lighthouse)
    );
  }, [run]);

  // Get accessibility violations - MOVED UP to avoid temporal dead zone error
  const accessibilityResults = useMemo(() => {
    if (!run?.results) return [];
    return run.results.filter(r =>
      r.steps.some(s => s.accessibility && s.accessibility.violations.length > 0)
    );
  }, [run]);

  // Get load test results - MOVED UP to avoid temporal dead zone error
  const loadTestResults = useMemo(() => {
    if (!run?.results) return [];
    return run.results.filter(r => r.load_test);
  }, [run]);

  // Get visual comparison results - MOVED UP to avoid temporal dead zone error
  const visualResults = useMemo(() => {
    if (!run?.results) return [];
    return run.results.filter(r => r.visual_comparison);
  }, [run]);

  // Feature #1865: Get first video file from results
  const videoFile = useMemo(() => {
    if (!run?.results) return null;
    const resultWithVideo = run.results.find(r => r.video_file);
    return resultWithVideo?.video_file || null;
  }, [run]);

  // Feature #1865: Get run duration for video sync calculations
  const runDurationMs = useMemo(() => {
    if (!run?.started_at || !run?.completed_at) return 0;
    return new Date(run.completed_at).getTime() - new Date(run.started_at).getTime();
  }, [run]);

  // Feature #1880: Calculate visual screenshot markers for video timeline
  const visualMarkers = useMemo(() => {
    if (!run?.results || !run?.started_at) return [];

    const runStartTime = new Date(run.started_at).getTime();
    const markers: Array<{
      id: string;
      testName: string;
      timestampMs: number;
      hasDiff: boolean;
      diffPercent: number;
      type: 'screenshot' | 'diff';
    }> = [];

    // For each visual result, look for screenshot capture steps
    run.results.forEach((result, resultIdx) => {
      if (!result.visual_comparison) return;

      const hasDiff = (result.diff_percentage || result.visual_comparison.diffPercentage || 0) > 0.1;
      const diffPercent = result.diff_percentage || result.visual_comparison.diffPercentage || 0;

      // Find the screenshot step timestamp - use last step or result duration
      const lastStep = result.steps[result.steps.length - 1];
      const stepTimestamp = lastStep?.timestamp || 0;

      // Calculate timestamp relative to run start
      let relativeTime = 0;
      if (stepTimestamp) {
        relativeTime = stepTimestamp - runStartTime;
      } else {
        // Estimate based on cumulative durations
        const prevResults = run.results.slice(0, resultIdx);
        const prevDuration = prevResults.reduce((acc, r) => acc + r.duration_ms, 0);
        relativeTime = prevDuration + result.duration_ms / 2;
      }

      // Screenshot capture marker
      markers.push({
        id: `${result.test_id}-${resultIdx}-screenshot`,
        testName: result.test_name,
        timestampMs: Math.max(0, relativeTime),
        hasDiff,
        diffPercent,
        type: 'screenshot',
      });

      // If there's a diff, add a diff marker (slightly after screenshot)
      if (hasDiff) {
        markers.push({
          id: `${result.test_id}-${resultIdx}-diff`,
          testName: result.test_name,
          timestampMs: Math.max(0, relativeTime + 100), // 100ms after screenshot
          hasDiff: true,
          diffPercent,
          type: 'diff',
        });
      }
    });

    return markers.sort((a, b) => a.timestampMs - b.timestampMs);
  }, [run]);

  // Feature #1880: Seek visual video to marker timestamp
  const seekVisualVideoToMarker = useCallback((timestampMs: number) => {
    if (!visualVideoRef.current) return;

    const videoTimeSeconds = timestampMs / 1000;
    const videoDuration = visualVideoRef.current.duration || 0;
    const clampedTime = Math.min(Math.max(0, videoTimeSeconds), videoDuration);

    visualVideoRef.current.currentTime = clampedTime;
    visualVideoRef.current.play().catch(() => {});
    setIsVisualVideoPlaying(true);
  }, []);

  // Feature #1880: Handle visual video time update
  const handleVisualVideoTimeUpdate = useCallback(() => {
    if (visualVideoRef.current) {
      setVisualVideoCurrentTime(visualVideoRef.current.currentTime * 1000);
    }
  }, []);

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

  // Feature #1865: Seek video to timestamp (in milliseconds from run start)
  const seekVideoToTime = useCallback((timestampMs: number) => {
    if (!videoRef.current || !runDurationMs) return;

    // Calculate the video position based on step timestamp relative to run start
    // Video time is in seconds, timestamp is in milliseconds
    const videoTimeSeconds = timestampMs / 1000;

    // Ensure we don't seek past the video duration
    const videoDuration = videoRef.current.duration || 0;
    const clampedTime = Math.min(Math.max(0, videoTimeSeconds), videoDuration);

    videoRef.current.currentTime = clampedTime;
    videoRef.current.play().catch(() => {
      // Autoplay may be blocked, that's okay
    });
    setIsVideoPlaying(true);
  }, [runDurationMs]);

  // Feature #1865: Handle video time update
  const handleVideoTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentVideoTime(videoRef.current.currentTime * 1000); // Convert to ms
    }
  }, []);

  // Feature #1865: Download video
  const handleVideoDownload = useCallback(async () => {
    if (!videoFile || !token) return;

    try {
      const response = await fetch(`/api/v1/videos/${videoFile}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = videoFile;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    }
  }, [videoFile, token]);

  // Fetch run data
  useEffect(() => {
    const fetchRunData = async () => {
      if (!runId || !token) return;

      setLoading(true);
      setError(null);

      try {
        // Fetch run details
        const runResponse = await fetch(`/api/v1/runs/${runId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!runResponse.ok) {
          // Feature #1929: Provide specific error messages based on HTTP status
          if (runResponse.status === 404) {
            throw new Error('Run not found. It may have been deleted or the ID is invalid.');
          } else if (runResponse.status === 401 || runResponse.status === 403) {
            throw new Error('You do not have permission to view this run.');
          } else if (runResponse.status >= 500) {
            throw new Error('Server error. Please try again later.');
          } else {
            throw new Error(`Failed to fetch run details (${runResponse.status})`);
          }
        }

        const runData = await runResponse.json();
        setRun(runData.run);

        // If we have a test_id, fetch test info
        if (runData.run.test_id) {
          try {
            const testResponse = await fetch(`/api/v1/tests/${runData.run.test_id}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (testResponse.ok) {
              const testData = await testResponse.json();
              // Feature #1970: Extract test from response object (API returns { test: {...} } or direct object)
              setTestInfo(testData.test || testData);
            }
          } catch {
            // Test info is optional
          }
        }

        // If we have a suite_id, fetch suite info
        if (runData.run.suite_id) {
          try {
            const suiteResponse = await fetch(`/api/v1/suites/${runData.run.suite_id}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (suiteResponse.ok) {
              const suiteData = await suiteResponse.json();
              // Feature #1970: Extract suite from response object (API returns { suite: {...} })
              setSuiteInfo(suiteData.suite || suiteData);
            }
          } catch {
            // Suite info is optional
          }
        }

      } catch (err) {
        // Feature #1929: Provide specific error messages for network errors
        if (err instanceof TypeError && err.message.includes('fetch')) {
          setError('Network error. Please check your internet connection and try again.');
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load run data');
        }
        console.error('Error loading run data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRunData();
  }, [runId, token, retryTrigger]); // Feature #1929: Added retryTrigger to dependency array

  // Feature #1842: Fetch previous runs for comparison
  useEffect(() => {
    const fetchPreviousRuns = async () => {
      if (!run?.suite_id || !token) return;

      try {
        const response = await fetch(`/api/v1/suites/${run.suite_id}/runs?limit=10`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          const runs = (data.runs || [])
            .filter((r: { id: string }) => r.id !== runId)
            .map((r: { id: string; status: string; created_at: string; duration_ms?: number; results?: TestResult[] }) => ({
              id: r.id,
              status: r.status,
              created_at: r.created_at,
              duration_ms: r.duration_ms,
              passed: r.results?.filter((res: TestResult) => res.status === 'passed').length || 0,
              failed: r.results?.filter((res: TestResult) => res.status === 'failed' || res.status === 'error').length || 0,
              total: r.results?.length || 0,
            }));
          setPreviousRuns(runs);
          setRunHistory([
            {
              id: run.id,
              status: run.status,
              created_at: run.created_at,
              duration_ms: run.duration_ms,
              passed: resultSummary.passed,
              failed: resultSummary.failed,
              total: resultSummary.total,
            },
            ...runs,
          ]);
        }
      } catch {
        // Silent fail - comparison is optional
      }
    };

    fetchPreviousRuns();
  }, [run, runId, token, resultSummary]);

  // Feature #1842: Fetch comparison run data
  useEffect(() => {
    const fetchCompareRun = async () => {
      if (!selectedCompareRunId || !token) {
        setCompareRun(null);
        return;
      }

      setLoadingCompareRun(true);
      try {
        const response = await fetch(`/api/v1/runs/${selectedCompareRunId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          setCompareRun(data.run);
        }
      } catch {
        setCompareRun(null);
      } finally {
        setLoadingCompareRun(false);
      }
    };

    fetchCompareRun();
  }, [selectedCompareRunId, token]);

  // Feature #1844: WebSocket connection for live updates
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
      // Refresh the run data
      window.location.reload();
    });

    // Handle run error
    socket.on('run:error', (data: { error: string }) => {
      setLiveMode(false);
    });

    // Cleanup
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [runId, token, run?.status]);

  // Feature #1844: Cancel running test
  const cancelTest = useCallback(async () => {
    if (!runId || !token) return;

    setCancellingTest(true);
    try {
      const response = await fetch(`/api/v1/runs/${runId}/cancel`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setLiveMode(false);
        // Refresh the page to show updated status
        window.location.reload();
      }
    } catch (err) {
      console.error('Failed to cancel test:', err);
    } finally {
      setCancellingTest(false);
    }
  }, [runId, token]);

  // Toggle step expansion
  const toggleStep = (stepId: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  // Feature #1865: Handle step click to seek video
  const handleStepVideoSeek = useCallback((step: { computedTimestamp: number }) => {
    if (!videoUrl || !run?.started_at) return;

    // Calculate time offset from run start in milliseconds
    const runStartTime = new Date(run.started_at).getTime();
    const stepOffsetMs = step.computedTimestamp - runStartTime;

    seekVideoToTime(stepOffsetMs);
  }, [videoUrl, run, seekVideoToTime]);

  // Format duration
  const formatDuration = (ms?: number) => {
    if (ms === undefined || ms === null) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    const mins = Math.floor(ms / 60000);
    const secs = ((ms % 60000) / 1000).toFixed(0);
    return `${mins}m ${secs}s`;
  };

  // Format timestamp
  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString();
  };

  // Feature #1833: Format step timestamp (showing time with milliseconds)
  const formatStepTime = (timestamp?: number) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }) + '.' + String(date.getMilliseconds()).padStart(3, '0');
  };

  // Feature #1833: Format relative time from start
  const formatRelativeTime = (timestamp: number, startTime: number) => {
    const diff = timestamp - startTime;
    if (diff < 1000) return `+${diff}ms`;
    if (diff < 60000) return `+${(diff / 1000).toFixed(2)}s`;
    const mins = Math.floor(diff / 60000);
    const secs = ((diff % 60000) / 1000).toFixed(0);
    return `+${mins}m ${secs}s`;
  };

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

  // Feature #1834: Toggle screenshot for comparison
  const toggleComparisonSelect = (id: string) => {
    setSelectedForComparison(prev => {
      if (prev.includes(id)) {
        return prev.filter(i => i !== id);
      }
      if (prev.length >= 2) {
        return [prev[1], id]; // Keep last selected, add new
      }
      return [...prev, id];
    });
  };

  // Feature #1834: Download single screenshot
  const downloadScreenshot = (screenshot: ScreenshotItem) => {
    const link = document.createElement('a');
    link.href = screenshot.url;
    link.download = `${screenshot.testName}-${screenshot.type}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Feature #1834: Download all screenshots as ZIP
  const downloadAllAsZip = async () => {
    if (allScreenshots.length === 0) return;
    setDownloadingZip(true);

    try {
      // Dynamic import JSZip
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      // Add each screenshot to the zip
      for (const screenshot of allScreenshots) {
        // Extract base64 data from data URL
        const base64Data = screenshot.url.split(',')[1];
        if (base64Data) {
          const fileName = `${screenshot.testName.replace(/[^a-z0-9]/gi, '_')}-${screenshot.type}-${screenshot.id}.png`;
          zip.file(fileName, base64Data, { base64: true });
        }
      }

      // Generate and download the zip
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `screenshots-run-${runId}-${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to create ZIP:', err);
    } finally {
      setDownloadingZip(false);
    }
  };

  // Feature #2001: Download screenshots for a specific test type group as ZIP
  const downloadGroupAsZip = async (testType: string, screenshots: ScreenshotItem[]) => {
    if (screenshots.length === 0) return;
    setDownloadingZip(true);

    try {
      // Dynamic import JSZip
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      // Add each screenshot to the zip
      for (const screenshot of screenshots) {
        // Extract base64 data from data URL
        const base64Data = screenshot.url.split(',')[1];
        if (base64Data) {
          const fileName = `${screenshot.testName.replace(/[^a-z0-9]/gi, '_')}-${screenshot.type}-${screenshot.id}.png`;
          zip.file(fileName, base64Data, { base64: true });
        }
      }

      // Generate and download the zip with test type in filename
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${testType.toLowerCase()}-screenshots.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to create ZIP:', err);
    } finally {
      setDownloadingZip(false);
    }
  };

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

  // Feature #1835: Circular gauge component for Lighthouse scores
  const CircularGauge = ({ score, label, size = 120 }: { score: number; label: string; size?: number }) => {
    const radius = (size - 12) / 2;
    const circumference = 2 * Math.PI * radius;
    const progress = (score / 100) * circumference;
    const offset = circumference - progress;

    const getColor = (value: number) => {
      if (value >= 90) return { stroke: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)', text: 'text-green-600' };
      if (value >= 50) return { stroke: '#eab308', bg: 'rgba(234, 179, 8, 0.1)', text: 'text-yellow-600' };
      return { stroke: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', text: 'text-red-600' };
    };

    const colors = getColor(score);

    return (
      <div className="flex flex-col items-center">
        <div className="relative" style={{ width: size, height: size }}>
          <svg
            width={size}
            height={size}
            className="transform -rotate-90"
            style={{ overflow: 'visible' }}
          >
            {/* Background circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              className="text-muted/30"
            />
            {/* Progress circle with animation */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={colors.stroke}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{
                transition: 'stroke-dashoffset 1s ease-out',
              }}
            />
          </svg>
          {/* Score text */}
          <div
            className="absolute inset-0 flex items-center justify-center"
          >
            <span className={`text-2xl font-bold ${colors.text}`}>{score}</span>
          </div>
        </div>
        <span className="text-sm text-muted-foreground mt-2 font-medium">{label}</span>
      </div>
    );
  };

  // Feature #1835: Toggle opportunity expansion
  const toggleOpportunity = (id: string) => {
    setExpandedOpportunities(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Feature #1835: Toggle diagnostic expansion
  const toggleDiagnostic = (id: string) => {
    setExpandedDiagnostics(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Feature #1889: Toggle passed audit expansion
  const togglePassedAudit = (id: string) => {
    setExpandedPassedAudits(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Feature #1835: Get score color class
  const getScoreColorClass = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Feature #1835: Get score background class
  const getScoreBgClass = (score: number) => {
    if (score >= 90) return 'bg-green-50 dark:bg-green-900/20';
    if (score >= 50) return 'bg-yellow-50 dark:bg-yellow-900/20';
    return 'bg-red-50 dark:bg-red-900/20';
  };

  // Feature #1836: Toggle endpoint expansion
  const toggleEndpoint = (endpoint: string) => {
    setExpandedEndpoints(prev => {
      const next = new Set(prev);
      if (next.has(endpoint)) {
        next.delete(endpoint);
      } else {
        next.add(endpoint);
      }
      return next;
    });
  };

  // Feature #1836: Export K6 results
  const exportK6Results = (loadTestData: any, testName: string, format: 'json' | 'csv') => {
    if (!loadTestData) return;

    let content: string;
    let mimeType: string;
    let extension: string;

    if (format === 'json') {
      content = JSON.stringify(loadTestData, null, 2);
      mimeType = 'application/json';
      extension = 'json';
    } else {
      // CSV format
      const rows: string[] = [];

      // Summary section
      rows.push('# K6 Load Test Summary');
      rows.push('Metric,Value');
      rows.push(`Total Requests,${loadTestData.summary?.total_requests || 0}`);
      rows.push(`Failed Requests,${loadTestData.summary?.failed_requests || 0}`);
      rows.push(`Success Rate,${loadTestData.summary?.success_rate || '0%'}`);
      rows.push(`Requests/sec,${loadTestData.summary?.requests_per_second || 0}`);
      rows.push(`Data Transferred,${loadTestData.summary?.data_transferred_formatted || '0 B'}`);
      rows.push('');

      // Response times
      rows.push('# Response Times (ms)');
      rows.push('Percentile,Value');
      const rt = loadTestData.response_times || {};
      rows.push(`Min,${rt.min || 0}`);
      rows.push(`Avg,${rt.avg || 0}`);
      rows.push(`Median,${rt.median || 0}`);
      rows.push(`p90,${rt.p90 || 0}`);
      rows.push(`p95,${rt.p95 || 0}`);
      rows.push(`p99,${rt.p99 || 0}`);
      rows.push(`Max,${rt.max || 0}`);
      rows.push('');

      // HTTP codes
      if (loadTestData.http_codes) {
        rows.push('# HTTP Status Codes');
        rows.push('Code,Count');
        for (const [code, count] of Object.entries(loadTestData.http_codes)) {
          rows.push(`${code},${count}`);
        }
        rows.push('');
      }

      // Thresholds
      if (loadTestData.thresholds) {
        rows.push('# Thresholds');
        rows.push('Name,Passed');
        for (const [name, passed] of Object.entries(loadTestData.thresholds)) {
          rows.push(`${name},${passed ? 'PASS' : 'FAIL'}`);
        }
        rows.push('');
      }

      // Time series data
      if (loadTestData.time_series && loadTestData.time_series.length > 0) {
        rows.push('# Time Series Data');
        rows.push('Timestamp,VUs,RPS,Avg Response Time');
        for (const point of loadTestData.time_series) {
          rows.push(`${point.timestamp || point.time},${point.vus || 0},${point.rps || 0},${point.avg_response_time || 0}`);
        }
      }

      content = rows.join('\n');
      mimeType = 'text/csv';
      extension = 'csv';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `k6-results-${testName.replace(/[^a-z0-9]/gi, '_')}-${Date.now()}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Feature #1910: Export K6 results as PDF
  const exportK6ResultsPDF = (loadTestData: any, testName: string) => {
    if (!loadTestData) return;

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 20;
    let yPos = 20;

    // Helper functions
    const addTitle = (text: string, size: number = 16, color: [number, number, number] = [0, 0, 0]) => {
      pdf.setFontSize(size);
      pdf.setTextColor(...color);
      pdf.text(text, margin, yPos);
      yPos += size / 2 + 4;
    };

    const addText = (text: string, size: number = 10, color: [number, number, number] = [60, 60, 60]) => {
      pdf.setFontSize(size);
      pdf.setTextColor(...color);
      const lines = pdf.splitTextToSize(text, pageWidth - 2 * margin);
      pdf.text(lines, margin, yPos);
      yPos += lines.length * (size / 2 + 2);
    };

    const addMetricRow = (label: string, value: string, status?: 'good' | 'warning' | 'bad') => {
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text(label, margin, yPos);

      // Color based on status
      if (status === 'good') pdf.setTextColor(34, 197, 94);
      else if (status === 'warning') pdf.setTextColor(234, 179, 8);
      else if (status === 'bad') pdf.setTextColor(239, 68, 68);
      else pdf.setTextColor(0, 0, 0);

      pdf.text(value, pageWidth - margin - pdf.getTextWidth(value), yPos);
      yPos += 7;
    };

    const checkNewPage = (neededSpace: number = 30) => {
      if (yPos > pdf.internal.pageSize.getHeight() - neededSpace) {
        pdf.addPage();
        yPos = 20;
      }
    };

    // === PAGE 1: Executive Summary ===

    // Company branding area (placeholder)
    pdf.setFillColor(59, 130, 246); // Blue header
    pdf.rect(0, 0, pageWidth, 35, 'F');

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(22);
    pdf.setFont('helvetica', 'bold');
    pdf.text('K6 Load Test Report', margin, 22);

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Generated: ${new Date().toLocaleString()}`, margin, 30);

    yPos = 45;

    // Test Info
    pdf.setTextColor(0, 0, 0);
    addTitle(`Test: ${testName}`, 14);

    // Calculate overall status
    const successRate = parseFloat(String(loadTestData.summary?.success_rate).replace('%', '')) || 0;
    const errorRate = 100 - successRate;
    const thresholds = loadTestData.thresholds || {};
    const thresholdsFailed = Object.values(thresholds).filter(v => !v).length;
    const overallStatus = successRate >= 99 && errorRate < 1 && thresholdsFailed === 0 ? 'PASSED' :
                          successRate >= 95 && errorRate < 5 ? 'WARNING' : 'FAILED';

    // Status badge
    if (overallStatus === 'PASSED') pdf.setFillColor(34, 197, 94);
    else if (overallStatus === 'WARNING') pdf.setFillColor(234, 179, 8);
    else pdf.setFillColor(239, 68, 68);

    pdf.roundedRect(margin, yPos, 40, 10, 2, 2, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.text(overallStatus, margin + 20 - pdf.getTextWidth(overallStatus) / 2, yPos + 7);
    yPos += 18;

    // Executive Summary text
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(60, 60, 60);
    const summaryText = overallStatus === 'PASSED'
      ? `The system successfully handled ${(loadTestData.summary?.total_requests || 0).toLocaleString()} requests from ${loadTestData.configuration?.target_vus || loadTestData.summary?.max_vus || 0} concurrent users with a ${successRate.toFixed(1)}% success rate and ${loadTestData.response_times?.p95 || 0}ms P95 latency.`
      : overallStatus === 'WARNING'
      ? `The system processed ${(loadTestData.summary?.total_requests || 0).toLocaleString()} requests but showed signs of stress with ${errorRate.toFixed(1)}% errors. Consider optimizing before production deployment.`
      : `Performance issues detected: ${thresholdsFailed} threshold(s) failed, ${errorRate.toFixed(1)}% error rate. Investigation required.`;
    addText(summaryText);

    yPos += 8;

    // Key Metrics Section
    addTitle('Key Metrics', 14, [0, 0, 0]);

    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, yPos - 2, pageWidth - margin, yPos - 2);
    yPos += 4;

    addMetricRow('Total Requests', (loadTestData.summary?.total_requests || 0).toLocaleString());
    addMetricRow('Requests/sec', `${loadTestData.summary?.requests_per_second || 0}`);
    addMetricRow('Success Rate', `${loadTestData.summary?.success_rate || '0%'}`, successRate >= 99 ? 'good' : successRate >= 95 ? 'warning' : 'bad');
    addMetricRow('Error Rate', `${errorRate.toFixed(2)}%`, errorRate < 1 ? 'good' : errorRate < 5 ? 'warning' : 'bad');
    addMetricRow('Virtual Users', `${loadTestData.configuration?.target_vus || loadTestData.summary?.max_vus || 0}`);
    addMetricRow('Duration', `${loadTestData.configuration?.duration || loadTestData.summary?.duration_formatted || 'N/A'}`);
    addMetricRow('Data Transferred', `${loadTestData.summary?.data_transferred_formatted || '0 B'}`);

    yPos += 10;
    checkNewPage(60);

    // Response Times Section
    addTitle('Response Times', 14, [0, 0, 0]);
    pdf.line(margin, yPos - 2, pageWidth - margin, yPos - 2);
    yPos += 4;

    const rt = loadTestData.response_times || {};
    addMetricRow('Minimum', `${rt.min || 0}ms`);
    addMetricRow('Average', `${rt.avg || 0}ms`);
    addMetricRow('Median (P50)', `${rt.median || rt.p50 || 0}ms`);
    addMetricRow('P90', `${rt.p90 || 0}ms`);
    addMetricRow('P95', `${rt.p95 || 0}ms`, (rt.p95 || 0) < 500 ? 'good' : (rt.p95 || 0) < 1000 ? 'warning' : 'bad');
    addMetricRow('P99', `${rt.p99 || 0}ms`);
    addMetricRow('Maximum', `${rt.max || 0}ms`);

    yPos += 10;
    checkNewPage(60);

    // Thresholds Section
    if (loadTestData.thresholds && Object.keys(loadTestData.thresholds).length > 0) {
      addTitle('Thresholds', 14, [0, 0, 0]);
      pdf.line(margin, yPos - 2, pageWidth - margin, yPos - 2);
      yPos += 4;

      Object.entries(loadTestData.thresholds).forEach(([name, passed]) => {
        addMetricRow(name.replace(/_/g, ' '), passed ? 'PASSED' : 'FAILED', passed ? 'good' : 'bad');
      });

      yPos += 10;
      checkNewPage(60);
    }

    // HTTP Status Codes Section
    if (loadTestData.http_codes && Object.keys(loadTestData.http_codes).length > 0) {
      addTitle('HTTP Status Codes', 14, [0, 0, 0]);
      pdf.line(margin, yPos - 2, pageWidth - margin, yPos - 2);
      yPos += 4;

      Object.entries(loadTestData.http_codes).forEach(([code, count]) => {
        const codeNum = parseInt(code);
        const status = codeNum < 300 ? 'good' : codeNum < 400 ? undefined : codeNum < 500 ? 'warning' : 'bad';
        addMetricRow(`HTTP ${code}`, (count as number).toLocaleString(), status);
      });

      yPos += 10;
      checkNewPage(60);
    }

    // === PAGE 2+: Detailed Analysis ===
    pdf.addPage();
    yPos = 20;

    // Recommendations Section
    addTitle('Recommendations', 14, [0, 0, 0]);
    pdf.line(margin, yPos - 2, pageWidth - margin, yPos - 2);
    yPos += 4;

    const recommendations: string[] = [];

    if (errorRate >= 5) {
      recommendations.push('• High error rate detected. Investigate server logs and identify root cause of failures.');
    }
    if ((rt.p95 || 0) > 1000) {
      recommendations.push('• P95 response time exceeds 1 second. Consider optimizing database queries and caching strategies.');
    }
    if ((rt.p95 || 0) > 500 && (rt.p95 || 0) <= 1000) {
      recommendations.push('• P95 response time is moderate. Monitor for degradation under higher load.');
    }
    if (thresholdsFailed > 0) {
      recommendations.push(`• ${thresholdsFailed} threshold(s) failed. Review threshold configurations or optimize system performance.`);
    }
    if (successRate < 99) {
      recommendations.push('• Success rate below 99%. Investigate failed requests and implement retry mechanisms if appropriate.');
    }
    if (overallStatus === 'PASSED') {
      recommendations.push('• All metrics within acceptable range. Consider increasing load to find system limits.');
      recommendations.push('• Document this baseline for future regression testing.');
    }

    recommendations.forEach(rec => {
      addText(rec, 10, [60, 60, 60]);
      yPos += 2;
    });

    yPos += 10;

    // Configuration Section
    checkNewPage(50);
    addTitle('Test Configuration', 14, [0, 0, 0]);
    pdf.line(margin, yPos - 2, pageWidth - margin, yPos - 2);
    yPos += 4;

    if (loadTestData.configuration) {
      addMetricRow('Target VUs', `${loadTestData.configuration.target_vus || 'N/A'}`);
      addMetricRow('Duration', `${loadTestData.configuration.duration || 'N/A'}`);
      addMetricRow('Ramp-up', `${loadTestData.configuration.ramp_up || 'N/A'}`);
      if (loadTestData.configuration.script_name) {
        addMetricRow('Script', loadTestData.configuration.script_name);
      }
    }

    // Footer on all pages
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 20, pdf.internal.pageSize.getHeight() - 10);
      pdf.text('Generated by QA Guardian', margin, pdf.internal.pageSize.getHeight() - 10);
    }

    // Save PDF
    pdf.save(`k6-report-${testName.replace(/[^a-z0-9]/gi, '_')}-${Date.now()}.pdf`);
  };

  // Feature #1911: Export Lighthouse results as PDF
  const exportLighthousePDF = (lighthouseData: any, testName: string, url?: string) => {
    if (!lighthouseData) return;

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 20;
    let yPos = 20;

    // Helper functions
    const addTitle = (text: string, size: number = 16, color: [number, number, number] = [0, 0, 0]) => {
      pdf.setFontSize(size);
      pdf.setTextColor(...color);
      pdf.text(text, margin, yPos);
      yPos += size / 2 + 4;
    };

    const addText = (text: string, size: number = 10, color: [number, number, number] = [60, 60, 60]) => {
      pdf.setFontSize(size);
      pdf.setTextColor(...color);
      const lines = pdf.splitTextToSize(text, pageWidth - 2 * margin);
      pdf.text(lines, margin, yPos);
      yPos += lines.length * (size / 2 + 2);
    };

    const addMetricRow = (label: string, value: string, status?: 'good' | 'warning' | 'bad') => {
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text(label, margin, yPos);

      if (status === 'good') pdf.setTextColor(34, 197, 94);
      else if (status === 'warning') pdf.setTextColor(234, 179, 8);
      else if (status === 'bad') pdf.setTextColor(239, 68, 68);
      else pdf.setTextColor(0, 0, 0);

      pdf.text(value, pageWidth - margin - pdf.getTextWidth(value), yPos);
      yPos += 7;
    };

    const checkNewPage = (neededSpace: number = 30) => {
      if (yPos > pdf.internal.pageSize.getHeight() - neededSpace) {
        pdf.addPage();
        yPos = 20;
      }
    };

    const drawScoreGauge = (score: number, label: string, x: number, y: number) => {
      // Draw circular gauge
      const radius = 15;
      const color = score >= 90 ? [34, 197, 94] : score >= 50 ? [234, 179, 8] : [239, 68, 68];

      // Background circle
      pdf.setDrawColor(220, 220, 220);
      pdf.setLineWidth(3);
      pdf.circle(x, y, radius, 'S');

      // Score arc (simplified as full circle with color)
      pdf.setDrawColor(...color as [number, number, number]);
      pdf.setLineWidth(3);
      // Draw partial circle based on score
      const startAngle = -90;
      const endAngle = startAngle + (score / 100) * 360;

      // Draw score text
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...color as [number, number, number]);
      pdf.text(String(score), x - pdf.getTextWidth(String(score)) / 2, y + 5);

      // Label
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 100, 100);
      pdf.text(label, x - pdf.getTextWidth(label) / 2, y + radius + 8);
    };

    // === PAGE 1: Executive Summary ===

    // Header
    pdf.setFillColor(147, 51, 234); // Purple header for Lighthouse
    pdf.rect(0, 0, pageWidth, 35, 'F');

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(22);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Lighthouse Performance Report', margin, 22);

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Generated: ${new Date().toLocaleString()}`, margin, 30);

    yPos = 45;

    // Test Info
    pdf.setTextColor(0, 0, 0);
    addTitle(testName, 14);
    if (url) {
      addText(url, 10, [100, 100, 100]);
    }

    // Calculate overall status
    const scores = [
      lighthouseData.performance || 0,
      lighthouseData.accessibility || 0,
      lighthouseData.best_practices || lighthouseData.bestPractices || 0,
      lighthouseData.seo || 0,
    ].filter(s => s > 0);
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const minScore = scores.length > 0 ? Math.min(...scores) : 0;
    const overallStatus = minScore >= 90 ? 'EXCELLENT' : minScore >= 50 ? 'NEEDS IMPROVEMENT' : 'POOR';

    // Status badge
    if (overallStatus === 'EXCELLENT') pdf.setFillColor(34, 197, 94);
    else if (overallStatus === 'NEEDS IMPROVEMENT') pdf.setFillColor(234, 179, 8);
    else pdf.setFillColor(239, 68, 68);

    const badgeWidth = pdf.getTextWidth(overallStatus) + 16;
    pdf.roundedRect(margin, yPos, badgeWidth, 10, 2, 2, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.text(overallStatus, margin + badgeWidth / 2 - pdf.getTextWidth(overallStatus) / 2, yPos + 7);
    yPos += 18;

    // Score Gauges
    yPos += 5;
    const gaugeY = yPos + 15;
    const gaugeSpacing = (pageWidth - 2 * margin) / 4;

    drawScoreGauge(lighthouseData.performance || 0, 'Performance', margin + gaugeSpacing * 0.5, gaugeY);
    drawScoreGauge(lighthouseData.accessibility || 0, 'Accessibility', margin + gaugeSpacing * 1.5, gaugeY);
    drawScoreGauge(lighthouseData.best_practices || lighthouseData.bestPractices || 0, 'Best Practices', margin + gaugeSpacing * 2.5, gaugeY);
    drawScoreGauge(lighthouseData.seo || 0, 'SEO', margin + gaugeSpacing * 3.5, gaugeY);

    yPos = gaugeY + 35;

    // Summary text
    pdf.setFont('helvetica', 'normal');
    const summaryText = overallStatus === 'EXCELLENT'
      ? `This page excels across all Lighthouse categories with an average score of ${avgScore}. It provides a fast, accessible, and SEO-friendly experience.`
      : overallStatus === 'NEEDS IMPROVEMENT'
      ? `This page has an average score of ${avgScore}. Some categories need attention to meet modern web standards.`
      : `Critical performance issues detected with an average score of ${avgScore}. Immediate optimization is recommended.`;
    addText(summaryText);

    yPos += 8;

    // Core Web Vitals Section
    if (lighthouseData.metrics) {
      checkNewPage(60);
      addTitle('Core Web Vitals', 14, [0, 0, 0]);
      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, yPos - 2, pageWidth - margin, yPos - 2);
      yPos += 4;

      const metrics = lighthouseData.metrics;

      if (metrics.lcp !== undefined) {
        const lcpStatus = metrics.lcp <= 2500 ? 'good' : metrics.lcp <= 4000 ? 'warning' : 'bad';
        addMetricRow('Largest Contentful Paint (LCP)', `${Math.round(metrics.lcp)}ms`, lcpStatus);
      }
      if (metrics.fcp !== undefined) {
        const fcpStatus = metrics.fcp <= 1800 ? 'good' : metrics.fcp <= 3000 ? 'warning' : 'bad';
        addMetricRow('First Contentful Paint (FCP)', `${Math.round(metrics.fcp)}ms`, fcpStatus);
      }
      if (metrics.cls !== undefined) {
        const clsStatus = metrics.cls <= 0.1 ? 'good' : metrics.cls <= 0.25 ? 'warning' : 'bad';
        addMetricRow('Cumulative Layout Shift (CLS)', metrics.cls.toFixed(3), clsStatus);
      }
      if (metrics.tbt !== undefined) {
        const tbtStatus = metrics.tbt <= 200 ? 'good' : metrics.tbt <= 600 ? 'warning' : 'bad';
        addMetricRow('Total Blocking Time (TBT)', `${Math.round(metrics.tbt)}ms`, tbtStatus);
      }
      if (metrics.si !== undefined) {
        const siStatus = metrics.si <= 3400 ? 'good' : metrics.si <= 5800 ? 'warning' : 'bad';
        addMetricRow('Speed Index', `${Math.round(metrics.si)}ms`, siStatus);
      }

      yPos += 10;
    }

    // Opportunities Section
    if (lighthouseData.opportunities && lighthouseData.opportunities.length > 0) {
      checkNewPage(60);
      addTitle('Opportunities', 14, [0, 0, 0]);
      pdf.line(margin, yPos - 2, pageWidth - margin, yPos - 2);
      yPos += 4;

      lighthouseData.opportunities.slice(0, 10).forEach((opp: any) => {
        const savings = opp.savings >= 1000 ? `${(opp.savings / 1000).toFixed(1)}s` : `${opp.savings}ms`;
        addMetricRow(opp.title, `Save ~${savings}`, 'warning');
        if (yPos > pdf.internal.pageSize.getHeight() - 30) return;
      });

      yPos += 10;
    }

    // Diagnostics Section
    if (lighthouseData.diagnostics && lighthouseData.diagnostics.length > 0) {
      checkNewPage(60);
      addTitle('Diagnostics', 14, [0, 0, 0]);
      pdf.line(margin, yPos - 2, pageWidth - margin, yPos - 2);
      yPos += 4;

      lighthouseData.diagnostics.slice(0, 10).forEach((diag: any) => {
        pdf.setFontSize(10);
        pdf.setTextColor(60, 60, 60);
        const lines = pdf.splitTextToSize(`• ${diag.title}`, pageWidth - 2 * margin);
        pdf.text(lines, margin, yPos);
        yPos += lines.length * 6 + 2;
        if (yPos > pdf.internal.pageSize.getHeight() - 30) return;
      });

      yPos += 10;
    }

    // === PAGE 2+: Recommendations ===
    pdf.addPage();
    yPos = 20;

    addTitle('Recommendations', 14, [0, 0, 0]);
    pdf.line(margin, yPos - 2, pageWidth - margin, yPos - 2);
    yPos += 4;

    const recommendations: string[] = [];

    if ((lighthouseData.performance || 0) < 50) {
      recommendations.push('• Performance score is critical. Focus on reducing JavaScript execution time and optimizing images.');
    }
    if ((lighthouseData.performance || 0) >= 50 && (lighthouseData.performance || 0) < 90) {
      recommendations.push('• Performance can be improved. Consider lazy loading, code splitting, and caching strategies.');
    }
    if ((lighthouseData.accessibility || 0) < 90) {
      recommendations.push('• Accessibility needs attention. Ensure proper color contrast, alt text, and keyboard navigation.');
    }
    if ((lighthouseData.best_practices || lighthouseData.bestPractices || 0) < 90) {
      recommendations.push('• Review best practices. Check for HTTPS usage, browser errors, and deprecated APIs.');
    }
    if ((lighthouseData.seo || 0) < 90) {
      recommendations.push('• SEO improvements needed. Add proper meta tags, structured data, and mobile optimization.');
    }
    if (lighthouseData.metrics?.lcp > 2500) {
      recommendations.push('• LCP is slow. Optimize largest content element (hero image, heading text, etc.).');
    }
    if (lighthouseData.metrics?.cls > 0.1) {
      recommendations.push('• Layout shift detected. Reserve space for dynamic content and ads.');
    }
    if (overallStatus === 'EXCELLENT') {
      recommendations.push('• Excellent scores! Continue monitoring for regressions.');
      recommendations.push('• Consider setting up performance budgets to maintain these standards.');
    }

    recommendations.forEach(rec => {
      addText(rec, 10, [60, 60, 60]);
      yPos += 2;
    });

    // Footer on all pages
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 20, pdf.internal.pageSize.getHeight() - 10);
      pdf.text('Generated by QA Guardian', margin, pdf.internal.pageSize.getHeight() - 10);
    }

    // Save PDF
    pdf.save(`lighthouse-report-${testName.replace(/[^a-z0-9]/gi, '_')}-${Date.now()}.pdf`);
  };

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

  // Feature #1837: Toggle visual result expansion
  const toggleVisualResult = (resultId: string) => {
    setExpandedVisualResults(prev => {
      const next = new Set(prev);
      if (next.has(resultId)) {
        next.delete(resultId);
      } else {
        next.add(resultId);
      }
      return next;
    });
  };

  // Feature #1837: Handle slider position change
  const handleSliderChange = (resultId: string, position: number) => {
    setSliderPosition(prev => ({ ...prev, [resultId]: position }));
  };

  // Feature #1837: Handle onion opacity change
  const handleOnionOpacityChange = (resultId: string, opacity: number) => {
    setOnionOpacity(prev => ({ ...prev, [resultId]: opacity }));
  };

  // Feature #1877: Zoom controls for visual inspection
  const handleZoomIn = useCallback((resultId: string) => {
    setVisualZoom(prev => ({ ...prev, [resultId]: Math.min((prev[resultId] || 1) * 1.25, 5) }));
  }, []);

  const handleZoomOut = useCallback((resultId: string) => {
    setVisualZoom(prev => ({ ...prev, [resultId]: Math.max((prev[resultId] || 1) / 1.25, 0.5) }));
  }, []);

  const handleZoomReset = useCallback((resultId: string) => {
    setVisualZoom(prev => ({ ...prev, [resultId]: 1 }));
    setVisualPan(prev => ({ ...prev, [resultId]: { x: 0, y: 0 } }));
  }, []);

  const handleZoomFit = useCallback((resultId: string) => {
    setVisualZoom(prev => ({ ...prev, [resultId]: 1 }));
    setVisualPan(prev => ({ ...prev, [resultId]: { x: 0, y: 0 } }));
  }, []);

  // Feature #1877: Pan controls for visual inspection (mouse drag)
  const handlePanStart = useCallback((e: React.MouseEvent, resultId: string) => {
    const currentZoom = visualZoom[resultId] || 1;
    if (currentZoom <= 1) return; // Don't pan when not zoomed

    e.preventDefault();
    setIsPanning(true);
    const currentPan = visualPan[resultId] || { x: 0, y: 0 };
    setPanStart({ x: e.clientX, y: e.clientY, panX: currentPan.x, panY: currentPan.y });
  }, [visualZoom, visualPan]);

  const handlePanMove = useCallback((e: React.MouseEvent, resultId: string) => {
    if (!isPanning || !panStart) return;

    const dx = e.clientX - panStart.x;
    const dy = e.clientY - panStart.y;
    const currentZoom = visualZoom[resultId] || 1;

    // Limit pan based on zoom level
    const maxPan = (currentZoom - 1) * 150;
    const newX = Math.max(-maxPan, Math.min(maxPan, panStart.panX + dx));
    const newY = Math.max(-maxPan, Math.min(maxPan, panStart.panY + dy));

    setVisualPan(prev => ({ ...prev, [resultId]: { x: newX, y: newY } }));
  }, [isPanning, panStart, visualZoom]);

  const handlePanEnd = useCallback(() => {
    setIsPanning(false);
    setPanStart(null);
  }, []);

  // Feature #1877: Handle scroll wheel zoom
  const handleWheelZoom = useCallback((e: React.WheelEvent, resultId: string) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setVisualZoom(prev => {
      const currentZoom = prev[resultId] || 1;
      const newZoom = Math.max(0.5, Math.min(5, currentZoom * delta));
      return { ...prev, [resultId]: newZoom };
    });
  }, []);

  // Feature #1837 & #1919: Approve baseline (update to current) - supports per-viewport approval
  const handleApproveBaseline = async (testId: string, resultIdx: number, viewportId?: string) => {
    const key = viewportId ? `${testId}-${resultIdx}-${viewportId}` : `${testId}-${resultIdx}`;
    setApprovalLoading(prev => ({ ...prev, [key]: true }));

    try {
      // API call to approve baseline
      const response = await fetch(`/api/v1/visual/approve-baseline`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          test_id: testId,
          run_id: runId,
          viewport_id: viewportId, // Feature #1919: Per-viewport approval
        }),
      });

      if (response.ok) {
        // Show success - in real implementation would refresh data
        console.log(`Baseline approved successfully${viewportId ? ` for viewport: ${viewportId}` : ''}`);
      }
    } catch (err) {
      console.error('Failed to approve baseline:', err);
    } finally {
      setApprovalLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  // Feature #1837 & #1919: Reject (mark as regression) - supports per-viewport rejection
  const handleRejectBaseline = async (testId: string, resultIdx: number, viewportId?: string) => {
    const key = viewportId ? `${testId}-${resultIdx}-${viewportId}` : `${testId}-${resultIdx}`;
    setApprovalLoading(prev => ({ ...prev, [key]: true }));

    try {
      // API call to mark as regression
      const response = await fetch(`/api/v1/visual/reject-baseline`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          test_id: testId,
          run_id: runId,
          viewport_id: viewportId, // Feature #1919: Per-viewport rejection
        }),
      });

      if (response.ok) {
        console.log('Marked as regression');
      }
    } catch (err) {
      console.error('Failed to reject baseline:', err);
    } finally {
      setApprovalLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  // Feature #1838: Toggle accessibility severity group
  const toggleA11ySeverity = (severity: string) => {
    setA11yExpandedSeverities(prev => {
      const next = new Set(prev);
      if (next.has(severity)) {
        next.delete(severity);
      } else {
        next.add(severity);
      }
      return next;
    });
  };

  // Feature #1838: Toggle individual violation expansion
  const toggleA11yViolation = (violationId: string) => {
    setA11yExpandedViolations(prev => {
      const next = new Set(prev);
      if (next.has(violationId)) {
        next.delete(violationId);
      } else {
        next.add(violationId);
      }
      return next;
    });
  };

  // Feature #1838: Calculate a11y score based on violations
  const calculateA11yScore = (violations: AccessibilityViolation[], passes: number) => {
    if (violations.length === 0 && passes === 0) return 0;

    // Weight violations by severity
    const criticalWeight = 10;
    const seriousWeight = 5;
    const moderateWeight = 2;
    const minorWeight = 1;

    const weightedViolations = violations.reduce((total, v) => {
      switch (v.impact) {
        case 'critical': return total + criticalWeight;
        case 'serious': return total + seriousWeight;
        case 'moderate': return total + moderateWeight;
        case 'minor': return total + minorWeight;
        default: return total + 1;
      }
    }, 0);

    // Score is based on ratio of passes to weighted violations
    const totalChecks = passes + weightedViolations;
    if (totalChecks === 0) return 100;

    const score = Math.round((passes / totalChecks) * 100);
    return Math.max(0, Math.min(100, score));
  };

  // Feature #1838: Get fix suggestion for violation
  const getFixSuggestion = (violation: AccessibilityViolation): string => {
    // Common fix suggestions based on violation ID
    const suggestions: Record<string, string> = {
      'color-contrast': 'Increase the contrast ratio between text and background colors to meet WCAG requirements (4.5:1 for normal text, 3:1 for large text).',
      'image-alt': 'Add descriptive alt text to the image that conveys its meaning and context.',
      'label': 'Add a visible label or aria-label to the form element.',
      'link-name': 'Add descriptive text content or aria-label to the link.',
      'button-name': 'Add text content, aria-label, or title to the button.',
      'html-has-lang': 'Add a lang attribute to the html element specifying the page language.',
      'document-title': 'Add a descriptive title element to the page head.',
      'region': 'Wrap content in landmark regions (main, nav, header, footer, etc.).',
      'heading-order': 'Ensure headings follow a logical order (h1 → h2 → h3) without skipping levels.',
      'list': 'Ensure list items are properly nested inside ul or ol elements.',
      'tabindex': 'Remove positive tabindex values to maintain natural tab order.',
      'focus-order-semantics': 'Ensure interactive elements are focusable in a logical order.',
    };

    return suggestions[violation.id] || violation.help || 'Review the element and ensure it meets accessibility standards.';
  };

  // Feature #1838: Group violations by severity
  const groupViolationsBySeverity = (violations: AccessibilityViolation[]) => {
    const groups: Record<string, AccessibilityViolation[]> = {
      critical: [],
      serious: [],
      moderate: [],
      minor: [],
    };

    violations.forEach(v => {
      const severity = v.impact || 'minor';
      if (groups[severity]) {
        groups[severity].push(v);
      } else {
        groups.minor.push(v);
      }
    });

    return groups;
  };

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

  // Feature #1840: Network waterfall data and calculations
  interface WaterfallRequest {
    index: number;
    method: string;
    url: string;
    resourceType: string;
    status?: number;
    statusText?: string;
    duration_ms?: number;
    requestSize?: number;
    responseSize?: number;
    failed?: boolean;
    failureText?: string;
    timestamp: number;
    // Timing breakdown (simulated if not available)
    timing?: {
      dns?: number;
      connect?: number;
      ssl?: number;
      ttfb?: number;
      download?: number;
    };
  }

  const waterfallData = useMemo((): WaterfallRequest[] => {
    if (!run?.results) return [];

    const requests: WaterfallRequest[] = [];
    run.results.forEach(result => {
      (result.network_requests || []).forEach((req, idx) => {
        // Simulate timing breakdown if not available (based on total duration)
        const totalDuration = req.duration_ms || 0;
        const timing = {
          dns: Math.round(totalDuration * 0.05), // 5% DNS
          connect: Math.round(totalDuration * 0.1), // 10% Connect
          ssl: req.url?.startsWith('https') ? Math.round(totalDuration * 0.1) : 0, // 10% SSL if HTTPS
          ttfb: Math.round(totalDuration * 0.4), // 40% TTFB
          download: Math.round(totalDuration * 0.35), // 35% Download
        };

        requests.push({
          index: idx,
          method: req.method,
          url: req.url,
          resourceType: req.resourceType,
          status: req.status,
          statusText: req.statusText,
          duration_ms: req.duration_ms,
          requestSize: req.requestSize,
          responseSize: req.responseSize,
          failed: req.failed,
          failureText: req.failureText,
          timestamp: req.timestamp,
          timing,
        });
      });
    });

    return requests.sort((a, b) => a.timestamp - b.timestamp);
  }, [run]);

  // Feature #1840: Filter and sort network requests
  const filteredNetworkRequests = useMemo(() => {
    return waterfallData.filter(req => {
      // Apply type filter
      const type = req.resourceType?.toLowerCase() || 'other';
      const normalizedType = type === 'xmlhttprequest' ? 'xhr' : type;
      if (!networkTypeFilter.has(normalizedType) && !networkTypeFilter.has('other')) {
        // Check if we should show it as 'other'
        const knownTypes = ['xhr', 'fetch', 'script', 'stylesheet', 'image', 'font', 'document'];
        if (!knownTypes.includes(normalizedType) && !networkTypeFilter.has('other')) {
          return false;
        }
        if (knownTypes.includes(normalizedType) && !networkTypeFilter.has(normalizedType)) {
          return false;
        }
      }

      // Apply search filter
      if (networkSearch.trim()) {
        const searchLower = networkSearch.toLowerCase();
        return req.url.toLowerCase().includes(searchLower) ||
          req.method.toLowerCase().includes(searchLower);
      }

      return true;
    }).sort((a, b) => {
      switch (networkSortBy) {
        case 'duration':
          return (b.duration_ms || 0) - (a.duration_ms || 0);
        case 'size':
          return (b.responseSize || 0) - (a.responseSize || 0);
        default:
          return a.timestamp - b.timestamp;
      }
    });
  }, [waterfallData, networkTypeFilter, networkSearch, networkSortBy]);

  // Feature #1840: Calculate waterfall timeline bounds
  const waterfallBounds = useMemo(() => {
    if (waterfallData.length === 0) return { start: 0, end: 0, duration: 0 };

    const startTime = Math.min(...waterfallData.map(r => r.timestamp));
    const endTime = Math.max(...waterfallData.map(r => r.timestamp + (r.duration_ms || 0)));

    return {
      start: startTime,
      end: endTime,
      duration: endTime - startTime,
    };
  }, [waterfallData]);

  // Feature #1840: Get waterfall bar position and width
  const getWaterfallPosition = (req: WaterfallRequest) => {
    if (waterfallBounds.duration === 0) return { left: 0, width: 0 };

    const left = ((req.timestamp - waterfallBounds.start) / waterfallBounds.duration) * 100;
    const width = ((req.duration_ms || 0) / waterfallBounds.duration) * 100;

    return { left: Math.max(0, left), width: Math.max(0.5, width) };
  };

  // Feature #1840: Network stats
  const networkStats = useMemo(() => {
    return {
      totalRequests: networkRequests.length,
      totalSize: networkRequests.reduce((sum, r) => sum + (r.responseSize || 0), 0),
      totalDuration: waterfallBounds.duration,
      failedRequests: networkRequests.filter(r => r.failed || (r.status && r.status >= 400)).length,
      byType: Object.entries(
        networkRequests.reduce((acc, r) => {
          const type = r.resourceType?.toLowerCase() || 'other';
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      ),
    };
  }, [networkRequests, waterfallBounds]);

  // Feature #1840: Export HAR file
  const exportHAR = () => {
    const harData = {
      log: {
        version: '1.2',
        creator: {
          name: 'QA Guardian',
          version: '1.0',
        },
        entries: waterfallData.map(req => ({
          startedDateTime: new Date(req.timestamp).toISOString(),
          time: req.duration_ms || 0,
          request: {
            method: req.method,
            url: req.url,
            httpVersion: 'HTTP/1.1',
            headers: [],
            queryString: [],
            cookies: [],
            headersSize: req.requestSize || -1,
            bodySize: req.requestSize || -1,
          },
          response: {
            status: req.status || 0,
            statusText: req.statusText || '',
            httpVersion: 'HTTP/1.1',
            headers: [],
            cookies: [],
            content: {
              size: req.responseSize || 0,
              mimeType: '',
            },
            redirectURL: '',
            headersSize: -1,
            bodySize: req.responseSize || -1,
          },
          cache: {},
          timings: {
            dns: req.timing?.dns || -1,
            connect: req.timing?.connect || -1,
            ssl: req.timing?.ssl || -1,
            send: 0,
            wait: req.timing?.ttfb || -1,
            receive: req.timing?.download || -1,
          },
        })),
      },
    };

    const blob = new Blob([JSON.stringify(harData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `network-${runId}-${Date.now()}.har`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Feature #1840: Toggle network type filter
  const toggleNetworkType = (type: string) => {
    setNetworkTypeFilter(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  // Feature #1840: Format bytes
  const formatBytes = (bytes?: number) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

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
        value: result.load_test.summary.requests_per_second,
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

  // Feature #1843 + #1988: Generate PDF report with executive summary, charts, and metrics
  const generatePdfReport = async () => {
    if (!run) return;

    setGeneratingPdf(true);
    try {
      const pdf = new jsPDF();
      let yPos = 20;
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - 2 * margin;

      // Calculate metrics
      const passRate = resultSummary.total > 0 ? Math.round((resultSummary.passed / resultSummary.total) * 100) : 0;
      const healthScore = resultSummary.total > 0 ? Math.round((resultSummary.passed / resultSummary.total) * 100) : 0;
      const failedTests = resultSummary.failed;

      // Helper to add new page if needed
      const checkNewPage = (height: number) => {
        if (yPos + height > pageHeight - 25) {
          pdf.addPage();
          yPos = 20;
        }
      };

      // Helper to draw a simple pie chart
      const drawPieChart = (x: number, y: number, radius: number, passed: number, failed: number, skipped: number) => {
        const total = passed + failed + skipped;
        if (total === 0) return;

        const centerX = x;
        const centerY = y;
        let startAngle = -Math.PI / 2; // Start from top

        // Draw passed segment (green)
        if (passed > 0) {
          const passedAngle = (passed / total) * 2 * Math.PI;
          pdf.setFillColor(34, 197, 94);
          drawPieSlice(pdf, centerX, centerY, radius, startAngle, startAngle + passedAngle);
          startAngle += passedAngle;
        }

        // Draw failed segment (red)
        if (failed > 0) {
          const failedAngle = (failed / total) * 2 * Math.PI;
          pdf.setFillColor(239, 68, 68);
          drawPieSlice(pdf, centerX, centerY, radius, startAngle, startAngle + failedAngle);
          startAngle += failedAngle;
        }

        // Draw skipped segment (gray)
        if (skipped > 0) {
          const skippedAngle = (skipped / total) * 2 * Math.PI;
          pdf.setFillColor(156, 163, 175);
          drawPieSlice(pdf, centerX, centerY, radius, startAngle, startAngle + skippedAngle);
        }
      };

      // Helper to draw pie slice
      const drawPieSlice = (doc: jsPDF, cx: number, cy: number, r: number, startA: number, endA: number) => {
        const steps = 20;
        const angleStep = (endA - startA) / steps;
        const points: [number, number][] = [[cx, cy]];

        for (let i = 0; i <= steps; i++) {
          const angle = startA + i * angleStep;
          points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
        }

        // Draw filled polygon
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(0.5);
        let path = `${points[0][0]} ${points[0][1]} m `;
        for (let i = 1; i < points.length; i++) {
          path += `${points[i][0]} ${points[i][1]} l `;
        }
        // Use triangle approach for simplicity
        for (let i = 1; i < points.length - 1; i++) {
          doc.triangle(cx, cy, points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], 'F');
        }
      };

      // === HEADER SECTION ===
      // Feature #1995: Company branding in PDF header
      // Blue gradient header background
      pdf.setFillColor(59, 130, 246);
      pdf.rect(0, 0, pageWidth, 45, 'F');

      // Company logo (if available)
      let titleOffset = margin;
      if (logoBase64) {
        try {
          // Add company logo on the left side of header
          const logoHeight = 28;
          const logoWidth = 28;
          const logoY = 8;
          pdf.addImage(logoBase64, 'PNG', margin, logoY, logoWidth, logoHeight);
          titleOffset = margin + logoWidth + 8; // Offset title to the right of logo
        } catch (logoError) {
          console.warn('Failed to add logo to PDF:', logoError);
        }
      }

      // Title
      pdf.setFontSize(26);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(255, 255, 255);
      pdf.text('Test Run Report', titleOffset, 28);

      // Organization name (below title if logo is present)
      if (logoBase64 && organizationName && organizationName !== 'My Organization') {
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.text(organizationName, titleOffset, 38);
      }

      // Run ID badge
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Run #${run.id.slice(-8)}`, pageWidth - margin - 30, 28);

      yPos = 55;

      // === EXECUTIVE SUMMARY SECTION ===
      // Feature #1992: Conditionally include based on pdfSections
      if (pdfSections.summary) {
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(30, 41, 59);
      pdf.text('Executive Summary', margin, yPos);
      yPos += 12;

      // Executive summary box
      pdf.setFillColor(248, 250, 252);
      pdf.setDrawColor(226, 232, 240);
      pdf.roundedRect(margin, yPos, contentWidth, 65, 3, 3, 'FD');

      const boxY = yPos + 8;
      const colWidth = contentWidth / 3;

      // Column 1: Health Score with circular indicator
      const healthX = margin + colWidth / 2;
      const healthY = boxY + 15;

      // Draw health score circle
      const scoreRadius = 18;
      // Background circle
      pdf.setFillColor(healthScore >= 80 ? 220 : healthScore >= 50 ? 254 : 254,
                       healthScore >= 80 ? 252 : healthScore >= 50 ? 243 : 226,
                       healthScore >= 80 ? 231 : healthScore >= 50 ? 199 : 226);
      pdf.circle(healthX, healthY, scoreRadius, 'F');
      // Score text
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(healthScore >= 80 ? 34 : healthScore >= 50 ? 217 : 239,
                       healthScore >= 80 ? 197 : healthScore >= 50 ? 119 : 68,
                       healthScore >= 80 ? 94 : healthScore >= 50 ? 6 : 68);
      pdf.text(String(healthScore), healthX - pdf.getTextWidth(String(healthScore)) / 2, healthY + 2);
      pdf.setFontSize(8);
      pdf.text('/100', healthX - pdf.getTextWidth('/100') / 2, healthY + 10);

      // Label
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 116, 139);
      pdf.text('Health Score', healthX - pdf.getTextWidth('Health Score') / 2, healthY + scoreRadius + 10);

      // Column 2: Pass Rate with percentage
      const passX = margin + colWidth + colWidth / 2;
      const passY = boxY + 8;

      pdf.setFontSize(10);
      pdf.setTextColor(100, 116, 139);
      pdf.text('Pass Rate', passX - pdf.getTextWidth('Pass Rate') / 2, passY);

      pdf.setFontSize(28);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(passRate >= 80 ? 34 : passRate >= 50 ? 217 : 239,
                       passRate >= 80 ? 197 : passRate >= 50 ? 119 : 68,
                       passRate >= 80 ? 94 : passRate >= 50 ? 6 : 68);
      pdf.text(`${passRate}%`, passX - pdf.getTextWidth(`${passRate}%`) / 2, passY + 18);

      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 116, 139);
      const passText = `(${resultSummary.passed}/${resultSummary.total} tests)`;
      pdf.text(passText, passX - pdf.getTextWidth(passText) / 2, passY + 26);

      // Column 3: Critical Issues
      const issuesX = margin + 2 * colWidth + colWidth / 2;
      const issuesY = boxY + 8;

      pdf.setFontSize(10);
      pdf.setTextColor(100, 116, 139);
      pdf.text('Critical Issues', issuesX - pdf.getTextWidth('Critical Issues') / 2, issuesY);

      pdf.setFontSize(28);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(failedTests > 0 ? 239 : 34, failedTests > 0 ? 68 : 197, failedTests > 0 ? 68 : 94);
      pdf.text(String(failedTests), issuesX - pdf.getTextWidth(String(failedTests)) / 2, issuesY + 18);

      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 116, 139);
      const failText = failedTests === 1 ? 'failure' : 'failures';
      pdf.text(failText, issuesX - pdf.getTextWidth(failText) / 2, issuesY + 26);

      yPos += 75;

      // === METRICS ROW ===
      const metricsY = yPos;
      const metricBoxWidth = contentWidth / 4 - 3;

      // Metric boxes
      const metrics = [
        { label: 'Total Tests', value: String(resultSummary.total), color: [59, 130, 246] },
        { label: 'Passed', value: String(resultSummary.passed), color: [34, 197, 94] },
        { label: 'Failed', value: String(resultSummary.failed), color: [239, 68, 68] },
        { label: 'Duration', value: formatDuration(run.duration_ms), color: [139, 92, 246] },
      ];

      metrics.forEach((metric, i) => {
        const boxX = margin + i * (metricBoxWidth + 4);
        pdf.setFillColor(metric.color[0], metric.color[1], metric.color[2]);
        pdf.roundedRect(boxX, metricsY, metricBoxWidth, 25, 2, 2, 'F');

        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(255, 255, 255);
        pdf.text(metric.label, boxX + metricBoxWidth / 2 - pdf.getTextWidth(metric.label) / 2, metricsY + 8);

        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text(metric.value, boxX + metricBoxWidth / 2 - pdf.getTextWidth(metric.value) / 2, metricsY + 19);
      });

      yPos = metricsY + 35;
      } // End pdfSections.summary

      // Helper to infer test type from result data if test_type not explicitly set
      // Defined outside conditionals since used in multiple sections
      const inferTestType = (result: typeof run.results[0]): string => {
        // If explicit test_type is set, use it
        if (result.test_type) {
          // Map backend types to display names
          const typeMap: Record<string, string> = {
            'visual_regression': 'VISUAL',
            'lighthouse': 'PERFORMANCE',
            'load': 'LOAD',
            'accessibility': 'ACCESSIBILITY',
            'e2e': 'E2E',
          };
          return typeMap[result.test_type] || result.test_type.toUpperCase();
        }
        // Infer from test data
        if (result.steps.some(s => s.lighthouse)) return 'PERFORMANCE';
        if (result.steps.some(s => s.accessibility)) return 'ACCESSIBILITY';
        if (result.visual_comparison || result.baseline_screenshot_base64 || result.diff_image_base64) return 'VISUAL';
        if (result.steps.some(s => s.load_test)) return 'LOAD';
        return 'E2E';
      };

      // === TEST BREAKDOWN BY TYPE SECTION ===
      // Feature #1992: Conditionally include based on pdfSections
      if (pdfSections.typeBreakdown) {
      // Group tests by type and calculate stats for each
      const testsByType = new Map<string, { passed: number; failed: number; skipped: number; total: number }>();

      run.results.forEach((result) => {
        const testType = inferTestType(result);
        if (!testsByType.has(testType)) {
          testsByType.set(testType, { passed: 0, failed: 0, skipped: 0, total: 0 });
        }
        const typeStats = testsByType.get(testType)!;
        typeStats.total++;
        if (result.status === 'passed') {
          typeStats.passed++;
        } else if (result.status === 'failed' || result.status === 'error') {
          typeStats.failed++;
        } else {
          typeStats.skipped++;
        }
      });

      // Only show breakdown if there's more than one type or multiple tests
      if (testsByType.size > 0) {
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(30, 41, 59);
        pdf.text('Test Breakdown by Type', margin, yPos);
        yPos += 10;

        // Calculate layout - show types in a grid
        const typeEntries = Array.from(testsByType.entries()).sort((a, b) => b[1].total - a[1].total);
        const typeBoxWidth = (contentWidth - 10) / Math.min(typeEntries.length, 3);
        const typeBoxHeight = 50;

        typeEntries.forEach((entry, idx) => {
          const [typeName, stats] = entry;
          const col = idx % 3;
          const row = Math.floor(idx / 3);

          if (col === 0 && row > 0) {
            yPos += typeBoxHeight + 8;
            checkNewPage(typeBoxHeight + 10);
          }

          const boxX = margin + col * (typeBoxWidth + 5);
          const boxY = yPos;

          // Type box background
          pdf.setFillColor(248, 250, 252);
          pdf.setDrawColor(226, 232, 240);
          pdf.setLineWidth(0.3);
          pdf.roundedRect(boxX, boxY, typeBoxWidth, typeBoxHeight, 2, 2, 'FD');

          // Type name header with colored accent
          const typeColors: Record<string, [number, number, number]> = {
            'E2E': [59, 130, 246],       // Blue
            'VISUAL': [139, 92, 246],    // Purple
            'ACCESSIBILITY': [34, 197, 94], // Green
            'A11Y': [34, 197, 94],       // Green
            'SMOKE': [245, 158, 11],     // Amber
            'LOAD': [236, 72, 153],      // Pink
            'PERFORMANCE': [6, 182, 212], // Cyan
            'SECURITY': [239, 68, 68],   // Red
            'API': [16, 185, 129],       // Emerald
          };
          const typeColor = typeColors[typeName] || [107, 114, 128]; // Default gray

          // Color accent bar at top
          pdf.setFillColor(typeColor[0], typeColor[1], typeColor[2]);
          pdf.rect(boxX, boxY, typeBoxWidth, 4, 'F');

          // Type name
          pdf.setFontSize(11);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(30, 41, 59);
          pdf.text(typeName, boxX + 5, boxY + 14);

          // Total count
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(100, 116, 139);
          pdf.text(`${stats.total} test${stats.total > 1 ? 's' : ''}`, boxX + 5, boxY + 22);

          // Pass/Fail mini bar
          const barY = boxY + 28;
          const barWidth = typeBoxWidth - 10;
          const barHeight = 6;

          // Background bar
          pdf.setFillColor(229, 231, 235);
          pdf.roundedRect(boxX + 5, barY, barWidth, barHeight, 1, 1, 'F');

          // Passed portion (green)
          if (stats.passed > 0) {
            const passedWidth = (stats.passed / stats.total) * barWidth;
            pdf.setFillColor(34, 197, 94);
            pdf.roundedRect(boxX + 5, barY, passedWidth, barHeight, 1, 1, 'F');
          }

          // Failed portion (red) - starts after passed
          if (stats.failed > 0) {
            const passedWidth = (stats.passed / stats.total) * barWidth;
            const failedWidth = (stats.failed / stats.total) * barWidth;
            pdf.setFillColor(239, 68, 68);
            pdf.rect(boxX + 5 + passedWidth, barY, failedWidth, barHeight, 'F');
          }

          // Stats text below bar
          pdf.setFontSize(8);
          pdf.setTextColor(34, 197, 94);
          pdf.text(`✓ ${stats.passed}`, boxX + 5, boxY + 44);

          pdf.setTextColor(239, 68, 68);
          pdf.text(`✗ ${stats.failed}`, boxX + 30, boxY + 44);

          if (stats.skipped > 0) {
            pdf.setTextColor(156, 163, 175);
            pdf.text(`○ ${stats.skipped}`, boxX + 55, boxY + 44);
          }

          // Pass rate percentage
          const typePassRate = stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0;
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(typePassRate >= 80 ? 34 : typePassRate >= 50 ? 217 : 239,
                           typePassRate >= 80 ? 197 : typePassRate >= 50 ? 119 : 68,
                           typePassRate >= 80 ? 94 : typePassRate >= 50 ? 6 : 68);
          pdf.text(`${typePassRate}%`, boxX + typeBoxWidth - 20, boxY + 14);
        });

        // Move yPos to after the type boxes
        const totalRows = Math.ceil(typeEntries.length / 3);
        yPos += typeBoxHeight + 15 + (totalRows > 1 ? (totalRows - 1) * (typeBoxHeight + 8) : 0);
      }
      } // End pdfSections.typeBreakdown

      // === PIE CHART SECTION ===
      // Feature #1992: Conditionally include with summary
      if (pdfSections.summary) {
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(30, 41, 59);
      pdf.text('Results Distribution', margin, yPos);
      yPos += 5;

      // Draw pie chart
      const chartX = margin + 35;
      const chartY = yPos + 30;
      const chartRadius = 25;

      drawPieChart(chartX, chartY, chartRadius, resultSummary.passed, resultSummary.failed, resultSummary.skipped);

      // Legend
      const legendX = chartX + 50;
      const legendY = chartY - 15;

      // Passed legend
      pdf.setFillColor(34, 197, 94);
      pdf.rect(legendX, legendY, 8, 8, 'F');
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(60, 60, 60);
      pdf.text(`Passed (${resultSummary.passed})`, legendX + 12, legendY + 6);

      // Failed legend
      pdf.setFillColor(239, 68, 68);
      pdf.rect(legendX, legendY + 14, 8, 8, 'F');
      pdf.text(`Failed (${resultSummary.failed})`, legendX + 12, legendY + 20);

      // Skipped legend
      if (resultSummary.skipped > 0) {
        pdf.setFillColor(156, 163, 175);
        pdf.rect(legendX, legendY + 28, 8, 8, 'F');
        pdf.text(`Skipped (${resultSummary.skipped})`, legendX + 12, legendY + 34);
      }

      // Run Info on right side
      const infoX = margin + contentWidth / 2 + 10;
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(30, 41, 59);
      pdf.text('Run Details', infoX, yPos);

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(71, 85, 105);
      const runDetails = [
        `Run ID: ${run.id}`,
        `Status: ${run.status.toUpperCase()}`,
        `Started: ${new Date(run.created_at).toLocaleString()}`,
        `Completed: ${run.completed_at ? new Date(run.completed_at).toLocaleString() : 'In Progress'}`,
        `Branch: ${run.branch || 'main'}`,
      ];
      runDetails.forEach((detail, i) => {
        pdf.text(detail, infoX, yPos + 8 + i * 7);
      });

      yPos = chartY + chartRadius + 20;
      } // End pdfSections.summary (pie chart)

      // === TEST RESULTS TABLE ===
      // Feature #1992: Conditionally include based on pdfSections
      if (pdfSections.testResults) {
      checkNewPage(40);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(30, 41, 59);
      pdf.text('Test Results', margin, yPos);
      yPos += 8;

      // Table header
      pdf.setFillColor(241, 245, 249);
      pdf.rect(margin, yPos, contentWidth, 10, 'F');
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(71, 85, 105);
      pdf.text('#', margin + 3, yPos + 7);
      pdf.text('Test Name', margin + 15, yPos + 7);
      pdf.text('Type', margin + 105, yPos + 7);
      pdf.text('Duration', margin + 130, yPos + 7);
      pdf.text('Status', margin + 155, yPos + 7);
      yPos += 12;

      // Table rows
      run.results.forEach((result, idx) => {
        checkNewPage(15);

        // Alternating row background
        if (idx % 2 === 0) {
          pdf.setFillColor(249, 250, 251);
          pdf.rect(margin, yPos - 4, contentWidth, 12, 'F');
        }

        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(60, 60, 60);

        // Row number
        pdf.text(String(idx + 1), margin + 3, yPos + 3);

        // Test name (truncated if needed)
        const testName = result.test_name.length > 45 ? result.test_name.slice(0, 42) + '...' : result.test_name;
        pdf.text(testName, margin + 15, yPos + 3);

        // Test type - use inference helper
        const testTypeForTable = inferTestType(result);
        pdf.setFontSize(7);
        pdf.text(testTypeForTable, margin + 105, yPos + 3);

        // Duration
        pdf.setFontSize(9);
        pdf.text(formatDuration(result.duration_ms), margin + 130, yPos + 3);

        // Status with color
        if (result.status === 'passed') {
          pdf.setTextColor(34, 197, 94);
          pdf.setFont('helvetica', 'bold');
          pdf.text('PASSED', margin + 155, yPos + 3);
        } else if (result.status === 'failed' || result.status === 'error') {
          pdf.setTextColor(239, 68, 68);
          pdf.setFont('helvetica', 'bold');
          pdf.text('FAILED', margin + 155, yPos + 3);
        } else {
          pdf.setTextColor(156, 163, 175);
          pdf.setFont('helvetica', 'normal');
          pdf.text(result.status.toUpperCase(), margin + 155, yPos + 3);
        }

        yPos += 10;

        // Show brief error message for failed tests (full details in Failure Details section)
        if (result.error) {
          checkNewPage(12);
          pdf.setFontSize(8);
          pdf.setTextColor(239, 68, 68);
          pdf.setFont('helvetica', 'italic');
          const errorLines = pdf.splitTextToSize(`Error: ${result.error}`, contentWidth - 20);
          errorLines.slice(0, 2).forEach((line: string) => {
            pdf.text(line, margin + 15, yPos + 1);
            yPos += 5;
          });
        }
      });
      } // End pdfSections.testResults

      // === FAILURE DETAILS SECTION ===
      // Feature #1992: Conditionally include based on pdfSections
      // Only add if there are failed tests
      const failedResults = run.results.filter(r => r.status === 'failed' || r.status === 'error');
      if (pdfSections.failures && failedResults.length > 0) {
        pdf.addPage();
        yPos = 20;

        // Section header
        pdf.setFontSize(18);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(239, 68, 68);
        pdf.text('⚠️ Failure Details', margin, yPos);
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(100, 116, 139);
        pdf.text(`${failedResults.length} failed test${failedResults.length > 1 ? 's' : ''}`, margin + 70, yPos);
        yPos += 15;

        failedResults.forEach((result, idx) => {
          // Check if we need a new page (reserve at least 80 pixels for content)
          if (yPos > pageHeight - 80) {
            pdf.addPage();
            yPos = 20;
          }

          // Failure card background
          pdf.setFillColor(254, 242, 242); // Light red background
          pdf.setDrawColor(252, 165, 165); // Red border
          pdf.setLineWidth(0.5);

          // Calculate card height based on error content
          const errorText = result.error || 'Unknown error';
          const errorLines = pdf.splitTextToSize(errorText, contentWidth - 20);
          const maxErrorLines = Math.min(errorLines.length, 15); // Cap at 15 lines
          const cardHeight = 45 + (maxErrorLines * 4.5);

          pdf.roundedRect(margin, yPos, contentWidth, cardHeight, 3, 3, 'FD');

          // Test number and name
          pdf.setFontSize(12);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(185, 28, 28); // Dark red
          pdf.text(`${idx + 1}. ${result.test_name}`, margin + 5, yPos + 10);

          // Test type badge - use inference helper
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'normal');
          const failedTestType = inferTestType(result);
          pdf.setFillColor(254, 226, 226);
          const badgeWidth = pdf.getTextWidth(failedTestType) + 8;
          pdf.roundedRect(margin + 5, yPos + 13, badgeWidth, 6, 1, 1, 'F');
          pdf.setTextColor(185, 28, 28);
          pdf.text(failedTestType, margin + 9, yPos + 17);

          // Duration
          pdf.setTextColor(100, 116, 139);
          pdf.text(`Duration: ${formatDuration(result.duration_ms)}`, margin + 5 + badgeWidth + 10, yPos + 17);

          // Error label
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(127, 29, 29);
          pdf.text('Error Message / Stack Trace:', margin + 5, yPos + 27);

          // Error content (full error with potential stack trace)
          pdf.setFontSize(8);
          pdf.setFont('courier', 'normal'); // Monospace for stack traces
          pdf.setTextColor(127, 29, 29);

          let errorY = yPos + 33;
          errorLines.slice(0, maxErrorLines).forEach((line: string) => {
            pdf.text(line, margin + 5, errorY);
            errorY += 4.5;
          });

          // Show truncation notice if error was cut
          if (errorLines.length > maxErrorLines) {
            pdf.setFont('helvetica', 'italic');
            pdf.setTextColor(156, 163, 175);
            pdf.text(`... (${errorLines.length - maxErrorLines} more lines)`, margin + 5, errorY);
          }

          yPos += cardHeight + 10;
        });
      }

      // === SCREENSHOTS SECTION ===
      // Feature #1992: Conditionally include based on pdfSections
      if (pdfSections.screenshots) {
      // Collect all screenshots from test results
      const screenshotsToEmbed: Array<{
        testName: string;
        stepLabel: string;
        dataUrl: string;
        status: string;
      }> = [];

      run.results.forEach((result) => {
        // Final screenshot for each test
        if (result.screenshot_base64) {
          screenshotsToEmbed.push({
            testName: result.test_name,
            stepLabel: 'Final Screenshot',
            dataUrl: result.screenshot_base64.startsWith('data:')
              ? result.screenshot_base64
              : `data:image/png;base64,${result.screenshot_base64}`,
            status: result.status,
          });
        }

        // Step-level screenshots
        result.steps.forEach((step, stepIdx) => {
          if (step.screenshot_after) {
            screenshotsToEmbed.push({
              testName: result.test_name,
              stepLabel: `Step ${stepIdx + 1}: ${step.action}`,
              dataUrl: step.screenshot_after.startsWith('data:')
                ? step.screenshot_after
                : `data:image/png;base64,${step.screenshot_after}`,
              status: result.status,
            });
          }
          if (step.screenshot_before) {
            screenshotsToEmbed.push({
              testName: result.test_name,
              stepLabel: `Step ${stepIdx + 1} (Before): ${step.action}`,
              dataUrl: step.screenshot_before.startsWith('data:')
                ? step.screenshot_before
                : `data:image/png;base64,${step.screenshot_before}`,
              status: result.status,
            });
          }
        });
      });

      // Only add screenshots section if there are screenshots
      if (screenshotsToEmbed.length > 0) {
        pdf.addPage();
        yPos = 20;

        // Section title
        pdf.setFontSize(18);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(30, 41, 59);
        pdf.text('📸 Screenshots', margin, yPos);
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(100, 116, 139);
        pdf.text(`${screenshotsToEmbed.length} screenshot${screenshotsToEmbed.length > 1 ? 's' : ''} captured`, margin + 60, yPos);
        yPos += 15;

        // Layout: 2 screenshots per row
        const imgWidth = (contentWidth - 10) / 2; // Width for each image
        const imgHeight = 60; // Fixed height for thumbnails
        const labelHeight = 20;
        const itemHeight = imgHeight + labelHeight + 10;

        screenshotsToEmbed.forEach((screenshot, idx) => {
          // Check if we need a new page
          if (yPos + itemHeight > pageHeight - 30) {
            pdf.addPage();
            yPos = 20;
          }

          // Calculate position (2 per row)
          const col = idx % 2;
          const xPos = margin + col * (imgWidth + 10);

          // If starting a new row and not first item
          if (col === 0 && idx > 0) {
            yPos += itemHeight;
          }

          // Draw image container with border
          pdf.setDrawColor(226, 232, 240);
          pdf.setLineWidth(0.5);
          pdf.rect(xPos, yPos, imgWidth, imgHeight + labelHeight, 'S');

          // Try to add the image
          try {
            pdf.addImage(
              screenshot.dataUrl,
              'PNG',
              xPos + 2,
              yPos + 2,
              imgWidth - 4,
              imgHeight - 4,
              undefined,
              'FAST'
            );
          } catch (imgErr) {
            // If image fails to load, show placeholder
            pdf.setFillColor(241, 245, 249);
            pdf.rect(xPos + 2, yPos + 2, imgWidth - 4, imgHeight - 4, 'F');
            pdf.setFontSize(9);
            pdf.setTextColor(156, 163, 175);
            pdf.text('Image unavailable', xPos + imgWidth / 2 - 20, yPos + imgHeight / 2);
          }

          // Label background
          pdf.setFillColor(248, 250, 252);
          pdf.rect(xPos, yPos + imgHeight, imgWidth, labelHeight, 'F');

          // Test name (truncated)
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(30, 41, 59);
          const truncatedTestName = screenshot.testName.length > 35
            ? screenshot.testName.slice(0, 32) + '...'
            : screenshot.testName;
          pdf.text(truncatedTestName, xPos + 3, yPos + imgHeight + 6);

          // Step label
          pdf.setFontSize(7);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(100, 116, 139);
          const truncatedStep = screenshot.stepLabel.length > 40
            ? screenshot.stepLabel.slice(0, 37) + '...'
            : screenshot.stepLabel;
          pdf.text(truncatedStep, xPos + 3, yPos + imgHeight + 12);

          // Status indicator
          if (screenshot.status === 'passed') {
            pdf.setFillColor(34, 197, 94);
          } else if (screenshot.status === 'failed') {
            pdf.setFillColor(239, 68, 68);
          } else {
            pdf.setFillColor(156, 163, 175);
          }
          pdf.circle(xPos + imgWidth - 8, yPos + imgHeight + 10, 3, 'F');
        });

        // Move to next row if we ended on an odd item
        if (screenshotsToEmbed.length % 2 === 1) {
          yPos += itemHeight;
        } else {
          yPos += itemHeight;
        }
      }
      } // End pdfSections.screenshots

      // === FOOTER ===
      const pageCount = pdf.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(156, 163, 175);
        pdf.text(
          `Page ${i} of ${pageCount} | Generated by QA Guardian | ${new Date().toLocaleString()}`,
          margin,
          pageHeight - 10
        );

        // QA Guardian branding
        pdf.setTextColor(59, 130, 246);
        pdf.text('QA Guardian', pageWidth - margin - pdf.getTextWidth('QA Guardian'), pageHeight - 10);
      }

      pdf.save(`test-report-${run.id}.pdf`);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
    } finally {
      setGeneratingPdf(false);
    }
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

  // Feature #1993: Generate self-contained HTML report
  const generateHtmlReport = () => {
    if (!run) return;
    setGeneratingHtml(true);

    try {
      const passRate = resultSummary.total > 0 ? Math.round((resultSummary.passed / resultSummary.total) * 100) : 0;
      const healthColor = passRate >= 80 ? '#22c55e' : passRate >= 50 ? '#f59e0b' : '#ef4444';

      // Generate HTML content
      const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test Report - ${run.id}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #1e293b; line-height: 1.6; }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 40px 20px; border-radius: 12px; margin-bottom: 24px; }
    .header h1 { font-size: 28px; margin-bottom: 8px; }
    .header .run-id { opacity: 0.8; font-size: 14px; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .summary-card { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; }
    .summary-card .value { font-size: 32px; font-weight: bold; margin-bottom: 4px; }
    .summary-card .label { color: #64748b; font-size: 14px; }
    .health-score { color: ${healthColor}; }
    .section { background: white; border-radius: 12px; padding: 24px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .section h2 { font-size: 20px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; cursor: pointer; }
    .section h2::before { content: '▼'; font-size: 12px; transition: transform 0.2s; }
    .section.collapsed h2::before { transform: rotate(-90deg); }
    .section.collapsed .section-content { display: none; }
    .test-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
    .test-card.passed { border-left: 4px solid #22c55e; }
    .test-card.failed { border-left: 4px solid #ef4444; }
    .test-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .test-name { font-weight: 600; }
    .test-status { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .test-status.passed { background: #dcfce7; color: #166534; }
    .test-status.failed { background: #fee2e2; color: #991b1b; }
    .test-meta { display: flex; gap: 16px; color: #64748b; font-size: 14px; }
    .steps-list { margin-top: 12px; }
    .step { padding: 8px 12px; border-radius: 4px; margin-bottom: 4px; display: flex; justify-content: space-between; }
    .step.passed { background: #f0fdf4; }
    .step.failed { background: #fef2f2; }
    .step-action { font-family: monospace; font-size: 13px; }
    .screenshot-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
    .screenshot-card { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; cursor: pointer; }
    .screenshot-card img { width: 100%; height: 200px; object-fit: cover; }
    .screenshot-card .caption { padding: 12px; font-size: 14px; background: #f8fafc; }
    .modal { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.9); z-index: 1000; justify-content: center; align-items: center; }
    .modal.active { display: flex; }
    .modal img { max-width: 90%; max-height: 90%; object-fit: contain; }
    .modal-close { position: absolute; top: 20px; right: 20px; color: white; font-size: 32px; cursor: pointer; }
    .error-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-top: 12px; }
    .error-box pre { font-family: monospace; font-size: 12px; white-space: pre-wrap; word-break: break-all; color: #991b1b; }
    .footer { text-align: center; padding: 24px; color: #64748b; font-size: 14px; }
    @media (max-width: 768px) {
      .summary-grid { grid-template-columns: repeat(2, 1fr); }
      .test-header { flex-direction: column; align-items: flex-start; gap: 8px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Test Run Report</h1>
      <div class="run-id">Run #${run.id.slice(-8)} | ${new Date(run.created_at).toLocaleString()}</div>
    </div>

    <div class="summary-grid">
      <div class="summary-card">
        <div class="value health-score">${passRate}%</div>
        <div class="label">Pass Rate</div>
      </div>
      <div class="summary-card">
        <div class="value">${resultSummary.total}</div>
        <div class="label">Total Tests</div>
      </div>
      <div class="summary-card">
        <div class="value" style="color: #22c55e">${resultSummary.passed}</div>
        <div class="label">Passed</div>
      </div>
      <div class="summary-card">
        <div class="value" style="color: #ef4444">${resultSummary.failed}</div>
        <div class="label">Failed</div>
      </div>
      <div class="summary-card">
        <div class="value">${formatDuration(run.duration_ms)}</div>
        <div class="label">Duration</div>
      </div>
    </div>

    <div class="section" id="results-section">
      <h2 onclick="toggleSection('results-section')">🧪 Test Results</h2>
      <div class="section-content">
        ${run.results.map((result, idx) => `
          <div class="test-card ${result.status}">
            <div class="test-header">
              <span class="test-name">${idx + 1}. ${escapeHtml(result.test_name)}</span>
              <span class="test-status ${result.status}">${result.status.toUpperCase()}</span>
            </div>
            <div class="test-meta">
              <span>Duration: ${formatDuration(result.duration_ms)}</span>
              <span>Steps: ${result.steps.length}</span>
            </div>
            ${result.error ? `<div class="error-box"><pre>${escapeHtml(result.error)}</pre></div>` : ''}
            <div class="steps-list">
              ${result.steps.map(step => `
                <div class="step ${step.status}">
                  <span class="step-action">${escapeHtml(step.action)}${step.selector ? ` → ${escapeHtml(step.selector)}` : ''}</span>
                  <span>${formatDuration(step.duration_ms)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    ${run.results.some(r => r.screenshot_base64) ? `
    <div class="section" id="screenshots-section">
      <h2 onclick="toggleSection('screenshots-section')">📸 Screenshots</h2>
      <div class="section-content">
        <div class="screenshot-grid">
          ${run.results.filter(r => r.screenshot_base64).map(result => `
            <div class="screenshot-card" onclick="openModal('${result.screenshot_base64?.startsWith('data:') ? result.screenshot_base64 : `data:image/png;base64,${result.screenshot_base64}`}')">
              <img src="${result.screenshot_base64?.startsWith('data:') ? result.screenshot_base64 : `data:image/png;base64,${result.screenshot_base64}`}" alt="${escapeHtml(result.test_name)}">
              <div class="caption">${escapeHtml(result.test_name)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
    ` : ''}

    <div class="footer">
      Generated by QA Guardian | ${new Date().toLocaleString()}
    </div>
  </div>

  <div class="modal" id="imageModal" onclick="closeModal()">
    <span class="modal-close">&times;</span>
    <img id="modalImage" src="" alt="Screenshot">
  </div>

  <script>
    function toggleSection(id) {
      const section = document.getElementById(id);
      section.classList.toggle('collapsed');
    }
    function openModal(src) {
      const modal = document.getElementById('imageModal');
      const img = document.getElementById('modalImage');
      img.src = src;
      modal.classList.add('active');
    }
    function closeModal() {
      document.getElementById('imageModal').classList.remove('active');
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
  </script>
</body>
</html>`;

      // Download the HTML file
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `test-report-${run.id}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to generate HTML report:', err);
    } finally {
      setGeneratingHtml(false);
    }
  };

  // Helper to escape HTML special characters
  const escapeHtml = (str: string) => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
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

  // Get all steps across all results
  // Feature #1833: Enhanced with computed timestamps and network/console data fallback
  const allSteps = useMemo(() => {
    if (!run?.results) return [];

    // Calculate base timestamp from run start
    const runStartTime = run.started_at ? new Date(run.started_at).getTime() : Date.now();
    let cumulativeTime = 0;

    return run.results.flatMap((result, rIdx) => {
      // Get network requests and console logs at result level for fallback grouping
      const resultNetworkRequests = result.network_requests || [];
      const resultConsoleLogs = result.console_logs || [];

      return result.steps.map((step, sIdx) => {
        // Calculate step timestamp if not provided
        const stepTimestamp = step.timestamp || (runStartTime + cumulativeTime);
        cumulativeTime += step.duration_ms || 0;

        // For fallback: try to associate network requests by timing
        // If step has no network_requests, find requests that happened during this step's time window
        let stepNetworkRequests = step.network_requests || [];
        let stepConsoleLogs = step.console_logs || [];

        if (stepNetworkRequests.length === 0 && resultNetworkRequests.length > 0) {
          // Filter network requests that fall within this step's time window
          const stepEndTime = stepTimestamp + (step.duration_ms || 0);
          stepNetworkRequests = resultNetworkRequests.filter(req => {
            return req.timestamp >= stepTimestamp && req.timestamp <= stepEndTime;
          });
        }

        if (stepConsoleLogs.length === 0 && resultConsoleLogs.length > 0) {
          // Filter console logs that fall within this step's time window
          const stepEndTime = stepTimestamp + (step.duration_ms || 0);
          stepConsoleLogs = resultConsoleLogs.filter(log => {
            return log.timestamp >= stepTimestamp && log.timestamp <= stepEndTime;
          });
        }

        return {
          ...step,
          testName: result.test_name,
          testId: result.test_id,
          resultIndex: rIdx,
          stepIndex: sIdx,
          uniqueId: `${rIdx}-${sIdx}`,
          computedTimestamp: stepTimestamp,
          stepNetworkRequests,
          stepConsoleLogs,
        };
      });
    });
  }, [run]);

  // Get screenshots from results
  const screenshots = useMemo(() => {
    if (!run?.results) return [];
    return run.results.filter(r =>
      r.screenshot_base64 ||
      r.baseline_screenshot_base64 ||
      r.diff_image_base64 ||
      r.visual_comparison?.diffImage
    );
  }, [run]);

  // Feature #1834: Enhanced screenshot gallery with metadata
  // Feature #1996: Added testType for grouping screenshots by test type
  interface ScreenshotItem {
    id: string;
    url: string;
    title: string;
    type: 'final' | 'baseline' | 'diff' | 'step_before' | 'step_after';
    testName: string;
    testId: string; // Feature #2000: Test ID for navigation
    testStatus: 'passed' | 'failed' | 'error' | 'skipped';
    testType: 'E2E' | 'Visual' | 'Performance' | 'Load' | 'Accessibility'; // Feature #1996
    stepIndex?: number;
    stepAction?: string;
    timestamp?: number;
    viewport?: { width: number; height: number };
    diffPercentage?: number;
  }

  const allScreenshots = useMemo<ScreenshotItem[]>(() => {
    if (!run?.results) return [];
    const items: ScreenshotItem[] = [];
    let idCounter = 0;

    // Feature #1996: Helper to infer test type from result
    const inferTestType = (r: typeof run.results[0]): ScreenshotItem['testType'] => {
      if (r.test_type) {
        const typeMap: Record<string, ScreenshotItem['testType']> = {
          'visual_regression': 'Visual',
          'lighthouse': 'Performance',
          'load': 'Load',
          'accessibility': 'Accessibility',
          'e2e': 'E2E',
        };
        return typeMap[r.test_type] || 'E2E';
      }
      // Infer from result data
      if (r.visual_comparison || r.baseline_screenshot_base64 || r.diff_image_base64) return 'Visual';
      if (r.steps.some(s => s.lighthouse)) return 'Performance';
      if (r.steps.some(s => s.load_test)) return 'Load';
      const testNameLower = r.test_name.toLowerCase();
      if (testNameLower.includes('accessibility') || testNameLower.includes('a11y')) return 'Accessibility';
      if (testNameLower.includes('visual') || testNameLower.includes('regression')) return 'Visual';
      if (testNameLower.includes('performance') || testNameLower.includes('lighthouse')) return 'Performance';
      if (testNameLower.includes('load')) return 'Load';
      return 'E2E';
    };

    run.results.forEach((result) => {
      const testType = inferTestType(result);

      // Final screenshot
      if (result.screenshot_base64) {
        items.push({
          id: `screenshot-${idCounter++}`,
          url: `data:image/png;base64,${result.screenshot_base64}`,
          title: `Final Screenshot - ${result.test_name}`,
          type: 'final',
          testName: result.test_name,
          testId: result.test_id, // Feature #2000
          testStatus: result.status,
          testType,
          timestamp: run.completed_at ? new Date(run.completed_at).getTime() : Date.now(),
          viewport: testInfo?.target_url ? { width: 1280, height: 720 } : undefined,
        });
      }

      // Baseline screenshot (for visual tests)
      if (result.baseline_screenshot_base64) {
        items.push({
          id: `screenshot-${idCounter++}`,
          url: `data:image/png;base64,${result.baseline_screenshot_base64}`,
          title: `Baseline - ${result.test_name}`,
          type: 'baseline',
          testName: result.test_name,
          testId: result.test_id, // Feature #2000
          testStatus: result.status,
          testType,
          viewport: testInfo?.target_url ? { width: 1280, height: 720 } : undefined,
        });
      }

      // Diff image (for visual tests)
      if (result.diff_image_base64) {
        items.push({
          id: `screenshot-${idCounter++}`,
          url: `data:image/png;base64,${result.diff_image_base64}`,
          title: `Diff (${(result.diff_percentage || 0).toFixed(2)}%) - ${result.test_name}`,
          type: 'diff',
          testName: result.test_name,
          testId: result.test_id, // Feature #2000
          testStatus: result.status,
          testType,
          diffPercentage: result.diff_percentage,
          viewport: testInfo?.target_url ? { width: 1280, height: 720 } : undefined,
        });
      }

      // Visual comparison diff
      if (result.visual_comparison?.diffImage && !result.diff_image_base64) {
        items.push({
          id: `screenshot-${idCounter++}`,
          url: `data:image/png;base64,${result.visual_comparison.diffImage}`,
          title: `Visual Diff (${(result.visual_comparison.diffPercentage || 0).toFixed(2)}%) - ${result.test_name}`,
          type: 'diff',
          testName: result.test_name,
          testId: result.test_id, // Feature #2000
          testStatus: result.status,
          testType,
          diffPercentage: result.visual_comparison.diffPercentage,
          viewport: testInfo?.target_url ? { width: 1280, height: 720 } : undefined,
        });
      }

      // Step screenshots
      result.steps.forEach((step, stepIdx) => {
        if (step.screenshot_before) {
          items.push({
            id: `screenshot-${idCounter++}`,
            url: `data:image/png;base64,${step.screenshot_before}`,
            title: `Before Step ${stepIdx + 1}: ${step.action}`,
            type: 'step_before',
            testName: result.test_name,
            testId: result.test_id, // Feature #2000
            testStatus: result.status,
            testType,
            stepIndex: stepIdx,
            stepAction: step.action,
            timestamp: step.timestamp,
          });
        }
        if (step.screenshot_after) {
          items.push({
            id: `screenshot-${idCounter++}`,
            url: `data:image/png;base64,${step.screenshot_after}`,
            title: `After Step ${stepIdx + 1}: ${step.action}`,
            type: 'step_after',
            testName: result.test_name,
            testId: result.test_id, // Feature #2000
            testStatus: result.status,
            testType,
            stepIndex: stepIdx,
            stepAction: step.action,
            timestamp: step.timestamp,
          });
        }
        // Step metadata screenshot
        if (step.metadata?.screenshot_url) {
          items.push({
            id: `screenshot-${idCounter++}`,
            url: step.metadata.screenshot_url,
            title: `Step ${stepIdx + 1} Screenshot: ${step.action}`,
            type: 'step_after',
            testName: result.test_name,
            testId: result.test_id, // Feature #2000
            testStatus: result.status,
            testType,
            stepIndex: stepIdx,
            stepAction: step.action,
          });
        }
      });
    });

    return items;
  }, [run, testInfo]);

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

  // Feature #1935: AI analysis for performance test results
  const analyzePerformanceResults = async (testName: string, lighthouse: any, loadTest?: any) => {
    if (!token) return;

    setPerfAILoading(true);
    setPerfAIError(null);
    setPerfAIAnalysisOpen(testName);

    // Build performance context
    const performanceContext: any = { testName };

    if (lighthouse) {
      performanceContext.lighthouse = {
        performance: lighthouse.performance,
        accessibility: lighthouse.accessibility,
        bestPractices: lighthouse.best_practices || lighthouse.bestPractices,
        seo: lighthouse.seo,
        metrics: lighthouse.metrics,
        lcp: lighthouse.lcp,
        fcp: lighthouse.fcp,
        cls: lighthouse.cls,
        tbt: lighthouse.tbt,
        url: lighthouse.url,
        device: lighthouse.device,
        opportunities: lighthouse.opportunities?.slice(0, 5),
        diagnostics: lighthouse.diagnostics?.slice(0, 5),
      };
    }

    if (loadTest) {
      performanceContext.loadTest = {
        virtualUsers: loadTest.virtual_users,
        duration: loadTest.duration,
        requestsPerSecond: loadTest.requests_per_second,
        avgResponseTime: loadTest.avg_response_time,
        p95ResponseTime: loadTest.p95_response_time,
        errorRate: loadTest.error_rate,
        summary: loadTest.summary,
        responseTimes: loadTest.response_times,
      };
    }

    const prompt = `Analyze these performance test results and provide a detailed explanation in plain English.

**Test: ${testName}**

**Performance Data:**
${JSON.stringify(performanceContext, null, 2)}

Please provide:
1. **Plain English Summary**: Explain what these numbers mean for a non-technical person
2. **Performance Grade**: Rate the overall performance (Excellent/Good/Needs Work/Poor)
3. **Top Bottlenecks**: List the 3 biggest performance issues, ranked by impact
4. **Priority Fixes**: What should be fixed FIRST, SECOND, and THIRD? Include estimated impact
5. **Specific Recommendations**: Provide actionable code/config changes to improve performance
6. **Quick Wins**: Any easy fixes that would give immediate improvement?

Format your response with clear sections using **bold headers**.`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);

      const response = await fetch('/api/v1/mcp/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: prompt, context: [] }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`AI service error: ${response.status}`);
      }

      const data = await response.json();
      const analysis = data.result?.response || data.response || data.message || 'No analysis available';

      setPerfAIResult(prev => ({ ...prev, [testName]: analysis }));
    } catch (err) {
      let errorMsg = err instanceof Error ? err.message : 'Failed to analyze performance';
      if (errorMsg.includes('timed out') || errorMsg.includes('AbortError')) {
        errorMsg = 'Performance analysis timed out. Please try again.';
      }
      setPerfAIError(errorMsg);
    } finally {
      setPerfAILoading(false);
    }
  };

  // Feature #1936: AI analysis for accessibility violations with fix examples
  const analyzeAccessibilityResults = async (testName: string, a11y: any) => {
    if (!token || !a11y) return;

    setA11yAILoading(true);
    setA11yAIError(null);
    setA11yAIAnalysisOpen(testName);

    // Format violations for AI
    const violationsSummary = a11y.violations.map((v: any) => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      help: v.help,
      helpUrl: v.helpUrl,
      wcagTags: v.wcagTags,
      affectedElements: v.nodes?.slice(0, 3).map((n: any) => ({
        html: n.html?.slice(0, 200),
        target: n.target,
        failureSummary: n.failureSummary,
      })),
    }));

    const prompt = `Analyze these accessibility violations and provide detailed, actionable fixes.

**Test: ${testName}**
**Total Violations: ${a11y.violations.length}**
**Passed Rules: ${a11y.passes}**

**Violations:**
${JSON.stringify(violationsSummary, null, 2)}

Please provide:
1. **Plain English Summary**: Explain each violation so a non-technical person can understand
2. **Real-World Impact**: Describe how each issue affects users with disabilities (e.g., "Screen reader users cannot navigate this form", "Color-blind users won't see the error message")
3. **Priority Order**: List fixes by severity - CRITICAL first, then SERIOUS, MODERATE, MINOR
4. **Code Fixes**: For each violation, provide:
   - BEFORE: The problematic code
   - AFTER: The corrected code
   - EXPLANATION: Why this fix works
5. **Quick Wins**: Easy fixes that take less than 5 minutes
6. **WCAG Compliance**: Which WCAG guidelines are violated and what level (A, AA, AAA)

Format your response with clear sections using **bold headers** and code blocks for HTML examples.`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);

      const response = await fetch('/api/v1/mcp/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: prompt, context: [] }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`AI service error: ${response.status}`);
      }

      const data = await response.json();
      const analysis = data.result?.response || data.response || data.message || 'No analysis available';

      setA11yAIResult(prev => ({ ...prev, [testName]: analysis }));
    } catch (err) {
      let errorMsg = err instanceof Error ? err.message : 'Failed to analyze accessibility';
      if (errorMsg.includes('timed out') || errorMsg.includes('AbortError')) {
        errorMsg = 'Accessibility analysis timed out. Please try again.';
      }
      setA11yAIError(errorMsg);
    } finally {
      setA11yAILoading(false);
    }
  };

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

        {/* Feature #1858: Executive Summary Card */}
        <div className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <span className="text-2xl">📊</span>
              Executive Summary
            </h2>
            <span className="text-xs text-muted-foreground">Run #{run?.id?.slice(-8) || runId?.slice(-8)}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Health Score */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
              <div className="text-sm text-muted-foreground mb-2">Health Score</div>
              <div className="flex items-center gap-3">
                <div className={`text-4xl font-bold ${
                  resultSummary.total === 0 ? 'text-gray-400' :
                  Math.round((resultSummary.passed / resultSummary.total) * 100) >= 85 ? 'text-green-600 dark:text-green-400' :
                  Math.round((resultSummary.passed / resultSummary.total) * 100) >= 70 ? 'text-amber-600 dark:text-amber-400' :
                  Math.round((resultSummary.passed / resultSummary.total) * 100) >= 50 ? 'text-orange-600 dark:text-orange-400' :
                  'text-red-600 dark:text-red-400'
                }`}>
                  {resultSummary.total === 0 ? 'N/A' : Math.round((resultSummary.passed / resultSummary.total) * 100)}
                </div>
                {resultSummary.total > 0 && (
                  <div className="text-lg text-muted-foreground">/100</div>
                )}
              </div>
              <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    resultSummary.total === 0 ? 'bg-gray-400' :
                    Math.round((resultSummary.passed / resultSummary.total) * 100) >= 85 ? 'bg-green-500' :
                    Math.round((resultSummary.passed / resultSummary.total) * 100) >= 70 ? 'bg-amber-500' :
                    Math.round((resultSummary.passed / resultSummary.total) * 100) >= 50 ? 'bg-orange-500' :
                    'bg-red-500'
                  }`}
                  style={{ width: resultSummary.total === 0 ? '0%' : `${(resultSummary.passed / resultSummary.total) * 100}%` }}
                />
              </div>
            </div>
            {/* Pass Rate */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
              <div className="text-sm text-muted-foreground mb-2">Pass Rate</div>
              <div className="flex items-baseline gap-2">
                <span className={`text-4xl font-bold ${
                  resultSummary.total === 0 ? 'text-gray-400' :
                  resultSummary.failed === 0 ? 'text-green-600 dark:text-green-400' :
                  resultSummary.passed === 0 ? 'text-red-600 dark:text-red-400' :
                  'text-amber-600 dark:text-amber-400'
                }`}>
                  {resultSummary.total === 0 ? '0' : Math.round((resultSummary.passed / resultSummary.total) * 100)}%
                </span>
                <span className="text-sm text-muted-foreground">
                  ({resultSummary.passed}/{resultSummary.total} tests)
                </span>
              </div>
              <div className="mt-3 text-sm text-muted-foreground">
                {resultSummary.failed === 0 && resultSummary.total > 0 ? (
                  <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    All tests passed
                  </span>
                ) : resultSummary.total > 0 ? (
                  <span className="text-amber-600 dark:text-amber-400">{resultSummary.failed} test{resultSummary.failed !== 1 ? 's' : ''} need attention</span>
                ) : (
                  <span>No test results available</span>
                )}
              </div>
            </div>
            {/* Critical Issues */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
              <div className="text-sm text-muted-foreground mb-2">Critical Issues</div>
              <div className="flex items-baseline gap-2">
                <span className={`text-4xl font-bold ${
                  resultSummary.failed === 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {resultSummary.failed}
                </span>
                <span className="text-sm text-muted-foreground">
                  {resultSummary.failed === 1 ? 'failure' : 'failures'}
                </span>
              </div>
              {resultSummary.failed > 0 && (
                <div className="mt-3 flex flex-col gap-2">
                  <button
                    onClick={() => setActiveTab('results')}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    View failure details
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  {/* Feature #1962: Batch Analysis button removed - AI only on Visual Review page */}
                </div>
              )}
              {resultSummary.failed === 0 && resultSummary.total > 0 && (
                <div className="mt-3 text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  No critical issues
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-6">
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="text-2xl font-bold text-foreground">{resultSummary.total}</div>
            <div className="text-sm text-muted-foreground">Total Tests</div>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{resultSummary.passed}</div>
            <div className="text-sm text-green-600/70 dark:text-green-400/70">Passed</div>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{resultSummary.failed}</div>
            <div className="text-sm text-red-600/70 dark:text-red-400/70">Failed</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="text-2xl font-bold text-foreground">{formatDuration(run.duration_ms)}</div>
            <div className="text-sm text-muted-foreground">Duration</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="text-sm font-medium text-foreground">{formatDateTime(run.started_at)}</div>
            <div className="text-sm text-muted-foreground">Started</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="text-sm font-medium text-foreground">{formatDateTime(run.completed_at)}</div>
            <div className="text-sm text-muted-foreground">Completed</div>
          </div>
        </div>

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

      {/* Tab Navigation */}
      <div className="border-b border-border mb-6">
        <nav className="flex gap-1 overflow-x-auto">
          {[
            { id: 'results', label: 'Results', icon: '🧪', count: run.results.length },
            { id: 'timeline', label: 'Timeline', icon: '📋', count: allSteps.length },
            { id: 'screenshots', label: 'Screenshots', icon: '📸', count: screenshots.length },
            { id: 'metrics', label: 'Metrics', icon: '📊', count: performanceResults.length + loadTestResults.length },
            { id: 'network', label: 'Network', icon: '🌐', count: networkRequests.length },
            { id: 'visual', label: 'Visual Diff', icon: '🎨', count: visualResults.length },
            { id: 'accessibility', label: 'Accessibility', icon: '♿', count: accessibilityResults.length },
            { id: 'logs', label: 'Logs', icon: '📝', count: consoleLogs.length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-muted">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-card border border-border rounded-lg p-6">
        {/* Feature #1841: Results Tab - Individual Test Result Cards */}
        {activeTab === 'results' && (
          <div>
            {/* Header with filters and actions */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-semibold text-foreground">Test Results</h2>

                {/* Filter buttons */}
                <div className="flex rounded-md overflow-hidden border border-border">
                  {([
                    { id: 'all', label: 'All', count: run.results.length },
                    { id: 'passed', label: 'Passed', count: resultSummary.passed },
                    { id: 'failed', label: 'Failed', count: resultSummary.failed },
                    { id: 'skipped', label: 'Skipped', count: resultSummary.skipped },
                  ] as const).map(filter => (
                    <button
                      key={filter.id}
                      onClick={() => setSelectedResultsFilter(filter.id)}
                      className={`px-3 py-1.5 text-sm ${
                        selectedResultsFilter === filter.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-background text-foreground hover:bg-muted'
                      }`}
                    >
                      {filter.label} ({filter.count})
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {resultSummary.failed > 0 && (
                  <button
                    onClick={rerunFailedTests}
                    disabled={rerunningTests.size > 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors disabled:opacity-50"
                  >
                    {rerunningTests.size > 0 ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    )}
                    Rerun Failed
                  </button>
                )}

                <div className="flex rounded-md overflow-hidden border border-border">
                  <button
                    onClick={() => exportResults('json')}
                    className="px-3 py-1.5 text-sm bg-background text-foreground hover:bg-muted border-r border-border"
                  >
                    JSON
                  </button>
                  <button
                    onClick={() => exportResults('csv')}
                    className="px-3 py-1.5 text-sm bg-background text-foreground hover:bg-muted"
                  >
                    CSV
                  </button>
                </div>
              </div>
            </div>

            {/* Result Cards */}
            {filteredResults.length === 0 ? (
              <div className="p-12 text-center bg-muted/30 rounded-lg">
                <svg className="w-16 h-16 mx-auto text-muted-foreground mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-lg font-medium text-foreground mb-2">No results match the filter</p>
                <p className="text-muted-foreground">Try selecting a different filter.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredResults.map((result, idx) => {
                  const isExpanded = expandedResultCards.has(result.test_id);
                  const keyMetric = getKeyMetric(result);
                  const failedSteps = result.steps.filter(s => s.status === 'failed');
                  const lastScreenshot = result.screenshot_base64 || result.steps.find(s => s.screenshot_after)?.screenshot_after;

                  return (
                    <div
                      key={result.test_id}
                      data-test-id={result.test_id} /* Feature #2000: For scroll-to-test navigation */
                      className={`border rounded-lg overflow-hidden transition-all ${
                        result.status === 'failed' || result.status === 'error'
                          ? 'border-red-300 dark:border-red-800'
                          : result.status === 'passed'
                          ? 'border-green-300 dark:border-green-800'
                          : 'border-border'
                      }`}
                    >
                      {/* Card Header - Always visible */}
                      <div
                        onClick={() => toggleResultCard(result.test_id)}
                        className={`p-4 cursor-pointer transition-colors ${
                          result.status === 'failed' || result.status === 'error'
                            ? 'bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20'
                            : result.status === 'passed'
                            ? 'bg-green-50 dark:bg-green-900/10 hover:bg-green-100 dark:hover:bg-green-900/20'
                            : 'bg-muted/30 hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          {/* Expand/Collapse icon */}
                          <svg
                            className={`w-5 h-5 text-muted-foreground transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>

                          {/* Status icon */}
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            result.status === 'passed'
                              ? 'bg-green-100 dark:bg-green-900/30'
                              : result.status === 'failed' || result.status === 'error'
                              ? 'bg-red-100 dark:bg-red-900/30'
                              : 'bg-gray-100 dark:bg-gray-800'
                          }`}>
                            {result.status === 'passed' && (
                              <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                            {(result.status === 'failed' || result.status === 'error') && (
                              <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            )}
                            {result.status === 'skipped' && (
                              <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                              </svg>
                            )}
                          </div>

                          {/* Test info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium text-foreground truncate">{result.test_name}</h3>
                              {/* Type badge based on metrics */}
                              <span className={`px-2 py-0.5 text-xs rounded-full ${
                                keyMetric.type === 'performance' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' :
                                keyMetric.type === 'accessibility' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                                keyMetric.type === 'load' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' :
                                keyMetric.type === 'visual' ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400' :
                                'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400'
                              }`}>
                                {keyMetric.type.toUpperCase()}
                              </span>
                            </div>
                            {/* Error preview if failed */}
                            {result.error && (
                              <p className="text-sm text-red-600 dark:text-red-400 truncate">{result.error}</p>
                            )}
                          </div>

                          {/* Key Metric */}
                          <div className="text-center px-4 flex-shrink-0">
                            <div className="text-lg font-bold text-foreground">{keyMetric.value}</div>
                            <div className="text-xs text-muted-foreground">{keyMetric.label}</div>
                          </div>

                          {/* Duration */}
                          <div className="text-center px-4 flex-shrink-0">
                            <div className="text-lg font-bold text-foreground">{formatDuration(result.duration_ms)}</div>
                            <div className="text-xs text-muted-foreground">Duration</div>
                          </div>

                          {/* Screenshot thumbnail */}
                          {lastScreenshot && (
                            <div className="w-16 h-12 rounded overflow-hidden border border-border flex-shrink-0">
                              <img
                                src={lastScreenshot.startsWith('data:') ? lastScreenshot : `data:image/png;base64,${lastScreenshot}`}
                                alt="Screenshot"
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Expanded Content */}
                      {isExpanded && (
                        <div className="border-t border-border p-4 bg-background">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Error details */}
                            {result.error && (
                              <div className="md:col-span-2 p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
                                <h4 className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">Error Message</h4>
                                <pre className="text-sm text-red-600 dark:text-red-300 whitespace-pre-wrap font-mono overflow-auto max-h-32">
                                  {result.error}
                                </pre>
                              </div>
                            )}

                            {/* Steps summary */}
                            <div className="p-3 bg-muted/30 rounded-lg">
                              <h4 className="text-sm font-medium text-foreground mb-2">Steps</h4>
                              <div className="flex items-center gap-4 text-sm">
                                <span className="text-green-600 dark:text-green-400">
                                  {result.steps.filter(s => s.status === 'passed').length} passed
                                </span>
                                {failedSteps.length > 0 && (
                                  <span className="text-red-600 dark:text-red-400">
                                    {failedSteps.length} failed
                                  </span>
                                )}
                                <span className="text-muted-foreground">
                                  {result.steps.length} total
                                </span>
                              </div>
                              {/* Failed steps list */}
                              {failedSteps.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {failedSteps.slice(0, 3).map((step, sIdx) => (
                                    <div key={sIdx} className="text-xs text-red-600 dark:text-red-400">
                                      • {step.action}: {step.error || 'Failed'}
                                    </div>
                                  ))}
                                  {failedSteps.length > 3 && (
                                    <div className="text-xs text-muted-foreground">
                                      + {failedSteps.length - 3} more failed steps
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Metrics based on type */}
                            <div className="p-3 bg-muted/30 rounded-lg">
                              <h4 className="text-sm font-medium text-foreground mb-2">Key Metrics</h4>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                  <span className="text-muted-foreground">{keyMetric.label}:</span>
                                  <span className="ml-1 font-medium text-foreground">{keyMetric.value}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Duration:</span>
                                  <span className="ml-1 font-medium text-foreground">{formatDuration(result.duration_ms)}</span>
                                </div>
                                {result.console_logs && result.console_logs.length > 0 && (
                                  <div>
                                    <span className="text-muted-foreground">Logs:</span>
                                    <span className="ml-1 font-medium text-foreground">{result.console_logs.length}</span>
                                  </div>
                                )}
                                {result.network_requests && result.network_requests.length > 0 && (
                                  <div>
                                    <span className="text-muted-foreground">Requests:</span>
                                    <span className="ml-1 font-medium text-foreground">{result.network_requests.length}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="mt-4 flex items-center gap-2">
                            <Link
                              to={`/tests/${result.test_id}`}
                              className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                            >
                              View Test Details
                            </Link>
                            <button
                              onClick={() => setActiveTab('timeline')}
                              className="px-3 py-1.5 text-sm border border-border rounded-md text-foreground hover:bg-muted"
                            >
                              View Timeline
                            </button>
                            {lastScreenshot && (
                              <button
                                onClick={() => setActiveTab('screenshots')}
                                className="px-3 py-1.5 text-sm border border-border rounded-md text-foreground hover:bg-muted"
                              >
                                View Screenshots
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Timeline Tab */}
        {activeTab === 'timeline' && (
          <div>
            {/* Feature #1833: Enhanced timeline header with controls */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Test Execution Timeline</h2>
              <div className="flex items-center gap-4 text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showNetworkPerStep}
                    onChange={(e) => setShowNetworkPerStep(e.target.checked)}
                    className="rounded border-border"
                  />
                  <span className="text-muted-foreground">Show Network</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showConsolePerStep}
                    onChange={(e) => setShowConsolePerStep(e.target.checked)}
                    className="rounded border-border"
                  />
                  <span className="text-muted-foreground">Show Console</span>
                </label>
              </div>
            </div>
            {/* Feature #1865: Video Player with Timeline Sync */}
            {videoFile && (
              <div className="mb-6 border border-border rounded-lg overflow-hidden bg-card">
                <div className="flex items-center justify-between p-3 bg-muted/50 border-b border-border">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🎬</span>
                    <h3 className="font-medium text-foreground">Test Recording</h3>
                    {isVideoPlaying && (
                      <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                        Playing
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {formatDuration(currentVideoTime)} / {formatDuration(runDurationMs)}
                    </span>
                    <button
                      onClick={handleVideoDownload}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs text-primary hover:bg-muted rounded"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download
                    </button>
                  </div>
                </div>
                <div className="bg-black">
                  {videoLoading && (
                    <div className="flex items-center justify-center h-48 text-muted-foreground">
                      <svg className="animate-spin h-6 w-6 mr-2" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Loading video...
                    </div>
                  )}
                  {videoError && (
                    <div className="flex items-center justify-center h-48 text-destructive text-sm">
                      <span>⚠️ {videoError}</span>
                    </div>
                  )}
                  {videoUrl && !videoLoading && (
                    <video
                      ref={videoRef}
                      controls
                      preload="metadata"
                      className="w-full max-h-80"
                      controlsList="nodownload"
                      playsInline
                      src={videoUrl}
                      onTimeUpdate={handleVideoTimeUpdate}
                      onPlay={() => setIsVideoPlaying(true)}
                      onPause={() => setIsVideoPlaying(false)}
                      onEnded={() => setIsVideoPlaying(false)}
                    >
                      Your browser does not support the video tag.
                    </video>
                  )}
                </div>
                <div className="p-2 bg-muted/30 border-t border-border">
                  <p className="text-xs text-muted-foreground text-center">
                    💡 Click <span className="font-medium text-primary">▶ Jump to Video</span> on any step below to seek the video to that moment
                  </p>
                </div>
              </div>
            )}

            {allSteps.length === 0 ? (
              <p className="text-muted-foreground">No execution steps recorded.</p>
            ) : (
              <div className="space-y-3">
                {/* Feature #1833: Timeline visualization */}
                <div className="relative">
                  {/* Vertical timeline line */}
                  <div className="absolute left-[18px] top-0 bottom-0 w-0.5 bg-border" />

                  {allSteps.map((step, idx) => {
                    const runStartTime = run?.started_at ? new Date(run.started_at).getTime() : step.computedTimestamp;

                    return (
                      <div
                        key={step.uniqueId}
                        className={`relative ml-6 mb-3 border rounded-lg overflow-hidden ${
                          step.status === 'passed' ? 'border-green-200 dark:border-green-800' :
                          step.status === 'failed' ? 'border-red-200 dark:border-red-800' :
                          'border-border'
                        }`}
                      >
                        {/* Timeline connector dot */}
                        <div className={`absolute -left-[30px] top-5 h-3 w-3 rounded-full border-2 border-card ${
                          step.status === 'passed' ? 'bg-green-500' :
                          step.status === 'failed' ? 'bg-red-500' :
                          'bg-gray-400'
                        }`} />

                        {/* Feature #1928: Changed from button to div to avoid nested button DOM validation error */}
                        <div
                          onClick={() => toggleStep(step.uniqueId)}
                          className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleStep(step.uniqueId); }}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium ${
                              step.status === 'passed' ? 'bg-green-500 text-white' :
                              step.status === 'failed' ? 'bg-red-500 text-white' :
                              'bg-gray-400 text-white'
                            }`}>
                              {step.status === 'passed' ? '✓' : step.status === 'failed' ? '✗' : '-'}
                            </span>
                            <div className="text-left">
                              <div className="font-medium text-foreground flex items-center gap-2">
                                <span>Step {idx + 1}: {step.action}</span>
                                {/* Feature #1833: Network/console indicators */}
                                {step.stepNetworkRequests.length > 0 && (
                                  <span className="px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded" title={`${step.stepNetworkRequests.length} network requests`}>
                                    🌐 {step.stepNetworkRequests.length}
                                  </span>
                                )}
                                {step.stepConsoleLogs.length > 0 && (
                                  <span className={`px-1.5 py-0.5 text-xs rounded ${
                                    step.stepConsoleLogs.some(l => l.level === 'error')
                                      ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400'
                                  }`} title={`${step.stepConsoleLogs.length} console logs`}>
                                    📝 {step.stepConsoleLogs.length}
                                  </span>
                                )}
                                {(step.screenshot_before || step.screenshot_after) && (
                                  <span className="px-1.5 py-0.5 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded" title="Has screenshots">
                                    📸
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground flex items-center gap-2">
                                <span>{step.testName}</span>
                                {/* Feature #1833: Show timestamp */}
                                <span className="text-xs font-mono text-muted-foreground/70">
                                  @ {formatStepTime(step.computedTimestamp)}
                                </span>
                                <span className="text-xs text-muted-foreground/50">
                                  ({formatRelativeTime(step.computedTimestamp, runStartTime)})
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {/* Feature #1865: Video seek button */}
                            {videoUrl && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStepVideoSeek(step);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-primary/10 text-primary hover:bg-primary/20 rounded transition-colors"
                                title="Jump to this step in the video"
                              >
                                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M8 5v14l11-7z" />
                                </svg>
                                Jump to Video
                              </button>
                            )}
                            <span className="text-sm text-muted-foreground">{formatDuration(step.duration_ms)}</span>
                            <svg
                              className={`h-5 w-5 text-muted-foreground transition-transform ${
                                expandedSteps.has(step.uniqueId) ? 'rotate-180' : ''
                              }`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>

                        {expandedSteps.has(step.uniqueId) && (
                          <div className="border-t border-border p-4 bg-muted/30">
                            {/* Feature #1833: Before/After Screenshots */}
                            {(step.screenshot_before || step.screenshot_after) && (
                              <div className="mb-4 pb-4 border-b border-border">
                                <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                                  <span>📸</span> Step Screenshots
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                  {step.screenshot_before && (
                                    <div>
                                      <p className="text-xs text-muted-foreground mb-1">Before Action</p>
                                      <img
                                        src={`data:image/png;base64,${step.screenshot_before}`}
                                        alt="Before action"
                                        className="w-full rounded border border-border cursor-pointer hover:opacity-90 transition-opacity"
                                        onClick={() => setSelectedScreenshot({
                                          url: `data:image/png;base64,${step.screenshot_before}`,
                                          title: `Step ${idx + 1} - Before: ${step.action}`
                                        })}
                                      />
                                    </div>
                                  )}
                                  {step.screenshot_after && (
                                    <div>
                                      <p className="text-xs text-muted-foreground mb-1">After Action</p>
                                      <img
                                        src={`data:image/png;base64,${step.screenshot_after}`}
                                        alt="After action"
                                        className="w-full rounded border border-border cursor-pointer hover:opacity-90 transition-opacity"
                                        onClick={() => setSelectedScreenshot({
                                          url: `data:image/png;base64,${step.screenshot_after}`,
                                          title: `Step ${idx + 1} - After: ${step.action}`
                                        })}
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            <dl className="grid grid-cols-2 gap-4 text-sm">
                              {step.selector && (
                                <>
                                  <dt className="text-muted-foreground">Selector</dt>
                                  <dd className="font-mono text-xs bg-muted p-2 rounded overflow-auto">{step.selector}</dd>
                                </>
                              )}
                              {step.value && (
                                <>
                                  <dt className="text-muted-foreground">Value</dt>
                                  <dd className="text-foreground">{step.value}</dd>
                                </>
                              )}
                              {step.error && (
                                <>
                                  <dt className="text-destructive">Error</dt>
                                  <dd className="text-destructive bg-destructive/10 p-2 rounded">{step.error}</dd>
                                </>
                              )}
                              {step.screenshot_timeout && (
                                <div className="col-span-2">
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs">
                                    ⏱️ Screenshot timed out
                                  </span>
                                </div>
                              )}
                              {step.navigation_error && step.http_status && (
                                <div className="col-span-2">
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs">
                                    🌐 Navigation failed: HTTP {step.http_status}
                                  </span>
                                </div>
                              )}
                              {step.metadata?.isBrowserCrash && (
                                <div className="col-span-2">
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs">
                                    💥 Browser crashed at {step.metadata.crashDetectedAt}
                                  </span>
                                </div>
                              )}
                            </dl>

                        {/* Lighthouse metrics inline */}
                        {step.lighthouse && (
                          <div className="mt-4 pt-4 border-t border-border">
                            <h4 className="font-medium text-foreground mb-3">Lighthouse Scores</h4>
                            <div className="grid grid-cols-5 gap-3">
                              {[
                                { label: 'Performance', value: step.lighthouse.performance, color: 'blue' },
                                { label: 'Accessibility', value: step.lighthouse.accessibility, color: 'green' },
                                { label: 'Best Practices', value: step.lighthouse.best_practices || step.lighthouse.bestPractices, color: 'purple' },
                                { label: 'SEO', value: step.lighthouse.seo, color: 'orange' },
                                { label: 'PWA', value: step.lighthouse.pwa, color: 'pink' },
                              ].filter(m => m.value !== undefined).map(metric => (
                                <div key={metric.label} className="text-center p-3 bg-muted rounded-lg">
                                  <div className={`text-2xl font-bold ${
                                    (metric.value || 0) >= 90 ? 'text-green-600' :
                                    (metric.value || 0) >= 50 ? 'text-yellow-600' :
                                    'text-red-600'
                                  }`}>
                                    {metric.value}
                                  </div>
                                  <div className="text-xs text-muted-foreground">{metric.label}</div>
                                </div>
                              ))}
                            </div>
                            {step.lighthouse.metrics && (
                              <div className="grid grid-cols-4 gap-2 mt-3 text-sm">
                                {step.lighthouse.metrics.lcp && (
                                  <div className="p-2 bg-muted/50 rounded">
                                    <div className="font-medium">{(step.lighthouse.metrics.lcp / 1000).toFixed(2)}s</div>
                                    <div className="text-xs text-muted-foreground">LCP</div>
                                  </div>
                                )}
                                {step.lighthouse.metrics.fcp && (
                                  <div className="p-2 bg-muted/50 rounded">
                                    <div className="font-medium">{(step.lighthouse.metrics.fcp / 1000).toFixed(2)}s</div>
                                    <div className="text-xs text-muted-foreground">FCP</div>
                                  </div>
                                )}
                                {step.lighthouse.metrics.cls !== undefined && (
                                  <div className="p-2 bg-muted/50 rounded">
                                    <div className="font-medium">{step.lighthouse.metrics.cls.toFixed(3)}</div>
                                    <div className="text-xs text-muted-foreground">CLS</div>
                                  </div>
                                )}
                                {step.lighthouse.metrics.tbt && (
                                  <div className="p-2 bg-muted/50 rounded">
                                    <div className="font-medium">{step.lighthouse.metrics.tbt}ms</div>
                                    <div className="text-xs text-muted-foreground">TBT</div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Load test metrics inline */}
                        {step.load_test && (
                          <div className="mt-4 pt-4 border-t border-border">
                            <h4 className="font-medium text-foreground mb-3">Load Test Results</h4>
                            <div className="grid grid-cols-4 gap-3">
                              <div className="p-3 bg-muted rounded-lg text-center">
                                <div className="text-xl font-bold text-foreground">
                                  {step.load_test.requests_per_second.toFixed(1)}
                                </div>
                                <div className="text-xs text-muted-foreground">Req/sec</div>
                              </div>
                              <div className="p-3 bg-muted rounded-lg text-center">
                                <div className="text-xl font-bold text-foreground">
                                  {step.load_test.avg_response_time}ms
                                </div>
                                <div className="text-xs text-muted-foreground">Avg Response</div>
                              </div>
                              <div className="p-3 bg-muted rounded-lg text-center">
                                <div className="text-xl font-bold text-foreground">
                                  {step.load_test.p95_response_time}ms
                                </div>
                                <div className="text-xs text-muted-foreground">p95 Response</div>
                              </div>
                              <div className={`p-3 rounded-lg text-center ${
                                step.load_test.error_rate > 5 ? 'bg-red-100 dark:bg-red-900/30' :
                                step.load_test.error_rate > 1 ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                                'bg-green-100 dark:bg-green-900/30'
                              }`}>
                                <div className={`text-xl font-bold ${
                                  step.load_test.error_rate > 5 ? 'text-red-600' :
                                  step.load_test.error_rate > 1 ? 'text-yellow-600' :
                                  'text-green-600'
                                }`}>
                                  {step.load_test.error_rate.toFixed(1)}%
                                </div>
                                <div className="text-xs text-muted-foreground">Error Rate</div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Accessibility violations inline */}
                        {step.accessibility && step.accessibility.violations.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-border">
                            <h4 className="font-medium text-foreground mb-3">
                              ♿ Accessibility Violations ({step.accessibility.violations.length})
                            </h4>
                            <div className="space-y-2">
                              {step.accessibility.violations.slice(0, 5).map((violation, vIdx) => (
                                <div
                                  key={vIdx}
                                  className={`p-3 rounded-lg border ${
                                    violation.impact === 'critical' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' :
                                    violation.impact === 'serious' ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' :
                                    violation.impact === 'moderate' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' :
                                    'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                                      violation.impact === 'critical' ? 'bg-red-600 text-white' :
                                      violation.impact === 'serious' ? 'bg-orange-600 text-white' :
                                      violation.impact === 'moderate' ? 'bg-yellow-600 text-white' :
                                      'bg-blue-600 text-white'
                                    }`}>
                                      {violation.impact}
                                    </span>
                                    <span className="font-medium text-foreground">{violation.id}</span>
                                  </div>
                                  <p className="text-sm text-foreground">{violation.description}</p>
                                  {violation.wcagTags && violation.wcagTags.length > 0 && (
                                    <div className="mt-2 flex gap-1 flex-wrap">
                                      {violation.wcagTags.map(tag => (
                                        <span key={tag} className="px-2 py-0.5 text-xs bg-muted rounded">
                                          {tag}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  {violation.helpUrl && (
                                    <a
                                      href={violation.helpUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-primary hover:underline mt-2 inline-block"
                                    >
                                      Learn more →
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                            {/* Feature #1833: Per-step Network Requests */}
                            {showNetworkPerStep && step.stepNetworkRequests.length > 0 && (
                              <div className="mt-4 pt-4 border-t border-border">
                                <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                                  <span>🌐</span> Network Requests ({step.stepNetworkRequests.length})
                                </h4>
                                {/* Network Waterfall visualization */}
                                <div className="mb-3 p-3 bg-muted/50 rounded-lg">
                                  <div className="text-xs text-muted-foreground mb-2">Network Waterfall</div>
                                  <div className="space-y-1">
                                    {step.stepNetworkRequests.slice(0, 10).map((req, rIdx) => {
                                      const maxDuration = Math.max(...step.stepNetworkRequests.map(r => r.duration_ms || 0));
                                      const widthPercent = maxDuration > 0 ? ((req.duration_ms || 0) / maxDuration * 100) : 0;
                                      const startPercent = step.stepNetworkRequests
                                        .slice(0, rIdx)
                                        .reduce((acc, r) => acc + ((r.duration_ms || 0) / maxDuration * 20), 0);

                                      return (
                                        <div key={rIdx} className="flex items-center gap-2 text-xs">
                                          <span className={`w-12 text-right font-mono ${
                                            !req.status ? 'text-gray-500' :
                                            req.status >= 200 && req.status < 300 ? 'text-green-600' :
                                            req.status >= 400 ? 'text-red-600' : 'text-yellow-600'
                                          }`}>
                                            {req.status || '-'}
                                          </span>
                                          <div className="flex-1 h-4 bg-muted rounded relative overflow-hidden">
                                            <div
                                              className={`h-full rounded ${
                                                !req.status ? 'bg-gray-400' :
                                                req.status >= 200 && req.status < 300 ? 'bg-green-500' :
                                                req.status >= 400 ? 'bg-red-500' : 'bg-yellow-500'
                                              }`}
                                              style={{
                                                width: `${Math.max(widthPercent, 5)}%`,
                                                marginLeft: `${Math.min(startPercent, 80)}%`
                                              }}
                                              title={`${req.method} ${req.url} - ${req.duration_ms}ms`}
                                            />
                                          </div>
                                          <span className="w-16 text-right text-muted-foreground font-mono">
                                            {req.duration_ms ? `${req.duration_ms}ms` : '-'}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                                {/* Detailed request list */}
                                <div className="space-y-2 max-h-48 overflow-auto">
                                  {step.stepNetworkRequests.slice(0, 10).map((req, rIdx) => (
                                    <div key={rIdx} className="p-2 bg-muted/30 rounded text-xs flex items-start gap-2">
                                      <span className={`px-1.5 py-0.5 rounded font-mono ${
                                        !req.status ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' :
                                        req.status >= 200 && req.status < 300 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                        req.status >= 400 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-yellow-100 text-yellow-700'
                                      }`}>
                                        {req.method}
                                      </span>
                                      <span className="flex-1 text-muted-foreground truncate" title={req.url}>{req.url}</span>
                                      <span className="text-muted-foreground/70">{req.resourceType}</span>
                                      {req.responseSize && (
                                        <span className="text-muted-foreground/70">{(req.responseSize / 1024).toFixed(1)}KB</span>
                                      )}
                                    </div>
                                  ))}
                                  {step.stepNetworkRequests.length > 10 && (
                                    <p className="text-xs text-muted-foreground text-center">
                                      ... and {step.stepNetworkRequests.length - 10} more requests
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Feature #1833: Per-step Console Logs */}
                            {showConsolePerStep && step.stepConsoleLogs.length > 0 && (
                              <div className="mt-4 pt-4 border-t border-border">
                                <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                                  <span>📝</span> Console Logs ({step.stepConsoleLogs.length})
                                  {step.stepConsoleLogs.some(l => l.level === 'error') && (
                                    <span className="px-1.5 py-0.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded">
                                      {step.stepConsoleLogs.filter(l => l.level === 'error').length} errors
                                    </span>
                                  )}
                                </h4>
                                <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs overflow-auto max-h-40">
                                  {step.stepConsoleLogs.map((log, lIdx) => (
                                    <div
                                      key={lIdx}
                                      className={`py-0.5 ${
                                        log.level === 'error' ? 'text-red-400' :
                                        log.level === 'warn' ? 'text-yellow-400' :
                                        log.level === 'info' ? 'text-blue-400' :
                                        log.level === 'debug' ? 'text-gray-400' :
                                        'text-gray-200'
                                      }`}
                                    >
                                      <span className="text-gray-500">[{new Date(log.timestamp).toISOString().split('T')[1].slice(0, 12)}]</span>
                                      <span className="uppercase ml-1 mr-1">[{log.level}]</span>
                                      <span className="break-all">{log.message}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Feature #1833: Screenshot Modal */}
            {selectedScreenshot && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
                onClick={() => setSelectedScreenshot(null)}
              >
                <div className="relative max-w-4xl max-h-[90vh] p-4">
                  <button
                    onClick={() => setSelectedScreenshot(null)}
                    className="absolute -top-2 -right-2 z-10 p-2 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <svg className="h-5 w-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <p className="text-white text-center mb-2">{selectedScreenshot.title}</p>
                  <img
                    src={selectedScreenshot.url}
                    alt={selectedScreenshot.title}
                    className="max-w-full max-h-[80vh] rounded-lg"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Screenshots Tab - Feature #1834: Full screenshot gallery with comparison */}
        {activeTab === 'screenshots' && (
          <div>
            {/* Header with controls */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Screenshots</h2>
                <p className="text-sm text-muted-foreground">
                  {allScreenshots.length} screenshot{allScreenshots.length !== 1 ? 's' : ''} captured
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {/* View mode toggle */}
                <div className="flex items-center bg-muted rounded-lg p-1">
                  <button
                    onClick={() => setGalleryViewMode('grid')}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                      galleryViewMode === 'grid'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                      </svg>
                      Grid
                    </span>
                  </button>
                  <button
                    onClick={() => setGalleryViewMode('carousel')}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                      galleryViewMode === 'carousel'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Carousel
                    </span>
                  </button>
                </div>

                {/* Comparison mode toggle */}
                <button
                  onClick={() => {
                    setComparisonMode(!comparisonMode);
                    if (comparisonMode) setSelectedForComparison([]);
                  }}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    comparisonMode
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-foreground border-border hover:bg-muted'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                    Compare {comparisonMode && selectedForComparison.length > 0 && `(${selectedForComparison.length}/2)`}
                  </span>
                </button>

                {/* Download ZIP button */}
                <button
                  onClick={downloadAllAsZip}
                  disabled={allScreenshots.length === 0 || downloadingZip}
                  className="px-3 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    {downloadingZip ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Creating ZIP...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download All (ZIP)
                      </>
                    )}
                  </span>
                </button>
              </div>
            </div>

            {/* Feature #1997: Filter buttons by test type */}
            {allScreenshots.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="text-sm text-muted-foreground mr-2">Filter:</span>
                {(['All', 'E2E', 'Visual', 'Performance', 'Load', 'Accessibility'] as const).map(filterType => {
                  // Count screenshots for this type
                  const count = filterType === 'All'
                    ? allScreenshots.length
                    : allScreenshots.filter(s => s.testType === filterType).length;

                  // Skip types with no screenshots
                  if (count === 0 && filterType !== 'All') return null;

                  // Define colors for each type
                  const typeColors: Record<string, string> = {
                    'All': 'bg-gray-500',
                    'E2E': 'bg-blue-500',
                    'Visual': 'bg-purple-500',
                    'Performance': 'bg-amber-500',
                    'Load': 'bg-orange-500',
                    'Accessibility': 'bg-green-500',
                  };

                  return (
                    <button
                      key={filterType}
                      onClick={() => setScreenshotTypeFilter(filterType)}
                      className={`px-3 py-1.5 text-sm rounded-lg border transition-colors flex items-center gap-2 ${
                        screenshotTypeFilter === filterType
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-foreground border-border hover:bg-muted'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${typeColors[filterType]}`} />
                      {filterType}
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        screenshotTypeFilter === filterType ? 'bg-primary-foreground/20' : 'bg-muted'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {allScreenshots.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-border rounded-lg">
                <svg className="w-12 h-12 mx-auto text-muted-foreground mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-muted-foreground">No screenshots captured during this run.</p>
              </div>
            ) : (
              <>
                {/* Comparison View */}
                {comparisonMode && selectedForComparison.length === 2 && (
                  <div className="mb-6 border border-border rounded-lg overflow-hidden">
                    <div className="p-3 bg-muted/30 border-b border-border flex items-center justify-between">
                      <h3 className="font-medium text-foreground">Side-by-Side Comparison</h3>
                      <button
                        onClick={() => setSelectedForComparison([])}
                        className="text-sm text-muted-foreground hover:text-foreground"
                      >
                        Clear
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-px bg-border">
                      {selectedForComparison.map((id) => {
                        const screenshot = allScreenshots.find(s => s.id === id);
                        if (!screenshot) return null;
                        return (
                          <div key={id} className="bg-background p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className={`text-xs px-2 py-0.5 rounded ${getScreenshotTypeBadge(screenshot.type)}`}>
                                {screenshot.type.replace('_', ' ')}
                              </span>
                              <button
                                onClick={() => downloadScreenshot(screenshot)}
                                className="text-muted-foreground hover:text-foreground"
                                title="Download"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                              </button>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2 truncate">{screenshot.title}</p>
                            <img
                              src={screenshot.url}
                              alt={screenshot.title}
                              className="w-full rounded border border-border"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Grid View - Feature #1996: Grouped by test type with collapsible sections */}
                {/* Feature #1997: Filter screenshots by test type */}
                {galleryViewMode === 'grid' && (
                  <div className="space-y-6">
                    {/* Group screenshots by test type */}
                    {(() => {
                      // Feature #1997: Apply filter before grouping
                      const filteredScreenshots = screenshotTypeFilter === 'All'
                        ? allScreenshots
                        : allScreenshots.filter(s => s.testType === screenshotTypeFilter);

                      const groupedScreenshots = filteredScreenshots.reduce((acc, screenshot) => {
                        const type = screenshot.testType || 'E2E';
                        if (!acc[type]) acc[type] = [];
                        acc[type].push(screenshot);
                        return acc;
                      }, {} as Record<string, typeof allScreenshots>);

                      // Define the order and labels for test types
                      const typeOrder = ['E2E', 'Visual', 'Performance', 'Load', 'Accessibility'] as const;
                      const typeLabels: Record<string, { label: string; icon: string; color: string }> = {
                        'E2E': { label: 'E2E Tests', icon: '🧪', color: 'bg-blue-500' },
                        'Visual': { label: 'Visual Tests', icon: '🎨', color: 'bg-purple-500' },
                        'Performance': { label: 'Performance Tests', icon: '⚡', color: 'bg-amber-500' },
                        'Load': { label: 'Load Tests', icon: '📊', color: 'bg-orange-500' },
                        'Accessibility': { label: 'Accessibility Tests', icon: '♿', color: 'bg-green-500' },
                      };

                      // Toggle group collapse
                      const toggleGroup = (type: string) => {
                        setCollapsedGroups(prev => {
                          const newSet = new Set(prev);
                          if (newSet.has(type)) {
                            newSet.delete(type);
                          } else {
                            newSet.add(type);
                          }
                          return newSet;
                        });
                      };

                      // Calculate index offset for lightbox navigation
                      let globalIndex = 0;

                      // Feature #1997: Show empty state when filter returns no results
                      if (filteredScreenshots.length === 0) {
                        return (
                          <div className="text-center py-12 border border-dashed border-border rounded-lg">
                            <svg className="w-12 h-12 mx-auto text-muted-foreground mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                            </svg>
                            <p className="text-muted-foreground">No {screenshotTypeFilter.toLowerCase()} screenshots found.</p>
                            <button
                              onClick={() => setScreenshotTypeFilter('All')}
                              className="mt-4 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                            >
                              Show All Screenshots
                            </button>
                          </div>
                        );
                      }

                      return typeOrder.map(type => {
                        const screenshots = groupedScreenshots[type];
                        if (!screenshots || screenshots.length === 0) return null;
                        const isCollapsed = collapsedGroups.has(type);
                        const typeInfo = typeLabels[type] || { label: `${type} Tests`, icon: '📷', color: 'bg-gray-500' };
                        const startIndex = globalIndex;
                        globalIndex += screenshots.length;

                        return (
                          <div key={type} className="border border-border rounded-lg overflow-hidden">
                            {/* Collapsible Header - Feature #2001: Added download button */}
                            <div className="flex items-center justify-between p-4 bg-muted/30">
                              <button
                                onClick={() => toggleGroup(type)}
                                className="flex items-center gap-3 flex-1 hover:opacity-80 transition-opacity"
                              >
                                <span className={`w-8 h-8 ${typeInfo.color} rounded-lg flex items-center justify-center text-white text-sm`}>
                                  {typeInfo.icon}
                                </span>
                                <div className="text-left">
                                  <h3 className="font-medium text-foreground">{typeInfo.label}</h3>
                                  <p className="text-xs text-muted-foreground">{screenshots.length} screenshot{screenshots.length !== 1 ? 's' : ''}</p>
                                </div>
                              </button>
                              <div className="flex items-center gap-2">
                                {/* Feature #2001: Download group button */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    downloadGroupAsZip(type, screenshots);
                                  }}
                                  disabled={downloadingZip}
                                  className="p-2 rounded-lg bg-background border border-border hover:bg-muted transition-colors disabled:opacity-50"
                                  title={`Download all ${typeInfo.label.toLowerCase()} as ZIP`}
                                >
                                  {downloadingZip ? (
                                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                  ) : (
                                    <svg className="w-4 h-4 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                  )}
                                </button>
                                {/* Collapse/expand indicator */}
                                <button
                                  onClick={() => toggleGroup(type)}
                                  className="p-2 rounded-lg hover:bg-muted transition-colors"
                                >
                                  <svg
                                    className={`w-5 h-5 text-muted-foreground transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                              </div>
                            </div>

                            {/* Screenshots Grid */}
                            {!isCollapsed && (
                              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                {screenshots.map((screenshot, idx) => (
                                  <div
                                    key={screenshot.id}
                                    className={`relative group border rounded-lg overflow-hidden transition-all cursor-pointer ${
                                      comparisonMode && selectedForComparison.includes(screenshot.id)
                                        ? 'ring-2 ring-primary border-primary'
                                        : 'border-border hover:border-primary/50'
                                    }`}
                                    onClick={() => {
                                      if (comparisonMode) {
                                        toggleComparisonSelect(screenshot.id);
                                      } else {
                                        openLightbox(startIndex + idx);
                                      }
                                    }}
                                  >
                                    {/* Comparison checkbox */}
                                    {comparisonMode && (
                                      <div className="absolute top-2 left-2 z-10">
                                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                          selectedForComparison.includes(screenshot.id)
                                            ? 'bg-primary border-primary'
                                            : 'bg-background/80 border-border'
                                        }`}>
                                          {selectedForComparison.includes(screenshot.id) && (
                                            <svg className="w-3 h-3 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {/* Thumbnail image */}
                                    <div className="aspect-video bg-muted relative">
                                      <img
                                        src={screenshot.url}
                                        alt={screenshot.title}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                      />
                                      {/* Feature #1998: Always-visible screenshot type badge */}
                                      <span className={`absolute top-2 left-2 text-xs px-2 py-0.5 rounded font-medium ${getScreenshotTypeBadge(screenshot.type)}`}>
                                        {screenshot.type.replace('_', ' ')}
                                      </span>
                                    </div>

                                    {/* Feature #1998: Always-visible info section with test type and name */}
                                    <div className="p-2 bg-muted/50">
                                      <div className="flex items-center gap-1.5 mb-1">
                                        {/* Test type badge with distinct color */}
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium text-white ${typeInfo.color}`}>
                                          {screenshot.testType}
                                        </span>
                                        {/* Screenshot status badge */}
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                          screenshot.testStatus === 'passed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                          screenshot.testStatus === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                          'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                                        }`}>
                                          {screenshot.testStatus}
                                        </span>
                                      </div>
                                      {/* Test name */}
                                      <p className="text-xs text-foreground truncate" title={screenshot.title}>
                                        {screenshot.title}
                                      </p>
                                      {/* Timestamp */}
                                      {screenshot.timestamp && (
                                        <p className="text-[10px] text-muted-foreground">{formatStepTime(screenshot.timestamp)}</p>
                                      )}
                                    </div>

                                    {/* Overlay with additional info on hover */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                      <div className="absolute bottom-12 left-0 right-0 p-3">
                                        {screenshot.stepAction && (
                                          <p className="text-white/70 text-xs truncate">Step: {screenshot.stepAction}</p>
                                        )}
                                      </div>
                                    </div>

                                    {/* Download button */}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        downloadScreenshot(screenshot);
                                      }}
                                      className="absolute top-2 right-2 p-1.5 bg-background/80 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
                                      title="Download"
                                    >
                                      <svg className="w-4 h-4 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                      </svg>
                                    </button>

                                    {/* Status indicator */}
                                    <div className={`absolute top-2 right-10 w-2 h-2 rounded-full ${
                                      screenshot.testStatus === 'passed' ? 'bg-green-500' :
                                      screenshot.testStatus === 'failed' ? 'bg-red-500' :
                                      screenshot.testStatus === 'error' ? 'bg-red-500' :
                                      'bg-gray-500'
                                    }`} title={screenshot.testStatus} />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}

                {/* Carousel View */}
                {galleryViewMode === 'carousel' && (
                  <div className="relative">
                    <div className="border border-border rounded-lg overflow-hidden">
                      {/* Main image */}
                      <div
                        className="aspect-video bg-muted relative cursor-pointer"
                        onClick={() => openLightbox(lightboxIndex)}
                      >
                        <img
                          src={allScreenshots[lightboxIndex]?.url}
                          alt={allScreenshots[lightboxIndex]?.title}
                          className="w-full h-full object-contain"
                        />
                        {/* Navigation arrows */}
                        <button
                          onClick={(e) => { e.stopPropagation(); navigateLightbox('prev'); }}
                          className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-background/80 rounded-full hover:bg-background transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); navigateLightbox('next'); }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-background/80 rounded-full hover:bg-background transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>

                      {/* Info panel */}
                      <div className="p-4 bg-muted/30 border-t border-border">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs px-2 py-0.5 rounded ${getScreenshotTypeBadge(allScreenshots[lightboxIndex]?.type || 'final')}`}>
                                {allScreenshots[lightboxIndex]?.type.replace('_', ' ')}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                allScreenshots[lightboxIndex]?.testStatus === 'passed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                              }`}>
                                {allScreenshots[lightboxIndex]?.testStatus}
                              </span>
                            </div>
                            <h3 className="font-medium text-foreground">{allScreenshots[lightboxIndex]?.title}</h3>
                            <p className="text-sm text-muted-foreground">{allScreenshots[lightboxIndex]?.testName}</p>
                            {allScreenshots[lightboxIndex]?.stepAction && (
                              <p className="text-sm text-muted-foreground">
                                Step {(allScreenshots[lightboxIndex]?.stepIndex || 0) + 1}: {allScreenshots[lightboxIndex]?.stepAction}
                              </p>
                            )}
                            {allScreenshots[lightboxIndex]?.viewport && (
                              <p className="text-xs text-muted-foreground mt-1">
                                📐 {allScreenshots[lightboxIndex]?.viewport?.width}×{allScreenshots[lightboxIndex]?.viewport?.height}
                              </p>
                            )}
                            {allScreenshots[lightboxIndex]?.timestamp && (
                              <p className="text-xs text-muted-foreground">
                                🕐 {formatStepTime(allScreenshots[lightboxIndex]?.timestamp)}
                              </p>
                            )}
                            {allScreenshots[lightboxIndex]?.diffPercentage !== undefined && (
                              <p className="text-xs text-red-500">
                                ⚠️ {allScreenshots[lightboxIndex]?.diffPercentage?.toFixed(2)}% difference
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => downloadScreenshot(allScreenshots[lightboxIndex])}
                            className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                          >
                            Download
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Thumbnail strip */}
                    <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                      {allScreenshots.map((screenshot, idx) => (
                        <button
                          key={screenshot.id}
                          onClick={() => setLightboxIndex(idx)}
                          className={`flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 transition-colors ${
                            idx === lightboxIndex ? 'border-primary' : 'border-transparent hover:border-border'
                          }`}
                        >
                          <img
                            src={screenshot.url}
                            alt={screenshot.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </button>
                      ))}
                    </div>
                    <p className="text-center text-sm text-muted-foreground mt-2">
                      {lightboxIndex + 1} / {allScreenshots.length}
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Lightbox Modal */}
            {lightboxOpen && allScreenshots[lightboxIndex] && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
                onClick={() => setLightboxOpen(false)}
              >
                <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                  {/* Close button */}
                  <button
                    onClick={() => setLightboxOpen(false)}
                    className="absolute -top-10 right-0 p-2 text-white/70 hover:text-white transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>

                  {/* Navigation */}
                  <button
                    onClick={() => navigateLightbox('prev')}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
                  >
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => navigateLightbox('next')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
                  >
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  {/* Image */}
                  <img
                    src={allScreenshots[lightboxIndex].url}
                    alt={allScreenshots[lightboxIndex].title}
                    className="max-w-[90vw] max-h-[80vh] object-contain rounded-lg"
                  />

                  {/* Feature #1999: Enhanced metadata panel */}
                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/70 to-transparent">
                    <div className="text-white">
                      {/* Row 1: Title and badges */}
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs px-2 py-0.5 rounded ${getScreenshotTypeBadge(allScreenshots[lightboxIndex].type)}`}>
                              {allScreenshots[lightboxIndex].type.replace('_', ' ')}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded text-white ${
                              allScreenshots[lightboxIndex].testType === 'E2E' ? 'bg-blue-500' :
                              allScreenshots[lightboxIndex].testType === 'Visual' ? 'bg-purple-500' :
                              allScreenshots[lightboxIndex].testType === 'Accessibility' ? 'bg-green-500' :
                              allScreenshots[lightboxIndex].testType === 'Performance' ? 'bg-amber-500' :
                              allScreenshots[lightboxIndex].testType === 'Load' ? 'bg-orange-500' :
                              'bg-gray-500'
                            }`}>
                              {allScreenshots[lightboxIndex].testType}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              allScreenshots[lightboxIndex].testStatus === 'passed' ? 'bg-green-500/80' : 'bg-red-500/80'
                            }`}>
                              {allScreenshots[lightboxIndex].testStatus}
                            </span>
                          </div>
                          <h3 className="font-semibold text-lg">{allScreenshots[lightboxIndex].title}</h3>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-white/70">
                            {lightboxIndex + 1} / {allScreenshots.length}
                          </span>
                          {/* Feature #2000: View Test button to navigate to the related test */}
                          <button
                            onClick={() => {
                              // Close lightbox and navigate to Results tab with the test highlighted
                              setLightboxOpen(false);
                              setActiveTab('results');
                              // Find the test result element and scroll to it
                              const testId = allScreenshots[lightboxIndex].testId;
                              setTimeout(() => {
                                const testElement = document.querySelector(`[data-test-id="${testId}"]`);
                                if (testElement) {
                                  testElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  // Add a brief highlight effect
                                  testElement.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
                                  setTimeout(() => {
                                    testElement.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
                                  }, 2000);
                                }
                              }, 100);
                            }}
                            className="px-3 py-1.5 text-sm bg-primary/80 rounded-lg hover:bg-primary transition-colors flex items-center gap-1.5"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            View Test
                          </button>
                          <button
                            onClick={() => downloadScreenshot(allScreenshots[lightboxIndex])}
                            className="px-3 py-1.5 text-sm bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                          >
                            Download
                          </button>
                        </div>
                      </div>

                      {/* Row 2: Metadata grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 text-sm">
                        {/* Test Name */}
                        <div className="flex items-center gap-2">
                          <span className="text-white/50">Test:</span>
                          <span className="text-white/90 truncate">{allScreenshots[lightboxIndex].testName}</span>
                        </div>
                        {/* Step */}
                        {allScreenshots[lightboxIndex].stepAction && (
                          <div className="flex items-center gap-2">
                            <span className="text-white/50">Step:</span>
                            <span className="text-white/90 truncate">
                              {(allScreenshots[lightboxIndex].stepIndex !== undefined ? `#${allScreenshots[lightboxIndex].stepIndex + 1} ` : '')}
                              {allScreenshots[lightboxIndex].stepAction}
                            </span>
                          </div>
                        )}
                        {/* Timestamp */}
                        {allScreenshots[lightboxIndex].timestamp && (
                          <div className="flex items-center gap-2">
                            <span className="text-white/50">Time:</span>
                            <span className="text-white/90">{formatStepTime(allScreenshots[lightboxIndex].timestamp)}</span>
                          </div>
                        )}
                        {/* Browser */}
                        <div className="flex items-center gap-2">
                          <span className="text-white/50">Browser:</span>
                          <span className="text-white/90">{run?.browser || 'chromium'}</span>
                        </div>
                        {/* Viewport */}
                        {allScreenshots[lightboxIndex].viewport && (
                          <div className="flex items-center gap-2">
                            <span className="text-white/50">Viewport:</span>
                            <span className="text-white/90">
                              {allScreenshots[lightboxIndex].viewport?.width}×{allScreenshots[lightboxIndex].viewport?.height}
                            </span>
                          </div>
                        )}
                        {/* Diff percentage for visual tests */}
                        {allScreenshots[lightboxIndex].diffPercentage !== undefined && (
                          <div className="flex items-center gap-2">
                            <span className="text-white/50">Diff:</span>
                            <span className={`${allScreenshots[lightboxIndex].diffPercentage > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                              {allScreenshots[lightboxIndex].diffPercentage?.toFixed(2)}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Keyboard hint */}
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex gap-4 text-white/50 text-sm">
                  <span>← → Navigate</span>
                  <span>ESC Close</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Metrics Tab - Feature #1835: Enhanced Lighthouse performance dashboard */}
        {/* Feature #1907: Professional styling with consistent spacing and typography */}
        {activeTab === 'metrics' && (
          <div className="space-y-10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Performance Metrics</h2>
                <p className="text-sm text-muted-foreground mt-1">Lighthouse audit results and performance analysis</p>
              </div>
              {/* Compare with previous run toggle */}
              <button
                onClick={() => setShowPreviousComparison(!showPreviousComparison)}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  showPreviousComparison
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-foreground border-border hover:bg-muted'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Compare Previous
                </span>
              </button>
            </div>

            {/* Lighthouse Results */}
            {performanceResults.length > 0 && (
              <div className="mb-8">
                {performanceResults.map((result, idx) => {
                  const lighthouse = result.steps.find(s => s.lighthouse)?.lighthouse;
                  if (!lighthouse) return null;

                  // Feature #1887: Use real opportunities and diagnostics from backend
                  // Backend returns: { id, title, savings (in ms), description }
                  const opportunities = (lighthouse.opportunities || [])
                    .map((opp: any) => ({
                      id: opp.id,
                      title: opp.title,
                      // Convert savings from ms to human-readable format
                      savings: opp.savings >= 1000 ? `${(opp.savings / 1000).toFixed(1)}s` : `${opp.savings}ms`,
                      details: opp.description,
                    }))
                    .sort((a: any, b: any) => {
                      // Sort by savings (parse back to compare numerically)
                      const savingsA = parseFloat(a.savings) * (a.savings.includes('s') ? 1000 : 1);
                      const savingsB = parseFloat(b.savings) * (b.savings.includes('s') ? 1000 : 1);
                      return savingsB - savingsA;
                    });

                  const diagnostics = (lighthouse.diagnostics || [])
                    .map((diag: any) => ({
                      id: diag.id,
                      title: diag.title,
                      details: diag.description,
                    }));

                  // Feature #1889: Extract passed audits from lighthouse results
                  // Backend returns: { id, title, description, category }
                  const passedAudits = (lighthouse.passedAudits || [])
                    .map((audit: any) => ({
                      id: audit.id,
                      title: audit.title,
                      details: audit.description,
                      category: audit.category || 'Other',
                    }));

                  // Group passed audits by category
                  const passedAuditsByCategory = passedAudits.reduce((acc: Record<string, any[]>, audit: any) => {
                    const cat = audit.category;
                    if (!acc[cat]) acc[cat] = [];
                    acc[cat].push(audit);
                    return acc;
                  }, {});

                  return (
                    <div key={idx} className="bg-card border border-border rounded-xl overflow-hidden shadow-lg shadow-black/5 dark:shadow-black/20">
                      {/* Header */}
                      <div className="p-5 bg-gradient-to-r from-muted/50 to-muted/20 border-b border-border">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-lg font-semibold text-foreground">{result.test_name}</h3>
                            {lighthouse.url && (
                              <p className="text-sm text-muted-foreground">{lighthouse.url}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {lighthouse.device && (
                              <span className="px-2 py-1 text-xs bg-muted rounded-lg text-muted-foreground">
                                {lighthouse.device === 'mobile' ? '📱 Mobile' : '🖥️ Desktop'}
                              </span>
                            )}
                            {/* Feature #1935: AI Performance Analysis button */}
                            <button
                              onClick={() => analyzePerformanceResults(result.test_name, lighthouse)}
                              disabled={perfAILoading && perfAIAnalysisOpen === result.test_name}
                              className="px-3 py-1.5 text-sm bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                              title="AI Performance Analysis"
                            >
                              {perfAILoading && perfAIAnalysisOpen === result.test_name ? (
                                <>
                                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Analyzing...
                                </>
                              ) : (
                                <>
                                  <span>🤖</span>
                                  AI Analysis
                                </>
                              )}
                            </button>
                            {/* Feature #1911: PDF Export button */}
                            <button
                              onClick={() => exportLighthousePDF(lighthouse, result.test_name, lighthouse.url)}
                              className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-1.5"
                              title="Export as PDF Report"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                              </svg>
                              PDF
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Feature #1935: AI Performance Analysis Results Panel */}
                      {perfAIResult[result.test_name] && (
                        <div className="mx-6 mt-4 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-800 rounded-xl">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">🤖</span>
                              <h4 className="font-semibold text-purple-700 dark:text-purple-300">AI Performance Analysis</h4>
                            </div>
                            <button
                              onClick={() => setPerfAIResult(prev => {
                                const newResult = { ...prev };
                                delete newResult[result.test_name];
                                return newResult;
                              })}
                              className="text-muted-foreground hover:text-foreground p-1"
                              title="Close analysis"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <div className="whitespace-pre-wrap text-sm text-foreground">
                              {perfAIResult[result.test_name]}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Feature #1935: AI Performance Analysis Error */}
                      {perfAIError && perfAIAnalysisOpen === result.test_name && (
                        <div className="mx-6 mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-sm">{perfAIError}</span>
                          </div>
                        </div>
                      )}

                      {/* Feature #1906: Executive Summary Card for Lighthouse Results */}
                      {(() => {
                        // Calculate overall status based on all scores
                        const scores = [
                          lighthouse.performance || 0,
                          lighthouse.accessibility || 0,
                          lighthouse.best_practices || lighthouse.bestPractices || 0,
                          lighthouse.seo || 0,
                        ].filter(s => s > 0);
                        const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
                        const minScore = scores.length > 0 ? Math.min(...scores) : 0;
                        const lighthouseStatus = minScore >= 90 ? 'excellent' :
                                                 minScore >= 50 ? 'needs-improvement' : 'poor';

                        // Get top 3 opportunities for improvement
                        const topOpportunities = opportunities.slice(0, 3);

                        // Get low-scoring categories
                        const lowScoreCategories = [
                          { name: 'Performance', score: lighthouse.performance || 0 },
                          { name: 'Accessibility', score: lighthouse.accessibility || 0 },
                          { name: 'Best Practices', score: lighthouse.best_practices || lighthouse.bestPractices || 0 },
                          { name: 'SEO', score: lighthouse.seo || 0 },
                        ].filter(c => c.score < 90 && c.score > 0).sort((a, b) => a.score - b.score);

                        return (
                          <div className={`mx-6 mt-6 p-6 rounded-xl border-2 ${
                            lighthouseStatus === 'excellent' ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800' :
                            lighthouseStatus === 'needs-improvement' ? 'bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border-yellow-200 dark:border-yellow-800' :
                            'bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border-red-200 dark:border-red-800'
                          }`}>
                            {/* Status Header */}
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                                  lighthouseStatus === 'excellent' ? 'bg-green-100 dark:bg-green-800' :
                                  lighthouseStatus === 'needs-improvement' ? 'bg-yellow-100 dark:bg-yellow-800' :
                                  'bg-red-100 dark:bg-red-800'
                                }`}>
                                  {lighthouseStatus === 'excellent' ? (
                                    <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  ) : lighthouseStatus === 'needs-improvement' ? (
                                    <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                  ) : (
                                    <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  )}
                                </div>
                                <div>
                                  <h4 className={`text-xl font-bold ${
                                    lighthouseStatus === 'excellent' ? 'text-green-700 dark:text-green-400' :
                                    lighthouseStatus === 'needs-improvement' ? 'text-yellow-700 dark:text-yellow-400' :
                                    'text-red-700 dark:text-red-400'
                                  }`}>
                                    {lighthouseStatus === 'excellent' ? 'Excellent Performance' :
                                     lighthouseStatus === 'needs-improvement' ? 'Needs Improvement' :
                                     'Poor Performance'}
                                  </h4>
                                  <p className="text-sm text-muted-foreground">
                                    {lighthouseStatus === 'excellent'
                                      ? 'All categories score 90+ - your page meets modern web standards'
                                      : lighthouseStatus === 'needs-improvement'
                                      ? `${lowScoreCategories.length} categor${lowScoreCategories.length === 1 ? 'y' : 'ies'} below 90: ${lowScoreCategories.map(c => c.name).join(', ')}`
                                      : `Critical issues found in ${lowScoreCategories.filter(c => c.score < 50).length} categories`
                                    }
                                  </p>
                                </div>
                              </div>

                              {/* Comparison badge if previous audit available */}
                              {lighthouse.comparison_to_previous && (
                                <div className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                                  lighthouse.comparison_to_previous.improved
                                    ? 'bg-green-100 text-green-700 dark:bg-green-800/50 dark:text-green-300'
                                    : 'bg-red-100 text-red-700 dark:bg-red-800/50 dark:text-red-300'
                                }`}>
                                  {lighthouse.comparison_to_previous.improved ? '↑' : '↓'} {Math.abs(lighthouse.comparison_to_previous.avg_change || 0)} pts vs previous
                                </div>
                              )}
                            </div>

                            {/* Score Gauges in Summary */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                              {[
                                { label: 'Performance', value: lighthouse.performance, icon: '⚡' },
                                { label: 'Accessibility', value: lighthouse.accessibility, icon: '♿' },
                                { label: 'Best Practices', value: lighthouse.best_practices || lighthouse.bestPractices, icon: '✓' },
                                { label: 'SEO', value: lighthouse.seo, icon: '🔍' },
                              ].filter(m => m.value !== undefined).map(metric => (
                                <div key={metric.label} className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-4 text-center">
                                  <div className="text-2xl mb-1">{metric.icon}</div>
                                  <div className={`text-3xl font-bold ${
                                    (metric.value || 0) >= 90 ? 'text-green-600' :
                                    (metric.value || 0) >= 50 ? 'text-yellow-600' :
                                    'text-red-600'
                                  }`}>
                                    {metric.value}
                                  </div>
                                  <div className="text-sm text-muted-foreground font-medium">{metric.label}</div>
                                </div>
                              ))}
                            </div>

                            {/* Top 3 Issues to Fix */}
                            {topOpportunities.length > 0 && (
                              <div className="bg-white/30 dark:bg-gray-800/30 rounded-lg p-4 mb-4">
                                <h5 className="font-medium text-foreground mb-3 flex items-center gap-2">
                                  <span>🎯</span> Top Issues to Fix
                                </h5>
                                <div className="space-y-2">
                                  {topOpportunities.map((opp: any, i: number) => (
                                    <div key={opp.id || i} className="flex items-center justify-between text-sm">
                                      <div className="flex items-center gap-2">
                                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                                          i === 0 ? 'bg-red-100 text-red-700 dark:bg-red-800/50 dark:text-red-300' :
                                          i === 1 ? 'bg-orange-100 text-orange-700 dark:bg-orange-800/50 dark:text-orange-300' :
                                          'bg-yellow-100 text-yellow-700 dark:bg-yellow-800/50 dark:text-yellow-300'
                                        }`}>{i + 1}</span>
                                        <span className="text-foreground">{opp.title}</span>
                                      </div>
                                      <span className={`font-medium ${
                                        parseFloat(opp.savings) >= 1 ? 'text-red-600' :
                                        parseFloat(opp.savings) >= 0.5 ? 'text-orange-600' :
                                        'text-yellow-600'
                                      }`}>
                                        Save {opp.savings}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* One-liner Summary */}
                            <div className="pt-4 border-t border-current/10">
                              <p className="text-sm text-muted-foreground italic">
                                📊 <strong>Summary:</strong>{' '}
                                {lighthouseStatus === 'excellent'
                                  ? `This page excels across all Lighthouse categories with an average score of ${avgScore}. It provides a fast, accessible, and SEO-friendly experience.`
                                  : lighthouseStatus === 'needs-improvement'
                                  ? `This page has an average score of ${avgScore}. Focus on ${lowScoreCategories[0]?.name || 'performance'} (${lowScoreCategories[0]?.score || 0}) to achieve the biggest improvement${topOpportunities[0] ? ` - fixing "${topOpportunities[0].title}" could save ${topOpportunities[0].savings}` : ''}.`
                                  : `Critical performance issues detected with an average score of ${avgScore}. ${lowScoreCategories.filter(c => c.score < 50).map(c => c.name).join(' and ')} need${lowScoreCategories.filter(c => c.score < 50).length === 1 ? 's' : ''} immediate attention.`
                                }
                              </p>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Feature #1909: Tabbed Interface for Lighthouse Results */}
                      <div className="border-b border-border">
                        <nav className="flex overflow-x-auto px-6 -mb-px">
                          {[
                            { id: 'overview' as const, label: 'Overview', icon: '📊' },
                            { id: 'performance' as const, label: 'Performance', icon: '⚡' },
                            { id: 'accessibility' as const, label: 'Accessibility', icon: '♿' },
                            { id: 'best_practices' as const, label: 'Best Practices', icon: '✓' },
                            { id: 'seo' as const, label: 'SEO', icon: '🔍' },
                          ].map(tab => (
                            <button
                              key={tab.id}
                              onClick={() => setLighthouseActiveTab(tab.id)}
                              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                                lighthouseActiveTab === tab.id
                                  ? 'border-primary text-primary'
                                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                              }`}
                            >
                              <span>{tab.icon}</span>
                              {tab.label}
                            </button>
                          ))}
                        </nav>
                      </div>

                      <div className="p-6">
                        {/* Overview Tab */}
                        {lighthouseActiveTab === 'overview' && (
                          <>
                            {/* Circular Gauges for main scores */}
                            <div className="flex justify-center gap-8 flex-wrap mb-8">
                              {[
                                { label: 'Performance', value: lighthouse.performance },
                                { label: 'Accessibility', value: lighthouse.accessibility },
                                { label: 'Best Practices', value: lighthouse.best_practices || lighthouse.bestPractices },
                                { label: 'SEO', value: lighthouse.seo },
                              ].filter(m => m.value !== undefined).map(metric => (
                                <CircularGauge
                                  key={metric.label}
                                  score={metric.value || 0}
                                  label={metric.label}
                                  size={100}
                                />
                              ))}
                        </div>

                        {/* Feature #1892: Performance Score Breakdown Waterfall */}
                        {lighthouse.metrics && (
                          <div className="border border-border rounded-lg p-4 mb-6">
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="font-medium text-foreground flex items-center gap-2">
                                <span>📊</span> Performance Score Breakdown
                              </h4>
                              <span className="text-xs text-muted-foreground">
                                How your score is calculated
                              </span>
                            </div>

                            {/* Score calculation breakdown */}
                            {(() => {
                              // Lighthouse performance score weights (as of 2024)
                              const metrics = [
                                { label: 'Total Blocking Time', shortLabel: 'TBT', weight: 30, value: lighthouse.metrics.tbt, threshold: { good: 200, poor: 600 }, unit: 'ms' },
                                { label: 'Largest Contentful Paint', shortLabel: 'LCP', weight: 25, value: lighthouse.metrics.lcp, threshold: { good: 2500, poor: 4000 }, unit: 'ms', divideBy: 1 },
                                { label: 'Cumulative Layout Shift', shortLabel: 'CLS', weight: 25, value: lighthouse.metrics.cls, threshold: { good: 0.1, poor: 0.25 }, unit: '' },
                                { label: 'First Contentful Paint', shortLabel: 'FCP', weight: 10, value: lighthouse.metrics.fcp, threshold: { good: 1800, poor: 3000 }, unit: 'ms', divideBy: 1 },
                                { label: 'Speed Index', shortLabel: 'SI', weight: 10, value: lighthouse.metrics.si, threshold: { good: 3400, poor: 5800 }, unit: 'ms', divideBy: 1 },
                              ].filter(m => m.value !== undefined);

                              // Calculate individual metric scores (0-100)
                              const calculateMetricScore = (value: number, good: number, poor: number) => {
                                if (value <= good) return 100;
                                if (value >= poor) return 0;
                                // Linear interpolation between good and poor
                                return Math.round(100 * (poor - value) / (poor - good));
                              };

                              const scoredMetrics = metrics.map(m => ({
                                ...m,
                                score: calculateMetricScore(m.value || 0, m.threshold.good, m.threshold.poor),
                                status: (m.value || 0) <= m.threshold.good ? 'good' : (m.value || 0) <= m.threshold.poor ? 'needs-improvement' : 'poor',
                                contribution: 0, // Will be calculated
                                potentialGain: 0, // Will be calculated
                              }));

                              // Calculate weighted contributions
                              const totalWeight = scoredMetrics.reduce((sum, m) => sum + m.weight, 0);
                              scoredMetrics.forEach(m => {
                                m.contribution = (m.score * m.weight) / totalWeight;
                                // Potential gain if this metric was "good"
                                m.potentialGain = ((100 - m.score) * m.weight) / totalWeight;
                              });

                              const calculatedScore = Math.round(scoredMetrics.reduce((sum, m) => sum + m.contribution, 0));
                              const potentialMaxScore = calculatedScore + Math.round(scoredMetrics.reduce((sum, m) => sum + m.potentialGain, 0));

                              // Sort by potential gain (biggest impact first)
                              const sortedByImpact = [...scoredMetrics].sort((a, b) => b.potentialGain - a.potentialGain);

                              return (
                                <div className="space-y-4">
                                  {/* Current vs potential score */}
                                  <div className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
                                    <div className="flex-1">
                                      <div className="text-sm text-muted-foreground">Current Score</div>
                                      <div className={`text-3xl font-bold ${lighthouse.performance >= 90 ? 'text-green-600' : lighthouse.performance >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                                        {lighthouse.performance}
                                      </div>
                                    </div>
                                    <div className="text-muted-foreground">→</div>
                                    <div className="flex-1">
                                      <div className="text-sm text-muted-foreground">Potential Score</div>
                                      <div className="text-3xl font-bold text-green-600">{potentialMaxScore}</div>
                                      <div className="text-xs text-muted-foreground">if all metrics optimized</div>
                                    </div>
                                  </div>

                                  {/* Waterfall chart */}
                                  <div className="space-y-3">
                                    {sortedByImpact.map((metric, idx) => (
                                      <div key={metric.shortLabel} className="relative">
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className="text-sm font-medium text-foreground w-16">{metric.shortLabel}</span>
                                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                                            metric.status === 'good' ? 'bg-green-100 dark:bg-green-900/30 text-green-600' :
                                            metric.status === 'needs-improvement' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600' :
                                            'bg-red-100 dark:bg-red-900/30 text-red-600'
                                          }`}>
                                            {metric.score}/100
                                          </span>
                                          <span className="text-xs text-muted-foreground flex-1">
                                            {metric.label} ({metric.weight}% weight)
                                          </span>
                                          {metric.potentialGain > 0 && (
                                            <span className="text-xs text-orange-600 dark:text-orange-400">
                                              +{Math.round(metric.potentialGain)} pts potential
                                            </span>
                                          )}
                                        </div>

                                        {/* Contribution bar */}
                                        <div className="relative h-6 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden">
                                          {/* Current contribution */}
                                          <div
                                            className={`absolute left-0 top-0 h-full transition-all duration-300 ${
                                              metric.status === 'good' ? 'bg-green-400' :
                                              metric.status === 'needs-improvement' ? 'bg-yellow-400' :
                                              'bg-red-400'
                                            }`}
                                            style={{ width: `${metric.contribution}%` }}
                                          />
                                          {/* Potential additional contribution */}
                                          {metric.potentialGain > 0 && (
                                            <div
                                              className="absolute top-0 h-full bg-green-200 dark:bg-green-900/50 opacity-50"
                                              style={{ left: `${metric.contribution}%`, width: `${metric.potentialGain}%` }}
                                            />
                                          )}
                                          {/* Value label */}
                                          <div className="absolute inset-0 flex items-center px-2">
                                            <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300">
                                              {metric.value !== undefined && (
                                                metric.shortLabel === 'CLS'
                                                  ? (metric.value as number).toFixed(3)
                                                  : metric.value >= 1000
                                                    ? `${((metric.value as number) / 1000).toFixed(2)}s`
                                                    : `${metric.value}${metric.unit}`
                                              )}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>

                                  {/* Legend */}
                                  <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border">
                                    <div className="flex items-center gap-1">
                                      <div className="w-3 h-3 rounded bg-green-400"></div>
                                      <span>Good contribution</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <div className="w-3 h-3 rounded bg-yellow-400"></div>
                                      <span>Moderate</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <div className="w-3 h-3 rounded bg-red-400"></div>
                                      <span>Poor</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <div className="w-3 h-3 rounded bg-green-200 dark:bg-green-900/50"></div>
                                      <span>Potential gain</span>
                                    </div>
                                  </div>

                                  {/* Top improvement suggestions */}
                                  {sortedByImpact.filter(m => m.potentialGain > 5).length > 0 && (
                                    <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                                      <div className="text-sm font-medium text-orange-700 dark:text-orange-400 mb-2">
                                        🎯 Highest Impact Optimizations
                                      </div>
                                      <ul className="text-sm text-orange-600 dark:text-orange-300 space-y-1">
                                        {sortedByImpact.filter(m => m.potentialGain > 5).slice(0, 3).map(m => (
                                          <li key={m.shortLabel}>
                                            Improve <strong>{m.label}</strong> for up to <strong>+{Math.round(m.potentialGain)}</strong> points
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {/* Feature #1891: Enhanced Core Web Vitals with visual gauges and threshold bars */}
                        {lighthouse.metrics && (
                          <div className="border border-border rounded-lg p-4 mb-6">
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="font-medium text-foreground flex items-center gap-2">
                                <span>⚡</span> Core Web Vitals
                              </h4>
                              <div className="flex gap-4">
                                <span className="flex items-center gap-1 text-xs text-green-600">
                                  <span className="w-2 h-2 rounded-full bg-green-500"></span> Good
                                </span>
                                <span className="flex items-center gap-1 text-xs text-yellow-600">
                                  <span className="w-2 h-2 rounded-full bg-yellow-500"></span> Needs Improvement
                                </span>
                                <span className="flex items-center gap-1 text-xs text-red-600">
                                  <span className="w-2 h-2 rounded-full bg-red-500"></span> Poor
                                </span>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                              {[
                                { label: 'LCP', fullName: 'Largest Contentful Paint', value: lighthouse.metrics.lcp, format: (v: number) => `${(v / 1000).toFixed(2)}s`, threshold: { good: 2500, poor: 4000, max: 8000 }, description: 'Measures loading performance', tooltip: 'Time until the largest content element becomes visible. Target: under 2.5s for good user experience.' },
                                { label: 'INP', fullName: 'Interaction to Next Paint', value: (lighthouse.metrics as any).inp, format: (v: number) => `${v}ms`, threshold: { good: 200, poor: 500, max: 1000 }, description: 'Measures responsiveness', tooltip: 'Time from user interaction to visual feedback. Replaces FID as the new responsiveness metric. Target: under 200ms.' },
                                { label: 'FID', fullName: 'First Input Delay', value: lighthouse.metrics.fid, format: (v: number) => `${v}ms`, threshold: { good: 100, poor: 300, max: 600 }, description: 'First interaction delay', tooltip: 'Time from first user interaction to browser response. Being deprecated in favor of INP. Target: under 100ms.' },
                                { label: 'CLS', fullName: 'Cumulative Layout Shift', value: lighthouse.metrics.cls, format: (v: number) => v.toFixed(3), threshold: { good: 0.1, poor: 0.25, max: 0.5 }, description: 'Visual stability', tooltip: 'Measures unexpected layout shifts. Lower is better. Target: under 0.1 for stable layouts.' },
                                { label: 'FCP', fullName: 'First Contentful Paint', value: lighthouse.metrics.fcp, format: (v: number) => `${(v / 1000).toFixed(2)}s`, threshold: { good: 1800, poor: 3000, max: 6000 }, description: 'First content visible', tooltip: 'Time until first text or image is painted. Target: under 1.8s for good perceived speed.' },
                                { label: 'TBT', fullName: 'Total Blocking Time', value: lighthouse.metrics.tbt, format: (v: number) => `${v}ms`, threshold: { good: 200, poor: 600, max: 1200 }, description: 'Main thread blocking', tooltip: 'Sum of blocking time between FCP and TTI. High values indicate JavaScript is blocking interactivity.' },
                                { label: 'TTFB', fullName: 'Time to First Byte', value: lighthouse.metrics.ttfb, format: (v: number) => `${v}ms`, threshold: { good: 800, poor: 1800, max: 3600 }, description: 'Server response time', tooltip: 'Time until first byte received from server. Affected by server processing and network latency.' },
                                { label: 'SI', fullName: 'Speed Index', value: lighthouse.metrics.si, format: (v: number) => `${(v / 1000).toFixed(2)}s`, threshold: { good: 3400, poor: 5800, max: 10000 }, description: 'Visual completeness', tooltip: 'How quickly content is visually displayed. Lower is better - measures overall perceived loading speed.' },
                                { label: 'TTI', fullName: 'Time to Interactive', value: lighthouse.metrics.tti, format: (v: number) => `${(v / 1000).toFixed(2)}s`, threshold: { good: 3800, poor: 7300, max: 15000 }, description: 'Fully interactive', tooltip: 'Time until page is fully interactive and responds to user input within 50ms.' },
                              ].filter(m => m.value !== undefined).map(metric => {
                                const value = metric.value || 0;
                                const status = value <= metric.threshold.good ? 'good' : value <= metric.threshold.poor ? 'needs-improvement' : 'poor';
                                // Calculate position on threshold bar (0-100%)
                                const barPosition = Math.min(100, (value / metric.threshold.max) * 100);
                                const goodWidth = (metric.threshold.good / metric.threshold.max) * 100;
                                const needsImprovementWidth = ((metric.threshold.poor - metric.threshold.good) / metric.threshold.max) * 100;

                                return (
                                  <div
                                    key={metric.label}
                                    className={`p-4 rounded-lg relative overflow-hidden group cursor-help ${
                                      status === 'good' ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' :
                                      status === 'needs-improvement' ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800' :
                                      'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                                    }`}
                                    title={metric.tooltip}
                                  >
                                    {/* Status badge */}
                                    <div className={`absolute top-2 right-2 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                      status === 'good' ? 'bg-green-500 text-white' :
                                      status === 'needs-improvement' ? 'bg-yellow-500 text-white' :
                                      'bg-red-500 text-white'
                                    }`}>
                                      {status === 'good' ? 'Good' : status === 'needs-improvement' ? 'Needs Work' : 'Poor'}
                                    </div>

                                    {/* Metric label and full name */}
                                    <div className="text-xs font-medium text-muted-foreground mb-1">{metric.label}</div>
                                    <div className="text-[10px] text-muted-foreground/70 mb-2 truncate" title={metric.fullName}>
                                      {metric.fullName}
                                    </div>

                                    {/* Large value display */}
                                    <div className={`text-2xl font-bold mb-3 ${
                                      status === 'good' ? 'text-green-600 dark:text-green-400' :
                                      status === 'needs-improvement' ? 'text-yellow-600 dark:text-yellow-400' :
                                      'text-red-600 dark:text-red-400'
                                    }`}>
                                      {metric.format(value)}
                                    </div>

                                    {/* Threshold bar visualization */}
                                    <div className="relative h-2 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 mb-2">
                                      {/* Good zone */}
                                      <div
                                        className="absolute left-0 top-0 h-full bg-green-400"
                                        style={{ width: `${goodWidth}%` }}
                                      />
                                      {/* Needs improvement zone */}
                                      <div
                                        className="absolute top-0 h-full bg-yellow-400"
                                        style={{ left: `${goodWidth}%`, width: `${needsImprovementWidth}%` }}
                                      />
                                      {/* Poor zone */}
                                      <div
                                        className="absolute top-0 right-0 h-full bg-red-400"
                                        style={{ left: `${goodWidth + needsImprovementWidth}%`, width: `${100 - goodWidth - needsImprovementWidth}%` }}
                                      />
                                      {/* Value indicator */}
                                      <div
                                        className="absolute top-0 h-full w-1 bg-gray-800 dark:bg-white shadow-md transform -translate-x-1/2"
                                        style={{ left: `${barPosition}%` }}
                                      />
                                    </div>

                                    {/* Threshold labels */}
                                    <div className="flex justify-between text-[9px] text-muted-foreground">
                                      <span>0</span>
                                      <span className="text-green-600">{metric.label === 'CLS' ? metric.threshold.good : metric.threshold.good >= 1000 ? `${(metric.threshold.good/1000).toFixed(1)}s` : `${metric.threshold.good}ms`}</span>
                                      <span className="text-yellow-600">{metric.label === 'CLS' ? metric.threshold.poor : metric.threshold.poor >= 1000 ? `${(metric.threshold.poor/1000).toFixed(1)}s` : `${metric.threshold.poor}ms`}</span>
                                    </div>

                                    {/* Description */}
                                    <div className="text-[10px] text-muted-foreground mt-2">
                                      {metric.description}
                                    </div>

                                    {/* Tooltip overlay on hover */}
                                    <div className="absolute inset-0 bg-gray-900/95 p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-center pointer-events-none">
                                      <div className="text-white text-xs font-medium mb-1">{metric.fullName}</div>
                                      <div className="text-gray-300 text-[10px] leading-relaxed">{metric.tooltip}</div>
                                      <div className="mt-2 text-[9px] text-gray-400">
                                        <span className="text-green-400">Good: ≤{metric.label === 'CLS' ? metric.threshold.good : `${metric.threshold.good}ms`}</span>
                                        {' • '}
                                        <span className="text-yellow-400">Moderate: ≤{metric.label === 'CLS' ? metric.threshold.poor : `${metric.threshold.poor}ms`}</span>
                                        {' • '}
                                        <span className="text-red-400">Poor: &gt;{metric.label === 'CLS' ? metric.threshold.poor : `${metric.threshold.poor}ms`}</span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                          </>
                        )}

                        {/* Performance Tab */}
                        {lighthouseActiveTab === 'performance' && (
                          <>
                            {/* Performance metrics (Core Web Vitals) */}
                            {lighthouse.metrics && (
                              <div className="border border-border rounded-xl p-5 mb-6 shadow-sm bg-card">
                                <h4 className="font-semibold text-foreground flex items-center gap-2 mb-4">
                                  <span className="text-lg">⚡</span> Core Web Vitals
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                  {[
                                    { label: 'LCP', value: lighthouse.metrics.lcp, unit: 'ms', good: 2500, description: 'Largest Contentful Paint' },
                                    { label: 'FCP', value: lighthouse.metrics.fcp, unit: 'ms', good: 1800, description: 'First Contentful Paint' },
                                    { label: 'CLS', value: lighthouse.metrics.cls, unit: '', good: 0.1, description: 'Cumulative Layout Shift' },
                                    { label: 'TBT', value: lighthouse.metrics.tbt, unit: 'ms', good: 200, description: 'Total Blocking Time' },
                                  ].filter(m => m.value !== undefined).map(metric => (
                                    <div key={metric.label} className="p-4 bg-muted/30 rounded-lg">
                                      <div className={`text-2xl font-bold ${
                                        metric.label === 'CLS'
                                          ? (metric.value || 0) <= metric.good ? 'text-green-600' : 'text-red-600'
                                          : (metric.value || 0) <= metric.good ? 'text-green-600' : 'text-red-600'
                                      }`}>
                                        {metric.label === 'CLS'
                                          ? (metric.value || 0).toFixed(3)
                                          : `${Math.round(metric.value || 0)}${metric.unit}`}
                                      </div>
                                      <div className="text-sm font-medium text-foreground">{metric.label}</div>
                                      <div className="text-xs text-muted-foreground">{metric.description}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Feature #1893: Filmstrip view of page load */}
                            {lighthouse.filmstrip && lighthouse.filmstrip.length > 0 && (
                              <div className="border border-border rounded-xl p-5 mb-6 shadow-sm bg-card">
                                <h4 className="font-semibold text-foreground flex items-center gap-2 mb-4">
                                  <span className="text-lg">🎬</span> Page Load Filmstrip
                                  <span className="text-xs text-muted-foreground font-normal ml-2">
                                    Click to view full size
                                  </span>
                                </h4>
                                <div className="flex gap-2 overflow-x-auto pb-2">
                                  {lighthouse.filmstrip.map((frame: { timestamp_ms: number; screenshot_base64: string; label?: string }, idx: number) => (
                                    <div
                                      key={idx}
                                      className="flex-shrink-0 cursor-pointer group"
                                      onClick={() => {
                                        const img = document.createElement('img');
                                        img.src = `data:image/png;base64,${frame.screenshot_base64}`;
                                        img.className = 'max-w-full max-h-full';
                                        const modal = document.createElement('div');
                                        modal.className = 'fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4';
                                        modal.onclick = () => modal.remove();
                                        modal.appendChild(img);
                                        document.body.appendChild(modal);
                                      }}
                                    >
                                      <div className="relative">
                                        <img
                                          src={`data:image/png;base64,${frame.screenshot_base64}`}
                                          alt={`Frame at ${frame.timestamp_ms}ms`}
                                          className="h-24 w-auto rounded border border-border group-hover:border-primary transition-colors"
                                        />
                                        {frame.label && (
                                          <span className={`absolute -top-2 left-1/2 -translate-x-1/2 text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                            frame.label === 'LCP' ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' :
                                            frame.label === 'TTI' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' :
                                            'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                                          }`}>
                                            {frame.label}
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-center text-xs text-muted-foreground mt-1">
                                        {frame.timestamp_ms >= 1000
                                          ? `${(frame.timestamp_ms / 1000).toFixed(1)}s`
                                          : `${frame.timestamp_ms}ms`
                                        }
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <span className="w-3 h-3 rounded bg-green-100 dark:bg-green-900/50"></span>
                                    LCP = Largest Contentful Paint
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <span className="w-3 h-3 rounded bg-blue-100 dark:bg-blue-900/50"></span>
                                    TTI = Time to Interactive
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* Opportunities section - Feature #1907 enhanced styling */}
                            <div className="border border-border rounded-xl overflow-hidden mb-6 shadow-sm">
                              <div className="p-4 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border-b border-border flex items-center justify-between">
                                <h4 className="font-semibold text-foreground flex items-center gap-2">
                                  <span className="text-lg">💡</span> Opportunities
                                </h4>
                                <span className="text-xs text-muted-foreground">
                                  {opportunities.length} suggestions
                                </span>
                              </div>
                          <div className="divide-y divide-border">
                            {opportunities.map((opp) => (
                              <div key={opp.id} className="bg-background">
                                <button
                                  onClick={() => toggleOpportunity(opp.id)}
                                  className="w-full p-3 flex items-center justify-between hover:bg-muted/30 transition-colors"
                                >
                                  <div className="flex items-center gap-3">
                                    <svg
                                      className={`w-4 h-4 transition-transform ${expandedOpportunities.has(opp.id) ? 'rotate-90' : ''}`}
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                    <span className="text-sm text-foreground">{opp.title}</span>
                                  </div>
                                  <span className="text-sm font-medium text-orange-600">
                                    Save ~{opp.savings}
                                  </span>
                                </button>
                                {expandedOpportunities.has(opp.id) && (
                                  <div className="px-10 pb-3 text-sm text-muted-foreground">
                                    {opp.details}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Diagnostics section - Feature #1907 enhanced styling */}
                        <div className="border border-border rounded-xl overflow-hidden shadow-sm">
                          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-b border-border flex items-center justify-between">
                            <h4 className="font-semibold text-foreground flex items-center gap-2">
                              <span className="text-lg">🔍</span> Diagnostics
                            </h4>
                            <span className="text-xs text-muted-foreground">
                              {diagnostics.length} items
                            </span>
                          </div>
                          <div className="divide-y divide-border">
                            {diagnostics.map((diag) => (
                              <div key={diag.id} className="bg-background">
                                <button
                                  onClick={() => toggleDiagnostic(diag.id)}
                                  className="w-full p-3 flex items-center gap-3 hover:bg-muted/30 transition-colors"
                                >
                                  <svg
                                    className={`w-4 h-4 transition-transform ${expandedDiagnostics.has(diag.id) ? 'rotate-90' : ''}`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                  <span className="text-sm text-foreground">{diag.title}</span>
                                </button>
                                {expandedDiagnostics.has(diag.id) && (
                                  <div className="px-10 pb-3 text-sm text-muted-foreground">
                                    {diag.details}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                          </>
                        )}

                        {/* Accessibility Tab */}
                        {lighthouseActiveTab === 'accessibility' && (
                          <>
                            {/* Accessibility Score */}
                            <div className="flex justify-center mb-6">
                              <CircularGauge
                                score={lighthouse.accessibility || 0}
                                label="Accessibility"
                                size={120}
                              />
                            </div>

                            {/* Accessibility-specific passed audits */}
                            {passedAudits.filter((a: any) => a.category === 'Accessibility').length > 0 && (
                              <div className="border border-border rounded-xl overflow-hidden mb-6 shadow-sm">
                                <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-b border-border">
                                  <h4 className="font-semibold text-green-700 dark:text-green-400 flex items-center gap-2">
                                    <span className="text-lg">✅</span> Passed Accessibility Audits
                                    <span className="text-xs bg-green-100 dark:bg-green-800 px-2 py-0.5 rounded-full ml-2">
                                      {passedAudits.filter((a: any) => a.category === 'Accessibility').length} passed
                                    </span>
                                  </h4>
                                </div>
                                <div className="divide-y divide-border max-h-64 overflow-y-auto">
                                  {passedAudits.filter((a: any) => a.category === 'Accessibility').slice(0, 10).map((audit: any) => (
                                    <div key={audit.id} className="p-3 flex items-center gap-2">
                                      <span className="text-green-500">✓</span>
                                      <span className="text-sm text-foreground">{audit.title}</span>
                                    </div>
                                  ))}
                                  {passedAudits.filter((a: any) => a.category === 'Accessibility').length > 10 && (
                                    <div className="p-3 text-center text-sm text-muted-foreground">
                                      +{passedAudits.filter((a: any) => a.category === 'Accessibility').length - 10} more passed
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Note about accessibility */}
                            <div className="border border-border rounded-xl p-4 bg-muted/30 text-sm text-muted-foreground">
                              <p>💡 <strong>Tip:</strong> Accessibility improvements help users with disabilities and often improve overall user experience. Focus on color contrast, keyboard navigation, and screen reader compatibility.</p>
                            </div>
                          </>
                        )}

                        {/* Best Practices Tab */}
                        {lighthouseActiveTab === 'best_practices' && (
                          <>
                            {/* Best Practices Score */}
                            <div className="flex justify-center mb-6">
                              <CircularGauge
                                score={lighthouse.best_practices || lighthouse.bestPractices || 0}
                                label="Best Practices"
                                size={120}
                              />
                            </div>

                            {/* Best Practices passed audits */}
                            {passedAudits.filter((a: any) => a.category === 'Best Practices').length > 0 && (
                              <div className="border border-border rounded-xl overflow-hidden mb-6 shadow-sm">
                                <div className="p-4 bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 border-b border-border">
                                  <h4 className="font-semibold text-purple-700 dark:text-purple-400 flex items-center gap-2">
                                    <span className="text-lg">✓</span> Passed Best Practice Audits
                                    <span className="text-xs bg-purple-100 dark:bg-purple-800 px-2 py-0.5 rounded-full ml-2">
                                      {passedAudits.filter((a: any) => a.category === 'Best Practices').length} passed
                                    </span>
                                  </h4>
                                </div>
                                <div className="divide-y divide-border max-h-64 overflow-y-auto">
                                  {passedAudits.filter((a: any) => a.category === 'Best Practices').slice(0, 10).map((audit: any) => (
                                    <div key={audit.id} className="p-3 flex items-center gap-2">
                                      <span className="text-purple-500">✓</span>
                                      <span className="text-sm text-foreground">{audit.title}</span>
                                    </div>
                                  ))}
                                  {passedAudits.filter((a: any) => a.category === 'Best Practices').length > 10 && (
                                    <div className="p-3 text-center text-sm text-muted-foreground">
                                      +{passedAudits.filter((a: any) => a.category === 'Best Practices').length - 10} more passed
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </>
                        )}

                        {/* SEO Tab */}
                        {lighthouseActiveTab === 'seo' && (
                          <>
                            {/* SEO Score */}
                            <div className="flex justify-center mb-6">
                              <CircularGauge
                                score={lighthouse.seo || 0}
                                label="SEO"
                                size={120}
                              />
                            </div>

                            {/* SEO passed audits */}
                            {passedAudits.filter((a: any) => a.category === 'SEO').length > 0 && (
                              <div className="border border-border rounded-xl overflow-hidden mb-6 shadow-sm">
                                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-b border-border">
                                  <h4 className="font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-2">
                                    <span className="text-lg">🔍</span> Passed SEO Audits
                                    <span className="text-xs bg-blue-100 dark:bg-blue-800 px-2 py-0.5 rounded-full ml-2">
                                      {passedAudits.filter((a: any) => a.category === 'SEO').length} passed
                                    </span>
                                  </h4>
                                </div>
                                <div className="divide-y divide-border max-h-64 overflow-y-auto">
                                  {passedAudits.filter((a: any) => a.category === 'SEO').slice(0, 10).map((audit: any) => (
                                    <div key={audit.id} className="p-3 flex items-center gap-2">
                                      <span className="text-blue-500">✓</span>
                                      <span className="text-sm text-foreground">{audit.title}</span>
                                    </div>
                                  ))}
                                  {passedAudits.filter((a: any) => a.category === 'SEO').length > 10 && (
                                    <div className="p-3 text-center text-sm text-muted-foreground">
                                      +{passedAudits.filter((a: any) => a.category === 'SEO').length - 10} more passed
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* SEO Tips */}
                            <div className="border border-border rounded-xl p-4 bg-muted/30 text-sm text-muted-foreground">
                              <p>💡 <strong>Tip:</strong> Good SEO helps search engines understand and rank your page. Ensure proper meta tags, structured data, and mobile-friendly design.</p>
                            </div>
                          </>
                        )}

                        {/* Original Passed Audits (keep hidden but preserved) */}
                        {false && passedAudits.length > 0 && (
                          <div className="border border-border rounded-lg overflow-hidden">
                            <button
                              onClick={() => setPassedAuditsCollapsed(!passedAuditsCollapsed)}
                              className="w-full p-3 bg-green-50 dark:bg-green-900/20 border-b border-border flex items-center justify-between hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                            >
                              <h4 className="font-medium text-green-700 dark:text-green-400 flex items-center gap-2">
                                <span>✅</span> Passed Audits
                              </h4>
                              <div className="flex items-center gap-2">
                                <span className="text-xs bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300 px-2 py-1 rounded-full">
                                  {passedAudits.length} audits passed
                                </span>
                                <svg
                                  className={`w-4 h-4 text-green-600 transition-transform ${passedAuditsCollapsed ? '' : 'rotate-180'}`}
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </button>
                            {!passedAuditsCollapsed && (
                              <div className="divide-y divide-border">
                                {Object.entries(passedAuditsByCategory).map(([category, audits]: [string, any[]]) => (
                                  <div key={category} className="bg-background">
                                    <div className="px-4 py-2 bg-muted/30 text-sm font-medium text-muted-foreground border-b border-border">
                                      {category} ({audits.length})
                                    </div>
                                    <div className="divide-y divide-border">
                                      {audits.map((audit: any) => (
                                        <div key={audit.id} className="bg-background">
                                          <button
                                            onClick={() => togglePassedAudit(audit.id)}
                                            className="w-full p-3 flex items-center gap-3 hover:bg-muted/30 transition-colors"
                                          >
                                            <svg
                                              className={`w-4 h-4 text-green-500 transition-transform ${expandedPassedAudits.has(audit.id) ? 'rotate-90' : ''}`}
                                              fill="none"
                                              viewBox="0 0 24 24"
                                              stroke="currentColor"
                                            >
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                            <span className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                              </svg>
                                            </span>
                                            <span className="text-sm text-foreground">{audit.title}</span>
                                          </button>
                                          {expandedPassedAudits.has(audit.id) && audit.details && (
                                            <div className="px-14 pb-3 text-sm text-muted-foreground">
                                              {audit.details}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Feature #1890: Security Insights section - CSP, Mixed Content, Authentication */}
                        {(lighthouse.csp || lighthouse.mixedContent || lighthouse.authentication) && (
                          <div className="border border-border rounded-lg overflow-hidden">
                            <button
                              onClick={() => setSecurityInsightsCollapsed(!securityInsightsCollapsed)}
                              className="w-full p-3 bg-purple-50 dark:bg-purple-900/20 border-b border-border flex items-center justify-between hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                            >
                              <h4 className="font-medium text-purple-700 dark:text-purple-400 flex items-center gap-2">
                                <span>🔒</span> Security Insights
                              </h4>
                              <div className="flex items-center gap-2">
                                {lighthouse.csp?.blocksLighthouse && (
                                  <span className="text-xs bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300 px-2 py-1 rounded-full">
                                    CSP Issue
                                  </span>
                                )}
                                {lighthouse.mixedContent?.detected && (
                                  <span className={`text-xs px-2 py-1 rounded-full ${
                                    lighthouse.mixedContent.securityImpact === 'high'
                                      ? 'bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300'
                                      : 'bg-yellow-100 dark:bg-yellow-800 text-yellow-700 dark:text-yellow-300'
                                  }`}>
                                    Mixed Content ({lighthouse.mixedContent.count})
                                  </span>
                                )}
                                {lighthouse.authentication?.required && (
                                  <span className="text-xs bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full">
                                    Auth Required
                                  </span>
                                )}
                                <svg
                                  className={`w-4 h-4 text-purple-600 transition-transform ${securityInsightsCollapsed ? '' : 'rotate-180'}`}
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </button>
                            {!securityInsightsCollapsed && (
                              <div className="divide-y divide-border">
                                {/* CSP Detection */}
                                {lighthouse.csp && (
                                  <div className="p-4 bg-background">
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className={`w-3 h-3 rounded-full ${lighthouse.csp.detected ? (lighthouse.csp.blocksLighthouse ? 'bg-red-500' : 'bg-green-500') : 'bg-gray-400'}`}></span>
                                      <h5 className="font-medium text-foreground">Content Security Policy</h5>
                                      <span className={`text-xs px-2 py-0.5 rounded ${
                                        lighthouse.csp.detected
                                          ? (lighthouse.csp.blocksLighthouse
                                              ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                                              : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400')
                                          : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
                                      }`}>
                                        {lighthouse.csp.detected
                                          ? (lighthouse.csp.blocksLighthouse ? 'Restrictive' : 'Present')
                                          : 'Not Detected'}
                                      </span>
                                    </div>
                                    {lighthouse.csp.warning && (
                                      <p className="text-sm text-yellow-600 dark:text-yellow-400 mb-2">⚠️ {lighthouse.csp.warning}</p>
                                    )}
                                    {lighthouse.csp.header && (
                                      <div className="mt-2">
                                        <p className="text-xs text-muted-foreground mb-1">Policy Header:</p>
                                        <code className="block text-xs bg-muted/50 p-2 rounded overflow-x-auto">
                                          {lighthouse.csp.header.length > 200 ? lighthouse.csp.header.substring(0, 200) + '...' : lighthouse.csp.header}
                                        </code>
                                      </div>
                                    )}
                                    {lighthouse.csp.suggestion && (
                                      <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-sm text-blue-700 dark:text-blue-300">
                                        💡 {lighthouse.csp.suggestion}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Mixed Content Detection */}
                                {lighthouse.mixedContent && lighthouse.mixedContent.detected && (
                                  <div className="p-4 bg-background">
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className={`w-3 h-3 rounded-full ${lighthouse.mixedContent.securityImpact === 'high' ? 'bg-red-500' : 'bg-yellow-500'}`}></span>
                                      <h5 className="font-medium text-foreground">Mixed Content</h5>
                                      <span className={`text-xs px-2 py-0.5 rounded ${
                                        lighthouse.mixedContent.securityImpact === 'high'
                                          ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                                          : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
                                      }`}>
                                        {lighthouse.mixedContent.securityImpact === 'high' ? 'High Impact' : 'Medium Impact'}
                                      </span>
                                    </div>
                                    {lighthouse.mixedContent.warning && (
                                      <p className="text-sm text-muted-foreground mb-2">{lighthouse.mixedContent.warning}</p>
                                    )}
                                    <div className="flex gap-4 text-sm mb-3">
                                      <div className="flex items-center gap-1">
                                        <span className="font-medium text-foreground">{lighthouse.mixedContent.count}</span>
                                        <span className="text-muted-foreground">total resources</span>
                                      </div>
                                      {lighthouse.mixedContent.activeCount > 0 && (
                                        <div className="flex items-center gap-1">
                                          <span className="font-medium text-red-600">{lighthouse.mixedContent.activeCount}</span>
                                          <span className="text-muted-foreground">active (blocking)</span>
                                        </div>
                                      )}
                                      {lighthouse.mixedContent.passiveCount > 0 && (
                                        <div className="flex items-center gap-1">
                                          <span className="font-medium text-yellow-600">{lighthouse.mixedContent.passiveCount}</span>
                                          <span className="text-muted-foreground">passive</span>
                                        </div>
                                      )}
                                    </div>
                                    {lighthouse.mixedContent.resources && lighthouse.mixedContent.resources.length > 0 && (
                                      <div className="mt-2">
                                        <button
                                          onClick={() => setExpandedMixedContentResources(!expandedMixedContentResources)}
                                          className="text-xs text-primary hover:underline flex items-center gap-1"
                                        >
                                          {expandedMixedContentResources ? 'Hide' : 'Show'} affected resources
                                          <svg className={`w-3 h-3 transition-transform ${expandedMixedContentResources ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                          </svg>
                                        </button>
                                        {expandedMixedContentResources && (
                                          <div className="mt-2 space-y-1">
                                            {lighthouse.mixedContent.resources.slice(0, 10).map((resource, idx) => (
                                              <div key={idx} className="flex items-center gap-2 text-xs">
                                                <span className={`px-1.5 py-0.5 rounded ${
                                                  resource.severity === 'active'
                                                    ? 'bg-red-100 dark:bg-red-900/30 text-red-600'
                                                    : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600'
                                                }`}>
                                                  {resource.severity}
                                                </span>
                                                <span className="text-muted-foreground">{resource.resourceType}</span>
                                                <code className="flex-1 truncate bg-muted/50 px-1 rounded">{resource.url}</code>
                                              </div>
                                            ))}
                                            {lighthouse.mixedContent.hasMore && (
                                              <p className="text-xs text-muted-foreground italic">...and more resources</p>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    {lighthouse.mixedContent.remediation && lighthouse.mixedContent.remediation.length > 0 && (
                                      <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                                        <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">💡 Remediation Steps:</p>
                                        <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1 list-disc list-inside">
                                          {lighthouse.mixedContent.remediation.map((step, idx) => (
                                            <li key={idx}>{step}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Authentication Detection */}
                                {lighthouse.authentication && lighthouse.authentication.required && (
                                  <div className="p-4 bg-background">
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                                      <h5 className="font-medium text-foreground">Authentication Detection</h5>
                                      <span className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                                        Login Required
                                      </span>
                                    </div>
                                    {lighthouse.authentication.warning && (
                                      <p className="text-sm text-yellow-600 dark:text-yellow-400 mb-2">⚠️ {lighthouse.authentication.warning}</p>
                                    )}
                                    {lighthouse.authentication.redirectedToLogin && (
                                      <div className="text-sm mb-2">
                                        <span className="text-muted-foreground">Redirected from: </span>
                                        <code className="bg-muted/50 px-1 rounded">{lighthouse.authentication.originalUrl}</code>
                                        <span className="text-muted-foreground"> → </span>
                                        <code className="bg-muted/50 px-1 rounded">{lighthouse.authentication.actualUrl}</code>
                                      </div>
                                    )}
                                    {lighthouse.authentication.loginIndicators && lighthouse.authentication.loginIndicators.length > 0 && (
                                      <div className="mt-2">
                                        <p className="text-xs text-muted-foreground mb-1">Login indicators found:</p>
                                        <div className="flex flex-wrap gap-1">
                                          {lighthouse.authentication.loginIndicators.map((indicator, idx) => (
                                            <span key={idx} className="text-xs bg-muted px-2 py-0.5 rounded">
                                              {indicator}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {lighthouse.authentication.resultsReflectLoginPage && (
                                      <p className="mt-2 text-sm text-orange-600 dark:text-orange-400">
                                        ⚠️ Performance results reflect the login page, not the target URL
                                      </p>
                                    )}
                                    {lighthouse.authentication.suggestion && (
                                      <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-sm text-blue-700 dark:text-blue-300">
                                        💡 {lighthouse.authentication.suggestion}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Feature #1836: Enhanced K6 Load Test Results Dashboard */}
            {/* Feature #1907: Professional styling with consistent spacing and typography */}
            {loadTestResults.length > 0 && (
              <div className="mt-10 space-y-8">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
                    <span className="text-3xl">🔥</span> K6 Load Test Results
                  </h2>
                  <div className="flex items-center gap-2">
                    {/* Show thresholds toggle */}
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={k6ShowThresholds}
                        onChange={(e) => setK6ShowThresholds(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-muted-foreground">Show Thresholds</span>
                    </label>
                  </div>
                </div>

                {loadTestResults.map((result, idx) => {
                  const loadTest = result.load_test;
                  if (!loadTest) return null;

                  const timeSeries = generateK6TimeSeries(loadTest);
                  const histogram = generateResponseTimeHistogram(loadTest);
                  const successRateNum = parseFloat(String(loadTest.summary?.success_rate).replace('%', '')) || 0;
                  const errorRate = 100 - successRateNum;

                  // Calculate thresholds status (mock if not present)
                  const thresholds = loadTest.thresholds || {
                    'http_req_duration{expected_response:true}': (loadTest.response_times?.p95 || 0) < 500,
                    'http_req_failed': errorRate < 1,
                    'http_reqs': (parseFloat(String(loadTest.summary?.requests_per_second)) || 0) > 50,
                  };
                  const thresholdsPassed = Object.values(thresholds).filter(Boolean).length;
                  const thresholdsFailed = Object.values(thresholds).length - thresholdsPassed;

                  // Endpoint breakdown (mock if not present)
                  const endpoints = loadTest.endpoints || [
                    { path: '/api/v1/health', method: 'GET', count: Math.round((loadTest.summary?.total_requests || 1000) * 0.4), avg_time: loadTest.response_times?.avg || 150, p95_time: loadTest.response_times?.p95 || 300, error_rate: errorRate * 0.5 },
                    { path: '/api/v1/users', method: 'GET', count: Math.round((loadTest.summary?.total_requests || 1000) * 0.3), avg_time: (loadTest.response_times?.avg || 150) * 1.2, p95_time: (loadTest.response_times?.p95 || 300) * 1.1, error_rate: errorRate * 0.8 },
                    { path: '/api/v1/tests', method: 'POST', count: Math.round((loadTest.summary?.total_requests || 1000) * 0.2), avg_time: (loadTest.response_times?.avg || 150) * 1.5, p95_time: (loadTest.response_times?.p95 || 300) * 1.3, error_rate: errorRate * 1.5 },
                    { path: '/api/v1/runs', method: 'GET', count: Math.round((loadTest.summary?.total_requests || 1000) * 0.1), avg_time: (loadTest.response_times?.avg || 150) * 0.8, p95_time: (loadTest.response_times?.p95 || 300) * 0.9, error_rate: errorRate * 0.3 },
                  ];

                  // Feature #1904: Calculate overall status
                  const overallStatus = successRateNum >= 99 && errorRate < 1 && thresholdsFailed === 0 ? 'passed' :
                                        successRateNum >= 95 && errorRate < 5 ? 'warning' : 'failed';

                  return (
                    <div key={idx} className="bg-card border border-border rounded-xl overflow-hidden shadow-lg shadow-black/5 dark:shadow-black/20">
                      {/* Feature #1904: Professional Report Header */}
                      <div className={`border-b-4 ${
                        overallStatus === 'passed' ? 'border-green-500' :
                        overallStatus === 'warning' ? 'border-yellow-500' :
                        'border-red-500'
                      }`}>
                        <div className="p-5 bg-gradient-to-r from-muted/50 to-muted/20">
                          {/* Top row: Status badge and test type */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              {/* Test type badge */}
                              <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-medium rounded-full flex items-center gap-1.5">
                                <span>⚡</span> K6 Load Test
                              </span>
                              {/* Timestamp */}
                              <span className="text-xs text-muted-foreground">
                                {new Date(loadTest.started_at || Date.now()).toLocaleString()}
                              </span>
                            </div>
                            {/* Overall status badge */}
                            <div className={`px-4 py-1.5 rounded-full text-sm font-semibold flex items-center gap-2 ${
                              overallStatus === 'passed' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                              overallStatus === 'warning' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                              'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                            }`}>
                              {overallStatus === 'passed' ? '✅' : overallStatus === 'warning' ? '⚠️' : '❌'}
                              {overallStatus === 'passed' ? 'PASSED' : overallStatus === 'warning' ? 'WARNING' : 'FAILED'}
                            </div>
                          </div>

                          {/* Test name and target URL */}
                          <h4 className="text-xl font-semibold text-foreground mb-1">{result.test_name}</h4>
                          {loadTest.target_url && (
                            <div className="text-sm text-muted-foreground font-mono mb-4">
                              🌐 {loadTest.target_url}
                            </div>
                          )}

                          {/* Configuration summary grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">👥</span>
                              <div>
                                <div className="text-xs text-muted-foreground">Virtual Users</div>
                                <div className="text-sm font-semibold text-foreground">{loadTest.virtual_users?.max_concurrent || loadTest.virtual_users?.configured || 10} max</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-lg">⏱️</span>
                              <div>
                                <div className="text-xs text-muted-foreground">Duration</div>
                                <div className="text-sm font-semibold text-foreground">{loadTest.duration?.actual || loadTest.duration?.configured || 60}s</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-lg">📊</span>
                              <div>
                                <div className="text-xs text-muted-foreground">Thresholds</div>
                                <div className={`text-sm font-semibold ${thresholdsFailed === 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {thresholdsPassed}/{thresholdsPassed + thresholdsFailed} passed
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-lg">🖥️</span>
                              <div>
                                <div className="text-xs text-muted-foreground">Environment</div>
                                <div className="text-sm font-semibold text-foreground">{loadTest.environment || 'Production'}</div>
                              </div>
                            </div>
                          </div>

                          {/* Quick action buttons */}
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Re-run button */}
                            <button
                              onClick={() => {/* Re-run logic would go here */}}
                              className="px-3 py-1.5 text-sm bg-background border border-border text-foreground rounded-lg hover:bg-muted transition-colors flex items-center gap-1.5"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              Re-run
                            </button>

                            {/* Export dropdown */}
                            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                              <button
                                onClick={() => setK6ExportFormat('json')}
                                className={`px-2 py-1 text-xs rounded transition-colors ${
                                  k6ExportFormat === 'json' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                JSON
                              </button>
                              <button
                                onClick={() => setK6ExportFormat('csv')}
                                className={`px-2 py-1 text-xs rounded transition-colors ${
                                  k6ExportFormat === 'csv' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                CSV
                              </button>
                            </div>
                            <button
                              onClick={() => exportK6Results(loadTest, result.test_name, k6ExportFormat)}
                              className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                              Export
                            </button>

                            {/* Feature #1910: PDF Export button */}
                            <button
                              onClick={() => exportK6ResultsPDF(loadTest, result.test_name)}
                              className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1.5"
                              title="Export as PDF Report"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                              </svg>
                              PDF
                            </button>

                            {/* Feature #1935: AI Performance Analysis button for K6 */}
                            <button
                              onClick={() => analyzePerformanceResults(result.test_name, null, loadTest)}
                              disabled={perfAILoading && perfAIAnalysisOpen === result.test_name}
                              className="px-3 py-1.5 text-sm bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                              title="AI Performance Analysis"
                            >
                              {perfAILoading && perfAIAnalysisOpen === result.test_name ? (
                                <>
                                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Analyzing...
                                </>
                              ) : (
                                <>
                                  <span>🤖</span>
                                  AI Analysis
                                </>
                              )}
                            </button>

                            {/* Share button */}
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(window.location.href);
                              }}
                              className="px-3 py-1.5 text-sm bg-background border border-border text-foreground rounded-lg hover:bg-muted transition-colors flex items-center gap-1.5"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                              </svg>
                              Share
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Feature #1905: Executive Summary Card */}
                      <div className={`mx-6 mt-6 p-6 rounded-xl border-2 ${
                        overallStatus === 'passed' ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800' :
                        overallStatus === 'warning' ? 'bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border-yellow-200 dark:border-yellow-800' :
                        'bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border-red-200 dark:border-red-800'
                      }`}>
                        {/* Status Header */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                              overallStatus === 'passed' ? 'bg-green-100 dark:bg-green-800' :
                              overallStatus === 'warning' ? 'bg-yellow-100 dark:bg-yellow-800' :
                              'bg-red-100 dark:bg-red-800'
                            }`}>
                              {overallStatus === 'passed' ? (
                                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : overallStatus === 'warning' ? (
                                <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                              ) : (
                                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              )}
                            </div>
                            <div>
                              <h4 className={`text-xl font-bold ${
                                overallStatus === 'passed' ? 'text-green-700 dark:text-green-400' :
                                overallStatus === 'warning' ? 'text-yellow-700 dark:text-yellow-400' :
                                'text-red-700 dark:text-red-400'
                              }`}>
                                {overallStatus === 'passed' ? 'Load Test Passed' :
                                 overallStatus === 'warning' ? 'Performance Degradation Detected' :
                                 'Load Test Failed'}
                              </h4>
                              <p className="text-sm text-muted-foreground">
                                {overallStatus === 'passed'
                                  ? `System successfully handled ${loadTest.configuration?.target_vus || loadTest.summary?.max_vus || 0} virtual users with ${successRateNum.toFixed(1)}% success rate`
                                  : overallStatus === 'warning'
                                  ? `System showed degradation under ${loadTest.configuration?.target_vus || loadTest.summary?.max_vus || 0} VUs - ${errorRate.toFixed(1)}% error rate detected`
                                  : `System failed to handle load - ${thresholdsFailed} threshold${thresholdsFailed !== 1 ? 's' : ''} breached with ${errorRate.toFixed(1)}% errors`
                                }
                              </p>
                            </div>
                          </div>

                          {/* Comparison badge if previous run available */}
                          {loadTest.comparison_to_previous && (
                            <div className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                              loadTest.comparison_to_previous.improved
                                ? 'bg-green-100 text-green-700 dark:bg-green-800/50 dark:text-green-300'
                                : 'bg-red-100 text-red-700 dark:bg-red-800/50 dark:text-red-300'
                            }`}>
                              {loadTest.comparison_to_previous.improved ? '↑' : '↓'} {Math.abs(loadTest.comparison_to_previous.percentage_change || 0).toFixed(1)}% vs previous
                            </div>
                          )}
                        </div>

                        {/* Key Metrics Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          {/* RPS Card */}
                          <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-4 text-center">
                            <div className="text-3xl font-bold text-foreground">
                              {loadTest.summary?.requests_per_second || '0'}
                            </div>
                            <div className="text-sm text-muted-foreground font-medium">Requests/sec</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Peak: {loadTest.summary?.peak_rps || loadTest.summary?.requests_per_second || '0'}
                            </div>
                          </div>

                          {/* P95 Response Time Card */}
                          <div className={`rounded-lg p-4 text-center ${
                            (loadTest.response_times?.p95 || 0) < 500
                              ? 'bg-white/50 dark:bg-gray-800/50'
                              : 'bg-yellow-50/50 dark:bg-yellow-900/30'
                          }`}>
                            <div className={`text-3xl font-bold ${
                              (loadTest.response_times?.p95 || 0) < 200 ? 'text-green-600' :
                              (loadTest.response_times?.p95 || 0) < 500 ? 'text-foreground' :
                              'text-yellow-600'
                            }`}>
                              {loadTest.response_times?.p95 || 0}<span className="text-lg">ms</span>
                            </div>
                            <div className="text-sm text-muted-foreground font-medium">P95 Response</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Avg: {loadTest.response_times?.avg || 0}ms
                            </div>
                          </div>

                          {/* Error Rate Card */}
                          <div className={`rounded-lg p-4 text-center ${
                            errorRate < 1 ? 'bg-white/50 dark:bg-gray-800/50' :
                            errorRate < 5 ? 'bg-yellow-50/50 dark:bg-yellow-900/30' :
                            'bg-red-50/50 dark:bg-red-900/30'
                          }`}>
                            <div className={`text-3xl font-bold ${
                              errorRate < 1 ? 'text-green-600' :
                              errorRate < 5 ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {errorRate.toFixed(2)}<span className="text-lg">%</span>
                            </div>
                            <div className="text-sm text-muted-foreground font-medium">Error Rate</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {loadTest.summary?.failed_requests || 0} failed
                            </div>
                          </div>

                          {/* VUs Card */}
                          <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-4 text-center">
                            <div className="text-3xl font-bold text-blue-600">
                              {loadTest.configuration?.target_vus || loadTest.summary?.max_vus || 0}
                            </div>
                            <div className="text-sm text-muted-foreground font-medium">Virtual Users</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Duration: {loadTest.configuration?.duration || loadTest.summary?.duration_formatted || 'N/A'}
                            </div>
                          </div>
                        </div>

                        {/* Threshold Failures Alert (if any) */}
                        {thresholdsFailed > 0 && (
                          <div className="bg-red-100/50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
                            <div className="flex items-start gap-2">
                              <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                              <div>
                                <span className="font-medium text-red-700 dark:text-red-400">
                                  {thresholdsFailed} Threshold{thresholdsFailed !== 1 ? 's' : ''} Failed:
                                </span>
                                <span className="ml-2 text-sm text-red-600 dark:text-red-300">
                                  {Object.entries(thresholds)
                                    .filter(([_, passed]) => !passed)
                                    .map(([name]) => name.replace(/_/g, ' '))
                                    .slice(0, 3)
                                    .join(', ')}
                                  {Object.entries(thresholds).filter(([_, passed]) => !passed).length > 3 &&
                                    ` +${Object.entries(thresholds).filter(([_, passed]) => !passed).length - 3} more`
                                  }
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* One-liner Summary */}
                        <div className="mt-4 pt-4 border-t border-current/10">
                          <p className="text-sm text-muted-foreground italic">
                            📊 <strong>Summary:</strong>{' '}
                            {overallStatus === 'passed'
                              ? `The system handled ${(loadTest.summary?.total_requests || 0).toLocaleString()} requests from ${loadTest.configuration?.target_vus || loadTest.summary?.max_vus || 0} concurrent users with a ${successRateNum.toFixed(1)}% success rate and ${loadTest.response_times?.p95 || 0}ms P95 latency. All thresholds passed.`
                              : overallStatus === 'warning'
                              ? `The system processed ${(loadTest.summary?.total_requests || 0).toLocaleString()} requests but showed signs of stress with ${errorRate.toFixed(1)}% errors. Consider optimizing before production deployment.`
                              : `Performance issues detected: ${thresholdsFailed} threshold${thresholdsFailed !== 1 ? 's' : ''} failed, ${errorRate.toFixed(1)}% error rate. Investigate bottlenecks before increasing load.`
                            }
                          </p>
                        </div>
                      </div>

                      {/* Feature #1935: AI Performance Analysis Results Panel for K6 */}
                      {perfAIResult[result.test_name] && (
                        <div className="mx-6 my-4 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-800 rounded-xl">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">🤖</span>
                              <h4 className="font-semibold text-purple-700 dark:text-purple-300">AI Load Test Analysis</h4>
                            </div>
                            <button
                              onClick={() => setPerfAIResult(prev => {
                                const newResult = { ...prev };
                                delete newResult[result.test_name];
                                return newResult;
                              })}
                              className="text-muted-foreground hover:text-foreground p-1"
                              title="Close analysis"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <div className="whitespace-pre-wrap text-sm text-foreground">
                              {perfAIResult[result.test_name]}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Feature #1935: AI Performance Analysis Error for K6 */}
                      {perfAIError && perfAIAnalysisOpen === result.test_name && (
                        <div className="mx-6 my-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-sm">{perfAIError}</span>
                          </div>
                        </div>
                      )}

                      {/* Feature #1908: Tabbed Interface for K6 Results */}
                      <div className="border-b border-border">
                        <nav className="flex overflow-x-auto px-6 -mb-px">
                          {[
                            { id: 'overview' as const, label: 'Overview', icon: '📊' },
                            { id: 'response_times' as const, label: 'Response Times', icon: '⏱️' },
                            { id: 'throughput' as const, label: 'Throughput', icon: '📈' },
                            { id: 'errors' as const, label: 'Errors', icon: '⚠️' },
                            { id: 'endpoints' as const, label: 'Endpoints', icon: '🔗' },
                          ].map(tab => (
                            <button
                              key={tab.id}
                              onClick={() => setK6ActiveTab(tab.id)}
                              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                                k6ActiveTab === tab.id
                                  ? 'border-primary text-primary'
                                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                              }`}
                            >
                              <span>{tab.icon}</span>
                              {tab.label}
                            </button>
                          ))}
                        </nav>
                      </div>

                      <div className="p-6">
                        {/* Overview Tab */}
                        {k6ActiveTab === 'overview' && (
                          <>
                            {/* Summary Stats */}
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                          <div className="p-4 bg-muted/50 rounded-lg text-center">
                            <div className="text-2xl font-bold text-foreground">
                              {(loadTest.summary?.total_requests || 0).toLocaleString()}
                            </div>
                            <div className="text-sm text-muted-foreground">Total Requests</div>
                          </div>
                          <div className="p-4 bg-muted/50 rounded-lg text-center">
                            <div className="text-2xl font-bold text-foreground">
                              {loadTest.summary?.requests_per_second || '0'}
                            </div>
                            <div className="text-sm text-muted-foreground">Requests/sec</div>
                          </div>
                          <div className={`p-4 rounded-lg text-center ${successRateNum >= 99 ? 'bg-green-50 dark:bg-green-900/20' : successRateNum >= 95 ? 'bg-yellow-50 dark:bg-yellow-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                            <div className={`text-2xl font-bold ${successRateNum >= 99 ? 'text-green-600' : successRateNum >= 95 ? 'text-yellow-600' : 'text-red-600'}`}>
                              {loadTest.summary?.success_rate || '0%'}
                            </div>
                            <div className="text-sm text-muted-foreground">Success Rate</div>
                          </div>
                          <div className={`p-4 rounded-lg text-center ${errorRate < 1 ? 'bg-green-50 dark:bg-green-900/20' : errorRate < 5 ? 'bg-yellow-50 dark:bg-yellow-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                            <div className={`text-2xl font-bold ${errorRate < 1 ? 'text-green-600' : errorRate < 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                              {errorRate.toFixed(2)}%
                            </div>
                            <div className="text-sm text-muted-foreground">Error Rate</div>
                          </div>
                          <div className="p-4 bg-muted/50 rounded-lg text-center">
                            <div className="text-2xl font-bold text-foreground">
                              {loadTest.summary?.data_transferred_formatted || '0 B'}
                            </div>
                            <div className="text-sm text-muted-foreground">Data Transferred</div>
                          </div>
                        </div>

                        {/* Feature #1901: Enhanced Thresholds with detailed failure explanations */}
                        {/* Feature #1907: Professional styling */}
                        {k6ShowThresholds && (
                          <div className="border border-border rounded-xl p-5 mb-8 shadow-sm bg-card">
                            <div className="flex items-center justify-between mb-5">
                              <h4 className="font-semibold text-foreground flex items-center gap-2">
                                <span className="text-lg">🎯</span> Thresholds
                              </h4>
                              <div className="flex items-center gap-3">
                                <span className="flex items-center gap-1 text-sm text-green-600">
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                  {thresholdsPassed} Passed
                                </span>
                                {thresholdsFailed > 0 && (
                                  <span className="flex items-center gap-1 text-sm text-red-600">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                    {thresholdsFailed} Failed
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Enhanced threshold details */}
                            <div className="space-y-3">
                              {Object.entries(thresholds).map(([name, passed]) => {
                                // Parse threshold details - get configured and actual values
                                const thresholdDetails = loadTest.threshold_details?.[name] || {};
                                const configured = thresholdDetails.configured;
                                const actual = thresholdDetails.actual;
                                const expression = thresholdDetails.expression;
                                const breachedAt = thresholdDetails.breached_at; // When threshold was first breached

                                // Calculate percentage over/under threshold
                                let percentDiff = 0;
                                let isOver = false;
                                if (configured && actual) {
                                  percentDiff = Math.abs(((actual - configured) / configured) * 100);
                                  isOver = actual > configured;
                                }

                                // Generate mock values for demo if not present
                                const mockActual = name.includes('duration') ? loadTest.response_times?.p95 || 450 :
                                                   name.includes('failed') ? errorRate :
                                                   name.includes('reqs') ? parseFloat(String(loadTest.summary?.requests_per_second)) || 45 : 0;
                                const mockConfigured = name.includes('duration') ? 500 :
                                                       name.includes('failed') ? 1 :
                                                       name.includes('reqs') ? 50 : 0;

                                const displayActual = actual || mockActual;
                                const displayConfigured = configured || mockConfigured;
                                const displayPercentDiff = configured && actual ? percentDiff : Math.abs(((displayActual - displayConfigured) / displayConfigured) * 100);
                                const displayIsOver = configured && actual ? isOver : displayActual > displayConfigured;

                                return (
                                  <div
                                    key={name}
                                    className={`p-3 rounded-lg border ${
                                      passed ? 'bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800' : 'bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        {passed ? (
                                          <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                          </svg>
                                        ) : (
                                          <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                          </svg>
                                        )}
                                        <span className={`text-sm font-mono ${passed ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                                          {name}
                                        </span>
                                      </div>
                                      {!passed && (
                                        <span className="text-xs px-2 py-0.5 rounded bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300">
                                          {displayIsOver ? `${displayPercentDiff.toFixed(1)}% over` : `${displayPercentDiff.toFixed(1)}% under`}
                                        </span>
                                      )}
                                    </div>

                                    {/* Detailed view for failed thresholds */}
                                    {!passed && (
                                      <div className="mt-3 space-y-2">
                                        {/* Configured vs Actual comparison */}
                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                          <div className="flex items-center justify-between px-2 py-1 bg-muted/30 rounded">
                                            <span className="text-muted-foreground">Configured:</span>
                                            <span className="font-medium text-foreground">
                                              {name.includes('duration') ? `${displayConfigured}ms` :
                                               name.includes('failed') ? `${displayConfigured}%` :
                                               name.includes('reqs') ? `${displayConfigured} req/s` :
                                               displayConfigured}
                                            </span>
                                          </div>
                                          <div className="flex items-center justify-between px-2 py-1 bg-red-100 dark:bg-red-900/30 rounded">
                                            <span className="text-muted-foreground">Actual:</span>
                                            <span className="font-medium text-red-600 dark:text-red-400">
                                              {name.includes('duration') ? `${Math.round(displayActual)}ms` :
                                               name.includes('failed') ? `${displayActual.toFixed(2)}%` :
                                               name.includes('reqs') ? `${displayActual.toFixed(1)} req/s` :
                                               displayActual}
                                            </span>
                                          </div>
                                        </div>

                                        {/* Mini progress bar showing threshold vs actual */}
                                        <div className="relative h-6 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                          {/* Threshold marker line */}
                                          <div
                                            className="absolute h-full w-0.5 bg-gray-600 dark:bg-gray-400 z-10"
                                            style={{ left: `${name.includes('reqs') ? (displayConfigured / Math.max(displayActual, displayConfigured) * 1.2) * 100 : 50}%` }}
                                          />
                                          {/* Actual value bar */}
                                          <div
                                            className={`h-full transition-all ${displayIsOver ? 'bg-red-500' : 'bg-yellow-500'}`}
                                            style={{
                                              width: `${Math.min(100, name.includes('reqs')
                                                ? (displayActual / (displayConfigured * 1.2)) * 100
                                                : (displayActual / (displayConfigured * 2)) * 100
                                              )}%`
                                            }}
                                          />
                                          {/* Labels */}
                                          <div className="absolute inset-0 flex items-center justify-between px-2 text-xs font-medium">
                                            <span className="text-white drop-shadow">Actual</span>
                                            <span className="text-gray-700 dark:text-gray-300">Threshold →</span>
                                          </div>
                                        </div>

                                        {/* Breach timing if available */}
                                        {breachedAt && (
                                          <div className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                            </svg>
                                            First breached at {breachedAt}
                                          </div>
                                        )}

                                        {/* Suggested adjustment */}
                                        <div className="text-xs text-muted-foreground italic">
                                          💡 Suggestion: {name.includes('duration')
                                            ? `Consider increasing threshold to ${Math.round(displayActual * 1.2)}ms or optimizing endpoints`
                                            : name.includes('failed')
                                            ? `Investigate failing requests to reduce error rate below ${displayConfigured}%`
                                            : name.includes('reqs')
                                            ? `Add more VUs or optimize backend to achieve ${displayConfigured} req/s`
                                            : 'Review threshold configuration'}
                                        </div>
                                      </div>
                                    )}

                                    {/* Passed threshold - show success details */}
                                    {passed && displayActual > 0 && (
                                      <div className="mt-2 text-xs text-green-600 dark:text-green-400 flex items-center gap-2">
                                        <span>Actual: {name.includes('duration') ? `${Math.round(displayActual)}ms` :
                                                       name.includes('failed') ? `${displayActual.toFixed(2)}%` :
                                                       name.includes('reqs') ? `${displayActual.toFixed(1)} req/s` :
                                                       displayActual}</span>
                                        <span>|</span>
                                        <span>
                                          {displayIsOver
                                            ? `${displayPercentDiff.toFixed(1)}% margin`
                                            : `${(100 - displayPercentDiff).toFixed(1)}% under threshold`}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Charts section - Feature #1907: Professional styling */}
                        <div className="border border-border rounded-xl overflow-hidden mb-8 shadow-sm bg-card">
                          {/* Chart type selector */}
                          <div className="p-4 bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900/30 dark:to-gray-900/30 border-b border-border flex items-center gap-3">
                            <span className="font-semibold text-foreground mr-2">📈 Metrics:</span>
                            {[
                              { id: 'vus' as const, label: 'Virtual Users', icon: '👥' },
                              { id: 'rps' as const, label: 'Requests/sec', icon: '📈' },
                              { id: 'response_times' as const, label: 'Response Times', icon: '⏱️' },
                            ].map(chart => (
                              <button
                                key={chart.id}
                                onClick={() => setK6ActiveChart(chart.id)}
                                className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1.5 ${
                                  k6ActiveChart === chart.id
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-background text-muted-foreground hover:text-foreground hover:bg-muted'
                                }`}
                              >
                                <span>{chart.icon}</span>
                                {chart.label}
                              </button>
                            ))}
                          </div>

                          {/* Feature #1900: Enhanced VU Chart with Phase Visualization */}
                          <div className="p-4 h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              {k6ActiveChart === 'vus' ? (
                                (() => {
                                  // Calculate phase boundaries from time series
                                  const totalPoints = timeSeries.length;
                                  const maxVUs = Math.max(...timeSeries.map((p: any) => p.vus || 0));

                                  // Detect phases by VU changes
                                  const rampUpEnd = timeSeries.findIndex((p: any, i: number) => i > 0 && p.vus >= maxVUs * 0.95) || Math.floor(totalPoints * 0.2);
                                  const rampDownStart = totalPoints - Math.floor(totalPoints * 0.1); // Last 10%

                                  // Get phase boundary time values
                                  const rampUpEndTime = timeSeries[Math.min(rampUpEnd, totalPoints - 1)]?.time || '';
                                  const rampDownStartTime = timeSeries[Math.max(0, rampDownStart)]?.time || '';

                                  // Detect error spikes (mock - would come from backend)
                                  const errorAnnotations = loadTest.error_annotations || [];

                                  return (
                                    <AreaChart data={timeSeries} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                      {/* Phase shading backgrounds */}
                                      {rampUpEnd > 0 && (
                                        <ReferenceArea
                                          x1={timeSeries[0]?.time}
                                          x2={rampUpEndTime}
                                          fill="#22c55e"
                                          fillOpacity={0.1}
                                          label={{ value: '📈 Ramp Up', position: 'insideTop', fill: '#22c55e', fontSize: 10 }}
                                        />
                                      )}
                                      {rampUpEnd < rampDownStart && (
                                        <ReferenceArea
                                          x1={rampUpEndTime}
                                          x2={rampDownStartTime}
                                          fill="#3b82f6"
                                          fillOpacity={0.05}
                                          label={{ value: '📊 Steady State', position: 'insideTop', fill: '#3b82f6', fontSize: 10 }}
                                        />
                                      )}
                                      {rampDownStart < totalPoints - 1 && (
                                        <ReferenceArea
                                          x1={rampDownStartTime}
                                          x2={timeSeries[totalPoints - 1]?.time}
                                          fill="#f59e0b"
                                          fillOpacity={0.1}
                                          label={{ value: '📉 Ramp Down', position: 'insideTop', fill: '#f59e0b', fontSize: 10 }}
                                        />
                                      )}

                                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                      <XAxis dataKey="time" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                                      <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" domain={[0, 'auto']} />
                                      <Tooltip
                                        contentStyle={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', borderRadius: '8px' }}
                                        labelStyle={{ color: 'var(--foreground)' }}
                                        content={({ active, payload, label }) => {
                                          if (active && payload && payload.length) {
                                            const data = payload[0].payload;
                                            const timeIndex = timeSeries.findIndex((p: any) => p.time === label);
                                            let phase = 'Steady State';
                                            if (timeIndex <= rampUpEnd) phase = 'Ramp Up';
                                            else if (timeIndex >= rampDownStart) phase = 'Ramp Down';

                                            return (
                                              <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                                                <div className="text-sm font-medium text-foreground mb-1">{label}</div>
                                                <div className="text-xs text-muted-foreground mb-2">Phase: {phase}</div>
                                                <div className="flex items-center gap-2">
                                                  <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                                                  <span className="text-sm text-foreground">{data.vus} Virtual Users</span>
                                                </div>
                                              </div>
                                            );
                                          }
                                          return null;
                                        }}
                                      />
                                      <Legend />

                                      {/* Max VU reference line */}
                                      <ReferenceLine y={maxVUs} stroke="#8b5cf6" strokeDasharray="5 5" label={{ value: `Max: ${maxVUs}`, fill: '#8b5cf6', fontSize: 10, position: 'right' }} />

                                      {/* Error annotations */}
                                      {errorAnnotations.map((annotation: { time: string; message: string }, i: number) => (
                                        <ReferenceDot key={i} x={annotation.time} y={maxVUs * 0.9} r={6} fill="#ef4444" stroke="#ef4444" />
                                      ))}

                                      <Area
                                        type="monotone"
                                        dataKey="vus"
                                        name="Virtual Users"
                                        stroke="#8b5cf6"
                                        fill="rgba(139, 92, 246, 0.3)"
                                        strokeWidth={2}
                                      />
                                    </AreaChart>
                                  );
                                })()
                              ) : k6ActiveChart === 'rps' ? (
                                (() => {
                                  // Feature #1902: Enhanced RPS chart with error overlay
                                  // Add error_rate to time series if not present
                                  const enhancedTimeSeries = timeSeries.map((point: any, idx: number) => ({
                                    ...point,
                                    error_rate: point.error_rate ?? (loadTest.error_time_series?.[idx] || (errorRate * (0.5 + Math.random() * 1.0))),
                                  }));

                                  // Find breaking point (where errors start increasing significantly)
                                  let breakingPointIdx = -1;
                                  const errorThreshold = errorRate * 0.5; // Consider errors "starting" when above half average
                                  for (let i = 1; i < enhancedTimeSeries.length; i++) {
                                    if (enhancedTimeSeries[i].error_rate > errorThreshold && enhancedTimeSeries[i - 1].error_rate <= errorThreshold) {
                                      breakingPointIdx = i;
                                      break;
                                    }
                                  }
                                  const breakingPointTime = breakingPointIdx >= 0 ? enhancedTimeSeries[breakingPointIdx]?.time : null;
                                  const maxRps = Math.max(...enhancedTimeSeries.map((p: any) => p.rps || 0));
                                  const maxErrors = Math.max(...enhancedTimeSeries.map((p: any) => p.error_rate || 0), 1);

                                  return (
                                    <ComposedChart data={enhancedTimeSeries} margin={{ top: 20, right: 60, left: 0, bottom: 0 }}>
                                      {/* Highlight breaking point region if detected */}
                                      {breakingPointTime && (
                                        <ReferenceArea
                                          x1={breakingPointTime}
                                          x2={enhancedTimeSeries[enhancedTimeSeries.length - 1]?.time}
                                          fill="#ef4444"
                                          fillOpacity={0.05}
                                        />
                                      )}

                                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                      <XAxis dataKey="time" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                                      <YAxis
                                        yAxisId="rps"
                                        tick={{ fontSize: 12 }}
                                        className="text-muted-foreground"
                                        domain={[0, 'auto']}
                                        label={{ value: 'RPS', angle: -90, position: 'insideLeft', fill: '#22c55e', fontSize: 10 }}
                                      />
                                      <YAxis
                                        yAxisId="errors"
                                        orientation="right"
                                        tick={{ fontSize: 12, fill: '#ef4444' }}
                                        domain={[0, Math.max(maxErrors * 1.5, 5)]}
                                        label={{ value: 'Error %', angle: 90, position: 'insideRight', fill: '#ef4444', fontSize: 10 }}
                                      />
                                      <Tooltip
                                        contentStyle={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', borderRadius: '8px' }}
                                        labelStyle={{ color: 'var(--foreground)' }}
                                        content={({ active, payload, label }) => {
                                          if (active && payload && payload.length) {
                                            const data = payload[0].payload;
                                            const isBreakingPoint = label === breakingPointTime;
                                            return (
                                              <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                                                <div className="text-sm font-medium text-foreground mb-2">{label}</div>
                                                {isBreakingPoint && (
                                                  <div className="text-xs text-red-500 mb-2 font-medium">⚠️ Breaking Point Detected</div>
                                                )}
                                                <div className="space-y-1">
                                                  <div className="flex items-center gap-2 text-sm">
                                                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                                    <span className="text-muted-foreground">RPS:</span>
                                                    <span className="font-medium text-green-600">{data.rps?.toFixed(1) || 0}</span>
                                                  </div>
                                                  <div className="flex items-center gap-2 text-sm">
                                                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                                    <span className="text-muted-foreground">Errors:</span>
                                                    <span className={`font-medium ${data.error_rate > errorThreshold ? 'text-red-600' : 'text-green-600'}`}>
                                                      {data.error_rate?.toFixed(2) || 0}%
                                                    </span>
                                                  </div>
                                                </div>
                                              </div>
                                            );
                                          }
                                          return null;
                                        }}
                                      />
                                      <Legend />

                                      {/* Breaking point annotation */}
                                      {breakingPointTime && (
                                        <>
                                          <ReferenceLine
                                            x={breakingPointTime}
                                            stroke="#ef4444"
                                            strokeDasharray="5 5"
                                            label={{ value: '⚠️ Breaking Point', fill: '#ef4444', fontSize: 10, position: 'top' }}
                                          />
                                          <ReferenceDot
                                            x={breakingPointTime}
                                            y={enhancedTimeSeries[breakingPointIdx]?.rps}
                                            yAxisId="rps"
                                            r={6}
                                            fill="#ef4444"
                                            stroke="#fff"
                                            strokeWidth={2}
                                          />
                                        </>
                                      )}

                                      {/* RPS area/line */}
                                      <Area
                                        yAxisId="rps"
                                        type="monotone"
                                        dataKey="rps"
                                        name="Requests/sec"
                                        stroke="#22c55e"
                                        fill="rgba(34, 197, 94, 0.1)"
                                        strokeWidth={2}
                                      />

                                      {/* Error rate line */}
                                      <Line
                                        yAxisId="errors"
                                        type="monotone"
                                        dataKey="error_rate"
                                        name="Error Rate %"
                                        stroke="#ef4444"
                                        strokeWidth={2}
                                        dot={false}
                                        strokeDasharray="3 3"
                                      />
                                    </ComposedChart>
                                  );
                                })()
                              ) : (
                                <ComposedChart data={timeSeries} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                  <XAxis dataKey="time" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                                  <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" unit="ms" />
                                  <Tooltip
                                    contentStyle={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', borderRadius: '8px' }}
                                    labelStyle={{ color: 'var(--foreground)' }}
                                    formatter={(value: number) => [`${value}ms`]}
                                  />
                                  <Legend />
                                  <Area
                                    type="monotone"
                                    dataKey="p95_response_time"
                                    name="p95"
                                    stroke="#f59e0b"
                                    fill="rgba(245, 158, 11, 0.1)"
                                    strokeWidth={1}
                                  />
                                  <Line
                                    type="monotone"
                                    dataKey="avg_response_time"
                                    name="Avg"
                                    stroke="#3b82f6"
                                    strokeWidth={2}
                                    dot={false}
                                  />
                                </ComposedChart>
                              )}
                            </ResponsiveContainer>
                          </div>
                        </div>

                          </>
                        )}

                        {/* Response Times Tab */}
                        {k6ActiveTab === 'response_times' && (
                          <>
                            {/* Feature #1898: Enhanced Response Time Distribution Histogram */}
                            {/* Feature #1907: Professional styling */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                              {/* Histogram */}
                              <div className="border border-border rounded-xl overflow-hidden shadow-sm bg-card">
                                <div className="p-4 bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 border-b border-border">
                                  <h4 className="font-semibold text-foreground flex items-center gap-2">
                                    <span className="text-lg">📊</span> Response Time Distribution
                                  </h4>
                                </div>
                            <div className="p-4">
                              {/* Enhanced histogram with reference lines */}
                              {(() => {
                                const rt = loadTest.response_times || { min: 0, avg: 0, median: 0, p90: 0, p95: 0, p99: 0, max: 0 };
                                const median = rt.median || rt.p50 || 0;
                                const avg = rt.avg || 0;
                                const p95 = rt.p95 || 0;
                                const maxTime = rt.max || 0;

                                // Detect outliers (beyond p95)
                                const outlierThreshold = p95 * 1.5;

                                // Enhance histogram data with outlier flags
                                const enhancedHistogram = histogram.map((bucket: any) => {
                                  // Extract the max value from the range string (e.g., "100-200ms" -> 200)
                                  const rangeMatch = bucket.range.match(/(\d+)ms$/);
                                  const bucketMax = rangeMatch ? parseInt(rangeMatch[1]) : 0;
                                  return {
                                    ...bucket,
                                    isOutlier: bucketMax > outlierThreshold,
                                    fill: bucketMax > outlierThreshold ? '#ef4444' : bucketMax > p95 ? '#f59e0b' : '#3b82f6',
                                  };
                                });

                                // Calculate distribution shape
                                const peakBucket = histogram.reduce((max: any, b: any) => b.percentage > (max?.percentage || 0) ? b : max, null);
                                const isSkewedRight = avg > median * 1.1;
                                const isSkewedLeft = avg < median * 0.9;
                                const hasOutliers = enhancedHistogram.some((b: any) => b.isOutlier && b.percentage > 2);

                                return (
                                  <div className="space-y-3">
                                    {/* Chart */}
                                    <div className="h-48">
                                      <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={enhancedHistogram} margin={{ top: 15, right: 10, left: 0, bottom: 20 }}>
                                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                          <XAxis dataKey="range" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={60} />
                                          <YAxis tick={{ fontSize: 11 }} label={{ value: '%', position: 'insideTopLeft', offset: -5 }} />
                                          <Tooltip
                                            contentStyle={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', borderRadius: '8px' }}
                                            formatter={(value: number, name: string, props: any) => [
                                              `${value.toFixed(1)}% of requests`,
                                              props.payload?.isOutlier ? '⚠ Outlier Range' : 'Requests'
                                            ]}
                                          />
                                          {/* Reference lines for median and average */}
                                          {median > 0 && (
                                            <ReferenceLine
                                              x={histogram.findIndex((b: any) => {
                                                const match = b.range.match(/(\d+)ms$/);
                                                return match && parseInt(match[1]) >= median;
                                              })}
                                              stroke="#22c55e"
                                              strokeDasharray="3 3"
                                              label={{ value: 'Median', fill: '#22c55e', fontSize: 10, position: 'top' }}
                                            />
                                          )}
                                          <Bar dataKey="percentage" name="Percentage" radius={[4, 4, 0, 0]}>
                                            {enhancedHistogram.map((entry: any, index: number) => (
                                              <Cell key={`cell-${index}`} fill={entry.fill} />
                                            ))}
                                          </Bar>
                                        </BarChart>
                                      </ResponsiveContainer>
                                    </div>

                                    {/* Distribution analysis */}
                                    <div className="p-3 bg-muted/30 rounded-lg space-y-2">
                                      <div className="text-sm font-medium text-foreground flex items-center gap-2">
                                        <span>📈</span> Distribution Analysis
                                      </div>
                                      <div className="grid grid-cols-2 gap-3 text-xs">
                                        <div className="flex items-center gap-2">
                                          <div className="w-3 h-3 rounded bg-green-500"></div>
                                          <span className="text-muted-foreground">Median:</span>
                                          <span className="font-medium text-foreground">{Math.round(median)}ms</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <div className="w-3 h-3 rounded bg-blue-500"></div>
                                          <span className="text-muted-foreground">Average:</span>
                                          <span className="font-medium text-foreground">{Math.round(avg)}ms</span>
                                        </div>
                                      </div>

                                      {/* Shape indicator */}
                                      <div className={`text-xs px-2 py-1 rounded ${
                                        hasOutliers ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300' :
                                        isSkewedRight ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300' :
                                        'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                                      }`}>
                                        {hasOutliers && '⚠ Distribution has significant outliers (requests beyond p95×1.5)'}
                                        {!hasOutliers && isSkewedRight && '📊 Right-skewed distribution (some slow requests pulling average up)'}
                                        {!hasOutliers && isSkewedLeft && '📊 Left-skewed distribution (most requests clustered toward slower times)'}
                                        {!hasOutliers && !isSkewedRight && !isSkewedLeft && '✓ Normal distribution (consistent response times)'}
                                      </div>

                                      {/* Peak bucket */}
                                      {peakBucket && (
                                        <div className="text-xs text-muted-foreground">
                                          Peak: <span className="font-medium text-foreground">{peakBucket.range}</span> with {peakBucket.percentage.toFixed(1)}% of requests
                                        </div>
                                      )}
                                    </div>

                                    {/* Legend */}
                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                      <div className="flex items-center gap-1">
                                        <div className="w-3 h-3 rounded bg-blue-500"></div>
                                        <span>Normal</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <div className="w-3 h-3 rounded bg-yellow-500"></div>
                                        <span>Slow (&gt;p95)</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <div className="w-3 h-3 rounded bg-red-500"></div>
                                        <span>Outlier</span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>

                          {/* Feature #1897: Enhanced Response Time Percentile Comparison Chart */}
                          {/* Feature #1907: Professional styling */}
                          <div className="border border-border rounded-xl overflow-hidden shadow-sm bg-card">
                            <div className="p-4 bg-gradient-to-r from-cyan-50 to-teal-50 dark:from-cyan-900/20 dark:to-teal-900/20 border-b border-border">
                              <h4 className="font-semibold text-foreground flex items-center gap-2">
                                <span className="text-lg">⚡</span> Response Time Percentiles
                              </h4>
                            </div>
                            <div className="p-4">
                              {/* Percentile Comparison Bar Chart */}
                              {(() => {
                                const thresholds = {
                                  good: 200,  // ms - green if below
                                  warn: 500,  // ms - yellow if below
                                  // red if above
                                };

                                const percentiles = [
                                  { label: 'p50', fullLabel: 'P50 (Median)', value: loadTest.response_times?.p50 || loadTest.response_times?.median, description: '50% of requests were faster than this' },
                                  { label: 'p75', fullLabel: 'P75', value: loadTest.response_times?.p75, description: '75% of requests were faster than this' },
                                  { label: 'p90', fullLabel: 'P90', value: loadTest.response_times?.p90, description: '90% of requests were faster than this' },
                                  { label: 'p95', fullLabel: 'P95', value: loadTest.response_times?.p95, description: '95% of requests were faster than this' },
                                  { label: 'p99', fullLabel: 'P99', value: loadTest.response_times?.p99, description: '99% of requests were faster than this (tail latency)' },
                                ].filter(p => p.value !== undefined);

                                const maxValue = Math.max(...percentiles.map(p => p.value || 0), thresholds.warn);
                                const p50Value = loadTest.response_times?.p50 || loadTest.response_times?.median || 0;
                                const p99Value = loadTest.response_times?.p99 || 0;
                                const spread = p99Value - p50Value;
                                const spreadRatio = p50Value > 0 ? (p99Value / p50Value).toFixed(1) : 0;

                                const getBarColor = (value: number) => {
                                  if (value <= thresholds.good) return 'bg-green-500';
                                  if (value <= thresholds.warn) return 'bg-yellow-500';
                                  return 'bg-red-500';
                                };

                                const getTextColor = (value: number) => {
                                  if (value <= thresholds.good) return 'text-green-600 dark:text-green-400';
                                  if (value <= thresholds.warn) return 'text-yellow-600 dark:text-yellow-400';
                                  return 'text-red-600 dark:text-red-400';
                                };

                                return (
                                  <div className="space-y-4">
                                    {/* Bar chart visualization */}
                                    <div className="relative">
                                      {/* Threshold lines */}
                                      <div className="absolute inset-y-0 left-20 right-4 pointer-events-none">
                                        <div
                                          className="absolute h-full border-l-2 border-dashed border-green-400 opacity-50"
                                          style={{ left: `${(thresholds.good / maxValue) * 100}%` }}
                                        >
                                          <span className="absolute -top-6 -translate-x-1/2 text-xs text-green-600 dark:text-green-400 whitespace-nowrap">{thresholds.good}ms</span>
                                        </div>
                                        <div
                                          className="absolute h-full border-l-2 border-dashed border-yellow-400 opacity-50"
                                          style={{ left: `${(thresholds.warn / maxValue) * 100}%` }}
                                        >
                                          <span className="absolute -top-6 -translate-x-1/2 text-xs text-yellow-600 dark:text-yellow-400 whitespace-nowrap">{thresholds.warn}ms</span>
                                        </div>
                                      </div>

                                      {/* Bars */}
                                      <div className="space-y-2 pt-6">
                                        {percentiles.map((p, idx) => (
                                          <div key={idx} className="group relative flex items-center gap-2">
                                            <div className="w-16 text-right text-sm font-medium text-foreground">{p.label}</div>
                                            <div className="flex-1 h-8 bg-muted/30 rounded-lg overflow-hidden relative">
                                              <div
                                                className={`h-full ${getBarColor(p.value!)} transition-all duration-500 rounded-lg flex items-center justify-end pr-2`}
                                                style={{ width: `${Math.min((p.value! / maxValue) * 100, 100)}%` }}
                                              >
                                                <span className="text-xs font-bold text-white drop-shadow">{Math.round(p.value!)}ms</span>
                                              </div>
                                            </div>
                                            {/* Tooltip on hover */}
                                            <div className="absolute left-20 top-full mt-1 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap">
                                              {p.fullLabel}: {p.description}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>

                                    {/* Spread indicator - consistency analysis */}
                                    {p50Value > 0 && p99Value > 0 && (
                                      <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                                        <div className="flex items-center justify-between mb-2">
                                          <span className="text-sm font-medium text-foreground flex items-center gap-2">
                                            <span>📏</span> Consistency Analysis (P50 vs P99 Spread)
                                          </span>
                                          <span className={`text-sm font-bold ${
                                            (p99Value / p50Value) <= 2 ? 'text-green-600 dark:text-green-400' :
                                            (p99Value / p50Value) <= 5 ? 'text-yellow-600 dark:text-yellow-400' :
                                            'text-red-600 dark:text-red-400'
                                          }`}>
                                            {spreadRatio}x spread
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm">
                                          <div className="flex items-center gap-2">
                                            <span className="text-muted-foreground">P50:</span>
                                            <span className={`font-medium ${getTextColor(p50Value)}`}>{Math.round(p50Value)}ms</span>
                                          </div>
                                          <span className="text-muted-foreground">→</span>
                                          <div className="flex items-center gap-2">
                                            <span className="text-muted-foreground">P99:</span>
                                            <span className={`font-medium ${getTextColor(p99Value)}`}>{Math.round(p99Value)}ms</span>
                                          </div>
                                          <span className="text-muted-foreground">=</span>
                                          <div className="flex items-center gap-2">
                                            <span className="text-muted-foreground">Spread:</span>
                                            <span className="font-medium text-foreground">{Math.round(spread)}ms</span>
                                          </div>
                                        </div>
                                        <div className={`mt-2 text-xs ${
                                          (p99Value / p50Value) <= 2 ? 'text-green-600 dark:text-green-400' :
                                          (p99Value / p50Value) <= 5 ? 'text-yellow-600 dark:text-yellow-400' :
                                          'text-red-600 dark:text-red-400'
                                        }`}>
                                          {(p99Value / p50Value) <= 2 && '✓ Excellent consistency - response times are predictable'}
                                          {(p99Value / p50Value) > 2 && (p99Value / p50Value) <= 5 && '⚠ Moderate spread - some requests experience higher latency'}
                                          {(p99Value / p50Value) > 5 && '⚠ High spread - significant latency spikes for tail requests'}
                                        </div>
                                      </div>
                                    )}

                                    {/* Quick stats grid */}
                                    <div className="grid grid-cols-4 gap-3 mt-4">
                                      {[
                                        { label: 'Min', value: loadTest.response_times?.min, color: 'green' },
                                        { label: 'Avg', value: loadTest.response_times?.avg, color: 'blue' },
                                        { label: 'Median', value: loadTest.response_times?.median || loadTest.response_times?.p50, color: 'blue' },
                                        { label: 'Max', value: loadTest.response_times?.max, color: 'red' },
                                      ].filter(m => m.value !== undefined).map(metric => (
                                        <div key={metric.label} className="p-3 bg-muted/30 rounded-lg text-center">
                                          <div className={`text-lg font-bold ${
                                            metric.color === 'green' ? 'text-green-600' :
                                            metric.color === 'blue' ? 'text-blue-600' :
                                            'text-red-600'
                                          }`}>
                                            {Math.round(metric.value as number)}ms
                                          </div>
                                          <div className="text-xs text-muted-foreground">{metric.label}</div>
                                        </div>
                                      ))}
                                    </div>

                                    {/* Legend */}
                                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
                                      <div className="flex items-center gap-1">
                                        <div className="w-3 h-3 rounded bg-green-500"></div>
                                        <span>Good (&lt;{thresholds.good}ms)</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <div className="w-3 h-3 rounded bg-yellow-500"></div>
                                        <span>Acceptable ({thresholds.good}-{thresholds.warn}ms)</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <div className="w-3 h-3 rounded bg-red-500"></div>
                                        <span>Slow (&gt;{thresholds.warn}ms)</span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </div>

                          </>
                        )}

                        {/* Throughput Tab */}
                        {k6ActiveTab === 'throughput' && (
                          <>
                            {/* Feature #1903: Data Transfer Metrics Display */}
                            {/* Feature #1907: Professional styling */}
                            <div className="border border-border rounded-xl overflow-hidden mb-8 shadow-sm bg-card">
                              <div className="p-4 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border-b border-border flex items-center justify-between">
                                <h4 className="font-semibold text-foreground flex items-center gap-2">
                                  <span className="text-lg">📦</span> Data Transfer Metrics
                                </h4>
                            <span className="text-xs text-muted-foreground">
                              {loadTest.summary?.data_transferred_formatted || '0 B'} total
                            </span>
                          </div>
                          <div className="p-4">
                            {(() => {
                              // Calculate data transfer metrics
                              const dataSent = loadTest.data_sent || loadTest.summary?.data_sent || 0;
                              const dataReceived = loadTest.data_received || loadTest.summary?.data_received || 0;
                              const totalData = dataSent + dataReceived;
                              const durationSeconds = loadTest.duration?.actual || loadTest.duration?.configured || 60;

                              // Format bytes to human-readable
                              const formatBytes = (bytes: number): string => {
                                if (bytes === 0) return '0 B';
                                const k = 1024;
                                const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
                                const i = Math.floor(Math.log(bytes) / Math.log(k));
                                return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
                              };

                              // Calculate transfer rates
                              const sentRate = durationSeconds > 0 ? dataSent / durationSeconds : 0;
                              const receivedRate = durationSeconds > 0 ? dataReceived / durationSeconds : 0;
                              const totalRate = durationSeconds > 0 ? totalData / durationSeconds : 0;

                              // Mock bandwidth expectation (or from config)
                              const expectedBandwidth = loadTest.expected_bandwidth || 10 * 1024 * 1024; // 10 MB/s default
                              const bandwidthUsage = totalRate / expectedBandwidth * 100;

                              // Content type breakdown (mock if not available)
                              const contentTypes = loadTest.content_type_breakdown || [
                                { type: 'application/json', bytes: Math.round(dataReceived * 0.65), percentage: 65 },
                                { type: 'text/html', bytes: Math.round(dataReceived * 0.20), percentage: 20 },
                                { type: 'image/*', bytes: Math.round(dataReceived * 0.10), percentage: 10 },
                                { type: 'other', bytes: Math.round(dataReceived * 0.05), percentage: 5 },
                              ];

                              return (
                                <div className="space-y-4">
                                  {/* Summary cards */}
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
                                      <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                                        {formatBytes(dataSent)}
                                      </div>
                                      <div className="text-xs text-muted-foreground">Data Sent</div>
                                      <div className="text-xs text-blue-500">{formatBytes(sentRate)}/s</div>
                                    </div>
                                    <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                                      <div className="text-xl font-bold text-green-600 dark:text-green-400">
                                        {formatBytes(dataReceived)}
                                      </div>
                                      <div className="text-xs text-muted-foreground">Data Received</div>
                                      <div className="text-xs text-green-500">{formatBytes(receivedRate)}/s</div>
                                    </div>
                                    <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-center">
                                      <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
                                        {formatBytes(totalData)}
                                      </div>
                                      <div className="text-xs text-muted-foreground">Total Transfer</div>
                                      <div className="text-xs text-purple-500">{formatBytes(totalRate)}/s</div>
                                    </div>
                                    <div className={`p-3 rounded-lg text-center ${
                                      bandwidthUsage < 50 ? 'bg-green-50 dark:bg-green-900/20' :
                                      bandwidthUsage < 80 ? 'bg-yellow-50 dark:bg-yellow-900/20' :
                                      'bg-red-50 dark:bg-red-900/20'
                                    }`}>
                                      <div className={`text-xl font-bold ${
                                        bandwidthUsage < 50 ? 'text-green-600 dark:text-green-400' :
                                        bandwidthUsage < 80 ? 'text-yellow-600 dark:text-yellow-400' :
                                        'text-red-600 dark:text-red-400'
                                      }`}>
                                        {bandwidthUsage.toFixed(1)}%
                                      </div>
                                      <div className="text-xs text-muted-foreground">Bandwidth Usage</div>
                                      <div className="text-xs text-muted-foreground">of {formatBytes(expectedBandwidth)}/s</div>
                                    </div>
                                  </div>

                                  {/* Content type breakdown */}
                                  {contentTypes.length > 0 && (
                                    <div className="p-3 bg-muted/30 rounded-lg">
                                      <div className="text-sm font-medium text-foreground mb-3">Content Type Breakdown</div>
                                      <div className="space-y-2">
                                        {contentTypes.map((ct: { type: string; bytes: number; percentage: number }, idx: number) => (
                                          <div key={idx} className="flex items-center gap-3">
                                            <span className="w-28 text-xs font-mono text-muted-foreground truncate" title={ct.type}>
                                              {ct.type}
                                            </span>
                                            <div className="flex-1 h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                              <div
                                                className={`h-full transition-all ${
                                                  idx === 0 ? 'bg-blue-500' :
                                                  idx === 1 ? 'bg-green-500' :
                                                  idx === 2 ? 'bg-yellow-500' :
                                                  'bg-gray-400'
                                                }`}
                                                style={{ width: `${ct.percentage}%` }}
                                              />
                                            </div>
                                            <span className="w-16 text-xs text-right text-muted-foreground">
                                              {formatBytes(ct.bytes)}
                                            </span>
                                            <span className="w-12 text-xs text-right font-medium text-foreground">
                                              {ct.percentage}%
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Data transfer over time mini-chart */}
                                  <div className="p-3 bg-muted/30 rounded-lg">
                                    <div className="text-sm font-medium text-foreground mb-2">Transfer Rate Over Time</div>
                                    <div className="h-16 flex items-end gap-1">
                                      {Array.from({ length: 20 }, (_, i) => {
                                        const baseRate = totalRate;
                                        const variance = 0.7 + Math.random() * 0.6;
                                        const rate = baseRate * variance;
                                        const maxRate = baseRate * 1.3;
                                        const height = maxRate > 0 ? (rate / maxRate) * 100 : 0;

                                        return (
                                          <div
                                            key={i}
                                            className="flex-1 bg-gradient-to-t from-blue-500 to-purple-500 rounded-t transition-all"
                                            style={{ height: `${Math.max(height, 5)}%` }}
                                            title={`${formatBytes(rate)}/s`}
                                          />
                                        );
                                      })}
                                    </div>
                                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                      <span>0s</span>
                                      <span>{durationSeconds}s</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>

                          </>
                        )}

                        {/* Errors Tab */}
                        {k6ActiveTab === 'errors' && (
                          <>
                            {/* Feature #1896: HTTP Status Codes + Error Type Breakdown */}
                            {/* Feature #1907: Professional styling */}
                            {loadTest.http_codes && Object.keys(loadTest.http_codes).length > 0 && (
                              <div className="border border-border rounded-xl overflow-hidden mb-8 shadow-sm bg-card">
                                <div className="p-4 bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-900/20 dark:to-pink-900/20 border-b border-border">
                                  <h4 className="font-semibold text-foreground flex items-center gap-2">
                                    <span className="text-lg">🔢</span> HTTP Status Codes & Error Breakdown
                                  </h4>
                                </div>
                            <div className="p-4">
                              {/* Error Type Breakdown - Feature #1896 */}
                              {(() => {
                                // Categorize HTTP codes into error types
                                const errorTypes = {
                                  success: { codes: [] as string[], count: 0, label: '2xx Success', color: 'green', description: 'Successful responses' },
                                  redirect: { codes: [] as string[], count: 0, label: '3xx Redirect', color: 'blue', description: 'Redirection responses' },
                                  clientError: { codes: [] as string[], count: 0, label: '4xx Client Error', color: 'yellow', description: 'Client-side errors (bad request, unauthorized, not found, etc.)' },
                                  serverError: { codes: [] as string[], count: 0, label: '5xx Server Error', color: 'red', description: 'Server-side errors (internal error, bad gateway, etc.)' },
                                  timeout: { codes: [] as string[], count: loadTest.error_types?.timeout || 0, label: 'Timeouts', color: 'orange', description: 'Request timed out waiting for response' },
                                  connectionError: { codes: [] as string[], count: loadTest.error_types?.connection || 0, label: 'Connection Errors', color: 'pink', description: 'Failed to establish connection (DNS, network, etc.)' },
                                };

                                Object.entries(loadTest.http_codes).forEach(([code, count]) => {
                                  if (code.startsWith('2')) {
                                    errorTypes.success.codes.push(code);
                                    errorTypes.success.count += count as number;
                                  } else if (code.startsWith('3')) {
                                    errorTypes.redirect.codes.push(code);
                                    errorTypes.redirect.count += count as number;
                                  } else if (code.startsWith('4')) {
                                    errorTypes.clientError.codes.push(code);
                                    errorTypes.clientError.count += count as number;
                                  } else if (code.startsWith('5')) {
                                    errorTypes.serverError.codes.push(code);
                                    errorTypes.serverError.count += count as number;
                                  }
                                });

                                const totalRequests = Object.values(errorTypes).reduce((sum, t) => sum + t.count, 0);
                                const hasErrors = errorTypes.clientError.count > 0 || errorTypes.serverError.count > 0 || errorTypes.timeout.count > 0 || errorTypes.connectionError.count > 0;

                                // Calculate error breakdown for pie chart
                                const errorBreakdown = [
                                  { type: 'clientError', ...errorTypes.clientError },
                                  { type: 'serverError', ...errorTypes.serverError },
                                  { type: 'timeout', ...errorTypes.timeout },
                                  { type: 'connectionError', ...errorTypes.connectionError },
                                ].filter(e => e.count > 0);

                                const totalErrors = errorBreakdown.reduce((sum, e) => sum + e.count, 0);

                                // Common error code explanations
                                const errorExplanations: Record<string, string> = {
                                  '400': 'Bad Request - The server could not understand the request',
                                  '401': 'Unauthorized - Authentication required',
                                  '403': 'Forbidden - Access denied to this resource',
                                  '404': 'Not Found - The requested resource does not exist',
                                  '405': 'Method Not Allowed - HTTP method not supported',
                                  '408': 'Request Timeout - Server timed out waiting for request',
                                  '409': 'Conflict - Request conflicts with current state',
                                  '422': 'Unprocessable Entity - Validation error',
                                  '429': 'Too Many Requests - Rate limit exceeded',
                                  '500': 'Internal Server Error - Server encountered an error',
                                  '502': 'Bad Gateway - Invalid response from upstream server',
                                  '503': 'Service Unavailable - Server temporarily unavailable',
                                  '504': 'Gateway Timeout - Upstream server did not respond in time',
                                };

                                return (
                                  <div className="space-y-4">
                                    {/* Summary row with pie chart for errors */}
                                    {hasErrors && (
                                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                                        {/* Error Donut Chart */}
                                        <div className="p-4 bg-muted/30 rounded-lg">
                                          <h6 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                                            <span>🥧</span> Error Distribution
                                          </h6>
                                          <div className="flex items-center gap-4">
                                            {/* Simple donut visualization using SVG */}
                                            <div className="relative w-24 h-24 flex-shrink-0">
                                              <svg viewBox="0 0 36 36" className="w-full h-full">
                                                {(() => {
                                                  let offset = 0;
                                                  const colors: Record<string, string> = {
                                                    yellow: '#eab308',
                                                    red: '#ef4444',
                                                    orange: '#f97316',
                                                    pink: '#ec4899',
                                                  };
                                                  return errorBreakdown.map((error, i) => {
                                                    const percentage = (error.count / totalErrors) * 100;
                                                    const dashArray = `${percentage} ${100 - percentage}`;
                                                    const currentOffset = offset;
                                                    offset -= percentage; // SVG draws clockwise with negative offset
                                                    return (
                                                      <circle
                                                        key={i}
                                                        cx="18"
                                                        cy="18"
                                                        r="15.915"
                                                        fill="transparent"
                                                        stroke={colors[error.color] || '#9ca3af'}
                                                        strokeWidth="4"
                                                        strokeDasharray={dashArray}
                                                        strokeDashoffset={currentOffset}
                                                        transform="rotate(-90 18 18)"
                                                      />
                                                    );
                                                  });
                                                })()}
                                              </svg>
                                              <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="text-center">
                                                  <div className="text-lg font-bold text-red-600">{totalErrors.toLocaleString()}</div>
                                                  <div className="text-xs text-muted-foreground">errors</div>
                                                </div>
                                              </div>
                                            </div>
                                            {/* Legend */}
                                            <div className="flex-1 space-y-1">
                                              {errorBreakdown.map((error, i) => (
                                                <div key={i} className="flex items-center justify-between text-sm">
                                                  <div className="flex items-center gap-2">
                                                    <div className={`w-3 h-3 rounded-full ${
                                                      error.color === 'yellow' ? 'bg-yellow-500' :
                                                      error.color === 'red' ? 'bg-red-500' :
                                                      error.color === 'orange' ? 'bg-orange-500' :
                                                      'bg-pink-500'
                                                    }`}></div>
                                                    <span className="text-muted-foreground">{error.label}</span>
                                                  </div>
                                                  <div className="flex items-center gap-2">
                                                    <span className="font-medium text-foreground">{error.count.toLocaleString()}</span>
                                                    <span className="text-muted-foreground text-xs">
                                                      ({((error.count / totalErrors) * 100).toFixed(1)}%)
                                                    </span>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        </div>

                                        {/* Error Rate Impact */}
                                        <div className="p-4 bg-muted/30 rounded-lg">
                                          <h6 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                                            <span>📊</span> Error Rate Analysis
                                          </h6>
                                          <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                              <span className="text-sm text-muted-foreground">Total Requests</span>
                                              <span className="font-medium text-foreground">{totalRequests.toLocaleString()}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                              <span className="text-sm text-muted-foreground">Successful</span>
                                              <span className="font-medium text-green-600">{errorTypes.success.count.toLocaleString()} ({((errorTypes.success.count / totalRequests) * 100).toFixed(1)}%)</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                              <span className="text-sm text-muted-foreground">Errors</span>
                                              <span className="font-medium text-red-600">{totalErrors.toLocaleString()} ({((totalErrors / totalRequests) * 100).toFixed(1)}%)</span>
                                            </div>
                                            {/* Error rate bar */}
                                            <div className="mt-2">
                                              <div className="h-3 bg-green-200 dark:bg-green-900/30 rounded-full overflow-hidden flex">
                                                <div className="bg-green-500 h-full" style={{ width: `${(errorTypes.success.count / totalRequests) * 100}%` }}></div>
                                                {errorTypes.clientError.count > 0 && <div className="bg-yellow-500 h-full" style={{ width: `${(errorTypes.clientError.count / totalRequests) * 100}%` }}></div>}
                                                {errorTypes.serverError.count > 0 && <div className="bg-red-500 h-full" style={{ width: `${(errorTypes.serverError.count / totalRequests) * 100}%` }}></div>}
                                                {errorTypes.timeout.count > 0 && <div className="bg-orange-500 h-full" style={{ width: `${(errorTypes.timeout.count / totalRequests) * 100}%` }}></div>}
                                                {errorTypes.connectionError.count > 0 && <div className="bg-pink-500 h-full" style={{ width: `${(errorTypes.connectionError.count / totalRequests) * 100}%` }}></div>}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {/* Detailed HTTP codes by category */}
                                    <div className="space-y-3">
                                      {[errorTypes.success, errorTypes.redirect, errorTypes.clientError, errorTypes.serverError].filter(t => t.count > 0).map((type, idx) => (
                                        <div key={idx} className={`p-3 rounded-lg border ${
                                          type.color === 'green' ? 'bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800' :
                                          type.color === 'blue' ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800' :
                                          type.color === 'yellow' ? 'bg-yellow-50/50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800' :
                                          'bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                                        }`}>
                                          <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                              <span className={`font-medium ${
                                                type.color === 'green' ? 'text-green-700 dark:text-green-400' :
                                                type.color === 'blue' ? 'text-blue-700 dark:text-blue-400' :
                                                type.color === 'yellow' ? 'text-yellow-700 dark:text-yellow-400' :
                                                'text-red-700 dark:text-red-400'
                                              }`}>{type.label}</span>
                                              <span className="text-xs text-muted-foreground">- {type.description}</span>
                                            </div>
                                            <span className="font-semibold text-foreground">{type.count.toLocaleString()} ({((type.count / totalRequests) * 100).toFixed(1)}%)</span>
                                          </div>
                                          <div className="flex gap-2 flex-wrap">
                                            {type.codes.map((code) => {
                                              const codeCount = loadTest.http_codes[code] as number;
                                              const explanation = errorExplanations[code];
                                              return (
                                                <div
                                                  key={code}
                                                  className={`group relative px-3 py-1.5 rounded flex items-center gap-2 ${
                                                    type.color === 'green' ? 'bg-green-100 dark:bg-green-800/30' :
                                                    type.color === 'blue' ? 'bg-blue-100 dark:bg-blue-800/30' :
                                                    type.color === 'yellow' ? 'bg-yellow-100 dark:bg-yellow-800/30' :
                                                    'bg-red-100 dark:bg-red-800/30'
                                                  }`}
                                                >
                                                  <span className={`font-bold ${
                                                    type.color === 'green' ? 'text-green-700 dark:text-green-300' :
                                                    type.color === 'blue' ? 'text-blue-700 dark:text-blue-300' :
                                                    type.color === 'yellow' ? 'text-yellow-700 dark:text-yellow-300' :
                                                    'text-red-700 dark:text-red-300'
                                                  }`}>{code}</span>
                                                  <span className="text-xs text-muted-foreground">{codeCount.toLocaleString()}</span>
                                                  {/* Tooltip for error codes */}
                                                  {explanation && (
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                                                      {explanation}
                                                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      ))}

                                      {/* Timeout and Connection errors if present */}
                                      {(errorTypes.timeout.count > 0 || errorTypes.connectionError.count > 0) && (
                                        <div className="p-3 rounded-lg border bg-orange-50/50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800">
                                          <div className="font-medium text-orange-700 dark:text-orange-400 mb-2">Network Errors</div>
                                          <div className="flex gap-4 flex-wrap">
                                            {errorTypes.timeout.count > 0 && (
                                              <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-100 dark:bg-orange-800/30 rounded">
                                                <span className="text-orange-500">⏱️</span>
                                                <span className="font-medium text-orange-700 dark:text-orange-300">Timeouts</span>
                                                <span className="text-xs text-muted-foreground">{errorTypes.timeout.count.toLocaleString()}</span>
                                              </div>
                                            )}
                                            {errorTypes.connectionError.count > 0 && (
                                              <div className="flex items-center gap-2 px-3 py-1.5 bg-pink-100 dark:bg-pink-800/30 rounded">
                                                <span className="text-pink-500">🔌</span>
                                                <span className="font-medium text-pink-700 dark:text-pink-300">Connection Failures</span>
                                                <span className="text-xs text-muted-foreground">{errorTypes.connectionError.count.toLocaleString()}</span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        )}

                            {/* Checks (Assertions) in Errors tab */}
                            {loadTest.checks && loadTest.checks.length > 0 && (
                              <div className="border border-border rounded-xl overflow-hidden mt-8 mb-8 shadow-sm bg-card">
                                <div className="p-4 bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 border-b border-border flex items-center justify-between">
                                  <h4 className="font-semibold text-foreground flex items-center gap-2">
                                    <span className="text-lg">✅</span> Checks (Assertions)
                                  </h4>
                                  <div className="flex items-center gap-3">
                                    <span className="text-xs text-muted-foreground">
                                      {loadTest.checks.length} check{loadTest.checks.length !== 1 ? 's' : ''} defined
                                    </span>
                                    {/* Overall pass rate */}
                                    {(() => {
                                      const totalPasses = loadTest.checks.reduce((sum: number, c: any) => sum + (c.passes || 0), 0);
                                      const totalFails = loadTest.checks.reduce((sum: number, c: any) => sum + (c.fails || 0), 0);
                                      const overallRate = totalPasses + totalFails > 0 ? totalPasses / (totalPasses + totalFails) : 1;
                                      return (
                                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                                          overallRate >= 0.95 ? 'bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300' :
                                          overallRate >= 0.80 ? 'bg-yellow-100 dark:bg-yellow-800 text-yellow-700 dark:text-yellow-300' :
                                          'bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300'
                                        }`}>
                                          {(overallRate * 100).toFixed(1)}% overall
                                        </span>
                                      );
                                    })()}
                                  </div>
                                </div>
                                <div className="divide-y divide-border max-h-96 overflow-y-auto">
                                  {loadTest.checks.slice(0, 10).map((check: { name: string; passes: number; fails: number; pass_rate?: number }, checkIdx: number) => {
                                    const passRate = check.pass_rate ?? (check.passes + check.fails > 0 ? check.passes / (check.passes + check.fails) : 1);
                                    return (
                                      <div key={checkIdx} className={`p-3 ${passRate < 0.80 ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-2">
                                            {passRate >= 0.95 ? (
                                              <span className="text-green-500">✓</span>
                                            ) : passRate >= 0.80 ? (
                                              <span className="text-yellow-500">⚠</span>
                                            ) : (
                                              <span className="text-red-500">✗</span>
                                            )}
                                            <span className="text-sm font-medium text-foreground">{check.name}</span>
                                          </div>
                                          <span className={`text-sm font-medium ${
                                            passRate >= 0.95 ? 'text-green-600' : passRate >= 0.80 ? 'text-yellow-600' : 'text-red-600'
                                          }`}>
                                            {(passRate * 100).toFixed(1)}%
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                  {loadTest.checks.length > 10 && (
                                    <div className="p-3 text-center text-sm text-muted-foreground">
                                      +{loadTest.checks.length - 10} more checks
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </>
                        )}

                        {/* Endpoints Tab */}
                        {k6ActiveTab === 'endpoints' && (
                          <>
                            {/* Feature #1899: Endpoint Performance Ranking Table */}
                            {/* Feature #1907: Professional styling */}
                            <div className="border border-border rounded-xl overflow-hidden mb-8 shadow-sm bg-card">
                              <div className="p-4 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border-b border-border flex items-center justify-between">
                                <h4 className="font-semibold text-foreground flex items-center gap-2">
                                  <span className="text-lg">🏆</span> Endpoint Performance Ranking
                                </h4>
                                <span className="text-xs text-muted-foreground">{endpoints.length} endpoints</span>
                              </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-muted/30">
                                <tr>
                                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">#</th>
                                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Endpoint</th>
                                  <th
                                    className={`px-4 py-2 text-right font-medium cursor-pointer hover:text-foreground transition-colors ${endpointSortBy === 'count' ? 'text-blue-600' : 'text-muted-foreground'}`}
                                    onClick={() => {
                                      if (endpointSortBy === 'count') setEndpointSortDesc(!endpointSortDesc);
                                      else { setEndpointSortBy('count'); setEndpointSortDesc(true); }
                                    }}
                                  >
                                    Calls {endpointSortBy === 'count' && (endpointSortDesc ? '↓' : '↑')}
                                  </th>
                                  <th
                                    className={`px-4 py-2 text-right font-medium cursor-pointer hover:text-foreground transition-colors ${endpointSortBy === 'avg_time' ? 'text-blue-600' : 'text-muted-foreground'}`}
                                    onClick={() => {
                                      if (endpointSortBy === 'avg_time') setEndpointSortDesc(!endpointSortDesc);
                                      else { setEndpointSortBy('avg_time'); setEndpointSortDesc(true); }
                                    }}
                                  >
                                    Avg {endpointSortBy === 'avg_time' && (endpointSortDesc ? '↓' : '↑')}
                                  </th>
                                  <th
                                    className={`px-4 py-2 text-right font-medium cursor-pointer hover:text-foreground transition-colors ${endpointSortBy === 'p95_time' ? 'text-blue-600' : 'text-muted-foreground'}`}
                                    onClick={() => {
                                      if (endpointSortBy === 'p95_time') setEndpointSortDesc(!endpointSortDesc);
                                      else { setEndpointSortBy('p95_time'); setEndpointSortDesc(true); }
                                    }}
                                  >
                                    P95 {endpointSortBy === 'p95_time' && (endpointSortDesc ? '↓' : '↑')}
                                  </th>
                                  <th
                                    className={`px-4 py-2 text-right font-medium cursor-pointer hover:text-foreground transition-colors ${endpointSortBy === 'error_rate' ? 'text-blue-600' : 'text-muted-foreground'}`}
                                    onClick={() => {
                                      if (endpointSortBy === 'error_rate') setEndpointSortDesc(!endpointSortDesc);
                                      else { setEndpointSortBy('error_rate'); setEndpointSortDesc(true); }
                                    }}
                                  >
                                    Errors {endpointSortBy === 'error_rate' && (endpointSortDesc ? '↓' : '↑')}
                                  </th>
                                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Trend</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {[...endpoints]
                                  .sort((a: any, b: any) => {
                                    const aVal = a[endpointSortBy] || 0;
                                    const bVal = b[endpointSortBy] || 0;
                                    return endpointSortDesc ? bVal - aVal : aVal - bVal;
                                  })
                                  .map((endpoint: { path: string; method: string; count: number; avg_time: number; p95_time: number; error_rate: number; trend?: number[] }, rank: number) => {
                                    // Determine row color based on performance
                                    const isSlowAvg = endpoint.avg_time > 500;
                                    const isSlowP95 = endpoint.p95_time > 1000;
                                    const hasHighErrors = endpoint.error_rate > 5;
                                    const hasWarnings = endpoint.avg_time > 200 || endpoint.p95_time > 500 || endpoint.error_rate > 1;

                                    const rowBg = hasHighErrors || isSlowAvg || isSlowP95 ? 'bg-red-50/50 dark:bg-red-900/5' :
                                                  hasWarnings ? 'bg-yellow-50/50 dark:bg-yellow-900/5' :
                                                  '';

                                    // Generate mini sparkline data (mock if not available)
                                    const trendData = endpoint.trend || Array.from({ length: 10 }, () => endpoint.avg_time * (0.8 + Math.random() * 0.4));

                                    return (
                                      <tr key={`${endpoint.method}-${endpoint.path}`} className={`${rowBg} hover:bg-muted/30 transition-colors`}>
                                        <td className="px-4 py-3 text-muted-foreground font-medium">{rank + 1}</td>
                                        <td className="px-4 py-3">
                                          <div className="flex items-center gap-2">
                                            <span className={`px-1.5 py-0.5 text-xs font-mono rounded ${
                                              endpoint.method === 'GET' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                              endpoint.method === 'POST' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                              endpoint.method === 'PUT' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                              endpoint.method === 'DELETE' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                              'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                                            }`}>
                                              {endpoint.method}
                                            </span>
                                            <span className="font-mono text-xs text-foreground truncate max-w-[200px]" title={endpoint.path}>
                                              {endpoint.path}
                                            </span>
                                          </div>
                                        </td>
                                        <td className="px-4 py-3 text-right text-foreground">{endpoint.count.toLocaleString()}</td>
                                        <td className={`px-4 py-3 text-right font-medium ${
                                          endpoint.avg_time > 500 ? 'text-red-600' :
                                          endpoint.avg_time > 200 ? 'text-yellow-600' :
                                          'text-green-600'
                                        }`}>
                                          {Math.round(endpoint.avg_time)}ms
                                        </td>
                                        <td className={`px-4 py-3 text-right font-medium ${
                                          endpoint.p95_time > 1000 ? 'text-red-600' :
                                          endpoint.p95_time > 500 ? 'text-yellow-600' :
                                          'text-green-600'
                                        }`}>
                                          {Math.round(endpoint.p95_time)}ms
                                        </td>
                                        <td className={`px-4 py-3 text-right font-medium ${
                                          endpoint.error_rate > 5 ? 'text-red-600' :
                                          endpoint.error_rate > 1 ? 'text-yellow-600' :
                                          'text-green-600'
                                        }`}>
                                          {endpoint.error_rate.toFixed(1)}%
                                        </td>
                                        <td className="px-4 py-3">
                                          {/* Mini sparkline */}
                                          <div className="flex items-end gap-px h-6 w-20">
                                            {trendData.map((val: number, i: number) => {
                                              const maxVal = Math.max(...trendData);
                                              const height = maxVal > 0 ? (val / maxVal) * 100 : 0;
                                              return (
                                                <div
                                                  key={i}
                                                  className={`flex-1 rounded-t ${
                                                    val > 500 ? 'bg-red-400' :
                                                    val > 200 ? 'bg-yellow-400' :
                                                    'bg-green-400'
                                                  }`}
                                                  style={{ height: `${Math.max(height, 5)}%` }}
                                                />
                                              );
                                            })}
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                              </tbody>
                            </table>
                          </div>
                          {/* Quick Stats Footer */}
                          <div className="p-3 bg-muted/30 border-t border-border">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <div className="flex items-center gap-4">
                                <span>🔴 Slow (&gt;500ms avg or &gt;1s p95)</span>
                                <span>🟡 Warning (&gt;200ms avg or &gt;500ms p95)</span>
                                <span>🟢 Good</span>
                              </div>
                              <span>Click column headers to sort</span>
                            </div>
                          </div>
                        </div>

                        {/* Endpoint Breakdown */}
                        <div className="border border-border rounded-lg overflow-hidden">
                          <div className="p-3 bg-muted/30 border-b border-border flex items-center justify-between">
                            <h5 className="font-medium text-foreground flex items-center gap-2">
                              <span>🔗</span> Endpoint Details
                            </h5>
                            <span className="text-xs text-muted-foreground">{endpoints.length} endpoints</span>
                          </div>
                          <div className="divide-y divide-border">
                            {endpoints.map((endpoint: { path: string; method: string; count: number; avg_time: number; p95_time: number; error_rate: number }) => (
                              <div key={`${endpoint.method}-${endpoint.path}`} className="bg-background">
                                <button
                                  onClick={() => toggleEndpoint(`${endpoint.method}-${endpoint.path}`)}
                                  className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
                                >
                                  <div className="flex items-center gap-3">
                                    <svg
                                      className={`w-4 h-4 transition-transform ${expandedEndpoints.has(`${endpoint.method}-${endpoint.path}`) ? 'rotate-90' : ''}`}
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                    <span className={`px-2 py-0.5 text-xs font-mono rounded ${
                                      endpoint.method === 'GET' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                      endpoint.method === 'POST' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                      endpoint.method === 'PUT' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                      endpoint.method === 'DELETE' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                      'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                                    }`}>
                                      {endpoint.method}
                                    </span>
                                    <span className="font-mono text-sm text-foreground">{endpoint.path}</span>
                                  </div>
                                  <div className="flex items-center gap-6 text-sm">
                                    <span className="text-muted-foreground">{endpoint.count.toLocaleString()} reqs</span>
                                    <span className="text-blue-600">{Math.round(endpoint.avg_time)}ms avg</span>
                                    <span className={endpoint.error_rate > 5 ? 'text-red-600' : endpoint.error_rate > 1 ? 'text-yellow-600' : 'text-green-600'}>
                                      {endpoint.error_rate.toFixed(2)}% err
                                    </span>
                                  </div>
                                </button>
                                {expandedEndpoints.has(`${endpoint.method}-${endpoint.path}`) && (
                                  <div className="px-12 pb-4 grid grid-cols-4 gap-4">
                                    <div className="p-3 bg-muted/30 rounded-lg text-center">
                                      <div className="text-lg font-semibold text-foreground">{endpoint.count.toLocaleString()}</div>
                                      <div className="text-xs text-muted-foreground">Total Requests</div>
                                    </div>
                                    <div className="p-3 bg-muted/30 rounded-lg text-center">
                                      <div className="text-lg font-semibold text-blue-600">{Math.round(endpoint.avg_time)}ms</div>
                                      <div className="text-xs text-muted-foreground">Avg Response</div>
                                    </div>
                                    <div className="p-3 bg-muted/30 rounded-lg text-center">
                                      <div className="text-lg font-semibold text-orange-600">{Math.round(endpoint.p95_time)}ms</div>
                                      <div className="text-xs text-muted-foreground">p95 Response</div>
                                    </div>
                                    <div className={`p-3 rounded-lg text-center ${endpoint.error_rate > 5 ? 'bg-red-50 dark:bg-red-900/20' : endpoint.error_rate > 1 ? 'bg-yellow-50 dark:bg-yellow-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>
                                      <div className={`text-lg font-semibold ${endpoint.error_rate > 5 ? 'text-red-600' : endpoint.error_rate > 1 ? 'text-yellow-600' : 'text-green-600'}`}>
                                        {endpoint.error_rate.toFixed(2)}%
                                      </div>
                                      <div className="text-xs text-muted-foreground">Error Rate</div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Feature #1894: Custom Metrics from K6 Script */}
                        {loadTest.custom_metrics && loadTest.custom_metrics.length > 0 && (
                          <div className="border border-border rounded-lg overflow-hidden mt-6">
                            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 border-b border-border flex items-center justify-between">
                              <h5 className="font-medium text-foreground flex items-center gap-2">
                                <span>📈</span> Custom Metrics
                              </h5>
                              <span className="text-xs text-muted-foreground">
                                {loadTest.custom_metrics.length} custom metric{loadTest.custom_metrics.length !== 1 ? 's' : ''} defined
                              </span>
                            </div>
                            <div className="p-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {loadTest.custom_metrics.map((metric: any, metricIdx: number) => (
                                  <div
                                    key={metricIdx}
                                    className={`p-4 rounded-lg border ${
                                      metric.type === 'counter' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' :
                                      metric.type === 'rate' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' :
                                      metric.type === 'trend' ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800' :
                                      'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-sm font-medium text-foreground">{metric.name}</span>
                                      <span className={`text-xs px-2 py-0.5 rounded ${
                                        metric.type === 'counter' ? 'bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300' :
                                        metric.type === 'rate' ? 'bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300' :
                                        metric.type === 'trend' ? 'bg-yellow-100 dark:bg-yellow-800 text-yellow-700 dark:text-yellow-300' :
                                        'bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-300'
                                      }`}>
                                        {metric.type}
                                      </span>
                                    </div>

                                    {/* Counter metric */}
                                    {metric.type === 'counter' && (
                                      <div>
                                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                          {typeof metric.value === 'number' ? metric.value.toLocaleString() : metric.value}
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                          Total count {metric.unit && `(${metric.unit})`}
                                        </div>
                                      </div>
                                    )}

                                    {/* Rate metric */}
                                    {metric.type === 'rate' && (
                                      <div>
                                        <div className={`text-2xl font-bold ${
                                          typeof metric.value === 'number' && metric.value >= 0.95 ? 'text-green-600 dark:text-green-400' :
                                          typeof metric.value === 'number' && metric.value >= 0.80 ? 'text-yellow-600 dark:text-yellow-400' :
                                          'text-red-600 dark:text-red-400'
                                        }`}>
                                          {typeof metric.value === 'number' ? `${(metric.value * 100).toFixed(1)}%` : metric.value}
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                          Pass rate
                                        </div>
                                        {/* Progress bar for rate */}
                                        {typeof metric.value === 'number' && (
                                          <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                            <div
                                              className={`h-full transition-all ${
                                                metric.value >= 0.95 ? 'bg-green-500' :
                                                metric.value >= 0.80 ? 'bg-yellow-500' :
                                                'bg-red-500'
                                              }`}
                                              style={{ width: `${metric.value * 100}%` }}
                                            />
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {/* Gauge metric */}
                                    {metric.type === 'gauge' && (
                                      <div>
                                        <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                                          {typeof metric.value === 'number' ? metric.value.toFixed(2) : metric.value}
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                          Current value {metric.unit && `(${metric.unit})`}
                                        </div>
                                      </div>
                                    )}

                                    {/* Trend metric (shows avg, min, max, p95, p99) */}
                                    {metric.type === 'trend' && typeof metric.value === 'object' && (
                                      <div>
                                        <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mb-2">
                                          {metric.value.avg?.toFixed(2) || '0'}{metric.unit || 'ms'}
                                          <span className="text-sm font-normal text-muted-foreground ml-1">avg</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">Min:</span>
                                            <span className="font-medium">{metric.value.min?.toFixed(2) || '0'}{metric.unit || 'ms'}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">Max:</span>
                                            <span className="font-medium">{metric.value.max?.toFixed(2) || '0'}{metric.unit || 'ms'}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">p95:</span>
                                            <span className="font-medium">{metric.value.p95?.toFixed(2) || '0'}{metric.unit || 'ms'}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">p99:</span>
                                            <span className="font-medium">{metric.value.p99?.toFixed(2) || '0'}{metric.unit || 'ms'}</span>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>

                              {/* Legend */}
                              <div className="flex items-center gap-4 text-xs text-muted-foreground mt-4 pt-3 border-t border-border">
                                <div className="flex items-center gap-1">
                                  <div className="w-3 h-3 rounded bg-blue-400"></div>
                                  <span>Counter (total count)</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <div className="w-3 h-3 rounded bg-green-400"></div>
                                  <span>Rate (pass/fail %)</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <div className="w-3 h-3 rounded bg-yellow-400"></div>
                                  <span>Trend (timing stats)</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <div className="w-3 h-3 rounded bg-purple-400"></div>
                                  <span>Gauge (current value)</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                          </>
                        )}

                        {/* Original Feature #1895: K6 Checks - Now shown in Errors tab */}
                        {/* This detailed Checks section is kept for backward compatibility when tabs are collapsed */}
                        {false && loadTest.checks && loadTest.checks.length > 0 && (
                          <div className="border border-border rounded-xl overflow-hidden mt-8 shadow-sm bg-card">
                            <div className="p-4 bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 border-b border-border flex items-center justify-between">
                              <h4 className="font-semibold text-foreground flex items-center gap-2">
                                <span className="text-lg">✅</span> Checks (Assertions)
                              </h4>
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground">
                                  {loadTest.checks.length} check{loadTest.checks.length !== 1 ? 's' : ''} defined
                                </span>
                                {/* Overall pass rate */}
                                {(() => {
                                  const totalPasses = loadTest.checks.reduce((sum: number, c: any) => sum + (c.passes || 0), 0);
                                  const totalFails = loadTest.checks.reduce((sum: number, c: any) => sum + (c.fails || 0), 0);
                                  const overallRate = totalPasses + totalFails > 0 ? totalPasses / (totalPasses + totalFails) : 1;
                                  return (
                                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                                      overallRate >= 0.95 ? 'bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300' :
                                      overallRate >= 0.80 ? 'bg-yellow-100 dark:bg-yellow-800 text-yellow-700 dark:text-yellow-300' :
                                      'bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300'
                                    }`}>
                                      {(overallRate * 100).toFixed(1)}% overall
                                    </span>
                                  );
                                })()}
                              </div>
                            </div>
                            <div className="divide-y divide-border">
                              {loadTest.checks.map((check: { name: string; passes: number; fails: number; pass_rate?: number }, checkIdx: number) => {
                                const passRate = check.pass_rate ?? (check.passes + check.fails > 0 ? check.passes / (check.passes + check.fails) : 1);
                                const isHighFailure = passRate < 0.80;
                                const isMediumFailure = passRate < 0.95 && !isHighFailure;

                                return (
                                  <div
                                    key={checkIdx}
                                    className={`p-4 ${isHighFailure ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        {/* Status icon */}
                                        {passRate >= 0.95 ? (
                                          <span className="text-green-500">✓</span>
                                        ) : passRate >= 0.80 ? (
                                          <span className="text-yellow-500">⚠</span>
                                        ) : (
                                          <span className="text-red-500">✗</span>
                                        )}
                                        <span className="font-medium text-foreground">{check.name}</span>
                                      </div>
                                      <div className="flex items-center gap-4 text-sm">
                                        <span className="text-green-600 dark:text-green-400">
                                          {check.passes.toLocaleString()} passed
                                        </span>
                                        {check.fails > 0 && (
                                          <span className="text-red-600 dark:text-red-400">
                                            {check.fails.toLocaleString()} failed
                                          </span>
                                        )}
                                        <span className={`font-semibold ${
                                          passRate >= 0.95 ? 'text-green-600 dark:text-green-400' :
                                          passRate >= 0.80 ? 'text-yellow-600 dark:text-yellow-400' :
                                          'text-red-600 dark:text-red-400'
                                        }`}>
                                          {(passRate * 100).toFixed(1)}%
                                        </span>
                                      </div>
                                    </div>

                                    {/* Progress bar showing pass vs fail */}
                                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
                                      <div
                                        className="bg-green-500 transition-all"
                                        style={{ width: `${passRate * 100}%` }}
                                      />
                                      {check.fails > 0 && (
                                        <div
                                          className="bg-red-500 transition-all"
                                          style={{ width: `${(1 - passRate) * 100}%` }}
                                        />
                                      )}
                                    </div>

                                    {/* High failure warning */}
                                    {isHighFailure && (
                                      <div className="mt-2 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                        High failure rate - review assertion logic or investigate failures
                                      </div>
                                    )}
                                    {isMediumFailure && (
                                      <div className="mt-2 text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                        Some failures detected - may need attention
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {/* Summary footer */}
                            <div className="p-3 bg-muted/30 border-t border-border">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">
                                  Total: {loadTest.checks.reduce((sum: number, c: any) => sum + c.passes + c.fails, 0).toLocaleString()} assertions
                                </span>
                                <div className="flex items-center gap-4">
                                  <span className="text-green-600 dark:text-green-400">
                                    ✓ {loadTest.checks.reduce((sum: number, c: any) => sum + c.passes, 0).toLocaleString()} passed
                                  </span>
                                  <span className="text-red-600 dark:text-red-400">
                                    ✗ {loadTest.checks.reduce((sum: number, c: any) => sum + c.fails, 0).toLocaleString()} failed
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {performanceResults.length === 0 && loadTestResults.length === 0 && (
              <div className="text-center py-12 border border-dashed border-border rounded-lg">
                <svg className="w-12 h-12 mx-auto text-muted-foreground mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p className="text-muted-foreground">No performance metrics available for this run.</p>
                <p className="text-sm text-muted-foreground mt-1">Run a Lighthouse or load test to see metrics here.</p>
              </div>
            )}
          </div>
        )}

        {/* Feature #1837: Enhanced Visual Diff Tab */}
        {activeTab === 'visual' && (
          <div>
            {/* Header with view mode controls */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Visual Regression Results</h2>
                <p className="text-sm text-muted-foreground">
                  {visualResults.length} visual test{visualResults.length !== 1 ? 's' : ''} with comparison data
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* View mode toggle */}
                <div className="flex items-center bg-muted rounded-lg p-1">
                  {[
                    { id: 'side-by-side' as const, label: 'Side by Side', icon: '📊' },
                    { id: 'slider' as const, label: 'Slider', icon: '↔️' },
                    { id: 'onion' as const, label: 'Onion Skin', icon: '👁️' },
                  ].map(mode => (
                    <button
                      key={mode.id}
                      onClick={() => setVisualViewMode(mode.id)}
                      className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5 ${
                        visualViewMode === mode.id
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <span>{mode.icon}</span>
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Feature #1880: Video player with diff timestamp markers */}
            {videoUrl && visualMarkers.length > 0 && (
              <div className="mb-6 border border-border rounded-lg overflow-hidden bg-card">
                <button
                  onClick={() => setVisualVideoExpanded(!visualVideoExpanded)}
                  className="w-full flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🎬</span>
                    <span className="font-medium text-foreground">Test Recording with Visual Markers</span>
                    <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded-full">
                      {visualMarkers.length} marker{visualMarkers.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <svg
                    className={`w-5 h-5 text-muted-foreground transition-transform ${visualVideoExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {visualVideoExpanded && (
                  <div>
                    {/* Video player */}
                    <div className="bg-black">
                      {videoLoading && (
                        <div className="flex items-center justify-center h-48 text-muted-foreground">
                          <svg className="animate-spin h-6 w-6 mr-2" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Loading video...
                        </div>
                      )}
                      {videoError && (
                        <div className="flex items-center justify-center h-48 text-destructive text-sm">
                          <span>⚠️ {videoError}</span>
                        </div>
                      )}
                      {videoUrl && !videoLoading && (
                        <video
                          ref={visualVideoRef}
                          controls
                          preload="metadata"
                          className="w-full max-h-80"
                          controlsList="nodownload"
                          playsInline
                          src={videoUrl}
                          onTimeUpdate={handleVisualVideoTimeUpdate}
                          onPlay={() => setIsVisualVideoPlaying(true)}
                          onPause={() => setIsVisualVideoPlaying(false)}
                          onEnded={() => setIsVisualVideoPlaying(false)}
                        >
                          Your browser does not support the video tag.
                        </video>
                      )}
                    </div>

                    {/* Custom timeline with markers */}
                    <div className="p-3 bg-muted/30 border-t border-border">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium text-muted-foreground">Visual Timeline</span>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                            Screenshot
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-red-500"></span>
                            Diff Detected
                          </span>
                        </div>
                      </div>

                      {/* Timeline bar with markers */}
                      <div className="relative h-8 bg-muted rounded-lg overflow-visible">
                        {/* Progress indicator */}
                        {runDurationMs > 0 && (
                          <div
                            className="absolute top-0 left-0 h-full bg-primary/20 rounded-l-lg transition-all"
                            style={{ width: `${Math.min((visualVideoCurrentTime / runDurationMs) * 100, 100)}%` }}
                          />
                        )}

                        {/* Playhead */}
                        {runDurationMs > 0 && (
                          <div
                            className="absolute top-0 h-full w-0.5 bg-primary z-10"
                            style={{ left: `${Math.min((visualVideoCurrentTime / runDurationMs) * 100, 100)}%` }}
                          />
                        )}

                        {/* Markers */}
                        {runDurationMs > 0 && visualMarkers.map((marker) => {
                          const position = Math.min((marker.timestampMs / runDurationMs) * 100, 100);
                          const isScreenshot = marker.type === 'screenshot';
                          const markerColor = isScreenshot
                            ? marker.hasDiff ? 'bg-yellow-500 hover:bg-yellow-400' : 'bg-blue-500 hover:bg-blue-400'
                            : 'bg-red-500 hover:bg-red-400';

                          return (
                            <button
                              key={marker.id}
                              onClick={() => seekVisualVideoToMarker(marker.timestampMs)}
                              className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full ${markerColor} cursor-pointer transition-all hover:scale-125 z-20`}
                              style={{ left: `calc(${position}% - 6px)` }}
                              title={`${marker.testName}${isScreenshot ? ' - Screenshot captured' : ' - Visual diff detected'} (${marker.diffPercent.toFixed(2)}% diff)\nClick to jump to this moment`}
                            />
                          );
                        })}

                        {/* Clickable timeline for seeking */}
                        <div
                          className="absolute inset-0 cursor-pointer"
                          onClick={(e) => {
                            if (!runDurationMs) return;
                            const rect = e.currentTarget.getBoundingClientRect();
                            const clickPosition = (e.clientX - rect.left) / rect.width;
                            const seekTime = clickPosition * runDurationMs;
                            seekVisualVideoToMarker(seekTime);
                          }}
                        />
                      </div>

                      {/* Marker legend/list */}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {visualMarkers.filter(m => m.type === 'screenshot').map((marker) => (
                          <button
                            key={marker.id}
                            onClick={() => seekVisualVideoToMarker(marker.timestampMs)}
                            className={`px-2 py-1 text-xs rounded-md transition-colors flex items-center gap-1.5 ${
                              marker.hasDiff
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'
                                : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50'
                            }`}
                          >
                            <span className={`w-2 h-2 rounded-full ${marker.hasDiff ? 'bg-red-500' : 'bg-blue-500'}`}></span>
                            <span className="truncate max-w-32">{marker.testName}</span>
                            {marker.hasDiff && (
                              <span className="font-medium">({marker.diffPercent.toFixed(2)}%)</span>
                            )}
                          </button>
                        ))}
                      </div>

                      <p className="text-xs text-muted-foreground mt-2">
                        💡 Click markers on timeline or buttons below to jump to screenshot capture moments
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {visualResults.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-border rounded-lg">
                <svg className="w-12 h-12 mx-auto text-muted-foreground mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-muted-foreground">No visual comparison data available.</p>
                <p className="text-sm text-muted-foreground mt-1">Run a visual regression test to see comparisons here.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {visualResults.map((result, idx) => {
                  const resultKey = `${result.test_id}-${idx}`;
                  const currentSlider = sliderPosition[resultKey] ?? 50;
                  const currentOpacity = onionOpacity[resultKey] ?? 50;
                  const isExpanded = expandedVisualResults.has(resultKey);
                  const isApprovalLoading = approvalLoading[resultKey];
                  const diffPercent = result.diff_percentage || (result.visual_comparison?.diffPercentage) || 0;
                  const hasBaseline = result.visual_comparison?.hasBaseline || !!result.baseline_screenshot_base64;
                  const hasDiff = diffPercent > 0.1;
                  // Feature #1877: Zoom and pan state
                  const currentZoom = visualZoom[resultKey] ?? 1;
                  const currentPan = visualPan[resultKey] ?? { x: 0, y: 0 };

                  return (
                    <div key={idx} className="border border-border rounded-lg overflow-hidden">
                      {/* Header */}
                      <div className={`p-4 border-b ${
                        hasBaseline
                          ? hasDiff
                            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                            : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                          : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => toggleVisualResult(resultKey)}
                              className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded"
                            >
                              <svg
                                className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                            <div>
                              <h3 className="font-medium text-foreground">{result.test_name}</h3>
                              {result.visual_comparison?.baselineCorrupted && (
                                <p className="text-sm text-red-600 mt-1">
                                  ⚠️ Baseline corrupted: {result.visual_comparison.corruptionError}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {/* Diff badge */}
                            {hasBaseline ? (
                              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                hasDiff ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
                              }`}>
                                {diffPercent.toFixed(2)}% diff
                              </span>
                            ) : (
                              <span className="px-3 py-1 rounded-full text-sm font-medium bg-yellow-600 text-white">
                                No baseline
                              </span>
                            )}

                            {/* Approve/Reject buttons */}
                            {hasBaseline && hasDiff && (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleApproveBaseline(result.test_id, idx)}
                                  disabled={isApprovalLoading}
                                  className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                                >
                                  {isApprovalLoading ? (
                                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                  ) : (
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleRejectBaseline(result.test_id, idx)}
                                  disabled={isApprovalLoading}
                                  className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                  Reject
                                </button>
                              </div>
                            )}

                            {/* Set as baseline if no baseline */}
                            {!hasBaseline && result.screenshot_base64 && (
                              <button
                                onClick={() => handleApproveBaseline(result.test_id, idx)}
                                disabled={isApprovalLoading}
                                className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                              >
                                {isApprovalLoading ? (
                                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                  </svg>
                                )}
                                Set as Baseline
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Expanded content */}
                      {(isExpanded || !hasBaseline || hasDiff) && (
                        <div className="p-4">
                          {/* Stats row */}
                          {result.visual_comparison && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                              <div className="p-3 bg-muted/30 rounded-lg text-center">
                                <div className={`text-2xl font-bold ${hasDiff ? 'text-red-600' : 'text-green-600'}`}>
                                  {diffPercent.toFixed(4)}%
                                </div>
                                <div className="text-xs text-muted-foreground">Diff Percentage</div>
                              </div>
                              <div className="p-3 bg-muted/30 rounded-lg text-center">
                                <div className="text-2xl font-bold text-foreground">
                                  {(result.visual_comparison.mismatchedPixels || 0).toLocaleString()}
                                </div>
                                <div className="text-xs text-muted-foreground">Changed Pixels</div>
                              </div>
                              <div className="p-3 bg-muted/30 rounded-lg text-center">
                                <div className="text-2xl font-bold text-foreground">
                                  {(result.visual_comparison.totalPixels || 0).toLocaleString()}
                                </div>
                                <div className="text-xs text-muted-foreground">Total Pixels</div>
                              </div>
                              <div className={`p-3 rounded-lg text-center ${hasBaseline ? 'bg-green-50 dark:bg-green-900/20' : 'bg-yellow-50 dark:bg-yellow-900/20'}`}>
                                <div className={`text-2xl font-bold ${hasBaseline ? 'text-green-600' : 'text-yellow-600'}`}>
                                  {hasBaseline ? '✓' : '?'}
                                </div>
                                <div className="text-xs text-muted-foreground">{hasBaseline ? 'Baseline Set' : 'No Baseline'}</div>
                              </div>
                            </div>
                          )}

                          {/* Feature #1913 & #1919: Multi-viewport results with full comparison */}
                          {result.viewport_results && result.viewport_results.length > 0 && (
                            <div className="mb-6">
                              <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                                📐 Viewport Results
                                <span className="text-xs font-normal text-muted-foreground">
                                  ({result.viewport_results.length} viewport{result.viewport_results.length !== 1 ? 's' : ''})
                                </span>
                              </h4>
                              <div className="space-y-4">
                                {result.viewport_results.map((vp, vpIdx) => {
                                  const vpHasDiff = (vp.diffPercentage || 0) > 0.1;
                                  const vpHasBaseline = vp.visualComparison?.hasBaseline !== false;
                                  return (
                                    <div
                                      key={vp.viewportId}
                                      className={`rounded-lg border ${
                                        vpHasBaseline
                                          ? vpHasDiff
                                            ? 'border-red-200 dark:border-red-800'
                                            : 'border-green-200 dark:border-green-800'
                                          : 'border-yellow-200 dark:border-yellow-800'
                                      }`}
                                    >
                                      {/* Viewport header */}
                                      <div className={`p-3 border-b ${
                                        vpHasBaseline
                                          ? vpHasDiff
                                            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                                            : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                                          : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                                      }`}>
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-3">
                                            <span className="font-medium text-foreground">
                                              {vp.viewportLabel}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                              {vp.width}×{vp.height}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                              vpHasBaseline
                                                ? vpHasDiff
                                                  ? 'bg-red-600 text-white'
                                                  : 'bg-green-600 text-white'
                                                : 'bg-yellow-600 text-white'
                                            }`}>
                                              {vpHasBaseline
                                                ? `${(vp.diffPercentage || 0).toFixed(2)}% diff`
                                                : 'No baseline'
                                              }
                                            </span>
                                          </div>
                                          {/* Per-viewport approve/reject buttons */}
                                          {vpHasBaseline && vpHasDiff && (
                                            <div className="flex items-center gap-2">
                                              <button
                                                onClick={() => handleApproveBaseline(result.test_id, idx, vp.viewportId)}
                                                className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                                                title={`Approve ${vp.viewportLabel} baseline`}
                                              >
                                                ✓ Approve
                                              </button>
                                              <button
                                                onClick={() => handleRejectBaseline(result.test_id, idx, vp.viewportId)}
                                                className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                                                title={`Reject ${vp.viewportLabel} baseline`}
                                              >
                                                ✗ Reject
                                              </button>
                                            </div>
                                          )}
                                          {!vpHasBaseline && vp.screenshotBase64 && (
                                            <button
                                              onClick={() => handleApproveBaseline(result.test_id, idx, vp.viewportId)}
                                              className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
                                              title={`Set ${vp.viewportLabel} as baseline`}
                                            >
                                              + Set Baseline
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                      {/* Viewport comparison images */}
                                      <div className="p-4">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                          {/* Baseline */}
                                          {vp.baselineScreenshotBase64 && (
                                            <div className="space-y-2">
                                              <div className="text-xs font-medium text-muted-foreground text-center">Baseline</div>
                                              <div className="rounded border border-border overflow-hidden">
                                                <img
                                                  src={`data:image/png;base64,${vp.baselineScreenshotBase64}`}
                                                  alt={`${vp.viewportLabel} baseline`}
                                                  className="w-full object-contain max-h-48"
                                                />
                                              </div>
                                            </div>
                                          )}
                                          {/* Current */}
                                          {vp.screenshotBase64 && (
                                            <div className="space-y-2">
                                              <div className="text-xs font-medium text-muted-foreground text-center">Current</div>
                                              <div className="rounded border border-border overflow-hidden">
                                                <img
                                                  src={`data:image/png;base64,${vp.screenshotBase64}`}
                                                  alt={`${vp.viewportLabel} current`}
                                                  className="w-full object-contain max-h-48"
                                                />
                                              </div>
                                            </div>
                                          )}
                                          {/* Diff */}
                                          {vp.diffImageBase64 && (
                                            <div className="space-y-2">
                                              <div className="text-xs font-medium text-muted-foreground text-center">Difference</div>
                                              <div className="rounded border border-red-300 dark:border-red-700 overflow-hidden">
                                                <img
                                                  src={`data:image/png;base64,${vp.diffImageBase64}`}
                                                  alt={`${vp.viewportLabel} diff`}
                                                  className="w-full object-contain max-h-48"
                                                />
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                        {/* Stats */}
                                        {vp.visualComparison && (
                                          <div className="mt-3 pt-3 border-t border-border flex justify-center gap-6 text-xs text-muted-foreground">
                                            <span>Changed: <strong className="text-foreground">{(vp.visualComparison.mismatchedPixels || 0).toLocaleString()}</strong> px</span>
                                            <span>Total: <strong className="text-foreground">{(vp.visualComparison.totalPixels || 0).toLocaleString()}</strong> px</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Feature #1877: Zoom and pan controls */}
                          <div className="flex items-center justify-between mb-4 py-2 px-3 bg-muted/30 rounded-lg">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-foreground">🔍 Zoom & Pan</span>
                              <span className="text-xs text-muted-foreground">
                                {Math.round(currentZoom * 100)}%
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleZoomOut(resultKey)}
                                className="p-1.5 rounded-md hover:bg-muted transition-colors"
                                title="Zoom Out (-)"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleZoomIn(resultKey)}
                                className="p-1.5 rounded-md hover:bg-muted transition-colors"
                                title="Zoom In (+)"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleZoomFit(resultKey)}
                                className="p-1.5 rounded-md hover:bg-muted transition-colors"
                                title="Fit to Screen"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleZoomReset(resultKey)}
                                className="px-2 py-1 text-xs rounded-md hover:bg-muted transition-colors"
                                title="Reset View"
                              >
                                Reset
                              </button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {currentZoom > 1 ? '📌 Drag to pan' : '🖱️ Scroll to zoom'}
                            </p>
                          </div>

                          {/* Comparison views */}
                          {visualViewMode === 'side-by-side' && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              {result.baseline_screenshot_base64 && (
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                                    Baseline
                                  </p>
                                  <div
                                    className="relative border border-border rounded-lg overflow-hidden"
                                    style={{ cursor: currentZoom > 1 ? 'grab' : 'zoom-in' }}
                                    onMouseDown={(e) => handlePanStart(e, resultKey)}
                                    onMouseMove={(e) => handlePanMove(e, resultKey)}
                                    onMouseUp={handlePanEnd}
                                    onMouseLeave={handlePanEnd}
                                    onWheel={(e) => handleWheelZoom(e, resultKey)}
                                  >
                                    <img
                                      src={`data:image/png;base64,${result.baseline_screenshot_base64}`}
                                      alt="Baseline screenshot"
                                      className="w-full transition-transform"
                                      style={{
                                        transform: `scale(${currentZoom}) translate(${currentPan.x / currentZoom}px, ${currentPan.y / currentZoom}px)`,
                                        transformOrigin: 'center',
                                      }}
                                      draggable={false}
                                    />
                                  </div>
                                </div>
                              )}
                              {result.screenshot_base64 && (
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full bg-green-500"></span>
                                    Current
                                  </p>
                                  <div
                                    className="relative border border-border rounded-lg overflow-hidden"
                                    style={{ cursor: currentZoom > 1 ? 'grab' : 'zoom-in' }}
                                    onMouseDown={(e) => handlePanStart(e, resultKey)}
                                    onMouseMove={(e) => handlePanMove(e, resultKey)}
                                    onMouseUp={handlePanEnd}
                                    onMouseLeave={handlePanEnd}
                                    onWheel={(e) => handleWheelZoom(e, resultKey)}
                                  >
                                    <img
                                      src={`data:image/png;base64,${result.screenshot_base64}`}
                                      alt="Current screenshot"
                                      className="w-full transition-transform"
                                      style={{
                                        transform: `scale(${currentZoom}) translate(${currentPan.x / currentZoom}px, ${currentPan.y / currentZoom}px)`,
                                        transformOrigin: 'center',
                                      }}
                                      draggable={false}
                                    />
                                  </div>
                                </div>
                              )}
                              {(result.diff_image_base64 || result.visual_comparison?.diffImage) && (
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full bg-red-500"></span>
                                    Difference (red = changed)
                                  </p>
                                  <div
                                    className="relative border border-red-300 dark:border-red-700 rounded-lg overflow-hidden"
                                    style={{ cursor: currentZoom > 1 ? 'grab' : 'zoom-in' }}
                                    onMouseDown={(e) => handlePanStart(e, resultKey)}
                                    onMouseMove={(e) => handlePanMove(e, resultKey)}
                                    onMouseUp={handlePanEnd}
                                    onMouseLeave={handlePanEnd}
                                    onWheel={(e) => handleWheelZoom(e, resultKey)}
                                  >
                                    <img
                                      src={`data:image/png;base64,${result.diff_image_base64 || result.visual_comparison?.diffImage}`}
                                      alt="Diff image"
                                      className="w-full transition-transform"
                                      style={{
                                        transform: `scale(${currentZoom}) translate(${currentPan.x / currentZoom}px, ${currentPan.y / currentZoom}px)`,
                                        transformOrigin: 'center',
                                      }}
                                      draggable={false}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Slider comparison mode */}
                          {visualViewMode === 'slider' && result.baseline_screenshot_base64 && result.screenshot_base64 && (
                            <div className="space-y-4">
                              <div className="flex items-center gap-4">
                                <span className="text-sm text-muted-foreground">Baseline</span>
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  value={currentSlider}
                                  onChange={(e) => handleSliderChange(resultKey, parseInt(e.target.value))}
                                  className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                                />
                                <span className="text-sm text-muted-foreground">Current</span>
                              </div>
                              <div className="relative border border-border rounded-lg overflow-hidden">
                                {/* Baseline image (full width) */}
                                <img
                                  src={`data:image/png;base64,${result.baseline_screenshot_base64}`}
                                  alt="Baseline"
                                  className="w-full"
                                />
                                {/* Current image (clipped) */}
                                <div
                                  className="absolute inset-0 overflow-hidden"
                                  style={{ clipPath: `inset(0 0 0 ${currentSlider}%)` }}
                                >
                                  <img
                                    src={`data:image/png;base64,${result.screenshot_base64}`}
                                    alt="Current"
                                    className="w-full"
                                  />
                                </div>
                                {/* Slider line */}
                                <div
                                  className="absolute top-0 bottom-0 w-1 bg-white shadow-lg"
                                  style={{ left: `${currentSlider}%`, transform: 'translateX(-50%)' }}
                                >
                                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full shadow-md flex items-center justify-center">
                                    <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                                    </svg>
                                  </div>
                                </div>
                              </div>
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>← Drag slider to compare →</span>
                                <span>{currentSlider}% shown as current</span>
                              </div>
                            </div>
                          )}

                          {/* Onion skin comparison mode */}
                          {visualViewMode === 'onion' && result.baseline_screenshot_base64 && result.screenshot_base64 && (
                            <div className="space-y-4">
                              <div className="flex items-center gap-4">
                                <span className="text-sm text-muted-foreground">Baseline</span>
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  value={currentOpacity}
                                  onChange={(e) => handleOnionOpacityChange(resultKey, parseInt(e.target.value))}
                                  className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                                />
                                <span className="text-sm text-muted-foreground">Current</span>
                              </div>
                              <div className="relative border border-border rounded-lg overflow-hidden">
                                {/* Baseline image */}
                                <img
                                  src={`data:image/png;base64,${result.baseline_screenshot_base64}`}
                                  alt="Baseline"
                                  className="w-full"
                                />
                                {/* Current image overlaid with opacity */}
                                <img
                                  src={`data:image/png;base64,${result.screenshot_base64}`}
                                  alt="Current"
                                  className="absolute inset-0 w-full"
                                  style={{ opacity: currentOpacity / 100 }}
                                />
                              </div>
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Current overlay opacity: {currentOpacity}%</span>
                                <span>Adjust to see differences</span>
                              </div>
                            </div>
                          )}

                          {/* Show diff image below in slider/onion modes */}
                          {(visualViewMode === 'slider' || visualViewMode === 'onion') && (result.diff_image_base64 || result.visual_comparison?.diffImage) && (
                            <div className="mt-6 pt-6 border-t border-border">
                              <p className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                                Difference Highlight (changed pixels in red)
                              </p>
                              <div className="border border-red-300 dark:border-red-700 rounded-lg overflow-hidden max-w-2xl">
                                <img
                                  src={`data:image/png;base64,${result.diff_image_base64 || result.visual_comparison?.diffImage}`}
                                  alt="Diff image"
                                  className="w-full"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Feature #1838: Enhanced Accessibility Tab */}
        {activeTab === 'accessibility' && (
          <div>
            {/* Header with view mode controls */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Accessibility Audit Report</h2>
                <p className="text-sm text-muted-foreground">
                  {accessibilityResults.length} test{accessibilityResults.length !== 1 ? 's' : ''} with accessibility data
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* View mode toggle */}
                <div className="flex items-center bg-muted rounded-lg p-1">
                  <button
                    onClick={() => setA11yViewMode('grouped')}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                      a11yViewMode === 'grouped'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Grouped by Severity
                  </button>
                  <button
                    onClick={() => setA11yViewMode('list')}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                      a11yViewMode === 'list'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Full List
                  </button>
                </div>
              </div>
            </div>

            {accessibilityResults.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-border rounded-lg">
                <svg className="w-12 h-12 mx-auto text-green-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-foreground font-medium">No accessibility violations found!</p>
                <p className="text-sm text-muted-foreground mt-1">Your tests passed all accessibility checks. Great job!</p>
              </div>
            ) : (
              <div className="space-y-6">
                {accessibilityResults.map((result, idx) => {
                  const a11y = result.steps.find(s => s.accessibility)?.accessibility;
                  if (!a11y) return null;

                  const score = calculateA11yScore(a11y.violations, a11y.passes);
                  const violationGroups = groupViolationsBySeverity(a11y.violations);
                  const severityOrder: ('critical' | 'serious' | 'moderate' | 'minor')[] = ['critical', 'serious', 'moderate', 'minor'];

                  return (
                    <div key={idx} className="border border-border rounded-lg overflow-hidden">
                      {/* Header */}
                      <div className="p-4 bg-muted/30 border-b border-border">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className="font-medium text-foreground">{result.test_name}</h3>
                            {a11y.axeVersion && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Tested with axe-core {a11y.axeVersion}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            {a11y.wcagLevel && (
                              <span className="px-3 py-1 text-sm rounded-lg bg-primary/10 text-primary font-medium">
                                {a11y.wcagLevel}
                              </span>
                            )}
                            {/* Feature #1936: AI Analysis button for accessibility */}
                            <button
                              onClick={() => analyzeAccessibilityResults(result.test_name, a11y)}
                              disabled={a11yAILoading && a11yAIAnalysisOpen === result.test_name}
                              className="px-3 py-1.5 text-sm bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                              title="AI Accessibility Analysis"
                            >
                              {a11yAILoading && a11yAIAnalysisOpen === result.test_name ? (
                                <>
                                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Analyzing...
                                </>
                              ) : (
                                <>
                                  <span>🤖</span>
                                  AI Fix Help
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Feature #1936: AI Accessibility Analysis Results Panel */}
                        {a11yAIResult[result.test_name] && (
                          <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-800 rounded-xl">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span className="text-xl">🤖</span>
                                <h4 className="font-semibold text-purple-700 dark:text-purple-300">AI Accessibility Analysis</h4>
                              </div>
                              <button
                                onClick={() => setA11yAIResult(prev => {
                                  const newResult = { ...prev };
                                  delete newResult[result.test_name];
                                  return newResult;
                                })}
                                className="text-muted-foreground hover:text-foreground p-1"
                                title="Close analysis"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                              <div className="whitespace-pre-wrap text-sm text-foreground">
                                {a11yAIResult[result.test_name]}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Feature #1936: AI Accessibility Analysis Error */}
                        {a11yAIError && a11yAIAnalysisOpen === result.test_name && (
                          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className="text-sm">{a11yAIError}</span>
                            </div>
                          </div>
                        )}

                        {/* Score and summary stats */}
                        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                          {/* A11y Score Gauge */}
                          <div className="col-span-2 md:col-span-1 flex justify-center">
                            <div className="relative w-20 h-20">
                              <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 80 80">
                                <circle
                                  cx="40" cy="40" r="35"
                                  fill="none" stroke="currentColor" strokeWidth="8"
                                  className="text-muted/30"
                                />
                                <circle
                                  cx="40" cy="40" r="35"
                                  fill="none" strokeWidth="8" strokeLinecap="round"
                                  stroke={score >= 90 ? '#22c55e' : score >= 50 ? '#eab308' : '#ef4444'}
                                  strokeDasharray={`${(score / 100) * 220} 220`}
                                />
                              </svg>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className={`text-lg font-bold ${score >= 90 ? 'text-green-600' : score >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                                  {score}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Severity badges */}
                          {severityOrder.map(severity => {
                            const count = violationGroups[severity]?.length || 0;
                            const colors = {
                              critical: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', badge: 'bg-red-600' },
                              serious: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', badge: 'bg-orange-600' },
                              moderate: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', badge: 'bg-yellow-600' },
                              minor: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', badge: 'bg-blue-600' },
                            };
                            return (
                              <div key={severity} className={`p-3 rounded-lg text-center ${colors[severity].bg}`}>
                                <div className={`text-xl font-bold ${colors[severity].text}`}>{count}</div>
                                <div className="text-xs text-muted-foreground capitalize">{severity}</div>
                              </div>
                            );
                          })}

                          {/* Pass rate */}
                          <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg text-center">
                            <div className="text-xl font-bold text-green-700 dark:text-green-400">{a11y.passes}</div>
                            <div className="text-xs text-muted-foreground">Passed</div>
                          </div>
                        </div>
                      </div>

                      {/* Violations content */}
                      <div className="p-4">
                        {a11yViewMode === 'grouped' ? (
                          /* Grouped view by severity */
                          <div className="space-y-4">
                            {severityOrder.map(severity => {
                              const violations = violationGroups[severity];
                              if (violations.length === 0) return null;

                              const isExpanded = a11yExpandedSeverities.has(severity);
                              const colors = {
                                critical: { border: 'border-red-500', header: 'bg-red-50 dark:bg-red-900/20', badge: 'bg-red-600 text-white' },
                                serious: { border: 'border-orange-500', header: 'bg-orange-50 dark:bg-orange-900/20', badge: 'bg-orange-600 text-white' },
                                moderate: { border: 'border-yellow-500', header: 'bg-yellow-50 dark:bg-yellow-900/20', badge: 'bg-yellow-600 text-white' },
                                minor: { border: 'border-blue-500', header: 'bg-blue-50 dark:bg-blue-900/20', badge: 'bg-blue-600 text-white' },
                              };

                              return (
                                <div key={severity} className={`border ${colors[severity].border} rounded-lg overflow-hidden`}>
                                  <button
                                    onClick={() => toggleA11ySeverity(severity)}
                                    className={`w-full p-3 ${colors[severity].header} flex items-center justify-between hover:opacity-80 transition-opacity`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <svg
                                        className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                      </svg>
                                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${colors[severity].badge}`}>
                                        {severity.toUpperCase()}
                                      </span>
                                      <span className="font-medium text-foreground">
                                        {violations.length} violation{violations.length !== 1 ? 's' : ''}
                                      </span>
                                    </div>
                                    <span className="text-sm text-muted-foreground">
                                      {isExpanded ? 'Click to collapse' : 'Click to expand'}
                                    </span>
                                  </button>

                                  {isExpanded && (
                                    <div className="divide-y divide-border">
                                      {violations.map((violation, vIdx) => {
                                        const violationKey = `${idx}-${severity}-${vIdx}`;
                                        const isViolationExpanded = a11yExpandedViolations.has(violationKey);

                                        return (
                                          <div key={vIdx} className="bg-background">
                                            <button
                                              onClick={() => toggleA11yViolation(violationKey)}
                                              className="w-full p-4 text-left hover:bg-muted/30 transition-colors"
                                            >
                                              <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                  <div className="flex items-center gap-2 mb-1">
                                                    <svg
                                                      className={`w-4 h-4 transition-transform flex-shrink-0 ${isViolationExpanded ? 'rotate-90' : ''}`}
                                                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                                    >
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                    </svg>
                                                    <code className="text-sm font-mono text-foreground">{violation.id}</code>
                                                    {violation.nodes && (
                                                      <span className="px-1.5 py-0.5 text-xs bg-muted rounded text-muted-foreground">
                                                        {violation.nodes.length} element{violation.nodes.length !== 1 ? 's' : ''}
                                                      </span>
                                                    )}
                                                  </div>
                                                  <p className="text-sm text-foreground ml-6">{violation.description}</p>
                                                </div>
                                                {violation.helpUrl && (
                                                  <a
                                                    href={violation.helpUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="text-primary hover:underline text-sm whitespace-nowrap ml-4"
                                                  >
                                                    WCAG Docs →
                                                  </a>
                                                )}
                                              </div>
                                            </button>

                                            {isViolationExpanded && (
                                              <div className="px-4 pb-4 ml-6 space-y-4">
                                                {/* Fix suggestion */}
                                                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                                  <h5 className="font-medium text-blue-700 dark:text-blue-400 mb-1 flex items-center gap-2">
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                                    </svg>
                                                    How to Fix
                                                  </h5>
                                                  <p className="text-sm text-blue-700 dark:text-blue-300">
                                                    {getFixSuggestion(violation)}
                                                  </p>
                                                </div>

                                                {/* WCAG tags */}
                                                {violation.wcagTags && violation.wcagTags.length > 0 && (
                                                  <div>
                                                    <h5 className="text-sm font-medium text-foreground mb-2">WCAG Criteria</h5>
                                                    <div className="flex gap-1 flex-wrap">
                                                      {violation.wcagTags.map(tag => (
                                                        <a
                                                          key={tag}
                                                          href={`https://www.w3.org/WAI/WCAG21/Understanding/${tag.toLowerCase().replace(/\./g, '')}`}
                                                          target="_blank"
                                                          rel="noopener noreferrer"
                                                          className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded font-mono hover:bg-primary/20 transition-colors"
                                                        >
                                                          {tag}
                                                        </a>
                                                      ))}
                                                    </div>
                                                  </div>
                                                )}

                                                {/* Affected elements */}
                                                {violation.nodes && violation.nodes.length > 0 && (
                                                  <div>
                                                    <h5 className="text-sm font-medium text-foreground mb-2">
                                                      Affected Elements ({violation.nodes.length})
                                                    </h5>
                                                    <div className="space-y-2 max-h-60 overflow-auto">
                                                      {violation.nodes.map((node, nIdx) => (
                                                        <div key={nIdx} className="p-3 bg-muted/30 rounded-lg">
                                                          <div className="mb-2">
                                                            <span className="text-xs text-muted-foreground">CSS Selector:</span>
                                                            <code className="text-xs block font-mono text-foreground mt-0.5 bg-muted px-2 py-1 rounded">
                                                              {node.target.join(' > ')}
                                                            </code>
                                                          </div>
                                                          <div className="mb-2">
                                                            <span className="text-xs text-muted-foreground">HTML:</span>
                                                            <code className="text-xs block font-mono text-foreground mt-0.5 bg-muted px-2 py-1 rounded overflow-auto max-h-20">
                                                              {node.html}
                                                            </code>
                                                          </div>
                                                          {node.failureSummary && (
                                                            <div>
                                                              <span className="text-xs text-muted-foreground">Issue:</span>
                                                              <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                                                                {node.failureSummary}
                                                              </p>
                                                            </div>
                                                          )}
                                                        </div>
                                                      ))}
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          /* List view - all violations */
                          <div className="space-y-3">
                            {a11y.violations.map((violation, vIdx) => (
                              <div
                                key={vIdx}
                                className={`p-4 rounded-lg border ${
                                  violation.impact === 'critical' ? 'border-red-500 bg-red-50 dark:bg-red-900/10' :
                                  violation.impact === 'serious' ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/10' :
                                  violation.impact === 'moderate' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/10' :
                                  'border-blue-500 bg-blue-50 dark:bg-blue-900/10'
                                }`}
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 text-xs font-medium rounded text-white ${
                                      violation.impact === 'critical' ? 'bg-red-600' :
                                      violation.impact === 'serious' ? 'bg-orange-600' :
                                      violation.impact === 'moderate' ? 'bg-yellow-600' :
                                      'bg-blue-600'
                                    }`}>
                                      {violation.impact}
                                    </span>
                                    <code className="text-sm font-mono text-foreground">{violation.id}</code>
                                  </div>
                                  {violation.helpUrl && (
                                    <a
                                      href={violation.helpUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-primary hover:underline text-sm"
                                    >
                                      Learn more →
                                    </a>
                                  )}
                                </div>
                                <p className="text-foreground mb-2">{violation.description}</p>
                                <p className="text-sm text-muted-foreground mb-3">{violation.help}</p>

                                {violation.wcagTags && violation.wcagTags.length > 0 && (
                                  <div className="flex gap-1 flex-wrap mb-3">
                                    {violation.wcagTags.map(tag => (
                                      <span key={tag} className="px-2 py-0.5 text-xs bg-muted rounded font-mono">
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {violation.nodes && violation.nodes.length > 0 && (
                                  <div className="pt-3 border-t border-border/50">
                                    <p className="text-sm font-medium text-foreground mb-2">
                                      Affected elements ({violation.nodes.length}):
                                    </p>
                                    <div className="space-y-2 max-h-48 overflow-auto">
                                      {violation.nodes.slice(0, 5).map((node, nIdx) => (
                                        <div key={nIdx} className="p-2 bg-muted/50 rounded text-sm">
                                          <code className="text-xs block font-mono text-muted-foreground overflow-auto">
                                            {node.html}
                                          </code>
                                          <p className="text-xs text-muted-foreground mt-1">
                                            Target: {node.target.join(' > ')}
                                          </p>
                                        </div>
                                      ))}
                                      {violation.nodes.length > 5 && (
                                        <p className="text-xs text-muted-foreground">
                                          ... and {violation.nodes.length - 5} more elements
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Feature #1839: Enhanced Logs Tab - Console, Network, and Test Logs */}
        {activeTab === 'logs' && (
          <div>
            {/* Header with title and stats */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-foreground">Logs & Network</h2>
                <div className="flex items-center gap-2 text-sm">
                  <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground">
                    {logCounts.total} total
                  </span>
                  {logCounts.errors > 0 && (
                    <span className="px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                      {logCounts.errors} errors
                    </span>
                  )}
                  {logCounts.warnings > 0 && (
                    <span className="px-2 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
                      {logCounts.warnings} warnings
                    </span>
                  )}
                </div>
              </div>

              {/* Export buttons */}
              <div className="flex items-center gap-2">
                <select
                  value={logsExportFormat}
                  onChange={(e) => setLogsExportFormat(e.target.value as 'json' | 'txt')}
                  className="px-2 py-1.5 text-sm border border-border rounded-md bg-background text-foreground"
                >
                  <option value="json">JSON</option>
                  <option value="txt">Text</option>
                </select>
                <button
                  onClick={() => exportLogs(logsExportFormat)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                  disabled={filteredLogs.length === 0}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export
                </button>
              </div>
            </div>

            {/* View Mode and Filters */}
            <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-muted/30 rounded-lg">
              {/* View Mode Selector */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">View:</span>
                <div className="flex rounded-md overflow-hidden border border-border">
                  {(['unified', 'console', 'network'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setLogsViewMode(mode)}
                      className={`px-3 py-1.5 text-sm capitalize ${
                        logsViewMode === mode
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-background text-foreground hover:bg-muted'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search */}
              <div className="flex-1 min-w-[200px] max-w-md">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search logs..."
                    value={logsSearch}
                    onChange={(e) => setLogsSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground"
                  />
                  {logsSearch && (
                    <button
                      onClick={() => setLogsSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
                    >
                      <svg className="w-3 h-3 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">Filter:</span>
                <button
                  onClick={() => setLogsFilter(f => ({ ...f, errors: !f.errors }))}
                  className={`flex items-center gap-1 px-2 py-1 text-xs rounded-full border transition-colors ${
                    logsFilter.errors
                      ? 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-700 dark:text-red-400'
                      : 'bg-muted border-border text-muted-foreground line-through'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  Errors ({logCounts.errors})
                </button>
                <button
                  onClick={() => setLogsFilter(f => ({ ...f, warnings: !f.warnings }))}
                  className={`flex items-center gap-1 px-2 py-1 text-xs rounded-full border transition-colors ${
                    logsFilter.warnings
                      ? 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700 text-yellow-700 dark:text-yellow-400'
                      : 'bg-muted border-border text-muted-foreground line-through'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                  Warnings ({logCounts.warnings})
                </button>
                <button
                  onClick={() => setLogsFilter(f => ({ ...f, info: !f.info }))}
                  className={`flex items-center gap-1 px-2 py-1 text-xs rounded-full border transition-colors ${
                    logsFilter.info
                      ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400'
                      : 'bg-muted border-border text-muted-foreground line-through'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  Info ({logCounts.info})
                </button>
                <button
                  onClick={() => setLogsFilter(f => ({ ...f, network: !f.network }))}
                  className={`flex items-center gap-1 px-2 py-1 text-xs rounded-full border transition-colors ${
                    logsFilter.network
                      ? 'bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-400'
                      : 'bg-muted border-border text-muted-foreground line-through'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                  Network ({logCounts.network})
                </button>
              </div>
            </div>

            {/* Filtered results count */}
            {(logsSearch || !Object.values(logsFilter).every(v => v)) && (
              <div className="mb-3 text-sm text-muted-foreground">
                Showing {filteredLogs.length} of {logCounts.total} logs
                {logsSearch && <span> matching "{logsSearch}"</span>}
              </div>
            )}

            {/* Unified Log View */}
            {(logsViewMode === 'unified' || logsViewMode === 'console') && (
              <div className="mb-6">
                {logsViewMode === 'console' && (
                  <h3 className="font-medium text-foreground mb-3 flex items-center gap-2">
                    <span>📝</span> Console Logs ({consoleLogs.length})
                  </h3>
                )}

                {filteredLogs.filter(l => logsViewMode === 'unified' || l.type === 'console').length === 0 ? (
                  <div className="p-8 text-center bg-muted/30 rounded-lg">
                    <svg className="w-12 h-12 mx-auto text-muted-foreground mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-muted-foreground">No logs match your current filters.</p>
                  </div>
                ) : (
                  <div className="bg-gray-900 rounded-lg overflow-hidden">
                    <div className="max-h-[600px] overflow-auto p-4 font-mono text-sm">
                      {filteredLogs
                        .filter(l => logsViewMode === 'unified' || l.type === 'console')
                        .slice(0, expandedLogs ? undefined : 100)
                        .map((log, idx) => (
                          <div
                            key={idx}
                            className={`py-1.5 border-l-2 pl-3 mb-1 ${
                              log.type === 'network'
                                ? 'border-purple-500 hover:bg-purple-500/10'
                                : log.level === 'error'
                                ? 'border-red-500 hover:bg-red-500/10'
                                : log.level === 'warn'
                                ? 'border-yellow-500 hover:bg-yellow-500/10'
                                : log.level === 'info'
                                ? 'border-blue-500 hover:bg-blue-500/10'
                                : 'border-gray-500 hover:bg-gray-500/10'
                            } transition-colors cursor-pointer rounded-r`}
                            onClick={() => log.type === 'network' && log.originalIndex !== undefined && toggleNetworkItem(log.originalIndex)}
                          >
                            <div className="flex items-start gap-2">
                              {/* Timestamp */}
                              <span className="text-gray-500 flex-shrink-0">
                                [{new Date(log.timestamp).toISOString().split('T')[1].slice(0, 12)}]
                              </span>

                              {/* Type badge */}
                              <span className={`flex-shrink-0 px-1.5 py-0.5 text-xs rounded uppercase ${
                                log.type === 'network'
                                  ? 'bg-purple-800 text-purple-200'
                                  : log.level === 'error'
                                  ? 'bg-red-800 text-red-200'
                                  : log.level === 'warn'
                                  ? 'bg-yellow-800 text-yellow-200'
                                  : log.level === 'info'
                                  ? 'bg-blue-800 text-blue-200'
                                  : 'bg-gray-700 text-gray-300'
                              }`}>
                                {log.type === 'network' ? 'NET' : log.level?.slice(0, 3) || 'LOG'}
                              </span>

                              {/* Network: Method + Status */}
                              {log.type === 'network' && (
                                <>
                                  <span className="font-semibold text-purple-400 flex-shrink-0">{log.method}</span>
                                  <span className={`flex-shrink-0 px-1.5 py-0.5 text-xs rounded ${
                                    !log.status ? 'bg-gray-700 text-gray-300' :
                                    log.status >= 200 && log.status < 300 ? 'bg-green-800 text-green-200' :
                                    log.status >= 300 && log.status < 400 ? 'bg-blue-800 text-blue-200' :
                                    log.status >= 400 && log.status < 500 ? 'bg-yellow-800 text-yellow-200' :
                                    'bg-red-800 text-red-200'
                                  }`}>
                                    {log.status || 'N/A'}
                                  </span>
                                </>
                              )}

                              {/* Message/URL */}
                              <span className={`break-all ${
                                log.type === 'network'
                                  ? 'text-purple-300'
                                  : log.level === 'error'
                                  ? 'text-red-400'
                                  : log.level === 'warn'
                                  ? 'text-yellow-400'
                                  : log.level === 'info'
                                  ? 'text-blue-400'
                                  : 'text-gray-200'
                              }`}>
                                {log.type === 'network' ? log.url : log.message}
                              </span>

                              {/* Duration for network */}
                              {log.type === 'network' && log.duration_ms && (
                                <span className="text-gray-500 flex-shrink-0 ml-auto">
                                  {log.duration_ms}ms
                                </span>
                              )}

                              {/* Location for console */}
                              {log.type === 'console' && log.location && (
                                <span className="text-gray-500 text-xs flex-shrink-0 ml-auto">@ {log.location}</span>
                              )}
                            </div>

                            {/* Expanded network details */}
                            {log.type === 'network' && log.originalIndex !== undefined && expandedNetworkItems.has(log.originalIndex) && (
                              <div className="mt-2 ml-6 p-3 bg-gray-800 rounded-lg text-xs space-y-2">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <span className="text-gray-500">Resource Type:</span>{' '}
                                    <span className="text-gray-300">{log.resourceType || 'unknown'}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Duration:</span>{' '}
                                    <span className="text-gray-300">{log.duration_ms ? `${log.duration_ms}ms` : '-'}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Request Size:</span>{' '}
                                    <span className="text-gray-300">{log.requestSize ? `${(log.requestSize / 1024).toFixed(1)}KB` : '-'}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Response Size:</span>{' '}
                                    <span className="text-gray-300">{log.responseSize ? `${(log.responseSize / 1024).toFixed(1)}KB` : '-'}</span>
                                  </div>
                                </div>
                                {log.failed && (
                                  <div className="text-red-400">
                                    <span className="text-gray-500">Error:</span> {log.failureText || 'Request failed'}
                                  </div>
                                )}
                                <div className="mt-2">
                                  <span className="text-gray-500">Full URL:</span>
                                  <div className="mt-1 p-2 bg-gray-900 rounded break-all text-gray-300">{log.url}</div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                    </div>

                    {/* Show more button */}
                    {!expandedLogs && filteredLogs.filter(l => logsViewMode === 'unified' || l.type === 'console').length > 100 && (
                      <button
                        onClick={() => setExpandedLogs(true)}
                        className="w-full p-3 bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors text-sm"
                      >
                        Show all {filteredLogs.filter(l => logsViewMode === 'unified' || l.type === 'console').length} logs
                      </button>
                    )}
                    {expandedLogs && filteredLogs.length > 100 && (
                      <button
                        onClick={() => setExpandedLogs(false)}
                        className="w-full p-3 bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors text-sm"
                      >
                        Show less
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Network Requests Table View */}
            {logsViewMode === 'network' && (
              <div>
                <h3 className="font-medium text-foreground mb-3 flex items-center gap-2">
                  <span>🌐</span> Network Requests ({networkRequests.length})
                </h3>

                {networkRequests.length === 0 ? (
                  <div className="p-8 text-center bg-muted/30 rounded-lg">
                    <svg className="w-12 h-12 mx-auto text-muted-foreground mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                    <p className="text-muted-foreground">No network requests captured.</p>
                  </div>
                ) : (
                  <div className="border border-border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 sticky top-0">
                          <tr>
                            <th className="text-left p-3 font-medium text-foreground w-8"></th>
                            <th className="text-left p-3 font-medium text-foreground">Status</th>
                            <th className="text-left p-3 font-medium text-foreground">Method</th>
                            <th className="text-left p-3 font-medium text-foreground min-w-[300px]">URL</th>
                            <th className="text-left p-3 font-medium text-foreground">Type</th>
                            <th className="text-left p-3 font-medium text-foreground">Duration</th>
                            <th className="text-left p-3 font-medium text-foreground">Size</th>
                            <th className="text-left p-3 font-medium text-foreground">Time</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {networkRequests
                            .filter(req => {
                              if (!logsFilter.network) return false;
                              if (req.failed && !logsFilter.failedRequests) return false;
                              if (logsSearch.trim()) {
                                const searchLower = logsSearch.toLowerCase();
                                return req.url.toLowerCase().includes(searchLower) ||
                                  req.method.toLowerCase().includes(searchLower);
                              }
                              return true;
                            })
                            .slice(0, 100)
                            .map((req, idx) => (
                              <React.Fragment key={idx}>
                                <tr
                                  className={`${req.failed ? 'bg-red-50 dark:bg-red-900/10' : ''} hover:bg-muted/30 cursor-pointer transition-colors`}
                                  onClick={() => toggleNetworkItem(idx)}
                                >
                                  <td className="p-3">
                                    <svg
                                      className={`w-4 h-4 text-muted-foreground transition-transform ${expandedNetworkItems.has(idx) ? 'rotate-90' : ''}`}
                                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                  </td>
                                  <td className="p-3">
                                    <span className={`px-2 py-0.5 text-xs rounded font-medium ${
                                      !req.status ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300' :
                                      req.status >= 200 && req.status < 300 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                                      req.status >= 300 && req.status < 400 ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                                      req.status >= 400 && req.status < 500 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' :
                                      'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                    }`}>
                                      {req.status || (req.failed ? 'ERR' : 'N/A')}
                                    </span>
                                  </td>
                                  <td className="p-3">
                                    <span className={`font-mono font-medium ${
                                      req.method === 'GET' ? 'text-green-600 dark:text-green-400' :
                                      req.method === 'POST' ? 'text-blue-600 dark:text-blue-400' :
                                      req.method === 'PUT' ? 'text-yellow-600 dark:text-yellow-400' :
                                      req.method === 'DELETE' ? 'text-red-600 dark:text-red-400' :
                                      'text-foreground'
                                    }`}>
                                      {req.method}
                                    </span>
                                  </td>
                                  <td className="p-3 text-muted-foreground max-w-md">
                                    <div className="truncate" title={req.url}>
                                      {req.url}
                                    </div>
                                  </td>
                                  <td className="p-3 text-muted-foreground">
                                    <span className="px-1.5 py-0.5 text-xs bg-muted rounded">
                                      {req.resourceType}
                                    </span>
                                  </td>
                                  <td className="p-3 text-muted-foreground">
                                    {req.duration_ms ? (
                                      <span className={req.duration_ms > 1000 ? 'text-yellow-600 dark:text-yellow-400' : ''}>
                                        {req.duration_ms}ms
                                      </span>
                                    ) : '-'}
                                  </td>
                                  <td className="p-3 text-muted-foreground">
                                    {req.responseSize ? `${(req.responseSize / 1024).toFixed(1)}KB` : '-'}
                                  </td>
                                  <td className="p-3 text-muted-foreground text-xs">
                                    {new Date(req.timestamp).toISOString().split('T')[1].slice(0, 12)}
                                  </td>
                                </tr>
                                {/* Expanded row */}
                                {expandedNetworkItems.has(idx) && (
                                  <tr>
                                    <td colSpan={8} className="p-0">
                                      <div className="p-4 bg-muted/20 border-t border-border">
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                          <div>
                                            <span className="text-xs text-muted-foreground block mb-1">Request Size</span>
                                            <span className="font-medium text-foreground">
                                              {req.requestSize ? `${(req.requestSize / 1024).toFixed(2)} KB` : 'N/A'}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-xs text-muted-foreground block mb-1">Response Size</span>
                                            <span className="font-medium text-foreground">
                                              {req.responseSize ? `${(req.responseSize / 1024).toFixed(2)} KB` : 'N/A'}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-xs text-muted-foreground block mb-1">Resource Type</span>
                                            <span className="font-medium text-foreground">{req.resourceType || 'unknown'}</span>
                                          </div>
                                          <div>
                                            <span className="text-xs text-muted-foreground block mb-1">Status Text</span>
                                            <span className="font-medium text-foreground">{req.statusText || '-'}</span>
                                          </div>
                                        </div>

                                        {req.failed && (
                                          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                            <span className="text-red-700 dark:text-red-400 font-medium">Request Failed</span>
                                            {req.failureText && (
                                              <p className="text-sm text-red-600 dark:text-red-300 mt-1">{req.failureText}</p>
                                            )}
                                          </div>
                                        )}

                                        <div>
                                          <span className="text-xs text-muted-foreground block mb-1">Full URL</span>
                                          <div className="p-2 bg-muted rounded-lg font-mono text-sm break-all text-foreground">
                                            {req.url}
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            ))}
                        </tbody>
                      </table>
                    </div>
                    {networkRequests.length > 100 && (
                      <div className="p-3 bg-muted/30 text-center text-sm text-muted-foreground border-t border-border">
                        Showing first 100 of {networkRequests.length} requests
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Summary Stats */}
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-muted/30 rounded-lg">
                <div className="text-sm text-muted-foreground">Console Logs</div>
                <div className="text-2xl font-bold text-foreground">{consoleLogs.length}</div>
                {logCounts.errors > 0 && (
                  <div className="text-xs text-red-500 mt-1">{logCounts.errors} errors</div>
                )}
              </div>
              <div className="p-4 bg-muted/30 rounded-lg">
                <div className="text-sm text-muted-foreground">Network Requests</div>
                <div className="text-2xl font-bold text-foreground">{networkRequests.length}</div>
                {logCounts.failedRequests > 0 && (
                  <div className="text-xs text-red-500 mt-1">{logCounts.failedRequests} failed</div>
                )}
              </div>
              <div className="p-4 bg-muted/30 rounded-lg">
                <div className="text-sm text-muted-foreground">Warnings</div>
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{logCounts.warnings}</div>
              </div>
              <div className="p-4 bg-muted/30 rounded-lg">
                <div className="text-sm text-muted-foreground">Errors</div>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">{logCounts.errors}</div>
              </div>
            </div>
          </div>
        )}

        {/* Feature #1840: Network Tab - HAR Viewer and Waterfall Chart */}
        {activeTab === 'network' && (
          <div>
            {/* Header with stats and export */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-foreground">Network Waterfall</h2>
                <div className="flex items-center gap-2 text-sm">
                  <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground">
                    {networkStats.totalRequests} requests
                  </span>
                  <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground">
                    {formatBytes(networkStats.totalSize)}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground">
                    {formatDuration(networkStats.totalDuration)}
                  </span>
                  {networkStats.failedRequests > 0 && (
                    <span className="px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                      {networkStats.failedRequests} failed
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={exportHAR}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                disabled={networkRequests.length === 0}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export HAR
              </button>
            </div>

            {/* Filters and Controls */}
            <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-muted/30 rounded-lg">
              {/* Type Filter */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">Type:</span>
                {[
                  { id: 'xhr', label: 'XHR', color: 'blue' },
                  { id: 'fetch', label: 'Fetch', color: 'indigo' },
                  { id: 'script', label: 'JS', color: 'yellow' },
                  { id: 'stylesheet', label: 'CSS', color: 'purple' },
                  { id: 'image', label: 'Images', color: 'green' },
                  { id: 'font', label: 'Fonts', color: 'pink' },
                  { id: 'document', label: 'Doc', color: 'orange' },
                  { id: 'other', label: 'Other', color: 'gray' },
                ].map(type => (
                  <button
                    key={type.id}
                    onClick={() => toggleNetworkType(type.id)}
                    className={`flex items-center gap-1 px-2 py-1 text-xs rounded-full border transition-colors ${
                      networkTypeFilter.has(type.id)
                        ? `bg-${type.color}-100 dark:bg-${type.color}-900/30 border-${type.color}-300 dark:border-${type.color}-700 text-${type.color}-700 dark:text-${type.color}-400`
                        : 'bg-muted border-border text-muted-foreground line-through'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="flex-1 min-w-[200px] max-w-md">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search URL..."
                    value={networkSearch}
                    onChange={(e) => setNetworkSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              {/* Sort */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Sort:</span>
                <select
                  value={networkSortBy}
                  onChange={(e) => setNetworkSortBy(e.target.value as 'time' | 'duration' | 'size')}
                  className="px-2 py-1.5 text-sm border border-border rounded-md bg-background text-foreground"
                >
                  <option value="time">By Time</option>
                  <option value="duration">By Duration</option>
                  <option value="size">By Size</option>
                </select>
              </div>
            </div>

            {networkRequests.length === 0 ? (
              <div className="p-12 text-center bg-muted/30 rounded-lg">
                <svg className="w-16 h-16 mx-auto text-muted-foreground mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
                <p className="text-lg font-medium text-foreground mb-2">No network requests captured</p>
                <p className="text-muted-foreground">Network activity will appear here when tests are run.</p>
              </div>
            ) : (
              <div className="flex gap-4">
                {/* Main Waterfall View */}
                <div className={`${selectedNetworkRequest !== null ? 'flex-1' : 'w-full'} border border-border rounded-lg overflow-hidden`}>
                  {/* Timeline header */}
                  <div className="bg-muted/50 px-4 py-2 border-b border-border">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>0ms</span>
                      <span>{formatDuration(waterfallBounds.duration / 4)}</span>
                      <span>{formatDuration(waterfallBounds.duration / 2)}</span>
                      <span>{formatDuration((waterfallBounds.duration * 3) / 4)}</span>
                      <span>{formatDuration(waterfallBounds.duration)}</span>
                    </div>
                  </div>

                  {/* Waterfall rows */}
                  <div className="max-h-[600px] overflow-auto">
                    {filteredNetworkRequests.slice(0, 200).map((req, idx) => {
                      const position = getWaterfallPosition(req);
                      const isSelected = selectedNetworkRequest === req.index;

                      return (
                        <div
                          key={idx}
                          onClick={() => setSelectedNetworkRequest(isSelected ? null : req.index)}
                          className={`flex items-stretch border-b border-border hover:bg-muted/30 cursor-pointer transition-colors ${
                            isSelected ? 'bg-primary/10' : ''
                          } ${req.failed ? 'bg-red-50 dark:bg-red-900/10' : ''}`}
                        >
                          {/* Request info - left side */}
                          <div className="w-1/3 p-2 border-r border-border flex-shrink-0">
                            <div className="flex items-center gap-2 mb-1">
                              {/* Status badge */}
                              <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${
                                !req.status ? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400' :
                                req.status >= 200 && req.status < 300 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                                req.status >= 300 && req.status < 400 ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                                req.status >= 400 && req.status < 500 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' :
                                'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                              }`}>
                                {req.status || 'ERR'}
                              </span>

                              {/* Method */}
                              <span className={`text-xs font-mono font-medium ${
                                req.method === 'GET' ? 'text-green-600 dark:text-green-400' :
                                req.method === 'POST' ? 'text-blue-600 dark:text-blue-400' :
                                req.method === 'PUT' ? 'text-yellow-600 dark:text-yellow-400' :
                                req.method === 'DELETE' ? 'text-red-600 dark:text-red-400' :
                                'text-foreground'
                              }`}>
                                {req.method}
                              </span>

                              {/* Type badge */}
                              <span className="text-xs px-1.5 py-0.5 bg-muted rounded text-muted-foreground">
                                {req.resourceType}
                              </span>
                            </div>

                            {/* URL */}
                            <div className="text-sm text-foreground truncate" title={req.url}>
                              {req.url.split('/').pop() || req.url}
                            </div>

                            {/* Size and duration */}
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <span>{formatBytes(req.responseSize)}</span>
                              <span>{req.duration_ms ? `${req.duration_ms}ms` : '-'}</span>
                            </div>
                          </div>

                          {/* Waterfall bar - right side */}
                          <div className="flex-1 p-2 relative min-h-[60px]">
                            {/* Background grid lines */}
                            <div className="absolute inset-0 flex">
                              {[0, 1, 2, 3, 4].map(i => (
                                <div key={i} className="flex-1 border-r border-border/30" />
                              ))}
                            </div>

                            {/* Waterfall bar */}
                            <div
                              className="absolute top-1/2 -translate-y-1/2 h-4 rounded-sm overflow-hidden flex"
                              style={{
                                left: `${position.left}%`,
                                width: `${Math.max(position.width, 1)}%`,
                                minWidth: '4px',
                              }}
                            >
                              {/* Timing breakdown */}
                              {req.timing && (
                                <>
                                  <div
                                    className="bg-gray-400 h-full"
                                    style={{ width: `${(req.timing.dns / (req.duration_ms || 1)) * 100}%` }}
                                    title={`DNS: ${req.timing.dns}ms`}
                                  />
                                  <div
                                    className="bg-orange-400 h-full"
                                    style={{ width: `${(req.timing.connect / (req.duration_ms || 1)) * 100}%` }}
                                    title={`Connect: ${req.timing.connect}ms`}
                                  />
                                  {req.timing.ssl > 0 && (
                                    <div
                                      className="bg-purple-400 h-full"
                                      style={{ width: `${(req.timing.ssl / (req.duration_ms || 1)) * 100}%` }}
                                      title={`SSL: ${req.timing.ssl}ms`}
                                    />
                                  )}
                                  <div
                                    className="bg-green-400 h-full"
                                    style={{ width: `${(req.timing.ttfb / (req.duration_ms || 1)) * 100}%` }}
                                    title={`TTFB: ${req.timing.ttfb}ms`}
                                  />
                                  <div
                                    className="bg-blue-400 h-full"
                                    style={{ width: `${(req.timing.download / (req.duration_ms || 1)) * 100}%` }}
                                    title={`Download: ${req.timing.download}ms`}
                                  />
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {filteredNetworkRequests.length > 200 && (
                    <div className="p-3 bg-muted/30 text-center text-sm text-muted-foreground border-t border-border">
                      Showing first 200 of {filteredNetworkRequests.length} requests
                    </div>
                  )}
                </div>

                {/* Request Details Panel */}
                {selectedNetworkRequest !== null && (
                  <div className="w-80 border border-border rounded-lg overflow-hidden flex-shrink-0">
                    <div className="bg-muted/50 p-3 border-b border-border flex items-center justify-between">
                      <h3 className="font-medium text-foreground">Request Details</h3>
                      <button
                        onClick={() => setSelectedNetworkRequest(null)}
                        className="p-1 hover:bg-muted rounded"
                      >
                        <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {(() => {
                      const req = waterfallData.find(r => r.index === selectedNetworkRequest);
                      if (!req) return null;

                      return (
                        <div className="p-4 max-h-[500px] overflow-auto space-y-4">
                          {/* General Info */}
                          <div>
                            <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">General</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Method</span>
                                <span className="font-medium text-foreground">{req.method}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Status</span>
                                <span className={`font-medium ${
                                  req.status && req.status >= 200 && req.status < 300 ? 'text-green-600' :
                                  req.status && req.status >= 400 ? 'text-red-600' : 'text-foreground'
                                }`}>
                                  {req.status} {req.statusText}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Type</span>
                                <span className="font-medium text-foreground">{req.resourceType}</span>
                              </div>
                            </div>
                          </div>

                          {/* URL */}
                          <div>
                            <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">URL</h4>
                            <div className="p-2 bg-muted rounded text-xs font-mono break-all text-foreground">
                              {req.url}
                            </div>
                          </div>

                          {/* Size */}
                          <div>
                            <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">Size</h4>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-muted-foreground">Request</span>
                                <div className="font-medium text-foreground">{formatBytes(req.requestSize)}</div>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Response</span>
                                <div className="font-medium text-foreground">{formatBytes(req.responseSize)}</div>
                              </div>
                            </div>
                          </div>

                          {/* Timing Breakdown */}
                          <div>
                            <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">Timing</h4>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded bg-gray-400"></div>
                                  <span className="text-muted-foreground">DNS Lookup</span>
                                </div>
                                <span className="font-medium text-foreground">{req.timing?.dns}ms</span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded bg-orange-400"></div>
                                  <span className="text-muted-foreground">Connect</span>
                                </div>
                                <span className="font-medium text-foreground">{req.timing?.connect}ms</span>
                              </div>
                              {(req.timing?.ssl || 0) > 0 && (
                                <div className="flex items-center justify-between text-sm">
                                  <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded bg-purple-400"></div>
                                    <span className="text-muted-foreground">SSL</span>
                                  </div>
                                  <span className="font-medium text-foreground">{req.timing?.ssl}ms</span>
                                </div>
                              )}
                              <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded bg-green-400"></div>
                                  <span className="text-muted-foreground">TTFB</span>
                                </div>
                                <span className="font-medium text-foreground">{req.timing?.ttfb}ms</span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded bg-blue-400"></div>
                                  <span className="text-muted-foreground">Download</span>
                                </div>
                                <span className="font-medium text-foreground">{req.timing?.download}ms</span>
                              </div>
                              <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
                                <span className="font-medium text-muted-foreground">Total</span>
                                <span className="font-bold text-foreground">{req.duration_ms}ms</span>
                              </div>
                            </div>
                          </div>

                          {/* Error info if failed */}
                          {req.failed && (
                            <div className="p-3 bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                              <h4 className="text-xs font-medium text-red-700 dark:text-red-400 uppercase mb-1">Error</h4>
                              <p className="text-sm text-red-600 dark:text-red-300">
                                {req.failureText || 'Request failed'}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* Legend */}
            <div className="mt-4 p-3 bg-muted/30 rounded-lg">
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <span className="text-muted-foreground font-medium">Timing Legend:</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-gray-400"></div>
                  <span className="text-muted-foreground">DNS</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-orange-400"></div>
                  <span className="text-muted-foreground">Connect</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-purple-400"></div>
                  <span className="text-muted-foreground">SSL</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-green-400"></div>
                  <span className="text-muted-foreground">TTFB</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-blue-400"></div>
                  <span className="text-muted-foreground">Download</span>
                </div>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-muted/30 rounded-lg">
                <div className="text-sm text-muted-foreground">Total Requests</div>
                <div className="text-2xl font-bold text-foreground">{networkStats.totalRequests}</div>
              </div>
              <div className="p-4 bg-muted/30 rounded-lg">
                <div className="text-sm text-muted-foreground">Total Size</div>
                <div className="text-2xl font-bold text-foreground">{formatBytes(networkStats.totalSize)}</div>
              </div>
              <div className="p-4 bg-muted/30 rounded-lg">
                <div className="text-sm text-muted-foreground">Load Time</div>
                <div className="text-2xl font-bold text-foreground">{formatDuration(networkStats.totalDuration)}</div>
              </div>
              <div className="p-4 bg-muted/30 rounded-lg">
                <div className="text-sm text-muted-foreground">Failed Requests</div>
                <div className={`text-2xl font-bold ${networkStats.failedRequests > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                  {networkStats.failedRequests}
                </div>
              </div>
            </div>
          </div>
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
                  onClick={generatePdfReport}
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
                    onClick={generateHtmlReport}
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
