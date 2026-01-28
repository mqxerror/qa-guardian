import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        // Feature #1924: Configure proxy to handle long-running AI requests properly
        timeout: 60000, // 60 second timeout for proxied requests
        proxyTimeout: 60000, // 60 second timeout for proxy connection
      },
    },
  },
});
