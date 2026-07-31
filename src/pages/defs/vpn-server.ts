/**
 * VPN Server category: OpenVPN Server, WireGuard Server, PPTP VPN Server.
 * Field sets, validation bounds, list encodings, and action_script values
 * extracted from the corresponding pages in the Merlin 3006.102.7_2 www/
 * source (RAW/merlin). No RT-BE92U sysdep overlay exists for any of them.
 *
 * All three pages fall under the operator's 'vpn' hard exclusion: write
 * paths are fully implemented, never live-submitted this session.
 *
 * httpd write-path notes (from httpd/web.c, read-only reference, not part of
 * this repo's runtime):
 *  - OpenVPN server: validate_instance() has a dedicated "vpn_server_" loop
 *    (web.c ~4047) that scans CGI-posted keys for every unit prefix
 *    (vpn_server1_*, vpn_server2_*) independent of any vpn_server_unit field
 *    — i.e. fully-prefixed vpn_server{p}_xxx keys write directly, matching
 *    the wl0_/vpn_client1_ convention this project already relies on.
 *  - WireGuard server: no equivalent per-unit scan branch was found for
 *    wgs_/wgsc_ inside validate_instance(); the native page instead relies on
 *    an unindexed "working copy" (wgs_enable etc, copied to/from wgs1_* by a
 *    separate chg_wgs_unit action when switching instances) that gets
 *    redirected to wgs{unit}_* only inside validate_apply's main loop, which
 *    requires a companion wgs_unit field in the SAME post. Since this router
 *    only ever has one WireGuard server instance (wgs1_, the unit selector
 *    is hardcoded to a single option "1" in the native page), fields here
 *    are read directly against the literal wgs1_ keys with no instance
 *    selector, matching native's read behavior. Confirmed (D-007/D-008 in
 *    DECISIONS.md) that a plain nvram_set-style direct write to wgs1_* keys
 *    is NOT honored by validate_apply — the table-driven write path never
 *    reads an unmatched posted key at all, so such writes silently never
 *    reached nvram. Fixed: the write path now posts the unindexed wgs_*
 *    fields plus a leading wgs_unit=1, matching native's actual posting
 *    pattern (wireguardServerPage.write.buildFields below).
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
// OpenVPN Server (Advanced_VPN_OpenVPN.asp)
// ---------------------------------------------------------------------------

/**
 * The "enable" toggle for a given server instance is NOT a per-instance
 * nvram flag. It is membership of the instance digit in the single flat key
 * vpn_serverx_start (comma-joined, trailing comma per entry, e.g. "1," or
 * "1,2," — see the page's enable_openvpn() function). Modeled here as a
 * derived virtual field; buildFields/buildVerify below reconstruct the full
 * joined string from the OTHER (non-selected) instance's membership, which
 * is recovered from the raw vpn_serverx_start value carried unedited in the
 * page's full value set (it is read but never rendered as its own field).
 * The current instance token itself isn't passed to buildFields by the
 * renderer, so read.derive stashes it into a synthetic '__unit' value.
 */
function ovpnStartTokens(raw: string): Set<string> {
  return new Set((raw ?? '').split(/[^12]+/).filter(Boolean));
}

function ovpnJoinStart(tokens: Set<string>): string {
  return Array.from(tokens)
    .sort()
    .map((d) => `${d},`)
    .join('');
}

/**
 * vpn_server{p}_ccd_val ("Allowed Clients" / client-specific config list):
 * stored record is a fixed-enable-flag + 4 fields, from the page's own join
 * code (`"<1>" + CN + ">" + subnet + ">" + netmask + ">" + push`). Edited
 * here as a clean 4-column virtual list, re-padded with the fixed leading
 * "1" on write (tools-tweaks / firewall.ts derive pattern).
 */
function ccdValFromStored(stored: string): string {
  if (!stored) return '';
  return stored
    .split('<')
    .filter((rec) => rec !== '')
    .map((rec) => {
      const c = rec.split('>');
      return `<${c[1] ?? ''}>${c[2] ?? ''}>${c[3] ?? ''}>${c[4] ?? ''}`;
    })
    .join('');
}

