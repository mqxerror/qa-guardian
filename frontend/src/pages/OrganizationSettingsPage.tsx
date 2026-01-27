// OrganizationSettingsPage - Extracted from App.tsx
// Feature #1441: Split App.tsx into logical modules
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

// Session Management Types
interface SessionInfo {
  id: string;
  device: string;
  browser: string;
  ip_address: string;
  last_active: string;
  created_at: string;
  is_current: boolean;
}

// Slack Integration Types
interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
}

interface SlackConnectionData {
  connected: boolean;
  workspace_id?: string;
  workspace_name?: string;
  connected_at?: string;
  connected_by?: string;
  channels?: SlackChannel[];
}

// MCP Connection interface (Feature #594)
interface MCPConnection {
  id: string;
  api_key_id: string;
  api_key_name: string;
  connected_at: string;
  last_activity_at: string;
  connected_duration_formatted: string;
  client_info?: {
    transport?: string;
    user_agent?: string;
  };
  ip_address?: string;
}

// Feature #846: MCP Audit Log interface
interface McpAuditLogEntry {
  id: string;
  timestamp: string;
  api_key_id: string;
  api_key_name: string;
  connection_id?: string;
  client_name?: string;
  client_version?: string;
  method: string;
  tool_name?: string;
  resource_uri?: string;
  request_params?: Record<string, unknown>;
  response_type: 'success' | 'error';
  response_error_code?: number;
  response_error_message?: string;
  response_data_preview?: string;
  duration_ms?: number;
  ip_address?: string;
  user_agent?: string;
}

// Feature #848: MCP Analytics Dashboard interface
interface McpAnalytics {
  total_calls: number;
  successful_calls: number;
  failed_calls: number;
  by_tool: Record<string, { count: number; avg_duration_ms?: number; success_rate: number }>;
  by_api_key: Record<string, { name: string; count: number }>;
  by_day: Array<{ date: string; total: number; success: number; failed: number }>;
  avg_response_time_ms: number;
}

// Feature #1232: MCP Tools Catalog interface
interface MCPToolInfo {
  name: string;
  description: string;
  category: string;
  permission: 'read' | 'write' | 'execute' | 'admin';
  inputSchema?: {
    type: string;
    properties?: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
      default?: unknown;
    }>;
    required?: string[];
  };
}

