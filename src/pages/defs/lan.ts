/**
 * LAN category: LAN IP, DHCP Server, Static Route, IPTV, Switch Control.
 * Field sets, validation bounds, and action_script values extracted from the
 * corresponding pages in the Merlin 3006.102.7_2 www/ source (RAW/merlin).
 *
 * Endpoint rationale (from httpd/web.c): validate_apply() iterates the full
 * router_defaults nvram table and sets any posted field matching a key, so
 * applyapp.cgi delta writes cover every plain nvram field on these pages.
 * All writes here carry restart scripts in the operator's excluded set
 * (restart_net_and_phy / restart_net / reboot) → implemented, never
 * live-submitted this session.
 */
import type { SettingsPageDef } from '../types';

const IP_PATTERN = '^(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})$';
const IP_HINT = 'IPv4 address, e.g. 192.168.1.1';
const MAC_PATTERN = '^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$';
const yesNo = [
  { value: '1', label: 'Yes' },
  { value: '0', label: 'No' },
];

export const lanIpPage: SettingsPageDef = {
  kind: 'settings',
  id: 'lan-ip',
  aspPage: 'Advanced_LAN_Content.asp',
  title: 'Router Address & Hostname',
  navGroup: 'lan',
  navSub: 'addressing',
  navOrder: 11,
  confidence: { read: 'live-verified', write: 'unverified-write' },
  writeExclusion: 'excluded-restart',
  read: {
    nvram: ['lan_ipaddr', 'lan_netmask', 'lan_hostname', 'lan_domain'],
  },
  sections: [
    {
      title: 'LAN IP setting',
      note: 'Changing the LAN address restarts the whole network stack (restart_net_and_phy) and moves the admin UI to the new address.',
      fields: [
        {
          key: 'lan_ipaddr',
          label: 'IP address',
          control: 'text',
          validate: { required: true, pattern: IP_PATTERN, patternHint: IP_HINT },
        },
        {
          key: 'lan_netmask',
          label: 'Subnet mask',
          control: 'text',
          validate: { required: true, pattern: IP_PATTERN, patternHint: 'Subnet mask, e.g. 255.255.255.0' },
        },
        {
          key: 'lan_hostname',
          label: "Router's host name",
          control: 'text',
          validate: { maxLength: 32, pattern: '^[a-zA-Z0-9][a-zA-Z0-9-]*$', patternHint: 'Letters, digits, hyphens' },
        },
        {
          key: 'lan_domain',
          label: "Router's domain name",
          control: 'text',
          validate: { maxLength: 32 },
        },
      ],
    },
  ],
  write: {
    endpoint: 'applyapp',
    rcService: 'restart_net_and_phy',
    actionWait: 35,
  },
};

