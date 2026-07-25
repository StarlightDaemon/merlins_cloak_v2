/**
 * WAN category: Internet Connection (per-unit instance page), Dual WAN, Port
 * Trigger, Port Forwarding, DMZ, DDNS, NAT Passthrough. Field sets, option
 * values, list encodings, and action_script values extracted from the
 * corresponding pages in the Merlin 3006.102.7_2 www/ source (RAW/merlin).
 * No RT-BE92U sysdep overlay exists for any of these seven pages (checked
 * RAW/merlin/release/src/router/www/sysdep/RT-BE92U/www/ — only
 * Advanced_WAdvanced_Content.asp, Main_Analysis_Content.asp and
 * Main_Netstat_Content.asp are overlaid there); all seven are read straight
 * from the www/ root, matching the firewall.ts precedent of verifying
 * structural facts against source rather than assuming legacy layouts.
 *
 * Internet Connection is this project's first instance ('{p}') page. Per
 * httpd's validate_instance() (web.c ~3922-3930): a posted field whose
 * un-prefixed router_defaults name starts with "wan" but has no direct
 * match is matched against every "wan<unit>_"-prefixed variant in
 * wan_ifnames — i.e. posting wan0_proto / wan1_proto directly (what this
 * page's instance expansion produces) is exactly what the native page's own
 * apply path resolves to, confirming the wan{p}_* key family is real and
 * addressable via applyapp.cgi.
 *
 * KNOWN LIMITATION (documented, not fixed — this page's writes are
 * unverified-write/'wan'-excluded and have never been submitted): the
 * restart_wan_if action_script is NOT itself unit-suffixed. httpd splices
 * the target unit in at dispatch time from a posted `wan_unit` field
 * (web.c ~5892, ~6068-6082: `notify_cmd = "restart_wan_if" + " " +
 * wan_unit`, defaulting wan_unit to "0" when absent). Our delta write never
 * posts a bare `wan_unit` field, so a live Apply on the Secondary WAN
 * instance would restart WAN unit 0 rather than unit 1. rcService is left
 * as the literal 'restart_wan_if' (not templated with {p}, since the
 * action_script's NAME does not vary by unit) rather than inventing a
 * malformed "restart_wan_if {p}" command that httpd's own splicing would
 * then double up.
 *
 * Dual WAN's wans_dualwan is presented as a small closed set of practical
 * two-token combinations rather than free text or a fully dynamic port
 * picker — the native page assembles legal values from a live wans_cap
 * capability probe plus per-model LAN-port tables (Advanced_WANPort_Content
 * .asp lines ~232-397) that are impractical to replicate declaratively.
 *
 * All firewall-restart pages here (Port Trigger, Port Forwarding, DMZ, NAT
 * Passthrough) fall under the operator's 'firewall' hard exclusion; Internet
 * Connection and Dual WAN fall under 'wan' per the operator's explicit
 * per-page instruction. DDNS is deliberately writeExclusion: null — restart_ddns
 * is not on the excluded-restart list — but confidence.write stays
 * 'unverified-write' since no write in this category has been live-submitted.
 */
import type { SettingsPageDef } from '../types';
import { hasFlag } from '../../lib/capabilities';

const IP_PATTERN = '^(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})$';
const IP_HINT = 'IPv4 address, e.g. 192.168.1.1';
const MAC_PATTERN = '^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$';
/** Ports 1-65535; ':' ranges and comma-separated multi-entries (check_multi_range). */
const MULTI_PORT_PATTERN = '^\\d{1,5}([:,]\\d{1,5})*$';
const MULTI_PORT_HINT = 'Ports 1-65535; range with ":", comma-separated';
const yesNo = [
  { value: '1', label: 'Yes' },
  { value: '0', label: 'No' },
];
const enableDisable = [
  { value: '1', label: 'Enable' },
  { value: '0', label: 'Disable' },
];

// -----------------------------------------------------------------------
// 1. Internet Connection (instance page: WAN unit)
// -----------------------------------------------------------------------

