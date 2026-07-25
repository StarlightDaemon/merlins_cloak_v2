/**
 * Wireless category: General, WPS, Bridge/WDS, Wireless MAC Filter, RADIUS
 * Settings, Professional. Field sets, option values, validation bounds, and
 * action_script values extracted from the corresponding pages in the Merlin
 * 3006.102.7_2 www/ source (RAW/merlin). Advanced_WAdvanced_Content.asp has
 * an RT-BE92U model overlay under sysdep/RT-BE92U/www/ — extracted from
 * there, not the generic www/ root version. The other five pages have no
 * RT-BE92U overlay (verified: only Advanced_WAdvanced_Content.asp,
 * Main_Analysis_Content.asp and Main_Netstat_Content.asp exist under
 * sysdep/RT-BE92U/www/), so they're extracted from the www/ root version.
 *
 * All six pages fall under the operator's 'wireless' hard exclusion: write
 * paths are fully implemented, never live-submitted this session.
 * confidence.write is 'unverified-write' on every page, per instruction.
 * confidence.read is 'live-verified' only for Advanced_WAdvanced_Content.asp
 * (on the operator's live-probe page list); every other page here is
 * 'structural'.
 *
 * 3006.x structural notes (this generation rewrote Advanced_Wireless_Content
 * as a JS-templated page — generateSSID()/generateAuthenticationMethod()/etc.
 * building rows into innerHTML, submitted via httpApi.nvramSet(), not a
 * classic <form> POST):
 *
 * 1. BAND NVRAM PREFIX. Advanced_Wireless_Content.asp's own JS
 *    (systemManipulable.wlBandSeq, sourced from js/asus.js) keys every band
 *    by a band-role token read from nvram wlnband_list — "2g1"/"5g1"/"6g1" —
 *    and posts fields as `${token}_ssid`, `${token}_auth_mode_x`, etc.
 *    (confirmed again in the WAdvanced overlay's smart-connect-sync code,
 *    `postData[`${band}_auth_mode_x`]`). Taken alone this would mean the
 *    real nvram prefix for THIS generation is the band token, not the
 *    classic wl0_/wl1_/wl2_ unit index. However: RAW/compare/merlin_nv.txt
 *    (this project's static nvram-key inventory) lists wl0_ssid, wl1_ssid,
 *    wl2_ssid, wl0_auth_mode_x, wl1_auth_mode_x, wl2_auth_mode_x explicitly
 *    and contains zero "2g1"/"5g1"/"6g1"-prefixed keys anywhere; and the
 *    shared task brief (drawing on this operator's own prior sessions)
 *    states plainly "wl0=2.4G, wl1=5G, wl2=6G" and specifies wl{p}_* keys
 *    with instance values '0'/'1'/'2'. get_wl_nband_list(), which actually
 *    populates wlnband_list at runtime, is not present in this open-source
 *    tree (closed Broadcom SDK code) so the live value on THIS unit can't be
 *    confirmed from source alone. This file follows the brief's explicit
 *    wl{p}_ instruction; a future live session should confirm wlnband_list's
 *    actual value on the operator's RT-BE92U before this is fully settled.
 * 2. wl{p}_nmode_x (wireless mode Auto/N-only/Legacy) is read by this page's
 *    JS (to gate other rows) but there is no generateXXX() row that renders
 *    it as an editable control anywhere in Advanced_Wireless_Content.asp —
 *    confirmed by grepping the whole file for a select bound to it. Omitted
 *    from the General page below (see its section note). It IS still a
 *    live, editable field on the Professional page for non-WiFi7 hardware,
 *    but WAdvanced's own initial() hides that same row when wifi7_support is
 *    true (confirmed live on this unit, LIVE_PROBE §2.2) in favor of an
 *    "wl{p}_11be" WiFi 7 mode toggle — modeled there instead.
 * 3. Control channel: on BRCM platforms (this unit — Broadcom HND) the page
 *    posts `${key}_chanspec`, never `${key}_channel`/`${key}_nctrlsb` (those
 *    are the non-BRCM/MTK/QCA branch only). Modeled as wl{p}_chanspec, not
 *    wl{p}_channel.
 * 4. MLO (Multi-Link Operation) is entirely absent from both pages' own
 *    editable rows — it is configured via SDN.asp's "Multi-Link Operation"
 *    preset on this generation, per LIVE_PROBE §5. No MLO field is modeled
 *    anywhere in this file, per the task's explicit instruction.
 */
