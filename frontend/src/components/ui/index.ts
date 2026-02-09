/**
 * Feature #131: Unified Component Library
 * Central export for all shared UI components
 */

// Badge components
export {
  Badge,
  SeverityBadge,
  StatusBadge,
  TestTypeBadge,
  AIPoweredBadge,
  MCPReadyBadge,
  AIGeneratedBadge,
  HealingBadge,
  type BadgeProps,
  type BadgeSize,
  type BadgeVariant,
  type BadgeColor,
  type BadgeShape,
} from './Badge';

// Legacy AI badges (keep for backwards compatibility)
export {
  AIPoweredBadge as AIBadgePowered,
  MCPReadyBadge as MCPBadgeReady,
  AIReadyBadge,
  AIDot,
  MCPDot,
} from './AIBadges';

// Modal components
export {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  modalContainerClasses,
} from './Modal';

// Data display components
export {
  DataTable,
  type DataTableProps,
  type DataTableColumn,
  type DataTablePagination,
  type SortDirection,
} from './DataTable';

export {
  ResponsiveTable,
  DataCard,
  HorizontalScrollWrapper,
  type TableColumn,
} from './ResponsiveTable';

// Form components
export {
  FormField,
  FormError,
  FormFieldGroup,
  FormActions,
  type FormFieldProps,
  type FormFieldOption,
} from './FormField';

// Empty state components
export { EmptyState, EmptyStates } from './EmptyState';

// Command palette
export { CommandPalette, useCommandPalette } from './CommandPalette';

// Feature #335: Design System Components

// shadcn/ui Card
export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from './card';

// shadcn/ui Table
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from './table';

// shadcn/ui Tabs
export { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs';

// shadcn/ui Progress
export { Progress } from './progress';

// shadcn/ui Avatar
export { Avatar, AvatarImage, AvatarFallback } from './avatar';

// shadcn/ui Breadcrumb
export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
} from './breadcrumb';

// shadcn/ui Alert
export { Alert, AlertTitle, AlertDescription } from './alert';

// Custom design system components
export { PageHeader, type BreadcrumbItem as PageBreadcrumbItem } from './page-header';
export { StatCard } from './stat-card';
export { AnimatedCard } from './animated-card';
export { StatusPill, getStatusFromString } from './status-pill';
export { SectionHeader } from './section-header';
export { MetadataRow, MetadataList } from './metadata-row';

// Feature #522: Score display components
export {
  ScoreCard,
  ScoreCardGrid,
  getScoreTextColor,
  getScoreBgColor,
  type ScoreCardProps,
  type ScoreCardSize,
  type ScoreThresholds,
  type ScoreCardGridProps,
} from './score-card';

// Animation utilities
export {
  useReducedMotion,
  animationClasses,
  motionVariants,
  getStaggerDelay,
  animationTiming,
} from './animations';
