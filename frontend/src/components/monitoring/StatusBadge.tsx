/**
 * StatusBadge Component
 * Feature #47: Extracted from MonitoringPage.tsx
 * Displays status indicator with appropriate colors
 */

import React from 'react';
import { CheckStatus, PerformanceStatus } from './types';
import { getStatusBadgeClass, getStatusIcon, getStatusLabel, getPerformanceStatusBadgeClass } from './utils';

interface StatusBadgeProps {
  status: CheckStatus | PerformanceStatus | undefined;
  variant?: 'check' | 'performance';
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  variant = 'check',
  showIcon = true,
  size = 'md',
  className = '',
}) => {
  const isCheckStatus = (s: CheckStatus | PerformanceStatus | undefined): s is CheckStatus => {
    return s === 'up' || s === 'down' || s === 'degraded' || s === 'unknown' || s === undefined;
  };

  const badgeClass = variant === 'check' || isCheckStatus(status)
    ? getStatusBadgeClass(status as CheckStatus)
    : getPerformanceStatusBadgeClass(status as PerformanceStatus);

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  const getLabel = (): string => {
    if (variant === 'check' || isCheckStatus(status)) {
      return getStatusLabel(status as CheckStatus);
    }
    // Performance status labels
    switch (status) {
      case 'good':
        return 'Good';
      case 'needs_improvement':
        return 'Needs Improvement';
      case 'poor':
        return 'Poor';
      default:
        return 'Unknown';
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${badgeClass} ${sizeClasses[size]} ${className}`}
    >
      {showIcon && variant === 'check' && (
        <span className="font-bold">{getStatusIcon(status as CheckStatus)}</span>
      )}
      {getLabel()}
    </span>
  );
};

export default React.memo(StatusBadge);