export const wanPage: SettingsPageDef = {
  kind: 'settings',
  id: 'wan',
  aspPage: 'Advanced_WAN_Content.asp',
  title: 'Internet Connection',
  navGroup: 'wan',
  navLabel: 'Internet Connection',
  confidence: { read: 'live-verified', write: 'unverified-write' },
  writeExclusion: 'wan',
  instance: {
    label: 'WAN unit',
    options: [
      { value: '0', label: 'Primary WAN' },
      { value: '1', label: 'Secondary WAN', gate: (c) => hasFlag(c, 'dualwan_support') },
    ],
  },
  read: {
    nvram: [
      'wan{p}_proto',
      'wan{p}_enable',
      'wan{p}_dhcpenable_x',
      'wan{p}_ipaddr_x',
      'wan{p}_netmask_x',
      'wan{p}_gateway_x',
      'wan{p}_dnsenable_x',
      'wan{p}_dns1_x',
      'wan{p}_dns2_x',
      'wan{p}_pppoe_mtu',
      'wan{p}_nat_x',
      'wan{p}_upnp_enable',
      'wan{p}_hostname',
      'wan{p}_hwaddr_x',
      'wan{p}_mtu',
      'wan{p}_dhcp_qry',
    ],
    // wan_pppoe_username / wan_pppoe_passwd are read on the native page via
    // nvram_char_to_ascii (free-text, may contain '>' '<' etc.) — see
    // Advanced_WAN_Content.asp lines 180-181.
    nvramAscii: ['wan{p}_pppoe_username', 'wan{p}_pppoe_passwd'],
  },
  sections: [
    {
      title: 'Connection type',
      fields: [
        {
          key: 'wan{p}_proto',
          label: 'WAN connection type',
          hint: 'IPv6 transition protocols (MAP-E, DS-Lite, V6 Plus, OCN Virtual Connect, LW4o6) require Softwire46_support and are not modeled here.',
          control: 'select',
          options: [
            { value: 'dhcp', label: 'Automatic IP (DHCP)' },
            { value: 'static', label: 'Static IP' },
            { value: 'pppoe', label: 'PPPoE' },
            { value: 'pptp', label: 'PPTP' },
            { value: 'l2tp', label: 'L2TP' },
          ],
        },
        { key: 'wan{p}_enable', label: 'Enable this WAN unit', control: 'radio', options: yesNo },
      ],
    },
    {
      title: 'WAN IP setting',
      showIf: (v) => v['wan{p}_proto'] === 'dhcp' || v['wan{p}_proto'] === 'static',
      fields: [
        { key: 'wan{p}_dhcpenable_x', label: 'Obtain the WAN IP automatically', control: 'radio', options: yesNo },
        {
          key: 'wan{p}_ipaddr_x',
          label: 'WAN IP address',
          control: 'text',
          validate: { pattern: IP_PATTERN, patternHint: IP_HINT },
          showIf: (v) => v['wan{p}_dhcpenable_x'] === '0',
        },
        {
          key: 'wan{p}_netmask_x',
          label: 'WAN subnet mask',
          control: 'text',
          validate: { pattern: IP_PATTERN, patternHint: IP_HINT },
          showIf: (v) => v['wan{p}_dhcpenable_x'] === '0',
        },
        {
          key: 'wan{p}_gateway_x',
          label: 'WAN gateway',
          control: 'text',
          validate: { pattern: IP_PATTERN, patternHint: IP_HINT },
          showIf: (v) => v['wan{p}_dhcpenable_x'] === '0',
        },
        {
          key: 'wan{p}_mtu',
          label: 'MTU',
          hint: 'Default 1500',
          control: 'number',
          validate: { min: 576, max: 9000 },
        },
        {
          key: 'wan{p}_dhcp_qry',
          label: 'DHCP query frequency',
          control: 'select',
          options: [
            { value: '0', label: 'Normal' },
            { value: '1', label: 'Aggressive' },
            { value: '2', label: 'Continuous' },
          ],
          showIf: (v) => v['wan{p}_proto'] === 'dhcp',
        },
      ],
    },
    {
      title: 'DNS setting',
      fields: [
        { key: 'wan{p}_dnsenable_x', label: 'Connect to DNS server automatically', control: 'radio', options: yesNo },
        {
          key: 'wan{p}_dns1_x',
          label: 'DNS server 1',
          control: 'text',
          validate: { pattern: IP_PATTERN, patternHint: IP_HINT },
          showIf: (v) => v['wan{p}_dnsenable_x'] === '0',
        },
        {
          key: 'wan{p}_dns2_x',
          label: 'DNS server 2',
          control: 'text',
          validate: { pattern: IP_PATTERN, patternHint: IP_HINT },
          showIf: (v) => v['wan{p}_dnsenable_x'] === '0',
        },
      ],
    },
    {
      title: 'PPPoE / PPTP / L2TP account',
      showIf: (v) => ['pppoe', 'pptp', 'l2tp'].includes(v['wan{p}_proto']),
      fields: [
        { key: 'wan{p}_pppoe_username', label: 'User name', control: 'text', ascii: true, validate: { required: true, maxLength: 64 } },
        { key: 'wan{p}_pppoe_passwd', label: 'Password', control: 'password', ascii: true, validate: { required: true, maxLength: 64 } },
        {
          key: 'wan{p}_pppoe_mtu',
          label: 'PPPoE MTU',
          control: 'number',
          validate: { min: 128, max: 1492 },
          showIf: (v) => v['wan{p}_proto'] === 'pppoe',
        },
      ],
    },
    {
      title: 'NAT / UPnP',
      fields: [
        { key: 'wan{p}_nat_x', label: 'Enable NAT', control: 'radio', options: yesNo },
        { key: 'wan{p}_upnp_enable', label: 'Enable UPnP / IGD media server', control: 'radio', options: yesNo },
      ],
    },
    {
      title: "ISP account information",
      note: 'Some ISPs bind service to a specific host name and/or MAC address.',
      fields: [
        { key: 'wan{p}_hostname', label: "Router's host name (for ISP)", control: 'text', validate: { maxLength: 32 } },
        {
          key: 'wan{p}_hwaddr_x',
          label: 'MAC address (MAC clone)',
          hint: 'Leave blank to use the WAN interface\'s own MAC address',
          control: 'text',
          validate: { pattern: MAC_PATTERN, patternHint: 'MAC as AA:BB:CC:DD:EE:FF' },
        },
      ],
    },
  ],
  write: {
    endpoint: 'applyapp',
    rcService: 'restart_wan_if',
    actionWait: 5,
  },
};

