/**
 * Site Survey (Advanced_Wireless_Survey.asp, Merlin / SITE_SURVEY function).
 * Results come from /apscan.asp: `aplist = [<% get_ap_info(); %>][0]` with
 * columns [band, ssid(URI-encoded), channel, auth, encryption, signal, mac,
 * phyMode] (from the page's own render code). `wlc_scan_state` reads 5 when a
 * scan cycle is complete. A rescan is triggered with rc_service
 * restart_wlcscan — routed through the write-guard (dry-run in read-only
 * mode); it starts a radio scan but changes no configuration.
 */
import { useCallback, useEffect, useState } from 'react';
import { fetchRouterText } from '../../lib/router-io';
import { parseJsArrayAssignments, parseJsScalarAssignments } from '../../lib/status-feeds';
import { guardedWrite, isReadOnlyMode } from '../../lib/write-guard';
import type { PageDef, PageProps } from '../types';
import { Badge, Banner, Button, Card, EmptyState, Loading } from '../../ui/components';

interface ApEntry {
  band: string;
  ssid: string;
  channel: string;
  auth: string;
  enc: string;
  signal: string;
  mac: string;
  mode: string;
}

async function fetchApScan(): Promise<{ aps: ApEntry[]; scanState: string }> {
  const text = await fetchRouterText('/apscan.asp');
  const arrays = parseJsArrayAssignments(text);
  const scalars = parseJsScalarAssignments(text);
  let rows = (arrays.aplist ?? []).filter((r): r is string[] => Array.isArray(r));
  // The page wraps the hook as [<rows>][0]; our parser reads the outer array,
  // so a single fully-nested element needs unwrapping.
  if (rows.length === 1 && Array.isArray(rows[0][0])) rows = rows[0] as unknown as string[][];
  const aps = rows
    .filter((r) => r.length >= 7 && r[1] != null)
    .map((r) => {
      let ssid = String(r[1] ?? '');
      try {
        ssid = decodeURIComponent(ssid);
      } catch {
        // keep raw if the firmware's escaping is not URI-clean
      }
      return {
        band: String(r[0] ?? ''),
        ssid,
        channel: String(r[2] ?? ''),
        auth: String(r[3] ?? ''),
        enc: String(r[4] ?? ''),
        signal: String(r[5] ?? ''),
        mac: String(r[6] ?? ''),
        mode: String(r[7] ?? ''),
      };
    });
  return { aps, scanState: scalars.wlc_scan_state ?? '' };
}

const BAND_TONE: Record<string, '24' | '5' | '6'> = { '2G': '24', '5G': '5', '6G': '6' };

function SiteSurveyPage(_props: PageProps) {
  const [data, setData] = useState<{ aps: ApEntry[]; scanState: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await fetchApScan();
      setData(d);
      setError(null);
      if (d.scanState === '5') setScanning(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!scanning) return;
    const t = setInterval(() => void load(), 3000);
    return () => clearInterval(t);
  }, [scanning, load]);

  const rescan = useCallback(async () => {
    const result = await guardedWrite(
      {
        endpoint: 'applyapp',
        fields: { flag: 'sitesurvey' },
        rcService: 'restart_wlcscan',
        currentPage: 'Advanced_Wireless_Survey.asp',
      },
      null,
    );
    if (result.dryRun) {
      setNotice(`Read-only mode — rescan request previewed, not sent: POST ${result.entry.request.url} · ${result.entry.request.body}`);
    } else if (result.entry.submitted) {
      setNotice(null);
      setScanning(true);
    }
  }, []);

  return (
    <div>
      <h1 className="mc-page-title">Nearby Wi-Fi Scan</h1>
      <p className="mc-page-subtitle">Advanced_Wireless_Survey.asp · Merlin</p>
      <div className="mc-feedbar">
        <Button small variant="primary" onClick={() => void rescan()}>
          {isReadOnlyMode() ? 'Preview rescan' : 'Rescan'}
        </Button>
        <Button small onClick={() => void load()}>
          Refresh results
        </Button>
        {scanning && <span style={{ color: 'var(--text-secondary)' }}>Scanning…</span>}
      </div>
      {notice && <Banner tone="info">{notice}</Banner>}
      {error && <Banner tone="err">Failed to read apscan.asp: {error}</Banner>}
      {!data && !error ? (
        <Loading />
      ) : data ? (
        data.aps.length === 0 ? (
          <EmptyState>No scan results (run a rescan, or a scan may be in progress)</EmptyState>
        ) : (
          <Card title={`Nearby access points (${data.aps.length})`}>
            <table className="mc-table mc-table--mono">
              <thead>
                <tr>
                  <th>Band</th>
                  <th>SSID</th>
                  <th className="num">Channel</th>
                  <th>Security</th>
                  <th className="num">Signal</th>
                  <th>MAC</th>
                </tr>
              </thead>
              <tbody>
                {data.aps.map((ap, i) => (
                  <tr key={i}>
                    <td>
                      <Badge tone={BAND_TONE[ap.band]}>{ap.band}</Badge>
                    </td>
                    <td>{ap.ssid || <em>[hidden]</em>}</td>
                    <td className="num">
                      {ap.channel}
                      {ap.mode ? ` (${ap.mode})` : ''}
                    </td>
                    <td>
                      {ap.auth}
                      {ap.enc && ap.enc !== 'NONE' ? ` / ${ap.enc}` : ''}
                    </td>
                    <td className="num">{ap.signal}</td>
                    <td>{ap.mac}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )
      ) : null}
    </div>
  );
}

export const siteSurveyPages: PageDef[] = [
  {
    kind: 'custom',
    id: 'site-survey',
    aspPage: 'Advanced_Wireless_Survey.asp',
    title: 'Nearby Wi-Fi Scan',
    navGroup: 'wireless',
    navSub: 'radio',
    navOrder: 7,
    merlinOnly: true,
    confidence: { read: 'live-verified', write: 'unverified-write' },
    writeExclusion: null,
    component: SiteSurveyPage,
  },
];
