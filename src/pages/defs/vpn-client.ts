/**
 * VPN Client category: OpenVPN Client, WireGuard Client (both 5-instance
 * families selected the same way the native pages do — a single "current
 * unit" nvram pointer whose unprefixed working fields are copied to/from the
 * numbered per-instance keys server-side), and VPN Fusion (the multi-profile
 * client-routing manager).
 *
 * Structural note on Advanced_VPNClient_Content.asp: this firmware's
 * top-level www/Makefile unconditionally (no per-model ifeq) overwrites it
 * with sysdep/FUNCTION/VPNC_V2/Advanced_VPNClient_Content.asp, a thin iframe
 * shell that loads VPN/vpnc.html — a ~4500-line embedded-JS page. That file,
 * not the root www/Advanced_VPNClient_Content.asp source, is what actually
 * serves on RT-BE92U, and is what field extraction below is sourced from.
 *
 * All writes here fall under the operator's 'vpn' hard exclusion: write
 * paths are implemented (where implemented at all — see VPN Fusion) but
 * never live-submitted this session.
 */
import type { SettingsPageDef } from '../types';
import { hasFlag } from '../../lib/capabilities';

const yesNo = [
  { value: '1', label: 'Yes' },
  { value: '0', label: 'No' },
];
const blockAllow = [
  { value: '1', label: 'Block' },
  { value: '0', label: 'Allow' },
];
const BASE64_PATTERN = '^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$';
const BASE64_HINT = 'Base64-encoded key';
const clientUnitOptions = ['1', '2', '3', '4', '5'].map((v) => ({ value: v, label: v }));

// ---------------------------------------------------------------------------
// OpenVPN Client (Advanced_OpenVPNClient_Content.asp)
// ---------------------------------------------------------------------------

/**
 * All editable fields on this page are posted under UNPREFIXED names
 * (vpn_client_addr, vpn_client_if_x, ...); the ASP's vpn_client_get_
 * parameter() populates them server-side from whichever unit vpn_client_unit
 * currently names, and copy_index_to_unindex("vpn_client_", unit, -1) /
 * its inverse do the actual persistence into vpn_client{N}_* (confirmed
 * against shared/defaults.c: vpn_client1_addr, vpn_client1_desc,
 * vpn_client1_username, vpn_client1_password, etc. all exist there — the
 * per-instance family really is vpn_client{p}_*, matching every other field
 * on this page). One exception: the interface radio is posted as
 * "vpn_client_if_x" but copied into the hidden "vpn_client_if" field before
 * submit (applyRule(): `document.form.vpn_client_if.value = ...if_x.value`)
 * — the real stored key is vpn_client{p}_if, not vpn_client{p}_if_x.
 */
const OV = {
  enableView: 'vpn_client{p}_enable_view',
  desc: 'vpn_client{p}_desc',
  ifType: 'vpn_client{p}_if',
  proto: 'vpn_client{p}_proto',
  addr: 'vpn_client{p}_addr',
  port: 'vpn_client{p}_port',
  bridge: 'vpn_client{p}_bridge',
  nat: 'vpn_client{p}_nat',
  fw: 'vpn_client{p}_fw',
  local: 'vpn_client{p}_local',
  remote: 'vpn_client{p}_remote',
  nm: 'vpn_client{p}_nm',
  adns: 'vpn_client{p}_adns',
  rgw: 'vpn_client{p}_rgw',
  gw: 'vpn_client{p}_gw',
  enforce: 'vpn_client{p}_enforce',
  crypt: 'vpn_client{p}_crypt',
  userauth: 'vpn_client{p}_userauth',
  username: 'vpn_client{p}_username',
  password: 'vpn_client{p}_password',
  useronly: 'vpn_client{p}_useronly',
  ncpCiphers: 'vpn_client{p}_ncp_ciphers',
  cipher: 'vpn_client{p}_cipher',
  hmac: 'vpn_client{p}_hmac',
  digest: 'vpn_client{p}_digest',
  verb: 'vpn_client{p}_verb',
  comp: 'vpn_client{p}_comp',
  reneg: 'vpn_client{p}_reneg',
  connretry: 'vpn_client{p}_connretry',
  tlsremote: 'vpn_client{p}_tlsremote',
  cn: 'vpn_client{p}_cn',
  custom3: 'vpn_client{p}_custom3',
} as const;

