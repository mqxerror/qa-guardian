import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
// Feature #161: Bundle optimization configuration
// Feature #133: Chunk splitting strategy
//
// Architecture: Vite-native code splitting + route-level lazy loading
// ───────────────────────────────────────────────────────────────────
//
// We intentionally DO NOT use Rollup's `manualChunks`. Here's why:
//
// Problem: Rollup shares CommonJS interop helpers across manual chunks,
// creating circular imports (e.g., vendor.js ↔ charts.js). When the browser
// loads these, ES module semantics cause partially-initialized exports,
// resulting in "Cannot read properties of undefined (reading 'useState')".
//
// Solution: Let Vite's built-in module-graph-aware splitter handle ALL
// chunk boundaries. Vite guarantees no circular dependencies because it
// understands the full import graph, including generated helper code.
//
// How the splitting works:
//   1. Vite automatically creates a vendor chunk for shared node_modules
//   2. Each lazy(() => import('./pages/...')) in App.tsx creates a route chunk
//   3. Heavy libs (recharts, jspdf, jszip) end up in separate chunks because
//      they're only imported by lazy-loaded routes — Vite detects this and
//      splits them without manual intervention
//   4. Shared code between routes is extracted into common chunks automatically
//
// Result:
//   vendor-[hash].js   — All eagerly-loaded deps (~700KB)
//   [PageName]-[hash].js — Per-route chunks (automatic via lazy())
//   [shared]-[hash].js — Shared deps between routes (automatic)
//
// This is the recommended production approach for Vite 5+.
// See: https://vitejs.dev/guide/build.html#chunking-strategy
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
    // Suppress chunk size warnings — large vendor chunk is expected
    // and acceptable given the tradeoff of no circular dependencies
    chunkSizeWarningLimit: 800,
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
