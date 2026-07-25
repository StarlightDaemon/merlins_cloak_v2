/**
 * QoS Classification (QoS_Stats.asp, Merlin) — per-class live statistics from
 * ajax_gettcdata.asp (ej_tcclass_dump_array in httpd/data_arrays.c):
 *   tcdata_lan_array / tcdata_wan_array rows = [classId, totalBytes, rate, pps]
 * Class-id → label mapping is only well-defined for Traditional QoS
 * (10/20/30/40/50 = Highest…Lowest); Adaptive QoS uses DPI category remapping
 * the native page resolves through bwdpi_app_rulelist — shown here by class id
 * with the DPI mapping deliberately not re-implemented (kept honest rather
 * than guessed).
 */
import { useCallback, useEffect, useState } from 'react';
import { fetchRouterText, nvramGet } from '../../lib/router-io';
import { parseJsArrayAssignments } from '../../lib/status-feeds';
import { fmtBytes } from '../../lib/trafmon';
import type { PageDef, PageProps } from '../types';
import { Banner, Button, Card, EmptyState, Loading } from '../../ui/components';

const TRADITIONAL_LABELS: Record<string, string> = {
  '10': 'Highest',
  '20': 'High',
  '30': 'Medium',
  '40': 'Low',
  '50': 'Lowest',
};

interface TcData {
  lan: string[][];
  wan: string[][];
  qosEnabled: boolean;
  qosType: string;
}

async function fetchTcData(): Promise<TcData> {
  const [nv, text] = await Promise.all([nvramGet(['qos_enable', 'qos_type']), fetchRouterText('/ajax_gettcdata.asp')]);
  const arrays = parseJsArrayAssignments(text);
  const rows = (name: string): string[][] =>
    (arrays[name] ?? []).filter((r): r is string[] => Array.isArray(r) && r.length >= 4).map((r) => r.map(String));
  return {
    lan: rows('tcdata_lan_array'),
    wan: rows('tcdata_wan_array'),
    qosEnabled: nv.qos_enable === '1',
    qosType: nv.qos_type,
  };
}

function ClassTable({ rows, qosType }: { rows: string[][]; qosType: string }) {
  if (rows.length === 0) return <EmptyState>No classes reported</EmptyState>;
  return (
    <table className="mc-table mc-table--mono">
      <thead>
        <tr>
          <th>Class</th>
          <th className="num">Total traffic</th>
          <th className="num">Rate</th>
          <th className="num">Packets/s</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td>
              {qosType === '0' && TRADITIONAL_LABELS[r[0]] ? `${TRADITIONAL_LABELS[r[0]]} (${r[0]})` : `Class ${r[0]}`}
            </td>
            <td className="num">{fmtBytes(Number(r[1]))}</td>
            <td className="num">{r[2]}</td>
            <td className="num">{r[3]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function QosStatsPage(_props: PageProps) {
  const [data, setData] = useState<TcData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setData(await fetchTcData());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);
  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div>
      <h1 className="mc-page-title">Live Priority Statistics</h1>
      <p className="mc-page-subtitle">QoS_Stats.asp · Merlin</p>
      {error && <Banner tone="err">Failed to read ajax_gettcdata.asp: {error}</Banner>}
      {!data && !error ? (
        <Loading />
      ) : data ? (
        !data.qosEnabled ? (
          <Banner tone="info">QoS is disabled — no traffic classes are active.</Banner>
        ) : (
          <>
            {data.qosType === '1' && (
              <Banner tone="info">
                Adaptive QoS class ids map to DPI categories via bwdpi_app_rulelist; the native category names are not
                re-derived here.
              </Banner>
            )}
            <Card title="Download classes (LAN)">
              <ClassTable rows={data.lan} qosType={data.qosType} />
            </Card>
            <Card title="Upload classes (WAN)">
              <ClassTable rows={data.wan} qosType={data.qosType} />
            </Card>
            <div className="mc-feedbar">
              <Button small onClick={() => void load()}>
                Refresh
              </Button>
            </div>
          </>
        )
      ) : null}
    </div>
  );
}

export const qosStatsPages: PageDef[] = [
  {
    kind: 'custom',
    id: 'qos-stats',
    aspPage: 'QoS_Stats.asp',
    title: 'Live Priority Statistics',
    navGroup: 'traffic',
    navSub: 'prioritization',
    navOrder: 50,
    merlinOnly: true,
    confidence: { read: 'live-verified' },
    component: QosStatsPage,
  },
];
