/**
 * Firewall category: General (basic firewall + IPv4 inbound rules), URL
 * Filter, Keyword Filter, Network Services Filter, IPv6 Firewall.
 * Field sets, validation bounds, list encodings, and action_script values
 * extracted from the corresponding pages in the Merlin 3006.102.7_2 www/
 * source (RAW/merlin). No RT-BE92U sysdep overlay exists for any of them.
 *
 * All five pages apply with action_script=restart_firewall (action_wait 5)
 * and fall under the operator's 'firewall' hard exclusion: write paths are
 * fully implemented, never live-submitted this session.
 *
 * 3006.x structural note: there is no Advanced_IPv6Firewall_Content.asp in
 * this firmware — the IPv6 firewall (ipv6_fw_enable / ipv6_fw_rulelist) was
 * merged into Advanced_BasicFirewall_Content.asp, alongside a new IPv4
 * inbound table (fw_wl_enable_x / filter_wllist). The IPv6 firewall is
 * modeled here as its own view ('ipv6-firewall') over that same native page.
 */
import type { SettingsPageDef } from '../types';

const IP_PATTERN = '^(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})$';
const IP_HINT = 'IPv4 address, e.g. 192.168.1.1';
/** Block_chars(["#","%","&","*","{","}","\\",":","<",">","?","/","+"]) on both filter pages. */
const FILTER_TEXT_PATTERN = '^[^#%&*{}\\\\:<>?/+]+$';
const FILTER_TEXT_HINT = 'Must not contain # % & * { } \\ : < > ? / +';
/** Ports 1-65535; ':' ranges and comma-separated multi-entries (check_multi_range). */
const MULTI_PORT_PATTERN = '^\\d{1,5}([:,]\\d{1,5})*$';
const MULTI_PORT_HINT = 'Ports 1-65535; range with ":", comma-separated';
const yesNo = [
  { value: '1', label: 'Yes' },
  { value: '0', label: 'No' },
];

/**
 * filter_wllist stored record, from the page's own join code
 * (`'<' + proto + '>>' + lipaddr + '>>>' + port`): six '>'-separated fields
 * of which 1, 3 and 4 are always empty — [proto, '', localIP, '', '', port].
 * Edited here as a clean 3-column virtual list ('filter_wllist_view'),
 * re-padded to the stored shape on write (tools-tweaks derive pattern).
 */
function ipv4InboundFromStored(stored: string): string {
  if (!stored) return '';
  return stored
    .split('<')
    .filter((rec) => rec !== '')
    .map((rec) => {
      const c = rec.split('>');
      return `<${c[0] ?? ''}>${c[2] ?? ''}>${c[5] ?? ''}`;
    })
    .join('');
}

function ipv4InboundToStored(view: string): string {
  if (!view) return '';
  return view
    .split('<')
    .filter((rec) => rec !== '')
    .map((rec) => {
      const c = rec.split('>');
      return `<${c[0] ?? ''}>>${c[1] ?? ''}>>>${c[2] ?? ''}`;
    })
    .join('');
}

