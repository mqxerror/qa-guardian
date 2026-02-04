/**
 * SeverityBadge Component
 * Feature #49: Extracted from ProjectDetailPage.tsx
 * Displays severity/risk levels for SAST and DAST findings
 */

import React from 'react';
import { getSASTSeverityClass, getDASTRiskClass, getScanStatusClass, getScanStatusIcon } from './utils';
import type { SASTSeverity, DASTRisk } from './types';

interface SASTSeverityBadgeProps {
  severity: SASTSeverity;
  showIcon?: boolean;
}

export const SASTSeverityBadge: React.FC<SASTSeverityBadgeProps> = React.memo(({
  severity,
  showIcon = false,
}) => {
  const getIcon = () => {
    switch (severity) {
      case 'CRITICAL': return '🔴';
      case 'HIGH': return '🟠';
      case 'MEDIUM': return '🟡';
      case 'LOW': return '🔵';
      default: return '';
    }
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${getSASTSeverityClass(severity)}`}>
      {showIcon && <span>{getIcon()}</span>}
      {severity}
    </span>
  );
});

SASTSeverityBadge.displayName = 'SASTSeverityBadge';

interface DASTRiskBadgeProps {
  risk: DASTRisk;
  showIcon?: boolean;
}

export const DASTRiskBadge: React.FC<DASTRiskBadgeProps> = React.memo(({
  risk,
  showIcon = false,
}) => {
  const getIcon = () => {
    switch (risk) {
      case 'High': return '🔴';
      case 'Medium': return '🟠';
      case 'Low': return '🟡';
      case 'Informational': return '🔵';
      default: return '';
    }
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${getDASTRiskClass(risk)}`}>
      {showIcon && <span>{getIcon()}</span>}
      {risk}
    </span>
  );
});

DASTRiskBadge.displayName = 'DASTRiskBadge';

interface ScanStatusBadgeProps {
  status: 'pending' | 'running' | 'completed' | 'failed';
  showIcon?: boolean;
}

export const ScanStatusBadge: React.FC<ScanStatusBadgeProps> = React.memo(({
  status,
  showIcon = true,
}) => {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${getScanStatusClass(status)}`}>
      {showIcon && <span>{getScanStatusIcon(status)}</span>}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
});

ScanStatusBadge.displayName = 'ScanStatusBadge';

interface MemberRoleBadgeProps {
  role: 'developer' | 'viewer';
}

export const MemberRoleBadge: React.FC<MemberRoleBadgeProps> = React.memo(({ role }) => {
  const badgeClass = role === 'developer'
    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
    : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${badgeClass}`}>
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  );
});

MemberRoleBadge.displayName = 'MemberRoleBadge';

export default SASTSeverityBadge;
