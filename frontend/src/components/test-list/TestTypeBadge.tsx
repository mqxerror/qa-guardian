/**
 * Test Type Badge Component
 * Feature #1787: Extract test list components from TestSuitePage
 */

import { TestTypeBadgeProps } from './types';

const typeConfig = {
  e2e: {
    icon: '🧪',
    label: 'E2E Test',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  },
  visual_regression: {
    icon: '📸',
    label: 'Visual Regression Test',
    className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  },
  lighthouse: {
    icon: '🏠',
    label: 'Performance Test',
    className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  },
  load: {
    icon: '⚡',
    label: 'Load Test',
    className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  },
  accessibility: {
    icon: '♿',
    label: 'Accessibility Test',
    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  },
};

export function TestTypeBadge({ testType }: TestTypeBadgeProps) {
  const config = typeConfig[testType] || typeConfig.e2e;

  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${config.className}`}
      title={config.label}
    >
      {config.icon}
    </span>
  );
}

export default TestTypeBadge;
