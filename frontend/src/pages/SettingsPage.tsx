// SettingsPage - Unified settings page with tabbed navigation
// Feature #1832: Consolidate Admin menu into single Settings page

import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuthStore } from '../stores/authStore';
import { useTimezoneStore } from '../stores/timezoneStore';
import { useThemeStore, Theme } from '../stores/themeStore';
import { useNotificationStore } from '../stores/notificationStore';
import { useTestDefaultsStore } from '../stores/testDefaultsStore';
import { useArtifactRetentionStore } from '../stores/artifactRetentionStore';
import { useOrganizationBrandingStore } from '../stores/organizationBrandingStore';
import { toast } from '../stores/toastStore';
import {
  useAIModelPreferencesStore,
  PROVIDERS,
  MODELS,
  TASK_TYPES,
  getModelsForProvider,
  type AIProvider,
  type AIModel,
  type AITaskType,
} from '../stores/aiModelPreferencesStore';

// Tab types for the settings page
type SettingsTab = 'team' | 'general' | 'ai-config' | 'billing' | 'api-keys' | 'webhooks' | 'audit-logs' | 'notifications';

// Tab configuration
const TABS: { id: SettingsTab; label: string; icon: React.ReactNode; requiredRole?: string[] }[] = [
  {
    id: 'team',
    label: 'Team',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    requiredRole: ['admin', 'owner']
  },
  {
    id: 'general',
    label: 'General',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    requiredRole: ['admin', 'owner']
  },
  {
    id: 'ai-config',
    label: 'AI Configuration',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    requiredRole: ['admin', 'owner']
  },
  {
    id: 'billing',
    label: 'Billing',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
    requiredRole: ['owner']
  },
  {
    id: 'api-keys',
    label: 'API Keys',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
      </svg>
    ),
    requiredRole: ['developer', 'admin', 'owner']
  },
  {
    id: 'webhooks',
    label: 'Webhooks',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
    requiredRole: ['admin', 'owner']
  },
  {
    id: 'audit-logs',
    label: 'Audit Logs',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    requiredRole: ['admin', 'owner']
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    )
  }
];

// ============== Team Tab Content ==============
interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
}

interface Member {
  id: string;
  user_id: string;
  organization_id: string;
  name: string;
  email: string;
  role: string;
}

