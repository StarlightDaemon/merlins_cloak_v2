/**
 * Administration category: System (local/remote access + telnet + USB idle +
 * misc + scheduled reboot), Time/NTP, SSH, Security Notifications, Firmware,
 * Backup/Restore.
 *
 * Advanced_System_Content.asp is one large native form covering login/HTTP(S)
 * access, telnet, SSH, time zone, NTP and a grab-bag of misc toggles. It is
 * split here into three focused views over the SAME aspPage ('system',
 * 'system-time', 'ssh') per the category brief. All three therefore share the
 * page's real submit behavior: the form's hidden default
 * action_script="restart_time;restart_httpd;restart_upnp" (action_wait=5) —
 * in practice applyRule() rebuilds action_script dynamically per which fields
 * changed (restart_leds, restart_usb_idle, restart_firewall/restart_upnp,
 * restart_bhblock, restart_chg_swmode, restart_dnsmasq, or a full "reboot"),
 * which a static rcService string cannot reproduce. Per the write-config
 * policy this uses the page's literal static default verbatim for 'system'
 * and 'ssh' (both are really the one native form), and the narrower
 * 'restart_time' for 'system-time' per the category brief's explicit
 * override. None of these action_script tokens touch a hard-excluded
 * restart category (not restart_net_and_phy/restart_net/restart_wireless/
 * restart_wan/restart_dhcpd, and restart_upnp is distinct from
 * restart_firewall) — writeExclusion is null on all three.
 *
 * Main_Security_Change_Notification.asp, Advanced_FirmwareUpgrade_Content.asp
 * and Advanced_SettingBackup_Content.asp were all empirically confirmed to
 * carry NO editable nvram fields at all: the first is a readonly log-file
 * viewer (nvram_dump, not an nvram key), and the latter two are pure
 * action-button pages (restore/save/upload/reboot/backup-JFFS) with
 * action_mode/action_script left blank in their hidden inputs. All three are
 * modeled read-only, consistent with the category brief.
 *
 * Fields intentionally NOT modeled, with reasons:
 *  - http_username / http_passwd: NVRAM-encrypted admin credentials, not
 *    plain nvram values our read/write model can round-trip safely. Changing
 *    them also requires the page's separate md5-hashed change-password flow.
 *  - HTTPS server certificate regeneration/download/clear (le_enable,
 *    casignedcert, save_cert_key()/clear_server_cert_key() etc.): hard
 *    excluded — an admin-UI cert swap risks cutting off the very session
 *    used to test it, same class of risk as http_dut_redir.
 *  - sshd_bfp (brute-force protection): brief expected this field, but no
 *    such nvram key or control exists anywhere in this page's source in
 *    3006.102.7_2 — not modeled.
 *  - usb_idle_exclude (per-drive spin-down exclusion checkboxes a..i): a
 *    9-checkbox bitmask-string encoding, not "trivially present"; skipped.
 *  - AllLED, jffs2_scripts, pwrsave_mode, pagecache_ratio, boostkey_modes,
 *    sw_mode_radio, ncb_enable, btn_ez_radiotoggle, plc_sleep_enabled,
 *    shell_timeout_x (CLI idle timeout), dns_probe/wandog network
 *    monitoring: real fields on the native page but outside this category
 *    brief's explicit field list; several are also niche/platform-gated
 *    (ROG boost key, powerline, DSL) not relevant to RT-BE92U. Not modeled.
 *  - legacy http_client / http_clientlist: the native page's applyRule()
 *    writes these alongside the modern enable_acc_restriction /
 *    restrict_rulelist pair purely for old-firmware compatibility (comments
 *    literally say "for old fw"). Only the modern pair is modeled; the write
 *    path here relies on the modern keys being authoritative on this branch.
 *  - time_zone_dst: present only as a hidden passthrough field on this page
 *    (no visible control sets it here) — not modeled.
 *  - REBOOT_SCHED_V2 (reboot_schedule_type / reboot_schedule_month, monthly
 *    scheduling variant): the page's default V1 weekly scheme
 *    (reboot_schedule, 11 chars: 7 day flags + HHMM) is modeled via
 *    derive/buildFields decomposition, matching the firewall.ts LW_DAY_KEYS
 *    pattern; the newer monthly variant is not.
 */
