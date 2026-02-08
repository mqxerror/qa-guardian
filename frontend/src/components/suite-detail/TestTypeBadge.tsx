/**
 * TestTypeBadge Component
 * Feature #50: Extracted from TestSuitePage.tsx
 * Displays test type badges with icons
 */

import React from 'react';
import { getTestTypeIcon, getTestTypeLabel, getTestStatusClass, getTestStatusIcon, getConfidenceClass, formatConfidence } from './utils';
import type { TestTypeEnum, TestStatus } from './types';

interface TestTypeBadgeProps {
 type: TestTypeEnum;
 showIcon?: boolean;
 size?: 'sm' | 'md' | 'lg';
}

export const TestTypeBadge: React.FC<TestTypeBadgeProps> = React.memo(({
 type,
 showIcon = true,
 size = 'sm',
}) => {
 const sizeClasses = {
 sm: 'px-2 py-0.5 text-xs',
 md: 'px-2.5 py-1 text-sm',
 lg: 'px-3 py-1.5 text-base',
 };

 const typeColors: Record<TestTypeEnum, string> = {
 e2e: 'bg-primary/10 text-primary',
 visual_regression: 'bg-accent/10 text-accent',
 lighthouse: 'bg-warning/10 text-warning',
 load: 'bg-warning/10 text-warning',
 accessibility: 'bg-success/10 text-success',
 api: 'bg-accent/10 text-accent',
 };

 return (
 <span className={`inline-flex items-center gap-1 font-medium rounded-full ${sizeClasses[size]} ${typeColors[type] || 'bg-muted text-foreground'}`}>
 {showIcon && <span>{getTestTypeIcon(type)}</span>}
 {getTestTypeLabel(type)}
 </span>
 );
});

TestTypeBadge.displayName = 'TestTypeBadge';

interface TestStatusBadgeProps {
 status: TestStatus | string | null;
 showIcon?: boolean;
 size?: 'sm' | 'md' | 'lg';
}

export const TestStatusBadge: React.FC<TestStatusBadgeProps> = React.memo(({
 status,
 showIcon = true,
 size = 'sm',
}) => {
 const sizeClasses = {
 sm: 'px-2 py-0.5 text-xs',
 md: 'px-2.5 py-1 text-sm',
 lg: 'px-3 py-1.5 text-base',
 };

 const displayStatus = status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';

 return (
 <span className={`inline-flex items-center gap-1 font-medium rounded-full ${sizeClasses[size]} ${getTestStatusClass(status)}`}>
 {showIcon && <span>{getTestStatusIcon(status)}</span>}
 {displayStatus}
 </span>
 );
});

TestStatusBadge.displayName = 'TestStatusBadge';

interface AIConfidenceBadgeProps {
 confidence: number | undefined;
 showLabel?: boolean;
 size?: 'sm' | 'md' | 'lg';
}

export const AIConfidenceBadge: React.FC<AIConfidenceBadgeProps> = React.memo(({
 confidence,
 showLabel = true,
 size = 'sm',
}) => {
 if (confidence === undefined) return null;

 const sizeClasses = {
 sm: 'px-2 py-0.5 text-xs',
 md: 'px-2.5 py-1 text-sm',
 lg: 'px-3 py-1.5 text-base',
 };

 return (
 <span className={`inline-flex items-center gap-1 font-medium rounded-full ${sizeClasses[size]} ${getConfidenceClass(confidence)}`}>
 <span>🤖</span>
 {showLabel && 'AI '}
 {formatConfidence(confidence)}
 </span>
 );
});

AIConfidenceBadge.displayName = 'AIConfidenceBadge';

interface ReviewStatusBadgeProps {
 status: 'pending' | 'approved' | 'rejected' | 'pending_review';
 size?: 'sm' | 'md' | 'lg';
}

export const ReviewStatusBadge: React.FC<ReviewStatusBadgeProps> = React.memo(({
 status,
 size = 'sm',
}) => {
 const sizeClasses = {
 sm: 'px-2 py-0.5 text-xs',
 md: 'px-2.5 py-1 text-sm',
 lg: 'px-3 py-1.5 text-base',
 };

 const statusConfig = {
 pending: { icon: '⏳', label: 'Pending', class: 'bg-warning/10 text-warning' },
 pending_review: { icon: '👀', label: 'Needs Review', class: 'bg-warning/10 text-warning' },
 approved: { icon: '✓', label: 'Approved', class: 'bg-success/10 text-success' },
 rejected: { icon: '✗', label: 'Rejected', class: 'bg-destructive/10 text-destructive' },
 };

 const config = statusConfig[status] || statusConfig.pending;

 return (
 <span className={`inline-flex items-center gap-1 font-medium rounded-full ${sizeClasses[size]} ${config.class}`}>
 <span>{config.icon}</span>
 {config.label}
 </span>
 );
});

ReviewStatusBadge.displayName = 'ReviewStatusBadge';

export default TestTypeBadge;
