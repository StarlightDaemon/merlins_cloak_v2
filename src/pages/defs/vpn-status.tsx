/**
 * VPN Status (Advanced_VPNStatus.asp, Merlin) — unified OpenVPN / WireGuard /
 * PPTP state from ajax_vpn_status.asp (plain JS string assignments backed by
 * Merlin's sysinfo() vpnstatus/wgcstatus/pid hooks).
 * Status codes (from the native page's logic): -1 error, 0 stopped,
 * 1 connecting, 2 connected.
 */
import { useCallback, useEffect, useState } from 'react';
import { hasFlag } from '../../lib/capabilities';
import { fetchRouterText, nvramCharToAscii } from '../../lib/router-io';
import { parseJsScalarAssignments } from '../../lib/status-feeds';
import type { PageDef, PageProps } from '../types';
import { Badge, Banner, Card, EmptyState, Loading } from '../../ui/components';

interface VpnInstanceStatus {
  unit: number;
  status: string;
  vpnIp?: string;
  publicIp?: string;
  desc?: string;
}

interface VpnStatusData {
  openvpnServers: VpnInstanceStatus[];
  openvpnClients: VpnInstanceStatus[];
  wireguardClients: VpnInstanceStatus[];
  pptpdRunning: boolean;
}

function statusBadge(status: string): { label: string; tone: 'ok' | 'warn' | 'err' | 'info' } {
  switch (status) {
    case '2':
      return { label: 'Connected', tone: 'ok' };
    case '1':
      return { label: 'Connecting', tone: 'warn' };
    case '-1':
      return { label: 'Error', tone: 'err' };
    case '0':
    case '':
      return { label: 'Stopped', tone: 'info' };
    default:
      return { label: `state ${status}`, tone: 'info' };
  }
}

async function fetchVpnStatus(): Promise<VpnStatusData> {
  const text = await fetchRouterText('/ajax_vpn_status.asp');
  const vars = parseJsScalarAssignments(text);
  // Instance descriptions are nvram, not part of the feed.
  const descKeys = [
    ...[1, 2, 3, 4, 5].map((n) => `vpn_client${n}_desc`),
    ...[1, 2, 3, 4, 5].map((n) => `wgc${n}_desc`),
  ];
  let descs: Record<string, string> = {};
  try {
    descs = await nvramCharToAscii(descKeys);
  } catch {
    // descriptions are cosmetic
  }
  const openvpnServers = [1, 2].map((n) => ({
    unit: n,
    status: vars[`vpn_server${n}_status`] ?? '',
  }));
  const openvpnClients = [1, 2, 3, 4, 5].map((n) => ({
    unit: n,
    status: vars[`vpn_client${n}_status`] ?? '',
    vpnIp: vars[`vpn_client${n}_ip`],
    publicIp: vars[`vpn_client${n}_rip`],
    desc: descs[`vpn_client${n}_desc`],
  }));
  const wireguardClients = [1, 2, 3, 4, 5].map((n) => ({
    unit: n,
    status: vars[`wgc${n}_status`] ?? '',
    vpnIp: vars[`wgc${n}_ip`],
    publicIp: vars[`wgc${n}_rip`],
    desc: descs[`wgc${n}_desc`],
  }));
  return {
    openvpnServers,
    openvpnClients,
    wireguardClients,
    pptpdRunning: (vars.pptpdpid ?? '') !== '' && vars.pptpdpid !== '0',
  };
}

function InstanceTable({ rows, kind }: { rows: VpnInstanceStatus[]; kind: string }) {
  const active = rows.filter((r) => r.status !== '' && r.status !== '0');
  if (active.length === 0) return <EmptyState>No active {kind} instances</EmptyState>;
  return (
    <table className="mc-table">
      <thead>
        <tr>
          <th>Unit</th>
          <th>Description</th>
          <th>Status</th>
          <th>VPN IP</th>
          <th>Endpoint / exit IP</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const b = statusBadge(r.status);
          return (
            <tr key={r.unit}>
              <td>{r.unit}</td>
              <td>{r.desc || '—'}</td>
              <td>
                <Badge tone={b.tone}>{b.label}</Badge>
              </td>
              <td className="num">{r.vpnIp || '—'}</td>
              <td className="num">{r.publicIp || '—'}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function VpnStatusPage({ caps }: PageProps) {
  const [data, setData] = useState<VpnStatusData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setData(await fetchVpnStatus());
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
      <h1 className="mc-page-title">VPN Status</h1>
      <p className="mc-page-subtitle">Advanced_VPNStatus.asp · Merlin</p>
      {error && <Banner tone="err">Failed to read ajax_vpn_status.asp: {error}</Banner>}
      {!data && !error ? (
        <Loading />
      ) : data ? (
        <>
          {hasFlag(caps, 'openvpnd_support') && (
            <>
              <Card title="OpenVPN servers">
                <InstanceTable rows={data.openvpnServers} kind="OpenVPN server" />
              </Card>
              <Card title="OpenVPN clients">
                <InstanceTable rows={data.openvpnClients} kind="OpenVPN client" />
              </Card>
            </>
          )}
          {hasFlag(caps, 'wireguard_support') && (
            <Card title="WireGuard clients">
              <InstanceTable rows={data.wireguardClients} kind="WireGuard client" />
            </Card>
          )}
          {hasFlag(caps, 'pptpd_support') && (
            <Card title="PPTP server">
              <p>
                {data.pptpdRunning ? <Badge tone="ok">Running</Badge> : <Badge tone="info">Stopped</Badge>}
              </p>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}

export const vpnStatusPages: PageDef[] = [
  {
    kind: 'custom',
    id: 'vpn-status',
    aspPage: 'Advanced_VPNStatus.asp',
    title: 'VPN Status',
    navGroup: 'vpn',
    navLabel: 'Status',
    merlinOnly: true,
    confidence: { read: 'live-verified' },
    component: VpnStatusPage,
  },
];
