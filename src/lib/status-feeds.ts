/**
 * Readers for the router's status/diagnostic feeds.
 *
 * The status hooks (get_leases_array, get_route_array, get_connlist_array,
 * get_vserver_array, get_upnp_array, get_wl_status, …) do NOT emit JSON —
 * they emit JavaScript variable assignments like `leasearray= [["…"],[]];`
 * (httpd/data_arrays.c), designed for inline <% %> embedding. Through
 * appGet.cgi they arrive wrapped in a pseudo-JSON envelope:
 *   {"get_leases_array":leasearray= [...];\n}
 * The native UI copes by slicing fixed character offsets; we parse properly:
 * strip the envelope, then extract each `name = [ … ]` assignment with a
 * bracket-depth scanner and JSON.parse the array body (the emitters produce
 * JSON-compatible arrays, with a sentinel empty [] as the last element).
 */
import { fetchRouterText } from './router-io';

/** Fetch a hook's raw (non-JSON) output with the appGet envelope stripped. */
export async function fetchHookRaw(hook: string): Promise<string> {
  const text = await fetchRouterText('/appGet.cgi?hook=' + encodeURIComponent(hook));
  // Envelope: {\n"<hookname>":<payload>\n}\n — payload may itself contain
  // braces/quotes, so strip only the outermost wrapper.
  const m = text.match(/^\s*\{\s*"[^"]*":([\s\S]*)\}\s*$/);
  return m ? m[1] : text;
}

/**
 * nvram_dump payload arrives as `"…raw text…"` — the emitter wraps it in
 * double quotes WITHOUT escaping interior content, so it is not JSON-parseable
 * text; trim the outer quotes only.
 */
export async function fetchSyslog(): Promise<string> {
  const raw = await fetchHookRaw('nvram_dump("syslog.log","syslog.sh")');
  return raw.replace(/^\s*"?/, '').replace(/"?\s*$/, '');
}

/** Extract every `name = "value";` JS string assignment (ajax_vpn_status.asp style). */
export function parseJsScalarAssignments(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([A-Za-z_$][\w$]*)\s*=\s*"([^"\n]*)"\s*;/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out[m[1]] = m[2];
  return out;
}

/** Extract every `name = [ … ]` JS array assignment from hook output. */
export function parseJsArrayAssignments(text: string): Record<string, unknown[]> {
  const out: Record<string, unknown[]> = {};
  const re = /(?:var\s+)?([A-Za-z_$][\w$]*)\s*=\s*\[/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const name = m[1];
    const start = re.lastIndex - 1; // position of the opening '['
    let depth = 0;
    let inStr = false;
    let end = -1;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (inStr) {
        if (ch === '\\') i++;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === '[') depth++;
      else if (ch === ']') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) continue;
    try {
      const arr = JSON.parse(text.slice(start, end + 1)) as unknown[];
      // The emitters terminate lists with a sentinel empty [] element.
      out[name] = arr.filter((row) => !(Array.isArray(row) && row.length === 0));
      re.lastIndex = end + 1;
    } catch {
      // Malformed segment — skip this assignment, keep scanning.
      re.lastIndex = end + 1;
    }
  }
  return out;
}

async function hookArrays(hook: string): Promise<Record<string, string[][]>> {
  const raw = await fetchHookRaw(hook);
  const parsed = parseJsArrayAssignments(raw);
  const out: Record<string, string[][]> = {};
  for (const [k, v] of Object.entries(parsed)) {
    out[k] = v.filter((r): r is string[] => Array.isArray(r)).map((r) => r.map(String));
  }
  return out;
}

export interface DhcpLease {
  expires: string;
  mac: string;
  ip: string;
  hostname: string;
  vlanId?: string;
}

/** get_leases_array → leasearray: [expires, mac, ip, hostname(, vlanid)] */
export async function fetchDhcpLeases(): Promise<DhcpLease[]> {
  const arrays = await hookArrays('get_leases_array()');
  return (arrays.leasearray ?? []).map((r) => ({
    expires: r[0] ?? '',
    mac: r[1] ?? '',
    ip: r[2] ?? '',
    hostname: r[3] ?? '',
    vlanId: r[4],
  }));
}

export interface RouteEntry {
  dest: string;
  gateway: string;
  flags: string;
  metric: string;
  ref: string;
  use: string;
  dev: string;
  ifname: string;
}

/** get_route_array → routearray + routev6array (same 8-col layout). */
export async function fetchRoutes(): Promise<{ v4: RouteEntry[]; v6: RouteEntry[] }> {
  const arrays = await hookArrays('get_route_array()');
  const toEntry = (r: string[]): RouteEntry => ({
    dest: (r[0] ?? '').trim(),
    gateway: r[1] ?? '',
    flags: r[2] ?? '',
    metric: r[3] ?? '',
    ref: r[4] ?? '',
    use: r[5] ?? '',
    dev: r[6] ?? '',
    ifname: r[7] ?? '',
  });
  return { v4: (arrays.routearray ?? []).map(toEntry), v6: (arrays.routev6array ?? []).map(toEntry) };
}

export interface ConnEntry {
  proto: string;
  src: string;
  srcPort: string;
  dst: string;
  dstPort: string;
  state: string;
}

