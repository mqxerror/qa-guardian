/**
 * Monitoring Stores Module
 *
 * Feature #2086: Migrated to PostgreSQL with in-memory fallback.
 * This module now exports both:
 * - Async database functions (preferred for new code)
 * - Memory Maps (for backward compatibility with existing code)
 *
 * The repository handles automatic fallback to in-memory when database is unavailable.
 */

import {
  UptimeCheck,
  CheckResult,
  TransactionCheck,
  TransactionResult,
  PerformanceCheck,
  PerformanceResult,
  MaintenanceWindow,
  Incident,
  WebhookCheck,
  WebhookEvent,
  DnsCheck,
  DnsCheckResult,
  TcpCheck,
  TcpCheckResult,
  MonitoringSettings,
  StatusPage,
  StatusPageIncident,
  StatusPageSubscription,
  OnCallSchedule,
  EscalationPolicy,
  DeletedCheckHistory,
  AlertGroupingRule,
  AlertGroup,
  AlertRoutingRule,
  AlertRoutingLog,
  AlertRateLimitConfig,
  AlertRateLimitState,
  AlertCorrelationConfig,
  AlertCorrelation,
  AlertRunbook,
  ManagedIncident,
} from './types';

// Import repository for database operations
import * as monitoringRepo from '../../services/repositories/monitoring';

// =============================
// ASYNC DATABASE FUNCTIONS
// Re-export all repository functions for use in route handlers
// =============================

// Uptime checks
export const createUptimeCheck = monitoringRepo.createUptimeCheck;
export const getUptimeCheck = monitoringRepo.getUptimeCheck;
export const updateUptimeCheck = monitoringRepo.updateUptimeCheck;
export const deleteUptimeCheck = monitoringRepo.deleteUptimeCheck;
export const listUptimeChecks = monitoringRepo.listUptimeChecks;
export const getAllUptimeChecks = monitoringRepo.getAllUptimeChecks;

// Check results
export const addCheckResult = monitoringRepo.addCheckResult;
export const getCheckResults = monitoringRepo.getCheckResults;
export const getLatestCheckResult = monitoringRepo.getLatestCheckResult;
export const deleteOldCheckResults = monitoringRepo.deleteOldCheckResults;

// Incidents
export const createIncident = monitoringRepo.createIncident;
export const getActiveIncident = monitoringRepo.getActiveIncident;
export const setActiveIncident = monitoringRepo.setActiveIncident;
export const clearActiveIncident = monitoringRepo.clearActiveIncident;
export const resolveIncident = monitoringRepo.resolveIncident;
export const getCheckIncidentsAsync = monitoringRepo.getCheckIncidents;

// Consecutive failures
export const getConsecutiveFailures = monitoringRepo.getConsecutiveFailures;
export const setConsecutiveFailures = monitoringRepo.setConsecutiveFailures;

// Maintenance windows
export const createMaintenanceWindow = monitoringRepo.createMaintenanceWindow;
export const getMaintenanceWindows = monitoringRepo.getMaintenanceWindows;
export const deleteMaintenanceWindow = monitoringRepo.deleteMaintenanceWindow;

// Transaction checks
export const createTransactionCheck = monitoringRepo.createTransactionCheck;
export const getTransactionCheck = monitoringRepo.getTransactionCheck;
export const updateTransactionCheck = monitoringRepo.updateTransactionCheck;
export const deleteTransactionCheck = monitoringRepo.deleteTransactionCheck;
export const listTransactionChecks = monitoringRepo.listTransactionChecks;

// Transaction results
export const addTransactionResult = monitoringRepo.addTransactionResult;
export const getTransactionResults = monitoringRepo.getTransactionResults;

// Performance checks
export const createPerformanceCheck = monitoringRepo.createPerformanceCheck;
export const getPerformanceCheck = monitoringRepo.getPerformanceCheck;
export const updatePerformanceCheck = monitoringRepo.updatePerformanceCheck;
export const deletePerformanceCheck = monitoringRepo.deletePerformanceCheck;
export const listPerformanceChecks = monitoringRepo.listPerformanceChecks;