// -----------------------------------------------------------------------
// 2. Dual WAN
// -----------------------------------------------------------------------

export const dualWanPage: SettingsPageDef = {
  kind: 'settings',
  id: 'dual-wan',
  aspPage: 'Advanced_WANPort_Content.asp',
  title: 'Dual WAN',
  navGroup: 'wan',
  navLabel: 'Dual WAN',
  gate: (c) => hasFlag(c, 'dualwan_support'),
  confidence: { read: 'structural', write: 'unverified-write' },
  writeExclusion: 'wan',
  intro:
    'The native page builds wans_dualwan from a live per-model port capability probe and a WAN/LAN port picker; this view exposes the practical combinations for this platform directly instead. wans_isp_unit / wan0-1_routing_isp / wans_routing_rulelist (per-ISP policy routing rules) and wans_standby (USB-modem hot standby) are advanced/niche sub-features not modeled here.',
  read: {
    nvram: [
      'wans_dualwan',
      'wans_mode',
      'wans_lb_ratio',
      'wans_usb_bk',
      'wandog_enable',
      'wandog_target',
      'wandog_interval',
      'wandog_maxfail',
      'wandog_fb_count',
      'dns_probe',
      'dns_probe_host',
    ],
  },
  sections: [
    {
      title: 'Dual WAN',
      fields: [
        {
          key: 'wans_dualwan',
          label: 'WAN / secondary interface',
          hint: 'Primary and secondary WAN interfaces, space-separated. "none" as the second token disables Dual WAN.',
          control: 'select',
          options: [
            { value: 'wan none', label: 'Dual WAN disabled (WAN only)' },
            { value: 'wan usb', label: 'WAN + USB modem (tethering) failover' },
            { value: 'wan lan', label: 'WAN + LAN port failover / load balance' },
          ],
        },
        {
          key: 'wans_mode',
          label: 'Dual WAN mode',
          control: 'select',
          options: [
            { value: 'fo', label: 'Failover' },
            { value: 'fb', label: 'Failover with failback' },
            { value: 'lb', label: 'Load balance' },
          ],
          showIf: (v) => v.wans_dualwan !== 'wan none',
        },
        {
          key: 'wans_lb_ratio',
          label: 'Load-balance ratio (primary:secondary)',
          control: 'text',
          validate: { pattern: '^[1-9]:[1-9]$', patternHint: 'Ratio N:N, each 1-9' },
          showIf: (v) => v.wans_dualwan !== 'wan none' && v.wans_mode === 'lb',
        },
        {
          key: 'wans_usb_bk',
          label: 'Use USB modem as backup only (do not use for load balance)',
          control: 'radio',
          options: yesNo,
          showIf: (v) => v.wans_dualwan.includes('usb'),
        },
      ],
    },
    {
      title: 'Connection monitoring (failover watchdog)',
      fields: [
        { key: 'dns_probe', label: 'Enable DNS-query monitoring', control: 'radio', options: yesNo },
        {
          key: 'dns_probe_host',
          label: 'DNS probe target host',
          control: 'text',
          validate: { maxLength: 255 },
          showIf: (v) => v.dns_probe === '1',
        },
        { key: 'wandog_enable', label: 'Enable ping monitoring', control: 'radio', options: yesNo },
        {
          key: 'wandog_target',
          label: 'Ping target host',
          control: 'text',
          validate: { maxLength: 100 },
          showIf: (v) => v.wandog_enable === '1',
        },
        {
          key: 'wandog_interval',
          label: 'Retry interval (seconds)',
          control: 'number',
          validate: { min: 2, max: 99 },
        },
        {
          key: 'wandog_maxfail',
          label: 'Failover trigger count',
          control: 'number',
          validate: { min: 1, max: 99 },
        },
        {
          key: 'wandog_fb_count',
          label: 'Failback trigger count',
          control: 'number',
          validate: { min: 1, max: 99 },
          showIf: (v) => v.wans_mode === 'fb',
        },
      ],
    },
  ],
  write: {
    endpoint: 'applyapp',
    rcService: 'reboot',
    actionWait: 70,
  },
};

