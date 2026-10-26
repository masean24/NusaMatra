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
          groups: [{ name: 'three', test: /node_modules[/\\](three|@react-three)[/\\]/ }],
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
