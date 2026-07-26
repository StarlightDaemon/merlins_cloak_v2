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

// package.json carries a semver pre-release version (e.g. 0.9.0-beta.1).
// Chrome's manifest `version` must be 1-4 dot-separated integers, so the
// numeric core ships there and the full string is surfaced via `version_name`,
// which exists for exactly this. Firefox's version format is more permissive
// and accepts the semver pre-release string directly — it has no
// `version_name` field, so this is the only way to show the beta marker there.
const VERSION_CORE = packageJson.version.replace(/[-+].*$/, '');
const VERSION_IS_PRERELEASE = VERSION_CORE !== packageJson.version;

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  publicDir: 'src/public',
  modules: ['@wxt-dev/module-react'],
  manifest: (env) => ({
    name: "Merlin's Cloak v2",
    description: packageJson.description,
    version:
      VERSION_IS_PRERELEASE && env.browser === 'firefox'
        ? packageJson.version
        : VERSION_CORE,
    ...(VERSION_IS_PRERELEASE && env.browser !== 'firefox'
      ? { version_name: packageJson.version }
      : {}),
    permissions: ['storage', 'scripting'],
    host_permissions: STATIC_ROUTER_ORIGINS,
    // Declared broad because the permissions API only grants patterns that are
    // a subset of something already declared, and the router address is
    // user-configured — so this cannot be narrowed here without breaking custom
    // addresses. Nothing this broad is ever requested: the popup's saveAddress
    // (entrypoints/popup/App.tsx, isPrivateRouterHost) is where the restriction
    // actually lives, and it only requests RFC1918, loopback/localhost and
    // .local hosts. Grants are still per-origin and user-approved at runtime.
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
