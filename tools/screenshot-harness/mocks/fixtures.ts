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

/**
 * rc_support token controlling the SDN (mtlancfg) capability flag — see
 * lib/capabilities.ts hasFlag()'s rc_support fallback (this harness never has
 * real MAIN-world `*_support` globals, so rc_support parsing is always the
 * live path here). SDN is the DEFAULT fixture shape (matches the Dashboard
 * SSID defect fix's primary target: SDN-managed ASUSWRT 5.0 units); appending
 * `?classic=1` to the harness URL (before the `#` — see router-fetch.ts)
 * switches to FIXTURE_RC_SUPPORT_CLASSIC so the plain wl0/1/2_ssid fallback
 * table can still be exercised, e.g. `content.html?classic=1#/dashboard`.
 */
export const FIXTURE_RC_SUPPORT_SDN =
  'band6g appbase mtlancfg nt_center nt_center_ui amas timemachine wireguard openvpnd usb';
export const FIXTURE_RC_SUPPORT_CLASSIC = 'band6g appbase';
/**
 * `?dualwan=1` (same before-the-`#` convention as `?classic=1`, see
 * router-fetch.ts) adds the `dualwan` token on top of the normal SDN flag set
 * — hasFlag(caps, 'dualwan_support')'s rc_support fallback strips the
 * `_support` suffix and looks for the bare `dualwan` token — plus switches
 * wan1_ (its various nvram fields), wans_dualwan, wans_mode, wans_lb_ratio
 * and wan{0,1}_primary to populated dual-WAN values (see
 * FIXTURE_DUALWAN_NVRAM below). Every other flag from
 * FIXTURE_RC_SUPPORT_SDN is preserved so the rest of the app (SDN dashboard
 * table, notification center, AiMesh, etc.) keeps rendering normally on this
 * variant too. The single-WAN default (FIXTURE_RC_SUPPORT_SDN, no `dualwan`
 * token) is untouched — dashboard.tsx's dual-WAN branch only activates when
 * this flag is present AND wans_dualwan's tokens exclude "none".
 */
export const FIXTURE_RC_SUPPORT_DUALWAN = `${FIXTURE_RC_SUPPORT_SDN} dualwan`;

/**
 * Dual-WAN nvram overrides, applied only under `?dualwan=1` (see
 * router-fetch.ts's nvramValue()). wans_mode 'fo' (Failover) exercises the
 * dashboard's Primary/Standby role labels via wan0_primary/wan1_primary;
 * wans_lb_ratio is populated anyway (harmless — only rendered in 'lb' mode).
 * wan1 address space uses a second RFC 5737 TEST-NET block (198.51.100.0/24)
 * so it's visibly distinct from wan0's 203.0.113.0/24 in a screenshot.
 */
export const FIXTURE_DUALWAN_NVRAM: Record<string, string> = {
  wan1_state_t: '2', // Connected
  wan1_ipaddr: '198.51.100.77',
  wan1_gateway: '198.51.100.1',
  wan1_dns: '198.51.100.53',
  wan1_proto: 'dhcp',
  wans_dualwan: 'wan usb',
  wans_mode: 'fo',
  wans_lb_ratio: '3:1',
  wan0_primary: '1',
  wan1_primary: '0',
};

