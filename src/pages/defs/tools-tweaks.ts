/**
 * Tweaks (Tools_OtherSettings.asp) — the most thoroughly characterized page
 * in the project: all four cleared live-write fields live here
 * (docs/WRITE_PATH_CHARACTERIZATION.md). Field decomposition and validation
 * bounds are taken verbatim from the page source.
 *
 * ct_tcp_timeout joined order (position 0 and 9 are fixed "0"):
 *   0 established syn_sent syn_recv fin_wait time_wait close close_wait last_ack 0
 * ct_udp_timeout joined order: unreplied assured
 *
 * Writes go through applyapp.cgi as true deltas (live-validated for this
 * page's field family); the joined nvram keys are what the router stores, so
 * the delta payload carries the joined representation only.
 */
import type { SettingsPageDef } from '../types';

const TCP_FIELDS = [
  'tcp_established',
  'tcp_syn_sent',
  'tcp_syn_recv',
  'tcp_fin_wait',
  'tcp_time_wait',
  'tcp_close',
  'tcp_close_wait',
  'tcp_last_ack',
] as const;

const UDP_FIELDS = ['udp_unreplied', 'udp_assured'] as const;

function joinTcp(values: Record<string, string>): string {
  return `0 ${TCP_FIELDS.map((f) => values[f] ?? '').join(' ')} 0`;
}

function joinUdp(values: Record<string, string>): string {
  return `${values.udp_unreplied ?? ''} ${values.udp_assured ?? ''}`;
}

const yesNo = [
  { value: '1', label: 'Yes' },
  { value: '0', label: 'No' },
];

export const tweaksPage: SettingsPageDef = {
  kind: 'settings',
  id: 'tweaks',
  aspPage: 'Tools_OtherSettings.asp',
  title: 'Tweaks',
  navGroup: 'admin',
  navLabel: 'Tweaks',
  merlinOnly: true,
  confidence: { read: 'live-verified', write: 'live-verified' },
  writeExclusion: null,
  read: {
    nvram: [
      'ct_max',
      'ct_tcp_timeout',
      'ct_udp_timeout',
      'http_dut_redir',
      'ipv6_ns_drop',
      'aae_disable_force',
      'dhcpd_send_wpad',
    ],
    derive: (raw) => {
      const out: Record<string, string> = {};
      const tcp = (raw.ct_tcp_timeout ?? '').split(' ');
      TCP_FIELDS.forEach((f, i) => {
        out[f] = tcp[i + 1] ?? '';
      });
      const udp = (raw.ct_udp_timeout ?? '').split(' ');
      UDP_FIELDS.forEach((f, i) => {
        out[f] = udp[i] ?? '';
      });
      return out;
    },
  },
  sections: [
    {
      title: 'Connection tracking',
      note: 'Netfilter conntrack table sizing and per-state timeouts. Applied with restart_conntrack — no interface restart.',
      fields: [
        {
          key: 'ct_max',
          label: 'TCP connections limit',
          hint: 'conntrack table maximum entries',
          control: 'number',
          validate: { min: 256, max: 300000, required: true },
        },
        { key: 'tcp_established', label: 'TCP timeout: established', control: 'number', validate: { min: 1, max: 432000, required: true } },
        { key: 'tcp_syn_sent', label: 'TCP timeout: SYN sent', control: 'number', validate: { min: 1, max: 86400, required: true } },
        { key: 'tcp_syn_recv', label: 'TCP timeout: SYN received', control: 'number', validate: { min: 1, max: 86400, required: true } },
        { key: 'tcp_fin_wait', label: 'TCP timeout: FIN wait', control: 'number', validate: { min: 1, max: 86400, required: true } },
        { key: 'tcp_time_wait', label: 'TCP timeout: time wait', control: 'number', validate: { min: 1, max: 86400, required: true } },
        { key: 'tcp_close', label: 'TCP timeout: close', control: 'number', validate: { min: 1, max: 86400, required: true } },
        { key: 'tcp_close_wait', label: 'TCP timeout: close wait', control: 'number', validate: { min: 1, max: 86400, required: true } },
        { key: 'tcp_last_ack', label: 'TCP timeout: last ACK', control: 'number', validate: { min: 1, max: 86400, required: true } },
        { key: 'udp_unreplied', label: 'UDP timeout: unreplied', control: 'number', validate: { min: 1, max: 86400, required: true } },
        { key: 'udp_assured', label: 'UDP timeout: assured', control: 'number', validate: { min: 1, max: 86400, required: true } },
      ],
    },
    {
      title: 'Miscellaneous services',
      fields: [
        {
          key: 'http_dut_redir',
          label: 'Redirect webui access to www.asusrouter.com',
          hint: 'Hard-excluded from live testing: redirecting the WebUI risks cutting off this very session.',
          control: 'radio',
          options: yesNo,
        },
        {
          key: 'ipv6_ns_drop',
          label: 'Firewall: drop IPv6 neighbour solicitation broadcasts',
          control: 'radio',
          options: yesNo,
        },
        {
          key: 'aae_disable_force',
          label: 'Disable Asusnat tunnel',
          control: 'radio',
          options: yesNo,
        },
        {
          key: 'dhcpd_send_wpad',
          label: 'DHCP: send empty WPAD with a carriage return',
          control: 'radio',
          options: yesNo,
        },
      ],
    },
  ],
  write: {
    endpoint: 'applyapp',
    rcService: 'restart_conntrack',
    buildFields: (changed, all) => {
      const fields: Record<string, string> = {};
      let tcpTouched = false;
      let udpTouched = false;
      for (const key of Object.keys(changed)) {
        if ((TCP_FIELDS as readonly string[]).includes(key)) tcpTouched = true;
        else if ((UDP_FIELDS as readonly string[]).includes(key)) udpTouched = true;
        else fields[key] = changed[key];
      }
      if (tcpTouched) fields.ct_tcp_timeout = joinTcp(all);
      if (udpTouched) fields.ct_udp_timeout = joinUdp(all);
      return fields;
    },
    buildVerify: (changed, all) => {
      const expect: Record<string, string> = {};
      for (const key of Object.keys(changed)) {
        if ((TCP_FIELDS as readonly string[]).includes(key)) expect.ct_tcp_timeout = joinTcp(all);
        else if ((UDP_FIELDS as readonly string[]).includes(key)) expect.ct_udp_timeout = joinUdp(all);
        else expect[key] = changed[key];
      }
      return expect;
    },
  },
};