// -----------------------------------------------------------------------
// 3. Port Trigger
// -----------------------------------------------------------------------

/**
 * autofw_rulelist column order, from the page's own join code (applyRule()):
 * desc > out(trigger)Port > out(trigger)Proto > in(incoming)Port > in(incoming)Proto.
 */
export const portTriggerPage: SettingsPageDef = {
  kind: 'settings',
  id: 'port-trigger',
  aspPage: 'Advanced_PortTrigger_Content.asp',
  title: 'Port Trigger',
  navGroup: 'wan',
  navLabel: 'Port Trigger',
  confidence: { read: 'structural', write: 'unverified-write' },
  writeExclusion: 'firewall',
  read: {
    nvram: ['autofw_enable_x'],
    nvramAscii: ['autofw_rulelist'],
  },
  sections: [
    {
      title: 'Basic config',
      fields: [{ key: 'autofw_enable_x', label: 'Enable port trigger', control: 'radio', options: yesNo }],
    },
    {
      title: 'Trigger list',
      note: 'An outbound connection on the trigger port opens the matching incoming port(s) for that client.',
      fields: [
        {
          key: 'autofw_rulelist',
          label: 'Port trigger rules',
          control: 'list',
          ascii: true,
          list: {
            maxRows: 32,
            columns: [
              { id: 'desc', label: 'Description', validate: { maxLength: 18 } },
              {
                id: 'triggerPort',
                label: 'Trigger port',
                mono: true,
                validate: { required: true, pattern: MULTI_PORT_PATTERN, patternHint: MULTI_PORT_HINT },
              },
              {
                id: 'triggerProto',
                label: 'Protocol',
                width: 90,
                control: 'select',
                options: [
                  { value: 'TCP', label: 'TCP' },
                  { value: 'UDP', label: 'UDP' },
                ],
              },
              {
                id: 'incomingPort',
                label: 'Incoming port',
                mono: true,
                validate: { required: true, pattern: MULTI_PORT_PATTERN, patternHint: MULTI_PORT_HINT },
              },
              {
                id: 'incomingProto',
                label: 'Protocol',
                width: 90,
                control: 'select',
                options: [
                  { value: 'TCP', label: 'TCP' },
                  { value: 'UDP', label: 'UDP' },
                ],
              },
            ],
          },
        },
      ],
    },
  ],
  write: {
    endpoint: 'applyapp',
    rcService: 'restart_firewall',
    actionWait: 5,
  },
};

