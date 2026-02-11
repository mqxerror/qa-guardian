/**
 * useTestRunHandlers - Custom hook extracting event handlers from TestRunResultPage
 * Feature #46: Modular extraction for performance optimization
 */

import { useCallback } from 'react';
import { toast } from '../stores/toastStore';
import { ScreenshotItem } from '../components/test-run-results';
import type { LighthouseResult, StepLoadTestResult } from '../components/test-detail/types';
import type { K6LoadTestData } from '../components/test-run-results/pdfExport';

// Performance analysis context type
// Feature #643: Updated loadTest fields to use optional types compatible with K6LoadTestData
interface PerformanceContext {
  testName: string;
  lighthouse?: {
    performance: number;
    accessibility: number;
    bestPractices: number | undefined;
    seo: number;
    metrics?: LighthouseResult['metrics'];
    lcp?: number;
    fcp?: number;
    cls?: number;
    tbt?: number;
    url?: string;
    device?: string;
    opportunities?: LighthouseResult['opportunities'];
    diagnostics?: LighthouseResult['diagnostics'];
  };
  loadTest?: {
    virtualUsers?: number | { configured?: number; peak?: number; max_concurrent?: number };
    duration?: number | { configured?: number; actual?: number; ramp_up?: number };
    requestsPerSecond?: number | string;
    avgResponseTime?: number;
    p95ResponseTime?: number;
    errorRate?: number;
    summary?: K6LoadTestData['summary'];
    responseTimes?: K6LoadTestData['response_times'];
  };
}

// Types for handler dependencies
interface UseTestRunHandlersParams {
  // Refs
  videoRef: React.RefObject<HTMLVideoElement | null>;
  visualVideoRef: React.RefObject<HTMLVideoElement | null>;

  // State values
  token: string | null;
  runId: string | undefined;
  run: { started_at?: string } | null;
  videoUrl: string | null;
  runDurationMs: number;
  allScreenshots: ScreenshotItem[];
  visualZoom: Record<string, number>;
  visualPan: Record<string, { x: number; y: number }>;
  isPanning: boolean;
  panStart: { x: number; y: number; panX: number; panY: number } | null;

  // State setters
  setExpandedSteps: React.Dispatch<React.SetStateAction<Set<string>>>;
  setExpandedOpportunities: React.Dispatch<React.SetStateAction<Set<string>>>;
  setExpandedDiagnostics: React.Dispatch<React.SetStateAction<Set<string>>>;
  setExpandedPassedAudits: React.Dispatch<React.SetStateAction<Set<string>>>;
  setExpandedEndpoints: React.Dispatch<React.SetStateAction<Set<string>>>;
  setA11yExpandedViolations: React.Dispatch<React.SetStateAction<Set<string>>>;
  setSelectedForComparison: React.Dispatch<React.SetStateAction<string[]>>;
  setApprovalLoading: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  // Feature #676: Changed from retry to simpler retry function
  retry: () => void;
  setVisualZoom: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setVisualPan: React.Dispatch<React.SetStateAction<Record<string, { x: number; y: number }>>>;
  setIsPanning: React.Dispatch<React.SetStateAction<boolean>>;
  setPanStart: React.Dispatch<React.SetStateAction<{ x: number; y: number; panX: number; panY: number } | null>>;
  setIsVideoPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  setCurrentVideoTime: React.Dispatch<React.SetStateAction<number>>;
  setIsVisualVideoPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  setVisualVideoCurrentTime: React.Dispatch<React.SetStateAction<number>>;
  setDownloadingZip: React.Dispatch<React.SetStateAction<boolean>>;
  setCancellingTest: React.Dispatch<React.SetStateAction<boolean>>;
  setLiveMode: React.Dispatch<React.SetStateAction<boolean>>;

