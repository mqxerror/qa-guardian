// WebhooksTab - Webhook CRUD
// Feature #451: Extracted from SettingsPage.tsx
// Feature #658: Migrated hand-rolled modal to shared Modal component

import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useTimezoneStore } from '../../stores/timezoneStore';
import { toast } from '../../stores/toastStore';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../ui/Modal';
import { type Webhook } from '../../hooks/api/useSettings';

export function WebhooksTab() {
  const { user, token } = useAuthStore();
  const { formatDate } = useTimezoneStore();
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newEvents, setNewEvents] = useState<string[]>(['test.completed']);
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const availableEvents = [
    'test.completed',
    'test.failed',
    'run.started',
    'run.completed',
    'suite.created',
    'suite.deleted',
    'visual.diff_detected',
    'security.vulnerability_found',
  ];

  useEffect(() => {
    const fetchWebhooks = async () => {
      try {
        const response = await fetch(`/api/v1/organizations/${user?.organization_id}/webhooks`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setWebhooks(data.webhooks || []);
        }
      } catch (err) {
        console.error('Failed to fetch webhooks:', err);
      } finally {
        setIsLoading(false);
      }
    };
    if (user?.organization_id) {
      fetchWebhooks();
    }
  }, [token, user?.organization_id]);

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setIsCreating(true);

    try {
      const response = await fetch(`/api/v1/organizations/${user?.organization_id}/webhooks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ url: newUrl, events: newEvents }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to create webhook');
      }

      const data = await response.json();
      setWebhooks(prev => [...prev, data.webhook]);
      setShowCreateModal(false);
      setNewUrl('');
      toast.success('Webhook created');
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create webhook');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteWebhook = async (webhookId: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return;

    try {
      const response = await fetch(`/api/v1/organizations/${user?.organization_id}/webhooks/${webhookId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        setWebhooks(webhooks.filter(w => w.id !== webhookId));
        toast.success('Webhook deleted');
      } else {
        toast.error('Failed to delete webhook');
      }
    } catch (err) {
      toast.error('Failed to delete webhook');
    }
  };

  const toggleWebhook = async (webhook: Webhook) => {
    try {
      const response = await fetch(`/api/v1/organizations/${user?.organization_id}/webhooks/${webhook.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ active: !webhook.active }),
      });

      if (response.ok) {
        setWebhooks(webhooks.map(w =>
          w.id === webhook.id ? { ...w, active: !w.active } : w
        ));
        toast.success(`Webhook ${webhook.active ? 'disabled' : 'enabled'}`);
      }
    } catch (err) {
      toast.error('Failed to update webhook');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Webhooks</h3>
          <p className="text-sm text-muted-foreground">Receive notifications when events happen in your organization.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Add Webhook
        </button>
      </div>

      {/* Webhooks List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="bg-card rounded-lg border border-border p-8 text-center text-muted-foreground">
            Loading webhooks...
          </div>
        ) : webhooks.length === 0 ? (
          <div className="bg-card rounded-lg border border-border p-8 text-center text-muted-foreground">
            No webhooks configured yet
          </div>
        ) : (
          webhooks.map(webhook => (
            <div key={webhook.id} className="bg-card rounded-lg border border-border p-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`w-2 h-2 rounded-full ${webhook.active ? 'bg-success' : 'bg-muted-foreground'}`}></span>
                    <code className="text-sm text-foreground font-mono">{webhook.url}</code>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {webhook.events.map(event => (
                      <span key={event} className="px-2 py-0.5 bg-muted rounded text-xs text-muted-foreground">
                        {event}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Created {formatDate(webhook.created_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleWebhook(webhook)}
                    className="text-sm text-primary hover:underline"
                  >
                    {webhook.active ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => handleDeleteWebhook(webhook.id)}
                    className="text-sm text-destructive hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Feature #658: Create Modal - migrated to shared Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Add Webhook" size="md">
        <form onSubmit={handleCreateWebhook}>
          <ModalHeader onClose={() => setShowCreateModal(false)}>Add Webhook</ModalHeader>
          <ModalBody className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Webhook URL</label>
              <input
                type="url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://your-server.com/webhook"
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Events</label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {availableEvents.map(event => (
                  <label key={event} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newEvents.includes(event)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewEvents([...newEvents, event]);
                        } else {
                          setNewEvents(newEvents.filter(ev => ev !== event));
                        }
                      }}
                      className="rounded border-border"
                    />
                    <span className="text-sm text-foreground">{event}</span>
                  </label>
                ))}
              </div>
            </div>
            {createError && <p className="text-sm text-destructive">{createError}</p>}
          </ModalBody>
          <ModalFooter>
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || newEvents.length === 0}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              {isCreating ? 'Creating...' : 'Create Webhook'}
            </button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
}
