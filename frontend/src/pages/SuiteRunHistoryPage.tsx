// SuiteRunHistoryPage - Feature #1851: Test Run History page at suite level
// Shows all historical test runs for a specific suite
// Feature #677: Migrated to React Query hooks
// Feature #703: Added virtualization for large run lists

import { useState, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Loader2, Eye } from 'lucide-react';
import { Button } from '../components/ui/button';
// Feature #728: EmptyState adoption
import { EmptyStates, EmptyState, EmptyStateIcons } from '../components/ui/EmptyState';
import { Layout } from '../components/Layout';
import { PageHeader, VirtualTable } from '../components/ui';
import { useTimezoneStore } from '../stores/timezoneStore';
// Feature #677: Use React Query hooks instead of raw fetch+useState
import { useSuite } from '../hooks/api/useSuites';
import { useRunsBySuite, type TestRun } from '../hooks/api/useRuns';
import { useProject } from '../hooks/api/useProjects';
import { formatDuration } from '../utils/formatDuration';
import { getStatusColor, getStatusIcon } from '../constants/colors';

function SuiteRunHistoryPage() {
 const { suiteId } = useParams<{ suiteId: string }>();
 const navigate = useNavigate();
 const { formatDate } = useTimezoneStore();

 // Feature #677: React Query hooks for data fetching with caching
 const { data: suiteData, isLoading: suiteLoading } = useSuite(suiteId);
 const suite = suiteData?.suite ?? suiteData ?? null;
 const projectId = suite?.project_id;

 const { data: projectData } = useProject(projectId);
 const project = projectData?.project ?? projectData ?? null;

 const { data: runsData, isLoading: runsLoading, error: runsError } = useRunsBySuite(suiteId);
 const runs: TestRun[] = runsData?.runs ?? [];

 // Derived loading/error state
 const loading = suiteLoading || runsLoading;
 const error = runsError ? (runsError instanceof Error ? runsError.message : 'Failed to load run history') : null;

 // Filters
 const [statusFilter, setStatusFilter] = useState<string>('all');
 const [dateFilter, setDateFilter] = useState<string>('all');
 const [searchQuery, setSearchQuery] = useState('');

 // Feature #703: Virtualization replaces pagination for better performance
 // Virtual table row height (in pixels) - matches table row styling
 const ROW_HEIGHT = 72; // Approximate row height with content

 // Filter runs
 const filteredRuns = useMemo(() => {
 let filtered = [...runs];

 // Status filter
 if (statusFilter !== 'all') {
 filtered = filtered.filter(run => run.status === statusFilter);
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

 // Search filter (by run ID or branch)
 if (searchQuery) {
 const query = searchQuery.toLowerCase();
 filtered = filtered.filter(run =>
 run.id.toLowerCase().includes(query) ||
 run.branch?.toLowerCase().includes(query) ||
 run.browser?.toLowerCase().includes(query)
 );
 }

 return filtered;
 }, [runs, statusFilter, dateFilter, searchQuery]);

 // Feature #703: Virtualization handles rendering - no pagination needed
 // Calculate container height based on available viewport space
 const CONTAINER_HEIGHT = 500; // Fixed height for virtual scroll container

 // Stats
 const stats = useMemo(() => {
 const total = runs.length;
 const passed = runs.filter(r => r.status === 'passed').length;
 const failed = runs.filter(r => r.status === 'failed').length;
 const running = runs.filter(r => r.status === 'running').length;
 const avgDuration = runs.length > 0
 ? runs.reduce((sum, r) => sum + (r.duration_ms || 0), 0) / runs.length
 : 0;

 return { total, passed, failed, running, avgDuration };
 }, [runs]);

 return (
 <Layout>
 <div className="space-y-6">
 <PageHeader
   title="Test Run History"
   description={`${suite?.name || 'Loading...'} - All historical test runs`}
   breadcrumbs={[
     { label: 'Home', href: '/' },
     { label: 'Projects', href: '/projects' },
     ...(project ? [{ label: project.name, href: `/projects/${project.id}` }] : []),
     ...(suite ? [{ label: suite.name, href: `/suites/${suite.id}` }] : []),
     { label: 'Run History' }
   ]}
   actions={
     <Button
       onClick={() => navigate(`/suites/${suiteId}`)}
       variant="outline"
     >
       Back to Suite
     </Button>
   }
 />

 {/* Stats Cards */}
 <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
 </div>

 {/* Filters */}
 <div className="flex flex-wrap gap-4 items-center">
 <div className="flex items-center gap-2">
 <label className="text-sm text-muted-foreground">Status:</label>
 <select
 value={statusFilter}
 onChange={(e) => setStatusFilter(e.target.value)}
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
 <label className="text-sm text-muted-foreground">Date:</label>
 <select
 value={dateFilter}
 onChange={(e) => setDateFilter(e.target.value)}
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
 placeholder="Search by run ID, branch, or browser..."
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
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
 {/* Feature #703: Virtualized table for performance with large run lists */}
 <div className="border border-border rounded-lg overflow-hidden">
 <VirtualTable
 items={filteredRuns}
 rowHeight={ROW_HEIGHT}
 containerHeight={CONTAINER_HEIGHT}
 getRowKey={(run) => run.id}
 isLoading={loading}
 emptyState={
 /* Feature #728: EmptyState adoption */
 runs.length > 0
   ? <EmptyState icon={EmptyStateIcons.search} title="No test runs found" description="Try adjusting your filters." />
   : EmptyStates.noRuns()
 }
 renderHeader={() => (
 <div className="grid grid-cols-8 gap-2 px-4 py-3 bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wider">
 <div>Status</div>
 <div>Run ID</div>
 <div>Date/Time</div>
 <div>Duration</div>
 <div>Pass/Fail</div>
 <div>Browser</div>
 <div>Branch</div>
 <div>Actions</div>
 </div>
 )}
 renderRow={(run) => (
 <div className="grid grid-cols-8 gap-2 px-4 py-3 items-center border-b border-border hover:bg-muted/20 transition-colors">
 <div>
 <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(run.status).badge}`}>
   <span>{getStatusIcon(run.status)}</span>
   {run.status}
 </span>
 </div>
 <div>
 <code className="text-sm font-mono text-foreground">#{run.id.slice(-8)}</code>
 </div>
 <div>
 <div className="text-sm text-foreground">
   {formatDate(run.created_at)}
 </div>
 {run.started_at && (
   <div className="text-xs text-muted-foreground">
     Started: {formatDate(run.started_at)}
   </div>
 )}
 </div>
 <div>
 <span className="text-sm text-foreground">{formatDuration(run.duration_ms)}</span>
 </div>
 <div>
 <div className="flex items-center gap-2 text-sm">
   <span className="text-success">{run.passed_count} passed</span>
   <span className="text-muted-foreground">/</span>
   <span className="text-destructive">{run.failed_count} failed</span>
 </div>
 <div className="text-xs text-muted-foreground">
   {run.results_count} total tests
 </div>
 </div>
 <div>
 <span className="text-sm text-foreground">{run.browser || 'chromium'}</span>
 </div>
 <div>
 <span className="text-sm text-foreground">{run.branch || 'main'}</span>
 </div>
 <div>
 <Link
   to={`/runs/${run.id}`}
   className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
 >
   <Eye className="w-4 h-4" />
   View
 </Link>
 </div>
 </div>
 )}
 />
 </div>

 {/* Feature #703: Virtualization info replaces pagination */}
 {filteredRuns.length > 0 && (
 <div className="text-sm text-muted-foreground">
 Showing {filteredRuns.length} runs (scroll to see more)
 </div>
 )}
 </>
 )}
 </div>
 </Layout>
 );
}

export { SuiteRunHistoryPage };
