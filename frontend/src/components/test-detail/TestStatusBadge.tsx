/**
 * TestStatusBadge Component
 * Feature #48: Extracted from TestDetailPage.tsx
 * Displays test status indicator with appropriate colors
 */

import React from 'react';
import { TestStatus, RunStatus, ResultStatus, StepStatus } from './types';
import { getStatusBadgeClass, getStatusIcon, getStatusLabel } from './utils';

type AllStatus = TestStatus | RunStatus | ResultStatus | StepStatus;

interface TestStatusBadgeProps {
  status: AllStatus | undefined;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const TestStatusBadge: React.FC<TestStatusBadgeProps> = ({
  status,
  showIcon = true,
  size = 'md',
  className = '',
}) => {
  const badgeClass = getStatusBadgeClass(status);
  const icon = showIcon ? getStatusIcon(status) : '';
  const label = getStatusLabel(status);

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${badgeClass} ${sizeClasses[size]} ${className}`}
    >
      {showIcon && <span className="font-bold">{icon}</span>}
      {label}
    </span>
  );
};

export default React.memo(TestStatusBadge);
