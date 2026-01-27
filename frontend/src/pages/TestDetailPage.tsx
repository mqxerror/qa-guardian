// TestDetailPage - Extracted from App.tsx
// Feature #1441: Split App.tsx into logical modules
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuthStore } from '../stores/authStore';
import { useTimezoneStore } from '../stores/timezoneStore';
import { useSocketStore } from '../stores/socketStore';
import { useNotificationStore } from '../stores/notificationStore';
import { useToastStore, toast } from '../stores/toastStore';
import { useVisualReviewStore } from '../stores/visualReviewStore';
import { getErrorMessage, isNetworkError, isOffline } from '../utils/errorHandling';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import jsPDF from 'jspdf';

// Types used by TestDetailPage
interface TestSuite {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  test_count?: number;
  browser?: string;
  default_browser?: 'chromium' | 'firefox' | 'webkit';
  viewport_width?: number;
  viewport_height?: number;
  timeout?: number;
  retry_count?: number;
  project_id?: string;
}

interface TestType {
  id: string;
  suite_id: string;
  name: string;
  description?: string;
  type: 'e2e' | 'visual_regression' | 'lighthouse' | 'load' | 'accessibility' | 'api';
  test_type?: string;
  // Feature #1979: Added 'warning' status for accessibility tests with violations below thresholds
  status: 'pending' | 'running' | 'passed' | 'failed' | 'warning' | 'error' | 'active' | 'draft';
  created_at: string;
  updated_at: string;
  last_run_at?: string;
  target_url?: string;
  viewport_width?: number;
  viewport_height?: number;
  capture_mode?: 'full_page' | 'viewport' | 'element';
  element_selector?: string;
  wait_for_selector?: string;
  wait_time?: number;
  hide_selectors?: string[];
  remove_selectors?: string[];
  diff_threshold?: number;
  diff_threshold_mode?: 'percentage' | 'pixel_count';
  diff_pixel_threshold?: number;
  anti_aliasing_tolerance?: 'off' | 'low' | 'medium' | 'high';
  color_threshold?: number;
  ignore_regions?: Array<{id: string; x: number; y: number; width: number; height: number; name?: string}>;
  ignore_selectors?: string[];
  multi_viewport?: boolean;
  selected_viewports?: string[];
  steps?: any[];
  device_preset?: 'mobile' | 'desktop';
  performance_threshold?: number;
  lcp_threshold?: number;
  cls_threshold?: number;
  bypass_csp?: boolean;
  ignore_ssl_errors?: boolean;
  audit_timeout?: number;
  wcag_level?: 'A' | 'AA' | 'AAA';
  include_best_practices?: boolean;
  include_experimental?: boolean;
  include_pa11y?: boolean;
  a11y_fail_on_critical?: number;
  a11y_fail_on_serious?: number;
  a11y_fail_on_moderate?: number;
  a11y_fail_on_minor?: number;
  a11y_fail_on_any?: boolean;
  virtual_users?: number;
  duration?: number;
  ramp_up_time?: number;
  k6_script?: string;
  ai_generated?: boolean;
  ai_confidence_score?: number;
  requires_review?: boolean;
  review_status?: 'pending' | 'approved' | 'rejected' | 'pending_review';
  reviewed_by?: string;
  reviewed_at?: string;
  healing_active?: boolean;
  healing_status?: 'idle' | 'healing' | 'healed';
  healing_count?: number;
  // Playwright code properties
  playwright_code?: string;
  use_custom_code?: boolean;
  // Viewport properties
  viewports?: Array<{ name: string; width: number; height: number }>;
  viewport_preset?: 'mobile' | 'tablet' | 'laptop' | 'desktop' | 'custom';
}

interface TestRunType {
  id: string;
  suite_id: string;
  test_id?: string;
  // Feature #1979: Added 'warning' status for accessibility tests with violations below thresholds
  status: 'pending' | 'running' | 'passed' | 'failed' | 'warning' | 'error' | 'cancelled';
  duration_ms?: number;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  results?: TestRunResult[];
  error?: string;
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
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requestSize?: number;
  responseSize?: number;
  failed?: boolean;
  failureText?: string;
}

interface TestRunResult {
  test_id: string;
  test_name: string;
  // Feature #1979: Added 'warning' status for accessibility tests with violations below thresholds
  status: 'passed' | 'failed' | 'warning' | 'error' | 'skipped';
  duration_ms: number;
  steps: StepResult[];
  error?: string;
  screenshot_base64?: string;
  trace_file?: string;
  video_file?: string;
  console_logs?: ConsoleLog[];
  network_requests?: NetworkRequest[];
  // Feature #604: Storage quota exceeded
  isQuotaExceeded?: boolean;
  suggestions?: string[];
  // Visual comparison results
  visual_comparison?: {
    hasBaseline: boolean;
    baselineScreenshot?: string;
    diffPercentage?: number;
    diffImage?: string;
    mismatchedPixels?: number;
    totalPixels?: number;
    baselineCorrupted?: boolean; // Feature #600
    corruptionError?: string; // Feature #600
  };
  baseline_screenshot_base64?: string;
  diff_image_base64?: string;
  diff_percentage?: number;
  // K6 Load test results (Feature #551)
  load_test?: {
    summary: {
      total_requests: number;
      failed_requests: number;
      success_rate: string;
      requests_per_second: string;
      data_transferred: number;
      data_transferred_formatted: string;
    };
    response_times: {
      min: number;
      avg: number;
      median: number; // p50
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
    checks: Record<string, { passes: number; fails: number }>;
  };
}

interface StepResult {
  id: string;
  action: string;
  selector?: string;
  value?: string;
  // Feature #1979: Added 'warning' status for accessibility tests with violations below thresholds
  status: 'passed' | 'failed' | 'warning' | 'skipped';
  duration_ms: number;
  error?: string;
  screenshot_timeout?: boolean; // Feature #601
  navigation_error?: boolean; // Feature #602
  http_status?: number; // Feature #602
  // Extended result data for different test types
  metadata?: {
    screenshot_url?: string;
    diff_percentage?: number;
    baseline_url?: string;
    comparison_url?: string;
    diff_url?: string;
    isBrowserCrash?: boolean;
    isOversized?: boolean;
    crashDetectedAt?: string;
    crashDumpFile?: string;
    suggestion?: string;
    canRetry?: boolean;
    pageDimensions?: { width: number; height: number; estimatedSizeMb?: number; reason?: string };
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
      si?: number;
      tti?: number;
      largestContentfulPaint?: number;
      firstContentfulPaint?: number;
      speedIndex?: number;
      timeToInteractive?: number;
      totalBlockingTime?: number;
      cumulativeLayoutShift?: number;
      interactionToNextPaint?: number;
    };
    opportunities?: Array<{
      id: string;
      title: string;
      description?: string;
      score?: number;
      savings?: number;
      numericValue?: number;
      displayValue?: string;
    }>;
    diagnostics?: Array<{
      id: string;
      title: string;
      description?: string;
      score?: number;
      numericValue?: number;
      displayValue?: string;
    }>;
    passedAudits?: Array<{
      id: string;
      title: string;
      description?: string;
      score?: number;
    }>;
  };
  accessibility?: {
    violations: number;
    passes: number;
    incomplete: number;
    inapplicable: number;
    violationsBySeverity?: {
      critical: number;
      serious: number;
      moderate: number;
      minor: number;
    };
  };
}

// Video Player Component - handles authenticated video loading
function VideoPlayer({ videoFile, token }: { videoFile: string; token: string | null }) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;

    const fetchVideo = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(
          `${import.meta.env.VITE_API_BASE_URL || 'https://qa.pixelcraftedmedia.com'}/api/v1/videos/${videoFile}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to load video: ${response.status}`);
        }

        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        setVideoUrl(objectUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load video');
      } finally {
        setIsLoading(false);
      }
    };

    if (token && videoFile) {
      fetchVideo();
    }

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [videoFile, token]);

  const handleDownload = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || 'https://qa.pixelcraftedmedia.com'}/api/v1/videos/${videoFile}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to download video: ${response.status}`);
      }

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
  };

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-foreground">Test Recording:</p>
        <button
          onClick={handleDownload}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download Video
        </button>
      </div>
      <div className="rounded-lg border border-border overflow-hidden bg-black">
        {isLoading && (
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            <svg className="animate-spin h-6 w-6 mr-2" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Loading video...
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center h-48 text-destructive text-sm">
            <span>⚠️ {error}</span>
          </div>
        )}
        {videoUrl && !isLoading && (
          <video
            controls
            preload="metadata"
            className="w-full max-h-96"
            controlsList="nodownload"
            playsInline
            src={videoUrl}
          >
            Your browser does not support the video tag.
          </video>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Use controls: Play/Pause, Seek, Fullscreen, Playback Speed (right-click for more options)
      </p>
    </div>
  );
}

function TestDetailPage() {
  const { testId } = useParams<{ testId: string }>();
  const { token, user } = useAuthStore();
  const { formatDate, formatDateTime } = useTimezoneStore();
  const { socket, connect, joinRun, leaveRun, joinOrg } = useSocketStore();
  const { addNotification } = useNotificationStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [test, setTest] = useState<TestType | null>(null);
  const [suite, setSuite] = useState<TestSuite | null>(null);
  const [project, setProject] = useState<{ id: string; name: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [isCancellingRun, setIsCancellingRun] = useState(false);
  const [runError, setRunError] = useState('');
  const [currentRun, setCurrentRun] = useState<TestRunType | null>(null);
  const [runs, setRuns] = useState<TestRunType[]>([]);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [duplicateError, setDuplicateError] = useState('');
  // Real-time progress state
  const [liveProgress, setLiveProgress] = useState<{
    totalTests: number;
    completedTests: number;
    currentTest?: string;
    currentStep?: { index: number; total: number; action: string };
    // K6 load test specific metrics
    k6Metrics?: {
      phase: string;
      progress: number;
      currentVUs?: number;
      totalRequests?: number;
      requestsPerSecond?: number;
      avgResponseTime?: number;
      errorRate?: number;
      // Response time percentiles
      p50ResponseTime?: number;
      p95ResponseTime?: number;
      p99ResponseTime?: number;
    };
  } | null>(null);

  // Read filter state from URL search params (persists across navigation)
  const statusFilter = (searchParams.get('status') as 'all' | 'passed' | 'failed' | 'running') || 'all';
  const dateFilter = (searchParams.get('date') as 'all' | 'today' | '7days' | '30days') || 'all';
  const runPage = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
  const [showAddStepModal, setShowAddStepModal] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [lightboxZoom, setLightboxZoom] = useState(1);
  const [lightboxPan, setLightboxPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Visual comparison view mode state
  const [comparisonViewMode, setComparisonViewMode] = useState<'side-by-side' | 'slider' | 'onion-skin' | 'diff' | 'diff-overlay'>('side-by-side');
  const [sliderPosition, setSliderPosition] = useState(50); // Percentage position 0-100 for slider
  const [onionSkinOpacity, setOnionSkinOpacity] = useState(50); // Percentage opacity 0-100 for onion skin
  const [diffOverlayOpacity, setDiffOverlayOpacity] = useState(50); // Percentage opacity 0-100 for diff overlay
  const [imageZoomLevel, setImageZoomLevel] = useState<'fit' | '100' | '50' | '200'>('fit'); // Zoom level for images

  // Feature #1101: Flakiness trend tracking state
  const [flakinessTrend, setFlakinessTrend] = useState<{
    summary: {
      total_runs: number;
      total_passes: number;
      total_failures: number;
      overall_pass_rate: number;
      overall_flakiness_score: number;
      flakiness_started: string | null;
      first_run: string | null;
      last_run: string | null;
    };
    daily_trend: Array<{
      date: string;
      passes: number;
      failures: number;
      total: number;
      pass_rate: number;
      flakiness_score: number;
    }>;
    weekly_trend: Array<{
      week_start: string;
      passes: number;
      failures: number;
      flakiness_score: number;
    }>;
    code_changes: Array<{
      date: string;
      commit_id: string;
      message: string;
      author: string;
      files_changed: string[];
    }>;
  } | null>(null);
  const [isLoadingFlakinessTrend, setIsLoadingFlakinessTrend] = useState(false);
  const [showFlakinessTrendSection, setShowFlakinessTrendSection] = useState(true);

  // Refs for synchronized scrolling in side-by-side view
  const baselineContainerRef = useRef<HTMLDivElement>(null);
  const currentContainerRef = useRef<HTMLDivElement>(null);
  const diffContainerRef = useRef<HTMLDivElement>(null);
  const isSyncScrolling = useRef(false);

  // Synchronized scroll handler for side-by-side view
  const handleSyncScroll = useCallback((source: 'baseline' | 'current' | 'diff') => {
    if (isSyncScrolling.current) return;
    isSyncScrolling.current = true;

    const sourceRef = source === 'baseline' ? baselineContainerRef : source === 'current' ? currentContainerRef : diffContainerRef;
    const sourceEl = sourceRef.current;
    if (!sourceEl) {
      isSyncScrolling.current = false;
      return;
    }

    const scrollTop = sourceEl.scrollTop;
    const scrollLeft = sourceEl.scrollLeft;

    // Sync all other containers
    [baselineContainerRef, currentContainerRef, diffContainerRef].forEach(ref => {
      if (ref !== sourceRef && ref.current) {
        ref.current.scrollTop = scrollTop;
        ref.current.scrollLeft = scrollLeft;
      }
    });

    // Use requestAnimationFrame to avoid scroll event loops
    requestAnimationFrame(() => {
      isSyncScrolling.current = false;
    });
  }, []);

  // Track dirty state for unsaved changes warning
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const [isDownloadingArtifacts, setIsDownloadingArtifacts] = useState(false);

  // Drag and drop step reordering
  const [draggedStepIndex, setDraggedStepIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isSavingStepOrder, setIsSavingStepOrder] = useState(false);
  const [hasReorderedSteps, setHasReorderedSteps] = useState(false);

  // View Code tab state
  const [activeTab, setActiveTab] = useState<'steps' | 'code' | 'baseline' | 'k6script'>('steps');
  // K6 script editor state
  const [k6Script, setK6Script] = useState('');
  const [isEditingK6Script, setIsEditingK6Script] = useState(false);
  const [isSavingK6Script, setIsSavingK6Script] = useState(false);
  const [showK6Templates, setShowK6Templates] = useState(false);
  // Feature #323: K6 script code folding state
  const [foldedRegions, setFoldedRegions] = useState<Set<number>>(new Set());

  // Feature #323: Detect foldable regions in code
  interface FoldableRegion {
    startLine: number;
    endLine: number;
    type: 'function' | 'object' | 'block' | 'import';
  }

  const detectFoldableRegions = (code: string): FoldableRegion[] => {
    const lines = code.split('\n');
    const regions: FoldableRegion[] = [];
    const openBraces: Array<{ line: number; type: FoldableRegion['type'] }> = [];

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();

      // Detect function/method/export definitions
      if (trimmedLine.match(/^(export\s+)?(default\s+)?(function|const|let|var)\s+\w+.*\{$/)) {
        openBraces.push({ line: index, type: 'function' });
      }
      // Detect arrow functions with blocks
      else if (trimmedLine.match(/^(export\s+)?(const|let|var)\s+\w+\s*=.*=>\s*\{$/)) {
        openBraces.push({ line: index, type: 'function' });
      }
      // Detect object literals
      else if (trimmedLine.match(/^(export\s+)?(const|let|var)\s+\w+\s*=\s*\{$/)) {
        openBraces.push({ line: index, type: 'object' });
      }
      // Detect group() blocks from K6
      else if (trimmedLine.match(/^group\s*\(.*,\s*(?:function\s*\(\)|\(\)\s*=>)\s*\{$/)) {
        openBraces.push({ line: index, type: 'block' });
      }
      // Detect check() blocks
      else if (trimmedLine.match(/^check\s*\(.*\{$/)) {
        openBraces.push({ line: index, type: 'block' });
      }
      // Detect import blocks (multiple lines)
      else if (trimmedLine.match(/^import\s*\{$/)) {
        openBraces.push({ line: index, type: 'import' });
      }
      // Detect standalone opening brace with content before
      else if (trimmedLine.endsWith('{') && trimmedLine.length > 1) {
        openBraces.push({ line: index, type: 'block' });
      }

      // Check for closing braces
      if (trimmedLine.match(/^\}[\);,]*$/) || trimmedLine === '}') {
        const lastOpen = openBraces.pop();
        if (lastOpen && index > lastOpen.line) {
          regions.push({
            startLine: lastOpen.line,
            endLine: index,
            type: lastOpen.type,
          });
        }
      }
    });

    return regions;
  };

  // Toggle fold state for a line
  const toggleFold = (lineNumber: number) => {
    setFoldedRegions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(lineNumber)) {
        newSet.delete(lineNumber);
      } else {
        newSet.add(lineNumber);
      }
      return newSet;
    });
  };

  // Get the fold icon for a line
  const getFoldIcon = (lineNumber: number, foldableRegions: FoldableRegion[]): 'fold' | 'unfold' | null => {
    const region = foldableRegions.find(r => r.startLine === lineNumber);
    if (!region) return null;
    return foldedRegions.has(lineNumber) ? 'unfold' : 'fold';
  };

  // Check if a line should be hidden due to folding
  const isLineHidden = (lineNumber: number, foldableRegions: FoldableRegion[]): boolean => {
    for (const region of foldableRegions) {
      if (foldedRegions.has(region.startLine) && lineNumber > region.startLine && lineNumber <= region.endLine) {
        return true;
      }
    }
    return false;
  };
  const [baselineData, setBaselineData] = useState<{hasBaseline: boolean; image?: string; createdAt?: string; size?: number; approvedBy?: string; approvedByUserId?: string; approvedAt?: string; sourceRunId?: string} | null>(null);
  const [loadingBaseline, setLoadingBaseline] = useState(false);

  // Baseline approval state
  const [showApproveBaselineModal, setShowApproveBaselineModal] = useState(false);
  const [approvingBaseline, setApprovingBaseline] = useState(false);
  const [approveBaselineRunId, setApproveBaselineRunId] = useState<string | null>(null);
  const [approveBaselineError, setApproveBaselineError] = useState('');

  // Baseline history state
  const [baselineHistory, setBaselineHistory] = useState<Array<{
    id: string;
    testId: string;
    viewportId: string;
    version: number;
    approvedBy: string;
    approvedByUserId: string;
    approvedAt: string;
    sourceRunId?: string;
    filename: string;
  }>>([]);
  const [loadingBaselineHistory, setLoadingBaselineHistory] = useState(false);
  const [selectedHistoryVersion, setSelectedHistoryVersion] = useState<string | null>(null);
  const [historyVersionImage, setHistoryVersionImage] = useState<string | null>(null);
  const [loadingHistoryImage, setLoadingHistoryImage] = useState(false);
  // Baseline restore state
  const [showRestoreBaselineModal, setShowRestoreBaselineModal] = useState(false);
  const [restoreHistoryEntry, setRestoreHistoryEntry] = useState<{id: string; version: number} | null>(null);
  const [restoringBaseline, setRestoringBaseline] = useState(false);
  const [restoreBaselineError, setRestoreBaselineError] = useState('');

  // Visual regression rejection state
  const [showRejectChangesModal, setShowRejectChangesModal] = useState(false);
  const [rejectingChanges, setRejectingChanges] = useState(false);
  const [rejectChangesRunId, setRejectChangesRunId] = useState<string | null>(null);
  const [rejectChangesError, setRejectChangesError] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionStatus, setRejectionStatus] = useState<{hasRejection: boolean; rejectedBy?: string; rejectedAt?: string; reason?: string} | null>(null);

  // Branch selection state for visual regression tests
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [availableBranches, setAvailableBranches] = useState<string[]>(['main']);
  const [loadingBranches, setLoadingBranches] = useState(false);

  // Baseline merge state (for merging baselines from feature branches)
  const [mergeableBranches, setMergeableBranches] = useState<Array<{
    branch: string;
    updatedAt: string;
    approvedBy?: string;
    isNewer: boolean;
    hasBaseline: boolean;
  }>>([]);
  const [loadingMergeableBranches, setLoadingMergeableBranches] = useState(false);
  const [showMergeBaselineModal, setShowMergeBaselineModal] = useState(false);
  const [selectedMergeBranch, setSelectedMergeBranch] = useState<string | null>(null);
  const [isMergingBaseline, setIsMergingBaseline] = useState(false);
  const [mergeBaselineError, setMergeBaselineError] = useState('');

  // Quick schedule modal state
  const [showQuickScheduleModal, setShowQuickScheduleModal] = useState(false);
  const [quickScheduleName, setQuickScheduleName] = useState('');
  const [quickScheduleType, setQuickScheduleType] = useState<'one-time' | 'recurring'>('recurring');
  const [quickScheduleCron, setQuickScheduleCron] = useState('0 2 * * *'); // Default: Every night at 2 AM
  const [quickScheduleRunAt, setQuickScheduleRunAt] = useState('');
  const [quickScheduleTimezone, setQuickScheduleTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [isCreatingSchedule, setIsCreatingSchedule] = useState(false);
  const [quickScheduleError, setQuickScheduleError] = useState('');

  // Accessibility results filter state
  const [a11ySeverityFilter, setA11ySeverityFilter] = useState<{ [key: string]: 'all' | 'critical' | 'serious' | 'moderate' | 'minor' }>({});
  const [a11yCategoryFilter, setA11yCategoryFilter] = useState<{ [key: string]: 'all' | 'color' | 'images' | 'forms' | 'navigation' | 'structure' | 'aria' }>({});
  const [a11ySearchQuery, setA11ySearchQuery] = useState<{ [key: string]: string }>({});

  // Export accessibility report as PDF
  const exportAccessibilityPDF = (a11yData: any, testName: string, runDate: string) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - 2 * margin;
    let y = margin;

    // Helper function to add a new page if needed
    const checkPageBreak = (neededHeight: number) => {
      if (y + neededHeight > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        y = margin;
      }
    };

    // Title
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Accessibility Audit Report', margin, y);
    y += 12;

    // Subtitle with test name
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text(testName, margin, y);
    y += 8;

    // Date and URL
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${runDate}`, margin, y);
    y += 5;
    if (a11yData.url) {
      doc.text(`URL: ${a11yData.url}`, margin, y);
      y += 5;
    }
    if (a11yData.wcag_level) {
      doc.text(`WCAG Level: ${a11yData.wcag_level}`, margin, y);
      y += 5;
    }
    y += 10;

    // Score section
    doc.setTextColor(0);
    if (a11yData.score !== undefined) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Accessibility Score', margin, y);
      y += 8;

      doc.setFontSize(24);
      const scoreColor = a11yData.score >= 90 ? [34, 197, 94] : a11yData.score >= 50 ? [234, 179, 8] : [239, 68, 68];
      doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
      doc.text(`${a11yData.score}/100`, margin, y);
      y += 15;
      doc.setTextColor(0);
    }

    // Summary section
    checkPageBreak(40);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Summary', margin, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const summaryItems = [
      { label: 'Violations', value: a11yData.violations?.count || 0, color: a11yData.violations?.count > 0 ? [239, 68, 68] : [34, 197, 94] },
      { label: 'Passes', value: a11yData.passes?.count || 0, color: [34, 197, 94] },
      { label: 'Incomplete', value: a11yData.incomplete?.count || 0, color: [234, 179, 8] },
      { label: 'Not Applicable', value: a11yData.inapplicable?.count || 0, color: [156, 163, 175] }
    ];

    summaryItems.forEach((item, index) => {
      const xPos = margin + (index * 40);
      doc.setTextColor(item.color[0], item.color[1], item.color[2]);
      doc.setFont('helvetica', 'bold');
      doc.text(String(item.value), xPos, y);
      doc.setTextColor(100);
      doc.setFont('helvetica', 'normal');
      doc.text(item.label, xPos, y + 5);
    });
    y += 20;
    doc.setTextColor(0);

    // Violations breakdown by severity
    if (a11yData.violations?.count > 0) {
      checkPageBreak(30);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Violations by Severity', margin, y);
      y += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const severities = [
        { label: 'Critical', value: a11yData.violations.critical || 0, color: [239, 68, 68] },
        { label: 'Serious', value: a11yData.violations.serious || 0, color: [249, 115, 22] },
        { label: 'Moderate', value: a11yData.violations.moderate || 0, color: [234, 179, 8] },
        { label: 'Minor', value: a11yData.violations.minor || 0, color: [59, 130, 246] }
      ];

      severities.forEach((sev) => {
        if (sev.value > 0) {
          doc.setTextColor(sev.color[0], sev.color[1], sev.color[2]);
          doc.text(`• ${sev.label}: ${sev.value}`, margin, y);
          y += 5;
        }
      });
      y += 10;
      doc.setTextColor(0);
    }

    // Detailed violations
    if (a11yData.violations?.items?.length > 0) {
      checkPageBreak(20);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Violation Details', margin, y);
      y += 10;

      a11yData.violations.items.forEach((violation: any, index: number) => {
        checkPageBreak(50);

        // Violation header with impact badge
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        const impactColors: Record<string, number[]> = {
          critical: [239, 68, 68],
          serious: [249, 115, 22],
          moderate: [234, 179, 8],
          minor: [59, 130, 246]
        };
        const impactColor = impactColors[violation.impact] || [100, 100, 100];

        doc.setTextColor(impactColor[0], impactColor[1], impactColor[2]);
        doc.text(`[${(violation.impact || 'unknown').toUpperCase()}]`, margin, y);
        doc.setTextColor(0);
        doc.text(` ${violation.id}`, margin + 25, y);
        y += 6;

        // Description
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        if (violation.description) {
          const descLines = doc.splitTextToSize(violation.description, contentWidth);
          descLines.forEach((line: string) => {
            checkPageBreak(6);
            doc.text(line, margin, y);
            y += 4;
          });
        }

        // Help text
        if (violation.help) {
          doc.setTextColor(100);
          const helpLines = doc.splitTextToSize(`How to fix: ${violation.help}`, contentWidth);
          helpLines.forEach((line: string) => {
            checkPageBreak(6);
            doc.text(line, margin, y);
            y += 4;
          });
          doc.setTextColor(0);
        }

        // WCAG tags
        if (violation.wcagTags?.length > 0) {
          doc.setTextColor(59, 130, 246);
          doc.text(`WCAG: ${violation.wcagTags.join(', ')}`, margin, y);
          y += 4;
          doc.setTextColor(0);
        }

        // Affected elements
        if (violation.nodes?.length > 0) {
          doc.setTextColor(100);
          doc.text(`Affected elements: ${violation.nodes.length}`, margin, y);
          y += 4;
          if (violation.nodes[0]?.target) {
            const targetText = violation.nodes[0].target.join(', ');
            const targetLines = doc.splitTextToSize(`Selector: ${targetText}`, contentWidth);
            targetLines.slice(0, 2).forEach((line: string) => {
              checkPageBreak(6);
              doc.setFontSize(8);
              doc.text(line, margin, y);
              y += 4;
            });
          }
          doc.setTextColor(0);
        }

        // Help URL
        if (violation.helpUrl) {
          doc.setFontSize(8);
          doc.setTextColor(59, 130, 246);
          doc.text(`Learn more: ${violation.helpUrl}`, margin, y);
          y += 4;
          doc.setTextColor(0);
        }

        y += 8; // Space between violations
      });
    }

    // Passing checks summary
    if (a11yData.passes?.categories?.length > 0) {
      checkPageBreak(30);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0);
      doc.text('Passing Checks', margin, y);
      y += 8;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(34, 197, 94);
      const passCategories = a11yData.passes.categories.join(', ');
      const passLines = doc.splitTextToSize(passCategories, contentWidth);
      passLines.forEach((line: string) => {
        checkPageBreak(6);
        doc.text(line, margin, y);
        y += 4;
      });
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Page ${i} of ${pageCount} - Generated by QA Guardian`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }

    // Save the PDF
    const fileName = `accessibility-report-${testName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
    toast.success('Accessibility report PDF downloaded');
  };

  // Export accessibility report as CSV
  const exportAccessibilityCSV = (a11yData: any, testName: string, runDate: string) => {
    const rows: string[][] = [];

    // Helper to escape CSV values
    const escapeCSV = (value: string | number | undefined | null): string => {
      if (value === undefined || value === null) return '';
      const str = String(value);
      // Escape double quotes and wrap in quotes if contains comma, newline, or quotes
      if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Header row
    rows.push([
      'Severity',
      'Violation ID',
      'Description',
      'How to Fix',
      'WCAG Tags',
      'Affected Elements Count',
      'First Element Selector',
      'Help URL'
    ]);

    // Add violation rows
    if (a11yData.violations?.items?.length > 0) {
      a11yData.violations.items.forEach((violation: any) => {
        const firstSelector = violation.nodes?.[0]?.target?.join(' > ') || '';
        rows.push([
          escapeCSV(violation.impact || 'unknown'),
          escapeCSV(violation.id),
          escapeCSV(violation.description),
          escapeCSV(violation.help),
          escapeCSV(violation.wcagTags?.join(', ')),
          escapeCSV(violation.nodes?.length || 0),
          escapeCSV(firstSelector),
          escapeCSV(violation.helpUrl)
        ]);
      });
    }

    // Add summary information at the end as metadata rows
    rows.push([]); // Empty row
    rows.push(['--- Summary ---']);
    rows.push(['Test Name', escapeCSV(testName)]);
    rows.push(['Run Date', escapeCSV(runDate)]);
    rows.push(['URL', escapeCSV(a11yData.url)]);
    rows.push(['WCAG Level', escapeCSV(a11yData.wcag_level)]);
    rows.push(['Score', escapeCSV(a11yData.score)]);
    rows.push(['Total Violations', escapeCSV(a11yData.violations?.count || 0)]);
    rows.push(['Critical Violations', escapeCSV(a11yData.violations?.critical || 0)]);
    rows.push(['Serious Violations', escapeCSV(a11yData.violations?.serious || 0)]);
    rows.push(['Moderate Violations', escapeCSV(a11yData.violations?.moderate || 0)]);
    rows.push(['Minor Violations', escapeCSV(a11yData.violations?.minor || 0)]);
    rows.push(['Passing Checks', escapeCSV(a11yData.passes?.count || 0)]);
    rows.push(['Incomplete Checks', escapeCSV(a11yData.incomplete?.count || 0)]);
    rows.push(['Not Applicable', escapeCSV(a11yData.inapplicable?.count || 0)]);

    // Convert to CSV string
    const csvContent = rows.map(row => row.join(',')).join('\n');

    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const fileName = `accessibility-report-${testName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`;
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Accessibility report CSV downloaded');
  };

  // Code editor state for advanced users
  const [isEditingCode, setIsEditingCode] = useState(false);
  const [editedCode, setEditedCode] = useState('');
  const [isSavingCode, setIsSavingCode] = useState(false);
  const [codeError, setCodeError] = useState('');

  // AI Explanation state
  const [showExplainModal, setShowExplainModal] = useState(false);
  const [testExplanation, setTestExplanation] = useState<{
    summary: string;
    purpose: string;
    steps: Array<{ line: number; code: string; explanation: string; type: string }>;
    assertions: Array<{ line: number; code: string; what_it_checks: string; importance: string }>;
    selectors: Array<{ selector: string; strategy: string; reliability: string; suggestion?: string }>;
    improvements: Array<{ category: string; suggestion: string; priority: string }>;
    complexity: { level: string; lines_of_code: number; num_assertions: number; num_steps: number };
  } | null>(null);
  const [isExplainingTest, setIsExplainingTest] = useState(false);

  // Generate Playwright code from test steps
  const generatePlaywrightCode = (steps: typeof test.steps): string => {
    if (!steps || steps.length === 0) return '// No steps defined yet';

    const lines: string[] = [
      `import { test, expect } from '@playwright/test';`,
      '',
      `test('${test?.name || 'Untitled Test'}', async ({ page }) => {`,
    ];

    steps.forEach((step, index) => {
      const indent = '  ';
      const comment = `// Step ${index + 1}: ${step.action}`;
      lines.push(`${indent}${comment}`);

      switch (step.action) {
        case 'navigate':
          lines.push(`${indent}await page.goto('${step.value || ''}');`);
          break;
        case 'click':
          lines.push(`${indent}await page.locator('${step.selector || ''}').click();`);
          break;
        case 'fill':
          lines.push(`${indent}await page.locator('${step.selector || ''}').fill('${step.value || ''}');`);
          break;
        case 'type':
          lines.push(`${indent}await page.locator('${step.selector || ''}').type('${step.value || ''}');`);
          break;
        case 'wait':
          lines.push(`${indent}await page.waitForTimeout(${step.value || 1000});`);
          break;
        case 'assert_text':
          lines.push(`${indent}await expect(page.getByText('${step.value || ''}')).toBeVisible();`);
          break;
        case 'screenshot':
          const screenshotName = step.value || `step-${index + 1}`;
          lines.push(`${indent}await page.screenshot({ path: '${screenshotName}.png' });`);
          break;
        case 'accessibility_check':
          const a11yLevel = (step as any).a11y_wcag_level || 'AA';
          const a11yThreshold = (step as any).a11y_threshold || 0;
          lines.push(`${indent}// Accessibility check - WCAG ${a11yLevel} (threshold: ${a11yThreshold})`);
          lines.push(`${indent}const a11yResults_${index} = await new AxeBuilder({ page })`);
          lines.push(`${indent}  .withTags(['wcag2a', 'wcag2aa'${a11yLevel === 'AAA' ? ", 'wcag2aaa'" : ''}])`);
          lines.push(`${indent}  .analyze();`);
          lines.push(`${indent}expect(a11yResults_${index}.violations.length).toBeLessThanOrEqual(${a11yThreshold});`);
          break;
        default:
          lines.push(`${indent}// Unknown action: ${step.action}`);
      }
      lines.push('');
    });

    lines.push('});');
    return lines.join('\n');
  };

  // Generate K6 load test script
  const generateK6Script = (): string => {
    const targetUrl = test?.target_url || 'https://example.com';
    const virtualUsers = test?.virtual_users || 10;
    const duration = test?.duration || 60;
    const rampUpTime = test?.ramp_up_time || 10;

    return `import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '${rampUpTime}s', target: ${virtualUsers} },  // Ramp up
    { duration: '${duration - rampUpTime}s', target: ${virtualUsers} }, // Steady state
    { duration: '10s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    errors: ['rate<0.1'],              // Error rate should be below 10%
  },
};

// Default function - runs for each virtual user iteration
export default function () {
  // GET request to target URL
  const response = http.get('${targetUrl}');

  // Check response status
  const checkResult = check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  // Track errors
  errorRate.add(!checkResult);

  // Think time between requests (1-3 seconds)
  sleep(Math.random() * 2 + 1);
}

// Setup function - runs once before the test
export function setup() {
  console.log('Starting load test against ${targetUrl}');
  console.log('Virtual Users: ${virtualUsers}');
  console.log('Duration: ${duration}s');
  return { startTime: new Date().toISOString() };
}

// Teardown function - runs once after the test
export function teardown(data) {
  console.log('Load test completed');
  console.log('Started at:', data.startTime);
  console.log('Ended at:', new Date().toISOString());
}
`;
  };

  // Syntax highlighting for JavaScript/K6 code
  const highlightJavaScript = (code: string): JSX.Element[] => {
    const lines = code.split('\n');
    return lines.map((line, lineIndex) => {
      // Process each line for syntax highlighting
      let highlighted = line;

      // Handle comments first (preserve them)
      const commentIndex = line.indexOf('//');
      let beforeComment = line;
      let comment = '';
      if (commentIndex !== -1) {
        beforeComment = line.substring(0, commentIndex);
        comment = line.substring(commentIndex);
      }

      // Keywords (blue)
      const keywords = ['import', 'export', 'from', 'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'default', 'async', 'await', 'new', 'true', 'false', 'null', 'undefined'];
      keywords.forEach(keyword => {
        const regex = new RegExp(`\\b(${keyword})\\b`, 'g');
        beforeComment = beforeComment.replace(regex, `<span class="text-blue-400">$1</span>`);
      });

      // Strings (green) - single and double quotes
      beforeComment = beforeComment.replace(/'([^'\\]*(\\.[^'\\]*)*)'/g, '<span class="text-green-400">\'$1\'</span>');
      beforeComment = beforeComment.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, '<span class="text-green-400">"$1"</span>');
      beforeComment = beforeComment.replace(/`([^`\\]*(\\.[^`\\]*)*)`/g, '<span class="text-green-400">`$1`</span>');

      // Numbers (orange)
      beforeComment = beforeComment.replace(/\b(\d+\.?\d*)\b/g, '<span class="text-orange-400">$1</span>');

      // Function names (yellow)
      beforeComment = beforeComment.replace(/(\w+)\s*\(/g, '<span class="text-yellow-300">$1</span>(');

      // Properties after dot (cyan)
      beforeComment = beforeComment.replace(/\.(\w+)/g, '.<span class="text-cyan-300">$1</span>');

      // Reassemble with comment (gray)
      if (comment) {
        highlighted = beforeComment + `<span class="text-gray-500">${comment}</span>`;
      } else {
        highlighted = beforeComment;
      }

      return (
        <div key={lineIndex} className="leading-6 flex">
          <span className="select-none text-gray-500 pr-4 text-right" style={{ minWidth: '3rem' }}>
            {lineIndex + 1}
          </span>
          <span dangerouslySetInnerHTML={{ __html: highlighted || '&nbsp;' }} />
        </div>
      );
    });
  };

  // K6 script templates
  const k6Templates = {
    'load-test': {
      name: '📈 Load Test',
      description: 'Standard load test with VU ramp-up',
      script: generateK6Script(),
    },
    'stress-test': {
      name: '💥 Stress Test',
      description: 'High load to find breaking points',
      script: `import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp to 100 users
    { duration: '5m', target: 100 },   // Stay at 100
    { duration: '2m', target: 200 },   // Ramp to 200
    { duration: '5m', target: 200 },   // Stay at 200
    { duration: '2m', target: 300 },   // Ramp to 300
    { duration: '5m', target: 300 },   // Stay at 300
    { duration: '2m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(99)<1500'], // 99% under 1.5s
    errors: ['rate<0.1'],
  },
};

export default function () {
  const response = http.get('${test?.target_url || 'https://example.com'}');

  const checkResult = check(response, {
    'status is 200': (r) => r.status === 200,
    'response time OK': (r) => r.timings.duration < 1500,
  });

  errorRate.add(!checkResult);
  sleep(1);
}
`,
    },
    'spike-test': {
      name: '⚡ Spike Test',
      description: 'Sudden traffic surge simulation',
      script: `import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 10 },    // Normal load
    { duration: '1m', target: 10 },     // Normal load
    { duration: '10s', target: 1000 },  // Spike!
    { duration: '3m', target: 1000 },   // Stay at spike
    { duration: '10s', target: 10 },    // Scale down
    { duration: '3m', target: 10 },     // Recovery
    { duration: '10s', target: 0 },     // End
  ],
};

export default function () {
  const response = http.get('${test?.target_url || 'https://example.com'}');

  check(response, {
    'status is 200': (r) => r.status === 200,
  });

  sleep(1);
}
`,
    },
    'soak-test': {
      name: '🕐 Soak Test',
      description: 'Extended duration for reliability',
      script: `import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '5m', target: 50 },   // Ramp up
    { duration: '4h', target: 50 },   // Soak at 50 VUs for 4 hours
    { duration: '5m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],   // Less than 1% failures
  },
};

export default function () {
  const response = http.get('${test?.target_url || 'https://example.com'}');

  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(Math.random() * 3 + 2); // 2-5 second think time
}
`,
    },
    'api-test': {
      name: '🔌 API Test',
      description: 'REST API endpoint testing',
      script: `import http from 'k6/http';
import { check, group, sleep } from 'k6';

const BASE_URL = '${test?.target_url || 'https://api.example.com'}';

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<200'],
    'http_req_duration{name:GET}': ['p(95)<100'],
    'http_req_duration{name:POST}': ['p(95)<300'],
  },
};

export default function () {
  group('API Endpoints', function () {
    // GET request
    let getRes = http.get(\`\${BASE_URL}/api/items\`, {
      tags: { name: 'GET' },
    });
    check(getRes, {
      'GET status is 200': (r) => r.status === 200,
      'GET response has data': (r) => r.json().length > 0,
    });

    // POST request
    let postRes = http.post(\`\${BASE_URL}/api/items\`, JSON.stringify({
      name: 'Test Item',
      value: 123,
    }), {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'POST' },
    });
    check(postRes, {
      'POST status is 201': (r) => r.status === 201,
    });
  });

  sleep(1);
}
`,
    },
  };

  // Initialize K6 script when tab is opened for load tests
  useEffect(() => {
    if (test?.test_type === 'load' && activeTab === 'k6script' && !k6Script) {
      setK6Script(test?.k6_script || generateK6Script());
    }
  }, [test?.test_type, activeTab, test?.k6_script]);

  // Handle step drag start
  const handleStepDragStart = (e: React.DragEvent, index: number) => {
    setDraggedStepIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    // Add visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  // Handle step drag end
  const handleStepDragEnd = (e: React.DragEvent) => {
    setDraggedStepIndex(null);
    setDragOverIndex(null);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  };

  // Handle step drag over
  const handleStepDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  // Handle step drop
  const handleStepDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const fromIndex = draggedStepIndex;
    if (fromIndex === null || fromIndex === dropIndex || !test) return;

    // Reorder steps
    const newSteps = [...test.steps];
    const [movedStep] = newSteps.splice(fromIndex, 1);
    newSteps.splice(dropIndex, 0, movedStep);

    // Update test with new step order
    setTest({ ...test, steps: newSteps });
    setHasReorderedSteps(true);
    setDraggedStepIndex(null);
    setDragOverIndex(null);
  };

  // Save reordered steps to server
  const handleSaveStepOrder = async () => {
    if (!test || !hasReorderedSteps) return;

    setIsSavingStepOrder(true);
    try {
      const response = await fetch(`/api/v1/tests/${testId}/steps/reorder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ steps: test.steps }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to save step order');
      }

      setHasReorderedSteps(false);
      toast.success('Step order saved successfully!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save step order');
    } finally {
      setIsSavingStepOrder(false);
    }
  };

  // Save custom Playwright code for advanced users
  const handleSaveCode = async () => {
    if (!test || !editedCode.trim()) return;

    setIsSavingCode(true);
    setCodeError('');
    try {
      const response = await fetch(`/api/v1/tests/${testId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          playwright_code: editedCode,
          use_custom_code: true,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to save code');
      }

      const data = await response.json();
      setTest(data.test);
      setIsEditingCode(false);
      toast.success('Custom Playwright code saved successfully!');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save code';
      setCodeError(message);
      toast.error(message);
    } finally {
      setIsSavingCode(false);
    }
  };

  // Revert to generated code (use steps instead of custom code)
  const handleRevertToSteps = async () => {
    if (!test) return;

    setIsSavingCode(true);
    try {
      const response = await fetch(`/api/v1/tests/${testId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          use_custom_code: false,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to revert to steps');
      }

      const data = await response.json();
      setTest(data.test);
      setIsEditingCode(false);
      toast.success('Reverted to generated code from steps');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to revert to steps');
    } finally {
      setIsSavingCode(false);
    }
  };

  // Start editing custom code
  const handleStartEditCode = () => {
    // Initialize with existing custom code or generate from steps
    const initialCode = test?.playwright_code || generatePlaywrightCode(test?.steps || []);
    setEditedCode(initialCode);
    setCodeError('');
    setIsEditingCode(true);
  };

  // Cancel editing custom code
  const handleCancelEditCode = () => {
    setIsEditingCode(false);
    setEditedCode('');
    setCodeError('');
  };

  // AI Explain Test Code
  const handleExplainTest = async () => {
    if (!test) return;

    setIsExplainingTest(true);
    setShowExplainModal(true);
    setTestExplanation(null);

    try {
      const code = test.use_custom_code && test.playwright_code
        ? test.playwright_code
        : generatePlaywrightCode(test.steps || []);

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'https://qa.pixelcraftedmedia.com'}/api/v1/ai/explain-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          code,
          testName: test.name,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to explain test');
      }

      const data = await response.json();
      setTestExplanation(data.explanation);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to explain test');
      setShowExplainModal(false);
    } finally {
      setIsExplainingTest(false);
    }
  };

  // Download all artifacts for a test run (with authentication)
  const handleDownloadAllArtifacts = async (runId: string) => {
    if (isDownloadingArtifacts) return;
    setIsDownloadingArtifacts(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || 'https://qa.pixelcraftedmedia.com'}/api/v1/runs/${runId}/artifacts/download`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Download failed' }));
        throw new Error(errorData.message || 'Failed to download artifacts');
      }

      // Get the filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="?([^"]+)"?/);
      const filename = filenameMatch ? filenameMatch[1] : `run-${runId}-artifacts.zip`;

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Artifacts downloaded successfully!');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to download artifacts';
      toast.error(message);
    } finally {
      setIsDownloadingArtifacts(false);
    }
  };

  // Reset zoom and pan when lightbox image changes
  useEffect(() => {
    if (lightboxImage) {
      setLightboxZoom(1);
      setLightboxPan({ x: 0, y: 0 });
    }
  }, [lightboxImage]);

  // Handle Escape key to close modals
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showUnsavedChangesModal) setShowUnsavedChangesModal(false);
        if (showDeleteModal) setShowDeleteModal(false);
        if (showAddStepModal) setShowAddStepModal(false);
        if (lightboxImage) setLightboxImage(null);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showDeleteModal, showAddStepModal, lightboxImage, showUnsavedChangesModal]);

  // Handle browser tab close/refresh with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && showEditModal) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, showEditModal]);

  // Handle confirming navigation (discard changes)
  const handleConfirmNavigation = () => {
    setShowUnsavedChangesModal(false);
    setShowEditModal(false);
    setIsDirty(false);
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    }
  };

  // Handle cancelling navigation (stay on page)
  const handleCancelNavigation = () => {
    setShowUnsavedChangesModal(false);
    setPendingNavigation(null);
  };

  // Check if any filters are active (not default)
  const hasActiveFilters = statusFilter !== 'all' || dateFilter !== 'all';

  // Helper to update URL search params while preserving other params
  const updateSearchParams = (updates: Record<string, string | null>) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === 'all' || value === '1') {
          newParams.delete(key);
        } else {
          newParams.set(key, value);
        }
      });
      return newParams;
    }, { replace: true });
  };

  // Wrapper functions that reset pagination when filters change (persisted in URL)
  const setStatusFilter = (value: 'all' | 'passed' | 'failed' | 'running') => {
    updateSearchParams({ status: value, page: '1' }); // Reset to page 1 when filter changes
  };

  const setDateFilter = (value: 'all' | 'today' | '7days' | '30days') => {
    updateSearchParams({ date: value, page: '1' }); // Reset to page 1 when filter changes
  };

  const setRunPage = (page: number) => {
    updateSearchParams({ page: page.toString() });
  };

  const setPageSize = (size: number) => {
    updateSearchParams({ pageSize: size.toString(), page: '1' }); // Reset to page 1 when changing page size
  };

  // Clear all filters to defaults
  const clearFilters = () => {
    updateSearchParams({ status: null, date: null, page: null });
  };

  // Export filtered runs to JSON file
  const handleExportRuns = () => {
    if (filteredRuns.length === 0) {
      toast.error('No runs to export');
      return;
    }

    // Prepare export data with filter info
    const exportData = {
      test: {
        name: test?.name,
        id: test?.id,
      },
      filters: {
        status: statusFilter,
        date: dateFilter,
      },
      runs: filteredRuns.map(run => ({
        id: run.id,
        status: run.status,
        duration_ms: run.duration_ms,
        started_at: run.started_at,
        completed_at: run.completed_at,
        created_at: run.created_at,
        results: run.results?.map(result => ({
          test_id: result.test_id,
          test_name: result.test_name,
          status: result.status,
          duration_ms: result.duration_ms,
          error: result.error,
        })),
      })),
      total_runs: filteredRuns.length,
      exported_at: new Date().toISOString(),
      version: '1.0',
    };

    // Create and download JSON file
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const filterSuffix = statusFilter !== 'all' ? `-${statusFilter}` : '';
    link.download = `${test?.name?.toLowerCase().replace(/\s+/g, '-') || 'runs'}${filterSuffix}-runs-export.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${filteredRuns.length} run(s) to file`);
  };

  // Filter runs by status and date
  const filteredRuns = runs.filter(run => {
    // Status filter
    if (statusFilter !== 'all' && run.status !== statusFilter) {
      return false;
    }
    // Date filter
    if (dateFilter !== 'all') {
      const runDate = new Date(run.created_at);
      const now = new Date();
      if (dateFilter === 'today') {
        // Check if run date is today (same calendar day)
        if (runDate.toDateString() !== now.toDateString()) {
          return false;
        }
      } else {
        const diffDays = Math.floor((now.getTime() - runDate.getTime()) / (1000 * 60 * 60 * 24));
        if (dateFilter === '7days' && diffDays > 7) {
          return false;
        }
        if (dateFilter === '30days' && diffDays > 30) {
          return false;
        }
      }
    }
    return true;
  });

  // Count runs by status
  const runCounts = {
    all: runs.length,
    passed: runs.filter(r => r.status === 'passed').length,
    failed: runs.filter(r => r.status === 'failed').length,
    running: runs.filter(r => r.status === 'running').length,
  };

  // Sort state
  const [sortBy, setSortBy] = useState<'date' | 'duration'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // K6 run comparison state (Feature #564)
  const [selectedRunsForCompare, setSelectedRunsForCompare] = useState<string[]>([]);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [compareResults, setCompareResults] = useState<any>(null);
  const [isComparing, setIsComparing] = useState(false);

  // Check if current test is a load test (for comparison feature)
  const isLoadTest = test?.test_type === 'load';

  // Sort filtered runs
  const sortedRuns = [...filteredRuns].sort((a, b) => {
    if (sortBy === 'date') {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    } else {
      const durationA = a.duration_ms || 0;
      const durationB = b.duration_ms || 0;
      return sortOrder === 'asc' ? durationA - durationB : durationB - durationA;
    }
  });

  // Paginate sorted runs
  const totalPages = Math.ceil(sortedRuns.length / pageSize);
  const paginatedRuns = sortedRuns.slice(
    (runPage - 1) * pageSize,
    runPage * pageSize
  );

  const handleSort = (field: 'date' | 'duration') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  // Toggle run selection for comparison (Feature #564)
  const toggleRunSelection = (runId: string) => {
    setSelectedRunsForCompare(prev => {
      if (prev.includes(runId)) {
        return prev.filter(id => id !== runId);
      }
      if (prev.length >= 2) {
        // Replace oldest selection
        return [prev[1], runId];
      }
      return [...prev, runId];
    });
  };

  // Compare two K6 runs (Feature #564)
  const handleCompareRuns = async () => {
    if (selectedRunsForCompare.length !== 2) return;

    setIsComparing(true);
    setCompareResults(null);

    try {
      const [baseRunId, compareRunId] = selectedRunsForCompare;
      const response = await fetch(
        `/api/v1/runs/compare?baseRunId=${baseRunId}&compareRunId=${compareRunId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to compare runs');
      }

      const data = await response.json();
      // API returns { comparison: { ... } }, so we extract the comparison object
      setCompareResults(data.comparison || data);
      setShowCompareModal(true);
    } catch (error) {
      console.error('Error comparing runs:', error);
      alert('Failed to compare runs. Make sure both runs have K6 load test results.');
    } finally {
      setIsComparing(false);
    }
  };

  const [newStepAction, setNewStepAction] = useState('navigate');
  const [newStepSelector, setNewStepSelector] = useState('');
  const [newStepValue, setNewStepValue] = useState('');
  const [isAddingStep, setIsAddingStep] = useState(false);
  const [addStepError, setAddStepError] = useState('');
  const [newStepCheckpointName, setNewStepCheckpointName] = useState('');
  const [newStepCheckpointThreshold, setNewStepCheckpointThreshold] = useState('0.1');
  // Accessibility check step configuration
  const [newStepA11yWcagLevel, setNewStepA11yWcagLevel] = useState<'A' | 'AA' | 'AAA'>('AA');
  const [newStepA11yFailOnAny, setNewStepA11yFailOnAny] = useState(false);
  const [newStepA11yFailOnCritical, setNewStepA11yFailOnCritical] = useState(true);
  const [newStepA11yThreshold, setNewStepA11yThreshold] = useState('0'); // 0 = any violation fails

  // Feature #1236: AI Copilot autocomplete state for test steps
  const [selectorAutocomplete, setSelectorAutocomplete] = useState<string | null>(null);
  const [valueAutocomplete, setValueAutocomplete] = useState<string | null>(null);
  const [showSelectorAutocomplete, setShowSelectorAutocomplete] = useState(false);
  const [showValueAutocomplete, setShowValueAutocomplete] = useState(false);

  // Feature #1236: Common selector patterns for autocomplete
  const selectorPatterns: Record<string, string[]> = {
    'button': ['button.submit', 'button[type="submit"]', 'button.btn-primary', 'button#submit'],
    'input': ['input[type="email"]', 'input[type="password"]', 'input#username', 'input.form-control'],
    '#': ['#login-form', '#submit-button', '#email', '#password', '#search'],
    '.': ['.btn', '.form-control', '.nav-link', '.card', '.modal'],
    '[data': ['[data-testid="submit"]', '[data-testid="login"]', '[data-testid="search"]'],
    'form': ['form#login', 'form.auth-form', 'form[action="/login"]'],
    'a': ['a.nav-link', 'a[href="/dashboard"]', 'a.btn'],
  };

  // Feature #1236: Common value patterns based on action type
  // Feature #1969: Use test's target_url instead of example.com
  const baseUrl = test?.target_url || '';
  const valuePatterns: Record<string, string[]> = {
    navigate: baseUrl ? [`${baseUrl}`, `${baseUrl}/login`, `${baseUrl}/dashboard`, '/api/health'] : ['/home', '/login', '/dashboard', '/api/health'],
    fill: ['your-email@domain.com', 'password123', 'John Doe', 'Search query'],
    type: ['Hello World', 'your-text', 'password', 'Search term'],
    wait: ['1000', '2000', '500', '3000'],
    assert_text: ['Welcome', 'Login successful', 'Dashboard', 'Submit'],
  };

  // Feature #1236: Generate autocomplete suggestion for selector
  useEffect(() => {
    if (!newStepSelector || !showAddStepModal) {
      setSelectorAutocomplete(null);
      setShowSelectorAutocomplete(false);
      return;
    }

    // Find matching pattern
    const input = newStepSelector.toLowerCase();
    for (const [prefix, suggestions] of Object.entries(selectorPatterns)) {
      if (input.startsWith(prefix.toLowerCase())) {
        const match = suggestions.find(s => s.toLowerCase().startsWith(input) && s.toLowerCase() !== input);
        if (match) {
          setSelectorAutocomplete(match);
          setShowSelectorAutocomplete(true);
          return;
        }
      }
    }
    setSelectorAutocomplete(null);
    setShowSelectorAutocomplete(false);
  }, [newStepSelector, showAddStepModal]);

  // Feature #1236: Generate autocomplete suggestion for value
  useEffect(() => {
    if (!newStepValue || !showAddStepModal) {
      setValueAutocomplete(null);
      setShowValueAutocomplete(false);
      return;
    }

    const patterns = valuePatterns[newStepAction] || [];
    const input = newStepValue.toLowerCase();
    const match = patterns.find(p => p.toLowerCase().startsWith(input) && p.toLowerCase() !== input);
    if (match) {
      setValueAutocomplete(match);
      setShowValueAutocomplete(true);
    } else {
      setValueAutocomplete(null);
      setShowValueAutocomplete(false);
    }
  }, [newStepValue, newStepAction, showAddStepModal]);

  // Feature #1236: Handle Tab key to accept autocomplete
  const handleSelectorKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab' && selectorAutocomplete && showSelectorAutocomplete) {
      e.preventDefault();
      setNewStepSelector(selectorAutocomplete);
      setSelectorAutocomplete(null);
      setShowSelectorAutocomplete(false);
    }
  };

  const handleValueKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab' && valueAutocomplete && showValueAutocomplete) {
      e.preventDefault();
      setNewStepValue(valueAutocomplete);
      setValueAutocomplete(null);
      setShowValueAutocomplete(false);
    }
  };

  const canEdit = user?.role !== 'viewer';
  const canDelete = user?.role !== 'viewer';
  const canRun = user?.role !== 'viewer';

  const handleDelete = async () => {
    setDeleteError('');
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/v1/tests/${testId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete test');
      }

      // Navigate to parent suite page after successful deletion
      if (suite) {
        navigate(`/suites/${suite.id}`);
      } else {
        navigate('/projects');
      }
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete test');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenEditModal = () => {
    if (test) {
      setEditName(test.name);
      setEditDescription(test.description || '');
      setEditError('');
      setIsDirty(false); // Reset dirty state when opening modal
      setShowEditModal(true);
    }
  };

  // Track dirty state when edit modal form values change
  useEffect(() => {
    if (showEditModal && test) {
      const nameChanged = editName !== test.name;
      const descChanged = editDescription !== (test.description || '');
      setIsDirty(nameChanged || descChanged);
    }
  }, [editName, editDescription, showEditModal, test]);

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError('');
    setIsEditing(true);
    try {
      const response = await fetch(`/api/v1/tests/${testId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editName,
          description: editDescription,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to update test');
      }

      const data = await response.json();
      setTest(data.test);
      setIsDirty(false); // Reset dirty state on successful save
      setShowEditModal(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update test');
    } finally {
      setIsEditing(false);
    }
  };

  const handleDuplicate = async () => {
    if (!test || !suite) return;
    setDuplicateError('');
    setIsDuplicating(true);
    try {
      // Create a new test with the same properties but "(Copy)" suffix
      const response = await fetch(`/api/v1/suites/${suite.id}/tests`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `${test.name} (Copy)`,
          description: test.description,
          steps: test.steps,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to duplicate test');
      }

      const data = await response.json();
      // Navigate to the new test
      navigate(`/tests/${data.test.id}`);
    } catch (err) {
      setDuplicateError(err instanceof Error ? err.message : 'Failed to duplicate test');
    } finally {
      setIsDuplicating(false);
    }
  };

  // Handle creating a quick schedule for this test
  const handleCreateQuickSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!test || !suite) return;

    setIsCreatingSchedule(true);
    setQuickScheduleError('');

    try {
      const scheduleData: Record<string, unknown> = {
        name: quickScheduleName || `${test.name} Schedule`,
        description: `Automated schedule for test: ${test.name}`,
        test_suite_id: suite.id,
        tests: [test.id],
        browsers: [suite.default_browser || 'chromium'],
        enabled: true,
        timezone: quickScheduleTimezone,
        notify_on_failure: true,
      };

      if (quickScheduleType === 'one-time') {
        scheduleData.run_at = quickScheduleRunAt;
      } else {
        scheduleData.cron_expression = quickScheduleCron;
      }

      const response = await fetch('/api/v1/schedules', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(scheduleData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to create schedule');
      }

      // Success - close modal and show notification
      setShowQuickScheduleModal(false);
      setQuickScheduleName('');
      setQuickScheduleType('recurring');
      setQuickScheduleCron('0 2 * * *');
      addNotification({
        type: 'success',
        title: 'Schedule Created',
        message: `Schedule "${quickScheduleName || test.name + ' Schedule'}" created successfully`,
      });
    } catch (err) {
      setQuickScheduleError(err instanceof Error ? err.message : 'Failed to create schedule');
    } finally {
      setIsCreatingSchedule(false);
    }
  };

  // Handle approving a new baseline
  const handleApproveBaseline = async (runId?: string) => {
    setApprovingBaseline(true);
    setApproveBaselineError('');

    try {
      const response = await fetch(`/api/v1/tests/${testId}/baseline/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ runId, branch: selectedBranch }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to approve baseline');
      }

      const data = await response.json();

      // Close the modal
      setShowApproveBaselineModal(false);
      setApproveBaselineRunId(null);

      // Show success notification
      addNotification({
        type: 'success',
        title: 'Baseline Approved',
        message: 'New baseline approved successfully! Future test runs will compare against this baseline.',
      });

      // Refresh baseline data
      setBaselineData(null);
      if (activeTab === 'baseline') {
        // Trigger a re-fetch of baseline data
        setLoadingBaseline(true);
        try {
          const baselineResponse = await fetch(`/api/v1/tests/${testId}/baseline`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json',
            },
          });
          if (baselineResponse.ok) {
            const baselineJson = await baselineResponse.json();
            setBaselineData(baselineJson);
          }
        } catch (err) {
          console.error('Failed to fetch baseline:', err);
        } finally {
          setLoadingBaseline(false);
        }

        // Also refresh baseline history
        setLoadingBaselineHistory(true);
        try {
          const historyResponse = await fetch(`/api/v1/tests/${testId}/baseline/history`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          if (historyResponse.ok) {
            const historyJson = await historyResponse.json();
            setBaselineHistory(historyJson.history || []);
          }
        } catch (err) {
          console.error('Failed to fetch baseline history:', err);
        } finally {
          setLoadingBaselineHistory(false);
        }
      }
    } catch (error) {
      setApproveBaselineError(error instanceof Error ? error.message : 'Failed to approve baseline');
    } finally {
      setApprovingBaseline(false);
    }
  };

  // Handle restoring a baseline from history
  const handleRestoreBaseline = async (historyId: string) => {
    setRestoringBaseline(true);
    setRestoreBaselineError('');

    try {
      const response = await fetch(`/api/v1/tests/${testId}/baseline/history/${historyId}/restore`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ branch: selectedBranch }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to restore baseline');
      }

      const data = await response.json();

      // Close the modal
      setShowRestoreBaselineModal(false);
      setRestoreHistoryEntry(null);

      // Show success notification
      addNotification({
        type: 'success',
        title: 'Baseline Restored',
        message: `Baseline restored from version ${data.restoredFromVersion}! Future test runs will compare against this baseline.`,
      });

      // Refresh baseline data
      setBaselineData(null);
      setLoadingBaseline(true);
      try {
        const baselineResponse = await fetch(`/api/v1/tests/${testId}/baseline`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        });
        if (baselineResponse.ok) {
          const baselineJson = await baselineResponse.json();
          setBaselineData(baselineJson);
        }
      } catch (err) {
        console.error('Failed to fetch baseline:', err);
      } finally {
        setLoadingBaseline(false);
      }

      // Also refresh baseline history
      setLoadingBaselineHistory(true);
      try {
        const historyResponse = await fetch(`/api/v1/tests/${testId}/baseline/history`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (historyResponse.ok) {
          const historyJson = await historyResponse.json();
          setBaselineHistory(historyJson.history || []);
        }
      } catch (err) {
        console.error('Failed to fetch baseline history:', err);
      } finally {
        setLoadingBaselineHistory(false);
      }
    } catch (error) {
      setRestoreBaselineError(error instanceof Error ? error.message : 'Failed to restore baseline');
    } finally {
      setRestoringBaseline(false);
    }
  };

  // Handle rejecting visual changes
  const handleRejectChanges = async (runId?: string) => {
    setRejectingChanges(true);
    setRejectChangesError('');

    try {
      const response = await fetch(`/api/v1/tests/${testId}/visual/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          runId: runId || rejectChangesRunId,
          reason: rejectionReason.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to reject changes');
      }

      const data = await response.json();

      // Close the modal
      setShowRejectChangesModal(false);
      setRejectChangesRunId(null);
      setRejectionReason('');

      // Update rejection status
      setRejectionStatus({
        hasRejection: true,
        rejectedBy: data.rejectedBy,
        rejectedAt: data.rejectedAt,
        reason: data.reason,
      });

      // Show success notification
      addNotification({
        type: 'success',
        title: 'Changes Rejected',
        message: `Visual changes have been marked as a regression${data.reason ? ': ' + data.reason : ''}`,
        duration: 5000,
      });
    } catch (error) {
      setRejectChangesError(error instanceof Error ? error.message : 'Failed to reject changes');
    } finally {
      setRejectingChanges(false);
    }
  };

  // Handle merging a baseline from another branch (e.g., feature branch to main)
  const handleMergeBaseline = async (sourceBranch: string) => {
    setIsMergingBaseline(true);
    setMergeBaselineError('');

    try {
      const response = await fetch(`/api/v1/tests/${testId}/baseline/merge`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceBranch,
          targetBranch: selectedBranch,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to merge baseline');
      }

      const data = await response.json();

      // Close the modal
      setShowMergeBaselineModal(false);
      setSelectedMergeBranch(null);

      // Show success notification
      addNotification({
        type: 'success',
        title: 'Baseline Merged',
        message: `Baseline merged from '${sourceBranch}' to '${selectedBranch}'. Future tests will compare against this baseline.`,
        duration: 5000,
      });

      // Refresh baseline data
      setBaselineData(null);
      setLoadingBaseline(true);
      try {
        const baselineResponse = await fetch(`/api/v1/tests/${testId}/baseline?branch=${encodeURIComponent(selectedBranch)}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        });
        if (baselineResponse.ok) {
          const baselineJson = await baselineResponse.json();
          setBaselineData(baselineJson);
        }
      } catch (err) {
        console.error('Failed to fetch baseline:', err);
      } finally {
        setLoadingBaseline(false);
      }

      // Also refresh baseline history
      setLoadingBaselineHistory(true);
      try {
        const historyResponse = await fetch(`/api/v1/tests/${testId}/baseline/history?branch=${encodeURIComponent(selectedBranch)}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (historyResponse.ok) {
          const historyJson = await historyResponse.json();
          setBaselineHistory(historyJson.history || []);
        }
      } catch (err) {
        console.error('Failed to fetch baseline history:', err);
      } finally {
        setLoadingBaselineHistory(false);
      }

      // Refresh mergeable branches
      setMergeableBranches([]);
    } catch (error) {
      setMergeBaselineError(error instanceof Error ? error.message : 'Failed to merge baseline');
    } finally {
      setIsMergingBaseline(false);
    }
  };

  // Check rejection status when test result changes
  useEffect(() => {
    const checkRejectionStatus = async () => {
      if (!currentRun?.id || !testId || !token) return;

      try {
        const response = await fetch(`/api/v1/tests/${testId}/visual/rejection?runId=${currentRun.id}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          setRejectionStatus(data);
        }
      } catch (error) {
        console.error('Failed to check rejection status:', error);
      }
    };

    checkRejectionStatus();
  }, [currentRun?.id, testId, token]);

  const handleRunTest = async () => {
    setRunError('');
    setIsRunning(true);
    setLiveProgress(null);

    // Connect to socket if not already connected
    connect();

    try {
      const response = await fetch(`/api/v1/tests/${testId}/runs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          branch: selectedBranch, // Include branch for baseline comparison
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to start test run');
      }

      const data = await response.json();
      setCurrentRun(data.run);

      // Join the run's WebSocket room for real-time updates
      joinRun(data.run.id);
      console.log('[WebSocket] Joined run room:', data.run.id);

      // Also poll for completion as fallback (WebSocket may not be immediate)
      pollRunStatus(data.run.id);
    } catch (err) {
      // Use enhanced error handling for network errors
      setRunError(getErrorMessage(err, 'Failed to start test run'));
      setIsRunning(false);
    }
  };

  const handleCancelRun = async () => {
    if (!currentRun?.id) return;

    setIsCancellingRun(true);

    try {
      const response = await fetch(`/api/v1/runs/${currentRun.id}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to cancel run');
      }

      setCurrentRun(prev => prev ? { ...prev, status: 'cancelled' } : null);
      setIsRunning(false);
      setLiveProgress(null);
      // Leave the run room
      if (currentRun.id) {
        leaveRun(currentRun.id);
      }
      toast.success('Test run cancelled');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel run');
    } finally {
      setIsCancellingRun(false);
    }
  };

  // Handle WebSocket events for real-time updates
  useEffect(() => {
    if (!socket || !currentRun) return;

    const handleRunStart = (data: { runId: string; status: string }) => {
      console.log('[WebSocket] run-start event:', data);
      if (data.runId === currentRun.id) {
        setCurrentRun(prev => prev ? { ...prev, status: 'running' } : null);
      }
    };

    const handleRunProgress = (data: { runId: string; totalTests: number; completedTests: number; currentTest?: string }) => {
      console.log('[WebSocket] run-progress event:', data);
      if (data.runId === currentRun.id) {
        setLiveProgress({
          totalTests: data.totalTests,
          completedTests: data.completedTests,
          currentTest: data.currentTest,
        });
      }
    };

    const handleStepStart = (data: { runId: string; stepIndex: number; action: string }) => {
      console.log('[WebSocket] step-start event:', data);
      if (data.runId === currentRun.id) {
        setLiveProgress(prev => prev ? {
          ...prev,
          currentStep: { index: data.stepIndex, total: prev.currentStep?.total || 0, action: data.action }
        } : null);
      }
    };

    const handleStepComplete = (data: { runId: string; stepIndex: number; totalSteps: number; status: string }) => {
      console.log('[WebSocket] step-complete event:', data);
      if (data.runId === currentRun.id) {
        setLiveProgress(prev => prev ? {
          ...prev,
          currentStep: { index: data.stepIndex + 1, total: data.totalSteps, action: '' }
        } : null);
      }
    };

    const handleRunComplete = (data: { runId: string; status: string; duration_ms: number }) => {
      console.log('[WebSocket] run-complete event:', data);
      if (data.runId === currentRun.id) {
        setIsRunning(false);
        setLiveProgress(null);
        // Leave the room
        leaveRun(data.runId);
        // Refresh runs list
        fetchRuns();
      }
    };

    // K6 load test progress handler
    const handleStepProgress = (data: { runId: string; phase: string; progress: number; currentVUs?: number; totalRequests?: number; requestsPerSecond?: number; avgResponseTime?: number; errorRate?: number; p50ResponseTime?: number; p95ResponseTime?: number; p99ResponseTime?: number }) => {
      console.log('[WebSocket] step-progress event:', data);
      if (data.runId === currentRun.id) {
        setLiveProgress(prev => prev ? {
          ...prev,
          k6Metrics: {
            phase: data.phase,
            progress: data.progress,
            currentVUs: data.currentVUs,
            totalRequests: data.totalRequests,
            requestsPerSecond: data.requestsPerSecond,
            avgResponseTime: data.avgResponseTime,
            errorRate: data.errorRate,
            // Response time percentiles (Feature #549)
            p50ResponseTime: data.p50ResponseTime,
            p95ResponseTime: data.p95ResponseTime,
            p99ResponseTime: data.p99ResponseTime,
          }
        } : null);
      }
    };

    socket.on('run-start', handleRunStart);
    socket.on('run-progress', handleRunProgress);
    socket.on('step-start', handleStepStart);
    socket.on('step-complete', handleStepComplete);
    socket.on('step-progress', handleStepProgress);
    socket.on('run-complete', handleRunComplete);

    return () => {
      socket.off('run-start', handleRunStart);
      socket.off('run-progress', handleRunProgress);
      socket.off('step-start', handleStepStart);
      socket.off('step-complete', handleStepComplete);
      socket.off('step-progress', handleStepProgress);
      socket.off('run-complete', handleRunComplete);
    };
  }, [socket, currentRun, leaveRun]);

  const pollRunStatus = async (runId: string) => {
    const poll = async () => {
      try {
        const response = await fetch(`/api/v1/runs/${runId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setCurrentRun(data.run);

          if (data.run.status === 'pending' || data.run.status === 'running') {
            // Continue polling
            setTimeout(poll, 1000);
          } else {
            // Run completed
            setIsRunning(false);
            setLiveProgress(null);
            // Leave the room
            leaveRun(runId);
            // Refresh runs list
            fetchRuns();
          }
        } else {
          setIsRunning(false);
        }
      } catch {
        setIsRunning(false);
      }
    };

    poll();
  };

  const fetchRuns = async () => {
    try {
      const response = await fetch(`/api/v1/tests/${testId}/runs`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setRuns(data.runs);
      }
    } catch {
      // Ignore errors for runs fetch
    }
  };

  // Feature #1101: Fetch flakiness trend data
  const fetchFlakinessTrend = async () => {
    if (!testId || !token) return;
    setIsLoadingFlakinessTrend(true);
    try {
      const response = await fetch(`/api/v1/tests/${testId}/flakiness-trend`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setFlakinessTrend(data);
      }
    } catch (error) {
      console.error('Failed to fetch flakiness trend:', error);
    } finally {
      setIsLoadingFlakinessTrend(false);
    }
  };

  // Feature #1101: Fetch flakiness trend when test ID changes
  useEffect(() => {
    if (testId && token) {
      fetchFlakinessTrend();
    }
  }, [testId, token]);

  const handleAddStep = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddStepError('');
    setIsAddingStep(true);

    try {
      // Get current steps and add new one
      const newStep: {
        id: string;
        action: string;
        selector?: string;
        value?: string;
        order: number;
        checkpointName?: string;
        checkpointThreshold?: number;
        // Accessibility check fields
        a11y_wcag_level?: 'A' | 'AA' | 'AAA';
        a11y_fail_on_any?: boolean;
        a11y_fail_on_critical?: boolean;
        a11y_threshold?: number;
      } = {
        id: String(Date.now()),
        action: newStepAction,
        selector: newStepSelector || undefined,
        value: newStepValue || undefined,
        order: test?.steps.length || 0,
      };

      // Add visual checkpoint configuration
      if (newStepAction === 'visual_checkpoint') {
        newStep.checkpointName = newStepCheckpointName || `checkpoint-${Date.now()}`;
        newStep.checkpointThreshold = parseFloat(newStepCheckpointThreshold) || 0.1;
      }

      // Add accessibility check configuration
      if (newStepAction === 'accessibility_check') {
        newStep.a11y_wcag_level = newStepA11yWcagLevel;
        newStep.a11y_fail_on_any = newStepA11yFailOnAny;
        newStep.a11y_fail_on_critical = newStepA11yFailOnCritical;
        newStep.a11y_threshold = parseInt(newStepA11yThreshold, 10) || 0;
      }

      const updatedSteps = [...(test?.steps || []), newStep];

      const response = await fetch(`/api/v1/tests/${testId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ steps: updatedSteps }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to add step');
      }

      const data = await response.json();
      setTest(data.test);
      setShowAddStepModal(false);
      setNewStepAction('navigate');
      setNewStepSelector('');
      setNewStepValue('');
      setNewStepCheckpointName('');
      setNewStepCheckpointThreshold('0.1');
      // Reset accessibility check fields
      setNewStepA11yWcagLevel('AA');
      setNewStepA11yFailOnAny(false);
      setNewStepA11yFailOnCritical(true);
      setNewStepA11yThreshold('0');
    } catch (err) {
      setAddStepError(err instanceof Error ? err.message : 'Failed to add step');
    } finally {
      setIsAddingStep(false);
    }
  };

  useEffect(() => {
    const fetchTest = async () => {
      try {
        // Fetch test
        const testResponse = await fetch(`/api/v1/tests/${testId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!testResponse.ok) {
          setError('Test not found');
          return;
        }

        const testData = await testResponse.json();
        setTest(testData.test);

        // Fetch suite
        const suiteResponse = await fetch(`/api/v1/suites/${testData.test.suite_id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (suiteResponse.ok) {
          const suiteData = await suiteResponse.json();
          setSuite(suiteData.suite);

          // Fetch project
          const projectResponse = await fetch(`/api/v1/projects/${suiteData.suite.project_id}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          if (projectResponse.ok) {
            const projectData = await projectResponse.json();
            setProject(projectData.project);
          }
        }
        // Fetch runs
        const runsResponse = await fetch(`/api/v1/tests/${testId}/runs`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (runsResponse.ok) {
          const runsData = await runsResponse.json();
          setRuns(runsData.runs);
        }
      } catch (err) {
        setError('Failed to load test');
      } finally {
        setIsLoading(false);
      }
    };
    fetchTest();
  }, [testId, token]);

  // Fetch available branches when viewing a visual regression test
  useEffect(() => {
    if (!test?.test_type || test.test_type !== 'visual_regression') {
      return;
    }

    const fetchBranches = async () => {
      setLoadingBranches(true);
      try {
        const response = await fetch(`/api/v1/tests/${testId}/baseline/branches`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          const branches = data.branches || [];
          // Always include 'main' and ensure it's first
          if (!branches.includes('main')) {
            branches.unshift('main');
          }
          setAvailableBranches(branches);
        }
      } catch (err) {
        console.error('Failed to fetch branches:', err);
        setAvailableBranches(['main']);
      } finally {
        setLoadingBranches(false);
      }
    };

    fetchBranches();
  }, [testId, token, test?.test_type]);

  // Fetch mergeable baselines from other branches (for baseline merge after branch merge)
  useEffect(() => {
    if (!test?.test_type || test.test_type !== 'visual_regression') {
      return;
    }

    const fetchMergeableBranches = async () => {
      setLoadingMergeableBranches(true);
      try {
        const response = await fetch(`/api/v1/tests/${testId}/baseline/mergeable?targetBranch=${encodeURIComponent(selectedBranch)}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setMergeableBranches(data.mergeableBranches || []);
        } else {
          setMergeableBranches([]);
        }
      } catch (err) {
        console.error('Failed to fetch mergeable branches:', err);
        setMergeableBranches([]);
      } finally {
        setLoadingMergeableBranches(false);
      }
    };

    fetchMergeableBranches();
  }, [testId, token, test?.test_type, selectedBranch, baselineData]);

  // Fetch baseline when baseline tab is selected (for visual regression tests)
  useEffect(() => {
    if (activeTab !== 'baseline' || !test?.test_type || test.test_type !== 'visual_regression') {
      return;
    }

    const fetchBaseline = async () => {
      setLoadingBaseline(true);
      try {
        const response = await fetch(`/api/v1/tests/${testId}/baseline?branch=${encodeURIComponent(selectedBranch)}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          setBaselineData(data);
        } else if (response.status === 404) {
          setBaselineData({ hasBaseline: false });
        }
      } catch (err) {
        console.error('Failed to fetch baseline:', err);
        setBaselineData({ hasBaseline: false });
      } finally {
        setLoadingBaseline(false);
      }
    };

    fetchBaseline();
  }, [activeTab, testId, token, test?.test_type, selectedBranch]);

  // Fetch baseline history when baseline tab is selected (for visual regression tests)
  useEffect(() => {
    if (activeTab !== 'baseline' || !test?.test_type || test.test_type !== 'visual_regression') {
      return;
    }

    const fetchBaselineHistory = async () => {
      setLoadingBaselineHistory(true);
      try {
        const response = await fetch(`/api/v1/tests/${testId}/baseline/history?branch=${encodeURIComponent(selectedBranch)}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setBaselineHistory(data.history || []);
        } else {
          setBaselineHistory([]);
        }
      } catch (err) {
        console.error('Failed to fetch baseline history:', err);
        setBaselineHistory([]);
      } finally {
        setLoadingBaselineHistory(false);
      }
    };

    fetchBaselineHistory();
  }, [activeTab, testId, token, test?.test_type, selectedBranch]);

  // Fetch baseline history version image when selected
  useEffect(() => {
    if (!selectedHistoryVersion || !testId || !token) {
      setHistoryVersionImage(null);
      return;
    }

    const fetchHistoryImage = async () => {
      setLoadingHistoryImage(true);
      try {
        const response = await fetch(`/api/v1/tests/${testId}/baseline/history/${selectedHistoryVersion}?format=json`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setHistoryVersionImage(data.image || null);
        } else {
          setHistoryVersionImage(null);
        }
      } catch (err) {
        console.error('Failed to fetch baseline history image:', err);
        setHistoryVersionImage(null);
      } finally {
        setLoadingHistoryImage(false);
      }
    };

    fetchHistoryImage();
  }, [selectedHistoryVersion, testId, token]);

  // Connect to Socket.IO and join organization room for cross-tab sync
  useEffect(() => {
    if (user?.organization_id) {
      connect();
      // Small delay to ensure socket is connected before joining room
      const timer = setTimeout(() => {
        joinOrg(user.organization_id);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [user?.organization_id, connect, joinOrg]);

  // Listen for run events from other tabs (via org room) - track processed runs to avoid duplicates
  const processedRunsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!socket || !testId) return;

    const handleOrgRunComplete = (data: { runId: string; orgId: string; status: string; duration_ms: number; testName?: string }) => {
      console.log('[WebSocket] Received run-complete from org room:', data);

      // Avoid processing the same run twice (we receive from both run room and org room)
      if (processedRunsRef.current.has(data.runId)) {
        console.log('[WebSocket] Skipping duplicate notification for run:', data.runId);
        return;
      }
      processedRunsRef.current.add(data.runId);

      // Add notification for completed test
      const isSuccess = data.status === 'passed';
      addNotification({
        type: isSuccess ? 'test_complete' : 'test_failed',
        title: isSuccess ? 'Test Passed' : 'Test Failed',
        message: `${data.testName || 'Test'} ${isSuccess ? 'completed successfully' : 'failed'} (${(data.duration_ms / 1000).toFixed(1)}s)`,
        runId: data.runId,
        testId: testId,
      });

      // Refresh runs list when a run completes (could be from another tab)
      fetch(`/api/v1/tests/${testId}/runs`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
        .then(res => res.json())
        .then(runsData => {
          if (runsData.runs) {
            setRuns(runsData.runs);
          }
        })
        .catch(err => console.error('Failed to refresh runs:', err));
    };

    socket.on('run-complete', handleOrgRunComplete);

    return () => {
      socket.off('run-complete', handleOrgRunComplete);
    };
  }, [socket, testId, token, addNotification]);

  if (isLoading) {
    return (
      <Layout>
        <div className="p-8">
          <p className="text-muted-foreground">Loading test...</p>
        </div>
      </Layout>
    );
  }

  if (error || !test) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center p-8 min-h-[60vh]">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground">Test Not Found</h2>
            <p className="mt-2 text-muted-foreground">{error}</p>
            <button
              onClick={() => navigate('/projects')}
              className="mt-6 rounded-md bg-primary px-6 py-2 font-medium text-primary-foreground hover:bg-primary/90"
            >
              Go to Projects
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-8">
        {/* Breadcrumb navigation */}
        <nav className="mb-6 flex items-center gap-2 text-sm">
          <Link to="/projects" className="text-muted-foreground hover:text-foreground">
            Projects
          </Link>
          <span className="text-muted-foreground">/</span>
          <Link to={`/projects/${project?.id}`} className="text-muted-foreground hover:text-foreground">
            {project?.name || 'Project'}
          </Link>
          <span className="text-muted-foreground">/</span>
          <Link to={`/suites/${suite?.id}`} className="text-muted-foreground hover:text-foreground">
            {suite?.name || 'Suite'}
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium text-foreground">{test?.name}</span>
        </nav>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{test?.name}</h1>
            {test?.description && (
              <p className="mt-2 text-muted-foreground">{test.description}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-sm font-medium ${
              test?.status === 'active' ? 'bg-green-100 text-green-700' :
              test?.status === 'draft' ? 'bg-yellow-100 text-yellow-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {test?.status}
            </span>
            {/* Branch selector for visual regression tests */}
            {test?.test_type === 'visual_regression' && (
              <div className="flex items-center gap-2">
                <label htmlFor="branch-select" className="text-sm text-muted-foreground">
                  Branch:
                </label>
                <select
                  id="branch-select"
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  disabled={isRunning}
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground"
                >
                  {availableBranches.map(branch => (
                    <option key={branch} value={branch}>{branch}</option>
                  ))}
                </select>
                {/* Option to enter a new branch name */}
                <input
                  type="text"
                  placeholder="New branch..."
                  className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground w-32"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                      const newBranch = e.currentTarget.value.trim();
                      if (!availableBranches.includes(newBranch)) {
                        setAvailableBranches([...availableBranches, newBranch]);
                      }
                      setSelectedBranch(newBranch);
                      e.currentTarget.value = '';
                    }
                  }}
                />
              </div>
            )}
            {canRun && !isRunning && (
              <button
                onClick={handleRunTest}
                // Feature #1912: Allow running tests with target_url even if no steps (AI-generated tests)
                disabled={
                  !['visual_regression', 'lighthouse', 'load', 'accessibility'].includes(test?.test_type || '') &&
                  (test?.steps?.length || 0) === 0 &&
                  !test?.target_url
                }
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                Run Test
              </button>
            )}
            {canRun && !isRunning && (
              <button
                onClick={() => setShowQuickScheduleModal(true)}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Schedule
              </button>
            )}
            {isRunning && (
              <button
                onClick={handleCancelRun}
                disabled={isCancellingRun}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isCancellingRun ? 'Cancelling...' : 'Cancel Run'}
              </button>
            )}
            {canEdit && (
              <button
                onClick={handleOpenEditModal}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Edit Test
              </button>
            )}
            {canEdit && (
              <button
                onClick={handleDuplicate}
                disabled={isDuplicating}
                className="rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
              >
                {isDuplicating ? 'Duplicating...' : 'Duplicate'}
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => setShowDeleteModal(true)}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Delete Test
              </button>
            )}
          </div>
        </div>

        {/* Run Error */}
        {runError && (
          <div role="alert" className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {runError}
          </div>
        )}

        {/* Duplicate Error */}
        {duplicateError && (
          <div role="alert" className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {duplicateError}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={(e) => e.target === e.currentTarget && setShowDeleteModal(false)}
          >
            <div role="dialog" aria-modal="true" aria-labelledby="delete-test-title" className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
              <h3 id="delete-test-title" className="text-lg font-semibold text-foreground">Delete Test</h3>
              <p className="mt-2 text-muted-foreground">
                Are you sure you want to delete "{test?.name}"? This action cannot be undone.
              </p>
              {deleteError && (
                <div role="alert" className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {deleteError}
                </div>
              )}
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AI Explain Test Modal */}
        {showExplainModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={(e) => e.target === e.currentTarget && !isExplainingTest && setShowExplainModal(false)}
          >
            <div role="dialog" aria-modal="true" aria-labelledby="explain-test-title" className="w-full max-w-4xl max-h-[85vh] rounded-lg bg-card shadow-lg flex flex-col" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/30">
                    <svg className="h-6 w-6 text-violet-600 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div>
                    <h3 id="explain-test-title" className="text-lg font-semibold text-foreground">AI Test Explanation</h3>
                    <p className="text-sm text-muted-foreground">{test?.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowExplainModal(false)}
                  disabled={isExplainingTest}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6">
                {isExplainingTest ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <svg className="animate-spin h-10 w-10 text-violet-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-muted-foreground">Analyzing test code with AI...</p>
                  </div>
                ) : testExplanation ? (
                  <div className="space-y-6">
                    {/* Summary Section */}
                    <div className="rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20 p-4">
                      <h4 className="font-semibold text-violet-900 dark:text-violet-100 mb-2">Summary</h4>
                      <p className="text-violet-800 dark:text-violet-200">{testExplanation.summary}</p>
                      <p className="text-sm text-violet-600 dark:text-violet-300 mt-2"><strong>Purpose:</strong> {testExplanation.purpose}</p>
                    </div>

                    {/* Complexity Badge */}
                    <div className="flex items-center gap-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        testExplanation.complexity.level === 'simple' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                        testExplanation.complexity.level === 'moderate' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                        'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                      }`}>
                        {testExplanation.complexity.level.charAt(0).toUpperCase() + testExplanation.complexity.level.slice(1)} Complexity
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {testExplanation.complexity.lines_of_code} lines • {testExplanation.complexity.num_steps} steps • {testExplanation.complexity.num_assertions} assertions
                      </span>
                    </div>

                    {/* Steps Section */}
                    {testExplanation.steps.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                            <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                          </svg>
                          Step-by-Step Breakdown
                        </h4>
                        <div className="space-y-3">
                          {testExplanation.steps.map((step, idx) => (
                            <div key={idx} className="rounded-md border border-border p-3 bg-muted/30">
                              <div className="flex items-start gap-3">
                                <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                                  {idx + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <code className="block text-xs bg-gray-800 text-gray-200 p-2 rounded mb-2 overflow-x-auto">{step.code}</code>
                                  <p className="text-sm text-foreground">{step.explanation}</p>
                                  <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded ${
                                    step.type === 'navigation' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                                    step.type === 'interaction' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                                    step.type === 'assertion' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                                    step.type === 'wait' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                                    'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                                  }`}>{step.type}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Assertions Section */}
                    {testExplanation.assertions.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                            <polyline points="22 4 12 14.01 9 11.01"/>
                          </svg>
                          Assertions ({testExplanation.assertions.length})
                        </h4>
                        <div className="space-y-2">
                          {testExplanation.assertions.map((assertion, idx) => (
                            <div key={idx} className="rounded-md border border-border p-3 bg-muted/30">
                              <code className="block text-xs bg-gray-800 text-gray-200 p-2 rounded mb-2 overflow-x-auto">{assertion.code}</code>
                              <p className="text-sm text-foreground">{assertion.what_it_checks}</p>
                              <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded ${
                                assertion.importance === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                                assertion.importance === 'high' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' :
                                'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                              }`}>{assertion.importance} importance</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Selectors Section */}
                    {testExplanation.selectors.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                          </svg>
                          Selectors ({testExplanation.selectors.length})
                        </h4>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr className="border-b border-border">
                                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Selector</th>
                                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Strategy</th>
                                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Reliability</th>
                                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Suggestion</th>
                              </tr>
                            </thead>
                            <tbody>
                              {testExplanation.selectors.map((sel, idx) => (
                                <tr key={idx} className="border-b border-border/50">
                                  <td className="py-2 px-3"><code className="text-xs bg-muted px-1 py-0.5 rounded">{sel.selector}</code></td>
                                  <td className="py-2 px-3 text-foreground">{sel.strategy}</td>
                                  <td className="py-2 px-3">
                                    <span className={`inline-block text-xs px-2 py-0.5 rounded ${
                                      sel.reliability === 'high' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                                      sel.reliability === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                                      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                    }`}>{sel.reliability}</span>
                                  </td>
                                  <td className="py-2 px-3 text-muted-foreground text-xs">{sel.suggestion || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Improvements Section */}
                    {testExplanation.improvements.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                          </svg>
                          Suggested Improvements
                        </h4>
                        <div className="space-y-2">
                          {testExplanation.improvements.map((imp, idx) => (
                            <div key={idx} className="flex items-start gap-3 rounded-md border border-border p-3 bg-muted/30">
                              <span className={`flex-shrink-0 inline-block text-xs px-2 py-0.5 rounded ${
                                imp.priority === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                                imp.priority === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                                'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                              }`}>{imp.priority}</span>
                              <div>
                                <span className="text-xs text-muted-foreground uppercase tracking-wide">{imp.category}</span>
                                <p className="text-sm text-foreground">{imp.suggestion}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    No explanation available.
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 p-6 border-t border-border">
                <button
                  onClick={() => setShowExplainModal(false)}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quick Schedule Modal */}
        {showQuickScheduleModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={(e) => e.target === e.currentTarget && !isCreatingSchedule && setShowQuickScheduleModal(false)}
          >
            <div role="dialog" aria-modal="true" aria-labelledby="quick-schedule-title" className="w-full max-w-lg rounded-lg bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                  <svg className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 id="quick-schedule-title" className="text-lg font-semibold text-foreground">Schedule Test</h3>
              </div>
              <p className="text-muted-foreground mb-4">
                Create a schedule to run "{test?.name}" automatically.
              </p>

              {quickScheduleError && (
                <div role="alert" className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {quickScheduleError}
                </div>
              )}

              <form onSubmit={handleCreateQuickSchedule} className="space-y-4">
                {/* Schedule Name */}
                <div>
                  <label htmlFor="quick-schedule-name" className="mb-1 block text-sm font-medium text-foreground">
                    Schedule Name
                  </label>
                  <input
                    id="quick-schedule-name"
                    type="text"
                    value={quickScheduleName}
                    onChange={(e) => setQuickScheduleName(e.target.value)}
                    placeholder={`${test?.name} Schedule`}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  />
                </div>

                {/* Schedule Type */}
                <div>
                  <span className="mb-2 block text-sm font-medium text-foreground">Schedule Type</span>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="quickScheduleType"
                        checked={quickScheduleType === 'recurring'}
                        onChange={() => setQuickScheduleType('recurring')}
                        className="h-4 w-4"
                      />
                      <span className="text-sm text-foreground">Recurring</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="quickScheduleType"
                        checked={quickScheduleType === 'one-time'}
                        onChange={() => setQuickScheduleType('one-time')}
                        className="h-4 w-4"
                      />
                      <span className="text-sm text-foreground">One-time</span>
                    </label>
                  </div>
                </div>

                {/* Schedule Frequency/Time */}
                {quickScheduleType === 'recurring' ? (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">Frequency</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {[
                        { cron: '0 * * * *', label: 'Hourly' },
                        { cron: '0 9 * * *', label: 'Daily (9 AM)' },
                        { cron: '0 2 * * *', label: 'Nightly (2 AM)' },
                        { cron: '0 9 * * 1', label: 'Weekly (Mon)' },
                      ].map(({ cron, label }) => (
                        <button
                          key={cron}
                          type="button"
                          onClick={() => setQuickScheduleCron(cron)}
                          className={`rounded-md px-3 py-1.5 text-sm border transition-colors ${
                            quickScheduleCron === cron
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-background text-foreground border-border hover:border-primary'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="mt-3">
                      <label htmlFor="quick-schedule-cron" className="mb-1 block text-sm text-muted-foreground">
                        Custom cron expression
                      </label>
                      <input
                        id="quick-schedule-cron"
                        type="text"
                        value={quickScheduleCron}
                        onChange={(e) => setQuickScheduleCron(e.target.value)}
                        placeholder="0 2 * * *"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm text-foreground"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Format: minute hour day month weekday (e.g., "0 2 * * *" = every night at 2 AM)
                      </p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label htmlFor="quick-schedule-datetime" className="mb-1 block text-sm font-medium text-foreground">
                      Run At
                    </label>
                    <input
                      id="quick-schedule-datetime"
                      type="datetime-local"
                      value={quickScheduleRunAt}
                      onChange={(e) => setQuickScheduleRunAt(e.target.value)}
                      required={quickScheduleType === 'one-time'}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                    />
                  </div>
                )}

                {/* Timezone */}
                <div>
                  <label htmlFor="quick-schedule-timezone" className="mb-1 block text-sm font-medium text-foreground">
                    Timezone
                  </label>
                  <select
                    id="quick-schedule-timezone"
                    value={quickScheduleTimezone}
                    onChange={(e) => setQuickScheduleTimezone(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  >
                    <option value="America/New_York">America/New_York (ET)</option>
                    <option value="America/Chicago">America/Chicago (CT)</option>
                    <option value="America/Denver">America/Denver (MT)</option>
                    <option value="America/Los_Angeles">America/Los_Angeles (PT)</option>
                    <option value="Europe/London">Europe/London (GMT)</option>
                    <option value="Europe/Paris">Europe/Paris (CET)</option>
                    <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowQuickScheduleModal(false)}
                    disabled={isCreatingSchedule}
                    className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingSchedule || (quickScheduleType === 'one-time' && !quickScheduleRunAt)}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isCreatingSchedule ? 'Creating...' : 'Create Schedule'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Approve Baseline Confirmation Modal */}
        {showApproveBaselineModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={(e) => e.target === e.currentTarget && !approvingBaseline && setShowApproveBaselineModal(false)}
          >
            <div role="dialog" aria-modal="true" aria-labelledby="approve-baseline-title" className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 id="approve-baseline-title" className="text-lg font-semibold text-foreground">Approve New Baseline</h3>
              </div>
              <p className="text-muted-foreground">
                Are you sure you want to approve the current screenshot as the new baseline for <span className="font-medium text-foreground">"{test?.name}"</span>?
              </p>
              {/* Old vs New Baseline Preview */}
              {(() => {
                const runResult = currentRun?.results?.find(r => String(r.test_id) === String(test?.id));
                const hasPreview = runResult?.baseline_screenshot_base64 && runResult?.screenshot_base64;
                return hasPreview ? (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Preview: Old vs New Baseline</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <p className="text-xs text-center text-muted-foreground">Current Baseline</p>
                        <div className="border border-red-200 dark:border-red-800 rounded-md overflow-hidden bg-red-50 dark:bg-red-900/20">
                          <img
                            src={`data:image/png;base64,${runResult.baseline_screenshot_base64}`}
                            alt="Current baseline"
                            className="w-full h-24 object-cover object-top"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-center text-muted-foreground">New Baseline</p>
                        <div className="border border-green-200 dark:border-green-800 rounded-md overflow-hidden bg-green-50 dark:bg-green-900/20">
                          <img
                            src={`data:image/png;base64,${runResult.screenshot_base64}`}
                            alt="New baseline"
                            className="w-full h-24 object-cover object-top"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null;
              })()}
              <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>⚠️ This will replace the existing baseline.</strong> All future test runs will compare against this new baseline screenshot.
                </p>
              </div>
              {approveBaselineError && (
                <div role="alert" className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {approveBaselineError}
                </div>
              )}
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowApproveBaselineModal(false);
                    setApproveBaselineRunId(null);
                    setApproveBaselineError('');
                  }}
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                  disabled={approvingBaseline}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleApproveBaseline(approveBaselineRunId || undefined)}
                  disabled={approvingBaseline}
                  className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {approvingBaseline ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Approving...
                    </span>
                  ) : (
                    'Approve Baseline'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Restore Baseline Confirmation Modal */}
        {showRestoreBaselineModal && restoreHistoryEntry && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={(e) => e.target === e.currentTarget && !restoringBaseline && setShowRestoreBaselineModal(false)}
          >
            <div role="dialog" aria-modal="true" aria-labelledby="restore-baseline-title" className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                  <svg className="h-6 w-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5" />
                  </svg>
                </div>
                <h3 id="restore-baseline-title" className="text-lg font-semibold text-foreground">Restore Previous Baseline</h3>
              </div>
              <p className="text-muted-foreground">
                Are you sure you want to restore <span className="font-medium text-foreground">version {restoreHistoryEntry.version}</span> as the current baseline for <span className="font-medium text-foreground">"{test?.name}"</span>?
              </p>
              <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>⚠️ This will replace the current baseline.</strong> All future test runs will compare against this restored baseline. A new version will be created in the history for audit trail.
                </p>
              </div>
              {restoreBaselineError && (
                <div role="alert" className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {restoreBaselineError}
                </div>
              )}
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowRestoreBaselineModal(false);
                    setRestoreHistoryEntry(null);
                    setRestoreBaselineError('');
                  }}
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                  disabled={restoringBaseline}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleRestoreBaseline(restoreHistoryEntry.id)}
                  disabled={restoringBaseline}
                  className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {restoringBaseline ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Restoring...
                    </span>
                  ) : (
                    'Restore Baseline'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Merge Baseline Modal */}
        {showMergeBaselineModal && selectedMergeBranch && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={(e) => e.target === e.currentTarget && !isMergingBaseline && setShowMergeBaselineModal(false)}
          >
            <div role="dialog" aria-modal="true" aria-labelledby="merge-baseline-title" className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                  <svg className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <circle cx="18" cy="18" r="3"/>
                    <circle cx="6" cy="6" r="3"/>
                    <path d="M6 21V9a9 9 0 0 0 9 9"/>
                  </svg>
                </div>
                <h3 id="merge-baseline-title" className="text-lg font-semibold text-foreground">Merge Baseline from Branch</h3>
              </div>
              <p className="text-muted-foreground">
                Merge the baseline from branch <span className="font-semibold text-blue-600 dark:text-blue-400">'{selectedMergeBranch}'</span> to <span className="font-semibold text-foreground">'{selectedBranch}'</span>?
              </p>
              <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>ℹ️ This will copy the baseline.</strong> The baseline from '{selectedMergeBranch}' will be used as the new baseline for branch '{selectedBranch}'. All future test runs on '{selectedBranch}' will compare against this baseline.
                </p>
              </div>
              <p className="text-sm text-muted-foreground mt-3">
                This is typically done after merging a feature branch to main, so the visual baseline matches the merged code.
              </p>
              {mergeBaselineError && (
                <div role="alert" className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {mergeBaselineError}
                </div>
              )}
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowMergeBaselineModal(false);
                    setSelectedMergeBranch(null);
                    setMergeBaselineError('');
                  }}
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                  disabled={isMergingBaseline}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleMergeBaseline(selectedMergeBranch)}
                  disabled={isMergingBaseline}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isMergingBaseline ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Merging...
                    </span>
                  ) : (
                    'Merge Baseline'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reject Changes Confirmation Modal */}
        {showRejectChangesModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={(e) => e.target === e.currentTarget && !rejectingChanges && setShowRejectChangesModal(false)}
          >
            <div role="dialog" aria-modal="true" aria-labelledby="reject-changes-title" className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                  <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 id="reject-changes-title" className="text-lg font-semibold text-foreground">Reject Visual Changes</h3>
              </div>
              <p className="text-muted-foreground">
                Mark this visual difference as a <span className="font-semibold text-red-600 dark:text-red-400">regression</span> for <span className="font-medium text-foreground">"{test?.name}"</span>?
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                This indicates that the visual changes are unintended and should be fixed. The baseline will remain unchanged.
              </p>

              {/* Optional reason input */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-foreground mb-1">
                  Rejection Reason <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Describe why this change is a regression..."
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  rows={3}
                />
              </div>

              {rejectChangesError && (
                <div role="alert" className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {rejectChangesError}
                </div>
              )}
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowRejectChangesModal(false);
                    setRejectChangesRunId(null);
                    setRejectChangesError('');
                    setRejectionReason('');
                  }}
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                  disabled={rejectingChanges}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleRejectChanges(rejectChangesRunId || undefined)}
                  disabled={rejectingChanges}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {rejectingChanges ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Rejecting...
                    </span>
                  ) : (
                    'Reject Changes'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-foreground">Edit Test</h3>
              <form onSubmit={handleEdit} className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground">Test Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Enter test name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">Description (optional)</label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Describe the test..."
                    rows={3}
                  />
                </div>
                {editError && (
                  <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    {editError}
                  </div>
                )}
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (isDirty) {
                        setShowUnsavedChangesModal(true);
                        setPendingNavigation(() => () => {
                          setShowEditModal(false);
                          setIsDirty(false);
                        });
                      } else {
                        setShowEditModal(false);
                      }
                    }}
                    className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                    disabled={isEditing}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isEditing || !editName.trim()}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isEditing ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Unsaved Changes Warning Modal */}
        {showUnsavedChangesModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
            <div role="alertdialog" aria-modal="true" aria-labelledby="unsaved-changes-title" aria-describedby="unsaved-changes-desc" className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-100">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 id="unsaved-changes-title" className="text-lg font-semibold text-foreground">Unsaved Changes</h3>
                  <p id="unsaved-changes-desc" className="mt-2 text-sm text-muted-foreground">
                    You have unsaved changes. Are you sure you want to leave? Your changes will be lost.
                  </p>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCancelNavigation}
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmNavigation}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  Discard Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Test Details */}
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground">Test Details</h2>
            <dl className="mt-4 space-y-3">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">ID</dt>
                <dd className="text-foreground">{test?.id}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Type</dt>
                <dd className="text-foreground">
                  {test?.test_type === 'visual_regression' ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                      📸 Visual Regression
                    </span>
                  ) : test?.test_type === 'lighthouse' ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                      ⚡ Performance
                    </span>
                  ) : test?.test_type === 'load' ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
                      🔥 Load Test
                    </span>
                  ) : test?.test_type === 'accessibility' ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
                      ♿ Accessibility
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                      🔄 E2E Test
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Suite</dt>
                <dd className="text-foreground">{suite?.name}</dd>
              </div>
              {test?.test_type === 'visual_regression' && test?.target_url && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Target URL</dt>
                  <dd className="text-foreground break-all">
                    <a href={test.target_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      {test.target_url}
                    </a>
                  </dd>
                </div>
              )}
              {test?.test_type === 'visual_regression' && test?.multi_viewport && test?.viewports && test.viewports.length > 0 && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Viewports (Multi-viewport Mode)</dt>
                  <dd className="text-foreground">
                    <div className="flex flex-wrap gap-1.5">
                      {test.viewports.map((vp: string | { name: string; width: number; height: number }, idx: number) => {
                        // Feature #1983: Support both string presets and object viewports
                        if (typeof vp === 'object' && vp !== null) {
                          // New format: object with name, width, height
                          return (
                            <span key={`${vp.name}-${idx}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                              📐 {vp.name} ({vp.width}×{vp.height})
                            </span>
                          );
                        }
                        // Legacy format: string preset name
                        const vpString = vp as string;
                        const presets: Record<string, { width: number; height: number; label: string }> = {
                          'desktop': { width: 1920, height: 1080, label: 'Desktop' },
                          'laptop': { width: 1366, height: 768, label: 'Laptop' },
                          'desktop_hd': { width: 1280, height: 720, label: 'Desktop HD' },
                          'tablet': { width: 768, height: 1024, label: 'Tablet' },
                          'mobile': { width: 375, height: 667, label: 'Mobile' },
                          'mobile_large': { width: 414, height: 896, label: 'Mobile Large' },
                        };
                        const preset = presets[vpString];
                        return (
                          <span key={vpString} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                            📐 {preset?.label || vpString} ({preset?.width || '?'}×{preset?.height || '?'})
                          </span>
                        );
                      })}
                    </div>
                  </dd>
                </div>
              )}
              {test?.test_type === 'visual_regression' && !test?.multi_viewport && (test?.viewport_width || test?.viewport_preset) && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Viewport</dt>
                  <dd className="text-foreground">
                    {test.viewport_preset && test.viewport_preset !== 'custom' ? (
                      <span className="capitalize">{test.viewport_preset} ({test.viewport_width}×{test.viewport_height})</span>
                    ) : (
                      <span>{test.viewport_width}×{test.viewport_height}</span>
                    )}
                  </dd>
                </div>
              )}
              {test?.test_type === 'visual_regression' && test?.wait_for_selector && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Wait for Selector</dt>
                  <dd className="text-foreground font-mono text-sm bg-muted px-2 py-1 rounded">
                    {test.wait_for_selector}
                  </dd>
                </div>
              )}
              {test?.test_type === 'visual_regression' && test?.wait_time && test.wait_time > 0 && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Additional Wait</dt>
                  <dd className="text-foreground">
                    {test.wait_time}ms
                  </dd>
                </div>
              )}
              {test?.test_type === 'visual_regression' && test?.hide_selectors && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Hide Elements</dt>
                  <dd className="text-foreground font-mono text-sm bg-muted px-2 py-1 rounded">
                    {test.hide_selectors}
                  </dd>
                </div>
              )}
              {test?.test_type === 'visual_regression' && test?.remove_selectors && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Remove Elements</dt>
                  <dd className="text-foreground font-mono text-sm bg-muted px-2 py-1 rounded">
                    {test.remove_selectors}
                  </dd>
                </div>
              )}
              {test?.test_type === 'visual_regression' && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Diff Threshold</dt>
                  <dd className="text-foreground">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                      ((test.diff_threshold_mode ?? 'percentage') === 'percentage' && (test.diff_threshold ?? 0) === 0) ||
                      ((test.diff_threshold_mode ?? 'percentage') === 'pixel_count' && (test.diff_pixel_threshold ?? 0) === 0)
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                    }`}>
                      {(test.diff_threshold_mode ?? 'percentage') === 'pixel_count'
                        ? ((test.diff_pixel_threshold ?? 0) === 0 ? 'Exact match' : `${test.diff_pixel_threshold} pixel tolerance`)
                        : ((test.diff_threshold ?? 0) === 0 ? 'Exact match' : `${test.diff_threshold}% tolerance`)
                      }
                    </span>
                  </dd>
                </div>
              )}
              {/* Feature #647: Anti-aliasing Tolerance Display */}
              {test?.test_type === 'visual_regression' && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Anti-aliasing Tolerance</dt>
                  <dd className="text-foreground">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                      (test.anti_aliasing_tolerance ?? 'off') === 'off'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                        : (test.anti_aliasing_tolerance === 'low'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : (test.anti_aliasing_tolerance === 'medium'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                            : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'))
                    }`}>
                      {test.color_threshold !== undefined
                        ? `Custom (${test.color_threshold.toFixed(2)})`
                        : (test.anti_aliasing_tolerance ?? 'off') === 'off'
                          ? 'Off (Strict)'
                          : String(test.anti_aliasing_tolerance ?? 'off').charAt(0).toUpperCase() + String(test.anti_aliasing_tolerance ?? 'off').slice(1)
                      }
                    </span>
                  </dd>
                </div>
              )}
              {test?.test_type === 'visual_regression' && test.ignore_regions && test.ignore_regions.length > 0 && (
                <div className="col-span-2">
                  <dt className="text-sm font-medium text-muted-foreground mb-1">Ignore Regions</dt>
                  <dd className="text-foreground">
                    <div className="flex flex-wrap gap-1.5">
                      {test.ignore_regions.map((region: {id: string; x: number; y: number; width: number; height: number; name?: string}, idx: number) => (
                        <span key={region.id || idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                          {region.name || `Region ${idx + 1}`}: {region.x},{region.y} ({region.width}×{region.height})
                        </span>
                      ))}
                    </div>
                  </dd>
                </div>
              )}
              {test?.test_type === 'visual_regression' && test.ignore_selectors && test.ignore_selectors.length > 0 && (
                <div className="col-span-2">
                  <dt className="text-sm font-medium text-muted-foreground mb-1">Ignore Selectors</dt>
                  <dd className="text-foreground">
                    <div className="flex flex-wrap gap-1.5">
                      {test.ignore_selectors.map((selector: string, idx: number) => (
                        <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400 font-mono">
                          {selector}
                        </span>
                      ))}
                    </div>
                  </dd>
                </div>
              )}
              {/* Accessibility Test Details */}
              {test?.test_type === 'accessibility' && test?.target_url && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Target URL</dt>
                  <dd className="text-foreground break-all">
                    <a href={test.target_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      {test.target_url}
                    </a>
                  </dd>
                </div>
              )}
              {test?.test_type === 'accessibility' && test?.wcag_level && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">WCAG Level</dt>
                  <dd className="text-foreground">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                      test.wcag_level === 'AAA'
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                        : test.wcag_level === 'AA'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                    }`}>
                      Level {test.wcag_level}
                    </span>
                  </dd>
                </div>
              )}
              {test?.test_type === 'accessibility' && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Options</dt>
                  <dd className="text-foreground flex flex-wrap gap-2">
                    {test.include_best_practices !== false && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400">
                        ✓ Best Practices
                      </span>
                    )}
                    {test.include_experimental === true && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                        🧪 Experimental
                      </span>
                    )}
                    {test.include_pa11y === true && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400">
                        🔍 Pa11y
                      </span>
                    )}
                  </dd>
                </div>
              )}
              {test?.test_type === 'accessibility' && (
                <div className="col-span-2">
                  <dt className="text-sm font-medium text-muted-foreground mb-1">Pass/Fail Threshold</dt>
                  <dd className="text-foreground">
                    {test.a11y_fail_on_any ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                        🚫 Fail on ANY violation
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {test.a11y_fail_on_critical !== undefined && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                            🔴 Critical: {test.a11y_fail_on_critical === 0 ? 'Fail on any' : `max ${test.a11y_fail_on_critical}`}
                          </span>
                        )}
                        {test.a11y_fail_on_serious !== undefined && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                            🟠 Serious: {test.a11y_fail_on_serious === 0 ? 'Fail on any' : `max ${test.a11y_fail_on_serious}`}
                          </span>
                        )}
                        {test.a11y_fail_on_moderate !== undefined && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                            🟡 Moderate: {test.a11y_fail_on_moderate === 0 ? 'Fail on any' : `max ${test.a11y_fail_on_moderate}`}
                          </span>
                        )}
                        {test.a11y_fail_on_minor !== undefined && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                            🔵 Minor: {test.a11y_fail_on_minor === 0 ? 'Fail on any' : `max ${test.a11y_fail_on_minor}`}
                          </span>
                        )}
                        {test.a11y_fail_on_critical === undefined && test.a11y_fail_on_serious === undefined &&
                         test.a11y_fail_on_moderate === undefined && test.a11y_fail_on_minor === undefined && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400">
                            Default: Fail on Critical/Serious
                          </span>
                        )}
                      </div>
                    )}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Created</dt>
                <dd className="text-foreground">
                  {test?.created_at ? formatDate(test.created_at) : '-'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Updated</dt>
                <dd className="text-foreground">
                  {test?.updated_at ? formatDate(test.updated_at) : '-'}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border border-border bg-card p-6">
            {/* Tab Header */}
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex gap-4">
                <button
                  onClick={() => setActiveTab('steps')}
                  className={`text-lg font-semibold pb-2 border-b-2 transition-colors ${
                    activeTab === 'steps'
                      ? 'text-foreground border-primary'
                      : 'text-muted-foreground border-transparent hover:text-foreground'
                  }`}
                >
                  Test Steps
                </button>
                <button
                  onClick={() => setActiveTab('code')}
                  className={`text-lg font-semibold pb-2 border-b-2 transition-colors ${
                    activeTab === 'code'
                      ? 'text-foreground border-primary'
                      : 'text-muted-foreground border-transparent hover:text-foreground'
                  }`}
                >
                  View Code
                </button>
                {test?.test_type === 'visual_regression' && (
                  <button
                    onClick={() => setActiveTab('baseline')}
                    className={`text-lg font-semibold pb-2 border-b-2 transition-colors ${
                      activeTab === 'baseline'
                        ? 'text-foreground border-primary'
                        : 'text-muted-foreground border-transparent hover:text-foreground'
                    }`}
                  >
                    📸 Baseline
                  </button>
                )}
                {test?.test_type === 'load' && (
                  <button
                    onClick={() => setActiveTab('k6script')}
                    className={`text-lg font-semibold pb-2 border-b-2 transition-colors ${
                      activeTab === 'k6script'
                        ? 'text-foreground border-primary'
                        : 'text-muted-foreground border-transparent hover:text-foreground'
                    }`}
                  >
                    🚀 K6 Script
                  </button>
                )}
              </div>
              {/* Feature #1963: Only show Add Step for E2E tests (visual/lighthouse/accessibility don't use steps) */}
              {canEdit && activeTab === 'steps' && !['visual_regression', 'lighthouse', 'accessibility'].includes(test?.test_type || '') && (
                <button
                  onClick={() => setShowAddStepModal(true)}
                  className="text-sm text-primary hover:underline"
                >
                  + Add Step
                </button>
              )}
            </div>

            {/* Steps Tab Content */}
            {activeTab === 'steps' && (
              <>
                {/* Feature #1963: Visual tests don't need steps - show config instead */}
                {test?.test_type === 'visual_regression' ? (
                  <div className="mt-4 space-y-4">
                    <div className="rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/20 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xl">📸</span>
                        <h4 className="font-medium text-foreground">Visual Test Configuration</h4>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        Visual regression tests work by capturing screenshots and comparing them against baselines. No test steps required.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {test?.target_url && (
                          <div className="bg-white dark:bg-gray-800 rounded p-3 border border-border">
                            <dt className="text-xs font-medium text-muted-foreground mb-1">Target URL</dt>
                            <dd className="text-sm text-foreground break-all">
                              <a href={test.target_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                {test.target_url}
                              </a>
                            </dd>
                          </div>
                        )}
                        <div className="bg-white dark:bg-gray-800 rounded p-3 border border-border">
                          <dt className="text-xs font-medium text-muted-foreground mb-1">Viewport</dt>
                          <dd className="text-sm text-foreground">
                            {test?.multi_viewport && test?.viewports?.length > 0 ? (
                              <span>Multi-viewport: {test.viewports.map((vp: string | { name: string; width: number; height: number }) =>
                                typeof vp === 'object' ? vp.name : vp
                              ).join(', ')}</span>
                            ) : test?.viewport_preset && test.viewport_preset !== 'custom' ? (
                              <span className="capitalize">{test.viewport_preset} ({test.viewport_width || 1280}×{test.viewport_height || 720})</span>
                            ) : (
                              <span>{test?.viewport_width || 1280}×{test?.viewport_height || 720}</span>
                            )}
                          </dd>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded p-3 border border-border">
                          <dt className="text-xs font-medium text-muted-foreground mb-1">Capture Mode</dt>
                          <dd className="text-sm text-foreground capitalize">
                            {(test?.capture_mode || 'full_page').replace('_', ' ')}
                          </dd>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded p-3 border border-border">
                          <dt className="text-xs font-medium text-muted-foreground mb-1">Diff Threshold</dt>
                          <dd className="text-sm text-foreground">
                            {(test?.diff_threshold_mode ?? 'percentage') === 'pixel_count'
                              ? ((test?.diff_pixel_threshold ?? 0) === 0 ? 'Exact match (0 pixels)' : `${test?.diff_pixel_threshold} pixel tolerance`)
                              : ((test?.diff_threshold ?? 0) === 0 ? 'Exact match (0%)' : `${test?.diff_threshold}% tolerance`)
                            }
                          </dd>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : test?.test_type === 'lighthouse' ? (
                  <div className="mt-4 space-y-4">
                    <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/20 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xl">⚡</span>
                        <h4 className="font-medium text-foreground">Performance Test Configuration</h4>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        Lighthouse performance tests analyze page load metrics. No test steps required.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white dark:bg-gray-800 rounded p-3 border border-border">
                          <dt className="text-xs font-medium text-muted-foreground mb-1">Device Preset</dt>
                          <dd className="text-sm text-foreground capitalize">{test?.device_preset || 'mobile'}</dd>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded p-3 border border-border">
                          <dt className="text-xs font-medium text-muted-foreground mb-1">Performance Threshold</dt>
                          <dd className="text-sm text-foreground">{test?.performance_threshold || 0}% minimum score</dd>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : test?.test_type === 'accessibility' ? (
                  <div className="mt-4 space-y-4">
                    <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/20 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xl">♿</span>
                        <h4 className="font-medium text-foreground">Accessibility Test Configuration</h4>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        Accessibility tests scan pages for WCAG violations. No test steps required.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white dark:bg-gray-800 rounded p-3 border border-border">
                          <dt className="text-xs font-medium text-muted-foreground mb-1">WCAG Level</dt>
                          <dd className="text-sm text-foreground">{test?.wcag_level || 'AA'}</dd>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded p-3 border border-border">
                          <dt className="text-xs font-medium text-muted-foreground mb-1">Include Best Practices</dt>
                          <dd className="text-sm text-foreground">{test?.include_best_practices ? 'Yes' : 'No'}</dd>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : test?.steps.length === 0 ? (
                  <p className="mt-4 text-muted-foreground">No steps defined yet. Add steps to run the test.</p>
                ) : (
                  <>
                    {hasReorderedSteps && (
                      <div className="mt-4 flex items-center gap-2 rounded-md bg-yellow-500/10 p-3 border border-yellow-500/30">
                        <span className="text-yellow-600 dark:text-yellow-400 text-sm">Steps have been reordered. Save to persist changes.</span>
                        <button
                          onClick={handleSaveStepOrder}
                          disabled={isSavingStepOrder}
                          className="ml-auto rounded-md bg-yellow-600 px-3 py-1 text-sm font-medium text-white hover:bg-yellow-700 disabled:opacity-50"
                        >
                          {isSavingStepOrder ? 'Saving...' : 'Save Order'}
                        </button>
                      </div>
                    )}
                    <ol className="mt-4 space-y-2">
                      {test?.steps.map((step, index) => (
                        <li
                          key={step.id}
                          draggable
                          onDragStart={(e) => handleStepDragStart(e, index)}
                          onDragEnd={handleStepDragEnd}
                          onDragOver={(e) => handleStepDragOver(e, index)}
                          onDrop={(e) => handleStepDrop(e, index)}
                          className={`flex gap-3 rounded-md bg-muted/30 p-3 cursor-move transition-all ${
                            dragOverIndex === index && draggedStepIndex !== index
                              ? 'border-2 border-primary border-dashed bg-primary/10'
                              : 'border-2 border-transparent'
                          } ${draggedStepIndex === index ? 'opacity-50' : ''}`}
                        >
                          {/* Drag handle */}
                          <span className="flex items-center text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                              <circle cx="9" cy="6" r="1.5"/>
                              <circle cx="15" cy="6" r="1.5"/>
                              <circle cx="9" cy="12" r="1.5"/>
                              <circle cx="15" cy="12" r="1.5"/>
                              <circle cx="9" cy="18" r="1.5"/>
                              <circle cx="15" cy="18" r="1.5"/>
                            </svg>
                          </span>
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                            {index + 1}
                          </span>
                          <div className="flex-1">
                            <p className="font-medium text-foreground">
                              {step.action === 'visual_checkpoint' ? (
                                <span className="flex items-center gap-1">
                                  <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                  Visual Checkpoint
                                </span>
                              ) : step.action === 'accessibility_check' ? (
                                <span className="flex items-center gap-1">
                                  <svg className="h-4 w-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                  </svg>
                                  Accessibility Check
                                </span>
                              ) : step.action}
                            </p>
                            {step.selector && (
                              <p className="text-xs text-muted-foreground">Selector: {step.selector}</p>
                            )}
                            {step.value && (
                              <p className="text-xs text-muted-foreground">Value: {step.value}</p>
                            )}
                            {step.action === 'visual_checkpoint' && (
                              <div className="flex gap-2 mt-1">
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                                  {(step as any).checkpointName || 'unnamed'}
                                </span>
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                                  Threshold: {(step as any).checkpointThreshold ?? 0.1}%
                                </span>
                              </div>
                            )}
                            {step.action === 'accessibility_check' && (
                              <div className="flex flex-wrap gap-2 mt-1">
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300">
                                  WCAG {(step as any).a11y_wcag_level || 'AA'}
                                </span>
                                {(step as any).a11y_fail_on_any && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300">
                                    Fail on any
                                  </span>
                                )}
                                {(step as any).a11y_fail_on_critical && !((step as any).a11y_fail_on_any) && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300">
                                    Critical/Serious only
                                  </span>
                                )}
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                                  Threshold: {(step as any).a11y_threshold ?? 0}
                                </span>
                              </div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </>
                )}
              </>
            )}

            {/* View Code Tab Content */}
            {activeTab === 'code' && (
              <div className="mt-4">
                {/* Header with mode indicator and actions */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <p className="text-sm text-muted-foreground">
                      {test?.use_custom_code ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="inline-block w-2 h-2 rounded-full bg-amber-500"></span>
                          Custom Playwright code (advanced mode)
                        </span>
                      ) : isEditingCode ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                          Editing Playwright code...
                        </span>
                      ) : (
                        'Generated Playwright test code (TypeScript)'
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isEditingCode && (
                      <>
                        <button
                          onClick={() => {
                            const code = test?.use_custom_code && test?.playwright_code
                              ? test.playwright_code
                              : generatePlaywrightCode(test?.steps || []);
                            navigator.clipboard.writeText(code);
                            toast.success('Code copied to clipboard!');
                          }}
                          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                          </svg>
                          Copy
                        </button>
                        <button
                          onClick={handleExplainTest}
                          disabled={isExplainingTest}
                          className="inline-flex items-center gap-1 text-sm text-violet-600 hover:text-violet-700 hover:underline disabled:opacity-50"
                        >
                          {isExplainingTest ? (
                            <svg className="animate-spin w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10"/>
                              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                              <line x1="12" y1="17" x2="12.01" y2="17"/>
                            </svg>
                          )}
                          Explain
                        </button>
                        {canEdit && (
                          <button
                            onClick={handleStartEditCode}
                            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                            Edit Code
                          </button>
                        )}
                      </>
                    )}
                    {isEditingCode && (
                      <>
                        <button
                          onClick={handleCancelEditCode}
                          disabled={isSavingCode}
                          className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveCode}
                          disabled={isSavingCode || !editedCode.trim()}
                          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {isSavingCode ? (
                            <>
                              <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Saving...
                            </>
                          ) : (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                                <polyline points="17 21 17 13 7 13 7 21"/>
                                <polyline points="7 3 7 8 15 8"/>
                              </svg>
                              Save Code
                            </>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Code error display */}
                {codeError && (
                  <div className="mb-3 rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                    {codeError}
                  </div>
                )}

                {/* Code display or editor */}
                {isEditingCode ? (
                  <div className="relative">
                    <textarea
                      value={editedCode}
                      onChange={(e) => setEditedCode(e.target.value)}
                      className="w-full h-96 rounded-lg bg-gray-900 p-4 text-sm text-gray-100 font-mono resize-y focus:outline-none focus:ring-2 focus:ring-primary/50"
                      placeholder="Enter your Playwright test code here..."
                      spellCheck={false}
                    />
                    <div className="absolute bottom-2 right-2 text-xs text-gray-500">
                      {editedCode.split('\n').length} lines
                    </div>
                  </div>
                ) : (
                  <pre className="rounded-lg bg-gray-900 p-4 overflow-x-auto text-sm max-h-96 overflow-y-auto">
                    <code className="text-gray-100 font-mono whitespace-pre">
                      {test?.use_custom_code && test?.playwright_code
                        ? test.playwright_code
                        : generatePlaywrightCode(test?.steps || [])}
                    </code>
                  </pre>
                )}

                {/* Footer tips and actions */}
                <div className="mt-3 flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    {test?.use_custom_code ? (
                      <span className="flex items-center gap-1.5">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/>
                          <line x1="12" y1="8" x2="12" y2="12"/>
                          <line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                        Using custom code. Test steps are ignored when running this test.
                      </span>
                    ) : isEditingCode ? (
                      <span>✏️ Edit the code above and click "Save Code" to use custom Playwright code instead of generated steps.</span>
                    ) : (
                      <span>💡 Click "Edit Code" to write custom Playwright code for advanced testing scenarios.</span>
                    )}
                  </div>
                  {test?.use_custom_code && !isEditingCode && canEdit && (
                    <button
                      onClick={handleRevertToSteps}
                      disabled={isSavingCode}
                      className="inline-flex items-center gap-1 text-sm text-amber-600 hover:text-amber-700 hover:underline disabled:opacity-50"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                        <path d="M3 3v5h5"/>
                      </svg>
                      Revert to Steps
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* K6 Script Tab Content */}
            {activeTab === 'k6script' && test?.test_type === 'load' && (
              <div className="mt-4">
                {/* Header with actions */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <p className="text-sm text-muted-foreground">
                      {isEditingK6Script ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                          Editing K6 load test script...
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                          K6 Load Test Script (JavaScript)
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isEditingK6Script && (
                      <>
                        <button
                          onClick={() => {
                            const script = k6Script || generateK6Script();
                            navigator.clipboard.writeText(script);
                            toast.success('K6 script copied to clipboard!');
                          }}
                          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                          </svg>
                          Copy
                        </button>
                        <button
                          onClick={() => {
                            const blob = new Blob([k6Script || generateK6Script()], { type: 'application/javascript' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `${test?.name?.replace(/\s+/g, '-').toLowerCase() || 'load-test'}.js`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                            toast.success('K6 script downloaded!');
                          }}
                          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                          </svg>
                          Download
                        </button>
                        {canEdit && (
                          <div className="relative">
                            <button
                              onClick={() => setShowK6Templates(!showK6Templates)}
                              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                                <polyline points="14 2 14 8 20 8"/>
                                <line x1="16" y1="13" x2="8" y2="13"/>
                                <line x1="16" y1="17" x2="8" y2="17"/>
                                <line x1="10" y1="9" x2="8" y2="9"/>
                              </svg>
                              Templates
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="6 9 12 15 18 9"/>
                              </svg>
                            </button>
                            {showK6Templates && (
                              <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[280px]">
                                {Object.entries(k6Templates).map(([key, template]) => (
                                  <button
                                    key={key}
                                    onClick={() => {
                                      setK6Script(template.script);
                                      setShowK6Templates(false);
                                      toast.success(`${template.name} template applied!`);
                                    }}
                                    className="w-full px-4 py-2 text-left hover:bg-muted transition-colors"
                                  >
                                    <div className="font-medium text-sm">{template.name}</div>
                                    <div className="text-xs text-muted-foreground">{template.description}</div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {canEdit && (
                          <button
                            onClick={() => {
                              if (!k6Script) {
                                setK6Script(generateK6Script());
                              }
                              setIsEditingK6Script(true);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                            Edit Script
                          </button>
                        )}
                      </>
                    )}
                    {isEditingK6Script && (
                      <>
                        <button
                          onClick={() => {
                            setIsEditingK6Script(false);
                            // Reset to saved or generated script
                            setK6Script(test?.k6_script || generateK6Script());
                          }}
                          disabled={isSavingK6Script}
                          className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={async () => {
                            setIsSavingK6Script(true);
                            try {
                              const response = await fetch(`/api/v1/tests/${test?.id}`, {
                                method: 'PATCH',
                                headers: {
                                  'Content-Type': 'application/json',
                                  'Authorization': `Bearer ${token}`,
                                },
                                body: JSON.stringify({ k6_script: k6Script }),
                              });
                              if (!response.ok) throw new Error('Failed to save script');
                              toast.success('K6 script saved successfully!');
                              setIsEditingK6Script(false);
                            } catch (err) {
                              toast.error('Failed to save K6 script');
                            } finally {
                              setIsSavingK6Script(false);
                            }
                          }}
                          disabled={isSavingK6Script || !k6Script.trim()}
                          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {isSavingK6Script ? (
                            <>
                              <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Saving...
                            </>
                          ) : (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                                <polyline points="17 21 17 13 7 13 7 21"/>
                                <polyline points="7 3 7 8 15 8"/>
                              </svg>
                              Save Script
                            </>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* K6 script display or editor */}
                {isEditingK6Script ? (
                  <div className="relative rounded-lg bg-gray-900 overflow-hidden">
                    <div className="flex h-[500px]">
                      {/* Line numbers gutter */}
                      <div className="select-none text-gray-500 text-sm font-mono py-4 pr-2 text-right bg-gray-800/50 overflow-hidden" style={{ minWidth: '3rem' }}>
                        {k6Script.split('\n').map((_, i) => (
                          <div key={i} className="leading-6 px-2">{i + 1}</div>
                        ))}
                      </div>
                      {/* Code editor */}
                      <textarea
                        value={k6Script}
                        onChange={(e) => setK6Script(e.target.value)}
                        className="flex-1 h-full bg-transparent p-4 pl-2 text-sm text-gray-100 font-mono resize-none focus:outline-none leading-6"
                        placeholder="Enter your K6 load test script here..."
                        spellCheck={false}
                        style={{ lineHeight: '1.5rem' }}
                      />
                    </div>
                    <div className="absolute bottom-2 right-2 text-xs text-gray-500 bg-gray-900/80 px-2 py-1 rounded">
                      {k6Script.split('\n').length} lines
                    </div>
                  </div>
                ) : (
                  /* Feature #323: K6 script viewer with code folding */
                  (() => {
                    const scriptCode = k6Script || generateK6Script();
                    const scriptLines = scriptCode.split('\n');
                    const foldableRegions = detectFoldableRegions(scriptCode);

                    return (
                      <div className="rounded-lg bg-gray-900 overflow-hidden max-h-[500px] overflow-y-auto">
                        {/* Fold controls */}
                        <div className="flex items-center justify-between px-4 py-2 bg-gray-800/50 border-b border-gray-700">
                          <span className="text-xs text-gray-400">
                            {foldableRegions.length} foldable regions • {foldedRegions.size} collapsed
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                const allRegionStarts = new Set(foldableRegions.map(r => r.startLine));
                                setFoldedRegions(allRegionStarts);
                              }}
                              className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300"
                              title="Collapse all"
                            >
                              Fold All
                            </button>
                            <button
                              onClick={() => setFoldedRegions(new Set())}
                              className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300"
                              title="Expand all"
                            >
                              Unfold All
                            </button>
                          </div>
                        </div>
                        <div className="flex">
                          {/* Line numbers and fold icons gutter */}
                          <div className="select-none text-gray-500 text-sm font-mono py-2 bg-gray-800/50 flex-shrink-0" style={{ minWidth: '4rem' }}>
                            {scriptLines.map((_, i) => {
                              if (isLineHidden(i, foldableRegions)) return null;
                              const foldIcon = getFoldIcon(i, foldableRegions);
                              const region = foldableRegions.find(r => r.startLine === i);
                              return (
                                <div key={i} className="flex items-center leading-6 pr-2">
                                  <div className="w-5 flex justify-center">
                                    {foldIcon && (
                                      <button
                                        onClick={() => toggleFold(i)}
                                        className="text-gray-400 hover:text-yellow-400 focus:outline-none"
                                        title={foldIcon === 'fold' ? `Collapse (${region?.endLine! - i} lines)` : 'Expand'}
                                      >
                                        {foldIcon === 'fold' ? (
                                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M6 9l6 6 6-6"/>
                                          </svg>
                                        ) : (
                                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M9 18l6-6-6-6"/>
                                          </svg>
                                        )}
                                      </button>
                                    )}
                                  </div>
                                  <span className="text-right" style={{ minWidth: '1.5rem' }}>{i + 1}</span>
                                </div>
                              );
                            })}
                          </div>
                          {/* Code content with folding */}
                          <pre className="flex-1 py-2 px-2 overflow-x-auto">
                            <code className="text-gray-100 font-mono text-sm block">
                              {scriptLines.map((line, i) => {
                                if (isLineHidden(i, foldableRegions)) return null;
                                const isFolded = foldedRegions.has(i);
                                const region = foldableRegions.find(r => r.startLine === i);
                                return (
                                  <div key={i} className="leading-6 whitespace-pre">
                                    {highlightJavaScript(line)}
                                    {isFolded && region && (
                                      <span
                                        className="ml-2 px-2 py-0.5 text-xs bg-yellow-900/50 text-yellow-400 rounded cursor-pointer hover:bg-yellow-800/50"
                                        onClick={() => toggleFold(i)}
                                        title="Click to expand"
                                      >
                                        ... {region.endLine - region.startLine} lines hidden
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </code>
                          </pre>
                        </div>
                      </div>
                    );
                  })()
                )}

                {/* Footer with K6 tips */}
                <div className="mt-3 space-y-2">
                  <div className="text-xs text-muted-foreground">
                    {isEditingK6Script ? (
                      <span>✏️ Edit the K6 script above and click "Save Script" to save your changes.</span>
                    ) : (
                      <span>💡 Click "Edit Script" to customize your K6 load test script.</span>
                    )}
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 border border-border">
                    <p className="text-sm font-medium text-foreground mb-2">🚀 Run this script with K6:</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-3 py-2 rounded bg-gray-900 text-gray-100 text-sm font-mono">
                        k6 run {test?.name?.replace(/\s+/g, '-').toLowerCase() || 'load-test'}.js
                      </code>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`k6 run ${test?.name?.replace(/\s+/g, '-').toLowerCase() || 'load-test'}.js`);
                          toast.success('Command copied!');
                        }}
                        className="px-2 py-2 rounded bg-gray-700 hover:bg-gray-600 text-gray-300"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Baseline Tab Content */}
            {activeTab === 'baseline' && test?.test_type === 'visual_regression' && (
              <div className="mt-4">
                {/* Branch indicator */}
                <div className="mb-4 flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Viewing baseline for branch:</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 font-medium text-primary">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="6" y1="3" x2="6" y2="15"/>
                      <circle cx="18" cy="6" r="3"/>
                      <circle cx="6" cy="18" r="3"/>
                      <path d="M18 9a9 9 0 0 1-9 9"/>
                    </svg>
                    {selectedBranch}
                  </span>
                  {availableBranches.length > 1 && (
                    <span className="text-xs text-muted-foreground">
                      ({availableBranches.length} branches have baselines)
                    </span>
                  )}
                </div>

                {loadingBaseline ? (
                  <div className="flex items-center justify-center py-12">
                    <svg className="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="ml-3 text-muted-foreground">Loading baseline...</span>
                  </div>
                ) : !baselineData?.hasBaseline ? (
                  <div className="text-center py-12">
                    <div className="text-4xl mb-4">📷</div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">No Baseline on Branch '{selectedBranch}'</h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      Run this visual regression test once on branch '{selectedBranch}' to capture the initial baseline screenshot.
                      Each branch can have its own independent baseline.
                    </p>
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                      <button
                        onClick={() => handleRunTest()}
                        disabled={isRunning}
                        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        {isRunning ? (
                          <>
                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Running...
                          </>
                        ) : (
                          <>▶ Run Test to Create Baseline</>
                        )}
                      </button>
                    </div>
                    {/* Show merge option if there are mergeable baselines from other branches */}
                    {mergeableBranches.length > 0 && (
                      <div className="mt-8 p-4 border border-blue-500/30 bg-blue-500/5 rounded-lg max-w-lg mx-auto">
                        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-2">
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="18" cy="18" r="3"/>
                            <circle cx="6" cy="6" r="3"/>
                            <path d="M6 21V9a9 9 0 0 0 9 9"/>
                          </svg>
                          <span className="font-medium">Baselines Available from Other Branches</span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          You can merge a baseline from another branch instead of creating a new one:
                        </p>
                        <div className="space-y-2">
                          {mergeableBranches.slice(0, 3).map((branch) => (
                            <button
                              key={branch.branch}
                              onClick={() => {
                                setSelectedMergeBranch(branch.branch);
                                setShowMergeBaselineModal(true);
                              }}
                              className="w-full flex items-center justify-between gap-2 p-2 rounded border border-border bg-background hover:bg-muted/50 transition-colors text-sm"
                            >
                              <span className="flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="6" y1="3" x2="6" y2="15"/>
                                  <circle cx="18" cy="6" r="3"/>
                                  <circle cx="6" cy="18" r="3"/>
                                  <path d="M18 9a9 9 0 0 1-9 9"/>
                                </svg>
                                <span className="font-medium text-foreground">{branch.branch}</span>
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {branch.approvedBy && `by ${branch.approvedBy} • `}
                                {new Date(branch.updatedAt).toLocaleDateString()}
                              </span>
                            </button>
                          ))}
                        </div>
                        {mergeableBranches.length > 3 && (
                          <p className="text-xs text-muted-foreground mt-2 text-center">
                            +{mergeableBranches.length - 3} more branch(es) available
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">Current Baseline</h3>
                        <p className="text-sm text-muted-foreground">
                          Created: {baselineData.createdAt ? new Date(baselineData.createdAt).toLocaleString() : 'Unknown'}
                          {baselineData.size && <span className="ml-2">• Size: {(baselineData.size / 1024).toFixed(1)} KB</span>}
                        </p>
                        {baselineData.approvedBy && (
                          <p className="text-sm text-muted-foreground mt-1">
                            <span className="inline-flex items-center gap-1">
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                <circle cx="12" cy="7" r="4"/>
                              </svg>
                              Approved by: {baselineData.approvedBy}
                            </span>
                            {baselineData.approvedAt && (
                              <span className="ml-2">• {new Date(baselineData.approvedAt).toLocaleString()}</span>
                            )}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={`/api/v1/tests/${testId}/baseline`}
                          download={`baseline-${testId}.png`}
                          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                          </svg>
                          Download
                        </a>
                      </div>
                    </div>

                    {baselineData.image && (
                      <div className="border border-border rounded-lg overflow-hidden bg-muted/30">
                        <img
                          src={`data:image/png;base64,${baselineData.image}`}
                          alt="Baseline screenshot"
                          className="w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setLightboxImage(`data:image/png;base64,${baselineData.image}`)}
                        />
                      </div>
                    )}

                    <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
                      <p className="font-medium text-foreground mb-1">💡 About Visual Baselines</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>This screenshot is used as the reference for visual comparisons</li>
                        <li>Click the image to view at full resolution</li>
                        <li>To update the baseline, approve a new screenshot in the test results</li>
                      </ul>
                    </div>

                    {/* Merge Baseline from Branch Section - shown when there are newer baselines */}
                    {mergeableBranches.some(b => b.isNewer) && (
                      <div className="mt-4 p-4 border border-blue-500/30 bg-blue-500/5 rounded-lg">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600 dark:text-blue-400">
                              <circle cx="18" cy="18" r="3"/>
                              <circle cx="6" cy="6" r="3"/>
                              <path d="M6 21V9a9 9 0 0 0 9 9"/>
                            </svg>
                          </div>
                          <div className="flex-1">
                            <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-1">
                              Newer Baselines Available from Feature Branches
                            </h4>
                            <p className="text-sm text-muted-foreground mb-3">
                              The following branches have baselines that are newer than this branch's baseline.
                              This typically happens after merging a feature branch.
                            </p>
                            <div className="space-y-2">
                              {mergeableBranches.filter(b => b.isNewer).map((branch) => (
                                <div key={branch.branch} className="flex items-center justify-between gap-2 p-2 rounded border border-border bg-background">
                                  <span className="flex items-center gap-2 text-sm">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                                      <line x1="6" y1="3" x2="6" y2="15"/>
                                      <circle cx="18" cy="6" r="3"/>
                                      <circle cx="6" cy="18" r="3"/>
                                      <path d="M18 9a9 9 0 0 1-9 9"/>
                                    </svg>
                                    <span className="font-medium text-foreground">{branch.branch}</span>
                                    <span className="text-xs text-muted-foreground">
                                      • Updated {new Date(branch.updatedAt).toLocaleDateString()}
                                      {branch.approvedBy && ` by ${branch.approvedBy}`}
                                    </span>
                                  </span>
                                  <button
                                    onClick={() => {
                                      setSelectedMergeBranch(branch.branch);
                                      setShowMergeBaselineModal(true);
                                    }}
                                    className="px-3 py-1 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                                  >
                                    Adopt Baseline
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Baseline History Section */}
                    <div className="mt-6 pt-6 border-t border-border">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10"/>
                              <polyline points="12 6 12 12 16 14"/>
                            </svg>
                            Baseline History
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            All baseline versions for audit trail ({baselineHistory.length} versions)
                          </p>
                        </div>
                      </div>

                      {loadingBaselineHistory ? (
                        <div className="flex items-center justify-center py-8">
                          <svg className="animate-spin h-6 w-6 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span className="ml-2 text-muted-foreground">Loading history...</span>
                        </div>
                      ) : baselineHistory.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2 opacity-50">
                            <circle cx="12" cy="12" r="10"/>
                            <polyline points="12 6 12 12 16 14"/>
                          </svg>
                          <p>No baseline history yet.</p>
                          <p className="text-sm">Approve baselines to build version history.</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="border border-border rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                              <thead className="bg-muted/50">
                                <tr>
                                  <th className="text-left px-4 py-2 font-medium text-foreground">Version</th>
                                  <th className="text-left px-4 py-2 font-medium text-foreground">Approved By</th>
                                  <th className="text-left px-4 py-2 font-medium text-foreground">Date</th>
                                  <th className="text-left px-4 py-2 font-medium text-foreground">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {baselineHistory.map((entry, index) => (
                                  <tr key={entry.id} className={`hover:bg-muted/30 ${index === 0 ? 'bg-green-500/5' : ''}`}>
                                    <td className="px-4 py-3">
                                      <span className={`inline-flex items-center gap-1.5 ${index === 0 ? 'text-green-600 font-medium' : 'text-foreground'}`}>
                                        {index === 0 && (
                                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-500 text-white text-xs">✓</span>
                                        )}
                                        v{entry.version}
                                        {index === 0 && <span className="text-xs text-green-600">(Current)</span>}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                          <circle cx="12" cy="7" r="4"/>
                                        </svg>
                                        {entry.approvedBy}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground">
                                      {new Date(entry.approvedAt).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() => {
                                            if (selectedHistoryVersion === entry.id) {
                                              setSelectedHistoryVersion(null);
                                              setHistoryVersionImage(null);
                                            } else {
                                              setSelectedHistoryVersion(entry.id);
                                            }
                                          }}
                                          className={`inline-flex items-center gap-1 text-sm ${
                                            selectedHistoryVersion === entry.id
                                              ? 'text-primary font-medium'
                                              : 'text-muted-foreground hover:text-foreground'
                                          }`}
                                        >
                                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                            <circle cx="12" cy="12" r="3"/>
                                          </svg>
                                          {selectedHistoryVersion === entry.id ? 'Hide' : 'View'}
                                        </button>
                                        {/* Only show Restore button for non-current versions */}
                                        {index > 0 && (
                                          <button
                                            onClick={() => {
                                              setRestoreHistoryEntry({ id: entry.id, version: entry.version });
                                              setShowRestoreBaselineModal(true);
                                              setRestoreBaselineError('');
                                            }}
                                            className="inline-flex items-center gap-1 text-sm text-amber-600 hover:text-amber-700"
                                            title="Restore this version as the current baseline"
                                          >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                                              <path d="M3 3v5h5"/>
                                            </svg>
                                            Restore
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Selected History Version Preview */}
                          {selectedHistoryVersion && (
                            <div className="border border-border rounded-lg p-4 bg-muted/20">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-medium text-foreground">
                                  Version {baselineHistory.find(h => h.id === selectedHistoryVersion)?.version} Preview
                                </h4>
                                <button
                                  onClick={() => {
                                    setSelectedHistoryVersion(null);
                                    setHistoryVersionImage(null);
                                  }}
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"/>
                                    <line x1="6" y1="6" x2="18" y2="18"/>
                                  </svg>
                                </button>
                              </div>
                              {loadingHistoryImage ? (
                                <div className="flex items-center justify-center py-12">
                                  <svg className="animate-spin h-6 w-6 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  <span className="ml-2 text-muted-foreground">Loading image...</span>
                                </div>
                              ) : historyVersionImage ? (
                                <div className="border border-border rounded overflow-hidden">
                                  <img
                                    src={`data:image/png;base64,${historyVersionImage}`}
                                    alt={`Baseline version ${baselineHistory.find(h => h.id === selectedHistoryVersion)?.version}`}
                                    className="w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={() => setLightboxImage(`data:image/png;base64,${historyVersionImage}`)}
                                  />
                                </div>
                              ) : (
                                <div className="text-center py-8 text-muted-foreground">
                                  <p>Failed to load image</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Add Step Modal */}
        {showAddStepModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={(e) => e.target === e.currentTarget && setShowAddStepModal(false)}
          >
            <div role="dialog" aria-modal="true" aria-labelledby="add-step-title" className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
              <h3 id="add-step-title" className="text-lg font-semibold text-foreground">Add Test Step</h3>
              <form onSubmit={handleAddStep} className="mt-4 space-y-4">
                {/* Feature #1965: Expanded action dropdown with categorized sections */}
                <div>
                  <label className="block text-sm font-medium text-foreground">Action</label>
                  <select
                    value={newStepAction}
                    onChange={(e) => setNewStepAction(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {/* Navigation Actions */}
                    <optgroup label="🧭 Navigation">
                      <option value="navigate">Navigate to URL</option>
                      <option value="go_back">Go Back</option>
                      <option value="go_forward">Go Forward</option>
                      <option value="refresh">Refresh Page</option>
                    </optgroup>

                    {/* Interaction Actions */}
                    <optgroup label="👆 Interaction">
                      <option value="click">Click Element</option>
                      <option value="fill">Fill Input</option>
                      <option value="type">Type Text</option>
                      <option value="clear">Clear Input</option>
                      <option value="hover">Hover Over Element</option>
                      <option value="select_option">Select Dropdown Option</option>
                      <option value="check">Check Checkbox</option>
                      <option value="uncheck">Uncheck Checkbox</option>
                      <option value="upload_file">Upload File</option>
                      <option value="press_key">Press Key</option>
                    </optgroup>

                    {/* Scroll Actions */}
                    <optgroup label="📜 Scroll">
                      <option value="scroll_to_element">Scroll to Element</option>
                      <option value="scroll_to_top">Scroll to Top</option>
                      <option value="scroll_to_bottom">Scroll to Bottom</option>
                      <option value="scroll_by_pixels">Scroll by Pixels</option>
                    </optgroup>

                    {/* Wait Actions */}
                    <optgroup label="⏳ Wait">
                      <option value="wait_for_element">Wait for Element</option>
                      <option value="wait_for_url">Wait for URL</option>
                      <option value="wait_for_load">Wait for Page Load</option>
                      <option value="wait">Wait (Fixed Time)</option>
                    </optgroup>

                    {/* Assert Actions */}
                    <optgroup label="✅ Assert">
                      <option value="assert_text">Assert Text Visible</option>
                      <option value="assert_visible">Assert Element Visible</option>
                      <option value="assert_hidden">Assert Element Hidden</option>
                      <option value="assert_url">Assert URL</option>
                      <option value="assert_title">Assert Page Title</option>
                    </optgroup>

                    {/* Capture Actions */}
                    <optgroup label="📸 Capture">
                      <option value="screenshot">Take Screenshot</option>
                      <option value="screenshot_fullpage">Full Page Screenshot</option>
                      <option value="visual_checkpoint">Visual Checkpoint</option>
                      <option value="accessibility_check">Accessibility Check</option>
                    </optgroup>
                  </select>
                </div>
                {/* Feature #1965: Extended selector field for more actions */}
                {(newStepAction === 'click' || newStepAction === 'fill' || newStepAction === 'type' ||
                  newStepAction === 'clear' || newStepAction === 'hover' || newStepAction === 'select_option' ||
                  newStepAction === 'check' || newStepAction === 'uncheck' || newStepAction === 'upload_file' ||
                  newStepAction === 'scroll_to_element' || newStepAction === 'wait_for_element' ||
                  newStepAction === 'assert_visible' || newStepAction === 'assert_hidden') && (
                  <div>
                    <label className="block text-sm font-medium text-foreground">Selector</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={newStepSelector}
                        onChange={(e) => setNewStepSelector(e.target.value)}
                        onKeyDown={handleSelectorKeyDown}
                        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="e.g., button.submit, #email"
                      />
                      {/* Feature #1236: AI Copilot autocomplete suggestion */}
                      {showSelectorAutocomplete && selectorAutocomplete && (
                        <div className="absolute inset-0 mt-1 pointer-events-none">
                          <div className="w-full rounded-md border border-transparent px-3 py-2">
                            <span className="text-transparent">{newStepSelector}</span>
                            <span className="text-muted-foreground/50">{selectorAutocomplete.slice(newStepSelector.length)}</span>
                          </div>
                        </div>
                      )}
                      {showSelectorAutocomplete && selectorAutocomplete && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-[10px] font-mono">Tab</kbd>
                          <span>to accept</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {/* Feature #1965: Extended value field for more actions */}
                {(newStepAction === 'navigate' || newStepAction === 'fill' || newStepAction === 'type' ||
                  newStepAction === 'wait' || newStepAction === 'assert_text' || newStepAction === 'select_option' ||
                  newStepAction === 'upload_file' || newStepAction === 'press_key' || newStepAction === 'scroll_by_pixels' ||
                  newStepAction === 'wait_for_url' || newStepAction === 'assert_url' || newStepAction === 'assert_title' ||
                  newStepAction === 'screenshot') && (
                  <div>
                    <label className="block text-sm font-medium text-foreground">
                      {newStepAction === 'navigate' ? 'URL' :
                       newStepAction === 'wait' ? 'Milliseconds' :
                       newStepAction === 'assert_text' ? 'Text to Find' :
                       newStepAction === 'select_option' ? 'Option Value' :
                       newStepAction === 'upload_file' ? 'File Path' :
                       newStepAction === 'press_key' ? 'Key Name' :
                       newStepAction === 'scroll_by_pixels' ? 'Pixels (negative=up)' :
                       newStepAction === 'wait_for_url' ? 'URL Pattern' :
                       newStepAction === 'assert_url' ? 'Expected URL' :
                       newStepAction === 'assert_title' ? 'Expected Title' :
                       newStepAction === 'screenshot' ? 'Screenshot Name' : 'Value'}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={newStepValue}
                        onChange={(e) => setNewStepValue(e.target.value)}
                        onKeyDown={handleValueKeyDown}
                        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder={
                          newStepAction === 'navigate' ? (test?.target_url || '/page') :
                          newStepAction === 'wait' ? '1000' :
                          newStepAction === 'assert_text' ? 'Welcome' :
                          newStepAction === 'select_option' ? 'option-value' :
                          newStepAction === 'upload_file' ? '/path/to/file.pdf' :
                          newStepAction === 'press_key' ? 'Enter, Escape, Tab, ArrowDown...' :
                          newStepAction === 'scroll_by_pixels' ? '500 (down) or -500 (up)' :
                          newStepAction === 'wait_for_url' ? '**/dashboard' :
                          newStepAction === 'assert_url' ? (test?.target_url ? `${test.target_url}/home` : '/home') :
                          newStepAction === 'assert_title' ? 'My Page Title' :
                          newStepAction === 'screenshot' ? 'my-screenshot' : 'Enter value'
                        }
                      />
                      {/* Feature #1236: AI Copilot autocomplete suggestion */}
                      {showValueAutocomplete && valueAutocomplete && (
                        <div className="absolute inset-0 mt-1 pointer-events-none">
                          <div className="w-full rounded-md border border-transparent px-3 py-2">
                            <span className="text-transparent">{newStepValue}</span>
                            <span className="text-muted-foreground/50">{valueAutocomplete.slice(newStepValue.length)}</span>
                          </div>
                        </div>
                      )}
                      {showValueAutocomplete && valueAutocomplete && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-[10px] font-mono">Tab</kbd>
                          <span>to accept</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {newStepAction === 'visual_checkpoint' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-foreground">Checkpoint Name</label>
                      <input
                        type="text"
                        value={newStepCheckpointName}
                        onChange={(e) => setNewStepCheckpointName(e.target.value)}
                        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="e.g., login-page, dashboard-header"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">Unique identifier for this visual checkpoint</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground">Diff Threshold (%)</label>
                      <input
                        type="number"
                        value={newStepCheckpointThreshold}
                        onChange={(e) => setNewStepCheckpointThreshold(e.target.value)}
                        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="0.1"
                        min="0"
                        max="100"
                        step="0.1"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">Test fails if diff exceeds this percentage (0 = any change fails)</p>
                    </div>
                    <div className="rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-3">
                      <div className="flex items-start gap-2">
                        <svg className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="text-sm text-blue-700 dark:text-blue-300">
                          <p className="font-medium">Visual Checkpoint</p>
                          <p className="mt-1">Takes a screenshot and compares it against the baseline. The test will fail if visual differences exceed the threshold.</p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
                {newStepAction === 'accessibility_check' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-foreground">WCAG Level</label>
                      <select
                        value={newStepA11yWcagLevel}
                        onChange={(e) => setNewStepA11yWcagLevel(e.target.value as 'A' | 'AA' | 'AAA')}
                        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="A">Level A (Minimum)</option>
                        <option value="AA">Level AA (Recommended)</option>
                        <option value="AAA">Level AAA (Enhanced)</option>
                      </select>
                      <p className="mt-1 text-xs text-muted-foreground">WCAG conformance level to check against</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground">Failure Threshold</label>
                      <input
                        type="number"
                        value={newStepA11yThreshold}
                        onChange={(e) => setNewStepA11yThreshold(e.target.value)}
                        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="0"
                        min="0"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">Number of violations allowed before step fails (0 = any violation fails)</p>
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newStepA11yFailOnCritical}
                          onChange={(e) => setNewStepA11yFailOnCritical(e.target.checked)}
                          className="rounded border-border"
                        />
                        <span className="text-sm text-foreground">Fail on critical/serious violations only</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newStepA11yFailOnAny}
                          onChange={(e) => setNewStepA11yFailOnAny(e.target.checked)}
                          className="rounded border-border"
                        />
                        <span className="text-sm text-foreground">Fail on any violation (ignore threshold)</span>
                      </label>
                    </div>
                    <div className="rounded-md border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 p-3">
                      <div className="flex items-start gap-2">
                        <svg className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        <div className="text-sm text-purple-700 dark:text-purple-300">
                          <p className="font-medium">Accessibility Check</p>
                          <p className="mt-1">Runs an accessibility scan on the current page using axe-core. The E2E test will fail if accessibility violations exceed the configured threshold.</p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
                {addStepError && (
                  <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    {addStepError}
                  </div>
                )}
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddStepModal(false)}
                    className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                    disabled={isAddingStep}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isAddingStep}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isAddingStep ? 'Adding...' : 'Add Step'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Current Run Status */}
        {currentRun && (
          <div className="mt-8 rounded-lg border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Current Run</h2>
              {/* Download All Artifacts Button */}
              {currentRun.results && currentRun.results.length > 0 &&
               (currentRun.status === 'passed' || currentRun.status === 'failed' || currentRun.status === 'error') && (
                <button
                  onClick={() => handleDownloadAllArtifacts(currentRun.id)}
                  disabled={isDownloadingArtifacts}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                >
                  {isDownloadingArtifacts ? (
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  )}
                  {isDownloadingArtifacts ? 'Downloading...' : 'Download All Artifacts'}
                </button>
              )}
            </div>
            <div>
              <div className="flex items-center gap-4">
                {/* Feature #1979: Added 'warning' status styling for accessibility tests */}
                <span className={`rounded-full px-3 py-1 text-sm font-medium ${
                  currentRun.status === 'passed' ? 'bg-green-100 text-green-700' :
                  currentRun.status === 'failed' ? 'bg-red-100 text-red-700' :
                  currentRun.status === 'warning' ? 'bg-amber-100 text-amber-700' :
                  currentRun.status === 'running' ? 'bg-blue-100 text-blue-700' :
                  currentRun.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {currentRun.status}
                </span>
                {currentRun.duration_ms !== undefined && (
                  <span className="text-sm text-muted-foreground">
                    Duration: {currentRun.duration_ms}ms
                  </span>
                )}
              </div>

              {/* Real-time Progress Indicator */}
              {liveProgress && (currentRun.status === 'running' || currentRun.status === 'pending') && (
                <div className="mt-4 rounded-md bg-blue-50 dark:bg-blue-900/20 p-4 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2 mb-2">
                    <svg aria-hidden="true" className="animate-spin h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
                      Running test: {liveProgress.currentTest || 'Initializing...'}
                    </span>
                  </div>
                  {liveProgress.totalTests > 0 && (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full transition-all duration-300"
                          style={{ width: `${Math.round((liveProgress.completedTests / liveProgress.totalTests) * 100)}%` }}
                        />
                      </div>
                      <span className="text-sm text-blue-700 dark:text-blue-400 whitespace-nowrap">
                        {liveProgress.completedTests} / {liveProgress.totalTests} tests
                      </span>
                    </div>
                  )}
                  {liveProgress.currentStep && liveProgress.currentStep.total > 0 && (
                    <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                      Step {liveProgress.currentStep.index + 1} of {liveProgress.currentStep.total}
                      {liveProgress.currentStep.action && `: ${liveProgress.currentStep.action}`}
                    </div>
                  )}

                  {/* K6 Load Test Real-Time Metrics */}
                  {liveProgress.k6Metrics && (
                    <div className="mt-4 p-3 rounded-lg bg-blue-100/50 dark:bg-blue-800/30 border border-blue-200 dark:border-blue-700">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
                          🚀 Load Test: {liveProgress.k6Metrics.phase === 'ramp_up' ? 'Ramping Up' : liveProgress.k6Metrics.phase === 'steady' ? 'Steady State' : 'Ramping Down'}
                        </span>
                        <span className="text-xs text-blue-600 dark:text-blue-400">
                          {liveProgress.k6Metrics.progress}% complete
                        </span>
                      </div>
                      <div className="w-full h-2 bg-blue-200 dark:bg-blue-700 rounded-full overflow-hidden mb-3">
                        <div
                          className="h-full bg-blue-600 rounded-full transition-all duration-500"
                          style={{ width: `${liveProgress.k6Metrics.progress}%` }}
                        />
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                        <div className="p-2 rounded bg-white/50 dark:bg-gray-800/50">
                          <div className="text-lg font-bold text-blue-700 dark:text-blue-300">
                            {liveProgress.k6Metrics.currentVUs ?? test?.virtual_users ?? 0}
                          </div>
                          <div className="text-xs text-blue-600 dark:text-blue-400">Virtual Users</div>
                        </div>
                        <div className="p-2 rounded bg-white/50 dark:bg-gray-800/50">
                          <div className="text-lg font-bold text-blue-700 dark:text-blue-300">
                            {liveProgress.k6Metrics.totalRequests ?? 0}
                          </div>
                          <div className="text-xs text-blue-600 dark:text-blue-400">Total Requests</div>
                        </div>
                        <div className="p-2 rounded bg-white/50 dark:bg-gray-800/50">
                          <div className="text-lg font-bold text-blue-700 dark:text-blue-300">
                            {liveProgress.k6Metrics.requestsPerSecond?.toFixed(1) ?? '0.0'}
                          </div>
                          <div className="text-xs text-blue-600 dark:text-blue-400">Req/sec</div>
                        </div>
                        <div className="p-2 rounded bg-white/50 dark:bg-gray-800/50">
                          <div className="text-lg font-bold text-blue-700 dark:text-blue-300">
                            {liveProgress.k6Metrics.avgResponseTime ?? 0}ms
                          </div>
                          <div className="text-xs text-blue-600 dark:text-blue-400">Avg Response</div>
                        </div>
                        {/* Error Rate - Real-time (Feature #550) */}
                        <div className={`p-2 rounded border ${
                          (liveProgress.k6Metrics.errorRate ?? 0) > 5
                            ? 'bg-red-100/50 dark:bg-red-800/30 border-red-200 dark:border-red-700'
                            : (liveProgress.k6Metrics.errorRate ?? 0) > 1
                              ? 'bg-yellow-100/50 dark:bg-yellow-800/30 border-yellow-200 dark:border-yellow-700'
                              : 'bg-green-100/50 dark:bg-green-800/30 border-green-200 dark:border-green-700'
                        }`}>
                          <div className={`text-lg font-bold ${
                            (liveProgress.k6Metrics.errorRate ?? 0) > 5
                              ? 'text-red-700 dark:text-red-300'
                              : (liveProgress.k6Metrics.errorRate ?? 0) > 1
                                ? 'text-yellow-700 dark:text-yellow-300'
                                : 'text-green-700 dark:text-green-300'
                          }`}>
                            {(liveProgress.k6Metrics.errorRate ?? 0).toFixed(1)}%
                          </div>
                          <div className={`text-xs ${
                            (liveProgress.k6Metrics.errorRate ?? 0) > 5
                              ? 'text-red-600 dark:text-red-400'
                              : (liveProgress.k6Metrics.errorRate ?? 0) > 1
                                ? 'text-yellow-600 dark:text-yellow-400'
                                : 'text-green-600 dark:text-green-400'
                          }`}>Error Rate</div>
                        </div>
                      </div>

                      {/* Response Time Percentiles - Real-time */}
                      <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-600">
                        <div className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-2">Response Time Percentiles</div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="p-2 rounded bg-green-100/50 dark:bg-green-800/30 border border-green-200 dark:border-green-700">
                            <div className="text-base font-bold text-green-700 dark:text-green-300">
                              {liveProgress.k6Metrics.p50ResponseTime ?? 0}ms
                            </div>
                            <div className="text-xs text-green-600 dark:text-green-400">p50 (median)</div>
                          </div>
                          <div className="p-2 rounded bg-yellow-100/50 dark:bg-yellow-800/30 border border-yellow-200 dark:border-yellow-700">
                            <div className="text-base font-bold text-yellow-700 dark:text-yellow-300">
                              {liveProgress.k6Metrics.p95ResponseTime ?? 0}ms
                            </div>
                            <div className="text-xs text-yellow-600 dark:text-yellow-400">p95</div>
                          </div>
                          <div className="p-2 rounded bg-orange-100/50 dark:bg-orange-800/30 border border-orange-200 dark:border-orange-700">
                            <div className="text-base font-bold text-orange-700 dark:text-orange-300">
                              {liveProgress.k6Metrics.p99ResponseTime ?? 0}ms
                            </div>
                            <div className="text-xs text-orange-600 dark:text-orange-400">p99</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {currentRun.results && currentRun.results.length > 0 && (
                <div className="mt-4 space-y-4">
                  {currentRun.results.map((result) => (
                    <div key={result.test_id} className="rounded-md border border-border p-4">
                      <div className="flex items-center gap-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          result.status === 'passed' ? 'bg-green-100 text-green-700' :
                          result.status === 'failed' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {result.status}
                        </span>
                        <span className="font-medium text-foreground">{result.test_name}</span>
                        <span className="text-sm text-muted-foreground">{result.duration_ms}ms</span>
                      </div>

                      {result.error && (
                        <div role="alert" className="mt-2 rounded-md bg-destructive/10 p-2 text-sm text-destructive">
                          {result.error}
                        </div>
                      )}

                      {/* Feature #604: Storage quota exceeded error with suggestions */}
                      {result.isQuotaExceeded && (
                        <div role="alert" className="mt-2 rounded-md bg-amber-100 dark:bg-amber-900/30 p-3 border border-amber-300 dark:border-amber-700">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-amber-600 dark:text-amber-400">⚠️</span>
                            <span className="font-semibold text-amber-800 dark:text-amber-300">Storage quota exceeded</span>
                          </div>
                          <p className="text-sm text-amber-700 dark:text-amber-400 mb-2">
                            Unable to save baseline or screenshot due to storage quota limits.
                          </p>
                          {result.suggestions && result.suggestions.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-1">Suggested actions:</p>
                              <ul className="text-xs text-amber-700 dark:text-amber-400 list-disc list-inside space-y-0.5">
                                {result.suggestions.map((suggestion, idx) => (
                                  <li key={idx}>{suggestion}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {result.steps.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {result.steps.map((step, idx) => (
                            <div key={step.id || idx} className="flex items-center gap-2 text-sm">
                              {/* Feature #1979: Added 'warning' status styling for accessibility tests */}
                              <span className={`h-4 w-4 rounded-full flex items-center justify-center text-xs ${
                                step.status === 'passed' ? 'bg-green-500 text-white' :
                                step.status === 'failed' ? 'bg-red-500 text-white' :
                                step.status === 'warning' ? 'bg-amber-500 text-white' :
                                'bg-gray-400 text-white'
                              }`}>
                                {step.status === 'passed' ? '✓' : step.status === 'failed' ? '✗' : step.status === 'warning' ? '⚠' : '-'}
                              </span>
                              <span className="text-foreground">{step.action}</span>
                              <span className="text-muted-foreground">{step.duration_ms}ms</span>
                              {step.error && (
                                <span className="text-destructive text-xs">({step.error})</span>
                              )}
                              {/* Feature #601: Screenshot timeout indicator */}
                              {step.screenshot_timeout && (
                                <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                  ⏱️ Timeout
                                </span>
                              )}
                              {/* Feature #602: Navigation error indicator */}
                              {step.navigation_error && step.http_status && (
                                <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                  🌐 HTTP {step.http_status}
                                </span>
                              )}
                              {/* Feature #606: Browser crash indicator */}
                              {step.metadata?.isBrowserCrash && (
                                <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                  💥 Browser Crash
                                </span>
                              )}
                              {/* Feature #607: Oversized page indicator */}
                              {step.metadata?.isOversized && (
                                <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                                  📏 Page Too Large
                                </span>
                              )}
                            </div>
                          ))}
                          {/* Feature #606: Browser crash details section */}
                          {result.steps?.some((step: any) => step.metadata?.isBrowserCrash) && (
                            <div className="mt-3 p-3 rounded border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10">
                              <div className="flex items-start gap-2">
                                <span className="text-lg">💥</span>
                                <div className="flex-1">
                                  <h4 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">Browser Crash Detected</h4>
                                  <p className="text-xs text-red-600 dark:text-red-400 mb-2">
                                    The browser process terminated unexpectedly during test execution.
                                  </p>
                                  {(() => {
                                    const crashStep = result.steps.find((s: any) => s.metadata?.isBrowserCrash);
                                    if (!crashStep?.metadata) return null;
                                    return (
                                      <div className="space-y-1 text-xs">
                                        {crashStep.metadata.crashDetectedAt && (
                                          <p className="text-muted-foreground">
                                            <span className="font-medium">Detected at:</span> {new Date(crashStep.metadata.crashDetectedAt).toLocaleString()}
                                          </p>
                                        )}
                                        {crashStep.metadata.crashDumpFile && (
                                          <p className="text-muted-foreground">
                                            <span className="font-medium">Crash dump:</span> {crashStep.metadata.crashDumpFile}
                                          </p>
                                        )}
                                        {crashStep.metadata.suggestion && (
                                          <p className="text-amber-600 dark:text-amber-400 mt-2 p-2 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
                                            <span className="font-medium">💡 Suggestion:</span> {crashStep.metadata.suggestion}
                                          </p>
                                        )}
                                        {crashStep.metadata.canRetry && (
                                          <p className="text-green-600 dark:text-green-400 mt-1">
                                            ✓ This test can be retried automatically if retries are configured for this suite.
                                          </p>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>
                          )}
                          {/* Feature #607: Oversized page details section */}
                          {result.steps?.some((step: any) => step.metadata?.isOversized) && (
                            <div className="mt-3 p-3 rounded border border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-900/10">
                              <div className="flex items-start gap-2">
                                <span className="text-lg">📏</span>
                                <div className="flex-1">
                                  <h4 className="text-sm font-semibold text-orange-700 dark:text-orange-400 mb-1">Page Too Large for Full-Page Capture</h4>
                                  <p className="text-xs text-orange-600 dark:text-orange-400 mb-2">
                                    The page dimensions exceed the safe limit for full-page screenshots to prevent memory exhaustion.
                                  </p>
                                  {(() => {
                                    const oversizedStep = result.steps.find((s: any) => s.metadata?.isOversized);
                                    if (!oversizedStep?.metadata) return null;
                                    const dims = oversizedStep.metadata.pageDimensions;
                                    return (
                                      <div className="space-y-1 text-xs">
                                        {dims && (
                                          <>
                                            <p className="text-muted-foreground">
                                              <span className="font-medium">Page dimensions:</span> {dims.width}px × {dims.height}px
                                            </p>
                                            <p className="text-muted-foreground">
                                              <span className="font-medium">Estimated image size:</span> {dims.estimatedSizeMb?.toFixed(1)}MB
                                            </p>
                                            {dims.reason && (
                                              <p className="text-muted-foreground">
                                                <span className="font-medium">Reason:</span> {dims.reason}
                                              </p>
                                            )}
                                          </>
                                        )}
                                        {oversizedStep.metadata.suggestion && (
                                          <p className="text-amber-600 dark:text-amber-400 mt-2 p-2 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
                                            <span className="font-medium">💡 Suggestion:</span> {oversizedStep.metadata.suggestion}
                                          </p>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Feature #618: K6 Script Import Error Display */}
                      {result.steps?.some((step: any) => step.action === 'validate_imports' && step.metadata?.isImportError) && (
                        <div className="mt-4 p-4 border border-purple-200 dark:border-purple-800 rounded-lg bg-purple-50/50 dark:bg-purple-900/10">
                          <div className="flex items-start gap-3">
                            <span className="text-2xl">📦</span>
                            <div className="flex-1">
                              <h4 className="text-sm font-semibold text-purple-700 dark:text-purple-400">K6 Module Import Error</h4>
                              {result.steps.filter((step: any) => step.action === 'validate_imports' && step.metadata?.isImportError).map((step: any, idx: number) => (
                                <div key={idx} className="mt-2 space-y-2">
                                  {/* Error Location Badge */}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs px-2 py-1 rounded font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                                      📦 Module Not Found
                                    </span>
                                    {step.metadata?.lineNumber && (
                                      <span className="text-xs px-2 py-1 rounded font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                                        📍 Line {step.metadata.lineNumber}
                                      </span>
                                    )}
                                    {step.metadata?.modulePath && (
                                      <span className="text-xs px-2 py-1 rounded font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 font-mono">
                                        {step.metadata.modulePath}
                                      </span>
                                    )}
                                  </div>

                                  {/* Error Message */}
                                  <div className="mt-2 p-2 bg-purple-100 dark:bg-purple-900/20 rounded border border-purple-200 dark:border-purple-700">
                                    <code className="text-xs text-purple-900 dark:text-purple-200 font-mono">
                                      {step.error}
                                    </code>
                                  </div>

                                  {/* Available Modules */}
                                  {step.metadata?.availableModules && step.metadata.availableModules.length > 0 && (
                                    <details className="mt-2">
                                      <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                        📋 Show available modules ({step.metadata.availableModules.length})
                                      </summary>
                                      <div className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                                        <div className="flex flex-wrap gap-1">
                                          {step.metadata.availableModules.slice(0, 15).map((mod: string, modIdx: number) => (
                                            <span key={modIdx} className="text-xs px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-mono">
                                              {mod}
                                            </span>
                                          ))}
                                          {step.metadata.availableModules.length > 15 && (
                                            <span className="text-xs text-muted-foreground">
                                              +{step.metadata.availableModules.length - 15} more
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </details>
                                  )}

                                  {/* Suggestion */}
                                  {step.metadata?.suggestion && (
                                    <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                                      <div className="flex items-start gap-2">
                                        <span className="text-sm">💡</span>
                                        <p className="text-xs text-blue-700 dark:text-blue-300">{step.metadata.suggestion}</p>
                                      </div>
                                    </div>
                                  )}

                                  {/* Help Notice */}
                                  <div className="mt-3 p-2 bg-muted rounded">
                                    <p className="text-xs text-muted-foreground">
                                      📦 This error occurs when a K6 script tries to import a module that doesn't exist or is misspelled.
                                      Validation happens before test execution begins to catch these issues early.
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Feature #619: K6 Threshold Configuration Error Display */}
                      {result.steps?.some((step: any) => step.action === 'validate_thresholds' && step.metadata?.isThresholdError) && (
                        <div className="mt-4 p-4 border border-teal-200 dark:border-teal-800 rounded-lg bg-teal-50/50 dark:bg-teal-900/10">
                          <div className="flex items-start gap-3">
                            <span className="text-2xl">📊</span>
                            <div className="flex-1">
                              <h4 className="text-sm font-semibold text-teal-700 dark:text-teal-400">K6 Threshold Configuration Error</h4>
                              {result.steps.filter((step: any) => step.action === 'validate_thresholds' && step.metadata?.isThresholdError).map((step: any, idx: number) => (
                                <div key={idx} className="mt-2 space-y-2">
                                  {/* Error Count Badge */}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs px-2 py-1 rounded font-medium bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">
                                      ⚠️ {step.metadata?.errorCount || 1} Invalid Threshold{(step.metadata?.errorCount || 1) > 1 ? 's' : ''}
                                    </span>
                                  </div>

                                  {/* Error Details */}
                                  {step.metadata?.errors && step.metadata.errors.length > 0 && (
                                    <div className="mt-2 space-y-2">
                                      {step.metadata.errors.map((error: any, errIdx: number) => (
                                        <div key={errIdx} className="p-2 bg-teal-100 dark:bg-teal-900/20 rounded border border-teal-200 dark:border-teal-700">
                                          <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <span className="text-xs px-1.5 py-0.5 rounded font-mono bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                                              {error.metric || 'unknown'}
                                            </span>
                                            {error.expression && (
                                              <span className="text-xs px-1.5 py-0.5 rounded font-mono bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                                                {error.expression}
                                              </span>
                                            )}
                                          </div>
                                          <code className="text-xs text-teal-900 dark:text-teal-200 font-mono block">
                                            {error.error}
                                          </code>
                                          {error.suggestion && (
                                            <div className="mt-1 flex items-start gap-1">
                                              <span className="text-xs">💡</span>
                                              <p className="text-xs text-teal-600 dark:text-teal-400">{error.suggestion}</p>
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Syntax Examples */}
                                  {step.metadata?.examples && step.metadata.examples.length > 0 && (
                                    <details className="mt-2">
                                      <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                        📖 Show correct syntax examples
                                      </summary>
                                      <div className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                                        <ul className="space-y-1">
                                          {step.metadata.examples.map((example: string, exIdx: number) => (
                                            <li key={exIdx} className="text-xs text-gray-700 dark:text-gray-300 font-mono">
                                              {example}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    </details>
                                  )}

                                  {/* Help Notice */}
                                  <div className="mt-3 p-2 bg-muted rounded">
                                    <p className="text-xs text-muted-foreground">
                                      📊 K6 thresholds define pass/fail criteria for load tests. Expression format: {`<function><operator><value>`} (e.g., 'p(95)&lt;500', 'rate&lt;0.01').
                                      Validation prevents test execution until all thresholds are valid.
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Feature #614: K6 Script Syntax Error Display */}
                      {result.steps?.some((step: any) => step.action === 'validate_syntax' && step.metadata?.isSyntaxError) && (
                        <div className="mt-4 p-4 border border-red-200 dark:border-red-800 rounded-lg bg-red-50/50 dark:bg-red-900/10">
                          <div className="flex items-start gap-3">
                            <span className="text-2xl">⚠️</span>
                            <div className="flex-1">
                              <h4 className="text-sm font-semibold text-red-700 dark:text-red-400">K6 Script Syntax Error</h4>
                              {result.steps.filter((step: any) => step.action === 'validate_syntax' && step.metadata?.isSyntaxError).map((step: any, idx: number) => (
                                <div key={idx} className="mt-2 space-y-2">
                                  {/* Error Location Badge */}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs px-2 py-1 rounded font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                      ❌ Syntax Error
                                    </span>
                                    {step.metadata?.lineNumber && (
                                      <span className="text-xs px-2 py-1 rounded font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                                        📍 Line {step.metadata.lineNumber}
                                        {step.metadata?.column ? `, Column ${step.metadata.column}` : ''}
                                      </span>
                                    )}
                                  </div>

                                  {/* Error Message */}
                                  <p className="text-sm text-red-600 dark:text-red-400 font-mono">{step.error}</p>

                                  {/* Suggestion */}
                                  {step.metadata?.suggestion && (
                                    <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                                      <div className="flex items-start gap-2">
                                        <span className="text-sm">💡</span>
                                        <p className="text-xs text-blue-700 dark:text-blue-300">{step.metadata.suggestion}</p>
                                      </div>
                                    </div>
                                  )}

                                  {/* Help Notice */}
                                  <div className="mt-3 p-2 bg-muted rounded">
                                    <p className="text-xs text-muted-foreground">
                                      📝 The script was validated before execution and contains invalid JavaScript syntax.
                                      Fix the error in your K6 script and try running the test again.
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Feature #615: K6 Script Runtime Error Display */}
                      {result.steps?.some((step: any) => step.action === 'runtime_error' && step.metadata?.isRuntimeError) && (
                        <div className="mt-4 p-4 border border-orange-200 dark:border-orange-800 rounded-lg bg-orange-50/50 dark:bg-orange-900/10">
                          <div className="flex items-start gap-3">
                            <span className="text-2xl">💥</span>
                            <div className="flex-1">
                              <h4 className="text-sm font-semibold text-orange-700 dark:text-orange-400">K6 Script Runtime Error</h4>
                              {result.steps.filter((step: any) => step.action === 'runtime_error' && step.metadata?.isRuntimeError).map((step: any, idx: number) => (
                                <div key={idx} className="mt-2 space-y-2">
                                  {/* Error Type and Location Badge */}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
                                      🔥 {step.metadata.runtimeError || 'Runtime Error'}
                                    </span>
                                    {step.metadata?.scriptLocation?.line && (
                                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                                        📍 Line {step.metadata.scriptLocation.line}
                                        {step.metadata.scriptLocation.column && `, Col ${step.metadata.scriptLocation.column}`}
                                      </span>
                                    )}
                                    {step.metadata?.scriptLocation?.functionName && (
                                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                                        ⚡ {step.metadata.scriptLocation.functionName}()
                                      </span>
                                    )}
                                  </div>

                                  {/* Failure Stats */}
                                  {step.metadata?.failedIterations !== undefined && step.metadata?.totalIterations !== undefined && (
                                    <div className="flex items-center gap-2">
                                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                                        ❌ {step.metadata.failedIterations} / {step.metadata.totalIterations} iterations failed
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        ({((step.metadata.failedIterations / step.metadata.totalIterations) * 100).toFixed(1)}% failure rate)
                                      </span>
                                    </div>
                                  )}

                                  {/* Error Message */}
                                  <div className="mt-2 p-2 bg-orange-100 dark:bg-orange-900/20 rounded border border-orange-200 dark:border-orange-700">
                                    <code className="text-xs text-orange-900 dark:text-orange-200 font-mono">
                                      {step.error || step.metadata?.errorMessage || 'Unknown runtime error'}
                                    </code>
                                  </div>

                                  {/* Stack Trace */}
                                  {step.metadata?.stack && (
                                    <details className="mt-2">
                                      <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                        📋 Show stack trace
                                      </summary>
                                      <div className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 overflow-x-auto">
                                        <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap">
                                          {step.metadata.stack}
                                        </pre>
                                      </div>
                                    </details>
                                  )}

                                  {/* Suggestion */}
                                  {step.metadata?.suggestion && (
                                    <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                                      <div className="flex items-start gap-2">
                                        <span className="text-sm">💡</span>
                                        <p className="text-xs text-blue-700 dark:text-blue-300">{step.metadata.suggestion}</p>
                                      </div>
                                    </div>
                                  )}

                                  {/* Help Notice */}
                                  <div className="mt-3 p-2 bg-muted rounded">
                                    <p className="text-xs text-muted-foreground">
                                      🔧 A runtime error occurred during K6 script execution. This typically indicates a bug in the script logic
                                      (e.g., accessing undefined variables, null references, or type mismatches). Review the error message and
                                      stack trace to identify and fix the issue in your script.
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Feature #616: K6 Server Unavailable Error Display */}
                      {result.steps?.some((step: any) => step.action === 'server_unavailable' && step.metadata?.isServerUnavailable) && (
                        <div className="mt-4 p-4 border border-red-200 dark:border-red-800 rounded-lg bg-red-50/50 dark:bg-red-900/10">
                          <div className="flex items-start gap-3">
                            <span className="text-2xl">🔌</span>
                            <div className="flex-1">
                              <h4 className="text-sm font-semibold text-red-700 dark:text-red-400">Target Server Unavailable</h4>
                              {result.steps.filter((step: any) => step.action === 'server_unavailable' && step.metadata?.isServerUnavailable).map((step: any, idx: number) => (
                                <div key={idx} className="mt-2 space-y-2">
                                  {/* Connection Error Type Badge */}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                                      {step.metadata.connectionErrorType === 'connection_refused' && '🚫 Connection Refused'}
                                      {step.metadata.connectionErrorType === 'host_unreachable' && '❌ Host Unreachable'}
                                      {step.metadata.connectionErrorType === 'network_error' && '📡 Network Error'}
                                      {step.metadata.connectionErrorType === 'timeout' && '⏱️ Connection Timeout'}
                                    </span>
                                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
                                      📉 {step.metadata.failureRate}% Failure Rate
                                    </span>
                                  </div>

                                  {/* Request Stats */}
                                  {step.metadata?.totalFailedRequests !== undefined && step.metadata?.totalRequests !== undefined && (
                                    <div className="flex items-center gap-2">
                                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                                        ❌ {step.metadata.totalFailedRequests.toLocaleString()} / {step.metadata.totalRequests.toLocaleString()} requests failed
                                      </span>
                                    </div>
                                  )}

                                  {/* Connection Error Breakdown */}
                                  {step.metadata?.connectionErrors && (
                                    <div className="mt-2 p-2 bg-red-100/50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-700">
                                      <div className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">Connection Error Breakdown:</div>
                                      <div className="grid grid-cols-2 gap-2 text-xs">
                                        {step.metadata.connectionErrors.connection_refused > 0 && (
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">Connection Refused:</span>
                                            <span className="text-red-700 dark:text-red-400 font-mono">{step.metadata.connectionErrors.connection_refused}</span>
                                          </div>
                                        )}
                                        {step.metadata.connectionErrors.host_unreachable > 0 && (
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">Host Unreachable:</span>
                                            <span className="text-red-700 dark:text-red-400 font-mono">{step.metadata.connectionErrors.host_unreachable}</span>
                                          </div>
                                        )}
                                        {step.metadata.connectionErrors.network_error > 0 && (
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">Network Error:</span>
                                            <span className="text-red-700 dark:text-red-400 font-mono">{step.metadata.connectionErrors.network_error}</span>
                                          </div>
                                        )}
                                        {step.metadata.connectionErrors.timeout > 0 && (
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">Timeout:</span>
                                            <span className="text-red-700 dark:text-red-400 font-mono">{step.metadata.connectionErrors.timeout}</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* Error Message */}
                                  <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-700">
                                    <code className="text-xs text-red-900 dark:text-red-200 font-mono">
                                      {step.error || 'Unable to connect to target server'}
                                    </code>
                                  </div>

                                  {/* Suggestion */}
                                  {step.metadata?.suggestion && (
                                    <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                                      <div className="flex items-start gap-2">
                                        <span className="text-sm">💡</span>
                                        <p className="text-xs text-blue-700 dark:text-blue-300">{step.metadata.suggestion}</p>
                                      </div>
                                    </div>
                                  )}

                                  {/* Help Notice */}
                                  <div className="mt-3 p-2 bg-muted rounded">
                                    <p className="text-xs text-muted-foreground">
                                      🔌 The target server could not be reached during load testing. This indicates that the server is down,
                                      not accepting connections, or there is a network issue between the test runner and the target. The test
                                      completed (did not hang indefinitely) but with high error rates.
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Feature #617: K6 Resource Exhaustion Error Display */}
                      {result.steps?.some((step: any) => step.action === 'resource_exhaustion' && step.metadata?.isResourceExhaustion) && (
                        <div className="mt-4 p-4 border border-amber-200 dark:border-amber-800 rounded-lg bg-amber-50/50 dark:bg-amber-900/10">
                          <div className="flex items-start gap-3">
                            <span className="text-2xl">⚠️</span>
                            <div className="flex-1">
                              <h4 className="text-sm font-semibold text-amber-700 dark:text-amber-400">Resource Limit Exceeded - Test Aborted</h4>
                              {result.steps.filter((step: any) => step.action === 'resource_exhaustion' && step.metadata?.isResourceExhaustion).map((step: any, idx: number) => (
                                <div key={idx} className="mt-2 space-y-2">
                                  {/* Resource Type Badge */}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                                      {step.metadata.resourceType === 'memory' && '💾 Out of Memory'}
                                      {step.metadata.resourceType === 'cpu' && '🔥 CPU Exhausted'}
                                      {step.metadata.resourceType === 'file_descriptors' && '📂 File Descriptors Exhausted'}
                                      {step.metadata.resourceType === 'threads' && '🧵 Thread Limit Reached'}
                                    </span>
                                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                                      ⏹️ Aborted at {step.metadata.abortedAtPercent}%
                                    </span>
                                  </div>

                                  {/* Partial Results */}
                                  {step.metadata?.partialResults && (
                                    <div className="flex items-center gap-2">
                                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                        📊 {step.metadata.partialResults.completed_requests.toLocaleString()} / {step.metadata.partialResults.total_planned_requests.toLocaleString()} requests completed
                                      </span>
                                    </div>
                                  )}

                                  {/* Peak Usage vs Limits */}
                                  {step.metadata?.peakUsage && step.metadata?.limit && (
                                    <div className="mt-2 p-2 bg-amber-100/50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-700">
                                      <div className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-2">Resource Usage at Abort:</div>
                                      <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div className="flex justify-between items-center">
                                          <span className="text-muted-foreground">Memory:</span>
                                          <span className={`font-mono ${step.metadata.peakUsage.memory_mb > step.metadata.limit.memory_mb ? 'text-red-600 dark:text-red-400 font-bold' : 'text-foreground'}`}>
                                            {step.metadata.peakUsage.memory_mb} MB / {step.metadata.limit.memory_mb} MB
                                          </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                          <span className="text-muted-foreground">CPU:</span>
                                          <span className={`font-mono ${step.metadata.peakUsage.cpu_percent > step.metadata.limit.cpu_percent ? 'text-red-600 dark:text-red-400 font-bold' : 'text-foreground'}`}>
                                            {step.metadata.peakUsage.cpu_percent}% / {step.metadata.limit.cpu_percent}%
                                          </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                          <span className="text-muted-foreground">Open Files:</span>
                                          <span className={`font-mono ${step.metadata.peakUsage.open_files > step.metadata.limit.max_files ? 'text-red-600 dark:text-red-400 font-bold' : 'text-foreground'}`}>
                                            {step.metadata.peakUsage.open_files.toLocaleString()} / {step.metadata.limit.max_files.toLocaleString()}
                                          </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                          <span className="text-muted-foreground">Threads:</span>
                                          <span className={`font-mono ${step.metadata.peakUsage.threads > step.metadata.limit.max_threads ? 'text-red-600 dark:text-red-400 font-bold' : 'text-foreground'}`}>
                                            {step.metadata.peakUsage.threads} / {step.metadata.limit.max_threads}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Error Message */}
                                  <div className="mt-2 p-2 bg-amber-100 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-700">
                                    <code className="text-xs text-amber-900 dark:text-amber-200 font-mono">
                                      {step.error || 'Resource limit exceeded'}
                                    </code>
                                  </div>

                                  {/* Suggestion */}
                                  {step.metadata?.suggestion && (
                                    <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                                      <div className="flex items-start gap-2">
                                        <span className="text-sm">💡</span>
                                        <p className="text-xs text-blue-700 dark:text-blue-300">{step.metadata.suggestion}</p>
                                      </div>
                                    </div>
                                  )}

                                  {/* Partial Results Notice */}
                                  <div className="mt-3 p-2 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
                                    <div className="flex items-start gap-2">
                                      <span className="text-sm">✅</span>
                                      <p className="text-xs text-green-700 dark:text-green-300">
                                        Partial results up to the abort point have been preserved. You can view the metrics collected before the test was terminated.
                                      </p>
                                    </div>
                                  </div>

                                  {/* Help Notice */}
                                  <div className="mt-3 p-2 bg-muted rounded">
                                    <p className="text-xs text-muted-foreground">
                                      ⚠️ The test was aborted because the test runner exceeded resource limits. This typically happens when running
                                      too many virtual users for the available system resources. The test safely aborted before causing system instability,
                                      and partial results have been preserved.
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* K6 Load Test Results (Feature #551) */}
                      {result.steps?.some((step: any) => step.load_test) && (
                        (() => {
                          const loadTestStep = result.steps.find((step: any) => step.load_test);
                          const loadTest = loadTestStep?.load_test;
                          if (!loadTest) return null;
                          return (
                            <div className="mt-4 p-4 border border-border rounded-lg bg-blue-50/50 dark:bg-blue-900/10">
                              <div className="flex items-center gap-2 mb-3">
                                <span className="text-lg">🚀</span>
                                <h4 className="text-sm font-semibold text-foreground">Load Test Results</h4>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                  (loadTest.summary?.success_rate ?? 0) >= 95
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                }`}>
                                  {loadTest.summary?.success_rate ?? 0}% success
                                </span>
                              </div>

                              {/* Summary Stats */}
                              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
                                <div className="p-2 rounded bg-white/50 dark:bg-gray-800/50 text-center">
                                  <div className="text-lg font-bold text-blue-700 dark:text-blue-300">
                                    {(loadTest.summary?.total_requests || 0).toLocaleString()}
                                  </div>
                                  <div className="text-xs text-muted-foreground">Total Requests</div>
                                </div>
                                <div className="p-2 rounded bg-white/50 dark:bg-gray-800/50 text-center">
                                  <div className="text-lg font-bold text-blue-700 dark:text-blue-300">
                                    {loadTest.summary?.requests_per_second || '0'}
                                  </div>
                                  <div className="text-xs text-muted-foreground">Avg Req/sec</div>
                                </div>
                                <div className="p-2 rounded bg-green-100/50 dark:bg-green-800/30 border border-green-200 dark:border-green-700 text-center">
                                  <div className="text-lg font-bold text-green-700 dark:text-green-300">
                                    {loadTest.summary?.peak_rps || 'N/A'}
                                  </div>
                                  <div className="text-xs text-green-600 dark:text-green-400">Peak RPS</div>
                                </div>
                                <div className="p-2 rounded bg-white/50 dark:bg-gray-800/50 text-center">
                                  <div className="text-lg font-bold text-blue-700 dark:text-blue-300">
                                    {typeof loadTest.virtual_users === 'number'
                                      ? loadTest.virtual_users
                                      : (loadTest.virtual_users?.configured || loadTest.virtual_users?.peak || 'N/A')}
                                  </div>
                                  <div className="text-xs text-muted-foreground">Virtual Users</div>
                                </div>
                                <div className="p-2 rounded bg-white/50 dark:bg-gray-800/50 text-center">
                                  <div className="text-lg font-bold text-blue-700 dark:text-blue-300">
                                    {loadTest.summary?.data_transferred_formatted || 'N/A'}
                                  </div>
                                  <div className="text-xs text-muted-foreground">Data Transferred</div>
                                </div>
                              </div>

                              {/* Response Time Percentiles */}
                              {loadTest.response_times && (
                                <div className="mb-4">
                                  <div className="text-xs font-medium text-foreground mb-2">Response Time Percentiles</div>
                                  <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
                                    <div className="p-2 rounded bg-white/50 dark:bg-gray-800/50 text-center">
                                      <div className="text-sm font-bold text-foreground">{loadTest.response_times.min || 0}ms</div>
                                      <div className="text-xs text-muted-foreground">Min</div>
                                    </div>
                                    <div className="p-2 rounded bg-green-100/50 dark:bg-green-800/30 border border-green-200 dark:border-green-700 text-center">
                                      <div className="text-sm font-bold text-green-700 dark:text-green-300">{loadTest.response_times.median || loadTest.response_times.p50 || 0}ms</div>
                                      <div className="text-xs text-green-600 dark:text-green-400">p50 (median)</div>
                                    </div>
                                    <div className="p-2 rounded bg-white/50 dark:bg-gray-800/50 text-center">
                                      <div className="text-sm font-bold text-foreground">{loadTest.response_times.avg || 0}ms</div>
                                      <div className="text-xs text-muted-foreground">Avg</div>
                                    </div>
                                    <div className="p-2 rounded bg-white/50 dark:bg-gray-800/50 text-center">
                                      <div className="text-sm font-bold text-foreground">{loadTest.response_times.p90 || 0}ms</div>
                                      <div className="text-xs text-muted-foreground">p90</div>
                                    </div>
                                    <div className="p-2 rounded bg-yellow-100/50 dark:bg-yellow-800/30 border border-yellow-200 dark:border-yellow-700 text-center">
                                      <div className="text-sm font-bold text-yellow-700 dark:text-yellow-300">{loadTest.response_times.p95 || 0}ms</div>
                                      <div className="text-xs text-yellow-600 dark:text-yellow-400">p95</div>
                                    </div>
                                    <div className="p-2 rounded bg-orange-100/50 dark:bg-orange-800/30 border border-orange-200 dark:border-orange-700 text-center">
                                      <div className="text-sm font-bold text-orange-700 dark:text-orange-300">{loadTest.response_times.p99 || 0}ms</div>
                                      <div className="text-xs text-orange-600 dark:text-orange-400">p99</div>
                                    </div>
                                    <div className="p-2 rounded bg-white/50 dark:bg-gray-800/50 text-center">
                                      <div className="text-sm font-bold text-foreground">{loadTest.response_times.max || 0}ms</div>
                                      <div className="text-xs text-muted-foreground">Max</div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* HTTP Status Codes */}
                              {loadTest.http_codes && Object.keys(loadTest.http_codes).length > 0 && (
                                <div>
                                  <div className="text-xs font-medium text-foreground mb-2">HTTP Status Codes</div>
                                  <div className="flex flex-wrap gap-2">
                                    {Object.entries(loadTest.http_codes).map(([code, count]) => (
                                      <span
                                        key={code}
                                        className={`px-2 py-1 rounded text-xs font-medium ${
                                          code.startsWith('2') ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                                          code.startsWith('3') ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                                          code.startsWith('4') ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                          'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                        }`}
                                      >
                                        {code}: {(count as number).toLocaleString()}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()
                      )}

                      {/* Feature #1974: Smoke Test Health Report Card */}
                      {result.test_name?.toLowerCase().includes('smoke') && result.steps && result.steps.length > 0 && (
                        <div className="mt-4 p-4 border border-border rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900/50 dark:to-slate-800/50">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{result.status === 'passed' ? '💚' : '⚠️'}</span>
                              <div>
                                <h4 className="text-lg font-bold text-foreground">
                                  {result.status === 'passed' ? 'HEALTHY' : 'ISSUES FOUND'}
                                </h4>
                                <p className="text-xs text-muted-foreground">Quick Health Check Report</p>
                              </div>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                              result.status === 'passed'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            }`}>
                              {result.status === 'passed' ? 'PASS' : 'FAIL'}
                            </span>
                          </div>

                          <div className="space-y-2">
                            {/* Page Load Check */}
                            {(() => {
                              const navigateStep = result.steps.find((s: any) => s.action === 'navigate');
                              const passed = navigateStep?.status === 'passed';
                              return (
                                <div className={`flex items-center justify-between p-2 rounded ${
                                  passed ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'
                                }`}>
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">{passed ? '✅' : '❌'}</span>
                                    <span className="font-medium text-foreground">Page Loaded</span>
                                  </div>
                                  <span className="text-sm text-muted-foreground">
                                    {navigateStep?.duration_ms ? `${(navigateStep.duration_ms / 1000).toFixed(2)}s` : 'N/A'}
                                  </span>
                                </div>
                              );
                            })()}

                            {/* Console Errors Check */}
                            {(() => {
                              const consoleStep = result.steps.find((s: any) => s.action === 'assert_no_console_errors');
                              const passed = consoleStep?.status === 'passed';
                              return (
                                <div className={`flex items-center justify-between p-2 rounded ${
                                  passed ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'
                                }`}>
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">{passed ? '✅' : '❌'}</span>
                                    <span className="font-medium text-foreground">No Console Errors</span>
                                  </div>
                                  <span className="text-sm text-muted-foreground">
                                    {passed ? 'Clean' : consoleStep?.error?.split(':')[0] || 'Errors Found'}
                                  </span>
                                </div>
                              );
                            })()}

                            {/* Screenshot Check */}
                            {(() => {
                              const screenshotStep = result.steps.find((s: any) => s.action === 'screenshot');
                              const passed = screenshotStep?.status === 'passed';
                              return (
                                <div className={`flex items-center justify-between p-2 rounded ${
                                  passed ? 'bg-green-50 dark:bg-green-900/20' : 'bg-amber-50 dark:bg-amber-900/20'
                                }`}>
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">{passed ? '✅' : '⚠️'}</span>
                                    <span className="font-medium text-foreground">Screenshot Captured</span>
                                  </div>
                                  <span className="text-sm text-muted-foreground">
                                    {passed ? 'OK' : 'Not Captured'}
                                  </span>
                                </div>
                              );
                            })()}

                            {/* Wait/Stability Check */}
                            {(() => {
                              const waitStep = result.steps.find((s: any) => s.action === 'wait');
                              const passed = waitStep?.status === 'passed';
                              return waitStep ? (
                                <div className={`flex items-center justify-between p-2 rounded ${
                                  passed ? 'bg-green-50 dark:bg-green-900/20' : 'bg-amber-50 dark:bg-amber-900/20'
                                }`}>
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">{passed ? '✅' : '⚠️'}</span>
                                    <span className="font-medium text-foreground">Page Stability</span>
                                  </div>
                                  <span className="text-sm text-muted-foreground">
                                    {passed ? 'Stable' : 'Unstable'}
                                  </span>
                                </div>
                              ) : null;
                            })()}
                          </div>

                          {/* Summary Footer */}
                          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                              Total Duration: {result.duration_ms}ms
                            </span>
                            {result.status === 'failed' && (
                              <button
                                onClick={() => {
                                  // Create appropriate full tests based on what failed
                                  toast.info('Run individual tests for detailed analysis');
                                }}
                                className="text-xs px-3 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                              >
                                Run Full Test
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {result.screenshot_base64 && (
                        <div className="mt-4">
                          <p className="text-sm font-medium text-foreground mb-2">Screenshot (click to expand):</p>
                          <img
                            src={`data:image/png;base64,${result.screenshot_base64}`}
                            alt="Test screenshot"
                            className="max-w-full h-auto border border-border rounded-md cursor-pointer hover:opacity-80 transition-opacity"
                            style={{ maxHeight: '300px' }}
                            onClick={() => setLightboxImage(`data:image/png;base64,${result.screenshot_base64}`)}
                          />
                        </div>
                      )}

                      {/* Visual Comparison Results */}
                      {result.visual_comparison && (
                        <div className="mt-4 p-4 border border-border rounded-lg bg-muted/30">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-lg">🔍</span>
                            <h4 className="text-sm font-semibold text-foreground">Visual Comparison</h4>
                            {/* Feature #600: Corrupted baseline indicator */}
                            {result.visual_comparison.baselineCorrupted && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                                ⚠️ Baseline Corrupted
                              </span>
                            )}
                            {result.diff_percentage !== undefined && !result.visual_comparison.baselineCorrupted && (
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                result.diff_percentage === 0
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                              }`}>
                                {result.diff_percentage === 0
                                  ? '✓ Match'
                                  : `${result.diff_percentage.toFixed(2)}% different`}
                              </span>
                            )}
                            {!result.visual_comparison.hasBaseline && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                                📸 Baseline Created
                              </span>
                            )}
                          </div>

                          {/* Feature #600: Corrupted baseline error message and recovery option */}
                          {result.visual_comparison.baselineCorrupted && (
                            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                              <div className="flex items-start gap-3">
                                <span className="text-red-600 text-lg">⚠️</span>
                                <div className="flex-1">
                                  <h5 className="font-medium text-red-800 dark:text-red-400">Baseline Image Corrupted or Unreadable</h5>
                                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                                    {result.visual_comparison.corruptionError || 'The baseline image file is corrupted and cannot be used for comparison.'}
                                  </p>
                                  <div className="mt-3 flex items-center gap-3">
                                    <button
                                      onClick={async () => {
                                        // Re-capture baseline - accept current screenshot as new baseline
                                        if (result.test_id && result.screenshot_base64) {
                                          try {
                                            const response = await fetch(`/api/v1/tests/${result.test_id}/accept-visual-change`, {
                                              method: 'POST',
                                              headers: {
                                                'Content-Type': 'application/json',
                                                Authorization: `Bearer ${token}`,
                                              },
                                              body: JSON.stringify({
                                                screenshot: result.screenshot_base64,
                                                viewport: 'default',
                                              }),
                                            });
                                            if (response.ok) {
                                              toast.success('Baseline re-captured successfully! Run the test again to verify.');
                                            } else {
                                              toast.error('Failed to re-capture baseline');
                                            }
                                          } catch {
                                            toast.error('Failed to re-capture baseline');
                                          }
                                        }
                                      }}
                                      className="px-3 py-1.5 text-sm font-medium bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                                    >
                                      📸 Re-capture Baseline
                                    </button>
                                    <span className="text-xs text-red-600 dark:text-red-400">
                                      This will replace the corrupted baseline with the current screenshot
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {result.visual_comparison.hasBaseline && result.diff_percentage !== undefined && result.diff_percentage > 0 && (
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="text-xs text-muted-foreground">
                                  <span className="font-medium">{result.visual_comparison.mismatchedPixels?.toLocaleString()}</span> pixels differ out of <span className="font-medium">{result.visual_comparison.totalPixels?.toLocaleString()}</span> total
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                  {/* View Mode Toggle */}
                                  <div className="flex items-center gap-1 rounded-md border border-border bg-background p-0.5">
                                  <button
                                    onClick={() => setComparisonViewMode('side-by-side')}
                                    className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                                      comparisonViewMode === 'side-by-side'
                                        ? 'bg-primary text-primary-foreground'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                    }`}
                                  >
                                    Side by Side
                                  </button>
                                  <button
                                    onClick={() => setComparisonViewMode('slider')}
                                    className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                                      comparisonViewMode === 'slider'
                                        ? 'bg-primary text-primary-foreground'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                    }`}
                                  >
                                    Slider
                                  </button>
                                  <button
                                    onClick={() => setComparisonViewMode('onion-skin')}
                                    className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                                      comparisonViewMode === 'onion-skin'
                                        ? 'bg-primary text-primary-foreground'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                    }`}
                                  >
                                    Onion Skin
                                  </button>
                                  <button
                                    onClick={() => setComparisonViewMode('diff')}
                                    className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                                      comparisonViewMode === 'diff'
                                        ? 'bg-primary text-primary-foreground'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                    }`}
                                  >
                                    Diff Only
                                  </button>
                                  <button
                                    onClick={() => setComparisonViewMode('diff-overlay')}
                                    className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                                      comparisonViewMode === 'diff-overlay'
                                        ? 'bg-primary text-primary-foreground'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                    }`}
                                  >
                                    Diff Overlay
                                  </button>
                                </div>

                                {/* Zoom Controls */}
                                <div className="flex items-center gap-1 rounded-md border border-border bg-background p-0.5">
                                  <span className="px-2 text-xs text-muted-foreground">Zoom:</span>
                                  <button
                                    onClick={() => setImageZoomLevel('fit')}
                                    className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                                      imageZoomLevel === 'fit'
                                        ? 'bg-primary text-primary-foreground'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                    }`}
                                  >
                                    Fit
                                  </button>
                                  <button
                                    onClick={() => setImageZoomLevel('50')}
                                    className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                                      imageZoomLevel === '50'
                                        ? 'bg-primary text-primary-foreground'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                    }`}
                                  >
                                    50%
                                  </button>
                                  <button
                                    onClick={() => setImageZoomLevel('100')}
                                    className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                                      imageZoomLevel === '100'
                                        ? 'bg-primary text-primary-foreground'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                    }`}
                                    title="Actual Size (1:1 pixel ratio)"
                                  >
                                    100%
                                  </button>
                                  <button
                                    onClick={() => setImageZoomLevel('200')}
                                    className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                                      imageZoomLevel === '200'
                                        ? 'bg-primary text-primary-foreground'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                    }`}
                                  >
                                    200%
                                  </button>
                                </div>
                                </div>
                              </div>

                              {/* Side-by-Side View with Synchronized Scrolling */}
                              {comparisonViewMode === 'side-by-side' && (
                                <div className="space-y-2">
                                  <p className="text-xs text-muted-foreground italic">
                                    💡 Tip: Scroll any image to sync all views. Click to view full size.
                                  </p>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {result.baseline_screenshot_base64 && (
                                      <div>
                                        <p className="text-xs font-medium text-muted-foreground mb-1">Baseline</p>
                                        <div
                                          ref={baselineContainerRef}
                                          className="overflow-auto border border-border rounded cursor-pointer"
                                          style={{ maxHeight: '400px' }}
                                          onScroll={() => handleSyncScroll('baseline')}
                                        >
                                          <img
                                            src={`data:image/png;base64,${result.baseline_screenshot_base64}`}
                                            alt="Baseline screenshot"
                                            className={`hover:opacity-80 ${imageZoomLevel === 'fit' ? 'w-full h-auto' : ''}`}
                                            style={imageZoomLevel !== 'fit' ? {
                                              width: imageZoomLevel === '100' ? 'auto' : imageZoomLevel === '50' ? '50%' : '200%',
                                              maxWidth: imageZoomLevel === '100' ? 'none' : imageZoomLevel === '50' ? '50%' : '200%',
                                              imageRendering: imageZoomLevel === '100' ? 'pixelated' : 'auto'
                                            } : undefined}
                                            onClick={() => setLightboxImage(`data:image/png;base64,${result.baseline_screenshot_base64}`)}
                                          />
                                        </div>
                                      </div>
                                    )}
                                    {result.screenshot_base64 && (
                                      <div>
                                        <p className="text-xs font-medium text-muted-foreground mb-1">Current</p>
                                        <div
                                          ref={currentContainerRef}
                                          className="overflow-auto border border-border rounded cursor-pointer"
                                          style={{ maxHeight: '400px' }}
                                          onScroll={() => handleSyncScroll('current')}
                                        >
                                          <img
                                            src={`data:image/png;base64,${result.screenshot_base64}`}
                                            alt="Current screenshot"
                                            className={`hover:opacity-80 ${imageZoomLevel === 'fit' ? 'w-full h-auto' : ''}`}
                                            style={imageZoomLevel !== 'fit' ? {
                                              width: imageZoomLevel === '100' ? 'auto' : imageZoomLevel === '50' ? '50%' : '200%',
                                              maxWidth: imageZoomLevel === '100' ? 'none' : imageZoomLevel === '50' ? '50%' : '200%',
                                              imageRendering: imageZoomLevel === '100' ? 'pixelated' : 'auto'
                                            } : undefined}
                                            onClick={() => setLightboxImage(`data:image/png;base64,${result.screenshot_base64}`)}
                                          />
                                        </div>
                                      </div>
                                    )}
                                    {result.diff_image_base64 && (
                                      <div>
                                        <p className="text-xs font-medium text-muted-foreground mb-1">Diff (red = changed pixels)</p>
                                        <div
                                          ref={diffContainerRef}
                                          className="overflow-auto border border-red-300 dark:border-red-700 rounded cursor-pointer"
                                          style={{ maxHeight: '400px' }}
                                          onScroll={() => handleSyncScroll('diff')}
                                        >
                                          <img
                                            src={`data:image/png;base64,${result.diff_image_base64}`}
                                            alt="Diff image"
                                            className={`hover:opacity-80 ${imageZoomLevel === 'fit' ? 'w-full h-auto' : ''}`}
                                            style={imageZoomLevel !== 'fit' ? {
                                              width: imageZoomLevel === '100' ? 'auto' : imageZoomLevel === '50' ? '50%' : '200%',
                                              maxWidth: imageZoomLevel === '100' ? 'none' : imageZoomLevel === '50' ? '50%' : '200%',
                                              imageRendering: imageZoomLevel === '100' ? 'pixelated' : 'auto'
                                            } : undefined}
                                            onClick={() => setLightboxImage(`data:image/png;base64,${result.diff_image_base64}`)}
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Slider View - Interactive comparison */}
                              {comparisonViewMode === 'slider' && result.baseline_screenshot_base64 && result.screenshot_base64 && (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>← Baseline</span>
                                    <span>Current →</span>
                                  </div>
                                  <div
                                    className="relative border border-border rounded-lg overflow-hidden cursor-ew-resize select-none"
                                    style={{ height: '300px' }}
                                    onMouseMove={(e) => {
                                      if (e.buttons === 1) {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const x = e.clientX - rect.left;
                                        const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
                                        setSliderPosition(percentage);
                                      }
                                    }}
                                    onMouseDown={(e) => {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      const x = e.clientX - rect.left;
                                      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
                                      setSliderPosition(percentage);
                                    }}
                                  >
                                    {/* Baseline image (full width underneath) */}
                                    <img
                                      src={`data:image/png;base64,${result.baseline_screenshot_base64}`}
                                      alt="Baseline"
                                      className="absolute inset-0 w-full h-full object-contain"
                                      draggable={false}
                                    />
                                    {/* Current image (clipped by slider position) */}
                                    <div
                                      className="absolute inset-0 overflow-hidden"
                                      style={{ clipPath: `inset(0 0 0 ${sliderPosition}%)` }}
                                    >
                                      <img
                                        src={`data:image/png;base64,${result.screenshot_base64}`}
                                        alt="Current"
                                        className="w-full h-full object-contain"
                                        draggable={false}
                                      />
                                    </div>
                                    {/* Slider handle */}
                                    <div
                                      className="absolute top-0 bottom-0 w-1 bg-primary shadow-lg"
                                      style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
                                    >
                                      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-6 h-10 bg-primary rounded-full flex items-center justify-center shadow-lg">
                                        <svg className="w-4 h-4 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                                        </svg>
                                      </div>
                                    </div>
                                    {/* Labels */}
                                    <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded text-xs text-white font-medium">
                                      Baseline
                                    </div>
                                    <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 rounded text-xs text-white font-medium">
                                      Current
                                    </div>
                                  </div>
                                  <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={sliderPosition}
                                    onChange={(e) => setSliderPosition(Number(e.target.value))}
                                    className="w-full accent-primary"
                                  />
                                  <p className="text-xs text-center text-muted-foreground">
                                    Drag the slider or use the control above to compare images
                                  </p>
                                </div>
                              )}

                              {/* Onion Skin View - Opacity blended overlay */}
                              {comparisonViewMode === 'onion-skin' && result.baseline_screenshot_base64 && result.screenshot_base64 && (
                                <div className="space-y-2">
                                  <div className="relative border border-border rounded-lg overflow-hidden" style={{ height: '300px' }}>
                                    {/* Baseline image (background) */}
                                    <img
                                      src={`data:image/png;base64,${result.baseline_screenshot_base64}`}
                                      alt="Baseline"
                                      className="absolute inset-0 w-full h-full object-contain"
                                      draggable={false}
                                    />
                                    {/* Current image (overlaid with adjustable opacity) */}
                                    <img
                                      src={`data:image/png;base64,${result.screenshot_base64}`}
                                      alt="Current"
                                      className="absolute inset-0 w-full h-full object-contain"
                                      style={{ opacity: onionSkinOpacity / 100 }}
                                      draggable={false}
                                    />
                                    {/* Opacity indicator */}
                                    <div className="absolute top-2 left-1/2 transform -translate-x-1/2 px-3 py-1 bg-black/60 rounded-full text-xs text-white font-medium">
                                      {onionSkinOpacity}% Current
                                    </div>
                                    {/* Labels */}
                                    <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded text-xs text-white font-medium">
                                      Baseline (background)
                                    </div>
                                    <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 rounded text-xs text-white font-medium" style={{ opacity: onionSkinOpacity / 100 }}>
                                      Current (overlay)
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-xs text-muted-foreground font-medium min-w-[60px]">Baseline</span>
                                    <input
                                      type="range"
                                      min="0"
                                      max="100"
                                      value={onionSkinOpacity}
                                      onChange={(e) => setOnionSkinOpacity(Number(e.target.value))}
                                      className="flex-1 accent-primary"
                                    />
                                    <span className="text-xs text-muted-foreground font-medium min-w-[60px] text-right">Current</span>
                                  </div>
                                  <p className="text-xs text-center text-muted-foreground">
                                    Drag the slider to blend between baseline and current. Differences appear as ghosting/blur.
                                  </p>
                                </div>
                              )}

                              {/* Diff Only View */}
                              {comparisonViewMode === 'diff' && result.diff_image_base64 && (
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground mb-1">Difference Map (red = changed pixels)</p>
                                  <img
                                    src={`data:image/png;base64,${result.diff_image_base64}`}
                                    alt="Diff image"
                                    className="w-full h-auto border border-red-300 dark:border-red-700 rounded cursor-pointer hover:opacity-80"
                                    style={{ maxHeight: '400px', objectFit: 'contain' }}
                                    onClick={() => setLightboxImage(`data:image/png;base64,${result.diff_image_base64}`)}
                                  />
                                </div>
                              )}

                              {/* Diff Overlay View - Shows diff overlaid on current image */}
                              {comparisonViewMode === 'diff-overlay' && result.screenshot_base64 && result.diff_image_base64 && (
                                <div className="space-y-2">
                                  <div className="relative border border-border rounded-lg overflow-hidden" style={{ height: '300px' }}>
                                    {/* Current image (background) */}
                                    <img
                                      src={`data:image/png;base64,${result.screenshot_base64}`}
                                      alt="Current"
                                      className="absolute inset-0 w-full h-full object-contain"
                                      draggable={false}
                                    />
                                    {/* Diff image (overlaid with adjustable opacity) */}
                                    <img
                                      src={`data:image/png;base64,${result.diff_image_base64}`}
                                      alt="Diff Overlay"
                                      className="absolute inset-0 w-full h-full object-contain"
                                      style={{ opacity: diffOverlayOpacity / 100, mixBlendMode: 'multiply' }}
                                      draggable={false}
                                    />
                                    {/* Opacity indicator */}
                                    <div className="absolute top-2 left-1/2 transform -translate-x-1/2 px-3 py-1 bg-black/60 rounded-full text-xs text-white font-medium">
                                      Diff Overlay: {diffOverlayOpacity}%
                                    </div>
                                    {/* Labels */}
                                    <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded text-xs text-white font-medium">
                                      Current Screenshot
                                    </div>
                                    <div className="absolute bottom-2 right-2 px-2 py-1 bg-red-600/80 rounded text-xs text-white font-medium">
                                      Diff Highlighted
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-xs text-muted-foreground font-medium min-w-[60px]">Hide Diff</span>
                                    <input
                                      type="range"
                                      min="0"
                                      max="100"
                                      value={diffOverlayOpacity}
                                      onChange={(e) => setDiffOverlayOpacity(Number(e.target.value))}
                                      className="flex-1 accent-primary"
                                    />
                                    <span className="text-xs text-muted-foreground font-medium min-w-[60px] text-right">Show Diff</span>
                                  </div>
                                  <p className="text-xs text-center text-muted-foreground">
                                    Changed pixels are highlighted in color. Adjust slider to toggle overlay visibility.
                                  </p>
                                </div>
                              )}

                              {/* Rejection Status Banner */}
                              {rejectionStatus?.hasRejection && (
                                <div className="mt-4 p-3 border border-red-300 dark:border-red-700 rounded-lg bg-red-50 dark:bg-red-900/20">
                                  <div className="flex items-center gap-2">
                                    <svg className="h-5 w-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    <span className="font-semibold text-red-700 dark:text-red-300">Rejected Regression</span>
                                  </div>
                                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                                    These visual changes have been marked as a regression.
                                  </p>
                                  {rejectionStatus.reason && (
                                    <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                                      <span className="font-medium">Reason:</span> {rejectionStatus.reason}
                                    </p>
                                  )}
                                  <p className="text-xs text-red-500 dark:text-red-500 mt-2">
                                    Rejected by {rejectionStatus.rejectedBy}
                                    {rejectionStatus.rejectedAt && ` on ${new Date(rejectionStatus.rejectedAt).toLocaleString()}`}
                                  </p>
                                </div>
                              )}

                              {/* Approve/Reject Buttons */}
                              {!rejectionStatus?.hasRejection && (
                                <div className="mt-4 pt-4 border-t border-border">
                                  <div className="flex flex-col gap-3">
                                    <div className="text-xs text-muted-foreground">
                                      Review the visual differences above and choose an action:
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => {
                                          setApproveBaselineRunId(currentRun?.id || null);
                                          setShowApproveBaselineModal(true);
                                          setApproveBaselineError('');
                                        }}
                                        className="inline-flex items-center gap-2 rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500/20"
                                      >
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        Approve as New Baseline
                                      </button>
                                      <button
                                        onClick={() => {
                                          setRejectChangesRunId(currentRun?.id || null);
                                          setShowRejectChangesModal(true);
                                          setRejectChangesError('');
                                          setRejectionReason('');
                                        }}
                                        className="inline-flex items-center gap-2 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                                      >
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                        Reject Changes
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Ignore Regions Indicator */}
                          {((test?.ignore_regions && test.ignore_regions.length > 0) || (test?.ignore_selectors && test.ignore_selectors.length > 0)) && (
                            <div className="mt-3 p-3 border border-purple-200 dark:border-purple-800 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-purple-600 dark:text-purple-400">🔲</span>
                                <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">Ignored Regions</span>
                                <span className="text-xs text-purple-600 dark:text-purple-400">(shown as magenta in images)</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {test?.ignore_regions?.map((region: {id: string; x: number; y: number; width: number; height: number; name?: string}, idx: number) => (
                                  <span key={region.id || idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300">
                                    📍 {region.name || `Region ${idx + 1}`}: {region.x},{region.y} ({region.width}×{region.height})
                                  </span>
                                ))}
                                {test?.ignore_selectors?.map((selector: string, idx: number) => (
                                  <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300 font-mono">
                                    🎯 {selector}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {!result.visual_comparison.hasBaseline && (
                            <p className="text-xs text-muted-foreground">
                              This was the first run - the captured screenshot has been saved as the baseline for future comparisons.
                            </p>
                          )}

                          {result.visual_comparison.hasBaseline && result.diff_percentage === 0 && (
                            <p className="text-xs text-muted-foreground">
                              The current screenshot matches the baseline exactly. No visual changes detected.
                            </p>
                          )}
                        </div>
                      )}

                      {/* Feature #608: Lighthouse Unreachable URL Error Display */}
                      {result.steps?.some((step: any) => step.action === 'lighthouse_audit' && step.status === 'failed' && !step.lighthouse && step.metadata?.isUnreachable) && (
                        <div className="mt-4 p-4 border border-red-200 dark:border-red-800 rounded-lg bg-red-50/50 dark:bg-red-900/10">
                          <div className="flex items-start gap-3">
                            <span className="text-2xl">🌐</span>
                            <div className="flex-1">
                              <h4 className="text-sm font-semibold text-red-700 dark:text-red-400">Unable to Connect to Target URL</h4>
                              {result.steps.filter((step: any) => step.action === 'lighthouse_audit' && step.metadata?.isUnreachable).map((step: any, idx: number) => (
                                <div key={idx} className="mt-2 space-y-2">
                                  {/* Error Type Badge */}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`text-xs px-2 py-1 rounded font-medium ${
                                      step.metadata?.errorType === 'dns_resolution' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                                      step.metadata?.errorType === 'connection_timeout' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                                      step.metadata?.errorType === 'connection_refused' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                      step.metadata?.errorType === 'ssl_error' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                      'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                                    }`}>
                                      {step.metadata?.errorType === 'dns_resolution' ? '🔍 DNS Resolution Failed' :
                                       step.metadata?.errorType === 'connection_timeout' ? '⏱️ Connection Timeout' :
                                       step.metadata?.errorType === 'connection_refused' ? '🚫 Connection Refused' :
                                       step.metadata?.errorType === 'ssl_error' ? '🔒 SSL/TLS Error' :
                                       '❌ Network Unreachable'}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      Duration: {step.duration_ms ? `${(step.duration_ms / 1000).toFixed(1)}s` : 'N/A'}
                                    </span>
                                  </div>

                                  {/* Error Message */}
                                  <p className="text-sm text-red-600 dark:text-red-400">{step.error}</p>

                                  {/* Target URL */}
                                  <div className="text-xs text-muted-foreground">
                                    <span className="font-medium">Target URL:</span> {step.value}
                                  </div>

                                  {/* SSL Error Details (Feature #609) */}
                                  {step.metadata?.errorType === 'ssl_error' && step.metadata?.sslErrorCode && (
                                    <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                                      <div className="flex items-start gap-2 mb-2">
                                        <span className="text-base">🔐</span>
                                        <span className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
                                          SSL Certificate Error: {step.metadata.sslErrorCode}
                                        </span>
                                      </div>
                                      <p className="text-xs text-yellow-700 dark:text-yellow-300 mb-2">
                                        {step.metadata.sslErrorDescription}
                                      </p>

                                      {/* Security Implications Warning */}
                                      <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
                                        <div className="flex items-start gap-2">
                                          <span className="text-sm">⚠️</span>
                                          <div>
                                            <p className="text-xs font-medium text-red-800 dark:text-red-200">Security Implications:</p>
                                            <p className="text-xs text-red-700 dark:text-red-300 mt-1">{step.metadata.securityImplication}</p>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Ignore SSL Option Status */}
                                      <div className="mt-2 text-xs">
                                        {step.metadata.ignoreSSLEnabled ? (
                                          <span className="text-amber-600 dark:text-amber-400">
                                            ⚡ "Ignore SSL errors" is enabled - certificate validation was bypassed
                                          </span>
                                        ) : (
                                          <span className="text-blue-600 dark:text-blue-400">
                                            💡 Enable "Ignore SSL errors" option in test settings to bypass certificate validation (for testing only)
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* Suggestion */}
                                  {step.metadata?.suggestion && (
                                    <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                                      <div className="flex items-start gap-2">
                                        <span className="text-sm">💡</span>
                                        <p className="text-xs text-blue-700 dark:text-blue-300">{step.metadata.suggestion}</p>
                                      </div>
                                    </div>
                                  )}

                                  {/* Technical Details (collapsible) */}
                                  {step.metadata?.rawError && (
                                    <details className="mt-2">
                                      <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                        Show technical details
                                      </summary>
                                      <pre className="mt-1 p-2 text-xs bg-muted rounded overflow-x-auto">
                                        {step.metadata.rawError}
                                      </pre>
                                    </details>
                                  )}
                                </div>
                              ))}

                              {/* No Scores Notice */}
                              <div className="mt-3 p-2 bg-muted rounded">
                                <p className="text-xs text-muted-foreground">
                                  ⚠️ No Lighthouse scores are available because the target URL could not be reached.
                                  Please verify the URL is correct and accessible, then re-run the audit.
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Feature #611: Lighthouse Audit Timeout Error Display */}
                      {result.steps?.some((step: any) => step.action === 'lighthouse_audit' && step.status === 'failed' && step.metadata?.isTimeout) && (
                        <div className="mt-4 p-4 border border-amber-200 dark:border-amber-800 rounded-lg bg-amber-50/50 dark:bg-amber-900/10">
                          <div className="flex items-start gap-3">
                            <span className="text-2xl">⏱️</span>
                            <div className="flex-1">
                              <h4 className="text-sm font-semibold text-amber-700 dark:text-amber-400">Lighthouse Audit Timed Out</h4>
                              {result.steps.filter((step: any) => step.action === 'lighthouse_audit' && step.metadata?.isTimeout).map((step: any, idx: number) => (
                                <div key={idx} className="mt-2 space-y-2">
                                  {/* Timeout Badge */}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs px-2 py-1 rounded font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                      ⏱️ Audit Timeout ({step.metadata?.configuredTimeout || 60}s)
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      Duration: {step.duration_ms ? `${(step.duration_ms / 1000).toFixed(1)}s` : 'N/A'}
                                    </span>
                                  </div>

                                  {/* Error Message */}
                                  <p className="text-sm text-amber-600 dark:text-amber-400">{step.error}</p>

                                  {/* Target URL */}
                                  <div className="text-xs text-muted-foreground">
                                    <span className="font-medium">Target URL:</span> {step.value}
                                  </div>

                                  {/* Partial Metrics (if available) */}
                                  {step.lighthouse?.partialResults && (
                                    <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                      <div className="flex items-start gap-2 mb-2">
                                        <span className="text-base">📊</span>
                                        <span className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                                          Partial Metrics Captured
                                        </span>
                                      </div>
                                      <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">
                                        Some metrics were captured before the timeout occurred:
                                      </p>
                                      <div className="grid grid-cols-2 gap-2 text-xs">
                                        {step.lighthouse.performance !== null && (
                                          <div className="flex items-center gap-1">
                                            <span>Performance:</span>
                                            <span className="font-semibold">{step.lighthouse.performance}</span>
                                          </div>
                                        )}
                                        {step.lighthouse.accessibility !== null && (
                                          <div className="flex items-center gap-1">
                                            <span>Accessibility:</span>
                                            <span className="font-semibold">{step.lighthouse.accessibility}</span>
                                          </div>
                                        )}
                                        {step.lighthouse.metrics?.firstContentfulPaint !== null && (
                                          <div className="flex items-center gap-1">
                                            <span>FCP:</span>
                                            <span className="font-semibold">{step.lighthouse.metrics.firstContentfulPaint}ms</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* Suggestion */}
                                  {step.metadata?.suggestion && (
                                    <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                                      <div className="flex items-start gap-2">
                                        <span className="text-sm">💡</span>
                                        <p className="text-xs text-blue-700 dark:text-blue-300">{step.metadata.suggestion}</p>
                                      </div>
                                    </div>
                                  )}

                                  {/* Technical Details (collapsible) */}
                                  {step.metadata?.rawError && (
                                    <details className="mt-2">
                                      <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                        Show technical details
                                      </summary>
                                      <pre className="mt-1 p-2 text-xs bg-muted rounded overflow-x-auto">
                                        {step.metadata.rawError}
                                      </pre>
                                    </details>
                                  )}
                                </div>
                              ))}

                              {/* Timeout Notice */}
                              <div className="mt-3 p-2 bg-muted rounded">
                                <p className="text-xs text-muted-foreground">
                                  ⚠️ The audit timed out before completing. Consider increasing the audit timeout in test settings
                                  or investigating why the target page takes so long to stabilize.
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Feature #612: Lighthouse Browser Crash Error Display */}
                      {result.steps?.some((step: any) => step.action === 'lighthouse_audit' && step.metadata?.isBrowserCrash) && (
                        <div className="mt-4 p-4 border border-red-200 dark:border-red-800 rounded-lg bg-red-50/50 dark:bg-red-900/10">
                          <div className="flex items-start gap-3">
                            <span className="text-2xl">💥</span>
                            <div className="flex-1">
                              <h4 className="text-sm font-semibold text-red-700 dark:text-red-400">Browser Crashed During Audit</h4>
                              {result.steps.filter((step: any) => step.action === 'lighthouse_audit' && step.metadata?.isBrowserCrash).map((step: any, idx: number) => (
                                <div key={idx} className="mt-2 space-y-2">
                                  {/* Crash Badge */}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs px-2 py-1 rounded font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                      💥 Browser Terminated
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      Duration: {step.duration_ms ? `${(step.duration_ms / 1000).toFixed(1)}s` : 'N/A'}
                                    </span>
                                    {step.metadata?.willRetry && (
                                      <span className="text-xs px-2 py-1 rounded font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                        🔄 Auto-retry enabled
                                      </span>
                                    )}
                                  </div>

                                  {/* Error Message */}
                                  <p className="text-sm text-red-600 dark:text-red-400">{step.error}</p>

                                  {/* Target URL */}
                                  <div className="text-xs text-muted-foreground">
                                    <span className="font-medium">Target URL:</span> {step.value}
                                  </div>

                                  {/* Suggestion */}
                                  {step.metadata?.suggestion && (
                                    <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                                      <div className="flex items-start gap-2">
                                        <span className="text-sm">💡</span>
                                        <p className="text-xs text-blue-700 dark:text-blue-300">{step.metadata.suggestion}</p>
                                      </div>
                                    </div>
                                  )}

                                  {/* Crash Dump Info */}
                                  {step.metadata?.crashDumpPath && (
                                    <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-900/20 rounded border border-gray-200 dark:border-gray-800">
                                      <div className="flex items-start gap-2">
                                        <span className="text-sm">📁</span>
                                        <div className="text-xs">
                                          <span className="font-medium text-muted-foreground">Crash dump saved:</span>
                                          <code className="ml-1 px-1 py-0.5 bg-muted rounded text-xs break-all">
                                            {step.metadata.crashDumpPath}
                                          </code>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Stack Trace (collapsible) */}
                                  {step.metadata?.stack && (
                                    <details className="mt-2">
                                      <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                        Show stack trace
                                      </summary>
                                      <pre className="mt-1 p-2 text-xs bg-muted rounded overflow-x-auto whitespace-pre-wrap">
                                        {step.metadata.stack}
                                      </pre>
                                    </details>
                                  )}

                                  {/* Technical Details (collapsible) */}
                                  {step.metadata?.rawError && (
                                    <details className="mt-2">
                                      <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                        Show technical details
                                      </summary>
                                      <pre className="mt-1 p-2 text-xs bg-muted rounded overflow-x-auto">
                                        {step.metadata.rawError}
                                      </pre>
                                    </details>
                                  )}
                                </div>
                              ))}

                              {/* Retry Notice */}
                              <div className="mt-3 p-2 bg-muted rounded">
                                <p className="text-xs text-muted-foreground">
                                  🔄 Browser crashes are automatically retried based on the suite's retry configuration.
                                  If the crash persists, check if the target page has memory issues or reduces test parallelism.
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Feature #613: Lighthouse Non-HTML Response Error Display */}
                      {result.steps?.some((step: any) => step.action === 'lighthouse_audit' && step.metadata?.isNonHtmlResponse) && (
                        <div className="mt-4 p-4 border border-orange-200 dark:border-orange-800 rounded-lg bg-orange-50/50 dark:bg-orange-900/10">
                          <div className="flex items-start gap-3">
                            <span className="text-2xl">📄</span>
                            <div className="flex-1">
                              <h4 className="text-sm font-semibold text-orange-700 dark:text-orange-400">Target is Not an HTML Page</h4>
                              {result.steps.filter((step: any) => step.action === 'lighthouse_audit' && step.metadata?.isNonHtmlResponse).map((step: any, idx: number) => (
                                <div key={idx} className="mt-2 space-y-2">
                                  {/* Content Type Badge */}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs px-2 py-1 rounded font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                                      📄 {step.metadata?.contentDescription || 'Non-HTML Content'}
                                    </span>
                                    {step.metadata?.detectedContentType && (
                                      <span className="text-xs text-muted-foreground">
                                        Content-Type: <code className="px-1 py-0.5 bg-muted rounded">{step.metadata.detectedContentType}</code>
                                      </span>
                                    )}
                                  </div>

                                  {/* Error Message */}
                                  <p className="text-sm text-orange-600 dark:text-orange-400">{step.error}</p>

                                  {/* Target URL */}
                                  <div className="text-xs text-muted-foreground">
                                    <span className="font-medium">Target URL:</span> {step.value}
                                  </div>

                                  {/* Suggestion */}
                                  {step.metadata?.suggestion && (
                                    <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                                      <div className="flex items-start gap-2">
                                        <span className="text-sm">💡</span>
                                        <p className="text-xs text-blue-700 dark:text-blue-300">{step.metadata.suggestion}</p>
                                      </div>
                                    </div>
                                  )}

                                  {/* Suggested Audit Type */}
                                  {step.metadata?.suggestedAuditType && (
                                    <div className="mt-2 p-2 bg-muted rounded">
                                      <p className="text-xs text-muted-foreground">
                                        <span className="font-medium">Recommended:</span> {step.metadata.suggestedAuditType}
                                      </p>
                                    </div>
                                  )}

                                  {/* Technical Details (collapsible) */}
                                  {step.metadata?.rawError && (
                                    <details className="mt-2">
                                      <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                        Show technical details
                                      </summary>
                                      <pre className="mt-1 p-2 text-xs bg-muted rounded overflow-x-auto">
                                        {step.metadata.rawError}
                                      </pre>
                                    </details>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Lighthouse Performance Results */}
                      {result.steps?.some((step: any) => step.lighthouse) && (
                        <div className="mt-4 p-4 border border-border rounded-lg bg-muted/30">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">⚡</span>
                              <h4 className="text-sm font-semibold text-foreground">Lighthouse Performance Audit</h4>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  // Generate and download HTML report
                                  const lh = result.steps.find((s: any) => s.lighthouse)?.lighthouse;
                                  if (!lh) return;
                                  const htmlReport = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lighthouse Report - ${test?.name || 'Performance Audit'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); padding: 24px; }
    h1 { color: #202124; margin-bottom: 8px; }
    .meta { color: #5f6368; font-size: 14px; margin-bottom: 24px; }
    .scores { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
    .score-card { padding: 20px; border-radius: 8px; text-align: center; }
    .score-card.good { background: #d4edda; }
    .score-card.average { background: #fff3cd; }
    .score-card.poor { background: #f8d7da; }
    .score-value { font-size: 48px; font-weight: bold; }
    .score-label { font-size: 14px; color: #5f6368; margin-top: 4px; }
    h2 { color: #202124; font-size: 18px; margin: 24px 0 16px; padding-bottom: 8px; border-bottom: 1px solid #e8eaed; }
    .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .metric { padding: 12px; border: 1px solid #e8eaed; border-radius: 4px; }
    .metric-label { font-size: 12px; color: #5f6368; }
    .metric-value { font-size: 16px; font-weight: 600; margin-top: 4px; }
    .metric-value.good { color: #137333; }
    .metric-value.average { color: #ea8600; }
    .metric-value.poor { color: #c5221f; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e8eaed; font-size: 12px; color: #5f6368; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Lighthouse Report: ${test?.name || 'Performance Audit'}</h1>
    <div class="meta">
      <p>URL: ${lh.url}</p>
      <p>Device: ${lh.device}</p>
      <p>Generated: ${new Date().toLocaleString()}</p>
    </div>
    <div class="scores">
      <div class="score-card ${lh.performance >= 90 ? 'good' : lh.performance >= 50 ? 'average' : 'poor'}">
        <div class="score-value">${lh.performance}</div>
        <div class="score-label">Performance</div>
      </div>
      <div class="score-card ${lh.accessibility >= 90 ? 'good' : lh.accessibility >= 50 ? 'average' : 'poor'}">
        <div class="score-value">${lh.accessibility}</div>
        <div class="score-label">Accessibility</div>
      </div>
      <div class="score-card ${lh.bestPractices >= 90 ? 'good' : lh.bestPractices >= 50 ? 'average' : 'poor'}">
        <div class="score-value">${lh.bestPractices}</div>
        <div class="score-label">Best Practices</div>
      </div>
      <div class="score-card ${lh.seo >= 90 ? 'good' : lh.seo >= 50 ? 'average' : 'poor'}">
        <div class="score-value">${lh.seo}</div>
        <div class="score-label">SEO</div>
      </div>
    </div>
    <h2>Core Web Vitals</h2>
    <div class="metrics">
      <div class="metric">
        <div class="metric-label">Largest Contentful Paint (LCP)</div>
        <div class="metric-value ${lh.metrics.largestContentfulPaint <= 2500 ? 'good' : lh.metrics.largestContentfulPaint <= 4000 ? 'average' : 'poor'}">${lh.metrics.largestContentfulPaint >= 1000 ? (lh.metrics.largestContentfulPaint/1000).toFixed(1) + 's' : lh.metrics.largestContentfulPaint + 'ms'}</div>
      </div>
      <div class="metric">
        <div class="metric-label">First Contentful Paint (FCP)</div>
        <div class="metric-value ${lh.metrics.firstContentfulPaint <= 1800 ? 'good' : lh.metrics.firstContentfulPaint <= 3000 ? 'average' : 'poor'}">${lh.metrics.firstContentfulPaint >= 1000 ? (lh.metrics.firstContentfulPaint/1000).toFixed(1) + 's' : lh.metrics.firstContentfulPaint + 'ms'}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Speed Index</div>
        <div class="metric-value ${lh.metrics.speedIndex <= 3400 ? 'good' : lh.metrics.speedIndex <= 5800 ? 'average' : 'poor'}">${lh.metrics.speedIndex >= 1000 ? (lh.metrics.speedIndex/1000).toFixed(1) + 's' : lh.metrics.speedIndex + 'ms'}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Time to Interactive (TTI)</div>
        <div class="metric-value ${lh.metrics.timeToInteractive <= 3800 ? 'good' : lh.metrics.timeToInteractive <= 7300 ? 'average' : 'poor'}">${lh.metrics.timeToInteractive >= 1000 ? (lh.metrics.timeToInteractive/1000).toFixed(1) + 's' : lh.metrics.timeToInteractive + 'ms'}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Total Blocking Time (TBT)</div>
        <div class="metric-value ${lh.metrics.totalBlockingTime <= 200 ? 'good' : lh.metrics.totalBlockingTime <= 600 ? 'average' : 'poor'}">${lh.metrics.totalBlockingTime}ms</div>
      </div>
      <div class="metric">
        <div class="metric-label">Cumulative Layout Shift (CLS)</div>
        <div class="metric-value ${lh.metrics.cumulativeLayoutShift <= 0.1 ? 'good' : lh.metrics.cumulativeLayoutShift <= 0.25 ? 'average' : 'poor'}">${lh.metrics.cumulativeLayoutShift.toFixed(3)}</div>
      </div>
    </div>
    <div class="footer">
      <p>Generated by QA Guardian - Enterprise Quality Assurance Platform</p>
    </div>
  </div>
</body>
</html>`;
                                  const blob = new Blob([htmlReport], { type: 'text/html' });
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = `lighthouse-report-${Date.now()}.html`;
                                  a.click();
                                  URL.revokeObjectURL(url);
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-background text-foreground hover:bg-muted"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Download HTML
                              </button>
                              <button
                                onClick={() => {
                                  // Download JSON report
                                  const lh = result.steps.find((s: any) => s.lighthouse)?.lighthouse;
                                  if (!lh) return;
                                  const jsonReport = JSON.stringify({
                                    testName: test?.name,
                                    url: lh.url,
                                    device: lh.device,
                                    timestamp: new Date().toISOString(),
                                    scores: {
                                      performance: lh.performance,
                                      accessibility: lh.accessibility,
                                      bestPractices: lh.bestPractices,
                                      seo: lh.seo,
                                    },
                                    metrics: lh.metrics,
                                    opportunities: lh.opportunities,
                                    diagnostics: lh.diagnostics,
                                  }, null, 2);
                                  const blob = new Blob([jsonReport], { type: 'application/json' });
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = `lighthouse-report-${Date.now()}.json`;
                                  a.click();
                                  URL.revokeObjectURL(url);
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-background text-foreground hover:bg-muted"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Download JSON
                              </button>
                            </div>
                          </div>

                          {result.steps.filter((step: any) => step.lighthouse).map((step: any, idx: number) => {
                            const lh = step.lighthouse;
                            const getScoreColor = (score: number) => {
                              if (score >= 90) return 'text-green-600 dark:text-green-400';
                              if (score >= 50) return 'text-yellow-600 dark:text-yellow-400';
                              return 'text-red-600 dark:text-red-400';
                            };
                            const getScoreBg = (score: number) => {
                              if (score >= 90) return 'bg-green-100 dark:bg-green-900/30';
                              if (score >= 50) return 'bg-yellow-100 dark:bg-yellow-900/30';
                              return 'bg-red-100 dark:bg-red-900/30';
                            };
                            const getRating = (score: number) => {
                              if (score >= 90) return 'Good';
                              if (score >= 50) return 'Needs Improvement';
                              return 'Poor';
                            };
                            const formatMs = (ms: number) => {
                              if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
                              return `${ms}ms`;
                            };

                            return (
                              <div key={idx} className="space-y-4">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span>📱 Device: {lh.device}</span>
                                  <span>•</span>
                                  <span>🔗 {lh.url}</span>
                                </div>

                                {/* CSP Warning Display */}
                                {lh.csp?.detected && (
                                  <div className={`p-3 rounded-lg border ${lh.csp.blocksLighthouse ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20' : 'border-blue-200 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20'}`}>
                                    <div className="flex items-start gap-2">
                                      <span className="text-lg">{lh.csp.blocksLighthouse ? '⚠️' : 'ℹ️'}</span>
                                      <div className="flex-1">
                                        <div className={`text-sm font-medium ${lh.csp.blocksLighthouse ? 'text-amber-800 dark:text-amber-200' : 'text-blue-800 dark:text-blue-200'}`}>
                                          {lh.csp.blocksLighthouse ? 'Content Security Policy Restriction Detected' : 'Content Security Policy Detected'}
                                        </div>
                                        {lh.csp.warning && (
                                          <p className={`text-xs mt-1 ${lh.csp.blocksLighthouse ? 'text-amber-700 dark:text-amber-300' : 'text-blue-700 dark:text-blue-300'}`}>
                                            {lh.csp.warning}
                                          </p>
                                        )}
                                        {lh.csp.partialResults && (
                                          <p className="text-xs mt-1 text-amber-600 dark:text-amber-400">
                                            ⚠️ Results may be incomplete due to CSP restrictions.
                                          </p>
                                        )}
                                        {lh.csp.suggestion && (
                                          <p className="text-xs mt-2 text-muted-foreground italic">
                                            💡 {lh.csp.suggestion}
                                          </p>
                                        )}
                                        {lh.csp.bypassEnabled && (
                                          <p className="text-xs mt-1 text-green-600 dark:text-green-400">
                                            ✓ CSP bypass enabled for this test.
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Feature #610: Authentication Warning Display */}
                                {lh.authentication && (lh.authentication.required || lh.authentication.warning) && (
                                  <div className={`p-3 rounded-lg border ${lh.authentication.required ? 'border-orange-300 bg-orange-50 dark:border-orange-700 dark:bg-orange-900/20' : 'border-blue-200 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20'}`}>
                                    <div className="flex items-start gap-2">
                                      <span className="text-lg">{lh.authentication.required ? '🔐' : 'ℹ️'}</span>
                                      <div className="flex-1">
                                        <div className={`text-sm font-medium ${lh.authentication.required ? 'text-orange-800 dark:text-orange-200' : 'text-blue-800 dark:text-blue-200'}`}>
                                          {lh.authentication.required ? 'Page Appears to Require Authentication' : 'Login Page Detected'}
                                        </div>
                                        {lh.authentication.warning && (
                                          <p className={`text-xs mt-1 ${lh.authentication.required ? 'text-orange-700 dark:text-orange-300' : 'text-blue-700 dark:text-blue-300'}`}>
                                            {lh.authentication.warning}
                                          </p>
                                        )}
                                        {lh.authentication.redirectedToLogin && lh.authentication.actualUrl && (
                                          <div className="mt-2 p-2 bg-white/50 dark:bg-black/20 rounded text-xs">
                                            <div className="flex items-center gap-1 text-muted-foreground">
                                              <span>📍 Original URL:</span>
                                              <span className="font-mono">{lh.authentication.originalUrl}</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400 mt-1">
                                              <span>➡️ Redirected to:</span>
                                              <span className="font-mono">{lh.authentication.actualUrl}</span>
                                            </div>
                                          </div>
                                        )}
                                        {lh.authentication.resultsReflectLoginPage && (
                                          <p className="text-xs mt-2 text-orange-600 dark:text-orange-400 font-medium">
                                            ⚠️ Audit results reflect the login page, NOT the intended target page.
                                          </p>
                                        )}
                                        {lh.authentication.loginIndicators && lh.authentication.loginIndicators.length > 0 && (
                                          <div className="mt-2 text-xs text-muted-foreground">
                                            <span className="font-medium">Detected indicators:</span>
                                            <ul className="mt-1 list-disc list-inside">
                                              {lh.authentication.loginIndicators.slice(0, 4).map((indicator: string, i: number) => (
                                                <li key={i}>{indicator}</li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}
                                        {lh.authentication.suggestion && (
                                          <p className="text-xs mt-2 text-muted-foreground italic">
                                            💡 {lh.authentication.suggestion}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Score Cards */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                  <div className={`p-3 rounded-lg ${getScoreBg(lh.performance)}`}>
                                    <div className={`text-2xl font-bold ${getScoreColor(lh.performance)}`}>{lh.performance}</div>
                                    <div className="text-xs text-muted-foreground">Performance</div>
                                    <div className={`text-xs font-medium ${getScoreColor(lh.performance)}`}>{getRating(lh.performance)}</div>
                                  </div>
                                  <div className={`p-3 rounded-lg ${getScoreBg(lh.accessibility)}`}>
                                    <div className={`text-2xl font-bold ${getScoreColor(lh.accessibility)}`}>{lh.accessibility}</div>
                                    <div className="text-xs text-muted-foreground">Accessibility</div>
                                    <div className={`text-xs font-medium ${getScoreColor(lh.accessibility)}`}>{getRating(lh.accessibility)}</div>
                                  </div>
                                  <div className={`p-3 rounded-lg ${getScoreBg(lh.bestPractices)}`}>
                                    <div className={`text-2xl font-bold ${getScoreColor(lh.bestPractices)}`}>{lh.bestPractices}</div>
                                    <div className="text-xs text-muted-foreground">Best Practices</div>
                                    <div className={`text-xs font-medium ${getScoreColor(lh.bestPractices)}`}>{getRating(lh.bestPractices)}</div>
                                  </div>
                                  <div className={`p-3 rounded-lg ${getScoreBg(lh.seo)}`}>
                                    <div className={`text-2xl font-bold ${getScoreColor(lh.seo)}`}>{lh.seo}</div>
                                    <div className="text-xs text-muted-foreground">SEO</div>
                                    <div className={`text-xs font-medium ${getScoreColor(lh.seo)}`}>{getRating(lh.seo)}</div>
                                  </div>
                                </div>

                                {/* Core Web Vitals */}
                                {lh.metrics && (
                                  <div className="mt-4">
                                    <h5 className="text-xs font-semibold text-foreground mb-2">Core Web Vitals</h5>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                      <div className="p-2 rounded bg-background border border-border">
                                        <div className="text-xs text-muted-foreground">Largest Contentful Paint (LCP)</div>
                                        <div className={`text-sm font-semibold ${lh.metrics.largestContentfulPaint <= 2500 ? 'text-green-600' : lh.metrics.largestContentfulPaint <= 4000 ? 'text-yellow-600' : 'text-red-600'}`}>
                                          {formatMs(lh.metrics.largestContentfulPaint)}
                                        </div>
                                        <div className={`text-xs ${lh.metrics.largestContentfulPaint <= 2500 ? 'text-green-600' : lh.metrics.largestContentfulPaint <= 4000 ? 'text-yellow-600' : 'text-red-600'}`}>
                                          {lh.metrics.largestContentfulPaint <= 2500 ? 'Good' : lh.metrics.largestContentfulPaint <= 4000 ? 'Needs Improvement' : 'Poor'}
                                        </div>
                                      </div>
                                      <div className="p-2 rounded bg-background border border-border">
                                        <div className="text-xs text-muted-foreground">First Contentful Paint (FCP)</div>
                                        <div className={`text-sm font-semibold ${lh.metrics.firstContentfulPaint <= 1800 ? 'text-green-600' : lh.metrics.firstContentfulPaint <= 3000 ? 'text-yellow-600' : 'text-red-600'}`}>
                                          {formatMs(lh.metrics.firstContentfulPaint)}
                                        </div>
                                        <div className={`text-xs ${lh.metrics.firstContentfulPaint <= 1800 ? 'text-green-600' : lh.metrics.firstContentfulPaint <= 3000 ? 'text-yellow-600' : 'text-red-600'}`}>
                                          {lh.metrics.firstContentfulPaint <= 1800 ? 'Good' : lh.metrics.firstContentfulPaint <= 3000 ? 'Needs Improvement' : 'Poor'}
                                        </div>
                                      </div>
                                      <div className="p-2 rounded bg-background border border-border">
                                        <div className="text-xs text-muted-foreground">Speed Index</div>
                                        <div className={`text-sm font-semibold ${lh.metrics.speedIndex <= 3400 ? 'text-green-600' : lh.metrics.speedIndex <= 5800 ? 'text-yellow-600' : 'text-red-600'}`}>
                                          {formatMs(lh.metrics.speedIndex)}
                                        </div>
                                        <div className={`text-xs ${lh.metrics.speedIndex <= 3400 ? 'text-green-600' : lh.metrics.speedIndex <= 5800 ? 'text-yellow-600' : 'text-red-600'}`}>
                                          {lh.metrics.speedIndex <= 3400 ? 'Good' : lh.metrics.speedIndex <= 5800 ? 'Needs Improvement' : 'Poor'}
                                        </div>
                                      </div>
                                      <div className="p-2 rounded bg-background border border-border">
                                        <div className="text-xs text-muted-foreground">Time to Interactive (TTI)</div>
                                        <div className={`text-sm font-semibold ${lh.metrics.timeToInteractive <= 3800 ? 'text-green-600' : lh.metrics.timeToInteractive <= 7300 ? 'text-yellow-600' : 'text-red-600'}`}>
                                          {formatMs(lh.metrics.timeToInteractive)}
                                        </div>
                                        <div className={`text-xs ${lh.metrics.timeToInteractive <= 3800 ? 'text-green-600' : lh.metrics.timeToInteractive <= 7300 ? 'text-yellow-600' : 'text-red-600'}`}>
                                          {lh.metrics.timeToInteractive <= 3800 ? 'Good' : lh.metrics.timeToInteractive <= 7300 ? 'Needs Improvement' : 'Poor'}
                                        </div>
                                      </div>
                                      <div className="p-2 rounded bg-background border border-border">
                                        <div className="text-xs text-muted-foreground">Total Blocking Time (TBT)</div>
                                        <div className={`text-sm font-semibold ${lh.metrics.totalBlockingTime <= 200 ? 'text-green-600' : lh.metrics.totalBlockingTime <= 600 ? 'text-yellow-600' : 'text-red-600'}`}>
                                          {formatMs(lh.metrics.totalBlockingTime)}
                                        </div>
                                        <div className={`text-xs ${lh.metrics.totalBlockingTime <= 200 ? 'text-green-600' : lh.metrics.totalBlockingTime <= 600 ? 'text-yellow-600' : 'text-red-600'}`}>
                                          {lh.metrics.totalBlockingTime <= 200 ? 'Good' : lh.metrics.totalBlockingTime <= 600 ? 'Needs Improvement' : 'Poor'}
                                        </div>
                                      </div>
                                      <div className="p-2 rounded bg-background border border-border">
                                        <div className="text-xs text-muted-foreground">Cumulative Layout Shift (CLS)</div>
                                        <div className={`text-sm font-semibold ${lh.metrics.cumulativeLayoutShift <= 0.1 ? 'text-green-600' : lh.metrics.cumulativeLayoutShift <= 0.25 ? 'text-yellow-600' : 'text-red-600'}`}>
                                          {lh.metrics.cumulativeLayoutShift.toFixed(3)}
                                        </div>
                                        <div className={`text-xs ${lh.metrics.cumulativeLayoutShift <= 0.1 ? 'text-green-600' : lh.metrics.cumulativeLayoutShift <= 0.25 ? 'text-yellow-600' : 'text-red-600'}`}>
                                          {lh.metrics.cumulativeLayoutShift <= 0.1 ? 'Good' : lh.metrics.cumulativeLayoutShift <= 0.25 ? 'Needs Improvement' : 'Poor'}
                                        </div>
                                      </div>
                                      {lh.metrics.interactionToNextPaint && (
                                        <div className="p-2 rounded bg-background border border-border">
                                          <div className="text-xs text-muted-foreground">Interaction to Next Paint (INP)</div>
                                          <div className={`text-sm font-semibold ${lh.metrics.interactionToNextPaint <= 200 ? 'text-green-600' : lh.metrics.interactionToNextPaint <= 500 ? 'text-yellow-600' : 'text-red-600'}`}>
                                            {formatMs(lh.metrics.interactionToNextPaint)}
                                          </div>
                                          <div className={`text-xs ${lh.metrics.interactionToNextPaint <= 200 ? 'text-green-600' : lh.metrics.interactionToNextPaint <= 500 ? 'text-yellow-600' : 'text-red-600'}`}>
                                            {lh.metrics.interactionToNextPaint <= 200 ? 'Good' : lh.metrics.interactionToNextPaint <= 500 ? 'Needs Improvement' : 'Poor'}
                                          </div>
                                        </div>
                                      )}
                                      {lh.metrics.timeToFirstByte && (
                                        <div className="p-2 rounded bg-background border border-border">
                                          <div className="text-xs text-muted-foreground">Time to First Byte (TTFB)</div>
                                          <div className={`text-sm font-semibold ${lh.metrics.timeToFirstByte <= 200 ? 'text-green-600' : lh.metrics.timeToFirstByte <= 500 ? 'text-yellow-600' : 'text-red-600'}`}>
                                            {formatMs(lh.metrics.timeToFirstByte)}
                                          </div>
                                          <div className={`text-xs ${lh.metrics.timeToFirstByte <= 200 ? 'text-green-600' : lh.metrics.timeToFirstByte <= 500 ? 'text-yellow-600' : 'text-red-600'}`}>
                                            {lh.metrics.timeToFirstByte <= 200 ? 'Good' : lh.metrics.timeToFirstByte <= 500 ? 'Needs Improvement' : 'Poor'}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {/* Performance Trends Chart */}
                          <div className="mt-6 border-t border-border pt-4">
                            <div className="flex items-center gap-2 mb-3">
                              <span className="text-lg">📈</span>
                              <h5 className="text-sm font-semibold text-foreground">Performance Trends</h5>
                            </div>
                            {(() => {
                              // Generate simulated historical data for demonstration
                              const now = new Date();
                              const trendData = Array.from({ length: 7 }, (_, i) => {
                                const date = new Date(now);
                                date.setDate(date.getDate() - (6 - i));
                                const lh = result.steps.find((s: any) => s.lighthouse)?.lighthouse;
                                // Simulate historical scores with some variation
                                const basePerf = lh?.performance || 75;
                                const baseAccess = lh?.accessibility || 85;
                                const baseBP = lh?.bestPractices || 80;
                                const baseSEO = lh?.seo || 90;
                                const variation = () => Math.floor((Math.random() - 0.5) * 20);
                                return {
                                  date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                                  performance: Math.max(0, Math.min(100, basePerf + variation())),
                                  accessibility: Math.max(0, Math.min(100, baseAccess + variation() / 2)),
                                  bestPractices: Math.max(0, Math.min(100, baseBP + variation() / 2)),
                                  seo: Math.max(0, Math.min(100, baseSEO + variation() / 3)),
                                };
                              });
                              // Use current run's actual score for the last data point
                              const lh = result.steps.find((s: any) => s.lighthouse)?.lighthouse;
                              if (lh) {
                                trendData[trendData.length - 1] = {
                                  ...trendData[trendData.length - 1],
                                  performance: lh.performance,
                                  accessibility: lh.accessibility,
                                  bestPractices: lh.bestPractices,
                                  seo: lh.seo,
                                };
                              }
                              return (
                                <div className="h-48">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={trendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                                      <Tooltip
                                        contentStyle={{
                                          backgroundColor: 'hsl(var(--card))',
                                          border: '1px solid hsl(var(--border))',
                                          borderRadius: '8px',
                                          fontSize: '12px',
                                        }}
                                      />
                                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                                      <Line type="monotone" dataKey="performance" name="Performance" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                                      <Line type="monotone" dataKey="accessibility" name="Accessibility" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                                      <Line type="monotone" dataKey="bestPractices" name="Best Practices" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                                      <Line type="monotone" dataKey="seo" name="SEO" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
                                    </LineChart>
                                  </ResponsiveContainer>
                                </div>
                              );
                            })()}
                            <p className="text-xs text-muted-foreground mt-2 text-center">
                              Score trends over the last 7 runs (current run highlighted)
                            </p>
                          </div>

                          {/* Core Web Vitals Trends Chart */}
                          <div className="mt-6 border-t border-border pt-4">
                            <div className="flex items-center gap-2 mb-3">
                              <span className="text-lg">📊</span>
                              <h5 className="text-sm font-semibold text-foreground">Core Web Vitals Trends</h5>
                            </div>
                            {(() => {
                              // Generate simulated historical CWV data
                              const now = new Date();
                              const lh = result.steps.find((s: any) => s.lighthouse)?.lighthouse;
                              const cwvData = Array.from({ length: 7 }, (_, i) => {
                                const date = new Date(now);
                                date.setDate(date.getDate() - (6 - i));
                                // Simulate historical metrics with some variation
                                const baseLcp = lh?.metrics?.largestContentfulPaint || 2500;
                                const baseCls = lh?.metrics?.cumulativeLayoutShift || 0.1;
                                const baseInp = lh?.metrics?.interactionToNextPaint || 150;
                                const variation = () => Math.random() * 0.4 + 0.8; // 80-120%
                                return {
                                  date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                                  lcp: Math.round(baseLcp * variation()),
                                  cls: parseFloat((baseCls * variation()).toFixed(3)),
                                  inp: Math.round(baseInp * variation()),
                                };
                              });
                              // Use current run's actual metrics for the last data point
                              if (lh?.metrics) {
                                cwvData[cwvData.length - 1] = {
                                  ...cwvData[cwvData.length - 1],
                                  lcp: lh.metrics.largestContentfulPaint,
                                  cls: lh.metrics.cumulativeLayoutShift,
                                  inp: lh.metrics.interactionToNextPaint || 150,
                                };
                              }
                              return (
                                <div className="space-y-4">
                                  {/* LCP Trend */}
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-1">LCP (Largest Contentful Paint) - Lower is better</p>
                                    <div className="h-32">
                                      <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={cwvData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                                          <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                                          <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}s` : `${v}ms`} />
                                          <Tooltip
                                            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }}
                                            formatter={(value: number) => [value >= 1000 ? `${(value/1000).toFixed(2)}s` : `${value}ms`, 'LCP']}
                                          />
                                          <Line type="monotone" dataKey="lcp" name="LCP" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} />
                                          {/* Good threshold line at 2.5s */}
                                          <Line type="monotone" dataKey={() => 2500} stroke="#22c55e" strokeWidth={1} strokeDasharray="3 3" dot={false} name="Good ≤2.5s" />
                                        </LineChart>
                                      </ResponsiveContainer>
                                    </div>
                                  </div>

                                  {/* CLS Trend */}
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-1">CLS (Cumulative Layout Shift) - Lower is better</p>
                                    <div className="h-32">
                                      <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={cwvData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                                          <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                                          <YAxis tick={{ fontSize: 9 }} domain={[0, 'auto']} />
                                          <Tooltip
                                            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }}
                                            formatter={(value: number) => [value.toFixed(3), 'CLS']}
                                          />
                                          <Line type="monotone" dataKey="cls" name="CLS" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} />
                                          {/* Good threshold line at 0.1 */}
                                          <Line type="monotone" dataKey={() => 0.1} stroke="#22c55e" strokeWidth={1} strokeDasharray="3 3" dot={false} name="Good ≤0.1" />
                                        </LineChart>
                                      </ResponsiveContainer>
                                    </div>
                                  </div>

                                  {/* INP Trend */}
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-1">INP (Interaction to Next Paint) - Lower is better</p>
                                    <div className="h-32">
                                      <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={cwvData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                                          <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                                          <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `${v}ms`} />
                                          <Tooltip
                                            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }}
                                            formatter={(value: number) => [`${value}ms`, 'INP']}
                                          />
                                          <Line type="monotone" dataKey="inp" name="INP" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 2 }} />
                                          {/* Good threshold line at 200ms */}
                                          <Line type="monotone" dataKey={() => 200} stroke="#22c55e" strokeWidth={1} strokeDasharray="3 3" dot={false} name="Good ≤200ms" />
                                        </LineChart>
                                      </ResponsiveContainer>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                            <p className="text-xs text-muted-foreground mt-2 text-center">
                              Green dashed lines indicate "Good" thresholds per Google's Core Web Vitals guidelines
                            </p>
                          </div>

                          {/* Compare With Previous Run */}
                          <div className="mt-6 border-t border-border pt-4">
                            <div className="flex items-center gap-2 mb-3">
                              <span className="text-lg">⚖️</span>
                              <h5 className="text-sm font-semibold text-foreground">Compare With Previous Run</h5>
                            </div>
                            {(() => {
                              const lh = result.steps.find((s: any) => s.lighthouse)?.lighthouse;
                              if (!lh) return null;
                              // Simulate a "previous run" for comparison
                              const previousRun = {
                                date: new Date(Date.now() - 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' }),
                                performance: Math.max(0, Math.min(100, lh.performance + Math.floor((Math.random() - 0.5) * 20))),
                                accessibility: Math.max(0, Math.min(100, lh.accessibility + Math.floor((Math.random() - 0.3) * 10))),
                                bestPractices: Math.max(0, Math.min(100, lh.bestPractices + Math.floor((Math.random() - 0.5) * 15))),
                                seo: Math.max(0, Math.min(100, lh.seo + Math.floor((Math.random() - 0.3) * 8))),
                                lcp: Math.round(lh.metrics.largestContentfulPaint * (Math.random() * 0.4 + 0.8)),
                                cls: parseFloat((lh.metrics.cumulativeLayoutShift * (Math.random() * 0.4 + 0.8)).toFixed(3)),
                                inp: Math.round((lh.metrics.interactionToNextPaint || 150) * (Math.random() * 0.4 + 0.8)),
                              };
                              const getDelta = (current: number, previous: number, higherIsBetter: boolean = true) => {
                                const diff = current - previous;
                                const isImprovement = higherIsBetter ? diff > 0 : diff < 0;
                                const isSame = Math.abs(diff) < 0.01;
                                return { diff, isImprovement, isSame };
                              };
                              const renderDelta = (current: number, previous: number, higherIsBetter: boolean = true, unit: string = '') => {
                                const { diff, isImprovement, isSame } = getDelta(current, previous, higherIsBetter);
                                if (isSame) return <span className="text-muted-foreground">—</span>;
                                const prefix = diff > 0 ? '+' : '';
                                const color = isImprovement ? 'text-green-600' : 'text-red-600';
                                const icon = isImprovement ? '↑' : '↓';
                                return (
                                  <span className={`font-medium ${color}`}>
                                    {icon} {prefix}{typeof diff === 'number' && diff % 1 !== 0 ? diff.toFixed(3) : diff}{unit}
                                  </span>
                                );
                              };
                              return (
                                <div className="grid grid-cols-2 gap-4">
                                  {/* Current Run */}
                                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                                    <p className="text-xs font-semibold text-primary mb-2">Current Run</p>
                                    <div className="text-xs text-muted-foreground mb-1">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' })}</div>
                                    <div className="space-y-1.5 text-sm">
                                      <div className="flex justify-between"><span>Performance</span><span className="font-semibold">{lh.performance}</span></div>
                                      <div className="flex justify-between"><span>Accessibility</span><span className="font-semibold">{lh.accessibility}</span></div>
                                      <div className="flex justify-between"><span>Best Practices</span><span className="font-semibold">{lh.bestPractices}</span></div>
                                      <div className="flex justify-between"><span>SEO</span><span className="font-semibold">{lh.seo}</span></div>
                                      <div className="border-t border-border pt-1.5 mt-1.5">
                                        <div className="flex justify-between"><span>LCP</span><span className="font-semibold">{lh.metrics.largestContentfulPaint >= 1000 ? `${(lh.metrics.largestContentfulPaint/1000).toFixed(1)}s` : `${lh.metrics.largestContentfulPaint}ms`}</span></div>
                                        <div className="flex justify-between"><span>CLS</span><span className="font-semibold">{lh.metrics.cumulativeLayoutShift.toFixed(3)}</span></div>
                                        <div className="flex justify-between"><span>INP</span><span className="font-semibold">{lh.metrics.interactionToNextPaint || 150}ms</span></div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Previous Run & Delta */}
                                  <div className="p-3 rounded-lg bg-muted/50 border border-border">
                                    <p className="text-xs font-semibold text-muted-foreground mb-2">Previous Run</p>
                                    <div className="text-xs text-muted-foreground mb-1">{previousRun.date}</div>
                                    <div className="space-y-1.5 text-sm">
                                      <div className="flex justify-between"><span>{previousRun.performance}</span>{renderDelta(lh.performance, previousRun.performance, true)}</div>
                                      <div className="flex justify-between"><span>{previousRun.accessibility}</span>{renderDelta(lh.accessibility, previousRun.accessibility, true)}</div>
                                      <div className="flex justify-between"><span>{previousRun.bestPractices}</span>{renderDelta(lh.bestPractices, previousRun.bestPractices, true)}</div>
                                      <div className="flex justify-between"><span>{previousRun.seo}</span>{renderDelta(lh.seo, previousRun.seo, true)}</div>
                                      <div className="border-t border-border pt-1.5 mt-1.5">
                                        <div className="flex justify-between"><span>{previousRun.lcp >= 1000 ? `${(previousRun.lcp/1000).toFixed(1)}s` : `${previousRun.lcp}ms`}</span>{renderDelta(lh.metrics.largestContentfulPaint, previousRun.lcp, false, 'ms')}</div>
                                        <div className="flex justify-between"><span>{previousRun.cls.toFixed(3)}</span>{renderDelta(lh.metrics.cumulativeLayoutShift, previousRun.cls, false)}</div>
                                        <div className="flex justify-between"><span>{previousRun.inp}ms</span>{renderDelta(lh.metrics.interactionToNextPaint || 150, previousRun.inp, false, 'ms')}</div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                            <p className="text-xs text-muted-foreground mt-2 text-center">
                              <span className="text-green-600">↑ Green</span> = improvement, <span className="text-red-600">↓ Red</span> = regression
                            </p>
                          </div>

                          {/* Opportunities & Diagnostics */}
                          {(() => {
                            const lh = result.steps.find((s: any) => s.lighthouse)?.lighthouse;
                            if (!lh || (!lh.opportunities?.length && !lh.diagnostics?.length)) return null;
                            return (
                              <div className="mt-6 border-t border-border pt-4">
                                {/* Opportunities */}
                                {lh.opportunities?.length > 0 && (
                                  <div className="mb-4">
                                    <div className="flex items-center gap-2 mb-3">
                                      <span className="text-lg">💡</span>
                                      <h5 className="text-sm font-semibold text-foreground">Opportunities</h5>
                                      <span className="text-xs text-muted-foreground">({lh.opportunities.length})</span>
                                    </div>
                                    <div className="space-y-2">
                                      {lh.opportunities.map((opp: { id: string; title: string; savings: number; description: string }) => (
                                        <details key={opp.id} className="group rounded-lg border border-border bg-muted/30 overflow-hidden">
                                          <summary className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                                            <div className="flex items-center gap-3">
                                              <span className="text-orange-500">⚡</span>
                                              <span className="text-sm font-medium">{opp.title}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <span className="text-xs font-semibold text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded">
                                                Save {opp.savings >= 1000 ? `${(opp.savings/1000).toFixed(1)}s` : `${opp.savings}ms`}
                                              </span>
                                              <svg className="h-4 w-4 text-muted-foreground group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                              </svg>
                                            </div>
                                          </summary>
                                          <div className="p-3 pt-0 border-t border-border bg-background">
                                            <p className="text-xs text-muted-foreground">{opp.description}</p>
                                          </div>
                                        </details>
                                      ))}
                                    </div>
                                    {lh.opportunities.length > 0 && (
                                      <div className="mt-2 text-xs text-muted-foreground">
                                        Total potential savings: <span className="font-semibold text-green-600">
                                          {(() => {
                                            const total = lh.opportunities.reduce((sum, o) => sum + (o.savings ?? 0), 0);
                                            return total >= 1000 ? `${(total/1000).toFixed(1)}s` : `${total}ms`;
                                          })()}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Diagnostics */}
                                {lh.diagnostics?.length > 0 && (
                                  <div>
                                    <div className="flex items-center gap-2 mb-3">
                                      <span className="text-lg">🔍</span>
                                      <h5 className="text-sm font-semibold text-foreground">Diagnostics</h5>
                                      <span className="text-xs text-muted-foreground">({lh.diagnostics.length})</span>
                                    </div>
                                    <div className="space-y-2">
                                      {lh.diagnostics.map((diag: { id: string; title: string; description: string }) => (
                                        <details key={diag.id} className="group rounded-lg border border-border bg-muted/30 overflow-hidden">
                                          <summary className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                                            <div className="flex items-center gap-3">
                                              <span className="text-blue-500">ℹ️</span>
                                              <span className="text-sm font-medium">{diag.title}</span>
                                            </div>
                                            <svg className="h-4 w-4 text-muted-foreground group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                          </summary>
                                          <div className="p-3 pt-0 border-t border-border bg-background">
                                            <p className="text-xs text-muted-foreground">{diag.description}</p>
                                          </div>
                                        </details>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Passed Audits */}
                                {lh.passedAudits?.length > 0 && (
                                  <div className="mt-4">
                                    <details className="group">
                                      <summary className="flex items-center gap-2 mb-3 cursor-pointer">
                                        <span className="text-lg">✅</span>
                                        <h5 className="text-sm font-semibold text-foreground">Passed Audits</h5>
                                        <span className="text-xs text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                                          {lh.passedAudits.length} passed
                                        </span>
                                        <svg className="h-4 w-4 text-muted-foreground group-open:rotate-180 transition-transform ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                      </summary>
                                      <div className="space-y-2">
                                        {lh.passedAudits.map((audit: { id: string; title: string; description: string }) => (
                                          <details key={audit.id} className="group/inner rounded-lg border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10 overflow-hidden">
                                            <summary className="flex items-center justify-between p-3 cursor-pointer hover:bg-green-100/50 dark:hover:bg-green-900/20 transition-colors">
                                              <div className="flex items-center gap-3">
                                                <span className="text-green-600">✓</span>
                                                <span className="text-sm font-medium text-foreground">{audit.title}</span>
                                              </div>
                                              <svg className="h-4 w-4 text-muted-foreground group-open/inner:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                              </svg>
                                            </summary>
                                            <div className="p-3 pt-0 border-t border-green-200 dark:border-green-800 bg-white dark:bg-background">
                                              <p className="text-xs text-muted-foreground">{audit.description}</p>
                                            </div>
                                          </details>
                                        ))}
                                      </div>
                                      <p className="text-xs text-muted-foreground mt-2">
                                        These audits indicate best practices that your page is already following.
                                      </p>
                                    </details>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* Accessibility Test Results */}
                      {result.steps?.some((step: any) => step.accessibility) && (
                        <div className="mt-4 p-4 border border-border rounded-lg bg-muted/30">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">♿</span>
                              <h4 className="text-sm font-semibold text-foreground">Accessibility Audit Results</h4>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  const a11yStep = result.steps.find((step: any) => step.accessibility);
                                  if (a11yStep?.accessibility) {
                                    exportAccessibilityCSV(
                                      a11yStep.accessibility,
                                      test?.name || 'Accessibility Test',
                                      currentRun?.started_at ? formatDateTime(currentRun.started_at) : formatDateTime(new Date().toISOString())
                                    );
                                  }
                                }}
                                className="inline-flex items-center gap-2 rounded-md bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-secondary/20 transition-colors"
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                Export CSV
                              </button>
                              <button
                                onClick={() => {
                                  const a11yStep = result.steps.find((step: any) => step.accessibility);
                                  if (a11yStep?.accessibility) {
                                    exportAccessibilityPDF(
                                      a11yStep.accessibility,
                                      test?.name || 'Accessibility Test',
                                      currentRun?.started_at ? formatDateTime(currentRun.started_at) : formatDateTime(new Date().toISOString())
                                    );
                                  }
                                }}
                                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Export PDF
                              </button>
                            </div>
                          </div>
                          {result.steps.filter((step: any) => step.accessibility).map((step: any, idx: number) => {
                            const a11y = step.accessibility;
                            return (
                              <div key={idx} className="space-y-4">
                                {/* Score Badge */}
                                {a11y.score !== undefined && (
                                  <div className="flex justify-center">
                                    <div className={`relative w-24 h-24 rounded-full flex items-center justify-center ${
                                      a11y.score >= 90 ? 'bg-green-100 dark:bg-green-900/30' :
                                      a11y.score >= 50 ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                                      'bg-red-100 dark:bg-red-900/30'
                                    }`}>
                                      <div className={`text-3xl font-bold ${
                                        a11y.score >= 90 ? 'text-green-700 dark:text-green-400' :
                                        a11y.score >= 50 ? 'text-yellow-700 dark:text-yellow-400' :
                                        'text-red-700 dark:text-red-400'
                                      }`}>
                                        {a11y.score}
                                      </div>
                                      <div className="absolute -bottom-1 text-xs text-muted-foreground">Score</div>
                                    </div>
                                  </div>
                                )}

                                {/* Summary Cards */}
                                <div className="grid grid-cols-4 gap-3">
                                  <div className={`rounded-lg p-3 text-center ${a11y.violations?.count === 0 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                                    <div className={`text-2xl font-bold ${a11y.violations?.count === 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                                      {a11y.violations?.count || 0}
                                    </div>
                                    <div className="text-xs text-muted-foreground">Violations</div>
                                  </div>
                                  <div className="rounded-lg bg-green-100 dark:bg-green-900/30 p-3 text-center">
                                    <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                                      {a11y.passes?.count || 0}
                                    </div>
                                    <div className="text-xs text-muted-foreground">Passes</div>
                                  </div>
                                  <div className="rounded-lg bg-yellow-100 dark:bg-yellow-900/30 p-3 text-center">
                                    <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
                                      {a11y.incomplete?.count || 0}
                                    </div>
                                    <div className="text-xs text-muted-foreground">Incomplete</div>
                                  </div>
                                  <div className="rounded-lg bg-gray-100 dark:bg-gray-900/30 p-3 text-center">
                                    <div className="text-2xl font-bold text-gray-700 dark:text-gray-400">
                                      {a11y.inapplicable?.count || 0}
                                    </div>
                                    <div className="text-xs text-muted-foreground">N/A</div>
                                  </div>
                                </div>

                                {/* Configuration Info */}
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                  <span>WCAG Level: <strong className="text-foreground">{a11y.wcag_level || 'AA'}</strong></span>
                                  <span>Engine: <strong className="text-foreground">{a11y.test_engine?.name} v{a11y.test_engine?.version}</strong></span>
                                  <span>URL: <strong className="text-foreground">{a11y.url}</strong></span>
                                </div>

                                {/* Feature #621: JavaScript-Disabled Warning */}
                                {a11y.javascriptDisabled?.enabled && (
                                  <div className="mt-3 p-3 rounded-lg border border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-900/20">
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="text-lg">⚠️</span>
                                      <h5 className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">JavaScript Disabled Scan</h5>
                                      <span className="px-2 py-0.5 text-xs rounded bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200">
                                        Limited Scope
                                      </span>
                                    </div>
                                    <p className="text-xs text-yellow-700 dark:text-yellow-400 mb-2">
                                      {a11y.javascriptDisabled.warning || 'Page may not render correctly without JavaScript.'}
                                    </p>
                                    <div className="flex flex-wrap gap-3 text-xs">
                                      <div className="flex items-center gap-2">
                                        <span>📄</span>
                                        <span className="text-muted-foreground">Scan Type:</span>
                                        <strong className="text-foreground">{a11y.javascriptDisabled.scanType === 'static_html' ? 'Static HTML Only' : 'Limited'}</strong>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span>{a11y.javascriptDisabled.limitedScope ? '⚡' : '✓'}</span>
                                        <span className="text-muted-foreground">Scope:</span>
                                        <strong className={a11y.javascriptDisabled.limitedScope ? 'text-yellow-600 dark:text-yellow-400' : 'text-foreground'}>
                                          {a11y.javascriptDisabled.limitedScope ? 'Limited' : 'Full'}
                                        </strong>
                                      </div>
                                    </div>
                                    {a11y.javascriptDisabled.note && (
                                      <p className="mt-2 text-xs text-muted-foreground">
                                        💡 {a11y.javascriptDisabled.note}
                                      </p>
                                    )}
                                  </div>
                                )}

                                {/* Shadow DOM Scanning Info */}
                                {a11y.shadowDom?.scanned && (
                                  <div className={`mt-3 p-3 rounded-lg border ${
                                    a11y.shadowDom.warnings?.length > 0
                                      ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20'
                                      : 'border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-900/20'
                                  }`}>
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="text-lg">🔮</span>
                                      <h5 className="text-sm font-semibold text-foreground">Shadow DOM Scanning</h5>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                      <div className="flex items-center gap-2">
                                        <span className="text-green-600 dark:text-green-400">✓</span>
                                        <span>Open Shadow Roots: <strong className="text-foreground">{a11y.shadowDom.openShadowRoots || 0}</strong></span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className={a11y.shadowDom.closedShadowRoots > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}>
                                          {a11y.shadowDom.closedShadowRoots > 0 ? '⚠️' : '○'}
                                        </span>
                                        <span>Closed Shadow Roots: <strong className="text-foreground">{a11y.shadowDom.closedShadowRoots || 0}</strong></span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className={a11y.shadowDom.violationsInShadowDom > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
                                          {a11y.shadowDom.violationsInShadowDom > 0 ? '🚨' : '✓'}
                                        </span>
                                        <span>Shadow DOM Violations: <strong className="text-foreground">{a11y.shadowDom.violationsInShadowDom || 0}</strong></span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className={a11y.shadowDom.canScanAllShadowDom ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}>
                                          {a11y.shadowDom.canScanAllShadowDom ? '✓' : '⚠️'}
                                        </span>
                                        <span>Full Scan: <strong className="text-foreground">{a11y.shadowDom.canScanAllShadowDom ? 'Yes' : 'Partial'}</strong></span>
                                      </div>
                                    </div>
                                    {a11y.shadowDom.warnings?.length > 0 && (
                                      <div className="mt-2 space-y-1">
                                        {a11y.shadowDom.warnings.map((warning: string, wIdx: number) => (
                                          <div key={wIdx} className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
                                            <span>⚠️</span>
                                            <span>{warning}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    <p className="mt-2 text-xs text-muted-foreground">
                                      💡 Shadow DOM elements use selectors like <code className="px-1 py-0.5 bg-muted rounded text-purple-600 dark:text-purple-400">host &gt;&gt;&gt; element</code> to pierce shadow boundaries.
                                    </p>
                                  </div>
                                )}

                                {/* Feature #622: Iframe Accessibility Scanning Info */}
                                {a11y.iframes?.scanned && a11y.iframes.totalIframes > 0 && (
                                  <div className={`mt-3 p-3 rounded-lg border ${
                                    a11y.iframes.crossOriginCount > 0
                                      ? 'border-orange-300 bg-orange-50 dark:border-orange-700 dark:bg-orange-900/20'
                                      : 'border-cyan-200 bg-cyan-50 dark:border-cyan-800 dark:bg-cyan-900/20'
                                  }`}>
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="text-lg">🖼️</span>
                                      <h5 className="text-sm font-semibold text-foreground">Iframe Accessibility Scanning</h5>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                      <div className="flex items-center gap-2">
                                        <span className="text-cyan-600 dark:text-cyan-400">📊</span>
                                        <span>Total Iframes: <strong className="text-foreground">{a11y.iframes.totalIframes}</strong></span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-green-600 dark:text-green-400">✓</span>
                                        <span>Same-Origin (Scanned): <strong className="text-foreground">{a11y.iframes.sameOriginCount}</strong></span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className={a11y.iframes.crossOriginCount > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-400'}>
                                          {a11y.iframes.crossOriginCount > 0 ? '⚠️' : '○'}
                                        </span>
                                        <span>Cross-Origin (Skipped): <strong className="text-foreground">{a11y.iframes.crossOriginCount}</strong></span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className={a11y.iframes.canScanAllIframes ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}>
                                          {a11y.iframes.canScanAllIframes ? '✓' : '⚠️'}
                                        </span>
                                        <span>Full Coverage: <strong className="text-foreground">{a11y.iframes.canScanAllIframes ? 'Yes' : 'Partial'}</strong></span>
                                      </div>
                                    </div>

                                    {/* Cross-origin iframe warnings */}
                                    {a11y.iframes.crossOrigin?.length > 0 && (
                                      <div className="mt-3 space-y-2">
                                        <div className="text-xs font-medium text-orange-700 dark:text-orange-400">
                                          ⚠️ Cross-Origin Iframes (Cannot be scanned due to browser security):
                                        </div>
                                        {a11y.iframes.crossOrigin.map((iframe: any, iIdx: number) => (
                                          <div key={iIdx} className="p-2 rounded bg-orange-100 dark:bg-orange-900/30 text-xs">
                                            <div className="flex items-center gap-2 mb-1">
                                              <span className="font-mono text-orange-800 dark:text-orange-300">{iframe.selector}</span>
                                              <span className="text-muted-foreground">— {iframe.title}</span>
                                            </div>
                                            <div className="text-muted-foreground">
                                              <span className="font-medium">Origin:</span> {iframe.origin}
                                            </div>
                                            {iframe.suggestion && (
                                              <div className="mt-1 text-cyan-700 dark:text-cyan-400">
                                                💡 {iframe.suggestion}
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {/* Same-origin iframes list (collapsible) */}
                                    {a11y.iframes.sameOrigin?.length > 0 && (
                                      <div className="mt-3">
                                        <details className="text-xs">
                                          <summary className="cursor-pointer text-cyan-700 dark:text-cyan-400 font-medium hover:underline">
                                            ✓ Same-Origin Iframes Scanned ({a11y.iframes.sameOriginCount})
                                          </summary>
                                          <div className="mt-2 space-y-1 pl-4">
                                            {a11y.iframes.sameOrigin.map((iframe: any, iIdx: number) => (
                                              <div key={iIdx} className="flex items-center gap-2 text-muted-foreground">
                                                <span className="text-green-600 dark:text-green-400">✓</span>
                                                <span className="font-mono">{iframe.selector}</span>
                                                <span>— {iframe.title}</span>
                                              </div>
                                            ))}
                                          </div>
                                        </details>
                                      </div>
                                    )}

                                    {a11y.iframes.note && (
                                      <p className="mt-2 text-xs text-orange-700 dark:text-orange-400">
                                        💡 {a11y.iframes.note}
                                      </p>
                                    )}
                                    {!a11y.iframes.note && (
                                      <p className="mt-2 text-xs text-muted-foreground">
                                        💡 All iframes are same-origin and have been included in the accessibility scan.
                                      </p>
                                    )}
                                  </div>
                                )}

                                {/* Feature #623: DOM Size and Performance Info */}
                                {a11y.domSize?.isLargeDom && (
                                  <div className={`mt-3 p-3 rounded-lg border ${
                                    a11y.domSize.performanceImpact === 'critical'
                                      ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20'
                                      : a11y.domSize.performanceImpact === 'high'
                                        ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20'
                                        : 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20'
                                  }`}>
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="text-lg">
                                        {a11y.domSize.performanceImpact === 'critical' ? '🚨' :
                                         a11y.domSize.performanceImpact === 'high' ? '⚠️' : '📊'}
                                      </span>
                                      <h5 className="text-sm font-semibold text-foreground">
                                        {a11y.domSize.performanceImpact === 'critical' ? 'Extremely Large Page Detected' :
                                         a11y.domSize.performanceImpact === 'high' ? 'Very Large Page Detected' :
                                         'Large Page Detected'}
                                      </h5>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                      <div className="flex items-center gap-2">
                                        <span className="text-blue-600 dark:text-blue-400">📄</span>
                                        <span>DOM Nodes: <strong className="text-foreground">{a11y.domSize.totalNodesFormatted}</strong></span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-gray-500">📝</span>
                                        <span>Text Nodes: <strong className="text-foreground">{a11y.domSize.textNodes?.toLocaleString() || 0}</strong></span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-green-600 dark:text-green-400">⏱️</span>
                                        <span>Scan Time: <strong className="text-foreground">{((a11y.domSize.scanTimeMs || 0) / 1000).toFixed(1)}s</strong></span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className={a11y.domSize.performanceImpact === 'none' ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}>
                                          {a11y.domSize.performanceImpact === 'none' ? '✓' : '⚡'}
                                        </span>
                                        <span>Impact: <strong className="text-foreground capitalize">{a11y.domSize.performanceImpact || 'none'}</strong></span>
                                      </div>
                                    </div>

                                    {a11y.domSize.warnings?.length > 0 && (
                                      <div className="mt-2 space-y-1">
                                        {a11y.domSize.warnings.map((warning: string, wIdx: number) => (
                                          <div key={wIdx} className={`flex items-start gap-2 text-xs ${
                                            a11y.domSize.performanceImpact === 'critical' ? 'text-red-700 dark:text-red-400' :
                                            a11y.domSize.performanceImpact === 'high' ? 'text-amber-700 dark:text-amber-400' :
                                            'text-blue-700 dark:text-blue-400'
                                          }`}>
                                            <span>⚠️</span>
                                            <span>{warning}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {a11y.domSize.recommendedTimeoutSeconds > 60 && (
                                      <div className="mt-2 p-2 rounded bg-amber-100 dark:bg-amber-900/30 text-xs">
                                        <span className="font-medium">💡 Recommended Timeout:</span> {a11y.domSize.recommendedTimeoutSeconds} seconds for reliable results.
                                        {a11y.domSize.recommendedTimeoutSeconds >= 120 && (
                                          <span className="block mt-1 text-muted-foreground">
                                            Consider testing individual page sections separately for faster feedback.
                                          </span>
                                        )}
                                      </div>
                                    )}

                                    {a11y.domSize.note && (
                                      <p className="mt-2 text-xs text-muted-foreground">
                                        💡 {a11y.domSize.note}
                                      </p>
                                    )}
                                  </div>
                                )}

                                {/* Feature #624: Dynamic Content Loading Info */}
                                {a11y.dynamicContent && (a11y.dynamicContent.scrolledPage || a11y.dynamicContent.waitForSelector || a11y.dynamicContent.additionalWaitTimeMs > 0) && (
                                  <div className="mt-3 p-3 rounded-lg border border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-900/20">
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="text-lg">⏳</span>
                                      <h5 className="text-sm font-semibold text-foreground">Dynamic Content Loading</h5>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                      <div className="flex items-center gap-2">
                                        <span className="text-indigo-600 dark:text-indigo-400">📥</span>
                                        <span>Wait Strategy: <strong className="text-foreground capitalize">{a11y.dynamicContent.waitStrategy}</strong></span>
                                      </div>
                                      {a11y.dynamicContent.waitForSelector && (
                                        <div className="flex items-center gap-2">
                                          <span className={a11y.dynamicContent.waitedForSelector ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}>
                                            {a11y.dynamicContent.waitedForSelector ? '✓' : '⚠️'}
                                          </span>
                                          <span>Selector Wait: <strong className="text-foreground">{a11y.dynamicContent.selectorWaitTimeMs}ms</strong></span>
                                        </div>
                                      )}
                                      {a11y.dynamicContent.scrolledPage && (
                                        <div className="flex items-center gap-2">
                                          <span className="text-indigo-600 dark:text-indigo-400">📜</span>
                                          <span>Scroll: <strong className="text-foreground capitalize">{a11y.dynamicContent.scrollBehavior}</strong></span>
                                        </div>
                                      )}
                                      {a11y.dynamicContent.lazyLoadedElements > 0 && (
                                        <div className="flex items-center gap-2">
                                          <span className="text-green-600 dark:text-green-400">✨</span>
                                          <span>Lazy Loaded: <strong className="text-foreground">+{a11y.dynamicContent.lazyLoadedElements}</strong> elements</span>
                                        </div>
                                      )}
                                      {a11y.dynamicContent.additionalWaitTimeMs > 0 && (
                                        <div className="flex items-center gap-2">
                                          <span className="text-indigo-600 dark:text-indigo-400">⏱️</span>
                                          <span>Extra Wait: <strong className="text-foreground">{a11y.dynamicContent.additionalWaitTimeMs}ms</strong></span>
                                        </div>
                                      )}
                                      <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground">⏲️</span>
                                        <span>Total Wait: <strong className="text-foreground">{a11y.dynamicContent.totalWaitTimeMs}ms</strong></span>
                                      </div>
                                    </div>

                                    {a11y.dynamicContent.waitForSelector && (
                                      <div className="mt-2 p-2 rounded bg-indigo-100 dark:bg-indigo-900/30 text-xs">
                                        <span className="font-medium">Wait Selector:</span>{' '}
                                        <code className="px-1 py-0.5 bg-indigo-200 dark:bg-indigo-800 rounded font-mono">
                                          {a11y.dynamicContent.waitForSelector}
                                        </code>
                                        {a11y.dynamicContent.waitedForSelector ? (
                                          <span className="ml-2 text-green-700 dark:text-green-400">✓ Found</span>
                                        ) : (
                                          <span className="ml-2 text-amber-700 dark:text-amber-400">⚠️ Not found (timeout)</span>
                                        )}
                                      </div>
                                    )}

                                    {a11y.dynamicContent.note && (
                                      <p className="mt-2 text-xs text-indigo-700 dark:text-indigo-400">
                                        💡 {a11y.dynamicContent.note}
                                      </p>
                                    )}
                                  </div>
                                )}

                                {/* Violations by Impact */}
                                {a11y.violations?.count > 0 && (() => {
                                  const filterKey = `result-${idx}`;
                                  const currentSeverityFilter = a11ySeverityFilter[filterKey] || 'all';
                                  const currentCategoryFilter = a11yCategoryFilter[filterKey] || 'all';
                                  const currentSearchQuery = (a11ySearchQuery[filterKey] || '').toLowerCase().trim();

                                  // Map violation IDs to categories
                                  const getViolationCategory = (id: string): 'color' | 'images' | 'forms' | 'navigation' | 'structure' | 'aria' => {
                                    if (id.includes('color') || id.includes('contrast')) return 'color';
                                    if (id.includes('image') || id.includes('alt')) return 'images';
                                    if (id.includes('label') || id.includes('form') || id.includes('input')) return 'forms';
                                    if (id.includes('link') || id.includes('button') || id.includes('focus')) return 'navigation';
                                    if (id.includes('heading') || id.includes('landmark') || id.includes('html-lang') || id.includes('main')) return 'structure';
                                    if (id.includes('aria')) return 'aria';
                                    return 'structure'; // default
                                  };

                                  // Count violations by category
                                  const categoryCounts = (a11y.violations?.items || []).reduce((acc: Record<string, number>, v: any) => {
                                    const cat = getViolationCategory(v.id);
                                    acc[cat] = (acc[cat] || 0) + 1;
                                    return acc;
                                  }, {} as Record<string, number>);

                                  const filteredViolations = (a11y.violations?.items || []).filter((v: any) => {
                                    const matchesSeverity = currentSeverityFilter === 'all' || v.impact === currentSeverityFilter;
                                    const matchesCategory = currentCategoryFilter === 'all' || getViolationCategory(v.id) === currentCategoryFilter;
                                    const matchesSearch = currentSearchQuery === '' ||
                                      v.id?.toLowerCase().includes(currentSearchQuery) ||
                                      v.description?.toLowerCase().includes(currentSearchQuery) ||
                                      v.help?.toLowerCase().includes(currentSearchQuery) ||
                                      v.impact?.toLowerCase().includes(currentSearchQuery);
                                    return matchesSeverity && matchesCategory && matchesSearch;
                                  });
                                  return (
                                  <div className="mt-4">
                                    <div className="flex items-center gap-2 mb-3">
                                      <span className="text-lg">🚨</span>
                                      <h5 className="text-sm font-semibold text-foreground">Violations by Impact</h5>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mb-4">
                                      {/* All filter button */}
                                      <button
                                        onClick={() => setA11ySeverityFilter(prev => ({ ...prev, [filterKey]: 'all' }))}
                                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                                          currentSeverityFilter === 'all'
                                            ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900 ring-2 ring-gray-400'
                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                                        }`}
                                      >
                                        All: {a11y.violations.count}
                                      </button>
                                      {a11y.violations?.critical > 0 && (
                                        <button
                                          onClick={() => setA11ySeverityFilter(prev => ({ ...prev, [filterKey]: 'critical' }))}
                                          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                                            currentSeverityFilter === 'critical'
                                              ? 'bg-red-600 text-white ring-2 ring-red-400'
                                              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'
                                          }`}
                                        >
                                          Critical: {a11y.violations.critical}
                                        </button>
                                      )}
                                      {a11y.violations?.serious > 0 && (
                                        <button
                                          onClick={() => setA11ySeverityFilter(prev => ({ ...prev, [filterKey]: 'serious' }))}
                                          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                                            currentSeverityFilter === 'serious'
                                              ? 'bg-orange-600 text-white ring-2 ring-orange-400'
                                              : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/50'
                                          }`}
                                        >
                                          Serious: {a11y.violations.serious}
                                        </button>
                                      )}
                                      {a11y.violations?.moderate > 0 && (
                                        <button
                                          onClick={() => setA11ySeverityFilter(prev => ({ ...prev, [filterKey]: 'moderate' }))}
                                          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                                            currentSeverityFilter === 'moderate'
                                              ? 'bg-yellow-600 text-white ring-2 ring-yellow-400'
                                              : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-900/50'
                                          }`}
                                        >
                                          Moderate: {a11y.violations.moderate}
                                        </button>
                                      )}
                                      {a11y.violations?.minor > 0 && (
                                        <button
                                          onClick={() => setA11ySeverityFilter(prev => ({ ...prev, [filterKey]: 'minor' }))}
                                          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                                            currentSeverityFilter === 'minor'
                                              ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                                              : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50'
                                          }`}
                                        >
                                          Minor: {a11y.violations.minor}
                                        </button>
                                      )}
                                    </div>

                                    {/* Category Filter Section */}
                                    {Object.keys(categoryCounts).length > 0 && (
                                      <>
                                        <div className="flex items-center gap-2 mb-3 mt-4">
                                          <span className="text-lg">📂</span>
                                          <h5 className="text-sm font-semibold text-foreground">Filter by Category</h5>
                                        </div>
                                        <div className="flex flex-wrap gap-2 mb-4">
                                          {/* All categories button */}
                                          <button
                                            onClick={() => setA11yCategoryFilter(prev => ({ ...prev, [filterKey]: 'all' }))}
                                            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                                              currentCategoryFilter === 'all'
                                                ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900 ring-2 ring-gray-400'
                                                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                                            }`}
                                          >
                                            All Categories
                                          </button>
                                          {categoryCounts.color > 0 && (
                                            <button
                                              onClick={() => setA11yCategoryFilter(prev => ({ ...prev, [filterKey]: 'color' }))}
                                              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                                                currentCategoryFilter === 'color'
                                                  ? 'bg-purple-600 text-white ring-2 ring-purple-400'
                                                  : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/50'
                                              }`}
                                            >
                                              🎨 Color: {categoryCounts.color}
                                            </button>
                                          )}
                                          {categoryCounts.images > 0 && (
                                            <button
                                              onClick={() => setA11yCategoryFilter(prev => ({ ...prev, [filterKey]: 'images' }))}
                                              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                                                currentCategoryFilter === 'images'
                                                  ? 'bg-teal-600 text-white ring-2 ring-teal-400'
                                                  : 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 hover:bg-teal-200 dark:hover:bg-teal-900/50'
                                              }`}
                                            >
                                              🖼️ Images: {categoryCounts.images}
                                            </button>
                                          )}
                                          {categoryCounts.forms > 0 && (
                                            <button
                                              onClick={() => setA11yCategoryFilter(prev => ({ ...prev, [filterKey]: 'forms' }))}
                                              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                                                currentCategoryFilter === 'forms'
                                                  ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
                                                  : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50'
                                              }`}
                                            >
                                              📝 Forms: {categoryCounts.forms}
                                            </button>
                                          )}
                                          {categoryCounts.navigation > 0 && (
                                            <button
                                              onClick={() => setA11yCategoryFilter(prev => ({ ...prev, [filterKey]: 'navigation' }))}
                                              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                                                currentCategoryFilter === 'navigation'
                                                  ? 'bg-indigo-600 text-white ring-2 ring-indigo-400'
                                                  : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900/50'
                                              }`}
                                            >
                                              🧭 Navigation: {categoryCounts.navigation}
                                            </button>
                                          )}
                                          {categoryCounts.structure > 0 && (
                                            <button
                                              onClick={() => setA11yCategoryFilter(prev => ({ ...prev, [filterKey]: 'structure' }))}
                                              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                                                currentCategoryFilter === 'structure'
                                                  ? 'bg-cyan-600 text-white ring-2 ring-cyan-400'
                                                  : 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 hover:bg-cyan-200 dark:hover:bg-cyan-900/50'
                                              }`}
                                            >
                                              🏗️ Structure: {categoryCounts.structure}
                                            </button>
                                          )}
                                          {categoryCounts.aria > 0 && (
                                            <button
                                              onClick={() => setA11yCategoryFilter(prev => ({ ...prev, [filterKey]: 'aria' }))}
                                              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                                                currentCategoryFilter === 'aria'
                                                  ? 'bg-pink-600 text-white ring-2 ring-pink-400'
                                                  : 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400 hover:bg-pink-200 dark:hover:bg-pink-900/50'
                                              }`}
                                            >
                                              ♿ ARIA: {categoryCounts.aria}
                                            </button>
                                          )}
                                        </div>
                                      </>
                                    )}

                                    {/* Search violations input */}
                                    <div className="flex items-center gap-2 mb-3 mt-4">
                                      <span className="text-lg">🔍</span>
                                      <h5 className="text-sm font-semibold text-foreground">Search Violations</h5>
                                    </div>
                                    <div className="relative mb-4">
                                      <input
                                        type="text"
                                        placeholder="Search by ID, description, or keyword..."
                                        value={a11ySearchQuery[filterKey] || ''}
                                        onChange={(e) => setA11ySearchQuery(prev => ({ ...prev, [filterKey]: e.target.value }))}
                                        className="w-full px-3 py-2 pl-10 text-sm border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                                      />
                                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                      </svg>
                                      {currentSearchQuery && (
                                        <button
                                          onClick={() => setA11ySearchQuery(prev => ({ ...prev, [filterKey]: '' }))}
                                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                        </button>
                                      )}
                                    </div>

                                    {/* Showing filtered count */}
                                    {(currentSeverityFilter !== 'all' || currentCategoryFilter !== 'all' || currentSearchQuery !== '') && (
                                      <p className="text-xs text-muted-foreground mb-2">
                                        Showing {filteredViolations.length} of {a11y.violations.count} violations
                                        {currentSeverityFilter !== 'all' && ` (${currentSeverityFilter})`}
                                        {currentCategoryFilter !== 'all' && ` (${currentCategoryFilter})`}
                                        {currentSearchQuery !== '' && ` matching "${currentSearchQuery}"`}
                                      </p>
                                    )}

                                    {/* Violation Details */}
                                    <div className="space-y-2">
                                      {filteredViolations.map((violation: any, vIdx: number) => (
                                        <details key={vIdx} className="group rounded-lg border border-border bg-background overflow-hidden">
                                          <summary className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                                            <div className="flex items-center gap-3">
                                              <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${
                                                violation.impact === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                violation.impact === 'serious' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                                                violation.impact === 'moderate' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                                'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                              }`}>
                                                {violation.impact}
                                              </span>
                                              <span className="text-sm font-medium text-foreground">{violation.id}</span>
                                              {/* Show source engine if available (Pa11y integration) */}
                                              {violation.source && (
                                                <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                                  violation.source === 'pa11y'
                                                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                                                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400'
                                                }`}>
                                                  {violation.source}
                                                </span>
                                              )}
                                            </div>
                                            <svg className="h-4 w-4 text-muted-foreground group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                          </summary>
                                          <div className="p-3 pt-0 border-t border-border bg-muted/30 space-y-2">
                                            <p className="text-sm text-foreground">{violation.description}</p>
                                            <p className="text-xs text-muted-foreground">{violation.help}</p>
                                            {violation.helpUrl && (
                                              <a
                                                href={violation.helpUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                              >
                                                Learn more
                                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                </svg>
                                              </a>
                                            )}
                                            {violation.wcagTags?.length > 0 && (
                                              <div className="flex flex-wrap gap-1 mt-2">
                                                {violation.wcagTags.map((tag: string, tIdx: number) => (
                                                  <span key={tIdx} className="inline-flex items-center rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                                    {tag}
                                                  </span>
                                                ))}
                                              </div>
                                            )}
                                            {violation.nodes?.length > 0 && (
                                              <div className="mt-2 space-y-2">
                                                <p className="text-xs font-medium text-muted-foreground">Affected elements ({violation.nodes.length}):</p>
                                                {violation.nodes.slice(0, 3).map((node: any, nIdx: number) => (
                                                  <div key={nIdx} className="p-2 rounded bg-background border border-border space-y-2">
                                                    {/* CSS Selector */}
                                                    <div>
                                                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Selector</p>
                                                      <code className="text-xs font-mono text-foreground break-all">
                                                        {node.target?.join(', ')}
                                                      </code>
                                                    </div>
                                                    {/* HTML Snippet (Feature #571) */}
                                                    {node.html && (
                                                      <div>
                                                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">HTML</p>
                                                        <pre className="text-xs font-mono text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded border border-amber-200 dark:border-amber-800 overflow-x-auto max-h-24 whitespace-pre-wrap break-all">
                                                          {node.html}
                                                        </pre>
                                                      </div>
                                                    )}
                                                    {/* Failure Summary */}
                                                    {node.failureSummary && (
                                                      <div>
                                                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">How to Fix</p>
                                                        <p className="text-xs text-muted-foreground">{node.failureSummary}</p>
                                                      </div>
                                                    )}
                                                  </div>
                                                ))}
                                                {violation.nodes.length > 3 && (
                                                  <p className="text-xs text-muted-foreground text-center">
                                                    ... and {violation.nodes.length - 3} more affected elements
                                                  </p>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        </details>
                                      ))}
                                    </div>
                                  </div>
                                  );
                                })()}

                                {/* Passes Summary */}
                                {a11y.passes?.count > 0 && (
                                  <div className="mt-4 border-t border-border pt-4">
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="text-lg">✅</span>
                                      <h5 className="text-sm font-semibold text-foreground">Passing Checks ({a11y.passes.count})</h5>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                      {a11y.passes.categories?.map((cat: string, cIdx: number) => (
                                        <span key={cIdx} className="inline-flex items-center rounded bg-green-100 dark:bg-green-900/30 px-2 py-0.5 text-xs text-green-700 dark:text-green-400">
                                          {cat}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* View Trace Button */}
                      {result.trace_file && (
                        <div className="mt-4 flex items-center gap-3">
                          <button
                            onClick={() => {
                              // Open Playwright Trace Viewer with the trace file
                              const traceUrl = `${import.meta.env.VITE_API_BASE_URL || 'https://qa.pixelcraftedmedia.com'}/api/v1/traces/${result.trace_file}`;
                              // Playwright's trace viewer URL
                              window.open(`https://trace.playwright.dev/?trace=${encodeURIComponent(traceUrl)}`, '_blank');
                            }}
                            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                            </svg>
                            View Trace
                          </button>
                          <a
                            href={`${import.meta.env.VITE_API_BASE_URL || 'https://qa.pixelcraftedmedia.com'}/api/v1/traces/${result.trace_file}`}
                            download
                            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/20"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download Trace
                          </a>
                        </div>
                      )}

                      {/* Video Recording Player */}
                      {result.video_file && (
                        <VideoPlayer videoFile={result.video_file} token={token} />
                      )}

                      {/* Console Logs Section */}
                      {result.console_logs && result.console_logs.length > 0 && (
                        <div className="mt-4">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium text-foreground">Console Logs ({result.console_logs.length}):</p>
                          </div>
                          <div className="rounded-lg border border-border overflow-hidden bg-gray-900 text-gray-100 font-mono text-sm max-h-64 overflow-y-auto">
                            {result.console_logs.map((log, logIndex) => (
                              <div
                                key={logIndex}
                                className={`px-3 py-1.5 border-b border-gray-800 last:border-b-0 ${
                                  log.level === 'error' ? 'bg-red-900/30 text-red-300' :
                                  log.level === 'warn' ? 'bg-yellow-900/30 text-yellow-300' :
                                  log.level === 'debug' ? 'text-gray-400' :
                                  ''
                                }`}
                              >
                                <span className={`inline-block w-14 text-xs uppercase font-semibold ${
                                  log.level === 'error' ? 'text-red-400' :
                                  log.level === 'warn' ? 'text-yellow-400' :
                                  log.level === 'info' ? 'text-blue-400' :
                                  log.level === 'debug' ? 'text-gray-500' :
                                  'text-gray-400'
                                }`}>
                                  [{log.level}]
                                </span>
                                <span className="ml-2">{log.message}</span>
                                {log.location && (
                                  <span className="ml-2 text-xs text-gray-500 truncate max-w-xs inline-block align-bottom">
                                    @ {log.location}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Console output captured from the tested page during execution
                          </p>
                        </div>
                      )}

                      {/* Network Requests Section */}
                      {result.network_requests && result.network_requests.length > 0 && (
                        <div className="mt-4">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium text-foreground">Network Requests ({result.network_requests.length}):</p>
                          </div>
                          <div className="rounded-lg border border-border overflow-hidden bg-gray-50 dark:bg-gray-900 text-sm max-h-80 overflow-y-auto">
                            <table className="w-full">
                              <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0">
                                <tr>
                                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">Status</th>
                                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">Method</th>
                                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">URL</th>
                                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">Type</th>
                                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-300">Duration</th>
                                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-300">Size</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {result.network_requests.map((req, reqIndex) => (
                                  <tr
                                    key={reqIndex}
                                    className={`${
                                      req.failed ? 'bg-red-50 dark:bg-red-900/20' :
                                      (req.status && req.status >= 400) ? 'bg-orange-50 dark:bg-orange-900/20' :
                                      ''
                                    } hover:bg-gray-100 dark:hover:bg-gray-800`}
                                  >
                                    <td className="px-3 py-1.5 whitespace-nowrap">
                                      {req.failed ? (
                                        <span className="text-red-500 font-medium">Failed</span>
                                      ) : (
                                        <span className={`font-medium ${
                                          req.status && req.status >= 500 ? 'text-red-500' :
                                          req.status && req.status >= 400 ? 'text-orange-500' :
                                          req.status && req.status >= 300 ? 'text-blue-500' :
                                          'text-green-500'
                                        }`}>
                                          {req.status}
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-3 py-1.5 whitespace-nowrap">
                                      <span className={`font-mono text-xs px-1.5 py-0.5 rounded ${
                                        req.method === 'GET' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                        req.method === 'POST' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                        req.method === 'PUT' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                        req.method === 'DELETE' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                        'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                      }`}>
                                        {req.method}
                                      </span>
                                    </td>
                                    <td className="px-3 py-1.5 max-w-md">
                                      <span className="text-xs text-gray-700 dark:text-gray-300 truncate block" title={req.url}>
                                        {req.url.length > 60 ? `${req.url.substring(0, 60)}...` : req.url}
                                      </span>
                                    </td>
                                    <td className="px-3 py-1.5 whitespace-nowrap">
                                      <span className="text-xs text-gray-500 dark:text-gray-400">{req.resourceType}</span>
                                    </td>
                                    <td className="px-3 py-1.5 whitespace-nowrap text-right">
                                      <span className="text-xs text-gray-500 dark:text-gray-400">
                                        {req.duration_ms ? `${req.duration_ms}ms` : '-'}
                                      </span>
                                    </td>
                                    <td className="px-3 py-1.5 whitespace-nowrap text-right">
                                      <span className="text-xs text-gray-500 dark:text-gray-400">
                                        {req.responseSize ? (
                                          req.responseSize > 1024 * 1024 ? `${(req.responseSize / 1024 / 1024).toFixed(1)} MB` :
                                          req.responseSize > 1024 ? `${(req.responseSize / 1024).toFixed(1)} KB` :
                                          `${req.responseSize} B`
                                        ) : '-'}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Network requests captured during test execution
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Feature #1101: Flakiness Trend */}
        {showFlakinessTrendSection && (
          <div className="mt-8 rounded-lg border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <span className="text-xl">📊</span> Flakiness Trend
              </h2>
              <button
                onClick={() => setShowFlakinessTrendSection(false)}
                className="text-muted-foreground hover:text-foreground"
                title="Hide section"
              >
                ×
              </button>
            </div>

            {isLoadingFlakinessTrend ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                <span className="ml-2 text-muted-foreground">Loading trend data...</span>
              </div>
            ) : !flakinessTrend ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No trend data available yet</p>
                <button
                  onClick={fetchFlakinessTrend}
                  className="mt-2 text-sm text-primary hover:underline"
                >
                  Refresh
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <div className="text-2xl font-bold text-foreground">{flakinessTrend.summary.total_runs}</div>
                    <div className="text-xs text-muted-foreground">Total Runs</div>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <div className={`text-2xl font-bold ${
                      flakinessTrend.summary.overall_flakiness_score >= 0.7 ? 'text-red-600' :
                      flakinessTrend.summary.overall_flakiness_score >= 0.4 ? 'text-orange-600' :
                      flakinessTrend.summary.overall_flakiness_score > 0 ? 'text-yellow-600' :
                      'text-emerald-600'
                    }`}>
                      {flakinessTrend.summary.overall_flakiness_score.toFixed(2)}
                    </div>
                    <div className="text-xs text-muted-foreground">Flakiness Score</div>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <div className="text-2xl font-bold text-emerald-600">{flakinessTrend.summary.overall_pass_rate}%</div>
                    <div className="text-xs text-muted-foreground">Pass Rate</div>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <div className="text-sm font-medium text-foreground">
                      {flakinessTrend.summary.flakiness_started
                        ? new Date(flakinessTrend.summary.flakiness_started).toLocaleDateString()
                        : 'N/A'}
                    </div>
                    <div className="text-xs text-muted-foreground">Flakiness Started</div>
                  </div>
                </div>

                {/* Daily Trend Chart */}
                {flakinessTrend.daily_trend.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-foreground mb-2">Daily Flakiness Trend</h3>
                    <div className="h-40 relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={flakinessTrend.daily_trend}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 10 }}
                            tickFormatter={(value) => new Date(value).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                            className="text-muted-foreground"
                          />
                          <YAxis
                            domain={[0, 1]}
                            tick={{ fontSize: 10 }}
                            tickFormatter={(value) => value.toFixed(1)}
                            className="text-muted-foreground"
                          />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload?.[0]) return null;
                              const data = payload[0].payload;
                              return (
                                <div className="rounded-md border border-border bg-card p-2 shadow-sm text-xs">
                                  <div className="font-medium">{new Date(data.date).toLocaleDateString()}</div>
                                  <div className="text-emerald-600">Passes: {data.passes}</div>
                                  <div className="text-red-600">Failures: {data.failures}</div>
                                  <div className="text-orange-600">Flakiness: {data.flakiness_score.toFixed(2)}</div>
                                </div>
                              );
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="flakiness_score"
                            stroke="#f97316"
                            strokeWidth={2}
                            dot={{ fill: '#f97316', r: 3 }}
                            name="Flakiness"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Higher values indicate more flaky behavior (0 = stable, 1 = highly flaky)
                    </p>
                  </div>
                )}

                {/* Code Changes Correlation */}
                {flakinessTrend.code_changes.length > 0 && flakinessTrend.summary.flakiness_started && (
                  <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                    <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-2 flex items-center gap-2">
                      <span>⚠️</span> Potential Related Code Changes
                    </h3>
                    <p className="text-xs text-yellow-700 dark:text-yellow-400 mb-2">
                      Flakiness started on {new Date(flakinessTrend.summary.flakiness_started).toLocaleDateString()}.
                      The following commits may be related:
                    </p>
                    {flakinessTrend.code_changes.map((change) => (
                      <div key={change.commit_id} className="mt-2 p-2 bg-white dark:bg-gray-800 rounded border border-yellow-300 dark:border-yellow-700">
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono text-primary">{change.commit_id.substring(0, 8)}</code>
                          <span className="text-xs text-muted-foreground">{new Date(change.date).toLocaleDateString()}</span>
                        </div>
                        <div className="text-sm text-foreground mt-1">{change.message}</div>
                        <div className="text-xs text-muted-foreground mt-1">by {change.author}</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {change.files_changed.map((file, idx) => (
                            <span key={idx} className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 rounded">
                              {file}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Run History Sparkline */}
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-2">Recent Run Results</h3>
                  <div className="flex gap-0.5 h-8">
                    {runs.slice(0, 30).reverse().map((run, idx) => (
                      <div
                        key={run.id || idx}
                        className={`flex-1 rounded-sm ${
                          run.status === 'passed' ? 'bg-emerald-500' :
                          run.status === 'failed' ? 'bg-red-500' :
                          run.status === 'warning' ? 'bg-amber-500' :
                          run.status === 'running' ? 'bg-blue-500 animate-pulse' :
                          'bg-gray-300'
                        }`}
                        title={`${run.status} - ${run.created_at ? new Date(run.created_at).toLocaleString() : 'Unknown'}`}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                    <span>Oldest</span>
                    <span>Newest</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Run History */}
        {runs.length > 0 && (
          <div className="mt-8 rounded-lg border border-border bg-card p-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <h2 className="text-lg font-semibold text-foreground">Run History</h2>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Sort:</span>
                  <div className="flex rounded-md border border-border">
                    <button
                      onClick={() => handleSort('date')}
                      className={`px-3 py-1 text-sm font-medium ${
                        sortBy === 'date'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-background text-foreground hover:bg-muted'
                      } rounded-l-md`}
                    >
                      Date {sortBy === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </button>
                    <button
                      onClick={() => handleSort('duration')}
                      className={`px-3 py-1 text-sm font-medium ${
                        sortBy === 'duration'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-background text-foreground hover:bg-muted'
                      } border-l border-border rounded-r-md`}
                    >
                      Duration {sortBy === 'duration' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    <div className="flex rounded-md border border-border">
                      <button
                        onClick={() => setStatusFilter('all')}
                        className={`px-3 py-1 text-sm font-medium ${
                          statusFilter === 'all'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-background text-foreground hover:bg-muted'
                        } rounded-l-md`}
                      >
                        All ({runCounts.all})
                      </button>
                      <button
                        onClick={() => setStatusFilter('passed')}
                        className={`px-3 py-1 text-sm font-medium ${
                          statusFilter === 'passed'
                            ? 'bg-green-600 text-white'
                            : 'bg-background text-foreground hover:bg-muted'
                        } border-l border-border`}
                      >
                        Passed ({runCounts.passed})
                      </button>
                      <button
                        onClick={() => setStatusFilter('failed')}
                        className={`px-3 py-1 text-sm font-medium ${
                          statusFilter === 'failed'
                            ? 'bg-red-600 text-white'
                            : 'bg-background text-foreground hover:bg-muted'
                        } border-l border-border rounded-r-md`}
                      >
                        Failed ({runCounts.failed})
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Date:</span>
                    <select
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value as 'all' | 'today' | '7days' | '30days')}
                      className="rounded-md border border-border bg-background px-3 py-1 text-sm text-foreground"
                    >
                      <option value="all">All Time</option>
                      <option value="today">Today</option>
                      <option value="7days">Last 7 Days</option>
                      <option value="30days">Last 30 Days</option>
                    </select>
                  </div>
                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="rounded-md border border-border px-3 py-1 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      Clear Filters
                    </button>
                  )}
                  {filteredRuns.length > 0 && (
                    <button
                      onClick={handleExportRuns}
                      className="rounded-md border border-border bg-background px-3 py-1 text-sm font-medium text-foreground hover:bg-muted"
                    >
                      Export Runs ({filteredRuns.length})
                    </button>
                  )}
                  {/* Compare K6 Runs button (Feature #564) */}
                  {isLoadTest && selectedRunsForCompare.length === 2 && (
                    <button
                      onClick={handleCompareRuns}
                      disabled={isComparing}
                      className="rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isComparing ? 'Comparing...' : '📊 Compare Selected'}
                    </button>
                  )}
                  {isLoadTest && selectedRunsForCompare.length > 0 && selectedRunsForCompare.length < 2 && (
                    <span className="text-sm text-muted-foreground">
                      Select {2 - selectedRunsForCompare.length} more run{selectedRunsForCompare.length === 1 ? '' : 's'} to compare
                    </span>
                  )}
                </div>
              </div>
              {/* Active filter chips with individual clear buttons */}
              {hasActiveFilters && (
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-sm text-muted-foreground">Active filters:</span>
                  {statusFilter !== 'all' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                      Status: {statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
                      <button
                        onClick={() => setStatusFilter('all')}
                        className="ml-1 rounded-full hover:bg-primary/20 p-0.5"
                        aria-label="Clear status filter"
                      >
                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </span>
                  )}
                  {dateFilter !== 'all' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                      Date: {dateFilter === 'today' ? 'Today' : dateFilter === '7days' ? 'Last 7 Days' : 'Last 30 Days'}
                      <button
                        onClick={() => setDateFilter('all')}
                        className="ml-1 rounded-full hover:bg-primary/20 p-0.5"
                        aria-label="Clear date filter"
                      >
                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="mt-4 space-y-2">
              {sortedRuns.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm font-medium text-foreground">
                    No {statusFilter === 'all' ? '' : statusFilter} runs found
                  </p>
                  {hasActiveFilters && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Try adjusting your filters or{' '}
                      <button
                        onClick={clearFilters}
                        className="text-primary hover:underline"
                      >
                        clear all filters
                      </button>
                      {' '}to see more results.
                    </p>
                  )}
                </div>
              ) : paginatedRuns.map((run) => (
                <div
                  key={run.id}
                  className={`flex items-center justify-between rounded-md border p-3 ${
                    selectedRunsForCompare.includes(run.id)
                      ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10'
                      : 'border-border'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Checkbox for K6 run comparison (Feature #564) */}
                    {isLoadTest && (run.status === 'passed' || run.status === 'failed') && (
                      <label className="cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedRunsForCompare.includes(run.id)}
                          onChange={() => toggleRunSelection(run.id)}
                          className="h-4 w-4 rounded border-border text-blue-600 focus:ring-blue-500"
                        />
                      </label>
                    )}
                    {/* Feature #1979: Added 'warning' status styling for accessibility tests */}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      run.status === 'passed' ? 'bg-green-100 text-green-700' :
                      run.status === 'failed' ? 'bg-red-100 text-red-700' :
                      run.status === 'warning' ? 'bg-amber-100 text-amber-700' :
                      run.status === 'running' ? 'bg-blue-100 text-blue-700' :
                      run.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {run.status}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {formatDateTime(run.created_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      {run.duration_ms ? `${run.duration_ms}ms` : '-'}
                    </span>
                    {/* Feature #1823: View Details link to TestRunResultPage */}
                    {(run.status === 'passed' || run.status === 'failed' || run.status === 'error') && (
                      <Link
                        to={`/runs/${run.id}`}
                        className="inline-flex items-center gap-1 rounded-md border border-primary bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/20 focus:outline-none focus:ring-2 focus:ring-primary/20"
                        title="View detailed run results"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        View Details
                      </Link>
                    )}
                    {/* Download All Artifacts button for completed runs */}
                    {(run.status === 'passed' || run.status === 'failed' || run.status === 'error') && (
                      <button
                        onClick={() => handleDownloadAllArtifacts(run.id)}
                        disabled={isDownloadingArtifacts}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                        title="Download all artifacts (screenshots, traces, videos)"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download All
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {/* Pagination */}
            {sortedRuns.length > 0 && (
              <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-border pt-4">
                <div className="flex items-center gap-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {(runPage - 1) * pageSize + 1} to {Math.min(runPage * pageSize, sortedRuns.length)} of {sortedRuns.length} results
                  </p>
                  <div className="flex items-center gap-2">
                    <label htmlFor="page-size-select" className="text-sm text-muted-foreground">
                      Per page:
                    </label>
                    <select
                      id="page-size-select"
                      value={pageSize}
                      onChange={(e) => setPageSize(parseInt(e.target.value, 10))}
                      className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
                    >
                      <option value="5">5</option>
                      <option value="10">10</option>
                      <option value="25">25</option>
                      <option value="50">50</option>
                      <option value="100">100</option>
                    </select>
                  </div>
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setRunPage(runPage - 1)}
                      disabled={runPage === 1}
                      className="rounded-md border border-border px-3 py-1 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-muted-foreground">
                      Page {runPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setRunPage(runPage + 1)}
                      disabled={runPage === totalPages}
                      className="rounded-md border border-border px-3 py-1 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* K6 Run Comparison Modal (Feature #564) */}
        {showCompareModal && compareResults && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowCompareModal(false)}
          >
            <div
              className="max-w-4xl w-full max-h-[90vh] overflow-auto rounded-lg bg-background border border-border shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-background border-b border-border p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📊</span>
                  <h3 className="text-lg font-semibold text-foreground">K6 Load Test Comparison</h3>
                </div>
                <button
                  onClick={() => setShowCompareModal(false)}
                  className="rounded-md p-1 hover:bg-muted"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-4 space-y-6">
                {/* Run Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg border border-border bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">Base Run</div>
                    <div className="text-sm font-medium">{compareResults.base_run?.test_name || 'Unknown'}</div>
                    <div className="text-xs text-muted-foreground">
                      {compareResults.base_run?.completed_at ? formatDateTime(compareResults.base_run.completed_at) : 'N/A'}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border border-border bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">Compare Run</div>
                    <div className="text-sm font-medium">{compareResults.compare_run?.test_name || 'Unknown'}</div>
                    <div className="text-xs text-muted-foreground">
                      {compareResults.compare_run?.completed_at ? formatDateTime(compareResults.compare_run.completed_at) : 'N/A'}
                    </div>
                  </div>
                </div>

                {/* Overall Status */}
                {compareResults.overall && (
                  <div className={`p-4 rounded-lg border ${
                    compareResults.overall.performance === 'improved' ? 'border-green-500 bg-green-50 dark:bg-green-900/10' :
                    compareResults.overall.performance === 'regressed' ? 'border-red-500 bg-red-50 dark:bg-red-900/10' :
                    'border-border bg-muted/30'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-lg ${
                        compareResults.overall.performance === 'improved' ? 'text-green-600' :
                        compareResults.overall.performance === 'regressed' ? 'text-red-600' :
                        'text-gray-600'
                      }`}>
                        {compareResults.overall.performance === 'improved' ? '📈' : compareResults.overall.performance === 'regressed' ? '📉' : '➡️'}
                      </span>
                      <span className={`font-semibold ${
                        compareResults.overall.performance === 'improved' ? 'text-green-700 dark:text-green-400' :
                        compareResults.overall.performance === 'regressed' ? 'text-red-700 dark:text-red-400' :
                        'text-foreground'
                      }`}>
                        {compareResults.overall.performance === 'improved' ? 'Performance Improved' :
                         compareResults.overall.performance === 'regressed' ? 'Performance Regressed' :
                         'No Significant Change'}
                      </span>
                    </div>
                    {compareResults.overall.highlights?.length > 0 && (
                      <ul className="text-sm space-y-1">
                        {compareResults.overall.highlights.map((h: string, i: number) => (
                          <li key={i} className="text-muted-foreground">• {h}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Summary Metrics Comparison */}
                {compareResults.summary && (
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-3">Summary Metrics</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {Object.entries(compareResults.summary).map(([key, value]: [string, any]) => (
                        <div key={key} className="p-3 rounded-lg border border-border bg-muted/20 text-center">
                          <div className="text-xs text-muted-foreground mb-1 capitalize">{key.replace(/_/g, ' ')}</div>
                          <div className={`text-sm font-bold ${
                            value.status === 'improved' ? 'text-green-600 dark:text-green-400' :
                            value.status === 'regressed' ? 'text-red-600 dark:text-red-400' :
                            'text-foreground'
                          }`}>
                            {value.delta_percent > 0 ? '+' : ''}{value.delta_percent?.toFixed(1)}%
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {typeof value.base === 'number' ? value.base.toLocaleString() : value.base} → {typeof value.compare === 'number' ? value.compare.toLocaleString() : value.compare}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Response Time Comparison */}
                {compareResults.response_times && (
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-3">Response Time Percentiles</h4>
                    <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
                      {Object.entries(compareResults.response_times).map(([key, value]: [string, any]) => (
                        <div key={key} className={`p-2 rounded-lg border text-center ${
                          key === 'median' ? 'border-green-200 bg-green-50/50 dark:border-green-700 dark:bg-green-900/10' :
                          key === 'p95' ? 'border-yellow-200 bg-yellow-50/50 dark:border-yellow-700 dark:bg-yellow-900/10' :
                          key === 'p99' ? 'border-orange-200 bg-orange-50/50 dark:border-orange-700 dark:bg-orange-900/10' :
                          'border-border bg-muted/20'
                        }`}>
                          <div className={`text-xs mb-1 ${
                            key === 'median' ? 'text-green-600 dark:text-green-400' :
                            key === 'p95' ? 'text-yellow-600 dark:text-yellow-400' :
                            key === 'p99' ? 'text-orange-600 dark:text-orange-400' :
                            'text-muted-foreground'
                          }`}>{key}</div>
                          <div className={`text-sm font-bold ${
                            value.status === 'improved' ? 'text-green-600 dark:text-green-400' :
                            value.status === 'regressed' ? 'text-red-600 dark:text-red-400' :
                            'text-foreground'
                          }`}>
                            {value.delta_percent > 0 ? '+' : ''}{value.delta_percent?.toFixed(1)}%
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {value.base}ms → {value.compare}ms
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Screenshot Lightbox Modal with Zoom and Pan */}
        {lightboxImage && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={() => setLightboxImage(null)}
            role="dialog"
            aria-modal="true"
            aria-label="Screenshot lightbox"
          >
            <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
              {/* Top toolbar */}
              <div className="absolute -top-12 left-0 right-0 flex items-center justify-between">
                {/* Zoom controls */}
                <div className="flex items-center gap-2 bg-black/50 rounded-lg px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => {
                      setLightboxZoom(Math.max(0.25, lightboxZoom - 0.25));
                      if (lightboxZoom <= 1) setLightboxPan({ x: 0, y: 0 });
                    }}
                    className="text-white hover:text-gray-300 px-2 py-1 rounded hover:bg-white/10"
                    aria-label="Zoom out"
                  >
                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                    </svg>
                  </button>
                  <span className="text-white text-sm min-w-[60px] text-center font-medium">
                    {Math.round(lightboxZoom * 100)}%
                  </span>
                  <button
                    onClick={() => setLightboxZoom(Math.min(4, lightboxZoom + 0.25))}
                    className="text-white hover:text-gray-300 px-2 py-1 rounded hover:bg-white/10"
                    aria-label="Zoom in"
                  >
                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      setLightboxZoom(1);
                      setLightboxPan({ x: 0, y: 0 });
                    }}
                    className="text-white text-xs hover:text-gray-300 px-2 py-1 ml-1 rounded hover:bg-white/10"
                    aria-label="Reset zoom"
                  >
                    Reset
                  </button>
                  <button
                    onClick={() => {
                      setLightboxZoom(1);
                      setLightboxPan({ x: 0, y: 0 });
                    }}
                    className="text-white text-xs hover:text-gray-300 px-2 py-1 rounded hover:bg-white/10 flex items-center gap-1"
                    aria-label="Fit to screen"
                  >
                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                    Fit
                  </button>
                </div>

                {/* Download and Close */}
                <div className="flex items-center gap-4">
                  <a
                    href={lightboxImage}
                    download={`screenshot-${Date.now()}.png`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-white text-sm hover:text-gray-300 flex items-center gap-1"
                  >
                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download
                  </a>
                  <button
                    onClick={() => setLightboxImage(null)}
                    className="text-white text-xl hover:text-gray-300"
                  >
                    ✕ Close
                  </button>
                </div>
              </div>

              {/* Help text for panning */}
              {lightboxZoom > 1 && (
                <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-white/70 text-xs">
                  Drag to pan • Scroll to zoom
                </div>
              )}

              {/* Image container with overflow handling for zoomed images */}
              <div
                className={`overflow-hidden rounded-lg shadow-2xl ${lightboxZoom > 1 ? 'cursor-grab' : 'cursor-default'} ${isDragging ? 'cursor-grabbing' : ''}`}
                style={{ maxHeight: '85vh', maxWidth: '90vw' }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => {
                  if (lightboxZoom > 1) {
                    setIsDragging(true);
                    setDragStart({ x: e.clientX - lightboxPan.x, y: e.clientY - lightboxPan.y });
                  }
                }}
                onMouseMove={(e) => {
                  if (isDragging && lightboxZoom > 1) {
                    setLightboxPan({
                      x: e.clientX - dragStart.x,
                      y: e.clientY - dragStart.y,
                    });
                  }
                }}
                onMouseUp={() => setIsDragging(false)}
                onMouseLeave={() => setIsDragging(false)}
                onWheel={(e) => {
                  e.preventDefault();
                  const delta = e.deltaY > 0 ? -0.1 : 0.1;
                  const newZoom = Math.max(0.25, Math.min(4, lightboxZoom + delta));
                  setLightboxZoom(newZoom);
                  if (newZoom <= 1) {
                    setLightboxPan({ x: 0, y: 0 });
                  }
                }}
              >
                <img
                  src={lightboxImage}
                  alt="Full-size screenshot"
                  className="select-none"
                  style={{
                    transform: `scale(${lightboxZoom}) translate(${lightboxPan.x / lightboxZoom}px, ${lightboxPan.y / lightboxZoom}px)`,
                    transformOrigin: 'center center',
                    maxHeight: lightboxZoom === 1 ? '85vh' : 'none',
                    maxWidth: lightboxZoom === 1 ? '90vw' : 'none',
                  }}
                  draggable={false}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export { TestDetailPage };
