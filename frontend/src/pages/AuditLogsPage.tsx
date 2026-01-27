// AuditLogsPage extracted from App.tsx for code quality compliance (Feature #1357)
import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { useAuthStore } from '../stores/authStore';
import { useTimezoneStore } from '../stores/timezoneStore';

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

export function AuditLogsPage() {
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

  // Fetch audit logs
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
          {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          setAuditLogs(data.logs);
          setTotal(data.total);
        }
      } catch (err) {
        console.error('Failed to fetch audit logs:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAuditLogs();
  }, [token, user?.organization_id, offset, filterAction, filterResourceType, limit]);

  // Fetch filter options
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
          setAvailableActions(data.actions);
        }
        if (typesRes.ok) {
          const data = await typesRes.json();
          setAvailableResourceTypes(data.resource_types);
        }
      } catch (err) {
        console.error('Failed to fetch filter options:', err);
      }
    };

    fetchFilterOptions();
  }, [token, user?.organization_id]);

  const getActionColor = (action: string) => {
    switch (action) {
      case 'create': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'update': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'delete': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const getResourceTypeLabel = (type: string) => {
    return type.replace(/_/g, ' ');
  };

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <Layout>
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Audit Logs</h1>
          <p className="mt-2 text-muted-foreground">
            View a record of all actions performed in your organization
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-4">
          <div>
            <label htmlFor="filter-action" className="block text-sm font-medium text-foreground mb-1">
              Action
            </label>
            <select
              id="filter-action"
              value={filterAction}
              onChange={(e) => { setFilterAction(e.target.value); setOffset(0); }}
              className="rounded-md border border-input bg-background px-3 py-2 text-foreground"
            >
              <option value="">All actions</option>
              {availableActions.map((action) => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filter-resource-type" className="block text-sm font-medium text-foreground mb-1">
              Resource Type
            </label>
            <select
              id="filter-resource-type"
              value={filterResourceType}
              onChange={(e) => { setFilterResourceType(e.target.value); setOffset(0); }}
              className="rounded-md border border-input bg-background px-3 py-2 text-foreground"
            >
              <option value="">All types</option>
              {availableResourceTypes.map((type) => (
                <option key={type} value={type}>{getResourceTypeLabel(type)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Audit Logs Table */}
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <svg aria-hidden="true" className="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="ml-2 text-muted-foreground">Loading audit logs...</span>
          </div>
        ) : auditLogs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
            <svg aria-hidden="true" className="mx-auto h-12 w-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-4 text-lg font-semibold text-foreground">No audit logs yet</h3>
            <p className="mt-2 text-muted-foreground">
              Actions performed in your organization will appear here.
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-border bg-card overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Timestamp</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">User</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Action</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Resource</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">IP Address</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3 text-sm text-foreground whitespace-nowrap">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        <span className="font-medium">{log.user_email}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getActionColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium text-foreground capitalize">{getResourceTypeLabel(log.resource_type)}</div>
                        <div className="text-muted-foreground text-xs">
                          {log.resource_name || log.resource_id}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground font-mono">
                        {log.ip_address}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {log.details ? (
                          <details className="cursor-pointer">
                            <summary className="text-primary hover:underline">View details</summary>
                            <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-w-xs">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </details>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {total > 0 && (
              <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {offset + 1} to {Math.min(offset + limit, total)} of {total} entries
                  </p>
                  <div className="flex items-center gap-2">
                    <label htmlFor="audit-page-size" className="text-sm text-muted-foreground">
                      Per page:
                    </label>
                    <select
                      id="audit-page-size"
                      value={limit}
                      onChange={(e) => { setLimit(parseInt(e.target.value, 10)); setOffset(0); }}
                      className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
                    >
                      <option value="10">10</option>
                      <option value="20">20</option>
                      <option value="50">50</option>
                      <option value="100">100</option>
                    </select>
                  </div>
                </div>
                {totalPages > 1 && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setOffset(Math.max(0, offset - limit))}
                      disabled={offset === 0}
                      className="rounded-md border border-border px-3 py-1 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span className="px-3 py-1 text-sm text-muted-foreground">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setOffset(offset + limit)}
                      disabled={offset + limit >= total}
                      className="rounded-md border border-border px-3 py-1 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