import type { SettingsPageDef } from '../types';
import { hasFlag } from '../../lib/capabilities';

const yesNo = [
  { value: '1', label: 'Yes' },
  { value: '0', label: 'No' },
];

const PORT_HINT = 'Port 1-65535';

// -----------------------------------------------------------------------
// 'system' — local/remote access, login, access restriction, telnet, USB
// idle, misc, scheduled reboot.
// -----------------------------------------------------------------------

/**
 * restrict_rulelist stored record, confirmed from this page's own addRow()/
 * show_http_clientlist() JS: three '>'-separated fields, in this exact
 * order — [enable(1/0), ip, access_type]. access_type is a checkbox bitmask
 * (1=Web UI, 2=SSH); the telnet bit (4) is present in the decode table but
 * its checkbox is commented out in this firmware's markup, so only 1/2/3 are
 * reachable from the native UI.
 */
const ACCESS_TYPE_OPTIONS = [
  { value: '1', label: 'Web UI' },
  { value: '2', label: 'SSH' },
  { value: '3', label: 'Web UI + SSH' },
];

/**
 * reboot_schedule (V1/weekly, the page's default scheme): 11 chars = 7 day
 * flags (index 0=Sun .. 6=Sat, matching the page's own
 * ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"] iteration order) + 2-digit
 * hour + 2-digit minute. Decomposed the same way firewall.ts decomposes
 * filter_lw_date_x.
 */
const REBOOT_DAY_KEYS = [
  'reboot_day_sun',
  'reboot_day_mon',
  'reboot_day_tue',
  'reboot_day_wed',
  'reboot_day_thu',
  'reboot_day_fri',
  'reboot_day_sat',
] as const;

function pad2(v: string): string {
  const n = Number(v);
  return Number.isFinite(n) ? String(Math.min(99, Math.max(0, Math.trunc(n)))).padStart(2, '0') : '00';
}

function joinRebootSchedule(values: Record<string, string>): string {
  const days = REBOOT_DAY_KEYS.map((k) => (values[k] === '1' ? '1' : '0')).join('');
  return `${days}${pad2(values.reboot_hour ?? '3')}${pad2(values.reboot_min ?? '0')}`;
}

