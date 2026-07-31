import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { getSettings, updateSettings, type ExtensionSettings } from '../../lib/settings';
import { DISABLE_READONLY_CONFIRM } from '../../lib/write-policy';
import './App.css';

/** Hosts the content script is registered for at install time (see wxt.config.ts). */
const STATIC_HOSTS = ['192.168.1.1', 'router.asus.com', 'www.asusrouter.com'];

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
/** One or more DNS labels ending in `.local` (mDNS), e.g. `asusrouter.local`. */
const MDNS_RE = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+local$/;

const PRIVATE_HOST_HINT =
  'Router address must be on your local network: a private IP (10.x, 172.16–31.x, 192.168.x), ' +
  'loopback (127.x or localhost), or a .local name.';

/**
 * Whether a host is one this extension is willing to request a host permission
 * for. `optional_host_permissions` in wxt.config.ts has to be declared as
 * `http(s)://*` — the permissions API only grants patterns that are a subset of
 * something already declared, and the router address is user-configured — so the
 * restriction to local-network origins is enforced here, at the request site.
 *
 * Accepted: RFC1918 (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16), loopback
 * (127.0.0.0/8 and the literal hostname `localhost`), and `.local` mDNS names.
 * An optional `:port` is allowed on any of them. Everything else is rejected.
 */
function isPrivateRouterHost(host: string): boolean {
  const parts = host.toLowerCase().split(':');
  // More than one colon means an IPv6 literal or a malformed host; neither is
  // expressible as an extension match pattern, so neither is accepted.
  if (parts.length > 2) return false;
  const [hostname, port] = parts;
  if (port !== undefined) {
    if (!/^\d{1,5}$/.test(port)) return false;
    const n = Number(port);
    if (n < 1 || n > 65535) return false;
  }
  if (hostname === 'localhost') return true;
  if (MDNS_RE.test(hostname)) return true;

  const m = IPV4_RE.exec(hostname);
  if (!m) return false;
  const octets = m.slice(1).map(Number);
  if (octets.some((o) => o > 255)) return false;
  const [a, b] = octets;
  return (
    a === 10 || // 10.0.0.0/8
    a === 127 || // 127.0.0.0/8 loopback
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
    (a === 192 && b === 168) // 192.168.0.0/16
  );
}

/**
 * Reload every open tab on the configured router origin so an enable/disable
 * flip takes effect immediately, instead of silently on next navigation.
 * Scoped strictly to that one origin — never touches unrelated tabs. Finding
 * no matching tab (router UI not currently open anywhere) is a normal,
 * silent no-op, not an error.
 */
async function reloadRouterTabs(routerAddress: string): Promise<void> {
  const host = routerAddress.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!host) return;
  const tabs = await browser.tabs.query({ url: [`http://${host}/*`, `https://${host}/*`] }).catch(() => []);
  await Promise.all(
    tabs
      .filter((t): t is typeof t & { id: number } => t.id !== undefined)
      .map((t) => browser.tabs.reload(t.id).catch(() => undefined)),
  );
}

function App() {
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    void getSettings().then((s) => {
      setSettings(s);
      setAddress(s.routerAddress);
    });
  }, []);

  if (!settings) return null;

  const saveAddress = async () => {
    const host = address.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!host) {
      setStatus('Enter a router address.');
      return;
    }
    // The static hosts are already declared host_permissions and include two
    // Asus DNS names that are not private-range literals, so they are checked
    // before the private-network guard rather than through it.
    const isStatic = STATIC_HOSTS.includes(host);
    if (!isStatic) {
      if (!isPrivateRouterHost(host)) {
        setStatus(`${host} is not a local-network address. ${PRIVATE_HOST_HINT}`);
        return;
      }
      // A custom address needs its host permission granted from a user gesture.
      const granted = await browser.permissions
        .request({ origins: [`http://${host}/*`, `https://${host}/*`] })
        .catch(() => false);
      if (!granted) {
        setStatus('Permission was not granted — the extension cannot run on that address.');
        return;
      }
    }
    const next = await updateSettings({ routerAddress: host });
    setSettings(next);
    setStatus(`Saved. The extension will activate on ${host}.`);
  };

  /**
   * Master switch for the whole DOM takeover. Unlike read-only mode this
   * needs no confirmation to turn off — disabling only restores the native
   * router UI, it does not arm anything. The affected router tab(s) are
   * reloaded immediately so the flip is visible without a manual refresh.
   */
  const toggleEnabled = async () => {
    const next = await updateSettings({ enabled: !settings.enabled });
    setSettings(next);
    setStatus(
      next.enabled
        ? 'Extension enabled — reloading the router tab.'
        : 'Extension disabled — restoring the native router UI.',
    );
    await reloadRouterTabs(next.routerAddress);
  };

  /**
   * Disabling read-only mode arms every non-excluded write path at once, so it
   * requires an explicit confirmation. Re-enabling it is strictly safer and
   * needs none. (The five hard-excluded categories stay blocked either way —
   * see lib/write-policy.ts — but everything else becomes live.)
   */
  const toggleReadOnly = async () => {
    const disabling = settings.readOnlyMode;
    if (disabling && !window.confirm(DISABLE_READONLY_CONFIRM)) return;
    const next = await updateSettings({ readOnlyMode: !settings.readOnlyMode });
    setSettings(next);
    setStatus(
      next.readOnlyMode
        ? 'Read-only mode is ON — Apply previews requests without sending them.'
        : 'Read-only mode is OFF — Apply will send real changes to your router.',
    );
  };

  return (
    <div className="popup">
      <h1>
        Merlin's <em>Cloak</em>
      </h1>
      <label
        className="field checkbox"
        style={{ borderBottom: '1px solid var(--fujin-border-strong)', paddingBottom: 10 }}
      >
        <input type="checkbox" checked={settings.enabled} onChange={() => void toggleEnabled()} />
        <span>
          <b>Extension enabled</b>{' '}
          <small>(master switch — turning this off restores the native router UI)</small>
        </span>
      </label>
      <label className="field">
        <span>Router address</span>
        <div className="row">
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="192.168.1.1"
            spellCheck={false}
          />
          <button onClick={() => void saveAddress()}>Save</button>
        </div>
      </label>
      <label className="field checkbox">
        <input type="checkbox" checked={settings.readOnlyMode} onChange={() => void toggleReadOnly()} />
        <span>
          Read-only mode <small>(Apply previews requests instead of sending them)</small>
        </span>
      </label>
      {!settings.readOnlyMode && (
        <p className="warn">
          Read-only mode is <b>off</b> — Apply sends real changes to your router.
        </p>
      )}
      <button
        className="open"
        onClick={() => void browser.tabs.create({ url: `http://${settings.routerAddress}/` })}
      >
        Open router UI
      </button>
      {status && <p className="status">{status}</p>}
      <p className="note">
        All router traffic stays between your browser and {settings.routerAddress}. Nothing is collected.
      </p>
    </div>
  );
}

export default App;
