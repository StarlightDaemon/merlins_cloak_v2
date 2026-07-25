/**
 * Background service worker.
 *
 * HARD RULE: this context never makes a request to the router. A background
 * fetch runs from a chrome-extension:// origin — public address space under
 * Local Network Access — and a public→local request to a plain-HTTP router is
 * silently gated with no permission prompt possible. All router I/O lives in
 * the content script (see lib/router-io.ts).
 *
 * The only job here is keeping the content script registered for a custom
 * router address (anything other than the static manifest origins).
 */
import { browser } from 'wxt/browser';
import { getSettings, onSettingsChanged } from '../lib/settings';

const DYNAMIC_SCRIPT_ID = 'mc2-dynamic-router';
const STATIC_HOSTS = new Set(['192.168.1.1', 'router.asus.com', 'www.asusrouter.com']);

async function syncDynamicRegistration(routerAddress: string): Promise<void> {
  const host = routerAddress.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  try {
    const existing = await browser.scripting.getRegisteredContentScripts({ ids: [DYNAMIC_SCRIPT_ID] });
    if (existing.length > 0) await browser.scripting.unregisterContentScripts({ ids: [DYNAMIC_SCRIPT_ID] });
  } catch {
    // nothing registered yet
  }
  if (!host || STATIC_HOSTS.has(host)) return;

  const matches = [`http://${host}/*`, `https://${host}/*`];
  const granted = await browser.permissions.contains({ origins: matches }).catch(() => false);
  if (!granted) {
    console.warn(`[merlins-cloak] no host permission for ${host}; grant it from the popup settings`);
    return;
  }
  await browser.scripting.registerContentScripts([
    {
      id: DYNAMIC_SCRIPT_ID,
      js: ['content-scripts/content.js'],
      matches,
      runAt: 'document_idle',
      persistAcrossSessions: true,
    },
  ]);
  console.info(`[merlins-cloak] content script registered for ${host}`);
}

export default defineBackground(() => {
  void getSettings().then((s) => syncDynamicRegistration(s.routerAddress));
  onSettingsChanged((s) => void syncDynamicRegistration(s.routerAddress));
});
