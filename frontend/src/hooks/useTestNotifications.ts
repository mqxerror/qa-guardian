/**
 * useTestNotifications Hook
 * Feature #581: Browser notifications for long-running test completion
 *
 * Shows browser notifications when tests taking > 30 seconds complete,
 * allowing users to switch tabs while waiting.
 */

import { useState, useEffect, useCallback } from 'react';

// Storage key for notification preference
const NOTIFICATIONS_ENABLED_KEY = 'qa-guardian-notifications-enabled';
// Minimum duration to trigger notification (30 seconds)
const MIN_DURATION_MS = 30000;

export interface TestNotificationData {
  testName: string;
  status: 'passed' | 'failed' | 'error' | string;
  durationMs: number;
  runId?: string;
}

export interface UseTestNotificationsReturn {
  /** Whether notifications are enabled by user */
  notificationsEnabled: boolean;
  /** Whether browser supports notifications */
  notificationsSupported: boolean;
  /** Current permission state */
  permission: NotificationPermission | 'unsupported';
  /** Toggle notifications on/off */
  toggleNotifications: () => Promise<void>;
  /** Request notification permission */
  requestPermission: () => Promise<boolean>;
  /** Show a notification for test completion */
  notifyTestComplete: (data: TestNotificationData) => void;
}

export function useTestNotifications(): UseTestNotificationsReturn {
  const notificationsSupported = typeof Notification !== 'undefined';
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
      return stored === 'true';
    } catch {
      return false;
    }
  });
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    notificationsSupported ? Notification.permission : 'unsupported'
  );

  // Update permission state when it changes
  useEffect(() => {
    if (!notificationsSupported) return;

    // Check permission periodically (it can change via browser settings)
    const checkPermission = () => {
      setPermission(Notification.permission);
    };

    // Initial check
    checkPermission();

    // Re-check on visibility change (user might have changed browser settings)
    document.addEventListener('visibilitychange', checkPermission);
    return () => document.removeEventListener('visibilitychange', checkPermission);
  }, [notificationsSupported]);

  // Request notification permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!notificationsSupported) return false;

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    } catch {
      return false;
    }
  }, [notificationsSupported]);

  // Toggle notifications on/off
  const toggleNotifications = useCallback(async (): Promise<void> => {
    if (!notificationsEnabled) {
      // Turning on - request permission if needed
      if (permission !== 'granted') {
        const granted = await requestPermission();
        if (!granted) return;
      }
      setNotificationsEnabled(true);
      try {
        localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, 'true');
      } catch {
        // Ignore storage errors
      }
    } else {
      // Turning off
      setNotificationsEnabled(false);
      try {
        localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, 'false');
      } catch {
        // Ignore storage errors
      }
    }
  }, [notificationsEnabled, permission, requestPermission]);

  // Show a notification for test completion
  const notifyTestComplete = useCallback((data: TestNotificationData): void => {
    if (!notificationsSupported || !notificationsEnabled || permission !== 'granted') {
      return;
    }

    // Only notify for tests that took > 30 seconds
    if (data.durationMs < MIN_DURATION_MS) {
      return;
    }

    // Don't notify if the page is visible (user is watching)
    if (document.visibilityState === 'visible') {
      return;
    }

    const icon = data.status === 'passed' ? '✅' : data.status === 'failed' ? '❌' : '⚠️';
    const statusText = data.status === 'passed' ? 'Passed' : data.status === 'failed' ? 'Failed' : 'Completed';
    const durationText = data.durationMs < 60000
      ? `${(data.durationMs / 1000).toFixed(1)}s`
      : `${Math.floor(data.durationMs / 60000)}m ${Math.floor((data.durationMs % 60000) / 1000)}s`;

    try {
      const notification = new Notification(`${icon} Test ${statusText}`, {
        body: `${data.testName}\nDuration: ${durationText}`,
        icon: '/favicon.ico',
        tag: `test-complete-${data.runId || Date.now()}`,
        requireInteraction: false,
        silent: false,
      });

      // Auto-close after 5 seconds
      setTimeout(() => notification.close(), 5000);

      // Focus window on click
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch {
      // Ignore notification errors
    }
  }, [notificationsSupported, notificationsEnabled, permission]);

  return {
    notificationsEnabled,
    notificationsSupported,
    permission,
    toggleNotifications,
    requestPermission,
    notifyTestComplete,
  };
}

export default useTestNotifications;
