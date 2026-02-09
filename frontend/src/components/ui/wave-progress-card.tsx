/**
 * Feature #523: WaveProgressCard Component
 * A reusable progress card with status borders, icon, expand/collapse, step tracking.
 *
 * Usage:
 * ```tsx
 * <WaveProgressCard
 *   status="running"
 *   icon={Globe}
 *   title="Health Check"
 *   subtitle="In progress..."
 *   expanded={isExpanded}
 *   onToggle={() => setExpanded(!isExpanded)}
 *   steps={[
 *     { name: 'DNS Resolution', status: 'completed' },
 *     { name: 'HTTP Request', status: 'running' },
 *   ]}
 * >
 *   Optional extra content when expanded
 * </WaveProgressCard>
 * ```
 */

import { memo, type ReactNode, type ElementType } from 'react';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

export type WaveProgressStatus = 'waiting' | 'running' | 'completed' | 'failed' | 'skipped';

export type StepStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface WaveProgressStep {
  /** Display name for this step */
  name: string;
  /** Current status of this step */
  status: StepStatus;
  /** Optional duration in ms */
  duration?: number;
}

export interface WaveProgressCardProps {
  /** Overall status of this wave/card */
  status: WaveProgressStatus;
  /** Icon component to display (Lucide icon or any React component) */
  icon: ElementType;
  /** Main title */
  title: string;
  /** Optional subtitle (if not provided, uses status-based default) */
  subtitle?: string;
  /** Duration in ms (shown when completed) */
  duration?: number;
  /** Whether the card is expanded */
  expanded: boolean;
  /** Toggle expand/collapse callback */
  onToggle: () => void;
  /** Steps to display when expanded */
  steps?: WaveProgressStep[];
  /** Enable animate-pulse effect for running state (default: true) */
  animate?: boolean;
  /** Additional children rendered at the bottom of expanded content */
  children?: ReactNode;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get border and background classes based on status
 */
function getStatusStyles(status: WaveProgressStatus, animate: boolean): string {
  const baseClasses = 'border-2 transition-all duration-300';
  const animatePulse = animate ? ' animate-pulse' : '';

  switch (status) {
    case 'waiting':
      return `${baseClasses} border-muted bg-muted/10`;
    case 'running':
      return `${baseClasses} border-primary bg-primary/10${animatePulse}`;
    case 'completed':
      return `${baseClasses} border-success bg-success/10`;
    case 'failed':
      return `${baseClasses} border-destructive bg-destructive/10`;
    case 'skipped':
      return `${baseClasses} border-warning bg-warning/10`;
    default:
      return `${baseClasses} border-muted bg-muted/10`;
  }
}

/**
 * Get the status icon component
 */
function StatusIcon({ status }: { status: WaveProgressStatus }) {
  switch (status) {
    case 'waiting':
      return <Clock className="w-4 h-4 text-muted-foreground" />;
    case 'running':
      return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
    case 'completed':
      return <CheckCircle2 className="w-4 h-4 text-success" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-destructive" />;
    case 'skipped':
      return <AlertTriangle className="w-4 h-4 text-warning" />;
    default:
      return null;
  }
}

/**
 * Get the step status icon component
 */
function StepStatusIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case 'pending':
      return <Clock className="w-3.5 h-3.5 text-muted-foreground" />;
    case 'running':
      return <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />;
    case 'completed':
      return <CheckCircle2 className="w-3.5 h-3.5 text-success" />;
    case 'failed':
      return <XCircle className="w-3.5 h-3.5 text-destructive" />;
    default:
      return <Clock className="w-3.5 h-3.5 text-muted-foreground" />;
  }
}

/**
 * Get default subtitle based on status
 */
function getDefaultSubtitle(status: WaveProgressStatus, duration?: number): string {
  switch (status) {
    case 'waiting':
      return 'Waiting...';
    case 'running':
      return 'In progress...';
    case 'completed':
      return duration !== undefined ? `Completed in ${duration}ms` : 'Completed';
    case 'failed':
      return 'Failed';
    case 'skipped':
      return 'Skipped';
    default:
      return '';
  }
}

// =============================================================================
// COMPONENT
// =============================================================================

export const WaveProgressCard = memo(function WaveProgressCard({
  status,
  icon: Icon,
  title,
  subtitle,
  duration,
  expanded,
  onToggle,
  steps,
  animate = true,
  children,
  className = '',
}: WaveProgressCardProps) {
  const displaySubtitle = subtitle || getDefaultSubtitle(status, duration);
  const isRunning = status === 'running';

  return (
    <div className={`rounded-lg ${getStatusStyles(status, animate)} ${className}`}>
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between text-left"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isRunning ? 'bg-primary/20' : 'bg-muted'}`}>
            <Icon className={`w-5 h-5 ${isRunning ? 'text-primary' : 'text-muted-foreground'}`} />
          </div>
          <div>
            <h3 className="font-medium text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground">{displaySubtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusIcon status={status} />
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-2">
          {/* Step Progress List */}
          {steps && steps.length > 0 && (
            <>
              {steps.map((step, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between py-1.5 px-2 rounded bg-background/50"
                >
                  <span className="text-sm text-foreground">{step.name}</span>
                  <div className="flex items-center gap-2">
                    {step.duration !== undefined && (
                      <span className="text-xs text-muted-foreground">{step.duration}ms</span>
                    )}
                    <StepStatusIcon status={step.status} />
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Additional children content */}
          {children}
        </div>
      )}
    </div>
  );
});

export default WaveProgressCard;
