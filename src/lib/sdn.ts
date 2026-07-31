/**
 * Shared SDN (Self-Defined Networks / Guest Network Pro) record parsing —
 * sdn_rl / subnet_rl / apg{idx}_* nvram families. Consumed by both
 * pages/defs/sdn.tsx (the full read-only network list) and
 * pages/defs/dashboard.tsx (the SDN-aware "Wireless networks" summary),
 * factored here so both read the identical field layout instead of two
 * subtly-different '<'/'>' parsers drifting apart.
 *
 * Field layout (shared/mtlan_utils.c vstrsep field order, per sdn.tsx's
 * original header comment, live-verified against apg1_ssid etc. via
 * nvram_char_to_ascii):
 *   sdn_rl:    idx>name>enable>vlan_idx>subnet_idx>apg_idx>vpnc_idx>vpns_idx>
 *              dnsf_idx>urlf_idx>nwf_idx>cp_idx>gre_idx>fw_idx>killsw>ahs>
 *              wan_idx>… (23 max, 6 basic)
 *   subnet_rl: idx>ifname>addr>netmask>dhcp_enable>dhcp_min>dhcp_max>… (13 basic)
 *
 * apg{idx}_dut_list band-bitwise decode (RAW SDN.asp sdn.js: get_dut_list(),
 * cap_band_bitwise computation ~sdn.js:836-844; record shape confirmed at
 * get_dut_list() ~sdn.js:11591: `<mac>bandBitwise>lanport` per AiMesh node,
 * matching RAW amas_apg_shared.h's struct _dutlist_t / NV_APG_X_DUT_LIST):
 *   bit 1             -> 2.4 GHz
 *   bits 2 | 4 | 8     -> 5 GHz (incl. 5G-1/5G-2 MLO variants)
 *   bits 16 | 32 | 64  -> 6 GHz (incl. 6G-1/6G-2 MLO variants)
 */
import { nvramCharToAscii, nvramGet } from './router-io';

export type Band = '24' | '5' | '6';

export const BAND_ORDER: Band[] = ['24', '5', '6'];

export const BAND_LABEL: Record<Band, string> = {
  '24': '2.4 GHz',
  '5': '5 GHz',
  '6': '6 GHz',
};

export interface SdnRecord {
  idx: string;
  /** sdn_rl field 1: MAINFH | MAINBH | LEGACY | a custom profile name (Guest, IoT, …). */
  name: string;
  enabled: boolean;
  vlanIdx: string;
  subnetIdx: string;
  apgIdx: string;
}

export const SDN_TYPE_LABEL: Record<string, string> = {
  MAINFH: 'Main network',
  MAINBH: 'AiMesh backhaul',
  LEGACY: 'Legacy guest',
};

/** Parse the sdn_rl nvram_char_to_ascii value into one record per '<'-delimited row. */
export function parseSdnRl(sdnRl: string | undefined): SdnRecord[] {
  return (sdnRl ?? '')
    .split('<')
    .filter(Boolean)
    .map((rec) => rec.split('>'))
    .map((r) => ({
      idx: r[0] ?? '',
      name: r[1] ?? '',
      enabled: r[2] === '1',
      vlanIdx: r[3] ?? '',
      subnetIdx: r[4] ?? '',
      apgIdx: r[5] ?? '',
    }));
}

/** Parse subnet_rl into a idx -> full column array map (native field order preserved). */
export function parseSubnetRl(subnetRl: string | undefined): Map<string, string[]> {
  const subnetByIdx = new Map<string, string[]>();
  for (const rec of (subnetRl ?? '').split('<').filter(Boolean)) {
    const cols = rec.split('>');
    subnetByIdx.set(cols[0], cols);
  }
  return subnetByIdx;
}

/**
 * Bands an apg{idx}_dut_list nvram string spans, decoded from the per-record
 * band-bitwise field (column index 1 of each '<mac>bandBitwise>lanport>' entry).
 * Multiple dut_list records (one per AiMesh node) are unioned.
 */
export function decodeDutListBands(dutList: string | undefined): Set<Band> {
  const bands = new Set<Band>();
  for (const rec of (dutList ?? '').split('<').filter(Boolean)) {
    const cols = rec.split('>');
    const bitwise = parseInt(cols[1] ?? '', 10) || 0;
    if (bitwise & 1) bands.add('24');
    if (bitwise & (2 | 4 | 8)) bands.add('5');
    if (bitwise & (16 | 32 | 64)) bands.add('6');
  }
  return bands;
}

export interface SdnCore {
  records: SdnRecord[];
  subnetByIdx: Map<string, string[]>;
  /** apg{idx}_ssid / apg{idx}_dut_list (ascii) and apg{idx}_enable (plain), keyed by full nvram name. */
  apgValues: Record<string, string>;
}

/**
 * Fetch sdn_rl + subnet_rl and every referenced apg{idx}_{ssid,dut_list,enable}.
 * The apg detail read is best-effort (mirrors sdn.tsx's original fetchSdn):
 * a failure there still leaves the sdn_rl/subnet_rl skeleton usable by the
 * caller, just without per-network SSID/band detail.
 */
export async function fetchSdnCore(): Promise<SdnCore> {
  const lists = await nvramCharToAscii(['sdn_rl', 'subnet_rl']);
  const records = parseSdnRl(lists.sdn_rl);
  const subnetByIdx = parseSubnetRl(lists.subnet_rl);
  const apgIdxes = records.map((r) => r.apgIdx).filter((v) => v && v !== '0');
  const apgKeys = apgIdxes.flatMap((i) => [`apg${i}_ssid`, `apg${i}_dut_list`]);
  const apgEnable = apgIdxes.map((i) => `apg${i}_enable`);
  let apgValues: Record<string, string> = {};
  try {
    apgValues = { ...(await nvramCharToAscii(apgKeys)), ...(await nvramGet(apgEnable)) };
  } catch {
    // per-network detail is best-effort; the sdn_rl skeleton still renders
  }
  return { records, subnetByIdx, apgValues };
}
