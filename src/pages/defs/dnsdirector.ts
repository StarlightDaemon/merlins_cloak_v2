/**
 * DNS Director (DNSDirector.asp) — Merlin-exclusive per-client DNS
 * redirection. Field set, preset list, and the client-rule storage format
 * extracted from the Merlin 3006.102.7_2 www/ source (RAW/merlin). No
 * RT-BE92U sysdep overlay exists for this page.
 *
 * Client rule storage is sharded across SIX nvram keys on HND platforms
 * (dnsfilter_rulelist + dnsfilter_rulelist1..5), each hard-capped at 255
 * characters by the native page's split_clientlist() — a dumb substring cut,
 * not record-aware. Reconstructed/re-sharded here identically (derive +
 * buildFields/buildVerify) so our writes stay byte-compatible with what the
 * native page itself would have written. This unit is Broadcom HND, so the
 * sharded keys are always in play (isSupport("hnd") is unconditionally true
 * here); the single-key non-HND fallback path in the native page is not
 * modeled.
 *
 * action_script is a static "restart_dnsfilter" (action_wait 5), not one of
 * the operator's hard-excluded restart scripts, so writeExclusion is null —
 * write path is fully implemented, never live-submitted this session.
 *
 * Out of scope: the Guest Network Pro / SDN per-network redirection table
 * (sdn_rl, gated on isSupport("mtlancfg")) — belongs conceptually to the SDN
 * category and is deferred.
 */
import type { SettingsPageDef } from '../types';
import { hasFlag } from '../../lib/capabilities';

const IP_PATTERN = '^(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})$';
const IP_HINT = 'IPv4 address, e.g. 192.168.1.1';
const MAC_PATTERN = '^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$';
const yesNo = [
  { value: '1', label: 'Yes' },
  { value: '0', label: 'No' },
];

/**
 * DNS redirection presets (modes_array in the native page). The native
 * <select> groups these under four optgroup headers (System / Unfiltered /
 * Security filters / Family-friendly filters) — entries with an empty value
 * in the source array are the group headers themselves, never selectable.
 * Collapsed to a flat list here with the group folded into the label
 * (FieldOption has no optgroup concept); only the 18 real value/label pairs
 * are kept. Used for both the global preset select and the per-client rule
 * column (same source array, same values, on the native page).
 */
const DNS_MODE_OPTIONS_CLEAN = [
  { value: '0', label: 'System: No Redirection' },
  { value: '11', label: 'System: Router' },
  { value: '8', label: 'System: User Defined 1' },
  { value: '9', label: 'System: User Defined 2' },
  { value: '10', label: 'System: User Defined 3' },
  { value: '17', label: 'Unfiltered: Cloudflare Safe' },
  { value: '19', label: 'Security filters: AdGuard Ad block' },
  { value: '14', label: 'Security filters: CleanBrowsing Security' },
  { value: '12', label: 'Security filters: Comodo Secure DNS' },
  { value: '1', label: 'Security filters: OpenDNS Home' },
  { value: '13', label: 'Security filters: Quad9' },
  { value: '5', label: 'Security filters: Yandex Safe' },
  { value: '20', label: 'Family-friendly: AdGuard Family' },
  { value: '15', label: 'Family-friendly: CleanBrowsing Adult' },
  { value: '16', label: 'Family-friendly: CleanBrowsing Family' },
  { value: '18', label: 'Family-friendly: Cloudflare Family' },
  { value: '7', label: 'Family-friendly: OpenDNS Family' },
  { value: '6', label: 'Family-friendly: Yandex Family' },
];

const RULE_SHARD_KEYS = [
  'dnsfilter_rulelist',
  'dnsfilter_rulelist1',
  'dnsfilter_rulelist2',
  'dnsfilter_rulelist3',
  'dnsfilter_rulelist4',
  'dnsfilter_rulelist5',
] as const;
const SHARD_LEN = 255;

/**
 * Per-client rule record: `<>MAC>mode` — a vestigial empty "name" field
 * (comment "Formerly name field" in the source) plus MAC and preset mode.
 * Reconstructed from the 6 sharded nvram keys (concatenated in order) and
 * edited here as a clean 2-column virtual list.
 */
function rulesFromShards(raw: Record<string, string>): string {
  const full = RULE_SHARD_KEYS.map((k) => raw[k] ?? '').join('');
  return full
    .split('<')
    .filter((rec) => rec !== '')
    .map((rec) => {
      const c = rec.split('>');
      return `<${c[1] ?? ''}>${c[2] ?? ''}`;
    })
    .join('');
}

function rulesToShards(view: string): Record<string, string> {
  const full = view
    .split('<')
    .filter((rec) => rec !== '')
    .map((rec) => {
      const c = rec.split('>');
      return `<>${c[0] ?? ''}>${c[1] ?? ''}`;
    })
    .join('');
  const out: Record<string, string> = {};
  RULE_SHARD_KEYS.forEach((k, i) => {
    out[k] = full.slice(i * SHARD_LEN, i * SHARD_LEN + SHARD_LEN);
  });
  return out;
}