function ccdValToStored(view: string): string {
  if (!view) return '';
  return view
    .split('<')
    .filter((rec) => rec !== '')
    .map((rec) => {
      const c = rec.split('>');
      return `<1>${c[0] ?? ''}>${c[1] ?? ''}>${c[2] ?? ''}>${c[3] ?? ''}`;
    })
    .join('');
}

export const openvpnServerPage: SettingsPageDef = {
  kind: 'settings',
  id: 'openvpn-server',
  aspPage: 'Advanced_VPN_OpenVPN.asp',
  title: 'OpenVPN Server',
  navGroup: 'vpn',
  navSub: 'incoming',
  navOrder: 38,
  navLabel: 'OpenVPN Server',
  merlinOnly: true,
  gate: (c) => hasFlag(c, 'openvpnd_support'),
  confidence: { read: 'live-verified', write: 'unverified-write' },
  writeExclusion: 'vpn',
  instance: {
    label: 'Server unit',
    options: [
      { value: '1', label: 'Server 1' },
      { value: '2', label: 'Server 2' },
    ],
  },
  intro:
    'The username/password client list (nvram vpn_serverx_clientlist) is a single flat key shared across BOTH server instances rather than per-instance — its true per-unit write behavior could not be confirmed from source, so it is left out of this pass. Custom Configuration (vpn_server_custom3) is read/written through a dedicated get_ovpn_custom/set_ovpn_custom path rather than plain nvram, and certificate/key material (vpn_crt_server*) is BLOB storage — both out of scope here, same as other cert material project-wide.',
  read: {
    nvram: [
      'vpn_serverx_start',
      'vpn_server{p}_if',
      'vpn_server{p}_proto',
      'vpn_server{p}_port',
      'vpn_server{p}_crypt',
      'vpn_server{p}_client_access',
      'vpn_server{p}_userpass_auth',
      'vpn_server{p}_igncrt',
      'vpn_server{p}_tls_keysize',
      'vpn_server{p}_hmac',
      'vpn_server{p}_digest',
      'vpn_server{p}_cipher',
      'vpn_server{p}_sn',
      'vpn_server{p}_nm',
      'vpn_server{p}_dhcp',
      'vpn_server{p}_r1',
      'vpn_server{p}_r2',
      'vpn_server{p}_local',
      'vpn_server{p}_remote',
      'vpn_server{p}_pdns',
      'vpn_server{p}_ncp_ciphers',
      'vpn_server{p}_comp',
      'vpn_server{p}_verb',
      'vpn_server{p}_ccd',
      'vpn_server{p}_c2c',
      'vpn_server{p}_ccd_excl',
      'vpn_server{p}_ip6',
      'vpn_server{p}_nat6',
      'vpn_server{p}_sn6',
      'vpn_server{p}_local6',
      'vpn_server{p}_remote6',
    ],
    nvramAscii: ['vpn_server{p}_ccd_val'],
    derive: (raw, instance) => ({
      vpn_server_enable: instance && ovpnStartTokens(raw.vpn_serverx_start ?? '').has(instance) ? '1' : '0',
      __unit: instance ?? '',
      vpn_server_ccd_val_view: ccdValFromStored(raw['vpn_server{p}_ccd_val'] ?? ''),
    }),
  },
  sections: [
    {
      title: 'Basic settings',
      fields: [
        { key: 'vpn_server_enable', label: 'Enable OpenVPN server', control: 'radio', options: yesNo },
        {
          key: 'vpn_server{p}_if',
          label: 'Interface type',
          control: 'radio',
          options: [
            { value: 'tun', label: 'TUN' },
            { value: 'tap', label: 'TAP' },
          ],
        },
        {
          key: 'vpn_server{p}_proto',
          label: 'Protocol',
          control: 'radio',
          options: [
            { value: 'tcp-server', label: 'TCP' },
            { value: 'udp', label: 'UDP' },
          ],
        },
        {
          key: 'vpn_server{p}_port',
          label: 'Server port',
          hint: 'Default: 1194',
          control: 'number',
          validate: { min: 1, max: 65535, required: true },
        },
        {
          key: 'vpn_server{p}_crypt',
          label: 'Authorization mode',
          control: 'radio',
          options: [
            { value: 'tls', label: 'TLS' },
            { value: 'secret', label: 'Static Key' },
          ],
        },
        {
          key: 'vpn_server{p}_client_access',
          label: 'Allow clients to access',
          control: 'radio',
          options: [
            { value: '0', label: 'LAN only' },
            { value: '1', label: 'Internet only' },
            { value: '2', label: 'Both' },
          ],
        },
      ],
    },
    {
      title: 'Authentication',
      fields: [
        {
          key: 'vpn_server{p}_userpass_auth',
          label: 'Username/Password authentication',
          control: 'radio',
          options: yesNo,
          showIf: (v) => v['vpn_server{p}_crypt'] === 'tls',
        },
        {
          key: 'vpn_server{p}_igncrt',
          label: 'Authorize only (no client certificate required)',
          control: 'radio',
          options: yesNo,
          showIf: (v) => v['vpn_server{p}_crypt'] === 'tls' && v['vpn_server{p}_userpass_auth'] === '1',
        },
        {
          key: 'vpn_server{p}_tls_keysize',
          label: 'RSA key size',
          control: 'radio',
          options: [
            { value: '0', label: '1024 bit' },
            { value: '1', label: '2048 bit' },
          ],
          showIf: (v) => v['vpn_server{p}_crypt'] === 'tls',
        },
        {
          key: 'vpn_server{p}_hmac',
          label: 'TLS control channel security (tls-auth / tls-crypt)',
          control: 'select',
          options: [
            { value: '-1', label: 'Disabled' },
            { value: '2', label: 'Bi-directional Auth' },
            { value: '0', label: 'Incoming Auth (0)' },
            { value: '1', label: 'Outgoing Auth (1)' },
            { value: '3', label: 'Encrypt channel' },
          ],
          showIf: (v) => v['vpn_server{p}_crypt'] !== 'secret',
        },
        {
          key: 'vpn_server{p}_digest',
          label: 'HMAC authentication',
          hint: 'Not recommended',
          control: 'select',
          options: [
            { value: 'default', label: 'Default' },
            { value: 'none', label: 'None' },
            { value: 'MD5', label: 'MD 5' },
            { value: 'SHA1', label: 'SHA 1' },
            { value: 'SHA224', label: 'SHA 224' },
            { value: 'SHA256', label: 'SHA 256' },
            { value: 'SHA384', label: 'SHA 384' },
            { value: 'SHA512', label: 'SHA 512' },
            { value: 'RIPEMD160', label: 'RIPEMD 160' },
            { value: 'RSA-MD4', label: 'RSA MD4' },
          ],
        },
      ],
    },
    {
      title: 'Network',
      fields: [
        {
          key: 'vpn_server{p}_sn',
          label: 'Server subnet',
          control: 'text',
          validate: { pattern: IP_PATTERN, patternHint: IP_HINT },
          showIf: (v) => v['vpn_server{p}_crypt'] === 'tls' && v['vpn_server{p}_if'] === 'tun',
        },
        {
          key: 'vpn_server{p}_nm',
          label: 'Server netmask',
          control: 'text',
          validate: { pattern: IP_PATTERN, patternHint: IP_HINT },
          showIf: (v) => v['vpn_server{p}_crypt'] === 'tls' && v['vpn_server{p}_if'] === 'tun',
        },
        {
          key: 'vpn_server{p}_dhcp',
          label: 'Assign client IPs automatically (DHCP)',
          control: 'radio',
          options: yesNo,
          showIf: (v) => v['vpn_server{p}_crypt'] === 'tls' && v['vpn_server{p}_if'] === 'tap',
        },
        {
          key: 'vpn_server{p}_r1',
          label: 'Client pool start IP',
          control: 'text',
          validate: { pattern: IP_PATTERN, patternHint: IP_HINT },
          showIf: (v) =>
            v['vpn_server{p}_crypt'] === 'tls' && v['vpn_server{p}_if'] === 'tap' && v['vpn_server{p}_dhcp'] === '0',
        },
        {
          key: 'vpn_server{p}_r2',
          label: 'Client pool end IP',
          control: 'text',
          validate: { pattern: IP_PATTERN, patternHint: IP_HINT },
          showIf: (v) =>
            v['vpn_server{p}_crypt'] === 'tls' && v['vpn_server{p}_if'] === 'tap' && v['vpn_server{p}_dhcp'] === '0',
        },
        {
          key: 'vpn_server{p}_local',
          label: 'Local endpoint IP',
          control: 'text',
          validate: { pattern: IP_PATTERN, patternHint: IP_HINT },
          showIf: (v) => v['vpn_server{p}_crypt'] === 'secret' && v['vpn_server{p}_if'] === 'tun',
        },
        {
          key: 'vpn_server{p}_remote',
          label: 'Remote endpoint IP',
          control: 'text',
          validate: { pattern: IP_PATTERN, patternHint: IP_HINT },
          showIf: (v) => v['vpn_server{p}_crypt'] === 'secret' && v['vpn_server{p}_if'] === 'tun',
        },
        {
          key: 'vpn_server{p}_pdns',
          label: 'Push DNS to clients',
          control: 'radio',
          options: yesNo,
          showIf: (v) => v['vpn_server{p}_crypt'] === 'tls',
        },
      ],
    },
    {
      title: 'Encryption',
      fields: [
        {
          key: 'vpn_server{p}_ncp_ciphers',
          label: 'Data ciphers',
          hint: 'Negotiated cipher list (TLS mode)',
          control: 'text',
          validate: { maxLength: 127 },
          showIf: (v) => v['vpn_server{p}_crypt'] === 'tls',
        },
        {
          key: 'vpn_server{p}_cipher',
          label: 'Cipher',
          hint: 'Default: BF-CBC',
          control: 'select',
          options: [
            { value: 'default', label: 'Default' },
            { value: 'none', label: 'None' },
            { value: 'AES-128-CBC', label: 'AES-128-CBC' },
            { value: 'AES-192-CBC', label: 'AES-192-CBC' },
            { value: 'AES-256-CBC', label: 'AES-256-CBC' },
            { value: 'BF-CBC', label: 'BF-CBC' },
            { value: 'CAST5-CBC', label: 'CAST5-CBC' },
            { value: 'CAMELLIA-128-CBC', label: 'CAMELLIA-128-CBC' },
            { value: 'CAMELLIA-192-CBC', label: 'CAMELLIA-192-CBC' },
            { value: 'CAMELLIA-256-CBC', label: 'CAMELLIA-256-CBC' },
            { value: 'DES-CBC', label: 'DES-CBC' },
            { value: 'DES-EDE-CBC', label: 'DES-EDE-CBC' },
            { value: 'DES-EDE3-CBC', label: 'DES-EDE3-CBC' },
            { value: 'DESX-CBC', label: 'DESX-CBC' },
            { value: 'IDEA-CBC', label: 'IDEA-CBC' },
            { value: 'SEED-CBC', label: 'SEED-CBC' },
          ],
          showIf: (v) => v['vpn_server{p}_crypt'] === 'secret',
        },
        {
          key: 'vpn_server{p}_comp',
          label: 'Compression',
          control: 'select',
          options: [
            { value: '-1', label: 'Disabled' },
            { value: 'no', label: 'No' },
            { value: 'yes', label: 'LZO' },
            { value: 'adaptive', label: 'LZO Adaptive' },
            { value: 'lz4', label: 'LZ4' },
            { value: 'lz4-v2', label: 'LZ4-V2' },
          ],
        },
        {
          key: 'vpn_server{p}_verb',
          label: 'Log verbosity',
          hint: 'Between 0 and 6. Default: 3',
          control: 'number',
          validate: { min: 0, max: 6 },
        },
      ],
    },
    {
      title: 'Client-specific configuration',
      fields: [
        {
          key: 'vpn_server{p}_ccd',
          label: 'Enable client-specific configuration',
          control: 'radio',
          options: yesNo,
          showIf: (v) => v['vpn_server{p}_crypt'] === 'tls',
        },
        { key: 'vpn_server{p}_c2c', label: 'Allow client <-> client traffic', control: 'radio', options: yesNo },
        {
          key: 'vpn_server{p}_ccd_excl',
          label: 'Only allow specified clients to connect',
          control: 'radio',
          options: yesNo,
          showIf: (v) => v['vpn_server{p}_crypt'] === 'tls' && v['vpn_server{p}_ccd'] === '1',
        },
        {
          key: 'vpn_server_ccd_val_view',
          label: 'Allowed clients',
          hint: 'Common Name > subnet > netmask > push route to other clients. Stored in nvram vpn_server{p}_ccd_val.',
          control: 'list',
          ascii: true,
          showIf: (v) => v['vpn_server{p}_crypt'] === 'tls' && v['vpn_server{p}_ccd'] === '1',
          list: {
            maxRows: 128,
            columns: [
              { id: 'cn', label: 'Common Name (CN)', validate: { required: true, maxLength: 64 } },
              { id: 'subnet', label: 'Subnet', mono: true, validate: { pattern: IP_PATTERN, patternHint: IP_HINT } },
              { id: 'netmask', label: 'Netmask', mono: true, validate: { pattern: IP_PATTERN, patternHint: IP_HINT } },
              {
                id: 'push',
                label: 'Push',
                width: 90,
                control: 'select',
                options: [
                  { value: '0', label: 'No' },
                  { value: '1', label: 'Yes' },
                ],
              },
            ],
          },
        },
      ],
    },
    {
      title: 'IPv6',
      showIf: (_v, caps) => hasFlag(caps, 'ipv6_support'),
      fields: [
        { key: 'vpn_server{p}_ip6', label: 'Enable IPv6 server mode', control: 'radio', options: yesNo },
        {
          key: 'vpn_server{p}_nat6',
          label: 'Enable NAT for IPv6',
          control: 'radio',
          options: yesNo,
          showIf: (v) => v['vpn_server{p}_ip6'] === '1',
        },
        {
          key: 'vpn_server{p}_sn6',
          label: 'IPv6 server subnet/netmask',
          control: 'text',
          validate: { maxLength: 43 },
          showIf: (v) => v['vpn_server{p}_ip6'] === '1',
        },
        {
          key: 'vpn_server{p}_local6',
          label: 'IPv6 local endpoint',
          control: 'text',
          validate: { maxLength: 39 },
          showIf: (v) => v['vpn_server{p}_ip6'] === '1' && v['vpn_server{p}_crypt'] === 'secret',
        },
        {
          key: 'vpn_server{p}_remote6',
          label: 'IPv6 remote endpoint',
          control: 'text',
          validate: { maxLength: 39 },
          showIf: (v) => v['vpn_server{p}_ip6'] === '1' && v['vpn_server{p}_crypt'] === 'secret',
        },
      ],
    },
  ],
  write: {
    endpoint: 'applyapp',
    // Native branches by direction (Advanced_VPN_OpenVPN.asp ~625-634):
    // action_script = "restart_chpass;restart_vpnserver" + unit when
    // VPNServer_enable ends up "1" at submit time, else "stop_vpnserver" +
    // unit. The condition reads the CURRENT form value, i.e. the
    // resulting/new state after this Apply, not only whether enable itself
    // was the field just edited — reproduced here via `all.vpn_server_enable`
    // (the full edited value set passed to this resolver), the same pattern
    // native's own inline JS uses (it re-derives action_script from DOM
    // state on every submit). restart_chpass (password-hash sync) is
    // included verbatim on the enable branch, matching native; nothing else
    // on this page depends on it. See DECISIONS.md D-010 / OPEN_LOOPS.md
    // "rcService restart vs. stop branching" for the prior static-restart
    // gap this replaces.
    rcService: (_changed, all) => (all.vpn_server_enable === '1' ? 'restart_chpass;restart_vpnserver{p}' : 'stop_vpnserver{p}'),
    actionWait: 15,
    buildFields: (changed, all) => {
      const fields: Record<string, string> = {};
      for (const [k, v] of Object.entries(changed)) {
        if (k === 'vpn_server_enable') continue;
        else if (k === 'vpn_server_ccd_val_view') fields['vpn_server{p}_ccd_val'] = ccdValToStored(v);
        else fields[k] = v;
      }
      if ('vpn_server_enable' in changed) {
        const tokens = ovpnStartTokens(all.vpn_serverx_start ?? '');
        const unit = all.__unit;
        if (changed.vpn_server_enable === '1') tokens.add(unit);
        else tokens.delete(unit);
        fields.vpn_serverx_start = ovpnJoinStart(tokens);
      }
      return fields;
    },
    buildVerify: (changed, all) => {
      const expect: Record<string, string> = {};
      for (const [k, v] of Object.entries(changed)) {
        if (k === 'vpn_server_enable') continue;
        else if (k === 'vpn_server_ccd_val_view') expect['vpn_server{p}_ccd_val'] = ccdValToStored(v);
        else expect[k] = v;
      }
      if ('vpn_server_enable' in changed) {
        const tokens = ovpnStartTokens(all.vpn_serverx_start ?? '');
        const unit = all.__unit;
        if (changed.vpn_server_enable === '1') tokens.add(unit);
        else tokens.delete(unit);
        expect.vpn_serverx_start = ovpnJoinStart(tokens);
      }
      return expect;
    },
  },
};

