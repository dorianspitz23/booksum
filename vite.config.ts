import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// NOTE: there is deliberately no `define` block here.
// The Gemini API key is supplied by the user at runtime (see src/lib/ai/apiKey.ts)
// and must never be inlined into the bundle — a build-time key is readable by
// anyone who loads the site. See docs/superpowers/specs/.
// A GitHub Pages project site is served from /<repo>/, not from the domain root,
// so both the asset base and the router's basename have to know about it. The
// router reads import.meta.env.BASE_URL, which Vite derives from this value, so
// setting BASE_PATH at build time is enough to move the whole app.
//   BASE_PATH=/booksum/ npm run build
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  test: {
    globals: true,
    environment: 'jsdom',
    // Vitest's default `forks` pool fails to start workers on Windows when the
    // project path contains a space ("Timeout waiting for worker to respond").
    // Threads are unaffected and measurably faster to boot here.
    pool: 'threads',
    // jsdom + fake-indexeddb setup costs several seconds per file on a cold
    // cache, which pushed genuine passes past the 5s default on a first run.
    testTimeout: 20_000,
    hookTimeout: 20_000,
    setupFiles: ['./src/test/setup.ts'],
    // `.worktrees/` holds full checkouts created by audit tooling. They contain
    // their own copies of every test file, so without this the suite collects
    // ~220 files instead of ~24 and takes ten minutes instead of thirty seconds.
    exclude: ['**/node_modules/**', '**/dist/**', '**/.worktrees/**'],
    css: false,
    restoreMocks: true,
  },
});