import type { SettingsPageDef, InstanceSelector } from '../types';
import { hasFlag } from '../../lib/capabilities';

const yesNo = [
  { value: '1', label: 'Yes' },
  { value: '0', label: 'No' },
];
const enableDisable = [
  { value: '1', label: 'Enable' },
  { value: '0', label: 'Disable' },
];
const MAC_PATTERN = '^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$';
const MAC_HINT = 'MAC as AA:BB:CC:DD:EE:FF';

/**
 * Band instance selector shared by every per-band field on this page family.
 * Values are the wl unit substitution strings; see file header note 1 for
 * why '0'/'1'/'2' (not band-role tokens) were chosen. 6 GHz is gated live —
 * band6g_support is confirmed true on this operator's unit (LIVE_PROBE §2.2).
 */
const BAND_INSTANCE: InstanceSelector = {
  label: 'Band',
  options: [
    { value: '0', label: '2.4 GHz' },
    { value: '1', label: '5 GHz' },
    { value: '2', label: '6 GHz', gate: (c) => hasFlag(c, 'band6g_support') },
  ],
};

/**
 * Authentication methods that show the WPA Encryption / Protected
 * Management Frames / Group Key rows (js/asus.js generateWpaEncryption /
 * generateMfp / generateGroupKey displayFlag conditions — identical set for
 * all three). 'psk' and 'wpa' (WPA1/TKIP-only) are omitted from the option
 * list entirely below — see auth_mode_x field comment.
 */
const AUTH_SHOWS_ENCRYPTION = [
  'openowe', 'owe', 'psk2', 'sae', 'pskpsk2', 'psk2sae',
  'wpa2', 'wpa3', 'suite-b', 'wpawpa2', 'wpa2wpa3',
];
/** Authentication methods that need a Pre-Shared Key (generateWpaKey). */
const AUTH_SHOWS_PSK = ['psk2', 'sae', 'pskpsk2', 'psk2sae'];

