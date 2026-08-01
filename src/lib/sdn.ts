/**
 * Shared SDN (Self-Defined Networks / Guest Network Pro) record parsing —
 * sdn_rl / subnet_rl / apg{idx}_* (guest-class) and apm{idx}_* (MAINFH/
 * MAINBH) nvram families. Consumed by both
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
import { appGet, nvramCharToAscii, nvramGet } from './router-io';
import { flagValue, type Capabilities } from './capabilities';
import { parseRuleList, serializeRuleList } from './rulelist';
import type { ListSpec } from '../pages/types';

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

/**
 * Firmware type-token display labels. LEGACY deliberately reads plain
 * "Guest": the firmware assigns sdn_name="LEGACY" to ANY wizard-created
 * profile synced to all AiMesh nodes, discarding the creating wizard's type
 * (Guest/IoT/Kids/VPN/… — sdn.js:3630, `sdn_name = (dut_list_star) ?
 * "LEGACY" : wizard_type`), so the token carries no purpose information and
 * a purpose-sounding label ("Legacy guest") misdescribes it. Live-confirmed
 * on the RT-BE92U 2026-07-31: an app-created IoT-purpose network stored as
 * LEGACY (wildcard dut_list), while a node-bound profile kept its "VPN"
 * type. The SSID is the only purpose record for star-synced profiles; no
 * apg{idx}_* field preserves the wizard type (apg{idx}_iot_max_cmpt was
 * empty on the live IoT-purpose record).
 */
