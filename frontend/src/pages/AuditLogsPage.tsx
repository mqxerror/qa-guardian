// AuditLogsPage extracted from App.tsx for code quality compliance (Feature #1357)
// Feature #689: Migrated from raw fetch to React Query hooks
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Layout } from '../components/Layout';
import { PageHeader } from '../components/ui';
import { Button } from '@/components/ui/button';
// Feature #728: EmptyState adoption
import { EmptyState, EmptyStateIcons } from '../components/ui/EmptyState';
import { useAuthStore } from '../stores/authStore';
import { useTimezoneStore } from '../stores/timezoneStore';
// Feature #689: React Query hooks for caching and automatic refetching
import { useAuditLogs, useAuditLogActions, useAuditLogResourceTypes, type AuditLog } from '../hooks/api/useSettings';

export function AuditLogsPage() {
 const { user } = useAuthStore();
 const { formatDate } = useTimezoneStore();
 const [offset, setOffset] = useState(0);
 const [filterAction, setFilterAction] = useState('');
 const [filterResourceType, setFilterResourceType] = useState('');
 const [limit, setLimit] = useState(20);

 // Feature #689: React Query hooks for caching - replaces useState+useEffect+fetch pattern
 const { data: auditLogsData, isLoading } = useAuditLogs(user?.organization_id, {
  action: filterAction || undefined,
  resource_type: filterResourceType || undefined,
  limit,
  offset,
 });
 const { data: availableActions = [] } = useAuditLogActions(user?.organization_id);
 const { data: availableResourceTypes = [] } = useAuditLogResourceTypes(user?.organization_id);

 // Derive data from React Query response
 const auditLogs = auditLogsData?.logs ?? [];
 const total = auditLogsData?.total ?? 0;

 const getActionColor = (action: string) => {
 switch (action) {
 case 'create': return 'bg-success/10 text-success';
 case 'update': return 'bg-primary/10 text-primary';
 case 'delete': return 'bg-destructive/10 text-destructive';
 default: return 'bg-muted text-muted-foreground';
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
 <PageHeader
   title="Audit Logs"
   description="View a record of all actions performed in your organization"
   breadcrumbs={[
     { label: 'Home', href: '/' },
     { label: 'Settings', href: '/settings' },
     { label: 'Audit Logs' }
   ]}
 />

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
 <Loader2 className="animate-spin h-8 w-8 text-primary" />
 <span className="ml-2 text-muted-foreground">Loading audit logs...</span>
 </div>
 ) : auditLogs.length === 0 ? (
 /* Feature #728: EmptyState adoption */
 <EmptyState
 icon={EmptyStateIcons.document}
 title="No audit logs yet"
 description="Actions performed in your organization will appear here."
 />
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
 {auditLogs.map((log: AuditLog) => (
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
 {log.resource_id}
 </div>
 </td>
 <td className="px-4 py-3 text-sm text-muted-foreground font-mono">
 {log.ip_address}
 </td>
 <td className="px-4 py-3 text-sm text-muted-foreground">
 {log.details && Object.keys(log.details).length > 0 ? (
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
 <Button
 variant="outline"
 size="sm"
 onClick={() => setOffset(Math.max(0, offset - limit))}
 disabled={offset === 0}
 >
 Previous
 </Button>
 <span className="px-3 py-1 text-sm text-muted-foreground">
 Page {currentPage} of {totalPages}
 </span>
 <Button
 variant="outline"
 size="sm"
 onClick={() => setOffset(offset + limit)}
 disabled={offset + limit >= total}
 >
 Next
 </Button>
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
