/**
 * Monitoring Stores Module
 *
 * Feature #2086: Migrated to PostgreSQL with in-memory fallback.
 * Feature #2114: Map exports REMOVED. Only async DB functions exported.
 * Exception: checkIntervals Map kept (NodeJS.Timeout cannot be serialized to DB)
 *
 * All data access must use async functions: createUptimeCheck(), getUptimeCheck(), etc.
 */

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
export const listDeletedCheckHistory = monitoringRepo.listDeletedCheckHistory;


// =============================
// RUNTIME-ONLY MAP (cannot be serialized to DB)
// =============================

// Check intervals for cleanup: checkId -> NodeJS.Timeout
// NOTE: This MUST stay in-memory - NodeJS.Timeout cannot be serialized to database
export const checkIntervals: Map<string, NodeJS.Timeout> = new Map();

// =============================
// DEPRECATED: Empty Map exports for backward compatibility
// These return empty Maps - consumers must migrate to async DB functions (#2118)
// No Proxy wrappers, no getMemory*() calls - just plain empty Maps
// =============================
import {
  UptimeCheck, CheckResult, TransactionCheck, TransactionResult,
  PerformanceCheck, PerformanceResult, MaintenanceWindow, Incident,
  WebhookCheck, WebhookEvent, DnsCheck, DnsCheckResult, TcpCheck, TcpCheckResult,
  MonitoringSettings, StatusPage, StatusPageIncident, StatusPageSubscription,
  OnCallSchedule, EscalationPolicy, DeletedCheckHistory,
  AlertGroupingRule, AlertGroup, AlertRoutingRule, AlertRoutingLog,
  AlertRateLimitConfig, AlertRateLimitState,
  AlertCorrelationConfig, AlertCorrelation, AlertRunbook,
  ManagedIncident,
} from './types';

export const uptimeChecks = new Map<string, UptimeCheck>();
export const checkResults = new Map<string, CheckResult[]>();
export const transactionChecks = new Map<string, TransactionCheck>();
export const transactionResults = new Map<string, TransactionResult[]>();
export const performanceChecks = new Map<string, PerformanceCheck>();
export const performanceResults = new Map<string, PerformanceResult[]>();
export const maintenanceWindows = new Map<string, MaintenanceWindow[]>();
export const checkIncidents = new Map<string, Incident[]>();
export const activeIncidents = new Map<string, Incident>();
export const consecutiveFailures = new Map<string, number>();
export const webhookChecks = new Map<string, WebhookCheck>();
export const webhookEvents = new Map<string, WebhookEvent[]>();
export const webhookTokenMap = new Map<string, string>();
export const dnsChecks = new Map<string, DnsCheck>();
export const dnsResults = new Map<string, DnsCheckResult[]>();
export const tcpChecks = new Map<string, TcpCheck>();
export const tcpResults = new Map<string, TcpCheckResult[]>();
export const monitoringSettings = new Map<string, MonitoringSettings>();
export const statusPages = new Map<string, StatusPage>();
export const statusPagesBySlug = new Map<string, string>();
export const statusPageIncidents = new Map<string, StatusPageIncident[]>();
export const statusPageSubscriptions = new Map<string, StatusPageSubscription[]>();
export const onCallSchedules = new Map<string, OnCallSchedule>();
export const escalationPolicies = new Map<string, EscalationPolicy>();
export const deletedCheckHistory = new Map<string, DeletedCheckHistory>();
export const alertGroupingRules = new Map<string, AlertGroupingRule>();
export const alertGroups = new Map<string, AlertGroup>();
export const alertRoutingRules = new Map<string, AlertRoutingRule>();
export const alertRoutingLogs = new Map<string, AlertRoutingLog[]>();
export const alertRateLimitConfigs = new Map<string, AlertRateLimitConfig>();
export const alertRateLimitStates = new Map<string, AlertRateLimitState>();
export const alertCorrelationConfigs = new Map<string, AlertCorrelationConfig>();
export const alertCorrelations = new Map<string, AlertCorrelation>();
export const alertToCorrelation = new Map<string, string>();
export const alertRunbooks = new Map<string, AlertRunbook>();
export const managedIncidents = new Map<string, ManagedIncident>();
export const incidentsByOrg = new Map<string, string[]>();
