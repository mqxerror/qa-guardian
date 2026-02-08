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
 className: 'bg-blue-100 text-blue-700',
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
 className: 'bg-yellow-100 text-yellow-700',
 },
 accessibility: {
 icon: '♿',
 label: 'Accessibility Test',
 className: 'bg-green-100 text-green-700',
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
