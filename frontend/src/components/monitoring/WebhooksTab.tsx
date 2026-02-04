/**
 * WebhooksTab Component
 * Feature #47: Extracted from MonitoringPage.tsx for modularity
 *
 * Handles webhook monitoring display - incoming webhook validation
 */

import { WebhookCheck, WebhookEvent } from './types';
import { toast } from '../../stores/toastStore';

export interface WebhooksTabProps {
  // Data
  webhookChecks: WebhookCheck[];
  selectedWebhook: WebhookCheck | null;
  webhookEvents: WebhookEvent[];
  // Loading states
  isLoading: boolean;
  // Actions
  setSelectedWebhook: (check: WebhookCheck | null) => void;
  setShowWebhookModal: (show: boolean) => void;
  fetchWebhookEvents: (checkId: string) => Promise<void>;
  sendTestWebhook: (checkId: string) => Promise<void>;
  deleteWebhookCheck: (checkId: string) => Promise<void>;
}

export function WebhooksTab({
  webhookChecks,
  selectedWebhook,
  webhookEvents,
  isLoading,
  setSelectedWebhook,
  setShowWebhookModal,
  fetchWebhookEvents,
  sendTestWebhook,
  deleteWebhookCheck,
}: WebhooksTabProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (webhookChecks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-12 text-center">
        <div className="text-4xl mb-4">🔗</div>
        <h3 className="text-lg font-medium text-foreground">No webhook checks yet</h3>
        <p className="mt-2 text-muted-foreground">Monitor incoming webhooks with payload validation.</p>
        <button
          onClick={() => setShowWebhookModal(true)}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Create Webhook Check
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Webhook Checks List */}
      <div className="lg:col-span-2">
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Last Received</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Events (24h)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {webhookChecks.map(check => (
                <tr
                  key={check.id}
                  className={`hover:bg-muted/30 cursor-pointer ${selectedWebhook?.id === check.id ? 'bg-primary/5' : ''}`}
                  onClick={() => {
                    setSelectedWebhook(check);
                    fetchWebhookEvents(check.id);
                  }}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{check.name}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[200px]">{check.description || 'No description'}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {check.last_received ? new Date(check.last_received).toLocaleTimeString() : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium">{check.events_24h || 0}</span>
                  </td>
                  <td className="px-4 py-3">
                    {check.last_payload_valid === true && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">✅ Valid</span>
                    )}
                    {check.last_payload_valid === false && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">❌ Invalid</span>
                    )}
                    {check.last_payload_valid === null && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">⚪ Waiting</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => sendTestWebhook(check.id)}
                        title="Send test webhook"
                        className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        🧪
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(window.location.origin + check.webhook_url);
                          toast.success('Webhook URL copied to clipboard');
                        }}
                        title="Copy URL"
                        className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        📋
                      </button>
                      <button
                        onClick={() => deleteWebhookCheck(check.id)}
                        title="Delete"
                        className="rounded p-1.5 text-muted-foreground hover:bg-red-100 hover:text-red-600"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Webhook Details Panel */}
      <div className="lg:col-span-1">
        {selectedWebhook ? (
          <div className="rounded-lg border border-border bg-card p-4 space-y-4">
            <div>
              <h3 className="font-semibold text-foreground">{selectedWebhook.name}</h3>
              <p className="text-xs text-muted-foreground">{selectedWebhook.description || 'No description'}</p>
            </div>

            <div className="space-y-2">
              <div>
                <span className="text-xs text-muted-foreground">Webhook URL:</span>
                <div className="mt-1 p-2 bg-muted rounded text-xs font-mono break-all">
                  {window.location.origin}{selectedWebhook.webhook_url}
                </div>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Expected Interval:</span>
                <span className="ml-2 text-sm">{selectedWebhook.expected_interval}s</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Payload Validation:</span>
                <span className="ml-2 text-sm capitalize">{selectedWebhook.expected_payload?.type || 'any'}</span>
              </div>
              {selectedWebhook.expected_payload?.required_fields && (
                <div>
                  <span className="text-xs text-muted-foreground">Required Fields:</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {selectedWebhook.expected_payload.required_fields.map((f, i) => (
                      <span key={i} className="px-2 py-0.5 bg-muted rounded text-xs">{f}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <h4 className="font-medium text-sm mb-2">Recent Events</h4>
              {webhookEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events received yet</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {webhookEvents.slice(0, 10).map(event => (
                    <div key={event.id} className="p-2 border border-border rounded text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-muted-foreground">{new Date(event.received_at).toLocaleString()}</span>
                        {event.payload_valid ? (
                          <span className="text-green-600">✅</span>
                        ) : (
                          <span className="text-red-600">❌</span>
                        )}
                      </div>
                      {event.validation_errors && (
                        <div className="text-red-500 text-xs">{event.validation_errors.join(', ')}</div>
                      )}
                      <div className="text-muted-foreground">From: {event.source_ip}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
            Select a webhook check to view details
          </div>
        )}
      </div>
    </div>
  );
}
