/**
 * IPSec VPN Server (Advanced_VPN_IPSec.asp). No RT-BE92U sysdep overlay
 * exists for this page; extracted from the www/ root source (RAW/merlin).
 *
 * Enable field verification (per task): this page has exactly ONE server
 * enable field, the plain nvram key `ipsec_server_enable` (bound to the
 * page's top iphone-switch and posted as a same-named hidden input). The
 * other flag the task asked to verify, `ipsec_ig_enable`, does NOT appear
 * anywhere in Advanced_VPN_IPSec.asp — it belongs to a wholly separate
 * feature/page, Advanced_Instant_Guard.asp ("Instant Guard"), which reuses
 * the IPSec daemon but has its own independent enable toggle and is out of
 * scope for this page.
 *
 * ipsec_profile_1 is a single 38-field '>'-joined string that stores nearly
 * everything: preshared key, virtual client subnet, DPD settings, and the
 * DNS/WINS push list, interleaved with ~30 fields the native page never lets
 * the user touch (it always writes fixed literals like "Host-to-Net",
 * "null", "eap-md5", "500", "4500" into them — see applyRule()'s
 * `profile_array` literal in the .asp source, and the byte-identical
 * snprintf skeleton server-side in httpd/web.c do_set_ipsec_profile_cgi()
 * ~L18498). Position numbering below is taken verbatim from web.c
 * do_get_ipsec_profile_cgi()'s vstrsep() field list (~L18339-18367), which
 * independently confirms every offset the .asp JS also uses. Only the five
 * user-editable positions are decomposed into virtual fields; every other
 * position is read back from the currently-stored profile and written back
 * unchanged (derive/buildFields pattern, positions documented below).
 *
 * ipsec_profile_2 (the IKEv2 profile string) is NOT modeled or written here.
 * Both known native write paths regenerate it wholesale from scratch on
 * every save while enabling — never incrementally edited — using a fixed
 * skeleton plus a cert "remote_id" the C helper get_ipsec_remote_id()
 * computes from ddns_hostname_x / the active WAN's IP (logic not
 * independently reproduced here). There is no user-editable content in it
 * beyond the same virtual_subnet already captured from ipsec_profile_1.
 * Net effect: enabling the server through THIS page does not (re)generate
 * ipsec_profile_2 the way the native page always does on every Apply click —
 * a real functional gap versus the native page, flagged here rather than
 * silently guessed at.
 *
 * ipsec_client_list_1 / ipsec_client_list_2 (per-user accounts) are two
 * plain nvram keys — both real router_defaults entries, both applyapp-write
 * compatible — sharded by IKE version membership rather than by index: a
 * user allowed under IKEv1 has a record in _1, under IKEv2 in _2, under both
 * in both. Record format `<username>password` confirmed authoritative from
 * httpd/web.c do_get/do_set_ipsec_clientlist_cgi() (foreach_60 = split on
 * '<', vstrsep on '>'). Merged into one editable view here (username,
 * password, ike-version) exactly reproducing that C code's merge/split bit
 * logic (ver&1 -> list 1, ver&2 -> list 2), the same transform the native
 * page's own applyRule()/showipsec_clientlist() perform client-side.
 *
 * Local public interface (position 4, dual-WAN selector) has a real
 * <select> in the DOM, but its containing <tr id="tr_localPublicInterface">
 * carries a hardcoded style="display:none" with nothing in the source that
 * ever un-hides it — dead/vestigial UI on this firmware. Preserved-not-edited
 * here (byte-identical passthrough) rather than exposed as a field, matching
 * what a real administrator can actually reach on this page.
 *
 * This router's 'vpn' hard exclusion applies: write path fully implemented,
 * never live-submitted this session.
 */
import type { SettingsPageDef } from '../types';
import { hasFlag } from '../../lib/capabilities';

const IP_PATTERN = '^(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})$';
const IP_HINT = 'IPv4 address, e.g. 192.168.1.1';
const yesNo = [
  { value: '1', label: 'Yes' },
  { value: '0', label: 'No' },
];

// ---------------------------------------------------------------------------
// ipsec_profile_1 decomposition
// ---------------------------------------------------------------------------

