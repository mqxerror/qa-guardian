/**
 * Quick Test Badge Components
 * Feature #514: Extracted from QuickTestPage.tsx
 * Feature #521: Consolidated as thin wrappers around unified Badge component
 * Standardized opacity to /15 via unified Badge system
 */

import {
  Eye,
  BarChart2,
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import type { SourceType, PriorityType, ImpactType } from '../ui/Badge';

/**
 * Badge showing whether data came from vision AI or metrics
 */
export function SourceBadge({ source }: { source?: 'vision' | 'metrics' }) {
  const value: SourceType = source === 'vision' ? 'vision' : 'metrics';
  return (
    <Badge variant="source" value={value} size="xs" shape="rounded"
      icon={source === 'vision' ? <Eye className="w-3 h-3" /> : <BarChart2 className="w-3 h-3" />}
    >
      {source === 'vision' ? 'Vision' : 'Metrics'}
    </Badge>
  );
}

/**
 * Badge showing test priority level
 */
export function PriorityBadge({ priority }: { priority: string }) {
  const validPriorities = ['critical', 'high', 'medium', 'low'];
  const value = validPriorities.includes(priority) ? priority as PriorityType : 'medium' as PriorityType;
  return (
    <Badge variant="priority" value={value} size="xs" shape="rounded">
      {priority}
    </Badge>
  );
}

/**
 * Badge showing issue severity level
 * Handles both accessibility severity (critical/serious/moderate/minor) and
 * general severity (high/medium/low) by mapping to impact variant
 */
export function SeverityBadge({ severity }: { severity: string }) {
  const severityMap: Record<string, ImpactType> = {
    critical: 'critical',
    serious: 'serious',
    high: 'critical',
    moderate: 'moderate',
    medium: 'moderate',
    minor: 'minor',
    low: 'minor',
  };
  const value = severityMap[severity.toLowerCase()] || 'moderate';
  return (
    <Badge variant="impact" value={value} size="xs" shape="rounded">
      {severity}
    </Badge>
  );
}

/**
 * Badge showing accessibility impact level
 */
export function ImpactBadge({ impact }: { impact: string }) {
  const validImpacts = ['critical', 'serious', 'moderate', 'minor'];
  const value = validImpacts.includes(impact.toLowerCase()) ? impact.toLowerCase() as ImpactType : 'moderate' as ImpactType;
  return (
    <Badge variant="impact" value={value} size="xs" shape="rounded">
      {impact}
    </Badge>
  );
}
