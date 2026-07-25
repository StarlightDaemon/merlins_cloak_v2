/**
 * Extension-owned views: Diagnostics (identity, capability table, per-page
 * confidence, write inspector) and Settings (read-only interlock).
 * The router address itself is configured from the toolbar popup, which is an
 * extension context and can request the host permission a custom address needs.
 */
import { useMemo, useState, useSyncExternalStore } from 'react';
import { getWriteLog, onWriteLogChanged } from '../../lib/write-guard';
import { NAV_ALIASES, NAV_GROUPS, getAllPages } from '../registry';
import type { Confidence, PageDef, PageProps } from '../types';
import { Badge, Card, Row, Tabs, TextInput, Toggle } from '../../ui/components';
import { useAppSettings } from '../../ui/App';

const CONFIDENCE_LABEL: Record<Confidence, { label: string; tone: 'ok' | 'warn' | 'info' }> = {
  'live-verified': { label: 'confirmed live on RT-BE92U', tone: 'ok' },
  structural: { label: 'structurally sourced, not live-verified', tone: 'info' },
  'unverified-write': { label: 'implemented but never live-submitted', tone: 'warn' },
};

function ConfidenceBadge({ c }: { c: Confidence }) {
  const m = CONFIDENCE_LABEL[c];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

function PageConfidenceTable() {
  const pages = getAllPages();
  // Group by the nav taxonomy: category (and sub-header) in NAV_GROUPS order,
  // pages in navOrder. Aliased pages appear once, under their primary
  // category — the alias is a nav-placement convenience, not a second page
  // identity — with a note naming the extra placement.
  const grouped = useMemo(() => {
    const out: { label: string; defs: PageDef[] }[] = [];
    for (const g of NAV_GROUPS) {
      const members = pages
        .filter((p) => p.navGroup === g.id)
        .sort((a, b) => (a.navOrder ?? 0) - (b.navOrder ?? 0));
      if (members.length === 0) continue;
      if (g.subs) {
        for (const sub of g.subs) {
          const subMembers = members.filter((p) => p.navSub === sub.id);
          if (subMembers.length > 0) out.push({ label: `${g.label} › ${sub.label}`, defs: subMembers });
        }
        const unassigned = members.filter((p) => !g.subs?.some((s) => s.id === p.navSub));
        if (unassigned.length > 0) out.push({ label: g.label, defs: unassigned });
      } else {
        out.push({ label: g.label, defs: members });
      }
    }
    const known = new Set(NAV_GROUPS.map((g) => g.id));
    const unplaced = pages.filter((p) => !known.has(p.navGroup));
    if (unplaced.length > 0) out.push({ label: '(no nav category)', defs: unplaced });
    return out;
  }, [pages]);
  const aliasNote = (p: PageDef): string | undefined => {
    const groups = NAV_ALIASES.filter((a) => a.pageId === p.id).map(
      (a) => NAV_GROUPS.find((g) => g.id === a.navGroup)?.label ?? a.navGroup,
    );
    return groups.length > 0 ? `also in nav under ${groups.join(', ')}` : undefined;
  };
  return (
    <table className="mc-table">
      <thead>
        <tr>
          <th>View</th>
          <th>Native page</th>
          <th>Read path</th>
          <th>Write path</th>
        </tr>
      </thead>
      <tbody>
        {grouped.flatMap(({ label, defs }) => [
          <tr key={`group:${label}`} className="mc-table__group">
            <td colSpan={4}>{label}</td>
          </tr>,
          ...defs.map((p) => (
            <tr key={p.id}>
              <td>
                {p.title}
                {p.merlinOnly && (
                  <>
                    {' '}
                    <Badge tone="info">Merlin</Badge>
                  </>
                )}
                {aliasNote(p) && (
                  <>
                    {' '}
                    <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>({aliasNote(p)})</span>
                  </>
                )}
              </td>
              <td>
                <code>{p.aspPage}</code>
              </td>
              <td>
                <ConfidenceBadge c={p.confidence.read} />
              </td>
              <td>
                {p.confidence.write ? (
                  <>
                    <ConfidenceBadge c={p.confidence.write} />
                    {p.writeExclusion && (
                      <>
                        {' '}
                        <Badge tone="err">excluded: {p.writeExclusion}</Badge>
                      </>
                    )}
                  </>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>read-only view</span>
                )}
              </td>
            </tr>
          )),
        ])}
      </tbody>
    </table>
  );
}

function WriteInspector() {
  const writeLog = useSyncExternalStore(onWriteLogChanged, getWriteLog);
  if (writeLog.length === 0) {
    return <p className="mc-card__note">No writes constructed in this session yet.</p>;
  }
  return (
    <table className="mc-table mc-table--mono">
      <thead>
        <tr>
          <th>When</th>
          <th>Endpoint</th>
          <th>Body</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {writeLog.map((e) => (
          <tr key={e.id}>
            <td>{new Date(e.timestamp).toLocaleTimeString()}</td>
            <td>{e.request.url}</td>
            <td style={{ maxWidth: 420, wordBreak: 'break-all' }}>{e.request.body}</td>
            <td>
              {!e.submitted ? (
                <Badge tone="info">dry-run</Badge>
              ) : e.verify ? (
                <Badge tone={e.verify.verified ? 'ok' : 'err'}>{e.verify.verified ? 'verified' : 'unconfirmed'}</Badge>
              ) : e.error ? (
                <Badge tone="err">error</Badge>
              ) : (
                <Badge tone="warn">sent</Badge>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DiagnosticsPage({ caps }: PageProps) {
  const [tab, setTab] = useState('identity');
  const ident = caps.identity;
  const flagEntries = useMemo(
    () => Object.entries(caps.flags).sort(([a], [b]) => a.localeCompare(b)),
    [caps.flags],
  );
  return (
    <div>
      <h1 className="mc-page-title">Detection & Write Log</h1>
      <p className="mc-page-subtitle">Detection state, per-page confidence, and the write inspector.</p>
      <Tabs
        tabs={[
          { id: 'identity', label: 'Identity' },
          { id: 'flags', label: `Capability flags (${flagEntries.length})` },
          { id: 'pages', label: 'Page confidence' },
          { id: 'writes', label: 'Write inspector' },
        ]}
        active={tab}
        onSelect={setTab}
      />
      {tab === 'identity' && (
        <Card title="Detected router identity">
          <dl className="mc-kv">
            <dt>Product ID</dt>
            <dd>{ident.productId}</dd>
            <dt>Firmware version</dt>
            <dd>{ident.displayVersion}</dd>
            <dt>Generation</dt>
            <dd>
              {ident.generation === 'asuswrt-50-wifi7'
                ? 'ASUSWRT 5.0 (Wi-Fi 7 hardware)'
                : ident.generation === 'asuswrt-40-wifi6'
                  ? 'ASUSWRT 4.0 (Wi-Fi 6 / 6E hardware)'
                  : 'unknown'}
            </dd>
            <dt>Branch</dt>
            <dd>{ident.branch === 'merlin' ? 'Asuswrt-Merlin' : ident.branch === 'stock' ? 'stock ASUSWRT' : 'unknown'}</dd>
            <dt>LAN address</dt>
            <dd>{ident.lanIp}</dd>
            <dt>Flag source</dt>
            <dd>
              {caps.flagSource === 'main-world'
                ? 'state.js globals (main world) — authoritative'
                : 'rc_support token fallback — numeric flag values unavailable'}
            </dd>
            <dt>Collected</dt>
            <dd>{new Date(caps.collectedAt).toLocaleString()}</dd>
          </dl>
        </Card>
      )}
      {tab === 'flags' && (
        <Card title="Live *_support flags">
          <table className="mc-table mc-table--mono">
            <thead>
              <tr>
                <th>Flag</th>
                <th>Live value</th>
              </tr>
            </thead>
            <tbody>
              {flagEntries.map(([k, v]) => (
                <tr key={k}>
                  <td>{k}</td>
                  <td>{String(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {tab === 'pages' && (
        <Card title="Per-page confidence">
          <PageConfidenceTable />
        </Card>
      )}
      {tab === 'writes' && (
        <Card title="Write inspector">
          <p className="mc-card__note">
            Every write the extension constructs is recorded here — including dry-runs intercepted by read-only mode.
            Neither write endpoint's response body is trusted; “verified” means a forced-fresh nvram re-read confirmed
            the value landed.
          </p>
          <WriteInspector />
        </Card>
      )}
    </div>
  );
}

export function ExtensionSettingsPage(_props: PageProps) {
  const [settings, update] = useAppSettings();
  if (!settings) return null;
  return (
    <div>
      <h1 className="mc-page-title">Extension Settings</h1>
      <p className="mc-page-subtitle">Settings for Merlin's Cloak itself — nothing here touches the router.</p>
      <Card title="Write protection">
        <Row
          label="Read-only mode"
          hint="While on, Apply never sends anything: it shows the exact request that would have been sent."
        >
          <Toggle on={settings.readOnlyMode} onChange={(v) => void update({ readOnlyMode: v })} />
          {settings.readOnlyMode ? <Badge tone="warn">writes blocked</Badge> : <Badge tone="ok">writes enabled</Badge>}
        </Row>
      </Card>
      <Card title="Router address">
        <Row label="Configured address" hint="Change it from the extension's toolbar popup — a custom address needs a host permission grant, which only the popup can request.">
          <TextInput value={settings.routerAddress} onChange={() => undefined} disabled width={200} />
        </Row>
      </Card>
    </div>
  );
}
