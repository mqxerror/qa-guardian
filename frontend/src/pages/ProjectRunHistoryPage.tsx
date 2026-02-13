// ProjectRunHistoryPage - Feature #1852: Test Run History page at project level
// Shows all historical test runs across all suites in a project
// Feature #689: Migrated from raw fetch to React Query hooks

import { useState, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Loader2, Eye } from 'lucide-react';
// Feature #728: EmptyState adoption
import { EmptyStates, EmptyState, EmptyStateIcons } from '../components/ui/EmptyState';
import { Button } from '@/components/ui/button';
import { Layout } from '../components/Layout';
import { PageHeader } from '../components/ui';
import { useTimezoneStore } from '../stores/timezoneStore';
import { formatDuration } from '../utils/formatDuration';
import { getStatusColor, getStatusIcon } from '../constants/colors';
// Feature #689: React Query hooks for caching
import { useProject } from '../hooks/api/useProjects';
import { useRunsByProject } from '../hooks/api/useRuns';

import type { TestRun } from '@/types/tests';

function ProjectRunHistoryPage() {
 const { projectId } = useParams<{ projectId: string }>();
 const navigate = useNavigate();
 const { formatDate } = useTimezoneStore();

 // Feature #689: React Query hooks for caching - replaces useState+useEffect+fetch pattern
 const { data: project } = useProject(projectId);
 const { data: runsData, isLoading: loading, error: runsError } = useRunsByProject(projectId, 1000);

 // Derive runs from React Query response
 const runs = (runsData?.runs || []) as TestRun[];
 const error = runsError ? (runsError instanceof Error ? runsError.message : 'Failed to load run history') : null;

 // Filters
 const [statusFilter, setStatusFilter] = useState<string>('all');
 const [suiteFilter, setSuiteFilter] = useState<string>('all');
 const [dateFilter, setDateFilter] = useState<string>('all');
 const [searchQuery, setSearchQuery] = useState('');

 // Pagination
 const [currentPage, setCurrentPage] = useState(1);
 const [itemsPerPage, setItemsPerPage] = useState(10);

 // Get unique suites for filter
 const uniqueSuites = useMemo(() => {
 const suites = new Map<string, string>();
 runs.forEach(run => {
 if (run.suite_id && run.suite_name) {
 suites.set(run.suite_id, run.suite_name);
 }
 });
 return Array.from(suites.entries()).sort((a, b) => a[1].localeCompare(b[1]));
 }, [runs]);

 // Filter runs
 const filteredRuns = useMemo(() => {
 let filtered = [...runs];

 // Status filter
 if (statusFilter !== 'all') {
 filtered = filtered.filter(run => run.status === statusFilter);
 }

 // Suite filter
 if (suiteFilter !== 'all') {
 filtered = filtered.filter(run => run.suite_id === suiteFilter);
 }

 // Date filter
 if (dateFilter !== 'all') {
 const now = new Date();
 const cutoff = new Date();

 switch (dateFilter) {
 case 'today':
 cutoff.setHours(0, 0, 0, 0);
 break;
 case 'week':
 cutoff.setDate(now.getDate() - 7);
 break;
 case 'month':
 cutoff.setMonth(now.getMonth() - 1);
 break;
 }

 filtered = filtered.filter(run => new Date(run.created_at) >= cutoff);
 }

 // Search filter (by run ID, suite name, test name, branch)
 if (searchQuery) {
 const query = searchQuery.toLowerCase();
 filtered = filtered.filter(run =>
 run.id.toLowerCase().includes(query) ||
 run.suite_name?.toLowerCase().includes(query) ||
 run.test_name?.toLowerCase().includes(query) ||
 run.branch?.toLowerCase().includes(query) ||
 run.browser?.toLowerCase().includes(query)
 );
 }

 return filtered;
 }, [runs, statusFilter, suiteFilter, dateFilter, searchQuery]);

 // Paginated runs
 const paginatedRuns = useMemo(() => {
 const startIndex = (currentPage - 1) * itemsPerPage;
 return filteredRuns.slice(startIndex, startIndex + itemsPerPage);
 }, [filteredRuns, currentPage, itemsPerPage]);

 const totalPages = Math.ceil(filteredRuns.length / itemsPerPage);

 // Stats
 const stats = useMemo(() => {
 const total = runs.length;
 const passed = runs.filter(r => r.status === 'passed').length;
 const failed = runs.filter(r => r.status === 'failed').length;
 const running = runs.filter(r => r.status === 'running').length;
 const avgDuration = runs.length > 0
 ? runs.reduce((sum, r) => sum + (r.duration_ms || 0), 0) / runs.length
 : 0;
 const suiteCount = uniqueSuites.length;

 return { total, passed, failed, running, avgDuration, suiteCount };
 }, [runs, uniqueSuites]);

 return (
 <Layout>
 <div className="space-y-6">
 <PageHeader
   title="Project Run History"
   description={`${project?.name || 'Loading...'} - All test runs across ${stats.suiteCount} suite${stats.suiteCount !== 1 ? 's' : ''}`}
   breadcrumbs={[
     { label: 'Home', href: '/' },
     { label: 'Projects', href: '/projects' },
     ...(project ? [{ label: project.name, href: `/projects/${project.id}` }] : []),
     { label: 'Run History' }
   ]}
   actions={
     <Button
       variant="outline"
       size="sm"
       onClick={() => navigate(`/projects/${projectId}`)}
     >
       Back to Project
     </Button>
   }
 />

 {/* Stats Cards */}
 <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
 <div className="p-4 bg-card border border-border rounded-lg">
 <div className="text-2xl font-bold text-foreground">{stats.total}</div>
 <div className="text-sm text-muted-foreground">Total Runs</div>
 </div>
 <div className="p-4 bg-card border border-border rounded-lg">
 <div className="text-2xl font-bold text-success">{stats.passed}</div>
 <div className="text-sm text-muted-foreground">Passed</div>
 </div>
 <div className="p-4 bg-card border border-border rounded-lg">
 <div className="text-2xl font-bold text-destructive">{stats.failed}</div>
 <div className="text-sm text-muted-foreground">Failed</div>
 </div>
 <div className="p-4 bg-card border border-border rounded-lg">
 <div className="text-2xl font-bold text-primary">{stats.running}</div>
 <div className="text-sm text-muted-foreground">Running</div>
 </div>
 <div className="p-4 bg-card border border-border rounded-lg">
 <div className="text-2xl font-bold text-foreground">{formatDuration(stats.avgDuration)}</div>
 <div className="text-sm text-muted-foreground">Avg Duration</div>
 </div>
 <div className="p-4 bg-card border border-border rounded-lg">
 <div className="text-2xl font-bold text-accent">{stats.suiteCount}</div>
 <div className="text-sm text-muted-foreground">Suites</div>
 </div>
 </div>

 {/* Filters */}
 <div className="flex flex-wrap gap-4 items-center">
 <div className="flex items-center gap-2">
 <label className="text-sm text-muted-foreground">Status:</label>
 <select
 value={statusFilter}
 onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
 className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
 >
 <option value="all">All</option>
 <option value="passed">Passed</option>
 <option value="failed">Failed</option>
 <option value="running">Running</option>
 <option value="pending">Pending</option>
 <option value="cancelled">Cancelled</option>
 </select>
 </div>

 <div className="flex items-center gap-2">
 <label className="text-sm text-muted-foreground">Suite:</label>
 <select
 value={suiteFilter}
 onChange={(e) => { setSuiteFilter(e.target.value); setCurrentPage(1); }}
 className="rounded-md border border-border bg-background px-3 py-1.5 text-sm max-w-[200px]"
 >
 <option value="all">All Suites ({uniqueSuites.length})</option>
 {uniqueSuites.map(([id, name]) => (
 <option key={id} value={id}>{name}</option>
 ))}
 </select>
 </div>

 <div className="flex items-center gap-2">
 <label className="text-sm text-muted-foreground">Date:</label>
 <select
 value={dateFilter}
 onChange={(e) => { setDateFilter(e.target.value); setCurrentPage(1); }}
 className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
 >
 <option value="all">All Time</option>
 <option value="today">Today</option>
 <option value="week">Last 7 Days</option>
 <option value="month">Last 30 Days</option>
 </select>
 </div>

 <div className="flex-1 min-w-[200px]">
 <input
 type="text"
 placeholder="Search by run ID, suite, test, branch..."
 value={searchQuery}
 onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
 className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
 />
 </div>
 </div>

 {/* Loading/Error States */}
 {loading && (
 <div className="flex items-center justify-center py-12">
 <div className="flex items-center gap-2 text-muted-foreground">
 <Loader2 className="animate-spin h-5 w-5" />
 Loading run history...
 </div>
 </div>
 )}

 {error && (
 <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
 <p className="text-destructive">{error}</p>
 </div>
 )}

 {/* Runs List */}
 {!loading && !error && (
 <>
 {/* Feature #728: EmptyState adoption */}
 {filteredRuns.length === 0 ? (
 runs.length > 0
   ? <EmptyState icon={EmptyStateIcons.search} title="No test runs found" description="Try adjusting your filters." />
   : EmptyStates.noRuns()
 ) : (
 <div className="border border-border rounded-lg overflow-hidden">
 <table className="w-full">
 <thead className="bg-muted/30">
 <tr>
 <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
 <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Run ID</th>
 <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Suite</th>
 <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Date/Time</th>
 <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Duration</th>
 <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Pass/Fail</th>
 <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Branch</th>
 <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-border">
 {paginatedRuns.map((run) => (
 <tr key={run.id} className="hover:bg-muted/20 transition-colors">
 <td className="px-4 py-3">
 <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(run.status).badge}`}>
 <span>{getStatusIcon(run.status)}</span>
 {run.status}
 </span>
 </td>
 <td className="px-4 py-3">
 <code className="text-sm font-mono text-foreground">#{run.id.slice(-8)}</code>
 </td>
 <td className="px-4 py-3">
 <div className="text-sm text-foreground">
 <Link
 to={`/suites/${run.suite_id}`}
 className="hover:text-primary"
 >
 {run.suite_name || 'Unknown Suite'}
 </Link>
 </div>
 {run.test_name && (
 <div className="text-xs text-muted-foreground truncate max-w-[150px]" title={run.test_name}>
 {run.test_name}
 </div>
 )}
 </td>
 <td className="px-4 py-3">
 <div className="text-sm text-foreground">
 {formatDate(run.created_at)}
 </div>
 </td>
 <td className="px-4 py-3">
 <span className="text-sm text-foreground">{formatDuration(run.duration_ms)}</span>
 </td>
 <td className="px-4 py-3">
 <div className="flex items-center gap-2 text-sm">
 <span className="text-success">{run.passed_count}</span>
 <span className="text-muted-foreground">/</span>
 <span className="text-destructive">{run.failed_count}</span>
 </div>
 <div className="text-xs text-muted-foreground">
 {run.results_count} test{run.results_count !== 1 ? 's' : ''}
 </div>
 </td>
 <td className="px-4 py-3">
 <span className="text-sm text-foreground">{run.branch || 'main'}</span>
 </td>
 <td className="px-4 py-3">
 <Link
 to={`/runs/${run.id}`}
 className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
 >
 <Eye className="w-4 h-4" />
 View
 </Link>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}

 {/* Pagination */}
 {filteredRuns.length > 0 && (
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
 <div className="text-sm text-muted-foreground">
 Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredRuns.length)} of {filteredRuns.length} runs
 </div>
 <div className="flex items-center gap-2">
 <label className="text-sm text-muted-foreground">Per page:</label>
 <select
 value={itemsPerPage}
 onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
 className="rounded-md border border-border bg-background px-2 py-1 text-sm"
 >
 <option value={5}>5</option>
 <option value={10}>10</option>
 <option value={25}>25</option>
 <option value={50}>50</option>
 </select>

 <div className="flex items-center gap-1 ml-4">
 <Button
 variant="outline"
 size="sm"
 onClick={() => setCurrentPage(1)}
 disabled={currentPage === 1}
 className="px-2 py-1"
 >
 ««
 </Button>
 <Button
 variant="outline"
 size="sm"
 onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
 disabled={currentPage === 1}
 className="px-2 py-1"
 >
 «
 </Button>
 <span className="px-3 text-sm text-foreground">
 {currentPage} / {totalPages || 1}
 </span>
 <Button
 variant="outline"
 size="sm"
 onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
 disabled={currentPage >= totalPages}
 className="px-2 py-1"
 >
 »
 </Button>
 <Button
 variant="outline"
 size="sm"
 onClick={() => setCurrentPage(totalPages)}
 disabled={currentPage >= totalPages}
 className="px-2 py-1"
 >
 »»
 </Button>
 </div>
 </div>
 </div>
 )}
 </>
 )}
 </div>
 </Layout>
 );
}

export { ProjectRunHistoryPage };