export const dnsDirectorPage: SettingsPageDef = {
  kind: 'settings',
  id: 'dns-director',
  aspPage: 'DNSDirector.asp',
  title: 'DNS Director',
  navGroup: 'security',
  navSub: 'content',
  navOrder: 30,
  navLabel: 'DNS Director',
  merlinOnly: true,
  gate: (c) => hasFlag(c, 'dnsfilter_support'),
  confidence: { read: 'live-verified', write: 'unverified-write' },
  writeExclusion: null,
  intro:
    'Forces LAN devices to use a specific DNS server — useful for pointing clients at a filtering service. "No Redirection" bypasses a global redirection for that client/network; "Router" forces the router itself as resolver. Guest Network Pro / SDN per-network redirection is not modeled on this page.',
  read: {
    nvram: [
      'dnsfilter_enable_x',
      'dnsfilter_mode',
      'dnsfilter_custom1',
      'dnsfilter_custom2',
      'dnsfilter_custom3',
      'dnsfilter_custom61',
      'dnsfilter_custom62',
      'dnsfilter_custom63',
    ],
    nvramAscii: [...RULE_SHARD_KEYS],
    derive: (raw) => ({ dnsfilter_rulelist_view: rulesFromShards(raw) }),
  },
  sections: [
    {
      fields: [{ key: 'dnsfilter_enable_x', label: 'Enable DNS Director', control: 'radio', options: yesNo }],
    },
    {
      title: 'Global redirection',
      showIf: (v) => v.dnsfilter_enable_x === '1',
      fields: [
        { key: 'dnsfilter_mode', label: 'Global redirection', control: 'select', options: DNS_MODE_OPTIONS_CLEAN },
        {
          key: 'dnsfilter_custom1',
          label: 'User defined DNS 1 (IPv4)',
          control: 'text',
          validate: { pattern: IP_PATTERN, patternHint: IP_HINT },
        },
        {
          key: 'dnsfilter_custom61',
          label: 'User defined DNS 1 (IPv6)',
          control: 'text',
          validate: { maxLength: 39 },
        },
        {
          key: 'dnsfilter_custom2',
          label: 'User defined DNS 2 (IPv4)',
          control: 'text',
          validate: { pattern: IP_PATTERN, patternHint: IP_HINT },
        },
        {
          key: 'dnsfilter_custom62',
          label: 'User defined DNS 2 (IPv6)',
          control: 'text',
          validate: { maxLength: 39 },
        },
        {
          key: 'dnsfilter_custom3',
          label: 'User defined DNS 3 (IPv4)',
          control: 'text',
          validate: { pattern: IP_PATTERN, patternHint: IP_HINT },
        },
        {
          key: 'dnsfilter_custom63',
          label: 'User defined DNS 3 (IPv6)',
          control: 'text',
          validate: { maxLength: 39 },
        },
      ],
    },
    {
      title: 'Per-client rules',
      showIf: (v) => v.dnsfilter_enable_x === '1',
      note: 'Up to 64 client-specific redirection rules. Stored sharded across dnsfilter_rulelist / dnsfilter_rulelist1-5 (255 chars each) on this platform.',
      fields: [
        {
          key: 'dnsfilter_rulelist_view',
          label: 'Client rules',
          control: 'list',
          ascii: true,
          list: {
            maxRows: 64,
            columns: [
              {
                id: 'mac',
                label: 'Client MAC address',
                mono: true,
                placeholder: 'AA:BB:CC:DD:EE:FF',
                validate: { required: true, pattern: MAC_PATTERN, patternHint: 'MAC as AA:BB:CC:DD:EE:FF' },
              },
              { id: 'mode', label: 'Redirection', control: 'select', options: DNS_MODE_OPTIONS_CLEAN },
            ],
          },
        },
      ],
    },
  ],
  write: {
    endpoint: 'applyapp',
    rcService: 'restart_dnsfilter',
    actionWait: 5,
    buildFields: (changed) => {
      const fields: Record<string, string> = {};
      for (const [k, v] of Object.entries(changed)) {
        if (k === 'dnsfilter_rulelist_view') Object.assign(fields, rulesToShards(v));
        else fields[k] = v;
      }
      return fields;
    },
    buildVerify: (changed) => {
      const expect: Record<string, string> = {};
      for (const [k, v] of Object.entries(changed)) {
        if (k === 'dnsfilter_rulelist_view') Object.assign(expect, rulesToShards(v));
        else expect[k] = v;
      }
      return expect;
    },
  },
};

export const dnsDirectorPages: SettingsPageDef[] = [dnsDirectorPage];