export const wirelessGeneralPage: SettingsPageDef = {
  kind: 'settings',
  id: 'wireless-general',
  aspPage: 'Advanced_Wireless_Content.asp',
  title: 'Wi-Fi Name & Security',
  navGroup: 'wireless',
  navSub: 'radio',
  navOrder: 4,
  instance: BAND_INSTANCE,
  confidence: { read: 'structural', write: 'unverified-write' },
  writeExclusion: 'wireless',
  intro:
    'MLO (Multi-Link Operation) is SDN-managed on this generation (see SDN.asp) and is not modeled here. Wireless mode (nmode_x) has no editable control on this page for this hardware generation — see Professional for its WiFi 7 mode equivalent.',
  read: {
    nvram: [
      'smart_connect_x',
      'wl{p}_closed',
      'wl{p}_auth_mode_x',
      'wl{p}_crypto',
      'wl{p}_mfp',
      'wl{p}_wpa_gtk_rekey',
      'wl{p}_bw',
      'wl{p}_chanspec',
    ],
    nvramAscii: ['wl{p}_ssid', 'wl{p}_wpa_psk'],
  },
  sections: [
    {
      title: 'Smart Connect',
      note: 'Joins bands under one SSID family. On this Smart-Connect-v2 unit the per-band opt-out checkboxes (nvram smart_connect_selif_x) are not individually modeled here — enabling joins all eligible bands with 2.4 GHz as the reference band.',
      showIf: (_v, caps) => hasFlag(caps, 'smart_connect_v2_support'),
      fields: [
        { key: 'smart_connect_x', label: 'Enable Smart Connect', control: 'radio', options: yesNo },
      ],
    },
    {
      title: 'Network name',
      fields: [
        {
          key: 'wl{p}_ssid',
          label: 'Network Name (SSID)',
          control: 'text',
          ascii: true,
          validate: { required: true, maxLength: 32 },
        },
        { key: 'wl{p}_closed', label: 'Hide SSID', control: 'radio', options: yesNo },
      ],
    },
    {
      title: 'Security',
      fields: [
        {
          key: 'wl{p}_auth_mode_x',
          label: 'Authentication Method',
          hint: 'WPA/WPA1-only and Shared Key (WEP) are legacy-insecure and not offered here. Exact availability is band-dependent: 6 GHz accepts only owe / sae / wpa3 / suite-b / wpa2wpa3 / psk2sae; openowe/owe additionally require oweTransSupport.',
          control: 'select',
          options: [
            { value: 'open', label: 'Open System' },
            { value: 'openowe', label: 'Enhanced Open Transition' },
            { value: 'owe', label: 'Enhanced Open' },
            { value: 'psk2', label: 'WPA2-Personal' },
            { value: 'sae', label: 'WPA3-Personal' },
            { value: 'pskpsk2', label: 'WPA/WPA2-Personal' },
            { value: 'psk2sae', label: 'WPA2/WPA3-Personal' },
            { value: 'wpa2', label: 'WPA2-Enterprise' },
            { value: 'wpa3', label: 'WPA3-Enterprise' },
            { value: 'suite-b', label: 'WPA3-Enterprise 192-bit' },
            { value: 'wpawpa2', label: 'WPA/WPA2-Enterprise' },
            { value: 'wpa2wpa3', label: 'WPA2/WPA3-Enterprise' },
            { value: 'radius', label: 'Radius with 802.1x' },
          ],
        },
        {
          key: 'wl{p}_crypto',
          label: 'WPA Encryption',
          control: 'select',
          options: [
            { value: 'tkip', label: 'TKIP' },
            { value: 'aes', label: 'AES' },
            { value: 'aes+gcmp256', label: 'AES+GCMP256' },
            { value: 'tkip+aes', label: 'TKIP+AES' },
            { value: 'suite-b', label: 'Suite B' },
          ],
          hint: 'Offered values are auth-method-dependent (e.g. aes+gcmp256 only under WPA3/SAE with WiFi 7 mode enabled).',
          showIf: (v) => AUTH_SHOWS_ENCRYPTION.includes(v['wl{p}_auth_mode_x']),
        },
        {
          key: 'wl{p}_wpa_psk',
          label: 'WPA Pre-Shared Key',
          control: 'password',
          ascii: true,
          validate: { maxLength: 64 },
          showIf: (v) => AUTH_SHOWS_PSK.includes(v['wl{p}_auth_mode_x']),
        },
        {
          key: 'wl{p}_mfp',
          label: 'Protected Management Frames',
          control: 'select',
          options: [
            { value: '0', label: 'Disable' },
            { value: '1', label: 'Capable' },
            { value: '2', label: 'Required' },
          ],
          showIf: (v) => AUTH_SHOWS_ENCRYPTION.includes(v['wl{p}_auth_mode_x']),
        },
        {
          key: 'wl{p}_wpa_gtk_rekey',
          label: 'Group Key Rotation Interval',
          hint: 'Seconds; 0 disables periodic rekeying',
          control: 'number',
          validate: { min: 0, max: 2592000 },
          showIf: (v) => AUTH_SHOWS_ENCRYPTION.includes(v['wl{p}_auth_mode_x']),
        },
      ],
    },
    {
      title: 'Channel & bandwidth',
      note: 'AFC (6 GHz standard-power), the BW320 channel-range selector, and AiMesh wireless-backhaul controls are not modeled — they are derived/secondary controls layered on top of these two fields, not independent settings.',
      fields: [
        {
          key: 'wl{p}_bw',
          label: 'Channel Bandwidth',
          control: 'select',
          options: [
            { value: '0', label: 'Auto (20/40/80/160/240/320)' },
            { value: '1', label: '20 MHz' },
            { value: '2', label: '40 MHz' },
            { value: '3', label: '80 MHz' },
            { value: '4', label: '80+80 MHz' },
            { value: '5', label: '160 MHz' },
            { value: '6', label: '240/320 MHz' },
          ],
          hint: 'Not every width applies to every band (240 MHz is 5 GHz-only, 320 MHz is 6 GHz-only, etc.) — the native page filters this list dynamically per band/hardware.',
        },
        {
          key: 'wl{p}_chanspec',
          label: 'Control Channel',
          hint: '"0" = Auto. Otherwise a chanspec string, e.g. "36", "36u"/"36l" (2.4 GHz extension), "6g37/320-1" (6 GHz 320 MHz range). Format is hardware/band-dependent — set via the native page\'s channel picker for anything beyond Auto.',
          control: 'text',
          validate: { maxLength: 16 },
        },
      ],
    },
  ],
  write: {
    endpoint: 'applyapp',
    rcService: 'restart_wireless',
    actionWait: 10,
  },
};

