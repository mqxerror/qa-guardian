/**
 * useWebhookHandlers Hook
 * Feature #47: Extracted from MonitoringPage.tsx for modularity
 *
 * Handles all webhook monitoring state and operations
 */

import { useState, useCallback } from 'react';
import { toast } from '../../../stores/toastStore';
import type { WebhookCheck, WebhookEvent } from '../types';

export interface UseWebhookHandlersReturn {
  // State
  webhookChecks: WebhookCheck[];
  selectedWebhook: WebhookCheck | null;
  webhookEvents: WebhookEvent[];
  showWebhookModal: boolean;

  // Setters
  setSelectedWebhook: (webhook: WebhookCheck | null) => void;
  setShowWebhookModal: (show: boolean) => void;
  setWebhookChecks: React.Dispatch<React.SetStateAction<WebhookCheck[]>>;

  // Actions
  fetchWebhookChecks: () => Promise<void>;
  fetchWebhookEvents: (checkId: string) => Promise<void>;
  sendTestWebhook: (checkId: string, payload?: unknown) => Promise<void>;
  deleteWebhookCheck: (checkId: string) => Promise<void>;
}

export function useWebhookHandlers(token: string | null): UseWebhookHandlersReturn {
  const [webhookChecks, setWebhookChecks] = useState<WebhookCheck[]>([]);
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookCheck | null>(null);
  const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>([]);

  // Fetch webhook checks
  const fetchWebhookChecks = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch('/api/v1/monitoring/webhooks', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setWebhookChecks(data.checks || []);
      }
    } catch (error) {
      console.error('Failed to fetch webhook checks:', error);
    }
  }, [token]);

  // Fetch webhook events
  const fetchWebhookEvents = useCallback(async (checkId: string) => {
    if (!token) return;
    try {
      const response = await fetch(`/api/v1/monitoring/webhooks/${checkId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setWebhookEvents(data.events || []);
      }
    } catch (error) {
      console.error('Failed to fetch webhook events:', error);
    }
  }, [token]);

  // Send test webhook
  const sendTestWebhook = useCallback(async (checkId: string, payload?: unknown) => {
    if (!token) return;
    try {
      const response = await fetch(`/api/v1/monitoring/webhooks/${checkId}/test`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ payload }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.payload_valid) {
          toast.success('Test webhook sent - payload valid');
        } else {
          toast.error(`Test webhook sent - validation failed: ${data.validation_errors?.join(', ')}`);
        }
        fetchWebhookChecks();
        if (selectedWebhook?.id === checkId) {
          fetchWebhookEvents(checkId);
        }
      }
    } catch (error) {
      toast.error('Failed to send test webhook');
    }
  }, [token, selectedWebhook, fetchWebhookChecks, fetchWebhookEvents]);

  // Delete webhook check
  const deleteWebhookCheck = useCallback(async (checkId: string) => {
    if (!token) return;
    if (!confirm('Are you sure you want to delete this webhook check?')) return;
    try {
      const response = await fetch(`/api/v1/monitoring/webhooks/${checkId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        toast.success('Webhook check deleted');
        if (selectedWebhook?.id === checkId) {
          setSelectedWebhook(null);
        }
        fetchWebhookChecks();
      }
    } catch (error) {
      toast.error('Failed to delete webhook check');
    }
  }, [token, selectedWebhook, fetchWebhookChecks]);

  return {
    // State
    webhookChecks,
    selectedWebhook,
    webhookEvents,
    showWebhookModal,

    // Setters
    setSelectedWebhook,
    setShowWebhookModal,
    setWebhookChecks,

    // Actions
    fetchWebhookChecks,
    fetchWebhookEvents,
    sendTestWebhook,
    deleteWebhookCheck,
  };
}

export default useWebhookHandlers;