/** Plain nvram_get / nvram_char_to_ascii key → value fixture table. */
export const FIXTURE_NVRAM: Record<string, string> = {
  // --- identity (collectCapabilities) ---
  productid: 'RT-DEMO88U',
  odmpid: 'RT-DEMO88U',
  firmver: '3.0.0.6',
  buildno: '9999',
  extendno: 'fixture_demo',
  rc_support: FIXTURE_RC_SUPPORT_SDN,
  lan_ipaddr: '192.168.50.1',

  // --- DNS Director (used to exercise/screenshot the write-progress UI via
  // ?slowwrite=1 — see mocks/router-fetch.ts SLOW_WRITE) ---
  dnsfilter_enable_x: '0',

  // --- Tweaks (Tools_OtherSettings.asp) — required/numeric fields need a
  // valid starting value or SettingsPage's validation blocks Apply outright;
  // also used to exercise/screenshot the write-progress UI (this page's
  // write has no actionWait, so it settles instantly and heads straight into
  // the verify-poll loop, which is handy for observing that phase without
  // ?slowwrite=1's ~5s settle wait in the way).
  ct_max: '65536',
  ct_tcp_timeout: '0 432000 120 60 120 120 10 60 30 0',
  ct_udp_timeout: '30 180',

  // --- dashboard: WAN ---
  wan0_state_t: '2', // Connected
  wan0_ipaddr: '203.0.113.42', // TEST-NET-3 — never a routable address
  wan0_gateway: '203.0.113.1',
  wan0_dns: '203.0.113.53 203.0.113.54',
  wan0_proto: 'dhcp',

  // --- dashboard: wireless radios (per-band on/off state — read regardless
  // of SDN vs. classic; also the classic fallback table's SSID source) ---
  wl0_radio: '1',
  wl1_radio: '1',
  wl2_radio: '1',
  wl0_ssid: 'MerlinNet-Demo',
  wl1_ssid: 'MerlinNet-Demo-5G',
  wl2_ssid: 'MerlinNet-Demo-6G',

  // --- dashboard (SDN path) / SDN.asp: sdn_rl + subnet_rl + apg/apm{idx}_* ---
  // Format reference: lib/sdn.ts header comment, RAW/merlin/.../shared/
  // amas_apg_shared.h (~93-273) and RAW SDN.asp sdn.js get_dut_list()
  // (~11542-11594, dut_list record shape `<mac>bandBitwise>lanport`).
  // sdn_rl columns: idx>name>enable>vlan_idx>subnet_idx>apg_idx>… (rest
  // unused by this extension's read path, left blank).
  // MAINFH/MAINBH per-network fields live under apm{idx}_*, guest-class under
  // apg{idx}_*, and the two pools' idx spaces OVERLAP — this fixture
  // deliberately mirrors the live RT-BE92U layout that caught the apm/apg
  // mix-up (2026-07-31): MAINFH apg_idx=1 (apm pool) collides with the guest
  // row's apg_idx=1 (apg pool), so resolving the wrong family for a MAINFH
  // row visibly shows the guest SSID as "Main".
  // Five networks modeled, all FICTIONAL:
  //   idx1 MAINFH  (Main, all 3 bands)   -> apm1 "MerlinNet-Demo" (wildcard dut_list, live-observed shape)
  //   idx2 Guest   (2.4+5 GHz)           -> apg1 "MerlinNet-Guest"
  //   idx3 IoT     (2.4 GHz only)        -> apg2 "MerlinNet-IoT"
  //   idx4 MAINBH  (AiMesh backhaul, all 3 bands) -> apm2 "MerlinNet-Demo-BH"
  //     — enabled and carries a normal apg_idx/SSID/dut_list on purpose, so
  //     the fixture actually exercises the dashboard's MAINBH name filter
  //     (sdn.tsx's full list still shows it; the dashboard's network table
  //     must not).
  //   idx5 Kids    (disabled)            -> apg3 "MerlinNet-Kids-Disabled"
  //     — enabled=0, exercises the dashboard's enabled-only filter (sdn.tsx's
  //     full list still shows it as "disabled").
  sdn_rl:
    '<1>MAINFH>1>1>1>1>>>>>>>>>>' +
    '<2>Guest>1>2>2>1>>>>>>>>>>' +
    '<3>IoT>1>3>3>2>>>>>>>>>>' +
    '<4>MAINBH>1>1>1>2>>>>>>>>>>' +
    '<5>Kids>0>5>5>3>>>>>>>>>>',
  subnet_rl:
    '<1>br0>192.168.50.1>255.255.255.0>1>192.168.50.100>192.168.50.200>' +
    '<2>br1>192.168.20.1>255.255.255.0>1>192.168.20.100>192.168.20.200>' +
    '<3>br2>192.168.30.1>255.255.255.0>1>192.168.30.100>192.168.30.200>' +
    '<5>br4>192.168.40.1>255.255.255.0>1>192.168.40.100>192.168.40.200>',
  apm1_ssid: 'MerlinNet-Demo',
  apm1_dut_list: '<*>87>', // 87 = 1 (2.4G) | 2|4 (5G) | 16|64 (6G) — live-observed wildcard form
  apm2_ssid: 'MerlinNet-Demo-BH',
  apm2_dut_list: '<02:1A:2B:00:20:01>19>', // 19 = 1 (2.4G) | 2 (5G) | 16 (6G)
  apg1_ssid: 'MerlinNet-Guest',
  apg1_dut_list: '<02:1A:2B:00:20:01>3>', // 3 = 1 (2.4G) | 2 (5G)
  apg1_enable: '1',
  apg2_ssid: 'MerlinNet-IoT',
  apg2_dut_list: '<02:1A:2B:00:20:01>1>', // 1 = 2.4G only
  apg2_enable: '1',
  apg3_ssid: 'MerlinNet-Kids-Disabled',
  apg3_dut_list: '<02:1A:2B:00:20:01>1>',
  apg3_enable: '0',

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

  // --- QoS: Priority Bandwidth Allocation (pages/defs/qos.ts qosUserPrioPage,
  // id 'qos-userprio') — qos_orates/qos_irates joined strings (5 priority
  // bands + a 5-slot trailer each, see the page's own header comment for the
  // exact format) plus the ACK/SYN/FIN/RST/ICMP boost flags, which are plain
  // on/off scalars (not '1'/'0'). ---
  qos_orates: '80-100,10-100,5-100,3-100,2-95,0-0,0-0,0-0,0-0,0-0',
  qos_irates: '100,100,100,100,100,0,0,0,0,0',
  qos_ack: 'on',
  qos_syn: 'on',
  qos_fin: 'off',
  qos_rst: 'off',
  qos_icmp: 'on',

  // --- Notification Center (pages/defs/notification.tsx, id
  // 'notification-center') — nc_web_app_enable/nc_mail_enable read-only
  // channel-settings display. The event list itself (get_nt_db()) is a raw
  // appGet hook, not plain nvram — see FIXTURE_NT_EVENTS/buildNtDbPayload
  // below, wired through router-fetch.ts's RAW_HOOK_PAYLOADS map. ---
  nc_web_app_enable: '1',
  nc_mail_enable: '0',

  // --- AiMesh Node Management (pages/defs/aimesh.tsx, id 'aimesh') gating
  // flag only; the node/onboarding data itself comes from three appGet hooks
  // (get_cfg_clientlist/get_onboardinglist/get_onboardingstatus) — see
  // FIXTURE_AIMESH_* below. ---

  // --- Operation Mode (pages/defs/opmode.ts, id 'opmode') — sw_mode/wlc_*
  // set so deriveOpMode() falls through to the plain-Router case: swMode==1,
  // every psta/express/mlo flag off, wlc_band empty (a non-empty wlc_band
  // alongside sw_mode=1 would read as WISP instead — see opmode.ts header). ---
  sw_mode: '1',
  wlc_psta: '0',
  wlc_dpsta: '0',
  wlc_express: '0',
  wlc_band: '',
  mlo_rp: '0',
  mlo_mb: '0',

  // --- Router HTTPS Certificate (pages/defs/certificates.tsx, id
  // 'router-cert') — le_enable=1 selects the "Let's Encrypt" status badge;
  // httpd_cert_info() itself is a hook, not nvram — see
  // FIXTURE_HTTPD_CERT_INFO below. ---
  le_enable: '1',
  le_state: '2',

  // --- WireGuard Server (pages/defs/vpn-server.ts, id 'wireguard-server')
  // — real per-instance keys (wgs1_*), read directly since this router only
  // ever has one native-reachable instance (see the page's own header
  // comment on the wgs_/wgs1_ working-copy redirect). Key material is an
  // obviously-fake placeholder, never real PEM/base64. ---
  wgs1_enable: '1',
  wgs1_dns: '1',
  wgs1_nat6: '0',
  wgs1_psk: '1',
  wgs1_alive: '25',
  wgs1_addr: '10.6.0.1/24',
  wgs1_port: '51820',
  wgs1_priv: 'FAKE-DEMO-WGS-SERVER-PRIVATE-KEY-NOT-REAL',
  wgs1_pub: 'FAKE-DEMO-WGS-SERVER-PUBLIC-KEY-NOT-REAL==',

  // --- WireGuard Server Peers (pages/defs/vpn-server.ts, id
  // 'wireguard-server-peers') — three fictional peers on server unit 1: two
  // enabled, one disabled, to exercise the enable badge. Keys/PSKs are
  // obviously-fake placeholders. ---
  wgs1_c1_name: 'laptop-wg',
  wgs1_c1_enable: '1',
  wgs1_c1_addr: '10.6.0.2/32',
  wgs1_c1_aips: '10.6.0.2/32',
  wgs1_c1_caips: '0.0.0.0/0',
  wgs1_c1_psk: 'FAKE-DEMO-PEER1-PSK-NOT-REAL',
  wgs1_c1_pub: 'FAKE-DEMO-PEER1-PUBLIC-KEY-NOT-REAL==',
  wgs1_c1_priv: '',
  wgs1_c2_name: 'phone-wg',
  wgs1_c2_enable: '1',
  wgs1_c2_addr: '10.6.0.3/32',
  wgs1_c2_aips: '10.6.0.3/32',
  wgs1_c2_caips: '0.0.0.0/0',
  wgs1_c2_psk: 'FAKE-DEMO-PEER2-PSK-NOT-REAL',
  wgs1_c2_pub: 'FAKE-DEMO-PEER2-PUBLIC-KEY-NOT-REAL==',
  wgs1_c2_priv: '',
  wgs1_c3_name: 'nas-wg-backup',
  wgs1_c3_enable: '0',
  wgs1_c3_addr: '10.6.0.4/32',
  wgs1_c3_aips: '10.6.0.4/32',
  wgs1_c3_caips: '10.6.0.4/32',
  wgs1_c3_psk: '',
  wgs1_c3_pub: 'FAKE-DEMO-PEER3-PUBLIC-KEY-NOT-REAL==',
  wgs1_c3_priv: '',

  // --- VPN Certificates & Keys (pages/defs/certificates.tsx, id
  // 'vpn-certs') — WireGuard private-key PRESENCE fields, read unindexed
  // (wgs_priv/wgc{n}_priv, a separate working-copy family from wgs1_* above
  // — see the page's own header comment). Server + client 1 present, clients
  // 2-5 deliberately absent (left unset) to exercise both presence badges.
  // Obviously-fake placeholder, never real key material. ---
  wgs_priv: 'FAKE-DEMO-WORKING-COPY-PRIVATE-KEY-NOT-REAL',
  wgc1_priv: 'FAKE-DEMO-CLIENT1-PRIVATE-KEY-NOT-REAL',

  // --- Time Machine (pages/defs/usb.ts timemachinePage, id 'timemachine')
  // — tm_device_name is a raw partition device leaf name, not a mount path
  // (see the page's own header comment). ---
  timemachine_enable: '1',
  tm_device_name: 'sda1',
  tm_vol_size: '512000',
  tm_ui_setting: '1',

  // --- Download Master / USB Apps status (pages/defs/usb.ts
  // downloadMasterPage, id 'download-master') — read-only status fields,
  // every one a literal defaults.c entry per the page's own header comment.
  // ---
  apps_dev: 'sda1',
  apps_mounted_path: '/tmp/mnt/DEMO_USB',
  apps_state_install: '2',
  apps_state_upgrade: '0',
  apps_state_update: '0',
  apps_state_remove: '0',
  apps_state_enable: '2',
  apps_state_switch: '0',
  apps_state_autorun: '1',
  apps_state_error: '0',
  apps_download_file: 'downloadmaster_3.0.0.5_demo.ipk',
  apps_download_percent: '100',
  apps_depend_do: '0',
  apps_depend_action: '',
  apps_depend_action_target: '',

  // --- OpenVPN Server (pages/defs/vpn-server.ts openvpnServerPage, id
  // 'openvpn-server') — a full '{p}'-templated field set for BOTH
  // instances, made visibly different so a broken instance-selector switch
  // would be obvious rather than silently identical: server 1 is enabled
  // (TLS, TCP, port 1194, username/password auth on, client-specific config
  // with 2 rows); server 2 is disabled (Static Key/'secret' mode, UDP, port
  // 1195, no ccd rows). vpn_serverx_start's membership ("1,") is the derived
  // per-instance enable flag (see the page's own ovpnStartTokens() comment).
  // vpn_server{p}_ccd_val and vpn_serverx_clientlist are read via
  // nvramCharToAscii (nvramAscii in the page def) — plain ASCII text here
  // needs no percent-escaping to round-trip through that decode. Rule-list
  // format confirmed against lib/rulelist.ts (recordSep '<', fieldSep '>',
  // leading '<'): ccd_val records are `<1><CN>>>` (leading '1' + 4 columns,
  // see ccdValFromStored/ccdValToStored); clientlist records are the plain
  // 2-column `<user>pass` shape (no leading enable flag, no unit tag — it's
  // a single unindexed key SHARED across both server instances, per the
  // page's own intro/note).
  vpn_serverx_start: '1,',
  vpn_server1_if: 'tun',
  vpn_server1_proto: 'tcp-server',
  vpn_server1_port: '1194',
  vpn_server1_crypt: 'tls',
  vpn_server1_client_access: '2',
  vpn_server1_userpass_auth: '1',
  vpn_server1_igncrt: '0',
  vpn_server1_tls_keysize: '1',
  vpn_server1_hmac: '2',
  vpn_server1_digest: 'default',
  vpn_server1_cipher: 'AES-256-CBC',
  vpn_server1_sn: '10.8.0.0',
  vpn_server1_nm: '255.255.255.0',
  vpn_server1_dhcp: '1',
  vpn_server1_r1: '',
  vpn_server1_r2: '',
  vpn_server1_local: '',
  vpn_server1_remote: '',
  vpn_server1_pdns: '1',
  vpn_server1_ncp_ciphers: 'AES-256-GCM:AES-128-GCM',
  vpn_server1_comp: 'no',
  vpn_server1_verb: '3',
  vpn_server1_ccd: '1',
  vpn_server1_c2c: '0',
  vpn_server1_ccd_excl: '0',
  vpn_server1_ip6: '0',
  vpn_server1_nat6: '0',
  vpn_server1_sn6: '',
  vpn_server1_local6: '',
  vpn_server1_remote6: '',
  vpn_server1_ccd_val: '<1>demo-laptop>10.8.0.10>255.255.255.255>1<1>demo-phone>10.8.0.11>255.255.255.255>0',
  vpn_server2_if: 'tun',
  vpn_server2_proto: 'udp',
  vpn_server2_port: '1195',
  vpn_server2_crypt: 'secret',
  vpn_server2_client_access: '0',
  vpn_server2_userpass_auth: '0',
  vpn_server2_igncrt: '0',
  vpn_server2_tls_keysize: '1',
  vpn_server2_hmac: '-1',
  vpn_server2_digest: 'SHA256',
  vpn_server2_cipher: 'AES-256-CBC',
  vpn_server2_sn: '',
  vpn_server2_nm: '',
  vpn_server2_dhcp: '0',
  vpn_server2_r1: '',
  vpn_server2_r2: '',
  vpn_server2_local: '10.9.0.1',
  vpn_server2_remote: '10.9.0.2',
  vpn_server2_pdns: '0',
  vpn_server2_ncp_ciphers: '',
  vpn_server2_comp: '-1',
  vpn_server2_verb: '3',
  vpn_server2_ccd: '0',
  vpn_server2_c2c: '1',
  vpn_server2_ccd_excl: '0',
  vpn_server2_ip6: '0',
  vpn_server2_nat6: '0',
  vpn_server2_sn6: '',
  vpn_server2_local6: '',
  vpn_server2_remote6: '',
  vpn_server2_ccd_val: '',
  // Shared (unindexed, no unit tag) across both server instances — see the
  // page's own intro comment. Passwords are obviously-fake placeholders.
  vpn_serverx_clientlist: '<demo-vpnuser>FAKE-DEMO-NOT-A-PASSWORD<guest-vpnuser>FAKE-DEMO-NOT-A-PASSWORD-2',
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

/**
 * Notification Center (pages/defs/notification.tsx, id 'notification-center')
 * — get_nt_db() row shape per the page's own header comment:
 * {tstamp, event_id, group_type, msg, eName, status, event_type}. event_id
 * is the firmware's "%8X" space-left-padded uppercase hex field — reproduced
 * literally (untrimmed) here since the page itself is responsible for
 * trimming it. status uses the page's own narrow "== 1" read test (bit 0 /
 * web-GUI channel only).
 *
 * Three rows, deliberately covering all three rendering paths:
 *  - '10003': status 1 (read) — resolves its title from FIXTURE_NT_CONTENT.
 *  - '2001': status 0 (unread) — also resolves from FIXTURE_NT_CONTENT.
 *  - 'A1B2C': status 0 (unread), eName intentionally blank AND no
 *    FIXTURE_NT_CONTENT entry — exercises eventTitle()'s final fallback,
 *    "Event 0x<hex>" (the raw-hex path), and eventBody()'s matching
 *    "raw event id ... status flags ..." fallback.
 */
export interface FixtureNtEvent {
  tstamp: string;
  event_id: string;
  group_type: string;
  /** Optional — omitted (not merely '') for the raw-hex-fallback row so eventBody()'s typeof-string short-circuit doesn't swallow the raw-hex fallback text. */
  msg?: string;
  eName: string;
  status: string;
  event_type: string;
}

export const FIXTURE_NT_EVENTS: FixtureNtEvent[] = [
  {
    tstamp: '1785500000',
    event_id: '   10003',
    group_type: '1',
    msg: 'demo-user joined MerlinNet-Demo (5 GHz)',
    eName: 'New wireless client',
    status: '1',
    event_type: '1',
  },
  {
    tstamp: '1785580000',
    event_id: '    2001',
    group_type: '1',
    msg: 'A new firmware build is available for RT-DEMO88U',
    eName: 'Firmware update available',
    status: '0',
    event_type: '2',
  },
  {
    tstamp: '1785590000',
    event_id: '   A1B2C',
    group_type: '9',
    eName: '',
    status: '0',
    event_type: '9',
  },
];

/** appGet.cgi RAW_HOOK_PAYLOADS entry for 'get_nt_db()' — see router-fetch.ts. */
export function buildNtDbPayload(): string {
  return JSON.stringify(FIXTURE_NT_EVENTS);
}

/**
 * /nt_content.json — plain same-origin GET, not an appGet hook (see
 * router-fetch.ts). Keyed by the TRIMMED event_id hex string. 'A1B2C'
 * deliberately has no entry here — see FIXTURE_NT_EVENTS above.
 */
export const FIXTURE_NT_CONTENT: Record<string, { item: string; contents: string; icon?: string; group?: string }> = {
  '10003': { item: 'New wireless client', contents: 'demo-user joined MerlinNet-Demo (5 GHz)', group: '1' },
  '2001': { item: 'Firmware update available', contents: 'fixture_demo build 9999 is ready to install', group: '1' },
};

/**
 * AiMesh Node Management (pages/defs/aimesh.tsx, id 'aimesh') —
 * get_cfg_clientlist() row shape per the page's own header comment. Index 0
 * is always the local/CAP router (rendered as the master row regardless of
 * its own 'online' value); indices 1+ are RE nodes. Three nodes modeled:
 * the CAP itself, an online 2.4 GHz-backhauled node, and an offline node
 * (re_path 0 / 'Unknown' backhaul, online '0'). All MACs use the 02:
 * locally-administered prefix.
 */
export const FIXTURE_AIMESH_NODES: Record<string, unknown>[] = [
  {
    mac: '02:1A:2B:00:30:01',
    alias: 'Living Room Router',
    ui_model_name: 'RT-DEMO88U',
    model_name: 'RT-DEMO88U',
    fwver: '3.0.0.6',
    newfwver: '',
    ip: '192.168.50.1',
    online: '1',
    level: '0',
    re_path: '0',
    config: { cfg_alias: 'Living Room Router', ctrl_led: '1' },
  },
  {
    mac: '02:1A:2B:00:30:02',
    alias: 'Bedroom Node',
    ui_model_name: 'RT-DEMO68U',
    model_name: 'RT-DEMO68U',
    fwver: '3.0.0.6',
    newfwver: '3.0.0.6',
    ip: '192.168.50.201',
    online: '1',
    level: '1',
    re_path: '2', // bit 1 -> 2.4 GHz backhaul (decodeBackhaul)
    rssi2g: '-52',
    config: { cfg_alias: 'Bedroom Node', ctrl_led: '1' },
  },
  {
    mac: '02:1A:2B:00:30:03',
    alias: 'Garage Node',
    ui_model_name: 'RT-DEMO68U',
    model_name: 'RT-DEMO68U',
    fwver: '3.0.0.5',
    newfwver: '',
    ip: '192.168.50.202',
    online: '0',
    level: '2',
    re_path: '0', // 'Unknown' backhaul while offline
    config: { cfg_alias: 'Garage Node', ctrl_led: '0' },
  },
];

/** get_onboardinglist() — one fictional unconfigured candidate seen via the CAP. */
export const FIXTURE_AIMESH_ONBOARDING: Record<string, Record<string, unknown>> = {
  '02:1A:2B:00:30:01': {
    '02:1A:2B:00:30:99': { rssi: '-61', model_name: 'RT-DEMO68U', source: '1' },
  },
};

/** get_onboardingstatus() — plain nvram_safe_get fields, read-only display. */
export const FIXTURE_AIMESH_STATUS: Record<string, string> = {
  cfg_recount: '2',
  cfg_re_maxnum: '6',
  cfg_ready: '1',
  cfg_obstatus: '1',
};

/**
 * httpd_cert_info() ej hook (pages/defs/certificates.tsx RouterCertPage) —
 * parsed metadata only, matching the real firmware's field set exactly
 * (never raw PEM — see the page's own privacy-rules header comment). Empty
 * CA fields (no uploaded chain) since le_enable=1 (Let's Encrypt) in this
 * fixture, matching FIXTURE_NVRAM.le_enable.
 */
export const FIXTURE_HTTPD_CERT_INFO = {
  issueTo: 'router.merlinnet-demo.example',
  issueBy: "Let's Encrypt Demo CA",
  from: 'Jun  1 00:00:00 2026 GMT',
  expire: 'Aug 30 00:00:00 2026 GMT',
  CAissueTo: '',
  CAissueBy: '',
  CAfrom: '',
  CAexpire: '',
};

/**
 * USB Share Accounts & Permissions (pages/defs/usb-accounts.tsx, id
 * 'usb-accounts') — three hooks, none of them plain nvram:
 *
 *  - get_all_accounts() returns a JSON array of account name strings,
 *    ASCII-encoded per the firmware's char_to_ascii convention (see the
 *    page's own header comment). 'guest+user' below exercises
 *    decodeAsciiEncodedName's '+' -> literal-space decode path (renders as
 *    "guest user"); the other two names are already plain and round-trip
 *    unchanged. 'nas-backup' deliberately has NO entry in
 *    FIXTURE_USB_PERMISSIONS_SOURCE below, so it exercises the page's
 *    "account with no resolvable shares" dash-row fallback within the SAME
 *    (populated) variant as the other two accounts.
 *  - get_usb_info() is read only for pool/mount-point discovery
 *    (extractPools()) — modeled as a single mounted USB pool at
 *    FIXTURE_USB_POOL_MOUNT.
 *  - get_permissions_of_account() is UNIQUE among this project's hooks: per
 *    the page's own header comment (citing RAW/merlin web.c:29290's
 *    draw_permissions_of_pms()), the real firmware emits raw JS source — a
 *    `function get_account_permissions_in_pool(account, pool) {...}`
 *    definition plus a data assignment — not a JSON value, and the page
 *    fetches it as raw text (fetchRouterText) rather than through appGet()'s
 *    JSON-batching helper. buildAccountPermissionsJsSource() below
 *    reproduces that literally; router-fetch.ts serves it UNWRAPPED (no
 *    `{"hook":...}` JSON envelope) to mirror the real wire format faithfully
 *    rather than "helpfully" serving clean JSON the real router wouldn't.
 *
 * PRIVACY CHECK FIXTURE: 'demo-user's node below carries a sibling "pwd"
 * field ('FAKE-DEMO-NOT-A-PASSWORD') alongside its pool/folder tree, modeling
 * plausible extra account metadata riding along in the same hook response.
 * usb-accounts.tsx's collectShareLeaves() only treats an object as a
 * permission "leaf" when EVERY key in it is a known protocol name — a mixed
 * object containing "pwd" is never a leaf, and a bare string value like
 * "pwd"'s is never recursed into (collectShareLeaves bails on non-objects) —
 * so this value should never reach collectShareLeaves output or the
 * rendered table. Verifying that is the point of including it.
 */
export const FIXTURE_USB_ACCOUNTS_RAW: string[] = ['demo-user', 'guest+user', 'nas-backup'];

export const FIXTURE_USB_POOL_MOUNT = '/tmp/mnt/USB_DEMO';

/** get_usb_info() payload — single mounted pool/partition, generic enough shape for extractPools()'s recursive mountPoint scan. */
export function buildUsbInfoPayload(): Record<string, unknown> {
  return {
    usb_path1: [
      {
        port: '1',
        deviceType: 'storage',
        node: 'usb1',
        partition: [{ mountPoint: FIXTURE_USB_POOL_MOUNT, partName: 'USB_DEMO', size: '512G', used: '128G' }],
      },
    ],
  };
}

/** get_permissions_of_account() raw JS source — see the header comment above. */
export function buildAccountPermissionsJsSource(): string {
  return [
    'function get_account_permissions_in_pool(account, pool) {',
    '  return account_permissions[account] ? account_permissions[account][pool] : undefined;',
    '}',
    'account_permissions = {',
    '  "demo-user": {',
    '    "pwd": "FAKE-DEMO-NOT-A-PASSWORD",',
    '    "USB_DEMO": {',
    '      "Public": {"cifs":3,"ftp":1,"dms":0,"webdav":1},',
    '      "Media": {"cifs":1,"ftp":0,"dms":3,"webdav":0}',
    '    }',
    '  },',
    '  "guest+user": {',
    '    "USB_DEMO": {',
    '      "Public": {"cifs":1,"ftp":0,"dms":0,"webdav":1}',
    '    }',
    '  }',
    '};',
    '',
  ].join('\n');
}

/**
 * `?badaccounts=1` fixture variant (mocks/router-fetch.ts): an unrecognized,
 * non-JS-assignment response for get_permissions_of_account(), modeling a
 * firmware build whose emitted shape this project's defensive parser
 * (extractJsAssignments) cannot recognize at all — no top-level
 * `ident = {...}` assignment appears anywhere in this text, so
 * extractJsAssignments() returns []  for every candidate hook call, and
 * fetchAccountPermissions() (usb-accounts.tsx) degrades to null, surfacing
 * the page's "Per-share permission data could not be read..." warn banner.
 */
export const FIXTURE_USB_BAD_PERMISSIONS_TEXT =
  '// unexpected response for this hook on this firmware build\nERR_HOOK_NOT_FOUND\n';

/**
 * /ajax_openvpn_server.asp (pages/defs/certificates.tsx VpnCertsPage,
 * fetchOpenvpnCrtPresence) — the real endpoint emits one
 * `var vpn_crt_<kind><unit>_<field> = ['...'];` JS literal per slot x field;
 * presenceOfVar() only checks whether the first character after the opening
 * quote is itself the closing quote (empty sentinel) or real content. Only
 * server 1 and client 1 get a few populated fields here — every other
 * slot x field combination is simply absent from the text, which
 * presenceOfVar() also correctly reads as "absent" (regex no-match), so
 * there is no need to emit all 42 combinations. Content is an obviously-fake
 * placeholder, never real PEM.
 */
export function buildAjaxOpenvpnServerText(): string {
  const FAKE_PEM = '-----BEGIN FAKE DEMO CERTIFICATE-----\\nFAKE-DEMO-NOT-REAL\\n-----END FAKE DEMO CERTIFICATE-----';
  const FAKE_KEY = '-----BEGIN FAKE DEMO KEY-----\\nFAKE-DEMO-NOT-REAL\\n-----END FAKE DEMO KEY-----';
  const FAKE_DH = '-----BEGIN FAKE DEMO DH PARAMETERS-----\\nFAKE-DEMO-NOT-REAL\\n-----END FAKE DEMO DH PARAMETERS-----';
  return [
    `var vpn_crt_server1_ca = ['${FAKE_PEM}'];`,
    `var vpn_crt_server1_crt = ['${FAKE_PEM}'];`,
    `var vpn_crt_server1_key = ['${FAKE_KEY}'];`,
    `var vpn_crt_server1_dh = ['${FAKE_DH}'];`,
    `var vpn_crt_server1_crl = [''];`,
    `var vpn_crt_server1_extra = [''];`,
    `var vpn_crt_client1_ca = ['${FAKE_PEM}'];`,
    `var vpn_crt_client1_crt = ['${FAKE_PEM}'];`,
    `var vpn_crt_client1_key = ['${FAKE_KEY}'];`,
  ].join('\n');
}
