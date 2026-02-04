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
// Feature #48: Import modular types and utilities
import {
  TestSuite,
  TestType,
  TestRunType,
  ConsoleLog,
  NetworkRequest,
  TestRunResult,
  StepResult,
  TestStatus,
  RunStatus,
  ResultStatus,
  StepStatus,
  TestCategory,
  TestStatusBadge,
  formatDuration,
  formatDateTime,
  formatRelativeTime,
  getStatusColorClass,
  getStatusBadgeClass,
  getStatusIcon,
  getStatusLabel,
  getTestTypeLabel,
  getTestTypeColorClass,
  getTestTypeBadgeClass,
  getTestTypeIcon,
  formatPercentage,
  formatBytes,
  getLighthouseScoreColorClass,
  getLighthouseScoreBadgeClass,
  getImpactColorClass,
  getImpactBadgeClass,
  calculatePassRate,
  truncateText,
  // Feature #48: Import extracted components
  VideoPlayer,
  DeleteTestModal,
  ApproveBaselineModal,
  RestoreBaselineModal,
  MergeBaselineModal,
  RejectChangesModal,
  FlakinessPanel,
  FlakinessTrend,
  ImageLightbox,
  K6CompareModal,
  K6CompareResults,
  RunHistorySection,
  EditTestModal,
  AddStepModal,
  AIExplainModal,
  TestExplanation,
  QuickScheduleModal,
  ViewCodeTab,
  K6ScriptTab,
  TestDetailsCard,
  TestStepsTab,
  BaselineTab,
  LiveExecutionPanel,
  TestHeader,
  TestResultCard,
} from '../components/test-detail';