const OPENVPN_CIPHERS = [
  'AES-128-CBC', 'AES-192-CBC', 'AES-256-CBC', 'BF-CBC', 'CAST5-CBC',
  'DES-CBC', 'DES-EDE3-CBC', 'DES-EDE-CBC', 'DESX-CBC', 'IDEA-CBC',
];
const OPENVPN_DIGESTS = [
  'DSA', 'DSA-SHA', 'DSA-SHA1', 'DSA-SHA1-old', 'ecdsa-with-SHA1', 'MD4', 'MD5', 'MDC2',
  'RIPEMD160', 'RSA-MD4', 'RSA-MD5', 'RSA-MDC2', 'RSA-RIPEMD160', 'RSA-SHA', 'RSA-SHA1',
  'RSA-SHA1-2', 'RSA-SHA224', 'RSA-SHA256', 'RSA-SHA384', 'RSA-SHA512', 'SHA', 'SHA1',
  'SHA224', 'SHA256', 'SHA384', 'SHA512', 'whirlpool',
];
const cipherOptions = [
  { value: 'default', label: 'Default' },
  { value: 'none', label: 'None' },
  ...OPENVPN_CIPHERS.map((c) => ({ value: c, label: c })),
];
const digestOptions = [
  { value: 'default', label: 'Default' },
  { value: 'none', label: 'None' },
  ...OPENVPN_DIGESTS.map((d) => ({ value: d, label: d })),
];
const hmacOptions = [
  { value: '-1', label: 'Disabled' },
  { value: '2', label: 'Bi-directional Auth' },
  { value: '0', label: 'Incoming Auth (0)' },
  { value: '1', label: 'Outgoing Auth (1)' },
  { value: '3', label: 'Encrypt Channel' },
  { value: '4', label: 'Encrypt Channel V2' },
];
const compOptions = [
  { value: '-1', label: 'Disabled' },
  { value: 'no', label: 'None' },
  { value: 'yes', label: 'LZO' },
  { value: 'adaptive', label: 'LZO Adaptive' },
  { value: 'lz4', label: 'LZ4' },
  { value: 'lz4-v2', label: 'LZ4-V2' },
  { value: 'stub', label: 'Stub' },
  { value: 'stub-v2', label: 'Stub-V2' },
];
const adnsOptions = [
  { value: '0', label: 'Disabled' },
  { value: '1', label: 'Relaxed' },
  { value: '2', label: 'Strict' },
  { value: '3', label: 'Exclusive' },
];
const rgwOptions = [
  { value: '0', label: 'No' },
  { value: '1', label: 'Yes (all)' },
  { value: '2', label: 'Yes (VPN Director / policy rules)' },
];
const tlsremoteOptions = [
  { value: '0', label: 'No' },
  { value: '1', label: 'Common Name' },
  { value: '2', label: 'Common Name Prefix' },
  { value: '3', label: 'Subject' },
];

/**
 * vpn_clientx_eas is a SINGLE global nvram key (shared/defaults.c: default
 * ""), not a per-instance one: a comma-separated, comma-terminated list of
 * enabled client-unit numbers (applyRule(): `tmp_value += ""+unit+","`),
 * shared across all 5 client slots. There is no per-instance enable flag to
 * read directly, so the "enabled" toggle here is a decomposed virtual field
 * (tools-tweaks derive/buildFields pattern), with the currently-selected
 * unit threaded through as a hidden derive()-only value (`__unit`) since
 * buildFields/buildVerify aren't given the instance directly.
 */
function decodeEasSet(raw: string): Set<string> {
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}
function encodeEasList(set: Set<string>): string {
  if (set.size === 0) return '';
  return (
    [...set]
      .sort((a, b) => Number(a) - Number(b))
      .join(',') + ','
  );
}
function reconcileEasList(changedValue: string, all: Record<string, string>): string {
  const unit = all.__unit ?? '';
  const set = decodeEasSet(all.vpn_clientx_eas ?? '');
  if (changedValue === '1') set.add(unit);
  else set.delete(unit);
  return encodeEasList(set);
}

