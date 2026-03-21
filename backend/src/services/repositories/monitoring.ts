/**
 * Monitoring Repository - Database CRUD operations for monitoring module
 *
 * Feature #250: Split into 3 sub-modules for better organization:
 *   - monitoring-checks.ts (~800 lines): Uptime, transaction, performance, DNS, TCP, webhook checks
 *   - monitoring-incidents.ts (~200 lines): Incidents, maintenance windows, consecutive failures
 *   - monitoring-alerts.ts (~300 lines): Status pages, settings, deleted history, memory stubs
 *
 * This barrel file re-exports all functions from sub-modules for backward compatibility.
 * All existing imports from './monitoring.js' will continue to work.
 *
 * Feature #2086: Migrates in-memory Map stores to PostgreSQL persistence.
 * Feature #2105: Removed all in-memory Map fallback stores. PostgreSQL-only storage.
 *   Memory maps have been removed; getMemory*() functions return empty Maps with deprecation warnings.
 *
 * This module handles all monitoring data including:
 * - Uptime checks and results
 * - Transaction checks and results
 * - Performance checks and results
 * - Maintenance windows
 * - Incidents (active and historical)
 * - Webhook checks and events
 * - DNS checks and results
 * - TCP checks and results
 * - Status pages and subscriptions
 * - On-call schedules and escalation policies
 * - Alert grouping, routing, rate limiting
 * - Alert correlations and runbooks
 * - Managed incidents
 */

// =============================
// RE-EXPORT FROM SUB-MODULES
// =============================

// Monitoring Checks Module
export {
  // Uptime checks
  createUptimeCheck,
  getUptimeCheck,
  updateUptimeCheck,
  deleteUptimeCheck,
  listUptimeChecks,
  getAllUptimeChecks,
  // Check results
  addCheckResult,
  getCheckResults,
  getLatestCheckResult,
  deleteOldCheckResults,
  // Transaction checks
  createTransactionCheck,
  getTransactionCheck,
  updateTransactionCheck,
  deleteTransactionCheck,
  listTransactionChecks,
  // Transaction results
  addTransactionResult,
  getTransactionResults,
  // Performance checks
  createPerformanceCheck,
  getPerformanceCheck,
  updatePerformanceCheck,
  deletePerformanceCheck,
  listPerformanceChecks,
  // Performance results
  addPerformanceResult,
  getPerformanceResults,
  // Webhook checks
  createWebhookCheck,
  getWebhookCheck,
  getWebhookCheckByToken,
  updateWebhookCheck,
  deleteWebhookCheck,
  listWebhookChecks,
  // Webhook events
  addWebhookEvent,
  getWebhookEvents,
  // DNS checks
  createDnsCheck,
  getDnsCheck,
  updateDnsCheck,
  deleteDnsCheck,
  listDnsChecks,
  // DNS results
  addDnsResult,
  getDnsResults,
  // TCP checks
  createTcpCheck,
  getTcpCheck,
  updateTcpCheck,
  deleteTcpCheck,
  listTcpChecks,
  // TCP results
  addTcpResult,
  getTcpResults,
} from './monitoring-checks.js';

// Monitoring Incidents Module
export {
  // Incidents
  createIncident,
  getActiveIncident,
  setActiveIncident,
  clearActiveIncident,
  resolveIncident,
  getCheckIncidents,
  // Consecutive failures
  getConsecutiveFailures,
  setConsecutiveFailures,
  // Maintenance windows
  createMaintenanceWindow,
  getMaintenanceWindows,
  deleteMaintenanceWindow,
  // Managed incidents
  createManagedIncident,
  getManagedIncident,
  updateManagedIncident,
  deleteManagedIncident,
  listManagedIncidents,
  countManagedIncidents,
  // Managed incident child entities
  addManagedIncidentNote,
  addManagedIncidentTimelineEntry,
  addManagedIncidentResponder,
} from './monitoring-incidents.js';

// Monitoring Alerts Module
export {
  // Status pages
  createStatusPage,
  getStatusPage,
  getStatusPageBySlug,
  updateStatusPage,
  deleteStatusPage,
  listStatusPages,
  // Monitoring settings
  getMonitoringSettings,
  setMonitoringSettings,
  // Deleted check history
  addDeletedCheckHistory,
  getDeletedCheckHistory,
  listDeletedCheckHistory,
  // Alert grouping rules (Feature #2118)
  createAlertGroupingRule,
  getAlertGroupingRule,
  updateAlertGroupingRule,
  deleteAlertGroupingRule,
  listAlertGroupingRules,
  // Alert groups (Feature #2118)
  createAlertGroup,
  getAlertGroup,
  updateAlertGroup,
  listAlertGroups,
  findActiveAlertGroup,
  // Memory store compatibility stubs
  getMemoryUptimeChecks,
  getMemoryCheckResults,
  getMemoryTransactionChecks,
  getMemoryTransactionResults,
  getMemoryPerformanceChecks,
  getMemoryPerformanceResults,
  getMemoryMaintenanceWindows,
  getMemoryCheckIncidents,
  getMemoryActiveIncidents,
  getMemoryConsecutiveFailures,
  getMemoryWebhookChecks,
  getMemoryWebhookEvents,
  getMemoryWebhookTokenMap,
  getMemoryDnsChecks,
  getMemoryDnsResults,
  getMemoryTcpChecks,
  getMemoryTcpResults,
  getMemoryMonitoringSettings,
  getMemoryStatusPages,
  getMemoryStatusPagesBySlug,
  getMemoryStatusPageIncidents,
  getMemoryStatusPageSubscriptions,
  getMemoryOnCallSchedules,
  getMemoryEscalationPolicies,
  getMemoryDeletedCheckHistory,
  getMemoryAlertGroupingRules,
  getMemoryAlertGroups,
  getMemoryAlertRoutingRules,
  getMemoryAlertRoutingLogs,
  getMemoryAlertRateLimitConfigs,
  getMemoryAlertRateLimitStates,
  getMemoryAlertCorrelationConfigs,
  getMemoryAlertCorrelations,
  getMemoryAlertToCorrelation,
  getMemoryAlertRunbooks,
  getMemoryManagedIncidents,
  getMemoryIncidentsByOrg,
} from './monitoring-alerts.js';

// Monitoring Alert Routing Module (Feature #2118: DB migration for routing/correlation/runbooks)
export {
  // Alert routing rules
  createAlertRoutingRule,
  getAlertRoutingRule,
  updateAlertRoutingRule,
  deleteAlertRoutingRule,
  listAlertRoutingRules,
  getMaxAlertRoutingRulePriority,
  // Alert routing logs
  addAlertRoutingLog,
  listAlertRoutingLogs,
  // Alert rate limit configs
  getAlertRateLimitConfig,
  setAlertRateLimitConfig,
  // Alert rate limit states
  getAlertRateLimitState,
  setAlertRateLimitState,
  deleteAlertRateLimitState,
  // Alert correlation configs
  getAlertCorrelationConfig,
  setAlertCorrelationConfig,
  // Alert correlations
  createAlertCorrelation,
  getAlertCorrelation,
  updateAlertCorrelation,
  deleteAlertCorrelation,
  listAlertCorrelations,
  deleteAlertCorrelationsByOrg,
  getCorrelationIdForAlert,
  // Alert runbooks
  createAlertRunbook,
  getAlertRunbook,
  updateAlertRunbook,
  deleteAlertRunbook,
  listAlertRunbooks,
} from './monitoring-alert-routing.js';
