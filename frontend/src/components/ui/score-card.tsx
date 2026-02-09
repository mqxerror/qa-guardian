/**
 * Feature #522: ScoreCard Component
 * Extracted from QuickTestPage.tsx for reuse across the application.
 *
 * A score display card with color-coded thresholds.
 *
 * Usage:
 * ```tsx
 * <ScoreCard score={85} label="Health" />
 * <ScoreCard score={45} label="Security" thresholds={{ good: 70, warning: 50 }} />
 * <ScoreCard score={100} label="Performance" size="lg" showIcon />
 * ```
 */

import { memo } from 'react';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

export type ScoreCardSize = 'sm' | 'md' | 'lg';

export interface ScoreThresholds {
  /** Score >= this value is green/success (default: 80) */
  good: number;
  /** Score >= this value but < good is yellow/warning (default: 60) */
  warning: number;
  /** Score < warning is red/destructive */
}

export interface ScoreCardProps {
  /** The score value (0-100 typically) */
  score: number;
  /** Label displayed below the score */
  label: string;
  /** Maximum score for percentage calculations (default: 100) */
  maxScore?: number;
  /** Custom thresholds for color coding */
  thresholds?: ScoreThresholds;
  /** Size variant */
  size?: ScoreCardSize;
  /** Show status icon */
  showIcon?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_THRESHOLDS: ScoreThresholds = {
  good: 80,
  warning: 60,
};

const sizeClasses: Record<ScoreCardSize, { container: string; score: string; label: string; icon: string }> = {
  sm: {
    container: 'p-3',
    score: 'text-xl font-bold',
    label: 'text-xs mt-0.5',
    icon: 'w-3 h-3',
  },
  md: {
    container: 'p-4',
    score: 'text-3xl font-bold',
    label: 'text-sm mt-1',
    icon: 'w-4 h-4',
  },
  lg: {
    container: 'p-6',
    score: 'text-4xl font-bold',
    label: 'text-base mt-2',
    icon: 'w-5 h-5',
  },
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get the status level based on score and thresholds
 */
function getScoreStatus(score: number, thresholds: ScoreThresholds): 'good' | 'warning' | 'bad' {
  if (score >= thresholds.good) return 'good';
  if (score >= thresholds.warning) return 'warning';
  return 'bad';
}

/**
 * Get text color class based on score and thresholds
 */
export function getScoreTextColor(score: number, thresholds: ScoreThresholds = DEFAULT_THRESHOLDS): string {
  const status = getScoreStatus(score, thresholds);
  switch (status) {
    case 'good': return 'text-success';
    case 'warning': return 'text-warning';
    case 'bad': return 'text-destructive';
  }
}

/**
 * Get background color class based on score and thresholds
 */
export function getScoreBgColor(score: number, thresholds: ScoreThresholds = DEFAULT_THRESHOLDS): string {
  const status = getScoreStatus(score, thresholds);
  switch (status) {
    case 'good': return 'bg-success/20';
    case 'warning': return 'bg-warning/20';
    case 'bad': return 'bg-destructive/20';
  }
}

/**
 * Get the appropriate icon component based on score
 */
function getScoreIcon(score: number, thresholds: ScoreThresholds, iconClass: string) {
  const status = getScoreStatus(score, thresholds);
  switch (status) {
    case 'good': return <CheckCircle2 className={`${iconClass} text-success`} />;
    case 'warning': return <AlertTriangle className={`${iconClass} text-warning`} />;
    case 'bad': return <XCircle className={`${iconClass} text-destructive`} />;
  }
}

// =============================================================================
// COMPONENT
// =============================================================================

export const ScoreCard = memo(function ScoreCard({
  score,
  label,
  maxScore = 100,
  thresholds = DEFAULT_THRESHOLDS,
  size = 'md',
  showIcon = false,
  className = '',
}: ScoreCardProps) {
  const classes = sizeClasses[size];
  const textColor = getScoreTextColor(score, thresholds);
  const bgColor = getScoreBgColor(score, thresholds);

  // Format score display (show percentage if maxScore != 100)
  const displayScore = maxScore === 100 ? score : `${Math.round((score / maxScore) * 100)}`;

  return (
    <div
      className={`rounded-lg ${bgColor} text-center ${classes.container} ${className}`}
    >
      <div className="flex items-center justify-center gap-2">
        <span className={`${classes.score} ${textColor}`}>
          {displayScore}
        </span>
        {showIcon && getScoreIcon(score, thresholds, classes.icon)}
      </div>
      <div className={`text-muted-foreground ${classes.label}`}>
        {label}
      </div>
    </div>
  );
});

// =============================================================================
// COMPOUND COMPONENT: ScoreCardGrid
// =============================================================================

export interface ScoreCardGridProps {
  /** Array of score items to display */
  items: Array<{
    score: number;
    label: string;
  }>;
  /** Size for all cards */
  size?: ScoreCardSize;
  /** Custom thresholds for all cards */
  thresholds?: ScoreThresholds;
  /** Show icons on all cards */
  showIcon?: boolean;
  /** Additional CSS classes for the grid container */
  className?: string;
}

/**
 * A grid of score cards, commonly used for displaying multiple metrics
 */
export const ScoreCardGrid = memo(function ScoreCardGrid({
  items,
  size = 'md',
  thresholds,
  showIcon = false,
  className = '',
}: ScoreCardGridProps) {
  const gridCols = items.length <= 2 ? 'grid-cols-2' :
                   items.length === 3 ? 'grid-cols-3' :
                   'grid-cols-2 lg:grid-cols-4';

  return (
    <div className={`grid ${gridCols} gap-4 ${className}`}>
      {items.map((item, idx) => (
        <ScoreCard
          key={idx}
          score={item.score}
          label={item.label}
          size={size}
          thresholds={thresholds}
          showIcon={showIcon}
        />
      ))}
    </div>
  );
});

export default ScoreCard;
