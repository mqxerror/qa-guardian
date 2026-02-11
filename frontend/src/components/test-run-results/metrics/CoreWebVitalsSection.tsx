/**
 * CoreWebVitalsSection - Core Web Vitals display with mobile/desktop comparison
 * Feature #103: Extracted from MetricsTab.tsx
 * Feature #644: Added proper types for lighthouse prop
 */
import React from 'react';
import type { LighthouseData } from './LighthouseTabs';

// Metric card input type
interface MetricCardInput {
 label: string;
 value: number;
 format: (v: number) => string;
 threshold: { good: number; poor: number };
}

interface CoreWebVitalsSectionProps {
 lighthouse: LighthouseData;
}

export const CoreWebVitalsSection: React.FC<CoreWebVitalsSectionProps> = ({ lighthouse }) => {
 // Helper to render a single metric card
 const renderMetricCard = (
 metric: { label: string; value: number; format: (v: number) => string; threshold: { good: number; poor: number } },
 prefix: string = ''
 ) => {
 const value = metric.value || 0;
 const status = value <= metric.threshold.good ? 'good' : value <= metric.threshold.poor ? 'needs-improvement' : 'poor';
 return (
 <div
 key={`${prefix}${metric.label}`}
 className={`p-3 rounded-lg ${
 status === 'good' ? 'bg-success/5 border border-success/20' :
 status === 'needs-improvement' ? 'bg-warning/5 border border-warning/20' :
 'bg-destructive/5 border border-destructive/20'
 }`}
 >
 <div className="text-xs font-medium text-muted-foreground mb-1">{metric.label}</div>
 <div className={`text-xl font-bold ${
 status === 'good' ? 'text-success' :
 status === 'needs-improvement' ? 'text-warning' :
 'text-destructive'
 }`}>
 {metric.format(value)}
 </div>
 </div>
 );
 };

 // Feature #67: Check if both mobile and desktop metrics are available
 const hasBothDevices = lighthouse.mobileResults?.metrics && lighthouse.desktopResults?.metrics;

 return (
 <div className="border border-border rounded-lg p-4 mb-6">
 <div className="flex items-center justify-between mb-4">
 <h4 className="font-medium text-foreground flex items-center gap-2">
 <span>⚡</span> Core Web Vitals
 {hasBothDevices && (
 <span className="text-xs text-muted-foreground ml-2">(Mobile vs Desktop)</span>
 )}
 </h4>
 <div className="flex gap-4">
 <span className="flex items-center gap-1 text-xs text-success">
 <span className="w-2 h-2 rounded-full bg-success"></span> Good
 </span>
 <span className="flex items-center gap-1 text-xs text-warning">
 <span className="w-2 h-2 rounded-full bg-warning"></span> Needs Improvement
 </span>
 <span className="flex items-center gap-1 text-xs text-destructive">
 <span className="w-2 h-2 rounded-full bg-destructive"></span> Poor
 </span>
 </div>
 </div>

 {hasBothDevices ? (
 /* Feature #67: Side-by-side Core Web Vitals comparison */
 <div className="space-y-4">
 {/* LCP Comparison */}
 <MetricComparisonRow
 metricName="Largest Contentful Paint"
 mobileValue={lighthouse.mobileResults!.metrics.largest_contentful_paint}
 desktopValue={lighthouse.desktopResults!.metrics.largest_contentful_paint}
 mobileLabel="📱 LCP"
 desktopLabel="🖥️ LCP"
 format={(v: number) => `${(v / 1000).toFixed(2)}s`}
 threshold={{ good: 2500, poor: 4000 }}
 renderMetricCard={renderMetricCard}
 />

 {/* FCP Comparison */}
 <MetricComparisonRow
 metricName="First Contentful Paint"
 mobileValue={lighthouse.mobileResults!.metrics.first_contentful_paint}
 desktopValue={lighthouse.desktopResults!.metrics.first_contentful_paint}
 mobileLabel="📱 FCP"
 desktopLabel="🖥️ FCP"
 format={(v: number) => `${(v / 1000).toFixed(2)}s`}
 threshold={{ good: 1800, poor: 3000 }}
 renderMetricCard={renderMetricCard}
 />

 {/* CLS Comparison */}
 <MetricComparisonRow
 metricName="Cumulative Layout Shift"
 mobileValue={lighthouse.mobileResults!.metrics.cumulative_layout_shift}
 desktopValue={lighthouse.desktopResults!.metrics.cumulative_layout_shift}
 mobileLabel="📱 CLS"
 desktopLabel="🖥️ CLS"
 format={(v: number) => v.toFixed(3)}
 threshold={{ good: 0.1, poor: 0.25 }}
 renderMetricCard={renderMetricCard}
 />

 {/* TBT Comparison */}
 <MetricComparisonRow
 metricName="Total Blocking Time"
 mobileValue={lighthouse.mobileResults!.metrics.total_blocking_time}
 desktopValue={lighthouse.desktopResults!.metrics.total_blocking_time}
 mobileLabel="📱 TBT"
 desktopLabel="🖥️ TBT"
 format={(v: number) => `${Math.round(v)}ms`}
 threshold={{ good: 200, poor: 600 }}
 renderMetricCard={renderMetricCard}
 />

 {/* Speed Index Comparison */}
 <MetricComparisonRow
 metricName="Speed Index"
 mobileValue={lighthouse.mobileResults!.metrics.speed_index}
 desktopValue={lighthouse.desktopResults!.metrics.speed_index}
 mobileLabel="📱 SI"
 desktopLabel="🖥️ SI"
 format={(v: number) => `${(v / 1000).toFixed(2)}s`}
 threshold={{ good: 3400, poor: 5800 }}
 renderMetricCard={renderMetricCard}
 />
 </div>
 ) : (
 /* Original single-device view */
 <SingleDeviceMetrics lighthouse={lighthouse} />
 )}
 </div>
 );
};

