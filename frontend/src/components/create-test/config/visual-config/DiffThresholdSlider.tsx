// Feature #104: Split VisualConfig.tsx into logical modules
// Diff threshold slider component extracted from VisualConfig.tsx

import React from 'react';
import { FormField } from './FormField';

interface DiffThresholdSliderProps {
 value: number;
 onChange: (value: number) => void;
}

/**
 * Get strictness info based on threshold value
 */
function getStrictnessInfo(threshold: number): { icon: string; label: string; description: string; colorClass: string } {
 if (threshold <= 0.01) {
 return {
 icon: '🔒',
 label: 'Pixel Perfect',
 description: 'Catches every minor change. Best for static content with no animations.',
 colorClass: 'text-destructive',
 };
 }
 if (threshold <= 0.05) {
 return {
 icon: '🎯',
 label: 'Very Strict',
 description: 'Catches most changes while allowing minor anti-aliasing differences.',
 colorClass: 'text-warning',
 };
 }
 if (threshold <= 0.1) {
 return {
 icon: '✅',
 label: 'Balanced (Recommended)',
 description: 'Good balance between catching real issues and ignoring rendering differences.',
 colorClass: 'text-success',
 };
 }
 if (threshold <= 0.2) {
 return {
 icon: '⚡',
 label: 'Lenient',
 description: 'More forgiving. Good for pages with subtle animations or dynamic content.',
 colorClass: 'text-primary',
 };
 }
 return {
 icon: '🔓',
 label: 'Very Lenient',
 description: 'Only catches major visual changes. Use for highly dynamic pages.',
 colorClass: 'text-foreground',
 };
}

/**
 * Diff threshold slider with strictness preview
 * Feature #1964: Enhanced with strictness preview
 */
export const DiffThresholdSlider: React.FC<DiffThresholdSliderProps> = ({
 value,
 onChange,
}) => {
 const strictness = getStrictnessInfo(value);

 return (
 <FormField
 label={`Diff Threshold: ${Math.round(value * 100)}%`}
 hint="Maximum allowed visual difference before test fails"
 >
 <div className="flex items-center gap-4">
 <input
 type="range"
 value={value * 100}
 onChange={(e) => onChange(parseInt(e.target.value) / 100)}
 min={0}
 max={100}
 step={1}
 className="flex-1 h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-accent"
 />
 <span className="w-12 text-right text-sm font-medium text-foreground">
 {Math.round(value * 100)}%
 </span>
 </div>
 <div className="flex justify-between text-xs text-muted-foreground mt-1">
 <span>Strict</span>
 <span>Lenient</span>
 </div>
 {/* Feature #1964: Strictness Preview */}
 <div className="mt-3 p-3 rounded-lg border border-border bg-muted">
 <div className="flex items-center gap-2 mb-2">
 <span className="text-lg">{strictness.icon}</span>
 <span className={`text-sm font-medium ${strictness.colorClass}`}>
 {strictness.label}
 </span>
 </div>
 <p className="text-xs text-muted-foreground">
 {strictness.description}
 </p>
 </div>
 </FormField>
 );
};

export default DiffThresholdSlider;