function SessionManagementSection() {
  const { token } = useAuthStore();
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState<string | null>(null);
  const [isLoggingOutAll, setIsLoggingOutAll] = useState(false);

  useEffect(() => {
    const fetchSessions = async () => {
      if (!token) return;
      try {
        const response = await fetch('/api/v1/auth/sessions', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setSessions(data.sessions || []);
        }
      } catch (err) {
        console.error('Failed to fetch sessions:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSessions();
  }, [token]);

  const handleLogoutSession = async (sessionId: string) => {
    if (!token) return;
    setIsLoggingOut(sessionId);
    try {
      const response = await fetch(`/api/v1/auth/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setSessions(sessions.filter(s => s.id !== sessionId));
        toast.success('Session logged out successfully');
      } else {
        toast.error('Failed to logout session');
      }
    } catch (err) {
      toast.error('Failed to logout session');
    } finally {
      setIsLoggingOut(null);
    }
  };

  const handleLogoutAllSessions = async () => {
    if (!token) return;
    setIsLoggingOutAll(true);
    try {
      const response = await fetch('/api/v1/auth/sessions/logout-all', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        toast.success(data.message || 'All other sessions logged out');
        setSessions(sessions.filter(s => s.is_current));
      } else {
        toast.error('Failed to logout all sessions');
      }
    } catch (err) {
      toast.error('Failed to logout all sessions');
    } finally {
      setIsLoggingOutAll(false);
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
          <svg aria-hidden="true" className="animate-spin h-6 w-6 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="ml-2 text-muted-foreground">Loading sessions...</span>
        </div>
      ) : sessions.length === 0 ? (
        <div className="mt-4 text-center py-8 text-muted-foreground">
          No active sessions found.
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
                <button
                  onClick={() => handleLogoutSession(session.id)}
                  disabled={isLoggingOut === session.id}
                  className="px-3 py-1 text-sm font-medium text-destructive border border-destructive/50 rounded-md hover:bg-destructive/10 disabled:opacity-50"
                >
                  {isLoggingOut === session.id ? 'Logging out...' : 'Logout'}
                </button>
              )}
            </div>
          ))}

          {sessions.length > 1 && (
            <div className="pt-4 border-t border-border">
              <button
                onClick={handleLogoutAllSessions}
                disabled={isLoggingOutAll}
                className="w-full px-4 py-2 text-sm font-medium text-destructive border border-destructive/50 rounded-md hover:bg-destructive/10 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoggingOutAll && (
                  <svg aria-hidden="true" className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {isLoggingOutAll ? 'Logging out all sessions...' : 'Logout All Other Sessions'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ArtifactRetentionSection() {
  const { user, token } = useAuthStore();
  const { settings, setRetentionDays } = useArtifactRetentionStore();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isRunningCleanup, setIsRunningCleanup] = useState(false);
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

  useEffect(() => {
    setLocalRetentionDays(settings.retentionDays);
  }, [settings.retentionDays]);

  useEffect(() => {
    const fetchRetention = async () => {
      if (!user?.organization_id || !token) return;
      try {
        const response = await fetch(`/api/v1/organizations/${user.organization_id}/artifact-retention`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setRetentionDays(data.retention_days);
          setLocalRetentionDays(data.retention_days);
        }
      } catch (err) {
        console.error('Failed to fetch retention policy:', err);
      }
    };
    fetchRetention();
  }, [user?.organization_id, token, setRetentionDays]);

  const handleSaveRetention = async () => {
    if (!user?.organization_id || !token) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/v1/organizations/${user.organization_id}/artifact-retention`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ retention_days: localRetentionDays }),
      });
      if (response.ok) {
        setRetentionDays(localRetentionDays);
        toast.success('Artifact retention policy saved!');
        setCleanupPreview(null);
      } else {
        const data = await response.json();
        toast.error(data.message || 'Failed to save retention policy');
      }
    } catch (err) {
      toast.error('Failed to save retention policy');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreviewCleanup = async () => {
    if (!user?.organization_id || !token) return;
    setIsLoadingPreview(true);
    try {
      const response = await fetch(`/api/v1/organizations/${user.organization_id}/artifact-cleanup/preview`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setCleanupPreview(data);
      } else {
        const data = await response.json();
        toast.error(data.message || 'Failed to load cleanup preview');
      }
    } catch (err) {
      toast.error('Failed to load cleanup preview');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleRunCleanup = async () => {
    if (!user?.organization_id || !token) return;
    setIsRunningCleanup(true);
    try {
      const response = await fetch(`/api/v1/organizations/${user.organization_id}/artifact-cleanup`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setLastCleanupResult({
          runs_deleted: data.runs_deleted,
          trace_files_deleted: data.trace_files_deleted,
          mb_freed: data.mb_freed,
        });
        setCleanupPreview(null);
        toast.success(`Cleanup complete: ${data.runs_deleted} runs, ${data.trace_files_deleted} trace files deleted`);
      } else {
        const data = await response.json();
        toast.error(data.message || 'Failed to run cleanup');
      }
    } catch (err) {
      toast.error('Failed to run cleanup');
    } finally {
      setIsRunningCleanup(false);
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
              <button
                onClick={handleSaveRetention}
                disabled={isSaving}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            )}
          </div>
        </div>

        {canManageRetention && (
          <div className="border-t border-border pt-4 mt-4">
            <h4 className="text-sm font-medium text-foreground mb-2">Cleanup Actions</h4>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handlePreviewCleanup}
                disabled={isLoadingPreview}
                className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                {isLoadingPreview ? 'Loading...' : 'Preview Cleanup'}
              </button>
              <button
                onClick={handleRunCleanup}
                disabled={isRunningCleanup}
                className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {isRunningCleanup ? 'Running Cleanup...' : 'Run Cleanup Now'}
              </button>
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
              <div className="mt-4 rounded-md bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 p-4">
                <h5 className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">Last Cleanup Result</h5>
                <div className="text-sm text-green-700 dark:text-green-300">
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
  const { user, token } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [storageData, setStorageData] = useState<{
    total_bytes: number;
    total_mb: number;
    total_trace_files: number;
    storage_limit_mb: number;
    usage_percent: number;
    is_warning: boolean;
    warning_threshold_percent: number;
    project_breakdown: Array<{
      project_id: string;
      project_name: string;
      bytes: number;
      mb: number;
      trace_count: number;
    }>;
  } | null>(null);

  useEffect(() => {
    const fetchStorageUsage = async () => {
      if (!user?.organization_id || !token) return;
      setIsLoading(true);
      try {
        const response = await fetch(`/api/v1/organizations/${user.organization_id}/storage`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setStorageData(data);
        }
      } catch (err) {
        console.error('Failed to fetch storage usage:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStorageUsage();
  }, [user?.organization_id, token]);

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
    if (percent >= 90) return 'bg-red-500';
    if (percent >= 80) return 'bg-amber-500';
    if (percent >= 60) return 'bg-yellow-500';
    return 'bg-emerald-500';
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
          <div className="rounded-md bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 p-4">
            <div className="flex items-start gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200">Storage Warning</h4>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
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

        {storageData.project_breakdown.length === 0 && (
          <div className="text-center py-4 text-muted-foreground text-sm">
            No artifacts stored yet. Run some tests to generate trace files.
          </div>
        )}
      </div>
    </div>
  );
}

function MCPConnectionsSection() {
  const { user, token } = useAuthStore();
  const [connections, setConnections] = useState<MCPConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchConnections = async () => {
      if (!token || !user?.organization_id) return;
      try {
        const response = await fetch(`/api/v1/organizations/${user.organization_id}/mcp-connections`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setConnections(data.mcp_connections || []);
        }
      } catch (err) {
        console.error('Failed to fetch MCP connections:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchConnections();
    const interval = setInterval(fetchConnections, 30000);
    return () => clearInterval(interval);
  }, [token, user?.organization_id]);

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
        <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
        </svg>
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
          <svg className="mx-auto h-12 w-12 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
          </svg>
          <p className="mt-3 text-sm text-muted-foreground">No active MCP connections</p>
          <p className="text-xs text-muted-foreground mt-1">Connect an AI agent using an API key with MCP scopes</p>
        </div>
      ) : (
        <div className="space-y-3">
          {connections.map((conn) => (
            <div key={conn.id} className="p-3 rounded-lg border border-border bg-muted/30">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
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
  const { user, token } = useAuthStore();
  const [auditLogs, setAuditLogs] = useState<McpAuditLogEntry[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<McpAuditLogEntry | null>(null);
  const [filterMethod, setFilterMethod] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    const fetchAuditLogs = async () => {
      if (!token || !user?.organization_id) return;
      try {
        const params = new URLSearchParams();
        params.set('limit', String(pageSize));
        params.set('offset', String((currentPage - 1) * pageSize));
        if (filterMethod) params.set('method', filterMethod);
        if (filterStatus) params.set('response_type', filterStatus);

        const response = await fetch(`/api/v1/organizations/${user.organization_id}/mcp-audit-logs?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setAuditLogs(data.logs || []);
          setTotalLogs(data.total || 0);
        }
      } catch (err) {
        console.error('Failed to fetch MCP audit logs:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAuditLogs();
    const interval = setInterval(fetchAuditLogs, 30000);
    return () => clearInterval(interval);
  }, [token, user?.organization_id, currentPage, filterMethod, filterStatus]);

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
        <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
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

      {auditLogs.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-border rounded-lg">
          <svg className="mx-auto h-12 w-12 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="mt-3 text-sm text-muted-foreground">No MCP audit logs found</p>
        </div>
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
                    <span className={`text-xs px-1.5 py-0.5 rounded ${log.response_type === 'success' ? 'bg-green-500/20 text-green-600' : 'bg-red-500/20 text-red-600'}`}>{log.response_type}</span>
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
                        <span className="text-xs font-medium text-red-600">Error:</span>
                        <div className="mt-1 p-2 text-xs bg-red-500/10 text-red-600 rounded">{log.response_error_code && <span className="font-mono">[{log.response_error_code}] </span>}{log.response_error_message}</div>
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
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 text-sm border border-input rounded-md bg-background text-foreground disabled:opacity-50">Previous</button>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1 text-sm border border-input rounded-md bg-background text-foreground disabled:opacity-50">Next</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MCPAnalyticsDashboard() {
  const { user, token } = useAuthStore();
  const [analytics, setAnalytics] = useState<McpAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState<string>('7d');
  const [isExporting, setIsExporting] = useState(false);

  const getSinceDate = () => {
    const now = new Date();
    switch (timePeriod) {
      case '24h': return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      case '7d': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case '30d': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      case '90d': return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
      default: return undefined;
    }
  };

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!token || !user?.organization_id) return;
      try {
        const since = getSinceDate();
        const url = since ? `/api/v1/organizations/${user.organization_id}/mcp-analytics?since=${since}` : `/api/v1/organizations/${user.organization_id}/mcp-analytics`;
        const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (response.ok) {
          const data = await response.json();
          setAnalytics(data.analytics || null);
        }
      } catch (err) {
        console.error('Failed to fetch MCP analytics:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 60000);
    return () => clearInterval(interval);
  }, [token, user?.organization_id, timePeriod]);

  const handleExport = async (format: 'csv' | 'json') => {
    if (!token || !user?.organization_id) return;
    setIsExporting(true);
    try {
      const since = getSinceDate();
      let url = `/api/v1/organizations/${user.organization_id}/mcp-analytics/export?format=${format}`;
      if (since) url += `&since=${since}`;
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (response.ok) {
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `mcp-analytics.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(a);
      }
    } catch (err) {
      console.error('Failed to export analytics:', err);
    } finally {
      setIsExporting(false);
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
          <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="text-lg font-semibold text-foreground">MCP Analytics Dashboard</h3>
        </div>
        <div className="flex items-center gap-2">
          <select value={timePeriod} onChange={(e) => { setTimePeriod(e.target.value); setIsLoading(true); }} className="px-3 py-1.5 text-sm border border-input rounded-md bg-background text-foreground">
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="all">All Time</option>
          </select>
          <button onClick={() => handleExport('csv')} disabled={isExporting} className="px-3 py-1.5 text-sm border border-input rounded-md bg-background text-foreground hover:bg-muted disabled:opacity-50">
            {isExporting ? 'Exporting...' : '📥 Export CSV'}
          </button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mb-6">View MCP usage statistics, trends, and performance metrics.</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded-lg border border-border bg-muted/30"><div className="text-2xl font-bold text-foreground">{analytics?.total_calls || 0}</div><div className="text-sm text-muted-foreground">Total Requests</div></div>
        <div className="p-4 rounded-lg border border-border bg-green-500/10"><div className="text-2xl font-bold text-green-600">{analytics?.successful_calls || 0}</div><div className="text-sm text-muted-foreground">Successful</div></div>
        <div className="p-4 rounded-lg border border-border bg-red-500/10"><div className="text-2xl font-bold text-red-600">{analytics?.failed_calls || 0}</div><div className="text-sm text-muted-foreground">Failed</div></div>
        <div className="p-4 rounded-lg border border-border bg-blue-500/10"><div className="text-2xl font-bold text-blue-600">{analytics?.avg_response_time_ms || 0}ms</div><div className="text-sm text-muted-foreground">Avg Response</div></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-3">🔧 Most Used Tools</h4>
          {sortedTools.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center border border-dashed border-border rounded">No tool usage data yet</div>
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
            <div className="text-sm text-muted-foreground py-4 text-center border border-dashed border-border rounded">No API key usage data yet</div>
          ) : (
            <div className="space-y-2">
              {sortedApiKeys.slice(0, 8).map((key) => (
                <div key={key.id} className="flex items-center gap-2">
                  <div className="w-24 text-xs text-foreground truncate" title={key.name}>{key.name}</div>
                  <div className="flex-1 h-4 bg-muted rounded overflow-hidden"><div className="h-full bg-blue-500/80 rounded" style={{ width: `${(key.count / maxApiKeyCount) * 100}%` }} /></div>
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
        const response = await fetch('https://qa.pixelcraftedmedia.com/mcp/message', {
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
    read: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    write: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    execute: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    admin: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };

  if (isLoading) {
    return (<div className="mt-6 rounded-lg border border-border bg-card p-6"><h3 className="text-lg font-semibold text-foreground">MCP Tools Catalog</h3><div className="mt-4 flex justify-center"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div></div></div>);
  }

  return (
    <div className="mt-6 rounded-lg border border-border bg-card p-6">
      <div className="flex items-center gap-3 mb-2">
        <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
        <h3 className="text-lg font-semibold text-foreground">MCP Tools Catalog</h3>
        <span className="ml-auto px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary">{tools.length} tools</span>
      </div>
      <p className="text-sm text-muted-foreground mb-4">Browse and search all available Model Context Protocol (MCP) tools for AI agent integration.</p>
      {error && <div className="mb-4 p-2 text-xs rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">{error}</div>}

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
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
          <button onClick={() => { setSearchQuery(''); setSelectedCategory('all'); setSelectedPermission('all'); }} className="mt-2 text-xs text-primary hover:underline">Clear filters</button>
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
                          <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(tool.name); toast.success(`Copied "${tool.name}" to clipboard`); }} className="text-xs px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20">Copy Name</button>
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
  const { user, token } = useAuthStore();
  const [slackData, setSlackData] = useState<SlackConnectionData>({ connected: false });
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');

  useEffect(() => {
    const fetchSlackStatus = async () => {
      if (!token || !user?.organization_id) return;
      try {
        const response = await fetch(`/api/v1/organizations/${user.organization_id}/slack`, { headers: { Authorization: `Bearer ${token}` } });
        if (response.ok) { const data = await response.json(); setSlackData(data); }
      } catch (err) { console.error('Failed to fetch Slack status:', err); }
      finally { setIsLoading(false); }
    };
    fetchSlackStatus();
  }, [token, user?.organization_id]);

  const handleConnect = async () => {
    if (!token || !user?.organization_id) return;
    setIsConnecting(true);
    try {
      const response = await fetch(`/api/v1/organizations/${user.organization_id}/slack/connect`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ workspace_name: workspaceName || 'Dev Workspace' }) });
      const data = await response.json();
      if (response.ok) { setSlackData(data); toast.success('Slack workspace connected successfully!'); setWorkspaceName(''); }
      else { toast.error(data.message || 'Failed to connect Slack'); }
    } catch (err) { toast.error('Failed to connect Slack'); }
    finally { setIsConnecting(false); }
  };

  const handleDisconnect = async () => {
    if (!token || !user?.organization_id) return;
    if (!confirm('Are you sure you want to disconnect Slack?')) return;
    setIsDisconnecting(true);
    try {
      const response = await fetch(`/api/v1/organizations/${user.organization_id}/slack`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (response.ok) { setSlackData({ connected: false }); toast.success('Slack workspace disconnected'); }
      else { toast.error('Failed to disconnect Slack'); }
    } catch (err) { toast.error('Failed to disconnect Slack'); }
    finally { setIsDisconnecting(false); }
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
          <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
            <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span className="text-green-700 dark:text-green-400 font-medium">Connected to Slack</span>
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
            <button onClick={handleDisconnect} disabled={isDisconnecting} className="rounded-md border border-destructive px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50">
              {isDisconnecting ? 'Disconnecting...' : 'Disconnect Slack'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" /></svg>
            <span className="text-muted-foreground">Not connected</span>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-950/30 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
            <p className="text-sm text-yellow-700 dark:text-yellow-400 mb-3"><strong>Development Mode:</strong> This simulates a Slack OAuth connection.</p>
            <div className="space-y-3">
              <div>
                <label htmlFor="workspace-name" className="block text-sm font-medium text-foreground mb-1">Workspace Name</label>
                <input id="workspace-name" type="text" value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} placeholder="Dev Workspace" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <button onClick={handleConnect} disabled={isConnecting} className="flex items-center gap-2 rounded-md bg-[#4A154B] px-4 py-2 text-sm font-medium text-white hover:bg-[#611f64] disabled:opacity-50">
                {isConnecting ? 'Connecting...' : 'Connect to Slack'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OrganizationSettingsPage() {
  const { user, token, logout } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const { timezone, setTimezone } = useTimezoneStore();
  const { preferences, setPreference } = useNotificationStore();
  const { defaults, setDefault } = useTestDefaultsStore();
  // Feature #1995: Use organization branding store for logo persistence
  const { logoBase64, organizationName, setLogo, setOrganizationName } = useOrganizationBrandingStore();
  const navigate = useNavigate();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [orgName, setOrgName] = useState(organizationName);
  const [isSaving, setIsSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(logoBase64);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferPassword, setTransferPassword] = useState('');
  const [transferError, setTransferError] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState(false);
  const [selectedNewOwner, setSelectedNewOwner] = useState('');
  const [adminMembers, setAdminMembers] = useState<Array<{ user_id: string; name: string; email: string }>>([]);

  useEffect(() => {
    const fetchAdmins = async () => {
      if (user?.role !== 'owner') return;
      try {
        const response = await fetch(`/api/v1/organizations/${user.organization_id}/members`, { headers: { Authorization: `Bearer ${token}` } });
        if (response.ok) {
          const data = await response.json();
          const admins = (data.members || []).filter((m: { user_id: string; role: string }) => m.role === 'admin' && m.user_id !== user.id);
          setAdminMembers(admins);
        }
      } catch (err) { console.error('Failed to fetch admin members:', err); }
    };
    fetchAdmins();
  }, [user, token]);

  const handleTransferOwnership = async (e: React.FormEvent) => {
    e.preventDefault();
    setTransferError('');
    setIsTransferring(true);
    try {
      const response = await fetch(`/api/v1/organizations/${user?.organization_id}/transfer-ownership`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ new_owner_id: selectedNewOwner, password: transferPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to transfer ownership');
      setTransferSuccess(true);
      toast.success('Ownership transferred successfully!');
      setTimeout(() => { logout(); navigate('/login'); }, 2000);
    } catch (err) { setTransferError(err instanceof Error ? err.message : 'Failed to transfer ownership'); }
    finally { setIsTransferring(false); }
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
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/v1/organizations/${user?.organization_id}`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ password: deletePassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to delete organization');
      setDeleteSuccess(true);
      setTimeout(() => { logout(); navigate('/login'); }, 2000);
    } catch (err) { setDeleteError(err instanceof Error ? err.message : 'Failed to delete organization'); }
    finally { setIsDeleting(false); }
  };

  return (
    <Layout>
      <div className="p-8">
        <h2 className="text-3xl font-bold text-foreground">Organization Settings</h2>
        <p className="mt-2 text-muted-foreground">Manage your organization's settings and configuration.</p>

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
                      <button type="button" onClick={handleRemoveLogo} className="absolute -top-2 -right-2 rounded-full bg-destructive p-1 text-white hover:bg-destructive/90" aria-label="Remove logo">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                      </button>
                    </div>
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
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
              <button onClick={handleSaveSettings} disabled={isSaving} className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
                {isSaving && <svg aria-hidden="true" className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
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
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${preferences[pref] ? 'translate-x-6' : 'translate-x-1'}`} />
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
                <button onClick={() => { setShowTransferModal(true); setTransferPassword(''); setTransferError(''); setSelectedNewOwner(adminMembers[0]?.user_id || ''); }} className="rounded-md border border-yellow-600 px-4 py-2 font-medium text-yellow-600 hover:bg-yellow-50">Transfer Ownership</button>
              )}
              <button onClick={() => setShowDeleteModal(true)} className="rounded-md border border-destructive px-4 py-2 font-medium text-destructive hover:bg-destructive/10">Delete Organization</button>
            </div>
          </div>
        </div>

        {showTransferModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={(e) => e.target === e.currentTarget && !transferSuccess && setShowTransferModal(false)}>
            <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
              {transferSuccess ? (
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100"><svg aria-hidden="true" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></div>
                  <h3 className="text-lg font-semibold text-foreground">Ownership Transferred</h3>
                  <p className="mt-2 text-muted-foreground">Redirecting to login...</p>
                </div>
              ) : (
                <form onSubmit={handleTransferOwnership}>
                  <h3 className="text-lg font-semibold text-foreground mb-4">Transfer Ownership</h3>
                  <p className="text-sm text-muted-foreground mb-4">You are about to transfer ownership. You will become an admin.</p>
                  {transferError && <div role="alert" className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{transferError}</div>}
                  <div className="space-y-4">
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
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <button type="button" onClick={() => setShowTransferModal(false)} className="rounded-md border border-border px-4 py-2 font-medium text-foreground hover:bg-muted">Cancel</button>
                    <button type="submit" disabled={isTransferring || !selectedNewOwner || !transferPassword} className="rounded-md bg-yellow-600 px-4 py-2 font-medium text-white hover:bg-yellow-700 disabled:opacity-50">{isTransferring ? 'Transferring...' : 'Transfer Ownership'}</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
              {deleteSuccess ? (
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100"><svg aria-hidden="true" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></div>
                  <h3 className="text-lg font-semibold text-foreground">Organization Deleted</h3>
                  <p className="mt-2 text-muted-foreground">Redirecting to login...</p>
                </div>
              ) : (
                <>
                  <h3 className="text-lg font-semibold text-foreground mb-4">Delete Organization</h3>
                  <p className="text-sm text-muted-foreground mb-4">This action <strong>cannot be undone</strong>. This will permanently delete your organization, all projects, test suites, and test results.</p>
                  <form onSubmit={handleDeleteOrganization} className="space-y-4">
                    {deleteError && <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{deleteError}</div>}
                    <div>
                      <label htmlFor="deletePassword" className="mb-1 block text-sm font-medium text-foreground">Enter your password to confirm</label>
                      <input id="deletePassword" type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} placeholder="Enter your password" required autoComplete="current-password" className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground" />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                      <button type="button" onClick={() => { setShowDeleteModal(false); setDeletePassword(''); setDeleteError(''); }} className="rounded-md border border-border px-4 py-2 font-medium text-foreground hover:bg-muted">Cancel</button>
                      <button type="submit" disabled={isDeleting || !deletePassword} className="rounded-md bg-destructive px-4 py-2 font-medium text-white hover:bg-destructive/90 disabled:opacity-50">{isDeleting ? 'Deleting...' : 'Delete Organization'}</button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default OrganizationSettingsPage;