export const dhcpPage: SettingsPageDef = {
  kind: 'settings',
  id: 'dhcp',
  aspPage: 'Advanced_DHCP_Content.asp',
  title: 'Address Assignment (DHCP)',
  navGroup: 'lan',
  navSub: 'addressing',
  navOrder: 12,
  confidence: { read: 'live-verified', write: 'unverified-write' },
  writeExclusion: 'dhcp',
  read: {
    nvram: [
      'dhcp_enable_x',
      'lan_domain',
      'dhcp_start',
      'dhcp_end',
      'dhcp_lease',
      'dhcp_gateway_x',
      'dhcp_dns1_x',
      'dhcp_dns2_x',
      'dhcpd_dns_router',
      'dhcp_wins_x',
      'dhcp_static_x',
      'dhcpd_querylog',
    ],
    nvramAscii: ['dhcp_staticlist'],
  },
  sections: [
    {
      title: 'Basic config',
      fields: [
        { key: 'dhcp_enable_x', label: 'Enable the DHCP server', control: 'radio', options: yesNo },
        { key: 'lan_domain', label: "Router's domain name", control: 'text', validate: { maxLength: 32 } },
        {
          key: 'dhcp_start',
          label: 'IP pool starting address',
          control: 'text',
          validate: { required: true, pattern: IP_PATTERN, patternHint: IP_HINT },
        },
        {
          key: 'dhcp_end',
          label: 'IP pool ending address',
          control: 'text',
          validate: { required: true, pattern: IP_PATTERN, patternHint: IP_HINT },
        },
        {
          key: 'dhcp_lease',
          label: 'Lease time (seconds)',
          control: 'number',
          validate: { min: 120, max: 604800, required: true },
        },
        { key: 'dhcp_gateway_x', label: 'Default gateway', control: 'text', validate: { pattern: IP_PATTERN, patternHint: IP_HINT } },
      ],
    },
    {
      title: 'DNS and WINS server setting',
      fields: [
        { key: 'dhcp_dns1_x', label: 'DNS server 1', control: 'text', validate: { pattern: IP_PATTERN, patternHint: IP_HINT } },
        { key: 'dhcp_dns2_x', label: 'DNS server 2', control: 'text', validate: { pattern: IP_PATTERN, patternHint: IP_HINT } },
        {
          key: 'dhcpd_dns_router',
          label: "Advertise router's IP in addition to user-specified DNS",
          control: 'radio',
          options: yesNo,
          showIf: (v) => v.dhcp_dns1_x !== '' || v.dhcp_dns2_x !== '',
        },
        { key: 'dhcp_wins_x', label: 'WINS server', control: 'text', validate: { pattern: IP_PATTERN, patternHint: IP_HINT } },
      ],
    },
    {
      title: 'Manual assignment',
      note: 'Static DHCP leases. MAC → IP, with optional per-host DNS and hostname.',
      fields: [
        { key: 'dhcp_static_x', label: 'Enable manual assignment', control: 'radio', options: yesNo },
        {
          key: 'dhcpd_querylog',
          label: 'Log DHCP queries',
          hint: 'Merlin addition',
          control: 'radio',
          options: yesNo,
        },
        {
          key: 'dhcp_staticlist',
          label: 'Manually assigned IPs',
          control: 'list',
          ascii: true,
          list: {
            maxRows: 128,
            columns: [
              { id: 'mac', label: 'MAC address', mono: true, placeholder: 'AA:BB:CC:DD:EE:FF', validate: { required: true, pattern: MAC_PATTERN, patternHint: 'MAC as AA:BB:CC:DD:EE:FF' } },
              { id: 'ip', label: 'IP address', mono: true, validate: { required: true, pattern: IP_PATTERN, patternHint: IP_HINT } },
              { id: 'dns', label: 'DNS (optional)', mono: true, validate: { pattern: IP_PATTERN, patternHint: IP_HINT } },
              { id: 'hostname', label: 'Host name (optional)', validate: { maxLength: 32 } },
            ],
          },
        },
      ],
    },
  ],
  write: {
    endpoint: 'applyapp',
    rcService: 'restart_net_and_phy',
    actionWait: 30,
  },
};

