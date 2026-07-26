import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { getSettings, updateSettings, type ExtensionSettings } from '../../lib/settings';
import { DISABLE_READONLY_CONFIRM } from '../../lib/write-policy';
import './App.css';

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
    if (!host) return;
    const isStatic = ['192.168.1.1', 'router.asus.com', 'www.asusrouter.com'].includes(host);
    if (!isStatic) {
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