/**
 * Fixed skeleton for a brand-new profile (nvram default is "" until the page
 * is saved once). Byte-identical to both applyRule()'s profile_array literal
 * and web.c do_set_ipsec_profile_cgi()'s snprintf skeleton. Index = field
 * position; the 5 user-editable positions (7, 14, 30, 31, 36) hold their
 * native default here and are overwritten by buildProfile1() below.
 */
const PROFILE1_SKELETON = [
  '4', 'Host-to-Net', 'null', 'null', 'wan', '', '1', '', // 0-7
  'null', 'null', 'null', 'null', 'null', '1', '', 'null', // 8-15
  '1', 'null', 'null', '0', 'null', 'null', 'null', '1', // 16-23
  '', '', 'eap-md5', '1', '500', '4500', '10', '1', // 24-31
  'null', 'null', 'null', 'null', '<<<<', '1', // 32-37
];

const P1_AUTH_KEY = 7; // preshared key
const P1_VIRTUAL_SUBNET = 14; // client IP pool prefix, e.g. "10.10.10"
const P1_DPD_INTERVAL = 30;
const P1_DPD_ENABLE = 31;
const P1_SAMBA = 36; // "<dns1<dns2<wins1<wins2"
const P1_ACTIVATE = 37;

function parseProfile1(raw: string): string[] {
  const out = raw ? raw.split('>') : [];
  while (out.length < PROFILE1_SKELETON.length) out.push(PROFILE1_SKELETON[out.length]);
  return out;
}

function parseSamba(seg: string): { dns1: string; dns2: string; wins1: string; wins2: string } {
  const c = (seg ?? '').split('<');
  return { dns1: c[1] ?? '', dns2: c[2] ?? '', wins1: c[3] ?? '', wins2: c[4] ?? '' };
}

function buildSamba(dns1: string, dns2: string, wins1: string, wins2: string): string {
  return `<${dns1}<${dns2}<${wins1}<${wins2}`;
}

function buildProfile1(all: Record<string, string>): string {
  const parts = parseProfile1(all.ipsec_profile_1 ?? '');
  parts[P1_AUTH_KEY] = all.ipsec_preshared_key ?? '';
  parts[P1_VIRTUAL_SUBNET] = all.ipsec_clients_start ?? '';
  parts[P1_DPD_INTERVAL] = all.ipsec_dpd ?? '10';
  parts[P1_DPD_ENABLE] = all.ipsec_dead_peer_detection ?? '1';
  parts[P1_SAMBA] = buildSamba(all.ipsec_dns1 ?? '', all.ipsec_dns2 ?? '', all.ipsec_wins1 ?? '', all.ipsec_wins2 ?? '');
  parts[P1_ACTIVATE] = '1'; // both known native write paths force this whenever the profile is saved
  return parts.join('>');
}

const PROFILE1_VIEW_KEYS = new Set([
  'ipsec_preshared_key',
  'ipsec_clients_start',
  'ipsec_dpd',
  'ipsec_dead_peer_detection',
  'ipsec_dns1',
  'ipsec_dns2',
  'ipsec_wins1',
  'ipsec_wins2',
]);

// ---------------------------------------------------------------------------
// Client account list (ipsec_client_list_1 / ipsec_client_list_2)
// ---------------------------------------------------------------------------

function parseClientRecords(stored: string): Map<string, string> {
  const map = new Map<string, string>();
  (stored ?? '')
    .split('<')
    .filter((rec) => rec !== '')
    .forEach((rec) => {
      const c = rec.split('>');
      map.set(c[0] ?? '', c[1] ?? '');
    });
  return map;
}

/** Merge the two version-sharded lists into one `<user>pass>ver` view (ver: 1=IKEv1, 2=IKEv2, 3=both). */
function mergeClientLists(list1: string, list2: string): string {
  const v1 = parseClientRecords(list1);
  const v2 = parseClientRecords(list2);
  const seen = new Set<string>();
  let out = '';
  for (const username of [...v1.keys(), ...v2.keys()]) {
    if (seen.has(username)) continue;
    seen.add(username);
    const inV1 = v1.has(username);
    const inV2 = v2.has(username);
    const password = inV1 ? (v1.get(username) ?? '') : (v2.get(username) ?? '');
    const ver = inV1 && inV2 ? '3' : inV2 ? '2' : '1';
    out += `<${username}>${password}>${ver}`;
  }
  return out;
}

