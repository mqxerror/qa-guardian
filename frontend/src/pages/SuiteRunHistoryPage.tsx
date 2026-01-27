// SuiteRunHistoryPage - Feature #1851: Test Run History page at suite level
// Shows all historical test runs for a specific suite

import { useState, useEffect, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuthStore } from '../stores/authStore';
import { useTimezoneStore } from '../stores/timezoneStore';

interface TestRun {
  id: string;
  suite_id: string;
  test_id?: string;
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
}

interface TestSuite {
  id: string;
  project_id: string;
  name: string;
  description?: string;
}

interface Project {
  id: string;
  name: string;
}

function SuiteRunHistoryPage() {
  const { suiteId } = useParams<{ suiteId: string }>();
  const navigate = useNavigate();
  const { token } = useAuthStore();
  const { formatDate } = useTimezoneStore();

  const [suite, setSuite] = useState<TestSuite | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Fetch suite details
  useEffect(() => {
    const fetchSuite = async () => {
      if (!suiteId || !token) return;

      try {
        const response = await fetch(`/api/v1/suites/${suiteId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) throw new Error('Failed to fetch suite');

        const data = await response.json();
        setSuite(data);

        // Fetch project details
        if (data.project_id) {
          const projectResponse = await fetch(`/api/v1/projects/${data.project_id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (projectResponse.ok) {
            const projectData = await projectResponse.json();
            setProject(projectData);
          }
        }
      } catch (err) {
        console.error('Error fetching suite:', err);
      }
    };

    fetchSuite();
  }, [suiteId, token]);

  // Fetch runs
  useEffect(() => {
    const fetchRuns = async () => {
      if (!suiteId || !token) return;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/v1/suites/${suiteId}/runs`, {
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
  }, [suiteId, token]);

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

    return { total, passed, failed, running, avgDuration };
  }, [runs]);

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'failed': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'running': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'cancelled': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed': return '✓';
      case 'failed': return '✗';
      case 'running': return '⟳';
      case 'pending': return '○';
      case 'cancelled': return '⊘';
      default: return '?';
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/projects" className="hover:text-foreground">Projects</Link>
          <span>/</span>
          {project && (
            <>
              <Link to={`/projects/${project.id}`} className="hover:text-foreground">{project.name}</Link>
              <span>/</span>
            </>
          )}
          {suite && (
            <>
              <Link to={`/suites/${suite.id}`} className="hover:text-foreground">{suite.name}</Link>
              <span>/</span>
            </>
          )}
          <span className="text-foreground">Run History</span>
        </nav>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Test Run History</h1>
            <p className="text-muted-foreground">
              {suite?.name || 'Loading...'} - All historical test runs
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/suites/${suiteId}`)}
              className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Back to Suite
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="p-4 bg-card border border-border rounded-lg">
            <div className="text-2xl font-bold text-foreground">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total Runs</div>
          </div>
          <div className="p-4 bg-card border border-border rounded-lg">
            <div className="text-2xl font-bold text-green-600">{stats.passed}</div>
            <div className="text-sm text-muted-foreground">Passed</div>
          </div>
          <div className="p-4 bg-card border border-border rounded-lg">
            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
            <div className="text-sm text-muted-foreground">Failed</div>
          </div>
          <div className="p-4 bg-card border border-border rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{stats.running}</div>
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
              placeholder="Search by run ID, branch, or browser..."
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
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
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
            {filteredRuns.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-border rounded-lg">
                <svg className="w-12 h-12 mx-auto text-muted-foreground mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-muted-foreground">No test runs found.</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {runs.length > 0 ? 'Try adjusting your filters.' : 'Run some tests to see history here.'}
                </p>
              </div>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Run ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Date/Time</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Duration</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Pass/Fail</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Browser</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Branch</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paginatedRuns.map((run) => (
                      <tr key={run.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(run.status)}`}>
                            <span>{getStatusIcon(run.status)}</span>
                            {run.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <code className="text-sm font-mono text-foreground">#{run.id.slice(-8)}</code>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-foreground">
                            {formatDate(run.created_at)}
                          </div>
                          {run.started_at && (
                            <div className="text-xs text-muted-foreground">
                              Started: {formatDate(run.started_at)}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-foreground">{formatDuration(run.duration_ms)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-green-600">{run.passed_count} passed</span>
                            <span className="text-muted-foreground">/</span>
                            <span className="text-red-600">{run.failed_count} failed</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {run.results_count} total tests
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-foreground">{run.browser || 'chromium'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-foreground">{run.branch || 'main'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            to={`/runs/${run.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            View Details
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
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="px-2 py-1 text-sm rounded border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ««
                    </button>
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-2 py-1 text-sm rounded border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      «
                    </button>
                    <span className="px-3 text-sm text-foreground">
                      {currentPage} / {totalPages || 1}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                      className="px-2 py-1 text-sm rounded border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      »
                    </button>
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage >= totalPages}
                      className="px-2 py-1 text-sm rounded border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      »»
                    </button>
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

export { SuiteRunHistoryPage };
