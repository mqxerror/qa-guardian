// Feature #81: Migrated to React Query for caching
import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useTimezoneStore } from '../stores/timezoneStore';
import { Layout } from '../components/Layout';
import { toast } from '../stores/toastStore';
import {
  useMembers,
  useInvitations,
  useSendInvitation,
  useRemoveMember,
  useUpdateMemberRole,
  type Member,
} from '../hooks/api/useSettings';

export function OrganizationMembersPage() {
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

  // Feature #81: React Query hooks for cached data
  const { data: members = [], isLoading: isLoadingMembers } = useMembers(1);
  const { data: pendingInvitations = [] } = useInvitations(1);
  const sendInvitationMutation = useSendInvitation(1);
  const removeMemberMutation = useRemoveMember(1);
  const updateRoleMutation = useUpdateMemberRole(1);

  const isInviting = sendInvitationMutation.isPending;
  const isRemoving = removeMemberMutation.isPending;
  const isUpdatingRole = updateRoleMutation.isPending;

  // Handle Escape key to close modals
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

  // Feature #81: Handler functions using React Query mutations
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
      setShowRemoveModal(false);
      setMemberToRemove(null);
      toast.success(`${memberToRemove.name} has been removed from the team`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove member');
    }
  };

  const handleUpdateRole = async () => {
    if (!memberToEdit) return;
    setEditRoleError('');

    try {
      await updateRoleMutation.mutateAsync({ userId: memberToEdit.user_id, role: newRole });
      setShowEditRoleModal(false);
      setMemberToEdit(null);
      toast.success(`Role updated to ${newRole} successfully!`);
    } catch (err) {
      setEditRoleError(err instanceof Error ? err.message : 'Failed to update role');
    }
  };

  const openEditRoleModal = (member: Member) => {
    setMemberToEdit(member);
    setNewRole(member.role as 'admin' | 'developer' | 'viewer');
    setEditRoleError('');
    setShowEditRoleModal(true);
  };

  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-foreground">Team Members</h2>
            <p className="mt-2 text-muted-foreground">
              Manage your organization's team members and their roles.
            </p>
          </div>
          {canManageMembers && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90"
            >
              Invite Member
            </button>
          )}
        </div>

        {/* Team members list */}
        <div className="mt-8">
          <div className="rounded-lg border border-border bg-card overflow-x-auto">
            <div className="min-w-[500px]">
              <div className="grid grid-cols-4 gap-4 border-b border-border bg-muted/30 px-6 py-3 text-sm font-medium text-muted-foreground">
                <div>Name</div>
                <div>Email</div>
                <div>Role</div>
                <div>Actions</div>
              </div>
              {isLoadingMembers ? (
                <div className="px-6 py-8 text-center text-muted-foreground">Loading members...</div>
              ) : members.length === 0 ? (
                <div className="px-6 py-8 text-center text-muted-foreground">No members found</div>
              ) : (
                members.map((member) => (
                  <div key={member.user_id} className="grid grid-cols-4 gap-4 border-b border-border px-6 py-4 last:border-0">
                  <div className="font-medium text-foreground">{member.name}</div>
                  <div className="text-muted-foreground">{member.email}</div>
                  <div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      member.role === 'owner' ? 'bg-purple-100 text-purple-700' :
                      member.role === 'admin' ? 'bg-blue-100 text-blue-700' :
                      member.role === 'developer' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {member.role}
                    </span>
                  </div>
                  <div className="flex gap-3">
                    {canManageMembers && member.role !== 'owner' && (
                      <>
                        <button
                          onClick={() => openEditRoleModal(member)}
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
                      </>
                    )}
                  </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Pending Invitations */}
        {canManageMembers && pendingInvitations.length > 0 && (
          <div className="mt-8">
            <h3 className="text-xl font-semibold text-foreground mb-4">Pending Invitations</h3>
            <div className="rounded-lg border border-border bg-card">
              <div className="grid grid-cols-4 gap-4 border-b border-border bg-muted/30 px-6 py-3 text-sm font-medium text-muted-foreground">
                <div>Email</div>
                <div>Role</div>
                <div>Status</div>
                <div>Sent</div>
              </div>
              {pendingInvitations.map((invitation) => (
                <div key={invitation.id} className="grid grid-cols-4 gap-4 border-b border-border px-6 py-4 last:border-0">
                  <div className="text-foreground">{invitation.email}</div>
                  <div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      invitation.role === 'admin' ? 'bg-blue-100 text-blue-700' :
                      invitation.role === 'developer' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {invitation.role}
                    </span>
                  </div>
                  <div>
                    <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                      {invitation.status}
                    </span>
                  </div>
                  <div className="text-muted-foreground text-sm">
                    {formatDate(invitation.created_at)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Invite Modal */}
        {showInviteModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={(e) => e.target === e.currentTarget && setShowInviteModal(false)}
          >
            <div role="dialog" aria-modal="true" aria-labelledby="invite-modal-title" className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
              <h3 id="invite-modal-title" className="text-lg font-semibold text-foreground">Invite Team Member</h3>
              <form onSubmit={handleInvite} className="mt-4 space-y-4">
                {inviteError && (
                  <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    {inviteError}
                  </div>
                )}
                {inviteSuccess && (
                  <div className="rounded-md bg-green-100 p-3 text-sm text-green-700">
                    {inviteSuccess}
                  </div>
                )}
                <div>
                  <label htmlFor="invite-email" className="mb-1 block text-sm font-medium text-foreground">
                    Email Address
                  </label>
                  <input
                    id="invite-email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@example.com"
                    required
                    autoComplete="email"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  />
                </div>
                <div>
                  <label htmlFor="invite-role" className="mb-1 block text-sm font-medium text-foreground">
                    Role
                  </label>
                  <select
                    id="invite-role"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as 'admin' | 'developer' | 'viewer')}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  >
                    <option value="admin">Admin</option>
                    <option value="developer">Developer</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="rounded-md border border-border px-4 py-2 font-medium text-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isInviting}
                    className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
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
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={(e) => e.target === e.currentTarget && setShowRemoveModal(false)}
          >
            <div role="dialog" aria-modal="true" aria-labelledby="remove-member-title" className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
              <h3 id="remove-member-title" className="text-lg font-semibold text-foreground">Remove Team Member</h3>
              <p className="mt-2 text-muted-foreground">
                Are you sure you want to remove <strong>{memberToRemove.name}</strong> ({memberToRemove.email}) from the organization? They will lose access to all projects immediately.
              </p>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowRemoveModal(false);
                    setMemberToRemove(null);
                  }}
                  className="rounded-md border border-border px-4 py-2 font-medium text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRemoveMember}
                  disabled={isRemoving}
                  className="rounded-md bg-destructive px-4 py-2 font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                >
                  {isRemoving ? 'Removing...' : 'Remove'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Role Modal */}
        {showEditRoleModal && memberToEdit && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={(e) => e.target === e.currentTarget && setShowEditRoleModal(false)}
          >
            <div role="dialog" aria-modal="true" aria-labelledby="edit-role-title" className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
              <h3 id="edit-role-title" className="text-lg font-semibold text-foreground">Edit Member Role</h3>
              <p className="mt-2 text-muted-foreground">
                Change the role for <strong>{memberToEdit.name}</strong> ({memberToEdit.email})
              </p>
              {editRoleError && (
                <div role="alert" className="mt-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {editRoleError}
                </div>
              )}
              <div className="mt-4">
                <label htmlFor="edit-role-select" className="mb-1 block text-sm font-medium text-foreground">
                  New Role
                </label>
                <select
                  id="edit-role-select"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as 'admin' | 'developer' | 'viewer')}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                >
                  {user?.role === 'owner' && <option value="admin">Admin</option>}
                  <option value="developer">Developer</option>
                  <option value="viewer">Viewer</option>
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  {newRole === 'admin' && 'Can manage users and all projects'}
                  {newRole === 'developer' && 'Can create and run tests'}
                  {newRole === 'viewer' && 'Can only view results'}
                </p>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditRoleModal(false);
                    setMemberToEdit(null);
                    setEditRoleError('');
                  }}
                  className="rounded-md border border-border px-4 py-2 font-medium text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdateRole}
                  disabled={isUpdatingRole || newRole === memberToEdit.role}
                  className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isUpdatingRole ? 'Updating...' : 'Update Role'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default OrganizationMembersPage;
