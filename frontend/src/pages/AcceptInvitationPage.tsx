// Feature #1357: Extracted AcceptInvitationPage for code quality compliance (400 line limit)
// Feature #690: Migrated from raw fetch to React Query hooks
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useInvitation, useAcceptInvitation } from '../hooks/api/useOrganization';
import { X, Check, Mail, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function AcceptInvitationPage() {
  const { inviteId } = useParams<{ inviteId: string }>();
  const navigate = useNavigate();
  const { token, isAuthenticated, user } = useAuthStore();
  const [success, setSuccess] = useState(false);

  // Feature #690: Use React Query hooks for data fetching
  const { data: invitation, isLoading, error: fetchError } = useInvitation(inviteId);
  const acceptMutation = useAcceptInvitation();

  const handleAccept = async () => {
    if (!inviteId || !token) return;

    try {
      await acceptMutation.mutateAsync(inviteId);
      setSuccess(true);
      // Navigate to dashboard after a short delay
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch {
      // Error is handled by mutation state
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        <p className="mt-4 text-muted-foreground">Loading invitation...</p>
      </div>
    );
  }

  if (fetchError && !invitation) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <div className="w-full max-w-md rounded-lg border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <X className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Invalid Invitation</h1>
          <p className="mt-2 text-muted-foreground">{fetchError.message}</p>
          <Link
            to="/"
            className="mt-6 inline-block rounded-md bg-primary px-6 py-2 font-medium text-primary-foreground hover:bg-primary/90"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <div className="w-full max-w-md rounded-lg border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/20">
            <Check className="h-8 w-8 text-success" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Welcome!</h1>
          <p className="mt-2 text-muted-foreground">
            You've successfully joined <span className="font-semibold">{invitation?.organization?.name}</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  // User needs to log in first
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <div className="w-full max-w-md rounded-lg border bg-card p-8 shadow-sm">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">You're Invited!</h1>
            <p className="mt-2 text-muted-foreground">
              You've been invited to join <span className="font-semibold">{invitation?.organization?.name}</span> as a <span className="font-semibold">{invitation?.role}</span>.
            </p>
          </div>

          <div className="mt-6 rounded-lg bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">
              This invitation was sent to: <span className="font-medium text-foreground">{invitation?.email}</span>
            </p>
          </div>

          <div className="mt-6 space-y-3">
            <p className="text-center text-sm text-muted-foreground">
              Please log in or create an account to accept this invitation.
            </p>
            <Link
              to={`/login?redirect=/invitations/${inviteId}`}
              className="block w-full rounded-md bg-primary py-3 text-center font-medium text-primary-foreground hover:bg-primary/90"
            >
              Log In
            </Link>
            <Link
              to={`/register?redirect=/invitations/${inviteId}&email=${encodeURIComponent(invitation?.email || '')}`}
              className="block w-full rounded-md border border-input bg-background py-3 text-center font-medium text-foreground hover:bg-muted"
            >
              Create Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Check if logged in user's email matches invitation
  const emailMismatch = user?.email?.toLowerCase() !== invitation?.email?.toLowerCase();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-md rounded-lg border bg-card p-8 shadow-sm">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Join {invitation?.organization?.name}</h1>
          <p className="mt-2 text-muted-foreground">
            You've been invited to join as a <span className="font-semibold capitalize">{invitation?.role}</span>.
          </p>
        </div>

        <div className="mt-6 space-y-4">
          <div className="rounded-lg bg-muted/50 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Organization</span>
              <span className="font-medium text-foreground">{invitation?.organization?.name}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Your Role</span>
              <span className="font-medium text-foreground capitalize">{invitation?.role}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Invited Email</span>
              <span className="font-medium text-foreground">{invitation?.email}</span>
            </div>
          </div>

          {emailMismatch && (
            <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
              <p className="text-sm text-warning/70">
                <span className="font-semibold">Email mismatch:</span> You're logged in as <span className="font-medium">{user?.email}</span>, but this invitation was sent to <span className="font-medium">{invitation?.email}</span>.
              </p>
              <p className="mt-2 text-sm text-warning">
                Please log in with the correct email to accept this invitation.
              </p>
            </div>
          )}

          {acceptMutation.error && (
            <div className="rounded-lg bg-destructive/10 p-4">
              <p className="text-sm text-destructive">{acceptMutation.error.message}</p>
            </div>
          )}

          <Button
            onClick={handleAccept}
            disabled={acceptMutation.isPending || emailMismatch}
            className="w-full py-3"
          >
            {acceptMutation.isPending ? 'Accepting...' : 'Accept Invitation'}
          </Button>

          <Link
            to="/dashboard"
            className="block text-center text-sm text-muted-foreground hover:text-foreground"
          >
            Skip for now
          </Link>
        </div>
      </div>
    </div>
  );
}