export const SDN_TYPE_LABEL: Record<string, string> = {
  MAINFH: 'Main network',
  MAINBH: 'AiMesh backhaul',
  LEGACY: 'Guest',
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

/**
 * nvram family prefix for one sdn_rl record's per-network fields (ssid,
 * dut_list, …): guest-class profiles use apg{idx}_*, while MAINFH/MAINBH use
 * the SEPARATE apm{idx}_* family (native sdn.js's ap_prefix branch,
 * sdn.js:9552, web.c:3866-3882 — the same split the write-path guards below
 * are built around). The two pools' idx spaces overlap: live-confirmed on the
 * RT-BE92U (2026-07-31), where MAINFH carried apg_idx=1 (apm pool) alongside
 * LEGACY's apg_idx=1 (apg pool) — reading apg1_* for the MAINFH row rendered
 * the guest network's SSID as the main network's.
 */
export function apPrefixForSdnName(name: string): 'apg' | 'apm' {
  return isGuestClassSdnName(name) ? 'apg' : 'apm';
}

export interface SdnCore {
  records: SdnRecord[];
  subnetByIdx: Map<string, string[]>;
  /**
   * Per-network detail values keyed by full nvram name: {apg|apm}{idx}_ssid /
   * {apg|apm}{idx}_dut_list (ascii) for every record with a nonzero apg_idx
   * (family per apPrefixForSdnName), plus apg{idx}_enable (plain) for
   * guest-class records.
   */
  apValues: Record<string, string>;
}

/**
 * Fetch sdn_rl + subnet_rl and every referenced {apg|apm}{idx}_{ssid,dut_list}
 * (+ apg{idx}_enable for guest-class records). The detail read is best-effort
 * (mirrors sdn.tsx's original fetchSdn): a failure there still leaves the
 * sdn_rl/subnet_rl skeleton usable by the caller, just without per-network
 * SSID/band detail.
 */
export async function fetchSdnCore(): Promise<SdnCore> {
  const lists = await nvramCharToAscii(['sdn_rl', 'subnet_rl']);
  const records = parseSdnRl(lists.sdn_rl);
  const subnetByIdx = parseSubnetRl(lists.subnet_rl);
  const withIdx = records.filter((r) => r.apgIdx && r.apgIdx !== '0');
  const asciiKeys = [
    ...new Set(
      withIdx.flatMap((r) => {
        const p = apPrefixForSdnName(r.name);
        return [`${p}${r.apgIdx}_ssid`, `${p}${r.apgIdx}_dut_list`];
      }),
    ),
  ];
  const apgEnable = [
    ...new Set(
      withIdx.filter((r) => apPrefixForSdnName(r.name) === 'apg').map((r) => `apg${r.apgIdx}_enable`),
    ),
  ];
  let apValues: Record<string, string> = {};
  try {
    apValues = { ...(await nvramCharToAscii(asciiKeys)), ...(await nvramGet(apgEnable)) };
  } catch {
    // per-network detail is best-effort; the sdn_rl skeleton still renders
  }
  return { records, subnetByIdx, apValues };
}

// =============================================================================
// WRITE PATH — guest/IoT-class SDN profile create / edit / delete.
//
// Everything below this line targets ONLY profiles whose sdn_rl `name` is not
// MAINFH or MAINBH (see isGuestClassSdnName). MAINFH/MAINBH stay strictly
// view-only: assertGuestClassRow() throws before any mutation is computed for
// one, and assertNoApmKeys() throws if an `apm{idx}_*` key is ever about to be
// posted, as a second, independent backstop. This matters because MAINFH/
// MAINBH store their fields under the SEPARATE `apm{idx}_*` nvram family
// (sdn.js `ap_prefix` branch, sdn.js:9552, web.c:3866-3882) — a misrouted
// write there is the single biggest risk the research brief identified
// (scratchpad/research/09-sdn-crud.md §7): it can silently rename/repassword
// the router's real broadcast network for every already-connected client.
// Both guards below hard-code the prefix as the literal string "apg" — this
// module never accepts an "apm" prefix as a parameter, so there is no code
// path that could be tricked into emitting one.
//
// Firmware source: RAW\merlin\release\src\router\www\sysdep\FUNCTION\SDN\SDN\
// sdn.js and RAW\merlin\release\src\router\httpd\web.c (see per-function
// citations below). All firmware line numbers are as reported in
// scratchpad/research/09-sdn-crud.md, cross-checked directly against the
// vendored source while writing this module.
//
// WHOLE-TABLE REWRITE (sdn.js:12012-12172, `parse_JSONToStr_sdn_all_list`):
// the native UI never does incremental SDN writes. Every create/edit/delete
// re-serializes the ENTIRE sdn_rl/subnet_rl/vlan_rl table from a full
// in-memory snapshot, with just the one touched profile's change applied,
// and POSTs all three lists together in one call — plus the touched
// profile's discrete `apg{idx}_*` keys (sdn.js:12373-12387,
// `parse_apg_rl_to_apgX_rl`, which skips `apg_idx` and `disabled` and renames
// `apg_11be` -> `11be`). This is reproduced exactly below: buildRowSpec-typed
// tables are parsed and re-emitted in full on every write. Because a stale or
// partial read silently corrupts every OTHER existing profile on the next
// whole-table write (brief §7's dominant risk), fetchSdnWriteSnapshot() MUST
// be called fresh, immediately before building a payload — callers must never
// reuse a snapshot across renders or cache it between the read that opened an
// editor and the Save click.
//
// FIELD ORDER (validate_instance's generic literal-table nvram_set path,
// web.c:4316-5058; the apg/apm branch is web.c:3848-3892):
//   sdn_rl    (23 fields, NO trailing separator) — sdn.js:12040-12085
//   subnet_rl (21 fields + 1 empty trailing field, i.e. trailing '>' per
//              record) — sdn.js:12088-12132
//   vlan_rl   (3 fields + 1 empty trailing field) — sdn.js:12199-12208,
//             sorted ascending by vlan_idx (sdn.js:12195-12197) — the only
//             one of the three re-sorted independently of profile order
//   sdn_access_rl (2 fields, no trailing separator) — sdn.js:12170-12181
// sdn_rl's idx "0" (the pre-seeded DEFAULT row) is explicitly dropped by the
// native serializer (sdn.js:12038-12039, `if(sdn_profile.idx=="0") return;`)
// and is dropped here too, for byte-parity.
//
// THE THREE EXTRA LIST KEYS (live-observed 2026-07-31, source-resolved
// 2026-08-01 — docs/LIVE_PROBE_RT-BE92U.md §9, OPEN_LOOPS "SDN write payload:
// three list keys"): native's single-profile edit also posts
// `vlan_trunklist`, `dhcpres{subnet_idx}_rl`, and `dot{subnet_idx}_rl`.
// Source research settled each key's disposition here:
//   - `vlan_trunklist` (global whole-table: `<MAC>PORT#VID[,VID…]>PORT#…`,
//     one record per AiMesh node — sdn.js:13384, writer
//     Advanced_VLAN_Switch_Content.asp:1715-1741) is ROUND-TRIPPED VERBATIM
//     on create/edit, like radius_list. Native posts it on every VLAN-bearing
//     profile edit — its editor call site (sdn.js:9422-9428) lacks the
//     `vlan_trunklist_orig != ""` guard its siblings carry, so it posts ""
//     even on routers with no trunk bindings (exactly what §9.4 captured).
//     Since this module never changes a VID on edit, the verbatim value is
//     byte-identical to what native's VID-renumberer (update_vlan_trunklist,
//     sdn.js:13385-13419) would emit, and an unchanged value is provably
//     inert in httpd anyway (web.c:4817's strcmp guard skips it). On DELETE
//     the deleted profile's VID is stripped (see removeVidFromTrunklist) —
//     native repairs the table the same way (sdn.js:8577-8583), because a
//     stale trunk entry's VID can be recycled by a later create
//     (allocateVid) and silently tag the new network onto a physical AiMesh
//     LAN port.
//   - `dhcpres{N}_rl` / `dot{N}_rl` (PER-PROFILE side tables keyed by
//     subnet_idx, NOT whole-table lists: DHCP reservations → dnsmasq,
//     rc/sdn.c:236-302; DNS-over-TLS upstreams → stubby, rc/sdn.c:409-467)
//     stay DELIBERATELY OMITTED on create/edit. Omission is self-consistent:
//     both consumers reach these tables only through the profile's own
//     subnet_rl columns (dhcp_static/dhcp_unit, dot_enable), which this
//     module round-trips verbatim — and it is strictly SAFER than native,
//     whose editor blanks `dhcpres{N}_rl` unless the page state loaded it
//     (sdn.js:9434-9448) and strips AdGuard rows / zeroes dot_enable on the
//     AdGuard-off branch (sdn.js:9476-9495). On DELETE both are explicitly
//     blanked, matching native (sdn.js:8615-8618, 8591-8596): a stale
//     `dot{N}_rl` is genuinely dangerous because allocateSubnetIdx recycles
//     indices and a new profile inherits dot_enable from the global
//     dnspriv_enable — the recycled index would graft the deleted profile's
//     DoT upstreams onto the new network.
//
// radius_list is ALWAYS re-posted VERBATIM, byte-identical to the value this
// module read, and is NEVER decomposed/rebuilt — this is a deliberate scope
// cut (task scoping: "radius_list editing beyond verbatim round-trip" is
// excluded), because doing it properly would require reverse-engineering
// which sdn_rl row a given radius_list row belongs to, which is not exposed
// by any field in sdn_rl itself (radius association lives inside each
// profile's apg{idx}_security string instead — see securityUsesRadius
// below). Every create/edit/delete below still posts sdn_rl together with
// subnet_rl and sdn_access_rl in the same request even when neither changed —
// native parity (its serializer always emits the full set). NOTE, corrected
// 2026-08-01: an earlier revision of this comment claimed the sdn_rl
// ride-along is what sets web.c's `nvram_modified_sdn` sync flag. It is not:
// web.c:4817 gates EVERY top-level nvram write — including the sdn_rl special
// case at web.c:5013-5056 — behind `strcmp(nvram_safe_get(name), value)`, so
// a byte-identical sdn_rl never reaches that code and sets nothing. The flag
// is in practice set by the `apg{idx}_*` writes (web.c:3858,
// NVRAM_MODIFIED_SDN_BIT), which every edit does change. The ride-along is
// harmless (unchanged values are discarded) and kept for payload parity.
//
// CAPTIVE PORTAL (cp{idx}_*), VLAN trunk / AiMesh port binding (the
// restart_net_and_phy escalation), RADIUS/Enterprise security, and
// schedule/timesched editing are all OUT OF SCOPE and never touched — see the
// header comment in pages/defs/sdn.tsx for the per-item rationale.
//
// SAFETY: writeExclusion:'wireless' is one of the five HARD-blocked
// categories (lib/write-policy.ts) — guardedWrite() refuses every write this
// module can build, unconditionally, before it is ever sent. That refusal is
// intentional and is what makes this feature safe to ship structurally inert
// this session: the payload construction below is exercised by the UI (so it
// can be reviewed/tested) but never reaches the wire.
// =============================================================================

/** True for every sdn_rl profile this module is allowed to touch. */
export function isGuestClassSdnName(name: string): boolean {
  return name !== 'MAINFH' && name !== 'MAINBH';
}

function cols(ids: string[]): ListSpec['columns'] {
  return ids.map((id) => ({ id, label: id }));
}

// sdn.js:12040-12085 — 23 fields, leading '<', no trailing separator.
const SDN_RL_SPEC: ListSpec = {
  columns: cols([
    'idx', 'name', 'enable', 'vlan_idx', 'subnet_idx', 'apg_idx', 'vpnc_idx', 'vpns_idx',
    'dns_filter_idx', 'urlf_idx', 'nwf_idx', 'cp_idx', 'gre_idx', 'firewall_idx', 'kill_switch',
    'access_host_service', 'wan_unit', 'pppoe_relay', 'wan6_unit', 'createby', 'mtwan_idx',
    'mswan_idx', 'prio',
  ]),
};

// sdn.js:12088-12132 — 21 fields + trailing '>' (an extra empty field on split).
const SUBNET_RL_SPEC: ListSpec = {
  columns: cols([
    'subnet_idx', 'ifname', 'addr', 'netmask', 'dhcp_enable', 'dhcp_min', 'dhcp_max', 'dhcp_lease',
    'domain_name', 'dns', 'wins', 'dhcp_static', 'dhcp_unit', 'ipv6_enable', 'autoconf', 'addr6',
    'dhcp6_start', 'dhcp6_end', 'dns6', 'dot_enable', 'dot_tls', '_trailing',
  ]),
};

// sdn.js:12199-12208 — 3 fields + trailing '>'.
const VLAN_RL_SPEC: ListSpec = { columns: cols(['vlan_idx', 'vid', 'port_isolation', '_trailing']) };

// sdn.js:12170-12181 — 2 fields, no trailing separator.
const SDN_ACCESS_SPEC: ListSpec = { columns: cols(['access_sdn_idx', 'sdn_idx']) };

function rowGet(spec: ListSpec, row: string[], id: string): string {
  const i = spec.columns.findIndex((c) => c.id === id);
  return i >= 0 ? (row[i] ?? '') : '';
}

function rowSet(spec: ListSpec, row: string[], id: string, value: string): string[] {
  const i = spec.columns.findIndex((c) => c.id === id);
  if (i < 0) return row;
  const copy = row.slice();
  copy[i] = value;
  return copy;
}

function sdnIdxNum(row: string[]): number {
  return parseInt(rowGet(SDN_RL_SPEC, row, 'idx'), 10) || 0;
}

/** sdn_rl, sorted ascending by idx (sdn.js:12032-12034). */
function serializeSdnRl(sdnRows: string[][]): string {
  const sorted = [...sdnRows].sort((a, b) => sdnIdxNum(a) - sdnIdxNum(b));
  return serializeRuleList(sorted, SDN_RL_SPEC);
}

/**
 * subnet_rl, emitted in the SAME order as the (sorted) sdn_rl profiles that
 * own each row (sdn.js's single shared iteration over sdn_all_rl_json,
 * sdn.js:12035-12133) — not independently sorted by subnet_idx.
 */
function serializeSubnetRl(sdnRows: string[][], subnetByIdx: Map<string, string[]>): string {
  const sorted = [...sdnRows].sort((a, b) => sdnIdxNum(a) - sdnIdxNum(b));
  const rows: string[][] = [];
  for (const r of sorted) {
    const subnetIdx = rowGet(SDN_RL_SPEC, r, 'subnet_idx');
    const subnetRow = subnetIdx !== '0' ? subnetByIdx.get(subnetIdx) : undefined;
    if (subnetRow) rows.push(subnetRow);
  }
  return serializeRuleList(rows, SUBNET_RL_SPEC);
}

/** vlan_rl, independently sorted ascending by vlan_idx (sdn.js:12195-12197). */
function serializeVlanRl(vlanRows: string[][]): string {
  const sorted = [...vlanRows].sort(
    (a, b) => (parseInt(rowGet(VLAN_RL_SPEC, a, 'vlan_idx'), 10) || 0) - (parseInt(rowGet(VLAN_RL_SPEC, b, 'vlan_idx'), 10) || 0),
  );
  return serializeRuleList(sorted, VLAN_RL_SPEC);
}

// -----------------------------------------------------------------------------
// vlan_trunklist — AiMesh trunk-port VID bindings.
// Grammar (sdn.js:13384's own example, writer
// Advanced_VLAN_Switch_Content.asp:1715-1741):
//   record  := '<' MAC ( '>' PORT '#' VIDSPEC )+     // one record per node MAC
//   VIDSPEC := VID (',' VID)*  |  "all"               // "all" = allow all tagging
// -----------------------------------------------------------------------------

interface TrunkRecord {
  mac: string;
  /** [portLabel, vidSpec] pairs, vidSpec still comma-joined. */
  ports: [string, string][];
}

function parseTrunklist(raw: string): TrunkRecord[] {
  return raw
    .split('<')
    .filter(Boolean)
    .map((rec) => {
      const parts = rec.split('>');
      const ports: [string, string][] = [];
      for (const p of parts.slice(1)) {
        const hash = p.indexOf('#');
        if (hash > 0) ports.push([p.slice(0, hash), p.slice(hash + 1)]);
      }
      return { mac: parts[0] ?? '', ports };
    });
}

/**
 * True when any trunk record binds a port to `vid` — the same membership
 * question native answers before escalating an SDN apply's base rc_service to
 * restart_net_and_phy (sdn.js:9113-9120). A "#all" port binds every VID and
 * therefore counts.
 */
export function trunklistBindsVid(raw: string, vid: string): boolean {
  if (!raw || !vid) return false;
  return parseTrunklist(raw).some((rec) =>
    rec.ports.some(([, spec]) => spec === 'all' || spec.split(',').includes(vid)),
  );
}

/**
 * The deleted profile's VID stripped from the trunk table, mirroring native's
 * delete-path repair (rm_vid_from_vlan_trunklist, sdn.js:13421-13493): a port
 * loses the VID from its list, a port left with no VIDs is dropped, and a MAC
 * record left with no ports is dropped (sdn.js:13449). Deliberately SAFER
 * than native in one respect: native's parser collapses a multi-VID port to
 * its first VID before rebuilding ("suppose 1st vid … to be the only one vid
 * binded", sdn.js:331-332), silently discarding secondary VIDs — this
 * implementation removes only the matching VID and keeps the rest. "#all"
 * ports are never touched (they name no specific VID).
 */
export function removeVidFromTrunklist(raw: string, vid: string): string {
  if (!raw || !vid) return raw;
  const out: string[] = [];
  for (const rec of parseTrunklist(raw)) {
    const ports = rec.ports
      .map(([label, spec]): [string, string] => {
        if (spec === 'all') return [label, spec];
        return [label, spec.split(',').filter((v) => v !== vid).join(',')];
      })
      .filter(([, spec]) => spec !== '');
    if (ports.length > 0) out.push(`<${rec.mac}${ports.map(([l, s]) => `>${l}#${s}`).join('')}`);
  }
  return out.join('');
}

/**
 * Full-fidelity snapshot of everything a whole-table SDN write needs.
 * ALWAYS fetch a fresh one (fetchSdnWriteSnapshot) immediately before
 * building a payload — see the module header's staleness warning.
 */
export interface SdnWriteSnapshot {
  /** Raw sdn_rl rows, idx "0" (DEFAULT) already excluded. */
  sdnRows: string[][];
  /** Raw subnet_rl rows keyed by their own subnet_idx column. */
  subnetByIdx: Map<string, string[]>;
  /** Raw vlan_rl rows (all profiles). */
  vlanRows: string[][];
  /** Parsed sdn_access_rl pairs. */
  accessRows: string[][];
  /** radius_list, verbatim — never decomposed, always re-posted unchanged. */
  radiusListRaw: string;
  /**
   * vlan_trunklist, verbatim (`<MAC>PORT#VID[,VID…]>PORT#…` per AiMesh node —
   * sdn.js:13384). Round-tripped unchanged on create/edit (never decomposed);
   * the deleted profile's VID is stripped from it on delete. See the module
   * header's "three extra list keys" note.
   */
  vlanTrunklistRaw: string;
  lan: {
    ipaddr: string;
    netmask: string;
    dhcpEnable: string;
    dhcpLease: string;
    domain: string;
    dns1: string;
    dns2: string;
    wins: string;
    dhcpStatic: string;
    dnsprivEnable: string;
    dnsprivProfile: string;
    wan0Ipaddr: string;
    wan1Ipaddr: string;
  };
  /** sdn.js:68 — cap used by every allocator's linear scan below. */
  sdnMaximum: number;
  /** nvram qos_enable === '1' at snapshot time — drives the restart_qos;restart_firewall rc segment (sdn.js:9252). */
  qosActive: boolean;
  /**
   * Native's `support_adguard_dns` (sdn.js:246): ui_support.adguard_dns
   * truthy AND router in RT mode. Read from the get_ui_support() hook —
   * native's own isSupport source — NOT from the *_support state.js globals,
   * because adguard_dns is a ui_support-only key set by closed-source
   * web_hook code (no rc_support token, no state.js global; live capture
   * proves it's truthy on the RT-BE92U while the collector's flag set may
   * not carry it). Native also accepts WISP mode; this build recognizes only
   * RT (sw_mode '1') — on a WISP unit the computed string would lack
   * restart_stubby, a known, documented narrowing.
   */
  supportAdguardDns: boolean;
}

/**
 * sdn_maximum = (isSupport("MaxRule_SDN")=="0") ? 6 : (parseInt(cap) - 1).
 * sdn.js:68. flagValue() surfaces the same live capability this repo already
 * collects (lib/capabilities.ts); falls back to the native default of 6 when
 * the flag is absent (matches native's own fallback for the "0"/unset case).
 */
export function getSdnMaximum(caps: Capabilities): number {
  const v = flagValue(caps, 'MaxRule_SDN');
  if (v === undefined) return 6;
  const s = String(v);
  if (s === '' || s === '0') return 6;
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n > 1 ? n - 1 : 6;
}

export async function fetchSdnWriteSnapshot(caps: Capabilities): Promise<SdnWriteSnapshot> {
  const ascii = await nvramCharToAscii(['sdn_rl', 'subnet_rl', 'vlan_rl', 'radius_list', 'sdn_access_rl', 'vlan_trunklist']);
  const lan = await nvramCharToAscii([
    'lan_ipaddr', 'lan_netmask', 'dhcp_enable_x', 'dhcp_lease', 'lan_domain',
    'dhcp_dns1_x', 'dhcp_dns2_x', 'dhcp_wins_x', 'dhcp_static_x',
    'dnspriv_enable', 'dnspriv_profile', 'wan0_ipaddr', 'wan1_ipaddr',
  ]);
  const plain = await nvramGet(['qos_enable', 'sw_mode']);
  // Native's isSupport source (client_function.js:141-144) — see the
  // supportAdguardDns doc comment for why this is a live hook read rather
  // than a caps-flag lookup. Best-effort: on failure, fall back to the flag
  // set (which errs toward omitting restart_stubby, the segment that is
  // functionally redundant for the edited profile anyway — see
  // sdnEditRcService).
  let adguardUi: boolean;
  try {
    const ui = await appGet(['get_ui_support()']);
    const raw = ui.get_ui_support;
    const parsed = typeof raw === 'string' ? (JSON.parse(raw) as Record<string, unknown>) : (raw as Record<string, unknown> | undefined);
    const v = parsed?.adguard_dns;
    adguardUi = v !== undefined && v !== 0 && v !== '0' && v !== '' && v !== false;
  } catch {
    adguardUi = flagValue(caps, 'adguard_dns') !== undefined;
  }
  const sdnRows = parseRuleList(ascii.sdn_rl, SDN_RL_SPEC).filter((r) => rowGet(SDN_RL_SPEC, r, 'idx') !== '0');
  const subnetRowsRaw = parseRuleList(ascii.subnet_rl, SUBNET_RL_SPEC);
  const subnetByIdx = new Map(subnetRowsRaw.map((r) => [rowGet(SUBNET_RL_SPEC, r, 'subnet_idx'), r] as const));
  const vlanRows = parseRuleList(ascii.vlan_rl, VLAN_RL_SPEC);
  const accessRows = parseRuleList(ascii.sdn_access_rl, SDN_ACCESS_SPEC);
  return {
    sdnRows,
    subnetByIdx,
    vlanRows,
    accessRows,
    radiusListRaw: ascii.radius_list ?? '',
    vlanTrunklistRaw: ascii.vlan_trunklist ?? '',
    lan: {
      ipaddr: lan.lan_ipaddr ?? '',
      netmask: lan.lan_netmask ?? '',
      dhcpEnable: lan.dhcp_enable_x ?? '',
      dhcpLease: lan.dhcp_lease ?? '',
      domain: lan.lan_domain ?? '',
      dns1: lan.dhcp_dns1_x ?? '',
      dns2: lan.dhcp_dns2_x ?? '',
      wins: lan.dhcp_wins_x ?? '',
      dhcpStatic: lan.dhcp_static_x ?? '',
      dnsprivEnable: lan.dnspriv_enable ?? '',
      dnsprivProfile: lan.dnspriv_profile ?? '',
      wan0Ipaddr: lan.wan0_ipaddr ?? '',
      wan1Ipaddr: lan.wan1_ipaddr ?? '',
    },
    sdnMaximum: getSdnMaximum(caps),
    qosActive: plain.qos_enable === '1',
    supportAdguardDns: adguardUi && plain.sw_mode === '1',
  };
}

function assertGuestClassRow(row: string[]): void {
  const name = rowGet(SDN_RL_SPEC, row, 'name');
  if (!isGuestClassSdnName(name)) {
    throw new Error(
      `SDN write refused: profile "${name}" is a MAINFH/MAINBH record, which is strictly view-only ` +
        'in this build (see the risk note in lib/sdn.ts and the research brief §7).',
    );
  }
}

/** Second, independent backstop: no constructed payload may ever carry an apm{idx}_* key. */
function assertNoApmKeys(fields: Record<string, string>): void {
  for (const k of Object.keys(fields)) {
    if (/^apm\d/.test(k)) {
      throw new Error(
        `SDN write refused: apm-family key "${k}" would be posted. MAINFH/MAINBH profiles are ` +
          'strictly view-only in this build.',
      );
    }
  }
}

// -----------------------------------------------------------------------------
// Index allocation — client-side linear scans, mirroring sdn.js's own (the
// firmware has no reservable "allocate a slot" endpoint; see brief §1b).
// -----------------------------------------------------------------------------

function nextFreeIndex(used: Set<string>, start: number, count: number): number {
  for (let i = start; i < start + count; i++) {
    if (!used.has(String(i))) return i;
  }
  throw new Error(`No free SDN index slot in [${start}, ${start + count - 1}] — all ${count} in use`);
}

// sdn.js:11370-11376, 11497-11523 (category "sdn"): scans ALL profiles' idx.
function allocateSdnIdx(snap: SdnWriteSnapshot): string {
  const used = new Set(snap.sdnRows.map((r) => rowGet(SDN_RL_SPEC, r, 'idx')));
  return String(nextFreeIndex(used, 1, snap.sdnMaximum));
}

// sdn.js:11417-11419, 11497-11523 (category "subnet"): scans ALL subnet_idx.
function allocateSubnetIdx(snap: SdnWriteSnapshot): string {
  const used = new Set(snap.subnetByIdx.keys());
  return String(nextFreeIndex(used, 1, snap.sdnMaximum));
}

// sdn.js:11391-11402 (get_vlan_rl_new_idx): scans ALL vlan_idx.
function allocateVlanIdx(snap: SdnWriteSnapshot): string {
  const used = new Set(snap.vlanRows.map((r) => rowGet(VLAN_RL_SPEC, r, 'vlan_idx')));
  return String(nextFreeIndex(used, 1, snap.sdnMaximum));
}

// sdn.js:11403-11415 (get_vlan_rl_new_vid): starts at 52 (51 is DEFAULT's VID).
function allocateVid(snap: SdnWriteSnapshot): string {
  const used = new Set(snap.vlanRows.map((r) => rowGet(VLAN_RL_SPEC, r, 'vid')));
  return String(nextFreeIndex(used, 52, snap.sdnMaximum));
}

/**
 * sdn.js:11524-11536 (get_apg_rl_new_idx): the apg pool is separate from the
 * apm pool — MAINFH/MAINBH rows' apg_idx column values must be excluded from
 * (not counted against) this scan, matching native's own pool split.
 */
function allocateApgIdx(snap: SdnWriteSnapshot): string {
  const used = new Set(
    snap.sdnRows
      .filter((r) => isGuestClassSdnName(rowGet(SDN_RL_SPEC, r, 'name')))
      .map((r) => rowGet(SDN_RL_SPEC, r, 'apg_idx')),
  );
  return String(nextFreeIndex(used, 1, snap.sdnMaximum));
}

// sdn.js:11451-11474 (get_subnet_rl_new_ipaddr): 3rd-octet scan 52..254,
// skipping lan_ipaddr / wan0_ipaddr / wan1_ipaddr and every existing profile's
// subnet_rl.addr octet.
function allocateSubnetOctet(snap: SdnWriteSnapshot): string {
  const octetOf = (ip: string): string => ip.split('.')[2] ?? '';
  const used = new Set<string>();
  if (snap.lan.ipaddr) used.add(octetOf(snap.lan.ipaddr));
  if (snap.lan.wan0Ipaddr) used.add(octetOf(snap.lan.wan0Ipaddr));
  if (snap.lan.wan1Ipaddr) used.add(octetOf(snap.lan.wan1Ipaddr));
  for (const row of snap.subnetByIdx.values()) {
    const addr = rowGet(SUBNET_RL_SPEC, row, 'addr');
    if (addr) used.add(octetOf(addr));
  }
  for (let o = 52; o < 255; o++) {
    if (!used.has(String(o))) return String(o);
  }
  throw new Error('No free /24 subnet octet in the 52-254 range for a new SDN subnet');
}

// -----------------------------------------------------------------------------
// Band selection <-> apg{idx}_dut_list.
//
// A per-node dut_list (mac>bandBitwise>lanport per AiMesh node, built from
// live AiMesh node capability data — sdn.js:11542-11593 get_dut_list) is out
// of reach here: this extension has no equivalent AiMesh-node-capability read
// implemented. Instead this module always uses the WILDCARD "sync to all
// nodes" form native itself uses for the plain LEGACY guest wizard type:
// mac "*" (checked for literally, sdn.js:11848-11861 check_dut_list_is_star)
// with a single record `<*>{bitwise}>`, bitwise built from canonical
// single-band-group sums (sdn.js:11714-11723, get_legacy_dut_list):
//   2.4GHz -> 1, 5GHz -> 2+4 = 6, 6GHz -> 16+64 = 80 (combined by OR/sum when
// multiple bands are selected). This is a real native code path (the
// wizard's "Sync to all AiMesh node(s)" toggle), not an invented format.
// -----------------------------------------------------------------------------

const BAND_BIT: Record<Band, number> = { '24': 1, '5': 2 + 4, '6': 16 + 64 };

export function encodeDutListStar(bands: Set<Band>): string {
  let bitwise = 0;
  for (const b of bands) bitwise |= BAND_BIT[b];
  return bitwise === 0 ? '' : `<*>${bitwise}>`;
}

// -----------------------------------------------------------------------------
// apg{idx}_security — per-band-group `<bitmask>auth>crypto>psk>radiusIdx`
// records concatenated together. Bitmasks 3/13/16/96 are fixed "security
// profile slots" (2.4+5G combo, its MLO variant, plain 6G, 6G MLO variant),
// NOT the same bitwise space as dut_list. sdn.js:2361-2364 (defaults for a
// brand-new PSK-only profile: auth "psk2" for 2.4/5G, "sae" for 6G, crypto
// "aes"). `radiusIdx` is always the profile's OWN sdn idx even for pure PSK
// auth (sdn.js:2341, `const radius_idx = sdn_profile.sdn_rl.idx`) — it is a
// linkage slot, not proof RADIUS is in use; securityUsesRadius() below is the
// actual signal this module relies on.
// -----------------------------------------------------------------------------

interface SecurityGroup {
  bitmask: string;
  auth: string;
  crypto: string;
  pwd: string;
  radiusIdx: string;
}

function parseSecurityGroups(raw: string): SecurityGroup[] {
  return raw
    .split('<')
    .filter(Boolean)
    .map((g) => {
      const [bitmask, auth, crypto, pwd, radiusIdx] = g.split('>');
      return { bitmask: bitmask ?? '', auth: auth ?? '', crypto: crypto ?? '', pwd: pwd ?? '', radiusIdx: radiusIdx ?? '' };
    });
}

function serializeSecurityGroups(groups: SecurityGroup[]): string {
  return groups.map((g) => `<${g.bitmask}>${g.auth}>${g.crypto}>${g.pwd}>${g.radiusIdx}`).join('');
}

// sdn.js:2361-2364.
function buildDefaultSecurityGroups(sdnIdx: string, psk: string): SecurityGroup[] {
  return [
    { bitmask: '3', auth: 'psk2', crypto: 'aes', pwd: psk, radiusIdx: sdnIdx },
    { bitmask: '13', auth: 'psk2', crypto: 'aes', pwd: psk, radiusIdx: sdnIdx },
    { bitmask: '16', auth: 'sae', crypto: 'aes', pwd: psk, radiusIdx: sdnIdx },
    { bitmask: '96', auth: 'sae', crypto: 'aes', pwd: psk, radiusIdx: sdnIdx },
  ];
}

/** Replace only the pwd field of each existing group; falls back to native's PSK defaults if empty. */
function applyPskToSecurityGroups(existing: string, sdnIdx: string, psk: string): string {
  const groups = parseSecurityGroups(existing);
  if (groups.length === 0) return serializeSecurityGroups(buildDefaultSecurityGroups(sdnIdx, psk));
  return serializeSecurityGroups(groups.map((g) => ({ ...g, pwd: psk })));
}

/**
 * radius_list rows are keyed by radius_idx (their own field 0); since
 * apg_rl.security's radiusIdx slot is always the profile's own sdn idx
 * regardless of auth type (see above), the only reliable "this profile
 * actually uses RADIUS" signal is a live radius_list row for this idx.
 */
export function securityUsesRadius(radiusListRaw: string, sdnIdx: string): boolean {
  return radiusListRaw
    .split('<')
    .filter(Boolean)
    .some((rec) => rec.split('>')[0] === sdnIdx);
}

// -----------------------------------------------------------------------------
// Client-side validation (sdn.js §5 of the brief).
// -----------------------------------------------------------------------------

/** sdn.js valid_SSID (~9847-9875) + valid_block_chars (~9724-9755). */
export function validateGuestSsid(ssid: string): string | null {
  if (ssid.length === 0) return 'SSID is required';
  if (new TextEncoder().encode(ssid).length > 32) return 'SSID exceeds 32 bytes (UTF-8)';
  if (!/^[\x20-\x7e]*$/.test(ssid)) {
    return 'SSID may only use printable ASCII characters (32-126) in this build';
  }
  return null;
}

/** sdn.js valid_psk (~9756-9803). */
export function validateGuestPsk(psk: string): string | null {
  if (psk.length < 8 || psk.length > 64) return 'Passphrase must be 8-64 characters';
  if (psk !== psk.trim()) return 'Passphrase cannot start or end with whitespace';
  if (psk.startsWith('"') || psk.endsWith('"')) return 'Passphrase cannot start or end with a quote character';
  if (psk.length === 64 && !/^[0-9a-fA-F]{64}$/.test(psk)) {
    return 'A 64-character passphrase is treated as a raw hex PSK and must be all hex digits';
  }
  if (!/^[\x20-\x7e]*$/.test(psk)) return 'Passphrase may only use printable ASCII characters (32-126)';
  return null;
}

// -----------------------------------------------------------------------------
// apg{idx}_* field set — sdn.js apg_rl_attr (sdn.js:10819-10837), posted keys
// per parse_apg_rl_to_apgX_rl (sdn.js:12373-12387: skips apg_idx and
// disabled; renames apg_11be -> 11be).
// -----------------------------------------------------------------------------

export interface GuestProfileApgFields {
  enable: string;
  ssid: string;
  hide_ssid: string;
  security: string;
  bw_limit: string;
  timesched: string;
  sched: string;
  expiretime: string;
  ap_isolate: string;
  macmode: string;
  mlo: string;
  maclist: string;
  iot_max_cmpt: string;
  '11be': string;
  dut_list: string;
}

const APG_FIELD_IDS: (keyof GuestProfileApgFields)[] = [
  'enable', 'ssid', 'hide_ssid', 'security', 'bw_limit', 'timesched', 'sched', 'expiretime',
  'ap_isolate', 'macmode', 'mlo', 'maclist', 'iot_max_cmpt', '11be', 'dut_list',
];

/** Always the literal "apg" prefix — this module never accepts "apm" as an argument. */
function buildApgKeyValues(apgIdx: string, fields: GuestProfileApgFields): Record<string, string> {
  const out: Record<string, string> = {};
  for (const id of APG_FIELD_IDS) out[`apg${apgIdx}_${id}`] = fields[id];
  return out;
}

function apgFieldsFromRaw(apgIdx: string, raw: Record<string, string>): GuestProfileApgFields {
  const get = (id: keyof GuestProfileApgFields): string => raw[`apg${apgIdx}_${id}`] ?? '';
  return {
    enable: get('enable'), ssid: get('ssid'), hide_ssid: get('hide_ssid'), security: get('security'),
    bw_limit: get('bw_limit'), timesched: get('timesched'), sched: get('sched'), expiretime: get('expiretime'),
    ap_isolate: get('ap_isolate'), macmode: get('macmode'), mlo: get('mlo'), maclist: get('maclist'),
    iot_max_cmpt: get('iot_max_cmpt'), '11be': get('11be'), dut_list: get('dut_list'),
  };
}

// sdn.js:11476-11496 (get_new_apg_rl) defaults for a brand-new profile.
function defaultApgFields(sdnIdx: string, ssid: string, psk: string, bands: Set<Band>): GuestProfileApgFields {
  return {
    enable: '1',
    ssid,
    hide_ssid: '0',
    security: serializeSecurityGroups(buildDefaultSecurityGroups(sdnIdx, psk)),
    bw_limit: '<0>>',
    timesched: '0',
    sched: '',
    expiretime: '',
    ap_isolate: '0',
    macmode: 'disabled',
    mlo: '0',
    maclist: '',
    iot_max_cmpt: '',
    '11be': '0',
    dut_list: encodeDutListStar(bands),
  };
}

/** Reads the FULL current apg{idx}_* set for an existing profile — needed before an edit, for byte-verbatim round-trip of untouched fields. */
export async function fetchGuestProfileApgFields(apgIdx: string): Promise<Record<string, string>> {
  const keys = APG_FIELD_IDS.map((id) => `apg${apgIdx}_${id}`);
  return nvramCharToAscii(keys);
}

export function getGuestProfileSummary(
  snap: SdnWriteSnapshot,
  sdnIdx: string,
): { apgIdx: string; name: string; enabled: boolean } | null {
  const row = snap.sdnRows.find((r) => rowGet(SDN_RL_SPEC, r, 'idx') === sdnIdx);
  if (!row) return null;
  return {
    apgIdx: rowGet(SDN_RL_SPEC, row, 'apg_idx'),
    name: rowGet(SDN_RL_SPEC, row, 'name'),
    enabled: rowGet(SDN_RL_SPEC, row, 'enable') === '1',
  };
}

// -----------------------------------------------------------------------------
// rc_service assembly — a function of the profile, reproducing native's
// apply_profile / delete-path logic (source-resolved 2026-08-01, closing the
// "SDN rc_service is richer than our constant" loop; previously a static
// 'restart_wireless').
//
// Native's edit assembly (sdn.js apply_profile, 9099-9501) keys every
// segment on CURRENT state (DOM toggles + nvram), never on which fields
// changed. Fixed append order:
//   BASE: "restart_wireless;restart_sdn {sdn_rl.idx};"          (sdn.js:9126)
//     — swapped wholesale for "restart_net_and_phy;" when the profile has an
//       AiMesh port binding or a vlan_trunklist entry for its VID
//       (sdn.js:9100-9123). This build REFUSES that case instead (see
//       buildEditGuestProfileWrite) — a full network+PHY bounce is out of
//       scope per the module header.
//   + "restart_qos;restart_firewall;"  when bw_limit is on OR qos_enable==1
//                                                        (sdn.js:9248/9252)
//   + "restart_chilli;restart_uam_srv;" when cp_idx is 2 or 4 (sdn.js:9382)
//   + "restart_stubby;"  when support_adguard_dns && subnet_idx > 0
//                                                    (sdn.js:9466 + 9496)
// The restart_stubby trigger was live-observed 2026-07-31
// (docs/LIVE_PROBE_RT-BE92U.md §9.4: "restart_wireless;restart_sdn 4;
// restart_stubby;" for a plain SSID rename) and initially mis-hypothesized
// as dot_enable-keyed; source shows it is NOT keyed on dot_enable,
// dnspriv_enable, or the AdGuard toggle — the edit path at sdn.js:9466
// deliberately drops the `#adguard_enable` term all eight wizard copies
// carry (sdn.js:2421…5645), so on an adguard_dns-capable RT/WISP unit every
// edit of every subnet-owning profile emits it. Functionally it is
// near-redundant: `restart_sdn {idx}` already carries SDN_FEATURE_DNSPRIV
// (rc sdn.h:23, services.c:19477-19492) for the edited profile; the bare
// restart_stubby additionally bounces every OTHER network's stubby
// (ALL_SDN, services.c:19626-19649), each instance self-gated on its own
// dot_enable (rc/sdn.c:340) — a no-op where DoT is off, a brief DNS blip
// where it is on. Emitted anyway for byte-parity with native.
//
// Gaming-profile /24-change firewall (sdn.js:9406-9415) is not reproduced:
// this build cannot construct that edit (no subnet editing).
//
// sdn_rl_x/vlan_rl_x/subnet_rl_x/radius_list_x (delete only) are literal
// router_defaults[] "for remove" entries (defaults.c:5488-5491) posted
// alongside the trimmed tables, per sdn.js:8530 (parse_JSONToStr_del_sdn_all_rl).
// -----------------------------------------------------------------------------

/** Shared conditional tail segments, in native's fixed append order (edit path). */
function rcTail(snap: SdnWriteSnapshot, opts: { cpIdx?: string; subnetIdx?: string }): string {
  let tail = '';
  if (snap.qosActive) tail += 'restart_qos;restart_firewall;';
  if (opts.cpIdx === '2' || opts.cpIdx === '4') tail += 'restart_chilli;restart_uam_srv;';
  if (snap.supportAdguardDns && (parseInt(opts.subnetIdx ?? '0', 10) || 0) > 0) tail += 'restart_stubby;';
  return tail;
}

/**
 * Wizard-create string (sdn.js:2330-5894, all eight wizard paths share the
 * shape): base + qos. The wizard's restart_stubby additionally requires the
 * AdGuard toggle ON — this build never enables AdGuard on create, so the
 * segment never applies; cp_idx is always 0 for a new profile here.
 */
function sdnCreateRcService(snap: SdnWriteSnapshot, sdnIdx: string): string {
  return `restart_wireless;restart_sdn ${sdnIdx};` + rcTail(snap, {});
}

function sdnEditRcService(snap: SdnWriteSnapshot, sdnIdx: string, subnetIdx: string, cpIdx: string): string {
  return `restart_wireless;restart_sdn ${sdnIdx};` + rcTail(snap, { cpIdx, subnetIdx });
}

/**
 * Delete string (sdn.js:8558-8613): "start_sdn_del;restart_wireless;" + qos
 * (8588) + stubby (8591-8596 — native gates on the AdGuard iframe's DOM
 * presence, approximated here by the same support flag; the extra segment is
 * self-gated at rc level either way). NO restart_sdn on delete. Native's
 * optional "restart_ledg;" PREFIX (8572, support_ledg_sdn + sdn_name in
 * {Gaming, Kids, VPN}) is intentionally not reproduced: the ui_support flag
 * behind support_ledg_sdn is unverified in the vendored tree, and a wrong
 * flag name in an always-blocked payload would be worse than the omission —
 * restart_ledg only refreshes the LED strip.
 */
function sdnDeleteRcService(snap: SdnWriteSnapshot, subnetIdx: string): string {
  let rc = 'start_sdn_del;restart_wireless;';
  if (snap.qosActive) rc += 'restart_qos;restart_firewall;';
  if (snap.supportAdguardDns && (parseInt(subnetIdx, 10) || 0) > 0) rc += 'restart_stubby;';
  return rc;
}

/**
 * apg{idx}_dut_list record with a non-empty lanport column (field 2 of
 * `<mac>bandBitwise>lanport`) — the AiMesh-port-binding half of native's
 * restart_net_and_phy escalation predicate (sdn.js:9100-9111). This build's
 * own star dut_list (`<*>{bitwise}>`) always has an empty lanport.
 */
function dutListHasLanport(dutList: string): boolean {
  return dutList
    .split('<')
    .filter(Boolean)
    .some((rec) => (rec.split('>')[2] ?? '') !== '');
}

export interface SdnWritePayload {
  fields: Record<string, string>;
  verify: Record<string, string>;
  rcService: string;
}

export interface GuestProfileInput {
  ssid: string;
  psk: string;
  enabled: boolean;
  bands: Set<Band>;
}

/** sdn.js:11337-11536 (get_new_sdn_profile) — allocate every index, build fresh rows, no existing profile is touched. */
export function buildCreateGuestProfileWrite(snap: SdnWriteSnapshot, input: GuestProfileInput): SdnWritePayload {
  const ssidErr = validateGuestSsid(input.ssid);
  if (ssidErr) throw new Error(ssidErr);
  const pskErr = validateGuestPsk(input.psk);
  if (pskErr) throw new Error(pskErr);
  if (input.bands.size === 0) throw new Error('Select at least one radio band');
  if (snap.sdnRows.length >= snap.sdnMaximum) {
    throw new Error(`No free SDN profile slot (${snap.sdnMaximum} max — sdn.js:11337-11536 allocator cap)`);
  }

  const sdnIdx = allocateSdnIdx(snap);
  const vlanIdx = allocateVlanIdx(snap);
  const vid = allocateVid(snap);
  const subnetIdx = allocateSubnetIdx(snap);
  const apgIdx = allocateApgIdx(snap);
  const octet = allocateSubnetOctet(snap);

  // sdn_rl_attr defaults, sdn.js:10766-10790; sdn_name "Guest" mirrors the
  // plain "Guest Network" wizard type (sdn.js:1035, 3630) — a type label, not
  // the visible network name (that's apg{idx}_ssid).
  const sdnRowValues: Record<string, string> = {
    idx: sdnIdx, name: 'Guest', enable: input.enabled ? '1' : '0', vlan_idx: vlanIdx, subnet_idx: subnetIdx,
    apg_idx: apgIdx, vpnc_idx: '0', vpns_idx: '0', dns_filter_idx: '0', urlf_idx: '0', nwf_idx: '0', cp_idx: '0',
    gre_idx: '0', firewall_idx: '0', kill_switch: '0', access_host_service: '0', wan_unit: '0', pppoe_relay: '0',
    wan6_unit: '0', createby: 'WEB', mtwan_idx: '0', mswan_idx: '0', prio: '0',
  };
  const sdnRow = SDN_RL_SPEC.columns.map((c) => sdnRowValues[c.id] ?? '');

  // sdn.js:11417-11449 (get_new_subnet_rl).
  const base = snap.lan.ipaddr.split('.').slice(0, 2).join('.');
  const lastOctet = snap.lan.ipaddr.split('.')[3] ?? '1';
  const subnetRowValues: Record<string, string> = {
    subnet_idx: subnetIdx,
    ifname: `br${parseInt(sdnIdx, 10) + 51}`,
    addr: `${base}.${octet}.${lastOctet}`,
    netmask: snap.lan.netmask,
    dhcp_enable: snap.lan.dhcpEnable,
    dhcp_min: `${base}.${octet}.1`,
    dhcp_max: `${base}.${octet}.254`,
    dhcp_lease: snap.lan.dhcpLease,
    domain_name: snap.lan.domain,
    dns: `${snap.lan.dns1},${snap.lan.dns2}`,
    wins: snap.lan.wins,
    // Inherited from the main LAN's dhcp_static_x, faithfully mirroring
    // native (sdn.js:11439). Latent firmware oddity worth knowing: on a
    // router with LAN reservations enabled this makes the new row
    // dhcp_static=1 with dhcp_unit "" (→ dhcp_res_idx 0), so the firmware's
    // per-SDN dnsmasq generator reads dhcpres0_rl for it (rc/sdn.c:635-637).
    // Native does exactly the same — reproduced, not fixed.
    dhcp_static: snap.lan.dhcpStatic,
    dhcp_unit: '',
    ipv6_enable: '0',
    autoconf: '0',
    addr6: sdnIdx,
    dhcp6_start: '1000',
    dhcp6_end: '2000',
    dns6: ',,',
    dot_enable: snap.lan.dnsprivEnable,
    dot_tls: snap.lan.dnsprivProfile,
    _trailing: '',
  };
  const subnetRow = SUBNET_RL_SPEC.columns.map((c) => subnetRowValues[c.id] ?? '');

  const vlanRowValues: Record<string, string> = { vlan_idx: vlanIdx, vid, port_isolation: '0', _trailing: '' };
  const vlanRow = VLAN_RL_SPEC.columns.map((c) => vlanRowValues[c.id] ?? '');

  const apgFields = defaultApgFields(sdnIdx, input.ssid, input.psk, input.bands);

  const sdnRows = [...snap.sdnRows, sdnRow];
  const vlanRows = [...snap.vlanRows, vlanRow];
  const subnetByIdx = new Map(snap.subnetByIdx);
  subnetByIdx.set(subnetIdx, subnetRow);

  const fields: Record<string, string> = {
    sdn_rl: serializeSdnRl(sdnRows),
    subnet_rl: serializeSubnetRl(sdnRows, subnetByIdx),
    vlan_rl: serializeVlanRl(vlanRows),
    radius_list: snap.radiusListRaw,
    // verbatim round-trip, posted even when empty — native's editor posts it
    // unconditionally (sdn.js:9422-9428 has no orig-non-empty guard); an
    // unchanged value is inert in httpd (web.c:4817). See the module header.
    vlan_trunklist: snap.vlanTrunklistRaw,
    // a new profile gets no inter-network ACL entries by default (native
    // never populates sdn_access_rl in get_new_sdn_profile) — unchanged.
    sdn_access_rl: serializeRuleList(snap.accessRows, SDN_ACCESS_SPEC),
    ...buildApgKeyValues(apgIdx, apgFields),
  };
  assertNoApmKeys(fields);
  return { fields, verify: { ...fields }, rcService: sdnCreateRcService(snap, sdnIdx) };
}

export interface GuestProfileEditInput {
  ssid?: string;
  psk?: string;
  enabled?: boolean;
  bands?: Set<Band>;
}

/** Edits SSID / passphrase / enable state / band selection on ONE existing guest-class profile. Only the passed-in fields change; everything else round-trips byte-verbatim. */
export function buildEditGuestProfileWrite(
  snap: SdnWriteSnapshot,
  sdnIdx: string,
  currentApgRaw: Record<string, string>,
  input: GuestProfileEditInput,
): SdnWritePayload {
  const row = snap.sdnRows.find((r) => rowGet(SDN_RL_SPEC, r, 'idx') === sdnIdx);
  if (!row) throw new Error(`SDN profile idx ${sdnIdx} not found in the current snapshot`);
  assertGuestClassRow(row);

  if (input.ssid !== undefined) {
    const err = validateGuestSsid(input.ssid);
    if (err) throw new Error(err);
  }
  if (input.psk !== undefined) {
    const err = validateGuestPsk(input.psk);
    if (err) throw new Error(err);
    if (securityUsesRadius(snap.radiusListRaw, sdnIdx)) {
      throw new Error(
        'This profile has a matching radius_list row (RADIUS/Enterprise security) — passphrase ' +
          'editing is out of scope for this build (see the module header).',
      );
    }
  }
  if (input.bands !== undefined && input.bands.size === 0) throw new Error('Select at least one radio band');

  const apgIdx = rowGet(SDN_RL_SPEC, row, 'apg_idx');
  const currentFields = apgFieldsFromRaw(apgIdx, currentApgRaw);

  // Native swaps the ENTIRE rc base to "restart_net_and_phy;" — a full
  // network+PHY bounce that drops every client on every network — when the
  // profile has an AiMesh port binding or a vlan_trunklist entry for its VID
  // (sdn.js:9100-9123). Port binding / VLAN trunking is out of scope for
  // this module (see header), so refuse rather than silently escalate or,
  // worse, emit the un-escalated string native would not send.
  const vlanIdx = rowGet(SDN_RL_SPEC, row, 'vlan_idx');
  const vlanRow = snap.vlanRows.find((r) => rowGet(VLAN_RL_SPEC, r, 'vlan_idx') === vlanIdx);
  const vid = vlanRow ? rowGet(VLAN_RL_SPEC, vlanRow, 'vid') : '';
  if (dutListHasLanport(currentFields.dut_list) || trunklistBindsVid(snap.vlanTrunklistRaw, vid)) {
    throw new Error(
      'SDN edit refused: this profile has an AiMesh port binding or a VLAN trunk entry for its VID, ' +
        'which native escalates to restart_net_and_phy (sdn.js:9100-9123) — out of scope for this build.',
    );
  }
  const nextFields: GuestProfileApgFields = {
    ...currentFields,
    ...(input.ssid !== undefined ? { ssid: input.ssid } : {}),
    ...(input.enabled !== undefined ? { enable: input.enabled ? '1' : '0' } : {}),
    ...(input.bands !== undefined ? { dut_list: encodeDutListStar(input.bands) } : {}),
    ...(input.psk !== undefined ? { security: applyPskToSecurityGroups(currentFields.security, sdnIdx, input.psk) } : {}),
  };

  const nextRow = input.enabled !== undefined ? rowSet(SDN_RL_SPEC, row, 'enable', input.enabled ? '1' : '0') : row;
  const sdnRows = snap.sdnRows.map((r) => (r === row ? nextRow : r));

  const fields: Record<string, string> = {
    sdn_rl: serializeSdnRl(sdnRows),
    // unchanged, but always re-posted alongside sdn_rl for payload parity —
    // see the module header's corrected ride-along note.
    subnet_rl: serializeSubnetRl(sdnRows, snap.subnetByIdx),
    vlan_rl: serializeVlanRl(snap.vlanRows),
    radius_list: snap.radiusListRaw,
    // verbatim round-trip, posted even when empty (native parity — see the
    // create builder's note and the module header). This module never edits
    // a VID, so the verbatim value is byte-identical to native's output.
    vlan_trunklist: snap.vlanTrunklistRaw,
    sdn_access_rl: serializeRuleList(snap.accessRows, SDN_ACCESS_SPEC),
    ...buildApgKeyValues(apgIdx, nextFields),
    // dhcpres{N}_rl / dot{N}_rl are DELIBERATELY not posted on edit — see the
    // module header's "three extra list keys" note (omission is safer than
    // native's blank-unless-loaded / AdGuard-stripping behavior).
  };
  assertNoApmKeys(fields);
  return {
    fields,
    verify: { ...fields },
    rcService: sdnEditRcService(snap, sdnIdx, rowGet(SDN_RL_SPEC, row, 'subnet_idx'), rowGet(SDN_RL_SPEC, row, 'cp_idx')),
  };
}

/**
 * Removes ONE guest-class profile: its sdn_rl/subnet_rl/vlan_rl rows are
 * dropped from the whole-table rewrite, sibling sdn_access_rl entries
 * referencing it are stripped (sdn.js:8514-8529), and the `_x` "for remove"
 * companion keys plus the apg{idx}_enable/disabled=0 flags are posted
 * (sdn.js:8530, 8585-8586) — SSID/security/etc are deliberately left stale
 * under the now-orphaned apg{idx}_* keys, matching native (never cleared on
 * delete).
 */
export function buildDeleteGuestProfileWrite(snap: SdnWriteSnapshot, sdnIdx: string): SdnWritePayload {
  const row = snap.sdnRows.find((r) => rowGet(SDN_RL_SPEC, r, 'idx') === sdnIdx);
  if (!row) throw new Error(`SDN profile idx ${sdnIdx} not found in the current snapshot`);
  assertGuestClassRow(row);

  const apgIdx = rowGet(SDN_RL_SPEC, row, 'apg_idx');
  const subnetIdx = rowGet(SDN_RL_SPEC, row, 'subnet_idx');
  const vlanIdx = rowGet(SDN_RL_SPEC, row, 'vlan_idx');
  const subnetRow = snap.subnetByIdx.get(subnetIdx);
  const vlanRow = snap.vlanRows.find((r) => rowGet(VLAN_RL_SPEC, r, 'vlan_idx') === vlanIdx);

  const remainingSdnRows = snap.sdnRows.filter((r) => r !== row);
  const remainingVlanRows = vlanRow ? snap.vlanRows.filter((r) => r !== vlanRow) : snap.vlanRows;
  const remainingAccessRows = snap.accessRows.filter(
    (r) => rowGet(SDN_ACCESS_SPEC, r, 'access_sdn_idx') !== sdnIdx && rowGet(SDN_ACCESS_SPEC, r, 'sdn_idx') !== sdnIdx,
  );
  const remainingSubnetByIdx = new Map(snap.subnetByIdx);
  remainingSubnetByIdx.delete(subnetIdx);

  const fields: Record<string, string> = {
    sdn_rl: serializeSdnRl(remainingSdnRows),
    subnet_rl: serializeSubnetRl(remainingSdnRows, remainingSubnetByIdx),
    vlan_rl: serializeVlanRl(remainingVlanRows),
    radius_list: snap.radiusListRaw,
    sdn_access_rl: serializeRuleList(remainingAccessRows, SDN_ACCESS_SPEC),
    sdn_rl_x: serializeRuleList([row], SDN_RL_SPEC),
    vlan_rl_x: vlanRow ? serializeRuleList([vlanRow], VLAN_RL_SPEC) : '',
    subnet_rl_x: subnetRow ? serializeRuleList([subnetRow], SUBNET_RL_SPEC) : '',
    // this build never associates RADIUS with a profile it created/edited, so
    // there is no profile-specific radius_list row to emit here.
    radius_list_x: '',
    [`apg${apgIdx}_enable`]: '0',
    [`apg${apgIdx}_disabled`]: '0',
  };
  // Trunk-table repair, mirroring native's delete path (sdn.js:8577-8583,
  // posted only when the table is non-empty, same guard as sdn.js:8577): the
  // deleted profile's VID is stripped so a later create that recycles the VID
  // (allocateVid) can't inherit a physical AiMesh port binding.
  if (snap.vlanTrunklistRaw !== '' && vlanRow) {
    fields.vlan_trunklist = removeVidFromTrunklist(snap.vlanTrunklistRaw, rowGet(VLAN_RL_SPEC, vlanRow, 'vid'));
  }
  // Per-profile side tables, blanked like native (dhcpres: sdn.js:8615-8618;
  // dot: sdn.js:8591-8596). Native gates the dot blank on dot_enable==1;
  // blanking unconditionally is a deliberate simplification — an already-empty
  // value is inert (web.c:4817), and on delete the subnet ceases to exist, so
  // clearing a populated-but-disabled dot table is strictly cleanup. This
  // matters because allocateSubnetIdx recycles indices and a new profile
  // inherits dot_enable from the global dnspriv_enable — a stale dot{N}_rl
  // would graft the deleted profile's DoT upstreams onto the new network.
  if (parseInt(subnetIdx, 10) > 0) {
    fields[`dhcpres${subnetIdx}_rl`] = '';
    fields[`dot${subnetIdx}_rl`] = '';
  }
  assertNoApmKeys(fields);
  return { fields, verify: { ...fields }, rcService: sdnDeleteRcService(snap, subnetIdx) };
}
