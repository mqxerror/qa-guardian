// MonitoringPage - Extracted from App.tsx (Feature #1441)
// Feature #75: Migrated summary to React Query with caching
// Synthetic monitoring: uptime checks, transaction monitoring, performance testing
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { useAuthStore } from "../stores/authStore";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { toast } from "../stores/toastStore";
import { useMonitoringSummary } from "../hooks/api/useMonitoring";
import { devLog } from "../utils/logger";

// Feature #47: Import modular components and types for performance optimization
// Eliminates ~600 lines of duplicate type definitions
import {
  MonitoringSummaryCards,
  StatusBadge,
  UptimeChecksTab,
  SettingsTab,
  TransactionsTab,
  PerformanceTab,
  WebhooksTab,
  CreateCheckModal,
  TransactionModal,
  PerformanceCheckModal,
  WebhookModal,
  AlertRoutingModal,
  EscalationPolicyModal,
  // Feature #47: Import managed incident modals
  CreateManagedIncidentModal,
  ManagedIncidentDetailModal,
  AssignResponderModal,
  ResolveIncidentModal,
  getIncidentStatusColor,
  getIncidentPriorityColor,
  // Feature #47: Import on-call schedule modal
  OnCallScheduleModal,
  // Feature #47: Import status page modals
  StatusPageModal,
  IncidentManagementPanel,
  // Feature #47: Import alert modals
  AlertGroupingModal,
  AlertRoutingTestModal,
  // Feature #47: Import hooks for state management
  useMonitoringSettings,
  useWebhookHandlers,
  useTransactionHandlers,
  usePerformanceHandlers,
  useAlertGroupHandlers,
  useManagedIncidentHandlers,
  useUptimeCheckHandlers,
  // Import types from modular components - Feature #47: Only import types that are used
  type MonitoringLocation,
  type MonitoringLocationInfo,
  type LocationResult,
  type UptimeCheck,
  type CheckResult,
  type MonitoringSummary,
  type WebhookCheck,
  type WebhookEvent,
  type SlaMetrics,
  type IncidentData,
  type HistoryData,
  type MaintenanceData,
  type TransactionCheck,
  type TransactionResult,
  type PerformanceCheck,
  type PerformanceResult,
  type PerformanceTrends,
  type DetailTab,
  type HistoryRange,
  type MonitoringSettings,
  type RetentionStats,
  type StatusPage,
  type AvailableCheck,
  type OnCallSchedule,
  type EscalationPolicy,
  type AlertGroupingRule,
  type AlertGroup,
  type AlertHistoryStats,
  type AlertHistoryItem,
  type AlertsOverTimeData,
  type AlertRoutingRule,
  type AlertRoutingLog,
  type GlobalSeverityMapping,
  type AlertRateLimitConfig,
  type RateLimitStats,
  type AlertCorrelationConfig,
  type AlertCorrelation,
  type AlertRunbook,
  type ManagedIncidentResponder,
  type ManagedIncident,
} from '../components/monitoring';

