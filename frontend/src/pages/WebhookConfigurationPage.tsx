// WebhookConfigurationPage extracted from App.tsx for code quality compliance (Feature #1357)
// Note: This file is 723 lines - will need further splitting in future sessions
import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { useAuthStore } from '../stores/authStore';
import { useTimezoneStore } from '../stores/timezoneStore';

interface WebhookSubscription {
  id: string;
  name: string;
  url: string;
  events: string[];
  result_statuses?: string[];
  enabled: boolean;
  retry_enabled?: boolean;
  max_retries?: number;
  success_count: number;
  failure_count: number;
  last_triggered_at?: string;
  batch_enabled?: boolean;
  batch_size?: number;
  batch_interval_seconds?: number;
}

interface WebhookDeliveryLog {
  id: string;
  webhook_id: string;
  event: string;
  success: boolean;
  timestamp: string;
  duration_ms: number;
  attempt: number;
  max_attempts: number;
  responseStatus?: number;
  responseBody?: string;
  error?: string;
}

export function WebhookConfigurationPage() {
  const { token } = useAuthStore();
  const { formatDate } = useTimezoneStore();
  const [webhooks, setWebhooks] = useState<WebhookSubscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyWebhookId, setHistoryWebhookId] = useState<string | null>(null);
  const [deliveryLogs, setDeliveryLogs] = useState<WebhookDeliveryLog[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
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
    { value: 'passed', label: 'Passed', color: 'bg-green-100 text-green-700' },
    { value: 'failed', label: 'Failed', color: 'bg-red-100 text-red-700' },
    { value: 'skipped', label: 'Skipped', color: 'bg-yellow-100 text-yellow-700' },
    { value: 'error', label: 'Error', color: 'bg-orange-100 text-orange-700' },
  ];

  // Fetch webhooks
  useEffect(() => {
    const fetchWebhooks = async () => {
      try {
        const response = await fetch('/api/v1/webhook-subscriptions', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setWebhooks(data.subscriptions || []);
        }
      } catch (err) {
        console.error('Failed to fetch webhooks:', err);
        setError('Failed to load webhooks');
      } finally {
        setIsLoading(false);
      }
    };
    fetchWebhooks();
  }, [token]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const payload: Record<string, unknown> = {
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
      };

      if (formResultStatuses.length > 0) {
        payload.result_statuses = formResultStatuses;
      }
      if (formSecret) {
        payload.secret = formSecret;
      }

      const url = selectedWebhook
        ? `/api/v1/webhook-subscriptions/${selectedWebhook.id}`
        : '/api/v1/webhook-subscriptions';

      const response = await fetch(url, {
        method: selectedWebhook ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to save webhook');
      }

      const data = await response.json();

      if (selectedWebhook) {
        setWebhooks(webhooks.map(w => w.id === selectedWebhook.id ? { ...w, ...data } : w));
      } else {
        setWebhooks([...webhooks, data]);
      }

      setShowCreateModal(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save webhook');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (webhookId: string) => {
    if (!confirm('Are you sure you want to delete this webhook? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/webhook-subscriptions/${webhookId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        setWebhooks(webhooks.filter(w => w.id !== webhookId));
      }
    } catch (err) {
      console.error('Failed to delete webhook:', err);
    }
  };

  const handleToggleEnabled = async (webhook: WebhookSubscription) => {
    try {
      const response = await fetch(`/api/v1/webhook-subscriptions/${webhook.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ enabled: !webhook.enabled }),
      });

      if (response.ok) {
        setWebhooks(webhooks.map(w => w.id === webhook.id ? { ...w, enabled: !webhook.enabled } : w));
      }
    } catch (err) {
      console.error('Failed to toggle webhook:', err);
    }
  };

  // Feature #1303: Fetch delivery history for a webhook
  const handleViewHistory = async (webhookId: string) => {
    setHistoryWebhookId(webhookId);
    setShowHistoryModal(true);
    setIsLoadingHistory(true);
    setHistoryFilter('all');

    try {
      const response = await fetch(`/api/v1/webhook-subscriptions/${webhookId}/logs?limit=50`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setDeliveryLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to fetch delivery history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

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
      return { color: 'bg-gray-400', label: 'Disabled' };
    }
    if (webhook.failure_count > webhook.success_count && webhook.failure_count > 0) {
      return { color: 'bg-red-500', label: 'Failing' };
    }
    if (webhook.success_count > 0) {
      return { color: 'bg-green-500', label: 'Healthy' };
    }
    return { color: 'bg-yellow-500', label: 'Pending' };
  };

  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Webhooks</h1>
            <p className="mt-2 text-muted-foreground">
              Configure webhook notifications for test events
            </p>
          </div>
          <button
            onClick={handleOpenCreate}
            className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90"
          >
            Create Webhook
          </button>
        </div>

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
              <button
                onClick={handleOpenCreate}
                className="mt-4 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90"
              >
                Create Webhook
              </button>
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
                            webhook.enabled ? 'bg-primary' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              webhook.enabled ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                        <button
                          onClick={() => handleViewHistory(webhook.id)}
                          className="rounded-md px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
                        >
                          History
                        </button>
                        <button
                          onClick={() => handleOpenEdit(webhook)}
                          className="rounded-md px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(webhook.id)}
                          className="rounded-md px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10"
                        >
                          Delete
                        </button>
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
                            <span key={status} className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusConfig?.color || 'bg-gray-100'}`}>
                              {statusConfig?.label || status}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Feature #1304: Show batch delivery status */}
                    {webhook.batch_enabled && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-xs font-medium">
                          Batched
                        </span>
                        <span className="text-xs text-muted-foreground">
                          (max {webhook.batch_size || 10} events every {webhook.batch_interval_seconds || 60}s)
                        </span>
                      </div>
                    )}

                    <div className="mt-4 flex items-center gap-6 text-sm text-muted-foreground">
                      <span>
                        <span className="text-green-600 font-medium">{webhook.success_count}</span> successful
                      </span>
                      <span>
                        <span className="text-red-600 font-medium">{webhook.failure_count}</span> failed
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
        {showCreateModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={(e) => e.target === e.currentTarget && setShowCreateModal(false)}
          >
            <div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-lg bg-card p-6 shadow-lg max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-foreground mb-4">
                {selectedWebhook ? 'Edit Webhook' : 'Create Webhook'}
              </h3>

              {error && (
                <div className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 p-3">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
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
                          className="rounded border-gray-300"
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
                          className="rounded border-gray-300"
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
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-foreground">Enabled</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formRetryEnabled}
                      onChange={(e) => setFormRetryEnabled(e.target.checked)}
                      className="rounded border-gray-300"
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
                        className="rounded border-gray-300"
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

                <div className="flex justify-end gap-3 pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={() => { setShowCreateModal(false); resetForm(); }}
                    className="rounded-md px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || formEvents.length === 0}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Saving...' : (selectedWebhook ? 'Update' : 'Create')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Feature #1303: Delivery History Modal */}
        {showHistoryModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={(e) => e.target === e.currentTarget && setShowHistoryModal(false)}
          >
            <div role="dialog" aria-modal="true" className="w-full max-w-4xl rounded-lg bg-card p-6 shadow-lg max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">
                  Delivery History
                  {historyWebhookId && (
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      ({webhooks.find(w => w.id === historyWebhookId)?.name})
                    </span>
                  )}
                </h3>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Filter tabs */}
              <div className="flex gap-2 mb-4">
                {(['all', 'success', 'failed'] as const).map(filter => (
                  <button
                    key={filter}
                    onClick={() => setHistoryFilter(filter)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md ${
                      historyFilter === filter
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
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
                  </button>
                ))}
              </div>

              {/* History list */}
              <div className="flex-1 overflow-y-auto">
                {isLoadingHistory ? (
                  <p className="text-center text-muted-foreground py-8">Loading delivery history...</p>
                ) : filteredLogs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    {deliveryLogs.length === 0 ? 'No delivery history yet' : 'No deliveries match the filter'}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {filteredLogs.map(log => (
                      <div
                        key={log.id}
                        className={`rounded-lg border p-4 ${
                          log.success ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm ${
                              log.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
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
                            log.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {log.responseStatus ? `HTTP ${log.responseStatus}` : 'Error'}
                          </span>
                        </div>
                        {log.error && (
                          <p className="mt-2 text-sm text-red-600 bg-red-100/50 px-3 py-2 rounded">
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
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