export const systemPage: SettingsPageDef = {
  kind: 'settings',
  id: 'system',
  aspPage: 'Advanced_System_Content.asp',
  title: 'System',
  navGroup: 'admin',
  navSub: 'access',
  navOrder: 65,
  navLabel: 'System',
  confidence: { read: 'live-verified', write: 'unverified-write' },
  writeExclusion: null,
  intro:
    'Login credentials (http_username/http_passwd) and HTTPS certificate management are not modeled here — see the header comment in admin.ts for why.',
  read: {
    nvram: [
      'http_enable',
      'http_lanport',
      'https_lanport',
      'misc_http_x',
      'misc_httpport_x',
      'misc_httpsport_x',
      'captcha_enable',
      'http_autologout',
      'enable_acc_restriction',
      'telnetd_enable',
      'usb_idle_enable',
      'usb_idle_timeout',
      'nat_redirect_enable',
      'reboot_schedule_enable',
      'reboot_schedule',
    ],
    nvramAscii: ['restrict_rulelist'],
    derive: (raw) => {
      const out: Record<string, string> = {};
      const sched = raw.reboot_schedule ?? '';
      REBOOT_DAY_KEYS.forEach((k, i) => {
        out[k] = sched.charAt(i) === '1' ? '1' : '0';
      });
      out.reboot_hour = sched.slice(7, 9) || '03';
      out.reboot_min = sched.slice(9, 11) || '00';
      return out;
    },
  },
  sections: [
    {
      title: 'Local access (HTTP/HTTPS)',
      fields: [
        {
          key: 'http_enable',
          label: 'Authentication method',
          control: 'select',
          options: [
            { value: '0', label: 'HTTP' },
            { value: '1', label: 'HTTPS' },
            { value: '2', label: 'BOTH' },
          ],
        },
        {
          key: 'http_lanport',
          label: 'HTTP LAN port',
          control: 'number',
          validate: { required: true, min: 1, max: 65535 },
          hint: PORT_HINT,
        },
        {
          key: 'https_lanport',
          label: 'HTTPS LAN port',
          control: 'number',
          validate: { required: true, min: 1, max: 65535 },
          hint: `${PORT_HINT}. Changing this moves the admin UI to a new URL immediately.`,
          showIf: (_v, caps) => hasFlag(caps, 'HTTPS_support'),
        },
      ],
    },
    {
      title: 'Remote access (WAN)',
      fields: [
        {
          key: 'misc_http_x',
          label: 'Allow web access from WAN',
          hint: 'Exposes the admin UI to the WAN interface on the port(s) below.',
          control: 'radio',
          options: yesNo,
        },
        {
          key: 'misc_httpport_x',
          label: 'WAN HTTP port',
          control: 'number',
          validate: { min: 1, max: 65535 },
          hint: PORT_HINT,
          showIf: (v) => v.misc_http_x === '1',
        },
        {
          key: 'misc_httpsport_x',
          label: 'WAN HTTPS port',
          control: 'number',
          validate: { min: 1024, max: 65535 },
          hint: 'Port 1024-65535',
          showIf: (v, caps) => v.misc_http_x === '1' && hasFlag(caps, 'HTTPS_support'),
        },
      ],
    },
    {
      title: 'Login',
      fields: [
        {
          key: 'captcha_enable',
          label: 'Enable login captcha',
          control: 'radio',
          options: yesNo,
          showIf: (_v, caps) => hasFlag(caps, 'captcha_support'),
        },
        {
          key: 'http_autologout',
          label: 'Auto-logout after idle',
          hint: '0 disables auto-logout; otherwise 10-999 minutes',
          control: 'number',
          validate: { min: 0, max: 999 },
        },
      ],
    },
    {
      title: 'Access restriction',
      note:
        'Restrict admin-UI/SSH access to specific LAN client IPs. Writes the modern enable_acc_restriction/restrict_rulelist pair; the legacy http_client/http_clientlist mirror the native page also writes for old-firmware compatibility is not replicated (see admin.ts header).',
      fields: [
        {
          key: 'enable_acc_restriction',
          label: 'Restrict access to specified IPs only',
          control: 'radio',
          options: yesNo,
        },
        {
          key: 'restrict_rulelist',
          label: 'Allowed clients',
          control: 'list',
          ascii: true,
          list: {
            maxRows: 4,
            columns: [
              {
                id: 'enable',
                label: 'On',
                width: 70,
                control: 'select',
                options: yesNo,
              },
              {
                id: 'ip',
                label: 'IP address',
                mono: true,
                validate: { required: true, pattern: '^(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})$', patternHint: 'IPv4 address, e.g. 192.168.1.1' },
              },
              {
                id: 'access',
                label: 'Access',
                width: 120,
                control: 'select',
                options: ACCESS_TYPE_OPTIONS,
              },
            ],
          },
        },
      ],
    },
    {
      title: 'Telnet',
      fields: [
        {
          key: 'telnetd_enable',
          label: 'Enable telnet',
          hint:
            "This firmware's own native UI unconditionally hides and disables this control on every current-gen model (the row is force-hidden in Advanced_System_Content.asp's initial() regardless of platform) — toggling it here is off the native UI's beaten path.",
          control: 'radio',
          options: yesNo,
        },
      ],
    },
    {
      title: 'USB setting',
      showIf: (_v, caps) => hasFlag(caps, 'hdspindown_support'),
      fields: [
        {
          key: 'usb_idle_enable',
          label: 'HDD hibernation (spin-down)',
          control: 'select',
          options: [
            { value: '0', label: 'No' },
            { value: '1', label: 'Yes' },
          ],
        },
        {
          key: 'usb_idle_timeout',
          label: 'Idle time before spin-down',
          hint: 'Seconds, 60-9999 (factory default 300)',
          control: 'number',
          validate: { min: 60, max: 9999 },
          showIf: (v) => v.usb_idle_enable === '1',
        },
      ],
    },
    {
      title: 'Miscellaneous',
      fields: [{ key: 'nat_redirect_enable', label: 'NAT redirection notice', control: 'radio', options: yesNo }],
    },
    {
      title: 'Scheduled reboot',
      showIf: (_v, caps) => hasFlag(caps, 'reboot_schedule_support'),
      fields: [
        { key: 'reboot_schedule_enable', label: 'Enable scheduled reboot', control: 'radio', options: yesNo },
        { key: 'reboot_day_sun', label: 'Sunday', control: 'toggle', showIf: (v) => v.reboot_schedule_enable === '1' },
        { key: 'reboot_day_mon', label: 'Monday', control: 'toggle', showIf: (v) => v.reboot_schedule_enable === '1' },
        { key: 'reboot_day_tue', label: 'Tuesday', control: 'toggle', showIf: (v) => v.reboot_schedule_enable === '1' },
        { key: 'reboot_day_wed', label: 'Wednesday', control: 'toggle', showIf: (v) => v.reboot_schedule_enable === '1' },
        { key: 'reboot_day_thu', label: 'Thursday', control: 'toggle', showIf: (v) => v.reboot_schedule_enable === '1' },
        { key: 'reboot_day_fri', label: 'Friday', control: 'toggle', showIf: (v) => v.reboot_schedule_enable === '1' },
        { key: 'reboot_day_sat', label: 'Saturday', control: 'toggle', showIf: (v) => v.reboot_schedule_enable === '1' },
        {
          key: 'reboot_hour',
          label: 'Time: hour',
          control: 'number',
          validate: { min: 0, max: 23 },
          showIf: (v) => v.reboot_schedule_enable === '1',
        },
        {
          key: 'reboot_min',
          label: 'Time: minute',
          control: 'number',
          validate: { min: 0, max: 59 },
          showIf: (v) => v.reboot_schedule_enable === '1',
        },
      ],
    },
  ],
  write: {
    endpoint: 'applyapp',
    // Page's static default action_script (hidden field), used verbatim
    // per the write-config policy — see header comment for the caveat about
    // applyRule()'s dynamic reconstruction of this value.
    rcService: 'restart_time;restart_httpd;restart_upnp',
    actionWait: 5,
    buildFields: (changed, all) => {
      const fields: Record<string, string> = {};
      let schedTouched = false;
      for (const [k, v] of Object.entries(changed)) {
        if ((REBOOT_DAY_KEYS as readonly string[]).includes(k) || k === 'reboot_hour' || k === 'reboot_min') {
          schedTouched = true;
        } else {
          fields[k] = v;
        }
      }
      if (schedTouched) fields.reboot_schedule = joinRebootSchedule(all);
      return fields;
    },
    buildVerify: (changed, all) => {
      const expect: Record<string, string> = {};
      for (const [k, v] of Object.entries(changed)) {
        if ((REBOOT_DAY_KEYS as readonly string[]).includes(k) || k === 'reboot_hour' || k === 'reboot_min') {
          expect.reboot_schedule = joinRebootSchedule(all);
        } else {
          expect[k] = v;
        }
      }
      return expect;
    },
  },
};