// -----------------------------------------------------------------------
// 4. Port Forwarding
// -----------------------------------------------------------------------

/**
 * vts_rulelist / vts1_rulelist column order, from parseArrayToNvram():
 * serviceName > externalPort > internalIP > internalPort > protocol > sourceIP.
 * The trailing sourceIP column (optional IP or IP/netmask restriction) is the
 * 3006 addition the brief flagged; "dual-format" turned out to mean TWO
 * parallel rulelists — vts_rulelist for the primary WAN, vts1_rulelist for
 * the secondary — not a per-record dual encoding.
 */
const vtsColumns = [
  { id: 'serviceName', label: 'Service name', validate: { maxLength: 30 } },
  {
    id: 'externalPort',
    label: 'External port',
    mono: true,
    validate: { required: true, pattern: MULTI_PORT_PATTERN, patternHint: MULTI_PORT_HINT },
  },
  {
    id: 'internalIP',
    label: 'Internal IP',
    mono: true,
    validate: { required: true, pattern: IP_PATTERN, patternHint: IP_HINT },
  },
  {
    id: 'internalPort',
    label: 'Internal port',
    mono: true,
    width: 100,
    validate: { required: true, min: 1, max: 65535 },
  },
  {
    id: 'protocol',
    label: 'Protocol',
    width: 90,
    control: 'select' as const,
    options: [
      { value: 'TCP', label: 'TCP' },
      { value: 'UDP', label: 'UDP' },
      { value: 'BOTH', label: 'BOTH' },
      { value: 'OTHER', label: 'OTHER' },
    ],
  },
  {
    id: 'sourceIP',
    label: 'Source IP (optional)',
    mono: true,
    placeholder: 'IP or IP/netmask',
    validate: { maxLength: 18 },
  },
];

export const portForwardingPage: SettingsPageDef = {
  kind: 'settings',
  id: 'port-forwarding',
  aspPage: 'Advanced_VirtualServer_Content.asp',
  title: 'Port Forwarding',
  navGroup: 'wan',
  navLabel: 'Port Forwarding',
  confidence: { read: 'structural', write: 'unverified-write' },
  writeExclusion: 'firewall',
  read: {
    nvram: ['vts_enable_x'],
    nvramAscii: ['vts_rulelist', 'vts1_rulelist'],
  },
  sections: [
    {
      title: 'Basic config',
      fields: [{ key: 'vts_enable_x', label: 'Enable port forwarding', control: 'radio', options: yesNo }],
    },
    {
      title: 'Port forwarding rules — Primary WAN',
      fields: [
        {
          key: 'vts_rulelist',
          label: 'Port forwarding rules',
          control: 'list',
          ascii: true,
          list: { maxRows: 64, columns: vtsColumns },
        },
      ],
    },
    {
      title: 'Port forwarding rules — Secondary WAN',
      showIf: (_v, caps) => hasFlag(caps, 'dualwan_support'),
      fields: [
        {
          key: 'vts1_rulelist',
          label: 'Port forwarding rules',
          control: 'list',
          ascii: true,
          list: { maxRows: 64, columns: vtsColumns },
        },
      ],
    },
  ],
  write: {
    endpoint: 'applyapp',
    rcService: 'restart_firewall',
    actionWait: 5,
  },
};

// -----------------------------------------------------------------------
// 5. DMZ
// -----------------------------------------------------------------------

export const dmzPage: SettingsPageDef = {
  kind: 'settings',
  id: 'dmz',
  aspPage: 'Advanced_Exposed_Content.asp',
  title: 'DMZ',
  navGroup: 'wan',
  navLabel: 'DMZ',
  confidence: { read: 'structural', write: 'unverified-write' },
  writeExclusion: 'firewall',
  intro:
    'There is no separate dmz_enable nvram key — the native page derives enabled/disabled purely from whether dmz_ip is blank, and clears it on submit when the operator picks "No". This view keeps that behavior: leave the address blank to disable the DMZ host.',
  read: {
    nvram: ['dmz_ip', 'dmz1_ip', 'sp_battle_ips', 'wans_mode'],
  },
  sections: [
    {
      title: 'DMZ',
      fields: [
        {
          key: 'dmz_ip',
          label: 'Exposed station IP address (primary WAN)',
          hint: 'Leave blank to disable the DMZ host',
          control: 'text',
          validate: { pattern: IP_PATTERN, patternHint: IP_HINT },
        },
        {
          key: 'dmz1_ip',
          label: 'Exposed station IP address (secondary WAN)',
          hint: 'Leave blank to disable the DMZ host',
          control: 'text',
          validate: { pattern: IP_PATTERN, patternHint: IP_HINT },
          showIf: (v, caps) => hasFlag(caps, 'dualwan_support') && v.wans_mode === 'lb',
        },
        {
          key: 'sp_battle_ips',
          label: 'Battle.net auto-opened IPs',
          hint: 'Managed automatically by the router for Blizzard/Battle.net NAT traversal; no editable field for it exists on the native page.',
          control: 'readonly',
        },
      ],
    },
  ],
  write: {
    endpoint: 'applyapp',
    rcService: 'restart_firewall',
    actionWait: 5,
  },
};

