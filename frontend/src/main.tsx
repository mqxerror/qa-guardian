import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';

// Feature #678: Self-hosted fonts via fontsource (eliminates Google Fonts dependency)
// Feature #700: Latin-only subsets - removes 696KB of non-latin characters
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-500.css';

import './index.css';

// Eagerly import themeStore so its module-level init (reads localStorage,
// applies .dark/.light class to <html>) runs BEFORE any component renders.
// Without this, the store only loaded when the settings page mounted, so on
// refresh the page flashed dark (CSS :root default) regardless of saved pref.
import './stores/themeStore';

/**
 * Feature #107: Optimized QueryClient defaults for real-time testing platform
 *
 * - staleTime: 30 seconds (previously 5 minutes - too high for real-time updates)
 * - gcTime: 5 minutes (garbage collection time, keeps data in cache)
 * - retry: 1 (retry failed requests once)
 *
 * To add React Query DevTools for development debugging:
 * 1. npm install @tanstack/react-query-devtools
 * 2. Import and add: <ReactQueryDevtools initialIsOpen={false} />
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds - better for real-time testing platform
      gcTime: 1000 * 60 * 5, // 5 minutes - garbage collection time
      retry: (failureCount, error) => {
        // Never retry 429 (rate limit) — retrying makes it worse
        if (error instanceof Error && error.message.includes('429')) return false;
        return failureCount < 1;
      },
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
