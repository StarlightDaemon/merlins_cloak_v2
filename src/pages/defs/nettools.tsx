/**
 * Network Tools category: Sysinfo (Merlin's Tools_Sysinfo.asp), Analysis
 * (ping/traceroute/nslookup) and Netstat — the RT-BE92U model-overlay pages
 * driving netool.cgi. Diagnostics run only on explicit user action.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { hasFlag } from '../../lib/capabilities';
import { NETOOL_TYPES, netoolPollText, netoolStart } from '../../lib/netool';
import { fetchScalarHooks, fetchSysinfoFeed, type SysinfoSnapshot } from '../../lib/status-feeds';
import type { PageDef, PageProps } from '../types';
import { Badge, Banner, Button, Card, Loading, RadioGroup, Select, TextInput, Toggle } from '../../ui/components';

// --- Sysinfo -----------------------------------------------------------------

interface SysinfoScalars {
  cpuModel: string;
  cpuFreq: string;
  connMax: string;
  nvramTotal: string;
  jffsTotal: string;
  cfeVersion: string;
  hwaccelRunner: string;
  hwaccelFc: string;
  driverVersions: string[];
}

/**
 * sysinfo memory.* values arrive pre-scaled in MB (live-observed, e.g.
 * "993.76"). Joins the number to its unit with a non-breaking space so a
 * figure like "993.76 MB" can never wrap between the number and the unit —
 * it's one atomic byte-size figure, not two separately-wrappable words —
 * the same class of defect as the dashboard's firmware/branch strings, just
 * glued instead of forbidden from wrapping outright, since these figures
 * still need to wrap *between* the "/"-separated triplet.
 */
function fmtMb(v: string): string {
  const n = Number(v);
  if (Number.isNaN(n)) return v || '—';
  if (n >= 1024) return `${(n / 1024).toFixed(2)}\u00A0GB`;
  return `${n}\u00A0MB`;
}

