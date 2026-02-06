import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
// Feature #161: Bundle optimization configuration
// - recharts: Separate chunk via manualChunks, loaded only on pages that use charts
// - jsPDF: Dynamically imported in reportGenerators.ts, loaded only when export is triggered
// - react-query: Separate chunk for query library
//
// Bundle analysis: Use `npx vite-bundle-visualizer` to analyze bundle
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Feature #161: Vendor chunk for React core (cached separately)
          vendor: ['react', 'react-dom', 'react-router-dom'],
          // Feature #161: Charts chunk loaded on demand when chart pages are accessed
          charts: ['recharts'],
          // Feature #161: Query library chunk
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        // Feature #1924: Configure proxy to handle long-running AI requests properly
        timeout: 60000, // 60 second timeout for proxied requests
        proxyTimeout: 60000, // 60 second timeout for proxy connection
      },
    },
  },
});
