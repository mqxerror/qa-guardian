/**
 * Feature #131: Unified Badge Component
 * Feature #521: Extended with source, priority, and impact variants
 *
 * A flexible badge component that supports multiple variants:
 * - severity: critical, high, medium, low, info
 * - status: passed, failed, running, pending, cancelled, skipped, error
 * - type: e2e, visual, performance, load, accessibility
 * - ai: ai-generated, ai-powered, mcp-ready, healing
 * - source: vision, metrics (for Quick Test data origin)
 * - priority: critical, high, medium, low
 * - impact: critical, serious, moderate, minor (accessibility)
 * - custom: any custom color scheme
 *
 * Usage:
 * ```tsx
 * <Badge variant="severity" value="critical">Critical</Badge>
 * <Badge variant="status" value="passed">Passed</Badge>
 * <Badge variant="type" value="e2e" icon="🧪" />
 * <Badge variant="ai" value="ai-generated">AI Generated</Badge>
 * <Badge variant="source" value="vision">Vision</Badge>
 * <Badge variant="priority" value="high">High</Badge>
 * <Badge variant="impact" value="serious">Serious</Badge>
 * <Badge color="purple">Custom</Badge>
 * ```
 */

import React, { memo } from 'react';
import { Eye, BarChart2 } from 'lucide-react';
import { getSeverityColor, getStatusColor, type SeverityLevel, type StatusType } from '../../constants/colors';

// =============================================================================
// TYPES
// =============================================================================

export type BadgeSize = 'xs' | 'sm' | 'md' | 'lg';
export type BadgeVariant = 'severity' | 'status' | 'type' | 'ai' | 'source' | 'priority' | 'impact' | 'custom';
export type BadgeShape = 'rounded' | 'pill';

// Pre-defined color names for custom variant
export type BadgeColor =
 | 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'indigo' | 'purple' | 'pink'
 | 'gray' | 'teal' | 'emerald' | 'amber';

// Test type values
export type TestType = 'e2e' | 'visual_regression' | 'lighthouse' | 'load' | 'accessibility';

// AI badge types
export type AIBadgeType = 'ai-generated' | 'ai-powered' | 'mcp-ready' | 'ai-ready' | 'healing';

// Source badge types (for Quick Test)
export type SourceType = 'vision' | 'metrics';

// Priority badge types
export type PriorityType = 'critical' | 'high' | 'medium' | 'low';

// Impact badge types (accessibility)
export type ImpactType = 'critical' | 'serious' | 'moderate' | 'minor';

// =============================================================================
// BADGE STYLES
// =============================================================================

const sizeClasses: Record<BadgeSize, string> = {
 xs: 'px-1.5 py-0.5 text-[10px] gap-0.5',
 sm: 'px-2 py-0.5 text-xs gap-1',
 md: 'px-2.5 py-1 text-xs gap-1',
 lg: 'px-3 py-1.5 text-sm gap-1.5',
};

const shapeClasses: Record<BadgeShape, string> = {
 rounded: 'rounded',
 pill: 'rounded-full',
};

// Custom color palettes
// Feature #454: Pink kept as intentional design variant (no semantic equivalent)
// Feature #521: Standardized opacity to /15 across all badges
const colorClasses: Record<BadgeColor, string> = {
 red: 'bg-destructive/15 text-destructive',
 orange: 'bg-warning/15 text-warning',
 yellow: 'bg-warning/15 text-warning',
 green: 'bg-success/15 text-success',
 blue: 'bg-primary/15 text-primary',
 indigo: 'bg-accent/15 text-accent',
 purple: 'bg-method-ai/15 text-method-ai', // Feature #614: Uses method-ai semantic token
 pink: 'bg-method-record/15 text-method-record', // Feature #614: Uses method-record semantic token
 gray: 'bg-muted text-foreground',
 teal: 'bg-info/15 text-info',
 emerald: 'bg-success/15 text-success',
 amber: 'bg-warning/15 text-warning',
};

// Test type configurations
const testTypeConfig: Record<TestType, { icon: string; label: string; color: BadgeColor }> = {
 e2e: { icon: '🧪', label: 'E2E Test', color: 'blue' },
 visual_regression: { icon: '📸', label: 'Visual Regression', color: 'purple' },
 lighthouse: { icon: '🏠', label: 'Performance Test', color: 'orange' },
 load: { icon: '⚡', label: 'Load Test', color: 'yellow' },
 accessibility: { icon: '♿', label: 'Accessibility Test', color: 'green' },
};

