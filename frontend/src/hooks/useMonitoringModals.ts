/**
 * Custom hook to manage modal/dialog state for MonitoringPage
 * Feature #708: Extract useState groups from MonitoringPage god component
 */

import { useState, useCallback } from 'react';
import type {
  UptimeCheck,
  StatusPage,
  OnCallSchedule,
  EscalationPolicy,
  AlertRoutingRule,
  AlertRunbook,
} from '../components/monitoring';

export interface MonitoringModalsState {
  // Check modals
  showCreateModal: boolean;
  editingCheck: UptimeCheck | null;
  showMaintenanceModal: boolean;
  // Status page modals
  showStatusPageModal: boolean;
  editingStatusPage: StatusPage | null;
  selectedStatusPageForIncident: StatusPage | null;
  // On-call modals
  showOnCallModal: boolean;
  editingOnCallSchedule: OnCallSchedule | null;
  // Escalation policy modals
  showEscalationPolicyModal: boolean;
  editingEscalationPolicy: EscalationPolicy | null;
  // Alert routing modals
  showAlertRoutingModal: boolean;
  editingAlertRoutingRule: AlertRoutingRule | null;
  showAlertRoutingTest: boolean;
  // Runbook modal
  showRunbookModal: boolean;
  editingRunbook: AlertRunbook | null;
  // Section visibility toggles
  showIncidentTab: boolean;
  showAlertHistorySection: boolean;
}

export interface UseMonitoringModalsReturn extends MonitoringModalsState {
  // Check modal handlers
  openCreateCheckModal: () => void;
  openEditCheckModal: (check: UptimeCheck) => void;
  closeCheckModal: () => void;
  openMaintenanceModal: () => void;
  closeMaintenanceModal: () => void;
  // Status page modal handlers
  openCreateStatusPageModal: () => void;
  openEditStatusPageModal: (page: StatusPage) => void;
  closeStatusPageModal: () => void;
  openIncidentManagement: (page: StatusPage) => void;
  closeIncidentManagement: () => void;
  // On-call modal handlers
  openCreateOnCallModal: () => void;
  openEditOnCallModal: (schedule: OnCallSchedule) => void;
  closeOnCallModal: () => void;
  // Escalation policy modal handlers
  openCreateEscalationPolicyModal: () => void;
  openEditEscalationPolicyModal: (policy: EscalationPolicy) => void;
  closeEscalationPolicyModal: () => void;
  // Alert routing modal handlers
  openCreateAlertRoutingModal: () => void;
  openEditAlertRoutingModal: (rule: AlertRoutingRule) => void;
  closeAlertRoutingModal: () => void;
  openAlertRoutingTest: () => void;
  closeAlertRoutingTest: () => void;
  // Runbook modal handlers
  openCreateRunbookModal: () => void;
  openEditRunbookModal: (runbook: AlertRunbook) => void;
  closeRunbookModal: () => void;
  // Section visibility toggles
  toggleIncidentTab: () => void;
  toggleAlertHistorySection: () => void;
  // Close all modals
  closeAllModals: () => void;
}

const initialState: MonitoringModalsState = {
  showCreateModal: false,
  editingCheck: null,
  showMaintenanceModal: false,
  showStatusPageModal: false,
  editingStatusPage: null,
  selectedStatusPageForIncident: null,
  showOnCallModal: false,
  editingOnCallSchedule: null,
  showEscalationPolicyModal: false,
  editingEscalationPolicy: null,
  showAlertRoutingModal: false,
  editingAlertRoutingRule: null,
  showAlertRoutingTest: false,
  showRunbookModal: false,
  editingRunbook: null,
  showIncidentTab: false,
  showAlertHistorySection: false,
};

