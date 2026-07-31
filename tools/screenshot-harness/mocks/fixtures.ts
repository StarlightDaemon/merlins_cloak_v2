/**
 * FICTIONAL router fixture data for the screenshot harness.
 *
 * Nothing here is, or is derived from, a real router: product id, firmware
 * numbers, MAC/IP addresses, hostnames and SSIDs are all invented for
 * Chrome Web Store screenshot purposes only.
 *
 *  - LAN/WAN addressing uses RFC1918 space (192.168.50.0/24) and the WAN
 *    address uses TEST-NET-3 (203.0.113.0/24, RFC 5737) — never a real
 *    routable address.
 *  - MAC addresses use the 02:xx:xx:xx:xx:xx locally-administered prefix.
 *  - The product id is stamped "-DEMO" so it can never be mistaken for a
 *    real device identifier, and firmware numbers are placeholder values.
 */

export interface FixtureClient {
  mac: string;
  ip: string;
  hostname: string;
  /** Wireless band the device shows up on, or undefined for wired/no-lease-band info. */
  band?: '2G' | '5G' | '6G';
  /** DHCP lease time remaining, in seconds. */
  leaseRemaining: string;
}

/** The fictional device roster shared by the Dashboard, Clients and DHCP views. */
export const FIXTURE_CLIENTS: FixtureClient[] = [
  { mac: '02:1A:2B:00:10:05', ip: '192.168.50.101', hostname: 'study-laptop', band: '5G', leaseRemaining: '84920' },
  { mac: '02:1A:2B:00:10:06', ip: '192.168.50.102', hostname: 'living-room-tv', leaseRemaining: '41310' },
  { mac: '02:1A:2B:00:10:07', ip: '192.168.50.103', hostname: 'kitchen-tablet', band: '2G', leaseRemaining: '71005' },
  { mac: '02:1A:2B:00:10:08', ip: '192.168.50.104', hostname: 'guest-phone', band: '5G', leaseRemaining: '11940' },
  { mac: '02:1A:2B:00:10:09', ip: '192.168.50.105', hostname: 'nas-server', band: '6G', leaseRemaining: '89975' },
  { mac: '02:1A:2B:00:10:0A', ip: '192.168.50.106', hostname: 'garage-cam', leaseRemaining: '55210' },
];

/** Two of the fixture clients are also shown as DHCP static-lease reservations. */
export const FIXTURE_STATIC_LEASES: { mac: string; ip: string; dns: string; hostname: string }[] = [
  { mac: '02:1A:2B:00:10:05', ip: '192.168.50.101', dns: '', hostname: 'study-laptop' },
  { mac: '02:1A:2B:00:10:09', ip: '192.168.50.105', dns: '', hostname: 'nas-server' },
];

/** Plain nvram_get / nvram_char_to_ascii key → value fixture table. */
export const FIXTURE_NVRAM: Record<string, string> = {
  // --- identity (collectCapabilities) ---
  productid: 'RT-DEMO88U',
  odmpid: 'RT-DEMO88U',
  firmver: '3.0.0.6',
  buildno: '9999',
  extendno: 'fixture_demo',
  rc_support: 'band6g appbase',
  lan_ipaddr: '192.168.50.1',

  // --- dashboard: WAN ---
  wan0_state_t: '2', // Connected
  wan0_ipaddr: '203.0.113.42', // TEST-NET-3 — never a routable address
  wan0_gateway: '203.0.113.1',
  wan0_dns: '203.0.113.53 203.0.113.54',
  wan0_proto: 'dhcp',

  // --- dashboard: wireless radios ---
  wl0_radio: '1',
  wl1_radio: '1',
  wl2_radio: '1',
  wl0_ssid: 'MerlinNet-Demo',
  wl1_ssid: 'MerlinNet-Demo-5G',
  wl2_ssid: 'MerlinNet-Demo-6G',

  // --- DHCP settings page (pages/defs/lan.ts dhcpPage) ---
  dhcp_enable_x: '1',
  lan_domain: '',
  dhcp_start: '192.168.50.100',
  dhcp_end: '192.168.50.200',
  dhcp_lease: '86400',
  dhcp_gateway_x: '',
  dhcp_dns1_x: '',
  dhcp_dns2_x: '',
  dhcpd_dns_router: '1',
  dhcp_wins_x: '',
  dhcp_static_x: '1',
  dhcpd_querylog: '0',
  // Rule-list encoding (lib/rulelist.ts): '<' record sep, '>' field sep,
  // columns [mac, ip, dns, hostname] — see pages/defs/lan.ts dhcpPage.
  dhcp_staticlist: FIXTURE_STATIC_LEASES.map((r) => `<${r.mac}>${r.ip}>${r.dns}>${r.hostname}`).join(''),
};