// -----------------------------------------------------------------------
// 'system-time' — time zone + NTP.
// -----------------------------------------------------------------------

/**
 * Curated subset of Advanced_System_Content.asp's ~90-entry `timezones[]`
 * array. Codes are copied verbatim from the source (these are the literal
 * nvram time_zone values the firmware understands); English labels are
 * original renderings, since the source only carries locale placeholders
 * (<#TZxx#>) — no language pack is present in this static source tree. Any
 * zone not listed here still round-trips safely: the renderer's Select
 * shows an unknown current value as "(current: <value>)" and leaves it
 * untouched unless the operator picks something from the list.
 */
const TIME_ZONE_OPTIONS = [
  { value: 'UTC12', label: '(GMT-12:00) International Date Line West' },
  { value: 'UTC10', label: '(GMT-10:00) Hawaii' },
  { value: 'NAST9DST', label: '(GMT-09:00) Alaska' },
  { value: 'PST8DST', label: '(GMT-08:00) Pacific Time (US & Canada)' },
  { value: 'MST7DST_1', label: '(GMT-07:00) Mountain Time (US & Canada)' },
  { value: 'MST7_2', label: '(GMT-07:00) Arizona' },
  { value: 'CST6_3', label: '(GMT-06:00) Central Time (US & Canada)' },
  { value: 'EST5DST', label: '(GMT-05:00) Eastern Time (US & Canada)' },
  { value: 'AST4DST', label: '(GMT-04:00) Atlantic Time (Canada)' },
  { value: 'UTC3', label: '(GMT-03:00) Buenos Aires, Georgetown' },
  { value: 'UTC2', label: '(GMT-02:00) Mid-Atlantic' },
  { value: 'GMT0', label: '(GMT+00:00) Dublin, Edinburgh, Lisbon, London' },
  { value: 'MET-1DST', label: '(GMT+01:00) Amsterdam, Berlin, Paris, Rome' },
  { value: 'EET-2DST', label: '(GMT+02:00) Athens, Bucharest, Cairo, Helsinki' },
  { value: 'UTC-3_1', label: '(GMT+03:00) Moscow, Kuwait, Riyadh' },
  { value: 'UTC-5', label: '(GMT+05:00) Islamabad, Karachi, Tashkent' },
  { value: 'UTC-5.30', label: '(GMT+05:30) Chennai, Kolkata, Mumbai, New Delhi' },
  { value: 'UTC-6', label: '(GMT+06:00) Astana, Dhaka' },
  { value: 'UTC-7', label: '(GMT+07:00) Bangkok, Hanoi, Jakarta' },
  { value: 'CST-8', label: '(GMT+08:00) Beijing, Chongqing, Hong Kong, Urumqi' },
  { value: 'JST-9', label: '(GMT+09:00) Osaka, Sapporo, Tokyo' },
  { value: 'CST-9.30', label: '(GMT+09:30) Adelaide, Darwin' },
  { value: 'UTC-10DST_1', label: '(GMT+10:00) Canberra, Melbourne, Sydney' },
  { value: 'NZST-12DST', label: '(GMT+12:00) Auckland, Wellington' },
];