// AI badge configurations
// Feature #521: Standardized opacity to /15
const aiBadgeConfig: Record<AIBadgeType, { icon?: string; label: string; className: string }> = {
 'ai-generated': {
 icon: '🤖',
 label: 'AI Generated',
 className: 'bg-accent/15 text-accent',
 },
 'ai-powered': {
 icon: undefined,
 label: 'AI Powered',
 className: 'bg-gradient-to-r from-accent/15 to-primary/15 border border-accent/30 text-accent',
 },
 'mcp-ready': {
 icon: undefined,
 label: 'MCP Ready',
 className: 'bg-gradient-to-r from-success/15 to-info/15 border border-success/30 text-success',
 },
 'ai-ready': {
 icon: undefined,
 label: 'AI Ready',
 className: 'bg-gradient-to-r from-warning/15 via-warning/15 to-destructive/15 border border-warning/30 text-warning',
 },
 'healing': {
 icon: '🔧',
 label: 'Healed',
 className: 'bg-primary/15 text-primary',
 },
};

// =============================================================================
// BADGE PROPS
// =============================================================================

interface BaseBadgeProps {
 /** Size of the badge */
 size?: BadgeSize;
 /** Shape of the badge */
 shape?: BadgeShape;
 /** Icon to display before the label */
 icon?: React.ReactNode;
 /** Tooltip text */
 title?: string;
 /** Additional CSS classes */
 className?: string;
 /** Children content */
 children?: React.ReactNode;
}

interface SeverityBadgeProps extends BaseBadgeProps {
 variant: 'severity';
 value: SeverityLevel;
}

interface StatusBadgeProps extends BaseBadgeProps {
 variant: 'status';
 value: StatusType;
}

interface TypeBadgeProps extends BaseBadgeProps {
 variant: 'type';
 value: TestType;
 /** Show only icon without label */
 iconOnly?: boolean;
}

interface AIBadgeProps extends BaseBadgeProps {
 variant: 'ai';
 value: AIBadgeType;
}

interface SourceBadgeProps extends BaseBadgeProps {
 variant: 'source';
 value: SourceType;
}

interface PriorityBadgeProps extends BaseBadgeProps {
 variant: 'priority';
 value: PriorityType;
}

interface ImpactBadgeProps extends BaseBadgeProps {
 variant: 'impact';
 value: ImpactType;
}

interface CustomBadgeProps extends BaseBadgeProps {
 variant?: 'custom';
 /** Pre-defined color name */
 color?: BadgeColor;
 /** Custom className for colors (overrides color prop) */
 colorClassName?: string;
}

export type BadgeProps =
 | SeverityBadgeProps
 | StatusBadgeProps
 | TypeBadgeProps
 | AIBadgeProps
 | SourceBadgeProps
 | PriorityBadgeProps
 | ImpactBadgeProps
 | CustomBadgeProps;

// =============================================================================
// BADGE COMPONENT
// =============================================================================

// Feature #521: Source badge color mapping - Feature #614: Use semantic tokens
const sourceColors: Record<SourceType, string> = {
 vision: 'bg-method-ai/15 text-method-ai',
 metrics: 'bg-info/15 text-info',
};

// Feature #521: Priority badge color mapping
const priorityColors: Record<PriorityType, string> = {
 critical: 'bg-destructive/15 text-destructive',
 high: 'bg-warning/15 text-warning',
 medium: 'bg-info/15 text-info',
 low: 'bg-muted text-muted-foreground',
};

// Feature #521: Impact badge color mapping (accessibility)
const impactColors: Record<ImpactType, string> = {
 critical: 'bg-destructive/15 text-destructive',
 serious: 'bg-warning/15 text-warning',
 moderate: 'bg-info/15 text-info',
 minor: 'bg-muted text-muted-foreground',
};

