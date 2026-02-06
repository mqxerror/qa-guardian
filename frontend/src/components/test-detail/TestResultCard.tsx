// Feature #48: TestResultCard - Extracted from TestDetailPage.tsx
// Feature #104: Refactored to import sub-components from test-result-card/ folder
// Renders a single test result including all test type specific displays
// (E2E, Visual Regression, Lighthouse, Accessibility, K6 Load Test)

import { useState } from 'react';
import { toast } from '../../stores/toastStore';

// Import types and components from extracted folder
import {
  TestResult,
  TestResultCardProps,
  K6ResultsDisplay,
  VisualComparisonDisplay,
  LighthouseResultsDisplay,
  AccessibilityResultsDisplay,
} from './test-result-card';

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

      {/* Visual Comparison */}
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

export type { TestResultCardProps, TestResult };