/** Scalar hook output may carry HTML entities (live-observed: cpu.model has &nbsp;). */
function stripEntities(v: string): string {
  return v.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

function SysinfoPage(_props: PageProps) {
  const [feed, setFeed] = useState<SysinfoSnapshot | null>(null);
  const [scalars, setScalars] = useState<SysinfoScalars | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(true);

  const loadFeed = useCallback(async () => {
    try {
      setFeed(await fetchSysinfoFeed());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void loadFeed();
    void (async () => {
      try {
        const s = await fetchScalarHooks([
          'sysinfo("cpu.model")',
          'sysinfo("cpu.freq")',
          'sysinfo("conn.max")',
          'sysinfo("nvram.total")',
          'sysinfo("jffs.total")',
          'sysinfo("cfe_version")',
          'sysinfo("hwaccel.runner")',
          'sysinfo("hwaccel.fc")',
          'sysinfo("driver_version.0")',
          'sysinfo("driver_version.1")',
          'sysinfo("driver_version.2")',
        ]);
        setScalars({
          cpuModel: stripEntities(s['sysinfo-cpu.model'] ?? ''),
          cpuFreq: s['sysinfo-cpu.freq'] ?? '',
          connMax: s['sysinfo-conn.max'] ?? '',
          nvramTotal: s['sysinfo-nvram.total'] ?? '',
          jffsTotal: s['sysinfo-jffs.total'] ?? '',
          cfeVersion: s['sysinfo-cfe_version'] ?? '',
          hwaccelRunner: s['sysinfo-hwaccel.runner'] ?? '',
          hwaccelFc: s['sysinfo-hwaccel.fc'] ?? '',
          driverVersions: [s['sysinfo-driver_version.0'], s['sysinfo-driver_version.1'], s['sysinfo-driver_version.2']].filter(
            (v): v is string => Boolean(v),
          ),
        });
      } catch {
        // Scalars are decorative; the feed is the core view.
      }
    })();
  }, [loadFeed]);

  useEffect(() => {
    if (!polling) return;
    const t = setInterval(() => void loadFeed(), 3000);
    return () => clearInterval(t);
  }, [polling, loadFeed]);

  function renderSysinfo(feed: SysinfoSnapshot) {
    const mem = feed.memStats;
    const bandLabels = ['2.4 GHz', '5 GHz', '6 GHz', 'Radio 3'].slice(0, feed.wifiClients.length);
    return (
      <>
        <div className="mc-feedbar">
          <label className="mc-feedbar__poll">
            <Toggle on={polling} onChange={setPolling} /> auto-refresh (3s)
          </label>
        </div>
        <div className="mc-grid-2">
          <Card title="CPU">
            <dl className="mc-kv-line">
              <div>
                <dt>Model</dt>
                <dd>
                  {scalars?.cpuModel || '—'}
                  {scalars?.cpuFreq ? ` @ ${scalars.cpuFreq}\u00A0MHz` : ''}
                </dd>
              </div>
              <div>
                <dt>Load (1 / 5 / 15 min)</dt>
                <dd>{feed.cpuLoad.join(' / ') || '—'}</dd>
              </div>
              <div>
                <dt>HW acceleration</dt>
                <dd>
                  {scalars?.hwaccelRunner ? `Runner: ${scalars.hwaccelRunner}` : ''}
                  {scalars?.hwaccelFc ? ` · Flow Cache: ${scalars.hwaccelFc}` : ''}
                  {!scalars?.hwaccelRunner && !scalars?.hwaccelFc && '—'}
                </dd>
              </div>
            </dl>
          </Card>
          <Card title="Memory">
            <dl className="mc-kv-line">
              <div>
                <dt>Total / free / available</dt>
                <dd>
                  {fmtMb(mem[0])} / {fmtMb(mem[1])} / {fmtMb(mem[9] ?? '')}
                </dd>
              </div>
              <div>
                <dt>Buffers / cache</dt>
                <dd>
                  {fmtMb(mem[2])} / {fmtMb(mem[3])}
                </dd>
              </div>
              <div>
                <dt>Swap</dt>
                <dd>
                  {fmtMb(mem[4])} / {fmtMb(mem[5])}
                </dd>
              </div>
              <div>
                <dt>nvram usage</dt>
                <dd>
                  {mem[6] || '—'}
                  {scalars?.nvramTotal ? ` / ${scalars.nvramTotal}\u00A0bytes` : ''}
                </dd>
              </div>
              <div>
                <dt>JFFS free</dt>
                <dd>{mem[7] || '—'}</dd>
              </div>
            </dl>
          </Card>
        </div>
        <Card title="Connections">
          <dl className="mc-kv-line">
            <div>
              <dt>Tracked / active</dt>
              <dd>
                {feed.connStats[0] ?? '—'}
                {scalars?.connMax ? ` / ${scalars.connMax}\u00A0max` : ''} ·{' '}
                {`${feed.connStats[1] ?? '—'}\u00A0active`}
              </dd>
            </div>
          </dl>
        </Card>
        <Card title="Wireless clients (associated / authorized / authenticated)">
          <table className="mc-table">
            <tbody>
              {feed.wifiClients.map((counts, i) => (
                <tr key={i}>
                  <td>
                    <Badge tone={i === 0 ? '24' : i === 1 ? '5' : '6'}>{bandLabels[i] ?? `Radio ${i}`}</Badge>
                  </td>
                  <td className="num">{counts.join(' / ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        {(scalars?.cfeVersion || (scalars?.driverVersions.length ?? 0) > 0) && (
          <Card title="Firmware components">
            <dl className="mc-kv-line">
              <div>
                <dt>Bootloader (CFE)</dt>
                <dd className="mc-nowrap">{scalars?.cfeVersion || '—'}</dd>
              </div>
              <div>
                <dt>Wireless driver</dt>
                <dd>
                  {scalars?.driverVersions.length
                    ? scalars.driverVersions.map((v, i) => (
                        <span key={i}>
                          {i > 0 ? ' · ' : ''}
                          <span className="mc-nowrap">{v}</span>
                        </span>
                      ))
                    : '—'}
                </dd>
              </div>
            </dl>
          </Card>
        )}
      </>
    );
  }

  return (
    <div>
      <h1 className="mc-page-title">Router Resources</h1>
      <p className="mc-page-subtitle">Tools_Sysinfo.asp · Merlin</p>
      {error ? (
        <Banner tone="err">Failed to read ajax_sysinfo.asp: {error}</Banner>
      ) : !feed ? (
        <Loading />
      ) : (
        renderSysinfo(feed)
      )}
    </div>
  );
}

// --- Analysis (ping / traceroute / nslookup) --------------------------------

function AnalysisPage(_props: PageProps) {
  const [method, setMethod] = useState<string>(NETOOL_TYPES.ping);
  const [target, setTarget] = useState('');
  const [count, setCount] = useState('5');
  const [ver, setVer] = useState<'v4' | 'v6'>('v4');
  const [output, setOutput] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);

  const run = useCallback(async () => {
    if (!target.trim() || running) return;
    setRunning(true);
    setError(null);
    setOutput('');
    abortRef.current = false;
    try {
      const file = await netoolStart({
        type: method,
        target: target.trim(),
        pcnt: method === NETOOL_TYPES.ping ? count : undefined,
        ver: method !== NETOOL_TYPES.nslookup ? ver : '',
      });
      await netoolPollText(file, (text) => {
        if (!abortRef.current) setOutput(text);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }, [method, target, count, ver, running]);

  useEffect(() => () => {
    abortRef.current = true;
  }, []);

  return (
    <div>
      <h1 className="mc-page-title">Ping, Traceroute & DNS Lookup</h1>
      <p className="mc-page-subtitle">Main_Analysis_Content.asp</p>
      <Card title="Diagnostic">
        <div className="mc-row">
          <div className="mc-row__label">Method</div>
          <div className="mc-row__control">
            <Select
              value={method}
              onChange={setMethod}
              options={[
                { value: NETOOL_TYPES.ping, label: 'Ping' },
                { value: NETOOL_TYPES.traceroute, label: 'Traceroute' },
                { value: NETOOL_TYPES.nslookup, label: 'Nslookup' },
              ]}
            />
            {method !== NETOOL_TYPES.nslookup && (
              <RadioGroup
                value={ver}
                onChange={(v) => setVer(v as 'v4' | 'v6')}
                options={[
                  { value: 'v4', label: 'IPv4' },
                  { value: 'v6', label: 'IPv6' },
                ]}
              />
            )}
          </div>
        </div>
        <div className="mc-row">
          <div className="mc-row__label">Target</div>
          <div className="mc-row__control">
            <TextInput value={target} onChange={setTarget} placeholder="e.g. www.google.com or 1.1.1.1" width={280} />
            {method === NETOOL_TYPES.ping && (
              <>
                <span style={{ color: 'var(--text-secondary)' }}>count</span>
                <TextInput value={count} onChange={setCount} width={60} />
              </>
            )}
            <Button variant="primary" onClick={() => void run()} disabled={running || !target.trim()}>
              {running ? 'Running…' : 'Run'}
            </Button>
          </div>
        </div>
        {error && <Banner tone="err">{error}</Banner>}
        {(output || running) && <pre className="mc-logview">{output || 'Waiting for output…'}</pre>}
      </Card>
      <Banner tone="info">
        Diagnostics execute on the router itself via its native netool.cgi endpoint — identical to the stock Network
        Tools page. Nothing runs without pressing Run.
      </Banner>
    </div>
  );
}

// --- Netstat -----------------------------------------------------------------

function NetstatPage(_props: PageProps) {
  const [mode, setMode] = useState<string>(NETOOL_TYPES.netstat);
  const [output, setOutput] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setError(null);
    setOutput('');
    try {
      const file = await netoolStart({ type: mode, target: 'localhost' });
      await netoolPollText(file, setOutput);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }, [mode, running]);

  return (
    <div>
      <h1 className="mc-page-title">Open Sockets & NAT Table</h1>
      <p className="mc-page-subtitle">Main_Netstat_Content.asp</p>
      <Card title="Socket / NAT table">
        <div className="mc-row">
          <div className="mc-row__label">Mode</div>
          <div className="mc-row__control">
            <RadioGroup
              value={mode}
              onChange={setMode}
              options={[
                { value: NETOOL_TYPES.netstat, label: 'Netstat' },
                { value: NETOOL_TYPES.netstatNat, label: 'Netstat-NAT' },
              ]}
            />
            <Button variant="primary" onClick={() => void run()} disabled={running}>
              {running ? 'Running…' : 'Run'}
            </Button>
          </div>
        </div>
        {error && <Banner tone="err">{error}</Banner>}
        {(output || running) && <pre className="mc-logview">{output || 'Waiting for output…'}</pre>}
      </Card>
    </div>
  );
}

export const nettoolsPages: PageDef[] = [
  {
    kind: 'custom',
    id: 'sysinfo',
    aspPage: 'Tools_Sysinfo.asp',
    title: 'Router Resources',
    navGroup: 'status',
    navOrder: 3,
    merlinOnly: true,
    confidence: { read: 'live-verified' },
    component: SysinfoPage,
  },
  {
    kind: 'custom',
    id: 'analysis',
    aspPage: 'Main_Analysis_Content.asp',
    title: 'Ping, Traceroute & DNS Lookup',
    navGroup: 'nettools',
    navOrder: 62,
    confidence: { read: 'live-verified' },
    gate: (c) => hasFlag(c, 'netool_support') || c.rcSupport.has('netool'),
    component: AnalysisPage,
  },
  {
    kind: 'custom',
    id: 'netstat',
    aspPage: 'Main_Netstat_Content.asp',
    title: 'Open Sockets & NAT Table',
    navGroup: 'nettools',
    navOrder: 63,
    confidence: { read: 'live-verified' },
    gate: (c) => hasFlag(c, 'netool_support') || c.rcSupport.has('netool'),
    component: NetstatPage,
  },
];
