/**
 * Network Map replacement (index.asp). Live status assembled from the same
 * read endpoints the native page polls.
 */
import { useEffect, useState } from 'react';
import { appGet, nvramCharToAscii, nvramGet } from '../../lib/router-io';
import { hasFlag } from '../../lib/capabilities';
import type { PageProps } from '../types';
import { Badge, Banner, Card, Loading } from '../../ui/components';

interface DashData {
  wanState: string;
  wanIp: string;
  wanGateway: string;
  wanDns: string;
  wanProto: string;
  lanIp: string;
  radios: { band: string; ssid: string; enabled: boolean; tone: '24' | '5' | '6' }[];
  uptimeStr: string;
}

const WAN_STATE_LABEL: Record<string, { label: string; tone: 'ok' | 'warn' | 'err' }> = {
  '2': { label: 'Connected', tone: 'ok' },
  '1': { label: 'Connecting', tone: 'warn' },
  '0': { label: 'Disconnected', tone: 'err' },
};

export function DashboardPage({ caps }: PageProps) {
  const [data, setData] = useState<DashData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const plain = await nvramGet([
          'wan0_state_t',
          'wan0_ipaddr',
          'wan0_gateway',
          'wan0_dns',
          'wan0_proto',
          'lan_ipaddr',
          'wl0_radio',
          'wl1_radio',
          'wl2_radio',
        ]);
        let ssids = await nvramCharToAscii(['wl0_ssid', 'wl1_ssid', 'wl2_ssid']);
        // ASUSWRT 5.0 / SDN units (mtlancfg): the broadcast SSID lives in the
        // main network's apg{idx}_ssid; wl0_ssid holds a derived placeholder
        // (live-observed: a 32-hex string). sdn_rl: idx>name>enable>vlan>subnet>apg>…
        if (hasFlag(caps, 'mtlancfg_support')) {
          try {
            const sdn = await nvramCharToAscii(['sdn_rl']);
            const main = (sdn.sdn_rl ?? '')
              .split('<')
              .filter(Boolean)
              .map((r) => r.split('>'))
              .find((r) => r[1] === 'MAINFH');
            if (main?.[5]) {
              const apg = await nvramCharToAscii([`apg${main[5]}_ssid`]);
              const mainSsid = apg[`apg${main[5]}_ssid`];
              if (mainSsid) {
                ssids = { wl0_ssid: mainSsid, wl1_ssid: mainSsid, wl2_ssid: mainSsid };
              }
            }
          } catch {
            // keep wl*_ssid values if the SDN read fails
          }
        }
        // uptime is an ej hook, not an nvram variable. Emits
        // "<rfc date>(N days … since boot)" — keep the human part.
        let uptimeStr = '';
        try {
          const up = await appGet(['uptime()']);
          const m = String(up.uptime ?? '').match(/\(([^)]*) since boot\)/);
          uptimeStr = m ? m[1] : '';
        } catch {
          // cosmetic
        }
        const radios: DashData['radios'] = [
          { band: '2.4 GHz', ssid: ssids.wl0_ssid, enabled: plain.wl0_radio === '1', tone: '24' as const },
          { band: '5 GHz', ssid: ssids.wl1_ssid, enabled: plain.wl1_radio === '1', tone: '5' as const },
        ];
        if (hasFlag(caps, 'band6g_support')) {
          radios.push({ band: '6 GHz', ssid: ssids.wl2_ssid, enabled: plain.wl2_radio === '1', tone: '6' as const });
        }
        setData({
          wanState: plain.wan0_state_t,
          wanIp: plain.wan0_ipaddr,
          wanGateway: plain.wan0_gateway,
          wanDns: plain.wan0_dns,
          wanProto: plain.wan0_proto,
          lanIp: plain.lan_ipaddr,
          radios,
          uptimeStr,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [caps]);

  if (error) return <Banner tone="err">Failed to read router status: {error}</Banner>;
  if (!data) return <Loading />;

  const wan = WAN_STATE_LABEL[data.wanState] ?? { label: `state ${data.wanState}`, tone: 'warn' as const };

  return (
    <div>
      <h1 className="mc-page-title">Router Status</h1>
      <p className="mc-page-subtitle">
        {caps.identity.productId} · {caps.identity.displayVersion}
      </p>
      <div className="mc-grid-2">
        <Card title="Internet" badge={<Badge tone={wan.tone}>{wan.label}</Badge>}>
          <dl className="mc-kv">
            <dt>WAN IP</dt>
            <dd className="mc-nowrap">{data.wanIp || '—'}</dd>
            <dt>Gateway</dt>
            <dd className="mc-nowrap">{data.wanGateway || '—'}</dd>
            <dt>DNS</dt>
            <dd>{data.wanDns || '—'}</dd>
            <dt>Connection type</dt>
            <dd className="mc-nowrap">{data.wanProto || '—'}</dd>
          </dl>
        </Card>
        <Card title="Router">
          <dl className="mc-kv">
            <dt>LAN IP</dt>
            <dd className="mc-nowrap">{data.lanIp}</dd>
            <dt>Firmware</dt>
            <dd className="mc-nowrap">{caps.identity.displayVersion}</dd>
            <dt>Branch</dt>
            <dd className="mc-nowrap">{caps.identity.branch === 'merlin' ? 'Asuswrt-Merlin' : caps.identity.branch}</dd>
            <dt>Uptime</dt>
            <dd>{data.uptimeStr || '—'}</dd>
          </dl>
        </Card>
      </div>
      <Card title="Wireless radios">
        <table className="mc-table">
          <thead>
            <tr>
              <th>Band</th>
              <th>SSID</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
            {data.radios.map((r) => (
              <tr key={r.band}>
                <td>
                  <Badge tone={r.tone}>{r.band}</Badge>
                </td>
                <td>{r.ssid || '—'}</td>
                <td>{r.enabled ? <Badge tone="ok">on</Badge> : <Badge>off</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