// -----------------------------------------------------------------------
// 6. DDNS
// -----------------------------------------------------------------------

export const ddnsPage: SettingsPageDef = {
  kind: 'settings',
  id: 'ddns',
  aspPage: 'Advanced_ASUSDDNS_Content.asp',
  title: 'DDNS',
  navGroup: 'wan',
  navLabel: 'DDNS',
  confidence: { read: 'structural', write: 'unverified-write' },
  writeExclusion: null,
  intro:
    'Let\'s Encrypt certificate issuance (restart_ddns_le;prepare_cert), webdav/ftpd cert-reload branches, and the always-hidden ddns_regular_period / ddns_refresh_x rows (style="display:none" in the native page, never toggled visible) are not modeled here — this view covers the DDNS registration fields only.',
  read: {
    nvram: [
      'ddns_enable_x',
      'ddns_wan_unit',
      'ddns_server_x',
      'ddns_hostname_x',
      'ddns_username_x',
      'ddns_passwd_x',
      'ddns_wildcard_x',
      'ddns_regular_check',
      'wans_mode',
    ],
  },
  sections: [
    {
      title: 'DDNS',
      fields: [
        { key: 'ddns_enable_x', label: 'Enable the DDNS client', control: 'radio', options: yesNo },
        {
          key: 'ddns_wan_unit',
          label: 'WAN interface to register',
          control: 'select',
          options: [
            { value: '-1', label: 'Auto' },
            { value: '0', label: 'Primary WAN' },
            { value: '1', label: 'Secondary WAN' },
          ],
          showIf: (v, caps) => hasFlag(caps, 'dualwan_support') && v.wans_mode === 'lb',
        },
        {
          key: 'ddns_server_x',
          label: 'Server',
          control: 'select',
          options: [
            { value: 'WWW.ASUS.COM', label: 'WWW.ASUS.COM' },
            { value: 'DOMAINS.GOOGLE.COM', label: 'DOMAINS.GOOGLE.COM' },
            { value: 'WWW.DYNDNS.ORG', label: 'WWW.DYNDNS.ORG' },
            { value: 'WWW.DYNDNS.ORG(CUSTOM)', label: 'WWW.DYNDNS.ORG (Custom)' },
            { value: 'WWW.DYNDNS.ORG(STATIC)', label: 'WWW.DYNDNS.ORG (Static)' },
            { value: 'WWW.SELFHOST.DE', label: 'WWW.SELFHOST.DE' },
            { value: 'WWW.ZONEEDIT.COM', label: 'WWW.ZONEEDIT.COM' },
            { value: 'WWW.DNSOMATIC.COM', label: 'WWW.DNSOMATIC.COM' },
            { value: 'DNS.HE.NET', label: 'HE.NET' },
            { value: 'DYNU.COM', label: 'DYNU.COM' },
            { value: 'WWW.TUNNELBROKER.NET', label: 'WWW.TUNNELBROKER.NET' },
            { value: 'WWW.NO-IP.COM', label: 'WWW.NO-IP.COM' },
            { value: 'WWW.ORAY.COM', label: 'WWW.ORAY.COM' },
            { value: 'WWW.NAMECHEAP.COM', label: 'WWW.NAMECHEAP.COM' },
            { value: 'FREEDNS.AFRAID.ORG', label: 'FREEDNS.AFRAID.ORG' },
            { value: 'FREEMYIP.COM', label: 'FREEMYIP.COM (Merlin)' },
            { value: 'CUSTOM', label: 'Custom' },
          ],
        },
        {
          key: 'ddns_hostname_x',
          label: 'Host name',
          control: 'text',
          validate: { maxLength: 63 },
          showIf: (v) => v.ddns_server_x !== '' && v.ddns_server_x !== 'WWW.ASUS.COM',
        },
        {
          key: 'ddns_username_x',
          label: 'User name / e-mail',
          control: 'text',
          validate: { maxLength: 32 },
          showIf: (v) => !['', 'WWW.ASUS.COM', 'DNS.HE.NET'].includes(v.ddns_server_x),
        },
        {
          key: 'ddns_passwd_x',
          label: 'Password / token',
          control: 'password',
          validate: { maxLength: 64 },
          showIf: (v) => !['', 'WWW.ASUS.COM'].includes(v.ddns_server_x),
        },
        {
          key: 'ddns_wildcard_x',
          label: 'Enable wildcard',
          control: 'radio',
          options: yesNo,
        },
        {
          key: 'ddns_regular_check',
          label: 'Periodically verify the DDNS record still points here',
          hint: 'Merlin addition',
          control: 'radio',
          options: yesNo,
        },
      ],
    },
  ],
  write: {
    endpoint: 'applyapp',
    rcService: 'restart_ddns',
    actionWait: 10,
  },
};

