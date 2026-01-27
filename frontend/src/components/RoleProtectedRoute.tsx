import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore, User } from '../stores/authStore';
import { FullPageLoader } from './ui/LoadingSpinner';

type Role = User['role'];

interface RoleProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: Role[];
  fallbackPath?: string;
}

export function RoleProtectedRoute({
  children,
  allowedRoles,
  fallbackPath = '/dashboard',
}: RoleProtectedRouteProps) {
  const { isAuthenticated, isLoading, user, checkAuth } = useAuthStore();
  const location = useLocation();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    checkAuth().then(() => setAuthChecked(true));
  }, [checkAuth]);

  // Feature #1360: Use shared LoadingSpinner component
  if (isLoading || !authChecked) {
    return <FullPageLoader message="Checking permissions..." />;
  }

  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if user has required role
  if (!user || !allowedRoles.includes(user.role)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="w-full max-w-md rounded-lg border border-destructive/20 bg-destructive/5 p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <svg
              aria-hidden="true"
              className="h-6 w-6 text-destructive"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-foreground">Access Denied</h2>
          <p className="mt-2 text-muted-foreground">
            You don't have permission to access this page. This page requires{' '}
            <span className="font-medium">{allowedRoles.join(' or ')}</span> role.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your current role: <span className="font-medium">{user?.role}</span>
          </p>
          <a
            href={fallbackPath}
            className="mt-6 inline-block rounded-md bg-primary px-6 py-2 font-medium text-primary-foreground hover:bg-primary/90"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