// Performance results
export const addPerformanceResult = monitoringRepo.addPerformanceResult;
export const getPerformanceResults = monitoringRepo.getPerformanceResults;

// Webhook checks
export const createWebhookCheck = monitoringRepo.createWebhookCheck;
export const getWebhookCheck = monitoringRepo.getWebhookCheck;
export const getWebhookCheckByToken = monitoringRepo.getWebhookCheckByToken;
export const updateWebhookCheck = monitoringRepo.updateWebhookCheck;
export const deleteWebhookCheck = monitoringRepo.deleteWebhookCheck;
export const listWebhookChecks = monitoringRepo.listWebhookChecks;

// Webhook events
export const addWebhookEvent = monitoringRepo.addWebhookEvent;
export const getWebhookEvents = monitoringRepo.getWebhookEvents;

// DNS checks
export const createDnsCheck = monitoringRepo.createDnsCheck;
export const getDnsCheck = monitoringRepo.getDnsCheck;
export const updateDnsCheck = monitoringRepo.updateDnsCheck;
export const deleteDnsCheck = monitoringRepo.deleteDnsCheck;
export const listDnsChecks = monitoringRepo.listDnsChecks;

// DNS results
export const addDnsResult = monitoringRepo.addDnsResult;
export const getDnsResults = monitoringRepo.getDnsResults;

// TCP checks
export const createTcpCheck = monitoringRepo.createTcpCheck;
export const getTcpCheck = monitoringRepo.getTcpCheck;
export const updateTcpCheck = monitoringRepo.updateTcpCheck;
export const deleteTcpCheck = monitoringRepo.deleteTcpCheck;
export const listTcpChecks = monitoringRepo.listTcpChecks;

// TCP results
export const addTcpResult = monitoringRepo.addTcpResult;
export const getTcpResults = monitoringRepo.getTcpResults;

// Status pages
export const createStatusPage = monitoringRepo.createStatusPage;
export const getStatusPage = monitoringRepo.getStatusPage;
export const getStatusPageBySlug = monitoringRepo.getStatusPageBySlug;
export const updateStatusPage = monitoringRepo.updateStatusPage;
export const deleteStatusPage = monitoringRepo.deleteStatusPage;
export const listStatusPages = monitoringRepo.listStatusPages;

// Monitoring settings
export const getMonitoringSettings = monitoringRepo.getMonitoringSettings;
export const setMonitoringSettings = monitoringRepo.setMonitoringSettings;

// Deleted check history
export const addDeletedCheckHistory = monitoringRepo.addDeletedCheckHistory;
export const getDeletedCheckHistory = monitoringRepo.getDeletedCheckHistory;


// =============================
// BACKWARD COMPATIBLE MAP EXPORTS
// These point to the repository's in-memory fallback stores
// Note: For new code, use the async functions above instead
// =============================

// Uptime checks and results
export const uptimeChecks: Map<string, UptimeCheck> = monitoringRepo.getMemoryUptimeChecks();
export const checkResults: Map<string, CheckResult[]> = monitoringRepo.getMemoryCheckResults();

// Transaction checks and results
export const transactionChecks: Map<string, TransactionCheck> = monitoringRepo.getMemoryTransactionChecks();
export const transactionResults: Map<string, TransactionResult[]> = monitoringRepo.getMemoryTransactionResults();

// Performance checks and results
export const performanceChecks: Map<string, PerformanceCheck> = monitoringRepo.getMemoryPerformanceChecks();
export const performanceResults: Map<string, PerformanceResult[]> = monitoringRepo.getMemoryPerformanceResults();

// Maintenance windows: checkId -> windows
export const maintenanceWindows: Map<string, MaintenanceWindow[]> = monitoringRepo.getMemoryMaintenanceWindows();

// Incidents: checkId -> incidents (closed ones)
export const checkIncidents: Map<string, Incident[]> = monitoringRepo.getMemoryCheckIncidents();

// Active incidents: checkId -> incident (ongoing)
export const activeIncidents: Map<string, Incident> = monitoringRepo.getMemoryActiveIncidents();

