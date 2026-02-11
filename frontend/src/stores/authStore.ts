import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { logger } from '../utils/logger';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  role: 'owner' | 'admin' | 'developer' | 'viewer';
  organization_id: string;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  role: string;
  is_current: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  organizations: Organization[];
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  checkAuth: () => Promise<boolean>;
  fetchOrganizations: () => Promise<void>;
  switchOrganization: (organizationId: string) => Promise<void>;
  refreshAccessToken: () => Promise<boolean>;
}

// Feature #643: Persisted state type for Zustand persist middleware
interface PersistedAuthState {
  token?: string | null;
  refreshToken?: string | null;
  user?: User | null;
}

// Feature #213: Helper to parse JWT and extract expiry
function parseJwtExpiry(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload.exp ? payload.exp * 1000 : null; // Convert to milliseconds
  } catch {
    return null;
  }
}

// Feature #213: Check if token expires within given milliseconds
function tokenExpiresWithin(token: string, ms: number): boolean {
  const expiry = parseJwtExpiry(token);
  if (!expiry) return true; // Treat invalid tokens as expired
  return expiry - Date.now() < ms;
}

const API_BASE_URL = '/api/v1';

// Feature #226: Background token refresh timer
// Proactively refresh tokens before they expire to prevent 401 errors
let refreshTimerId: ReturnType<typeof setInterval> | null = null;
const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // Feature #238: 5 minutes for reliable refresh in background tabs
const PROACTIVE_REFRESH_THRESHOLD_MS = 10 * 60 * 1000; // Refresh if expires within 10 minutes

// Feature #226: Start the background refresh timer
function startRefreshTimer(): void {
  // Clear any existing timer first
  if (refreshTimerId) {
    clearInterval(refreshTimerId);
  }

  refreshTimerId = setInterval(async () => {
    const { token, refreshToken, refreshAccessToken } = useAuthStore.getState();

    if (!token || !refreshToken) {
      // Not logged in, stop the timer
      stopRefreshTimer();
      return;
    }

    // Check if token expires soon
    if (tokenExpiresWithin(token, PROACTIVE_REFRESH_THRESHOLD_MS)) {
      logger.auth.debug('[RefreshTimer] Token expires soon, refreshing proactively...');
      const success = await refreshAccessToken();
      if (!success) {
        logger.auth.debug('[RefreshTimer] Proactive refresh failed');
        // Don't logout - let the next API call handle it
      }
    }
  }, REFRESH_INTERVAL_MS);

  logger.auth.debug('[RefreshTimer] Started background refresh timer');
}

