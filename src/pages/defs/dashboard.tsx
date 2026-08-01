/**
 * Network Map replacement (index.asp). Live status assembled from the same
 * read endpoints the native page polls.
 *
 * SDN-managed units (mtlancfg_support, ASUSWRT 5.0): the wl0/1/2_ssid nvram
 * values are NOT the broadcast SSIDs (live-observed: derived placeholders,
 * e.g. a 32-hex string) — real SSIDs live one-per-network in apg{idx}_ssid
 * (guest-class rows) / apm{idx}_ssid (MAINFH/MAINBH rows; separate pool,
 * overlapping idx space — lib/sdn.ts apPrefixForSdnName),
 * each bound to a set of bands via the matching {apg|apm}{idx}_dut_list (a band can carry
 * multiple SSIDs: Main, Guest, IoT, …). The old band-row table here used to
 * resolve only the first MAINFH record and paint its SSID onto all three
 * band rows, hiding every other configured network. On SDN units this now
 * renders a network-centric table instead (one row per enabled, non-backhaul
 * sdn_rl network) — see lib/sdn.ts (shared with pages/defs/sdn.tsx) for the
 * sdn_rl/subnet_rl/apg parsing. Per-band radio on/off state (wl{N}_radio) is
 * still surfaced, as a compact strip, since the network table itself carries
 * no on/off state of its own. Non-SDN (classic) units keep the original
 * plain wl0/1/2_ssid per-band table unchanged.
 *
 * Dual-WAN aggregation (read-only): a second WAN unit (`wan1_*`) exists
 * whenever the platform supports it and `wans_dualwan`'s two space-separated
 * tokens are not `"<if> none"` — the same predicate the firmware itself uses
 * (`state.js:970`'s `dualwan_enabled` / `index.asp:242`'s `wans_flag`, both
 * `dualWAN_support && wans_dualwan.search('none') == -1` in effect) and the
 * exact convention this repo's own `src/pages/defs/wan.ts:295` already gates
 * `wans_mode`'s visibility on (`v.wans_dualwan !== 'wan none'`) — duplicated
 * here rather than shared since it's a one-line predicate with only two call
 * sites. `wan{N}_*` fields are read per-unit off the same `wan_prefix(unit,
 * ...)` macro the firmware uses internally (`httpd/web.c:461`, a local macro,
 * not exported — nothing to call, just the naming convention it produces).
 * Active/standby framing in failover(-failback) mode follows `wan{N}_primary`
 * (`wan_primary_ifunit()`, `shared/rtstate.c:578-600`: first unit with
 * `wan{u}_primary=="1"`, default unit 0); load-balance mode has no single
 * "primary" in the native UI (`device-map/internet.asp`'s `initial()`) so
 * both units are shown as peers with the `wans_lb_ratio` split. When
 * dual-WAN is off (`wans_dualwan` contains "none" or the capability flag is
 * unset) the card renders byte-identical to the pre-dual-WAN single-unit
 * layout — that single-unit path is the operator's live-verified one; the
 * dual-WAN branch itself has not been exercised against real dual-WAN
 * hardware and its correctness is structural (types + the fixture harness)
 * only, not live-confirmed.
 */
import { useEffect, useState } from 'react';
import { appGet, nvramCharToAscii, nvramGet } from '../../lib/router-io';
import { hasFlag } from '../../lib/capabilities';
import { apPrefixForSdnName, BAND_LABEL, BAND_ORDER, decodeDutListBands, fetchSdnCore, SDN_TYPE_LABEL, type Band } from '../../lib/sdn';
import type { PageProps } from '../types';
import { Badge, Banner, Card, Loading } from '../../ui/components';

interface RadioBandState {
  band: string;
  enabled: boolean;
  tone: Band;
}

/** One row of the SDN-aware "Wireless networks" table — one per enabled, non-backhaul sdn_rl record. */
interface SdnNetworkRow {
  idx: string;
  label: string;
  ssid: string;
  bands: Band[];
}

/** Per-unit WAN status — the same five fields read for wan0 today, mirrored for wan1. */
interface WanUnitData {
  unit: 0 | 1;
  state: string;
  ip: string;
  gateway: string;
  dns: string;
  proto: string;
}