export const basicFirewallPage: SettingsPageDef = {
  kind: 'settings',
  id: 'firewall-general',
  aspPage: 'Advanced_BasicFirewall_Content.asp',
  title: 'General',
  navGroup: 'security',
  navSub: 'firewall',
  navOrder: 21,
  navLabel: 'General',
  confidence: { read: 'structural', write: 'unverified-write' },
  writeExclusion: 'firewall',
  read: {
    nvram: ['fw_enable_x', 'fw_dos_x', 'fw_log_x', 'misc_ping_x', 'fw_wl_enable_x'],
    nvramAscii: ['filter_wllist'],
    derive: (raw) => ({ filter_wllist_view: ipv4InboundFromStored(raw.filter_wllist ?? '') }),
  },
  sections: [
    {
      title: 'Basic config',
      fields: [
        { key: 'fw_enable_x', label: 'Enable firewall', control: 'radio', options: yesNo },
        {
          key: 'fw_dos_x',
          label: 'Enable DoS protection',
          control: 'radio',
          options: yesNo,
          showIf: (v) => v.fw_enable_x === '1',
        },
        {
          key: 'fw_log_x',
          label: 'Logged packets type',
          control: 'select',
          options: [
            { value: 'none', label: 'None' },
            { value: 'drop', label: 'Dropped' },
            { value: 'accept', label: 'Accepted' },
            { value: 'both', label: 'Both' },
          ],
          showIf: (v) => v.fw_enable_x === '1',
        },
        {
          key: 'misc_ping_x',
          label: 'Respond ICMP Echo (ping) requests from WAN',
          control: 'radio',
          options: yesNo,
          showIf: (v) => v.fw_enable_x === '1',
        },
      ],
    },
    {
      title: 'IPv4 inbound firewall',
      note: 'The native page\'s "IPv4 Firewall" table: inbound rules for the listed local IP / port / protocol tuples.',
      fields: [
        { key: 'fw_wl_enable_x', label: 'Enable IPv4 inbound firewall rules', control: 'radio', options: yesNo },
        {
          key: 'filter_wllist_view',
          label: 'IPv4 inbound firewall rules',
          hint: 'Stored in nvram filter_wllist (proto>>ip>>>port padding handled transparently)',
          control: 'list',
          ascii: true,
          list: {
            maxRows: 128,
            columns: [
              {
                id: 'proto',
                label: 'Protocol',
                width: 90,
                control: 'select',
                options: [
                  { value: 'TCP', label: 'TCP' },
                  { value: 'UDP', label: 'UDP' },
                ],
              },
              {
                id: 'lipaddr',
                label: 'Local IP',
                mono: true,
                validate: { required: true, pattern: IP_PATTERN, patternHint: IP_HINT },
              },
              {
                id: 'port',
                label: 'Port range',
                mono: true,
                validate: { required: true, pattern: MULTI_PORT_PATTERN, patternHint: MULTI_PORT_HINT },
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
    buildFields: (changed) => {
      const fields: Record<string, string> = {};
      for (const [k, v] of Object.entries(changed)) {
        if (k === 'filter_wllist_view') fields.filter_wllist = ipv4InboundToStored(v);
        else fields[k] = v;
      }
      return fields;
    },
    buildVerify: (changed) => {
      const expect: Record<string, string> = {};
      for (const [k, v] of Object.entries(changed)) {
        if (k === 'filter_wllist_view') expect.filter_wllist = ipv4InboundToStored(v);
        else expect[k] = v;
      }
      return expect;
    },
  },
};

/**
 * url_rulelist stored record: 1>ALL>keyword — the page hard-codes the first
 * two fields ("enable" flag and "ALL" LAN scope) on every add/apply. Edited
 * here as a single-column virtual list ('url_rulelist_view').
 */
function urlKeywordsFromStored(stored: string): string {
  if (!stored) return '';
  return stored
    .split('<')
    .filter((rec) => rec !== '')
    .map((rec) => `<${rec.split('>')[2] ?? ''}`)
    .join('');
}

function urlKeywordsToStored(view: string): string {
  if (!view) return '';
  return view
    .split('<')
    .filter((rec) => rec !== '')
    .map((kw) => `<1>ALL>${kw}`)
    .join('');
}

export const urlFilterPage: SettingsPageDef = {
  kind: 'settings',
  id: 'url-filter',
  aspPage: 'Advanced_URLFilter_Content.asp',
  title: 'URL Filter',
  navGroup: 'security',
  navSub: 'content',
  navOrder: 31,
  navLabel: 'URL Filter',
  confidence: { read: 'structural', write: 'unverified-write' },
  writeExclusion: 'firewall',
  read: {
    nvram: ['url_enable_x', 'url_mode_x'],
    nvramAscii: ['url_rulelist'],
    derive: (raw) => ({ url_rulelist_view: urlKeywordsFromStored(raw.url_rulelist ?? '') }),
  },
  sections: [
    {
      title: 'Basic config',
      fields: [
        {
          key: 'url_enable_x',
          label: 'Enable URL filter',
          control: 'radio',
          options: [
            { value: '1', label: 'Enabled' },
            { value: '0', label: 'Disabled' },
          ],
        },
        {
          key: 'url_mode_x',
          label: 'Filter table type',
          control: 'select',
          options: [
            { value: '0', label: 'Black List' },
            { value: '1', label: 'White List' },
          ],
        },
      ],
    },
    {
      title: 'URL filter list',
      note: 'Keyword match against requested URLs. Stored in nvram url_rulelist (fixed 1>ALL> record prefix handled transparently).',
      fields: [
        {
          key: 'url_rulelist_view',
          label: 'URL filter list',
          control: 'list',
          ascii: true,
          list: {
            maxRows: 64,
            columns: [
              {
                id: 'url',
                label: 'URL keyword',
                mono: true,
                validate: { required: true, maxLength: 64, pattern: FILTER_TEXT_PATTERN, patternHint: FILTER_TEXT_HINT },
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
    buildFields: (changed) => {
      const fields: Record<string, string> = {};
      for (const [k, v] of Object.entries(changed)) {
        if (k === 'url_rulelist_view') fields.url_rulelist = urlKeywordsToStored(v);
        else fields[k] = v;
      }
      return fields;
    },
    buildVerify: (changed) => {
      const expect: Record<string, string> = {};
      for (const [k, v] of Object.entries(changed)) {
        if (k === 'url_rulelist_view') expect.url_rulelist = urlKeywordsToStored(v);
        else expect[k] = v;
      }
      return expect;
    },
  },
};

export const keywordFilterPage: SettingsPageDef = {
  kind: 'settings',
  id: 'keyword-filter',
  aspPage: 'Advanced_KeywordFilter_Content.asp',
  title: 'Keyword Filter',
  navGroup: 'security',
  navSub: 'content',
  navOrder: 32,
  navLabel: 'Keyword Filter',
  confidence: { read: 'structural', write: 'unverified-write' },
  writeExclusion: 'firewall',
  read: {
    nvram: ['keyword_enable_x'],
    nvramAscii: ['keyword_rulelist'],
  },
  sections: [
    {
      title: 'Basic config',
      fields: [
        {
          key: 'keyword_enable_x',
          label: 'Enable keyword filter',
          control: 'radio',
          options: [
            { value: '1', label: 'Enabled' },
            { value: '0', label: 'Disabled' },
          ],
        },
        {
          key: 'keyword_rulelist',
          label: 'Keyword filter list',
          hint: 'Blocks web pages containing the listed keywords (single-field records)',
          control: 'list',
          ascii: true,
          list: {
            maxRows: 64,
            columns: [
              {
                id: 'keyword',
                label: 'Keyword',
                validate: { required: true, maxLength: 32, pattern: FILTER_TEXT_PATTERN, patternHint: FILTER_TEXT_HINT },
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

/**
 * filter_lw_date_x is a 7-character 0/1 mask, char 0 = Sunday … char 6 =
 * Saturday (general.js getDateCheck/setDateCheck). Decomposed into per-day
 * virtual toggles; the two time windows stay in their stored HHMMHHMM shape.
 */
const LW_DAY_KEYS = [
  'filter_lw_day_sun',
  'filter_lw_day_mon',
  'filter_lw_day_tue',
  'filter_lw_day_wed',
  'filter_lw_day_thu',
  'filter_lw_day_fri',
  'filter_lw_day_sat',
] as const;

const LW_WEEKDAY_KEYS = LW_DAY_KEYS.slice(1, 6);
const LW_WEEKEND_KEYS = [LW_DAY_KEYS[6], LW_DAY_KEYS[0]];

function joinLwDays(values: Record<string, string>): string {
  return LW_DAY_KEYS.map((k) => (values[k] === '1' ? '1' : '0')).join('');
}

const TIME_PATTERN = '^([01]\\d|2[0-3])[0-5]\\d([01]\\d|2[0-3])[0-5]\\d$';
const TIME_HINT = 'HHMMHHMM: start hour+minute, end hour+minute (e.g. 08001730)';

export const networkServiceFilterPage: SettingsPageDef = {
  kind: 'settings',
  id: 'network-service-filter',
  aspPage: 'Advanced_Firewall_Content.asp',
  title: 'Network Services Filter',
  navGroup: 'security',
  navSub: 'firewall',
  navOrder: 23,
  navLabel: 'Network Services Filter',
  confidence: { read: 'live-verified', write: 'unverified-write' },
  writeExclusion: 'firewall',
  read: {
    nvram: [
      'fw_lw_enable_x',
      'filter_lw_default_x',
      'filter_lw_icmp_x',
      'filter_lw_date_x',
      'filter_lw_time_x',
      'filter_lw_time2_x',
    ],
    nvramAscii: ['filter_lwlist'],
    derive: (raw) => {
      const out: Record<string, string> = {};
      const mask = raw.filter_lw_date_x ?? '';
      LW_DAY_KEYS.forEach((k, i) => {
        out[k] = mask.charAt(i) === '1' ? '1' : '0';
      });
      return out;
    },
  },
  sections: [
    {
      title: 'Basic config',
      fields: [
        { key: 'fw_lw_enable_x', label: 'Enable LAN to WAN filter', control: 'radio', options: yesNo },
        {
          key: 'filter_lw_default_x',
          label: 'Filter table type',
          control: 'select',
          options: [
            { value: 'DROP', label: 'White List (drop by default)' },
            { value: 'ACCEPT', label: 'Black List (accept by default)' },
          ],
        },
        {
          key: 'filter_lw_icmp_x',
          label: 'Filtered ICMP packet types',
          hint: 'ICMP type numbers 0-255, space-separated (e.g. 8 13)',
          control: 'text',
          validate: { maxLength: 64, pattern: '^\\d{1,3}( \\d{1,3})*$', patternHint: 'Numbers 0-255, space-separated' },
        },
      ],
    },
    {
      title: 'Active schedule',
      note: 'Filter active on the checked days within the matching time window. Requires a synchronized system clock (NTP).',
      fields: [
        { key: 'filter_lw_day_mon', label: 'Monday', control: 'toggle' },
        { key: 'filter_lw_day_tue', label: 'Tuesday', control: 'toggle' },
        { key: 'filter_lw_day_wed', label: 'Wednesday', control: 'toggle' },
        { key: 'filter_lw_day_thu', label: 'Thursday', control: 'toggle' },
        { key: 'filter_lw_day_fri', label: 'Friday', control: 'toggle' },
        {
          key: 'filter_lw_time_x',
          label: 'Time of day (weekdays)',
          control: 'text',
          validate: { maxLength: 8, pattern: TIME_PATTERN, patternHint: TIME_HINT },
          showIf: (v) => LW_WEEKDAY_KEYS.some((k) => v[k] === '1'),
        },
        { key: 'filter_lw_day_sat', label: 'Saturday', control: 'toggle' },
        { key: 'filter_lw_day_sun', label: 'Sunday', control: 'toggle' },
        {
          key: 'filter_lw_time2_x',
          label: 'Time of day (weekend)',
          control: 'text',
          validate: { maxLength: 8, pattern: TIME_PATTERN, patternHint: TIME_HINT },
          showIf: (v) => LW_WEEKEND_KEYS.some((k) => v[k] === '1'),
        },
      ],
    },
    {
      title: 'Network Services Filter list',
      note: 'IPs may be plain IPv4, CIDR (1.2.3.4/24), "*"-wildcard IPv4, or IPv6 (source and destination must be the same family).',
      fields: [
        {
          key: 'filter_lwlist',
          label: 'Filter list',
          control: 'list',
          ascii: true,
          list: {
            maxRows: 128,
            columns: [
              { id: 'srcip', label: 'Source IP', mono: true, validate: { maxLength: 39 } },
              {
                id: 'srcport',
                label: 'Port range',
                mono: true,
                width: 90,
                validate: { maxLength: 11, pattern: '^\\d{1,5}(:\\d{1,5})?$', patternHint: 'Port or start:end range' },
              },
              { id: 'dstip', label: 'Destination IP', mono: true, validate: { maxLength: 39 } },
              {
                id: 'dstport',
                label: 'Port range',
                mono: true,
                width: 90,
                validate: { maxLength: 11, pattern: '^\\d{1,5}(:\\d{1,5})?$', patternHint: 'Port or start:end range' },
              },
              {
                id: 'proto',
                label: 'Protocol',
                width: 110,
                control: 'select',
                options: [
                  { value: 'TCP', label: 'TCP' },
                  { value: 'TCP SYN', label: 'TCP SYN' },
                  { value: 'TCP ACK', label: 'TCP ACK' },
                  { value: 'TCP FIN', label: 'TCP FIN' },
                  { value: 'TCP RST', label: 'TCP RST' },
                  { value: 'TCP URG', label: 'TCP URG' },
                  { value: 'TCP PSH', label: 'TCP PSH' },
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
    buildFields: (changed, all) => {
      const fields: Record<string, string> = {};
      let daysTouched = false;
      for (const [k, v] of Object.entries(changed)) {
        if ((LW_DAY_KEYS as readonly string[]).includes(k)) daysTouched = true;
        else fields[k] = v;
      }
      if (daysTouched) fields.filter_lw_date_x = joinLwDays(all);
      return fields;
    },
    buildVerify: (changed, all) => {
      const expect: Record<string, string> = {};
      for (const [k, v] of Object.entries(changed)) {
        if ((LW_DAY_KEYS as readonly string[]).includes(k)) expect.filter_lw_date_x = joinLwDays(all);
        else expect[k] = v;
      }
      return expect;
    },
  },
};

export const ipv6FirewallPage: SettingsPageDef = {
  kind: 'settings',
  id: 'ipv6-firewall',
  // 3006.x has no separate Advanced_IPv6Firewall_Content.asp; the IPv6
  // firewall lives on the basic firewall page (see file header).
  aspPage: 'Advanced_BasicFirewall_Content.asp',
  title: 'IPv6 Firewall',
  navGroup: 'security',
  navSub: 'firewall',
  navOrder: 22,
  navLabel: 'IPv6 Firewall',
  gate: (c) => c.rcSupport.has('ipv6'),
  confidence: { read: 'structural', write: 'unverified-write' },
  writeExclusion: 'firewall',
  intro:
    'All inbound IPv6 traffic to LAN hosts is blocked by default when the IPv6 firewall is enabled; rules below open specific services.',
  read: {
    nvram: ['ipv6_fw_enable'],
    nvramAscii: ['ipv6_fw_rulelist'],
  },
  sections: [
    {
      title: 'Basic config',
      fields: [
        { key: 'ipv6_fw_enable', label: 'Enable IPv6 firewall', control: 'radio', options: yesNo },
        {
          key: 'ipv6_fw_rulelist',
          label: 'Inbound firewall rules',
          hint: 'Record order: service name > remote IP > local IP > port range > protocol',
          control: 'list',
          ascii: true,
          list: {
            maxRows: 128,
            columns: [
              {
                id: 'desc',
                label: 'Service name',
                validate: { maxLength: 30, pattern: '^[^<>\'%]+$', patternHint: "Must not contain < > ' %" },
              },
              {
                id: 'ripaddr',
                label: 'Remote IP (optional)',
                mono: true,
                placeholder: 'IPv6, /prefix allowed',
                validate: { maxLength: 45 },
              },
              { id: 'lipaddr', label: 'Local IP', mono: true, placeholder: 'IPv6 address', validate: { maxLength: 45 } },
              {
                id: 'port',
                label: 'Port range',
                mono: true,
                width: 110,
                validate: { required: true, pattern: MULTI_PORT_PATTERN, patternHint: MULTI_PORT_HINT },
              },
              {
                id: 'proto',
                label: 'Protocol',
                width: 90,
                control: 'select',
                options: [
                  { value: 'TCP', label: 'TCP' },
                  { value: 'UDP', label: 'UDP' },
                  { value: 'BOTH', label: 'BOTH' },
                  // OTHER: the port column carries an IP protocol number (1-255)
                  { value: 'OTHER', label: 'OTHER' },
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

export const firewallPages: SettingsPageDef[] = [
  basicFirewallPage,
  urlFilterPage,
  keywordFilterPage,
  networkServiceFilterPage,
  ipv6FirewallPage,
];
