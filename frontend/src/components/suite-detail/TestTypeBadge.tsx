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
 e2e: 'bg-blue-100 text-blue-800',
 visual_regression: 'bg-purple-100 text-purple-800',
 lighthouse: 'bg-yellow-100 text-yellow-800',
 load: 'bg-orange-100 text-orange-800',
 accessibility: 'bg-green-100 text-green-800',
 api: 'bg-indigo-100 text-indigo-800',
 };

 return (
 <span className={`inline-flex items-center gap-1 font-medium rounded-full ${sizeClasses[size]} ${typeColors[type] || 'bg-gray-100 text-gray-800'}`}>
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
 pending: { icon: '⏳', label: 'Pending', class: 'bg-yellow-100 text-yellow-800' },
 pending_review: { icon: '👀', label: 'Needs Review', class: 'bg-orange-100 text-orange-800' },
 approved: { icon: '✓', label: 'Approved', class: 'bg-green-100 text-green-800' },
 rejected: { icon: '✗', label: 'Rejected', class: 'bg-red-100 text-red-800' },
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
