/**
 * TimelineTab Component
 * Feature #46: Extracted from TestRunResultPage.tsx for modularity
 *
 * Displays the test execution timeline with:
 * - Video player with timeline sync
 * - Step-by-step execution view with expand/collapse
 * - Network requests and console logs per step
 * - Lighthouse, load test, and accessibility metrics inline
 * - Screenshot modal for before/after step screenshots
 */

import React from 'react';
import {
  TestRun,
  StepResult,
  ConsoleLog,
  NetworkRequest,
} from './types';
import {
  formatDuration,
  formatStepTime,
  formatRelativeTime,
} from './utils';

// Extended step type with computed fields from allSteps useMemo
export interface ComputedStep extends StepResult {
  testName: string;
  testId: string;
  resultIndex: number;
  stepIndex: number;
  uniqueId: string;
  computedTimestamp: number;
  stepNetworkRequests: NetworkRequest[];
  stepConsoleLogs: ConsoleLog[];
}

// Selected screenshot state for modal
export interface SelectedScreenshot {
  url: string;
  title: string;
}

// Props interface for TimelineTab
export interface TimelineTabProps {
  // Core data
  run: TestRun | null;
  allSteps: ComputedStep[];

  // Expanded steps state
  expandedSteps: Set<string>;
  toggleStep: (stepId: string) => void;

  // View options
  showNetworkPerStep: boolean;
  setShowNetworkPerStep: (value: boolean) => void;
  showConsolePerStep: boolean;
  setShowConsolePerStep: (value: boolean) => void;

  // Screenshot modal state
  selectedScreenshot: SelectedScreenshot | null;
  setSelectedScreenshot: (screenshot: SelectedScreenshot | null) => void;

  // Video playback state
  videoFile: string | null;
  videoUrl: string | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  videoLoading: boolean;
  videoError: string | null;
  isVideoPlaying: boolean;
  setIsVideoPlaying: (playing: boolean) => void;
  currentVideoTime: number;
  runDurationMs: number;

  // Video controls
  handleVideoDownload: () => void;
  handleVideoTimeUpdate: () => void;
  handleStepVideoSeek: (step: { computedTimestamp: number }) => void;
}

export default function TimelineTab({
  run,
  allSteps,
  expandedSteps,
  toggleStep,
  showNetworkPerStep,
  setShowNetworkPerStep,
  showConsolePerStep,
  setShowConsolePerStep,
  selectedScreenshot,
  setSelectedScreenshot,
  videoFile,
  videoUrl,
  videoRef,
  videoLoading,
  videoError,
  isVideoPlaying,
  setIsVideoPlaying,
  currentVideoTime,
  runDurationMs,
  handleVideoDownload,
  handleVideoTimeUpdate,
  handleStepVideoSeek,
}: TimelineTabProps) {
  return (
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
                                  <div className="font-medium">{((step.lighthouse.metrics.lcp ?? 0) / 1000).toFixed(2)}s</div>
                                  <div className="text-xs text-muted-foreground">LCP</div>
                                </div>
                              )}
                              {step.lighthouse.metrics.fcp != null && (
                                <div className="p-2 bg-muted/50 rounded">
                                  <div className="font-medium">{((step.lighthouse.metrics.fcp ?? 0) / 1000).toFixed(2)}s</div>
                                  <div className="text-xs text-muted-foreground">FCP</div>
                                </div>
                              )}
                              {step.lighthouse.metrics.cls !== undefined && (
                                <div className="p-2 bg-muted/50 rounded">
                                  <div className="font-medium">{(step.lighthouse.metrics.cls ?? 0).toFixed(3)}</div>
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
                          {/* Feature #2078: Check if metrics exist - show failure state if missing */}
                          {(step.load_test.requests_per_second === undefined &&
                            step.load_test.avg_response_time === undefined &&
                            step.load_test.summary?.requests_per_second === undefined) ? (
                            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                              <div className="flex items-center gap-2 text-red-700 dark:text-red-300 mb-2">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <span className="font-medium">Load Test Failed</span>
                              </div>
                              <p className="text-sm text-red-600 dark:text-red-400">
                                The load test did not complete successfully. This may be because the target server couldn't handle the load,
                                connection issues occurred, or the test was interrupted. No metrics are available.
                              </p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-4 gap-3">
                              <div className="p-3 bg-muted rounded-lg text-center">
                                <div className="text-xl font-bold text-foreground">
                                  {step.load_test.requests_per_second?.toFixed?.(1) ?? step.load_test.summary?.requests_per_second ?? 'N/A'}
                                </div>
                                <div className="text-xs text-muted-foreground">Req/sec</div>
                              </div>
                              <div className="p-3 bg-muted rounded-lg text-center">
                                <div className="text-xl font-bold text-foreground">
                                  {step.load_test.avg_response_time ?? step.load_test.response_times?.avg ?? 'N/A'}
                                  {(step.load_test.avg_response_time !== undefined || step.load_test.response_times?.avg !== undefined) && 'ms'}
                                </div>
                                <div className="text-xs text-muted-foreground">Avg Response</div>
                              </div>
                              <div className="p-3 bg-muted rounded-lg text-center">
                                <div className="text-xl font-bold text-foreground">
                                  {step.load_test.p95_response_time ?? step.load_test.response_times?.p95 ?? 'N/A'}
                                  {(step.load_test.p95_response_time !== undefined || step.load_test.response_times?.p95 !== undefined) && 'ms'}
                                </div>
                                <div className="text-xs text-muted-foreground">p95 Response</div>
                              </div>
                              <div className={`p-3 rounded-lg text-center ${
                                (step.load_test.error_rate ?? 0) > 5 ? 'bg-red-100 dark:bg-red-900/30' :
                                (step.load_test.error_rate ?? 0) > 1 ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                                'bg-green-100 dark:bg-green-900/30'
                              }`}>
                                <div className={`text-xl font-bold ${
                                  (step.load_test.error_rate ?? 0) > 5 ? 'text-red-600' :
                                  (step.load_test.error_rate ?? 0) > 1 ? 'text-yellow-600' :
                                  'text-green-600'
                                }`}>
                                  {step.load_test.error_rate?.toFixed?.(1) ?? 'N/A'}
                                  {step.load_test.error_rate !== undefined && '%'}
                                </div>
                                <div className="text-xs text-muted-foreground">Error Rate</div>
                              </div>
                            </div>
                          )}
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
  );
}
