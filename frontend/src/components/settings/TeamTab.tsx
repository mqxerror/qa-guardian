// TeamTab - Team member management
// Feature #451: Extracted from SettingsPage.tsx

import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useTimezoneStore } from '../../stores/timezoneStore';
import { toast } from '../../stores/toastStore';
import {
  useMembers,
  useInvitations,
  useSendInvitation,
  useCancelInvitation,
  useRemoveMember,
  useUpdateMemberRole,
  type Member,
} from '../../hooks/api/useSettings';

export function TeamTab() {
  const { user } = useAuthStore();
  const { formatDate } = useTimezoneStore();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'developer' | 'viewer'>('developer');
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
  const [showEditRoleModal, setShowEditRoleModal] = useState(false);
  const [memberToEdit, setMemberToEdit] = useState<Member | null>(null);
  const [newRole, setNewRole] = useState<'admin' | 'developer' | 'viewer'>('developer');
  const [editRoleError, setEditRoleError] = useState('');

  const canManageMembers = user?.role === 'owner' || user?.role === 'admin';

  // Feature #80: React Query hooks for team data
  const { data: members = [], isLoading: isLoadingMembers } = useMembers(1);
  const { data: pendingInvitations = [] } = useInvitations(1);
  const sendInvitationMutation = useSendInvitation(1);
  const cancelInvitationMutation = useCancelInvitation(1);
  const removeMemberMutation = useRemoveMember(1);
  const updateRoleMutation = useUpdateMemberRole(1);

  const isInviting = sendInvitationMutation.isPending;
  const isRemoving = removeMemberMutation.isPending;
  const isUpdatingRole = updateRoleMutation.isPending;

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

  // Feature #80: Handler functions using React Query mutations
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError('');
    setInviteSuccess('');

    try {
      await sendInvitationMutation.mutateAsync({ email: inviteEmail, role: inviteRole });
      setInviteSuccess(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
      setTimeout(() => {
        setShowInviteModal(false);
        setInviteSuccess('');
      }, 2000);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to send invitation');
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;

    try {
      await removeMemberMutation.mutateAsync(memberToRemove.user_id);
      toast.success(`${memberToRemove.name} has been removed from the team`);
      setShowRemoveModal(false);
      setMemberToRemove(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove member');
    }
  };

  const handleUpdateRole = async () => {
    if (!memberToEdit) return;
    setEditRoleError('');

    try {
      await updateRoleMutation.mutateAsync({ userId: memberToEdit.user_id, role: newRole });
      toast.success(`Role updated for ${memberToEdit.name}`);
      setShowEditRoleModal(false);
      setMemberToEdit(null);
    } catch (err) {
      setEditRoleError(err instanceof Error ? err.message : 'Failed to update role');
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      await cancelInvitationMutation.mutateAsync(invitationId);
      toast.success('Invitation cancelled');
    } catch (err) {
      toast.error('Failed to cancel invitation');
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-accent/10 text-accent';
      case 'admin': return 'bg-primary/10 text-primary';
      case 'developer': return 'bg-success/10 text-success';
      default: return 'bg-muted text-foreground';
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
                            className="text-sm text-destructive hover:underline"
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
                        className="text-sm text-destructive hover:underline"
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
            <form onSubmit={handleInvite} className="space-y-4" noValidate>
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
              {inviteError && <p className="text-sm text-destructive">{inviteError}</p>}
              {inviteSuccess && <p className="text-sm text-success">{inviteSuccess}</p>}
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
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 disabled:opacity-50"
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
            {editRoleError && <p className="text-sm text-destructive mb-4">{editRoleError}</p>}
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
