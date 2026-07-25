/**
 * Traffic Analyzer category — the classic Tomato-heritage traffic monitor
 * Merlin keeps: realtime (netdev polling), last 24h speeds, daily and monthly
 * rstats history, plus the declarative rstats settings page.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchDailyHistory,
  fetchMonthlyHistory,
  fetchNetdev,
  fetchSpeedHistory,
  fmtBytes,
  fmtRate,
  unpackDate,
  type HistoryEntry,
  type NetdevCounters,
} from '../../lib/trafmon';
import type { Capabilities } from '../../lib/capabilities';
import type { PageDef, PageProps, SettingsPageDef } from '../types';
import { Banner, Button, Card, EmptyState, Loading, Select } from '../../ui/components';

/**
 * The dissolved Traffic Analyzer category's gate, moved onto its pages
 * unchanged when the category merged into Traffic & Bandwidth (the QoS pages
 * sharing the merged category are not gated by it). Same truthiness rules the
 * registry's old per-category gate used.
 */
function trafficHistoryGate(c: Capabilities): boolean {
  const v = c.flags['traffic_analyzer_support'];
  const truthy = v === undefined ? false : typeof v === 'string' ? v !== '' && v !== '0' : Boolean(v);
  return truthy || c.identity.branch === 'merlin';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Minimal SVG area chart for rate series. */
function RateChart({ rx, tx, height = 140 }: { rx: number[]; tx: number[]; height?: number }) {
  const width = 640;
  const max = Math.max(1, ...rx, ...tx);
  const toPath = (series: number[]): string => {
    if (series.length < 2) return '';
    const step = width / (series.length - 1);
    return series
      .map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(height - (v / max) * (height - 8)).toFixed(1)}`)
      .join(' ');
  };
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mc-ratechart" preserveAspectRatio="none">
      <path d={toPath(rx)} fill="none" stroke="var(--badge-24)" strokeWidth={1.5} />
      <path d={toPath(tx)} fill="none" stroke="var(--badge-5)" strokeWidth={1.5} />
    </svg>
  );
}

// --- Realtime ----------------------------------------------------------------

const RT_WINDOW = 120; // samples kept (~4 min at 2s)

function RealtimePage(_props: PageProps) {
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>('INTERNET');
  const [, forceRender] = useState(0);
  const prev = useRef<NetdevCounters | null>(null);
  const series = useRef<Record<string, { rx: number[]; tx: number[] }>>({});
  const latest = useRef<Record<string, { rx: number; tx: number }>>({});

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const now = await fetchNetdev();
        if (stop) return;
        if (prev.current) {
          for (const [ifname, c] of Object.entries(now)) {
            const p = prev.current[ifname];
            if (!p) continue;
            const rxRate = Math.max(0, (c.rx - p.rx) / 2);
            const txRate = Math.max(0, (c.tx - p.tx) / 2);
            const s = (series.current[ifname] ??= { rx: [], tx: [] });
            s.rx.push(rxRate);
            s.tx.push(txRate);
            if (s.rx.length > RT_WINDOW) {
              s.rx.shift();
              s.tx.shift();
            }
            latest.current[ifname] = { rx: rxRate, tx: txRate };
          }
        }
        prev.current = now;
        setError(null);
        forceRender((n) => n + 1);
      } catch (e) {
        if (!stop) setError(e instanceof Error ? e.message : String(e));
      }
    };
    void tick();
    const t = setInterval(() => void tick(), 2000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);

  const ifnames = Object.keys(series.current);
  const sel = series.current[selected] ?? { rx: [], tx: [] };

  return (
    <div>
      <h1 className="mc-page-title">Live Throughput</h1>
      <p className="mc-page-subtitle">Main_TrafficMonitor_realtime.asp</p>
      {error && <Banner tone="err">Failed to read update.cgi: {error}</Banner>}
      {ifnames.length === 0 && !error ? (
        <Loading label="Sampling interface counters…" />
      ) : (
        <>
          <Card
            title={
              <>
                Throughput
                <Select
                  value={selected}
                  onChange={setSelected}
                  options={ifnames.map((n) => ({ value: n, label: n }))}
                />
                <span className="mc-legend">
                  <span className="mc-legend__swatch is-rx" /> RX <span className="mc-legend__swatch is-tx" /> TX
                </span>
              </>
            }
          >
            <RateChart rx={sel.rx} tx={sel.tx} />
            <p className="mc-card__note">
              Current: ↓ {fmtRate(latest.current[selected]?.rx ?? 0)} · ↑ {fmtRate(latest.current[selected]?.tx ?? 0)} ·
              window ~{Math.round((sel.rx.length * 2) / 60)} min
            </p>
          </Card>
          <Card title="All interfaces">
            <table className="mc-table">
              <thead>
                <tr>
                  <th>Interface</th>
                  <th className="num">Download</th>
                  <th className="num">Upload</th>
                </tr>
              </thead>
              <tbody>
                {ifnames.map((n) => (
                  <tr key={n}>
                    <td>{n}</td>
                    <td className="num">{fmtRate(latest.current[n]?.rx ?? 0)}</td>
                    <td className="num">{fmtRate(latest.current[n]?.tx ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}

// --- Last 24 hours -----------------------------------------------------------

function Last24Page(_props: PageProps) {
  const [data, setData] = useState<Record<string, { rx: number[]; tx: number[] }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState('');

  const load = useCallback(async () => {
    try {
      const d = await fetchSpeedHistory();
      setData(d);
      setSelected((s) => (s && d[s] ? s : Object.keys(d)[0] ?? ''));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <Banner tone="err">Failed to read speed history: {error}</Banner>;
  if (!data) return <Loading />;
  const names = Object.keys(data);
  const sel = data[selected];

  return (
    <div>
      <h1 className="mc-page-title">Last 24 Hours</h1>
      <p className="mc-page-subtitle">Main_TrafficMonitor_last24.asp</p>
      <div className="mc-feedbar">
        <Button small onClick={() => void load()}>
          Refresh
        </Button>
      </div>
      {names.length === 0 ? (
        <EmptyState>No speed history recorded (rstats may be disabled)</EmptyState>
      ) : (
        <Card
          title={
            <>
              Average speeds
              <Select value={selected} onChange={setSelected} options={names.map((n) => ({ value: n, label: n }))} />
            </>
          }
        >
          {sel && <RateChart rx={sel.rx.map((v) => v / 120)} tx={sel.tx.map((v) => v / 120)} />}
          {sel && (
            <p className="mc-card__note">
              {sel.rx.length} samples (2-minute buckets) · peak ↓ {fmtRate(Math.max(0, ...sel.rx) / 120)} · peak ↑{' '}
              {fmtRate(Math.max(0, ...sel.tx) / 120)}
            </p>
          )}
        </Card>
      )}
    </div>
  );
}

// --- Daily / monthly history -------------------------------------------------

function HistoryTable({ entries, monthly }: { entries: HistoryEntry[]; monthly?: boolean }) {
  if (entries.length === 0) return <EmptyState>No history recorded (rstats may be disabled)</EmptyState>;
  return (
    <table className="mc-table">
      <thead>
        <tr>
          <th>{monthly ? 'Month' : 'Date'}</th>
          <th className="num">Download</th>
          <th className="num">Upload</th>
          <th className="num">Total</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e) => {
          const d = unpackDate(e.packed);
          return (
            <tr key={e.packed}>
              <td>
                {monthly
                  ? `${MONTHS[d.month] ?? d.month + 1} ${d.year}`
                  : `${d.year}-${String(d.month + 1).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`}
              </td>
              <td className="num">{fmtBytes(e.rx)}</td>
              <td className="num">{fmtBytes(e.tx)}</td>
              <td className="num">{fmtBytes(e.rx + e.tx)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function historyPage(
  title: string,
  aspPage: string,
  loader: () => Promise<HistoryEntry[]>,
  monthly?: boolean,
): (props: PageProps) => React.ReactNode {
  return function HistoryPage(_props: PageProps) {
    const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
      loader()
        .then(setEntries)
        .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    }, []);
    return (
      <div>
        <h1 className="mc-page-title">{title}</h1>
        <p className="mc-page-subtitle">{aspPage}</p>
        {error && <Banner tone="err">Failed to read history: {error}</Banner>}
        {!entries && !error ? <Loading /> : entries ? <Card title="Usage"><HistoryTable entries={entries} monthly={monthly} /></Card> : null}
      </div>
    );
  };
}

const DailyPage = historyPage('Daily Usage', 'Main_TrafficMonitor_daily.asp', fetchDailyHistory);
const MonthlyPage = historyPage('Monthly Usage', 'Main_TrafficMonitor_monthly.asp', fetchMonthlyHistory, true);

// --- rstats settings (declarative) ------------------------------------------

const trafficSettingsPage: SettingsPageDef = {
  kind: 'settings',
  id: 'traffic-settings',
  aspPage: 'Main_TrafficMonitor_settings.asp',
  title: 'History Recording Settings',
  navGroup: 'traffic',
  navSub: 'monitoring',
  navOrder: 46,
  merlinOnly: true,
  gate: trafficHistoryGate,
  confidence: { read: 'live-verified', write: 'unverified-write' },
  writeExclusion: null,
  read: {
    nvram: ['rstats_enable', 'rstats_path', 'rstats_stime', 'rstats_offset', 'rstats_data', 'rstats_colors', 'rstats_exclude', 'rstats_bak'],
  },
  sections: [
    {
      title: 'Traffic history',
      note: 'rstats collection — Merlin re-exposes the Tomato traffic history engine.',
      fields: [
        {
          key: 'rstats_enable',
          label: 'Enable traffic history',
          control: 'radio',
          options: [
            { value: '1', label: 'Yes' },
            { value: '0', label: 'No' },
          ],
        },
        {
          key: 'rstats_path',
          label: 'Save history location',
          hint: 'Empty = RAM (lost on reboot). A mounted path like /mnt/sda1/ persists it.',
          control: 'text',
          validate: { maxLength: 90 },
        },
        {
          key: 'rstats_stime',
          label: 'Save frequency',
          control: 'select',
          options: [
            { value: '1', label: 'Every hour' },
            { value: '2', label: 'Every 2 hours' },
            { value: '3', label: 'Every 3 hours' },
            { value: '4', label: 'Every 4 hours' },
            { value: '5', label: 'Every 5 hours' },
            { value: '6', label: 'Every 6 hours' },
            { value: '9', label: 'Every 9 hours' },
            { value: '12', label: 'Every 12 hours' },
            { value: '24', label: 'Every 24 hours' },
            { value: '48', label: 'Every 2 days' },
            { value: '72', label: 'Every 3 days' },
            { value: '96', label: 'Every 4 days' },
            { value: '120', label: 'Every 5 days' },
            { value: '144', label: 'Every 6 days' },
            { value: '168', label: 'Every week' },
          ],
        },
        {
          key: 'rstats_offset',
          label: 'First day of monthly cycle',
          control: 'number',
          validate: { min: 1, max: 31 },
        },
        { key: 'rstats_bak', label: 'Create backups of history file', control: 'toggle' },
        {
          key: 'rstats_exclude',
          label: 'Excluded interfaces',
          hint: 'Comma-separated interface names to skip',
          control: 'text',
          validate: { maxLength: 64 },
        },
      ],
    },
  ],
  write: {
    endpoint: 'applyapp',
    rcService: 'restart_rstats',
  },
};

export const trafficPages: PageDef[] = [
  {
    kind: 'custom',
    id: 'traffic-realtime',
    aspPage: 'Main_TrafficMonitor_realtime.asp',
    title: 'Live Throughput',
    navGroup: 'traffic',
    navSub: 'monitoring',
    navOrder: 42,
    gate: trafficHistoryGate,
    confidence: { read: 'live-verified' },
    component: RealtimePage,
  },
  {
    kind: 'custom',
    id: 'traffic-last24',
    aspPage: 'Main_TrafficMonitor_last24.asp',
    title: 'Last 24 Hours',
    navGroup: 'traffic',
    navSub: 'monitoring',
    navOrder: 43,
    gate: trafficHistoryGate,
    confidence: { read: 'live-verified' },
    component: Last24Page,
  },
  {
    kind: 'custom',
    id: 'traffic-daily',
    aspPage: 'Main_TrafficMonitor_daily.asp',
    title: 'Daily Usage',
    navGroup: 'traffic',
    navSub: 'monitoring',
    navOrder: 44,
    gate: trafficHistoryGate,
    confidence: { read: 'live-verified' },
    component: DailyPage,
  },
  {
    kind: 'custom',
    id: 'traffic-monthly',
    aspPage: 'Main_TrafficMonitor_monthly.asp',
    title: 'Monthly Usage',
    navGroup: 'traffic',
    navSub: 'monitoring',
    navOrder: 45,
    merlinOnly: true,
    gate: trafficHistoryGate,
    confidence: { read: 'live-verified' },
    component: MonthlyPage,
  },
  trafficSettingsPage,
];