// ---------------------------------------------------------------------------
// WireGuard Server (Advanced_WireguardServer_Content.asp)
// ---------------------------------------------------------------------------

export const wireguardServerPage: SettingsPageDef = {
  kind: 'settings',
  id: 'wireguard-server',
  aspPage: 'Advanced_WireguardServer_Content.asp',
  title: 'WireGuard Server',
  navGroup: 'vpn',
  navSub: 'incoming',
  navOrder: 39,
  navLabel: 'WireGuard Server',
  gate: (c) => hasFlag(c, 'wireguard_support'),
  confidence: { read: 'structural', write: 'unverified-write' },
  writeExclusion: 'vpn',
  intro:
    'This router only exposes one WireGuard server instance (wgs1_, the native page hardcodes its instance selector to a single option) — no instance selector is modeled here. Peer management (the wgs1_c1_ .. wgs1_c10_ per-peer families: name, address, allowed IPs, preshared key) is deferred to a later pass; this page only edits the server-wide interface settings.',
  read: {
    nvram: ['wgs1_enable', 'wgs1_dns', 'wgs1_nat6', 'wgs1_psk', 'wgs1_alive', 'wgs1_addr', 'wgs1_port', 'wgs1_priv', 'wgs1_pub'],
  },
  sections: [
    {
      title: 'Basic config',
      fields: [
        { key: 'wgs1_enable', label: 'Enable WireGuard server', control: 'radio', options: yesNo },
        { key: 'wgs1_dns', label: 'Allow DNS', control: 'radio', options: yesNo },
        { key: 'wgs1_nat6', label: 'IPv6 NAT', control: 'radio', options: yesNo },
        { key: 'wgs1_psk', label: 'Use preshared key', control: 'radio', options: yesNo },
        {
          key: 'wgs1_alive',
          label: 'Persistent keepalive (seconds)',
          control: 'number',
          validate: { min: 0, max: 65535 },
        },
      ],
    },
    {
      title: 'Interface',
      fields: [
        { key: 'wgs1_priv', label: 'Private key', control: 'readonly' },
        { key: 'wgs1_pub', label: 'Public key', control: 'readonly' },
        { key: 'wgs1_addr', label: 'Address', control: 'text', validate: { maxLength: 63, required: true } },
        { key: 'wgs1_port', label: 'Listen port', control: 'number', validate: { min: 1, max: 65535, required: true } },
      ],
    },
  ],
  write: {
    endpoint: 'applyapp',
    rcService: 'restart_wgs;restart_dnsmasq',
    actionWait: 1,
    // validate_apply's redirect for wgs_ prefixed fields (web.c ~4746-4755)
    // requires unit to already be positive, which happens when wgs_unit is
    // present anywhere in this posted body. Order in the request does not
    // matter: validate_apply walks the static router_defaults table, not
    // the posted fields, and get_cgi_json is a name-keyed lookup, not
    // positional. wgs_unit already precedes the other wgs_ entries in that
    // table (shared/defaults.c), so no client-side ordering is required.
    // See D-007, D-008, and D-015 in DECISIONS.md. Posting the already-
    // indexed wgs1_xxx keys directly, as this project did before this fix,
    // is never inspected by validate_apply at all, since it only reads
    // keys from that static table, never from the posted body's own names.
    buildFields: (changed) => {
      const fields: Record<string, string> = { wgs_unit: '1' };
      for (const [k, v] of Object.entries(changed)) fields[k.replace(/^wgs1_/, 'wgs_')] = v;
      return fields;
    },
  },
};

