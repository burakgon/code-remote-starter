import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The web app is served by the Node server in production. In dev, Vite serves
// it on :5173 and proxies the API + WebSocket to the server on :4317.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { outDir: 'dist/web', emptyOutDir: true },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4317',
      '/ws': { target: 'ws://localhost:4317', ws: true },
    },
  },
});