export const wpsPage: SettingsPageDef = {
  kind: 'settings',
  id: 'wps',
  aspPage: 'Advanced_WWPS_Content.asp',
  title: 'Push-Button Pairing (WPS)',
  navGroup: 'wireless',
  navSub: 'access',
  navOrder: 9,
  // No instance selector: wps_enable / wps_band_x are single global nvram
  // keys (the band being configured is itself the field's value), not a
  // wl{p}_-templated family.
  confidence: { read: 'structural', write: 'unverified-write' },
  writeExclusion: 'wireless',
  read: {
    nvram: ['wps_enable', 'wps_band_x'],
  },
  sections: [
    {
      fields: [
        { key: 'wps_enable', label: 'Enable WPS', control: 'radio', options: enableDisable },
        {
          key: 'wps_band_x',
          label: 'Current band',
          hint: '6 GHz is not offered here — the native page removes that option when band6g_support is set, since 6 GHz is SAE/WPA3-only and WPS requires an Open/PSK-compatible band.',
          control: 'select',
          options: [
            { value: '0', label: '2.4 GHz' },
            { value: '1', label: '5 GHz' },
          ],
        },
      ],
    },
  ],
  write: {
    endpoint: 'applyapp',
    rcService: 'restart_wireless',
    actionWait: 3,
  },
};

export const wdsPage: SettingsPageDef = {
  kind: 'settings',
  id: 'wds',
  aspPage: 'Advanced_WMode_Content.asp',
  title: 'Wireless Bridging (WDS)',
  navGroup: 'wireless',
  navSub: 'radio',
  navOrder: 6,
  instance: BAND_INSTANCE,
  confidence: { read: 'structural', write: 'unverified-write' },
  writeExclusion: 'wireless',
  read: {
    nvram: ['wl{p}_mode_x', 'wl{p}_wdsapply_x'],
    nvramAscii: ['wl{p}_wdslist'],
  },
  sections: [
    {
      fields: [
        {
          key: 'wl{p}_mode_x',
          label: 'Wireless Bridge (WDS)',
          control: 'select',
          options: [
            { value: '0', label: 'AP Only' },
            { value: '1', label: 'WDS Only' },
            { value: '2', label: 'Hybrid' },
          ],
        },
        {
          key: 'wl{p}_wdsapply_x',
          label: 'Connect to APs in list',
          control: 'radio',
          options: yesNo,
          showIf: (v) => v['wl{p}_mode_x'] !== '0',
        },
      ],
    },
    {
      title: 'WDS AP list',
      note: 'MAC addresses of remote APs to bridge to (nvram wl{p}_wdslist: leading-"<"-delimited, single field per record — verified from the page\'s own join code, `tmp_value += "<" + mac` with no ">" ever appended since there is only one column).',
      fields: [
        {
          key: 'wl{p}_wdslist',
          label: 'WDS AP list',
          control: 'list',
          ascii: true,
          list: {
            maxRows: 4,
            columns: [
              { id: 'mac', label: 'MAC address', mono: true, placeholder: 'AA:BB:CC:DD:EE:FF', validate: { required: true, pattern: MAC_PATTERN, patternHint: MAC_HINT } },
            ],
          },
        },
      ],
    },
  ],
  write: {
    endpoint: 'applyapp',
    // wl6_support is confirmed present in this unit's live rc_support
    // string (LIVE_PROBE §2.3), matching the page's own wl6_support ? 8 : 3
    // action_wait branch.
    rcService: 'restart_wireless',
    actionWait: 8,
  },
};