// ---------------------------------------------------------------------------
// PPTP VPN Server (Advanced_VPN_PPTP.asp)
// ---------------------------------------------------------------------------

/**
 * pptpd_clients is a composite "start_ip-end_octet" value (the page splits a
 * full start IP and just the last octet of the end IP): "192.168.1.1-150".
 * Decomposed here into two virtual fields, joined on write (tools-tweaks
 * derive pattern).
 */
function pptpClientsFromStored(stored: string): { start: string; end: string } {
  if (!stored) return { start: '', end: '' };
  const [start, end] = stored.split('-');
  return { start: start ?? '', end: end ?? '' };
}

/**
 * pptpd_mppe is a bitmask (128-bit=1, 40-bit=4, no-encryption=8) edited via
 * three checkboxes (initial() forces it to 1|4|8 the first time the page is
 * ever visited with a stored value of 0). Decomposed into three toggles.
 */
const MPPE_128 = 1;
const MPPE_40 = 4;
const MPPE_NO = 8;

export const pptpServerPage: SettingsPageDef = {
  kind: 'settings',
  id: 'pptp-server',
  aspPage: 'Advanced_VPN_PPTP.asp',
  title: 'PPTP Server',
  navGroup: 'vpn',
  navSub: 'incoming',
  navOrder: 40,
  gate: (c) => hasFlag(c, 'pptpd_support'),
  confidence: { read: 'structural', write: 'unverified-write' },
  writeExclusion: 'vpn',
  intro:
    'Advanced settings not modeled in this pass: CHAP method, DNS/WINS server overrides, MRU/MTU, Network Place (Samba) integration, and per-user static routes (pptpd_sr_rulelist).',
  read: {
    nvram: ['pptpd_enable', 'pptpd_broadcast', 'pptpd_clients', 'pptpd_mppe'],
    nvramAscii: ['pptpd_clientlist'],
    derive: (raw) => {
      const clients = pptpClientsFromStored(raw.pptpd_clients ?? '');
      const mppe = Number(raw.pptpd_mppe ?? '0') || 0;
      return {
        pptpd_clients_start: clients.start,
        pptpd_clients_end: clients.end,
        pptpd_mppe_128: mppe & MPPE_128 ? '1' : '0',
        pptpd_mppe_40: mppe & MPPE_40 ? '1' : '0',
        pptpd_mppe_no: mppe & MPPE_NO ? '1' : '0',
      };
    },
  },
  sections: [
    {
      title: 'Basic config',
      fields: [
        { key: 'pptpd_enable', label: 'Enable PPTP VPN server', control: 'radio', options: yesNo },
        {
          key: 'pptpd_clients_start',
          label: 'Client IP pool start',
          control: 'text',
          validate: { required: true, pattern: IP_PATTERN, patternHint: IP_HINT },
        },
        {
          key: 'pptpd_clients_end',
          label: 'Client IP pool end (last octet)',
          control: 'number',
          validate: { required: true, min: 1, max: 254 },
        },
        { key: 'pptpd_broadcast', label: 'Allow broadcast traffic to clients', control: 'radio', options: yesNo },
      ],
    },
    {
      title: 'Encryption',
      fields: [
        { key: 'pptpd_mppe_128', label: 'MPPE-128', control: 'toggle' },
        { key: 'pptpd_mppe_40', label: 'MPPE-40', control: 'toggle' },
        { key: 'pptpd_mppe_no', label: 'No encryption', control: 'toggle' },
      ],
    },
    {
      title: 'Username/password list',
      note: 'Stored in nvram pptpd_clientlist (username>password records).',
      fields: [
        {
          key: 'pptpd_clientlist',
          label: 'PPTP users',
          control: 'list',
          ascii: true,
          list: {
            maxRows: 32,
            columns: [
              {
                id: 'username',
                label: 'Username',
                validate: { required: true, maxLength: 64, pattern: '^[^ @*+|:?<>,./;\\[\\]\\\\="&]+$', patternHint: 'Must not contain space @ * + | : ? < > , . / ; [ ] \\ = " &' },
              },
              {
                id: 'password',
                label: 'Password',
                validate: { required: true, maxLength: 64, pattern: '^[^<>&]+$', patternHint: 'Must not contain < > &' },
              },
            ],
          },
        },
      ],
    },
  ],
  write: {
    endpoint: 'applyapp',
    // Native branches by direction (Advanced_VPN_PPTP.asp ~320-322,
    // 433-434): action_script = "restart_pptpd" when pptpd_enable ends up
    // "1", else "stop_pptpd". Reproduced via `all.pptpd_enable` (the
    // resulting/new state), same pattern as the OpenVPN server page above.
    // Native also appends ";restart_samba" on the enable branch when a
    // page-computed global Samba-integration flag (enable_samba, sourced
    // from unrelated nvram, not modeled anywhere on this page) is set — not
    // reproduced here; out of scope, consistent with this page's existing
    // "Advanced settings not modeled" scoping (see intro above). See
    // DECISIONS.md D-010 / OPEN_LOOPS.md "rcService restart vs. stop
    // branching" for the prior static-restart gap this replaces.
    rcService: (_changed, all) => (all.pptpd_enable === '1' ? 'restart_pptpd' : 'stop_pptpd'),
    actionWait: 10,
    buildFields: (changed, all) => {
      const fields: Record<string, string> = {};
      let clientsTouched = false;
      let mppeTouched = false;
      for (const k of Object.keys(changed)) {
        if (k === 'pptpd_clients_start' || k === 'pptpd_clients_end') clientsTouched = true;
        else if (k === 'pptpd_mppe_128' || k === 'pptpd_mppe_40' || k === 'pptpd_mppe_no') mppeTouched = true;
        else fields[k] = changed[k];
      }
      if (clientsTouched) fields.pptpd_clients = `${all.pptpd_clients_start ?? ''}-${all.pptpd_clients_end ?? ''}`;
      if (mppeTouched) {
        let mask = 0;
        if (all.pptpd_mppe_128 === '1') mask |= MPPE_128;
        if (all.pptpd_mppe_40 === '1') mask |= MPPE_40;
        if (all.pptpd_mppe_no === '1') mask |= MPPE_NO;
        fields.pptpd_mppe = String(mask);
      }
      return fields;
    },
    buildVerify: (changed, all) => {
      const expect: Record<string, string> = {};
      let clientsTouched = false;
      let mppeTouched = false;
      for (const k of Object.keys(changed)) {
        if (k === 'pptpd_clients_start' || k === 'pptpd_clients_end') clientsTouched = true;
        else if (k === 'pptpd_mppe_128' || k === 'pptpd_mppe_40' || k === 'pptpd_mppe_no') mppeTouched = true;
        else expect[k] = changed[k];
      }
      if (clientsTouched) expect.pptpd_clients = `${all.pptpd_clients_start ?? ''}-${all.pptpd_clients_end ?? ''}`;
      if (mppeTouched) {
        let mask = 0;
        if (all.pptpd_mppe_128 === '1') mask |= MPPE_128;
        if (all.pptpd_mppe_40 === '1') mask |= MPPE_40;
        if (all.pptpd_mppe_no === '1') mask |= MPPE_NO;
        expect.pptpd_mppe = String(mask);
      }
      return expect;
    },
  },
};

export const vpnServerPages: SettingsPageDef[] = [openvpnServerPage, wireguardServerPage, pptpServerPage];