export const openvpnClientPage: SettingsPageDef = {
  kind: 'settings',
  id: 'openvpn-client',
  aspPage: 'Advanced_OpenVPNClient_Content.asp',
  title: 'OpenVPN Client',
  navGroup: 'vpn',
  navSub: 'outgoing',
  navOrder: 34,
  navLabel: 'OpenVPN Client',
  merlinOnly: true,
  gate: (c) => hasFlag(c, 'openvpnd_support'),
  confidence: { read: 'live-verified', write: 'unverified-write' },
  writeExclusion: 'vpn',
  instance: { label: 'Client unit', options: clientUnitOptions },
  intro:
    'Certificate/key material (vpn_crt_client{p}_ca/crt/key/static/crl/extra) and .ovpn file import are binary/blob credential uploads and are out of scope here — manage them from the native page.',
  read: {
    nvram: [
      'vpn_clientx_eas',
      OV.ifType, OV.proto, OV.addr, OV.port, OV.bridge, OV.nat, OV.fw,
      OV.local, OV.remote, OV.nm, OV.adns, OV.rgw, OV.gw, OV.enforce,
      OV.crypt, OV.userauth, OV.useronly, OV.cipher, OV.hmac, OV.digest,
      OV.verb, OV.comp, OV.reneg, OV.connretry, OV.tlsremote,
    ],
    nvramAscii: [OV.desc, OV.username, OV.password, OV.ncpCiphers, OV.cn, OV.custom3],
    derive: (raw, instance) => ({
      [OV.enableView]: decodeEasSet(raw.vpn_clientx_eas ?? '').has(instance ?? '') ? '1' : '0',
      __unit: instance ?? '',
    }),
  },
  sections: [
    {
      title: 'Client control',
      fields: [
        {
          key: OV.enableView,
          label: 'Enable this client',
          hint: 'Stored in the single global key vpn_clientx_eas (comma-separated list of enabled unit numbers); toggling here only adds/removes this unit\'s slot.',
          control: 'radio',
          options: yesNo,
        },
        { key: OV.desc, label: 'Description', ascii: true, control: 'text', validate: { maxLength: 25 } },
      ],
    },
    {
      title: 'Network settings',
      fields: [
        { key: OV.ifType, label: 'Interface', control: 'radio', options: [{ value: 'tun', label: 'TUN' }, { value: 'tap', label: 'TAP' }] },
        { key: OV.proto, label: 'Protocol', control: 'radio', options: [{ value: 'tcp-client', label: 'TCP' }, { value: 'udp', label: 'UDP' }] },
        { key: OV.addr, label: 'Server address', hint: 'Domain name or IPv4 address', control: 'text', validate: { maxLength: 128 } },
        { key: OV.port, label: 'Server port', control: 'number', validate: { required: true, min: 1, max: 65535, maxLength: 5 } },
        {
          key: OV.bridge,
          label: 'Server is on the same subnet',
          hint: 'If disabled, distinct-subnet routing is used instead of bridging.',
          control: 'radio',
          options: yesNo,
          showIf: (v) => v[OV.ifType] === 'tap',
        },
        {
          key: OV.nat,
          label: 'Create NAT on tunnel',
          hint: 'If disabled, routes must be configured manually.',
          control: 'radio',
          options: yesNo,
          showIf: (v) => v[OV.ifType] === 'tun' || v[OV.bridge] === '0',
        },
        { key: OV.fw, label: 'Inbound firewall', control: 'radio', options: blockAllow },
        {
          key: OV.local,
          label: 'Local endpoint / tunnel address',
          hint: 'Local/remote endpoint address (TUN + Static Key) or tunnel address (TAP unbridged + Static Key) — same underlying key either way.',
          control: 'text',
          validate: { maxLength: 15 },
          showIf: (v) => v[OV.crypt] === 'secret' && (v[OV.ifType] === 'tun' || (v[OV.ifType] === 'tap' && v[OV.bridge] === '0')),
        },
        {
          key: OV.remote,
          label: 'Remote endpoint address',
          control: 'text',
          validate: { maxLength: 15 },
          showIf: (v) => v[OV.ifType] === 'tun' && v[OV.crypt] === 'secret',
        },
        {
          key: OV.nm,
          label: 'Tunnel netmask',
          control: 'text',
          validate: { maxLength: 15 },
          showIf: (v) => v[OV.ifType] === 'tap' && v[OV.bridge] === '0' && v[OV.crypt] === 'secret',
        },
        {
          key: OV.adns,
          label: 'Accept DNS configuration',
          control: 'select',
          options: adnsOptions,
          showIf: (v) => v[OV.crypt] === 'tls',
        },
        {
          key: OV.rgw,
          label: 'Redirect Internet traffic through tunnel',
          hint: 'The "VPN Director" option only applies in TUN mode; the native page falls back to "Yes (all)" in TAP mode.',
          control: 'select',
          options: rgwOptions,
        },
        {
          key: OV.gw,
          label: 'Gateway',
          control: 'text',
          validate: { maxLength: 15 },
          showIf: (v) => v[OV.ifType] === 'tap' && v[OV.rgw] !== '0',
        },
        {
          key: OV.enforce,
          label: 'Killswitch — block routed clients if tunnel goes down',
          control: 'radio',
          options: yesNo,
          showIf: (v) => v[OV.rgw] !== '0',
        },
      ],
    },
    {
      title: 'Authentication settings',
      fields: [
        { key: OV.crypt, label: 'Authorization mode', control: 'radio', options: [{ value: 'tls', label: 'TLS' }, { value: 'secret', label: 'Static Key' }] },
        {
          key: OV.userauth,
          label: 'Username/password authentication',
          control: 'radio',
          options: yesNo,
          showIf: (v) => v[OV.crypt] === 'tls',
        },
        {
          key: OV.username,
          label: 'Username',
          ascii: true,
          control: 'text',
          validate: { maxLength: 64 },
          showIf: (v) => v[OV.crypt] === 'tls' && v[OV.userauth] === '1',
        },
        {
          key: OV.password,
          label: 'Password',
          ascii: true,
          control: 'password',
          validate: { maxLength: 64 },
          showIf: (v) => v[OV.crypt] === 'tls' && v[OV.userauth] === '1',
        },
        {
          key: OV.useronly,
          label: 'Username/password authentication only',
          hint: 'Skips client-certificate validation — requires trusting the CA only.',
          control: 'radio',
          options: yesNo,
          showIf: (v) => v[OV.crypt] === 'tls' && v[OV.userauth] === '1',
        },
      ],
    },
    {
      title: 'Crypto settings',
      fields: [
        {
          key: OV.ncpCiphers,
          label: 'Data ciphers',
          hint: 'Colon-separated list of allowed TLS 1.3 (NCP) data ciphers.',
          ascii: true,
          control: 'text',
          validate: { maxLength: 127 },
          showIf: (v) => v[OV.crypt] === 'tls',
        },
        {
          key: OV.cipher,
          label: 'Cipher',
          control: 'select',
          options: cipherOptions,
          showIf: (v) => v[OV.crypt] === 'secret',
        },
        {
          key: OV.hmac,
          label: 'TLS control channel security (tls-auth / tls-crypt)',
          control: 'select',
          options: hmacOptions,
          showIf: (v) => v[OV.crypt] === 'tls',
        },
        { key: OV.digest, label: 'Auth digest', control: 'select', options: digestOptions },
      ],
    },
    {
      title: 'Advanced settings',
      fields: [
        { key: OV.verb, label: 'Log verbosity', hint: '0-6, default 3', control: 'number', validate: { required: true, min: 0, max: 6, maxLength: 2 } },
        { key: OV.comp, label: 'Compression', control: 'select', options: compOptions },
        {
          key: OV.reneg,
          label: 'TLS renegotiation time (seconds, -1 for default)',
          control: 'number',
          validate: { required: true, min: -1, max: 32767, maxLength: 5 },
          showIf: (v) => v[OV.crypt] === 'tls',
        },
        { key: OV.connretry, label: 'Connection retry attempts (0 = infinite)', control: 'number', validate: { required: true, min: 0, max: 999, maxLength: 3 } },
        {
          key: OV.tlsremote,
          label: 'Verify server certificate name',
          control: 'select',
          options: tlsremoteOptions,
          showIf: (v) => v[OV.crypt] === 'tls',
        },
        {
          key: OV.cn,
          label: 'Server certificate name value',
          control: 'text',
          validate: { maxLength: 255 },
          showIf: (v) => v[OV.crypt] === 'tls' && v[OV.tlsremote] !== '0',
        },
      ],
    },
    {
      title: 'Custom configuration',
      fields: [{ key: OV.custom3, label: 'Custom configuration', ascii: true, control: 'textarea', validate: { maxLength: 4095 } }],
    },
  ],
  write: {
    endpoint: 'applyapp',
    rcService: 'restart_vpnclient{p}',
    actionWait: 15,
    buildFields: (changed, all) => {
      const fields: Record<string, string> = {};
      for (const [k, v] of Object.entries(changed)) {
        if (k === OV.enableView) fields.vpn_clientx_eas = reconcileEasList(v, all);
        else fields[k] = v;
      }
      return fields;
    },
    buildVerify: (changed, all) => {
      const expect: Record<string, string> = {};
      for (const [k, v] of Object.entries(changed)) {
        if (k === OV.enableView) expect.vpn_clientx_eas = reconcileEasList(v, all);
        else expect[k] = v;
      }
      return expect;
    },
  },
};

