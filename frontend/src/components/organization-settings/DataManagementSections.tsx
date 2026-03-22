/**
 * Data Management Sections - Session, ArtifactRetention, StorageUsage
 * Extracted from OrganizationSettingsPage.tsx for component decomposition (Agent 7)
 * Feature #709: React Query integration
 */

import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useArtifactRetentionStore } from '../../stores/artifactRetentionStore';
import { getBrowserIcon } from '../../utils/browser';
import { toast } from '../../stores/toastStore';
import { EmptyState, EmptyStateIcons } from '../ui/EmptyState';
import { Button } from '../ui/button';
import { Loader2, AlertTriangle } from 'lucide-react';
import {
  useSessions,
  useLogoutSession,
  useLogoutAllSessions,
  useArtifactRetention,
  useSaveArtifactRetention,
  useCleanupPreview,
  useRunCleanup,
  useStorageUsage,
} from '../../hooks/api';

// ---------------------------------------------------------------------------
// SessionManagementSection
// ---------------------------------------------------------------------------
export function SessionManagementSection() {
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

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleString();

  const getDeviceIcon = (device: string) => {
    if (device.includes('iPhone') || device.includes('Android Phone')) return '\uD83D\uDCF1';
    if (device.includes('iPad') || device.includes('Android Tablet')) return '\uD83D\uDCF1';
    if (device.includes('Mac')) return '\uD83D\uDCBB';
    if (device.includes('Windows')) return '\uD83D\uDDA5\uFE0F';
    if (device.includes('Linux')) return '\uD83D\uDC27';
    return '\uD83D\uDCBB';
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
        <div className="mt-4">
          <EmptyState icon={EmptyStateIcons.users} title="No active sessions found" size="sm" />
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`flex items-center justify-between p-4 rounded-lg border ${
                session.is_current ? 'border-primary/50 bg-primary/5' : 'border-border bg-background'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="text-2xl">{getDeviceIcon(session.device)}</div>
                <div>
                  <div className="font-medium text-foreground flex items-center gap-2">
                    {session.device} &bull; {session.browser} {getBrowserIcon(session.browser)}
                    {session.is_current && (
                      <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                        Current Session
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">IP: {session.ip_address}</div>
                  <div className="text-xs text-muted-foreground">
                    Last active: {formatDate(session.last_active)} &bull; Started: {formatDate(session.created_at)}
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
                {logoutAllMutation.isPending && <Loader2 aria-hidden="true" className="animate-spin h-4 w-4" />}
                {logoutAllMutation.isPending ? 'Logging out all sessions...' : 'Logout All Other Sessions'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ArtifactRetentionSection
// ---------------------------------------------------------------------------
export function ArtifactRetentionSection() {
  const { user } = useAuthStore();
  const { settings, setRetentionDays } = useArtifactRetentionStore();

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
              <Button size="sm" onClick={handleSaveRetention} disabled={saveRetentionMutation.isPending}>
                {saveRetentionMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            )}
          </div>
        </div>

        {canManageRetention && (
          <div className="border-t border-border pt-4 mt-4">
            <h4 className="text-sm font-medium text-foreground mb-2">Cleanup Actions</h4>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" size="sm" onClick={handlePreviewCleanup} disabled={isLoadingPreview}>
                {isLoadingPreview ? 'Loading...' : 'Preview Cleanup'}
              </Button>
              <Button size="sm" onClick={handleRunCleanup} disabled={runCleanupMutation.isPending} className="bg-warning text-primary-foreground hover:bg-warning/90">
                {runCleanupMutation.isPending ? 'Running Cleanup...' : 'Run Cleanup Now'}
              </Button>
            </div>

            {cleanupPreview && (
              <div className="mt-4 rounded-md bg-muted/50 p-4">
                <h5 className="text-sm font-medium text-foreground mb-2">Cleanup Preview</h5>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Test runs to delete:</span> <span className="font-medium text-foreground">{cleanupPreview.runs_to_delete}</span></div>
                  <div><span className="text-muted-foreground">Test runs preserved:</span> <span className="font-medium text-foreground">{cleanupPreview.runs_preserved}</span></div>
                  <div><span className="text-muted-foreground">Trace files to delete:</span> <span className="font-medium text-foreground">{cleanupPreview.trace_files_to_delete}</span></div>
                  <div><span className="text-muted-foreground">Estimated space freed:</span> <span className="font-medium text-foreground">{cleanupPreview.estimated_space_freed_mb} MB</span></div>
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

// ---------------------------------------------------------------------------
// StorageUsageSection
// ---------------------------------------------------------------------------
export function StorageUsageSection() {
  const { data: storageData, isLoading } = useStorageUsage();

  if (isLoading) {
    return (
      <div className="mt-6 rounded-lg border border-border bg-card p-6">
        <h3 className="text-lg font-semibold text-foreground">Storage Usage</h3>
        <p className="text-sm text-muted-foreground mt-2">Loading storage information...</p>
      </div>
    );
  }

  if (!storageData) return null;

  const getProgressBarColor = (percent: number) => {
    if (percent >= 90) return 'bg-destructive';
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
                      {storageData.total_mb > 0 ? Math.round((project.mb / storageData.total_mb) * 100) : 0}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {storageData.project_breakdown.length === 0 && (
          <EmptyState icon={EmptyStateIcons.document} title="No artifacts stored yet" description="Run some tests to generate trace files." size="sm" />
        )}
      </div>
    </div>
  );
}
