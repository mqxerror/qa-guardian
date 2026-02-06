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