// ---------------------------------------------------------------------------
// WireGuard Client (Advanced_WireguardClient_Content.asp)
// ---------------------------------------------------------------------------

/**
 * Same unprefixed-working-copy pattern as OpenVPN client (get_wgc_parameter()
 * -> copy_index_to_unindex("wgc_", unit, -1) in web.c), but here EVERY field
 * — including enable — genuinely has its own per-instance key: defaults.c
 * only lists the unprefixed template ("wgc_enable" default "0", etc.) but
 * web.c's copy_index_to_unindex iterates router_defaults for the "wgc_"
 * prefix and reads/writes "wgc{unit}_<suffix>" for each, so wgc{p}_enable is
 * real (unlike OpenVPN's shared vpn_clientx_eas — no decomposition needed).
 */
const WG = {
  enable: 'wgc{p}_enable',
  desc: 'wgc{p}_desc',
  nat: 'wgc{p}_nat',
  fw: 'wgc{p}_fw',
  enforce: 'wgc{p}_enforce',
  priv: 'wgc{p}_priv',
  mtu: 'wgc{p}_mtu',
  addr: 'wgc{p}_addr',
  dns: 'wgc{p}_dns',
  ppub: 'wgc{p}_ppub',
  psk: 'wgc{p}_psk',
  aips: 'wgc{p}_aips',
  epAddr: 'wgc{p}_ep_addr',
  epPort: 'wgc{p}_ep_port',
  alive: 'wgc{p}_alive',
} as const;

