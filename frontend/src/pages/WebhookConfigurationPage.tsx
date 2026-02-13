// WebhookConfigurationPage extracted from App.tsx for code quality compliance (Feature #1357)
// Note: This file is 723 lines - will need further splitting in future sessions
// Feature #636: Adopt Modal component in page-level inline modals
// Feature #690: Migrated from raw fetch to React Query hooks
import { useState } from 'react';
import { Modal, ModalBody, ModalFooter } from '../components/ui/Modal';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Button } from '../components/ui/button';
import { PageHeader } from '../components/ui';
// Feature #728: EmptyState adoption
import { EmptyState, EmptyStateIcons } from '../components/ui/EmptyState';
import { useTimezoneStore } from '../stores/timezoneStore';
// Feature #690: React Query hooks for data fetching and mutations
import {
  useWebhooks,
  useCreateWebhook,
  useUpdateWebhook,
  useDeleteWebhook,
  useWebhookLogs,
  type WebhookSubscription,
} from '../hooks/api/useOrganization';

export function WebhookConfigurationPage() {
  const { formatDate } = useTimezoneStore();

  // Feature #690: React Query hooks for data fetching and mutations
  const { data: webhooks = [], isLoading } = useWebhooks();
  const createMutation = useCreateWebhook();
  const updateMutation = useUpdateWebhook();
  const deleteMutation = useDeleteWebhook();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookSubscription | null>(null);
  const [error, setError] = useState('');

  // Form state
  const [formName, setFormName] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formEvents, setFormEvents] = useState<string[]>(['test.run.completed']);
  const [formResultStatuses, setFormResultStatuses] = useState<string[]>([]);
  const [formEnabled, setFormEnabled] = useState(true);
  const [formRetryEnabled, setFormRetryEnabled] = useState(true);
  const [formMaxRetries, setFormMaxRetries] = useState(5);
  const [formSecret, setFormSecret] = useState('');
  // Feature #1304: Batch delivery settings
  const [formBatchEnabled, setFormBatchEnabled] = useState(false);
  const [formBatchSize, setFormBatchSize] = useState(10);
  const [formBatchInterval, setFormBatchInterval] = useState(60);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Feature #1303: Delivery history state
  // Feature #690: deliveryLogs and isLoadingHistory now come from React Query hook
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyWebhookId, setHistoryWebhookId] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'success' | 'failed'>('all');

  // Feature #1394: 12 essential webhook events for n8n/Zapier integration
  const availableEvents = [
    { value: 'test.run.started', label: 'Test Run Started' },
    { value: 'test.run.completed', label: 'Test Run Completed' },
    { value: 'test.run.failed', label: 'Test Run Failed' },
    { value: 'test.run.passed', label: 'Test Run Passed' },
    { value: 'test.created', label: 'Test Created' },
    { value: 'visual.diff.detected', label: 'Visual Diff Detected' },
    { value: 'baseline.approved', label: 'Baseline Approved' },
    { value: 'security.vulnerability.found', label: 'Security Vulnerability Found' },
    { value: 'flaky.test.detected', label: 'Flaky Test Detected' },
    { value: 'schedule.triggered', label: 'Schedule Triggered' },
    { value: 'performance.budget.exceeded', label: 'Performance Budget Exceeded' },
    { value: 'accessibility.issue.found', label: 'Accessibility Issue Found' },
  ];

  const availableStatuses = [
    { value: 'passed', label: 'Passed', color: 'bg-success/10 text-success' },
    { value: 'failed', label: 'Failed', color: 'bg-destructive/10 text-destructive' },
    { value: 'skipped', label: 'Skipped', color: 'bg-warning/10 text-warning' },
    { value: 'error', label: 'Error', color: 'bg-warning/10 text-warning' },
  ];

  // Feature #690: useEffect removed - React Query handles data fetching

  const resetForm = () => {
    setFormName('');
    setFormUrl('');
    setFormEvents(['test.run.completed']);
    setFormResultStatuses([]);
    setFormEnabled(true);
    setFormRetryEnabled(true);
    setFormMaxRetries(5);
    setFormSecret('');
    // Feature #1304: Reset batch settings
    setFormBatchEnabled(false);
    setFormBatchSize(10);
    setFormBatchInterval(60);
    setError('');
    setSelectedWebhook(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const handleOpenEdit = (webhook: WebhookSubscription) => {
    setSelectedWebhook(webhook);
    setFormName(webhook.name);
    setFormUrl(webhook.url);
    setFormEvents(webhook.events);
    setFormResultStatuses(webhook.result_statuses || []);
    setFormEnabled(webhook.enabled);
    setFormRetryEnabled(webhook.retry_enabled ?? true);
    setFormMaxRetries(webhook.max_retries ?? 5);
    setFormSecret('');
    // Feature #1304: Load batch settings
    setFormBatchEnabled(webhook.batch_enabled ?? false);
    setFormBatchSize(webhook.batch_size ?? 10);
    setFormBatchInterval(webhook.batch_interval_seconds ?? 60);
    setShowCreateModal(true);
  };

  // Feature #690: handleSubmit uses React Query mutations
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const payload = {
        name: formName,
        url: formUrl,
        events: formEvents,
        enabled: formEnabled,
        retry_enabled: formRetryEnabled,
        max_retries: formMaxRetries,
        // Feature #1304: Batch delivery settings
        batch_enabled: formBatchEnabled,
        batch_size: formBatchSize,
        batch_interval_seconds: formBatchInterval,
        ...(formResultStatuses.length > 0 ? { result_statuses: formResultStatuses } : {}),
        ...(formSecret ? { secret: formSecret } : {}),
      };

      if (selectedWebhook) {
        await updateMutation.mutateAsync({ webhookId: selectedWebhook.id, ...payload });
      } else {
        await createMutation.mutateAsync(payload);
      }

      setShowCreateModal(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save webhook');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Feature #690: handleDelete uses React Query mutation
  const handleDelete = async (webhookId: string) => {
    if (!confirm('Are you sure you want to delete this webhook? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(webhookId);
    } catch (err) {
      console.error('Failed to delete webhook:', err);
    }
  };

  // Feature #690: handleToggleEnabled uses React Query mutation
  const handleToggleEnabled = async (webhook: WebhookSubscription) => {
    try {
      await updateMutation.mutateAsync({ webhookId: webhook.id, enabled: !webhook.enabled });
    } catch (err) {
      console.error('Failed to toggle webhook:', err);
    }
  };

  // Feature #1303: View delivery history for a webhook
  // Feature #690: Uses React Query hook - data is fetched by the hook when historyWebhookId is set
  const handleViewHistory = (webhookId: string) => {
    setHistoryWebhookId(webhookId);
    setShowHistoryModal(true);
    setHistoryFilter('all');
  };

  // Feature #690: React Query hook for webhook logs - only fetches when modal is open
  const { data: deliveryLogs = [], isLoading: isLoadingHistory } = useWebhookLogs(
    showHistoryModal ? (historyWebhookId || '') : ''
  );

  const filteredLogs = deliveryLogs.filter(log => {
    if (historyFilter === 'all') return true;
    if (historyFilter === 'success') return log.success;
    if (historyFilter === 'failed') return !log.success;
    return true;
  });

  const toggleEvent = (event: string) => {
    if (formEvents.includes(event)) {
      setFormEvents(formEvents.filter(e => e !== event));
    } else {
      setFormEvents([...formEvents, event]);
    }
  };

  const toggleStatus = (status: string) => {
    if (formResultStatuses.includes(status)) {
      setFormResultStatuses(formResultStatuses.filter(s => s !== status));
    } else {
      setFormResultStatuses([...formResultStatuses, status]);
    }
  };

  const getStatusIndicator = (webhook: WebhookSubscription) => {
    if (!webhook.enabled) {
      return { color: 'bg-muted-foreground', label: 'Disabled' };
    }
    if (webhook.failure_count > webhook.success_count && webhook.failure_count > 0) {
      return { color: 'bg-destructive', label: 'Failing' };
    }
    if (webhook.success_count > 0) {
      return { color: 'bg-success', label: 'Healthy' };
    }
    return { color: 'bg-warning', label: 'Pending' };
  };

  return (
    <Layout>
      <div className="p-8">
        <PageHeader
          title="Webhooks"
          description="Configure webhook notifications for test events"
          breadcrumbs={[
            { label: 'Home', href: '/' },
            { label: 'Settings', href: '/settings' },
            { label: 'Webhooks' }
          ]}
          actions={
            <div className="flex items-center gap-3">
              <Link
                to="/webhooks/integration-guides"
                className="rounded-md border border-border px-4 py-2 font-medium text-foreground hover:bg-muted"
              >
                Integration Guides
              </Link>
              <Button
                onClick={handleOpenCreate}
              >
                Create Webhook
              </Button>
            </div>
          }
        />

        {/* Webhooks List */}
        <div className="mt-8">
          {isLoading ? (
            <p className="text-muted-foreground">Loading webhooks...</p>
          ) : webhooks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
              <h3 className="text-lg font-semibold text-foreground">No webhooks configured</h3>
              <p className="mt-2 text-muted-foreground">
                Create a webhook to receive notifications when test events occur.
              </p>
              <Button
                onClick={handleOpenCreate}
                className="mt-4"
              >
                Create Webhook
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {webhooks.map(webhook => {
                const status = getStatusIndicator(webhook);
                return (
                  <div key={webhook.id} className="rounded-lg border border-border bg-card p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`h-3 w-3 rounded-full ${status.color}`} title={status.label} />
                        <div>
                          <h3 className="text-lg font-semibold text-foreground">{webhook.name}</h3>
                          <p className="text-sm text-muted-foreground font-mono truncate max-w-md">{webhook.url}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleEnabled(webhook)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            webhook.enabled ? 'bg-primary' : 'bg-muted'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-card transition-transform ${
                              webhook.enabled ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                        <Button
                          onClick={() => handleViewHistory(webhook.id)}
                          variant="ghost"
                          size="sm"
                        >
                          History
                        </Button>
                        <Button
                          onClick={() => handleOpenEdit(webhook)}
                          variant="ghost"
                          size="sm"
                        >
                          Edit
                        </Button>
                        <Button
                          onClick={() => handleDelete(webhook.id)}
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {webhook.events.map(event => (
                        <span key={event} className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                          {event}
                        </span>
                      ))}
                    </div>

                    {webhook.result_statuses && webhook.result_statuses.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="text-xs text-muted-foreground">Status filters:</span>
                        {webhook.result_statuses.map(status => {
                          const statusConfig = availableStatuses.find(s => s.value === status);
                          return (
                            <span key={status} className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusConfig?.color || 'bg-muted'}`}>
                              {statusConfig?.label || status}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Feature #1304: Show batch delivery status */}
                    {webhook.batch_enabled && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
                          Batched
                        </span>
                        <span className="text-xs text-muted-foreground">
                          (max {webhook.batch_size || 10} events every {webhook.batch_interval_seconds || 60}s)
                        </span>
                      </div>
                    )}

                    <div className="mt-4 flex items-center gap-6 text-sm text-muted-foreground">
                      <span>
                        <span className="text-success font-medium">{webhook.success_count}</span> successful
                      </span>
                      <span>
                        <span className="text-destructive font-medium">{webhook.failure_count}</span> failed
                      </span>
                      {webhook.last_triggered_at && (
                        <span>Last triggered: {formatDate(webhook.last_triggered_at)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Create/Edit Modal */}
        <Modal
          isOpen={showCreateModal}
          onClose={() => { setShowCreateModal(false); resetForm(); }}
          title={selectedWebhook ? 'Edit Webhook' : 'Create Webhook'}
          size="lg"
        >
          <form id="webhook-form" onSubmit={handleSubmit}>
            <ModalBody className="max-h-[60vh] overflow-y-auto">

              {error && (
                <div className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 p-3">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Name</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="My Webhook"
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">URL</label>
                  <input
                    type="url"
                    value={formUrl}
                    onChange={(e) => setFormUrl(e.target.value)}
                    placeholder="https://your-server.com/webhook"
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Secret (optional)</label>
                  <input
                    type="password"
                    value={formSecret}
                    onChange={(e) => setFormSecret(e.target.value)}
                    placeholder={selectedWebhook ? 'Leave blank to keep existing' : 'For HMAC signature verification'}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Used to generate X-QA-Guardian-Signature header for verification
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Events</label>
                  <div className="grid grid-cols-2 gap-2">
                    {availableEvents.map(event => (
                      <label key={event.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formEvents.includes(event.value)}
                          onChange={() => toggleEvent(event.value)}
                          className="rounded border-border"
                        />
                        <span className="text-sm text-foreground">{event.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Result Status Filter (optional)
                  </label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Only trigger for tests with these statuses. Leave empty for all statuses.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {availableStatuses.map(status => (
                      <label key={status.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formResultStatuses.includes(status.value)}
                          onChange={() => toggleStatus(status.value)}
                          className="rounded border-border"
                        />
                        <span className={`text-sm px-2 py-0.5 rounded ${status.color}`}>{status.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formEnabled}
                      onChange={(e) => setFormEnabled(e.target.checked)}
                      className="rounded border-border"
                    />
                    <span className="text-sm text-foreground">Enabled</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formRetryEnabled}
                      onChange={(e) => setFormRetryEnabled(e.target.checked)}
                      className="rounded border-border"
                    />
                    <span className="text-sm text-foreground">Retry on failure</span>
                  </label>
                </div>

                {formRetryEnabled && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Max Retries</label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={formMaxRetries}
                      onChange={(e) => setFormMaxRetries(parseInt(e.target.value) || 5)}
                      className="w-24 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                    />
                  </div>
                )}

                {/* Feature #1304: Batch Delivery Settings */}
                <div className="border-t border-border pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formBatchEnabled}
                        onChange={(e) => setFormBatchEnabled(e.target.checked)}
                        className="rounded border-border"
                      />
                      <span className="text-sm font-medium text-foreground">Enable Batch Delivery</span>
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Batch delivery groups multiple events together before sending, reducing the number of webhook calls.
                  </p>

                  {formBatchEnabled && (
                    <div className="grid grid-cols-2 gap-4 pl-6">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Batch Size</label>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={formBatchSize}
                          onChange={(e) => setFormBatchSize(parseInt(e.target.value) || 10)}
                          className="w-24 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Max events per batch (1-100)</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Batch Interval</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={5}
                            max={3600}
                            value={formBatchInterval}
                            onChange={(e) => setFormBatchInterval(parseInt(e.target.value) || 60)}
                            className="w-24 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                          />
                          <span className="text-sm text-muted-foreground">seconds</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Time to wait before sending (5-3600)</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button
                type="button"
                onClick={() => { setShowCreateModal(false); resetForm(); }}
                variant="ghost"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || formEvents.length === 0}
              >
                {isSubmitting ? 'Saving...' : (selectedWebhook ? 'Update' : 'Create')}
              </Button>
            </ModalFooter>
          </form>
        </Modal>

        {/* Feature #1303: Delivery History Modal */}
        <Modal
          isOpen={showHistoryModal}
          onClose={() => setShowHistoryModal(false)}
          title={historyWebhookId ? `Delivery History (${webhooks.find(w => w.id === historyWebhookId)?.name || ''})` : 'Delivery History'}
          size="full"
        >
          <ModalBody className="max-h-[70vh] overflow-hidden flex flex-col">

              {/* Filter tabs */}
              <div className="flex gap-2 mb-4">
                {(['all', 'success', 'failed'] as const).map(filter => (
                  <Button
                    key={filter}
                    onClick={() => setHistoryFilter(filter)}
                    variant={historyFilter === filter ? 'default' : 'secondary'}
                    size="sm"
                  >
                    {filter === 'all' ? 'All' : filter === 'success' ? 'Successful' : 'Failed'}
                    <span className="ml-1.5 text-xs">
                      ({filter === 'all'
                        ? deliveryLogs.length
                        : filter === 'success'
                          ? deliveryLogs.filter(l => l.success).length
                          : deliveryLogs.filter(l => !l.success).length
                      })
                    </span>
                  </Button>
                ))}
              </div>

              {/* History list */}
              <div className="flex-1 overflow-y-auto">
                {isLoadingHistory ? (
                  <p className="text-center text-muted-foreground py-8">Loading delivery history...</p>
                ) : filteredLogs.length === 0 ? (
                  /* Feature #728: EmptyState adoption */
                  <EmptyState
                    icon={EmptyStateIcons.history}
                    title={deliveryLogs.length === 0 ? 'No delivery history yet' : 'No deliveries match the filter'}
                    description={deliveryLogs.length === 0 ? 'Webhook deliveries will appear here once events are triggered.' : 'Try changing the filter to see other deliveries.'}
                    size="sm"
                  />
                ) : (
                  <div className="space-y-3">
                    {filteredLogs.map(log => (
                      <div
                        key={log.id}
                        className={`rounded-lg border p-4 ${
                          log.success ? 'border-success/20 bg-success/5/50' : 'border-destructive/20 bg-destructive/5/50'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm ${
                              log.success ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                            }`}>
                              {log.success ? '✓' : '✗'}
                            </span>
                            <div>
                              <p className="font-medium text-foreground">{log.event}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(log.timestamp)} • {log.duration_ms}ms
                                {log.max_attempts > 1 && ` • Attempt ${log.attempt}/${log.max_attempts}`}
                              </p>
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                            log.success ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                          }`}>
                            {log.responseStatus ? `HTTP ${log.responseStatus}` : 'Error'}
                          </span>
                        </div>
                        {log.error && (
                          <p className="mt-2 text-sm text-destructive bg-destructive/10/50 px-3 py-2 rounded">
                            {log.error}
                          </p>
                        )}
                        {log.responseBody && (
                          <details className="mt-2">
                            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                              View response body
                            </summary>
                            <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-x-auto max-h-32">
                              {log.responseBody}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
          </ModalBody>
        </Modal>
      </div>
    </Layout>
  );
}