/** get_connlist_array → connarray: [proto, src, sport, dst, dport, state] */
export async function fetchConnections(): Promise<ConnEntry[]> {
  const arrays = await hookArrays('get_connlist_array()');
  return (arrays.connarray ?? []).map((r) => ({
    proto: r[0] ?? '',
    src: r[1] ?? '',
    srcPort: r[2] ?? '',
    dst: r[3] ?? '',
    dstPort: r[4] ?? '',
    state: r[5] ?? '',
  }));
}

export interface VServerEntry {
  src: string;
  dst: string;
  proto: string;
  portRange: string;
  redirectTo: string;
  localPort: string;
  chain: string;
}

/** get_vserver_array → vserverarray (7 cols, from live iptables NAT table). */
export async function fetchVServer(): Promise<VServerEntry[]> {
  const arrays = await hookArrays('get_vserver_array()');
  return (arrays.vserverarray ?? []).map((r) => ({
    src: r[0] ?? '',
    dst: r[1] ?? '',
    proto: r[2] ?? '',
    portRange: r[3] ?? '',
    redirectTo: r[4] ?? '',
    localPort: r[5] ?? '',
    chain: r[6] ?? '',
  }));
}

export interface UpnpEntry {
  proto: string;
  remoteAddr: string;
  remotePort: string;
  internalAddr: string;
  internalPort: string;
  timestamp: string;
  desc: string;
}

/** get_upnp_array → upnparray (7 cols). */
export async function fetchUpnpForwards(): Promise<UpnpEntry[]> {
  const arrays = await hookArrays('get_upnp_array()');
  return (arrays.upnparray ?? []).map((r) => ({
    proto: r[0] ?? '',
    remoteAddr: r[1] ?? '',
    remotePort: r[2] ?? '',
    internalAddr: r[3] ?? '',
    internalPort: r[4] ?? '',
    timestamp: r[5] ?? '',
    desc: r[6] ?? '',
  }));
}

/**
 * get_wl_status emits model-specific assignments (wireless client status);
 * surface every array it produces generically plus the raw text fallback.
 */
export async function fetchWirelessStatus(): Promise<{ arrays: Record<string, string[][]>; raw: string }> {
  const raw = await fetchHookRaw('get_wl_status()');
  return { arrays: await hookArraysFromRaw(raw), raw };
}

async function hookArraysFromRaw(raw: string): Promise<Record<string, string[][]>> {
  const parsed = parseJsArrayAssignments(raw);
  const out: Record<string, string[][]> = {};
  for (const [k, v] of Object.entries(parsed)) {
    out[k] = v.filter((r): r is string[] => Array.isArray(r)).map((r) => r.map(String));
  }
  return out;
}

/** get_ipv6net_array → ipv6cfgarray + ipv6clientarray. */
export async function fetchIpv6Status(): Promise<{ cfg: string[][]; clients: string[][] }> {
  const arrays = await hookArrays('get_ipv6net_array()');
  return { cfg: arrays.ipv6cfgarray ?? [], clients: arrays.ipv6clientarray ?? [] };
}

/**
 * Batched scalar hooks with args, e.g. sysinfo("cpu.model"). appGet keys these
 * as "funcname-arg0" but emits the value UNQUOTED (raw text), so the response
 * is not JSON — extract each `"key":value` span manually, value running to the
 * next `,\n"` boundary or the closing brace.
 */
export async function fetchScalarHooks(hooks: string[]): Promise<Record<string, string>> {
  if (hooks.length === 0) return {};
  const url = '/appGet.cgi?hook=' + hooks.map(encodeURIComponent).join('%3B');
  const text = await fetchRouterText(url);
  const out: Record<string, string> = {};
  const re = /"([^"]+)":/g;
  const matches: { key: string; valueStart: number; keyStart: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    matches.push({ key: m[1], valueStart: re.lastIndex, keyStart: m.index });
  }
  for (let i = 0; i < matches.length; i++) {
    const end = i + 1 < matches.length ? text.lastIndexOf(',', matches[i + 1].keyStart) : text.lastIndexOf('}');
    const rawVal = text.slice(matches[i].valueStart, end === -1 ? undefined : end).trim();
    out[matches[i].key] = rawVal.replace(/^"/, '').replace(/"$/, '');
  }
  return out;
}

export interface SysinfoSnapshot {
  /** [assoc, authorized, authenticated] per radio index. */
  wifiClients: string[][];
  /** [total, active] */
  connStats: string[];
  /** [total, free, buffer, cache, swapUsed, swapTotal, nvramUsed, jffsFree, simpleUsed, available] */
  memStats: string[];
  /** [load1, load5, load15] */
  cpuLoad: string[];
}

/** Merlin's ajax_sysinfo.asp feed (Tools_Sysinfo.asp backing data). */
export async function fetchSysinfoFeed(): Promise<SysinfoSnapshot> {
  const text = await fetchRouterText('/ajax_sysinfo.asp');
  const arrays = parseJsArrayAssignments(text);
  const strArr = (name: string): string[] => (arrays[name] ?? []).map(String);
  const wifiClients: string[][] = [];
  for (let i = 0; i < 4; i++) {
    const arr = arrays[`wlc_${i}_arr`];
    if (arr && arr.length > 0) wifiClients.push(arr.map(String));
  }
  return {
    wifiClients,
    connStats: strArr('conn_stats_arr'),
    memStats: strArr('mem_stats_arr'),
    cpuLoad: strArr('cpu_stats_arr'),
  };
}
