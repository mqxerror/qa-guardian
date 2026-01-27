import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  getEffectiveTheme: () => 'light' | 'dark';
}

// Helper to get system preference
const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
};

// Apply theme to document
const applyTheme = (theme: Theme) => {
  const root = document.documentElement;
  const effectiveTheme = theme === 'system' ? getSystemTheme() : theme;

  if (effectiveTheme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'system', // Default to system preference

      setTheme: (theme: Theme) => {
        set({ theme });
        applyTheme(theme);
      },

      getEffectiveTheme: () => {
        const { theme } = get();
        return theme === 'system' ? getSystemTheme() : theme;
      },
    }),
    {
      name: 'qa-guardian-theme',
      version: 1,
      onRehydrateStorage: () => {
        return (state) => {
          // Apply theme after rehydration
          if (state) {
            applyTheme(state.theme);
          }
        };
      },
    }
  )
);

// Initialize theme on load and listen for system preference changes
if (typeof window !== 'undefined') {
  // Apply initial theme
  const storedTheme = localStorage.getItem('qa-guardian-theme');
  if (storedTheme) {
    try {
      const parsed = JSON.parse(storedTheme);
      applyTheme(parsed.state?.theme || 'system');
    } catch {
      applyTheme('system');
    }
  } else {
    applyTheme('system');
  }

  // Listen for system preference changes
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', () => {
    const store = useThemeStore.getState();
    if (store.theme === 'system') {
      applyTheme('system');
    }
  });
}
