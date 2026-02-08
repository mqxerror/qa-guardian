/**
 * Self-Healing Badge Component
 * Feature #1787: Extract test list components from TestSuitePage
 * Feature #1071: Healing indicator badge
 * Feature #111: Wrapped with React.memo for performance
 */

import { memo } from 'react';
import { HealingBadgeProps } from './types';

const healingStyles = {
 pending: 'bg-warning/10 text-warning',
 applied: 'bg-success/10 text-success',
 rejected: 'bg-destructive/10 text-destructive',
 default: 'bg-primary/10 text-primary',
};

export const HealingBadge = memo(function HealingBadge({ isActive, status, count }: HealingBadgeProps) {
 if (!isActive) return null;

 const styleKey = status || 'default';
 const style = healingStyles[styleKey] || healingStyles.default;
 const displayCount = count || 1;

 return (
 <span
 className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${style}`}
 title={`${displayCount} healed selector${displayCount > 1 ? 's' : ''} (${status || 'pending'})`}
 >
 🔧
 {displayCount > 1 && <span>{displayCount}</span>}
 </span>
 );
});

export default HealingBadge;
