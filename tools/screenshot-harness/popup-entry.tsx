/**
 * Mounts the real popup app (src/entrypoints/popup) unmodified. All it needs
 * from the extension platform is `wxt/browser`, which vite.config.ts aliases
 * to ./mocks/browser.ts for this harness root only.
 */
import '../../src/entrypoints/popup/main.tsx';
