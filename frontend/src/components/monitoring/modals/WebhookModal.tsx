/**
 * WebhookModal Component
 * Feature #47: Extracted from MonitoringPage.tsx for modularity
 * Feature #127: Mobile responsive design audit and fixes
 *
 * Handles creating webhook monitoring checks
 */

import { useState, useEffect } from 'react';
import { WebhookCheck } from '../types';
import { toast } from '../../../stores/toastStore';

export interface WebhookModalProps {
  isOpen: boolean;
  token: string;
  onClose: () => void;
  onWebhookCreated: (webhook: WebhookCheck) => void;
}

export default function WebhookModal({
  isOpen,
  token,
  onClose,
  onWebhookCreated,
}: WebhookModalProps) {
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [interval, setInterval] = useState(300);
  const [payloadType, setPayloadType] = useState<'any' | 'key-value'>('any');
  const [requiredFields, setRequiredFields] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setInterval(300);
    setPayloadType('any');
    setRequiredFields('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/v1/monitoring/webhooks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          description: description || undefined,
          expected_interval: interval,
          expected_payload: payloadType === 'any' ? { type: 'any' } : {
            type: 'key-value',
            required_fields: requiredFields.split(',').map(f => f.trim()).filter(Boolean),
          },
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Webhook check created successfully');
        onWebhookCreated(data.check);
        onClose();
      } else {
        toast.error(data.error || 'Failed to create webhook check');
      }
    } catch (error) {
      console.error('Error creating webhook check:', error);
      toast.error('Failed to create webhook check');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-webhook-title"
        className="w-full max-w-md rounded-lg bg-card p-4 sm:p-6 shadow-xl max-h-[90vh] overflow-y-auto"
      >
        <h2 id="create-webhook-title" className="text-lg font-semibold text-foreground mb-4">Create Webhook Check</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="My Webhook Monitor"
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Monitor incoming webhooks from service X"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Expected Interval (seconds)</label>
            <select
              value={interval}
              onChange={e => setInterval(parseInt(e.target.value))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
            >
              <option value={60}>1 min</option>
              <option value={300}>5 min</option>
              <option value={900}>15 min</option>
              <option value={3600}>1 hour</option>
              <option value={86400}>24 hours</option>
            </select>
            <p className="text-xs text-muted-foreground mt-1">Alert if no webhook received within this interval</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Payload Validation</label>
            <select
              value={payloadType}
              onChange={e => setPayloadType(e.target.value as 'any' | 'key-value')}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
            >
              <option value="any">Accept Any Payload</option>
              <option value="key-value">Require Specific Fields</option>
            </select>
          </div>
          {payloadType === 'key-value' && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Required Fields</label>
              <input
                type="text"
                value={requiredFields}
                onChange={e => setRequiredFields(e.target.value)}
                placeholder="e.g., event_type, user_id, timestamp"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
              />
              <p className="text-xs text-muted-foreground mt-1">Comma-separated list of required JSON fields</p>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Webhook'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
