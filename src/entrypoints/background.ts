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

/**
 * MAIN-world *_support flag collector, run on request from the content
 * script. MV3 isolates content scripts, and injecting an inline <script>
 * into the page is silently dropped on this firmware's pages (live-observed:
 * the collector timed out and capability detection fell back to rc_support
 * parsing). scripting.executeScript with world:'MAIN' is the reliable path.
 * This executes IN THE PAGE — the background still never issues any router
 * network request.
 */
function collectSupportFlags(): Record<string, number | boolean | string> {
  const flags: Record<string, number | boolean | string> = {};
  const names = Object.getOwnPropertyNames(window);
  for (const k of names) {
    if (k.length > 8 && k.endsWith('_support')) {
      try {
        const v = (window as unknown as Record<string, unknown>)[k];
        const t = typeof v;
        if (t === 'number' || t === 'boolean' || t === 'string') flags[k] = v as number | boolean | string;
        else if (v && t === 'object') flags[k] = '{}';
      } catch {
        // skip unreadable global
      }
    }
  }
  return flags;
}

export default defineBackground(() => {
  void getSettings().then((s) => syncDynamicRegistration(s.routerAddress));
  onSettingsChanged((s) => void syncDynamicRegistration(s.routerAddress));

  browser.runtime.onMessage.addListener((msg: unknown, sender, sendResponse) => {
    if (!msg || (msg as { type?: string }).type !== 'mc2-collect-flags') return undefined;
    const tabId = sender.tab?.id;
    if (tabId === undefined) {
      sendResponse({ error: 'no tab' });
      return undefined;
    }
    browser.scripting
      .executeScript({
        target: { tabId },
        world: 'MAIN',
        func: collectSupportFlags,
      })
      .then((results) => sendResponse({ flags: results[0]?.result ?? null }))
      .catch((e: unknown) => sendResponse({ error: e instanceof Error ? e.message : String(e) }));
    return true; // async sendResponse
  });
});
