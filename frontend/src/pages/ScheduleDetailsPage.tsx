// ScheduleDetailsPage - Extracted from App.tsx for code quality compliance
// Feature #1357: Frontend file size limit enforcement
// Feature #689: Migrated from raw fetch to React Query hooks

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { PageHeader } from '../components/ui';
import { EmptyState, EmptyStateIcons } from '../components/ui/EmptyState';
import { useTimezoneStore } from '../stores/timezoneStore';
import { getStatusColor } from '../constants/colors';
// Feature #689: React Query hooks for caching
// Feature #778: Added useDeleteSchedule and useUpdateSchedule for Edit/Delete buttons
import { useSchedule, useScheduleRuns, useTriggerSchedule, useDeleteSchedule, useUpdateSchedule, type ScheduleRun, type UpdateScheduleInput } from '../hooks/api/useSchedules';
import { Button } from '@/components/ui/button';

export function ScheduleDetailsPage() {
 const { scheduleId } = useParams<{ scheduleId: string }>();
 const navigate = useNavigate();
 const { formatDateTime } = useTimezoneStore();
 const [activeTab, setActiveTab] = useState<'details' | 'history'>('history');
 const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
 const [showEditModal, setShowEditModal] = useState(false);
 const [editForm, setEditForm] = useState<UpdateScheduleInput>({});

 // Feature #689: React Query hooks for caching - replaces useState+useEffect+fetch pattern
 const { data: schedule, isLoading: isScheduleLoading } = useSchedule(scheduleId);
 const { data: runs = [] } = useScheduleRuns(scheduleId);
 const triggerMutation = useTriggerSchedule();
 // Feature #778: Edit and Delete mutations
 const deleteMutation = useDeleteSchedule();
 const updateMutation = useUpdateSchedule();

 const handleTriggerRun = () => {
   if (!scheduleId) return;
   triggerMutation.mutate(scheduleId);
 };

 const handleDelete = () => {
   if (!scheduleId) return;
   deleteMutation.mutate(scheduleId, {
     onSuccess: () => {
       navigate('/schedules');
     },
   });
 };

 const handleEditOpen = () => {
   if (!schedule) return;
   setEditForm({
     name: schedule.name,
     description: schedule.description || '',
     cron_expression: schedule.cron_expression || '',
     timezone: schedule.timezone,
     enabled: schedule.enabled,
     notify_on_failure: schedule.notify_on_failure,
   });
   setShowEditModal(true);
 };

 const handleEditSave = () => {
   if (!scheduleId) return;
   updateMutation.mutate({ id: scheduleId, data: editForm }, {
     onSuccess: () => {
       setShowEditModal(false);
     },
   });
 };

 const isLoading = isScheduleLoading;
 const isTriggering = triggerMutation.isPending;

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
 <Button
 variant="link"
 onClick={() => navigate('/schedules')}
 className="mt-4 px-0"
 >
 Back to Schedules
 </Button>
 </div>
 </Layout>
 );
 }

 return (
 <Layout>
 <div className="p-8">
 <PageHeader
   title={schedule.name}
   description={schedule.description}
   breadcrumbs={[
     { label: 'Home', href: '/' },
     { label: 'Schedules', href: '/schedules' },
     { label: schedule.name }
   ]}
   actions={
     <div className="flex items-center gap-2">
       <Button
         variant="outline"
         onClick={handleEditOpen}
       >
         Edit
       </Button>
       <Button
         variant="destructive"
         onClick={() => setShowDeleteConfirm(true)}
       >
         Delete
       </Button>
       <Button
         onClick={handleTriggerRun}
         disabled={isTriggering}
       >
         {isTriggering ? 'Triggering...' : 'Trigger Run Now'}
       </Button>
     </div>
   }
 />

 {/* Schedule Status Tags */}
 <div className="mt-2 mb-6 flex items-center gap-4 text-sm text-muted-foreground">
 <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
 schedule.enabled ? 'bg-success/10 text-success' : 'bg-muted text-foreground'
 }`}>
 {schedule.enabled ? 'Active' : 'Disabled'}
 </span>
 {schedule.cron_expression && (
 <span>Cron: {schedule.cron_expression}</span>
 )}
 <span>{schedule.run_count || 0} runs</span>
 </div>

 {/* Tabs */}
 <nav className="mb-6 flex border-b border-border" aria-label="Schedule tabs">
 <Button
 variant="ghost"
 onClick={() => setActiveTab('history')}
 className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px rounded-none ${
 activeTab === 'history'
 ? 'border-primary text-foreground'
 : 'border-transparent text-muted-foreground hover:text-foreground'
 }`}
 >
 History
 </Button>
 <Button
 variant="ghost"
 onClick={() => setActiveTab('details')}
 className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px rounded-none ${
 activeTab === 'details'
 ? 'border-primary text-foreground'
 : 'border-transparent text-muted-foreground hover:text-foreground'
 }`}
 >
 Details
 </Button>
 </nav>

 {/* Tab Content */}
 {activeTab === 'history' && (
 <div>
 {runs.length === 0 ? (
 <EmptyState
 icon={EmptyStateIcons.history}
 title="No runs yet"
 description="This schedule hasn't run yet. Click 'Trigger Run Now' to start a test run."
 action={{ label: 'Trigger Run Now', onClick: handleTriggerRun }}
 />
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
 {runs.map((run: ScheduleRun) => (
 <tr key={run.id} className="hover:bg-muted/30">
 <td className="px-4 py-3 text-sm font-mono text-foreground">
 {run.id.slice(-8)}
 </td>
 <td className="px-4 py-3">
 <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${getStatusColor(run.status).badge}`}>
 {run.status}
 </span>
 </td>
 <td className="px-4 py-3 text-sm">
 {run.total > 0 ? (
 <span>
 <span className="text-success">{run.passed} passed</span>
 {run.failed > 0 && (
 <span className="text-destructive ml-2">{run.failed} failed</span>
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
 <Button
 variant="link"
 size="sm"
 onClick={() => navigate(`/runs/${run.id}`)}
 className="px-0 h-auto"
 >
 View Results
 </Button>
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

 {/* Feature #778: Delete Confirmation Dialog */}
 {showDeleteConfirm && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
 <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-lg">
 <h3 className="text-lg font-semibold text-foreground mb-2">Delete Schedule</h3>
 <p className="text-sm text-muted-foreground mb-4">
 Are you sure you want to delete &quot;{schedule.name}&quot;? This action cannot be undone.
 </p>
 <div className="flex justify-end gap-2">
 <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
 Cancel
 </Button>
 <Button
 variant="destructive"
 onClick={handleDelete}
 disabled={deleteMutation.isPending}
 >
 {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
 </Button>
 </div>
 </div>
 </div>
 )}

 {/* Feature #778: Edit Schedule Modal */}
 {showEditModal && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
 <div className="bg-card border border-border rounded-lg p-6 max-w-lg w-full mx-4 shadow-lg">
 <h3 className="text-lg font-semibold text-foreground mb-4">Edit Schedule</h3>
 <div className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-muted-foreground mb-1">Name</label>
 <input
 type="text"
 value={editForm.name || ''}
 onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
 className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-muted-foreground mb-1">Description</label>
 <input
 type="text"
 value={editForm.description || ''}
 onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
 className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-muted-foreground mb-1">Cron Expression</label>
 <input
 type="text"
 value={editForm.cron_expression || ''}
 onChange={(e) => setEditForm(prev => ({ ...prev, cron_expression: e.target.value }))}
 className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono text-foreground"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-muted-foreground mb-1">Timezone</label>
 <input
 type="text"
 value={editForm.timezone || ''}
 onChange={(e) => setEditForm(prev => ({ ...prev, timezone: e.target.value }))}
 className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
 />
 </div>
 <div className="flex items-center gap-2">
 <input
 type="checkbox"
 checked={editForm.notify_on_failure ?? false}
 onChange={(e) => setEditForm(prev => ({ ...prev, notify_on_failure: e.target.checked }))}
 className="rounded border-border"
 id="notify-on-failure"
 />
 <label htmlFor="notify-on-failure" className="text-sm text-foreground">Notify on Failure</label>
 </div>
 </div>
 <div className="flex justify-end gap-2 mt-6">
 <Button variant="outline" onClick={() => setShowEditModal(false)}>
 Cancel
 </Button>
 <Button
 onClick={handleEditSave}
 disabled={updateMutation.isPending}
 >
 {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
 </Button>
 </div>
 </div>
 </div>
 )}
 </div>
 </Layout>
 );
}
