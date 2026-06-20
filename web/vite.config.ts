import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// During local dev, proxy /api to the backend so the browser sees one origin.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },

  // ── Vitest configuration ────────────────────────────────────────────────────
  // Vitest reads this 'test' block. It is 100% ignored by the normal Vite build.
  test: {
    // 'jsdom' simulates a browser DOM inside Node.js so React can render.
    // Alternative: 'happy-dom' (faster but less complete).
    environment: 'jsdom',

    // This file runs once before every test file.
    // We use it to import @testing-library/jest-dom which adds custom matchers
    // like toBeInTheDocument(), toHaveValue(), toBeDisabled(), etc.
    setupFiles: ['./src/test/setup.ts'],

    // Make Vitest globals (describe, it, expect, vi, beforeEach, afterEach…)
    // available without importing them in every test file.
    globals: true,

    // Code coverage powered by V8 (Node's built-in coverage tool).
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/main.tsx', 'src/vite-env.d.ts'],
    },
  },
});
