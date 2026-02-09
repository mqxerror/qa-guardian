/**
 * Quick Test Badge Components
 * Feature #514: Extracted from QuickTestPage.tsx
 * Small badge components for displaying status, priority, severity, etc.
 */

import {
  Eye,
  BarChart2,
} from 'lucide-react';

/**
 * Badge showing whether data came from vision AI or metrics
 */
export function SourceBadge({ source }: { source?: 'vision' | 'metrics' }) {
  if (source === 'vision') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-purple-500/20 text-purple-400">
        <Eye className="w-3 h-3" />
        Vision
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-info/20 text-info">
      <BarChart2 className="w-3 h-3" />
      Metrics
    </span>
  );
}

/**
 * Badge showing test priority level
 */
export function PriorityBadge({ priority }: { priority: string }) {
  const colors = {
    critical: 'bg-destructive/20 text-destructive',
    high: 'bg-warning/20 text-warning',
    medium: 'bg-info/20 text-info',
    low: 'bg-muted text-muted-foreground',
  };
  return (
    <span className={`px-1.5 py-0.5 rounded text-xs ${colors[priority as keyof typeof colors] || colors.medium}`}>
      {priority}
    </span>
  );
}

/**
 * Badge showing issue severity level
 */
export function SeverityBadge({ severity }: { severity: string }) {
  const colors = {
    critical: 'bg-destructive/20 text-destructive',
    serious: 'bg-warning/20 text-warning',
    moderate: 'bg-info/20 text-info',
    minor: 'bg-muted text-muted-foreground',
    // Also handle non-a11y severity levels
    high: 'bg-destructive/20 text-destructive',
    medium: 'bg-warning/20 text-warning',
    low: 'bg-info/20 text-info',
  };
  return (
    <span className={`px-1.5 py-0.5 rounded text-xs ${colors[severity.toLowerCase() as keyof typeof colors] || colors.medium}`}>
      {severity}
    </span>
  );
}

/**
 * Badge showing accessibility impact level
 */
export function ImpactBadge({ impact }: { impact: string }) {
  const colors = {
    critical: 'bg-destructive/20 text-destructive',
    serious: 'bg-warning/20 text-warning',
    moderate: 'bg-info/20 text-info',
    minor: 'bg-muted text-muted-foreground',
  };
  return (
    <span className={`px-1.5 py-0.5 rounded text-xs ${colors[impact.toLowerCase() as keyof typeof colors] || colors.moderate}`}>
      {impact}
    </span>
  );
}
