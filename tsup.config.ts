import { defineConfig } from 'tsup';

// Bundles the server entry to dist/server/index.js for distribution (npx / global
// install). Runtime deps stay external — they are installed from package.json.
export default defineConfig({
  entry: ['src/server/index.ts'],
  outDir: 'dist/server',
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  banner: { js: '#!/usr/bin/env node' },
  clean: false,
  splitting: false,
  external: ['@hono/node-server', 'hono', 'ws', 'zod'],
});
