// Feature #48: TestResultCard Types - Extracted from TestResultCard.tsx
// Contains all interface definitions and helper functions for test result display

import { AccessibilityExportData } from '../exportUtils';

// Result types
export interface StepResult {
 step_id: string;
 action: string;
 status: 'passed' | 'failed' | 'skipped' | 'pending';
 duration_ms?: number;
 error?: string;
 screenshot_base64?: string;
}

export interface VisualComparison {
 hasBaseline: boolean;
 baselineCorrupted?: boolean;
 corruptionError?: string;
 mismatchedPixels?: number;
 totalPixels?: number;
 diffImageBase64?: string;
 baselineImageBase64?: string;
 currentImageBase64?: string;
}

export interface K6Results {
 status: string;
 duration_ms?: number;
 vus_max?: number;
 iterations?: number;
 http_reqs?: number;
 http_req_duration_avg?: number;
 http_req_duration_med?: number;
 http_req_duration_p90?: number;
 http_req_duration_p95?: number;
 http_req_failed?: number;
 data_received?: number;
 data_sent?: number;
 error?: string;
 thresholds?: Record<string, { passed: boolean; value: string }>;
 checks?: Array<{ name: string; passes: number; fails: number }>;
 metrics_over_time?: Array<{
 timestamp: number;
 vus: number;
 rps: number;
 response_time: number;
 error_rate: number;
 }>;
 response_codes?: Record<string, number>;
}

/** Lighthouse opportunity suggestion */
export interface LighthouseOpportunityItem {
 id: string;
 title: string;
 description?: string;
 score?: number;
 savings?: number;
 numericValue?: number;
 displayValue?: string;
}

/** Lighthouse diagnostic info */
export interface LighthouseDiagnosticItem {
 id: string;
 title: string;
 description?: string;
 score?: number;
 displayValue?: string;
 details?: Record<string, unknown>;
}

/** Lighthouse passed audit */
export interface LighthousePassedAuditItem {
 id: string;
 title: string;
 description?: string;
 score?: number;
}

// Feature #67: Device-specific Lighthouse results
export interface DeviceLighthouseMetrics {
 device: 'mobile' | 'desktop';
 performance_score: number;
 accessibility_score: number;
 best_practices_score: number;
 seo_score: number;
 metrics: {
 first_contentful_paint: number;
 largest_contentful_paint: number;
 cumulative_layout_shift: number;
 total_blocking_time: number;
 speed_index: number;
 time_to_interactive?: number;
 time_to_first_byte?: number;
 };
 opportunities?: LighthouseOpportunityItem[];
 diagnostics?: LighthouseDiagnosticItem[];
 passed_audits?: LighthousePassedAuditItem[];
}

export interface LighthouseResults {
 performance: number;
 accessibility: number;
 bestPractices: number;
 seo: number;
 lcp?: number;
 fcp?: number;
 cls?: number;
 inp?: number;
 tbt?: number;
 ttfb?: number;
 speedIndex?: number;
 passedAudits?: Array<{ id: string; title: string; description: string }>;
 failedAudits?: Array<{ id: string; title: string; description: string; score: number }>;
 csp?: { detected: boolean; blocksLighthouse: boolean; directives?: string[] };
 authenticationRequired?: boolean;
 error?: string;
 unreachable?: boolean;
 timedOut?: boolean;
 browserCrash?: boolean;
 nonHtmlResponse?: boolean;
 // Feature #67: Both mobile and desktop results
 mobileResults?: DeviceLighthouseMetrics;
 desktopResults?: DeviceLighthouseMetrics;
}

export interface AccessibilityResults {
 score: number;
 url?: string;
 wcag_level?: string;
 violations: {
 count: number;
 critical?: number;
 serious?: number;
 moderate?: number;
 minor?: number;
 items?: Array<{
 id: string;
 impact: string;
 description: string;
 help: string;
 helpUrl: string;
 nodes?: Array<{ html: string; target: string[] }>;
 tags?: string[];
 }>;
 };
 passes?: { count: number };
 incomplete?: { count: number };
 inapplicable?: { count: number };
}

