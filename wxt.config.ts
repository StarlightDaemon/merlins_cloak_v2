import { defineConfig } from 'wxt';
import packageJson from './package.json';

// Static origins the content script is always registered for. The default
// router address plus the two DNS names Asus firmware answers to on-LAN.
// A custom router address is handled at runtime via optional host permissions
// + scripting.registerContentScripts (see entrypoints/background.ts).
export const STATIC_ROUTER_ORIGINS = [
  'http://192.168.1.1/*',
  'https://192.168.1.1/*',
  'http://router.asus.com/*',
  'https://router.asus.com/*',
  'http://www.asusrouter.com/*',
  'https://www.asusrouter.com/*',
];

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  publicDir: 'src/public',
  modules: ['@wxt-dev/module-react'],
  manifest: (env) => ({
    name: "Merlin's Cloak v2",
    description: packageJson.description,
    version: packageJson.version,
    permissions: ['storage', 'scripting'],
    host_permissions: STATIC_ROUTER_ORIGINS,
    // Allows a user-configured router address (any private origin) to be
    // granted at runtime without a broad install-time grant.
    optional_host_permissions: ['http://*/*', 'https://*/*'],
    ...(env.browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: 'merlins-cloak-v2@starlightdaemon.dev',
              // This extension only ever talks to the router at its
              // configured local address; it collects nothing.
              data_collection_permissions: {
                required: ['none'],
              },
            },
          },
        }
      : {}),
  }),
  vite: (env) => ({
    build: {
      sourcemap: env.mode === 'development',
      minify: env.mode !== 'development',
    },
  }),
});