export function useMonitoringModals(): UseMonitoringModalsReturn {
  const [state, setState] = useState<MonitoringModalsState>(initialState);

  // Check modal handlers
  const openCreateCheckModal = useCallback(() => {
    setState(prev => ({ ...prev, showCreateModal: true, editingCheck: null }));
  }, []);

  const openEditCheckModal = useCallback((check: UptimeCheck) => {
    setState(prev => ({ ...prev, showCreateModal: true, editingCheck: check }));
  }, []);

  const closeCheckModal = useCallback(() => {
    setState(prev => ({ ...prev, showCreateModal: false, editingCheck: null }));
  }, []);

  const openMaintenanceModal = useCallback(() => {
    setState(prev => ({ ...prev, showMaintenanceModal: true }));
  }, []);

  const closeMaintenanceModal = useCallback(() => {
    setState(prev => ({ ...prev, showMaintenanceModal: false }));
  }, []);

  // Status page modal handlers
  const openCreateStatusPageModal = useCallback(() => {
    setState(prev => ({ ...prev, showStatusPageModal: true, editingStatusPage: null }));
  }, []);

  const openEditStatusPageModal = useCallback((page: StatusPage) => {
    setState(prev => ({ ...prev, showStatusPageModal: true, editingStatusPage: page }));
  }, []);

  const closeStatusPageModal = useCallback(() => {
    setState(prev => ({ ...prev, showStatusPageModal: false, editingStatusPage: null }));
  }, []);

  const openIncidentManagement = useCallback((page: StatusPage) => {
    setState(prev => ({ ...prev, selectedStatusPageForIncident: page }));
  }, []);

  const closeIncidentManagement = useCallback(() => {
    setState(prev => ({ ...prev, selectedStatusPageForIncident: null }));
  }, []);

  // On-call modal handlers
  const openCreateOnCallModal = useCallback(() => {
    setState(prev => ({ ...prev, showOnCallModal: true, editingOnCallSchedule: null }));
  }, []);

  const openEditOnCallModal = useCallback((schedule: OnCallSchedule) => {
    setState(prev => ({ ...prev, showOnCallModal: true, editingOnCallSchedule: schedule }));
  }, []);

  const closeOnCallModal = useCallback(() => {
    setState(prev => ({ ...prev, showOnCallModal: false, editingOnCallSchedule: null }));
  }, []);

  // Escalation policy modal handlers
  const openCreateEscalationPolicyModal = useCallback(() => {
    setState(prev => ({ ...prev, showEscalationPolicyModal: true, editingEscalationPolicy: null }));
  }, []);

  const openEditEscalationPolicyModal = useCallback((policy: EscalationPolicy) => {
    setState(prev => ({ ...prev, showEscalationPolicyModal: true, editingEscalationPolicy: policy }));
  }, []);

  const closeEscalationPolicyModal = useCallback(() => {
    setState(prev => ({ ...prev, showEscalationPolicyModal: false, editingEscalationPolicy: null }));
  }, []);

  // Alert routing modal handlers
  const openCreateAlertRoutingModal = useCallback(() => {
    setState(prev => ({ ...prev, showAlertRoutingModal: true, editingAlertRoutingRule: null }));
  }, []);

  const openEditAlertRoutingModal = useCallback((rule: AlertRoutingRule) => {
    setState(prev => ({ ...prev, showAlertRoutingModal: true, editingAlertRoutingRule: rule }));
  }, []);

  const closeAlertRoutingModal = useCallback(() => {
    setState(prev => ({ ...prev, showAlertRoutingModal: false, editingAlertRoutingRule: null }));
  }, []);

  const openAlertRoutingTest = useCallback(() => {
    setState(prev => ({ ...prev, showAlertRoutingTest: true }));
  }, []);

  const closeAlertRoutingTest = useCallback(() => {
    setState(prev => ({ ...prev, showAlertRoutingTest: false }));
  }, []);

  // Runbook modal handlers
  const openCreateRunbookModal = useCallback(() => {
    setState(prev => ({ ...prev, showRunbookModal: true, editingRunbook: null }));
  }, []);

  const openEditRunbookModal = useCallback((runbook: AlertRunbook) => {
    setState(prev => ({ ...prev, showRunbookModal: true, editingRunbook: runbook }));
  }, []);

  const closeRunbookModal = useCallback(() => {
    setState(prev => ({ ...prev, showRunbookModal: false, editingRunbook: null }));
  }, []);

  // Section visibility toggles
  const toggleIncidentTab = useCallback(() => {
    setState(prev => ({ ...prev, showIncidentTab: !prev.showIncidentTab }));
  }, []);

  const toggleAlertHistorySection = useCallback(() => {
    setState(prev => ({ ...prev, showAlertHistorySection: !prev.showAlertHistorySection }));
  }, []);

  // Close all modals
  const closeAllModals = useCallback(() => {
    setState(initialState);
  }, []);

  return {
    ...state,
    openCreateCheckModal,
    openEditCheckModal,
    closeCheckModal,
    openMaintenanceModal,
    closeMaintenanceModal,
    openCreateStatusPageModal,
    openEditStatusPageModal,
    closeStatusPageModal,
    openIncidentManagement,
    closeIncidentManagement,
    openCreateOnCallModal,
    openEditOnCallModal,
    closeOnCallModal,
    openCreateEscalationPolicyModal,
    openEditEscalationPolicyModal,
    closeEscalationPolicyModal,
    openCreateAlertRoutingModal,
    openEditAlertRoutingModal,
    closeAlertRoutingModal,
    openAlertRoutingTest,
    closeAlertRoutingTest,
    openCreateRunbookModal,
    openEditRunbookModal,
    closeRunbookModal,
    toggleIncidentTab,
    toggleAlertHistorySection,
    closeAllModals,
  };
}
