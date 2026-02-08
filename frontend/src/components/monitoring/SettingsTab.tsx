/**
 * SettingsTab Component
 * Feature #47: Extracted from MonitoringPage.tsx for modularity
 *
 * This is a placeholder component that renders a simplified settings view.
 * Full settings functionality is retained in MonitoringPage.tsx for now.
 */

import { useState } from 'react';
import { toast } from '../../stores/toastStore';
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
 EscalationTarget,
 AlertRoutingCondition,
 AlertRoutingDestination,
 AlertRunbookStep,
} from './types';

// Define props interface for all settings data and callbacks
export interface SettingsTabProps {
 token: string;

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

 // Status pages
 statusPages: StatusPage[];
 availableChecksForStatus: AvailableCheck[];
 isLoadingStatusPages: boolean;
 onCreateStatusPage: () => void;
 onEditStatusPage: (page: StatusPage) => void;
 onDeleteStatusPage: (pageId: string) => Promise<void>;
 onOpenIncidentManagement: (page: StatusPage) => void;

 // On-call schedules
 onCallSchedules: OnCallSchedule[];
 isLoadingOnCallSchedules: boolean;
 onCreateOnCallSchedule: () => void;
 onEditOnCallSchedule: (schedule: OnCallSchedule) => void;
 onDeleteOnCallSchedule: (scheduleId: string) => Promise<void>;
 onRotateOnCallSchedule: (scheduleId: string) => Promise<void>;

 // Escalation policies
 escalationPolicies: EscalationPolicy[];
 isLoadingEscalationPolicies: boolean;
 onCreateEscalationPolicy: () => void;
 onEditEscalationPolicy: (policy: EscalationPolicy) => void;
 onDeleteEscalationPolicy: (policyId: string) => Promise<void>;
 onTestEscalationPolicy: (policyId: string) => Promise<void>;

 // Alert grouping
 alertGroupingRules: AlertGroupingRule[];
 alertGroups: AlertGroup[];
 isLoadingAlertGrouping: boolean;
 onCreateAlertGroupingRule: () => void;
 onEditAlertGroupingRule: (rule: AlertGroupingRule) => void;
 onDeleteAlertGroupingRule: (ruleId: string) => Promise<void>;
 onSimulateAlertGrouping: () => Promise<void>;
 onAcknowledgeAlertGroup: (groupId: string) => Promise<void>;
 onResolveAlertGroup: (groupId: string) => Promise<void>;
 onSnoozeAlertGroup: (groupId: string, hours: number) => Promise<void>;

 // Alert routing
 alertRoutingRules: AlertRoutingRule[];
 alertRoutingLogs: AlertRoutingLog[];
 isLoadingAlertRouting: boolean;
 onCreateAlertRoutingRule: () => void;
 onEditAlertRoutingRule: (rule: AlertRoutingRule) => void;
 onDeleteAlertRoutingRule: (ruleId: string) => Promise<void>;
 onToggleAlertRoutingRule: (ruleId: string, enabled: boolean) => Promise<void>;
 onTestAlertRouting: () => void;

 // Severity mapping
 globalSeverityMapping: GlobalSeverityMapping;
 setGlobalSeverityMapping: React.Dispatch<React.SetStateAction<GlobalSeverityMapping>>;

 // Rate limiting
 alertRateLimitConfig: AlertRateLimitConfig;
 setAlertRateLimitConfig: React.Dispatch<React.SetStateAction<AlertRateLimitConfig>>;
 rateLimitStats: RateLimitStats | null;

 // Alert correlation
 alertCorrelationConfig: AlertCorrelationConfig;
 setAlertCorrelationConfig: React.Dispatch<React.SetStateAction<AlertCorrelationConfig>>;
 alertCorrelations: AlertCorrelation[];
 onAcknowledgeCorrelation: (correlationId: string) => Promise<void>;

 // Runbooks
 alertRunbooks: AlertRunbook[];
 isLoadingRunbooks: boolean;
 onCreateRunbook: () => void;
 onEditRunbook: (runbook: AlertRunbook) => void;
 onDeleteRunbook: (runbookId: string) => Promise<void>;
 onTestRunbook: (runbookId: string) => Promise<void>;

 // Managed incidents
 managedIncidents: ManagedIncident[];
 isLoadingManagedIncidents: boolean;
 onCreateManagedIncident: () => void;
 onUpdateManagedIncidentStatus: (incidentId: string, newStatus: ManagedIncident['status']) => Promise<void>;
 onAssignManagedResponder: (incidentId: string) => Promise<void>;
 onResolveManagedIncident: (incidentId: string) => Promise<void>;

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
}

