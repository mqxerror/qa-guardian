// RunHistoryPage - Feature #1855: Global Run History page accessible from sidebar
// Shows all historical test runs across all projects in the organization
// Feature #57: Migrated to React Query with server-side pagination
// Feature #64: Added infinite scroll as alternative to pagination
// Feature #113: Added virtual scrolling for large run lists

import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useTimezoneStore } from '../stores/timezoneStore';
import { useRunsPaginated, useRunsInfinite, useProjects, type TestRun } from '../hooks/api';
import { InfiniteScrollContainer } from '../components/ui/InfiniteScrollContainer';
import { VirtualTable } from '../components/ui/VirtualList';

function RunHistoryPage() {
  const { formatDate } = useTimezoneStore();

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination - server-side via React Query
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Feature #64: Toggle between pagination and infinite scroll
  const [useInfiniteScroll, setUseInfiniteScroll] = useState(false);

  // Fetch projects using React Query
  const { data: projectsData } = useProjects();
  const projects = projectsData?.projects || [];

  // Fetch runs using React Query with server-side pagination (when not using infinite scroll)
  const {
    data: runsData,
    isLoading: paginationLoading,
    error: runsError,
  } = useRunsPaginated({
    page: currentPage,
    limit: itemsPerPage,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    project_id: projectFilter !== 'all' ? projectFilter : undefined,
  });

  // Feature #64: Infinite scroll query
  const {
    data: infiniteData,
    isLoading: infiniteLoading,
    error: infiniteError,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useRunsInfinite({
    limit: itemsPerPage,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    project_id: projectFilter !== 'all' ? projectFilter : undefined,
  });

  // Get runs based on mode
  const runs = useInfiniteScroll
    ? (infiniteData?.pages.flatMap(page => page.data) || [])
    : (runsData?.data || []);
  const pagination = useInfiniteScroll ? null : runsData?.pagination;
  const loading = useInfiniteScroll ? infiniteLoading : paginationLoading;
  const error = useInfiniteScroll
    ? (infiniteError instanceof Error ? infiniteError.message : infiniteError ? String(infiniteError) : null)
    : (runsError instanceof Error ? runsError.message : runsError ? String(runsError) : null);

  // Get unique suites from runs
  const uniqueSuites = useMemo(() => {
    const suiteMap = new Map<string, string>();
    runs.forEach(run => {
      if (!suiteMap.has(run.suite_id)) {
        suiteMap.set(run.suite_id, run.suite_name);
      }
    });
    return Array.from(suiteMap.entries()).map(([id, name]) => ({ id, name }));
  }, [runs]);

  // Apply client-side filters
  const filteredRuns = useMemo(() => {
    let filtered = [...runs];

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      filtered = filtered.filter(run => {
        const runDate = new Date(run.created_at);

        switch (dateFilter) {
          case 'today':
            return runDate >= today;
          case 'week':
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            return runDate >= weekAgo;
          case 'month':
            const monthAgo = new Date(today);
            monthAgo.setDate(monthAgo.getDate() - 30);
            return runDate >= monthAgo;
          default:
            return true;
        }
      });
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(run =>
        run.id.toLowerCase().includes(query) ||
        run.suite_name.toLowerCase().includes(query) ||
        (run.test_name && run.test_name.toLowerCase().includes(query)) ||
        (run.branch && run.branch.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [runs, dateFilter, searchQuery]);

  // Calculate stats from current page data (local stats)
  // Note: For full stats, the API could be enhanced to return aggregates
  const stats = useMemo(() => {
    const total = pagination?.total || filteredRuns.length;
    const passed = filteredRuns.filter(r => r.status === 'passed').length;
    const failed = filteredRuns.filter(r => r.status === 'failed').length;
    const running = filteredRuns.filter(r => r.status === 'running').length;
    const totalDuration = filteredRuns.reduce((sum, r) => sum + (r.duration_ms || 0), 0);
    const avgDuration = filteredRuns.length > 0 ? totalDuration / filteredRuns.length : 0;

    return { total, passed, failed, running, avgDuration };
  }, [filteredRuns, pagination?.total]);

  // Server-side pagination - use API pagination when no client-side filters are active
  const hasClientSideFilters = dateFilter !== 'all' || searchQuery.trim() !== '';

  // If client-side filters are active, do client-side pagination on filtered results
  // Otherwise, use server-side pagination directly
  const totalPages = hasClientSideFilters
    ? Math.ceil(filteredRuns.length / itemsPerPage)
    : (pagination?.totalPages || 1);

  const paginatedRuns = hasClientSideFilters
    ? filteredRuns // Already filtered, show all (pagination happens server-side on full dataset)
    : filteredRuns; // Server already paginated

  // Format duration
  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  };

  // Status badge component
  const StatusBadge = ({ status }: { status: string }) => {
    const colors: Record<string, string> = {
      passed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      running: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
    };
    const icons: Record<string, string> = {
      passed: '\u2713',
      failed: '\u2717',
      running: '\u25B6',
      pending: '\u231B',
      cancelled: '\u2715',
    };

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${colors[status] || colors.pending}`}>
        <span>{icons[status] || icons.pending}</span>
        {status}
      </span>
    );
  };

  return (
    <Layout>
      <div className="p-8">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-sm">
          <Link to="/dashboard" className="text-muted-foreground hover:text-foreground">
            Dashboard
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium text-foreground">Run History</span>
        </nav>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Run History</h1>
            <p className="text-muted-foreground mt-1">
              {loading ? 'Loading...' : `All test runs across ${projects.length} projects`}
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-card rounded-lg border border-border p-4">
            <div className="text-2xl font-bold text-foreground">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total Runs</div>
          </div>
          <div className="bg-card rounded-lg border border-border p-4">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.passed}</div>
            <div className="text-sm text-muted-foreground">Passed</div>
          </div>
          <div className="bg-card rounded-lg border border-border p-4">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.failed}</div>
            <div className="text-sm text-muted-foreground">Failed</div>
          </div>
          <div className="bg-card rounded-lg border border-border p-4">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.running}</div>
            <div className="text-sm text-muted-foreground">Running</div>
          </div>
          <div className="bg-card rounded-lg border border-border p-4">
            <div className="text-2xl font-bold text-foreground">{formatDuration(stats.avgDuration)}</div>
            <div className="text-sm text-muted-foreground">Avg Duration</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-6 bg-card rounded-lg border border-border p-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
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
            <span className="text-sm text-muted-foreground">Project:</span>
            <select
              value={projectFilter}
              onChange={(e) => { setProjectFilter(e.target.value); setCurrentPage(1); }}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
            >
              <option value="all">All Projects ({projects.length})</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Date:</span>
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

          <input
            type="text"
            placeholder="Search by run ID, suite, test, branch..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="flex-1 min-w-[200px] rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          />

          {/* Feature #64: Infinite scroll toggle */}
          <label className="flex items-center gap-2 cursor-pointer ml-auto">
            <input
              type="checkbox"
              checked={useInfiniteScroll}
              onChange={(e) => setUseInfiniteScroll(e.target.checked)}
              className="rounded border-border"
            />
            <span className="text-sm text-muted-foreground">Infinite scroll</span>
          </label>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg p-4 mb-6">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredRuns.length === 0 && (
          <div className="text-center py-12 bg-card rounded-lg border border-border">
            <svg className="mx-auto h-12 w-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-foreground">No runs found</h3>
            <p className="mt-2 text-muted-foreground">
              {runs.length === 0 ? 'No test runs have been executed yet.' : 'No runs match your current filters.'}
            </p>
          </div>
        )}

        {/* Runs Table */}
        {!loading && !error && filteredRuns.length > 0 && (
          <>
            {/* Feature #64: Wrap table in InfiniteScrollContainer when infinite scroll is enabled */}
            {useInfiniteScroll ? (
              <InfiniteScrollContainer
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                fetchNextPage={fetchNextPage}
                threshold={200}
                height={600}
                className="bg-card rounded-lg border border-border overflow-hidden"
                showEndOfList={true}
                endOfListIndicator={
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    All {filteredRuns.length} runs loaded
                  </div>
                }
              >
                <table className="w-full">
                  <thead className="bg-muted/50 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Run ID</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Suite</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Date/Time</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Duration</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Pass/Fail</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Branch</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredRuns.map((run) => (
                      <tr key={run.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <StatusBadge status={run.status} />
                        </td>
                        <td className="px-4 py-3">
                          <code className="text-sm text-foreground">#{run.id.slice(-8)}</code>
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            to={`/suites/${run.suite_id}`}
                            className="text-primary hover:underline font-medium"
                          >
                            {run.suite_name}
                          </Link>
                          {run.test_name && (
                            <div className="text-xs text-muted-foreground mt-0.5" title={run.test_name}>
                              {run.test_name}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          <div>{formatDate(run.created_at)}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground">
                          {formatDuration(run.duration_ms)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 text-sm">
                            <span className="text-green-600 dark:text-green-400 font-medium">{run.passed_count}</span>
                            <span className="text-muted-foreground">/</span>
                            <span className="text-red-600 dark:text-red-400 font-medium">{run.failed_count}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {run.results_count} test{run.results_count !== 1 ? 's' : ''}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {run.branch || 'main'}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            to={`/runs/${run.id}`}
                            className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </InfiniteScrollContainer>
            ) : (
              <>
                {/* Feature #113: Use VirtualTable for large lists (>50 rows) */}
                {paginatedRuns.length > 50 ? (
                  <div className="bg-card rounded-lg border border-border overflow-hidden">
                    <VirtualTable
                      items={paginatedRuns}
                      rowHeight={72}
                      containerHeight={600}
                      overscan={5}
                      getRowKey={(run) => run.id}
                      renderHeader={() => (
                        <div className="grid grid-cols-8 gap-2 px-4 py-3 bg-muted/50 text-sm font-medium text-muted-foreground border-b border-border">
                          <span>Status</span>
                          <span>Run ID</span>
                          <span>Suite</span>
                          <span>Date/Time</span>
                          <span>Duration</span>
                          <span>Pass/Fail</span>
                          <span>Branch</span>
                          <span>Actions</span>
                        </div>
                      )}
                      renderRow={(run) => (
                        <div className="grid grid-cols-8 gap-2 px-4 py-3 items-center border-b border-border hover:bg-muted/30">
                          <div>
                            <StatusBadge status={run.status} />
                          </div>
                          <div>
                            <code className="text-sm text-foreground">#{run.id.slice(-8)}</code>
                          </div>
                          <div>
                            <Link
                              to={`/suites/${run.suite_id}`}
                              className="text-primary hover:underline font-medium"
                            >
                              {run.suite_name}
                            </Link>
                            {run.test_name && (
                              <div className="text-xs text-muted-foreground mt-0.5 truncate" title={run.test_name}>
                                {run.test_name}
                              </div>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {formatDate(run.created_at)}
                          </div>
                          <div className="text-sm text-foreground">
                            {formatDuration(run.duration_ms)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1 text-sm">
                              <span className="text-green-600 dark:text-green-400 font-medium">{run.passed_count}</span>
                              <span className="text-muted-foreground">/</span>
                              <span className="text-red-600 dark:text-red-400 font-medium">{run.failed_count}</span>
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {run.branch || 'main'}
                          </div>
                          <div>
                            <Link
                              to={`/runs/${run.id}`}
                              className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
                            >
                              View
                            </Link>
                          </div>
                        </div>
                      )}
                    />
                  </div>
                ) : (
                  <div className="bg-card rounded-lg border border-border overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Run ID</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Suite</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Date/Time</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Duration</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Pass/Fail</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Branch</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {paginatedRuns.map((run) => (
                          <tr key={run.id} className="hover:bg-muted/30">
                            <td className="px-4 py-3">
                              <StatusBadge status={run.status} />
                            </td>
                            <td className="px-4 py-3">
                              <code className="text-sm text-foreground">#{run.id.slice(-8)}</code>
                            </td>
                            <td className="px-4 py-3">
                              <Link
                                to={`/suites/${run.suite_id}`}
                                className="text-primary hover:underline font-medium"
                              >
                                {run.suite_name}
                              </Link>
                              {run.test_name && (
                                <div className="text-xs text-muted-foreground mt-0.5" title={run.test_name}>
                                  {run.test_name}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">
                              <div>{formatDate(run.created_at)}</div>
                            </td>
                            <td className="px-4 py-3 text-sm text-foreground">
                              {formatDuration(run.duration_ms)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1 text-sm">
                                <span className="text-green-600 dark:text-green-400 font-medium">{run.passed_count}</span>
                                <span className="text-muted-foreground">/</span>
                                <span className="text-red-600 dark:text-red-400 font-medium">{run.failed_count}</span>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {run.results_count} test{run.results_count !== 1 ? 's' : ''}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">
                              {run.branch || 'main'}
                            </td>
                            <td className="px-4 py-3">
                              <Link
                                to={`/runs/${run.id}`}
                                className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                View
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Pagination - only shown when not using infinite scroll */}
                <div className="flex items-center justify-between mt-4 text-sm">
                  <div className="text-muted-foreground">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, pagination?.total || paginatedRuns.length)} of {pagination?.total || paginatedRuns.length} runs
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Per page:</span>
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
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1 || (pagination && !pagination.hasPrev)}
                        className="px-2 py-1 rounded border border-border bg-background disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted"
                      >
                        &laquo;&laquo;
                      </button>
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1 || (pagination && !pagination.hasPrev)}
                        className="px-2 py-1 rounded border border-border bg-background disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted"
                      >
                        &laquo;
                      </button>
                      <span className="px-3 py-1">{currentPage} / {totalPages || 1}</span>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage >= totalPages || (pagination && !pagination.hasNext)}
                        className="px-2 py-1 rounded border border-border bg-background disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted"
                      >
                        &raquo;
                      </button>
                      <button
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage >= totalPages || (pagination && !pagination.hasNext)}
                        className="px-2 py-1 rounded border border-border bg-background disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted"
                      >
                        &raquo;&raquo;
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

export { RunHistoryPage };