export const systemTimePage: SettingsPageDef = {
  kind: 'settings',
  id: 'system-time',
  aspPage: 'Advanced_System_Content.asp',
  title: 'Time / NTP',
  navGroup: 'admin',
  navSub: 'system',
  navOrder: 67,
  navLabel: 'Time / NTP',
  confidence: { read: 'live-verified', write: 'unverified-write' },
  writeExclusion: null,
  read: {
    nvram: ['time_zone', 'ntp_server0', 'ntp_server1', 'ntpd_enable', 'ntpd_server_redir'],
  },
  sections: [
    {
      title: 'Time zone',
      fields: [{ key: 'time_zone', label: 'Time zone', control: 'select', options: TIME_ZONE_OPTIONS }],
    },
    {
      title: 'NTP server',
      fields: [
        { key: 'ntp_server0', label: 'NTP server', control: 'text', validate: { maxLength: 255 } },
        { key: 'ntp_server1', label: 'Secondary NTP server', hint: 'Merlin addition', control: 'text', validate: { maxLength: 255 } },
      ],
    },
    {
      title: 'Local NTP server',
      note: 'Merlin addition: runs a local ntpd instance LAN clients can sync against.',
      showIf: (_v, caps) => hasFlag(caps, 'ntpd_support'),
      fields: [
        { key: 'ntpd_enable', label: 'Enable local NTP server', control: 'radio', options: yesNo },
        {
          key: 'ntpd_server_redir',
          label: 'Intercept NTP client requests',
          hint: 'Redirects LAN NTP traffic to the local server regardless of the client-configured NTP host.',
          control: 'radio',
          options: yesNo,
          showIf: (v) => v.ntpd_enable === '1',
        },
      ],
    },
  ],
  write: {
    endpoint: 'applyapp',
    rcService: 'restart_time',
    actionWait: 5,
  },
};

