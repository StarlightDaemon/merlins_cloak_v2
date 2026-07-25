/**
 * System Log category — the seven native log views, each a custom read-only
 * page over the status feeds (lib/status-feeds.ts). Mirrors the native tab
 * set: General Log, Wireless Log, DHCP Leases, IPv6, Routing Table, Port
 * Forwarding, Connections.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchConnections,
  fetchDhcpLeases,
  fetchIpv6Status,
  fetchRoutes,
  fetchSyslog,
  fetchUpnpForwards,
  fetchVServer,
  fetchWirelessStatus,
  type ConnEntry,
  type DhcpLease,
  type RouteEntry,
  type UpnpEntry,
  type VServerEntry,
} from '../../lib/status-feeds';
import type { PageDef, PageProps } from '../types';
import { Badge, Banner, Button, Card, EmptyState, Loading, Toggle } from '../../ui/components';

/** Shared shell: load-on-mount + optional polling + refresh & error states. */
function useFeed<T>(loader: () => Promise<T>, pollMs?: number, polling?: boolean) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const reload = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      setData(await loader());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      busyRef.current = false;
    }
  }, [loader]);
  useEffect(() => {
    void reload();
  }, [reload]);
  useEffect(() => {
    if (!pollMs || !polling) return;
    const t = setInterval(() => void reload(), pollMs);
    return () => clearInterval(t);
  }, [pollMs, polling, reload]);
  return { data, error, reload };
}

function FeedPage<T>({
  title,
  aspPage,
  loader,
  pollMs,
  children,
  note,
}: {
  title: string;
  aspPage: string;
  loader: () => Promise<T>;
  pollMs?: number;
  note?: string;
  children: (data: T) => React.ReactNode;
}) {
  const [polling, setPolling] = useState(false);
  const { data, error, reload } = useFeed(loader, pollMs, polling);
  return (
    <div>
      <h1 className="mc-page-title">{title}</h1>
      <p className="mc-page-subtitle">{aspPage}</p>
      {note && <Banner tone="info">{note}</Banner>}
      <div className="mc-feedbar">
        <Button small onClick={() => void reload()}>
          Refresh
        </Button>
        {pollMs !== undefined && (
          <label className="mc-feedbar__poll">
            <Toggle on={polling} onChange={setPolling} /> auto-refresh
          </label>
        )}
      </div>
      {error && <Banner tone="err">Failed to read from router: {error}</Banner>}
      {!data && !error ? <Loading /> : data ? children(data) : null}
    </div>
  );
}

// --- General syslog ---------------------------------------------------------

function GeneralLogPage(_props: PageProps) {
  const [filter, setFilter] = useState('');
  return (
    <FeedPage title="System Log" aspPage="Main_LogStatus_Content.asp" loader={fetchSyslog} pollMs={5000}>
      {(log) => {
        const lines = log.split('\n');
        const shown = filter ? lines.filter((l) => l.toLowerCase().includes(filter.toLowerCase())) : lines;
        return (
          <Card
            title={
              <>
                Log
                <input
                  className="mc-input"
                  style={{ marginLeft: 'auto', width: 240, fontWeight: 'normal' }}
                  placeholder="filter lines…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  spellCheck={false}
                />
                <Button
                  small
                  onClick={() => {
                    const blob = new Blob([log], { type: 'text/plain' });
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = 'syslog.txt';
                    a.click();
                    URL.revokeObjectURL(a.href);
                  }}
                >
                  Download
                </Button>
              </>
            }
          >
            <pre className="mc-logview">{shown.join('\n')}</pre>
            <p className="mc-card__note">
              {shown.length} / {lines.length} lines
            </p>
          </Card>
        );
      }}
    </FeedPage>
  );
}

// --- Wireless log ------------------------------------------------------------

