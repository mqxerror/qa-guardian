// Feature #81: Migrated to React Query for caching
// Feature #636: Adopt Modal component in page-level inline modals
import { useState, useEffect } from 'react';
import { Modal, ModalBody, ModalFooter } from '../components/ui/Modal';
import { PageHeader } from '../components/ui';
// Feature #728: EmptyState adoption
import { EmptyStates } from '../components/ui/EmptyState';
import { useAuthStore } from '../stores/authStore';
import { useTimezoneStore } from '../stores/timezoneStore';
import { Layout } from '../components/Layout';
import { Button } from '../components/ui/button';
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
        <PageHeader
          title="Team Members"
          description="Manage your organization's team members and their roles."
          breadcrumbs={[
            { label: 'Home', href: '/' },
            { label: 'Settings', href: '/settings' },
            { label: 'Team Members' }
          ]}
          actions={
            canManageMembers ? (
              <Button
                onClick={() => setShowInviteModal(true)}
              >
                Invite Member
              </Button>
            ) : undefined
          }
        />

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
                /* Feature #728: EmptyState preset adoption */
                <div className="px-6">{EmptyStates.noTeamMembers()}</div>
              ) : (
                members.map((member) => (
                  <div key={member.user_id} className="grid grid-cols-4 gap-4 border-b border-border px-6 py-4 last:border-0">
                  <div className="font-medium text-foreground">{member.name}</div>
                  <div className="text-muted-foreground">{member.email}</div>
                  <div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      member.role === 'owner' ? 'bg-accent/20 text-accent' :
                      member.role === 'admin' ? 'bg-primary/20 text-primary' :
                      member.role === 'developer' ? 'bg-success/20 text-success' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {member.role}
                    </span>
                  </div>
                  <div className="flex gap-3">
                    {canManageMembers && member.role !== 'owner' && (
                      <>
                        <Button
                          onClick={() => openEditRoleModal(member)}
                          variant="link"
                          size="sm"
                        >
                          Edit Role
                        </Button>
                        <Button
                          onClick={() => {
                            setMemberToRemove(member);
                            setShowRemoveModal(true);
                          }}
                          variant="link"
                          size="sm"
                          className="text-destructive"
                        >
                          Remove
                        </Button>
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
                      invitation.role === 'admin' ? 'bg-primary/20 text-primary' :
                      invitation.role === 'developer' ? 'bg-success/20 text-success' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {invitation.role}
                    </span>
                  </div>
                  <div>
                    <span className="rounded-full bg-warning/20 px-2 py-0.5 text-xs font-medium text-warning">
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
        <Modal
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          title="Invite Team Member"
          size="md"
        >
          <form id="invite-form" onSubmit={handleInvite} noValidate>
            <ModalBody>
              {inviteError && (
                <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive mb-4">
                  {inviteError}
                </div>
              )}
              {inviteSuccess && (
                <div className="rounded-md bg-success/10 p-3 text-sm text-success mb-4">
                  {inviteSuccess}
                </div>
              )}
              <div className="space-y-4">
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
              </div>
            </ModalBody>
            <ModalFooter>
              <Button
                type="button"
                onClick={() => setShowInviteModal(false)}
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isInviting}
              >
                {isInviting ? 'Sending...' : 'Send Invitation'}
              </Button>
            </ModalFooter>
          </form>
        </Modal>

        {/* Remove Member Modal */}
        <Modal
          isOpen={showRemoveModal && !!memberToRemove}
          onClose={() => {
            setShowRemoveModal(false);
            setMemberToRemove(null);
          }}
          title="Remove Team Member"
          size="md"
        >
          <ModalBody>
            {memberToRemove && (
              <p className="text-muted-foreground">
                Are you sure you want to remove <strong>{memberToRemove.name}</strong> ({memberToRemove.email}) from the organization? They will lose access to all projects immediately.
              </p>
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              type="button"
              onClick={() => {
                setShowRemoveModal(false);
                setMemberToRemove(null);
              }}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleRemoveMember}
              disabled={isRemoving}
              variant="destructive"
            >
              {isRemoving ? 'Removing...' : 'Remove'}
            </Button>
          </ModalFooter>
        </Modal>

        {/* Edit Role Modal */}
        <Modal
          isOpen={showEditRoleModal && !!memberToEdit}
          onClose={() => {
            setShowEditRoleModal(false);
            setMemberToEdit(null);
            setEditRoleError('');
          }}
          title="Edit Member Role"
          size="md"
        >
          <ModalBody>
            {memberToEdit && (
              <>
                <p className="text-muted-foreground">
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
              </>
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              type="button"
              onClick={() => {
                setShowEditRoleModal(false);
                setMemberToEdit(null);
                setEditRoleError('');
              }}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleUpdateRole}
              disabled={isUpdatingRole || !!(memberToEdit && newRole === memberToEdit.role)}
            >
              {isUpdatingRole ? 'Updating...' : 'Update Role'}
            </Button>
          </ModalFooter>
        </Modal>
      </div>
    </Layout>
  );
}

export default OrganizationMembersPage;