  // Performance AI state setters
  setPerfAILoading: React.Dispatch<React.SetStateAction<boolean>>;
  setPerfAIError: React.Dispatch<React.SetStateAction<string | null>>;
  setPerfAIAnalysisOpen: React.Dispatch<React.SetStateAction<string | null>>;
  setPerfAIResult: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

export function useTestRunHandlers({
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
  retry,
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
}: UseTestRunHandlersParams) {

  // Toggle step expansion
  const toggleStep = useCallback((stepId: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  }, [setExpandedSteps]);

  // Feature #1835: Toggle opportunity expansion
  const toggleOpportunity = useCallback((id: string) => {
    setExpandedOpportunities(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, [setExpandedOpportunities]);

  // Feature #1835: Toggle diagnostic expansion
  const toggleDiagnostic = useCallback((id: string) => {
    setExpandedDiagnostics(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, [setExpandedDiagnostics]);

  // Feature #1889: Toggle passed audit expansion
  const togglePassedAudit = useCallback((id: string) => {
    setExpandedPassedAudits(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, [setExpandedPassedAudits]);

  // Feature #1836: Toggle endpoint expansion
  const toggleEndpoint = useCallback((endpoint: string) => {
    setExpandedEndpoints(prev => {
      const next = new Set(prev);
      if (next.has(endpoint)) {
        next.delete(endpoint);
      } else {
        next.add(endpoint);
      }
      return next;
    });
  }, [setExpandedEndpoints]);

  // Feature #1838: Toggle individual violation expansion
  const toggleViolation = useCallback((violationId: string) => {
    setA11yExpandedViolations(prev => {
      const next = new Set(prev);
      if (next.has(violationId)) {
        next.delete(violationId);
      } else {
        next.add(violationId);
      }
      return next;
    });
  }, [setA11yExpandedViolations]);

  // Feature #1834: Toggle screenshot for comparison
  const toggleComparisonSelect = useCallback((id: string) => {
    setSelectedForComparison(prev => {
      if (prev.includes(id)) {
        return prev.filter(i => i !== id);
      }
      if (prev.length >= 2) {
        return [prev[1], id]; // Keep last selected, add new
      }
      return [...prev, id];
    });
  }, [setSelectedForComparison]);

  // Feature #1837 & #1919: Approve baseline (update to current) - supports per-viewport approval
  const handleApproveBaseline = useCallback(async (testId: string, resultIdx: number, viewportId?: string) => {
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
        // Feature #19: Show success toast and refresh run data
        toast.success(`Baseline approved${viewportId ? ` for viewport: ${viewportId}` : ''}`);
        // Refetch run data to reflect the new baseline status
        retry();
      } else {
        const errorData = await response.json().catch(() => null);
        toast.error(errorData?.error || `Failed to approve baseline (${response.status})`);
      }
    } catch (err) {
      console.error('Failed to approve baseline:', err);
      toast.error('Failed to approve baseline. Please try again.');
    } finally {
      setApprovalLoading(prev => ({ ...prev, [key]: false }));
    }
  }, [token, runId, setApprovalLoading, retry]);

  // Feature #1837 & #1919: Reject (mark as regression) - supports per-viewport rejection
  const handleRejectBaseline = useCallback(async (testId: string, resultIdx: number, viewportId?: string) => {
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
        toast.warning('Marked as regression');
        retry();
      } else {
        const errorData = await response.json().catch(() => null);
        toast.error(errorData?.error || `Failed to reject baseline (${response.status})`);
      }
    } catch (err) {
      console.error('Failed to reject baseline:', err);
      toast.error('Failed to reject baseline. Please try again.');
    } finally {
      setApprovalLoading(prev => ({ ...prev, [key]: false }));
    }
  }, [token, runId, setApprovalLoading, retry]);

  // Feature #1935: AI analysis for performance test results
  const analyzePerformanceResults = useCallback(async (testName: string, lighthouse: LighthouseResult | null, loadTest?: K6LoadTestData | null) => {
    if (!token) return;

    setPerfAILoading(true);
    setPerfAIError(null);
    setPerfAIAnalysisOpen(testName);

    // Build performance context
    const performanceContext: PerformanceContext = { testName };

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
      // Handle both K6LoadTestData and StepLoadTestResult shapes
      performanceContext.loadTest = {
        virtualUsers: loadTest.virtual_users,
        duration: loadTest.duration,
        requestsPerSecond: loadTest.summary?.requests_per_second,
        avgResponseTime: loadTest.response_times?.avg,
        p95ResponseTime: loadTest.response_times?.p95,
        errorRate: undefined, // K6LoadTestData doesn't have error_rate at top level
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
  }, [token, setPerfAILoading, setPerfAIError, setPerfAIAnalysisOpen, setPerfAIResult]);

  // Feature #1836: Export K6 results
  const exportK6Results = useCallback((loadTestData: K6LoadTestData, testName: string, format: 'json' | 'csv') => {
    if (!loadTestData) return;

    let content: string;
    let mimeType: string;
    let extension: string;

    // Type-safe access to data that may vary between LoadTestResult and StepLoadTestResult
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = loadTestData as Record<string, any>;
    const summary = data.summary || {};
    const responseTimes = data.response_times || {};

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
      rows.push(`Total Requests,${summary.total_requests || summary.http_reqs || 0}`);
      rows.push(`Failed Requests,${summary.failed_requests || 0}`);
      rows.push(`Success Rate,${summary.success_rate || '0%'}`);
      rows.push(`Requests/sec,${summary.requests_per_second || data.requests_per_second || 0}`);
      rows.push(`Data Transferred,${summary.data_transferred_formatted || '0 B'}`);
      rows.push('');

      // Response times
      rows.push('# Response Times (ms)');
      rows.push('Percentile,Value');
      rows.push(`Min,${responseTimes.min || 0}`);
      rows.push(`Avg,${responseTimes.avg || data.avg_response_time || 0}`);
      rows.push(`Median,${responseTimes.median || 0}`);
      rows.push(`p90,${responseTimes.p90 || 0}`);
      rows.push(`p95,${responseTimes.p95 || data.p95_response_time || 0}`);
      rows.push(`p99,${responseTimes.p99 || 0}`);
      rows.push(`Max,${responseTimes.max || 0}`);
      rows.push('');

      // HTTP codes
      if (data.http_codes) {
        rows.push('# HTTP Status Codes');
        rows.push('Code,Count');
        for (const [code, count] of Object.entries(data.http_codes)) {
          rows.push(`${code},${count}`);
        }
        rows.push('');
      }

      // Thresholds (only available on LoadTestResult)
      if (data.thresholds) {
        rows.push('# Thresholds');
        rows.push('Name,Passed');
        for (const [name, passed] of Object.entries(data.thresholds)) {
          rows.push(`${name},${passed ? 'PASS' : 'FAIL'}`);
        }
        rows.push('');
      }

      // Time series data (only available on LoadTestResult)
      if (data.time_series && data.time_series.length > 0) {
        rows.push('# Time Series Data');
        rows.push('Timestamp,VUs,RPS,Avg Response Time');
        for (const point of data.time_series) {
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
  }, []);

  // Feature #1880: Seek visual video to marker timestamp
  const seekVisualVideoToMarker = useCallback((timestampMs: number) => {
    if (!visualVideoRef.current) return;

    const videoTimeSeconds = timestampMs / 1000;
    const videoDuration = visualVideoRef.current.duration || 0;
    const clampedTime = Math.min(Math.max(0, videoTimeSeconds), videoDuration);

    visualVideoRef.current.currentTime = clampedTime;
    visualVideoRef.current.play().catch(() => {});
    setIsVisualVideoPlaying(true);
  }, [visualVideoRef, setIsVisualVideoPlaying]);

  // Feature #1880: Handle visual video time update
  const handleVisualVideoTimeUpdate = useCallback(() => {
    if (visualVideoRef.current) {
      setVisualVideoCurrentTime(visualVideoRef.current.currentTime * 1000);
    }
  }, [visualVideoRef, setVisualVideoCurrentTime]);

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
  }, [videoRef, runDurationMs, setIsVideoPlaying]);

  // Feature #1865: Handle video time update
  const handleVideoTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentVideoTime(videoRef.current.currentTime * 1000); // Convert to ms
    }
  }, [videoRef, setCurrentVideoTime]);

  // Feature #1865: Download video
  const handleVideoDownload = useCallback(async () => {
    if (!videoUrl || !token) return;

    // Extract filename from videoUrl or use a default
    const videoFile = videoUrl.includes('/') ? videoUrl.split('/').pop() : 'video.webm';

    try {
      const response = await fetch(videoUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = videoFile || 'video.webm';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    }
  }, [videoUrl, token]);

  // Feature #1865: Handle step click to seek video
  const handleStepVideoSeek = useCallback((step: { computedTimestamp: number }) => {
    if (!videoUrl || !run?.started_at) return;

    // Calculate time offset from run start in milliseconds
    const runStartTime = new Date(run.started_at).getTime();
    const stepOffsetMs = step.computedTimestamp - runStartTime;

    seekVideoToTime(stepOffsetMs);
  }, [videoUrl, run, seekVideoToTime]);

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
  }, [runId, token, setCancellingTest, setLiveMode]);