function MonitoringPage() {
  const { token } = useAuthStore();

  // UI state for modals and tabs that useUptimeCheckHandlers doesn't manage
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCheck, setEditingCheck] = useState<UptimeCheck | null>(null);
  const [showIncidentTab, setShowIncidentTab] = useState(false);
  const [historyRange, setHistoryRange] = useState<HistoryRange>('24h');
  const [activeDetailTab, setActiveDetailTab] = useState<DetailTab>('details');
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [maintenanceName, setMaintenanceName] = useState('');
  const [maintenanceStartTime, setMaintenanceStartTime] = useState('');
  const [maintenanceEndTime, setMaintenanceEndTime] = useState('');
  const [maintenanceReason, setMaintenanceReason] = useState('');

  // Filter state - needed before useUptimeCheckHandlers
  const [filterTag, setFilterTag] = useState<string>('');
  const [filterGroup, setFilterGroup] = useState<string>('');

  // Open edit modal with check data - used by useUptimeCheckHandlers
  const openEditModal = useCallback((check: UptimeCheck) => {
    setEditingCheck(check);
    setShowCreateModal(true);
  }, []);

  // Feature #47: Uptime check state and handlers extracted to useUptimeCheckHandlers hook
  const {
    checks,
    selectedCheck,
    checkResults,
    locationResults,
    slaMetrics,
    incidentData,
    historyData,
    maintenanceData,
    summary,
    availableLocations,
    availableTags,
    availableGroups,
    isLoading,
    isLoadingResults,
    isLoadingSla,
    isLoadingIncidents,
    isLoadingHistory,
    isLoadingMaintenance,
    setChecks,
    setSelectedCheck,
    fetchData,
    fetchCheckResults,
    fetchLocationResults,
    fetchSlaMetrics,
    fetchIncidents,
    fetchHistory,
    fetchMaintenance,
    fetchLocations,
    toggleCheck,
    runCheck,
    deleteCheck,
    duplicateCheck,
    bulkAction,
    createMaintenanceWindow,
    deleteMaintenanceWindow,
  } = useUptimeCheckHandlers(token, filterTag, filterGroup, openEditModal);

  // Feature #75: Use React Query for summary with caching
  // This provides instant load on page revisit while keeping existing hook structure
  const { data: cachedSummary, isLoading: isSummaryLoading } = useMonitoringSummary();
  // Use cached summary if available, otherwise fall back to hook's summary
  const displaySummary = cachedSummary || summary;
  const summaryLoading = isSummaryLoading && isLoading;

  // Tab state
  const [activeTab, setActiveTab] = useState<'checks' | 'transactions' | 'performance' | 'webhooks' | 'dns' | 'tcp' | 'settings'>('checks');

  // Settings state (types imported from monitoring/types.ts)
  const [monitoringSettings, setMonitoringSettings] = useState<MonitoringSettings | null>(null);
  const [retentionStats, setRetentionStats] = useState<RetentionStats | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isRunningCleanup, setIsRunningCleanup] = useState(false);
  const [settingsRetentionDays, setSettingsRetentionDays] = useState<30 | 90 | 365>(90);
  const [settingsAutoCleanup, setSettingsAutoCleanup] = useState(true);

  // Status page state - Feature #47: Form state moved to StatusPageModal component
  const [statusPages, setStatusPages] = useState<StatusPage[]>([]);
  const [availableChecksForStatus, setAvailableChecksForStatus] = useState<AvailableCheck[]>([]);
  const [isLoadingStatusPages, setIsLoadingStatusPages] = useState(false);
  const [showStatusPageModal, setShowStatusPageModal] = useState(false);
  const [editingStatusPage, setEditingStatusPage] = useState<StatusPage | null>(null);

  // Incident management state - Feature #47: Most state moved to IncidentManagementPanel
  const [selectedStatusPageForIncident, setSelectedStatusPageForIncident] = useState<StatusPage | null>(null);

  // On-call schedule state - Feature #47: Form state moved to OnCallScheduleModal
  const [onCallSchedules, setOnCallSchedules] = useState<OnCallSchedule[]>([]);
  const [isLoadingOnCallSchedules, setIsLoadingOnCallSchedules] = useState(false);
  const [showOnCallModal, setShowOnCallModal] = useState(false);
  const [editingOnCallSchedule, setEditingOnCallSchedule] = useState<OnCallSchedule | null>(null);

  // Escalation policy state - Feature #47: Form state moved to EscalationPolicyModal
  const [escalationPolicies, setEscalationPolicies] = useState<EscalationPolicy[]>([]);
  const [isLoadingEscalationPolicies, setIsLoadingEscalationPolicies] = useState(false);
  const [showEscalationPolicyModal, setShowEscalationPolicyModal] = useState(false);
  const [editingEscalationPolicy, setEditingEscalationPolicy] = useState<EscalationPolicy | null>(null);

  // Alert history state (types imported from monitoring/types.ts)
  const [alertHistory, setAlertHistory] = useState<AlertHistoryItem[]>([]);
  const [alertHistoryStats, setAlertHistoryStats] = useState<AlertHistoryStats | null>(null);
  const [alertsOverTime, setAlertsOverTime] = useState<AlertsOverTimeData[]>([]);
  const [isLoadingAlertHistory, setIsLoadingAlertHistory] = useState(false);
  const [alertHistorySeverityFilter, setAlertHistorySeverityFilter] = useState<string>('');
  const [alertHistorySourceFilter, setAlertHistorySourceFilter] = useState<string>('');
  const [showAlertHistorySection, setShowAlertHistorySection] = useState(false);

  // Alert routing state (types imported from monitoring/types.ts)
  const [alertRoutingRules, setAlertRoutingRules] = useState<AlertRoutingRule[]>([]);
  const [alertRoutingLogs, setAlertRoutingLogs] = useState<AlertRoutingLog[]>([]);
  const [isLoadingAlertRouting, setIsLoadingAlertRouting] = useState(false);
  // Alert routing state - Feature #47: Form state moved to AlertRoutingModal
  const [showAlertRoutingModal, setShowAlertRoutingModal] = useState(false);
  const [editingAlertRoutingRule, setEditingAlertRoutingRule] = useState<AlertRoutingRule | null>(null);
  const [showAlertRoutingTest, setShowAlertRoutingTest] = useState(false);

  // Global Alert Severity Mapping state (types imported from monitoring/types.ts)
  const [globalSeverityMapping, setGlobalSeverityMapping] = useState<GlobalSeverityMapping>({
    critical: 'P1',
    high: 'P2',
    medium: 'P3',
    low: 'P4',
    info: 'P5',
  });
  const [isSavingSeverityMapping, setIsSavingSeverityMapping] = useState(false);

  // Alert Rate Limiting state (types imported from monitoring/types.ts)
  const [alertRateLimitConfig, setAlertRateLimitConfig] = useState<AlertRateLimitConfig>({
    enabled: true,
    max_alerts_per_minute: 5,
    time_window_seconds: 60,
    suppression_mode: 'aggregate',
    aggregate_threshold: 10,
  });
  const [isSavingRateLimit, setIsSavingRateLimit] = useState(false);
  const [rateLimitStats, setRateLimitStats] = useState<RateLimitStats | null>(null);
  const [isTestingRateLimit, setIsTestingRateLimit] = useState(false);

  // Alert Correlation state (types imported from monitoring/types.ts)
  const [alertCorrelationConfig, setAlertCorrelationConfig] = useState<AlertCorrelationConfig>({
    enabled: true,
    correlate_by_check: true,
    correlate_by_location: true,
    correlate_by_error_type: true,
    correlate_by_time_window: true,
    time_window_seconds: 300,
    similarity_threshold: 60,
  });
  const [isSavingCorrelation, setIsSavingCorrelation] = useState(false);
  const [alertCorrelations, setAlertCorrelations] = useState<AlertCorrelation[]>([]);
  const [isTestingCorrelation, setIsTestingCorrelation] = useState(false);
  const [selectedCorrelation, setSelectedCorrelation] = useState<AlertCorrelation | null>(null);

  // Alert Runbook state (types imported from monitoring/types.ts)
  const [alertRunbooks, setAlertRunbooks] = useState<AlertRunbook[]>([]);
  const [isLoadingRunbooks, setIsLoadingRunbooks] = useState(false);
  const [showRunbookModal, setShowRunbookModal] = useState(false);
  const [editingRunbook, setEditingRunbook] = useState<AlertRunbook | null>(null);
  const [runbookForm, setRunbookForm] = useState({
    name: '',
    description: '',
    check_type: 'all' as AlertRunbook['check_type'],
    severity: 'all' as AlertRunbook['severity'],
    runbook_url: '',
    instructions: '',
  });
  const [isSavingRunbook, setIsSavingRunbook] = useState(false);
  const [runbookTestResult, setRunbookTestResult] = useState<{
    alert: {
      id: string;
      check_name: string;
      check_type: string;
      severity: string;
      error_message: string;
      runbook: { id: string; name: string; url: string; instructions?: string } | null;
    };
    runbook_found: boolean;
    message: string;
  } | null>(null);

  // Feature #47: Managed incident state and handlers extracted to useManagedIncidentHandlers hook
  const {
    managedIncidents,
    isLoadingManagedIncidents,
    showManagedIncidentModal,
    selectedManagedIncident,
    isSubmittingManagedIncident,
    showManagedIncidentDetailModal,
    showManagedAssignResponderModal,
    showManagedResolveModal,
    setShowManagedIncidentModal,
    setShowManagedIncidentDetailModal,
    setShowManagedAssignResponderModal,
    setShowManagedResolveModal,
    fetchManagedIncidents,
    openManagedIncidentDetail,
    handleUpdateManagedIncidentStatus,
    handleCreateManagedIncidentFromModal,
    handleAddNoteFromModal,
    handleAssignResponderFromModal,
    handleResolveFromModal,
  } = useManagedIncidentHandlers(token);

  // Feature #47: Alert grouping state and handlers extracted to useAlertGroupHandlers hook
  const {
    alertGroupingRules,
    alertGroups,
    isLoadingAlertGrouping,
    showAlertGroupingModal,
    editingAlertGroupingRule,
    setShowAlertGroupingModal,
    setEditingAlertGroupingRule,
    fetchAlertGroupingRules,
    fetchAlertGroups,
    openEditAlertGroupingRule,
    handleDeleteAlertGroupingRule,
    handleSimulateAlertGrouping,
    createIncidentFromAlertGroup,
    acknowledgeAlertGroup,
    resolveAlertGroup,
    snoozeAlertGroup,
    unsnoozeAlertGroup,
  } = useAlertGroupHandlers(token, fetchManagedIncidents);

  // TCP and DNS state removed - infrastructure monitoring, not QA testing

  // Feature #47: Webhook state and handlers extracted to useWebhookHandlers hook
  const {
    webhookChecks,
    selectedWebhook,
    webhookEvents,
    showWebhookModal,
    setSelectedWebhook,
    setShowWebhookModal,
    setWebhookChecks,
    fetchWebhookChecks,
    fetchWebhookEvents,
    sendTestWebhook,
    deleteWebhookCheck,
  } = useWebhookHandlers(token);

  // Feature #47: Transaction state and handlers extracted to useTransactionHandlers hook
  const {
    transactions,
    selectedTransaction,
    transactionResults,
    showTransactionModal,
    isLoadingTxnResults,
    setSelectedTransaction,
    setShowTransactionModal,
    setTransactions,
    fetchTransactions,
    fetchTransactionResults,
    runTransaction,
    deleteTransaction,
  } = useTransactionHandlers(token);

  // Feature #47: Performance state and handlers extracted to usePerformanceHandlers hook
  const {
    performanceChecks,
    selectedPerformance,
    performanceResults,
    performanceTrends,
    showPerformanceModal,
    isLoadingPerfResults,
    setSelectedPerformance,
    setShowPerformanceModal,
    setPerformanceChecks,
    fetchPerformanceChecks,
    fetchPerformanceResults,
    runPerformanceCheck,
    deletePerformanceCheck,
    getPerfStatusBadge,
    getMetricColor,
  } = usePerformanceHandlers(token);

  // DNS/TCP monitoring removed - infrastructure monitoring, not QA testing

  // Fetch monitoring settings
  const fetchMonitoringSettings = useCallback(async () => {
    if (!token) return;
    setIsLoadingSettings(true);
    try {
      const [settingsRes, statsRes] = await Promise.all([
        fetch('/api/v1/monitoring/settings', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/v1/monitoring/settings/stats', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (settingsRes.ok) {
        const settings = await settingsRes.json();
        setMonitoringSettings(settings);
        setSettingsRetentionDays(settings.retention_days);
        setSettingsAutoCleanup(settings.auto_cleanup_enabled);
      }

      if (statsRes.ok) {
        const stats = await statsRes.json();
        setRetentionStats(stats);
      }
    } catch (error) {
      console.error('Failed to fetch monitoring settings:', error);
    } finally {
      setIsLoadingSettings(false);
    }
  }, [token]);

  // Save monitoring settings
  const saveMonitoringSettings = async () => {
    if (!token) return;
    setIsSavingSettings(true);
    try {
      const response = await fetch('/api/v1/monitoring/settings', {
        method: 'PUT',
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
        const data = await response.json();
        setMonitoringSettings(data.settings);
        toast.success('Settings saved successfully');
      } else {
        toast.error('Failed to save settings');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Run retention cleanup
  const runRetentionCleanup = async () => {
    if (!token) return;
    setIsRunningCleanup(true);
    try {
      const response = await fetch('/api/v1/monitoring/settings/cleanup', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Cleanup complete: ${data.cleaned_results.total} results removed`);
        // Refresh stats
        await fetchMonitoringSettings();
      } else {
        toast.error('Failed to run cleanup');
      }
    } catch (error) {
      console.error('Failed to run cleanup:', error);
      toast.error('Failed to run cleanup');
    } finally {
      setIsRunningCleanup(false);
    }
  };

  // Fetch status pages
  const fetchStatusPages = useCallback(async () => {
    if (!token) return;
    setIsLoadingStatusPages(true);
    try {
      const [pagesRes, checksRes] = await Promise.all([
        fetch('/api/v1/monitoring/status-pages', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/v1/monitoring/status-pages/available-checks', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (pagesRes.ok) {
        const data = await pagesRes.json();
        setStatusPages(data.status_pages || []);
      }

      if (checksRes.ok) {
        const data = await checksRes.json();
        setAvailableChecksForStatus(data.checks || []);
      }
    } catch (error) {
      console.error('Failed to fetch status pages:', error);
    } finally {
      setIsLoadingStatusPages(false);
    }
  }, [token]);

  // Delete status page
  const handleDeleteStatusPage = async (pageId: string) => {
    if (!token || !confirm('Are you sure you want to delete this status page?')) return;

    try {
      const response = await fetch(`/api/v1/monitoring/status-pages/${pageId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        toast.success('Status page deleted');
        fetchStatusPages();
      } else {
        toast.error('Failed to delete status page');
      }
    } catch (error) {
      console.error('Failed to delete status page:', error);
      toast.error('Failed to delete status page');
    }
  };

  // Open edit status page modal - Feature #47: Form state moved to component
  const openEditStatusPage = (page: StatusPage) => {
    setEditingStatusPage(page);
    setShowStatusPageModal(true);
  };

  // Open incident management for a status page - Feature #47: Incidents handled by component
  const openIncidentManagement = (page: StatusPage) => {
    setSelectedStatusPageForIncident(page);
  };

  // Fetch on-call schedules
  const fetchOnCallSchedules = useCallback(async () => {
    if (!token) return;
    setIsLoadingOnCallSchedules(true);
    try {
      const response = await fetch('/api/v1/monitoring/on-call', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setOnCallSchedules(data.schedules || []);
      }
    } catch (error) {
      console.error('Failed to fetch on-call schedules:', error);
    } finally {
      setIsLoadingOnCallSchedules(false);
    }
  }, [token]);

  // Open edit on-call schedule modal - Feature #47: Form state moved to component
  const openEditOnCallSchedule = (schedule: OnCallSchedule) => {
    setEditingOnCallSchedule(schedule);
    setShowOnCallModal(true);
  };

  // Delete on-call schedule
  const handleDeleteOnCallSchedule = async (scheduleId: string) => {
    if (!token || !confirm('Are you sure you want to delete this on-call schedule?')) return;

    try {
      const response = await fetch(`/api/v1/monitoring/on-call/${scheduleId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        toast.success('On-call schedule deleted');
        fetchOnCallSchedules();
      } else {
        toast.error('Failed to delete on-call schedule');
      }
    } catch (error) {
      console.error('Failed to delete on-call schedule:', error);
      toast.error('Failed to delete on-call schedule');
    }
  };

  // Rotate on-call schedule manually
  const handleRotateOnCallSchedule = async (scheduleId: string) => {
    if (!token) return;

    try {
      const response = await fetch(`/api/v1/monitoring/on-call/${scheduleId}/rotate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        toast.success('On-call rotation advanced');
        fetchOnCallSchedules();
      } else {
        toast.error('Failed to rotate on-call schedule');
      }
    } catch (error) {
      console.error('Failed to rotate on-call schedule:', error);
      toast.error('Failed to rotate on-call schedule');
    }
  };

  // Fetch escalation policies
  const fetchEscalationPolicies = useCallback(async () => {
    if (!token) return;
    setIsLoadingEscalationPolicies(true);
    try {
      const response = await fetch('/api/v1/monitoring/escalation-policies', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setEscalationPolicies(data.policies || []);
      }
    } catch (error) {
      console.error('Failed to fetch escalation policies:', error);
    } finally {
      setIsLoadingEscalationPolicies(false);
    }
  }, [token]);

  // Feature #47: Form state moved to EscalationPolicyModal - only need simple open/close
  const openEditEscalationPolicy = (policy: EscalationPolicy) => {
    setEditingEscalationPolicy(policy);
    setShowEscalationPolicyModal(true);
  };

  // Delete escalation policy
  const handleDeleteEscalationPolicy = async (policyId: string) => {
    if (!token || !confirm('Are you sure you want to delete this escalation policy?')) return;

    try {
      const response = await fetch(`/api/v1/monitoring/escalation-policies/${policyId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        toast.success('Escalation policy deleted');
        fetchEscalationPolicies();
      } else {
        toast.error('Failed to delete escalation policy');
      }
    } catch (error) {
      console.error('Failed to delete escalation policy:', error);
      toast.error('Failed to delete escalation policy');
    }
  };

  // Test escalation policy
  const handleTestEscalationPolicy = async (policyId: string) => {
    if (!token) return;

    try {
      const response = await fetch(`/api/v1/monitoring/escalation-policies/${policyId}/test`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Escalation test completed: ${data.escalation_flow.length} levels`);
        devLog('[Escalation Test]', data);
      } else {
        toast.error('Failed to test escalation policy');
      }
    } catch (error) {
      console.error('Failed to test escalation policy:', error);
      toast.error('Failed to test escalation policy');
    }
  };

  // Feature #47: fetchAlertGroupingRules and fetchAlertGroups moved to useAlertGroupHandlers hook

  // Fetch alert history with statistics
  const fetchAlertHistory = useCallback(async () => {
    if (!token) return;
    setIsLoadingAlertHistory(true);
    try {
      const params = new URLSearchParams();
      if (alertHistorySeverityFilter) params.append('severity', alertHistorySeverityFilter);
      if (alertHistorySourceFilter) params.append('source', alertHistorySourceFilter);

      const response = await fetch(`/api/v1/monitoring/alert-history?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setAlertHistory(data.alerts || []);
        setAlertHistoryStats(data.stats || null);
        setAlertsOverTime(data.alerts_over_time || []);
      }
    } catch (error) {
      console.error('Failed to fetch alert history:', error);
    } finally {
      setIsLoadingAlertHistory(false);
    }
  }, [token, alertHistorySeverityFilter, alertHistorySourceFilter]);

  // Export alert history
  const exportAlertHistory = async (format: 'csv' | 'json') => {
    if (!token) return;
    try {
      const params = new URLSearchParams();
      if (alertHistorySeverityFilter) params.append('severity', alertHistorySeverityFilter);
      if (alertHistorySourceFilter) params.append('source', alertHistorySourceFilter);
      params.append('format', format);

      const response = await fetch(`/api/v1/monitoring/alert-history/export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `alert-history.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast.success(`Alert history exported as ${format.toUpperCase()}`);
      } else {
        toast.error('Failed to export alert history');
      }
    } catch (error) {
      console.error('Failed to export alert history:', error);
      toast.error('Failed to export alert history');
    }
  };

  // Feature #47: openEditAlertGroupingRule, handleDeleteAlertGroupingRule, handleSimulateAlertGrouping
  // moved to useAlertGroupHandlers hook

  // Fetch alert routing rules
  const fetchAlertRoutingRules = useCallback(async () => {
    if (!token) return;
    setIsLoadingAlertRouting(true);
    try {
      const response = await fetch('/api/v1/monitoring/alert-routing/rules', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setAlertRoutingRules(data.rules || []);
      }
    } catch (error) {
      console.error('Failed to fetch alert routing rules:', error);
    } finally {
      setIsLoadingAlertRouting(false);
    }
  }, [token]);

  // Fetch alert routing logs
  const fetchAlertRoutingLogs = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch('/api/v1/monitoring/alert-routing/logs', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setAlertRoutingLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Failed to fetch alert routing logs:', error);
    }
  }, [token]);

  // Feature #47: Form state moved to AlertRoutingModal - only need simple open/close
  const openEditAlertRoutingRule = (rule: AlertRoutingRule) => {
    setEditingAlertRoutingRule(rule);
    setShowAlertRoutingModal(true);
  };

  // Delete alert routing rule
  const handleDeleteAlertRoutingRule = async (ruleId: string) => {
    if (!token || !confirm('Are you sure you want to delete this alert routing rule?')) return;

    try {
      const response = await fetch(`/api/v1/monitoring/alert-routing/rules/${ruleId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        toast.success('Alert routing rule deleted');
        fetchAlertRoutingRules();
      } else {
        toast.error('Failed to delete alert routing rule');
      }
    } catch (error) {
      console.error('Failed to delete alert routing rule:', error);
      toast.error('Failed to delete alert routing rule');
    }
  };

  // Feature #47: Alert routing condition/destination functions moved to AlertRoutingModal
  // Feature #47: fetchManagedIncidents moved to useManagedIncidentHandlers hook
  // Feature #47: createIncidentFromAlertGroup, acknowledgeAlertGroup, resolveAlertGroup,
  // snoozeAlertGroup, unsnoozeAlertGroup moved to useAlertGroupHandlers hook
  // Feature #47: All managed incident handlers moved to useManagedIncidentHandlers hook
  // Feature #47: All performance handlers moved to usePerformanceHandlers hook
  // Feature #47: fetchLocations, fetchLocationResults, fetchData moved to useUptimeCheckHandlers hook

  useEffect(() => {
    fetchData();
    fetchTransactions();
    fetchPerformanceChecks();
    fetchWebhookChecks();
    fetchLocations();
    // Refresh data every 30 seconds
    const interval = setInterval(() => {
      fetchData();
      fetchTransactions();
      fetchPerformanceChecks();
      fetchWebhookChecks();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchData, fetchTransactions, fetchPerformanceChecks, fetchWebhookChecks, fetchLocations]);

  // DNS and TCP selection effects removed - infrastructure monitoring, not QA testing

  // Fetch transaction results when a transaction is selected
  useEffect(() => {
    if (selectedTransaction) {
      fetchTransactionResults(selectedTransaction.id);
    }
  }, [selectedTransaction, fetchTransactionResults]);

  // Fetch performance results when a performance check is selected
  useEffect(() => {
    if (selectedPerformance) {
      fetchPerformanceResults(selectedPerformance.id);
    }
  }, [selectedPerformance, fetchPerformanceResults]);

  // Feature #47: Uptime check functions moved to useUptimeCheckHandlers hook
  // Local wrapper for createMaintenanceWindow to use local form state
  const handleCreateMaintenanceWindow = async () => {
    if (!selectedCheck) return;
    if (!maintenanceName || !maintenanceStartTime || !maintenanceEndTime) {
      alert('Please fill in all required fields');
      return;
    }
    await createMaintenanceWindow(selectedCheck.id, {
      name: maintenanceName,
      start_time: maintenanceStartTime,
      end_time: maintenanceEndTime,
      reason: maintenanceReason || undefined,
    });
    setShowMaintenanceModal(false);
    setMaintenanceName('');
    setMaintenanceStartTime('');
    setMaintenanceEndTime('');
    setMaintenanceReason('');
  };

  // Local wrapper for deleteMaintenanceWindow to use selected check
  const handleDeleteMaintenanceWindow = async (windowId: string) => {
    if (!selectedCheck) return;
    await deleteMaintenanceWindow(selectedCheck.id, windowId);
  };

  // Fetch check details when selected
  useEffect(() => {
    if (selectedCheck) {
      fetchCheckResults(selectedCheck.id);
      fetchLocationResults(selectedCheck.id);
      fetchSlaMetrics(selectedCheck.id);
      fetchIncidents(selectedCheck.id);
      fetchHistory(selectedCheck.id, historyRange as HistoryRange);
      fetchMaintenance(selectedCheck.id);
      setActiveDetailTab('details');
    }
  }, [selectedCheck, fetchCheckResults, fetchLocationResults, fetchSlaMetrics, fetchIncidents, fetchHistory, fetchMaintenance]);

  // Fetch history data when range changes
  useEffect(() => {
    if (selectedCheck) {
      fetchHistory(selectedCheck.id, historyRange as HistoryRange);
    }
  }, [historyRange, selectedCheck, fetchHistory]);

  const getStatusBadge = (status: string | undefined) => {
    switch (status) {
      case 'up':
        return <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">🟢 Up</span>;
      case 'down':
        return <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">🔴 Down</span>;
      case 'degraded':
        return <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-700">🟡 Degraded</span>;
      default:
        return <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">⚪ Unknown</span>;
    }
  };

  return (
    <Layout>
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Synthetic Monitoring</h1>
            <p className="text-muted-foreground">Monitor uptime and performance of your endpoints</p>
          </div>
          {activeTab !== 'settings' && (
            <button
              onClick={() => {
                if (activeTab === 'checks') setShowCreateModal(true);
                else if (activeTab === 'transactions') setShowTransactionModal(true);
                else if (activeTab === 'webhooks') setShowWebhookModal(true);
                else setShowPerformanceModal(true);
              }}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              {activeTab === 'checks' ? 'Create Check' : activeTab === 'transactions' ? 'Create Transaction' : activeTab === 'webhooks' ? 'Create Webhook' : 'Create Performance Check'}
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-border">
          <nav className="-mb-px flex gap-4">
            <button
              onClick={() => setActiveTab('checks')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'checks'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Uptime Checks ({checks.length})
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'transactions'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Transactions ({transactions.length})
            </button>
            <button
              onClick={() => setActiveTab('performance')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'performance'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Performance ({performanceChecks.length})
            </button>
            <button
              onClick={() => setActiveTab('webhooks')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'webhooks'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Webhooks ({webhookChecks.length})
            </button>
            {/* DNS and TCP tabs removed - infrastructure monitoring, not QA testing */}
            <button
              onClick={() => {
                setActiveTab('settings');
                fetchMonitoringSettings();
                fetchStatusPages();
                fetchOnCallSchedules();
                fetchEscalationPolicies();
                fetchAlertGroupingRules();
                fetchAlertGroups();
                fetchAlertRoutingRules();
                fetchAlertRoutingLogs();
                fetchManagedIncidents();
              }}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'settings'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              ⚙️ Settings
            </button>
          </nav>
        </div>

        {/* Summary Cards - Using modular component (Feature #47) */}
        {/* Feature #75: Using React Query cached summary for instant load */}
        <MonitoringSummaryCards summary={displaySummary} isLoading={summaryLoading} />

        {/* Uptime Checks Tab Content - Using modular component (Feature #47) */}
        {activeTab === 'checks' && (
          <UptimeChecksTab
            // Data
            checks={checks}
            selectedCheck={selectedCheck}
            checkResults={checkResults}
            locationResults={locationResults}
            slaMetrics={slaMetrics}
            incidentData={incidentData}
            historyData={historyData}
            maintenanceData={maintenanceData}
            // Loading states
            isLoading={isLoading}
            isLoadingResults={isLoadingResults}
            isLoadingSla={isLoadingSla}
            isLoadingIncidents={isLoadingIncidents}
            isLoadingHistory={isLoadingHistory}
            isLoadingMaintenance={isLoadingMaintenance}
            // Filters
            availableTags={availableTags}
            availableGroups={availableGroups}
            filterTag={filterTag}
            filterGroup={filterGroup}
            setFilterTag={setFilterTag}
            setFilterGroup={setFilterGroup}
            // Detail tab state
            activeDetailTab={activeDetailTab}
            setActiveDetailTab={setActiveDetailTab}
            historyRange={historyRange}
            setHistoryRange={setHistoryRange}
            // Actions
            setSelectedCheck={setSelectedCheck}
            setShowCreateModal={setShowCreateModal}
            setShowMaintenanceModal={setShowMaintenanceModal}
            runCheck={runCheck}
            toggleCheck={toggleCheck}
            deleteCheck={deleteCheck}
            duplicateCheck={duplicateCheck}
            openEditModal={openEditModal}
            bulkAction={bulkAction}
            deleteMaintenanceWindow={handleDeleteMaintenanceWindow}
            getStatusBadge={getStatusBadge}
          />
        )}
        {/* Transactions Tab Content - Using modular component (Feature #47) */}
        {activeTab === 'transactions' && (
          <TransactionsTab
            transactions={transactions}
            selectedTransaction={selectedTransaction}
            transactionResults={transactionResults}
            isLoading={isLoading}
            isLoadingTxnResults={isLoadingTxnResults}
            setSelectedTransaction={setSelectedTransaction}
            setShowTransactionModal={setShowTransactionModal}
            runTransaction={runTransaction}
            deleteTransaction={deleteTransaction}
          />
        )}

        {/* Performance Tab Content - Using modular component (Feature #47) */}
        {activeTab === 'performance' && (
          <PerformanceTab
            performanceChecks={performanceChecks}
            selectedPerformance={selectedPerformance}
            performanceResults={performanceResults}
            performanceTrends={performanceTrends}
            isLoading={isLoading}
            isLoadingPerfResults={isLoadingPerfResults}
            setSelectedPerformance={setSelectedPerformance}
            setShowPerformanceModal={setShowPerformanceModal}
            runPerformanceCheck={runPerformanceCheck}
            deletePerformanceCheck={deletePerformanceCheck}
            getPerfStatusBadge={getPerfStatusBadge}
            getMetricColor={getMetricColor}
          />
        )}

        {/* Webhooks Tab Content - Using modular component (Feature #47) */}
        {activeTab === 'webhooks' && (
          <WebhooksTab
            webhookChecks={webhookChecks}
            selectedWebhook={selectedWebhook}
            webhookEvents={webhookEvents}
            isLoading={isLoading}
            setSelectedWebhook={setSelectedWebhook}
            setShowWebhookModal={setShowWebhookModal}
            fetchWebhookEvents={fetchWebhookEvents}
            sendTestWebhook={sendTestWebhook}
            deleteWebhookCheck={deleteWebhookCheck}
          />
        )}

        {/* DNS Tab Content - REMOVED (infrastructure monitoring, not QA testing) */}

        {/* TCP Tab Content - REMOVED (infrastructure monitoring, not QA testing) */}

        {/* Settings Tab Content - Feature #47: Using SettingsTab component */}
        {activeTab === 'settings' && (
          <SettingsTab
            token={token || ''}
            monitoringSettings={monitoringSettings}
            retentionStats={retentionStats}
            isLoadingSettings={isLoadingSettings}
            isSavingSettings={isSavingSettings}
            isRunningCleanup={isRunningCleanup}
            settingsRetentionDays={settingsRetentionDays}
            settingsAutoCleanup={settingsAutoCleanup}
            setSettingsRetentionDays={setSettingsRetentionDays}
            setSettingsAutoCleanup={setSettingsAutoCleanup}
            saveMonitoringSettings={saveMonitoringSettings}
            runRetentionCleanup={runRetentionCleanup}
            statusPages={statusPages}
            isLoadingStatusPages={isLoadingStatusPages}
            onCreateStatusPage={() => {
              setEditingStatusPage(null);
              setShowStatusPageModal(true);
            }}
            onEditStatusPage={openEditStatusPage}
            onDeleteStatusPage={handleDeleteStatusPage}
            onOpenIncidentManagement={openIncidentManagement}
            onCallSchedules={onCallSchedules}
            isLoadingOnCallSchedules={isLoadingOnCallSchedules}
            onCreateOnCallSchedule={() => {
              setEditingOnCallSchedule(null);
              setShowOnCallModal(true);
            }}
            onEditOnCallSchedule={openEditOnCallSchedule}
            onDeleteOnCallSchedule={handleDeleteOnCallSchedule}
            onRotateOnCallSchedule={handleRotateOnCallSchedule}
            escalationPolicies={escalationPolicies}
            isLoadingEscalationPolicies={isLoadingEscalationPolicies}
            onCreateEscalationPolicy={() => {
              setEditingEscalationPolicy(null);
              setShowEscalationPolicyModal(true);
            }}
            onEditEscalationPolicy={openEditEscalationPolicy}
            onDeleteEscalationPolicy={handleDeleteEscalationPolicy}
            onTestEscalationPolicy={handleTestEscalationPolicy}
          />
        )}

        {/* Feature #47: Extracted Managed Incident Modals */}
        <CreateManagedIncidentModal
          isOpen={showManagedIncidentModal}
          onClose={() => setShowManagedIncidentModal(false)}
          onSubmit={handleCreateManagedIncidentFromModal}
          isSubmitting={isSubmittingManagedIncident}
        />
        <ManagedIncidentDetailModal
          isOpen={showManagedIncidentDetailModal}
          incident={selectedManagedIncident}
          onClose={() => setShowManagedIncidentDetailModal(false)}
          onUpdateStatus={handleUpdateManagedIncidentStatus}
          onAddNote={handleAddNoteFromModal}
          onOpenResolveModal={() => setShowManagedResolveModal(true)}
          onOpenAssignResponderModal={() => setShowManagedAssignResponderModal(true)}
        />
        <AssignResponderModal
          isOpen={showManagedAssignResponderModal}
          incidentId={selectedManagedIncident?.id || null}
          onClose={() => setShowManagedAssignResponderModal(false)}
          onAssign={handleAssignResponderFromModal}
        />
        <ResolveIncidentModal
          isOpen={showManagedResolveModal}
          incidentId={selectedManagedIncident?.id || null}
          onClose={() => setShowManagedResolveModal(false)}
          onResolve={handleResolveFromModal}
        />

        {/* Create/Edit Alert Grouping Rule Modal - Feature #47: Extracted to component */}
        <AlertGroupingModal
          isOpen={showAlertGroupingModal}
          onClose={() => setShowAlertGroupingModal(false)}
          token={token || ''}
          editingRule={editingAlertGroupingRule}
          onSuccess={fetchAlertGroupingRules}
        />


        {/* Create/Edit Alert Routing Rule Modal - Feature #47: Extracted to component */}
        <AlertRoutingModal
          isOpen={showAlertRoutingModal}
          onClose={() => {
            setShowAlertRoutingModal(false);
            setEditingAlertRoutingRule(null);
          }}
          token={token || ''}
          editingRule={editingAlertRoutingRule}
          onSuccess={fetchAlertRoutingRules}
        />

        {/* Test Alert Routing Modal - Feature #47: Extracted to component */}
        <AlertRoutingTestModal
          isOpen={showAlertRoutingTest}
          onClose={() => setShowAlertRoutingTest(false)}
          token={token || ''}
        />


        {/* Create/Edit Escalation Policy Modal - Feature #47: Extracted to component */}
        <EscalationPolicyModal
          isOpen={showEscalationPolicyModal}
          onClose={() => {
            setShowEscalationPolicyModal(false);
            setEditingEscalationPolicy(null);
          }}
          token={token || ''}
          editingPolicy={editingEscalationPolicy}
          onCallSchedules={onCallSchedules}
          onSuccess={fetchEscalationPolicies}
        />


        {/* Create/Edit On-Call Schedule Modal - Feature #47: Extracted to component */}
        <OnCallScheduleModal
          isOpen={showOnCallModal}
          onClose={() => setShowOnCallModal(false)}
          token={token || ''}
          editingSchedule={editingOnCallSchedule}
          onSuccess={fetchOnCallSchedules}
        />

        {/* Create/Edit Status Page Modal - Feature #47: Extracted to component */}
        <StatusPageModal
          isOpen={showStatusPageModal}
          onClose={() => setShowStatusPageModal(false)}
          token={token || ''}
          editingStatusPage={editingStatusPage}
          availableChecks={availableChecksForStatus}
          onSuccess={fetchStatusPages}
        />

        {/* Incident Management Panel - Feature #47: Extracted to component */}
        <IncidentManagementPanel
          isOpen={!!selectedStatusPageForIncident}
          statusPage={selectedStatusPageForIncident}
          token={token || ''}
          onClose={() => setSelectedStatusPageForIncident(null)}
        />

        {/* DNS and TCP Modals removed - infrastructure monitoring, not QA testing */}

        {/* Create Webhook Modal - Feature #47: Extracted to modular component */}
        <WebhookModal
          isOpen={showWebhookModal}
          token={token || ''}
          onClose={() => setShowWebhookModal(false)}
          onWebhookCreated={(webhook) => {
            setWebhookChecks(prev => [...prev, webhook]);
          }}
        />

        {/* Create/Edit Check Modal - Feature #47: Extracted to modular component */}
        <CreateCheckModal
          isOpen={showCreateModal}
          editingCheck={editingCheck}
          token={token || ''}
          availableGroups={availableGroups}
          onClose={() => {
            setShowCreateModal(false);
            setEditingCheck(null);
          }}
          onCheckCreated={(check) => {
            setChecks(prev => [...prev, check]);
            fetchData();
          }}
          onCheckUpdated={(check) => {
            setChecks(prev => prev.map(c => c.id === check.id ? check : c));
            if (selectedCheck?.id === check.id) {
              setSelectedCheck(check);
            }
          }}
        />

        {/* Create Transaction Modal - Feature #47: Extracted to modular component */}
        <TransactionModal
          isOpen={showTransactionModal}
          token={token || ''}
          onClose={() => setShowTransactionModal(false)}
          onTransactionCreated={(transaction) => {
            setTransactions(prev => [...prev, transaction]);
          }}
        />

        {/* Create Performance Check Modal - Feature #47: Extracted to modular component */}
        <PerformanceCheckModal
          isOpen={showPerformanceModal}
          token={token || ''}
          onClose={() => setShowPerformanceModal(false)}
          onPerformanceCheckCreated={(check) => {
            setPerformanceChecks(prev => [...prev, check]);
          }}
        />
      </div>
    </Layout>
  );
}


export { MonitoringPage };