function TeamTabContent() {
  const { user, token } = useAuthStore();
  const { formatDate } = useTimezoneStore();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'developer' | 'viewer'>('developer');
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [pendingInvitations, setPendingInvitations] = useState<Invitation[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [showEditRoleModal, setShowEditRoleModal] = useState(false);
  const [memberToEdit, setMemberToEdit] = useState<Member | null>(null);
  const [newRole, setNewRole] = useState<'admin' | 'developer' | 'viewer'>('developer');
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const [editRoleError, setEditRoleError] = useState('');

  const canManageMembers = user?.role === 'owner' || user?.role === 'admin';

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showInviteModal) setShowInviteModal(false);
        if (showRemoveModal) setShowRemoveModal(false);
        if (showEditRoleModal) setShowEditRoleModal(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showInviteModal, showRemoveModal, showEditRoleModal]);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const response = await fetch('/api/v1/organizations/1/members', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setMembers(data.members || []);
        }
      } catch (err) {
        console.error('Failed to fetch members:', err);
      } finally {
        setIsLoadingMembers(false);
      }
    };
    fetchMembers();
  }, [token]);

  useEffect(() => {
    const fetchInvitations = async () => {
      if (!canManageMembers) return;
      try {
        const response = await fetch('/api/v1/organizations/1/invitations', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setPendingInvitations(data.invitations || []);
        }
      } catch (err) {
        console.error('Failed to fetch invitations:', err);
      }
    };
    fetchInvitations();
  }, [token, canManageMembers]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError('');
    setInviteSuccess('');
    setIsInviting(true);

    try {
      const response = await fetch('/api/v1/organizations/1/invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to send invitation');
      }

      const data = await response.json();
      setInviteSuccess(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
      if (data.invitation) {
        setPendingInvitations(prev => [...prev, data.invitation]);
      }
      setTimeout(() => {
        setShowInviteModal(false);
        setInviteSuccess('');
      }, 2000);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;
    setIsRemoving(true);

    try {
      const response = await fetch(`/api/v1/organizations/1/members/${memberToRemove.user_id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        setMembers(members.filter(m => m.user_id !== memberToRemove.user_id));
        toast.success(`${memberToRemove.name} has been removed from the team`);
        setShowRemoveModal(false);
        setMemberToRemove(null);
      } else {
        const data = await response.json();
        toast.error(data.message || 'Failed to remove member');
      }
    } catch (err) {
      toast.error('Failed to remove member');
    } finally {
      setIsRemoving(false);
    }
  };

  const handleUpdateRole = async () => {
    if (!memberToEdit) return;
    setIsUpdatingRole(true);
    setEditRoleError('');

    try {
      const response = await fetch(`/api/v1/organizations/1/members/${memberToEdit.user_id}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (response.ok) {
        setMembers(members.map(m =>
          m.user_id === memberToEdit.user_id ? { ...m, role: newRole } : m
        ));
        toast.success(`Role updated for ${memberToEdit.name}`);
        setShowEditRoleModal(false);
        setMemberToEdit(null);
      } else {
        const data = await response.json();
        setEditRoleError(data.message || 'Failed to update role');
      }
    } catch (err) {
      setEditRoleError('Failed to update role');
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      const response = await fetch(`/api/v1/organizations/1/invitations/${invitationId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        setPendingInvitations(pendingInvitations.filter(inv => inv.id !== invitationId));
        toast.success('Invitation cancelled');
      } else {
        toast.error('Failed to cancel invitation');
      }
    } catch (err) {
      toast.error('Failed to cancel invitation');
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'admin': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'developer': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Team Members</h3>
          <p className="text-sm text-muted-foreground">Manage your organization's team members and their roles.</p>
        </div>
        {canManageMembers && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Invite Member
          </button>
        )}
      </div>

      {/* Members Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Member</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Role</th>
              {canManageMembers && (
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoadingMembers ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">Loading members...</td>
              </tr>
            ) : members.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">No team members found</td>
              </tr>
            ) : (
              members.map(member => (
                <tr key={member.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium text-foreground">{member.name}</div>
                      <div className="text-sm text-muted-foreground">{member.email}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(member.role)}`}>
                      {member.role}
                    </span>
                  </td>
                  {canManageMembers && (
                    <td className="px-4 py-3 text-right">
                      {member.role !== 'owner' && member.user_id !== user?.id && (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setMemberToEdit(member);
                              setNewRole(member.role as 'admin' | 'developer' | 'viewer');
                              setShowEditRoleModal(true);
                            }}
                            className="text-sm text-primary hover:underline"
                          >
                            Edit Role
                          </button>
                          <button
                            onClick={() => {
                              setMemberToRemove(member);
                              setShowRemoveModal(true);
                            }}
                            className="text-sm text-red-600 hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pending Invitations */}
      {canManageMembers && pendingInvitations.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-md font-medium text-foreground">Pending Invitations</h4>
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Sent</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pendingInvitations.map(inv => (
                  <tr key={inv.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3 text-foreground">{inv.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(inv.role)}`}>
                        {inv.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(inv.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleCancelInvitation(inv.id)}
                        className="text-sm text-red-600 hover:underline"
                      >
                        Cancel
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowInviteModal(false)}>
          <div className="bg-card rounded-lg p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-foreground mb-4">Invite Team Member</h3>
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Email</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'admin' | 'developer' | 'viewer')}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                >
                  <option value="viewer">Viewer - Can view tests and results</option>
                  <option value="developer">Developer - Can create and run tests</option>
                  <option value="admin">Admin - Can manage team and settings</option>
                </select>
              </div>
              {inviteError && <p className="text-sm text-red-600">{inviteError}</p>}
              {inviteSuccess && <p className="text-sm text-green-600">{inviteSuccess}</p>}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isInviting}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
                >
                  {isInviting ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove Member Modal */}
      {showRemoveModal && memberToRemove && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowRemoveModal(false)}>
          <div className="bg-card rounded-lg p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-foreground mb-4">Remove Team Member</h3>
            <p className="text-muted-foreground mb-4">
              Are you sure you want to remove <strong>{memberToRemove.name}</strong> from the team?
              They will lose access to all organization resources.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowRemoveModal(false)}
                className="px-4 py-2 text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleRemoveMember}
                disabled={isRemoving}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {isRemoving ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {showEditRoleModal && memberToEdit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowEditRoleModal(false)}>
          <div className="bg-card rounded-lg p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-foreground mb-4">Edit Member Role</h3>
            <p className="text-muted-foreground mb-4">
              Change role for <strong>{memberToEdit.name}</strong>
            </p>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as 'admin' | 'developer' | 'viewer')}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground mb-4"
            >
              <option value="viewer">Viewer</option>
              <option value="developer">Developer</option>
              <option value="admin">Admin</option>
            </select>
            {editRoleError && <p className="text-sm text-red-600 mb-4">{editRoleError}</p>}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowEditRoleModal(false)}
                className="px-4 py-2 text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateRole}
                disabled={isUpdatingRole}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
              >
                {isUpdatingRole ? 'Updating...' : 'Update Role'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============== General Settings Tab Content ==============
function GeneralTabContent() {
  const { user } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const { formatDate } = useTimezoneStore();
  const { defaults, setAllDefaults } = useTestDefaultsStore();
  const { settings, setRetentionDays } = useArtifactRetentionStore();
  // Feature #1995: Organization branding for PDF exports
  const { logoBase64, organizationName, setLogo, setOrganizationName } = useOrganizationBrandingStore();

  const [orgName, setOrgName] = useState(organizationName || 'Default Organization');
  const [isSaving, setIsSaving] = useState(false);

  // Feature #1995: Handle logo upload
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
      if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
      if (!allowedTypes.includes(file.type)) { toast.error('Please use PNG, JPG, GIF, or WebP'); return; }
      if (file.size > 2 * 1024 * 1024) { toast.error('File too large. Maximum allowed size is 2MB.'); return; }

      // Convert to base64 for persistence and PDF embedding
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setLogo(base64);
        toast.success('Logo uploaded successfully! It will appear in PDF exports.');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    setLogo(null);
    toast.success('Logo removed');
  };

  const handleSaveOrgSettings = async () => {
    setIsSaving(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    // Feature #1995: Save organization name to branding store
    setOrganizationName(orgName);
    toast.success('Organization settings saved');
    setIsSaving(false);
  };

  return (
    <div className="space-y-8">
      {/* Organization Settings */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Organization Settings</h3>
          <p className="text-sm text-muted-foreground">General settings for your organization.</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Organization Name</label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="w-full max-w-md px-3 py-2 border border-border rounded-md bg-background text-foreground"
            />
          </div>

          {/* Feature #1995: Organization Logo Upload for PDF Branding */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Organization Logo</label>
            <p className="text-xs text-muted-foreground mb-2">This logo will appear in PDF report exports.</p>
            <div className="flex items-center gap-4">
              {logoBase64 ? (
                <div className="relative">
                  <img src={logoBase64} alt="Organization logo" className="h-16 w-16 rounded-lg object-cover border border-border" />
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="absolute -top-2 -right-2 rounded-full bg-destructive p-1 text-white hover:bg-destructive/90"
                    aria-label="Remove logo"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
              <div>
                <label htmlFor="logo-upload" className="cursor-pointer rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                  {logoBase64 ? 'Change Logo' : 'Upload Logo'}
                </label>
                <input id="logo-upload" type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                <p className="mt-1 text-xs text-muted-foreground">PNG, JPG, GIF up to 2MB</p>
              </div>
            </div>
          </div>

          <button
            onClick={handleSaveOrgSettings}
            disabled={isSaving}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Theme Settings */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Appearance</h3>
          <p className="text-sm text-muted-foreground">Customize how QA Guardian looks.</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-6">
          <div className="flex gap-4">
            {(['light', 'dark', 'system'] as Theme[]).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`flex-1 p-4 rounded-lg border-2 transition-colors ${
                  theme === t
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-muted-foreground'
                }`}
              >
                <div className="text-center">
                  <div className="text-2xl mb-2">
                    {t === 'light' ? '☀️' : t === 'dark' ? '🌙' : '💻'}
                  </div>
                  <div className="text-sm font-medium capitalize text-foreground">{t}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Test Defaults */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Test Defaults</h3>
          <p className="text-sm text-muted-foreground">Default settings for new tests.</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Default Browser</label>
              <select
                value={defaults.defaultBrowser}
                onChange={(e) => setAllDefaults({ defaultBrowser: e.target.value as 'chromium' | 'firefox' | 'webkit' })}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
              >
                <option value="chromium">Chromium</option>
                <option value="firefox">Firefox</option>
                <option value="webkit">WebKit</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Default Timeout (ms)</label>
              <input
                type="number"
                value={defaults.defaultTimeout}
                onChange={(e) => setAllDefaults({ defaultTimeout: parseInt(e.target.value) || 30000 })}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Default Retries</label>
            <input
              type="number"
              value={defaults.defaultRetries}
              onChange={(e) => setAllDefaults({ defaultRetries: parseInt(e.target.value) || 0 })}
              min={0}
              max={5}
              className="w-full max-w-xs px-3 py-2 border border-border rounded-md bg-background text-foreground"
            />
            <p className="text-xs text-muted-foreground mt-1">Number of times to retry failed tests.</p>
          </div>
        </div>
      </div>

      {/* Artifact Retention */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Data Retention</h3>
          <p className="text-sm text-muted-foreground">How long to keep test artifacts.</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-6">
          <div className="max-w-md">
            <label className="block text-sm font-medium text-foreground mb-1">Artifact Retention (days)</label>
            <input
              type="number"
              value={settings.retentionDays}
              onChange={(e) => setRetentionDays(parseInt(e.target.value) || 30)}
              min={1}
              max={365}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Screenshots, videos, and traces will be automatically deleted after this period.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============== Billing Tab Content ==============
function BillingTabContent() {
  const [currentPlan] = useState('Pro');
  const [billingCycle] = useState('Monthly');
  const [nextBilling] = useState('2026-02-25');

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <div className="bg-card rounded-lg border border-border p-6">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Current Plan</h3>
            <p className="text-2xl font-bold text-primary mt-2">{currentPlan}</p>
            <p className="text-sm text-muted-foreground mt-1">Billed {billingCycle.toLowerCase()}</p>
          </div>
          <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
            Upgrade Plan
          </button>
        </div>
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground">
            Next billing date: <span className="text-foreground font-medium">{nextBilling}</span>
          </p>
        </div>
      </div>

      {/* Usage */}
      <div className="bg-card rounded-lg border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Usage This Month</h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Test Runs</span>
              <span className="text-foreground font-medium">245 / 1,000</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div className="bg-primary h-2 rounded-full" style={{ width: '24.5%' }}></div>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Storage Used</span>
              <span className="text-foreground font-medium">2.3 GB / 10 GB</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div className="bg-primary h-2 rounded-full" style={{ width: '23%' }}></div>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Team Members</span>
              <span className="text-foreground font-medium">5 / 10</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div className="bg-primary h-2 rounded-full" style={{ width: '50%' }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Method */}
      <div className="bg-card rounded-lg border border-border p-6">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Payment Method</h3>
            <p className="text-sm text-muted-foreground mt-1">•••• •••• •••• 4242</p>
            <p className="text-xs text-muted-foreground">Expires 12/2028</p>
          </div>
          <button className="text-primary hover:underline text-sm">Update</button>
        </div>
      </div>

      {/* Billing History */}
      <div className="bg-card rounded-lg border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Billing History</h3>
        <div className="space-y-3">
          {[
            { date: '2026-01-25', amount: '$49.00', status: 'Paid' },
            { date: '2025-12-25', amount: '$49.00', status: 'Paid' },
            { date: '2025-11-25', amount: '$49.00', status: 'Paid' },
          ].map((invoice, idx) => (
            <div key={idx} className="flex justify-between items-center py-2 border-b border-border last:border-0">
              <div>
                <p className="text-sm text-foreground">{invoice.date}</p>
                <p className="text-xs text-muted-foreground">{invoice.amount}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-green-600">{invoice.status}</span>
                <button className="text-primary hover:underline text-xs">Download</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============== API Keys Tab Content ==============
interface ApiKey {
  id: string;
  name: string;
  key?: string;
  key_prefix: string;
  scopes: string[];
  expires_at: string | null;
  created_at: string;
}

function ApiKeysTabContent() {
  const { user, token } = useAuthStore();
  const { formatDate } = useTimezoneStore();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(['read']);
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<ApiKey | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);

  useEffect(() => {
    const fetchApiKeys = async () => {
      try {
        const response = await fetch(`/api/v1/organizations/${user?.organization_id}/api-keys`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setApiKeys(data.api_keys || []);
        }
      } catch (err) {
        console.error('Failed to fetch API keys:', err);
      } finally {
        setIsLoading(false);
      }
    };
    if (user?.organization_id) {
      fetchApiKeys();
    }
  }, [token, user?.organization_id]);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setIsCreating(true);

    try {
      const response = await fetch(`/api/v1/organizations/${user?.organization_id}/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newKeyName, scopes: newKeyScopes }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to create API key');
      }

      const data = await response.json();
      setCreatedKey(data.api_key);
      setApiKeys(prev => [...prev, data.api_key]);
      setNewKeyName('');
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create API key');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) return;

    try {
      const response = await fetch(`/api/v1/organizations/${user?.organization_id}/api-keys/${keyId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        setApiKeys(apiKeys.filter(k => k.id !== keyId));
        toast.success('API key revoked');
      } else {
        toast.error('Failed to revoke API key');
      }
    } catch (err) {
      toast.error('Failed to revoke API key');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-foreground">API Keys</h3>
          <p className="text-sm text-muted-foreground">Manage API keys for programmatic access.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Create API Key
        </button>
      </div>

      {/* Keys Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Key</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Scopes</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Created</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading...</td>
              </tr>
            ) : apiKeys.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No API keys created yet</td>
              </tr>
            ) : (
              apiKeys.map(key => (
                <tr key={key.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3 text-foreground font-medium">{key.name}</td>
                  <td className="px-4 py-3 font-mono text-sm text-muted-foreground">{key.key_prefix}...</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {key.scopes.map(scope => (
                        <span key={scope} className="px-2 py-0.5 bg-muted rounded text-xs text-muted-foreground">
                          {scope}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(key.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleRevokeKey(key.id)}
                      className="text-sm text-red-600 hover:underline"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => {
          if (!createdKey) setShowCreateModal(false);
        }}>
          <div className="bg-card rounded-lg p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            {createdKey ? (
              <>
                <h3 className="text-lg font-semibold text-foreground mb-4">API Key Created</h3>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-4 mb-4">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
                    ⚠️ Make sure to copy your API key now. You won't be able to see it again!
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-background p-2 rounded text-xs font-mono break-all text-foreground">
                      {createdKey.key}
                    </code>
                    <button
                      onClick={() => copyToClipboard(createdKey.key!)}
                      className="px-3 py-2 bg-primary text-primary-foreground rounded text-sm"
                    >
                      {keyCopied ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setCreatedKey(null);
                    setShowCreateModal(false);
                  }}
                  className="w-full px-4 py-2 bg-muted text-foreground rounded-md hover:bg-muted/80"
                >
                  Done
                </button>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-foreground mb-4">Create API Key</h3>
                <form onSubmit={handleCreateKey} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Name</label>
                    <input
                      type="text"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="My API Key"
                      className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Scopes</label>
                    <div className="space-y-2">
                      {['read', 'write', 'execute', 'admin'].map(scope => (
                        <label key={scope} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={newKeyScopes.includes(scope)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewKeyScopes([...newKeyScopes, scope]);
                              } else {
                                setNewKeyScopes(newKeyScopes.filter(s => s !== scope));
                              }
                            }}
                            className="rounded border-border"
                          />
                          <span className="text-sm text-foreground capitalize">{scope}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  {createError && <p className="text-sm text-red-600">{createError}</p>}
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="px-4 py-2 text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isCreating}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
                    >
                      {isCreating ? 'Creating...' : 'Create Key'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============== Webhooks Tab Content ==============
interface Webhook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  created_at: string;
}

function WebhooksTabContent() {
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
                    <span className={`w-2 h-2 rounded-full ${webhook.active ? 'bg-green-500' : 'bg-gray-400'}`}></span>
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
                    className="text-sm text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreateModal(false)}>
          <div className="bg-card rounded-lg p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-foreground mb-4">Add Webhook</h3>
            <form onSubmit={handleCreateWebhook} className="space-y-4">
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
              {createError && <p className="text-sm text-red-600">{createError}</p>}
              <div className="flex justify-end gap-3">
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
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ============== Audit Logs Tab Content ==============
interface AuditLogEntry {
  id: string;
  user_id: string;
  user_email: string;
  action: string;
  resource_type: string;
  resource_id: string;
  resource_name?: string;
  details?: Record<string, unknown>;
  ip_address: string;
  created_at: string;
}

function AuditLogsTabContent() {
  const { user, token } = useAuthStore();
  const { formatDate } = useTimezoneStore();
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [filterAction, setFilterAction] = useState('');
  const [filterResourceType, setFilterResourceType] = useState('');
  const [availableActions, setAvailableActions] = useState<string[]>([]);
  const [availableResourceTypes, setAvailableResourceTypes] = useState<string[]>([]);
  const [limit, setLimit] = useState(20);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  useEffect(() => {
    const fetchAuditLogs = async () => {
      if (!user?.organization_id) return;

      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          limit: String(limit),
          offset: String(offset),
        });
        if (filterAction) params.append('action', filterAction);
        if (filterResourceType) params.append('resource_type', filterResourceType);

        const response = await fetch(
          `/api/v1/organizations/${user.organization_id}/audit-logs?${params}`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );

        if (response.ok) {
          const data = await response.json();
          setAuditLogs(data.logs || []);
          setTotal(data.total || 0);
        }
      } catch (err) {
        console.error('Failed to fetch audit logs:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAuditLogs();
  }, [token, user?.organization_id, offset, filterAction, filterResourceType, limit]);

  useEffect(() => {
    const fetchFilterOptions = async () => {
      if (!user?.organization_id) return;

      try {
        const [actionsRes, typesRes] = await Promise.all([
          fetch(`/api/v1/organizations/${user.organization_id}/audit-logs/actions`, {
            headers: { 'Authorization': `Bearer ${token}` },
          }),
          fetch(`/api/v1/organizations/${user.organization_id}/audit-logs/resource-types`, {
            headers: { 'Authorization': `Bearer ${token}` },
          }),
        ]);

        if (actionsRes.ok) {
          const data = await actionsRes.json();
          setAvailableActions(data.actions || []);
        }
        if (typesRes.ok) {
          const data = await typesRes.json();
          setAvailableResourceTypes(data.resource_types || []);
        }
      } catch (err) {
        console.error('Failed to fetch filter options:', err);
      }
    };

    fetchFilterOptions();
  }, [token, user?.organization_id]);

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="space-y-6">
      {/* Header and Filters */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Audit Logs</h3>
          <p className="text-sm text-muted-foreground">Track all actions in your organization.</p>
        </div>
        <div className="flex gap-3">
          <select
            value={filterAction}
            onChange={(e) => { setFilterAction(e.target.value); setOffset(0); }}
            className="px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm"
          >
            <option value="">All actions</option>
            {availableActions.map(action => (
              <option key={action} value={action}>{action}</option>
            ))}
          </select>
          <select
            value={filterResourceType}
            onChange={(e) => { setFilterResourceType(e.target.value); setOffset(0); }}
            className="px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm"
          >
            <option value="">All types</option>
            {availableResourceTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Timestamp</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">User</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Action</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Resource</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">IP Address</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading...</td>
              </tr>
            ) : auditLogs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No audit logs found</td>
              </tr>
            ) : (
              auditLogs.map(log => (
                <>
                  <tr key={log.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(log.created_at)}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{log.user_email}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-medium">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {log.resource_type}{log.resource_name ? `: ${log.resource_name}` : ''}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground font-mono">{log.ip_address}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                        className="text-sm text-primary hover:underline"
                      >
                        {expandedLog === log.id ? 'Hide' : 'View details'}
                      </button>
                    </td>
                  </tr>
                  {expandedLog === log.id && log.details && (
                    <tr>
                      <td colSpan={6} className="px-4 py-3 bg-muted/30">
                        <pre className="text-xs text-muted-foreground overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center text-sm">
        <div className="text-muted-foreground">
          Showing {offset + 1} to {Math.min(offset + limit, total)} of {total} entries
        </div>
        <div className="flex items-center gap-2">
          <select
            value={limit}
            onChange={(e) => { setLimit(Number(e.target.value)); setOffset(0); }}
            className="px-2 py-1 border border-border rounded bg-background text-foreground text-sm"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <button
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0}
            className="px-3 py-1 border border-border rounded bg-background text-foreground disabled:opacity-50"
          >
            Prev
          </button>
          <span className="text-muted-foreground">Page {currentPage} of {totalPages}</span>
          <button
            onClick={() => setOffset(offset + limit)}
            disabled={offset + limit >= total}
            className="px-3 py-1 border border-border rounded bg-background text-foreground disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

// ============== Notifications Tab Content ==============
function NotificationsTabContent() {
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

// ============== AI Configuration Tab Content ==============
// Feature #2074: AI Model Selection for Different Tasks
function AIConfigurationTabContent() {
  const {
    preferences,
    defaultProvider,
    defaultModel,
    setTaskPreference,
    setDefaultProvider,
    setDefaultModel,
    resetToDefaults,
  } = useAIModelPreferencesStore();

  const [aiStatus, setAiStatus] = useState<{
    kie: { available: boolean; model?: string };
    anthropic: { available: boolean; model?: string };
  } | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const { token } = useAuthStore();

  // Fetch AI provider status
  useEffect(() => {
    const fetchAIStatus = async () => {
      try {
        const response = await fetch('/api/v1/mcp/status', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setAiStatus({
            kie: { available: data.kie_available ?? false, model: data.kie_model },
            anthropic: { available: data.anthropic_available ?? false, model: data.anthropic_model },
          });
        }
      } catch (err) {
        console.error('Failed to fetch AI status:', err);
      } finally {
        setIsLoadingStatus(false);
      }
    };
    fetchAIStatus();
  }, [token]);

  const getCostBadge = (cost: 'low' | 'medium' | 'high') => {
    switch (cost) {
      case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'high': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    }
  };

  const getSpeedBadge = (speed: 'fast' | 'medium' | 'slow') => {
    switch (speed) {
      case 'fast': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'medium': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'slow': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <div className="space-y-8">
      {/* AI Provider Status */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">AI Provider Status</h3>
          <p className="text-sm text-muted-foreground">Current availability of AI providers.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Kie.ai Status */}
          <div className="bg-card rounded-lg border border-border p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${aiStatus?.kie.available ? 'bg-green-500' : 'bg-red-500'}`}></span>
                <h4 className="font-medium text-foreground">Kie.ai</h4>
              </div>
              <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                70% Savings
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              {isLoadingStatus ? 'Checking...' : aiStatus?.kie.available ? 'Connected and ready' : 'Not configured'}
            </p>
            {aiStatus?.kie.model && (
              <p className="text-xs text-muted-foreground">Model: {aiStatus.kie.model}</p>
            )}
          </div>

          {/* Anthropic Status */}
          <div className="bg-card rounded-lg border border-border p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${aiStatus?.anthropic.available ? 'bg-green-500' : 'bg-red-500'}`}></span>
                <h4 className="font-medium text-foreground">Anthropic (Direct)</h4>
              </div>
              <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                Fallback
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              {isLoadingStatus ? 'Checking...' : aiStatus?.anthropic.available ? 'Connected and ready' : 'Not configured'}
            </p>
            {aiStatus?.anthropic.model && (
              <p className="text-xs text-muted-foreground">Model: {aiStatus.anthropic.model}</p>
            )}
          </div>
        </div>
      </div>

      {/* Default Settings */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Default AI Settings</h3>
          <p className="text-sm text-muted-foreground">These settings are used when a task is set to "Auto".</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Default Provider</label>
              <select
                value={defaultProvider}
                onChange={(e) => setDefaultProvider(e.target.value as AIProvider)}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
              >
                {PROVIDERS.filter(p => p.id !== 'auto').map(provider => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                {PROVIDERS.find(p => p.id === defaultProvider)?.description}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Default Model</label>
              <select
                value={defaultModel}
                onChange={(e) => setDefaultModel(e.target.value as AIModel)}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
              >
                {getModelsForProvider(defaultProvider).filter(m => m.id !== 'auto').map(model => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                {MODELS.find(m => m.id === defaultModel)?.description}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Task-Specific Settings */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Task-Specific Model Selection</h3>
            <p className="text-sm text-muted-foreground">Choose which AI model to use for different tasks.</p>
          </div>
          <button
            onClick={resetToDefaults}
            className="text-sm text-primary hover:underline"
          >
            Reset to defaults
          </button>
        </div>

        <div className="space-y-4">
          {TASK_TYPES.map(taskType => {
            const pref = preferences[taskType.id];
            const availableModels = pref.provider === 'auto'
              ? MODELS
              : getModelsForProvider(pref.provider);

            return (
              <div key={taskType.id} className="bg-card rounded-lg border border-border p-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  {/* Task Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-foreground">{taskType.name}</h4>
                      {pref.provider === 'auto' && pref.model === 'auto' && (
                        <span className="px-2 py-0.5 rounded text-xs bg-primary/10 text-primary">
                          Auto
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{taskType.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Recommended: {MODELS.find(m => m.id === taskType.recommendedModel)?.name} via {PROVIDERS.find(p => p.id === taskType.recommendedProvider)?.name}
                    </p>
                  </div>

                  {/* Provider Selector */}
                  <div className="w-full lg:w-48">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Provider</label>
                    <select
                      value={pref.provider}
                      onChange={(e) => setTaskPreference(taskType.id, {
                        ...pref,
                        provider: e.target.value as AIProvider,
                        // Reset model to auto when changing provider
                        model: 'auto',
                      })}
                      className="w-full px-2 py-1.5 border border-border rounded-md bg-background text-foreground text-sm"
                    >
                      {PROVIDERS.map(provider => (
                        <option key={provider.id} value={provider.id}>
                          {provider.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Model Selector */}
                  <div className="w-full lg:w-56">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Model</label>
                    <select
                      value={pref.model}
                      onChange={(e) => setTaskPreference(taskType.id, {
                        ...pref,
                        model: e.target.value as AIModel,
                      })}
                      className="w-full px-2 py-1.5 border border-border rounded-md bg-background text-foreground text-sm"
                    >
                      {availableModels.map(model => (
                        <option key={model.id} value={model.id}>
                          {model.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Model Info (when not auto) */}
                {pref.model !== 'auto' && (
                  <div className="mt-3 pt-3 border-t border-border">
                    {(() => {
                      const modelInfo = MODELS.find(m => m.id === pref.model);
                      if (!modelInfo) return null;
                      return (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-xs ${getCostBadge(modelInfo.costIndicator)}`}>
                            {modelInfo.costIndicator === 'low' ? '$' : modelInfo.costIndicator === 'medium' ? '$$' : '$$$'} Cost
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs ${getSpeedBadge(modelInfo.speedIndicator)}`}>
                            {modelInfo.speedIndicator.charAt(0).toUpperCase() + modelInfo.speedIndicator.slice(1)} Speed
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {modelInfo.capabilities.slice(0, 3).join(', ')}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Model Reference */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Available Models</h3>
          <p className="text-sm text-muted-foreground">Reference guide for all available AI models.</p>
        </div>
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Model</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Providers</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Cost</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Speed</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase hidden md:table-cell">Capabilities</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {MODELS.filter(m => m.id !== 'auto').map(model => (
                <tr key={model.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{model.name}</div>
                    <div className="text-xs text-muted-foreground">{model.description}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {model.providers.filter(p => p !== 'auto').map(provider => (
                        <span key={provider} className="px-2 py-0.5 bg-muted rounded text-xs text-muted-foreground capitalize">
                          {provider}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${getCostBadge(model.costIndicator)}`}>
                      {model.costIndicator === 'low' ? 'Low' : model.costIndicator === 'medium' ? 'Medium' : 'High'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${getSpeedBadge(model.speedIndicator)}`}>
                      {model.speedIndicator.charAt(0).toUpperCase() + model.speedIndicator.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="text-xs text-muted-foreground">
                      {model.capabilities.join(', ')}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============== Main Settings Page Component ==============
export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Get active tab from URL or default to 'team'
  const activeTab = (searchParams.get('tab') as SettingsTab) || 'team';

  // Filter tabs based on user role
  const visibleTabs = TABS.filter(tab => {
    if (!tab.requiredRole) return true;
    return tab.requiredRole.includes(user?.role || '');
  });

  // Set active tab in URL
  const setActiveTab = (tab: SettingsTab) => {
    setSearchParams({ tab });
  };

  // If current tab is not visible for user's role, redirect to first visible tab
  useEffect(() => {
    const tabIsVisible = visibleTabs.some(t => t.id === activeTab);
    if (!tabIsVisible && visibleTabs.length > 0) {
      setSearchParams({ tab: visibleTabs[0].id });
    }
  }, [activeTab, visibleTabs, setSearchParams]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'team':
        return <TeamTabContent />;
      case 'general':
        return <GeneralTabContent />;
      case 'ai-config':
        return <AIConfigurationTabContent />;
      case 'billing':
        return <BillingTabContent />;
      case 'api-keys':
        return <ApiKeysTabContent />;
      case 'webhooks':
        return <WebhooksTabContent />;
      case 'audit-logs':
        return <AuditLogsTabContent />;
      case 'notifications':
        return <NotificationsTabContent />;
      default:
        return <GeneralTabContent />;
    }
  };

  return (
    <Layout>
      <div className="p-6">
        {/* Page Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground">Settings</h2>
          <p className="text-muted-foreground">Manage your organization settings and preferences.</p>
        </div>

        {/* Tabs Navigation */}
        <div className="border-b border-border mb-6">
          <nav className="flex gap-1 -mb-px overflow-x-auto">
            {visibleTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="min-h-[400px]">
          {renderTabContent()}
        </div>
      </div>
    </Layout>
  );
}
