// MonitoringPage - Extracted from App.tsx (Feature #1441)
// Feature #75: Migrated summary to React Query with caching
// Feature #336: Dark-first design system redesign
// Feature #708: Full React Query migration + custom hooks refactor
// Synthetic monitoring: uptime checks, transaction monitoring, performance testing
import { useState, useEffect, useCallback } from "react";
// import { useNavigate } from "react-router-dom"; // Unused
import { Layout } from "../components/Layout";
import { useAuthStore } from "../stores/authStore";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { toast } from "../stores/toastStore";
import {
  useMonitoringSummary,
  // Feature #708: React Query hooks for settings operations
  useMonitoringSettings as useMonitoringSettingsQuery,
  useMonitoringRetentionStats,
  useSaveMonitoringSettings,
  useRunRetentionCleanup,
  useStatusPages,
  useAvailableChecksForStatus,
  useDeleteStatusPage,
  useOnCallSchedules,
  useDeleteOnCallSchedule,
  useRotateOnCallSchedule,
  useEscalationPolicies,
  useDeleteEscalationPolicy,
  useTestEscalationPolicy,
  useAlertHistory,
  useExportAlertHistory,
  useAlertRoutingRules,
  useAlertRoutingLogs,
  useDeleteAlertRoutingRule,
  useInvalidateMonitoringSettings,
} from "../hooks/api/useMonitoring";
import { devLog, createLogger } from "../utils/logger";

