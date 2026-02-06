import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';

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
      retry: 1,
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