export const wireguardClientPage: SettingsPageDef = {
  kind: 'settings',
  id: 'wireguard-client',
  aspPage: 'Advanced_WireguardClient_Content.asp',
  title: 'WireGuard Client',
  navGroup: 'vpn',
  navSub: 'outgoing',
  navOrder: 35,
  navLabel: 'WireGuard Client',
  gate: (c) => hasFlag(c, 'wireguard_support'),
  confidence: { read: 'live-verified', write: 'unverified-write' },
  writeExclusion: 'vpn',
  instance: { label: 'Client unit', options: clientUnitOptions },
  intro: 'WireGuard config-file import (.conf upload) is a blob upload and is out of scope here — use the native page.',
  read: {
    nvram: [WG.enable, WG.nat, WG.fw, WG.enforce, WG.mtu, WG.epPort, WG.alive],
    nvramAscii: [WG.desc, WG.priv, WG.addr, WG.dns, WG.ppub, WG.psk, WG.aips, WG.epAddr],
  },
  sections: [
    {
      title: 'Client control',
      fields: [
        { key: WG.enable, label: 'Enable WireGuard client', control: 'radio', options: yesNo },
        { key: WG.desc, label: 'Description', ascii: true, control: 'text', validate: { maxLength: 25 } },
      ],
    },
    {
      title: 'Network',
      fields: [
        { key: WG.nat, label: 'Enable NAT', control: 'radio', options: yesNo },
        { key: WG.fw, label: 'Inbound firewall', control: 'radio', options: blockAllow },
        { key: WG.enforce, label: 'Killswitch — block routed clients if tunnel goes down', control: 'radio', options: yesNo },
      ],
    },
    {
      title: 'Interface',
      fields: [
        {
          key: WG.priv,
          label: 'Private key',
          ascii: true,
          control: 'password',
          validate: { required: true, maxLength: 63, pattern: BASE64_PATTERN, patternHint: BASE64_HINT },
        },
        {
          key: WG.mtu,
          label: 'MTU (optional)',
          hint: '576-1500; leave blank to use the default MTU.',
          control: 'text',
          validate: { maxLength: 4 },
        },
        {
          key: WG.addr,
          label: 'Address',
          hint: "This client's tunnel IPv4/IPv6 address(es), optionally with /CIDR, comma-separated.",
          ascii: true,
          control: 'text',
          validate: { required: true, maxLength: 39 },
        },
        {
          key: WG.dns,
          label: 'DNS server (optional)',
          hint: 'IPv4/IPv6 address or host name, comma-separated.',
          ascii: true,
          control: 'text',
          validate: { maxLength: 39 },
        },
      ],
    },
    {
      title: 'Peer',
      fields: [
        {
          key: WG.ppub,
          label: 'Server public key',
          ascii: true,
          control: 'text',
          validate: { required: true, maxLength: 63, pattern: BASE64_PATTERN, patternHint: BASE64_HINT },
        },
        {
          key: WG.psk,
          label: 'Preshared key (optional)',
          ascii: true,
          control: 'password',
          validate: { maxLength: 63, pattern: BASE64_PATTERN, patternHint: BASE64_HINT },
        },
        {
          key: WG.aips,
          label: 'Allowed IPs',
          hint: 'Comma-separated CIDR ranges routed through the tunnel (0.0.0.0/0 = all IPv4 traffic).',
          ascii: true,
          control: 'text',
          validate: { required: true, maxLength: 4095 },
        },
        {
          key: WG.epAddr,
          label: 'Endpoint address',
          hint: 'Server IPv4/IPv6 address or host name.',
          ascii: true,
          control: 'text',
          validate: { required: true, maxLength: 39 },
        },
        { key: WG.epPort, label: 'Endpoint port', control: 'number', validate: { required: true, min: 1, max: 65535, maxLength: 5 } },
        { key: WG.alive, label: 'Persistent keepalive (seconds)', control: 'number', validate: { required: true, min: 1, max: 65535, maxLength: 5 } },
      ],
    },
  ],
  write: {
    endpoint: 'applyapp',
    // Native hidden action_script/action_wait, verbatim (native JS also
    // conditionally appends ";start_vpnrouting0" when enable/enforce change
    // relative to their page-load values — not reproducible from static
    // nvram deltas alone, so not modeled).
    rcService: 'restart_wgc',
    actionWait: 1,
  },
};

