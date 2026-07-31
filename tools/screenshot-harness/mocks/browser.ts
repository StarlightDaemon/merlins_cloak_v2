/**
 * Minimal in-memory stand-in for `wxt/browser`'s `browser` export, used only
 * by the screenshot harness (see ../vite.config.ts `resolve.alias`). This
 * file is never bundled into the real extension — wxt's own build resolves
 * `wxt/browser` to the real `@wxt-dev/browser` package, this alias only
 * applies inside tools/screenshot-harness's own standalone vite root.
 *
 * Covers exactly the surface area src/ actually calls:
 *  - storage.local.get/set + storage.onChanged (src/lib/settings.ts)
 *  - runtime.sendMessage (src/lib/capabilities.ts collectViaBackground — made
 *    to reject, so capability collection falls through to the main-world /
 *    rc_support fallback path, which the fetch mock's `rc_support` nvram
 *    value drives instead)
 *  - tabs.create, tabs.query, tabs.reload, permissions.request
 *    (src/entrypoints/popup/App.tsx)
 */

type StorageChanges = Record<string, { newValue?: unknown; oldValue?: unknown }>;
type ChangeListener = (changes: StorageChanges, areaName: string) => void;

const store = new Map<string, unknown>();
const listeners = new Set<ChangeListener>();

// Seed the settings the extension reads on first paint so popup and content
// views agree on the same fictional router address out of the box.
store.set('mc2-settings', { routerAddress: '192.168.50.1', readOnlyMode: true, enabled: true });

function clone<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

function normalizeKeys(keys: unknown): string[] {
  if (keys == null) return [...store.keys()];
  if (typeof keys === 'string') return [keys];
  if (Array.isArray(keys)) return keys as string[];
  return Object.keys(keys as Record<string, unknown>);
}

export const browser = {
  storage: {
    local: {
      async get(keys?: unknown): Promise<Record<string, unknown>> {
        const out: Record<string, unknown> = {};
        for (const k of normalizeKeys(keys)) {
          if (store.has(k)) out[k] = clone(store.get(k));
        }
        return out;
      },
      async set(items: Record<string, unknown>): Promise<void> {
        const changes: StorageChanges = {};
        for (const [k, v] of Object.entries(items)) {
          changes[k] = { oldValue: clone(store.get(k)), newValue: clone(v) };
          store.set(k, v);
        }
        for (const cb of listeners) cb(changes, 'local');
      },
      async remove(keys: unknown): Promise<void> {
        for (const k of normalizeKeys(keys)) store.delete(k);
      },
    },
    onChanged: {
      addListener(cb: ChangeListener) {
        listeners.add(cb);
      },
      removeListener(cb: ChangeListener) {
        listeners.delete(cb);
      },
    },
  },
  runtime: {
    async sendMessage(): Promise<never> {
      // No background service worker exists in a plain browser tab; this
      // intentionally rejects so collectViaBackground() falls back to the
      // in-page collector, and from there to the rc_support-derived flags
      // (see mocks/fixtures.ts FIXTURE_NVRAM.rc_support).
      throw new Error('screenshot-harness: no background service worker available');
    },
  },
  tabs: {
    async create({ url }: { url: string }): Promise<{ id: number; url: string }> {
       
      console.info('[screenshot-harness] browser.tabs.create (no-op):', url);
      return { id: -1, url };
    },
    async query(): Promise<Array<{ id: number; url: string }>> {
      // No real browser tabs exist in the harness; reporting none makes the
      // popup's reload-affected-tabs flow (App.tsx reloadRouterTabs) a silent
      // no-op, same as the "router UI isn't open anywhere" case in the wild.
      return [];
    },
    async reload(): Promise<void> {
      console.info('[screenshot-harness] browser.tabs.reload (no-op)');
    },
  },
  permissions: {
    async request(): Promise<boolean> {
      // No real permission prompt exists outside an installed extension;
      // always report "granted" so the popup's save flow completes.
      return true;
    },
  },
};
