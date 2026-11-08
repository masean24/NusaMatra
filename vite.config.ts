import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  css: {
    modules: { localsConvention: 'camelCaseOnly' },
  },
  build: {
    // three.js + React Three Fiber form one lazy chunk loaded only when a 3D zone nears the
    // viewport (never on phones); it is large by nature, so the warning limit reflects that chunk.
    chunkSizeWarningLimit: 1000,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // React is claimed first. A group also takes its modules' dependencies, so without this
            // the 'three' group pulled React and its scheduler in through React Three Fiber, and
            // every page imported React from the three.js chunk: the whole chunk loaded everywhere.
            { name: 'react', test: /node_modules[/\\](react|react-dom|scheduler)[/\\]/, priority: 2 },
            { name: 'three', test: /node_modules[/\\](three|@react-three)[/\\]/, priority: 1 },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // The component tests drive both data modes, so they see the DEMO/LIVE switch visitors do not.
    env: { VITE_DATA_MODE_SWITCH: '1' },
  },
});