// Helper component for metric comparison row
interface MetricComparisonRowProps {
 metricName: string;
 mobileValue: number;
 desktopValue: number;
 mobileLabel: string;
 desktopLabel: string;
 format: (v: number) => string;
 threshold: { good: number; poor: number };
 renderMetricCard: (metric: MetricCardInput, prefix: string) => React.ReactNode;
}

const MetricComparisonRow: React.FC<MetricComparisonRowProps> = ({
 metricName,
 mobileValue,
 desktopValue,
 mobileLabel,
 desktopLabel,
 format,
 threshold,
 renderMetricCard,
}) => (
 <div className="grid grid-cols-3 gap-2 items-center">
 <div className="text-center">
 {renderMetricCard({ label: mobileLabel, value: mobileValue, format, threshold }, 'mobile-')}
 </div>
 <div className="text-center text-sm text-muted-foreground">
 {metricName}
 </div>
 <div className="text-center">
 {renderMetricCard({ label: desktopLabel, value: desktopValue, format, threshold }, 'desktop-')}
 </div>
 </div>
);

// Single device metrics display
const SingleDeviceMetrics: React.FC<{ lighthouse: LighthouseData }> = ({ lighthouse }) => (
 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
 {[
 { label: 'LCP', fullName: 'Largest Contentful Paint', value: lighthouse.metrics?.lcp, format: (v: number) => `${(v / 1000).toFixed(2)}s`, threshold: { good: 2500, poor: 4000, max: 8000 }, description: 'Measures loading performance' },
 { label: 'FCP', fullName: 'First Contentful Paint', value: lighthouse.metrics?.fcp, format: (v: number) => `${(v / 1000).toFixed(2)}s`, threshold: { good: 1800, poor: 3000, max: 6000 }, description: 'First content visible' },
 { label: 'CLS', fullName: 'Cumulative Layout Shift', value: lighthouse.metrics?.cls, format: (v: number) => v.toFixed(3), threshold: { good: 0.1, poor: 0.25, max: 0.5 }, description: 'Visual stability' },
 { label: 'TBT', fullName: 'Total Blocking Time', value: lighthouse.metrics?.tbt, format: (v: number) => `${v}ms`, threshold: { good: 200, poor: 600, max: 1200 }, description: 'Main thread blocking' },
 ].filter(m => m.value !== undefined).map(metric => {
 const value = metric.value || 0;
 const status = value <= metric.threshold.good ? 'good' : value <= metric.threshold.poor ? 'needs-improvement' : 'poor';

 return (
 <div
 key={metric.label}
 className={`p-4 rounded-lg ${
 status === 'good' ? 'bg-success/5 border border-success/20' :
 status === 'needs-improvement' ? 'bg-warning/5 border border-warning/20' :
 'bg-destructive/5 border border-destructive/20'
 }`}
 >
 <div className="text-xs font-medium text-muted-foreground mb-1">{metric.label}</div>
 <div className={`text-2xl font-bold ${
 status === 'good' ? 'text-success' :
 status === 'needs-improvement' ? 'text-warning' :
 'text-destructive'
 }`}>
 {metric.format(value)}
 </div>
 <div className="text-[10px] text-muted-foreground mt-1">{metric.description}</div>
 </div>
 );
 })}
 </div>
);
