/**
 * IPv6 category: the WAN/LAN IPv6 connection-type page. Field set, option
 * values, showIf conditions, and action_script extracted from
 * Advanced_IPv6_Content.asp in the Merlin 3006.102.7_2 www/ source
 * (RAW/merlin). No RT-BE92U sysdep overlay exists for this page.
 *
 * The IPv6 *firewall* (ipv6_fw_enable / ipv6_fw_rulelist) lives on a
 * different native page in this firmware generation and is modeled in
 * src/pages/defs/firewall.ts (ipv6FirewallPage) — not duplicated here.
 *
 * Source structural quirk: several detail rows for the tunnel modes
 * (6to4/6in4/6rd) and for DHCPv6-PD, "accept default route", "release
 * prefix on exit", and manual DNS toggle all carry a hard-coded
 * `style="display:none"` on their <tr> with no id for showInputfield() to
 * un-hide — i.e. the native page's own UI never surfaces them, even though
 * their backing nvram keys are live, validated in validForm(), and read by
 * the backend. This def restores them as ordinary showIf-gated fields keyed
 * on ipv6_service (and, where the source's own JS branches on it, on the
 * DHCP-PD / 6rd-auto-detect toggle), since they are real settings an
 * administrator running a tunnel broker or DHCPv6-PD WAN would need.
 *
 * Simplification: the native page splits the DHCPv6 pool start/end into a
 * read-only computed prefix span plus a 4-hex-digit suffix input, joined on
 * submit into the full ipv6_dhcp_start/ipv6_dhcp_end address. Modeled here
 * as two plain full-address text fields on those same nvram keys instead of
 * reproducing the split-field UI.
 *
 * action_script=restart_net, action_wait=30 (hidden form fields) → falls
 * under the operator's 'excluded-restart' category: write path fully
 * implemented, never live-submitted this session.
 */
import type { SettingsPageDef } from '../types';
import { hasFlag } from '../../lib/capabilities';

const IPV4_PATTERN = '^(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})$';
const IPV4_HINT = 'IPv4 address, e.g. 192.168.1.1';
const yesNo = [
  { value: '1', label: 'Yes' },
  { value: '0', label: 'No' },
];

const TUNNEL_SERVICES = ['6to4', '6in4', '6rd'];

/** dhcp6 with PD off (manual LAN prefix), or the static "other" service. */
const isLanManual = (v: Record<string, string>) =>
  (v.ipv6_service === 'dhcp6' && v.ipv6_dhcp_pd === '0') || v.ipv6_service === 'other';
const isLanManualOr6in4 = (v: Record<string, string>) => isLanManual(v) || v.ipv6_service === '6in4';
const isDhcpPoolShown = (v: Record<string, string>) => isLanManual(v) && v.ipv6_autoconf_type === '1';
const isDnsManual = (v: Record<string, string>) =>
  ['other', '6to4', '6in4', '6rd'].includes(v.ipv6_service) ||
  (['dhcp6', 'ipv6pt', 'flets'].includes(v.ipv6_service) && v.ipv6_dnsenable === '1');
const isRaShown = (v: Record<string, string>) => ['dhcp6', 'other', '6to4', '6in4', '6rd'].includes(v.ipv6_service);