/** Dual-WAN aggregation, populated only when the dual-WAN active predicate (see header comment) is true. */
interface DualWanData {
  mode: string;
  lbRatio: string;
  /** wan_primary_ifunit() semantics: first unit with wan{u}_primary=="1", default unit 0. Meaningful for fo/fb. */
  primaryUnit: 0 | 1;
  units: [WanUnitData, WanUnitData];
}

interface DashData {
  wanState: string;
  wanIp: string;
  wanGateway: string;
  wanDns: string;
  wanProto: string;
  lanIp: string;
  /** Per-band radio on/off state — always populated, used by both the SDN strip and the classic fallback table. */
  radioStates: RadioBandState[];
  /** SDN path (mtlancfg_support): one row per enabled, non-backhaul network. Undefined on classic units. */
  sdnNetworks?: SdnNetworkRow[];
  /** Classic (non-SDN) fallback: the original plain wl0/1/2_ssid per-band table, byte-equivalent to prior behavior. */
  legacyRadios?: { band: string; ssid: string; enabled: boolean; tone: Band }[];
  uptimeStr: string;
  /** Present only when dual-WAN is active; the card renders the pre-dual-WAN single-unit layout when undefined. */
  dualWan?: DualWanData;
}

const WAN_STATE_LABEL: Record<string, { label: string; tone: 'ok' | 'warn' | 'err' }> = {
  '2': { label: 'Connected', tone: 'ok' },
  '1': { label: 'Connecting', tone: 'warn' },
  '0': { label: 'Disconnected', tone: 'err' },
};

/** Per-unit connection-state badge, factored out of the inline wan0-only lookup so wan1 reuses it identically. */
function wanStateBadge(stateT: string): { label: string; tone: 'ok' | 'warn' | 'err' } {
  return WAN_STATE_LABEL[stateT] ?? { label: `state ${stateT}`, tone: 'warn' };
}

