/**
 * Test Status Badge Component
 * Feature #1787: Extract test list components from TestSuitePage
 * Feature #111: Wrapped with React.memo for performance
 * Feature #130: Uses centralized color system
 */

import { memo } from 'react';
import { TestStatusBadgeProps } from './types';
import { getStatusColor } from '../../constants/colors';

// Map test status to standard status colors
const statusStyles = {
  active: getStatusColor('passed').badge,
  draft: getStatusColor('pending').badge,
  disabled: getStatusColor('cancelled').badge,
  archived: getStatusColor('skipped').badge,
};

export const TestStatusBadge = memo(function TestStatusBadge({ status, size = 'sm' }: TestStatusBadgeProps) {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';

  return (
    <span className={`rounded-full font-medium ${sizeClasses} ${statusStyles[status]}`}>
      {status}
    </span>
  );
});

export default TestStatusBadge;