// ---------------------------------------------------------------------------
// VPN Fusion (Advanced_VPNClient_Content.asp -> VPNC_V2/VPN/vpnc.html)
// ---------------------------------------------------------------------------

/**
 * vpnc_clientlist record shape, reverse-engineered from vpnc.html's
 * parse_JSONToStr_vpnc_clientlist() / update_vpnc_clientlist_json()
 * (sysdep/FUNCTION/VPNC_V2/VPN/vpnc.html, ~L3383-3572):
 *
 *   desc>proto>server>username>passwd>activate>vpnc_idx>region>>tunnel>wan_idx>caller
 *
 * where field 8 is always empty (unused/reserved). "server"'s meaning is
 * protocol-dependent: for proto in {OpenVPN, CyberGhost} it is the OpenVPN
 * client UNIT NUMBER (cross-references vpn_client{N}_*, i.e. the page
 * above); for {WireGuard, Surfshark, NordVPN} it is the WireGuard client
 * unit number; for PPTP/L2TP it is a literal server hostname/IP with
 * username/passwd used directly. A second, index-position-aligned (NOT
 * vpnc_idx-aligned) nvram key vpnc_pptp_options_x_list carries one PPTP
 * option token per record. "activate" (per-profile enable) and default-WAN
 * assignment are only meaningful when the live capability real_vpn_fusion is
 * set, and default-WAN state is read through a hook
 * (get_vpnc_nondef_wan_prof_list), not a plain nvram key.
 *
 * This is too protocol-entangled to model as a safely round-trippable
 * ListSpec (a single column set can't carry different validation/meaning per
 * row depending on that row's own protocol value, and a write would have to
 * keep vpnc_clientlist and vpnc_pptp_options_x_list positionally
 * synchronized across add/delete/reorder). Per the authoring brief's
 * explicit fallback: modeled read-only here. Add/edit/delete profiles from
 * the native VPN Fusion page; per-unit OpenVPN/WireGuard connection settings
 * are still fully editable from the two pages above.
 */