/** uptime() ej hook — dashboard keeps only the "(... since boot)" fragment. */
export const FIXTURE_UPTIME_RAW =
  'Fri, 31 Jul 2026 09:15:22 GMT(14 days, 06:22:10 since boot)';

/**
 * sysinfo("...") scalar hooks (Tools_Sysinfo.asp / pages/defs/nettools.tsx).
 * Keyed by the bare arg (the part inside the quotes) — the mock's appGet
 * handler (mocks/router-fetch.ts) prefixes it back to "sysinfo-<arg>" to
 * match the real firmware's key-naming convention for parenthesized scalar
 * hooks. Values are realistic-length FICTIONAL strings chosen specifically
 * to reproduce the narrow-viewport overflow defects (long CPU model/hwaccel
 * strings) rather than the short placeholders a real quick-look might use.
 */
export const FIXTURE_SYSINFO_SCALARS: Record<string, string> = {
  'cpu.model': 'BCM6765 - ARMv8 (Cores: 4)',
  'cpu.freq': '2000',
  'conn.max': '262144',
  'nvram.total': '262144',
  'jffs.total': '15616',
  cfe_version: '1.0.1.9',
  'hwaccel.runner': 'Enabled',
  'hwaccel.fc': 'Enabled',
  'driver_version.0': '9.30.113.0',
  'driver_version.1': '9.30.113.0',
  'driver_version.2': '9.30.113.0',
};

/**
 * get_wclientlist() — bridge → band → station-MAC → details. Only the MAC
 * keys are read (lib/pages/defs/clients.tsx); the per-station array contents
 * are never inspected, so empty arrays are fine.
 */
export const FIXTURE_WCLIENTLIST: Record<string, Record<string, Record<string, unknown[]>>> = {
  br0: {
    '2G': Object.fromEntries(
      FIXTURE_CLIENTS.filter((c) => c.band === '2G').map((c) => [c.mac, []]),
    ),
    '5G': Object.fromEntries(
      FIXTURE_CLIENTS.filter((c) => c.band === '5G').map((c) => [c.mac, []]),
    ),
    '6G': Object.fromEntries(
      FIXTURE_CLIENTS.filter((c) => c.band === '6G').map((c) => [c.mac, []]),
    ),
  },
};

/**
 * get_leases_array() payload (lib/status-feeds.ts fetchDhcpLeases): rows of
 * [expires, mac, ip, hostname], JS-array-assignment style (not JSON), with a
 * trailing empty-array sentinel matching the real firmware emitter.
 */
export function buildLeaseArrayPayload(): string {
  const rows = FIXTURE_CLIENTS.map((c) => [c.leaseRemaining, c.mac, c.ip, c.hostname]);
  rows.push([]);
  return `leasearray = ${JSON.stringify(rows)};`;
}

/**
 * ajax_sysinfo.asp (Merlin-only feed; also used as the branch-detection
 * probe). mem_stats_arr entries arrive pre-scaled in MB per
 * pages/defs/nettools.tsx's fmtMb() comment (live-observed, e.g. "993.76"),
 * so these are realistic MB-scale floats/ints for a ~1 GB router, not the
 * placeholder KB-scale integers a naive fixture might use — those rendered
 * as absurd "512.00 GB" totals and didn't exercise the real string lengths
 * ("993.76 MB / 286.27 MB / 311.39 MB") that reproduce the overflow defect.
 */
export const FIXTURE_SYSINFO_TEXT = `
wlc_0_arr = [3,3,3];
wlc_1_arr = [2,2,2];
wlc_2_arr = [1,1,1];
conn_stats_arr = [842,210];
mem_stats_arr = [993.76,286.27,18.42,71.23,0,0,164548,15616,393216,311.39];
cpu_stats_arr = [8,11,14];
`;