// -----------------------------------------------------------------------
// 'ssh' — Merlin dropbear config (same native page).
// -----------------------------------------------------------------------

export const sshPage: SettingsPageDef = {
  kind: 'settings',
  id: 'ssh',
  aspPage: 'Advanced_System_Content.asp',
  title: 'SSH',
  navGroup: 'admin',
  navSub: 'access',
  navOrder: 66,
  navLabel: 'SSH',
  merlinOnly: true,
  gate: (c) => hasFlag(c, 'ssh_support'),
  confidence: { read: 'live-verified', write: 'unverified-write' },
  writeExclusion: null,
  read: {
    nvram: ['sshd_enable', 'sshd_forwarding', 'sshd_port', 'sshd_pass', 'sshd_authkeys'],
  },
  sections: [
    {
      fields: [
        {
          key: 'sshd_enable',
          label: 'Enable SSH',
          control: 'select',
          options: [
            { value: '0', label: 'No' },
            { value: '2', label: 'LAN only' },
            { value: '1', label: 'LAN & WAN' },
          ],
        },
        {
          key: 'sshd_forwarding',
          label: 'Allow SSH port forwarding',
          hint:
            'Hard-excluded from live testing per the operator scoping: SSH tunnel/port forwarding is on the same hard-exclusion list as HTTPS cert regen and UPnP pinholes (see tools-tweaks.ts http_dut_redir for the general wording). Write path is implemented but never live-submitted.',
          control: 'radio',
          options: yesNo,
          showIf: (v) => v.sshd_enable !== '0',
        },
        {
          key: 'sshd_port',
          label: 'SSH port',
          control: 'number',
          validate: { required: true, min: 1, max: 65535 },
          hint: PORT_HINT,
          showIf: (v) => v.sshd_enable !== '0',
        },
        {
          key: 'sshd_pass',
          label: 'Allow password login',
          hint: 'If disabled, at least one authorized key below is required.',
          control: 'radio',
          options: yesNo,
          showIf: (v) => v.sshd_enable !== '0',
        },
        {
          key: 'sshd_authkeys',
          label: 'Authorized keys',
          hint: 'One public key per line. Maximum 2999 characters.',
          control: 'textarea',
          validate: { maxLength: 2999 },
          showIf: (v) => v.sshd_enable !== '0',
        },
      ],
    },
  ],
  write: {
    endpoint: 'applyapp',
    // Same native form as 'system'/'system-time' — see file header for why
    // this reuses the page's static default rather than an invented
    // restart_sshd (no such token appears in this page's JS; dropbear's
    // config pickup is not something the client script special-cases here).
    rcService: 'restart_time;restart_httpd;restart_upnp',
    actionWait: 5,
  },
};

// -----------------------------------------------------------------------
// 'security-notification' — Main_Security_Change_Notification.asp.
// -----------------------------------------------------------------------

/**
 * Empirically this page has NO nvram fields at all: its one piece of content
 * is a readonly <textarea> filled by `nvram_dump("security_recored.log","")`
 * — a raw log-file dump, not an nvram key our nvram_get/nvram_char_to_ascii
 * read primitives can address — plus a client-side "Refresh" button that
 * just reloads the page. The form's action_mode/action_wait/action_script
 * hidden inputs are all empty; there is no apply/submit path whatsoever.
 * Modeled as an intro-only informational page with no fields and no write
 * block, rather than inventing webs_update_*-style fields the page does not
 * actually expose.
 */
export const securityNotificationPage: SettingsPageDef = {
  kind: 'settings',
  id: 'security-notification',
  aspPage: 'Main_Security_Change_Notification.asp',
  title: 'Security Notifications',
  navGroup: 'admin',
  navSub: 'maintenance',
  navOrder: 71,
  navLabel: 'Security Notifications',
  merlinOnly: true,
  confidence: { read: 'live-verified' },
  intro:
    'The native page is a readonly viewer for security_recored.log (firmware/package security update history) with a "Refresh" button. It carries no editable nvram fields and no apply path, and its log content is a raw file dump rather than an nvram key — not readable through this build\'s nvram-only read primitives, so it is not reproduced here.',
  read: {},
  sections: [],
};