  // Feature #1877: Zoom controls for visual inspection
  const handleZoomIn = useCallback((resultId: string) => {
    setVisualZoom(prev => ({ ...prev, [resultId]: Math.min((prev[resultId] || 1) * 1.25, 5) }));
  }, [setVisualZoom]);

  const handleZoomOut = useCallback((resultId: string) => {
    setVisualZoom(prev => ({ ...prev, [resultId]: Math.max((prev[resultId] || 1) / 1.25, 0.5) }));
  }, [setVisualZoom]);

  const handleZoomReset = useCallback((resultId: string) => {
    setVisualZoom(prev => ({ ...prev, [resultId]: 1 }));
    setVisualPan(prev => ({ ...prev, [resultId]: { x: 0, y: 0 } }));
  }, [setVisualZoom, setVisualPan]);

  const handleZoomFit = useCallback((resultId: string) => {
    setVisualZoom(prev => ({ ...prev, [resultId]: 1 }));
    setVisualPan(prev => ({ ...prev, [resultId]: { x: 0, y: 0 } }));
  }, [setVisualZoom, setVisualPan]);

  // Feature #1877: Pan controls for visual inspection (mouse drag)
  const handlePanStart = useCallback((e: React.MouseEvent, resultId: string) => {
    const currentZoom = visualZoom[resultId] || 1;
    if (currentZoom <= 1) return; // Don't pan when not zoomed

    e.preventDefault();
    setIsPanning(true);
    const currentPan = visualPan[resultId] || { x: 0, y: 0 };
    setPanStart({ x: e.clientX, y: e.clientY, panX: currentPan.x, panY: currentPan.y });
  }, [visualZoom, visualPan, setIsPanning, setPanStart]);

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
  }, [isPanning, panStart, visualZoom, setVisualPan]);

  const handlePanEnd = useCallback(() => {
    setIsPanning(false);
    setPanStart(null);
  }, [setIsPanning, setPanStart]);

  // Feature #1877: Handle scroll wheel zoom
  const handleWheelZoom = useCallback((e: React.WheelEvent, resultId: string) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setVisualZoom(prev => {
      const currentZoom = prev[resultId] || 1;
      const newZoom = Math.max(0.5, Math.min(5, currentZoom * delta));
      return { ...prev, [resultId]: newZoom };
    });
  }, [setVisualZoom]);

  // Feature #1834: Download all screenshots as ZIP
  const downloadAllAsZip = useCallback(async () => {
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
  }, [allScreenshots, runId, setDownloadingZip]);

  // Feature #2001: Download screenshots for a specific test type group as ZIP
  const downloadGroupAsZip = useCallback(async (testType: string, screenshots: ScreenshotItem[]) => {
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
  }, [setDownloadingZip]);

  // Feature #1834: Download single screenshot
  const downloadScreenshot = useCallback((screenshot: ScreenshotItem) => {
    const link = document.createElement('a');
    link.href = screenshot.url;
    link.download = `${screenshot.testName}-${screenshot.type}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  return {
    // Toggle handlers
    toggleStep,
    toggleOpportunity,
    toggleDiagnostic,
    togglePassedAudit,
    toggleEndpoint,
    toggleViolation,
    toggleComparisonSelect,

    // Baseline handlers
    handleApproveBaseline,
    handleRejectBaseline,

    // AI analysis handlers
    analyzePerformanceResults,

    // Export handlers
    exportK6Results,
    downloadAllAsZip,
    downloadGroupAsZip,
    downloadScreenshot,

    // Video handlers
    seekVisualVideoToMarker,
    handleVisualVideoTimeUpdate,
    seekVideoToTime,
    handleVideoTimeUpdate,
    handleVideoDownload,
    handleStepVideoSeek,

    // Test control handlers
    cancelTest,

    // Zoom/Pan handlers
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    handleZoomFit,
    handlePanStart,
    handlePanMove,
    handlePanEnd,
    handleWheelZoom,
  };
}

export default useTestRunHandlers;