// Removed inline type definitions - now imported from test-detail module (Feature #48)
// Removed VideoPlayer - now imported from test-detail module (Feature #48)

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
  const [liveScreenshot, setLiveScreenshot] = useState<string | null>(null);
  const [liveConsoleLogs, setLiveConsoleLogs] = useState<Array<{ level: string; message: string; timestamp: number }>>([]);

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

  // Feature #1101: Flakiness trend tracking state - Feature #48: Use imported type
  const [flakinessTrend, setFlakinessTrend] = useState<FlakinessTrend | null>(null);
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

  // Quick schedule modal state - Feature #48: State moved to QuickScheduleModal component
  const [showQuickScheduleModal, setShowQuickScheduleModal] = useState(false);
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

  // AI Explanation state - Feature #48: Use imported TestExplanation type
  const [showExplainModal, setShowExplainModal] = useState(false);
  const [testExplanation, setTestExplanation] = useState<TestExplanation | null>(null);
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

  // K6 run comparison state (Feature #564) - Feature #48: Use imported type
  const [selectedRunsForCompare, setSelectedRunsForCompare] = useState<string[]>([]);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [compareResults, setCompareResults] = useState<K6CompareResults | null>(null);
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
  // Feature #48: Updated to accept data from QuickScheduleModal component
  const handleCreateQuickScheduleFromModal = async (data: {
    name: string;
    type: 'recurring' | 'one-time';
    cron: string;
    runAt: string;
    timezone: string;
  }) => {
    if (!test || !suite) return;

    setIsCreatingSchedule(true);
    setQuickScheduleError('');

    try {
      const scheduleData: Record<string, unknown> = {
        name: data.name || `${test.name} Schedule`,
        description: `Automated schedule for test: ${test.name}`,
        test_suite_id: suite.id,
        tests: [test.id],
        browsers: [suite.default_browser || 'chromium'],
        enabled: true,
        timezone: data.timezone,
        notify_on_failure: true,
      };

      if (data.type === 'one-time') {
        scheduleData.run_at = data.runAt;
      } else {
        scheduleData.cron_expression = data.cron;
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
        const responseData = await response.json();
        throw new Error(responseData.message || 'Failed to create schedule');
      }

      // Success - close modal and show notification
      setShowQuickScheduleModal(false);
      addNotification({
        type: 'success',
        title: 'Schedule Created',
        message: `Schedule "${data.name || test.name + ' Schedule'}" created successfully`,
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

    // K6 load test progress handler -- only populate k6Metrics for load tests
    const handleStepProgress = (data: { runId: string; stepId?: string; phase: string; progress: number; currentVUs?: number; totalRequests?: number; requestsPerSecond?: number; avgResponseTime?: number; errorRate?: number; p50ResponseTime?: number; p95ResponseTime?: number; p99ResponseTime?: number }) => {
      console.log('[WebSocket] step-progress event:', data);
      if (data.runId === currentRun.id) {
        // Only show k6 metrics panel for actual load tests (stepId === 'load_test')
        // Lighthouse and other executors also emit step-progress but with different stepIds
        if (test?.test_type === 'load' || data.stepId === 'load_test') {
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
        } else {
          // For non-load tests, just update the progress bar
          setLiveProgress(prev => prev ? {
            ...prev,
            currentStep: { ...prev.currentStep, action: data.phase },
          } : null);
        }
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
        const headers = { 'Authorization': `Bearer ${token}` };

        // Fetch test and runs in parallel (both only need testId)
        const [testResponse, runsResponse] = await Promise.all([
          fetch(`/api/v1/tests/${testId}`, { headers }),
          fetch(`/api/v1/tests/${testId}/runs`, { headers }),
        ]);

        if (!testResponse.ok) {
          setError('Test not found');
          return;
        }

        const [testData, runsData] = await Promise.all([
          testResponse.json(),
          runsResponse.ok ? runsResponse.json() : { runs: [] },
        ]);

        setTest(testData.test);
        if (runsData.runs) setRuns(runsData.runs);

        // Fetch suite and project in parallel (suite needs suite_id from test)
        if (testData.test.suite_id) {
          const suiteResponse = await fetch(`/api/v1/suites/${testData.test.suite_id}`, { headers });
          if (suiteResponse.ok) {
            const suiteData = await suiteResponse.json();
            setSuite(suiteData.suite);

            if (suiteData.suite.project_id) {
              const projectResponse = await fetch(`/api/v1/projects/${suiteData.suite.project_id}`, { headers });
              if (projectResponse.ok) {
                const projectData = await projectResponse.json();
                setProject(projectData.project);
              }
            }
          }
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
        {/* Feature #48: Extracted TestHeader component */}
        <TestHeader
          test={test}
          project={project}
          suite={suite}
          selectedBranch={selectedBranch}
          availableBranches={availableBranches}
          onBranchChange={setSelectedBranch}
          onAddBranch={(newBranch) => {
            if (!availableBranches.includes(newBranch)) {
              setAvailableBranches([...availableBranches, newBranch]);
            }
            setSelectedBranch(newBranch);
          }}
          isRunning={isRunning}
          canRun={canRun}
          canEdit={canEdit}
          canDelete={canDelete}
          isDuplicating={isDuplicating}
          isCancellingRun={isCancellingRun}
          onRunTest={handleRunTest}
          onCancelRun={handleCancelRun}
          onSchedule={() => setShowQuickScheduleModal(true)}
          onEditTest={handleOpenEditModal}
          onDuplicate={handleDuplicate}
          onDelete={() => setShowDeleteModal(true)}
          runError={runError}
          duplicateError={duplicateError}
        />

        {/* Delete Confirmation Modal - Feature #48: Extracted to component */}
        {showDeleteModal && (
          <DeleteTestModal
            testName={test?.name || ''}
            isDeleting={isDeleting}
            deleteError={deleteError}
            onClose={() => setShowDeleteModal(false)}
            onDelete={handleDelete}
          />
        )}

        {/* AI Explain Test Modal - Feature #48: Extracted to component */}
        <AIExplainModal
          show={showExplainModal}
          testName={test?.name || ''}
          isLoading={isExplainingTest}
          explanation={testExplanation}
          onClose={() => setShowExplainModal(false)}
        />

        {/* Quick Schedule Modal - Feature #48: Extracted to component */}
        <QuickScheduleModal
          show={showQuickScheduleModal}
          testName={test?.name || ''}
          isCreating={isCreatingSchedule}
          error={quickScheduleError}
          onClose={() => setShowQuickScheduleModal(false)}
          onSubmit={handleCreateQuickScheduleFromModal}
        />

        {/* Approve Baseline Confirmation Modal - Feature #48: Using extracted component */}
        {showApproveBaselineModal && (
          <ApproveBaselineModal
            testName={test?.name || ''}
            approvingBaseline={approvingBaseline}
            approveBaselineError={approveBaselineError}
            currentRun={currentRun as any}
            testId={test?.id}
            runId={approveBaselineRunId}
            onClose={() => {
              setShowApproveBaselineModal(false);
              setApproveBaselineRunId(null);
              setApproveBaselineError('');
            }}
            onApprove={handleApproveBaseline}
          />
        )}

        {/* Restore Baseline Confirmation Modal - Feature #48: Using extracted component */}
        {showRestoreBaselineModal && (
          <RestoreBaselineModal
            testName={test?.name || ''}
            restoringBaseline={restoringBaseline}
            restoreBaselineError={restoreBaselineError}
            restoreHistoryEntry={restoreHistoryEntry}
            onClose={() => {
              setShowRestoreBaselineModal(false);
              setRestoreHistoryEntry(null);
              setRestoreBaselineError('');
            }}
            onRestore={handleRestoreBaseline}
          />
        )}

        {/* Merge Baseline Modal - Feature #48: Using extracted component */}
        {showMergeBaselineModal && (
          <MergeBaselineModal
            selectedBranch={selectedBranch}
            selectedMergeBranch={selectedMergeBranch}
            isMergingBaseline={isMergingBaseline}
            mergeBaselineError={mergeBaselineError}
            onClose={() => {
              setShowMergeBaselineModal(false);
              setSelectedMergeBranch(null);
              setMergeBaselineError('');
            }}
            onMerge={handleMergeBaseline}
          />
        )}

        {/* Reject Changes Confirmation Modal - Feature #48: Using extracted component */}
        {showRejectChangesModal && (
          <RejectChangesModal
            testName={test?.name || ''}
            rejectingChanges={rejectingChanges}
            rejectChangesError={rejectChangesError}
            rejectionReason={rejectionReason}
            onReasonChange={setRejectionReason}
            runId={rejectChangesRunId}
            onClose={() => {
              setShowRejectChangesModal(false);
              setRejectChangesRunId(null);
              setRejectChangesError('');
              setRejectionReason('');
            }}
            onReject={handleRejectChanges}
          />
        )}

        {/* Edit Modal - Feature #48: Extracted to component */}
        <EditTestModal
          show={showEditModal}
          editName={editName}
          editDescription={editDescription}
          editError={editError}
          isEditing={isEditing}
          isDirty={isDirty}
          onNameChange={setEditName}
          onDescriptionChange={setEditDescription}
          onSubmit={handleEdit}
          onClose={() => setShowEditModal(false)}
          onShowUnsavedChanges={() => {
            setShowUnsavedChangesModal(true);
            setPendingNavigation(() => () => {
              setShowEditModal(false);
              setIsDirty(false);
            });
          }}
        />

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

        {/* Test Details - Feature #48: Using extracted TestDetailsCard component */}
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <TestDetailsCard
            test={test as any}
            suiteName={suite?.name}
            formatDate={formatDate}
          />

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

            {/* Steps Tab Content - Feature #48: Extracted to TestStepsTab component */}
            {activeTab === 'steps' && (
              <TestStepsTab
                test={test}
                hasReorderedSteps={hasReorderedSteps}
                isSavingStepOrder={isSavingStepOrder}
                draggedStepIndex={draggedStepIndex}
                dragOverIndex={dragOverIndex}
                onSaveStepOrder={handleSaveStepOrder}
                onStepDragStart={handleStepDragStart}
                onStepDragEnd={handleStepDragEnd}
                onStepDragOver={handleStepDragOver}
                onStepDrop={handleStepDrop}
              />
            )}

            {/* View Code Tab Content - Feature #48: Extracted to ViewCodeTab component */}
            {activeTab === 'code' && (
              <ViewCodeTab
                test={test}
                canEdit={canEdit}
                isEditingCode={isEditingCode}
                editedCode={editedCode}
                codeError={codeError}
                isSavingCode={isSavingCode}
                isExplainingTest={isExplainingTest}
                onSetEditedCode={setEditedCode}
                onStartEditCode={handleStartEditCode}
                onCancelEditCode={handleCancelEditCode}
                onSaveCode={handleSaveCode}
                onRevertToSteps={handleRevertToSteps}
                onExplainTest={handleExplainTest}
                generatePlaywrightCode={generatePlaywrightCode}
              />
            )}

            {/* K6 Script Tab Content - Feature #48: Use extracted K6ScriptTab component */}
            {activeTab === 'k6script' && test?.test_type === 'load' && (
              <K6ScriptTab
                test={test}
                canEdit={canEdit}
                isEditingK6Script={isEditingK6Script}
                k6Script={k6Script}
                isSavingK6Script={isSavingK6Script}
                token={token}
                k6Templates={k6Templates}
                showK6Templates={showK6Templates}
                onSetK6Script={setK6Script}
                onSetIsEditingK6Script={setIsEditingK6Script}
                onSetShowK6Templates={setShowK6Templates}
                generateK6Script={generateK6Script}
              />
            )}

            {/* Baseline Tab Content - Feature #48: Extracted to BaselineTab component */}
            {activeTab === 'baseline' && test?.test_type === 'visual_regression' && (
              <BaselineTab
                testId={testId!}
                selectedBranch={selectedBranch}
                availableBranches={availableBranches}
                loadingBaseline={loadingBaseline}
                baselineData={baselineData}
                isRunning={isRunning}
                mergeableBranches={mergeableBranches}
                baselineHistory={baselineHistory}
                loadingBaselineHistory={loadingBaselineHistory}
                selectedHistoryVersion={selectedHistoryVersion}
                historyVersionImage={historyVersionImage}
                loadingHistoryImage={loadingHistoryImage}
                onRunTest={handleRunTest}
                onSetSelectedMergeBranch={setSelectedMergeBranch}
                onSetShowMergeBaselineModal={setShowMergeBaselineModal}
                onSetLightboxImage={setLightboxImage}
                onSetSelectedHistoryVersion={setSelectedHistoryVersion}
                onSetHistoryVersionImage={setHistoryVersionImage}
                onSetRestoreHistoryEntry={setRestoreHistoryEntry}
                onSetShowRestoreBaselineModal={setShowRestoreBaselineModal}
                onSetRestoreBaselineError={setRestoreBaselineError}
              />
            )}
          </div>
        </div>

        {/* Add Step Modal - Feature #48: Extracted to component */}
        <AddStepModal
          show={showAddStepModal}
          newStepAction={newStepAction}
          newStepSelector={newStepSelector}
          newStepValue={newStepValue}
          newStepCheckpointName={newStepCheckpointName}
          newStepCheckpointThreshold={newStepCheckpointThreshold}
          newStepA11yWcagLevel={newStepA11yWcagLevel}
          newStepA11yThreshold={newStepA11yThreshold}
          newStepA11yFailOnCritical={newStepA11yFailOnCritical}
          newStepA11yFailOnAny={newStepA11yFailOnAny}
          showSelectorAutocomplete={showSelectorAutocomplete}
          selectorAutocomplete={selectorAutocomplete}
          showValueAutocomplete={showValueAutocomplete}
          valueAutocomplete={valueAutocomplete}
          addStepError={addStepError}
          isAddingStep={isAddingStep}
          targetUrl={test?.target_url}
          onActionChange={setNewStepAction}
          onSelectorChange={setNewStepSelector}
          onValueChange={setNewStepValue}
          onCheckpointNameChange={setNewStepCheckpointName}
          onCheckpointThresholdChange={setNewStepCheckpointThreshold}
          onA11yWcagLevelChange={setNewStepA11yWcagLevel}
          onA11yThresholdChange={setNewStepA11yThreshold}
          onA11yFailOnCriticalChange={setNewStepA11yFailOnCritical}
          onA11yFailOnAnyChange={setNewStepA11yFailOnAny}
          onSelectorKeyDown={handleSelectorKeyDown}
          onValueKeyDown={handleValueKeyDown}
          onSubmit={handleAddStep}
          onClose={() => setShowAddStepModal(false)}
        />

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

              {/* Live Execution Panel - Feature #48: Extracted to component */}
              <LiveExecutionPanel
                currentRun={currentRun as any}
                test={test}
                liveProgress={liveProgress}
                liveScreenshot={liveScreenshot}
                liveConsoleLogs={liveConsoleLogs}
                isCancellingRun={isCancellingRun}
                onCancelRun={handleCancelRun}
              />

              {/* Test Results - Feature #48: Extracted to TestResultCard component */}
              {currentRun.results && currentRun.results.length > 0 && (
                <div className="mt-4 space-y-4">
                  {currentRun.results.map((result) => (
                    <TestResultCard
                      key={result.test_id}
                      result={result as any}
                      testType={test?.test_type}
                      token={token || ''}
                      comparisonViewMode={comparisonViewMode}
                      setComparisonViewMode={setComparisonViewMode}
                      sliderPosition={sliderPosition}
                      setSliderPosition={setSliderPosition}
                      onionSkinOpacity={onionSkinOpacity}
                      setOnionSkinOpacity={setOnionSkinOpacity}
                      diffOverlayOpacity={diffOverlayOpacity}
                      setDiffOverlayOpacity={setDiffOverlayOpacity}
                      imageZoomLevel={imageZoomLevel}
                      setImageZoomLevel={setImageZoomLevel}
                      baselineContainerRef={baselineContainerRef}
                      currentContainerRef={currentContainerRef}
                      diffContainerRef={diffContainerRef}
                      handleSyncScroll={handleSyncScroll}
                      onOpenLightbox={setLightboxImage}
                      onApproveBaseline={(runId) => handleApproveBaseline(runId)}
                      onRejectChanges={(runId) => handleRejectChanges(runId)}
                      a11ySeverityFilter={a11ySeverityFilter as any}
                      setA11ySeverityFilter={setA11ySeverityFilter as any}
                      a11yCategoryFilter={a11yCategoryFilter as any}
                      setA11yCategoryFilter={setA11yCategoryFilter as any}
                      a11ySearchQuery={a11ySearchQuery as any}
                      setA11ySearchQuery={setA11ySearchQuery as any}
                      formatDateTime={formatDateTime}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Feature #1101: Flakiness Trend - Feature #48: Extracted to component */}
        <FlakinessPanel
          isLoading={isLoadingFlakinessTrend}
          flakinessTrend={flakinessTrend}
          runs={runs}
          showSection={showFlakinessTrendSection}
          onHideSection={() => setShowFlakinessTrendSection(false)}
          onRefresh={fetchFlakinessTrend}
        />

        {/* Run History - Feature #48: Extracted to component */}
        <RunHistorySection
          runs={runs}
          filteredRuns={filteredRuns}
          sortedRuns={sortedRuns}
          paginatedRuns={paginatedRuns}
          runCounts={runCounts}
          statusFilter={statusFilter}
          dateFilter={dateFilter}
          sortBy={sortBy}
          sortOrder={sortOrder}
          runPage={runPage}
          pageSize={pageSize}
          totalPages={totalPages}
          hasActiveFilters={hasActiveFilters}
          isLoadTest={isLoadTest}
          selectedRunsForCompare={selectedRunsForCompare}
          isComparing={isComparing}
          isDownloadingArtifacts={isDownloadingArtifacts}
          formatDateTime={formatDateTime}
          onSetStatusFilter={setStatusFilter}
          onSetDateFilter={setDateFilter}
          onSort={handleSort}
          onSetRunPage={setRunPage}
          onSetPageSize={setPageSize}
          onClearFilters={clearFilters}
          onExportRuns={handleExportRuns}
          onToggleRunSelection={toggleRunSelection}
          onCompareRuns={handleCompareRuns}
          onDownloadAllArtifacts={handleDownloadAllArtifacts}
        />

        {/* K6 Run Comparison Modal - Feature #48: Extracted to component */}
        <K6CompareModal
          show={showCompareModal}
          results={compareResults}
          onClose={() => setShowCompareModal(false)}
          formatDateTime={formatDateTime}
        />

        {/* Screenshot Lightbox Modal - Feature #48: Extracted to component */}
        <ImageLightbox
          image={lightboxImage}
          onClose={() => setLightboxImage(null)}
          zoom={lightboxZoom}
          setZoom={setLightboxZoom}
          pan={lightboxPan}
          setPan={setLightboxPan}
          isDragging={isDragging}
          setIsDragging={setIsDragging}
          dragStart={dragStart}
          setDragStart={setDragStart}
        />
      </div>
    </Layout>
  );
}

export { TestDetailPage };
