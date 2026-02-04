// Feature #48: TestResultCard - Extracted from TestDetailPage.tsx
// Renders a single test result including all test type specific displays
// (E2E, Visual Regression, Lighthouse, Accessibility, K6 Load Test)

import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { toast } from '../../stores/toastStore';

// Result types
interface StepResult {
  step_id: string;
  action: string;
  status: 'passed' | 'failed' | 'skipped' | 'pending';
  duration_ms?: number;
  error?: string;
  screenshot_base64?: string;
}

interface VisualComparison {
  hasBaseline: boolean;
  baselineCorrupted?: boolean;
  corruptionError?: string;
  mismatchedPixels?: number;
  totalPixels?: number;
  diffImageBase64?: string;
  baselineImageBase64?: string;
  currentImageBase64?: string;
}

interface K6Results {
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

interface LighthouseResults {
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
}

interface AccessibilityResults {
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

interface TestResult {
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

interface TestResultCardProps {
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
  onExportAccessibilityPDF?: (a11yData: any, testName: string, runDate: string) => void;
  onExportAccessibilityCSV?: (a11yData: any, testName: string, runDate: string) => void;
  formatDateTime: (date: string | Date) => string;
}

// Helper function to get score color
const getScoreColor = (score: number): string => {
  if (score >= 90) return 'text-green-600';
  if (score >= 50) return 'text-amber-600';
  return 'text-red-600';
};

const getScoreBgColor = (score: number): string => {
  if (score >= 90) return 'bg-green-100 dark:bg-green-900/30';
  if (score >= 50) return 'bg-amber-100 dark:bg-amber-900/30';
  return 'bg-red-100 dark:bg-red-900/30';
};

export function TestResultCard({
  result,
  testType,
  token,
  comparisonViewMode,
  setComparisonViewMode,
  sliderPosition,
  setSliderPosition,
  onionSkinOpacity,
  setOnionSkinOpacity,
  diffOverlayOpacity,
  setDiffOverlayOpacity,
  imageZoomLevel,
  setImageZoomLevel,
  baselineContainerRef,
  currentContainerRef,
  diffContainerRef,
  handleSyncScroll,
  onOpenLightbox,
  onApproveBaseline,
  onRejectChanges,
  a11ySeverityFilter,
  setA11ySeverityFilter,
  a11yCategoryFilter,
  setA11yCategoryFilter,
  a11ySearchQuery,
  setA11ySearchQuery,
  lighthouseHistory = [],
  onExportAccessibilityPDF,
  onExportAccessibilityCSV,
  formatDateTime,
}: TestResultCardProps) {
  const [expandedViolations, setExpandedViolations] = useState<Set<string>>(new Set());

  const toggleViolation = (id: string) => {
    setExpandedViolations(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filterKey = result.test_id;
  const currentSeverityFilter = a11ySeverityFilter[filterKey] || 'all';
  const currentCategoryFilter = a11yCategoryFilter[filterKey] || 'all';
  const currentSearchQuery = a11ySearchQuery[filterKey] || '';

  return (
    <div className="rounded-md border border-border p-4">
      {/* Result Header */}
      <div className="flex items-center gap-3">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
          result.status === 'passed' ? 'bg-green-100 text-green-700' :
          result.status === 'failed' ? 'bg-red-100 text-red-700' :
          result.status === 'warning' ? 'bg-amber-100 text-amber-700' :
          'bg-gray-100 text-gray-700'
        }`}>
          {result.status}
        </span>
        <span className="font-medium text-foreground">{result.test_name}</span>
        {result.duration_ms !== undefined && (
          <span className="text-sm text-muted-foreground">{result.duration_ms}ms</span>
        )}
      </div>

      {/* Error Display */}
      {result.error && (
        <div role="alert" className="mt-2 rounded-md bg-destructive/10 p-2 text-sm text-destructive">
          {result.error}
        </div>
      )}

      {/* Storage Quota Exceeded */}
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

      {/* Screenshot Timeout */}
      {result.screenshotTimedOut && (
        <div className="mt-2 p-2 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <span className="text-xs text-amber-700 dark:text-amber-400">
            ⏱️ Screenshot capture timed out after {result.screenshotTimeoutDuration || 30}s
          </span>
        </div>
      )}

      {/* Navigation Error */}
      {result.navigationError && (
        <div className="mt-2 p-2 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <span className="text-xs text-red-700 dark:text-red-400">
            🚫 Navigation failed: {result.navigationErrorUrl} ({result.navigationErrorCode})
          </span>
        </div>
      )}

      {/* Browser Crash */}
      {result.browserCrash && (
        <div className="mt-2 p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2">
            <span className="text-red-600">💥</span>
            <span className="text-sm font-medium text-red-700 dark:text-red-400">Browser crashed during test</span>
          </div>
          {result.crashReason && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{result.crashReason}</p>
          )}
        </div>
      )}

      {/* Page Oversized */}
      {result.pageOversized && (
        <div className="mt-2 p-3 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2">
            <span className="text-amber-600">📐</span>
            <span className="text-sm font-medium text-amber-700 dark:text-amber-400">Page dimensions exceed limits</span>
          </div>
          {result.oversizedDimensions && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              {result.oversizedDimensions.width}x{result.oversizedDimensions.height}px
            </p>
          )}
        </div>
      )}

      {/* K6 Errors */}
      {result.k6ImportError && (
        <div className="mt-2 p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-red-600">📥</span>
            <span className="text-sm font-medium text-red-700 dark:text-red-400">K6 Script Import Error</span>
          </div>
          {result.k6ImportErrorDetails && (
            <pre className="text-xs text-red-600 dark:text-red-400 overflow-x-auto">{result.k6ImportErrorDetails}</pre>
          )}
        </div>
      )}

      {result.k6ThresholdConfigError && (
        <div className="mt-2 p-3 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-amber-600">⚙️</span>
            <span className="text-sm font-medium text-amber-700 dark:text-amber-400">K6 Threshold Configuration Error</span>
          </div>
          {result.k6ThresholdConfigErrors && result.k6ThresholdConfigErrors.length > 0 && (
            <ul className="text-xs text-amber-600 dark:text-amber-400 list-disc list-inside">
              {result.k6ThresholdConfigErrors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {result.k6SyntaxError && (
        <div className="mt-2 p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-red-600">📝</span>
            <span className="text-sm font-medium text-red-700 dark:text-red-400">K6 Script Syntax Error</span>
          </div>
          {result.k6SyntaxErrorDetails && (
            <pre className="text-xs text-red-600 dark:text-red-400 overflow-x-auto whitespace-pre-wrap">{result.k6SyntaxErrorDetails}</pre>
          )}
        </div>
      )}

      {result.k6RuntimeError && (
        <div className="mt-2 p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-red-600">⚡</span>
            <span className="text-sm font-medium text-red-700 dark:text-red-400">K6 Runtime Error</span>
          </div>
          {result.k6RuntimeErrorDetails && (
            <pre className="text-xs text-red-600 dark:text-red-400 overflow-x-auto whitespace-pre-wrap">{result.k6RuntimeErrorDetails}</pre>
          )}
        </div>
      )}

      {result.k6ServerUnavailable && (
        <div className="mt-2 p-3 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-amber-600">🖥️</span>
            <span className="text-sm font-medium text-amber-700 dark:text-amber-400">K6 Server Unavailable</span>
          </div>
          {result.k6ServerErrorDetails && (
            <p className="text-xs text-amber-600 dark:text-amber-400">{result.k6ServerErrorDetails}</p>
          )}
        </div>
      )}

      {result.k6ResourceExhausted && (
        <div className="mt-2 p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-red-600">💾</span>
            <span className="text-sm font-medium text-red-700 dark:text-red-400">K6 Resource Exhausted</span>
          </div>
          {result.k6ResourceErrorDetails && (
            <p className="text-xs text-red-600 dark:text-red-400">{result.k6ResourceErrorDetails}</p>
          )}
        </div>
      )}

      {/* K6 Load Test Results */}
      {result.k6_results && (
        <K6ResultsDisplay results={result.k6_results} />
      )}

      {/* Screenshot */}
      {result.screenshot_base64 && !result.visual_comparison && (
        <div className="mt-4">
          <p className="text-sm font-medium text-foreground mb-2">Screenshot (click to expand):</p>
          <img
            src={`data:image/png;base64,${result.screenshot_base64}`}
            alt="Test screenshot"
            className="max-w-full h-auto border border-border rounded-md cursor-pointer hover:opacity-80 transition-opacity"
            style={{ maxHeight: '300px' }}
            onClick={() => onOpenLightbox(`data:image/png;base64,${result.screenshot_base64}`)}
          />
        </div>
      )}

      {/* Visual Comparison - simplified for now, full implementation would be larger */}
      {result.visual_comparison && (
        <VisualComparisonDisplay
          result={result}
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
          onOpenLightbox={onOpenLightbox}
          onApproveBaseline={onApproveBaseline}
          onRejectChanges={onRejectChanges}
          token={token}
        />
      )}

      {/* Lighthouse Results */}
      {result.lighthouse && (
        <LighthouseResultsDisplay
          lighthouse={result.lighthouse}
          lighthouseHistory={lighthouseHistory}
          testName={result.test_name || 'Test'}
        />
      )}

      {/* Accessibility Results */}
      {result.a11y_results && (
        <AccessibilityResultsDisplay
          a11y={result.a11y_results}
          filterKey={filterKey}
          currentSeverityFilter={currentSeverityFilter}
          currentCategoryFilter={currentCategoryFilter}
          currentSearchQuery={currentSearchQuery}
          expandedViolations={expandedViolations}
          onToggleViolation={toggleViolation}
          onSetSeverityFilter={(filter) => setA11ySeverityFilter({ ...a11ySeverityFilter, [filterKey]: filter })}
          onSetCategoryFilter={(filter) => setA11yCategoryFilter({ ...a11yCategoryFilter, [filterKey]: filter })}
          onSetSearchQuery={(query) => setA11ySearchQuery({ ...a11ySearchQuery, [filterKey]: query })}
          onExportPDF={onExportAccessibilityPDF}
          onExportCSV={onExportAccessibilityCSV}
          testName={result.test_name || 'Test'}
          formatDateTime={formatDateTime}
        />
      )}
    </div>
  );
}

// Sub-component for K6 results
function K6ResultsDisplay({ results }: { results: K6Results }) {
  const COLORS = ['#22c55e', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6'];

  return (
    <div className="mt-4 p-4 border border-border rounded-lg bg-muted/30">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">📊</span>
        <h4 className="text-sm font-semibold text-foreground">Load Test Results</h4>
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          results.status === 'passed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {results.status}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="p-2 rounded bg-background">
          <div className="text-xs text-muted-foreground">Duration</div>
          <div className="text-sm font-semibold">{results.duration_ms ? `${(results.duration_ms / 1000).toFixed(1)}s` : '-'}</div>
        </div>
        <div className="p-2 rounded bg-background">
          <div className="text-xs text-muted-foreground">Max VUs</div>
          <div className="text-sm font-semibold">{results.vus_max || '-'}</div>
        </div>
        <div className="p-2 rounded bg-background">
          <div className="text-xs text-muted-foreground">HTTP Requests</div>
          <div className="text-sm font-semibold">{results.http_reqs?.toLocaleString() || '-'}</div>
        </div>
        <div className="p-2 rounded bg-background">
          <div className="text-xs text-muted-foreground">Error Rate</div>
          <div className={`text-sm font-semibold ${(results.http_req_failed || 0) > 5 ? 'text-red-600' : 'text-green-600'}`}>
            {results.http_req_failed !== undefined ? `${results.http_req_failed.toFixed(2)}%` : '-'}
          </div>
        </div>
      </div>

      {/* Response Time Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="p-2 rounded bg-background">
          <div className="text-xs text-muted-foreground">Avg Response</div>
          <div className="text-sm font-semibold">{results.http_req_duration_avg ? `${results.http_req_duration_avg.toFixed(0)}ms` : '-'}</div>
        </div>
        <div className="p-2 rounded bg-background">
          <div className="text-xs text-muted-foreground">Median</div>
          <div className="text-sm font-semibold">{results.http_req_duration_med ? `${results.http_req_duration_med.toFixed(0)}ms` : '-'}</div>
        </div>
        <div className="p-2 rounded bg-background">
          <div className="text-xs text-muted-foreground">P90</div>
          <div className="text-sm font-semibold">{results.http_req_duration_p90 ? `${results.http_req_duration_p90.toFixed(0)}ms` : '-'}</div>
        </div>
        <div className="p-2 rounded bg-background">
          <div className="text-xs text-muted-foreground">P95</div>
          <div className="text-sm font-semibold">{results.http_req_duration_p95 ? `${results.http_req_duration_p95.toFixed(0)}ms` : '-'}</div>
        </div>
      </div>

      {/* Thresholds */}
      {results.thresholds && Object.keys(results.thresholds).length > 0 && (
        <div className="mt-3">
          <h5 className="text-xs font-medium text-muted-foreground mb-2">Thresholds</h5>
          <div className="space-y-1">
            {Object.entries(results.thresholds).map(([name, threshold]) => (
              <div key={name} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{name}</span>
                <span className={threshold.passed ? 'text-green-600' : 'text-red-600'}>
                  {threshold.passed ? '✓' : '✗'} {threshold.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Checks */}
      {results.checks && results.checks.length > 0 && (
        <div className="mt-3">
          <h5 className="text-xs font-medium text-muted-foreground mb-2">Checks</h5>
          <div className="space-y-1">
            {results.checks.map((check, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{check.name}</span>
                <span className={check.fails === 0 ? 'text-green-600' : 'text-red-600'}>
                  {check.passes}/{check.passes + check.fails} passed
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Response Codes Chart */}
      {results.response_codes && Object.keys(results.response_codes).length > 0 && (
        <div className="mt-4">
          <h5 className="text-xs font-medium text-muted-foreground mb-2">Response Codes</h5>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={Object.entries(results.response_codes).map(([code, count]) => ({
                    name: code,
                    value: count,
                  }))}
                  cx="50%"
                  cy="50%"
                  innerRadius={25}
                  outerRadius={45}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {Object.keys(results.response_codes).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

// Placeholder for Visual Comparison - this would need the full implementation
function VisualComparisonDisplay({
  result,
  comparisonViewMode,
  setComparisonViewMode,
  sliderPosition,
  setSliderPosition,
  onionSkinOpacity,
  setOnionSkinOpacity,
  diffOverlayOpacity,
  setDiffOverlayOpacity,
  imageZoomLevel,
  setImageZoomLevel,
  baselineContainerRef,
  currentContainerRef,
  diffContainerRef,
  handleSyncScroll,
  onOpenLightbox,
  onApproveBaseline,
  onRejectChanges,
  token,
}: {
  result: TestResult;
  comparisonViewMode: string;
  setComparisonViewMode: (mode: any) => void;
  sliderPosition: number;
  setSliderPosition: (pos: number) => void;
  onionSkinOpacity: number;
  setOnionSkinOpacity: (opacity: number) => void;
  diffOverlayOpacity: number;
  setDiffOverlayOpacity: (opacity: number) => void;
  imageZoomLevel: string;
  setImageZoomLevel: (level: any) => void;
  baselineContainerRef: React.RefObject<HTMLDivElement>;
  currentContainerRef: React.RefObject<HTMLDivElement>;
  diffContainerRef: React.RefObject<HTMLDivElement>;
  handleSyncScroll: (source: 'baseline' | 'current' | 'diff') => void;
  onOpenLightbox: (imageUrl: string) => void;
  onApproveBaseline: (runId: string) => void;
  onRejectChanges: (runId: string) => void;
  token: string;
}) {
  if (!result.visual_comparison) return null;

  const vc = result.visual_comparison;

  return (
    <div className="mt-4 p-4 border border-border rounded-lg bg-muted/30">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🔍</span>
        <h4 className="text-sm font-semibold text-foreground">Visual Comparison</h4>
        {vc.baselineCorrupted && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
            ⚠️ Baseline Corrupted
          </span>
        )}
        {result.diff_percentage !== undefined && !vc.baselineCorrupted && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            result.diff_percentage === 0
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
          }`}>
            {result.diff_percentage === 0 ? '✓ Match' : `${result.diff_percentage.toFixed(2)}% different`}
          </span>
        )}
        {!vc.hasBaseline && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
            📸 Baseline Created
          </span>
        )}
      </div>

