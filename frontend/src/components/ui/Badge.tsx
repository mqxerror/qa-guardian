/**
 * Feature #131: Unified Badge Component
 * A flexible badge component that supports multiple variants:
 * - severity: critical, high, medium, low, info
 * - status: passed, failed, running, pending, cancelled, skipped, error
 * - type: e2e, visual, performance, load, accessibility
 * - ai: ai-generated, ai-powered, mcp-ready, healing
 * - custom: any custom color scheme
 *
 * Usage:
 * ```tsx
 * <Badge variant="severity" value="critical">Critical</Badge>
 * <Badge variant="status" value="passed">Passed</Badge>
 * <Badge variant="type" value="e2e" icon="🧪" />
 * <Badge variant="ai" value="ai-generated">AI Generated</Badge>
 * <Badge color="purple">Custom</Badge>
 * ```
 */

import React, { memo } from 'react';
import { getSeverityColor, getStatusColor, type SeverityLevel, type StatusType } from '../../constants/colors';

// =============================================================================
// TYPES
// =============================================================================

export type BadgeSize = 'xs' | 'sm' | 'md' | 'lg';
export type BadgeVariant = 'severity' | 'status' | 'type' | 'ai' | 'custom';
export type BadgeShape = 'rounded' | 'pill';

// Pre-defined color names for custom variant
export type BadgeColor =
 | 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'indigo' | 'purple' | 'pink'
 | 'gray' | 'teal' | 'emerald' | 'amber';

// Test type values
export type TestType = 'e2e' | 'visual_regression' | 'lighthouse' | 'load' | 'accessibility';

// AI badge types
export type AIBadgeType = 'ai-generated' | 'ai-powered' | 'mcp-ready' | 'ai-ready' | 'healing';

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
const colorClasses: Record<BadgeColor, string> = {
 red: 'bg-destructive/10 text-destructive',
 orange: 'bg-orange-100 text-orange-700',
 yellow: 'bg-warning/10 text-warning',
 green: 'bg-success/10 text-success',
 blue: 'bg-primary/10 text-primary',
 indigo: 'bg-indigo-100 text-indigo-700',
 purple: 'bg-purple-100 text-purple-700',
 pink: 'bg-pink-100 text-pink-700',
 gray: 'bg-muted text-foreground',
 teal: 'bg-teal-100 text-teal-700',
 emerald: 'bg-emerald-100 text-emerald-700',
 amber: 'bg-warning/10 text-warning',
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
const aiBadgeConfig: Record<AIBadgeType, { icon?: string; label: string; className: string }> = {
 'ai-generated': {
 icon: '🤖',
 label: 'AI Generated',
 className: 'bg-purple-100 text-purple-700',
 },
 'ai-powered': {
 icon: undefined,
 label: 'AI Powered',
 className: 'bg-gradient-to-r from-purple-500/10 to-primary/10 border border-purple-500/30 text-purple-600',
 },
 'mcp-ready': {
 icon: undefined,
 label: 'MCP Ready',
 className: 'bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 text-emerald-600',
 },
 'ai-ready': {
 icon: undefined,
 label: 'AI Ready',
 className: 'bg-gradient-to-r from-warning/10 via-orange-500/10 to-destructive/10 border border-warning/30 text-warning',
 },
 'healing': {
 icon: '🔧',
 label: 'Healed',
 className: 'bg-primary/10 text-primary',
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
 | CustomBadgeProps;

// =============================================================================
// BADGE COMPONENT
// =============================================================================

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

export default Badge;
