/**
 * useVisualTestState - Custom hook for visual testing UI state management
 * Extracted from TestRunResultPage.tsx for modularity (Feature #46)
 *
 * This hook manages:
 * - Visual comparison states (visualViewMode, onionOpacity, sliderPosition)
 * - Visual video states (visualVideoRef, video playback state)
 * - Baseline approval states (approvalLoading)
 * - Visual zoom and pan states
 * - Handlers for visual test operations (approve/reject baseline)
 *
 * Note: This hook does NOT compute visualResults, visualMarkers, or runDurationMs.
 * Those values come from useComputedResults hook to avoid duplication.
 */

import { useState, useRef, useCallback } from 'react';
import { toast } from '../stores/toastStore';
import { VisualViewMode } from '../components/test-run-results/types';

// Hook parameters
export interface UseVisualTestStateParams {
  runId: string | undefined;
  token: string | null;
  // Feature #676: Changed from retry to simpler retry function
  retry: () => void;
}

// Return type for the hook
export interface UseVisualTestStateReturn {
  // Visual comparison states
  visualViewMode: VisualViewMode;
  setVisualViewMode: React.Dispatch<React.SetStateAction<VisualViewMode>>;
  sliderPosition: Record<string, number>;
  setSliderPosition: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  onionOpacity: Record<string, number>;
  setOnionOpacity: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  expandedVisualResults: Set<string>;
  setExpandedVisualResults: React.Dispatch<React.SetStateAction<Set<string>>>;

  // Visual zoom and pan states (Feature #1877)
  visualZoom: Record<string, number>;
  setVisualZoom: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  visualPan: Record<string, { x: number; y: number }>;
  setVisualPan: React.Dispatch<React.SetStateAction<Record<string, { x: number; y: number }>>>;
  isPanning: boolean;
  setIsPanning: React.Dispatch<React.SetStateAction<boolean>>;
  panStart: { x: number; y: number; panX: number; panY: number } | null;
  setPanStart: React.Dispatch<React.SetStateAction<{ x: number; y: number; panX: number; panY: number } | null>>;
  visualContainerRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;

  // Visual video states (Feature #1880)
  visualVideoRef: React.RefObject<HTMLVideoElement>;
  visualVideoCurrentTime: number;
  setVisualVideoCurrentTime: React.Dispatch<React.SetStateAction<number>>;
  isVisualVideoPlaying: boolean;
  setIsVisualVideoPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  visualVideoExpanded: boolean;
  setVisualVideoExpanded: React.Dispatch<React.SetStateAction<boolean>>;

  // Baseline approval states
  approvalLoading: Record<string, boolean>;
  setApprovalLoading: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;

  // Handlers
  toggleVisualResult: (resultId: string) => void;
  handleSliderChange: (resultId: string, position: number) => void;
  handleOnionOpacityChange: (resultId: string, opacity: number) => void;
  handleZoomIn: (resultId: string) => void;
  handleZoomOut: (resultId: string) => void;
  handleZoomReset: (resultId: string) => void;
  handleZoomFit: (resultId: string) => void;
  handlePanStart: (e: React.MouseEvent, resultId: string) => void;
  handlePanMove: (e: React.MouseEvent, resultId: string) => void;
  handlePanEnd: () => void;
  handleWheelZoom: (e: React.WheelEvent, resultId: string) => void;
  handleApproveBaseline: (testId: string, resultIdx: number, viewportId?: string) => Promise<void>;
  handleRejectBaseline: (testId: string, resultIdx: number, viewportId?: string) => Promise<void>;
  seekVisualVideoToMarker: (timestampMs: number) => void;
  handleVisualVideoTimeUpdate: () => void;
}

