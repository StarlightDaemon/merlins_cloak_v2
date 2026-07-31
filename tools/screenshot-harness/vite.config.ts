/**
 * Standalone vite root for the Chrome Web Store screenshot harness. Deliberately
 * separate from the repo's own wxt.config.ts / wxt build pipeline: this never
 * runs as part of `wxt build`/`wxt zip` and its output never lands in
 * `.output/` (see build.outDir below), so it ships nothing to the store.
 *
 * Reuses the repo's already-installed toolchain — vite itself (wxt depends on
 * it) and @vitejs/plugin-react (an existing transitive dependency of
 * @wxt-dev/module-react, physically present in node_modules) — no new
 * devDependency was added for this harness.
 */
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const repoRoot = here('../..');

export default defineConfig({
  root: here('.'),
  plugins: [react()],
  resolve: {
    alias: {
      // src/lib/settings.ts, src/lib/capabilities.ts and the popup import the
      // real WebExtension `browser` object from here. Outside an installed
      // extension there is no such object, so this harness redirects the
      // import to an in-memory mock (./mocks/browser.ts) instead of touching
      // any file under src/.
      'wxt/browser': here('./mocks/browser.ts'),
    },
  },
  server: {
    fs: {
      // Allow serving src/ (two levels up) even if vite's workspace-root
      // auto-detection doesn't already cover it.
      allow: [repoRoot],
    },
  },
  build: {
    // Own output directory — never the repo's `.output/` (wxt's build dir).
    outDir: here('./dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: here('./index.html'),
        popup: here('./popup.html'),
        content: here('./content.html'),
      },
    },
  },
});