/** Inverse of mergeClientLists — reproduces applyRule()'s ver&1/ver&2 bit split. */
function splitClientListView(view: string): { list1: string; list2: string } {
  let list1 = '';
  let list2 = '';
  (view ?? '')
    .split('<')
    .filter((rec) => rec !== '')
    .forEach((rec) => {
      const c = rec.split('>');
      const username = c[0] ?? '';
      const password = c[1] ?? '';
      const ver = Number(c[2]) || 0;
      const chunk = `<${username}>${password}`;
      if (ver & 1) list1 += chunk;
      if (ver & 2) list2 += chunk;
    });
  return { list1, list2 };
}

export const ipsecServerPage: SettingsPageDef = {
  kind: 'settings',
  id: 'ipsec-server',
  aspPage: 'Advanced_VPN_IPSec.asp',
  title: 'IPSec VPN Server',
  navGroup: 'vpn',
  navSub: 'incoming',
  navOrder: 41,
  navLabel: 'IPSec VPN Server',
  gate: (c) => hasFlag(c, 'ipsec_srv_support'),
  confidence: { read: 'structural', write: 'unverified-write' },
  writeExclusion: 'vpn',
  intro:
    'There is no separate IKEv1/IKEv2 enable toggle — one switch (ipsec_server_enable) turns the server on; which IKE version a given account may use is set per-account in the user list below. The IKEv2 certificate profile (ipsec_profile_2) is regenerated wholesale by the native page on every save and is not reproduced here — see file header for why. The dual-WAN "local interface" selector exists in the native form but its row is permanently hidden (dead UI) and is preserved unedited rather than exposed. Client passwords are stored in nvram as plain text — native firmware behavior, not introduced by this tool.',
  read: {
    nvram: ['ipsec_server_enable', 'ipsec_block_intranet', 'ipsec_profile_1'],
    nvramAscii: ['ipsec_client_list_1', 'ipsec_client_list_2'],
    derive: (raw) => {
      const parts = parseProfile1(raw.ipsec_profile_1 ?? '');
      const samba = parseSamba(parts[P1_SAMBA]);
      return {
        ipsec_preshared_key: parts[P1_AUTH_KEY] ?? '',
        ipsec_clients_start: parts[P1_VIRTUAL_SUBNET] ?? '',
        ipsec_dpd: parts[P1_DPD_INTERVAL] || '10',
        ipsec_dead_peer_detection: parts[P1_DPD_ENABLE] || '1',
        ipsec_dns1: samba.dns1,
        ipsec_dns2: samba.dns2,
        ipsec_wins1: samba.wins1,
        ipsec_wins2: samba.wins2,
        ipsec_client_list_view: mergeClientLists(raw.ipsec_client_list_1 ?? '', raw.ipsec_client_list_2 ?? ''),
      };
    },
  },
  sections: [
    {
      title: 'Basic settings',
      fields: [{ key: 'ipsec_server_enable', label: 'Enable IPSec VPN server', control: 'radio', options: yesNo }],
    },
    {
      title: 'Server settings',
      showIf: (v) => v.ipsec_server_enable === '1',
      fields: [
        {
          key: 'ipsec_preshared_key',
          label: 'Pre-shared key',
          control: 'password',
          validate: {
            required: true,
            maxLength: 32,
            pattern: '^[^<>&"]*$',
            patternHint: 'Must not contain < > & or " (and cannot literally be the word null)',
          },
        },
        {
          key: 'ipsec_block_intranet',
          label: 'Client access',
          hint: 'Shared setting: applies to both IPSec VPN and Instant Guard.',
          control: 'radio',
          options: [
            { value: '0', label: 'LAN & Internet' },
            { value: '1', label: 'Internet only' },
          ],
        },
        {
          key: 'ipsec_clients_start',
          label: 'Client IP pool prefix',
          hint: 'First three octets only — clients are assigned .1 through .254, e.g. 10.10.10',
          control: 'text',
          validate: {
            required: true,
            maxLength: 11,
            pattern: '^(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})$',
            patternHint: 'Three octets, e.g. 10.10.10',
          },
        },
        { key: 'ipsec_dns1', label: 'DNS server 1 (pushed to clients)', control: 'text', validate: { maxLength: 15, pattern: IP_PATTERN, patternHint: IP_HINT } },
        { key: 'ipsec_dns2', label: 'DNS server 2 (pushed to clients)', control: 'text', validate: { maxLength: 15, pattern: IP_PATTERN, patternHint: IP_HINT } },
        { key: 'ipsec_wins1', label: 'WINS server 1 (pushed to clients)', control: 'text', validate: { maxLength: 15, pattern: IP_PATTERN, patternHint: IP_HINT } },
        { key: 'ipsec_wins2', label: 'WINS server 2 (pushed to clients)', control: 'text', validate: { maxLength: 15, pattern: IP_PATTERN, patternHint: IP_HINT } },
      ],
    },
    {
      title: 'IKEv1 dead peer detection',
      showIf: (v) => v.ipsec_server_enable === '1',
      fields: [
        {
          key: 'ipsec_dead_peer_detection',
          label: 'Dead peer detection',
          control: 'radio',
          options: [
            { value: '1', label: 'Enable' },
            { value: '0', label: 'Disable' },
          ],
        },
        {
          key: 'ipsec_dpd',
          label: 'DPD checking interval',
          hint: 'Seconds',
          control: 'number',
          validate: { required: true, min: 10, max: 900 },
          showIf: (v) => v.ipsec_dead_peer_detection === '1',
        },
      ],
    },
    {
      title: 'Client accounts',
      showIf: (v) => v.ipsec_server_enable === '1',
      note: 'Up to 8 username/password accounts. IKE version selects which key exchange the account may use (stored across two sharded nvram keys, ipsec_client_list_1 for IKEv1 members and ipsec_client_list_2 for IKEv2 members). The native page also requires passwords to be 5-32 characters; not separately enforced here.',
      fields: [
        {
          key: 'ipsec_client_list_view',
          label: 'IPSec users',
          control: 'list',
          ascii: true,
          list: {
            maxRows: 8,
            columns: [
              {
                id: 'username',
                label: 'Username',
                validate: {
                  required: true,
                  maxLength: 32,
                  pattern: '^[^ @*+|:?<>,./;\\[\\]\\\\="&]+$',
                  patternHint: 'Must not contain space @ * + | : ? < > , . / ; [ ] \\ = " &',
                },
              },
              {
                id: 'password',
                label: 'Password',
                validate: { required: true, maxLength: 32, pattern: '^[^<>&"]+$', patternHint: 'Must not contain < > & "' },
              },
              {
                id: 'ver',
                label: 'IKE version',
                width: 130,
                control: 'select',
                options: [
                  { value: '1', label: 'IKEv1 only' },
                  { value: '2', label: 'IKEv2 only' },
                  { value: '3', label: 'IKEv1 & IKEv2' },
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
    // Native action_script branches ipsec_start (enabling) vs ipsec_stop
    // (disabling); this static WriteDef can't express that branch the way
    // the page's inline JS does. Per source, rcService is the verbatim
    // "(re)configure" token — ipsec_start. Disabling via this page still
    // correctly flips the plain nvram key ipsec_server_enable to "0", but
    // the rc directive we send restarts rather than stops the daemon.
    rcService: 'ipsec_start',
    actionWait: 5,
    buildFields: (changed, all) => {
      const fields: Record<string, string> = {};
      let profileTouched = false;
      for (const [k, v] of Object.entries(changed)) {
        if (PROFILE1_VIEW_KEYS.has(k)) profileTouched = true;
        else if (k === 'ipsec_client_list_view') {
          const s = splitClientListView(v);
          fields.ipsec_client_list_1 = s.list1;
          fields.ipsec_client_list_2 = s.list2;
        } else fields[k] = v;
      }
      if (profileTouched) fields.ipsec_profile_1 = buildProfile1(all);
      return fields;
    },
    buildVerify: (changed, all) => {
      const expect: Record<string, string> = {};
      let profileTouched = false;
      for (const [k, v] of Object.entries(changed)) {
        if (PROFILE1_VIEW_KEYS.has(k)) profileTouched = true;
        else if (k === 'ipsec_client_list_view') {
          const s = splitClientListView(v);
          expect.ipsec_client_list_1 = s.list1;
          expect.ipsec_client_list_2 = s.list2;
        } else expect[k] = v;
      }
      if (profileTouched) expect.ipsec_profile_1 = buildProfile1(all);
      return expect;
    },
  },
};

export const ipsecPages: SettingsPageDef[] = [ipsecServerPage];