const WANS_MODE_LABEL: Record<string, string> = {
  fo: 'Failover',
  fb: 'Failover with failback',
  lb: 'Load balance',
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
          'wan1_state_t',
          'wan1_ipaddr',
          'wan1_gateway',
          'wan1_dns',
          'wan1_proto',
          'wans_dualwan',
          'wans_mode',
          'wans_lb_ratio',
          'wan0_primary',
          'wan1_primary',
          'lan_ipaddr',
          'wl0_radio',
          'wl1_radio',
          'wl2_radio',
        ]);
        // Dual-WAN active predicate — same convention as src/pages/defs/wan.ts:295
        // (`v.wans_dualwan !== 'wan none'`), gated additionally on the platform
        // capability flag, mirroring state.js:970 / index.asp:242. See header
        // comment for firmware citations.
        // Token-based rather than the exact-string form wan.ts:295 uses for its
        // own select values: the native predicate is a substring search for
        // "none" across the whole value (state.js:970), so a non-"wan" primary
        // token (e.g. "dsl none") must still read as dual-WAN-off here.
        const dualWanActive =
          hasFlag(caps, 'dualwan_support') &&
          !(plain.wans_dualwan ?? 'wan none').split(' ').includes('none');
        let dualWan: DashData['dualWan'];
        if (dualWanActive) {
          const unit0: WanUnitData = {
            unit: 0,
            state: plain.wan0_state_t,
            ip: plain.wan0_ipaddr,
            gateway: plain.wan0_gateway,
            dns: plain.wan0_dns,
            proto: plain.wan0_proto,
          };
          const unit1: WanUnitData = {
            unit: 1,
            state: plain.wan1_state_t,
            ip: plain.wan1_ipaddr,
            gateway: plain.wan1_gateway,
            dns: plain.wan1_dns,
            proto: plain.wan1_proto,
          };
          // wan_primary_ifunit(): first unit with wan{u}_primary=="1", default unit 0.
          const primaryUnit: 0 | 1 = plain.wan0_primary === '1' ? 0 : plain.wan1_primary === '1' ? 1 : 0;
          dualWan = { mode: plain.wans_mode, lbRatio: plain.wans_lb_ratio, primaryUnit, units: [unit0, unit1] };
        }
        // Per-band radio on/off state — needed on both paths (the classic
        // fallback table's State column, and the SDN path's radio-state strip).
        // The wl0/1/2 → 2.4/5/6 GHz labels here (and in the classic SSID
        // table below) assume the generic Broadcom default unit order
        // (shared/defaults.c fallback branch). That order is model-dependent —
        // several SKUs put 5 or 6 GHz on wl0 — see the band-instance note in
        // wireless.ts's header; correct for this build's RT-BE92U class.
        const radioStates: RadioBandState[] = [
          { band: '2.4 GHz', enabled: plain.wl0_radio === '1', tone: '24' },
          { band: '5 GHz', enabled: plain.wl1_radio === '1', tone: '5' },
        ];
        if (hasFlag(caps, 'band6g_support')) {
          radioStates.push({ band: '6 GHz', enabled: plain.wl2_radio === '1', tone: '6' });
        }

        let sdnNetworks: DashData['sdnNetworks'];
        let legacyRadios: DashData['legacyRadios'];
        if (hasFlag(caps, 'mtlancfg_support')) {
          // SDN-managed unit: one SSID per network, each bound to a set of
          // bands via its dut_list — a band can carry multiple SSIDs (Main,
          // Guest, IoT, …), so this is network-centric, not band-centric.
          // Enumerate every enabled, non-backhaul record (never just the
          // first MAINFH match: Smart Connect off can leave multiple
          // MAINFH-tagged records, each with its own bands). The nvram family
          // is per-record: guest-class rows read apg{idx}_*, MAINFH reads
          // apm{idx}_* — the pools' idx spaces overlap, so using apg for a
          // MAINFH row shows a guest SSID as "Main" (live-caught on the
          // RT-BE92U 2026-07-31; see lib/sdn.ts apPrefixForSdnName).
          try {
            const { records, apValues } = await fetchSdnCore();
            sdnNetworks = records
              .filter((r) => r.enabled && r.name !== 'MAINBH' && r.apgIdx && r.apgIdx !== '0')
              .map((r) => {
                const prefix = apPrefixForSdnName(r.name);
                const dutBands = decodeDutListBands(apValues[`${prefix}${r.apgIdx}_dut_list`]);
                return {
                  idx: r.idx,
                  label: r.name === 'MAINFH' ? 'Main' : (SDN_TYPE_LABEL[r.name] ?? r.name),
                  ssid: apValues[`${prefix}${r.apgIdx}_ssid`] ?? '',
                  bands: BAND_ORDER.filter((b) => dutBands.has(b)),
                };
              });
          } catch {
            // networks table renders empty; WAN/LAN info and the radio-state
            // strip (independent of the SDN read) are still useful
            sdnNetworks = [];
          }
        } else {
          // Classic (non-SDN) unit: original plain wl0/1/2_ssid per-band
          // table, unchanged from prior behavior.
          const ssids = await nvramCharToAscii(['wl0_ssid', 'wl1_ssid', 'wl2_ssid']);
          legacyRadios = [
            { band: '2.4 GHz', ssid: ssids.wl0_ssid, enabled: plain.wl0_radio === '1', tone: '24' },
            { band: '5 GHz', ssid: ssids.wl1_ssid, enabled: plain.wl1_radio === '1', tone: '5' },
          ];
          if (hasFlag(caps, 'band6g_support')) {
            legacyRadios.push({ band: '6 GHz', ssid: ssids.wl2_ssid, enabled: plain.wl2_radio === '1', tone: '6' });
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
        setData({
          wanState: plain.wan0_state_t,
          wanIp: plain.wan0_ipaddr,
          wanGateway: plain.wan0_gateway,
          wanDns: plain.wan0_dns,
          wanProto: plain.wan0_proto,
          lanIp: plain.lan_ipaddr,
          radioStates,
          sdnNetworks,
          legacyRadios,
          uptimeStr,
          dualWan,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [caps]);

  function renderDash(data: DashData) {
    const wan = wanStateBadge(data.wanState);
    const routerCard = (
      <Card title="Router">
        <dl className="mc-kv-line">
          <div>
            <dt>LAN IP</dt>
            <dd className="mc-nowrap">{data.lanIp}</dd>
          </div>
          <div>
            <dt>Firmware</dt>
            <dd className="mc-nowrap">{caps.identity.displayVersion}</dd>
          </div>
          <div>
            <dt>Branch</dt>
            <dd className="mc-nowrap">{caps.identity.branch === 'merlin' ? 'Asuswrt-Merlin' : caps.identity.branch}</dd>
          </div>
          <div>
            <dt>Uptime</dt>
            <dd>{data.uptimeStr || '—'}</dd>
          </div>
        </dl>
      </Card>
    );
    return (
      <>
        {data.dualWan ? (
          <>
            <p className="mc-page-subtitle" style={{ marginTop: -12 }}>
              Dual WAN — {WANS_MODE_LABEL[data.dualWan.mode] ?? `mode ${data.dualWan.mode}`}
              {data.dualWan.mode === 'lb' && data.dualWan.lbRatio ? ` (ratio ${data.dualWan.lbRatio})` : ''}
            </p>
            <div className="mc-grid-2">
              {data.dualWan.units.map((u) => {
                const isFailover = data.dualWan!.mode === 'fo' || data.dualWan!.mode === 'fb';
                const roleLabel = isFailover
                  ? u.unit === data.dualWan!.primaryUnit
                    ? 'Primary'
                    : 'Standby'
                  : `WAN unit ${u.unit + 1}`;
                const badge = wanStateBadge(u.state);
                return (
                  <Card key={u.unit} title={`Internet — ${roleLabel}`} badge={<Badge tone={badge.tone}>{badge.label}</Badge>}>
                    <dl className="mc-kv-line">
                      <div>
                        <dt>WAN IP</dt>
                        <dd className="mc-nowrap">{u.ip || '—'}</dd>
                      </div>
                      <div>
                        <dt>Gateway</dt>
                        <dd className="mc-nowrap">{u.gateway || '—'}</dd>
                      </div>
                      <div>
                        <dt>DNS</dt>
                        <dd>{u.dns || '—'}</dd>
                      </div>
                      <div>
                        <dt>Connection type</dt>
                        <dd className="mc-nowrap">{u.proto || '—'}</dd>
                      </div>
                    </dl>
                  </Card>
                );
              })}
            </div>
            {routerCard}
          </>
        ) : (
          <div className="mc-grid-2">
            <Card title="Internet" badge={<Badge tone={wan.tone}>{wan.label}</Badge>}>
              <dl className="mc-kv-line">
                <div>
                  <dt>WAN IP</dt>
                  <dd className="mc-nowrap">{data.wanIp || '—'}</dd>
                </div>
                <div>
                  <dt>Gateway</dt>
                  <dd className="mc-nowrap">{data.wanGateway || '—'}</dd>
                </div>
                <div>
                  <dt>DNS</dt>
                  <dd>{data.wanDns || '—'}</dd>
                </div>
                <div>
                  <dt>Connection type</dt>
                  <dd className="mc-nowrap">{data.wanProto || '—'}</dd>
                </div>
              </dl>
            </Card>
            {routerCard}
          </div>
        )}
        {data.sdnNetworks ? (
          <Card title="Wireless networks">
            <div className="mc-feedbar" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
              {data.radioStates.map((r) => (
                <span key={r.band} className="mc-nowrap">
                  <Badge tone={r.tone}>{r.band}</Badge> {r.enabled ? <Badge tone="ok">on</Badge> : <Badge>off</Badge>}
                </span>
              ))}
            </div>
            <table className="mc-table">
              <thead>
                <tr>
                  <th>Network</th>
                  <th>SSID</th>
                  <th>Bands</th>
                </tr>
              </thead>
              <tbody>
                {data.sdnNetworks.length === 0 ? (
                  <tr>
                    <td colSpan={3}>No enabled networks found</td>
                  </tr>
                ) : (
                  data.sdnNetworks.map((n) => (
                    <tr key={n.idx}>
                      <td className="mc-nowrap">{n.label}</td>
                      <td>{n.ssid || '—'}</td>
                      <td>
                        {n.bands.length === 0 ? (
                          '—'
                        ) : (
                          <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {n.bands.map((b) => (
                              <Badge key={b} tone={b}>
                                {BAND_LABEL[b]}
                              </Badge>
                            ))}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>
        ) : (
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
                {(data.legacyRadios ?? []).map((r) => (
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
        )}
      </>
    );
  }

  return (
    <div>
      <h1 className="mc-page-title">Router Status</h1>
      <p className="mc-page-subtitle">
        {caps.identity.productId} · {caps.identity.displayVersion}
      </p>
      {error ? (
        <Banner tone="err">Failed to read router status: {error}</Banner>
      ) : !data ? (
        <Loading />
      ) : (
        renderDash(data)
      )}
    </div>
  );
}
