/**
 * TestRunResultPage - Detailed test run results with full report
 * Feature #1823: Test results detail page with full report
 * Feature #337: Dark-first design system redesign
 */

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom'; // useParams unused
import { useAuthStore } from '../stores/authStore';
import { useOrganizationBrandingStore } from '../stores/organizationBrandingStore';
// Feature #567: Replaced standalone io() connection with shared useSocketStore
import { useSocketStore } from '../stores/socketStore';
import { toast } from '../stores/toastStore';
// Feature #337: Design system components
import {
 PageHeader,
 AnimatedCard,
 StatusPill,
 SectionHeader,
 CardContent,
 Tabs,
 TabsList,
 TabsTrigger,
 TabsContent,
 useReducedMotion,
} from '../components/ui';
// Feature #571: Added Lucide icons to replace emoji in tab navigation
import { Download, RefreshCw, Share2, FlaskConical, ListOrdered, Camera, BarChart3, Globe, Eye, Accessibility, ScrollText } from 'lucide-react';
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
 detectSimpleError,
 generateK6TimeSeries,
 generateResponseTimeHistogram,
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
 // Feature #46 Phase 2: Extract modal and view components
 ExportModal,
 BatchAnalysisModal,
 LiveExecutionView,
 ComparisonPanel,
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

 // Feature #1841: Individual test result cards state
 const [expandedResultCards, setExpandedResultCards] = useState<Set<string>>(new Set());
 const [selectedResultsFilter, setSelectedResultsFilter] = useState<'all' | 'passed' | 'failed' | 'skipped'>('all');
 const [rerunningTests, setRerunningTests] = useState<Set<string>>(new Set());

 // Feature #1842: Run comparison state (previousRuns, selectedCompareRunId, compareRun, loadingCompareRun, runHistory from useTestRunData)
 const [compareMode, setCompareMode] = useState(false);

 // Feature #1843: Export modal state
 const [exportModalOpen, setExportModalOpen] = useState(false);

 // Feature #1844: Live execution state
 // Feature #567: Removed standalone socketRef - using shared useSocketStore
 const [liveMode, setLiveMode] = useState(false);
 const [currentStep, setCurrentStep] = useState<{ action: string; selector?: string; progress: number } | null>(null);
 const [liveScreenshot, setLiveScreenshot] = useState<string | null>(null);
 const [liveConsoleLogs, setLiveConsoleLogs] = useState<Array<{ level: string; message: string; timestamp: number }>>([]);
 const [liveMetrics, setLiveMetrics] = useState<{ rps?: number; responseTime?: number; vus?: number } | null>(null);
 const [executionProgress, setExecutionProgress] = useState<{ current: number; total: number; eta?: number }>({ current: 0, total: 0 });
 const [cancellingTest, setCancellingTest] = useState(false);

 // Detect if the primary error is simple (Feature #1951)
 const errorAnalysis = useMemo(() => detectSimpleError(primaryError || undefined), [primaryError]);

 // Feature #1954: Batch failure analysis state
 const [batchAnalysisOpen, setBatchAnalysisOpen] = useState(false);

 // Feature #1865: Video playback synchronized with timeline
 const videoRef = useRef<HTMLVideoElement | null>(null);
 const [videoUrl, setVideoUrl] = useState<string | null>(null);
 const [videoLoading, setVideoLoading] = useState(false);
 const [videoError, setVideoError] = useState<string | null>(null);
 const [currentVideoTime, setCurrentVideoTime] = useState(0);
 const [isVideoPlaying, setIsVideoPlaying] = useState(false);

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

 // Feature #46: Data fetching useEffects (fetchRunData, fetchPreviousRuns, fetchCompareRun)
 // moved to useTestRunData hook

 // Feature #1844: WebSocket connection for live updates + polling fallback
 // Feature #567: Use shared useSocketStore instead of standalone io() connection
 useEffect(() => {
 if (!runId || !token) return;

 // Only connect WebSocket if run is in progress
 if (run?.status !== 'running' && run?.status !== 'pending') {
 setLiveMode(false);
 return;
 }

 setLiveMode(true);

 // Use shared socket store (avoids duplicate connections across tabs/pages)
 const { connect, joinRun, leaveRun, socket } = useSocketStore.getState();

 // Ensure we're connected
 if (!socket?.connected) {
 connect();
 }

 // Join the run room for live updates
 joinRun(runId);

 // Listen for run-progress events on the shared socket
 const handleRunProgress = (data: { runId: string; progress: number }) => {
 if (data.runId === runId) {
 setExecutionProgress(prev => ({
 ...prev,
 current: Math.round(data.progress),
 total: 100,
 }));
 }
 };

 // Subscribe to the shared socket's events
 const currentSocket = useSocketStore.getState().socket;
 currentSocket?.on('run-progress', handleRunProgress);

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

 // Cleanup: leave run room and remove event listener (don't disconnect shared socket)
 return () => {
 leaveRun(runId);
 const cleanupSocket = useSocketStore.getState().socket;
 cleanupSocket?.off('run-progress', handleRunProgress);
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
 case 'final': return 'bg-primary/10 text-primary';
 case 'baseline': return 'bg-success/10 text-success';
 case 'diff': return 'bg-destructive/10 text-destructive';
 case 'step_before': return 'bg-warning/10 text-warning';
 case 'step_after': return 'bg-accent/10 text-accent';
 default: return 'bg-muted text-foreground';
 }
 };

 // Feature #46: CircularGauge imported from components/test-run-results
 // Feature #46: Toggle handlers (toggleOpportunity, toggleDiagnostic, togglePassedAudit, toggleEndpoint) moved to useMetricsState hook
 // Feature #46: getScoreColorClass and getScoreBgClass imported from components/test-run-results/utils

 // Feature #46: exportK6Results moved to useTestRunHandlers hook

 // Feature #46: exportK6ResultsPDF imported from components/test-run-results/pdfExport

 // Feature #46: exportLighthousePDF, generateK6TimeSeries, generateResponseTimeHistogram imported from components/test-run-results

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
 type KeyMetricType = 'performance' | 'accessibility' | 'load' | 'visual' | 'e2e';
 const getKeyMetric = (result: TestResult): { label: string; value: string; type: KeyMetricType } => {
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
 const typeMapping: Record<string, KeyMetricType> = {
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
 // Feature #46: Comparison panel logic (compareRunSummary, calculateDelta, comparisonMetrics)
 // moved to ComparisonPanel component

 // Feature #46: Export functionality (handleGeneratePdfReport, exportFullJson, handleGenerateHtmlReport,
 // generateShareLink, copyShareLink) moved to ExportModal component

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
 // handleRejectBaseline, seekVisualVideoToMarker, handleVisualVideoTimeUpdate come from useVisualTestState
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

 // Feature #1954: Batch analysis functionality moved to BatchAnalysisModal component
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
 run.status === 'passed' ? 'bg-success/10 text-success' :
 run.status === 'failed' ? 'bg-destructive/10 text-destructive' :
 run.status === 'running' ? 'bg-primary/10 text-primary' :
 run.status === 'pending' ? 'bg-warning/10 text-warning' :
 'bg-muted text-foreground'
 }`}>
 {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
 </span>
 {/* Feature #1842: Compare button */}
 {previousRuns.length > 0 && (
 <button
 onClick={() => setCompareMode(!compareMode)}
 className={`inline-flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
 compareMode
 ? 'bg-primary text-white'
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
 <div className="flex items-center gap-2 px-4 py-2 bg-warning/5 border border-warning/20 rounded-md text-sm">
 <svg className="h-5 w-5 text-warning flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
 </svg>
 <span className="text-warning">
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

 {/* Feature #1842: Comparison Panel - Feature #46: Extracted to ComparisonPanel component */}
 <ComparisonPanel
 compareMode={compareMode}
 previousRuns={previousRuns}
 selectedCompareRunId={selectedCompareRunId}
 setSelectedCompareRunId={setSelectedCompareRunId}
 loadingCompareRun={loadingCompareRun}
 run={run}
 compareRun={compareRun}
 resultSummary={resultSummary}
 runHistory={runHistory}
 />
 </div>

 {/* Feature #1844: Live Execution View - Feature #46: Extracted to LiveExecutionView component */}
 {liveMode && (
 <LiveExecutionView
 runStatus={run?.status || ''}
 currentStep={currentStep}
 executionProgress={executionProgress}
 liveScreenshot={liveScreenshot}
 liveConsoleLogs={liveConsoleLogs}
 liveMetrics={liveMetrics}
 cancellingTest={cancellingTest}
 onCancelTest={cancelTest}
 />
 )}

 {/* Tab Navigation - Using modular component (Feature #46) */}
 <TabNavigation
 activeTab={activeTab}
 onTabChange={(tab) => setActiveTab(tab as ActiveTab)}
 tabs={[
 { id: 'results', label: 'Results', icon: <FlaskConical className="h-4 w-4" />, count: run.results?.length || 0 },
 { id: 'timeline', label: 'Timeline', icon: <ListOrdered className="h-4 w-4" />, count: allSteps.length },
 { id: 'screenshots', label: 'Screenshots', icon: <Camera className="h-4 w-4" />, count: screenshots.length },
 { id: 'metrics', label: 'Metrics', icon: <BarChart3 className="h-4 w-4" />, count: performanceResults.length + loadTestResults.length },
 { id: 'network', label: 'Network', icon: <Globe className="h-4 w-4" />, count: networkRequests.length },
 { id: 'visual', label: 'Visual Diff', icon: <Eye className="h-4 w-4" />, count: visualResults.length },
 { id: 'accessibility', label: 'Accessibility', icon: <Accessibility className="h-4 w-4" />, count: accessibilityResults.length },
 { id: 'logs', label: 'Logs', icon: <ScrollText className="h-4 w-4" />, count: consoleLogs.length },
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
 setActiveTab={(tab) => setActiveTab(tab as ActiveTab)}
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

 {/* Feature #1843: Export Modal - Feature #46: Extracted to ExportModal component */}
 <ExportModal
 isOpen={exportModalOpen}
 onClose={() => setExportModalOpen(false)}
 run={run}
 resultSummary={resultSummary}
 token={token}
 logoBase64={logoBase64}
 organizationName={organizationName}
 consoleLogs={consoleLogs}
 networkRequests={networkRequests}
 />

 {/* Feature #1954: Batch Failure Analysis Modal - Feature #46: Extracted to BatchAnalysisModal component */}
 <BatchAnalysisModal
 isOpen={batchAnalysisOpen}
 onClose={() => setBatchAnalysisOpen(false)}
 run={run}
 resultSummary={resultSummary}
 token={token}
 />

 {/* Feature #1962: AI Side Panel removed - AI analysis now only on Visual Review page */}
 </div>
 );
}