export const ipv6Page: SettingsPageDef = {
  kind: 'settings',
  id: 'ipv6',
  aspPage: 'Advanced_IPv6_Content.asp',
  title: 'IPv6',
  navGroup: 'wan',
  navOrder: 19,
  navLabel: 'IPv6',
  gate: (c) => c.rcSupport.has('ipv6'),
  confidence: { read: 'structural', write: 'unverified-write' },
  writeExclusion: 'excluded-restart',
  read: {
    nvram: [
      'ipv6_service',
      'ipv6_only',
      'ipv6_ifdev',
      'ipv6_dhcp_pd',
      'ipv6_accept_defrtr',
      'ipv6_dhcp6c_release',
      'ipv6_tun_v4end',
      'ipv6_relay',
      'ipv6_6rd_dhcp',
      'ipv6_6rd_prefix',
      'ipv6_6rd_prefixlen',
      'ipv6_6rd_router',
      'ipv6_6rd_ip4size',
      'ipv6_tun_addr',
      'ipv6_tun_addrlen',
      'ipv6_tun_peer',
      'ipv6_tun_mtu',
      'ipv6_tun_ttl',
      'ipv6_ipaddr',
      'ipv6_prefix_len_wan',
      'ipv6_gateway',
      'ipv6_rtr_addr',
      'ipv6_prefix_length',
      'ipv6_prefix',
      'ipv6_autoconf_type',
      'ipv6_dhcp_start',
      'ipv6_dhcp_end',
      'ipv6_dhcp_lifetime',
      'ipv6_dnsenable',
      'ipv6_dns1',
      'ipv6_dns2',
      'ipv6_dns3',
      'ipv6_radvd',
    ],
  },
  sections: [
    {
      title: 'Basic config',
      fields: [
        {
          key: 'ipv6_service',
          label: 'IPv6 connection type',
          control: 'select',
          options: [
            { value: 'disabled', label: 'Disabled' },
            { value: 'dhcp6', label: 'Native (DHCPv6)' },
            { value: 'other', label: 'Static IP' },
            { value: 'ipv6pt', label: 'Passthrough' },
            { value: 'flets', label: "FLET'S IPv6 Passthrough" },
            { value: '6to4', label: 'Tunnel 6to4' },
            { value: '6in4', label: 'Tunnel 6in4' },
            { value: '6rd', label: 'Tunnel 6rd' },
          ],
        },
        {
          key: 'ipv6_only',
          label: 'IPv6-only WAN',
          hint: 'Disables IPv4 on the WAN interface (requires an IPv6-capable ISP)',
          control: 'radio',
          options: yesNo,
          showIf: (v, caps) =>
            hasFlag(caps, 'IPv6_Only_support') && ['dhcp6', 'other', 'ipv6pt'].includes(v.ipv6_service),
        },
        {
          key: 'ipv6_ifdev',
          label: 'IPv6 WAN interface',
          hint: 'Only used when the WAN connection type is PPPoE/PPTP/L2TP',
          control: 'select',
          options: [
            { value: 'ppp', label: 'PPP' },
            { value: 'eth', label: 'Ethernet' },
          ],
          showIf: (v) => ['dhcp6', 'other', 'ipv6pt'].includes(v.ipv6_service),
        },
        {
          key: 'ipv6_dhcp_pd',
          label: 'Use DHCPv6 prefix delegation',
          hint: 'When disabled, the LAN prefix below is entered manually',
          control: 'radio',
          options: yesNo,
          showIf: (v) => v.ipv6_service === 'dhcp6',
        },
        {
          key: 'ipv6_accept_defrtr',
          label: 'Accept default route from ISP',
          hint: 'PPP WAN interface only',
          control: 'radio',
          options: yesNo,
          showIf: (v) => v.ipv6_service === 'dhcp6' && v.ipv6_ifdev === 'ppp',
        },
        {
          key: 'ipv6_dhcp6c_release',
          label: 'Release delegated prefix on WAN disconnect',
          control: 'radio',
          options: yesNo,
          showIf: (v) => ['dhcp6', 'ipv6pt', 'flets'].includes(v.ipv6_service),
        },
        {
          key: 'ipv6_tun_v4end',
          label: 'Tunnel server IPv4 address',
          hint: 'Remote 6in4 tunnel endpoint; blank for automatic',
          control: 'text',
          validate: { maxLength: 15, pattern: IPV4_PATTERN, patternHint: IPV4_HINT },
          showIf: (v) => v.ipv6_service === '6in4',
        },
        {
          key: 'ipv6_relay',
          label: '6to4 relay server IPv4 address',
          hint: 'Blank selects an automatic relay',
          control: 'text',
          validate: { maxLength: 15, pattern: IPV4_PATTERN, patternHint: IPV4_HINT },
          showIf: (v) => v.ipv6_service === '6to4',
        },
        {
          key: 'ipv6_6rd_dhcp',
          label: 'Auto-detect 6rd parameters (DHCP option 212)',
          control: 'radio',
          options: yesNo,
          showIf: (v) => v.ipv6_service === '6rd',
        },
        {
          key: 'ipv6_6rd_prefix',
          label: '6rd IPv6 prefix',
          control: 'text',
          validate: { required: true, maxLength: 39 },
          showIf: (v) => v.ipv6_service === '6rd' && v.ipv6_6rd_dhcp === '0',
        },
        {
          key: 'ipv6_6rd_prefixlen',
          label: '6rd prefix length',
          control: 'number',
          validate: { required: true, min: 3, max: 126 },
          showIf: (v) => v.ipv6_service === '6rd' && v.ipv6_6rd_dhcp === '0',
        },
        {
          key: 'ipv6_6rd_router',
          label: '6rd border relay IPv4 address',
          control: 'text',
          validate: { maxLength: 15, pattern: IPV4_PATTERN, patternHint: IPV4_HINT },
          showIf: (v) => v.ipv6_service === '6rd' && v.ipv6_6rd_dhcp === '0',
        },
        {
          key: 'ipv6_6rd_ip4size',
          label: '6rd IPv4 mask length',
          control: 'number',
          validate: { min: 0, max: 32 },
          showIf: (v) => v.ipv6_service === '6rd' && v.ipv6_6rd_dhcp === '0',
        },
        {
          key: 'ipv6_tun_addr',
          label: '6in4 client IPv6 address',
          control: 'text',
          validate: { required: true, maxLength: 39 },
          showIf: (v) => v.ipv6_service === '6in4',
        },
        {
          key: 'ipv6_tun_addrlen',
          label: '6in4 client prefix length',
          control: 'number',
          validate: { required: true, min: 3, max: 128 },
          showIf: (v) => v.ipv6_service === '6in4',
        },
        {
          key: 'ipv6_tun_peer',
          label: '6in4 tunnel peer address',
          hint: 'Optional',
          control: 'text',
          validate: { maxLength: 39 },
          showIf: (v) => v.ipv6_service === '6in4',
        },
        {
          key: 'ipv6_tun_mtu',
          label: 'Tunnel MTU',
          hint: '0 = automatic; otherwise 1280-1480',
          control: 'number',
          validate: { min: 0, max: 1480 },
          showIf: (v) => TUNNEL_SERVICES.includes(v.ipv6_service),
        },
        {
          key: 'ipv6_tun_ttl',
          label: 'Tunnel TTL',
          control: 'number',
          validate: { min: 0, max: 255 },
          showIf: (v) => TUNNEL_SERVICES.includes(v.ipv6_service),
        },
      ],
    },
    {
      title: 'WAN setting',
      note: 'Static IP ("other") service only.',
      fields: [
        {
          key: 'ipv6_ipaddr',
          label: 'WAN IPv6 address',
          control: 'text',
          validate: { required: true, maxLength: 39 },
          showIf: (v) => v.ipv6_service === 'other',
        },
        {
          key: 'ipv6_prefix_len_wan',
          label: 'WAN prefix length',
          control: 'number',
          validate: { required: true, min: 3, max: 128 },
          showIf: (v) => v.ipv6_service === 'other',
        },
        {
          key: 'ipv6_gateway',
          label: 'WAN gateway',
          hint: 'Optional',
          control: 'text',
          validate: { maxLength: 39 },
          showIf: (v) => v.ipv6_service === 'other',
        },
      ],
    },
    {
      title: 'LAN setting',
      note: 'Shown for manually-addressed services (static IP, DHCPv6 with prefix delegation off, or a 6in4 tunnel). Native/DHCP-PD, passthrough, and the 6to4/6rd tunnels compute the LAN prefix automatically and are read-only (see the IPv6 status page).',
      fields: [
        {
          key: 'ipv6_rtr_addr',
          label: 'LAN IPv6 address',
          control: 'text',
          validate: { required: true, maxLength: 39 },
          showIf: (v) => isLanManual(v),
        },
        {
          key: 'ipv6_prefix_length',
          label: 'LAN prefix length',
          hint: 'Max 112 when using stateful (DHCPv6) address auto-configuration',
          control: 'number',
          validate: { required: true, min: 3, max: 126 },
          showIf: (v) => isLanManualOr6in4(v),
        },
        {
          key: 'ipv6_prefix',
          label: 'LAN IPv6 prefix',
          control: 'text',
          validate: { required: true, maxLength: 39 },
          showIf: (v) => v.ipv6_service === '6in4',
        },
        {
          key: 'ipv6_autoconf_type',
          label: 'LAN address auto-configuration',
          control: 'radio',
          options: [
            { value: '0', label: 'Stateless' },
            { value: '1', label: 'Stateful' },
          ],
          showIf: (v) => isLanManual(v),
        },
        {
          key: 'ipv6_dhcp_start',
          label: 'DHCPv6 pool start',
          hint: 'Full IPv6 address',
          control: 'text',
          validate: { required: true, maxLength: 45 },
          showIf: (v) => isDhcpPoolShown(v),
        },
        {
          key: 'ipv6_dhcp_end',
          label: 'DHCPv6 pool end',
          hint: 'Full IPv6 address',
          control: 'text',
          validate: { required: true, maxLength: 45 },
          showIf: (v) => isDhcpPoolShown(v),
        },
        {
          key: 'ipv6_dhcp_lifetime',
          label: 'DHCPv6 lease time (seconds)',
          control: 'number',
          validate: { required: true, min: 120, max: 604800 },
          showIf: (v) => isDhcpPoolShown(v),
        },
      ],
    },
    {
      title: 'DNS setting',
      fields: [
        {
          key: 'ipv6_dnsenable',
          label: 'Manually specify DNS servers',
          control: 'radio',
          options: yesNo,
          showIf: (v) => ['dhcp6', 'ipv6pt', 'flets'].includes(v.ipv6_service),
        },
        {
          key: 'ipv6_dns1',
          label: 'DNS server 1',
          hint: 'Optional',
          control: 'text',
          validate: { maxLength: 39 },
          showIf: (v) => isDnsManual(v),
        },
        {
          key: 'ipv6_dns2',
          label: 'DNS server 2',
          hint: 'Optional',
          control: 'text',
          validate: { maxLength: 39 },
          showIf: (v) => isDnsManual(v),
        },
        {
          key: 'ipv6_dns3',
          label: 'DNS server 3',
          hint: 'Optional',
          control: 'text',
          validate: { maxLength: 39 },
          showIf: (v) => isDnsManual(v),
        },
      ],
    },
    {
      title: 'Auto configuration',
      fields: [
        {
          key: 'ipv6_radvd',
          label: 'Enable Router Advertisement daemon (RADVD)',
          control: 'radio',
          options: yesNo,
          showIf: (v) => isRaShown(v),
        },
      ],
    },
  ],
  write: {
    endpoint: 'applyapp',
    rcService: 'restart_net',
    actionWait: 30,
  },
};

export const ipv6Pages: SettingsPageDef[] = [ipv6Page];
