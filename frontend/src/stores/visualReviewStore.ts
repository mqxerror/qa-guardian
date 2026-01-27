import { create } from 'zustand';

interface VisualReviewState {
  pendingCount: number;
  isLoading: boolean;
  error: string | null;
  lastFetchedAt: number | null;
  fetchPendingCount: (token: string) => Promise<void>;
  decrementCount: () => void;
  incrementCount: () => void;
}

export const useVisualReviewStore = create<VisualReviewState>((set, get) => ({
  pendingCount: 0,
  isLoading: false,
  error: null,
  lastFetchedAt: null,

  fetchPendingCount: async (token: string) => {
    // Avoid refetching if we fetched within the last 30 seconds
    const now = Date.now();
    const lastFetched = get().lastFetchedAt;
    if (lastFetched && now - lastFetched < 30000) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const response = await fetch('/api/v1/visual/pending/count', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch pending count');
      }

      const data = await response.json();
      set({
        pendingCount: data.count || 0,
        isLoading: false,
        lastFetchedAt: now,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false,
      });
    }
  },

  decrementCount: () => {
    set((state) => ({
      pendingCount: Math.max(0, state.pendingCount - 1),
    }));
  },

  incrementCount: () => {
    set((state) => ({
      pendingCount: state.pendingCount + 1,
    }));
  },
}));
