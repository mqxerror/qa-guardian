// Feature #48: LighthouseResultsDisplay - Extracted from TestResultCard.tsx
// Feature #67: Device-specific scores with mobile + desktop side-by-side comparison
// Feature #524: Updated to use unified ScoreCard component
// Displays Lighthouse performance audit results with Core Web Vitals

import React from 'react';
import { LighthouseResults, DeviceLighthouseMetrics } from './types';
import { ScoreCard } from '../../ui/score-card';

interface DeviceScoreCardProps {
 device: 'mobile' | 'desktop';
 results: DeviceLighthouseMetrics;
}

// Feature #67: Helper component for device-specific scores
export function DeviceScoreCard({ device, results }: DeviceScoreCardProps) {
 const icon = device === 'mobile' ? '📱' : '🖥️';
 const label = device === 'mobile' ? 'Mobile' : 'Desktop';

 // Convert metrics from ms to seconds for display
 const lcp = results.metrics.largest_contentful_paint / 1000;
 const fcp = results.metrics.first_contentful_paint / 1000;
 const si = results.metrics.speed_index / 1000;
 const tbt = results.metrics.total_blocking_time;
 const cls = results.metrics.cumulative_layout_shift;
 const tti = results.metrics.time_to_interactive ? results.metrics.time_to_interactive / 1000 : undefined;

 return (
 <div className="flex-1 min-w-[280px]">
 <div className="flex items-center gap-2 mb-3">
 <span className="text-lg">{icon}</span>
 <h5 className="text-sm font-semibold text-foreground">{label}</h5>
 </div>

 {/* Feature #524: Updated to use unified ScoreCard component */}
 <div className="grid grid-cols-2 gap-2 mb-3">
   <ScoreCard score={results.performance_score} label="Performance" size="sm" />
   <ScoreCard score={results.accessibility_score} label="Accessibility" size="sm" />
   <ScoreCard score={results.best_practices_score} label="Best Practices" size="sm" />
   <ScoreCard score={results.seo_score} label="SEO" size="sm" />
 </div>

 {/* Core Web Vitals */}
 <div className="grid grid-cols-3 gap-1.5">
 <div className="p-1.5 rounded bg-background text-center">
 <div className="text-[10px] text-muted-foreground">LCP</div>
 <div className="text-xs font-semibold">{lcp.toFixed(1)}s</div>
 </div>
 <div className="p-1.5 rounded bg-background text-center">
 <div className="text-[10px] text-muted-foreground">FCP</div>
 <div className="text-xs font-semibold">{fcp.toFixed(1)}s</div>
 </div>
 <div className="p-1.5 rounded bg-background text-center">
 <div className="text-[10px] text-muted-foreground">CLS</div>
 <div className="text-xs font-semibold">{cls.toFixed(3)}</div>
 </div>
 <div className="p-1.5 rounded bg-background text-center">
 <div className="text-[10px] text-muted-foreground">TBT</div>
 <div className="text-xs font-semibold">{tbt.toFixed(0)}ms</div>
 </div>
 <div className="p-1.5 rounded bg-background text-center">
 <div className="text-[10px] text-muted-foreground">SI</div>
 <div className="text-xs font-semibold">{si.toFixed(1)}s</div>
 </div>
 {tti !== undefined && (
 <div className="p-1.5 rounded bg-background text-center">
 <div className="text-[10px] text-muted-foreground">TTI</div>
 <div className="text-xs font-semibold">{tti.toFixed(1)}s</div>
 </div>
 )}
 </div>
 </div>
 );
}

// Historical lighthouse result entry
interface LighthouseHistoryEntry {
 timestamp?: string | number;
 performance?: number;
 accessibility?: number;
 bestPractices?: number;
 seo?: number;
}

interface LighthouseResultsDisplayProps {
 lighthouse: LighthouseResults;
 lighthouseHistory: LighthouseHistoryEntry[];
 testName: string;
}

// Feature #67: Lighthouse Results Display with Mobile + Desktop side-by-side
export function LighthouseResultsDisplay({
 lighthouse,
}: LighthouseResultsDisplayProps) {
 if (lighthouse.unreachable) {
 return (
 <div className="mt-4 p-4 border border-warning/30 rounded-lg bg-warning/5">
 <div className="flex items-center gap-2">
 <span className="text-warning">🚫</span>
 <h4 className="text-sm font-semibold text-warning">URL Unreachable</h4>
 </div>
 <p className="mt-2 text-sm text-warning">
 The target URL could not be reached for Lighthouse auditing.
 </p>
 </div>
 );
 }

 if (lighthouse.timedOut) {
 return (
 <div className="mt-4 p-4 border border-warning/30 rounded-lg bg-warning/5">
 <div className="flex items-center gap-2">
 <span className="text-warning">⏱️</span>
 <h4 className="text-sm font-semibold text-warning">Lighthouse Audit Timed Out</h4>
 </div>
 </div>
 );
 }

 if (lighthouse.browserCrash) {
 return (
 <div className="mt-4 p-4 border border-destructive/30 rounded-lg bg-destructive/5">
 <div className="flex items-center gap-2">
 <span className="text-destructive">💥</span>
 <h4 className="text-sm font-semibold text-destructive">Browser Crashed During Audit</h4>
 </div>
 </div>
 );
 }

 // Feature #67: Check if we have both mobile and desktop results for side-by-side display
 const hasBothDevices = lighthouse.mobileResults && lighthouse.desktopResults;

 return (
 <div className="mt-4 p-4 border border-border rounded-lg bg-muted/30">
 <div className="flex items-center gap-2 mb-4">
 <span className="text-lg">⚡</span>
 <h4 className="text-sm font-semibold text-foreground">Lighthouse Performance Audit</h4>
 {hasBothDevices && (
 <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
 📱 + 🖥️ Both Devices
 </span>
 )}
 </div>

 {/* Feature #67: Side-by-side Mobile + Desktop comparison */}
 {hasBothDevices ? (
 <div className="flex flex-col md:flex-row gap-4">
 <DeviceScoreCard device="mobile" results={lighthouse.mobileResults!} />
 <div className="hidden md:block w-px bg-border" />
 <div className="md:hidden h-px bg-border" />
 <DeviceScoreCard device="desktop" results={lighthouse.desktopResults!} />
 </div>
 ) : (
 <>
 {/* Feature #524: Fallback single-device display using unified ScoreCard */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
   <ScoreCard score={lighthouse.performance} label="Performance" size="sm" />
   <ScoreCard score={lighthouse.accessibility} label="Accessibility" size="sm" />
   <ScoreCard score={lighthouse.bestPractices} label="Best Practices" size="sm" />
   <ScoreCard score={lighthouse.seo} label="SEO" size="sm" />
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
 </>
 )}

 {/* CSP Warning */}
 {lighthouse.csp?.blocksLighthouse && (
 <div className="mt-3 p-2 rounded bg-warning/5 border border-warning/20">
 <div className="flex items-center gap-2 text-sm text-warning">
 <span>⚠️</span>
 <span>Content Security Policy may affect audit results</span>
 </div>
 </div>
 )}

 {/* Authentication Warning */}
 {lighthouse.authenticationRequired && (
 <div className="mt-3 p-2 rounded bg-warning/5 border border-warning/20">
 <div className="flex items-center gap-2 text-sm text-warning">
 <span>🔐</span>
 <span>Page requires authentication - some metrics may be affected</span>
 </div>
 </div>
 )}
 </div>
 );
}
