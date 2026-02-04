/**
 * Settings Modals
 * Feature #47: Extracted from MonitoringPage.tsx for modularity
 */

export { AlertRoutingModal, type AlertRoutingModalProps } from './AlertRoutingModal';
export { AlertGroupingModal, type AlertGroupingModalProps } from './AlertGroupingModal';
export { AlertRoutingTestModal, type AlertRoutingTestModalProps } from './AlertRoutingTestModal';
export { EscalationPolicyModal, type EscalationPolicyModalProps } from './EscalationPolicyModal';
export {
  CreateManagedIncidentModal,
  ManagedIncidentDetailModal,
  AssignResponderModal,
  ResolveIncidentModal,
  getIncidentStatusColor,
  getIncidentPriorityColor,
} from './ManagedIncidentModals';

// On-Call Schedule Modal
export { OnCallScheduleModal, type OnCallScheduleModalProps } from './OnCallScheduleModal';

// Status Page Modals
export { StatusPageModal, type StatusPageModalProps } from './StatusPageModal';
export {
  IncidentManagementPanel,
  type IncidentManagementPanelProps,
  CreateStatusPageIncidentModal,
  type CreateStatusPageIncidentModalProps,
  AddIncidentUpdateModal,
  type AddIncidentUpdateModalProps,
} from './StatusPageIncidentModals';