export const wirelessMacFilterPage: SettingsPageDef = {
  kind: 'settings',
  id: 'wireless-macfilter',
  aspPage: 'Advanced_ACL_Content.asp',
  title: 'Device Allow/Block List',
  navGroup: 'wireless',
  navSub: 'access',
  navOrder: 8,
  instance: BAND_INSTANCE,
  confidence: { read: 'structural', write: 'unverified-write' },
  writeExclusion: 'wireless',
  read: {
    nvram: ['wl{p}_macmode'],
    nvramAscii: ['wl{p}_maclist_x'],
  },
  sections: [
    {
      fields: [
        {
          key: 'wl{p}_macmode',
          label: 'MAC Filter Mode',
          hint: '"disabled" is the native page\'s "No" state for the enable toggle; allow/deny are the two enabled filter directions.',
          control: 'select',
          options: [
            { value: 'disabled', label: 'Disabled' },
            { value: 'allow', label: 'Accept (whitelist)' },
            { value: 'deny', label: 'Reject (blacklist)' },
          ],
        },
        {
          key: 'wl{p}_maclist_x',
          label: 'MAC filter list',
          hint: 'Stored as leading-"<"-delimited, single field per record (same encoding as WDS AP list), max 64 entries.',
          control: 'list',
          ascii: true,
          list: {
            maxRows: 64,
            columns: [
              { id: 'mac', label: 'MAC address', mono: true, placeholder: 'AA:BB:CC:DD:EE:FF', validate: { required: true, pattern: MAC_PATTERN, patternHint: MAC_HINT } },
            ],
          },
          showIf: (v) => v['wl{p}_macmode'] !== 'disabled',
        },
      ],
    },
  ],
  write: {
    endpoint: 'applyapp',
    rcService: 'restart_wireless',
    actionWait: 3,
  },
};

export const radiusPage: SettingsPageDef = {
  kind: 'settings',
  id: 'radius',
  aspPage: 'Advanced_WSecurity_Content.asp',
  title: 'Enterprise Authentication (RADIUS)',
  navGroup: 'wireless',
  navSub: 'access',
  navOrder: 10,
  instance: BAND_INSTANCE,
  confidence: { read: 'structural', write: 'unverified-write' },
  writeExclusion: 'wireless',
  intro:
    'The native page\'s own Interface selector is hardcoded to only 2.4 GHz / 5 GHz (no 6 GHz option in its <select>, unlike every other page in this category). The same wl{p}_radius_* nvram keys are also read/written for 6 GHz bands by Advanced_Wireless_Content.asp\'s per-band RADIUS rows when its Authentication Method requires 802.1x, so band 2 is modeled here too — but that specific extension is unverified against this dedicated page\'s own native UI.',
  read: {
    nvram: ['wl{p}_radius_ipaddr', 'wl{p}_radius_port', 'wl{p}_radius_key'],
  },
  sections: [
    {
      fields: [
        {
          key: 'wl{p}_radius_ipaddr',
          label: 'Authentication Server IP Address',
          hint: 'IPv4 or IPv6 (the native page validates either, depending on operation mode)',
          control: 'text',
          validate: { required: true, maxLength: 39 },
        },
        {
          key: 'wl{p}_radius_port',
          label: 'Authentication Server Port',
          control: 'number',
          validate: { required: true, min: 0, max: 65535 },
        },
        {
          key: 'wl{p}_radius_key',
          label: 'Authentication Server Password',
          control: 'password',
          validate: { required: true, maxLength: 64 },
        },
      ],
    },
  ],
  write: {
    endpoint: 'applyapp',
    rcService: 'restart_wireless',
    actionWait: 3,
  },
};

