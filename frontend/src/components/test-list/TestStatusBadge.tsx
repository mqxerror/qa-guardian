/**
 * Test Status Badge Component
 * Feature #1787: Extract test list components from TestSuitePage
 */

import { TestStatusBadgeProps } from './types';

const statusStyles = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  draft: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  disabled: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300',
  archived: 'bg-gray-100 text-gray-500 dark:bg-gray-900/30 dark:text-gray-400',
};

export function TestStatusBadge({ status, size = 'sm' }: TestStatusBadgeProps) {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';

  return (
    <span className={`rounded-full font-medium ${sizeClasses} ${statusStyles[status]}`}>
      {status}
    </span>
  );
}

export default TestStatusBadge;
