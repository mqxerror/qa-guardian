/**
 * useMonitoringSettings Hook
 * Feature #47: Extract settings state management from MonitoringPage.tsx
 *
 * Manages all settings-related state including:
 * - Retention settings
 * - Status pages
 * - On-call schedules
 * - Escalation policies
 * - Alert grouping
 * - Alert routing
 * - Severity mapping
 * - Rate limiting
 * - Alert correlation
 * - Runbooks
 * - Managed incidents
 * - Alert history
 */

import { useState, useCallback } from 'react'; // useEffect unused
import { toast } from '../../../stores/toastStore';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('monitoring-settings');
import {
  MonitoringSettings,
  RetentionStats,
  StatusPage,
  OnCallSchedule,
  EscalationPolicy,
  AlertGroupingRule,
  AlertGroup,
  AlertRoutingRule,
  AlertRoutingLog,
  GlobalSeverityMapping,
  AlertRateLimitConfig,
  AlertCorrelationConfig,
  AlertCorrelation,
  AlertRunbook,
  ManagedIncident,
  AvailableCheck,
  StatusPageIncident,
  AlertHistoryStats,
  AlertHistoryItem,
  AlertsOverTimeData,
  RateLimitStats,
  OnCallMember,
} from '../types';

export interface UseMonitoringSettingsReturn {
  // Retention settings
  monitoringSettings: MonitoringSettings | null;
  retentionStats: RetentionStats | null;
  isLoadingSettings: boolean;
  isSavingSettings: boolean;
  isRunningCleanup: boolean;
  settingsRetentionDays: 30 | 90 | 365;
  settingsAutoCleanup: boolean;
  setSettingsRetentionDays: (days: 30 | 90 | 365) => void;
  setSettingsAutoCleanup: (enabled: boolean) => void;
  saveMonitoringSettings: () => Promise<void>;
  runRetentionCleanup: () => Promise<void>;
  fetchMonitoringSettings: () => Promise<void>;

  // Status pages
  statusPages: StatusPage[];
  availableChecksForStatus: AvailableCheck[];
  isLoadingStatusPages: boolean;
  fetchStatusPages: () => Promise<void>;
  deleteStatusPage: (pageId: string) => Promise<void>;
  statusPageIncidents: StatusPageIncident[];
  isLoadingStatusPageIncidents: boolean;
  fetchStatusPageIncidents: (pageId: string) => Promise<void>;

  // Status page form state
  showStatusPageModal: boolean;
  setShowStatusPageModal: (show: boolean) => void;
  editingStatusPage: StatusPage | null;
  setEditingStatusPage: (page: StatusPage | null) => void;
  statusPageName: string;
  setStatusPageName: (name: string) => void;
  statusPageSlug: string;
  setStatusPageSlug: (slug: string) => void;
  statusPageDescription: string;
  setStatusPageDescription: (description: string) => void;
  statusPageColor: string;
  setStatusPageColor: (color: string) => void;
  statusPageIsPublic: boolean;
  setStatusPageIsPublic: (isPublic: boolean) => void;
  statusPageShowUptime: boolean;
  setStatusPageShowUptime: (show: boolean) => void;
  statusPageShowResponseTime: boolean;
  setStatusPageShowResponseTime: (show: boolean) => void;
  statusPageShowIncidents: boolean;
  setStatusPageShowIncidents: (show: boolean) => void;
  statusPageSelectedChecks: { id: string; type: string; name: string }[];
  setStatusPageSelectedChecks: (checks: { id: string; type: string; name: string }[]) => void;
  isSubmittingStatusPage: boolean;
  submitStatusPage: () => Promise<void>;
  resetStatusPageForm: () => void;

  // Status page incident form state
  showIncidentModal: boolean;
  setShowIncidentModal: (show: boolean) => void;
  showIncidentUpdateModal: boolean;
  setShowIncidentUpdateModal: (show: boolean) => void;
  selectedStatusPageForIncident: StatusPage | null;
  setSelectedStatusPageForIncident: (page: StatusPage | null) => void;
  editingIncident: StatusPageIncident | null;
  setEditingIncident: (incident: StatusPageIncident | null) => void;
  incidentTitle: string;
  setIncidentTitle: (title: string) => void;
  incidentStatus: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  setIncidentStatus: (status: 'investigating' | 'identified' | 'monitoring' | 'resolved') => void;
  incidentImpact: 'none' | 'minor' | 'major' | 'critical';
  setIncidentImpact: (impact: 'none' | 'minor' | 'major' | 'critical') => void;
  incidentUpdateMessage: string;
  setIncidentUpdateMessage: (message: string) => void;
  isSubmittingIncident: boolean;
  submitIncident: () => Promise<void>;
  submitIncidentUpdate: () => Promise<void>;

  // On-call schedules
  onCallSchedules: OnCallSchedule[];
  isLoadingOnCallSchedules: boolean;
  fetchOnCallSchedules: () => Promise<void>;
  deleteOnCallSchedule: (scheduleId: string) => Promise<void>;
  rotateOnCallSchedule: (scheduleId: string) => Promise<void>;

  // On-call form state
  showOnCallModal: boolean;
  setShowOnCallModal: (show: boolean) => void;
  editingOnCallSchedule: OnCallSchedule | null;
  setEditingOnCallSchedule: (schedule: OnCallSchedule | null) => void;
  onCallScheduleName: string;
  setOnCallScheduleName: (name: string) => void;
  onCallScheduleDescription: string;
  setOnCallScheduleDescription: (description: string) => void;
  onCallScheduleTimezone: string;
  setOnCallScheduleTimezone: (timezone: string) => void;
  onCallScheduleRotationType: 'daily' | 'weekly' | 'custom';
  setOnCallScheduleRotationType: (type: 'daily' | 'weekly' | 'custom') => void;
  onCallScheduleRotationInterval: number;
  setOnCallScheduleRotationInterval: (interval: number) => void;
  onCallScheduleMembers: OnCallMember[];
  setOnCallScheduleMembers: (members: OnCallMember[]) => void;
  isSubmittingOnCallSchedule: boolean;
  submitOnCallSchedule: () => Promise<void>;
  resetOnCallForm: () => void;
  newMemberName: string;
  setNewMemberName: (name: string) => void;
  newMemberEmail: string;
  setNewMemberEmail: (email: string) => void;
  newMemberPhone: string;
  setNewMemberPhone: (phone: string) => void;
  addOnCallMember: () => void;
  removeOnCallMember: (index: number) => void;

