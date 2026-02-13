/**
 * VisualTab - Visual regression results display with comparison tools
 * Extracted from TestRunResultPage.tsx for modularity (Feature #46)
 */

import React, { useState, useCallback } from 'react';
import { ChevronDown, Loader2, ChevronRight, Check, X, Plus, ZoomOut, ZoomIn, Maximize2, ChevronsUpDown, ImageIcon } from 'lucide-react';
import { TestResult, VisualViewMode, VisualMarker } from './types';

interface VisualTabProps {
 // Visual results data
 visualResults: TestResult[];

 // Video player state (Feature #1880)
 videoUrl: string | null;
 videoLoading: boolean;
 videoError: string | null;
 visualVideoRef: React.RefObject<HTMLVideoElement>;
 visualMarkers: VisualMarker[];
 runDurationMs: number;

 // Baseline approval handlers
 onApproveBaseline: (testId: string, resultIdx: number, viewportId?: string) => Promise<void>;
 onRejectBaseline: (testId: string, resultIdx: number, viewportId?: string) => Promise<void>;
 approvalLoading: Record<string, boolean>;
}

export default function VisualTab({
 visualResults,
 videoUrl,
 videoLoading,
 videoError,
 visualVideoRef,
 visualMarkers,
 runDurationMs,
 onApproveBaseline,
 onRejectBaseline,
 approvalLoading,
}: VisualTabProps) {
 // Local state for view mode and comparison controls
 const [visualViewMode, setVisualViewMode] = useState<VisualViewMode>('side-by-side');
 const [sliderPosition, setSliderPosition] = useState<Record<string, number>>({});
 const [onionOpacity, setOnionOpacity] = useState<Record<string, number>>({});
 const [expandedVisualResults, setExpandedVisualResults] = useState<Set<string>>(new Set());

 // Feature #1877: Zoom and pan state for visual inspection
 const [visualZoom, setVisualZoom] = useState<Record<string, number>>({});
 const [visualPan, setVisualPan] = useState<Record<string, { x: number; y: number }>>({});
 const [isPanning, setIsPanning] = useState(false);
 const [panStart, setPanStart] = useState<{ x: number; y: number; panX: number; panY: number } | null>(null);

 // Feature #1880: Video timeline state
 const [visualVideoExpanded, setVisualVideoExpanded] = useState(false);
 const [visualVideoCurrentTime, setVisualVideoCurrentTime] = useState(0);
 const [, setIsVisualVideoPlaying] = useState(false);

 // Toggle visual result expansion
 const toggleVisualResult = (resultId: string) => {
 setExpandedVisualResults(prev => {
 const next = new Set(prev);
 if (next.has(resultId)) {
 next.delete(resultId);
 } else {
 next.add(resultId);
 }
 return next;
 });
 };

 // Handle slider position change
 const handleSliderChange = (resultId: string, position: number) => {
 setSliderPosition(prev => ({ ...prev, [resultId]: position }));
 };

 // Handle onion opacity change
 const handleOnionOpacityChange = (resultId: string, opacity: number) => {
 setOnionOpacity(prev => ({ ...prev, [resultId]: opacity }));
 };

 // Feature #1877: Zoom controls for visual inspection
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

 // Feature #1877: Pan controls for visual inspection (mouse drag)
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

 // Feature #1877: Handle scroll wheel zoom
 const handleWheelZoom = useCallback((e: React.WheelEvent, resultId: string) => {
 e.preventDefault();
 const delta = e.deltaY > 0 ? 0.9 : 1.1;
 setVisualZoom(prev => {
 const currentZoom = prev[resultId] || 1;
 const newZoom = Math.max(0.5, Math.min(5, currentZoom * delta));
 return { ...prev, [resultId]: newZoom };
 });
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
 }, [visualVideoRef]);

 // Feature #1880: Handle visual video time update
 const handleVisualVideoTimeUpdate = useCallback(() => {
 if (visualVideoRef.current) {
 setVisualVideoCurrentTime(visualVideoRef.current.currentTime * 1000);
 }
 }, [visualVideoRef]);

 // Wrapper handlers for baseline approval/rejection
 const handleApproveBaseline = async (testId: string, idx: number, viewportId?: string) => {
 await onApproveBaseline(testId, idx, viewportId);
 };

 const handleRejectBaseline = async (testId: string, idx: number, viewportId?: string) => {
 await onRejectBaseline(testId, idx, viewportId);
 };

 return (
 <div>
 {/* Header with view mode controls */}
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
 <div>
 <h2 className="text-lg font-semibold text-foreground">Visual Regression Results</h2>
 <p className="text-sm text-muted-foreground">
 {visualResults.length} visual test{visualResults.length !== 1 ? 's' : ''} with comparison data
 </p>
 </div>
 <div className="flex items-center gap-2">
 {/* View mode toggle */}
 <div className="flex items-center bg-muted rounded-lg p-1">
 {[
 { id: 'side-by-side' as const, label: 'Side by Side', icon: '📊' },
 { id: 'slider' as const, label: 'Slider', icon: '↔️' },
 { id: 'onion' as const, label: 'Onion Skin', icon: '👁️' },
 ].map(mode => (
 <button
 key={mode.id}
 onClick={() => setVisualViewMode(mode.id)}
 className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5 ${
 visualViewMode === mode.id
 ? 'bg-background text-foreground shadow-sm'
 : 'text-muted-foreground hover:text-foreground'
 }`}
 >
 <span>{mode.icon}</span>
 {mode.label}
 </button>
 ))}
 </div>
 </div>
 </div>

 {/* Feature #1880: Video player with diff timestamp markers */}
 {videoUrl && visualMarkers.length > 0 && (
 <div className="mb-6 border border-border rounded-lg overflow-hidden bg-card">
 <button
 onClick={() => setVisualVideoExpanded(!visualVideoExpanded)}
 className="w-full flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 transition-colors"
 >
 <div className="flex items-center gap-2">
 <span className="text-lg">🎬</span>
 <span className="font-medium text-foreground">Test Recording with Visual Markers</span>
 <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded-full">
 {visualMarkers.length} marker{visualMarkers.length !== 1 ? 's' : ''}
 </span>
 </div>
 <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${visualVideoExpanded ? 'rotate-180' : ''}`} />
 </button>

 {visualVideoExpanded && (
 <div>
 {/* Video player */}
 <div className="bg-black">
 {videoLoading && (
 <div className="flex items-center justify-center h-48 text-muted-foreground">
 <Loader2 className="animate-spin h-6 w-6 mr-2" />
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
 ref={visualVideoRef}
 controls
 preload="metadata"
 className="w-full max-h-80"
 controlsList="nodownload"
 playsInline
 src={videoUrl}
 onTimeUpdate={handleVisualVideoTimeUpdate}
 onPlay={() => setIsVisualVideoPlaying(true)}
 onPause={() => setIsVisualVideoPlaying(false)}
 onEnded={() => setIsVisualVideoPlaying(false)}
 >
 Your browser does not support the video tag.
 </video>
 )}
 </div>

 {/* Custom timeline with markers */}
 <div className="p-3 bg-muted/30 border-t border-border">
 <div className="flex items-center gap-2 mb-2">
 <span className="text-xs font-medium text-muted-foreground">Visual Timeline</span>
 <div className="flex items-center gap-3 text-xs text-muted-foreground">
 <span className="flex items-center gap-1">
 <span className="w-2 h-2 rounded-full bg-primary"></span>
 Screenshot
 </span>
 <span className="flex items-center gap-1">
 <span className="w-2 h-2 rounded-full bg-destructive"></span>
 Diff Detected
 </span>
 </div>
 </div>

 {/* Timeline bar with markers */}
 <div className="relative h-8 bg-muted rounded-lg overflow-visible">
 {/* Progress indicator */}
 {runDurationMs > 0 && (
 <div
 className="absolute top-0 left-0 h-full bg-primary/20 rounded-l-lg transition-all"
 style={{ width: `${Math.min((visualVideoCurrentTime / runDurationMs) * 100, 100)}%` }}
 />
 )}

 {/* Playhead */}
 {runDurationMs > 0 && (
 <div
 className="absolute top-0 h-full w-0.5 bg-primary z-10"
 style={{ left: `${Math.min((visualVideoCurrentTime / runDurationMs) * 100, 100)}%` }}
 />
 )}

 {/* Markers */}
 {runDurationMs > 0 && visualMarkers.map((marker) => {
 const position = Math.min((marker.timestampMs / runDurationMs) * 100, 100);
 const isScreenshot = marker.type === 'screenshot';
 const markerColor = isScreenshot
 ? marker.hasDiff ? 'bg-warning hover:bg-warning/80' : 'bg-primary hover:bg-primary/80'
 : 'bg-destructive hover:bg-destructive/80';

 return (
 <button
 key={marker.id}
 onClick={() => seekVisualVideoToMarker(marker.timestampMs)}
 className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full ${markerColor} cursor-pointer transition-all hover:scale-125 z-20`}
 style={{ left: `calc(${position}% - 6px)` }}
 title={`${marker.testName}${isScreenshot ? ' - Screenshot captured' : ' - Visual diff detected'} (${marker.diffPercent.toFixed(2)}% diff)\nClick to jump to this moment`}
 />
 );
 })}

 {/* Clickable timeline for seeking */}
 <div
 className="absolute inset-0 cursor-pointer"
 onClick={(e) => {
 if (!runDurationMs) return;
 const rect = e.currentTarget.getBoundingClientRect();
 const clickPosition = (e.clientX - rect.left) / rect.width;
 const seekTime = clickPosition * runDurationMs;
 seekVisualVideoToMarker(seekTime);
 }}
 />
 </div>

 {/* Marker legend/list */}
 <div className="mt-3 flex flex-wrap gap-2">
 {visualMarkers.filter(m => m.type === 'screenshot').map((marker) => (
 <button
 key={marker.id}
 onClick={() => seekVisualVideoToMarker(marker.timestampMs)}
 className={`px-2 py-1 text-xs rounded-md transition-colors flex items-center gap-1.5 ${
 marker.hasDiff
 ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
 : 'bg-primary/10 text-primary hover:bg-primary/20'
 }`}
 >
 <span className={`w-2 h-2 rounded-full ${marker.hasDiff ? 'bg-destructive' : 'bg-primary'}`}></span>
 <span className="truncate max-w-32">{marker.testName}</span>
 {marker.hasDiff && (
 <span className="font-medium">({marker.diffPercent.toFixed(2)}%)</span>
 )}
 </button>
 ))}
 </div>

 <p className="text-xs text-muted-foreground mt-2">
 💡 Click markers on timeline or buttons below to jump to screenshot capture moments
 </p>
 </div>
 </div>
 )}
 </div>
 )}

 {visualResults.length === 0 ? (
 <div className="text-center py-12 border border-dashed border-border rounded-lg">
 <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" strokeWidth={1.5} />
 <p className="text-muted-foreground">No visual comparison data available.</p>
 <p className="text-sm text-muted-foreground mt-1">Run a visual regression test to see comparisons here.</p>
 </div>
 ) : (
 <div className="space-y-6">
 {visualResults.map((result, idx) => {
 const resultKey = `${result.test_id}-${idx}`;
 const currentSlider = sliderPosition[resultKey] ?? 50;
 const currentOpacity = onionOpacity[resultKey] ?? 50;
 const isExpanded = expandedVisualResults.has(resultKey);
 const isApprovalLoading = approvalLoading[resultKey];
 const diffPercent = result.diff_percentage || (result.visual_comparison?.diffPercentage) || 0;
 const hasBaseline = result.visual_comparison?.hasBaseline || !!result.baseline_screenshot_base64;
 const hasDiff = diffPercent > 0.1;
 // Feature #1877: Zoom and pan state
 const currentZoom = visualZoom[resultKey] ?? 1;
 const currentPan = visualPan[resultKey] ?? { x: 0, y: 0 };

 return (
 <div key={idx} className="border border-border rounded-lg overflow-hidden">
 {/* Header */}
 <div className={`p-4 border-b ${
 hasBaseline
 ? hasDiff
 ? 'bg-destructive/5 border-destructive/20'
 : 'bg-success/5 border-success/20'
 : 'bg-warning/5 border-warning/20'
 }`}>
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <button
 onClick={() => toggleVisualResult(resultKey)}
 className="p-1 hover:bg-black/5 rounded"
 >
 <ChevronRight className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
 </button>
 <div>
 <h3 className="font-medium text-foreground">{result.test_name}</h3>
 {result.visual_comparison?.baselineCorrupted && (
 <p className="text-sm text-destructive mt-1">
 ⚠️ Baseline corrupted: {result.visual_comparison.corruptionError}
 </p>
 )}
 </div>
 </div>
 <div className="flex items-center gap-3">
 {/* Diff badge */}
 {hasBaseline ? (
 <span className={`px-3 py-1 rounded-full text-sm font-medium ${
 hasDiff ? 'bg-destructive text-primary-foreground' : 'bg-success text-primary-foreground'
 }`}>
 {diffPercent.toFixed(2)}% diff
 </span>
 ) : (
 <span className="px-3 py-1 rounded-full text-sm font-medium bg-warning text-primary-foreground">
 No baseline
 </span>
 )}

 {/* Approve/Reject buttons */}
 {hasBaseline && hasDiff && (
 <div className="flex items-center gap-2">
 <button
 onClick={() => handleApproveBaseline(result.test_id, idx)}
 disabled={isApprovalLoading}
 className="px-3 py-1.5 text-sm bg-success text-primary-foreground rounded-lg hover:bg-success disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
 >
 {isApprovalLoading ? (
 <Loader2 className="w-4 h-4 animate-spin" />
 ) : (
 <Check className="w-4 h-4" />
 )}
 Approve
 </button>
 <button
 onClick={() => handleRejectBaseline(result.test_id, idx)}
 disabled={isApprovalLoading}
 className="px-3 py-1.5 text-sm bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
 >
 <X className="w-4 h-4" />
 Reject
 </button>
 </div>
 )}

 {/* Set as baseline if no baseline */}
 {!hasBaseline && result.screenshot_base64 && (
 <button
 onClick={() => handleApproveBaseline(result.test_id, idx)}
 disabled={isApprovalLoading}
 className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
 >
 {isApprovalLoading ? (
 <Loader2 className="w-4 h-4 animate-spin" />
 ) : (
 <Plus className="w-4 h-4" />
 )}
 Set as Baseline
 </button>
 )}
 </div>
 </div>
 </div>

 {/* Expanded content */}
 {(isExpanded || !hasBaseline || hasDiff) && (
 <div className="p-4">
 {/* Stats row */}
 {result.visual_comparison && (
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
 <div className="p-3 bg-muted/30 rounded-lg text-center">
 <div className={`text-2xl font-bold ${hasDiff ? 'text-destructive' : 'text-success'}`}>
 {diffPercent.toFixed(4)}%
 </div>
 <div className="text-xs text-muted-foreground">Diff Percentage</div>
 </div>
 <div className="p-3 bg-muted/30 rounded-lg text-center">
 <div className="text-2xl font-bold text-foreground">
 {(result.visual_comparison.mismatchedPixels || 0).toLocaleString()}
 </div>
 <div className="text-xs text-muted-foreground">Changed Pixels</div>
 </div>
 <div className="p-3 bg-muted/30 rounded-lg text-center">
 <div className="text-2xl font-bold text-foreground">
 {(result.visual_comparison.totalPixels || 0).toLocaleString()}
 </div>
 <div className="text-xs text-muted-foreground">Total Pixels</div>
 </div>
 <div className={`p-3 rounded-lg text-center ${hasBaseline ? 'bg-success/5' : 'bg-warning/5'}`}>
 <div className={`text-2xl font-bold ${hasBaseline ? 'text-success' : 'text-warning'}`}>
 {hasBaseline ? '✓' : '?'}
 </div>
 <div className="text-xs text-muted-foreground">{hasBaseline ? 'Baseline Set' : 'No Baseline'}</div>
 </div>
 </div>
 )}

 {/* Feature #1913 & #1919: Multi-viewport results with full comparison */}
 {result.viewport_results && result.viewport_results.length > 0 && (
 <div className="mb-6">
 <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
 📐 Viewport Results
 <span className="text-xs font-normal text-muted-foreground">
 ({result.viewport_results.length} viewport{result.viewport_results.length !== 1 ? 's' : ''})
 </span>
 </h4>
 <div className="space-y-4">
 {result.viewport_results.map((vp) => {
 const vpHasDiff = (vp.diffPercentage || 0) > 0.1;
 const vpHasBaseline = vp.visualComparison?.hasBaseline !== false;
 return (
 <div
 key={vp.viewportId}
 className={`rounded-lg border ${
 vpHasBaseline
 ? vpHasDiff
 ? 'border-destructive/20'
 : 'border-success/20'
 : 'border-warning/20'
 }`}
 >
 {/* Viewport header */}
 <div className={`p-3 border-b ${
 vpHasBaseline
 ? vpHasDiff
 ? 'bg-destructive/5 border-destructive/20'
 : 'bg-success/5 border-success/20'
 : 'bg-warning/5 border-warning/20'
 }`}>
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <span className="font-medium text-foreground">
 {vp.viewportLabel}
 </span>
 <span className="text-xs text-muted-foreground">
 {vp.width}×{vp.height}
 </span>
 <span className={`px-2 py-0.5 rounded text-xs font-medium ${
 vpHasBaseline
 ? vpHasDiff
 ? 'bg-destructive text-primary-foreground'
 : 'bg-success text-primary-foreground'
 : 'bg-warning text-primary-foreground'
 }`}>
 {vpHasBaseline
 ? `${(vp.diffPercentage || 0).toFixed(2)}% diff`
 : 'No baseline'
 }
 </span>
 </div>
 {/* Per-viewport approve/reject buttons */}
 {vpHasBaseline && vpHasDiff && (
 <div className="flex items-center gap-2">
 <button
 onClick={() => handleApproveBaseline(result.test_id, idx, vp.viewportId)}
 className="px-2 py-1 text-xs bg-success text-primary-foreground rounded hover:bg-success transition-colors"
 title={`Approve ${vp.viewportLabel} baseline`}
 >
 ✓ Approve
 </button>
 <button
 onClick={() => handleRejectBaseline(result.test_id, idx, vp.viewportId)}
 className="px-2 py-1 text-xs bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 transition-colors"
 title={`Reject ${vp.viewportLabel} baseline`}
 >
 ✗ Reject
 </button>
 </div>
 )}
 {!vpHasBaseline && vp.screenshotBase64 && (
 <button
 onClick={() => handleApproveBaseline(result.test_id, idx, vp.viewportId)}
 className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
 title={`Set ${vp.viewportLabel} as baseline`}
 >
 + Set Baseline
 </button>
 )}
 </div>
 </div>
 {/* Viewport comparison images */}
 <div className="p-4">
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 {/* Baseline */}
 {vp.baselineScreenshotBase64 && (
 <div className="space-y-2">
 <div className="text-xs font-medium text-muted-foreground text-center">Baseline</div>
 <div className="rounded border border-border overflow-hidden">
 <img
 src={`data:image/png;base64,${vp.baselineScreenshotBase64}`}
 alt={`${vp.viewportLabel} baseline`}
 className="w-full object-contain max-h-48"
 />
 </div>
 </div>
 )}
 {/* Current */}
 {vp.screenshotBase64 && (
 <div className="space-y-2">
 <div className="text-xs font-medium text-muted-foreground text-center">Current</div>
 <div className="rounded border border-border overflow-hidden">
 <img
 src={`data:image/png;base64,${vp.screenshotBase64}`}
 alt={`${vp.viewportLabel} current`}
 className="w-full object-contain max-h-48"
 />
 </div>
 </div>
 )}
 {/* Diff */}
 {vp.diffImageBase64 && (
 <div className="space-y-2">
 <div className="text-xs font-medium text-muted-foreground text-center">Difference</div>
 <div className="rounded border border-destructive/30 overflow-hidden">
 <img
 src={`data:image/png;base64,${vp.diffImageBase64}`}
 alt={`${vp.viewportLabel} diff`}
 className="w-full object-contain max-h-48"
 />
 </div>
 </div>
 )}
 </div>
 {/* Stats */}
 {vp.visualComparison && (
 <div className="mt-3 pt-3 border-t border-border flex justify-center gap-6 text-xs text-muted-foreground">
 <span>Changed: <strong className="text-foreground">{(vp.visualComparison.mismatchedPixels || 0).toLocaleString()}</strong> px</span>
 <span>Total: <strong className="text-foreground">{(vp.visualComparison.totalPixels || 0).toLocaleString()}</strong> px</span>
 </div>
 )}
 </div>
 </div>
 );
 })}
 </div>
 </div>
 )}

 {/* Feature #1877: Zoom and pan controls */}
 <div className="flex items-center justify-between mb-4 py-2 px-3 bg-muted/30 rounded-lg">
 <div className="flex items-center gap-2">
 <span className="text-sm font-medium text-foreground">🔍 Zoom & Pan</span>
 <span className="text-xs text-muted-foreground">
 {Math.round(currentZoom * 100)}%
 </span>
 </div>
 <div className="flex items-center gap-1">
 <button
 onClick={() => handleZoomOut(resultKey)}
 className="p-1.5 rounded-md hover:bg-muted transition-colors"
 title="Zoom Out (-)"
 >
 <ZoomOut className="w-4 h-4" />
 </button>
 <button
 onClick={() => handleZoomIn(resultKey)}
 className="p-1.5 rounded-md hover:bg-muted transition-colors"
 title="Zoom In (+)"
 >
 <ZoomIn className="w-4 h-4" />
 </button>
 <button
 onClick={() => handleZoomFit(resultKey)}
 className="p-1.5 rounded-md hover:bg-muted transition-colors"
 title="Fit to Screen"
 >
 <Maximize2 className="w-4 h-4" />
 </button>
 <button
 onClick={() => handleZoomReset(resultKey)}
 className="px-2 py-1 text-xs rounded-md hover:bg-muted transition-colors"
 title="Reset View"
 >
 Reset
 </button>
 </div>
 <p className="text-xs text-muted-foreground">
 {currentZoom > 1 ? '📌 Drag to pan' : '🖱️ Scroll to zoom'}
 </p>
 </div>

 {/* Comparison views */}
 {visualViewMode === 'side-by-side' && (
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 {result.baseline_screenshot_base64 && (
 <div>
 <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
 <span className="w-3 h-3 rounded-full bg-primary"></span>
 Baseline
 </p>
 <div
 className="relative border border-border rounded-lg overflow-hidden"
 style={{ cursor: currentZoom > 1 ? 'grab' : 'zoom-in' }}
 onMouseDown={(e) => handlePanStart(e, resultKey)}
 onMouseMove={(e) => handlePanMove(e, resultKey)}
 onMouseUp={handlePanEnd}
 onMouseLeave={handlePanEnd}
 onWheel={(e) => handleWheelZoom(e, resultKey)}
 >
 <img
 src={`data:image/png;base64,${result.baseline_screenshot_base64}`}
 alt="Baseline screenshot"
 className="w-full transition-transform"
 style={{
 transform: `scale(${currentZoom}) translate(${currentPan.x / currentZoom}px, ${currentPan.y / currentZoom}px)`,
 transformOrigin: 'center',
 }}
 draggable={false}
 />
 </div>
 </div>
 )}
 {result.screenshot_base64 && (
 <div>
 <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
 <span className="w-3 h-3 rounded-full bg-success"></span>
 Current
 </p>
 <div
 className="relative border border-border rounded-lg overflow-hidden"
 style={{ cursor: currentZoom > 1 ? 'grab' : 'zoom-in' }}
 onMouseDown={(e) => handlePanStart(e, resultKey)}
 onMouseMove={(e) => handlePanMove(e, resultKey)}
 onMouseUp={handlePanEnd}
 onMouseLeave={handlePanEnd}
 onWheel={(e) => handleWheelZoom(e, resultKey)}
 >
 <img
 src={`data:image/png;base64,${result.screenshot_base64}`}
 alt="Current screenshot"
 className="w-full transition-transform"
 style={{
 transform: `scale(${currentZoom}) translate(${currentPan.x / currentZoom}px, ${currentPan.y / currentZoom}px)`,
 transformOrigin: 'center',
 }}
 draggable={false}
 />
 </div>
 </div>
 )}
 {(result.diff_image_base64 || result.visual_comparison?.diffImage) && (
 <div>
 <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
 <span className="w-3 h-3 rounded-full bg-destructive"></span>
 Difference (red = changed)
 </p>
 <div
 className="relative border border-destructive/30 rounded-lg overflow-hidden"
 style={{ cursor: currentZoom > 1 ? 'grab' : 'zoom-in' }}
 onMouseDown={(e) => handlePanStart(e, resultKey)}
 onMouseMove={(e) => handlePanMove(e, resultKey)}
 onMouseUp={handlePanEnd}
 onMouseLeave={handlePanEnd}
 onWheel={(e) => handleWheelZoom(e, resultKey)}
 >
 <img
 src={`data:image/png;base64,${result.diff_image_base64 || result.visual_comparison?.diffImage}`}
 alt="Diff image"
 className="w-full transition-transform"
 style={{
 transform: `scale(${currentZoom}) translate(${currentPan.x / currentZoom}px, ${currentPan.y / currentZoom}px)`,
 transformOrigin: 'center',
 }}
 draggable={false}
 />
 </div>
 </div>
 )}
 </div>
 )}

 {/* Slider comparison mode */}
 {visualViewMode === 'slider' && result.baseline_screenshot_base64 && result.screenshot_base64 && (
 <div className="space-y-4">
 <div className="flex items-center gap-4">
 <span className="text-sm text-muted-foreground">Baseline</span>
 <input
 type="range"
 min="0"
 max="100"
 value={currentSlider}
 onChange={(e) => handleSliderChange(resultKey, parseInt(e.target.value))}
 className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer"
 />
 <span className="text-sm text-muted-foreground">Current</span>
 </div>
 <div className="relative border border-border rounded-lg overflow-hidden">
 {/* Baseline image (full width) */}
 <img
 src={`data:image/png;base64,${result.baseline_screenshot_base64}`}
 alt="Baseline"
 className="w-full"
 />
 {/* Current image (clipped) */}
 <div
 className="absolute inset-0 overflow-hidden"
 style={{ clipPath: `inset(0 0 0 ${currentSlider}%)` }}
 >
 <img
 src={`data:image/png;base64,${result.screenshot_base64}`}
 alt="Current"
 className="w-full"
 />
 </div>
 {/* Slider line */}
 <div
 className="absolute top-0 bottom-0 w-1 bg-card shadow-lg"
 style={{ left: `${currentSlider}%`, transform: 'translateX(-50%)' }}
 >
 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 bg-card rounded-full shadow-md flex items-center justify-center">
 <ChevronsUpDown className="w-4 h-4 text-foreground" />
 </div>
 </div>
 </div>
 <div className="flex justify-between text-xs text-muted-foreground">
 <span>← Drag slider to compare →</span>
 <span>{currentSlider}% shown as current</span>
 </div>
 </div>
 )}

 {/* Onion skin comparison mode */}
 {visualViewMode === 'onion' && result.baseline_screenshot_base64 && result.screenshot_base64 && (
 <div className="space-y-4">
 <div className="flex items-center gap-4">
 <span className="text-sm text-muted-foreground">Baseline</span>
 <input
 type="range"
 min="0"
 max="100"
 value={currentOpacity}
 onChange={(e) => handleOnionOpacityChange(resultKey, parseInt(e.target.value))}
 className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer"
 />
 <span className="text-sm text-muted-foreground">Current</span>
 </div>
 <div className="relative border border-border rounded-lg overflow-hidden">
 {/* Baseline image */}
 <img
 src={`data:image/png;base64,${result.baseline_screenshot_base64}`}
 alt="Baseline"
 className="w-full"
 />
 {/* Current image overlaid with opacity */}
 <img
 src={`data:image/png;base64,${result.screenshot_base64}`}
 alt="Current"
 className="absolute inset-0 w-full"
 style={{ opacity: currentOpacity / 100 }}
 />
 </div>
 <div className="flex justify-between text-xs text-muted-foreground">
 <span>Current overlay opacity: {currentOpacity}%</span>
 <span>Adjust to see differences</span>
 </div>
 </div>
 )}

 {/* Show diff image below in slider/onion modes */}
 {(visualViewMode === 'slider' || visualViewMode === 'onion') && (result.diff_image_base64 || result.visual_comparison?.diffImage) && (
 <div className="mt-6 pt-6 border-t border-border">
 <p className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
 <span className="w-3 h-3 rounded-full bg-destructive"></span>
 Difference Highlight (changed pixels in red)
 </p>
 <div className="border border-destructive/30 rounded-lg overflow-hidden max-w-2xl">
 <img
 src={`data:image/png;base64,${result.diff_image_base64 || result.visual_comparison?.diffImage}`}
 alt="Diff image"
 className="w-full"
 />
 </div>
 </div>
 )}
 </div>
 )}
 </div>
 );
 })}
 </div>
 )}
 </div>
 );
}
