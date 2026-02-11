/**
 * useComputedResults - Custom hook for computed/derived data from test run results
 * Feature #46: Extracted from TestRunResultPage.tsx for performance optimization
 *
 * This hook extracts the large useMemo computations that derive data from
 * the test run results, including:
 * - Result summary (passed/failed/skipped counts)
 * - Performance results (lighthouse tests)
 * - Load test results
 * - Visual regression results
 * - Accessibility results
 * - Console logs
 * - Video-related data
 * - All screenshots
 * - Computed steps for timeline
 * - Primary error detection
 *
 * NOTE: Network-related computations (networkRequests, waterfallData, waterfallBounds,
 * networkStats) are handled separately in useNetworkAnalysisState hook.
 */

import { useMemo } from 'react';
import {
  TestRun,
  TestInfo,
  TestResult,
  ResultSummary,
  ConsoleLog,
  ComputedStep,
  ScreenshotItem,
  VisualMarker,
} from '../components/test-run-results';

// Feature #643: Type for viewport result in visual regression tests
interface ViewportResult {
  viewportLabel?: string;
  viewportId?: string;
  width?: number;
  height?: number;
  screenshotBase64?: string;
  screenshot_base64?: string;
  baselineScreenshotBase64?: string;
  baseline_screenshot_base64?: string;
  diffImageBase64?: string;
  diff_image_base64?: string;
  diffPercentage?: number;
  diff_percentage?: number;
}

/**
 * Return type for useComputedResults hook
 */
export interface ComputedResultsData {
  // Summary counts
  resultSummary: ResultSummary;

  // Filtered results by type
  performanceResults: TestResult[];
  loadTestResults: TestResult[];
  visualResults: TestResult[];
  accessibilityResults: TestResult[];

  // Raw data collections
  consoleLogs: ConsoleLog[];

  // Video-related
  videoFile: string | null;
  runDurationMs: number;
  visualMarkers: VisualMarker[];

  // Timeline data
  allSteps: ComputedStep[];

  // Screenshot data
  screenshots: TestResult[];
  allScreenshots: ScreenshotItem[];

  // Error detection
  primaryError: string | null;
}

/**
 * Custom hook to compute derived data from test run results
 * @param run - The test run data
 * @param testInfo - Optional test info for additional metadata
 * @returns Object containing all computed/derived data
 */