// -----------------------------------------------------------------------
// 7. NAT Passthrough
// -----------------------------------------------------------------------

export const natPassthroughPage: SettingsPageDef = {
  kind: 'settings',
  id: 'nat-passthrough',
  aspPage: 'Advanced_NATPassThrough_Content.asp',
  title: 'NAT Passthrough',
  navGroup: 'wan',
  navLabel: 'NAT Passthrough',
  confidence: { read: 'structural', write: 'unverified-write' },
  writeExclusion: 'firewall',
  intro:
    'fw_pt_sip_mode (SIP NAT-helper mode: Original/Cisco) exists in the source but is hard-gated in the page\'s own JS to based_modelid=="BRT-AC828" only — it never renders on this router and is intentionally omitted.',
  read: {
    nvram: [
      'fw_pt_pptp',
      'fw_pt_l2tp',
      'fw_pt_ipsec',
      'fw_pt_rtsp',
      'fw_pt_h323',
      'fw_pt_sip',
      'fw_pt_pppoerelay',
      'pppoerelay_unit',
      'vts_ftpport',
      'wans_mode',
    ],
  },
  sections: [
    {
      title: 'NAT Passthrough',
      fields: [
        { key: 'fw_pt_pptp', label: 'PPTP passthrough', control: 'select', options: enableDisable },
        { key: 'fw_pt_l2tp', label: 'L2TP passthrough', control: 'select', options: enableDisable },
        { key: 'fw_pt_ipsec', label: 'IPSec passthrough', control: 'select', options: enableDisable },
        { key: 'fw_pt_rtsp', label: 'RTSP passthrough', control: 'select', options: enableDisable },
        { key: 'fw_pt_h323', label: 'H.323 passthrough', control: 'select', options: enableDisable },
        { key: 'fw_pt_sip', label: 'SIP passthrough', control: 'select', options: enableDisable },
        { key: 'fw_pt_pppoerelay', label: 'PPPoE relay', control: 'select', options: enableDisable },
        {
          key: 'pppoerelay_unit',
          label: 'PPPoE relay interface',
          control: 'select',
          options: [
            { value: '0', label: 'Primary WAN' },
            { value: '1', label: 'Secondary WAN' },
          ],
          showIf: (v, caps) => v.fw_pt_pppoerelay === '1' && hasFlag(caps, 'dualwan_support') && v.wans_mode === 'lb',
        },
        {
          key: 'vts_ftpport',
          label: 'FTP ALG port',
          hint: 'Port used by the FTP application-layer gateway helper',
          control: 'number',
          validate: { min: 1, max: 65535 },
        },
      ],
    },
  ],
  write: {
    endpoint: 'applyapp',
    rcService: 'restart_firewall;restart_pppoe_relay',
    actionWait: 5,
  },
};

export const wanPages: SettingsPageDef[] = [
  wanPage,
  dualWanPage,
  portTriggerPage,
  portForwardingPage,
  dmzPage,
  ddnsPage,
  natPassthroughPage,
];