  // Escalation policies
  escalationPolicies: EscalationPolicy[];
  isLoadingEscalationPolicies: boolean;
  fetchEscalationPolicies: () => Promise<void>;
  deleteEscalationPolicy: (policyId: string) => Promise<void>;
  testEscalationPolicy: (policyId: string) => Promise<void>;

  // Alert grouping
  alertGroupingRules: AlertGroupingRule[];
  alertGroups: AlertGroup[];
  isLoadingAlertGrouping: boolean;
  fetchAlertGroupingRules: () => Promise<void>;
  deleteAlertGroupingRule: (ruleId: string) => Promise<void>;
  simulateAlertGrouping: () => Promise<void>;
  acknowledgeAlertGroup: (groupId: string) => Promise<void>;
  resolveAlertGroup: (groupId: string) => Promise<void>;
  snoozeAlertGroup: (groupId: string, hours: number) => Promise<void>;

  // Alert grouping form state
  showAlertGroupingModal: boolean;
  setShowAlertGroupingModal: (show: boolean) => void;
  editingAlertGroupingRule: AlertGroupingRule | null;
  setEditingAlertGroupingRule: (rule: AlertGroupingRule | null) => void;

  // Alert routing
  alertRoutingRules: AlertRoutingRule[];
  alertRoutingLogs: AlertRoutingLog[];
  isLoadingAlertRouting: boolean;
  fetchAlertRoutingRules: () => Promise<void>;
  deleteAlertRoutingRule: (ruleId: string) => Promise<void>;
  toggleAlertRoutingRule: (ruleId: string, enabled: boolean) => Promise<void>;

  // Alert routing form state
  showAlertRoutingModal: boolean;
  setShowAlertRoutingModal: (show: boolean) => void;
  editingAlertRoutingRule: AlertRoutingRule | null;
  setEditingAlertRoutingRule: (rule: AlertRoutingRule | null) => void;

  // Severity mapping
  globalSeverityMapping: GlobalSeverityMapping;
  setGlobalSeverityMapping: React.Dispatch<React.SetStateAction<GlobalSeverityMapping>>;

  // Rate limiting
  alertRateLimitConfig: AlertRateLimitConfig;
  setAlertRateLimitConfig: React.Dispatch<React.SetStateAction<AlertRateLimitConfig>>;
  rateLimitStats: RateLimitStats | null;
  isTestingRateLimit: boolean;
  isSavingRateLimit: boolean;
  testRateLimit: () => Promise<void>;
  saveRateLimitConfig: () => Promise<void>;

  // Alert correlation
  alertCorrelationConfig: AlertCorrelationConfig;
  setAlertCorrelationConfig: React.Dispatch<React.SetStateAction<AlertCorrelationConfig>>;
  alertCorrelations: AlertCorrelation[];
  acknowledgeCorrelation: (correlationId: string) => Promise<void>;

  // Runbooks
  alertRunbooks: AlertRunbook[];
  isLoadingRunbooks: boolean;
  fetchAlertRunbooks: () => Promise<void>;
  deleteRunbook: (runbookId: string) => Promise<void>;
  testRunbook: (runbookId: string) => Promise<void>;

  // Managed incidents
  managedIncidents: ManagedIncident[];
  isLoadingManagedIncidents: boolean;
  fetchManagedIncidents: () => Promise<void>;
  updateManagedIncidentStatus: (incidentId: string, newStatus: ManagedIncident['status']) => Promise<void>;
  assignManagedResponder: (incidentId: string) => Promise<void>;
  resolveManagedIncident: (incidentId: string) => Promise<void>;

  // Managed incident form state
  showManagedIncidentModal: boolean;
  setShowManagedIncidentModal: (show: boolean) => void;
  editingManagedIncident: ManagedIncident | null;
  setEditingManagedIncident: (incident: ManagedIncident | null) => void;

  // Alert history
  alertHistory: AlertHistoryItem[];
  alertHistoryStats: AlertHistoryStats | null;
  alertsOverTime: AlertsOverTimeData[];
  isLoadingAlertHistory: boolean;
  alertHistorySeverityFilter: string;
  alertHistorySourceFilter: string;
  setAlertHistorySeverityFilter: (filter: string) => void;
  setAlertHistorySourceFilter: (filter: string) => void;
  showAlertHistorySection: boolean;
  setShowAlertHistorySection: (show: boolean) => void;
  fetchAlertHistory: () => Promise<void>;
}

