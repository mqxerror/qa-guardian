// AuditLogsTab - Audit log viewer
// Feature #451: Extracted from SettingsPage.tsx

import { useState, useEffect, Fragment } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useTimezoneStore } from '../../stores/timezoneStore';

interface AuditLogEntry {
  id: string;
  user_id: string;
  user_email: string;
  action: string;
  resource_type: string;
  resource_id: string;
  resource_name?: string;
  details?: Record<string, unknown>;
  ip_address: string;
  created_at: string;
}

export function AuditLogsTab() {
  const { user, token } = useAuthStore();
  const { formatDate } = useTimezoneStore();
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [filterAction, setFilterAction] = useState('');
  const [filterResourceType, setFilterResourceType] = useState('');
  const [availableActions, setAvailableActions] = useState<string[]>([]);
  const [availableResourceTypes, setAvailableResourceTypes] = useState<string[]>([]);
  const [limit, setLimit] = useState(20);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  useEffect(() => {
    const fetchAuditLogs = async () => {
      if (!user?.organization_id) return;

      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          limit: String(limit),
          offset: String(offset),
        });
        if (filterAction) params.append('action', filterAction);
        if (filterResourceType) params.append('resource_type', filterResourceType);

        const response = await fetch(
          `/api/v1/organizations/${user.organization_id}/audit-logs?${params}`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );

        if (response.ok) {
          const data = await response.json();
          setAuditLogs(data.logs || []);
          setTotal(data.total || 0);
        }
      } catch (err) {
        console.error('Failed to fetch audit logs:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAuditLogs();
  }, [token, user?.organization_id, offset, filterAction, filterResourceType, limit]);

  useEffect(() => {
    const fetchFilterOptions = async () => {
      if (!user?.organization_id) return;

      try {
        const [actionsRes, typesRes] = await Promise.all([
          fetch(`/api/v1/organizations/${user.organization_id}/audit-logs/actions`, {
            headers: { 'Authorization': `Bearer ${token}` },
          }),
          fetch(`/api/v1/organizations/${user.organization_id}/audit-logs/resource-types`, {
            headers: { 'Authorization': `Bearer ${token}` },
          }),
        ]);

        if (actionsRes.ok) {
          const data = await actionsRes.json();
          setAvailableActions(data.actions || []);
        }
        if (typesRes.ok) {
          const data = await typesRes.json();
          setAvailableResourceTypes(data.resource_types || []);
        }
      } catch (err) {
        console.error('Failed to fetch filter options:', err);
      }
    };

    fetchFilterOptions();
  }, [token, user?.organization_id]);

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="space-y-6">
      {/* Header and Filters */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Audit Logs</h3>
          <p className="text-sm text-muted-foreground">Track all actions in your organization.</p>
        </div>
        <div className="flex gap-3">
          <select
            value={filterAction}
            onChange={(e) => { setFilterAction(e.target.value); setOffset(0); }}
            className="px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm"
          >
            <option value="">All actions</option>
            {availableActions.map(action => (
              <option key={action} value={action}>{action}</option>
            ))}
          </select>
          <select
            value={filterResourceType}
            onChange={(e) => { setFilterResourceType(e.target.value); setOffset(0); }}
            className="px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm"
          >
            <option value="">All types</option>
            {availableResourceTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Timestamp</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">User</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Action</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Resource</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">IP Address</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading...</td>
              </tr>
            ) : auditLogs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No audit logs found</td>
              </tr>
            ) : (
              auditLogs.map(log => (
                <Fragment key={log.id}>
                  <tr className="hover:bg-muted/50">
                    <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(log.created_at)}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{log.user_email}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-medium">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {log.resource_type}{log.resource_name ? `: ${log.resource_name}` : ''}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground font-mono">{log.ip_address}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                        className="text-sm text-primary hover:underline"
                      >
                        {expandedLog === log.id ? 'Hide' : 'View details'}
                      </button>
                    </td>
                  </tr>
                  {expandedLog === log.id && log.details && (
                    <tr>
                      <td colSpan={6} className="px-4 py-3 bg-muted/30">
                        <pre className="text-xs text-muted-foreground overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center text-sm">
        <div className="text-muted-foreground">
          Showing {offset + 1} to {Math.min(offset + limit, total)} of {total} entries
        </div>
        <div className="flex items-center gap-2">
          <select
            value={limit}
            onChange={(e) => { setLimit(Number(e.target.value)); setOffset(0); }}
            className="px-2 py-1 border border-border rounded bg-background text-foreground text-sm"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <button
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0}
            className="px-3 py-1 border border-border rounded bg-background text-foreground disabled:opacity-50"
          >
            Prev
          </button>
          <span className="text-muted-foreground">Page {currentPage} of {totalPages}</span>
          <button
            onClick={() => setOffset(offset + limit)}
            disabled={offset + limit >= total}
            className="px-3 py-1 border border-border rounded bg-background text-foreground disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
