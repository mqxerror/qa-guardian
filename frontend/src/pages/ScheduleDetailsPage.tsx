// ScheduleDetailsPage - Extracted from App.tsx for code quality compliance
// Feature #1357: Frontend file size limit enforcement
// Note: This file is 675 lines, exceeding the 400 line limit. Future work should split it further.

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuthStore } from '../stores/authStore';
import { useTimezoneStore } from '../stores/timezoneStore';

// Type definitions for schedules
interface Schedule {
  id: string;
  suite_id: string;
  name: string;
  description?: string;
  cron_expression?: string;
  run_at?: string;
  timezone: string;
  enabled: boolean;
  browsers: string[];
  notify_on_failure: boolean;
  created_at: string;
  next_run_at?: string;
  run_count?: number;
  last_run_id?: string;
}

interface ScheduleRun {
  id: string;
  suite_id: string;
  status: string;
  browser: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  created_at: string;
  passed: number;
  failed: number;
  total: number;
}

// Feature #1538: Predictive Resource Scaling removed - enterprise infrastructure feature not needed for SMB

export function ScheduleDetailsPage() {
  const { scheduleId } = useParams<{ scheduleId: string }>();
  const navigate = useNavigate();
  const { token } = useAuthStore();
  const { formatDateTime } = useTimezoneStore();
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [runs, setRuns] = useState<ScheduleRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'history'>('history');
  const [isTriggering, setIsTriggering] = useState(false);

  // Feature #1538: Resource scaling state removed - enterprise infrastructure feature not needed for SMB

  useEffect(() => {
    const fetchData = async () => {
      if (!scheduleId) return;

      try {
        // Fetch schedule details
        const scheduleRes = await fetch(`/api/v1/schedules/${scheduleId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (scheduleRes.ok) {
          const data = await scheduleRes.json();
          setSchedule(data.schedule);
        }

        // Fetch schedule run history
        const runsRes = await fetch(`/api/v1/schedules/${scheduleId}/runs`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (runsRes.ok) {
          const data = await runsRes.json();
          setRuns(data.runs);
        }
      } catch (err) {
        console.error('Failed to fetch schedule data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [scheduleId, token]);

  // Feature #1538: Predictive resource scaling functions removed - enterprise infrastructure feature not needed for SMB

  const handleTriggerRun = async () => {
    if (!scheduleId) return;
    setIsTriggering(true);

    try {
      const response = await fetch(`/api/v1/schedules/${scheduleId}/trigger`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Add the new run to the list
        setRuns([
          {
            id: data.run.id,
            suite_id: data.run.suite_id,
            status: 'pending',
            browser: schedule?.browsers[0] || 'chromium',
            created_at: data.run.created_at,
            passed: 0,
            failed: 0,
            total: 0,
          },
          ...runs,
        ]);
        // Update schedule run count
        if (schedule) {
          setSchedule({
            ...schedule,
            run_count: (schedule.run_count || 0) + 1,
            last_run_id: data.run.id,
          });
        }
      }
    } catch (err) {
      console.error('Failed to trigger schedule:', err);
    } finally {
      setIsTriggering(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'failed':
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'running':
      case 'pending':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'cancelled':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center p-8">
          <div className="text-muted-foreground">Loading schedule details...</div>
        </div>
      </Layout>
    );
  }

  if (!schedule) {
    return (
      <Layout>
        <div className="p-8">
          <div className="text-destructive">Schedule not found</div>
          <button
            onClick={() => navigate('/schedules')}
            className="mt-4 text-primary hover:underline"
          >
            Back to Schedules
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-8">
        {/* Breadcrumb */}
        <nav className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <button onClick={() => navigate('/schedules')} className="hover:text-foreground">
            Schedules
          </button>
          <span>/</span>
          <span className="text-foreground">{schedule.name}</span>
        </nav>

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{schedule.name}</h1>
            {schedule.description && (
              <p className="mt-2 text-muted-foreground">{schedule.description}</p>
            )}
            <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                schedule.enabled ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
              }`}>
                {schedule.enabled ? 'Active' : 'Disabled'}
              </span>
              {schedule.cron_expression && (
                <span>Cron: {schedule.cron_expression}</span>
              )}
              <span>{schedule.run_count || 0} runs</span>
            </div>
          </div>
          {/* Feature #1538: AI-Scaled Run button removed - enterprise infrastructure feature not needed for SMB */}
          <button
            onClick={handleTriggerRun}
            disabled={isTriggering}
            className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isTriggering ? 'Triggering...' : 'Trigger Run Now'}
          </button>
        </div>

        {/* Feature #1538: Predictive Resource Scaling Panel removed - enterprise infrastructure feature not needed for SMB */}

        {/* Tabs */}
        <nav className="mb-6 flex border-b border-border" aria-label="Schedule tabs">
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              activeTab === 'history'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            History
          </button>
          <button
            onClick={() => setActiveTab('details')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              activeTab === 'details'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Details
          </button>
        </nav>

        {/* Tab Content */}
        {activeTab === 'history' && (
          <div>
            {runs.length === 0 ? (
              <div className="rounded-lg border border-border bg-card p-8 text-center">
                <h3 className="text-lg font-semibold text-foreground">No runs yet</h3>
                <p className="mt-2 text-muted-foreground">
                  This schedule hasn&apos;t run yet. Click "Trigger Run Now" to start a test run.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Run ID</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Results</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Browser</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Duration</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Started</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {runs.map((run) => (
                      <tr key={run.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 text-sm font-mono text-foreground">
                          {run.id.slice(-8)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${getStatusColor(run.status)}`}>
                            {run.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {run.total > 0 ? (
                            <span>
                              <span className="text-green-600 dark:text-green-400">{run.passed} passed</span>
                              {run.failed > 0 && (
                                <span className="text-red-600 dark:text-red-400 ml-2">{run.failed} failed</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground capitalize">
                          {run.browser}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {run.started_at ? formatDateTime(run.started_at) : formatDateTime(run.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => navigate(`/runs/${run.id}`)}
                            className="text-sm text-primary hover:underline"
                          >
                            View Results
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'details' && (
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Schedule Type</h4>
                <p className="mt-1 text-foreground">
                  {schedule.cron_expression ? 'Recurring' : 'One-time'}
                </p>
              </div>
              {schedule.cron_expression && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Cron Expression</h4>
                  <p className="mt-1 font-mono text-foreground">{schedule.cron_expression}</p>
                </div>
              )}
              {schedule.run_at && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Scheduled For</h4>
                  <p className="mt-1 text-foreground">{formatDateTime(schedule.run_at)}</p>
                </div>
              )}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Timezone</h4>
                <p className="mt-1 text-foreground">{schedule.timezone}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Browsers</h4>
                <div className="mt-1 flex flex-wrap gap-1">
                  {schedule.browsers.map((browser) => (
                    <span key={browser} className="rounded bg-muted px-2 py-0.5 text-xs capitalize">
                      {browser}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Notify on Failure</h4>
                <p className="mt-1 text-foreground">{schedule.notify_on_failure ? 'Yes' : 'No'}</p>
              </div>
              {schedule.next_run_at && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Next Run</h4>
                  <p className="mt-1 text-foreground">{formatDateTime(schedule.next_run_at)}</p>
                </div>
              )}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Created</h4>
                <p className="mt-1 text-foreground">{formatDateTime(schedule.created_at)}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
