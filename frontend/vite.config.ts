import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
// Feature #161: Bundle optimization configuration
// Feature #133: Optimized vendor chunk splitting for better caching
//
// Chunk strategy:
// - vendor: React core (stable, rarely updated)
// - ui-vendor: Radix UI (UI components)
// - ui-motion: Framer Motion (animations)
// - charts: Recharts (loaded only on chart pages)
// - query: React Query (data fetching)
// - utils: Utility libraries (zustand, socket.io, etc.)
// - icons: Lucide icons
// - pdf: jsPDF + html2canvas (loaded on demand)
// - zip: JSZip (loaded on demand)
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
        manualChunks(id) {
          // Feature #133: Optimized chunk splitting

          // React core - very stable, good cache longevity
          if (id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/react-router-dom/') ||
              id.includes('node_modules/scheduler/')) {
            return 'vendor';
          }

          // Radix UI components - UI library, changes infrequently
          if (id.includes('node_modules/@radix-ui/')) {
            return 'ui-vendor';
          }

          // Animation library
          if (id.includes('node_modules/framer-motion/')) {
            return 'ui-motion';
          }

          // Charts - large, loaded only on pages with charts
          if (id.includes('node_modules/recharts/') ||
              id.includes('node_modules/d3-') ||
              id.includes('node_modules/victory-')) {
            return 'charts';
          }

          // Query library - data fetching
          if (id.includes('node_modules/@tanstack/')) {
            return 'query';
          }

          // Utilities - small, stable libraries
          if (id.includes('node_modules/zustand/') ||
              id.includes('node_modules/socket.io-client/') ||
              id.includes('node_modules/clsx/') ||
              id.includes('node_modules/tailwind-merge/') ||
              id.includes('node_modules/class-variance-authority/')) {
            return 'utils';
          }

          // Lucide icons - icon library
          if (id.includes('node_modules/lucide-react/')) {
            return 'icons';
          }

          // PDF generation - loaded on demand
          if (id.includes('node_modules/jspdf/') ||
              id.includes('node_modules/html2canvas/')) {
            return 'pdf';
          }

          // ZIP functionality - loaded on demand
          if (id.includes('node_modules/jszip/')) {
            return 'zip';
          }
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
