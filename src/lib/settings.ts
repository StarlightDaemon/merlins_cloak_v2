/**
 * Extension settings, persisted in browser.storage.local.
 *
 * `readOnlyMode` is a hard interlock in front of every write the extension
 * could send to the router. While it is on, Apply actions construct and
 * display the exact request that would have been sent (endpoint, body,
 * rc_service) without sending it. It ships default-ON: flipping it off is a
 * deliberate user action, made in the settings view.
 */
import { browser } from 'wxt/browser';

export interface ExtensionSettings {
  /** Host (or host:port) of the router's admin interface. */
  routerAddress: string;
  /** When true, no write request is ever sent; Apply shows a payload preview. */
  readOnlyMode: boolean;
  /**
   * Master switch for the whole DOM takeover. When false, the content script
   * leaves the native router UI untouched — this is a kill switch, not a
   * write-safety interlock (that's `readOnlyMode`). Ships default-ON: the
   * extension is expected to be active immediately after install.
   */
  enabled: boolean;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  routerAddress: '192.168.1.1',
  readOnlyMode: true,
  enabled: true,
};

const KEY = 'mc2-settings';

export async function getSettings(): Promise<ExtensionSettings> {
  try {
    const stored = await browser.storage.local.get(KEY);
    return { ...DEFAULT_SETTINGS, ...(stored[KEY] as Partial<ExtensionSettings> | undefined) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function updateSettings(patch: Partial<ExtensionSettings>): Promise<ExtensionSettings> {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await browser.storage.local.set({ [KEY]: next });
  return next;
}

export function onSettingsChanged(cb: (s: ExtensionSettings) => void): () => void {
  const listener = (changes: Record<string, { newValue?: unknown }>, area: string) => {
    if (area === 'local' && changes[KEY]) {
      cb({ ...DEFAULT_SETTINGS, ...(changes[KEY].newValue as Partial<ExtensionSettings>) });
    }
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
