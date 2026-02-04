/**
 * Monitoring Modals
 * Feature #47: Extracted from MonitoringPage.tsx for modularity
 */

export { default as CreateCheckModal, type CreateCheckModalProps } from './CreateCheckModal';
export { default as TransactionModal, type TransactionModalProps } from './TransactionModal';
export { default as PerformanceCheckModal, type PerformanceCheckModalProps } from './PerformanceCheckModal';
export { default as WebhookModal, type WebhookModalProps } from './WebhookModal';

// Settings modals
export { AlertRoutingModal, type AlertRoutingModalProps } from './settings/AlertRoutingModal';
export { AlertGroupingModal, type AlertGroupingModalProps } from './settings/AlertGroupingModal';
export { AlertRoutingTestModal, type AlertRoutingTestModalProps } from './settings/AlertRoutingTestModal';
export { EscalationPolicyModal, type EscalationPolicyModalProps } from './settings/EscalationPolicyModal';
export {
  CreateManagedIncidentModal,
  ManagedIncidentDetailModal,
  AssignResponderModal,
  ResolveIncidentModal,
  getIncidentStatusColor,
  getIncidentPriorityColor,
} from './settings/ManagedIncidentModals';

// On-Call Schedule Modal
export { OnCallScheduleModal, type OnCallScheduleModalProps } from './settings/OnCallScheduleModal';

// Status Page Modals
export { StatusPageModal, type StatusPageModalProps } from './settings/StatusPageModal';
export {
  IncidentManagementPanel,
  type IncidentManagementPanelProps,
  CreateStatusPageIncidentModal,
  type CreateStatusPageIncidentModalProps,
  AddIncidentUpdateModal,
  type AddIncidentUpdateModalProps,
} from './settings/StatusPageIncidentModals';