const logger = createLogger('monitoring');
// Feature #336: Design system components
import {
  PageHeader,
  AnimatedCard,
  StatusPill,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  useReducedMotion,
} from "../components/ui";
import { Plus, Activity, CreditCard, Webhook, Gauge, Settings } from "lucide-react";
import { Button } from '@/components/ui/button';

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

  // Feature #708: React Query hooks for settings (replaces useState + fetch)
  const { data: monitoringSettingsData, isLoading: isLoadingSettingsRQ } = useMonitoringSettingsQuery();
  const { data: retentionStatsData, isLoading: isLoadingStatsRQ } = useMonitoringRetentionStats();
  const saveSettingsMutation = useSaveMonitoringSettings();
  const cleanupMutation = useRunRetentionCleanup();
  const { invalidateSettings, invalidateStats } = useInvalidateMonitoringSettings();

  // Feature #708: React Query hooks for status pages
  const { data: statusPagesData, isLoading: isLoadingStatusPagesRQ, refetch: refetchStatusPages } = useStatusPages();
  const { data: availableChecksData } = useAvailableChecksForStatus();
  const deleteStatusPageMutation = useDeleteStatusPage();

  // Feature #708: React Query hooks for on-call schedules
  const { data: onCallSchedulesData, isLoading: isLoadingOnCallRQ, refetch: refetchOnCallSchedules } = useOnCallSchedules();
  const deleteOnCallMutation = useDeleteOnCallSchedule();
  const rotateOnCallMutation = useRotateOnCallSchedule();

  // Feature #708: React Query hooks for escalation policies
  const { data: escalationPoliciesData, isLoading: isLoadingEscalationRQ, refetch: refetchEscalationPolicies } = useEscalationPolicies();
  const deleteEscalationMutation = useDeleteEscalationPolicy();
  const testEscalationMutation = useTestEscalationPolicy();

  // Feature #708: React Query hooks for alert history
  const [alertHistorySeverityFilter, setAlertHistorySeverityFilter] = useState<string>('');
  const [alertHistorySourceFilter, setAlertHistorySourceFilter] = useState<string>('');
  const { data: alertHistoryData, isLoading: isLoadingAlertHistoryRQ } = useAlertHistory({
    severity: alertHistorySeverityFilter || undefined,
    source: alertHistorySourceFilter || undefined,
  });
  const exportAlertHistoryMutation = useExportAlertHistory();

  // Feature #708: React Query hooks for alert routing
  const { data: alertRoutingRulesData, isLoading: isLoadingRoutingRulesRQ, refetch: refetchAlertRoutingRules } = useAlertRoutingRules();
  const { data: alertRoutingLogsData, refetch: refetchAlertRoutingLogs } = useAlertRoutingLogs();
  const deleteRoutingRuleMutation = useDeleteAlertRoutingRule();

  // Derive data from React Query responses
  const monitoringSettings = monitoringSettingsData || null;
  const retentionStats = retentionStatsData || null;
  const isLoadingSettings = isLoadingSettingsRQ;
  const isSavingSettings = saveSettingsMutation.isPending;
  const isRunningCleanup = cleanupMutation.isPending;
  const statusPages = statusPagesData?.status_pages || [];
  const availableChecksForStatus = availableChecksData?.checks || [];
  const isLoadingStatusPages = isLoadingStatusPagesRQ;
  const onCallSchedules = onCallSchedulesData?.schedules || [];
  const isLoadingOnCallSchedules = isLoadingOnCallRQ;
  const escalationPolicies = escalationPoliciesData?.policies || [];
  const isLoadingEscalationPolicies = isLoadingEscalationRQ;
  const alertHistory = alertHistoryData?.alerts || [];
  const alertHistoryStats = alertHistoryData?.stats || null;
  const alertsOverTime = alertHistoryData?.alerts_over_time || [];
  const isLoadingAlertHistory = isLoadingAlertHistoryRQ;
  const alertRoutingRules = alertRoutingRulesData?.rules || [];
  const alertRoutingLogs = alertRoutingLogsData?.logs || [];
  const isLoadingAlertRouting = isLoadingRoutingRulesRQ;

  // Settings form state (local edits before save)
  const [settingsRetentionDays, setSettingsRetentionDays] = useState<30 | 90 | 365>(90);
  const [settingsAutoCleanup, setSettingsAutoCleanup] = useState(true);

  // Sync form state with fetched settings
  useEffect(() => {
    if (monitoringSettings) {
      setSettingsRetentionDays(monitoringSettings.retention_days);
      setSettingsAutoCleanup(monitoringSettings.auto_cleanup_enabled);
    }
  }, [monitoringSettings]);

  // Modal states (keeping minimal UI state)
  const [showStatusPageModal, setShowStatusPageModal] = useState(false);
  const [editingStatusPage, setEditingStatusPage] = useState<StatusPage | null>(null);
  const [selectedStatusPageForIncident, setSelectedStatusPageForIncident] = useState<StatusPage | null>(null);
  const [showOnCallModal, setShowOnCallModal] = useState(false);
  const [editingOnCallSchedule, setEditingOnCallSchedule] = useState<OnCallSchedule | null>(null);
  const [showEscalationPolicyModal, setShowEscalationPolicyModal] = useState(false);
  const [editingEscalationPolicy, setEditingEscalationPolicy] = useState<EscalationPolicy | null>(null);
  const [showAlertHistorySection, setShowAlertHistorySection] = useState(false);
  const [showAlertRoutingModal, setShowAlertRoutingModal] = useState(false);
  const [editingAlertRoutingRule, setEditingAlertRoutingRule] = useState<AlertRoutingRule | null>(null);
  const [showAlertRoutingTest, setShowAlertRoutingTest] = useState(false);

  // Advanced alert config state (keeping as-is since no React Query hooks yet)
  const [globalSeverityMapping, setGlobalSeverityMapping] = useState<GlobalSeverityMapping>({
    critical: 'P1',
    high: 'P2',
    medium: 'P3',
    low: 'P4',
    info: 'P5',
  });
  const [isSavingSeverityMapping, setIsSavingSeverityMapping] = useState(false);
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

  // Feature #708: Use React Query mutations instead of raw fetch
  // fetchMonitoringSettings is now automatic via useMonitoringSettingsQuery hook
  const fetchMonitoringSettings = useCallback(() => {
    // No-op: React Query handles this automatically
    // Keeping function signature for backwards compatibility
    invalidateSettings();
    invalidateStats();
  }, [invalidateSettings, invalidateStats]);

  // Feature #708: Save monitoring settings using React Query mutation
  const saveMonitoringSettings = async () => {
    try {
      await saveSettingsMutation.mutateAsync({
        retention_days: settingsRetentionDays,
        auto_cleanup_enabled: settingsAutoCleanup,
      });
      toast.success('Settings saved successfully');
    } catch (error) {
      logger.error('Failed to save settings:', error);
      toast.error('Failed to save settings');
    }
  };

  // Feature #708: Run retention cleanup using React Query mutation
  const runRetentionCleanup = async () => {
    try {
      const result = await cleanupMutation.mutateAsync();
      toast.success(`Cleanup complete: ${result.cleaned_results?.total || 0} results removed`);
    } catch (error) {
      logger.error('Failed to run cleanup:', error);
      toast.error('Failed to run cleanup');
    }
  };

  // Feature #708: fetchStatusPages is now automatic via useStatusPages hook
  const fetchStatusPages = useCallback(() => {
    refetchStatusPages();
  }, [refetchStatusPages]);

  // Feature #708: Delete status page using React Query mutation
  const handleDeleteStatusPage = async (pageId: string) => {
    if (!confirm('Are you sure you want to delete this status page?')) return;

    try {
      await deleteStatusPageMutation.mutateAsync(pageId);
      toast.success('Status page deleted');
    } catch (error) {
      logger.error('Failed to delete status page:', error);
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

  // Feature #708: fetchOnCallSchedules is now automatic via useOnCallSchedules hook
  const fetchOnCallSchedules = useCallback(() => {
    refetchOnCallSchedules();
  }, [refetchOnCallSchedules]);

  // Open edit on-call schedule modal - Feature #47: Form state moved to component
  const openEditOnCallSchedule = (schedule: OnCallSchedule) => {
    setEditingOnCallSchedule(schedule);
    setShowOnCallModal(true);
  };

  // Feature #708: Delete on-call schedule using React Query mutation
  const handleDeleteOnCallSchedule = async (scheduleId: string) => {
    if (!confirm('Are you sure you want to delete this on-call schedule?')) return;

    try {
      await deleteOnCallMutation.mutateAsync(scheduleId);
      toast.success('On-call schedule deleted');
    } catch (error) {
      logger.error('Failed to delete on-call schedule:', error);
      toast.error('Failed to delete on-call schedule');
    }
  };

  // Feature #708: Rotate on-call schedule using React Query mutation
  const handleRotateOnCallSchedule = async (scheduleId: string) => {
    try {
      await rotateOnCallMutation.mutateAsync(scheduleId);
      toast.success('On-call rotation advanced');
    } catch (error) {
      logger.error('Failed to rotate on-call schedule:', error);
      toast.error('Failed to rotate on-call schedule');
    }
  };

  // Feature #708: fetchEscalationPolicies is now automatic via useEscalationPolicies hook
  const fetchEscalationPolicies = useCallback(() => {
    refetchEscalationPolicies();
  }, [refetchEscalationPolicies]);

  // Feature #47: Form state moved to EscalationPolicyModal - only need simple open/close
  const openEditEscalationPolicy = (policy: EscalationPolicy) => {
    setEditingEscalationPolicy(policy);
    setShowEscalationPolicyModal(true);
  };

  // Feature #708: Delete escalation policy using React Query mutation
  const handleDeleteEscalationPolicy = async (policyId: string) => {
    if (!confirm('Are you sure you want to delete this escalation policy?')) return;

    try {
      await deleteEscalationMutation.mutateAsync(policyId);
      toast.success('Escalation policy deleted');
    } catch (error) {
      logger.error('Failed to delete escalation policy:', error);
      toast.error('Failed to delete escalation policy');
    }
  };

  // Feature #708: Test escalation policy using React Query mutation
  const handleTestEscalationPolicy = async (policyId: string) => {
    try {
      const data = await testEscalationMutation.mutateAsync(policyId);
      toast.success(`Escalation test completed: ${data?.escalation_flow?.length || 0} levels`);
      devLog('[Escalation Test]', data);
    } catch (error) {
      logger.error('Failed to test escalation policy:', error);
      toast.error('Failed to test escalation policy');
    }
  };

  // Feature #47: fetchAlertGroupingRules and fetchAlertGroups moved to useAlertGroupHandlers hook

  // Feature #708: Alert history is now automatic via useAlertHistory hook (params trigger refetch)
  // Keeping function for backwards compatibility with components that call it
  const fetchAlertHistory = useCallback(() => {
    // No-op: React Query handles this automatically with filter params
  }, []);

  // Feature #708: Export alert history using React Query mutation
  const exportAlertHistory = async (format: 'csv' | 'json') => {
    try {
      await exportAlertHistoryMutation.mutateAsync({
        format,
        severity: alertHistorySeverityFilter || undefined,
        source: alertHistorySourceFilter || undefined,
      });
      toast.success(`Alert history exported as ${format.toUpperCase()}`);
    } catch (error) {
      logger.error('Failed to export alert history:', error);
      toast.error('Failed to export alert history');
    }
  };

  // Feature #47: openEditAlertGroupingRule, handleDeleteAlertGroupingRule, handleSimulateAlertGrouping
  // moved to useAlertGroupHandlers hook

  // Feature #708: fetchAlertRoutingRules is now automatic via useAlertRoutingRules hook
  const fetchAlertRoutingRules = useCallback(() => {
    refetchAlertRoutingRules();
  }, [refetchAlertRoutingRules]);

  // Feature #708: fetchAlertRoutingLogs is now automatic via useAlertRoutingLogs hook
  const fetchAlertRoutingLogs = useCallback(() => {
    refetchAlertRoutingLogs();
  }, [refetchAlertRoutingLogs]);

  // Feature #47: Form state moved to AlertRoutingModal - only need simple open/close
  const openEditAlertRoutingRule = (rule: AlertRoutingRule) => {
    setEditingAlertRoutingRule(rule);
    setShowAlertRoutingModal(true);
  };

  // Feature #708: Delete alert routing rule using React Query mutation
  const handleDeleteAlertRoutingRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this alert routing rule?')) return;

    try {
      await deleteRoutingRuleMutation.mutateAsync(ruleId);
      toast.success('Alert routing rule deleted');
    } catch (error) {
      logger.error('Failed to delete alert routing rule:', error);
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
        return <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-1 text-xs font-medium text-success">🟢 Up</span>;
      case 'down':
        return <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-1 text-xs font-medium text-destructive">🔴 Down</span>;
      case 'degraded':
        return <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-1 text-xs font-medium text-warning">🟡 Degraded</span>;
      default:
        return <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">⚪ Unknown</span>;
    }
  };

  return (
    <Layout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Feature #336: PageHeader with action button */}
        <PageHeader
          title="Synthetic Monitoring"
          description="Monitor uptime and performance of your endpoints"
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Monitoring' }]}
          actions={
            activeTab !== 'settings' && (
              <Button
                onClick={() => {
                  if (activeTab === 'checks') setShowCreateModal(true);
                  else if (activeTab === 'transactions') setShowTransactionModal(true);
                  else if (activeTab === 'webhooks') setShowWebhookModal(true);
                  else setShowPerformanceModal(true);
                }}
              >
                <Plus className="h-4 w-4" />
                {activeTab === 'checks' ? 'Create Check' : activeTab === 'transactions' ? 'Create Transaction' : activeTab === 'webhooks' ? 'Create Webhook' : 'Create Performance Check'}
              </Button>
            )
          }
        />

        {/* Tabs */}
        <div className="mb-6 border-b border-border">
          <nav className="-mb-px flex gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab('checks')}
              className={`pb-3 border-b-2 rounded-none ${
                activeTab === 'checks'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Uptime Checks ({checks.length})
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab('transactions')}
              className={`pb-3 border-b-2 rounded-none ${
                activeTab === 'transactions'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Transactions ({transactions.length})
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab('performance')}
              className={`pb-3 border-b-2 rounded-none ${
                activeTab === 'performance'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Performance ({performanceChecks.length})
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab('webhooks')}
              className={`pb-3 border-b-2 rounded-none ${
                activeTab === 'webhooks'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Webhooks ({webhookChecks.length})
            </Button>
            {/* DNS and TCP tabs removed - infrastructure monitoring, not QA testing */}
            <Button
              variant="ghost"
              size="sm"
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
              className={`pb-3 border-b-2 rounded-none ${
                activeTab === 'settings'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              ⚙️ Settings
            </Button>
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