export function useMonitoringSettings(token: string): UseMonitoringSettingsReturn {
  // Retention settings state
  const [monitoringSettings, setMonitoringSettings] = useState<MonitoringSettings | null>(null);
  const [retentionStats, setRetentionStats] = useState<RetentionStats | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isRunningCleanup, setIsRunningCleanup] = useState(false);
  const [settingsRetentionDays, setSettingsRetentionDays] = useState<30 | 90 | 365>(90);
  const [settingsAutoCleanup, setSettingsAutoCleanup] = useState(true);

  // Status pages state
  const [statusPages, setStatusPages] = useState<StatusPage[]>([]);
  const [availableChecksForStatus, setAvailableChecksForStatus] = useState<AvailableCheck[]>([]);
  const [isLoadingStatusPages, setIsLoadingStatusPages] = useState(false);
  const [statusPageIncidents, setStatusPageIncidents] = useState<StatusPageIncident[]>([]);
  const [isLoadingStatusPageIncidents, setIsLoadingStatusPageIncidents] = useState(false);

  // Status page form state
  const [showStatusPageModal, setShowStatusPageModal] = useState(false);
  const [editingStatusPage, setEditingStatusPage] = useState<StatusPage | null>(null);
  const [statusPageName, setStatusPageName] = useState('');
  const [statusPageSlug, setStatusPageSlug] = useState('');
  const [statusPageDescription, setStatusPageDescription] = useState('');
  const [statusPageColor, setStatusPageColor] = useState('#2563EB');
  const [statusPageIsPublic, setStatusPageIsPublic] = useState(true);
  const [statusPageShowUptime, setStatusPageShowUptime] = useState(true);
  const [statusPageShowResponseTime, setStatusPageShowResponseTime] = useState(true);
  const [statusPageShowIncidents, setStatusPageShowIncidents] = useState(true);
  const [statusPageSelectedChecks, setStatusPageSelectedChecks] = useState<{ id: string; type: string; name: string }[]>([]);
  const [isSubmittingStatusPage, setIsSubmittingStatusPage] = useState(false);

  // Status page incident form state
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [showIncidentUpdateModal, setShowIncidentUpdateModal] = useState(false);
  const [selectedStatusPageForIncident, setSelectedStatusPageForIncident] = useState<StatusPage | null>(null);
  const [editingIncident, setEditingIncident] = useState<StatusPageIncident | null>(null);
  const [incidentTitle, setIncidentTitle] = useState('');
  const [incidentStatus, setIncidentStatus] = useState<'investigating' | 'identified' | 'monitoring' | 'resolved'>('investigating');
  const [incidentImpact, setIncidentImpact] = useState<'none' | 'minor' | 'major' | 'critical'>('major');
  const [incidentUpdateMessage, setIncidentUpdateMessage] = useState('');
  const [isSubmittingIncident, setIsSubmittingIncident] = useState(false);

  // On-call schedules state
  const [onCallSchedules, setOnCallSchedules] = useState<OnCallSchedule[]>([]);
  const [isLoadingOnCallSchedules, setIsLoadingOnCallSchedules] = useState(false);
  const [showOnCallModal, setShowOnCallModal] = useState(false);
  const [editingOnCallSchedule, setEditingOnCallSchedule] = useState<OnCallSchedule | null>(null);
  const [onCallScheduleName, setOnCallScheduleName] = useState('');
  const [onCallScheduleDescription, setOnCallScheduleDescription] = useState('');
  const [onCallScheduleTimezone, setOnCallScheduleTimezone] = useState('UTC');
  const [onCallScheduleRotationType, setOnCallScheduleRotationType] = useState<'daily' | 'weekly' | 'custom'>('weekly');
  const [onCallScheduleRotationInterval, setOnCallScheduleRotationInterval] = useState(7);
  const [onCallScheduleMembers, setOnCallScheduleMembers] = useState<OnCallMember[]>([]);
  const [isSubmittingOnCallSchedule, setIsSubmittingOnCallSchedule] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('');

  // Escalation policies state
  const [escalationPolicies, setEscalationPolicies] = useState<EscalationPolicy[]>([]);
  const [isLoadingEscalationPolicies, setIsLoadingEscalationPolicies] = useState(false);

  // Alert grouping state
  const [alertGroupingRules, setAlertGroupingRules] = useState<AlertGroupingRule[]>([]);
  const [alertGroups, setAlertGroups] = useState<AlertGroup[]>([]);
  const [isLoadingAlertGrouping, setIsLoadingAlertGrouping] = useState(false);
  const [showAlertGroupingModal, setShowAlertGroupingModal] = useState(false);
  const [editingAlertGroupingRule, setEditingAlertGroupingRule] = useState<AlertGroupingRule | null>(null);

  // Alert routing state
  const [alertRoutingRules, setAlertRoutingRules] = useState<AlertRoutingRule[]>([]);
  const [alertRoutingLogs, setAlertRoutingLogs] = useState<AlertRoutingLog[]>([]);
  const [isLoadingAlertRouting, setIsLoadingAlertRouting] = useState(false);
  const [showAlertRoutingModal, setShowAlertRoutingModal] = useState(false);
  const [editingAlertRoutingRule, setEditingAlertRoutingRule] = useState<AlertRoutingRule | null>(null);

  // Severity mapping state
  const [globalSeverityMapping, setGlobalSeverityMapping] = useState<GlobalSeverityMapping>({
    critical: 'P1',
    high: 'P2',
    medium: 'P3',
    low: 'P4',
    info: 'P5',
  });

  // Rate limiting state
  const [alertRateLimitConfig, setAlertRateLimitConfig] = useState<AlertRateLimitConfig>({
    enabled: true,
    max_alerts_per_minute: 5,
    time_window_seconds: 60,
    suppression_mode: 'aggregate',
    aggregate_threshold: 10,
  });
  const [rateLimitStats, setRateLimitStats] = useState<RateLimitStats | null>(null);
  const [isTestingRateLimit, setIsTestingRateLimit] = useState(false);
  const [isSavingRateLimit, setIsSavingRateLimit] = useState(false);

  // Alert correlation state
  const [alertCorrelationConfig, setAlertCorrelationConfig] = useState<AlertCorrelationConfig>({
    enabled: true,
    correlate_by_check: true,
    correlate_by_location: true,
    correlate_by_error_type: true,
    correlate_by_time_window: true,
    time_window_seconds: 300, // 5 minutes
    similarity_threshold: 0.7,
  });
  const [alertCorrelations, setAlertCorrelations] = useState<AlertCorrelation[]>([]);

  // Runbooks state
  const [alertRunbooks, setAlertRunbooks] = useState<AlertRunbook[]>([]);
  const [isLoadingRunbooks, setIsLoadingRunbooks] = useState(false);

  // Managed incidents state
  const [managedIncidents, setManagedIncidents] = useState<ManagedIncident[]>([]);
  const [isLoadingManagedIncidents, setIsLoadingManagedIncidents] = useState(false);
  const [showManagedIncidentModal, setShowManagedIncidentModal] = useState(false);
  const [editingManagedIncident, setEditingManagedIncident] = useState<ManagedIncident | null>(null);

  // Alert history state
  const [alertHistory, setAlertHistory] = useState<AlertHistoryItem[]>([]);
  const [alertHistoryStats, setAlertHistoryStats] = useState<AlertHistoryStats | null>(null);
  const [alertsOverTime, setAlertsOverTime] = useState<AlertsOverTimeData[]>([]);
  const [isLoadingAlertHistory, setIsLoadingAlertHistory] = useState(false);
  const [alertHistorySeverityFilter, setAlertHistorySeverityFilter] = useState('all');
  const [alertHistorySourceFilter, setAlertHistorySourceFilter] = useState('all');
  const [showAlertHistorySection, setShowAlertHistorySection] = useState(false);

  // Fetch monitoring settings
  const fetchMonitoringSettings = useCallback(async () => {
    setIsLoadingSettings(true);
    try {
      const response = await fetch('/api/v1/monitoring/settings', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setMonitoringSettings(data.settings);
        setRetentionStats(data.stats);
        setSettingsRetentionDays(data.settings?.retention_days || 90);
        setSettingsAutoCleanup(data.settings?.auto_cleanup_enabled ?? true);
      }
    } catch (error) {
      logger.error('Failed to fetch monitoring settings:', error);
    } finally {
      setIsLoadingSettings(false);
    }
  }, [token]);

  // Save monitoring settings
  const saveMonitoringSettings = useCallback(async () => {
    setIsSavingSettings(true);
    try {
      const response = await fetch('/api/v1/monitoring/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          retention_days: settingsRetentionDays,
          auto_cleanup_enabled: settingsAutoCleanup,
        }),
      });
      if (response.ok) {
        toast.success('Settings saved successfully');
        await fetchMonitoringSettings();
      } else {
        toast.error('Failed to save settings');
      }
    } catch (error) {
      logger.error('Failed to save settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSavingSettings(false);
    }
  }, [token, settingsRetentionDays, settingsAutoCleanup, fetchMonitoringSettings]);

  // Run retention cleanup
  const runRetentionCleanup = useCallback(async () => {
    setIsRunningCleanup(true);
    try {
      const response = await fetch('/api/v1/monitoring/settings/cleanup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        toast.success(`Cleanup complete: ${data.deleted} records removed`);
        await fetchMonitoringSettings();
      } else {
        toast.error('Failed to run cleanup');
      }
    } catch (error) {
      logger.error('Failed to run cleanup:', error);
      toast.error('Failed to run cleanup');
    } finally {
      setIsRunningCleanup(false);
    }
  }, [token, fetchMonitoringSettings]);

  // Fetch status pages
  const fetchStatusPages = useCallback(async () => {
    setIsLoadingStatusPages(true);
    try {
      const response = await fetch('/api/v1/monitoring/status-pages', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setStatusPages(data.pages || []);
        setAvailableChecksForStatus(data.available_checks || []);
      }
    } catch (error) {
      logger.error('Failed to fetch status pages:', error);
    } finally {
      setIsLoadingStatusPages(false);
    }
  }, [token]);

  // Delete status page
  const deleteStatusPage = useCallback(async (pageId: string) => {
    try {
      const response = await fetch(`/api/v1/monitoring/status-pages/${pageId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        toast.success('Status page deleted');
        await fetchStatusPages();
      } else {
        toast.error('Failed to delete status page');
      }
    } catch (error) {
      logger.error('Failed to delete status page:', error);
      toast.error('Failed to delete status page');
    }
  }, [token, fetchStatusPages]);

  // Fetch status page incidents
  const fetchStatusPageIncidents = useCallback(async (pageId: string) => {
    setIsLoadingStatusPageIncidents(true);
    try {
      const response = await fetch(`/api/v1/monitoring/status-pages/${pageId}/incidents`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setStatusPageIncidents(data.incidents || []);
      }
    } catch (error) {
      logger.error('Failed to fetch incidents:', error);
    } finally {
      setIsLoadingStatusPageIncidents(false);
    }
  }, [token]);

  // Submit status page
  const submitStatusPage = useCallback(async () => {
    setIsSubmittingStatusPage(true);
    try {
      const url = editingStatusPage
        ? `/api/v1/monitoring/status-pages/${editingStatusPage.id}`
        : '/api/v1/monitoring/status-pages';
      const method = editingStatusPage ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: statusPageName,
          slug: statusPageSlug,
          description: statusPageDescription,
          primary_color: statusPageColor,
          is_public: statusPageIsPublic,
          show_uptime_percentage: statusPageShowUptime,
          show_response_time: statusPageShowResponseTime,
          show_incidents: statusPageShowIncidents,
          checks: statusPageSelectedChecks.map((check, index) => ({
            check_id: check.id,
            check_type: check.type,
            display_name: check.name,
            order: index,
          })),
        }),
      });

      if (response.ok) {
        toast.success(editingStatusPage ? 'Status page updated' : 'Status page created');
        setShowStatusPageModal(false);
        await fetchStatusPages();
      } else {
        toast.error('Failed to save status page');
      }
    } catch (error) {
      logger.error('Failed to save status page:', error);
      toast.error('Failed to save status page');
    } finally {
      setIsSubmittingStatusPage(false);
    }
  }, [
    token, editingStatusPage, statusPageName, statusPageSlug, statusPageDescription,
    statusPageColor, statusPageIsPublic, statusPageShowUptime, statusPageShowResponseTime,
    statusPageShowIncidents, statusPageSelectedChecks, fetchStatusPages
  ]);

  // Reset status page form
  const resetStatusPageForm = useCallback(() => {
    setStatusPageName('');
    setStatusPageSlug('');
    setStatusPageDescription('');
    setStatusPageColor('#2563EB');
    setStatusPageIsPublic(true);
    setStatusPageShowUptime(true);
    setStatusPageShowResponseTime(true);
    setStatusPageShowIncidents(true);
    setStatusPageSelectedChecks([]);
    setEditingStatusPage(null);
  }, []);

  // Submit incident
  const submitIncident = useCallback(async () => {
    if (!selectedStatusPageForIncident) return;
    setIsSubmittingIncident(true);
    try {
      const url = editingIncident
        ? `/api/v1/monitoring/status-pages/${selectedStatusPageForIncident.id}/incidents/${editingIncident.id}`
        : `/api/v1/monitoring/status-pages/${selectedStatusPageForIncident.id}/incidents`;
      const method = editingIncident ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: incidentTitle,
          status: incidentStatus,
          impact: incidentImpact,
        }),
      });

      if (response.ok) {
        toast.success(editingIncident ? 'Incident updated' : 'Incident created');
        setShowIncidentModal(false);
        await fetchStatusPageIncidents(selectedStatusPageForIncident.id);
      } else {
        toast.error('Failed to save incident');
      }
    } catch (error) {
      logger.error('Failed to save incident:', error);
      toast.error('Failed to save incident');
    } finally {
      setIsSubmittingIncident(false);
    }
  }, [token, selectedStatusPageForIncident, editingIncident, incidentTitle, incidentStatus, incidentImpact, fetchStatusPageIncidents]);

  // Submit incident update
  const submitIncidentUpdate = useCallback(async () => {
    if (!selectedStatusPageForIncident || !editingIncident) return;
    setIsSubmittingIncident(true);
    try {
      const response = await fetch(
        `/api/v1/monitoring/status-pages/${selectedStatusPageForIncident.id}/incidents/${editingIncident.id}/updates`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            status: incidentStatus,
            message: incidentUpdateMessage,
          }),
        }
      );

      if (response.ok) {
        toast.success('Incident update posted');
        setShowIncidentUpdateModal(false);
        setIncidentUpdateMessage('');
        await fetchStatusPageIncidents(selectedStatusPageForIncident.id);
      } else {
        toast.error('Failed to post update');
      }
    } catch (error) {
      logger.error('Failed to post update:', error);
      toast.error('Failed to post update');
    } finally {
      setIsSubmittingIncident(false);
    }
  }, [token, selectedStatusPageForIncident, editingIncident, incidentStatus, incidentUpdateMessage, fetchStatusPageIncidents]);

  // Fetch on-call schedules
  const fetchOnCallSchedules = useCallback(async () => {
    setIsLoadingOnCallSchedules(true);
    try {
      const response = await fetch('/api/v1/monitoring/on-call-schedules', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setOnCallSchedules(data.schedules || []);
      }
    } catch (error) {
      logger.error('Failed to fetch on-call schedules:', error);
    } finally {
      setIsLoadingOnCallSchedules(false);
    }
  }, [token]);

  // Delete on-call schedule
  const deleteOnCallSchedule = useCallback(async (scheduleId: string) => {
    try {
      const response = await fetch(`/api/v1/monitoring/on-call-schedules/${scheduleId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        toast.success('Schedule deleted');
        await fetchOnCallSchedules();
      } else {
        toast.error('Failed to delete schedule');
      }
    } catch (error) {
      logger.error('Failed to delete schedule:', error);
      toast.error('Failed to delete schedule');
    }
  }, [token, fetchOnCallSchedules]);

  // Rotate on-call schedule
  const rotateOnCallSchedule = useCallback(async (scheduleId: string) => {
    try {
      const response = await fetch(`/api/v1/monitoring/on-call-schedules/${scheduleId}/rotate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        toast.success('Schedule rotated');
        await fetchOnCallSchedules();
      } else {
        toast.error('Failed to rotate schedule');
      }
    } catch (error) {
      logger.error('Failed to rotate schedule:', error);
      toast.error('Failed to rotate schedule');
    }
  }, [token, fetchOnCallSchedules]);

  // Submit on-call schedule
  const submitOnCallSchedule = useCallback(async () => {
    setIsSubmittingOnCallSchedule(true);
    try {
      const url = editingOnCallSchedule
        ? `/api/v1/monitoring/on-call-schedules/${editingOnCallSchedule.id}`
        : '/api/v1/monitoring/on-call-schedules';
      const method = editingOnCallSchedule ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: onCallScheduleName,
          description: onCallScheduleDescription,
          timezone: onCallScheduleTimezone,
          rotation_type: onCallScheduleRotationType,
          rotation_interval_days: onCallScheduleRotationInterval,
          members: onCallScheduleMembers,
        }),
      });

      if (response.ok) {
        toast.success(editingOnCallSchedule ? 'Schedule updated' : 'Schedule created');
        setShowOnCallModal(false);
        await fetchOnCallSchedules();
      } else {
        toast.error('Failed to save schedule');
      }
    } catch (error) {
      logger.error('Failed to save schedule:', error);
      toast.error('Failed to save schedule');
    } finally {
      setIsSubmittingOnCallSchedule(false);
    }
  }, [
    token, editingOnCallSchedule, onCallScheduleName, onCallScheduleDescription,
    onCallScheduleTimezone, onCallScheduleRotationType, onCallScheduleRotationInterval,
    onCallScheduleMembers, fetchOnCallSchedules
  ]);

  // Reset on-call form
  const resetOnCallForm = useCallback(() => {
    setOnCallScheduleName('');
    setOnCallScheduleDescription('');
    setOnCallScheduleTimezone('UTC');
    setOnCallScheduleRotationType('weekly');
    setOnCallScheduleRotationInterval(7);
    setOnCallScheduleMembers([]);
    setEditingOnCallSchedule(null);
    setNewMemberName('');
    setNewMemberEmail('');
    setNewMemberPhone('');
  }, []);

  // Add on-call member
  const addOnCallMember = useCallback(() => {
    if (!newMemberName || !newMemberEmail) {
      toast.error('Name and email are required');
      return;
    }
    const newMember: OnCallMember = {
      id: `temp-${Date.now()}`,
      user_id: `temp-${Date.now()}`,
      user_name: newMemberName,
      user_email: newMemberEmail,
      phone: newMemberPhone || undefined,
      order: onCallScheduleMembers.length,
    };
    setOnCallScheduleMembers([...onCallScheduleMembers, newMember]);
    setNewMemberName('');
    setNewMemberEmail('');
    setNewMemberPhone('');
  }, [newMemberName, newMemberEmail, newMemberPhone, onCallScheduleMembers]);

  // Remove on-call member
  const removeOnCallMember = useCallback((index: number) => {
    setOnCallScheduleMembers(onCallScheduleMembers.filter((_, i) => i !== index));
  }, [onCallScheduleMembers]);

  // Fetch escalation policies
  const fetchEscalationPolicies = useCallback(async () => {
    setIsLoadingEscalationPolicies(true);
    try {
      const response = await fetch('/api/v1/monitoring/escalation-policies', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setEscalationPolicies(data.policies || []);
      }
    } catch (error) {
      logger.error('Failed to fetch escalation policies:', error);
    } finally {
      setIsLoadingEscalationPolicies(false);
    }
  }, [token]);

  // Delete escalation policy
  const deleteEscalationPolicy = useCallback(async (policyId: string) => {
    try {
      const response = await fetch(`/api/v1/monitoring/escalation-policies/${policyId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        toast.success('Policy deleted');
        await fetchEscalationPolicies();
      } else {
        toast.error('Failed to delete policy');
      }
    } catch (error) {
      logger.error('Failed to delete policy:', error);
      toast.error('Failed to delete policy');
    }
  }, [token, fetchEscalationPolicies]);

  // Test escalation policy
  const testEscalationPolicy = useCallback(async (policyId: string) => {
    try {
      const response = await fetch(`/api/v1/monitoring/escalation-policies/${policyId}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        toast.success('Test alert sent');
      } else {
        toast.error('Failed to send test alert');
      }
    } catch (error) {
      logger.error('Failed to test policy:', error);
      toast.error('Failed to send test alert');
    }
  }, [token]);

  // Fetch alert grouping rules
  const fetchAlertGroupingRules = useCallback(async () => {
    setIsLoadingAlertGrouping(true);
    try {
      const response = await fetch('/api/v1/monitoring/alert-grouping', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setAlertGroupingRules(data.rules || []);
        setAlertGroups(data.groups || []);
      }
    } catch (error) {
      logger.error('Failed to fetch alert grouping:', error);
    } finally {
      setIsLoadingAlertGrouping(false);
    }
  }, [token]);

  // Delete alert grouping rule
  const deleteAlertGroupingRule = useCallback(async (ruleId: string) => {
    try {
      const response = await fetch(`/api/v1/monitoring/alert-grouping/rules/${ruleId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        toast.success('Rule deleted');
        await fetchAlertGroupingRules();
      } else {
        toast.error('Failed to delete rule');
      }
    } catch (error) {
      logger.error('Failed to delete rule:', error);
      toast.error('Failed to delete rule');
    }
  }, [token, fetchAlertGroupingRules]);

  // Simulate alert grouping
  const simulateAlertGrouping = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/monitoring/alert-grouping/simulate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        toast.success('Grouping simulation complete');
        await fetchAlertGroupingRules();
      } else {
        toast.error('Failed to simulate grouping');
      }
    } catch (error) {
      logger.error('Failed to simulate:', error);
      toast.error('Failed to simulate grouping');
    }
  }, [token, fetchAlertGroupingRules]);

  // Alert group actions
  const acknowledgeAlertGroup = useCallback(async (groupId: string) => {
    try {
      const response = await fetch(`/api/v1/monitoring/alert-grouping/groups/${groupId}/acknowledge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        toast.success('Group acknowledged');
        await fetchAlertGroupingRules();
      } else {
        toast.error('Failed to acknowledge group');
      }
    } catch (error) {
      logger.error('Failed to acknowledge:', error);
      toast.error('Failed to acknowledge group');
    }
  }, [token, fetchAlertGroupingRules]);

  const resolveAlertGroup = useCallback(async (groupId: string) => {
    try {
      const response = await fetch(`/api/v1/monitoring/alert-grouping/groups/${groupId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        toast.success('Group resolved');
        await fetchAlertGroupingRules();
      } else {
        toast.error('Failed to resolve group');
      }
    } catch (error) {
      logger.error('Failed to resolve:', error);
      toast.error('Failed to resolve group');
    }
  }, [token, fetchAlertGroupingRules]);

  const snoozeAlertGroup = useCallback(async (groupId: string, hours: number) => {
    try {
      const response = await fetch(`/api/v1/monitoring/alert-grouping/groups/${groupId}/snooze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ hours }),
      });
      if (response.ok) {
        toast.success(`Group snoozed for ${hours} hours`);
        await fetchAlertGroupingRules();
      } else {
        toast.error('Failed to snooze group');
      }
    } catch (error) {
      logger.error('Failed to snooze:', error);
      toast.error('Failed to snooze group');
    }
  }, [token, fetchAlertGroupingRules]);

  // Fetch alert routing rules
  const fetchAlertRoutingRules = useCallback(async () => {
    setIsLoadingAlertRouting(true);
    try {
      const response = await fetch('/api/v1/monitoring/alert-routing', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setAlertRoutingRules(data.rules || []);
        setAlertRoutingLogs(data.logs || []);
      }
    } catch (error) {
      logger.error('Failed to fetch alert routing:', error);
    } finally {
      setIsLoadingAlertRouting(false);
    }
  }, [token]);

  // Delete alert routing rule
  const deleteAlertRoutingRule = useCallback(async (ruleId: string) => {
    try {
      const response = await fetch(`/api/v1/monitoring/alert-routing/rules/${ruleId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        toast.success('Rule deleted');
        await fetchAlertRoutingRules();
      } else {
        toast.error('Failed to delete rule');
      }
    } catch (error) {
      logger.error('Failed to delete rule:', error);
      toast.error('Failed to delete rule');
    }
  }, [token, fetchAlertRoutingRules]);

  // Toggle alert routing rule
  const toggleAlertRoutingRule = useCallback(async (ruleId: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/v1/monitoring/alert-routing/rules/${ruleId}/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ enabled }),
      });
      if (response.ok) {
        toast.success(enabled ? 'Rule enabled' : 'Rule disabled');
        await fetchAlertRoutingRules();
      } else {
        toast.error('Failed to toggle rule');
      }
    } catch (error) {
      logger.error('Failed to toggle rule:', error);
      toast.error('Failed to toggle rule');
    }
  }, [token, fetchAlertRoutingRules]);

  // Rate limit functions
  const testRateLimit = useCallback(async () => {
    setIsTestingRateLimit(true);
    try {
      const response = await fetch('/api/v1/monitoring/alert-rate-limit/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ alert_count: 10 }),
      });
      const data = await response.json();
      if (response.ok) {
        setRateLimitStats(data.stats);
        toast.success(`Test complete: ${data.sent} sent, ${data.suppressed} suppressed`);
      } else {
        toast.error('Rate limit test failed');
      }
    } catch (error) {
      logger.error('Failed to test rate limiting:', error);
      toast.error('Failed to test rate limiting');
    } finally {
      setIsTestingRateLimit(false);
    }
  }, [token]);

  const saveRateLimitConfig = useCallback(async () => {
    setIsSavingRateLimit(true);
    try {
      const response = await fetch('/api/v1/monitoring/alert-rate-limit/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(alertRateLimitConfig),
      });
      if (response.ok) {
        toast.success('Rate limit settings saved');
      } else {
        toast.error('Failed to save rate limit settings');
      }
    } catch (error) {
      logger.error('Failed to save rate limit settings:', error);
      toast.error('Failed to save rate limit settings');
    } finally {
      setIsSavingRateLimit(false);
    }
  }, [token, alertRateLimitConfig]);

  // Alert correlation
  const acknowledgeCorrelation = useCallback(async (correlationId: string) => {
    try {
      const response = await fetch(`/api/v1/monitoring/alert-correlation/${correlationId}/acknowledge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        toast.success('Correlation acknowledged');
        // Refresh correlations
      } else {
        toast.error('Failed to acknowledge');
      }
    } catch (error) {
      logger.error('Failed to acknowledge:', error);
      toast.error('Failed to acknowledge');
    }
  }, [token]);

  // Fetch runbooks
  const fetchAlertRunbooks = useCallback(async () => {
    setIsLoadingRunbooks(true);
    try {
      const response = await fetch('/api/v1/monitoring/runbooks', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setAlertRunbooks(data.runbooks || []);
      }
    } catch (error) {
      logger.error('Failed to fetch runbooks:', error);
    } finally {
      setIsLoadingRunbooks(false);
    }
  }, [token]);

  // Delete runbook
  const deleteRunbook = useCallback(async (runbookId: string) => {
    try {
      const response = await fetch(`/api/v1/monitoring/runbooks/${runbookId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        toast.success('Runbook deleted');
        await fetchAlertRunbooks();
      } else {
        toast.error('Failed to delete runbook');
      }
    } catch (error) {
      logger.error('Failed to delete runbook:', error);
      toast.error('Failed to delete runbook');
    }
  }, [token, fetchAlertRunbooks]);

  // Test runbook
  const testRunbook = useCallback(async (runbookId: string) => {
    try {
      const response = await fetch(`/api/v1/monitoring/runbooks/${runbookId}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        toast.success('Runbook test complete');
      } else {
        toast.error('Failed to test runbook');
      }
    } catch (error) {
      logger.error('Failed to test runbook:', error);
      toast.error('Failed to test runbook');
    }
  }, [token]);

  // Fetch managed incidents
  const fetchManagedIncidents = useCallback(async () => {
    setIsLoadingManagedIncidents(true);
    try {
      const response = await fetch('/api/v1/monitoring/incidents', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setManagedIncidents(data.incidents || []);
      }
    } catch (error) {
      logger.error('Failed to fetch incidents:', error);
    } finally {
      setIsLoadingManagedIncidents(false);
    }
  }, [token]);

  // Update managed incident status
  const updateManagedIncidentStatus = useCallback(async (incidentId: string, newStatus: ManagedIncident['status']) => {
    try {
      const response = await fetch(`/api/v1/monitoring/incidents/${incidentId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (response.ok) {
        toast.success('Incident status updated');
        await fetchManagedIncidents();
      } else {
        toast.error('Failed to update incident');
      }
    } catch (error) {
      logger.error('Failed to update incident:', error);
      toast.error('Failed to update incident');
    }
  }, [token, fetchManagedIncidents]);

  // Assign managed responder
  const assignManagedResponder = useCallback(async (incidentId: string) => {
    try {
      const response = await fetch(`/api/v1/monitoring/incidents/${incidentId}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        toast.success('Responder assigned');
        await fetchManagedIncidents();
      } else {
        toast.error('Failed to assign responder');
      }
    } catch (error) {
      logger.error('Failed to assign responder:', error);
      toast.error('Failed to assign responder');
    }
  }, [token, fetchManagedIncidents]);

  // Resolve managed incident
  const resolveManagedIncident = useCallback(async (incidentId: string) => {
    try {
      const response = await fetch(`/api/v1/monitoring/incidents/${incidentId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        toast.success('Incident resolved');
        await fetchManagedIncidents();
      } else {
        toast.error('Failed to resolve incident');
      }
    } catch (error) {
      logger.error('Failed to resolve incident:', error);
      toast.error('Failed to resolve incident');
    }
  }, [token, fetchManagedIncidents]);

  // Fetch alert history
  const fetchAlertHistory = useCallback(async () => {
    setIsLoadingAlertHistory(true);
    try {
      const params = new URLSearchParams();
      if (alertHistorySeverityFilter !== 'all') params.set('severity', alertHistorySeverityFilter);
      if (alertHistorySourceFilter !== 'all') params.set('source', alertHistorySourceFilter);

      const response = await fetch(`/api/v1/monitoring/alert-history?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setAlertHistory(data.alerts || []);
        setAlertHistoryStats(data.stats || null);
        setAlertsOverTime(data.over_time || []);
      }
    } catch (error) {
      logger.error('Failed to fetch alert history:', error);
    } finally {
      setIsLoadingAlertHistory(false);
    }
  }, [token, alertHistorySeverityFilter, alertHistorySourceFilter]);

  return {
    // Retention settings
    monitoringSettings,
    retentionStats,
    isLoadingSettings,
    isSavingSettings,
    isRunningCleanup,
    settingsRetentionDays,
    settingsAutoCleanup,
    setSettingsRetentionDays,
    setSettingsAutoCleanup,
    saveMonitoringSettings,
    runRetentionCleanup,
    fetchMonitoringSettings,

    // Status pages
    statusPages,
    availableChecksForStatus,
    isLoadingStatusPages,
    fetchStatusPages,
    deleteStatusPage,
    statusPageIncidents,
    isLoadingStatusPageIncidents,
    fetchStatusPageIncidents,

    // Status page form
    showStatusPageModal,
    setShowStatusPageModal,
    editingStatusPage,
    setEditingStatusPage,
    statusPageName,
    setStatusPageName,
    statusPageSlug,
    setStatusPageSlug,
    statusPageDescription,
    setStatusPageDescription,
    statusPageColor,
    setStatusPageColor,
    statusPageIsPublic,
    setStatusPageIsPublic,
    statusPageShowUptime,
    setStatusPageShowUptime,
    statusPageShowResponseTime,
    setStatusPageShowResponseTime,
    statusPageShowIncidents,
    setStatusPageShowIncidents,
    statusPageSelectedChecks,
    setStatusPageSelectedChecks,
    isSubmittingStatusPage,
    submitStatusPage,
    resetStatusPageForm,

    // Status page incident form
    showIncidentModal,
    setShowIncidentModal,
    showIncidentUpdateModal,
    setShowIncidentUpdateModal,
    selectedStatusPageForIncident,
    setSelectedStatusPageForIncident,
    editingIncident,
    setEditingIncident,
    incidentTitle,
    setIncidentTitle,
    incidentStatus,
    setIncidentStatus,
    incidentImpact,
    setIncidentImpact,
    incidentUpdateMessage,
    setIncidentUpdateMessage,
    isSubmittingIncident,
    submitIncident,
    submitIncidentUpdate,

    // On-call schedules
    onCallSchedules,
    isLoadingOnCallSchedules,
    fetchOnCallSchedules,
    deleteOnCallSchedule,
    rotateOnCallSchedule,

    // On-call form
    showOnCallModal,
    setShowOnCallModal,
    editingOnCallSchedule,
    setEditingOnCallSchedule,
    onCallScheduleName,
    setOnCallScheduleName,
    onCallScheduleDescription,
    setOnCallScheduleDescription,
    onCallScheduleTimezone,
    setOnCallScheduleTimezone,
    onCallScheduleRotationType,
    setOnCallScheduleRotationType,
    onCallScheduleRotationInterval,
    setOnCallScheduleRotationInterval,
    onCallScheduleMembers,
    setOnCallScheduleMembers,
    isSubmittingOnCallSchedule,
    submitOnCallSchedule,
    resetOnCallForm,
    newMemberName,
    setNewMemberName,
    newMemberEmail,
    setNewMemberEmail,
    newMemberPhone,
    setNewMemberPhone,
    addOnCallMember,
    removeOnCallMember,

    // Escalation policies
    escalationPolicies,
    isLoadingEscalationPolicies,
    fetchEscalationPolicies,
    deleteEscalationPolicy,
    testEscalationPolicy,

    // Alert grouping
    alertGroupingRules,
    alertGroups,
    isLoadingAlertGrouping,
    fetchAlertGroupingRules,
    deleteAlertGroupingRule,
    simulateAlertGrouping,
    acknowledgeAlertGroup,
    resolveAlertGroup,
    snoozeAlertGroup,

    // Alert grouping form
    showAlertGroupingModal,
    setShowAlertGroupingModal,
    editingAlertGroupingRule,
    setEditingAlertGroupingRule,

    // Alert routing
    alertRoutingRules,
    alertRoutingLogs,
    isLoadingAlertRouting,
    fetchAlertRoutingRules,
    deleteAlertRoutingRule,
    toggleAlertRoutingRule,

    // Alert routing form
    showAlertRoutingModal,
    setShowAlertRoutingModal,
    editingAlertRoutingRule,
    setEditingAlertRoutingRule,

    // Severity mapping
    globalSeverityMapping,
    setGlobalSeverityMapping,

    // Rate limiting
    alertRateLimitConfig,
    setAlertRateLimitConfig,
    rateLimitStats,
    isTestingRateLimit,
    isSavingRateLimit,
    testRateLimit,
    saveRateLimitConfig,

    // Alert correlation
    alertCorrelationConfig,
    setAlertCorrelationConfig,
    alertCorrelations,
    acknowledgeCorrelation,

    // Runbooks
    alertRunbooks,
    isLoadingRunbooks,
    fetchAlertRunbooks,
    deleteRunbook,
    testRunbook,

    // Managed incidents
    managedIncidents,
    isLoadingManagedIncidents,
    fetchManagedIncidents,
    updateManagedIncidentStatus,
    assignManagedResponder,
    resolveManagedIncident,

    // Managed incident form
    showManagedIncidentModal,
    setShowManagedIncidentModal,
    editingManagedIncident,
    setEditingManagedIncident,

    // Alert history
    alertHistory,
    alertHistoryStats,
    alertsOverTime,
    isLoadingAlertHistory,
    alertHistorySeverityFilter,
    alertHistorySourceFilter,
    setAlertHistorySeverityFilter,
    setAlertHistorySourceFilter,
    showAlertHistorySection,
    setShowAlertHistorySection,
    fetchAlertHistory,
  };
}
