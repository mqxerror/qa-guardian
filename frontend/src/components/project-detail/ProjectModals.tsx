/**
 * ProjectModals - All modal components for ProjectDetailPage
 * Feature #49: Extracted to reduce ProjectDetailPage line count
 *
 * Contains:
 * - Add Environment Variable Modal
 * - Delete Project Modal
 * - Create Alert Modal
 * - Add Member Modal
 * - Create Suite Modal
 * - Edit Selector Modal
 */
import React from 'react';
import {
  OrgMember,
  SlackChannel,
  EditSelectorModalState,
  VisionHealingResult,
  SettingsState,
  SettingsHandlers,
} from './';

export interface ProjectModalsProps {
  // Project info
  project: { id: string; name: string; description?: string; slug: string; base_url?: string; created_at: string } | null;

  // Modal visibility state
  showAddEnvModal: boolean;
  showDeleteModal: boolean;
  showCreateAlertModal: boolean;
  showAddMemberModal: boolean;
  showCreateSuiteModal: boolean;

  // Delete modal state
  isDeleting: boolean;
  deleteError: string;
  setShowDeleteModal: (show: boolean) => void;
  handleDeleteProject: () => Promise<void>;

  // Create Suite modal state
  newSuiteName: string;
  setNewSuiteName: (name: string) => void;
  newSuiteDescription: string;
  setNewSuiteDescription: (description: string) => void;
  newSuiteBrowser: 'chromium' | 'firefox' | 'webkit';
  setNewSuiteBrowser: (browser: 'chromium' | 'firefox' | 'webkit') => void;
  newSuiteViewportWidth: number;
  setNewSuiteViewportWidth: (width: number) => void;
  newSuiteViewportHeight: number;
  setNewSuiteViewportHeight: (height: number) => void;
  newSuiteTimeout: number;
  setNewSuiteTimeout: (timeout: number) => void;
  newSuiteRetryCount: number;
  setNewSuiteRetryCount: (count: number) => void;
  devicePreset: string;
  setDevicePreset: (preset: string) => void;
  handleDevicePresetChange: (preset: string) => void;
  isCreatingSuite: boolean;
  createSuiteError: string;
  setShowCreateSuiteModal: (show: boolean) => void;
  handleCreateSuite: (e: React.FormEvent) => Promise<void>;

  // Available members for Add Member modal
  availableMembers: OrgMember[];

  // Settings state and handlers (from useSettingsHandlers)
  settingsState: SettingsState;
  settingsHandlers: SettingsHandlers;
}

