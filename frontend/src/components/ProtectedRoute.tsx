import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { FullPageLoader } from './ui/LoadingSpinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, checkAuth, token } = useAuthStore();
  const location = useLocation();
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    const verify = async () => {
      // If we have a token but checkAuth fails, it means the session expired
      const hadToken = !!token;
      const isValid = await checkAuth();

      if (hadToken && !isValid) {
        setSessionExpired(true);
      }
    };
    verify();
  }, [checkAuth, token]);

  // Feature #1360: Use shared LoadingSpinner component
  if (isLoading) {
    return <FullPageLoader message="Authenticating..." />;
  }

  if (!isAuthenticated) {
    // Redirect to login page with the current location and session expired flag
    return (
      <Navigate
        to="/login"
        state={{ from: location, sessionExpired }}
        replace
      />
    );
  }

  return <>{children}</>;
}