export const staticRoutePage: SettingsPageDef = {
  kind: 'settings',
  id: 'static-route',
  aspPage: 'Advanced_GWStaticRoute_Content.asp',
  title: 'Static Routes',
  navGroup: 'lan',
  navSub: 'addressing',
  navOrder: 13,
  confidence: { read: 'live-verified', write: 'unverified-write' },
  writeExclusion: 'excluded-restart',
  read: {
    nvram: ['sr_enable_x'],
    nvramAscii: ['sr_rulelist'],
  },
  sections: [
    {
      title: 'Basic config',
      fields: [
        { key: 'sr_enable_x', label: 'Enable static routes', control: 'radio', options: yesNo },
        {
          key: 'sr_rulelist',
          label: 'Static route list',
          control: 'list',
          ascii: true,
          list: {
            maxRows: 64,
            columns: [
              { id: 'ipaddr', label: 'Network/Host IP', mono: true, validate: { required: true, pattern: IP_PATTERN, patternHint: IP_HINT } },
              { id: 'netmask', label: 'Netmask', mono: true, validate: { required: true, pattern: IP_PATTERN, patternHint: IP_HINT } },
              { id: 'gateway', label: 'Gateway', mono: true, validate: { required: true, pattern: IP_PATTERN, patternHint: IP_HINT } },
              { id: 'matric', label: 'Metric', width: 70, validate: { min: 1, max: 15 } },
              {
                id: 'if',
                label: 'Interface',
                width: 90,
                control: 'select',
                options: [
                  { value: 'LAN', label: 'LAN' },
                  { value: 'WAN', label: 'WAN' },
                  { value: 'MAN', label: 'MAN' },
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
    rcService: 'restart_net',
    actionWait: 10,
  },
};

export const iptvPage: SettingsPageDef = {
  kind: 'settings',
  id: 'iptv',
  aspPage: 'Advanced_IPTV_Content.asp',
  title: 'IPTV & Multicast',
  navGroup: 'lan',
  navSub: 'segments',
  navOrder: 15,
  confidence: { read: 'live-verified', write: 'unverified-write' },
  writeExclusion: 'excluded-restart',
  intro:
    'ISP-profile selection (switch_wantag) reconfigures VLAN port mapping and is modeled here only for the generic profiles; carrier-specific profiles retain their stored value if already set.',
  read: {
    nvram: [
      'switch_wantag',
      'switch_stb_x',
      'mr_enable_x',
      'mr_igmp_ver',
      'mr_qleave_x',
      'emf_enable',
      'udpxy_enable_x',
      'ttl_inc_enable',
    ],
  },
  sections: [
    {
      title: 'LAN port',
      fields: [
        {
          key: 'switch_wantag',
          label: 'ISP profile',
          control: 'select',
          options: [
            { value: 'none', label: 'None' },
            { value: 'manual', label: 'Manual setting' },
          ],
        },
        {
          key: 'switch_stb_x',
          label: 'Choose IPTV STB port',
          control: 'select',
          options: [
            { value: '0', label: 'None' },
            { value: '1', label: 'LAN1' },
            { value: '2', label: 'LAN2' },
            { value: '3', label: 'LAN3' },
            { value: '4', label: 'LAN4' },
            { value: '5', label: 'LAN1 & LAN2' },
            { value: '6', label: 'LAN3 & LAN4' },
          ],
          showIf: (v) => v.switch_wantag === 'none',
        },
      ],
    },
    {
      title: 'Special applications',
      fields: [
        {
          key: 'mr_enable_x',
          label: 'Enable multicast routing (IGMP proxy)',
          control: 'radio',
          options: [
            { value: '1', label: 'Enable' },
            { value: '0', label: 'Disable' },
          ],
        },
        {
          key: 'mr_igmp_ver',
          label: 'IGMP version',
          control: 'select',
          options: [
            { value: '1', label: 'IGMP v1' },
            { value: '2', label: 'IGMP v2' },
            { value: '3', label: 'IGMP v3' },
          ],
          showIf: (v) => v.mr_enable_x === '1',
        },
        { key: 'mr_qleave_x', label: 'Fast leave', control: 'radio', options: yesNo, showIf: (v) => v.mr_enable_x === '1' },
        { key: 'emf_enable', label: 'Enable efficient multicast forwarding (IGMP snooping)', control: 'radio', options: yesNo },
        {
          key: 'udpxy_enable_x',
          label: 'UDP proxy (udpxy) port',
          hint: '0 disables udpxy',
          control: 'number',
          validate: { min: 0, max: 65535 },
        },
        { key: 'ttl_inc_enable', label: 'Increase TTL value', control: 'radio', options: yesNo },
      ],
    },
  ],
  write: {
    endpoint: 'applyapp',
    rcService: 'restart_net',
    actionWait: 10,
  },
};

export const switchCtrlPage: SettingsPageDef = {
  kind: 'settings',
  id: 'switch-ctrl',
  aspPage: 'Advanced_SwitchCtrl_Content.asp',
  title: 'Ethernet Port Settings',
  navGroup: 'lan',
  navSub: 'segments',
  navOrder: 16,
  confidence: { read: 'live-verified', write: 'unverified-write' },
  writeExclusion: 'firmware-reboot-reset',
  intro:
    'The native page applies these with a full reboot (action_script=reboot). NAT-acceleration controls are not exposed on HND platforms (matching the native page, which disables them).',
  read: {
    nvram: ['jumbo_frame_enable', 'lan_stp'],
  },
  sections: [
    {
      fields: [
        { key: 'jumbo_frame_enable', label: 'Jumbo frame', control: 'radio', options: [
          { value: '1', label: 'Enable' },
          { value: '0', label: 'Disable' },
        ] },
        { key: 'lan_stp', label: 'Spanning-Tree Protocol', control: 'radio', options: [
          { value: '1', label: 'Enable' },
          { value: '0', label: 'Disable' },
        ] },
      ],
    },
  ],
  write: {
    endpoint: 'applyapp',
    rcService: 'reboot',
    actionWait: 120,
  },
};

export const lanPages: SettingsPageDef[] = [lanIpPage, dhcpPage, staticRoutePage, iptvPage, switchCtrlPage];