function WirelessLogPage(_props: PageProps) {
  return (
    <FeedPage
      title="Wireless Status Log"
      aspPage="Main_WStatus_Content.asp"
      loader={fetchWirelessStatus}
      pollMs={8000}
    >
      {({ arrays, raw }) => {
        const names = Object.keys(arrays).filter((k) => arrays[k].length > 0);
        if (names.length === 0) {
          // Model-specific hook output didn't parse as arrays — show raw.
          const text = raw.replace(/^\s*"?/, '').replace(/"?\s*$/, '');
          return (
            <Card title="Wireless status (raw)">
              <pre className="mc-logview">{text || '(empty)'}</pre>
            </Card>
          );
        }
        return (
          <>
            {names.map((name) => (
              <Card key={name} title={name}>
                <table className="mc-table mc-table--mono">
                  <tbody>
                    {arrays[name].map((row, i) => (
                      <tr key={i}>
                        {row.map((cell, j) => (
                          <td key={j}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            ))}
          </>
        );
      }}
    </FeedPage>
  );
}

// --- DHCP leases -------------------------------------------------------------

function fmtLease(expires: string): string {
  const s = Number(expires);
  if (Number.isNaN(s)) return expires;
  if (s <= 0) return 'expired';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m ${s % 60}s`;
}

function DhcpLeasesPage(_props: PageProps) {
  return (
    <FeedPage
      title="Active DHCP Leases"
      aspPage="Main_DHCPStatus_Content.asp"
      loader={fetchDhcpLeases}
      pollMs={10000}
    >
      {(leases: DhcpLease[]) =>
        leases.length === 0 ? (
          <EmptyState>No active leases</EmptyState>
        ) : (
          <Card title={`Active leases (${leases.length})`}>
            <table className="mc-table mc-table--mono">
              <thead>
                <tr>
                  <th>Hostname</th>
                  <th>MAC address</th>
                  <th>IP address</th>
                  <th>Lease remaining</th>
                </tr>
              </thead>
              <tbody>
                {leases.map((l, i) => (
                  <tr key={i}>
                    <td>{l.hostname || <span style={{ opacity: 0.5 }}>—</span>}</td>
                    <td>{l.mac}</td>
                    <td>{l.ip}</td>
                    <td>{fmtLease(l.expires)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )
      }
    </FeedPage>
  );
}

// --- IPv6 --------------------------------------------------------------------

function Ipv6StatusPage(_props: PageProps) {
  return (
    <FeedPage title="IPv6 Status" aspPage="Main_IPV6Status_Content.asp" loader={fetchIpv6Status}>
      {({ cfg, clients }) => (
        <>
          <Card title="IPv6 configuration">
            {cfg.length === 0 ? (
              <EmptyState>IPv6 is disabled or unconfigured</EmptyState>
            ) : (
              <table className="mc-table mc-table--mono">
                <tbody>
                  {cfg.map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
          <Card title={`IPv6 LAN clients (${clients.length})`}>
            {clients.length === 0 ? (
              <EmptyState>No IPv6 clients</EmptyState>
            ) : (
              <table className="mc-table mc-table--mono">
                <tbody>
                  {clients.map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}
    </FeedPage>
  );
}

// --- Routing table -----------------------------------------------------------

function RouteTable({ entries }: { entries: RouteEntry[] }) {
  if (entries.length === 0) return <EmptyState>No routes</EmptyState>;
  return (
    <table className="mc-table mc-table--mono">
      <thead>
        <tr>
          <th>Destination</th>
          <th>Gateway</th>
          <th>Flags</th>
          <th className="num">Metric</th>
          <th>Interface</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((r, i) => (
          <tr key={i}>
            <td>{r.dest}</td>
            <td>{r.gateway || '*'}</td>
            <td>{r.flags}</td>
            <td className="num">{r.metric}</td>
            <td>
              {r.dev ? <Badge tone="info">{r.dev}</Badge> : null} {r.ifname}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RoutingTablePage(_props: PageProps) {
  return (
    <FeedPage title="Routing Table" aspPage="Main_RouteStatus_Content.asp" loader={fetchRoutes}>
      {({ v4, v6 }) => (
        <>
          <Card title={`IPv4 routes (${v4.length})`}>
            <RouteTable entries={v4} />
          </Card>
          <Card title={`IPv6 routes (${v6.length})`}>
            <RouteTable entries={v6} />
          </Card>
        </>
      )}
    </FeedPage>
  );
}

// --- Port forwarding ---------------------------------------------------------

function PortForwardsPage(_props: PageProps) {
  const loader = useCallback(async () => {
    const [vserver, upnp] = await Promise.all([fetchVServer(), fetchUpnpForwards()]);
    return { vserver, upnp };
  }, []);
  return (
    <FeedPage title="Active Port Forwards" aspPage="Main_IPTStatus_Content.asp" loader={loader}>
      {({ vserver, upnp }: { vserver: VServerEntry[]; upnp: UpnpEntry[] }) => (
        <>
          <Card title={`Active NAT forwards (${vserver.length})`}>
            {vserver.length === 0 ? (
              <EmptyState>No active port forwards</EmptyState>
            ) : (
              <table className="mc-table mc-table--mono">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Destination</th>
                    <th>Proto</th>
                    <th>Port range</th>
                    <th>Redirect to</th>
                    <th>Local port</th>
                    <th>Chain</th>
                  </tr>
                </thead>
                <tbody>
                  {vserver.map((v, i) => (
                    <tr key={i}>
                      <td>{v.src}</td>
                      <td>{v.dst}</td>
                      <td>{v.proto}</td>
                      <td>{v.portRange}</td>
                      <td>{v.redirectTo}</td>
                      <td>{v.localPort}</td>
                      <td>{v.chain}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
          <Card title={`UPnP / NAT-PMP leases (${upnp.length})`}>
            {upnp.length === 0 ? (
              <EmptyState>No UPnP forwards</EmptyState>
            ) : (
              <table className="mc-table mc-table--mono">
                <thead>
                  <tr>
                    <th>Proto</th>
                    <th>Remote</th>
                    <th>Ext. port</th>
                    <th>Internal</th>
                    <th>Int. port</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {upnp.map((u, i) => (
                    <tr key={i}>
                      <td>{u.proto}</td>
                      <td>{u.remoteAddr}</td>
                      <td>{u.remotePort}</td>
                      <td>{u.internalAddr}</td>
                      <td>{u.internalPort}</td>
                      <td>{u.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}
    </FeedPage>
  );
}

// --- Connections -------------------------------------------------------------

function ConnectionsPage(_props: PageProps) {
  const [filter, setFilter] = useState('');
  return (
    <FeedPage
      title="Active Connections"
      aspPage="Main_ConnStatus_Content.asp"
      loader={fetchConnections}
      pollMs={8000}
      note="Live conntrack table. Entries include external addresses of active connections."
    >
      {(conns: ConnEntry[]) => {
        const shown = filter
          ? conns.filter((c) => `${c.proto} ${c.src} ${c.dst} ${c.state}`.toLowerCase().includes(filter.toLowerCase()))
          : conns;
        return (
          <Card
            title={
              <>
                Tracked connections ({shown.length}
                {filter ? ` / ${conns.length}` : ''})
                <input
                  className="mc-input"
                  style={{ marginLeft: 'auto', width: 240, fontWeight: 'normal' }}
                  placeholder="filter…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  spellCheck={false}
                />
              </>
            }
          >
            <table className="mc-table mc-table--mono">
              <thead>
                <tr>
                  <th>Proto</th>
                  <th>Source</th>
                  <th className="num">Port</th>
                  <th>Destination</th>
                  <th className="num">Port</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {shown.slice(0, 1500).map((c, i) => (
                  <tr key={i}>
                    <td>{c.proto}</td>
                    <td>{c.src}</td>
                    <td className="num">{c.srcPort}</td>
                    <td>{c.dst}</td>
                    <td className="num">{c.dstPort}</td>
                    <td>{c.state}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {shown.length > 1500 && <p className="mc-card__note">Showing first 1500 rows — refine the filter.</p>}
          </Card>
        );
      }}
    </FeedPage>
  );
}

export const logPages: PageDef[] = [
  {
    kind: 'custom',
    id: 'log-general',
    aspPage: 'Main_LogStatus_Content.asp',
    title: 'System Log',
    navGroup: 'log',
    navOrder: 55,
    confidence: { read: 'live-verified' },
    component: GeneralLogPage,
  },
  {
    kind: 'custom',
    id: 'log-wireless',
    aspPage: 'Main_WStatus_Content.asp',
    title: 'Wireless Status Log',
    navGroup: 'log',
    navOrder: 56,
    confidence: { read: 'structural' },
    component: WirelessLogPage,
  },
  {
    kind: 'custom',
    id: 'log-dhcp',
    aspPage: 'Main_DHCPStatus_Content.asp',
    title: 'Active DHCP Leases',
    navGroup: 'log',
    navOrder: 57,
    confidence: { read: 'live-verified' },
    component: DhcpLeasesPage,
  },
  {
    kind: 'custom',
    id: 'log-ipv6',
    aspPage: 'Main_IPV6Status_Content.asp',
    title: 'IPv6 Status',
    navGroup: 'log',
    navOrder: 58,
    confidence: { read: 'structural' },
    gate: (c) => c.rcSupport.has('ipv6'),
    component: Ipv6StatusPage,
  },
  {
    kind: 'custom',
    id: 'log-routes',
    aspPage: 'Main_RouteStatus_Content.asp',
    title: 'Routing Table',
    navGroup: 'log',
    navOrder: 59,
    confidence: { read: 'structural' },
    component: RoutingTablePage,
  },
  {
    kind: 'custom',
    id: 'log-portforward',
    aspPage: 'Main_IPTStatus_Content.asp',
    title: 'Active Port Forwards',
    navGroup: 'log',
    navOrder: 60,
    confidence: { read: 'structural' },
    component: PortForwardsPage,
  },
  {
    kind: 'custom',
    id: 'log-connections',
    aspPage: 'Main_ConnStatus_Content.asp',
    title: 'Active Connections',
    navGroup: 'log',
    navOrder: 61,
    confidence: { read: 'live-verified' },
    component: ConnectionsPage,
  },
];
