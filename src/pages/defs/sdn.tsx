/**
 * Self-Defined Networks / Guest Network Pro (SDN.asp) — read-focused overview.
 * Record layouts from shared/mtlan_utils.c (vstrsep field order):
 *   sdn_rl:    idx>name>enable>vlan_idx>subnet_idx>apg_idx>vpnc_idx>vpns_idx>
 *              dnsf_idx>urlf_idx>nwf_idx>cp_idx>gre_idx>fw_idx>killsw>ahs>
 *              wan_idx>… (23 max, 6 basic)
 *   subnet_rl: idx>ifname>addr>netmask>dhcp_enable>dhcp_min>dhcp_max>… (13 basic)
 * Per-network SSID/state live in apg<idx>_* nvram families (validated live in
 * the probe session: apg1_ssid etc. via nvram_char_to_ascii).
 *
 * SDN profile creation/editing writes an interdependent transaction across
 * sdn_rl + subnet_rl + vlan_rl + apg*_ families — deliberately NOT modeled
 * this session; this view is read-only with per-network enable state shown.
 */
import { useEffect, useState } from 'react';
import { hasFlag } from '../../lib/capabilities';
import { nvramCharToAscii, nvramGet } from '../../lib/router-io';
import type { PageDef, PageProps } from '../types';
import { Badge, Banner, Card, EmptyState, Loading } from '../../ui/components';

interface SdnNetwork {
  idx: number;
  name: string;
  enabled: boolean;
  apgIdx: number;
  ssid: string;
  band: string;
  subnet: string;
  dhcp: string;
}

const SDN_TYPE_LABEL: Record<string, string> = {
  MAINFH: 'Main network',
  MAINBH: 'AiMesh backhaul',
  LEGACY: 'Legacy guest',
};

async function fetchSdn(): Promise<SdnNetwork[]> {
  const lists = await nvramCharToAscii(['sdn_rl', 'subnet_rl']);
  const sdnRecords = (lists.sdn_rl ?? '')
    .split('<')
    .filter(Boolean)
    .map((rec) => rec.split('>'));
  const subnetByIdx = new Map<string, string[]>();
  for (const rec of (lists.subnet_rl ?? '').split('<').filter(Boolean)) {
    const cols = rec.split('>');
    subnetByIdx.set(cols[0], cols);
  }
  const apgIdxes = sdnRecords.map((r) => r[5]).filter((v) => v && v !== '0');
  const apgKeys = apgIdxes.flatMap((i) => [`apg${i}_ssid`, `apg${i}_dut_list`]);
  const apgEnable = apgIdxes.map((i) => `apg${i}_enable`);
  let apgValues: Record<string, string> = {};
  try {
    apgValues = { ...(await nvramCharToAscii(apgKeys)), ...(await nvramGet(apgEnable)) };
  } catch {
    // per-network detail is best-effort; the sdn_rl skeleton still renders
  }
  return sdnRecords.map((r) => {
    const subnet = subnetByIdx.get(r[4]);
    const apg = r[5];
    // apgX_dut_list records carry per-band radio assignments; presence of a
    // band digit is a rough indicator only, so just count entries.
    const bands = (apgValues[`apg${apg}_dut_list`] ?? '')
      .split('<')
      .filter(Boolean).length;
    return {
      idx: Number(r[0]),
      name: r[1] ?? '',
      enabled: r[2] === '1',
      apgIdx: Number(apg),
      ssid: apgValues[`apg${apg}_ssid`] ?? '',
      band: bands > 0 ? `${bands} radio assignment${bands === 1 ? '' : 's'}` : '',
      subnet: subnet ? `${subnet[2]}/${subnet[3]}` : '',
      dhcp: subnet ? (subnet[4] === '1' ? `${subnet[5]} – ${subnet[6]}` : 'DHCP off') : '',
    };
  });
}

function SdnPage(_props: PageProps) {
  const [networks, setNetworks] = useState<SdnNetwork[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetchSdn()
      .then(setNetworks)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <div>
      <h1 className="mc-page-title">Separate Networks & Guest Wi-Fi</h1>
      <p className="mc-page-subtitle">SDN.asp · Self-Defined Networks</p>
      <Banner tone="info">
        Read-only overview. Creating or editing SDN profiles writes a coupled transaction across sdn_rl, subnet_rl,
        vlan_rl and apg*_ families — use the native UI for profile changes; this build intentionally does not model
        that write path.
      </Banner>
      {error && <Banner tone="err">Failed to read SDN configuration: {error}</Banner>}
      {!networks && !error ? (
        <Loading />
      ) : networks ? (
        networks.length === 0 ? (
          <EmptyState>No self-defined networks configured</EmptyState>
        ) : (
          <Card title={`Networks (${networks.length})`}>
            <table className="mc-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>SSID</th>
                  <th>State</th>
                  <th>Subnet</th>
                  <th>DHCP pool</th>
                  <th>Radios</th>
                </tr>
              </thead>
              <tbody>
                {networks.map((n) => (
                  <tr key={n.idx}>
                    <td>{n.idx}</td>
                    <td>{SDN_TYPE_LABEL[n.name] ?? n.name}</td>
                    <td>{n.ssid || '—'}</td>
                    <td>{n.enabled ? <Badge tone="ok">enabled</Badge> : <Badge>disabled</Badge>}</td>
                    <td className="num">{n.subnet || '—'}</td>
                    <td className="num">{n.dhcp || '—'}</td>
                    <td>{n.band || '—'}</td>
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

export const sdnPages: PageDef[] = [
  {
    kind: 'custom',
    id: 'sdn',
    aspPage: 'SDN.asp',
    title: 'Separate Networks & Guest Wi-Fi',
    navGroup: 'lan',
    navSub: 'segments',
    navOrder: 14,
    confidence: { read: 'live-verified' },
    gate: (c) => hasFlag(c, 'mtlancfg_support'),
    component: SdnPage,
  },
];