function summarizeVpncProfiles(raw: string): string {
  const records = raw.split('<').filter((r) => r !== '');
  if (records.length === 0) return '(no profiles configured)';
  const unitProtos = new Set(['OpenVPN', 'CyberGhost', 'WireGuard', 'Surfshark', 'NordVPN']);
  return records
    .map((rec, i) => {
      const c = rec.split('>');
      const desc = c[0] || `profile ${i + 1}`;
      const proto = c[1] || '?';
      const server = c[2] || '';
      const activate = c[5];
      const state = activate === '1' ? 'enabled' : activate === '0' ? 'disabled' : 'n/a';
      const target = unitProtos.has(proto) ? `client unit ${server}` : server;
      return `${i + 1}. ${desc} — ${proto} (${target}) · ${state}`;
    })
    .join(' | ');
}

export const vpnFusionPage: SettingsPageDef = {
  kind: 'settings',
  id: 'vpn-fusion',
  aspPage: 'Advanced_VPNClient_Content.asp',
  title: 'VPN Provider Profiles (read-only)',
  navGroup: 'vpn',
  navSub: 'outgoing',
  navOrder: 36,
  gate: (c) => hasFlag(c, 'vpnc_support'),
  confidence: { read: 'live-verified', write: 'unverified-write' },
  writeExclusion: 'vpn',
  intro:
    'VPN Fusion assigns multiple simultaneous client profiles (OpenVPN/WireGuard unit references, or inline PPTP/L2TP credentials) to devices or WAN failover. Its stored encoding packs protocol-dependent fields into shared, position-aligned columns across two nvram keys — too entangled to reconstruct into a safely editable form here. This view is READ-ONLY: add, edit, and delete profiles from the native VPN Fusion page. Per-unit OpenVPN/WireGuard connection settings remain editable on their own pages.',
  read: {
    nvramAscii: ['vpnc_clientlist', 'vpnc_pptp_options_x_list'],
    derive: (raw) => ({ vpnc_profile_summary: summarizeVpncProfiles(raw.vpnc_clientlist ?? '') }),
  },
  sections: [
    {
      title: 'Configured profiles',
      fields: [
        { key: 'vpnc_profile_summary', label: 'Profiles', control: 'readonly' },
        {
          key: 'vpnc_clientlist',
          label: 'Raw vpnc_clientlist',
          hint: 'desc>proto>server>username>passwd>activate>vpnc_idx>region>>tunnel>wan_idx>caller (per record)',
          ascii: true,
          control: 'readonly',
        },
        {
          key: 'vpnc_pptp_options_x_list',
          label: 'Raw vpnc_pptp_options_x_list',
          hint: 'One PPTP option token per record, aligned by list position (not by vpnc_idx)',
          ascii: true,
          control: 'readonly',
        },
      ],
    },
  ],
};

export const vpnClientPages: SettingsPageDef[] = [openvpnClientPage, wireguardClientPage, vpnFusionPage];
