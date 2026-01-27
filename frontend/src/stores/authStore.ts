import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
}

const API_BASE_URL = '/api/v1';

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
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
        console.log('Login response user:', JSON.stringify(data.user));
        set({
          user: data.user,
          token: data.token,
          isAuthenticated: true,
          isLoading: false,
        });
        console.log('Stored user:', JSON.stringify(get().user));
      },

      logout: async () => {
        const { token } = get();

        // Call backend to invalidate token
        if (token) {
          try {
            await fetch(`${API_BASE_URL}/auth/logout`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });
          } catch {
            // Continue with logout even if API call fails
          }
        }

        set({
          user: null,
          token: null,
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
        const { token } = get();
        if (!token) {
          set({ isLoading: false, isAuthenticated: false });
          return false;
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
            return true;
          } else {
            set({
              user: null,
              token: null,
              isAuthenticated: false,
              isLoading: false,
            });
            return false;
          }
        } catch {
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
          });
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
      version: 1,
      partialize: (state) => ({
        token: state.token,
        user: state.user,
      }),
      merge: (persistedState: any, currentState: AuthState) => ({
        ...currentState,
        ...persistedState,
        user: persistedState?.user || null,
      }),
    }
  )
);
