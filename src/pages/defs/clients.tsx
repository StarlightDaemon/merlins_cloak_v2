/**
 * Client list — DHCP leases (authoritative hostname/IP) merged with live
 * wireless-station presence from get_wclientlist() (real JSON: bridge → band →
 * station-MAC objects, httpd/web.c ej_get_wclientlist). A MAC present under a
 * band gets that band's badge; everything else with an active lease is shown
 * as wired/unknown — the native networkmap daemon does deeper OUI/type work
 * this build deliberately does not replicate.
 */
import { useCallback, useEffect, useState } from 'react';
import { appGet } from '../../lib/router-io';
import { fetchDhcpLeases, type DhcpLease } from '../../lib/status-feeds';
import type { PageDef, PageProps } from '../types';
import { Badge, Banner, Button, Card, EmptyState, Loading } from '../../ui/components';

type BandName = '2G' | '5G' | '6G' | string;

interface ClientRow {
  mac: string;
  hostname: string;
  ip: string;
  band?: BandName;
}

async function fetchWirelessMacs(): Promise<Map<string, BandName>> {
  const res = await appGet(['get_wclientlist()']);
  const listRaw = res.get_wclientlist;
  const map = new Map<string, BandName>();
  if (listRaw && typeof listRaw === 'object') {
    for (const bridge of Object.values(listRaw as Record<string, unknown>)) {
      if (!bridge || typeof bridge !== 'object') continue;
      for (const [band, stations] of Object.entries(bridge as Record<string, unknown>)) {
        if (!stations || typeof stations !== 'object') continue;
        for (const mac of Object.keys(stations as Record<string, unknown>)) {
          map.set(mac.toUpperCase(), band);
        }
      }
    }
  }
  return map;
}

const BAND_TONE: Record<string, '24' | '5' | '6'> = { '2G': '24', '5G': '5', '6G': '6' };

function ClientsPage(_props: PageProps) {
  const [rows, setRows] = useState<ClientRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [leases, wireless] = await Promise.all([fetchDhcpLeases(), fetchWirelessMacs()]);
      const seen = new Set<string>();
      const out: ClientRow[] = [];
      for (const l of leases as DhcpLease[]) {
        const mac = l.mac.toUpperCase();
        seen.add(mac);
        // dnsmasq lease records use '*' for clients that sent no hostname.
        const hostname = l.hostname === '*' ? '' : l.hostname;
        out.push({ mac, hostname, ip: l.ip, band: wireless.get(mac) });
      }
      // Wireless stations without a DHCP lease (static IPs, IPv6-only).
      for (const [mac, band] of wireless) {
        if (!seen.has(mac)) out.push({ mac, hostname: '', ip: '', band });
      }
      // Named clients first (alphabetical), unnamed last. No sentinel char —
      // Chromium's content-script loader rejects Unicode noncharacters.
      out.sort((a, b) => {
        if (!a.hostname !== !b.hostname) return a.hostname ? -1 : 1;
        return a.hostname.localeCompare(b.hostname) || a.mac.localeCompare(b.mac);
      });
      setRows(out);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 15000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div>
      <h1 className="mc-page-title">Clients</h1>
      <p className="mc-page-subtitle">DHCP leases + live wireless stations</p>
      {error && <Banner tone="err">Failed to read client data: {error}</Banner>}
      <div className="mc-feedbar">
        <Button small onClick={() => void load()}>
          Refresh
        </Button>
      </div>
      {!rows && !error ? (
        <Loading />
      ) : rows ? (
        rows.length === 0 ? (
          <EmptyState>No clients found</EmptyState>
        ) : (
          <Card title={`Known clients (${rows.length})`}>
            <table className="mc-table mc-table--mono">
              <thead>
                <tr>
                  <th>Hostname</th>
                  <th>IP address</th>
                  <th>MAC address</th>
                  <th>Connection</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.mac}>
                    <td>{r.hostname || <span style={{ opacity: 0.5 }}>—</span>}</td>
                    <td>{r.ip || '—'}</td>
                    <td>{r.mac}</td>
                    <td>
                      {r.band ? (
                        <Badge tone={BAND_TONE[r.band]}>{r.band === '2G' ? '2.4 GHz' : r.band === '5G' ? '5 GHz' : r.band === '6G' ? '6 GHz' : r.band}</Badge>
                      ) : (
                        <Badge tone="wired">wired / lease</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mc-card__note">
              Wireless presence is live; entries without a band badge hold a DHCP lease but may be offline — lease
              presence alone does not prove the device is connected.
            </p>
          </Card>
        )
      ) : null}
    </div>
  );
}

export const clientsPages: PageDef[] = [
  {
    kind: 'custom',
    id: 'clients',
    aspPage: 'update_clients.asp',
    title: 'Clients',
    navGroup: 'status',
    navOrder: 2,
    navLabel: 'Clients',
    confidence: { read: 'live-verified' },
    component: ClientsPage,
  },
];
