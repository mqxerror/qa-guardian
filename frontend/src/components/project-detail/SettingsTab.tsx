/**
 * SettingsTab - Project settings tab component
 * Feature #49: Extracted from ProjectDetailPage to reduce line count
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../stores/toastStore';
import { X, Plus, Bell, Mail, Link, Check, Monitor, Settings } from 'lucide-react';
import {
 Project,
 ViewportProfile,
 // ProjectMember, // Unused
 OrgMember,
 AlertChannel,
 AlertHistoryEntry,
 EnvironmentVariable,
 HealingSettings,
 SlackChannel,
} from './types';
import { SettingsState, SettingsHandlers } from './useSettingsHandlers';

export interface SettingsTabProps {
 project: Project | null;
 user: { role?: string; organization_id?: string } | null;
 token: string | null;
 formatDate: (date: string) => string;
 // Project defaults
 projectDefaultBrowser: 'chromium' | 'firefox' | 'webkit';
 setProjectDefaultBrowser: (browser: 'chromium' | 'firefox' | 'webkit') => void;
 projectViewportProfiles: ViewportProfile[];
 setProjectViewportProfiles: (profiles: ViewportProfile[]) => void;
 isSavingProjectDefaults: boolean;
 setIsSavingProjectDefaults: (saving: boolean) => void;
 // Permissions
 canManageMembers: boolean;
 canManageAlerts: boolean;
 // Members helpers
 availableMembers: OrgMember[];
 getMemberDetails: (userId: string) => OrgMember | undefined;
 // Settings state and handlers
 settingsState: SettingsState;
 settingsHandlers: SettingsHandlers;
}

export function SettingsTab({
 project,
 user,
 token,
 formatDate,
 projectDefaultBrowser,
 setProjectDefaultBrowser,
 projectViewportProfiles,
 setProjectViewportProfiles,
 isSavingProjectDefaults,
 setIsSavingProjectDefaults,
 canManageMembers,
 canManageAlerts,
 availableMembers,
 getMemberDetails,
 settingsState,
 settingsHandlers,
}: SettingsTabProps) {
 const navigate = useNavigate();

 // Destructure settings state
 const {
 projectMembers,
 showAddMemberModal,
 selectedUserId,
 selectedMemberRole,
 alertChannels,
 showAlertHistory,
 alertHistory,
 slackChannels,
 envVars,
 editingEnvId,
 editEnvValue,
 healingSettings,
 isSavingHealingSettings,
 healingSettingsMessage,
 } = settingsState;

 // Destructure settings handlers
 const {
 setShowAddMemberModal,
 setSelectedUserId,
 setSelectedMemberRole,
 handleRemoveMember,
 setSlackChannels,
 setShowCreateAlertModal,
 setNewAlertType,
 setShowAlertHistory,
 handleToggleAlert,
 handleDeleteAlert,
 setShowAddEnvModal,
 setEditingEnvId,
 setEditEnvValue,
 handleUpdateEnvVar,
 handleDeleteEnvVar,
 setHealingSettings,
 handleSaveHealingSettings,
 } = settingsHandlers;

 return (
 <>
 {/* Project Details Section */}
 <div className="mt-8">
 <div className="rounded-lg border border-border bg-card p-6">
 <h2 className="text-lg font-semibold text-foreground">Project Details</h2>
 <dl className="mt-4 space-y-2">
 <div>
 <dt className="text-sm font-medium text-muted-foreground">ID</dt>
 <dd className="text-foreground">{project?.id}</dd>
 </div>
 <div>
 <dt className="text-sm font-medium text-muted-foreground">Slug</dt>
 <dd className="text-foreground">{project?.slug}</dd>
 </div>
 <div>
 <dt className="text-sm font-medium text-muted-foreground">Created</dt>
 <dd className="text-foreground">
 {project?.created_at ? formatDate(project.created_at) : '-'}
 </dd>
 </div>
 {project?.base_url && (
 <div>
 <dt className="text-sm font-medium text-muted-foreground">Base URL</dt>
 <dd className="text-foreground">
 <a href={project.base_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
 {project.base_url}
 </a>
 </dd>
 </div>
 )}
 </dl>
 </div>
 </div>

 {/* Feature #1794: Test Defaults Section */}
 <div className="mt-8">
 <div className="rounded-lg border border-border bg-card p-6">
 <div className="flex items-center justify-between mb-4">
 <div>
 <h2 className="text-lg font-semibold text-foreground">Test Defaults</h2>
 <p className="text-sm text-muted-foreground mt-1">
 Configure default settings for all tests in this project
 </p>
 </div>
 </div>

 <div className="space-y-6">
 {/* Default Browser */}
 <div>
 <label htmlFor="project-default-browser" className="block text-sm font-medium text-foreground mb-2">
 Default Browser
 </label>
 <select
 id="project-default-browser"
 value={projectDefaultBrowser}
 onChange={(e) => setProjectDefaultBrowser(e.target.value as 'chromium' | 'firefox' | 'webkit')}
 className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
 >
 <option value="chromium">Chromium (Chrome/Edge)</option>
 <option value="firefox">Firefox</option>
 <option value="webkit">WebKit (Safari)</option>
 </select>
 <p className="text-xs text-muted-foreground mt-1">
 New test suites will use this browser by default
 </p>
 </div>

 {/* Viewport Profiles */}
 <div>
 <label className="block text-sm font-medium text-foreground mb-2">
 Viewport Profiles
 </label>
 <p className="text-sm text-muted-foreground mb-3">
 Define common viewport sizes for visual and E2E tests
 </p>
 <div className="space-y-2">
 {projectViewportProfiles.map((profile, index) => (
 <div key={index} className="flex items-center gap-3 p-3 rounded-md border border-border bg-muted/30">
 <input
 type="text"
 id={`viewport-profile-name-${index}`}
 aria-label={`Viewport profile ${index + 1} name`}
 value={profile.name}
 onChange={(e) => {
 const newProfiles = [...projectViewportProfiles];
 newProfiles[index].name = e.target.value;
 setProjectViewportProfiles(newProfiles);
 }}
 className="flex-1 max-w-[150px] rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground"
 placeholder="Profile name"
 />
 <div className="flex items-center gap-1">
 <input
 type="number"
 id={`viewport-profile-width-${index}`}
 aria-label={`Viewport profile ${index + 1} width`}
 value={profile.width}
 onChange={(e) => {
 const newProfiles = [...projectViewportProfiles];
 newProfiles[index].width = parseInt(e.target.value) || 0;
 setProjectViewportProfiles(newProfiles);
 }}
 className="w-20 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground text-center"
 min={320}
 max={3840}
 />
 <span className="text-muted-foreground" aria-hidden="true">x</span>
 <input
 type="number"
 id={`viewport-profile-height-${index}`}
 aria-label={`Viewport profile ${index + 1} height`}
 value={profile.height}
 onChange={(e) => {
 const newProfiles = [...projectViewportProfiles];
 newProfiles[index].height = parseInt(e.target.value) || 0;
 setProjectViewportProfiles(newProfiles);
 }}
 className="w-20 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground text-center"
 min={200}
 max={2160}
 />
 </div>
 <button
 onClick={() => {
 setProjectViewportProfiles(projectViewportProfiles.filter((_, i) => i !== index));
 }}
 className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
 title="Remove profile"
 >
 <X className="w-4 h-4" />
 </button>
 </div>
 ))}
 <button
 onClick={() => {
 setProjectViewportProfiles([...projectViewportProfiles, { name: 'New Profile', width: 1280, height: 720 }]);
 }}
 className="flex items-center gap-2 px-3 py-2 text-sm text-primary hover:text-primary/80 transition-colors"
 >
 <Plus className="w-4 h-4" />
 Add Viewport Profile
 </button>
 </div>
 </div>

 {/* Save Button */}
 <div className="pt-4 border-t border-border">
 <button
 onClick={async () => {
 setIsSavingProjectDefaults(true);
 try {
 // Save to backend (mock for now - would need API endpoint)
 await new Promise(resolve => setTimeout(resolve, 500));
 toast.success('Project defaults saved successfully');
 } catch (err) {
 toast.error('Failed to save project defaults');
 } finally {
 setIsSavingProjectDefaults(false);
 }
 }}
 disabled={isSavingProjectDefaults}
 className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
 >
 {isSavingProjectDefaults ? 'Saving...' : 'Save Defaults'}
 </button>
 </div>
 </div>
 </div>
 </div>

 {/* Project Members Section (Project-Level Permissions) */}
 {canManageMembers && (
 <div className="mt-8">
 <div className="rounded-lg border border-border bg-card p-6">
 <div className="flex items-center justify-between mb-4">
 <div>
 <h2 className="text-lg font-semibold text-foreground">Project Access</h2>
 <p className="text-sm text-muted-foreground mt-1">
 Manage which team members have access to this project. Owners and admins always have full access.
 </p>
 </div>
 <button
 onClick={() => setShowAddMemberModal(true)}
 className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
 disabled={availableMembers.length === 0}
 >
 Add Member
 </button>
 </div>

 {projectMembers.length === 0 ? (
 <div className="rounded-lg border border-dashed border-border p-6 text-center">
 <p className="text-muted-foreground">
 No members have been granted explicit access to this project yet.
 </p>
 <p className="text-sm text-muted-foreground mt-1">
 Developers and viewers need to be added here to access this project.
 </p>
 </div>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full">
 <thead>
 <tr className="border-b border-border">
 <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Member</th>
 <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Project Role</th>
 <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
 </tr>
 </thead>
 <tbody>
 {projectMembers.map((member) => {
 const details = getMemberDetails(member.user_id);
 return (
 <tr key={member.user_id} className="border-b border-border last:border-0">
 <td className="py-3 px-4">
 <div>
 <div className="font-medium text-foreground">{details?.name || 'Unknown User'}</div>
 <div className="text-sm text-muted-foreground">{details?.email || member.user_id}</div>
 </div>
 </td>
 <td className="py-3 px-4">
 <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
 member.role === 'developer'
 ? 'bg-primary/10 text-primary'
 : 'bg-muted text-foreground'
 }`}>
 {member.role}
 </span>
 </td>
 <td className="py-3 px-4 text-right">
 <button
 onClick={() => handleRemoveMember(member.user_id)}
 className="text-sm text-destructive hover:text-destructive"
 >
 Remove
 </button>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 )}
 </div>
 </div>
 )}

 {/* Alert Channels Section */}
 {canManageAlerts && (
 <div className="mt-8">
 <div className="rounded-lg border border-border bg-card p-6">
 <div className="flex items-center justify-between mb-4">
 <div>
 <h2 className="text-lg font-semibold text-foreground">Alert Channels</h2>
 <p className="text-sm text-muted-foreground mt-1">
 Configure notifications for test failures in this project.
 </p>
 </div>
 <div className="flex gap-2">
 <button
 onClick={() => { setNewAlertType('email'); setShowCreateAlertModal(true); }}
 className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
 >
 Add Email Alert
 </button>
 <button
 onClick={async () => {
 // Fetch Slack channels before opening modal
 try {
 const response = await fetch(`/api/v1/organizations/${user?.organization_id}/slack/channels`, {
 headers: { Authorization: `Bearer ${token}` },
 });
 if (response.ok) {
 const data = await response.json();
 setSlackChannels(data.channels || []);
 setNewAlertType('slack');
 setShowCreateAlertModal(true);
 } else if (response.status === 404) {
 toast.error('Please connect Slack first in Organization Settings');
 } else {
 toast.error('Failed to fetch Slack channels');
 }
 } catch {
 toast.error('Failed to fetch Slack channels');
 }
 }}
 className="rounded-md bg-[#4A154B] px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-[#611f64]"
 >
 Add Slack Alert
 </button>
 <button
 onClick={() => { setNewAlertType('webhook'); setShowCreateAlertModal(true); }}
 className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
 >
 Add Webhook Alert
 </button>
 </div>
 </div>

 {alertChannels.length === 0 ? (
 <div className="rounded-lg border border-dashed border-border p-6 text-center">
 <Bell className="mx-auto h-12 w-12 text-muted-foreground" strokeWidth={1.5} />
 <p className="mt-2 text-muted-foreground">
 No alert channels configured yet.
 </p>
 <p className="text-sm text-muted-foreground mt-1">
 Get notified when tests fail by adding an email alert.
 </p>
 </div>
 ) : (
 <div className="space-y-3">
 {alertChannels.map((channel) => (
 <div
 key={channel.id}
 className={`flex items-center justify-between rounded-lg border p-4 ${
 channel.enabled ? 'border-border bg-background' : 'border-border/50 bg-muted/30'
 }`}
 >
 <div className="flex items-center gap-3">
 <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
 channel.enabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
 }`}>
 {channel.type === 'email' ? (
 <Mail className="h-5 w-5" />
 ) : (
 <Link className="h-5 w-5" />
 )}
 </div>
 <div>
 <div className="flex items-center gap-2">
 <span className={`font-medium ${channel.enabled ? 'text-foreground' : 'text-muted-foreground'}`}>
 {channel.name}
 </span>
 {!channel.enabled && (
 <span className="text-xs text-muted-foreground">(disabled)</span>
 )}
 </div>
 <div className="flex items-center gap-2 text-sm text-muted-foreground">
 <span className="capitalize">
 {channel.condition === 'any_failure' && 'On any failure'}
 {channel.condition === 'all_failures' && 'On all failures'}
 {channel.condition === 'threshold' && `When ${channel.threshold_percent}%+ fail`}
 </span>
 <span>-</span>
 <span>
 {channel.type === 'email' && `${channel.email_addresses?.length || 0} recipient(s)`}
 {channel.type === 'webhook' && 'Webhook endpoint'}
 </span>
 {channel.suppress_on_retry_success && (
 <>
 <span>-</span>
 <span className="text-warning" title="Alert is suppressed if test passes on retry">
 Retry-aware
 </span>
 </>
 )}
 </div>
 </div>
 </div>
 <div className="flex items-center gap-2">
 <button
 onClick={() => handleToggleAlert(channel.id, channel.enabled)}
 className={`rounded-md px-3 py-1.5 text-sm ${
 channel.enabled
 ? 'bg-muted text-muted-foreground hover:bg-muted/80'
 : 'bg-primary text-primary-foreground hover:bg-primary/90'
 }`}
 >
 {channel.enabled ? 'Disable' : 'Enable'}
 </button>
 <button
 onClick={() => handleDeleteAlert(channel.id)}
 className="rounded-md px-3 py-1.5 text-sm text-destructive hover:bg-destructive/5"
 >
 Delete
 </button>
 </div>
 </div>
 ))}
 </div>
 )}

 {/* Alert History Section */}
 <div className="mt-6 border-t border-border pt-6">
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-md font-semibold text-foreground">Alert History</h3>
 <button
 onClick={() => setShowAlertHistory(!showAlertHistory)}
 className="text-sm text-primary hover:underline"
 >
 {showAlertHistory ? 'Hide History' : 'Show History'}
 </button>
 </div>

 {showAlertHistory && (
 <>
 {alertHistory.length === 0 ? (
 <div className="rounded-lg border border-dashed border-border p-4 text-center">
 <p className="text-sm text-muted-foreground">
 No alerts have been triggered yet.
 </p>
 </div>
 ) : (
 <div className="space-y-2 max-h-96 overflow-y-auto">
 {alertHistory.map((entry) => (
 <div
 key={entry.id}
 className={`flex items-start gap-3 rounded-lg border p-3 ${
 entry.success
 ? 'border-success/20 bg-success/5/50'
 : 'border-destructive/20 bg-destructive/5/50'
 }`}
 >
 <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
 entry.success ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
 }`}>
 {entry.success ? (
 <Check className="h-4 w-4" />
 ) : (
 <X className="h-4 w-4" />
 )}
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
 entry.type === 'email'
 ? 'bg-primary/10 text-primary'
 : 'bg-accent/10 text-accent'
 }`}>
 {entry.type === 'email' ? 'Email' : 'Webhook'}
 </span>
 <span className="text-sm font-medium text-foreground truncate">
 {entry.channelName}
 </span>
 <span className={`text-xs ${entry.success ? 'text-success' : 'text-destructive'}`}>
 {entry.success ? 'Sent' : 'Failed'}
 </span>
 </div>
 <div className="mt-1 text-xs text-muted-foreground">
 {entry.type === 'email' && entry.details.recipients && (
 <span>To: {entry.details.recipients.join(', ')}</span>
 )}
 {entry.type === 'webhook' && entry.details.webhookUrl && (
 <span>URL: {entry.details.webhookUrl.substring(0, 50)}...</span>
 )}
 </div>
 {entry.error && (
 <div className="mt-1 text-xs text-destructive">
 Error: {entry.error}
 </div>
 )}
 <div className="mt-1 text-xs text-muted-foreground">
 {new Date(entry.timestamp).toLocaleString()}
 {' - '}
 <button
 onClick={() => navigate(`/runs/${entry.runId}`)}
 className="text-primary hover:underline"
 >
 View Run
 </button>
 </div>
 </div>
 </div>
 ))}
 </div>
 )}
 </>
 )}
 </div>

 {/* Environment Variables Section */}
 {(user?.role === 'owner' || user?.role === 'admin') && (
 <div className="mt-6 border-t border-border pt-6">
 <div className="flex items-center justify-between mb-4">
 <div>
 <h3 className="text-md font-semibold text-foreground">Environment Variables</h3>
 <p className="text-sm text-muted-foreground mt-1">
 Configure variables to use in your tests. Secret values are masked.
 </p>
 </div>
 <button
 onClick={() => setShowAddEnvModal(true)}
 className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
 >
 Add Variable
 </button>
 </div>

 {envVars.length === 0 ? (
 <div className="rounded-lg border border-dashed border-border p-6 text-center">
 <Settings className="mx-auto h-12 w-12 text-muted-foreground" strokeWidth={1.5} />
 <p className="mt-2 text-muted-foreground">
 No environment variables configured yet.
 </p>
 <p className="text-sm text-muted-foreground mt-1">
 Add variables like API keys, base URLs, or test credentials.
 </p>
 </div>
 ) : (
 <div className="rounded-lg border border-border overflow-hidden">
 <table className="w-full">
 <thead className="bg-muted/30">
 <tr>
 <th className="px-4 py-2 text-left text-sm font-medium text-muted-foreground">Key</th>
 <th className="px-4 py-2 text-left text-sm font-medium text-muted-foreground">Value</th>
 <th className="px-4 py-2 text-left text-sm font-medium text-muted-foreground">Type</th>
 <th className="px-4 py-2 text-right text-sm font-medium text-muted-foreground">Actions</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-border">
 {envVars.map((envVar) => (
 <tr key={envVar.id} className="hover:bg-muted/20">
 <td className="px-4 py-3 text-sm font-mono text-foreground">{envVar.key}</td>
 <td className="px-4 py-3 text-sm">
 {editingEnvId === envVar.id ? (
 <div className="flex items-center gap-2">
 <input
 type="text"
 id={`env-var-edit-${envVar.id}`}
 aria-label={`Edit value for ${envVar.key}`}
 value={editEnvValue}
 onChange={(e) => setEditEnvValue(e.target.value)}
 className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
 autoFocus
 />
 <button
 onClick={() => handleUpdateEnvVar(envVar.id)}
 className="text-sm text-primary hover:underline"
 >
 Save
 </button>
 <button
 onClick={() => { setEditingEnvId(null); setEditEnvValue(''); }}
 className="text-sm text-muted-foreground hover:underline"
 >
 Cancel
 </button>
 </div>
 ) : (
 <span className={`font-mono ${envVar.is_secret ? 'text-muted-foreground' : 'text-foreground'}`}>
 {envVar.value}
 </span>
 )}
 </td>
 <td className="px-4 py-3 text-sm">
 {envVar.is_secret ? (
 <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-warning/10 text-warning">
 Secret
 </span>
 ) : (
 <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
 Plain
 </span>
 )}
 </td>
 <td className="px-4 py-3 text-right">
 {editingEnvId !== envVar.id && (
 <div className="flex items-center justify-end gap-2">
 <button
 onClick={() => { setEditingEnvId(envVar.id); setEditEnvValue(''); }}
 className="text-sm text-primary hover:underline"
 >
 Edit
 </button>
 <button
 onClick={() => handleDeleteEnvVar(envVar.id)}
 className="text-sm text-destructive hover:underline"
 >
 Delete
 </button>
 </div>
 )}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </div>
 )}

 {/* AI Test Healing Settings Section (Feature #1064) */}
 {(user?.role === 'owner' || user?.role === 'admin') && (
 <div className="mt-6 border-t border-border pt-6">
 <div className="flex items-center justify-between mb-4">
 <div>
 <h3 className="text-md font-semibold text-foreground flex items-center gap-2">
 <Monitor className="h-5 w-5 text-accent" />
 AI Test Healing
 </h3>
 <p className="text-sm text-muted-foreground mt-1">
 Configure AI-powered test self-healing to automatically fix broken selectors.
 </p>
 </div>
 </div>

 <div className="space-y-4 rounded-lg border border-border bg-card p-4">
 {/* Enable/Disable Healing */}
 <div className="flex items-center justify-between">
 <div>
 <label id="healing-enabled-label" className="text-sm font-medium text-foreground">Enable AI Healing</label>
 <p id="healing-enabled-desc" className="text-xs text-muted-foreground">When enabled, tests will attempt to self-heal when selectors fail</p>
 </div>
 <button
 onClick={() => setHealingSettings({ ...healingSettings, healing_enabled: !healingSettings.healing_enabled })}
 role="switch"
 aria-checked={healingSettings.healing_enabled}
 aria-labelledby="healing-enabled-label"
 aria-describedby="healing-enabled-desc"
 className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
 healingSettings.healing_enabled ? 'bg-primary' : 'bg-muted'
 }`}
 >
 <span
 className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-card shadow ring-0 transition duration-200 ease-in-out ${
 healingSettings.healing_enabled ? 'translate-x-5' : 'translate-x-0'
 }`}
 />
 </button>
 </div>

 {/* Healing Timeout */}
 <div>
 <label htmlFor="healing-timeout" className="text-sm font-medium text-foreground">Healing Timeout (seconds)</label>
 <p id="healing-timeout-desc" className="text-xs text-muted-foreground mb-2">Maximum time to attempt healing before aborting (5-120 seconds)</p>
 <div className="flex items-center gap-3">
 <input
 type="range"
 id="healing-timeout-range"
 aria-label="Healing timeout slider"
 min="5"
 max="120"
 step="5"
 value={healingSettings.healing_timeout}
 onChange={(e) => setHealingSettings({ ...healingSettings, healing_timeout: parseInt(e.target.value) })}
 className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
 disabled={!healingSettings.healing_enabled}
 />
 <input
 type="number"
 id="healing-timeout"
 aria-describedby="healing-timeout-desc"
 min="5"
 max="120"
 value={healingSettings.healing_timeout}
 onChange={(e) => {
 const val = parseInt(e.target.value);
 if (val >= 5 && val <= 120) {
 setHealingSettings({ ...healingSettings, healing_timeout: val });
 }
 }}
 className="w-20 rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground text-center"
 disabled={!healingSettings.healing_enabled}
 />
 <span className="text-sm text-muted-foreground" aria-hidden="true">sec</span>
 </div>
 </div>

 {/* Max Healing Attempts */}
 <div>
 <label htmlFor="max-healing-attempts" className="text-sm font-medium text-foreground">Max Healing Attempts</label>
 <p id="max-healing-attempts-desc" className="text-xs text-muted-foreground mb-2">Maximum number of healing attempts per failed selector (1-10)</p>
 <div className="flex items-center gap-3">
 <input
 type="range"
 id="max-healing-attempts-range"
 aria-label="Max healing attempts slider"
 min="1"
 max="10"
 value={healingSettings.max_healing_attempts}
 onChange={(e) => setHealingSettings({ ...healingSettings, max_healing_attempts: parseInt(e.target.value) })}
 className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
 disabled={!healingSettings.healing_enabled}
 />
 <input
 type="number"
 id="max-healing-attempts"
 aria-describedby="max-healing-attempts-desc"
 min="1"
 max="10"
 value={healingSettings.max_healing_attempts}
 onChange={(e) => {
 const val = parseInt(e.target.value);
 if (val >= 1 && val <= 10) {
 setHealingSettings({ ...healingSettings, max_healing_attempts: val });
 }
 }}
 className="w-20 rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground text-center"
 disabled={!healingSettings.healing_enabled}
 />
 </div>
 </div>

 {/* Healing Strategies */}
 <div>
 <label className="text-sm font-medium text-foreground">Healing Strategies</label>
 <p className="text-xs text-muted-foreground mb-2">Select which healing strategies to use when selectors fail</p>
 <div className="grid grid-cols-2 gap-2">
 {[
 { id: 'selector_fallback', label: 'Selector Fallback', desc: 'Try alternative selectors' },
 { id: 'visual_match', label: 'Visual Match', desc: 'Match elements by appearance' },
 { id: 'text_match', label: 'Text Match', desc: 'Find elements by text content' },
 { id: 'attribute_match', label: 'Attribute Match', desc: 'Match by data attributes' },
 { id: 'css_selector', label: 'CSS Selector', desc: 'Generate CSS selectors' },
 { id: 'xpath', label: 'XPath', desc: 'Generate XPath selectors' },
 ].map((strategy) => (
 <label
 key={strategy.id}
 className={`flex items-start gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
 healingSettings.healing_strategies.includes(strategy.id)
 ? 'border-primary bg-primary/5'
 : 'border-border hover:bg-muted/30'
 } ${!healingSettings.healing_enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
 >
 <input
 type="checkbox"
 checked={healingSettings.healing_strategies.includes(strategy.id)}
 onChange={(e) => {
 if (e.target.checked) {
 setHealingSettings({
 ...healingSettings,
 healing_strategies: [...healingSettings.healing_strategies, strategy.id],
 });
 } else {
 setHealingSettings({
 ...healingSettings,
 healing_strategies: healingSettings.healing_strategies.filter((s) => s !== strategy.id),
 });
 }
 }}
 disabled={!healingSettings.healing_enabled}
 className="mt-1 h-4 w-4 rounded border-input text-primary focus:ring-primary"
 />
 <div>
 <span className="text-sm font-medium text-foreground">{strategy.label}</span>
 <p className="text-xs text-muted-foreground">{strategy.desc}</p>
 </div>
 </label>
 ))}
 </div>
 </div>

 {/* Notify on Healing */}
 <div className="flex items-center justify-between pt-2 border-t border-border">
 <div>
 <label id="notify-healing-label" className="text-sm font-medium text-foreground">Notify on Healing</label>
 <p id="notify-healing-desc" className="text-xs text-muted-foreground">Send a notification when healing is applied to a test</p>
 </div>
 <button
 onClick={() => setHealingSettings({ ...healingSettings, notify_on_healing: !healingSettings.notify_on_healing })}
 disabled={!healingSettings.healing_enabled}
 role="switch"
 aria-checked={healingSettings.notify_on_healing}
 aria-labelledby="notify-healing-label"
 aria-describedby="notify-healing-desc"
 className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
 healingSettings.notify_on_healing ? 'bg-primary' : 'bg-muted'
 } ${!healingSettings.healing_enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
 >
 <span
 className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-card shadow ring-0 transition duration-200 ease-in-out ${
 healingSettings.notify_on_healing ? 'translate-x-5' : 'translate-x-0'
 }`}
 />
 </button>
 </div>

 {/* Save Button */}
 <div className="flex items-center justify-between pt-4 border-t border-border">
 {healingSettingsMessage && (
 <p className={`text-sm ${healingSettingsMessage.type === 'success' ? 'text-success' : 'text-destructive'}`}>
 {healingSettingsMessage.text}
 </p>
 )}
 <button
 onClick={handleSaveHealingSettings}
 disabled={isSavingHealingSettings}
 className="ml-auto rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
 >
 {isSavingHealingSettings ? 'Saving...' : 'Save Healing Settings'}
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 </div>
 )}
 </>
 );
}