export interface TestResult {
 test_id: string;
 test_name?: string;
 status: 'passed' | 'failed' | 'running' | 'pending' | 'error' | 'warning' | 'skipped';
 duration_ms?: number;
 error?: string;
 steps?: StepResult[];
 screenshot_base64?: string;
 visual_comparison?: VisualComparison;
 diff_percentage?: number;
 k6_results?: K6Results;
 lighthouse?: LighthouseResults;
 a11y_results?: AccessibilityResults;
 // Error indicators
 isQuotaExceeded?: boolean;
 suggestions?: string[];
 screenshotTimedOut?: boolean;
 screenshotTimeoutDuration?: number;
 navigationError?: boolean;
 navigationErrorUrl?: string;
 navigationErrorCode?: string;
 browserCrash?: boolean;
 crashReason?: string;
 pageOversized?: boolean;
 oversizedDimensions?: { width: number; height: number };
 k6ImportError?: boolean;
 k6ImportErrorDetails?: string;
 k6ThresholdConfigError?: boolean;
 k6ThresholdConfigErrors?: string[];
 k6SyntaxError?: boolean;
 k6SyntaxErrorDetails?: string;
 k6RuntimeError?: boolean;
 k6RuntimeErrorDetails?: string;
 k6ServerUnavailable?: boolean;
 k6ServerErrorDetails?: string;
 k6ResourceExhausted?: boolean;
 k6ResourceErrorDetails?: string;
}

export interface TestResultCardProps {
 result: TestResult;
 testType?: string;
 token: string;
 // Visual comparison controls
 comparisonViewMode: 'side-by-side' | 'slider' | 'onion-skin' | 'diff' | 'diff-overlay';
 setComparisonViewMode: (mode: 'side-by-side' | 'slider' | 'onion-skin' | 'diff' | 'diff-overlay') => void;
 sliderPosition: number;
 setSliderPosition: (pos: number) => void;
 onionSkinOpacity: number;
 setOnionSkinOpacity: (opacity: number) => void;
 diffOverlayOpacity: number;
 setDiffOverlayOpacity: (opacity: number) => void;
 imageZoomLevel: 'fit' | '100' | '50' | '200';
 setImageZoomLevel: (level: 'fit' | '100' | '50' | '200') => void;
 // Refs for synchronized scrolling
 baselineContainerRef: React.RefObject<HTMLDivElement>;
 currentContainerRef: React.RefObject<HTMLDivElement>;
 diffContainerRef: React.RefObject<HTMLDivElement>;
 handleSyncScroll: (source: 'baseline' | 'current' | 'diff') => void;
 // Callbacks
 onOpenLightbox: (imageUrl: string) => void;
 onApproveBaseline: (runId: string) => void;
 onRejectChanges: (runId: string) => void;
 // Accessibility filters (per-result keyed by result.test_id)
 a11ySeverityFilter: Record<string, string>;
 setA11ySeverityFilter: (filters: Record<string, string>) => void;
 a11yCategoryFilter: Record<string, string>;
 setA11yCategoryFilter: (filters: Record<string, string>) => void;
 a11ySearchQuery: Record<string, string>;
 setA11ySearchQuery: (queries: Record<string, string>) => void;
 // Lighthouse history for charts
 lighthouseHistory?: Array<{
 run_id: string;
 started_at: string;
 performance: number;
 accessibility: number;
 bestPractices: number;
 seo: number;
 }>;
 // PDF/CSV export functions
 onExportAccessibilityPDF?: (a11yData: AccessibilityExportData, testName: string, runDate: string) => void;
 onExportAccessibilityCSV?: (a11yData: AccessibilityExportData, testName: string, runDate: string) => void;
 formatDateTime: (date: string | Date) => string;
}

// Helper function to get score color
export const getScoreColor = (score: number): string => {
 if (score >= 90) return 'text-success';
 if (score >= 50) return 'text-warning';
 return 'text-destructive';
};

export const getScoreBgColor = (score: number): string => {
 if (score >= 90) return 'bg-success/10';
 if (score >= 50) return 'bg-warning/10';
 return 'bg-destructive/10';
};