// Feature #226: Stop the background refresh timer
function stopRefreshTimer(): void {
  if (refreshTimerId) {
    clearInterval(refreshTimerId);
    refreshTimerId = null;
    logger.auth.debug('[RefreshTimer] Stopped background refresh timer');
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: true,
      organizations: [],

      login: async (email: string, password: string) => {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Login failed');
        }

        const data = await response.json();
        logger.auth.debug('Login response user:', data.user);
        set({
          user: data.user,
          token: data.token,
          refreshToken: data.refresh_token || null, // Feature #213: Store refresh token
          isAuthenticated: true,
          isLoading: false,
        });
        logger.auth.debug('Stored user:', get().user);

        // Feature #226: Start background token refresh timer
        startRefreshTimer();
      },

      logout: async () => {
        // Feature #226: Stop background refresh timer
        stopRefreshTimer();

        const { token, refreshToken } = get();

        // Call backend to invalidate token and refresh token
        if (token) {
          try {
            await fetch(`${API_BASE_URL}/auth/logout`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              // Feature #213: Send refresh token so backend can revoke it
              body: JSON.stringify({ refresh_token: refreshToken }),
            });
          } catch {
            // Continue with logout even if API call fails
          }
        }

        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      setUser: (user: User | null) => {
        set({ user, isAuthenticated: !!user });
      },

      setToken: (token: string | null) => {
        set({ token });
      },

      checkAuth: async () => {
        let { token } = get();
        const { refreshToken } = get();
        if (!token) {
          set({ isLoading: false, isAuthenticated: false });
          return false;
        }

        // Feature #213: Auto-refresh if token expires within 5 minutes
        const REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
        if (tokenExpiresWithin(token, REFRESH_THRESHOLD_MS) && refreshToken) {
          logger.auth.debug('Token expires soon, attempting refresh...');
          const refreshed = await get().refreshAccessToken();
          if (!refreshed) {
            set({
              user: null,
              token: null,
              refreshToken: null,
              isAuthenticated: false,
              isLoading: false,
            });
            return false;
          }
          // Get the new token after refresh
          token = get().token!;
        }

        try {
          const response = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            set({
              user: data.user,
              isAuthenticated: true,
              isLoading: false,
            });

            // Feature #226: Start background token refresh timer
            startRefreshTimer();

            return true;
          } else {
            // Feature #213: Try refresh if /me fails (401)
            if (response.status === 401 && refreshToken) {
              const refreshed = await get().refreshAccessToken();
              if (refreshed) {
                // Retry with new token
                return get().checkAuth();
              }
            }
            set({
              user: null,
              token: null,
              refreshToken: null,
              isAuthenticated: false,
              isLoading: false,
            });
            return false;
          }
        } catch {
          set({
            user: null,
            token: null,
            refreshToken: null,
            isAuthenticated: false,
            isLoading: false,
          });
          return false;
        }
      },

      // Feature #213: Refresh the access token using the refresh token
      refreshAccessToken: async () => {
        const { refreshToken } = get();
        if (!refreshToken) {
          logger.auth.debug('No refresh token available');
          return false;
        }

        try {
          const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refresh_token: refreshToken }),
          });

          if (response.ok) {
            const data = await response.json();
            set({
              token: data.token,
              refreshToken: data.refresh_token || refreshToken, // Use new refresh token if rotated
            });
            logger.auth.debug('Token refreshed successfully');
            return true;
          } else {
            logger.auth.debug('Token refresh failed:', response.status);
            return false;
          }
        } catch (error) {
          logger.auth.debug('Token refresh error:', error);
          return false;
        }
      },

      fetchOrganizations: async () => {
        const { token } = get();
        if (!token) return;

        try {
          const response = await fetch(`${API_BASE_URL}/organizations`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            set({ organizations: data.organizations || [] });
          }
        } catch {
          // Silently fail - user may not have access to multiple orgs
        }
      },

      switchOrganization: async (organizationId: string) => {
        const { token, user } = get();
        if (!token || !user) throw new Error('Not authenticated');

        const response = await fetch(`${API_BASE_URL}/organizations/switch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ organization_id: organizationId }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to switch organization');
        }

        const data = await response.json();

        // Update user with new organization and role
        set({
          token: data.token,
          user: {
            ...user,
            organization_id: organizationId,
            role: data.organization.role,
          },
        });

        // Refetch organizations to update current status
        get().fetchOrganizations();
      },
    }),
    {
      name: 'qa-guardian-auth',
      version: 3, // Feature #213: Bumped to v3 for refresh token support
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken, // Feature #213: Persist refresh token
        user: state.user,
      }),
      // Feature #2098: Migrate function to clear stale state with non-UUID organization_id
      migrate: (persistedState: PersistedAuthState, _version: number) => {
        // Helper to validate UUID format
        const isValidUUID = (str: string | undefined): boolean => {
          if (!str) return false;
          // Standard UUID pattern (versions 1-5) or zero/nil UUID (for seeded test data)
          const standardUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
          const zeroUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          return standardUUID.test(str) || zeroUUID.test(str);
        };

        // Check if persisted state has valid organization_id
        if (persistedState?.user?.organization_id && !isValidUUID(persistedState.user.organization_id)) {
          logger.auth.debug('Clearing stale auth state with invalid organization_id:', persistedState.user.organization_id);
          return { token: null, refreshToken: null, user: null };
        }

        // Also validate user.id if present
        if (persistedState?.user?.id && !isValidUUID(persistedState.user.id)) {
          logger.auth.debug('Clearing stale auth state with invalid user.id:', persistedState.user.id);
          return { token: null, refreshToken: null, user: null };
        }

        return persistedState;
      },
      merge: (persistedState: PersistedAuthState, currentState: AuthState) => ({
        ...currentState,
        ...persistedState,
        user: persistedState?.user || null,
        refreshToken: persistedState?.refreshToken || null, // Feature #213
      }),
    }
  )
);
