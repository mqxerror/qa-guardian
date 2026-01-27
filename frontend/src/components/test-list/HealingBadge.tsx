/**
 * Self-Healing Badge Component
 * Feature #1787: Extract test list components from TestSuitePage
 * Feature #1071: Healing indicator badge
 */

import { HealingBadgeProps } from './types';

const healingStyles = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  applied: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  default: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
};

export function HealingBadge({ isActive, status, count }: HealingBadgeProps) {
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
}

export default HealingBadge;