/**
 * SettingsTab - Placeholder component for monitoring settings
 *
 * Note: This is a simplified version. The full settings implementation
 * is still in MonitoringPage.tsx. This component will be expanded
 * as we progressively refactor.
 */
export default function SettingsTab({
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
 statusPages,
 isLoadingStatusPages,
 onCreateStatusPage,
 onEditStatusPage,
 onDeleteStatusPage,
 onOpenIncidentManagement,
 onCallSchedules,
 isLoadingOnCallSchedules,
 onCreateOnCallSchedule,
 onEditOnCallSchedule,
 onDeleteOnCallSchedule,
 onRotateOnCallSchedule,
 escalationPolicies,
 isLoadingEscalationPolicies,
 onCreateEscalationPolicy,
 onEditEscalationPolicy,
 onDeleteEscalationPolicy,
 onTestEscalationPolicy,
}: Partial<SettingsTabProps>) {
 if (isLoadingSettings) {
 return (
 <div className="flex items-center justify-center py-12">
 <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
 </div>
 );
 }

 return (
 <div className="space-y-6">
 {/* Retention Settings Card */}
 <div className="rounded-lg border border-border bg-card p-6">
 <h3 className="text-lg font-semibold text-foreground mb-4">📦 Data Retention Settings</h3>
 <p className="text-sm text-muted-foreground mb-6">
 Configure how long check results are retained. Older results will be automatically cleaned up.
 </p>

 <div className="space-y-4">
 <div>
 <label htmlFor="retention-period" className="block text-sm font-medium text-foreground mb-2">
 Retention Period
 </label>
 <select
 id="retention-period"
 aria-describedby="retention-period-desc"
 value={settingsRetentionDays}
 onChange={(e) => setSettingsRetentionDays?.(Number(e.target.value) as 30 | 90 | 365)}
 className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-foreground"
 >
 <option value={30}>30 days</option>
 <option value={90}>90 days</option>
 <option value={365}>365 days (1 year)</option>
 </select>
 <p id="retention-period-desc" className="mt-1 text-xs text-muted-foreground">
 Results older than this will be removed during cleanup
 </p>
 </div>

 <div className="flex items-center gap-3">
 <input
 type="checkbox"
 id="autoCleanup"
 checked={settingsAutoCleanup}
 onChange={(e) => setSettingsAutoCleanup?.(e.target.checked)}
 className="h-4 w-4 rounded border-input"
 />
 <label htmlFor="autoCleanup" className="text-sm text-foreground">
 Enable automatic cleanup
 </label>
 </div>

 <div className="flex items-center gap-4 pt-4">
 <button
 onClick={saveMonitoringSettings}
 disabled={isSavingSettings}
 className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
 >
 {isSavingSettings ? 'Saving...' : 'Save Settings'}
 </button>
 <button
 onClick={runRetentionCleanup}
 disabled={isRunningCleanup}
 className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
 >
 {isRunningCleanup ? 'Running...' : 'Run Cleanup Now'}
 </button>
 </div>

 {monitoringSettings?.last_cleanup_at && (
 <p className="text-xs text-muted-foreground">
 Last cleanup: {new Date(monitoringSettings.last_cleanup_at).toLocaleString()}
 </p>
 )}
 </div>
 </div>

 {/* Retention Statistics Card */}
 {retentionStats && (
 <div className="rounded-lg border border-border bg-card p-6">
 <h3 className="text-lg font-semibold text-foreground mb-4">📊 Result Statistics by Age</h3>
 <p className="text-sm text-muted-foreground mb-6">
 Overview of stored check results grouped by age. Current retention: <strong>{retentionStats.retention_days} days</strong>
 </p>

 <div className="overflow-x-auto">
 <table className="w-full">
 <thead className="bg-muted/50">
 <tr>
 <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Check Type</th>
 <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Total</th>
 <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Last 30d</th>
 <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">30-90d</th>
 <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">90-365d</th>
 <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Older</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-border">
 {[
 { name: 'Uptime Checks', data: retentionStats.stats.uptime, icon: '🌐' },
 { name: 'Transactions', data: retentionStats.stats.transaction, icon: '🔄' },
 { name: 'Performance', data: retentionStats.stats.performance, icon: '⚡' },
 { name: 'Webhooks', data: retentionStats.stats.webhook, icon: '🔗' },
 ].map(({ name, data, icon }) => (
 <tr key={name} className="hover:bg-muted/30">
 <td className="px-4 py-3 font-medium text-foreground">
 {icon} {name}
 </td>
 <td className="px-4 py-3 text-right text-sm">{data.total}</td>
 <td className="px-4 py-3 text-right text-sm text-success">{data.last30}</td>
 <td className="px-4 py-3 text-right text-sm text-warning">{data.last90}</td>
 <td className="px-4 py-3 text-right text-sm text-orange-600">{data.last365}</td>
 <td className="px-4 py-3 text-right text-sm text-destructive">{data.older}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>

 <div className="mt-4 p-4 bg-muted/30 rounded-lg">
 <p className="text-sm text-muted-foreground">
 💡 <strong>Tip:</strong> Results in the red column (older than {retentionStats.retention_days} days based on your retention setting) will be removed during cleanup.
 </p>
 </div>
 </div>
 )}

 {/* Status Page Settings Card */}
 <div className="rounded-lg border border-border bg-card p-6">
 <div className="flex items-center justify-between mb-4">
 <div>
 <h3 className="text-lg font-semibold text-foreground">📊 Public Status Pages</h3>
 <p className="text-sm text-muted-foreground mt-1">
 Create public status pages to share your service status with external users
 </p>
 </div>
 <button
 onClick={onCreateStatusPage}
 className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
 >
 Create Status Page
 </button>
 </div>

 {isLoadingStatusPages ? (
 <div className="flex items-center justify-center py-8">
 <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
 </div>
 ) : statusPages?.length === 0 ? (
 <div className="rounded-lg border border-dashed border-border p-8 text-center">
 <div className="text-4xl mb-3">📄</div>
 <h4 className="font-medium text-foreground mb-2">No status pages yet</h4>
 <p className="text-sm text-muted-foreground mb-4">
 Create a public status page to share your service status with customers
 </p>
 </div>
 ) : (
 <div className="space-y-3">
 {statusPages?.map(page => (
 <div key={page.id} className="rounded-lg border border-border p-4 hover:bg-muted/30">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div
 className="w-3 h-3 rounded-full"
 style={{ backgroundColor: page.primary_color || '#2563EB' }}
 />
 <div>
 <h4 className="font-medium text-foreground">{page.name}</h4>
 <p className="text-xs text-muted-foreground">
 /{page.slug} • {page.checks.length} checks • {page.is_public ? '🌐 Public' : '🔒 Private'}
 </p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 <a
 href={`/status/${page.slug}`}
 target="_blank"
 rel="noopener noreferrer"
 className="rounded px-3 py-1.5 text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20"
 >
 View Page
 </a>
 <button
 onClick={() => onEditStatusPage?.(page)}
 className="rounded px-3 py-1.5 text-xs font-medium bg-muted text-foreground hover:bg-muted/80"
 >
 Edit
 </button>
 <button
 onClick={() => onOpenIncidentManagement?.(page)}
 className="rounded px-3 py-1.5 text-xs font-medium bg-orange-100 text-orange-700 hover:bg-orange-200"
 >
 Incidents
 </button>
 <button
 onClick={() => onDeleteStatusPage?.(page.id)}
 className="rounded px-3 py-1.5 text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20"
 >
 Delete
 </button>
 </div>
 </div>
 {page.description && (
 <p className="mt-2 text-sm text-muted-foreground">{page.description}</p>
 )}
 </div>
 ))}
 </div>
 )}
 </div>

 {/* On-Call Schedules Card */}
 <div className="rounded-lg border border-border bg-card p-6">
 <div className="flex items-center justify-between mb-4">
 <div>
 <h3 className="text-lg font-semibold text-foreground">📞 On-Call Schedules</h3>
 <p className="text-sm text-muted-foreground mt-1">
 Manage on-call rotation schedules for your team
 </p>
 </div>
 <button
 onClick={onCreateOnCallSchedule}
 className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
 >
 Create Schedule
 </button>
 </div>

 {isLoadingOnCallSchedules ? (
 <div className="flex items-center justify-center py-8">
 <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
 </div>
 ) : onCallSchedules?.length === 0 ? (
 <div className="rounded-lg border border-dashed border-border p-8 text-center">
 <div className="text-4xl mb-3">📅</div>
 <h4 className="font-medium text-foreground mb-2">No on-call schedules yet</h4>
 <p className="text-sm text-muted-foreground mb-4">
 Create an on-call schedule to manage team rotations
 </p>
 </div>
 ) : (
 <div className="space-y-3">
 {onCallSchedules?.map(schedule => {
 const currentOnCall = schedule.members[schedule.current_on_call_index];
 return (
 <div key={schedule.id} className="rounded-lg border border-border p-4 hover:bg-muted/30">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className={`w-3 h-3 rounded-full ${schedule.is_active ? 'bg-success' : 'bg-muted-foreground'}`} />
 <div>
 <h4 className="font-medium text-foreground">{schedule.name}</h4>
 <p className="text-xs text-muted-foreground">
 {schedule.rotation_type === 'daily' ? 'Daily' : schedule.rotation_type === 'weekly' ? 'Weekly' : `Every ${schedule.rotation_interval_days} days`} rotation • {schedule.members.length} members • {schedule.timezone}
 </p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 <button
 onClick={() => onRotateOnCallSchedule?.(schedule.id)}
 className="rounded px-3 py-1.5 text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20"
 title="Manual rotation"
 >
 🔄 Rotate
 </button>
 <button
 onClick={() => onEditOnCallSchedule?.(schedule)}
 className="rounded px-3 py-1.5 text-xs font-medium bg-muted text-foreground hover:bg-muted/80"
 >
 Edit
 </button>
 <button
 onClick={() => onDeleteOnCallSchedule?.(schedule.id)}
 className="rounded px-3 py-1.5 text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20"
 >
 Delete
 </button>
 </div>
 </div>
 {currentOnCall && (
 <div className="mt-3 p-3 bg-success/5 rounded-lg">
 <p className="text-sm font-medium text-success">
 🟢 Currently On-Call: {currentOnCall.user_name}
 </p>
 <p className="text-xs text-success">
 {currentOnCall.user_email} {currentOnCall.phone && `• ${currentOnCall.phone}`}
 </p>
 </div>
 )}
 {schedule.description && (
 <p className="mt-2 text-sm text-muted-foreground">{schedule.description}</p>
 )}
 </div>
 );
 })}
 </div>
 )}
 </div>

 {/* Escalation Policies Card */}
 <div className="rounded-lg border border-border bg-card p-6">
 <div className="flex items-center justify-between mb-4">
 <div>
 <h3 className="text-lg font-semibold text-foreground">📈 Escalation Policies</h3>
 <p className="text-sm text-muted-foreground mt-1">
 Define how alerts escalate through your team
 </p>
 </div>
 <button
 onClick={onCreateEscalationPolicy}
 className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
 >
 Create Policy
 </button>
 </div>

 {isLoadingEscalationPolicies ? (
 <div className="flex items-center justify-center py-8">
 <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
 </div>
 ) : escalationPolicies?.length === 0 ? (
 <div className="rounded-lg border border-dashed border-border p-8 text-center">
 <div className="text-4xl mb-3">📋</div>
 <h4 className="font-medium text-foreground mb-2">No escalation policies yet</h4>
 <p className="text-sm text-muted-foreground mb-4">
 Create an escalation policy to define how alerts route through your team
 </p>
 </div>
 ) : (
 <div className="space-y-3">
 {escalationPolicies?.map(policy => (
 <div key={policy.id} className="rounded-lg border border-border p-4 hover:bg-muted/30">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className={`w-3 h-3 rounded-full ${policy.is_active ? 'bg-success' : 'bg-muted-foreground'}`} />
 <div>
 <h4 className="font-medium text-foreground">
 {policy.name}
 {policy.is_default && <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Default</span>}
 </h4>
 <p className="text-xs text-muted-foreground">
 {policy.levels.length} levels • {policy.repeat_policy === 'repeat_until_acknowledged' ? 'Repeats' : 'Once'}
 </p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 <button
 onClick={() => onTestEscalationPolicy?.(policy.id)}
 className="rounded px-3 py-1.5 text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20"
 >
 🧪 Test
 </button>
 <button
 onClick={() => onEditEscalationPolicy?.(policy)}
 className="rounded px-3 py-1.5 text-xs font-medium bg-muted text-foreground hover:bg-muted/80"
 >
 Edit
 </button>
 <button
 onClick={() => onDeleteEscalationPolicy?.(policy.id)}
 className="rounded px-3 py-1.5 text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20"
 >
 Delete
 </button>
 </div>
 </div>
 {policy.description && (
 <p className="mt-2 text-sm text-muted-foreground">{policy.description}</p>
 )}
 </div>
 ))}
 </div>
 )}
 </div>

 {/* Note about additional settings */}
 <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
 <p className="text-sm text-muted-foreground">
 Additional settings (Alert Grouping, Alert Routing, Severity Mapping, Rate Limiting, Correlation, Runbooks, Incident Management) are available in the full settings panel.
 </p>
 </div>
 </div>
 );
}
