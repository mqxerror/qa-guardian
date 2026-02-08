/**
 * Test Type Badge Component
 * Feature #1787: Extract test list components from TestSuitePage
 * Feature #111: Wrapped with React.memo for performance
 */

import { memo } from 'react';
import { TestTypeBadgeProps } from './types';

const typeConfig = {
 e2e: {
 icon: '🧪',
 label: 'E2E Test',
 className: 'bg-primary/10 text-primary',
 },
 visual_regression: {
 icon: '📸',
 label: 'Visual Regression Test',
 className: 'bg-purple-100 text-purple-700',
 },
 lighthouse: {
 icon: '🏠',
 label: 'Performance Test',
 className: 'bg-orange-100 text-orange-700',
 },
 load: {
 icon: '⚡',
 label: 'Load Test',
 className: 'bg-warning/10 text-warning',
 },
 accessibility: {
 icon: '♿',
 label: 'Accessibility Test',
 className: 'bg-success/10 text-success',
 },
};

export const TestTypeBadge = memo(function TestTypeBadge({ testType }: TestTypeBadgeProps) {
 const config = typeConfig[testType] || typeConfig.e2e;

 return (
 <span
 className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${config.className}`}
 title={config.label}
 >
 {config.icon}
 </span>
 );
});

export default TestTypeBadge;