export function ProjectModals({
  project,
  showAddEnvModal,
  showDeleteModal,
  showCreateAlertModal,
  showAddMemberModal,
  showCreateSuiteModal,
  isDeleting,
  deleteError,
  setShowDeleteModal,
  handleDeleteProject,
  newSuiteName,
  setNewSuiteName,
  newSuiteDescription,
  setNewSuiteDescription,
  newSuiteBrowser,
  setNewSuiteBrowser,
  newSuiteViewportWidth,
  setNewSuiteViewportWidth,
  newSuiteViewportHeight,
  setNewSuiteViewportHeight,
  newSuiteTimeout,
  setNewSuiteTimeout,
  newSuiteRetryCount,
  setNewSuiteRetryCount,
  devicePreset,
  setDevicePreset,
  handleDevicePresetChange,
  isCreatingSuite,
  createSuiteError,
  setShowCreateSuiteModal,
  handleCreateSuite,
  availableMembers,
  settingsState,
  settingsHandlers,
}: ProjectModalsProps) {
  // Destructure settings state
  const {
    showAddEnvModal: _showAddEnvModal, // Already passed as prop
    newEnvKey, newEnvValue, newEnvIsSecret, isAddingEnv, addEnvError,
    showCreateAlertModal: _showCreateAlertModal, // Already passed as prop
    newAlertType, newAlertName, newAlertCondition, newAlertThreshold,
    newAlertEmails, newAlertWebhookUrl, newAlertSlackChannel, slackChannels,
    newAlertSuppressOnRetry, isCreatingAlert, createAlertError,
    showAddMemberModal: _showAddMemberModal, // Already passed as prop
    selectedUserId, selectedMemberRole, isAddingMember, addMemberError,
    editSelectorModal, editSelectorValue, editSelectorNotes, editSelectorApplyToTest,
    isSubmittingSelector, isHealingWithVision, visionHealingResult,
  } = settingsState;

  // Destructure settings handlers
  const {
    setShowAddEnvModal, setNewEnvKey, setNewEnvValue, setNewEnvIsSecret,
    setAddEnvError, handleAddEnvVar,
    setShowCreateAlertModal, setNewAlertType, setNewAlertName, setNewAlertCondition,
    setNewAlertThreshold, setNewAlertEmails, setNewAlertWebhookUrl, setNewAlertSlackChannel,
    setNewAlertSuppressOnRetry, handleCreateAlert,
    setShowAddMemberModal, setSelectedUserId, setSelectedMemberRole, handleAddMember,
    setEditSelectorModal, setEditSelectorValue, setEditSelectorNotes, setEditSelectorApplyToTest,
    handleUpdateSelector, handleAcceptHealed, handleHealWithVision,
  } = settingsHandlers;

  return (
    <>
      {/* Add Environment Variable Modal */}
      {showAddEnvModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => e.target === e.currentTarget && setShowAddEnvModal(false)}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="add-env-title" className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 id="add-env-title" className="text-lg font-semibold text-foreground">Add Environment Variable</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Add a variable that can be used in your tests.
            </p>
            <form onSubmit={handleAddEnvVar} className="mt-4 space-y-4">
              {addEnvError && (
                <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {addEnvError}
                </div>
              )}
              <div>
                <label htmlFor="env-key" className="mb-1 block text-sm font-medium text-foreground">
                  Variable Name
                </label>
                <input
                  type="text"
                  id="env-key"
                  value={newEnvKey}
                  onChange={(e) => setNewEnvKey(e.target.value.toUpperCase())}
                  required
                  pattern="[A-Z_][A-Z0-9_]*"
                  placeholder="e.g., API_KEY, BASE_URL"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Use uppercase letters, numbers, and underscores only.
                </p>
              </div>
              <div>
                <label htmlFor="env-value" className="mb-1 block text-sm font-medium text-foreground">
                  Value
                </label>
                <input
                  type={newEnvIsSecret ? 'password' : 'text'}
                  id="env-value"
                  value={newEnvValue}
                  onChange={(e) => setNewEnvValue(e.target.value)}
                  required
                  placeholder="Enter variable value"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="env-secret"
                  checked={newEnvIsSecret}
                  onChange={(e) => setNewEnvIsSecret(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <label htmlFor="env-secret" className="text-sm text-foreground">
                  Mark as secret (value will be masked)
                </label>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddEnvModal(false);
                    setNewEnvKey('');
                    setNewEnvValue('');
                    setNewEnvIsSecret(false);
                    setAddEnvError('');
                  }}
                  className="rounded-md px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingEnv}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isAddingEnv ? 'Adding...' : 'Add Variable'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Project Modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => e.target === e.currentTarget && setShowDeleteModal(false)}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="delete-project-title" className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 id="delete-project-title" className="text-lg font-semibold text-foreground">Delete Project</h3>
            <p className="mt-2 text-muted-foreground">
              Are you sure you want to delete "{project?.name}"? This action cannot be undone and will delete all test suites and tests within this project.
            </p>
            {deleteError && (
              <div role="alert" className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {deleteError}
              </div>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteProject}
                disabled={isDeleting}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete Project'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Alert Modal */}
      {showCreateAlertModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => e.target === e.currentTarget && setShowCreateAlertModal(false)}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="create-alert-title" className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 id="create-alert-title" className="text-lg font-semibold text-foreground">
              Create {newAlertType === 'email' ? 'Email' : newAlertType === 'slack' ? 'Slack' : 'Webhook'} Alert
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {newAlertType === 'email'
                ? 'Get notified by email when tests fail in this project.'
                : newAlertType === 'slack'
                ? 'Post test failure alerts to your Slack channel.'
                : 'Send test failure data to your webhook endpoint.'}
            </p>
            <form onSubmit={handleCreateAlert} className="mt-4 space-y-4">
              {createAlertError && (
                <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {createAlertError}
                </div>
              )}
              <div>
                <label htmlFor="alert-name" className="mb-1 block text-sm font-medium text-foreground">
                  Alert Name
                </label>
                <input
                  type="text"
                  id="alert-name"
                  value={newAlertName}
                  onChange={(e) => setNewAlertName(e.target.value)}
                  required
                  placeholder={newAlertType === 'email' ? 'e.g., Development Team Alert' : newAlertType === 'slack' ? 'e.g., QA Alerts Channel' : 'e.g., CI/CD Webhook'}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label htmlFor="alert-condition" className="mb-1 block text-sm font-medium text-foreground">
                  Alert Condition
                </label>
                <select
                  id="alert-condition"
                  value={newAlertCondition}
                  onChange={(e) => setNewAlertCondition(e.target.value as 'any_failure' | 'all_failures' | 'threshold')}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                >
                  <option value="any_failure">On any test failure</option>
                  <option value="all_failures">Only when all tests fail</option>
                  <option value="threshold">When failure rate exceeds threshold</option>
                </select>
              </div>
              {newAlertCondition === 'threshold' && (
                <div>
                  <label htmlFor="alert-threshold" className="mb-1 block text-sm font-medium text-foreground">
                    Failure Threshold (%)
                  </label>
                  <input
                    type="number"
                    id="alert-threshold"
                    min="1"
                    max="100"
                    value={newAlertThreshold}
                    onChange={(e) => setNewAlertThreshold(parseInt(e.target.value, 10))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Alert when {newAlertThreshold}% or more of tests fail
                  </p>
                </div>
              )}
              {newAlertType === 'email' && (
                <div>
                  <label htmlFor="alert-emails" className="mb-1 block text-sm font-medium text-foreground">
                    Email Recipients
                  </label>
                  <textarea
                    id="alert-emails"
                    value={newAlertEmails}
                    onChange={(e) => setNewAlertEmails(e.target.value)}
                    required
                    placeholder="Enter email addresses, separated by commas"
                    rows={3}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Separate multiple email addresses with commas
                  </p>
                </div>
              )}
              {newAlertType === 'slack' && (
                <div>
                  <label htmlFor="alert-slack-channel" className="mb-1 block text-sm font-medium text-foreground">
                    Slack Channel
                  </label>
                  <select
                    id="alert-slack-channel"
                    value={newAlertSlackChannel}
                    onChange={(e) => setNewAlertSlackChannel(e.target.value)}
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  >
                    <option value="">Select a channel...</option>
                    {slackChannels.map(channel => (
                      <option key={channel.id} value={channel.id}>
                        {channel.is_private ? '🔒 ' : '# '}{channel.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Test failure alerts will be posted to this Slack channel
                  </p>
                </div>
              )}
              {newAlertType === 'webhook' && (
                <div>
                  <label htmlFor="alert-webhook-url" className="mb-1 block text-sm font-medium text-foreground">
                    Webhook URL
                  </label>
                  <input
                    type="url"
                    id="alert-webhook-url"
                    value={newAlertWebhookUrl}
                    onChange={(e) => setNewAlertWebhookUrl(e.target.value)}
                    required
                    placeholder="https://your-endpoint.com/webhook"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    We'll POST a JSON payload to this URL when tests fail
                  </p>
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="alert-suppress-retry"
                  checked={newAlertSuppressOnRetry}
                  onChange={(e) => setNewAlertSuppressOnRetry(e.target.checked)}
                  className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                />
                <label htmlFor="alert-suppress-retry" className="text-sm font-medium text-foreground">
                  Suppress alert if test passes on retry
                </label>
              </div>
              <p className="text-xs text-muted-foreground -mt-2">
                If enabled, alerts won't be sent when tests initially fail but pass after retrying.
              </p>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateAlertModal(false)}
                  className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingAlert}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isCreatingAlert ? 'Creating...' : 'Create Alert'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => e.target === e.currentTarget && setShowAddMemberModal(false)}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="add-member-title" className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 id="add-member-title" className="text-lg font-semibold text-foreground">Add Member to Project</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Grant a team member access to this project.
            </p>
            <form onSubmit={handleAddMember} className="mt-4 space-y-4">
              {addMemberError && (
                <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {addMemberError}
                </div>
              )}
              <div>
                <label htmlFor="member-select" className="mb-1 block text-sm font-medium text-foreground">
                  Team Member
                </label>
                <select
                  id="member-select"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                >
                  <option value="">Select a team member...</option>
                  {availableMembers.map((member) => (
                    <option key={member.user_id} value={member.user_id}>
                      {member.name || member.email || member.user_id} ({member.role})
                    </option>
                  ))}
                </select>
                {availableMembers.length === 0 && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    All eligible team members already have access.
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="member-role" className="mb-1 block text-sm font-medium text-foreground">
                  Project Role
                </label>
                <select
                  id="member-role"
                  value={selectedMemberRole}
                  onChange={(e) => setSelectedMemberRole(e.target.value as 'developer' | 'viewer')}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                >
                  <option value="developer">Developer - Can create and run tests</option>
                  <option value="viewer">Viewer - Read-only access</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  className="rounded-md border border-border px-4 py-2 font-medium text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingMember || !selectedUserId}
                  className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isAddingMember ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Suite Modal */}
      {showCreateSuiteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => e.target === e.currentTarget && setShowCreateSuiteModal(false)}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="create-suite-title" className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 id="create-suite-title" className="text-lg font-semibold text-foreground">Create Test Suite</h3>
            <form onSubmit={handleCreateSuite} className="mt-4 space-y-4">
              {createSuiteError && (
                <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {createSuiteError}
                </div>
              )}
              <div>
                <label htmlFor="suite-name" className="mb-1 block text-sm font-medium text-foreground">
                  Suite Name
                </label>
                <input
                  id="suite-name"
                  type="text"
                  value={newSuiteName}
                  onChange={(e) => setNewSuiteName(e.target.value)}
                  placeholder="e.g., Login Tests"
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                />
              </div>
              <div>
                <label htmlFor="suite-description" className="mb-1 block text-sm font-medium text-foreground">
                  Description (optional)
                </label>
                <textarea
                  id="suite-description"
                  value={newSuiteDescription}
                  onChange={(e) => setNewSuiteDescription(e.target.value)}
                  placeholder="Describe the test suite..."
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                />
              </div>
              <div>
                <label htmlFor="suite-browser" className="mb-1 block text-sm font-medium text-foreground">
                  Browser
                </label>
                <select
                  id="suite-browser"
                  value={newSuiteBrowser}
                  onChange={(e) => setNewSuiteBrowser(e.target.value as 'chromium' | 'firefox' | 'webkit')}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                >
                  <option value="chromium">Chromium (Chrome/Edge)</option>
                  <option value="firefox">Firefox</option>
                  <option value="webkit">WebKit (Safari)</option>
                </select>
              </div>
              <div>
                <label htmlFor="device-preset" className="mb-1 block text-sm font-medium text-foreground">
                  Device / Viewport Preset
                </label>
                <select
                  id="device-preset"
                  value={devicePreset}
                  onChange={(e) => handleDevicePresetChange(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                >
                  <optgroup label="Desktop">
                    <option value="desktop">Desktop (1280x720)</option>
                    <option value="desktop-hd">Desktop HD (1920x1080)</option>
                  </optgroup>
                  <optgroup label="Mobile - iOS">
                    <option value="iphone-14">iPhone 14 (390x844)</option>
                    <option value="iphone-14-pro-max">iPhone 14 Pro Max (430x932)</option>
                    <option value="iphone-se">iPhone SE (375x667)</option>
                  </optgroup>
                  <optgroup label="Mobile - Android">
                    <option value="pixel-7">Pixel 7 (412x915)</option>
                    <option value="samsung-s23">Samsung S23 (360x780)</option>
                  </optgroup>
                  <optgroup label="Tablet">
                    <option value="ipad">iPad (768x1024)</option>
                    <option value="ipad-pro">iPad Pro (1024x1366)</option>
                  </optgroup>
                  <optgroup label="Other">
                    <option value="custom">Custom Dimensions</option>
                  </optgroup>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="viewport-width" className="mb-1 block text-sm font-medium text-foreground">
                    Viewport Width
                  </label>
                  <input
                    id="viewport-width"
                    type="number"
                    value={newSuiteViewportWidth}
                    onChange={(e) => {
                      setNewSuiteViewportWidth(parseInt(e.target.value) || 1280);
                      setDevicePreset('custom');
                    }}
                    min={320}
                    max={3840}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  />
                </div>
                <div>
                  <label htmlFor="viewport-height" className="mb-1 block text-sm font-medium text-foreground">
                    Viewport Height
                  </label>
                  <input
                    id="viewport-height"
                    type="number"
                    value={newSuiteViewportHeight}
                    onChange={(e) => {
                      setNewSuiteViewportHeight(parseInt(e.target.value) || 720);
                      setDevicePreset('custom');
                    }}
                    min={240}
                    max={2160}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="suite-timeout" className="mb-1 block text-sm font-medium text-foreground">
                    Timeout (seconds)
                  </label>
                  <input
                    id="suite-timeout"
                    type="number"
                    value={newSuiteTimeout}
                    onChange={(e) => setNewSuiteTimeout(parseInt(e.target.value) || 30)}
                    min={5}
                    max={300}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Test timeout (5-300s)</p>
                </div>
                <div>
                  <label htmlFor="suite-retry-count" className="mb-1 block text-sm font-medium text-foreground">
                    Retry Count
                  </label>
                  <input
                    id="suite-retry-count"
                    type="number"
                    value={newSuiteRetryCount}
                    onChange={(e) => setNewSuiteRetryCount(parseInt(e.target.value) || 0)}
                    min={0}
                    max={5}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Retries on failure (0-5)</p>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateSuiteModal(false)}
                  className="rounded-md border border-border px-4 py-2 font-medium text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingSuite}
                  className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
                >
                  {isCreatingSuite && (
                    <svg aria-hidden="true" className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  {isCreatingSuite ? 'Creating...' : 'Create Suite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Feature #1065: Edit Selector Modal for ProjectDetailPage */}
      {editSelectorModal.isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => e.target === e.currentTarget && !isSubmittingSelector && setEditSelectorModal({
            isOpen: false, runId: '', testId: '', stepId: '', currentSelector: '', originalSelector: '', wasHealed: false,
          })}
        >
          <div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-lg bg-card p-6 shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
                  <svg className="h-5 w-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    {editSelectorModal.wasHealed ? 'Edit Healed Selector' : 'Edit Selector'}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {editSelectorModal.wasHealed ? 'Modify or accept the AI-healed selector' : 'Manually update the selector'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditSelectorModal({
                  isOpen: false, runId: '', testId: '', stepId: '', currentSelector: '', originalSelector: '', wasHealed: false,
                })}
                className="text-muted-foreground hover:text-foreground"
                disabled={isSubmittingSelector}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Feature #1347: Vision Healing Button */}
            <div className="mb-4">
              <button
                onClick={handleHealWithVision}
                disabled={isHealingWithVision || isSubmittingSelector}
                className="w-full flex items-center justify-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {isHealingWithVision ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Analyzing with Vision AI...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                    Heal with Vision AI
                  </>
                )}
              </button>
              <p className="mt-1 text-xs text-muted-foreground text-center">
                Use Claude Vision to find the element visually and suggest robust selectors
              </p>
            </div>

            {/* Vision Healing Results */}
            {visionHealingResult && (
              <div className="mb-4 p-3 bg-violet-50 dark:bg-violet-900/20 rounded-md border border-violet-200 dark:border-violet-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-medium text-violet-700 dark:text-violet-300 flex items-center gap-1">
                    <span>Vision AI Suggestions</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    visionHealingResult.confidence >= 0.8 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                    visionHealingResult.confidence >= 0.6 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                  }`}>
                    {Math.round(visionHealingResult.confidence * 100)}% confidence
                  </span>
                </div>

                {/* Element Analysis */}
                <div className="text-xs text-violet-600 dark:text-violet-400 mb-2">
                  Detected: <span className="font-medium">{visionHealingResult.analysis.element_type}</span>
                  {visionHealingResult.analysis.text_content && (
                    <> with text "<span className="font-medium">{visionHealingResult.analysis.text_content}</span>"</>
                  )}
                </div>

                {/* Suggested Selectors */}
                <div className="space-y-2">
                  {visionHealingResult.suggested_selectors.slice(0, 3).map((suggestion, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded cursor-pointer transition-colors ${
                        editSelectorValue === suggestion.selector
                          ? 'bg-violet-200 dark:bg-violet-800 border-2 border-violet-400'
                          : 'bg-white dark:bg-gray-800 hover:bg-violet-100 dark:hover:bg-violet-900/50 border border-violet-200 dark:border-violet-700'
                      }`}
                      onClick={() => setEditSelectorValue(suggestion.selector)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <code className="text-xs font-mono text-violet-800 dark:text-violet-200 break-all">
                          {suggestion.selector}
                        </code>
                        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                          {suggestion.best_practice && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                              Best
                            </span>
                          )}
                          <span className="text-xs px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                            {suggestion.type}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">{suggestion.reason}</p>
                    </div>
                  ))}
                </div>

                {/* Auto-heal recommendation */}
                {visionHealingResult.auto_heal_recommended && (
                  <div className="mt-2 p-2 bg-green-100 dark:bg-green-900/30 rounded text-xs text-green-700 dark:text-green-300 flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                      <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    Auto-heal recommended - High confidence best practice selector
                  </div>
                )}
              </div>
            )}

            {/* Original Selector */}
            <div className="mb-4 p-3 bg-muted/50 rounded-md">
              <div className="text-xs font-medium text-muted-foreground mb-1">Original Selector</div>
              <code className="text-sm font-mono text-foreground break-all">
                {editSelectorModal.originalSelector || 'N/A'}
              </code>
            </div>

            {/* Current Selector (if healed) */}
            {editSelectorModal.wasHealed && editSelectorModal.currentSelector !== editSelectorModal.originalSelector && (
              <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-800">
                <div className="text-xs font-medium text-green-700 dark:text-green-300 mb-1 flex items-center gap-1">
                  <span>AI-Healed Selector</span>
                </div>
                <code className="text-sm font-mono text-green-800 dark:text-green-200 break-all">
                  {editSelectorModal.currentSelector}
                </code>
              </div>
            )}

            {/* New Selector Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-foreground mb-1">
                {editSelectorModal.wasHealed ? 'New Selector (or keep healed)' : 'New Selector'}
              </label>
              <input
                type="text"
                value={editSelectorValue}
                onChange={(e) => setEditSelectorValue(e.target.value)}
                placeholder={editSelectorModal.currentSelector || 'Enter selector...'}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Supports CSS selectors, XPath, or data-testid attributes
              </p>
            </div>

            {/* Notes */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-foreground mb-1">Notes (optional)</label>
              <textarea
                value={editSelectorNotes}
                onChange={(e) => setEditSelectorNotes(e.target.value)}
                placeholder="Why are you changing this selector?"
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>

            {/* Apply to Test Definition Checkbox */}
            <div className="mb-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editSelectorApplyToTest}
                  onChange={(e) => setEditSelectorApplyToTest(e.target.checked)}
                  className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                />
                <span className="text-sm text-foreground">Apply to test definition</span>
              </label>
              <p className="ml-6 text-xs text-muted-foreground">
                If checked, the new selector will be saved to the test so future runs use it
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setEditSelectorModal({
                    isOpen: false, runId: '', testId: '', stepId: '', currentSelector: '', originalSelector: '', wasHealed: false,
                  });
                  setEditSelectorValue('');
                  setEditSelectorNotes('');
                }}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                disabled={isSubmittingSelector}
              >
                Cancel
              </button>
              {editSelectorModal.wasHealed && (
                <button
                  onClick={handleAcceptHealed}
                  disabled={isSubmittingSelector}
                  className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {isSubmittingSelector ? 'Accepting...' : 'Accept Healed'}
                </button>
              )}
              <button
                onClick={handleUpdateSelector}
                disabled={isSubmittingSelector || !editSelectorValue.trim()}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isSubmittingSelector ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </span>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
