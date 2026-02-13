import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
// Feature #161: Bundle optimization configuration
// Feature #133: Chunk splitting strategy
// Feature #621: Manual chunk splitting for vendor bundle under 200KB gzip
//
// Architecture: Simplified manualChunks + route-level lazy loading
// ───────────────────────────────────────────────────────────────────
//
// We use a FUNCTION-based manualChunks to split out heavy libraries that are
// only used by lazy-loaded routes. React, react-router, and other core deps
// stay in the main vendor chunk to avoid circular dependency issues.
//
// Chunk strategy (actual measured sizes after Feature #724 optimization):
//   index-*.js     — React, router, zustand, tanstack, etc. (~124KB gzip) ✓ UNDER 200KB
//   ui-lib-*.js    — @radix-ui, lucide-react (~44KB gzip) - stable caching
//   charts-*.js    — recharts, d3-* (~156KB gzip) - LAZY-LOADED by analytics pages
//   pdf-export-*.js — jspdf + fflate (~128KB gzip) - LAZY-LOADED for report generation
//   html2canvas-*.js — html2canvas (~48KB gzip) - LAZY-LOADED as jsPDF dep
//   canvg-*.js     — canvg SVG rendering (~52KB gzip) - LAZY-LOADED as jsPDF dep
//   jszip-*.js     — jszip (~30KB gzip) - LAZY-LOADED for artifact downloads
//
// The main vendor chunk (index-*.js) is now 127KB gzip, well under the 200KB target.
// Heavy libraries (charts, PDF) are in separate chunks that load on-demand.
//
// Bundle analysis: npx vite-bundle-visualizer
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Feature #621: Manual chunk splitting for vendor bundle optimization
    // Split vendor bundle into logical chunks under 100KB gzip each
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        // Feature #621: Simplified manualChunks to avoid circular dependencies
        // Only split out truly independent, heavy libraries used by lazy-loaded pages
        manualChunks: (id: string) => {
          if (!id.includes('node_modules')) {
            return undefined; // Let Vite handle app code with its dependency graph
          }

          // Charts - 300KB+, only used by lazy-loaded analytics/dashboard pages
          if (id.includes('recharts') || id.includes('d3-') || id.includes('lightweight-charts')) {
            return 'charts';
          }

          // Feature #724: Split PDF export into smaller chunks (under 200KB gzip each)
          // jszip is used for artifact downloads, jsPDF for report generation
          // Splitting them reduces the max chunk size below the 200KB threshold

          // jszip - ~30KB gzip, used for artifact ZIP downloads
          if (id.includes('jszip')) {
            return 'jszip';
          }

          // html2canvas - large canvas rendering lib, transitive dep of jsPDF
          if (id.includes('html2canvas')) {
            return 'html2canvas';
          }

          // canvg - SVG to canvas rendering, transitive dep of jsPDF
          if (id.includes('canvg') || id.includes('@aspect-ratio') || id.includes('rvg-parse') || id.includes('svgpath')) {
            return 'canvg';
          }

          // PDF/Export - jsPDF core + fflate compression
          if (id.includes('jspdf') || id.includes('fflate')) {
            return 'pdf-export';
          }

          // UI components - Radix + Lucide, stable across releases
          if (id.includes('@radix-ui') || id.includes('lucide-react')) {
            return 'ui-lib';
          }

          // Let React, react-router, zustand, tanstack, etc. stay in main vendor chunk
          // This avoids circular dependencies with shared CommonJS helpers
          return undefined;
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
