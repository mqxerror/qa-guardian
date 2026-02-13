// OrganizationSettingsPage - Extracted from App.tsx
// Feature #636: Adopt Modal component in page-level inline modals
// Feature #1441: Split App.tsx into logical modules
// Feature #709: Migrate to React Query and extract inline interfaces
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore, Theme } from '../stores/themeStore';
import { useNotificationStore } from '../stores/notificationStore';
import { useTimezoneStore } from '../stores/timezoneStore';
import { useTestDefaultsStore } from '../stores/testDefaultsStore';
import { useArtifactRetentionStore } from '../stores/artifactRetentionStore';
import { useOrganizationBrandingStore } from '../stores/organizationBrandingStore';
import { toast } from '../stores/toastStore';
import { createLogger } from '../utils/logger';
import { Modal, ModalBody, ModalFooter } from '../components/ui/Modal';
import { PageHeader } from '../components/ui';
// Feature #728: EmptyState adoption
import { EmptyState, EmptyStateIcons } from '../components/ui/EmptyState';
import { Loader2, AlertTriangle, Wifi, FileText, BarChart3, LayoutGrid, Search, CheckCircle2, Link2, X, ImageIcon, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Feature #709: Import React Query hooks
// Feature #712: Added useCleanupPreview to eliminate raw fetch()
import {
  useSessions,
  useLogoutSession,
  useLogoutAllSessions,
  useArtifactRetention,
  useSaveArtifactRetention,
  useCleanupPreview,
  useRunCleanup,
  useStorageUsage,
  useMcpConnections,
  useMcpAuditLogs,
  useMcpAnalytics,
  useExportMcpAnalytics,
  useSlackConnection,
  useConnectSlack,
  useDisconnectSlack,
  useAdminMembers,
  useTransferOwnership,
  useDeleteOrganization,
} from '../hooks/api';

// Feature #709: Import shared types from organization-settings
import type {
  SessionInfo,
  MCPConnection,
  McpAuditLogEntry,
  MCPToolInfo,
  SlackConnectionData,
} from '../components/organization-settings';

const logger = createLogger('org-settings');

function SessionManagementSection() {
 // Feature #709: Use React Query for session management
 const { data: sessions = [], isLoading } = useSessions();
 const logoutSessionMutation = useLogoutSession();
 const logoutAllMutation = useLogoutAllSessions();
 const [loggingOutSessionId, setLoggingOutSessionId] = useState<string | null>(null);

 const handleLogoutSession = async (sessionId: string) => {
   setLoggingOutSessionId(sessionId);
   try {
     await logoutSessionMutation.mutateAsync(sessionId);
     toast.success('Session logged out successfully');
   } catch {
     toast.error('Failed to logout session');
   } finally {
     setLoggingOutSessionId(null);
   }
 };

 const handleLogoutAllSessions = async () => {
   try {
     const result = await logoutAllMutation.mutateAsync();
     toast.success(result.message || 'All other sessions logged out');
   } catch {
     toast.error('Failed to logout all sessions');
   }
 };

 const formatDate = (dateStr: string) => {
 const date = new Date(dateStr);
 return date.toLocaleString();
 };

 const getDeviceIcon = (device: string) => {
 if (device.includes('iPhone') || device.includes('Android Phone')) {
 return '📱';
 } else if (device.includes('iPad') || device.includes('Android Tablet')) {
 return '📱';
 } else if (device.includes('Mac')) {
 return '💻';
 } else if (device.includes('Windows')) {
 return '🖥️';
 } else if (device.includes('Linux')) {
 return '🐧';
 }
 return '💻';
 };

 const getBrowserIcon = (browser: string) => {
 if (browser === 'Chrome') return '🌐';
 if (browser === 'Firefox') return '🦊';
 if (browser === 'Safari') return '🧭';
 if (browser === 'Edge') return '🌀';
 return '🌐';
 };

 return (
 <div className="mt-6 rounded-lg border border-border bg-card p-6">
 <h3 className="text-lg font-semibold text-foreground">Session Management</h3>
 <p className="text-sm text-muted-foreground mt-1">
 View and manage your active sessions across different devices and browsers.
 </p>

 {isLoading ? (
 <div className="mt-4 flex items-center justify-center py-8">
 <Loader2 aria-hidden="true" className="animate-spin h-6 w-6 text-primary" />
 <span className="ml-2 text-muted-foreground">Loading sessions...</span>
 </div>
 ) : sessions.length === 0 ? (
 /* Feature #728: EmptyState adoption */
 <div className="mt-4">
 <EmptyState icon={EmptyStateIcons.users} title="No active sessions found" size="sm" />
 </div>
 ) : (
 <div className="mt-4 space-y-3">
 {sessions.map((session) => (
 <div
 key={session.id}
 className={`flex items-center justify-between p-4 rounded-lg border ${
 session.is_current
 ? 'border-primary/50 bg-primary/5'
 : 'border-border bg-background'
 }`}
 >
 <div className="flex items-center gap-4">
 <div className="text-2xl">
 {getDeviceIcon(session.device)}
 </div>
 <div>
 <div className="font-medium text-foreground flex items-center gap-2">
 {session.device} • {session.browser} {getBrowserIcon(session.browser)}
 {session.is_current && (
 <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
 Current Session
 </span>
 )}
 </div>
 <div className="text-sm text-muted-foreground">
 IP: {session.ip_address}
 </div>
 <div className="text-xs text-muted-foreground">
 Last active: {formatDate(session.last_active)} • Started: {formatDate(session.created_at)}
 </div>
 </div>
 </div>
 {!session.is_current && (
 <Button
 variant="outline"
 size="sm"
 onClick={() => handleLogoutSession(session.id)}
 disabled={loggingOutSessionId === session.id}
 className="text-destructive border-destructive/50 hover:bg-destructive/10"
 >
 {loggingOutSessionId === session.id ? 'Logging out...' : 'Logout'}
 </Button>
 )}
 </div>
 ))}

 {sessions.length > 1 && (
 <div className="pt-4 border-t border-border">
 <Button
 variant="outline"
 onClick={handleLogoutAllSessions}
 disabled={logoutAllMutation.isPending}
 className="w-full text-destructive border-destructive/50 hover:bg-destructive/10"
 >
 {logoutAllMutation.isPending && (
 <Loader2 aria-hidden="true" className="animate-spin h-4 w-4" />
 )}
 {logoutAllMutation.isPending ? 'Logging out all sessions...' : 'Logout All Other Sessions'}
 </Button>
 </div>
 )}
 </div>
 )}
 </div>
 );
}

function ArtifactRetentionSection() {
 const { user } = useAuthStore();
 const { settings, setRetentionDays } = useArtifactRetentionStore();

 // Feature #709: Use React Query for artifact retention
 // Feature #712: Added useCleanupPreview to eliminate raw fetch()
 const { data: retentionData } = useArtifactRetention();
 const saveRetentionMutation = useSaveArtifactRetention();
 const runCleanupMutation = useRunCleanup();
 const { data: cleanupPreviewData, isFetching: isLoadingPreview, refetch: refetchPreview } = useCleanupPreview();

 const [localRetentionDays, setLocalRetentionDays] = useState(settings.retentionDays);
 const [cleanupPreview, setCleanupPreview] = useState<{
   runs_to_delete: number;
   runs_preserved: number;
   trace_files_to_delete: number;
   estimated_space_freed_mb: number;
 } | null>(null);
 const [lastCleanupResult, setLastCleanupResult] = useState<{
   runs_deleted: number;
   trace_files_deleted: number;
   mb_freed: number;
 } | null>(null);

 // Sync with fetched data
 useEffect(() => {
   if (retentionData?.retention_days) {
     setRetentionDays(retentionData.retention_days);
     setLocalRetentionDays(retentionData.retention_days);
   }
 }, [retentionData, setRetentionDays]);

 useEffect(() => {
   setLocalRetentionDays(settings.retentionDays);
 }, [settings.retentionDays]);

 const handleSaveRetention = async () => {
   try {
     await saveRetentionMutation.mutateAsync(localRetentionDays);
     setRetentionDays(localRetentionDays);
     toast.success('Artifact retention policy saved!');
     setCleanupPreview(null);
   } catch (err) {
     toast.error((err as Error).message || 'Failed to save retention policy');
   }
 };

 // Feature #712: Use React Query refetch instead of raw fetch
 const handlePreviewCleanup = async () => {
   if (!user?.organization_id) return;
   try {
     const result = await refetchPreview();
     if (result.data) {
       setCleanupPreview(result.data);
     }
   } catch {
     toast.error('Failed to load cleanup preview');
   }
 };

 // Sync preview data from React Query
 useEffect(() => {
   if (cleanupPreviewData) {
     setCleanupPreview(cleanupPreviewData);
   }
 }, [cleanupPreviewData]);

 const handleRunCleanup = async () => {
   try {
     const result = await runCleanupMutation.mutateAsync();
     setLastCleanupResult({
       runs_deleted: result.runs_deleted,
       trace_files_deleted: result.trace_files_deleted,
       mb_freed: result.mb_freed,
     });
     setCleanupPreview(null);
     toast.success(`Cleanup complete: ${result.runs_deleted} runs, ${result.trace_files_deleted} trace files deleted`);
   } catch {
     toast.error('Failed to run cleanup');
   }
 };

 const canManageRetention = user?.role === 'owner' || user?.role === 'admin';

 return (
 <div className="mt-6 rounded-lg border border-border bg-card p-6">
 <h3 className="text-lg font-semibold text-foreground">Artifact Retention</h3>
 <p className="text-sm text-muted-foreground mt-1">
 Configure how long test artifacts (screenshots, traces, videos) are retained before automatic cleanup.
 </p>
 <div className="mt-4 space-y-4">
 <div>
 <label htmlFor="retentionDays" className="mb-1 block text-sm font-medium text-foreground">
 Retention Period (days)
 </label>
 <p className="text-xs text-muted-foreground mb-2">
 Artifacts older than this will be eligible for cleanup. Range: 1-365 days.
 </p>
 <div className="flex items-center gap-3">
 <input
 id="retentionDays"
 type="number"
 min="1"
 max="365"
 value={localRetentionDays}
 onChange={(e) => setLocalRetentionDays(Math.max(1, Math.min(365, parseInt(e.target.value, 10) || 1)))}
 disabled={!canManageRetention}
 className="w-32 rounded-md border border-input bg-background px-3 py-2 text-foreground disabled:opacity-50"
 />
 <span className="text-sm text-muted-foreground">
 ({localRetentionDays === 1 ? '1 day' : `${localRetentionDays} days`})
 </span>
 {canManageRetention && localRetentionDays !== settings.retentionDays && (
 <Button
 size="sm"
 onClick={handleSaveRetention}
 disabled={saveRetentionMutation.isPending}
 >
 {saveRetentionMutation.isPending ? 'Saving...' : 'Save'}
 </Button>
 )}
 </div>
 </div>

 {canManageRetention && (
 <div className="border-t border-border pt-4 mt-4">
 <h4 className="text-sm font-medium text-foreground mb-2">Cleanup Actions</h4>
 <div className="flex flex-wrap gap-3">
 <Button
 variant="outline"
 size="sm"
 onClick={handlePreviewCleanup}
 disabled={isLoadingPreview}
 >
 {isLoadingPreview ? 'Loading...' : 'Preview Cleanup'}
 </Button>
 <Button
 size="sm"
 onClick={handleRunCleanup}
 disabled={runCleanupMutation.isPending}
 className="bg-warning text-primary-foreground hover:bg-warning/90"
 >
 {runCleanupMutation.isPending ? 'Running Cleanup...' : 'Run Cleanup Now'}
 </Button>
 </div>

 {cleanupPreview && (
 <div className="mt-4 rounded-md bg-muted/50 p-4">
 <h5 className="text-sm font-medium text-foreground mb-2">Cleanup Preview</h5>
 <div className="grid grid-cols-2 gap-4 text-sm">
 <div>
 <span className="text-muted-foreground">Test runs to delete:</span>{' '}
 <span className="font-medium text-foreground">{cleanupPreview.runs_to_delete}</span>
 </div>
 <div>
 <span className="text-muted-foreground">Test runs preserved:</span>{' '}
 <span className="font-medium text-foreground">{cleanupPreview.runs_preserved}</span>
 </div>
 <div>
 <span className="text-muted-foreground">Trace files to delete:</span>{' '}
 <span className="font-medium text-foreground">{cleanupPreview.trace_files_to_delete}</span>
 </div>
 <div>
 <span className="text-muted-foreground">Estimated space freed:</span>{' '}
 <span className="font-medium text-foreground">{cleanupPreview.estimated_space_freed_mb} MB</span>
 </div>
 </div>
 </div>
 )}

 {lastCleanupResult && (
 <div className="mt-4 rounded-md bg-success/5 border border-success/20 p-4">
 <h5 className="text-sm font-medium text-success mb-2">Last Cleanup Result</h5>
 <div className="text-sm text-success">
 Deleted {lastCleanupResult.runs_deleted} test runs and {lastCleanupResult.trace_files_deleted} trace files,
 freeing {lastCleanupResult.mb_freed} MB of storage.
 </div>
 </div>
 )}
 </div>
 )}

 {!canManageRetention && (
 <p className="text-xs text-muted-foreground italic">
 Only organization owners and admins can modify retention policies.
 </p>
 )}
 </div>
 </div>
 );
}

function StorageUsageSection() {
 // Feature #709: Use React Query for storage usage
 const { data: storageData, isLoading } = useStorageUsage();

 if (isLoading) {
 return (
 <div className="mt-6 rounded-lg border border-border bg-card p-6">
 <h3 className="text-lg font-semibold text-foreground">Storage Usage</h3>
 <p className="text-sm text-muted-foreground mt-2">Loading storage information...</p>
 </div>
 );
 }

 if (!storageData) {
 return null;
 }

 const getProgressBarColor = (percent: number) => {
 if (percent >= 90) return 'bg-destructive';
 if (percent >= 80) return 'bg-warning';
 if (percent >= 60) return 'bg-warning';
 return 'bg-success';
 };

 return (
 <div className="mt-6 rounded-lg border border-border bg-card p-6">
 <h3 className="text-lg font-semibold text-foreground">Storage Usage</h3>
 <p className="text-sm text-muted-foreground mt-1">
 Track your artifact storage usage across all projects.
 </p>

 <div className="mt-4 space-y-4">
 <div>
 <div className="flex items-center justify-between mb-2">
 <span className="text-sm font-medium text-foreground">Total Storage Used</span>
 <span className="text-sm text-muted-foreground">
 {storageData.total_mb} MB / {storageData.storage_limit_mb} MB ({storageData.usage_percent}%)
 </span>
 </div>
 <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
 <div
 className={`h-full rounded-full transition-all ${getProgressBarColor(storageData.usage_percent)}`}
 style={{ width: `${Math.min(storageData.usage_percent, 100)}%` }}
 />
 </div>
 <p className="text-xs text-muted-foreground mt-1">
 {storageData.total_trace_files} trace files stored
 </p>
 </div>

 {storageData.is_warning && (
 <div className="rounded-md bg-warning/5 border border-warning/20 p-4">
 <div className="flex items-start gap-3">
 <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
 <div>
 <h4 className="text-sm font-medium text-warning">Storage Warning</h4>
 <p className="text-sm text-warning mt-1">
 You've used {storageData.usage_percent}% of your storage limit. Consider running artifact cleanup to free up space.
 </p>
 </div>
 </div>
 </div>
 )}

 {storageData.project_breakdown.length > 0 && (
 <div className="border-t border-border pt-4">
 <h4 className="text-sm font-medium text-foreground mb-3">Storage by Project</h4>
 <div className="space-y-3">
 {storageData.project_breakdown.map((project) => (
 <div key={project.project_id} className="flex items-center justify-between">
 <div className="flex-1 min-w-0">
 <p className="text-sm font-medium text-foreground truncate">{project.project_name}</p>
 <p className="text-xs text-muted-foreground">{project.trace_count} trace files</p>
 </div>
 <div className="ml-4 text-right">
 <p className="text-sm font-medium text-foreground">{project.mb} MB</p>
 <p className="text-xs text-muted-foreground">
 {storageData.total_mb > 0
 ? Math.round((project.mb / storageData.total_mb) * 100)
 : 0}%
 </p>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Feature #728: EmptyState adoption */}
 {storageData.project_breakdown.length === 0 && (
 <EmptyState icon={EmptyStateIcons.document} title="No artifacts stored yet" description="Run some tests to generate trace files." size="sm" />
 )}
 </div>
 </div>
 );
}

function MCPConnectionsSection() {
 // Feature #709: Use React Query for MCP connections
 const { data: connections = [], isLoading } = useMcpConnections();

 const formatDateTime = (dateStr: string) => new Date(dateStr).toLocaleString();

 if (isLoading) {
 return (
 <div className="mt-6 rounded-lg border border-border bg-card p-6">
 <h3 className="text-lg font-semibold text-foreground">MCP Connections</h3>
 <div className="mt-4 flex justify-center">
 <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
 </div>
 </div>
 );
 }

 return (
 <div className="mt-6 rounded-lg border border-border bg-card p-6">
 <div className="flex items-center gap-3 mb-2">
 <Wifi className="h-6 w-6 text-primary" />
 <h3 className="text-lg font-semibold text-foreground">MCP Connections</h3>
 <span className="ml-auto px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary">
 {connections.length} active
 </span>
 </div>
 <p className="text-sm text-muted-foreground mb-4">
 Active Model Context Protocol (MCP) connections from AI agents like Claude Code.
 </p>

 {connections.length === 0 ? (
 <div className="text-center py-8 border border-dashed border-border rounded-lg">
 <Wifi className="mx-auto h-12 w-12 text-muted-foreground/50" strokeWidth={1.5} />
 <p className="mt-3 text-sm text-muted-foreground">No active MCP connections</p>
 <p className="text-xs text-muted-foreground mt-1">Connect an AI agent using an API key with MCP scopes</p>
 </div>
 ) : (
 <div className="space-y-3">
 {connections.map((conn) => (
 <div key={conn.id} className="p-3 rounded-lg border border-border bg-muted/30">
 <div className="flex items-start justify-between">
 <div className="flex items-center gap-2">
 <div className="h-2 w-2 rounded-full bg-success animate-pulse"></div>
 <span className="font-medium text-foreground">{conn.api_key_name}</span>
 {conn.client_info?.transport && (
 <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
 {conn.client_info.transport.toUpperCase()}
 </span>
 )}
 </div>
 <span className="text-xs text-muted-foreground">{conn.connected_duration_formatted}</span>
 </div>
 <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
 <div><span className="text-muted-foreground/70">Connected:</span> <span className="text-foreground">{formatDateTime(conn.connected_at)}</span></div>
 <div><span className="text-muted-foreground/70">Last Activity:</span> <span className="text-foreground">{formatDateTime(conn.last_activity_at)}</span></div>
 {conn.ip_address && <div><span className="text-muted-foreground/70">IP:</span> <span className="text-foreground font-mono">{conn.ip_address}</span></div>}
 {conn.client_info?.user_agent && <div className="col-span-2"><span className="text-muted-foreground/70">Agent:</span> <span className="text-foreground">{conn.client_info.user_agent}</span></div>}
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 );
}

function MCPAuditLogSection() {
 const [selectedLog, setSelectedLog] = useState<McpAuditLogEntry | null>(null);
 const [filterMethod, setFilterMethod] = useState<string>('');
 const [filterStatus, setFilterStatus] = useState<string>('');
 const [currentPage, setCurrentPage] = useState(1);
 const pageSize = 10;

 // Feature #709: Use React Query for MCP audit logs
 const { data: auditData, isLoading } = useMcpAuditLogs({
   limit: pageSize,
   offset: (currentPage - 1) * pageSize,
   method: filterMethod || undefined,
   response_type: filterStatus || undefined,
 });
 const auditLogs = auditData?.logs || [];
 const totalLogs = auditData?.total || 0;

 const formatDateTime = (dateStr: string) => new Date(dateStr).toLocaleString();
 const getMethodIcon = (method: string) => {
 switch (method) {
 case 'initialize': return '🔌';
 case 'tools/call': return '🔧';
 case 'tools/list': return '📋';
 case 'resources/read': return '📖';
 case 'resources/list': return '📚';
 default: return '📡';
 }
 };

 const totalPages = Math.ceil(totalLogs / pageSize);

 if (isLoading) {
 return (
 <div className="mt-6 rounded-lg border border-border bg-card p-6">
 <h3 className="text-lg font-semibold text-foreground">MCP Audit Log</h3>
 <div className="mt-4 flex justify-center">
 <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
 </div>
 </div>
 );
 }

 return (
 <div className="mt-6 rounded-lg border border-border bg-card p-6">
 <div className="flex items-center gap-3 mb-2">
 <FileText className="h-6 w-6 text-primary" />
 <h3 className="text-lg font-semibold text-foreground">MCP Audit Log</h3>
 <span className="ml-auto px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary">{totalLogs} entries</span>
 </div>
 <p className="text-sm text-muted-foreground mb-4">Full audit trail of all MCP requests with timestamps, API keys, and request/response data.</p>

 <div className="flex gap-3 mb-4">
 <select value={filterMethod} onChange={(e) => { setFilterMethod(e.target.value); setCurrentPage(1); }} className="px-3 py-1.5 text-sm border border-input rounded-md bg-background text-foreground">
 <option value="">All Methods</option>
 <option value="initialize">Initialize</option>
 <option value="tools/call">Tools Call</option>
 <option value="tools/list">Tools List</option>
 <option value="resources/read">Resources Read</option>
 <option value="resources/list">Resources List</option>
 </select>
 <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }} className="px-3 py-1.5 text-sm border border-input rounded-md bg-background text-foreground">
 <option value="">All Status</option>
 <option value="success">Success</option>
 <option value="error">Error</option>
 </select>
 </div>

 {/* Feature #728: EmptyState adoption */}
 {auditLogs.length === 0 ? (
 <EmptyState icon={EmptyStateIcons.document} title="No MCP audit logs found" description="MCP tool invocations will be logged here." size="sm" />
 ) : (
 <>
 <div className="space-y-2">
 {auditLogs.map((log) => (
 <div key={log.id} onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)} className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedLog?.id === log.id ? 'border-primary bg-primary/5' : 'border-border bg-muted/30 hover:border-primary/50'}`}>
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <span className="text-lg">{getMethodIcon(log.method)}</span>
 <span className="font-medium text-foreground">{log.method}</span>
 {log.tool_name && <span className="text-sm text-muted-foreground">→ {log.tool_name}</span>}
 <span className={`text-xs px-1.5 py-0.5 rounded ${log.response_type === 'success' ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>{log.response_type}</span>
 </div>
 <span className="text-xs text-muted-foreground">{formatDateTime(log.timestamp)}</span>
 </div>
 <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
 <span>🔑 {log.api_key_name}</span>
 {log.duration_ms !== undefined && <span>⏱️ {log.duration_ms}ms</span>}
 </div>
 {selectedLog?.id === log.id && (
 <div className="mt-3 pt-3 border-t border-border space-y-2">
 {log.request_params && Object.keys(log.request_params).length > 0 && (
 <div>
 <span className="text-xs font-medium text-muted-foreground">Request Parameters:</span>
 <pre className="mt-1 p-2 text-xs bg-muted rounded overflow-x-auto">{JSON.stringify(log.request_params, null, 2)}</pre>
 </div>
 )}
 {log.response_type === 'error' && (
 <div>
 <span className="text-xs font-medium text-destructive">Error:</span>
 <div className="mt-1 p-2 text-xs bg-destructive/10 text-destructive rounded">{log.response_error_code && <span className="font-mono">[{log.response_error_code}] </span>}{log.response_error_message}</div>
 </div>
 )}
 </div>
 )}
 </div>
 ))}
 </div>
 {totalPages > 1 && (
 <div className="mt-4 flex items-center justify-between">
 <span className="text-sm text-muted-foreground">Showing {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, totalLogs)} of {totalLogs}</span>
 <div className="flex gap-2">
 <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
 <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
 </div>
 </div>
 )}
 </>
 )}
 </div>
 );
}

function MCPAnalyticsDashboard() {
 const [timePeriod, setTimePeriod] = useState<string>('7d');

 // Feature #709: Use React Query for MCP analytics
 const { data: analytics, isLoading } = useMcpAnalytics(timePeriod);
 const exportMutation = useExportMcpAnalytics();

 const handleExport = async (format: 'csv' | 'json') => {
   try {
     await exportMutation.mutateAsync({ format, timePeriod });
   } catch (err) {
     logger.error('Failed to export analytics:', err);
   }
 };

 const sortedTools = analytics ? Object.entries(analytics.by_tool).map(([name, stats]) => ({ name, ...stats })).sort((a, b) => b.count - a.count) : [];
 const sortedApiKeys = analytics ? Object.entries(analytics.by_api_key).map(([id, stats]) => ({ id, ...stats })).sort((a, b) => b.count - a.count) : [];
 const maxToolCount = sortedTools.length > 0 ? sortedTools[0].count : 1;
 const maxApiKeyCount = sortedApiKeys.length > 0 ? sortedApiKeys[0].count : 1;

 if (isLoading) {
 return (
 <div className="mt-6 rounded-lg border border-border bg-card p-6">
 <h3 className="text-lg font-semibold text-foreground">MCP Analytics Dashboard</h3>
 <div className="mt-4 flex justify-center"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div></div>
 </div>
 );
 }

 return (
 <div className="mt-6 rounded-lg border border-border bg-card p-6">
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-3">
 <BarChart3 className="h-6 w-6 text-primary" />
 <h3 className="text-lg font-semibold text-foreground">MCP Analytics Dashboard</h3>
 </div>
 <div className="flex items-center gap-2">
 <select value={timePeriod} onChange={(e) => setTimePeriod(e.target.value)} className="px-3 py-1.5 text-sm border border-input rounded-md bg-background text-foreground">
 <option value="24h">Last 24 Hours</option>
 <option value="7d">Last 7 Days</option>
 <option value="30d">Last 30 Days</option>
 <option value="90d">Last 90 Days</option>
 <option value="all">All Time</option>
 </select>
 <Button variant="outline" size="sm" onClick={() => handleExport('csv')} disabled={exportMutation.isPending}>
 {exportMutation.isPending ? 'Exporting...' : '📥 Export CSV'}
 </Button>
 </div>
 </div>
 <p className="text-sm text-muted-foreground mb-6">View MCP usage statistics, trends, and performance metrics.</p>

 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
 <div className="p-4 rounded-lg border border-border bg-muted/30"><div className="text-2xl font-bold text-foreground">{analytics?.total_calls || 0}</div><div className="text-sm text-muted-foreground">Total Requests</div></div>
 <div className="p-4 rounded-lg border border-border bg-success/10"><div className="text-2xl font-bold text-success">{analytics?.successful_calls || 0}</div><div className="text-sm text-muted-foreground">Successful</div></div>
 <div className="p-4 rounded-lg border border-border bg-destructive/10"><div className="text-2xl font-bold text-destructive">{analytics?.failed_calls || 0}</div><div className="text-sm text-muted-foreground">Failed</div></div>
 <div className="p-4 rounded-lg border border-border bg-primary/10"><div className="text-2xl font-bold text-primary">{analytics?.avg_response_time_ms || 0}ms</div><div className="text-sm text-muted-foreground">Avg Response</div></div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div>
 <h4 className="text-sm font-semibold text-foreground mb-3">🔧 Most Used Tools</h4>
 {sortedTools.length === 0 ? (
 <EmptyState icon={EmptyStateIcons.analytics} title="No tool usage data yet" size="sm" />
 ) : (
 <div className="space-y-2">
 {sortedTools.slice(0, 8).map((tool) => (
 <div key={tool.name} className="flex items-center gap-2">
 <div className="w-24 text-xs text-foreground truncate" title={tool.name}>{tool.name}</div>
 <div className="flex-1 h-4 bg-muted rounded overflow-hidden"><div className="h-full bg-primary/80 rounded" style={{ width: `${(tool.count / maxToolCount) * 100}%` }} /></div>
 <div className="w-12 text-xs text-muted-foreground text-right">{tool.count}</div>
 </div>
 ))}
 </div>
 )}
 </div>
 <div>
 <h4 className="text-sm font-semibold text-foreground mb-3">🔑 Requests by API Key</h4>
 {sortedApiKeys.length === 0 ? (
 <EmptyState icon={EmptyStateIcons.analytics} title="No API key usage data yet" size="sm" />
 ) : (
 <div className="space-y-2">
 {sortedApiKeys.slice(0, 8).map((key) => (
 <div key={key.id} className="flex items-center gap-2">
 <div className="w-24 text-xs text-foreground truncate" title={key.name}>{key.name}</div>
 <div className="flex-1 h-4 bg-muted rounded overflow-hidden"><div className="h-full bg-primary/80 rounded" style={{ width: `${(key.count / maxApiKeyCount) * 100}%` }} /></div>
 <div className="w-12 text-xs text-muted-foreground text-right">{key.count}</div>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>
 </div>
 );
}

function MCPToolsCatalogSection() {
 const { token } = useAuthStore();
 const [tools, setTools] = useState<MCPToolInfo[]>([]);
 const [categories, setCategories] = useState<string[]>([]);
 const [isLoading, setIsLoading] = useState(true);
 const [searchQuery, setSearchQuery] = useState('');
 const [selectedCategory, setSelectedCategory] = useState<string>('all');
 const [selectedPermission, setSelectedPermission] = useState<string>('all');
 const [expandedTool, setExpandedTool] = useState<string | null>(null);
 const [error, setError] = useState<string | null>(null);

 useEffect(() => {
 const generateMockToolsCatalog = () => {
 const mockCategories = ['testing', 'execution', 'analysis', 'management', 'reporting', 'integrations', 'ai', 'meta'];
 const mockTools: MCPToolInfo[] = [
 { name: 'run_test', description: 'Execute a single test case by ID', category: 'testing', permission: 'execute' },
 { name: 'run_test_suite', description: 'Execute an entire test suite', category: 'testing', permission: 'execute' },
 { name: 'create_test', description: 'Create a new test case', category: 'testing', permission: 'write' },
 { name: 'get_test', description: 'Get test case details', category: 'testing', permission: 'read' },
 { name: 'list_tests', description: 'List all test cases', category: 'testing', permission: 'read' },
 { name: 'get_run_status', description: 'Get status of a test run', category: 'execution', permission: 'read' },
 { name: 'analyze_failure', description: 'AI-powered failure analysis', category: 'analysis', permission: 'read' },
 { name: 'get_flaky_tests', description: 'Get list of flaky tests', category: 'analysis', permission: 'read' },
 { name: 'create_project', description: 'Create a new project', category: 'management', permission: 'write' },
 { name: 'list_projects', description: 'List all projects', category: 'management', permission: 'read' },
 { name: 'generate_report', description: 'Generate test report', category: 'reporting', permission: 'read' },
 { name: 'generate_test', description: 'AI-generate test from description', category: 'ai', permission: 'write' },
 { name: 'list_all_tools', description: 'List all available MCP tools', category: 'meta', permission: 'read' },
 ];
 setTools(mockTools);
 setCategories(mockCategories);
 setError('Using cached catalog - MCP server may be unavailable');
 };

 const fetchTools = async () => {
 try {
 const response = await fetch(`${import.meta.env.VITE_MCP_URL || ''}/mcp/message`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name: 'list_all_tools', arguments: { include_descriptions: true, include_permissions: true } } }),
 });
 if (response.ok) {
 const data = await response.json();
 if (data.result?.content) {
 const content = JSON.parse(data.result.content[0].text);
 if (content.success) {
 const allTools: MCPToolInfo[] = [];
 const cats: string[] = content.categories || [];
 for (const category of cats) {
 const catTools = content.tools_by_category?.[category] || [];
 for (const tool of catTools) {
 allTools.push({ name: tool.name, description: tool.description || 'No description available', category: category, permission: tool.permission || 'read', inputSchema: tool.inputSchema });
 }
 }
 setTools(allTools);
 setCategories(cats);
 setError(null);
 } else { generateMockToolsCatalog(); }
 }
 } else { generateMockToolsCatalog(); }
 } catch (err) { generateMockToolsCatalog(); }
 finally { setIsLoading(false); }
 };
 fetchTools();
 }, [token]);

 const filteredTools = tools.filter(tool => {
 const matchesSearch = searchQuery === '' || tool.name.toLowerCase().includes(searchQuery.toLowerCase()) || tool.description.toLowerCase().includes(searchQuery.toLowerCase());
 const matchesCategory = selectedCategory === 'all' || tool.category === selectedCategory;
 const matchesPermission = selectedPermission === 'all' || tool.permission === selectedPermission;
 return matchesSearch && matchesCategory && matchesPermission;
 });

 const toolsByCategory = filteredTools.reduce((acc, tool) => { if (!acc[tool.category]) acc[tool.category] = []; acc[tool.category].push(tool); return acc; }, {} as Record<string, MCPToolInfo[]>);
 const permissionColors: Record<string, string> = {
 read: 'bg-success/10 text-success',
 write: 'bg-primary/10 text-primary',
 execute: 'bg-warning/10 text-warning',
 admin: 'bg-destructive/10 text-destructive',
 };

 if (isLoading) {
 return (<div className="mt-6 rounded-lg border border-border bg-card p-6"><h3 className="text-lg font-semibold text-foreground">MCP Tools Catalog</h3><div className="mt-4 flex justify-center"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div></div></div>);
 }

 return (
 <div className="mt-6 rounded-lg border border-border bg-card p-6">
 <div className="flex items-center gap-3 mb-2">
 <LayoutGrid className="h-6 w-6 text-primary" />
 <h3 className="text-lg font-semibold text-foreground">MCP Tools Catalog</h3>
 <span className="ml-auto px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary">{tools.length} tools</span>
 </div>
 <p className="text-sm text-muted-foreground mb-4">Browse and search all available Model Context Protocol (MCP) tools for AI agent integration.</p>
 {error && <div className="mb-4 p-2 text-xs rounded bg-warning/10 text-warning">{error}</div>}

 <div className="flex flex-col sm:flex-row gap-3 mb-4">
 <div className="relative flex-1">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <input type="text" placeholder="Search tools..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-3 py-2 text-sm border border-input rounded-md bg-background text-foreground" />
 </div>
 <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground">
 <option value="all">All Categories</option>
 {categories.map(cat => <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>)}
 </select>
 <select value={selectedPermission} onChange={(e) => setSelectedPermission(e.target.value)} className="px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground">
 <option value="all">All Permissions</option>
 <option value="read">Read</option><option value="write">Write</option><option value="execute">Execute</option><option value="admin">Admin</option>
 </select>
 </div>

 <div className="mb-4 text-sm text-muted-foreground">Showing {filteredTools.length} of {tools.length} tools</div>

 {filteredTools.length === 0 ? (
 <div className="text-center py-8 border border-dashed border-border rounded-lg">
 <p className="mt-3 text-sm text-muted-foreground">No tools match your search</p>
 <Button variant="link" size="sm" onClick={() => { setSearchQuery(''); setSelectedCategory('all'); setSelectedPermission('all'); }} className="mt-2 text-xs px-0 h-auto">Clear filters</Button>
 </div>
 ) : (
 <div className="space-y-4">
 {Object.entries(toolsByCategory).map(([category, catTools]) => (
 <div key={category}>
 <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2"><span className="capitalize">{category}</span><span className="text-xs font-normal text-muted-foreground">({catTools.length})</span></h4>
 <div className="space-y-2">
 {catTools.map((tool) => (
 <div key={tool.name} className="p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => setExpandedTool(expandedTool === tool.name ? null : tool.name)}>
 <div className="flex items-start justify-between">
 <div className="flex-1">
 <div className="flex items-center gap-2">
 <code className="text-sm font-mono font-medium text-foreground">{tool.name}</code>
 <span className={`text-xs px-1.5 py-0.5 rounded ${permissionColors[tool.permission]}`}>{tool.permission}</span>
 </div>
 <p className="text-sm text-muted-foreground mt-1">{tool.description}</p>
 </div>
 </div>
 {expandedTool === tool.name && (
 <div className="mt-3 pt-3 border-t border-border text-xs">
 <div><span className="text-muted-foreground">Category:</span> <span className="text-foreground capitalize">{tool.category}</span></div>
 <div className="flex gap-2 mt-2">
 <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(tool.name); toast.success(`Copied "${tool.name}" to clipboard`); }} className="text-xs h-auto px-2 py-1 bg-primary/10 text-primary hover:bg-primary/20">Copy Name</Button>
 </div>
 </div>
 )}
 </div>
 ))}
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 );
}

function SlackIntegrationSection() {
 const [workspaceName, setWorkspaceName] = useState('');

 // Feature #709: Use React Query for Slack connection
 const { data: slackData = { connected: false }, isLoading } = useSlackConnection();
 const connectMutation = useConnectSlack();
 const disconnectMutation = useDisconnectSlack();

 const handleConnect = async () => {
   try {
     await connectMutation.mutateAsync(workspaceName || 'Dev Workspace');
     toast.success('Slack workspace connected successfully!');
     setWorkspaceName('');
   } catch {
     toast.error('Failed to connect Slack');
   }
 };

 const handleDisconnect = async () => {
   if (!confirm('Are you sure you want to disconnect Slack?')) return;
   try {
     await disconnectMutation.mutateAsync();
     toast.success('Slack workspace disconnected');
   } catch {
     toast.error('Failed to disconnect Slack');
   }
 };

 const formatDate = (dateStr: string) => new Date(dateStr).toLocaleString();

 if (isLoading) {
 return (<div className="mt-6 rounded-lg border border-border bg-card p-6"><h3 className="text-lg font-semibold text-foreground">Slack Integration</h3><div className="mt-4 flex justify-center"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div></div></div>);
 }

 return (
 <div className="mt-6 rounded-lg border border-border bg-card p-6">
 <div className="flex items-center gap-3 mb-2">
 <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none"><path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52z" fill="#E01E5A"/></svg>
 <h3 className="text-lg font-semibold text-foreground">Slack Integration</h3>
 </div>
 <p className="text-sm text-muted-foreground mb-4">Connect your Slack workspace to receive test failure alerts in your channels.</p>

 {slackData.connected ? (
 <div className="space-y-4">
 <div className="flex items-center gap-2 p-3 bg-success/5 rounded-lg border border-success/20">
 <CheckCircle2 className="h-5 w-5 text-success" />
 <span className="text-success font-medium">Connected to Slack</span>
 </div>
 <div className="grid grid-cols-2 gap-4 text-sm">
 <div><label className="text-muted-foreground">Workspace</label><p className="font-medium text-foreground">{slackData.workspace_name}</p></div>
 <div><label className="text-muted-foreground">Connected At</label><p className="font-medium text-foreground">{slackData.connected_at ? formatDate(slackData.connected_at) : '-'}</p></div>
 </div>
 {slackData.channels && slackData.channels.length > 0 && (
 <div>
 <label className="text-sm text-muted-foreground mb-2 block">Channels available for alerts:</label>
 <div className="flex flex-wrap gap-2">
 {slackData.channels.map(channel => (<span key={channel.id} className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded-md text-sm">{channel.is_private ? '🔒' : '#'} {channel.name}</span>))}
 </div>
 </div>
 )}
 <div className="pt-2 border-t border-border">
 <Button variant="outline" onClick={handleDisconnect} disabled={disconnectMutation.isPending} className="border-destructive text-destructive hover:bg-destructive/10">
 {disconnectMutation.isPending ? 'Disconnecting...' : 'Disconnect Slack'}
 </Button>
 </div>
 </div>
 ) : (
 <div className="space-y-4">
 <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
 <Link2 className="h-5 w-5 text-muted-foreground" />
 <span className="text-muted-foreground">Not connected</span>
 </div>
 <div className="bg-warning/5 rounded-lg p-4 border border-warning/20">
 <p className="text-sm text-warning mb-3"><strong>Development Mode:</strong> This simulates a Slack OAuth connection.</p>
 <div className="space-y-3">
 <div>
 <label htmlFor="workspace-name" className="block text-sm font-medium text-foreground mb-1">Workspace Name</label>
 <input id="workspace-name" type="text" value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} placeholder="Dev Workspace" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
 </div>
 <Button onClick={handleConnect} disabled={connectMutation.isPending} className="bg-[#4A154B] text-white hover:bg-[#611f64]">
 {connectMutation.isPending ? 'Connecting...' : 'Connect to Slack'}
 </Button>
 </div>
 </div>
 </div>
 )}
 </div>
 );
}

function OrganizationSettingsPage() {
 const { user, logout } = useAuthStore();
 const { theme, setTheme } = useThemeStore();
 const { timezone, setTimezone } = useTimezoneStore();
 const { preferences, setPreference } = useNotificationStore();
 const { defaults, setDefault } = useTestDefaultsStore();
 // Feature #1995: Use organization branding store for logo persistence
 const { logoBase64, organizationName, setLogo, setOrganizationName } = useOrganizationBrandingStore();
 const navigate = useNavigate();

 // Feature #709: Use React Query for admin members and mutations
 const { data: adminMembers = [] } = useAdminMembers();
 const transferOwnershipMutation = useTransferOwnership();
 const deleteOrgMutation = useDeleteOrganization();

 // Modal state
 const [showDeleteModal, setShowDeleteModal] = useState(false);
 const [deletePassword, setDeletePassword] = useState('');
 const [deleteError, setDeleteError] = useState('');
 const [deleteSuccess, setDeleteSuccess] = useState(false);
 const [showTransferModal, setShowTransferModal] = useState(false);
 const [transferPassword, setTransferPassword] = useState('');
 const [transferError, setTransferError] = useState('');
 const [transferSuccess, setTransferSuccess] = useState(false);
 const [selectedNewOwner, setSelectedNewOwner] = useState('');

 // Form state
 const [orgName, setOrgName] = useState(organizationName);
 const [isSaving, setIsSaving] = useState(false);
 const [logoUrl, setLogoUrl] = useState<string | null>(logoBase64);
 const [logoFile, setLogoFile] = useState<File | null>(null);

 const handleTransferOwnership = async (e: React.FormEvent) => {
   e.preventDefault();
   setTransferError('');
   try {
     await transferOwnershipMutation.mutateAsync({
       newOwnerId: selectedNewOwner,
       password: transferPassword,
     });
     setTransferSuccess(true);
     toast.success('Ownership transferred successfully!');
     setTimeout(() => { logout(); navigate('/login'); }, 2000);
   } catch (err) {
     setTransferError(err instanceof Error ? err.message : 'Failed to transfer ownership');
   }
 };

 // Feature #1995: Convert logo to base64 and store in branding store
 const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (file) {
 const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
 if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
 if (!allowedTypes.includes(file.type)) { toast.error('Please use PNG, JPG, GIF, or WebP'); return; }
 if (file.size > 2 * 1024 * 1024) { toast.error('File too large. Maximum allowed size is 2MB.'); return; }
 setLogoFile(file);

 // Convert to base64 for persistence and PDF embedding
 const reader = new FileReader();
 reader.onload = () => {
 const base64 = reader.result as string;
 setLogoUrl(base64);
 setLogo(base64); // Persist to branding store
 toast.success('Logo uploaded successfully! It will appear in PDF exports.');
 };
 reader.readAsDataURL(file);
 }
 };

 const handleRemoveLogo = () => {
 setLogoFile(null);
 setLogoUrl(null);
 setLogo(null); // Clear from branding store
 toast.success('Logo removed');
 };

 useEffect(() => {
 const handleEscape = (e: KeyboardEvent) => {
 if (e.key === 'Escape' && showDeleteModal && !deleteSuccess) setShowDeleteModal(false);
 };
 document.addEventListener('keydown', handleEscape);
 return () => document.removeEventListener('keydown', handleEscape);
 }, [showDeleteModal, deleteSuccess]);

 const handleSaveSettings = async () => {
 setIsSaving(true);
 await new Promise(resolve => setTimeout(resolve, 500));
 // Feature #1995: Save organization name to branding store
 setOrganizationName(orgName);
 toast.success('Organization settings saved successfully!');
 setIsSaving(false);
 };

 const handleDeleteOrganization = async (e: React.FormEvent) => {
   e.preventDefault();
   setDeleteError('');
   try {
     await deleteOrgMutation.mutateAsync(deletePassword);
     setDeleteSuccess(true);
     setTimeout(() => { logout(); navigate('/login'); }, 2000);
   } catch (err) {
     setDeleteError(err instanceof Error ? err.message : 'Failed to delete organization');
   }
 };

 return (
 <Layout>
 <div className="p-8">
 <PageHeader
   title="Organization Settings"
   description="Manage your organization's settings and configuration."
   breadcrumbs={[
     { label: 'Home', href: '/' },
     { label: 'Settings', href: '/settings' },
     { label: 'Organization' }
   ]}
 />

 <div className="mt-8 max-w-2xl">
 <div className="rounded-lg border border-border bg-card p-6">
 <h3 className="text-lg font-semibold text-foreground">General Settings</h3>
 <div className="mt-4 space-y-4">
 <div>
 <label htmlFor="org-name" className="mb-1 block text-sm font-medium text-foreground">Organization Name</label>
 <input id="org-name" type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground" />
 </div>
 <div>
 <label className="mb-1 block text-sm font-medium text-foreground">Organization Logo</label>
 <div className="flex items-center gap-4">
 {logoUrl ? (
 <div className="relative">
 <img src={logoUrl} alt="Organization logo" className="h-16 w-16 rounded-lg object-cover border border-border" />
 <Button type="button" variant="destructive" size="icon" onClick={handleRemoveLogo} className="absolute -top-2 -right-2 rounded-full h-6 w-6 p-1" aria-label="Remove logo">
 <X className="h-3 w-3" />
 </Button>
 </div>
 ) : (
 <div className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted">
 <ImageIcon className="h-6 w-6 text-muted-foreground" />
 </div>
 )}
 <div>
 <label htmlFor="logo-upload" className="cursor-pointer rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">{logoUrl ? 'Change Logo' : 'Upload Logo'}</label>
 <input id="logo-upload" type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
 <p className="mt-1 text-xs text-muted-foreground">PNG, JPG, GIF up to 2MB</p>
 </div>
 </div>
 </div>
 <div>
 <label htmlFor="timezone" className="mb-1 block text-sm font-medium text-foreground">Timezone</label>
 <select id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground">
 <option value="UTC">UTC</option>
 <option value="America/New_York">Eastern Time (US)</option>
 <option value="America/Los_Angeles">Pacific Time (US)</option>
 <option value="Europe/London">London (UK)</option>
 <option value="Europe/Paris">Paris (CET)</option>
 <option value="Asia/Tokyo">Tokyo (JST)</option>
 </select>
 </div>
 <Button onClick={handleSaveSettings} disabled={isSaving}>
 {isSaving && <Loader2 aria-hidden="true" className="animate-spin h-4 w-4" />}
 {isSaving ? 'Saving...' : 'Save Changes'}
 </Button>
 </div>
 </div>

 <div className="mt-6 rounded-lg border border-border bg-card p-6">
 <h3 className="text-lg font-semibold text-foreground">User Preferences</h3>
 <div className="mt-4 space-y-4">
 <div>
 <label htmlFor="theme" className="mb-1 block text-sm font-medium text-foreground">Theme</label>
 <p className="text-sm text-muted-foreground mb-2">Choose how QA Guardian looks to you.</p>
 <select id="theme" value={theme} onChange={(e) => setTheme(e.target.value as Theme)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground">
 <option value="system">System (follow device setting)</option>
 <option value="light">Light</option>
 <option value="dark">Dark</option>
 </select>
 </div>
 </div>
 </div>

 <div className="mt-6 rounded-lg border border-border bg-card p-6">
 <h3 className="text-lg font-semibold text-foreground">Notification Preferences</h3>
 <p className="text-sm text-muted-foreground mt-1">Control how and when you receive notifications.</p>
 <div className="mt-4 space-y-4">
 {(['emailNotifications', 'testFailureAlerts', 'scheduleCompletionAlerts', 'weeklyDigest'] as const).map((pref) => (
 <div key={pref} className="flex items-center justify-between">
 <div>
 <label htmlFor={pref} className="text-sm font-medium text-foreground">{pref === 'emailNotifications' ? 'Email Notifications' : pref === 'testFailureAlerts' ? 'Test Failure Alerts' : pref === 'scheduleCompletionAlerts' ? 'Schedule Completion Alerts' : 'Weekly Digest'}</label>
 <p className="text-xs text-muted-foreground">{pref === 'emailNotifications' ? 'Receive notifications via email' : pref === 'testFailureAlerts' ? 'Get notified when tests fail' : pref === 'scheduleCompletionAlerts' ? 'Get notified when scheduled test runs complete' : 'Receive a weekly summary of test results'}</p>
 </div>
 <button id={pref} type="button" role="switch" aria-checked={preferences[pref]} onClick={() => setPreference(pref, !preferences[pref])} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${preferences[pref] ? 'bg-primary' : 'bg-muted'}`}>
 <span className={`inline-block h-4 w-4 transform rounded-full bg-card transition-transform ${preferences[pref] ? 'translate-x-6' : 'translate-x-1'}`} />
 </button>
 </div>
 ))}
 </div>
 </div>

 <div className="mt-6 rounded-lg border border-border bg-card p-6">
 <h3 className="text-lg font-semibold text-foreground">Test Defaults</h3>
 <p className="text-sm text-muted-foreground mt-1">Configure default settings for new tests.</p>
 <div className="mt-4 space-y-4">
 <div>
 <label htmlFor="defaultTimeout" className="mb-1 block text-sm font-medium text-foreground">Default Timeout (ms)</label>
 <input id="defaultTimeout" type="number" min="1000" max="300000" step="1000" value={defaults.defaultTimeout} onChange={(e) => setDefault('defaultTimeout', parseInt(e.target.value, 10) || 30000)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground" />
 <p className="text-xs text-muted-foreground mt-1">Current: {defaults.defaultTimeout / 1000} seconds</p>
 </div>
 <div>
 <label htmlFor="defaultBrowser" className="mb-1 block text-sm font-medium text-foreground">Default Browser</label>
 <select id="defaultBrowser" value={defaults.defaultBrowser} onChange={(e) => setDefault('defaultBrowser', e.target.value as 'chromium' | 'firefox' | 'webkit')} className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground">
 <option value="chromium">Chromium</option>
 <option value="firefox">Firefox</option>
 <option value="webkit">WebKit (Safari)</option>
 </select>
 </div>
 <div>
 <label htmlFor="defaultRetries" className="mb-1 block text-sm font-medium text-foreground">Default Retries</label>
 <input id="defaultRetries" type="number" min="0" max="5" value={defaults.defaultRetries} onChange={(e) => setDefault('defaultRetries', parseInt(e.target.value, 10) || 0)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground" />
 </div>
 </div>
 </div>

 <SessionManagementSection />
 <ArtifactRetentionSection />
 <StorageUsageSection />
 <SlackIntegrationSection />
 <MCPConnectionsSection />
 <MCPAnalyticsDashboard />
 <MCPAuditLogSection />
 <MCPToolsCatalogSection />

 <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 p-6">
 <h3 className="text-lg font-semibold text-destructive">Danger Zone</h3>
 <p className="mt-2 text-sm text-muted-foreground">These actions are irreversible. Please be careful.</p>
 <div className="mt-4 flex flex-wrap gap-3">
 {adminMembers.length > 0 && (
 <Button variant="outline" onClick={() => { setShowTransferModal(true); setTransferPassword(''); setTransferError(''); setSelectedNewOwner(adminMembers[0]?.user_id || ''); }} className="border-warning text-warning hover:bg-warning/5">Transfer Ownership</Button>
 )}
 <Button variant="outline" onClick={() => setShowDeleteModal(true)} className="border-destructive text-destructive hover:bg-destructive/10">Delete Organization</Button>
 </div>
 </div>
 </div>

 <Modal
 isOpen={showTransferModal}
 onClose={() => !transferSuccess && setShowTransferModal(false)}
 title="Transfer Ownership"
 size="md"
 >
 <ModalBody>
 {transferSuccess ? (
 <div className="text-center">
 <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/10"><Check aria-hidden="true" className="h-6 w-6 text-success" /></div>
 <h3 className="text-lg font-semibold text-foreground">Ownership Transferred</h3>
 <p className="mt-2 text-muted-foreground">Redirecting to login...</p>
 </div>
 ) : (
 <>
 <p className="text-sm text-muted-foreground mb-4">You are about to transfer ownership. You will become an admin.</p>
 {transferError && <div role="alert" className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{transferError}</div>}
 <form id="transfer-ownership-form" onSubmit={handleTransferOwnership} className="space-y-4">
 <div>
 <label htmlFor="new-owner" className="mb-1 block text-sm font-medium text-foreground">New Owner</label>
 <select id="new-owner" value={selectedNewOwner} onChange={(e) => setSelectedNewOwner(e.target.value)} required className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground">
 {adminMembers.map((admin) => <option key={admin.user_id} value={admin.user_id}>{admin.name} ({admin.email})</option>)}
 </select>
 </div>
 <div>
 <label htmlFor="transfer-password" className="mb-1 block text-sm font-medium text-foreground">Confirm Your Password</label>
 <input id="transfer-password" type="password" value={transferPassword} onChange={(e) => setTransferPassword(e.target.value)} required placeholder="Enter your password" className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground" />
 </div>
 </form>
 </>
 )}
 </ModalBody>
 {!transferSuccess && (
 <ModalFooter>
 <Button type="button" variant="outline" onClick={() => setShowTransferModal(false)}>Cancel</Button>
 <Button type="submit" form="transfer-ownership-form" disabled={transferOwnershipMutation.isPending || !selectedNewOwner || !transferPassword} className="bg-warning text-primary-foreground hover:bg-warning/90">{transferOwnershipMutation.isPending ? 'Transferring...' : 'Transfer Ownership'}</Button>
 </ModalFooter>
 )}
 </Modal>

 <Modal
 isOpen={showDeleteModal}
 onClose={() => { setShowDeleteModal(false); setDeletePassword(''); setDeleteError(''); }}
 title="Delete Organization"
 size="md"
 >
 <ModalBody>
 {deleteSuccess ? (
 <div className="text-center">
 <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/10"><Check aria-hidden="true" className="h-6 w-6 text-success" /></div>
 <h3 className="text-lg font-semibold text-foreground">Organization Deleted</h3>
 <p className="mt-2 text-muted-foreground">Redirecting to login...</p>
 </div>
 ) : (
 <>
 <p className="text-sm text-muted-foreground mb-4">This action <strong>cannot be undone</strong>. This will permanently delete your organization, all projects, test suites, and test results.</p>
 <form id="delete-organization-form" onSubmit={handleDeleteOrganization} className="space-y-4">
 {deleteError && <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{deleteError}</div>}
 <div>
 <label htmlFor="deletePassword" className="mb-1 block text-sm font-medium text-foreground">Enter your password to confirm</label>
 <input id="deletePassword" type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} placeholder="Enter your password" required autoComplete="current-password" className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground" />
 </div>
 </form>
 </>
 )}
 </ModalBody>
 {!deleteSuccess && (
 <ModalFooter>
 <Button type="button" variant="outline" onClick={() => { setShowDeleteModal(false); setDeletePassword(''); setDeleteError(''); }}>Cancel</Button>
 <Button type="submit" variant="destructive" form="delete-organization-form" disabled={deleteOrgMutation.isPending || !deletePassword}>{deleteOrgMutation.isPending ? 'Deleting...' : 'Delete Organization'}</Button>
 </ModalFooter>
 )}
 </Modal>
 </div>
 </Layout>
 );
}

export default OrganizationSettingsPage;