function getColorClass(props: BadgeProps): string {
 if (props.variant === 'severity') {
 return getSeverityColor(props.value).badge;
 }
 if (props.variant === 'status') {
 return getStatusColor(props.value).badge;
 }
 if (props.variant === 'type') {
 const config = testTypeConfig[props.value];
 return colorClasses[config.color];
 }
 if (props.variant === 'ai') {
 return aiBadgeConfig[props.value].className;
 }
 if (props.variant === 'source') {
 return sourceColors[props.value] || colorClasses.gray;
 }
 if (props.variant === 'priority') {
 return priorityColors[props.value] || colorClasses.gray;
 }
 if (props.variant === 'impact') {
 return impactColors[props.value] || colorClasses.gray;
 }
 // Custom variant
 const customProps = props as CustomBadgeProps;
 if (customProps.colorClassName) {
 return customProps.colorClassName;
 }
 if (customProps.color) {
 return colorClasses[customProps.color];
 }
 return colorClasses.gray;
}

function getIcon(props: BadgeProps): React.ReactNode {
 if (props.icon !== undefined) return props.icon;

 if (props.variant === 'type') {
 return testTypeConfig[props.value].icon;
 }
 if (props.variant === 'ai') {
 return aiBadgeConfig[props.value].icon;
 }
 // Feature #521: Source badge icons
 if (props.variant === 'source') {
 return props.value === 'vision'
 ? <Eye className="w-3 h-3" />
 : <BarChart2 className="w-3 h-3" />;
 }
 return null;
}

function getDefaultLabel(props: BadgeProps): string | null {
 if (props.variant === 'type') {
 const typeProps = props as TypeBadgeProps;
 if (typeProps.iconOnly) return null;
 return testTypeConfig[props.value].label;
 }
 if (props.variant === 'ai') {
 return aiBadgeConfig[props.value].label;
 }
 return null;
}

function getDefaultTitle(props: BadgeProps): string | undefined {
 if (props.title) return props.title;

 if (props.variant === 'type') {
 return testTypeConfig[props.value].label;
 }
 if (props.variant === 'ai') {
 const config = aiBadgeConfig[props.value];
 if (props.value === 'mcp-ready') return 'Available via Model Context Protocol (MCP)';
 if (props.value === 'ai-powered') return 'Powered by Claude AI';
 if (props.value === 'ai-ready') return 'AI-ready: Powered by Claude AI and available via MCP';
 return config.label;
 }
 return undefined;
}

export const Badge = memo(function Badge(props: BadgeProps) {
 const {
 size = 'sm',
 shape = 'pill',
 className = '',
 children,
 } = props;

 const colorClass = getColorClass(props);
 const icon = getIcon(props);
 const defaultLabel = getDefaultLabel(props);
 const title = getDefaultTitle(props);

 const content = children || defaultLabel;

 return (
 <span
 className={`
 inline-flex items-center font-medium
 ${sizeClasses[size]}
 ${shapeClasses[shape]}
 ${colorClass}
 ${className}
 `.trim().replace(/\s+/g, ' ')}
 title={title}
 >
 {icon && <span>{icon}</span>}
 {content && <span>{content}</span>}
 </span>
 );
});

// =============================================================================
// SPECIALIZED EXPORTS
// =============================================================================

/**
 * Severity badge for critical/high/medium/low/info levels
 */
export const SeverityBadge = memo(function SeverityBadge({
 severity,
 ...props
}: Omit<SeverityBadgeProps, 'variant' | 'value'> & { severity: SeverityLevel }) {
 return <Badge variant="severity" value={severity} {...props}>{severity.charAt(0).toUpperCase() + severity.slice(1)}</Badge>;
});

/**
 * Status badge for passed/failed/running/pending/etc
 */
export const StatusBadge = memo(function StatusBadge({
 status,
 ...props
}: Omit<StatusBadgeProps, 'variant' | 'value'> & { status: StatusType }) {
 return <Badge variant="status" value={status} {...props}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
});

/**
 * Test type badge with icon
 */
export const TestTypeBadge = memo(function TestTypeBadge({
 testType,
 iconOnly = true,
 ...props
}: Omit<TypeBadgeProps, 'variant' | 'value'> & { testType: TestType }) {
 return <Badge variant="type" value={testType} iconOnly={iconOnly} {...props} />;
});

/**
 * AI-powered feature badge
 */