export const wirelessProfessionalPage: SettingsPageDef = {
  kind: 'settings',
  id: 'wireless-professional',
  aspPage: 'Advanced_WAdvanced_Content.asp',
  title: 'Advanced Radio Settings',
  navGroup: 'wireless',
  navSub: 'radio',
  navOrder: 5,
  instance: BAND_INSTANCE,
  // On the operator's live-probe page list (LIVE_PROBE_RT-BE92U.md §7.3):
  // renders fully, all expected controls present, one benign console
  // exception on every load (require.min.js, unrelated to these fields).
  confidence: { read: 'live-verified', write: 'unverified-write' },
  writeExclusion: 'wireless',
  intro:
    'Wireless mode (nmode_x) and 802.11ax mode are both hidden by the native page for WiFi 7 hardware (confirmed: wifi7_support hides wl_mode_field/he_mode_field and shows wifi7_mode_field instead) — WiFi 7 Mode below is their live replacement. Regulatory region, the wireless time scheduler, and per-chipset debug knobs (AMPDU/ACK-ratio tuning, TurboQAM, explicit/implicit beamforming, PLCP header, WMM/frameburst/packet-aggregate, multicast rate, Bluetooth coexistence, extended NSS, hardware offload) are all hidden or platform-irrelevant for this WiFi-7/Broadcom-HND unit per the page\'s own initial()/inputCtrl() gating, and are not modeled here.',
  read: {
    nvram: [
      'wl{p}_radio',
      'wl{p}_ap_isolate',
      'wl{p}_user_rssi',
      'wl{p}_igs',
      'wl{p}_bcn',
      'wl{p}_dtim',
      'wl{p}_frag',
      'wl{p}_rts',
      'wl{p}_txpower',
      'wl{p}_11be',
      'wl{p}_ofdma',
      'wl{p}_mumimo',
      'wl{p}_atf',
    ],
  },
  sections: [
    {
      fields: [
        { key: 'wl{p}_radio', label: 'Enable Radio', control: 'radio', options: yesNo },
        {
          key: 'wl{p}_ap_isolate',
          label: 'Set AP Isolated',
          hint: 'Blocks wireless clients on this band from communicating with each other',
          control: 'radio',
          options: yesNo,
        },
        {
          key: 'wl{p}_user_rssi',
          label: 'Roaming Assistant',
          hint: 'Disconnect clients with RSSI lower than this threshold, in dBm. Native page range when enabled: -90 to -40; "0" means disabled.',
          control: 'number',
          validate: { maxLength: 3 },
        },
        { key: 'wl{p}_igs', label: 'Enable IGMP Snooping', control: 'radio', options: enableDisable },
      ],
    },
    {
      title: 'WiFi 7',
      showIf: (_v, caps) => hasFlag(caps, 'wifi7_support'),
      fields: [
        { key: 'wl{p}_11be', label: 'WiFi 7 Mode', control: 'radio', options: enableDisable },
        {
          key: 'wl{p}_mumimo',
          label: 'Multi-User MIMO',
          hint: 'Hidden on the native page when the hide_mumimo capability flag is set',
          control: 'radio',
          options: enableDisable,
        },
        {
          key: 'wl{p}_ofdma',
          label: 'OFDMA / MU-MIMO',
          control: 'select',
          options: [
            { value: '0', label: 'Disable' },
            { value: '1', label: 'DL OFDMA only' },
            { value: '2', label: 'DL/UL OFDMA' },
            { value: '3', label: 'DL/UL OFDMA + DL/UL MU-MIMO' },
          ],
        },
      ],
    },
    {
      title: 'Radio tuning',
      fields: [
        {
          key: 'wl{p}_bcn',
          label: 'Beacon Interval',
          control: 'number',
          validate: { required: true, min: 20, max: 1000 },
        },
        {
          key: 'wl{p}_dtim',
          label: 'DTIM Interval',
          control: 'number',
          validate: { required: true, min: 1, max: 255 },
        },
        {
          key: 'wl{p}_frag',
          label: 'Fragmentation Threshold',
          control: 'number',
          validate: { required: true, min: 256, max: 2346 },
        },
        {
          key: 'wl{p}_rts',
          label: 'RTS Threshold',
          control: 'number',
          validate: { required: true, min: 0, max: 2347 },
        },
        {
          key: 'wl{p}_atf',
          label: 'Airtime Fairness',
          hint: 'Broadcom ARM-platform feature; may not apply to every chipset variant',
          control: 'radio',
          options: enableDisable,
        },
        {
          key: 'wl{p}_txpower',
          label: 'Tx Power Adjustment',
          control: 'select',
          options: [
            { value: '0', label: 'Power Saving' },
            { value: '25', label: 'Fair' },
            { value: '50', label: 'Balance' },
            { value: '88', label: 'Good' },
            { value: '100', label: 'Performance' },
          ],
          showIf: (_v, caps) => hasFlag(caps, 'power_support'),
        },
      ],
    },
  ],
  write: {
    endpoint: 'applyapp',
    rcService: 'restart_wireless',
    // RT-BE92U is explicitly listed in the native page's model-specific
    // action_wait override (applyRule(), based_modelid == "RT-BE92U" branch).
    actionWait: 10,
  },
};

export const wirelessPages: SettingsPageDef[] = [
  wirelessGeneralPage,
  wpsPage,
  wdsPage,
  wirelessMacFilterPage,
  radiusPage,
  wirelessProfessionalPage,
];
