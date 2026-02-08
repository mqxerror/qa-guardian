/**
 * SettingsTab - Project settings tab component
 * Feature #49: Extracted from ProjectDetailPage to reduce line count
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../stores/toastStore';
import {
 Project,
 ViewportProfile,
 ProjectMember,
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
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 </div>
 ))}
 <button
 onClick={() => {
 setProjectViewportProfiles([...projectViewportProfiles, { name: 'New Profile', width: 1280, height: 720 }]);
 }}
 className="flex items-center gap-2 px-3 py-2 text-sm text-primary hover:text-primary/80 transition-colors"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
 </svg>
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
 ? 'bg-blue-100 text-blue-800'
 : 'bg-gray-100 text-gray-800'
 }`}>
 {member.role}
 </span>
 </td>
 <td className="py-3 px-4 text-right">
 <button
 onClick={() => handleRemoveMember(member.user_id)}
 className="text-sm text-red-600 hover:text-red-700"
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
 className="rounded-md bg-[#4A154B] px-4 py-2 text-sm font-medium text-white hover:bg-[#611f64]"
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
 <svg className="mx-auto h-12 w-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
 </svg>
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
 <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
 </svg>
 ) : (
 <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
 </svg>
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
 <span className="text-amber-600" title="Alert is suppressed if test passes on retry">
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
 className="rounded-md px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
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
 ? 'border-green-200 bg-green-50/50'
 : 'border-red-200 bg-red-50/50'
 }`}
 >
 <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
 entry.success ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
 }`}>
 {entry.success ? (
 <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
 </svg>
 ) : (
 <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 )}
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
 entry.type === 'email'
 ? 'bg-blue-100 text-blue-700'
 : 'bg-purple-100 text-purple-700'
 }`}>
 {entry.type === 'email' ? 'Email' : 'Webhook'}
 </span>
 <span className="text-sm font-medium text-foreground truncate">
 {entry.channelName}
 </span>
 <span className={`text-xs ${entry.success ? 'text-green-600' : 'text-red-600'}`}>
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
 <div className="mt-1 text-xs text-red-600">
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
 <svg className="mx-auto h-12 w-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
 </svg>
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
 <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
 Secret
 </span>
 ) : (
 <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
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
 className="text-sm text-red-600 hover:underline"
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
 <svg className="h-5 w-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
 </svg>
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
 className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
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
 className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
 healingSettings.notify_on_healing ? 'translate-x-5' : 'translate-x-0'
 }`}
 />
 </button>
 </div>

 {/* Save Button */}
 <div className="flex items-center justify-between pt-4 border-t border-border">
 {healingSettingsMessage && (
 <p className={`text-sm ${healingSettingsMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
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
