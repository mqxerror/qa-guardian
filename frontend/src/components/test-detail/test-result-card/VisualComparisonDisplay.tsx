// Feature #48: VisualComparisonDisplay - Extracted from TestResultCard.tsx
// Displays visual regression comparison results with multiple view modes

import React from 'react';
import { TestResult } from './types';

// Feature #421: Proper type for visual comparison view modes
type ComparisonViewMode = 'side-by-side' | 'slider' | 'onion-skin' | 'diff' | 'diff-overlay';

interface VisualComparisonDisplayProps {
 result: TestResult;
 comparisonViewMode: ComparisonViewMode;
 setComparisonViewMode: (mode: ComparisonViewMode) => void;
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
}

export function VisualComparisonDisplay({
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
}: VisualComparisonDisplayProps) {
 if (!result.visual_comparison) return null;

 const vc = result.visual_comparison;

 return (
 <div className="mt-4 p-4 border border-border rounded-lg bg-muted/30">
 <div className="flex items-center gap-2 mb-3">
 <span className="text-lg">🔍</span>
 <h4 className="text-sm font-semibold text-foreground">Visual Comparison</h4>
 {vc.baselineCorrupted && (
 <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
 ⚠️ Baseline Corrupted
 </span>
 )}
 {result.diff_percentage !== undefined && !vc.baselineCorrupted && (
 <span className={`text-xs px-2 py-0.5 rounded-full ${
 result.diff_percentage === 0
 ? 'bg-success/10 text-success'
 : 'bg-warning/10 text-warning'
 }`}>
 {result.diff_percentage === 0 ? '✓ Match' : `${result.diff_percentage.toFixed(2)}% different`}
 </span>
 )}
 {!vc.hasBaseline && (
 <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
 📸 Baseline Created
 </span>
 )}
 </div>

 {/* Corrupted baseline handling */}
 {vc.baselineCorrupted && (
 <div className="mb-4 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
 <div className="flex items-start gap-3">
 <span className="text-destructive text-lg">⚠️</span>
 <div className="flex-1">
 <h5 className="font-medium text-destructive">Baseline Image Corrupted or Unreadable</h5>
 <p className="text-sm text-destructive mt-1">
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
 {(['side-by-side', 'slider', 'onion-skin', 'diff', 'diff-overlay'] as const).map((mode) => (
 <button
 key={mode}
 onClick={() => setComparisonViewMode(mode)}
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
 className="px-3 py-1.5 text-xs font-medium bg-success text-white rounded hover:bg-success"
 >
 ✓ Approve as New Baseline
 </button>
 <button
 onClick={() => onRejectChanges(result.test_id)}
 className="px-3 py-1.5 text-xs font-medium bg-destructive text-white rounded hover:bg-destructive"
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
 <p className="text-sm text-success">
 ✓ Screenshot matches baseline perfectly
 </p>
 )}
 </div>
 );
}
