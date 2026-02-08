// Feature #48: Extracted TestStepsTab component from TestDetailPage.tsx
import React from 'react';
import { TestType } from './types';

interface TestStep {
 id: string;
 action: string;
 selector?: string;
 value?: string;
 checkpointName?: string;
 checkpointThreshold?: number;
 a11y_wcag_level?: string;
 a11y_fail_on_any?: boolean;
 a11y_fail_on_critical?: boolean;
 a11y_threshold?: number;
}

interface TestStepsTabProps {
 test: TestType | null;
 hasReorderedSteps: boolean;
 isSavingStepOrder: boolean;
 draggedStepIndex: number | null;
 dragOverIndex: number | null;
 onSaveStepOrder: () => void;
 onStepDragStart: (e: React.DragEvent, index: number) => void;
 onStepDragEnd: (e: React.DragEvent) => void;
 onStepDragOver: (e: React.DragEvent, index: number) => void;
 onStepDrop: (e: React.DragEvent, index: number) => void;
}

// Visual Test Configuration Display
function VisualTestConfig({ test }: { test: TestType }) {
 return (
 <div className="mt-4 space-y-4">
 <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-4">
 <div className="flex items-center gap-2 mb-3">
 <span className="text-xl">📸</span>
 <h4 className="font-medium text-foreground">Visual Test Configuration</h4>
 </div>
 <p className="text-sm text-muted-foreground mb-4">
 Visual regression tests work by capturing screenshots and comparing them against baselines. No test steps required.
 </p>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {test?.target_url && (
 <div className="bg-card rounded p-3 border border-border">
 <dt className="text-xs font-medium text-muted-foreground mb-1">Target URL</dt>
 <dd className="text-sm text-foreground break-all">
 <a href={test.target_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
 {test.target_url}
 </a>
 </dd>
 </div>
 )}
 <div className="bg-card rounded p-3 border border-border">
 <dt className="text-xs font-medium text-muted-foreground mb-1">Viewport</dt>
 <dd className="text-sm text-foreground">
 {test?.multi_viewport && test?.viewports?.length > 0 ? (
 <span>Multi-viewport: {test.viewports.map((vp: string | { name: string; width: number; height: number }) =>
 typeof vp === 'object' ? vp.name : vp
 ).join(', ')}</span>
 ) : test?.viewport_preset && test.viewport_preset !== 'custom' ? (
 <span className="capitalize">{test.viewport_preset} ({test.viewport_width || 1280}×{test.viewport_height || 720})</span>
 ) : (
 <span>{test?.viewport_width || 1280}×{test?.viewport_height || 720}</span>
 )}
 </dd>
 </div>
 <div className="bg-card rounded p-3 border border-border">
 <dt className="text-xs font-medium text-muted-foreground mb-1">Capture Mode</dt>
 <dd className="text-sm text-foreground capitalize">
 {(test?.capture_mode || 'full_page').replace('_', ' ')}
 </dd>
 </div>
 <div className="bg-card rounded p-3 border border-border">
 <dt className="text-xs font-medium text-muted-foreground mb-1">Diff Threshold</dt>
 <dd className="text-sm text-foreground">
 {(test?.diff_threshold_mode ?? 'percentage') === 'pixel_count'
 ? ((test?.diff_pixel_threshold ?? 0) === 0 ? 'Exact match (0 pixels)' : `${test?.diff_pixel_threshold} pixel tolerance`)
 : ((test?.diff_threshold ?? 0) === 0 ? 'Exact match (0%)' : `${test?.diff_threshold}% tolerance`)
 }
 </dd>
 </div>
 </div>
 </div>
 </div>
 );
}

// Lighthouse Test Configuration Display
function LighthouseTestConfig({ test }: { test: TestType }) {
 return (
 <div className="mt-4 space-y-4">
 <div className="rounded-lg border border-warning/20 bg-warning/5/50 p-4">
 <div className="flex items-center gap-2 mb-3">
 <span className="text-xl">⚡</span>
 <h4 className="font-medium text-foreground">Performance Test Configuration</h4>
 </div>
 <p className="text-sm text-muted-foreground mb-4">
 Lighthouse performance tests analyze page load metrics. No test steps required.
 </p>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="bg-card rounded p-3 border border-border">
 <dt className="text-xs font-medium text-muted-foreground mb-1">Device Preset</dt>
 <dd className="text-sm text-foreground capitalize">{test?.device_preset || 'mobile'}</dd>
 </div>
 <div className="bg-card rounded p-3 border border-border">
 <dt className="text-xs font-medium text-muted-foreground mb-1">Performance Threshold</dt>
 <dd className="text-sm text-foreground">{test?.performance_threshold || 0}% minimum score</dd>
 </div>
 </div>
 </div>
 </div>
 );
}

// Accessibility Test Configuration Display
function AccessibilityTestConfig({ test }: { test: TestType }) {
 return (
 <div className="mt-4 space-y-4">
 <div className="rounded-lg border border-success/20 bg-success/5/50 p-4">
 <div className="flex items-center gap-2 mb-3">
 <span className="text-xl">♿</span>
 <h4 className="font-medium text-foreground">Accessibility Test Configuration</h4>
 </div>
 <p className="text-sm text-muted-foreground mb-4">
 Accessibility tests scan pages for WCAG violations. No test steps required.
 </p>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="bg-card rounded p-3 border border-border">
 <dt className="text-xs font-medium text-muted-foreground mb-1">WCAG Level</dt>
 <dd className="text-sm text-foreground">{test?.wcag_level || 'AA'}</dd>
 </div>
 <div className="bg-card rounded p-3 border border-border">
 <dt className="text-xs font-medium text-muted-foreground mb-1">Include Best Practices</dt>
 <dd className="text-sm text-foreground">{test?.include_best_practices ? 'Yes' : 'No'}</dd>
 </div>
 </div>
 </div>
 </div>
 );
}

// Step Item Component
function StepItem({
 step,
 index,
 draggedStepIndex,
 dragOverIndex,
 onDragStart,
 onDragEnd,
 onDragOver,
 onDrop,
}: {
 step: TestStep;
 index: number;
 draggedStepIndex: number | null;
 dragOverIndex: number | null;
 onDragStart: (e: React.DragEvent, index: number) => void;
 onDragEnd: (e: React.DragEvent) => void;
 onDragOver: (e: React.DragEvent, index: number) => void;
 onDrop: (e: React.DragEvent, index: number) => void;
}) {
 return (
 <li
 draggable
 onDragStart={(e) => onDragStart(e, index)}
 onDragEnd={onDragEnd}
 onDragOver={(e) => onDragOver(e, index)}
 onDrop={(e) => onDrop(e, index)}
 className={`flex gap-3 rounded-md bg-muted/30 p-3 cursor-move transition-all ${
 dragOverIndex === index && draggedStepIndex !== index
 ? 'border-2 border-primary border-dashed bg-primary/10'
 : 'border-2 border-transparent'
 } ${draggedStepIndex === index ? 'opacity-50' : ''}`}
 >
 {/* Drag handle */}
 <span className="flex items-center text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing">
 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
 <circle cx="9" cy="6" r="1.5"/>
 <circle cx="15" cy="6" r="1.5"/>
 <circle cx="9" cy="12" r="1.5"/>
 <circle cx="15" cy="12" r="1.5"/>
 <circle cx="9" cy="18" r="1.5"/>
 <circle cx="15" cy="18" r="1.5"/>
 </svg>
 </span>
 <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
 {index + 1}
 </span>
 <div className="flex-1">
 <p className="font-medium text-foreground">
 {step.action === 'visual_checkpoint' ? (
 <span className="flex items-center gap-1">
 <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
 </svg>
 Visual Checkpoint
 </span>
 ) : step.action === 'accessibility_check' ? (
 <span className="flex items-center gap-1">
 <svg className="h-4 w-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
 </svg>
 Accessibility Check
 </span>
 ) : step.action}
 </p>
 {step.selector && (
 <p className="text-xs text-muted-foreground">Selector: {step.selector}</p>
 )}
 {step.value && (
 <p className="text-xs text-muted-foreground">Value: {step.value}</p>
 )}
 {step.action === 'visual_checkpoint' && (
 <div className="flex gap-2 mt-1">
 <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
 {step.checkpointName || 'unnamed'}
 </span>
 <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-warning/10 text-warning">
 Threshold: {step.checkpointThreshold ?? 0.1}%
 </span>
 </div>
 )}
 {step.action === 'accessibility_check' && (
 <div className="flex flex-wrap gap-2 mt-1">
 <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
 WCAG {step.a11y_wcag_level || 'AA'}
 </span>
 {step.a11y_fail_on_any && (
 <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-destructive/10 text-destructive">
 Fail on any
 </span>
 )}
 {step.a11y_fail_on_critical && !step.a11y_fail_on_any && (
 <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
 Critical/Serious only
 </span>
 )}
 <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-warning/10 text-warning">
 Threshold: {step.a11y_threshold ?? 0}
 </span>
 </div>
 )}
 </div>
 </li>
 );
}

export function TestStepsTab({
 test,
 hasReorderedSteps,
 isSavingStepOrder,
 draggedStepIndex,
 dragOverIndex,
 onSaveStepOrder,
 onStepDragStart,
 onStepDragEnd,
 onStepDragOver,
 onStepDrop,
}: TestStepsTabProps) {
 // Visual tests don't need steps - show config instead
 if (test?.test_type === 'visual_regression') {
 return <VisualTestConfig test={test} />;
 }

 if (test?.test_type === 'lighthouse') {
 return <LighthouseTestConfig test={test} />;
 }

 if (test?.test_type === 'accessibility') {
 return <AccessibilityTestConfig test={test} />;
 }

 // No steps defined yet
 if (!test?.steps || test.steps.length === 0) {
 return (
 <p className="mt-4 text-muted-foreground">No steps defined yet. Add steps to run the test.</p>
 );
 }

 // E2E test with steps
 return (
 <>
 {hasReorderedSteps && (
 <div className="mt-4 flex items-center gap-2 rounded-md bg-warning/10 p-3 border border-warning/30">
 <span className="text-warning text-sm">Steps have been reordered. Save to persist changes.</span>
 <button
 onClick={onSaveStepOrder}
 disabled={isSavingStepOrder}
 className="ml-auto rounded-md bg-warning px-3 py-1 text-sm font-medium text-white hover:bg-warning disabled:opacity-50"
 >
 {isSavingStepOrder ? 'Saving...' : 'Save Order'}
 </button>
 </div>
 )}
 <ol className="mt-4 space-y-2">
 {test.steps.map((step: TestStep, index: number) => (
 <StepItem
 key={step.id}
 step={step}
 index={index}
 draggedStepIndex={draggedStepIndex}
 dragOverIndex={dragOverIndex}
 onDragStart={onStepDragStart}
 onDragEnd={onStepDragEnd}
 onDragOver={onStepDragOver}
 onDrop={onStepDrop}
 />
 ))}
 </ol>
 </>
 );
}