export function useVisualTestState({
  runId,
  token,
  retry,
}: UseVisualTestStateParams): UseVisualTestStateReturn {
  // Visual comparison states (Feature #1837)
  const [visualViewMode, setVisualViewMode] = useState<VisualViewMode>('side-by-side');
  const [sliderPosition, setSliderPosition] = useState<Record<string, number>>({});
  const [onionOpacity, setOnionOpacity] = useState<Record<string, number>>({});
  const [expandedVisualResults, setExpandedVisualResults] = useState<Set<string>>(new Set());

  // Visual zoom and pan states (Feature #1877)
  const [visualZoom, setVisualZoom] = useState<Record<string, number>>({});
  const [visualPan, setVisualPan] = useState<Record<string, { x: number; y: number }>>({});
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const visualContainerRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Visual video states (Feature #1880)
  const visualVideoRef = useRef<HTMLVideoElement>(null!);
  const [visualVideoCurrentTime, setVisualVideoCurrentTime] = useState(0);
  const [isVisualVideoPlaying, setIsVisualVideoPlaying] = useState(false);
  const [visualVideoExpanded, setVisualVideoExpanded] = useState(false);

  // Baseline approval states
  const [approvalLoading, setApprovalLoading] = useState<Record<string, boolean>>({});

  // Toggle visual result expansion (Feature #1837)
  const toggleVisualResult = useCallback((resultId: string) => {
    setExpandedVisualResults(prev => {
      const next = new Set(prev);
      if (next.has(resultId)) {
        next.delete(resultId);
      } else {
        next.add(resultId);
      }
      return next;
    });
  }, []);

  // Handle slider position change (Feature #1837)
  const handleSliderChange = useCallback((resultId: string, position: number) => {
    setSliderPosition(prev => ({ ...prev, [resultId]: position }));
  }, []);

  // Handle onion opacity change (Feature #1837)
  const handleOnionOpacityChange = useCallback((resultId: string, opacity: number) => {
    setOnionOpacity(prev => ({ ...prev, [resultId]: opacity }));
  }, []);

  // Zoom controls for visual inspection (Feature #1877)
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

  // Pan controls for visual inspection (mouse drag) (Feature #1877)
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

  // Handle scroll wheel zoom (Feature #1877)
  const handleWheelZoom = useCallback((e: React.WheelEvent, resultId: string) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setVisualZoom(prev => {
      const currentZoom = prev[resultId] || 1;
      const newZoom = Math.max(0.5, Math.min(5, currentZoom * delta));
      return { ...prev, [resultId]: newZoom };
    });
  }, []);

  // Approve baseline (update to current) - supports per-viewport approval (Feature #1837 & #1919)
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
  }, [token, runId, retry]);

  // Reject (mark as regression) - supports per-viewport rejection (Feature #1837 & #1919)
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
  }, [token, runId, retry]);

  // Seek visual video to marker timestamp (Feature #1880)
  const seekVisualVideoToMarker = useCallback((timestampMs: number) => {
    if (!visualVideoRef.current) return;

    const videoTimeSeconds = timestampMs / 1000;
    const videoDuration = visualVideoRef.current.duration || 0;
    const clampedTime = Math.min(Math.max(0, videoTimeSeconds), videoDuration);

    visualVideoRef.current.currentTime = clampedTime;
    visualVideoRef.current.play().catch(() => {});
    setIsVisualVideoPlaying(true);
  }, []);

  // Handle visual video time update (Feature #1880)
  const handleVisualVideoTimeUpdate = useCallback(() => {
    if (visualVideoRef.current) {
      setVisualVideoCurrentTime(visualVideoRef.current.currentTime * 1000);
    }
  }, []);

  return {
    // Visual comparison states
    visualViewMode,
    setVisualViewMode,
    sliderPosition,
    setSliderPosition,
    onionOpacity,
    setOnionOpacity,
    expandedVisualResults,
    setExpandedVisualResults,

    // Visual zoom and pan states
    visualZoom,
    setVisualZoom,
    visualPan,
    setVisualPan,
    isPanning,
    setIsPanning,
    panStart,
    setPanStart,
    visualContainerRefs,

    // Visual video states
    visualVideoRef,
    visualVideoCurrentTime,
    setVisualVideoCurrentTime,
    isVisualVideoPlaying,
    setIsVisualVideoPlaying,
    visualVideoExpanded,
    setVisualVideoExpanded,

    // Baseline approval states
    approvalLoading,
    setApprovalLoading,

    // Handlers
    toggleVisualResult,
    handleSliderChange,
    handleOnionOpacityChange,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    handleZoomFit,
    handlePanStart,
    handlePanMove,
    handlePanEnd,
    handleWheelZoom,
    handleApproveBaseline,
    handleRejectBaseline,
    seekVisualVideoToMarker,
    handleVisualVideoTimeUpdate,
  };
}

export default useVisualTestState;