export const AIPoweredBadge = memo(function AIPoweredBadge(props: Omit<AIBadgeProps, 'variant' | 'value'>) {
 return <Badge variant="ai" value="ai-powered" {...props} />;
});

/**
 * MCP-ready feature badge
 */
export const MCPReadyBadge = memo(function MCPReadyBadge(props: Omit<AIBadgeProps, 'variant' | 'value'>) {
 return <Badge variant="ai" value="mcp-ready" {...props} />;
});

/**
 * AI-generated content badge
 */
export const AIGeneratedBadge = memo(function AIGeneratedBadge(props: Omit<AIBadgeProps, 'variant' | 'value'>) {
 return <Badge variant="ai" value="ai-generated" {...props} />;
});

/**
 * Healing indicator badge
 */
export const HealingBadge = memo(function HealingBadge({
 count = 1,
 status,
 ...props
}: Omit<AIBadgeProps, 'variant' | 'value'> & { count?: number; status?: 'pending' | 'applied' | 'rejected' }) {
 const statusColors: Record<string, BadgeColor> = {
 pending: 'amber',
 applied: 'green',
 rejected: 'red',
 };

 return (
 <Badge
 color={status ? statusColors[status] : 'blue'}
 icon="🔧"
 title={`${count} healed selector${count > 1 ? 's' : ''} (${status || 'pending'})`}
 {...props}
 >
 {count > 1 ? count : null}
 </Badge>
 );
});

/**
 * Feature #521: Source badge for vision/metrics data origin
 * Accepts string for backwards compatibility, normalizes to SourceType
 */
export const SourceBadgeCmp = memo(function SourceBadgeCmp({
 source,
 ...props
}: Omit<SourceBadgeProps, 'variant' | 'value'> & { source?: string }) {
 const normalizedSource = (source?.toLowerCase() || 'metrics') as SourceType;
 return <Badge variant="source" value={normalizedSource} {...props}>{normalizedSource === 'vision' ? 'Vision' : 'Metrics'}</Badge>;
});

/**
 * Feature #521: Priority badge for critical/high/medium/low
 * Accepts string for backwards compatibility, normalizes to PriorityType
 */
export const PriorityBadgeCmp = memo(function PriorityBadgeCmp({
 priority,
 ...props
}: Omit<PriorityBadgeProps, 'variant' | 'value'> & { priority: string }) {
 const normalizedPriority = (priority?.toLowerCase() || 'medium') as PriorityType;
 const label = normalizedPriority.charAt(0).toUpperCase() + normalizedPriority.slice(1);
 return <Badge variant="priority" value={normalizedPriority} {...props}>{label}</Badge>;
});

/**
 * Feature #521: Impact badge for accessibility violation impacts
 * Accepts string for backwards compatibility, normalizes to ImpactType
 */
export const ImpactBadgeCmp = memo(function ImpactBadgeCmp({
 impact,
 ...props
}: Omit<ImpactBadgeProps, 'variant' | 'value'> & { impact: string }) {
 const normalizedImpact = (impact?.toLowerCase() || 'moderate') as ImpactType;
 const label = normalizedImpact.charAt(0).toUpperCase() + normalizedImpact.slice(1);
 return <Badge variant="impact" value={normalizedImpact} {...props}>{label}</Badge>;
});

/**
 * Feature #521: Accessibility Severity badge
 * For accessibility violations that use serious/moderate/minor (different from SeverityLevel)
 * Maps: serious->warning, moderate->info, minor->muted, critical->destructive
 */
export const AccessibilitySeverityBadge = memo(function AccessibilitySeverityBadge({
 severity,
 ...props
}: Omit<ImpactBadgeProps, 'variant' | 'value'> & { severity: string }) {
 // Map accessibility severity to ImpactType
 const severityMap: Record<string, ImpactType> = {
 critical: 'critical',
 serious: 'serious',
 moderate: 'moderate',
 minor: 'minor',
 high: 'serious',
 medium: 'moderate',
 low: 'minor',
 };
 const normalizedSeverity = severityMap[severity?.toLowerCase()] || 'moderate';
 const label = severity ? severity.charAt(0).toUpperCase() + severity.slice(1).toLowerCase() : 'Moderate';
 return <Badge variant="impact" value={normalizedSeverity} {...props}>{label}</Badge>;
});

export default Badge;
