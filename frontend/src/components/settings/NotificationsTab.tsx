// NotificationsTab - Notification preferences
// Feature #451: Extracted from SettingsPage.tsx

import { useNotificationStore } from '../../stores/notificationStore';

export function NotificationsTab() {
  const { preferences, setPreference } = useNotificationStore();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Notification Preferences</h3>
        <p className="text-sm text-muted-foreground">Choose how you want to receive notifications.</p>
      </div>

      {/* Notification Settings */}
      <div className="bg-card rounded-lg border border-border p-6 space-y-4">
        <h4 className="font-medium text-foreground">Email Notifications</h4>
        <div className="space-y-3">
          <label className="flex items-center justify-between">
            <div>
              <span className="text-foreground">Email Notifications</span>
              <p className="text-xs text-muted-foreground">Receive important notifications via email</p>
            </div>
            <input
              type="checkbox"
              checked={preferences.emailNotifications}
              onChange={(e) => setPreference('emailNotifications', e.target.checked)}
              className="rounded border-border h-5 w-5"
            />
          </label>
          <label className="flex items-center justify-between">
            <div>
              <span className="text-foreground">Test Failure Alerts</span>
              <p className="text-xs text-muted-foreground">Get notified when tests fail</p>
            </div>
            <input
              type="checkbox"
              checked={preferences.testFailureAlerts}
              onChange={(e) => setPreference('testFailureAlerts', e.target.checked)}
              className="rounded border-border h-5 w-5"
            />
          </label>
          <label className="flex items-center justify-between">
            <div>
              <span className="text-foreground">Schedule Completion Alerts</span>
              <p className="text-xs text-muted-foreground">Get notified when scheduled runs complete</p>
            </div>
            <input
              type="checkbox"
              checked={preferences.scheduleCompletionAlerts}
              onChange={(e) => setPreference('scheduleCompletionAlerts', e.target.checked)}
              className="rounded border-border h-5 w-5"
            />
          </label>
          <label className="flex items-center justify-between">
            <div>
              <span className="text-foreground">Weekly Digest</span>
              <p className="text-xs text-muted-foreground">Receive a weekly summary of test results</p>
            </div>
            <input
              type="checkbox"
              checked={preferences.weeklyDigest}
              onChange={(e) => setPreference('weeklyDigest', e.target.checked)}
              className="rounded border-border h-5 w-5"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