      {/* Corrupted baseline handling */}
      {vc.baselineCorrupted && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
          <div className="flex items-start gap-3">
            <span className="text-red-600 text-lg">⚠️</span>
            <div className="flex-1">
              <h5 className="font-medium text-red-800 dark:text-red-400">Baseline Image Corrupted or Unreadable</h5>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                {vc.corruptionError || 'The baseline image file is corrupted and cannot be used for comparison.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Show comparison if there's a diff */}
      {vc.hasBaseline && result.diff_percentage !== undefined && result.diff_percentage > 0 && (
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">{vc.mismatchedPixels?.toLocaleString()}</span> pixels differ out of{' '}
            <span className="font-medium">{vc.totalPixels?.toLocaleString()}</span> total
          </div>

          {/* View Mode Toggle */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-md border border-border bg-background p-0.5">
              {['side-by-side', 'slider', 'onion-skin', 'diff', 'diff-overlay'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setComparisonViewMode(mode as any)}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                    comparisonViewMode === mode
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {mode.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Images - Side by Side view (simplified) */}
          {comparisonViewMode === 'side-by-side' && (
            <div className="grid grid-cols-3 gap-2">
              {vc.baselineImageBase64 && (
                <div>
                  <p className="text-xs font-medium mb-1">Baseline</p>
                  <img
                    src={`data:image/png;base64,${vc.baselineImageBase64}`}
                    alt="Baseline"
                    className="w-full border rounded cursor-pointer"
                    onClick={() => onOpenLightbox(`data:image/png;base64,${vc.baselineImageBase64}`)}
                  />
                </div>
              )}
              {vc.currentImageBase64 && (
                <div>
                  <p className="text-xs font-medium mb-1">Current</p>
                  <img
                    src={`data:image/png;base64,${vc.currentImageBase64}`}
                    alt="Current"
                    className="w-full border rounded cursor-pointer"
                    onClick={() => onOpenLightbox(`data:image/png;base64,${vc.currentImageBase64}`)}
                  />
                </div>
              )}
              {vc.diffImageBase64 && (
                <div>
                  <p className="text-xs font-medium mb-1">Diff</p>
                  <img
                    src={`data:image/png;base64,${vc.diffImageBase64}`}
                    alt="Diff"
                    className="w-full border rounded cursor-pointer"
                    onClick={() => onOpenLightbox(`data:image/png;base64,${vc.diffImageBase64}`)}
                  />
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => onApproveBaseline(result.test_id)}
              className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700"
            >
              ✓ Approve as New Baseline
            </button>
            <button
              onClick={() => onRejectChanges(result.test_id)}
              className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded hover:bg-red-700"
            >
              ✗ Reject Changes
            </button>
          </div>
        </div>
      )}

      {/* No baseline yet */}
      {!vc.hasBaseline && (
        <p className="text-sm text-muted-foreground">
          This screenshot has been saved as the baseline for future comparisons.
        </p>
      )}

      {/* Perfect match */}
      {vc.hasBaseline && result.diff_percentage === 0 && (
        <p className="text-sm text-green-600">
          ✓ Screenshot matches baseline perfectly
        </p>
      )}
    </div>
  );
}

// Placeholder for Lighthouse Results
function LighthouseResultsDisplay({
  lighthouse,
  lighthouseHistory,
  testName,
}: {
  lighthouse: LighthouseResults;
  lighthouseHistory: any[];
  testName: string;
}) {
  if (lighthouse.unreachable) {
    return (
      <div className="mt-4 p-4 border border-amber-300 dark:border-amber-700 rounded-lg bg-amber-50 dark:bg-amber-900/20">
        <div className="flex items-center gap-2">
          <span className="text-amber-600">🚫</span>
          <h4 className="text-sm font-semibold text-amber-700 dark:text-amber-400">URL Unreachable</h4>
        </div>
        <p className="mt-2 text-sm text-amber-600">
          The target URL could not be reached for Lighthouse auditing.
        </p>
      </div>
    );
  }

  if (lighthouse.timedOut) {
    return (
      <div className="mt-4 p-4 border border-amber-300 dark:border-amber-700 rounded-lg bg-amber-50 dark:bg-amber-900/20">
        <div className="flex items-center gap-2">
          <span className="text-amber-600">⏱️</span>
          <h4 className="text-sm font-semibold text-amber-700 dark:text-amber-400">Lighthouse Audit Timed Out</h4>
        </div>
      </div>
    );
  }

  if (lighthouse.browserCrash) {
    return (
      <div className="mt-4 p-4 border border-red-300 dark:border-red-700 rounded-lg bg-red-50 dark:bg-red-900/20">
        <div className="flex items-center gap-2">
          <span className="text-red-600">💥</span>
          <h4 className="text-sm font-semibold text-red-700 dark:text-red-400">Browser Crashed During Audit</h4>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 p-4 border border-border rounded-lg bg-muted/30">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">⚡</span>
        <h4 className="text-sm font-semibold text-foreground">Lighthouse Performance Audit</h4>
      </div>

      {/* Score Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className={`p-3 rounded-lg ${getScoreBgColor(lighthouse.performance)}`}>
          <div className="text-xs text-muted-foreground">Performance</div>
          <div className={`text-2xl font-bold ${getScoreColor(lighthouse.performance)}`}>
            {lighthouse.performance}
          </div>
        </div>
        <div className={`p-3 rounded-lg ${getScoreBgColor(lighthouse.accessibility)}`}>
          <div className="text-xs text-muted-foreground">Accessibility</div>
          <div className={`text-2xl font-bold ${getScoreColor(lighthouse.accessibility)}`}>
            {lighthouse.accessibility}
          </div>
        </div>
        <div className={`p-3 rounded-lg ${getScoreBgColor(lighthouse.bestPractices)}`}>
          <div className="text-xs text-muted-foreground">Best Practices</div>
          <div className={`text-2xl font-bold ${getScoreColor(lighthouse.bestPractices)}`}>
            {lighthouse.bestPractices}
          </div>
        </div>
        <div className={`p-3 rounded-lg ${getScoreBgColor(lighthouse.seo)}`}>
          <div className="text-xs text-muted-foreground">SEO</div>
          <div className={`text-2xl font-bold ${getScoreColor(lighthouse.seo)}`}>
            {lighthouse.seo}
          </div>
        </div>
      </div>

      {/* Core Web Vitals */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {lighthouse.lcp !== undefined && (
          <div className="p-2 rounded bg-background text-center">
            <div className="text-xs text-muted-foreground">LCP</div>
            <div className="text-sm font-semibold">{lighthouse.lcp.toFixed(1)}s</div>
          </div>
        )}
        {lighthouse.fcp !== undefined && (
          <div className="p-2 rounded bg-background text-center">
            <div className="text-xs text-muted-foreground">FCP</div>
            <div className="text-sm font-semibold">{lighthouse.fcp.toFixed(1)}s</div>
          </div>
        )}
        {lighthouse.cls !== undefined && (
          <div className="p-2 rounded bg-background text-center">
            <div className="text-xs text-muted-foreground">CLS</div>
            <div className="text-sm font-semibold">{lighthouse.cls.toFixed(3)}</div>
          </div>
        )}
        {lighthouse.tbt !== undefined && (
          <div className="p-2 rounded bg-background text-center">
            <div className="text-xs text-muted-foreground">TBT</div>
            <div className="text-sm font-semibold">{lighthouse.tbt.toFixed(0)}ms</div>
          </div>
        )}
        {lighthouse.inp !== undefined && (
          <div className="p-2 rounded bg-background text-center">
            <div className="text-xs text-muted-foreground">INP</div>
            <div className="text-sm font-semibold">{lighthouse.inp.toFixed(0)}ms</div>
          </div>
        )}
        {lighthouse.speedIndex !== undefined && (
          <div className="p-2 rounded bg-background text-center">
            <div className="text-xs text-muted-foreground">Speed Index</div>
            <div className="text-sm font-semibold">{lighthouse.speedIndex.toFixed(1)}s</div>
          </div>
        )}
      </div>

      {/* CSP Warning */}
      {lighthouse.csp?.blocksLighthouse && (
        <div className="mt-3 p-2 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
          <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
            <span>⚠️</span>
            <span>Content Security Policy may affect audit results</span>
          </div>
        </div>
      )}

      {/* Authentication Warning */}
      {lighthouse.authenticationRequired && (
        <div className="mt-3 p-2 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
          <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
            <span>🔐</span>
            <span>Page requires authentication - some metrics may be affected</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Placeholder for Accessibility Results
function AccessibilityResultsDisplay({
  a11y,
  filterKey,
  currentSeverityFilter,
  currentCategoryFilter,
  currentSearchQuery,
  expandedViolations,
  onToggleViolation,
  onSetSeverityFilter,
  onSetCategoryFilter,
  onSetSearchQuery,
  onExportPDF,
  onExportCSV,
  testName,
  formatDateTime,
}: {
  a11y: AccessibilityResults;
  filterKey: string;
  currentSeverityFilter: string;
  currentCategoryFilter: string;
  currentSearchQuery: string;
  expandedViolations: Set<string>;
  onToggleViolation: (id: string) => void;
  onSetSeverityFilter: (filter: string) => void;
  onSetCategoryFilter: (filter: string) => void;
  onSetSearchQuery: (query: string) => void;
  onExportPDF?: (a11yData: any, testName: string, runDate: string) => void;
  onExportCSV?: (a11yData: any, testName: string, runDate: string) => void;
  testName: string;
  formatDateTime: (date: string | Date) => string;
}) {
  return (
    <div className="mt-4 p-4 border border-border rounded-lg bg-muted/30">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">♿</span>
          <h4 className="text-sm font-semibold text-foreground">Accessibility Audit</h4>
          <span className={`text-xs px-2 py-0.5 rounded-full ${getScoreBgColor(a11y.score)} ${getScoreColor(a11y.score)}`}>
            {a11y.score}/100
          </span>
        </div>
        <div className="flex gap-2">
          {onExportPDF && (
            <button
              onClick={() => onExportPDF(a11y, testName, formatDateTime(new Date()))}
              className="text-xs px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20"
            >
              📄 PDF
            </button>
          )}
          {onExportCSV && (
            <button
              onClick={() => onExportCSV(a11y, testName, formatDateTime(new Date()))}
              className="text-xs px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20"
            >
              📊 CSV
            </button>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="p-2 rounded bg-red-100 dark:bg-red-900/30 text-center">
          <div className="text-xs text-red-700 dark:text-red-400">Violations</div>
          <div className="text-lg font-bold text-red-700 dark:text-red-400">{a11y.violations.count}</div>
        </div>
        <div className="p-2 rounded bg-green-100 dark:bg-green-900/30 text-center">
          <div className="text-xs text-green-700 dark:text-green-400">Passes</div>
          <div className="text-lg font-bold text-green-700 dark:text-green-400">{a11y.passes?.count || 0}</div>
        </div>
        <div className="p-2 rounded bg-amber-100 dark:bg-amber-900/30 text-center">
          <div className="text-xs text-amber-700 dark:text-amber-400">Incomplete</div>
          <div className="text-lg font-bold text-amber-700 dark:text-amber-400">{a11y.incomplete?.count || 0}</div>
        </div>
        <div className="p-2 rounded bg-gray-100 dark:bg-gray-800 text-center">
          <div className="text-xs text-gray-600 dark:text-gray-400">N/A</div>
          <div className="text-lg font-bold text-gray-600 dark:text-gray-400">{a11y.inapplicable?.count || 0}</div>
        </div>
      </div>

      {/* Severity Breakdown */}
      {a11y.violations.count > 0 && (
        <div className="mb-4">
          <h5 className="text-xs font-medium text-muted-foreground mb-2">Violations by Severity</h5>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onSetSeverityFilter('all')}
              className={`px-2 py-1 text-xs rounded-full ${
                currentSeverityFilter === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 dark:bg-gray-800'
              }`}
            >
              All: {a11y.violations.count}
            </button>
            {a11y.violations.critical !== undefined && a11y.violations.critical > 0 && (
              <button
                onClick={() => onSetSeverityFilter('critical')}
                className={`px-2 py-1 text-xs rounded-full ${
                  currentSeverityFilter === 'critical' ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700'
                }`}
              >
                Critical: {a11y.violations.critical}
              </button>
            )}
            {a11y.violations.serious !== undefined && a11y.violations.serious > 0 && (
              <button
                onClick={() => onSetSeverityFilter('serious')}
                className={`px-2 py-1 text-xs rounded-full ${
                  currentSeverityFilter === 'serious' ? 'bg-orange-600 text-white' : 'bg-orange-100 text-orange-700'
                }`}
              >
                Serious: {a11y.violations.serious}
              </button>
            )}
            {a11y.violations.moderate !== undefined && a11y.violations.moderate > 0 && (
              <button
                onClick={() => onSetSeverityFilter('moderate')}
                className={`px-2 py-1 text-xs rounded-full ${
                  currentSeverityFilter === 'moderate' ? 'bg-yellow-600 text-white' : 'bg-yellow-100 text-yellow-700'
                }`}
              >
                Moderate: {a11y.violations.moderate}
              </button>
            )}
            {a11y.violations.minor !== undefined && a11y.violations.minor > 0 && (
              <button
                onClick={() => onSetSeverityFilter('minor')}
                className={`px-2 py-1 text-xs rounded-full ${
                  currentSeverityFilter === 'minor' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700'
                }`}
              >
                Minor: {a11y.violations.minor}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Violation Items */}
      {a11y.violations.items && a11y.violations.items.length > 0 && (
        <div className="space-y-2">
          {a11y.violations.items
            .filter(v => currentSeverityFilter === 'all' || v.impact === currentSeverityFilter)
            .filter(v => !currentSearchQuery || v.description.toLowerCase().includes(currentSearchQuery.toLowerCase()))
            .map((violation, idx) => (
              <div key={violation.id || idx} className="p-3 rounded border border-border bg-background">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => onToggleViolation(violation.id)}
                >
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      violation.impact === 'critical' ? 'bg-red-100 text-red-700' :
                      violation.impact === 'serious' ? 'bg-orange-100 text-orange-700' :
                      violation.impact === 'moderate' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {violation.impact}
                    </span>
                    <span className="text-sm font-medium">{violation.help}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {expandedViolations.has(violation.id) ? '▼' : '▶'}
                  </span>
                </div>
                {expandedViolations.has(violation.id) && (
                  <div className="mt-2 pt-2 border-t border-border">
                    <p className="text-sm text-muted-foreground">{violation.description}</p>
                    {violation.helpUrl && (
                      <a
                        href={violation.helpUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline mt-1 inline-block"
                      >
                        Learn more →
                      </a>
                    )}
                    {violation.nodes && violation.nodes.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Affected Elements ({violation.nodes.length}):
                        </p>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {violation.nodes.slice(0, 5).map((node, nodeIdx) => (
                            <code key={nodeIdx} className="block text-xs bg-muted p-1 rounded overflow-x-auto">
                              {node.html}
                            </code>
                          ))}
                          {violation.nodes.length > 5 && (
                            <p className="text-xs text-muted-foreground">
                              +{violation.nodes.length - 5} more elements
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

export type { TestResultCardProps, TestResult };
