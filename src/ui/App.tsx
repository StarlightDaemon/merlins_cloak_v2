/**
 * The app shell: header (identity + status chips), grouped sidebar nav built
 * from the registry filtered by live capabilities, hash-routed content area.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { collectCapabilities, type Capabilities } from '../lib/capabilities';
import { getSettings, onSettingsChanged, updateSettings, type ExtensionSettings } from '../lib/settings';
import { setReadOnlyMode } from '../lib/write-guard';
import { NAV_GROUPS, findPage, getVisiblePages, pageIdForAsp } from '../pages/registry';
import type { PageDef } from '../pages/types';
import { SettingsPage } from './SettingsPage';
import { Banner, Button, Loading } from './components';

function useHashRoute(defaultId: string): [string, (id: string) => void] {
  const parse = () => window.location.hash.replace(/^#\//, '') || defaultId;
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const onHash = () => setRoute(parse());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const navigate = useCallback((id: string) => {
    window.location.hash = `/${id}`;
  }, []);
  return [route, navigate];
}

export function App() {
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [capsError, setCapsError] = useState<string | null>(null);
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);

  const initialRoute = useMemo(() => pageIdForAsp(window.location.pathname) ?? 'dashboard', []);
  const [route, navigate] = useHashRoute(initialRoute);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    void (async () => {
      const s = await getSettings();
      setSettings(s);
      setReadOnlyMode(s.readOnlyMode);
    })();
    return onSettingsChanged((s) => {
      setSettings(s);
      setReadOnlyMode(s.readOnlyMode);
    });
  }, []);

  useEffect(() => {
    void collectCapabilities()
      .then(setCaps)
      .catch((e) => setCapsError(e instanceof Error ? e.message : String(e)));
  }, []);

  const visiblePages = useMemo(() => (caps ? getVisiblePages(caps) : []), [caps]);
  const activePage: PageDef | undefined = useMemo(
    () => visiblePages.find((p) => p.id === route) ?? findPage(route),
    [visiblePages, route],
  );

  // Auto-open the group containing the active page.
  useEffect(() => {
    if (activePage) setOpenGroups((g) => ({ ...g, [activePage.navGroup]: true }));
  }, [activePage]);

  if (capsError) {
    return (
      <div className="mc-app">
        <div className="mc-main" style={{ padding: 40 }}>
          <Banner tone="err">
            Could not read router capabilities: {capsError}. If you are not logged in to the router, log in and reload
            the page.
          </Banner>
          <Button onClick={() => window.location.reload()}>Reload</Button>
        </div>
      </div>
    );
  }
  if (!caps || !settings) {
    return (
      <div className="mc-app">
        <Loading label="Detecting router capabilities…" />
      </div>
    );
  }

  const ident = caps.identity;

  return (
    <div className="mc-app">
      <header className="mc-header">
        <div className="mc-header__brand">
          Merlin's <em>Cloak</em>
        </div>
        <div className="mc-header__identity">
          {ident.productId} · {ident.displayVersion} · {ident.branch === 'merlin' ? 'Asuswrt-Merlin' : ident.branch === 'stock' ? 'Stock ASUSWRT' : 'branch unknown'}
        </div>
        <div className="mc-header__spacer" />
        {settings.readOnlyMode && (
          <span className="mc-header__chip is-warn" title="No write is ever sent while read-only mode is on. Toggle it in Merlin's Cloak → Settings.">
            <span className="dot" /> read-only
          </span>
        )}
        <span className={`mc-header__chip ${caps.flagSource === 'main-world' ? 'is-ok' : 'is-warn'}`}>
          <span className="dot" /> {Object.keys(caps.flags).length} flags
        </span>
      </header>
      <div className="mc-body">
        <nav className="mc-nav">
          {NAV_GROUPS.filter((g) => !g.gate || g.gate(caps))
            .map((g) => ({ group: g, pages: visiblePages.filter((p) => p.navGroup === g.id) }))
            .filter((x) => x.pages.length > 0)
            .map(({ group, pages: groupPages }) => {
              const open = openGroups[group.id] ?? false;
              return (
                <div key={group.id} className={`mc-nav__group${open ? ' is-open' : ''}`}>
                  <button
                    type="button"
                    className="mc-nav__group-title"
                    onClick={() =>
                      groupPages.length === 1
                        ? navigate(groupPages[0].id)
                        : setOpenGroups((g) => ({ ...g, [group.id]: !open }))
                    }
                  >
                    {group.label}
                    {groupPages.length > 1 && <span className="chev">▶</span>}
                  </button>
                  {open &&
                    groupPages.length > 1 &&
                    groupPages.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={`mc-nav__item${p.id === route ? ' is-active' : ''}`}
                        onClick={() => navigate(p.id)}
                      >
                        {p.navLabel ?? p.title}
                      </button>
                    ))}
                </div>
              );
            })}
        </nav>
        <main className="mc-main">
          <div className="mc-main__inner">
            {activePage ? (
              activePage.kind === 'settings' ? (
                <SettingsPage key={activePage.id} def={activePage} caps={caps} />
              ) : (
                <activePage.component key={activePage.id} caps={caps} />
              )
            ) : (
              <Banner tone="info">
                No view registered for route “{route}”.{' '}
                <Button small onClick={() => navigate('dashboard')}>
                  Go to dashboard
                </Button>
              </Banner>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export function useAppSettings(): [ExtensionSettings | null, (patch: Partial<ExtensionSettings>) => Promise<void>] {
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  useEffect(() => {
    void getSettings().then(setSettings);
    return onSettingsChanged(setSettings);
  }, []);
  const update = useCallback(async (patch: Partial<ExtensionSettings>) => {
    const next = await updateSettings(patch);
    setSettings(next);
  }, []);
  return [settings, update];
}
