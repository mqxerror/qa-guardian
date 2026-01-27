/**
 * Monitoring Stores Module
 *
 * In-memory data stores for monitoring data.
 * Extracted from monitoring.ts (Feature #1374)
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

// Uptime checks and results
export const uptimeChecks: Map<string, UptimeCheck> = new Map();
export const checkResults: Map<string, CheckResult[]> = new Map();

// Transaction checks and results
export const transactionChecks: Map<string, TransactionCheck> = new Map();
export const transactionResults: Map<string, TransactionResult[]> = new Map();

// Performance checks and results
export const performanceChecks: Map<string, PerformanceCheck> = new Map();
export const performanceResults: Map<string, PerformanceResult[]> = new Map();

// Maintenance windows: checkId -> windows
export const maintenanceWindows: Map<string, MaintenanceWindow[]> = new Map();

// Incidents: checkId -> incidents (closed ones)
export const checkIncidents: Map<string, Incident[]> = new Map();

// Active incidents: checkId -> incident (ongoing)
export const activeIncidents: Map<string, Incident> = new Map();

// Consecutive failures tracking: checkId -> count
export const consecutiveFailures: Map<string, number> = new Map();

// Check intervals for cleanup: checkId -> NodeJS.Timeout
export const checkIntervals: Map<string, NodeJS.Timeout> = new Map();

// Webhook checks and events
export const webhookChecks: Map<string, WebhookCheck> = new Map();
export const webhookEvents: Map<string, WebhookEvent[]> = new Map(); // checkId -> events
export const webhookTokenMap: Map<string, string> = new Map(); // token -> checkId

// DNS checks and results
export const dnsChecks: Map<string, DnsCheck> = new Map();
export const dnsResults: Map<string, DnsCheckResult[]> = new Map(); // checkId -> results

// TCP checks and results
export const tcpChecks: Map<string, TcpCheck> = new Map();
export const tcpResults: Map<string, TcpCheckResult[]> = new Map(); // checkId -> results

// Organization monitoring settings
export const monitoringSettings: Map<string, MonitoringSettings> = new Map(); // orgId -> settings

// Status pages
export const statusPages: Map<string, StatusPage> = new Map(); // statusPageId -> statusPage
export const statusPagesBySlug: Map<string, string> = new Map(); // slug -> statusPageId (for public access)
export const statusPageIncidents: Map<string, StatusPageIncident[]> = new Map(); // statusPageId -> incidents
export const statusPageSubscriptions: Map<string, StatusPageSubscription[]> = new Map(); // statusPageId -> subscriptions

// On-call schedules
export const onCallSchedules: Map<string, OnCallSchedule> = new Map(); // scheduleId -> schedule

// Escalation policies
export const escalationPolicies: Map<string, EscalationPolicy> = new Map(); // policyId -> policy

// Feature #943: Deleted check history storage for audit purposes
export const deletedCheckHistory: Map<string, DeletedCheckHistory> = new Map(); // checkId -> deleted history

// Alert grouping
export const alertGroupingRules: Map<string, AlertGroupingRule> = new Map(); // ruleId -> rule
export const alertGroups: Map<string, AlertGroup> = new Map(); // groupId -> group

// Alert routing
export const alertRoutingRules: Map<string, AlertRoutingRule> = new Map(); // ruleId -> rule
export const alertRoutingLogs: Map<string, AlertRoutingLog[]> = new Map(); // orgId -> logs

// Alert rate limiting
export const alertRateLimitConfigs: Map<string, AlertRateLimitConfig> = new Map(); // orgId -> config
export const alertRateLimitStates: Map<string, AlertRateLimitState> = new Map(); // orgId -> state

// Alert correlation
export const alertCorrelationConfigs: Map<string, AlertCorrelationConfig> = new Map(); // orgId -> config
export const alertCorrelations: Map<string, AlertCorrelation> = new Map(); // correlationId -> correlation
export const alertToCorrelation: Map<string, string> = new Map(); // alertId -> correlationId (for quick lookup)

// Alert runbooks
export const alertRunbooks: Map<string, AlertRunbook> = new Map(); // runbookId -> runbook

// Managed incidents
export const managedIncidents: Map<string, ManagedIncident> = new Map(); // incidentId -> incident
export const incidentsByOrg: Map<string, string[]> = new Map(); // orgId -> incidentIds
