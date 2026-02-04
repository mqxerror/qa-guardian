/**
 * Monitoring Components
 * Feature #47: Modular monitoring page
 */

// Types - All monitoring-related types
export * from './types';

// Utilities
export * from './utils';

// Components
export { default as StatusBadge } from './StatusBadge';
export { default as MonitoringSummaryCards } from './MonitoringSummaryCards';
export { default as SettingsTab, type SettingsTabProps } from './SettingsTab';
export { default as UptimeChecksTab, type UptimeChecksTabProps } from './UptimeChecksTab';
export { TransactionsTab, type TransactionsTabProps } from './TransactionsTab';
export { PerformanceTab, type PerformanceTabProps } from './PerformanceTab';
export { WebhooksTab, type WebhooksTabProps } from './WebhooksTab';

// Modals
export { CreateCheckModal, type CreateCheckModalProps } from './modals';
export { TransactionModal, type TransactionModalProps } from './modals';
export { PerformanceCheckModal, type PerformanceCheckModalProps } from './modals';
export { WebhookModal, type WebhookModalProps } from './modals';

// Settings Modals
export { AlertRoutingModal, type AlertRoutingModalProps } from './modals';
export { AlertGroupingModal, type AlertGroupingModalProps } from './modals';
export { AlertRoutingTestModal, type AlertRoutingTestModalProps } from './modals';
export { EscalationPolicyModal, type EscalationPolicyModalProps } from './modals';
export {
  CreateManagedIncidentModal,
  ManagedIncidentDetailModal,
  AssignResponderModal,
  ResolveIncidentModal,
  getIncidentStatusColor,
  getIncidentPriorityColor,
} from './modals';

// On-Call Schedule Modal
export { OnCallScheduleModal, type OnCallScheduleModalProps } from './modals';

// Status Page Modals
export { StatusPageModal, type StatusPageModalProps } from './modals';
export {
  IncidentManagementPanel,
  type IncidentManagementPanelProps,
  CreateStatusPageIncidentModal,
  type CreateStatusPageIncidentModalProps,
  AddIncidentUpdateModal,
  type AddIncidentUpdateModalProps,
} from './modals';

// Hooks
export { useMonitoringSettings, type UseMonitoringSettingsReturn } from './hooks';
export { useWebhookHandlers, type UseWebhookHandlersReturn } from './hooks';
export { useTransactionHandlers, type UseTransactionHandlersReturn } from './hooks';
export { usePerformanceHandlers, type UsePerformanceHandlersReturn } from './hooks';
export { useAlertGroupHandlers, type UseAlertGroupHandlersReturn } from './hooks';
export { useUptimeCheckHandlers, type UseUptimeCheckHandlersReturn } from './hooks';
export { useManagedIncidentHandlers, type UseManagedIncidentHandlersReturn } from './hooks';
