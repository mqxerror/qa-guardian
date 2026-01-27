// RunHistoryPage - Feature #1855: Global Run History page accessible from sidebar
// Shows all historical test runs across all projects in the organization

import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuthStore } from '../stores/authStore';
import { useTimezoneStore } from '../stores/timezoneStore';

interface TestRun {
  id: string;
  suite_id: string;
  suite_name: string;
  project_id?: string;
  test_id?: string;
  test_name?: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'cancelled';
  browser?: string;
  branch?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  results_count: number;
  passed_count: number;
  failed_count: number;
  skipped_count?: number;
}

interface Project {
  id: string;
  name: string;
}

function RunHistoryPage() {
  const { token } = useAuthStore();
  const { formatDate } = useTimezoneStore();

  const [runs, setRuns] = useState<TestRun[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Fetch projects for the filter dropdown
  useEffect(() => {
    const fetchProjects = async () => {
      if (!token) return;

      try {
        const response = await fetch('/api/v1/projects', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) throw new Error('Failed to fetch projects');

        const data = await response.json();
        setProjects(data.projects || []);
      } catch (err) {
        console.error('Error fetching projects:', err);
      }
    };

    fetchProjects();
  }, [token]);

  // Fetch all runs
  useEffect(() => {
    const fetchRuns = async () => {
      if (!token) return;

      setLoading(true);
      setError(null);

      try {
        // Build query params
        const params = new URLSearchParams({ limit: '1000' });
        if (projectFilter !== 'all') {
          params.append('project_id', projectFilter);
        }
        if (statusFilter !== 'all') {
          params.append('status', statusFilter);
        }

        const response = await fetch(`/api/test-runs?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch runs: ${response.status}`);
        }

        const data = await response.json();
        setRuns(data.runs || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load run history');
      } finally {
        setLoading(false);
      }
    };

    fetchRuns();
  }, [token, projectFilter, statusFilter]);

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

  // Calculate stats
  const stats = useMemo(() => {
    const total = filteredRuns.length;
    const passed = filteredRuns.filter(r => r.status === 'passed').length;
    const failed = filteredRuns.filter(r => r.status === 'failed').length;
    const running = filteredRuns.filter(r => r.status === 'running').length;
    const totalDuration = filteredRuns.reduce((sum, r) => sum + (r.duration_ms || 0), 0);
    const avgDuration = total > 0 ? totalDuration / total : 0;

    return { total, passed, failed, running, avgDuration };
  }, [filteredRuns]);

  // Pagination
  const totalPages = Math.ceil(filteredRuns.length / itemsPerPage);
  const paginatedRuns = filteredRuns.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

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

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4 text-sm">
              <div className="text-muted-foreground">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredRuns.length)} of {filteredRuns.length} runs
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
                    disabled={currentPage === 1}
                    className="px-2 py-1 rounded border border-border bg-background disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted"
                  >
                    &laquo;&laquo;
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-2 py-1 rounded border border-border bg-background disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted"
                  >
                    &laquo;
                  </button>
                  <span className="px-3 py-1">{currentPage} / {totalPages || 1}</span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="px-2 py-1 rounded border border-border bg-background disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted"
                  >
                    &raquo;
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage >= totalPages}
                    className="px-2 py-1 rounded border border-border bg-background disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted"
                  >
                    &raquo;&raquo;
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}

export { RunHistoryPage };