export function useComputedResults(
  run: TestRun | null,
  testInfo?: TestInfo | null
): ComputedResultsData {
  // Get result summary - passed/failed/skipped counts
  const resultSummary = useMemo<ResultSummary>(() => {
    if (!run?.results) return { passed: 0, failed: 0, skipped: 0, total: 0 };
    return {
      passed: run.results.filter(r => r.status === 'passed').length,
      failed: run.results.filter(r => r.status === 'failed' || r.status === 'error').length,
      skipped: run.results.filter(r => r.status === 'skipped').length,
      total: run.results.length,
    };
  }, [run]);

  // Get console logs from all results
  const consoleLogs = useMemo<ConsoleLog[]>(() => {
    if (!run?.results) return [];
    return run.results.flatMap(r => r.console_logs || []);
  }, [run]);

  // Get lighthouse/performance metrics
  const performanceResults = useMemo<TestResult[]>(() => {
    if (!run?.results) return [];
    return run.results.filter(r =>
      r.steps.some(s => s.lighthouse)
    );
  }, [run]);

  // Get accessibility violations
  const accessibilityResults = useMemo<TestResult[]>(() => {
    if (!run?.results) return [];
    return run.results.filter(r =>
      r.steps.some(s => s.accessibility && s.accessibility.violations.length > 0)
    );
  }, [run]);

  // Get load test results
  const loadTestResults = useMemo<TestResult[]>(() => {
    if (!run?.results) return [];
    return run.results.filter(r => r.load_test);
  }, [run]);

  // Get visual comparison results
  const visualResults = useMemo<TestResult[]>(() => {
    if (!run?.results) return [];
    return run.results.filter(r => r.visual_comparison);
  }, [run]);

  // Get first video file from results
  const videoFile = useMemo<string | null>(() => {
    if (!run?.results) return null;
    const resultWithVideo = run.results.find(r => r.video_file);
    return resultWithVideo?.video_file || null;
  }, [run]);

  // Get run duration for video sync calculations
  const runDurationMs = useMemo<number>(() => {
    if (!run?.started_at || !run?.completed_at) return 0;
    return new Date(run.completed_at).getTime() - new Date(run.started_at).getTime();
  }, [run]);

  // Calculate visual screenshot markers for video timeline
  const visualMarkers = useMemo<VisualMarker[]>(() => {
    if (!run?.results || !run?.started_at) return [];

    const runStartTime = new Date(run.started_at).getTime();
    const markers: VisualMarker[] = [];

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

  // Get the primary error from the run results
  const primaryError = useMemo<string | null>(() => {
    if (!run?.results) return null;
    const failedResult = run.results.find(r => r.status === 'failed' || r.status === 'error');
    return failedResult?.error || failedResult?.steps.find(s => s.status === 'failed')?.error || null;
  }, [run]);

  // Get all steps across all results with computed timestamps
  const allSteps = useMemo<ComputedStep[]>(() => {
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

  // Get screenshots from results (results that have screenshots)
  const screenshots = useMemo<TestResult[]>(() => {
    if (!run?.results) return [];
    return run.results.filter(r =>
      r.screenshot_base64 ||
      r.baseline_screenshot_base64 ||
      r.diff_image_base64 ||
      r.visual_comparison?.diffImage
    );
  }, [run]);

  // Enhanced screenshot gallery with metadata
  const allScreenshots = useMemo<ScreenshotItem[]>(() => {
    if (!run?.results) return [];
    const items: ScreenshotItem[] = [];
    let idCounter = 0;

    // Helper to infer test type from result
    const inferTestType = (r: TestResult): ScreenshotItem['testType'] => {
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
          testId: result.test_id,
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
          testId: result.test_id,
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
          testId: result.test_id,
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
          testId: result.test_id,
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
            testId: result.test_id,
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
            testId: result.test_id,
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
            testId: result.test_id,
            testStatus: result.status,
            testType,
            stepIndex: stepIdx,
            stepAction: step.action,
          });
        }
      });

      // Collect per-viewport screenshots for visual tests
      if (result.viewport_results && Array.isArray(result.viewport_results)) {
        result.viewport_results.forEach((vr: ViewportResult, vpIdx: number) => {
          const vpLabel = vr.viewportLabel || vr.viewportId || `Viewport ${vpIdx + 1}`;
          const vpDims = vr.width && vr.height ? { width: vr.width, height: vr.height } : undefined;

          if (vr.screenshotBase64 || vr.screenshot_base64) {
            const imgData = vr.screenshotBase64 || vr.screenshot_base64;
            if (!imgData) return; // Guard for TypeScript narrowing
            items.push({
              id: `screenshot-${idCounter++}`,
              url: imgData.startsWith('data:') ? imgData : `data:image/png;base64,${imgData}`,
              title: `${vpLabel} Current - ${result.test_name}`,
              type: 'final',
              testName: result.test_name,
              testId: result.test_id,
              testStatus: result.status,
              testType,
              viewport: vpDims,
            });
          }
          if (vr.baselineScreenshotBase64 || vr.baseline_screenshot_base64) {
            const imgData = vr.baselineScreenshotBase64 || vr.baseline_screenshot_base64;
            if (!imgData) return; // Guard for TypeScript narrowing
            items.push({
              id: `screenshot-${idCounter++}`,
              url: imgData.startsWith('data:') ? imgData : `data:image/png;base64,${imgData}`,
              title: `${vpLabel} Baseline - ${result.test_name}`,
              type: 'baseline',
              testName: result.test_name,
              testId: result.test_id,
              testStatus: result.status,
              testType,
              viewport: vpDims,
            });
          }
          if (vr.diffImageBase64 || vr.diff_image_base64) {
            const imgData = vr.diffImageBase64 || vr.diff_image_base64;
            if (!imgData) return; // Guard for TypeScript narrowing
            const diffPct = vr.diffPercentage ?? vr.diff_percentage;
            items.push({
              id: `screenshot-${idCounter++}`,
              url: imgData.startsWith('data:') ? imgData : `data:image/png;base64,${imgData}`,
              title: `${vpLabel} Diff${diffPct != null ? ` (${Number(diffPct).toFixed(2)}%)` : ''} - ${result.test_name}`,
              type: 'diff',
              testName: result.test_name,
              testId: result.test_id,
              testStatus: result.status,
              testType,
              diffPercentage: diffPct,
              viewport: vpDims,
            });
          }
        });
      }
    });

    return items;
  }, [run, testInfo]);

  return {
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
  };
}

export default useComputedResults;