// -----------------------------------------------------------------------
// 'firmware' — Advanced_FirmwareUpgrade_Content.asp, read-only.
// -----------------------------------------------------------------------

export const firmwarePage: SettingsPageDef = {
  kind: 'settings',
  id: 'firmware',
  aspPage: 'Advanced_FirmwareUpgrade_Content.asp',
  title: 'Firmware',
  navGroup: 'admin',
  navSub: 'maintenance',
  navOrder: 69,
  navLabel: 'Firmware',
  confidence: { read: 'live-verified' },
  writeExclusion: 'firmware-reboot-reset',
  intro:
    'Firmware check/download/upgrade (and AiMesh node upgrade, and Merlin\'s manual .zip upload) are deliberately not implemented in this build — they apply via reboot/flash and are excluded from live testing by the operator\'s scoping. This view is read-only: current version and last update-check status only.',
  read: {
    nvram: ['firmver', 'buildno', 'extendno', 'webs_state_info', 'webs_state_flag'],
    derive: (raw) => {
      const digits = (raw.firmver ?? '').replace(/\./g, '');
      let display = `${digits}.${raw.buildno ?? ''}`;
      if (raw.extendno && raw.extendno !== '0') display += `_${raw.extendno}`;
      return { firmware_display: display };
    },
  },
  sections: [
    {
      title: 'Current firmware',
      fields: [
        { key: 'firmware_display', label: 'Version', control: 'readonly' },
        { key: 'firmver', label: 'firmver', control: 'readonly' },
        { key: 'buildno', label: 'buildno', control: 'readonly' },
        { key: 'extendno', label: 'extendno', control: 'readonly' },
      ],
    },
    {
      title: 'Last update check',
      fields: [
        {
          key: 'webs_state_info',
          label: 'Latest version found',
          hint: 'Version string from the last completed online update check; empty if none has run.',
          control: 'readonly',
        },
        {
          key: 'webs_state_flag',
          label: 'Update check result',
          hint: '0 = up to date; 1 or 2 = a newer firmware was found on the last check.',
          control: 'readonly',
        },
      ],
    },
  ],
};

// -----------------------------------------------------------------------
// 'backup' — Advanced_SettingBackup_Content.asp, read-only.
// -----------------------------------------------------------------------

export const backupPage: SettingsPageDef = {
  kind: 'settings',
  id: 'backup',
  aspPage: 'Advanced_SettingBackup_Content.asp',
  title: 'Backup / Restore',
  navGroup: 'admin',
  navSub: 'maintenance',
  navOrder: 70,
  navLabel: 'Backup / Restore',
  confidence: { read: 'live-verified' },
  writeExclusion: 'firmware-reboot-reset',
  intro:
    'Restore to factory default, save/upload a .CFG settings file, and backup/restore the JFFS custom-scripts partition are all button/file-upload actions on the native page (upload.cgi / apply.cgi action_mode=Restore), not plain nvram writes, and apply via reboot — excluded from this build per the operator\'s scoping. Use the router\'s native Administration > Restore/Save/Upload page for these actions.',
  read: {
    nvram: ['jffs2_on'],
  },
  sections: [
    {
      title: 'JFFS partition',
      note:
        'Merlin\'s JFFS custom-scripts partition (mounted at /jffs) holds anything saved outside the plain nvram settings this UI edits — user scripts, some addon config, and the Backup JFFS Partition download the native page offers when this is mounted. It is not covered by nvram backup/restore.',
      fields: [
        {
          key: 'jffs2_on',
          label: 'JFFS partition mounted',
          hint: 'When off, the native page also hides its JFFS backup/restore controls.',
          control: 'readonly',
        },
      ],
    },
  ],
};

export const adminPages: SettingsPageDef[] = [
  systemPage,
  systemTimePage,
  sshPage,
  securityNotificationPage,
  firmwarePage,
  backupPage,
];