// Consecutive failures tracking: checkId -> count
export const consecutiveFailures: Map<string, number> = monitoringRepo.getMemoryConsecutiveFailures();

// Check intervals for cleanup: checkId -> NodeJS.Timeout
// NOTE: This MUST stay in-memory - NodeJS.Timeout cannot be serialized to database
export const checkIntervals: Map<string, NodeJS.Timeout> = new Map();

// Webhook checks and events
export const webhookChecks: Map<string, WebhookCheck> = monitoringRepo.getMemoryWebhookChecks();
export const webhookEvents: Map<string, WebhookEvent[]> = monitoringRepo.getMemoryWebhookEvents();
export const webhookTokenMap: Map<string, string> = monitoringRepo.getMemoryWebhookTokenMap();

// DNS checks and results
export const dnsChecks: Map<string, DnsCheck> = monitoringRepo.getMemoryDnsChecks();
export const dnsResults: Map<string, DnsCheckResult[]> = monitoringRepo.getMemoryDnsResults();

// TCP checks and results
export const tcpChecks: Map<string, TcpCheck> = monitoringRepo.getMemoryTcpChecks();
export const tcpResults: Map<string, TcpCheckResult[]> = monitoringRepo.getMemoryTcpResults();

// Organization monitoring settings
export const monitoringSettings: Map<string, MonitoringSettings> = monitoringRepo.getMemoryMonitoringSettings();

// Status pages
export const statusPages: Map<string, StatusPage> = monitoringRepo.getMemoryStatusPages();
export const statusPagesBySlug: Map<string, string> = monitoringRepo.getMemoryStatusPagesBySlug();
export const statusPageIncidents: Map<string, StatusPageIncident[]> = monitoringRepo.getMemoryStatusPageIncidents();
export const statusPageSubscriptions: Map<string, StatusPageSubscription[]> = monitoringRepo.getMemoryStatusPageSubscriptions();

// On-call schedules
export const onCallSchedules: Map<string, OnCallSchedule> = monitoringRepo.getMemoryOnCallSchedules();

// Escalation policies
export const escalationPolicies: Map<string, EscalationPolicy> = monitoringRepo.getMemoryEscalationPolicies();

// Feature #943: Deleted check history storage for audit purposes
export const deletedCheckHistory: Map<string, DeletedCheckHistory> = monitoringRepo.getMemoryDeletedCheckHistory();

// Alert grouping
export const alertGroupingRules: Map<string, AlertGroupingRule> = monitoringRepo.getMemoryAlertGroupingRules();
export const alertGroups: Map<string, AlertGroup> = monitoringRepo.getMemoryAlertGroups();

// Alert routing
export const alertRoutingRules: Map<string, AlertRoutingRule> = monitoringRepo.getMemoryAlertRoutingRules();
export const alertRoutingLogs: Map<string, AlertRoutingLog[]> = monitoringRepo.getMemoryAlertRoutingLogs();

// Alert rate limiting
export const alertRateLimitConfigs: Map<string, AlertRateLimitConfig> = monitoringRepo.getMemoryAlertRateLimitConfigs();
export const alertRateLimitStates: Map<string, AlertRateLimitState> = monitoringRepo.getMemoryAlertRateLimitStates();

// Alert correlation
export const alertCorrelationConfigs: Map<string, AlertCorrelationConfig> = monitoringRepo.getMemoryAlertCorrelationConfigs();
export const alertCorrelations: Map<string, AlertCorrelation> = monitoringRepo.getMemoryAlertCorrelations();
export const alertToCorrelation: Map<string, string> = monitoringRepo.getMemoryAlertToCorrelation();

// Alert runbooks
export const alertRunbooks: Map<string, AlertRunbook> = monitoringRepo.getMemoryAlertRunbooks();

// Managed incidents
export const managedIncidents: Map<string, ManagedIncident> = monitoringRepo.getMemoryManagedIncidents();
export const incidentsByOrg: Map<string, string[]> = monitoringRepo.getMemoryIncidentsByOrg();
